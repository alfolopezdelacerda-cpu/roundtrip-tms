import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { CartaPorte } from './entities/carta-porte.entity';
import { Servicio } from '../../database/entities/servicio.entity';
import { EncryptionService } from '../../security/encryption/encryption.service';
import { SelladoService } from './sellado.service';
import { PacService } from './pac/pac.service';
import {
  CABECERA_XML,
  construirComprobante,
  insertarSello,
  type DatosCartaPorte,
} from './xml/cfdi.builder';
import { construirCadenaOriginal } from './xml/cadena-original';
import {
  CP_REGEX,
  PLACA_REGEX,
  RFC_REGEX,
  esClaveValida,
} from './sat-catalogos';
import logger from '../../common/logger';

/** RFC genérico para operaciones con público en general. */
const RFC_GENERICO = 'XAXX010101000';

@Injectable()
export class CartaPorteService {
  constructor(
    @InjectRepository(CartaPorte) private readonly cartas: Repository<CartaPorte>,
    @InjectRepository(Servicio) private readonly servicios: Repository<Servicio>,
    private readonly sellado: SelladoService,
    private readonly pac: PacService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
  ) {}

  // ============================================
  // Consulta
  // ============================================

  async obtenerPorServicio(servicioId: string): Promise<CartaPorte> {
    const carta = await this.cartas.findOne({
      where: { servicio: { id: servicioId } },
      relations: { servicio: true },
    });
    if (!carta) throw new NotFoundException('El servicio no tiene carta porte');
    return carta;
  }

  async listar() {
    const cartas = await this.cartas.find({
      relations: { servicio: true },
      order: { createdAt: 'DESC' },
    });
    return cartas.map((c) => this.presentar(c));
  }

  /**
   * Revisa si el servicio tiene todo lo que el complemento exige, sin emitir
   * nada. Sirve para avisar en pantalla antes de intentar timbrar: el PAC
   * cobra el intento y devuelve códigos poco legibles.
   */
  async validar(servicioId: string) {
    const servicio = await this.exigirServicio(servicioId);
    const faltantes = this.faltantes(servicio);
    return {
      servicioId,
      folio: servicio.folio,
      puedeEmitir: faltantes.length === 0,
      faltantes,
      selladoDisponible: this.sellado.disponible,
      pacSimulado: this.pac.esSimulado,
    };
  }

  // ============================================
  // Emisión
  // ============================================

