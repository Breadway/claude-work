import { S, G, T, layer, E, pr, clamp, lerp, mix, rgba, hn, TH, header, cardFace } from './common.js';
import { Matrix, Eq, Flow } from '../engine/edukit.js';

// local Q/K/V identities (muted so they never read as one of the film's concept colours)
export const QC = '#f7b267', KC = '#78d4ea', VC = '#c9b8ff';
const f1 = (v) => (Math.abs(v) < 0.005 ? '0' : Number.isInteger(v) ? String(v) : v.toFixed(1));
const f2 = (v) => (Math.abs(v) < 0.0005 ? '0' : v.toFixed(2));
const f3 = (v) => v.toFixed(3);

// ---- toy attention (3 real tokens + 1 pad), d_k = 2 ----------------------------------------------------
const NAMES = ['Pulsar', 'Rocky Planet', 'My system', 'Pad'];
const X = [[1, 0], [0, 1], [1, 1]];
const WQ = [[2, 0], [0, 2]], WK = [[2, 0], [0, 2]], WV = [[1, 0], [0, 1]];
const mm = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((a, v, k) => a + v * B[k][j], 0)));
const Q = [...mm(X, WQ), [0, 0]], K = [...mm(X, WK), [1, 1]], V = [...mm(X, WV), [0, 0]];
const RAW = Q.map((q) => K.map((k) => q[0] * k[0] + q[1] * k[1]));
const SCALED = RAW.map((r) => r.map((v) => v / Math.SQRT2));
const MASKED = SCALED.map((r) => r.map((v, j) => (j === 3 ? -1e4 : v)));
const soft = (r) => { const m = Math.max(...r); const e = r.map((v) => Math.exp(v - m)); const s = e.reduce((a, b) => a + b, 0); return e.map((v) => v / s); };
const W = MASKED.slice(0, 3).map(soft); // 3×4 (pad col ≈ 0)
const OUT = W.map((w) => [0, 1].map((c) => w.reduce((a, p, j) => a + p * V[j][c], 0)));

// ===================================================================== 5a: why attention
export const why = {
  id: 'c5_why', title: 'Why attention', dur: 50, ch: 5, loc: 'attention', mood: [TH.state, TH.search, TH.pol],
  caps: [
    [0.5, 'After embedding, every token knows what it is, and nothing else. A Rocky Planet in your hand does not know it could finish your system.'],
    [12.0, 'To understand a position, tokens must read each other: this planet needs to look at your open slots, your opponents’ threats, and the actions on offer.'],
    [26.0, 'Attention is that reading step. Each token asks a question, every token advertises what it offers, and the best matches are copied in.'],
    [40.0, 'The strength of each link is not fixed. It is computed, fresh, from the numbers in this position.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 5', title: 'Why tokens must talk', sub: 'Embeddings describe a card, not the position it sits in', accent: TH.search });
    const toks = [['Rocky Planet', 'hand', TH.state, 250, 480], ['System 1: Yellow Dwarf · 2 of 3', 'mine', TH.state, 700, 380], ['Opponent: complete system', 'opp', TH.state, 1170, 400], ['Play Rocky Planet → system 1', 'action', TH.act, 640, 740], ['Pass', 'action', TH.act, 1160, 740]].map(([lb, , col, x, y]) => {
      const g = G(L); const w = Math.max(190, lb.length * 12); S('rect', { x: -w / 2, y: -34, width: w, height: 68, rx: 14, fill: rgba(col, 0.13), stroke: col, 'stroke-width': 2 }, g); T(g, lb, { y: 8, size: 20, w: 560 }); g.setAttribute('transform', `translate(${x} ${y})`); g.pos = [x, y]; return g;
    });
    const pairs = [[1, 0.9], [2, 0.35], [3, 0.95], [4, 0.1]].map(([j, w]) => { const a = toks[0].pos, b = toks[j].pos; return { path: S('path', { d: `M${a[0]} ${a[1] + (b[1] > a[1] ? 34 : -34)} L${b[0]} ${b[1] + (b[1] > a[1] ? -34 : 34)}`, stroke: TH.search, 'stroke-width': 2 + 7 * w, 'stroke-linecap': 'round', fill: 'none', opacity: 0.0 }, L), w }; });
    const q = T(L, 'how relevant is each of you to me?', { x: 330, y: 395, size: 20, fill: TH.search, m: true });
    return { hd, toks, pairs, q };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.toks.forEach((g, i) => g.setAttribute('opacity', pr(t, 0.8 + i * 0.5, 0.6)));
    s.pairs.forEach((p, i) => { const a = pr(t, 12.0 + i * 1.5, 0.8); p.path.setAttribute('opacity', 0.15 * a + 0.5 * a * pr(t, 26.0 + i * 0.8, 0.8) * (0.8 + 0.2 * Math.sin(t * 3 + i))); });
    s.q.setAttribute('opacity', pr(t, 26.0, 0.7));
  },
};

