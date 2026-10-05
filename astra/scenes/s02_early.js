import { S, G, T, P, layer, C, E, pr, clamp, lerp, mix, rgba, bump, sbump, hn, rng, drawOn, fmt, curve, noise } from '../engine/core.js';
import { header, card, pill, stat, buildNet, xf, panel, arcPath, hbar } from '../engine/kit.js';

const eio = E.inOutC;

// shared: win-rate result tile drawn as a horizontal bar with parity tick
function resultBar(parent, { x, y, w = 640, color, label, inset = 14 }) {
  const g = G(parent);
  T(g, label, { x: 0, y: -52, size: 15, w: 700, fill: C.faint, ls: 2.4, caps: true, a: 'start' });
  S('rect', { x: 0, y: -26, width: w, height: 40, rx: 20, fill: '#0d1726', stroke: '#26354a', 'stroke-width': 1.2 }, g);
  const f = S('rect', { x: 0, y: -26, width: 0, height: 40, rx: 20, fill: color }, g);
  const px = (25 / 60) * w;
  S('path', { d: `M${px} -38 L${px} 26`, stroke: C.gold, 'stroke-width': 3, 'stroke-dasharray': '4 4' }, g);
  T(g, '25% parity', { x: px, y: 42, size: 15, w: 600, fill: C.gold, m: true });
  const v = T(g, '', { x: 0, y: 0, size: 22, w: 800, fill: '#07101c', m: true, a: 'end' });
  g.setAttribute('transform', `translate(${x} ${y})`);
  return { g, set(val, o = 1) { const ww = Math.max(40, (val / 60) * w); f.setAttribute('width', val <= 0 ? 0 : ww); v.setAttribute('x', ww - inset); v.setAttribute('y', -6); v.textContent = val <= 0 ? '' : val.toFixed(1) + '%'; g.setAttribute('opacity', o); g.style.display = o < 0.003 ? 'none' : ''; } };
}

