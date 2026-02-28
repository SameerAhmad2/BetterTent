const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

async function fetchHtml(url, init = {}) {
  const res = await fetch(url, {
    headers: { ...FETCH_HEADERS, ...(init.headers || {}) },
    redirect: "follow",
    ...init,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.text();
}

/**
 * Decode tree coordinates from the encoded grid portion of the task string.
 * Each character advances a position pointer by (charCode - 96) and places a tree.
 * '_' places a tree without advancing first. 'z' advances by 25 without placing a tree.
 * Source: puzzle-tents.com jQuery plugin (tents-a99769b381.js)
 */
function decodeTaskGrid(encoded, w, h) {
  const trees = [];
  let i = 0;

  for (let s = 0; s < encoded.length; s++) {
    const ch = encoded[s];
    if (ch !== "_") {
      i += ch.charCodeAt(0) - 96;
    }
    if (ch === "z") {
      i--; // 'z' = net +25, no tree placed
    } else if (i < w * h) {
      trees.push([i % w, Math.floor(i / w)]);
      i++;
    }
  }

  return trees.length > 0 ? trees : null;
}

/**
 * Parse puzzle data from raw HTML.
 * Returns { id, w, h, task, rowCounts, colCounts, trees } or throws.
 */
function parsePuzzle(html, log) {
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

  const idMatch =
    html.match(/var\s+puzzleId\s*=\s*'?(\d+)'?/) ||
    html.match(/puzzleId:\s*'?(\d+)'?/) ||
    html.match(/id=(\d{4,})/) ||
    html.match(/"id"\s*:\s*(\d+)/);
  const extractedId = idMatch ? Number(idMatch[1]) : null;

  const parts = task.split(",").map((s) => s.trim());
  const hintParts = parts.slice(1);
  const ints = hintParts.filter((s) => /^-?\d+$/.test(s)).map(Number);
  const colCounts = ints.slice(0, w);
  const rowCounts = ints.slice(w, w + h);

  const trees = decodeTaskGrid(task.split(",")[0], w, h);
  log(`tree extraction complete — found ${trees ? trees.length : 0} trees`);

  return { id: extractedId, w, h, task, rowCounts, colCounts, trees };
}

app.get("/api/tents", async (req, res) => {
  const idRaw = String(req.query.id ?? "").replaceAll(",", "").trim();
  const sizeIndex = String(req.query.size ?? "0").trim();

  if (!/^\d+$/.test(idRaw)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const reqStart = Date.now();
  const log = (label) =>
    console.log(`[tents id=${idRaw}] ${label} — ${Date.now() - reqStart}ms`);

  log("starting request");

  try {
    const form = new URLSearchParams({ size: sizeIndex, id: idRaw });
    const html = await fetchHtml("https://www.puzzle-tents.com/specific.php", {
      method: "POST",
      body: form.toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    log("page fetched");

    const data = parsePuzzle(html, log);
    data.id = Number(idRaw);

    if (!data.trees) {
      log("responding (no trees)");
      return res.json({
        ...data,
        trees: null,
        note: "Got task + counts. Could not auto-extract tree coordinates.",
      });
    }

    log("responding (success)");
    return res.json(data);
  } catch (e) {
    log(`ERROR — ${e}`);
    return res.status(500).json({ error: String(e) });
  }
});

app.get("/api/tents/random", async (req, res) => {
  const sizeIndex = String(req.query.size ?? "0").trim();

  if (!/^\d+$/.test(sizeIndex)) {
    return res.status(400).json({ error: "Invalid size" });
  }

  const reqStart = Date.now();
  const log = (label) =>
    console.log(
      `[tents random size=${sizeIndex}] ${label} — ${Date.now() - reqStart}ms`
    );

  log("starting request");

  try {
    const html = await fetchHtml(
      `https://www.puzzle-tents.com/?size=${sizeIndex}`
    );
    log("page fetched");

    const data = parsePuzzle(html, log);

    if (!data.trees) {
      log("responding (no trees)");
      return res.json({
        ...data,
        trees: null,
        note: "Got task + counts. Could not auto-extract tree coordinates.",
      });
    }

    log("responding (success)");
    return res.json(data);
  } catch (e) {
    log(`ERROR — ${e}`);
    return res.status(500).json({ error: String(e) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on ${PORT}`);
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});
