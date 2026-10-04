import { S, G, T, layer, E, pr, clamp, lerp, mix, rgba, hn, TH, header } from './common.js';
import { Matrix, Eq, VecStrip } from '../engine/edukit.js';

const f1 = (v) => (Math.abs(v) < 0.05 ? '0' : v.toFixed(1).replace(/\.0$/, ''));
const f2 = (v) => v.toFixed(2);

// ===================================================================== 4a: shapes
export const shapes = {
  id: 'c4_shapes', title: 'Scalars to tensors', dur: 58, ch: 4, loc: 'embed', mood: [TH.state, TH.val, TH.act],
  caps: [
    [0.5, 'Everything inside Astra is made of numbers, organised by shape. One number on its own is a scalar.'],
    [9.0, 'A list of numbers is a vector. One token’s embedding is a vector of two hundred fifty-six numbers.'],
    [20.0, 'A grid is a matrix: rows and columns. All one hundred eighty tokens of one position, stacked, make a matrix, one row per token.'],
    [34.0, 'Stack many positions and you get a tensor. Training feeds the network sixty-four positions at once, so its main tensor has shape sixty-four, by one-eighty, by two-fifty-six.'],
    [50.0, 'Shapes are the grammar of the network. Every operation we meet next is a rule for changing one shape into another.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 4', title: 'Numbers have shapes', sub: 'Scalar → vector → matrix → tensor', accent: TH.state });
    const sc = G(L); S('rect', { x: -48, y: -36, width: 96, height: 72, rx: 12, fill: '#0b1320', stroke: TH.state, 'stroke-width': 2.4 }, sc); T(sc, '3.1', { y: 8, size: 34, w: 700, m: true }); T(sc, 'scalar · shape ()', { y: 66, size: 16, fill: TH.dim, m: true }); sc.setAttribute('transform', 'translate(300 480)');
    const ve = G(L); const vm = Matrix(ve, { rows: 1, cols: 8, cw: 62, ch: 60, gap: 6, vals: [[0.3, -0.7, 1.1, 0.2, -0.4, 0.9, -1.2, 0.5]], color: TH.state, size: 20, fmtv: f1 }); vm.set(undefined, 1); T(ve, '… 256 numbers', { x: vm.W + 20, y: 32, size: 18, a: 'start', fill: TH.dim, m: true }); T(ve, 'vector · shape (256)', { x: 0, y: 108, size: 16, a: 'start', fill: TH.dim, m: true }); ve.setAttribute('transform', 'translate(520 450)');
    const ma = G(L); const mm = Matrix(ma, { rows: 6, cols: 8, cw: 56, ch: 44, gap: 5, vals: Array.from({ length: 6 }, (_, i) => Array.from({ length: 8 }, (_, j) => Math.round((hn(4, i, j) * 2 - 1) * 9) / 10)), color: TH.state, size: 17, fmtv: f1, rowLabels: ['tok 0', 'tok 1', 'tok 2', 'tok 3', 'tok 4', 'tok 5'] }); mm.set(); T(ma, '↓ 180 tokens (6 shown)', { x: -60, y: 6 * 49 + 56, size: 16, a: 'start', fill: TH.dim, m: true }); T(ma, '→ 256 features', { x: mm.W + 14, y: 20, size: 16, a: 'start', fill: TH.dim, m: true }); T(ma, 'matrix · shape (180, 256)', { x: 0, y: 6 * 49 + 24, size: 16, a: 'start', fill: TH.dim, m: true }); ma.setAttribute('transform', 'translate(440 300)');
    const te = G(L); const slabs = []; for (let k = 7; k >= 0; k--) { const s = G(te); S('rect', { x: 0, y: 0, width: 360, height: 250, rx: 12, fill: mix('#0b1320', TH.state, 0.08 + (7 - k) * 0.012), stroke: rgba(TH.state, 0.7), 'stroke-width': 2 }, s); for (let q = 0; q < 12; q++) S('rect', { x: 10, y: 10 + q * 19, width: 340, height: 14, rx: 3, fill: rgba(TH.state, 0.1 + 0.08 * hn(k, q)) }, s); s.setAttribute('transform', `translate(${k * 32} ${-k * 22})`); slabs.push(s); }
    T(te, 'batch = 64 positions', { x: 330, y: -230, size: 20, a: 'start', fill: TH.act, m: true }); T(te, '180 tokens', { x: -22, y: 125, size: 18, fill: TH.dim, m: true }); T(te, '256 features →', { x: 180, y: 276, size: 18, fill: TH.dim, m: true }); const shp = T(te, 'tensor · shape (64, 180, 256)', { x: 300, y: 330, size: 26, w: 700, fill: TH.state, m: true }); te.setAttribute('transform', 'translate(560 540)');
    const big = T(L, '= 2,949,120 numbers', { x: 1440, y: 960 - 70, size: 30, w: 700, fill: TH.state, m: true });
    return { hd, sc, ve, ma, te, slabs, big, shp };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    const aS = pr(t, 0.6, 0.6, E.outBack), aV = pr(t, 9.0, 0.6), aM = pr(t, 20.0, 0.6), aT = pr(t, 34.0, 0.6);
    const outS = 1 - pr(t, 8.6, 0.4), outV = 1 - pr(t, 19.6, 0.4), outM = 1 - pr(t, 33.6, 0.4);
    s.sc.setAttribute('opacity', aS * outS); s.ve.setAttribute('opacity', aV * outV); s.ma.setAttribute('opacity', aM * outM); s.te.setAttribute('opacity', aT);
    s.slabs.forEach((g, i) => { const p = pr(t, 34.4 + (7 - i) * 0.25, 0.7, E.outQ4); g.setAttribute('opacity', p); });
    s.big.setAttribute('opacity', pr(t, 44.0, 0.7)); s.shp.setAttribute('opacity', pr(t, 38.0, 0.6));
  },
};

