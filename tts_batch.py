"""Batched narration: the whole script goes out in a few big TTS requests (each well under the ~8.5 min / 16,384-token
output cap), then each batch is split back into scenes at the pauses nearest to the proportional text position.

    GKEY=... python3 tts_batch.py --model gemini-3.8-flash-tts --batches 2
Stops at the first HTTP error (no retry storm). Key is read from env only.
"""
import os, sys, re, json, base64, time, subprocess, urllib.request, urllib.error
sys.argv_ = sys.argv
arg = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
MODEL = arg('--model', 'gemini-3.8-flash-tts'); VOICE = arg('--voice', 'Sadaltager'); NB = int(arg('--batches', '2'))
OUT = 'out/tts'; os.makedirs(OUT, exist_ok=True)
from tts_common import spoken, call as tts_call, save_wav, STYLE, atomic_json
import hashlib
BUDGET = int(arg('--max-requests', '0'))

tl = json.load(open('out/timeline.json'))
sc = [(s['id'], spoken(' '.join(c[1] for c in s['caps']))) for s in tl['scenes'] if s['caps']]
words = [len(t.split()) for _, t in sc]; tot = sum(words); per = tot / NB
batches, cur, acc = [], [], 0
for (sid, t), w in zip(sc, words):
    if acc >= per * 0.98 and len(batches) < NB - 1: batches.append(cur); cur, acc = [], 0
    cur.append((sid, t)); acc += w
batches.append(cur)
print('batches:', [(len(b), sum(len(t.split()) for _, t in b)) for b in batches], MODEL, VOICE)

def call(text):
    return tts_call(text, MODEL, VOICE, STYLE)
def probe(f): return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).decode())
def silences(f, d=0.22, db=-34):
    p = subprocess.run(['ffmpeg', '-i', f, '-af', f'silencedetect=noise={db}dB:d={d}', '-f', 'null', '-'], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', p)]; en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', p)]
    return [(a, b) for a, b in zip(st, en)]

man = json.load(open(f'{OUT}/manifest.json')) if os.path.exists(f'{OUT}/manifest.json') else {}
hashes = json.load(open(f'{OUT}/batches.json')) if os.path.exists(f'{OUT}/batches.json') else {}
used = 0
for bi, b in enumerate(batches):
    raw = f'{OUT}/batch_{bi + 1}.wav'
    text = '\n\n'.join(t for _, t in b)
    h = hashlib.sha256((MODEL + VOICE + STYLE + text).encode()).hexdigest()
    if os.path.exists(raw) and hashes.get(str(bi + 1), {}).get('hash') != h:
        raise SystemExit(f'STOP: {raw} exists with different or unknown provenance; preserve it before regenerating')
    if not os.path.exists(raw):
        if used >= BUDGET: raise SystemExit('STOP: supply --max-requests to set an explicit request budget')
        used += 1
        print(f'batch {bi + 1}: requesting {len(text)} chars / {len(text.split())} words ...', flush=True)
        try: wav, usage = call(text)
        except urllib.error.HTTPError as e: print('STOP HTTP', e.code, e.read().decode()[:600]); sys.exit(2)
        save_wav(wav, raw); hashes[str(bi + 1)] = {'hash': h, 'voice': VOICE, 'model': MODEL, 'style': STYLE}; atomic_json(f'{OUT}/batches.json', hashes); print('  audio tokens', usage.get('candidatesTokenCount'))
        time.sleep(10)
    D = probe(raw); sil = silences(raw)
    chars = [len(t) for _, t in b]; totc = sum(chars)
    # boundary estimates by cumulative characters, snapped to the nearest pause (weighted toward long pauses)
    cuts = [0.0]; acc = 0
    for k in range(len(b) - 1):
        acc += chars[k]; est = D * acc / totc
        cand = [(abs((a + c) / 2 - est) - 0.8 * (c - a), (a + c) / 2) for a, c in sil if abs((a + c) / 2 - est) < 6 and (a + c) / 2 > cuts[-1] + 3]
        cuts.append(min(cand)[1] if cand else est)
    cuts.append(D)
    for k, (sid, t) in enumerate(b):
        o = f'{OUT}/{sid}.wav'
        subprocess.check_call(['ffmpeg', '-loglevel', 'error', '-y', '-i', raw, '-ss', f'{cuts[k]:.3f}', '-to', f'{cuts[k + 1]:.3f}', '-af', 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.1,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.1,areverse', o])
        d = probe(o); man[sid] = {'batch': bi + 1, 'model': MODEL, 'voice': VOICE, 'duration': round(d, 3), 'words': len(t.split()), 'spoken': t}
        print(f'  {sid:10s} {d:6.1f}s {len(t.split()) / d * 60:4.0f} wpm')
    atomic_json(f'{OUT}/manifest.json', man)
print('done')
