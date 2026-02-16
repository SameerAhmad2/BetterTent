const mount = document.getElementById("mount");
const statusEl = document.getElementById("status");

const loadBtn = document.getElementById("load");
const undoBtn = document.getElementById("undo");
const redoBtn = document.getElementById("redo");
const autoGrassBtn = document.getElementById("autoGrass");
const coordsBtn = document.getElementById("coords");

const themeBtn = document.getElementById("themeBtn");
const root = document.documentElement;

function setTheme(mode) {
  root.dataset.theme = mode;
  localStorage.setItem("theme", mode);
}
setTheme(localStorage.getItem("theme") || "dark");
themeBtn.onclick = () => setTheme(root.dataset.theme === "dark" ? "light" : "dark");

let showCoords = false;

const Cell = { EMPTY: 0, TENT: 1, GRASS: 2 };

function svgTree() {
  return `
  <svg class="sprite" viewBox="0 0 64 64" aria-hidden="true">
    <ellipse cx="32" cy="26" rx="18" ry="14" fill="#e26f8f" stroke="#000" stroke-width="4"/>
    <rect x="28" y="36" width="8" height="14" fill="#8b5a2b" stroke="#000" stroke-width="3"/>
  </svg>`;
}
function svgTent(stroke = "#000") {
  return `
  <svg class="sprite" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M10 50 L32 14 L54 50 Z" fill="none" stroke="${stroke}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M32 14 L32 50" fill="none" stroke="${stroke}" stroke-width="4" stroke-linecap="round"/>
    <path d="M24 50 L32 36 L40 50" fill="none" stroke="${stroke}" stroke-width="4" stroke-linejoin="round"/>
  </svg>`;
}

// --- game state ---
let state = null;
// { w,h, rowCounts, colCounts, trees:Set, cells: Cell[][], tentToTree: Map("x,y"->"x,y") }

let undoStack = [];
let redoStack = [];

function cloneCells(cells) {
  return cells.map(r => r.slice());
}
function snapshot() {
  return {
    cells: cloneCells(state.cells),
    tentToTree: new Map(state.tentToTree),
  };
}
function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > 200) undoStack.shift();
  redoStack = [];
  updateUndoRedoButtons();
}
function applySnap(snap) {
  state.cells = cloneCells(snap.cells);
  state.tentToTree = new Map(snap.tentToTree);
  updateUndoRedoButtons();
  render();
}
function updateUndoRedoButtons() {
  undoBtn.disabled = undoStack.length === 0;
  redoBtn.disabled = redoStack.length === 0;
}
undoBtn.onclick = () => {
  if (!undoStack.length) return;
  const cur = snapshot();
  redoStack.push(cur);
  const prev = undoStack.pop();
  applySnap(prev);
};
redoBtn.onclick = () => {
  if (!redoStack.length) return;
  const cur = snapshot();
  undoStack.push(cur);
  const nxt = redoStack.pop();
  applySnap(nxt);
};

document.addEventListener("keydown", (e) => {
  const mac = navigator.platform.toLowerCase().includes("mac");
  const ctrl = mac ? e.metaKey : e.ctrlKey;

  if (ctrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
    e.preventDefault();
    undoBtn.click();
  } else if ((ctrl && e.key.toLowerCase() === "y") || (ctrl && e.shiftKey && e.key.toLowerCase() === "z")) {
    e.preventDefault();
    redoBtn.click();
  }
});

// --- helpers ---
function alpha(n) {
  // 1->A, 2->B ...
  const A = "A".charCodeAt(0);
  return String.fromCharCode(A + n - 1);
}

function inBounds(x,y) {
  return x >= 0 && y >= 0 && x < state.w && y < state.h;
}
function key(x,y) { return `${x},${y}`; }

function isTree(x,y) { return state.trees.has(key(x,y)); }
function isTent(x,y) { return inBounds(x,y) && state.cells[y][x] === Cell.TENT; }

function orthNeighbors(x,y) {
  return [
    [x+1,y],[x-1,y],[x,y+1],[x,y-1]
  ].filter(([nx,ny]) => inBounds(nx,ny));
}
function allNeighbors8(x,y) {
  const out = [];
  for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) {
    if (dx===0 && dy===0) continue;
    const nx=x+dx, ny=y+dy;
    if (inBounds(nx,ny)) out.push([nx,ny]);
  }
  return out;
}

function countTentsRow(y) {
  let c=0; for (let x=0; x<state.w; x++) if (state.cells[y][x] === Cell.TENT) c++;
  return c;
}
function countTentsCol(x) {
  let c=0; for (let y=0; y<state.h; y++) if (state.cells[y][x] === Cell.TENT) c++;
  return c;
}

function computeIllegalTentAdjacency() {
  // tents cannot touch (even diagonally)
  const illegal = new Set();
  for (let y=0; y<state.h; y++) for (let x=0; x<state.w; x++) {
    if (!isTent(x,y)) continue;
    for (const [nx,ny] of allNeighbors8(x,y)) {
      if (isTent(nx,ny)) {
        illegal.add(key(x,y));
        illegal.add(key(nx,ny));
      }
    }
  }
  return illegal;
}

