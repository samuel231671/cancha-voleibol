// Vista 2D (pizarra SVG) de la jugada. Comparte escena, poses y reloj con la vista 3D.
import { posicionEn, funcionEn, SACADOR, muestrearPoses, poseEn } from './play.js';

const NS = 'http://www.w3.org/2000/svg';
const K = 0.32;                                    // altura del balón → desplazamiento en pantalla
const VB = { x: -1.4, y: -11.4, w: 11.8, h: 21.3 }; // metros: sacador rival arriba, mi equipo abajo
const COLOR_FUNCION = {
  coloca: ['#ffd166', '#1b1b1b'],
  recibe: ['#2ec4b6', '#06201d'],
  ataca: ['#ef476f', '#fff'],
  '1.er tiempo': ['#ef476f', '#fff'],
  cubre: ['#5b6b73', '#fff'],
  apoyo: ['#5b6b73', '#fff'],
};
const COLOR_RUTA = { coloca: '#ffd166', recibe: '#2ec4b6', ataca: '#ef476f', '1.er tiempo': '#ef476f' };
const MARCADOR = { '#ffd166': 'f-amarilla', '#2ec4b6': 'f-turquesa', '#ef476f': 'f-roja' };

function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}
const limpiar = (g) => { while (g.firstChild) g.firstChild.remove(); };

