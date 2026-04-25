# Private Invest Dashboard

Private Next.js dashboard for tracking CS2 / Steam items, Telegram Gifts and crypto positions from Google Sheets.

Additional docs:
- `PROJECT_OVERVIEW.md` for a short architecture overview
- `DEPLOYMENT.md` for deployment notes
- `docs/SAAS_ARCHITECTURE.md` for the target SaaS domain model
- `docs/MIGRATION_PRIVATE_TO_SAAS.md` for the staged migration plan
- `docs/DATABASE.md` for the Prisma/PostgreSQL foundation

## Current status
Implemented right now:
- hidden dashboard route: `/invest-dashboard/[PRIVATE_DASHBOARD_SLUG]`
- token gate via `DASHBOARD_SECRET_TOKEN`
- protected private API routes for auth, portfolio data, health diagnostics and admin write-back
- Google Sheets read layer with canonical schema support and legacy workbook compatibility
- automatic Drive-hosted Excel workbook fallback via `Google Drive API + xlsx`
- canonical Google Sheets validator for tabs and required columns
- summary cards, allocation charts, category charts and portfolio history performance charts
- portfolio risk analytics with concentration, missing/stale price risk and liquidity signals
- recommendation labels: `hold`, `watch`, `consider_trimming`, `needs_price_update`, `illiquid`
- high-risk watchlist plus high-risk filter inside the CS2 registry
- full CS2 table with search, sticky desktop header, quick filters, sorting, pagination and mobile cards
- Telegram Gifts pricing workflow with manual price notes, stale warnings, analytics and quick price-update actions
- crypto panel with CoinGecko live pricing and sheet fallback
- CS2 multi-provider live pricing layer with provider chain, stale-price detection and manual fallback
- protected admin mode with add/edit actions directly from the dashboard
- transaction-driven PnL / ROI with cost basis, realized and unrealized PnL
- transaction history table with filters by category, date, name and action plus sticky desktop header
- transaction form for `buy` / `sell` / `transfer` / `price_update` / `fee`
- write-back to native Google Sheets and Drive-hosted Excel workbooks
- Audit_Log append on every admin create/update action, including transactions and portfolio snapshots
- private Settings / Health page at `/invest-dashboard/[slug]/settings`
- premium loading skeletons, reusable empty states and route-level error boundary for the private dashboard
- protected health actions for cache refresh, Google Sheet validation, snapshot creation and provider diagnostics
- memory cache with optional Redis REST shared cache fallback plus rate limiting
- Prisma/PostgreSQL SaaS database foundation with schema, seed script, auth bootstrap and migration docs
- Auth.js credentials login/registration for `/login`, `/register` and protected SaaS routes `/app`, `/app/portfolios`, `/app/portfolios/[portfolioId]`, `/app/settings`
- `robots.txt` and `noindex/nofollow` protection for the private surface

## Stack
- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Recharts
- Google Sheets API (`googleapis`)
- Google Drive API fallback for uploaded Excel workbooks
- PostgreSQL + Prisma 7 + `@prisma/adapter-pg` for SaaS auth/workspace mode
- `xlsx` for workbook parsing and write-back
- `zod` for env and admin payload validation

## Current scope
This release is read/write-capable if the Google service account has `Editor` access to the spreadsheet or Drive workbook.

SaaS auth mode is available when `DATABASE_URL` and `AUTH_SECRET` are configured. It adds credentials-based registration/login for `/app`, while the existing private slug+token dashboard remains untouched.

If the service account only has `Viewer`, the dashboard stays fully usable in read-only mode, but admin mode shows a clear write-permission error and does not save changes.

