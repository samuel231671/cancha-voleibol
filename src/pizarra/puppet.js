// Muñequitos 3D articulados (estilo simple, a escala: 1,80 m).
// Articulaciones: caderas, rodillas, columna, cabeza, hombros y codos.
// El muñeco mira hacia +Z local; su izquierda es +X.
import * as THREE from 'three';

export const CUERPO = {
  pie: 0.06, pierna: 0.47, muslo: 0.47,   // cadera a 1,00 m con las piernas rectas
  columna: 0.05, hombroY: 0.47, hombroX: 0.2, caderaX: 0.1,
  brazo: 0.31, antebrazo: 0.3, mano: 0.06,
};
const LADOS = { L: 1, R: -1 };

function capsula(radio, largo, material) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radio, Math.max(0.001, largo), 4, 10), material);
  m.castShadow = true;
  return m;
}

/**
 * @param {{ camiseta: number, pantalon: number, piel: number, zapatillas?: number, pelo?: number }} c
 */
export function crearMuneco(c) {
  const mat = (color, rough = 0.7) => new THREE.MeshStandardMaterial({ color, roughness: rough });
  const M = {
    camiseta: mat(c.camiseta, 0.65), pantalon: mat(c.pantalon), piel: mat(c.piel, 0.6),
    zapatillas: mat(c.zapatillas ?? 0xf2f2f2, 0.5), pelo: mat(c.pelo ?? 0x1d1712, 0.9),
  };
  const B = CUERPO;
  const raiz = new THREE.Group();
  const caderas = new THREE.Group();
  raiz.add(caderas);

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.2), M.pantalon);
  pelvis.position.y = -0.02;
  pelvis.castShadow = true;
  caderas.add(pelvis);

  const muslo = {}, rodilla = {}, hombro = {}, codo = {};
  for (const [lado, s] of Object.entries(LADOS)) {
    const m = new THREE.Group();
    m.position.x = s * B.caderaX;
    caderas.add(m);
    const ms = capsula(0.075, B.muslo - 0.15, M.piel);
    ms.position.y = -B.muslo / 2;
    const short = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.085, 0.22, 10), M.pantalon);
    short.position.y = -0.1;
    short.castShadow = true;
    m.add(ms, short);
    const r = new THREE.Group();
    r.position.y = -B.muslo;
    m.add(r);
    const pi = capsula(0.06, B.pierna - 0.12, M.piel);
    pi.position.y = -B.pierna / 2;
    const zap = new THREE.Mesh(new THREE.BoxGeometry(0.11, B.pie, 0.25), M.zapatillas);
    zap.position.set(0, -B.pierna - B.pie / 2 + 0.005, 0.05);
    zap.castShadow = true;
    r.add(pi, zap);
    muslo[lado] = m; rodilla[lado] = r;
  }

  const columna = new THREE.Group();
  columna.position.y = B.columna;
  caderas.add(columna);
  const tronco = capsula(0.16, 0.3, M.camiseta);
  tronco.scale.set(1.15, 1, 0.72);
  tronco.position.y = 0.27;
  columna.add(tronco);
  const cuello = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 8), M.piel);
  cuello.position.y = 0.52;
  columna.add(cuello);
  const cabeza = new THREE.Group();
  cabeza.position.y = 0.57;
  columna.add(cabeza);
  const craneo = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), M.piel);
  craneo.position.y = 0.06;
  craneo.castShadow = true;
  const pelo = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.pelo);
  pelo.position.set(0, 0.075, -0.01);
  cabeza.add(craneo, pelo);

  for (const [lado, s] of Object.entries(LADOS)) {
    const h = new THREE.Group();
    h.position.set(s * B.hombroX, B.hombroY, 0);
    columna.add(h);
    const manga = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.062, 0.13, 10), M.camiseta);
    manga.position.y = -0.05;
    manga.castShadow = true;
    const br = capsula(0.048, B.brazo - 0.1, M.piel);
    br.position.y = -B.brazo / 2;
    h.add(manga, br);
    const co = new THREE.Group();
    co.position.y = -B.brazo;
    h.add(co);
    const ab = capsula(0.042, B.antebrazo - 0.08, M.piel);
    ab.position.y = -B.antebrazo / 2;
    const mano = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), M.piel);
    mano.position.y = -B.antebrazo - 0.02;
    co.add(ab, mano);
    hombro[lado] = h; codo[lado] = co;
  }

  return { raiz, materiales: M, partes: { caderas, columna, cabeza, muslo, rodilla, hombro, codo } };
}

