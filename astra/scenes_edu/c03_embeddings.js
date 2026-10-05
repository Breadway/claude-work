import { S, G, T, P, layer, C, E, pr, clamp, lerp, mix, rgba, hn, drawOn, sbump, TH, cardFace, cardName, header, pill, CARD, CAT_COL } from './common.js';
import { DEC } from './data.js';
import { Matrix, Eq, VecStrip } from '../engine/edukit.js';

const FIELD_NAMES = ['type', 'field 0', 'field 1', 'field 2', 'field 3', 'field 4', 'field 5', 'field 6'];
const PUL = DEC.tokens.state[1 + DEC.hand.indexOf('Fracture(Pulsar)')];   // [2,24,0,0,0,0,0,0]
const r1 = (seed, i, j) => Math.round((hn(seed, i, j) * 2 - 1) * 9) / 10;   // one-decimal "weights" in [-0.9, 0.9]

// ===================================================================== 3a: an integer selects a row
export const lookup = {
  id: 'c3_lookup', title: 'Lookup', dur: 70, ch: 3, loc: 'embed', mood: [TH.state, TH.search, TH.val],
  caps: [
    [0.5, 'The token for your Pulsar is eight integers: a type, and seven fields. Each integer is about to choose a row.'],
    [9.0, 'Astra owns eight tables of learned numbers: one for the type, with eight rows, and one for each field position, with sixty-four rows. Every row is a list of two hundred fifty-six numbers.'],
    [24.0, 'Type two selects row two of the type table. Field zero, twenty-four, selects row twenty-four of the first field table. That row is, for now, the description of “Pulsar”.'],
    [40.0, 'Field one is zero, so it selects row zero of its own table. And so on: every integer, one row.'],
    [54.0, 'Eight integers in, eight vectors out. Nothing was calculated yet. It is pure lookup.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 3', title: 'An integer selects a row', sub: 'Embedding tables: lookup, not calculation', accent: TH.state });
    const rows = PUL.map((v, k) => {
      const g = G(L); const y = 290 + k * 70; const rowsN = k === 0 ? 8 : 64;
      const cell = G(g); S('rect', { x: -48, y: -24, width: 96, height: 48, rx: 10, fill: k === 0 ? rgba(TH.state, 0.2) : '#0b1320', stroke: TH.state, 'stroke-width': 2 }, cell); T(cell, String(v), { y: -5, size: 24, w: 720, m: true }); T(cell, FIELD_NAMES[k], { y: 14, size: 11, fill: TH.dim, m: true }); cell.setAttribute('transform', `translate(190 ${y})`);
      const arr = S('path', { d: `M250 ${y} L420 ${y}`, stroke: TH.state, 'stroke-width': 2.2, fill: 'none', 'marker-end': 'url(#arr)', 'stroke-dasharray': '6 6' }, g);
      const tb = G(g); S('rect', { x: 0, y: -26, width: 300, height: 52, rx: 10, fill: '#0b1320', stroke: '#33506a', 'stroke-width': 1.6 }, tb); const nl = 16; for (let q = 0; q < nl; q++) S('rect', { x: 8, y: -22 + q * (44 / nl), width: 284, height: 44 / nl - 1, rx: 1.5, fill: '#16233a' }, tb);
      const hl = S('rect', { x: 8, y: -22 + (v / rowsN) * 44 - 1, width: 284, height: 3.2, rx: 1.5, fill: TH.state, filter: 'url(#glow)' }, tb);
      T(tb, `${k === 0 ? 'type table · 8' : 'field ' + (k - 1) + ' table · 64'} × 256`, { x: 150, y: 0, size: 12.5, fill: '#4b6280', m: true }); const rl = T(tb, 'row ' + v, { x: 312, y: 0, size: 18, a: 'start', fill: TH.state, m: true }); tb.setAttribute('transform', `translate(440 ${y})`);
      const out = G(g); const vs = VecStrip(out, { n: 36, cw: 11, ch: 24, color: TH.state, seed: 31 + k * 7 + v }); out.setAttribute('transform', `translate(860 ${y - 12})`); const dim = T(out, '256 numbers', { x: vs.W + 14, y: 12, size: 14, a: 'start', fill: TH.faint, m: true });
      g.cell = cell; g.arr = arr; g.tb = tb; g.out = out; g.k = k; return g;
    });
    const note = T(L, 'every row starts as random numbers', { x: 1500, y: 840, size: 20, fill: TH.dim });
    return { hd, rows, note };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.rows.forEach((g) => {
      const k = g.k; const a = pr(t, 0.6 + k * 0.25, 0.5); const tbIn = pr(t, 9.0 + k * 0.7, 0.6); const sel = pr(t, [24.0, 24.0, 40.0, 44.0, 46.0, 48.0, 50.0, 52.0][k] + 0.0, 0.7);
      g.cell.setAttribute('opacity', a); g.arr.setAttribute('opacity', a * pr(t, 24.0 + (k > 1 ? 14 : 0) + k * 0.3, 0.5)); g.tb.setAttribute('opacity', tbIn);
      g.tb.lastChild.setAttribute('opacity', sel); g.tb.childNodes[g.tb.childNodes.length - 3]?.setAttribute('opacity', sel);
      const outA = pr(t, [26.0, 27.0, 40.5, 44.5, 46.5, 48.5, 50.5, 52.5][k], 0.6); g.out.setAttribute('opacity', outA); g.out.setAttribute('transform', `translate(${860 + (1 - outA) * -60} ${290 + k * 70 - 12})`);
    });
    s.note.setAttribute('opacity', pr(t, 54.0, 0.6));
  },
};

