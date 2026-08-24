import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  SERVICIO_ACTIVO,
  Servicio,
  type EstadoServicio,
} from '../../database/entities/servicio.entity';
import {
  Cliente,
  Puerto,
  TipoMercancia,
  TipoNegocio,
  TipoUnidad,
} from '../../database/entities/catalogos.entities';
import { Conductor, Vehiculo } from '../../database/entities/transportes.entities';
import type {
  ActualizarMonitoreoDto,
  ActualizarServicioDto,
  CambiarEstadoDto,
  CrearServicioDto,
  FiltroServiciosDto,
} from './dto/servicio.dto';
import { User } from '../auth/entities/user.entity';
import logger from '../../common/logger';

/** Consecutivo inicial: el histórico ya venía numerado desde ahí. */
const FOLIO_BASE = 2600;

/** Llave del advisory lock que serializa la asignación de folio. */
const LLAVE_FOLIO = 782601;

@Injectable()
export class ServiciosService {
  constructor(
    @InjectRepository(Servicio) private readonly servicios: Repository<Servicio>,
    @InjectRepository(Cliente) private readonly clientes: Repository<Cliente>,
    @InjectRepository(Puerto) private readonly puertos: Repository<Puerto>,
    @InjectRepository(TipoNegocio) private readonly tiposNegocio: Repository<TipoNegocio>,
    @InjectRepository(TipoUnidad) private readonly tiposUnidad: Repository<TipoUnidad>,
    @InjectRepository(TipoMercancia)
    private readonly tiposMercancia: Repository<TipoMercancia>,
    @InjectRepository(Vehiculo) private readonly vehiculos: Repository<Vehiculo>,
    @InjectRepository(Conductor) private readonly conductores: Repository<Conductor>,
    private readonly dataSource: DataSource,
  ) {}

  // ============================================
  // Consulta
  // ============================================

  async listar(filtro: FiltroServiciosDto) {
    const qb = this.servicios
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.cliente', 'cliente')
      .leftJoinAndSelect('s.puerto', 'puerto')
      .leftJoinAndSelect('s.vehiculo', 'vehiculo')
      .leftJoinAndSelect('s.conductor', 'conductor')
      .leftJoinAndSelect('s.tipoNegocio', 'tipoNegocio')
      .leftJoinAndSelect('s.tipoUnidad', 'tipoUnidad')
      .leftJoinAndSelect('s.tipoMercancia', 'tipoMercancia')
      .orderBy('s.citaCarga', 'DESC');

    if (filtro.asignacion) qb.andWhere('s.asignacion = :a', { a: filtro.asignacion });
    if (filtro.estado) qb.andWhere('s.estado = :e', { e: filtro.estado });
    if (filtro.cobro) qb.andWhere('s.cobroEstado = :c', { c: filtro.cobro });
    if (filtro.pago) qb.andWhere('s.pagoEstado = :p', { p: filtro.pago });
    if (filtro.liquidacion) {
      qb.andWhere('s.liquidacionEstado = :l', { l: filtro.liquidacion });
    }
    if (filtro.activos) {
      qb.andWhere('s.estado IN (:...activos)', { activos: SERVICIO_ACTIVO });
    }
    if (filtro.buscar) {
      qb.andWhere(
        '(s.folio ILIKE :q OR s.origen ILIKE :q OR s.destino ILIKE :q OR cliente.nombre ILIKE :q)',
        { q: `%${filtro.buscar}%` },
      );
    }

    const servicios = await qb.getMany();
    return servicios.map((s) => this.presentar(s));
  }

  async obtener(id: string) {
    const servicio = await this.servicios.findOne({ where: { id } });
    if (!servicio) throw new NotFoundException('Servicio no encontrado');
    return this.presentar(servicio);
  }

