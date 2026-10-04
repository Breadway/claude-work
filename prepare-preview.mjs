// Assemble cached TTS on the engine's retimed timeline. No TTS API calls.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { createPreviewServer, FILMS } from './preview-server.mjs';
import { acquireLock, probeMedia, writeJSON } from './render-support.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const FFMPEG = process.env.FFMPEG || 'ffmpeg', FFPROBE = process.env.FFPROBE || 'ffprobe';
const localPython = path.join(ROOT, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const PYTHON = process.env.PYTHON || (fs.existsSync(localPython) ? localPython : 'python3');
const MIX_FILTER = '[1:a]loudnorm=I=-19:TP=-2:LRA=11,aresample=44100,apad=pad_dur=1.5,asplit=2[narr][side];[0:a]volume=0.38[music];[music][side]sidechaincompress=threshold=0.02:ratio=8:attack=30:release=500[duck];[duck][narr]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.92:level=0:latency=1[mix]';
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  const key = args[i];
  if (!['--film', '--pacing'].includes(key) || !args[i + 1] || options[key]) throw new Error('Usage: node prepare-preview.mjs [--film astra|edu] [--pacing narration|original|both]');
  options[key] = args[i + 1];
}
if (options['--film'] && !['astra', 'edu'].includes(options['--film'])) throw new Error('--film must be astra or edu');
const pacing = options['--pacing'] || 'both';
if (!['narration', 'original', 'both'].includes(pacing)) throw new Error('--pacing must be narration, original or both');
const films = options['--film'] ? FILMS.filter((film) => film.id === options['--film']) : FILMS;
const jobs = films.flatMap((film) => (film.id === 'edu' ? pacing === 'both' ? ['narration', 'original'] : [pacing] : ['narration']).map((pacing) => ({ ...film, pacing })));
const server = createPreviewServer();
const release = acquireLock(path.join(ROOT, '.render.lock'));
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-preview-audio-'));
let browser, child;
const aborter = new AbortController();
function stop() { aborter.abort(); child?.kill('SIGTERM'); }
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop);
async function run(command, argv, env = {}, progress = false) {
  aborter.signal.throwIfAborted();
  await new Promise((resolve, reject) => {
    child = spawn(command, argv, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', progress ? 'inherit' : 'ignore', 'pipe'] });
    let errorText = '';
    child.stderr.on('data', (data) => { errorText = (errorText + data).slice(-4000); });
    child.once('error', reject);
    child.once('close', (code) => { child = null; if (code === 0) resolve(); else reject(new Error(`${command} failed: ${errorText}`)); });
  });
  aborter.signal.throwIfAborted();
}
function duration(file) {
  const stream = probeMedia(FFPROBE, file)?.find((s) => s.codec_type === 'audio');
  return Number(stream?.duration);
}
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  browser = await chromium.launch({ args: ['--disable-gpu', '--mute-audio'], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  for (const film of jobs) {
    aborter.signal.throwIfAborted();
    const base = path.join(ROOT, film.id === 'astra' ? 'out' : 'out/edu');
    const dir = film.pacing === 'original' ? path.join(base, 'original') : base;
    fs.mkdirSync(dir, { recursive: true });
    const narrationPath = path.join(base, 'narration.json');
    if (!fs.existsSync(narrationPath)) throw new Error(`${film.id}: missing narration.json. Prepare the cached TTS alignment first.`);
    const narration = JSON.parse(fs.readFileSync(narrationPath));
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    let pageError;
    page.on('pageerror', (error) => { pageError = error; });
    await page.goto(`http://127.0.0.1:${server.address().port}/?render=1&film=${film.id}&pacing=${film.pacing}`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
    if (pageError) throw pageError;
    const tl = await page.evaluate(() => window.TL); await page.close();
    const hash = createHash('sha256').update(JSON.stringify(tl)).update(fs.readFileSync(narrationPath));
    for (const name of ['music_stream.py', 'score_synth.py']) hash.update(fs.readFileSync(path.join(ROOT, name)));
    const scenes = tl.scenes.filter((s) => s.caps.length);
    for (const s of scenes) {
      const n = narration[s.id], audio = path.join(base, 'tts', `${s.id}.wav`);
      if (!n || n.caps.length !== s.caps.length || !s.narr || !fs.existsSync(audio)) throw new Error(`${film.id}/${s.id}: incomplete narration or captions`);
      const actual = duration(audio);
      if (!Number.isFinite(actual) || Math.abs(actual - n.dur) > 0.05) throw new Error(`${film.id}/${s.id}: TTS duration does not match the timing file`);
      hash.update(fs.readFileSync(audio));
    }
    const fingerprint = hash.digest('hex');
    const mixFingerprint = createHash('sha256').update(fingerprint).update(MIX_FILTER).digest('hex');
    writeJSON(path.join(dir, 'timeline.json'), tl);
    const finalAudio = ['m4a', 'wav', 'flac', 'mp3'].map((ext) => path.join(dir, `final_audio.${ext}`)).find((file) => fs.existsSync(file));
    let mixed;
    try { mixed = JSON.parse(fs.readFileSync(path.join(dir, 'preview_mix.json'))); } catch {}
    if (finalAudio && duration(finalAudio) >= tl.total - 0.05 && (!mixed || mixed.fingerprint === mixFingerprint)) {
      console.log(`${film.id}: existing final mix ready (${tl.total.toFixed(3)} s, ${scenes.length} narrated scenes)`); continue;
    }
    if (finalAudio && !mixed) throw new Error(`${film.id}: existing final mix is shorter than the current film. Preserve and rebuild the mix before playback.`);
    const output = path.join(dir, 'preview_audio.m4a'), manifest = path.join(dir, 'preview_audio.json');
    let cached;
    try { cached = JSON.parse(fs.readFileSync(manifest)); } catch {}
    const narrationFull = path.join(dir, 'narration_full.wav');
    if (!(cached?.fingerprint === fingerprint && fs.existsSync(output) && fs.existsSync(narrationFull) && Math.abs(duration(output) - tl.total) < 0.05)) {
      // A disk-backed mono PCM stream bounds memory to one scene and small silence blocks.
      const pcm = path.join(scratch, `${film.id}.s16le`), rate = 48000;
      const fd = fs.openSync(pcm, 'w'), zeros = Buffer.alloc(rate * 2);
      let cursor = 0;
      const silence = (samples) => {
        if (samples < 0) throw new Error(`${film.id}: narration scenes overlap`);
        for (let bytes = samples * 2; bytes > 0;) { const size = Math.min(bytes, zeros.length); fs.writeSync(fd, zeros, 0, size); bytes -= size; }
        cursor += samples;
      };
      try {
        for (const [i, s] of scenes.entries()) {
          const offset = Math.round((s.start + s.narr.lead) * rate);
          silence(offset - cursor);
          const scenePcm = path.join(scratch, 'scene.s16le');
          await run(FFMPEG, ['-y', '-v', 'error', '-threads', '1', '-i', path.join(base, 'tts', `${s.id}.wav`), '-ar', String(rate), '-ac', '1', '-f', 's16le', scenePcm]);
          const data = fs.readFileSync(scenePcm); fs.writeSync(fd, data); cursor += data.length / 2;
          if ((i + 1) % 10 === 0 || i === scenes.length - 1) console.log(`${film.id}: placed ${i + 1}/${scenes.length} narration scenes`);
        }
        silence(Math.round(tl.total * rate) - cursor);
      } finally { fs.closeSync(fd); }
      const temp = path.join(dir, 'preview_audio.tmp.m4a'), narrTemp = path.join(dir, 'narration_full.tmp.wav');
      try {
        await run(FFMPEG, ['-y', '-v', 'error', '-threads', '1', '-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', pcm, '-c:a', 'pcm_s16le', narrTemp, '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', temp]);
        if (Math.abs(duration(temp) - tl.total) > 0.05) throw new Error(`${film.id}: assembled audio duration failed verification`);
        fs.renameSync(temp, output);
        fs.renameSync(narrTemp, narrationFull);
        writeJSON(manifest, { fingerprint, duration: tl.total, scenes: scenes.length, kind: 'narration', timeline: tl });
      } finally { fs.rmSync(temp, { force: true }); fs.rmSync(narrTemp, { force: true }); }
      console.log(`${film.id}: ready -> ${output} (${tl.total.toFixed(3)} s)`);
    }
    let score;
    try { score = JSON.parse(fs.readFileSync(path.join(dir, 'preview_score.json'))); } catch {}
    const music = path.join(dir, 'music.wav');
    if (score?.fingerprint !== fingerprint || !fs.existsSync(music) || duration(music) < tl.total) {
      console.log(`${film.id}: generating procedural score in bounded windows`);
      const program = 'import json,sys; from music_stream import write_score; write_score(json.load(open(sys.argv[1])),sys.argv[2],sys.argv[3])';
      await run(PYTHON, ['-c', program, path.join(dir, 'timeline.json'), film.id, music], { OPENBLAS_NUM_THREADS: '1', OMP_NUM_THREADS: '1' }, true);
      writeJSON(path.join(dir, 'preview_score.json'), { fingerprint });
    }
    const finalTemp = path.join(dir, 'final_audio.preview.tmp.m4a');
    try {
      console.log(`${film.id}: mixing narration, score and transition effects`);
      await run(FFMPEG, ['-y', '-v', 'error', '-filter_complex_threads', '1', '-threads', '1', '-i', music, '-i', narrationFull, '-filter_complex', MIX_FILTER, '-map', '[mix]', '-ar', '44100', '-ac', '2', '-c:a', 'aac', '-b:a', '256k', '-t', String(tl.total + 1.5), '-movflags', '+faststart', finalTemp]);
      const actual = duration(finalTemp);
      if (Math.abs(actual - (tl.total + 1.5)) > 0.05) throw new Error(`${film.id}: final mix duration ${actual} s differs from expected ${tl.total + 1.5} s`);
      fs.renameSync(finalTemp, path.join(dir, 'final_audio.m4a'));
      writeJSON(path.join(dir, 'preview_mix.json'), { fingerprint: mixFingerprint, duration: tl.total + 1.5, kind: 'narration + music + transition effects' });
    } finally { fs.rmSync(finalTemp, { force: true }); }
    console.log(`${film.id}: narration and music mix ready`);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  await browser?.close(); server.close(); server.closeAllConnections();
  fs.rmSync(scratch, { recursive: true, force: true }); release();
  for (const signal of ['SIGINT', 'SIGTERM']) process.removeListener(signal, stop);
}
