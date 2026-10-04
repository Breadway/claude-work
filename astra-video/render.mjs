// ASTRA video engine - renderer.
// Serves the page, drives headless Chromium to seek frame-by-frame, pipes frames into ffmpeg.
//   node render.mjs --stills 3,12.5,40        -> out/stills/*.png (for review)
//   node render.mjs --out out/astra.mp4 [--from 0 --to 60 --workers 4 --fps 30 --crf 16 --audio out/music.wav]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, r) => (v.startsWith('--') ? [...a, [v.slice(2), r[i + 1] && !r[i + 1].startsWith('--') ? r[i + 1] : true]] : a), []));
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/index.html?render=1`;

const browser = await chromium.launch({ args: ['--disable-gpu', '--force-color-profile=srgb', '--font-render-hinting=none'] });
async function openPage() {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('console.error:', m.text()); });
  await page.goto(url);
  await page.waitForFunction('window.__ready === true', null, { timeout: 60000 });
  return page;
}

if (args.stills) {
  fs.mkdirSync(path.join(ROOT, 'out/stills'), { recursive: true });
  const page = await openPage();
  const tl = await page.evaluate('window.TL');
  console.log('timeline total', tl.total.toFixed(2), 's,', tl.scenes.length, 'scenes');
  fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'out/timeline.json'), JSON.stringify(tl, null, 1));
  for (const t of String(args.stills).split(',').map(Number)) {
    await page.evaluate((t) => window.__seek(t), t);
    const f = path.join(ROOT, `out/stills/t${String(t).replace('.', '_').padStart(6, '0')}.png`);
    await page.screenshot({ path: f });
    console.log('wrote', f);
  }
  await browser.close(); server.close();
  process.exit(0);
}

// ---- full / ranged render ----
const probe = await openPage();
const tl = await probe.evaluate('window.TL');
fs.writeFileSync(path.join(ROOT, 'out/timeline.json'), JSON.stringify(tl, null, 1));
await probe.context().close();
const fps = +(args.fps || tl.fps), from = +(args.from || 0), to = Math.min(+(args.to || tl.total), tl.total);
const f0 = Math.round(from * fps), f1 = Math.round(to * fps);
const workers = +(args.workers || 4), crf = args.crf || 17;
const outFile = path.join(ROOT, args.out || 'out/astra.mp4');
const tmp = path.join(ROOT, 'out/chunks'); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
const per = Math.ceil((f1 - f0) / workers);
console.log(`rendering frames ${f0}..${f1} (${((f1 - f0) / fps).toFixed(1)}s) with ${workers} workers`);
const t0 = Date.now(); let done = 0;

async function worker(k) {
  const a = f0 + k * per, b = Math.min(f1, a + per);
  if (a >= b) return null;
  const page = await openPage();
  const out = path.join(tmp, `c${String(k).padStart(2, '0')}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = a; f < b; f++) {
    await page.evaluate((t) => window.__seek(t), f / fps);
    const buf = await page.screenshot({ type: 'jpeg', quality: 96 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (++done % 60 === 0) {
      const el = (Date.now() - t0) / 1000, rate = done / el, left = (f1 - f0 - done) / rate;
      process.stdout.write(`\r  ${done}/${f1 - f0} frames  ${rate.toFixed(1)} fps  eta ${Math.round(left)}s   `);
    }
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  await page.context().close();
  return out;
}
const chunks = (await Promise.all(Array.from({ length: workers }, (_, k) => worker(k)))).filter(Boolean);
console.log('\nconcatenating', chunks.length, 'chunks');
fs.writeFileSync(path.join(tmp, 'list.txt'), chunks.map((c) => `file '${c}'`).join('\n'));
const audio = args.audio ? path.join(ROOT, args.audio) : null;
const cat = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt')];
if (audio && fs.existsSync(audio)) cat.push('-ss', String(from), '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest');
else cat.push('-c', 'copy');
cat.push(outFile);
execFileSync('ffmpeg', cat, { stdio: 'inherit' });
console.log('done ->', outFile, `(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
await browser.close(); server.close();
