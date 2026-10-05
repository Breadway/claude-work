// ASTRA video engine - portable renderer (Windows / macOS / Linux).
// Drives headless Chromium frame by frame (deterministic seek), pipes lossless PNGs into ffmpeg, in three explicit phases:
//
//   1. video  : parallel, chunked, RESUMABLE  ->  out/video_silent_<codec>.mp4   (no audio)
//   2. audio  : makes/locates the final mix   ->  out/final_audio.(m4a|wav|flac)
//   3. mux    : video + audio                 ->  out/astra_<codec>.mp4
//
//   node render.mjs                         # all three phases, in that order
//   node render.mjs --phase video           # or: audio / mux
//   node render.mjs --bench                 # single-worker capture test: CPU raster vs GPU raster
//   node render.mjs --check-encoders        # test the real GPU encoding/conversion path
//   node render.mjs --stills 3,40,120       # PNGs for review
// Options: --film astra|edu   --codec h264|av1|both (default both)   --workers N  --chunk 600 (frames per chunk)  --fps 30  --cpu-raster
//          H.264: --encoder auto|x264|amf|nvenc|vaapi|qsv  --crf 17   AV1: --av1enc auto|svt|amf|nvenc|qsv|vaapi  --av1crf 22  --av1preset 6
//          --threads N (per encoder)  --capture png|jpeg (default png)  --device /dev/dri/renderD128
//          --from S --to S (seconds, video phase)  --force (ignore existing chunks)  --audio file
// Outputs: out/astra_h264.mp4 + out/astra_av1.mp4   |   out/edu/astra_edu_h264.mp4 + out/edu/astra_edu_av1.mp4
// Progress: <outdir>/status.json is rewritten every 2 s (see status.mjs / render_all.mjs)
// Env: FFMPEG=/path/to/ffmpeg  FFPROBE=/path/to/ffprobe
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { numberOption, readJSON, writeJSON, sourceHash, probeMedia, validVideo, startProcess, atomicOutput, acquireLock } from './render-support.mjs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;

const argv = process.argv.slice(2);
const values = new Set(['film', 'phase', 'codec', 'workers', 'chunk', 'fps', 'encoder', 'crf', 'av1enc', 'av1crf', 'av1preset', 'threads', 'from', 'to', 'capture', 'device', 'out', 'audio', 'stills']);
const flags = new Set(['gpu', 'cpu-raster', 'force', 'bench', 'timeline', 'check-encoders', 'profile']);
const seen = new Set();
for (let i = 0; i < argv.length; i++) {
  const key = argv[i].slice(2);
  if (!argv[i].startsWith('--') || (!values.has(key) && !flags.has(key))) throw new Error('unknown option: ' + argv[i]);
  if (seen.has(key)) throw new Error('duplicate option: --' + key);
  seen.add(key);
  if (values.has(key) && (!argv[++i] || argv[i].startsWith('--'))) throw new Error('missing value for --' + key);
}
const has = (k) => argv.includes('--' + k);
const val = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FILM = val('film', 'astra');
if (!['astra', 'edu'].includes(FILM)) throw new Error('--film must be astra or edu');
const OUTD = FILM === 'astra' ? path.join(ROOT, 'out') : path.join(ROOT, 'out', FILM);
const FFMPEG = process.env.FFMPEG || 'ffmpeg', FFPROBE = process.env.FFPROBE || 'ffprobe';
const IS_WIN = process.platform === 'win32';


// ---------------------------------------------------------------- static server
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'); }
  catch { res.writeHead(400); return res.end(); }
  const p = path.resolve(ROOT, '.' + rel);
  const relative = path.relative(ROOT, p);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  const stream = fs.createReadStream(p); stream.on('error', () => res.destroy()); stream.pipe(res);
});
let URL_;

