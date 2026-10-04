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

## Render everything (video 2, then video 1, each as AV1 then H.264)
```
./render_all.sh            # Windows: render_all.bat      (foreground; Ctrl+C stops, run again to resume)
./render_all.sh --bg       # detached; then:  ./status.sh   or   ./status.sh --watch      (Windows: status.bat)
```
- Output: `out/edu/astra_edu_h264.mp4`, `out/edu/astra_edu_av1.mp4`, `out/astra_h264.mp4`, `out/astra_av1.mp4`.
- Logs: `logs/render_all.log` (overview), `logs/edu.log`, `logs/astra.log` (full detail). `logs/overall.json` and
  `out/<film>/status.json` hold machine-readable progress; the status script prints a progress bar, fps and ETA.
- **Resumable:** progress is saved in 600-frame chunks. Stop and re-run the same command; matching, valid chunks are skipped. Source, narration, frame rate, range and encoder changes invalidate the cache.
- The completed H.264 conversion is also reused on resume. A shared render lock prevents concurrent film renders competing for the GPU and output files.
- Video 2 is skipped (with a clear message) until all narration batches have been generated and timing estimates exist
  (see "Narration for video 2" below). Video 1 renders regardless.

Useful options (all go straight through `render_all`, e.g. `./render_all.sh --codec av1 --workers 6`):

