export const WAIT_SECONDS = 10;
export const QUIET_SECONDS = 1.2;

export function timewarpPhase(elapsed, active, screamEnded = false, videoEnded = false) {
  if (!active) return 'idle';
  if (elapsed < WAIT_SECONDS) return 'waiting';
  if (elapsed < WAIT_SECONDS + QUIET_SECONDS) return 'quiet';
  if (!screamEnded) return 'scare';
  return videoEnded ? 'aftermath' : 'video';
}