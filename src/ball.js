// Balón de voleibol (medidas oficiales FIVB).
// Diseño genérico amarillo/azul con paneles en espiral, costuras y micro-hoyuelos,
// todo generado por código (sin imágenes ni marcas).
import * as THREE from 'three';

export const BALL = {
  circumference: { min: 0.65, max: 0.67 },   // m
  mass: { min: 0.26, max: 0.28 },            // kg
  get radius() { return (this.circumference.min + this.circumference.max) / 2 / (2 * Math.PI); }, // ≈ 0,105 m
  get massAvg() { return (this.mass.min + this.mass.max) / 2; },                                  // 0,27 kg
};

const YELLOW = [246, 196, 38];
const BLUE = [28, 58, 168];

// Clasifica una dirección de la esfera en panel/costura/hoyuelo.
function sample(x, y, z) {
  // Giro en espiral alrededor de dos ejes para curvar los paneles
  let a = 1.35 * y;
  let px = x * Math.cos(a) - z * Math.sin(a);
  let pz = x * Math.sin(a) + z * Math.cos(a);
  let py = y;
  a = 0.55 * px;
  const qy = py * Math.cos(a) - pz * Math.sin(a);
  const qz = py * Math.sin(a) + pz * Math.cos(a);
  py = qy; pz = qz;

  const ax = Math.abs(px), ay = Math.abs(py), az = Math.abs(pz);
  let face, u, w, m;
  if (ax >= ay && ax >= az) { face = 0; m = ax; u = py / ax; w = pz / ax; }
  else if (ay >= az) { face = 1; m = ay; u = pz / ay; w = px / ay; }
  else { face = 2; m = az; u = px / az; w = py / az; }

  const strip = u < -1 / 3 ? 0 : u < 1 / 3 ? 1 : 2;
  const blue = (face === 0 && strip === 1) || (face === 2 && strip !== 1);

  // Distancia a la costura más cercana (en unidades de cara, escala angular aprox.)
  const edge = Math.min(Math.abs(u - 1 / 3), Math.abs(u + 1 / 3), 1 - Math.abs(u), 1 - Math.abs(w)) * m;

  // Hoyuelos: rejilla regular sobre la proyección cúbica de la dirección sin girar
  const bx = Math.abs(x), by = Math.abs(y), bz = Math.abs(z);
  let s, t;
  if (bx >= by && bx >= bz) { s = y / bx; t = z / bx; }
  else if (by >= bz) { s = z / by; t = x / by; }
  else { s = x / bz; t = y / bz; }
  const G = 0.024;
  const fs = s / G - Math.round(s / G), ft = t / G - Math.round(t / G);
  const dimple = fs * fs + ft * ft < 0.07;

  return { blue, edge, dimple };
}

function buildTextures(W = 2048, H = 1024) {
  const color = document.createElement('canvas');
  const bump = document.createElement('canvas');
  color.width = bump.width = W;
  color.height = bump.height = H;
  const cctx = color.getContext('2d'), bctx = bump.getContext('2d');
  const cimg = cctx.createImageData(W, H), bimg = bctx.createImageData(W, H);

  const SEAM = 0.016;
  for (let j = 0; j < H; j++) {
    const theta = ((j + 0.5) / H) * Math.PI;
    const st = Math.sin(theta), ct = Math.cos(theta);
    for (let i = 0; i < W; i++) {
      const phi = ((i + 0.5) / W) * Math.PI * 2;
      // Misma parametrización que THREE.SphereGeometry
      const { blue, edge, dimple } = sample(-Math.cos(phi) * st, ct, Math.sin(phi) * st);
      const base = blue ? BLUE : YELLOW;

      // Costura hundida con caída suave
      const seamK = edge < SEAM ? 1 - edge / SEAM : 0;
      let shade = 1 - 0.45 * seamK * seamK;
      if (dimple) shade *= 0.9;

      const k = (j * W + i) * 4;
      cimg.data[k] = base[0] * shade;
      cimg.data[k + 1] = base[1] * shade;
      cimg.data[k + 2] = base[2] * shade;
      cimg.data[k + 3] = 255;

      let h = 210;
      if (dimple) h = 150;
      h -= 190 * seamK * seamK;
      bimg.data[k] = bimg.data[k + 1] = bimg.data[k + 2] = Math.max(0, h);
      bimg.data[k + 3] = 255;
    }
  }
  cctx.putImageData(cimg, 0, 0);
  bctx.putImageData(bimg, 0, 0);

  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.anisotropy = 8;
  return { map, bumpMap };
}

/**
 * Crea el balón a escala real.
 * @returns {THREE.Mesh}
 */
export function createBall() {
  const { map, bumpMap } = buildTextures();
  const mat = new THREE.MeshPhysicalMaterial({
    map,
    bumpMap,
    bumpScale: 1.2,
    roughness: 0.55,
    clearcoat: 0.25,
    clearcoatRoughness: 0.6,
    sheen: 0.3,
    sheenRoughness: 0.8,
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL.radius, 96, 64), mat);
  ball.name = 'balon';
  ball.castShadow = true;
  ball.userData = { mass: BALL.massAvg, radius: BALL.radius };
  return ball;
}
