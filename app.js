/* app.js — full frontend logic
   Features:
   - Load puzzle from /api/tents?id=...&size=...
   - Playable grid (Tent / Grass / Empty), trees fixed
   - Slim grid, hints+coords on ALL FOUR sides (top/bottom/left/right)
   - Coords toggle WITHOUT layout shift (uses .coordsOff + visibility)
   - Theme toggle (dark/light)
   - Auto grass button (safe “impossible for tent” grass fill)
   - Undo/redo (+ Ctrl/Cmd shortcuts)
   - Validation:
        * Tent is red only if:
            - adjacent to NO tree (orth), OR
            - touching another tent (even diagonal)
        * Hint number red if:
            - tents exceed hint, OR
            - line has NO EMPTY non-tree cells and tents != hint
   - Legend shows real sprites
   - Palette editor (Customize): pick Tree/Tent/Grass, enlarge selection, show color pickers
   - Palette + UI prefs saved in a cookie (and restored on load)
*/

const mount = document.getElementById("mount");
const statusEl = document.getElementById("status");

const loadBtn = document.getElementById("load");
const undoBtn = document.getElementById("undo");
const redoBtn = document.getElementById("redo");
const hintBtn = document.getElementById("hintBtn");
const solveBtn = document.getElementById("solveBtn");

const autoGrassBtn = document.getElementById("autoGrass");
const coordsBtn = document.getElementById("coords");

const themeBtn = document.getElementById("themeBtn");
const root = document.documentElement;

// Legend + palette UI
const legendTree = document.getElementById("legendTree");
const legendTent = document.getElementById("legendTent");
const legendGrass = document.getElementById("legendGrass");

const customizeBtn = document.getElementById("customize");
const paletteEl = document.getElementById("palette");
const paletteCloseBtn = document.getElementById("paletteClose");
const resetPaletteBtn = document.getElementById("resetPalette");

const cardTree = document.getElementById("cardTree");
const cardTent = document.getElementById("cardTent");
const cardGrass = document.getElementById("cardGrass");

const paletteTree = document.getElementById("paletteTree");
const paletteTent = document.getElementById("paletteTent");
const paletteGrass = document.getElementById("paletteGrass");

const pickerTitle = document.getElementById("pickerTitle");

// picker rows
const rowTreeCanopy = document.getElementById("rowTreeCanopy");
const rowTreeTrunk = document.getElementById("rowTreeTrunk");
const rowSpriteStroke = document.getElementById("rowSpriteStroke");
const rowTentStroke = document.getElementById("rowTentStroke");
const rowTile = document.getElementById("rowTile");

// picker inputs
const pickTreeCanopy = document.getElementById("pickTreeCanopy");
const pickTreeTrunk = document.getElementById("pickTreeTrunk");
const pickSpriteStroke = document.getElementById("pickSpriteStroke");
const pickTentStroke = document.getElementById("pickTentStroke");
const pickTile = document.getElementById("pickTile");

const celebrateEl = document.getElementById("celebrate");
const confettiCanvas = document.getElementById("confetti");
const celebrateClose = document.getElementById("celebrateClose");

let confettiAnim = null;
let alreadyCelebratedForId = null;

function showCelebrate() {
  if (!celebrateEl) return;
  celebrateEl.style.display = "grid";
  startConfetti(2400);
}

function hideCelebrate() {
  if (!celebrateEl) return;
  celebrateEl.style.display = "none";
  stopConfetti();
}

celebrateClose?.addEventListener("click", hideCelebrate);
celebrateEl?.addEventListener("mousedown", (e) => {
  if (e.target === celebrateEl) hideCelebrate();
});

