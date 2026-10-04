// ASTRA video engine - kit: reusable motion-design components. All are pure f(t).
import { S, H, G, T, P, PH, C, E, pr, clamp, lerp, mix, rgba, fmt, drawOn, travel, bump, sbump, hn, rng, noise, curve, A } from './core.js';

/** Scene header: eyebrow, big title, optional sub. Animated in, sits top-left. */
export function header(parent, { kicker, title, sub, x = 100, y = 78, accent = C.cyan }) {
  const g = G(parent);
  const k = T(g, kicker, { x, y, size: 17, w: 700, fill: accent, a: 'start', ls: 3.2, caps: true });
  const bar = S('rect', { x, y: y + 20, width: 54, height: 3, rx: 1.5, fill: accent }, g);
  const t = T(g, title, { x, y: y + 66, size: 58, w: 700, fill: C.text, a: 'start', ls: -1.6 });
  const s = sub ? T(g, sub, { x, y: y + 118, size: 24, w: 450, fill: C.muted, a: 'start' }) : null;
  return {
    g,
    update(t0, d = 0) {
      const a = pr(t0, d + 0.0, 0.5), b = pr(t0, d + 0.12, 0.7, E.outQ4), c = pr(t0, d + 0.5, 0.6);
      k.setAttribute('transform', `translate(${(-(1 - a) * 30).toFixed(1)} 0)`); k.setAttribute('opacity', a);
      bar.setAttribute('width', 54 * a); bar.setAttribute('opacity', a);
      t.setAttribute('transform', `translate(0 ${((1 - b) * 26).toFixed(1)})`); t.setAttribute('opacity', b);
      if (s) { s.setAttribute('transform', `translate(0 ${((1 - c) * 14).toFixed(1)})`); s.setAttribute('opacity', c); }
    },
  };
}

