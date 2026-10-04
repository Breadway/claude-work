import { S, G, T, layer, E, pr, clamp, lerp, mix, rgba, hn, TH, header, shortAct } from './common.js';
import { Matrix, Eq } from '../engine/edukit.js';
import { DEC } from './data.js';

const SC = TH.search;
const ACTS = ['Play Pulsar', 'Protostar → draw two', 'Rocky Planet → system 1'];
const PRIOR = [0.5, 0.3, 0.2], TRUE = [0.30, 0.62, 0.42], CP = 1.5;
// deterministic toy PUCT: leaf value = true value + small fixed wobble
const sims = (() => { const N = [0, 0, 0], W = [0, 0, 0], out = []; for (let k = 0; k < 14; k++) { const tot = N.reduce((a, b) => a + b, 0); const sc = PRIOR.map((p, i) => (N[i] ? W[i] / N[i] : 0) + CP * p * Math.sqrt(tot + 1) / (1 + N[i])); const i = sc.indexOf(Math.max(...sc)); const v = Math.min(1, Math.max(0, TRUE[i] + (hn(k, i, 3) - 0.5) * 0.2)); N[i]++; W[i] += v; out.push({ pick: i, v, N: [...N], Q: N.map((n, j) => (n ? W[j] / n : 0)), sc }); } return out; })();

// ===================================================================== 15a: why search
export const why = {
  id: 'c15_why', title: 'Thinking before moving', dur: 52, ch: 15, loc: 'search', mood: [SC, TH.act, TH.val],
  caps: [
    [0.5, 'The policy network answers instantly, from intuition. Search is deliberate thinking: try each candidate move and see how it turns out.'],
    [14.0, 'For each legal move, play it out in a copy of the game, and ask the value head how good the result looks. Then prefer the moves that turn out well.'],
    [28.0, 'The cost is time. You cannot try every move many times, so search has to spend its limited tries where they matter.'],
    [40.0, 'That is what PUCT does: it balances trusting the network’s hunches with checking moves that have looked good so far.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 15', title: 'Search: thinking before moving', sub: 'Try candidates in imagined copies of the game', accent: SC });
    const pos = G(L); S('rect', { x: 120, y: 420, width: 280, height: 150, rx: 18, fill: rgba(TH.state, 0.1), stroke: TH.state, 'stroke-width': 2.4 }, pos); T(pos, 'current position', { x: 260, y: 500, size: 26, w: 700, fill: TH.state, m: true });
    const cands = ACTS.map((a, i) => { const g = G(L); const y = 300 + i * 190; S('rect', { x: 640, y, width: 340, height: 90, rx: 14, fill: rgba(TH.act, 0.12), stroke: TH.act, 'stroke-width': 2 }, g); T(g, a, { x: 810, y: y + 52, size: 22, fill: TH.act }); S('path', { d: `M400 495 C 520 495, 520 ${y + 45}, 636 ${y + 45}`, stroke: '#46607e', 'stroke-width': 2.4, fill: 'none', 'marker-end': 'url(#arr)' }, g); const sim = G(g); S('rect', { x: 1130, y, width: 300, height: 90, rx: 14, fill: rgba(SC, 0.1), stroke: SC, 'stroke-width': 2, 'stroke-dasharray': '6 6' }, sim); T(sim, 'imagined future', { x: 1280, y: y + 40, size: 20, fill: SC, m: true }); T(sim, 'value head: ?', { x: 1280, y: y + 68, size: 18, fill: TH.dim, m: true }); const vv = T(g, '', { x: 1560, y: y + 52, size: 36, a: 'start', w: 700, fill: TH.val, m: true }); S('path', { d: `M984 ${y + 45} L1126 ${y + 45}`, stroke: '#46607e', 'stroke-width': 2.4, 'marker-end': 'url(#arr)' }, g); g.sim = sim; g.vv = vv; return g; });
    return { hd, pos, cands };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.pos.setAttribute('opacity', pr(t, 1.0, 0.6)); s.cands.forEach((g, i) => { g.setAttribute('opacity', pr(t, 3.0 + i * 0.6, 0.6)); g.sim.setAttribute('opacity', pr(t, 14.0 + i * 1.0, 0.6)); g.vv.textContent = t > 20 + i * 1.5 ? TRUE[i].toFixed(2) : ''; g.vv.setAttribute('opacity', pr(t, 20 + i * 1.5, 0.5)); });
  },
};

