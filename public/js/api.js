// api.js
import { Cell, setState, getState, resetHistory } from "./state.js";

function applyPuzzleData(data, els, onLoaded) {
  const trees = new Set((data.trees ?? []).map(([x, y]) => `${x},${y}`));
  const cells = Array.from({ length: data.h }, () => Array.from({ length: data.w }, () => Cell.EMPTY));

  setState({
    id: data.id ?? null,
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
  const puzzle = getState();
  (window.requestIdleCallback || ((fn) => setTimeout(fn, 50)))(() => {
    if (!puzzle || !window.TentsSolver?.solveWithDFS) return;
    const emptyCells = Array.from({ length: puzzle.h }, () =>
      Array.from({ length: puzzle.w }, () => Cell.EMPTY)
    );
    const solution = window.TentsSolver.solveWithDFS(puzzle, emptyCells);
    if (getState() === puzzle) puzzle.solution = solution;
  });
}

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

    applyPuzzleData(data, els, onLoaded);
  } catch (e) {
    els.statusEl.textContent = String(e);
  } finally {
    els.loadBtn.disabled = false;
  }
}

export async function loadRandomPuzzle(els, onLoaded) {
  const size = els.size.value;

  els.statusEl.textContent = "Loading random puzzle…";
  els.randomBtn.disabled = true;
  els.loadBtn.disabled = true;

  try {
    const r = await fetch(`/api/tents/random?size=${encodeURIComponent(size)}`);
    const data = await r.json();

    if (data.error) {
      els.statusEl.textContent = data.error;
      return;
    }

    // Show the returned ID in the input so the user can reload it later
    if (data.id) els.pid.value = String(data.id);

    applyPuzzleData(data, els, onLoaded);
  } catch (e) {
    els.statusEl.textContent = String(e);
  } finally {
    els.randomBtn.disabled = false;
    els.loadBtn.disabled = false;
  }
}
