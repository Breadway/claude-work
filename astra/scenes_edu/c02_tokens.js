import { S, G, T, P, layer, C, E, pr, clamp, lerp, mix, rgba, hn, drawOn, sbump, TH, cardFace, cardName, header, pill, CARD, CAT_COL } from './common.js';
import { DEC } from './data.js';
import { TokenRow, TYPE_IDX } from '../engine/edukit.js';

const CW = (1740 - 40) / 180, X0 = 90;
const BLOCK0 = [X0, X0 + 52 * CW + 20, X0 + 116 * CW + 40];   // state, history, action block starts
const slotX = (blk, i) => BLOCK0[blk] + i * CW;

// ===================================================================== 2a: objects become tokens
export const objects = {
  id: 'c2_objects', title: 'Objects to tokens', dur: 62, ch: 2, loc: 'tokens', mood: [TH.state, TH.hist, TH.act],
  caps: [
    [0.5, 'Astra cannot look at a table. It reads a list. Every object in the position becomes one small token.'],
    [9.0, 'State tokens first: one for the global situation, one per card in your hand, one per solar system, and one per opponent.'],
    [19.5, 'Then history tokens: one for each of the last sixty-four plays.'],
    [27.5, 'And one action token for each legal move.'],
    [34.5, 'Eighteen state tokens, sixty-four history tokens, nine action tokens: ninety-one in all.'],
    [44.0, 'But the sequence always has the same shape: fifty-two state slots, sixty-four history slots, sixty-four action slots. A hundred and eighty. Unused slots stay as padding.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 2', title: 'From game objects to tokens', sub: 'Real decision · turn 85', accent: TH.state });
    const chips = []; const tk = DEC.tokens;
    const lab = (s) => ({ 0: 'G', 2: 'H', 3: 'S', 5: 'O', 4: 's' }[s] || '?');
    // state chips
    tk.state.forEach((row, i) => chips.push({ blk: 0, i, row, col: TH.state, sx: 140 + i * 50, sy: 330, sw: 40, sh: 40, label: lab(row[0] === 1 ? 0 : row[0]), tIn: 9.0 + i * 0.2, tFly: 17.0 + i * 0.12 }));
    tk.history.forEach((row, i) => chips.push({ blk: 1, i, row, col: TH.hist, sx: 120 + i * 26.4, sy: 440, sw: 16, sh: 34, label: '', tIn: 19.5 + i * 0.06, tFly: 25.0 + i * 0.02 }));
    tk.actions.forEach((row, i) => chips.push({ blk: 2, i, row, col: TH.act, sx: 150 + i * 62, sy: 550, sw: 50, sh: 38, label: String(i), tIn: 27.5 + i * 0.25, tFly: 31.5 + i * 0.1 }));
    const pads = []; [[0, 52, 18], [1, 64, 64], [2, 64, 9]].forEach(([b, n, used]) => { for (let i = used; i < n; i++) pads.push(S('rect', { x: slotX(b, i) + 0.8, y: 665, width: CW - 1.6, height: 70, rx: 2, fill: '#2a3b55', opacity: 0 }, L)); });
    const els = chips.map((c) => { c.r = S('rect', { x: c.sx, y: c.sy, width: c.sw, height: c.sh, rx: 5, fill: rgba(c.col, 0.3), stroke: c.col, 'stroke-width': 1.6, opacity: 0 }, L); c.t = c.label ? T(L, c.label, { x: c.sx + c.sw / 2, y: c.sy + c.sh / 2, size: 15, w: 700, m: true, fill: c.col, opacity: 0 }) : null; return c; });
    const grp = (s, x, y, col) => T(L, s, { x, y, size: 15, w: 650, a: 'start', fill: col, m: true, ls: 1, opacity: 0 });
    const g1 = grp('STATE · global, 7 hand cards, 3 my systems, 3 opponents, 4 opponent systems', 140, 286, TH.state);
    const g2 = grp('HISTORY · the last 64 plays, oldest first', 120, 398, TH.hist);
    const g3 = grp('ACTIONS · one per legal move', 150, 508, TH.act);
    const blk = [[0, 'STATE · 52 slots', TH.state, 52], [1, 'HISTORY · 64 slots', TH.hist, 64], [2, 'ACTIONS · 64 slots', TH.act, 64]].map(([b, nm, col, n]) => { const g = G(L); S('path', { d: `M${BLOCK0[b]} 752 L${BLOCK0[b]} 762 L${BLOCK0[b] + n * CW - 2} 762 L${BLOCK0[b] + n * CW - 2} 752`, stroke: col, 'stroke-width': 2, fill: 'none' }, g); T(g, nm, { x: BLOCK0[b] + (n * CW) / 2, y: 790, size: 18, w: 700, fill: col, m: true, ls: 1 }); return g; });
    const total = T(L, '', { x: 960, y: 850, size: 30, w: 700, fill: TH.ink, m: true });
    return { hd, els, pads, g1, g2, g3, blk, total };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.els.forEach((c) => {
      const a = pr(t, c.tIn, 0.4); const f = E.inOutC(clamp((t - c.tFly) / 1.4));
      const x = lerp(c.sx, slotX(c.blk, c.i) + 0.8, f), y = lerp(c.sy, 665, f), w = lerp(c.sw, CW - 1.6, f), h = lerp(c.sh, 70, f);
      c.r.setAttribute('x', x); c.r.setAttribute('y', y); c.r.setAttribute('width', w); c.r.setAttribute('height', h); c.r.setAttribute('opacity', a);
      c.r.setAttribute('fill', rgba(c.col, lerp(0.3, 0.9, f)));
      if (c.t) { c.t.setAttribute('x', x + w / 2); c.t.setAttribute('y', y + h / 2); c.t.setAttribute('opacity', a * (1 - f)); }
    });
    s.g1.setAttribute('opacity', pr(t, 9.0, 0.5) * (1 - pr(t, 17.5, 0.5))); s.g2.setAttribute('opacity', pr(t, 19.5, 0.5) * (1 - pr(t, 26.0, 0.5))); s.g3.setAttribute('opacity', pr(t, 27.5, 0.5) * (1 - pr(t, 32.0, 0.5)));
    s.blk.forEach((g, i) => g.setAttribute('opacity', pr(t, [17.0, 25.0, 31.5][i], 0.6)));
    s.pads.forEach((p, i) => p.setAttribute('opacity', 0.55 * pr(t, 44.5 + (i % 40) * 0.03, 0.5)));
    s.total.textContent = t > 44.0 ? '52 + 64 + 64 = 180 slots' : t > 34.5 ? '18 + 64 + 9 = 91 real tokens' : '';
    s.total.setAttribute('opacity', pr(t, 34.5, 0.5));
  },
};

