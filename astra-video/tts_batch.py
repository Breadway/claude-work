"""Batched narration: the whole script goes out in a few big TTS requests (each well under the ~10.9 min / 16,384-token
output cap), then each batch is split back into scenes at the pauses nearest to the proportional text position.

    GKEY=... python3 tts_batch.py --model gemini-3.8-flash-tts --batches 2
Stops at the first HTTP error (no retry storm). Key is read from env only.
"""
import os, sys, re, json, base64, time, subprocess, urllib.request, urllib.error
sys.argv_ = sys.argv
arg = lambda k, d: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
MODEL = arg('--model', 'gemini-3.8-flash-tts'); VOICE = arg('--voice', 'Sadaltager'); NB = int(arg('--batches', '2'))
OUT = 'out/tts'; os.makedirs(OUT, exist_ok=True)
exec(open('tts.py').read().split('def scenes')[0].split("OUT = 'out/tts'")[1].split('os.makedirs(OUT, exist_ok=True)')[1])  # reuse SPOKEN + spoken()

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
    body = {"contents": [{"parts": [{"text": text}]}], "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE}}}}}
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent', data=json.dumps(body).encode(), headers={'x-goog-api-key': os.environ['GKEY'], 'Content-Type': 'application/json'})
    r = json.load(urllib.request.urlopen(req, timeout=900))
    return base64.b64decode(r['candidates'][0]['content']['parts'][0]['inlineData']['data']), r.get('usageMetadata', {})
def probe(f): return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).decode())
def silences(f, d=0.22, db=-34):
    p = subprocess.run(['ffmpeg', '-i', f, '-af', f'silencedetect=noise={db}dB:d={d}', '-f', 'null', '-'], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', p)]; en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', p)]
    return [(a, b) for a, b in zip(st, en)]

man = {}
for bi, b in enumerate(batches):
    raw = f'{OUT}/batch_{bi + 1}.wav'
    if not os.path.exists(raw):
        text = '\n\n'.join(t for _, t in b)
        print(f'batch {bi + 1}: requesting {len(text)} chars / {len(text.split())} words ...', flush=True)
        try: wav, usage = call(text)
        except urllib.error.HTTPError as e: print('STOP HTTP', e.code, e.read().decode()[:600]); sys.exit(2)
        open(raw, 'wb').write(wav); print('  audio tokens', usage.get('candidatesTokenCount'))
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
json.dump(man, open(f'{OUT}/manifest.json', 'w'), indent=1)
print('done')
