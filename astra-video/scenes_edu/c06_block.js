import { S, G, T, layer, E, pr, clamp, lerp, mix, rgba, hn, TH, header } from './common.js';
import { Matrix, Eq, Flow } from '../engine/edukit.js';

const ATT = TH.search, FFN = TH.pol, NRM = '#9fb4cf', ADD = TH.hist, DRP = '#d98fb0';
const f2 = (v) => v.toFixed(2);

// ===================================================================== 6a: the block
const NODES = [
  ['x', 150, TH.state, 'tokens in', 110], ['LN', 320, NRM, 'LayerNorm', 130], ['MHA', 520, ATT, 'Multi-head attention', 190], ['DO', 690, DRP, 'Dropout', 120], ['+', 820, ADD, '', 64],
  ['LN', 960, NRM, 'LayerNorm', 130], ['FFN', 1150, FFN, 'Feed-forward', 170], ['DO', 1320, DRP, 'Dropout', 120], ['+', 1450, ADD, '', 64], ['y', 1620, TH.state, 'tokens out', 110],
];
export const block = {
  id: 'c6_block', title: 'The transformer block', dur: 70, ch: 6, loc: 'block', mood: [ATT, FFN, ADD],
  caps: [
    [0.5, 'Attention is half of what Astra does to each token. The unit that repeats six times is called a transformer block.'],
    [10.0, 'Read it left to right. Token vectors pass through layer norm, then multi-head attention, then dropout, and the result is added back onto what went in.'],
    [26.0, 'Then a second round: layer norm, a feed-forward network, dropout, and another addition.'],
    [38.0, 'Normalising before each step, rather than after, is called pre-norm. It keeps training stable when the stack is deep.'],
    [52.0, 'Shape in, shape out: sixty-four by one-eighty by two-fifty-six, every time. That is why blocks can be stacked.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 6', title: 'One transformer block', sub: 'Pre-norm · the unit Astra repeats six times', accent: ATT });
    const Y = 520;
    const els = NODES.map(([k, x, c, lb, w], i) => {
      const g = G(L); const circ = k === '+';
      if (circ) { S('circle', { r: 32, fill: rgba(c, 0.16), stroke: c, 'stroke-width': 2.4 }, g); T(g, '+', { y: 13, size: 40, w: 700, fill: c }); } else { S('rect', { x: -w / 2, y: -42, width: w, height: 84, rx: 16, fill: rgba(c, 0.14), stroke: c, 'stroke-width': 2.2 }, g); T(g, k === 'x' || k === 'y' ? (k === 'x' ? 'x' : 'y') : k, { y: 10, size: k.length > 2 ? 28 : 30, w: 700, fill: c, m: true }); }
      if (lb) T(g, lb, { y: 78, size: 16, fill: TH.dim, m: true }); g.setAttribute('transform', `translate(${x} ${Y})`); return g;
    });
    const links = []; for (let i = 0; i < NODES.length - 1; i++) { const a = NODES[i], b = NODES[i + 1]; const x1 = a[1] + (a[0] === '+' ? 32 : a[4] / 2), x2 = b[1] - (b[0] === '+' ? 32 : b[4] / 2); links.push(S('path', { d: `M${x1} ${Y} L${x2 - 4} ${Y}`, stroke: '#46607e', 'stroke-width': 2.4, fill: 'none', 'marker-end': 'url(#arr)' }, L)); }
    const res1 = S('path', { d: `M235 ${Y - 6} C 235 ${Y - 190}, 790 ${Y - 190}, 805 ${Y - 40}`, stroke: ADD, 'stroke-width': 3, fill: 'none', 'stroke-dasharray': '8 8', 'marker-end': 'url(#arr)' }, L);
    const res2 = S('path', { d: `M880 ${Y - 6} C 880 ${Y - 190}, 1420 ${Y - 190}, 1435 ${Y - 40}`, stroke: ADD, 'stroke-width': 3, fill: 'none', 'stroke-dasharray': '8 8', 'marker-end': 'url(#arr)' }, L);
    const rl1 = T(L, 'residual: the input is added back', { x: 520, y: Y - 175, size: 19, fill: ADD, m: true }); const rl2 = T(L, 'residual', { x: 1160, y: Y - 175, size: 19, fill: ADD, m: true });
    const half1 = T(L, 'mix between tokens', { x: 520, y: Y + 150, size: 20, fill: ATT, m: true }); const half2 = T(L, 'think within each token', { x: 1150, y: Y + 150, size: 20, fill: FFN, m: true });
    const shape = T(L, 'shape: (64, 180, 256)  →  (64, 180, 256)', { x: 960, y: 830, size: 26, w: 600, fill: TH.state, m: true });
    const dot = S('circle', { r: 11, fill: TH.state, filter: 'url(#glow)' }, L);
    return { hd, els, links, res1, res2, rl1, rl2, half1, half2, shape, dot, Y };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.els.forEach((g, i) => { const a = pr(t, 1.0 + i * 0.35, 0.5, E.outBack); g.setAttribute('opacity', a); });
    s.links.forEach((l, i) => l.setAttribute('opacity', pr(t, 1.4 + i * 0.35, 0.5)));
    s.res1.setAttribute('opacity', pr(t, 10.0, 0.8)); s.rl1.setAttribute('opacity', pr(t, 12.0, 0.6)); s.half1.setAttribute('opacity', pr(t, 14.0, 0.6));
    s.res2.setAttribute('opacity', pr(t, 26.0, 0.8)); s.rl2.setAttribute('opacity', pr(t, 28.0, 0.6)); s.half2.setAttribute('opacity', pr(t, 30.0, 0.6));
    s.shape.setAttribute('opacity', pr(t, 52.0, 0.6));
    // a token dot travels left → right, repeating
    const u = ((t - 6) / 16) % 1; const x = NODES[0][1] + (NODES[9][1] - NODES[0][1]) * clamp(u); s.dot.setAttribute('cx', x); s.dot.setAttribute('cy', s.Y); s.dot.setAttribute('opacity', t > 6 ? 0.9 : 0);
    s.els.forEach((g, i) => { const near = Math.abs(x - NODES[i][1]) < 70 && t > 6; g.setAttribute('filter', near ? 'url(#glow)' : ''); });
  },
};

