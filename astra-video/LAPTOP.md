# Rendering both ASTRA films on a laptop (Windows / macOS / Linux)

Target machine: Lenovo Yoga Slim 7, Ryzen AI 7 350 (8 cores / 16 threads), 32 GB DDR5, Radeon 860M iGPU.

## One-time setup
1. Install **Node.js LTS**, **FFmpeg** (Windows: `winget install Gyan.FFmpeg`, reopen the terminal), and **Python 3** with
   `pip install numpy scipy` (only used to build the score and mix; the finished film-1 audio is already in the bundle).
2. In this folder:
   ```
   npm install
   npx playwright install chromium
   ```
3. Check that your ffmpeg has the encoders you want:  `ffmpeg -encoders | findstr /i "av1 264"`  (use `grep -i` on macOS/Linux).
   Software AV1 = `libsvtav1` (bundled in normal ffmpeg builds). AMD hardware AV1 on this iGPU = `av1_amf` (Windows).

## Render everything (video 2, then video 1, each as H.264 AND AV1)
```
./render_all.sh            # Windows: render_all.bat      (foreground; Ctrl+C stops, run again to resume)
./render_all.sh --bg       # detached; then:  ./status.sh   or   ./status.sh --watch      (Windows: status.bat)
```
- Output: `out/edu/astra_edu_h264.mp4`, `out/edu/astra_edu_av1.mp4`, `out/astra_h264.mp4`, `out/astra_av1.mp4`.
- Logs: `logs/render_all.log` (overview), `logs/edu.log`, `logs/astra.log` (full detail). `logs/overall.json` and
  `out/<film>/status.json` hold machine-readable progress; the status script prints a progress bar, fps and ETA.
- **Resumable:** progress is saved in 600-frame chunks. Stop and re-run the same command; finished chunks are skipped.
- Video 2 is skipped (with a clear message) until its narration exists, so captions can never drift from the voice
  (see "Narration for video 2" below). Video 1 renders regardless.

Useful options (all go straight through `render_all`, e.g. `./render_all.sh --codec av1 --workers 6`):

| Option | Meaning |
|---|---|
| `--films astra` / `--films edu` | only one film |
| `--codec h264` / `av1` / `both` | default `both`: frames are rendered once and encoded to both |
| `--workers N` | parallel Chromium workers (default: half your logical cores, max 8) |
| `--gpu` | GPU rasterisation (run `node render.mjs --bench` first; it picks CPU vs GPU for you) |
| `--av1enc svt\|amf\|nvenc\|qsv\|vaapi` | AV1 encoder; default `svt` (CPU, best quality). `amf` uses the Radeon's AV1 block |
| `--av1crf 22 --av1preset 6` | SVT-AV1 quality (lower = better) and speed (lower = slower/better). 10-bit output avoids banding |
| `--encoder x264\|amf\|nvenc\|vaapi\|qsv --crf 17` | H.264 encoder and quality (default x264 crf 17) |
| `--from S --to S --force` | render a short test range first |
| `--allow-silent` | render video 2 even without narration (captions then run on the script's own timing) |

H.264 is the compatibility copy (plays everywhere). AV1 is the high-quality, much smaller copy (needs a recent player/browser/TV).
Quick test of everything in ~2 minutes: `./render_all.sh --films astra --from 10 --to 14 --force --workers 4`.

## Narration for video 2 (so text lines up with the voice)
Video 2's voice is generated from its captions, then each caption is aligned to the audio:
```
node render.mjs --film edu --timeline            # writes out/edu/timeline.json (caption text)
python3 narrate.py --film edu --plan              # shows the batches (about 6 requests of <= 8.5 min), no network
GKEY=<your key> python3 narrate.py --film edu     # Windows PowerShell:  $env:GKEY="<key>"; python narrate.py --film edu
```
This needs internet and your Gemini key (read from the environment only; never stored). It stops at the first quota error and
resumes where it left off. It writes `out/edu/tts/*.wav` and `out/edu/narration.json`: for every caption, the moment its
sentence starts in the audio. The film is then retimed so each caption appears exactly then. A "CHECK" list at the end flags
any caption whose speech rate looks wrong. Re-running `render_all` rebuilds the music and mix automatically when
`narration.json` is newer than the audio. Video 1's narration is already aligned and included.

## Single-film manual use
```
node render.mjs --film edu --codec both --workers 8          # video, audio, mux in order
node render.mjs --film astra --phase video --workers 8       # or one phase at a time: video / audio / mux
node render.mjs --film edu --stills 100,600,1500             # PNG stills for review -> out/edu/stills
node sched.mjs                                               # scene start times of video 2
```
`--phase video` is the parallel, resumable one. If the laptop throttles on battery, plug in, set Windows power mode to
Best performance, and try `--workers 6`.