// ---------------------------------------------------------------- browser
const BASE_ARGS = ['--force-color-profile=srgb', '--font-render-hinting=none', '--hide-scrollbars', '--mute-audio'];
const GPU_ARGS = ['--enable-gpu-rasterization', '--enable-accelerated-2d-canvas', '--ignore-gpu-blocklist', '--enable-zero-copy', ...(IS_WIN ? ['--use-angle=d3d11'] : process.platform === 'linux' ? ['--use-angle=gl-egl', '--use-gl=angle'] : [])];
const launchArgs = (gpu) => (gpu ? [...BASE_ARGS, ...GPU_ARGS] : [...BASE_ARGS, '--disable-gpu']);
let browser;
async function openBrowser(gpu) {
  aborter.signal.throwIfAborted();
  if (!chromium) {
    try { ({ chromium } = require('playwright')); }
    catch { throw new Error('playwright not found. Run: npm install && npx playwright install chromium'); }
  }
  browser = await chromium.launch({ args: launchArgs(gpu), ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  if (aborter.signal.aborted) { await browser.close(); aborter.signal.throwIfAborted(); }
  return browser;
}
async function openPage(b = browser) {
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const session = await ctx.newCDPSession(page);
  page.capture = async () => {
    const { data } = await session.send('Page.captureScreenshot', { format: CAPTURE, ...(CAPTURE === 'jpeg' ? { quality: 95 } : {}), optimizeForSpeed: true, captureBeyondViewport: false });
    return Buffer.from(data, 'base64');
  };
  let pageError;
  page.on('pageerror', (e) => { pageError = e; });
  page.assertHealthy = () => { if (pageError) throw pageError; };
  await page.goto(URL_);
  await page.waitForFunction('window.__ready === true', null, { timeout: 120000 });
  page.assertHealthy(); return page;
}
const metrics = { frames: 0, drawMs: 0, seekMs: 0, captureMs: 0, pipeMs: 0, flushMs: 0 };
const shot = async (page, f) => {
  page.assertHealthy();
  const start = performance.now();
  if (has('profile')) {
    metrics.drawMs += await page.evaluate((t) => { const start = performance.now(); window.__seek(t); return performance.now() - start; }, f / FPS);
  } else await page.evaluate((t) => window.__seek(t), f / FPS);
  const captured = performance.now();
  const buffer = await page.capture();
  metrics.frames++; metrics.seekMs += captured - start; metrics.captureMs += performance.now() - captured;
  return buffer;
};

// ---------------------------------------------------------------- encoders
const ENC = {
  x264:  (crf) => ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf), '-pix_fmt', 'yuv420p'],
  amf:   (crf) => ['-c:v', 'h264_amf', '-quality', 'quality', '-rc', 'cqp', '-qp_i', String(crf + 1), '-qp_p', String(crf + 3), '-pix_fmt', 'yuv420p'],
  nvenc: (crf) => ['-c:v', 'h264_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', String(crf + 2), '-b:v', '0', '-pix_fmt', 'yuv420p'],
  qsv:   (crf) => ['-c:v', 'h264_qsv', '-global_quality', String(crf + 2), '-pix_fmt', 'nv12'],
  vaapi: (crf) => ['-vf', 'format=bgra,hwupload,scale_vaapi=format=nv12:out_color_matrix=bt709:out_range=tv', '-c:v', 'h264_vaapi', '-qp', String(Math.min(51, crf + 2))],
};
const AV1 = {
  svt:   (c, pr) => ['-c:v', 'libsvtav1', '-preset', String(pr), '-crf', String(c), '-g', '240', '-pix_fmt', 'yuv420p10le', '-svtav1-params', `tune=0:film-grain=0:lp=${THREADS}`],
  amf:   (c) => ['-c:v', 'av1_amf', '-quality', 'quality', '-rc', 'cqp', '-qp_i', String(c), '-qp_p', String(Math.min(63, c + 3)), '-pix_fmt', 'p010le'],
  nvenc: (c) => ['-c:v', 'av1_nvenc', '-preset', 'p6', '-rc', 'vbr', '-cq', String(c), '-b:v', '0', '-pix_fmt', 'p010le'],
  qsv:   (c) => ['-c:v', 'av1_qsv', '-global_quality', String(c), '-pix_fmt', 'p010le'],
  vaapi: (c) => ['-vf', 'format=bgra,hwupload,scale_vaapi=format=p010le:out_color_matrix=bt709:out_range=tv', '-c:v', 'av1_vaapi', '-rc_mode', 'CQP', '-global_quality', String(Math.round(c * 4))],
};
const num = (k, d, min, max, integer = false) => numberOption(val(k, d), k, min, max, integer);
const FPS = num('fps', 30, 1, 240), CRF = num('crf', 17, 0, 51);
let ENCODER = val('encoder', 'auto'), AV1ENC = val('av1enc', 'auto');
const AV1CRF = num('av1crf', 22, 0, 63), AV1PRESET = num('av1preset', 6, 0, 13, true);
const CODEC = val('codec', 'both'); const CODECS = CODEC === 'both' ? ['av1', 'h264'] : [CODEC];
if (ENCODER !== 'auto' && !ENC[ENCODER]) throw new Error('unknown --encoder ' + ENCODER);
if (AV1ENC !== 'auto' && !AV1[AV1ENC]) throw new Error('unknown --av1enc ' + AV1ENC);
if (!CODECS.every((c) => c === 'h264' || c === 'av1')) throw new Error('--codec must be h264, av1 or both');
if (has('out') && CODECS.length !== 1) throw new Error('--out requires --codec av1 or --codec h264');
const CORES = os.availableParallelism?.() || os.cpus().length;
const WORKERS = num('workers', Math.max(1, Math.min(2, Math.floor(CORES / 2))), 1, 64, true);
const THREADS = num('threads', Math.max(1, Math.min(4, Math.floor(CORES / WORKERS))), 1, 256, true);
const CHUNK = num('chunk', 600, 1, 1000000, true);
const FROM = num('from', 0, 0, Number.MAX_SAFE_INTEGER);
const TO = num('to', Number.MAX_SAFE_INTEGER, 0, Number.MAX_SAFE_INTEGER);
if (TO <= FROM) throw new Error('--to must be greater than --from');
const PHASE = val('phase', 'all');
if (!['all', 'video', 'audio', 'mux'].includes(PHASE)) throw new Error('--phase must be all, video, audio or mux');
const CAPTURE = val('capture', 'png');
if (!['png', 'jpeg'].includes(CAPTURE)) throw new Error('--capture must be png or jpeg');
const GPU = !has('cpu-raster');
const NAME = FILM === 'astra' ? 'astra' : 'astra_' + FILM;
const encArgs = (codec) => [...(codec === 'av1' ? AV1[AV1ENC](AV1CRF, AV1PRESET) : ENC[ENCODER](CRF)), '-threads', String(THREADS)];
const deviceArgs = (codec) => (codec === 'av1' ? AV1ENC : ENCODER) === 'vaapi' ? ['-vaapi_device', val('device', '/dev/dri/renderD128')] : [];
let GPU_TRANSCODE = false;
const GPU_CONVERT = {
  vaapi: { input: ['-hwaccel', 'vaapi', '-hwaccel_device', val('device', '/dev/dri/renderD128'), '-hwaccel_output_format', 'vaapi'], filter: 'scale_vaapi=w=1920:h=1080:format=nv12' },
  nvenc: { input: ['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda'], filter: 'scale_cuda=w=1920:h=1080:format=yuv420p' },
  qsv: { input: ['-hwaccel', 'qsv', '-hwaccel_output_format', 'qsv'], filter: 'vpp_qsv=w=1920:h=1080:format=nv12' },
  amf: { input: ['-hwaccel', 'd3d11va', '-hwaccel_output_format', 'd3d11'], filter: 'vpp_amf=w=1920:h=1080:format=nv12' },
};
function h264Conversion(input, output, gpu = GPU_TRANSCODE) {
  const encode = encArgs('h264');
  // Replace the software-upload filter when frames already live on the GPU.
  const filterIndex = encode.indexOf('-vf');
  if (filterIndex !== -1) encode.splice(filterIndex, 2);
  const inputArgs = gpu ? GPU_CONVERT[ENCODER].input : [];
  const filter = gpu ? GPU_CONVERT[ENCODER].filter : ENCODER === 'vaapi' ? 'crop=1920:1080,format=nv12,hwupload' : 'crop=1920:1080';
  return ['-y', '-loglevel', 'error', ...deviceArgs('h264'), '-filter_threads', '1', '-threads', String(THREADS), ...inputArgs, '-i', input, '-an', ...encode, '-vf', filter, '-movflags', '+faststart', output];
}
fs.mkdirSync(OUTD, { recursive: true });
const releaseLock = acquireLock(path.join(ROOT, 'out', '.render.lock'));

