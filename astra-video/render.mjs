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
// Options: --workers N  --chunk 600 (frames per chunk)  --fps 30  --crf 17  --gpu  --encoder x264|amf|nvenc|vaapi|qsv
//          --from S --to S (seconds, video phase)  --force (ignore existing chunks)  --out out/astra.mp4  --audio file
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
const OUTD = path.join(ROOT, 'out');
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
const URL_ = `http://127.0.0.1:${server.address().port}/index.html?render=1`;

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
const FPS = +val('fps', 30), CRF = +val('crf', 17), ENCODER = val('encoder', 'x264');
if (!ENC[ENCODER]) { console.error('unknown --encoder', ENCODER); process.exit(1); }
const CORES = os.cpus().length;
const WORKERS = +val('workers', Math.max(2, Math.min(8, Math.floor(CORES / 2))));
const CHUNK = +val('chunk', 600);
const GPU = has('gpu');

function ffmpegChunk(out) {
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', ...ENC[ENCODER](CRF), '-movflags', '+faststart', out];
  const p = spawn(FFMPEG, args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => { p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))); p.on('error', rej); });
  return { p, done };
}
const run = (cmd, args, opts = {}) => { const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts }); if (r.status !== 0) throw new Error(`${cmd} failed (${r.status})`); };

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
const VIDEO = path.join(OUTD, 'video_silent.mp4');
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
  const name = ([a]) => path.join(CHUNKS, `c${String(a).padStart(6, '0')}.mp4`);
  const todo = jobs.filter((j) => !(fs.existsSync(name(j)) && fs.statSync(name(j)).size > 1000));
  console.log(`VIDEO  ${f1 - f0} frames (${((f1 - f0) / FPS).toFixed(1)} s) | ${jobs.length} chunks of ${CHUNK} (${jobs.length - todo.length} already done) | ${WORKERS} workers | ${ENCODER} crf ${CRF} | ${GPU ? 'GPU' : 'CPU'} raster`);
  const total = todo.reduce((s, [a, b]) => s + b - a, 0); let done = 0; const t0 = Date.now();
  let next = 0;
  async function worker() {
    const page = await openPage();
    while (next < todo.length) {
      const job = todo[next++]; const [a, b] = job; const tmp = name(job) + '.part.mp4';
      const { p, done: fin } = ffmpegChunk(tmp);
      for (let f = a; f < b; f++) {
        const buf = await shot(page, f);
        if (!p.stdin.write(buf)) await new Promise((r) => p.stdin.once('drain', r));
        if (++done % 30 === 0) { const el = (Date.now() - t0) / 1000, r = done / el; process.stdout.write(`\r  ${done}/${total} frames  ${r.toFixed(1)} fps  eta ${Math.round((total - done) / r)}s    `); }
      }
      p.stdin.end(); await fin; fs.renameSync(tmp, name(job));
    }
    await page.context().close();
  }
  await Promise.all(Array.from({ length: Math.min(WORKERS, todo.length || 1) }, worker));
  await browser.close();
  console.log('\n  concatenating chunks ...');
  const list = jobs.map((j) => `file '${path.basename(name(j))}'`).join('\n');
  fs.writeFileSync(path.join(CHUNKS, 'list.txt'), list);
  run(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', VIDEO], { cwd: CHUNKS });
  console.log(`  -> ${VIDEO}  (${((Date.now() - t0) / 1000 / 60).toFixed(1)} min)`);
}

// ---------------------------------------------------------------- phase 2: audio
function findAudio() {
  const given = val('audio', null); if (given) return path.resolve(given);
  for (const e of ['m4a', 'flac', 'wav', 'mp3']) { const f = path.join(OUTD, `final_audio.${e}`); if (fs.existsSync(f)) return f; }
  return null;
}
function phaseAudio() {
  let a = findAudio();
  if (!a) {
    const py = IS_WIN ? 'python' : 'python3';
    console.log('AUDIO  no final_audio.* found; building from narration + score with', py, '(needs numpy + scipy)');
    run(py, ['music.py'], { cwd: ROOT }); run(py, ['mix.py'], { cwd: ROOT });
    a = path.join(OUTD, 'final_audio.wav');
  }
  if (a.endsWith('.wav')) { // compress once so the mux step is fast and the file is small
    const m4a = path.join(OUTD, 'final_audio.m4a'); run(FFMPEG, ['-y', '-loglevel', 'error', '-i', a, '-c:a', 'aac', '-b:a', '256k', m4a]); a = m4a;
  }
  console.log('AUDIO  ->', a); return a;
}

// ---------------------------------------------------------------- phase 3: mux
function phaseMux(audio) {
  if (!fs.existsSync(VIDEO)) throw new Error('missing ' + VIDEO + ' (run --phase video first)');
  const outFile = path.resolve(ROOT, val('out', 'out/astra.mp4'));
  const from = +val('from', 0);
  run(FFMPEG, ['-y', '-loglevel', 'error', '-i', VIDEO, ...(from ? ['-ss', String(from)] : []), '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', outFile]);
  console.log('MUX    ->', outFile);
}

try {
  let audio = null;
  if (PHASE === 'all' || PHASE === 'video') await phaseVideo();
  if (PHASE === 'all' || PHASE === 'audio') audio = phaseAudio();
  if (PHASE === 'all' || PHASE === 'mux') phaseMux(audio || findAudio() || phaseAudio());
} catch (e) { console.error('\nFAILED:', e.message); process.exitCode = 1; }
try { await browser?.close(); } catch {}
server.close();