// ===================================================================== 4b: dot product
export const dot = {
  id: 'c4_dot', title: 'The dot product', dur: 60, ch: 4, loc: 'embed', mood: [TH.state, TH.pol, TH.val],
  caps: [
    [0.5, 'The core operation of a neural network is the dot product: multiply two lists of numbers pair by pair, then add up the results.'],
    [11.0, 'Take two vectors. Two times a half is one. Minus one times one is minus one. Three times minus two is minus six.'],
    [26.0, 'Add them: minus six. One number that says how much the two lists agree. Large and positive means aligned, negative means opposed.'],
    [38.0, 'In symbols: the sum, over positions i, of a sub i times w sub i.'],
    [48.0, 'A linear layer is just many dot products in parallel, one per output number, each with its own list of learned weights.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 4', title: 'The dot product', sub: 'Multiply pairs, then add', accent: TH.pol });
    const a = [2, -1, 3], w = [0.5, 1, -2]; const pr3 = a.map((v, i) => v * w[i]);
    const A = Matrix(L, { rows: 1, cols: 3, cw: 110, ch: 70, gap: 14, vals: [a], color: TH.state, size: 32, fmtv: f1, rowLabels: ['a (input)'] }); A.g.setAttribute('transform', 'translate(560 340)'); A.set();
    const W = Matrix(L, { rows: 1, cols: 3, cw: 110, ch: 70, gap: 14, vals: [w], color: TH.pol, size: 32, fmtv: f1, rowLabels: ['w (weights)'] }); W.g.setAttribute('transform', 'translate(560 470)'); W.set();
    const Pm = Matrix(L, { rows: 1, cols: 3, cw: 110, ch: 70, gap: 14, vals: [pr3], color: TH.val, size: 32, fmtv: f1, rowLabels: ['a × w'] }); Pm.g.setAttribute('transform', 'translate(560 640)');
    const times = [0, 1, 2].map((i) => T(L, '×', { x: 560 + i * 124 + 55, y: 425, size: 30, fill: TH.dim, w: 600 }));
    const sum = T(L, '', { x: 1160, y: 700, size: 60, a: 'start', w: 750, fill: TH.val, m: true }); const sl = T(L, 'sum = dot product', { x: 1160, y: 636, size: 19, a: 'start', fill: TH.dim, m: true });
    const eq = Eq(L, { x: 960, y: 850, a: 'middle', size: 44, runs: [['a · w', TH.ink], [' = ', TH.dim], ['Σ', TH.val], ['i', TH.dim], [' a_i · w_i', TH.pol]] }); const el = T(L, 'i runs over the positions: 1, 2, 3', { x: 960, y: 895, size: 18, fill: TH.dim, m: true });
    return { hd, A, W, Pm, times, sum, sl, eq, el, pr3 };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.A.g.setAttribute('opacity', pr(t, 1.5, 0.6)); s.W.g.setAttribute('opacity', pr(t, 4.5, 0.6));
    s.Pm.set([s.pr3], (i, j) => pr(t, 12.0 + j * 3.2, 0.6));
    s.times.forEach((e, i) => e.setAttribute('opacity', pr(t, 11.0 + i * 3.2, 0.5)));
    s.A.hl((i, j) => (t > 11 && t < 24 && Math.floor((t - 11) / 3.2) === j ? 1 : 0), TH.ink); s.W.hl((i, j) => (t > 11 && t < 24 && Math.floor((t - 11) / 3.2) === j ? 1 : 0), TH.ink);
    const sp = pr(t, 26.0, 0.8); s.sl.setAttribute('opacity', sp); s.sum.setAttribute('opacity', sp); s.sum.textContent = sp > 0.02 ? '= −6' : '';
    s.eq.g.setAttribute('opacity', pr(t, 38.0, 0.5)); s.eq.show(pr(t, 38.4, 4)); s.el.setAttribute('opacity', pr(t, 42.0, 0.6));
  },
};

