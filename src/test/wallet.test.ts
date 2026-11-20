import { describe, expect, it } from 'vitest';
import { emptyWallet, openWallet, sealWallet, cleanName } from '@/lib/wallet';

const SECRET = 'test-secret-test-secret-test-secret';

describe('wallet identity cookie', () => {
  it('round-trips a signed wallet identity without putting balances in the cookie', async () => {
    const wallet = { id: '11111111-2222-3333-4444-555555555555', balance: 500, votes: 3, lastBuy: 1, lastVote: 2 };
    const token = await sealWallet(wallet, SECRET);
    const restored = await openWallet(token, SECRET);
    expect(restored.id).toBe(wallet.id);
    expect(restored.balance).toBe(0);
    expect(restored.votes).toBe(0);
  });

  it('preserves a valid legacy signed balance for one-time server-side migration', async () => {
    const legacy = { id: '11111111-2222-3333-4444-555555555555', balance: 500, votes: 3, lastBuy: 1, lastVote: 2 };
    const body = btoa(JSON.stringify(legacy)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
    const sig = btoa(String.fromCharCode(...signature)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const restored = await openWallet(`${body}.${sig}`, SECRET);
    expect(restored.balance).toBe(500);
    expect(restored.votes).toBe(3);
  });

  it('resets a tampered cookie', async () => {
    const token = await sealWallet(emptyWallet(), SECRET);
    const [body, signature] = token.split('.');
    const forged = `${btoa(JSON.stringify({ id: '11111111-2222-3333-4444-555555555555', balance: 999999 })).replace(/=+$/, '')}.${signature}`;
    expect((await openWallet(forged, SECRET)).balance).toBe(0);
    expect(body).toBeTruthy();
  });

  it('cleans usernames and enforces the length cap', () => {
    expect(cleanName('<script>alert(1)</script>')).toBe('scriptalert1script');
    expect(cleanName('   ')).toBe('');
    expect(cleanName('x'.repeat(50)).length).toBe(20);
  });
});
