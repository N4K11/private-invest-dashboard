# Database Foundation

## Purpose
This document describes the PostgreSQL + Prisma foundation for the SaaS version of the project.

Important: the current production private dashboard still runs on the legacy Google Sheets / Drive workbook flow. The database layer added in this stage is a foundation for future SaaS routes and does not replace the current production source of truth yet.

## Stack Choice
- Database: PostgreSQL
- ORM: Prisma
- Seed runner: `node prisma/seed.mjs`

Prisma was chosen because it gives fast schema iteration, strong generated types and a clear migration workflow for the next SaaS stages.

## Files Added in This Stage
- `prisma/schema.prisma`
- `prisma/seed.mjs`
- `prisma.config.ts`
- `src/lib/db/config.ts`
- `docs/DATABASE.md`

## Models

### User
SaaS identity root.
- unique email
- display name, locale, timezone
- owner/member relations to workspaces

### Workspace
Top-level tenant boundary.
- unique slug
- owner relation
- currency/timezone defaults
- portfolios, integrations, assets, subscription, audit logs

### WorkspaceMember
Workspace membership and role mapping.
- one user per workspace membership
- roles: `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`

### Portfolio
Tracked asset container inside a workspace.
- unique slug per workspace
- base currency
- visibility
- risk profile
- optional legacy private slug bridge

### Asset
Canonical asset record within a workspace.
- category: CS2 / Telegram / Crypto / Custom / NFT
- normalized key for deduplication
- provider metadata for future sync and matching

### Position
Current aggregated holding state per `(portfolio, asset)` pair.
- quantity
- average entry price
- current/manual price
- price source
- notes and metadata

### Transaction
Append-only portfolio event stream.
- buy, sell, transfer, price update, fee, adjustment
- quantity, unit price, fees, currency
- external reference for import deduplication

### PriceSnapshot
Historical valuation points.
- price
- source
- capture time
- confidence/metadata

### Integration
External source binding.
- Google Sheets
- Drive workbook
- CSV
- JSON
- Steam import
- future connectors

### Subscription
Workspace billing state.
- plan, status, seats and billing provider metadata

### AuditLog
Append-only event history for privileged changes, syncs and system actions.

## Current Schema Notes
- table names are mapped to plural SQL tables such as `users`, `workspaces`, `transactions`
- the schema is intentionally SaaS-first, even though runtime routes are still legacy-first today
- Google Sheets is modeled as an integration type, not as the permanent persistence layer
- no automatic migration from legacy spreadsheet rows is performed in this stage

## Environment Variables
Add `DATABASE_URL` before using Prisma commands. `DIRECT_URL` is kept in `.env.example` as an optional reserved variable for future split-connection setups, but the current Prisma 7 config foundation uses `DATABASE_URL` directly via `prisma.config.ts`.

Recommended local example:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/private_invest_dashboard?schema=public
# DIRECT_URL=postgresql://postgres:postgres@localhost:5432/private_invest_dashboard?schema=public
```

## Prisma 7 Configuration
Connection configuration now lives in prisma.config.ts, while prisma/schema.prisma contains only the provider and the data model.

## Commands
### Format and validate schema
```bash
npm run db:format
npm run db:validate
```

### Generate Prisma client
```bash
npm run db:generate
```

### Create local development migration
```bash
npm run db:migrate:dev -- --name init_saas_foundation
```

### Push schema without a named migration
```bash
npm run db:push
```

### Seed demo data
```bash
npm run db:seed
```

### Open Prisma Studio
```bash
npm run db:studio
```

## Seed Behavior
`prisma/seed.mjs` is idempotent enough for a local demo bootstrap.
It creates:
- a demo owner user
- a demo workspace
- a demo portfolio
- a demo Google Sheets integration
- a demo BTC asset/position
- a demo buy transaction
- a demo price snapshot
- a free subscription
- an audit log row

Do not run the demo seed in production unless you explicitly want sample data there.

## Production Migration Commands
When PostgreSQL is provisioned in production and SaaS runtime routes are ready:

```bash
npm run db:generate
npm run db:migrate:deploy
```

Optional only for sandbox/demo environments:

```bash
npm run db:seed
```

## What This Stage Does Not Do
- it does not switch the dashboard from Google Sheets to PostgreSQL
- it does not migrate current user spreadsheet data into the database automatically
- it does not introduce auth, sessions or workspace UI yet
- it does not require `DATABASE_URL` for the current legacy private dashboard runtime