export class Pizarra2D {
  /** @param {SVGSVGElement} svg @param {{ onSeleccion: (id: string|null) => void }} o */
  constructor(svg, { onSeleccion }) {
    this.svg = svg;
    this.onSeleccion = onSeleccion;
    this.zonas = true;
    this.flechas = true;
    this.sel = null;
    svg.setAttribute('viewBox', `${VB.x} ${VB.y} ${VB.w} ${VB.h}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const defs = el('defs', {}, svg);
    for (const [id, color] of [['f-blanca', '#ffffff'], ['f-amarilla', '#ffd166'], ['f-turquesa', '#2ec4b6'], ['f-roja', '#ef476f'], ['f-gris', '#cfd8dc']]) {
      const m = el('marker', { id, viewBox: '0 0 10 10', refX: 7, refY: 5, markerWidth: 4, markerHeight: 4, orient: 'auto-start-reverse' }, defs);
      el('path', { d: 'M0 0L10 5L0 10z', fill: color }, m);
    }
    const grad = el('radialGradient', { id: 'g-balon', cx: '35%', cy: '30%', r: '70%' }, defs);
    el('stop', { offset: '0%', 'stop-color': '#fff6c8' }, grad);
    el('stop', { offset: '55%', 'stop-color': '#f6c426' }, grad);
    el('stop', { offset: '100%', 'stop-color': '#c99a10' }, grad);
    this.capa = {};
    for (const n of ['campo', 'zonas', 'legal', 'rutas', 'marcas', 'jugadores', 'sacador', 'balon']) this.capa[n] = el('g', { class: n }, svg);
    this.dibujarCampo();
    this.dibujarZonas();
    svg.addEventListener('click', () => this.onSeleccion(null));
  }

  dibujarCampo() {
    const g = this.capa.campo;
    el('rect', { x: VB.x, y: VB.y, width: VB.w, height: VB.h, fill: '#1b8b81' }, g);
    el('rect', { x: 0, y: -9, width: 9, height: 9, fill: '#d39a68' }, g);
    el('rect', { x: 0, y: -3, width: 9, height: 3, fill: '#c7895a' }, g);
    el('rect', { x: 0, y: 0, width: 9, height: 9, fill: '#e8a66b' }, g);
    el('rect', { x: 0, y: 0, width: 9, height: 3, fill: '#d9894b' }, g);
    const linea = { stroke: '#fff', 'stroke-width': 0.05, fill: 'none' };
    el('rect', { x: 0, y: -9, width: 9, height: 18, ...linea }, g);
    for (const y of [-3, 3]) {
      el('line', { x1: 0, y1: y, x2: 9, y2: y, ...linea }, g);
      for (const x0 of [-1.75, 9]) el('line', { x1: x0, y1: y, x2: x0 + 1.75, y2: y, ...linea, 'stroke-dasharray': '0.15 0.2' }, g);
    }
    el('line', { x1: -1, y1: 0, x2: 10, y2: 0, stroke: '#0d0d0d', 'stroke-width': 0.14 }, g);
    el('line', { x1: -0.25, y1: 0, x2: 9.25, y2: 0, stroke: '#f3f3f0', 'stroke-width': 0.05 }, g);
    for (const x of [0, 9]) el('circle', { cx: x, cy: 0, r: 0.09, fill: '#d31f26', stroke: '#fff', 'stroke-width': 0.03 }, g);
    for (const x of [-1, 10]) el('rect', { x: x - 0.17, y: -0.25, width: 0.34, height: 0.5, rx: 0.06, fill: '#131416' }, g);
    const txt = { fill: 'rgba(255,255,255,.55)', 'font-size': 0.42, 'font-weight': 700, 'text-anchor': 'middle', 'letter-spacing': 0.05 };
    el('text', { x: 4.5, y: -6.1, ...txt }, g).textContent = 'CAMPO RIVAL';
    el('text', { x: 10.05, y: -0.45, ...txt, 'font-size': 0.3 }, g).textContent = 'RED';
  }

  dibujarZonas() {
    const g = this.capa.zonas;
    const z = { 4: [0, 0], 3: [3, 0], 2: [6, 0], 5: [0, 3], 6: [3, 3], 1: [6, 3] };
    for (const [n, [x, y]] of Object.entries(z)) {
      const h = y === 0 ? 3 : 6;
      el('rect', { x: x + 0.04, y: y + 0.04, width: 2.92, height: h - 0.08, fill: 'none', stroke: 'rgba(255,255,255,.35)', 'stroke-width': 0.03, 'stroke-dasharray': '0.12 0.12' }, g);
      el('text', { x: x + 1.5, y: y + (y === 0 ? 1.65 : 4.1), fill: 'rgba(0,0,0,.18)', 'font-size': 1.3, 'font-weight': 800, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g).textContent = n;
    }
  }

  cargar(e) {
    this.escena = e;
    this.poses = muestrearPoses(e);
    const C = this.capa;
    for (const n of ['legal', 'rutas', 'marcas', 'jugadores', 'sacador', 'balon']) limpiar(C[n]);
    this.fichas = new Map();
    this.rutas = new Map();

    // Trayectorias del balón (saque y primer pase) y puntos de contacto
    const mano = SACADOR.mano, rec = e.contactoRecepcion, obj = e.objetivoPase;
    el('line', { x1: mano[0], y1: mano[1], x2: rec[0], y2: rec[1], stroke: '#fff', 'stroke-width': 0.04, 'stroke-dasharray': '0.12 0.16', opacity: 0.55, class: 'flecha', 'marker-end': 'url(#f-blanca)' }, C.marcas);
    el('line', { x1: rec[0], y1: rec[1], x2: obj[0], y2: obj[1], stroke: '#ffd166', 'stroke-width': 0.04, 'stroke-dasharray': '0.12 0.16', opacity: 0.6, class: 'flecha', 'marker-end': 'url(#f-amarilla)' }, C.marcas);
    for (const [p, txt, c] of [[rec, '1.er toque', '#2ec4b6'], [obj, '2.º toque', '#ffd166']]) {
      const g = el('g', { transform: `translate(${p[0]} ${p[1]})`, class: 'flecha' }, C.marcas);
      el('circle', { r: 0.3, fill: 'none', stroke: c, 'stroke-width': 0.05, 'stroke-dasharray': '0.1 0.08' }, g);
      el('text', { x: 0.42, y: -0.32, fill: c, 'font-size': 0.3, 'font-weight': 800 }, g).textContent = txt;
    }

    // Regla 7.4: pares delante–detrás en el golpe de saque
    this.lineasLegal = el('g', {}, C.legal);
    const porZona = Object.fromEntries(e.jugadores.map((j) => [j.zona, j.inicio]));
    for (const [a, b] of [[4, 5], [3, 6], [2, 1]]) {
      el('line', { x1: porZona[a][0], y1: porZona[a][1], x2: porZona[b][0], y2: porZona[b][1], stroke: 'rgba(255,255,255,.6)', 'stroke-width': 0.035, 'stroke-dasharray': '0.06 0.1' }, this.lineasLegal);
    }

    for (const j of e.jugadores) {
      const pts = [j.inicio];
      for (const s of j.segmentos) for (const p of s.puntos.slice(1)) pts.push(p);
      const color = COLOR_RUTA[j.esColocador ? 'coloca' : j.esReceptor ? 'recibe' : j.fases.at(-1).funcion] ?? '#cfd8dc';
      if (pts.length > 1) {
        this.rutas.set(j.id, el('polyline', { points: pts.map((p) => p.join(',')).join(' '), class: 'ruta flecha', stroke: color, opacity: 0.85, 'marker-end': `url(#${MARCADOR[color] ?? 'f-gris'})` }, C.rutas));
      }
      const ext = el('g', { class: 'tok', tabindex: 0, role: 'button', 'aria-label': `${j.id}: ver recorrido` }, C.jugadores);
      const g = el('g', { class: 'escala-ficha' }, ext);
      const esL = j.id === 'L';
      el('circle', { r: 0.5, fill: 'rgba(0,0,0,.25)', cy: 0.06 }, g);
      // Indicador de hacia dónde mira (misma orientación que el muñeco 3D)
      const mira = el('path', { d: 'M0.5 0 L0.28 0.17 L0.28 -0.17 Z', fill: '#fff', opacity: 0.85 }, g);
      el('circle', { r: 0.44, class: 'cuerpo', fill: esL ? '#f28c28' : '#15171a', stroke: j.esColocador ? '#ffd166' : esL ? '#ffffff' : '#e8a66b', 'stroke-width': j.esColocador ? 0.11 : 0.07 }, g);
      el('text', { 'font-size': j.id.length > 3 ? 0.27 : 0.34, fill: esL ? '#1b1b1b' : '#fff' }, g).textContent = j.id;
      if (j.reemplaza) {
        const sub = el('g', { transform: 'translate(0 -0.74)' }, g);
        el('rect', { x: -0.48, y: -0.17, width: 0.96, height: 0.34, rx: 0.17, fill: '#fff' }, sub);
        el('text', { 'font-size': 0.22, fill: '#1b1b1b' }, sub).textContent = `por ${j.reemplaza}`;
      }
      const tag = el('g', { transform: 'translate(0 0.78)' }, g);
      const tagRect = el('rect', { y: -0.17, height: 0.34, rx: 0.17 }, tag);
      const tagTxt = el('text', { 'font-size': 0.22 }, tag);
      ext.addEventListener('click', (ev) => { ev.stopPropagation(); this.onSeleccion(j.id); });
      ext.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); this.onSeleccion(j.id); } });
      this.fichas.set(j.id, { g: ext, mira, tagRect, tagTxt, j, ultimaFuncion: null });
    }

    // Sacador rival
    const s = el('g', {}, C.sacador);
    const brazo = el('line', { stroke: '#cfe0ff', 'stroke-width': 0.1, 'stroke-linecap': 'round' }, s);
    const cuerpo = el('g', { transform: `translate(${SACADOR.cuerpo[0]} ${SACADOR.cuerpo[1]})` }, s);
    el('circle', { r: 0.44, fill: '#1f4fa0', stroke: '#fff', 'stroke-width': 0.07 }, cuerpo);
    el('text', { 'font-size': 0.28, fill: '#fff', 'font-weight': 800, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, cuerpo).textContent = 'SAC';
    el('text', { y: 0.78, 'font-size': 0.24, fill: '#cfe0ff', 'text-anchor': 'middle', 'font-weight': 700 }, cuerpo).textContent = 'sacador rival';
    const manoS = el('circle', { r: 0.1, fill: '#cfe0ff' }, s);
    const destello = el('g', { opacity: 0 }, s);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      el('line', { x1: Math.cos(a) * 0.32, y1: Math.sin(a) * 0.32, x2: Math.cos(a) * 0.62, y2: Math.sin(a) * 0.62, stroke: '#ffd166', 'stroke-width': 0.07, 'stroke-linecap': 'round' }, destello);
    }
    this.sacador = { brazo, manoS, destello };

    const sombra = el('ellipse', { rx: 0.22, ry: 0.13, fill: 'rgba(0,0,0,.35)' }, C.balon);
    const bola = el('g', {}, C.balon);
    el('circle', { r: 0.2, fill: 'url(#g-balon)', stroke: '#1c3aa8', 'stroke-width': 0.035 }, bola);
    el('path', { d: 'M-0.17 -0.06 Q0 0.1 0.17 -0.06 M-0.1 0.15 Q0.02 -0.05 0.02 -0.19', stroke: '#1c3aa8', 'stroke-width': 0.04, fill: 'none' }, bola);
    this.balon = { sombra, bola };

    this.seleccionar(this.sel && e.jugadores.some((j) => j.id === this.sel) ? this.sel : null);
  }

  setVisibilidad({ zonas, flechas }) {
    if (zonas !== undefined) this.zonas = zonas;
    if (flechas !== undefined) this.flechas = flechas;
    this.capa.zonas.style.display = this.zonas ? '' : 'none';
    for (const n of this.svg.querySelectorAll('.flecha')) n.style.display = this.flechas ? '' : 'none';
    if (this.sel && this.rutas?.get(this.sel)) this.rutas.get(this.sel).style.display = '';
  }

  seleccionar(id) {
    this.sel = id;
    for (const [k, f] of this.fichas ?? []) f.g.classList.toggle('atenuado', !!id && k !== id);
    for (const [k, r] of this.rutas ?? []) {
      r.classList.toggle('sel', k === id);
      r.classList.toggle('atenuada', !!id && k !== id);
    }
    this.setVisibilidad({});
  }

  render(t) {
    const e = this.escena;
    if (!e) return;
    const { contacto: tC } = e.eventos;
    for (const f of this.fichas.values()) {
      const pose = poseEn(this.poses, f.j.id, t);
      const p = posicionEn(f.j, t);
      f.g.setAttribute('transform', `translate(${p[0]} ${p[1]})`);
      f.mira.setAttribute('transform', `rotate(${(pose.ang * 180) / Math.PI})`);
      const fun = funcionEn(f.j, t);
      if (fun !== f.ultimaFuncion) {
        f.ultimaFuncion = fun;
        const [bg, fg] = COLOR_FUNCION[fun] ?? ['#5b6b73', '#fff'];
        const w = 0.16 * fun.length + 0.3;
        f.tagRect.setAttribute('x', -w / 2); f.tagRect.setAttribute('width', w); f.tagRect.setAttribute('fill', bg);
        f.tagTxt.setAttribute('fill', fg); f.tagTxt.textContent = fun;
      }
    }
    const mano = e.manoSacadorEn(t);
    const hombro = [SACADOR.cuerpo[0], SACADOR.cuerpo[1] - 1.45 * K];
    const mx = mano.p[0], my = mano.p[1] - mano.h * K;
    const S = this.sacador;
    S.brazo.setAttribute('x1', hombro[0]); S.brazo.setAttribute('y1', hombro[1]);
    S.brazo.setAttribute('x2', mx); S.brazo.setAttribute('y2', my);
    S.manoS.setAttribute('cx', mx); S.manoS.setAttribute('cy', my);
    const b0 = e.balonEn(tC);
    S.destello.setAttribute('transform', `translate(${b0.p[0]} ${b0.p[1] - b0.h * K})`);
    S.destello.setAttribute('opacity', t >= tC && t < tC + 0.45 ? 1 - (t - tC) / 0.45 : 0);

    const b = e.balonEn(t);
    this.balon.sombra.setAttribute('cx', b.p[0]); this.balon.sombra.setAttribute('cy', b.p[1]);
    this.balon.sombra.setAttribute('opacity', Math.max(0.25, 1 - b.h / 6));
    this.balon.bola.setAttribute('transform', `translate(${b.p[0]} ${b.p[1] - b.h * K}) scale(${1 + b.h * 0.06}) rotate(${t * 220})`);
    this.lineasLegal.setAttribute('opacity', this.zonas && t <= tC + 0.4 ? 1 : 0);
  }
}