// ===================================================================== 3b: eight vectors, one sum
export const sum = {
  id: 'c3_sum', title: 'Eight vectors, one sum', dur: 66, ch: 3, loc: 'embed', mood: [TH.state, TH.val, TH.search],
  caps: [
    [0.5, 'Now we have eight vectors, each two hundred fifty-six numbers long. Here are the first six numbers of each.'],
    [9.0, 'The token’s representation is simply their sum, element by element: the first numbers added together, then the second, and so on.'],
    [22.0, 'In symbols: x equals the type vector, plus the sum, over the seven field positions k, of the vector that field k’s table returns for that field’s value.'],
    [37.0, 'The result is one vector of two hundred fifty-six numbers. Everything the network will ever know about this card has to fit in it.'],
    [50.0, 'The same eight tables are used for every token in the sequence. Only the integers change.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 3', title: 'Eight vectors, summed into one', sub: 'The first six of 256 numbers (illustrative values)', accent: TH.state });
    const vals = Array.from({ length: 8 }, (_, r) => Array.from({ length: 6 }, (_, c) => r1(5, r, c)));
    const sumRow = vals[0].map((_, c) => Math.round(vals.reduce((a, row) => a + row[c], 0) * 10) / 10);
    const M = Matrix(L, { rows: 8, cols: 6, cw: 96, ch: 44, gap: 5, vals, color: TH.state, size: 19, fmtv: (v) => v.toFixed(1), rowLabels: FIELD_NAMES.map((n, i) => `${n} = ${PUL[i]}`), label: 'EIGHT LOOKED-UP VECTORS (first 6 dims)', labelDy: -16 }); M.g.setAttribute('transform', 'translate(330 330)');
    const SM = Matrix(L, { rows: 1, cols: 6, cw: 96, ch: 48, gap: 5, vals: [sumRow], color: TH.val, size: 21, fmtv: (v) => v.toFixed(1), rowLabels: ['x = sum'], label: '' }); SM.g.setAttribute('transform', `translate(330 ${330 + 8 * 49 + 24})`);
    const rule = S('path', { d: `M330 ${330 + 8 * 49 + 8} L${330 + 6 * 101} ${330 + 8 * 49 + 8}`, stroke: TH.val, 'stroke-width': 3 }, L); T(L, '+', { x: 300, y: 330 + 8 * 49 + 4, size: 34, w: 600, fill: TH.val });
    const more = T(L, '… 250 more columns', { x: 330 + 6 * 101 + 14, y: 560, size: 20, a: 'start', fill: TH.dim, m: true });
    const eq = Eq(L, { x: 1180, y: 235, size: 40, a: 'middle', runs: [['x', TH.val, 'x'], [' = ', TH.ink], ['E_type[t]', TH.state, 'ty'], [' + ', TH.ink], ['Σ', TH.dim, 'sg'], ['k', TH.dim, 'sg'], [' E_k[f_k]', TH.state, 'fk']] });
    const legend = T(L, 't = type id · k = field position 0…6 · f_k = the integer in field k · E = lookup table', { x: 1180, y: 285, size: 17, fill: TH.dim, m: true });
    return { hd, M, SM, rule, more, eq, legend, vals, sumRow };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.M.set(s.vals, (i, j) => pr(t, 0.8 + i * 0.5, 0.5)); s.M.g.setAttribute('opacity', 1);
    const sp = pr(t, 9.0, 0.6); s.rule.setAttribute('opacity', sp); s.SM.g.setAttribute('opacity', sp);
    const col = Math.min(5, Math.floor((t - 10.0) / 1.9)); s.SM.set([s.sumRow], (i, j) => (t > 10.0 && j <= col ? 1 : 0.0));
    s.M.hl((i, j) => (t > 10.0 && t < 22.0 && j === col ? 1 : 0), TH.val); s.more.setAttribute('opacity', pr(t, 20.0, 0.6));
    s.eq.g.setAttribute('opacity', pr(t, 22.0, 0.5)); s.eq.show(pr(t, 22.4, 7.0)); s.legend.setAttribute('opacity', pr(t, 28.0, 0.6));
    const ty = t > 24 && t < 28 ? 1 : 0, fk = t > 28 && t < 34 ? 1 : 0; s.eq.hl('ty', ty * (0.5 + 0.5 * Math.sin(t * 6)), TH.state); s.eq.hl('fk', fk * (0.5 + 0.5 * Math.sin(t * 6)), TH.state); s.eq.hl('x', t > 37 ? 1 : 0, TH.val);
    if (t > 37) s.SM.hl(() => 0.5 + 0.5 * Math.sin(t * 4), TH.val);
  },
};

