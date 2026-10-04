"""ASTRA video engine - procedural score + whooshes, generated from out/timeline.json.
Pure numpy/scipy: pads, bass, plucked arps, soft pulse, scene-change whooshes, convolution reverb.
    python3 music.py            -> out/music.wav
"""
import json, math, sys, os
FILM = os.environ.get('FILM', 'astra'); D = 'out' if FILM == 'astra' else f'out/{FILM}'
import numpy as np
from scipy.signal import oaconvolve, butter, sosfilt

SR = 44100
tl = json.load(open(f'{D}/timeline.json'))
TOTAL = tl['total']
N = int((TOTAL + 4) * SR)
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)
BPM = 84.0
BEAT = 60.0 / BPM
CHORD_LEN = BEAT * 8           # two bars per chord

TYPES = {'m7': [0, 3, 7, 10], 'maj7': [0, 4, 7, 11], 'm9': [0, 3, 7, 10, 14], 'add9': [0, 4, 7, 14], '7': [0, 4, 7, 10], 'dim': [0, 3, 6, 9], 'sus2': [0, 2, 7, 12], 'm': [0, 3, 7, 12]}
PROG = {
    'A': [(45, 'm7'), (41, 'maj7'), (48, 'maj7'), (43, 'add9')],
    'B': [(50, 'm9'), (46, 'maj7'), (41, 'maj7'), (48, 'add9')],
    'C': [(40, 'm7'), (48, 'maj7'), (47, 'dim'), (45, 'm7')],
    'D': [(48, 'maj7'), (43, 'add9'), (45, 'm7'), (41, 'maj7')],
    'E': [(45, 'm7'), (43, 'add9'), (41, 'maj7'), (40, '7')],
    'F': [(50, 'm9'), (43, 'm7'), (46, 'maj7'), (45, '7')],
    'G': [(41, 'maj7'), (50, 'm9'), (46, 'maj7'), (48, 'add9')],
    'H': [(43, 'm7'), (39, 'maj7'), (46, 'maj7'), (38, 'm')],
    'I': [(45, 'm7'), (41, 'maj7'), (48, 'maj7'), (43, 'add9')],
}
# scene id -> (progression, energy 0..1, pulse on?)
SCN = {
    'title': ('A', .5, False), 'problem': ('A', .45, False), 'yardstick': ('A', .5, False),
    'v1': ('B', .5, False), 'v2': ('B', .55, False), 'v3': ('B', .62, True),
    'v4': ('C', .55, False), 'v5': ('D', .6, True), 'v6a': ('E', .66, True), 'v6b': ('E', .7, True),
    'chain': ('F', .66, True), 'a7intro': ('F', .66, False), 'tokens': ('G', .6, False), 'embed': ('G', .55, False),
    'encoder': ('G', .72, True), 'heads': ('G', .7, True), 'growth': ('G', .62, False), 'teacher': ('G', .6, False),
    'pipeline': ('G', .68, True), 'debug': ('H', .6, True), 'fidelity': ('D', .55, False), 'standing': ('I', .78, True), 'outro': ('I', .85, False),
}

def scene_at(t):
    cur = tl['scenes'][0]
    for s in tl['scenes']:
        if t >= s['start'] + 0.4: cur = s
    return cur

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)

def add(buf, start, sig, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N: return
    j = min(N, i + len(sig))
    sig = sig[:j - i] * gain
    gl = math.cos((pan + 1) * math.pi / 4); gr = math.sin((pan + 1) * math.pi / 4)
    L[i:j] += sig * gl; R[i:j] += sig * gr

def pad_voice(freq, dur, atk=1.6, rel=2.4, det=0.0035):
    n = int((dur + rel) * SR); t = np.arange(n) / SR
    env = np.minimum(1, t / atk) * np.where(t < dur, 1, np.exp(-(t - dur) / (rel / 4)))
    s = np.zeros(n)
    for d in (-det, 0, det):
        f = freq * (1 + d)
        for h, a in ((1, 1), (2, .5), (3, .28), (4, .16), (5, .09)):
            s += a * np.sin(2 * np.pi * f * h * t + h * 1.3 * d * 40)
    lfo = 0.85 + 0.15 * np.sin(2 * np.pi * 0.11 * t + freq)
    return s * env * lfo / 6

def pluck(freq, dur=1.1):
    n = int(dur * SR); t = np.arange(n) / SR
    env = np.exp(-t * 4.4) * np.minimum(1, t / 0.004)
    s = np.sin(2 * np.pi * freq * t) + .35 * np.sin(4 * np.pi * freq * t) * np.exp(-t * 9) + .12 * np.sin(6 * np.pi * freq * t) * np.exp(-t * 14)
    return s * env

def kick(dur=0.35):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 46 + 90 * np.exp(-t * 24)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11)

def tick(dur=0.05):
    n = int(dur * SR); t = np.arange(n) / SR
    return rng.standard_normal(n) * np.exp(-t * 90)

def whoosh(dur=1.2):
    n = int(dur * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n)
    out = np.zeros(n)
    seg = 2048
    for i in range(0, n, seg):
        u = i / n; lo = 300 + 5200 * u ** 2; hi = lo * 1.7
        sos = butter(2, [lo, min(hi, 18000)], btype='band', fs=SR, output='sos')
        out[i:i + seg] = sosfilt(sos, x[i:i + seg])
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    return out * env

