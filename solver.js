// solver.js
// Fix: solve/hint now work on partially filled boards.
// Key change: DO NOT mark pre-placed tents as "used" (assigned to a tree).
// We track them as fixedTentSet, and usedTent starts empty.

function tentsTouching(tentSet) {
    for (const t of tentSet) {
      const [x, y] = t.split(",").map(Number);
      for (const [nx, ny] of neighbors8(x, y)) {
        if (tentSet.has(`${nx},${ny}`)) return true;
      }
    }
    return false;
  }
  
  function getPlacedTentsSet(cells) {
    const s = new Set();
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        if (cells[y][x] === Cell.TENT) s.add(`${x},${y}`);
      }
    }
    return s;
  }
  
  // Build adjacency: each tree -> tents (orth adjacent) that are currently placed
  function buildTreeToTentAdj(tentSet) {
    const trees = [...state.trees].map((k) => k.split(",").map(Number));
    const adj = trees.map(([tx, ty]) => {
      const opts = [];
      for (const [nx, ny] of orthNeighbors(tx, ty)) {
        const kk = `${nx},${ny}`;
        if (tentSet.has(kk)) opts.push(kk);
      }
      return opts;
    });
    return { trees, adj };
  }
  
  // Check if there exists a 1-1 pairing between ALL trees and SOME placed tents
  function hasPerfectMatchingTreesToTents(tentSet) {
    const { trees, adj } = buildTreeToTentAdj(tentSet);
    const matchTentToTree = new Map(); // tentKey -> treeIndex
  
    function dfs(treeIdx, seen) {
      for (const tentKey of adj[treeIdx]) {
        if (seen.has(tentKey)) continue;
        seen.add(tentKey);
  
        const cur = matchTentToTree.get(tentKey);
        if (cur === undefined || dfs(cur, seen)) {
          matchTentToTree.set(tentKey, treeIdx);
          return true;
        }
      }
      return false;
    }
  
    // quick fail: if any tree has no adjacent tent
    for (let i = 0; i < adj.length; i++) {
      if (adj[i].length === 0) return false;
    }
  
    let matched = 0;
    for (let i = 0; i < trees.length; i++) {
      if (dfs(i, new Set())) matched++;
      else return false;
    }
    return matched === trees.length;
  }
  
  function isSolvedNow() {
    if (!state) return false;
  
    // row/col must match exactly
    for (let y = 0; y < state.h; y++) {
      if (countTentsRow(y) !== (state.rowCounts?.[y] ?? 0)) return false;
    }
    for (let x = 0; x < state.w; x++) {
      if (countTentsCol(x) !== (state.colCounts?.[x] ?? 0)) return false;
    }
  
    const tentSet = getPlacedTentsSet(state.cells);
    if (tentsTouching(tentSet)) return false;
  
    // All trees can be paired 1-1 with placed tents
    if (!hasPerfectMatchingTreesToTents(tentSet)) return false;
  
    return true;
  }
  
  function pickHintMove(solvedCells) {
    const tentCandidates = [];
    const grassCandidates = [];
  
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        if (isTree(x, y)) continue;
  
        const cur = state.cells[y][x];
        const sol = solvedCells[y][x];
  
        if (cur === sol) continue;
  
        // Don't auto-remove player's tent via hint
        if (cur === Cell.TENT && sol !== Cell.TENT) continue;
  
        if (sol === Cell.TENT && cur !== Cell.TENT) tentCandidates.push([x, y, sol]);
        else if (sol === Cell.GRASS && cur === Cell.EMPTY) grassCandidates.push([x, y, sol]);
        else grassCandidates.push([x, y, sol]);
      }
    }
  
    if (tentCandidates.length) return tentCandidates[0];
    if (grassCandidates.length) return grassCandidates[0];
    return null;
  }
  
  function applySolvedCells(solvedCells, mode = "solve") {
    if (!solvedCells) {
      statusEl.textContent = "No solution found from current state.";
      return;
    }
  
    pushUndo();
  
    if (mode === "hint") {
      const move = pickHintMove(solvedCells);
      if (!move) {
        statusEl.textContent = "No hint available (you’re already aligned with a solution).";
        return;
      }
  
      const [x, y, v] = move;
      state.cells[y][x] = v;
      render();
      return;
    }
  
    state.cells = solvedCells;
    render();
  }
  
  function solveWithDFS(cells) {
    // Candidates per tree: orth-adjacent cells that are not trees
    const trees = [...state.trees].map((k) => k.split(",").map(Number));
  
    const candidates = trees.map(([tx, ty]) => {
      const opts = [];
      for (const [nx, ny] of orthNeighbors(tx, ty)) {
        if (isTree(nx, ny)) continue;
        opts.push([nx, ny]);
      }
      return opts;
    });
  
    // remaining counts
    const rowRem = state.rowCounts.slice();
    const colRem = state.colCounts.slice();
  
    // start from current placements
    const tentSet = new Set();      // all tents currently on board (fixed + placed later)
    const fixedTentSet = new Set(); // tents already placed by the user/current board
    const usedTent = new Set();     // tents assigned to a tree DURING backtracking (start empty)
  
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        if (cells[y][x] === Cell.TENT) {
          const k = `${x},${y}`;
          tentSet.add(k);
          fixedTentSet.add(k);
          rowRem[y]--;
          colRem[x]--;
        }
      }
    }
  
    // fail if current state already violates counts or touching
    for (let y = 0; y < state.h; y++) if (rowRem[y] < 0) return null;
    for (let x = 0; x < state.w; x++) if (colRem[x] < 0) return null;
    if (tentsTouching(tentSet)) return null;
  
    // Extra safety: if a fixed tent has NO adjacent tree, there is no valid completion
    for (const t of fixedTentSet) {
      const [x, y] = t.split(",").map(Number);
      const hasTree = orthNeighbors(x, y).some(([nx, ny]) => isTree(nx, ny));
      if (!hasTree) return null;
    }
  
    // Precompute: for each tree, which candidate tent keys exist
    const candKeys = candidates.map((opts) => opts.map(([x, y]) => `${x},${y}`));
  
    function canUseTentCell(x, y) {
      const k = `${x},${y}`;
      if (isTree(x, y)) return false;
      if (cells[y][x] === Cell.GRASS) return false; // respect user grass
      if (usedTent.has(k)) return false; // unique per tree
      if (rowRem[y] <= 0) return false;
      if (colRem[x] <= 0) return false;
  
      // tents can't touch (including diagonals)
      for (const [nx, ny] of neighbors8(x, y)) {
        if (tentSet.has(`${nx},${ny}`)) return false;
      }
      return true;
    }
  
    // allow choosing an already placed tent IF not already assigned to another tree
    function canUseExistingTent(x, y) {
      const k = `${x},${y}`;
      if (!fixedTentSet.has(k)) return false;
      if (usedTent.has(k)) return false;
      return true;
    }
  
    // Decide order: MRV (fewest options)
    const treeOrder = [...trees.keys()];
    function sortByMRV() {
      treeOrder.sort((a, b) => candKeys[a].length - candKeys[b].length);
    }
    sortByMRV();
  
    const assign = new Array(trees.length).fill(null);
  
    function forwardCheck() {
      for (let y = 0; y < state.h; y++) if (rowRem[y] < 0) return false;
      for (let x = 0; x < state.w; x++) if (colRem[x] < 0) return false;
      return true;
    }
  
    function bt(i) {
      if (i === treeOrder.length) {
        // Must satisfy all counts exactly at the end
        for (let y = 0; y < state.h; y++) if (rowRem[y] !== 0) return false;
        for (let x = 0; x < state.w; x++) if (colRem[x] !== 0) return false;
        return true;
      }
  
      const tIdx = treeOrder[i];
      const opts = candidates[tIdx];
  
      // Try existing placed tents first (stabilizes hints)
      const sorted = opts.slice().sort((a, b) => {
        const ak = `${a[0]},${a[1]}`;
        const bk = `${b[0]},${b[1]}`;
        return fixedTentSet.has(bk) - fixedTentSet.has(ak);
      });
  
      for (const [x, y] of sorted) {
        const k = `${x},${y}`;
  
        // Use fixed tent without changing row/col counts (already counted)
        if (canUseExistingTent(x, y)) {
          usedTent.add(k);
          assign[tIdx] = k;
  
          if (bt(i + 1)) return true;
  
          assign[tIdx] = null;
          usedTent.delete(k);
          continue;
        }
  
        // Place new tent if valid
        if (!canUseTentCell(x, y)) continue;
  
        usedTent.add(k);
        tentSet.add(k);
        assign[tIdx] = k;
        cells[y][x] = Cell.TENT;
        rowRem[y]--;
        colRem[x]--;
  
        if (forwardCheck() && bt(i + 1)) return true;
  
        // Undo
        colRem[x]++;
        rowRem[y]++;
        cells[y][x] = Cell.EMPTY;
        assign[tIdx] = null;
        tentSet.delete(k);
        usedTent.delete(k);
      }
  
      return false;
    }
  
    const ok = bt(0);
    if (!ok) return null;
  
    // Fill the rest as grass (optional finish)
    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        if (isTree(x, y)) continue;
        if (cells[y][x] === Cell.EMPTY) cells[y][x] = Cell.GRASS;
      }
    }
  
    return cells;
  }
  
  // expose API for app.js
  window.TentsSolver = {
    solveWithDFS,
    isSolvedNow,
  };
  