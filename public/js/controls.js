// controls.js
import { getState, Cell, cloneCells, pushUndo, undo, redo, canUndo, canRedo } from "./state.js";
import { setPref, getPrefs, applyPrefsToCSS } from "./prefs.js";
import { autoPlaceGrassSafe } from "./autoGrass.js";
import { solveCells } from "./solverBridge.js";
import { maybeCelebrate } from "./celebrate.js";
import { isTree } from "./validation.js";

function cycleCell(cur, mode) {
  // left click: EMPTY -> TENT -> GRASS -> EMPTY
  // right click: EMPTY -> GRASS -> EMPTY
  if (mode === "right") {
    return cur === Cell.EMPTY ? Cell.GRASS : Cell.EMPTY;
  }
  if (cur === Cell.EMPTY) return Cell.TENT;
  if (cur === Cell.TENT) return Cell.GRASS;
  return Cell.EMPTY;
}

function pickHintMove(state, solvedCells) {
  const tentCandidates = [];
  const grassCandidates = [];

  for (let y = 0; y < state.h; y++) {
    for (let x = 0; x < state.w; x++) {
      if (isTree(x, y)) continue;

      const cur = state.cells[y][x];
      const sol = solvedCells[y][x];
      if (cur === sol) continue;

      // don't remove player's tent automatically
      if (cur === Cell.TENT && sol !== Cell.TENT) continue;

      if (sol === Cell.TENT && cur !== Cell.TENT) tentCandidates.push([x, y, sol]);
      else if (sol === Cell.GRASS && cur === Cell.EMPTY) grassCandidates.push([x, y, sol]);
      else grassCandidates.push([x, y, sol]);
    }
  }

  if (tentCandidates.length) return tentCandidates[Math.floor(Math.random() * tentCandidates.length)];
  if (grassCandidates.length) return grassCandidates[Math.floor(Math.random() * grassCandidates.length)];
  return null;
}

export function initControls(els, rerender) {
  function updateUndoRedoButtons() {
    els.undoBtn.disabled = !canUndo();
    els.redoBtn.disabled = !canRedo();
  }

  els.loadBtn?.addEventListener("click", () => {}); // wired in main
  els.undoBtn?.addEventListener("click", () => { if (undo()) { rerender(); maybeCelebrate(els); } updateUndoRedoButtons(); });
  els.redoBtn?.addEventListener("click", () => { if (redo()) { rerender(); maybeCelebrate(els); } updateUndoRedoButtons(); });

  // keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;

    if (e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      if (undo()) { rerender(); maybeCelebrate(els); }
      updateUndoRedoButtons();
    } else if ((e.key.toLowerCase() === "y") || (e.key.toLowerCase() === "z" && e.shiftKey)) {
      e.preventDefault();
      if (redo()) { rerender(); maybeCelebrate(els); }
      updateUndoRedoButtons();
    }
  });

  els.autoGrassBtn?.addEventListener("click", () => {
    const changed = autoPlaceGrassSafe();
    if (changed) {
      rerender();
      maybeCelebrate(els);
      updateUndoRedoButtons();
    }
  });

  els.coordsBtn?.addEventListener("click", () => {
    const p = getPrefs();
    setPref("showCoords", !p.showCoords);
    rerender();
  });

  els.themeBtn?.addEventListener("click", () => {
    const p = getPrefs();
    setPref("theme", p.theme === "dark" ? "light" : "dark");
    applyPrefsToCSS(els.root);
    rerender();
  });

  // Solve / Hint
  els.solveBtn?.addEventListener("click", () => {
    const s = getState();
    if (!s) return;

    // Use prefetched solution if ready, otherwise solve live from current state
    const solved = s.solution ? cloneCells(s.solution) : solveCells(cloneCells(s.cells));
    if (!solved) {
      els.statusEl.textContent = "No solution found from current state.";
      return;
    }

    pushUndo();
    s.cells = solved;
    rerender();
    maybeCelebrate(els);
    updateUndoRedoButtons();
  });

  els.hintBtn?.addEventListener("click", () => {
    const s = getState();
    if (!s) return;

    // Use prefetched solution if ready, otherwise solve live from current state
    const solved = s.solution ?? solveCells(cloneCells(s.cells));
    if (!solved) {
      els.statusEl.textContent = "No solution found from current state.";
      return;
    }

    const move = pickHintMove(s, solved);
    if (!move) {
      els.statusEl.textContent = "No hint available.";
      return;
    }

    const [x, y, v] = move;
    pushUndo();
    s.cells[y][x] = v;
    rerender();
    maybeCelebrate(els);
    updateUndoRedoButtons();
  });

  // Cell click handler used by render()
  function onCellClick(x, y, ev) {
    const s = getState();
    if (!s) return;
    if (isTree(x, y)) return;

    ev?.preventDefault?.();

    const right = ev?.button === 2 || ev?.type === "contextmenu";
    pushUndo();
    s.cells[y][x] = cycleCell(s.cells[y][x], right ? "right" : "left");
    rerender();
    maybeCelebrate(els);
    updateUndoRedoButtons();
  }

  // prevent default context menu for play area
  els.mount?.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  updateUndoRedoButtons();
  return { onCellClick, updateUndoRedoButtons };
}