// live status for status.mjs / render_all.mjs
const STATUS = path.join(OUTD, 'status.json'); const status = { film: FILM, state: 'starting', phase: '', codecs: CODECS, done: 0, total: 0, fps: 0, etaSec: null, started: new Date().toISOString(), updated: '', message: '', outputs: [] };
const writeStatus = (o = {}) => { Object.assign(status, o, { updated: new Date().toISOString() }); try { writeJSON(STATUS, status); } catch {} };
writeStatus();

const children = new Set();
const aborter = new AbortController();
function launch(cmd, args, opts = {}) {
  const process = startProcess(cmd, args, { ...opts, signal: aborter.signal });
  children.add(process);
  process.child.once('close', () => children.delete(process));
  return process;
}
const run = async (cmd, args, opts = {}) => { await launch(cmd, args, opts).done; };
function ffmpegChunk(codec, file) {
  return launch(FFMPEG, ['-y', '-loglevel', 'error', ...deviceArgs(codec), '-filter_threads', '1', '-threads', '1', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', CAPTURE === 'png' ? 'png' : 'mjpeg', '-i', '-', ...encArgs(codec), '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
}
const stop = () => { aborter.abort(); void browser?.close().catch(() => {}); };
process.once('SIGINT', stop); process.once('SIGTERM', stop);

async function configureEncoders() {
  // Probe actual output, not just ffmpeg's compiled-in encoder list.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-encoder-'));
  try {
    for (const codec of CODECS) {
      const requested = codec === 'av1' ? AV1ENC : ENCODER;
      const candidates = requested === 'auto' ? (IS_WIN ? ['amf', 'nvenc', 'qsv'] : ['vaapi', 'nvenc', 'qsv']) : [requested];
      const failures = [];
      let selected = false;
      for (const candidate of candidates) {
        aborter.signal.throwIfAborted();
        if (codec === 'av1') AV1ENC = candidate; else ENCODER = candidate;
        const output = path.join(scratch, `${codec}.mp4`);
        const av1Probe = path.join(scratch, 'av1.mp4');
        const canConvert = codec === 'h264' && CODEC === 'both' && GPU_CONVERT[candidate];
        const args = canConvert ? h264Conversion(av1Probe, output, true) : ['-y', '-loglevel', 'error', ...deviceArgs(codec), '-filter_threads', '1', '-f', 'lavfi', '-i', `color=c=black:s=1920x1080:r=${FPS}`, '-frames:v', '3', ...encArgs(codec), output];
        const probe = launch(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'], timeout: 20000 });
        let errorText = ''; probe.child.stderr.on('data', (data) => { errorText = (errorText + data).slice(-4000); });
        try {
          await probe.done;
          if (!validVideo(FFPROBE, output, codec, 3, FPS)) throw new Error('probe output failed verification');
          const stream = probeMedia(FFPROBE, output).find((s) => s.codec_type === 'video');
          if (codec === 'av1' && !['yuv420p10le', 'p010le'].includes(stream.pix_fmt)) throw new Error('encoder did not produce 10-bit AV1');
          GPU_TRANSCODE = Boolean(canConvert);
          console.log(`ENCODER ${codec}: ${candidate} verified${codec === 'av1' ? ' (10-bit)' : canConvert ? ' (GPU decode + conversion + encode)' : ''}`);
          selected = true; break;
        } catch (error) {
          // Older drivers may encode but lack an AV1 hardware decoder or VPP.
          // Keep hardware encoding and move only decode/conversion to the CPU.
          if (canConvert) {
            await probe.closed;
            const fallback = launch(FFMPEG, h264Conversion(av1Probe, output, false), { stdio: ['ignore', 'ignore', 'pipe'], timeout: 20000 });
            let fallbackError = ''; fallback.child.stderr.on('data', (data) => { fallbackError = (fallbackError + data).slice(-4000); });
            try {
              await fallback.done;
              if (!validVideo(FFPROBE, output, codec, 3, FPS)) throw new Error('fallback output failed verification');
              GPU_TRANSCODE = false; selected = true;
              console.log(`ENCODER h264: ${candidate} verified (CPU decode/conversion, GPU encode; GPU conversion probe failed)`);
              break;
            } catch (fallbackFailure) { failures.push(`${candidate}: ${fallbackError.trim() || fallbackFailure.message}`); }
            finally { await fallback.closed; }
          } else failures.push(`${candidate}: ${errorText.trim() || error.message}`);
        }
        finally { await probe.closed; }
      }
      if (!selected) throw new Error(`no working ${codec} ${requested === 'auto' ? 'GPU ' : ''}encoder. ${failures.join(' | ')}. Check GPU drivers/device access or choose an explicit encoder.`);
    }
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
}

async function main() {
if (has('check-encoders')) { await configureEncoders(); writeStatus({ state: 'done', phase: 'encoder-check' }); return; }
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
URL_ = `http://127.0.0.1:${server.address().port}/index.html?render=1${FILM === 'astra' ? '' : '&film=' + FILM}`;
if (has('timeline')) { // write <out>/timeline.json (caption text + times) and exit
  await openBrowser(false); const page = await openPage(); const tl = await page.evaluate('window.TL');
  fs.writeFileSync(path.join(OUTD, 'timeline.json'), JSON.stringify(tl, null, 1)); console.log('timeline', tl.total.toFixed(1), 's,', tl.scenes.length, 'scenes ->', path.join(OUTD, 'timeline.json'));
  await browser.close(); server.close(); return;
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
    numberOption(t, 'stills', 0, tl.total);
    await page.evaluate((x) => window.__seek(x), t);
    const f = path.join(OUTD, 'stills', `t${String(t).replace('.', '_').padStart(6, '0')}.png`);
    await page.screenshot({ path: f }); console.log('wrote', f);
  }
  await browser.close(); server.close(); return;
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
  server.close(); return;
}

const VIDEO = (codec) => path.join(OUTD, `video_silent_${codec}.mp4`);
const CHUNKS = path.join(OUTD, 'video_chunks');

// ---------------------------------------------------------------- phase 1: video
async function phaseVideo() {
  await configureEncoders();
  await openBrowser(GPU);
  const probe = await openPage(); const tl = await probe.evaluate('window.TL');
  fs.writeFileSync(path.join(OUTD, 'timeline.json'), JSON.stringify(tl, null, 1));
  await probe.context().close();
  const f0 = Math.round(FROM * FPS), f1 = Math.round(Math.min(TO, tl.total) * FPS);
  if (f0 >= f1) throw new Error('render range is empty or beyond the film timeline');
  const primary = CODECS[0];
  const dir = path.join(CHUNKS, primary);
  const config = { version: 2, source: sourceHash(ROOT, path.join(OUTD, 'narration.json')), fps: FPS, from: f0, to: f1, chunk: CHUNK, capture: CAPTURE, gpu: GPU, encoder: encArgs(primary), device: deviceArgs(primary) };
  const manifest = path.join(dir, 'manifest.json');
  if (has('force') || JSON.stringify(readJSON(manifest)) !== JSON.stringify(config)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true }); writeJSON(manifest, config);
  const jobs = []; for (let a = f0; a < f1; a += CHUNK) jobs.push([a, Math.min(f1, a + CHUNK)]);
  const name = ([a]) => path.join(dir, `c${String(a).padStart(6, '0')}.mp4`);
  const todo = jobs.filter((j) => !validVideo(FFPROBE, name(j), primary, j[1] - j[0], FPS));
  const label = primary === 'av1' ? `av1/${AV1ENC} crf ${AV1CRF}` : `h264/${ENCODER} crf ${CRF}`;
  console.log(`VIDEO [${FILM}] ${f1 - f0} frames | ${jobs.length} chunks (${jobs.length - todo.length} already done) | ${WORKERS} workers, ${THREADS} threads/encoder | ${label}`);
  const total = f1 - f0; let done = total - todo.reduce((sum, [a, b]) => sum + b - a, 0); const initialDone = done; const t0 = Date.now();
  writeStatus({ state: 'running', phase: 'video', total, done, message: label });
  const isTTY = process.stdout.isTTY; let lastLog = 0;
  const tick = () => {
    const r = (done - initialDone) / Math.max((Date.now() - t0) / 1000, 0.001), eta = done === total ? 0 : r > 0 ? Math.round((total - done) / r) : null;
    writeStatus({ done, fps: +r.toFixed(2), etaSec: eta });
    const line = `  ${done}/${total} frames (${((100 * done) / total).toFixed(1)}%) ${r.toFixed(1)} fps eta ${eta ?? '?'}s`;
    if (isTTY) process.stdout.write('\r' + line + '    '); else if (Date.now() - lastLog > 15000) { console.log(line); lastLog = Date.now(); }
  };
  const ticker = setInterval(tick, 2000);
  let next = 0;
  async function worker() {
    const page = await openPage();
    try {
      while (next < todo.length) {
        aborter.signal.throwIfAborted();
        const job = todo[next++]; const [a, b] = job;
        await atomicOutput(name(job), async (temp) => {
          const encoder = ffmpegChunk(primary, temp);
          try {
            // At most one capture is prefetched. This overlaps PNG transfer/
            // encoding with the next frame, without reordering frames or
            // changing the page before its current screenshot is complete.
            const capture = (frame) => {
              const pending = Promise.race([shot(page, frame), encoder.done.then(() => { throw new Error('encoder exited early'); })]);
              pending.catch(() => {}); return pending;
            };
            let pending = capture(a);
            for (let f = a; f < b; f++) {
              const buffer = await pending;
              if (f + 1 < b) pending = capture(f + 1);
              const writeStart = performance.now();
              await encoder.write(buffer); metrics.pipeMs += performance.now() - writeStart;
            }
            const flushStart = performance.now();
            encoder.child.stdin.end(); await encoder.done; metrics.flushMs += performance.now() - flushStart;
          } finally {
            if (encoder.child.exitCode === null && encoder.child.signalCode === null) encoder.child.kill('SIGKILL');
            await encoder.closed;
          }
        }, (file) => validVideo(FFPROBE, file, primary, b - a, FPS));
        done += b - a;
      }
    } catch (error) { stop(); throw error; }
    finally { await page.context().close(); }
  }
  const workers = Array.from({ length: Math.min(WORKERS, todo.length) }, worker);
  try {
    await Promise.all(workers);
  } catch (error) {
    stop(); await browser.close(); await Promise.allSettled(workers); throw error;
  } finally { clearInterval(ticker); }
  tick(); if (isTTY) console.log('');
  await browser.close(); browser = null;
  console.log('  concatenating chunks ...');
  fs.writeFileSync(path.join(dir, 'list.txt'), jobs.map((j) => `file '${path.basename(name(j))}'`).join('\n'));
  const primaryMeta = { ...config, frames: total, fromSec: f0 / FPS };
  const primaryRebuilt = todo.length > 0 || JSON.stringify(readJSON(path.join(OUTD, `video_${primary}.json`))) !== JSON.stringify(primaryMeta) || !validVideo(FFPROBE, VIDEO(primary), primary, total, FPS);
  if (primaryRebuilt) await atomicOutput(VIDEO(primary), (file) => run(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', '-movflags', '+faststart', file], { cwd: dir }), (file) => validVideo(FFPROBE, file, primary, total, FPS));
  // Store the actual rounded range so a later --phase mux aligns its audio.
  writeJSON(path.join(OUTD, `video_${primary}.json`), primaryMeta);
  console.log(`  -> ${VIDEO(primary)}`);
  if (CODEC === 'both') {
    const h264Meta = { ...primaryMeta, encoder: encArgs('h264'), device: deviceArgs('h264'), gpuConversion: GPU_TRANSCODE, derivedFrom: config };
    if (!primaryRebuilt && !has('force') && JSON.stringify(readJSON(path.join(OUTD, 'video_h264.json'))) === JSON.stringify(h264Meta) && validVideo(FFPROBE, VIDEO('h264'), 'h264', total, FPS)) {
      console.log('H264   compatibility copy already done'); return;
    }
    console.log('H264   encoding compatibility copy from completed AV1 video ...');
    writeStatus({ phase: 'h264', message: `h264/${ENCODER} from AV1`, total, done: 0, fps: 0, etaSec: null });
    await atomicOutput(VIDEO('h264'), async (file) => {
      const t0 = Date.now();
      const conversion = launch(FFMPEG, ['-progress', 'pipe:1', '-stats_period', '2', ...h264Conversion(VIDEO('av1'), file)], { stdio: ['ignore', 'pipe', 'inherit'] });
      let pending = '';
      conversion.child.stdout.on('data', (data) => {
        const lines = (pending + data).split(/\r?\n/); pending = lines.pop();
        for (const line of lines) if (line.startsWith('frame=')) {
          const done = Math.min(total, Number(line.slice(6)));
          const fps = done / Math.max((Date.now() - t0) / 1000, 0.001);
          writeStatus({ done, fps: +fps.toFixed(2), etaSec: fps > 0 ? Math.round((total - done) / fps) : null });
        }
      });
      await conversion.done;
    }, (file) => validVideo(FFPROBE, file, 'h264', total, FPS));
    writeJSON(path.join(OUTD, 'video_h264.json'), h264Meta);
    console.log(`  -> ${VIDEO('h264')}`);
  }
  console.log(`  video phase: ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  if (has('profile') && metrics.frames) {
    const perFrame = Object.fromEntries(Object.entries(metrics).filter(([key]) => key !== 'frames').map(([key, value]) => [key, +(value / metrics.frames).toFixed(2)]));
    console.log(`PROFILE ${metrics.frames} captured frames; mean ms/frame: ${JSON.stringify(perFrame)} (stages overlap with prefetch)`);
    writeStatus({ profile: perFrame });
  }
}

// ---------------------------------------------------------------- phase 2: audio
function findAudio() {
  const given = val('audio', null); if (given) { const f = path.resolve(given); if (!fs.existsSync(f)) throw new Error('missing --audio ' + f); return f; }
  for (const e of ['wav', 'flac', 'm4a', 'mp3']) { const f = path.join(OUTD, `final_audio.${e}`); if (fs.existsSync(f)) return f; }
  return null;
}
async function exportTimeline() { // timeline.json WITH the current narration.json applied (music + mix are built from it)
  await openBrowser(false); const page = await openPage(); const tl = await page.evaluate('window.TL');
  fs.writeFileSync(path.join(OUTD, 'timeline.json'), JSON.stringify(tl, null, 1)); await browser.close(); browser = null; return tl;
}
const mtime = (f) => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0);
async function phaseAudio() {
  let a = findAudio(); const narr = path.join(OUTD, 'narration.json');
  const stale = !a || (!val('audio', null) && Math.max(mtime(narr), mtime(path.join(ROOT, 'music.py')), mtime(path.join(ROOT, 'mix.py'))) > mtime(a));
  if (stale) {
    if (!fs.existsSync(narr)) console.log('AUDIO no narration for', FILM, '(building music only)');
    const py = IS_WIN ? 'python' : 'python3'; const env = { ...process.env, FILM };
    console.log('AUDIO  (re)building score + mix for', FILM, 'with', py, '(needs numpy + scipy)');
    await exportTimeline();
    await run(py, ['music.py'], { cwd: ROOT, env }); await run(py, ['mix.py'], { cwd: ROOT, env });
    a = path.join(OUTD, 'final_audio.wav');
  }
  if (!a || !fs.existsSync(a)) throw new Error('missing audio: ' + a);
  console.log('AUDIO  ->', a); return a;
}

// ---------------------------------------------------------------- phase 3: mux
async function phaseMux(audio) {
  const outs = [];
  const audioStream = probeMedia(FFPROBE, audio)?.find((s) => s.codec_type === 'audio');
  if (!audioStream) throw new Error('no readable audio stream in ' + audio);
  for (const c of CODECS) {
    if (!fs.existsSync(VIDEO(c))) throw new Error('missing ' + VIDEO(c) + ' (run --phase video first)');
    const meta = readJSON(path.join(OUTD, `video_${c}.json`));
    const from = meta?.fromSec ?? FROM;
    const video = probeMedia(FFPROBE, VIDEO(c))?.find((s) => s.codec_type === 'video');
    if (!video) throw new Error('invalid video: ' + VIDEO(c));
    const duration = Number(video.duration);
    const availableAudio = Number(audioStream.duration);
    if (!Number.isFinite(duration) || (Number.isFinite(availableAudio) && availableAudio < from + duration - 0.05)) throw new Error('audio is shorter than the requested video range');
    const outFile = val('out', null) ? path.resolve(ROOT, val('out')) : path.join(OUTD, `${NAME}_${c}.mp4`);
    if ([VIDEO(c), audio].some((file) => path.resolve(file) === outFile)) throw new Error('--out must differ from the audio and silent video inputs');
    await atomicOutput(outFile, (file) => run(FFMPEG, ['-y', '-loglevel', 'error', '-i', VIDEO(c), ...(from ? ['-ss', String(from)] : []), '-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', ...(audioStream.codec_name === 'aac' ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '256k']), '-t', String(duration), '-movflags', '+faststart', file]));
    console.log('MUX    ->', outFile, `(${(fs.statSync(outFile).size / 1e6).toFixed(0)} MB)`); outs.push(outFile);
    writeStatus({ outputs: [...outs] });
  }
}

  let audio = null;
  if (PHASE === 'all' || PHASE === 'video') await phaseVideo();
  if (PHASE === 'all' || PHASE === 'audio') { writeStatus({ phase: 'audio', state: 'running' }); audio = await phaseAudio(); }
  if (PHASE === 'all' || PHASE === 'mux') { writeStatus({ phase: 'mux', state: 'running' }); await phaseMux(audio || findAudio() || await phaseAudio()); }
  writeStatus({ state: 'done', phase: PHASE === 'all' ? 'finished' : PHASE, etaSec: 0 });
}
try { await main(); }
catch (e) { console.error('\nFAILED:', e.message); writeStatus({ state: 'failed', message: e.message }); process.exitCode = 1; }
finally {
  stop();
  try { await browser?.close(); } catch {}
  for (const child of children) child.child.kill('SIGKILL');
  await Promise.allSettled([...children].map((child) => child.closed));
  server.close();
  process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
  releaseLock();
}
