# Rendering the ASTRA film on a laptop (Windows / macOS / Linux)

Target machine: Lenovo Yoga Slim 7, Ryzen AI 7 350 (8 cores / 16 threads), 32 GB DDR5, Radeon 860M iGPU.

## One-time setup
1. Install **Node.js LTS** (https://nodejs.org) and **FFmpeg** (Windows: `winget install Gyan.FFmpeg`, then reopen the terminal;
   or set `FFMPEG=C:\path\to\ffmpeg.exe`).
2. In this folder:
   ```
   npm install
   npx playwright install chromium
   ```
   Python is NOT needed: the finished audio mix (`out/final_audio.m4a`) is included.
   (Python + numpy + scipy are only needed to regenerate the score or re-mix: `pip install numpy scipy`.)

## Pick the fastest settings (about 1 minute)
```
node render.mjs --bench
```
It times one worker with CPU rasterisation and with GPU rasterisation and prints the suggested command.
The page is SVG + canvas with blur/glow filters, so GPU raster is not always faster; the bench decides.

## Render (three phases, in this order)
```
node render.mjs --phase video --workers 8            # add --gpu if the bench said so
node render.mjs --phase audio
node render.mjs --phase mux                          # -> out/astra.mp4
```
or all three at once: `node render.mjs --workers 8`

- **Parallel + resumable:** the film is cut into 600-frame chunks (`out/video_chunks/`), rendered by N worker browsers.
  If you stop it (Ctrl+C, sleep, crash) just run the same command again: finished chunks are skipped. `--force` starts over.
- **Workers:** default is half your logical cores (8 on this CPU). Each worker is one Chromium (~0.5 GB), so RAM is not a limit;
  try `--workers 6` if the laptop throttles hard on battery. Plug in and set the Windows power mode to Best performance.
- **Encoder:** default `x264` (CPU, best quality per bit). To offload encoding to the iGPU's video block while Chromium uses the CPU:
  `--encoder amf` (Windows, AMD). Linux AMD: `--encoder vaapi`. Check quality on a 10 s sample first:
  `node render.mjs --phase video --from 100 --to 110 --force --encoder amf`
- **Quality/size:** `--crf 17` default (visually lossless-ish, about 150 MB for 12.6 min); `--crf 20` is smaller.
- **Test a short range first:** `node render.mjs --phase video --from 60 --to 70 --force` then `--phase mux` (mux uses `-shortest`).
- **Review stills:** `node render.mjs --stills 30,300,600`

## What the files are
- `out/narration.json` + `out/tts/*.wav`: narration per scene (Gemini TTS, voice Sadaltager) that retimes every scene to the speech.
- `out/final_audio.m4a`: score + narration, ducked, ready to mux (12:37 long, matches the timeline exactly).
- Do not edit `scenes/` or `out/narration.json` between the video and mux phases or the audio will drift.

## Expected speed
This cloud box does about 6 frames/s on 4 slow shared vCPUs. 22,723 frames at 30 fps. A 16-thread Zen 5 laptop should do
noticeably better; `--bench` prints the real number so you can estimate: minutes = 22,723 / fps / 60.
