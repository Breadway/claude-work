import { S, G, T, P, layer, C, E, pr, clamp, lerp, mix, rgba, hn, drawOn, sbump, TH, cardFace, cardName, header, pill, STAR_COL, systemGlyph, shortAct, STAR_LABEL } from './common.js';
import { DEC } from './data.js';
import { Flow } from '../engine/edukit.js';

const seatName = ['YOU', 'OPP 1', 'OPP 2', 'OPP 3'];
const seatCol = [TH.state, '#c9d4e4', '#c9d4e4', '#c9d4e4'];

// ===================================================================== 1a: the position
export const position = {
  id: 'c1_position', title: 'A real position', dur: 62, ch: 1, loc: 'tokens', mood: [TH.state, TH.hist, TH.act],
  caps: [
    [0.6, 'This is a real Novacana position, captured from the game engine on turn 85.'],
    [5.8, 'You hold seven cards. Your star chart has three solar systems: each a star with slots for orbiting discoveries.'],
    [15.4, 'Three opponents each have systems of their own. Their hands are hidden: you can only count the cards.'],
    [24.0, 'Everything played recently is public. The last sixty-four plays, oldest to newest.'],
    [33.0, 'And the rules fix exactly which moves are legal right now. Nine of them.'],
    [41.0, 'Astra must choose one of these nine.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 1', title: 'What Astra is trying to learn', sub: 'One real decision, turn 85 · deck 52 cards', accent: TH.state });
    // opponents
    const opps = DEC.opponents.map((o, i) => {
      const g = G(L); const cx = 130 + i * 395; T(g, 'OPPONENT ' + (i + 1), { x: cx, y: 268, size: 15, w: 700, a: 'start', fill: '#c9d4e4', ls: 2.4, m: true });
      const backs = Array.from({ length: o.hand_size }, (_, k) => { const c = cardFace(g, { name: '', back: true, w: 40, h: 58 }); c.setAttribute('transform', `translate(${cx + 20 + k * 46} 322)`); return c; });
      T(g, o.hand_size + ' cards', { x: cx + 20 + o.hand_size * 46 + 6, y: 322, size: 14, a: 'start', fill: TH.dim, m: true });
      const sys = o.systems.map((s, k) => { const sg = systemGlyph(g, s, { r: 20, label: false }); sg.setAttribute('transform', `translate(${cx + 56 + k * 120} 448)`); return sg; });
      g.backs = backs; g.sys = sys; return g;
    });
    // my chart + hand
    const mine = G(L); T(mine, 'YOUR STAR CHART', { x: 130, y: 508, size: 15, w: 700, a: 'start', fill: TH.state, ls: 2.4, m: true });
    const mySys = DEC.mySystems.map((s, i) => { const sg = systemGlyph(mine, s, { r: 26 }); sg.setAttribute('transform', `translate(${210 + i * 220} 586)`); return sg; });
    const handG = G(L); T(handG, 'YOUR HAND · 7 CARDS', { x: 130, y: 722, size: 15, w: 700, a: 'start', fill: TH.state, ls: 2.4, m: true });
    const hand = DEC.hand.map((k, i) => { const c = cardFace(handG, { name: k, w: 100, h: 140 }); return c; });
    // history ticker
    const hp = G(L); S('rect', { x: 1330, y: 226, width: 520, height: 340, rx: 16, fill: 'url(#surface)', stroke: '#2c3e55', 'stroke-width': 1.4 }, hp);
    T(hp, 'RECENT PLAYS · last 64, oldest first', { x: 1354, y: 254, size: 14, w: 700, a: 'start', fill: TH.hist, ls: 1.6, m: true });
    const clipG = G(hp, { 'clip-path': 'url(#hclip1)' });
    const rows = DEC.history.map(([p, k], i) => { const r = G(clipG); S('circle', { cx: 1366, cy: 0, r: 11, fill: rgba(p === 0 ? TH.state : '#c9d4e4', 0.2), stroke: p === 0 ? TH.state : '#8aa0bd', 'stroke-width': 1.6 }, r); T(r, p === 0 ? 'Y' : String(p), { x: 1366, y: 0, size: 12, w: 700, m: true, fill: p === 0 ? TH.state : '#c9d4e4' }); T(r, cardName(k), { x: 1392, y: 0, size: 17, w: 560, a: 'start', fill: TH.hist }); T(r, '#' + (i + 1), { x: 1830, y: 0, size: 13, a: 'end', fill: TH.faint, m: true }); return r; });
    const clipH = S('clipPath', { id: 'hclip1' }, hp); S('rect', { x: 1330, y: 272, width: 520, height: 288 }, clipH); 
    // legal actions
    const ap = G(L); S('rect', { x: 1330, y: 590, width: 520, height: 306, rx: 16, fill: 'url(#surface)', stroke: '#2c3e55', 'stroke-width': 1.4 }, ap);
    const apHl = S('rect', { x: 1330, y: 590, width: 520, height: 306, rx: 16, fill: 'none', stroke: TH.act, 'stroke-width': 3, opacity: 0 }, ap);
    T(ap, 'LEGAL ACTIONS · 9', { x: 1354, y: 618, size: 14, w: 700, a: 'start', fill: TH.act, ls: 1.6, m: true });
    const acts = DEC.legal.map((a, i) => { const r = G(ap); T(r, String(i), { x: 1368, y: 0, size: 14, w: 700, fill: TH.act, m: true }); T(r, shortAct(a), { x: 1394, y: 0, size: 17, w: 560, a: 'start', fill: TH.ink }); r.setAttribute('transform', `translate(0 ${648 + i * 28})`); return r; });
    const deckTag = pill(L, 'turn 85 · deck 52', { x: 1100, y: 120, color: TH.dim, size: 15 });
    return { hd, opps, mine, mySys, handG, hand, hp, rows, ap, apHl, acts, deckTag };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    P(s.deckTag, { x: 1000, y: 112, s: pr(t, 1.0, 0.5, E.outBack), o: pr(t, 1.0, 0.4) });
    // hand
    s.hand.forEach((c, i) => { const p = pr(t, 5.8 + i * 0.22, 0.6, E.outQ4); const hov = Math.sin(t * 1.4 + i) * 2.5; P(c, { x: 215 + i * 118, y: 812 + (1 - p) * 140 + hov, r: (i - 3) * 2.2, s: 0.8 + 0.2 * p, o: p }); });
    s.handG.setAttribute('opacity', 1);
    s.mine.setAttribute('opacity', pr(t, 8.0, 0.6));
    s.mySys.forEach((g, i) => { const p = pr(t, 9.0 + i * 0.9, 0.7, E.outBack); g.setAttribute('opacity', p); g.setAttribute('transform', `translate(${210 + i * 220} 586) scale(${p})`); });
    s.opps.forEach((g, i) => { const k = 15.4 + i * 2.4; g.setAttribute('opacity', pr(t, k, 0.6)); g.backs.forEach((b, j) => b.setAttribute('opacity', pr(t, k + j * 0.1, 0.3))); g.sys.forEach((sg, j) => { const p = pr(t, k + 0.8 + j * 0.4, 0.6, E.outBack); const cx = 130 + i * 395; sg.setAttribute('transform', `translate(${cx + 56 + j * 120} 448) scale(${p})`); sg.setAttribute('opacity', p); }); });
    // history ticker: scroll through 64 rows
    const hp = pr(t, 24.0, 0.6); s.hp.setAttribute('opacity', hp);
    const scroll = lerp(0, 64 - 8, E.inOutC(clamp((t - 25.0) / 7.0)));
    s.rows.forEach((r, i) => { const yy = 292 + (i - scroll) * 34; const vis = yy > 268 && yy < 556 ? 1 : 0; r.setAttribute('transform', `translate(0 ${yy})`); r.setAttribute('opacity', vis * hp * Math.min(1, (yy - 262) / 24, (560 - yy) / 24)); });
    // actions
    const ap = pr(t, 33.0, 0.5); s.ap.setAttribute('opacity', ap);
    s.acts.forEach((r, i) => { const p = pr(t, 33.4 + i * 0.4, 0.4, E.outQ4); r.setAttribute('opacity', p * ap); r.firstChild.setAttribute('transform', 'translate(0 0)'); });
    s.apHl.setAttribute('opacity', pr(t, 41.0, 0.5) * (0.6 + 0.4 * Math.sin(t * 4)));
    // dim the board for the final line
    const dim = 1 - 0.5 * pr(t, 41.0, 0.8);
    [s.mine, s.handG].forEach((g) => g.setAttribute('opacity', dim)); s.opps.forEach((g) => g.setAttribute('opacity', pr(t, 15.4, 0.6) * dim));
  },
};

