"""Narration generator: one Gemini TTS request per scene (each request batches all of that scene's captions).

    GKEY=... python3 tts.py --max-requests 5            # generate missing scenes only (cached by text hash)
    python3 tts.py --plan              # print what would be sent, no network

Safety for free-tier quotas: cached files are never re-requested, requests are spaced >= SPACING s apart,
and the run STOPS at the first 429/quota error (no retry storm). Re-run later to resume.
API key is read from the GKEY env var only and is never written to disk.
"""
import os, sys, re, json, base64, hashlib, time, subprocess, urllib.request, urllib.error

MODEL = 'gemini-3.8-flash-lite-tts'
VOICE = 'Sadaltager'      # prebuilt voice, "Knowledgeable"
SPACING = 9.0             # seconds between requests (<= ~6.5 requests/minute)
OUT = 'out/tts'
os.makedirs(OUT, exist_ok=True)

from tts_common import spoken, call as tts_call, save_wav, probe, STYLE
def scenes():
    tl = json.load(open('out/timeline.json'))
    for s in tl['scenes']:
        if s['caps']:
            plain = ' '.join(c[1] for c in s['caps'])
            yield s['id'], plain, spoken(plain)

def call(text):
    return tts_call(text, MODEL, VOICE, STYLE)

def main():
    plan = '--plan' in sys.argv
    mpath = f'{OUT}/manifest.json'
    man = json.load(open(mpath)) if os.path.exists(mpath) else {}
    todo = []
    for sid, plain, sp in scenes():
        h = hashlib.sha256((MODEL + VOICE + STYLE + sp).encode()).hexdigest()
        have = os.path.exists(f'{OUT}/{sid}.wav') and man.get(sid, {}).get('hash') == h
        todo.append((sid, plain, sp, h, have))
    n_new = sum(1 for t in todo if not t[4])
    print(f'{len(todo)} scenes, {n_new} to generate, {len(todo) - n_new} cached; voice={VOICE}, model={MODEL}')
    if plan:
        for sid, plain, sp, h, have in todo: print(f"{'cached ' if have else 'REQUEST'} {sid:10s} {len(sp.split()):3d} words  {sp[:90]}")
        return
    budget = int(sys.argv[sys.argv.index('--max-requests') + 1]) if '--max-requests' in sys.argv else 0
    used = 0
    last = 0.0
    for sid, plain, sp, h, have in todo:
        if have: continue
        if os.path.exists(f'{OUT}/{sid}.wav'):
            raise SystemExit(f'STOP: {sid}.wav exists with different or unknown provenance; preserve it before regenerating')
        if used >= budget: raise SystemExit('STOP: supply --max-requests to set an explicit request budget')
        used += 1
        wait = SPACING - (time.time() - last)
        if wait > 0: time.sleep(wait)
        try:
            last = time.time()
            wav, usage = call(sp)
        except urllib.error.HTTPError as e:
                if e.code in (500, 502, 503, 504):          # one gentle retry for transient server errors only
                    time.sleep(15); last = time.time(); wav, usage = call(sp)
                else: raise
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:400]
            print(f'STOP at {sid}: HTTP {e.code} {msg}')
            json.dump(man, open(mpath, 'w'), indent=1); sys.exit(2)
        raw = f'{OUT}/{sid}.raw.wav'; save_wav(wav, raw)
        # trim leading/trailing silence, keep a short breath of room
        subprocess.check_call(['ffmpeg', '-loglevel', 'error', '-y', '-i', raw, '-af', 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.12,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.12,areverse', f'{OUT}/{sid}.wav'])
        os.remove(raw)
        dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f'{OUT}/{sid}.wav']).decode())
        man[sid] = {'hash': h, 'voice': VOICE, 'model': MODEL, 'duration': round(dur, 3), 'words': len(sp.split()), 'text': plain, 'spoken': sp, 'audio_tokens': usage.get('candidatesTokenCount')}
        json.dump(man, open(mpath, 'w'), indent=1)
        print(f'ok {sid:10s} {dur:6.1f}s  {len(sp.split()) / dur * 60:4.0f} wpm  {usage.get("candidatesTokenCount")} tokens')
    print('done')

if __name__ == '__main__':
    main()
