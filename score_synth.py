"""Shared oscillators and arrangement presets for the procedural film score."""
import math
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
BEAT = 60.0 / 84.0
CHORD_LEN = BEAT * 8
rng = np.random.default_rng(7)

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

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)


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


def tick(dur=0.05, generator=None):
    n = int(dur * SR); t = np.arange(n) / SR
    return (generator if generator is not None else rng).standard_normal(n) * np.exp(-t * 90)


def whoosh(dur=1.2, generator=None):
    n = int(dur * SR); t = np.arange(n) / SR
    x = (generator if generator is not None else rng).standard_normal(n)
    out = np.zeros(n)
    seg = 2048
    for i in range(0, n, seg):
        u = i / n; lo = 300 + 5200 * u ** 2; hi = lo * 1.7
        sos = butter(2, [lo, min(hi, 18000)], btype='band', fs=SR, output='sos')
        out[i:i + seg] = sosfilt(sos, x[i:i + seg])
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    return out * env
