import { S, G, T, layer, E, pr, clamp, lerp, mix, rgba, hn, TH, header, shortAct } from './common.js';
import { Matrix, Eq, VecStrip, Flow } from '../engine/edukit.js';
import { DEC } from './data.js';

const LOG = [2.1, -0.4, 3.2, 1.7];
const ACTS = ['Play Pulsar', 'Pass', 'Protostar → draw two', 'Rocky Planet → system 1'];
const EXP = LOG.map(Math.exp), ZS = EXP.reduce((a, b) => a + b, 0), PR = EXP.map((v) => v / ZS);

// ===================================================================== 7a: the pointer
export const pointer = {
  id: 'c7_pointer', title: 'The pointer policy', dur: 66, ch: 7, loc: 'heads', mood: [TH.pol, TH.act, TH.state],
  caps: [
    [0.5, 'Now Astra has to choose. After six blocks, every token carries context. The policy head reads only the action tokens, one per legal move.'],
    [12.0, 'The same small network looks at each action token’s 256 numbers and produces one score: a logit. A high logit means the move looks good.'],
    [28.0, 'This is called a pointer: the scores point at the tokens themselves. There is no fixed list of action slots to learn, because the legal moves change every turn.'],
    [44.0, 'Here, four of this position’s moves, with illustrative scores: Protostar draw two gets three point two, Pulsar two point one, Rocky Planet one point seven, and Pass minus point four.'],
    [58.0, 'Higher means more promising, but a logit is not a probability yet.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 7', title: 'The policy head', sub: 'One score per action token · illustrative logits', accent: TH.pol });
    const cols = ACTS.map((a, i) => { const g = G(L); const x = 300 + i * 400; S('rect', { x: -150, y: -34, width: 300, height: 68, rx: 14, fill: rgba(TH.act, 0.14), stroke: TH.act, 'stroke-width': 2 }, g); T(g, a, { y: 8, size: 20, w: 560 }); g.setAttribute('transform', `translate(${x} 330)`); const v = G(g); const vs = VecStrip(v, { n: 20, cw: 11, ch: 22, gap: 3, color: TH.act, seed: 11 + i * 5 }); v.setAttribute('transform', `translate(${-vs.W / 2} 60)`); T(g, '256 numbers', { y: 110, size: 15, fill: TH.dim, m: true }); g.x = x; return g; });
    const mlp = G(L); S('rect', { x: 150, y: 520, width: 1620, height: 110, rx: 22, fill: rgba(TH.pol, 0.1), stroke: TH.pol, 'stroke-width': 2.4 }, mlp); T(mlp, 'shared scoring network: Linear(256→256) → ReLU → Linear(256→1)', { x: 960, y: 585, size: 30, w: 650, fill: TH.pol, m: true });
    const arrows = ACTS.map((_, i) => S('path', { d: `M${300 + i * 400} 460 L${300 + i * 400} 515`, stroke: TH.act, 'stroke-width': 2.4, 'marker-end': 'url(#arr)' }, L));
    const outs = ACTS.map((_, i) => { const g = G(L); S('rect', { x: -70, y: -32, width: 140, height: 64, rx: 14, fill: rgba(TH.pol, 0.18), stroke: TH.pol, 'stroke-width': 2.2 }, g); T(g, LOG[i].toFixed(1), { y: 10, size: 32, w: 700, m: true, fill: LOG[i] < 0 ? TH.grad : TH.pol }); T(g, 'logit', { y: 54, size: 15, fill: TH.dim, m: true }); g.setAttribute('transform', `translate(${300 + i * 400} 750)`); return g; });
    const arr2 = ACTS.map((_, i) => S('path', { d: `M${300 + i * 400} 636 L${300 + i * 400} 706`, stroke: TH.pol, 'stroke-width': 2.4, 'marker-end': 'url(#arr)' }, L));
    return { hd, cols, mlp, arrows, outs, arr2 };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.cols.forEach((g, i) => g.setAttribute('opacity', pr(t, 1.0 + i * 0.5, 0.6)));
    s.mlp.setAttribute('opacity', pr(t, 12.0, 0.7)); s.arrows.forEach((a, i) => a.setAttribute('opacity', pr(t, 12.5 + i * 0.3, 0.5)));
    s.arr2.forEach((a, i) => a.setAttribute('opacity', pr(t, 16.0 + i * 0.4, 0.5)));
    s.outs.forEach((g, i) => { const a = pr(t, 16.5 + i * 0.5, 0.6, E.outBack); g.setAttribute('opacity', a); });
  },
};

