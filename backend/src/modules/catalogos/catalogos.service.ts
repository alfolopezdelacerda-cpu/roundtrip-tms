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
    const repo = this.repositorio(tipo);
    const registro = repo.create(this.aPersistencia(tipo, datos));
    const guardado = await repo.save(registro);
    logger.audit({ tipo: 'catalogo_creado', catalogo: tipo, id: guardado.id });
    return this.presentar(tipo, guardado);
  }

  async actualizar(tipo: TipoCatalogo, id: string, datos: Record<string, unknown>) {
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
    return this.servicios
      .createQueryBuilder('s')
      .where(`s.${this.columnaEnServicio(tipo)} = :id`, { id })
      .getCount();
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
}