  /** Cifras del tablero, calculadas en la base y no trayendo todo a memoria. */
  async resumen() {
    const conteos = await this.servicios
      .createQueryBuilder('s')
      .select('COUNT(*)::int', 'activos')
      .addSelect(
        `COUNT(*) FILTER (WHERE s.asignacion = 'TDC')::int`,
        'tdc',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE s.asignacion = 'FWD')::int`,
        'fwd',
      )
      .where('s.estado IN (:...activos)', { activos: SERVICIO_ACTIVO })
      .getRawOne<{ activos: number; tdc: number; fwd: number }>();
    const { activos = 0, tdc = 0, fwd = 0 } = conteos ?? {};

    const financiero = await this.servicios
      .createQueryBuilder('s')
      .select(
        `COALESCE(SUM(s.tarifa) FILTER (WHERE s.estado <> 'cancelado'), 0)::float`,
        'facturacion',
      )
      .addSelect(
        `COALESCE(SUM(s.tarifa - s.costo) FILTER (WHERE s.estado <> 'cancelado'), 0)::float`,
        'margen',
      )
      .addSelect(
        `COALESCE(SUM(s.tarifa) FILTER (WHERE s.estado = 'completado' AND s.cobroEstado <> 'cobrado'), 0)::float`,
        'porCobrar',
      )
      .addSelect(
        `COALESCE(SUM(s.costo) FILTER (WHERE s.estado = 'completado' AND s.pagoEstado <> 'pagado'), 0)::float`,
        'porPagar',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE s.estado = 'completado' AND s.liquidacionEstado = 'pendiente')::int`,
        'porLiquidar',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE s.cobroEstado = 'vencido')::int`,
        'vencidos',
      )
      .getRawOne<Record<string, number>>();

    return { activos, tdc, fwd, ...financiero };
  }

  // ============================================
  // Alta y edición
  // ============================================

  async crear(dto: CrearServicioDto, usuarioId?: string) {
    const relaciones = await this.resolverRelaciones(dto);
    const { cliente, puerto } = this.validarAsignacion(dto, relaciones);

    const citaCarga = new Date(dto.citaCarga);
    const citaDescarga = dto.citaDescarga ? new Date(dto.citaDescarga) : citaCarga;
    if (citaDescarga < citaCarga) {
      throw new BadRequestException(
        'La cita de descarga no puede ser anterior a la de carga',
      );
    }

    // Folio y carta porte se asignan dentro de una transacción con bloqueo:
    // dos altas simultáneas no deben quedarse con el mismo consecutivo.
    const servicio = await this.dataSource.transaction(async (manager) => {
      const consecutivo = await this.siguienteConsecutivo(manager);

      const nuevo = manager.create(Servicio, {
        folio: `RT-${consecutivo}`,
        cartaPorte: `CP-${citaCarga.getFullYear()}-${consecutivo}`,
        cliente,
        origen: dto.origen.trim(),
        destino: dto.destino.trim(),
        puerto,
        citaCarga,
        citaDescarga,
        asignacion: dto.asignacion,
        vehiculo: dto.asignacion === 'TDC' ? relaciones.vehiculo : null,
        conductor: dto.asignacion === 'TDC' ? relaciones.conductor : null,
        proveedorId: dto.asignacion === 'FWD' ? (dto.proveedorId ?? null) : null,
        tipoNegocio: relaciones.tipoNegocio,
        temperatura: dto.temperatura ?? 'SECO',
        modalidad: dto.modalidad ?? 'RT',
        tipoUnidad: relaciones.tipoUnidad,
        tipoMercancia: relaciones.tipoMercancia,
        contenedor1: dto.contenedor1?.trim() ?? '',
        // El segundo contenedor solo tiene sentido si la unidad es full.
        contenedor2: relaciones.tipoUnidad?.full ? (dto.contenedor2?.trim() ?? '') : '',
        booking: dto.booking?.trim() ?? '',
        po: dto.po?.trim() ?? '',
        // Nace sin asignar: pasa a 'programado' solo cuando alguien elige
        // unidad+operador o proveedor y hace clic en "Programar Servicio".
        estado: (dto.estado as EstadoServicio) ?? 'por_asignar',
        km: dto.km ?? 0,
        tarifa: String(dto.tarifa ?? 0),
        costo: String(dto.costo ?? 0),
        cobroDiasCredito: dto.diasCredito ?? cliente.diasCredito,
        cpOrigen: dto.cpOrigen ?? null,
        cpDestino: dto.cpDestino ?? null,
        pesoBrutoTotal: String(dto.pesoBrutoTotal ?? 0),
        unidadPeso: dto.unidadPeso ?? 'KGM',
        claveProdServCP: dto.claveProdServCP ?? null,
        monitoreoUbicacion: dto.origen.trim(),
        monitoreoUltimoEvento: 'Servicio dado de alta',
        monitoreoActualizado: new Date(),
        notas: dto.notas?.trim() || null,
        creadoPor: usuarioId ? ({ id: usuarioId } as User) : null,
      });

      return manager.save(nuevo);
    });

    logger.audit({
      tipo: 'servicio_creado',
      servicioId: servicio.id,
      folio: servicio.folio,
      cartaPorte: servicio.cartaPorte,
      usuarioId,
    });

    return this.obtener(servicio.id);
  }

  async actualizar(id: string, dto: ActualizarServicioDto) {
    const servicio = await this.servicios.findOne({ where: { id } });
    if (!servicio) throw new NotFoundException('Servicio no encontrado');

    if (servicio.estado === 'completado' || servicio.estado === 'cancelado') {
      throw new ConflictException(
        'Un servicio cerrado no se edita; cambie primero su estado',
      );
    }

    const relaciones = await this.resolverRelaciones(dto);
    if (relaciones.cliente) servicio.cliente = relaciones.cliente;
    if (relaciones.puerto) servicio.puerto = relaciones.puerto;
    if (relaciones.tipoNegocio) servicio.tipoNegocio = relaciones.tipoNegocio;
    if (relaciones.tipoUnidad) servicio.tipoUnidad = relaciones.tipoUnidad;
    if (relaciones.tipoMercancia) servicio.tipoMercancia = relaciones.tipoMercancia;

    if (dto.asignacion) servicio.asignacion = dto.asignacion;
    if (servicio.asignacion === 'TDC') {
      // Solo se toca lo que el PATCH menciona: `resolverRelaciones` devuelve
      // null para los campos ausentes, y tomarlo por bueno borraría la
      // asignación de unidad y operador en cualquier edición parcial.
      if (dto.unidadId !== undefined) servicio.vehiculo = relaciones.vehiculo;
      if (dto.operadorId !== undefined) servicio.conductor = relaciones.conductor;
      servicio.proveedorId = null;
    } else {
      if (dto.proveedorId !== undefined) servicio.proveedorId = dto.proveedorId;
      servicio.vehiculo = null;
      servicio.conductor = null;
    }

    if (dto.origen) servicio.origen = dto.origen.trim();
    if (dto.destino) servicio.destino = dto.destino.trim();
    if (dto.citaCarga) servicio.citaCarga = new Date(dto.citaCarga);
    if (dto.citaDescarga) servicio.citaDescarga = new Date(dto.citaDescarga);
    if (dto.temperatura) servicio.temperatura = dto.temperatura;
    if (dto.modalidad) servicio.modalidad = dto.modalidad;
    if (dto.contenedor1 !== undefined) servicio.contenedor1 = dto.contenedor1.trim();
    if (dto.contenedor2 !== undefined) {
      servicio.contenedor2 = servicio.tipoUnidad?.full ? dto.contenedor2.trim() : '';
    }
    if (dto.booking !== undefined) servicio.booking = dto.booking.trim();
    if (dto.po !== undefined) servicio.po = dto.po.trim();
    if (dto.km !== undefined) servicio.km = dto.km;
    if (dto.tarifa !== undefined) servicio.tarifa = String(dto.tarifa);
    if (dto.costo !== undefined) servicio.costo = String(dto.costo);
    if (dto.diasCredito !== undefined) servicio.cobroDiasCredito = dto.diasCredito;
    if (dto.cpOrigen !== undefined) servicio.cpOrigen = dto.cpOrigen;
    if (dto.cpDestino !== undefined) servicio.cpDestino = dto.cpDestino;
    if (dto.pesoBrutoTotal !== undefined) {
      servicio.pesoBrutoTotal = String(dto.pesoBrutoTotal);
    }
    if (dto.unidadPeso !== undefined) servicio.unidadPeso = dto.unidadPeso;
    if (dto.claveProdServCP !== undefined) {
      servicio.claveProdServCP = dto.claveProdServCP;
    }
    if (dto.notas !== undefined) servicio.notas = dto.notas.trim() || null;

    if (servicio.citaDescarga < servicio.citaCarga) {
      throw new BadRequestException(
        'La cita de descarga no puede ser anterior a la de carga',
      );
    }

    await this.servicios.save(servicio);
    logger.audit({ tipo: 'servicio_actualizado', servicioId: id });
    return this.obtener(id);
  }

  // ============================================
  // Operación
  // ============================================

  async cambiarEstado(id: string, dto: CambiarEstadoDto) {
    const servicio = await this.servicios.findOne({ where: { id } });
    if (!servicio) throw new NotFoundException('Servicio no encontrado');

    servicio.estado = dto.estado as EstadoServicio;
    // Cerrar el servicio implica avance completo, se informe o no.
    servicio.monitoreoAvance =
      dto.estado === 'completado' ? 100 : (dto.avance ?? servicio.monitoreoAvance);
    if (dto.ubicacion) servicio.monitoreoUbicacion = dto.ubicacion;
    if (dto.evento) servicio.monitoreoUltimoEvento = dto.evento;
    servicio.monitoreoActualizado = new Date();

    await this.servicios.save(servicio);
    logger.audit({ tipo: 'servicio_estado', servicioId: id, estado: dto.estado });
    return this.obtener(id);
  }

  /**
   * Campos manuales de monitoreo. Separado de `actualizar()` porque lo
   * captura el operador de tráfico desde el tablero de Monitoreo, no desde la
   * edición general del servicio, y porque un servicio cerrado (completado o
   * cancelado) sigue aceptando estos datos aunque ya no acepte otros cambios.
   */
  async actualizarMonitoreo(id: string, dto: ActualizarMonitoreoDto) {
    const servicio = await this.exigir(id);

    if (dto.operadorManual !== undefined) {
      servicio.monitoreoOperadorManual = dto.operadorManual.trim();
    }
    if (dto.medioComunicacion !== undefined) {
      servicio.monitoreoMedioComunicacion = dto.medioComunicacion.trim();
    }
    if (dto.unidadManual !== undefined) {
      servicio.monitoreoUnidadManual = dto.unidadManual.trim();
    }
    if (dto.placaManual !== undefined) {
      servicio.monitoreoPlacaManual = dto.placaManual.trim();
    }
    if (dto.ubicacion !== undefined) {
      servicio.monitoreoUbicacion = dto.ubicacion.trim();
    }
    if (dto.observaciones !== undefined) {
      servicio.monitoreoObservaciones = dto.observaciones.trim();
    }
    if (dto.cuentaEspejo !== undefined) {
      servicio.monitoreoCuentaEspejo = dto.cuentaEspejo.trim();
    }
    if (dto.referencia !== undefined) {
      servicio.monitoreoReferencia = dto.referencia.trim();
    }

    const hito = (valor?: string) => (valor === undefined ? undefined : valor ? new Date(valor) : null);
    if (dto.salidaPatio !== undefined) servicio.monitoreoSalidaPatio = hito(dto.salidaPatio)!;
    if (dto.arriboCarga !== undefined) servicio.monitoreoArriboCarga = hito(dto.arriboCarga)!;
    if (dto.ingresoCargar !== undefined) servicio.monitoreoIngresoCargar = hito(dto.ingresoCargar)!;
    if (dto.inicioRuta !== undefined) servicio.monitoreoInicioRuta = hito(dto.inicioRuta)!;
    if (dto.arriboDestino !== undefined) servicio.monitoreoArriboDestino = hito(dto.arriboDestino)!;
    if (dto.ingresoDescarga !== undefined) servicio.monitoreoIngresoDescarga = hito(dto.ingresoDescarga)!;
    if (dto.servicioFinalizado !== undefined) {
      servicio.monitoreoServicioFinalizado = hito(dto.servicioFinalizado)!;
    }

    servicio.monitoreoActualizado = new Date();

    await this.servicios.save(servicio);
    logger.audit({ tipo: 'servicio_monitoreo_manual', servicioId: id });
    return this.obtener(id);
  }

  // ============================================
  // Cierre financiero
  // ============================================

  async facturar(id: string, factura: string, fechaFactura?: string) {
    const servicio = await this.exigir(id);
    if (servicio.estado !== 'completado') {
      throw new ConflictException('Solo se factura un servicio completado');
    }
    if (servicio.cobroEstado === 'cobrado') {
      throw new ConflictException('El servicio ya está cobrado');
    }

    servicio.cobroEstado = 'facturado';
    servicio.cobroFactura = factura;
    servicio.cobroFechaFactura = fechaFactura ?? new Date().toISOString().slice(0, 10);

    await this.servicios.save(servicio);
    logger.audit({ tipo: 'servicio_facturado', servicioId: id, factura });
    return this.obtener(id);
  }

  async marcarCobrado(id: string) {
    const servicio = await this.exigir(id);
    if (!servicio.cobroFactura) {
      throw new ConflictException('No se puede cobrar un servicio sin factura');
    }
    servicio.cobroEstado = 'cobrado';
    await this.servicios.save(servicio);
    logger.audit({ tipo: 'servicio_cobrado', servicioId: id });
    return this.obtener(id);
  }

  async autorizarPago(id: string) {
    const servicio = await this.exigir(id);
    if (servicio.pagoEstado === 'pagado') {
      throw new ConflictException('El servicio ya está pagado');
    }
    servicio.pagoEstado = 'autorizado';
    await this.servicios.save(servicio);
    logger.audit({ tipo: 'servicio_pago_autorizado', servicioId: id });
    return this.obtener(id);
  }

  async marcarPagado(id: string, referencia: string) {
    const servicio = await this.exigir(id);
    if (servicio.pagoEstado !== 'autorizado') {
      throw new ConflictException('El pago debe autorizarse antes de registrarse');
    }
    servicio.pagoEstado = 'pagado';
    servicio.pagoReferencia = referencia;
    servicio.pagoFecha = new Date().toISOString().slice(0, 10);
    await this.servicios.save(servicio);
    logger.audit({ tipo: 'servicio_pagado', servicioId: id, referencia });
    return this.obtener(id);
  }

  /**
   * Liquidar no exige que el cliente ya haya pagado: esa es una decisión del
   * área, no una regla del sistema. Sí queda registrado en la bitácora cuando
   * se liquida sin cobro, que es lo que después se audita.
   */
  async liquidar(id: string) {
    const servicio = await this.exigir(id);
    if (servicio.estado !== 'completado') {
      throw new ConflictException('Solo se liquida un servicio completado');
    }
    if (servicio.liquidacionEstado === 'liquidado') {
      throw new ConflictException('El servicio ya está liquidado');
    }

    servicio.liquidacionEstado = 'liquidado';
    servicio.liquidacionFecha = new Date().toISOString().slice(0, 10);
    await this.servicios.save(servicio);

    logger.audit({
      tipo: 'servicio_liquidado',
      servicioId: id,
      sinCobrar: servicio.cobroEstado !== 'cobrado',
    });
    return this.obtener(id);
  }

  /**
   * Marca como vencidas las facturas cuyo plazo de crédito ya pasó. Pensado
   * para una tarea programada diaria.
   */
  async marcarVencidos(): Promise<number> {
    const resultado = await this.servicios
      .createQueryBuilder()
      .update(Servicio)
      .set({ cobroEstado: 'vencido' })
      .where("cobro_estado = 'facturado'")
      .andWhere("cobro_fecha_factura + (cobro_dias_credito || ' days')::interval < NOW()")
      .execute();

    const afectados = resultado.affected ?? 0;
    if (afectados) logger.audit({ tipo: 'cxc_vencidas', cantidad: afectados });
    return afectados;
  }

  // ============================================
  // Apoyo
  // ============================================

  private async exigir(id: string): Promise<Servicio> {
    const servicio = await this.servicios.findOne({ where: { id } });
    if (!servicio) throw new NotFoundException('Servicio no encontrado');
    return servicio;
  }

  /**
   * Siguiente consecutivo para folio y carta porte.
   *
   * `MAX(folio) + 1` a secas se rompe con altas simultáneas: dos
   * transacciones leen el mismo máximo y la segunda choca contra el índice
   * único. El advisory lock serializa solo esta sección crítica y se libera
   * al cerrar la transacción, sin bloquear la tabla ni las lecturas.
   */
  private async siguienteConsecutivo(
    manager: { query: (sql: string) => Promise<Array<{ max: number | null }>> },
  ): Promise<number> {
    await manager.query(`SELECT pg_advisory_xact_lock(${LLAVE_FOLIO})`);

    const filas = await manager.query(
      `SELECT MAX(NULLIF(regexp_replace(folio, '\\D', '', 'g'), '')::int) AS max
       FROM servicios`,
    );
    return Math.max(filas[0]?.max ?? FOLIO_BASE, FOLIO_BASE) + 1;
  }

  private async resolverRelaciones(dto: Partial<CrearServicioDto>) {
    const [
      cliente,
      puerto,
      tipoNegocio,
      tipoUnidad,
      tipoMercancia,
      vehiculo,
      conductor,
    ] = await Promise.all([
      dto.clienteId ? this.clientes.findOne({ where: { id: dto.clienteId } }) : null,
      dto.puertoId ? this.puertos.findOne({ where: { id: dto.puertoId } }) : null,
      dto.tipoNegocioId
        ? this.tiposNegocio.findOne({ where: { id: dto.tipoNegocioId } })
        : null,
      dto.tipoUnidadId
        ? this.tiposUnidad.findOne({ where: { id: dto.tipoUnidadId } })
        : null,
      dto.tipoMercanciaId
        ? this.tiposMercancia.findOne({ where: { id: dto.tipoMercanciaId } })
        : null,
      dto.unidadId ? this.vehiculos.findOne({ where: { id: dto.unidadId } }) : null,
      dto.operadorId
        ? this.conductores.findOne({ where: { id: dto.operadorId } })
        : null,
    ]);

    // Un id que no existe es un error del cliente, no un campo vacío.
    if (dto.clienteId && !cliente) throw new BadRequestException('Cliente inexistente');
    if (dto.puertoId && !puerto) throw new BadRequestException('Puerto inexistente');
    if (dto.unidadId && !vehiculo) throw new BadRequestException('Unidad inexistente');
    if (dto.operadorId && !conductor) {
      throw new BadRequestException('Operador inexistente');
    }

    return { cliente, puerto, tipoNegocio, tipoUnidad, tipoMercancia, vehiculo, conductor };
  }

  private validarAsignacion(
    dto: CrearServicioDto,
    relaciones: { cliente: Cliente | null; puerto: Puerto | null },
  ): { cliente: Cliente; puerto: Puerto } {
    if (!relaciones.cliente) throw new BadRequestException('Cliente inexistente');
    if (!relaciones.puerto) throw new BadRequestException('Puerto inexistente');
    if (dto.asignacion === 'FWD' && !dto.proveedorId) {
      throw new BadRequestException('Un servicio FWD necesita proveedor asignado');
    }
    return { cliente: relaciones.cliente, puerto: relaciones.puerto };
  }

  /** Forma que consume el frontend: ids planos y números, no entidades. */
  private presentar(s: Servicio) {
    const tarifa = Number(s.tarifa);
    const costo = Number(s.costo);

    return {
      id: s.id,
      folio: s.folio,
      cartaPorte: s.cartaPorte,
      clienteId: s.cliente?.id ?? '',
      cliente: s.cliente?.nombre ?? '',
      origen: s.origen,
      destino: s.destino,
      puertoId: s.puerto?.id ?? '',
      puerto: s.puerto?.nombre ?? '',
      citaCarga: s.citaCarga?.toISOString() ?? null,
      citaDescarga: s.citaDescarga?.toISOString() ?? null,
      asignacion: s.asignacion,
      unidadId: s.vehiculo?.id ?? '',
      unidad: s.vehiculo?.economico ?? '',
      operadorId: s.conductor?.id ?? '',
      operador: s.conductor?.nombreCompleto ?? '',
      proveedorId: s.proveedorId ?? '',
      tipoNegocioId: s.tipoNegocio?.id ?? '',
      tipoNegocio: s.tipoNegocio?.nombre ?? '',
      temperatura: s.temperatura,
      modalidad: s.modalidad,
      tipoUnidadId: s.tipoUnidad?.id ?? '',
      tipoUnidad: s.tipoUnidad?.nombre ?? '',
      esFull: s.tipoUnidad?.full ?? false,
      tipoMercanciaId: s.tipoMercancia?.id ?? '',
      tipoMercancia: s.tipoMercancia?.nombre ?? '',
      contenedor1: s.contenedor1,
      contenedor2: s.contenedor2,
      booking: s.booking,
      po: s.po,
      estado: s.estado,
      km: s.km,
      tarifa,
      costo,
      margen: tarifa - costo,
      cobro: {
        estado: s.cobroEstado,
        factura: s.cobroFactura,
        fechaFactura: s.cobroFechaFactura,
        diasCredito: s.cobroDiasCredito,
        vencimiento: this.vencimiento(s),
      },
      pago: {
        estado: s.pagoEstado,
        referencia: s.pagoReferencia,
        fechaPago: s.pagoFecha,
      },
      liquidacion: { estado: s.liquidacionEstado, fecha: s.liquidacionFecha },
      monitoreo: {
        avance: s.monitoreoAvance,
        ubicacion: s.monitoreoUbicacion,
        ultimoEvento: s.monitoreoUltimoEvento,
        actualizado: s.monitoreoActualizado?.toISOString() ?? null,
        operadorManual: s.monitoreoOperadorManual,
        medioComunicacion: s.monitoreoMedioComunicacion,
        unidadManual: s.monitoreoUnidadManual,
        placaManual: s.monitoreoPlacaManual,
        observaciones: s.monitoreoObservaciones,
        cuentaEspejo: s.monitoreoCuentaEspejo,
        referencia: s.monitoreoReferencia,
        salidaPatio: s.monitoreoSalidaPatio?.toISOString() ?? null,
        arriboCarga: s.monitoreoArriboCarga?.toISOString() ?? null,
        ingresoCargar: s.monitoreoIngresoCargar?.toISOString() ?? null,
        inicioRuta: s.monitoreoInicioRuta?.toISOString() ?? null,
        arriboDestino: s.monitoreoArriboDestino?.toISOString() ?? null,
        ingresoDescarga: s.monitoreoIngresoDescarga?.toISOString() ?? null,
        servicioFinalizado: s.monitoreoServicioFinalizado?.toISOString() ?? null,
      },
      cpOrigen: s.cpOrigen,
      cpDestino: s.cpDestino,
      pesoBrutoTotal: Number(s.pesoBrutoTotal),
      unidadPeso: s.unidadPeso,
      claveProdServCP: s.claveProdServCP,
      notas: s.notas,
    };
  }

  private vencimiento(s: Servicio): string | null {
    if (!s.cobroFechaFactura) return null;
    const base = new Date(`${s.cobroFechaFactura}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() + s.cobroDiasCredito);
    return base.toISOString().slice(0, 10);
  }
}
