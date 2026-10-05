// ASTRA video engine - core: math, easing, seeded noise, DOM/SVG helpers.
// Everything here is a pure function of time: no Date.now, no Math.random, no rAF state.

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const unlerp = (a, b, v) => (v - a) / (b - a);
export const remap = (v, a, b, c, d, e = (x) => x) => lerp(c, d, e(clamp(unlerp(a, b, v))));

const c1 = 1.70158, c3 = c1 + 1, c4 = (2 * Math.PI) / 3;
export const E = {
  lin: (t) => t,
  inQ: (t) => t * t,
  outQ: (t) => 1 - (1 - t) * (1 - t),
  inOutQ: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inC: (t) => t * t * t,
  outC: (t) => 1 - Math.pow(1 - t, 3),
  inOutC: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQ4: (t) => 1 - Math.pow(1 - t, 4),
  outX: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutX: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outBack: (t) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2),
  inOutBack: (t) => {
    const c2 = c1 * 1.525;
    return t < 0.5 ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2 : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

/** progress of an animation that starts at `s`, lasts `d` seconds, eased by `e`. */
export const pr = (t, s, d = 0.6, e = E.outC) => e(clamp((t - s) / d));
/** triangular pulse: 0 -> 1 -> 0 around centre c with half-width w */
export const bump = (t, c, w) => Math.max(0, 1 - Math.abs(t - c) / w);
/** smooth bump (cosine) */
export const sbump = (t, c, w) => { const x = clamp(1 - Math.abs(t - c) / w); return x * x * (3 - 2 * x); };

export const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
/** deterministic hash noise in [0,1) from numbers */
export const hn = (...n) => {
  let h = 2166136261;
  for (const v of n) { h ^= Math.floor(v * 1000) + 0x9e3779b9; h = Math.imul(h, 16777619); h ^= h >>> 13; }
  h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
/** smooth 1-D value noise, ~[0,1] */
export const noise = (x, seed = 0) => {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hn(i, seed), hn(i + 1, seed), u);
};

// ---------- colour ----------
export const C = {
  bg: '#070c15', panel: '#0d1522', line: '#1f2c3e', line2: '#2b3b52',
  text: '#eef3f9', muted: '#9aabc1', faint: '#6b7f99',
  cyan: '#7be3d5', purple: '#b6a1ff', gold: '#f2c67b', blue: '#83b8ff',
  red: '#ff7a8a', green: '#8be28f', pink: '#ff9ed8',
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const mix = (a, b, t) => {
  const x = hex(a), y = hex(b);
  return '#' + x.map((v, i) => Math.round(lerp(v, y[i], t)).toString(16).padStart(2, '0')).join('');
};
export const rgba = (h, a) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };

export const fmt = (n) => Math.round(n).toLocaleString('en-US');
export const pct = (n, d = 1) => n.toFixed(d) + '%';

// ---------- DOM ----------
const NS = 'http://www.w3.org/2000/svg';
export function A(e, attrs) {
  for (const k in attrs) {
    const v = attrs[k];
    if (v == null) continue;
    if (k === 'text') e.textContent = v;
    else if (k === 'style') Object.assign(e.style, v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v);
  }
  return e;
}
export function S(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  A(e, attrs);
  if (parent) parent.appendChild(e);
  return e;
}
export function H(tag, attrs = {}, parent) {
  const e = document.createElement(tag);
  A(e, attrs);
  if (parent) parent.appendChild(e);
  return e;
}
/** place an SVG element: translate/rotate/scale + opacity. hides it when invisible. */
export function P(e, { x = 0, y = 0, s = 1, sx, sy, r = 0, o = 1 } = {}) {
  e.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})${r ? ` rotate(${r.toFixed(2)})` : ''} scale(${(sx ?? s).toFixed(4)} ${(sy ?? s).toFixed(4)})`);
  e.setAttribute('opacity', o.toFixed(3));
  e.style.display = o < 0.003 ? 'none' : '';
}
/** same for an HTML element (centred transform-origin) */
export function PH(e, { x = 0, y = 0, s = 1, r = 0, o = 1, blur = 0 } = {}) {
  e.style.transform = `translate(${x}px,${y}px) rotate(${r}deg) scale(${s})`;
  e.style.opacity = o;
  e.style.filter = blur > 0.05 ? `blur(${blur}px)` : '';
  e.style.visibility = o < 0.003 ? 'hidden' : 'visible';
}
/** SVG text */
export function T(parent, str, { x = 0, y = 0, size = 24, w = 500, fill = C.text, a = 'middle', m = false, ls = 0, o = 1, caps = false } = {}) {
  const t = S('text', {
    x, y, 'font-size': size, 'font-weight': w, fill, 'text-anchor': a, 'dominant-baseline': 'central',
    'letter-spacing': ls, class: m ? 'mono' : 'sans', opacity: o, text: caps ? String(str).toUpperCase() : str,
  }, parent);
  return t;
}
export const G = (parent, attrs = {}) => S('g', attrs, parent);

/** a full-bleed SVG layer inside a scene root */
export function layer(parent, cls = 'layer') {
  const s = S('svg', { viewBox: '0 0 1920 1080', width: 1920, height: 1080, class: cls }, parent);
  return s;
}

// ---------- path helpers ----------
export function pathLen(p) { return p.getTotalLength(); }
/** draw-on a stroke path by progress u (0..1) */
export function drawOn(p, u, len = p.__len ?? (p.__len = p.getTotalLength())) {
  p.style.strokeDasharray = `${len} ${len + 2}`;
  p.style.strokeDashoffset = `${len * (1 - u)}`;
}
/** a bright segment travelling along a path; u in 0..1 loops. seg = visible length */
export function travel(p, u, seg = 40) {
  const len = p.__len ?? (p.__len = p.getTotalLength());
  p.style.strokeDasharray = `${seg} ${len + seg}`;
  p.style.strokeDashoffset = `${seg - u * (len + seg)}`;
}
export function pointAt(p, u) {
  const len = p.__len ?? (p.__len = p.getTotalLength());
  const pt = p.getPointAtLength(clamp(u) * len);
  return pt;
}
export const curve = (x1, y1, x2, y2, k = 0.5) => {
  const dx = (x2 - x1) * k;
  return `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
};
