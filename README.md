# Private Invest Dashboard

Private Next.js dashboard for tracking CS2 / Steam items, Telegram Gifts and crypto positions from Google Sheets.

## Current status
Implemented right now:
- hidden dashboard route: `/invest-dashboard/[PRIVATE_DASHBOARD_SLUG]`
- token gate via `DASHBOARD_SECRET_TOKEN`
- protected private API routes for auth, portfolio data and admin write-back
- Google Sheets read layer with canonical schema support and legacy workbook compatibility
- automatic Drive-hosted Excel workbook fallback via `Google Drive API + xlsx`
- canonical Google Sheets validator for tabs and required columns
- summary cards, allocation charts and category charts
- full CS2 table with search, filters, sorting, pagination and mobile cards
- Telegram Gifts panel with sheet-driven pricing
- crypto panel with CoinGecko live pricing and sheet fallback
- CS2 live pricing through Steam Market matching where a reliable match is available
- protected admin mode with add/edit actions directly from the dashboard
- transaction-driven PnL / ROI with cost basis, realized and unrealized PnL
- transaction history table with filters by category, date, name and action
- transaction form for buy / sell / transfer / price_update / fee
- write-back to native Google Sheets and Drive-hosted Excel workbooks
- Audit_Log append on every admin create/update action, including transactions
- simple in-memory cache and rate limiting
- `robots.txt` and `noindex/nofollow` protection for the private surface

## Stack
- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Recharts
- Google Sheets API (`googleapis`)
- Google Drive API fallback for uploaded Excel workbooks
- `xlsx` for workbook parsing and write-back
- `zod` for env and admin payload validation

## Current scope
This release is now read/write-capable if the Google service account has `Editor` access to the spreadsheet or Drive workbook.

If the service account only has `Viewer`, the dashboard stays fully usable in read-only mode, but admin mode shows a clear write-permission error and does not save changes.

## Project structure
```text
src/
  app/
    api/private/auth
    api/private/portfolio
    api/private/admin/meta
    api/private/admin/positions
    api/private/admin/transactions
    invest-dashboard/[dashboardSlug]
  components/dashboard/
    position-editor-drawer.tsx
    transaction-editor-drawer.tsx
    transaction-history-table.tsx
  lib/
    admin/
    auth/
    cache/
    data/
    portfolio/
    providers/
    security/
    sheets/
      client.ts
      schema.json
      schema.ts
      writeback.ts
  types/
docs/
  google-sheets-template.md
scripts/
  validate-google-sheet.mjs
.env.example
README.md
```

## Environment variables
Copy `.env.example` to `.env.local` and fill in:

- `PRIVATE_DASHBOARD_SLUG`: long private route fragment
- `DASHBOARD_SECRET_TOKEN`: token/password for the dashboard and API
- `NEXT_PUBLIC_SITE_URL`: canonical domain for deployment
- `GOOGLE_SHEETS_SPREADSHEET_ID`: spreadsheet id or full Sheets URL
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Google service-account email
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: service-account private key with `\n` escapes
- `GOOGLE_SERVICE_ACCOUNT_JSON`: optional alternative to email/key pair
- `COINGECKO_API_KEY`: optional, improves quota handling for live crypto pricing
- `DEFAULT_CURRENCY`: reporting currency, default `USD`
- `PORTFOLIO_CACHE_TTL_SECONDS`: Google Sheets cache TTL
- `PRICE_CACHE_TTL_SECONDS`: live price cache TTL
- `RATE_LIMIT_WINDOW_SECONDS`: auth/API rate-limit window
- `RATE_LIMIT_MAX_REQUESTS`: max requests per window

No new env vars are required specifically for admin mode. The only operational requirement is `Editor` access for the service account.

## Google Sheets setup
1. Create or reuse a Google Cloud project.
2. Enable the Google Sheets API.
3. If the source file was uploaded from Excel and is being edited in Drive, also enable the Google Drive API.
4. Create a service account.
5. Download the JSON key, then map its values into env vars.
6. Share the target spreadsheet or Drive workbook with the service-account email.
7. Use `Viewer` if you want strict read-only mode.
8. Use `Editor` if you want dashboard admin mode and write-back.
9. Put the spreadsheet id or full URL into `GOOGLE_SHEETS_SPREADSHEET_ID`.
10. Run the validator:

