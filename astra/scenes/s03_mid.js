import { S, G, T, P, layer, C, E, pr, clamp, lerp, mix, rgba, bump, sbump, hn, rng, drawOn, travel, fmt, curve, noise } from '../engine/core.js';
import { header, card, pill, stat, buildNet, xf, panel, arcPath, hbar } from '../engine/kit.js';

const eio = E.inOutC;

/** win-rate line chart inside a panel group. pts: [{l,v,c}] */
function winChart(parent, { w = 640, h = 300, pts, ymin = 15, ymax = 50, parity = true, hollow = [] }) {
  const g = G(parent);
  const x = (i) => -w / 2 + 40 + (i * (w - 80)) / (pts.length - 1), y = (v) => lerp(h / 2, -h / 2, (v - ymin) / (ymax - ymin));
  for (let v = ymin; v <= ymax; v += 5) { S('path', { d: `M${-w / 2} ${y(v)} L${w / 2} ${y(v)}`, stroke: '#1a2a40', 'stroke-width': 1 }, g); T(g, v + '%', { x: -w / 2 - 10, y: y(v), size: 14, m: true, fill: C.faint, a: 'end' }); }
  if (parity) { S('path', { d: `M${-w / 2} ${y(25)} L${w / 2} ${y(25)}`, stroke: C.gold, 'stroke-width': 2, 'stroke-dasharray': '6 6' }, g); T(g, 'parity 25%', { x: w / 2, y: y(25) + 16, size: 14, m: true, fill: C.gold, a: 'end' }); }
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)} ${y(p.v)}`).join(' ');
  const line = S('path', { d, fill: 'none', stroke: 'url(#gcp)', 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', filter: 'url(#glow)' }, g);
  const dots = pts.map((p, i) => { const q = G(g); S('circle', { r: 11, fill: hollow.includes(i) ? '#0b1320' : p.c, stroke: p.c, 'stroke-width': 3 }, q); T(q, p.v.toFixed(1) + '%', { x: 0, y: -28, size: 20, w: 750, fill: p.c, m: true }); T(g, p.l, { x: x(i), y: h / 2 + 30, size: 16, w: 650, fill: C.muted, m: true }); q.setAttribute('transform', `translate(${x(i)} ${y(p.v)})`); return q; });
  const lens = []; let acc = 0; for (let i = 1; i < pts.length; i++) { acc += Math.hypot(x(i) - x(i - 1), y(pts[i].v) - y(pts[i - 1].v)); lens.push(acc); }
  line.__len = acc;
  return {
    g,
    set(u) { // u in 0..pts.length-1
      const seg = clamp(u / (pts.length - 1));
      drawOn(line, seg);
      dots.forEach((q, i) => { const p = pr(u, i - 0.05, 0.3, E.outBack); q.setAttribute('opacity', p); q.firstChild.setAttribute('r', 11 * p); q.style.display = p < 0.01 ? 'none' : ''; });
    },
  };
}

// ===================================================================== v4
export const v4 = {
  id: 'v4', title: 'v4', dur: 30, ver: 4, mood: [C.red, C.purple, C.gold],
  caps: [
    [0.4, 'Generation four adds a *candidate head*: a tiny network that scores concrete options.'],
    [5.2, 'The policy picks the kind of play. The candidate head picks which card, which target, which discard.'],
    [10.4, 'But RL started while that head was still *random*.'],
    [14.4, 'Every discard, target and decide in self-play became noise, and the training signal rotted.'],
    [20.2, 'The win rate fell from 43.8% to *26.6%*, back near random.'],
    [25.4, 'Lesson: never run a randomly initialised head in the hot path.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Generation 4', title: 'The candidate head', sub: 'Score each concrete option  ·  200,933 parameters', accent: C.red });
    const body = card(L, { w: 270, h: 110, kicker: 'Trunk output', title: 'Body', shape: '128 floats', accent: C.cyan });
    const opt = card(L, { w: 270, h: 110, kicker: 'One option', title: 'Option features', shape: '24 floats · card, system, slot', accent: C.gold, size: 21 });
    const net = buildNet(L, {
      yc: 520, gap: 30, labelY: 150, wireAlpha: 0.2, seed: 11,
      cols: [
        { x: 540, n: 9, color: C.purple, label: 'Concat', sub: '152' },
        { x: 740, n: 7, color: C.purple, label: 'Hidden', sub: 'Linear 152 → 32 · ReLU' },
        { x: 940, n: 1, color: C.pink, label: 'Score', sub: 'Linear 32 → 1', labelY: 70 },
      ],
    });
    const w1 = S('path', { d: curve(385, 400, 540, 475, 0.6), stroke: C.cyan, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, L);
    const w2 = S('path', { d: curve(385, 620, 540, 565, 0.6), stroke: C.gold, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, L);
    const rnd = pill(L, 'RANDOM WEIGHTS', { x: 740, y: 340, color: C.red, size: 17, h: 34 });
    const noise = G(L); const bars = Array.from({ length: 5 }, (_, i) => S('rect', { x: 972 + i * 14, y: 0, width: 9, height: 10, rx: 3, fill: C.red }, noise));
    const noiseT = T(noise, 'noisy scores', { x: 1002, y: 470, size: 14, m: true, fill: C.red });
    const chips = ['discard', 'pick target', 'decide', 'concrete play'].map((s, i) => pill(L, s, { x: 0, y: 0, color: [C.cyan, C.gold, C.purple, C.blue][i], size: 15 }));
    const params = stat(L, { x: 330, y: 810, label: 'Parameters', color: C.red, w: 290, h: 112 });
    const delta = pill(L, '+4,929 candidate head', { x: 640, y: 810, color: C.pink, size: 16, w: 250 });
    const pg = panel(L, { w: 780, h: 520, kicker: 'Win rate', title: 'What the random head did', color: C.red });
    const ch = G(pg); ch.setAttribute('transform', 'translate(10 40)');
    const chart = winChart(ch, { w: 640, h: 300, ymin: 20, ymax: 50, pts: [{ l: 'v2', v: 45, c: C.blue }, { l: 'v3', v: 43.8, c: C.purple }, { l: 'v4', v: 26.6, c: C.red }] });
    const note = T(pg, '', { x: 0, y: -135, size: 21, w: 550, fill: C.red });
    return { hd, body, opt, net, w1, w2, rnd, noise, bars, chips, params, delta, pg, chart, note };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    P(s.body, { x: 250, y: 400, s: pr(t, 1.0, 0.7, E.outBack), o: pr(t, 1.0, 0.5) });
    P(s.opt, { x: 250, y: 620, s: pr(t, 1.4, 0.7, E.outBack), o: pr(t, 1.4, 0.5) });
    drawOn(s.w1, pr(t, 2.2, 0.9, E.outQ)); drawOn(s.w2, pr(t, 2.4, 0.9, E.outQ));
    s.net.update(t, { start: 2.6, stag: 0.5, wave: 6.0, speed: 0.9 });
    // random flicker after 10.4
    if (t > 10.4) {
      const fr = Math.floor(t * 9);
      [1, 2].forEach((ci) => s.net.cols[ci].nodes.forEach((n, i) => { const h = hn(fr, ci, i); n.setAttribute('fill', mix('#1a0f1c', C.red, h)); n.setAttribute('stroke', mix(C.purple, C.red, h > 0.5 ? 0.9 : 0.2)); }));
    }
    P(s.rnd, { x: 740, y: 350, s: pr(t, 10.4, 0.5, E.outBack), o: pr(t, 10.4, 0.4) });
    s.chips.forEach((c, i) => { const q = pr(t, 6.0 + i * 0.35, 0.5, E.outBack); const base = [[540, 760], [700, 760], [860, 760], [1040, 760]][i]; P(c, { x: 640 + i * 170 + (i === 3 ? 20 : 0), y: 745, s: q, o: q }); });
    const nz = pr(t, 14.0, 0.5);
    s.noise.setAttribute('opacity', nz);
    s.bars.forEach((b, i) => { const h = 12 + hn(Math.floor(t * 8), i, 3) * 70; b.setAttribute('height', h); b.setAttribute('y', 552 - h); });
    const pp = pr(t, 1.8, 0.6, E.outBack);
    s.params.set(lerp(196004, 200933, E.inOutC(clamp((t - 4.0) / 1.4))), 1, 1); s.params.g.setAttribute('transform', `translate(330 810) scale(${pp})`);
    P(s.delta, { x: 640, y: 810, s: pr(t, 5.0, 0.5, E.outBack), o: pr(t, 5.0, 0.4) });
    const pg = pr(t, 15.8, 0.9, E.outQ4);
    // chart panel occupies the right side but slides in over the diagram's right half
    P(s.pg, { x: 1440 + (1 - pg) * 90, y: 520, o: pg });
    s.chart.set(clamp((t - 17.2) / 1.2) * 1 + clamp((t - 19.6) / 1.4) * 1);
    s.note.textContent = t > 22.4 ? 'RL on random sub-decisions: near random again' : '';
    s.note.setAttribute('opacity', pr(t, 22.4, 0.5));
    // dim the diagram while the chart is up
    const dim = 1 - 0.55 * pr(t, 15.8, 0.8);
    [s.body, s.opt].forEach((e) => { if (pg > 0.01) e.setAttribute('opacity', dim); });
  },
};

// ===================================================================== v5
export const v5 = {
  id: 'v5', title: 'v5', dur: 31, ver: 5, mood: [C.green, C.cyan, C.blue],
  caps: [
    [0.4, 'Generation five keeps the v4 network and fixes the *schedule* around it.'],
    [4.4, 'Fifteen thousand imitation games, 4.26 million samples, then 50 epochs of behaviour cloning.'],
    [10.0, 'Next the candidate head is pretrained *alone*, body frozen. Then the value head.'],
    [15.6, 'Only then does PPO start, with GAE blending one-step and Monte Carlo returns.'],
    [21.0, 'AdvancedCpuPlayer stays in the opponent pool at 30%, so self-play is never only against weak snapshots.'],
    [26.4, 'The finished win rate was never recorded. The aim: *45 to 55%*.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Generation 5', title: 'Fix the schedule', sub: 'Same network  ·  correct pretraining order  ·  GAE  ·  AdvCPU in the pool', accent: C.green });
    const names = [['01', 'Generate', '15,000 AdvCPU games', C.cyan], ['02', 'Imitate', '50 epochs', C.blue], ['03', 'Candidate', '30 epochs · body frozen', C.pink], ['04', 'Value', '20 epochs', C.gold], ['05', 'PPO + GAE', '300 iters × 2,000 games', C.green]];
    const st = names.map(([k, ti, su, col], i) => {
      const g = G(L); const w = 316, h = 330;
      S('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 18, fill: 'url(#surface)', stroke: '#2c3e55', 'stroke-width': 1.4, filter: 'url(#soft)' }, g);
      const hl = S('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 18, fill: 'none', stroke: col, 'stroke-width': 2.6, opacity: 0 }, g);
      T(g, k, { x: -w / 2 + 24, y: -h / 2 + 36, size: 30, w: 800, fill: col, m: true, a: 'start', ls: -1 });
      T(g, ti, { x: -w / 2 + 24, y: -h / 2 + 80, size: 29, w: 680, a: 'start', ls: -0.5 });
      T(g, su, { x: -w / 2 + 24, y: -h / 2 + 112, size: 16.5, w: 450, a: 'start', fill: C.muted });
      const m = G(g); m.setAttribute('transform', `translate(0 ${h / 2 - 90})`);
      g.hl = hl; g.m = m; g.col = col; return g;
    });
    // minis
    const gridCards = Array.from({ length: 15 }, (_, i) => { const r = S('rect', { x: -110 + (i % 5) * 46, y: -64 + Math.floor(i / 5) * 38, width: 34, height: 30, rx: 6, fill: rgba(C.cyan, 0.2), stroke: C.cyan, 'stroke-width': 1.6 }, st[0].m); return r; });
    const cntT = T(st[0].m, '', { x: 0, y: 68, size: 23, w: 750, fill: C.cyan, m: true });
    const lossP = S('path', { d: 'M-120 -50 C-80 -48 -60 10 -10 28 S60 40 120 42', fill: 'none', stroke: C.blue, 'stroke-width': 4, 'stroke-linecap': 'round', filter: 'url(#glow)' }, st[1].m);
    const lossT = T(st[1].m, 'cross-entropy ↓', { x: 0, y: 62, size: 17, m: true, fill: C.blue });
    // frozen body + candidate
    S('rect', { x: -120, y: -48, width: 120, height: 72, rx: 12, fill: '#10243a', stroke: '#33506a', 'stroke-width': 2 }, st[2].m); T(st[2].m, 'BODY', { x: -60, y: -12, size: 17, w: 700, m: true, fill: '#7aa0c2' });
    const lock = G(st[2].m); S('rect', { x: -9, y: -4, width: 18, height: 14, rx: 3, fill: '#7aa0c2' }, lock); S('path', { d: 'M-5 -4 V-9 a5 5 0 0 1 10 0 V-4', stroke: '#7aa0c2', 'stroke-width': 2.6, fill: 'none' }, lock); lock.setAttribute('transform', 'translate(-60 14)');
    const candBox = S('rect', { x: 20, y: -48, width: 100, height: 72, rx: 12, fill: rgba(C.pink, 0.15), stroke: C.pink, 'stroke-width': 2.6 }, st[2].m); T(st[2].m, 'CAND', { x: 70, y: -12, size: 17, w: 700, m: true, fill: C.pink });
    T(st[2].m, 'only these layers train', { x: 0, y: 52, size: 16, m: true, fill: C.muted });
    S('rect', { x: -120, y: -48, width: 120, height: 72, rx: 12, fill: '#10243a', stroke: '#33506a', 'stroke-width': 2 }, st[3].m); T(st[3].m, 'BODY', { x: -60, y: -12, size: 17, w: 700, m: true, fill: '#7aa0c2' });
    const valBox = S('rect', { x: 20, y: -48, width: 100, height: 72, rx: 12, fill: rgba(C.gold, 0.15), stroke: C.gold, 'stroke-width': 2.6 }, st[3].m); T(st[3].m, 'VALUE', { x: 70, y: -12, size: 17, w: 700, m: true, fill: C.gold });
    T(st[3].m, 'win-probability head', { x: 0, y: 52, size: 16, m: true, fill: C.muted });
    const loop = S('path', { d: arcPath(-50, -6, 44, -2.4, 3.0), fill: 'none', stroke: C.green, 'stroke-width': 5, 'stroke-linecap': 'round' }, st[4].m); const loopH = S('path', { d: 'M-12 -34 L-28 -48 L-14 -54', fill: 'none', stroke: C.green, 'stroke-width': 4.5 }, st[4].m);
    const pie = G(st[4].m); pie.setAttribute('transform', 'translate(74 -6)'); S('circle', { r: 36, fill: '#0d1726', stroke: '#33506a', 'stroke-width': 2 }, pie); const wedge = S('path', { d: `M0 0 L0 -36 A36 36 0 0 1 ${36 * Math.sin(0.3 * 6.283)} ${-36 * Math.cos(0.3 * 6.283)}z`, fill: C.gold }, pie); T(st[4].m, 'AdvCPU 30%', { x: 74, y: 52, size: 15, m: true, fill: C.gold });
    const arrows = [0, 1, 2, 3].map(() => S('path', { d: 'M0 0', fill: 'none', stroke: '#4a6680', 'stroke-width': 3, 'stroke-dasharray': '8 8' }, L));
    const token = S('circle', { r: 10, fill: '#fff', filter: 'url(#glow2)' }, L);
    // knobs row
    const knobs = ['GAE  λ = 0.95', 'clip 0.2 · 4 passes', 'entropy 0.01', 'AdvCPU 30% of opponents'].map((s2, i) => pill(L, s2, { x: 0, y: 0, color: [C.green, C.purple, C.cyan, C.gold][i], size: 17, h: 36 }));
    // verdict
    const verd = G(L); S('rect', { x: -420, y: -42, width: 840, height: 84, rx: 18, fill: '#0b1320', stroke: C.gold, 'stroke-width': 2, 'stroke-dasharray': '8 6' }, verd);
    T(verd, 'Final win rate: not recorded', { x: -390, y: -10, size: 28, w: 680, a: 'start', fill: C.gold }); T(verd, 'target  45–55%   ·   minimum hope: recover v3’s 43.8%', { x: -390, y: 24, size: 19, w: 450, a: 'start', fill: C.muted, m: true });
    return { hd, st, gridCards, cntT, lossP, lock, candBox, valBox, loop, loopH, wedge, arrows, token, knobs, verd };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    const xs = [220, 590, 960, 1330, 1700].map((x, i) => x - 40 + i * 0);
    const X = [225, 585, 945, 1305, 1665];
    s.st.forEach((g, i) => {
      const p = pr(t, 1.0 + i * 0.28, 0.7, E.outQ4);
      P(g, { x: X[i], y: 470 + (1 - p) * 60, o: p });
    });
    s.arrows.forEach((a, i) => { const x1 = X[i] + 170, x2 = X[i + 1] - 170; a.setAttribute('d', `M${x1} 470 L${x2} 470`); a.__len = x2 - x1; a.style.strokeDashoffset = -t * 24; a.setAttribute('opacity', pr(t, 2.4 + i * 0.3, 0.5)); });
    // active stage schedule
    const bounds = [1.6, 4.4, 10.0, 12.8, 15.6, 31];
    let act = 0; for (let i = 0; i < 5; i++) if (t >= bounds[i]) act = i;
    const A = t < 1.6 ? -1 : t < 4.4 ? 0 : t < 7.4 ? 1 : t < 10.0 ? 1 : t < 12.8 ? 2 : t < 15.6 ? 3 : 4;
    s.st.forEach((g, i) => { g.hl.setAttribute('opacity', A === i ? 0.7 + 0.3 * Math.sin(t * 4) : 0); });
    // token travels
    const tk = clamp((t - 1.6) / 14.0);
    const tx = lerp(X[0], X[4], tk), pulse = 1 + 0.2 * Math.sin(t * 8);
    s.token.setAttribute('cx', tx); s.token.setAttribute('cy', 470 + 150 * 0); s.token.setAttribute('r', 8 * pulse); s.token.setAttribute('opacity', pr(t, 1.4, 0.4) * (1 - pr(t, 16.5, 0.6)));
    s.token.setAttribute('cy', 470 - 180);
    // minis
    const gp = clamp((t - 1.8) / 2.4);
    s.gridCards.forEach((r, i) => r.setAttribute('opacity', clamp(gp * 16 - i, 0, 1)));
    s.cntT.textContent = fmt(15000 * E.outQ(gp)) + ' games';
    drawOn(s.lossP, pr(t, 4.6, 3.0, E.inOutC));
    s.lock.setAttribute('opacity', pr(t, 10.2, 0.4));
    s.candBox.setAttribute('stroke-opacity', 0.6 + 0.4 * Math.sin(t * 5));
    s.valBox.setAttribute('stroke-opacity', 0.6 + 0.4 * Math.sin(t * 5));
    s.loop.setAttribute('transform', `rotate(${t * 90 % 360} -50 -6)`); s.loopH.setAttribute('transform', `rotate(${t * 90 % 360} -50 -6)`);
    s.knobs.forEach((k, i) => { const q = pr(t, 16.0 + i * 0.4, 0.5, E.outBack); P(k, { x: 300 + i * 440 - (i === 3 ? 20 : 0) + (i === 1 ? -20 : 0), y: 710, s: q, o: q }); });
    const v = pr(t, 26.6, 0.8, E.outQ4);
    P(s.verd, { x: 960, y: 820 + (1 - v) * 30, o: v });
  },
};

// ===================================================================== v6 architecture
export const v6a = {
  id: 'v6a', title: 'v6 architecture', dur: 28, ver: 6, mood: [C.blue, C.purple, C.cyan],
  caps: [
    [0.4, 'Generation six gives the network memory: the last *three snapshots*, 162 floats each.'],
    [4.8, 'Each snapshot adds recent plays, which flares, fractures and supernovas opponents have shown, and the discard pile.'],
    [10.0, 'Concatenated, that is 486 numbers into a *512-wide* residual trunk.'],
    [15.2, 'Policy shrinks to 31 abstract actions. The candidate head widens from 32 to 128 hidden units.'],
    [21.0, '*1.07 million* parameters, then 1.12 million: over five times v5.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Generation 6', title: 'Memory and width', sub: '3 stacked snapshots · 512-wide trunk · 31 actions', accent: C.blue });
    const snaps = [0, 1, 2].map((i) => {
      const g = G(L); const w = 360, h = 110;
      S('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 14, fill: 'url(#surface)', stroke: i === 2 ? C.cyan : '#33506a', 'stroke-width': i === 2 ? 2.2 : 1.4, filter: 'url(#soft)' }, g);
      T(g, ['snapshot  t − 2', 'snapshot  t − 1', 'snapshot  t'][i], { x: -w / 2 + 18, y: -h / 2 + 24, size: 16, w: 650, a: 'start', fill: i === 2 ? C.cyan : C.muted, m: true });
      const segs = [[104, C.blue], [20, C.gold], [9, C.pink], [29, C.purple]]; let sx = -w / 2 + 18; const sw = w - 36;
      const rs = segs.map(([n, c]) => { const ww = (n / 162) * sw; const r = S('rect', { x: sx, y: 4, width: ww - 2, height: 38, rx: 6, fill: c, opacity: 0.85 }, g); sx += ww; return r; });
      T(g, '162 floats', { x: w / 2 - 18, y: -h / 2 + 24, size: 16, w: 650, a: 'end', fill: C.faint, m: true });
      g.rs = rs; return g;
    });
    const legend = [[C.blue, '104', 'base snapshot: hand, charts, opponents'], [C.gold, '20', 'last plays, 4 seats × 5 categories'], [C.pink, '9', 'opponent has played flare / fracture / supernova'], [C.purple, '29', 'discard pile counts']].map(([c, n, d], i) => { const g = G(L); S('rect', { x: -10, y: -10, width: 20, height: 20, rx: 5, fill: c }, g); T(g, n, { x: 26, y: 0, size: 20, w: 750, a: 'start', fill: c, m: true }); T(g, d, { x: 80, y: 0, size: 17, w: 450, a: 'start', fill: C.muted }); g.setAttribute('transform', `translate(100 ${690 + i * 32})`); return g; });
    const cat = S('path', { d: 'M470 470 C560 470 600 470 680 470', stroke: C.cyan, 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', filter: 'url(#glow)' }, L);
    const catT = pill(L, 'concat → 486', { x: 592, y: 420, color: C.cyan, size: 16 });
    const net = buildNet(L, {
      yc: 440, gap: 30, labelY: 150, wireAlpha: 0.11, seed: 9, skips: [[2, 3, C.purple], [3, 4, C.purple]],
      links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [4, 6], [4, 7]],
      cols: [
        { x: 700, n: 9, color: C.cyan, label: 'Input', sub: '486' },
        { x: 880, n: 9, color: C.blue, label: 'Layer 1', sub: '486 → 512' },
        { x: 1060, n: 9, color: C.blue, label: 'Layer 2', sub: '512 + skip' },
        { x: 1240, n: 9, color: C.blue, label: 'Layer 3', sub: '512 + skip' },
        { x: 1420, n: 9, color: C.blue, label: 'Layer 4', sub: '512' },
        { x: 1680, n: 6, gap: 22, yc: 335, stage: 5, color: C.purple, label: 'Policy · 31', sub: '512 → 31', labelY: 78 },
        { x: 1680, n: 1, yc: 510, stage: 5, color: C.gold, label: 'Value', sub: '512 → 1', labelY: 40 },
        { x: 1680, n: 4, gap: 22, yc: 668, stage: 5, color: C.pink, label: 'Candidate', sub: '536 → 32 → 1', labelY: 62 },
      ],
    });
    const wide = G(L); S('rect', { x: 1628, y: 668 - 46, width: 104, height: 92, rx: 12, fill: 'none', stroke: C.pink, 'stroke-width': 2.4, 'stroke-dasharray': '6 5' }, wide);
    const wideT = T(L, '32 → 128 hidden', { x: 1680, y: 800, size: 17, w: 700, m: true, fill: C.pink });
    const params = stat(L, { x: 330, y: 560, label: 'Parameters', color: C.blue, w: 290, h: 112 });
    return { hd, snaps, legend, cat, catT, net, wide, wideT, params };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.snaps.forEach((g, i) => {
      const p = pr(t, 0.8 + i * 0.35, 0.8, E.outQ4);
      const merge = eio(clamp((t - 8.6) / 1.2));
      P(g, { x: lerp(300 + i * 40, 290, merge * 0), y: lerp(330 + i * 70, 330 + i * 70, 1) - 0 + (1 - p) * 40, o: p });
      g.setAttribute('transform', `translate(${262 + i * 36} ${330 + i * 70 + (1 - p) * 40})`);
      g.rs.forEach((r, k) => { const q = pr(t, 4.8 + k * 0.7, 0.5); r.setAttribute('opacity', 0.3 + 0.7 * q); });
    });
    s.legend.forEach((g, i) => { const q = pr(t, 4.8 + i * 0.7, 0.5); g.setAttribute('opacity', q); g.firstChild.setAttribute('transform', `scale(${lerp(0.4, 1, q)})`); });
    drawOn(s.cat, pr(t, 9.8, 0.9, E.outQ)); P(s.catT, { x: 592, y: 420, s: pr(t, 10.0, 0.5, E.outBack), o: pr(t, 10.0, 0.4) });
    s.net.update(t, { start: 10.4, stag: 0.32, wave: 15.0, speed: 1.0, skipAt: 12.6 });
    s.wide.setAttribute('opacity', pr(t, 16.8, 0.5)); s.wideT.setAttribute('opacity', pr(t, 16.8, 0.5));
    s.wide.firstChild.setAttribute('transform', `translate(0 ${0}) `);
    const pp = pr(t, 11.0, 0.7, E.outBack);
    const pc = t < 21 ? lerp(0, 1070945, E.outQ4(clamp((t - 12.0) / 6.0))) : lerp(1070945, 1122593, E.inOutC(clamp((t - 21.4) / 2.0)));
    s.params.set(pc, 1, 1); s.params.g.setAttribute('transform', `translate(330 590) scale(${pp})`);
  },
};

// ===================================================================== v6 results
export const v6b = {
  id: 'v6b', title: 'v6 results', dur: 40, ver: 6, mood: [C.purple, C.gold, C.blue],
  caps: [
    [0.4, 'The loop changes too: *AlphaZero*-style. Search improves the policy, and the network learns from the search.'],
    [6.0, 'The visit-count distribution at each decision becomes a soft target: a dense signal, not one distant win.'],
    [12.4, 'Behaviour cloning alone reached 16.2%. PPO reached 35.8%. Gentle AlphaZero reached *38.7%*, or 42.0% with AdvCPU on sub-decisions.'],
    [21.0, 'Then it stalled. Three follow-up runs could not beat it, and exploration noise poisoned the visit targets.'],
    [28.0, 'Meanwhile a pure heuristic bot, *ExpertCpu*, scored 47.5%.'],
    [33.0, 'No learning at all, and it beat the best network by almost nine points, as first measured.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Generation 6', title: 'AlphaZero, then a plateau', sub: 'Verified 1000-game evals, 1 ML seat vs 3x AdvCPU', accent: C.purple });
    // --- loop diagram
    const lp = G(L);
    const ring = S('ellipse', { cx: 560, cy: 520, rx: 330, ry: 175, fill: 'none', stroke: '#33506a', 'stroke-width': 3, 'stroke-dasharray': '10 10' }, lp);
    const nodes = [['Self-play', 'MCTS at every decision', C.cyan, 0], ['Visit counts', 'soft policy target', C.gold, 1], ['Train', 'KL to the visit dist.', C.purple, 2], ['Better net', 'stronger search next lap', C.green, 3]].map(([ti, su, col, i]) => {
      const a = (i / 4) * Math.PI * 2 - Math.PI / 2; const g = card(lp, { w: 270, h: 92, title: ti, sub: su, accent: col, size: 22 }); g.setAttribute('transform', `translate(${560 + Math.cos(a) * 330} ${520 + Math.sin(a) * 175})`); g.col = col; g.a = a; return g;
    });
    const orb = S('circle', { r: 9, fill: '#fff', filter: 'url(#glow2)' }, lp);
    // visit distribution (centre)
    const dist = G(lp); dist.setAttribute('transform', 'translate(560 520)');
    const raw = [0.34, 0.2, 0.18, 0.14, 0.09, 0.05], vis = [0.08, 0.62, 0.1, 0.12, 0.05, 0.03];
    const dbars = raw.map((r, i) => { const g = G(dist); const b0 = S('rect', { x: -78 + i * 28, y: 0, width: 10, height: 0, rx: 3, fill: '#4a6680' }, g); const b1 = S('rect', { x: -66 + i * 28 + 0, y: 0, width: 10, height: 0, rx: 3, fill: C.cyan }, g); g.b0 = b0; g.b1 = b1; return g; });
    T(dist, 'prior  vs  visits', { x: 0, y: 66, size: 14, m: true, fill: C.faint });
    // --- results
    const rp = panel(L, { w: 920, h: 470, kicker: 'v6 verified results', title: 'Win rate vs 3x AdvCPU', color: C.purple });
    T(rp, 'full-ML', { x: 120, y: -190, size: 16, w: 700, m: true, fill: C.cyan, a: 'end' }); T(rp, 'hybrid', { x: 230, y: -190, size: 16, w: 700, m: true, fill: C.purple, a: 'end' });
    const rows = [['BC only', 16.2, 21.8], ['PPO best', 35.8, 41.4], ['AZ final', 38.7, 42.0]].map(([nm, a, b], i) => {
      const g = G(rp); g.setAttribute('transform', `translate(40 ${-50 + i * 92})`);
      T(g, nm, { x: -420, y: 0, size: 22, w: 600, a: 'start' });
      const mk = (y, col, v) => { S('rect', { x: -250, y, width: 640, height: 28, rx: 14, fill: '#0d1726', stroke: '#26354a' }, g); const f = S('rect', { x: -250, y, width: 0, height: 28, rx: 14, fill: col }, g); const tt = T(g, '', { x: 0, y: y + 14, size: 17, w: 750, a: 'end', m: true, fill: '#07101c' }); return { f, tt, v }; };
      g.A = mk(-34, C.cyan, a); g.B = mk(4, C.purple, b); return g;
    });
    const par = S('path', { d: `M${-250 + 40 + (25 / 60) * 640} -150 L${-250 + 40 + (25 / 60) * 640} 150`, stroke: C.gold, 'stroke-width': 2.4, 'stroke-dasharray': '5 5' }, rp);
    // expert bar
    const ex = G(rp); ex.setAttribute('transform', 'translate(40 200)');
    T(ex, 'ExpertCpu', { x: -420, y: 0, size: 22, w: 700, a: 'start', fill: C.gold });
    S('rect', { x: -250, y: -14, width: 640, height: 34, rx: 17, fill: '#0d1726', stroke: '#26354a' }, ex); const exf = S('rect', { x: -250, y: -14, width: 0, height: 34, rx: 17, fill: 'url(#gpg)', filter: 'url(#glow)' }, ex); const exT = T(ex, '', { x: 0, y: 3, size: 19, w: 800, a: 'end', m: true, fill: '#07101c' });
    // failures
    const fl = G(L); const fails = ['Repeat the recipe', 'Value-leaf sims', 'Exploration (ε = 0.25)'].map((s2, i) => { const g = G(fl); S('rect', { x: -250, y: -26, width: 500, height: 52, rx: 12, fill: '#150d16', stroke: rgba(C.red, 0.5) }, g); T(g, '✕', { x: -224, y: 0, size: 26, w: 800, fill: C.red }); T(g, s2, { x: -190, y: 0, size: 21, w: 550, a: 'start' }); T(g, ['no gain', 'worse', '38.7 → ~28'][i], { x: 232, y: 0, size: 18, w: 700, a: 'end', fill: C.red, m: true }); g.setAttribute('transform', `translate(0 ${i * 66})`); return g; });
    fl.setAttribute('transform', 'translate(1410 560)');
    const call = G(L); T(call, '+8.8 pts', { x: 0, y: 0, size: 110, w: 800, fill: C.gold, ls: -4 }); T(call, 'a heuristic bot beat the best network', { x: 0, y: 84, size: 24, w: 500, fill: C.muted }); T(call, 'ExpertCpu 47.5% ± 0.9  vs  v6 38.7%', { x: 0, y: 124, size: 20, w: 600, fill: C.gold, m: true }); T(call, '(a later 2,000-game re-test measured 39.6%)', { x: 0, y: 160, size: 16, w: 500, fill: C.red, m: true }); call.setAttribute('transform', 'translate(1410 520)');
    const flT = T(L, 'three follow-ups, none beat 38.7%', { x: 1410, y: 484, size: 20, w: 600, fill: C.muted });
    return { hd, lp, nodes, ring, orb, dbars, raw, vis, rp, rows, par, ex, exf, exT, fl, fails, flT, call };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    // loop phase
    const loopOut = pr(t, 11.6, 0.8);
    s.lp.setAttribute('opacity', pr(t, 0.4, 0.8) * (1 - loopOut));
    s.lp.style.display = loopOut >= 0.999 ? 'none' : '';
    s.nodes.forEach((g, i) => P(g, { x: 560 + Math.cos(g.a) * 330, y: 520 + Math.sin(g.a) * 175, s: pr(t, 0.8 + i * 0.4, 0.7, E.outBack), o: pr(t, 0.8 + i * 0.4, 0.5) }));
    const ang = -Math.PI / 2 + (t * 0.7);
    s.orb.setAttribute('cx', 560 + Math.cos(ang) * 330); s.orb.setAttribute('cy', 520 + Math.sin(ang) * 175);
    s.dbars.forEach((g, i) => {
      const m = eio(clamp((t - 6.2) / 2.0)); const h0 = s.raw[i] * 140, h1 = lerp(s.raw[i], s.vis[i], m) * 140;
      const p = pr(t, 4.6 + i * 0.08, 0.6, E.outQ4);
      g.b0.setAttribute('height', h0 * p); g.b0.setAttribute('y', -h0 * p + 40); g.b1.setAttribute('height', h1 * p); g.b1.setAttribute('y', -h1 * p + 40);
    });
    // results panel
    const rpP = pr(t, 12.0, 0.8, E.outQ4);
    const rpOut = pr(t, 20.6, 0.6);
    P(s.rp, { x: 560 + (1 - rpP) * 120, y: 500, o: rpP });
    s.rows.forEach((g, i) => {
      const k = 13.2 + i * 2.4;
      [['A', C.cyan], ['B', C.purple]].forEach(([key], j) => {
        const bar = g[key]; const p = E.outQ4(clamp((t - k - j * 0.3) / 1.0)); const w = (bar.v / 60) * 640 * p;
        bar.f.setAttribute('width', Math.max(0, w)); bar.tt.setAttribute('x', -250 + Math.max(w, 60) - 12); bar.tt.textContent = p > 0.02 ? (bar.v * p).toFixed(1) + '%' : '';
      });
    });
    // fails + expert
    s.fl.setAttribute('opacity', 1);
    s.fails.forEach((g, i) => { const q = pr(t, 21.4 + i * 0.7, 0.6, E.outBack); P(g, { x: 0, y: i * 66, s: 1, o: q }); g.setAttribute('transform', `translate(${(1 - q) * 80} ${i * 66})`); });
    s.flT.setAttribute('opacity', pr(t, 21.0, 0.5));
    const eq = E.outQ4(clamp((t - 28.6) / 1.6));
    s.ex.setAttribute('opacity', pr(t, 28.0, 0.5)); s.exf.setAttribute('width', 640 * (47.5 / 60) * eq); s.exT.setAttribute('x', -250 + Math.max(60, 640 * (47.5 / 60) * eq) - 12); s.exT.textContent = eq > 0.02 ? (47.5 * eq).toFixed(1) + '%' : '';
    // panel stays; failures panel fades out when expert appears
    const outF = pr(t, 27.6, 0.6);
    s.call.setAttribute('opacity', pr(t, 31.0, 0.8, E.outQ4)); const cq = pr(t, 31.0, 0.8, E.outBack); s.call.setAttribute('transform', `translate(1410 ${520 + (1 - cq) * 40})`);
    s.fl.setAttribute('opacity', 1 - outF); s.flT.setAttribute('opacity', pr(t, 21.0, 0.5) * (1 - outF));
  },
};
