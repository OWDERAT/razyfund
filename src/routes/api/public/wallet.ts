import { createFileRoute } from '@tanstack/react-router';
import { applyAction, cleanName, openWallet, PLAN_TOKENS, sealWallet, type Wallet } from '@/lib/wallet';

const COOKIE = 'razy_wallet';
const readCookie = (req: Request) =>
  (req.headers.get('cookie') ?? '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);

async function db() {
  return (await import('@/integrations/supabase/client.server')).supabaseAdmin;
}

async function shared() {
  const admin = await db();
  const [votes, board] = await Promise.all([
    admin.from('scoobert_votes').select('total').eq('id', 1).maybeSingle(),
    admin.from('token_leaderboard').select('player_id,name,tokens').order('tokens', { ascending: false }).limit(5),
  ]);
  return { globalVotes: Number(votes.data?.total ?? 0), board: board.data ?? [] };
}

async function respond(w: Wallet, ok: boolean, secret: string) {
  const sealed = await sealWallet(w, secret);
  const { globalVotes, board } = await shared();
  const leaderboard = board.map((r) => ({ name: r.name, tokens: Number(r.tokens), you: r.player_id === w.id }));
  return new Response(JSON.stringify({ ok, balance: w.balance, votes: w.votes, globalVotes, leaderboard }), {
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
        const secret = process.env['WALLET_SECRET']!;
        return respond(await openWallet(readCookie(request), secret), true, secret);
      },
      POST: async ({ request }) => {
        const secret = process.env['WALLET_SECRET']!;
        // Only same-origin pages may change the wallet.
        const origin = request.headers.get('origin');
        if (origin && origin !== new URL(request.url).origin) return new Response('forbidden', { status: 403 });
        const body = (await request.json().catch(() => ({}))) as { action?: unknown; plan?: unknown; name?: unknown };
        const current = await openWallet(readCookie(request), secret);
        const { wallet, ok } = applyAction(current, body.action, body.plan, Date.now());
        if (ok) {
          const admin = await db();
          if (body.action === 'vote') await admin.rpc('add_scoobert_vote');
          if (body.action === 'buy')
            await admin.rpc('add_leaderboard_tokens', {
              p_player: wallet.id,
              p_name: cleanName(body.name),
              p_tokens: PLAN_TOKENS[body.plan as string] ?? 0,
            });
        }
        return respond(wallet, ok, secret);
      },
    },
  },
});
