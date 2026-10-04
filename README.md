# ASTRA film engine

A small, dependency-free "video as code" engine and the film it renders: the progression of the Astra
Novacana AI, v1 to v7. Same idea as the Remotion-style videos on X (a video is a pure function of time,
rendered frame by frame), but written from scratch.

## How it works

```
engine/core.js    math, easings, seeded noise, SVG/HTML helpers   (everything is f(t); no rAF, no Math.random)
engine/stage.js   timeline, scene transitions, background, HUD, captions, seek(t)
engine/kit.js     motion-design components: header, cards, stat counters, glyph reveals, network drawing
scenes/*.js       one object per scene: { id, dur, ver, mood, caps, build(root), update(t, state) }
render.mjs        serves the page, drives headless Chromium frame by frame, captures lossless PNGs for GPU AV1, then converts the AV1 master to H.264
music.py          procedural score + whooshes from out/timeline.json (numpy/scipy only)
voiceover.py      narration script + size estimate from the captions
```

A scene is built once (DOM/SVG) and then `update(t)` is called with scene-local seconds for every frame,
so seeking, scrubbing and rendering are all the same code path and are deterministic.

## Commands

```bash
# watch locally, with audio and a 60 fps playback target
npm run preview                 # open http://localhost:8080

# still frames for review
node render.mjs --stills 3,40,120

# full render: GPU AV1 first, then the GPU H.264 compatibility copy, audio and mux
node render.mjs --workers 2

# verify the real GPU encoding/conversion path
node render.mjs --check-encoders

# short test; matching completed chunks are reused
node render.mjs --from 10 --to 14 --workers 2

# single output with an existing audio track
node render.mjs --codec av1 --out out/astra.mp4 --audio out/music.wav

# narration script / TTS size estimate
python3 voiceover.py
```

The viewing UI includes both films, chapter selection, a seek bar, volume, captions and fullscreen.
It uses the audio playback position as its clock and catches up after a slow frame, rather than letting
the visuals drift. Playback defaults to 60 fps; choose 30 fps in the player for lower GPU use. Actual
frame delivery depends on the display and scene complexity. Video export still defaults to 30 fps.
Space toggles playback, arrows step one playback frame, Shift + arrows skip five seconds, and F toggles fullscreen.
Viewer captions are plain text below the image, so they cannot cover diagrams or labels. At
1920x1200 fullscreen, the film fills the top 1920x1080 and captions use the bottom 120 pixels.
Long captions fit their available space, and hiding captions gives that space back to the film.

Film 2 offers two pacing options: narration pacing (49:18) and original scene pacing (71:28).
Both retain all 17 chapters and 83 scenes, with separate narration, score and effects mixes. Original
pacing keeps longer visual holds after speech; captions and their visual cues still follow the TTS timings.

Film 1 uses the supplied narration and music mix. Film 2 combines its locally assembled narration
with the existing procedural score and transition effects. Its scene recordings are placed at the
engine's retimed offsets, including chapter cards and transitions, and music ducks under speech.
The original TTS batches and alignment files are preserved. Caption boundaries are pause-based estimates;
the player is ready for listening review, and word-level alignment has not been independently verified.

To rebuild the aligned narration and music mix after timing changes:

```bash
npm install
npx playwright install chromium
uv venv .venv
uv pip install --python .venv/bin/python numpy scipy
npm run prepare-preview         # uses existing TTS files, no network TTS requests
npm run preview -- --port 8081   # optional alternative port
```

The server binds to `127.0.0.1`, streams audio with byte-range support for seeking, and serves only viewer
files and playback assets. No remote fonts or services are required. Preparation uses one scene-sized
narration buffer, bounded score windows with continuous reverb, and disk-backed PCM. Completed audio
is reused when its source and timing fingerprints match.

Captions are the narration: each scene's `caps: [[seconds, 'text with *highlight*'], ...]`.


## Film 2: how Astra-7 and its training work (17 chapters)
`scenes_edu/` holds the explainer (`node sched.mjs` lists every scene with its start time). Built on the same engine with
`engine/edukit.js` (matrices, equations, token rows, chapter cards) and a real captured decision (`scenes_edu/data.js`).
Render both films with `./render_all.sh` (see LAPTOP.md). Voice: `narrate.py` (batched TTS + pause-based caption timing estimates, either film).


TTS uses the [Gemini 3.8 Interactions REST API](https://ai.google.dev/gemini-api/docs/speech-generation),
with delivery style kept separate from the spoken transcript. Generation requires an explicit request budget:
`GKEY=<key> python3 narrate.py --film edu --generate-only --max-requests 7`.
Then run `python3 narrate.py --film edu --align-only` locally to cut scene audio and estimate caption timings.
Keys stay in the environment. Verified batches and a request ledger are saved under `out/edu/tts/`.
Caption estimates need review before final rendering; `out/edu/alignment_report.json` lists timing diagnostics.

The supplied video 1 mix is `out/final_audio.m4a`. Its narration timing is `out/narration.json`, and its
source FLACs, scene WAVs, manifest and original archive are together in `out/tts/`.
