// state.js
export const Cell = {
  EMPTY: 0,
  TENT: 1,
  GRASS: 2,
};

let state = null;

let undoStack = [];
let redoStack = [];

export function getState() {
  return state;
}
export function setState(next) {
  state = next;
}

export function cloneCells(cells) {
  return cells.map((r) => r.slice());
}

export function resetHistory() {
  undoStack = [];
  redoStack = [];
}
export function pushUndo() {
  if (!state) return;
  undoStack.push({ cells: cloneCells(state.cells) });
  if (undoStack.length > 200) undoStack.shift();
  redoStack = [];
}
export function popUndo() {
  if (undoStack.length > 0) undoStack.pop();
}
export function cellsChanged(snapshot) {
  if (!state) return false;
  for (let y = 0; y < state.cells.length; y++) {
    for (let x = 0; x < state.cells[y].length; x++) {
      if (state.cells[y][x] !== snapshot[y][x]) return true;
    }
  }
  return false;
}
export function canUndo() {
  return undoStack.length > 0;
}
export function canRedo() {
  return redoStack.length > 0;
}
export function undo() {
  if (!state || undoStack.length === 0) return false;
  const prev = undoStack.pop();
  redoStack.push({ cells: cloneCells(state.cells) });
  state.cells = prev.cells;
  return true;
}
export function redo() {
  if (!state || redoStack.length === 0) return false;
  const nxt = redoStack.pop();
  undoStack.push({ cells: cloneCells(state.cells) });
  state.cells = nxt.cells;
  return true;
}
