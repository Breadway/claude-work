import { S, G, T, P, layer, C, E, pr, clamp, lerp, mix, rgba, bump, sbump, hn, rng, drawOn, travel, fmt, curve } from '../engine/core.js';
import { header, card, pill, stat, glyphs, arcPath } from '../engine/kit.js';

// ===================================================================== TITLE
export const title = {
  id: 'title', title: 'ASTRA', dur: 10, mood: [C.cyan, C.purple, C.blue], drift: 0.05,
  caps: [
    [1.2, 'Novacana is a four-player card game about building *star systems*.'],
    [5.2, '*ASTRA* is the AI we have been teaching to play it, across seven generations.'],
  ],
  build(root) {
    const L = layer(root);
    const orb = G(L);
    const rings = [0, 1, 2, 3].map((i) => {
      const rx = 520 + i * 150, ry = 150 + i * 52;
      const e = S('ellipse', { cx: 0, cy: 0, rx, ry, fill: 'none', stroke: [C.cyan, C.purple, C.blue, C.gold][i], 'stroke-opacity': 0.35 - i * 0.05, 'stroke-width': 1.6, 'stroke-dasharray': '3 9' }, orb);
      const dots = [0, 1].map((k) => S('circle', { r: 7 - i, fill: [C.cyan, C.purple, C.blue, C.gold][i], filter: 'url(#glow)' }, orb));
      return { e, dots, rx, ry, sp: 0.18 + i * 0.07 };
    });
    const burst = S('circle', { cx: 960, cy: 450, r: 10, fill: 'none', stroke: '#fff', 'stroke-width': 3 }, L);
    const word = glyphs(L, 'ASTRA', { x: 960, y: 450, size: 300, w: 800, ls: -10, fill: '#eef3f9' });
    const sub = T(L, 'Teaching a machine to play Novacana', { x: 960, y: 690, size: 40, w: 500, fill: C.muted, ls: -0.5 });
    const pills = ['4-PLAYER', 'IMPERFECT INFORMATION', 'SEVEN GENERATIONS'].map((s, i) => pill(L, s, { x: 960 + (i - 1) * 330, y: 790, color: [C.cyan, C.purple, C.gold][i], size: 15 }));
    const line = S('rect', { x: 960 - 280, y: 626, width: 560, height: 3, fill: 'url(#gcp)', rx: 2 }, L);
    return { orb, rings, burst, word, sub, pills, line };
  },
  update(t, s) {
    s.word.update(t, 0.5);
    s.orb.setAttribute('transform', `translate(960 450)`);
    s.orb.setAttribute('opacity', pr(t, 0.2, 1.4));
    s.rings.forEach((r, i) => {
      r.e.setAttribute('transform', `rotate(${(t * 2 + i * 20) % 360})`);
      r.dots.forEach((d, k) => {
        const a = t * r.sp + k * Math.PI + i;
        const px = Math.cos(a) * r.rx, py = Math.sin(a) * r.ry, ang = ((t * 2 + i * 20) * Math.PI) / 180;
        d.setAttribute('cx', px * Math.cos(ang) - py * Math.sin(ang)); d.setAttribute('cy', px * Math.sin(ang) + py * Math.cos(ang));
      });
    });
    const b = pr(t, 0.4, 1.6, E.outQ4);
    s.burst.setAttribute('r', 10 + b * 900); s.burst.setAttribute('stroke-opacity', (1 - b) * 0.8);
    const w = pr(t, 2.2, 0.9);
    s.line.setAttribute('width', 560 * pr(t, 2.0, 1.0, E.outQ4)); s.line.setAttribute('x', 960 - 280 * pr(t, 2.0, 1.0, E.outQ4));
    s.sub.setAttribute('opacity', w); s.sub.setAttribute('transform', `translate(0 ${(1 - w) * 16})`);
    s.pills.forEach((p, i) => { const q = pr(t, 3.2 + i * 0.2, 0.6, E.outBack); P(p, { x: 960 + (i - 1) * 330, y: 790, s: q, o: q }); });
  },
};

