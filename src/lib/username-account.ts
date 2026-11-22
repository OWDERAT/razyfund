import { usernameSchema } from './access-rules';

// Synthetic credential addresses are never displayed or emailed.
// The original login name is stable when an administrator edits the display name.
export async function usernameAddress(username: string): Promise<string> {
  const normalized = usernameSchema.parse(username.normalize('NFKC')).toLowerCase();
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized)));
  return `${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}@accounts.razy.invalid`;
}