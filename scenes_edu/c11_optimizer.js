import { S, G, T, layer, E, pr, clamp, lerp, mix, rgba, hn, TH, header } from './common.js';
import { Matrix, Eq, Flow } from '../engine/edukit.js';

// ===================================================================== 11a: step size
const Lw = (w) => (w - 3) ** 2, dL = (w) => 2 * (w - 3);
const run = (lr, n = 7) => { const o = [0.5]; for (let i = 0; i < n; i++) o.push(o[i] - lr * dL(o[i])); return o; };
const RUNS = [['lr 0.02 · too small', 0.02, TH.dim], ['lr 0.30 · good', 0.3, TH.hist], ['lr 1.10 · too big', 1.1, TH.grad]].map(([n, lr, c]) => ({ n, lr, c, w: run(lr) }));
export const lrate = {
  id: 'c11_lr', title: 'The learning rate', dur: 54, ch: 11, loc: 'train', mood: [TH.pol, TH.grad, TH.hist],
  caps: [
    [0.5, 'The optimizer takes the gradients and decides how far to move each weight. The simplest rule: subtract the gradient, scaled by a small number called the learning rate.'],
    [14.0, 'Too small, and the weight crawls: after seven steps it has barely moved. Just right, and it settles at the bottom.'],
    [30.0, 'Too large, and each step overshoots the valley and lands higher on the other side. The loss gets worse, not better.'],
    [44.0, 'Astra’s base learning rate is three ten-thousandths. Small, because there are millions of weights moving together.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 11', title: 'How big a step?', sub: 'w ← w − lr · gradient · same toy loss, three learning rates', accent: TH.pol });
    const X0 = 300, Y0 = 760, SX = 220, SY = 62; const g = G(L);
    S('path', { d: `M${X0 - 40} ${Y0} H${X0 + 6.2 * SX}`, stroke: '#2b3b52', 'stroke-width': 2 }, g);
    let d = ''; for (let i = 0; i <= 90; i++) { const w = -0.2 + (6.2 * i) / 90; d += (i ? 'L' : 'M') + (X0 + w * SX) + ' ' + (Y0 - Lw(w) * SY * 0.65) + ' '; } S('path', { d, stroke: TH.loss, 'stroke-width': 4, fill: 'none', opacity: 0.8 }, g);
    const pts = RUNS.map((r) => { const gg = G(L); const trail = S('path', { d: '', stroke: r.c, 'stroke-width': 2.4, fill: 'none', opacity: 0.8 }, gg); const dot = S('circle', { r: 11, fill: r.c, filter: 'url(#glow)' }, gg); return { trail, dot, r }; });
    const leg = RUNS.map((r, i) => { const t = T(L, r.n, { x: 1480, y: 340 + i * 54, size: 24, a: 'start', fill: r.c, m: true }); return t; });
    const val = T(L, '', { x: 1480, y: 520, size: 22, a: 'start', fill: TH.dim, m: true });
    return { hd, g, pts, leg, X0, Y0, SX, SY, val };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.g.setAttribute('opacity', pr(t, 0.8, 0.6));
    const sh = [14, 14, 30];
    s.pts.forEach((p, i) => {
      const a = pr(t, [14, 14, 30][i] - 12 + (i === 0 ? 0 : 0), 0.5); const k = clamp((t - (i === 2 ? 30 : 14)) / 12) * 7; const n = Math.floor(k); const w = p.r.w;
      const cw = (v) => Math.max(-0.9, Math.min(6.5, v)); const xs = (j) => s.X0 + cw(w[Math.min(j, 7)]) * s.SX, ys = (j) => Math.max(250, s.Y0 - Lw(cw(w[Math.min(j, 7)])) * s.SY * 0.65);
      const cur = Math.min(n, 7); const f = k - n; const wx = lerp(w[cur], w[Math.min(cur + 1, 7)], E.inOutC(Math.min(f, 1))); const px = s.X0 + cw(wx) * s.SX, py = Math.max(250, Math.min(s.Y0, s.Y0 - Lw(cw(wx)) * s.SY * 0.65));
      let dd = `M${xs(0)} ${ys(0)}`; for (let j = 1; j <= cur; j++) dd += ` L${xs(j)} ${ys(j)}`; dd += ` L${px} ${py}`;
      p.trail.setAttribute('d', dd); p.dot.setAttribute('cx', px); p.dot.setAttribute('cy', Math.max(240, py)); const vis = i === 2 ? pr(t, 30, 0.4) : pr(t, 14, 0.4); p.dot.setAttribute('opacity', vis); p.trail.setAttribute('opacity', 0.8 * vis);
    });
    s.leg.forEach((l, i) => l.setAttribute('opacity', pr(t, i === 2 ? 30 : 14, 0.5)));
    s.val.textContent = t > 44 ? 'Astra: base lr = 3e-4' : ''; s.val.setAttribute('opacity', pr(t, 44, 0.6)); s.val.setAttribute('fill', TH.pol); s.val.setAttribute('font-size', 30);
  },
};