function startConfetti(durationMs = 2200) {
  if (!confettiCanvas) return;
  const ctx = confettiCanvas.getContext("2d");

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    confettiCanvas.width = Math.floor(window.innerWidth * dpr);
    confettiCanvas.height = Math.floor(window.innerHeight * dpr);
    confettiCanvas.style.width = "100%";
    confettiCanvas.style.height = "100%";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  const colors = ["#ffd166","#06d6a0","#118ab2","#ef476f","#ffffff","#caffbf","#9bf6ff","#bdb2ff","#ffc6ff"];
  const pieces = Array.from({ length: 200 }, () => ({
    x: Math.random() * window.innerWidth,
    y: -20 - Math.random() * window.innerHeight * 0.25,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 10,
    vx: -2 + Math.random() * 4,
    vy: 3 + Math.random() * 6,
    rot: Math.random() * Math.PI,
    vr: -0.15 + Math.random() * 0.3,
    c: colors[(Math.random() * colors.length) | 0],
  }));

  const start = performance.now();

  function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const fade = Math.max(0, 1 - t / durationMs);
    ctx.globalAlpha = fade;

    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.03;
      p.rot += p.vr;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    ctx.globalAlpha = 1;

    if (t < durationMs) confettiAnim = requestAnimationFrame(frame);
    else stopConfetti();
  }

  window.addEventListener("resize", resize, { once: true });
  confettiAnim = requestAnimationFrame(frame);
}

function stopConfetti() {
  if (confettiAnim) cancelAnimationFrame(confettiAnim);
  confettiAnim = null;
  if (!confettiCanvas) return;
  const ctx = confettiCanvas.getContext("2d");
  ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
}

function maybeCelebrate() {
  if (!state) return;

  // use solver's isSolvedNow if you moved it there
  const solved = window.TentsSolver?.isSolvedNow ? window.TentsSolver.isSolvedNow() : false;
  if (!solved) return;

  const idKey = String(state.id);
  if (alreadyCelebratedForId === idKey) return;

  alreadyCelebratedForId = idKey;
  showCelebrate();
}

// ---------- Cookie persistence ----------
const PREF_COOKIE = "tents_prefs_v1";

function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}
function getCookie(name) {
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

const defaultPrefs = {
  theme: "dark",
  showCoords: false,

  // palette
  tile: "#a8ff9b",
  treeCanopy: "#19c51e",
  treeTrunk: "#8b5a2b",
  spriteStroke: "#000000",
  tentStroke: "#000000",
};

let prefs = { ...defaultPrefs };
let showCoords = false;

function loadPrefs() {
  try {
    const raw = getCookie(PREF_COOKIE);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    prefs = { ...defaultPrefs, ...parsed };
  } catch {
    prefs = { ...defaultPrefs };
  }
}
function savePrefs() {
  setCookie(PREF_COOKIE, JSON.stringify(prefs));
}
function applyPrefsToCSSAndUI() {
  root.dataset.theme = prefs.theme;
  showCoords = !!prefs.showCoords;

  const s = document.documentElement.style;
  s.setProperty("--tile", prefs.tile);
  s.setProperty("--tree-canopy", prefs.treeCanopy);
  s.setProperty("--tree-trunk", prefs.treeTrunk);
  s.setProperty("--sprite-stroke", prefs.spriteStroke);
  s.setProperty("--tent-stroke", prefs.tentStroke);
}
loadPrefs();
applyPrefsToCSSAndUI();

// ---------- Theme + coords ----------
themeBtn.onclick = () => {
  prefs.theme = root.dataset.theme === "dark" ? "light" : "dark";
  applyPrefsToCSSAndUI();
  savePrefs();
  render();
};

showCoords = prefs.showCoords;

coordsBtn.onclick = () => {
  prefs.showCoords = !prefs.showCoords;
  applyPrefsToCSSAndUI();
  savePrefs();
  render();
};

// ---------- Game state ----------
const Cell = { EMPTY: 0, TENT: 1, GRASS: 2 };

let state = null;
// state = { id,w,h,rowCounts,colCounts, trees:Set<string>, cells: Cell[][] }

let undoStack = [];
let redoStack = [];

function cloneCells(cells) {
  return cells.map((r) => r.slice());
}
function snapshot() {
  return { cells: cloneCells(state.cells) };
}
function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > 200) undoStack.shift();
  redoStack = [];
  updateUndoRedoButtons();
}
function applySnap(snap) {
  state.cells = cloneCells(snap.cells);
  updateUndoRedoButtons();
  render();
}
function updateUndoRedoButtons() {
  undoBtn.disabled = !state || undoStack.length === 0;
  redoBtn.disabled = !state || redoStack.length === 0;
}
undoBtn.onclick = () => {
  if (!state || !undoStack.length) return;
  const cur = snapshot();
  redoStack.push(cur);
  const prev = undoStack.pop();
  applySnap(prev);
};
redoBtn.onclick = () => {
  if (!state || !redoStack.length) return;
  const cur = snapshot();
  undoStack.push(cur);
  const nxt = redoStack.pop();
  applySnap(nxt);
};

