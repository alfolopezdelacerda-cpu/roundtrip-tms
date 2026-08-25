import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type ObjectLiteral } from 'typeorm';
import {
  Cliente,
  Proveedor,
  Puerto,
  Ruta,
  Tarifa,
  TipoMercancia,
  TipoNegocio,
  TipoUnidad,
} from '../../database/entities/catalogos.entities';
import { Conductor, Vehiculo } from '../../database/entities/transportes.entities';
import { Servicio } from '../../database/entities/servicio.entity';
import { EncryptionService } from '../../security/encryption/encryption.service';
import logger from '../../common/logger';

/** Nombres de catálogo aceptados en la ruta `/catalogos/:tipo`. */
export const TIPOS_CATALOGO = [
  'clientes',
  'proveedores',
  'unidades',
  'operadores',
  'puertos',
  'tipos-negocio',
  'tipos-unidad',
  'tipos-mercancia',
  'rutas',
  'tarifas',
] as const;

export type TipoCatalogo = (typeof TIPOS_CATALOGO)[number];

@Injectable()
export class CatalogosService {
  constructor(
    @InjectRepository(Cliente) private readonly clientes: Repository<Cliente>,
    @InjectRepository(Proveedor) private readonly proveedores: Repository<Proveedor>,
    @InjectRepository(Puerto) private readonly puertos: Repository<Puerto>,
    @InjectRepository(TipoNegocio) private readonly tiposNegocio: Repository<TipoNegocio>,
    @InjectRepository(TipoUnidad) private readonly tiposUnidad: Repository<TipoUnidad>,
    @InjectRepository(TipoMercancia)
    private readonly tiposMercancia: Repository<TipoMercancia>,
    @InjectRepository(Vehiculo) private readonly vehiculos: Repository<Vehiculo>,
    @InjectRepository(Conductor) private readonly conductores: Repository<Conductor>,
    @InjectRepository(Ruta) private readonly rutas: Repository<Ruta>,
    @InjectRepository(Tarifa) private readonly tarifas: Repository<Tarifa>,
    @InjectRepository(Servicio) private readonly servicios: Repository<Servicio>,
    private readonly encryption: EncryptionService,
  ) {}

  private repositorio(tipo: TipoCatalogo): Repository<ObjectLiteral> {
    const mapa: Record<TipoCatalogo, Repository<ObjectLiteral>> = {
      clientes: this.clientes,
      proveedores: this.proveedores,
      unidades: this.vehiculos,
      operadores: this.conductores,
      puertos: this.puertos,
      'tipos-negocio': this.tiposNegocio,
      'tipos-unidad': this.tiposUnidad,
      'tipos-mercancia': this.tiposMercancia,
      rutas: this.rutas,
      tarifas: this.tarifas,
    };
    const repo = mapa[tipo];
    if (!repo) throw new BadRequestException(`Catálogo desconocido: ${tipo}`);
    return repo;
  }

  /**
   * Campo del servicio que apunta a cada catálogo. Se usa para saber si un
   * registro está en uso antes de borrarlo.
   */
  private columnaEnServicio(tipo: TipoCatalogo): string {
    return {
      clientes: 'cliente_id',
      proveedores: 'proveedor_id',
      unidades: 'vehiculo_id',
      operadores: 'conductor_id',
      puertos: 'puerto_id',
      'tipos-negocio': 'tipo_negocio_id',
      'tipos-unidad': 'tipo_unidad_id',
      'tipos-mercancia': 'tipo_mercancia_id',
      rutas: 'ruta_id',
      tarifas: '',
    }[tipo];
  }

  /**
   * Columna por la que se ordena cada catálogo: vehículos y conductores no
   * tienen `nombre`, se identifican por económico y por nombre completo.
   */
  private columnaOrden(tipo: TipoCatalogo): string {
    if (tipo === 'unidades') return 'economico';
    if (tipo === 'operadores') return 'nombreCompleto';
    if (tipo === 'rutas') return 'codigo';
    if (tipo === 'tarifas') return 'origen';
    return 'nombre';
  }