// ===================================================================== 5b: Q, K, V
export const qkv = {
  id: 'c5_qkv', title: 'Query, key, value', dur: 70, ch: 5, loc: 'attention', mood: [TH.state, QC, VC],
  caps: [
    [0.5, 'Each token vector is turned into three different vectors by three separate linear layers: a query, a key, and a value.'],
    [12.0, 'The query says what this token is looking for. The key says what this token has to offer. The value is the content it will hand over if it is chosen.'],
    [28.0, 'Here is a toy with three tokens and two numbers each. Real Astra uses two hundred fifty-six, but the arithmetic is identical.'],
    [44.0, 'The three weight matrices are different, and all of them are learned. Training decides what to ask for and what to advertise.'],
    [58.0, 'Pad slots get a key too, but we will switch them off in a moment.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 5', title: 'Query, key and value', sub: 'Three views of the same token (toy: 2 numbers instead of 256)', accent: QC });
    const Xm = Matrix(L, { rows: 3, cols: 2, cw: 66, ch: 46, gap: 6, vals: X, color: TH.state, size: 22, fmtv: f1, rowLabels: ['Pulsar', 'Rocky', 'My sys'], label: 'X (tokens)', labelDy: -14 }); Xm.g.setAttribute('transform', 'translate(210 420)'); Xm.set();
    const rows = [['Q', 'query', WQ, QC, 'what am I looking for?', 255, Q], ['K', 'key', WK, KC, 'what do I offer?', 435, K], ['V', 'value', WV, VC, 'what do I hand over?', 615, V]].map(([n, nm, Wm, c, q, y, R]) => {
      const g = G(L); const w = Matrix(g, { rows: 2, cols: 2, cw: 60, ch: 40, gap: 6, vals: Wm, color: c, size: 22, fmtv: f1, label: 'W_' + n + ' (learned)', labelDy: -12 }); w.g.setAttribute('transform', 'translate(560 0)'); w.set();
      const r = Matrix(g, { rows: 3, cols: 2, cw: 66, ch: 40, gap: 6, vals: R.slice(0, 3), color: c, size: 22, fmtv: f1, label: n + ' · ' + nm, labelDy: -12 }); r.g.setAttribute('transform', 'translate(840 0)'); r.set();
      T(g, '×', { x: 530, y: 48, size: 34, fill: TH.dim, w: 600 }); T(g, '=', { x: 750 + 40, y: 66, size: 34, fill: TH.dim, w: 600 }); T(g, q, { x: 1100, y: 70, size: 24, a: 'start', fill: c, w: 500 });
      g.setAttribute('transform', `translate(0 ${y})`); g.w = w; g.r = r; return g;
    });
    return { hd, Xm, rows };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.Xm.g.setAttribute('opacity', pr(t, 0.8, 0.6));
    s.rows.forEach((g, i) => g.setAttribute('opacity', pr(t, 2.0 + i * 5.5, 0.7)));
  },
};