// ===================================================================== v1
export const v1 = {
  id: 'v1', title: 'v1', dur: 30, ver: 1, mood: [C.cyan, C.blue, C.purple],
  caps: [
    [0.5, 'Generation one: a small *multilayer perceptron*. 96 numbers describing one snapshot go in.'],
    [5.6, 'Two heads come out. 35 abstract-action logits and one win probability. 128,164 parameters.'],
    [10.8, 'It starts by imitating a heuristic bot, then learns with *REINFORCE*.'],
    [14.2, 'Every action in a game is credited or blamed by the final result alone.'],
    [19.4, 'With 100+ decisions per game, a great play can be punished and a blunder rewarded.'],
    [25.0, 'Result: *24.5%*. Just under random.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Generation 1', title: 'The baseline', sub: '96-input MLP  ·  imitation, then REINFORCE', accent: C.cyan });
    const netG = G(L);
    const net = buildNet(netG, {
      yc: 500, gap: 34, labelY: 180, wireAlpha: 0.13, seed: 3, links: [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5]],
      cols: [
        { x: 230, n: 9, color: C.cyan, label: 'Features', sub: '96 floats' },
        { x: 480, n: 9, color: C.blue, label: 'Hidden 1', sub: '96 → 256 · ReLU' },
        { x: 730, n: 9, color: C.blue, label: 'Hidden 2', sub: '256 → 256 · ReLU' },
        { x: 980, n: 7, color: C.blue, label: 'Hidden 3', sub: '256 → 128 · ReLU' },
        { x: 1250, n: 7, gap: 24, yc: 410, stage: 4, color: C.purple, label: 'Policy', sub: '128 → 35 logits', labelY: 108 },
        { x: 1250, n: 1, yc: 650, stage: 4, color: C.gold, label: 'Value', sub: '128 → 1 · sigmoid', labelY: 50 },
      ],
    });
    const params = stat(L, { x: 330, y: 810, label: 'Parameters', color: C.cyan, w: 290, h: 112 });
    const win = stat(L, { x: 650, y: 810, label: 'Win rate', color: C.red, w: 290, h: 112, suffix: '%', dec: 1 });
    // REINFORCE panel
    const pg = panel(L, { w: 800, h: 470, kicker: 'REINFORCE', title: 'The same credit for every decision', color: C.red });
    const ticks = Array.from({ length: 36 }, (_, i) => {
      const r = S('rect', { x: -330 + i * 17.2, y: -16, width: 9, height: 56, rx: 4.5, fill: '#1c2a40' }, pg);
      return r;
    });
    const flagL = S('path', { d: 'M300 -40 L300 60 M300 -40 L350 -26 L300 -12', stroke: C.red, 'stroke-width': 3, fill: 'none' }, pg);
    const outT = T(pg, '', { x: 325, y: 82, size: 24, w: 800, fill: C.red, m: true });
    const note1 = T(pg, '', { x: 0, y: 150, size: 22, w: 500, fill: C.muted });
    const note2 = T(pg, '', { x: 0, y: 182, size: 22, w: 600, fill: C.text });
    const tagB = G(pg), tagG = G(pg);
    T(tagB, 'blunder', { x: 0, y: -50, size: 15, w: 700, fill: C.red, m: true }); S('path', { d: 'M0 -36 L0 -20', stroke: C.red, 'stroke-width': 2 }, tagB);
    T(tagG, 'brilliant play', { x: 0, y: -50, size: 15, w: 700, fill: C.gold, m: true }); S('path', { d: 'M0 -36 L0 -20', stroke: C.gold, 'stroke-width': 2 }, tagG);
    tagB.setAttribute('transform', `translate(${-330 + 11 * 17.2 + 4.5} 0)`); tagG.setAttribute('transform', `translate(${-330 + 24 * 17.2 + 4.5} 0)`);
    const res = resultBar(L, { x: 1050, y: 580, w: 740, color: C.red, label: 'result · 1 ML seat vs 3 AdvCPU' });
    const bigR = T(L, '', { x: 1430, y: 430, size: 150, w: 800, fill: C.red, ls: -6 });
    const subR = T(L, 'below the 25% parity line', { x: 1430, y: 530, size: 26, w: 500, fill: C.muted });
    return { hd, netG, net, params, win, pg, ticks, flagL, outT, note1, note2, tagB, tagG, res, bigR, subR };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.net.update(t, { start: 0.9, stag: 0.42, wave: 6.2, speed: 1.0, dim: 1 });
    const sh = eio(clamp((t - 10.4) / 1.3));
    xf(s.netG, { tx: lerp(0, -250, sh), ty: lerp(0, -10, sh), s: lerp(1, 0.72, sh), cx: 740, cy: 500 });
    const pc = lerp(0, 128164, E.outQ4(clamp((t - 2.2) / 3.3)));
    s.params.set(pc, pr(t, 1.6, 0.6, E.outBack), 1, 0); s.params.g.setAttribute('transform', `translate(${lerp(560, 330, sh)} ${lerp(800, 810, sh)}) scale(${pr(t, 1.6, 0.6, E.outBack)})`);
    s.win.set(24.5, pr(t, 25.6, 0.6, E.outBack) > 0.01 ? pr(t, 25.6, 0.6) : 0, 1, 0);
    s.win.g.setAttribute('transform', `translate(650 810) scale(${pr(t, 25.4, 0.6, E.outBack)})`);

    // REINFORCE panel
    const pp = pr(t, 11.2, 0.8, E.outQ4) * (1 - pr(t, 22.6, 0.6));
    P(s.pg, { x: 1430 + (1 - pr(t, 11.2, 0.8, E.outQ4)) * 80, y: 470, o: pp });
    const g1 = 14.0, g2 = 18.6; // game starts (local)
    const phase = t < g2 ? 0 : 1;
    const g0 = phase ? g2 : g1;
    const played = clamp((t - g0) / (36 * 0.045));
    const resolveT = g0 + 36 * 0.045 + 0.5;
    const rec = E.outC(clamp((t - resolveT) / 0.9));
    const col = phase ? C.green : C.red;
    s.ticks.forEach((r, i) => {
      const up = i / 36 < played;
      const tint = rec * (up ? 1 : 0);
      let fill = up ? mix('#2b4b6a', C.cyan, 0.5) : '#1c2a40';
      fill = mix(fill, col, tint);
      if (phase === 0 && i === 24) fill = mix(fill, C.gold, 0.8);
      if (phase === 1 && i === 11) fill = mix(fill, C.red, 0.9);
      r.setAttribute('fill', fill);
      r.setAttribute('height', up ? 56 : 30);
      r.setAttribute('y', up ? -16 : -3);
    });
    const showEnd = t > g0 + 36 * 0.045 ? 1 : 0;
    s.flagL.setAttribute('stroke', col); s.flagL.setAttribute('opacity', showEnd);
    s.outT.textContent = showEnd ? (phase ? 'WIN' : 'LOSS') : ''; s.outT.setAttribute('fill', col);
    s.note1.textContent = rec > 0.4 ? (phase ? 'return = +1 for all 36 decisions' : 'return = 0 for all 36 decisions') : '';
    s.note2.textContent = rec > 0.7 ? (phase ? '…including the blunder.' : '…including the brilliant play.') : '';
    s.note2.setAttribute('fill', phase ? C.red : C.gold);
    s.tagB.setAttribute('opacity', phase ? pr(t, g0 + 2.2, 0.4) : 0); s.tagG.setAttribute('opacity', phase ? 0 : pr(t, g0 + 2.2, 0.4));
    s.tagB.style.display = phase ? '' : 'none'; s.tagG.style.display = phase ? 'none' : '';
    // result
    const rr = pr(t, 23.4, 0.8, E.outQ4);
    s.res.set(lerp(0, 24.5, E.outQ4(clamp((t - 24.0) / 1.4))), rr);
    s.bigR.textContent = (lerp(0, 24.5, E.outQ4(clamp((t - 24.0) / 1.4)))).toFixed(1) + '%'; s.bigR.setAttribute('opacity', rr);
    s.subR.setAttribute('opacity', pr(t, 25.6, 0.6));
  },
};