## Project structure
```text
src/
  app/
    api/auth/[...nextauth]
    api/auth/register
    api/private/auth
    api/private/portfolio
    api/private/health
    api/private/health/actions
    api/private/admin/meta
    api/private/admin/positions
    api/private/admin/transactions
    api/private/admin/snapshots
    app
    app/portfolios
    app/settings
    invest-dashboard/[dashboardSlug]
    invest-dashboard/[dashboardSlug]/settings
    login
    register
  components/app/
    saas-app-shell.tsx
  components/auth/
    auth-shell.tsx
    login-form.tsx
    register-form.tsx
    saas-disabled-state.tsx
  components/dashboard/
    dashboard-locked-state.tsx
    private-dashboard-nav.tsx
    portfolio-risk-panel.tsx
    recommendation-badge.tsx
    settings-health-shell.tsx
    position-editor-drawer.tsx
    transaction-editor-drawer.tsx
    transaction-history-table.tsx
    portfolio-value-history-chart.tsx
    asset-class-history-chart.tsx
    portfolio-pnl-history-chart.tsx
  lib/
    admin/
    auth/
    cache/
    client/
    data/
    db/
    health/
    portfolio/
    providers/
      cs2/
        provider-registry.ts
        types.ts
        utils.ts
      telegram-gifts/
        types.ts
    security/
    sheets/
      client.ts
      schema.json
      schema.ts
      validation.ts
      writeback.ts
  types/
    health.ts
    portfolio.ts
docs/
  DATABASE.md
  google-sheets-template.md
  MIGRATION_PRIVATE_TO_SAAS.md
  SAAS_ARCHITECTURE.md
prisma/
  schema.prisma
  seed.mjs
prisma.config.ts
scripts/
  validate-google-sheet.mjs
  verify-client-bundle.mjs
middleware.ts
.env.example
PROJECT_OVERVIEW.md
README.md
```

## Environment variables
Copy `.env.example` to `.env.local` and fill in:

- `PRIVATE_DASHBOARD_SLUG`: long private route fragment
- `DASHBOARD_SECRET_TOKEN`: token/password for the dashboard and API
- `NEXT_PUBLIC_SITE_URL`: canonical domain for deployment
- `DATABASE_URL`: PostgreSQL connection string for SaaS auth/workspace mode
- `DIRECT_URL`: optional direct PostgreSQL connection string reserved for future split-connection tooling
- `AUTH_SECRET`: secret for Auth.js JWT sessions
- `NEXTAUTH_URL`: canonical SaaS auth URL
- `AUTH_RATE_LIMIT_WINDOW_SECONDS`: auth rate-limit window
- `AUTH_RATE_LIMIT_MAX_REQUESTS`: max auth attempts per window
- `GOOGLE_SHEETS_SPREADSHEET_ID`: spreadsheet id or full Sheets URL
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Google service-account email
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: service-account private key with `\n` escapes
- `GOOGLE_SERVICE_ACCOUNT_JSON`: optional alternative to email/key pair
- `COINGECKO_API_KEY`: optional, improves quota handling for live crypto pricing
- `CS2_PROVIDER_ORDER`: provider chain, e.g. `steam,manual` or `buff_proxy,steam,manual`
- `CS2_PRICE_STALE_HOURS`: manual CS2 quote becomes stale after this many hours
- `CS2_BUFF_PROXY_URL`: optional custom JSON endpoint for a Buff/manual proxy adapter
- `CSFLOAT_API_KEY`: reserved for future direct CSFloat adapter
- `PRICEMPIRE_API_KEY`: reserved for future direct PriceEmpire adapter
- `TELEGRAM_PRICE_STALE_DAYS`: threshold for stale Telegram Gift prices based on last manual check date
- `DEFAULT_CURRENCY`: reporting currency, default `USD`
- `PORTFOLIO_CACHE_TTL_SECONDS`: Google Sheets cache TTL
- `PRICE_CACHE_TTL_SECONDS`: live price cache TTL
- `RATE_LIMIT_WINDOW_SECONDS`: auth/API rate-limit window
- `RATE_LIMIT_MAX_REQUESTS`: max requests per window
- `CACHE_DRIVER`: `memory` or `redis_rest`
- `CACHE_REDIS_REST_URL`: optional Redis REST endpoint (Upstash/compatible)
- `CACHE_REDIS_REST_TOKEN`: auth token for Redis REST
- `CACHE_KEY_PREFIX`: namespace prefix for shared cache keys

