// dom.js
export const els = {
    mount: document.getElementById("mount"),
    statusEl: document.getElementById("status"),

    pid: document.getElementById("pid"),
    size: document.getElementById("size"),
  
    loadBtn: document.getElementById("load"),
    randomBtn: document.getElementById("random"),
    undoBtn: document.getElementById("undo"),
    redoBtn: document.getElementById("redo"),
    hintBtn: document.getElementById("hintBtn"),
    solveBtn: document.getElementById("solveBtn"),
  
    autoGrassBtn: document.getElementById("autoGrass"),
    coordsBtn: document.getElementById("coords"),
    themeBtn: document.getElementById("themeBtn"),
    root: document.documentElement,
  
    // legend
    legendTree: document.getElementById("legendTree"),
    legendTent: document.getElementById("legendTent"),
    legendGrass: document.getElementById("legendGrass"),
  
    // palette
    customizeBtn: document.getElementById("customize"),
    palettePopover: document.getElementById("palettePopover"),
    paletteClose: document.getElementById("paletteClose"),
    resetPalette: document.getElementById("resetPalette"),
    pickerTitle: document.getElementById("pickerTitle"),
  
    cardTree: document.getElementById("cardTree"),
    cardTent: document.getElementById("cardTent"),
    cardGrass: document.getElementById("cardGrass"),
  
    paletteTree: document.getElementById("paletteTree"),
    paletteTent: document.getElementById("paletteTent"),
    paletteGrass: document.getElementById("paletteGrass"),
  
    rowTreeCanopy: document.getElementById("rowTreeCanopy"),
    rowTreeTrunk: document.getElementById("rowTreeTrunk"),
    rowSpriteStroke: document.getElementById("rowSpriteStroke"),
    rowTentStroke: document.getElementById("rowTentStroke"),
    rowTile: document.getElementById("rowTile"),
  
    pickTreeCanopy: document.getElementById("pickTreeCanopy"),
    pickTreeTrunk: document.getElementById("pickTreeTrunk"),
    pickSpriteStroke: document.getElementById("pickSpriteStroke"),
    pickTentStroke: document.getElementById("pickTentStroke"),
    pickTile: document.getElementById("pickTile"),
  
    // celebrate
    celebrateEl: document.getElementById("celebrate"),
    confettiCanvas: document.getElementById("confetti"),
    celebrateClose: document.getElementById("celebrateClose"),
  };
  
  window.els = {
    els
  }