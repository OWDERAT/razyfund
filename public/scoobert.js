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

// ---- Image rain (skull + santa discord) while inside the section ----
const RAIN_IMAGES = ['/rain-skull.png', '/rain-discord.png'];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const rain = document.createElement('div');
rain.className = 'celebration-rain';
rain.setAttribute('aria-hidden', 'true');
section.prepend(rain);

function buildRain() {
  rain.replaceChildren();
  rain.style.setProperty('--rain-h', section.offsetHeight + 'px');
  const count = reduceMotion ? 6 : 26;
  const rnd = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < count; i++) {
    const img = document.createElement('img');
    img.src = RAIN_IMAGES[i % RAIN_IMAGES.length];
    img.alt = '';
    img.draggable = false;
    img.style.left = rnd(0, 94) + '%';
    img.style.width = rnd(38, 96) + 'px';
    img.style.animationDuration = rnd(5, 10) + 's';
    img.style.animationDelay = -rnd(0, 10) + 's';
    img.style.setProperty('--rain-spin', rnd(-540, 540) + 'deg');
    rain.append(img);
  }
}
buildRain();
addEventListener('resize', buildRain);

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
    rain.classList.toggle('on', inSection);
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