  /** Construye y sella el XML. No lo timbra: eso es un paso aparte. */
  async generar(servicioId: string): Promise<CartaPorte> {
    const servicio = await this.exigirServicio(servicioId);

    const existente = await this.cartas.findOne({
      where: { servicio: { id: servicioId } },
      relations: { servicio: true },
    });

    if (existente?.estado === 'timbrado') {
      throw new ConflictException(
        'El servicio ya tiene una carta porte timbrada; cancélela antes de emitir otra',
      );
    }

    const faltantes = this.faltantes(servicio);
    if (faltantes.length) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Faltan datos obligatorios para el complemento Carta Porte',
        faltantes,
      });
    }

    const carta = existente ?? this.cartas.create({ servicio });
    // IdCCP: 36 caracteres que deben empezar con 'CCC' según el CCP 3.1.
    carta.idCCP = carta.idCCP || `CCC${randomUUID().slice(3)}`.toUpperCase();
    carta.folio = servicio.folio.replace(/\D/g, '');
    carta.serie = this.config.get<string>('SAT_SERIE', 'CP');

    const datos = this.armarDatos(servicio, carta);
    const comprobante = construirComprobante(datos);
    const cadena = construirCadenaOriginal(comprobante);
    const sello = this.sellado.sellar(cadena);

    insertarSello(comprobante, sello);

    carta.cadenaOriginal = cadena;
    carta.sello = sello;
    carta.noCertificado = this.sellado.noCertificado;
    carta.xmlSinSellar = `${CABECERA_XML}\n${comprobante.toXml()}`;
    carta.estado = 'generado';
    carta.ultimoError = null;

    const guardada = await this.cartas.save(carta);
    logger.audit({
      tipo: 'carta_porte_generada',
      servicioId,
      folio: servicio.folio,
      idCCP: carta.idCCP,
    });
    return guardada;
  }

  /** Envía el XML sellado al PAC y guarda el timbre. */
  async timbrar(servicioId: string): Promise<CartaPorte> {
    const carta = await this.obtenerPorServicio(servicioId);

    if (carta.estado === 'timbrado') {
      throw new ConflictException('La carta porte ya está timbrada');
    }
    if (!carta.xmlSinSellar) {
      throw new ConflictException('Genere el comprobante antes de timbrarlo');
    }

    try {
      const resultado = await this.pac.timbrar(carta.xmlSinSellar);

      carta.uuidFiscal = resultado.uuid;
      carta.fechaTimbrado = new Date(resultado.fechaTimbrado || Date.now());
      carta.xmlTimbrado = resultado.xmlTimbrado;
      carta.pacNombre = resultado.pac;
      carta.estado = 'timbrado';
      carta.ultimoError = null;

      const guardada = await this.cartas.save(carta);

      logger.audit({
        tipo: 'carta_porte_timbrada',
        servicioId,
        uuid: resultado.uuid,
        simulado: resultado.simulado,
      });

      return guardada;
    } catch (error) {
      // El error del PAC se guarda: es lo que hay que corregir para reintentar.
      carta.estado = 'error';
      carta.ultimoError = error instanceof Error ? error.message : String(error);
      await this.cartas.save(carta);

      logger.error('Timbrado rechazado', error, 'CartaPorteService');
      throw error;
    }
  }

  async cancelar(
    servicioId: string,
    motivo: string,
    uuidSustitucion?: string,
  ): Promise<CartaPorte> {
    const carta = await this.obtenerPorServicio(servicioId);

    if (carta.estado !== 'timbrado') {
      throw new ConflictException('Solo se cancela una carta porte timbrada');
    }
    if (!esClaveValida('motivoCancelacion', motivo)) {
      throw new BadRequestException(`Motivo de cancelación inválido: ${motivo}`);
    }
    // El motivo 01 es «con relación»: exige el UUID que lo sustituye.
    if (motivo === '01' && !uuidSustitucion) {
      throw new BadRequestException(
        'El motivo 01 requiere el UUID del comprobante que sustituye',
      );
    }

    const resultado = await this.pac.cancelar(
      carta.uuidFiscal!,
      motivo,
      uuidSustitucion,
    );

    if (!resultado.cancelado) {
      throw new ConflictException(
        `El PAC no canceló el comprobante: ${resultado.estatus}`,
      );
    }

    carta.estado = 'cancelado';
    carta.motivoCancelacion = motivo;
    carta.uuidSustitucion = uuidSustitucion ?? null;
    carta.fechaCancelacion = new Date();

    const guardada = await this.cartas.save(carta);
    logger.audit({
      tipo: 'carta_porte_cancelada',
      servicioId,
      uuid: carta.uuidFiscal,
      motivo,
    });
    return guardada;
  }

  // ============================================
  // Validación y armado
  // ============================================

  /**
   * Lista de lo que impide emitir. Se devuelve completa, no el primer error:
   * quien captura prefiere ver los seis campos que faltan de una vez.
   */
  private faltantes(servicio: Servicio): string[] {
    const faltan: string[] = [];

    // Solo se emite carta porte de lo que mueve la flota propia: en FWD el
    // comprobante lo emite el transportista que efectivamente traslada.
    if (servicio.asignacion !== 'TDC') {
      faltan.push(
        'El servicio es FWD: la carta porte la emite el proveedor que transporta',
      );
      return faltan;
    }

    const cliente = servicio.cliente;
    const rfcCliente = this.descifrar(cliente?.rfcEncrypted);
    if (!rfcCliente) faltan.push('cliente.rfc');
    else if (!RFC_REGEX.test(rfcCliente)) faltan.push('cliente.rfc (formato inválido)');
    if (!cliente?.regimenFiscal) faltan.push('cliente.regimenFiscal');
    else if (!esClaveValida('regimenFiscal', cliente.regimenFiscal)) {
      faltan.push('cliente.regimenFiscal (clave no válida)');
    }
    if (!cliente?.codigoPostal) faltan.push('cliente.codigoPostal');
    else if (!CP_REGEX.test(cliente.codigoPostal)) {
      faltan.push('cliente.codigoPostal (formato inválido)');
    }

    if (!servicio.cpOrigen || !CP_REGEX.test(servicio.cpOrigen)) {
      faltan.push('servicio.cpOrigen');
    }
    if (!servicio.cpDestino || !CP_REGEX.test(servicio.cpDestino)) {
      faltan.push('servicio.cpDestino');
    }
    if (!servicio.km || servicio.km <= 0) faltan.push('servicio.km (distancia recorrida)');
    if (Number(servicio.pesoBrutoTotal) <= 0) faltan.push('servicio.pesoBrutoTotal');
    if (!servicio.claveProdServCP) faltan.push('servicio.claveProdServCP');
    else if (!esClaveValida('claveProdServCP', servicio.claveProdServCP)) {
      faltan.push('servicio.claveProdServCP (clave no válida)');
    }
    if (!esClaveValida('claveUnidad', servicio.unidadPeso)) {
      faltan.push('servicio.unidadPeso (clave no válida)');
    }

    const vehiculo = servicio.vehiculo;
    if (!vehiculo) faltan.push('servicio.unidad (sin vehículo asignado)');
    else {
      if (!vehiculo.configVehicular) faltan.push('unidad.configVehicular');
      else if (!esClaveValida('configAutotransporte', vehiculo.configVehicular)) {
        faltan.push('unidad.configVehicular (clave no válida)');
      }
      if (!vehiculo.permisoSct) faltan.push('unidad.permisoSct');
      else if (!esClaveValida('tipoPermiso', vehiculo.permisoSct)) {
        faltan.push('unidad.permisoSct (clave no válida)');
      }
      if (!vehiculo.numPermisoSct) faltan.push('unidad.numPermisoSct');
      if (!vehiculo.anio) faltan.push('unidad.anio (modelo)');
      if (!vehiculo.aseguradoraCivil) faltan.push('unidad.aseguradoraCivil');
      if (!vehiculo.polizaCivil) faltan.push('unidad.polizaCivil');

      const placa = vehiculo.placa?.replace(/[\s-]/g, '').toUpperCase() ?? '';
      if (!PLACA_REGEX.test(placa)) faltan.push('unidad.placa (formato inválido)');
    }

    const operador = servicio.conductor;
    if (!operador) faltan.push('servicio.operador (sin conductor asignado)');
    else {
      const rfcOperador = this.descifrar(operador.rfcEncrypted);
      if (!rfcOperador) faltan.push('operador.rfc');
      else if (!RFC_REGEX.test(rfcOperador)) faltan.push('operador.rfc (formato inválido)');
      if (!operador.licenciaNumero) faltan.push('operador.licencia');
    }

    if (!this.sellado.disponible) faltan.push('CSD no configurado en el servidor');

    return faltan;
  }

  private armarDatos(servicio: Servicio, carta: CartaPorte): DatosCartaPorte {
    const vehiculo = servicio.vehiculo!;
    const operador = servicio.conductor!;
    const cliente = servicio.cliente;

    const rfcEmisor =
      this.config.get<string>('SAT_EMISOR_RFC') || this.sellado.rfcEmisor;

    return {
      serie: carta.serie,
      folio: carta.folio,
      fecha: this.fechaCfdi(new Date()),
      lugarExpedicion: this.config.get<string>('SAT_EMISOR_CP', '00000'),
      noCertificado: this.sellado.noCertificado,
      certificado: this.sellado.certificado,
      idCCP: carta.idCCP,
      totalDistanciaRecorrida: servicio.km,
      emisor: {
        rfc: rfcEmisor,
        nombre: this.config.get<string>('SAT_EMISOR_NOMBRE', 'ADL TRANSPORTES'),
        regimenFiscal: this.config.get<string>('SAT_EMISOR_REGIMEN', '601'),
        codigoPostal: this.config.get<string>('SAT_EMISOR_CP', '00000'),
      },
      receptor: {
        rfc: this.descifrar(cliente.rfcEncrypted) || RFC_GENERICO,
        nombre: cliente.nombre,
        regimenFiscal: cliente.regimenFiscal!,
        codigoPostal: cliente.codigoPostal!,
      },
      ubicaciones: [
        {
          tipo: 'Origen',
          idUbicacion: `OR${carta.folio.padStart(6, '0')}`,
          rfcRemitenteDestinatario: rfcEmisor,
          nombreRemitenteDestinatario: this.config.get<string>(
            'SAT_EMISOR_NOMBRE',
            'ADL TRANSPORTES',
          ),
          fechaHora: this.fechaCfdi(servicio.citaCarga),
          codigoPostal: servicio.cpOrigen!,
        },
        {
          tipo: 'Destino',
          idUbicacion: `DE${carta.folio.padStart(6, '0')}`,
          rfcRemitenteDestinatario: this.descifrar(cliente.rfcEncrypted) || RFC_GENERICO,
          nombreRemitenteDestinatario: cliente.nombre,
          fechaHora: this.fechaCfdi(servicio.citaDescarga),
          codigoPostal: servicio.cpDestino!,
          distanciaRecorrida: servicio.km,
        },
      ],
      mercancia: {
        claveProdServ: servicio.claveProdServCP!,
        descripcion: servicio.tipoMercancia?.nombre ?? 'Carga general',
        cantidad: 1,
        claveUnidad: servicio.unidadPeso,
        pesoEnKg: Number(servicio.pesoBrutoTotal),
        contenedores: [servicio.contenedor1, servicio.contenedor2].filter(Boolean),
      },
      autotransporte: {
        permSCT: vehiculo.permisoSct!,
        numPermisoSCT: vehiculo.numPermisoSct!,
        configVehicular: vehiculo.configVehicular!,
        placaVM: vehiculo.placa.replace(/[\s-]/g, '').toUpperCase(),
        anioModeloVM: vehiculo.anio!,
        aseguraRespCivil: vehiculo.aseguradoraCivil!,
        polizaRespCivil: vehiculo.polizaCivil!,
      },
      figura: {
        tipoFigura: '01', // 01 = Operador
        rfcFigura: this.descifrar(operador.rfcEncrypted),
        nombreFigura: operador.nombreCompleto,
        numLicencia: operador.licenciaNumero!,
      },
    };
  }

  /**
   * Formato de fecha del CFDI: `AAAA-MM-DDThh:mm:ss`, sin zona horaria y en
   * hora local del emisor. Convertir a UTC desplazaría la hora declarada.
   */
  private fechaCfdi(fecha: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return (
      `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}` +
      `T${p(fecha.getHours())}:${p(fecha.getMinutes())}:${p(fecha.getSeconds())}`
    );
  }

  private descifrar(valor: string | null | undefined): string {
    if (!valor) return '';
    try {
      return this.encryption.decrypt(valor);
    } catch {
      logger.warn('Dato cifrado ilegible al emitir carta porte', 'CartaPorteService');
      return '';
    }
  }

  private async exigirServicio(id: string): Promise<Servicio> {
    const servicio = await this.servicios.findOne({ where: { id } });
    if (!servicio) throw new NotFoundException('Servicio no encontrado');
    return servicio;
  }

  presentar(c: CartaPorte) {
    return {
      id: c.id,
      servicioId: c.servicio?.id,
      folio: c.folio,
      serie: c.serie,
      estado: c.estado,
      idCCP: c.idCCP,
      uuidFiscal: c.uuidFiscal,
      fechaTimbrado: c.fechaTimbrado?.toISOString() ?? null,
      noCertificado: c.noCertificado,
      pac: c.pacNombre,
      // El timbre simulado se marca para que nadie lo confunda con uno real.
      simulado: c.uuidFiscal?.startsWith('5IMU1AD0') ?? false,
      ultimoError: c.ultimoError,
      motivoCancelacion: c.motivoCancelacion,
      fechaCancelacion: c.fechaCancelacion?.toISOString() ?? null,
    };
  }
}
