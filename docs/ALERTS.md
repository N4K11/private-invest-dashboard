# Alerts & Notifications

## Scope
Stage 23 adds a SaaS alerts layer on top of PostgreSQL portfolios, unified pricing and analytics.

What is included:
- `AlertRule` and `AlertEvent` models in Prisma
- UI at `/app/alerts`
- alert types:
  - `price_above`
  - `price_below`
  - `portfolio_value_change`
  - `stale_price`
  - `concentration_risk`
- email delivery abstraction with `noop` and `resend`
- manual evaluation from the UI
- cron-ready route at `/api/cron/alerts`
- alert history in the same UI and in the database

What is not included yet:
- Telegram bot delivery
- background workers inside the app runtime
- websocket / real-time push notifications

## Environment variables
Add these values to `.env.local`:

```env
ALERT_EMAIL_PROVIDER=noop
ALERT_EMAIL_FROM=
ALERT_EMAIL_REPLY_TO=
RESEND_API_KEY=
ALERTS_CRON_SECRET=replace-with-a-random-cron-secret
```

Notes:
- `ALERT_EMAIL_PROVIDER=noop` keeps alert history working but skips real email delivery.
- `ALERT_EMAIL_PROVIDER=resend` enables real email sending.
- `ALERT_EMAIL_FROM` is required for `resend`.
- `RESEND_API_KEY` is required for `resend`.
- `ALERTS_CRON_SECRET` protects `/api/cron/alerts`.

## Supported rule types

### 1. Price above / price below
Use when you want a signal for a specific asset in a specific portfolio.

Required fields:
- portfolio
- asset
- threshold value

The engine compares the current resolved quote against the threshold.

### 2. Portfolio value change
Use when you want a signal after the portfolio moved by a percentage versus the previous history point.

Required fields:
- portfolio
- threshold percent
- direction: `up`, `down` or `either`

Important:
- the rule needs at least two history points to compare
- if history is still empty or only has the current point, the rule is evaluated but will not trigger yet

### 3. Stale price
Use when too many positions rely on stale manual quotes.

Required fields:
- optional portfolio, otherwise the whole workspace is used
- optional threshold value, default is `1`

The metric is the count of positions with `priceConfidenceStatus = stale`.

### 4. Concentration risk
Use when the largest position becomes too large relative to the portfolio.

Required fields:
- portfolio
- threshold percent

The current implementation uses `maxPositionWeight` from portfolio analytics.

## How to configure alerts in the UI
1. Open `/app/alerts`.
2. Choose the active workspace in the SaaS header if needed.
3. Create a rule in the `Rule editor` panel.
4. Set `recipientEmail`.
5. Save the rule.
6. Click `Проверить alerts сейчас` to force an evaluation.
7. Inspect `Alert history` below the rules list.

Roles:
- `owner` and `admin` can create, edit, pause, delete and manually evaluate rules
- `member` and `viewer` can only view rules and history

## Email provider behavior
### noop
The default provider.

Behavior:
- alert conditions are evaluated
- `AlertEvent` rows are created
- delivery status becomes `skipped`
- no external email API is called

This is useful for local testing and for environments where email is not configured yet.

### resend
Production email provider for Stage 23.

Behavior:
- the app sends a POST request to the Resend API
- delivered emails are stored as `AlertEvent.status = delivered`
- API failures are stored as `failed`

## Manual evaluation route
The UI button calls:

```text
POST /api/app/alerts/evaluate
```

JSON body:

```json
{
  "workspaceId": "your-workspace-id"
}
```

The route requires a valid SaaS session and `owner/admin` permissions.

## Cron route
The app does not create internal infinite loops or background jobs.
Scheduling must be done outside the Next.js runtime.

Route:

```text
GET /api/cron/alerts
POST /api/cron/alerts
```

Authentication:
- `Authorization: Bearer <ALERTS_CRON_SECRET>`
- or header `x-cron-secret: <ALERTS_CRON_SECRET>`

### Evaluate all workspaces with active rules
```bash
curl -X GET https://your-domain.com/api/cron/alerts \
  -H "Authorization: Bearer YOUR_ALERTS_CRON_SECRET"
```

### Evaluate one workspace
```bash
curl -X GET "https://your-domain.com/api/cron/alerts?workspaceId=ws_123" \
  -H "Authorization: Bearer YOUR_ALERTS_CRON_SECRET"
```

### POST version with explicit workspace list
```bash
curl -X POST https://your-domain.com/api/cron/alerts \
  -H "Authorization: Bearer YOUR_ALERTS_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"workspaceIds":["ws_123","ws_456"]}'
```

## Vercel Cron setup
Example idea:
- create a cron entry that hits `/api/cron/alerts`
- send `Authorization: Bearer <ALERTS_CRON_SECRET>`
- typical frequency: every 15 minutes or every hour, depending on your alert sensitivity and provider limits

Recommended starting cadence:
- `price_above` / `price_below`: every 15-30 minutes
- `portfolio_value_change`: hourly
- `stale_price`: daily
- `concentration_risk`: hourly or daily

## VPS cron setup
Example cron on a Node/VPS host:

```bash
*/30 * * * * curl -fsS https://your-domain.com/api/cron/alerts -H "Authorization: Bearer YOUR_ALERTS_CRON_SECRET" >/dev/null
```

For daily stale/concentration checks, a second daily cron is also fine.

## Audit and history
Every important action writes to the database:
- `alert.rule.create`
- `alert.rule.update`
- `alert.rule.delete`
- `alert.evaluate`
- `alert.triggered`

Triggered events are stored in `AlertEvent` and rendered in `/app/alerts`.

## Operational notes
- If `recipientEmail` is empty, the trigger is stored as `skipped`.
- Cooldown prevents duplicate notifications from firing too frequently.
- `portfolio_value_change` depends on historical data quality.
- `stale_price` and `concentration_risk` reuse the same analytics layer as `/app/portfolios/[portfolioId]`.
- The route is cron-ready, but scheduling is your responsibility.
