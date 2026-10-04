import { S, G, T, P, layer, C, E, pr, clamp, lerp, mix, rgba, bump, sbump, hn, rng, drawOn, travel, fmt, curve, noise } from '../engine/core.js';
import { header, card, pill, stat, buildNet, xf, panel, arcPath, hbar, glyphs } from '../engine/kit.js';

const eio = E.inOutC;
const ORANGE = '#ff9f6b';

// ===================================================================== TEACHER CEILING
export const teacher = {
  id: 'teacher', title: 'The teacher ceiling', dur: 36, ver: 7, mood: [C.gold, C.green, C.cyan],
  caps: [
    [0.4, 'Behaviour cloning has a hard ceiling: a perfect clone of a policy *is* that policy.'],
    [5.6, 'AdvCPU wins 20.0% from seat 0. After two epochs the clone already sat at 19.6%, with nothing left to gain.'],
    [12.4, 'So the teacher switched to *ExpertCpu*, documented at 47.5%, though about 325 times slower per game.'],
    [19.6, 'But the clone plateaued at *22.9%* after six epochs. ExpertCpu agrees with its own choices only about 76% of the time.'],
    [28.0, 'A later 2,000-game re-test of ExpertCpu itself measured *39.6%*. That gap is still unresolved.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Astra-7 · training', title: 'BC is bounded by its teacher', sub: 'seat-0 win rate vs 3x AdvCPU, 1000-game evals', accent: C.gold });
    const base = 800, H = 450, sc = (v) => (v / 50) * H;
    S('path', { d: `M130 ${base} L1180 ${base}`, stroke: '#3a4d66', 'stroke-width': 2 }, L);
    for (const v of [10, 20, 30, 40, 50]) { S('path', { d: `M130 ${base - sc(v)} L1180 ${base - sc(v)}`, stroke: '#1a2a40', 'stroke-width': 1 }, L); T(L, v + '%', { x: 108, y: base - sc(v), size: 14, m: true, fill: C.faint, a: 'end' }); }
    const cols = [['AdvCPU', 'teacher', 20.0, C.blue, 240], ['BC clone', '2 epochs', 19.6, C.cyan, 450], ['ExpertCpu', 'documented', 47.5, C.gold, 700], ['BC clone', 'ExpertCpu, 6 epochs', 22.9, C.orange || ORANGE, 930]].map(([nm, sub, v, col, x]) => {
      const g = G(L); const b = S('rect', { x: x - 70, y: base, width: 140, height: 0, rx: 14, fill: col, opacity: 0.92 }, g); const val = T(g, '', { x, y: 0, size: 30, w: 800, fill: col, m: true }); T(g, nm, { x, y: base + 34, size: 21, w: 650 }); T(g, sub, { x, y: base + 62, size: 14.5, w: 450, fill: C.muted, m: true });
      g.b = b; g.val = val; g.v = v; g.x = x; return g;
    });
    const ceil1 = S('path', { d: `M130 ${base - sc(20)} L560 ${base - sc(20)}`, stroke: C.red, 'stroke-width': 3, 'stroke-dasharray': '10 8' }, L);
    const ceil1T = T(L, 'ceiling', { x: 568, y: base - sc(20) - 16, size: 17, m: true, fill: C.red, a: 'start' });
    const ceil2 = S('path', { d: `M590 ${base - sc(47.5)} L1100 ${base - sc(47.5)}`, stroke: C.gold, 'stroke-width': 3, 'stroke-dasharray': '10 8' }, L);
    const retest = G(L); S('path', { d: `M600 ${base - sc(39.55)} L1100 ${base - sc(39.55)}`, stroke: C.red, 'stroke-width': 3, 'stroke-dasharray': '4 6' }, retest); T(retest, 're-test 39.6%', { x: 1100, y: base - sc(39.55) - 16, size: 17, w: 700, m: true, fill: C.red, a: 'end' });
    const arrow = S('path', { d: `M320 ${base - 140} L380 ${base - 140}`, stroke: C.cyan, 'stroke-width': 3, 'marker-end': 'url(#arr)', fill: 'none' }, L);
    const sp = panel(L, { w: 520, h: 520, kicker: 'Cost of the better teacher', title: 'Game generation speed', color: C.pink });
    const b1 = G(sp); T(b1, 'AdvCPU', { x: -230, y: -60, size: 20, a: 'start' }); S('rect', { x: -230, y: -40, width: 460, height: 26, rx: 13, fill: '#0d1726', stroke: '#26354a' }, b1); const f1 = S('rect', { x: -230, y: -40, width: 0, height: 26, rx: 13, fill: C.blue }, b1); T(b1, '~909 games/s', { x: 230, y: -60, size: 17, m: true, a: 'end', fill: C.blue });
    const b2 = G(sp); T(b2, 'ExpertCpu', { x: -230, y: 20, size: 20, a: 'start' }); S('rect', { x: -230, y: 40, width: 460, height: 26, rx: 13, fill: '#0d1726', stroke: '#26354a' }, b2); const f2 = S('rect', { x: -230, y: 40, width: 0, height: 26, rx: 13, fill: C.gold }, b2); T(b2, '~2.8 games/s', { x: 230, y: 20, size: 17, m: true, a: 'end', fill: C.gold });
    const x325 = T(sp, '', { x: 0, y: 140, size: 84, w: 800, fill: C.pink, ls: -3 }); const cheap = T(sp, '', { x: 0, y: 208, size: 21, w: 550, fill: C.muted });
    const noisy = G(L); noisy.setAttribute('transform', 'translate(1530 640)'); S('rect', { x: -260, y: -48, width: 520, height: 96, rx: 16, fill: '#0b1320', stroke: C.red, 'stroke-width': 2 }, noisy); T(noisy, 'self-agreement of ExpertCpu: ~76%', { x: 0, y: -12, size: 20, w: 650, fill: C.text }); T(noisy, 'a noisy label: val accuracy 65.7 → 68.7%', { x: 0, y: 22, size: 17, m: true, fill: C.muted });
    return { hd, cols, ceil1, ceil1T, ceil2, retest, arrow, sp, f1, f2, x325, cheap, noisy };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    const base = 800, H = 450, sc = (v) => (v / 50) * H;
    s.cols.forEach((g, i) => {
      const k = [1.2, 5.8, 13.0, 20.0][i]; const p = E.outQ4(clamp((t - k) / 1.4)); const h = sc(g.v) * p;
      g.b.setAttribute('height', h); g.b.setAttribute('y', base - h); g.val.setAttribute('y', base - h - 26); g.val.textContent = p > 0.02 ? (g.v * p).toFixed(1) + '%' : '';
      g.setAttribute('opacity', pr(t, k - 0.1, 0.3));
    });
    drawOn(s.ceil1, pr(t, 3.0, 1.0, E.outQ)); s.ceil1T.setAttribute('opacity', pr(t, 3.6, 0.5));
    drawOn(s.ceil2, pr(t, 14.4, 1.0, E.outQ)); s.ceil2.setAttribute('opacity', pr(t, 14.4, 0.3));
    s.retest.setAttribute('opacity', pr(t, 28.4, 0.6) * (0.6 + 0.4 * Math.sin(t * 3)));
    s.arrow.setAttribute('opacity', pr(t, 5.0, 0.5));
    const sp = pr(t, 12.8, 0.8, E.outQ4) * (1 - pr(t, 19.0, 0.6)); P(s.sp, { x: 1530 + (1 - pr(t, 12.8, 0.8, E.outQ4)) * 80, y: 520, o: sp });
    s.f1.setAttribute('width', 460 * E.outQ4(clamp((t - 14.0) / 1.2))); s.f2.setAttribute('width', Math.max(4, 460 * (2.8 / 909)) * E.outQ4(clamp((t - 14.4) / 1.2)));
    s.x325.textContent = t > 15.4 ? '325×' : ''; s.x325.setAttribute('opacity', pr(t, 15.4, 0.5));
    s.cheap.textContent = t > 16.6 ? 'slower, but cheap per epoch' : ''; s.cheap.setAttribute('opacity', pr(t, 16.6, 0.5));
    const nq = pr(t, 21.4, 0.8, E.outQ4); P(s.noisy, { x: 1530 + (1 - nq) * 80, y: 520, o: nq });
  },
};

