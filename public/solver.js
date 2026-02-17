// solver.js (pure / modular-friendly)
// Exposes window.TentsSolver with methods that do NOT depend on app globals.
//
// Cells encoding assumed:
//   0 = EMPTY
//   1 = TENT
//   2 = GRASS
//
// Puzzle shape assumed:
// {
//   w, h,
//   rowCounts: number[],
//   colCounts: number[],
//   trees: Set<string>  // keys "x,y"
// }

(function () {
  const EMPTY = 0;
  const TENT = 1;
  const GRASS = 2;

  function key(x, y) { return `${x},${y}`; }

  function inBounds(x, y, w, h) {
    return x >= 0 && y >= 0 && x < w && y < h;
  }

  function orthNeighbors(x, y) {
    return [
      [x, y - 1],
      [x + 1, y],
      [x, y + 1],
      [x - 1, y],
    ];
  }

  function neighbors8(x, y) {
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        out.push([x + dx, y + dy]);
      }
    }
    return out;
  }

  function isTree(puzzle, x, y) {
    return puzzle.trees && puzzle.trees.has(key(x, y));
  }

  function getPlacedTentsSet(puzzle, cells) {
    const s = new Set();
    for (let y = 0; y < puzzle.h; y++) {
      for (let x = 0; x < puzzle.w; x++) {
        if (cells[y][x] === TENT) s.add(key(x, y));
      }
    }
    return s;
  }

  function tentsTouching(puzzle, tentSet) {
    for (const t of tentSet) {
      const [x, y] = t.split(",").map(Number);
      for (const [nx, ny] of neighbors8(x, y)) {
        if (!inBounds(nx, ny, puzzle.w, puzzle.h)) continue;
        if (tentSet.has(key(nx, ny))) return true;
      }
    }
    return false;
  }

  function countTentsRow(puzzle, cells, y) {
    let c = 0;
    for (let x = 0; x < puzzle.w; x++) if (cells[y][x] === TENT) c++;
    return c;
  }

  function countTentsCol(puzzle, cells, x) {
    let c = 0;
    for (let y = 0; y < puzzle.h; y++) if (cells[y][x] === TENT) c++;
    return c;
  }

  // Build adjacency: each tree -> tents (orth adjacent) that are currently placed
  function buildTreeToTentAdj(puzzle, tentSet) {
    const trees = [...puzzle.trees].map(k => k.split(",").map(Number));
    const adj = trees.map(([tx, ty]) => {
      const opts = [];
      for (const [nx, ny] of orthNeighbors(tx, ty)) {
        if (!inBounds(nx, ny, puzzle.w, puzzle.h)) continue;
        const kk = key(nx, ny);
        if (tentSet.has(kk)) opts.push(kk);
      }
      return opts;
    });
    return { trees, adj };
  }

  // Perfect matching: ALL trees must be matched to distinct placed tents adjacent to them
  function hasPerfectMatchingTreesToTents(puzzle, tentSet) {
    const { trees, adj } = buildTreeToTentAdj(puzzle, tentSet);
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

  function isSolvedNow(puzzle, cells) {
    if (!puzzle || !cells) return false;

    // row/col must match exactly
    for (let y = 0; y < puzzle.h; y++) {
      if (countTentsRow(puzzle, cells, y) !== (puzzle.rowCounts?.[y] ?? 0)) return false;
    }
    for (let x = 0; x < puzzle.w; x++) {
      if (countTentsCol(puzzle, cells, x) !== (puzzle.colCounts?.[x] ?? 0)) return false;
    }

    const tentSet = getPlacedTentsSet(puzzle, cells);
    if (tentsTouching(puzzle, tentSet)) return false;

    // every tent must be adjacent to at least one tree (otherwise cannot be matched)
    for (const t of tentSet) {
      const [x, y] = t.split(",").map(Number);
      let hasTree = false;
      for (const [nx, ny] of orthNeighbors(x, y)) {
        if (!inBounds(nx, ny, puzzle.w, puzzle.h)) continue;
        if (isTree(puzzle, nx, ny)) { hasTree = true; break; }
      }
      if (!hasTree) return false;
    }

    // all trees matched 1-1 with tents
    if (!hasPerfectMatchingTreesToTents(puzzle, tentSet)) return false;

    return true;
  }

  function solveWithDFS(puzzle, cells) {
    if (!puzzle || !cells) return null;

    // candidates per tree: orth-adjacent cells that are not trees
    const trees = [...puzzle.trees].map(k => k.split(",").map(Number));
    const candidates = trees.map(([tx, ty]) => {
      const opts = [];
      for (const [nx, ny] of orthNeighbors(tx, ty)) {
        if (!inBounds(nx, ny, puzzle.w, puzzle.h)) continue;
        if (isTree(puzzle, nx, ny)) continue;
        opts.push([nx, ny]);
      }
      return opts;
    });

    const rowRem = (puzzle.rowCounts || []).slice();
    const colRem = (puzzle.colCounts || []).slice();

    // start from current placements
    const tentSet = new Set();      // all tents on board during search
    const fixedTentSet = new Set(); // tents already present in input cells
    const usedTent = new Set();     // tents assigned to a tree in the matching (search-time)

    for (let y = 0; y < puzzle.h; y++) {
      for (let x = 0; x < puzzle.w; x++) {
        if (cells[y][x] === TENT) {
          const k = key(x, y);
          tentSet.add(k);
          fixedTentSet.add(k);
          rowRem[y]--;
          colRem[x]--;
        }
      }
    }

    // invalid if current state violates counts
    for (let y = 0; y < puzzle.h; y++) if (rowRem[y] < 0) return null;
    for (let x = 0; x < puzzle.w; x++) if (colRem[x] < 0) return null;

    // invalid if existing tents touch
    if (tentsTouching(puzzle, tentSet)) return null;

    // invalid if a fixed tent has no adjacent tree
    for (const t of fixedTentSet) {
      const [x, y] = t.split(",").map(Number);
      let hasTree = false;
      for (const [nx, ny] of orthNeighbors(x, y)) {
        if (!inBounds(nx, ny, puzzle.w, puzzle.h)) continue;
        if (isTree(puzzle, nx, ny)) { hasTree = true; break; }
      }
      if (!hasTree) return null;
    }

    // MRV order (fewest candidates first)
    const treeOrder = [...trees.keys()].sort((a, b) => candidates[a].length - candidates[b].length);

    // Pre-sort each tree's candidates once: fixed tents first (avoids alloc inside bt)
    const sortedCandidates = candidates.map(opts =>
      opts.slice().sort((a, b) => {
        const ak = key(a[0], a[1]);
        const bk = key(b[0], b[1]);
        return (fixedTentSet.has(bk) ? 1 : 0) - (fixedTentSet.has(ak) ? 1 : 0);
      })
    );

    function canUseExistingTent(x, y) {
      const k = key(x, y);
      if (!fixedTentSet.has(k)) return false;
      if (usedTent.has(k)) return false;
      return true;
    }

    function canPlaceNewTent(x, y) {
      const k = key(x, y);
      if (isTree(puzzle, x, y)) return false;
      if (cells[y][x] === GRASS) return false; // respect user grass
      if (cells[y][x] === TENT) return false;  // would be fixed, handled elsewhere
      if (usedTent.has(k)) return false;

      if (rowRem[y] <= 0) return false;
      if (colRem[x] <= 0) return false;

      for (const [nx, ny] of neighbors8(x, y)) {
        if (!inBounds(nx, ny, puzzle.w, puzzle.h)) continue;
        if (tentSet.has(key(nx, ny))) return false;
      }
      return true;
    }

    // Arc consistency: verify row/col counts valid AND every remaining unassigned
    // tree still has at least one valid candidate. Catches dead branches early.
    function arcCheck(fromI) {
      for (let y = 0; y < puzzle.h; y++) if (rowRem[y] < 0) return false;
      for (let x = 0; x < puzzle.w; x++) if (colRem[x] < 0) return false;
      for (let j = fromI; j < treeOrder.length; j++) {
        const opts = sortedCandidates[treeOrder[j]];
        let hasValid = false;
        for (const [cx, cy] of opts) {
          if (canUseExistingTent(cx, cy) || canPlaceNewTent(cx, cy)) {
            hasValid = true;
            break;
          }
        }
        if (!hasValid) return false;
      }
      return true;
    }

    function bt(i) {
      if (i === treeOrder.length) {
        // counts must be exact
        for (let y = 0; y < puzzle.h; y++) if (rowRem[y] !== 0) return false;
        for (let x = 0; x < puzzle.w; x++) if (colRem[x] !== 0) return false;
        return true;
      }

      const opts = sortedCandidates[treeOrder[i]];

      for (const [x, y] of opts) {
        const k = key(x, y);

        // use fixed tent without changing row/col counts
        if (canUseExistingTent(x, y)) {
          usedTent.add(k);
          if (arcCheck(i + 1) && bt(i + 1)) return true;
          usedTent.delete(k);
          continue;
        }

        // place a new tent if valid
        if (!canPlaceNewTent(x, y)) continue;

        usedTent.add(k);
        tentSet.add(k);
        cells[y][x] = TENT;
        rowRem[y]--;
        colRem[x]--;

        if (arcCheck(i + 1) && bt(i + 1)) return true;

        // undo
        colRem[x]++;
        rowRem[y]++;
        cells[y][x] = EMPTY;
        tentSet.delete(k);
        usedTent.delete(k);
      }

      return false;
    }

    if (!arcCheck(0)) return null;
    const ok = bt(0);
    if (!ok) return null;

    // fill remaining empties as grass for a clean finished board
    for (let y = 0; y < puzzle.h; y++) {
      for (let x = 0; x < puzzle.w; x++) {
        if (isTree(puzzle, x, y)) continue;
        if (cells[y][x] === EMPTY) cells[y][x] = GRASS;
      }
    }

    return cells;
  }

  window.TentsSolver = {
    solveWithDFS,
    isSolvedNow,
    // optional export if you want to use it elsewhere:
    _internals: { hasPerfectMatchingTreesToTents },
  };
})();