// ===================================================================== 7b: ReLU + shared weights
export const relu = {
  id: 'c7_relu', title: 'ReLU and shared weights', dur: 46, ch: 7, loc: 'heads', mood: [TH.pol, TH.state, TH.search],
  caps: [
    [0.5, 'The scorer uses ReLU, the simplest bend: negatives become zero, positives pass through unchanged.'],
    [12.0, 'Inside the scorer, 256 numbers become 256 hidden numbers, ReLU zeroes the negative ones, and a final linear layer collapses them to a single score.'],
    [26.0, 'Crucially, every action token goes through exactly the same weights. That is what lets Astra score any move, in any order, in any position.'],
    [38.0, 'Sixty-five thousand, seven hundred ninety-three parameters in the whole policy head.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 7', title: 'Inside the scorer', sub: 'ReLU, then one number', accent: TH.pol });
    const X0 = 520, Y0 = 640, SX = 70, SY = 70; const p = G(L); S('path', { d: `M${X0 - 3.5 * SX} ${Y0} H${X0 + 3.5 * SX}`, stroke: '#2b3b52', 'stroke-width': 1.6 }, p); S('path', { d: `M${X0} ${Y0 - 3.5 * SY} V${Y0 + 1 * SY}`, stroke: '#2b3b52', 'stroke-width': 1.6 }, p);
    const curve = S('path', { d: `M${X0 - 3.5 * SX} ${Y0} H${X0} L${X0 + 3.3 * SX} ${Y0 - 3.3 * SY}`, stroke: TH.pol, 'stroke-width': 4.5, fill: 'none', filter: 'url(#glow)', 'stroke-linejoin': 'round' }, p); curve.__len = curve.getTotalLength(); curve.setAttribute('stroke-dasharray', curve.__len);
    T(p, 'ReLU(x) = max(0, x)', { x: X0 + 150, y: Y0 - 3.4 * SY, size: 24, fill: TH.pol, m: true, a: 'start' });
    const ch = G(L); const stages = [['256 in', TH.state, 1010], ['Linear 256→256', TH.pol, 1240], ['ReLU', TH.pol, 1470], ['Linear 256→1', TH.pol, 1700]]; const st = stages.map(([lb, c, x], i) => { const g = G(ch); S('rect', { x: -78, y: -34, width: 156, height: 68, rx: 14, fill: rgba(c, 0.13), stroke: c, 'stroke-width': 2 }, g); T(g, lb, { y: 7, size: 17, w: 600 }); g.setAttribute('transform', `translate(${x} 500)`); return g; });
    const shared = T(L, 'same weights for all action tokens', { x: 1400, y: 640, size: 27, fill: TH.act, m: true }); const sh2 = G(L); for (let i = 0; i < 4; i++) { S('circle', { cx: 1220 + i * 90, cy: 720, r: 18, fill: rgba(TH.act, 0.25), stroke: TH.act, 'stroke-width': 2 }, sh2); S('path', { d: `M${1220 + i * 90} 740 L1400 790`, stroke: rgba(TH.pol, 0.5), 'stroke-width': 1.6 }, sh2); } S('rect', { x: 1320, y: 790, width: 160, height: 50, rx: 10, fill: rgba(TH.pol, 0.2), stroke: TH.pol, 'stroke-width': 2 }, sh2); T(sh2, 'scorer', { x: 1400, y: 823, size: 20, w: 650, fill: TH.pol, m: true });
    const pc = T(L, '(256×256 + 256) + (256×1 + 1) = 65,793 parameters', { x: 960, y: 900, size: 24, fill: TH.pol, m: true });
    return { hd, p, curve, ch, st, shared, sh2, pc };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.p.setAttribute('opacity', pr(t, 0.8, 0.5)); s.curve.setAttribute('stroke-dashoffset', s.curve.__len * (1 - E.inOutC(clamp((t - 1.5) / 4))));
    s.st.forEach((g, i) => g.setAttribute('opacity', pr(t, 12.0 + i * 1.5, 0.6)));
    s.shared.setAttribute('opacity', pr(t, 26.0, 0.6)); s.sh2.setAttribute('opacity', pr(t, 26.5, 0.6)); s.pc.setAttribute('opacity', pr(t, 38.0, 0.6));
  },
};