// ===================================================================== 6b: LayerNorm
const XV = [3.1, -2.2, 0.4, 1.5];
const MU = XV.reduce((a, b) => a + b, 0) / 4, VAR = XV.reduce((a, b) => a + (b - MU) ** 2, 0) / 4, SD = Math.sqrt(VAR + 1e-4);
const NV = XV.map((v) => (v - MU) / SD);
const GAM = [1.2, 0.8, 1, 1], BET = [0, 0.1, 0, -0.1];
const YV = NV.map((v, i) => GAM[i] * v + BET[i]);
const bars = (g, vals, x0, y0, color, sc = 40, labels = true) => vals.map((v, i) => { const x = x0 + i * 78; const r = S('rect', { x, y: v >= 0 ? y0 - v * sc : y0, width: 56, height: Math.abs(v) * sc, rx: 5, fill: rgba(v < 0 ? TH.grad : color, 0.7) }, g); const l = T(g, f2(v), { x: x + 28, y: v >= 0 ? y0 - v * sc - 10 : y0 + Math.abs(v) * sc + 22, size: 18, fill: TH.ink, m: true }); return { r, l, v, x, sc, y0 }; });
export const layernorm = {
  id: 'c6_ln', title: 'LayerNorm', dur: 72, ch: 6, loc: 'block', mood: [NRM, TH.state, TH.pol],
  caps: [
    [0.5, 'Layer norm tames the scale of a token vector before each sub-layer. Without it, numbers can drift huge or tiny as they pass through many layers.'],
    [12.0, 'Take one token’s numbers: three point one, minus two point two, point four, one point five. They have a mean of about point seven, and a spread, the standard deviation, of about one point nine.'],
    [28.0, 'Subtract the mean and divide by the spread. Now the numbers average zero, with spread one. The shape of the vector is kept; only its scale is reset.'],
    [42.0, 'Then two learned vectors, gamma and beta, rescale and shift each position, so the network can undo the normalising wherever that helps.'],
    [56.0, 'Real layer norm does this over a token’s two hundred fifty-six numbers, one token at a time, never across tokens.'],
    [66.0, 'A small epsilon sits under the square root. On the GPU build, Astra uses one ten-thousandth, because FP16 would round a smaller one to zero.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 6', title: 'LayerNorm', sub: 'Reset the scale of one token, one token at a time', accent: NRM });
    const g1 = G(L); const b1 = bars(g1, XV, 260, 560, TH.state); T(g1, 'x (one token, 4 of 256 numbers)', { x: 400, y: 740, size: 18, fill: TH.dim, m: true }); const mean = S('path', { d: `M240 ${560 - MU * 40} H580`, stroke: TH.pol, 'stroke-width': 2.4, 'stroke-dasharray': '7 6' }, g1); const ml = T(g1, 'mean ≈ 0.7', { x: 590, y: 560 - MU * 40 + 6, size: 18, a: 'start', fill: TH.pol, m: true });
    S('path', { d: 'M240 560 H580', stroke: '#2b3b52', 'stroke-width': 1.6 }, g1);
    const g2 = G(L); const b2 = bars(g2, NV, 760, 560, NRM); T(g2, 'normalised: mean 0, spread 1', { x: 900, y: 740, size: 18, fill: TH.dim, m: true }); S('path', { d: 'M740 560 H1080', stroke: '#2b3b52', 'stroke-width': 1.6 }, g2);
    const g3 = G(L); const b3 = bars(g3, YV, 1260, 560, TH.state); T(g3, 'y = γ·n + β', { x: 1400, y: 740, size: 18, fill: TH.dim, m: true }); S('path', { d: 'M1240 560 H1580', stroke: '#2b3b52', 'stroke-width': 1.6 }, g3);
    const a1 = T(L, '→', { x: 670, y: 450, size: 44, w: 600, fill: TH.dim }); const a2 = T(L, '→', { x: 1170, y: 450, size: 44, w: 600, fill: TH.dim });
    const gb = T(L, 'γ = [1.2, 0.8, 1, 1]   β = [0, 0.1, 0, −0.1]   (learned)', { x: 1400, y: 770, size: 17, fill: TH.pol, m: true });
    const eq = Eq(L, { x: 960, y: 850, a: 'middle', size: 38, runs: [['y_i', TH.state], [' = ', TH.dim], ['γ_i', TH.pol], [' · (x_i − μ) / √(σ² + ε)', NRM], [' + ', TH.dim], ['β_i', TH.pol]] });
    const eps = T(L, 'ε = 1e-4 on the GPU build (FP16 flushes 1e-5 to zero)', { x: 960, y: 905, size: 19, fill: TH.dim, m: true });
    return { hd, g1, g2, g3, a1, a2, gb, eq, eps, mean, ml };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.g1.setAttribute('opacity', pr(t, 1.0, 0.7)); s.mean.setAttribute('opacity', pr(t, 16.0, 0.6)); s.ml.setAttribute('opacity', pr(t, 16.0, 0.6));
    s.a1.setAttribute('opacity', pr(t, 28.0, 0.5)); s.g2.setAttribute('opacity', pr(t, 29.0, 0.8)); s.a2.setAttribute('opacity', pr(t, 42.0, 0.5)); s.g3.setAttribute('opacity', pr(t, 43.0, 0.8)); s.gb.setAttribute('opacity', pr(t, 44.0, 0.6));
    s.eq.g.setAttribute('opacity', pr(t, 56.0, 0.5)); s.eq.show(pr(t, 56.4, 5)); s.eps.setAttribute('opacity', pr(t, 66.0, 0.6));
  },
};

