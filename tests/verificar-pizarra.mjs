// Verifica las 18 situaciones (3 sistemas × 6 rotaciones) con los 3 destinos de saque.
// Uso (desde la carpeta cancha/):  node tests/verificar-pizarra.mjs
import { construirJugada, posicionEn, ALTURAS, PLATAFORMA, SACADOR, MANOS_COLOCADOR, muestrearPoses, poseEn } from '../src/pizarra/play.js';
import { ordenRotacion, esDelantera } from '../src/pizarra/rotations.js';

const SISTEMAS = ['5-1', '6-2', '4-2'];
const DESTINOS = ['izquierda', 'centro', 'derecha'];
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
let fallos = 0, comprobaciones = 0;
const ok = (cond, msg) => { comprobaciones++; if (!cond) { fallos++; console.log('  ✗ ' + msg); } };

let separacionMinima = Infinity, peor = '';
for (const sistema of SISTEMAS) {
  for (let rot = 1; rot <= 6; rot++) {
    const receptores = new Set();
    for (const destino of DESTINOS) {
      const e = construirJugada({ sistema, rotacion: rot, destino });
      const tag = `${sistema} · ${e.titulo} · saque a la ${destino}`;
      const { contacto: tC, recepcion: tR, colocacion: tS, red: tRed } = e.eventos;
      const J = e.jugadores;

      // Seis jugadores propios, un colocador activo, un responsable del primer toque
      ok(J.length === 6 && new Set(J.map((j) => j.id)).size === 6, `${tag}: no hay 6 jugadores distintos`);
      ok(J.filter((j) => j.esColocador).length === 1, `${tag}: colocadores activos ≠ 1`);
      ok(J.filter((j) => j.esReceptor).length === 1, `${tag}: responsables del primer toque ≠ 1`);
      receptores.add(e.receptor.id);

      // Quién coloca según el sistema
      const col = J.find((j) => j.esColocador);
      if (sistema === '5-1') ok(col.id === 'COL', `${tag}: en 5-1 debe colocar COL`);
      if (sistema === '6-2') ok(!esDelantera(col.zona), `${tag}: en 6-2 debe colocar el zaguero`);
      if (sistema === '4-2') ok(esDelantera(col.zona), `${tag}: en 4-2 debe colocar el delantero`);

      // Líbero: solo plaza zaguera y reemplaza al central zaguero
      const L = J.find((j) => j.id === 'L');
      ok(L && !esDelantera(L.zona) && /^C[12]$/.test(L.reemplaza), `${tag}: líbero mal ubicado`);
      ok(J.filter((j) => j.id === 'L').length === 1, `${tag}: más de un líbero`);

      // Legalidad en el golpe de saque (regla 7.4) con margen evidente
      ok(e.legalidad.legal, `${tag}: formación ilegal`);
      ok(e.legalidad.evidente, `${tag}: margen insuficiente (${e.legalidad.margenMinimo.toFixed(2)} m)`);

      // Antes del contacto nadie se mueve; los desplazamientos empiezan en el contacto
      for (const j of J) {
        ok(j.segmentos.every((s) => s.t0 >= tC), `${tag}: ${j.id} se mueve antes del saque`);
        ok(d(posicionEn(j, tC - 0.001), j.inicio) < 1e-9, `${tag}: ${j.id} no está en su formación al saque`);
      }
      ok(d(posicionEn(col, tC + 0.4), col.inicio) > 0.05, `${tag}: el colocador no sale tras el contacto`);

      // El balón sale de la mano del sacador en el contacto
      const bC = e.balonEn(tC), mC = e.manoSacadorEn(tC);
      ok(d(bC.p, mC.p) < 1e-6 && Math.abs(bC.h - mC.h) < 1e-6, `${tag}: el balón no sale de la mano`);
      ok(e.balonEn(tRed).h > ALTURAS.red + 0.15, `${tag}: el saque no pasa la red`);

      // Primer contacto en la plataforma del receptor (delante de sus pies, hacia el saque);
      // segundo contacto en las manos del colocador
      const rec = e.receptor;
      const pr = posicionEn(rec, tR), bR = e.balonEn(tR);
      ok(Math.abs(d(bR.p, pr) - PLATAFORMA) < 0.03, `${tag}: el balón no llega a la plataforma del receptor`);
      ok(Math.abs(bR.h - ALTURAS.recepcion) < 1e-6, `${tag}: altura de recepción incorrecta`);
      const m = muestrearPoses(e);
      const poseR = poseEn(m, rec.id, tR);
      const angSaque = Math.atan2(SACADOR.mano[1] - pr[1], SACADOR.mano[0] - pr[0]);
      ok(poseR.estado === 'recepcion', `${tag}: el receptor no está en pose de recepción`);
      ok(Math.abs(Math.atan2(Math.sin(poseR.ang - angSaque), Math.cos(poseR.ang - angSaque))) < 0.05, `${tag}: el receptor no mira al saque`);
      const angBalon = Math.atan2(bR.p[1] - pr[1], bR.p[0] - pr[0]);
      ok(Math.abs(Math.atan2(Math.sin(poseR.ang - angBalon), Math.cos(poseR.ang - angBalon))) < 0.05, `${tag}: la plataforma no está delante del receptor`);
      ok(poseEn(m, col.id, tS).estado === 'manos', `${tag}: el colocador no tiene las manos altas al recibir el pase`);
      for (const j of J) ok(m.muestras.get(j.id).every((s, i) => i * m.dt >= tC || s.estado !== 'corre'), `${tag}: ${j.id} corre antes del saque`);
      ok(rec.segmentos[0].t1 <= tR - 0.05, `${tag}: el receptor llega tarde`);
      const pc = posicionEn(col, tS), bS = e.balonEn(tS);
      ok(d(bS.p, [pc[0] + MANOS_COLOCADOR[0], pc[1] + MANOS_COLOCADOR[1]]) < 0.03, `${tag}: el pase no llega a las manos del colocador`);
      ok(Math.abs(bS.h - ALTURAS.manosColocador) < 1e-6, `${tag}: el pase no llega a la altura de las manos`);
      ok(col.segmentos[0].t1 <= tS - 0.5, `${tag}: el colocador llega tarde a la zona de colocación`);

      // Los puntas no abandonan su carril antes de que el balón pase la red
      for (const j of J.filter((j) => (j.tipo === 'punta' || j.tipo === 'libero') && !j.esReceptor)) {
        const p = posicionEn(j, tRed);
        ok(d(p, j.inicio) <= 0.6, `${tag}: ${j.id} abandona su carril antes de saber quién recibe`);
      }

      // Dentro de la cancha y sin choques
      let sepEscena = Infinity, parEscena = '';
      for (let t = 0; t <= e.duracion; t += 0.05) {
        const P = J.map((j) => posicionEn(j, t));
        for (const p of P) ok(p[0] > -0.6 && p[0] < 9.6 && p[1] > 0.2 && p[1] < 9.6, `${tag}: jugador fuera de zona en t=${t.toFixed(2)}`);
        for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) {
          const s = d(P[a], P[b]);
          if (s < sepEscena) { sepEscena = s; parEscena = `${J[a].id}–${J[b].id} t=${t.toFixed(2)}`; }
          if (s < separacionMinima) { separacionMinima = s; peor = `${tag}: ${J[a].id}–${J[b].id} t=${t.toFixed(2)}`; }
        }
      }
      ok(sepEscena >= 0.6, `${tag}: jugadores demasiado juntos (${sepEscena.toFixed(2)} m, ${parEscena})`);
    }
    ok(receptores.size === 3, `${sistema} Rotación ${rot}: cambiar el destino no cambia el receptor`);
  }
}

