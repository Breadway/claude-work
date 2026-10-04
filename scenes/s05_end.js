import { S, G, T, P, layer, C, E, pr, clamp, lerp, mix, rgba, bump, sbump, hn, rng, drawOn, travel, fmt, curve, noise } from '../engine/core.js';
import { header, card, pill, stat, buildNet, xf, panel, arcPath, hbar, glyphs } from '../engine/kit.js';

const eio = E.inOutC;
const ORANGE = '#ff9f6b';

// ===================================================================== BUGS
export const debug = {
  id: 'debug', title: 'The bugs', dur: 56, ver: 7, mood: [C.red, C.gold, C.purple],
  caps: [
    [0.4, 'Part of the story is bugs. Each one cost hours.'],
    [4.2, 'A “best checkpoint” silently overwritten by the final save. The first fix still failed for paths ending in dot-bin.'],
    [12.6, 'A GPU that quietly became a CPU. The linker dropped libtorch_cuda: no error, just slow.'],
    [20.8, 'A “fresh game” check inferred from the turn number broke twice. Now it is an explicit flag.'],
    [29.0, 'ExpertCpu’s search lived in the with-state methods, so the recorder trained on AdvCPU quality for epochs. A timing number that did not add up caught it.'],
    [38.0, 'And decide options with *identical tokens*: stuck at 60% until a slot field made them distinct.'],
    [46.6, 'Last, a scanner found *10.4%* of live decisions had duplicate action tokens: the encoder knew a card’s type, not which copy.'],
  ],
  build(root) {
    const L = layer(root);
    const hd = header(L, { kicker: 'Astra-7 · hard lessons', title: 'Six bugs that looked like progress', sub: 'Every one produced plausible numbers', accent: C.red });
    const items = [['best checkpoint overwritten', C.gold], ['GPU silently on CPU', C.cyan], ['“fresh game” guard broke twice', C.purple], ['ExpertCpu routed to AdvCPU', C.pink], ['byte-identical decide tokens', C.green], ['10% of decisions had duplicate tokens', C.blue]].map(([nm, col], i) => {
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
      { t0: 4.2, title: 'ml7/src/main.rs · run_bc', lines: [['// best-epoch checkpoint path', MUT], ['best = format!("{out}_best");   // 1st fix', TXT], ['"foo.bin_best" → set_extension("bin")', RED], ['→ "foo.bin": the final-save path again', RED], ['', TXT], ['fix: file_stem("foo") + "_best"', GRN]], badge: 'two files now survive' },
      { t0: 12.6, title: 'ml7/build.rs · linking', lines: [['cargo:rustc-link-lib=torch_cuda', TXT], ['// --as-needed drops it: nothing references a symbol', MUT], ['Cuda::is_available()  →  false', RED], ['(no error, no panic, just CPU)', RED], ['fix: -Wl,--no-as-needed -ltorch_cuda', GRN], ['check: ldd bin | grep torch_cuda', GLD]], badge: 'GPU is real again' },
      { t0: 20.8, title: 'engine/src/game.rs · run()', lines: [['// is this a fresh game?', MUT], ['if state.turn_number == 0 { deal() }', RED], ['// GameState::new starts at turn 1  → never true', MUT], ['hands never dealt, twice, in two guises', RED], ['', TXT], ['fix: explicit  hands_dealt: bool', GRN]], badge: 'regression tests added' },
      { t0: 29.0, title: 'ml7/src/recorder.rs · BcRecorder', lines: [['override choose_action, respond_to_chain', TXT], ['// ExpertCpu search lives in *_with_state', MUT], ['default _with_state  →  AdvCPU fallback', RED], ['“200 games in 0.3 s”  vs  ~2.8 games/s', RED], ['…arithmetically impossible → caught', GLD], ['fix: override both _with_state methods', GRN]], badge: 'teacher is really ExpertCpu' },
      { t0: 38.0, title: 'ml7/src/tokens.rs · decide options', lines: [['option A  →  [Act, decide, 3, 0, 0, 0, 0, 0]', TXT], ['option B  →  [Act, decide, 3, 0, 0, 0, 0, 0]', TXT], ['byte-identical → cannot be told apart', RED], ['DecideOption accuracy  60.0%', RED], ['fix: + slot index, + option count fields', GRN], ['quick re-run  →  72.0%', GRN]], badge: '60.0% → 72.0%' },
      { t0: 46.6, title: 'ml7 token-scan · live play', lines: [['legal-action tokens, 30 live games', TXT], ['10.4% of decisions had duplicates', RED], ['encoder: card type yes, which copy no', RED], ['// same hand, different physical card', MUT], ['fix: hand slot, target index, set hash', GRN], ['collision rate 1.41% → 0.92%', GRN]], badge: 'collisions cut' },
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
    [14.8, 'Position fields lifted a quick test to 72%. Pick-target at 19.7% was another token collision: fixed, not yet re-measured.'],
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