// ===================================================================== 5c: scores
export const scores = {
  id: 'c5_scores', title: 'Scores', dur: 84, ch: 5, loc: 'attention', mood: [TH.state, TH.search, TH.pol],
  caps: [
    [0.5, 'To find out who matters to whom, take each token’s query and dot it with every token’s key. That is Q times K transposed.'],
    [14.0, 'Row one, column three: query two, zero, with key two, two, gives four. Every cell is one such dot product.'],
    [28.0, 'Big number, strong match. But there is a problem. With two hundred fifty-six numbers per vector, dot products grow large, and large scores make the next step too sharp.'],
    [44.0, 'So divide every score by the square root of d_k, the length of one head’s vectors. For Astra that is root thirty-two, about five point seven.'],
    [60.0, 'Finally, the mask. The fourth token is padding. Its column is overwritten with minus ten thousand so no real token can copy from it.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 5', title: 'Scores: Q Kᵀ ÷ √d_k', sub: 'Who should look at whom?', accent: TH.search });
    const Qm = Matrix(L, { rows: 4, cols: 2, cw: 60, ch: 44, gap: 6, vals: Q, color: QC, size: 21, fmtv: f1, rowLabels: NAMES, label: 'Q', labelDy: -12 }); Qm.g.setAttribute('transform', 'translate(300 380)'); Qm.set();
    const Km = Matrix(L, { rows: 2, cols: 4, cw: 60, ch: 44, gap: 6, vals: [0, 1].map((c) => K.map((k) => k[c])), color: KC, size: 21, fmtv: f1, colLabels: NAMES.map((n) => n.split(' ')[0]), label: 'Kᵀ', labelDy: -42 }); Km.g.setAttribute('transform', 'translate(560 380)'); Km.set();
    const Sm = Matrix(L, { rows: 4, cols: 4, cw: 110, ch: 52, gap: 6, vals: RAW, color: TH.search, size: 24, fmtv: (v) => (Math.abs(v) >= 1000 ? '−10000' : Number.isInteger(v) ? String(v) : v.toFixed(2)), colLabels: NAMES.map((n) => n.split(' ')[0]), rowLabels: NAMES.map((n) => n.split(' ')[0]), label: 'scores = Q Kᵀ', labelDy: -42 }); Sm.g.setAttribute('transform', 'translate(1040 380)');
    const times = T(L, '×', { x: 515, y: 430, size: 36, fill: TH.dim, w: 600 }); const eqs = T(L, '=', { x: 905, y: 440, size: 36, fill: TH.dim, w: 600 });
    const eq = Eq(L, { x: 960, y: 790, a: 'middle', size: 40, runs: [['score_ij', TH.search], [' = ', TH.dim], ['q_i · k_j', TH.pol], [' / ', TH.dim], ['√d_k', TH.grad]] });
    const note = T(L, 'Astra: d_k = 256 / 8 heads = 32  →  √32 ≈ 5.66', { x: 960, y: 845, size: 21, fill: TH.dim, m: true });
    return { hd, Qm, Km, Sm, times, eqs, eq, note };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.Qm.g.setAttribute('opacity', pr(t, 1.0, 0.6)); s.Km.g.setAttribute('opacity', pr(t, 3.0, 0.6)); s.times.setAttribute('opacity', pr(t, 3.0, 0.5)); s.eqs.setAttribute('opacity', pr(t, 6.0, 0.5));
    const stage = t < 44 ? 0 : t < 60 ? 1 : 2;
    const vals = stage === 0 ? RAW : stage === 1 ? SCALED : MASKED;
    const appear = (i, j) => pr(t, 6.0 + (i * 4 + j) * 0.55, 0.5);
    const mix1 = (i, j) => (stage === 0 ? appear(i, j) : 1);
    s.Sm.set(vals, mix1, { mx: stage === 2 ? 6 : 8 });
    // highlight the demo cell (row 1, col 3) during 14..28
    s.Sm.hl((i, j) => (t > 14 && t < 28 && i === 0 && j === 2 ? 1 : (stage === 2 && j === 3 ? 0.6 : 0)), stage === 2 ? TH.mask : TH.ink);
    s.Qm.hl((i, j) => (t > 14 && t < 28 && i === 0 ? 0.9 : 0), TH.ink); s.Km.hl((i, j) => (t > 14 && t < 28 && j === 2 ? 0.9 : 0), TH.ink);
    s.Sm.cells.forEach((r, i) => r.forEach((c, j) => { if (stage === 2 && j === 3) { c.r.setAttribute('fill', '#1a2433'); c.t.setAttribute('fill', TH.mask); } else c.t.setAttribute('fill', TH.ink); }));
    s.eq.g.setAttribute('opacity', pr(t, 28.0, 0.5)); s.eq.show(pr(t, 28.4, 4)); s.eq.hl('√d_k', stage === 1 ? 0.5 + 0.5 * Math.sin(t * 5) : 0, TH.grad);
    s.note.setAttribute('opacity', pr(t, 44.0, 0.6));
  },
};

