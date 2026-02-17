// api.js
import { Cell, setState, getState, resetHistory } from "./state.js";

export async function loadPuzzleFromApi(els, onLoaded) {
  const id = els.pid.value.replaceAll(",", "").trim();
  const size = els.size.value;

  els.statusEl.textContent = "Loading…";
  els.loadBtn.disabled = true;

  try {
    const r = await fetch(`/api/tents?id=${encodeURIComponent(id)}&size=${encodeURIComponent(size)}`);
    const data = await r.json();

    if (data.error) {
      els.statusEl.textContent = data.error;
      return;
    }

    const trees = new Set((data.trees ?? []).map(([x, y]) => `${x},${y}`));
    const cells = Array.from({ length: data.h }, () => Array.from({ length: data.w }, () => Cell.EMPTY));

    setState({
      id: data.id ?? id,
      w: data.w,
      h: data.h,
      rowCounts: data.rowCounts ?? [],
      colCounts: data.colCounts ?? [],
      trees,
      cells,
      solution: null,
      raw: data,
    });

    resetHistory();
    onLoaded?.();

    // Prefetch the solution in the background so Solve/Hint are instant.
    // requestIdleCallback defers until after the first paint; falls back to setTimeout.
    const puzzle = getState();
    (window.requestIdleCallback || ((fn) => setTimeout(fn, 50)))(() => {
      if (!puzzle || !window.TentsSolver?.solveWithDFS) return;
      const emptyCells = Array.from({ length: puzzle.h }, () =>
        Array.from({ length: puzzle.w }, () => Cell.EMPTY)
      );
      const solution = window.TentsSolver.solveWithDFS(puzzle, emptyCells);
      // Only cache if the user hasn't loaded a different puzzle in the meantime
      if (getState() === puzzle) puzzle.solution = solution;
    });
  } catch (e) {
    els.statusEl.textContent = String(e);
  } finally {
    els.loadBtn.disabled = false;
  }
}
