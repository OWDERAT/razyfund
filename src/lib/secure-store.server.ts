import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

export function publicDb(token?: string) {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error('Account service unavailable');
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
      headers.set('apikey', key);
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return fetch(input, { ...init, headers });
    } },
  });
}
export async function verifiedUser(request: Request) {
  const match = request.headers.get('authorization')?.match(/^Bearer (.+)$/);
  const token = match?.[1];
  if (!token) return null;
  const client = publicDb(token);
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : { id: data.user.id, client };
}
export async function sharedState() {
  const client = publicDb();
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const now = new Date().toISOString();
  const [votes, wallets, events] = await Promise.all([
    client.from('scoobert_votes').select('total').eq('id', 1).single(),
    // Leaderboard = real wallet balances (the old token_leaderboard table is never written by accounts).
    supabaseAdmin.from('wallet_accounts').select('player_id,balance').gt('balance', 0).order('balance', { ascending: false }).limit(5),
    client.from('site_events').select('*').eq('active', true).lte('starts_at', now).gt('ends_at', now),
  ]);
  if (votes.error || wallets.error || events.error) throw new Error('Shared state unavailable');
  const ids = wallets.data.map((w) => w.player_id);
  const profiles = ids.length ? await supabaseAdmin.from('profiles').select('id,username').in('id', ids) : { data: [], error: null };
  if (profiles.error) throw new Error('Shared state unavailable');
  const names = new Map(profiles.data.map((p) => [p.id, p.username]));
  const leaderboard = wallets.data.map((w) => ({ id: w.player_id, name: names.get(w.player_id) ?? 'Anonymous', tokens: Number(w.balance) }));
  return { globalVotes: votes.data.total, leaderboard, events: events.data };
}
/** Strips internal player ids before sending the board to browsers; marks the viewer's own row. */
export function publicBoard(board: { id: string; name: string; tokens: number }[], viewerId?: string) {
  return board.map((row) => ({ name: row.name, tokens: row.tokens, you: viewerId !== undefined && row.id === viewerId }));
}
export function response(data: unknown, status = 200, cookie?: string) {
  const headers = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store' });
  if (cookie) headers.set('set-cookie', cookie);
  return new Response(JSON.stringify(data), { status, headers });
}
export function sameOrigin(request: Request) { return request.headers.get('origin') === new URL(request.url).origin; }
export async function boundedBody(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > 8192) { await reader.cancel(); return null; } chunks.push(value); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; } catch { return null; }
}
export async function digest(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
export async function passwordMatches(input: string) {
  const { hashAdminPassword, verifyAdminPassword } = await import('@/lib/admin-password');
  const password = process.env['ADMIN_PASSWORD'];
  // The newly saved encrypted secret takes precedence over any previous hash.
  if (password) return verifyAdminPassword(input, await hashAdminPassword(password));
  return verifyAdminPassword(input, process.env['ADMIN_PASSWORD_HASH']);
}
export const ADMIN_COOKIE = 'razy_admin';
export function adminToken(request: Request) {
  return (request.headers.get('cookie') ?? '').split(/;\s*/).find(c => c.startsWith(ADMIN_COOKIE + '='))?.slice(ADMIN_COOKIE.length + 1);
}
export async function verifiedAdmin(request: Request) {
  const token = adminToken(request);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.from('admin_sessions').select('expires_at').eq('token_hash', await digest(token)).gt('expires_at', new Date().toISOString()).maybeSingle();
  return !error && !!data;
}
