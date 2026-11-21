import { z } from 'zod';

export const usernameSchema = z.string().trim().min(3).max(20).regex(/^[\p{L}\p{N}_.-]+$/u);
// Names players may pick for themselves (admins can still assign any valid name).
export const signupUsernameSchema = usernameSchema.refine((v) => !/(admin|owner|moderator|razy|scoobert)/i.test(v), 'Reserved name');
const httpsUrl = z.string().url().max(2048).refine(value => new URL(value).protocol === 'https:');
export const adminActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('login'), password: z.string().min(1).max(256) }).strict(),
  z.object({ action: z.literal('logout') }).strict(),
  z.object({ action: z.literal('adjust_tokens'), player_id: z.string().uuid(), mode: z.enum(['add', 'remove', 'set']), amount: z.number().int().min(0).max(10_000_000) }).strict(),
  z.object({ action: z.literal('rename_user'), player_id: z.string().uuid(), username: usernameSchema }).strict(),
  z.object({ action: z.literal('create_event'), event_type: z.enum(['rain', 'announcement', 'banner', 'maintenance']), title: z.string().max(100), image_url: httpsUrl.nullable(), sound_url: httpsUrl.nullable(), count: z.number().int().min(1).max(35), duration_minutes: z.number().int().min(1).max(1440) }).strict(),
  z.object({ action: z.literal('stop_event'), event_id: z.string().uuid() }).strict(),
]);