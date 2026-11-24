// Línea de tiempo única de la jugada: sacador, balón y jugadores sincronizados.
// El instante del golpe de saque (eventos.contacto) libera los desplazamientos tácticos.
// La escena termina cuando el primer pase llega a las manos del colocador.

import {
  ordenRotacion, colocadorActivo, centralZaguero, opuestoDe, fila, esDelantera,
  JUGADORES, tituloRotacion,
} from './rotations.js';
import { formacion, OBJETIVO_PASE, PUNTOS_RECEPCION, PUNTOS_ATAQUE } from './formations.js';
import { validarOrden } from './rules.js';

// ---------- Constantes de la jugada ----------
// Sacador rival 1 m detrás de su línea de fondo. La mano de golpeo está a su derecha
// (desde la pizarra: x menor) y delante del cuerpo, a la altura que alcanza su brazo
// en un saque flotante con salto.
export const SACADOR = { cuerpo: [1.6, -10.0], mano: [1.42, -9.75] };
// Alturas del CENTRO del balón en cada contacto (medidas sobre los muñecos 3D:
// el balón apoya sobre los antebrazos del receptor y sobre las palmas del colocador).
export const ALTURAS = { manoInicial: 1.15, contacto: 2.55, recepcion: 1.04, manosColocador: 2.17, red: 2.43 };
/** Distancia entre los pies del receptor y el balón sobre su plataforma (hacia el saque). */
export const PLATAFORMA = 0.7;
/** El colocador mira a la zona 4: sus manos quedan 0,16 m por delante de sus pies. */
export const MANOS_COLOCADOR = [-0.16, 0];
const T_LANZAMIENTO = 0.6;
const T_CONTACTO = 1.7;
const VEL_SAQUE = 14.5;     // m/s, saque flotante
const DUR_PASE = 1.3;       // s, pase alto y controlado
const VEL_JUGADOR = 4.6;    // m/s
const VEL_COLOCADOR = 5.2;  // m/s
const PRE_COLOCACION = [OBJETIVO_PASE[0] + 0.25, OBJETIVO_PASE[1] + 0.45];

const TXT_CARRIL = { izquierda: 'la izquierda', centro: 'el centro', derecha: 'la derecha' };
const TXT_ATAQUE = { izquierda: 'izquierda', centro: 'el centro (primer tiempo)', derecha: 'derecha' };
const ESPERA_COLOCADOR = {
  1: 'detrás del punta que baja a recibir por la derecha',
  6: 'apilado detrás del delantero de zona 3',
  5: 'apilado detrás del central de zona 4',
  4: 'pegado a la red en la zona 4',
  3: 'pegado a la red en el centro',
  2: 'pegado a la red a la derecha',
};

// ---------- Utilidades ----------
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
const suave = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
const largo = (pts) => pts.slice(1).reduce((s, p, i) => s + dist(pts[i], p), 0);

function puntoEnRuta(pts, u) {
  const total = largo(pts);
  if (total === 0) return pts[0];
  let d = u * total;
  for (let i = 1; i < pts.length; i++) {
    const l = dist(pts[i - 1], pts[i]);
    if (d <= l) return lerp(pts[i - 1], pts[i], l ? d / l : 0);
    d -= l;
  }
  return pts[pts.length - 1];
}

/** Posición de un jugador en el instante t. */
export function posicionEn(j, t) {
  let p = j.inicio;
  for (const s of j.segmentos) {
    if (t >= s.t1) { p = s.puntos[s.puntos.length - 1]; continue; }
    if (t > s.t0) p = puntoEnRuta(s.puntos, suave((t - s.t0) / (s.t1 - s.t0)));
    break;
  }
  return p;
}

/** Función visible del jugador en el instante t (“coloca”, “recibe”, “ataca”…). */
export function funcionEn(j, t) {
  let f = j.fases[0].funcion;
  for (const fase of j.fases) if (t >= fase.t) f = fase.funcion;
  return f;
}

function mover(j, t0, puntos, vel = VEL_JUGADOR, durMin = 0.4) {
  const desde = j.segmentos.length ? j.segmentos.at(-1).puntos.at(-1) : j.inicio;
  const pts = [desde, ...puntos];
  const t1 = t0 + Math.max(durMin, largo(pts) / vel);
  j.segmentos.push({ t0, t1, puntos: pts });
  return t1;
}

// ---------- Construcción de la escena ----------
/**
 * @param {{ sistema: '5-1'|'6-2'|'4-2', rotacion: number, destino: 'izquierda'|'centro'|'derecha' }} opciones
 */