// ===================================================================== PIPELINE (actual status)
export const pipeline = {
  id: 'pipeline', title: 'Pipeline status', dur: 40, ver: 7, mood: [C.cyan, C.purple, C.red],
  caps: [
    [0.4, 'Astra-7 trains in three stages, each guarded by a *gate*.'],
    [4.6, 'Behaviour cloning on ExpertCpu was stopped at epoch six. Win rate stayed between 19 and 23 percent: under the 25% gate.'],
    [12.0, 'TD-value then *failed its gate twice*: 50.8%, then 44.8%, against a required 65%. Pure chance is about 39.'],
    [19.4, 'The fix is built: unfreeze the trunk at a lower learning rate, anchor the policy, and mix AdvCPU seats into self-play. It has not run on real data yet.'],
    [28.6, 'The AlphaZero league is fully coded and tested, but has never run for real.'],
    [34.6, 'The goal stays *55 to 65%* against three AdvCPUs.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Astra-7 · training', title: 'BC → TD-value → AlphaZero', sub: 'Where each stage actually is', accent: C.cyan });
    const defs = [
      ['01', 'Behaviour cloning', C.cyan, ['teacher: ExpertCpu (search-based)', 'val accuracy 65.7% → 68.7%', 'win rate 14.2 → 22.9% (n = 1000)', 'stopped at epoch 6: plateau'], 'GATE  ≥ 25%   ✕ not met', 'fail'],
      ['02', 'TD-value', C.gold, ['λ = 0.9, 3 passes  →  50.8%', 'λ = 1.0, 1 pass  →  44.8%', 'chance 38.8% · untrained net 44.3%', 'next: unfreeze trunk, lr 1e-4'], 'GATE  value-rank ≥ 65%   ✕ ×2', 'fail'],
      ['03', 'AlphaZero league', C.purple, ['≥ 400 sims · PUCT c = 1.5', 'Dirichlet ε 0.25, α = 10 / n_legal', 'batched inference, 26 tests green', 'code done · never run for real'], 'GATE  beat 38.7% in 30 iters   (locked)', 'lock'],
    ];
    const cards = defs.map(([k, ti, col, lines, gate, st], i) => {
      const g = G(L); const w = 540, h = 410;
      S('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 20, fill: 'url(#surface)', stroke: '#2c3e55', 'stroke-width': 1.4, filter: 'url(#soft)' }, g);
      const hl = S('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 20, fill: 'none', stroke: col, 'stroke-width': 2.6, opacity: 0 }, g);
      T(g, k, { x: -w / 2 + 28, y: -h / 2 + 42, size: 34, w: 800, fill: col, m: true, a: 'start', ls: -1 }); T(g, ti, { x: -w / 2 + 96, y: -h / 2 + 42, size: 32, w: 680, a: 'start', ls: -0.6 });
      lines.forEach((ln, j) => { S('circle', { cx: -w / 2 + 36, cy: -h / 2 + 106 + j * 48, r: 5, fill: col }, g); T(g, ln, { x: -w / 2 + 56, y: -h / 2 + 106 + j * 48, size: 20.5, w: 480, a: 'start', fill: '#c6d3e3' }); });
      const gt = G(g); gt.setAttribute('transform', `translate(0 ${h / 2 - 50})`);
      const box = S('rect', { x: -w / 2 + 22, y: -26, width: w - 44, height: 52, rx: 14, fill: '#0b1320', stroke: '#33506a', 'stroke-width': 1.8, 'stroke-dasharray': '6 5' }, gt);
      const gtxt = T(gt, gate, { x: -w / 2 + 44, y: 0, size: 17, w: 650, a: 'start', m: true, fill: C.muted });
      g.hl = hl; g.box = box; g.gtxt = gtxt; g.st = st; g.col = col; return g;
    });
    const ar = [0, 1].map(() => S('path', { d: 'M0 0', stroke: '#4a6680', 'stroke-width': 3, 'stroke-dasharray': '8 8', fill: 'none', 'marker-end': 'url(#arr)' }, L));
    const goal = G(L); S('rect', { x: -360, y: -38, width: 720, height: 76, rx: 18, fill: '#0b1320', stroke: C.green, 'stroke-width': 2.4 }, goal); T(goal, 'Goal  55–65%  vs 3x AdvCPU', { x: 0, y: -6, size: 32, w: 700, fill: C.green }); T(goal, 'v6 plateau 38.7%  ·  Astra-7 BC so far 22.9%', { x: 0, y: 24, size: 17, m: true, fill: C.muted });
    return { hd, cards, ar, goal };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    const X = [330, 960, 1590];
    s.cards.forEach((g, i) => { const p = pr(t, 0.9 + i * 0.4, 0.8, E.outQ4); P(g, { x: X[i], y: 490 + (1 - p) * 70, o: p }); });
    s.ar.forEach((a, i) => { a.setAttribute('d', `M${X[i] + 280} 490 L${X[i + 1] - 290} 490`); a.style.strokeDashoffset = -t * 24; a.setAttribute('opacity', pr(t, 2.4 + i * 0.3, 0.5)); });
    const A = t < 4.6 ? -1 : t < 12.0 ? 0 : t < 19.4 ? 1 : t < 28.6 ? 1 : t < 34.6 ? 2 : 3;
    s.cards.forEach((g, i) => {
      g.hl.setAttribute('opacity', A === i ? 0.6 + 0.4 * Math.sin(t * 4) : 0);
      const reveal = [[9.4], [17.0], [31.0]][i][0]; const u = pr(t, reveal, 0.5, E.outBack);
      const col = g.st === 'fail' ? C.red : C.faint;
      g.box.setAttribute('stroke', u > 0.4 ? col : '#33506a'); g.box.setAttribute('stroke-dasharray', u > 0.4 && g.st === 'fail' ? '' : '6 5');
      g.gtxt.setAttribute('fill', u > 0.4 ? col : C.muted);
      g.box.setAttribute('fill', u > 0.4 && g.st === 'fail' ? '#1a0d14' : '#0b1320');
    });
    const gq = pr(t, 34.6, 0.8, E.outBack); P(s.goal, { x: 960, y: 810, s: gq, o: gq });
  },
};

// ===================================================================== STANDING
export const standing = {
  id: 'standing', title: 'Where it stands', dur: 44, ver: 7, mood: [C.cyan, C.purple, C.gold],
  caps: [
    [0.4, 'Here is the whole climb, using only numbers the docs actually record.'],
    [5.0, 'An early jump, a plateau near 45, then a crash from one random head.'],
    [12.0, 'The v5 win rate was never recorded. The neural network plateaued at *38.7%* in v6.'],
    [18.6, 'ExpertCpu is documented at 47.5%, though a fresh 2,000-game test measured *39.6%*. That gap is unresolved.'],
    [27.4, 'Astra-7’s behaviour cloning reached 22.9% and stalled. TD-value failed its gate. The rest is built but unproven.'],
    [36.6, 'The target is still *55 to 65%* against three AdvCPUs.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'The full picture', title: 'Win rate across seven generations', sub: '1 ML seat vs 3x AdvCPU · only recorded numbers', accent: C.cyan });
    const X0 = 190, X1 = 1760, Y0 = 800, Y1 = 270, vmin = 15, vmax = 70;
    const y = (v) => lerp(Y0, Y1, (v - vmin) / (vmax - vmin));
    for (let v = 20; v <= 70; v += 10) { S('path', { d: `M${X0} ${y(v)} L${X1} ${y(v)}`, stroke: '#18273b', 'stroke-width': 1 }, L); T(L, v + '%', { x: X0 - 16, y: y(v), size: 15, m: true, fill: C.faint, a: 'end' }); }
    const labels = [['v1', 'REINFORCE'], ['v2', 'value baseline'], ['v3', 'PPO + pool'], ['v4', 'random head'], ['v5', 'schedule fix'], ['v6', 'AlphaZero'], ['Expert', 'heuristic'], ['v7 BC', 'transformer'], ['v7', 'target']];
    const xs = labels.map((_, i) => X0 + 70 + i * ((X1 - X0 - 140) / 8));
    labels.forEach(([a, b], i) => { T(L, a, { x: xs[i], y: Y0 + 34, size: 21, w: 700, m: true, fill: i === 6 ? C.gold : i >= 7 ? C.green : C.text }); T(L, b, { x: xs[i], y: Y0 + 62, size: 14, w: 450, fill: C.muted }); });
    S('path', { d: `M${X0} ${y(25)} L${X1} ${y(25)}`, stroke: C.gold, 'stroke-width': 2, 'stroke-dasharray': '6 7' }, L); T(L, 'parity 25%', { x: X1, y: y(25) + 18, size: 14, m: true, fill: C.gold, a: 'end' });
    const real = [[0, 24.5], [1, 45], [2, 43.8], [3, 26.6]];
    const lineA = S('path', { d: real.map((p, i) => `${i ? 'L' : 'M'}${xs[p[0]]} ${y(p[1])}`).join(' '), stroke: 'url(#gcp)', 'stroke-width': 4.5, fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round', filter: 'url(#glow)' }, L);
    const dotG = G(L);
    const mkDot = (v, c, label, hollow = false, dy = -30) => { const g = G(dotG); S('circle', { r: 12, fill: hollow ? '#0b1320' : c, stroke: c, 'stroke-width': 3.5 }, g); T(g, label, { x: 0, y: dy, size: 20, w: 760, m: true, fill: c }); return g; };
    const dots = [mkDot(24.5, C.red, '24.5%', false, 32), mkDot(45, C.blue, '~45%', false, 36), mkDot(43.8, C.purple, '43.8%', false, 32), mkDot(26.6, C.red, '26.6%', false, 32), mkDot(38.7, C.purple, '38.7%', false, 32)];
    const hyb = mkDot(42.0, C.cyan, '42.0% hybrid', false, -30);
    const unk = G(L); S('path', { d: `M${xs[4]} ${y(65)} L${xs[4]} ${y(18)}`, stroke: '#46607e', 'stroke-width': 2.4, 'stroke-dasharray': '4 8' }, unk); const q = G(unk); S('circle', { r: 22, fill: '#0b1320', stroke: '#46607e', 'stroke-width': 3, 'stroke-dasharray': '5 5' }, q); T(q, '?', { size: 26, w: 800, fill: C.muted }); q.setAttribute('transform', `translate(${xs[4]} ${y(41)})`); T(unk, 'not recorded', { x: xs[4], y: y(41) + 50, size: 16, m: true, fill: C.faint });
    // expert: documented band + re-test
    const ex = G(L); S('rect', { x: xs[6] - 54, y: y(47.5 + 0.9), width: 108, height: y(47.5 - 0.9) - y(47.5 + 0.9), rx: 8, fill: rgba(C.gold, 0.5) }, ex);
    const exLine = S('path', { d: `M${X0} ${y(47.5)} L${xs[6] + 54} ${y(47.5)}`, stroke: C.gold, 'stroke-width': 2.6, 'stroke-dasharray': '10 7' }, L);
    const exDot = mkDot(47.5, C.gold, '47.5% documented', false, -34);
    const re = mkDot(39.55, C.red, '39.6% re-test', true, 36);
    // v7 BC point + target band
    const bc = mkDot(22.9, ORANGE, '22.9%', false, 34);
    const tg = G(L); S('rect', { x: xs[8] - 70, y: y(65), width: 140, height: y(55) - y(65), rx: 14, fill: rgba(C.green, 0.18), stroke: C.green, 'stroke-width': 2.6, 'stroke-dasharray': '8 6' }, tg); T(tg, '55–65%', { x: xs[8], y: (y(65) + y(55)) / 2 - 4, size: 28, w: 780, m: true, fill: C.green }); T(tg, 'target', { x: xs[8], y: (y(65) + y(55)) / 2 + 28, size: 15, m: true, fill: C.green });
    return { hd, lineA, dots, hyb, unk, ex, exLine, exDot, re, bc, tg, xs, y };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    drawOn(s.lineA, clamp(pr(t, 1.2, 9.0, E.inOutC)));
    const dStart = [1.6, 3.6, 6.0, 8.2, 14.0], idx = [0, 1, 2, 3, 5], vals = [24.5, 45, 43.8, 26.6, 38.7];
    s.dots.forEach((g, i) => { const p = pr(t, dStart[i], 0.5, E.outBack); P(g, { x: s.xs[idx[i]], y: s.y(vals[i]), s: p, o: p }); });
    P(s.hyb, { x: s.xs[5], y: s.y(42.0), s: pr(t, 14.6, 0.5, E.outBack), o: pr(t, 14.6, 0.4) });
    s.unk.setAttribute('opacity', pr(t, 12.4, 0.8));
    s.ex.setAttribute('opacity', pr(t, 19.0, 0.6)); drawOn(s.exLine, pr(t, 19.0, 1.2, E.outQ)); s.exLine.setAttribute('opacity', pr(t, 19.0, 0.3));
    P(s.exDot, { x: s.xs[6], y: s.y(47.5), s: pr(t, 19.6, 0.5, E.outBack), o: pr(t, 19.6, 0.4) });
    P(s.re, { x: s.xs[6], y: s.y(39.55), s: pr(t, 22.6, 0.5, E.outBack), o: pr(t, 22.6, 0.4) });
    P(s.bc, { x: s.xs[7], y: s.y(22.9), s: pr(t, 28.0, 0.5, E.outBack), o: pr(t, 28.0, 0.4) });
    const tp = pr(t, 36.8, 0.9, E.outQ4); s.tg.setAttribute('opacity', tp); s.tg.setAttribute('transform', `translate(0 ${(1 - tp) * 30})`);
    s.tg.firstChild.setAttribute('stroke-opacity', 0.7 + 0.3 * Math.sin(t * 3));
  },
};

// ===================================================================== OUTRO
export const outro = {
  id: 'outro', title: 'Next', dur: 26, ver: null, mood: [C.cyan, C.purple, C.gold], drift: 0.04,
  caps: [
    [0.6, 'Next: the rented GPU pod died and took every checkpoint with it, so the arc is rerun on a home 3080, with checkpoints synced after each milestone.'],
    [9.4, 'Then TD-value with an unfrozen trunk, and the value gate again.'],
    [14.0, 'And first, settle whether the teacher is 47.5% or 39.6%.'],
    [19.0, 'From 24.5% to a *55 to 65%* target. The next chapter is still training.'],
  ],
  build(root) {
    const L = layer(root);
    const steps = [['1', 'Rebuild the training box', 'pod lost with every checkpoint · rerun on a 3080, sync after each milestone', C.cyan], ['2', 'Retry TD-value, trunk unfrozen', 'lr 1e-4 · policy anchor · AdvCPU seats in self-play · gate ≥ 65%', C.gold], ['3', 'Settle the teacher number', 'ExpertCpu: 47.5% documented vs 39.6% re-measured, before the next BC run', C.red]].map(([k, ti, su, col], i) => {
      const g = G(L); const w = 1200, h = 100; S('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 18, fill: 'url(#surface)', stroke: '#2c3e55', 'stroke-width': 1.4, filter: 'url(#soft)' }, g); S('rect', { x: -w / 2, y: -h / 2 + 14, width: 5, height: h - 28, rx: 2.5, fill: col }, g);
      T(g, k, { x: -w / 2 + 52, y: 0, size: 48, w: 800, fill: col, m: true }); T(g, ti, { x: -w / 2 + 110, y: -16, size: 30, w: 680, a: 'start', ls: -0.5 }); T(g, su, { x: -w / 2 + 110, y: 24, size: 19, w: 450, a: 'start', fill: C.muted });
      return g;
    });
    const word = glyphs(L, 'ASTRA', { x: 960, y: 190, size: 130, w: 800, ls: -5 });
    const tag = T(L, 'Seven generations. One honest benchmark.', { x: 960, y: 790, size: 32, w: 560, fill: C.muted });
    return { steps, word, tag };
  },
  update(t, s) {
    s.word.update(t, 0.2);
    const T0 = [1.4, 9.6, 14.2];
    s.steps.forEach((g, i) => { const p = pr(t, T0[i], 0.8, E.outQ4); P(g, { x: 960 + (1 - p) * 120, y: 390 + i * 122, o: p }); });
    s.tag.setAttribute('opacity', pr(t, 19.6, 0.9));
  },
};
