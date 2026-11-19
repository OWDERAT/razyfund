import { descentDepth, descentVolume } from './scoobert-depth.js';
import { timewarpPhase } from './timewarp-sequence.js';

export function setupTimewarp() {
  const section = document.getElementById('timewarp');
  const overlay = document.getElementById('timewarp-screen');
  const video = document.getElementById('timewarp-video');
  const dog = document.getElementById('timewarp-dog');
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const music = new Audio(params.get('timewarpMusic') || '');
  const scream = new Audio(params.get('scream') || '');
  music.loop = true;
  music.preload = 'auto';
  scream.preload = 'auto';
  music.volume = 0;
  scream.volume = 0;
  video.src = params.get('transmission') || '';
  dog.src = params.get('dog') || '';
  document.getElementById('timewarp-image').src = params.get('corridor') || '';
  let depth = 0;
  let active = false;
  let elapsed = 0;
  let phase = 'idle';
  let screamEnded = false;
  let videoEnded = false;
  let blackedOut = false;
  let priming = false;
  let volume = 0;
  let lastTime;
  let lastNoise = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  history.scrollRestoration = 'manual';
  window.scrollTo({ top: 0, behavior: 'instant' });

  async function prime() {
    if (priming || blackedOut) return;
    priming = true;
    await Promise.all([music, scream, video].map(async (media) => {
      // Prime every sound during the same ordinary page gesture, without sound buttons.
      if (!media.paused || phase === 'scare' || phase === 'video') return;
      const previous = media.volume;
      media.volume = 0;
      try {
        await media.play();
        media.pause();
        media.currentTime = 0;
      } catch { /* The next ordinary interaction can retry. */ }
      media.volume = previous;
    }));
    priming = false;
    resume();
  }
  function resume() {
    if (document.hidden || priming || blackedOut) return;
    const media = phase === 'scare' ? scream : phase === 'video' ? video : active && phase === 'waiting' ? music : null;
    if (media?.paused) media.play().catch(() => {});
  }
  for (const event of ['pointerdown', 'keydown', 'touchend']) addEventListener(event, prime, { passive: true });
  scream.addEventListener('ended', () => { screamEnded = true; });
  scream.addEventListener('error', () => { screamEnded = true; });
  video.addEventListener('ended', () => { videoEnded = true; });
  video.addEventListener('error', () => { videoEnded = true; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) [music, scream, video].forEach(media => media.pause());
    else resume();
  });
  document.getElementById('timewarp-return').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'instant' }));
  addEventListener('keydown', event => {
    if (event.key === 'Escape' && active && !blackedOut) window.scrollTo({ top: 0, behavior: 'instant' });
  });

  function measure() {
    if (blackedOut) return;
    const rect = section.getBoundingClientRect();
    const nextActive = rect.top < innerHeight * .55 && rect.bottom > innerHeight * .35;
    depth = descentDepth(scrollY, section.offsetTop - innerHeight * .85, innerHeight * .9);
    if (!nextActive && active) {
      elapsed = 0;
      screamEnded = false;
      videoEnded = false;
      [music, scream, video].forEach(media => { media.pause(); media.currentTime = 0; });
      volume = 0;
      music.volume = 0;
    }
    active = nextActive;
    root.style.setProperty('--warp-depth', depth.toFixed(4));
    document.body.classList.toggle('time-displaced', depth > .03);
  }
  addEventListener('scroll', measure, { passive: true });
  addEventListener('resize', measure);
  measure();

  function tick(time) {
    if (blackedOut) return { depth, hush: true };
    const delta = lastTime === undefined ? 0 : Math.min((time - lastTime) / 1000, .1);
    lastTime = time;
    if (active && !document.hidden) elapsed += delta;
    const next = timewarpPhase(elapsed, active, screamEnded, videoEnded, blackedOut);
    if (next !== phase) {
      phase = next;
      section.dataset.phase = phase;
      overlay.dataset.phase = phase;
      overlay.hidden = phase !== 'scare' && phase !== 'video' && phase !== 'aftermath';
      document.getElementById('timewarp-status').textContent = phase === 'quiet' ? 'SOMETHING STOPPED BREATHING' : phase === 'aftermath' ? 'TRANSMISSION ENDED' : 'TIME COORDINATES INVALID';
      if (phase === 'scare') { music.pause(); music.volume = 0; scream.volume = .85; }
      if (phase === 'video') { scream.pause(); video.volume = .85; }
      if (phase === 'aftermath') {
        blackedOut = true;
        [music, scream, video].forEach(media => { media.pause(); media.volume = 0; });
        document.body.classList.add('timewarp-blackout');
        for (const child of document.body.children) {
          if (child !== overlay && child instanceof HTMLElement) child.inert = true;
        }
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      }
      resume();
    }
    const target = !document.hidden && phase === 'waiting' ? descentVolume(depth) : 0;
    volume += (target - volume) * Math.min(1, delta * (phase === 'quiet' ? 5 : 3));
    music.volume = Math.max(0, Math.min(.7, volume));
    if (phase === 'waiting' && !priming) resume();
    if (!active && music.volume < .002) music.pause();
    if (time - lastNoise > 190) {
      lastNoise = time;
      root.style.setProperty('--warp-shift', reduced.matches ? '0px' : ((Math.random() - .5) * 24 * depth).toFixed(2) + 'px');
      document.getElementById('timewarp-year').textContent = active && phase === 'waiting' ? ['2026', '19̸9̸6̸', '????', '0000'][Math.floor(Math.random() * 4)] : '????';
    }
    return { depth, hush: active && phase !== 'waiting' };
  }
  return { tick };
}