| Option | Meaning |
|---|---|
| `--films astra` / `--films edu` | only one film |
| `--codec h264` / `av1` / `both` | default `both`: capture frames once for AV1, then derive H.264 from the finished AV1 |
| `--workers N` | parallel Chromium workers (default 2, with bounded encoder threads) |
| `--gpu` | GPU rasterisation (enabled by default); `--cpu-raster` disables it |
| `--av1enc auto\|svt\|amf\|nvenc\|qsv\|vaapi` | AV1 encoder; default `auto` probes hardware. Radeon uses VAAPI on Linux, AMF on Windows |
| `--av1crf 22 --av1preset 6` | AV1 quality (lower = better); preset controls SVT speed only with `--av1enc svt`. AV1 output is 10-bit |
| `--encoder auto\|x264\|amf\|nvenc\|vaapi\|qsv --crf 17` | H.264 encoder and quality (default hardware `auto`, quality 17) |
| `--threads N` | CPU threads per encoder, default up to 4 |
| `--capture png\|jpeg` | lossless PNG by default; JPEG 95 is an optional speed/quality tradeoff |
| `--device /dev/dri/renderD128` | select the Linux VAAPI GPU |
| `--check-encoders` | run short real encodes before a long render |
| `--from S --to S --force` | render a short test range first |
| `--allow-silent` | render video 2 even without narration (captions then run on the script's own timing) |

H.264 is the compatibility copy (plays everywhere). AV1 is the high-quality, much smaller copy (needs a recent player/browser/TV).
Quick test of everything in ~2 minutes: `./render_all.sh --films astra --from 10 --to 14 --force --workers 4`.

## Narration for video 2 (so text lines up with the voice)
Video 2's voice is generated from its captions, then each caption is aligned to the audio:
```
node render.mjs --film edu --timeline            # writes out/edu/timeline.json (caption text)
python3 narrate.py --film edu --plan              # shows the batches (7 requests, estimated at up to 8.5 minutes each), no network
GKEY=<your key> python3 narrate.py --film edu --max-requests 7     # Windows PowerShell:  $env:GKEY="<key>"; python narrate.py --film edu --max-requests 7
```
This needs internet and your Gemini key (read from the environment only; never stored). It stops at the first API error, never retries automatically, and
resumes from verified cached batches. --max-requests caps new requests for that invocation. Keep model, voice and
batch settings the same when resuming. --generate-only saves batches without estimating caption timing;
--align-only estimates timings locally without using the API. out/edu/tts/requests.json records attempts by key label,
without storing keys; set GKEY_LABEL to an identifying label if using multiple keys. It writes `out/edu/tts/*.wav` and `out/edu/narration.json`: estimated onset times for each caption. The film is retimed using these estimates. Pause matching does not verify
the transcript, so review timing and scene cuts before a final render. A "CHECK" list at the end flags
any caption whose speech rate looks wrong. Re-running `render_all` rebuilds the music and mix automatically when
`narration.json` is newer than the audio. Video 1's supplied narration timing and finished mix are included.

## Single-film manual use
```
node render.mjs --film edu --codec both --workers 2          # video, audio, mux in order
node render.mjs --film astra --phase video --workers 2       # or one phase at a time: video / audio / mux
node render.mjs --film edu --stills 100,600,1500             # PNG stills for review -> out/edu/stills
node sched.mjs                                               # scene start times of video 2
```
`--phase video` is the parallel, resumable one. If the laptop throttles on battery, plug in, set Windows power mode to
Best performance, and compare `--workers 1`, `2`, and `4` on a short range.

## GPU pipeline and quality

The default pipeline is Chromium GPU rasterisation, lossless PNG capture, 10-bit GPU AV1 encoding, then GPU H.264 encoding.
VAAPI converts captured RGB to 10-bit video on the GPU. Where the actual driver supports it, the H.264 conversion also uses GPU AV1 decoding and GPU colour conversion.
The script probes this path and reports when decode/conversion must use the CPU while encoding stays on the GPU.
Hardware encoder discovery never silently falls back to CPU encoding.

On this Linux Radeon laptop, use `node render.mjs --check-encoders` to verify VAAPI.
For explicit CPU encoding, pass `--av1enc svt --encoder x264`.
Quality values differ between encoder families; `--av1crf` maps to each encoder's native quality control, not an identical visual result.
H.264 is derived from the compressed AV1 master, so it has an additional compression generation.
Use AV1 for the best quality and H.264 for compatibility.

`node render.mjs --bench` measures capture speed with CPU and GPU rasterisation; it does not measure encoder throughput.
Benchmark a short `--phase video --from S --to S` range to choose workers for the whole pipeline.

## Verification

`npm test` runs the renderer helper checks.
`RENDER_INTEGRATION=1 npm test` additionally runs real Chromium/FFmpeg tests using explicit software encoders.
`RENDER_INTEGRATION=1 TEST_GPU=1 npm test` verifies the default GPU pipeline on the local driver.
Integration tests use temporary copies, so they do not overwrite your render outputs.


Batch length is an estimate from word count. This run produced about 32 audio tokens per second, so the
16,384-token output ceiling corresponds to roughly 8.5 minutes, with no safety margin at that length.
For slower delivery in a new project, use `--minutes 7` or smaller. Keep the original batch settings when
resuming these completed assets. The seven video 2 batches generated here are all below the output ceiling.

## Measured defaults and useful next upgrades

On the Radeon 860M, a four-second 1080p sample (140-144 s, 30 fps, 30-frame chunks, two workers)
took 9.3 seconds with GPU rasterisation and 12.8 seconds with CPU rasterisation, including both GPU video encodes.
This short sample includes browser/encoder startup and is not a prediction for a whole film.
Two workers give a conservative balance; four can help on heavier scenes, so measure a representative range first.

The next useful upgrades are automatic worker tuning, scene-level cache invalidation so small edits reuse more frames,
and chunked audio generation to reduce memory use and rebuild time on long films.

## Profiling render throughput

The renderer prefetches at most one frame per worker, overlapping capture with transfer/encoding while preserving frame order.
Add `--profile` to report average scene drawing, browser seek, capture, pipe-write and encoder-flush time per frame.
These stages overlap, so their averages are not a total wall-clock time.

```
node render.mjs --phase video --from 140 --to 144 --chunk 30 --workers 4 --profile
```

On the same four-second sample, prefetching gave about 13.5 render fps with two PNG workers,
15 fps with four PNG workers, and 21 fps with two JPEG workers. These are throughput measurements; output remains 30 fps.
Scene drawing averaged under 1 ms. PNG screenshot capture was the main bottleneck.
Keep PNG for the master; use `--capture jpeg` when faster turnaround matters more than preserving every fine gradient/detail.
