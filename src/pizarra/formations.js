// Formaciones tácticas de recepción (variante didáctica: recepción de tres con R1, R2 y L).
//
// En los tres sistemas el orden relativo de la planilla es el mismo a partir del
// colocador activo: COL · punta · central · opuesto · punta · central. Por eso cada
// formación se define según la ZONA DEL COLOCADOR ACTIVO (1, 6, 5, 4, 3 o 2):
//   5-1: Rotación 1…6 → colocador en 1, 6, 5, 4, 3, 2
//   6-2: coloca el zaguero → 1, 6, 5, 1, 6, 5 (el otro colocador ataca por derecha)
//   4-2: coloca el delantero → 4, 3, 2, 4, 3, 2 (el otro colocador queda en apoyo)
//
// Los datos están separados en tres tablas para poder adaptarlos más adelante a las
// formaciones del entrenador de La Fortuna:
//   FORMACIONES  → punto de apoyo (pies) de cada zona en el instante del saque
//   CARRILES     → qué zona recibe por izquierda, centro y derecha
//   TRANSICIONES → función de ataque de cada delantero, apoyos y ruta del colocador
// Para cambiar solo una rotación de un sistema, usa AJUSTES (más abajo).

/** Objetivo del primer pase: cerca de la red, entre zonas 2 y 3. */
export const OBJETIVO_PASE = [6.0, 0.9];

/** Punto donde el receptor juega el balón según el destino del saque. */
export const PUNTOS_RECEPCION = {
  izquierda: [1.7, 6.1],
  centro: [4.5, 6.5],
  derecha: [7.3, 5.9],
};

/** Puntos de inicio de carrera de ataque al terminar la recepción. */
export const PUNTOS_ATAQUE = {
  izquierda: [0.6, 3.7],  // punta: se abre para tener carrera
  centro: [5.0, 3.0],     // central: entrada de primer tiempo delante del colocador
  derecha: [8.5, 3.7],    // opuesto / atacante por derecha
};

/** Posición de cada zona en el golpe de saque (punto de apoyo de los pies). */
export const FORMACIONES = {
  // Colocador en 1: espera detrás del punta delantero que baja a recibir por derecha.
  1: { 1: [8.2, 6.4], 2: [7.1, 5.3], 3: [4.4, 0.9], 4: [1.0, 1.2], 5: [1.8, 5.6], 6: [4.5, 6.1] },
  // Colocador en 6: apilado detrás del opuesto (zona 3) en la red.
  6: { 6: [5.4, 2.6], 1: [7.4, 6.0], 2: [7.6, 0.9], 3: [5.0, 0.9], 4: [1.6, 5.2], 5: [4.0, 6.6] },
  // Colocador en 5: apilado detrás del central (zona 4) a la izquierda.
  5: { 5: [1.3, 2.6], 6: [4.6, 6.4], 1: [7.3, 6.0], 2: [8.2, 1.0], 3: [2.4, 5.0], 4: [0.7, 0.9] },
  // Colocador delantero en 4: recorre la red de izquierda a derecha.
  4: { 4: [0.9, 0.8], 5: [1.8, 5.8], 6: [4.5, 6.3], 1: [8.3, 6.7], 2: [7.1, 5.3], 3: [4.7, 2.2] },
  // Colocador delantero en 3: ya está en la red, solo ajusta.
  3: { 3: [5.2, 0.8], 4: [1.6, 5.2], 5: [3.9, 6.6], 6: [6.0, 8.3], 1: [7.5, 6.0], 2: [8.0, 1.0] },
  // Colocador delantero en 2: ajuste corto hacia el centro.
  2: { 2: [7.7, 0.8], 3: [2.0, 5.0], 4: [0.8, 1.0], 5: [0.9, 8.0], 6: [4.6, 6.4], 1: [7.3, 6.1] },
};

/** Zona responsable de cada carril de recepción. */
export const CARRILES = {
  1: { izquierda: 5, centro: 6, derecha: 2 },
  6: { izquierda: 4, centro: 5, derecha: 1 },
  5: { izquierda: 3, centro: 6, derecha: 1 },
  4: { izquierda: 5, centro: 6, derecha: 2 },
  3: { izquierda: 4, centro: 5, derecha: 1 },
  2: { izquierda: 3, centro: 6, derecha: 1 },
};

/**
 * Rutas de transición tras el golpe de saque.
 *  ataque:   carril de ataque de cada delantero que no coloca
 *  apoyo:    destino del zaguero que no recibe ni coloca
 *  via:      puntos de paso del colocador hasta la zona de colocación
 *  retraso:  segundos tras el saque antes de salir (ritmos distintos, sin cruces)
 *  rutas:    puntos de paso para entradas de ataque concretas
 */
export const TRANSICIONES = {
  1: { ataque: { 4: 'izquierda', 3: 'centro', 2: 'derecha' }, via: [[8.6, 3.3]], retraso: { 3: 0.15, 4: 0.35 } },
  6: { ataque: { 4: 'izquierda', 2: 'centro', 3: 'derecha' }, via: [], retraso: { 2: 0.15, 3: 0.6 }, rutas: { 2: [[7.2, 2.7]], 3: [[6.2, 0.45], [7.6, 1.0]] } },
  5: { ataque: { 3: 'izquierda', 4: 'centro', 2: 'derecha' }, via: [[2.6, 1.5]], retraso: { 4: 0.6, 2: 0.4 }, rutas: { 4: [[2.4, 2.9]] } },
  4: { ataque: { 3: 'centro', 2: 'derecha' }, apoyo: { 1: [6.4, 5.4] }, via: [], retraso: { 3: 0.3 } },
  3: { ataque: { 4: 'izquierda', 2: 'centro' }, apoyo: { 6: [5.6, 5.6] }, via: [], retraso: { 2: 0.2 } },
  2: { ataque: { 3: 'izquierda', 4: 'centro' }, apoyo: { 5: [1.8, 5.8] }, via: [], retraso: { 4: 0.2 } },
};

/**
 * Ajustes por sistema y rotación (vacío por defecto). Ejemplo:
 *   AJUSTES['5-1'][3] = { formacion: { 5: [1.1, 2.4] }, carriles: { centro: 6 } }
 */
export const AJUSTES = { '5-1': {}, '6-2': {}, '4-2': {} };

/** Formación completa para un sistema/rotación dado el colocador activo en `zonaColocador`. */
export function formacion(sistema, rotacion, zonaColocador) {
  const ajuste = AJUSTES[sistema]?.[rotacion] ?? {};
  return {
    clave: zonaColocador,
    posiciones: { ...FORMACIONES[zonaColocador], ...(ajuste.formacion ?? {}) },
    carriles: { ...CARRILES[zonaColocador], ...(ajuste.carriles ?? {}) },
    transicion: { ...TRANSICIONES[zonaColocador], ...(ajuste.transicion ?? {}) },
  };
}
