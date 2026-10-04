import { S, G, T, layer, E, pr, clamp, lerp, mix, rgba, hn, TH, header } from './common.js';
import { Matrix, Eq } from '../engine/edukit.js';

const SGN = TH.grad, EXPC = TH.pol, MAN = TH.val;
const bitsRow = (g, y, parts, cw, x0) => { let x = x0; const rs = []; parts.forEach(([n, c, lb]) => { for (let i = 0; i < n; i++) { rs.push(S('rect', { x: x + i * (cw + 3), y, width: cw, height: 54, rx: 5, fill: rgba(c, 0.3 + 0.3 * hn(i, n)), stroke: c, 'stroke-width': 1.6 }, g)); } T(g, lb, { x: x + (n * (cw + 3)) / 2, y: y - 22, size: 18, fill: c, m: true }); x += n * (cw + 3) + 14; }); return rs; };

// ===================================================================== 12a: bits and range
export const bits = {
  id: 'c12_bits', title: 'Half-precision numbers', dur: 66, ch: 12, loc: 'train', mood: [TH.pol, TH.grad, TH.val],
  caps: [
    [0.5, 'Astra trains on consumer GPUs, and they are fastest with half-precision numbers: sixteen bits per value instead of thirty-two. That halves memory and speeds up the maths.'],
    [14.0, 'Each number is split into a sign, an exponent, which sets the scale, and a mantissa, which sets the detail. Half precision has only five exponent bits and ten mantissa bits.'],
    [30.0, 'That limits the range. The largest value is sixty-five thousand, five hundred four. Anything bigger becomes infinity.'],
    [44.0, 'At the small end, values below about six in a hundred thousand are flushed to zero by the GPU.'],
    [56.0, 'The rest of this chapter is three places where Astra’s maths ran into those two walls, and what fixed each one.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 12', title: 'FP32 vs FP16', sub: 'Half the bits, a much narrower range', accent: TH.pol });
    const g32 = G(L); bitsRow(g32, 300, [[1, SGN, 'sign'], [8, EXPC, 'exponent · 8'], [23, MAN, 'mantissa · 23']], 18, 330); T(g32, 'FP32', { x: 270, y: 328, size: 30, w: 700, fill: TH.ink, m: true, a: 'end' }); T(g32, 'range ±3.4 × 10³⁸', { x: 1250, y: 328, size: 22, a: 'start', fill: TH.dim, m: true });
    const g16 = G(L); bitsRow(g16, 440, [[1, SGN, 'sign'], [5, EXPC, 'exponent · 5'], [10, MAN, 'mantissa · 10']], 36, 330); T(g16, 'FP16', { x: 270, y: 468, size: 30, w: 700, fill: TH.ink, m: true, a: 'end' }); T(g16, 'range ±65,504', { x: 1250, y: 468, size: 22, a: 'start', fill: TH.grad, m: true });
    const X0 = 220, X1 = 1700, Y0 = 720; const lg = (v) => X0 + ((Math.log10(v) + 9) / 19) * (X1 - X0); // 1e-9 .. 1e10
    const ru = G(L); S('path', { d: `M${X0} ${Y0} H${X1}`, stroke: '#46607e', 'stroke-width': 3 }, ru);
    S('rect', { x: lg(6.1e-5), y: Y0 - 26, width: lg(65504) - lg(6.1e-5), height: 52, rx: 8, fill: rgba(TH.hist, 0.18), stroke: TH.hist, 'stroke-width': 2 }, ru); T(ru, 'FP16 can represent this', { x: (lg(6.1e-5) + lg(65504)) / 2, y: Y0 - 48, size: 20, fill: TH.hist, m: true });
    [[1e-9, '1e-9'], [1e-5, '1e-5'], [1, '1'], [1e4, '1e4'], [1e9, '1e9']].forEach(([v, lb]) => { S('path', { d: `M${lg(v)} ${Y0 - 8} V${Y0 + 8}`, stroke: '#9aabc1', 'stroke-width': 2 }, ru); T(ru, lb, { x: lg(v), y: Y0 + 30, size: 17, fill: TH.dim, m: true }); });
    const lo = T(ru, 'flushed to 0', { x: (lg(1e-9) + lg(6.1e-5)) / 2, y: Y0 - 48, size: 20, fill: TH.grad, m: true }); const hi = T(ru, '→ ∞', { x: (lg(65504) + lg(1e10)) / 2, y: Y0 - 48, size: 22, fill: TH.grad, m: true });
    T(L, 'magnitude (log scale)', { x: 960, y: 800, size: 18, fill: TH.dim, m: true });
    return { hd, g32, g16, ru, lo, hi };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.g32.setAttribute('opacity', pr(t, 1.0, 0.7)); s.g16.setAttribute('opacity', pr(t, 14.0, 0.7));
    s.ru.setAttribute('opacity', pr(t, 30.0, 0.7)); s.hi.setAttribute('opacity', pr(t, 32.0, 0.6)); s.lo.setAttribute('opacity', pr(t, 44.0, 0.6));
  },
};

