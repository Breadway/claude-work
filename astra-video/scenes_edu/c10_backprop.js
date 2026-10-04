import { S, G, T, layer, E, pr, clamp, lerp, mix, rgba, hn, TH, header } from './common.js';
import { Matrix, Eq, Flow } from '../engine/edukit.js';

// ===================================================================== 10a: slope = gradient
const Lw = (w) => (w - 3) ** 2 + 0.5, dL = (w) => 2 * (w - 3);
const LR = 0.2; const WS = [0.8]; for (let i = 0; i < 6; i++) WS.push(WS[i] - LR * dL(WS[i]));
export const slope = {
  id: 'c10_slope', title: 'Slope is the gradient', dur: 66, ch: 10, loc: 'train', mood: [TH.grad, TH.loss, TH.state],
  caps: [
    [0.5, 'We have a loss: one number that says how wrong Astra is. We want to change the weights so it gets smaller. But which way, and how much?'],
    [12.0, 'Picture the loss as a landscape, and one weight as a position along it. If we nudge the weight a little, the loss rises or falls.'],
    [24.0, 'The slope at that point tells us. The slope of the loss with respect to a weight is called its gradient. It says how much, and in which direction, the loss moves per unit change.'],
    [38.0, 'So the rule is simple: move the weight against its gradient. A negative gradient means increase the weight; a positive one means decrease it.'],
    [52.0, 'Step by step, the weight rolls downhill. The step size is the learning rate, here point two.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 10', title: 'Gradients: which way is downhill?', sub: 'One weight, one loss (toy)', accent: TH.grad });
    const X0 = 360, Y0 = 760, SX = 200, SY = 80; const g = G(L);
    S('path', { d: `M${X0} ${Y0} H${X0 + 6 * SX}`, stroke: '#2b3b52', 'stroke-width': 2 }, g); S('path', { d: `M${X0} ${Y0} V${Y0 - 10 * SY * 0.9}`, stroke: '#2b3b52', 'stroke-width': 2 }, g);
    let d = ''; for (let i = 0; i <= 90; i++) { const w = (6 * i) / 90; d += (i ? 'L' : 'M') + (X0 + w * SX) + ' ' + (Y0 - Lw(w) * SY * 0.55) + ' '; }
    const cv = S('path', { d, stroke: TH.loss, 'stroke-width': 4.5, fill: 'none', filter: 'url(#glow)' }, g); cv.__len = cv.getTotalLength(); cv.setAttribute('stroke-dasharray', cv.__len);
    T(g, 'weight w', { x: X0 + 3 * SX, y: Y0 + 44, size: 20, fill: TH.dim, m: true }); T(g, 'loss', { x: X0 - 20, y: Y0 - 10 * SY * 0.9 - 4, size: 20, a: 'end', fill: TH.loss, m: true });
    const tan = S('path', { d: '', stroke: TH.grad, 'stroke-width': 3, 'stroke-linecap': 'round' }, g); const ball = S('circle', { r: 14, fill: TH.ink, filter: 'url(#glow)' }, g);
    const tr = G(L); const gl = T(tr, '', { x: 1330, y: 400, size: 34, a: 'start', w: 700, fill: TH.grad, m: true }); const ul = T(tr, '', { x: 1330, y: 470, size: 28, a: 'start', w: 650, fill: TH.ink, m: true }); const sl = T(tr, '', { x: 1330, y: 540, size: 24, a: 'start', fill: TH.dim, m: true });
    const eq = Eq(L, { x: 1530, y: 640, a: 'middle', size: 38, runs: [['w', TH.state], [' ← ', TH.dim], ['w', TH.state], [' − ', TH.dim], ['lr', TH.pol], [' · ', TH.dim], ['∂L/∂w', TH.grad]] });
    return { hd, g, cv, tan, ball, tr, gl, ul, sl, eq, X0, Y0, SX, SY };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.g.setAttribute('opacity', pr(t, 0.8, 0.6)); s.cv.setAttribute('stroke-dashoffset', s.cv.__len * (1 - E.inOutC(clamp((t - 1.2) / 4))));
    // ball position: stays at w0 until 52, then walks the steps
    let w = WS[0]; if (t > 52) { const k = (t - 52) / 2.0; const i = Math.min(5, Math.floor(k)); w = lerp(WS[i], WS[i + 1], E.inOutC(clamp(k - i))); }
    const a = pr(t, 12.0, 0.6); const x = s.X0 + w * s.SX, y = s.Y0 - Lw(w) * s.SY * 0.55; const g = dL(w);
    s.ball.setAttribute('cx', x); s.ball.setAttribute('cy', y); s.ball.setAttribute('opacity', a);
    const tx = 1, ty = -g * 0.55 * (s.SY / s.SX); const n = Math.hypot(tx, ty); const L2 = 150;
    s.tan.setAttribute('d', `M${x - (tx / n) * L2} ${y - (ty / n) * L2} L${x + (tx / n) * L2} ${y + (ty / n) * L2}`); s.tan.setAttribute('opacity', pr(t, 24.0, 0.6));
    s.gl.textContent = t > 24 ? `gradient ∂L/∂w = ${g.toFixed(2)}` : ''; s.gl.setAttribute('opacity', pr(t, 24.0, 0.6));
    s.ul.textContent = t > 38 ? `w ← ${w.toFixed(2)} − 0.2 × (${g.toFixed(2)}) = ${(w - LR * g).toFixed(2)}` : ''; s.ul.setAttribute('opacity', pr(t, 38.0, 0.6));
    s.sl.textContent = t > 38 ? (g < 0 ? 'slope negative → raise w' : 'slope positive → lower w') : ''; s.sl.setAttribute('opacity', pr(t, 38.0, 0.6));
    s.eq.g.setAttribute('opacity', pr(t, 38.0, 0.5)); s.eq.show(pr(t, 38.4, 3));
  },
};

