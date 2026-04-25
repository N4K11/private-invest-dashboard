# Project Overview

## Purpose
This project started as a private investment terminal for tracking CS2 items, Telegram Gifts and crypto positions from Google Sheets or a Drive-hosted workbook. It now also has a defined migration path toward a multi-tenant SaaS platform while preserving the existing private production flow.

## Current Runtime Architecture
- `src/app`: App Router pages, SaaS auth routes, protected `/app` pages, Import Center routes, alerts routes and private API routes.
- `src/components/dashboard`: UI blocks for cards, charts, tables, admin drawers and health views.
- `src/components/app`: SaaS workspace, portfolio, import and alerts UI.
- `src/lib/sheets`: Google Sheets / Drive workbook access, schema validation, normalization and write-back.
- `src/lib/db`: typed database configuration helpers and Prisma 7 lazy client for the SaaS runtime.
- `src/lib/imports`: import preview, deduplication, parsing and commit services for the SaaS Import Center.
- `src/lib/auth`: Auth.js credentials config, password helpers, registration bootstrap and workspace context access.
- `src/lib/saas`: DB-backed workspace, portfolio, manual asset, analytics, alerts, billing and deterministic insights services for the SaaS runtime.
- `src/lib/notifications`: email provider abstraction for alerts and future outbound channels.
- `src/lib/portfolio`: portfolio assembly, transaction accounting, metrics and risk analytics.
- `src/lib/providers`: external price providers for crypto, CS2 and Telegram gifts.
- `src/lib/cache`: in-memory cache with optional Redis REST shared cache.
- `src/lib/security`: token validation, rate limiting and secure HTTP response helpers.
- `src/types`: shared TypeScript contracts for portfolio, SaaS and health payloads.
- `prisma/schema.prisma`: PostgreSQL schema for the future SaaS data model, including alerts.
- `prisma.config.ts`: Prisma 7 datasource and migration configuration.

## Current Data Flow
1. A private API route requests source data from `src/lib/sheets`.
2. The reader selects native Google Sheets access or Drive workbook fallback.
3. Raw tabs are normalized into a canonical portfolio shape.
4. `src/lib/portfolio/build-portfolio.ts` enriches positions with provider prices, PnL, ROI, risk metrics and historical aggregates.
5. The API returns a `PortfolioSnapshot` to the React dashboard.
6. The frontend renders summary cards, tables, charts, risk panels and admin drawers from the snapshot.
7. In SaaS mode, PostgreSQL-backed `/app` pages use Prisma entities, the unified price engine, portfolio analytics and the alerts service.

## Current Security Flow
1. The legacy dashboard lives behind a secret route defined by `PRIVATE_DASHBOARD_SLUG`.
2. Page access requires `DASHBOARD_SECRET_TOKEN` through the lock screen or query token.
3. Private API routes validate the same token and apply rate limiting.
4. Responses are returned with `no-store`, `X-Robots-Tag`, CSP and related hardening headers.
5. SaaS routes `/app` are protected by Auth.js JWT sessions and middleware redirects to `/login` when the session is missing.
6. Active workspace selection is stored in an `httpOnly` cookie and scopes `/app` portfolio management pages.
7. Workspace and portfolio CRUD flows through protected `/api/app/*` routes with auth, permissions and validation.
8. Shareable read-only links use dedicated `/share/[shareToken]` pages and share-specific `httpOnly` access cookies for password-protected public views.
9. Shared portfolio pages never call the private API; they resolve and mask data server-side before rendering.
10. SaaS valuation flows through a unified price engine that resolves quotes by asset class and persists `PriceSnapshot` rows.
11. SaaS alert checks are exposed via `/api/app/alerts/evaluate` and `/api/cron/alerts`, while scheduling itself stays outside the app runtime.
12. SaaS billing routes `/api/app/billing/*` require auth + workspace permissions, while `/api/webhooks/stripe` stays public but verifies the Stripe signature before any subscription sync happens.
13. Secrets stay server-side in env variables and are never returned to the client bundle.

## Current Persistence Model
- Read path: Google Sheets API or Google Drive API + workbook parsing.
- Write path: admin actions write back to the source sheet/workbook and append `Audit_Log` rows.
- Historical snapshots are stored in `Portfolio_History`.
- Transaction-based accounting is stored in `Transactions`.
- Prisma/PostgreSQL powers SaaS auth, users, workspaces, portfolios, assets, transactions, snapshots, alerts and share links, while the private investment dashboard still reads portfolio data from Google Sheets / Drive workbook.

