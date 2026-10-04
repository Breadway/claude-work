"""Pause-based caption timing estimates. These do not verify the spoken transcript."""
import os
import re
import subprocess
import numpy as np
from tts_common import probe

def wlen(t):  # speech-length proxy: characters, plus what spoken numbers add ("96" -> "ninety-six")
    n = len(t)
    for m in re.finditer(r'\d[\d,\.]*', t): n += 4 * len(re.sub(r'\D', '', m.group()))
    return n + 8 * t.count('%')

def silences(f, d=0.12, db=-36):
    p = subprocess.run([os.environ.get('FFMPEG', 'ffmpeg'), '-i', f, '-af', f'silencedetect=noise={db}dB:d={d}', '-f', 'null', '-'], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r'silence_start: (-?[\d.]+)', p)]; en = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', p)]
    if len(st) > len(en): en.append(probe(f))
    return [(max(0, a), b) for a, b in zip(st, en)]

def align(Dur, sil, chars):
    """Return speech-onset time (s) of each caption in a batch of audio, given the captions' character counts."""
    if not chars or any(c <= 0 for c in chars): raise ValueError('Caption lengths must be positive')
    if not np.isfinite(Dur) or Dur <= 0: raise ValueError('Audio duration must be positive')
    K = len(chars); tot = sum(chars); cum = np.concatenate([[0], np.cumsum(chars)])
    t0 = sil[0][1] if sil and sil[0][0] < 0.08 else 0.0
    t1 = sil[-1][0] if sil and sil[-1][1] > Dur - 0.08 else Dur
    if t1 <= t0: raise ValueError('No speech interval found')
    rate = (t1 - t0) / tot
    cand = np.array([(e, e - s) for s, e in sil if t0 + 0.4 < e < t1 - 0.4])        # (onset, gap)
    if t1 <= t0: raise ValueError('No speech interval found')
    if K == 1: return [t0], rate, t0, t1
    if len(cand) < K - 1:
        return list(t0 + rate * cum[:-1]), rate, t0, t1
    on, gap = cand.reshape(-1, 2)[:, 0], cand.reshape(-1, 2)[:, 1]
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
        c = cost[-1][None, :] + 6 * np.log(np.maximum(d, 0.3) / exp) ** 2 + np.where(d <= 0, np.inf, 0) - 1.2 * np.minimum(gap[idx], 0.9)[:, None]
        back.append(np.argmin(c, 1)); cost.append(np.min(c, 1))
    if K == 1: return [t0], rate, t0, t1
    # final segment
    last = layers[-1]; d = t1 - on[last]; fc = cost[-1] + 6 * np.log(np.maximum(d, 0.3) / (chars[-1] * rate)) ** 2 + np.where(d <= 0, np.inf, 0)
    if not np.isfinite(fc).any():
        return list(t0 + rate * cum[:-1]), rate, t0, t1
    j = int(np.argmin(fc)); path = [j]
    for k in range(K - 2, 0, -1): j = int(back[k][j]); path.append(j)
    path = path[::-1]; onsets = [t0] + [float(on[layers[k][path[k]]]) for k in range(K - 1)]
    return onsets, rate, t0, t1

def cut(src, a, b, dst): subprocess.check_call([os.environ.get('FFMPEG', 'ffmpeg'), '-loglevel', 'error', '-y', '-i', src, '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-c:a', 'pcm_s16le', dst])
