"""Narration for either film: batched Gemini TTS + estimated caption alignment.

    GKEY=...  python3 narrate.py --film edu --max-requests 7  # generate missing batches (network), then align
    python3 narrate.py --film edu --plan              # show the batches and word counts, no network
    python3 narrate.py --film astra --align-only      # re-align existing out/tts/batch_*.wav (no network)

How the captions are made to line up with the voice
  1. Each batch is ONE long TTS request (a few per film), so the voice and pacing are consistent.
  2. The batch audio is scanned for pauses (ffmpeg silencedetect).
  3. A dynamic-programming pass chooses, for every caption, the pause where it starts, so that
       - every caption's spoken length matches its text length (speech-rate consistency), and
       - boundaries prefer long pauses (paragraph / sentence ends).
     These are timing estimates based on pauses, not transcript-verified forced alignment.
  4. Each scene's audio is cut at its first caption, and  <film>/narration.json  stores each caption's onset.
     The engine retimes the scene using these estimates; review timings before the final render.
A diagnostics table flags any caption whose speech rate looks wrong, so a bad alignment is visible, not silent.
Free-tier safety: cached batches are never re-requested; the run stops at the first HTTP error. Key: env GKEY only.
"""
import os, sys, re, json, base64, hashlib, time, subprocess, urllib.request, urllib.error
import numpy as np
from pathlib import Path
from narration_alignment import align, silences, wlen, cut
from tts_common import spoken, STYLE, request_body, call as tts_call, save_wav, atomic_json, probe

os.chdir(Path(__file__).resolve().parent)

arg = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
flag = lambda k: k in sys.argv
FILM = arg('--film', 'edu'); MODEL = arg('--model', 'gemini-3.8-flash-tts'); VOICE = arg('--voice', 'Sadaltager')
MAXMIN = float(arg('--minutes', '8.5'))            # estimated minutes, not a guaranteed duration; observed 32 audio tokens/s gives ~8.5 min maximum
D = 'out' if FILM == 'astra' else f'out/{FILM}'; TTS = f'{D}/tts'; os.makedirs(TTS, exist_ok=True)

# Shared pronunciation rules are importable without triggering API calls.
sp = spoken
MAX_REQUESTS = int(arg('--max-requests', '0'))  # 0 requires an explicit budget before network use
if FILM not in ('astra', 'edu'): raise SystemExit('--film must be astra or edu')
if not 0 < MAXMIN <= 8.5: raise SystemExit('--minutes must be > 0 and <= 8.5')
if MAX_REQUESTS < 0: raise SystemExit('--max-requests must be >= 0')

timeline = f'{D}/timeline_plain.json' if FILM == 'astra' and os.path.exists(f'{D}/timeline_plain.json') else f'{D}/timeline.json'
tl = json.load(open(timeline))
scenes = [(s['id'], [c[1] for c in s['caps']]) for s in tl['scenes'] if s['caps']]


# ---- batches --------------------------------------------------------------------------------------------
if FILM == 'astra':
    man = json.load(open(f'{TTS}/manifest.json')); nb = max(m['batch'] for m in man.values())
    batches = [[sid for sid, _ in scenes if man.get(sid, {}).get('batch') == b] for b in range(1, nb + 1)]
    if any(not any(sid in b for b in batches) for sid, _ in scenes):
        raise SystemExit('STOP: video 1 manifest does not cover all narrated scenes')
    join_caps = ' '          # film 1 was generated with the captions of a scene joined by spaces
else:
    wc = lambda sid_caps: sum(len(sp(c).split()) for c in sid_caps[1]); limit = MAXMIN * 145
    batches, cur, acc = [], [], 0
    for item in scenes:
        w = wc(item)
        if w > limit: raise SystemExit(f'STOP: {item[0]} exceeds one batch; use smaller caption groups')
        if cur and acc + w > limit: batches.append(cur); cur, acc = [], 0
        cur.append(item[0]); acc += w
    batches.append(cur); join_caps = '\n\n'
byid = dict(scenes)
def batch_text(ids): return '\n\n'.join(join_caps.join(sp(c) for c in byid[i]) for i in ids)

print(f'film {FILM}: {len(scenes)} narrated scenes, {sum(len(c) for _, c in scenes)} captions, {len(batches)} batches')
for i, b in enumerate(batches, 1):
    n = len(batch_text(b).split()); print(f'  batch {i}: {len(b)} scenes, {n} words, ~{n / 145:.1f} min')
if flag('--plan'): sys.exit(0)

def batch_hash(text):
    return hashlib.sha256(json.dumps(request_body(text, MODEL, VOICE, STYLE), sort_keys=True).encode()).hexdigest()

