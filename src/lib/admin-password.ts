// Admin password hashing: PBKDF2-SHA256, stored as "base64url-salt.base64url-hash".
// 100k iterations is the most Cloudflare Workers' WebCrypto accepts, so the hash must be made with the same count.
export const ADMIN_PBKDF2_ITERATIONS = 100_000;

const enc = new TextEncoder();
const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: ADMIN_PBKDF2_ITERATIONS }, key, 256);
  return new Uint8Array(bits);
}

export async function hashAdminPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${toB64(salt)}.${toB64(await derive(password, salt))}`;
}

/** Constant-time check of a password against a stored hash. Returns false for anything malformed or missing. */
export async function verifyAdminPassword(input: string, stored: string | undefined): Promise<boolean> {
  try {
    const [salt, hash] = (stored ?? '').split('.');
    if (!salt || !hash) return false;
    const expected = fromB64(hash);
    const actual = await derive(input, fromB64(salt));
    if (expected.length !== actual.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) {
      const a = actual[i]; const b = expected[i];
      if (a === undefined || b === undefined) return false;
      diff |= a ^ b;
    }
    return diff === 0;
  } catch {
    return false;
  }
}
