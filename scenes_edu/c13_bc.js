import { S, G, T, layer, E, pr, clamp, lerp, mix, rgba, hn, TH, header, shortAct } from './common.js';
import { Matrix, Eq, TokenRow } from '../engine/edukit.js';
import { DEC } from './data.js';

// ===================================================================== 13a: the teacher and the dataset
export const teacher = {
  id: 'c13_teacher', title: 'Learning from a teacher', dur: 62, ch: 13, loc: 'train', mood: [TH.hist, TH.act, TH.loss],
  caps: [
    [0.5, 'Where do the labels come from? Astra starts by imitating a teacher: ExpertCPU, a hand-written bot that plays the game with fixed rules. This is called behaviour cloning.'],
    [14.0, 'ExpertCPU plays whole games. At every decision, the training code records what the board looked like, which moves were legal, and which move the teacher chose.'],
    [30.0, 'When the game ends, every decision from it is also stamped with the result: one if that seat won, zero if it lost.'],
    [44.0, 'The teacher’s choices become the policy labels, and the result becomes the value label. No human has to annotate anything.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 13', title: 'Behaviour cloning', sub: 'Learn to copy ExpertCPU, a fixed-rule bot', accent: TH.hist });
    const bot = G(L); S('rect', { x: 120, y: 360, width: 360, height: 220, rx: 22, fill: rgba(TH.hist, 0.1), stroke: TH.hist, 'stroke-width': 2.4 }, bot); T(bot, 'ExpertCPU', { x: 300, y: 430, size: 42, w: 700, fill: TH.hist, m: true }); T(bot, 'hand-written rules', { x: 300, y: 480, size: 22, fill: TH.dim, m: true }); T(bot, 'plays full games', { x: 300, y: 520, size: 22, fill: TH.dim, m: true });
    const rec = [0, 1, 2].map((i) => { const g = G(L); const x = 640 + i * 360; S('rect', { x, y: 330, width: 320, height: 300, rx: 18, fill: '#0b1320', stroke: rgba(TH.state, 0.7), 'stroke-width': 2 }, g); T(g, `decision ${i + 1}`, { x: x + 160, y: 366, size: 22, w: 700, fill: TH.ink, m: true }); T(g, 'board → 180 tokens', { x: x + 160, y: 420, size: 19, fill: TH.state, m: true }); T(g, 'legal moves → action tokens', { x: x + 160, y: 462, size: 19, fill: TH.act, m: true }); T(g, 'teacher’s choice → index', { x: x + 160, y: 504, size: 19, fill: TH.loss, m: true }); const o = T(g, 'outcome = 1', { x: x + 160, y: 580, size: 22, w: 700, fill: TH.val, m: true }); g.o = o; return g; });
    const ar = S('path', { d: 'M485 470 L630 470', stroke: '#46607e', 'stroke-width': 3, 'marker-end': 'url(#arr)' }, L);
    const fin = T(L, 'game over: this seat won → every decision labelled 1', { x: 1180, y: 700, size: 26, fill: TH.val, m: true });
    return { hd, bot, rec, ar, fin };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.bot.setAttribute('opacity', pr(t, 1.0, 0.7)); s.ar.setAttribute('opacity', pr(t, 14.0, 0.5));
    s.rec.forEach((g, i) => { g.setAttribute('opacity', pr(t, 14.5 + i * 2.5, 0.6)); g.o.setAttribute('opacity', pr(t, 30.0 + i * 0.5, 0.6)); });
    s.fin.setAttribute('opacity', pr(t, 30.0, 0.7));
  },
};

