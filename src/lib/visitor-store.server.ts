import { digest } from './secure-store.server';

const COOKIE = 'razy_player';
export async function visitor(request: Request) {
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const token = (request.headers.get('cookie') ?? '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const existing = await db.from('visitor_players').select('id,name,banned').eq('token_hash', await digest(token)).maybeSingle();
    if (existing.error) throw new Error('Player unavailable');
    if (existing.data) return { db, player: existing.data, cookie: undefined };
  }
  const fresh = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
  const inserted = await db.from('visitor_players').insert({ token_hash: await digest(fresh) }).select('id,name,banned').single();
  if (inserted.error) throw new Error('Player unavailable');
  const wallet = await db.from('wallet_accounts').upsert({ player_id: inserted.data.id }, { onConflict: 'player_id', ignoreDuplicates: true });
  if (wallet.error) throw new Error('Wallet unavailable');
  return { db, player: inserted.data, cookie: `${COOKIE}=${fresh}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000` };
}