// ===================================================================== 11b: Adam
const G4 = [4.0, 3.5, -0.5, 3.8], B1 = 0.9, B2 = 0.999, EPS = 1e-5, LRA = 0.1;
const ROWS = (() => { let m = 0, v = 0; return G4.map((g, i) => { const t = i + 1; m = B1 * m + (1 - B1) * g; v = B2 * v + (1 - B2) * g * g; const mh = m / (1 - B1 ** t), vh = v / (1 - B2 ** t); return [t, g, mh, Math.sqrt(vh), LRA * mh / (Math.sqrt(vh) + EPS)]; }); })();
export const adam = {
  id: 'c11_adam', title: 'Adam', dur: 92, ch: 11, loc: 'train', mood: [TH.pol, TH.val, TH.grad],
  caps: [
    [0.5, 'Astra uses Adam, the standard optimizer for transformers. It improves on plain gradient descent with two memories, kept separately for every weight.'],
    [14.0, 'The first, m, is a running average of recent gradients. It smooths out noise, so a weight keeps moving in a direction that is consistently useful.'],
    [28.0, 'The second, v, is a running average of squared gradients. It measures how large this weight’s gradients usually are.'],
    [42.0, 'The step is m divided by the square root of v. So a weight with huge gradients and one with tiny gradients both take steps of a similar size.'],
    [58.0, 'Here is one weight over four steps. Gradients of four, three and a half, then a surprise of minus a half: the smoothed gradient m barely flinches, and the step stays steady.'],
    [76.0, 'A tiny constant, epsilon, sits under the square root so nothing divides by zero. Remember it: it matters a great deal in chapter twelve.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 11', title: 'Adam: a memory for every weight', sub: 'β₁ = 0.9 · β₂ = 0.999 · ε = 1e-5 · no weight decay (illustrative lr = 0.1)', accent: TH.pol });
    const eqs = Eq(L, { x: 960, y: 270, a: 'middle', size: 33, runs: [['m', TH.val], [' ← 0.9·m + 0.1·g', TH.dim], ['    ', TH.dim], ['v', TH.grad], [' ← 0.999·v + 0.001·g²', TH.dim]] });
    const eqs2 = Eq(L, { x: 960, y: 335, a: 'middle', size: 38, runs: [['w', TH.state], [' ← w − lr · ', TH.dim], ['m̂', TH.val], [' / (', TH.dim], ['√v̂', TH.grad], [' + ε)', TH.dim]] });
    const note = T(L, 'm̂ and v̂ are m and v corrected for starting at zero', { x: 960, y: 380, size: 18, fill: TH.dim, m: true });
    const hdr = ['step', 'gradient g', 'm̂ (smoothed g)', '√v̂ (typical size)', 'step taken'].map((h, j) => T(L, h, { x: 340 + j * 310, y: 470, size: 19, fill: j === 2 ? TH.val : j === 3 ? TH.grad : TH.dim, m: true }));
    const cells = ROWS.map((r, i) => r.map((v, j) => { const txt = j === 0 ? String(v) : j === 4 ? '−' + Math.abs(v).toFixed(3) : v.toFixed(2); return T(L, txt, { x: 340 + j * 310, y: 540 + i * 66, size: 30, w: 700, m: true, fill: j === 2 ? TH.val : j === 3 ? TH.grad : j === 4 ? TH.pol : TH.ink }); }));
    const nb = T(L, 'plain gradient descent would swing: its step follows each noisy g', { x: 960, y: 850, size: 22, fill: TH.dim, m: true });
    return { hd, eqs, eqs2, note, hdr, cells, nb };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.eqs.g.setAttribute('opacity', pr(t, 14.0, 0.5)); s.eqs.show(pr(t, 14.4, 6)); s.eqs.hl('x', 0, TH.ink);
    s.eqs2.g.setAttribute('opacity', pr(t, 42.0, 0.5)); s.eqs2.show(pr(t, 42.4, 4)); s.note.setAttribute('opacity', pr(t, 46.0, 0.6));
    s.hdr.forEach((h) => h.setAttribute('opacity', pr(t, 58.0, 0.6)));
    s.cells.forEach((row, i) => row.forEach((c) => c.setAttribute('opacity', pr(t, 60.0 + i * 3.5, 0.5))));
    s.nb.setAttribute('opacity', pr(t, 70.0, 0.6));
  },
};

