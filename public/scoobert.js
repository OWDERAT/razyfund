import { descentDepth, descentVolume } from './scoobert-depth.js';
import { setupTimewarp } from './timewarp.js';

const timewarp = setupTimewarp();

const section = document.getElementById('scoobert');
const root = document.documentElement;
const audio = new Audio(new URLSearchParams(location.search).get('music') || '');
audio.loop = true;
audio.preload = 'none';
audio.volume = 0;
let unlocked = false;
let unlocking = false;
let lastAttempt = -1000;
let depth = 0;
let volume = 0;
let lastTime = 0;
let lastGlitch = 0;
let supporters = 0;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
document.getElementById('void-image').src = new URLSearchParams(location.search).get('corridor') || '';

async function unlock(gesture = false) {
  if (unlocked || unlocking || (!gesture && performance.now() - lastAttempt < 1000)) return;
  lastAttempt = performance.now();
  unlocking = true;
  try {
    await audio.play();
    unlocked = true;
    if (depth === 0) audio.pause();
  } catch { /* Browsers may require the first ordinary page interaction. */ }
  finally { unlocking = false; }
}
addEventListener('pointerdown', () => unlock(true), { passive: true });
addEventListener('keydown', () => unlock(true));
addEventListener('touchend', () => unlock(true), { passive: true });
document.getElementById('void-return').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: reduce.matches ? 'instant' : 'smooth' });
});
document.getElementById('void-fund').addEventListener('click', () => {
  supporters += 1;
  document.getElementById('void-supporters').textContent = String(supporters).padStart(3, '0');
  document.getElementById('void-message').textContent = 'your vote made it through. he remembers.';
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
addEventListener('scroll', measure, { passive: true });
addEventListener('resize', measure);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.pause();
});
function tick(time) {
  const delta = Math.min((time - lastTime) / 1000, .1);
  lastTime = time;
  const warp = timewarp.tick(time);
  const target = document.hidden || warp.hush ? 0 : descentVolume(depth) * (1 - warp.depth);
  volume += (target - volume) * Math.min(1, delta * 7);
  if (Math.abs(volume - target) < .001) volume = target;
  audio.volume = Math.max(0, Math.min(.7, volume));
  if (!unlocked && depth > 0 && !document.hidden) unlock();
  if (unlocked && !document.hidden) {
    if (depth > .001 && audio.paused) audio.play().catch(() => {});
    if (depth === 0 && volume < .002 && !audio.paused) audio.pause();
  }
  if (time - lastGlitch > 160) {
    lastGlitch = time;
    const shift = !reduce.matches && depth > .08 && Math.random() < depth * .6 ? (Math.random() - .5) * 14 * depth : 0;
    root.style.setProperty('--void-shift', shift.toFixed(2) + 'px');
  }
  if (depth === 0) root.style.setProperty('--void-shift', '0px');
  requestAnimationFrame(tick);
}
measure();
requestAnimationFrame(tick);