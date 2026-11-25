import { describe, expect, it } from 'vitest';
import { applyAction, emptyWallet, openWallet, sealWallet } from '@/lib/wallet';

const S = 'test-secret-test-secret-test-secret';
describe('wallet', () => {
  it('a buy request never credits tokens, whatever plan is claimed', () => {
    for (const plan of ['Starter', 'Professional', 'Enterprise', 'Mega']) {
      const r = applyAction(emptyWallet(), 'buy', plan, 10_000);
      expect(r.ok).toBe(false);
      expect(r.wallet.balance).toBe(0);
    }
  });
  it('a vote adds exactly one voice and a second vote is refused', () => {
    const a = applyAction(emptyWallet(), 'vote', undefined, 5000);
    expect(a.wallet.votes).toBe(1);
    expect(applyAction(a.wallet, 'vote', undefined, 60_000).ok).toBe(false);
  });
  it('round-trips a sealed wallet', async () => {
    const w = { id: '11111111-2222-3333-4444-555555555555', balance: 500, votes: 1, lastBuy: 1, lastVote: 2 };
    expect(await openWallet(await sealWallet(w, S), S)).toEqual(w);
  });
  it('resets a tampered wallet to zero', async () => {
    const sealed = await sealWallet({ id: '11111111-2222-3333-4444-555555555555', balance: 500, votes: 1, lastBuy: 1, lastVote: 2 }, S);
    const forged = btoa(JSON.stringify({ balance: 999999, votes: 999, lastBuy: 0, lastVote: 0 })).replace(/=+$/, '') + '.' + sealed.split('.')[1];
    expect((await openWallet(forged, S)).balance).toBe(0);
  });
  it('cleans leaderboard names to 20 safe characters', async () => {
    const { cleanName } = await import('@/lib/wallet');
    expect(cleanName('<script>alert(1)</script>')).toBe('scriptalert1script');
    expect(cleanName('   ')).toBe('Anonymous');
    expect(cleanName('x'.repeat(50)).length).toBe(20);
  });
});
