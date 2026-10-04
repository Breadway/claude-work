// ASTRA explainer film - shared visual language and teaching primitives (all pure f(t)).
import { S, G, T, P, C, E, pr, clamp, lerp, unlerp, mix, rgba, fmt, drawOn, hn, sbump, bump, rng } from './core.js';
import { glyphs } from './kit.js';

// ---- the film's colour grammar: one colour per concept, never reused for anything else -------------
export const TH = {
  state: '#7be3d5',   // state tokens
  hist: '#8be28f',    // history tokens
  act: '#ff9f6b',     // action tokens
  pol: '#f2c67b',     // policy
  val: '#83b8ff',     // value
  grad: '#ff7a8a',    // gradients
  loss: '#ff9ed8',    // loss / teacher target
  search: '#b6a1ff',  // search
  mask: '#5d6f88',    // padding / masks
  ink: '#eef3f9', dim: '#9aabc1', faint: '#6b7f99', line: '#26354a', panel: '#0d1522',
};

// ---- card vocabulary (real engine names) -----------------------------------------------------------
export const CARD = {
  'Star(Protostar)': ['Protostar', 'star'], 'Star(YellowDwarf)': ['Yellow Dwarf', 'star'], 'Star(RedGiant)': ['Red Giant', 'star'], 'Star(RedSupergiant)': ['Red Supergiant', 'star'],
  'Star(WhiteDwarf)': ['White Dwarf', 'star'], 'Star(RedDwarf)': ['Red Dwarf', 'star'], 'Star(BrownDwarf)': ['Brown Dwarf', 'star'],
  'Discovery(AsteroidBelt)': ['Asteroid Belt', 'disc'], 'Discovery(DwarfPlanet)': ['Dwarf Planet', 'disc'], 'Discovery(RockyPlanet)': ['Rocky Planet', 'disc'], 'Discovery(GasGiant)': ['Gas Giant', 'disc'], 'Discovery(Comet)': ['Comet', 'disc'],
  'Flare(SupernovaFusion)': ['Supernova · Fusion', 'flare'], 'Flare(SupernovaGravity)': ['Supernova · Gravity', 'flare'], 'Flare(SupernovaGas)': ['Supernova · Gas', 'flare'], 'Flare(CosmicDenial)': ['Cosmic Denial', 'flare'],
  'Flare(Ignition)': ['Ignition', 'flare'], 'Flare(AstralProjection)': ['Astral Projection', 'flare'], 'Flare(StellarAlignment)': ['Stellar Alignment', 'flare'], 'Flare(Wormhole)': ['Wormhole', 'flare'],
  'Omen(SolarEclipse)': ['Solar Eclipse', 'omen'], 'Omen(PlanetOfLife)': ['Planet of Life', 'omen'],
  'Fracture(BlackHole)': ['Black Hole', 'frac'], 'Fracture(Athena)': ['Athena', 'frac'], 'Fracture(Pulsar)': ['Pulsar', 'frac'], 'Fracture(DarkMatterVoid)': ['Dark Matter Void', 'frac'],
  'Fracture(QuantumEntanglementFailure)': ['Quantum Entanglement', 'frac'], 'Fracture(StellarNurseryCollapse)': ['Stellar Nursery', 'frac'], 'Fracture(Shockwave)': ['Shockwave', 'frac'],
};
export const CAT_COL = { star: '#ffd479', disc: '#8fd3ff', flare: '#ff8fb8', omen: '#9be5a0', frac: '#c3a6ff' };
export const TYPE_IDX = Object.keys(CARD).reduce((o, k, i) => ((o[k] = i), o), {}); // insertion order == engine type_idx 0..28
export const cardName = (k) => (CARD[k] || [k])[0];