// ===================================================================== v2
export const v2 = {
  id: 'v2', title: 'v2', dur: 28, ver: 2, mood: [C.blue, C.cyan, C.purple],
  caps: [
    [0.4, 'Generation two: four layers with *residual skips*, so gradients survive the depth.'],
    [4.4, 'Eight derived flags join the input, like am I leading. That is 196,004 parameters.'],
    [9.6, 'The real change: before RL, the *value head is pretrained* on wins and losses.'],
    [14.6, 'Now advantage is return minus a real baseline. Expected wins barely move the policy. Surprises move it a lot.'],
    [22.0, 'That one addition took the win rate from 24.5% to about *45%*.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Generation 2', title: 'Skips and a value baseline', sub: 'Residual MLP  ·  104 inputs  ·  value pretraining', accent: C.blue });
    const netG = G(L);
    const net = buildNet(netG, {
      yc: 520, gap: 34, labelY: 175, wireAlpha: 0.12, seed: 5, links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [4, 6]],
      skips: [[1, 2, C.purple], [2, 3, C.purple]],
      cols: [
        { x: 200, n: 9, color: C.cyan, label: 'Features', sub: '104 floats' },
        { x: 440, n: 9, color: C.blue, label: 'Hidden 1', sub: '104 → 256' },
        { x: 680, n: 9, color: C.blue, label: 'Hidden 2', sub: '256 → 256 + skip' },
        { x: 920, n: 9, color: C.blue, label: 'Hidden 3', sub: '256 → 256 + skip' },
        { x: 1160, n: 7, color: C.blue, label: 'Hidden 4', sub: '256 → 128' },
        { x: 1400, n: 7, gap: 24, yc: 430, stage: 5, color: C.purple, label: 'Policy', sub: '128 → 35', labelY: 108 },
        { x: 1400, n: 1, yc: 670, stage: 5, color: C.gold, label: 'Value', sub: '128 → 1', labelY: 50 },
      ],
    });
    // +8 derived flags callout
    const flag = G(netG);
    S('rect', { x: 176, y: 520 + 4 * 34 - 16, width: 48, height: 32, rx: 10, fill: 'none', stroke: C.gold, 'stroke-width': 2.4, 'stroke-dasharray': '5 4' }, flag);
    const flagT = T(flag, '+8 derived', { x: 162, y: 520 + 4 * 34, size: 16, w: 700, fill: C.gold, m: true, a: 'end' });
    const params = stat(L, { x: 330, y: 810, label: 'Parameters', color: C.blue, w: 290, h: 112 });
    const delta = pill(L, '+67,840', { x: 520, y: 740, color: C.gold, size: 17 });
    const win = stat(L, { x: 650, y: 810, label: 'Win rate', color: C.green, w: 290, h: 112, suffix: '%', dec: 1, prefix: '~' });
    // advantage panel
    const pg = panel(L, { w: 800, h: 480, kicker: 'Value pretraining', title: 'advantage = return − V(state)', color: C.blue });
    const rows = [0, 1].map((i) => {
      const g = G(pg); g.setAttribute('transform', `translate(0 ${-30 + i * 150})`);
      const vV = i === 0 ? 0.8 : 0.2, adv = 1 - vV;
      T(g, i === 0 ? 'Already winning, and wins' : 'Looks lost, but wins', { x: -360, y: -48, size: 21, w: 600, a: 'start' });
      S('rect', { x: -360, y: -22, width: 320, height: 22, rx: 11, fill: '#0d1726', stroke: '#26354a' }, g);
      const vb = S('rect', { x: -360, y: -22, width: 0, height: 22, rx: 11, fill: C.blue }, g);
      T(g, 'V = ' + vV.toFixed(2), { x: -360, y: 20, size: 15, w: 600, fill: C.blue, a: 'start', m: true });
      T(g, 'return = 1.00', { x: -40, y: 20, size: 15, w: 600, fill: C.cyan, a: 'end', m: true });
      T(g, '→', { x: 30, y: -11, size: 30, w: 500, fill: C.faint });
      S('rect', { x: 80, y: -22, width: 280, height: 22, rx: 11, fill: '#0d1726', stroke: '#26354a' }, g);
      const ab = S('rect', { x: 80, y: -22, width: 0, height: 22, rx: 11, fill: i === 0 ? C.faint : C.green }, g);
      const at = T(g, '', { x: 80, y: 20, size: 17, w: 800, a: 'start', m: true, fill: i === 0 ? C.muted : C.green });
      g.vb = vb; g.ab = ab; g.at = at; g.vV = vV; g.adv = adv; return g;
    });
    const msg = T(pg, '', { x: 0, y: 200, size: 21, w: 550, fill: C.muted });
    const res = resultBar(L, { x: 1050, y: 800, w: 740, color: C.green, label: 'result · 1 ML seat vs 3 AdvCPU' });
    return { hd, netG, net, flag, flagT, params, delta, win, pg, rows, msg, res };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.net.update(t, { start: 0.7, stag: 0.3, wave: 5.0, speed: 1.0, skipAt: 2.6 });
    const sh = eio(clamp((t - 10.2) / 1.3));
    xf(s.netG, { tx: lerp(0, -268, sh), ty: lerp(0, -20, sh), s: lerp(1, 0.72, sh), cx: 800, cy: 520 });
    s.flag.setAttribute('opacity', pr(t, 3.4, 0.6) * (1 - 0));
    const pc = t < 4.6 ? 128164 : lerp(128164, 196004, E.inOutC(clamp((t - 4.6) / 1.8)));
    const pp = pr(t, 1.2, 0.6, E.outBack);
    s.params.set(pc, 1, 1); s.params.g.setAttribute('transform', `translate(${lerp(560, 330, sh)} ${lerp(800, 810, sh)}) scale(${pp})`);
    P(s.delta, { x: lerp(830, 540, sh), y: lerp(720, 740, sh), s: pr(t, 5.2, 0.5, E.outBack), o: pr(t, 5.2, 0.4) * (1 - pr(t, 9.8, 0.4)) });
    s.win.set(45, pr(t, 22.4, 0.6) > 0.01 ? 1 : 0, 1); s.win.g.setAttribute('transform', `translate(650 810) scale(${pr(t, 22.4, 0.6, E.outBack)})`);
    const pg = pr(t, 10.6, 0.8, E.outQ4);
    P(s.pg, { x: 1430 + (1 - pg) * 80, y: 440, o: pg * (1 - pr(t, 20.8, 0.5)) });
    s.rows.forEach((g, i) => {
      const k = 12.4 + i * 3.2;
      g.vb.setAttribute('width', 320 * g.vV * pr(t, k, 0.8, E.outQ4));
      g.ab.setAttribute('width', 280 * g.adv * pr(t, k + 1.3, 0.8, E.outQ4));
      g.at.textContent = pr(t, k + 1.3, 0.3) > 0.05 ? (i === 0 ? '+0.20  small nudge' : '+0.80  big surprise') : '';
      g.setAttribute('opacity', pr(t, k - 0.2, 0.4));
    });
    s.msg.textContent = t > 18.6 ? 'low-variance, well-aimed gradients' : '';
    s.msg.setAttribute('opacity', pr(t, 18.6, 0.5));
    const rr = pr(t, 21.2, 0.8, E.outQ4);
    s.res.set(lerp(0, 45, E.outQ4(clamp((t - 21.8) / 1.5))), rr);
    s.res.g.setAttribute('transform', 'translate(1050 640)');
  },
};

