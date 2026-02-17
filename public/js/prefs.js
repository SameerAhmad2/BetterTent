// prefs.js
const PREF_COOKIE = "tents_prefs_v1";

export const defaultPrefs = {
  theme: "dark",
  showCoords: false,
  tile: "#a8ff9b",
  treeCanopy: "#19c51e",
  treeTrunk: "#8b5a2b",
  spriteStroke: "#000000",
  tentStroke: "#000000",
};

let prefs = { ...defaultPrefs };

function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}
function getCookie(name) {
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

export function loadPrefs() {
  try {
    const raw = getCookie(PREF_COOKIE);
    if (!raw) return prefs;
    prefs = { ...defaultPrefs, ...JSON.parse(raw) };
  } catch {
    prefs = { ...defaultPrefs };
  }
  return prefs;
}

export function savePrefs() {
  setCookie(PREF_COOKIE, JSON.stringify(prefs));
}

export function getPrefs() {
  return prefs;
}

export function setPref(key, value) {
  prefs[key] = value;
  savePrefs();
}

export function applyPrefsToCSS(rootEl) {
  rootEl.dataset.theme = prefs.theme;

  const s = document.documentElement.style;
  s.setProperty("--tile", prefs.tile);
  s.setProperty("--tree-canopy", prefs.treeCanopy);
  s.setProperty("--tree-trunk", prefs.treeTrunk);
  s.setProperty("--sprite-stroke", prefs.spriteStroke);
  s.setProperty("--tent-stroke", prefs.tentStroke);
}
