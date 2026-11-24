import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createCourt, DIM } from './court.js';
import { createArena, standDistance, standSurface, STAND_LIMIT } from './arena.js';
import { createBall, BALL } from './ball.js';
import { SimulacionArena } from './pizarra/arena3d.js';
import { Pizarra2D } from './pizarra/board2d.js';
import { crearSimulador } from './pizarra/simulador.js';

// ---------- Escena ----------
const container = document.getElementById('scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06080b);
scene.fog = new THREE.Fog(0x06080b, 55, 140);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
container.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
container.appendChild(labelRenderer.domElement);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
const controls = new OrbitControls(camera, labelRenderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.minDistance = 0.35; // permite acercarse a los jugadores y al balón
controls.maxDistance = 60;

// Luces: el pabellón queda en penumbra y la cancha bien iluminada
scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x101318, 0.55));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(-8, 24, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 60 });
sun.shadow.bias = -0.0005;
scene.add(sun);

const courtLight = new THREE.SpotLight(0xfff4e0, 3.2, 0, 0.62, 0.55, 0);
courtLight.position.set(0, 24, 0);
courtLight.target.position.set(0, 0, 0);
scene.add(courtLight, courtLight.target);

// ---------- Pabellón (decorativo) ----------
const arena = createArena();
scene.add(arena.group);

// ---------- Cancha ----------
const state = { category: 'hombres' };
const court = createCourt({ category: state.category });
scene.add(court.group);

// ---------- Balón ----------
// Es el único balón de la escena: lo mueve la simulación de recepción.
const ball = createBall();
// Reflejo ambiental suave solo para el balón
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  ball.material.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  ball.material.envMapIntensity = 0.7;
  pmrem.dispose();
}
scene.add(ball);

// ---------- Etiquetas ----------
function label(text, pos, cls = '') {
  const el = document.createElement('div');
  el.className = `tag ${cls}`;
  el.textContent = text;
  const obj = new CSS2DObject(el);
  obj.position.copy(pos);
  return obj;
}

const hx = DIM.length / 2, hz = DIM.width / 2, F = DIM.freeZone;
const zones = new THREE.Group();
for (const s of [-1, 1]) {
  zones.add(label('Zona de frente', new THREE.Vector3(s * 1.5, 0, 0), 'zone'));
  zones.add(label('Zona de defensa', new THREE.Vector3(s * 6, 0, 0), 'zone'));
  zones.add(label('Zona de saque', new THREE.Vector3(s * (hx + 2), 0, s * 2), 'zone'));
  zones.add(label('Línea de ataque', new THREE.Vector3(s * DIM.attack, 0, hz - 1), 'line'));
  zones.add(label('Línea de fondo', new THREE.Vector3(s * hx, 0, -hz + 1.2), 'line'));
}
zones.add(label('Zona libre (mín. 3 m)', new THREE.Vector3(-4, 0, hz + F / 2), 'zone'));
zones.add(label('Banda', new THREE.Vector3(-6, 0, -hz), 'line'));
zones.add(label('Línea central', new THREE.Vector3(0, 0, -hz + 1.2), 'line'));
const netTag = label('Red', new THREE.Vector3(0, 0, -2.5), 'obj');
const antTag = label('Antena', new THREE.Vector3(0, 0, hz), 'obj');
zones.add(netTag, antTag);
zones.add(label('Poste', new THREE.Vector3(0, 2.75, -(hz + DIM.postOffset)), 'obj'));
scene.add(zones);

// Actualiza la red y las etiquetas que dependen de su altura
function updateNet() {
  const h = DIM.netHeight[state.category];
  court.setNetHeight(h);

  netTag.position.y = h + 0.35;
  antTag.position.y = h + DIM.antennaAbove + 0.25;
}

// ---------- Interfaz ----------
function setLabelsVisible(group, visible) {
  group.visible = visible;
  group.traverse((o) => { if (o.isCSS2DObject) o.visible = visible; });
}

document.querySelectorAll('[data-category]').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.category = btn.dataset.category;
    document.querySelectorAll('[data-category]').forEach((b) => b.classList.toggle('active', b === btn));
    updateNet();
  });
});

