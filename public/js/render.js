// render.js
import { getState, Cell } from "./state.js";
import { alpha } from "./helpers.js";
import { computeErrors, isTree, countTentsRow, countTentsCol } from "./validation.js";
import { svgTree, svgTent } from "./sprites.js";
import { getPrefs } from "./prefs.js";

export function render(els, onCellClick, onHintClick) {
  const s = getState();

  if (!s) { els.mount.innerHTML = ""; return; }

  // responsive sizing to fill container
  const containerWidth = els.mount.clientWidth || window.innerWidth - 20 || 900;
  const totalCols = s.w + 4;
  const outerBorder = 6; // 2 × --outer (3px each side)
  const usable = Math.max(200, containerWidth - outerBorder);
  let cell = Math.floor(usable / totalCols);
  cell = Math.max(20, Math.min(cell, 60));
  document.documentElement.style.setProperty("--cell", `${cell}px`);

  const prefs = getPrefs();
  const showCoords = !!prefs.showCoords;

  const { illegalAdj, tentBadNoTree, rowsBad, colsBad } = computeErrors();

  const wrap = document.createElement("div");
  wrap.className = "puzzleWrap " + (showCoords ? "coordsOn" : "coordsOff");

  const grid = document.createElement("div");
  grid.className = "puzzleGrid";
  grid.style.gridTemplateColumns = `repeat(${totalCols}, var(--cell))`;
  grid.style.gridTemplateRows = `var(--coord) repeat(${s.h + 2}, var(--cell)) var(--coord)`;

  // Helpers to map framed coordinates:
  // columns: [L-coord][L-hint][board...][R-hint][R-coord]
  // rows:    [T-coord][T-hint][board...][B-hint][B-coord]
  const topRowCoord = 0;
  const topRowHint = 1;
  const leftColCoord = 0;
  const leftColHint = 1;

  function addCell(className, text = "", extra = {}) {
    const d = document.createElement("div");
    d.className = className;
    if (text !== null && text !== undefined) d.textContent = text;
    if (extra.style) Object.assign(d.style, extra.style);
    if (extra.html != null) d.innerHTML = extra.html;
    if (extra.onclick) d.onclick = extra.onclick;
    if (extra.oncontextmenu) d.oncontextmenu = extra.oncontextmenu;
    if (extra.title) d.title = extra.title;
    grid.appendChild(d);
    return d;
  }

  // Build full frame (h+4 rows) x (w+4 cols)
  const totalRows = s.h + 4;

  for (let gy = 0; gy < totalRows; gy++) {
    for (let gx = 0; gx < totalCols; gx++) {
      const isBoardX = gx >= 2 && gx < 2 + s.w;
      const isBoardY = gy >= 2 && gy < 2 + s.h;

      // corners / empty framing
      const isCorner = (gx < 2 || gx >= 2 + s.w) && (gy < 2 || gy >= 2 + s.h);
      if (isCorner) {
        addCell("frameCell", "");
        continue;
      }

      // coords top/bottom
      if (gy === topRowCoord && isBoardX) {
        const x = gx - 1; // align to board columns (A..)
        addCell("coordCell", showCoords ? alpha(x) : "", { title: "Column coord" });
        continue;
      }
      if (gy === totalRows - 1 && isBoardX) {
        const x = gx - 1;
        addCell("coordCell", showCoords ? alpha(x) : "", { title: "Column coord" });
        continue;
      }

      // coords left/right
      if (gx === leftColCoord && isBoardY) {
        const y = gy - 1;
        addCell("coordCell", showCoords ? String(y) : "", { title: "Row coord" });
        continue;
      }
      if (gx === totalCols - 1 && isBoardY) {
        const y = gy - 1;
        addCell("coordCell", showCoords ? String(y) : "", { title: "Row coord" });
        continue;
      }

      // top hints
      if (gy === topRowHint && isBoardX) {
        const x = gx - 2;
        const want = s.colCounts?.[x] ?? 0;
        const bad = colsBad.has(x);
        addCell("hintCell topHint " + (bad ? "hintBad" : ""), String(want), {
          title: "Column hint — click to auto-grass",
          onclick: () => onHintClick?.("col", x),
        });
        continue;
      }

      // bottom hints
      if (gy === totalRows - 2 && isBoardX) {
        const x = gx - 2;
        const want = s.colCounts?.[x] ?? 0;
        const bad = colsBad.has(x);
        addCell("hintCell bottomHint " + (bad ? "hintBad" : ""), String(want), {
          title: "Column hint — click to auto-grass",
          onclick: () => onHintClick?.("col", x),
        });
        continue;
      }

      // left hints
      if (gx === leftColHint && isBoardY) {
        const y = gy - 2;
        const want = s.rowCounts?.[y] ?? 0;
        const bad = rowsBad.has(y);
        addCell("hintCell leftHint " + (bad ? "hintBad" : ""), String(want), {
          title: "Row hint — click to auto-grass",
          onclick: () => onHintClick?.("row", y),
        });
        continue;
      }

      // right hints
      if (gx === totalCols - 2 && isBoardY) {
        const y = gy - 2;
        const want = s.rowCounts?.[y] ?? 0;
        const bad = rowsBad.has(y);
        addCell("hintCell rightHint " + (bad ? "hintBad" : ""), String(want), {
          title: "Row hint — click to auto-grass",
          onclick: () => onHintClick?.("row", y),
        });
        continue;
      }

      // board cells
      if (isBoardX && isBoardY) {
        const x = gx - 2;
        const y = gy - 2;

        const cellVal = s.cells[y][x];

        const isTreeCell = isTree(x, y);
        let html = "";
        let cls = "boardCell tile";

        if (isTreeCell) {
          cls += " tree";
          html = svgTree();
        } else if (cellVal === Cell.TENT) {
          cls += " tent";
          html = svgTent();
        } else if (cellVal === Cell.GRASS) {
          cls += " grass";
        } else {
          cls += " empty";
        }

        // red state for tent errors
        const k = `${x},${y}`;
        if (cellVal === Cell.TENT && (illegalAdj.has(k) || tentBadNoTree.has(k))) {
          cls += " badTent";
        }

        addCell(cls, "", {
          html,
          onclick: (ev) => onCellClick?.(x, y, ev),
          oncontextmenu: (ev) => { ev.preventDefault(); onCellClick?.(x, y, ev); },
        });
        continue;
      }

      // framing fillers
      addCell("frameCell", "");
    }
  }

  wrap.appendChild(grid);
  els.mount.replaceChildren(wrap);
}