  async listar(tipo: TipoCatalogo, soloActivos = false) {
    const repo = this.repositorio(tipo);
    const registros = await repo.find({
      where: soloActivos ? { activo: true } : {},
      order: { [this.columnaOrden(tipo)]: 'ASC' },
    });
    return registros.map((r) => this.presentar(tipo, r));
  }

  async obtener(tipo: TipoCatalogo, id: string) {
    const repo = this.repositorio(tipo);
    const registro = await repo.findOne({ where: { id } });
    if (!registro) throw new NotFoundException('Registro de catálogo no encontrado');
    return this.presentar(tipo, registro);
  }

  async crear(tipo: TipoCatalogo, datos: Record<string, unknown>) {
    if (tipo === 'tarifas') await this.exigirTramoLibre(datos);

    const repo = this.repositorio(tipo);
    const registro = repo.create(this.aPersistencia(tipo, datos));
    const guardado = await repo.save(registro);
    logger.audit({ tipo: 'catalogo_creado', catalogo: tipo, id: guardado.id });
    return this.presentar(tipo, guardado);
  }

  async actualizar(tipo: TipoCatalogo, id: string, datos: Record<string, unknown>) {
    if (tipo === 'tarifas') await this.exigirTramoLibre(datos, id);

    const repo = this.repositorio(tipo);
    const registro = await repo.findOne({ where: { id } });
    if (!registro) throw new NotFoundException('Registro de catálogo no encontrado');

    Object.assign(registro, this.aPersistencia(tipo, datos));
    const guardado = await repo.save(registro);
    logger.audit({ tipo: 'catalogo_actualizado', catalogo: tipo, id });
    return this.presentar(tipo, guardado);
  }

  /**
   * Borra solo si nadie lo referencia. Si está en uso, lo desactiva: borrarlo
   * dejaría servicios históricos apuntando a un registro inexistente.
   */
  async eliminar(tipo: TipoCatalogo, id: string) {
    const usos = await this.usos(tipo, id);
    if (usos > 0) {
      await this.repositorio(tipo).update(id, { activo: false });
      logger.audit({ tipo: 'catalogo_desactivado', catalogo: tipo, id, usos });
      throw new ConflictException({
        statusCode: 409,
        message: `El registro lo usan ${usos} servicio(s); se desactivó en vez de borrarse.`,
        desactivado: true,
        usos,
      });
    }

    const resultado = await this.repositorio(tipo).delete(id);
    if (!resultado.affected) {
      throw new NotFoundException('Registro de catálogo no encontrado');
    }
    logger.audit({ tipo: 'catalogo_eliminado', catalogo: tipo, id });
  }

  /** Cuántos servicios referencian el registro. */
  async usos(tipo: TipoCatalogo, id: string): Promise<number> {
    // El servicio no guarda de qué tarifa salió su importe: lo copia al dar
    // de alta. Sin columna que consultar, una tarifa nunca está "en uso" y
    // siempre se puede borrar.
    const columna = this.columnaEnServicio(tipo);
    if (!columna) return 0;

    return this.servicios
      .createQueryBuilder('s')
      .where(`s.${columna} = :id`, { id })
      .getCount();
  }

  /**
   * Un cliente no puede tener dos tarifas para el mismo tramo: al dar de alta
   * un servicio se busca una sola, y con duplicados cuál gana sería
   * arbitrario. Se compara igual que esa búsqueda: sin distinguir mayúsculas
   * ni espacios sobrantes.
   */
  private async exigirTramoLibre(datos: Record<string, unknown>, excluirId?: string) {
    const { clienteId, origen, destino } = datos as {
      clienteId?: string;
      origen?: string;
      destino?: string;
    };
    if (!clienteId || !origen || !destino) return;

    const qb = this.tarifas
      .createQueryBuilder('t')
      .where('t.cliente_id = :clienteId', { clienteId })
      .andWhere('LOWER(TRIM(t.origen)) = LOWER(TRIM(:origen))', { origen })
      .andWhere('LOWER(TRIM(t.destino)) = LOWER(TRIM(:destino))', { destino });

    if (excluirId) qb.andWhere('t.id <> :excluirId', { excluirId });

    if (await qb.getExists()) {
      throw new ConflictException(
        'Ese cliente ya tiene una tarifa para ese tramo; edita la existente en vez de duplicarla.',
      );
    }
  }

