// Fix for: "Cannot use import statement outside a module"
// Option A (recommended): Use CommonJS (require) so you don't need "type": "module".
// Replace your server.js with this file.

const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

/**
 * Try to locate tree coordinates inside the running page by inspecting common shapes.
 * Defensive heuristic because we don't know the exact internal property names.
 */
function findTreeCoordsInPageState(state, w, h) {
  const isTree = (v) =>
    v === 1 ||
    v === true ||
    v === "T" ||
    v === "tree" ||
    v === "TREE" ||
    (typeof v === "object" && v && (v.tree || v.isTree));

  const toCoords = (grid) => {
    const coords = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (isTree(grid?.[y]?.[x])) coords.push([x, y]);
      }
    }
    return coords;
  };

  const seen = new Set();

  const walk = (obj) => {
    if (!obj || typeof obj !== "object") return null;
    if (seen.has(obj)) return null;
    seen.add(obj);

    if (
      Array.isArray(obj) &&
      obj.length === h &&
      Array.isArray(obj[0]) &&
      obj[0].length === w
    ) {
      const coords = toCoords(obj);
      if (coords.length > 0) return coords;
    }

    for (const k of Object.keys(obj)) {
      const found = walk(obj[k]);
      if (found) return found;
    }
    return null;
  };

  return walk(state);
}

app.get("/api/tents", async (req, res) => {
  const idRaw = String(req.query.id ?? "").replaceAll(",", "").trim();
  const sizeIndex = String(req.query.size ?? "0").trim(); // 0 = 6x6 easy on their site

  if (!/^\d+$/.test(idRaw)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1) Go to "Specific puzzle" page
    await page.goto("https://www.puzzle-tents.com/specific.php", {
      waitUntil: "domcontentloaded",
    });

    // 2) Select size + enter ID
    await page.selectOption('select[name="size"]', sizeIndex).catch(() => {});
    await page
      .fill('input[name="id"], input[name="puzzleID"], input[type="text"]', idRaw)
      .catch(() => {});

    // 3) Submit
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {}),
      page
        .click('input[type="submit"], button[type="submit"]')
        .catch(() => page.keyboard.press("Enter")),
    ]);

    // 4) Extract task/width/height from resulting HTML
    const html = await page.content();

    const taskMatch = html.match(/var\s+task\s*=\s*'([^']+)'/);
    const wMatch = html.match(/puzzleWidth:\s*(\d+)/);
    const hMatch = html.match(/puzzleHeight:\s*(\d+)/);

    if (!taskMatch || !wMatch || !hMatch) {
      return res.status(500).json({ error: "Could not extract task/size from page" });
    }

    const task = taskMatch[1];
    const w = Number(wMatch[1]);
    const h = Number(hMatch[1]);

    // 5) Parse row/col counts from task tail: after '_' we expect h+w numbers
    // task like:
    // "aaegabff,1,1,1,1,1,2,2,1,1,2,0,1"
    // or "gbbj_g_a,2,1,1,..."  (underscore stays inside the FIRST token)

    const parts = task.split(",").map(s => s.trim());

    // Always ignore the first token (board encoding)
    const hintParts = parts.slice(1);

    // Keep only integers
    const ints = hintParts
    .filter(s => /^-?\d+$/.test(s))
    .map(Number);

    // For n×n (or w×h):
    const colCounts = ints.slice(0, w);
    const rowCounts = ints.slice(w, w + h);
    
    // 6) Ask the page runtime for state objects; then deep-search for a tree grid
    const state = await page.evaluate(() => {
      const candidates = [];
      if (typeof window.Game === "object") candidates.push(window.Game);
      if (typeof window.Puzzle === "object") candidates.push(window.Puzzle);

      const el = document.querySelector("#game");
      // Try jQuery element data if available
      // eslint-disable-next-line no-undef
      if (el && window.$) {
        try {
          const data = window.$(el).data();
          candidates.push(data);
        } catch (_) {}
      }

      return candidates;
    });

    const trees = findTreeCoordsInPageState(state, w, h);

    if (!trees) {
      return res.json({
        id: Number(idRaw),
        w,
        h,
        task,
        rowCounts,
        colCounts,
        trees: null,
        note:
          "Got task + counts. Could not auto-extract tree coordinates; extraction needs tweaking for this puzzle instance.",
      });
    }

    return res.json({ id: Number(idRaw), w, h, task, rowCounts, colCounts, trees });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  } finally {
    await browser.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on ${PORT}`);
});

/*
Option B: Keep `import` syntax instead.

1) Add this to package.json:
   {
     "type": "module"
   }

2) Then run:
   node server.js

Option C: Rename server.js -> server.mjs and run:
   node server.mjs
*/
const path = require("path");

// serve static files from this directory
app.use(express.static(path.join(__dirname, "public")));

// make / return index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});
