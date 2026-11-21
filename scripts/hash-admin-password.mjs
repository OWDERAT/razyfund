import { randomBytes, pbkdf2Sync } from 'node:crypto';
const password = process.env.ADMIN_PASSWORD_TO_HASH;
if (!password || password.length < 12) {
  console.error('Set ADMIN_PASSWORD_TO_HASH to a new password of at least 12 characters.');
  process.exit(1);
}
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, 100000, 32, 'sha256');
const encode = (b) => b.toString('base64url');
console.log(`${encode(salt)}.${encode(hash)}`);