## Database foundation
The repository now includes a Prisma/PostgreSQL schema for the future SaaS mode. The current private dashboard still works without database env vars and continues to use the Google Sheets integration path in production.

Common commands:

```bash
npm run db:format
npm run db:validate
npm run db:generate
npm run db:migrate:dev -- --name init_saas_foundation
npm run db:migrate:dev -- --name add_auth_credentials
npm run db:seed
```

See [docs/DATABASE.md](docs/DATABASE.md) for model descriptions, migration flow, Prisma 7 config notes and production commands.

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

The project distinguishes between:
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
- edit `priceConfidence`, `sourceNote`, `liquidityNote` and last checked date for Telegram Gifts
- add new CS2 / Telegram / Crypto positions
- add transaction rows for `buy`, `sell`, `transfer`, `price_update`, `fee`
- create a daily portfolio snapshot in `Portfolio_History` with duplicate-day protection
- transaction history filters by category, date, action and asset name
- append every mutation to `Audit_Log`
- support both canonical sheets and legacy alias tabs such as `CS2 Assets` / `Telegram Gifts`

Current safety behavior:
- all admin routes require the same token/session as portfolio API
- all admin payloads are validated on the server
- rate limiting is applied to admin routes too
- positions are not physically deleted by the UI
- a second snapshot on the same date requires explicit confirmation and updates the existing row instead of creating silent duplicates
- use `archived` or `dead` to retire a position without removing history

## Risk analytics
The dashboard now includes a portfolio-wide risk layer.

Current signals:
- concentration by category and by single position
- missing price risk
- stale price risk
- low-liquidity / thin-market risk
- manual or medium-confidence pricing risk
- recommendation labels per position

Current outputs:
- portfolio risk score
- narrative risk summary in plain text
- category exposure blocks
- top positions by value
- top positions by quantity
- high-risk watchlist
- CS2 high-risk filter directly in the table

The risk layer is intentionally analytical. It highlights where data quality, liquidity or concentration may require attention. It is not investment advice.

## Settings / Health page
The private route `/invest-dashboard/[slug]/settings` is an operator-facing diagnostic surface.

It now also shows whether the project is on pure memory cache or hybrid memory + Redis REST cache.

Current capabilities:
- token-gate status
- Google Sheets read status
- Google Sheets write status
- provider summaries for crypto / CS2 / Telegram
- cache status and warning feed
- runtime/canonical Google Sheet validation
- protected actions for cache refresh, validation, snapshot creation and provider diagnostics

The page never shows env secrets; it only shows operational health and user-facing error messages.

## SaaS auth beta
Protected SaaS routes:
- `/app`
- `/app/portfolios`
- `/app/portfolios/[portfolioId]`
- `/app/settings`

SaaS management API routes:
- `POST /api/app/workspaces`
- `POST /api/app/workspaces/active`
- `POST /api/app/portfolios`
- `PATCH /api/app/portfolios/[portfolioId]`
- `DELETE /api/app/portfolios/[portfolioId]`

Public auth routes:
- `/login`
- `/register`

Manual flow:
1. Set `DATABASE_URL` and `AUTH_SECRET` in `.env.local`.
2. Run `npm run db:generate`.
3. Run `npm run db:migrate:dev -- --name add_auth_credentials`.
4. Open `/register` and create the first account.
5. After registration, the app bootstraps owner-user, workspace, main portfolio and free subscription.
6. Login redirects to `/app`.
7. Use the workspace switcher in the SaaS header to change active workspace.
8. Create/edit/archive portfolios from `/app` or `/app/portfolios`.
9. Open `/app/portfolios/[portfolioId]` to inspect DB-backed summary cards, charts, positions and recent transactions.

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

SaaS auth uses a separate credentials flow at `/login` and `/register`.

