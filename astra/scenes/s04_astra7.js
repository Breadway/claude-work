import { S, G, T, P, layer, C, E, pr, clamp, lerp, mix, rgba, bump, sbump, hn, rng, drawOn, travel, fmt, curve, noise } from '../engine/core.js';
import { header, card, pill, stat, buildNet, xf, panel, arcPath, hbar } from '../engine/kit.js';

const eio = E.inOutC;
const ORANGE = '#ff9f6b';

// ===================================================================== CHAIN RESPONSES
export const chain = {
  id: 'chain', title: 'Chain responses', dur: 28, ver: 6, mood: [C.gold, C.red, C.purple],
  caps: [
    [0.4, 'So why did a heuristic win? ExpertCpu is AdvCPU plus *two small simulations*.'],
    [5.0, 'For each reaction to an open chain: clone the state, force the response, let AdvCPU resolve the rest, then score the result.'],
    [12.6, 'Search on ordinary plays was worth about four points.'],
    [16.2, 'Search on *chain responses*, like when to negate with Cosmic Denial, was worth *9.6*.'],
    [21.4, 'The single largest lever measured in the project. v6 sent chain responses through the same pipeline as everything else.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'The turning point', title: 'Chain-response timing', sub: 'ExpertCpu = AdvCPU + 1-ply simulation search', accent: C.gold });
    const sc = G(L);
    // chain stack
    const stack = G(sc);
    const plays = [['Black Hole', C.purple, 'opponent plays'], ['Chain open', C.gold, 'react now?']];
    const stackCards = plays.map(([n, col, sub], i) => { const g = card(stack, { w: 270, h: 96, kicker: sub, title: n, accent: col }); g.setAttribute('transform', `translate(260 ${430 + i * 118})`); g.col = col; return g; });
    const clone = G(sc); S('rect', { x: -34, y: -34, width: 56, height: 56, rx: 12, fill: '#10243a', stroke: C.cyan, 'stroke-width': 3 }, clone); const cl2 = S('rect', { x: -22, y: -22, width: 56, height: 56, rx: 12, fill: '#10243a', stroke: C.cyan, 'stroke-width': 3, opacity: 0.9 }, clone); T(clone, 'clone state', { x: 0, y: 66, size: 17, w: 650, m: true, fill: C.cyan });
    const lanes = ['Pass', 'Cosmic Denial', 'Shockwave'].map((nm, i) => {
      const g = G(sc); const y = 340 + i * 150;
      T(g, nm, { x: 790, y, size: 23, w: 650, a: 'start' });
      const steps = ['force', 'resolve', 'AdvCPU plays on', 'score'].map((s2, k) => { const x = 1010 + k * 165; S('circle', { cx: x, cy: y, r: 11, fill: '#0d1726', stroke: '#46607e', 'stroke-width': 2.4 }, g); T(g, s2, { x, y: y + 34, size: 14.5, w: 550, m: true, fill: C.faint }); return x; });
      const line = S('path', { d: `M${steps[0]} ${y} L${steps[3]} ${y}`, stroke: '#33506a', 'stroke-width': 3 }, g);
      const prog = S('path', { d: `M${steps[0]} ${y} L${steps[3]} ${y}`, stroke: C.cyan, 'stroke-width': 4, 'stroke-linecap': 'round', filter: 'url(#glow)' }, g); prog.__len = steps[3] - steps[0];
      const dot = S('circle', { r: 8, fill: '#fff', filter: 'url(#glow)' }, g);
      const bar = S('rect', { x: 1530, y: y - 15, width: 0, height: 30, rx: 15, fill: [C.faint, C.green, C.blue][i] }, g);
      const crown = T(g, '✓ best', { x: 1546, y: y - 36, size: 17, w: 700, m: true, fill: C.green, a: 'start' });
      g.steps = steps; g.y = y; g.dot = dot; g.prog = prog; g.bar = bar; g.crown = crown; g.i = i; return g;
    });
    const sm = T(sc, 'successor score', { x: 1620, y: 270, size: 16, m: true, fill: C.muted });
    const il = T(sc, 'illustrative scores', { x: 1620, y: 790, size: 14, m: true, fill: C.faint });
    // stat tiles
    const tiles = G(L);
    const t1 = stat(tiles, { x: 640, y: 540, label: 'choose_action search', color: C.cyan, w: 460, h: 200, big: 96, suffix: ' pts', dec: 0, prefix: '+~' });
    const t2 = stat(tiles, { x: 1280, y: 540, label: 'chain-response search', color: C.gold, w: 460, h: 200, big: 96, suffix: ' pts', dec: 1, prefix: '+' });
    const lever = T(tiles, 'the largest single lever measured', { x: 1280, y: 690, size: 24, w: 600, fill: C.gold });
    return { hd, sc, stackCards, clone, cl2, lanes, sm, il, tiles, t1, t2, lever };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    const out = pr(t, 12.4, 0.8);
    s.sc.setAttribute('opacity', pr(t, 0.4, 0.6) * (1 - out)); s.sc.style.display = out >= 0.999 ? 'none' : '';
    s.stackCards.forEach((g, i) => { const q = pr(t, 1.0 + i * 0.5, 0.7, E.outBack); P(g, { x: 260, y: 430 + i * 118, s: q, o: q }); });
    const cq = pr(t, 3.2, 0.7, E.outBack); P(s.clone, { x: 640, y: 480, s: cq, o: cq });
    s.cl2.setAttribute('transform', `translate(${Math.sin(t * 3) * 3} ${Math.cos(t * 3) * 3})`);
    s.lanes.forEach((g, i) => {
      const k = 5.4 + i * 0.5; const u = E.inOutC(clamp((t - k) / 5.0));
      const a = pr(t, 4.4 + i * 0.25, 0.6);
      g.setAttribute('opacity', a);
      drawOn(g.prog, u);
      g.dot.setAttribute('cx', lerp(g.steps[0], g.steps[3], u)); g.dot.setAttribute('cy', g.y);
      const sc2 = [0.38, 0.92, 0.55][i]; const bp = E.outQ4(clamp((t - k - 5.2) / 1.0));
      g.bar.setAttribute('width', 210 * sc2 * bp);
      g.crown.setAttribute('opacity', i === 1 ? pr(t, k + 6.4, 0.5) : 0);
    });
    s.sm.setAttribute('opacity', pr(t, 10.0, 0.5)); s.il.setAttribute('opacity', pr(t, 10.5, 0.5));
    s.t1.set(4, 1, 1); s.t1.g.setAttribute('transform', `translate(640 540) scale(${pr(t, 12.9, 0.7, E.outBack)})`);
    s.t2.set(9.6 * E.outQ4(clamp((t - 16.4) / 1.5)), 1, 1); s.t2.g.setAttribute('transform', `translate(1280 540) scale(${pr(t, 16.2, 0.7, E.outBack)})`);
    s.lever.setAttribute('opacity', pr(t, 19.2, 0.6));
  },
};

// ===================================================================== ASTRA-7 INTRO
export const a7intro = {
  id: 'a7intro', title: 'Astra-7', dur: 26, ver: 7, mood: [C.cyan, C.gold, C.purple],
  caps: [
    [0.4, 'Astra-7 starts from what v6 taught us.'],
    [3.4, 'Fixed feature vectors forced a 31-way abstract action space, which forced a bolt-on candidate head. Every v6 pathology traced to that *seam*.'],
    [11.4, 'And a value head trained only on terminal outcomes could not rank nearby states. One-step lookahead scored 21.0%, below the candidate head’s 23.2%.'],
    [19.6, 'The answer: stop engineering features. *Tokenise the game.*'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Generation 7', title: 'Tokenise the game', sub: 'Entity transformer with a pointer policy', accent: C.cyan });
    const old = G(L);
    const bl = [['Fixed vector', '3 × 162 handcrafted floats', C.blue], ['Abstract action', '31-way policy head', C.purple], ['Candidate head', 'bolt-on concrete chooser', C.pink]].map(([ti, su, col], i) => { const g = card(old, { w: 360, h: 110, title: ti, sub: su, accent: col }); g.setAttribute('transform', `translate(${380 + i * 580} 400)`); g.col = col; return g; });
    const ar = [0, 1].map((i) => S('path', { d: `M${380 + i * 580 + 190} 400 L${380 + (i + 1) * 580 - 190} 400`, stroke: '#4a6680', 'stroke-width': 3, fill: 'none', 'marker-end': 'url(#arr)' }, old));
    // seam
    const seam = S('path', { d: 'M1240 330 l14 24 l-22 20 l16 22 l-18 24 l16 20 l-12 18', stroke: C.red, 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', filter: 'url(#glow2)' }, old); seam.__len = 220;
    const seamT = T(old, 'the seam', { x: 1240, y: 470, size: 22, w: 700, fill: C.red, m: true });
    const path = ['label-noise ceilings', 'aux-path training blindness', 'self-imitation bug'].map((s2, i) => pill(old, s2, { x: 0, y: 0, color: C.red, size: 17, h: 36 }));
    // value ranking bars
    const vr = G(old);
    T(vr, 'value head ranking successors (1-step lookahead)', { x: 0, y: -62, size: 18, w: 600, fill: C.muted });
    const mkb = (y, col, lbl, v) => { S('rect', { x: -330, y, width: 640, height: 30, rx: 15, fill: '#0d1726', stroke: '#26354a' }, vr); const f = S('rect', { x: -330, y, width: 0, height: 30, rx: 15, fill: col }, vr); T(vr, lbl, { x: -350, y: y + 15, size: 17, w: 600, a: 'end' }); const tt = T(vr, '', { x: 0, y: y + 15, size: 17, w: 750, a: 'end', m: true, fill: '#07101c' }); return { f, tt, v }; };
    vr.A = mkb(-30, C.red, 'value lookahead', 21.0); vr.B = mkb(14, C.pink, 'candidate head', 23.2);
    vr.setAttribute('transform', 'translate(960 700)');
    // new
    const nw = G(L);
    const nb = [['Tokens', '180 slots · 8 bytes each', C.cyan], ['Transformer', '6 layers · 4.99M params', C.purple], ['Pointer policy', 'one head, every decision', C.gold]].map(([ti, su, col], i) => { const g = card(nw, { w: 360, h: 110, title: ti, sub: su, accent: col }); g.setAttribute('transform', `translate(${380 + i * 580} 520)`); g.col = col; return g; });
    const nar = [0, 1].map((i) => S('path', { d: `M${380 + i * 580 + 190} 520 L${380 + (i + 1) * 580 - 190} 520`, stroke: C.cyan, 'stroke-width': 3.5, fill: 'none', 'marker-end': 'url(#arr)' }, nw));
    return { hd, old, bl, ar, seam, seamT, path, vr, nw, nb, nar };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    const swap = eio(clamp((t - 19.0) / 1.2));
    s.old.setAttribute('opacity', pr(t, 0.4, 0.6) * (1 - swap)); s.old.style.display = swap >= 0.999 ? 'none' : '';
    s.bl.forEach((g, i) => { const q = pr(t, 0.9 + i * 0.5, 0.7, E.outBack); P(g, { x: 380 + i * 580, y: 400, s: q, o: q }); });
    s.ar.forEach((a, i) => a.setAttribute('opacity', pr(t, 2.2 + i * 0.4, 0.5)));
    const sp = pr(t, 5.4, 0.8, E.outQ);
    drawOn(s.seam, sp); s.seam.setAttribute('opacity', (0.6 + 0.4 * Math.sin(t * 6)) * (sp > 0 ? 1 : 0)); s.seamT.setAttribute('opacity', pr(t, 6.0, 0.5));
    s.path.forEach((p, i) => { const q = pr(t, 7.4 + i * 0.7, 0.5, E.outBack); P(p, { x: 520 + i * 360 + (i === 1 ? 20 : 0), y: 580, s: q, o: q }); });
    s.vr.setAttribute('opacity', pr(t, 11.8, 0.6));
    [s.vr.A, s.vr.B].forEach((b, i) => { const p = E.outQ4(clamp((t - 12.6 - i * 0.6) / 1.2)); const w = (b.v / 30) * 640 * p; b.f.setAttribute('width', w); b.tt.setAttribute('x', -330 + Math.max(w, 70) - 12); b.tt.textContent = p > 0.02 ? (b.v * p).toFixed(1) + '%' : ''; });
    s.nw.setAttribute('opacity', swap);
    s.nb.forEach((g, i) => { const q = pr(t, 19.6 + i * 0.4, 0.7, E.outBack); P(g, { x: 380 + i * 580, y: 520, s: q, o: q * swap }); });
    s.nar.forEach((a, i) => a.setAttribute('opacity', pr(t, 20.6 + i * 0.3, 0.5)));
  },
};

// ===================================================================== TOKENS
const TYPE_COL = { Global: C.gold, Hand: C.cyan, MySys: C.blue, Opp: C.pink, OppSys: C.purple, Hist: C.green, Act: ORANGE };
function exampleTokens() {
  const st = ['Global', ...Array(7).fill('Hand'), ...Array(4).fill('MySys'), 'Opp', ...Array(3).fill('OppSys'), 'Opp', ...Array(2).fill('OppSys'), 'Opp', ...Array(4).fill('OppSys')];
  const hist = Array(40).fill('Hist');
  const act = Array(11).fill('Act');
  return { st, hist, act };
}
export const tokens = {
  id: 'tokens', title: 'Sequence', dur: 32, ver: 7, mood: [C.cyan, C.green, C.gold],
  caps: [
    [0.4, 'Everything the model sees is a sequence of *180 fixed slots*.'],
    [4.4, '52 for the state: one global token, my hand, my systems, and each opponent followed by their systems.'],
    [10.0, '64 for history: the last 64 plays, oldest first, with seats relative to me.'],
    [14.6, 'And 64 for actions: *one token per legal choice*. The decision kind lives in the token.'],
    [20.4, 'Every token is just 8 bytes: a type id and seven small integers. Embedding rows, not engineered floats.'],
    [27.0, 'Unused slots are pads that attention ignores.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Astra-7 · input', title: '180 slots, three blocks', sub: 'State 52  ·  History 64  ·  Actions 64   (an example decision)', accent: C.cyan });
    const ex = exampleTokens();
    const blocks = [['STATE', 52, ex.st, C.cyan], ['HISTORY', 64, ex.hist, C.green], ['ACTIONS', 64, ex.act, ORANGE]];
    const X0 = 110, W = 1700, cw = (W - 40) / 180; let cx = X0;
    const cells = []; const lab = [];
    blocks.forEach(([nm, n, real, col], b) => {
      const g = G(L);
      const x0 = cx; const w = n * cw;
      for (let i = 0; i < n; i++) {
        const type = real[i]; const c = type ? TYPE_COL[type] : null;
        const r = S('rect', { x: x0 + i * cw + 1, y: 300, width: cw - 2.4, height: 70, rx: 2, fill: c || '#16233a', opacity: c ? 0.95 : 0.55 }, g);
        r.__real = !!type; r.__base = c; r.__i = cells.length; cells.push(r);
      }
      S('path', { d: `M${x0} 394 L${x0} 404 L${x0 + w - 2} 404 L${x0 + w - 2} 394`, stroke: col, 'stroke-width': 2, fill: 'none' }, g);
      const t1 = T(g, nm + ' · ' + n, { x: x0 + w / 2, y: 430, size: 20, w: 700, fill: col, m: true, ls: 1 });
      lab.push(g); cx += w + 20;
    });
    const leg = Object.entries({ Global: 'global', Hand: 'hand card', MySys: 'my system', Opp: 'opponent', OppSys: 'opp. system', Hist: 'history', Act: 'action' }).map(([k, v], i) => { const g = G(L); S('rect', { x: -9, y: -9, width: 18, height: 18, rx: 4, fill: TYPE_COL[k] }, g); T(g, v, { x: 16, y: 0, size: 15.5, w: 500, a: 'start', fill: C.muted }); g.setAttribute('transform', `translate(${160 + i * 235} 268)`); return g; });
    // anatomy rows
    const rows = [
      ['HandCard', C.cyan, [['type', 'Hand'], ['card type', '17'], ['star class', '3'], ['', ''], ['', ''], ['', ''], ['', ''], ['', '']]],
      ['MySystem', C.blue, [['type', 'Sys'], ['star name', '4'], ['class', '3'], ['filled', '2'], ['eclipse', '0'], ['complete', '0'], ['owner', '0'], ['', '']]],
      ['History', C.green, [['type', 'Hist'], ['event', '0'], ['card type', '21'], ['rel. seat', '2'], ['', ''], ['', ''], ['', ''], ['recency', '37']]],
      ['Action', ORANGE, [['type', 'Act'], ['kind', 'play'], ['card', '9'], ['target star', '4'], ['class', '3'], ['fill', '2'], ['hand slot', '1'], ['', '']]],
    ].map(([nm, col, fs], i) => {
      const g = G(L); const y = 520 + i * 92;
      T(g, nm, { x: 110, y, size: 24, w: 650, a: 'start', fill: col });
      const cs = fs.map(([f, v], k) => { const x = 360 + k * 150; const c = G(g); S('rect', { x: 0, y: -26, width: 138, height: 52, rx: 10, fill: v ? rgba(col, 0.13) : '#0b1320', stroke: v ? col : '#26354a', 'stroke-width': v ? 2 : 1.2 }, c); T(c, v || '·', { x: 69, y: -5, size: 22, w: 700, m: true, fill: v ? col : '#33506a' }); T(c, f, { x: 69, y: 17, size: 12, w: 500, m: true, fill: C.faint }); c.setAttribute('transform', `translate(${x} ${y})`); return c; });
      g.cs = cs; return g;
    });
    const bytes = T(L, 'byte 0 = type id · bytes 1–7 = bucketed fields, each in 0..63', { x: 960, y: 862, size: 18, w: 500, fill: C.muted, m: true });
    return { hd, cells, lab, leg, rows, bytes };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.cells.forEach((r, i) => {
      const blk = i < 52 ? 0 : i < 116 ? 1 : 2; const k0 = [0.8, 6.0, 12.6][blk];
      const loc = blk === 0 ? i : blk === 1 ? i - 52 : i - 116;
      const p = pr(t, k0 + loc * 0.018, 0.4, E.outBack);
      r.setAttribute('transform', `translate(0 ${(1 - p) * -24})`); r.setAttribute('opacity', (r.__real ? 0.95 : 0.55) * p);
      // shimmer pass over real tokens
      if (r.__real && t > 20) { const sh = sbump(((t - 20) * 60) % 260, i, 14); r.setAttribute('fill', mix(r.__base, '#ffffff', sh * 0.55)); }
    });
    s.lab.forEach((g, i) => g.setAttribute('opacity', pr(t, [4.4, 10.0, 14.6][i], 0.6)));
    s.leg.forEach((g, i) => g.setAttribute('opacity', pr(t, 2.0 + i * 0.15, 0.5)));
    s.rows.forEach((g, i) => { g.cs.forEach((c, k) => { const p = pr(t, 20.4 + i * 0.7 + k * 0.05, 0.5, E.outBack); c.setAttribute('opacity', p); }); g.setAttribute('opacity', pr(t, 20.2 + i * 0.7, 0.5)); });
    s.bytes.setAttribute('opacity', pr(t, 24.5, 0.6));
  },
};

// ===================================================================== EMBEDDING
export const embed = {
  id: 'embed', title: 'Embedding', dur: 18, ver: 7, mood: [C.purple, C.cyan, C.blue],
  caps: [
    [0.4, 'Each token becomes a vector by *lookup and sum*.'],
    [5.0, 'One type table of 8 rows and seven field tables of 64 rows, every row 256 wide. No bias, no hand-built features.'],
    [12.0, 'Just *116,736 parameters*, and the encoder sees a [batch, length, 256] tensor.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Astra-7 · embedding', title: 'Lookup, then sum', sub: 'type row + seven field rows → one 256-d vector', accent: C.purple });
    const cols = [C.gold, C.cyan, C.blue, C.pink, C.purple, C.green, ORANGE, C.red];
    const vals = ['Act', 'play', '9', '4', '3', '2', '1', '0'], nm = ['type', 'kind', 'card', 'star', 'class', 'fill', 'slot', 'f6'];
    const rows = cols.map((col, i) => {
      const g = G(L); const y = 290 + i * 66;
      const cell = G(g); S('rect', { x: -52, y: -24, width: 104, height: 48, rx: 10, fill: rgba(col, 0.14), stroke: col, 'stroke-width': 2 }, cell); T(cell, vals[i], { y: -4, size: 21, w: 700, m: true, fill: col }); T(cell, nm[i], { y: 15, size: 11.5, m: true, fill: C.faint }); cell.setAttribute('transform', `translate(190 ${y})`);
      const arrow = S('path', { d: `M250 ${y} L420 ${y}`, stroke: col, 'stroke-width': 2.4, fill: 'none', 'marker-end': 'url(#arr)', 'stroke-dasharray': '6 6' }, g);
      // table
      const tb = G(g); const rowsN = i === 0 ? 8 : 64; S('rect', { x: 0, y: -26, width: 190, height: 52, rx: 10, fill: '#0b1320', stroke: '#26354a', 'stroke-width': 1.6 }, tb);
      const nlines = i === 0 ? 8 : 14; for (let k = 0; k < nlines; k++) S('rect', { x: 8, y: -22 + k * (44 / nlines), width: 174, height: (44 / nlines) - 1.2, rx: 1.5, fill: '#16233a' }, tb);
      const hl = S('rect', { x: 8, y: -22, width: 174, height: 44 / nlines - 1.2, rx: 1.5, fill: col, filter: 'url(#glow)' }, tb);
      T(tb, (i === 0 ? '8' : '64') + ' × 256', { x: 95, y: 42 - 12 + 0, size: 11.5, m: true, fill: C.faint }); tb.setAttribute('transform', `translate(430 ${y})`); tb.hl = hl; tb.n = nlines;
      // vector
      const vec = G(g); const segs = 40; for (let k = 0; k < segs; k++) S('rect', { x: k * 8.5, y: -13, width: 7.2, height: 26, rx: 2, fill: col, opacity: 0.25 + 0.75 * hn(i, k, 3) }, vec);
      vec.setAttribute('transform', `translate(680 ${y})`);
      g.cell = cell; g.arrow = arrow; g.tb = tb; g.vec = vec; g.y = y; g.col = col; return g;
    });
    const plus = T(L, '+', { x: 1100, y: 540, size: 70, w: 400, fill: C.faint });
    const sum = G(L); const segs = 64; for (let k = 0; k < segs; k++) { const c = mix(mix(C.cyan, C.purple, hn(k, 9)), C.gold, hn(k, 4) * 0.5); S('rect', { x: k * 6.4, y: -26, width: 5.4, height: 52, rx: 2.5, fill: c, opacity: 0.35 + 0.65 * hn(k, 5), filter: 'url(#glow)' }, sum); }
    sum.setAttribute('transform', 'translate(1330 540)');
    const sumT = T(L, 'one 256-d token vector', { x: 1540, y: 612, size: 24, w: 650 });
    const cnt = stat(L, { x: 1540, y: 750, label: 'embedding parameters', color: C.purple, w: 400, h: 110, big: 46 });
    return { hd, rows, plus, sum, sumT, cnt };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.rows.forEach((g, i) => {
      const k = 1.2 + i * 0.3;
      g.cell.setAttribute('opacity', pr(t, k, 0.4)); g.arrow.setAttribute('opacity', pr(t, k + 0.3, 0.4));
      g.tb.setAttribute('opacity', pr(t, k + 0.4, 0.4));
      const sel = Math.floor(hn(i, 77) * g.tb.n); g.tb.hl.setAttribute('y', -22 + sel * (44 / g.tb.n)); g.tb.hl.setAttribute('opacity', pr(t, k + 0.7, 0.3));
      const merge = eio(clamp((t - 6.6 - i * 0.08) / 1.3));
      const vp = pr(t, k + 0.8, 0.5);
      g.vec.setAttribute('transform', `translate(${lerp(680, 1330, merge)} ${lerp(g.y, 540, merge)}) scale(${lerp(1, 0.78, merge)} ${lerp(1, 0.6, merge)})`);
      g.vec.setAttribute('opacity', vp * (1 - pr(t, 8.0 + i * 0.03, 0.4)));
    });
    s.plus.setAttribute('opacity', pr(t, 5.8, 0.5) * (1 - pr(t, 8.0, 0.4)));
    const sp = pr(t, 7.6, 0.8, E.outBack); s.sum.setAttribute('opacity', sp); s.sum.setAttribute('transform', `translate(1330 540) scale(${lerp(0.8, 1, sp)} 1)`);
    s.sumT.setAttribute('opacity', pr(t, 8.4, 0.6));
    s.cnt.set(lerp(0, 116736, E.outQ4(clamp((t - 11.8) / 2.4))), pr(t, 11.6, 0.5), 1);
  },
};

// ===================================================================== ENCODER
export const encoder = {
  id: 'encoder', title: 'Encoder', dur: 34, ver: 7, mood: [C.purple, C.blue, C.cyan],
  caps: [
    [0.4, 'The tokens pass through *six identical pre-norm encoder layers*.'],
    [5.4, 'Attention is bidirectional. State tokens can look at actions, actions can look at history. The only mask hides pads.'],
    [12.4, 'Eight heads of width 32, then a 256 to 1024 feed-forward with GELU.'],
    [18.6, 'Residual connections wrap both. One layer is *789,760 parameters*; six make 4.74 million.'],
    [26.0, 'No decoder, no causal mask, no positional table. History recency is just a field.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Astra-7 · encoder', title: 'Six layers, full attention', sub: 'width 256 · 8 heads · FFN 1024 · dropout 0.1', accent: C.purple });
    // attention viz
    const av = G(L);
    const rowsDef = [['STATE', 26, 340, C.cyan], ['HISTORY', 34, 500, C.green], ['ACTIONS', 12, 660, ORANGE]];
    const dots = []; const rowLab = [];
    rowsDef.forEach(([nm, n, y, col], r) => {
      rowLab.push(T(av, nm, { x: 110, y: y - 40, size: 16, w: 700, a: 'start', fill: col, m: true, ls: 1.5 }));
      for (let i = 0; i < n; i++) { const x = 130 + (i * 760) / (n - 1 || 1) * (n > 12 ? 1 : 0.86) + (n <= 12 ? 40 : 0); const d = S('circle', { cx: x, cy: y, r: 8, fill: mix(col, '#0b1320', 0.4), stroke: col, 'stroke-width': 1.8 }, av); d.__x = x; d.__y = y; d.__r = r; d.__col = col; dots.push(d); }
      // pads
      for (let i = 0; i < 4; i++) S('circle', { cx: 900 + i * 0 + 40, cy: y, r: 0, fill: 'none' }, av);
    });
    const beams = Array.from({ length: 16 }, () => S('path', { d: 'M0 0', fill: 'none', stroke: '#fff', 'stroke-linecap': 'round' }, av));
    const heads = Array.from({ length: 8 }, (_, i) => { const r = S('rect', { x: 110 + i * 40, y: 770, width: 30, height: 22, rx: 6, fill: '#16233a', stroke: C.purple, 'stroke-width': 1.6 }, av); return r; });
    const headT = T(av, 'attention heads', { x: 110, y: 812, size: 15, w: 500, a: 'start', m: true, fill: C.muted });
    const padT = T(av, 'pad keys: −1e4 before softmax', { x: 900, y: 270, size: 16, m: true, fill: C.faint, a: 'end' });
    // layer flow
    const fl = G(L); const FX = 1320;
    const blocks = [['LayerNorm', C.faint, 0], ['Multi-head attention', C.purple, 1], ['+ residual', C.gold, 2], ['LayerNorm', C.faint, 3], ['Feed-forward 256→1024→256', C.blue, 4], ['+ residual', C.gold, 5]].map(([nm, col, i]) => { const g = G(fl); const y = 290 + i * 78; const w = i === 4 ? 440 : 360; S('rect', { x: -w / 2, y: -26, width: w, height: 52, rx: 12, fill: 'url(#surface)', stroke: col === C.faint ? '#33506a' : col, 'stroke-width': 2 }, g); T(g, nm, { y: 0, size: 20, w: 620, fill: col === C.faint ? C.muted : C.text }); g.setAttribute('transform', `translate(${FX} ${y})`); g.y = y; g.col = col; return g; });
    const spine = S('path', { d: `M${FX} 240 L${FX} 800`, stroke: '#33506a', 'stroke-width': 3, 'stroke-dasharray': '3 9' }, fl);
    const res1 = S('path', { d: `M${FX - 190} 262 C${FX - 300} 262 ${FX - 300} 368 ${FX - 190} 368`, stroke: C.gold, 'stroke-width': 3, fill: 'none', 'stroke-dasharray': '6 6' }, fl);
    const res2 = S('path', { d: `M${FX - 190} 496 C${FX - 300} 496 ${FX - 300} 602 ${FX - 190} 602`, stroke: C.gold, 'stroke-width': 3, fill: 'none', 'stroke-dasharray': '6 6' }, fl);
    const pulse = S('circle', { r: 9, fill: '#fff', filter: 'url(#glow2)' }, fl);
    const lay = Array.from({ length: 6 }, (_, i) => { const g = G(L); S('rect', { x: -26, y: -20, width: 52, height: 40, rx: 10, fill: '#16233a', stroke: C.purple, 'stroke-width': 2 }, g); T(g, 'L' + (i + 1), { size: 18, w: 700, m: true, fill: C.purple }); g.setAttribute('transform', `translate(${1090 + i * 62} 840)`); return g; });
    const x6 = T(L, '× 6', { x: 1510, y: 840, size: 34, w: 750, fill: C.purple, m: true });
    const pc = stat(L, { x: 1712, y: 330, label: 'per layer', color: C.purple, w: 250, h: 110, big: 38 });
    const pt = stat(L, { x: 1712, y: 460, label: 'encoder total', color: C.blue, w: 250, h: 110, big: 38 });
    return { hd, av, dots, beams, heads, headT, padT, fl, blocks, spine, res1, res2, pulse, lay, x6, pc, pt, rowLab };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.av.setAttribute('opacity', pr(t, 0.8, 0.7));
    s.dots.forEach((d, i) => { const p = pr(t, 1.0 + i * 0.015, 0.5, E.outBack); d.setAttribute('r', 8 * p); });
    // query beams
    const q = Math.floor((t - 3.0) / 1.6); const qi = t > 3.0 ? 60 + (Math.abs(q) % 12) : -1; // action dot index
    const qd = qi >= 0 ? s.dots[qi] : null;
    s.beams.forEach((b, k) => {
      if (!qd || t < 5.4) { b.setAttribute('opacity', 0); return; }
      const trg = s.dots[Math.floor(hn(q, k, 3) * 60)]; const w = Math.pow(hn(q, k, 8), 1.6);
      b.setAttribute('d', `M${qd.__x} ${qd.__y} C${qd.__x} ${qd.__y - 60} ${trg.__x} ${trg.__y + 60} ${trg.__x} ${trg.__y}`);
      b.setAttribute('stroke', mix(C.purple, trg.__col, 0.5)); b.setAttribute('stroke-width', 1 + w * 3.6);
      const f = sbump((t - 3.0) % 1.6, 0.8, 0.8); b.setAttribute('opacity', (0.12 + w * 0.7) * f);
    });
    s.dots.forEach((d, i) => { const act = (i === qi) ? 1 : 0; d.style.filter = act && t > 5.4 ? 'url(#glow)' : ''; d.setAttribute('fill', act && t > 5.4 ? '#fff' : mix(d.__col, '#0b1320', 0.4)); });
    s.heads.forEach((h, i) => { const on = t > 12.4 ? sbump((t * 2.4 + i * 0.5) % 8, i, 1.2) : 0; h.setAttribute('fill', mix('#16233a', C.purple, on)); h.setAttribute('opacity', pr(t, 12.4 + i * 0.1, 0.4)); });
    s.headT.setAttribute('opacity', pr(t, 12.4, 0.5)); s.padT.setAttribute('opacity', pr(t, 7.0, 0.5));
    // flow
    s.blocks.forEach((g, i) => { const p = pr(t, 1.6 + i * 0.35, 0.6, E.outQ4); P(g, { x: 1320 + (1 - p) * 60, y: g.y, o: p }); });
    s.spine.setAttribute('opacity', pr(t, 2.0, 0.6)); s.res1.setAttribute('opacity', pr(t, 18.6, 0.6)); s.res2.setAttribute('opacity', pr(t, 19.0, 0.6));
    s.res1.style.strokeDashoffset = -t * 20; s.res2.style.strokeDashoffset = -t * 20;
    const pp = ((t - 4.0) * 0.45) % 1; s.pulse.setAttribute('cx', 1320); s.pulse.setAttribute('cy', 250 + pp * 520); s.pulse.setAttribute('opacity', pr(t, 4.0, 0.4));
    s.lay.forEach((g, i) => { const on = t > 20.6 ? sbump((t - 20.6) * 1.4 % 8, i + 0.2, 1.3) : 0; const p = pr(t, 19.6 + i * 0.15, 0.5, E.outBack); g.firstChild.setAttribute('fill', mix('#16233a', C.purple, on * 0.8)); P(g, { x: 1090 + i * 62, y: 840, s: p, o: p }); });
    s.x6.setAttribute('opacity', pr(t, 20.4, 0.5));
    s.pc.set(lerp(0, 789760, E.outQ4(clamp((t - 19.0) / 1.8))), pr(t, 18.8, 0.5), 1);
    s.pt.set(lerp(0, 4738560, E.outQ4(clamp((t - 21.0) / 2.4))), pr(t, 20.8, 0.5), 1);
  },
};

// ===================================================================== HEADS
export const heads = {
  id: 'heads', title: 'Heads', dur: 28, ver: 7, mood: [C.gold, C.cyan, C.purple],
  caps: [
    [0.4, 'Two small readouts sit on top of the encoder.'],
    [3.6, 'The *pointer policy* scores every action token with one shared MLP. Pads get minus ten thousand, and softmax runs over the legal set.'],
    [11.8, 'One head covers plays, chain responses, decides, targets and discards.'],
    [16.0, 'The *value head* mean-pools the state tokens into one number between 0 and 1.'],
    [21.0, 'In total: *4,987,394 parameters*.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Astra-7 · readouts', title: 'Pointer policy + value', sub: 'Both heads read the encoder output', accent: C.gold });
    // policy
    const pol = G(L);
    const names = ['Pass', 'PlayStar · Red Dwarf → sys 2', 'Chain: Cosmic Denial', 'Discard · card 3', 'pad', 'pad'];
    const rows = names.map((nm, i) => { const g = G(pol); const y = 320 + i * 68; const pad = nm === 'pad'; S('rect', { x: 0, y: -24, width: 330, height: 48, rx: 11, fill: pad ? '#0a111d' : rgba(ORANGE, 0.13), stroke: pad ? '#26354a' : ORANGE, 'stroke-width': pad ? 1.2 : 2, 'stroke-dasharray': pad ? '4 5' : '' }, g); T(g, nm, { x: 16, y: 0, size: 18, w: 550, a: 'start', fill: pad ? '#33506a' : C.text, m: pad }); g.setAttribute('transform', `translate(100 ${y})`);
      const lg = S('rect', { x: 700, y: y - 11, width: 0, height: 22, rx: 11, fill: pad ? '#33506a' : C.gold }, pol); const lt = T(pol, '', { x: 706, y, size: 14, m: true, a: 'start', fill: '#07101c' });
      const pb = S('rect', { x: 1000, y: y - 11, width: 0, height: 22, rx: 11, fill: C.green }, pol);
      g.y = y; g.pad = pad; g.lg = lg; g.lt = lt; g.pb = pb; return g; });
    const mlp = G(pol); S('rect', { x: 470, y: 290, width: 150, height: 410, rx: 16, fill: 'url(#surface)', stroke: C.gold, 'stroke-width': 2 }, mlp); T(mlp, 'shared MLP', { x: 545, y: 480, size: 19, w: 650, fill: C.gold }); T(mlp, '256→256→1', { x: 545, y: 508, size: 14, m: true, fill: C.muted });
    const mk = T(pol, 'logits (+ −1e4 on pads)', { x: 800, y: 270, size: 15, m: true, fill: C.muted }); const sm = T(pol, 'softmax over legal', { x: 1090, y: 270, size: 15, m: true, fill: C.muted });
    const wires = rows.map((g, i) => S('path', { d: `M430 ${g.y} L470 ${g.y} M620 ${g.y} L700 ${g.y}`, stroke: g.pad ? '#33506a' : C.gold, 'stroke-width': 2.4, fill: 'none', 'stroke-dasharray': '5 5' }, pol));
    // value
    const val = G(L);
    const sdots = Array.from({ length: 12 }, (_, i) => S('circle', { cx: 1330 + (i % 6) * 36, cy: 330 + Math.floor(i / 6) * 40, r: 11, fill: rgba(C.cyan, 0.2), stroke: C.cyan, 'stroke-width': 2 }, val));
    T(val, 'state tokens (pads ignored)', { x: 1440, y: 280, size: 15, m: true, fill: C.muted });
    const pool = S('path', { d: 'M1320 410 L1560 410 L1470 470 L1410 470 z', fill: rgba(C.cyan, 0.14), stroke: C.cyan, 'stroke-width': 2.4 }, val); T(val, 'mean-pool', { x: 1440, y: 440, size: 16, m: true, fill: C.cyan });
    S('rect', { x: 1360, y: 500, width: 160, height: 56, rx: 12, fill: 'url(#surface)', stroke: C.cyan, 'stroke-width': 2 }, val); T(val, 'MLP + sigmoid', { x: 1440, y: 528, size: 16, w: 600 });
    const gx = 1440, gy = 700, gr = 110; S('path', { d: arcPath(gx, gy, gr, Math.PI, 2 * Math.PI), stroke: '#16233a', 'stroke-width': 24, fill: 'none', 'stroke-linecap': 'round' }, val);
    const garc = S('path', { d: arcPath(gx, gy, gr, Math.PI, 2 * Math.PI), stroke: 'url(#gcp)', 'stroke-width': 24, fill: 'none', 'stroke-linecap': 'round', filter: 'url(#glow)' }, val); garc.__len = Math.PI * gr;
    T(val, '0', { x: gx - gr - 4, y: gy + 26, size: 15, m: true, fill: C.faint }); T(val, '1', { x: gx + gr + 4, y: gy + 26, size: 15, m: true, fill: C.faint }); T(val, 'win probability', { x: gx, y: gy + 40, size: 18, fill: C.muted });
    const vlink = S('path', { d: 'M1440 556 L1440 590', stroke: C.cyan, 'stroke-width': 2.4, 'stroke-dasharray': '4 4' }, val);
    // loss + params
    const loss = G(L); const l1 = pill(loss, 'policy: cross-entropy · label smoothing 0.05', { x: 0, y: 0, color: C.gold, size: 15, h: 34 }); const l2 = pill(loss, 'value: MSE × 0.3', { x: 0, y: 44, color: C.cyan, size: 15, h: 34 });
    loss.setAttribute('transform', 'translate(1470 800)');
    const tot = stat(L, { x: 960, y: 800, label: 'Astra-7 total parameters', color: C.gold, w: 520, h: 118, big: 58 });
    return { hd, pol, rows, mlp, mk, sm, wires, val, sdots, pool, garc, vlink, loss, tot };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.rows.forEach((g, i) => { const p = pr(t, 1.0 + i * 0.2, 0.5, E.outBack); g.setAttribute('opacity', p); });
    s.mlp.setAttribute('opacity', pr(t, 2.4, 0.7)); s.wires.forEach((w, i) => w.setAttribute('opacity', pr(t, 3.8 + i * 0.12, 0.5)));
    const lg = [2.4, 4.4, 3.6, 1.8, -9.8, -9.8], ex = lg.map((v) => Math.exp(Math.min(v, 0) + (v > 0 ? v : 0))); const real = lg.map((v, i) => (v < -5 ? 0 : Math.exp(v))); const sum = real.reduce((a, b) => a + b, 0);
    s.rows.forEach((g, i) => {
      const a = E.outQ4(clamp((t - 5.0 - i * 0.2) / 0.9)); const pad = g.pad;
      g.lg.setAttribute('width', (pad ? 60 : 40 + lg[i] * 50) * a); g.lt.textContent = pad ? '' : '';
      const b = E.outQ4(clamp((t - 8.0 - i * 0.1) / 1.0)); g.pb.setAttribute('width', (pad ? 0 : (real[i] / sum) * 520) * b);
      g.pb.setAttribute('fill', i === 2 ? C.green : mix(C.green, '#16233a', 0.55));
    });
    s.mk.setAttribute('opacity', pr(t, 5.2, 0.5)); s.sm.setAttribute('opacity', pr(t, 8.0, 0.5));
    s.val.setAttribute('opacity', pr(t, 16.0, 0.7));
    s.sdots.forEach((d, i) => d.setAttribute('r', 11 * (0.85 + 0.15 * Math.sin(t * 3 + i))));
    const v = 0.5 + 0.18 * Math.sin(t * 0.9) + 0.12 * Math.sin(t * 2.1); const g = pr(t, 17.4, 1.0);
    s.garc.style.strokeDasharray = `${s.garc.__len} ${s.garc.__len + 4}`; s.garc.style.strokeDashoffset = `${s.garc.__len * (1 - v * g)}`;
    s.loss.setAttribute('opacity', pr(t, 13.0, 0.6) * (1 - 0));
    s.tot.set(lerp(0, 4987394, E.outQ4(clamp((t - 21.2) / 2.6))), pr(t, 21.0, 0.6), 1);
    s.tot.g.setAttribute('transform', `translate(960 820) scale(${pr(t, 21.0, 0.6, E.outBack)})`);
  },
};

// ===================================================================== GROWTH
export const growth = {
  id: 'growth', title: 'Seven generations', dur: 22, ver: 7, mood: [C.cyan, C.purple, C.gold],
  caps: [
    [0.4, 'Zooming out: five architectures across seven generations.'],
    [4.6, 'The input went from a 96-float snapshot, to three stacked snapshots, to *180 tokens*.'],
    [11.0, 'Parameters grew from 128 thousand to *4.99 million*: about 39 times.'],
    [16.6, 'But the big shift was how the game is *represented*, not just how big the model is.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Recap', title: 'How the model grew', sub: 'Parameters and input representation', accent: C.cyan });
    const data = [['v1', '96-float snapshot', 'MLP', 128164, C.cyan], ['v2 · v3', '104-float snapshot', 'residual MLP', 196004, C.blue], ['v4 · v5', '104 + 24 per option', 'MLP + candidate head', 200933, C.pink], ['v6', '3 × 162 stacked floats', '512-wide MLP, 3 heads', 1122593, C.purple], ['v7', '180 tokens × 8 bytes', 'transformer, pointer', 4987394, C.gold]];
    const rows = data.map(([v, inp, arch, n, col], i) => {
      const g = G(L); const y = 330 + i * 105;
      T(g, v, { x: 110, y, size: 30, w: 750, a: 'start', fill: col, m: true });
      T(g, inp, { x: 290, y: y - 14, size: 22, w: 600, a: 'start' }); T(g, arch, { x: 290, y: y + 16, size: 17, w: 450, a: 'start', fill: C.muted });
      S('rect', { x: 700, y: y - 20, width: 1000, height: 40, rx: 20, fill: '#0d1726', stroke: '#26354a' }, g);
      const f = S('rect', { x: 700, y: y - 20, width: 0, height: 40, rx: 20, fill: col }, g); const tt = T(g, '', { x: 0, y, size: 20, w: 750, a: 'end', m: true, fill: '#07101c' });
      const out = T(g, '', { x: 0, y, size: 20, w: 750, a: 'start', m: true, fill: col });
      g.f = f; g.tt = tt; g.out = out; g.n = n; g.y = y; return g;
    });
    const mult = T(L, '', { x: 1700, y: 250, size: 54, w: 800, a: 'end', fill: C.gold, ls: -2 });
    return { hd, rows, mult };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.rows.forEach((g, i) => {
      const k = 1.0 + i * 0.9; g.setAttribute('opacity', pr(t, k, 0.6));
      const p = E.outQ4(clamp((t - 6.0 - i * 0.55) / 1.4)); const w = Math.max(4, (g.n / 4987394) * 1000 * p);
      g.f.setAttribute('width', w); const label = fmt(g.n * p);
      if (w > 190) { g.tt.setAttribute('x', 700 + w - 14); g.tt.textContent = label; g.out.textContent = ''; } else { g.tt.textContent = ''; g.out.setAttribute('x', 700 + w + 14); g.out.textContent = p > 0.02 ? label : ''; }
    });
    s.mult.textContent = t > 11.0 ? '≈ ' + Math.round(lerp(1, 39, E.outQ4(clamp((t - 11.0) / 2.0)))) + '×' : ''; s.mult.setAttribute('opacity', pr(t, 11.0, 0.5));
  },
};
