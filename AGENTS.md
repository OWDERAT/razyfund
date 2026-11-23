<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Keep the supplied standalone page inside the index iframe; pass bundled image and CDN audio URLs through its query parameters so assets resolve after publishing.
- Keep the hidden descent's depth/volume calculations in a browser-safe standalone module with regression tests; scroll position is the sole reversible source of visual and audio intensity.
- Keep the deeper encounter's timed phases in a browser-safe tested module; scrolling out cancels unfinished encounters, media ended events sequence the scream and video without overlap, and the completed blackout stays latched in memory until refresh.
- Player balances, one-vote claims and bans live in server-authoritative tables; browser identity uses an opaque httpOnly cookie whose hash is stored privately, not an editable name or balance.
- Checkout awards simulated, non-monetary tokens using fixed server pack amounts and per-player order identifiers for replay protection; browser orders never constitute proof of payment.
- Cardholder names label browser players without member sign-in; bans follow the stable player ID across renames, remain until administrator unban, and cannot identify a person after cookie deletion.
- Admin access uses server-verified, rate-limited password checks and expiring httpOnly cookie sessions; encrypted password secrets stay server-only and the newly configured secret takes precedence over an older hash.
- Standalone player bindings run after DOMContentLoaded, initialize identity before writes, and dispose polling on page exit; this avoids missing nodes and concurrent cookie creation.
