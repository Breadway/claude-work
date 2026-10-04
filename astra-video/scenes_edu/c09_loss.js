import { S, G, T, layer, E, pr, clamp, lerp, mix, rgba, hn, TH, header, shortAct } from './common.js';
import { Matrix, Eq } from '../engine/edukit.js';
import { DEC } from './data.js';

const P9 = [0.05, 0.07, 0.04, 0.12, 0.06, 0.05, 0.10, 0.45, 0.06];   // illustrative network probabilities, sum 1
const TEACH = DEC.teacher;                                            // 7 = Protostar → draw two (real ExpertCPU choice)
const NAMES9 = DEC.legal.map((a) => shortAct(a));
const nll = (p) => -Math.log(p);

// ===================================================================== 9a: cross-entropy
export const ce = {
  id: 'c9_ce', title: 'Cross-entropy', dur: 84, ch: 9, loc: 'loss', mood: [TH.loss, TH.pol, TH.act],
  caps: [
    [0.5, 'Training needs a single number that says how wrong Astra is. We have the network’s probabilities, and we know what the teacher actually did.'],
    [12.0, 'In this position the teacher chose Protostar, draw two. The network gave that move forty-five percent. Not bad, but not certain.'],
    [26.0, 'The loss is minus the log of the probability the network gave to the teacher’s move. Here: minus log of point four five, about point eight.'],
    [40.0, 'Watch what the log does. If the network had given the move ninety-five percent, the loss is tiny. If it had given five percent, the loss is three: a big penalty.'],
    [58.0, 'Cross-entropy punishes confident mistakes hard and rewards putting probability on what the teacher did. It cannot be satisfied by spreading probability around.'],
    [72.0, 'The probabilities here are illustrative. The position and the teacher’s choice are the real turn-eighty-five decision.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 9', title: 'Cross-entropy loss', sub: 'Real position and teacher move · illustrative network probabilities', accent: TH.loss });
    const bars = NAMES9.map((n, i) => { const g = G(L); const y = 300 + i * 56; T(g, n, { x: 100, y: y + 6, size: 19, a: 'start', fill: i === TEACH ? TH.loss : TH.act }); const bar = S('rect', { x: 560, y: y - 16, width: 0, height: 32, rx: 7, fill: i === TEACH ? TH.loss : rgba(TH.pol, 0.8) }, g); const v = T(g, '', { x: 570, y: y + 7, size: 20, a: 'start', m: true, w: 650, fill: TH.ink }); if (i === TEACH) { S('rect', { x: 90, y: y - 22, width: 1000, height: 44, rx: 10, fill: 'none', stroke: TH.loss, 'stroke-width': 2, opacity: 0.8 }, g); T(g, '← teacher', { x: 1100, y: y + 6, size: 18, a: 'start', fill: TH.loss, m: true }); } g.bar = bar; g.v = v; return g; });
    const X0 = 1330, Y0 = 760, SX = 440, SY = 150; const p = G(L); S('path', { d: `M${X0} ${Y0} H${X0 + SX}`, stroke: '#2b3b52', 'stroke-width': 1.8 }, p); S('path', { d: `M${X0} ${Y0} V${Y0 - 4 * SY * 0.75}`, stroke: '#2b3b52', 'stroke-width': 1.8 }, p);
    let d = ''; for (let i = 0; i <= 80; i++) { const x = 0.03 + (0.97 * i) / 80; d += (i ? 'L' : 'M') + (X0 + x * SX) + ' ' + (Y0 - nll(x) * SY * 0.75) + ' '; } const cv = S('path', { d, stroke: TH.loss, 'stroke-width': 4, fill: 'none', filter: 'url(#glow)' }, p); cv.__len = cv.getTotalLength(); cv.setAttribute('stroke-dasharray', cv.__len);
    T(p, 'p given to the teacher’s move', { x: X0 + SX / 2, y: Y0 + 38, size: 17, fill: TH.dim, m: true }); T(p, 'loss = −log p', { x: X0 + 170, y: Y0 - 4 * SY * 0.75 - 6, size: 22, fill: TH.loss, m: true });
    T(p, '0', { x: X0 - 12, y: Y0 + 6, size: 16, fill: TH.dim, m: true, a: 'end' }); T(p, '1', { x: X0 + SX, y: Y0 + 22, size: 16, fill: TH.dim, m: true });
    const dot = S('circle', { r: 11, fill: TH.ink, filter: 'url(#glow)' }, p); const lb = T(p, '', { size: 24, w: 700, fill: TH.ink, m: true, a: 'start' });
    const eq = Eq(L, { x: 960, y: 855, a: 'middle', size: 40, runs: [['L', TH.loss], [' = ', TH.dim], ['−log p', TH.loss], ['(teacher’s move)', TH.pol]] });
    return { hd, bars, p, cv, dot, lb, eq, X0, Y0, SX, SY };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.bars.forEach((g, i) => { const a = pr(t, 1.5 + i * 0.25, 0.6); const w = 440 * P9[i] * 2.0 * a; g.setAttribute('opacity', a); g.bar.setAttribute('width', w); g.v.setAttribute('x', 575 + w); g.v.textContent = a > 0.3 ? (P9[i] * 100).toFixed(0) + '%' : ''; });
    s.p.setAttribute('opacity', pr(t, 24.0, 0.6)); s.cv.setAttribute('stroke-dashoffset', s.cv.__len * (1 - E.inOutC(clamp((t - 25) / 4))));
    let q = 0.45; if (t > 42) q = lerp(0.45, 0.95, E.inOutC(clamp((t - 42) / 4))); if (t > 50) q = lerp(0.95, 0.05, E.inOutC(clamp((t - 50) / 5))); if (t > 58) q = lerp(0.05, 0.45, E.inOutC(clamp((t - 58) / 4)));
    const a = pr(t, 26.0, 0.5); const cx = s.X0 + q * s.SX, cy = s.Y0 - nll(q) * s.SY * 0.75;
    s.dot.setAttribute('cx', cx); s.dot.setAttribute('cy', cy); s.dot.setAttribute('opacity', a); s.lb.setAttribute('x', q > 0.6 ? cx - 18 : cx + 18); s.lb.setAttribute('text-anchor', q > 0.6 ? 'end' : 'start'); s.lb.setAttribute('y', cy - 14); s.lb.textContent = a > 0.1 ? `p = ${q.toFixed(2)}  →  loss ${nll(q).toFixed(2)}` : ''; s.lb.setAttribute('opacity', a);
    s.eq.g.setAttribute('opacity', pr(t, 26.0, 0.5)); s.eq.show(pr(t, 26.4, 4));
  },
};

