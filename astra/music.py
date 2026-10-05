"""ASTRA video engine - procedural score + whooshes, generated from out/timeline.json.
Pure numpy/scipy: pads, bass, plucked arps, soft pulse, scene-change whooshes, convolution reverb.
    python3 music.py            -> out/music.wav
"""
import json, math, sys, os
from score_synth import TYPES, PROG, SCN, mtof, pad_voice, pluck, kick, tick, whoosh, rng
if "--stream" in sys.argv:
    from music_stream import main
    main()
    sys.exit(0)
FILM = os.environ.get('FILM', 'astra'); D = 'out' if FILM == 'astra' else f'out/{FILM}'
import numpy as np
from scipy.signal import oaconvolve

SR = 44100
tl = json.load(open(f'{D}/timeline.json'))
TOTAL = tl['total']
N = int((TOTAL + 4) * SR)
L = np.zeros(N); R = np.zeros(N)
BPM = 84.0
BEAT = 60.0 / BPM
CHORD_LEN = BEAT * 8           # two bars per chord

def scene_at(t):
    cur = tl['scenes'][0]
    for s in tl['scenes']:
        if t >= s['start'] + 0.4: cur = s
    return cur


def add(buf, start, sig, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N: return
    j = min(N, i + len(sig))
    sig = sig[:j - i] * gain
    gl = math.cos((pan + 1) * math.pi / 4); gr = math.sin((pan + 1) * math.pi / 4)
    L[i:j] += sig * gl; R[i:j] += sig * gr


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
