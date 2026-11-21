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
  const [votes, board, events] = await Promise.all([
    client.from('scoobert_votes').select('total').eq('id', 1).single(),
    client.from('token_leaderboard').select('name,tokens').order('tokens', { ascending: false }).limit(5),
    client.from('site_events').select('*').eq('active', true).lte('starts_at', new Date().toISOString()).gt('ends_at', new Date().toISOString()),
  ]);
  if (votes.error || board.error || events.error) throw new Error('Shared state unavailable');
  return { globalVotes: votes.data.total, leaderboard: board.data, events: events.data };
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
  const expected = process.env['ADMIN_PASSWORD'];
  if (!expected) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(process.env['WALLET_SECRET'] ?? ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(expected));
  return crypto.subtle.verify('HMAC', key, signature, enc.encode(input));
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
