// ASTRA video engine - stage: timeline, transitions, background, HUD, captions, seek().
import { clamp, lerp, E, C, mix, rgba, hn, H, S, A, PH, noise } from './core.js';

export const W = 1920, HT = 1080, FPS = 30;

export class Stage {
  constructor(scenes, narr = null, opts = {}) {
    this.opts = opts; this.film = opts.film || 'astra';
    this.prog = document.getElementById('prog');
    this.stage = document.getElementById('stage');
    this.bg = document.getElementById('bg');
    this.bgx = this.bg.getContext('2d');
    this.grain = document.getElementById('grain');
    this.gx = this.grain.getContext('2d');
    this.gimg = this.gx.createImageData(this.grain.width, this.grain.height);
    this.scenesEl = document.getElementById('scenes');
    this.capsEl = document.getElementById('caps');
    this.hudEl = document.getElementById('hud');
    this.sweep = document.getElementById('sweep');
    this.defs = [];

    // ----- timeline -----
    let cursor = 0;
    // optional narration retiming: scene length follows the spoken audio, and the scene's animation clock is
    // piecewise-linearly warped so each caption's visual cue lands on the word that introduces it.
    if (narr) scenes = scenes.map((sc) => {
      const n = narr[sc.id]; if (!n || !sc.caps || !sc.caps.length) return sc;
      const lead = n.lead ?? 0.5;
      const newCaps = sc.caps.map((c, i) => [lead + n.caps[i], c[1]]);
      const dur = Math.max(lead + n.dur + 1.6, newCaps[newCaps.length - 1][0] + 2.5);
      const pts = [[0, 0], ...sc.caps.map((c, i) => [newCaps[i][0], c[0]]), [dur, Math.max(sc.dur, sc.caps[sc.caps.length - 1][0] + 1)]];
      const warp = (t) => {
        if (t <= 0) return 0;
        for (let k = 1; k < pts.length; k++) if (t <= pts[k][0]) { const [a0, b0] = pts[k - 1], [a1, b1] = pts[k]; return b0 + ((t - a0) / (a1 - a0 || 1)) * (b1 - b0); }
        return pts[pts.length - 1][1] + (t - pts[pts.length - 1][0]);
      };
      return { ...sc, caps: newCaps, dur, warp, narr: { id: sc.id, lead, dur: n.dur } };
    });
    this.scenes = scenes.map((sc, i) => {
      const trans = i === 0 ? 0 : sc.trans ?? 0.8;
      const start = i === 0 ? 0 : cursor - trans;
      cursor = start + sc.dur;
      const root = H('div', { class: 'scene', id: 'sc-' + sc.id }, this.scenesEl);
      const o = { ...sc, trans, start, end: cursor, root, ctx: {} };
      return o;
    });
    this.total = cursor;
    this.scenes.forEach((s, i) => { s.nextTrans = this.scenes[i + 1] ? this.scenes[i + 1].trans : 0; });
    // dominant-scene boundaries (midpoint of each overlap)
    this.scenes.forEach((s, i) => {
      s.domStart = i === 0 ? -1 : s.start + s.trans / 2;
      s.domEnd = i === this.scenes.length - 1 ? s.end + 1 : s.end - s.nextTrans / 2;
    });

    // build scene DOM (all visible at build time so geometry APIs work)
    for (const s of this.scenes) s.state = s.build(s.root, s) || {};
    this.buildHud();
    this.capKey = null;
  }

  buildHud() {
    this.hud = [];
    if (this.film === 'edu') {
      const o = this.opts; const rail = H('div', { class: 'rail17' }, this.hudEl);
      this.segs = Array.from({ length: o.chapters.length }, () => H('i', {}, rail));
      this.railName = H('div', { class: 'railname' }, this.hudEl);
      const loc = H('div', { class: 'loc' }, this.hudEl);
      this.locs = o.loc.map((n) => H('span', { text: n }, loc));
      return;
    }
    for (let v = 1; v <= 7; v++) {
      const d = H('div', { class: 'chip' }, this.hudEl);
      H('b', { text: 'v' + v }, d);
      this.hud.push(d);
    }
  }

  timeline() {
    return {
      total: this.total, fps: FPS,
      scenes: this.scenes.map((s) => ({ id: s.id, title: s.title, start: s.start, dur: s.dur, ver: s.ver ?? null, ch: s.ch ?? null, caps: s.caps || [], narr: s.narr || null })),
    };
  }