// ===================================================================== 1b: two outputs
export const outputs = {
  id: 'c1_outputs', title: 'Policy and value', dur: 58, ch: 1, loc: 'heads', mood: [TH.pol, TH.val, TH.state],
  caps: [
    [0.5, 'Here is the whole job, as one question. Given everything I can see, which legal action should I take, and how likely am I to eventually win?'],
    [11.0, 'That is two different questions, so Astra produces two different outputs.'],
    [16.5, 'The first is the *policy*: a probability for each legal action. Before any learning, a model has no opinion, so every action gets the same one ninth.'],
    [29.0, 'After training, the probabilities concentrate on the actions that work. These numbers are illustrative.'],
    [38.0, 'The second is the *value*: one number between zero and one, the probability that this seat eventually wins the game.'],
    [48.0, 'Policy says what to do. Value says how good things are. Everything else in Astra exists to compute these two well.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 1', title: 'Two outputs: policy and value', sub: 'What Astra must produce for this position', accent: TH.pol });
    const q = G(L); const qT = T(q, 'Given everything I know, which legal action should I take,', { x: 960, y: 290, size: 36, w: 600, fill: TH.ink }); const qT2 = T(q, 'and how likely am I to eventually win?', { x: 960, y: 336, size: 36, w: 600, fill: TH.val });
    // black box
    const box = G(L); S('rect', { x: -170, y: -120, width: 340, height: 240, rx: 24, fill: 'url(#surface)', stroke: '#33506a', 'stroke-width': 2, filter: 'url(#soft)' }, box); T(box, 'ASTRA', { y: -20, size: 54, w: 800, ls: -2 }); T(box, 'millions of learned numbers', { y: 30, size: 17, fill: TH.dim }); T(box, '(opened up in the next chapters)', { y: 56, size: 14, fill: TH.faint, m: true });
    const inpt = [['state', TH.state, 440], ['history', TH.hist, 540], ['legal actions', TH.act, 640]].map(([nm, col, y]) => { const g = G(L); const w = 190; S('rect', { x: 100, y: y - 26, width: w, height: 52, rx: 12, fill: rgba(col, 0.12), stroke: col, 'stroke-width': 2 }, g); T(g, nm, { x: 100 + w / 2, y, size: 20, w: 620, fill: col }); S('path', { d: `M${100 + w} ${y} C520 ${y} 520 ${540} 650 ${540}`, stroke: col, 'stroke-width': 2.4, fill: 'none', opacity: 0.8, 'marker-end': 'url(#arr)' }, g); return g; });
    // policy bars
    const pol = G(L); T(pol, 'POLICY · P(action)', { x: 1180, y: 392, size: 15, w: 700, a: 'start', fill: TH.pol, ls: 2, m: true });
    const trained = [0.04, 0.02, 0.14, 0.03, 0.02, 0.02, 0.01, 0.62, 0.10];
    const bars = DEC.legal.map((a, i) => { const y = 430 + i * 38; T(pol, shortAct(a), { x: 1170, y, size: 15, a: 'end', fill: TH.dim }); S('rect', { x: 1184, y: y - 11, width: 380, height: 22, rx: 11, fill: '#0d1726', stroke: '#26354a' }, pol); const f = S('rect', { x: 1184, y: y - 11, width: 0, height: 22, rx: 11, fill: TH.pol }, pol); const v = T(pol, '', { x: 1576, y, size: 14, a: 'start', fill: TH.pol, m: true }); return { f, v }; });
    // value gauge
    const val = G(L); const gx = 1500, gy = 830, gr = 100; T(val, 'VALUE · P(I win)', { x: gx, y: gy - 130, size: 15, w: 700, fill: TH.val, ls: 2, m: true });
    S('path', { d: `M${gx - gr} ${gy} A${gr} ${gr} 0 0 1 ${gx + gr} ${gy}`, stroke: '#16233a', 'stroke-width': 22, fill: 'none', 'stroke-linecap': 'round' }, val);
    const arc = S('path', { d: `M${gx - gr} ${gy} A${gr} ${gr} 0 0 1 ${gx + gr} ${gy}`, stroke: TH.val, 'stroke-width': 22, fill: 'none', 'stroke-linecap': 'round', filter: 'url(#glow)' }, val); arc.__len = Math.PI * gr;
    T(val, '0', { x: gx - gr - 6, y: gy + 24, size: 14, m: true, fill: TH.faint }); T(val, '1', { x: gx + gr + 6, y: gy + 24, size: 14, m: true, fill: TH.faint });
    const vv = T(val, '', { x: gx, y: gy - 30, size: 48, w: 760, fill: TH.val, m: true });
    return { hd, q, box, inpt, pol, bars, trained, val, arc, vv };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.q.setAttribute('opacity', pr(t, 0.6, 0.8) * (1 - pr(t, 11.0, 0.8) * 0.65));
    const b = pr(t, 8.5, 0.8, E.outBack); P(s.box, { x: 790 + 0, y: 540, s: b, o: b });
    s.inpt.forEach((g, i) => g.setAttribute('opacity', pr(t, 9.0 + i * 0.4, 0.5)));
    s.pol.setAttribute('opacity', pr(t, 16.5, 0.6));
    const tr = E.inOutC(clamp((t - 29.0) / 4.0));
    s.bars.forEach((r, i) => { const a = pr(t, 17.0 + i * 0.12, 0.5); const v = lerp(1 / 9, s.trained[i], tr); r.f.setAttribute('width', 380 * v * a); r.v.textContent = a > 0.2 ? (v * 100).toFixed(1) + '%' : ''; r.f.setAttribute('fill', i === 7 && tr > 0.5 ? TH.pol : mix(TH.pol, '#16233a', 0.35 * (1 - tr) + 0.2)); });
    s.val.setAttribute('opacity', pr(t, 38.0, 0.6));
    const vq = E.outQ4(clamp((t - 39.0) / 2.0)); const v = lerp(0, 0.34 + 0.06 * Math.sin(t * 1.2), vq);
    s.arc.style.strokeDasharray = `${s.arc.__len} ${s.arc.__len + 4}`; s.arc.style.strokeDashoffset = `${s.arc.__len * (1 - v)}`; s.vv.textContent = v.toFixed(2);
  },
};