  // ============================================
  // Traducción entre la API y la persistencia
  // ============================================

  /**
   * La API habla el lenguaje de la operación (`unidades` con `economico`,
   * `operadores` con `telefono`); la base guarda vehículos y conductores con
   * los campos personales cifrados. La traducción vive aquí y no en el
   * controlador para que el cifrado no se escape a la capa HTTP.
   */
  private aPersistencia(tipo: TipoCatalogo, datos: Record<string, unknown>) {
    const copia = { ...datos };
    delete copia.id;

    // La tarifa llega con `clienteId` plano y se guarda como relación.
    if (tipo === 'tarifas' && typeof copia.clienteId === 'string') {
      copia.cliente = { id: copia.clienteId };
      delete copia.clienteId;
    }

    if (tipo === 'proveedores' && typeof copia.contacto === 'string') {
      copia.contactoEncrypted = copia.contacto
        ? this.encryption.encrypt(copia.contacto)
        : null;
      delete copia.contacto;
    }

    if (tipo === 'clientes' && typeof copia.rfc === 'string') {
      copia.rfcEncrypted = copia.rfc ? this.encryption.encrypt(copia.rfc) : null;
      delete copia.rfc;
    }

    // Las unidades se presentan con `placas` y `capacidadTon`; la tabla usa
    // `placa` y `capacidad_toneladas`. La API debe aceptar lo mismo que
    // devuelve, así que la traducción va aquí.
    if (tipo === 'unidades') {
      if (typeof copia.placas === 'string') {
        copia.placa = copia.placas;
        delete copia.placas;
      }
      if (typeof copia.capacidadTon === 'number') {
        copia.capacidadToneladas = String(copia.capacidadTon);
        delete copia.capacidadTon;
      }
    }

    if (tipo === 'operadores') {
      if (typeof copia.nombre === 'string') {
        copia.nombreCompleto = copia.nombre;
        delete copia.nombre;
      }
      if (typeof copia.licencia === 'string') {
        copia.licenciaNumero = copia.licencia;
        delete copia.licencia;
      }
      // "Celular" en la interfaz es el mismo teléfono cifrado de siempre.
      if (typeof copia.celular === 'string') {
        copia.telefonoEncrypted = copia.celular
          ? this.encryption.encrypt(copia.celular)
          : null;
        delete copia.celular;
      }
      // El RFC del operador es obligatorio en la figura de transporte del CCP.
      if (typeof copia.rfc === 'string') {
        copia.rfcEncrypted = copia.rfc ? this.encryption.encrypt(copia.rfc) : null;
        delete copia.rfc;
      }
      if (typeof copia.curp === 'string') {
        copia.curpEncrypted = copia.curp ? this.encryption.encrypt(copia.curp) : null;
        delete copia.curp;
      }
      if (typeof copia.contactoEmergencia === 'string') {
        copia.contactoEmergenciaEncrypted = copia.contactoEmergencia
          ? this.encryption.encrypt(copia.contactoEmergencia)
          : null;
        delete copia.contactoEmergencia;
      }
      if (typeof copia.nss === 'string') {
        copia.nssEncrypted = copia.nss ? this.encryption.encrypt(copia.nss) : null;
        delete copia.nss;
      }
    }

    return copia;
  }

