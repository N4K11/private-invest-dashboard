# Migration: Private Dashboard to SaaS

## Goal
Move from the current private Google-Sheets-driven dashboard to a database-backed SaaS platform in safe, reversible steps.

## Migration Principles
- Do not break the current production private dashboard.
- Add new SaaS capabilities in parallel.
- Prefer explicit import/bootstrap flows over hidden automatic migration.
- Keep Google Sheets as a supported integration, not as the long-term core persistence model.
- Every migration step must end with typecheck, lint, build and bundle verification.

## Starting Point
The current production app already provides:
- private hidden-route access;
- token-gated dashboard access;
- Google Sheets and Drive workbook reads;
- optional write-back for legacy mode;
- portfolio analytics, pricing adapters, history, admin mode and health tooling.

## Target End State
The target SaaS application should provide:
- user accounts and sessions;
- workspaces and roles;
- database-backed portfolios and transactions;
- import/sync adapters for Google Sheets, CSV, JSON and future APIs;
- billing and subscription plans;
- legacy private dashboard mode as an optional compatibility surface.

## Migration Path

### Step 1. Architecture freeze
- Document the target SaaS model.
- Define the domain entities and ownership rules.
- Keep current runtime behavior unchanged.

### Step 2. Database foundation
- Add PostgreSQL and ORM schema.
- Introduce tables for users, workspaces, memberships, portfolios, assets, positions, transactions, integrations, subscriptions and audit logs.
- No automatic production backfill yet.

### Step 3. Authentication and app shell
- Add Auth.js or equivalent self-hosted auth.
- Protect `/app` routes with authenticated sessions.
- Keep `/invest-dashboard/[dashboardSlug]` alive as legacy mode.

### Step 4. Workspace and portfolio layer
- Create workspace selection, portfolio CRUD and role-aware access.
- Add database-backed empty states before full integration sync is enabled.

### Step 5. Integration center
- Convert Google Sheets into an integration record with encrypted config.
- Add import preview, validation and sync status.
- Add support for additional sources without changing portfolio calculations.

### Step 6. Portfolio sync and canonical persistence
- Import external records into canonical database entities.
- Store positions and transactions in PostgreSQL.
- Keep raw import metadata and sync history for reconciliation.

### Step 7. Shared views and billing
- Add plan limits, billing state and view-only sharing.
- Reuse current private mode as a compatibility or premium sharing option if needed.

## How the Current Google Sheets Mode Fits the SaaS
The current Google Sheets mode becomes a legacy-friendly integration adapter.

### Before migration
- Google Sheets is both the data source and practical source of truth for one deployment.

### During migration
- A workspace owner creates a portfolio.
- The owner attaches a `google_sheets` integration.
- The app validates structure and previews mapped records.
- The user explicitly launches an import/bootstrap step.

### After migration
- PostgreSQL becomes the source of truth for the SaaS portfolio.
- Google Sheets can continue as:
  - periodic import source;
  - optional sync source;
  - optional write-back target for users who still need spreadsheet parity.

## Recommended Bootstrap Flow for the Existing Owner
1. Create the first workspace in the SaaS app.
2. Create a portfolio inside that workspace.
3. Register the existing spreadsheet/workbook as a `google_sheets` or `google_drive_workbook` integration.
4. Run a preview and validation pass.
5. Execute an explicit bootstrap import into database tables.
6. Compare totals, positions and transaction counts against the legacy dashboard.
7. Keep the legacy private route online until parity is accepted.

## Data Ownership After Migration
- Users, workspaces, memberships and subscriptions: database only.
- Portfolios, assets, positions, transactions and audit log: database first.
- Integration credentials and sync state: database with encrypted secrets.
- Provider caches and snapshots: database and cache layer.
- Legacy sheet/workbook data: external source connected through integrations.

## Cutover Strategy
- Stage the SaaS features behind `/app`.
- Keep the private dashboard running from its current route.
- Validate parity on the same data before encouraging usage of the SaaS interface.
- Only consider de-emphasizing the legacy route after the SaaS portfolio detail page reaches practical feature parity.

## What Should Not Be Automated Yet
- Implicit migration of all existing spreadsheet rows into the database on deploy.
- Silent replacement of the hidden token route with authenticated SaaS routes.
- Automatic deletion of legacy sheets, workbook tabs or fallback adapters.

## Production Checklist for Future Stages
- Database provisioned and backed up.
- Auth secrets configured.
- Workspace and portfolio authorization verified.
- Integration credentials encrypted and scoped.
- Audit logging enabled for privileged mutations.
- Legacy route smoke-tested after each SaaS stage.
