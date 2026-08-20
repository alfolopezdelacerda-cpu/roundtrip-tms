import { NodoXml } from './nodo-xml';
import { CLAVE_PROD_SERV_TRASLADO } from '../sat-catalogos';

/**
 * Construcción del CFDI 4.0 de traslado con Complemento Carta Porte 3.1.
 *
 * El orden en que se agregan los atributos NO es estético: es el orden del
 * XSD, y de él sale la cadena original que se firma. Reordenar una línea
 * invalida el sello.
 *
 * Se emite como comprobante de tipo Traslado (T): el ingreso por el flete se
 * factura aparte. En traslado el total va en cero y la mercancía se declara
 * con valor cero, que es lo que corresponde cuando no hay enajenación.
 */

export type DatosEmisor = {
  rfc: string;
  nombre: string;
  regimenFiscal: string;
  codigoPostal: string;
  /** Permiso SCT del emisor cuando transporta con flota propia. */
  permisoSct?: string;
  numPermisoSct?: string;
};

export type DatosReceptor = {
  rfc: string;
  nombre: string;
  regimenFiscal: string;
  codigoPostal: string;
};

export type DatosUbicacion = {
  tipo: 'Origen' | 'Destino';
  idUbicacion: string;
  rfcRemitenteDestinatario: string;
  nombreRemitenteDestinatario: string;
  fechaHora: string; // ISO local sin zona
  codigoPostal: string;
  /** Solo en destino: horas estimadas de traslado. */
  distanciaRecorrida?: number;
};

export type DatosMercancia = {
  claveProdServ: string;
  descripcion: string;
  cantidad: number;
  claveUnidad: string;
  pesoEnKg: number;
  /** Contenedores asociados, si el traslado es contenerizado. */
  contenedores: string[];
};

export type DatosAutotransporte = {
  permSCT: string;
  numPermisoSCT: string;
  configVehicular: string;
  placaVM: string;
  anioModeloVM: number;
  aseguraRespCivil: string;
  polizaRespCivil: string;
};

export type DatosFigura = {
  tipoFigura: string;
  rfcFigura: string;
  nombreFigura: string;
  numLicencia: string;
};

export type DatosCartaPorte = {
  serie: string;
  folio: string;
  fecha: string; // ISO local sin zona, hora del emisor
  lugarExpedicion: string;
  noCertificado: string;
  certificado: string;
  idCCP: string;
  totalDistanciaRecorrida: number;
  emisor: DatosEmisor;
  receptor: DatosReceptor;
  ubicaciones: DatosUbicacion[];
  mercancia: DatosMercancia;
  autotransporte: DatosAutotransporte;
  figura: DatosFigura;
};

const NS_CFDI = 'http://www.sat.gob.mx/cfd/4';
const NS_CCP = 'http://www.sat.gob.mx/CartaPorte31';

export function construirComprobante(d: DatosCartaPorte): NodoXml {
  const comprobante = new NodoXml('cfdi:Comprobante', [
    ['xmlns:cfdi', NS_CFDI],
    ['xmlns:cartaporte31', NS_CCP],
    ['xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance'],
    [
      'xsi:schemaLocation',
      `${NS_CFDI} http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd ` +
        `${NS_CCP} http://www.sat.gob.mx/sitio_internet/cfd/CartaPorte/CartaPorte31.xsd`,
    ],
    ['Version', '4.0'],
    ['Serie', d.serie],
    ['Folio', d.folio],
    ['Fecha', d.fecha],
    // El sello se inserta después de calcular la cadena original.
    ['NoCertificado', d.noCertificado],
    ['Certificado', d.certificado],
    ['SubTotal', '0'],
    ['Moneda', 'XXX'], // XXX: sin valor monetario, obligatorio en traslados
    ['Total', '0'],
    ['TipoDeComprobante', 'T'],
    ['Exportacion', '01'], // 01 = No aplica
    ['LugarExpedicion', d.lugarExpedicion],
  ]);

  // ---- Emisor / Receptor ----
  comprobante.hijo(
    new NodoXml('cfdi:Emisor', [
      ['Rfc', d.emisor.rfc],
      ['Nombre', d.emisor.nombre],
      ['RegimenFiscal', d.emisor.regimenFiscal],
    ]),
  );

  comprobante.hijo(
    new NodoXml('cfdi:Receptor', [
      ['Rfc', d.receptor.rfc],
      ['Nombre', d.receptor.nombre],
      ['DomicilioFiscalReceptor', d.receptor.codigoPostal],
      ['RegimenFiscalReceptor', d.receptor.regimenFiscal],
      ['UsoCFDI', 'S01'], // S01 = Sin efectos fiscales, el que aplica a traslados
    ]),
  );

  // ---- Concepto: el traslado en sí ----
  const conceptos = new NodoXml('cfdi:Conceptos');
  conceptos.hijo(
    new NodoXml('cfdi:Concepto', [
      ['ClaveProdServ', CLAVE_PROD_SERV_TRASLADO],
      ['Cantidad', '1'],
      ['ClaveUnidad', 'E48'],
      ['Descripcion', 'Servicio de transporte de carga por carretera'],
      ['ValorUnitario', '0'],
      ['Importe', '0'],
      ['ObjetoImp', '01'], // 01 = No objeto de impuesto
    ]),
  );
  comprobante.hijo(conceptos);

  // ---- Complemento Carta Porte ----
  const complemento = new NodoXml('cfdi:Complemento');
  complemento.hijo(construirCartaPorte(d));
  comprobante.hijo(complemento);

  return comprobante;
}