// keyboard shortcuts
document.addEventListener("keydown", (e) => {
  const mac = navigator.platform.toLowerCase().includes("mac");
  const ctrl = mac ? e.metaKey : e.ctrlKey;

  if (!ctrl) return;

  const k = e.key.toLowerCase();
  if (k === "z" && !e.shiftKey) {
    e.preventDefault();
    undoBtn.click();
  } else if (k === "y" || (k === "z" && e.shiftKey)) {
    e.preventDefault();
    redoBtn.click();
  }
});

// ---------- Sprites (SVG) using CSS variables ----------
function svgTree() {
  return `
  <svg class="sprite treeSprite" viewBox="0 0 64 64" aria-hidden="true">
    <ellipse cx="32" cy="26" rx="18" ry="14"
      fill="var(--tree-canopy)" stroke="var(--sprite-stroke)" stroke-width="4"/>
    <rect x="28" y="36" width="8" height="14"
      fill="var(--tree-trunk)" stroke="var(--sprite-stroke)" stroke-width="3"/>
  </svg>`;
}

// Tent ~20% smaller via CSS class .tentSprite
function svgTent(stroke = "var(--tent-stroke)") {
  return `
  <svg class="sprite tentSprite" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M10 50 L32 14 L54 50 Z" fill="none" stroke="${stroke}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M32 14 L32 50" fill="none" stroke="${stroke}" stroke-width="4" stroke-linecap="round"/>
    <path d="M24 50 L32 36 L40 50" fill="none" stroke="${stroke}" stroke-width="4" stroke-linejoin="round"/>
  </svg>`;
}

// ---------- Helpers ----------
function alpha(n) {
  // 1->A ... 15->O
  const A = "A".charCodeAt(0);
  return String.fromCharCode(A + (n - 1));
}

function key(x, y) {
  return `${x},${y}`;
}
function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < state.w && y < state.h;
}
function isTree(x, y) {
  return state.trees.has(key(x, y));
}
function isTent(x, y) {
  return inBounds(x, y) && state.cells[y][x] === Cell.TENT;
}

function orthNeighbors(x, y) {
  return [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ].filter(([nx, ny]) => inBounds(nx, ny));
}
function neighbors8(x, y) {
  const out = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx,
        ny = y + dy;
      if (inBounds(nx, ny)) out.push([nx, ny]);
    }
  }
  return out;
}

function countTentsRow(y) {
  let c = 0;
  for (let x = 0; x < state.w; x++) if (state.cells[y][x] === Cell.TENT) c++;
  return c;
}
function countTentsCol(x) {
  let c = 0;
  for (let y = 0; y < state.h; y++) if (state.cells[y][x] === Cell.TENT) c++;
  return c;
}
function rowHasEmpty(y) {
  for (let x = 0; x < state.w; x++) {
    if (isTree(x, y)) continue;
    if (state.cells[y][x] === Cell.EMPTY) return true;
  }
  return false;
}
function colHasEmpty(x) {
  for (let y = 0; y < state.h; y++) {
    if (isTree(x, y)) continue;
    if (state.cells[y][x] === Cell.EMPTY) return true;
  }
  return false;
}

// ---------- Validation (matches your rules) ----------
function computeIllegalTentAdjacency() {
  // tents cannot touch even diagonally
  const illegal = new Set();
  for (let y = 0; y < state.h; y++) {
    for (let x = 0; x < state.w; x++) {
      if (!isTent(x, y)) continue;
      for (const [nx, ny] of neighbors8(x, y)) {
        if (isTent(nx, ny)) {
          illegal.add(key(x, y));
          illegal.add(key(nx, ny));
        }
      }
    }
  }
  return illegal;
}

