const section = document.getElementById('scoobert-celebration');
const audio = document.getElementById('celebration-audio');
const replay = document.getElementById('celebration-replay');
const status = document.getElementById('celebration-audio-status');
const params = new URLSearchParams(location.search);

audio.src = params.get('frozen') || '/frozen-celebration.mp3';
audio.preload = 'auto';

let started = false;
let attempted = false;

async function playCelebration(restart = false) {
  if (window.razyBanned) return;
  if (restart) audio.currentTime = 0;
  try {
    await audio.play();
    started = true;
    attempted = true;
    status.textContent = 'NOW PLAYING: F R O Z E N';
  } catch {
    attempted = true;
    status.textContent = 'TAP PLAY F R O Z E N AGAIN IF YOUR BROWSER BLOCKED AUTOPLAY';
  }
}

function sectionIsVisible() {
  const rect = section.getBoundingClientRect();
  return rect.top < innerHeight * .8 && rect.bottom > innerHeight * .2;
}

function checkScroll() {
  if (!started && !attempted && sectionIsVisible()) playCelebration();
}

replay.addEventListener('click', () => playCelebration(true));
addEventListener('scroll', checkScroll, { passive: true });
addEventListener('resize', checkScroll);

for (const event of ['pointerdown', 'keydown', 'touchend']) {
  addEventListener(event, () => {
    if (!started && sectionIsVisible()) playCelebration();
  }, { passive: true });
}

audio.addEventListener('ended', () => {
  status.textContent = 'F R O Z E N • CELEBRATION COMPLETE';
});
audio.addEventListener('error', () => {
  status.textContent = 'SOUNDTRACK COULD NOT LOAD — USE THE REPLAY BUTTON TO TRY AGAIN';
});

addEventListener('razy-player-banned', () => {
  audio.pause();
  audio.volume = 0;
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.pause();
});

checkScroll();
