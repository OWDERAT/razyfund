import { createFileRoute } from '@tanstack/react-router';
import { visitorActionSchema, visitorAccess } from '@/lib/visitor-rules';

export const Route = createFileRoute('/api/public/wallet')({ server: { handlers: {
  GET: async ({ request }) => {
    const store = await import('@/lib/secure-store.server');
    const { visitor } = await import('@/lib/visitor-store.server');
    try {
      const session = await visitor(request);
      if (!visitorAccess(session.player.banned)) return store.response({ ok: false, error: 'banned' }, 403, session.cookie);
      const [shared, wallet] = await Promise.all([
        store.sharedState(),
        session.db.from('wallet_accounts').select('balance,votes').eq('player_id', session.player.id).single(),
      ]);
      if (wallet.error) throw new Error('Wallet unavailable');
      return store.response({ ok: true, name: session.player.name, ...wallet.data, globalVotes: shared.globalVotes, events: shared.events, leaderboard: store.publicBoard(shared.leaderboard, session.player.id) }, 200, session.cookie);
    } catch { return store.response({ ok: false, error: 'service_unavailable', message: 'Could not load your tokens. Please try again.' }, 503); }
  },
  POST: async ({ request }) => {
    const store = await import('@/lib/secure-store.server');
    if (!store.sameOrigin(request)) return store.response({ ok: false, error: 'forbidden' }, 403);
    const parsed = visitorActionSchema.safeParse(await store.boundedBody(request));
    if (!parsed.success) return store.response({ ok: false, error: 'invalid_request', message: 'Use a name of 1–20 letters, numbers, spaces, dots, dashes or underscores.' }, 400);
    const { visitor } = await import('@/lib/visitor-store.server');
    try {
      const session = await visitor(request);
      if (!visitorAccess(session.player.banned)) return store.response({ ok: false, error: 'banned' }, 403, session.cookie);
      const action = parsed.data;
      const result = await session.db.rpc('visitor_wallet_action', { p_player: session.player.id, p_action: action.action, ...(action.action === 'buy' ? { p_plan: action.plan, p_name: action.name, p_order: action.order_id } : {}) });
      if (result.error) throw new Error('Action failed');
      const data = result.data as { ok: boolean; error?: string; tokens?: number; replayed?: boolean };
      const message = data.error === 'name_taken' ? 'That name is already in use. Choose another cardholder name.' : data.error === 'banned' ? 'This player has been banned.' : 'Could not complete the order. Please try again.';
      return store.response({ ...data, ...(data.ok ? {} : { message }) }, data.ok ? 200 : data.error === 'banned' ? 403 : 409, session.cookie);
    } catch { return store.response({ ok: false, error: 'service_unavailable', message: 'Could not save your tokens. Please try again.' }, 503); }
  },
} } });
