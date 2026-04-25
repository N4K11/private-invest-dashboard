# Billing

## Scope
Stages 25-26 establish the hosted SaaS billing surface and the first real feature gates:
- Stripe Checkout
- Stripe Customer Portal
- webhook sync back into PostgreSQL
- plan catalog with feature envelopes
- centralized workspace limit service
- hard plan enforcement on selected write paths
- price refresh and history-retention gates tied to the active plan

The legacy private dashboard remains untouched.

## Plans
Current catalog:
- `Free`
- `Pro`
- `Whale`
- `Team`

Current feature envelopes:
- portfolio count
- positions count
- integrations count
- alerts count
- price refresh window
- history retention window

## Hard-enforced limits
Stage 26 moves limits from passive display into runtime enforcement.

### Count limits
Current write-time gates:
- `portfolios`
  - enforced in `POST /api/app/portfolios`
- `positions`
  - enforced in `POST /api/app/portfolios/[portfolioId]/positions`
  - enforced in `POST /api/app/import/commit` only for newly created positions, not for updates to already-existing ones
- `alerts`
  - enforced in `POST /api/app/alerts/rules`
- `integrations`
  - modeled in the centralized limit service already
  - hard create UI/API is not wired yet, so this limit is visible in billing and health data but not yet exercised by a public create route

When a hard cap is reached, the backend rejects the mutation with a limit error. Workspace-facing write routes return `409` for these cases.

### Price refresh gate
The unified SaaS price engine now respects the plan refresh window.

Behavior:
- if a fresh enough `PriceSnapshot` already exists for a position, the engine reuses it
- provider calls are skipped for quotes that are still inside the allowed refresh lane
- a warning is attached so the UI can explain that the price was reused from a recent snapshot

This gate is applied centrally in `src/lib/saas/price-engine/engine.ts` and affects SaaS valuation pages rather than only one route.

### History retention gate
The active plan also controls how much historical data is considered by SaaS read models.

Current places where history retention is applied:
- portfolio detail transaction history
- portfolio analytics queries over transactions and price snapshots
- Telegram Gifts price-update history on portfolio detail pages
- alerts history returned by `/app/alerts`
- portfolio evaluation context used during alert checks

Retention is computed via `getHistoryRetentionCutoffDate()` in `src/lib/saas/limits.ts`.

## Admin overrides
Subscription rows now support admin overrides for effective limits:
- `overrideLimitsEnabled`
- `overridePortfolioLimit`
- `overridePositionLimit`
- `overrideIntegrationLimit`
- `overrideAlertLimit`
- `overridePriceRefreshHours`
- `overrideHistoryRetentionDays`
- `overrideNotes`

Behavior:
- if overrides are disabled, the public plan envelope is used as-is
- if overrides are enabled, non-null override fields replace the plan defaults
- billing UI surfaces when an override is active
- limit warnings mention that effective limits may differ from the public plan

## Required env
Add these variables to `.env.local` / production secrets:

```bash
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
STRIPE_WHALE_PRICE_ID=
STRIPE_TEAM_PRICE_ID=
STRIPE_PORTAL_CONFIGURATION_ID=
```

Notes:
- `STRIPE_SECRET_KEY` is required for Checkout and Customer Portal.
- `STRIPE_WEBHOOK_SECRET` is required for secure webhook signature verification.
- `STRIPE_*_PRICE_ID` must point to recurring monthly subscription prices in Stripe.
- `STRIPE_PORTAL_CONFIGURATION_ID` is optional. If omitted, Stripe default portal configuration is used.
- `NEXTAUTH_URL` or `NEXT_PUBLIC_SITE_URL` should point to the correct app base URL so redirect links are stable.

## Routes
User-facing page:
- `/app/billing`

Protected SaaS API routes:
- `POST /api/app/billing/checkout`
- `POST /api/app/billing/portal`

Public Stripe webhook route:
- `POST /api/webhooks/stripe`

## Local development with Stripe CLI
Recommended local flow:

1. Start the app locally.
2. Start Stripe listen forwarding:

```bash
stripe listen --forward-to http://localhost:3000/api/webhooks/stripe
```

3. Copy the emitted webhook signing secret into:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

4. Open `/app/billing`.
5. Trigger Checkout for `Pro`, `Whale` or `Team`.
6. Confirm that the page redirects to Stripe Checkout.
7. After payment/test completion, watch webhook delivery in Stripe CLI.
8. Refresh `/app/billing` and confirm subscription status, current period and billing ids were synced.

## Webhook behavior
Handled events:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Synced fields in `subscriptions`:
- `plan`
- `status`
- `billingProvider`
- `billingCustomerId`
- `billingSubscriptionId`
- `seatCount`
- `currentPeriodStart`
- `currentPeriodEnd`
- `trialEndsAt`
- `cancelAtPeriodEnd`

Every successful sync also appends an `AuditLog` row.

## Customer Portal behavior
Customer Portal is available only after the workspace has a Stripe customer id.

In practice this means:
- first open Checkout for a paid plan
- let Stripe create the subscription/customer linkage
- after that, `/api/app/billing/portal` can open the management portal

## Safety notes
- No Stripe secrets are exposed to the client bundle.
- Checkout and portal routes are protected by SaaS auth + rate limit + workspace permissions.
- Webhook route verifies `stripe-signature` using `STRIPE_WEBHOOK_SECRET`.
- User-facing errors are sanitized and do not leak credentials.
- Hard limit decisions are made server-side; client-side banners are informational only.

## Current limitations
- Seat management is still basic; `seatCount` is stored, but no UI for seat provisioning exists yet.
- Paid plan changes for already-active paid subscriptions should go through Customer Portal.
- Integrations limit is already part of the central limit service, but an end-user integration-create flow is still a future stage.