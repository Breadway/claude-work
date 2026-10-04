// Render edu then astra, each as AV1 followed by an H.264 compatibility copy.
// node render_all.mjs [--films edu,astra] [--codec both|h264|av1] [--allow-silent] [render.mjs options]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readJSON, writeJSON, acquireLock } from './render-support.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const val = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const films = val('films', 'edu,astra').split(',').map((f) => f.trim());
if (!films.length || films.some((f) => !['edu', 'astra'].includes(f)) || new Set(films).size !== films.length) throw new Error('--films must list edu and/or astra once each');
if (argv.includes('--film')) throw new Error('use --films with render_all.mjs');
if (argv.includes('--out') && films.length > 1) throw new Error('--out requires a single --films entry');
const own = new Set(['films', 'allow-silent']);
const pass = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--') && own.has(a.slice(2))) {
    if (argv[i + 1] && !argv[i + 1].startsWith('--') && a !== '--allow-silent') i++;
    continue;
  }
  pass.push(a);
}
fs.mkdirSync(path.join(ROOT, 'logs'), { recursive: true });
const releaseLock = acquireLock(path.join(ROOT, 'logs', '.render_all.lock'));
const OVERALL = path.join(ROOT, 'logs', 'overall.json');
const mainLog = fs.createWriteStream(path.join(ROOT, 'logs', 'render_all.log'), { flags: 'a' });
const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const say = (m) => { const l = `[${stamp()}] ${m}`; console.log(l); mainLog.write(l + '\n'); };
const state = { started: new Date().toISOString(), films: Object.fromEntries(films.map((f) => [f, { state: 'queued' }])), current: null, updated: '' };
const save = () => { state.updated = new Date().toISOString(); writeJSON(OVERALL, state); };
const outDir = (f) => (f === 'astra' ? path.join(ROOT, 'out') : path.join(ROOT, 'out', f));
let active, stopped = false;
const stop = () => { stopped = true; active?.kill('SIGTERM'); };
process.once('SIGINT', stop); process.once('SIGTERM', stop);
function runFilm(film) {
  return new Promise((resolve, reject) => {
    const log = fs.createWriteStream(path.join(ROOT, 'logs', `${film}.log`), { flags: 'a' });
    log.write(`\n===== ${stamp()} render.mjs --film ${film} ${pass.join(' ')} =====\n`);
    const child = spawn(process.execPath, ['render.mjs', '--film', film, ...pass], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    active = child;
    // Pipe with backpressure instead of building an unlimited log queue.
    child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
    log.once('error', (error) => { child.kill('SIGTERM'); reject(error); });
    child.once('error', reject);
    child.once('close', (code) => { active = null; log.end(); resolve(code ?? 1); });
  });
}
try {
  save();
  say(`render_all: films ${films.join(' -> ')} | args: ${pass.join(' ') || '(defaults: AV1 then H.264)'}`);
  for (const film of films) {
    if (stopped) break;
    const t0 = Date.now(); state.current = film;
    if (film === 'edu' && !fs.existsSync(path.join(outDir('edu'), 'narration.json')) && !argv.includes('--allow-silent')) {
      say('SKIP edu: narration.json is missing. Generate narration or pass --allow-silent.');
      state.films[film] = { state: 'skipped', reason: 'no narration' }; save(); continue;
    }
    state.films[film] = { state: 'running', started: new Date().toISOString() }; save();
    say(`START ${film} (log: logs/${film}.log)`);
    const code = await runFilm(film); const mins = ((Date.now() - t0) / 60000).toFixed(1);
    const renderStatus = readJSON(path.join(outDir(film), 'status.json'));
    // Read only this run's published outputs; old files are not evidence of success.
    const outs = code === 0 && renderStatus?.started >= state.films[film].started
      ? (renderStatus.outputs || []).filter((f) => fs.existsSync(f)).map((f) => `${path.relative(ROOT, f)} (${(fs.statSync(f).size / 1e6).toFixed(0)} MB)`) : [];
    state.films[film] = { state: stopped ? 'cancelled' : code === 0 ? 'done' : 'failed', minutes: +mins, outputs: outs }; save();
    if (code !== 0 || stopped) process.exitCode = 1;
    say(code === 0 && !stopped ? `DONE ${film} in ${mins} min${outs.length ? ' -> ' + outs.join(', ') : ''}` : `FAILED ${film} after ${mins} min (see logs/${film}.log). Re-run to resume.`);
  }
} catch (error) {
  stop(); process.exitCode = 1;
  if (state.current) state.films[state.current] = { state: 'failed', reason: error.message };
  say('FAILED: ' + error.message);
} finally {
  if (stopped) process.exitCode = 1;
  state.current = null; save(); say('render_all finished'); mainLog.end();
  process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  releaseLock();
}
