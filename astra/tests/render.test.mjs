import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { numberOption, sourceHash, startProcess, atomicOutput, probeMedia, acquireLock } from '../render-support.mjs';
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('render lock refuses a concurrent invocation and releases cleanly', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-lock-'));
  try {
    const file = path.join(dir, '.render.lock');
    const release = acquireLock(file); assert.throws(() => acquireLock(file), /already running/);
    release(); acquireLock(file)(); assert.equal(fs.existsSync(file), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('invalid numeric options are rejected', () => {
  for (const value of ['NaN', 'Infinity', 0, -1, 1.5]) assert.throws(() => numberOption(value, 'workers', 1, 64, true));
  assert.equal(numberOption('2', 'workers', 1, 64, true), 2);
});

test('source fingerprint includes nested assets and narration', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-hash-'));
  try {
    fs.mkdirSync(path.join(dir, 'assets', 'fonts'), { recursive: true });
    const asset = path.join(dir, 'assets', 'fonts', 'test.woff2'); fs.writeFileSync(asset, 'a');
    const narration = path.join(dir, 'narration.json');
    const first = sourceHash(dir, narration); fs.writeFileSync(asset, 'b');
    const second = sourceHash(dir, narration); assert.notEqual(first, second);
    fs.writeFileSync(narration, '{}'); assert.notEqual(second, sourceHash(dir, narration));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('failed atomic output keeps the previous deliverable', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-atomic-'));
  try {
    const file = path.join(dir, 'film.mp4'); fs.writeFileSync(file, 'good');
    await assert.rejects(atomicOutput(file, async (temp) => { fs.writeFileSync(temp, 'bad'); throw new Error('encoding failed'); }));
    assert.equal(fs.readFileSync(file, 'utf8'), 'good'); assert.deepEqual(fs.readdirSync(dir), ['film.mp4']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('missing executable and early pipe exit reject without hanging', { timeout: 10000 }, async () => {
  const missing = startProcess('astra-nonexistent-executable', [], { stdio: ['pipe', 'ignore', 'ignore'] });
  await assert.rejects(missing.done); await missing.closed;
  const early = startProcess(process.execPath, ['-e', 'process.exit(1)'], { stdio: ['pipe', 'ignore', 'ignore'] });
  await assert.rejects(early.write(Buffer.alloc(4 * 1024 * 1024))); await assert.rejects(early.done); await early.closed;
});

// Real Chromium + FFmpeg integration, isolated from the user's render outputs.
// TEST_GPU=1 exercises the default hardware detection and the actual GPU driver.
test('AV1 then H.264, resume, damaged chunk recovery, range metadata, audio, cancellation and batch failures', { timeout: 240000, skip: !process.env.RENDER_INTEGRATION }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-render-test-'));
  const command = (script, args = [], env = {}) => spawnSync(process.execPath, [script, ...args], { cwd: dir, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 60000 });
  const success = (result) => assert.equal(result.status, 0, result.stdout + result.stderr + (result.error || ''));
  const software = process.env.TEST_GPU ? [] : ['--av1enc', 'svt', '--encoder', 'x264', '--av1preset', '10'];
  const options = ['--from', '30', '--to', '31', '--workers', '2', '--threads', '2', '--chunk', '15', ...software];
  try {
    for (const entry of ['render.mjs', 'render-support.mjs', 'render_all.mjs', 'main.js', 'index.html', 'style.css', 'engine', 'scenes', 'scenes_edu', 'assets']) fs.cpSync(path.join(ROOT, entry), path.join(dir, entry), { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'), 'junction');
    fs.mkdirSync(path.join(dir, 'out'));
    fs.copyFileSync(path.join(ROOT, 'out', 'narration.json'), path.join(dir, 'out', 'narration.json'));
    const audio = path.join(dir, 'audio.wav');
    const generated = spawnSync(process.env.FFMPEG || 'ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=40', '-ac', '2', audio], { encoding: 'utf8' }); success(generated);
    const first = command('render.mjs', [...options, '--audio', audio]); success(first);
    if (process.env.TEST_GPU) {
      assert.match(first.stdout, /h264: vaapi verified \(GPU decode \+ conversion \+ encode\)/);
      assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'out', 'video_h264.json'))).gpuConversion, true);
    }
    assert.ok(first.stdout.indexOf('-> ' + path.join(dir, 'out', 'video_silent_av1.mp4')) < first.stdout.indexOf('H264   encoding'), first.stdout);
    for (const codec of ['av1', 'h264']) {
      const streams = probeMedia(process.env.FFPROBE || 'ffprobe', path.join(dir, 'out', `astra_${codec}.mp4`));
      const video = streams.find((s) => s.codec_type === 'video');
      assert.equal(video.codec_name, codec); assert.equal(Number(video.nb_frames), 30); assert.equal(video.width, 1920);
      assert.ok([1080, 1082].includes(video.height));
      assert.equal(streams.find((s) => s.codec_type === 'audio').codec_name, 'aac');
      if (codec === 'av1') assert.equal(video.pix_fmt, 'yuv420p10le');
    }
    const chunk = path.join(dir, 'out', 'video_chunks', 'av1', 'c000900.mp4');
    const before = fs.statSync(chunk).mtimeMs;
    const resumed = command('render.mjs', [...options, '--phase', 'video']); success(resumed);
    assert.match(resumed.stdout, /2 already done/); assert.match(resumed.stdout, /compatibility copy already done/); assert.equal(fs.statSync(chunk).mtimeMs, before);
    // Preserve the MP4 header, which still claims all frames are present.
    const encoded = fs.readFileSync(chunk); fs.writeFileSync(chunk, encoded.subarray(0, Math.floor(encoded.length / 2)));
    const recovered = command('render.mjs', [...options, '--phase', 'video']); success(recovered); assert.match(recovered.stdout, /1 already done/);
    const range = command('render.mjs', ['--from', '32', '--to', '32.6', '--workers', '2', '--threads', '2', '--chunk', '15', ...software, '--phase', 'video']); success(range); assert.match(range.stdout, /0 already done/);
    const mux = command('render.mjs', ['--phase', 'mux', '--audio', audio]); success(mux);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'out', 'video_av1.json'))).fromSec, 32);
    assert.equal(Number(probeMedia('ffprobe', path.join(dir, 'out', 'astra_h264.mp4')).find((s) => s.codec_type === 'video').nb_frames), 18);
    const badAudio = command('render.mjs', ['--phase', 'mux', '--audio', 'missing.wav']); assert.equal(badAudio.status, 1); assert.match(badAudio.stderr, /missing --audio/);
    const failed = command('render.mjs', ['--phase', 'video', ...software], { FFMPEG: 'astra-missing-ffmpeg' }); assert.equal(failed.status, 1); assert.match(failed.stderr, /no working av1/);
    const batch = command('render_all.mjs', ['--films', 'astra', '--phase', 'mux', '--audio', 'missing.wav']); assert.equal(batch.status, 1);
    const state = JSON.parse(fs.readFileSync(path.join(dir, 'logs', 'overall.json'))); assert.equal(state.films.astra.state, 'failed'); assert.deepEqual(state.films.astra.outputs, []);
    for (const args of [['--workers', '0'], ['--chunk', '0'], ['--phase', 'invalid'], ['--codec', 'bad'], ['--from', '3', '--to', '2'], ['--out', 'custom.mp4'], ['--workers'], ['--unknown']]) assert.equal(command('render.mjs', args).status, 1);
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['render.mjs', '--from', '30', '--to', '34', '--chunk', '60', '--workers', '2', '--threads', '2', ...software, '--phase', 'video', '--force'], { cwd: dir, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '', signalled = false;
      const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('cancelled render did not exit')); }, 15000);
      child.stdout.on('data', (data) => {
        output += data;
        if (output.includes('VIDEO [astra]') && !signalled) { signalled = true; setTimeout(() => child.kill('SIGTERM'), 100); }
      });
      child.once('error', reject);
      child.once('close', (code) => {
        clearTimeout(timeout);
        try {
          assert.equal(signalled, true, output); assert.equal(code, 1);
          assert.equal(fs.existsSync(path.join(dir, 'out', '.render.lock')), false);
          assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'out', 'status.json'))).state, 'failed');
          resolve();
        } catch (error) { reject(error); }
      });
    });
    console.log('Real render integration passed:', process.env.TEST_GPU ? 'GPU AV1 + GPU H.264' : 'SVT-AV1 + x264');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