// ===================================================================== 10b: chain rule on a three-step net
const X = 2, W1 = 0.5, W2 = 1.5, TGT = 1; const A = W1 * X, Y = W2 * A, LS = (Y - TGT) ** 2;
const dY = 2 * (Y - TGT), dW2 = dY * A, dA = dY * W2, dW1 = dA * X;
export const chain = {
  id: 'c10_chain', title: 'The chain rule', dur: 90, ch: 10, loc: 'train', mood: [TH.grad, TH.state, TH.loss],
  caps: [
    [0.5, 'A real network has millions of weights, stacked in layers. Here is the smallest version: two weights in a chain, ending in a loss.'],
    [10.0, 'First the forward pass. Input two, times w one, half, gives one. Times w two, one and a half, gives one and a half. Compare with the target, one: the loss is a quarter.'],
    [28.0, 'Now go backwards. How does the loss change if the output y changes? Two times the error: one.'],
    [40.0, 'To get the gradient of w two, multiply that by how much y depends on w two, which is the value coming in, one. So one.'],
    [52.0, 'Keep going: the loss depends on a through w two. One times one point five: one and a half.'],
    [64.0, 'And w one: one and a half, times its input two, equals three. Each gradient is the one behind it, times one local factor.'],
    [78.0, 'That is the chain rule. Backpropagation is just applying it, layer after layer, from the loss back to every weight.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 10', title: 'The chain rule, drawn', sub: 'Forward values on top · backward gradients below', accent: TH.grad });
    const nodes = [['x', X, 240, TH.state], ['a = w₁·x', A, 640, TH.state], ['y = w₂·a', Y, 1080, TH.state], ['L = (y − 1)²', LS, 1520, TH.loss]];
    const ns = nodes.map(([lb, v, x, c]) => { const g = G(L); S('circle', { r: 58, fill: rgba(c, 0.14), stroke: c, 'stroke-width': 2.4 }, g); T(g, lb.length > 5 ? lb.split(' ')[0] : lb, { y: 8, size: 30, w: 700, fill: c, m: true }); T(g, lb.length > 5 ? lb.split(' ').slice(1).join(' ') : '', { y: 90, size: 17, fill: TH.dim, m: true }); const val = T(g, v.toString(), { y: -88, size: 34, w: 700, fill: c, m: true }); g.setAttribute('transform', `translate(${x} 480)`); g.val = val; return g; });
    const ws = [['w₁ = 0.5', 440, '∂L/∂w₁'], ['w₂ = 1.5', 860, '∂L/∂w₂']].map(([lb, x, gl]) => { const g = G(L); S('rect', { x: -80, y: -30, width: 160, height: 60, rx: 12, fill: rgba(TH.pol, 0.14), stroke: TH.pol, 'stroke-width': 2 }, g); T(g, lb, { y: 7, size: 24, w: 700, fill: TH.pol, m: true }); g.setAttribute('transform', `translate(${x} 480)`); return g; });
    const arrows = [[298, 582], [698, 1022], [1138, 1462]].map(([a, b]) => S('path', { d: `M${a} 480 L${b} 480`, stroke: '#46607e', 'stroke-width': 2.4, 'marker-end': 'url(#arr)' }, L));
    const tgt = T(L, 'target = 1', { x: 1520, y: 590, size: 22, fill: TH.dim, m: true });
    const gr = [[`dL/dy = ${dY.toFixed(1)}`, 1080, 660, 'dy'], [`dL/dw₂ = ${dW2.toFixed(1)}`, 860, 590, 'dw2'], [`dL/da = ${dA.toFixed(1)}`, 640, 660, 'da'], [`dL/dw₁ = ${dW1.toFixed(1)}`, 440, 590, 'dw1']].map(([lb, x, y]) => { const g = G(L); S('rect', { x: -112, y: -26, width: 224, height: 52, rx: 12, fill: rgba(TH.grad, 0.14), stroke: TH.grad, 'stroke-width': 2.2 }, g); T(g, lb, { y: 7, size: 22, w: 700, fill: TH.grad, m: true }); g.setAttribute('transform', `translate(${x} ${y})`); return g; });
    const back = S('path', { d: 'M1480 560 L1130 640 M1030 640 L900 610 M820 610 L700 640 M580 640 L480 610', stroke: TH.grad, 'stroke-width': 2.4, fill: 'none', 'stroke-dasharray': '6 6', opacity: 0 }, L);
    const eq = Eq(L, { x: 960, y: 830, a: 'middle', size: 34, runs: [['∂L/∂w₁', TH.grad], [' = ', TH.dim], ['∂L/∂y', TH.grad], [' · ', TH.dim], ['∂y/∂a', TH.pol], [' · ', TH.dim], ['∂a/∂w₁', TH.state]] });
    const num = T(L, `= ${dY.toFixed(1)} · ${W2} · ${X} = ${dW1.toFixed(1)}`, { x: 960, y: 885, size: 28, fill: TH.grad, m: true, w: 700 });
    return { hd, ns, ws, arrows, tgt, gr, eq, num };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.ns.forEach((g, i) => g.setAttribute('opacity', pr(t, 1.0 + i * 0.4, 0.5))); s.ws.forEach((g, i) => g.setAttribute('opacity', pr(t, 1.5 + i * 0.4, 0.5)));
    s.arrows.forEach((a, i) => a.setAttribute('opacity', pr(t, 10.0 + i * 5, 0.6))); s.ns.forEach((g, i) => g.val.setAttribute('opacity', i === 0 ? 1 : pr(t, 10.0 + (i - 1) * 5, 0.6)));
    s.tgt.setAttribute('opacity', pr(t, 20.0, 0.6));
    [28, 40, 52, 64].forEach((tt, i) => { const g = s.gr[i]; const a = pr(t, tt, 0.7, E.outBack); g.setAttribute('opacity', a); g.setAttribute('filter', t > tt && t < tt + 10 ? 'url(#glow)' : ''); });
    s.eq.g.setAttribute('opacity', pr(t, 72.0, 0.5)); s.eq.show(pr(t, 72.4, 5)); s.num.setAttribute('opacity', pr(t, 78.0, 0.6));
  },
};