function tentAdjacentTrees(x,y) {
  // trees orthogonally adjacent
  return orthNeighbors(x,y).filter(([nx,ny]) => isTree(nx,ny));
}

function computeTreeTentViolations() {
  // Enforce:
  // - each tent must touch exactly 1 tree
  // - each tree can be paired with at most 1 tent
  //
  // We'll build a pairing map from current placements:
  // if a tent touches exactly 1 tree, it "claims" it.
  // If multiple tents claim same tree => violation (both tents + the tree).
  const tentBad = new Set();
  const treeBad = new Set();

  const claims = new Map(); // treeKey -> tentKey

  for (let y=0; y<state.h; y++) for (let x=0; x<state.w; x++) {
    if (!isTent(x,y)) continue;
    const adjTrees = tentAdjacentTrees(x,y);
    if (adjTrees.length !== 1) {
      tentBad.add(key(x,y));
      // if it touches 0 trees, no tree to mark
      // if >1 trees, mark all those trees as problematic
      for (const [tx,ty] of adjTrees) treeBad.add(key(tx,ty));
      continue;
    }
    const tKey = key(adjTrees[0][0], adjTrees[0][1]);
    const tentKey = key(x,y);
    if (claims.has(tKey)) {
      tentBad.add(tentKey);
      tentBad.add(claims.get(tKey));
      treeBad.add(tKey);
    } else {
      claims.set(tKey, tentKey);
    }
  }

  return { tentBad, treeBad, claims };
}

function canTentEverBeHere(x,y) {
  // SAFE “impossible” checks only:
  // - cannot be on tree
  // - cannot be grass
  // - cannot be tent already (duh)
  // - must have at least one orth adjacent tree
  // - and must not violate row/col max if placed here
  if (isTree(x,y)) return false;
  if (state.cells[y][x] === Cell.GRASS) return false;

  const adjTrees = tentAdjacentTrees(x,y);
  if (adjTrees.length === 0) return false;

  // row/col cap check (placing a tent here would exceed clue)
  const row = countTentsRow(y);
  const col = countTentsCol(x);
  if (state.cells[y][x] !== Cell.TENT) {
    if (row + 1 > state.rowCounts[y]) return false;
    if (col + 1 > state.colCounts[x]) return false;
  }

  // NOTE: we intentionally do NOT enforce diagonal adjacency here,
  // because future moves could change whether it conflicts.
  // (But we can safely say it's impossible if ALL neighbors already block it.)
  return true;
}

function autoPlaceGrass() {
  if (!state) return;
  pushUndo();

  for (let y=0; y<state.h; y++) for (let x=0; x<state.w; x++) {
    if (isTree(x,y)) continue;
    if (state.cells[y][x] === Cell.TENT) continue;

    // if it's impossible for a tent to be here => grass
    if (!canTentEverBeHere(x,y)) {
      state.cells[y][x] = Cell.GRASS;
    }
  }
  render();
}
autoGrassBtn.onclick = autoPlaceGrass;

coordsBtn.onclick = () => {
  showCoords = !showCoords;
  render();
};

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
      d.innerHTML = svgTent(bad ? "#cc0000" : "#000");
      if (bad) d.classList.add("illegal");
    } else if (v === Cell.GRASS) {
      d.innerHTML = ""; // grass is just green tile
    } else {
      d.innerHTML = "";
    }
  
    // interactions (same as you already have)
    d.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (tree) return;
      pushUndo();
      state.cells[y][x] = (state.cells[y][x] === Cell.GRASS) ? Cell.EMPTY : Cell.GRASS;
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
        cur === Cell.EMPTY ? Cell.TENT :
        cur === Cell.TENT ? Cell.GRASS :
        Cell.EMPTY;
  
      render();
    });
  
    return d;
  }
  

  function computeErrors() {
    const illegalAdj = computeIllegalTentAdjacency(); // tent-to-tent (8-neighborhood)
  
    // tents with NO adjacent tree (orth)
    const tentBadNoTree = new Set();
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        if (state.cells[y][x] !== Cell.TENT) continue;
        const adjTrees = orthNeighbors(x, y).some(([nx, ny]) => isTree(nx, ny));
        if (!adjTrees) tentBadNoTree.add(key(x, y));
      }
    }
  
    // Hint red rules:
    // - red if tents > hint
    // - OR if line has NO EMPTY cells AND tents != hint
    const rowsBad = new Set();
    const colsBad = new Set();
  
    for (let y = 0; y < state.h; y++) {
      const tents = countTentsRow(y);
      const hint = state.rowCounts[y] ?? 0;
  
      const hasEmpty = rowHasEmpty(y);
      if (tents > hint) rowsBad.add(y);
      else if (!hasEmpty && tents !== hint) rowsBad.add(y);
    }
  
    for (let x = 0; x < state.w; x++) {
      const tents = countTentsCol(x);
      const hint = state.colCounts[x] ?? 0;
  
      const hasEmpty = colHasEmpty(x);
      if (tents > hint) colsBad.add(x);
      else if (!hasEmpty && tents !== hint) colsBad.add(x);
    }
  
    return { illegalAdj, tentBadNoTree, rowsBad, colsBad };
}