// ===================================================================== 7c: softmax
export const softmax = {
  id: 'c7_softmax', title: 'Softmax', dur: 74, ch: 7, loc: 'heads', mood: [TH.pol, TH.search, TH.act],
  caps: [
    [0.5, 'To turn scores into a choice, Astra uses softmax. First, exponentiate each logit: that makes everything positive and stretches the gaps.'],
    [14.0, 'Three point two becomes about twenty-five. Minus point four becomes point seven. Add them all up: thirty-nine.'],
    [28.0, 'Now divide each by the total. They become probabilities that sum to one: sixty-three percent, twenty-one, fourteen, and under two.'],
    [44.0, 'In symbols: the probability of action i is e to the z sub i, over the sum of e to the z sub j, across all the legal actions j.'],
    [58.0, 'Raising a logit by one multiplies its odds by about two point seven. Small score gaps become big probability gaps.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 7', title: 'Softmax: scores to probabilities', sub: 'Illustrative logits from the previous scene', accent: TH.pol });
    const rows = ACTS.map((a, i) => { const g = G(L); const y = 340 + i * 105; T(g, a, { x: 120, y, size: 21, a: 'start', fill: TH.act }); T(g, LOG[i].toFixed(1), { x: 520, y: y + 2, size: 30, w: 700, m: true, fill: LOG[i] < 0 ? TH.grad : TH.pol }); T(g, '→', { x: 590, y: y, size: 28, fill: TH.dim, w: 600 }); T(g, EXP[i].toFixed(1), { x: 700, y: y + 2, size: 30, w: 700, m: true, fill: TH.search }); const bar = S('rect', { x: 820, y: y - 22, width: 0, height: 40, rx: 8, fill: TH.pol, opacity: 0.85 }, g); const pc = T(g, '', { x: 840, y: y + 7, size: 26, w: 700, m: true, a: 'start' }); g.bar = bar; g.pc = pc; g.y = y; return g; });
    const h1 = T(L, 'logit z', { x: 520, y: 270, size: 18, fill: TH.dim, m: true }); const h2 = T(L, 'e^z', { x: 700, y: 270, size: 18, fill: TH.dim, m: true }); const h3 = T(L, 'probability', { x: 1000, y: 270, size: 18, fill: TH.dim, m: true });
    const tot = T(L, `Σ e^z = ${ZS.toFixed(1)}`, { x: 700, y: 770, size: 28, w: 700, m: true, fill: TH.search });
    const eq = Eq(L, { x: 960, y: 860, a: 'middle', size: 40, runs: [['p_i', TH.pol], [' = ', TH.dim], ['e^(z_i)', TH.search], [' / ', TH.dim], ['Σ_j e^(z_j)', TH.search]] });
    return { hd, rows, h1, h2, h3, tot, eq };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.rows.forEach((g, i) => { g.setAttribute('opacity', pr(t, 1.0 + i * 0.3, 0.6)); const p = pr(t, 28.0 + i * 0.5, 0.8, E.outQ4); g.bar.setAttribute('width', 440 * PR[i] * p * 1.35); g.pc.setAttribute('x', 830 + 440 * PR[i] * p * 1.35 + 14); g.pc.textContent = p > 0.02 ? (PR[i] * 100).toFixed(0) + '%' : ''; g.pc.setAttribute('fill', TH.pol); });
    s.rows.forEach((g, i) => { g.childNodes[3].setAttribute('opacity', pr(t, 14.0 + i * 0.5, 0.5)); g.childNodes[2].setAttribute('opacity', pr(t, 14.0 + i * 0.5, 0.5)); });
    s.h1.setAttribute('opacity', pr(t, 1.5, 0.5)); s.h2.setAttribute('opacity', pr(t, 14.0, 0.5)); s.h3.setAttribute('opacity', pr(t, 28.0, 0.5)); s.tot.setAttribute('opacity', pr(t, 20.0, 0.6));
    s.eq.g.setAttribute('opacity', pr(t, 44.0, 0.5)); s.eq.show(pr(t, 44.4, 4));
  },
};

