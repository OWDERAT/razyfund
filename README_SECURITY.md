# Razy Tokens security update

## Required deployment configuration

Set these as **server-side secrets** in Lovable Cloud / your deployment environment. Never use a `VITE_` prefix for server secrets.

- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service-role key (server only).
- `WALLET_SECRET`: at least 32 random characters, used to sign the HttpOnly wallet identity cookie.
- `ADMIN_SESSION_SECRET`: a different, independent secret of at least 32 random characters.
- `ADMIN_PASSWORD_HASH`: PBKDF2 hash in `base64url-salt.base64url-hash` format.

Generate an administrator hash using a NEW password (do not reuse the password previously pasted into chat):

```bash
read -s -p 'New admin password: ' ADMIN_PASSWORD_TO_HASH; export ADMIN_PASSWORD_TO_HASH; echo; node scripts/hash-admin-password.mjs; unset ADMIN_PASSWORD_TO_HASH
```

Copy the command output into the server-side `ADMIN_PASSWORD_HASH` secret. Do not put the plaintext password or hash in frontend code.

Generate secrets locally with a cryptographically secure random generator, e.g.:

```bash
openssl rand -hex 32
```

## Database setup

Run `database/required_schema.sql` in the Supabase SQL Editor before deploying this version. It creates the server-side wallet tables, username table, atomic Scoobert claim function, events table, and admin audit log. It also copies existing leaderboard balances into the new wallet table where possible.

The server must have the Supabase service-role key. The key is used only by server routes and must never be exposed to browser code.

## Admin panel

After configuring the secrets and applying the SQL, visit `/admin.html`. Access is protected by a four-hour signed HttpOnly session. The server verifies the password hash; hiding the URL is not used as a security control.

The panel supports user lookup, token add/remove/set, username changes, live event creation/stopping, and an audit log. Event state is polled by the public page every five seconds. Image and sound URLs must use HTTPS.

## Purchases are intentionally disabled

The supplied project did not contain a real payment-provider integration. The previous checkout was a browser-side simulation that directly requested token credits. That is now disabled. Do not re-enable token crediting until a payment provider is configured and server-side signed webhooks are verified. Never collect card details in this app; use the provider's hosted checkout.

## Username-only accounts

A username is unique and is associated with the current browser's signed HttpOnly wallet identity. This is a lightweight anonymous account, not a recoverable login: clearing browser cookies loses access to that identity. Do not promise account recovery unless an authentication method is added.
