/**
 * Árbol XML mínimo, con atributos ORDENADOS.
 *
 * El orden importa de verdad: la cadena original del CFDI es la secuencia de
 * valores de atributos en el orden que marca el XSD, y de este mismo árbol
 * salen tanto el XML como la cadena. Usar un objeto plano no serviría —el
 * orden de sus llaves no es contrato— así que los atributos van como pares.
 *
 * Los atributos con valor vacío o nulo se omiten: el SAT exige que un atributo
 * opcional sin valor no aparezca, ni en el XML ni en la cadena original.
 */

export type Atributo = [nombre: string, valor: string | number | null | undefined];

export class NodoXml {
  readonly atributos: Array<[string, string]> = [];
  readonly hijos: NodoXml[] = [];

  constructor(
    readonly nombre: string,
    atributos: Atributo[] = [],
  ) {
    for (const [clave, valor] of atributos) this.atributo(clave, valor);
  }

  atributo(nombre: string, valor: string | number | null | undefined): this {
    if (valor === null || valor === undefined) return this;
    const texto = String(valor);
    if (texto.trim() === '') return this;
    this.atributos.push([nombre, texto]);
    return this;
  }

  hijo(nodo: NodoXml): this {
    this.hijos.push(nodo);
    return this;
  }

  /** Agrega el nodo solo si tiene contenido; evita elementos vacíos inválidos. */
  hijoSiTiene(nodo: NodoXml): this {
    if (nodo.atributos.length || nodo.hijos.length) this.hijos.push(nodo);
    return this;
  }

  toXml(indentacion = ''): string {
    const atributos = this.atributos
      .map(([k, v]) => ` ${k}="${escaparAtributo(v)}"`)
      .join('');

    if (!this.hijos.length) {
      return `${indentacion}<${this.nombre}${atributos}/>`;
    }

    const interior = this.hijos
      .map((h) => h.toXml(`${indentacion}  `))
      .join('\n');
    return `${indentacion}<${this.nombre}${atributos}>\n${interior}\n${indentacion}</${this.nombre}>`;
  }

  /** Recorre el árbol en orden de documento acumulando nombre y valor. */
  atributosEnOrden(): Array<[string, string]> {
    const pares: Array<[string, string]> = [...this.atributos];
    for (const hijo of this.hijos) pares.push(...hijo.atributosEnOrden());
    return pares;
  }
}

/**
 * Escapado de atributos XML. `&` primero: si no, se re-escaparían las
 * entidades que se acaban de introducir.
 */
export function escaparAtributo(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