function computeErrors() {
  const illegalAdj = computeIllegalTentAdjacency();

  // tents with NO adjacent tree (orth)
  const tentBadNoTree = new Set();
  for (let y = 0; y < state.h; y++) {
    for (let x = 0; x < state.w; x++) {
      if (state.cells[y][x] !== Cell.TENT) continue;
      const hasTree = orthNeighbors(x, y).some(([nx, ny]) => isTree(nx, ny));
      if (!hasTree) tentBadNoTree.add(key(x, y));
    }
  }

  // hint reds:
  // - tents > hint
  // - OR no empty cells and tents != hint
  const rowsBad = new Set();
  const colsBad = new Set();

  for (let y = 0; y < state.h; y++) {
    const tents = countTentsRow(y);
    const hint = state.rowCounts?.[y] ?? 0;
    if (tents > hint) rowsBad.add(y);
    else if (!rowHasEmpty(y) && tents !== hint) rowsBad.add(y);
  }

  for (let x = 0; x < state.w; x++) {
    const tents = countTentsCol(x);
    const hint = state.colCounts?.[x] ?? 0;
    if (tents > hint) colsBad.add(x);
    else if (!colHasEmpty(x) && tents !== hint) colsBad.add(x);
  }

  return { illegalAdj, tentBadNoTree, rowsBad, colsBad };
}

// ---------- Auto grass (button) ----------
function canTentEverBeHere(x, y) {
  if (isTree(x, y)) return false;
  if (state.cells[y][x] === Cell.GRASS) return false;

  // must have at least one adjacent tree
  const hasTree = orthNeighbors(x, y).some(([nx, ny]) => isTree(nx, ny));
  if (!hasTree) return false;

  // must not immediately exceed row/col hints
  const rowT = countTentsRow(y);
  const colT = countTentsCol(x);
  const rowHint = state.rowCounts?.[y] ?? 0;
  const colHint = state.colCounts?.[x] ?? 0;

  // if we place a tent here
  if (state.cells[y][x] !== Cell.TENT) {
    if (rowT + 1 > rowHint) return false;
    if (colT + 1 > colHint) return false;
  }

  return true;
}

function autoPlaceGrass() {
  if (!state) return;
  pushUndo();

  for (let y = 0; y < state.h; y++) {
    for (let x = 0; x < state.w; x++) {
      if (isTree(x, y)) continue;
      if (state.cells[y][x] === Cell.TENT) continue;

      if (!canTentEverBeHere(x, y)) {
        state.cells[y][x] = Cell.GRASS;
      }
    }
  }
  render();
}
autoGrassBtn.onclick = autoPlaceGrass;

// ---------- Rendering ----------
function renderBoardCell(x, y, illegalAdj, tentBadNoTree) {
  const d = document.createElement("div");
  d.className = "boardCell";

  const k = key(x, y);
  const tree = isTree(x, y);
  const v = state.cells[y][x];

  // green tile for tree/tent/grass
  if (tree || v === Cell.TENT || v === Cell.GRASS) d.classList.add("tile");

  if (tree) {
    d.innerHTML = svgTree();
  } else if (v === Cell.TENT) {
    const bad = illegalAdj.has(k) || tentBadNoTree.has(k);
    d.innerHTML = svgTent(bad ? "#cc0000" : "var(--tent-stroke)");
    if (bad) d.classList.add("illegal");
  } else if (v === Cell.GRASS) {
    // grass is just green tile (no sprite)
    d.innerHTML = "";
  } else {
    d.innerHTML = "";
  }

  // interactions
  d.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (tree) return;
    pushUndo();
    state.cells[y][x] = state.cells[y][x] === Cell.GRASS ? Cell.EMPTY : Cell.GRASS;
    render();
  });

  d.addEventListener("click", (e) => {
    if (tree) return;
    pushUndo();

    if (e.shiftKey) {
      state.cells[y][x] = Cell.EMPTY;
      render();
      return;
    }

    const cur = state.cells[y][x];
    state.cells[y][x] =
      cur === Cell.EMPTY ? Cell.TENT : cur === Cell.TENT ? Cell.GRASS : Cell.EMPTY;

    render();
  });

  return d;
}

function updateStatus(illegalAdj, tentBadNoTree, rowsBad, colsBad) {
  const issues = [];
  if (rowsBad.size) issues.push(`rows ${rowsBad.size}`);
  if (colsBad.size) issues.push(`cols ${colsBad.size}`);
  if (illegalAdj.size) issues.push(`tents touching`);
  if (tentBadNoTree.size) issues.push(`tents w/ no tree`);

  const base = state ? `ID ${state.id} • ${state.w}×${state.h}` : "Ready.";
  statusEl.textContent = issues.length ? `${base} • Issues: ${issues.join(" • ")}` : `${base} • OK so far.`;
}