// ===================================================================== 6c: residual
export const residual = {
  id: 'c6_res', title: 'Residual connection', dur: 56, ch: 6, loc: 'block', mood: [ADD, TH.state, TH.grad],
  caps: [
    [0.5, 'Each sub-layer does not replace the token. It computes a correction, and the correction is added to the original.'],
    [12.0, 'The vector going in is carried straight past the sub-layer, a skip connection. The output is the input, plus what attention or the feed-forward network found worth adding.'],
    [28.0, 'That gives the network a default of doing nothing: if the correction is zero, the token passes through untouched.'],
    [40.0, 'It also gives the training signal a straight road backwards, which matters in chapter ten.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 6', title: 'Residual connections', sub: 'Learn the correction, keep the original', accent: ADD });
    const xs = [1.2, -0.8, 0.4, 1.0], fs = [0.3, -0.1, 0.5, -0.4]; const ys = xs.map((v, i) => v + fs[i]);
    const gx = G(L); const bx = bars(gx, xs, 240, 520, TH.state, 70); T(gx, 'x (input)', { x: 380, y: 640, size: 20, fill: TH.state, m: true });
    const gf = G(L); const bf = bars(gf, fs, 760, 520, FFN, 70); T(gf, 'f(x) (sub-layer correction)', { x: 900, y: 640, size: 20, fill: FFN, m: true });
    const gy = G(L); const by = bars(gy, ys, 1280, 520, ADD, 70); T(gy, 'y = x + f(x)', { x: 1420, y: 640, size: 20, fill: ADD, m: true });
    const plus = T(L, '+', { x: 680, y: 510, size: 56, w: 600, fill: ADD }); const eqs = T(L, '=', { x: 1200, y: 510, size: 56, w: 600, fill: ADD });
    const skip = S('path', { d: 'M380 440 C 380 330, 1420 330, 1420 440', stroke: ADD, 'stroke-width': 3, fill: 'none', 'stroke-dasharray': '9 8' }, L); const sl = T(L, 'skip connection', { x: 900, y: 312, size: 20, fill: ADD, m: true });
    const zero = T(L, 'if f(x) = 0 then y = x : the block does nothing', { x: 960, y: 760, size: 28, fill: TH.dim, m: true });
    const grad = T(L, 'gradients can flow straight back along the skip', { x: 960, y: 820, size: 24, fill: TH.grad, m: true });
    const fl = Flow(L, 'M380 380 C 380 330, 1420 330, 1420 380', { n: 5, color: TH.grad, r: 6 });
    return { hd, gx, gf, gy, plus, eqs, skip, sl, zero, grad, fl };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.gx.setAttribute('opacity', pr(t, 1.0, 0.6)); s.gf.setAttribute('opacity', pr(t, 6.0, 0.6)); s.plus.setAttribute('opacity', pr(t, 6.0, 0.5)); s.eqs.setAttribute('opacity', pr(t, 10.0, 0.5)); s.gy.setAttribute('opacity', pr(t, 10.5, 0.7));
    s.skip.setAttribute('opacity', pr(t, 12.0, 0.8)); s.sl.setAttribute('opacity', pr(t, 13.0, 0.6)); s.zero.setAttribute('opacity', pr(t, 28.0, 0.6)); s.grad.setAttribute('opacity', pr(t, 40.0, 0.6));
    s.fl.g.setAttribute('opacity', pr(t, 40.0, 0.6)); s.fl.update(t, 0.25, 1);
  },
};