// ===================================================================== 7d: legal mask
export const mask = {
  id: 'c7_mask', title: 'Masking illegal moves', dur: 58, ch: 7, loc: 'heads', mood: [TH.pol, TH.mask, TH.act],
  caps: [
    [0.5, 'The table has sixty-four action slots, but this turn only nine moves are legal. The rest are padding.'],
    [12.0, 'The softmax must ignore them. Before it runs, every padded slot’s logit is overwritten with minus ten thousand.'],
    [26.0, 'The exponential of minus ten thousand is zero for all practical purposes, so those slots get probability zero and cannot take any share.'],
    [40.0, 'Which slots are legal is not stored anywhere extra: it is read straight off the token types, since padding already has its own type.'],
    [50.0, 'Why minus ten thousand and not minus a billion? That is the story of chapter twelve.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 7', title: 'Only legal moves count', sub: '64 action slots · 9 legal this turn (real position)', accent: TH.mask });
    const N = 64, per = 16, cw = 100, ch = 70; const cells = Array.from({ length: N }, (_, i) => { const x = 130 + (i % per) * (cw + 5) * 0.99, y = 340 + Math.floor(i / per) * 110; const legal = i < 9; const g = G(L); const r = S('rect', { x: 0, y: 0, width: cw - 12, height: 80, rx: 9, fill: legal ? rgba(TH.act, 0.18) : '#101826', stroke: legal ? TH.act : '#2b3b52', 'stroke-width': 1.8 }, g); const tx = T(g, '', { x: (cw - 12) / 2, y: 48, size: 17, w: 600, m: true }); g.setAttribute('transform', `translate(${x} ${y})`); return { g, r, tx, legal, i }; });
    const note = T(L, '', { x: 960, y: 830, size: 28, w: 700, m: true });
    const lab = T(L, 'logits per slot', { x: 130, y: 322, size: 16, a: 'start', fill: TH.dim, m: true });
    const L9 = [1.1, 2.1, 0.3, -0.2, 0.9, 0.4, 1.5, 3.2, 0.7];
    return { hd, cells, note, L9, lab };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.cells.forEach((c) => {
      const a = pr(t, 0.8 + (c.i % 16) * 0.05 + Math.floor(c.i / 16) * 0.15, 0.5); c.g.setAttribute('opacity', a);
      const masked = t > 12.0 + (c.i % 16) * 0.03;
      const pass = !c.legal;
      c.tx.textContent = t < 6 ? '' : c.legal ? s.L9[c.i].toFixed(1) : (masked ? '−10⁴' : '0.0');
      c.tx.setAttribute('fill', c.legal ? TH.pol : (masked ? TH.mask : TH.faint));
      if (!c.legal && masked) c.r.setAttribute('fill', '#0a111b');
    });
    s.note.textContent = t < 26 ? '' : t < 40 ? 'e^(−10000) ≈ 0  →  probability 0.000' : 'padding is its own token type: legal = not Pad'; s.note.setAttribute('fill', t < 40 ? TH.mask : TH.act); s.note.setAttribute('opacity', pr(t, 26.0, 0.6));
  },
};