// ===================================================================== 10c: back through Astra
export const through = {
  id: 'c10_through', title: 'Backward through Astra', dur: 76, ch: 10, loc: 'train', mood: [TH.grad, TH.pol, TH.val],
  caps: [
    [0.5, 'Astra is the same story, much bigger. The forward pass runs up the stack: embeddings, six blocks, then the two heads, then the loss.'],
    [12.0, 'The backward pass runs down it. The loss sends a gradient into the policy and value heads, scaled by the three-tenths on the value side.'],
    [26.0, 'Both heads feed gradient into the same encoder output, so the trunk is pushed by what helps the choice and what helps the prediction at once.'],
    [40.0, 'The gradient passes down through block six, then five, and so on, through attention, normalisation, feed-forward and the residual skips, which carry it straight through.'],
    [56.0, 'At the bottom, only the embedding rows that were actually looked up receive any gradient. The rest of the table is untouched on this step.'],
    [68.0, 'One backward pass gives every one of Astra’s five million parameters its own gradient.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 10', title: 'Backpropagation through Astra', sub: 'Every layer passes the gradient one step down', accent: TH.grad });
    const lay = [['Loss', TH.loss, 270, 1], ['policy head · value head', TH.pol, 345, 1], ...Array.from({ length: 6 }, (_, i) => [`block ${6 - i}`, TH.search, 420 + i * 70, 1]), ['embedding tables', TH.state, 880, 1]];
    const boxes = lay.map(([lb, c, y]) => { const g = G(L); S('rect', { x: -260, y: -28, width: 520, height: 56, rx: 12, fill: rgba(c, 0.13), stroke: c, 'stroke-width': 2 }, g); T(g, lb, { y: 8, size: 23, w: 650, fill: c, m: true }); g.setAttribute('transform', `translate(560 ${y})`); return g; });
    const fw = S('path', { d: 'M260 880 V270', stroke: '#46607e', 'stroke-width': 2.4, fill: 'none', 'stroke-dasharray': '5 7', 'marker-end': 'url(#arr)' }, L); T(L, 'forward', { x: 230, y: 580, size: 18, a: 'end', fill: TH.dim, m: true });
    const bw = S('path', { d: 'M880 270 V880', stroke: TH.grad, 'stroke-width': 3, fill: 'none', 'marker-end': 'url(#arr)' }, L); T(L, 'backward', { x: 910, y: 580, size: 18, a: 'start', fill: TH.grad, m: true });
    const fl = Flow(L, 'M880 270 V880', { n: 7, color: TH.grad, r: 7 });
    const side = G(L); const info = [['the heads', 'weight 1.0 policy · 0.3 value'], ['the blocks', 'residual skips keep the gradient alive'], ['embeddings', 'only used rows update']]; info.forEach(([a, b], i) => { T(side, a, { x: 1100, y: 390 + i * 150, size: 30, a: 'start', w: 700, fill: TH.ink }); T(side, b, { x: 1100, y: 430 + i * 150, size: 22, a: 'start', fill: TH.dim, m: true }); });
    const rows = G(L); for (let i = 0; i < 30; i++) S('rect', { x: 330 + i * 15, y: 922, width: 11, height: 18, rx: 2, fill: [4, 11, 19].includes(i) ? TH.grad : '#16233a' }, rows);
    return { hd, boxes, fw, bw, fl, side, rows };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.boxes.forEach((g, i) => g.setAttribute('opacity', pr(t, 1.0 + i * 0.3, 0.5)));
    s.fw.setAttribute('opacity', pr(t, 6.0, 0.6)); const b = pr(t, 12.0, 0.6); s.bw.setAttribute('opacity', b); s.fl.g.setAttribute('opacity', b); s.fl.update(t, 0.12, 1);
    s.boxes.forEach((g, i) => { const front = clamp((t - 12) / 52) * 9; const lit = front > i; g.setAttribute('filter', lit && t < 66 && Math.abs(front - i) < 1 ? 'url(#glow)' : ''); });
    s.side.setAttribute('opacity', pr(t, 26.0, 0.8)); s.rows.setAttribute('opacity', pr(t, 56.0, 0.6));
  },
};