function construirCartaPorte(d: DatosCartaPorte): NodoXml {
  const ccp = new NodoXml('cartaporte31:CartaPorte', [
    ['Version', '3.1'],
    ['IdCCP', d.idCCP],
    ['TranspInternac', 'No'],
    ['TotalDistRec', d.totalDistanciaRecorrida.toFixed(2)],
  ]);

  // ---- Ubicaciones ----
  const ubicaciones = new NodoXml('cartaporte31:Ubicaciones');
  for (const u of d.ubicaciones) {
    const nodo = new NodoXml('cartaporte31:Ubicacion', [
      ['TipoUbicacion', u.tipo],
      ['IDUbicacion', u.idUbicacion],
      ['RFCRemitenteDestinatario', u.rfcRemitenteDestinatario],
      ['NombreRemitenteDestinatario', u.nombreRemitenteDestinatario],
      // Mismo atributo en ambos casos: es la salida en origen y la llegada
      // en destino.
      ['FechaHoraSalidaLlegada', u.fechaHora],
      // DistanciaRecorrida solo aplica al destino; en origen viene vacía y el
      // nodo la omite.
      ['DistanciaRecorrida', u.distanciaRecorrida?.toFixed(2)],
    ]);

    nodo.hijo(
      new NodoXml('cartaporte31:Domicilio', [
        ['Estado', 'MEX'],
        ['Pais', 'MEX'],
        ['CodigoPostal', u.codigoPostal],
      ]),
    );

    ubicaciones.hijo(nodo);
  }
  ccp.hijo(ubicaciones);

  // ---- Mercancías ----
  const m = d.mercancia;
  const mercancias = new NodoXml('cartaporte31:Mercancias', [
    ['PesoBrutoTotal', m.pesoEnKg.toFixed(3)],
    ['UnidadPeso', 'KGM'],
    ['NumTotalMercancias', '1'],
  ]);

  const mercancia = new NodoXml('cartaporte31:Mercancia', [
    ['BienesTransp', m.claveProdServ],
    ['Descripcion', m.descripcion],
    ['Cantidad', m.cantidad.toFixed(2)],
    ['ClaveUnidad', m.claveUnidad],
    ['PesoEnKg', m.pesoEnKg.toFixed(3)],
    ['ValorMercancia', '0'],
    ['Moneda', 'XXX'],
  ]);

  // Cada contenedor va como detalle de la mercancía trasladada.
  for (const contenedor of m.contenedores.filter(Boolean)) {
    mercancia.hijo(
      new NodoXml('cartaporte31:DetalleMercancia', [
        ['UnidadPesoMerc', 'KGM'],
        ['PesoBruto', m.pesoEnKg.toFixed(3)],
        ['PesoNeto', m.pesoEnKg.toFixed(3)],
        ['PesoTara', '0.000'],
        ['NumPiezas', '1'],
        // El número de contenedor viaja aquí para que quede en el comprobante.
        ['DescripcionContenedor', contenedor],
      ]),
    );
  }

  mercancias.hijo(mercancia);

  const a = d.autotransporte;
  const autotransporte = new NodoXml('cartaporte31:Autotransporte', [
    ['PermSCT', a.permSCT],
    ['NumPermisoSCT', a.numPermisoSCT],
  ]);

  autotransporte.hijo(
    new NodoXml('cartaporte31:IdentificacionVehicular', [
      ['ConfigVehicular', a.configVehicular],
      ['PesoBrutoVehicular', '0'],
      ['PlacaVM', a.placaVM],
      ['AnioModeloVM', String(a.anioModeloVM)],
    ]),
  );

  autotransporte.hijo(
    new NodoXml('cartaporte31:Seguros', [
      ['AseguraRespCivil', a.aseguraRespCivil],
      ['PolizaRespCivil', a.polizaRespCivil],
    ]),
  );

  mercancias.hijo(autotransporte);
  ccp.hijo(mercancias);

  // ---- Figura de transporte ----
  const figuras = new NodoXml('cartaporte31:FiguraTransporte');
  figuras.hijo(
    new NodoXml('cartaporte31:TiposFigura', [
      ['TipoFigura', d.figura.tipoFigura],
      ['RFCFigura', d.figura.rfcFigura],
      ['NombreFigura', d.figura.nombreFigura],
      ['NumLicencia', d.figura.numLicencia],
    ]),
  );
  ccp.hijo(figuras);

  return ccp;
}

/**
 * Inserta el sello en el comprobante ya construido.
 *
 * Va después de calcular la cadena original porque el propio atributo `Sello`
 * queda fuera de ella: firmar incluyendo la firma sería circular. Se coloca
 * en la posición que marca el XSD, justo después de `Fecha`.
 */
export function insertarSello(comprobante: NodoXml, sello: string): NodoXml {
  const indiceFecha = comprobante.atributos.findIndex(([k]) => k === 'Fecha');
  comprobante.atributos.splice(indiceFecha + 1, 0, ['Sello', sello]);
  return comprobante;
}

export const CABECERA_XML = '<?xml version="1.0" encoding="UTF-8"?>';