function render() {
  mount.innerHTML = "";
  if (!state) {
    updateUndoRedoButtons();
    return;
  }

  // responsive size
  const rs = document.documentElement.style;

  // Make grid fill container width (options/status bar width)
  const containerWidth = mount.clientWidth || 900;
  
  // total columns in the framed grid = w + 4
  const totalCols = state.w + 4;
  
  // subtract a little padding so it doesn’t touch edges
  const usable = Math.max(320, containerWidth - 24);
  
  // compute cell size from available width
  let cell = Math.floor(usable / totalCols);
  
  // clamp so cells don’t get absurdly big or tiny
  cell = Math.max(26, Math.min(cell, 60));
  
  rs.setProperty("--cell", `${cell}px`);
  

  const { illegalAdj, tentBadNoTree, rowsBad, colsBad } = computeErrors();

  // Full frame grid: coords + hints on all 4 sides
  // total = n + 4 (left coord, left hint, board, right hint, right coord)

  const wrap = document.createElement("div");
  wrap.className = "puzzleWrap " + (showCoords ? "coordsOn" : "coordsOff");

  const grid = document.createElement("div");
  grid.className = "puzzleGrid";
  grid.style.gridTemplateColumns = `repeat(${totalCols}, var(--cell))`;
  grid.style.gridTemplateRows = `var(--coord) var(--cell) repeat(${state.h}, var(--cell)) var(--cell) var(--coord)`;

  const push = (el) => grid.appendChild(el);

  const blank = (h = "var(--cell)") => {
    const d = document.createElement("div");
    d.style.width = "var(--cell)";
    d.style.height = h;
    return d;
  };

  const coordTop = (text) => {
    const d = document.createElement("div");
    d.className = "coordCell";
    d.textContent = text;
    return d;
  };
  const coordBottom = (text) => {
    const d = document.createElement("div");
    d.className = "coordCell";
    d.textContent = text;
    return d;
  };
  const coordLeft = (text) => {
    const d = document.createElement("div");
    d.className = "coordCell left";
    d.textContent = text;
    return d;
  };
  const coordRight = (text) => {
    const d = document.createElement("div");
    d.className = "coordCell right";
    d.textContent = text;
    return d;
  };

  const hintTop = (x) => {
    const d = document.createElement("div");
    d.className = "hintCell top" + (colsBad.has(x) ? " bad" : "");
    d.textContent = state.colCounts?.[x] ?? "";
    return d;
  };
  const hintBottom = (x) => {
    const d = document.createElement("div");
    d.className = "hintCell bottom" + (colsBad.has(x) ? " bad" : "");
    d.textContent = state.colCounts?.[x] ?? "";
    return d;
  };
  const hintLeft = (y) => {
    const d = document.createElement("div");
    d.className = "hintCell left" + (rowsBad.has(y) ? " bad" : "");
    d.textContent = state.rowCounts?.[y] ?? "";
    return d;
  };
  const hintRight = (y) => {
    const d = document.createElement("div");
    d.className = "hintCell right" + (rowsBad.has(y) ? " bad" : "");
    d.textContent = state.rowCounts?.[y] ?? "";
    return d;
  };

  // Row 0: TOP COORDS  [ ][ ][A..][ ][ ]
  push(blank("var(--coord)"));
  push(blank("var(--coord)"));
  for (let x = 0; x < state.w; x++) push(coordTop(alpha(x + 1)));
  push(blank("var(--coord)"));
  push(blank("var(--coord)"));

  // Row 1: TOP HINTS [ ][ ][col hints][ ][ ]
  push(blank());
  push(blank());
  for (let x = 0; x < state.w; x++) push(hintTop(x));
  push(blank());
  push(blank());

  // Board rows
  for (let y = 0; y < state.h; y++) {
    push(coordLeft(String(y + 1)));
    push(hintLeft(y));

    for (let x = 0; x < state.w; x++) {
      push(renderBoardCell(x, y, illegalAdj, tentBadNoTree));
    }

    push(hintRight(y));
    push(coordRight(String(y + 1)));
  }

  // Bottom hints
  push(blank());
  push(blank());
  for (let x = 0; x < state.w; x++) push(hintBottom(x));
  push(blank());
  push(blank());

  // Bottom coords
  push(blank("var(--coord)"));
  push(blank("var(--coord)"));
  for (let x = 0; x < state.w; x++) push(coordBottom(alpha(x + 1)));
  push(blank("var(--coord)"));
  push(blank("var(--coord)"));

  wrap.appendChild(grid);
  mount.appendChild(wrap);

  updateStatus(illegalAdj, tentBadNoTree, rowsBad, colsBad);
  updateUndoRedoButtons();

  // Update legend previews on every render (in case palette changed)
  renderLegendPreviews();
  maybeCelebrate();
}

