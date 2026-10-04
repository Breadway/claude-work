import { S, G, T, layer, E, pr, clamp, lerp, mix, rgba, hn, TH, header } from './common.js';
import { Eq } from '../engine/edukit.js';
const SC = TH.search;

// ===================================================================== 16a: the loop
export const loop = {
  id: 'c16_loop', title: 'The self-play loop', dur: 68, ch: 16, loc: 'search', mood: [SC, TH.hist, TH.val],
  caps: [
    [0.5, 'Behaviour cloning can only ever copy the teacher. To go beyond it, Astra needs to learn from its own play. That is the idea behind AlphaZero: play, learn from the results, repeat.'],
    [14.0, 'Step one, self-play: games are played using search. Every decision records the position and the search’s visit distribution.'],
    [28.0, 'When a game ends, each recorded position is stamped with the result, one for a win and zero for a loss.'],
    [40.0, 'Step two, training: the network learns to predict the visit distribution and the result, so its raw judgement moves closer to what search found.'],
    [52.0, 'Step three, evaluation: the new network plays without search against three AdvCPU bots. If it is the best so far, it is kept. Then the loop starts again, with a stronger network guiding search.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 16', title: 'The AlphaZero-style loop', sub: 'Play → learn → check → repeat', accent: SC });
    const st = [['self-play\nwith search', SC, 0], ['record (position,\nvisits, result)', TH.hist, 1], ['train the\nnetwork', TH.pol, 2], ['evaluate vs\n3 × AdvCPU', TH.val, 3], ['keep best', TH.loss, 4]];
    const cx = 960, cy = 570, RX = 560, RY = 240; const nodes = st.map(([lb, c, i]) => { const a = -Math.PI / 2 + (i / st.length) * Math.PI * 2; const g = G(L); S('rect', { x: -130, y: -46, width: 260, height: 92, rx: 18, fill: rgba(c, 0.13), stroke: c, 'stroke-width': 2.4 }, g); lb.split('\n').forEach((l, k) => T(g, l, { y: -6 + k * 28, size: 22, w: 650, fill: c, m: true })); g.setAttribute('transform', `translate(${cx + Math.cos(a) * RX} ${cy + Math.sin(a) * RY})`); return g; });
    const ring = S('ellipse', { cx, cy, rx: RX, ry: RY, fill: 'none', stroke: '#2b3b52', 'stroke-width': 2, 'stroke-dasharray': '6 8' }, L);
    const mid = T(L, 'a stronger network guides stronger search', { x: cx, y: cy + 6, size: 26, fill: TH.dim, m: true });
    const dot = S('circle', { r: 11, fill: TH.ink, filter: 'url(#glow)' }, L);
    return { hd, nodes, ring, mid, dot, cx, cy, RX, RY };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.nodes.forEach((g, i) => g.setAttribute('opacity', pr(t, [14, 28, 40, 52, 58][i] - 1, 0.6) || (i === 0 ? pr(t, 1, 0.6) : 0)));
    s.ring.setAttribute('opacity', pr(t, 14.0, 0.8)); s.mid.setAttribute('opacity', pr(t, 58.0, 0.7));
    const u = ((t - 14) / 10) % 1; const a = -Math.PI / 2 + u * Math.PI * 2; s.dot.setAttribute('cx', s.cx + Math.cos(a) * s.RX); s.dot.setAttribute('cy', s.cy + Math.sin(a) * s.RY); s.dot.setAttribute('opacity', pr(t, 14, 0.5));
  },
};