  private presentar(tipo: TipoCatalogo, r: ObjectLiteral): Record<string, unknown> {
    if (tipo === 'clientes') {
      return {
        id: r.id,
        nombre: r.nombre,
        rfc: this.descifrar(r.rfcEncrypted),
        regimenFiscal: r.regimenFiscal,
        codigoPostal: r.codigoPostal,
        diasCredito: r.diasCredito,
        activo: r.activo,
      };
    }

    if (tipo === 'unidades') {
      return {
        id: r.id,
        economico: r.economico,
        placas: r.placa,
        tipo: r.tipo,
        capacidadTon: r.capacidadToneladas ? Number(r.capacidadToneladas) : 0,
        estado: r.estado,
        activo: r.activo,
        // Datos que exige el complemento Carta Porte.
        configVehicular: r.configVehicular,
        permisoSct: r.permisoSct,
        numPermisoSct: r.numPermisoSct,
        anio: r.anio,
        aseguradoraCivil: r.aseguradoraCivil,
        polizaCivil: r.polizaCivil,
        // Expediente de Flota.
        modelo: r.modelo,
        marca: r.marca,
        vin: r.vin,
        color: r.color,
        polizaSeguro: r.polizaSeguro,
        vencimientoSeguro: r.vencimientoSeguro,
        verificacionVigente: r.verificacionVigente,
        verificacionVencimiento: r.verificacionVencimiento,
        fotos: r.fotos ?? [],
        documentos: r.documentos ?? [],
      };
    }

    if (tipo === 'operadores') {
      return {
        id: r.id,
        nombre: r.nombreCompleto,
        licencia: r.licenciaNumero,
        celular: this.descifrar(r.telefonoEncrypted),
        rfc: this.descifrar(r.rfcEncrypted),
        contactoEmergencia: this.descifrar(r.contactoEmergenciaEncrypted),
        nss: this.descifrar(r.nssEncrypted),
        estado: r.estado,
        activo: r.activo,
      };
    }

    if (tipo === 'rutas') {
      return {
        id: r.id,
        codigo: r.codigo,
        origen: r.origen,
        destino: r.destino,
        kmProyectados: r.kmProyectados,
        casetasProyectadas: r.casetasProyectadas ? Number(r.casetasProyectadas) : 0,
        activo: r.activo,
      };
    }

    if (tipo === 'tarifas') {
      return {
        id: r.id,
        clienteId: r.cliente?.id ?? '',
        cliente: r.cliente?.nombre ?? '',
        origen: r.origen,
        destino: r.destino,
        tarifaVenta: r.tarifaVenta ? Number(r.tarifaVenta) : 0,
        activo: r.activo,
      };
    }

    if (tipo === 'proveedores') {
      return {
        id: r.id,
        nombre: r.nombre,
        tipo: r.tipo,
        diasPago: r.diasPago,
        contacto: this.descifrar(r.contactoEncrypted),
        activo: r.activo,
      };
    }

    if (tipo === 'tipos-unidad') {
      return { id: r.id, nombre: r.nombre, full: r.full, activo: r.activo };
    }

    return { id: r.id, nombre: r.nombre, activo: r.activo };
  }

  /**
   * Un valor ilegible no debe tumbar el listado completo: puede venir de un
   * cambio de `ENCRYPTION_KEY`, y el resto del catálogo sigue siendo útil.
   */
  private descifrar(valor: unknown): string {
    if (typeof valor !== 'string' || !valor) return '';
    try {
      return this.encryption.decrypt(valor);
    } catch {
      logger.warn('Valor cifrado ilegible en catálogo', 'CatalogosService');
      return '';
    }
  }

  async importarCSV(tipo: TipoCatalogo, archivo: Express.Multer.File) {
    const csv = await import('csv-parse/sync');
    const contenido = archivo.buffer.toString('utf-8');

    let filas: Record<string, string>[];
    try {
      filas = csv.parse(contenido, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (err) {
      throw new BadRequestException(`Error al parsear CSV: ${(err as Error).message}`);
    }

    const resultados = {
      importados: 0,
      errores: [] as Array<{ fila: number; error: string }>,
      total: filas.length,
    };

    for (let i = 0; i < filas.length; i++) {
      try {
        const fila = filas[i];
        if (!fila || Object.keys(fila).every(k => !fila[k])) continue;

        await this.crear(tipo, fila);
        resultados.importados++;
      } catch (err) {
        resultados.errores.push({
          fila: i + 2,
          error: (err as Error).message || 'Error desconocido',
        });
      }
    }

    logger.audit({
      tipo: 'catalogo_bulk_import',
      catalogo: tipo,
      importados: resultados.importados,
      errores: resultados.errores.length,
    });

    return resultados;
  }
}
