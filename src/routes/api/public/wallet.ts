import { createFileRoute } from '@tanstack/react-router';
import { cleanName, openWallet, sealWallet, type Wallet } from '@/lib/wallet';

const COOKIE = 'razy_wallet';
const readCookie = (req: Request) =>
  (req.headers.get('cookie') ?? '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);

async function db() {
  return (await import('@/integrations/supabase/client.server')).supabaseAdmin;
}

function safeEqualOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return !!origin && origin === new URL(request.url).origin;
}

async function loadWallet(id: string, legacy?: Wallet): Promise<Wallet> {
  const admin = await db() as any;
  const { data, error } = await admin.from('wallet_accounts').upsert({ player_id: id, balance: legacy?.balance ?? 0, votes: legacy?.votes ?? 0 }, { onConflict: 'player_id', ignoreDuplicates: true });
  if (error) throw error;
  const { data: row, error: readError } = await admin.from('wallet_accounts').select('balance,votes').eq('player_id', id).single();
  if (readError) throw readError;
  return { id, balance: Number(row.balance), votes: Number(row.votes), lastBuy: 0, lastVote: 0 };
}

async function respond(wallet: Wallet, ok: boolean, secret: string, status = 200) {
  const admin = await db() as any;
  const [{ data: votes }, { data: board }, { data: profile }, { data: activeEvents }] = await Promise.all([
    admin.from('scoobert_votes').select('total').eq('id', 1).maybeSingle(),
    admin.from('token_leaderboard').select('player_id,name,tokens').order('tokens', { ascending: false }).limit(10),
    admin.from('user_profiles').select('username').eq('player_id', wallet.id).maybeSingle(),
    admin.from('site_events').select('id,event_type,title,image_url,sound_url,payload,starts_at,ends_at').eq('active', true).or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`).limit(10),
  ]);
  const leaderboard = (board ?? []).map((r) => ({ name: r.name, tokens: Number(r.tokens), you: r.player_id === wallet.id }));
  const sealed = await sealWallet(wallet, secret);
  return new Response(JSON.stringify({ ok, balance: wallet.balance, votes: wallet.votes, username: profile?.username ?? null, events: activeEvents ?? [], globalVotes: Number(votes?.total ?? 0), leaderboard }), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'set-cookie': `${COOKIE}=${sealed}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`,
    },
  });
}

export const Route = createFileRoute('/api/public/wallet')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env['WALLET_SECRET'];
        if (!secret || secret.length < 32) return new Response('wallet service not configured', { status: 503 });
        const legacy = await openWallet(readCookie(request), secret);
        const wallet = await loadWallet(legacy.id, legacy);
        return respond(wallet, true, secret);
      },
      POST: async ({ request }) => {
        const secret = process.env['WALLET_SECRET'];
        if (!secret || secret.length < 32) return new Response('wallet service not configured', { status: 503 });
        if (!safeEqualOrigin(request)) return new Response('forbidden', { status: 403 });
        const body = await request.json().catch(() => null) as { action?: unknown; name?: unknown } | null;
        if (!body || typeof body !== 'object') return new Response('invalid request', { status: 400 });
        const current = await openWallet(readCookie(request), secret);
        let wallet = await loadWallet(current.id, current);
        const admin = await db() as any;

        if (body.action === 'buy') {
          // There is no payment-provider integration in this project. Never award tokens
          // based on a browser request or simulated card form.
          return respond(wallet, false, secret, 409);
        }

        if (body.action === 'vote') {
          const { data, error } = await admin.rpc('claim_scoobert_vote', { p_player: wallet.id });
          if (error) throw error;
          wallet = await loadWallet(wallet.id);
          return respond(wallet, data === true, secret, data === true ? 200 : 429);
        }

        if (body.action === 'set_name') {
          const username = cleanName(body.name);
          if (username.length < 3) return respond(wallet, false, secret, 400);
          const { error: profileError } = await admin.from('user_profiles').upsert(
            { player_id: wallet.id, username, updated_at: new Date().toISOString() },
            { onConflict: 'player_id' },
          );
          if (profileError) return respond(wallet, false, secret, profileError.code === '23505' ? 409 : 400);
          const { error: boardError } = await admin.from('token_leaderboard').upsert(
            { player_id: wallet.id, name: username, tokens: wallet.balance, updated_at: new Date().toISOString() },
            { onConflict: 'player_id' },
          );
          if (boardError) throw boardError;
          return respond(wallet, true, secret);
        }

        return respond(wallet, false, secret, 400);
      },
    },
  },
});
