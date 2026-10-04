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
render.mjs        serves the page, drives headless Chromium frame by frame, pipes JPEGs into ffmpeg
music.py          procedural score + whooshes from out/timeline.json (numpy/scipy only)
voiceover.py      narration script + size estimate from the captions
```

A scene is built once (DOM/SVG) and then `update(t)` is called with scene-local seconds for every frame,
so seeking, scrubbing and rendering are all the same code path and are deterministic.

## Commands

```bash
# preview in a browser (space = play, arrows = step, shift+arrows = 5 s)
npx http-server -p 8080 .        # then open http://localhost:8080/?t=0

# still frames for review
node render.mjs --stills 3,40,120

# full render (4 parallel Chromium workers), then mux the score
python3 music.py                 # needs out/timeline.json, written by any render/stills run
node render.mjs --out out/astra.mp4 --audio out/music.wav --workers 4

# narration script / TTS size estimate
python3 voiceover.py
```

Captions are the narration: each scene's `caps: [[seconds, 'text with *highlight*'], ...]`.


## Film 2: how Astra-7 and its training work (17 chapters)
`scenes_edu/` holds the explainer (`node sched.mjs` lists every scene with its start time). Built on the same engine with
`engine/edukit.js` (matrices, equations, token rows, chapter cards) and a real captured decision (`scenes_edu/data.js`).
Render both films with `./render_all.sh` (see LAPTOP.md). Voice: `narrate.py` (batched TTS + caption alignment, any film).
