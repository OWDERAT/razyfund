import { describe, expect, it } from 'vitest';
import { timewarpPhase } from '../../public/timewarp-sequence.js';

describe('deeper Scoobert sequence', () => {
  it('waits ten seconds before everything gets quieter', () => {
    expect(timewarpPhase(9.999, true)).toBe('waiting');
    expect(timewarpPhase(10, true)).toBe('quiet');
  });
  it('leaves a quiet beat before the jumpscare', () => {
    expect(timewarpPhase(11.19, true)).toBe('quiet');
    expect(timewarpPhase(11.2, true)).toBe('scare');
  });
  it('plays the video only after the scream ends', () => {
    expect(timewarpPhase(14, true, false)).toBe('scare');
    expect(timewarpPhase(14, true, true)).toBe('video');
    expect(timewarpPhase(20, true, true, true)).toBe('aftermath');
  });
  it('cancels every stage when scrolling out', () => {
    for (const elapsed of [5, 10, 12, 20]) expect(timewarpPhase(elapsed, false)).toBe('idle');
  });
  it('stays black after the static ends even when scrolling out', () => {
    expect(timewarpPhase(20, true, true, true)).toBe('aftermath');
    expect(timewarpPhase(0, false, false, false, true)).toBe('aftermath');
    expect(timewarpPhase(0, false, false, false, false)).toBe('idle');
  });
});