// ===================================================================== 12b: the mask bug
export const nan = {
  id: 'c12_nan', title: 'Minus a billion becomes NaN', dur: 80, ch: 12, loc: 'train', mood: [TH.grad, TH.mask, TH.pol],
  caps: [
    [0.5, 'Remember the mask from chapter seven. The obvious way to hide illegal moves is to add a huge negative number to their logits: minus a billion.'],
    [14.0, 'The mask is built like this: one for illegal slots, zero for legal, multiplied by minus a billion. For a legal move that is zero times minus a billion, which should be zero.'],
    [28.0, 'But in half precision, minus a billion does not fit. It overflows to minus infinity. And zero times infinity is not zero. It is NaN: not a number.'],
    [44.0, 'The NaN is added to every legal logit. Softmax sees NaN, the loss is NaN, every gradient is NaN, and one step later every weight is NaN. Training is destroyed.'],
    [60.0, 'The fix is a smaller number that fits: minus ten thousand. Zero times it is zero, and its exponential is still zero for all practical purposes.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 12', title: 'How −1e9 became NaN', sub: 'The legal-move mask in half precision', accent: TH.grad });
    const mk = (title, x, col, rows) => { const g = G(L); S('rect', { x, y: 290, width: 800, height: 420, rx: 20, fill: rgba(col, 0.06), stroke: rgba(col, 0.7), 'stroke-width': 2.2 }, g); T(g, title, { x: x + 400, y: 335, size: 28, w: 700, fill: col, m: true }); const ts = rows.map(([a, b, c2], i) => { const y = 410 + i * 62; T(g, a, { x: x + 40, y, size: 24, a: 'start', fill: TH.dim, m: true }); return T(g, '', { x: x + 760, y, size: 28, a: 'end', w: 700, fill: c2 || TH.ink, m: true }); }); g.ts = ts; g.rows = rows; return g; };
    const A = mk('mask value −1e9', 100, TH.grad, [['legal slot: 0 × (−1e9)', ''], ['−1e9 stored in FP16', ''], ['0 × (−∞)', ''], ['legal logit + NaN', ''], ['softmax / loss / gradients', '']]);
    const B = mk('mask value −1e4', 1020, TH.hist, [['legal slot: 0 × (−1e4)', ''], ['−1e4 stored in FP16', ''], ['0 × (−10000)', ''], ['legal logit + 0', ''], ['softmax / loss / gradients', '']]);
    const outA = ['0', '−∞', 'NaN', 'NaN', 'all NaN'], colA = [TH.ink, TH.grad, TH.grad, TH.grad, TH.grad]; const outB = ['0', '−10000', '0', 'unchanged', 'finite ✓'], colB = [TH.ink, TH.hist, TH.ink, TH.ink, TH.hist];
    return { hd, A, B, outA, colA, outB, colB };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.A.setAttribute('opacity', pr(t, 1.0, 0.6)); s.B.setAttribute('opacity', pr(t, 60.0, 0.7));
    const step = (tt) => (i) => pr(t, tt + i * 4.0, 0.4) > 0.5;
    s.A.ts.forEach((e, i) => { const on = t > [14, 28, 30, 44, 50][i]; e.textContent = on ? s.outA[i] : ''; e.setAttribute('fill', s.colA[i]); });
    s.B.ts.forEach((e, i) => { const on = t > 62 + i * 2.5; e.textContent = on ? s.outB[i] : ''; e.setAttribute('fill', s.colB[i]); });
  },
};

