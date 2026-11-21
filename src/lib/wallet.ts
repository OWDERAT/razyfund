// Server-only wallet: state lives in an HMAC-signed, httpOnly cookie so the browser can't edit it.
export const PLAN_TOKENS: Record<string, number> = { Starter: 500, Professional: 2500, Enterprise: 10000 };
export const BUY_COOLDOWN_MS = 5000;
export const VOTE_COOLDOWN_MS = 1000;
export const MAX_BALANCE = 10_000_000;
export const MAX_VOTES = 1;

export type Wallet = { id: string; balance: number; votes: number; lastBuy: number; lastVote: number };
export const emptyWallet = (): Wallet => ({ id: crypto.randomUUID(), balance: 0, votes: 0, lastBuy: 0, lastVote: 0 });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Leaderboard names: printable, trimmed, max 20 chars.
export const cleanName = (x: unknown) => (typeof x === 'string' ? x.replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 20) : '') || 'Anonymous';

export function applyAction(w: Wallet, action: unknown, plan: unknown, now: number): { wallet: Wallet; ok: boolean } {
  if (action === 'buy') {
    // No payment provider is connected: browser claims cannot authorize credits.
    void plan;
    return { wallet: w, ok: false };
  }
  if (action === 'vote') {
    if (now - w.lastVote < VOTE_COOLDOWN_MS || w.votes >= MAX_VOTES) return { wallet: w, ok: false };
    return { wallet: { ...w, votes: w.votes + 1, lastVote: now }, ok: true };
  }
  return { wallet: w, ok: false };
}

const enc = new TextEncoder();
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const key = (secret: string) => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export async function sealWallet(w: Wallet, secret: string): Promise<string> {
  const body = b64(enc.encode(JSON.stringify(w)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), enc.encode(body)));
  return `${body}.${b64(sig)}`;
}

export async function openWallet(token: string | undefined, secret: string): Promise<Wallet> {
  try {
    const [body, sig] = (token ?? '').split('.');
    if (!body || !sig) return emptyWallet();
    const valid = await crypto.subtle.verify('HMAC', await key(secret), unb64(sig), enc.encode(body));
    if (!valid) return emptyWallet();
    const v = JSON.parse(new TextDecoder().decode(unb64(body)));
    const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);
    return { id: typeof v.id === 'string' && UUID.test(v.id) ? v.id : crypto.randomUUID(), balance: Math.min(MAX_BALANCE, n(v.balance)), votes: Math.min(MAX_VOTES, n(v.votes)), lastBuy: n(v.lastBuy), lastVote: n(v.lastVote) };
  } catch {
    return emptyWallet();
  }
}