// ===================================================================== 2b: anatomy
const NAMES = {
  hand: ['card id', 'star class', '', '', '', '', ''],
  sys: ['star name', 'class', 'filled', 'eclipse', 'complete', 'owner', ''],
  act: ['move kind', 'card id', 'star name', 'class', 'filled', 'target pos', 'hand slot'],
  opp: ['opp slot', 'hand size', 'complete', 'near win', '', '', ''],
};
export const anatomy = {
  id: 'c2_anatomy', title: 'Token anatomy', dur: 84, ch: 2, loc: 'tokens', mood: [TH.state, TH.act, TH.search],
  caps: [
    [0.5, 'Zoom into one token. This is your Pulsar card.'],
    [6.5, 'A token is exactly eight small integers. The first says what kind of token this is: type two, a hand card. The other seven are fields.'],
    [20.0, 'For a hand card, field zero is which card it is: twenty-four in the engine’s numbering. Field one is its star class, zero, because a Pulsar is not a star.'],
    [34.0, 'A solar system token has the same eight slots, but the fields mean something else: the star, its class, discoveries attached, eclipse protection, completeness, and owner.'],
    [52.0, 'An action token says what kind of move this is, which card, which target system, and which slot in your hand the card sits in.'],
    [66.0, 'Same shape, different meanings. The type number tells the network which meaning to apply.'],
    [75.0, 'Every field holds a number from zero to sixty-three, so each field has exactly sixty-four possible values.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 2', title: 'Anatomy of a token', sub: 'type id + seven fields, each 0 to 63', accent: TH.state });
    const mk = (tok, col, names, typeName, y, cardKey) => { const g = G(L); const row = TokenRow(g, { tok, color: col, names, typeName, cw: 92, ch: 70, gap: 12, size: 28 }); g.setAttribute('transform', `translate(${(1920 - row.W) / 2} ${y})`); return { g, row }; };
    const pul = DEC.hand.indexOf('Fracture(Pulsar)');
    const sysTok = DEC.tokens.state.find((r) => r[0] === 3); const actTok = DEC.tokens.actions[1]; const oppTok = DEC.tokens.state.find((r) => r[0] === 5);
    const A = mk(DEC.tokens.state[1 + pul], TH.state, NAMES.hand, 'HandCard', 480);
    const B = mk(sysTok, TH.state, NAMES.sys, 'MySystem', 480);
    const D = mk(actTok, TH.act, NAMES.act, 'Action', 480);
    const card = G(L); const cf = cardFace(card, { name: 'Fracture(Pulsar)', w: 150, h: 212 }); card.setAttribute('transform', 'translate(300 520)');
    const bytes = T(L, '', { x: 960, y: 700, size: 24, w: 600, fill: TH.ink });
    const bits = T(L, '8 numbers · fields in 0..63 · 64 values per field', { x: 960, y: 780, size: 20, fill: TH.dim, m: true });
    const ex = G(L); T(ex, 'Pulsar → 24', { x: 0, y: 0, size: 22, w: 650, fill: TH.state, m: true }); ex.setAttribute('transform', 'translate(300 660)');
    const sysG = G(L); T(sysG, 'Yellow Dwarf · class 4 · no discoveries yet', { x: 960, y: 640, size: 22, w: 560, fill: TH.dim });
    const actG = G(L); T(actG, 'Play Pulsar (hand slot 2)', { x: 960, y: 640, size: 22, w: 560, fill: TH.dim });
    return { hd, A, B, D, card, bytes, bits, ex, sysG, actG };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    const showA = pr(t, 0.6, 0.6) * (1 - pr(t, 34.0, 0.6)), showB = pr(t, 34.4, 0.6) * (1 - pr(t, 51.5, 0.6)), showD = pr(t, 52.4, 0.6) * (1 - pr(t, 65.0, 0.6));
    s.A.g.setAttribute('opacity', showA); s.B.g.setAttribute('opacity', showB); s.D.g.setAttribute('opacity', showD);
    s.card.setAttribute('opacity', pr(t, 0.6, 0.6) * (1 - pr(t, 33.0, 0.6))); s.ex.setAttribute('opacity', pr(t, 21.0, 0.6) * (1 - pr(t, 33.0, 0.6)));
    s.sysG.setAttribute('opacity', showB); s.actG.setAttribute('opacity', showD);
    const hl = (row, n, a) => row.cells.forEach((c, i) => c.setAttribute('stroke-width', i === n ? 2.4 + 3.5 * a : (i === 0 ? 2.6 : 1.8)));
    if (t < 34) hl(s.A.row, t > 20 ? 2 : t > 6.5 ? 0 : -1, 0.5 + 0.5 * Math.sin(t * 5));
    // staggered cell reveal
    [s.A, s.B, s.D].forEach((o, k) => { const t0 = [0.8, 34.6, 52.6][k]; o.row.cells.forEach((c, i) => c.parentNode && 0); });
    s.bytes.textContent = t > 6.5 && t < 34 ? 'type = 2 → "this token is a hand card"' : t > 66 ? 'type id → which meaning the 7 fields have' : '';
    s.bytes.setAttribute('opacity', pr(t, 6.5, 0.5) * (t < 34 || t > 66 ? 1 : 0)); s.bits.setAttribute('opacity', pr(t, 75.0, 0.6));
    if (t > 66) { [s.A, s.B, s.D].forEach((o, k) => { o.g.setAttribute('opacity', pr(t, 66.0, 0.6)); o.g.setAttribute('transform', `translate(${(1920 - o.row.W) / 2} ${400 + k * 150})`); }); s.card.setAttribute('opacity', 0); s.sysG.setAttribute('opacity', 0); s.actG.setAttribute('opacity', 0); s.bytes.setAttribute('transform', 'translate(0 -40)'); s.bits.setAttribute('transform', 'translate(0 40)'); }
  },
};