// ===================================================================== 3c: what an embedding is
const CENTER = { star: [330, 430], disc: [720, 380], flare: [500, 640], omen: [900, 650], frac: [1030, 470] };
export const meaning = {
  id: 'c3_meaning', title: 'What an embedding is', dur: 72, ch: 3, loc: 'embed', mood: [TH.state, TH.loss, TH.search],
  caps: [
    [0.5, 'So what is an embedding? A list of learned numbers that describes a categorical value, in whatever way turns out to be useful.'],
    [11.0, 'Crucially, at the start those numbers mean nothing. They are random. Pulsar and Rocky Planet are just two unrelated points.'],
    [22.0, 'Training changes them. Each time Astra makes an error, the numbers in every row that was used are nudged to make that error a little smaller.'],
    [34.0, 'Over millions of examples, cards that matter in similar ways drift together. Nobody tells the model what the groups are.'],
    [46.0, 'This picture is illustrative, squashed from two hundred fifty-six dimensions down to two. The real tables are just numbers.'],
    [58.0, 'Embeddings are the only place where Astra learns something about each card by itself, before any other layer sees it.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 3', title: 'What an embedding actually is', sub: 'Random at first, shaped entirely by training (illustrative 2-D projection)', accent: TH.state });
    const names = Object.keys(CARD); const pts = names.map((k, i) => { const [lb, cat] = CARD[k]; const R = hn(i, 99), A = hn(i, 98) * 6.283; const ix = 740 + (hn(i, 1) - 0.5) * 880, iy = 540 + (hn(i, 2) - 0.5) * 520; const c = CENTER[cat]; const fx = c[0] + Math.cos(A) * (30 + R * 70), fy = c[1] + Math.sin(A) * (24 + R * 56); return { k, lb, cat, ix, iy, fx, fy }; });
    const sg = G(L); const dots = pts.map((p) => { const g = G(sg); S('circle', { r: 11, fill: CAT_COL[p.cat], opacity: 0.9, filter: 'url(#glow)' }, g); const l = T(g, p.lb, { y: -20, size: 14, fill: TH.ink, m: true }); g.l = l; return g; });
    const row = G(L); T(row, 'row 24 · Pulsar · first 6 of 256 numbers', { x: 1200, y: 330, size: 16, a: 'start', fill: TH.state, m: true }); const rv = [0, 1, 2, 3, 4, 5].map((c) => T(row, '', { x: 1200 + c * 100, y: 380, size: 26, w: 700, a: 'start', fill: TH.ink, m: true }));
    const step = T(L, '', { x: 1200, y: 460, size: 20, a: 'start', fill: TH.dim, m: true });
    const leg = Object.entries({ star: 'stars', disc: 'discoveries', flare: 'flares', omen: 'omens', frac: 'fractures' }).map(([c, n], i) => { const g = G(L); S('circle', { cx: 0, r: 8, fill: CAT_COL[c] }, g); T(g, n, { x: 16, size: 17, a: 'start', fill: TH.dim }); g.setAttribute('transform', `translate(${1200} ${560 + i * 36})`); return g; });
    return { hd, pts, dots, row, rv, step, leg };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    const tau = E.inOutC(clamp((t - 22.0) / 24.0));
    s.dots.forEach((g, i) => { const p = s.pts[i]; const a = pr(t, 0.8 + i * 0.05, 0.4, E.outBack); const j = 1 - tau; const x = lerp(p.ix, p.fx, tau) + Math.sin(t * 2 + i) * 3 * (1 - tau * 0.7), y = lerp(p.iy, p.fy, tau) + Math.cos(t * 1.7 + i) * 3 * (1 - tau * 0.7); P(g, { x, y, s: a, o: a }); g.l.setAttribute('opacity', [0, 9, 16, 20, 24].includes(i) ? 1 : 0); });
    s.row.setAttribute('opacity', pr(t, 11.0, 0.6));
    const snaps = [0, 1, 2, 3, 4].map((k) => k); const stage = Math.min(4, Math.floor(tau * 5)); const stages = [0, 2000, 20000, 200000, 1200000];
    s.rv.forEach((e, c) => { const a = (hn(3, c, stage) * 2 - 1) * (stage === 0 ? 0.9 : 0.9 - stage * 0.1); e.textContent = (Math.round(a * 100) / 100).toFixed(2); e.setAttribute('fill', stage === 0 ? TH.faint : TH.ink); });
    s.step.textContent = t > 11 ? (stage === 0 ? 'training step 0: random' : `training step ≈ ${stages[stage].toLocaleString()}`) : ''; s.step.setAttribute('opacity', pr(t, 11.0, 0.6));
    s.leg.forEach((g, i) => g.setAttribute('opacity', pr(t, 34.0 + i * 0.3, 0.5)));
  },
};

