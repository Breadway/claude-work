"""Narration for either film: batched Gemini TTS + caption-accurate alignment.

    GKEY=...  python3 narrate.py --film edu            # generate missing batches (network), then align
    python3 narrate.py --film edu --plan              # show the batches and word counts, no network
    python3 narrate.py --film astra --align-only      # re-align existing out/tts/batch_*.wav (no network)

How the captions are made to line up with the voice
  1. Each batch is ONE long TTS request (a few per film), so the voice and pacing are consistent.
  2. The batch audio is scanned for pauses (ffmpeg silencedetect).
  3. A dynamic-programming pass chooses, for every caption, the pause where it starts, so that
       - every caption's spoken length matches its text length (speech-rate consistency), and
       - boundaries prefer long pauses (paragraph / sentence ends).
     This is a forced alignment of known text against the audio, with no network or ASR model needed.
  4. Each scene's audio is cut at its first caption, and  <film>/narration.json  stores each caption's onset.
     The engine then retimes the scene so every caption appears exactly when its sentence starts.
A diagnostics table flags any caption whose speech rate looks wrong, so a bad alignment is visible, not silent.
Free-tier safety: cached batches are never re-requested; the run stops at the first HTTP error. Key: env GKEY only.
"""
import os, sys, re, json, base64, hashlib, time, subprocess, urllib.request, urllib.error
import numpy as np

arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
flag = lambda k: k in sys.argv
FILM = arg('--film', 'edu'); MODEL = arg('--model', 'gemini-3.8-flash-tts'); VOICE = arg('--voice', 'Sadaltager')
MAXMIN = float(arg('--minutes', '8.5'))            # target spoken minutes per request (cap is ~10.9)
D = 'out' if FILM == 'astra' else f'out/{FILM}'; TTS = f'{D}/tts'; os.makedirs(TTS, exist_ok=True)

# ---- pronunciation (reuse film 1's table, add teaching vocabulary)
exec(open('tts.py').read().split('def scenes')[0].split("os.makedirs(OUT, exist_ok=True)")[1])
SPOKEN += [(r'\bReLU\b', 'rel-you'), (r'\bFP16\b', 'F P sixteen'), (r'\bFP32\b', 'F P thirty-two'), (r'\bMHA\b', 'M H A'), (r'\bLayerNorm\b', 'layer norm'),
           (r'\bAdam\b', 'Adam'), (r'\bsoftmax\b', 'soft max'), (r'\bAlphaZero\b', 'Alpha Zero'), (r'\bNaN\b', 'nan'), (r'\bf16\b', 'F sixteen')]
sp = lambda t: spoken(t)

tl = json.load(open(f'{D}/timeline.json'))
scenes = [(s['id'], [c[1] for c in s['caps']]) for s in tl['scenes'] if s['caps']]

def probe(f): return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).decode())
def wlen(t):  # speech-length proxy: characters, plus what spoken numbers add ("96" -> "ninety-six")
    n = len(t)
    for m in re.finditer(r'\d[\d,\.]*', t): n += 4 * len(re.sub(r'\D', '', m.group()))
    return n + 8 * t.count('%')
def silences(f, d=0.12, db=-36):
    p = subprocess.run(['ffmpeg', '-i', f, '-af', f'silencedetect=noise={db}dB:d={d}', '-f', 'null', '-'], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: (-?[\d.]+)', p)]; en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', p)]
    if len(st) > len(en): en.append(probe(f))
    return [(max(0, a), b) for a, b in zip(st, en)]

# ---- batches --------------------------------------------------------------------------------------------
if FILM == 'astra':
    man = json.load(open(f'{TTS}/manifest.json')); nb = max(m['batch'] for m in man.values())
    batches = [[sid for sid, _ in scenes if man.get(sid, {}).get('batch') == b] for b in range(1, nb + 1)]
    join_caps = ' '          # film 1 was generated with the captions of a scene joined by spaces
else:
    wc = lambda sid_caps: sum(len(sp(c).split()) for c in sid_caps[1]); limit = MAXMIN * 145
    batches, cur, acc = [], [], 0
    for item in scenes:
        w = wc(item)
        if cur and acc + w > limit: batches.append(cur); cur, acc = [], 0
        cur.append(item[0]); acc += w
    batches.append(cur); join_caps = '\n\n'
byid = dict(scenes)
def batch_text(ids): return '\n\n'.join(join_caps.join(sp(c) for c in byid[i]) for i in ids)

print(f'film {FILM}: {len(scenes)} narrated scenes, {sum(len(c) for _, c in scenes)} captions, {len(batches)} batches')
for i, b in enumerate(batches, 1):
    n = len(batch_text(b).split()); print(f'  batch {i}: {len(b)} scenes, {n} words, ~{n / 145:.1f} min')
if flag('--plan'): sys.exit(0)

