// ASTRA video engine - portable renderer (Windows / macOS / Linux).
// Drives headless Chromium frame by frame (deterministic seek), pipes JPEGs into ffmpeg, in three explicit phases:
//
//   1. video  : parallel, chunked, RESUMABLE  ->  out/video_silent.mp4   (no audio)
//   2. audio  : makes/locates the final mix   ->  out/final_audio.(m4a|wav|flac)
//   3. mux    : video + audio                 ->  out/astra.mp4
//
//   node render.mjs                         # all three phases, in that order
//   node render.mjs --phase video           # or: audio / mux
//   node render.mjs --bench                 # 60-frame speed test: CPU raster vs GPU raster, picks workers
//   node render.mjs --stills 3,40,120       # PNGs for review
// Options: --film astra|edu   --codec h264|av1|both (default both)   --workers N  --chunk 600 (frames per chunk)  --fps 30  --gpu
//          H.264: --encoder x264|amf|nvenc|vaapi|qsv  --crf 17        AV1: --av1enc svt|amf|nvenc|qsv|vaapi  --av1crf 24  --av1preset 6
//          --from S --to S (seconds, video phase)  --force (ignore existing chunks)  --audio file
// Outputs: out/astra_h264.mp4 + out/astra_av1.mp4   |   out/edu/astra_edu_h264.mp4 + out/edu/astra_edu_av1.mp4
// Progress: <outdir>/status.json is rewritten every 2 s (see status.mjs / render_all.mjs)
// Env: FFMPEG=/path/to/ffmpeg  FFPROBE=/path/to/ffprobe
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { try { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); } catch { console.error('playwright not found. Run:  npm install  &&  npx playwright install chromium'); process.exit(1); } }

const argv = process.argv.slice(2);
const has = (k) => argv.includes('--' + k);
const val = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FILM = val('film', 'astra');
const OUTD = FILM === 'astra' ? path.join(ROOT, 'out') : path.join(ROOT, 'out', FILM);
const FFMPEG = process.env.FFMPEG || 'ffmpeg', FFPROBE = process.env.FFPROBE || 'ffprobe';
const IS_WIN = process.platform === 'win32';
fs.mkdirSync(OUTD, { recursive: true });

