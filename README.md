# Private Invest Dashboard

Private Next.js dashboard for tracking CS2 / Steam items, Telegram Gifts and crypto positions from Google Sheets.

## What is implemented in phase 1
- hidden dashboard route: `/invest-dashboard/[PRIVATE_DASHBOARD_SLUG]`
- token gate via `DASHBOARD_SECRET_TOKEN`
- protected private API routes
- Google Sheets read layer with normalization and demo fallback
- automatic fallback for Drive-hosted Excel workbooks that cannot be read by Sheets API directly
- summary cards, allocation charts, category charts
- full CS2 table with search, filters, sorting and pagination
- Telegram Gifts panel with sheet-driven pricing
- crypto panel with CoinGecko live pricing and sheet fallback
- simple in-memory cache and rate limiting
- `robots.txt` and `noindex/nofollow` protection for the private surface

## Stack
- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Recharts
- Google Sheets API (`googleapis`)
- `xlsx` for Drive workbook fallback

## Read-only scope in this version
This release is intentionally read-only.

Admin write-back to Google Sheets is not included yet. The codebase is already split into modular providers and a server-side Sheets layer so write access can be added in phase 2 with a service account that has editor permissions.

## Project structure
```text
src/
  app/
    api/private/auth
    api/private/portfolio
    invest-dashboard/[dashboardSlug]
  components/dashboard/
  lib/
    auth/
    cache/
    data/
    portfolio/
    providers/
    security/
    sheets/
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
- `PRICE_CACHE_TTL_SECONDS`: crypto price cache TTL
- `RATE_LIMIT_WINDOW_SECONDS`: auth/API rate-limit window
- `RATE_LIMIT_MAX_REQUESTS`: max requests per window

## Google Sheets setup
1. Create or reuse a Google Cloud project.
2. Enable the Google Sheets API.
3. If the source file was uploaded from Excel and is being edited in Drive, also enable the Google Drive API.
4. Create a service account.
5. Download the JSON key, then map its values into env vars.
6. Share the target spreadsheet or Drive workbook with the service-account email as `Viewer` for phase 1.
7. Put the spreadsheet id or full URL into `GOOGLE_SHEETS_SPREADSHEET_ID`.
8. Run the validator:

```bash
node --env-file=.env.local scripts/validate-google-sheet.mjs
```

## Sheet structure
See [docs/google-sheets-template.md](docs/google-sheets-template.md).

The normalization layer already tolerates multiple English/Russian aliases, so you can launch read-only mode before doing a perfect migration.

If the validator says that the source is a Drive-hosted workbook, the app will download and parse the workbook directly instead of relying on Sheets API value reads.

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
- the private route is marked `noindex, nofollow`
- `robots.txt` disallows the private dashboard prefix
- simple in-memory rate limiting is enabled for auth and data routes

## Add new price providers
1. Create a provider in `src/lib/providers`.
2. Keep the provider focused on one asset class.
3. Return normalized typed positions and warnings.
4. Wire the provider into `src/lib/portfolio/build-portfolio.ts`.
5. Document new env vars in `.env.example` and `README.md`.

## What still needs to be done for full auto-tracking
- CS2 live pricing adapter with Steam Market / CSFloat / Pricempire / Buff integration
- real liquidity signals for CS2 instead of the current heuristic risk scoring
- Telegram Gifts external price discovery or OTC pricing feed
- write-back admin mode for editing positions directly from the dashboard
- transaction history charts and performance-over-time analytics
- durable cache/rate limit storage via Redis or similar for multi-instance production

## Verification commands
```bash
npm run typecheck
npm run lint
npm run build
```
