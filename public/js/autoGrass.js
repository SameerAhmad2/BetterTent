// autoGrass.js
import { getState, Cell, pushUndo } from "./state.js";
import { inBounds, neighbors8, orthNeighbors, key } from "./helpers.js";
import { isTree } from "./validation.js";

// A cell is impossible to be a tent if:
// - not adjacent to any tree orth
// - OR would violate tent adjacency if it were a tent (touch existing tent in 8-neighborhood)
// - OR row/col already satisfied (no remaining tents) (optional; keep conservative)
export function autoPlaceGrassSafe() {
  const s = getState();
  if (!s) return false;

  pushUndo();
  let changed = false;

  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      if (isTree(x, y)) continue;
      if (s.cells[y][x] !== Cell.EMPTY) continue;

      // must be adjacent to a tree to be a tent at all
      let hasTree = false;
      for (const [nx, ny] of orthNeighbors(x, y)) {
        if (!inBounds(nx, ny, s.w, s.h)) continue;
        if (isTree(nx, ny)) { hasTree = true; break; }
      }
      if (!hasTree) {
        s.cells[y][x] = Cell.GRASS;
        changed = true;
        continue;
      }

      // can't touch existing tent
      let touchesTent = false;
      for (const [nx, ny] of neighbors8(x, y)) {
        if (!inBounds(nx, ny, s.w, s.h)) continue;
        if (s.cells[ny][nx] === Cell.TENT) { touchesTent = true; break; }
      }
      if (touchesTent) {
        s.cells[y][x] = Cell.GRASS;
        changed = true;
      }
    }
  }

  return changed;
}