export function construirJugada({ sistema, rotacion, destino }) {
  const orden = ordenRotacion(sistema, rotacion);
  const colocador = colocadorActivo(sistema, orden.porJugador);
  const zCol = orden.porJugador[colocador];
  const f = formacion(sistema, rotacion, zCol);
  const central = centralZaguero(orden.porJugador);
  const zRecibe = f.carriles[destino];
  const pRec = PUNTOS_RECEPCION[destino];            // pies del receptor
  const mano = SACADOR.mano;
  // El balón llega a la plataforma de antebrazos, delante del receptor y hacia el saque
  const haciaSaque = [mano[0] - pRec[0], mano[1] - pRec[1]];
  const nh = Math.hypot(...haciaSaque);
  const pContacto = [pRec[0] + (haciaSaque[0] / nh) * PLATAFORMA, pRec[1] + (haciaSaque[1] / nh) * PLATAFORMA];

  // Tiempos (una sola línea de tiempo)
  const tC = T_CONTACTO;
  const tR = tC + dist(mano, pContacto) / VEL_SAQUE;
  const tS = tR + DUR_PASE;
  const pManos = [OBJETIVO_PASE[0] + MANOS_COLOCADOR[0], OBJETIVO_PASE[1] + MANOS_COLOCADOR[1]];
  const uRed = (0 - mano[1]) / (pContacto[1] - mano[1]);
  const eventos = {
    lanzamiento: T_LANZAMIENTO, contacto: tC, red: tC + uRed * (tR - tC),
    recepcion: tR, colocacion: tS, fin: tS + 0.9,
  };

  const jugadores = [];
  for (const z of [4, 3, 2, 5, 6, 1]) {
    const titular = orden.porZona[z];
    const esLibero = titular === central;
    const id = esLibero ? 'L' : titular;
    const tipo = esLibero ? 'libero' : JUGADORES[titular].tipo;
    const carril = Object.keys(f.carriles).find((k) => f.carriles[k] === z) ?? null;
    const ataque = f.transicion.ataque?.[z] ?? null;
    const retraso = f.transicion.retraso?.[z] ?? 0.25;
    const j = {
      id, titular, tipo, zona: z, fila: fila(z),
      reemplaza: esLibero ? titular : null,
      inicio: f.posiciones[z],
      segmentos: [], fases: [],
      esColocador: id === colocador,
      esReceptor: z === zRecibe,
      carril, ataque,
    };
    const quien = esLibero ? `L (entra por ${titular})` : id;
    let frase = `${quien} empieza en la zona ${z} (${j.fila})`;

    if (j.esColocador) {
      // Sale con el golpe de saque; ajusta los últimos pasos al pase.
      const via = f.transicion.via ?? [];
      mover(j, tC + 0.05, [...via, PRE_COLOCACION], VEL_COLOCADOR, 0.45);
      j.segmentos.push({ t0: tS - 0.5, t1: tS - 0.1, puntos: [PRE_COLOCACION, OBJETIVO_PASE] });
      j.fases.push({ t: 0, funcion: 'coloca' });
      frase += esDelantera(z)
        ? `. Espera ${ESPERA_COLOCADOR[zCol]} y, con el golpe de saque, se desplaza a la zona de colocación entre 2 y 3 para colocar.`
        : `. Espera ${ESPERA_COLOCADOR[zCol]} y, con el golpe de saque, entra hasta la red entre las zonas 2 y 3 para colocar; sigue siendo zaguero.`;
    } else if (j.esReceptor) {
      // Lee la trayectoria, se coloca detrás del balón y recibe.
      mover(j, tC + 0.15, [pRec], VEL_JUGADOR, 0.45);
      j.fases.push({ t: 0, funcion: 'recibe' });
      if (ataque) {
        mover(j, tR + 0.25, [PUNTOS_ATAQUE[ataque]]);
        j.fases.push({ t: tR + 0.25, funcion: 'ataca' });
        frase += `; recibe el saque por ${TXT_CARRIL[destino]} y, después de pasar al colocador, se abre para atacar por ${TXT_ATAQUE[ataque]}.`;
      } else {
        mover(j, tR + 0.35, [[pRec[0], pRec[1] - 1.0]], VEL_JUGADOR, 0.6);
        j.fases.push({ t: tR + 0.35, funcion: 'cubre' });
        frase += `; recibe el saque por ${TXT_CARRIL[destino]}, pasa al colocador y luego cubre el ataque.`;
      }
    } else if (carril) {
      // Mantiene su carril y ajusta hacia el balón; no lo abandona antes de saber quién recibe.
      const dx = Math.sign(pRec[0] - j.inicio[0]) * 0.35;
      const ajuste = [j.inicio[0] + dx, j.inicio[1] + 0.15];
      const finAjuste = mover(j, tC + 0.3, [ajuste], VEL_JUGADOR, 0.5);
      j.fases.push({ t: 0, funcion: 'cubre' });
      if (ataque) {
        const t0 = Math.max(finAjuste, eventos.red + 0.15);
        mover(j, t0, [PUNTOS_ATAQUE[ataque]]);
        j.fases.push({ t: t0, funcion: 'ataca' });
        frase += `; cubre el carril de ${TXT_CARRIL[carril]} y, cuando el balón pasa la red y ve que no le toca, se abre para atacar por ${TXT_ATAQUE[ataque]}.`;
      } else {
        mover(j, tR + 0.35, [[ajuste[0], ajuste[1] - 0.9]], VEL_JUGADOR, 0.6);
        frase += `; cubre el carril de ${TXT_CARRIL[carril]} en la recepción y ajusta su posición hacia el balón.`;
      }
    } else if (ataque) {
      // Delantero que no recibe: entrada de ataque a su propio ritmo.
      const ruta = f.transicion.rutas?.[z] ?? [];
      mover(j, tC + retraso, [...ruta, PUNTOS_ATAQUE[ataque]]);
      const funcion = ataque === 'centro' ? '1.er tiempo' : 'ataca';
      j.fases.push({ t: 0, funcion });
      frase += ataque === 'centro'
        ? '; no recibe y prepara su entrada de primer tiempo delante del colocador.'
        : `; no recibe y prepara su entrada para atacar por ${TXT_ATAQUE[ataque]}.`;
    } else {
      // Zaguero sin recepción (el otro colocador en 4-2): apoyo.
      const apoyo = f.transicion.apoyo?.[z];
      // Sale después de que el receptor despeje su carril para no cruzarse con él
      if (apoyo) mover(j, tR + 0.6, [apoyo]);
      j.fases.push({ t: 0, funcion: 'apoyo' });
      frase += '; no recibe ni coloca: queda en apoyo detrás de los atacantes.';
    }
    j.explicacion = frase;
    jugadores.push(j);
  }

  const receptor = jugadores.find((j) => j.esReceptor);

  // ---------- Balón ----------
  const H = ALTURAS;
  function balonEn(t) {
    if (t < eventos.lanzamiento) return { p: mano, h: H.manoInicial, fase: 'mano' };
    if (t < tC) {
      const u = (t - eventos.lanzamiento) / (tC - eventos.lanzamiento);
      return { p: mano, h: H.manoInicial + (H.contacto - H.manoInicial) * u + 4 * 1.7 * u * (1 - u), fase: 'lanzamiento' };
    }
    if (t < tR) {
      const u = (t - tC) / (tR - tC);
      return { p: lerp(mano, pContacto, u), h: H.contacto + (H.recepcion - H.contacto) * u + 4 * 1.7 * u * (1 - u), fase: 'saque' };
    }
    if (t < tS) {
      const u = (t - tR) / (tS - tR);
      return { p: lerp(pContacto, pManos, u), h: H.recepcion + (H.manosColocador - H.recepcion) * u + 4 * 2.6 * u * (1 - u), fase: 'pase' };
    }
    return { p: pManos, h: H.manosColocador, fase: 'colocador' };
  }

  // ---------- Sacador rival: la mano alcanza el balón justo en el contacto ----------
  function manoSacadorEn(t) {
    const cuerpo = SACADOR.cuerpo;
    if (t < eventos.lanzamiento) return { p: mano, h: H.manoInicial };
    const armado = { p: [cuerpo[0] - 0.15, cuerpo[1] - 0.35], h: 2.2 };
    const tArmado = tC - 0.32;
    if (t < tArmado) {
      const u = Math.min(1, (t - eventos.lanzamiento) / 0.4);
      return { p: lerp(mano, armado.p, u), h: H.manoInicial + (armado.h - H.manoInicial) * u };
    }
    if (t <= tC) {
      const u = suave((t - tArmado) / (tC - tArmado));
      return { p: lerp(armado.p, mano, u), h: armado.h + (H.contacto - armado.h) * u };
    }
    const u = Math.min(1, (t - tC) / 0.35);
    return { p: lerp(mano, [mano[0] + 0.1, mano[1] + 0.45], u), h: H.contacto - 1.2 * u };
  }

  function faseEn(t) {
    if (t < eventos.lanzamiento) return 'Antes del saque: formación de recepción';
    if (t < tC) return 'Lanzamiento: el equipo mantiene la formación';
    if (t < tC + 0.4) return 'Contacto de saque: empiezan los desplazamientos';
    if (t < tR) return 'Balón en vuelo: lectura y ajuste de pies';
    if (t < tR + 0.35) return `Primer toque: recibe ${receptor.id}`;
    if (t < tS) return 'Pase al colocador · preparación del ataque';
    return `Fin: el pase llegó a las manos de ${colocador}`;
  }

  return {
    sistema, rotacion, destino,
    titulo: tituloRotacion(sistema, rotacion),
    orden, colocador, opuesto: opuestoDe(sistema, colocador),
    zonaColocador: zCol,
    receptor,
    libero: { reemplaza: central, zona: orden.porJugador[central] },
    jugadores, eventos, duracion: eventos.fin,
    puntoRecepcion: pRec, contactoRecepcion: pContacto, objetivoPase: OBJETIVO_PASE, manosColocador: pManos,
    legalidad: validarOrden(f.posiciones),
    pasos: [
      { t: 0, nombre: 'Formación' },
      { t: tC, nombre: 'Contacto de saque' },
      { t: tR, nombre: 'Primer toque' },
      { t: tS, nombre: 'Pase al colocador' },
    ],
    balonEn, manoSacadorEn, faseEn,
  };
}

