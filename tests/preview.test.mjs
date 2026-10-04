import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPreviewServer, filmCatalog } from '../preview-server.mjs';

async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return `http://127.0.0.1:${server.address().port}`;
}

test('localhost media server supports seeking, HEAD and bounds its served files', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-preview-server-'));
  fs.mkdirSync(path.join(root, 'out', 'edu'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets'));
  fs.writeFileSync(path.join(root, 'index.html'), '<title>viewer</title>');
  fs.writeFileSync(path.join(root, 'out', 'final_audio.m4a'), '0123456789');
  fs.writeFileSync(path.join(root, 'out', 'narration.json'), '{}');
  fs.writeFileSync(path.join(root, 'secret.txt'), 'private');
  fs.symlinkSync('/etc/passwd', path.join(root, 'assets', 'outside.txt'));
  const server = createPreviewServer(root);
  try {
    const url = await listen(server);
    const request = (file, opts) => fetch(url + file, opts);
    const head = await request('/out/final_audio.m4a', { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal(head.headers.get('content-length'), '10'); assert.equal(await head.text(), '');
    for (const [range, expected] of [['bytes=2-5', '2345'], ['bytes=7-', '789'], ['bytes=-3', '789']]) {
      const response = await request('/out/final_audio.m4a', { headers: { Range: range } });
      assert.equal(response.status, 206); assert.equal(await response.text(), expected);
    }
    for (const range of ['bytes=20-', 'bytes=5-2', 'bytes=0-2,4-5', 'bytes=-0', 'bytes=-', 'invalid']) {
      const response = await request('/out/final_audio.m4a', { headers: { Range: range } });
      assert.equal(response.status, 416); assert.equal(response.headers.get('content-range'), 'bytes */10');
    }
    for (const file of ['/secret.txt', '/.git/config', '/assets/outside.txt', '/out/tts/manifest.json', '/%2e%2e/secret.txt']) assert.equal((await request(file)).status, 404);
    assert.equal((await request('/', { method: 'POST' })).status, 405);
    const catalog = await (await request('/api/films')).json();
    assert.equal(catalog[0].audio, '/out/final_audio.m4a'); assert.equal(catalog[1].audio, null);
    assert.equal(filmCatalog(root)[0].narration, true);
  } finally { server.close(); server.closeAllConnections(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('real films play, seek, stay in audio sync and preserve deterministic export', { skip: !process.env.PREVIEW_INTEGRATION, timeout: 120000 }, async () => {
  const { chromium } = await import('playwright');
  const server = createPreviewServer(), url = await listen(server);
  const browser = await chromium.launch({ args: ['--mute-audio', '--enable-gpu-rasterization', '--enable-accelerated-2d-canvas', '--ignore-gpu-blocklist', '--enable-zero-copy', ...(process.platform === 'linux' ? ['--use-angle=gl-egl', '--use-gl=angle'] : [])], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const state = () => page.evaluate(() => ({ time: audio.currentTime, paused: audio.paused, duration: audio.duration, total: TL.total, stats: { ...__previewStats } }));
  try {
    await page.goto(url + '/?t=10');
    await page.waitForFunction(() => window.__previewReady);
    assert.equal(await page.locator('#play').isEnabled(), true);
    await page.locator('#play').click();
    await page.waitForFunction(() => audio.currentTime > 12, null, { timeout: 15000 });
    const playing = await state();
    assert.equal(playing.paused, false); assert.ok(Math.abs(playing.time - playing.stats.time) < 0.1);
    assert.equal(playing.stats.targetFps, 60); assert.ok(playing.stats.frames > 30);
    // A slow visual update must catch up to the continuing audio, without accumulating drift.
    await page.evaluate(() => { const until = performance.now() + 250; while (performance.now() < until) {} });
    await page.waitForFunction(() => Math.abs(audio.currentTime - __previewStats.time) < 0.06);
    await page.locator('#play').click();
    const paused = await state(); assert.equal(paused.paused, true);
    await page.waitForTimeout(150); assert.ok(Math.abs((await state()).time - paused.time) < 0.03);
    const expectedChapter = Number(await page.locator('#chapter option').nth(4).getAttribute('value'));
    await page.locator('#chapter').selectOption({ index: 4 });
    await page.waitForFunction(() => !audio.seeking);
    const chapterState = await state(); assert.ok(Math.abs(chapterState.time - expectedChapter) < 0.03, JSON.stringify({ chapterState, expectedChapter }));
    assert.equal(Number(await page.locator('#chapter').inputValue()), expectedChapter);
    await page.evaluate(() => document.activeElement.blur());
    const before = (await state()).time; await page.keyboard.press('ArrowRight');
    assert.ok(Math.abs((await state()).time - before - 1 / 60) < 0.004);
    await page.locator('#fps').selectOption('30'); assert.equal((await state()).stats.targetFps, 30);
    await page.locator('#captions').click(); assert.equal(await page.locator('#caps').isVisible(), false);
    await page.locator('#captions').click(); assert.equal(await page.locator('#captions').getAttribute('aria-pressed'), 'true');
    await page.locator('#volume').evaluate((input) => { input.value = '0.4'; input.dispatchEvent(new Event('input')); });
    assert.equal(await page.evaluate(() => audio.volume), 0.4);
    await page.locator('#fullscreen').click(); await page.waitForFunction(() => Boolean(document.fullscreenElement));
    assert.equal(await page.evaluate(() => document.fullscreenElement.id), 'viewport');
    const fullscreenBounds = await page.locator('#viewport').boundingBox(); assert.equal(fullscreenBounds.height, 900); assert.equal(fullscreenBounds.width, 1440);
    await page.screenshot({ path: '/tmp/astra-viewer-fullscreen.png' });
    await page.keyboard.press('f'); await page.waitForFunction(() => !document.fullscreenElement);
    await page.locator('#film').selectOption('edu');
    await page.waitForURL('**/?film=edu'); await page.waitForFunction(() => window.__previewReady);
    assert.equal(await page.locator('#chapter option').count(), 17);
    const edu = await state(); assert.ok(edu.duration >= edu.total - 0.05 && edu.duration <= edu.total + 1.55);
    assert.match(await page.evaluate(() => audio.currentSrc), /\/out\/edu\/final_audio\.m4a$/);
    await page.locator('#chapter').selectOption({ index: 10 });
    await page.locator('#play').click(); const start = (await state()).time;
    await page.waitForFunction((t) => audio.currentTime > t + 1, start);
    assert.ok(Math.abs((await state()).time - (await state()).stats.time) < 0.1);
    await page.locator('#play').click();
    // Exercise every retimed scene, including both sides of each overlap.
    await page.evaluate(async () => {
      for (const s of TL.scenes) {
        for (const t of [s.start + 0.01, s.start + s.dur / 2, s.start + s.dur - 0.01]) window.__seek(t);
        await new Promise(requestAnimationFrame);
      }
    });
    await page.locator('#scrub').evaluate((input) => { input.value = '999.98'; input.dispatchEvent(new Event('input')); });
    await page.locator('#play').click(); await page.waitForFunction(() => audio.paused && audio.currentTime >= TL.total);
    await page.locator('#play').click(); await page.waitForFunction(() => !audio.paused && audio.currentTime < 2);
    await page.locator('#play').click();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.locator('#play').isVisible()); assert.ok(await page.locator('#fullscreen').isVisible());
    await page.screenshot({ path: '/tmp/astra-viewer-mobile.png' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url + '/?film=edu&t=10'); await page.waitForFunction(() => window.__previewReady);
    await page.screenshot({ path: '/tmp/astra-viewer-desktop.png' });
    const normalTotal = (await state()).total;
    await page.locator('#pacing').selectOption('original');
    await page.waitForURL('**/\?film=edu&pacing=original'); await page.waitForFunction(() => window.__previewReady);
    const original = await state(); assert.ok(Math.abs(original.total - 4288) < 0.01);
    assert.ok(original.duration >= original.total && original.duration <= original.total + 1.55);
    assert.match(await page.evaluate(() => audio.currentSrc), /\/original\/final_audio\.m4a$/);
    assert.equal(await page.locator('#chapter option').count(), 17);
    await page.locator('#chapter').selectOption({ index: 8 }); await page.locator('#play').click();
    const originalStart = (await state()).time;
    await page.waitForFunction((t) => audio.currentTime > t + 1, originalStart);
    const originalPlaying = await state(); assert.ok(Math.abs(originalPlaying.time - originalPlaying.stats.time) < 0.1);
    await page.locator('#play').click(); await page.locator('#pacing').selectOption('narration');
    await page.waitForURL('**/\?film=edu&pacing=narration');
    await page.waitForFunction(() => window.__previewReady && document.getElementById('pacing').value === 'narration');
    assert.ok(Math.abs((await state()).total - normalTotal) < 0.01);
    await page.route('**/api/films', (route) => route.fulfill({ json: [{ id: 'astra', audio: null, narration: false }] }));
    await page.goto(url + '/'); await page.waitForFunction(() => document.getElementById('status').classList.contains('error'));
    assert.equal(await page.locator('#play').isEnabled(), false); assert.match(await page.locator('#status').textContent(), /missing/);
    await page.unroute('**/api/films');
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(url + '/?render=1'); await page.waitForFunction(() => window.__ready);
    assert.equal(await page.locator('#ui').isVisible(), false); assert.equal(await page.locator('#viewer-header').isVisible(), false);
    assert.equal(await page.evaluate(() => audio.currentSrc), '');
    assert.equal(await page.evaluate(() => document.getElementById('caps').parentElement.id), 'stage');
    await page.evaluate(() => window.__seek(20)); assert.deepEqual(errors, []);
  } finally { await browser.close(); server.close(); server.closeAllConnections(); }
});

test('plain captions fit below the image at 1200p, scaled desktop and mobile sizes', { skip: !process.env.PREVIEW_INTEGRATION, timeout: 120000 }, async () => {
  const { chromium } = await import('playwright');
  const server = createPreviewServer(), url = await listen(server);
  const browser = await chromium.launch({ args: ['--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1200 } });
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  async function checkCaptions(longestOnly = false) {
    const result = await page.evaluate(async (longestOnly) => {
      const candidates = TL.scenes.flatMap((s, sceneIndex) => {
        const previous = TL.scenes[sceneIndex - 1], next = TL.scenes[sceneIndex + 1];
        const domStart = previous ? (previous.start + previous.dur + s.start) / 2 : 0;
        const domEnd = next ? (s.start + s.dur + next.start) / 2 : TL.total;
        return (s.caps || []).map(([at, text], i) => ({
          text, t: Math.max(s.start + at + 0.001, domStart + 0.001),
          end: Math.min(domEnd, s.start + (s.caps[i + 1]?.[0] ?? s.dur - 0.2)),
        }));
      }).filter((c) => c.t < c.end);
      if (longestOnly) candidates.sort((a, b) => b.text.length - a.text.length).splice(20);
      const failures = [];
      for (const c of candidates) {
        window.__seek(c.t);
        await new Promise(requestAnimationFrame);
        const band = document.getElementById('caps').getBoundingClientRect();
        const image = document.getElementById('stage').getBoundingClientRect();
        const box = document.querySelector('#caps .cap');
        if (!box) { failures.push({ text: c.text, reason: 'missing caption' }); continue; }
        const text = box.getBoundingClientRect(), css = getComputedStyle(box);
        const words = [...box.children].map((w) => w.getBoundingClientRect());
        if (band.top < image.bottom - 0.1 || text.top < band.top || text.bottom > band.bottom + 0.1 ||
            words.some((w) => w.left < band.left || w.right > band.right || w.bottom > band.bottom + 0.1) ||
            css.backgroundColor !== 'rgba(0, 0, 0, 0)' || css.borderTopWidth !== '0px' ||
            css.backdropFilter !== 'none' || css.boxShadow !== 'none' ||
            box.textContent.trim() !== c.text.replaceAll('*', '').trim()) {
          failures.push({ text: c.text, band: band.toJSON(), image: image.toJSON(), box: text.toJSON() });
        }
      }
      return { checked: candidates.length, failures };
    }, longestOnly);
    assert.ok(result.checked >= 20, JSON.stringify(result));
    assert.deepEqual(result.failures, []);
  }
  try {
    for (const query of ['?film=astra', '?film=edu', '?film=edu&pacing=original']) {
      await page.goto(url + '/' + query); await page.waitForFunction(() => window.__previewReady);
      await page.locator('#fullscreen').click(); await page.waitForFunction(() => Boolean(document.fullscreenElement));
      await page.waitForFunction(() => document.getElementById('caps').getBoundingClientRect().top === 1080);
      assert.deepEqual(await page.locator('#stage').boundingBox(), { x: 0, y: 0, width: 1920, height: 1080 });
      assert.deepEqual(await page.locator('#caps').boundingBox(), { x: 0, y: 1080, width: 1920, height: 120 });
      await checkCaptions();
      if (query === '?film=edu') await page.screenshot({ path: '/tmp/astra-captions-1200p.png' });
      await page.keyboard.press('f'); await page.waitForFunction(() => !document.fullscreenElement);
    }
    // The same 16:10 layout at 125% desktop scaling keeps the 1080+120 proportions.
    await page.setViewportSize({ width: 1536, height: 960 });
    await page.locator('#fullscreen').click(); await page.waitForFunction(() => Boolean(document.fullscreenElement));
    await page.waitForFunction(() => document.getElementById('caps').getBoundingClientRect().top === 864);
    assert.equal((await page.locator('#caps').boundingBox()).height, 96);
    await checkCaptions(true);
    await page.keyboard.press('f'); await page.waitForFunction(() => !document.fullscreenElement);
    await page.setViewportSize({ width: 390, height: 844 }); await checkCaptions(true);
    await page.screenshot({ path: '/tmp/astra-captions-mobile.png' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); server.close(); server.closeAllConnections(); }
});
