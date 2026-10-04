"""Turn the per-scene narration wavs into out/narration.json (scene audio length + caption start offsets).
Caption boundaries are placed at the pause nearest to the proportional text position inside each scene's audio."""
import json, os, re, subprocess
plain = json.load(open('out/timeline_plain.json'))
man = json.load(open('out/tts/manifest.json'))
def silences(f, d=0.16, db=-34):
    p = subprocess.run(['ffmpeg', '-i', f, '-af', f'silencedetect=noise={db}dB:d={d}', '-f', 'null', '-'], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', p)]; en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', p)]
    return [((a + b) / 2, b - a) for a, b in zip(st, en)]
out = {}
for s in plain['scenes']:
    f = f"out/tts/{s['id']}.wav"
    if not s['caps'] or not os.path.exists(f): continue
    D = man[s['id']]['duration']; sil = silences(f)
    L = [len(c[1].replace('*', '')) for c in s['caps']]; tot = sum(L); offs = [0.0]; acc = 0
    for k in range(len(L) - 1):
        acc += L[k]; est = D * acc / tot
        cand = [(abs(m - est) - 1.5 * w, m) for m, w in sil if abs(m - est) < 1.4 and m > offs[-1] + 1.2]
        offs.append(round(min(cand)[1] if cand else est, 3))
    out[s['id']] = {'dur': D, 'lead': 0.5, 'caps': offs}
json.dump(out, open('out/narration.json', 'w'), indent=1)
print(len(out), 'scenes narrated;', 'total narration', round(sum(v['dur'] for v in out.values()) / 60, 2), 'min')