// ===================================================================== 4c: a tiny linear layer
export const linear = {
  id: 'c4_linear', title: 'A linear layer', dur: 72, ch: 4, loc: 'embed', mood: [TH.state, TH.pol, TH.val],
  caps: [
    [0.5, 'Here is a complete linear layer, small enough to see. Three numbers in, two out.'],
    [8.0, 'The weights form a matrix W with three rows and two columns. Each column is one output’s private list of weights.'],
    [18.0, 'First output: take x dot column one. One times a half, plus two times one, plus minus one times minus a half: three. Add the bias, a tenth: three point one.'],
    [34.0, 'Second output: x dot column two, minus two, plus the bias minus a fifth: minus two point two.'],
    [46.0, 'In symbols: y equals x times W, plus b. The matrix W and the bias b are the learned numbers. Nothing else changes during training.'],
    [60.0, 'Astra’s layers are the same thing, just wider: two hundred fifty-six numbers in, a thousand twenty-four out.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 4', title: 'A linear layer, in full', sub: 'y = x W + b  ·  3 numbers in, 2 out', accent: TH.pol });
    const x = [[1, 2, -1]], Wv = [[0.5, -1], [1, 0.5], [-0.5, 2]], b = [[0.1, -0.2]], y = [[3.1, -2.2]];
    const X = Matrix(L, { rows: 1, cols: 3, cw: 86, ch: 70, gap: 8, vals: x, color: TH.state, size: 28, fmtv: f1, label: 'x · input', labelDy: -16 }); X.g.setAttribute('transform', 'translate(130 520)'); X.set();
    const Wm = Matrix(L, { rows: 3, cols: 2, cw: 100, ch: 70, gap: 8, vals: Wv, color: TH.pol, size: 28, fmtv: f1, label: 'W · weights (learned)', labelDy: -16 }); Wm.g.setAttribute('transform', 'translate(520 430)');
    const Bm = Matrix(L, { rows: 1, cols: 2, cw: 100, ch: 70, gap: 8, vals: b, color: TH.pol, size: 28, fmtv: f1, label: 'b · bias (learned)', labelDy: -16 }); Bm.g.setAttribute('transform', 'translate(860 520)');
    const Y = Matrix(L, { rows: 1, cols: 2, cw: 120, ch: 70, gap: 8, vals: y, color: TH.val, size: 30, fmtv: f1, label: 'y · output', labelDy: -16 }); Y.g.setAttribute('transform', 'translate(1190 520)');
    const ops = [['×', 470], ['+', 830], ['=', 1160]].map(([c, xx]) => T(L, c, { x: xx, y: 555, size: 40, fill: TH.dim, w: 600 }));
    const work1 = T(L, '1·0.5 + 2·1 + (−1)(−0.5) + 0.1 = 3.1', { x: 960, y: 760, size: 28, fill: TH.val, m: true }); const work2 = T(L, '1·(−1) + 2·0.5 + (−1)·2 + (−0.2) = −2.2', { x: 960, y: 760, size: 28, fill: TH.val, m: true });
    const eq = Eq(L, { x: 960, y: 840, a: 'middle', size: 46, runs: [['y', TH.val], [' = ', TH.dim], ['x', TH.state], ['W', TH.pol], [' + ', TH.dim], ['b', TH.pol]] });
    const big = G(L); T(big, '256 → 1024', { x: 960, y: 660, size: 70, w: 750, fill: TH.pol, m: true }); T(big, 'W: 256 × 1024 = 262,144 weights   ·   b: 1,024   ·   total 263,168', { x: 960, y: 724, size: 26, fill: TH.dim, m: true });
    return { hd, X, Wm, Bm, Y, ops, work1, work2, eq, big, Wv, b, y };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.X.g.setAttribute('opacity', pr(t, 1.0, 0.6)); s.Wm.set(s.Wv, pr(t, 8.0, 0.8)); s.Wm.g.setAttribute('opacity', pr(t, 8.0, 0.6));
    s.Bm.g.setAttribute('opacity', pr(t, 19.0, 0.6)); s.Bm.set(s.b, pr(t, 19.0, 0.6));
    const c = t > 34 ? 1 : 0;
    s.Wm.hl((i, j) => (t > 18 && t < 46 && j === c ? 0.9 : 0), TH.ink);
    s.X.hl(() => (t > 18 && t < 46 ? 0.6 : 0), TH.ink);
    s.Y.g.setAttribute('opacity', pr(t, 17.0, 0.5)); s.Y.set(s.y, (i, j) => pr(t, j === 0 ? 24.0 : 38.0, 0.7));
    s.ops.forEach((e, i) => e.setAttribute('opacity', pr(t, 9.0 + i * 5, 0.5)));
    s.work1.setAttribute('opacity', pr(t, 20.0, 0.6) * (1 - pr(t, 33.6, 0.4))); s.work2.setAttribute('opacity', pr(t, 35.0, 0.6) * (1 - pr(t, 45.6, 0.4)));
    s.eq.g.setAttribute('opacity', pr(t, 46.0, 0.4) * (1 - pr(t, 59.5, 0.5))); s.eq.show(pr(t, 46.4, 3));
    s.big.setAttribute('opacity', pr(t, 60.0, 0.7));
  },
};