// ===================================================================== 8a: pooling
const TOKS = [[0.4, -0.6, 1.2, 0.2], [1.0, 0.2, -0.4, 0.8], [-0.2, 0.9, 0.6, -0.5]];
const MEAN = [0, 1, 2, 3].map((c) => TOKS.reduce((a, r) => a + r[c], 0) / 3);
export const pool = {
  id: 'c8_pool', title: 'Mean pooling', dur: 56, ch: 8, loc: 'heads', mood: [TH.val, TH.state, TH.mask],
  caps: [
    [0.5, 'The value head asks a different question: not what to do, but how good is this position? That needs a single summary of the whole board.'],
    [12.0, 'Astra takes the state tokens, the part of the sequence describing the hands, systems and opponents, and averages them, number by number.'],
    [28.0, 'Padding is excluded, so an empty slot does not drag the average toward zero. Here is a toy with three real tokens and four numbers each.'],
    [42.0, 'Real Astra averages eighteen state tokens in this position, each of 256 numbers, into one vector of 256.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 8', title: 'The value head', sub: 'Pool the state tokens into one summary vector', accent: TH.val });
    const T3 = Matrix(L, { rows: 4, cols: 4, cw: 90, ch: 52, gap: 6, vals: [...TOKS, [0, 0, 0, 0]], color: TH.state, size: 22, fmtv: (v) => v.toFixed(1), rowLabels: ['state tok 1', 'state tok 2', 'state tok 3', 'Pad'], label: 'encoder outputs (4 of 256 numbers)', labelDy: -16 }); T3.g.setAttribute('transform', 'translate(420 340)');
    const M = Matrix(L, { rows: 1, cols: 4, cw: 90, ch: 56, gap: 6, vals: [MEAN], color: TH.val, size: 24, fmtv: (v) => v.toFixed(2), rowLabels: ['mean'], label: '', }); M.g.setAttribute('transform', 'translate(420 700)');
    const line = S('path', { d: 'M420 668 H800', stroke: TH.val, 'stroke-width': 3 }, L);
    const pad = T(L, 'Pad: excluded (not counted)', { x: 840, y: 598, size: 22, a: 'start', fill: TH.mask, m: true });
    const eq = Eq(L, { x: 1250, y: 560, a: 'middle', size: 40, runs: [['pooled', TH.val], [' = ', TH.dim], ['(1/n)', TH.ink], [' Σ', TH.dim], [' h_i', TH.state]] }); const el = T(L, 'n = number of real state tokens', { x: 1250, y: 610, size: 20, fill: TH.dim, m: true });
    const big = T(L, '18 tokens × 256  →  1 × 256', { x: 1250, y: 760, size: 30, fill: TH.val, m: true, w: 700 });
    return { hd, T3, M, line, pad, eq, el, big };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.T3.set([...TOKS, [0, 0, 0, 0]], (i) => pr(t, 1.0 + i * 0.4, 0.6)); s.T3.hl((i) => (i === 3 && t > 28 ? 0.8 : 0), TH.mask);
    s.M.g.setAttribute('opacity', pr(t, 12.0, 0.6)); s.line.setAttribute('opacity', pr(t, 12.0, 0.6)); s.M.set([MEAN], (i, j) => pr(t, 14.0 + j * 1.0, 0.6));
    s.pad.setAttribute('opacity', pr(t, 28.0, 0.6)); s.eq.g.setAttribute('opacity', pr(t, 20.0, 0.5)); s.eq.show(pr(t, 20.4, 4)); s.el.setAttribute('opacity', pr(t, 25.0, 0.6)); s.big.setAttribute('opacity', pr(t, 42.0, 0.6));
  },
};