// ===================================================================== 15b: PUCT on a toy
export const puct = {
  id: 'c15_puct', title: 'PUCT, step by step', dur: 86, ch: 15, loc: 'search', mood: [SC, TH.pol, TH.val],
  caps: [
    [0.5, 'Here is the search spending fourteen tries on three candidates. Each has a prior from the policy network: fifty, thirty and twenty percent.'],
    [14.0, 'Every try picks the candidate with the best score: Q, its average result so far, plus an exploration bonus. The bonus is large for a high prior, and shrinks the more a move has been visited.'],
    [30.0, 'In symbols: Q plus c times the prior times the square root of total visits, over one plus this move’s visits. Astra uses c of one point five.'],
    [46.0, 'Watch. The first moves chase the prior. As results come back, Q takes over: the second candidate keeps scoring better than its prior suggested.'],
    [62.0, 'By the end it has the most visits. The visit counts, not the raw network, are the search’s answer.'],
    [74.0, 'The numbers are illustrative; the rule and the constant are Astra’s.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 15', title: 'PUCT: where to spend each try', sub: 'Toy: 3 candidates, 14 tries (illustrative values)', accent: SC });
    const eq = Eq(L, { x: 960, y: 270, a: 'middle', size: 38, runs: [['score', SC], [' = ', TH.dim], ['Q', TH.val], [' + c · ', TH.dim], ['P', TH.pol], [' · √N / (1 + n)', TH.dim]] });
    const rows = ACTS.map((a, i) => { const g = G(L); const y = 400 + i * 150; T(g, a, { x: 120, y: y + 6, size: 24, a: 'start', fill: TH.act }); T(g, `prior P = ${PRIOR[i].toFixed(2)}`, { x: 120, y: y + 44, size: 18, a: 'start', fill: TH.pol, m: true }); const bar = S('rect', { x: 560, y: y - 20, width: 0, height: 44, rx: 10, fill: rgba(SC, 0.75) }, g); const nl = T(g, '', { x: 570, y: y + 4, size: 24, a: 'start', w: 700, fill: TH.ink, m: true }); const q = T(g, '', { x: 1280, y: y + 4, size: 24, a: 'start', w: 700, fill: TH.val, m: true }); const sc = T(g, '', { x: 1560, y: y + 4, size: 24, a: 'start', w: 700, fill: SC, m: true }); g.bar = bar; g.nl = nl; g.q = q; g.sc = sc; return g; });
    const h1 = T(L, 'visits n', { x: 560, y: 350, size: 18, a: 'start', fill: SC, m: true }); const h2 = T(L, 'Q (avg result)', { x: 1280, y: 350, size: 18, a: 'start', fill: TH.val, m: true }); const h3 = T(L, 'next score', { x: 1560, y: 350, size: 18, a: 'start', fill: SC, m: true });
    const step = T(L, '', { x: 960, y: 860, size: 26, fill: TH.dim, m: true });
    return { hd, eq, rows, h1, h2, h3, step };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.rows.forEach((g) => g.setAttribute('opacity', pr(t, 1.0, 0.6))); s.eq.g.setAttribute('opacity', pr(t, 30.0, 0.5)); s.eq.show(pr(t, 30.4, 5));
    [s.h1, s.h2, s.h3].forEach((h) => h.setAttribute('opacity', pr(t, 14.0, 0.6)));
    const k = t < 46 ? 0 : Math.min(14, Math.floor((t - 46) / 1.1) + 1); const st = k ? sims[k - 1] : null;
    s.rows.forEach((g, i) => { const n = st ? st.N[i] : 0; g.bar.setAttribute('width', n * 38); g.nl.setAttribute('x', 575 + n * 38); g.nl.textContent = st ? String(n) : ''; g.q.textContent = st && st.N[i] ? st.Q[i].toFixed(2) : st ? '–' : ''; g.sc.textContent = st ? st.sc[i].toFixed(2) : ''; g.setAttribute('filter', st && st.pick === i && t < 62 ? 'url(#glow)' : ''); });
    s.step.textContent = k ? `try ${k} of 14 → candidate ${st.pick + 1}, result ${st.v.toFixed(2)}` : ''; s.step.setAttribute('opacity', pr(t, 46.0, 0.5));
  },
};

