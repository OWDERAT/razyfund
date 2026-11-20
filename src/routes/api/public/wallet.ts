import { createFileRoute } from '@tanstack/react-router';
import { cleanName, openWallet, sealWallet } from '@/lib/wallet';
import { getUser, getGlobalVotes, leaderboard, listEvents, vote, usernameTaken } from '@/lib/standalone-store';

const COOKIE = 'razy_wallet';
const readCookie = (req: Request) => (req.headers.get('cookie') ?? '').split(/;\s*/).find(c => c.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
const secret = () => process.env['WALLET_SECRET'] || process.env['ADMIN_SESSION_SECRET'] || '';
const sameOrigin = (req: Request) => req.headers.get('origin') === new URL(req.url).origin;

async function response(user: ReturnType<typeof getUser>, ok: boolean, status = 200) {
  const key = secret();
  if (key.length < 32) return Response.json({ error: 'wallet_secret_not_configured' }, { status: 503 });
  const token = await sealWallet({ id:user.player_id, balance:user.balance, votes:user.votes, lastBuy:0, lastVote:user.lastVote }, key);
  return Response.json({ ok, balance:user.balance, votes:user.votes, username:user.username, globalVotes:getGlobalVotes(), leaderboard:leaderboard(user.player_id), events:listEvents() }, {
    status, headers:{ 'cache-control':'no-store', 'set-cookie':`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000` }
  });
}

export const Route = createFileRoute('/api/public/wallet')({ server:{ handlers:{
  GET: async ({request}) => {
    if (secret().length < 32) return Response.json({error:'wallet_secret_not_configured'},{status:503});
    const wallet = await openWallet(readCookie(request), secret());
    return response(getUser(wallet.id, wallet), true);
  },
  POST: async ({request}) => {
    if (!sameOrigin(request)) return Response.json({error:'forbidden'},{status:403});
    if (secret().length < 32) return Response.json({error:'wallet_secret_not_configured'},{status:503});
    const body = await request.json().catch(()=>null) as {action?:unknown;name?:unknown}|null;
    if (!body || typeof body.action !== 'string') return Response.json({error:'invalid_request'},{status:400});
    const wallet = await openWallet(readCookie(request), secret());
    const user = getUser(wallet.id, wallet);
    if (body.action === 'buy') return response(user, false, 409);
    if (body.action === 'vote') { const accepted = vote(user.player_id); return response(user, accepted, accepted ? 200 : 429); }
    if (body.action === 'set_name') {
      const name=cleanName(body.name);
      if(name.length<3)return response(user,false,400);
      if(usernameTaken(name,user.player_id)) return response(user,false,409);
      user.username=name; user.updated_at=new Date().toISOString(); return response(user,true);
    }
    return response(user,false,400);
  }
}}});
