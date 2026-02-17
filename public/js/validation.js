// validation.js
import { getState, Cell } from "./state.js";
import { inBounds, key, neighbors8, orthNeighbors } from "./helpers.js";

export function isTree(x, y) {
  const s = getState();
  return s?.trees?.has(key(x, y)) ?? false;
}

export function countTentsRow(y) {
  const s = getState();
  let c = 0;
  for (let x = 0; x < s.w; x++) if (s.cells[y][x] === Cell.TENT) c++;
  return c;
}
export function countTentsCol(x) {
  const s = getState();
  let c = 0;
  for (let y = 0; y < s.h; y++) if (s.cells[y][x] === Cell.TENT) c++;
  return c;
}

export function rowHasEmpty(y) {
  const s = getState();
  for (let x = 0; x < s.w; x++) if (!isTree(x, y) && s.cells[y][x] === Cell.EMPTY) return true;
  return false;
}
export function colHasEmpty(x) {
  const s = getState();
  for (let y = 0; y < s.h; y++) if (!isTree(x, y) && s.cells[y][x] === Cell.EMPTY) return true;
  return false;
}

// Tent is "bad" ONLY if:
// - adjacent to NO tree (orth)
// - or adjacent (even diagonally) to another tent
export function computeErrors() {
  const s = getState();
  const illegalAdj = new Set();     // tents touching tents (diag allowed)
  const tentBadNoTree = new Set();  // tent not adjacent to any tree

  // row/col hint error flags
  const rowsBad = new Set();
  const colsBad = new Set();

  // tents touching
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      if (s.cells[y][x] !== Cell.TENT) continue;

      // check 8-neighbor tents
      for (const [nx, ny] of neighbors8(x, y)) {
        if (!inBounds(nx, ny, s.w, s.h)) continue;
        if (s.cells[ny][nx] === Cell.TENT) {
          illegalAdj.add(key(x, y));
          illegalAdj.add(key(nx, ny));
        }
      }

      // check if adjacent to ANY tree orth
      let hasTree = false;
      for (const [nx, ny] of orthNeighbors(x, y)) {
        if (!inBounds(nx, ny, s.w, s.h)) continue;
        if (isTree(nx, ny)) { hasTree = true; break; }
      }
      if (!hasTree) tentBadNoTree.add(key(x, y));
    }
  }

  // hints red if exceeded OR if line has no empties and doesn't match
  for (let y = 0; y < s.h; y++) {
    const want = s.rowCounts?.[y] ?? 0;
    const have = countTentsRow(y);
    if (have > want) rowsBad.add(y);
    else if (!rowHasEmpty(y) && have !== want) rowsBad.add(y);
  }
  for (let x = 0; x < s.w; x++) {
    const want = s.colCounts?.[x] ?? 0;
    const have = countTentsCol(x);
    if (have > want) colsBad.add(x);
    else if (!colHasEmpty(x) && have !== want) colsBad.add(x);
  }

  return { illegalAdj, tentBadNoTree, rowsBad, colsBad };
}