/** a playing card face, centred at 0,0. */
export function cardFace(parent, { name, w = 118, h = 168, back = false, accent }) {
  const g = G(parent); const [label, cat] = CARD[name] || [name, 'star']; const col = accent || CAT_COL[cat];
  S('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 12, fill: back ? '#0f1830' : 'url(#surface)', stroke: back ? '#46607e' : col, 'stroke-width': 2.2, filter: 'url(#soft)' }, g);
  if (back) { T(g, '?', { size: h * 0.36, w: 800, fill: '#46607e' }); return g; }
  S('rect', { x: -w / 2 + 8, y: -h / 2 + 8, width: w - 16, height: 6, rx: 3, fill: col, opacity: 0.9 }, g);
  S('circle', { cy: -h * 0.12, r: w * 0.2, fill: 'none', stroke: col, 'stroke-width': 2.4, opacity: 0.85 }, g); S('circle', { cy: -h * 0.12, r: w * 0.07, fill: col }, g);
  const parts = label.split(' · '); parts.forEach((p, i) => T(g, p, { y: h * 0.26 + i * 17, size: p.length > 11 ? 14 : 16, w: 640, fill: TH.ink }));
  T(g, cat.toUpperCase(), { y: h / 2 - 14, size: 10.5, w: 700, fill: col, ls: 1.6, m: true });
  return g;
}

// ---- numbers as pictures ------------------------------------------------------------------------------
/** matrix of cells; vals optional numbers (heat-tinted). Local coords: top-left at (0,0). */
export function Matrix(parent, { rows, cols, cw = 56, ch = 40, gap = 4, vals = null, color = TH.state, size = 17, fmtv = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1)), label, labelDy = -22, heat = true, rowLabels, colLabels, lw = 0 }) {
  const g = G(parent); const cells = [];
  for (let i = 0; i < rows; i++) {
    cells.push([]);
    for (let j = 0; j < cols; j++) {
      const x = j * (cw + gap), y = i * (ch + gap);
      const r = S('rect', { x, y, width: cw, height: ch, rx: 7, fill: '#0b1320', stroke: rgba(color, 0.55), 'stroke-width': 1.6 }, g);
      const t = T(g, '', { x: x + cw / 2, y: y + ch / 2, size, w: 560, m: true, fill: TH.ink });
      cells[i].push({ r, t, x, y });
    }
  }
  if (label) T(g, label, { x: 0, y: labelDy, size: 15, w: 650, a: 'start', fill: color, m: true, ls: 1 });
  rowLabels?.forEach((s, i) => T(g, s, { x: -10, y: i * (ch + gap) + ch / 2, size: 15, a: 'end', fill: TH.dim, m: true }));
  colLabels?.forEach((s, j) => T(g, s, { x: j * (cw + gap) + cw / 2, y: -10, size: 15, fill: TH.dim, m: true }));
  const m = {
    g, cells, rows, cols, cw, ch, gap, W: cols * (cw + gap) - gap, Hh: rows * (ch + gap) - gap, color,
    cx: (j) => j * (cw + gap) + cw / 2, cy: (i) => i * (ch + gap) + ch / 2,
    /** set numbers + heat (a = 0..1 reveal per cell via fn or scalar) */
    set(v = vals, a = 1, { mx } = {}) {
      const M = mx ?? (v ? Math.max(0.001, ...v.flat().map(Math.abs)) : 1);
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        const c = cells[i][j]; const aa = typeof a === 'function' ? a(i, j) : a; const val = v?.[i]?.[j];
        c.t.textContent = val == null || aa < 0.04 ? '' : fmtv(val); c.t.setAttribute('opacity', aa);
        const h = heat && val != null ? Math.min(1, Math.abs(val) / M) : 0.25;
        c.r.setAttribute('fill', mix('#0b1320', val != null && val < 0 ? TH.grad : color, 0.12 + 0.5 * h * aa));
        c.r.setAttribute('opacity', 0.35 + 0.65 * Math.max(aa, 0.2));
      }
    },
    hl(fn, col = TH.ink) { for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const v = fn(i, j); const c = cells[i][j]; c.r.setAttribute('stroke', v > 0.02 ? mix(rgba(color, 0.55) && color, col, v) : rgba(color, 0.55)); c.r.setAttribute('stroke-width', 1.6 + 2.2 * v); } },
  };
  return m;
}

/** an equation as coloured runs, revealed in order. runs: [text, colour?, id?] */
export function Eq(parent, { x = 0, y = 0, size = 34, runs, a = 'start' }) {
  const g = G(parent); const items = []; let cx = 0;
  const meas = (s) => { const t = T(g, s, { size, w: 560, a: 'start', m: false }); t.style.whiteSpace = 'pre'; const L = t.getComputedTextLength(); g.removeChild(t); return L; };
  for (const [s, col, id] of runs) {
    const w = meas(s) || size * 0.3 * s.length;
    const t = T(g, s, { x: cx, y: 0, size, w: 560, a: 'start', fill: col || TH.ink }); t.style.whiteSpace = 'pre';
    items.push({ t, id, w, x: cx, col: col || TH.ink }); cx += w;
  }
  const W = cx; const x0 = a === 'middle' ? x - W / 2 : x; g.setAttribute('transform', `translate(${x0} ${y})`);
  return {
    g, W, items,
    show(p) { items.forEach((it, i) => { const q = clamp(p * items.length - i); it.t.setAttribute('opacity', q); it.t.setAttribute('transform', `translate(${it.x} ${(1 - q) * 10})`); }); },
    hl(id, v, col) { items.forEach((it) => { if (it.id === id) { it.t.setAttribute('fill', mix(it.col, col || '#ffffff', v * 0.7)); it.t.style.filter = v > 0.2 ? 'url(#glow)' : ''; } }); },
    pos(id) { const it = items.find((q) => q.id === id); return it ? { x: x0 + it.x + it.w / 2, y } : null; },
  };
}