// ===================================================================== 9b: label smoothing
const EPS = 0.05, N = 9;
const HARD = P9.map((_, i) => (i === TEACH ? 1 : 0)); const SMOOTH = HARD.map((h) => (1 - EPS) * h + EPS / N);
export const smoothing = {
  id: 'c9_smooth', title: 'Label smoothing', dur: 62, ch: 9, loc: 'loss', mood: [TH.loss, TH.pol, TH.mask],
  caps: [
    [0.5, 'The teacher’s choice is treated as certain: one hundred percent on one move, zero on the rest. But the teacher is a heuristic bot, and other moves may have been nearly as good.'],
    [16.0, 'Astra softens the target a little. Five percent of the probability is shared equally among all nine legal moves; the rest stays on the teacher’s pick.'],
    [32.0, 'That makes the target ninety-five and a half percent on the teacher’s move, and about half a percent on each of the others. Illegal moves get nothing.'],
    [46.0, 'This stops the network from chasing infinite confidence, which would push logits ever larger and, in half precision, towards overflow.'],
    [56.0, 'It is a small change with a steady effect: loss equals one minus epsilon times the hard loss, plus epsilon times the loss against the uniform target. Epsilon is point oh five.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 9', title: 'Label smoothing', sub: 'ε = 0.05, spread over the legal moves only', accent: TH.loss });
    const mk = (title, x, vals, col) => { const g = G(L); T(g, title, { x: x + 220, y: 280, size: 24, w: 650, fill: col, m: true }); const rs = vals.map((v, i) => { const y = 330 + i * 52; T(g, String(i + 1), { x: x - 16, y: y + 6, size: 16, a: 'end', fill: i === TEACH ? TH.loss : TH.dim, m: true }); const r = S('rect', { x, y: y - 14, width: 0, height: 28, rx: 6, fill: i === TEACH ? TH.loss : rgba(TH.pol, 0.8) }, g); const t = T(g, '', { x: x + 6, y: y + 6, size: 17, a: 'start', m: true, fill: TH.ink }); return { r, t, v, x }; }); g.rs = rs; return g; };
    const A = mk('hard target (one-hot)', 160, HARD, TH.dim), B = mk('smoothed target', 900, SMOOTH, TH.loss);
    const pad = G(L); T(pad, '+ 55 padded slots: target 0, logit masked', { x: 900, y: 330 + 9 * 52 + 4, size: 17, a: 'start', fill: TH.mask, m: true });
    const eq = Eq(L, { x: 960, y: 890, a: 'middle', size: 34, runs: [['L', TH.loss], [' = (1−ε)', TH.dim], [' CE_hard', TH.loss], [' + ε', TH.dim], [' CE_uniform', TH.pol]] });
    const note = T(L, 'ε/9 = 0.0056 to every legal move   ·   teacher: 0.95 + 0.0056 = 0.9556', { x: 960, y: 845, size: 22, fill: TH.dim, m: true });
    return { hd, A, B, pad, eq, note };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.A.setAttribute('opacity', pr(t, 1.0, 0.6)); s.A.rs.forEach((o, i) => { const p = pr(t, 2.0 + i * 0.2, 0.5); o.r.setAttribute('width', 440 * o.v * p); o.t.setAttribute('x', o.x + 440 * o.v * p + 8); o.t.textContent = o.v ? '1.000' : '0'; });
    const b = pr(t, 16.0, 0.6); s.B.setAttribute('opacity', b); s.B.rs.forEach((o, i) => { const p = E.outQ4(clamp((t - 17 - i * 0.15) / 1.2)); o.r.setAttribute('width', 440 * o.v * p); o.t.setAttribute('x', o.x + 440 * o.v * p + 8); o.t.textContent = p > 0.1 ? o.v.toFixed(4) : ''; });
    s.pad.setAttribute('opacity', pr(t, 32.0, 0.6)); s.note.setAttribute('opacity', pr(t, 32.0, 0.6) * (1 - pr(t, 55.5, 0.5)));
    s.eq.g.setAttribute('opacity', pr(t, 56.0, 0.5)); s.eq.show(pr(t, 56.4, 4));
  },
};