// ---------------------------------------------------------------- static server
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html');
  const p = path.normalize(path.join(ROOT, rel));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/index.html?render=1${FILM === 'astra' ? '' : '&film=' + FILM}`;

// ---------------------------------------------------------------- browser
const BASE_ARGS = ['--force-color-profile=srgb', '--font-render-hinting=none', '--hide-scrollbars', '--mute-audio'];
const GPU_ARGS = ['--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-zero-copy', ...(IS_WIN ? ['--use-angle=d3d11'] : [])];
const launchArgs = (gpu) => (gpu ? [...BASE_ARGS, ...GPU_ARGS] : [...BASE_ARGS, '--disable-gpu']);
let browser;
async function openBrowser(gpu) { browser = await chromium.launch({ args: launchArgs(gpu) }); return browser; }
async function openPage(b = browser) {
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
  await page.goto(URL_);
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  return page;
}
const shot = (page, f, q = 95) => page.evaluate((t) => window.__seek(t), f / FPS).then(() => page.screenshot({ type: 'jpeg', quality: q }));

// ---------------------------------------------------------------- encoders
const ENC = {
  x264:  (crf) => ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf), '-pix_fmt', 'yuv420p'],
  amf:   (crf) => ['-c:v', 'h264_amf', '-quality', 'quality', '-rc', 'cqp', '-qp_i', String(crf + 1), '-qp_p', String(crf + 3), '-pix_fmt', 'yuv420p'],
  nvenc: (crf) => ['-c:v', 'h264_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', String(crf + 2), '-b:v', '0', '-pix_fmt', 'yuv420p'],
  qsv:   (crf) => ['-c:v', 'h264_qsv', '-global_quality', String(crf + 2), '-pix_fmt', 'nv12'],
  vaapi: (crf) => ['-vaapi_device', '/dev/dri/renderD128', '-vf', 'format=nv12,hwupload', '-c:v', 'h264_vaapi', '-qp', String(crf + 2)],
};
const AV1 = {
  svt:   (c, pr) => ['-c:v', 'libsvtav1', '-preset', String(pr), '-crf', String(c), '-g', '240', '-pix_fmt', 'yuv420p10le', '-svtav1-params', 'tune=0:film-grain=0'],
  amf:   (c) => ['-c:v', 'av1_amf', '-quality', 'quality', '-rc', 'cqp', '-qp_i', String(c), '-qp_p', String(c + 3), '-pix_fmt', 'yuv420p'],
  nvenc: (c) => ['-c:v', 'av1_nvenc', '-preset', 'p6', '-rc', 'vbr', '-cq', String(c), '-b:v', '0', '-pix_fmt', 'yuv420p'],
  qsv:   (c) => ['-c:v', 'av1_qsv', '-global_quality', String(c), '-pix_fmt', 'nv12'],
  vaapi: (c) => ['-vaapi_device', '/dev/dri/renderD128', '-vf', 'format=nv12,hwupload', '-c:v', 'av1_vaapi', '-qp', String(c * 2)],
};
const FPS = +val('fps', 30), CRF = +val('crf', 17), ENCODER = val('encoder', 'x264');
const AV1ENC = val('av1enc', 'svt'), AV1CRF = +val('av1crf', 22), AV1PRESET = +val('av1preset', 6);
const CODEC = val('codec', 'both'); const CODECS = CODEC === 'both' ? ['h264', 'av1'] : [CODEC];
if (!ENC[ENCODER]) { console.error('unknown --encoder', ENCODER); process.exit(1); }
if (!AV1[AV1ENC]) { console.error('unknown --av1enc', AV1ENC); process.exit(1); }
if (!CODECS.every((c) => c === 'h264' || c === 'av1')) { console.error('--codec must be h264, av1 or both'); process.exit(1); }
const encArgs = (codec) => (codec === 'av1' ? AV1[AV1ENC](AV1CRF, AV1PRESET) : ENC[ENCODER](CRF));
const CORES = os.cpus().length;
const WORKERS = +val('workers', Math.max(2, Math.min(8, Math.floor(CORES / 2))));
const CHUNK = +val('chunk', 600);
const GPU = has('gpu');
const NAME = FILM === 'astra' ? 'astra' : 'astra_' + FILM;

// live status for status.mjs / render_all.mjs
const STATUS = path.join(OUTD, 'status.json'); const status = { film: FILM, state: 'starting', phase: '', codecs: CODECS, done: 0, total: 0, fps: 0, etaSec: null, started: new Date().toISOString(), updated: '', message: '', outputs: [] };
const writeStatus = (o = {}) => { Object.assign(status, o, { updated: new Date().toISOString() }); try { fs.writeFileSync(STATUS, JSON.stringify(status, null, 1)); } catch {} };
writeStatus();

function ffmpegChunk(outs) { // outs: { codec: file } - one decode, one encoder per requested codec
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-'];
  for (const [codec, file] of Object.entries(outs)) args.push(...encArgs(codec), '-movflags', '+faststart', file);
  const p = spawn(FFMPEG, args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => { p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))); p.on('error', rej); });
  return { p, done };
}
const run = (cmd, args, opts = {}) => { const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts }); if (r.status !== 0) throw new Error(`${cmd} failed (${r.status})`); };

if (has('timeline')) { // write <out>/timeline.json (caption text + times) and exit
  await openBrowser(false); const page = await openPage(); const tl = await page.evaluate('window.TL');
  fs.writeFileSync(path.join(OUTD, 'timeline.json'), JSON.stringify(tl, null, 1)); console.log('timeline', tl.total.toFixed(1), 's,', tl.scenes.length, 'scenes ->', path.join(OUTD, 'timeline.json'));
  await browser.close(); server.close(); process.exit(0);
}
// ---------------------------------------------------------------- stills
if (has('stills')) {
  await openBrowser(GPU);
  const page = await openPage();
  const tl = await page.evaluate('window.TL');
  fs.writeFileSync(path.join(OUTD, 'timeline.json'), JSON.stringify(tl, null, 1));
  fs.mkdirSync(path.join(OUTD, 'stills'), { recursive: true });
  console.log('timeline total', tl.total.toFixed(2), 's,', tl.scenes.length, 'scenes');
  for (const t of String(val('stills', '0')).split(',').map(Number)) {
    await page.evaluate((x) => window.__seek(x), t);
    const f = path.join(OUTD, 'stills', `t${String(t).replace('.', '_').padStart(6, '0')}.png`);
    await page.screenshot({ path: f }); console.log('wrote', f);
  }
  await browser.close(); server.close(); process.exit(0);
}

// ---------------------------------------------------------------- bench
if (has('bench')) {
  const results = [];
  for (const gpu of [false, true]) {
    try {
      await openBrowser(gpu); const page = await openPage(); const tl = await page.evaluate('window.TL');
      const times = [30, 150, 300, 450, 600].filter((t) => t < tl.total);
      let n = 0; const t0 = Date.now();
      for (const t of times) for (let k = 0; k < 12; k++) { await shot(page, Math.round((t + k / 30) * FPS)); n++; }
      const fps = n / ((Date.now() - t0) / 1000); results.push([gpu ? 'gpu' : 'cpu', fps]);
      console.log(`${gpu ? 'GPU raster' : 'CPU raster'}: ${fps.toFixed(1)} frames/s on ONE worker`);
      await browser.close();
    } catch (e) { console.log(`${gpu ? 'GPU' : 'CPU'} raster failed: ${e.message.split('\n')[0]}`); try { await browser.close(); } catch {} }
  }
  const best = results.sort((a, b) => b[1] - a[1])[0];
  console.log(`\nlogical cores: ${CORES}  ->  suggested: node render.mjs --workers ${WORKERS}${best && best[0] === 'gpu' ? ' --gpu' : ''}`);
  console.log('Total throughput ~= single-worker fps x effective workers (usually 60-85% of --workers on laptops).');
  server.close(); process.exit(0);
}

const PHASE = val('phase', 'all');
const VIDEO = (codec) => path.join(OUTD, `video_silent_${codec}.mp4`);
const CHUNKS = path.join(OUTD, 'video_chunks');

// ---------------------------------------------------------------- phase 1: video
async function phaseVideo() {
  await openBrowser(GPU);
  const probe = await openPage(); const tl = await probe.evaluate('window.TL');
  fs.writeFileSync(path.join(OUTD, 'timeline.json'), JSON.stringify(tl, null, 1));
  await probe.context().close();
  const f0 = Math.round(+val('from', 0) * FPS), f1 = Math.round(Math.min(+val('to', tl.total), tl.total) * FPS);
  if (has('force')) fs.rmSync(CHUNKS, { recursive: true, force: true });
  fs.mkdirSync(CHUNKS, { recursive: true });
  const jobs = []; for (let a = f0; a < f1; a += CHUNK) jobs.push([a, Math.min(f1, a + CHUNK)]);
  for (const c of CODECS) fs.mkdirSync(path.join(CHUNKS, c), { recursive: true });
  const name = (c, [a]) => path.join(CHUNKS, c, `c${String(a).padStart(6, '0')}.mp4`);
  const ok = (f) => fs.existsSync(f) && fs.statSync(f).size > 1000;
  const todo = jobs.filter((j) => !CODECS.every((c) => ok(name(c, j))));
  const label = `${CODECS.map((c) => (c === 'av1' ? `av1/${AV1ENC} crf ${AV1CRF}` : `h264/${ENCODER} crf ${CRF}`)).join(' + ')}`;
  console.log(`VIDEO  [${FILM}] ${f1 - f0} frames (${((f1 - f0) / FPS).toFixed(1)} s) | ${jobs.length} chunks of ${CHUNK} (${jobs.length - todo.length} already done) | ${WORKERS} workers | ${label} | ${GPU ? 'GPU' : 'CPU'} raster`);
  const total = todo.reduce((s, [a, b]) => s + b - a, 0); let done = 0; const t0 = Date.now();
  writeStatus({ state: 'running', phase: 'video', total, done: 0, message: label });
  const isTTY = process.stdout.isTTY; let lastLog = 0;
  const tick = () => { const el = (Date.now() - t0) / 1000, r = done / Math.max(el, 0.001), eta = r > 0 ? Math.round((total - done) / r) : null; writeStatus({ done, fps: +r.toFixed(2), etaSec: eta });
    const line = `  ${done}/${total} frames (${total ? ((100 * done) / total).toFixed(1) : 100}%)  ${r.toFixed(1)} fps  eta ${eta == null ? '?' : Math.floor(eta / 60) + 'm' + String(eta % 60).padStart(2, '0') + 's'}`;
    if (isTTY) process.stdout.write('\r' + line + '    '); else if (Date.now() - lastLog > 15000) { console.log(line); lastLog = Date.now(); } };
  const ticker = setInterval(tick, 2000);
  let next = 0;
  async function worker() {
    const page = await openPage();
    while (next < todo.length) {
      const job = todo[next++]; const [a, b] = job; const outs = Object.fromEntries(CODECS.map((c) => [c, name(c, job) + '.part.mp4']));
      const { p, done: fin } = ffmpegChunk(outs);
      for (let f = a; f < b; f++) {
        const buf = await shot(page, f);
        if (!p.stdin.write(buf)) await new Promise((r) => p.stdin.once('drain', r));
        done++;
      }
      p.stdin.end(); await fin; for (const c of CODECS) fs.renameSync(outs[c], name(c, job));
    }
    await page.context().close();
  }
  await Promise.all(Array.from({ length: Math.min(WORKERS, todo.length || 1) }, worker));
  clearInterval(ticker); tick(); if (isTTY) console.log('');
  await browser.close();
  console.log('  concatenating chunks ...');
  for (const c of CODECS) {
    fs.writeFileSync(path.join(CHUNKS, c, 'list.txt'), jobs.map((j) => `file '${path.basename(name(c, j))}'`).join('\n'));
    run(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', VIDEO(c)], { cwd: path.join(CHUNKS, c) });
    console.log(`  -> ${VIDEO(c)}`);
  }
  console.log(`  video phase: ${((Date.now() - t0) / 1000 / 60).toFixed(1)} min`);
}

// ---------------------------------------------------------------- phase 2: audio
function findAudio() {
  const given = val('audio', null); if (given) return path.resolve(given);
  for (const e of ['m4a', 'flac', 'wav', 'mp3']) { const f = path.join(OUTD, `final_audio.${e}`); if (fs.existsSync(f)) return f; }
  return null;
}
async function exportTimeline() { // timeline.json WITH the current narration.json applied (music + mix are built from it)
  await openBrowser(false); const page = await openPage(); const tl = await page.evaluate('window.TL');
  fs.writeFileSync(path.join(OUTD, 'timeline.json'), JSON.stringify(tl, null, 1)); await browser.close(); browser = null; return tl;
}
const mtime = (f) => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0);
async function phaseAudio() {
  let a = findAudio(); const narr = path.join(OUTD, 'narration.json');
  const stale = !a || (!val('audio', null) && mtime(narr) > mtime(a));
  if (stale) {
    if (!fs.existsSync(narr) && FILM !== 'astra') { console.log('AUDIO  no narration yet for', FILM, '-> silent film (music only is NOT generated without narration)'); }
    const py = IS_WIN ? 'python' : 'python3'; const env = { ...process.env, FILM };
    console.log('AUDIO  (re)building score + mix for', FILM, 'with', py, '(needs numpy + scipy)');
    await exportTimeline();
    run(py, ['music.py'], { cwd: ROOT, env }); run(py, ['mix.py'], { cwd: ROOT, env });
    a = path.join(OUTD, 'final_audio.wav');
  }
  if (a.endsWith('.wav')) { const m4a = path.join(OUTD, 'final_audio.m4a'); run(FFMPEG, ['-y', '-loglevel', 'error', '-i', a, '-c:a', 'aac', '-b:a', '256k', m4a]); a = m4a; }
  console.log('AUDIO  ->', a); return a;
}

// ---------------------------------------------------------------- phase 3: mux
function phaseMux(audio) {
  const from = +val('from', 0); const outs = [];
  for (const c of CODECS) {
    if (!fs.existsSync(VIDEO(c))) throw new Error('missing ' + VIDEO(c) + ' (run --phase video first)');
    const outFile = val('out', null) && CODECS.length === 1 ? path.resolve(ROOT, val('out')) : path.join(OUTD, `${NAME}_${c}.mp4`);
    run(FFMPEG, ['-y', '-loglevel', 'error', '-i', VIDEO(c), ...(from ? ['-ss', String(from)] : []), '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', outFile]);
    console.log('MUX    ->', outFile, `(${(fs.statSync(outFile).size / 1e6).toFixed(0)} MB)`); outs.push(outFile);
  }
  writeStatus({ outputs: outs });
}

try {
  let audio = null;
  if (PHASE === 'all' || PHASE === 'video') await phaseVideo();
  if (PHASE === 'all' || PHASE === 'audio') { writeStatus({ phase: 'audio', state: 'running' }); audio = await phaseAudio(); }
  if (PHASE === 'all' || PHASE === 'mux') { writeStatus({ phase: 'mux', state: 'running' }); phaseMux(audio || findAudio() || await phaseAudio()); }
  writeStatus({ state: 'done', phase: PHASE === 'all' ? 'finished' : PHASE, etaSec: 0 });
} catch (e) { console.error('\nFAILED:', e.message); writeStatus({ state: 'failed', message: e.message }); process.exitCode = 1; }
try { await browser?.close(); } catch {}
server.close();