// ===================================================================== 16b: the targets
export const targets = {
  id: 'c16_targets', title: 'What changes in the targets', dur: 56, ch: 16, loc: 'search', mood: [SC, TH.loss, TH.val],
  caps: [
    [0.5, 'The training step looks like behaviour cloning, with one important change: the policy target.'],
    [10.0, 'Before, the target was the teacher’s single choice, lightly smoothed. Now it is the whole visit distribution from search, a richer signal that says how good every candidate looked.'],
    [26.0, 'The value target is still the game’s result. But its weight rises from point three to one, since these results come from Astra’s own games rather than a teacher’s.'],
    [40.0, 'The whole network keeps learning: the trunk is not frozen. And the policy loss is cross-entropy against the visit distribution, with no extra smoothing.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 16', title: 'New targets, same machinery', sub: 'Behaviour cloning vs self-play training', accent: SC });
    const col = (x, ttl, c, vals, rows) => { const g = G(L); S('rect', { x, y: 290, width: 760, height: 450, rx: 20, fill: rgba(c, 0.06), stroke: rgba(c, 0.7), 'stroke-width': 2.2 }, g); T(g, ttl, { x: x + 380, y: 335, size: 28, w: 700, fill: c, m: true }); vals.forEach((v, i) => { const y = 372 + i * 28; S('rect', { x: x + 40, y: y, width: 400 * v, height: 20, rx: 6, fill: rgba(c, 0.75) }, g); }); rows.forEach(([a, b], i) => { T(g, a, { x: x + 40, y: 664 + i * 36, size: 21, a: 'start', fill: TH.dim, m: true }); T(g, b, { x: x + 720, y: 664 + i * 36, size: 21, a: 'end', fill: TH.ink, m: true }); }); return g; };
    const A = col(120, 'behaviour cloning', TH.loss, [0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.04, 0.96, 0.04].map((v) => v), [['policy target', 'teacher’s move (smoothed)'], ['value weight', '0.3']]);
    const vd = [0.05, 0.07, 0.04, 0.12, 0.06, 0.05, 0.10, 0.45, 0.06];
    const B = col(1040, 'self-play', SC, vd.map((v) => v * 2), [['policy target', 'search visit distribution'], ['value weight', '1.0 · trunk unfrozen']]);
    const eq = Eq(L, { x: 960, y: 830, a: 'middle', size: 36, runs: [['L', TH.loss], [' = −Σ ', TH.dim], ['π_visits', SC], [' · log p', TH.pol], ['  +  1.0 · ', TH.dim], ['(v − y)²', TH.val]] });
    return { hd, A, B, eq };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.A.setAttribute('opacity', pr(t, 1.0, 0.7)); s.B.setAttribute('opacity', pr(t, 10.0, 0.7)); s.eq.g.setAttribute('opacity', pr(t, 40.0, 0.5)); s.eq.show(pr(t, 40.4, 4));
  },
};

// ===================================================================== 16c: differences from canonical AlphaZero
const ROWS = [
  ['Opponents', 'the network plays itself', 'seats drawn from AdvCPU, ExpertCPU and the net; only the net’s seats make training data'],
  ['Search tree', 'deep tree, grown one move at a time', 'one level deep: candidates only, each scored by an engine playout + value head'],
  ['What is searched', 'every decision', 'choose-action and chain response; other three kinds use the raw policy'],
  ['The game', '2 players, nothing hidden', '4 players, hidden hands, chance'],
  ['Starting point', 'random weights', 'behaviour-cloned from ExpertCPU first'],
  ['Strength check', 'new net must beat the old one', 'win rate vs 3 × AdvCPU, no search; restart from the best'],
];
export const diffs = {
  id: 'c16_diffs', title: 'Not canonical AlphaZero', dur: 84, ch: 16, loc: 'search', mood: [SC, TH.grad, TH.pol],
  caps: [
    [0.5, 'Astra’s loop borrows AlphaZero’s idea, but it is not a copy. Here are the differences, so the comparison stays honest.'],
    [10.0, 'Opponents. Canonical AlphaZero plays against itself. Astra’s seats are drawn from AdvCPU, ExpertCPU and itself, and only its own seats produce training data.'],
    [24.0, 'The tree. Canonical search grows a deep tree. Astra’s is one level deep, with each candidate scored by a short engine playout and the value head.'],
    [38.0, 'Coverage. Only two of the five decision kinds are searched. And the game itself has four players, hidden hands and chance, unlike chess or Go.'],
    [52.0, 'Starting point. Canonical AlphaZero starts from random weights. Astra begins with behaviour cloning.'],
    [62.0, 'And the strength check is a win rate against fixed AdvCPU bots, not the previous network.'],
    [74.0, 'None of this makes the approach wrong. It makes it AlphaZero-style, adapted to this game and its engine.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 16', title: 'How Astra differs from canonical AlphaZero', sub: 'Read from the source, not from the textbook', accent: TH.grad });
    T(L, 'canonical AlphaZero', { x: 640, y: 262, size: 22, w: 700, fill: TH.dim, m: true }); T(L, 'Astra-7', { x: 1400, y: 262, size: 22, w: 700, fill: SC, m: true });
    const rows = ROWS.map(([a, b, c], i) => { const g = G(L); const y = 320 + i * 100; S('rect', { x: 100, y: y - 36, width: 1720, height: 84, rx: 14, fill: rgba(SC, 0.05), stroke: '#26354a', 'stroke-width': 1.6 }, g); T(g, a, { x: 130, y: y + 6, size: 24, a: 'start', w: 700, fill: TH.pol }); T(g, b, { x: 640, y: y + 6, size: 20, w: 500, fill: TH.dim }); T(g, c, { x: 1390, y: y + 6, size: 19, fill: TH.ink }); g.setAttribute('transform', ''); return g; });
    return { hd, rows };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    const ts = [10, 24, 38, 38, 52, 62];
    s.rows.forEach((g, i) => { const a = pr(t, ts[i] + (i === 3 ? 4 : 0), 0.6); g.setAttribute('opacity', a); g.setAttribute('transform', `translate(${(1 - a) * 40} 0)`); });
  },
};
