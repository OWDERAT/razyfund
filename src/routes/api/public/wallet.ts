import { createFileRoute } from '@tanstack/react-router';
import { applyAction, openWallet, sealWallet, type Wallet } from '@/lib/wallet';

const COOKIE = 'razy_wallet';
const readCookie = (req: Request) =>
  (req.headers.get('cookie') ?? '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);

async function respond(w: Wallet, ok: boolean, secret: string) {
  const sealed = await sealWallet(w, secret);
  return new Response(JSON.stringify({ ok, balance: w.balance, votes: w.votes }), {
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
        const secret = process.env.WALLET_SECRET!;
        return respond(await openWallet(readCookie(request), secret), true, secret);
      },
      POST: async ({ request }) => {
        const secret = process.env.WALLET_SECRET!;
        // Only same-origin pages may change the wallet.
        const origin = request.headers.get('origin');
        if (origin && origin !== new URL(request.url).origin) return new Response('forbidden', { status: 403 });
        const body = (await request.json().catch(() => ({}))) as { action?: unknown; plan?: unknown };
        const current = await openWallet(readCookie(request), secret);
        const { wallet, ok } = applyAction(current, body.action, body.plan, Date.now());
        return respond(wallet, ok, secret);
      },
    },
  },
});
