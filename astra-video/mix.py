"""Mix narration over the score with ducking -> out/final_audio.wav, and write the stitched narration alone -> out/narration_full.wav.
Needs: out/timeline.json exported WITH narration applied, out/music.wav generated from that same timeline."""
import json, wave, subprocess, os
import numpy as np
from scipy.ndimage import uniform_filter1d
SR = 44100
tl = json.load(open('out/timeline.json'))
def rd(f):
    with wave.open(f) as w: return np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float32) / 32768, w.getnchannels()
m, ch = rd('out/music.wav'); m = m.reshape(-1, 2)
N = np.zeros(len(m), np.float32)
for s in tl['scenes']:
    if not s.get('narr'): continue
    tmp = f"/tmp/_n_{s['id']}.wav"
    subprocess.check_call(['ffmpeg', '-loglevel', 'error', '-y', '-i', f"out/tts/{s['id']}.wav", '-ar', str(SR), '-ac', '1', tmp])
    a, _ = rd(tmp); i = int((s['start'] + s['narr']['lead']) * SR); j = min(len(N), i + len(a)); N[i:j] += a[:j - i]
# normalise narration loudness (rms of active samples ~ -19 dBFS), gentle limiter
act = np.abs(N) > 0.01; rms = np.sqrt((N[act] ** 2).mean()); N *= 0.11 / rms
N = np.tanh(N * 1.2) / 1.2
env = uniform_filter1d(np.abs(N), int(0.35 * SR)); env = uniform_filter1d(np.minimum(env / 0.03, 1), int(0.5 * SR))
duck = (1 - 0.62 * env)[:, None]
mix = m * 0.9 * duck + np.stack([N, N], 1) * 1.0
mix *= 0.92 / np.abs(mix).max()
def wr(f, x):
    with wave.open(f, 'wb') as w: w.setnchannels(x.shape[1] if x.ndim > 1 else 1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype('<i2').tobytes())
wr('out/final_audio.wav', mix); wr('out/narration_full.wav', N * 0.9 / max(1e-6, np.abs(N).max()))
print('wrote final_audio.wav / narration_full.wav', round(len(mix) / SR, 1), 's')
