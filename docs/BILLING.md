# Billing

## Scope
Stage 25 adds the first hosted SaaS billing surface:
- Stripe Checkout
- Stripe Customer Portal
- webhook sync back into PostgreSQL
- plan catalog with feature envelopes
- billing page at `/app/billing`

The current implementation keeps the legacy private dashboard untouched.

## Plans
Current catalog:
- `Free`
- `Pro`
- `Whale`
- `Team`

Current feature envelopes shown in the UI:
- portfolio count
- positions count
- integrations count
- price refresh lane
- alerts count
- history retention window

Important:
- Stage 25 defines the plan catalog and exposes usage vs limits.
- Stage 26 is where these limits become hard write-time gates.

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

## Current limitations
- Seat management is still basic; `seatCount` is stored, but no UI for seat provisioning exists yet.
- Paid plan changes for already-active paid subscriptions should go through Customer Portal.
- Hard plan enforcement on write operations is intentionally deferred to Stage 26.