## Deploy
See also [DEPLOYMENT.md](DEPLOYMENT.md) for the production checklist, proxy examples and troubleshooting.

### Pre-deploy checklist
1. `npm run typecheck`
2. `npm run lint`
3. `npm run build`
4. `npm run verify:bundle`
5. `node --env-file=.env.local scripts/validate-google-sheet.mjs` if `.env.local` exists and Google Sheets is configured.

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

## CS2 provider chain
The CS2 pricing layer uses a provider interface plus configurable chain resolution.

Current built-in providers:
- `steam`: Steam Community Market live search with caching and batch resolution
- `buff_proxy`: optional custom proxy endpoint for external/manual aggregated CS2 prices
- `manual`: fallback to `manualCurrentPrice` / `currentPrice` from Google Sheets

Resolution order is controlled by `CS2_PROVIDER_ORDER`.
Examples:
- `steam,manual`
- `buff_proxy,steam,manual`
- `manual`

The dashboard also marks stale CS2 prices when `lastUpdated` in the sheet is older than `CS2_PRICE_STALE_HOURS`.

Expected `CS2_BUFF_PROXY_URL` response shape:
```json
{
  "items": [
    {
      "assetName": "AWP | Dragon Lore",
      "matchedName": "AWP | Dragon Lore (Factory New)",
      "price": 12345.67,
      "confidence": "high",
      "lastUpdated": "2026-04-25T12:00:00.000Z",
      "warning": null
    }
  ]
}
```

## Telegram Gifts pricing workflow
Telegram Gifts support a dedicated manual and semi-automatic pricing flow.

Current workflow:
- `manualCurrentPrice` / `currentPrice` in the sheet for operator-entered prices
- `priceConfidence`, `sourceNote`, `liquidityNote`, `lastUpdated` for manual price governance
- quick `price_update` action from the dashboard into `Transactions`
- stale-price warnings when the last manual check becomes older than `TELEGRAM_PRICE_STALE_DAYS`
- collection analytics, top gifts, low-confidence list and stale-price list in the UI

Future provider path:
- the Telegram pricing layer now has a provider interface in `src/lib/providers/telegram-gifts/types.ts`
- today it uses manual sheet pricing first and TON sheet conversion as a secondary provider
- later you can plug an external OTC / marketplace source without rewriting the dashboard shell

## Portfolio history snapshots
Portfolio history is based on the `Portfolio_History` sheet and the private route `POST /api/private/admin/snapshots`.

Current behavior:
- admin mode has a `Create snapshot now` action
- the API prevents silent duplicate snapshots for the same day
- after confirmation, the current day row is updated instead of appended again
- the endpoint is cron-ready and can be triggered later with the same bearer token / dashboard token

Example future cron call:
```bash
curl -X POST https://your-domain.com/api/private/admin/snapshots \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"operation":"capture","entityType":"portfolio_snapshot","data":{"source":"cron","date":"2026-04-25"}}'
```

## Add new price providers
1. Create a provider in `src/lib/providers`.
2. Keep the provider focused on one asset class.
3. Return normalized typed positions and warnings.
4. Wire the provider into `src/lib/portfolio/build-portfolio.ts`.
5. Document new env vars in `.env.example` and `README.md`.
6. If the provider depends on extra sheet columns, update `src/lib/sheets/schema.json`, the normalizer and `scripts/validate-google-sheet.mjs`.

## What still needs to be done for full portfolio operations
- scheduled cron trigger or automation for daily snapshot creation
- explicit delete flow with hard confirmation if physical row removal is ever needed
- external Telegram Gifts market/OTC provider if you decide to automate more than manual + TON-based pricing
- direct CSFloat / PriceEmpire adapters if you decide to operate through official paid APIs
- durable cache/rate limit storage via Redis or similar for multi-instance production
- optional admin actions for editing existing transactions and settings

## Verification commands
```bash
npm run typecheck
npm run lint
npm run build
```