// ===================================================================== 4d: why a nonlinearity
const gelu = (x) => 0.5 * x * (1 + Math.tanh(0.7978845608 * (x + 0.044715 * x ** 3)));
export const nonlin = {
  id: 'c4_nonlin', title: 'Nonlinearity', dur: 52, ch: 4, loc: 'embed', mood: [TH.state, TH.search, TH.pol],
  caps: [
    [0.5, 'There is a catch. Two linear layers in a row are the same as one: multiply the two weight matrices and you get a single matrix.'],
    [12.0, 'Stacking them adds nothing. To learn curved, conditional rules, a bend has to be placed between the layers.'],
    [22.0, 'Astra uses GELU. For large positive inputs it passes the number through. For negative inputs it squashes it toward zero, smoothly.'],
    [36.0, 'Our two outputs, three point one and minus two point two, become three point one, and almost zero.'],
    [46.0, 'Linear, bend, linear: that is the whole recipe for a feed-forward network.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 4', title: 'The bend between layers', sub: 'Without it, depth is an illusion', accent: TH.search });
    const left = G(L); const bx = (g, x, y, w, c, txt) => { S('rect', { x, y, width: w, height: 70, rx: 14, fill: rgba(c, 0.14), stroke: c, 'stroke-width': 2 }, g); T(g, txt, { x: x + w / 2, y: y + 44, size: 26, w: 650, m: true }); };
    bx(left, 120, 330, 160, TH.pol, 'W₁'); bx(left, 330, 330, 160, TH.pol, 'W₂'); T(left, '=', { x: 540, y: 376, size: 40, w: 600, fill: TH.dim }); bx(left, 580, 330, 320, TH.pol, 'W₁W₂ (one layer)'); T(left, 'x → W₁ → W₂ → y   is the same as   x → (W₁W₂) → y', { x: 460, y: 460, size: 22, fill: TH.dim, m: true });
    const X0 = 1050, Y0 = 760, SX = 62, SY = 66;
    const plot = G(L); S('path', { d: `M${X0 - 4 * SX} ${Y0} H${X0 + 4 * SX}`, stroke: '#2b3b52', 'stroke-width': 1.6 }, plot); S('path', { d: `M${X0} ${Y0 - 3.4 * SY} V${Y0 + 1.4 * SY}`, stroke: '#2b3b52', 'stroke-width': 1.6 }, plot);
    let d = ''; for (let i = 0; i <= 80; i++) { const x = -4 + (8 * i) / 80; d += (i ? 'L' : 'M') + (X0 + x * SX) + ' ' + (Y0 - gelu(x) * SY) + ' '; }
    const lin = S('path', { d: `M${X0 - 4 * SX} ${Y0 + 4 * SY * 0.35} L${X0 + 3.4 * SX} ${Y0 - 3.4 * SY}`, stroke: '#46607e', 'stroke-width': 2, 'stroke-dasharray': '6 7', fill: 'none' }, plot);
    const curve = S('path', { d, stroke: TH.search, 'stroke-width': 4, fill: 'none', filter: 'url(#glow)' }, plot); curve.__len = curve.getTotalLength(); curve.setAttribute('stroke-dasharray', curve.__len);
    T(plot, 'GELU(x)', { x: X0 + 3.6 * SX, y: Y0 - 3.1 * SY, size: 22, a: 'start', fill: TH.search, m: true }); T(plot, 'x', { x: X0 + 4.2 * SX, y: Y0 + 8, size: 18, fill: TH.dim, m: true });
    const pts = [[3.1, TH.val], [-2.2, TH.val]].map(([x, c]) => { const g = G(plot); S('circle', { r: 9, fill: c, filter: 'url(#glow)' }, g); const l = T(g, '', { y: -18, size: 18, w: 650, fill: c, m: true }); return { g, x, l }; });
    const lbl = T(L, 'GELU(3.1) = 3.10     GELU(−2.2) = −0.03', { x: 1050, y: 900, size: 24, fill: TH.val, m: true });
    return { hd, left, plot, curve, pts, lin, lbl, X0, Y0, SX, SY };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.left.setAttribute('opacity', pr(t, 0.8, 0.8) * (1 - 0.7 * pr(t, 14, 1))); s.plot.setAttribute('opacity', pr(t, 12.0, 0.8));
    s.curve.setAttribute('stroke-dashoffset', s.curve.__len * (1 - E.inOutC(clamp((t - 22.0) / 6.0)))); s.lin.setAttribute('opacity', pr(t, 20, 0.6));
    s.pts.forEach((p, i) => { const a = pr(t, 36.0 + i * 3, 0.6, E.outBack); const tt = a; s.pts[i].g.setAttribute('transform', `translate(${s.X0 + p.x * s.SX} ${s.Y0 - lerp(p.x, gelu(p.x), clamp((t - (38 + i * 3)) / 2)) * s.SY})`); p.g.setAttribute('opacity', a); p.l.textContent = p.x > 0 ? '3.1' : '−2.2 → −0.03'; });
    s.lbl.setAttribute('opacity', pr(t, 38.0, 0.6));
  },
};
