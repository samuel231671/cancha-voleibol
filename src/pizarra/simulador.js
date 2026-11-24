// Controlador de la simulación de recepción: un solo estado y un solo reloj para las dos
// vistas (Arena 3D y Pizarra 2D). Cambiar de vista no toca la jugada ni el instante.
import { construirJugada } from './play.js';
import { SISTEMAS, tituloRotacion } from './rotations.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toFixed(2).replace('.', ',');
const CLAVE = 'simulacion.recepcion';

/**
 * @param {{ arena: import('./arena3d.js').SimulacionArena, pizarra: import('./board2d.js').Pizarra2D,
 *           onVista?: (vista: '3d'|'2d') => void }} o
 */
export function crearSimulador({ arena, pizarra, onVista }) {
  const state = { sistema: '5-1', rotacion: 1, destino: 'centro', t: 0, playing: false, vel: 1, vista: '3d', flechas: true, zonas: true, sel: null };
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || '{}');
    if (SISTEMAS[g.sistema]) state.sistema = g.sistema;
    if (g.rotacion >= 1 && g.rotacion <= 6) state.rotacion = g.rotacion;
    if (['izquierda', 'centro', 'derecha'].includes(g.destino)) state.destino = g.destino;
    if (g.vista === '2d' || g.vista === '3d') state.vista = g.vista;
    if (typeof g.flechas === 'boolean') state.flechas = g.flechas;
    if (typeof g.zonas === 'boolean') state.zonas = g.zonas;
  } catch {}
  const pedida = new URLSearchParams(location.search).get('vista');
  if (pedida === '2d' || pedida === '3d') state.vista = pedida;
  const guardar = () => {
    try {
      const { sistema, rotacion, destino, vista, flechas, zonas } = state;
      localStorage.setItem(CLAVE, JSON.stringify({ sistema, rotacion, destino, vista, flechas, zonas }));
    } catch {}
  };

  let escena = null;

  // ---------- Selección de jugador (compartida) ----------
  function seleccionar(id) {
    state.sel = id && id === state.sel ? null : id;
    arena.seleccionar(state.sel);
    pizarra.seleccionar(state.sel);
    const ficha = $('ficha');
    if (state.sel) {
      const j = escena.jugadores.find((x) => x.id === state.sel);
      $('ficha-texto').innerHTML = j.explicacion.replace(/^(\S+( \(entra por C\d\))?)/, '<b>$1</b>');
    }
    ficha.classList.toggle('on', !!state.sel);
  }
  arena.onSeleccion = seleccionar;
  pizarra.onSeleccion = seleccionar;

  // ---------- Carga (cancela la jugada anterior) ----------
  function cargar() {
    escena = construirJugada(state);
    state.t = 0;
    state.playing = false;
    state.sel = null;
    $('ficha').classList.remove('on');
    arena.cargar(escena);
    pizarra.cargar(escena);
    actualizarInfo();
    sincronizarControles();
    render();
    guardar();
  }

  function actualizarInfo() {
    const e = escena;
    const colJ = e.jugadores.find((j) => j.esColocador);
    $('chip-coloca').textContent = `${e.colocador} (${colJ.fila})`;
    $('chip-recibe').textContent = `${e.receptor.id} · ${e.destino}`;
    $('titulo-rotacion').textContent = `${e.sistema} · ${e.titulo}`;
    $('desc-sistema').textContent = SISTEMAS[e.sistema].descripcion;
    $('info-coloca').innerHTML = `${e.colocador} <small>${colJ.fila}, zona ${colJ.zona}</small>`;
    $('info-recibe').innerHTML = `${e.receptor.id} <small>${e.receptor.reemplaza ? `(por ${e.receptor.reemplaza}) ` : ''}saque a la ${e.destino}</small>`;
    const plan = $('planilla');
    plan.innerHTML = '';
    for (const z of [4, 3, 2, 5, 6, 1]) {
      const j = e.jugadores.find((x) => x.zona === z);
      const d = document.createElement('div');
      d.innerHTML = j.reemplaza ? `<b>${z}</b><span class="lib">L por ${j.reemplaza}</span>` : `<b>${z}</b><span>${j.id}</span>`;
      plan.appendChild(d);
    }
    const L = e.legalidad;
    const legal = $('legal');
    legal.classList.toggle('mal', !L.legal);
    legal.innerHTML = L.legal
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>
         <span>Formación legal en el golpe de saque: cada delantero está delante de su zaguero (4–5, 3–6, 2–1) y cada fila respeta su orden lateral. Margen mínimo ${fmt(L.margenMinimo)} m entre los pies.</span>`
      : `<span>Formación ilegal: ${L.comprobaciones.filter((c) => !c.legal).map((c) => c.texto).join(', ')}.</span>`;
    const pasos = $('pasos');
    pasos.innerHTML = '';
    for (const p of e.pasos) { const s = document.createElement('span'); s.textContent = p.nombre; pasos.appendChild(s); }
    $('tiempo').max = e.duracion;
  }

  function sincronizarControles() {
    const sel = $('rotacion');
    sel.innerHTML = '';
    for (let r = 1; r <= 6; r++) {
      const o = document.createElement('option');
      o.value = r;
      o.textContent = tituloRotacion(state.sistema, r);
      sel.appendChild(o);
    }
    sel.value = state.rotacion;
    for (const b of document.querySelectorAll('[data-sistema]')) b.classList.toggle('active', b.dataset.sistema === state.sistema);
    for (const b of document.querySelectorAll('[data-destino]')) b.classList.toggle('active', b.dataset.destino === state.destino);
    for (const b of document.querySelectorAll('[data-vista]')) b.classList.toggle('active', b.dataset.vista === state.vista);
    for (const b of document.querySelectorAll('[data-vel]')) b.classList.toggle('active', Number(b.dataset.vel) === state.vel);
    $('ver-flechas').checked = state.flechas;
    $('ver-zonas2d').checked = state.zonas;
  }

  // ---------- Render (las dos vistas usan el mismo instante) ----------
  let iconoPausa = null;
  function render() {
    const e = escena, t = state.t;
    const { contacto: tC, recepcion: tR, colocacion: tS } = e.eventos;
    if (state.vista === '3d') arena.update(t); else pizarra.render(t);

    $('fase').textContent = e.faseEn(t);
    $('chip-recibe-txt').textContent = t >= tR ? 'Recibió' : 'Recibe';
    let flash = '';
    if (t >= tC && t < tC + 0.7) flash = 'Contacto de saque';
    else if (t >= tR && t < tR + 0.7) flash = `Primer toque · ${e.receptor.id}`;
    else if (t >= tS && t < tS + 0.9) flash = `El pase llega a ${e.colocador}`;
    const fl = $('flash');
    if (flash) fl.textContent = flash;
    fl.classList.toggle('on', !!flash);

    $('tiempo').value = t;
    $('reloj').textContent = `${fmt(t)} s`;
    const pasos = $('pasos').children;
    e.pasos.forEach((p, i) => pasos[i]?.classList.toggle('on', Math.abs(t - p.t) < 0.02 || (i === e.pasos.length - 1 && t >= p.t)));
    $('pausa').disabled = !state.playing && (t === 0 || t >= e.duracion);
    if (iconoPausa !== state.playing) {
      iconoPausa = state.playing;
      $('pausa').setAttribute('aria-label', state.playing ? 'Pausar' : 'Continuar');
      $('pausa').title = state.playing ? 'Pausar (espacio)' : 'Continuar (espacio)';
      $('pausa').innerHTML = state.playing
        ? '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7z"/></svg>';
    }
  }

  function setVista(v) {
    state.vista = v;
    arena.visible = v === '3d';
    document.body.classList.toggle('vista-2d', v === '2d');
    $('vista2d').hidden = v !== '2d';
    sincronizarControles();
    render();
    onVista?.(v);
    guardar();
  }

  // ---------- Controles ----------
  for (const b of document.querySelectorAll('[data-vista]')) b.addEventListener('click', () => setVista(b.dataset.vista));
  for (const b of document.querySelectorAll('[data-sistema]')) b.addEventListener('click', () => { state.sistema = b.dataset.sistema; cargar(); });
  for (const b of document.querySelectorAll('[data-destino]')) b.addEventListener('click', () => { state.destino = b.dataset.destino; cargar(); });
  $('rotacion').addEventListener('change', (ev) => { state.rotacion = Number(ev.target.value); cargar(); });
  $('rot-siguiente').addEventListener('click', () => { state.rotacion = (state.rotacion % 6) + 1; cargar(); });
  $('rot-anterior').addEventListener('click', () => { state.rotacion = ((state.rotacion + 4) % 6) + 1; cargar(); });

  const simular = () => { state.t = 0; state.playing = true; render(); };
  $('simular').addEventListener('click', simular);
  $('repetir').addEventListener('click', simular);  // conserva sistema, rotación y destino
  $('pausa').addEventListener('click', () => {
    if (state.t >= escena.duracion) return simular();
    state.playing = !state.playing;
    render();
  });
  function irAPaso(dir) {
    const ts = escena.pasos.map((p) => p.t);
    const d = dir > 0 ? ts.find((x) => x > state.t + 0.005) : [...ts].reverse().find((x) => x < state.t - 0.005);
    state.playing = false;
    state.t = d ?? (dir > 0 ? escena.duracion : 0);
    render();
  }
  $('paso').addEventListener('click', () => irAPaso(1));
  $('paso-atras').addEventListener('click', () => irAPaso(-1));
  $('tiempo').addEventListener('input', (ev) => { state.playing = false; state.t = Number(ev.target.value); render(); });
  for (const b of document.querySelectorAll('[data-vel]')) b.addEventListener('click', () => { state.vel = Number(b.dataset.vel); sincronizarControles(); });
  $('ver-flechas').addEventListener('change', (ev) => {
    state.flechas = ev.target.checked;
    arena.setFlechas(state.flechas);
    pizarra.setVisibilidad({ flechas: state.flechas });
    guardar();
  });
  $('ver-zonas2d').addEventListener('change', (ev) => { state.zonas = ev.target.checked; pizarra.setVisibilidad({ zonas: state.zonas }); render(); guardar(); });
  $('ficha-cerrar').addEventListener('click', () => seleccionar(null));
  $('abrir-info').addEventListener('click', () => $('info').classList.toggle('abierta'));
  $('cerrar-info').addEventListener('click', () => $('info').classList.remove('abierta'));

  window.addEventListener('keydown', (ev) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.target.closest?.('select, input, textarea')) return;
    if (ev.key === ' ') { ev.preventDefault(); $('pausa').disabled ? simular() : $('pausa').click(); }
    else if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
      ev.preventDefault();
      state.playing = false;
      state.t = Math.min(escena.duracion, Math.max(0, state.t + (ev.key === 'ArrowRight' ? 1 : -1) / 30));
      render();
    } else if (ev.key === 'v' || ev.key === 'V') setVista(state.vista === '3d' ? '2d' : '3d');
  });

  // ---------- Reloj ----------
  function tick(dt) {
    if (state.playing) {
      state.t = Math.min(escena.duracion, state.t + dt * state.vel);
      if (state.t >= escena.duracion) state.playing = false;
      render();
    } else if (state.vista === '3d') {
      arena.update(state.t);
    }
  }

  arena.setFlechas(state.flechas);
  pizarra.setVisibilidad({ flechas: state.flechas, zonas: state.zonas });
  cargar();
  setVista(state.vista);

  return {
    state, tick, cargar, render, setVista, seleccionar,
    get escena() { return escena; },
  };
}
