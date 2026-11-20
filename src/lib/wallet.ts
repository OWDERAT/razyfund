// Wallet identity is carried by an HMAC-signed, HttpOnly cookie. Balances and
// reward counters are stored server-side in Supabase, never trusted from a cookie.
export const BUY_COOLDOWN_MS = 5000;
export const VOTE_COOLDOWN_MS = 1000;
export const MAX_BALANCE = 10_000_000;
export const MAX_VOTES = 999;

export type Wallet = { id: string; balance: number; votes: number; lastBuy: number; lastVote: number };
export const emptyWallet = (): Wallet => ({ id: crypto.randomUUID(), balance: 0, votes: 0, lastBuy: 0, lastVote: 0 });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function cleanName(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(/[^\p{L}\p{N}_.-]/gu, '').trim().slice(0, 20)
    : '';
}

const enc = new TextEncoder();
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const key = (secret: string) => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export async function sealWallet(w: Wallet, secret: string): Promise<string> {
  const body = b64(enc.encode(JSON.stringify({ id: w.id })));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), enc.encode(body)));
  return `${body}.${b64(sig)}`;
}

export async function openWallet(token: string | undefined, secret: string): Promise<Wallet> {
  try {
    const [body, sig] = (token ?? '').split('.');
    if (!body || !sig) return emptyWallet();
    const valid = await crypto.subtle.verify('HMAC', await key(secret), unb64(sig), enc.encode(body));
    if (!valid) return emptyWallet();
    const value = JSON.parse(new TextDecoder().decode(unb64(body)));
    return typeof value.id === 'string' && UUID.test(value.id)
      ? { id: value.id, balance: typeof value.balance === 'number' && Number.isFinite(value.balance) ? Math.max(0, Math.min(MAX_BALANCE, value.balance)) : 0, votes: typeof value.votes === 'number' && Number.isFinite(value.votes) ? Math.max(0, Math.min(MAX_VOTES, value.votes)) : 0, lastBuy: 0, lastVote: 0 }
      : emptyWallet();
  } catch {
    return emptyWallet();
  }
}