// ===================================================================== 5d: softmax + mixing
export const mixing = {
  id: 'c5_mix', title: 'Softmax and mixing', dur: 80, ch: 5, loc: 'attention', mood: [TH.state, TH.search, VC],
  caps: [
    [0.5, 'Scores are not yet weights. Softmax turns each row into positive numbers that add up to one: it exponentiates, then divides by the total.'],
    [14.0, 'Row three: two point eight, two point eight and five point seven become five percent, five percent and eighty-nine percent. The pad column is zero.'],
    [30.0, 'Those are attention weights: how much of each token to copy into this one.'],
    [40.0, 'Now multiply the weights by the values. Row three takes about five percent of the first value, five of the second, and eighty-nine of itself.'],
    [56.0, 'The result is a new vector for each token: a blend of what it chose to read. That is one attention head, in full.'],
    [68.0, 'In symbols: softmax of Q K transpose over root d_k, times V.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 5', title: 'Softmax, then mix the values', sub: 'Scores become weights; weights blend V', accent: TH.search });
    const Sm = Matrix(L, { rows: 3, cols: 4, cw: 82, ch: 50, gap: 6, vals: MASKED.slice(0, 3), color: TH.search, size: 20, fmtv: (v) => (v < -1000 ? '−10⁴' : v.toFixed(2)), colLabels: NAMES.map((n) => n.split(' ')[0]), rowLabels: ['Pulsar', 'Rocky', 'My sys'], label: 'scores (masked)', labelDy: -42 }); Sm.g.setAttribute('transform', 'translate(220 400)'); Sm.set(); Sm.g.setAttribute('opacity', 1);
    const Wm = Matrix(L, { rows: 3, cols: 4, cw: 82, ch: 50, gap: 6, vals: W, color: TH.search, size: 20, fmtv: (v) => (v < 0.0005 ? '0' : v.toFixed(2)), colLabels: NAMES.map((n) => n.split(' ')[0]), label: 'weights = softmax(row)', labelDy: -42 }); Wm.g.setAttribute('transform', 'translate(220 400)');
    const sums = [0, 1, 2].map((i) => T(L, 'Σ = 1', { x: 220 + 4 * 88 + 18, y: 400 + i * 56 + 25, size: 20, a: 'start', fill: TH.dim, m: true }));
    const Vm = Matrix(L, { rows: 4, cols: 2, cw: 66, ch: 50, gap: 6, vals: V, color: VC, size: 22, fmtv: f1, rowLabels: NAMES.map((n) => n.split(' ')[0]), label: 'V', labelDy: -14 }); Vm.g.setAttribute('transform', 'translate(840 360)'); Vm.set();
    const Om = Matrix(L, { rows: 3, cols: 2, cw: 100, ch: 50, gap: 6, vals: OUT, color: TH.state, size: 22, fmtv: f2, rowLabels: ['Pulsar', 'Rocky', 'My sys'], label: 'output = weights × V', labelDy: -14 }); Om.g.setAttribute('transform', 'translate(1160 380)');
    const t1 = T(L, '×', { x: 800, y: 480, size: 36, w: 600, fill: TH.dim }); const t2 = T(L, '=', { x: 1120, y: 480, size: 36, w: 600, fill: TH.dim });
    const eq = Eq(L, { x: 960, y: 850, a: 'middle', size: 40, runs: [['Attention(Q,K,V)', TH.ink], [' = ', TH.dim], ['softmax', TH.search], ['(', TH.dim], ['Q Kᵀ', TH.pol], [' / ', TH.dim], ['√d_k', TH.grad], [')', TH.dim], [' V', VC]] });
    return { hd, Sm, Wm, sums, Vm, Om, t1, t2, eq };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    const p = pr(t, 3.0, 1.2); s.Sm.g.setAttribute('opacity', 1 - p); s.Wm.g.setAttribute('opacity', p); s.Wm.set(W, (i, j) => p * (i * 4 + j >= 0 ? 1 : 1)); s.Wm.hl((i, j) => (i === 2 && t > 14 && t < 30 ? 0.8 : 0), TH.ink);
    s.sums.forEach((e, i) => e.setAttribute('opacity', pr(t, 20.0 + i * 0.4, 0.5)));
    s.Vm.g.setAttribute('opacity', pr(t, 38.0, 0.6)); s.t1.setAttribute('opacity', pr(t, 38.0, 0.5)); s.t2.setAttribute('opacity', pr(t, 42.0, 0.5));
    s.Om.g.setAttribute('opacity', pr(t, 42.0, 0.5)); s.Om.set(OUT, (i, j) => pr(t, 42.5 + i * 3, 0.7));
    s.Om.hl((i) => (i === 2 && t > 40 && t < 56 ? 0.9 : 0), TH.ink); s.Wm.hl((i) => (i === 2 && t > 40 && t < 56 ? 0.9 : 0), TH.ink);
    s.eq.g.setAttribute('opacity', pr(t, 68.0, 0.5)); s.eq.show(pr(t, 68.4, 5));
  },
};

