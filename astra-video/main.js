import { Stage, FPS } from './engine/stage.js';
import scenes from './scenes/index.js';

const params = new URLSearchParams(location.search);
const renderMode = params.has('render');
if (renderMode) document.body.classList.add('render');

await Promise.all([
  document.fonts.load('400 20px Inter'), document.fonts.load('500 20px Inter'), document.fonts.load('600 20px Inter'),
  document.fonts.load('700 20px Inter'), document.fonts.load('800 20px Inter'),
  document.fonts.load('400 20px "JetBrains Mono"'), document.fonts.load('600 20px "JetBrains Mono"'),
]);
await document.fonts.ready;

let narr = null;
try { const r = await fetch('out/narration.json', { cache: 'no-store' }); if (r.ok) narr = await r.json(); } catch (e) { /* silent film */ }
const stage = new Stage(scenes, narr);
window.TL = stage.timeline();
window.__seek = (T) => stage.seek(T);
stage.seek(+params.get('t') || 0);
window.__ready = true;

// ---- preview UI ----
const fit = document.getElementById('fit');
function resize() {
  if (renderMode) return;
  const s = Math.min(innerWidth / 1920, (innerHeight - 44) / 1080);
  fit.style.transform = `scale(${s})`;
  fit.style.left = (innerWidth - 1920 * s) / 2 + 'px';
}
addEventListener('resize', resize); resize();

if (!renderMode) {
  const scrub = document.getElementById('scrub'), tm = document.getElementById('time'), play = document.getElementById('play');
  let T = +params.get('t') || 0, playing = false, last = 0;
  const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')} / ${Math.floor(stage.total / 60)}:${String(Math.floor(stage.total % 60)).padStart(2, '0')}`;
  const draw = () => { stage.seek(T); scrub.value = (T / stage.total) * 1000; tm.textContent = fmtT(T); };
  scrub.oninput = () => { T = (scrub.value / 1000) * stage.total; draw(); };
  play.onclick = () => { playing = !playing; play.textContent = playing ? 'Pause' : 'Play'; last = performance.now(); };
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); play.click(); }
    if (e.code === 'ArrowRight') { T = Math.min(stage.total - 0.01, T + (e.shiftKey ? 5 : 1 / FPS)); draw(); }
    if (e.code === 'ArrowLeft') { T = Math.max(0, T - (e.shiftKey ? 5 : 1 / FPS)); draw(); }
  });
  const loop = (now) => {
    if (playing) { T += (now - last) / 1000; last = now; if (T >= stage.total) { T = 0; } draw(); }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  draw();
}