## SaaS Direction
The next architecture phase treats the current private dashboard as a legacy-compatible runtime inside a broader SaaS product.
- Database-backed SaaS entities will become the long-term source of truth.
- Google Sheets will remain supported as an integration adapter.
- The hidden-route private dashboard will stay alive during the migration.
- New SaaS auth routes `/login`, `/register`, `/app` coexist with the legacy token-gated mode instead of replacing it.
- Stage 16 adds workspace switching, portfolio management UI and DB-backed detail pages at `/app/portfolios/[portfolioId]`.
- Stage 17 adds `/app/import` with preview, mapping, deduplication and snapshot imports into PostgreSQL portfolios.
- Stage 18 adds a Manual Asset Manager on `/app/portfolios/[portfolioId]` with CRUD, audit logging and auto-generated buy/sell transactions.
- Stage 19 adds a unified SaaS price engine with provider contracts, confidence states, snapshot persistence and category-specific TTL handling.
- Stage 20 connects SaaS CS2 valuation to the shared provider chain with canonical name matching, stale warnings and optional FX fallback conversion for proxy quotes.
- Stage 21 adds a dedicated Telegram Gifts OTC pricing workflow with price history, review reminders and outlier detection on `/app/portfolios/[portfolioId]`.
- Stage 22 adds portfolio analytics v1 on the same SaaS detail page: history series, concentration analysis, top positions, realized/unrealized PnL and valuation explainability over positions + transactions + price snapshots.
- Stage 23 adds `/app/alerts` with `AlertRule`, `AlertEvent`, email provider abstraction and cron-ready alert evaluation routes.
- Stage 24 adds a prompt-safe AI Insights layer on `/app/portfolios/[portfolioId]` with deterministic summary, risk, liquidity, concentration, snapshot-change and valuation-quality commentary.
- Stage 25 adds `/app/billing`, Stripe Checkout, Stripe Customer Portal, signed webhook sync and plan envelopes for Free / Pro / Whale / Team.
- Stage 26 adds the centralized workspace limit service: portfolios, positions and alerts now have hard write-time gates, while price refresh and history retention are enforced through shared runtime helpers.
- Stage 27 adds shareable read-only portfolio links with scoped masking, optional password unlock, expiration and revoke flow, served from `/share/[shareToken]` without using the private API surface.
- The Prisma schema already models users, workspaces, portfolios, assets, positions, transactions, integrations, subscriptions, audit logs and alerts for upcoming stages.

## Operational Notes
- If the service account has only `Viewer`, the dashboard stays read-only.
- Full admin mode requires `Editor` access on the source spreadsheet/workbook.
- `scripts/validate-google-sheet.mjs` validates source structure against the canonical schema.
- `scripts/verify-client-bundle.mjs` checks that secrets do not leak into client bundles.
- Prisma commands require `DATABASE_URL`; `DIRECT_URL` remains optional for future split-connection setups, but the current legacy dashboard runtime does not require either.
- SaaS alert delivery can be tested with `ALERT_EMAIL_PROVIDER=noop` before enabling a real email provider.

## Main Docs
- `README.md`: setup, env, deployment and provider guidance.
- `DEPLOYMENT.md`: production deployment notes.
- `docs/google-sheets-template.md`: canonical sheet layout.
- `docs/SAAS_ARCHITECTURE.md`: target SaaS domain model and architectural boundaries.
- `docs/MIGRATION_PRIVATE_TO_SAAS.md`: staged migration path from legacy private mode to SaaS.
- `docs/DATABASE.md`: Prisma/PostgreSQL models, commands and migration notes.
- `docs/IMPORTS.md`: supported import sources, deduplication and manual test flow.
- `docs/PRICE_ENGINE.md`: unified SaaS valuation engine, providers, TTL rules and snapshot behavior.
- `docs/TELEGRAM_GIFTS_PRICING.md`: SaaS Telegram Gifts OTC pricing workflow and review rules.
- `docs/ALERTS.md`: SaaS alert rules, email delivery and cron setup.
- `docs/AI_INSIGHTS.md`: deterministic insights layer, prompt-safe context and future LLM extension point.
- `docs/BILLING.md`: Stripe billing setup, webhook behavior and local Stripe CLI flow.
- `docs/SHARING.md`: shareable read-only portfolio links, password flow, masking scopes and revoke/expiry rules.
