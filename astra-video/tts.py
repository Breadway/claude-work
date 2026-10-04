"""Narration generator: one Gemini TTS request per scene (each request batches all of that scene's captions).

    GKEY=... python3 tts.py            # generate missing scenes only (cached by text hash)
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

SPOKEN = [
    (r'\bv(\d)\b', r'version \1'), (r'Astra-7', 'Astra seven'), (r'ASTRA', 'Astra'),
    (r'AdvancedCpuPlayers', 'Advanced C P U players'), (r'AdvancedCpuPlayer', 'Advanced C P U player'), (r'AdvCPUs', 'Advanced C P Us'), (r'AdvCPU', 'Advanced C P U'), (r'ExpertCpu', 'Expert C P U'),
    (r'TD-value', 'T D value'), (r'\bBC\b', 'B C'), (r'\bRL\b', 'R L'), (r'\bPPO\b', 'P P O'), (r'\bGAE\b', 'G A E'), (r'\bMCTS\b', 'M C T S'),
    (r'\bPUCT\b', 'P U C T'), (r'\bGELU\b', 'gelu'), (r'\bMLP\b', 'M L P'), (r'\bGPU\b', 'G P U'), (r'\bCPU\b', 'C P U'),
    (r'4090-class', 'forty ninety class'), (r'\b3080\b', 'thirty eighty'), (r'λ', 'lambda'), (r'×', ' times '), (r'−', 'minus '), (r'±', 'plus or minus'),
    (r'100\+', 'over 100'), (r'\b400 plus\b', 'four hundred plus'), (r'dot-bin', 'dot bin'), (r'\*', ''),
]
def spoken(text):
    for a, b in SPOKEN: text = re.sub(a, b, text)
    return re.sub(r'\s+', ' ', text).strip()

def scenes():
    tl = json.load(open('out/timeline.json'))
    for s in tl['scenes']:
        if s['caps']:
            plain = ' '.join(c[1] for c in s['caps'])
            yield s['id'], plain, spoken(plain)

def call(text):
    body = {"contents": [{"parts": [{"text": text}]}], "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": VOICE}}}}}
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent', data=json.dumps(body).encode(),
                                 headers={'x-goog-api-key': os.environ['GKEY'], 'Content-Type': 'application/json'})
    r = json.load(urllib.request.urlopen(req, timeout=240))
    return base64.b64decode(r['candidates'][0]['content']['parts'][0]['inlineData']['data']), r.get('usageMetadata', {})

def main():
    plan = '--plan' in sys.argv
    mpath = f'{OUT}/manifest.json'
    man = json.load(open(mpath)) if os.path.exists(mpath) else {}
    todo = []
    for sid, plain, sp in scenes():
        h = hashlib.sha1((VOICE + sp).encode()).hexdigest()[:12]
        have = os.path.exists(f'{OUT}/{sid}.wav') and man.get(sid, {}).get('hash') == h
        todo.append((sid, plain, sp, h, have))
    n_new = sum(1 for t in todo if not t[4])
    print(f'{len(todo)} scenes, {n_new} to generate, {len(todo) - n_new} cached; voice={VOICE}, model={MODEL}')
    if plan:
        for sid, plain, sp, h, have in todo: print(f"{'cached ' if have else 'REQUEST'} {sid:10s} {len(sp.split()):3d} words  {sp[:90]}")
        return
    last = 0.0
    for sid, plain, sp, h, have in todo:
        if have: continue
        wait = SPACING - (time.time() - last)
        if wait > 0: time.sleep(wait)
        try:
            last = time.time()
            try:
                wav, usage = call(sp)
            except urllib.error.HTTPError as e:
                if e.code in (500, 502, 503, 504):          # one gentle retry for transient server errors only
                    time.sleep(15); last = time.time(); wav, usage = call(sp)
                else: raise
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:400]
            print(f'STOP at {sid}: HTTP {e.code} {msg}')
            json.dump(man, open(mpath, 'w'), indent=1); sys.exit(2)
        raw = f'{OUT}/{sid}.raw.wav'; open(raw, 'wb').write(wav)
        # trim leading/trailing silence, keep a short breath of room
        subprocess.check_call(['ffmpeg', '-loglevel', 'error', '-y', '-i', raw, '-af', 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.12,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.12,areverse', f'{OUT}/{sid}.wav'])
        os.remove(raw)
        dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f'{OUT}/{sid}.wav']).decode())
        man[sid] = {'hash': h, 'voice': VOICE, 'model': MODEL, 'duration': round(dur, 3), 'words': len(sp.split()), 'text': plain, 'spoken': sp, 'audio_tokens': usage.get('candidatesTokenCount')}
        json.dump(man, open(mpath, 'w'), indent=1)
        print(f'ok {sid:10s} {dur:6.1f}s  {len(sp.split()) / dur * 60:4.0f} wpm  {usage.get("candidatesTokenCount")} tokens')
    print('done')

main()