hashes = json.load(open(f'{TTS}/batches.json')) if os.path.exists(f'{TTS}/batches.json') else {}
ledger_path = f'{TTS}/requests.json'
ledger = json.load(open(ledger_path)) if os.path.exists(ledger_path) else []
used = 0
if not flag('--align-only'):
    for i, b in enumerate(batches, 1):
        raw = f'{TTS}/batch_{i}.wav'; text = batch_text(b); h = batch_hash(text)
        entry = hashes.get(str(i), {})
        if not isinstance(entry, dict): entry = {}
        if os.path.exists(raw):
            if entry.get('hash') != h:
                raise SystemExit(f'STOP: batch {i} exists with different or unknown provenance. Preserve it before changing generation settings.')
            if probe(raw) <= 0: raise SystemExit(f'STOP: cached batch {i} is empty')
            print(f'  batch {i}: cached'); continue
        if used >= MAX_REQUESTS:
            print(f'STOP: request budget {MAX_REQUESTS} reached. Re-run with GKEY and --max-requests to resume.'); sys.exit(2)
        if not os.environ.get('GKEY'): raise SystemExit('Set GKEY in the environment')
        if used: time.sleep(12)
        used += 1
        attempt = {'batch': i, 'model': MODEL, 'key_label': os.environ.get('GKEY_LABEL', 'unspecified'),
                   'time': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'status': 'started'}
        ledger.append(attempt); atomic_json(ledger_path, ledger)
        print(f'  batch {i}: requesting {len(text.split())} words (request {used}/{MAX_REQUESTS}) ...', flush=True)
        try:
            pcm, usage = tts_call(text, MODEL, VOICE, STYLE)
            save_wav(pcm, raw)
        except (urllib.error.URLError, ValueError, OSError) as e:
            attempt['status'] = 'failed'; attempt['error_type'] = type(e).__name__
            if isinstance(e, urllib.error.HTTPError):
                attempt['http_status'] = e.code
                msg = e.read().decode()[:600]
                print('STOP HTTP', e.code, msg)
            else: print('STOP', type(e).__name__, str(e))
            atomic_json(ledger_path, ledger); sys.exit(2)
        hashes[str(i)] = {'hash': h, 'model': MODEL, 'voice': VOICE, 'style': STYLE,
                         'scenes': b, 'text': text, 'usage': usage, 'duration': round(probe(raw), 3)}
        atomic_json(f'{TTS}/batches.json', hashes)
        attempt['status'] = 'completed'; atomic_json(ledger_path, ledger)
        print(f'    -> {probe(raw) / 60:.2f} min audio', flush=True)
if FILM == 'edu':
    for i, ids in enumerate(batches, 1):
        entry = hashes.get(str(i), {})
        if not isinstance(entry, dict) or entry.get('hash') != batch_hash(batch_text(ids)):
            raise SystemExit(f'STOP: batch {i} provenance does not match this text, voice, model and style')
if flag('--generate-only'):

    print('Generation complete; run --align-only to estimate caption timings.'); sys.exit(0)
missing = [i for i in range(1, len(batches) + 1) if not os.path.exists(f'{TTS}/batch_{i}.wav')]
if missing: raise SystemExit(f'STOP: missing batches {missing}; narration.json has not been changed')

# ---- alignment ------------------------------------------------------------------------------------------


narr = {}; bad = 0; rows = []; estimated = []
for bi, ids in enumerate(batches, 1):
    raw = f'{TTS}/batch_{bi}.wav'
    if not os.path.exists(raw): print(f'  batch {bi}: audio missing, skipped'); continue
    Dur = probe(raw); sil = silences(raw)
    flat = [(sid, k, sp(c)) for sid in ids for k, c in enumerate(byid[sid])]
    onsets, rate, t0, t1 = align(Dur, sil, [wlen(t) for _, _, t in flat])
    if len(sil) < len(flat) - 1: estimated.append(bi)
    if not all(onsets[k + 1] > onsets[k] for k in range(len(onsets) - 1)): raise ValueError('Caption boundaries must increase')
    firsts = {}                                              # scene -> index of its first caption
    for n, (sid, k, _) in enumerate(flat): firsts.setdefault(sid, n)
    starts = {sid: max(0.0, onsets[n] - 0.15) for sid, n in firsts.items()}
    order = list(firsts)
    for si, sid in enumerate(order):
        a = starts[sid]; b = starts[order[si + 1]] if si + 1 < len(order) else Dur
        cut(raw, a, b, f'{TTS}/{sid}.wav'); n0 = firsts[sid]; m = len(byid[sid])
        offs = [round(onsets[n0 + k] - a, 3) for k in range(m)]
        narr[sid] = {'dur': round(probe(f'{TTS}/{sid}.wav'), 3), 'lead': 0.5, 'caps': offs}
    for n, (sid, k, t) in enumerate(flat):
        end = onsets[n + 1] if n + 1 < len(flat) else t1; d = end - onsets[n]; cps = wlen(t) / d
        r = np.log(d / (wlen(t) * rate)); rows.append((sid, k, d, cps, r))
        if abs(r) > 0.35: bad += 1
atomic_json(f'{D}/narration.json', narr)
print(f'\nwrote {D}/narration.json ({len(narr)} scenes) and per-scene audio in {TTS}/')
print('caption timing check (speech rate vs batch average; |log ratio| > 0.35 = suspicious):')
for sid, k, d, cps, r in rows:
    if abs(r) > 0.35: print(f'  CHECK {sid} caption {k + 1}: {d:5.1f}s  {cps:4.1f} chars/s  ratio {np.exp(r):.2f}')
atomic_json(f'{D}/alignment_report.json', {'method': 'pause-based estimates, not transcript-verified', 'flagged': bad, 'proportional_batches': estimated, 'captions': [{'scene': sid, 'caption': k + 1, 'duration': round(d, 3), 'rate_ratio': round(float(np.exp(r)), 3)} for sid, k, d, cps, r in rows]})
print(f'{len(rows)} caption timings estimated, {bad} flagged; review before final render')
