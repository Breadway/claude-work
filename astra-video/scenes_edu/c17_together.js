import { S, G, T, layer, E, pr, clamp, lerp, mix, rgba, hn, TH, header, shortAct } from './common.js';
import { Eq, Flow } from '../engine/edukit.js';
import { DEC } from './data.js';
const SC = TH.search;
const STAGES = [['tokens', 'ch 2', TH.state, '180 slots'], ['embeddings', 'ch 3', TH.state, '+ lookup'], ['6 × block', 'ch 5–6', SC, 'attention + FFN'], ['policy head', 'ch 7', TH.pol, 'logits'], ['softmax', 'ch 7', TH.pol, 'probabilities']];

// ===================================================================== 17a: forward replay
export const forward = {
  id: 'c17_forward', title: 'The forward pass, once', dur: 66, ch: 17, loc: 'train', mood: [TH.state, SC, TH.pol],
  caps: [
    [0.5, 'Now everything together, on the position from the start of this film: turn eighty-five, nine legal moves.'],
    [10.0, 'The board becomes one hundred eighty tokens, each eight small integers. Each integer picks a learned row, and the rows are added.'],
    [24.0, 'Six blocks let every token read every other: the hand reads the systems, the actions read the hand, the history reads the actions.'],
    [38.0, 'The policy head scores each action token. Illegal slots are pushed to minus ten thousand. Softmax turns the nine scores into probabilities.'],
    [52.0, 'The value head, from the pooled state tokens, gives a win chance. One pass, two answers, in a fraction of a second.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 17', title: 'Everything together: forward', sub: 'Real position · turn 85 · illustrative probabilities', accent: TH.state });
    const nodes = STAGES.map(([n, ch, c, sub], i) => { const g = G(L); const x = 200 + i * 380; S('rect', { x: -130, y: -52, width: 260, height: 104, rx: 18, fill: rgba(c, 0.13), stroke: c, 'stroke-width': 2.4 }, g); T(g, n, { y: -10, size: 28, w: 700, fill: c, m: true }); T(g, sub, { y: 22, size: 18, fill: TH.dim, m: true }); T(g, ch, { y: 76, size: 16, fill: TH.faint, m: true }); g.setAttribute('transform', `translate(${x} 400)`); return g; });
    const links = [0, 1, 2, 3].map((i) => S('path', { d: `M${200 + i * 380 + 134} 400 L${200 + (i + 1) * 380 - 138} 400`, stroke: '#46607e', 'stroke-width': 2.6, 'marker-end': 'url(#arr)' }, L));
    const P9 = [0.05, 0.07, 0.04, 0.12, 0.06, 0.05, 0.10, 0.45, 0.06];
    const out = G(L); DEC.legal.forEach((a, i) => { const x = 200 + (i % 3) * 330, y = 600 + Math.floor(i / 3) * 62; T(out, shortAct(a), { x, y, size: 17, a: 'start', fill: i === DEC.teacher ? TH.loss : TH.act, m: true }); S('rect', { x: x + 250, y: y - 14, width: 260 * P9[i] * 1.6, height: 26, rx: 6, fill: i === DEC.teacher ? TH.loss : rgba(TH.pol, 0.75) }, out); });
    const val = G(L); S('rect', { x: 1500, y: 580, width: 300, height: 120, rx: 18, fill: rgba(TH.val, 0.1), stroke: TH.val, 'stroke-width': 2.2 }, val); T(val, 'value head', { x: 1650, y: 620, size: 22, w: 700, fill: TH.val, m: true }); T(val, '≈ 0.31 (illustrative)', { x: 1650, y: 665, size: 26, w: 700, fill: TH.ink, m: true });
    const dot = S('circle', { r: 11, fill: TH.ink, filter: 'url(#glow)' }, L);
    return { hd, nodes, links, out, val, dot };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.nodes.forEach((g, i) => g.setAttribute('opacity', pr(t, 1.0 + i * 0.3, 0.6))); s.links.forEach((l, i) => l.setAttribute('opacity', pr(t, 1.5 + i * 0.3, 0.5)));
    const u = clamp((t - 6) / 40) * 4; const x = 200 + u * 380; s.dot.setAttribute('cx', x); s.dot.setAttribute('cy', 400); s.dot.setAttribute('opacity', pr(t, 6, 0.4) * (t < 48 ? 1 : 0));
    s.out.setAttribute('opacity', pr(t, 38.0, 0.7)); s.val.setAttribute('opacity', pr(t, 52.0, 0.7));
  },
};