// ---------- Poses ----------
// p = { incl, muslo:{L,R}, rodilla:{L,R}, hombro:{L:{x,abd},R:{x,abd}}, codo:{L,R} }
//   muslo: ángulo hacia delante (rad) · rodilla: flexión
//   hombro.x: elevación hacia delante RELATIVA AL TRONCO (el ángulo real del brazo es x − incl)
//   hombro.abd: separación lateral (negativo = hacia dentro) · codo: flexión hacia delante

export const POSES = {
  espera: { incl: 0.42, muslo: { L: 0.6, R: 0.6 }, rodilla: { L: 1.05, R: 1.05 },
    hombro: { L: { x: 0.95, abd: 0.12 }, R: { x: 0.95, abd: 0.12 } }, codo: { L: 0.75, R: 0.75 } },
  // Antebrazos juntos y extendidos: plataforma de recepción
  recepcion: { incl: 0.5, muslo: { L: 0.95, R: 0.95 }, rodilla: { L: 1.6, R: 1.6 },
    hombro: { L: { x: 1.5, abd: -0.2 }, R: { x: 1.5, abd: -0.2 } }, codo: { L: 0.02, R: 0.02 } },
  // Colocador: manos altas sobre la frente
  manos: { incl: -0.05, muslo: { L: 0.25, R: 0.25 }, rodilla: { L: 0.45, R: 0.45 },
    hombro: { L: { x: 2.6, abd: 0.28 }, R: { x: 2.6, abd: 0.28 } }, codo: { L: 0.35, R: 0.35 } },
  depie: { incl: 0.12, muslo: { L: 0.2, R: 0.2 }, rodilla: { L: 0.35, R: 0.35 },
    hombro: { L: { x: 0.35, abd: 0.1 }, R: { x: 0.35, abd: 0.1 } }, codo: { L: 0.5, R: 0.5 } },
};

/** Pose de carrera para una fase de zancada φ. */
export function poseCarrera(fase) {
  const pie = (f) => ({ a: 0.15 + 0.62 * Math.sin(f), k: 0.35 + 0.85 * Math.max(0, Math.sin(f + 1.3)) });
  const l = pie(fase), r = pie(fase + Math.PI);
  return {
    incl: 0.28,
    muslo: { L: l.a, R: r.a }, rodilla: { L: l.k, R: r.k },
    hombro: { L: { x: 0.28 + 0.7 * Math.sin(fase + Math.PI), abd: 0.12 }, R: { x: 0.28 + 0.7 * Math.sin(fase), abd: 0.12 } },
    codo: { L: 1.35, R: 1.35 },
  };
}

export function mezclarPoses(a, b, u) {
  const m = (x, y) => x + (y - x) * u;
  return {
    incl: m(a.incl, b.incl),
    muslo: { L: m(a.muslo.L, b.muslo.L), R: m(a.muslo.R, b.muslo.R) },
    rodilla: { L: m(a.rodilla.L, b.rodilla.L), R: m(a.rodilla.R, b.rodilla.R) },
    hombro: {
      L: { x: m(a.hombro.L.x, b.hombro.L.x), abd: m(a.hombro.L.abd, b.hombro.L.abd) },
      R: { x: m(a.hombro.R.x, b.hombro.R.x), abd: m(a.hombro.R.abd, b.hombro.R.abd) },
    },
    codo: { L: m(a.codo.L, b.codo.L), R: m(a.codo.R, b.codo.R) },
  };
}