// ===================================================================== 15c: Astra's leaf evaluation
export const leaf = {
  id: 'c15_leaf', title: 'How Astra scores a try', dur: 66, ch: 15, loc: 'search', mood: [SC, TH.act, TH.val],
  caps: [
    [0.5, 'What is one try, exactly? In Astra, the game engine forces the candidate move, then lets AdvCPU bots play out the rest of the turn.'],
    [14.0, 'If the game ends inside that window, the result is exact: one for a win, zero for a loss. Otherwise the value head scores the resulting position.'],
    [28.0, 'It is not a deep tree of moves and replies. Astra’s tree is exactly one level deep: the root decision and its candidates, each scored by one playout.'],
    [44.0, 'The engine cannot pause in the middle of a future turn, so deeper nodes are not available. The budget is spent re-sampling candidates, four hundred tries per decision by default.'],
    [58.0, 'Search is used for choosing actions and for chain responses. The other three decision kinds use the raw policy.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 15', title: 'One try = one imagined turn', sub: 'Astra’s search is one level deep (not a multi-move tree)', accent: SC });
    const flow = [['position', TH.state, 190], ['force candidate', TH.act, 480], ['AdvCPU plays\nrest of turn', TH.dim, 790], ['game over?', TH.pol, 1080], ['1 or 0', TH.hist, 1380], ['value head', TH.val, 1380]];
    const bx = (g, lb, c, x, y) => { S('rect', { x: x - 110, y: y - 44, width: 220, height: 88, rx: 16, fill: rgba(c, 0.12), stroke: c, 'stroke-width': 2.2 }, g); lb.split('\n').forEach((l, k, a) => T(g, l, { x, y: y + 6 + (k - (a.length - 1) / 2) * 24, size: 21, w: 650, fill: c, m: true })); };
    const g1 = G(L); [['position', TH.state, 190, 400], ['force candidate', TH.act, 480, 400], ['AdvCPU plays\nrest of turn', TH.dim, 790, 400], ['game over\nin window?', TH.pol, 1090, 400]].forEach(([lb, c, x, y]) => bx(g1, lb, c, x, y)); [[300, 370], [590, 680], [900, 980]].forEach(([a, b]) => S('path', { d: `M${a} 400 L${b} 400`, stroke: '#46607e', 'stroke-width': 2.4, 'marker-end': 'url(#arr)' }, g1));
    const g2 = G(L); bx(g2, 'yes: exact\n1 win · 0 loss', TH.hist, 1560, 330); bx(g2, 'no: value head\nscores it', TH.val, 1560, 480); S('path', { d: 'M1200 380 L1450 335', stroke: '#46607e', 'stroke-width': 2.4, 'marker-end': 'url(#arr)' }, g2); S('path', { d: 'M1200 420 L1450 475', stroke: '#46607e', 'stroke-width': 2.4, 'marker-end': 'url(#arr)' }, g2);
    const tr = G(L); S('rect', { x: 700, y: 600, width: 520, height: 70, rx: 14, fill: rgba(TH.state, 0.1), stroke: TH.state, 'stroke-width': 2.2 }, tr); T(tr, 'root decision', { x: 960, y: 640, size: 24, w: 650, fill: TH.state, m: true }); [0, 1, 2, 3].forEach((i) => { const x = 590 + i * 260; S('path', { d: `M960 670 L${x} 730`, stroke: '#46607e', 'stroke-width': 2.2 }, tr); S('rect', { x: x - 90, y: 730, width: 180, height: 56, rx: 10, fill: rgba(TH.act, 0.1), stroke: TH.act, 'stroke-width': 1.8 }, tr); T(tr, 'candidate ' + (i + 1), { x, y: 762, size: 18, fill: TH.act, m: true }); }); T(tr, 'depth 1, and that is all', { x: 1300, y: 640, size: 22, a: 'start', fill: SC, m: true });
    const note = T(L, 'sims = 400 · c_puct = 1.5 · searched kinds: choose-action and chain response', { x: 960, y: 560, size: 21, fill: TH.dim, m: true });
    return { hd, g1, g2, tr, note };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.g1.setAttribute('opacity', pr(t, 1.0, 0.7)); s.g2.setAttribute('opacity', pr(t, 14.0, 0.7)); s.tr.setAttribute('opacity', pr(t, 28.0, 0.7)); s.note.setAttribute('opacity', pr(t, 44.0, 0.7));
  },
};

// ===================================================================== 15d: visit counts -> target
export const visits = {
  id: 'c15_visits', title: 'From visits to a decision', dur: 52, ch: 15, loc: 'search', mood: [SC, TH.pol, TH.loss],
  caps: [
    [0.5, 'After all the tries, search has a visit count for each candidate. Divide by the total and you have a new distribution over the moves.'],
    [14.0, 'This is usually better than the raw network’s, because it has been checked against imagined futures. It becomes the move to play, and, later, a training target.'],
    [30.0, 'During self-play the move is sampled from it for the first fifteen decisions of a game, to explore, then chosen greedily.'],
    [42.0, 'At evaluation time, Astra plays without search, for speed. Search makes the training data, and the network carries it.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 15', title: 'Visit counts become a better policy', sub: 'Illustrative numbers', accent: SC });
    const cols = [['network prior', PRIOR, TH.pol, 330], ['visit distribution', sims[13].N.map((n) => n / 14), SC, 1000]].map(([ttl, v, c, x]) => { const g = G(L); T(g, ttl, { x: x + 250, y: 300, size: 26, w: 700, fill: c, m: true }); v.forEach((p, i) => { const y = 380 + i * 110; T(g, ACTS[i], { x, y: y + 4, size: 18, a: 'start', fill: TH.act, m: true }); S('rect', { x, y: y + 20, width: 500 * p, height: 36, rx: 8, fill: rgba(c, 0.75) }, g); T(g, (p * 100).toFixed(0) + '%', { x: x + 500 * p + 10, y: y + 40, size: 22, a: 'start', fill: TH.ink, m: true }); }); return g; });
    const arrow = T(L, '→ search →', { x: 880, y: 540, size: 28, fill: SC, m: true });
    const use = T(L, 'sampled for the first 15 decisions, then greedy · becomes the training target', { x: 960, y: 800, size: 24, fill: TH.dim, m: true });
    return { hd, cols, arrow, use };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.cols[0].setAttribute('opacity', pr(t, 1.0, 0.6)); s.arrow.setAttribute('opacity', pr(t, 8.0, 0.6)); s.cols[1].setAttribute('opacity', pr(t, 10.0, 0.7)); s.use.setAttribute('opacity', pr(t, 30.0, 0.7));
  },
};
