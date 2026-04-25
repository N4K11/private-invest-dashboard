# Project Overview

## Purpose
This project is a private investment terminal for tracking CS2 items, Telegram Gifts and crypto positions from Google Sheets or a Drive-hosted workbook. It is designed for a hidden route plus token-gated access rather than public discovery.

## Architecture
- `src/app`: App Router pages and private API routes.
- `src/components/dashboard`: UI blocks for cards, charts, tables, admin drawers and health views.
- `src/lib/sheets`: Google Sheets / Drive workbook access, schema validation, normalization and write-back.
- `src/lib/portfolio`: portfolio assembly, transaction accounting, metrics and risk analytics.
- `src/lib/providers`: external price providers for crypto, CS2 and Telegram gifts.
- `src/lib/cache`: in-memory cache with optional Redis REST shared cache.
- `src/lib/security`: token validation, rate limiting and secure HTTP response helpers.
- `src/types`: shared TypeScript contracts for portfolio and health payloads.

## Data Flow
1. A private API route requests source data from `src/lib/sheets`.
2. The reader selects native Google Sheets access or Drive workbook fallback.
3. Raw tabs are normalized into a canonical portfolio shape.
4. `src/lib/portfolio/build-portfolio.ts` enriches positions with provider prices, PnL, ROI, risk metrics and historical aggregates.
5. The API returns a `PortfolioSnapshot` to the React dashboard.
6. The frontend renders summary cards, tables, charts, risk panels and admin drawers from the snapshot.

## Security Flow
1. The dashboard lives behind a secret route defined by `PRIVATE_DASHBOARD_SLUG`.
2. Page access requires `DASHBOARD_SECRET_TOKEN` through the lock screen or query token.
3. Private API routes validate the same token and apply rate limiting.
4. Responses are returned with `no-store`, `X-Robots-Tag`, CSP and related hardening headers.
5. Secrets stay server-side in env variables and are never returned to the client bundle.

## Pricing Model
- Crypto: live pricing through CoinGecko with sheet/manual fallback.
- CS2: provider chain with Steam first, optional proxy adapters and manual sheet fallback.
- Telegram Gifts: manual workflow with TON conversion, confidence labels and stale-price detection.

## Persistence Model
- Read path: Google Sheets API or Google Drive API + workbook parsing.
- Write path: admin actions write back to the source sheet/workbook and append `Audit_Log` rows.
- Historical snapshots are stored in `Portfolio_History`.
- Transaction-based accounting is stored in `Transactions`.

## Operational Notes
- If the service account has only `Viewer`, the dashboard stays read-only.
- Full admin mode requires `Editor` access on the source spreadsheet/workbook.
- `scripts/validate-google-sheet.mjs` validates source structure against the canonical schema.
- `scripts/verify-client-bundle.mjs` checks that secrets do not leak into client bundles.

## Main Docs
- `README.md`: setup, env, deployment and provider guidance.
- `DEPLOYMENT.md`: production deployment notes.
- `docs/google-sheets-template.md`: canonical sheet layout.