// ===================================================================== 2c: ids are names
export const ids = {
  id: 'c2_ids', title: 'IDs are names', dur: 60, ch: 2, loc: 'tokens', mood: [TH.state, TH.grad, TH.search],
  caps: [
    [0.5, 'These fields are numbers, but they are not quantities. They are names.'],
    [6.0, 'Card twenty is Solar Eclipse. Card ten is Gas Giant. Twenty is not “twice” Gas Giant in any sense the game cares about.'],
    [17.0, 'Feed the raw number in, and the model must treat Pulsar, twenty-four, as more than Rocky Planet, nine. That ordering is an accident of how the engine numbered its cards.'],
    [37.0, 'What we want is a separate learned description for every ID, with no built-in ordering. That is exactly what an embedding table gives us.'],
    [49.0, 'Even fields that really are ordered, like deck size in tens, get their own table, so the model decides how the values relate.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 2', title: 'Why IDs are not quantities', sub: 'A card id is a label, like a jersey number', accent: TH.grad });
    const names = Object.keys(CARD); const line = G(L); const y = 470;
    S('path', { d: `M110 ${y} L1810 ${y}`, stroke: '#3a4d66', 'stroke-width': 2 }, line);
    const cells = names.map((k, i) => { const x = 130 + i * 58.5; const g = G(line); const [lb, cat] = CARD[k]; S('rect', { x: x - 24, y: y - 28, width: 48, height: 56, rx: 8, fill: rgba(CAT_COL[cat], 0.14), stroke: CAT_COL[cat], 'stroke-width': 1.6 }, g); T(g, String(i), { x, y: y - 6, size: 20, w: 700, m: true }); T(g, lb.split(' ')[0].slice(0, 7), { x, y: y + 14, size: 9.5, fill: TH.dim, m: true }); return { g, x, i }; });
    const calc = G(L); const c1 = T(calc, 'Solar Eclipse (20)  =  2 × Gas Giant (10)  ?', { x: 960, y: 640, size: 34, w: 600, fill: TH.ink }); const c2 = T(calc, 'Pulsar (24)  >  Rocky Planet (9)  ?  Comet (11) “between” Gas Giant and Supernova Fusion ?', { x: 960, y: 710, size: 24, fill: TH.grad, m: false });
    const sol = G(L); T(sol, 'no order, no distance  →  one learned vector per id', { x: 960, y: 640, size: 36, w: 650, fill: TH.state }); T(sol, 'embedding table: row 20 = Solar Eclipse, row 10 = Gas Giant', { x: 960, y: 700, size: 22, fill: TH.dim, m: true });
    const arc20 = S('path', { d: `M${130 + 20 * 58.5} ${y - 40} C ${130 + 20 * 58.5} ${y - 190} ${130 + 10 * 58.5} ${y - 190} ${130 + 10 * 58.5} ${y - 40}`, stroke: TH.grad, 'stroke-width': 3, fill: 'none', 'stroke-dasharray': '7 6', 'marker-end': 'url(#arr)' }, L);
    const x2 = T(L, '×2 ?', { x: 130 + 15 * 58.5, y: y - 200, size: 34, w: 800, fill: TH.grad, m: true });
    return { hd, cells, calc, c1, c2, sol, arc20, x2 };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.cells.forEach((c) => { const a = pr(t, 0.6 + c.i * 0.05, 0.4, E.outBack); c.g.setAttribute('opacity', a); const hot = (c.i === 20 || c.i === 10) ? pr(t, 6.0, 0.4) : 0; const hot2 = (c.i === 24 || c.i === 9 || c.i === 11 || c.i === 12) ? pr(t, 17.0, 0.4) : 0; c.g.setAttribute('transform', `translate(${c.x} 470) scale(${1 + 0.18 * Math.max(hot, hot2)}) translate(${-c.x} -470)`); });
    s.calc.setAttribute('opacity', pr(t, 6.0, 0.6) * (1 - pr(t, 37.0, 0.6))); s.c2.setAttribute('opacity', pr(t, 17.0, 0.6));
    s.arc20.setAttribute('opacity', pr(t, 8.5, 0.5) * (1 - pr(t, 37.0, 0.6))); s.x2.setAttribute('opacity', pr(t, 8.5, 0.5) * (1 - pr(t, 37.0, 0.6)));
    s.sol.setAttribute('opacity', pr(t, 37.0, 0.7));
  },
};

