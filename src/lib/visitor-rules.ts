import { z } from 'zod';

export const playerNameSchema = z.string().trim().min(1).max(20).regex(/^[\p{L}\p{N} ._-]+$/u);
export const visitorActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('vote') }).strict(),
  z.object({ action: z.literal('buy'), plan: z.enum(['Starter', 'Professional', 'Enterprise']), name: playerNameSchema, order_id: z.string().uuid() }).strict(),
]);
export function visitorAccess(banned: boolean) { return !banned; }