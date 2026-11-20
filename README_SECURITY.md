# Razy Tokens — standalone security and deployment

## Server configuration

Set these as server-side environment secrets. Never prefix them with `VITE_` and never put their values in browser code.

- `WALLET_SECRET`: random value of at least 32 characters. Signs the wallet identity cookie.
- `ADMIN_SESSION_SECRET`: a different random value of at least 32 characters. Signs administrator sessions.
- `ADMIN_PASSWORD_HASH`: PBKDF2 hash in `base64url-salt.base64url-hash` format.

Generate an administrator hash using a new password (do not reuse any password previously shared in chat):

```bash
read -s -p 'New admin password: ' ADMIN_PASSWORD_TO_HASH; export ADMIN_PASSWORD_TO_HASH; echo; node scripts/hash-admin-password.mjs; unset ADMIN_PASSWORD_TO_HASH
```

Generate random secrets locally with a cryptographically secure generator, for example:

```bash
openssl rand -hex 32
```

## Standalone storage limitation

The wallet, leaderboard, votes, events and audit log use process memory. There is no SQL, Supabase, or external database integration. Data is available while a server process remains alive, but is lost if that process restarts or a serverless worker is replaced. Separate serverless instances do not share data. Durable cross-instance storage cannot be provided by process memory alone.

## Admin panel

Open the main website and press `O` outside any text field to open the integrated admin overlay. Access is protected by a four-hour signed HttpOnly session. The `/api/admin` route is registered in the project route tree. The panel supports token add/remove/set, username changes, event creation/stopping, and an audit log. Event image and sound URLs must use HTTPS.

## Purchases

Purchases are disabled because no real payment-provider integration is configured. The browser-side simulated checkout never credits tokens. Do not enable token crediting until a payment provider and server-verified webhook are implemented.

## Username-only accounts

A username is associated with the current browser's signed HttpOnly wallet identity. This is a lightweight anonymous account, not a recoverable login: clearing browser cookies loses access to that identity.