def call(text):
    body = {"contents": [{"parts": [{"text": text}]}], "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE}}}}}
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent', data=json.dumps(body).encode(), headers={'x-goog-api-key': os.environ['GKEY'], 'Content-Type': 'application/json'})
    r = json.load(urllib.request.urlopen(req, timeout=900)); return base64.b64decode(r['candidates'][0]['content']['parts'][0]['inlineData']['data']), r.get('usageMetadata', {})
def to_wav(pcm, f):  # Gemini returns raw 16-bit 24 kHz mono PCM inside a wav container or as raw; normalise through ffmpeg
    tmp = f + '.raw'; open(tmp, 'wb').write(pcm)
    r = subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', tmp, f], capture_output=True)
    if r.returncode: subprocess.check_call(['ffmpeg', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', tmp, f])
    os.remove(tmp)

hashes = json.load(open(f'{TTS}/batches.json')) if os.path.exists(f'{TTS}/batches.json') else {}
if not flag('--align-only'):
    for i, b in enumerate(batches, 1):
        raw = f'{TTS}/batch_{i}.wav'; text = batch_text(b); h = hashlib.sha1((MODEL + VOICE + text).encode()).hexdigest()[:12]
        if os.path.exists(raw) and hashes.get(str(i)) == h: print(f'  batch {i}: cached'); continue
        print(f'  batch {i}: requesting {len(text.split())} words ...', flush=True)
        try: pcm, usage = call(text)
        except urllib.error.HTTPError as e: print('STOP HTTP', e.code, e.read().decode()[:600]); sys.exit(2)
        to_wav(pcm, raw); hashes[str(i)] = h; json.dump(hashes, open(f'{TTS}/batches.json', 'w'), indent=1)
        print(f'    -> {probe(raw) / 60:.2f} min audio, tokens {usage.get("candidatesTokenCount")}'); time.sleep(12)

# ---- alignment ------------------------------------------------------------------------------------------
def align(Dur, sil, chars):
    """Return speech-onset time (s) of each caption in a batch of audio, given the captions' character counts."""
    K = len(chars); tot = sum(chars); cum = np.concatenate([[0], np.cumsum(chars)])
    t0 = sil[0][1] if sil and sil[0][0] < 0.08 else 0.0
    t1 = sil[-1][0] if sil and sil[-1][1] > Dur - 0.08 else Dur
    rate = (t1 - t0) / tot
    cand = np.array([(e, e - s) for s, e in sil if t0 + 0.4 < e < t1 - 0.4])        # (onset, gap)
    on, gap = cand[:, 0], cand[:, 1]
    est = lambda k: t0 + rate * cum[k]; W = max(40.0, 0.1 * (t1 - t0))
    layers = []; cost = []; back = []
    for k in range(1, K):
        idx = np.where(np.abs(on - est(k)) < W)[0]
        if len(idx) == 0: idx = np.array([int(np.argmin(np.abs(on - est(k))))])
        layers.append(idx)
        seg = chars[k - 1]; exp = seg * rate
        if k == 1:
            d = on[idx] - t0; c = 6 * np.log(np.maximum(d, 0.3) / exp) ** 2 - 1.2 * np.minimum(gap[idx], 0.9); cost.append(c); back.append(np.zeros(len(idx), int)); continue
        pj = layers[-2]; d = on[idx][:, None] - on[pj][None, :]
        c = cost[-1][None, :] + 6 * np.log(np.maximum(d, 0.3) / exp) ** 2 + np.where(d < 1.0, 1e3, 0) - 1.2 * np.minimum(gap[idx], 0.9)[:, None]
        back.append(np.argmin(c, 1)); cost.append(np.min(c, 1))
    if K == 1: return [t0], rate, t0, t1
    # final segment
    last = layers[-1]; d = t1 - on[last]; fc = cost[-1] + 6 * np.log(np.maximum(d, 0.3) / (chars[-1] * rate)) ** 2 + np.where(d < 1.0, 1e3, 0)
    j = int(np.argmin(fc)); path = [j]
    for k in range(K - 2, 0, -1): j = int(back[k][j]); path.append(j)
    path = path[::-1]; onsets = [t0] + [float(on[layers[k][path[k]]]) for k in range(K - 1)]
    return onsets, rate, t0, t1

def cut(src, a, b, dst): subprocess.check_call(['ffmpeg', '-loglevel', 'error', '-y', '-i', src, '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-c:a', 'pcm_s16le', dst])

narr = {}; bad = 0; rows = []
for bi, ids in enumerate(batches, 1):
    raw = f'{TTS}/batch_{bi}.wav'
    if not os.path.exists(raw): print(f'  batch {bi}: audio missing, skipped'); continue
    Dur = probe(raw); sil = silences(raw)
    flat = [(sid, k, sp(c)) for sid in ids for k, c in enumerate(byid[sid])]
    onsets, rate, t0, t1 = align(Dur, sil, [wlen(t) for _, _, t in flat])
    firsts = {}                                              # scene -> index of its first caption
    for n, (sid, k, _) in enumerate(flat): firsts.setdefault(sid, n)
    starts = {sid: max(0.0, onsets[n] - 0.15) for sid, n in firsts.items()}
    order = list(firsts)
    for si, sid in enumerate(order):
        a = starts[sid]; b = starts[order[si + 1]] - 0.05 if si + 1 < len(order) else Dur
        cut(raw, a, b, f'{TTS}/{sid}.wav'); n0 = firsts[sid]; m = len(byid[sid])
        offs = [round(onsets[n0 + k] - onsets[n0], 3) for k in range(m)]
        narr[sid] = {'dur': round(probe(f'{TTS}/{sid}.wav'), 3), 'lead': 0.5, 'caps': offs}
    for n, (sid, k, t) in enumerate(flat):
        end = onsets[n + 1] if n + 1 < len(flat) else t1; d = end - onsets[n]; cps = wlen(t) / d
        r = np.log(d / (wlen(t) * rate)); rows.append((sid, k, d, cps, r))
        if abs(r) > 0.35: bad += 1
json.dump(narr, open(f'{D}/narration.json', 'w'), indent=1)
print(f'\nwrote {D}/narration.json ({len(narr)} scenes) and per-scene audio in {TTS}/')
print('caption timing check (speech rate vs batch average; |log ratio| > 0.35 = suspicious):')
for sid, k, d, cps, r in rows:
    if abs(r) > 0.35: print(f'  CHECK {sid} caption {k + 1}: {d:5.1f}s  {cps:4.1f} chars/s  ratio {np.exp(r):.2f}')
print(f'{len(rows)} captions aligned, {bad} flagged')