// ===================================================================== 13b: anatomy of an example
export const example = {
  id: 'c13_example', title: 'One training example', dur: 52, ch: 13, loc: 'train', mood: [TH.hist, TH.state, TH.loss],
  caps: [
    [0.5, 'Here is one training example, from the real position in this film. It has four parts.'],
    [10.0, 'First, the observation: the one hundred eighty tokens, with the board, the history, and the legal actions.'],
    [22.0, 'Second, the legal actions themselves, nine of them here, each an action token.'],
    [32.0, 'Third, the label: the index of the move the teacher chose, number seven, Protostar draw two. Fourth, the outcome of the game.'],
    [44.0, 'The network sees only the first two. The last two are what it is graded against.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 13', title: 'Anatomy of one example', sub: 'Real position · turn 85', accent: TH.hist });
    const card = (x, y, w, h, c, title) => { const g = G(L); S('rect', { x, y, width: w, height: h, rx: 18, fill: rgba(c, 0.07), stroke: c, 'stroke-width': 2.2 }, g); T(g, title, { x: x + 24, y: y + 36, size: 24, a: 'start', w: 700, fill: c, m: true }); return g; };
    const A = card(120, 300, 820, 200, TH.state, '1 · observation  (input)'); const strip = (g, x, y, n, c, w) => { for (let i = 0; i < n; i++) S('rect', { x: x + i * (w + 2), y, width: w, height: 38, rx: 3, fill: rgba(c, 0.25 + 0.5 * hn(i, n)) }, g); };
    strip(A, 150, 360, 18, TH.state, 12); T(A, 'state · 18 of 52', { x: 150, y: 420, size: 16, a: 'start', fill: TH.state, m: true }); strip(A, 150 + 18 * 14 + 30, 360, 32, TH.hist, 7); T(A, 'history · 64 (32 shown)', { x: 150 + 18 * 14 + 30, y: 420, size: 16, a: 'start', fill: TH.hist, m: true });
    const B = card(980, 300, 800, 200, TH.act, '2 · legal actions  (input)'); DEC.legal.forEach((a, i) => { const x = 1008 + (i % 3) * 252, y = 350 + Math.floor(i / 3) * 40; T(B, shortAct(a), { x, y: y + 18, size: 13.5, a: 'start', fill: i === DEC.teacher ? TH.loss : TH.act, m: true }); });
    const C = card(120, 560, 820, 200, TH.loss, '3 · label  (target)'); T(C, `teacher chose action ${DEC.teacher + 1} of 9`, { x: 150, y: 640, size: 30, a: 'start', w: 700, fill: TH.loss, m: true }); T(C, shortAct(DEC.legal[DEC.teacher]), { x: 150, y: 690, size: 26, a: 'start', fill: TH.ink });
    const D = card(980, 560, 800, 200, TH.val, '4 · outcome  (target)'); T(D, 'game result for this seat: 1 or 0', { x: 1010, y: 640, size: 28, a: 'start', fill: TH.val, m: true }); T(D, 'used by the value head only', { x: 1010, y: 690, size: 22, a: 'start', fill: TH.dim, m: true });
    const arr = T(L, '', { x: 960, y: 830, size: 26, fill: TH.dim, m: true });
    return { hd, A, B, C, D, arr };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.A.setAttribute('opacity', pr(t, 10.0, 0.6)); s.B.setAttribute('opacity', pr(t, 22.0, 0.6)); s.C.setAttribute('opacity', pr(t, 32.0, 0.6)); s.D.setAttribute('opacity', pr(t, 38.0, 0.6));
    s.arr.textContent = t > 44 ? 'network sees 1 and 2  ·  graded against 3 and 4' : ''; s.arr.setAttribute('opacity', pr(t, 44.0, 0.6));
  },
};

