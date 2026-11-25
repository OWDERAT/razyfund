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
  } catch {
    status.textContent = 'TAP PLAY F R O Z E N AGAIN IF YOUR BROWSER BLOCKED AUTOPLAY';
  }
}

async function unlock(gesture = false) {
  if (window.razyBanned || unlocked || unlocking || (!gesture && performance.now() - lastAttempt < 1000)) return;
  lastAttempt = performance.now();
  unlocking = true;
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
addEventListener('razy-player-banned',()=>{audio.pause();audio.volume=0;});
addEventListener('pointerdown', () => unlock(true), { passive: true });
addEventListener('keydown', () => unlock(true));
addEventListener('touchend', () => unlock(true), { passive: true });
document.getElementById('void-return').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: reduce.matches ? 'instant' : 'smooth' });
});
document.getElementById('void-fund').addEventListener('click', async () => {
  const msg = document.getElementById('void-message');
  // One persisted vote per server-recognized browser player.
  const w = await window.razyWallet?.({ action: 'vote' });
  if (w?.ok) msg.textContent = 'your vote made it through. he remembers.';
  else if (w?.error === 'already_voted') msg.textContent = 'he already heard you. one voice each.';
  else if (w?.error === 'banned') msg.textContent = 'access denied.';
  else msg.textContent = 'the signal broke. try again.';
  const fresh = await window.razyWallet?.();
  if (fresh) window.razyShowWallet(fresh);
});
function measure() {
  const start = section.offsetTop - innerHeight * .6;
  depth = descentDepth(scrollY, start, section.offsetHeight - innerHeight * .4);
  root.style.setProperty('--void-depth', depth.toFixed(4));
  document.body.classList.toggle('void-corrupted', depth > .08);
  document.getElementById('void-level').textContent = String(Math.round(depth * 999)).padStart(3, '0');
  document.getElementById('void-status').textContent = depth > .75 ? 'SIGNAL LOST' : depth > .35 ? 'SIGNAL DECAY' : 'UNLISTED CHANNEL';
  document.getElementById('void-presence').textContent = depth > .8 ? 'HE IS STILL HERE' : depth > .4 ? 'NO EXIT FOUND' : 'YOU WERE NOT SUPPOSED TO FIND THIS';
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
measure();
requestAnimationFrame(tick);