// ===================================================================== v3
export const v3 = {
  id: 'v3', title: 'v3', dur: 28, ver: 3, mood: [C.purple, C.gold, C.cyan],
  caps: [
    [0.4, 'Generation three keeps the same 196,004-parameter network. What changes is how it learns.'],
    [5.0, '*PPO* clips the policy ratio at plus or minus 0.2, a trust region around the data-collecting policy.'],
    [10.6, '*Shaped rewards* add small signals: +0.10 for completing a system, +0.15 for crossing three, −0.05 when an opponent completes one.'],
    [17.0, 'A *snapshot pool* of ten past selves keeps opponents diverse.'],
    [22.4, 'Result: *43.8%* over 500 games. Within noise of v2, so the gain was not real yet.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Generation 3', title: 'PPO, shaping and a pool', sub: 'Same network  ·  better training around it', accent: C.purple });
    const thumb = card(L, { w: 330, h: 92, kicker: 'Network (unchanged)', title: 'Residual MLP', shape: '196,004 params' , accent: C.blue });
    // PPO panel
    const p1 = panel(L, { w: 540, h: 470, kicker: 'PPO', title: 'Clipped policy ratio', color: C.purple });
    const ax = G(p1); ax.setAttribute('transform', 'translate(0 40)');
    const X0 = -220, X1 = 220, Y0 = 130, Y1 = -110;
    const rx = (r) => lerp(X0, X1, (r - 0.4) / 1.2), ly = (v) => lerp(Y0, Y1, (v + 0.1) / 1.3);
    S('rect', { x: rx(0.8), y: Y1 - 20, width: rx(1.2) - rx(0.8), height: Y0 - Y1 + 20, fill: rgba(C.purple, 0.12) }, ax);
    S('path', { d: `M${X0} ${Y0} L${X1} ${Y0} M${X0} ${Y0} L${X0} ${Y1 - 20}`, stroke: '#3a4d66', 'stroke-width': 2, fill: 'none' }, ax);
    T(ax, '0.8', { x: rx(0.8), y: Y0 + 22, size: 14, m: true, fill: C.faint }); T(ax, '1.2', { x: rx(1.2), y: Y0 + 22, size: 14, m: true, fill: C.faint }); T(ax, 'ratio π_new / π_old', { x: 0, y: Y0 + 48, size: 15, m: true, fill: C.muted });
    const curveP = S('path', { d: `M${rx(0.4)} ${ly(0.4)} L${rx(1.2)} ${ly(1.2)} L${rx(1.6)} ${ly(1.2)}`, stroke: C.purple, 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', filter: 'url(#glow)' }, ax);
    const dot = S('circle', { r: 9, fill: '#fff', filter: 'url(#glow)' }, ax);
    const gradT = T(ax, '', { x: rx(1.4), y: ly(1.2) - 30, size: 17, w: 700, m: true, fill: C.gold });
    // rewards panel
    const p2 = panel(L, { w: 540, h: 470, kicker: 'Shaped rewards', title: 'Denser feedback', color: C.gold });
    const rw = G(p2); rw.setAttribute('transform', 'translate(0 40)');
    const events = [['complete a system', '+0.10', C.green], ['cross 3 complete', '+0.15', C.cyan], ['opponent completes', '−0.05', C.red]];
    const evs = events.map(([n, v, c], i) => { const g = G(rw); g.setAttribute('transform', `translate(0 ${-90 + i * 92})`); S('rect', { x: -230, y: -34, width: 460, height: 68, rx: 14, fill: '#0b1320', stroke: '#26354a' }, g); const ring = S('circle', { cx: -190, cy: 0, r: 17, fill: 'none', stroke: c, 'stroke-width': 3, 'stroke-dasharray': '0 200', transform: 'rotate(-90 -190 0)' }, g); S('circle', { cx: -190, cy: 0, r: 5, fill: c }, g); T(g, n, { x: -150, y: 0, size: 21, w: 550, a: 'start' }); const vt = T(g, v, { x: 205, y: 0, size: 28, w: 800, a: 'end', m: true, fill: c }); g.ring = ring; g.vt = vt; g.c = c; return g; });
    const sumT = T(rw, '', { x: 0, y: 160, size: 20, w: 600, m: true, fill: C.muted });
    // pool panel
    const p3 = panel(L, { w: 540, h: 470, kicker: 'Snapshot pool', title: 'Play against past selves', color: C.cyan });
    const pool = G(p3); pool.setAttribute('transform', 'translate(0 20)');
    const learner = G(pool); S('circle', { r: 36, fill: rgba(C.cyan, 0.15), stroke: C.cyan, 'stroke-width': 3, filter: 'url(#glow)' }, learner); T(learner, 'NOW', { size: 17, w: 800, fill: C.cyan, m: true }); learner.setAttribute('transform', 'translate(0 -80)');
    const snaps = Array.from({ length: 10 }, (_, i) => { const g = G(pool); const cx = -200 + (i % 5) * 100, cy = 40 + Math.floor(i / 5) * 86; S('rect', { x: -38, y: -28, width: 76, height: 56, rx: 11, fill: '#0b1320', stroke: '#33506a', 'stroke-width': 1.6 }, g); T(g, 'it ' + (i + 1) * 20, { size: 15, w: 600, m: true, fill: C.muted }); g.setAttribute('transform', `translate(${cx} ${cy})`); g.cx = cx; g.cy = cy; return g; });
    const links = snaps.map((sn) => S('path', { d: `M0 -80 C0 -20 ${sn.cx} -20 ${sn.cx} ${sn.cy - 28}`, stroke: C.cyan, 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' }, pool));
    const poolT = T(pool, '', { x: 0, y: 190, size: 19, w: 600, m: true, fill: C.muted });
    const res = resultBar(L, { x: 590, y: 812, w: 740, color: C.purple, label: 'result · 500 games, ±2–3 pts noise', inset: 44 });
    // error whisker on result
    const whisk = G(res.g); const wx = (43.8 / 60) * 740;
    S('path', { d: `M${wx - 31} -6 L${wx + 31} -6 M${wx - 31} -16 L${wx - 31} 4 M${wx + 31} -16 L${wx + 31} 4`, stroke: '#fff', 'stroke-width': 2.6, 'stroke-linecap': 'round' }, whisk);
    return { hd, thumb, p1, p2, p3, curveP, dot, gradT, evs, sumT, snaps, links, poolT, res, whisk, learner };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    const k = pr(t, 0.8, 0.7, E.outBack);
    P(s.thumb, { x: 1620, y: 150, s: k, o: k });
    // panels
    [[s.p1, 380, 3.8], [s.p2, 960, 10.0], [s.p3, 1540, 16.4]].forEach(([p, x, t0]) => { const q = pr(t, t0 - 0.3, 0.8, E.outQ4); P(p, { x, y: 480 + (1 - q) * 70, o: q }); });
    // PPO dot
    const r = 1 + 0.55 * Math.sin((t - 5) * 0.9) + 0.0;
    const rr = clamp(0.5 + 0.5 * ((t - 5.0) / 3.0), 0.5, 0) + 0; // unused
    const rv = lerp(0.55, 1.5, E.inOutSine((((t - 5.0) * 0.33) % 2) > 1 ? 2 - (((t - 5.0) * 0.33) % 2) : ((t - 5.0) * 0.33) % 2));
    const X0 = -220, X1 = 220, Y0 = 130, Y1 = -110; const rx = (q) => lerp(X0, X1, (q - 0.4) / 1.2), ly = (v) => lerp(Y0, Y1, (v + 0.1) / 1.3);
    const obj = Math.min(rv, 1.2);
    s.dot.setAttribute('cx', rx(rv)); s.dot.setAttribute('cy', ly(obj)); s.dot.setAttribute('opacity', pr(t, 4.6, 0.4));
    s.gradT.textContent = rv > 1.2 ? 'gradient = 0' : ''; s.gradT.setAttribute('opacity', rv > 1.2 ? 1 : 0);
    drawOn(s.curveP, pr(t, 4.2, 1.2, E.outQ));
    // events cycling
    s.evs.forEach((g, i) => {
      const a = 11.2 + i * 1.7;
      g.setAttribute('opacity', pr(t, a - 0.3, 0.4));
      const f = pr(t, a, 0.8, E.outQ);
      g.ring.setAttribute('stroke-dasharray', `${f * 107} 200`);
      g.vt.setAttribute('opacity', pr(t, a + 0.5, 0.3)); g.vt.setAttribute('transform', `translate(0 ${(1 - E.outBack(clamp((t - a - 0.5) / 0.5))) * -14})`);
    });
    s.sumT.textContent = t > 16.4 ? 'small vs the final ±1.0' : ''; s.sumT.setAttribute('opacity', pr(t, 16.4, 0.5));
    // pool picks: every 1.4s choose 3 snapshots
    const slot = Math.floor((t - 17.6) / 1.4);
    s.snaps.forEach((sn, i) => {
      const picked = t > 17.6 && [0, 1, 2].some((j) => Math.floor(hn(slot, j, 5) * 10) === i);
      const f = t > 17.6 ? sbump(((t - 17.6) % 1.4), 0.55, 0.7) : 0;
      sn.firstChild.setAttribute('stroke', picked ? mix('#33506a', C.cyan, f) : '#33506a');
      sn.firstChild.setAttribute('fill', picked ? mix('#0b1320', '#12353c', f) : '#0b1320');
      s.links[i].setAttribute('opacity', picked ? f : 0);
    });
    s.snaps.forEach((sn, i) => { const q = pr(t, 16.9 + i * 0.07, 0.5, E.outBack); sn.setAttribute('opacity', q); });
    s.poolT.textContent = t > 20.0 ? '50%: 1 learner vs 3 pool  ·  50%: 4 learners' : ''; s.poolT.setAttribute('opacity', pr(t, 20.0, 0.5));
    const rr2 = pr(t, 22.0, 0.8, E.outQ4);
    s.res.set(lerp(0, 43.8, E.outQ4(clamp((t - 22.4) / 1.5))), rr2);
    s.whisk.setAttribute('opacity', pr(t, 24.2, 0.5));
  },
};
