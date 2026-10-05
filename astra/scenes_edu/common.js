import { S, G, T, P, layer, C, E, pr, clamp, lerp, mix, rgba, fmt, hn, drawOn, sbump } from '../engine/core.js';
import { TH, CARD, CAT_COL, cardFace, cardName } from '../engine/edukit.js';
import { header, pill, panel } from '../engine/kit.js';

export { S, G, T, P, layer, C, E, pr, clamp, lerp, mix, rgba, fmt, hn, drawOn, sbump, TH, CARD, CAT_COL, cardFace, cardName, header, pill, panel };

export const STAR_COL = { YellowDwarf: '#ffd479', WhiteDwarf: '#e8f1ff', RedDwarf: '#ff8a7a', BrownDwarf: '#c49a6c', RedGiant: '#ff6f5e', RedSupergiant: '#ff4d6d', Protostar: '#9aabc1' };
export const DISC_COL = { AsteroidBelt: '#a9b4c4', DwarfPlanet: '#c7a6ff', RockyPlanet: '#ff9f6b', GasGiant: '#8fd3ff', Comet: '#7be3d5' };
export const STAR_LABEL = { YellowDwarf: 'Yellow Dwarf', WhiteDwarf: 'White Dwarf', RedDwarf: 'Red Dwarf', BrownDwarf: 'Brown Dwarf' };

/** a solar system glyph: star + orbiting discovery slots. centred at 0,0. */
export function systemGlyph(parent, sys, { r = 34, label = true } = {}) {
  const g = G(parent); const col = STAR_COL[sys.star] || '#fff'; const n = sys.class, have = sys.discoveries.length;
  S('circle', { r: r + 26, fill: 'none', stroke: '#2b3b52', 'stroke-width': 1.4, 'stroke-dasharray': '3 6' }, g);
  S('circle', { r: r * 0.55 + sys.class, fill: col, filter: 'url(#glow)' }, g);
  const slots = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2; const x = Math.cos(a) * (r + 26), y = Math.sin(a) * (r + 26);
    const d = sys.discoveries[i]; const c = S('circle', { cx: x, cy: y, r: 9, fill: d ? DISC_COL[d] : '#0b1320', stroke: d ? DISC_COL[d] : '#46607e', 'stroke-width': 2 }, g); slots.push(c);
  }
  if (sys.eclipse) S('circle', { r: r + 40, fill: 'none', stroke: '#9be5a0', 'stroke-width': 3, opacity: 0.85 }, g);
  if (label) T(g, `${STAR_LABEL[sys.star] || sys.star} · class ${sys.class}`, { y: r + 58, size: 14, fill: TH.dim, m: true });
  if (have === n) T(g, 'COMPLETE', { y: -r - 44, size: 12, w: 700, fill: '#9be5a0', ls: 2, m: true });
  g.slots = slots; return g;
}
export const seatLabel = (g, s, x, y, col = TH.dim) => T(g, s, { x, y, size: 15, w: 700, fill: col, ls: 2.4, m: true, caps: true });
export const shortAct = (a) => {
  const nm = (k) => cardName(k);
  switch (a.kind) {
    case 'Pass': return 'Pass';
    case 'PlayFracture': case 'PlayFlare': return 'Play ' + nm(a.card);
    case 'PlayDiscovery': return `${nm(a.card)} → system ${+a.onto + 1}`;
    case 'PlayProtostar': return a.choice === 'DrawTwo' ? 'Protostar → draw two' : 'Protostar → search White Dwarf';
    default: return a.kind;
  }
};