// ===================================================================== 13c: batches and epochs
export const epochs = {
  id: 'c13_epochs', title: 'Batches and epochs', dur: 62, ch: 13, loc: 'train', mood: [TH.hist, TH.pol, TH.val],
  caps: [
    [0.5, 'One example at a time would be slow and noisy, so training groups them into batches. The first run used batches of sixty-four.'],
    [14.0, 'The examples are shuffled, then grouped by length, so that short positions are not padded out to match long ones.'],
    [28.0, 'One pass over the data is an epoch. In the run we are following, an epoch is two thousand games of teacher play, and the plan is fifteen epochs.'],
    [44.0, 'After each epoch, Astra is tested on games it never trained on: the validation set. That is the honest measure of whether it is learning to generalise.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 13', title: 'Batches, epochs and validation', sub: 'Run: batch 64 · 2,000 games per epoch · 15 epochs', accent: TH.hist });
    const N = 96; const pool = G(L); const dots = Array.from({ length: N }, (_, i) => { const x = 140 + (i % 24) * 22, y = 330 + Math.floor(i / 24) * 22; const c = S('rect', { x, y, width: 16, height: 16, rx: 3, fill: rgba(TH.hist, 0.5) }, pool); return c; });
    T(pool, '2,000 games of teacher decisions (shuffled)', { x: 140, y: 310, size: 20, a: 'start', fill: TH.hist, m: true });
    const bt = G(L); const bats = Array.from({ length: 4 }, (_, i) => { const g = G(bt); S('rect', { x: 0, y: 0, width: 190, height: 100, rx: 14, fill: rgba(TH.pol, 0.1), stroke: TH.pol, 'stroke-width': 2 }, g); T(g, 'batch ' + (i + 1), { x: 95, y: 36, size: 22, w: 700, fill: TH.pol, m: true }); T(g, '64 examples', { x: 95, y: 72, size: 18, fill: TH.dim, m: true }); g.setAttribute('transform', `translate(${160 + i * 220} 560)`); return g; });
    const ep = G(L); const cells = Array.from({ length: 15 }, (_, i) => { const x = 1000 + (i % 5) * 140, y = 330 + Math.floor(i / 5) * 90; const g = G(ep); const r = S('rect', { x, y, width: 120, height: 66, rx: 12, fill: '#0b1320', stroke: '#2b3b52', 'stroke-width': 2 }, g); T(g, 'epoch ' + (i + 1), { x: x + 60, y: y + 40, size: 20, fill: TH.dim, m: true }); return { r, i }; });
    const val = G(L); S('rect', { x: 1000, y: 640, width: 680, height: 130, rx: 18, fill: rgba(TH.val, 0.08), stroke: TH.val, 'stroke-width': 2.2 }, val); T(val, 'validation: games held out of training', { x: 1340, y: 690, size: 24, w: 650, fill: TH.val, m: true }); T(val, 'accuracy · loss · measured after each epoch', { x: 1340, y: 730, size: 19, fill: TH.dim, m: true });
    const sorted = T(L, 'grouped by length → little padding', { x: 540, y: 700, size: 22, fill: TH.dim, m: true });
    return { hd, pool, dots, bt, bats, ep, cells, val, sorted };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.pool.setAttribute('opacity', pr(t, 1.0, 0.7)); s.bt.setAttribute('opacity', pr(t, 2.0, 0.5));
    s.bats.forEach((g, i) => g.setAttribute('opacity', pr(t, 2.5 + i * 0.5, 0.6)));
    s.dots.forEach((d, i) => { const grp = Math.floor(i / 24); const on = t > 14 + grp * 1.2; d.setAttribute('fill', on ? rgba(TH.pol, 0.75) : rgba(TH.hist, 0.5)); });
    s.sorted.setAttribute('opacity', pr(t, 14.0, 0.6));
    s.ep.setAttribute('opacity', pr(t, 28.0, 0.7)); s.cells.forEach((c) => { const on = t > 30 + c.i * 0.25; c.r.setAttribute('stroke', c.i === 0 && t > 29 ? TH.hist : on ? '#46607e' : '#2b3b52'); c.r.setAttribute('fill', c.i === 0 && t > 29 ? rgba(TH.hist, 0.2) : '#0b1320'); });
    s.val.setAttribute('opacity', pr(t, 44.0, 0.7));
  },
};

