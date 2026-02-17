// main.js
import { els } from "./dom.js";
import { loadPrefs, applyPrefsToCSS } from "./prefs.js";
import { renderLegend } from "./sprites.js";
import { initPalette } from "./palette.js";
import { initCelebrate, resetCelebrate } from "./celebrate.js";
import { loadPuzzleFromApi } from "./api.js";
import { render } from "./render.js";
import { initControls } from "./controls.js";

loadPrefs();
applyPrefsToCSS(els.root);

initCelebrate(els);
renderLegend(els);

let controls = null;

function rerender() {
  render(els, controls?.onCellClick);
}

initPalette(els, rerender);
controls = initControls(els, rerender);

els.loadBtn.addEventListener("click", async () => {
  await loadPuzzleFromApi(els, () => {
    resetCelebrate(els);
    rerender();
    controls?.updateUndoRedoButtons?.();
    els.statusEl.textContent = "Loaded.";
  });
});

// initial empty render (no puzzle yet)
rerender();