// ===================================================================== 11c: clipping + schedule
export const sched = {
  id: 'c11_sched', title: 'Clipping and the schedule', dur: 74, ch: 11, loc: 'train', mood: [TH.pol, TH.grad, TH.loss],
  caps: [
    [0.5, 'Two safeguards wrap the optimizer. First, gradient clipping. Occasionally one batch produces an enormous gradient, and an unchecked step could wreck the weights.'],
    [14.0, 'If the combined length of all the gradients exceeds one, Astra scales them all down so it equals one. The direction is untouched; only the size is capped.'],
    [28.0, 'Second, the learning rate is not constant. For the first five percent of training it climbs from zero to its base value, three ten-thousandths.'],
    [40.0, 'Early on, the network is random and Adam’s memories are empty, so full-size steps would be reckless. This is the warm-up.'],
    [54.0, 'After warm-up the rate follows half a cosine wave down to zero: big steps while there is far to go, tiny ones to settle in at the end.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 11', title: 'Clipping and the schedule', sub: 'Two safeguards around every update', accent: TH.pol });
    const cx = 480, cy = 560; const cl = G(L); S('circle', { cx, cy, r: 150, fill: 'none', stroke: TH.pol, 'stroke-width': 2.4, 'stroke-dasharray': '6 6' }, cl); T(cl, 'global norm 1.0', { x: cx, y: cy + 180, size: 20, fill: TH.pol, m: true });
    const big = S('path', { d: `M${cx} ${cy} L${cx + 330} ${cy - 230}`, stroke: TH.grad, 'stroke-width': 5, 'stroke-linecap': 'round', 'marker-end': 'url(#arr)' }, cl); const small = S('path', { d: `M${cx} ${cy} L${cx + 123} ${cy - 86}`, stroke: TH.hist, 'stroke-width': 5, 'stroke-linecap': 'round', 'marker-end': 'url(#arr)' }, cl);
    const l1 = T(cl, 'gradients, norm 5.0', { x: cx + 250, y: cy - 270, size: 20, fill: TH.grad, m: true }); const l2 = T(cl, 'clipped, norm 1.0', { x: cx + 30, y: cy + 40, size: 20, fill: TH.hist, m: true, a: 'start' });
    const X0 = 960, Y0 = 780, SX = 840, SY = 300; const p = G(L); S('path', { d: `M${X0} ${Y0} H${X0 + SX}`, stroke: '#2b3b52', 'stroke-width': 2 }, p); S('path', { d: `M${X0} ${Y0} V${Y0 - SY - 40}`, stroke: '#2b3b52', 'stroke-width': 2 }, p);
    const wu = 0.05; let d = ''; for (let i = 0; i <= 200; i++) { const x = i / 200; const y = x < wu ? x / wu : 0.5 * (1 + Math.cos(Math.PI * (x - wu) / (1 - wu))); d += (i ? 'L' : 'M') + (X0 + x * SX) + ' ' + (Y0 - y * SY) + ' '; }
    const cv = S('path', { d, stroke: TH.pol, 'stroke-width': 4, fill: 'none', filter: 'url(#glow)' }, p); cv.__len = cv.getTotalLength(); cv.setAttribute('stroke-dasharray', cv.__len);
    T(p, 'learning rate', { x: X0 + 120, y: Y0 - SY - 85, size: 20, a: 'start', fill: TH.pol, m: true }); T(p, '3e-4', { x: X0 - 12, y: Y0 - SY, size: 18, a: 'end', fill: TH.dim, m: true }); T(p, 'training steps →', { x: X0 + SX / 2, y: Y0 + 40, size: 18, fill: TH.dim, m: true });
    const wl = S('rect', { x: X0, y: Y0 - SY - 30, width: SX * wu, height: SY + 30, fill: rgba(TH.val, 0.12) }, p); T(p, 'warm-up 5%', { x: X0 + 8, y: Y0 - SY - 50, size: 18, a: 'start', fill: TH.val, m: true }); T(p, 'cosine decay to 0', { x: X0 + 470, y: Y0 - 215, size: 20, fill: TH.dim, m: true });
    return { hd, cl, big, small, l1, l2, p, cv, wl };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.cl.setAttribute('opacity', pr(t, 1.0, 0.7)); const c = E.inOutC(clamp((t - 14) / 3)); s.big.setAttribute('opacity', 1 - c); s.small.setAttribute('opacity', c * pr(t, 14, 0.2)); s.l1.setAttribute('opacity', 1 - c); s.l2.setAttribute('opacity', c);
    s.p.setAttribute('opacity', pr(t, 28.0, 0.6)); s.cv.setAttribute('stroke-dashoffset', s.cv.__len * (1 - E.inOutC(clamp((t - 29) / 6)))); s.wl.setAttribute('opacity', pr(t, 40, 0.6));
  },
};

