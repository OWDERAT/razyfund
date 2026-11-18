import { describe, expect, it } from 'vitest';
import { descentDepth, descentVolume } from '../../public/scoobert-depth.js';

describe('Scoobert scroll descent', () => {
  it('gets deeper scrolling down and returns to normal scrolling up', () => {
    expect(descentDepth(0, 1000, 2000)).toBe(0);
    expect(descentDepth(2000, 1000, 2000)).toBe(0.5);
    expect(descentDepth(3000, 1000, 2000)).toBe(1);
    expect(descentDepth(1000, 1000, 2000)).toBe(0);
  });
  it('music gets louder with depth and silent on return', () => {
    expect(descentVolume(1)).toBeGreaterThan(descentVolume(0.5));
    expect(descentVolume(0.5)).toBeGreaterThan(descentVolume(0));
    expect(descentVolume(0)).toBe(0);
    expect(descentVolume(1, true)).toBe(0);
  });
});