// ===================================================================== 8b: value MLP + sigmoid
const sig = (x) => 1 / (1 + Math.exp(-x));
export const valuemlp = {
  id: 'c8_mlp', title: 'From summary to win chance', dur: 56, ch: 8, loc: 'heads', mood: [TH.val, TH.state, TH.pol],
  caps: [
    [0.5, 'The pooled vector goes through a small network: 256 to 256 with ReLU, then down to a single number.'],
    [14.0, 'That number can be anything, so one last squashing function, the sigmoid, forces it into the range zero to one.'],
    [28.0, 'Large negative inputs approach zero, large positive approach one, and zero maps to one half. The result is read as the probability that this seat will win.'],
    [44.0, 'In symbols: sigmoid of x is one over one plus e to the minus x. Sixty-five thousand seven hundred ninety-three parameters, same as the policy scorer.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 8', title: 'From summary to win chance', sub: 'Linear → ReLU → Linear → sigmoid', accent: TH.val });
    const st = [['pooled 256', TH.val, 190], ['Linear 256→256', TH.val, 470], ['ReLU', TH.val, 700], ['Linear 256→1', TH.val, 930], ['sigmoid', TH.pol, 1160]].map(([lb, c, x]) => { const g = G(L); S('rect', { x: -100, y: -36, width: 200, height: 72, rx: 14, fill: rgba(c, 0.13), stroke: c, 'stroke-width': 2 }, g); T(g, lb, { y: 7, size: 19, w: 600 }); g.setAttribute('transform', `translate(${x} 330)`); return g; });
    const links = [0, 1, 2, 3].map((i) => S('path', { d: `M${[290, 570, 800, 1030][i]} 330 L${[370, 600, 830, 1060][i]} 330`, stroke: '#46607e', 'stroke-width': 2.4, 'marker-end': 'url(#arr)' }, L));
    const X0 = 1560, Y0 = 520, SX = 28, SY = 220; const p = G(L); S('path', { d: `M${X0 - 6 * SX} ${Y0} H${X0 + 6 * SX}`, stroke: '#2b3b52', 'stroke-width': 1.6 }, p); S('path', { d: `M${X0} ${Y0 - 1.15 * SY} V${Y0 + 0.1 * SY}`, stroke: '#2b3b52', 'stroke-width': 1.6 }, p);
    let d = ''; for (let i = 0; i <= 60; i++) { const x = -6 + (12 * i) / 60; d += (i ? 'L' : 'M') + (X0 + x * SX) + ' ' + (Y0 - sig(x) * SY) + ' '; } const curve = S('path', { d, stroke: TH.val, 'stroke-width': 4, fill: 'none', filter: 'url(#glow)' }, p); curve.__len = curve.getTotalLength(); curve.setAttribute('stroke-dasharray', curve.__len);
    T(p, '1', { x: X0 - 6 * SX - 14, y: Y0 - SY + 6, size: 18, fill: TH.dim, m: true }); T(p, '0.5', { x: X0 - 6 * SX - 22, y: Y0 - 0.5 * SY + 6, size: 18, fill: TH.dim, m: true }); T(p, '0', { x: X0 - 6 * SX - 14, y: Y0 + 6, size: 18, fill: TH.dim, m: true });
    const pt = S('circle', { r: 10, fill: TH.pol, filter: 'url(#glow)' }, p); const ptl = T(p, '', { y: -22, size: 22, w: 700, fill: TH.pol, m: true });
    const eq = Eq(L, { x: 960, y: 800, a: 'middle', size: 44, runs: [['σ(x)', TH.val], [' = ', TH.dim], ['1 / (1 + e^(−x))', TH.ink]] });
    const pc = T(L, '(256×256 + 256) + (256×1 + 1) = 65,793 parameters', { x: 960, y: 870, size: 22, fill: TH.val, m: true });
    const out = T(L, 'output = P(this seat wins), between 0 and 1', { x: 1560, y: 600, size: 20, fill: TH.dim, m: true });
    return { hd, st, links, p, curve, pt, ptl, eq, pc, out, X0, Y0, SX, SY };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.st.forEach((g, i) => g.setAttribute('opacity', pr(t, 1.0 + i * (i === 4 ? 0 : 1.2) + (i === 4 ? 14 : 0), 0.6)));
    s.links.forEach((l, i) => l.setAttribute('opacity', pr(t, 1.8 + i * 1.2 + (i === 3 ? 12 : 0), 0.5)));
    s.p.setAttribute('opacity', pr(t, 14.0, 0.6)); s.curve.setAttribute('stroke-dashoffset', s.curve.__len * (1 - E.inOutC(clamp((t - 15) / 6))));
    const x = -5 + 10 * (0.5 + 0.5 * Math.sin((t - 28) * 0.5)); const a = pr(t, 28.0, 0.5);
    s.pt.setAttribute('cx', s.X0 + x * s.SX); s.pt.setAttribute('cy', s.Y0 - sig(x) * s.SY); s.pt.setAttribute('opacity', a); s.ptl.setAttribute('x', s.X0 + x * s.SX); s.ptl.setAttribute('y', s.Y0 - sig(x) * s.SY - 22); s.ptl.textContent = a > 0.1 ? `σ(${x.toFixed(1)}) = ${sig(x).toFixed(2)}` : ''; s.ptl.setAttribute('opacity', a);
    s.eq.g.setAttribute('opacity', pr(t, 44.0, 0.5)); s.eq.show(pr(t, 44.4, 4)); s.pc.setAttribute('opacity', pr(t, 50.0, 0.6)); s.out.setAttribute('opacity', pr(t, 28.0, 0.6));
  },
};