// ---------- Poses compartidas (2D y 3D) ----------
// Se muestrean una vez por jugada a 60 Hz. Son deterministas: pausar, repetir o mover
// la línea de tiempo siempre da el mismo cuadro en las dos vistas.
//   estado: 'espera' (rodillas flexionadas, peso adelante) · 'corre' · 'recepcion'
//           (antebrazos juntos) · 'manos' (colocador con las manos altas)
//   ang: hacia dónde mira, en radianes sobre la pizarra (atan2(dy, dx))

const angDif = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** Salto del sacador (m) en el saque flotante: máximo justo en el contacto. */
export function saltoSacadorEn(t, tContacto) {
  const u = (t - tContacto) / 0.32;
  return Math.abs(u) < 1 ? 0.5 * (1 - u * u) : 0;
}

export function muestrearPoses(e, dt = 1 / 60) {
  const { recepcion: tR, colocacion: tS, fin } = e.eventos;
  const n = Math.ceil(fin / dt) + 2;
  const muestras = new Map();
  for (const j of e.jugadores) {
    const arr = [];
    let prev = posicionEn(j, 0), ang = null, zancada = 0;
    for (let i = 0; i < n; i++) {
      const t = i * dt;
      const p = posicionEn(j, t);
      const paso = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      const vel = i ? paso / dt : 0;
      zancada += paso;

      let estado = 'espera';
      if (j.esReceptor && t >= tR - 0.45 && t <= tR + 0.15) estado = 'recepcion';
      else if (j.esColocador && t >= tS - 0.55) estado = 'manos';
      else if (vel > 0.5) estado = 'corre';

      // Hacia dónde mira: al balón (antes del saque, al sacador), a su carrera
      // cuando se desplaza, al saque cuando recibe y a la zona 4 cuando coloca.
      let obj;
      const b = e.balonEn(t).p;
      if (estado === 'recepcion') obj = [SACADOR.mano[0] - p[0], SACADOR.mano[1] - p[1]];
      else if (estado === 'manos') obj = [-1, 0];
      else if (estado === 'corre' && !(j.esReceptor && t < tR)) obj = [p[0] - prev[0], p[1] - prev[1]];
      else obj = [b[0] - p[0], b[1] - p[1]];
      const objetivo = Math.atan2(obj[1], obj[0]);
      ang = ang === null ? objetivo : ang + angDif(objetivo, ang) * Math.min(1, 12 * dt);

      arr.push({ x: p[0], y: p[1], ang, vel, zancada, estado });
      prev = p;
    }
    muestras.set(j.id, arr);
  }
  return { dt, muestras };
}

/** Pose interpolada de un jugador en el instante t. */
export function poseEn(m, id, t) {
  const arr = m.muestras.get(id);
  const f = Math.max(0, Math.min(arr.length - 1.001, t / m.dt));
  const i = Math.floor(f), u = f - i;
  const a = arr[i], b = arr[i + 1];
  return {
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    ang: a.ang + angDif(b.ang, a.ang) * u,
    vel: a.vel + (b.vel - a.vel) * u,
    zancada: a.zancada + (b.zancada - a.zancada) * u,
    estado: u < 0.5 ? a.estado : b.estado,
  };
}