// ===================================================================== 6d: feed-forward
export const ffn = {
  id: 'c6_ffn', title: 'Feed-forward network', dur: 66, ch: 6, loc: 'block', mood: [FFN, TH.state, ATT],
  caps: [
    [0.5, 'After attention has moved information between tokens, each token needs to think about what it has gathered. That is the feed-forward network.'],
    [12.0, 'It is the linear layer from chapter four, twice. First 256 numbers expand to 1,024, giving the model room to compute many features at once.'],
    [26.0, 'Then GELU bends them. Then a second linear layer squeezes the 1,024 back to 256 so it can be added to the residual.'],
    [40.0, 'The same weights are applied to every token separately. No token talks to another here; communication was attention’s job.'],
    [52.0, 'In symbols: W two applied to GELU of W one x plus b one, plus b two. Five hundred twenty-five thousand, five hundred sixty-eight parameters per layer.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 6', title: 'The feed-forward network', sub: '256 → 1024 → GELU → 256, applied to each token separately', accent: FFN });
    const cols = [[260, 8, '256', TH.state], [760, 20, '1024', FFN], [1260, 20, '1024 after GELU', ATT], [1660, 8, '256', TH.state]];
    const nets = cols.map(([x, n, lb, c]) => { const g = G(L); const ds = []; for (let i = 0; i < n; i++) ds.push(S('circle', { cx: x, cy: 330 + i * (n === 8 ? 52 : 21), r: n === 8 ? 12 : 6.5, fill: c, opacity: 0.8 }, g)); T(g, lb, { x, y: 790, size: 20, fill: c, m: true }); g.ds = ds; return g; });
    const wires = [[0, 1], [2, 3]].map(([a, b]) => { const g = G(L); for (let k = 0; k < 40; k++) { const i = Math.floor(hn(a, k, 1) * cols[a][1]), j = Math.floor(hn(b, k, 2) * cols[b][1]); const y1 = 330 + i * (cols[a][1] === 8 ? 52 : 21), y2 = 330 + j * (cols[b][1] === 8 ? 52 : 21); S('path', { d: `M${cols[a][0]} ${y1} L${cols[b][0]} ${y2}`, stroke: rgba(FFN, 0.16), 'stroke-width': 1.2 }, g); } return g; });
    const bend = G(L); S('path', { d: 'M1010 380 L1010 640', stroke: '#2b3b52' }, bend); const gl = T(L, 'GELU', { x: 1010, y: 300, size: 28, w: 700, fill: ATT, m: true });
    const l1 = T(L, 'Linear  W₁ (256×1024)', { x: 510, y: 300, size: 22, fill: FFN, m: true }); const l2 = T(L, 'Linear  W₂ (1024×256)', { x: 1460, y: 300, size: 22, fill: FFN, m: true });
    const eq = Eq(L, { x: 960, y: 850, a: 'middle', size: 38, runs: [['FFN(x)', TH.ink], [' = ', TH.dim], ['W₂', FFN], [' GELU(', ATT], ['W₁', FFN], [' x + b₁', TH.dim], [')', ATT], [' + b₂', TH.dim]] });
    const pc = T(L, '(256×1024 + 1024) + (1024×256 + 256) = 525,568 parameters', { x: 960, y: 905, size: 22, fill: FFN, m: true });
    const same = T(L, 'same weights for every token — no mixing between tokens', { x: 960, y: 850, size: 24, fill: TH.dim, m: true });
    return { hd, nets, wires, gl, l1, l2, eq, pc, same, bend };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.nets.forEach((g, i) => g.setAttribute('opacity', pr(t, [1, 12, 26, 28][i], 0.7)));
    s.wires[0].setAttribute('opacity', pr(t, 12.0, 0.8)); s.wires[1].setAttribute('opacity', pr(t, 28.0, 0.8)); s.l1.setAttribute('opacity', pr(t, 12.0, 0.6)); s.gl.setAttribute('opacity', pr(t, 26.0, 0.6)); s.l2.setAttribute('opacity', pr(t, 28.0, 0.6));
    s.nets[1].ds.forEach((d, i) => d.setAttribute('opacity', 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 2 + i * 0.7))));
    s.nets[2].ds.forEach((d, i) => d.setAttribute('opacity', (i % 3 === 0 ? 0.15 : 0.9) * pr(t, 26.0, 0.6)));
    s.same.setAttribute('opacity', pr(t, 40.0, 0.6) * (1 - pr(t, 51.5, 0.5)));
    s.eq.g.setAttribute('opacity', pr(t, 52.0, 0.5)); s.eq.show(pr(t, 52.4, 4)); s.pc.setAttribute('opacity', pr(t, 58.0, 0.6));
  },
};

