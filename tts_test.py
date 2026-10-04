"""One explicitly budgeted voice audition. Delivery instructions are separate from spoken text.

GKEY=... python3 tts_test.py --max-requests 1 --model gemini-3.8-flash-lite-tts
"""
import argparse
from pathlib import Path
from tts_common import call, save_wav, probe

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', default='gemini-3.8-flash-lite-tts')
    parser.add_argument('--voice', default='Sadaltager')
    parser.add_argument('--max-requests', type=int, default=0)
    args = parser.parse_args()
    if args.max_requests < 1: parser.error('Supply --max-requests 1 to authorize one audition request')
    line = 'Novacana is a four-player card game about building star systems. Astra is the AI we have been teaching to play it, across seven generations.'
    out = Path(__file__).resolve().parent / 'out' / 'tts' / f'test_{args.voice}.wav'
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists(): raise SystemExit(f'{out} already exists; preserve it before auditioning again')
    data, usage = call(line, args.model, args.voice, 'Confident, upbeat technical explainer. Speak briskly at a natural pace with minimal pauses.')
    save_wav(data, out)
    print(f'{args.voice}: {probe(out):.1f}s, {len(line.split()) / probe(out) * 60:.0f} words/minute')

if __name__ == '__main__':
    main()
