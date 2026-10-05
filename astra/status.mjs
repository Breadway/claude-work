// Live status of the renders:  node status.mjs [--watch]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url)); const watch = process.argv.includes('--watch');
const rd = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const tail = (f, n) => { try { return fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean).slice(-n); } catch { return []; } };
const mmss = (s) => (s == null ? '?' : `${Math.floor(s / 3600) ? Math.floor(s / 3600) + 'h ' : ''}${Math.floor((s % 3600) / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s`);
const bar = (p) => { const n = Math.round(p * 30); return '[' + '#'.repeat(n) + '-'.repeat(30 - n) + '] ' + (p * 100).toFixed(1) + '%'; };
function show() {
  const ov = rd(path.join(ROOT, 'logs', 'overall.json')); const out = [];
  out.push(`ASTRA render status  ${new Date().toLocaleTimeString()}`, '');
  for (const film of ['edu', 'astra']) {
    const st = rd(path.join(ROOT, film === 'astra' ? 'out' : path.join('out', film), 'status.json')); const o = ov?.films?.[film];
    const name = film === 'edu' ? 'Film 2 (edu deep-dive)' : 'Film 1 (Astra progression)';
    out.push(`${name}: ${o ? o.state : 'not queued'}${o?.reason ? ' (' + o.reason + ')' : ''}`);
    if (st && o?.state === 'running') {
      const p = st.total ? st.done / st.total : 0;
      out.push(`   phase ${st.phase} | ${st.message || ''}`, `   ${bar(p)}  ${st.done}/${st.total} frames  ${st.fps} fps  eta ${mmss(st.etaSec)}`);
    }
    if (o?.outputs?.length) o.outputs.forEach((x) => out.push('   -> ' + x));
    const lg = tail(path.join(ROOT, 'logs', film + '.log'), 3); if (o && o.state !== 'queued') lg.forEach((l) => out.push('   | ' + l.replace(/\s+$/, '').slice(-110)));
    out.push('');
  }
  out.push('log: logs/render_all.log   per-film: logs/edu.log, logs/astra.log'); return out.join('\n');
}
if (!watch) console.log(show()); else { const t = () => { process.stdout.write('\x1b[2J\x1b[H' + show() + '\n(Ctrl+C to stop watching; the render keeps running)\n'); }; t(); setInterval(t, 4000); }
