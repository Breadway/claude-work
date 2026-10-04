import { Stage } from './engine/stage.js';

try {

const params = new URLSearchParams(location.search);
const renderMode = params.has('render');
if (renderMode) document.body.classList.add('render');

await Promise.all([
  document.fonts.load('400 20px Inter'), document.fonts.load('500 20px Inter'), document.fonts.load('600 20px Inter'),
  document.fonts.load('700 20px Inter'), document.fonts.load('800 20px Inter'),
  document.fonts.load('400 20px "JetBrains Mono"'), document.fonts.load('600 20px "JetBrains Mono"'),
]);
await document.fonts.ready;

const film = params.get('film') || 'astra';
if (!['astra', 'edu'].includes(film)) throw new Error('Unknown film');
const pacing = film === 'edu' ? params.get('pacing') || 'narration' : 'narration';
if (!['narration', 'original'].includes(pacing)) throw new Error('Unknown pacing');
const mod = await import(film === 'edu' ? './scenes_edu/index.js' : './scenes/index.js');
const scenes = mod.default;
const sopts = { film, pacing, ...(mod.OPTS || {}) };
let narr = null;
try { const r = await fetch(film === 'edu' ? 'out/edu/narration.json' : 'out/narration.json', { cache: 'no-store' }); if (r.ok) narr = await r.json(); } catch (e) { /* silent film */ }
const stage = new Stage(scenes, narr, sopts);
window.TL = stage.timeline();
window.__seek = (T) => stage.seek(T);
stage.seek(Math.min(stage.total - 1e-4, Math.max(0, Number(params.get('t')) || 0)));
window.__ready = true;

if (!renderMode) {
  const { initPreview } = await import('./preview.js');
  await initPreview(stage, film, params);
}
} catch (error) {
  if (document.body.classList.contains('render')) throw error;
  const status = document.getElementById('status');
  status.textContent = `Film could not load: ${error.message}`;
  status.classList.add('error');
  console.error(error);
}
