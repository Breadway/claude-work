import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.flac': 'audio/flac', '.mp3': 'audio/mpeg' };

export const FILMS = [
  { id: 'astra', title: 'ASTRA: seven generations', description: 'The progression of the Novacana AI, from v1 to v7.' },
  { id: 'edu', title: 'Inside ASTRA', description: 'How the model works and learns, across 17 chapters.' },
];

export function filmCatalog(root = ROOT) {
  return FILMS.map((film) => {
    const dir = film.id === 'astra' ? 'out' : 'out/edu';
    const audio = ['final_audio.m4a', 'final_audio.wav', 'final_audio.flac', 'final_audio.mp3', 'preview_audio.m4a'].find((name) => fs.existsSync(path.join(root, dir, name)));
    const original = film.id === 'edu' && fs.existsSync(path.join(root, dir, 'original/final_audio.m4a'));
    return { ...film, audio: audio ? `/${dir}/${audio}` : null, audioKind: audio?.startsWith('final_') ? 'Narration + music' : 'Narration', narration: fs.existsSync(path.join(root, dir, 'narration.json')), originalAudio: original ? `/${dir}/original/final_audio.m4a` : null };
  });
}

export function createPreviewServer(root = ROOT) {
  const realRoot = fs.realpathSync(root);
  return http.createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/$/, '/index.html'); }
    catch { res.writeHead(400); return res.end(); }
    if (rel === '/api/films') {
      const body = JSON.stringify(filmCatalog(root));
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) });
      return res.end(req.method === 'HEAD' ? undefined : body);
    }
    const allowed = /^\/(index\.html|main\.js|preview\.js|style\.css)$/.test(rel)
      || /^\/(assets|engine|scenes|scenes_edu)\/[\w./-]+$/.test(rel)
      || /^\/out\/(edu\/(original\/)?)?(narration\.json|final_audio\.(m4a|wav|flac|mp3)|preview_audio\.m4a)$/.test(rel);
    if (!allowed || rel.split('/').some((part) => part.startsWith('.'))) { res.writeHead(404); return res.end(); }
    let file, stat;
    try {
      file = fs.realpathSync(path.join(root, rel));
      if (!file.startsWith(realRoot + path.sep)) throw new Error('outside root');
      stat = fs.statSync(file); if (!stat.isFile()) throw new Error('not a file');
    } catch { res.writeHead(404); return res.end(); }
    let start = 0, end = stat.size - 1, status = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (match && (match[1] || match[2])) {
        if (match[1]) { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end; }
        else start = Math.max(0, stat.size - Number(match[2]));
      }
      if (!match || !(match[1] || match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stat.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); return res.end();
      }
      status = 206;
    }
    const headers = { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
    if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    res.writeHead(status, headers);
    if (req.method === 'HEAD' || stat.size === 0) return res.end();
    const stream = fs.createReadStream(file, { start, end });
    stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--port')) throw new Error('Usage: node preview-server.mjs [--port 8080]');
  const port = Number(args[1] || process.env.PORT || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be between 1 and 65535');
  const server = createPreviewServer();
  server.on('error', (error) => { console.error(`Cannot start viewer: ${error.message}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`ASTRA viewer: http://localhost:${port}\nKeep this process running. Press Ctrl+C to stop.`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); server.closeAllConnections(); });
}
