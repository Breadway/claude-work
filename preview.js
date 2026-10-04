import { FPS } from './engine/stage.js';

export async function initPreview(stage, film, params) {
  const byId = (id) => document.getElementById(id);
  const audio = byId('audio'), play = byId('play'), scrub = byId('scrub'), status = byId('status');
  const chapter = byId('chapter'), fpsInput = byId('fps'), fit = byId('fit'), viewport = byId('viewport');
  const caps = byId('caps');
  // Keep the exported 1080p frame intact, but give the viewer a separate caption area.
  viewport.appendChild(caps);
  let captionFont = 34;
  let fps = 60, lastFrame = -1, raf = 0, ready = false, lastUi = -Infinity;
  let T = Math.min(stage.total, Math.max(0, Number(params.get('t')) || 0));
  const stats = window.__previewStats = { targetFps: fps, frames: 0, skipped: 0, time: T, drawMs: 0 };
  const formatTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const message = (text, error = false) => { status.textContent = text; status.classList.toggle('error', error); };

  function fitCaption() {
    const box = caps.firstElementChild;
    if (!box || document.body.classList.contains('hide-captions')) return;
    let font = captionFont;
    box.style.fontSize = `${font}px`;
    const available = caps.clientHeight - 24;
    // Measure only when a caption or viewport changes, never on each playback frame.
    while (font > 10 && (box.offsetHeight > available || box.scrollWidth > box.clientWidth)) {
      const ratio = Math.min(available / box.offsetHeight, box.clientWidth / box.scrollWidth);
      font = Math.max(10, Math.min(font - 1, Math.floor(font * ratio * 0.98)));
      box.style.fontSize = `${font}px`;
    }
  }
  function resize() {
    const hidden = document.body.classList.contains('hide-captions');
    const reserve = hidden ? 0 : Math.min(viewport.clientHeight / 2, Math.max(64, viewport.clientHeight * 0.1));
    const scale = Math.min(viewport.clientWidth / 1920, (viewport.clientHeight - reserve) / 1080);
    fit.style.transform = `scale(${scale})`;
    fit.style.left = (viewport.clientWidth - 1920 * scale) / 2 + 'px';
    fit.style.top = '0px';
    caps.style.top = `${1080 * scale}px`;
    captionFont = Math.max(16, Math.min(34, 34 * scale));
    fitCaption();
  }
  new MutationObserver(fitCaption).observe(caps, { childList: true, subtree: true });
  new ResizeObserver(resize).observe(viewport); resize();
  byId('film').value = film;
  const pacing = film === 'edu' ? params.get('pacing') || 'narration' : 'narration';
  byId('pacing-picker').hidden = film !== 'edu'; byId('pacing').value = pacing;
  byId('pacing').onchange = (event) => {
    audio.pause(); const url = new URL(location.href);
    url.searchParams.set('pacing', event.target.value); url.searchParams.delete('t'); location.href = url;
  };
  byId('film').onchange = (event) => {
    audio.pause(); const url = new URL(location.href);
    url.searchParams.set('film', event.target.value); url.searchParams.delete('t'); url.searchParams.delete('pacing'); location.href = url;
  };
  chapter.replaceChildren();
  const stops = film === 'edu' ? stage.scenes.filter((s) => s.id.startsWith('card')) : stage.scenes;
  for (const s of stops) {
    const title = film === 'edu' ? `${s.ch}. ${stage.opts.chapters[s.ch - 1]}` : s.title || s.id.replace(/_/g, ' ');
    chapter.add(new Option(title, String(s.start)));
  }

  function updateUi(force = false) {
    const now = performance.now();
    if (!force && now - lastUi < 200) return;
    lastUi = now; scrub.value = String(T / stage.total * 1000);
    scrub.setAttribute('aria-valuetext', `${formatTime(T)} of ${formatTime(stage.total)}`);
    byId('time').textContent = `${formatTime(T)} / ${formatTime(stage.total)}`;
    // Media timestamps can round a seek a few microseconds below a chapter boundary.
    const stop = stops.findLast((s) => T >= s.start - 0.001);
    if (stop) chapter.value = String(stop.start);
  }
  function draw(force = false) {
    const frame = Math.floor(T * fps + 1e-7);
    if (force || frame !== lastFrame) {
      if (!force && lastFrame >= 0 && frame > lastFrame + 1) stats.skipped += frame - lastFrame - 1;
      const sample = Math.min(stage.total - 1e-4, frame / fps);
      const start = performance.now();
      // Keep grain's original time scale while sampling motion at the playback rate.
      stage.seek(sample, Math.round(sample * FPS));
      stats.drawMs = performance.now() - start; stats.frames++; stats.time = sample; lastFrame = frame;
    }
    updateUi(force);
  }
  function stopLoop() { cancelAnimationFrame(raf); raf = 0; }
  function loop() {
    raf = 0;
    if (audio.paused) return;
    T = Math.min(audio.currentTime, stage.total); draw();
    if (T >= stage.total) { audio.pause(); message('Finished. Play to watch again.'); updateUi(true); return; }
    raf = requestAnimationFrame(loop);
  }
  function seek(t) {
    T = Math.min(stage.total, Math.max(0, t)); lastFrame = -1;
    if (ready) audio.currentTime = T;
    draw(true);
  }
  async function togglePlay() {
    if (!ready) return;
    if (!audio.paused) { audio.pause(); return; }
    if (audio.currentTime >= stage.total - 1 / fps || audio.ended) seek(0);
    try { await audio.play(); }
    catch (error) { if (error.name !== 'AbortError') message(`Playback could not start: ${error.message}`, true); }
  }
  play.onclick = togglePlay;
  byId('restart').onclick = () => seek(0);
  scrub.oninput = () => seek(Number(scrub.value) / 1000 * stage.total);
  chapter.onchange = () => seek(Number(chapter.value));
  fpsInput.onchange = () => { fps = Number(fpsInput.value); stats.targetFps = fps; lastFrame = -1; draw(true); };
  audio.volume = Number(byId('volume').value);
  byId('volume').oninput = (event) => { audio.volume = Number(event.target.value); };
  byId('captions').onclick = () => {
    const hidden = document.body.classList.toggle('hide-captions');
    byId('captions').setAttribute('aria-pressed', String(!hidden));
    resize();
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else { await viewport.requestFullscreen(); viewport.tabIndex = -1; viewport.focus({ preventScroll: true }); }
    }
    catch { message('Fullscreen is unavailable in this browser.', true); }
  };
  byId('fullscreen').onclick = fullscreen;
  document.addEventListener('fullscreenchange', () => {
    byId('fullscreen').textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'; resize();
  });
  addEventListener('keydown', (event) => {
    if (event.target.closest('input, select, button') || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.code === 'Space') { event.preventDefault(); togglePlay(); }
    if (['ArrowRight', 'ArrowLeft'].includes(event.code)) {
      event.preventDefault(); seek((ready ? audio.currentTime : T) + (event.code === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 5 : 1 / fps));
    }
    if (event.code === 'KeyF') { event.preventDefault(); fullscreen(); }
  });
  let audioKind = '';
  audio.addEventListener('playing', () => { play.textContent = 'Pause'; message(`Playing · ${audioKind}`); stopLoop(); raf = requestAnimationFrame(loop); });
  audio.addEventListener('pause', () => { play.textContent = 'Play'; stopLoop(); T = Math.min(audio.currentTime, stage.total); draw(true); if (ready && !audio.error) message(T >= stage.total ? 'Finished. Play to watch again.' : `Paused · ${audioKind}`); });
  audio.addEventListener('waiting', () => message('Buffering audio…'));
  audio.addEventListener('seeking', () => { T = Math.min(audio.currentTime, stage.total); lastFrame = -1; draw(true); });
  audio.addEventListener('seeked', () => { T = Math.min(audio.currentTime, stage.total); draw(true); if (ready) message(`${audio.paused ? 'Paused' : 'Playing'} · ${audioKind}`); });
  audio.addEventListener('ended', () => { T = stage.total; draw(true); message('Finished. Play to watch again.'); });
  audio.addEventListener('error', () => { ready = false; play.disabled = true; stopLoop(); message('Audio could not be loaded. Run npm run prepare-preview, then reload.', true); });
  draw(true);
  try {
    const response = await fetch('/api/films', { cache: 'no-store' });
    if (!response.ok) throw new Error('Start the viewer with npm run preview.');
    const entry = (await response.json()).find((item) => item.id === film);
    byId('pacing').querySelector('[value="original"]').disabled = !entry?.originalAudio;
    const source = pacing === 'original' ? entry?.originalAudio : entry?.audio;
    if (!source || !entry.narration) throw new Error('Film audio is missing. Run npm run prepare-preview, then reload.');
    audioKind = entry.audioKind;
    await new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); audio.removeEventListener('loadedmetadata', loaded); audio.removeEventListener('error', failed); };
      const loaded = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error('The browser could not decode the film audio.')); };
      const timer = setTimeout(() => { cleanup(); reject(new Error('Audio took too long to load. Reload the page to retry.')); }, 20000);
      audio.addEventListener('loadedmetadata', loaded); audio.addEventListener('error', failed); audio.src = source; audio.load();
    });
    if (!Number.isFinite(audio.duration) || audio.duration < stage.total - 0.05) throw new Error('The audio is shorter than this film. Run npm run prepare-preview.');
    ready = true; audio.currentTime = T; play.disabled = false;
    message(`Ready · ${audioKind}`); window.__previewReady = true;
  } catch (error) { message(error.message, true); }
}
