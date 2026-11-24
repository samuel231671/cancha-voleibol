// Vista 3D de la jugada dentro de la arena: muñecos, balón, rutas en el suelo y etiquetas.
// Usa exactamente la misma escena y las mismas poses que la pizarra 2D.
//
// Conversión pizarra → mundo 3D (el equipo receptor ocupa la mitad x > 0):
//   pizarra (x: banda izq. → der., y: red → fondo) → mundo (X = y, Z = 4,5 − x), altura → Y
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { SACADOR, muestrearPoses, poseEn, saltoSacadorEn, funcionEn } from './play.js';
import { crearMuneco, POSES, poseCarrera, mezclarPoses, aplicarPose, brazoHacia, puntoAntebrazo } from './puppet.js';

export const a3 = (x, y, h = 0, v = new THREE.Vector3()) => v.set(y, h, 4.5 - x);
const rotY = (ang) => Math.atan2(Math.sin(ang), -Math.cos(ang));
const suave = (a, b, t) => { const u = Math.min(1, Math.max(0, (t - a) / (b - a))); return u * u * (3 - 2 * u); };

const PIELES = [0xf1c27d, 0xc68642, 0xe0ac69, 0x8d5524, 0xffdbac, 0xd8a273];
const EQUIPO = { camiseta: 0x17181b, pantalon: 0xe8772e };       // La Fortuna: negro y naranja
const LIBERO = { camiseta: 0xf28c28, pantalon: 0x17181b };       // camiseta distinta
const RIVAL = { camiseta: 0x1f4fa0, pantalon: 0x0f2a5c };
const COLOR_RUTA = { coloca: 0xffd166, recibe: 0x2ec4b6, ataca: 0xef476f, '1.er tiempo': 0xef476f };
const Y_SUELO = 0.012;

function anillo(color, r0, r1, opacidad = 0.9) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(r0, r1, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacidad, depthWrite: false, side: THREE.DoubleSide })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = Y_SUELO;
  m.renderOrder = 2;
  return m;
}

/** Cinta plana sobre el suelo siguiendo una ruta, con punta de flecha. */
function cinta(puntos, color, ancho = 0.09) {
  const pos = [];
  const v = puntos.map(([x, y]) => a3(x, y, Y_SUELO + 0.003));
  for (let i = 1; i < v.length; i++) {
    const a = v[i - 1], b = v[i];
    const d = new THREE.Vector3().subVectors(b, a);
    if (d.lengthSq() < 1e-6) continue;
    const n = new THREE.Vector3(-d.z, 0, d.x).normalize().multiplyScalar(ancho / 2);
    const fin = i === v.length - 1 ? b.clone().addScaledVector(d.clone().normalize(), -0.22) : b;
    pos.push(a.x + n.x, a.y, a.z + n.z, fin.x + n.x, fin.y, fin.z + n.z, fin.x - n.x, fin.y, fin.z - n.z);
    pos.push(a.x + n.x, a.y, a.z + n.z, fin.x - n.x, fin.y, fin.z - n.z, a.x - n.x, a.y, a.z - n.z);
    if (i === v.length - 1) {
      const u = d.clone().normalize(), w = new THREE.Vector3(-u.z, 0, u.x);
      const base = b.clone().addScaledVector(u, -0.3);
      pos.push(b.x, b.y, b.z, base.x + w.x * 0.16, b.y, base.z + w.z * 0.16, base.x - w.x * 0.16, b.y, base.z - w.z * 0.16);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.88, depthWrite: false, side: THREE.DoubleSide }));
  m.renderOrder = 3;
  return m;
}