```bash
node --env-file=.env.local scripts/validate-google-sheet.mjs
```

## Sheet structure
See [docs/google-sheets-template.md](docs/google-sheets-template.md).

The project now distinguishes between:
- canonical schema: the target long-term tab and column structure
- legacy compatibility: older workbooks that can still be loaded today

If the validator says `Runtime compatibility: OK` but `Canonical structure ready: NO`, the dashboard can still run. Admin mode also works with many legacy layouts because the write layer can append missing canonical columns into the target sheet when saving.

## Admin mode
Admin mode is available only after the standard dashboard token gate.

Current capabilities:
- edit quantity
- edit entry price
- edit manual current price / sheet fallback price
- edit status
- edit notes
- edit `priceConfidence` and `liquidityNote` for Telegram Gifts
- add new CS2 / Telegram / Crypto positions
- add transaction rows for `buy`, `sell`, `transfer`, `price_update`, `fee`
- transaction history filters by category, date, action and asset name
- append every mutation to `Audit_Log`
- support both canonical sheets and legacy alias tabs such as `CS2 Assets` / `Telegram Gifts`

Current safety behavior:
- all admin routes require the same token/session as portfolio API
- all admin payloads are validated on the server
- rate limiting is applied to admin routes too
- positions are not physically deleted by the UI
- use `archived` or `dead` to retire a position without removing history

## Local development
```bash
npm install
npm run dev
```

Open the private route:

```text
http://localhost:3000/invest-dashboard/<your-private-slug>
```

Authenticate either by:
- entering the token in the login form
- opening the URL with `?token=YOUR_TOKEN`
- calling the API with `Authorization: Bearer YOUR_TOKEN`

## Deploy

### Vercel
1. Import the repo.
2. Set all env vars in the project settings.
3. Redeploy.
4. Open `https://your-domain.com/invest-dashboard/<slug>`.

### VPS
1. Copy the project to the server.
2. Create `.env.local`.
3. Run:

```bash
npm install
npm run build
npm run start
```

4. Put Nginx or Caddy in front of the app.
5. Do not add links to the dashboard path from the public homepage.

### Cloudflare Pages / Workers
Not recommended for the current build without refactoring.

This project currently uses Node-oriented server modules and `googleapis`, so Vercel or a Node VPS is the supported deployment path out of the box.

## Change the secret URL
1. Generate a new long slug.
2. Update `PRIVATE_DASHBOARD_SLUG`.
3. Redeploy.
4. Share the new private route only with trusted operators.
5. Optionally rotate `DASHBOARD_SECRET_TOKEN` at the same time.

## Security notes
- route secrecy is not treated as real auth
- all secrets stay in env vars only
- dashboard data is never rendered without a valid token/session
- private API routes require the same access token/session
- admin API routes require the same access token/session
- the private route is marked `noindex, nofollow`
- `robots.txt` disallows the private dashboard prefix
- simple in-memory rate limiting is enabled for auth, data and admin routes
- secrets are not printed into logs or client bundles

## Add new price providers
1. Create a provider in `src/lib/providers`.
2. Keep the provider focused on one asset class.
3. Return normalized typed positions and warnings.
4. Wire the provider into `src/lib/portfolio/build-portfolio.ts`.
5. Document new env vars in `.env.example` and `README.md`.
6. If the provider depends on extra sheet columns, update `src/lib/sheets/schema.json`, the normalizer and `scripts/validate-google-sheet.mjs`.

## What still needs to be done for full portfolio operations
- portfolio history snapshots and performance-over-time charts
- explicit delete flow with hard confirmation if physical row removal is ever needed
- Telegram Gifts pricing workflow with stronger confidence / stale-price tracking
- broader CS2 market coverage through additional providers beyond the current Steam Market layer
- durable cache/rate limit storage via Redis or similar for multi-instance production
- optional admin actions for editing existing transactions and settings

## Verification commands
```bash
npm run typecheck
npm run lint
npm run build
```

