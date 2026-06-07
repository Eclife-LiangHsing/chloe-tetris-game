const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const COLORS = {
  I: "#67e8f9",
  J: "#60a5fa",
  L: "#fb923c",
  O: "#facc15",
  S: "#4ade80",
  T: "#c084fc",
  Z: "#fb7185"
};

const SHAPES = {
  I: [[1, 1, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]],
  O: [[1, 1], [1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  T: [[0, 1, 0], [1, 1, 1]],
  Z: [[1, 1, 0], [0, 1, 1]]
};

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const pauseBtn = document.getElementById("pauseBtn");
const overlayBtn = document.getElementById("overlayBtn");
const restartBtn = document.getElementById("restartBtn");

let board;
let piece;
let nextPiece;
let score;
let lines;
let level;
let dropCounter;
let lastTime;
let paused;
let gameOver;
let rafId;

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(""));
}

function cloneMatrix(matrix) {
  return matrix.map(row => [...row]);
}

function randomPiece() {
  const types = Object.keys(SHAPES);
  const type = types[Math.floor(Math.random() * types.length)];
  return {
    type,
    matrix: cloneMatrix(SHAPES[type]),
    x: Math.floor(COLS / 2) - Math.ceil(SHAPES[type][0].length / 2),
    y: 0
  };
}

function resetGame() {
  board = emptyBoard();
  score = 0;
  lines = 0;
  level = 1;
  dropCounter = 0;
  lastTime = 0;
  paused = false;
  gameOver = false;
  piece = randomPiece();
  nextPiece = randomPiece();
  hideOverlay();
  updateStats();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(update);
}

function collide(testPiece = piece) {
  const matrix = testPiece.matrix;
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (!matrix[y][x]) continue;
      const bx = testPiece.x + x;
      const by = testPiece.y + y;
      if (bx < 0 || bx >= COLS || by >= ROWS || (by >= 0 && board[by][bx])) {
        return true;
      }
    }
  }
  return false;
}

function merge() {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) board[piece.y + y][piece.x + x] = piece.type;
    });
  });
}

function clearLines() {
  let cleared = 0;
  outer: for (let y = ROWS - 1; y >= 0; y -= 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (!board[y][x]) continue outer;
    }
    board.splice(y, 1);
    board.unshift(Array(COLS).fill(""));
    cleared += 1;
    y += 1;
  }
  if (!cleared) return;
  const points = [0, 100, 300, 500, 800][cleared] * level;
  score += points;
  lines += cleared;
  level = Math.floor(lines / 10) + 1;
  updateStats();
}

function rotateMatrix(matrix) {
  const result = matrix[0].map((_, i) => matrix.map(row => row[i]).reverse());
  return result;
}

function rotate() {
  if (paused || gameOver) return;
  const original = piece.matrix;
  const originalX = piece.x;
  piece.matrix = rotateMatrix(piece.matrix);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    piece.x = originalX + kick;
    if (!collide()) return;
  }
  piece.matrix = original;
  piece.x = originalX;
}

function move(dir) {
  if (paused || gameOver) return;
  piece.x += dir;
  if (collide()) piece.x -= dir;
}

function softDrop() {
  if (paused || gameOver) return;
  piece.y += 1;
  if (collide()) {
    piece.y -= 1;
    lockPiece();
  } else {
    score += 1;
    updateStats();
  }
  dropCounter = 0;
}

function hardDrop() {
  if (paused || gameOver) return;
  let distance = 0;
  while (!collide()) {
    piece.y += 1;
    distance += 1;
  }
  piece.y -= 1;
  score += Math.max(0, distance - 1) * 2;
  lockPiece();
}

function lockPiece() {
  merge();
  clearLines();
  piece = nextPiece;
  nextPiece = randomPiece();
  if (collide()) {
    gameOver = true;
    showOverlay("遊戲結束", "再玩一次");
  }
  updateStats();
}

function drawBlock(context, x, y, size, color) {
  context.fillStyle = color;
  context.fillRect(x, y, size, size);
  context.strokeStyle = "rgba(255,255,255,.58)";
  context.lineWidth = 2;
  context.strokeRect(x + 1, y + 1, size - 2, size - 2);
  context.fillStyle = "rgba(255,255,255,.22)";
  context.fillRect(x + 3, y + 3, size - 6, Math.max(3, size * .18));
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(0, 0, 0, .18)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255,255,255,.08)";
  ctx.lineWidth = 1;
  for (let x = 1; x < COLS; x += 1) {
    ctx.beginPath();
    ctx.moveTo(x * BLOCK, 0);
    ctx.lineTo(x * BLOCK, canvas.height);
    ctx.stroke();
  }
  for (let y = 1; y < ROWS; y += 1) {
    ctx.beginPath();
    ctx.moveTo(0, y * BLOCK);
    ctx.lineTo(canvas.width, y * BLOCK);
    ctx.stroke();
  }

  board.forEach((row, y) => {
    row.forEach((type, x) => {
      if (type) drawBlock(ctx, x * BLOCK, y * BLOCK, BLOCK, COLORS[type]);
    });
  });

  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) drawBlock(ctx, (piece.x + x) * BLOCK, (piece.y + y) * BLOCK, BLOCK, COLORS[piece.type]);
    });
  });
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextCtx.fillStyle = "rgba(0,0,0,.22)";
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  const matrix = nextPiece.matrix;
  const size = 20;
  const offsetX = (nextCanvas.width - matrix[0].length * size) / 2;
  const offsetY = (nextCanvas.height - matrix.length * size) / 2;
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) drawBlock(nextCtx, offsetX + x * size, offsetY + y * size, size, COLORS[nextPiece.type]);
    });
  });
}

function update(time = 0) {
  const delta = time - lastTime;
  lastTime = time;
  if (!paused && !gameOver) {
    dropCounter += delta;
    if (dropCounter > Math.max(120, 820 - (level - 1) * 70)) softDrop();
  }
  drawBoard();
  drawNext();
  rafId = requestAnimationFrame(update);
}

function updateStats() {
  scoreEl.textContent = score;
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function showOverlay(title, buttonText) {
  overlayTitle.textContent = title;
  overlayBtn.textContent = buttonText;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  pauseBtn.textContent = paused ? "▶" : "II";
  if (paused) showOverlay("暫停中", "繼續");
  else hideOverlay();
}

document.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft") move(-1);
  if (event.key === "ArrowRight") move(1);
  if (event.key === "ArrowDown") softDrop();
  if (event.key === "ArrowUp" || event.key.toLowerCase() === "x") rotate();
  if (event.code === "Space") {
    event.preventDefault();
    hardDrop();
  }
  if (event.key.toLowerCase() === "p") togglePause();
});

document.querySelectorAll("[data-action]").forEach(button => {
  button.addEventListener("click", () => {
    const action = button.dataset.action;
    if (action === "left") move(-1);
    if (action === "right") move(1);
    if (action === "rotate") rotate();
    if (action === "down") softDrop();
    if (action === "drop") hardDrop();
  });
});

pauseBtn.addEventListener("click", togglePause);
restartBtn.addEventListener("click", resetGame);
overlayBtn.addEventListener("click", () => {
  if (gameOver) resetGame();
  else togglePause();
});

resetGame();
