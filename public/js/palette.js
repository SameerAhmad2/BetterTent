// palette.js
import { getPrefs, setPref, applyPrefsToCSS } from "./prefs.js";
import { renderPalettePreviews } from "./sprites.js";

function isLight(hex) {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  // perceived luminance
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) >= 160;
}

function enforceLightColor(hex) {
  // keep nudging lighter until luminance threshold met
  let c = hex;
  for (let i = 0; i < 20 && !isLight(c); i++) {
    const m = c.replace("#", "");
    let r = parseInt(m.slice(0, 2), 16);
    let g = parseInt(m.slice(2, 4), 16);
    let b = parseInt(m.slice(4, 6), 16);
    r = Math.min(255, r + 10);
    g = Math.min(255, g + 10);
    b = Math.min(255, b + 10);
    c = "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
  }
  return c;
}

export function initPalette(els, rerender) {
  if (!els.customizeBtn || !els.palettePopover) return;

  function syncInputs() {
    const p = getPrefs();
    if (els.pickTile) els.pickTile.value = p.tile;
    if (els.pickTreeCanopy) els.pickTreeCanopy.value = p.treeCanopy;
    if (els.pickTreeTrunk) els.pickTreeTrunk.value = p.treeTrunk;
    if (els.pickSpriteStroke) els.pickSpriteStroke.value = p.spriteStroke;
    if (els.pickTentStroke) els.pickTentStroke.value = p.tentStroke;
  }

  function open() {
    els.palettePopover.style.display = "block";
    renderPalettePreviews(els);
    syncInputs();
    position();
  }
  function close() {
    els.palettePopover.style.display = "none";
  }

  function position() {
    const btn = els.customizeBtn.getBoundingClientRect();
    const pop = els.palettePopover.getBoundingClientRect();

    let left = btn.left + window.scrollX;
    let top = btn.bottom + window.scrollY + 10;

    const maxLeft = window.scrollX + document.documentElement.clientWidth - pop.width - 12;
    if (left > maxLeft) left = Math.max(window.scrollX + 12, maxLeft);

    const maxTop = window.scrollY + document.documentElement.clientHeight - pop.height - 12;
    if (top > maxTop) top = Math.max(window.scrollY + 12, maxTop);

    els.palettePopover.style.left = `${left}px`;
    els.palettePopover.style.top = `${top}px`;
  }

  els.customizeBtn.addEventListener("click", () => {
    const visible = els.palettePopover.style.display !== "none";
    visible ? close() : open();
  });

  els.paletteClose?.addEventListener("click", close);

  document.addEventListener("mousedown", (e) => {
    if (els.palettePopover.style.display === "none") return;
    if (els.palettePopover.contains(e.target)) return;
    if (els.customizeBtn.contains(e.target)) return;
    close();
  });

  window.addEventListener("resize", () => {
    if (els.palettePopover.style.display !== "none") position();
  });
  window.addEventListener("scroll", () => {
    if (els.palettePopover.style.display !== "none") position();
  }, { passive: true });

  function applyAll() {
    applyPrefsToCSS(els.root);
    renderPalettePreviews(els);
    rerender?.();
  }

  els.pickTreeCanopy?.addEventListener("input", (e) => { setPref("treeCanopy", e.target.value); applyAll(); });
  els.pickTreeTrunk?.addEventListener("input", (e) => { setPref("treeTrunk", e.target.value); applyAll(); });
  els.pickSpriteStroke?.addEventListener("input", (e) => { setPref("spriteStroke", e.target.value); applyAll(); });
  els.pickTentStroke?.addEventListener("input", (e) => { setPref("tentStroke", e.target.value); applyAll(); });

  // grass/tile must be light
  els.pickTile?.addEventListener("input", (e) => {
    const v = enforceLightColor(e.target.value);
    e.target.value = v;
    setPref("tile", v);
    applyAll();
  });

  els.resetPalette?.addEventListener("click", () => {
    setPref("tile", "#a8ff9b");
    setPref("treeCanopy", "#19c51e");
    setPref("treeTrunk", "#8b5a2b");
    setPref("spriteStroke", "#000000");
    setPref("tentStroke", "#000000");
    syncInputs();
    applyAll();
  });
}
