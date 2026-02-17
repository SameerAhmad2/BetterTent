// celebrate.js
import { getState } from "./state.js";
import { isSolved } from "./solverBridge.js";

let confettiAnim = null;
let celebrating = false;

export function initCelebrate(els) {
  if (!els.celebrateEl || !els.confettiCanvas) return;

  els.celebrateClose?.addEventListener("click", () => hide(els));
  els.celebrateEl.addEventListener("mousedown", (e) => {
    if (e.target === els.celebrateEl) hide(els);
  });
}

export function resetCelebrate(els) {
  celebrating = false;
  hide(els);
}

export function maybeCelebrate(els) {
  const s = getState();
  if (!s) return;
  if (!isSolved()) {
    celebrating = false;
    return;
  }

  if (celebrating) return;
  celebrating = true;

  show(els);
}

function show(els) {
  els.celebrateEl.style.display = "grid";
  startConfetti(els.confettiCanvas, 2400);
}
function hide(els) {
  els.celebrateEl.style.display = "none";
  stopConfetti(els.confettiCanvas);
}

function startConfetti(canvas, durationMs = 2200) {
  const ctx = canvas.getContext("2d");
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  const colors = ["#ffd166","#06d6a0","#118ab2","#ef476f","#ffffff","#caffbf","#9bf6ff","#bdb2ff","#ffc6ff"];
  const pieces = Array.from({ length: 220 }, () => ({
    x: Math.random() * window.innerWidth,
    y: -20 - Math.random() * window.innerHeight * 0.25,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 10,
    vx: -2 + Math.random() * 4,
    vy: 3 + Math.random() * 6,
    rot: Math.random() * Math.PI,
    vr: -0.15 + Math.random() * 0.3,
    c: colors[(Math.random() * colors.length) | 0],
  }));

  const start = performance.now();

  function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const fade = Math.max(0, 1 - t / durationMs);
    ctx.globalAlpha = fade;

    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.03;
      p.rot += p.vr;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    ctx.globalAlpha = 1;

    if (t < durationMs) confettiAnim = requestAnimationFrame(frame);
    else stopConfetti(canvas);
  }

  window.addEventListener("resize", resize, { once: true });
  confettiAnim = requestAnimationFrame(frame);
}

function stopConfetti(canvas) {
  if (confettiAnim) cancelAnimationFrame(confettiAnim);
  confettiAnim = null;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}
