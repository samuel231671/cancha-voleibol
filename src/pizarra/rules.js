// Regla FIVB 7.4: posiciones del equipo receptor en el golpe de saque.
// Referencia: el punto de apoyo (pies en el suelo) de cada jugador.
//  - Cada delantero debe estar más cerca de la red que su zaguero: pares 4–5, 3–6, 2–1.
//  - Dentro de cada fila: 4 a la izquierda de 3 y 3 a la izquierda de 2;
//    5 a la izquierda de 6 y 6 a la izquierda de 1.
// Un jugador no tiene que estar dentro del rectángulo de su zona.

/** Margen mínimo (m) para que la legalidad sea evidente en la pizarra. */
export const MARGEN_EVIDENTE = 0.5;

const RELACIONES = [
  { tipo: 'delante', a: 4, b: 5, texto: '4 delante de 5' },
  { tipo: 'delante', a: 3, b: 6, texto: '3 delante de 6' },
  { tipo: 'delante', a: 2, b: 1, texto: '2 delante de 1' },
  { tipo: 'izquierda', a: 4, b: 3, texto: '4 a la izquierda de 3' },
  { tipo: 'izquierda', a: 3, b: 2, texto: '3 a la izquierda de 2' },
  { tipo: 'izquierda', a: 5, b: 6, texto: '5 a la izquierda de 6' },
  { tipo: 'izquierda', a: 6, b: 1, texto: '6 a la izquierda de 1' },
];

/**
 * @param {Record<number, [number, number]>} pos punto de apoyo por zona de rotación
 * @returns {{ legal: boolean, evidente: boolean, margenMinimo: number, comprobaciones: object[] }}
 */
export function validarOrden(pos, margen = MARGEN_EVIDENTE) {
  const comprobaciones = RELACIONES.map((r) => {
    const [ax, ay] = pos[r.a], [bx, by] = pos[r.b];
    // "delante": más cerca de la red (y menor). "izquierda": x menor.
    const diferencia = r.tipo === 'delante' ? by - ay : bx - ax;
    return { ...r, diferencia, legal: diferencia > 0, evidente: diferencia >= margen };
  });
  return {
    legal: comprobaciones.every((c) => c.legal),
    evidente: comprobaciones.every((c) => c.evidente),
    margenMinimo: Math.min(...comprobaciones.map((c) => c.diferencia)),
    comprobaciones,
  };
}