// ===================================================================== 8c: the target
export const target = {
  id: 'c8_target', title: 'What the value learns from', dur: 58, ch: 8, loc: 'heads', mood: [TH.val, TH.loss, TH.hist],
  caps: [
    [0.5, 'What does the value head learn from? The final result. Every decision in a game is labelled one if that seat went on to win, and zero if it did not.'],
    [14.0, 'In a four-player game, a typical early position wins about a quarter of the time, so the honest prediction there is near point two five.'],
    [28.0, 'Each individual label is crude: a good position can still lose. But across thousands of similar positions, the average label is the true win rate.'],
    [42.0, 'So the value head learns to predict that average: high for positions that tend to end in a win, low for ones that tend to end in a loss.'],
    [52.0, 'Chapter nine turns that gap between prediction and label into a number to shrink.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 8', title: 'The value target', sub: 'Label = 1 if the seat won the game, else 0', accent: TH.val });
    const tl = G(L); S('path', { d: 'M160 520 H1760', stroke: '#2b3b52', 'stroke-width': 3 }, tl); const marks = Array.from({ length: 9 }, (_, i) => { const g = G(tl); const x = 220 + i * 190; S('circle', { cx: x, cy: 520, r: 14, fill: rgba(TH.state, 0.3), stroke: TH.state, 'stroke-width': 2.4 }, g); T(g, 'decision ' + (i + 1), { x, y: 570, size: 16, fill: TH.dim, m: true }); const lab = T(g, '1', { x, y: 470, size: 38, w: 700, fill: TH.hist, m: true }); return g; });
    const end = G(L); S('rect', { x: 1500, y: 650, width: 280, height: 90, rx: 16, fill: rgba(TH.hist, 0.14), stroke: TH.hist, 'stroke-width': 2.4 }, end); T(end, 'game over: this seat won', { x: 1640, y: 705, size: 22, w: 600, fill: TH.hist });
    const note = T(L, 'every decision in the game gets the same label', { x: 960, y: 790, size: 28, fill: TH.dim, m: true });
    const base = G(L); const Y0 = 720; S('path', { d: `M520 ${Y0} H1400`, stroke: '#2b3b52', 'stroke-width': 2 }, base);
    [[0.25, 'start of game'], [0.4, 'mid-game'], [0.7, 'ahead late']].forEach(([v, lb], i) => { const x = 680 + i * 280; S('rect', { x: x - 60, y: Y0 - v * 420, width: 120, height: v * 420, rx: 8, fill: rgba(TH.val, 0.55) }, base); T(base, v.toFixed(2), { x, y: Y0 - v * 420 - 14, size: 26, fill: TH.val, m: true, w: 700 }); T(base, lb, { x, y: Y0 + 34, size: 18, fill: TH.dim, m: true }); });
    S('path', { d: `M520 ${Y0 - 0.25 * 420} H1400`, stroke: TH.pol, 'stroke-width': 2, 'stroke-dasharray': '7 7' }, base); T(base, 'by chance in a 4-player game: 0.25', { x: 1410, y: Y0 - 0.25 * 420 + 6, size: 18, a: 'start', fill: TH.pol, m: true });
    T(base, 'average label of similar positions = true win rate', { x: 960, y: 300, size: 28, fill: TH.dim, m: true });
    return { hd, tl, marks, end, note, base };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.note.setAttribute('opacity', pr(t, 10.0, 0.6) * (1 - pr(t, 13.5, 0.5)));
    s.base.setAttribute('opacity', pr(t, 14.0, 0.7)); const f = 1 - pr(t, 13.5, 0.6); s.tl.setAttribute('opacity', pr(t, 1.0, 0.6) * f); s.end.setAttribute('opacity', pr(t, 8.0, 0.6) * f); s.marks.forEach((g, i) => g.setAttribute('opacity', pr(t, 2.0 + i * 0.7, 0.5) * f));
  },
};
