"""Render the existing procedural arrangement in bounded windows with continuous reverb."""
import json
import math
import os
import tempfile
import wave
from pathlib import Path
import numpy as np
from scipy.signal import oaconvolve
from score_synth import SR, BEAT, CHORD_LEN, TYPES, PROG, SCN, mtof, pad_voice, pluck, kick, tick, whoosh

IR_SAMPLES = int(2.6 * SR)

def impulse(seed):
    t = np.arange(IR_SAMPLES) / SR
    x = np.random.default_rng(seed).standard_normal(IR_SAMPLES) * np.exp(-t / .75)
    x = np.convolve(x, np.ones(6) / 6, mode='same')
    return (x / np.sqrt((x ** 2).sum())).astype(np.float32)

def render_window(timeline, film, first, last, impulses):
    """Return mastered stereo float PCM for [first,last), using absolute sample positions."""
    origin = max(0, first - IR_SAMPLES)
    count = last - origin
    left = np.zeros(count, np.float32); right = np.zeros(count, np.float32)
    total = timeline['total']
    def add(t, signal, gl=1, gr=1, right_signal=None):
        position = int(t * SR) - origin
        a = max(0, position); b = min(count, position + len(signal))
        if b <= a: return
        skip = a - position
        left[a:b] += signal[skip:skip+b-a] * gl
        other = signal if right_signal is None else right_signal
        right[a:b] += other[skip:skip+b-a] * gr
    def scene_at(t):
        return next((s for s in reversed(timeline['scenes']) if t >= s['start'] + .4), timeline['scenes'][0])
    start_ci = max(0, math.floor((origin / SR - 10) / CHORD_LEN))
    ci = start_ci
    while ci * CHORD_LEN < min(last / SR, total + 2):
        t0 = ci * CHORD_LEN; scene = scene_at(t0 + .2); ch = scene.get('ch') or 0
        fallback = ('ABCDEFGHI'[ch % 9], min(.85, .45 + .028 * ch), ch >= 10) if film != 'astra' else ('A', .5, False)
        prog, energy, pulse = SCN.get(scene['id'], fallback)
        root, typ = PROG[prog][ci % 4]; notes = [root + n for n in TYPES[typ]]
        for k, note in enumerate(notes):
            signal = pad_voice(mtof(note + 12), CHORD_LEN + .6)
            pan = (k - len(notes) / 2) * .22; gain = .20 * (.55 + energy * .7)
            add(t0, signal, gain * math.cos((pan+1)*math.pi/4), gain * math.sin((pan+1)*math.pi/4))
        bass = pad_voice(mtof(root), CHORD_LEN + .3, atk=.6, rel=1.2, det=.001)
        add(t0, bass, .42 * (.5+energy), .42 * (.5+energy))
        pattern = [0,2,1,3,2,1,3,4] if len(notes)>4 else [0,2,1,3,2,1,3,2]
        for step in range(16):
            at = t0 + step * BEAT / 2
            if at >= total + 1: break
            note = notes[pattern[step % 8] % len(notes)] + 24
            velocity = (.55+.45*(step%4 == 0)) * (.22+.55*energy) * (.9 if step%2 else 1)
            signal = pluck(mtof(note)); pan = math.sin(step*.9)*.55
            gl = math.cos((pan+1)*math.pi/4); gr = math.sin((pan+1)*math.pi/4)
            add(at, signal, velocity*.16*gl, velocity*.16*gr)
            add(at + int(BEAT*.75*SR)/SR, signal, velocity*.06*gr, velocity*.06*gl)
        if pulse:
            drum = kick()
            for beat in range(0,8,2): add(t0+beat*BEAT, drum, .30*energy, .30*energy)
            hat = tick(generator=np.random.default_rng(7+ci))
            for beat in range(1,16,2): add(t0+beat*BEAT/2, hat, .05*energy, .05*energy)
        ci += 1
    for index, scene in enumerate(timeline['scenes'][1:]):
        at = scene['start'] - .05
        if at + 1.3 < origin / SR or at > last / SR: continue
        signal = whoosh(1.3, generator=np.random.default_rng(100007+index))
        add(at, signal, .20, .20, signal[::-1]); add(at+.55, kick(.5), .22, .22)
    wet_l = oaconvolve(left, impulses[0])[:count]
    wet_r = oaconvolve(right, impulses[1])[:count]
    skip = first - origin
    out = np.stack([left[skip:]*.78+wet_l[skip:]*.55, right[skip:]*.78+wet_r[skip:]*.55], 1)
    np.tanh(out * 1.4, out=out); out /= 1.4
    end = int(total*SR) + int(1.5*SR)
    positions = np.arange(first,last)
    envelope = np.minimum(1,positions/(1.5*SR)) * np.clip((end-positions)/(3*SR),0,1)
    out *= envelope[:,None]
    return out.astype('<f4',copy=False)

def write_score(timeline, film, output, chunk_seconds=60):
    if not math.isfinite(timeline['total']) or timeline['total'] <= 0: raise ValueError('Invalid timeline duration')
    count = int(timeline['total']*SR) + int(1.5*SR)
    chunk = int(chunk_seconds*SR)
    if chunk <= 0: raise ValueError('Chunk size must be positive')
    impulses = (impulse(300007), impulse(300008)); peak = 0
    output = Path(output); temporary = output.with_name(output.stem+'.tmp.wav')
    try:
        with tempfile.TemporaryDirectory(prefix='astra-score-') as scratch:
            raw = Path(scratch,'score.f32le')
            with raw.open('wb') as stream:
                for first in range(0,count,chunk):
                    data = render_window(timeline,film,first,min(count,first+chunk),impulses)
                    peak = max(peak,float(np.abs(data).max())); stream.write(data.tobytes())
                    print(f'score: {min(count,first+chunk)/SR:.0f}/{count/SR:.0f} s',flush=True)
            gain = .9/max(peak,1e-9)
            with raw.open('rb') as stream, wave.open(str(temporary),'wb') as writer:
                writer.setnchannels(2); writer.setsampwidth(2); writer.setframerate(SR)
                while block := stream.read(chunk*8):
                    data = np.frombuffer(block,'<f4')
                    writer.writeframesraw((data*gain*32767).astype('<i2').tobytes())
        os.replace(temporary,output)
    finally:
        temporary.unlink(missing_ok=True)
    print(f'wrote {output}: {count/SR:.3f} s',flush=True)

def main():
    film = os.environ.get('FILM','astra')
    if film not in ('astra','edu'): raise ValueError('FILM must be astra or edu')
    directory = Path('out') if film == 'astra' else Path('out/edu')
    write_score(json.loads((directory/'timeline.json').read_text()),film,directory/'music.wav')

if __name__ == '__main__': main()