// ===================================================================== 5e: many heads
const HEADPAT = [
  (i, j) => (Math.floor(i / 4) === Math.floor(j / 4) ? 0.9 : 0.05),            // local blocks
  (i, j) => (j < 4 ? 0.9 : 0.06),                                              // everyone reads the state block
  (i, j) => (i === j ? 0.95 : 0.05),                                           // self
  (i, j) => (i >= 8 && j < 4 ? 0.95 : 0.04),                                   // actions read state
  (i, j) => (i < 4 && j >= 8 ? 0.85 : 0.05),                                   // state reads actions
  (i, j) => (j >= 4 && j < 8 ? 0.8 : 0.07),                                    // everyone reads history
  (i, j) => 0.2 + 0.7 * hn(i, j, 4),                                           // diffuse
  (i, j) => (Math.abs(i - j) <= 1 ? 0.9 : 0.05),                               // neighbours
];
export const heads = {
  id: 'c5_heads', title: 'Eight heads', dur: 90, ch: 5, loc: 'attention', mood: [TH.state, TH.search, TH.act],
  caps: [
    [0.5, 'One head can only ask one kind of question. So Astra runs eight in parallel, each on its own thirty-two-number slice of the two hundred fifty-six.'],
    [16.0, 'Each head has its own query, key and value matrices, so it learns its own pattern of who to read.'],
    [30.0, 'These eight maps are illustrative, not measured from Astra. They show the idea: one head might read mostly from the state block, another from history, another only from itself.'],
    [50.0, 'The eight outputs are glued back together, thirty-two times eight is two hundred fifty-six again, and one more linear layer, W sub O, mixes them.'],
    [66.0, 'In symbols: concat of head one to head eight, times W sub O.'],
    [76.0, 'Four square matrices plus biases: two hundred sixty-three thousand, one hundred sixty-eight parameters in every attention layer.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 5', title: 'Eight heads in parallel', sub: '256 = 8 × 32 · each head attends in its own way (maps illustrative)', accent: TH.search });
    const bar = G(L); const hc = ['#7be3d5', '#8be28f', '#f2c67b', '#ff9f6b', '#ff9ed8', '#b6a1ff', '#83b8ff', '#ff7a8a']; const segs = hc.map((c, h) => { const r = S('rect', { x: 460 + h * 125, y: 260, width: 118, height: 40, rx: 6, fill: rgba(c, 0.35), stroke: c, 'stroke-width': 2 }, bar); T(bar, `dims ${h * 32}–${h * 32 + 31}`, { x: 460 + h * 125 + 59, y: 286, size: 15, w: 600, m: true }); return r; });
    T(bar, 'one token, 256 numbers', { x: 440, y: 286, size: 18, a: 'end', fill: TH.dim, m: true });
    const maps = hc.map((c, h) => { const g = G(L); const n = 12, cs = 11; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) S('rect', { x: j * (cs + 1), y: i * (cs + 1), width: cs, height: cs, rx: 2, fill: mix('#0b1320', c, 0.08 + 0.85 * HEADPAT[h](i, j)) }, g); T(g, 'head ' + (h + 1), { x: (n * (cs + 1)) / 2, y: -10, size: 18, w: 650, fill: c, m: true }); g.setAttribute('transform', `translate(${300 + (h % 4) * 340} ${360 + Math.floor(h / 4) * 190})`); return g; });
    const cat = T(L, '', { x: 960, y: 740, size: 28, fill: TH.ink, m: true });
    const eq = Eq(L, { x: 960, y: 805, a: 'middle', size: 42, runs: [['MHA(X)', TH.ink], [' = ', TH.dim], ['Concat', TH.search], ['(head₁ … head₈)', TH.search], [' W_O', TH.pol]] });
    const par = T(L, '4 × (256×256 + 256) = 263,168 parameters', { x: 960, y: 852, size: 24, fill: TH.pol, m: true, w: 700 });
    return { hd, bar, segs, maps, cat, eq, par };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.bar.setAttribute('opacity', pr(t, 0.8, 0.6)); s.segs.forEach((r, i) => r.setAttribute('opacity', 0.35 + 0.65 * pr(t, 4.0 + i * 0.7, 0.5)));
    s.maps.forEach((g, i) => { const a = pr(t, 16.0 + i * 0.9, 0.7, E.outBack); g.setAttribute('opacity', a); });
    s.cat.textContent = t > 50 ? 'concat: 8 × 32 = 256  →  W_O (256 → 256)' : ''; s.cat.setAttribute('opacity', pr(t, 50.0, 0.6));
    s.eq.g.setAttribute('opacity', pr(t, 66.0, 0.5)); s.eq.show(pr(t, 66.4, 4)); s.par.setAttribute('opacity', pr(t, 76.0, 0.6));
  },
};