// ===================================================================== 11d: the training loop
export const loop = {
  id: 'c11_loop', title: 'The loop', dur: 52, ch: 11, loc: 'train', mood: [TH.pol, TH.state, TH.grad],
  caps: [
    [0.5, 'Put it together and training is a loop. Take a batch of examples. Run the network forward. Measure the loss.'],
    [14.0, 'Run backward to get gradients. Clip them. Let Adam turn them into steps. Update the weights, with the learning rate for that moment in the schedule.'],
    [30.0, 'That is one step. Astra’s training run uses batches of sixty-four examples, and repeats this step until the schedule reaches zero.'],
    [42.0, 'Nothing else changes the network. Every skill it will ever show is made of these small steps, repeated.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 11', title: 'One training step', sub: 'Repeat until the learning-rate schedule reaches zero', accent: TH.pol });
    const st = [['batch of 64', TH.hist], ['forward', TH.state], ['loss', TH.loss], ['backward', TH.grad], ['clip to 1.0', TH.pol], ['Adam step', TH.pol], ['update weights', TH.val]];
    const R = 330, cx = 960, cy = 560; const nodes = st.map(([lb, c], i) => { const a = (i / st.length) * Math.PI * 2 - Math.PI / 2; const g = G(L); S('rect', { x: -96, y: -32, width: 192, height: 64, rx: 14, fill: rgba(c, 0.14), stroke: c, 'stroke-width': 2.2 }, g); T(g, lb, { y: 7, size: 22, w: 650, fill: c, m: true }); g.setAttribute('transform', `translate(${cx + Math.cos(a) * R * 1.35} ${cy + Math.sin(a) * R * 0.78})`); g.a = a; return g; });
    const ring = S('ellipse', { cx, cy, rx: R * 1.35, ry: R * 0.78, fill: 'none', stroke: '#2b3b52', 'stroke-width': 2, 'stroke-dasharray': '5 8' }, L);
    const dot = S('circle', { r: 11, fill: TH.ink, filter: 'url(#glow)' }, L); const ctr = T(L, '', { x: cx, y: cy, size: 44, w: 700, fill: TH.pol, m: true }); const sub = T(L, '', { x: cx, y: cy + 50, size: 20, fill: TH.dim, m: true });
    return { hd, nodes, ring, dot, ctr, sub, cx, cy, R };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.nodes.forEach((g, i) => g.setAttribute('opacity', pr(t, 1.0 + i * 0.25, 0.5))); s.ring.setAttribute('opacity', pr(t, 1.0, 0.6));
    const u = (((t - 6) / 7) % 1 + 1) % 1; const a = -Math.PI / 2 + u * Math.PI * 2; const on = pr(t, 6, 0.5);
    s.dot.setAttribute('cx', s.cx + Math.cos(a) * s.R * 1.35); s.dot.setAttribute('cy', s.cy + Math.sin(a) * s.R * 0.78); s.dot.setAttribute('opacity', on);
    const step = Math.max(0, Math.floor((t - 6) / 7)) + 1; s.ctr.textContent = t > 6 ? `step ${step}` : ''; s.ctr.setAttribute('opacity', on); s.sub.textContent = t > 6 ? 'lr(step) = base × warm-up × cosine' : ''; s.sub.setAttribute('opacity', on);
  },
};