// «Mostrar partes de la cancha»: agrupa los rótulos (Antena, Zona de frente, Línea de fondo…)
const toggleZones = document.getElementById('toggle-zones');
toggleZones.addEventListener('change', (e) => setLabelsVisible(zones, e.target.checked));
// En pantallas estrechas empiezan ocultos para despejar la jugada
if (innerWidth < 760) { toggleZones.checked = false; setLabelsVisible(zones, false); }

const VIEWS = {
  superior: { pos: [-3, 30, 0.01], target: [-3, 0, 0] },
  lateral: { pos: [4, 3.2, 12.5], target: [0, 1.2, 0] },
  fondo: { pos: [-19, 4.5, 0], target: [0, 1.4, 0] },
};

// Cámaras que se encuadran solas según la pantalla: siempre se ven el sacador,
// la trayectoria del balón y los seis receptores, sin quedar debajo de los controles.
const SACADOR_3D = [[-10.4, 0, 2.9], [-10.4, 3.3, 2.9]];
const ENCUADRES = {
  // Elevada, detrás del equipo receptor (mitad x > 0), mirando hacia el sacador
  tactica: {
    dir: new THREE.Vector3(1, 0.62, 0).normalize(), target: new THREE.Vector3(-0.5, 0.4, 0),
    puntos: [...SACADOR_3D, [9.3, 0, 4.7], [9.3, 0, -4.7], [0, 0, 4.7], [0, 0, -4.7], [0, 2.6, 4.7], [0, 2.6, -4.7], [9.3, 2, 4.7], [9.3, 2, -4.7]],
  },
  // La diagonal de la captura (desde la esquina del saque)
  diagonal: {
    dir: new THREE.Vector3(-23, 12, 18).normalize(), target: new THREE.Vector3(0.5, 0.6, 0),
    puntos: [...SACADOR_3D, [9.3, 0, 4.7], [9.3, 0, -4.7], [-9.3, 0, 4.7], [-9.3, 0, -4.7], [9.3, 2, 4.7], [9.3, 2, -4.7]],
  },
};
const _cam = new THREE.PerspectiveCamera();
const _p = new THREE.Vector3();
function encuadre(nombre) {
  const E = ENCUADRES[nombre];
  const H = container.clientHeight || 1;
  const dock = document.getElementById('dock')?.offsetHeight ?? 0;
  const arriba = 1 - (2 * 58) / H;                 // deja libre la franja de rótulos
  const abajo = -1 + (2 * (dock + 18)) / H;        // y la de los controles
  _cam.copy(camera);
  const cabe = (d) => {
    _cam.position.copy(E.target).addScaledVector(E.dir, d);
    _cam.lookAt(E.target);
    _cam.updateMatrixWorld();
    return E.puntos.every((q) => {
      _p.set(...q).project(_cam);
      return Math.abs(_p.x) <= 0.93 && _p.y <= arriba && _p.y >= abajo && _p.z < 1;
    });
  };
  let lo = 4, hi = 120;
  for (let i = 0; i < 32; i++) { const m = (lo + hi) / 2; if (cabe(m)) hi = m; else lo = m; }
  return { pos: E.target.clone().addScaledVector(E.dir, hi).toArray(), target: E.target.toArray() };
}

let tween = null;
let vistaActual = 'diagonal', camaraMovida = false;
function goTo(name, instant = false) {
  const v = ENCUADRES[name] ? encuadre(name) : VIEWS[name];
  vistaActual = name;
  camaraMovida = false;
  const to = { pos: new THREE.Vector3(...v.pos), target: new THREE.Vector3(...v.target) };
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  if (instant) {
    camera.position.copy(to.pos);
    controls.target.copy(to.target);
    return;
  }
  tween = { from: { pos: camera.position.clone(), target: controls.target.clone() }, to, t0: performance.now(), dur: 900 };
}
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => goTo(b.dataset.view)));
controls.addEventListener('start', () => { tween = null; camaraMovida = true; });

