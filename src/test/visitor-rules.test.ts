import { describe, expect, it } from 'vitest';
import { visitorActionSchema, visitorAccess } from '@/lib/visitor-rules';
import { PLAN_TOKENS } from '@/lib/wallet';

describe('name-only players', () => {
  const base = { action: 'buy', plan: 'Starter', name: 'John Doe', order_id: '11111111-2222-4333-8444-555555555555' };
  it('allows cardholder names with spaces and changing to a new name', () => {
    expect(visitorActionSchema.safeParse(base).success).toBe(true);
    expect(visitorActionSchema.safeParse({ ...base, name: 'New Name' }).success).toBe(true);
  });
  it('rejects client-selected balances and unknown packs', () => {
    expect(visitorActionSchema.safeParse({ ...base, balance: 999999 }).success).toBe(false);
    expect(visitorActionSchema.safeParse({ ...base, plan: 'Mega' }).success).toBe(false);
  });
  it('requires a replay identifier for orders', () => {
    expect(visitorActionSchema.safeParse({ action: 'buy', plan: 'Starter', name: 'John Doe' }).success).toBe(false);
  });
  it('uses fixed pack allocations', () => {
    expect(PLAN_TOKENS['Starter']).toBe(500);
    expect(PLAN_TOKENS['Professional']).toBe(2500);
    expect(PLAN_TOKENS['Enterprise']).toBe(10000);
  });
  it('denies banned players and restores access after unbanning', () => {
    expect(visitorAccess(true)).toBe(false);
    expect(visitorAccess(false)).toBe(true);
  });
});