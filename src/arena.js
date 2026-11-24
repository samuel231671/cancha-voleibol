// Pabellón decorativo alrededor de la cancha (no interactivo).
// Gradas en dos anillos, público, pantallas LED, marcador central, techo con estructura.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Borde interior del graderío: rectángulo redondeado (medias dimensiones + radio de esquina)
const BASE = { a: 19, b: 13.5, r: 6 };
const LOWER = { rows: 16, depth: 0.85, rise: 0.42, y0: 0.6 };
const UPPER = { rows: 18, depth: 0.85, rise: 0.55 };
const CEILING = 26.5;

// ---------- Perfil del graderío (para colisiones de cámara) ----------
const PROFILE = (() => {
  const lowerEnd = 0.2 + LOWER.rows * LOWER.depth;
  const concY = LOWER.y0 + LOWER.rows * LOWER.rise;
  const upperStart = lowerEnd + 2.5;
  const fasciaTop = 10.2;
  const upper0 = upperStart + 0.3;
  const upperEnd = upper0 + UPPER.rows * UPPER.depth;
  return { lowerEnd, concY, upperStart, fasciaTop, upper0, upperEnd };
})();

// Distancia con signo al borde interior del graderío (negativa = dentro de la pista).
export function standDistance(x, z) {
  const { a, b, r } = BASE;
  const qx = Math.abs(x) - (a - r), qz = Math.abs(z) - (b - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
}

// Altura de la superficie (escalón + público) a una distancia d del borde interior.
export function standSurface(d) {
  const P = PROFILE;
  const HEAD = 1.3; // cabeza del público sentado
  if (d < 0) return 0;
  if (d < 0.2) return 1.1;
  if (d < P.lowerEnd) {
    const i = Math.floor((d - 0.2) / LOWER.depth);
    return LOWER.y0 + (i + 1) * LOWER.rise + HEAD;
  }
  if (d < P.upperStart) return P.concY;
  if (d < P.upper0) return P.fasciaTop;
  if (d < P.upperEnd) {
    const i = Math.floor((d - P.upper0) / UPPER.depth);
    return P.fasciaTop - 0.6 + (i + 1) * UPPER.rise + HEAD;
  }
  return Infinity; // pared del fondo
}

export const STAND_LIMIT = PROFILE.upperEnd - 1; // la cámara no pasa de aquí

// ---------- Utilidades de geometría ----------
function rrShape(a, b, r) {
  const s = new THREE.Shape();
  s.moveTo(a, -(b - r));
  s.lineTo(a, b - r);
  s.absarc(a - r, b - r, r, 0, Math.PI / 2, false);
  s.lineTo(-(a - r), b);
  s.absarc(-(a - r), b - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-a, -(b - r));
  s.absarc(-(a - r), -(b - r), r, Math.PI, Math.PI * 1.5, false);
  s.lineTo(a - r, -b);
  s.absarc(a - r, -(b - r), r, Math.PI * 1.5, Math.PI * 2, false);
  return s;
}

// Anillo extruido entre los desfases d0 y d1 del borde base, de y0 a y1.
function ring(d0, d1, y0, y1) {
  const outer = rrShape(BASE.a + d1, BASE.b + d1, BASE.r + d1);
  outer.holes.push(rrShape(BASE.a + d0, BASE.b + d0, BASE.r + d0));
  const g = new THREE.ExtrudeGeometry(outer, { depth: y1 - y0, bevelEnabled: false, curveSegments: 10 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
}

// Recorrido del perímetro con normal hacia el centro.
function perimeter(d) {
  const a = BASE.a + d, b = BASE.b + d, r = BASE.r + d;
  const ca = a - r, cb = b - r;
  const segs = [];
  const line = (x0, z0, x1, z1, nx, nz, kind) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    segs.push({ len, at: (t) => ({ x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, nx, nz, kind }) });
  };
  const arc = (cx, cz, t0) => {
    segs.push({ len: r * Math.PI / 2, at: (t) => {
      const th = t0 + t * Math.PI / 2;
      const c = Math.cos(th), s = Math.sin(th);
      return { x: cx + r * c, z: cz + r * s, nx: -c, nz: -s, kind: 'arc', u: t };
    } });
  };
  line(a, -cb, a, cb, -1, 0, 'short');
  arc(ca, cb, 0);
  line(ca, b, -ca, b, 0, -1, 'long');
  arc(-ca, cb, Math.PI / 2);
  line(-a, cb, -a, -cb, 1, 0, 'short');
  arc(-ca, -cb, Math.PI);
  line(-ca, -b, ca, -b, 0, 1, 'long');
  arc(ca, -cb, Math.PI * 1.5);
  const total = segs.reduce((s, g) => s + g.len, 0);
  return {
    total,
    segs,
    sample(spacing, cb2) {
      let s = spacing / 2, acc = 0;
      for (const seg of segs) {
        while (s <= acc + seg.len) {
          cb2(seg.at((s - acc) / seg.len), s);
          s += spacing;
        }
        acc += seg.len;
      }
    },
    points(step) {
      const pts = [];
      let acc = 0;
      for (const seg of segs) {
        const n = Math.max(1, Math.ceil(seg.len / step));
        for (let i = 0; i < n; i++) pts.push({ ...seg.at(i / n), s: acc + (seg.len * i) / n });
        acc += seg.len;
      }
      pts.push({ ...pts[0], s: total });
      return pts;
    },
  };
}

// Banda vertical que sigue el perímetro (para LED y palcos), con UV continua.
function strip(d, y0, y1, texLen) {
  const pts = perimeter(d).points(0.6);
  const pos = [], uv = [], idx = [];
  pts.forEach((p, i) => {
    pos.push(p.x, y0, p.z, p.x, y1, p.z);
    const u = p.s / texLen;
    uv.push(u, 0, u, 1);
    if (i < pts.length - 1) {
      const k = i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------- Pantallas LED con el nombre de la academia ----------
const NOMBRE_LED = 'Academia Voleibol Fortuna';
const NARANJA_LED = '#FF6A00';
const HUECO_MIN_LED = 1.5; // metros mínimos entre repeticiones

let _texNombre = null;
/** Textura con UNA repetición del nombre: fondo #FF6A00 y letras blancas con brillo suave. */
function texturaNombre() {
  if (_texNombre) return _texNombre;
  // Letras grandes (≈70 % del alto del panel) para que se lean también en teléfono
  const H = 128, pad = 44;
  const fuente = 'bold 88px system-ui, "Segoe UI", Roboto, sans-serif';
  const medir = document.createElement('canvas').getContext('2d');
  medir.font = fuente;
  const W = Math.ceil(medir.measureText(NOMBRE_LED).width + pad * 2);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = NARANJA_LED;
  ctx.fillRect(0, 0, W, H);
  // Brillo LED suave: banda luminosa en el centro y bordes apenas más profundos
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0.10)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.10)');
  g.addColorStop(1, 'rgba(0,0,0,0.10)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.font = fuente;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255, 236, 210, 0.85)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(NOMBRE_LED, W / 2, H / 2 + 4);
  ctx.shadowBlur = 0;
  ctx.fillText(NOMBRE_LED, W / 2, H / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; // los huecos toman el borde: naranja liso
  tex.anisotropy = 8;
  _texNombre = { tex, aspecto: W / H };
  return _texNombre;
}

/**
 * Geometría de pantalla LED: en cada tramo recto entra un número entero de nombres
 * completos con el espacio sobrante repartido entre ellos; las curvas quedan lisas,
 * así ninguna esquina corta una palabra.
 * @param {{ len: number, at: (t: number) => { x: number, z: number }, recto: boolean }[]} tramos
 */
function geometriaNombre(tramos, y0, y1) {
  const anchoNombre = texturaNombre().aspecto * (y1 - y0);
  const pos = [], uv = [], idx = [];
  const quad = (a, b, ua, ub) => {
    const k = pos.length / 3;
    pos.push(a.x, y0, a.z, b.x, y0, b.z, b.x, y1, b.z, a.x, y1, a.z);
    uv.push(ua, 0, ub, 0, ub, 1, ua, 1);
    idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
  };
  for (const t of tramos) {
    const n = t.recto ? Math.floor(t.len / (anchoNombre + HUECO_MIN_LED)) : 0;
    if (!n) {
      const pasos = t.recto ? 1 : 16;
      for (let i = 0; i < pasos; i++) quad(t.at(i / pasos), t.at((i + 1) / pasos), 0, 0);
      continue;
    }
    const hueco = (t.len - n * anchoNombre) / n;
    let s = 0;
    const a = (d) => t.at(d / t.len);
    for (let i = 0; i < n; i++) {
      quad(a(s), a(s + hueco / 2), 0, 0);
      s += hueco / 2;
      quad(a(s), a(s + anchoNombre), 0, 1);
      s += anchoNombre;
      quad(a(s), a(s + hueco / 2), 0, 0);
      s += hueco / 2;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function materialNombre() {
  return new THREE.MeshBasicMaterial({ map: texturaNombre().tex, side: THREE.DoubleSide, toneMapped: false });
}

// Pasillos alineados radialmente en todas las filas.
function isAisle(p) {
  if (p.kind === 'long') return [-14, -7, 0, 7, 14].some((x) => Math.abs(p.x - x) < 0.6);
  if (p.kind === 'short') return [-5, 5].some((z) => Math.abs(p.z - z) < 0.6);
  return Math.abs(p.u - 0.5) < 0.06;
}

// ---------- Texturas ----------
function canvasTex(w, h, draw, repeat = false) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = THREE.RepeatWrapping;
  return t;
}

function ribbonTex(text, bg0, bg1, fg = '#ffffff') {
  return canvasTex(1024, 64, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, bg0); g.addColorStop(0.5, bg1); g.addColorStop(1, bg0);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg;
    ctx.font = 'bold 30px system-ui, Segoe UI, sans-serif';
    ctx.textBaseline = 'middle';
    const items = text.split('|');
    const step = w / items.length;
    items.forEach((t, i) => {
      ctx.textAlign = 'center';
      ctx.fillText(t.trim(), step * i + step / 2, h / 2 + 2);
    });
  }, true);
}

function suitesTex() {
  return canvasTex(512, 64, (ctx, w, h) => {
    ctx.fillStyle = '#1a1c22'; ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) {
      const warm = 120 + Math.random() * 90;
      const g = ctx.createLinearGradient(0, 8, 0, h - 8);
      g.addColorStop(0, `rgb(${warm + 40},${warm},${warm * 0.6})`);
      g.addColorStop(1, `rgb(${warm * 0.6},${warm * 0.45},${warm * 0.3})`);
      ctx.fillStyle = g;
      ctx.fillRect(x + 4, 10, 56, h - 18);
    }
  }, true);
}

function scoreboardTex() {
  return canvasTex(512, 300, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#0b2a6b'); g.addColorStop(1, '#14a39a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(20, 120, w - 40, 150);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = 'bold 54px system-ui, Segoe UI, sans-serif';
    ctx.fillText('VOLEIBOL', w / 2, 75);
    ctx.font = 'bold 30px system-ui, Segoe UI, sans-serif';
    ctx.fillText('LOCAL', 120, 170); ctx.fillText('VISITA', w - 120, 170);
    ctx.font = 'bold 80px system-ui, Segoe UI, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('0', 120, 250); ctx.fillText('0', w - 120, 250);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px system-ui, Segoe UI, sans-serif';
    ctx.fillText('SET 1', w / 2, 205);
  });
}

function bannerTex(title, sub, color) {
  return canvasTex(256, 512, (ctx, w, h) => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.beginPath(); ctx.arc(w / 2, h * 0.42, 80, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(w / 2, h * 0.42, 52, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w / 2 - 52, h * 0.42); ctx.quadraticCurveTo(w / 2, h * 0.32, w / 2 + 52, h * 0.42); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = 'bold 40px system-ui, Segoe UI, sans-serif';
    ctx.fillText(title, w / 2, 80);
    ctx.font = '600 26px system-ui, Segoe UI, sans-serif';
    ctx.fillText(sub, w / 2, h - 50);
  });
}

// ---------- Construcción ----------
const concrete = new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.95 });
const darkWall = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 1 });