// ---------- Load puzzle ----------
async function loadPuzzle() {
  const id = document.getElementById("pid").value.replaceAll(",", "").trim();
  const size = document.getElementById("size").value;

  statusEl.textContent = "Loading…";
  loadBtn.disabled = true;

  try {
    const r = await fetch(`/api/tents?id=${encodeURIComponent(id)}&size=${encodeURIComponent(size)}`);
    const data = await r.json();
    if (data.error) {
      statusEl.textContent = data.error;
      return;
    }

    const trees = new Set((data.trees ?? []).map(([x, y]) => `${x},${y}`));
    const cells = Array.from({ length: data.h }, () => Array.from({ length: data.w }, () => Cell.EMPTY));

    state = {
      id: data.id ?? id,
      w: data.w,
      h: data.h,
      rowCounts: data.rowCounts ?? [],
      colCounts: data.colCounts ?? [],
      trees,
      cells,
    };

    alreadyCelebratedForId = null;
    hideCelebrate();
    undoStack = [];
    redoStack = [];
    updateUndoRedoButtons();

    render();
  } catch (e) {
    statusEl.textContent = String(e);
  } finally {
    loadBtn.disabled = false;
  }
}
loadBtn.onclick = loadPuzzle;

// ---------- Legend previews ----------
function renderLegendPreviews() {
  if (!legendTree || !legendTent || !legendGrass) return;

  // Tree preview: green tile + svg
  legendTree.innerHTML = svgTree();

  // Tent preview: green tile + svg (normal stroke)
  legendTent.innerHTML = svgTent("var(--tent-stroke)");

  // Grass preview: green tile only (no sprite)
  legendGrass.innerHTML = "";
}

