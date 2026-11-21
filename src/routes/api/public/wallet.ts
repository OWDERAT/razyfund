import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const actionSchema = z.object({ action: z.enum(['vote', 'buy']), plan: z.string().max(40).optional(), name: z.string().max(40).optional() }).strict();

export const Route = createFileRoute('/api/public/wallet')({ server: { handlers: {
  GET: async ({ request }) => {
    const store = await import('@/lib/secure-store.server');
    try {
      const [user, shared] = await Promise.all([store.verifiedUser(request), store.sharedState()]);
      if (!user) return store.response({ ok: true, signedIn: false, balance: 0, votes: 0, ...shared });
      // A signed legacy cookie can be transferred only once to a verified account.
      const token = (request.headers.get('cookie') ?? '').split(/;\s*/).find(c => c.startsWith('razy_wallet='))?.slice(12);
      if (token) {
        const { openWallet } = await import('@/lib/wallet');
        const secret = process.env['WALLET_SECRET'];
        if (secret) {
          const old = await openWallet(token, secret);
          if (old.balance > 0 || old.votes > 0) {
            const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
            const result = await supabaseAdmin.rpc('attach_legacy_wallet', { p_user: user.id, p_legacy: old.id, p_balance: old.balance, p_voted: old.votes > 0 });
            if (result.error) throw new Error('Transfer failed');
          }
        }
      }
      const [wallet, profile] = await Promise.all([
        user.client.from('wallet_accounts').select('balance,votes').eq('player_id', user.id).single(),
        user.client.from('profiles').select('username').eq('id', user.id).single(),
      ]);
      if (wallet.error || profile.error) throw new Error('Account unavailable');
      return store.response({ ok: true, signedIn: true, ...wallet.data, username: profile.data.username, ...shared, leaderboard: shared.leaderboard.map(row => ({ ...row, you: row.name === profile.data.username })) });
    } catch { return store.response({ ok: false, error: 'Could not load account data. Please try again.' }, 503); }
  },
  POST: async ({ request }) => {
    const store = await import('@/lib/secure-store.server');
    if (!store.sameOrigin(request)) return store.response({ ok: false, error: 'forbidden' }, 403);
    const body = actionSchema.safeParse(await store.boundedBody(request));
    if (!body.success) return store.response({ ok: false, error: 'invalid_request' }, 400);
    if (body.data.action === 'buy') return store.response({ ok: false, error: 'payment_required', message: 'No payment was processed. Tokens require verified payment or an administrator grant.' }, 403);
    try {
      const user = await store.verifiedUser(request);
      if (!user) return store.response({ ok: false, error: 'sign_in_required' }, 401);
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const result = await supabaseAdmin.rpc('claim_scoobert_vote', { p_player: user.id });
      if (result.error) throw new Error('Vote failed');
      return store.response({ ok: result.data, error: result.data ? null : 'already_voted' });
    } catch { return store.response({ ok: false, error: 'Vote could not be saved. Try again.' }, 503); }
  },
} } });