/** Node card in the style of the atlas: centred at 0,0. */
export function card(parent, { w = 260, h = 96, kicker, title, sub, shape, accent = C.cyan, size = 22 }) {
  const g = G(parent);
  const glow = S('rect', { x: -w / 2 - 4, y: -h / 2 - 4, width: w + 8, height: h + 8, rx: 16, fill: 'none', stroke: accent, 'stroke-width': 8, 'stroke-opacity': 0.0 }, g);
  S('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 13, fill: 'url(#surface)', stroke: '#2c3e55', 'stroke-width': 1.4, filter: 'url(#soft)' }, g);
  const edge = S('rect', { x: -w / 2, y: -h / 2 + 12, width: 4, height: h - 24, rx: 2, fill: accent, opacity: 0.9 }, g);
  const ox = -w / 2 + 22;
  let yy = -h / 2 + 24;
  if (kicker) { T(g, kicker, { x: ox, y: yy, size: 12.5, w: 700, fill: accent, a: 'start', ls: 1.8, caps: true }); yy += 25; }
  if (title) { T(g, title, { x: ox, y: yy, size, w: 640, a: 'start', ls: -0.3 }); yy += size + 6; }
  if (sub) { T(g, sub, { x: ox, y: yy, size: 15.5, w: 450, fill: '#a9bacf', a: 'start' }); yy += 22; }
  if (shape) T(g, shape, { x: ox, y: h / 2 - 16, size: 13.5, w: 500, fill: mix(accent, '#ffffff', 0.15), a: 'start', m: true });
  g.glow = glow;
  g.pulse = (v) => glow.setAttribute('stroke-opacity', (0.28 * v).toFixed(3));
  return g;
}

/** small pill label */
export function pill(parent, str, { x = 0, y = 0, color = C.cyan, size = 15, padX = 14, h = 30, fill = '#0d1726', mono = true, w: ww } = {}) {
  const g = G(parent);
  const w = ww ?? str.length * size * 0.6 + padX * 2;
  S('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: h / 2, fill, stroke: rgba(color, 0.5), 'stroke-width': 1.3 }, g);
  T(g, str, { size, w: 600, fill: color, m: mono });
  g.setAttribute('transform', `translate(${x} ${y})`);
  g.w = w;
  return g;
}

/** big stat tile with count-up value */
export function stat(parent, { x, y, label, color = C.cyan, w = 270, h = 120, big = 52, suffix = '', dec = 0, prefix = '' }) {
  const g = G(parent);
  S('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 16, fill: '#0b1320', stroke: '#26354a', 'stroke-width': 1.3, filter: 'url(#soft)' }, g);
  S('rect', { x: -w / 2, y: -h / 2, width: w, height: 4, rx: 2, fill: color, opacity: 0.85 }, g);
  T(g, label, { x: 0, y: -h / 2 + 27, size: 13.5, w: 650, fill: C.faint, ls: 2, caps: true });
  const v = T(g, '', { x: 0, y: 12, size: big, w: 720, fill: color, ls: -1.5 });
  const api = {
    g,
    set(val, o = 1, s = 1, dy = 0) {
      v.textContent = prefix + (dec ? val.toFixed(dec) : fmt(val)) + suffix;
      P(g, { x, y: y + dy, s, o });
    },
  };
  return api;
}

/** big reveal text split into glyphs (letters rise + de-blur). Use single words (no spaces). */
export function glyphs(parent, str, { x, y, size = 200, w = 800, fill = C.text, ls = -4, a = 'middle', stagger = 0.07 } = {}) {
  const g = G(parent);
  const meas = (s) => { const t = T(g, s, { size, w, ls, a: 'start' }); const L = t.getComputedTextLength(); g.removeChild(t); return L; };
  const total = meas(str);
  const x0 = a === 'middle' ? x - total / 2 : x;
  const items = [...str].map((ch, i) => {
    const t = T(g, ch, { x: 0, y: 0, size, w, ls, a: 'start', fill });
    t.__x = x0 + (i ? meas(str.slice(0, i)) : 0);
    return t;
  });
  return {
    g, total,
    update(t0, d = 0) {
      items.forEach((t, i) => {
        const p = pr(t0, d + i * stagger, 0.8, E.outQ4);
        t.setAttribute('transform', `translate(${t.__x.toFixed(1)} ${(y + (1 - p) * 70).toFixed(1)}) scale(${lerp(0.88, 1, p).toFixed(3)})`);
        t.setAttribute('opacity', p);
        t.style.filter = p < 0.99 ? `blur(${((1 - p) * 16).toFixed(1)}px)` : '';
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Network drawing
// ---------------------------------------------------------------------------
/**
 * cols: [{x, n, color, label, sub, r}]   (n = nodes drawn)
 * returns {update(t,{start,stag,wave,speed,skipAt})}
 */
export function buildNet(parent, { cols, yc = 520, gap = 44, wireAlpha = 0.16, skips = [], labelY = 150, nodeR = 8, seed = 1, links }) {
  const g = G(parent);
  const wG = G(g), sG = G(g), nG = G(g), lG = G(g);
  const R = rng(seed);
  cols.forEach((c) => {
    c.yc = c.yc ?? yc;
    c.ys = Array.from({ length: c.n }, (_, i) => c.yc + (i - (c.n - 1) / 2) * (c.gap ?? gap));
    c.top = c.ys[0]; c.bot = c.ys[c.n - 1];
    c.nodes = c.ys.map((y, i) => {
      const n = S('circle', { cx: 0, cy: 0, r: c.r ?? nodeR, fill: mix(c.color, '#0b1320', 0.55), stroke: c.color, 'stroke-width': 1.8 }, nG);
      n.__y = y; n.__ph = R() * 6.28; return n;
    });
    c.lab = c.label ? T(lG, c.label, { x: c.x, y: c.yc + (c.labelY ?? labelY), size: 21, w: 650, fill: C.text, ls: -0.3 }) : null;
    c.sublab = c.sub ? T(lG, c.sub, { x: c.x, y: c.yc + (c.labelY ?? labelY) + 28, size: 15, w: 500, fill: mix(c.color, '#ffffff', 0.2), m: true }) : null;
  });
  const wires = [];
  const L = links || cols.slice(0, -1).map((_, i) => [i, i + 1]);
  for (const [ia, ib] of L) {
    const a = cols[ia], b = cols[ib];
    const group = [];
    group.a = ia;
    for (const ya of a.ys) for (const yb of b.ys) {
      const d = `M${a.x} ${ya} L${b.x} ${yb}`;
      const p = S('path', { d, fill: 'none', stroke: mix(a.color, b.color, 0.5), 'stroke-opacity': wireAlpha, 'stroke-width': 1 }, wG);
      const pl = S('path', { d, fill: 'none', stroke: '#e8fffb', 'stroke-opacity': 0, 'stroke-width': 1.8, 'stroke-linecap': 'round' }, wG);
      p.__len = pl.__len = Math.hypot(b.x - a.x, yb - ya);
      group.push({ p, pl, r: R() });
    }
    wires.push(group);
  }
  const arcs = skips.map(([i, j, col = C.purple]) => {
    const a = cols[i], b = cols[j];
    const y0 = Math.min(a.top, b.top) - 22, yUp = y0 - 62;
    const d = `M${a.x} ${y0} C${a.x} ${yUp} ${b.x} ${yUp} ${b.x} ${y0}`;
    const p = S('path', { d, fill: 'none', stroke: col, 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-dasharray': '7 7' }, sG);
    const flow = S('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0 }, sG);
    const plus = G(sG); S('circle', { r: 15, fill: '#150f2e', stroke: col, 'stroke-width': 2 }, plus); T(plus, '+', { size: 24, w: 700, fill: col, y: -1 });
    plus.setAttribute('transform', `translate(${b.x} ${y0 - 36})`);
    p.__len = flow.__len = p.getTotalLength();
    return { p, flow, plus, col };
  });

  const api = {
    g, cols, wires, arcs,
    update(t, { start = 0.2, stag = 0.3, wave = 1e9, speed = 1.1, skipAt = 1e9, dim = 1, labelsAt = null } = {}) {
      const nC = Math.max(...cols.map((c, i) => c.stage ?? i)) + 1;
      const period = nC + 1.6;
      const ph = t >= wave ? ((t - wave) * speed) % period : -99;
      cols.forEach((c, ci) => {
        const i = c.stage ?? ci;
        const p = pr(t, start + i * stag, 0.55, E.outBack);
        const act = ph > -50 ? sbump(ph, i + 0.2, 1.1) : 0;
        c.nodes.forEach((n, k) => {
          const flick = ph > -50 ? 0.5 + 0.5 * Math.sin(t * 5 + n.__ph) : 0;
          P(n, { x: c.x, y: n.__y, s: p * (1 + act * 0.35), o: p * dim });
          n.setAttribute('fill', mix(mix(c.color, '#0b1320', 0.62), c.color, act * (0.35 + 0.65 * flick)));
          n.style.filter = act > 0.4 ? 'url(#glow)' : '';
        });
        const lp = labelsAt == null ? pr(t, start + i * stag + 0.25, 0.5) : pr(t, labelsAt + i * 0.12, 0.5);
        if (c.lab) { c.lab.setAttribute('opacity', lp * dim); c.lab.setAttribute('transform', `translate(0 ${(1 - lp) * 10})`); }
        if (c.sublab) { c.sublab.setAttribute('opacity', lp * dim); c.sublab.setAttribute('transform', `translate(0 ${(1 - lp) * 10})`); }
      });
      wires.forEach((grp) => {
        const i = cols[grp.a].stage ?? grp.a;
        const wp = pr(t, start + i * stag + 0.15, 0.7, E.outQ);
        const u = ph - i; // pulse position across this wire layer
        grp.forEach((w) => {
          w.p.setAttribute('stroke-opacity', wireAlpha * wp * dim);
          if (u > -0.05 && u < 1.05) {
            const uu = clamp((u - w.r * 0.25) / 0.75);
            travel(w.pl, uu, 22);
            w.pl.setAttribute('stroke-opacity', 0.9 * Math.sin(uu * Math.PI) * dim);
          } else w.pl.setAttribute('stroke-opacity', 0);
        });
      });
      arcs.forEach((a, i) => {
        const sp = pr(t, skipAt + i * 0.35, 0.7, E.outQ);
        drawOn(a.p, sp); a.p.style.strokeDasharray = sp < 0.999 ? `${a.p.__len} ${a.p.__len + 2}` : '7 7';
        a.p.setAttribute('opacity', sp * dim);
        P(a.plus, { x: cols[skips[i][1]].x, y: Math.min(cols[skips[i][0]].top, cols[skips[i][1]].top) - 58, s: pr(t, skipAt + i * 0.35 + 0.5, 0.5, E.outBack), o: dim });
        if (t > skipAt + 1.2 + i * 0.35) {
          travel(a.flow, ((t - skipAt) * 0.7 + i * 0.4) % 1, 36);
          a.flow.setAttribute('opacity', 0.75 * dim);
        } else a.flow.setAttribute('opacity', 0);
      });
    },
  };
  return api;
}

/** progress ring / arc gauge helper: returns arc path d for fraction f of a circle */
export function arcPath(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  return `M${x0} ${y0} A${r} ${r} 0 ${large} ${a1 > a0 ? 1 : 0} ${x1} ${y1}`;
}

/** a bar (horizontal) with label + value text. returns update(frac, o) */
export function hbar(parent, { x, y, w, h = 30, color = C.cyan, label, labelW = 260, valFmt = (v) => v.toFixed(1) + '%', max = 100, size = 20 }) {
  const g = G(parent);
  T(g, label, { x: x - 16, y: y + h / 2, size, w: 560, a: 'end', fill: C.text });
  S('rect', { x, y, width: w, height: h, rx: h / 2, fill: '#0d1726', stroke: '#26354a', 'stroke-width': 1.2 }, g);
  const fillR = S('rect', { x, y, width: 0, height: h, rx: h / 2, fill: color }, g);
  const val = T(g, '', { x: x + 12, y: y + h / 2, size: size - 1, w: 700, a: 'start', fill: '#07101c', m: true });
  return {
    g,
    set(v, o = 1) {
      const wv = Math.max(h, (v / max) * w);
      fillR.setAttribute('width', v <= 0 ? 0 : wv);
      val.textContent = v <= 0 ? '' : valFmt(v);
      val.setAttribute('x', x + wv - 14); val.setAttribute('text-anchor', 'end');
      g.setAttribute('opacity', o); g.style.display = o < 0.003 ? 'none' : '';
    },
  };
}

/** floating "chip" with an icon-less label, used for challenge lists etc. */
export function tag(parent, str, { x, y, color = C.cyan, size = 17 }) {
  return pill(parent, str, { x, y, color, size, mono: false });
}

/** typed code/terminal text, deterministic: reveals chars by progress */
export function typed(str, p) { return str.slice(0, Math.floor(clamp(p) * str.length)); }

/** scale about (cx,cy) then translate: for shrinking whole groups */
export function xf(g, { tx = 0, ty = 0, s = 1, cx = 960, cy = 540, o = 1 } = {}) {
  g.setAttribute('transform', `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) translate(${cx} ${cy}) scale(${s.toFixed(4)}) translate(${-cx} ${-cy})`);
  g.setAttribute('opacity', o.toFixed(3));
  g.style.display = o < 0.003 ? 'none' : '';
}

/** rounded panel centred at (0,0) in its own group; place with P(). */
export function panel(parent, { w, h, kicker, title, color = C.cyan, fillId = 'surface' }) {
  const g = G(parent);
  S('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 18, fill: `url(#${fillId})`, stroke: '#2c3e55', 'stroke-width': 1.4, filter: 'url(#soft)' }, g);
  S('rect', { x: -w / 2 + 22, y: -h / 2, width: 60, height: 3.5, rx: 2, fill: color }, g);
  if (kicker) T(g, kicker, { x: -w / 2 + 24, y: -h / 2 + 30, size: 13, w: 700, fill: color, a: 'start', ls: 2, caps: true });
  if (title) T(g, title, { x: -w / 2 + 24, y: -h / 2 + 62, size: 26, w: 650, a: 'start', ls: -0.5 });
  return g;
}
