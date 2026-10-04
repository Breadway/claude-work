import os, sys, json, base64, urllib.request, subprocess, time
KEY = os.environ['GKEY']; MODEL = 'gemini-3.8-flash-lite-tts'
def tts(text, voice, out):
    body = {"contents": [{"parts": [{"text": text}]}], "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}
    req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent', data=json.dumps(body).encode(), headers={'x-goog-api-key': KEY, 'Content-Type': 'application/json'})
    r = json.load(urllib.request.urlopen(req, timeout=180))
    open(out, 'wb').write(base64.b64decode(r['candidates'][0]['content']['parts'][0]['inlineData']['data']))
    d = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).decode())
    return d, r['usageMetadata']['candidatesTokenCount']
line = "Novacana is a four-player card game about building star systems. ASTRA is the AI we have been teaching to play it, across seven generations."
n = len(line.split())
for tag, pre, voice in [('brisk', "Narrate this as a confident, upbeat tech explainer. Speak briskly, at a quick natural pace with minimal pauses:\n\n", 'Charon'),
                        ('plain', "", 'Charon'),
                        ('brisk_sada', "Narrate this as a confident, upbeat tech explainer. Speak briskly, at a quick natural pace with minimal pauses:\n\n", 'Sadaltager')]:
    d, tk = tts(pre + line, voice, f'out/tts/test_{tag}.wav'); print(tag, voice, f'{d:.1f}s', tk, 'tokens', f'{n/d*60:.0f} wpm'); time.sleep(1)