// ===================================================================== 6e: dropout
export const dropout = {
  id: 'c6_do', title: 'Dropout', dur: 38, ch: 6, loc: 'block', mood: [DRP, TH.state, TH.pol],
  caps: [
    [0.5, 'Dropout is a training-only trick. At random, ten percent of the numbers are set to zero, and the survivors are scaled up so the total stays the same.'],
    [14.0, 'Each step zeroes a different set, so the network cannot lean on any single number. It is also applied to the attention scores.'],
    [26.0, 'When Astra plays or is evaluated, dropout is switched off and every number passes through.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 6', title: 'Dropout', sub: 'p = 0.1 · active in training, off at play time', accent: DRP });
    const N = 16; const g = G(L); const cells = Array.from({ length: N }, (_, i) => { const x = 330 + (i % 8) * 150, y = 400 + Math.floor(i / 8) * 130; const r = S('rect', { x, y, width: 124, height: 90, rx: 12, fill: rgba(TH.state, 0.2), stroke: TH.state, 'stroke-width': 2 }, g); const tx = T(g, '', { x: x + 62, y: y + 55, size: 28, w: 650, m: true }); return { r, tx, x, y, v: Math.round((hn(1, i) * 2 - 1) * 20) / 10 }; });
    const mode = T(L, '', { x: 960, y: 740, size: 34, w: 700, m: true });
    const note = T(L, '', { x: 960, y: 800, size: 22, fill: TH.dim, m: true });
    return { hd, cells, mode, note };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    const train = t < 26; const step = Math.floor((t - 2) / 4);
    s.cells.forEach((c, i) => {
      const a = pr(t, 1.0 + i * 0.06, 0.5); const drop = train && hn(step, i, 5) < 0.2 && t > 2; const out = drop ? 0 : (train && t > 2 ? c.v / 0.9 : c.v);
      c.tx.textContent = drop ? '0' : out.toFixed(2); c.tx.setAttribute('fill', drop ? TH.grad : TH.ink); c.r.setAttribute('fill', drop ? '#2a1620' : rgba(TH.state, 0.2)); c.r.setAttribute('stroke', drop ? TH.grad : TH.state); c.r.setAttribute('opacity', a); c.tx.setAttribute('opacity', a);
    });
    s.mode.textContent = train ? (t > 2 ? 'training: random zeros, survivors × 1/0.9' : '') : 'play / evaluation: nothing dropped'; s.mode.setAttribute('fill', train ? TH.grad : TH.hist); s.mode.setAttribute('opacity', pr(t, 3.0, 0.6));
    s.note.textContent = train ? `step ${step + 1}: a different set is dropped each time` : 'the full vector flows through'; s.note.setAttribute('opacity', pr(t, 3.0, 0.6));
  },
};