// ===================================================================== 13d: accuracy vs winning
export const gap = {
  id: 'c13_gap', title: 'Accuracy is not winning', dur: 88, ch: 13, loc: 'train', mood: [TH.grad, TH.hist, TH.val],
  caps: [
    [0.5, 'Here are the real numbers from the first run, on the Intel Arc card. After epoch one of fifteen, validation accuracy was 43.91 percent: on unseen teacher positions, Astra picked the teacher’s move that often.'],
    [18.0, 'But in 150 real games it won none. Zero.'],
    [30.0, 'The traces explain why. In evaluation Astra plays its highest-scoring move. On a later checkpoint, it passed 757 times out of 758 decisions where a card was legal, by a logit margin under a tenth.'],
    [46.0, 'A seat that never plays a card can never finish a system. And validation accuracy cannot catch it: it is measured on the teacher’s positions, and an all-pass game leaves them on turn one.'],
    [62.0, 'That is distribution shift in its plainest form. The policy was flat and stalled, as chapter twelve showed, and a flat policy that favours Pass fails exactly where accuracy cannot see.'],
    [76.0, 'So accuracy is a diagnostic, not the goal. The goal is winning, which needs evaluation.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 13', title: '43.91% accuracy, 0 wins', sub: 'First run, after epoch 1 of 15', accent: TH.grad });
    const mt = G(L); const mk = (x, big, lb, c) => { S('rect', { x, y: 290, width: 360, height: 190, rx: 20, fill: rgba(c, 0.08), stroke: c, 'stroke-width': 2.4 }, mt); T(mt, big, { x: x + 180, y: 370, size: 62, w: 700, fill: c, m: true }); T(mt, lb, { x: x + 180, y: 435, size: 20, fill: TH.dim, m: true }); };
    mk(120, '43.91%', 'validation accuracy', TH.hist); mk(520, '0 / 150', 'games won', TH.grad);
    const tree = G(L); const ox = 1000, oy = 330; S('rect', { x: ox - 40, y: oy - 20, width: 760, height: 480, rx: 20, fill: 'none', stroke: '#1d2b40', 'stroke-width': 1.6 }, tree); T(tree, 'positions in the teacher’s data', { x: ox + 160, y: oy - 2, size: 17, fill: TH.hist, m: true });
    S('ellipse', { cx: ox + 250, cy: oy + 250, rx: 260, ry: 150, fill: rgba(TH.hist, 0.07), stroke: rgba(TH.hist, 0.5), 'stroke-width': 2, 'stroke-dasharray': '6 6' }, tree);
    const path = S('path', { d: `M${ox} ${oy + 380} C ${ox + 100} ${oy + 340}, ${ox + 180} ${oy + 300}, ${ox + 250} ${oy + 250} S ${ox + 390} ${oy + 170}, ${ox + 460} ${oy + 130}`, stroke: TH.hist, 'stroke-width': 4, fill: 'none' }, tree);
    const ap = S('path', { d: `M${ox} ${oy + 380} C ${ox + 100} ${oy + 340}, ${ox + 180} ${oy + 300}, ${ox + 250} ${oy + 260} S ${ox + 440} ${oy + 340}, ${ox + 640} ${oy + 410}`, stroke: TH.grad, 'stroke-width': 4, fill: 'none', 'stroke-dasharray': '9 7' }, tree);
    T(tree, 'teacher’s path', { x: ox + 470, y: oy + 100, size: 20, a: 'start', fill: TH.hist, m: true }); T(tree, 'Astra’s path: passes, leaves the teacher’s states', { x: ox + 650, y: oy + 450, size: 19, a: 'end', fill: TH.grad, m: true });
    const sl = S('circle', { cx: ox + 250, cy: oy + 260, r: 12, fill: TH.grad, filter: 'url(#glow)' }, tree); T(tree, 'pass', { x: ox + 250, y: oy + 296, size: 18, fill: TH.grad, m: true });
    const comp = T(L, '', { x: 400, y: 680, size: 26, fill: TH.dim, m: true });
    return { hd, mt, tree, path, ap, sl, comp };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.mt.setAttribute('opacity', pr(t, 1.0, 0.7)); s.mt.childNodes.forEach((n, i) => { if (i >= 3) n.setAttribute('opacity', pr(t, 18.0, 0.6)); });
    s.tree.setAttribute('opacity', pr(t, 30.0, 0.7)); s.ap.setAttribute('opacity', pr(t, 40.0, 0.7)); s.sl.setAttribute('opacity', pr(t, 34.0, 0.5));
    s.comp.textContent = t > 30 ? 'greedy play: Pass 757 of 758 (logit margin < 0.1)' : ''; s.comp.setAttribute('opacity', pr(t, 30.0, 0.6));
  },
};
