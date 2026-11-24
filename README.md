# Cancha de Voleibol 3D · Simulación de recepción

Arena 3D de voleibol de sala con medidas oficiales y una simulación táctica de la
**recepción del saque**: elegís sistema (5-1, 6-2 o 4-2), rotación y destino del saque,
y los jugadores reaccionan desde el golpe del sacador hasta que el pase llega a las
manos del colocador. La misma jugada se ve en la **Arena 3D** o en la **Pizarra 2D**,
con un solo reloj compartido.

Hecho con [Three.js](https://threejs.org/) (ES modules desde CDN), sin paso de compilación.

## Uso local

Los módulos ES necesitan un servidor local (abrir el archivo directamente no funciona):

```bash
python servidor_dev.py 5190 .
```

Luego abrí <http://localhost:5190>. El servidor de desarrollo desactiva la caché para
que los cambios se vean al recargar.

## Controles

- Panel inferior: vista 3D/2D, sistema, rotación, destino del saque, simular, pausar,
  repetir, contacto anterior/siguiente, línea de tiempo y cámara lenta.
- Menú lateral: altura de red, cámaras (Táctica, Diagonal, Superior, Lateral, Fondo) y
  «Mostrar partes de la cancha».
- Teclado: `Espacio` simular/pausar · `←` `→` fotograma · `V` 2D/3D · `1`–`5` cámaras · `M` menú.
- Tocá un jugador para ver su rol, su zona inicial y su recorrido.

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html` | Página principal (arena, controles y pizarra) |
| `src/court.js` | Cancha con medidas FIVB; carga la red y los postes de `models/` |
| `src/arena.js` | Pabellón: gradas, público, pantallas LED, marcador |
| `src/ball.js` | Balón |
| `src/pizarra/rotations.js` | Sistemas, alineación inicial y orden de rotación |
| `src/pizarra/formations.js` | Formaciones, carriles de recepción y rutas de transición |
| `src/pizarra/rules.js` | Regla FIVB 7.4 (orden en el golpe de saque) |
| `src/pizarra/play.js` | Línea de tiempo de la jugada y poses compartidas |
| `src/pizarra/arena3d.js`, `puppet.js` | Jugadores 3D articulados |
| `src/pizarra/board2d.js` | Pizarra 2D (SVG) |
| `src/pizarra/simulador.js` | Controlador: estado, reloj y controles |
| `blender/net_system.py` | Script de Blender que genera `models/net_system.glb` |
| `tests/verificar-pizarra.mjs` | Verificación de las 18 rotaciones × 3 destinos |

## Verificación

```bash
node tests/verificar-pizarra.mjs
```

## Regenerar la red, postes y escalera (Blender)

```bash
blender --background --factory-startup --python blender/net_system.py
```
