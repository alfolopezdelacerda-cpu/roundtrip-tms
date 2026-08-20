import { NodoXml } from './nodo-xml';

/**
 * Cadena original del CFDI: `||valor|valor|…||`.
 *
 * La regla del SAT (Anexo 20) es tomar los valores de los atributos del
 * comprobante en el orden del XSD, omitir los vacíos, y separarlos por `|`
 * entre delimitadores dobles. Como el árbol ya se construye en orden de XSD,
 * recorrerlo en orden de documento produce esa secuencia.
 *
 * ADVERTENCIA: la implementación oficial es la transformación XSLT que publica
 * el SAT (`cadenaoriginal_4_0.xslt` más el del complemento). Esta versión
 * reproduce la misma regla sin depender de esos archivos, pero antes de
 * producción debe contrastarse contra el XSLT oficial con comprobantes reales:
 * si difieren en un solo carácter, el sello no valida y el PAC rechaza.
 */
export function construirCadenaOriginal(comprobante: NodoXml): string {
  const valores = comprobante
    .atributosEnOrden()
    .filter(([nombre]) => !esDeclaracionDeEsquema(nombre))
    .map(([, valor]) => normalizar(valor))
    .filter((v) => v !== '');

  return `||${valores.join('|')}||`;
}

/**
 * Las declaraciones de espacio de nombres y la ubicación del esquema no son
 * datos del comprobante: son andamiaje del XML. El Anexo 20 las deja fuera de
 * la cadena original, y meterlas produce un sello que el SAT no valida.
 */
function esDeclaracionDeEsquema(nombre: string): boolean {
  return nombre === 'xmlns' || nombre.startsWith('xmlns:') || nombre.startsWith('xsi:');
}

/**
 * Normalización del Anexo 20: sin saltos de línea ni tabuladores, espacios
 * internos colapsados a uno y recortado en los extremos.
 */
function normalizar(valor: string): string {
  return valor.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}
