import { createFileRoute } from '@tanstack/react-router';

const COOKIE = 'razy_admin';
const enc = new TextEncoder();
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (value: string) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const readCookie = (request: Request) => (request.headers.get('cookie') ?? '').split(/;\s*/).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
const originOkay = (request: Request) => request.headers.get('origin') === new URL(request.url).origin;

async function adminDb() {
  return (await import('@/integrations/supabase/client.server')).supabaseAdmin as any;
}

async function sessionKey() {
  const secret = process.env['ADMIN_SESSION_SECRET'];
  if (!secret || secret.length < 32) throw new Error('ADMIN_SESSION_SECRET must be at least 32 characters');
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function createSession() {
  const body = b64(enc.encode(String(Date.now())));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await sessionKey(), enc.encode(body)));
  return `${body}.${b64(signature)}`;
}

async function validSession(request: Request) {
  try {
    const [body, signature] = (readCookie(request) ?? '').split('.');
    if (!body || !signature) return false;
    const valid = await crypto.subtle.verify('HMAC', await sessionKey(), unb64(signature), enc.encode(body));
    if (!valid) return false;
    const issued = Number(new TextDecoder().decode(unb64(body)));
    return Number.isFinite(issued) && issued <= Date.now() && Date.now() - issued < 4 * 60 * 60 * 1000;
  } catch { return false; }
}

async function verifyPassword(password: string) {
  const encoded = process.env['ADMIN_PASSWORD_HASH'];
  if (!encoded) return false;
  const [saltText, hashText] = encoded.split('.');
  if (!saltText || !hashText) return false;
  try {
    const material = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unb64(saltText), iterations: 310000, hash: 'SHA-256' }, material, 256));
    const expected = unb64(hashText);
    if (bits.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < bits.length; i++) diff |= bits[i]! ^ expected[i]!;
    return diff === 0;
  } catch { return false; }
}

function json(data: unknown, status = 200, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('content-type', 'application/json');
  responseHeaders.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}

