// One command renders the whole set:  film 2 (edu) first, then film 1 (astra), each as H.264 + AV1, with logs and live status.
//   node render_all.mjs [--films edu,astra] [--codec both|h264|av1] [--workers N] [--gpu] [--allow-silent] [options passed to render.mjs]
// Logs:    logs/<film>.log  and logs/render_all.log      Status: node status.mjs  (or ./status.sh, add --watch)
// Resumable: run it again and finished chunks are skipped. Needs: node, ffmpeg, playwright chromium, python3+numpy+scipy (audio).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const val = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const films = val('films', 'edu,astra').split(',');
const own = new Set(['films', 'allow-silent']);
const pass = []; for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--') && own.has(a.slice(2))) { if (argv[i + 1] && !argv[i + 1].startsWith('--') && a !== '--allow-silent') i++; continue; } pass.push(a); }
fs.mkdirSync(path.join(ROOT, 'logs'), { recursive: true });
const OVERALL = path.join(ROOT, 'logs', 'overall.json'); const mainLog = fs.createWriteStream(path.join(ROOT, 'logs', 'render_all.log'), { flags: 'a' });
const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const say = (m) => { const l = `[${stamp()}] ${m}`; console.log(l); mainLog.write(l + '\n'); };
const state = { started: new Date().toISOString(), films: Object.fromEntries(films.map((f) => [f, { state: 'queued' }])), current: null, updated: '' };
const save = () => { state.updated = new Date().toISOString(); fs.writeFileSync(OVERALL, JSON.stringify(state, null, 1)); }; save();

const outDir = (f) => (f === 'astra' ? path.join(ROOT, 'out') : path.join(ROOT, 'out', f));
function runFilm(film) {
  return new Promise((resolve) => {
    const log = fs.createWriteStream(path.join(ROOT, 'logs', `${film}.log`), { flags: 'a' }); log.write(`\n===== ${stamp()}  render.mjs --film ${film} ${pass.join(' ')} =====\n`);
    const p = spawn(process.execPath, ['render.mjs', '--film', film, ...pass], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    p.stdout.on('data', (d) => log.write(d)); p.stderr.on('data', (d) => log.write(d));
    p.on('close', (c) => { log.end(); resolve(c); }); p.on('error', () => resolve(1));
  });
}
say(`render_all: films ${films.join(' -> ')} | args: ${pass.join(' ') || '(defaults: H.264 + AV1)'}`);
for (const film of films) {
  const t0 = Date.now(); state.current = film;
  if (film === 'edu' && !fs.existsSync(path.join(outDir('edu'), 'narration.json')) && !argv.includes('--allow-silent')) {
    say(`SKIP edu: out/edu/narration.json is missing, so captions would not line up with a voice. Generate it with  GKEY=... python3 narrate.py --film edu  (or pass --allow-silent).`);
    state.films[film] = { state: 'skipped', reason: 'no narration' }; save(); continue;
  }
  state.films[film] = { state: 'running', started: new Date().toISOString() }; save(); say(`START ${film}  (log: logs/${film}.log)`);
  const code = await runFilm(film); const mins = ((Date.now() - t0) / 60000).toFixed(1);
  const outs = fs.readdirSync(outDir(film)).filter((f) => /^astra(_edu)?_(h264|av1)\.mp4$/.test(f)).map((f) => `${path.join(path.relative(ROOT, outDir(film)), f)} (${(fs.statSync(path.join(outDir(film), f)).size / 1e6).toFixed(0)} MB)`);
  state.films[film] = { state: code === 0 ? 'done' : 'failed', minutes: +mins, outputs: outs }; save();
  say(code === 0 ? `DONE  ${film} in ${mins} min -> ${outs.join(', ')}` : `FAILED ${film} after ${mins} min (see logs/${film}.log). Re-run to resume.`);
}
state.current = null; save(); say('render_all finished');