function updateStatus(illegalAdj, tentBadNoTree, rowsBad, colsBad) {
    const issues = [];
    if (rowsBad.size) issues.push(`rows: ${rowsBad.size}`);
    if (colsBad.size) issues.push(`cols: ${colsBad.size}`);
    if (illegalAdj.size) issues.push(`tents touching`);
    if (tentBadNoTree.size) issues.push(`tents w/ no tree`);
  
    statusEl.textContent = issues.length ? `Issues: ${issues.join(" • ")}` : `OK so far.`;
  }

  
// --- render ---
function render() {
    mount.innerHTML = "";
    if (!state) return;
  
    // responsive cell size (optional)
    const rs = document.documentElement.style;
    if (state.w >= 15) rs.setProperty("--cell", "42px");
    else if (state.w >= 10) rs.setProperty("--cell", "48px");
    else rs.setProperty("--cell", "52px");
  
    const wrap = document.createElement("div");
    wrap.className = "puzzleWrap " + (showCoords ? "coordsOn" : "coordsOff");
  
    const grid = document.createElement("div");
    grid.className = "puzzleGrid";
  
    const { illegalAdj, tentBadNoTree, rowsBad, colsBad } = computeErrors();
  
    // Total grid = n + 4 on each axis
    const totalCols = state.w + 4;
    const totalRows = state.h + 4;
  
    grid.style.gridTemplateColumns = `repeat(${totalCols}, var(--cell))`;
    // top coords row uses --coord height; others are cell height
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
      d.textContent = state.colCounts[x] ?? "";
      return d;
    };
    const hintBottom = (x) => {
      const d = document.createElement("div");
      d.className = "hintCell bottom" + (colsBad.has(x) ? " bad" : "");
      d.textContent = state.colCounts[x] ?? "";
      return d;
    };
    const hintLeft = (y) => {
      const d = document.createElement("div");
      d.className = "hintCell left" + (rowsBad.has(y) ? " bad" : "");
      d.textContent = state.rowCounts[y] ?? "";
      return d;
    };
    const hintRight = (y) => {
      const d = document.createElement("div");
      d.className = "hintCell right" + (rowsBad.has(y) ? " bad" : "");
      d.textContent = state.rowCounts[y] ?? "";
      return d;
    };
  
    // --- Row 0: TOP COORDS ---
    // [blank][blank][A..][blank][blank]
    push(blank("var(--coord)")); // above left coords
    push(blank("var(--coord)")); // above left hints
    for (let x = 0; x < state.w; x++) push(coordTop(alpha(x + 1)));
    push(blank("var(--coord)")); // above right hints
    push(blank("var(--coord)")); // above right coords
  
    // --- Row 1: TOP HINTS ---
    // [blank][blank][col hints][blank][blank]
    push(blank()); // left coords column spacer
    push(blank()); // corner spacer
    for (let x = 0; x < state.w; x++) push(hintTop(x));
    push(blank()); // right hint spacer (corner area)
    push(blank()); // right coords spacer
  
    // --- Board rows: y = 0..h-1 ---
    for (let y = 0; y < state.h; y++) {
      push(coordLeft(String(y + 1)));
      push(hintLeft(y));
  
      for (let x = 0; x < state.w; x++) {
        push(renderBoardCell(x, y, illegalAdj, tentBadNoTree));
      }
  
      push(hintRight(y));
      push(coordRight(String(y + 1)));
    }
  
    // --- Bottom hints row ---
    // [blank][blank][col hints][blank][blank]
    push(blank());
    push(blank());
    for (let x = 0; x < state.w; x++) push(hintBottom(x));
    push(blank());
    push(blank());
  
    // --- Bottom coords row ---
    // [blank][blank][A..][blank][blank]
    push(blank("var(--coord)"));
    push(blank("var(--coord)"));
    for (let x = 0; x < state.w; x++) push(coordBottom(alpha(x + 1)));
    push(blank("var(--coord)"));
    push(blank("var(--coord)"));
  
    wrap.appendChild(grid);
    mount.appendChild(wrap);
  
    updateUndoRedoButtons();
    updateStatus(illegalAdj, tentBadNoTree, rowsBad, colsBad);
  }
  
// --- load puzzle ---
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

    const trees = new Set((data.trees ?? []).map(([x,y]) => `${x},${y}`));
    const cells = Array.from({ length: data.h }, () => Array.from({ length: data.w }, () => Cell.EMPTY));

    state = {
      w: data.w,
      h: data.h,
      rowCounts: data.rowCounts,
      colCounts: data.colCounts,
      trees,
      cells,
      tentToTree: new Map(),
    };

    undoStack = [];
    redoStack = [];
    updateUndoRedoButtons();

    render();
    statusEl.textContent = "Loaded.";
  } catch (e) {
    statusEl.textContent = String(e);
  } finally {
    loadBtn.disabled = false;
  }
}

  
function rowHasEmpty(y) {
    for (let x = 0; x < state.w; x++) {
        if (isTree(x, y)) continue;                 // trees are fixed
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


loadBtn.onclick = loadPuzzle;