# ---------------- chords ----------------
t0 = 0.0; ci = 0
while t0 < TOTAL + 2:
    sc = scene_at(t0 + 0.2)
    ch = sc.get('ch') or 0
    prog, e, pulse = SCN.get(sc['id'], ('ABCDEFGHI'[ch % 9], min(.85, .45 + .028 * ch), ch >= 10) if FILM != 'astra' else ('A', .5, False))
    root, typ = PROG[prog][ci % 4]
    notes = [root + i for i in TYPES[typ]]
    # pad: 3 voices spread across octaves
    for k, n in enumerate(notes):
        v = pad_voice(mtof(n + 12), CHORD_LEN + 0.6)
        pan = (k - len(notes) / 2) * 0.22
        i = int(t0 * SR); j = min(N, i + len(v))
        gl = math.cos((pan + 1) * math.pi / 4); gr = math.sin((pan + 1) * math.pi / 4)
        g = 0.20 * (0.55 + e * 0.7)
        L[i:j] += v[:j - i] * g * gl; R[i:j] += v[:j - i] * g * gr
    # bass
    b = pad_voice(mtof(root), CHORD_LEN + 0.3, atk=0.6, rel=1.2, det=0.001)
    i = int(t0 * SR); j = min(N, i + len(b))
    L[i:j] += b[:j - i] * 0.42 * (0.5 + e); R[i:j] += b[:j - i] * 0.42 * (0.5 + e)
    # arp (8ths)
    pat = [0, 2, 1, 3, 2, 1, 3, 4] if len(notes) > 4 else [0, 2, 1, 3, 2, 1, 3, 2]
    for step in range(16):
        tt = t0 + step * BEAT / 2
        if tt >= TOTAL + 1: break
        n = notes[pat[step % 8] % len(notes)] + 24
        vel = (0.55 + 0.45 * (step % 4 == 0)) * (0.22 + 0.55 * e) * (0.9 if step % 2 else 1.0)
        p = pluck(mtof(n))
        pan = math.sin(step * 0.9) * 0.55
        i = int(tt * SR); j = min(N, i + len(p))
        gl = math.cos((pan + 1) * math.pi / 4); gr = math.sin((pan + 1) * math.pi / 4)
        L[i:j] += p[:j - i] * vel * 0.16 * gl; R[i:j] += p[:j - i] * vel * 0.16 * gr
        # echo
        d = int(BEAT * 0.75 * SR)
        if j + d < N:
            L[i + d:j + d] += p[:j - i] * vel * 0.06 * gr; R[i + d:j + d] += p[:j - i] * vel * 0.06 * gl
    # pulse
    if pulse:
        kk = kick()
        for bt in range(8):
            if bt % 2 == 0:
                tt = t0 + bt * BEAT
                i = int(tt * SR); j = min(N, i + len(kk))
                if i < N:
                    L[i:j] += kk[:j - i] * 0.30 * e; R[i:j] += kk[:j - i] * 0.30 * e
        hh = tick()
        for bt in range(16):
            if bt % 2 == 1:
                tt = t0 + bt * BEAT / 2
                i = int(tt * SR); j = min(N, i + len(hh))
                if i < N:
                    L[i:j] += hh[:j - i] * 0.05 * e; R[i:j] += hh[:j - i] * 0.05 * e
    t0 += CHORD_LEN; ci += 1

# ---------------- whooshes at scene changes ----------------
for s in tl['scenes'][1:]:
    w = whoosh(1.3)
    tt = s['start'] - 0.05
    i = int(tt * SR); j = min(N, i + len(w))
    L[i:j] += w[:j - i] * 0.20; R[i:j] += w[::-1][:j - i] * 0.20
    # impact
    kk = kick(0.5); L[i + int(.55 * SR):i + int(.55 * SR) + len(kk)] += kk * 0.22; R[i + int(.55 * SR):i + int(.55 * SR) + len(kk)] += kk * 0.22

# ---------------- reverb ----------------
ir_n = int(2.6 * SR); t = np.arange(ir_n) / SR
def ir():
    x = rng.standard_normal(ir_n) * np.exp(-t / 0.75)
    x = np.convolve(x, np.ones(6) / 6, mode='same')           # darken
    return x / np.sqrt((x ** 2).sum())
wl = oaconvolve(L, ir())[:N]; wr = oaconvolve(R, ir())[:N]
outL = L * 0.78 + wl * 0.55; outR = R * 0.78 + wr * 0.55

# ---------------- master ----------------
out = np.stack([outL, outR], 1)
out = np.tanh(out * 1.4) / 1.4          # soft clip
n_tot = int(TOTAL * SR)
out = out[:n_tot + int(1.5 * SR)]
fade_in = np.minimum(1, np.arange(len(out)) / (1.5 * SR))
tail = np.clip((len(out) - np.arange(len(out))) / (3.0 * SR), 0, 1)
out *= (fade_in * tail)[:, None]
out *= 0.9 / np.abs(out).max()
pcm = (out * 32767).astype('<i2')
import wave
with wave.open(f'{D}/music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(f'wrote {D}/music.wav', len(pcm) / SR, 's')