/** a token drawn as type chip + 7 field boxes. tok = [type, f0..f6]. Local top-left (0,0). */
export function TokenRow(parent, { tok, color = TH.state, cw = 70, ch = 56, gap = 8, names, typeName, size = 22 }) {
  const g = G(parent); const cells = [];
  tok.forEach((v, i) => {
    const x = i * (cw + gap) + (i > 0 ? 14 : 0);
    const r = S('rect', { x, y: 0, width: cw, height: ch, rx: 10, fill: i === 0 ? rgba(color, 0.2) : '#0b1320', stroke: color, 'stroke-width': i === 0 ? 2.6 : 1.8 }, g);
    T(g, String(v), { x: x + cw / 2, y: ch / 2 - 3, size, w: 720, m: true, fill: v ? TH.ink : TH.faint });
    T(g, i === 0 ? (typeName || 'type') : (names?.[i - 1] || 'f' + (i - 1)), { x: x + cw / 2, y: ch + 17, size: 12.5, fill: i === 0 ? color : TH.dim, m: true });
    cells.push(r);
  });
  return { g, cells, W: tok.length * (cw + gap) + 6 - gap };
}

/** dots streaming along a path (deterministic). */
export function Flow(parent, d, { n = 6, color = TH.state, r = 5, dash = null, width = 0 } = {}) {
  const g = G(parent); const path = S('path', { d, fill: 'none', stroke: width ? rgba(color, 0.35) : 'none', 'stroke-width': width, 'stroke-dasharray': dash }, g);
  path.__len = path.getTotalLength();
  const dots = Array.from({ length: n }, () => S('circle', { r, fill: color, filter: 'url(#glow)' }, g));
  return {
    g, path,
    update(t, speed = 0.4, o = 1, off = 0) { dots.forEach((c, i) => { const u = (((t * speed + i / n + off) % 1) + 1) % 1; const p = path.getPointAtLength(u * path.__len); c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('opacity', o * Math.sin(u * Math.PI)); }); },
  };
}

/** a vector drawn as a strip of k cells; values deterministic from seed. */
export function VecStrip(parent, { n = 24, cw = 11, ch = 26, color = TH.state, seed = 1, gap = 2 }) {
  const g = G(parent); const rs = [];
  for (let i = 0; i < n; i++) rs.push(S('rect', { x: i * (cw + gap), y: 0, width: cw, height: ch, rx: 2.5, fill: color, opacity: 0.25 + 0.75 * hn(seed, i) }, g));
  return { g, rs, W: n * (cw + gap) - gap, set(f = 1, drift = 0) { rs.forEach((r, i) => r.setAttribute('opacity', (0.2 + 0.8 * hn(seed + Math.floor(drift), i)) * f)); } };
}

/** chapter title card. dur short; no narration. */
export function chapterCard(n, title, sub, mood = [TH.state, TH.search, TH.pol]) {
  return {
    id: 'card' + n, title: 'Chapter ' + n, dur: 5.2, ch: n, loc: '', mood, drift: 0.04, trans: 0.6, caps: [],
    build(root) {
      const L = G(S('svg', { viewBox: '0 0 1920 1080', width: 1920, height: 1080, class: 'layer' }, root));
      const big = T(L, String(n).padStart(2, '0'), { x: 200, y: 470, size: 330, w: 800, a: 'start', fill: '#12203a', ls: -14 });
      const ring = S('circle', { cx: 330, cy: 470, r: 210, fill: 'none', stroke: mood[0], 'stroke-width': 2, 'stroke-dasharray': '4 12', opacity: 0.6 }, L);
      const k = T(L, 'CHAPTER ' + n + ' OF 17', { x: 640, y: 380, size: 20, w: 700, a: 'start', fill: mood[0], ls: 5, m: true });
      const ttl = glyphs(L, title.replace(/ /g, ' '), { x: 640, y: 480, size: 96, w: 720, a: 'start', ls: -3, stagger: 0.025 });
      const sb = T(L, sub, { x: 640, y: 590, size: 30, w: 450, a: 'start', fill: TH.dim });
      const bar = S('rect', { x: 640, y: 628, width: 0, height: 3, rx: 1.5, fill: 'url(#gcp)' }, L);
      return { big, ring, k, ttl, sb, bar };
    },
    update(t, s) {
      s.big.setAttribute('opacity', pr(t, 0.1, 0.8)); s.big.setAttribute('transform', `translate(${(1 - pr(t, 0.1, 0.9, E.outQ4)) * -60} 0)`);
      s.ring.setAttribute('transform', `rotate(${t * 14} 330 470)`); s.ring.setAttribute('opacity', 0.6 * pr(t, 0.2, 0.8));
      s.k.setAttribute('opacity', pr(t, 0.3, 0.5)); s.ttl.update(t, 0.4);
      s.sb.setAttribute('opacity', pr(t, 1.3, 0.6)); s.sb.setAttribute('transform', `translate(0 ${(1 - pr(t, 1.3, 0.6)) * 14})`);
      s.bar.setAttribute('width', 560 * pr(t, 1.6, 1.2, E.outQ4));
    },
  };
}

/** scene header, edu flavour: eyebrow = chapter tag, title, optional sub. Reuses kit.header's look. */
export { header } from './kit.js';
