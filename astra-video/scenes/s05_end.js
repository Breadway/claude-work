import { S, G, T, P, layer, C, E, pr, clamp, lerp, mix, rgba, bump, sbump, hn, rng, drawOn, travel, fmt, curve, noise } from '../engine/core.js';
import { header, card, pill, stat, buildNet, xf, panel, arcPath, hbar, glyphs } from '../engine/kit.js';

const eio = E.inOutC;
const ORANGE = '#ff9f6b';

// ===================================================================== TEACHER CEILING
export const teacher = {
  id: 'teacher', title: 'The teacher ceiling', dur: 26, ver: 7, mood: [C.gold, C.green, C.cyan],
  caps: [
    [0.4, 'Behaviour cloning has a hard ceiling: a perfect clone of a policy *is* that policy.'],
    [5.6, 'AdvCPU wins 20.0% from seat 0. After two epochs the clone already sat at 19.6%, with 13 epochs left and nothing to gain.'],
    [13.0, 'So the teacher switched to *ExpertCpu*, at 47.5%. The ceiling more than doubles.'],
    [18.6, 'It generates games about 325 times slower. But that is only 5 to 9% of an epoch, so it is cheap.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Astra-7 · training', title: 'BC is bounded by its teacher', sub: 'seat-0 win rate vs 3x AdvCPU, 1000-game evals', accent: C.gold });
    const base = 800, H = 450, sc = (v) => (v / 50) * H;
    const axis = S('path', { d: `M130 ${base} L1180 ${base}`, stroke: '#3a4d66', 'stroke-width': 2 }, L);
    for (const v of [10, 20, 30, 40, 50]) { S('path', { d: `M130 ${base - sc(v)} L1180 ${base - sc(v)}`, stroke: '#1a2a40', 'stroke-width': 1 }, L); T(L, v + '%', { x: 108, y: base - sc(v), size: 14, m: true, fill: C.faint, a: 'end' }); }
    const cols = [['AdvCPU', 'teacher', 20.0, C.blue, 330], ['BC clone', '2 epochs', 19.6, C.cyan, 590], ['ExpertCpu', 'new teacher', 47.5, C.gold, 900]].map(([nm, sub, v, col, x]) => {
      const g = G(L); const b = S('rect', { x: x - 80, y: base, width: 160, height: 0, rx: 14, fill: col, opacity: 0.92 }, g); const val = T(g, '', { x, y: 0, size: 32, w: 800, fill: col, m: true }); T(g, nm, { x, y: base + 34, size: 22, w: 650 }); T(g, sub, { x, y: base + 62, size: 15, w: 450, fill: C.muted, m: true });
      g.b = b; g.val = val; g.v = v; g.x = x; return g;
    });
    const ceil1 = S('path', { d: `M130 ${base - sc(20)} L1000 ${base - sc(20)}`, stroke: C.red, 'stroke-width': 3, 'stroke-dasharray': '10 8' }, L);
    const ceil1T = T(L, 'ceiling', { x: 140, y: base - sc(20) - 16, size: 17, m: true, fill: C.red, a: 'start' });
    const ceil2 = S('path', { d: `M130 ${base - sc(47.5)} L1100 ${base - sc(47.5)}`, stroke: C.gold, 'stroke-width': 3, 'stroke-dasharray': '10 8' }, L);
    const arrow = S('path', { d: `M410 ${base - 140} L500 ${base - 140}`, stroke: C.cyan, 'stroke-width': 3, 'marker-end': 'url(#arr)', fill: 'none' }, L);
    const copyT = T(L, 'copy', { x: 455, y: base - 164, size: 15, m: true, fill: C.cyan });
    const up = T(L, '> 2×', { x: 1070, y: base - sc(33), size: 44, w: 800, fill: C.gold });
    // speed panel
    const sp = panel(L, { w: 520, h: 520, kicker: 'Cost of the better teacher', title: 'Game generation speed', color: C.pink });
    const b1 = G(sp); T(b1, 'AdvCPU', { x: -230, y: -60, size: 20, a: 'start' }); S('rect', { x: -230, y: -40, width: 460, height: 26, rx: 13, fill: '#0d1726', stroke: '#26354a' }, b1); const f1 = S('rect', { x: -230, y: -40, width: 0, height: 26, rx: 13, fill: C.blue }, b1); T(b1, '~909 games/s', { x: 230, y: -60, size: 17, m: true, a: 'end', fill: C.blue });
    const b2 = G(sp); T(b2, 'ExpertCpu', { x: -230, y: 20, size: 20, a: 'start' }); S('rect', { x: -230, y: 40, width: 460, height: 26, rx: 13, fill: '#0d1726', stroke: '#26354a' }, b2); const f2 = S('rect', { x: -230, y: 40, width: 0, height: 26, rx: 13, fill: C.gold }, b2); T(b2, '~2.8 games/s', { x: 230, y: 20, size: 17, m: true, a: 'end', fill: C.gold });
    const x325 = T(sp, '', { x: 0, y: 140, size: 84, w: 800, fill: C.pink, ls: -3 }); const cheap = T(sp, '', { x: 0, y: 208, size: 21, w: 550, fill: C.muted });
    return { hd, axis, cols, ceil1, ceil1T, ceil2, arrow, copyT, up, sp, f1, f2, x325, cheap };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    const base = 800, H = 450, sc = (v) => (v / 50) * H;
    s.cols.forEach((g, i) => {
      const k = [1.2, 5.8, 13.2][i]; const p = E.outQ4(clamp((t - k) / 1.4)); const h = sc(g.v) * p;
      g.b.setAttribute('height', h); g.b.setAttribute('y', base - h); g.val.setAttribute('y', base - h - 26); g.val.textContent = p > 0.02 ? (g.v * p).toFixed(1) + '%' : '';
      g.setAttribute('opacity', pr(t, k - 0.1, 0.3));
    });
    drawOn(s.ceil1, pr(t, 3.0, 1.0, E.outQ)); s.ceil1.setAttribute('opacity', 1 - pr(t, 13.0, 0.6) * 0.65); s.ceil1T.setAttribute('opacity', pr(t, 3.6, 0.5) * (1 - pr(t, 13.0, 0.6) * 0.6));
    drawOn(s.ceil2, pr(t, 14.4, 1.0, E.outQ)); s.ceil2.setAttribute('opacity', pr(t, 14.4, 0.4));
    s.arrow.setAttribute('opacity', pr(t, 5.0, 0.5)); s.copyT.setAttribute('opacity', pr(t, 5.0, 0.5));
    s.up.setAttribute('opacity', pr(t, 15.4, 0.6)); s.up.setAttribute('transform', `translate(0 ${(1 - E.outBack(clamp((t - 15.4) / 0.6))) * 20})`);
    const sp = pr(t, 17.6, 0.8, E.outQ4); P(s.sp, { x: 1530 + (1 - sp) * 80, y: 520, o: sp });
    s.f1.setAttribute('width', 460 * E.outQ4(clamp((t - 18.6) / 1.2))); s.f2.setAttribute('width', Math.max(4, 460 * (2.8 / 909)) * E.outQ4(clamp((t - 19.0) / 1.2)));
    s.x325.textContent = t > 20.0 ? '325×' : ''; s.x325.setAttribute('opacity', pr(t, 20.0, 0.5));
    s.cheap.textContent = t > 21.4 ? 'slower, but only 5–9% of an epoch' : ''; s.cheap.setAttribute('opacity', pr(t, 21.4, 0.5));
  },
};

