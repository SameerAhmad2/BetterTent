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

/**
 * Shared: extract puzzle data from a loaded Playwright page.
 * Returns { id, w, h, task, rowCounts, colCounts, trees } or throws.
 */
async function extractPuzzleFromPage(page, log) {
  const html = await page.content();
  log("page content retrieved");

  const taskMatch = html.match(/var\s+task\s*=\s*'([^']+)'/);
  const wMatch = html.match(/puzzleWidth:\s*(\d+)/);
  const hMatch = html.match(/puzzleHeight:\s*(\d+)/);

  if (!taskMatch || !wMatch || !hMatch) {
    throw new Error("Could not extract task/size from page");
  }
  log("extracted task/width/height from HTML");

  const task = taskMatch[1];
  const w = Number(wMatch[1]);
  const h = Number(hMatch[1]);

  // Try to extract the puzzle ID from the page
  const idMatch = html.match(/var\s+puzzleId\s*=\s*'?(\d+)'?/)
    || html.match(/puzzleId:\s*'?(\d+)'?/)
    || html.match(/id=(\d{4,})/)
    || html.match(/"id"\s*:\s*(\d+)/);
  const extractedId = idMatch ? Number(idMatch[1]) : null;

  const parts = task.split(",").map(s => s.trim());
  const hintParts = parts.slice(1);
  const ints = hintParts.filter(s => /^-?\d+$/.test(s)).map(Number);
  const colCounts = ints.slice(0, w);
  const rowCounts = ints.slice(w, w + h);

  const state = await page.evaluate(() => {
    const candidates = [];
    if (typeof window.Game === "object") candidates.push(window.Game);
    if (typeof window.Puzzle === "object") candidates.push(window.Puzzle);
    const el = document.querySelector("#game");
    if (el && window.$) {
      try { candidates.push(window.$(el).data()); } catch (_) {}
    }
    return candidates;
  });

  const trees = findTreeCoordsInPageState(state, w, h);
  log(`tree extraction complete — found ${trees ? trees.length : 0} trees`);

  return { id: extractedId, w, h, task, rowCounts, colCounts, trees };
}

app.get("/api/tents", async (req, res) => {
  const idRaw = String(req.query.id ?? "").replaceAll(",", "").trim();
  const sizeIndex = String(req.query.size ?? "0").trim(); // 0 = 6x6 easy on their site

  if (!/^\d+$/.test(idRaw)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const reqStart = Date.now();
  const log = (label) => console.log(`[tents id=${idRaw}] ${label} — ${Date.now() - reqStart}ms`);

  log("starting request");

  const browser = await chromium.launch({ headless: true });
  log("browser launched");

  const page = await browser.newPage();
  log("new page created");

  try {
    // 1) Go to "Specific puzzle" page
    await page.goto("https://www.puzzle-tents.com/specific.php", {
      waitUntil: "domcontentloaded",
    });
    log("navigated to specific.php");

    // 2) Select size + enter ID
    await page.selectOption('select[name="size"]', sizeIndex).catch(() => {});
    log("selected size option");
    await page
      .fill('input[name="id"], input[name="puzzleID"], input[type="text"]', idRaw)
      .catch(() => {});
    log("filled puzzle ID");

    // 3) Submit
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded" }).catch(() => {}),
      page
        .click('input[type="submit"], button[type="submit"]')
        .catch(() => page.keyboard.press("Enter")),
    ]);
    log("form submitted + navigation complete");

    // 4) Extract puzzle data
    const data = await extractPuzzleFromPage(page, log);
    data.id = Number(idRaw);

    if (!data.trees) {
      log("responding (no trees)");
      return res.json({
        ...data,
        trees: null,
        note: "Got task + counts. Could not auto-extract tree coordinates; extraction needs tweaking for this puzzle instance.",
      });
    }

    log("responding (success)");
    return res.json(data);
  } catch (e) {
    log(`ERROR — ${e}`);
    return res.status(500).json({ error: String(e) });
  } finally {
    await browser.close();
    log("browser closed — total time");
  }
});

app.get("/api/tents/random", async (req, res) => {
  const sizeIndex = String(req.query.size ?? "0").trim();

  if (!/^\d+$/.test(sizeIndex)) {
    return res.status(400).json({ error: "Invalid size" });
  }

  const reqStart = Date.now();
  const log = (label) => console.log(`[tents random size=${sizeIndex}] ${label} — ${Date.now() - reqStart}ms`);

  log("starting request");

  const browser = await chromium.launch({ headless: true });
  log("browser launched");

  const page = await browser.newPage();
  log("new page created");

  try {
    await page.goto(`https://www.puzzle-tents.com/?size=${sizeIndex}`, {
      waitUntil: "domcontentloaded",
    });
    log("navigated to random puzzle page");

    const data = await extractPuzzleFromPage(page, log);

    if (!data.trees) {
      log("responding (no trees)");
      return res.json({
        ...data,
        trees: null,
        note: "Got task + counts. Could not auto-extract tree coordinates; extraction needs tweaking for this puzzle instance.",
      });
    }

    log("responding (success)");
    return res.json(data);
  } catch (e) {
    log(`ERROR — ${e}`);
    return res.status(500).json({ error: String(e) });
  } finally {
    await browser.close();
    log("browser closed — total time");
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