// ===================================================================== 9c: value MSE and total
export const total = {
  id: 'c9_total', title: 'Value loss and total', dur: 70, ch: 9, loc: 'loss', mood: [TH.loss, TH.val, TH.pol],
  caps: [
    [0.5, 'The value head has its own loss: mean squared error. Take the predicted win chance, subtract the label, and square it.'],
    [12.0, 'Predict point six, and the seat won: the gap is point four, squared point one six. Predict point six, and it lost: point six squared is point three six.'],
    [28.0, 'Squaring makes big misses cost far more than small ones, and the sign cancels out.'],
    [40.0, 'They are added into one number, so one backward pass improves everything. But not equally: the value term is multiplied by point three.'],
    [54.0, 'That is because a game result is a noisy label for any single decision. Astra’s main job at this stage is to copy the teacher, so the policy loss leads.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 9', title: 'Value loss and the total', sub: 'MSE, then a weighted sum', accent: TH.loss });
    const ex = [[0.6, 1, 'won'], [0.6, 0, 'lost']].map(([v, y, lb], i) => { const g = G(L); const x = 120 + i * 470; S('rect', { x, y: 300, width: 420, height: 230, rx: 18, fill: rgba(TH.val, 0.08), stroke: rgba(TH.val, 0.6), 'stroke-width': 2 }, g); T(g, `predicted ${v.toFixed(1)}  ·  label ${y} (${lb})`, { x: x + 210, y: 345, size: 22, fill: TH.dim, m: true }); T(g, `(${v.toFixed(1)} − ${y})² = ${((v - y) ** 2).toFixed(2)}`, { x: x + 210, y: 430, size: 36, w: 700, fill: TH.val, m: true }); const b = S('rect', { x: x + 60, y: 470, width: 300 * (v - y) ** 2 / 0.4, height: 28, rx: 7, fill: TH.loss }, g); return g; });
    const eq1 = Eq(L, { x: 1480, y: 380, a: 'middle', size: 36, runs: [['L_value', TH.val], [' = mean', TH.dim], ['(v − y)²', TH.val]] });
    const tot = G(L); const blocks = [['policy loss', TH.pol, 120, 330], ['+  0.3 ×  value loss', TH.val, 470, 330]]; blocks.forEach(([lb, c, x, w]) => { S('rect', { x, y: 640, width: w, height: 90, rx: 16, fill: rgba(c, 0.15), stroke: c, 'stroke-width': 2.2 }, tot); T(tot, lb, { x: x + w / 2, y: 697, size: 28, w: 650, fill: c, m: true }); });
    T(tot, '=  total loss', { x: 900, y: 697, size: 32, a: 'start', w: 700, fill: TH.loss, m: true });
    const eq2 = Eq(L, { x: 960, y: 830, a: 'middle', size: 40, runs: [['L_total', TH.loss], [' = ', TH.dim], ['L_policy', TH.pol], [' + 0.3 · ', TH.dim], ['L_value', TH.val]] });
    const why = T(L, 'a game result is a noisy label for one decision → value is down-weighted', { x: 960, y: 890, size: 24, fill: TH.dim, m: true });
    return { hd, ex, eq1, tot, eq2, why };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.ex[0].setAttribute('opacity', pr(t, 1.5, 0.6)); s.ex[1].setAttribute('opacity', pr(t, 12.5, 0.6));
    s.eq1.g.setAttribute('opacity', pr(t, 28.0, 0.5)); s.eq1.show(pr(t, 28.4, 3));
    s.tot.setAttribute('opacity', pr(t, 40.0, 0.6)); s.eq2.g.setAttribute('opacity', pr(t, 44.0, 0.5)); s.eq2.show(pr(t, 44.4, 4)); s.why.setAttribute('opacity', pr(t, 54.0, 0.6));
  },
};