  seek(T, frame = Math.round(T * FPS)) {
    T = clamp(T, 0, this.total - 1e-4);
    let dom = this.scenes[0], domW = 0, mA = [0, 0], mB = [0, 0];
    const weights = [];
    for (const s of this.scenes) {
      const t = T - s.start;
      const vis = t > -0.001 && t < s.dur + 0.001;
      if (!vis) { s.root.style.display = 'none'; continue; }
      s.root.style.display = '';
      const wIn = s.trans > 0 ? E.inOutC(clamp(t / s.trans)) : 1;
      const wOut = s.nextTrans > 0 ? 1 - E.inOutC(clamp((t - (s.dur - s.nextTrans)) / s.nextTrans)) : 1;
      let o = wIn * wOut;
      if (s === this.scenes[0]) o *= clamp(T / 0.6);
      if (s === this.scenes[this.scenes.length - 1]) o *= clamp((this.total - T) / 1.2);
      const drift = 1 + (s.drift ?? 0.022) * (t / s.dur);
      const wt = s.warp ? s.warp(Math.max(0, t)) : Math.max(0, t);
      const cam = s.cam ? s.cam(wt, s.state) : null;
      const sc = lerp(0.955, 1, wIn) * lerp(1.07, 1, wOut) * (cam ? cam.s ?? 1 : drift);
      const blur = (1 - wIn) * 10 + (1 - wOut) * 8;
      s.root.style.opacity = o;
      s.root.style.transform = cam ? `translate(${cam.x ?? 0}px,${cam.y ?? 0}px) scale(${sc})` : `scale(${sc})`;
      s.root.style.filter = blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : '';
      s.update(s.warp ? s.warp(Math.max(0, t)) : Math.max(0, t), s.state, s);
      weights.push([s, o]);
      if (o > domW) { domW = o; dom = s; }
    }
    // transition sweep streak
    let sw = 0;
    for (const s of this.scenes) {
      if (s.trans > 0) { const u = (T - s.start) / s.trans; if (u > 0 && u < 1) sw = u; }
    }
    if (sw > 0) {
      const x = lerp(-700, W + 300, E.inOutC(sw));
      this.sweep.style.opacity = Math.sin(sw * Math.PI) * 0.9;
      this.sweep.style.transform = `translateX(${x}px) skewX(-18deg)`;
    } else this.sweep.style.opacity = 0;

    if (this.prog) this.prog.style.width = (T / this.total) * 100 + '%';
    this.drawBg(T, weights, frame);
    this.updateHud(T);
    this.updateCaps(T);
    this.drawGrain(frame);
  }

  moodOf(s) { return s.mood || [C.cyan, C.purple, C.blue]; }

