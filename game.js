'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

let COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - azul pálido
  '#ffb74d', // L - orange
  '#f06292', // B - rosa (bloque 3x3)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,8,8],[8,8,8]],                  // B - bloque 3x3
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const NEXT_COUNT = 3;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

let gridColor = '#22222e';
let ghostAlpha = 0.2;

let board, current, queue, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = queue.shift();
  while (queue.length < NEXT_COUNT) queue.push(randomPiece());
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

// ---- Skins visuales ----
// Cada skin: paleta `colors` (mismo índice que COLORS) y `draw(context, px, py, size, color)`.
function skinRoundRect(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKINS = {
  retro: {
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d', '#f06292'],
    draw(context, px, py, size, color) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px + 1, py + 1, size - 2, 4);
    },
  },
  neon: {
    colors: [null, '#00f0ff', '#ffee00', '#d500f9', '#39ff14', '#ff1744', '#448aff', '#ff9100', '#ff4081'],
    draw(context, px, py, size, color) {
      const m = Math.max(1.5, size * 0.07);
      context.shadowColor = color;
      context.shadowBlur = size * 0.5;
      context.fillStyle = color + '44'; // relleno translúcido
      context.fillRect(px + m, py + m, size - 2 * m, size - 2 * m);
      context.strokeStyle = color;
      context.lineWidth = Math.max(1, size * 0.07);
      context.strokeRect(px + m, py + m, size - 2 * m, size - 2 * m);
    },
  },
  pastel: {
    colors: [null, '#a8e6ef', '#fff2b3', '#d9b8e6', '#b9e4c0', '#f5b5b5', '#bcd9f5', '#fcd5a5', '#f7b6cf'],
    draw(context, px, py, size, color) {
      context.fillStyle = color;
      skinRoundRect(context, px + 1, py + 1, size - 2, size - 2, size * 0.28);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.35)';
      skinRoundRect(context, px + size * 0.2, py + size * 0.14, size * 0.6, size * 0.16, size * 0.08);
      context.fill();
    },
  },
  pixel: {
    colors: [null, '#29b6d6', '#f2b705', '#9c4dcc', '#4caf50', '#d84343', '#4a90d9', '#f08c1a', '#e0407a'],
    draw(context, px, py, size, color) {
      const u = size / 8; // 1 "píxel" del bloque
      context.fillStyle = color;
      context.fillRect(px, py, size, size);
      context.fillStyle = 'rgba(255,255,255,0.4)'; // borde claro arriba/izquierda
      context.fillRect(px, py, size, u);
      context.fillRect(px, py, u, size);
      context.fillStyle = 'rgba(0,0,0,0.35)'; // borde oscuro abajo/derecha
      context.fillRect(px, py + size - u, size, u);
      context.fillRect(px + size - u, py, u, size);
      context.fillStyle = 'rgba(0,0,0,0.18)'; // textura: puntos oscuros
      [[2, 2], [5, 3], [3, 5], [6, 6]].forEach(([i, j]) =>
        context.fillRect(px + i * u, py + j * u, u, u));
      context.fillStyle = 'rgba(255,255,255,0.25)'; // textura: puntos claros
      [[4, 2], [2, 4], [5, 5]].forEach(([i, j]) =>
        context.fillRect(px + i * u, py + j * u, u, u));
    },
  },
};
let currentSkin = 'retro';

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  context.globalAlpha = alpha ?? 1;
  SKINS[currentSkin].draw(context, x * size, y * size, size, COLORS[colorIndex]);
  // Restablece el estado que las skins pueden haber tocado
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, ghostAlpha);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 16; // con 20 px el bloque 3x3 llenaría todo su hueco y se pegaría al vecino
  const slotCells = nextCanvas.height / NB / NEXT_COUNT; // alto de cada hueco, en celdas
  const widthCells = nextCanvas.width / NB;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  queue.slice(0, NEXT_COUNT).forEach((piece, i) => {
    const { shape } = piece;
    // Caja ocupada por la pieza (las matrices tienen filas/columnas vacías)
    const used = (flags) => flags.map((on, k) => (on ? k : -1)).filter(k => k >= 0);
    const rows = used(shape.map(row => row.some(Boolean)));
    const cols = used(shape[0].map((_, c) => shape.some(row => row[c])));
    const offX = (widthCells - cols.length) / 2 - cols[0];
    const offY = i * slotCells + (slotCells - rows.length) / 2 - rows[0];
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
  });
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  // endGame() puede dispararse desde lockPiece() dentro de este mismo frame
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  queue = [randomPiece()]; // spawn() la toma como pieza actual y rellena la cola
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-checked', String(theme === 'light'));
  const styles = getComputedStyle(document.documentElement);
  gridColor = styles.getPropertyValue('--grid').trim() || gridColor;
  ghostAlpha = parseFloat(styles.getPropertyValue('--ghost-alpha')) || ghostAlpha;
  try { localStorage.setItem('theme', theme); } catch (e) {}
  // En pausa o game over el bucle no redibuja
  if (current) { draw(); drawNext(); }
}

themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeToggle.blur(); // evita que Espacio active el toggle durante la partida
});

let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch (e) {}
const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
applyTheme(savedTheme === 'light' || (!savedTheme && prefersLight) ? 'light' : 'dark');

// ---- Skin activa ----
function applySkin(name) {
  if (!SKINS[name]) name = 'retro';
  currentSkin = name;
  COLORS = SKINS[name].colors;
  document.documentElement.dataset.skin = name;
  skinSelect.value = name;
  // La skin puede cambiar las variables CSS (--grid, --ghost-alpha)
  const styles = getComputedStyle(document.documentElement);
  gridColor = styles.getPropertyValue('--grid').trim() || gridColor;
  ghostAlpha = parseFloat(styles.getPropertyValue('--ghost-alpha')) || ghostAlpha;
  try { localStorage.setItem('skin', name); } catch (e) {}
  if (current) { draw(); drawNext(); }
}

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  skinSelect.blur(); // evita que las flechas/Espacio cambien el selector en partida
});

let savedSkin = null;
try { savedSkin = localStorage.getItem('skin'); } catch (e) {}
applySkin(savedSkin);

init();