/** Aplica la pose y apoya en el suelo el pie más bajo. */
export function aplicarPose(mu, p, { conBrazos = { L: true, R: true } } = {}) {
  const P = mu.partes, B = CUERPO;
  P.columna.rotation.x = p.incl;
  let altura = 0;
  for (const lado of ['L', 'R']) {
    const a = p.muslo[lado], k = p.rodilla[lado];
    P.muslo[lado].rotation.x = -a;
    P.rodilla[lado].rotation.x = k;
    altura = Math.max(altura, B.muslo * Math.cos(a) + B.pierna * Math.cos(a - k) + B.pie);
    if (conBrazos[lado]) {
      P.hombro[lado].rotation.set(-p.hombro[lado].x, 0, LADOS[lado] * p.hombro[lado].abd);
      P.codo[lado].rotation.x = -p.codo[lado];
    }
  }
  P.caderas.position.y = altura;
}

// ---------- Brazo con cinemática inversa (sacador) ----------
const _v = new THREE.Vector3(), _obj = new THREE.Vector3(), _eje = new THREE.Vector3();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4();

/** Coloca el brazo `lado` para que la palma quede en `destinoMundo`. */
export function brazoHacia(mu, lado, destinoMundo) {
  const B = CUERPO;
  const h = mu.partes.hombro[lado], co = mu.partes.codo[lado];
  const u = B.brazo, f = B.antebrazo + 0.02;
  h.parent.updateWorldMatrix(true, false);
  _obj.copy(destinoMundo);
  h.parent.worldToLocal(_obj);           // destino en el espacio de la columna
  _v.subVectors(_obj, h.position);        // hombro → destino
  const d = Math.min(_v.length(), u + f - 1e-4);
  const dir = _v.normalize();
  // Ángulo en el hombro (ley de los cosenos) y flexión del codo
  const alfa = Math.acos(THREE.MathUtils.clamp((u * u + d * d - f * f) / (2 * u * d), -1, 1));
  const flex = Math.PI - Math.acos(THREE.MathUtils.clamp((u * u + f * f - d * d) / (2 * u * f), -1, 1));
  // Plano de flexión: el codo sale hacia el costado del brazo
  _eje.set(LADOS[lado], 0, 0).cross(dir);
  if (_eje.lengthSq() < 1e-6) _eje.set(0, 0, 1);
  _eje.normalize();
  // Brazo superior: gira `alfa` desde la dirección al destino hacia el lado del codo
  const perp = new THREE.Vector3().crossVectors(_eje, dir).normalize();
  const brazoDir = dir.clone().multiplyScalar(Math.cos(alfa)).addScaledVector(perp, Math.sin(alfa)).normalize();
  // Base local del hombro: -Y a lo largo del brazo, X perpendicular al plano de flexión
  _y.copy(brazoDir).negate();
  _x.crossVectors(_y, perp).normalize();
  _z.crossVectors(_x, _y).normalize();
  _m.makeBasis(_x, _y, _z);
  h.quaternion.setFromRotationMatrix(_m);
  // Elegir el signo de flexión que deja la mano sobre el destino
  let mejor = 0, err = Infinity;
  for (const s of [1, -1]) {
    co.rotation.set(s * flex, 0, 0);
    co.updateWorldMatrix(true, false);
    const palma = co.localToWorld(new THREE.Vector3(0, -f, 0));
    const e = palma.distanceTo(destinoMundo);
    if (e < err) { err = e; mejor = s; }
  }
  co.rotation.set(mejor * flex, 0, 0);
  return err;
}

/** Posición en el mundo de un punto del antebrazo (0 = codo, 1 = palma). */
export function puntoAntebrazo(mu, lado, u) {
  const co = mu.partes.codo[lado];
  co.updateWorldMatrix(true, false);
  return co.localToWorld(new THREE.Vector3(0, -(CUERPO.antebrazo + 0.02) * u, 0));
}
