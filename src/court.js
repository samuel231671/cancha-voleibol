// Cancha de voleibol con medidas oficiales FIVB (unidades: metros).
// Ejes: X = largo (18 m, la red está en x = 0), Z = ancho (9 m), Y = altura.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Red, postes, protectores y escalera del árbitro modelados en Blender
// (ver blender/net_system.py). Si el modelo no carga, se usa la versión simple.
const NET_MODEL_URL = new URL('../models/net_system.glb', import.meta.url).href;

export const DIM = {
  length: 18,
  width: 9,
  line: 0.05,            // grosor de líneas: 5 cm
  attack: 3,             // línea de ataque a 3 m del eje de la línea central
  freeZone: 3,           // zona libre mínima: 3 m
  netHeight: { hombres: 2.43, mujeres: 2.24 },
  netWidth: 1,           // alto de la malla
  netLength: 9.5,
  netMesh: 0.1,          // cuadros de 10 cm
  sideBand: 0.05,        // bandas laterales de 5 cm
  antennaLength: 1.8,
  antennaAbove: 0.8,     // sobresale 80 cm
  antennaRadius: 0.005,
  postOffset: 1,         // postes a 1 m de las bandas
  serviceMark: 0.15,     // marcas de saque de 15 cm
  serviceGap: 0.2,       // separadas 20 cm de la línea de fondo
  minCeiling: 7,
};

export const COLORS = {
  free: 0x1f9e93,
  court: 0xe8a66b,
  front: 0xd9894b,
  line: 0xffffff,
  post: 0x2b3a42,
  net: 0x1b1b1b,
};

const LINE_Y = 0.004;

function plane(w, d, color, y = 0) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  return m;
}

// Rectángulo de línea en el suelo, definido por sus bordes.
function lineRect(x0, x1, z0, z1, mat) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set((x0 + x1) / 2, LINE_Y, (z0 + z1) / 2);
  m.receiveShadow = true;
  return m;
}

function buildFloor() {
  const g = new THREE.Group();
  g.name = 'suelo';
  const { length: L, width: W, freeZone: F, attack: A } = DIM;

  g.add(plane(L + 2 * F, W + 2 * F, COLORS.free, 0));
  g.add(plane(L, W, COLORS.court, 0.001));
  // Zonas de frente (ataque) más oscuras
  for (const s of [-1, 1]) {
    const front = plane(A, W, COLORS.front, 0.002);
    front.position.x = s * A / 2;
    g.add(front);
  }
  g.add(buildCenterLogo());
  return g;
}

// Logo del club pintado en el suelo, centrado bajo la red.
// Orientación: la parte de arriba del escudo apunta a +Z (lateral de las vallas
// cercanas) y su derecha a -X.
const LOGO_URL = new URL('../assets/la_fortuna_logo.png', import.meta.url).href;
const LOGO_SIZE = 3.2;

function buildCenterLogo() {
  const tex = new THREE.TextureLoader().load(LOGO_URL);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  const geo = new THREE.PlaneGeometry(LOGO_SIZE, LOGO_SIZE);
  geo.rotateX(-Math.PI / 2); // tumbado en el suelo: arriba de la imagen -> -Z
  geo.rotateY(Math.PI);      // girado 180°: arriba -> +Z, derecha -> -X
  const logo = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 0.85 })
  );
  logo.name = 'logoCentral';
  logo.position.y = 0.003; // sobre la zona de frente, bajo las líneas
  logo.receiveShadow = true;
  return logo;
}

function buildLines() {
  const g = new THREE.Group();
  g.name = 'lineas';
  const mat = new THREE.MeshStandardMaterial({ color: COLORS.line, roughness: 0.6 });
  const { length: L, width: W, line: t, attack: A } = DIM;
  const hx = L / 2, hz = W / 2;

  // Las líneas forman parte de la cancha: se dibujan hacia dentro.
  g.add(lineRect(-hx, hx, -hz, -hz + t, mat));           // banda
  g.add(lineRect(-hx, hx, hz - t, hz, mat));             // banda
  g.add(lineRect(-hx, -hx + t, -hz, hz, mat));           // fondo
  g.add(lineRect(hx - t, hx, -hz, hz, mat));             // fondo
  g.add(lineRect(-t / 2, t / 2, -hz, hz, mat));          // central (eje bajo la red)

  for (const s of [-1, 1]) {
    // Línea de ataque: borde trasero a 3 m del eje central
    const x0 = s > 0 ? A - t : -A;
    const x1 = s > 0 ? A : -A + t;
    g.add(lineRect(x0, x1, -hz, hz, mat));

    // Prolongación discontinua: 5 trazos de 15 cm separados 20 cm (1,75 m)
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const a = hz + 0.2 + i * 0.35;
        const b = a + 0.15;
        g.add(side > 0 ? lineRect(x0, x1, a, b, mat) : lineRect(x0, x1, -b, -a, mat));
      }
    }

    // Zona de saque: marcas de 15 cm, a 20 cm detrás de la línea de fondo,
    // en la prolongación de las bandas.
    const m0 = hx + DIM.serviceGap;
    const m1 = m0 + DIM.serviceMark;
    const xa = s > 0 ? m0 : -m1;
    const xb = s > 0 ? m1 : -m0;
    g.add(lineRect(xa, xb, -hz, -hz + t, mat));
    g.add(lineRect(xa, xb, hz - t, hz, mat));
  }
  return g;
}

function antennaTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 18;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = i % 2 ? '#ffffff' : '#d62828';
    ctx.fillRect(0, i, 4, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildNet() {
  const g = new THREE.Group();
  g.name = 'red';
  const { netLength: NL, netWidth: NW, netMesh: M, width: W } = DIM;
  const hz = NL / 2;

  // Malla: cuadros de 10 cm (y local: 0 = borde superior, -1 = inferior)
  const pts = [];
  for (let z = -hz; z <= hz + 1e-6; z += M) pts.push(0, 0, z, 0, -NW, z);
  for (let y = 0; y <= NW + 1e-6; y += M) pts.push(0, -y, -hz, 0, -y, hz);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: COLORS.net, transparent: true, opacity: 0.75 })));

  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });

  // Banda superior (7 cm) e inferior (5 cm)
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.07, NL), white);
  top.position.y = -0.035;
  top.castShadow = true;
  g.add(top);
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.05, NL), white);
  bottom.position.y = -NW + 0.025;
  g.add(bottom);

  // Cable de tensión hasta los postes
  const postZ = W / 2 + DIM.postOffset;
  const cable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, postZ * 2, 6),
    new THREE.MeshStandardMaterial({ color: 0x444444 })
  );
  cable.rotation.x = Math.PI / 2;
  cable.position.y = -0.01;
  g.add(cable);

  // Bandas laterales (5 cm x 1 m) sobre las líneas de banda
  const antMat = new THREE.MeshStandardMaterial({ map: antennaTexture(), roughness: 0.4 });
  for (const s of [-1, 1]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.012, NW, DIM.sideBand), white);
    band.position.set(0, -NW / 2, s * (W / 2 - DIM.sideBand / 2));
    band.castShadow = true;
    g.add(band);

    // Antenas: 1,8 m, sobresalen 80 cm, en el borde exterior de las bandas
    const ant = new THREE.Mesh(
      new THREE.CylinderGeometry(DIM.antennaRadius * 2, DIM.antennaRadius * 2, DIM.antennaLength, 12),
      antMat
    );
    ant.position.set(0, -NW + DIM.antennaLength / 2, s * (W / 2));
    ant.castShadow = true;
    g.add(ant);
  }
  return g;
}

function buildPosts() {
  const g = new THREE.Group();
  g.name = 'postes';
  const mat = new THREE.MeshStandardMaterial({ color: COLORS.post, metalness: 0.4, roughness: 0.4 });
  const pad = new THREE.MeshStandardMaterial({ color: 0x14706a, roughness: 0.8 });
  const h = 2.55;
  for (const s of [-1, 1]) {
    const z = s * (DIM.width / 2 + DIM.postOffset);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h, 20), mat);
    post.position.set(0, h / 2, z);
    post.castShadow = true;
    g.add(post);
    const protector = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.9, 20), pad);
    protector.position.set(0, 0.95, z);
    protector.castShadow = true;
    g.add(protector);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 24), mat);
    base.position.set(0, 0.02, z);
    g.add(base);
  }
  return g;
}

/**
 * Crea la cancha completa.
 * @returns {{ group: THREE.Group, setNetHeight: (h:number)=>void, net: THREE.Group }}
 */
export function createCourt({ category = 'hombres' } = {}) {
  const group = new THREE.Group();
  group.name = 'cancha';
  group.add(buildFloor(), buildLines());

  let netNode = null;
  let netHeight = DIM.netHeight[category];
  const setNetHeight = (h) => {
    netHeight = h;
    if (netNode) netNode.position.y = h;
  };

  const useFallback = () => {
    netNode = buildNet();
    group.add(netNode, buildPosts());
    setNetHeight(netHeight);
  };

  new GLTFLoader().load(
    NET_MODEL_URL,
    (gltf) => {
      const model = gltf.scene;
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          // Logo del club: recorte nítido en lugar de mezcla transparente
          if (o.material.name === 'Logo') {
            o.castShadow = false;
            o.material.transparent = false;
            o.material.alphaTest = 0.5;
            o.material.map.anisotropy = 8;
            // Algo de brillo propio para que se lea aunque la cara quede en sombra
            o.material.emissiveMap = o.material.map;
            o.material.emissive.set(0xffffff);
            o.material.emissiveIntensity = 0.45;
            o.material.polygonOffset = true;
            o.material.polygonOffsetFactor = -1;
          }
        }
      });
      netNode = model.getObjectByName('NetAssembly');
      if (!netNode) { useFallback(); return; }
      group.add(model);
      setNetHeight(netHeight);
    },
    undefined,
    (err) => {
      console.warn('No se pudo cargar net_system.glb, se usa la red simple.', err);
      useFallback();
    }
  );

  return { group, setNetHeight };
}