// ===================================================================== 10d: shared weights and batches
export const shared = {
  id: 'c10_shared', title: 'Shared weights', dur: 54, ch: 10, loc: 'train', mood: [TH.grad, TH.state, TH.pol],
  caps: [
    [0.5, 'One detail matters for a transformer. The same weight matrix is used for every one of the one hundred eighty tokens.'],
    [12.0, 'So when the gradient comes back, each token contributes its own piece, and the pieces are added together into one gradient for that weight.'],
    [26.0, 'The same happens across the batch: sixty-four positions at once. The loss is an average, so their gradients are averaged too.'],
    [40.0, 'One noisy example would push the weights in a random direction. Averaging sixty-four keeps the push steady.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 10', title: 'One weight, many gradients', sub: 'Contributions from every token and every example are summed', accent: TH.grad });
    const toks = Array.from({ length: 8 }, (_, i) => { const g = G(L); S('rect', { x: -60, y: -26, width: 120, height: 52, rx: 10, fill: rgba(TH.state, 0.14), stroke: TH.state, 'stroke-width': 1.8 }, g); T(g, 'token ' + (i + 1), { y: 6, size: 18, w: 600, fill: TH.state, m: true }); g.setAttribute('transform', `translate(${220 + i * 190} 330)`); return g; });
    const W = G(L); S('rect', { x: 560, y: 560, width: 800, height: 90, rx: 18, fill: rgba(TH.pol, 0.14), stroke: TH.pol, 'stroke-width': 2.4 }, W); T(W, 'W_Q  (one matrix, shared by all tokens)', { x: 960, y: 617, size: 28, w: 650, fill: TH.pol, m: true });
    const grads = toks.map((_, i) => { const x = 220 + i * 190; const p = S('path', { d: `M${x} 400 L${960 + (i - 3.5) * 80} 556`, stroke: TH.grad, 'stroke-width': 2.4, fill: 'none', 'marker-end': 'url(#arr)' }, L); return p; });
    const sum = T(L, 'ΔW = Σ over tokens  (then ÷ 64 examples)', { x: 960, y: 740, size: 34, w: 700, fill: TH.grad, m: true });
    const bt = G(L); for (let i = 0; i < 16; i++) S('rect', { x: 420 + i * 70, y: 820, width: 56, height: 36, rx: 7, fill: rgba(TH.hist, 0.2 + 0.4 * hn(i, 3)), stroke: TH.hist, 'stroke-width': 1.4 }, bt); T(bt, 'batch of 64 positions (16 shown)', { x: 960, y: 890, size: 20, fill: TH.dim, m: true });
    return { hd, toks, W, grads, sum, bt };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.toks.forEach((g, i) => g.setAttribute('opacity', pr(t, 1.0 + i * 0.2, 0.5))); s.W.setAttribute('opacity', pr(t, 3.0, 0.6));
    s.grads.forEach((p, i) => p.setAttribute('opacity', pr(t, 12.0 + i * 0.4, 0.5))); s.sum.setAttribute('opacity', pr(t, 18.0, 0.6)); s.bt.setAttribute('opacity', pr(t, 26.0, 0.7));
  },
};