// ---------- Palette editor ----------
let paletteTarget = "tree";

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r, g, b) {
  const to = (x) => x.toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
function luminance({ r, g, b }) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function enforceLightColor(hex, minLum = 180) {
  const rgb = hexToRgb(hex);
  let lum = luminance(rgb);
  if (lum >= minLum) return hex;

  let { r, g, b } = rgb;
  for (let i = 0; i < 20 && lum < minLum; i++) {
    r = Math.round(r + (255 - r) * 0.15);
    g = Math.round(g + (255 - g) * 0.15);
    b = Math.round(b + (255 - b) * 0.15);
    lum = luminance({ r, g, b });
  }
  return rgbToHex(r, g, b);
}

function syncPickerInputsFromPrefs() {
  pickTreeCanopy.value = prefs.treeCanopy;
  pickTreeTrunk.value = prefs.treeTrunk;
  pickSpriteStroke.value = prefs.spriteStroke;
  pickTentStroke.value = prefs.tentStroke;
  pickTile.value = prefs.tile;
}

function setPrefColor(key, value) {
  prefs[key] = value;
  applyPrefsToCSSAndUI();
  savePrefs();
  renderLegendPreviews();
  render();
}

function setPaletteTarget(t) {
  paletteTarget = t;

  // active card styling
  cardTree.classList.toggle("active", t === "tree");
  cardTent.classList.toggle("active", t === "tent");
  cardGrass.classList.toggle("active", t === "grass");

  // title
  pickerTitle.textContent = t.toUpperCase();

  // show/hide picker rows
  rowTreeCanopy.style.display = t === "tree" ? "flex" : "none";
  rowTreeTrunk.style.display = t === "tree" ? "flex" : "none";
  rowSpriteStroke.style.display = t === "tree" ? "flex" : "none";

  rowTentStroke.style.display = t === "tent" ? "flex" : "none";

  rowTile.style.display = t === "grass" ? "flex" : "none";

  // refresh palette preview cells
  paletteTree.innerHTML = svgTree();
  paletteTent.innerHTML = svgTent("var(--tent-stroke)");
  paletteGrass.innerHTML = ""; // tile only
}

function positionPopover() {
  if (!palettePopover || !customizeBtn) return;

  const btn = customizeBtn.getBoundingClientRect();
  const pop = palettePopover.getBoundingClientRect();

  // desired: under the button, left-aligned
  const margin = 10;
  let left = btn.left + window.scrollX;
  let top = btn.bottom + window.scrollY + margin;

  // clamp to viewport
  const maxLeft = window.scrollX + document.documentElement.clientWidth - pop.width - 12;
  if (left > maxLeft) left = Math.max(window.scrollX + 12, maxLeft);

  const maxTop = window.scrollY + document.documentElement.clientHeight - pop.height - 12;
  if (top > maxTop) top = Math.max(window.scrollY + 12, maxTop);

  palettePopover.style.left = `${left}px`;
  palettePopover.style.top = `${top}px`;

  // move arrow to roughly point at button
  const arrow = palettePopover.querySelector(".popoverArrow");
  if (arrow) {
    const arrowLeft = Math.min(Math.max(18, (btn.left - left + 18)), (pop.width - 30));
    arrow.style.left = `${arrowLeft}px`;
  }
}

function openPalette() {
  if (!palettePopover) return;
  palettePopover.style.display = "block";
  syncPickerInputsFromPrefs();
  setPaletteTarget(paletteTarget);

  // Need next frame so popover has size for clamping
  requestAnimationFrame(() => {
    positionPopover();
  });
}

function closePalette() {
  if (!palettePopover) return;
  palettePopover.style.display = "none";
}

document.addEventListener("mousedown", (e) => {
  if (!palettePopover || palettePopover.style.display === "none") return;
  if (palettePopover.contains(e.target)) return;
  if (customizeBtn && customizeBtn.contains(e.target)) return;
  closePalette();
});

window.addEventListener("resize", () => {
  if (palettePopover && palettePopover.style.display !== "none") positionPopover();
});
window.addEventListener("scroll", () => {
  if (palettePopover && palettePopover.style.display !== "none") positionPopover();
}, { passive: true });


customizeBtn?.addEventListener("click", openPalette);
paletteCloseBtn?.addEventListener("click", closePalette);

// palette cards
cardTree?.addEventListener("click", () => setPaletteTarget("tree"));
cardTent?.addEventListener("click", () => setPaletteTarget("tent"));
cardGrass?.addEventListener("click", () => setPaletteTarget("grass"));

// picker events
pickTreeCanopy?.addEventListener("input", (e) => setPrefColor("treeCanopy", e.target.value));
pickTreeTrunk?.addEventListener("input", (e) => setPrefColor("treeTrunk", e.target.value));
pickSpriteStroke?.addEventListener("input", (e) => setPrefColor("spriteStroke", e.target.value));
pickTentStroke?.addEventListener("input", (e) => setPrefColor("tentStroke", e.target.value));

pickTile?.addEventListener("input", (e) => {
  const adjusted = enforceLightColor(e.target.value);
  e.target.value = adjusted;
  setPrefColor("tile", adjusted);
});

resetPaletteBtn?.addEventListener("click", () => {
  prefs = { ...prefs, ...defaultPrefs };
  applyPrefsToCSSAndUI();
  savePrefs();
  syncPickerInputsFromPrefs();
  setPaletteTarget(paletteTarget);
  renderLegendPreviews();
  render();
});

function applySolvedCells(solvedCells, mode = "solve") {
  if (!solvedCells) {
    statusEl.textContent = "No solution found from current state.";
    return;
  }

  pushUndo();

  if (mode === "hint") {
    // apply only one differing cell
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        if (isTree(x, y)) continue;
        if (state.cells[y][x] !== solvedCells[y][x]) {
          state.cells[y][x] = solvedCells[y][x];
          render();
          return;
        }
      }
    }
    statusEl.textContent = "No hint available (you’re already aligned with a solution).";
    return;
  }

  // full solve
  state.cells = solvedCells;
  render();
}

hintBtn.onclick = () => {
  if (!state) return;
  const cellsCopy = cloneCells(state.cells);
  const solved = solveWithDFS(cellsCopy); // must return 2D cells
  applySolvedCells(solved, "hint");
};

solveBtn.onclick = () => {
  if (!state) return;
  const cellsCopy = cloneCells(state.cells);
  const solved = solveWithDFS(cellsCopy);
  applySolvedCells(solved, "solve");
};


// ---------- Init legend previews ----------
renderLegendPreviews();
updateUndoRedoButtons();
