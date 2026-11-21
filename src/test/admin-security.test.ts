import { describe, expect, it } from 'vitest';
import { hashAdminPassword, verifyAdminPassword } from '@/lib/admin-password';
import { adminActionSchema, signupUsernameSchema } from '@/lib/access-rules';

describe('admin password', () => {
  it('accepts the right password and rejects wrong, empty and near-miss ones', async () => {
    const hash = await hashAdminPassword('correct horse battery staple');
    expect(await verifyAdminPassword('correct horse battery staple', hash)).toBe(true);
    for (const bad of ['', 'correct horse battery stapl', 'Correct horse battery staple', 'x'.repeat(300)]) {
      expect(await verifyAdminPassword(bad, hash)).toBe(false);
    }
  });
  it('uses a fresh salt each time', async () => {
    expect(await hashAdminPassword('same-password-twice')).not.toBe(await hashAdminPassword('same-password-twice'));
  });
  it('fails closed when no hash is configured or it is malformed', async () => {
    for (const stored of [undefined, '', 'nodot', '.', 'a.', '.b', '!!!.!!!']) {
      expect(await verifyAdminPassword('anything', stored)).toBe(false);
    }
  });
});

describe('input rules', () => {
  it('players cannot pick reserved or unsafe names', () => {
    for (const bad of ['admin', 'Razy_Official', 'xxScoobertxx', 'a', '<b>hi</b>', 'has space', 'x'.repeat(21)]) {
      expect(signupUsernameSchema.safeParse(bad).success).toBe(false);
    }
    expect(signupUsernameSchema.safeParse('  Matt_77 ').success).toBe(true);
  });
  it('admin events only accept https image and sound urls', () => {
    const base = { action: 'create_event', event_type: 'rain', title: 't', count: 10, duration_minutes: 5, sound_url: null };
    expect(adminActionSchema.safeParse({ ...base, image_url: 'https://example.com/a.png' }).success).toBe(true);
    for (const url of ['http://example.com/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA']) {
      expect(adminActionSchema.safeParse({ ...base, image_url: url }).success).toBe(false);
    }
  });
});