// ===================================================================== 1c: the map
const MAP = [
  { k: 'tokens', n: '2', t: 'Tokens', s: '180 slots', x: 190, c: TH.state },
  { k: 'embed', n: '3–4', t: 'Embeddings', s: 'lookup + sum', x: 520, c: TH.state },
  { k: 'attention', n: '5–6', t: 'Encoder × 6', s: 'attention + FFN', x: 900, c: TH.search },
  { k: 'heads', n: '7–8', t: 'Heads', s: 'policy · value', x: 1280, c: TH.pol },
];
export const roadmap = {
  id: 'c1_map', title: 'The map', dur: 50, ch: 1, loc: '', mood: [TH.state, TH.search, TH.pol],
  caps: [
    [0.5, 'The next chapters open the black box. In order: how a position becomes tokens, how tokens become vectors, how attention lets them exchange information, and how two small heads read out the answers.'],
    [16.0, 'Then the second half: how Astra knows it was wrong, how that error flows backward through every number, and how the numbers change.'],
    [28.0, 'Finally behaviour cloning, search, and self-play: how that one-step learning becomes a training system.'],
    [38.0, 'Keep this map in mind. Every chapter zooms into one part of it and then zooms back out.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 1', title: 'The map of Astra', sub: 'Forward: position to answer.  Backward: error to updated numbers.', accent: TH.search });
    const fw = G(L); const y = 470;
    const blocks = MAP.map((m, i) => { const g = G(fw); const w = i === 2 ? 320 : 230; S('rect', { x: -w / 2, y: -90, width: w, height: 180, rx: 20, fill: 'url(#surface)', stroke: m.c, 'stroke-width': 2.4, filter: 'url(#soft)' }, g); T(g, m.t, { y: -26, size: 30, w: 680, ls: -0.5 }); T(g, m.s, { y: 16, size: 17, fill: TH.dim, m: true }); T(g, 'ch ' + m.n, { y: 58, size: 14, fill: m.c, m: true, ls: 2 }); g.w = w; return g; });
    for (let i = 0; i < 3; i++) S('path', { d: `M${MAP[i].x + (i === 2 ? 160 : 115) + 10} ${y} L${MAP[i + 1].x - (i + 1 === 2 ? 160 : 115) - 14} ${y}`, stroke: '#4a6680', 'stroke-width': 3, fill: 'none', 'marker-end': 'url(#arr)' }, fw);
    const stack = G(fw); for (let k = 0; k < 6; k++) S('rect', { x: MAP[2].x - 150 + k * 52, y: y + 104, width: 44, height: 18, rx: 5, fill: rgba(TH.search, 0.25), stroke: TH.search, 'stroke-width': 1.5 }, stack); T(stack, 'six identical blocks', { x: MAP[2].x, y: y + 144, size: 14, fill: TH.dim, m: true });
    // training half
    const tr = G(L); const ty = 760;
    const tb = [['Loss', 'ch 9', TH.loss, 1230], ['Backprop', 'ch 10', TH.grad, 880], ['Adam', 'ch 11', TH.grad, 530], ['Updated weights', 'ch 12', TH.state, 190]].map(([a, b, c, x]) => { const g = G(tr); S('rect', { x: x - 125, y: ty - 48, width: 250, height: 96, rx: 16, fill: 'url(#surface)', stroke: c, 'stroke-width': 2.2 }, g); T(g, a, { x, y: ty - 10, size: 26, w: 650 }); T(g, b, { x, y: ty + 26, size: 14, fill: c, m: true, ls: 2 }); return g; });
    for (let i = 0; i < 3; i++) S('path', { d: `M${[1230, 880, 530][i] - 128} ${ty} L${[880, 530, 190][i] + 130} ${ty}`, stroke: TH.grad, 'stroke-width': 3, fill: 'none', 'marker-end': 'url(#arr)', 'stroke-dasharray': '8 6' }, tr);
    T(tr, 'teacher target (ExpertCPU) + final outcome', { x: 1230, y: ty - 78, size: 15, fill: TH.loss, m: true });
    const outer = G(L); [['Behaviour cloning', 'ch 13–14'], ['Search', 'ch 15'], ['Self-play', 'ch 16']].forEach(([a, b], i) => { const p = pill(outer, a + ' · ' + b, { x: 380 + i * 430, y: 900, color: TH.search, size: 17, h: 36 }); });
    const wire = S('path', { d: `M${1230} ${ty - 50} C 1500 ${ty - 200} 1500 ${y + 40} ${MAP[3].x + 120} ${y + 60}`, stroke: TH.loss, 'stroke-width': 2.4, fill: 'none', 'stroke-dasharray': '6 6', opacity: 0.8 }, L);
    return { hd, fw, blocks, stack, tr, tb, outer, wire };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.blocks.forEach((g, i) => { const p = pr(t, 1.0 + i * 3.0, 0.8, E.outBack); P(g, { x: MAP[i].x, y: 470, s: p, o: p }); });
    s.stack.setAttribute('opacity', pr(t, 8.5, 0.6));
    s.tr.setAttribute('opacity', pr(t, 16.0, 0.6)); s.tb.forEach((g, i) => g.setAttribute('opacity', pr(t, 17.0 + i * 2.4, 0.6)));
    s.wire.setAttribute('opacity', pr(t, 17.0, 0.6)); s.wire.style.strokeDashoffset = -t * 20;
    s.outer.setAttribute('opacity', pr(t, 28.0, 0.7));
    const pulse = (k, a, b) => { const v = sbump(t, (a + b) / 2, (b - a) / 2); return v; };
  },
};