// ===================================================================== 5f: bidirectional, 180 tokens
export const bidir = {
  id: 'c5_bidir', title: 'Everyone sees everyone', dur: 66, ch: 5, loc: 'attention', mood: [TH.state, TH.hist, TH.act],
  caps: [
    [0.5, 'In Astra the table is the whole sequence: fifty-two state slots, sixty-four history slots, sixty-four action slots. One hundred eighty tokens in all.'],
    [14.0, 'Attention runs on every one of them. Each token may read every other real token, in both directions. State reads actions, actions read state, history reads both.'],
    [28.0, 'A language model hides the future so it can predict the next word. Astra is not generating a sequence, it is judging a position, so nothing needs hiding.'],
    [42.0, 'The only thing hidden is padding: the unused slots, switched off by the mask we saw.'],
    [54.0, 'So every head in every layer scores a hundred eighty by a hundred eighty grid: thirty-two thousand four hundred pairs.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 5', title: 'Bidirectional, over 180 slots', sub: 'No causal mask · padding is the only thing hidden', accent: TH.hist });
    const N = 18, cs = 24; const blocks = [[0, 5, TH.state, 'state · 52'], [5, 11, TH.hist, 'history · 64'], [11, 18, TH.act, 'actions · 64']];
    const grid = G(L); const cells = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const bi = blocks.findIndex((b) => i >= b[0] && i < b[1]), bj = blocks.findIndex((b) => j >= b[0] && j < b[1]); const real = (i < 3 || (i >= 5 && i < 9) || (i >= 11 && i < 15)) && (j < 3 || (j >= 5 && j < 9) || (j >= 11 && j < 15)); const rc = S('rect', { x: j * (cs + 2), y: i * (cs + 2), width: cs, height: cs, rx: 3, fill: real ? mix('#0b1320', blocks[bj].slice(2)[0], 0.25 + 0.55 * hn(i, j, 9)) : '#141d2b', opacity: real ? 1 : 0.5 }, grid); cells.push({ rc, real, i, j }); }
    grid.setAttribute('transform', 'translate(300 280)');
    blocks.forEach(([a, b, c, l]) => { T(grid, l, { x: -14, y: ((a + b) / 2) * (cs + 2), size: 17, a: 'end', fill: c, m: true }); T(grid, l, { x: ((a + b) / 2) * (cs + 2), y: -12, size: 17, fill: c, m: true }); });
    const side = G(L); const rows = [['state ↔ actions', TH.state], ['actions ↔ history', TH.act], ['every real token ↔ every real token', TH.hist]];
    const compare = T(L, 'language model: token i sees only tokens ≤ i', { x: 1280, y: 330, size: 21, a: 'start', fill: TH.dim, m: true }); const compare2 = T(L, 'Astra: every real token sees every real token', { x: 1280, y: 380, size: 21, a: 'start', fill: TH.hist, m: true });
    const tri = G(L); const ts = 15; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) S('rect', { x: j * (ts + 2), y: i * (ts + 2), width: ts, height: ts, rx: 2, fill: j <= i ? '#3a4b66' : '#101826' }, tri); tri.setAttribute('transform', 'translate(1280 420)');
    const full = G(L); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) S('rect', { x: j * (ts + 2), y: i * (ts + 2), width: ts, height: ts, rx: 2, fill: rgba(TH.hist, 0.55) }, full); full.setAttribute('transform', 'translate(1470 420)');
    const nums = T(L, '180 × 180 = 32,400 scores · per head · per layer · per position', { x: 960, y: 880, size: 26, fill: TH.search, m: true, w: 700 });
    const leg = T(L, 'dark cells = Pad (masked) · drawn at 1/10 scale', { x: 300, y: 740, size: 16, a: 'start', fill: TH.faint, m: true });
    return { hd, grid, cells, compare, compare2, tri, full, nums, leg };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.cells.forEach((c) => { const d = (c.i + c.j) * 0.06; const a = pr(t, 1.0 + d, 0.5); const read = pr(t, 14.0 + d * 0.5, 0.6); c.rc.setAttribute('opacity', a * (c.real ? (0.4 + 0.6 * read) : 0.5)); });
    const pulse = 0.5 + 0.5 * Math.sin(t * 2);
    s.cells.forEach((c) => { if (c.real && t > 14) c.rc.setAttribute('stroke', rgba(TH.ink, 0.0)); });
    s.compare.setAttribute('opacity', pr(t, 28.0, 0.6)); s.compare2.setAttribute('opacity', pr(t, 32.0, 0.6)); s.tri.setAttribute('opacity', pr(t, 29.0, 0.6)); s.full.setAttribute('opacity', pr(t, 33.0, 0.6));
    s.leg.setAttribute('opacity', pr(t, 42.0, 0.6)); s.nums.setAttribute('opacity', pr(t, 54.0, 0.6));
  },
};
