const section = document.getElementById('scoobert-celebration');
const audio = document.getElementById('celebration-audio');
const status = document.getElementById('celebration-audio-status');
const params = new URLSearchParams(location.search);

audio.src = params.get('frozen') || '/frozen-celebration.mp3';
audio.preload = 'auto';
audio.loop = false;
audio.load();

let inSection = false;
let waitingForGesture = false;
let primed = false;

const GESTURES = ['pointerdown', 'mousedown', 'touchstart', 'touchend', 'click', 'keydown'];

const FADE_MS = 1200;
let fadeTimer = null;

function fadeTo(target, ms = FADE_MS, done) {
  clearInterval(fadeTimer);
  const from = audio.volume;
  const start = performance.now();
  fadeTimer = setInterval(() => {
    const t = Math.min(1, (performance.now() - start) / ms);
    audio.volume = Math.max(0, Math.min(1, from + (target - from) * t));
    if (t >= 1) {
      clearInterval(fadeTimer);
      if (done) done();
    }
  }, 40);
}

function fadeOutAndPause() {
  fadeTo(0, FADE_MS, () => {
    if (!inSection) audio.pause();
  });
}

function isPlaying() {
  return !audio.paused && !audio.ended;
}

async function playCelebration() {
  if (window.razyBanned) return;
  if (isPlaying()) { fadeTo(1); return; }
  if (audio.ended) audio.currentTime = 0;
  audio.muted = false;
  audio.volume = 0;
  try {
    await audio.play();
    fadeTo(1);
    waitingForGesture = false;
    status.textContent = 'NOW PLAYING: F R O Z E N';
  } catch {
    // Autoplay blocked by the browser: start on the very next tap / click / key press.
    waitingForGesture = true;
    status.textContent = 'TAP ANYWHERE TO START F R O Z E N';
  }
}

function onGesture() {
  if (inSection || waitingForGesture) {
    playCelebration();
  } else if (!primed) {
    // Unlock the audio element early so it can autoplay later when the section is reached.
    primed = true;
    audio.muted = true;
    audio.play().then(() => {
      if (!inSection) { audio.pause(); audio.currentTime = 0; }
      audio.muted = false;
    }).catch(() => { audio.muted = false; primed = false; });
  }
}
for (const type of GESTURES) addEventListener(type, onGesture, { passive: true });

new IntersectionObserver((entries) => {
  for (const entry of entries) {
    inSection = entry.isIntersecting;
    if (inSection) playCelebration();
    else if (isPlaying()) fadeOutAndPause();
  }
}, { threshold: 0.35 }).observe(section);

audio.addEventListener('ended', () => {
  status.textContent = 'F R O Z E N • CELEBRATION COMPLETE';
});
audio.addEventListener('error', () => {
  status.textContent = 'SOUNDTRACK COULD NOT LOAD — REFRESH THE PAGE';
});
audio.addEventListener('canplaythrough', () => {
  if (inSection && !isPlaying() && !audio.ended) playCelebration();
}, { once: true });

addEventListener('razy-player-banned', () => {
  clearInterval(fadeTimer);
  audio.pause();
  audio.volume = 0;
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.pause();
  else if (inSection && !audio.ended) playCelebration();
});
