# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Tetris en JavaScript vanilla con HTML5 Canvas. Sin dependencias, sin `package.json`, sin build, sin linter y sin tests. El `README.md` (en castellano) documenta controles, puntuación y parámetros ajustables.

## Cómo ejecutar

- Abrir `index.html` directamente en el navegador, o servir la carpeta con cualquier servidor estático (`python -m http.server 8000`, `npx serve .`).
- No hay comandos de build, lint ni test. Para verificar un cambio hay que jugar el juego en el navegador.

## Arquitectura

Tres archivos que cooperan; toda la lógica está en `game.js` (script clásico, `'use strict'`, sin módulos, estado en variables globales de nivel superior).

- `index.html` define los elementos que `game.js` busca por `id` al cargar: `board` (canvas 300×600), `next-canvas` (120×180: `NEXT_COUNT` huecos de 60 px, uno por pieza), `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`. Si renombras un `id`, hay que cambiarlo también en `game.js`.
- `style.css` solo estilos; el overlay de pausa/game over se muestra y oculta con la clase `hidden`.

Modelo de datos en `game.js`:

- `board` es una matriz `ROWS × COLS`; cada celda es `0` (vacía) o un índice `1–7` que sirve a la vez de tipo de pieza y de índice en `COLORS`/`PIECES` (el índice `0` es `null` en ambos arrays).
- Las piezas (`current` y cada elemento de `queue`) son `{ type, shape, x, y }`. `queue` guarda las próximas `NEXT_COUNT` (3) piezas; `spawn` saca la primera como `current` y rellena la cola, y `drawNext` las pinta. Si cambias `NEXT_COUNT`, ajusta también el alto de `next-canvas` (`NEXT_COUNT × 60`) y comprueba que el panel lateral no supere el alto del tablero. `shape` es una matriz cuadrada cuyos valores no cero ya llevan el índice de color; rotar es `rotateCW` (transponer + invertir).
- `collide(shape, ox, oy)` es la única comprobación de colisiones y la usan movimiento, rotación (`tryRotate`, con kicks horizontales `[0,-1,1,-2,2]`), caída, fantasma (`ghostY`) y `spawn`.

Flujo: `init()` reinicia todo el estado y arranca `loop` con `requestAnimationFrame`. `loop` acumula tiempo en `dropAccum` y baja la pieza al superar `dropInterval`. Las teclas (`keydown`) actúan directamente sobre `current`. Una pieza se fija con `lockPiece()` → `merge()` → `clearLines()` → `spawn()`. `clearLines` también recalcula `level` y `dropInterval`. Si la pieza recién creada ya colisiona, `spawn` llama a `endGame()`.

## Cosas a tener en cuenta

- El tamaño del canvas está duplicado: `COLS`/`ROWS`/`BLOCK` en `game.js` y `width`/`height` del `<canvas id="board">` en `index.html` deben coincidir (`COLS × BLOCK` por `ROWS × BLOCK`).
- El HUD (`updateHUD`) se actualiza desde `clearLines`, `softDrop`, `init` y al final de cada `keydown`; si añades nueva puntuación, asegúrate de que pasa por alguno de estos sitios.
- `endGame()` se puede disparar desde dentro de `loop` (pieza que cae sola y se fija), donde `cancelAnimationFrame` llega tarde; por eso `loop` comprueba `gameOver` tras dibujar y no pide otro frame. Mantén esa comprobación si tocas el bucle.
- El botón del overlay (`restart-btn`) siempre llama a `init()`, también estando en pausa; para reanudar solo sirve `P`.