// ===================================================================== GAME + CHALLENGES
const SEATS = [[540, 790, 'YOU', C.cyan], [235, 590, 'OPP 1', C.purple], [540, 392, 'OPP 2', C.purple], [845, 590, 'OPP 3', C.purple]];
export const problem = {
  id: 'problem', title: 'The problem', dur: 25, ver: null, mood: [C.purple, C.blue, C.cyan],
  caps: [
    [0.4, 'Players deal, play and chain cards to complete three star systems first.'],
    [5.0, 'Teaching a computer to win is a reinforcement learning problem, and a nasty one.'],
    [9.4, 'You never see opponent hands. *Partially observable.*'],
    [13.0, 'Four players means no clean equilibrium to converge to. *Multi-player.*'],
    [16.8, '100+ decisions, one reward at the very end. *Long horizon.*'],
    [20.8, 'And every card can be aimed at many targets. *Combinatorial.*'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 0', title: 'Why this game is hard', sub: 'Four things that make credit assignment brutal' });
    // table
    const tbl = G(L);
    S('ellipse', { cx: 540, cy: 590, rx: 380, ry: 230, fill: 'url(#surface)', stroke: '#2c3e55', 'stroke-width': 2, filter: 'url(#soft)' }, tbl);
    S('ellipse', { cx: 540, cy: 590, rx: 340, ry: 196, fill: 'none', stroke: '#1f2c3e', 'stroke-width': 1.5, 'stroke-dasharray': '4 8' }, tbl);
    const seats = SEATS.map(([x, y, name, col], si) => {
      const g = G(L);
      const lab = T(g, name, { x, y: si === 0 ? y + 70 : si === 2 ? y - 62 : y + (si === 1 ? -80 : -80), size: 15, w: 700, fill: col, ls: 2.5 });
      const cards = Array.from({ length: 5 }, (_, i) => {
        const c = G(g);
        S('rect', { x: -23, y: -33, width: 46, height: 66, rx: 7, fill: si === 0 ? '#12263c' : '#0f1830', stroke: col, 'stroke-width': 1.8 }, c);
        if (si === 0) { S('circle', { cx: 0, cy: -6, r: 8, fill: 'none', stroke: [C.cyan, C.gold, C.purple, C.blue, C.pink][i], 'stroke-width': 2 }, c); S('circle', { cx: 0, cy: -6, r: 2.6, fill: [C.cyan, C.gold, C.purple, C.blue, C.pink][i] }, c); S('rect', { x: -14, y: 14, width: 28, height: 3, rx: 1.5, fill: col, opacity: 0.6 }, c); }
        else { S('path', { d: 'M-12 -10 L0 -22 L12 -10 L12 8 L0 20 L-12 8z', fill: 'none', stroke: col, 'stroke-opacity': 0.4, 'stroke-width': 1.4 }, c); }
        const q = si === 0 ? null : T(c, '?', { size: 26, w: 800, fill: col, y: 0 });
        c.q = q; return c;
      });
      const systems = Array.from({ length: 3 }, (_, i) => {
        const sg = G(g);
        S('circle', { r: 17, fill: 'none', stroke: col, 'stroke-opacity': 0.45, 'stroke-width': 1.4, 'stroke-dasharray': '2 5' }, sg);
        const st = S('circle', { r: 5 + i * 1.6, fill: [C.gold, C.cyan, C.blue][i] }, sg);
        const mo = S('circle', { r: 2.4, fill: '#fff' }, sg);
        sg.mo = mo; sg.st = st; return sg;
      });
      return { g, lab, cards, systems, x, y, si, col };
    });
    // overlays tied to challenge index
    const fog = G(L), net = G(L), clock = G(L), fan = G(L);
    const fogRings = [1, 2, 3].map((si) => S('circle', { cx: SEATS[si][0], cy: SEATS[si][1], r: 78, fill: rgba(C.purple, 0.12), stroke: C.purple, 'stroke-dasharray': '5 6', 'stroke-width': 1.8 }, fog));
    const edges = [];
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      const e = S('path', { d: `M${SEATS[a][0]} ${SEATS[a][1]} L${SEATS[b][0]} ${SEATS[b][1]}`, stroke: C.gold, 'stroke-width': 2, fill: 'none', 'stroke-dasharray': '8 8', 'stroke-opacity': 0.8 }, net);
      edges.push(e);
    }
    const clockTxt = T(clock, '1', { x: 540, y: 590, size: 120, w: 800, fill: C.cyan, ls: -4 });
    const clockSub = T(clock, 'decisions until the only reward', { x: 540, y: 660, size: 20, w: 500, fill: C.muted });
    const fans = [];
    for (let si = 1; si < 4; si++) for (let k = 0; k < 3; k++) fans.push(S('path', { d: `M${SEATS[0][0]} ${SEATS[0][1] - 40} Q${540 + (si - 2) * 120} ${520} ${SEATS[si][0] + (k - 1) * 22} ${SEATS[si][1] + (k - 1) * 16}`, stroke: C.pink, 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' }, fan));
    // challenge cards
    const ch = [
      ['01', 'Partially observable', 'Opponent hands are hidden', C.purple],
      ['02', 'Multi-player', 'Not two-player zero-sum: no Nash to converge to', C.gold],
      ['03', 'Long horizon', '100+ decisions, one win/loss signal at the end', C.cyan],
      ['04', 'Combinatorial', 'Every card can hit many targets', C.pink],
    ].map(([k, ti, su, col], i) => {
      const g = G(L);
      const w = 740, h = 124;
      S('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 16, fill: 'url(#surface)', stroke: '#2c3e55', 'stroke-width': 1.4, filter: 'url(#soft)' }, g);
      const hl = S('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 16, fill: 'none', stroke: col, 'stroke-width': 2.4, opacity: 0 }, g);
      T(g, k, { x: -w / 2 + 44, y: 0, size: 44, w: 800, fill: col, m: true, ls: -2 });
      T(g, ti, { x: -w / 2 + 110, y: -18, size: 31, w: 680, a: 'start', ls: -0.5 });
      T(g, su, { x: -w / 2 + 110, y: 22, size: 19.5, w: 450, fill: C.muted, a: 'start' });
      const mini = G(g); mini.setAttribute('transform', `translate(${w / 2 - 120} 0)`);
      return { g, hl, mini, col, i };
    });
    // mini widgets
    const m0 = ch[0].mini; const m0c = [0, 1, 2].map((i) => { const c = G(m0); S('rect', { x: -19, y: -27, width: 38, height: 54, rx: 6, fill: '#0f1830', stroke: C.purple, 'stroke-width': 1.6 }, c); T(c, '?', { size: 24, w: 800, fill: C.purple }); return c; });
    const m1 = ch[1].mini; const m1n = [[-50, 0], [0, -34], [50, 0], [0, 34]].map(([x, y]) => S('circle', { cx: x, cy: y, r: 9, fill: C.gold }, m1)); const m1e = []; for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) { const p = [[-50, 0], [0, -34], [50, 0], [0, 34]]; m1e.push(S('path', { d: `M${p[a][0]} ${p[a][1]} L${p[b][0]} ${p[b][1]}`, stroke: C.gold, 'stroke-width': 1.4, fill: 'none', 'stroke-opacity': 0.6 }, m1)); }
    const m2 = ch[2].mini; const m2t = Array.from({ length: 22 }, (_, i) => S('rect', { x: -105 + i * 9.6, y: -8, width: 4, height: 16, rx: 2, fill: C.cyan }, m2)); const m2f = S('path', { d: 'M104 -22 L104 22 M104 -22 L128 -14 L104 -6', stroke: C.gold, fill: 'none', 'stroke-width': 2.4, transform: 'translate(-15 0)' }, m2);
    const m3 = ch[3].mini; const m3p = []; const m3n = [];
    [[0, 0, -40, -34], [0, 0, -40, 0], [0, 0, -40, 34]].forEach(([x, y, x2, y2], i) => { });
    const tree = [[-100, 0]]; const tl2 = [[-30, -34], [-30, 0], [-30, 34]]; const tl3 = [[50, -50], [50, -34], [50, -18], [50, -6], [50, 6], [50, 18], [50, 34], [50, 50]];
    tl2.forEach((q) => m3p.push(S('path', { d: `M-100 0 L${q[0]} ${q[1]}`, stroke: C.pink, 'stroke-width': 1.3, fill: 'none' }, m3)));
    tl3.forEach((q, i) => m3p.push(S('path', { d: `M${tl2[Math.min(2, Math.floor(i / 3))][0]} ${tl2[Math.min(2, Math.floor(i / 3))][1]} L${q[0]} ${q[1]}`, stroke: C.pink, 'stroke-width': 1.1, fill: 'none', 'stroke-opacity': 0.7 }, m3)));
    [[-100, 0], ...tl2, ...tl3].forEach((q) => m3n.push(S('circle', { cx: q[0], cy: q[1], r: 4.5, fill: C.pink }, m3)));
    return { hd, seats, fogRings, edges, clockTxt, clockSub, fog, net, clock, fan, fans, ch, m0c, m1n, m1e, m2t, m2f, m3p, m3n, tbl };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.tbl.setAttribute('opacity', pr(t, 0, 0.8));
    // deal
    s.seats.forEach((st, si) => {
      st.g.setAttribute('opacity', pr(t, 0.2 + si * 0.2, 0.5));
      st.lab.setAttribute('opacity', pr(t, 0.5 + si * 0.2, 0.5));
      st.cards.forEach((c, i) => {
        const d0 = 0.7 + si * 0.25 + i * 0.12;
        const p = pr(t, d0, 0.7, E.outQ4);
        const ang = (i - 2) * 11;
        const dirx = si === 1 ? 1 : si === 3 ? -1 : 0, diry = si === 0 ? -1 : si === 2 ? 1 : 0;
        const tx = st.x + (si % 2 ? 0 : (i - 2) * 38) + (si % 2 ? 0 : 0);
        const ty = st.y + (si % 2 ? (i - 2) * 38 : 0) - (si === 0 ? 10 : 0);
        const x = lerp(540, tx, p), y = lerp(590, ty, p);
        const rot = (si % 2 ? 90 : 0) + (si % 2 ? 0 : ang * 0.4) + (1 - p) * 220;
        const hover = si === 0 ? Math.sin(t * 1.5 + i) * 2.2 : 0;
        P(c, { x, y: y + hover, r: rot, s: 0.55 + 0.45 * p, o: p });
        if (c.q) c.q.setAttribute('opacity', 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 3 + i + si)));
      });
      st.systems.forEach((sg, i) => {
        const p = pr(t, 2.4 + si * 0.2 + i * 0.2, 0.6, E.outBack);
        const bx = st.x + (si % 2 ? (si === 1 ? 74 : -74) : (i - 1) * 54), by = st.y + (si % 2 ? (i - 1) * 54 : (si === 0 ? -70 : 70));
        P(sg, { x: bx, y: by, s: p, o: p });
        const a = t * (0.8 + i * 0.4) + si;
        sg.mo.setAttribute('cx', Math.cos(a) * 17); sg.mo.setAttribute('cy', Math.sin(a) * 17);
      });
    });
    // challenge cards + overlays
    const base = 9.2, step = 3.8;
    const k = clamp(Math.floor((t - base + 0.1) / step), -1, 3);
    s.ch.forEach((c, i) => {
      const p = pr(t, 4.4 + i * 0.35, 0.8, E.outQ4);
      const act = k === i ? 1 : 0;
      const on = pr(t, base + i * step - 0.1, 0.4) * (k === i ? 1 : 0.0) + (k > i ? 0 : 0);
      P(c.g, { x: 1360 + (1 - p) * 120, y: 326 + i * 148, s: 1, o: p * (k < 0 ? 1 : k === i ? 1 : 0.5) });
      c.hl.setAttribute('opacity', k === i ? 0.55 + 0.45 * Math.sin(t * 4) * 0.5 : 0);
      c.g.firstChild && 0;
    });
    const w = (i) => (k === i ? clamp(pr(t, base + i * step - 0.1, 0.5)) : 0);
    s.fog.setAttribute('opacity', w(0)); s.net.setAttribute('opacity', w(1)); s.clock.setAttribute('opacity', w(2)); s.fan.setAttribute('opacity', w(3));
    s.fogRings.forEach((r, i) => { r.setAttribute('r', 70 + Math.sin(t * 2 + i) * 6); });
    s.edges.forEach((e, i) => { e.style.strokeDashoffset = -t * 30; });
    const dec = Math.floor(lerp(1, 118, E.inOutC(clamp((t - (base + 2 * step)) / (step - 0.6)))));
    s.clockTxt.textContent = dec >= 100 ? '100+' : String(dec);
    s.fans.forEach((f, i) => { f.__len = f.__len || f.getTotalLength(); const q = pr(t, base + 3 * step + i * 0.12, 0.7, E.outQ); drawOn(f, q); f.setAttribute('stroke-opacity', 0.9); });
    // mini widgets
    s.m0c.forEach((c, i) => P(c, { x: (i - 1) * 46, y: Math.sin(t * 2 + i) * 3, s: 1, r: Math.sin(t * 1.5 + i) * 6 }));
    s.m1n.forEach((n, i) => n.setAttribute('r', 8 + 3 * Math.sin(t * 3 + i * 1.6)));
    s.m1e.forEach((e, i) => e.setAttribute('stroke-opacity', 0.3 + 0.6 * sbump(((t * 0.8 + i / 6) % 1), 0.5, 0.5)));
    s.m2t.forEach((r, i) => { const on = ((t * 6) % 30) > i; r.setAttribute('opacity', on ? 1 : 0.25); });
    s.m2f.setAttribute('opacity', ((t * 6) % 30) > 22 ? 1 : 0.35);
    s.m3p.forEach((p, i) => p.setAttribute('opacity', 0.35 + 0.65 * sbump((t * 0.9 + i * 0.07) % 1.6, 0.6, 0.6)));
    s.m3n.forEach((n, i) => n.setAttribute('r', 4 + 1.5 * Math.sin(t * 3 + i)));
  },
};

// ===================================================================== YARDSTICK
export const yardstick = {
  id: 'yardstick', title: 'The yardstick', dur: 21, mood: [C.gold, C.cyan, C.purple],
  caps: [
    [0.4, 'Every number in this film is one ML seat against *three AdvancedCpuPlayers*.'],
    [4.4, 'Four seats means 25% is nominal parity.'],
    [8.2, 'Measured honestly, a seat-0 AdvCPU wins only *20.0%* against three copies of itself.'],
    [12.6, 'A 300-game eval can be off by about 2.7 points. It misled v6 three times.'],
    [17.6, 'So anything we act on is a *1000-game* eval.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Chapter 0', title: 'How progress is measured', sub: 'Win rate, 1 ML seat vs 3x AdvancedCpuPlayer, seat 0' });
    const cx = 700, cy = 700, r = 330;
    const a0 = Math.PI, a1 = 2 * Math.PI;
    const track = S('path', { d: arcPath(cx, cy, r, a0, a1), fill: 'none', stroke: '#16233a', 'stroke-width': 34, 'stroke-linecap': 'round' }, L);
    const val = S('path', { d: arcPath(cx, cy, r, a0, a1), fill: 'none', stroke: 'url(#gcp)', 'stroke-width': 34, 'stroke-linecap': 'round', filter: 'url(#glow)' }, L);
    val.__len = Math.PI * r;
    const ticks = []; for (let v = 0; v <= 100; v += 10) { const a = lerp(a0, a1, v / 100); const x1 = cx + Math.cos(a) * (r + 30), y1 = cy + Math.sin(a) * (r + 30); const x2 = cx + Math.cos(a) * (r + 42), y2 = cy + Math.sin(a) * (r + 42); S('path', { d: `M${x1} ${y1} L${x2} ${y2}`, stroke: '#3a4d66', 'stroke-width': 2 }, L); T(L, v + '%', { x: cx + Math.cos(a) * (r + 68), y: cy + Math.sin(a) * (r + 68), size: 15, fill: C.faint, m: true }); }
    const marker = (v, col, label, dy) => { const a = lerp(a0, a1, v / 100); const g = G(L); S('path', { d: `M${Math.cos(a) * (r - 26)} ${Math.sin(a) * (r - 26)} L${Math.cos(a) * (r + 28)} ${Math.sin(a) * (r + 28)}`, stroke: col, 'stroke-width': 4, 'stroke-linecap': 'round' }, g); const lb = T(g, label, { x: Math.cos(a) * (r + 118) - 6, y: Math.sin(a) * (r + 118) + dy, size: 19, w: 700, fill: col, m: true, a: 'end' }); g.setAttribute('transform', `translate(${cx} ${cy})`); return g; };
    const m25 = marker(25, C.gold, '25% nominal parity', -4);
    const m20 = marker(20, C.red, '20.0% measured seat-0 baseline', 14);
    const big = T(L, '', { x: cx, y: cy - 40, size: 110, w: 780, fill: C.text, ls: -4 });
    const lab = T(L, 'win rate vs 3x AdvCPU', { x: cx, y: cy + 30, size: 22, fill: C.muted });
    // four seats
    const seatG = G(L); const seatsE = [0, 1, 2, 3].map((i) => { const g = G(seatG); S('circle', { r: 40, fill: i === 0 ? rgba(C.cyan, 0.15) : '#0d1726', stroke: i === 0 ? C.cyan : '#46607e', 'stroke-width': 2.4 }, g); T(g, i === 0 ? 'ML' : 'ADV', { size: 18, w: 800, fill: i === 0 ? C.cyan : C.muted, m: true }); T(g, 'seat ' + i, { y: 60, size: 14, fill: C.faint, m: true }); g.setAttribute('transform', `translate(${1180 + i * 130} 320)`); return g; });
    T(L, '25% = one seat in four', { x: 1375, y: 410, size: 20, fill: C.muted, w: 500 });
    // bell curves
    const bx = 1430, by = 760;
    const bellG = G(L);
    S('path', { d: `M${bx - 300} ${by} L${bx + 300} ${by}`, stroke: '#2b3b52', 'stroke-width': 2 }, bellG);
    const mkBell = (sig, col, id) => { let d = `M${bx - 300} ${by}`; for (let x = -300; x <= 300; x += 5) { const y = Math.exp(-(x * x) / (2 * sig * sig)) * (sig < 60 ? 220 : 120); d += ` L${bx + x} ${by - y}`; } d += ` L${bx + 300} ${by}`; return S('path', { d, fill: rgba(col, 0.12), stroke: col, 'stroke-width': 3, 'stroke-linejoin': 'round' }, bellG); };
    const bell300 = mkBell(100, C.red); const bell1000 = mkBell(55, C.green);
    const bl1 = T(bellG, 'n = 300   σ ≈ 2.7 pts', { x: bx - 150, y: by - 150, size: 19, w: 700, fill: C.red, m: true });
    const bl2 = T(bellG, 'n = 1000   σ ≈ 1.5 pts', { x: bx + 160, y: by - 255, size: 19, w: 700, fill: C.green, m: true });
    const bt = T(bellG, 'EVAL NOISE', { x: bx, y: by + 38, size: 14, w: 700, fill: C.faint, ls: 3 });
    bell1000.__len = bell300.__len = 2000;
    return { hd, val, big, lab, m25, m20, seatsE, seatG, bellG, bell300, bell1000, bl1, bl2, track };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    const grow = pr(t, 0.6, 1.8, E.outQ4);
    const v = lerp(0, 25, grow) + pr(t, 8.4, 1.4, E.inOutC) * -5 + pr(t, 17, 0.1) * 0;
    s.val.style.strokeDasharray = `${s.val.__len} ${s.val.__len + 4}`; s.val.style.strokeDashoffset = `${s.val.__len * (1 - v / 100)}`;
    s.big.textContent = v.toFixed(1) + '%';
    s.big.setAttribute('fill', v < 22 ? C.red : C.text);
    s.lab.setAttribute('opacity', pr(t, 0.8, 0.5));
    P(s.m25, { x: 700, y: 700, o: pr(t, 4.4, 0.5) });
    P(s.m20, { x: 700, y: 700, s: pr(t, 8.4, 0.6, E.outBack), o: pr(t, 8.4, 0.5) });
    s.seatsE.forEach((g, i) => { const p = pr(t, 0.6 + i * 0.12, 0.6, E.outBack); g.setAttribute('transform', `translate(${1180 + i * 130} 320) scale(${p})`); g.setAttribute('opacity', p); });
    const bp = pr(t, 12.4, 0.8);
    s.bellG.setAttribute('opacity', bp);
    s.bell300.setAttribute('opacity', 1); s.bl1.setAttribute('opacity', pr(t, 12.8, 0.5));
    s.bell1000.setAttribute('opacity', pr(t, 16.8, 0.8)); s.bl2.setAttribute('opacity', pr(t, 17.2, 0.5));
    s.bell300.setAttribute('transform', `translate(1430 760) scale(1 ${bp}) translate(-1430 -760)`);
  },
};

export default [title, problem, yardstick];