// Orden de rotación: COL recorre 1, 6, 5, 4, 3, 2
const zonasCol = [1, 2, 3, 4, 5, 6].map((r) => ordenRotacion('5-1', r).porJugador.COL);
ok(zonasCol.join() === '1,6,5,4,3,2', `zonas de COL: ${zonasCol.join()}`);

// Ejemplo obligatorio: 5-1 · Rotación 1
const c = construirJugada({ sistema: '5-1', rotacion: 1, destino: 'centro' });
const dr = construirJugada({ sistema: '5-1', rotacion: 1, destino: 'derecha' });
const z = c.orden.porZona;
ok(`${z[1]},${z[2]},${z[3]},${z[4]},${z[5]},${z[6]}` === 'COL,R1,C1,OP,R2,C2', 'planilla 5-1 Rotación 1');
ok(c.libero.reemplaza === 'C2' && c.libero.zona === 6, 'L por C2 en zona 6');
ok(c.receptor.id === 'L' && dr.receptor.id === 'R1', 'centro → L, derecha → R1');
const byId = (e, id) => e.jugadores.find((j) => j.id === id);
ok(byId(c, 'R1').carril === 'derecha' && byId(c, 'R2').carril === 'izquierda' && byId(c, 'L').carril === 'centro', 'carriles R2·L·R1');
const COL = byId(c, 'COL').inicio, R1 = byId(c, 'R1').inicio, Lp = byId(c, 'L').inicio;
ok(COL[1] > R1[1] && COL[0] > Lp[0], 'COL detrás de R1 y a la derecha de L');
ok(byId(c, 'R1').ataque === 'derecha' && byId(c, 'OP').ataque === 'izquierda' && byId(c, 'C1').ataque === 'centro', 'ataques R1 derecha · OP izquierda · C1 centro');
const tAtaqueR1 = (e) => e.jugadores.find((j) => j.id === 'R1').fases.find((f) => f.funcion === 'ataca').t;
ok(tAtaqueR1(dr) > tAtaqueR1(c) && tAtaqueR1(dr) > dr.eventos.recepcion, 'con saque a la derecha R1 recibe antes de preparar su ataque');

console.log(`\nSeparación mínima entre jugadores: ${separacionMinima.toFixed(2)} m (${peor})`);
console.log(`${comprobaciones} comprobaciones · ${fallos} fallos`);
process.exit(fallos ? 1 : 0);
