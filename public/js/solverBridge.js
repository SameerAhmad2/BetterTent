// solverBridge.js
import { getState } from "./state.js";

export function solveCells(cells) {
  const puzzle = getState();
  return window.TentsSolver?.solveWithDFS ? window.TentsSolver.solveWithDFS(puzzle, cells) : null;
}

export function isSolved() {
  const s = getState();
  return window.TentsSolver?.isSolvedNow ? window.TentsSolver.isSolvedNow(s, s?.cells) : false;
}