// ===================================================================== 9d: the numbers you actually see
export const meters = {
  id: 'c9_meters', title: 'What the logged numbers mean', dur: 52, ch: 9, loc: 'loss', mood: [TH.loss, TH.pol, TH.val],
  caps: [
    [0.5, 'While training runs, the log reports two loss numbers. Neither is the total from the last scene.'],
    [10.0, 'The policy number is plain cross-entropy, without smoothing. Lower means the teacher’s move is getting more probability.'],
    [24.0, 'The value number is the plain mean squared error, before the point-three weighting.'],
    [36.0, 'Neither tells you whether Astra wins games. They tell you how well it imitates the teacher and how well it guesses outcomes on positions it has seen.'],
    [46.0, 'Epoch-end checks add top-three and top-five accuracy, and the probability given to the teacher’s move. Chapter thirteen shows why accuracy alone misleads.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 9', title: 'The numbers you will see', sub: 'What the training log reports', accent: TH.loss });
    const cards = [['policy loss', TH.pol, 'hard cross-entropy\n(no smoothing)', 'falls as the teacher’s move\ngets more probability'], ['value loss', TH.val, 'plain MSE\n(before the 0.3 weight)', 'falls as outcome guesses\nget closer to 0 / 1']].map(([n, c, a, b], i) => { const g = G(L); const x = 220 + i * 760; S('rect', { x, y: 310, width: 700, height: 400, rx: 22, fill: rgba(c, 0.08), stroke: c, 'stroke-width': 2.4 }, g); T(g, n, { x: x + 350, y: 380, size: 40, w: 700, fill: c, m: true }); a.split('\n').forEach((l, k) => T(g, l, { x: x + 350, y: 450 + k * 36, size: 26, fill: TH.ink })); b.split('\n').forEach((l, k) => T(g, l, { x: x + 350, y: 590 + k * 34, size: 22, fill: TH.dim })); T(g, '↘', { x: x + 350, y: 540, size: 44, fill: c, w: 600 }); return g; });
    const warn = T(L, 'low loss ≠ winning games', { x: 960, y: 820, size: 40, w: 700, fill: TH.grad, m: true });
    return { hd, cards, warn };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.cards[0].setAttribute('opacity', pr(t, 8.0, 0.7)); s.cards[1].setAttribute('opacity', pr(t, 22.0, 0.7)); s.warn.setAttribute('opacity', pr(t, 36.0, 0.8));
  },
};