// ===================================================================== 2d: padding & layout
export const padding = {
  id: 'c2_padding', title: 'Padding and layout', dur: 52, ch: 2, loc: 'tokens', mood: [TH.mask, TH.state, TH.hist],
  caps: [
    [0.5, 'Unused slots hold pad tokens, type zero. They carry no information, and attention will be told to ignore them.'],
    [10.5, 'Each block sits at a fixed offset, so the action tokens always start at slot one hundred sixteen. The network never has to search for them.'],
    [21.0, 'State tokens have no order at all: a set, not a sequence. The order of your hand does not matter.'],
    [29.5, 'History does have an order, so each history token carries its own position in field six: oldest zero, newest sixty-three. There is no separate positional table.'],
    [43.0, 'When decisions are batched, each block is trimmed to its longest real token, rounded up to a multiple of eight, to save computation.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 2', title: 'Padding, offsets and order', sub: 'A fixed layout the network can rely on', accent: TH.mask });
    const cells = []; const blocks = [[0, 52, 18, TH.state], [1, 64, 64, TH.hist], [2, 64, 9, TH.act]];
    blocks.forEach(([b, n, used, col]) => { for (let i = 0; i < n; i++) { const real = i < used; cells.push({ b, i, real, col, r: S('rect', { x: slotX(b, i) + 0.8, y: 400, width: CW - 1.6, height: 80, rx: 2, fill: real ? rgba(col, 0.9) : '#2a3b55', opacity: 0 }, L) }); } });
    const idxT = [[0, 'slot 0'], [1, 'slot 52'], [2, 'slot 116']].map(([b, s]) => T(L, s, { x: BLOCK0[b], y: 372, size: 14, a: 'start', fill: TH.dim, m: true, opacity: 0 }));
    const padT = T(L, 'PAD · type 0 · ignored by attention', { x: 360, y: 520, size: 18, w: 650, fill: TH.mask, m: true, opacity: 0 });
    const setT = T(L, 'a SET: shuffling these changes nothing', { x: 340, y: 590, size: 22, fill: TH.state, opacity: 0 });
    const posT = T(L, 'field 6 = position 0 … 63', { x: 1180, y: 590, size: 22, fill: TH.hist, opacity: 0 }); const pos = [0, 31, 63].map((i) => T(L, String(i), { x: slotX(1, i) + CW / 2, y: 505, size: 16, w: 700, fill: TH.hist, m: true, opacity: 0 }));
    const trim = G(L); [[0, 24, TH.state], [1, 64, TH.hist], [2, 16, TH.act]].forEach(([b, n, col]) => S('rect', { x: slotX(b, 0), y: 395, width: n * CW, height: 90, rx: 4, fill: 'none', stroke: col, 'stroke-width': 3, 'stroke-dasharray': '6 5' }, trim)); const trT = T(trim, 'batch layout: 24 + 64 + 16 = 104 slots (multiples of 8)', { x: 960, y: 650, size: 24, w: 600, fill: TH.ink, m: true });
    return { hd, cells, idxT, padT, setT, posT, pos, trim };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.cells.forEach((c) => { const a = pr(t, 0.4 + (c.i % 64) * 0.006 + c.b * 0.1, 0.4); c.r.setAttribute('opacity', a * (c.real ? 0.95 : 0.85)); });
    s.padT.setAttribute('opacity', pr(t, 1.0, 0.6) * (1 - pr(t, 10.0, 0.5))); s.idxT.forEach((e) => e.setAttribute('opacity', pr(t, 10.5, 0.6)));
    s.setT.setAttribute('opacity', pr(t, 21.0, 0.6) * (1 - pr(t, 29.0, 0.5))); s.posT.setAttribute('opacity', pr(t, 29.5, 0.6)); s.pos.forEach((e) => e.setAttribute('opacity', pr(t, 31.0, 0.6)));
    s.trim.setAttribute('opacity', pr(t, 43.0, 0.7));
    // hand shuffle wobble while "set" line plays
    if (t > 21 && t < 29) s.cells.filter((c) => c.b === 0 && c.real && c.i >= 1 && c.i <= 7).forEach((c, k) => c.r.setAttribute('x', slotX(0, 1 + ((k + Math.floor((t - 21) * 1.2)) % 7)) + 0.8));
  },
};