// ---------- Colisión de cámara con el graderío ----------
const CAM_MARGIN = 0.6;
function constrainCamera() {
  // El punto de mira se queda sobre la pista
  const t = controls.target;
  t.x = THREE.MathUtils.clamp(t.x, -14, 14);
  t.z = THREE.MathUtils.clamp(t.z, -10, 10);
  t.y = THREE.MathUtils.clamp(t.y, 0, 6);

  const p = camera.position;
  // No atravesar la pared del fondo: acercar hacia el centro
  for (let i = 0; i < 40 && standDistance(p.x, p.z) > STAND_LIMIT; i++) {
    p.x *= 0.97;
    p.z *= 0.97;
  }
  // Mantenerse por encima de escalones y público (mirando también las filas vecinas)
  const d = standDistance(p.x, p.z);
  const floor = Math.max(standSurface(d - 0.4), standSurface(d), standSurface(d + 0.4));
  if (p.y < floor + CAM_MARGIN) p.y = floor + CAM_MARGIN;
  if (p.y < 0.4) p.y = 0.4;
}

// ---------- Menú plegable ----------
const panel = document.getElementById('panel');
const panelToggle = document.getElementById('panel-toggle');
function setPanelCollapsed(collapsed) {
  panel.classList.toggle('collapsed', collapsed);
  panelToggle.setAttribute('aria-expanded', String(!collapsed));
  panelToggle.title = collapsed ? 'Mostrar menú (M)' : 'Ocultar menú (M)';
  try { localStorage.setItem('cancha.menu', collapsed ? 'closed' : 'open'); } catch {}
}
let savedMenu = null;
try { savedMenu = localStorage.getItem('cancha.menu'); } catch {}
setPanelCollapsed(savedMenu ? savedMenu === 'closed' : window.innerWidth < 600);
panelToggle.addEventListener('click', () => setPanelCollapsed(!panel.classList.contains('collapsed')));

const VIEW_KEYS = { 1: 'tactica', 2: 'diagonal', 3: 'superior', 4: 'lateral', 5: 'fondo' };
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea')) return;
  if (e.key === 'm' || e.key === 'M') setPanelCollapsed(!panel.classList.contains('collapsed'));
  else if (VIEW_KEYS[e.key]) goTo(VIEW_KEYS[e.key]);
});

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ---------- Bucle ----------
function resize() {
  const { clientWidth: w, clientHeight: h } = container;
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', () => {
  resize();
  // Si la cámara no se tocó, se vuelve a encuadrar para la nueva pantalla
  if (!camaraMovida && ENCUADRES[vistaActual]) goTo(vistaActual, true);
});

// ---------- Simulación de recepción (arena 3D + pizarra 2D, un solo reloj) ----------
const dock = document.getElementById('dock');
new ResizeObserver(() => document.documentElement.style.setProperty('--dock-h', `${dock.offsetHeight + 12}px`)).observe(dock);
const simArena = new SimulacionArena({ scene, balon: ball, camara: camera, dom: labelRenderer.domElement, onSeleccion: () => {} });
const pizarra2d = new Pizarra2D(document.getElementById('pizarra'), { onSeleccion: () => {} });
const sim = crearSimulador({ arena: simArena, pizarra: pizarra2d });

let previo = performance.now();
function animate(now) {
  const dt = Math.min(0.05, (now - previo) / 1000);
  previo = now;
  sim.tick(dt);
  if (sim.state.vista === '2d') { requestAnimationFrame(animate); return; }
  if (tween) {
    const k = ease(Math.min(1, (now - tween.t0) / tween.dur));
    camera.position.lerpVectors(tween.from.pos, tween.to.pos, k);
    controls.target.lerpVectors(tween.from.target, tween.to.target, k);
    if (k === 1) tween = null;
  }
  controls.update();
  constrainCamera();
  // El techo y el marcador taparían la vista cenital
  arena.overhead.visible = camera.position.y < 16;
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  requestAnimationFrame(animate);
}

resize();
updateNet();
document.documentElement.style.setProperty('--dock-h', `${dock.offsetHeight + 12}px`);
// En teléfono vertical arranca con la cámara táctica; en escritorio, con la diagonal
goTo(innerWidth < innerHeight ? 'tactica' : 'diagonal', true);
requestAnimationFrame(animate);

// Acceso para depuración / próximas fases de la app
window.voley = { scene, camera, controls, renderer, court, DIM, ball, BALL, sim, simArena, pizarra2d, goTo };
