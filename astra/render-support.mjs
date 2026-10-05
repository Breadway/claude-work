import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

export function numberOption(value, name, min, max, integer = false) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
    throw new Error(`--${name} must be ${integer ? 'an integer' : 'a number'} between ${min} and ${max}`);
  }
  return n;
}

export function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

export function writeJSON(file, value) {
  const temp = file + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(value, null, 1));
  fs.renameSync(temp, file);
}

export function acquireLock(file) {
  try { fs.writeFileSync(file, String(process.pid), { flag: 'wx' }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const pid = Number(fs.readFileSync(file, 'utf8'));
    if (!Number.isInteger(pid) || pid <= 0) throw new Error(`invalid render lock: ${file}`);
    try { process.kill(pid, 0); }
    catch (check) {
      if (check.code !== 'ESRCH') throw new Error(`render already running (pid ${pid})`);
      fs.rmSync(file);
      return acquireLock(file);
    }
    throw new Error(`render already running (pid ${pid})`);
  }
  return () => {
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === String(process.pid)) fs.rmSync(file);
  };
}

export function sourceHash(root, narration) {
  const hash = createHash('sha256');
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory() && (dir !== root || ['engine', 'scenes', 'scenes_edu', 'assets'].includes(entry.name))) visit(file);
      else if (entry.isFile() && /\.(js|mjs|html|css|woff2|png|jpe?g|svg)$/.test(entry.name)) {
        hash.update(path.relative(root, file)); hash.update(fs.readFileSync(file));
      }
    }
  }
  visit(root);
  if (fs.existsSync(narration)) hash.update(fs.readFileSync(narration));
  return hash.digest('hex');
}

export function probeMedia(probe, file, countPackets = false) {
  const result = spawnSync(probe, ['-v', 'error', ...(countPackets ? ['-count_packets'] : []), '-show_streams', '-of', 'json', file], { encoding: 'utf8', timeout: 30000 });
  if (result.error) throw new Error(`${probe}: ${result.error.message}`);
  if (result.status !== 0 || (countPackets && result.stderr.trim())) return null;
  try { return JSON.parse(result.stdout).streams; } catch { return null; }
}

export function validVideo(probe, file, codec, frames, fps) {
  if (!fs.existsSync(file)) return false;
  const stream = probeMedia(probe, file, true)?.find((s) => s.codec_type === 'video');
  if (!stream) return false;
  const [n, d] = stream.avg_frame_rate.split('/').map(Number);
  // VAAPI AV1 can carry two padding rows while displaying 1080 lines.
  return stream.codec_name === codec && Number(stream.nb_frames) === frames && Number(stream.nb_read_packets) === frames
    && stream.width === 1920 && [1080, 1082].includes(stream.height) && Math.abs(n / d - fps) < 0.001;
}

// Keep every child observable until close. Pipe errors and early exits must reject
// immediately instead of leaving a writer waiting forever for a drain event.
export function startProcess(command, args, options = {}) {
  const child = spawn(command, args, { stdio: 'inherit', ...options });
  const closed = new Promise((resolve) => child.once('close', resolve));
  let failure;
  const done = new Promise((resolve, reject) => {
    child.once('error', (error) => { failure = error; reject(error); });
    child.stdin?.on('error', (error) => { failure = error; reject(error); });
    child.once('close', (code, signal) => {
      if (code === 0 && !failure) resolve();
      else reject(failure || new Error(`${command} exited ${signal || code}`));
    });
  });
  done.catch(() => {});
  const write = (buffer) => new Promise((resolve, reject) => {
    if (failure || child.exitCode !== null || child.signalCode !== null) {
      reject(failure || new Error(`${command} exited before all frames were written`)); return;
    }
    child.stdin.write(buffer, (error) => error ? reject(error) : resolve());
    done.then(() => reject(new Error(`${command} exited before all frames were written`)), reject);
  });
  return { child, done, closed, write };
}

export async function atomicOutput(file, generate, verify = () => true) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.part' + (path.extname(file) || '.mp4');
  try {
    await generate(temp);
    if (!verify(temp)) throw new Error(`invalid output: ${temp}`);
    fs.renameSync(temp, file);
  } finally { fs.rmSync(temp, { force: true }); }
}