function buildBowl(group) {
  const geos = [];
  // Barrera frontal
  geos.push(ring(0, 0.2, 0, 1.1));
  // Anillo inferior
  for (let i = 0; i < LOWER.rows; i++) {
    const d0 = 0.2 + i * LOWER.depth;
    geos.push(ring(d0, d0 + LOWER.depth, 0, LOWER.y0 + (i + 1) * LOWER.rise));
  }
  const lowerEnd = 0.2 + LOWER.rows * LOWER.depth;
  const concY = LOWER.y0 + LOWER.rows * LOWER.rise;
  const upperStart = lowerEnd + 2.5;
  // Pasillo (vomitorio) y frente del anillo superior
  geos.push(ring(lowerEnd, upperStart, 0, concY));
  const fasciaTop = 10.2;
  geos.push(ring(upperStart, upperStart + 0.3, concY, fasciaTop));
  const upper0 = upperStart + 0.3;
  for (let i = 0; i < UPPER.rows; i++) {
    const d0 = upper0 + i * UPPER.depth;
    geos.push(ring(d0, d0 + UPPER.depth, concY, fasciaTop - 0.6 + (i + 1) * UPPER.rise));
  }
  const upperEnd = upper0 + UPPER.rows * UPPER.depth;
  group.add(new THREE.Mesh(mergeGeometries(geos), concrete));

  const back = new THREE.Mesh(ring(upperEnd, upperEnd + 0.6, concY, CEILING), darkWall);
  group.add(back);

  // Cintas LED: barrera, frente del anillo superior y palcos
  const led = (tex, d, y0, y1, len) => {
    tex.repeat.set(1, 1);
    const m = new THREE.Mesh(strip(d, y0, y1, len), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false }));
    group.add(m);
  };
  // Banda al pie de las gradas: mismo recorrido y alto que antes, con el nombre de la academia
  const tramosBanda = perimeter(-0.01).segs.map((sg) => ({ len: sg.len, at: sg.at, recto: sg.at(0).kind !== 'arc' }));
  group.add(new THREE.Mesh(geometriaNombre(tramosBanda, 0.15, 1.0), materialNombre()));
  led(ribbonTex('BIENVENIDOS | LIGA NACIONAL | VOLEIBOL | 2026', '#7a0f14', '#d62828'), upperStart - 0.02, concY + 1.0, concY + 2.0, 26);
  led(suitesTex(), upperEnd - 0.02, CEILING - 6, CEILING - 3.8, 6);

  return { lowerEnd, upperStart, upper0, concY, fasciaTop };
}