  drawBg(T, weights, frame) {
    const x = this.bgx;
    // blended mood
    let tot = 0; const cols = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const [s, o] of weights) {
      const m = this.moodOf(s);
      for (let i = 0; i < 3; i++) {
        const h = m[i] || m[0];
        const v = [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
        for (let j = 0; j < 3; j++) cols[i][j] += v[j] * o;
      }
      tot += o;
    }
    tot = tot || 1;
    const col = cols.map((c) => `rgb(${c.map((v) => Math.round(v / tot)).join(',')})`);
    const colA = (i, a) => col[i].replace('rgb', 'rgba').replace(')', `,${a})`);

    x.fillStyle = C.bg; x.fillRect(0, 0, W, HT);
    // aurora blobs
    const blobs = [
      [0.22 + 0.10 * Math.sin(T * 0.11), 0.30 + 0.08 * Math.cos(T * 0.09), 760, 0, 0.20],
      [0.78 + 0.08 * Math.cos(T * 0.07), 0.68 + 0.10 * Math.sin(T * 0.13), 820, 1, 0.17],
      [0.55 + 0.12 * Math.sin(T * 0.05 + 2), 0.12 + 0.05 * Math.cos(T * 0.17), 600, 2, 0.12],
    ];
    for (const [bx, by, r, ci, a] of blobs) {
      const g = x.createRadialGradient(bx * W, by * HT, 0, bx * W, by * HT, r);
      g.addColorStop(0, colA(ci, a)); g.addColorStop(1, colA(ci, 0));
      x.fillStyle = g; x.fillRect(0, 0, W, HT);
    }
    // dot grid
    x.fillStyle = 'rgba(120,150,190,0.09)';
    const gs = 44, off = (T * 3) % gs;
    for (let gx = -off; gx < W; gx += gs) for (let gy = 0; gy < HT; gy += gs) x.fillRect(gx, gy, 1.5, 1.5);
    // stars in 3 parallax layers
    for (let L = 0; L < 3; L++) {
      const n = 70 + L * 20, sp = 6 + L * 14, sz = 0.8 + L * 0.7;
      for (let i = 0; i < n; i++) {
        const bx = hn(i, L, 1) * W, by = hn(i, L, 2) * HT;
        const px = (((bx - T * sp) % W) + W) % W;
        const py = by + Math.sin(T * 0.3 + i) * 6 * (L + 1) * 0.4;
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(T * (0.8 + hn(i, L, 3) * 2) + i * 7));
        x.fillStyle = `rgba(210,230,255,${(0.10 + L * 0.12) * tw})`;
        x.fillRect(px, py, sz, sz);
      }
    }
    // shooting star every ~9s
    const per = 9, k = Math.floor(T / per), u = (T - k * per) / 1.1;
    if (u >= 0 && u < 1) {
      const sx = hn(k, 9) * W * 0.7, sy = hn(k, 10) * HT * 0.4;
      const hx = sx + u * 520, hy = sy + u * 240;
      const g = x.createLinearGradient(hx - 160, hy - 74, hx, hy);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, `rgba(190,240,255,${0.8 * Math.sin(u * Math.PI)})`);
      x.strokeStyle = g; x.lineWidth = 2; x.beginPath(); x.moveTo(hx - 160, hy - 74); x.lineTo(hx, hy); x.stroke();
    }
  }

  drawGrain(frame) {
    const d = this.gimg.data, n = d.length / 4, f = frame * 7919;
    for (let i = 0; i < n; i++) {
      const v = ((Math.imul(i + f, 2654435761) >>> 24) & 255);
      d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
    }
    this.gx.putImageData(this.gimg, 0, 0);
  }

  updateHud(T) {
    let cur = null;
    for (const s of this.scenes) if (T >= s.domStart && T < s.domEnd) cur = s;
    if (this.film === 'edu') {
      const ch = cur?.ch ?? 0;
      this.hudEl.style.opacity = ch ? 1 : 0;
      this.segs.forEach((e, i) => { e.className = i + 1 === ch ? 'on' : i + 1 < ch ? 'done' : ''; });
      this.railName.textContent = ch ? `${String(ch).padStart(2, '0')} · ${this.opts.chapters[ch - 1]}` : '';
      this.locs.forEach((e, i) => { e.className = this.opts.loc[i].toLowerCase() === (cur?.loc || '') ? 'on' : ''; });
      return;
    }
    const v = cur?.ver ?? null;
    this.hudEl.style.opacity = v ? 1 : 0.0;
    this.hud.forEach((c, i) => {
      const n = i + 1;
      c.className = 'chip' + (n === v ? ' on' : n < v ? ' done' : '');
    });
  }

  updateCaps(T) {
    let cur = null;
    for (const s of this.scenes) if (T >= s.domStart && T < s.domEnd) cur = s;
    if (!cur || !cur.caps || !cur.caps.length) { this.capsEl.innerHTML = ''; this.capKey = null; return; }
    const t = T - cur.start;
    let idx = -1;
    for (let i = 0; i < cur.caps.length; i++) if (t >= cur.caps[i][0]) idx = i;
    if (idx < 0) { this.capsEl.innerHTML = ''; this.capKey = null; return; }
    const key = cur.id + ':' + idx;
    if (key !== this.capKey) {
      this.capKey = key;
      this.capsEl.innerHTML = '';
      const box = H('div', { class: 'cap' }, this.capsEl);
      const words = cur.caps[idx][1].split(' ');
      let hl = false;
      words.forEach((w) => {
        let h = hl;
        if (w.startsWith('*')) { hl = true; h = true; w = w.slice(1); }
        if (w.includes('*')) { w = w.replace('*', ''); hl = false; h = true; }
        H('span', { text: w, class: h ? 'w hl' : 'w' }, box);
        box.appendChild(document.createTextNode(' '));
      });
      this.capBox = box;
    }
    const at = cur.caps[idx][0];
    const nextAt = idx + 1 < cur.caps.length ? cur.caps[idx + 1][0] : cur.dur - 0.2;
    const lt = t - at;
    const spans = this.capBox.querySelectorAll('.w');
    spans.forEach((sp, i) => {
      const p = E.outC(clamp((lt - i * 0.06) / 0.4));
      sp.style.opacity = p;
      sp.style.transform = `translateY(${(1 - p) * 14}px)`;
    });
    const out = clamp((nextAt - t) / 0.3);
    this.capBox.style.opacity = idx + 1 < cur.caps.length ? 1 : out;
    this.capBox.style.transform = `translateY(${(1 - E.outC(clamp(lt / 0.35))) * 10}px)`;
  }
}