// ===================================================================== PIPELINE
export const pipeline = {
  id: 'pipeline', title: 'Training pipeline', dur: 32, ver: 7, mood: [C.cyan, C.purple, C.gold],
  caps: [
    [0.4, 'Three stages, each guarded by a *gate*.'],
    [4.4, 'Behaviour cloning on ExpertCpu’s decisions. Gate: at least 25% in a 1000-game eval, aiming for 30 to 40.'],
    [11.2, 'Then TD-value, with lambda 0.9 targets. The value head must rank successor states correctly at least *65%* of the time.'],
    [18.6, 'Only then the AlphaZero league: 400 plus simulations, PUCT, Dirichlet noise scaled to the legal actions, and ExpertCpu in the opponent mix.'],
    [27.0, 'The goal: *55 to 65%* against three AdvCPUs.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Astra-7 · training', title: 'BC → TD-value → AlphaZero', sub: 'No stage starts until the gate before it passes', accent: C.cyan });
    const defs = [
      ['01', 'Behaviour cloning', C.cyan, ['teacher: ExpertCpu', '~20K games per epoch, streamed', 'AdamW 3e-4 · batch 512', 'label smoothing 0.05'], 'GATE  ≥ 25% eval  (aim 30–40%)'],
      ['02', 'TD-value', C.gold, ['TD(λ = 0.9) targets', 'trunk frozen; value head trains', '2–3 regenerate-and-train rounds', 'sampled self-play, T ≈ 0.8'], 'GATE  value-rank ≥ 65%'],
      ['03', 'AlphaZero league', C.purple, ['≥ 400 sims · PUCT c = 1.5', 'Dirichlet ε 0.25, α = 10 / n_legal', 'net 55% · AdvCPU 30% · Expert 15%', 'restart from best after 2 dips'], 'GATE  beat 38.7% within 30 iters'],
    ];
    const cards = defs.map(([k, ti, col, lines, gate], i) => {
      const g = G(L); const w = 540, h = 400;
      S('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 20, fill: 'url(#surface)', stroke: '#2c3e55', 'stroke-width': 1.4, filter: 'url(#soft)' }, g);
      const hl = S('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 20, fill: 'none', stroke: col, 'stroke-width': 2.6, opacity: 0 }, g);
      T(g, k, { x: -w / 2 + 28, y: -h / 2 + 42, size: 34, w: 800, fill: col, m: true, a: 'start', ls: -1 }); T(g, ti, { x: -w / 2 + 96, y: -h / 2 + 42, size: 32, w: 680, a: 'start', ls: -0.6 });
      lines.forEach((ln, j) => { S('circle', { cx: -w / 2 + 36, cy: -h / 2 + 106 + j * 48, r: 5, fill: col }, g); T(g, ln, { x: -w / 2 + 56, y: -h / 2 + 106 + j * 48, size: 20.5, w: 480, a: 'start', fill: '#c6d3e3' }); });
      const gt = G(g); gt.setAttribute('transform', `translate(0 ${h / 2 - 50})`);
      S('rect', { x: -w / 2 + 22, y: -26, width: w - 44, height: 52, rx: 14, fill: '#0b1320', stroke: '#33506a', 'stroke-width': 1.8, 'stroke-dasharray': '6 5' }, gt);
      const lock = G(gt); lock.setAttribute('transform', `translate(${-w / 2 + 56} 0)`); S('rect', { x: -11, y: -3, width: 22, height: 17, rx: 3.5, fill: '#7aa0c2' }, lock); const sh = S('path', { d: 'M-6 -3 V-9 a6 6 0 0 1 12 0 V-3', stroke: '#7aa0c2', 'stroke-width': 3, fill: 'none' }, lock);
      T(gt, gate, { x: -w / 2 + 88, y: 0, size: 17, w: 650, a: 'start', m: true, fill: C.muted });
      g.hl = hl; g.lock = lock; g.sh = sh; g.gt = gt; g.col = col; return g;
    });
    const ar = [0, 1].map((i) => S('path', { d: 'M0 0', stroke: '#4a6680', 'stroke-width': 3, 'stroke-dasharray': '8 8', fill: 'none', 'marker-end': 'url(#arr)' }, L));
    const goal = G(L); S('rect', { x: -360, y: -38, width: 720, height: 76, rx: 18, fill: '#0b1320', stroke: C.green, 'stroke-width': 2.4 }, goal); T(goal, 'Goal  55–65%  vs 3x AdvCPU', { x: 0, y: -6, size: 32, w: 700, fill: C.green }); T(goal, 'v6 plateau 38.7%  ·  ExpertCpu 47.5%', { x: 0, y: 24, size: 17, m: true, fill: C.muted });
    return { hd, cards, ar, goal };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    const X = [330, 960, 1590];
    s.cards.forEach((g, i) => { const p = pr(t, 0.9 + i * 0.4, 0.8, E.outQ4); P(g, { x: X[i], y: 500 + (1 - p) * 70, o: p }); });
    s.ar.forEach((a, i) => { a.setAttribute('d', `M${X[i] + 280} 500 L${X[i + 1] - 290} 500`); a.style.strokeDashoffset = -t * 24; a.setAttribute('opacity', pr(t, 2.4 + i * 0.3, 0.5)); });
    const A = t < 4.4 ? -1 : t < 11.2 ? 0 : t < 18.6 ? 1 : t < 27 ? 2 : 3;
    s.cards.forEach((g, i) => {
      g.hl.setAttribute('opacity', A === i ? 0.6 + 0.4 * Math.sin(t * 4) : 0);
      const unlock = [9.6, 16.8, 25.6][i]; const u = pr(t, unlock, 0.5, E.outBack);
      g.sh.setAttribute('transform', `translate(${u * 8} ${-u * 5}) rotate(${-u * 28} 6 -3)`);
      g.lock.setAttribute('opacity', 1); g.gt.firstChild.setAttribute('stroke', u > 0.5 ? C.green : '#33506a'); g.gt.firstChild.setAttribute('stroke-dasharray', u > 0.5 ? '' : '6 5');
      g.lock.firstChild.setAttribute('fill', u > 0.5 ? C.green : '#7aa0c2'); g.sh.setAttribute('stroke', u > 0.5 ? C.green : '#7aa0c2');
    });
    const gq = pr(t, 27.0, 0.8, E.outBack); P(s.goal, { x: 960, y: 800, s: gq, o: gq });
  },
};

// ===================================================================== BUGS
export const debug = {
  id: 'debug', title: 'The bugs', dur: 44, ver: 7, mood: [C.red, C.gold, C.purple],
  caps: [
    [0.4, 'Part of the story is bugs. Each one cost hours.'],
    [4.2, 'A “best checkpoint” silently overwritten by the final save. set_extension replaces the extension.'],
    [12.6, 'A GPU that quietly became a CPU. The linker dropped libtorch_cuda: no error, just slow.'],
    [20.8, 'A “fresh game” check inferred from the turn number broke twice. Now it is an explicit flag.'],
    [29.0, 'ExpertCpu’s search lived in the with-state methods, so the recorder trained on AdvCPU quality for epochs. A timing number that did not add up caught it.'],
    [38.0, 'And decide options with *identical tokens*: stuck at 60% until a slot field made them distinct.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Astra-7 · hard lessons', title: 'Five bugs that looked like progress', sub: 'Every one produced plausible numbers', accent: C.red });
    const items = [['best checkpoint overwritten', C.gold], ['GPU silently on CPU', C.cyan], ['“fresh game” guard broke twice', C.purple], ['ExpertCpu routed to AdvCPU', C.pink], ['byte-identical decide tokens', C.green]].map(([nm, col], i) => {
      const g = G(L); S('rect', { x: 0, y: -30, width: 560, height: 60, rx: 14, fill: '#0b1320', stroke: '#26354a', 'stroke-width': 1.4 }, g); const hl = S('rect', { x: 0, y: -30, width: 560, height: 60, rx: 14, fill: rgba(col, 0.1), stroke: col, 'stroke-width': 2.2, opacity: 0 }, g); T(g, '0' + (i + 1), { x: 30, y: 0, size: 24, w: 800, fill: col, m: true }); T(g, nm, { x: 70, y: 0, size: 22, w: 580, a: 'start' }); g.setAttribute('transform', `translate(100 ${300 + i * 84})`); g.hl = hl; g.col = col; return g;
    });
    // terminal
    const term = G(L); term.setAttribute('transform', 'translate(700 250)');
    S('rect', { x: 0, y: 0, width: 1120, height: 560, rx: 18, fill: '#080e18', stroke: '#2c3e55', 'stroke-width': 1.6, filter: 'url(#soft)' }, term); S('rect', { x: 0, y: 0, width: 1120, height: 48, rx: 18, fill: '#0f1a2b' }, term); S('rect', { x: 0, y: 30, width: 1120, height: 18, fill: '#0f1a2b' }, term);
    [C.red, C.gold, C.green].forEach((c, i) => S('circle', { cx: 28 + i * 26, cy: 24, r: 7, fill: c, opacity: 0.85 }, term));
    const tt = T(term, '', { x: 560, y: 24, size: 16, m: true, fill: C.muted });
    const lines = Array.from({ length: 8 }, (_, i) => T(term, '', { x: 36, y: 100 + i * 52, size: 22, m: true, a: 'start', w: 450 }));
    const badge = G(term); badge.setAttribute('transform', 'translate(560 510)');
    const bt = T(badge, '', { x: 0, y: 0, size: 24, w: 700, fill: C.green });
    return { hd, items, term, tt, lines, badge, bt };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.items.forEach((g, i) => { const p = pr(t, 0.8 + i * 0.2, 0.6, E.outQ4); P(g, { x: 100 + (1 - p) * -60, y: 300 + i * 84, o: p }); });
    const tp = pr(t, 1.2, 0.7, E.outQ4); s.term.setAttribute('opacity', tp);
    const RED = C.red, GRN = C.green, MUT = '#5d7390', TXT = '#d7e2f0', GLD = C.gold;
    const chapters = [
      { t0: 4.2, title: 'ml7/src/main.rs · run_bc', lines: [['// best-epoch checkpoint', MUT], ['let best = format!("{out}.best");', TXT], ['save_file(best)  →  set_extension("bin")', RED], ['writes  "{out}.bin"  — the final-save path', RED], ['', TXT], ['fix: format!("{out}_best")', GRN]], badge: 'two files now survive' },
      { t0: 12.6, title: 'ml7/build.rs · linking', lines: [['cargo:rustc-link-lib=torch_cuda', TXT], ['// --as-needed drops it: nothing references a symbol', MUT], ['Cuda::is_available()  →  false', RED], ['(no error, no panic, just CPU)', RED], ['fix: -Wl,--no-as-needed -ltorch_cuda', GRN], ['check: ldd bin | grep torch_cuda', GLD]], badge: 'GPU is real again' },
      { t0: 20.8, title: 'engine/src/game.rs · run()', lines: [['// is this a fresh game?', MUT], ['if state.turn_number == 0 { deal() }', RED], ['// GameState::new starts at turn 1  → never true', MUT], ['hands never dealt, twice, in two guises', RED], ['', TXT], ['fix: explicit  hands_dealt: bool', GRN]], badge: 'regression tests added' },
      { t0: 29.0, title: 'ml7/src/recorder.rs · BcRecorder', lines: [['override choose_action, respond_to_chain', TXT], ['// ExpertCpu search lives in *_with_state', MUT], ['default _with_state  →  AdvCPU fallback', RED], ['“200 games in 0.3 s”  vs  ~2.8 games/s', RED], ['…arithmetically impossible → caught', GLD], ['fix: override both _with_state methods', GRN]], badge: 'teacher is really ExpertCpu' },
      { t0: 38.0, title: 'ml7/src/tokens.rs · decide options', lines: [['option A  →  [Act, decide, 3, 0, 0, 0, 0, 0]', TXT], ['option B  →  [Act, decide, 3, 0, 0, 0, 0, 0]', TXT], ['byte-identical → cannot be told apart', RED], ['DecideOption accuracy  60.0%', RED], ['fix: + slot index, + option count fields', GRN], ['quick re-run  →  72.0%', GRN]], badge: '60.0% → 72.0%' },
    ];
    let cur = -1; chapters.forEach((c, i) => { if (t >= c.t0 - 0.2) cur = i; });
    s.items.forEach((g, i) => g.hl.setAttribute('opacity', i === cur ? 0.7 + 0.3 * Math.sin(t * 4) : 0));
    if (cur < 0) { s.tt.textContent = ''; s.lines.forEach((l) => l.textContent = ''); s.bt.textContent = ''; return; }
    const c = chapters[cur], lt = t - c.t0;
    s.tt.textContent = c.title;
    s.lines.forEach((l, i) => {
      const ln = c.lines[i]; if (!ln) { l.textContent = ''; return; }
      const st = 0.5 + i * 0.85; const p = clamp((lt - st) / 0.7);
      l.textContent = ln[0].slice(0, Math.floor(p * ln[0].length)); l.setAttribute('fill', ln[1]); l.setAttribute('opacity', p > 0 ? 1 : 0);
    });
    const bp = pr(lt, 6.4, 0.5, E.outBack);
    s.bt.textContent = bp > 0.05 ? '✓  ' + c.badge : ''; s.bt.setAttribute('opacity', bp);
  },
};

// ===================================================================== FIDELITY
export const fidelity = {
  id: 'fidelity', title: 'Fidelity', dur: 26, ver: 7, mood: [C.green, C.cyan, C.gold],
  caps: [
    [0.4, 'A per-decision-kind diagnostic showed exactly where the clone was weak.'],
    [4.8, 'Chain responses were fine: 100% and 95.4%. So no history event tagging was needed.'],
    [10.6, 'Decide options, 43% of all decisions, were stuck at 60%.'],
    [14.8, 'Position fields lifted a quick test to 72%. Pick-target, at 19.7%, is flagged for the next run.'],
    [20.4, 'Validation accuracy on the small run still climbed, 73.3% to 75.5%: underfit on only about 1,200 games.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Astra-7 · diagnostics', title: 'Accuracy by decision kind', sub: '124,201 held-out samples · 7-epoch Atlas run', accent: C.green });
    const rowsD = [['ChainResponsePass', 100.0, 4834, C.green], ['ChainResponseCard', 95.4, 26165, C.green], ['DecideOption', 60.0, 52893, C.red], ['PickTargetOption', 19.7, 2090, C.red]];
    const rows = rowsD.map(([nm, v, n, col], i) => {
      const g = G(L); const y = 330 + i * 110;
      T(g, nm, { x: 110, y: y - 14, size: 24, w: 650, a: 'start' }); T(g, 'n = ' + fmt(n), { x: 110, y: y + 16, size: 16, m: true, a: 'start', fill: C.faint });
      S('rect', { x: 430, y: y - 22, width: 560, height: 44, rx: 22, fill: '#0d1726', stroke: '#26354a' }, g); const f = S('rect', { x: 430, y: y - 22, width: 0, height: 44, rx: 22, fill: col }, g); const tt = T(g, '', { x: 0, y, size: 22, w: 800, a: 'end', m: true, fill: '#07101c' });
      g.f = f; g.tt = tt; g.v = v; g.y = y; g.col = col; return g;
    });
    const fixM = S('rect', { x: 430, y: 330 + 220 - 22, width: 0, height: 44, rx: 22, fill: C.green, opacity: 0.0 }, L);
    const fixT = pill(L, '→ 72.0% after slot fields', { x: 1190, y: 550, color: C.green, size: 16, w: 290, h: 34 });
    const tot = stat(L, { x: 300, y: 790, label: 'whole-model accuracy', color: C.gold, w: 360, h: 110, suffix: '%', dec: 1, big: 48 });
    // curve
    const pg = panel(L, { w: 640, h: 500, kicker: 'BC validation accuracy', title: 'Small Atlas run', color: C.cyan });
    const cg = G(pg); cg.setAttribute('transform', 'translate(10 50)');
    const pts = [[1, 73.32], [2, 74.45], [3, 74.60], [4, 74.77], [7, 75.46]]; const W = 500, Hh = 260; const x = (e) => -W / 2 + ((e - 1) / 6) * W, y = (v) => lerp(Hh / 2, -Hh / 2, (v - 73) / 3);
    for (const v of [73, 74, 75, 76]) { S('path', { d: `M${-W / 2 - 10} ${y(v)} L${W / 2 + 10} ${y(v)}`, stroke: '#1a2a40' }, cg); T(cg, v + '%', { x: -W / 2 - 24, y: y(v), size: 14, m: true, fill: C.faint, a: 'end' }); }
    const line = S('path', { d: pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0])} ${y(p[1])}`).join(' '), stroke: C.cyan, 'stroke-width': 4, fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round', filter: 'url(#glow)' }, cg);
    const dots = pts.map((p) => { const g = G(cg); S('circle', { r: 9, fill: C.cyan }, g); T(g, p[1].toFixed(2), { x: 0, y: -26, size: 16, m: true, w: 650, fill: C.cyan }); g.setAttribute('transform', `translate(${x(p[0])} ${y(p[1])})`); T(cg, 'e' + p[0], { x: x(p[0]), y: Hh / 2 + 26, size: 15, m: true, fill: C.muted }); return g; });
    const gap = T(cg, 'e5–e6 not reported', { x: (x(4) + x(7)) / 2, y: Hh / 2 + 52, size: 14, m: true, fill: C.faint });
    return { hd, rows, fixM, fixT, tot, pg, line, dots, gap };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    s.rows.forEach((g, i) => {
      const k = [2.0, 5.0, 10.8, 15.2][i]; const p = E.outQ4(clamp((t - k) / 1.2)); const w = Math.max(44, (g.v / 100) * 560 * p);
      g.setAttribute('opacity', pr(t, k - 0.4, 0.4)); g.f.setAttribute('width', g.v * p > 0.1 ? w : 0); g.tt.setAttribute('x', 430 + w - 14); g.tt.textContent = p > 0.02 ? (g.v * p).toFixed(1) + '%' : '';
    });
    // DecideOption improves to 72
    const imp = E.inOutC(clamp((t - 14.2) / 1.4));
    const row = s.rows[2]; const v = lerp(60.0, 72.0, imp); const w = (v / 100) * 560; if (t > 14.2) { row.f.setAttribute('width', w); row.tt.setAttribute('x', 430 + w - 14); row.tt.textContent = v.toFixed(1) + '%'; row.f.setAttribute('fill', mix(C.red, C.gold, imp)); }
    P(s.fixT, { x: 1190, y: 550, s: pr(t, 15.0, 0.5, E.outBack), o: pr(t, 15.0, 0.4) });
    s.tot.set(77.2, pr(t, 2.0, 0.5), 1); s.tot.g.setAttribute('transform', `translate(300 800) scale(${pr(t, 2.0, 0.5, E.outBack)})`);
    const pg = pr(t, 19.6, 0.8, E.outQ4); P(s.pg, { x: 1500, y: 560 + (1 - pg) * 50, o: pg });
    drawOn(s.line, pr(t, 20.4, 2.4, E.inOutC));
    s.dots.forEach((d, i) => { const p = pr(t, 20.4 + i * 0.5, 0.4, E.outBack); const [px, py] = d.getAttribute('transform').match(/-?\d+(\.\d+)?/g); d.setAttribute('opacity', p); });
    s.gap.setAttribute('opacity', pr(t, 23.0, 0.5));
  },
};

// ===================================================================== STANDING
export const standing = {
  id: 'standing', title: 'Where it stands', dur: 40, ver: 7, mood: [C.cyan, C.purple, C.gold],
  caps: [
    [0.4, 'Here is the whole climb, using only numbers the docs actually record.'],
    [5.0, 'An early jump, a plateau around 45, then a crash from one random head.'],
    [12.2, 'The v5 win rate was never recorded. Then the neural network plateau at *38.7%* in v6.'],
    [19.2, 'The honest bar is ExpertCpu: *47.5%*, a heuristic bot with search.'],
    [26.0, 'Astra-7’s code is built end to end: tokenizer, transformer, cloning, TD-value, league. Real training numbers are the next chapter.'],
    [34.0, 'The target: *55 to 65%* against three AdvCPUs.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'The full picture', title: 'Win rate across seven generations', sub: '1 ML seat vs 3x AdvCPU · only recorded numbers', accent: C.cyan });
    const X0 = 190, X1 = 1760, Y0 = 800, Y1 = 270, vmin = 15, vmax = 70;
    const y = (v) => lerp(Y0, Y1, (v - vmin) / (vmax - vmin));
    for (let v = 20; v <= 70; v += 10) { S('path', { d: `M${X0} ${y(v)} L${X1} ${y(v)}`, stroke: '#18273b', 'stroke-width': 1 }, L); T(L, v + '%', { x: X0 - 16, y: y(v), size: 15, m: true, fill: C.faint, a: 'end' }); }
    const labels = [['v1', 'REINFORCE'], ['v2', 'value baseline'], ['v3', 'PPO + pool'], ['v4', 'random head'], ['v5', 'schedule fix'], ['v6', 'AlphaZero'], ['Expert', 'heuristic'], ['v7', 'transformer']];
    const xs = labels.map((_, i) => X0 + 80 + i * ((X1 - X0 - 160) / 7));
    labels.forEach(([a, b], i) => { T(L, a, { x: xs[i], y: Y0 + 34, size: 22, w: 700, m: true, fill: i === 6 ? C.gold : i === 7 ? C.green : C.text }); T(L, b, { x: xs[i], y: Y0 + 62, size: 14.5, w: 450, fill: C.muted }); });
    const par = S('path', { d: `M${X0} ${y(25)} L${X1} ${y(25)}`, stroke: C.gold, 'stroke-width': 2, 'stroke-dasharray': '6 7' }, L); T(L, 'parity 25%', { x: X1, y: y(25) + 18, size: 14, m: true, fill: C.gold, a: 'end' });
    const real = [[0, 24.5, C.red], [1, 45, C.blue], [2, 43.8, C.purple], [3, 26.6, C.red]]; const real2 = [[5, 38.7, C.purple]];
    const lineA = S('path', { d: real.map((p, i) => `${i ? 'L' : 'M'}${xs[p[0]]} ${y(p[1])}`).join(' '), stroke: 'url(#gcp)', 'stroke-width': 4.5, fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round', filter: 'url(#glow)' }, L);
    const dotG = G(L);
    const mkDot = (i, v, c, label, hollow = false, dy = -30) => { const g = G(dotG); S('circle', { r: 12, fill: hollow ? '#0b1320' : c, stroke: c, 'stroke-width': 3.5 }, g); T(g, label, { x: 0, y: dy, size: 21, w: 760, m: true, fill: c }); g.setAttribute('transform', `translate(${xs[i]} ${y(v)})`); return g; };
    const dots = [mkDot(0, 24.5, C.red, '24.5%', false, 32), mkDot(1, 45, C.blue, '~45%', false, 36), mkDot(2, 43.8, C.purple, '43.8%', false, 32), mkDot(3, 26.6, C.red, '26.6%', false, 32), mkDot(5, 38.7, C.purple, '38.7%', false, 32)];
    const hyb = mkDot(5, 42.0, C.cyan, '42.0% hybrid', false, -30);
    // v5 unknown
    const unk = G(L); S('path', { d: `M${xs[4]} ${y(65)} L${xs[4]} ${y(18)}`, stroke: '#46607e', 'stroke-width': 2.4, 'stroke-dasharray': '4 8' }, unk); const q = G(unk); S('circle', { r: 22, fill: '#0b1320', stroke: '#46607e', 'stroke-width': 3, 'stroke-dasharray': '5 5' }, q); T(q, '?', { size: 26, w: 800, fill: C.muted }); q.setAttribute('transform', `translate(${xs[4]} ${y(41)})`); T(unk, 'not recorded', { x: xs[4], y: y(41) + 50, size: 16, m: true, fill: C.faint });
    // expert band
    const ex = G(L); S('rect', { x: xs[6] - 54, y: y(47.5 + 0.9), width: 108, height: y(47.5 - 0.9) - y(47.5 + 0.9), rx: 8, fill: rgba(C.gold, 0.5) }, ex);
    const exLine = S('path', { d: `M${X0} ${y(47.5)} L${xs[6] + 54} ${y(47.5)}`, stroke: C.gold, 'stroke-width': 2.6, 'stroke-dasharray': '10 7' }, L);
    const exDot = mkDot(6, 47.5, C.gold, '47.5%', false, -34);
    // target band
    const tg = G(L); S('rect', { x: xs[7] - 70, y: y(65), width: 140, height: y(55) - y(65), rx: 14, fill: rgba(C.green, 0.18), stroke: C.green, 'stroke-width': 2.6, 'stroke-dasharray': '8 6' }, tg); T(tg, '55–65%', { x: xs[7], y: (y(65) + y(55)) / 2 - 4, size: 28, w: 780, m: true, fill: C.green }); T(tg, 'target', { x: xs[7], y: (y(65) + y(55)) / 2 + 28, size: 15, m: true, fill: C.green });
    const tg2 = T(L, 'BC eval pending', { x: xs[7], y: y(35), size: 16, m: true, fill: C.faint });
    return { hd, lineA, dots, hyb, unk, ex, exLine, exDot, tg, tg2, xs, y };
  },
  update(t, s) {
    s.hd.update(t, 0.1);
    const lp = pr(t, 1.2, 9.0, E.inOutC); // line draw across v1..v4
    drawOn(s.lineA, clamp(lp * 1.0));
    const dStart = [1.6, 3.6, 6.0, 8.2, 14.0]; // v1,v2,v3,v4,v6
    s.dots.forEach((g, i) => { const p = pr(t, dStart[i], 0.5, E.outBack); P(g, { x: s.xs[[0, 1, 2, 3, 5][i]], y: s.y([24.5, 45, 43.8, 26.6, 38.7][i]), s: p, o: p }); });
    P(s.hyb, { x: s.xs[5], y: s.y(42.0), s: pr(t, 14.6, 0.5, E.outBack), o: pr(t, 14.6, 0.4) });
    s.unk.setAttribute('opacity', pr(t, 12.4, 0.8));
    s.ex.setAttribute('opacity', pr(t, 19.4, 0.6)); drawOn(s.exLine, pr(t, 19.4, 1.2, E.outQ)); s.exLine.setAttribute('opacity', pr(t, 19.4, 0.3));
    P(s.exDot, { x: s.xs[6], y: s.y(47.5), s: pr(t, 20.2, 0.5, E.outBack), o: pr(t, 20.2, 0.4) });
    const tp = pr(t, 26.8, 0.9, E.outQ4); s.tg.setAttribute('opacity', tp); s.tg.setAttribute('transform', `translate(0 ${(1 - tp) * 30})`);
    s.tg.firstChild.setAttribute('stroke-opacity', 0.7 + 0.3 * Math.sin(t * 3)); s.tg2.setAttribute('opacity', pr(t, 28.0, 0.6));
  },
};

// ===================================================================== OUTRO
export const outro = {
  id: 'outro', title: 'Next', dur: 20, ver: null, mood: [C.cyan, C.purple, C.gold], drift: 0.04,
  caps: [
    [0.6, 'Next: rent a single 4090-class GPU and run behaviour cloning properly: about 20,000 games per epoch, batch 512.'],
    [7.0, 'Then clear the TD-value gate, and run the AlphaZero league on the same box.'],
    [12.4, 'From 24.5% to a *55 to 65%* target. The next chapter is training.'],
  ],
  build(root) {
    const L = layer(root);
    const steps = [['1', 'Scale BC', 'rent a 4090-class GPU · ~20K games/epoch · batch 512 · warmup + cosine LR', C.cyan], ['2', 'Pass the value gate', 'TD-value, value-rank ≥ 65% before any search', C.gold], ['3', 'Run the league', '≥ 400 sims · ExpertCpu in the pool · restart from best', C.purple]].map(([k, ti, su, col], i) => {
      const g = G(L); const w = 1200, h = 100; S('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 18, fill: 'url(#surface)', stroke: '#2c3e55', 'stroke-width': 1.4, filter: 'url(#soft)' }, g); S('rect', { x: -w / 2, y: -h / 2 + 14, width: 5, height: h - 28, rx: 2.5, fill: col }, g);
      T(g, k, { x: -w / 2 + 52, y: 0, size: 48, w: 800, fill: col, m: true }); T(g, ti, { x: -w / 2 + 110, y: -16, size: 30, w: 680, a: 'start', ls: -0.5 }); T(g, su, { x: -w / 2 + 110, y: 24, size: 19, w: 450, a: 'start', fill: C.muted });
      g.setAttribute('transform', `translate(960 ${390 + i * 122})`); return g;
    });
    const word = glyphs(L, 'ASTRA', { x: 960, y: 190, size: 130, w: 800, ls: -5 });
    const tag = T(L, 'Seven generations. One honest benchmark.', { x: 960, y: 790, size: 32, w: 560, fill: C.muted });
    return { steps, word, tag };
  },
  update(t, s) {
    s.word.update(t, 0.2);
    s.steps.forEach((g, i) => { const p = pr(t, 1.4 + i * 3.2, 0.8, E.outQ4); P(g, { x: 960 + (1 - p) * 120, y: 390 + i * 122, o: p }); });
    s.tag.setAttribute('opacity', pr(t, 13.4, 0.9));
  },
};