function buildSeatsAndCrowd(group, bowl) {
  const seatGeo = mergeGeometries([
    new THREE.BoxGeometry(0.46, 0.08, 0.42).translate(0, 0.42, 0.02),
    new THREE.BoxGeometry(0.46, 0.45, 0.06).translate(0, 0.62, -0.2),
  ]);
  const bodyGeo = new THREE.CapsuleGeometry(0.17, 0.34, 2, 6).translate(0, 0.78, -0.02);
  const headGeo = new THREE.SphereGeometry(0.11, 8, 6).translate(0, 1.2, -0.02);

  const seats = [], people = [];
  const addRow = (d, y, fill, palette) => {
    perimeter(d).sample(0.55, (p) => {
      if (isAisle(p)) return;
      const rot = Math.atan2(p.nx, p.nz);
      seats.push({ x: p.x, y, z: p.z, rot, color: palette });
      if (Math.random() < fill) people.push({ x: p.x, y, z: p.z, rot });
    });
  };
  for (let i = 0; i < LOWER.rows; i++) {
    const d = 0.2 + i * LOWER.depth + 0.5;
    const y = LOWER.y0 + (i + 1) * LOWER.rise;
    addRow(d, y, 0.62 - i * 0.01, i < 4 ? 0xb3262e : 0x1f4fa0);
  }
  for (let i = 0; i < UPPER.rows; i++) {
    const d = bowl.upper0 + i * UPPER.depth + 0.5;
    const y = bowl.fasciaTop - 0.6 + (i + 1) * UPPER.rise;
    addRow(d, y, 0.4 - i * 0.012, 0x1f4fa0);
  }

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3(), c = new THREE.Color();

  const seatMesh = new THREE.InstancedMesh(seatGeo, new THREE.MeshStandardMaterial({ roughness: 0.7 }), seats.length);
  seats.forEach((s, i) => {
    q.setFromAxisAngle(up, s.rot);
    seatMesh.setMatrixAt(i, m.compose(v.set(s.x, s.y, s.z), q, one));
    seatMesh.setColorAt(i, c.setHex(s.color));
  });
  group.add(seatMesh);

  const shirts = [0xd62828, 0xffffff, 0x1b1b1b, 0xf2f2f2, 0xe8a66b, 0x1f9e93, 0x2b59c3, 0xd62828, 0x444a55, 0xffd166];
  const skins = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
  const body = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ roughness: 0.9 }), people.length);
  const head = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), people.length);
  people.forEach((p, i) => {
    q.setFromAxisAngle(up, p.rot + (Math.random() - 0.5) * 0.4);
    const sc = 0.9 + Math.random() * 0.2;
    m.compose(v.set(p.x, p.y, p.z), q, one.clone().setScalar(sc));
    body.setMatrixAt(i, m);
    head.setMatrixAt(i, m);
    body.setColorAt(i, c.setHex(shirts[(Math.random() * shirts.length) | 0]));
    head.setColorAt(i, c.setHex(skins[(Math.random() * skins.length) | 0]));
  });
  group.add(body, head);
}

