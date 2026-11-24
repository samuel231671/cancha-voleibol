// Sistemas de juego, alineación inicial y orden de rotación.
//
// Coordenadas de la pizarra (metros), vistas desde el equipo receptor mirando a la red:
//   x: 0 = banda izquierda … 9 = banda derecha
//   y: 0 = red … 9 = línea de fondo propia (negativo = campo rival)
// Zonas: delanteras 4 · 3 · 2 (izquierda → derecha), zagueras 5 · 6 · 1.

export const ZONAS = [1, 2, 3, 4, 5, 6];
export const DELANTERAS = [4, 3, 2];
export const ZAGUERAS = [5, 6, 1];
export const esDelantera = (z) => z === 2 || z === 3 || z === 4;
export const fila = (z) => (esDelantera(z) ? 'delantero' : 'zaguero');

/** Datos de cada jugador (la identidad no cambia durante la jugada). */
export const JUGADORES = {
  COL:  { tipo: 'colocador', nombre: 'Colocador' },
  COL1: { tipo: 'colocador', nombre: 'Colocador 1' },
  COL2: { tipo: 'colocador', nombre: 'Colocador 2' },
  OP:   { tipo: 'opuesto',   nombre: 'Opuesto' },
  R1:   { tipo: 'punta',     nombre: 'Punta receptor 1' },
  R2:   { tipo: 'punta',     nombre: 'Punta receptor 2' },
  C1:   { tipo: 'central',   nombre: 'Central 1' },
  C2:   { tipo: 'central',   nombre: 'Central 2' },
  L:    { tipo: 'libero',    nombre: 'Líbero' },
};

/** Alineación inicial (Rotación 1) por zona y regla de quién coloca. */
export const SISTEMAS = {
  '5-1': {
    id: '5-1',
    alineacion: { 1: 'COL', 2: 'R1', 3: 'C1', 4: 'OP', 5: 'R2', 6: 'C2' },
    colocadores: ['COL'],
    descripcion: 'Un solo colocador (COL) coloca en las seis rotaciones.',
  },
  '6-2': {
    id: '6-2',
    alineacion: { 1: 'COL1', 2: 'R1', 3: 'C1', 4: 'COL2', 5: 'R2', 6: 'C2' },
    colocadores: ['COL1', 'COL2'],
    descripcion: 'Coloca el colocador zaguero; el delantero ataca por derecha: tres atacantes en la red.',
  },
  '4-2': {
    id: '4-2',
    alineacion: { 1: 'COL1', 2: 'R1', 3: 'C1', 4: 'COL2', 5: 'R2', 6: 'C2' },
    colocadores: ['COL1', 'COL2'],
    descripcion: 'Coloca el colocador delantero; el zaguero queda en apoyo.',
  },
};

/** Zona después de k rotaciones: 2→1, 1→6, 6→5, 5→4, 4→3, 3→2. */
export function zonaTrasRotar(zona, k) {
  return (((zona - 1 - k) % 6) + 6) % 6 + 1;
}

/**
 * Orden de planilla de una rotación (1…6).
 * @returns {{ porZona: Record<number,string>, porJugador: Record<string,number> }}
 */
export function ordenRotacion(sistema, rotacion) {
  const { alineacion } = SISTEMAS[sistema];
  const porZona = {}, porJugador = {};
  for (const z of ZONAS) {
    const id = alineacion[z];
    const nz = zonaTrasRotar(z, rotacion - 1);
    porZona[nz] = id;
    porJugador[id] = nz;
  }
  return { porZona, porJugador };
}

/** Quién coloca en esta rotación según el sistema. */
export function colocadorActivo(sistema, porJugador) {
  if (sistema === '5-1') return 'COL';
  const [a, b] = SISTEMAS[sistema].colocadores;
  const aZaguero = !esDelantera(porJugador[a]);
  if (sistema === '6-2') return aZaguero ? a : b;   // coloca el zaguero
  return aZaguero ? b : a;                          // 4-2: coloca el delantero
}

/** El otro colocador (6-2 y 4-2) o el opuesto (5-1). */
export function opuestoDe(sistema, colocador) {
  if (sistema === '5-1') return 'OP';
  return colocador === 'COL1' ? 'COL2' : 'COL1';
}

/** Central zaguero: el líbero ocupa su lugar en la recepción. */
export function centralZaguero(porJugador) {
  return ['C1', 'C2'].find((c) => !esDelantera(porJugador[c]));
}

/** Título de la escena: “Rotación 1 · COL en zona 1”. */
export function tituloRotacion(sistema, rotacion) {
  const { porJugador } = ordenRotacion(sistema, rotacion);
  const ref = SISTEMAS[sistema].colocadores[0];
  return `Rotación ${rotacion} · ${ref} en zona ${porJugador[ref]}`;
}
