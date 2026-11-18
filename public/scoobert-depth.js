export function descentDepth(scrollY, start, distance) {
  return Math.max(0, Math.min(1, (scrollY - start) / Math.max(1, distance)));
}

export function descentVolume(depth, muted = false) {
  return muted ? 0 : Math.pow(Math.max(0, Math.min(1, depth)), 1.35) * 0.7;
}