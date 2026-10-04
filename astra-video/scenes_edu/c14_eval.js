import { S, G, T, layer, E, pr, clamp, lerp, mix, rgba, hn, TH, header } from './common.js';
import { Matrix, Eq } from '../engine/edukit.js';

// ===================================================================== 14a: the protocol
export const protocol = {
  id: 'c14_protocol', title: 'How strength is measured', dur: 58, ch: 14, loc: 'search', mood: [TH.val, TH.hist, TH.grad],
  caps: [
    [0.5, 'Loss and accuracy are diagnostics. Strength is measured the only way that counts: by playing. Astra takes seat zero, with no search, against three AdvCPU bots.'],
    [16.0, 'Four equal players would each win a quarter of the time. But seat zero moves first and is at a disadvantage: even four identical AdvCPU bots give seat zero only twenty percent.'],
    [32.0, 'So twenty percent is the bar for matching AdvCPU. The teacher, ExpertCPU, wins forty-seven and a half percent against the same three opponents.'],
    [46.0, 'Astra after one epoch: zero wins in a hundred and fifty games. The scale is now clear: twenty percent to match, forty-seven and a half to match the teacher.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 14', title: 'Evaluation: win rate in seat 0', sub: 'Net (greedy, no search) vs 3 × AdvCPU', accent: TH.val });
    const seats = G(L); ['Astra', 'AdvCPU', 'AdvCPU', 'AdvCPU'].forEach((n, i) => { const x = 220 + i * 190; S('rect', { x: x - 80, y: 290, width: 160, height: 80, rx: 14, fill: rgba(i === 0 ? TH.val : TH.dim, 0.12), stroke: i === 0 ? TH.val : '#46607e', 'stroke-width': 2.2 }, seats); T(seats, n, { x, y: 326, size: 24, w: 700, fill: i === 0 ? TH.val : TH.dim, m: true }); T(seats, 'seat ' + i, { x, y: 396, size: 17, fill: TH.dim, m: true }); });
    const X0 = 1020, W = 700, Y0 = 760; const bars = [['equal players, naive', 25, TH.dim], ['AdvCPU in seat 0', 20, TH.pol], ['ExpertCPU vs 3 AdvCPU', 47.5, TH.hist], ['Astra, epoch 1', 0, TH.grad]].map(([n, v, c], i) => { const g = G(L); const y = 300 + i * 100; T(g, n, { x: X0 - 20, y: y + 28, size: 22, a: 'end', fill: c, m: true }); const r = S('rect', { x: X0, y, width: 0, height: 56, rx: 10, fill: rgba(c, 0.7) }, g); const l = T(g, '', { x: X0 + 10, y: y + 30, size: 28, a: 'start', w: 700, fill: TH.ink, m: true }); g.r = r; g.l = l; g.v = v; return g; });
    return { hd, seats, bars, X0, W };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.seats.setAttribute('opacity', pr(t, 1.0, 0.7));
    s.bars.forEach((g, i) => { const tt = [16, 20, 32, 46][i]; const a = pr(t, tt, 0.8, E.outQ4); g.setAttribute('opacity', pr(t, tt, 0.4)); const w = (s.W * g.v) / 50 * a; g.r.setAttribute('width', w); g.l.setAttribute('x', s.X0 + w + 10); g.l.textContent = a > 0.05 ? g.v + '%' : ''; });
  },
};

// ===================================================================== 14b: noise
const se = (p, n) => Math.sqrt((p * (1 - p)) / n) * 100;
export const noise = {
  id: 'c14_noise', title: 'Noise in win rates', dur: 56, ch: 14, loc: 'search', mood: [TH.val, TH.pol, TH.grad],
  caps: [
    [0.5, 'A win rate from a few games is noisy. Real measurements here: the same bot setup read fifteen and a half percent over two hundred games, and nineteen point six five over two thousand.'],
    [16.0, 'The uncertainty shrinks with the square root of the number of games. At 150 games a true twenty percent can easily read anywhere from fourteen to twenty-six.'],
    [32.0, 'At two thousand games the same true rate stays within about two points. Small improvements need big samples.'],
    [44.0, 'Zero wins in 150 games is still clear: if Astra truly won ten percent of games, zero in 150 would happen about one time in ten million.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 14', title: 'How many games is enough?', sub: 'True win rate 20% · 95% range of what you could measure', accent: TH.val });
    const X0 = 240, Y0 = 760, SX = 1300, SY = 18; const g = G(L);
    S('path', { d: `M${X0} ${Y0} H${X0 + SX}`, stroke: '#2b3b52', 'stroke-width': 2 }, g); S('path', { d: `M${X0} ${Y0} V${Y0 - 30 * SY * 0.9}`, stroke: '#2b3b52', 'stroke-width': 2 }, g);
    const ns = [50, 150, 600, 2000, 10000]; const lx = (n) => X0 + ((Math.log10(n) - 1.5) / 2.7) * SX * 0.92 + 40;
    const ty = (v) => Y0 - (v - 5) * 20 * 0.9 * 1.0;
    S('path', { d: `M${X0} ${ty(20)} H${X0 + SX}`, stroke: TH.pol, 'stroke-width': 2, 'stroke-dasharray': '7 7' }, g); T(g, 'true rate 20%', { x: X0 + 20, y: ty(20) - 16, size: 18, a: 'start', fill: TH.pol, m: true });
    const bars = ns.map((n) => { const half = 1.96 * se(0.2, n); const x = lx(n); const gg = G(g); S('path', { d: `M${x} ${ty(20 + half)} V${ty(20 - half)}`, stroke: TH.val, 'stroke-width': 5, 'stroke-linecap': 'round' }, gg); S('path', { d: `M${x - 14} ${ty(20 + half)} H${x + 14} M${x - 14} ${ty(20 - half)} H${x + 14}`, stroke: TH.val, 'stroke-width': 3 }, gg); T(gg, `±${half.toFixed(1)}`, { x: x + 26, y: ty(20 + half) - 8, size: 18, a: 'start', fill: TH.val, m: true }); T(gg, n.toLocaleString() + ' games', { x, y: Y0 + 32, size: 18, fill: TH.dim, m: true }); return gg; });
    const pts = G(g); [[200, 15.5], [2000, 19.65]].forEach(([n, v]) => { S('circle', { cx: lx(n), cy: ty(v), r: 9, fill: TH.pol, filter: 'url(#glow)' }, pts); T(pts, `${v}% (n=${n.toLocaleString()})`, { x: lx(n) - 18, y: ty(v) + 4, size: 17, a: 'end', fill: TH.pol, m: true }); });
    const z = T(L, '0 wins in 150: if the true rate were 10%, P = 0.9^150 ≈ 1 in 7,000,000', { x: 960, y: 860, size: 24, fill: TH.grad, m: true });
    return { hd, g, bars, pts, z };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.g.setAttribute('opacity', pr(t, 1.0, 0.6)); s.pts.setAttribute('opacity', pr(t, 3.0, 0.7));
    s.bars.forEach((b, i) => b.setAttribute('opacity', pr(t, 16.0 + i * 3.5, 0.6)));
    s.z.setAttribute('opacity', pr(t, 44.0, 0.7));
  },
};