export class SimulacionArena {
  /**
   * @param {{ scene: THREE.Scene, balon: THREE.Object3D, camara: THREE.Camera, dom: HTMLElement, onSeleccion: (id: string|null) => void }} o
   */
  constructor({ scene, balon, camara, dom, onSeleccion }) {
    this.balon = balon;
    this.camara = camara;
    this.onSeleccion = onSeleccion;
    this.grupo = new THREE.Group();
    this.grupo.name = 'simulacion';
    scene.add(this.grupo);
    this.flechas = new THREE.Group();
    this.grupo.add(this.flechas);
    this.verFlechas = true;
    this.sel = null;
    this._ray = new THREE.Raycaster();

    // Tocar un jugador lo selecciona (sin interferir con el arrastre de la cámara)
    let ini = null;
    dom.addEventListener('pointerdown', (e) => { ini = [e.clientX, e.clientY]; });
    dom.addEventListener('pointerup', (e) => {
      if (!ini || Math.hypot(e.clientX - ini[0], e.clientY - ini[1]) > 6 || !this.visible) return;
      const r = dom.getBoundingClientRect();
      this._ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camara);
      const hit = this._ray.intersectObjects(this.mallas, false)[0];
      this.onSeleccion(hit ? hit.object.userData.jugador : null);
    });
  }

  set visible(v) { this.grupo.visible = v; for (const j of this.jugadores ?? []) j.etiqueta.visible = v; }
  get visible() { return this.grupo.visible; }

  limpiar() {
    for (const j of this.jugadores ?? []) j.etiqueta.element.remove();
    this.grupo.traverse((o) => { o.geometry?.dispose?.(); });
    this.grupo.clear();
    this.flechas = new THREE.Group();
    this.grupo.add(this.flechas);
  }

  cargar(escena) {
    this.limpiar();
    this.escena = escena;
    this.poses = muestrearPoses(escena);
    this.mallas = [];
    this.jugadores = [];

    escena.jugadores.forEach((j, i) => {
      const esL = j.id === 'L';
      const mu = crearMuneco({ ...(esL ? LIBERO : EQUIPO), piel: PIELES[i % PIELES.length] });
      mu.raiz.traverse((o) => { if (o.isMesh) { o.userData.jugador = j.id; this.mallas.push(o); } });
      this.grupo.add(mu.raiz);

      // Anillos en el suelo: colocador activo (amarillo) y responsable del primer toque (turquesa)
      if (j.esColocador) mu.raiz.add(anillo(0xffd166, 0.42, 0.52));
      if (j.esReceptor) mu.raiz.add(anillo(0x2ec4b6, 0.42, 0.52));
      const marcaSel = anillo(0xffffff, 0.56, 0.64, 0.95);
      marcaSel.visible = false;
      mu.raiz.add(marcaSel);

      // Etiqueta corta sobre la cabeza
      const div = document.createElement('div');
      div.className = `jug-tag${esL ? ' libero' : ''}${j.esColocador ? ' coloca' : ''}`;
      div.innerHTML = `<b>${j.id}</b>${j.reemplaza ? `<i>por ${j.reemplaza}</i>` : ''}<small></small>`;
      div.addEventListener('click', (e) => { e.stopPropagation(); this.onSeleccion(j.id); });
      const etiqueta = new CSS2DObject(div);
      etiqueta.position.set(0, 2.2, 0);
      mu.raiz.add(etiqueta);

      // Ruta sobre el suelo
      const pts = [j.inicio];
      for (const s of j.segmentos) for (const p of s.puntos.slice(1)) pts.push(p);
      const fFinal = j.fases.at(-1).funcion;
      const color = COLOR_RUTA[j.esColocador ? 'coloca' : j.esReceptor ? 'recibe' : fFinal] ?? 0xcfd8dc;
      const ruta = pts.length > 1 ? cinta(pts, color) : null;
      if (ruta) this.flechas.add(ruta);

      this.jugadores.push({ j, mu, etiqueta, small: div.querySelector('small'), ruta, color, marcaSel, ultimaFuncion: null });
    });

    // Sacador rival
    const sac = crearMuneco({ ...RIVAL, piel: 0xe0ac69 });
    this.grupo.add(sac.raiz);
    const divS = document.createElement('div');
    divS.className = 'jug-tag rival';
    divS.innerHTML = '<b>SAC</b><small>sacador rival</small>';
    const etS = new CSS2DObject(divS);
    etS.position.set(0, 2.25, 0);
    sac.raiz.add(etS);
    this.sacador = { mu: sac, etiqueta: etS };
    this.jugadores.push({ j: null, mu: sac, etiqueta: etS });

    // Trayectoria del balón: saque y primer pase (forma parte de las flechas)
    const curva = (t0, t1) => {
      const pts = [];
      for (let k = 0; k <= 40; k++) {
        const b = escena.balonEn(t0 + ((t1 - t0) * k) / 40);
        pts.push(a3(b.p[0], b.p[1], b.h));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0.7 }));
      l.computeLineDistances();
      return l;
    };
    const ev = escena.eventos;
    this.flechas.add(curva(ev.contacto, ev.recepcion - 1e-3), curva(ev.recepcion, ev.colocacion));
    const c1 = anillo(0x2ec4b6, 0.18, 0.24, 0.8);
    a3(...escena.contactoRecepcion, Y_SUELO, c1.position);
    const c2 = anillo(0xffd166, 0.18, 0.24, 0.8);
    a3(...escena.objetivoPase, Y_SUELO, c2.position);
    this.flechas.add(c1, c2);

    this.setFlechas(this.verFlechas);
    this.seleccionar(null);
  }

  setFlechas(v) {
    this.verFlechas = v;
    for (const o of this.flechas.children) o.visible = v;
    // Con un jugador seleccionado su ruta se ve aunque las flechas estén ocultas
    for (const p of this.jugadores ?? []) if (p.ruta) p.ruta.visible = v || p.j.id === this.sel;
  }

  seleccionar(id) {
    this.sel = id;
    for (const p of this.jugadores ?? []) {
      if (!p.j) continue;
      const es = p.j.id === id;
      p.marcaSel.visible = es;
      p.etiqueta.element.classList.toggle('sel', es);
      p.etiqueta.element.classList.toggle('atenuada', !!id && !es);
      if (p.ruta) {
        p.ruta.material.color.setHex(es ? 0xffd166 : p.color);
        p.ruta.material.opacity = !id || es ? 0.9 : 0.12;
      }
    }
    this.setFlechas(this.verFlechas);
  }

  /** Dibuja el instante t de la jugada. */
  update(t) {
    const e = this.escena;
    if (!e) return;
    const { lanzamiento: tL, contacto: tC, recepcion: tR, colocacion: tS } = e.eventos;
    const v = new THREE.Vector3();

    for (const p of this.jugadores) {
      if (!p.j) continue;
      const j = p.j;
      const pose = poseEn(this.poses, j.id, t);
      a3(pose.x, pose.y, 0, p.mu.raiz.position);
      p.mu.raiz.rotation.y = rotY(pose.ang);

      // Pasos: la zancada sale de la distancia recorrida; frenan al llegar
      const ritmo = pose.vel > 0.12 ? Math.max(0.35, Math.min(1, pose.vel / 3)) : 0;
      let cuerpo = ritmo ? mezclarPoses(POSES.espera, poseCarrera((pose.zancada / 1.5) * Math.PI * 2), ritmo) : POSES.espera;
      if (j.esReceptor) {
        const k = suave(tR - 0.45, tR - 0.28, t) * (1 - suave(tR + 0.15, tR + 0.32, t));
        if (k > 0) cuerpo = mezclarPoses(cuerpo, POSES.recepcion, k);
      }
      if (j.esColocador) {
        const k = suave(tS - 0.55, tS - 0.32, t);
        if (k > 0) cuerpo = mezclarPoses(cuerpo, POSES.manos, k);
      }
      aplicarPose(p.mu, cuerpo);

      const fun = funcionEn(j, t);
      if (fun !== p.ultimaFuncion) { p.ultimaFuncion = fun; p.small.textContent = fun; p.small.dataset.f = fun; }
    }

    // Sacador: lanza con la izquierda, golpea con la derecha justo donde está el balón
    const s = this.sacador.mu;
    a3(...SACADOR.cuerpo, saltoSacadorEn(t, tC), s.raiz.position);
    s.raiz.rotation.y = rotY(Math.PI / 2);
    const base = mezclarPoses(POSES.depie, { ...POSES.depie, incl: -0.12 }, suave(tC - 0.35, tC, t));
    const lanz = suave(tL, tL + 0.35, t) * (1 - suave(tC - 0.1, tC + 0.4, t));
    base.hombro = { ...base.hombro, L: { x: 0.9 + (2.9 - 0.9) * lanz, abd: 0.15 } };
    base.codo = { ...base.codo, L: 1.0 * (1 - lanz) + 0.1 };
    aplicarPose(s, base, { conBrazos: { L: true, R: false } });
    const mano = e.manoSacadorEn(t);
    this._errorMano = brazoHacia(s, 'R', a3(mano.p[0], mano.p[1], mano.h, v));

    // Balón (el único visible)
    const b = e.balonEn(t);
    a3(b.p[0], b.p[1], b.h, this.balon.position);
    const giro = Math.max(0, t - tL);
    this.balon.rotation.set(giro * 5, giro * 3.2, 0);
  }

  /** Distancias de control en el instante t (para comprobar los contactos). */
  diagnostico() {
    const e = this.escena;
    const { contacto: tC, recepcion: tR, colocacion: tS } = e.eventos;
    const res = {};
    const balonEn = (t) => { const b = e.balonEn(t); return a3(b.p[0], b.p[1], b.h); };
    this.update(tC);
    res.manoSacador = this._errorMano;
    // Hueco entre la superficie del balón (r = 0,105) y la de los antebrazos (r ≈ 0,042)
    this.update(tR);
    const rec = this.jugadores.find((p) => p.j?.esReceptor).mu;
    const bR = balonEn(tR);
    const seg = new THREE.Line3();
    const huecos = ['L', 'R'].map((lado) => {
      seg.set(puntoAntebrazo(rec, lado, 0.1), puntoAntebrazo(rec, lado, 1));
      return seg.closestPointToPoint(bR, true, new THREE.Vector3()).distanceTo(bR) - 0.147;
    });
    res.huecoAntebrazos = Math.min(...huecos);
    // Hueco entre el balón y las palmas del colocador
    this.update(tS);
    const col = this.jugadores.find((p) => p.j?.esColocador).mu;
    const manos = puntoAntebrazo(col, 'L', 1).add(puntoAntebrazo(col, 'R', 1)).multiplyScalar(0.5);
    res.huecoManos = manos.distanceTo(balonEn(tS)) - 0.105;
    return res;
  }
}