// ===================================================================== 3d: how big
export const size = {
  id: 'c3_size', title: 'Embedding size', dur: 40, ch: 3, loc: 'embed', mood: [TH.state, TH.val, TH.search],
  caps: [
    [0.5, 'How much does Astra know before any attention happens? One table of eight rows, and seven tables of sixty-four, all two hundred fifty-six wide.'],
    [12.0, 'That is two thousand forty-eight numbers, plus a hundred fourteen thousand six hundred eighty-eight: one hundred sixteen thousand seven hundred thirty-six parameters.'],
    [24.0, 'There is no bias term and no hand-built feature. A number in a field is only ever a row index.'],
    [32.0, 'The six-layer encoder that follows has about forty times more.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 3', title: 'How big are the tables?', sub: 'Learned parameters before attention', accent: TH.state });
    const tabs = [['type', 8], ...Array.from({ length: 7 }, (_, k) => ['field ' + k, 64])].map(([n, r], i) => { const g = G(L); const h = r === 8 ? 40 : 200; const x = 170 + i * 150; S('rect', { x, y: 620 - h, width: 120, height: h, rx: 10, fill: rgba(TH.state, 0.15), stroke: TH.state, 'stroke-width': 2 }, g); T(g, `${r} × 256`, { x: x + 60, y: 620 - h / 2, size: 18, w: 650, m: true }); T(g, n, { x: x + 60, y: 650, size: 18, fill: TH.dim, m: true }); T(g, (r * 256).toLocaleString(), { x: x + 60, y: 680, size: 16, w: 700, fill: TH.state, m: true }); return g; });
    const tot = T(L, '', { x: 960, y: 800, size: 54, w: 760, fill: TH.state, m: true, ls: -2 });
    const cmp = T(L, '', { x: 960, y: 860, size: 24, fill: TH.dim });
    return { hd, tabs, tot, cmp };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.tabs.forEach((g, i) => g.setAttribute('opacity', pr(t, 0.8 + i * 0.5, 0.5)));
    const c = E.outQ4(clamp((t - 12.0) / 3.0)); s.tot.textContent = t > 12 ? Math.round(116736 * c).toLocaleString() + ' parameters' : ''; s.tot.setAttribute('opacity', pr(t, 12.0, 0.5));
    s.cmp.textContent = t > 32 ? 'encoder: 4,738,560 parameters  ≈ 41 × the embeddings' : ''; s.cmp.setAttribute('opacity', pr(t, 32.0, 0.6));
  },
};