// ===================================================================== 17b: backward
export const backward = {
  id: 'c17_back', title: 'The backward pass', dur: 50, ch: 17, loc: 'train', mood: [TH.grad, TH.loss, TH.pol],
  caps: [
    [0.5, 'The teacher chose Protostar, draw two. The network gave it forty-five percent. The loss, minus the log of that, is about point eight.'],
    [12.0, 'Backpropagation sends that loss back: through softmax, the policy head, the six blocks, attention and feed-forward, down to the embedding rows that were looked up.'],
    [28.0, 'Every weight on the way gets a gradient. Adam, with its memory, a clip at one and a warm-up schedule, turns each into a small step.'],
    [40.0, 'Next time this position appears, Protostar draw two gets slightly more probability. Then do that, millions of times.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 17', title: 'Everything together: backward', sub: 'One loss number, one small step for every weight', accent: TH.grad });
    const st = [['loss = −log 0.45 = 0.80', TH.loss, 300], ['policy head + softmax', TH.pol, 400], ['block 6 … block 1', SC, 500], ['embedding rows', TH.state, 600], ['Adam: clip · schedule · step', TH.pol, 700]];
    const nodes = st.map(([lb, c, y]) => { const g = G(L); S('rect', { x: -330, y: -34, width: 660, height: 68, rx: 14, fill: rgba(c, 0.13), stroke: c, 'stroke-width': 2.2 }, g); T(g, lb, { y: 8, size: 26, w: 650, fill: c, m: true }); g.setAttribute('transform', `translate(700 ${y})`); return g; });
    const arrow = S('path', { d: 'M1100 300 V700', stroke: TH.grad, 'stroke-width': 4, fill: 'none', 'marker-end': 'url(#arr)' }, L); const fl = Flow(L, 'M1100 300 V700', { n: 6, color: TH.grad, r: 7 }); T(L, 'gradient', { x: 1130, y: 500, size: 24, a: 'start', fill: TH.grad, m: true });
    const res = T(L, 'next time: p(Protostar → draw two) rises a little', { x: 960, y: 830, size: 28, fill: TH.hist, m: true });
    return { hd, nodes, arrow, fl, res };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.nodes.forEach((g, i) => g.setAttribute('opacity', pr(t, [0.8, 12, 14, 22, 28][i], 0.6))); const a = pr(t, 12, 0.6); s.arrow.setAttribute('opacity', a); s.fl.g.setAttribute('opacity', a); s.fl.update(t, 0.2, 1); s.res.setAttribute('opacity', pr(t, 40, 0.7));
  },
};

// ===================================================================== 17c: zoom out
export const zoom = {
  id: 'c17_zoom', title: 'Zooming out', dur: 62, ch: 17, loc: 'train', mood: [TH.state, SC, TH.hist],
  caps: [
    [0.5, 'That was one position. A batch is sixty-four of them, averaged. An epoch is two thousand games of them.'],
    [12.0, 'Fifteen epochs of imitation give a network that predicts the teacher but cannot yet win. Search and self-play then let it learn from its own games.'],
    [26.0, 'All of it is the same small machine: eight integers per token, a lookup, six blocks of attention, two heads, a loss, a gradient, a step. Four million, nine hundred eighty-seven thousand numbers, adjusted a little at a time.'],
    [46.0, 'There is no rulebook inside Astra. Everything it knows is in those numbers, and they were shaped by examples.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 17', title: 'Zooming out', sub: 'From one decision to a trained player', accent: SC });
    const lv = [['1 decision', TH.state, 1], ['batch · 64', TH.pol, 2], ['epoch · 2,000 games', TH.hist, 3], ['15 epochs · behaviour cloning', TH.loss, 4], ['search + self-play loop', SC, 5]];
    const boxes = lv.map(([lb, c, k], i) => { const g = G(L); const w = 300 + i * 220, y = 290 + i * 84; S('rect', { x: 960 - w / 2, y: y - 38, width: w, height: 76, rx: 16, fill: rgba(c, 0.12), stroke: c, 'stroke-width': 2.2 }, g); T(g, lb, { x: 960, y: y + 7, size: 26, w: 650, fill: c, m: true }); return g; });
    const par = T(L, '4,987,394 parameters', { x: 960, y: 750, size: 54, w: 750, fill: TH.state, m: true });
    return { hd, boxes, par };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.boxes.forEach((g, i) => g.setAttribute('opacity', pr(t, [1, 4, 12, 17, 22][i], 0.6))); s.par.setAttribute('opacity', pr(t, 26.0, 0.8));
  },
};
