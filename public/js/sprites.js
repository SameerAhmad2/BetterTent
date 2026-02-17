// sprites.js
export function svgTree() {
    return `
    <svg class="sprite treeSprite" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="6" y="6" width="52" height="52" rx="12"
        fill="var(--tile)" />
      <ellipse cx="32" cy="26" rx="18" ry="14"
        fill="var(--tree-canopy)" stroke="var(--sprite-stroke)" stroke-width="4"/>
      <rect x="28" y="36" width="8" height="14"
        fill="var(--tree-trunk)" stroke="var(--sprite-stroke)" stroke-width="3"/>
    </svg>`;
  }
  
  export function svgTent(stroke = "var(--tent-stroke)") {
    return `
    <svg class="sprite tentSprite" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="6" y="6" width="52" height="52" rx="12"
        fill="var(--tile)" />
      <path d="M12 50 L32 14 L52 50 Z" fill="none" stroke="${stroke}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M32 14 L32 50" fill="none" stroke="${stroke}" stroke-width="4" stroke-linecap="round"/>
      <path d="M24 50 L32 36 L40 50" fill="none" stroke="${stroke}" stroke-width="4" stroke-linejoin="round"/>
    </svg>`;
  }
  
  export function renderLegend(els) {
    if (els.legendTree) els.legendTree.innerHTML = svgTree();
    if (els.legendTent) els.legendTent.innerHTML = svgTent();
    if (els.legendGrass) els.legendGrass.innerHTML = "";
  }
  
  export function renderPalettePreviews(els) {
    if (els.paletteTree) els.paletteTree.innerHTML = svgTree();
    if (els.paletteTent) els.paletteTent.innerHTML = svgTent();
    if (els.paletteGrass) els.paletteGrass.innerHTML = ""; // green tile only
  }
  