// ===================================================================== 6f: stack of six
export const stack = {
  id: 'c6_stack', title: 'Six blocks', dur: 56, ch: 6, loc: 'block', mood: [ATT, FFN, TH.state],
  caps: [
    [0.5, 'The block is repeated six times, each with its own weights. The output of one is the input of the next.'],
    [12.0, 'Early blocks tend to pick up simple relationships, like which card belongs to which system. Later ones can combine them into whole-board judgements.'],
    [26.0, 'Each block holds two hundred sixty-three thousand attention parameters, five hundred twenty-five thousand feed-forward, and a thousand for the layer norms.'],
    [40.0, 'Six of them: four million, seven hundred thirty-eight thousand, five hundred sixty. There is no extra layer norm after the last block. Each token now carries a context-rich vector of 256 numbers.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 6', title: 'Six blocks, stacked', sub: 'Same shape in and out · different weights in each', accent: ATT });
    const blocks = Array.from({ length: 6 }, (_, i) => { const g = G(L); const y = 720 - i * 80; S('rect', { x: -250, y: -36, width: 500, height: 72, rx: 14, fill: mix('#0b1320', ATT, 0.1 + 0.025 * i), stroke: ATT, 'stroke-width': 2 }, g); T(g, `block ${i + 1}`, { x: -180, y: 9, size: 24, a: 'middle', w: 650, fill: ATT, m: true }); T(g, 'LN · MHA · + · LN · FFN · +', { x: 50, y: 8, size: 18, fill: TH.dim, m: true }); g.setAttribute('transform', `translate(560 ${y})`); return g; });
    const emb = G(L); S('rect', { x: -250, y: -26, width: 500, height: 52, rx: 12, fill: rgba(TH.state, 0.15), stroke: TH.state, 'stroke-width': 2 }, emb); T(emb, 'embeddings  (180 × 256)', { y: 8, size: 20, w: 650, fill: TH.state, m: true }); emb.setAttribute('transform', 'translate(560 800)');
    const out = G(L); S('rect', { x: -250, y: -26, width: 500, height: 52, rx: 12, fill: rgba(TH.state, 0.15), stroke: TH.state, 'stroke-width': 2 }, out); T(out, 'context-rich tokens (180 × 256)', { y: 8, size: 20, w: 650, fill: TH.state, m: true }); out.setAttribute('transform', 'translate(560 238)');
    const pc = G(L); const rows = [['attention', '263,168', ATT], ['feed-forward', '525,568', FFN], ['2 × LayerNorm', '1,024', NRM], ['one block', '789,760', TH.ink], ['× 6', '4,738,560', TH.pol]]; const prs = rows.map(([n, v, c], i) => { const y = 380 + i * 62; T(pc, n, { x: 1130, y, size: 26, a: 'start', fill: c, m: true }); T(pc, v, { x: 1720, y, size: 28, a: 'end', fill: c, m: true, w: 700 }); return y; });
    const dot = S('circle', { r: 13, fill: TH.state, filter: 'url(#glow)' }, L);
    return { hd, blocks, emb, out, pc, dot };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.emb.setAttribute('opacity', pr(t, 0.8, 0.5)); s.out.setAttribute('opacity', pr(t, 40.0, 0.6));
    s.blocks.forEach((g, i) => g.setAttribute('opacity', pr(t, 1.5 + i * 0.7, 0.6, E.outBack)));
    const c = clamp((t - 6) / 24) * 6.4; const cy = 800 - c * 80; s.dot.setAttribute('cx', 560 + Math.sin(t * 3) * 18); s.dot.setAttribute('cy', Math.max(238, cy)); s.dot.setAttribute('opacity', pr(t, 6.0, 0.4));
    s.pc.setAttribute('opacity', pr(t, 26.0, 0.8));
  },
};