export const Route = createFileRoute('/api/admin')({
  server: { handlers: {
    GET: async ({ request }) => {
      if (!(await validSession(request))) return json({ error: 'unauthorized' }, 401);
      const db = await adminDb();
      const [{ data: users, error }, { data: events }, { data: recent }] = await Promise.all([
        db.from('wallet_accounts').select('player_id,balance,votes,updated_at,user_profiles(username)').order('balance', { ascending: false }).limit(200),
        db.from('site_events').select('*').order('created_at', { ascending: false }).limit(30),
        db.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(30),
      ]);
      if (error) return json({ error: 'database_error' }, 500);
      return json({ users: users ?? [], events: events ?? [], audit: recent ?? [] });
    },
    POST: async ({ request }) => {
      if (!originOkay(request)) return json({ error: 'forbidden' }, 403);
      const body = await request.json().catch(() => null) as Record<string, unknown> | null;
      if (!body || typeof body.action !== 'string') return json({ error: 'invalid_request' }, 400);

      if (body.action === 'logout') {
        return json({ ok: true }, 200, { 'set-cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
      }

      if (body.action === 'login') {
        const db = await adminDb();
        const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
        const ipSignature = new Uint8Array(await crypto.subtle.sign('HMAC', await sessionKey(), enc.encode(ip)));
        const ipHash = b64(ipSignature);
        const { data: blocked, error: rateError } = await db.rpc('admin_login_is_blocked', { p_ip_hash: ipHash });
        if (rateError) return json({ error: 'admin_auth_unavailable' }, 503);
        if (blocked === true) return json({ error: 'too_many_attempts' }, 429);
        const password = typeof body.password === 'string' ? body.password : '';
        if (password.length < 1 || password.length > 256 || !(await verifyPassword(password))) {
          await db.rpc('admin_login_failed', { p_ip_hash: ipHash });
          return json({ error: 'invalid_credentials' }, 401);
        }
        await db.rpc('admin_login_succeeded', { p_ip_hash: ipHash });
        const session = await createSession();
        return json({ ok: true }, 200, { 'set-cookie': `${COOKIE}=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=14400` });
      }

      if (!(await validSession(request))) return json({ error: 'unauthorized' }, 401);
      const db = await adminDb();
      let audit: Record<string, unknown> = { action: body.action };

      if (body.action === 'adjust_tokens') {
        const player = typeof body.player_id === 'string' ? body.player_id : '';
        const amount = Number(body.amount);
        const mode = body.mode;
        if (!/^[0-9a-f-]{36}$/i.test(player) || !Number.isSafeInteger(amount) || amount < 0 || amount > 10000000 || !['add','remove','set'].includes(String(mode))) return json({ error: 'invalid_values' }, 400);
        const { data: next, error } = await db.rpc('admin_adjust_wallet_balance', { p_player: player, p_mode: mode, p_amount: amount });
        if (error) return json({ error: error.message?.includes('wallet not found') ? 'user_not_found' : 'balance_update_failed' }, error.message?.includes('wallet not found') ? 404 : 400);
        const { data: profile } = await db.from('user_profiles').select('username').eq('player_id', player).maybeSingle();
        const { error: boardError } = await db.from('token_leaderboard').upsert({ player_id: player, name: profile?.username ?? 'Anonymous', tokens: Number(next), updated_at: new Date().toISOString() }, { onConflict: 'player_id' });
        if (boardError) return json({ error: 'leaderboard_update_failed' }, 500);
        audit = { action: 'adjust_tokens', target_player: player, details: { mode, amount, new_balance: Number(next) } };
      } else if (body.action === 'rename_user') {
        const player = typeof body.player_id === 'string' ? body.player_id : '';
        const username = typeof body.username === 'string' ? body.username.replace(/[^\p{L}\p{N}_.-]/gu, '').slice(0,20) : '';
        if (!/^[0-9a-f-]{36}$/i.test(player) || username.length < 3) return json({ error: 'invalid_values' }, 400);
        const { error } = await db.from('user_profiles').upsert({ player_id: player, username, updated_at: new Date().toISOString() }, { onConflict: 'player_id' });
        if (error) return json({ error: error.code === '23505' ? 'username_taken' : 'database_error' }, error.code === '23505' ? 409 : 500);
        await db.from('token_leaderboard').update({ name: username }).eq('player_id', player);
        audit = { action: 'rename_user', target_player: player, details: { username } };
      } else if (body.action === 'create_event') {
        const type = body.event_type;
        const title = typeof body.title === 'string' ? body.title.slice(0,100) : '';
        const imageUrl = typeof body.image_url === 'string' ? body.image_url : null;
        const soundUrl = typeof body.sound_url === 'string' ? body.sound_url : null;
        const allowed = ['rain','announcement','banner','maintenance'];
        const validUrl = (value: string | null) => !value || (value.length <= 2048 && /^https:\/\//i.test(value));
        if (!allowed.includes(String(type)) || !validUrl(imageUrl) || !validUrl(soundUrl) || (type === 'rain' && !imageUrl)) return json({ error: 'invalid_event' }, 400);
        const duration = Number(body.duration_minutes ?? 10);
        const count = Number(body.count ?? 14);
        if (!Number.isInteger(duration) || duration < 1 || duration > 1440 || !Number.isInteger(count) || count < 1 || count > 35) return json({ error: 'invalid_event_settings' }, 400);
        const { data, error } = await db.from('site_events').insert({ event_type: type, title, image_url: imageUrl, sound_url: soundUrl, payload: { ...(body.payload && typeof body.payload === 'object' ? body.payload as Record<string, unknown> : {}), count }, starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + duration * 60000).toISOString(), active: true }).select('id').single();
        if (error) return json({ error: 'database_error' }, 500);
        audit = { action: 'create_event', details: { event_id: data.id, event_type: type } };
      } else if (body.action === 'stop_event') {
        const id = typeof body.event_id === 'string' ? body.event_id : '';
        if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'invalid_event_id' }, 400);
        const { error } = await db.from('site_events').update({ active: false, ends_at: new Date().toISOString() }).eq('id', id);
        if (error) return json({ error: 'database_error' }, 500);
        audit = { action: 'stop_event', details: { event_id: id } };
      } else {
        return json({ error: 'unknown_action' }, 400);
      }

      const { error: auditError } = await db.from('admin_audit_log').insert(audit);
      if (auditError) return json({ error: 'audit_log_failed' }, 500);
      return json({ ok: true });
    },
  } },
});