function buildFloorside(group) {
  // Suelo del pabellón alrededor de la zona libre
  const apron = new THREE.Mesh(
    new THREE.ShapeGeometry(rrShape(BASE.a + 0.2, BASE.b + 0.2, BASE.r + 0.2), 12),
    new THREE.MeshStandardMaterial({ color: 0x2b3036, roughness: 0.9 })
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.005;
  apron.receiveShadow = true;
  group.add(apron);

  // Vallas publicitarias LED alrededor de la zona libre
  const adMat = materialNombre();
  const boardBody = new THREE.MeshStandardMaterial({ color: 0x111418 });
  const board = (len, x, z, rotY) => {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.25), boardBody);
    box.position.y = 0.45;
    // Mismo tamaño (len × 0,8 m) y posición que antes; el nombre se reparte a lo largo del panel
    const recta = [{ len, recto: true, at: (t) => ({ x: -len / 2 + len * t, z: 0 }) }];
    const face = new THREE.Mesh(geometriaNombre(recta, -0.4, 0.4), adMat);
    face.position.set(0, 0.45, 0.13);
    g.add(box, face);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    group.add(g);
  };
  board(26, 0, 9.4, Math.PI);       // lateral cercano
  board(16, 14, 0, -Math.PI / 2);   // fondos
  board(16, -14, 0, Math.PI / 2);

  // Mesa de anotadores y banquillos (lateral lejano)
  const tableMat = new THREE.MeshStandardMaterial({ color: 0x0b2a6b, roughness: 0.6 });
  const table = new THREE.Mesh(new THREE.BoxGeometry(4, 0.8, 0.8), tableMat);
  table.position.set(0, 0.4, -9.2);
  group.add(table);
  const tableFace = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 0.6),
    new THREE.MeshBasicMaterial({ map: ribbonTex('ANOTADOR | VOLEIBOL', '#0b2a6b', '#1f6fd1'), toneMapped: false })
  );
  tableFace.position.set(0, 0.42, -8.79);
  group.add(tableFace);

  const chairGeo = mergeGeometries([
    new THREE.BoxGeometry(0.45, 0.06, 0.45).translate(0, 0.45, 0),
    new THREE.BoxGeometry(0.45, 0.5, 0.05).translate(0, 0.7, -0.2),
    new THREE.BoxGeometry(0.05, 0.45, 0.05).translate(0, 0.22, 0),
  ]);
  const chairPos = [];
  for (const s of [-1, 1]) for (let i = 0; i < 9; i++) chairPos.push([s * (4 + i * 0.6), -9.6]);
  for (let i = 0; i < 4; i++) chairPos.push([-1.2 + i * 0.8, -9.9]);
  const chairs = new THREE.InstancedMesh(chairGeo, new THREE.MeshStandardMaterial({ color: 0x1b1b1b }), chairPos.length);
  const m = new THREE.Matrix4();
  chairPos.forEach(([x, z], i) => chairs.setMatrixAt(i, m.makeTranslation(x, 0, z)));
  group.add(chairs);
  // La escalera del árbitro viene en models/net_system.glb (Blender)
}