// ===================================================================== 12c: epsilons
export const eps = {
  id: 'c12_eps', title: 'Epsilon that vanishes', dur: 78, ch: 12, loc: 'train', mood: [TH.pol, TH.grad, TH.val],
  caps: [
    [0.5, 'Two more constants hit the same wall. In chapter eleven, Adam divides by the square root of v plus epsilon. The usual epsilon is one hundred-thousandth.'],
    [14.0, 'In half precision, one hundred-thousandth is below the smallest normal number, so the GPU flushes it to zero. On the very first step, v can also be tiny.'],
    [28.0, 'The sum is zero. Dividing by zero gives infinity or NaN, and the first update turns the weights into NaN.'],
    [42.0, 'Astra’s fix on the GPU build: epsilon of one hundredth, the smallest value that stays a normal half-precision number even after the first step’s correction.'],
    [58.0, 'Layer norm had the same problem. Its epsilon of one hundred-thousandth became zero, and it divided by zero. On the GPU build it is one ten-thousandth.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 12', title: 'Constants that disappear', sub: 'Adam’s ε and LayerNorm’s ε in FP16', accent: TH.pol });
    const X0 = 200, X1 = 1720, Y0 = 520; const lg = (v) => X0 + ((Math.log10(v) + 9) / 9.5) * (X1 - X0);
    const ru = G(L); S('path', { d: `M${X0} ${Y0} H${X1}`, stroke: '#46607e', 'stroke-width': 3 }, ru);
    S('rect', { x: X0, y: Y0 - 30, width: lg(6.1e-5) - X0, height: 60, rx: 8, fill: rgba(TH.grad, 0.16), stroke: TH.grad, 'stroke-width': 2 }, ru); T(ru, 'flushed to zero', { x: (X0 + lg(6.1e-5)) / 2, y: Y0 - 56, size: 20, fill: TH.grad, m: true });
    S('rect', { x: lg(6.1e-5), y: Y0 - 30, width: X1 - lg(6.1e-5), height: 60, rx: 8, fill: rgba(TH.hist, 0.1), stroke: TH.hist, 'stroke-width': 2 }, ru); T(ru, 'normal FP16 numbers', { x: (lg(6.1e-5) + X1) / 2, y: Y0 - 56, size: 20, fill: TH.hist, m: true });
    S('path', { d: `M${lg(6.1e-5)} ${Y0 - 40} V${Y0 + 50}`, stroke: TH.pol, 'stroke-width': 2.4, 'stroke-dasharray': '5 5' }, ru); T(ru, 'smallest normal ≈ 6.1e-5', { x: lg(6.1e-5), y: Y0 + 74, size: 18, fill: TH.pol, m: true });
    const marks = [[1e-5, 'ε = 1e-5', TH.grad, 1], [1e-4, 'LN ε = 1e-4', TH.val, 0], [1e-2, 'Adam ε = 1e-2', TH.hist, 1]].map(([v, lb, c, below]) => { const g = G(L); S('circle', { cx: lg(v), cy: Y0, r: 12, fill: c, filter: 'url(#glow)' }, g); T(g, lb, { x: lg(v), y: Y0 + (below ? 120 : -130), size: 24, w: 700, fill: c, m: true }); return g; });
    const out = T(L, '', { x: 960, y: 800, size: 32, w: 700, fill: TH.ink, m: true });
    return { hd, ru, marks, out };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.ru.setAttribute('opacity', pr(t, 1.0, 0.7)); s.marks[0].setAttribute('opacity', pr(t, 6.0, 0.6)); s.marks[2].setAttribute('opacity', pr(t, 42.0, 0.6)); s.marks[1].setAttribute('opacity', pr(t, 58.0, 0.6));
    s.out.textContent = t < 14 ? '' : t < 28 ? 'ε in FP16 → 0' : t < 42 ? 'x / (√v + 0) = x / 0 → ∞ / NaN' : t < 58 ? 'Adam ε = 1e-2 survives the first step' : 'LayerNorm ε = 1e-4 stays normal';
    s.out.setAttribute('fill', t < 42 && t >= 14 ? TH.grad : TH.hist); s.out.setAttribute('opacity', pr(t, 14.0, 0.6));
  },
};

// ===================================================================== 12d: summary
export const fixes = {
  id: 'c12_fixes', title: 'Three fixes', dur: 44, ch: 12, loc: 'train', mood: [TH.pol, TH.hist, TH.val],
  caps: [
    [0.5, 'Three constants, one theme: numbers that are fine in thirty-two bits can overflow or vanish in sixteen.'],
    [12.0, 'The mask is minus ten thousand, not minus a billion. Adam’s epsilon is one hundredth on the GPU build. Layer norm’s epsilon is one ten-thousandth.'],
    [28.0, 'None of them changes what the network can learn. They only keep the arithmetic finite, so training can run on cheap hardware at all.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 12', title: 'Three constants that keep FP16 finite', sub: 'GPU (Vulkan, f16) build', accent: TH.hist });
    const rows = [['legal-move mask', '−1e9', '−1e4', 'overflow → −∞ → NaN', TH.pol], ['Adam ε', '1e-5', '1e-2', 'flushed to 0 → ÷ 0', TH.val], ['LayerNorm ε', '1e-5', '1e-4', 'flushed to 0 → ÷ 0', TH.search]];
    const cs = rows.map(([n, a, b, why, c], i) => { const g = G(L); const y = 330 + i * 150; S('rect', { x: 160, y: y - 50, width: 1600, height: 110, rx: 18, fill: rgba(c, 0.08), stroke: rgba(c, 0.6), 'stroke-width': 2 }, g); T(g, n, { x: 210, y: y + 8, size: 32, a: 'start', w: 700, fill: c }); T(g, a, { x: 800, y: y + 8, size: 34, w: 700, fill: TH.grad, m: true }); T(g, '→', { x: 940, y: y + 6, size: 34, fill: TH.dim, w: 600 }); T(g, b, { x: 1090, y: y + 8, size: 34, w: 700, fill: TH.hist, m: true }); T(g, why, { x: 1740, y: y + 8, size: 21, a: 'end', fill: TH.dim, m: true }); return g; });
    return { hd, cs };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.cs.forEach((g, i) => g.setAttribute('opacity', pr(t, 12.0 + i * 1.6, 0.6)));
  },
};
