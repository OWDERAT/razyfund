import { createFileRoute } from '@tanstack/react-router';
import { adminActionSchema } from '@/lib/access-rules';

export const Route = createFileRoute('/api/public/admin')({ server: { handlers: {
 GET: async ({ request }) => {
  const store = await import('@/lib/secure-store.server');
  try {
   if (!(await store.verifiedAdmin(request))) return store.response({ error: 'unauthorized' }, 401);
   const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
   const [wallets, profiles, events, audit] = await Promise.all([
    db.from('wallet_accounts').select('*').order('updated_at', { ascending: false }).limit(200),
    db.from('profiles').select('id,username').limit(200),
    db.from('site_events').select('*').order('created_at', { ascending: false }).limit(30),
    db.from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(30),
   ]);
   if (wallets.error || profiles.error || events.error || audit.error) throw new Error('Load failed');
   const names = new Map(profiles.data.map(p => [p.id, p.username]));
   return store.response({ users: wallets.data.map(w => ({ ...w, user_profiles: { username: names.get(w.player_id) ?? 'Unknown' } })), events: events.data, audit: audit.data });
  } catch { return store.response({ error: 'Service unavailable' }, 503); }
 },
 POST: async ({ request }) => {
  const store = await import('@/lib/secure-store.server');
  if (!store.sameOrigin(request)) return store.response({ error: 'forbidden' }, 403);
  const parsed = adminActionSchema.safeParse(await store.boundedBody(request));
  if (!parsed.success) return store.response({ error: 'invalid_request' }, 400);
  const body = parsed.data;
  try {
   if (body.action === 'login') {
    if (!process.env['ADMIN_PASSWORD'] && !process.env['ADMIN_PASSWORD_HASH']) return store.response({ error: 'Admin login is not configured on the server.' }, 503);
    const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
    // Only the edge-supplied client IP is trusted. Never use a client-controlled forwarded header.
    const ip = request.headers.get('cf-connecting-ip') ?? 'local-or-unknown';
    const ipHash = await store.digest((process.env['WALLET_SECRET'] ?? '') + ip);
    const reservation = await db.rpc('reserve_admin_login', { p_ip_hash: ipHash });
    if (reservation.error) throw new Error('Login unavailable');
    if (!reservation.data) return store.response({ error: 'Too many attempts. Try again in 15 minutes.' }, 429);
    if (!(await store.passwordMatches(body.password))) return store.response({ error: 'Invalid credentials.' }, 401);
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
    const saved = await db.from('admin_sessions').insert({ token_hash: await store.digest(token), expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() });
    if (saved.error) throw new Error('Login unavailable');
    return store.response({ ok: true }, 200, `${store.ADMIN_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=14400`);
   }
   if (!(await store.verifiedAdmin(request))) return store.response({ error: 'unauthorized' }, 401);
   const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
   if (body.action === 'logout') {
    const token = store.adminToken(request);
    if (token) { const result = await db.from('admin_sessions').delete().eq('token_hash', await store.digest(token)); if (result.error) throw new Error('Logout failed'); }
    return store.response({ ok: true }, 200, `${store.ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
   }
   if (body.action === 'adjust_tokens') {
    const result = await db.rpc('admin_adjust_wallet_balance', { p_player: body.player_id, p_mode: body.mode, p_amount: body.amount });
    if (result.error) return store.response({ error: 'Could not update balance. Check the user ID.' }, 400);
   } else if (body.action === 'rename_user') {
    const result = await db.from('profiles').update({ username: body.username }).eq('id', body.player_id).select('id').single();
    if (result.error) return store.response({ error: 'Username unavailable or user not found.' }, 409);
    const audit = await db.from('admin_audit_log').insert({ action: 'rename_user', target_player: body.player_id, details: { username: body.username } });
    if (audit.error) throw new Error('Audit failed');
   } else if (body.action === 'create_event') {
    if (body.event_type === 'rain' && !body.image_url) return store.response({ error: 'Image rain requires an HTTPS image URL.' }, 400);
    const result = await db.from('site_events').insert({ event_type: body.event_type, title: body.title, image_url: body.image_url, sound_url: body.sound_url, payload: { count: body.count }, ends_at: new Date(Date.now() + body.duration_minutes * 60000).toISOString() }).select('id').single();
    if (result.error) throw new Error('Event failed');
    const audit = await db.from('admin_audit_log').insert({ action: 'create_event', details: { event_id: result.data.id, event_type: body.event_type } });
    if (audit.error) throw new Error('Audit failed');
   } else if (body.action === 'stop_event') {
    const result = await db.from('site_events').update({ active: false }).eq('id', body.event_id).select('id').single();
    if (result.error) return store.response({ error: 'Event not found.' }, 404);
    const audit = await db.from('admin_audit_log').insert({ action: 'stop_event', details: { event_id: body.event_id } });
    if (audit.error) throw new Error('Audit failed');
   }
   return store.response({ ok: true });
  } catch { return store.response({ error: 'Service unavailable. Please try again.' }, 503); }
 },
} } });