function buildOverhead() {
  const g = new THREE.Group();
  g.name = 'techo';

  // Techo
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(120, 100), new THREE.MeshBasicMaterial({ color: 0x07080b }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = CEILING;
  g.add(ceil);

  // Estructura de cerchas
  const pts = [];
  const X = 50, Z = 42, step = 4, y1 = CEILING - 1.2, y2 = CEILING - 3;
  for (let x = -X; x <= X; x += step) pts.push(x, y1, -Z, x, y1, Z, x, y2, -Z, x, y2, Z);
  for (let z = -Z; z <= Z; z += step) pts.push(-X, y1, z, X, y1, z);
  for (let x = -X; x < X; x += step) for (let z = -Z; z <= Z; z += step * 2) {
    pts.push(x, y1, z, x + step, y2, z, x, y2, z, x + step, y1, z);
  }
  const truss = new THREE.BufferGeometry();
  truss.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.LineSegments(truss, new THREE.LineBasicMaterial({ color: 0x3b4250 })));

  // Focos
  const lamps = [];
  for (let x = -30; x <= 30; x += 6) for (let z = -22; z <= 22; z += 5.5) lamps.push([x, z]);
  const lampMesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.35, 0.25, 0.3, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff6e0, toneMapped: false }),
    lamps.length
  );
  const m = new THREE.Matrix4();
  lamps.forEach(([x, z], i) => lampMesh.setMatrixAt(i, m.makeTranslation(x, y2 - 0.3, z)));
  g.add(lampMesh);

  // Marcador central (cubo de 4 caras)
  const jumbo = new THREE.Group();
  const W = 6, H = 3.6;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W, H + 0.6, W), new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 0.5 }));
  jumbo.add(frame);
  const tex = scoreboardTex();
  for (let i = 0; i < 4; i++) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.3, H - 0.2), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    const ang = (i * Math.PI) / 2;
    face.position.set(Math.sin(ang) * (W / 2 + 0.01), 0.1, Math.cos(ang) * (W / 2 + 0.01));
    face.rotation.y = ang;
    jumbo.add(face);
  }
  const ringTex = ribbonTex('VOLEIBOL | SET POINT', '#7a0f14', '#d62828');
  for (const y of [-(H / 2 + 0.55), H / 2 + 0.55]) {
    const ringBox = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.5, W * 0.8), new THREE.MeshBasicMaterial({ map: ringTex, toneMapped: false }));
    ringBox.position.y = y;
    jumbo.add(ringBox);
  }
  jumbo.position.y = 18;
  const cables = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-2.5, 20.5, -2.5), new THREE.Vector3(-2.5, CEILING, -2.5),
    new THREE.Vector3(2.5, 20.5, 2.5), new THREE.Vector3(2.5, CEILING, 2.5),
    new THREE.Vector3(-2.5, 20.5, 2.5), new THREE.Vector3(-2.5, CEILING, 2.5),
    new THREE.Vector3(2.5, 20.5, -2.5), new THREE.Vector3(2.5, CEILING, -2.5),
  ]);
  g.add(new THREE.LineSegments(cables, new THREE.LineBasicMaterial({ color: 0x555b66 })));
  g.add(jumbo);

  // Pancartas colgantes en los fondos
  const banners = [
    ['CAMPEONES', 'TEMPORADA 2024', '#0b2a6b'],
    ['CAMPEONES', 'TEMPORADA 2025', '#1f9e93'],
    ['FINALISTAS', 'COPA 2023', '#7a0f14'],
    ['CAMPEONES', 'COPA 2026', '#0b2a6b'],
  ];
  banners.forEach(([t, s, col], i) => {
    for (const side of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.8), new THREE.MeshBasicMaterial({ map: bannerTex(t, s, col), side: THREE.DoubleSide }));
      b.position.set(side * 24, 19, -7.5 + i * 5);
      b.rotation.y = -side * Math.PI / 2;
      g.add(b);
    }
  });

  return g;
}

/**
 * Crea el pabellón decorativo.
 * @returns {{ group: THREE.Group, overhead: THREE.Group }}
 */
export function createArena() {
  const group = new THREE.Group();
  group.name = 'pabellon';
  buildFloorside(group);
  const bowl = buildBowl(group);
  buildSeatsAndCrowd(group, bowl);
  const overhead = buildOverhead();
  group.add(overhead);
  return { group, overhead };
}
