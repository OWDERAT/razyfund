export const WAIT_SECONDS: number;
export const QUIET_SECONDS: number;
export function timewarpPhase(elapsed: number, active: boolean, screamEnded?: boolean, videoEnded?: boolean): 'idle' | 'waiting' | 'quiet' | 'scare' | 'video' | 'aftermath';