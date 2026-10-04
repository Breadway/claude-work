"""Builds the voiceover script + size estimate from out/timeline.json (captions == narration).
    python3 voiceover.py   -> out/voiceover_script.md, out/voiceover_segments.json
"""
import json, re, os
FILM = os.environ.get('FILM', 'astra'); D = 'out' if FILM == 'astra' else f'out/{FILM}'
tl = json.load(open(f'{D}/timeline.json'))
segs = []; md = ['# ASTRA film: voiceover script', '', 'One block per on-screen caption. `at` is the absolute film time in seconds when the caption appears;',
                 'a narration take should start at or just after it and fit before the next caption.', '']
tw = tc = 0
for s in tl['scenes']:
    md.append(f"## {s['title']}  (scene `{s['id']}`, starts {s['start']:.1f}s, {s['dur']:.0f}s long)"); md.append('')
    caps = s['caps']
    for i, (t, txt) in enumerate(caps):
        plain = txt.replace('*', '')
        nxt = caps[i + 1][0] if i + 1 < len(caps) else s['dur'] - 0.2
        window = nxt - t
        words = len(plain.split()); tw += words; tc += len(plain)
        need = words / 2.5   # ~150 wpm
        segs.append({'scene': s['id'], 'at': round(s['start'] + t, 2), 'window_s': round(window, 2), 'words': words, 'chars': len(plain), 'est_speech_s': round(need, 1), 'text': plain})
        flag = '' if need <= window + 0.3 else f'   **(tight: speech ~{need:.1f}s vs {window:.1f}s window)**'
        md.append(f"- `at {s['start'] + t:7.2f}s`  {plain}{flag}")
    md.append('')
md.append(f'---\nTotals: {len(segs)} captions, {tw} words, {tc} characters, ~{tw / 150:.1f} min of speech at 150 wpm.')
open(f'{D}/voiceover_script.md', 'w').write('\n'.join(md))
json.dump(segs, open(f'{D}/voiceover_segments.json', 'w'), indent=1)
tight = [x for x in segs if x['est_speech_s'] > x['window_s'] + 0.3]
print(f'{len(segs)} segments, {tw} words, {tc} chars, ~{tw / 150:.1f} min speech; film is {tl["total"] / 60:.1f} min; tight segments: {len(tight)}')
for x in tight: print('  tight', x['scene'], x['at'], f"{x['est_speech_s']}s in {x['window_s']}s")
