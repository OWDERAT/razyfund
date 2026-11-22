import { describe, expect, it } from 'vitest';
import { usernameAddress } from '@/lib/username-account';

describe('username-only credentials', () => {
  it('uses the same credential for case and whitespace variations', async () => {
    expect(await usernameAddress('  Matt_77 ')).toBe(await usernameAddress('matt_77'));
  });
  it('different names cannot log into the same account', async () => {
    expect(await usernameAddress('Matt_77')).not.toBe(await usernameAddress('Matt_78'));
  });
  it('supports non-ASCII names without unsafe email characters', async () => {
    expect(await usernameAddress('玩家名字')).toMatch(/^[a-f0-9]{64}@accounts\.razy\.invalid$/);
  });
  it('rejects malformed login names', async () => {
    await expect(usernameAddress('<script>')).rejects.toThrow();
  });
});