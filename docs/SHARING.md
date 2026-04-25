# Shareable Read-Only Dashboards

## Purpose
Stage 27 adds public but scoped read-only portfolio views for the SaaS branch.

These links are intended for cases such as:
- investor updates
- partner review links
- internal read-only snapshots
- sharing allocation without exposing full holdings

The legacy private dashboard under `/invest-dashboard/[slug]` is unchanged. Share links are a separate SaaS feature built on PostgreSQL.

## What Was Added
- `ShareLink` model in Prisma/PostgreSQL
- owner/admin UI on `/app/portfolios/[portfolioId]`
- public route `/share/[shareToken]`
- optional password gate
- optional expiration
- revoke flow
- scope controls:
  - hide values
  - hide quantities
  - hide PnL
  - allocation only
- `noindex` / `nofollow` for shared pages
- `robots.txt` deny for `/share/`

## Data Model
`ShareLink` stores:
- `portfolioId`
- `workspaceId`
- optional `label`
- unique `token`
- optional `passwordHash`
- scope flags: `hideValues`, `hideQuantities`, `hidePnl`, `allocationOnly`
- `expiresAt`
- `revokedAt`
- `lastAccessedAt`
- timestamps

## Routes
### SaaS management routes
Authenticated and permission-checked:
- `POST /api/app/portfolios/[portfolioId]/share-links`
- `DELETE /api/app/portfolios/[portfolioId]/share-links/[shareLinkId]`

### Public shared routes
No app session required:
- `GET /share/[shareToken]`
- `POST /api/share-links/[shareToken]/unlock`

## Permission Model
Only `owner` and `admin` can:
- create share links
- revoke share links
- view the management panel with existing links

Shared viewers can only:
- open the public route
- submit the optional password
- consume the sanitized read-only view

No shared route can call the private legacy API or the authenticated `/api/app/*` routes.

## Scope Rules
### `hideValues`
Hides valuation-facing fields:
- portfolio total value
- current price
- per-position value
- allocation absolute currency values

Percent allocation is still visible.

### `hideQuantities`
Hides position size / quantity fields.

### `hidePnl`
Hides:
- portfolio PnL summary
- per-position PnL
- ROI hinting

### `allocationOnly`
Shows only category allocation.

It hides:
- holdings list
- per-position detail cards
- value table rows

## Password Protection
If a password is set:
- the public route first renders a password gate
- unlocking happens through `POST /api/share-links/[shareToken]/unlock`
- the server returns a signed `httpOnly` cookie scoped to that share path
- the cookie is invalidated automatically if:
  - the link is revoked
  - the link expires
  - the link record changes and `updatedAt` moves forward

No plain password is stored in the database. Only `passwordHash` is stored.

## Expiration and Revocation
### Expiration
If `expiresAt` is reached:
- the shared page no longer renders portfolio data
- the user sees an expired state
- unlock attempts return `410`

### Revocation
Revocation is soft-state, not delete.
`revokedAt` is filled, and the same URL stops working.

## Audit Log
The following audit events are written:
- `share_link.create`
- `share_link.revoke`

## Manual Test Flow
1. Open `/app/portfolios/[portfolioId]` as `owner` or `admin`.
2. Create a link without password and without expiration.
3. Open the generated `/share/[shareToken]` in an incognito window.
4. Verify the shared page renders without app auth.
5. Create another link with:
   - password
   - short expiration
   - `hideValues`
   - `hidePnl`
6. Open it in incognito and verify:
   - password gate appears first
   - wrong password returns an error
   - correct password opens the page
   - values and PnL are masked
7. Create a third link with `allocationOnly` and verify holdings are hidden.
8. Revoke any active link and confirm the old URL shows the revoked state.
9. Check `robots.txt` and page metadata for noindex behavior.

## Security Notes
- share links are intentionally separate from the private legacy token dashboard
- shared pages do not expose write actions
- shared pages do not expose the private dashboard token
- shared routes read directly from PostgreSQL-backed SaaS services, not the legacy private API
- password-protected links use signed `httpOnly` cookies instead of query parameters
- `robots.txt` denies `/share/`

## Limitations
- share links are portfolio-level only for now
- there is no per-link view counter yet
- there is no per-link custom branding yet
- there is no multi-step invite flow yet; that belongs to later team stages
- there is no dedicated export from shared pages yet