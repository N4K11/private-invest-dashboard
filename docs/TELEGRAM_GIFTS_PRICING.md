# Telegram Gifts Pricing

## Purpose
Telegram Gifts do not have a stable official live-pricing API in this project. For that reason the SaaS `/app` runtime uses a manual / OTC workflow instead of pretending that quotes are live.

## What is stored
Each Telegram Gift price update writes data into two places:

1. `Position.metadata.manualAsset`
- `priceSource`: one of `fragment`, `otc_deal`, `marketplace_listing`, `manual_estimate`
- `confidence`: `high`, `medium`, `low`
- `lastVerifiedAt`: ISO timestamp for the last operator review
- `priceNotes`: short note about the quote
- `lastEditedAt`: internal timestamp of the last metadata write

2. `Transaction` with `action=PRICE_UPDATE`
- `unitPrice`
- `currency`
- `notes`
- metadata with the same price context plus outlier information

This gives the app both a current quote and a historical event stream.

## How to update a price
1. Open `/app/portfolios/[portfolioId]`.
2. In the `Telegram Gifts / OTC pricing workflow` block choose a gift.
3. Click `Обновить цену`.
4. Fill in:
- price
- currency
- source (`Fragment`, `OTC deal`, `Marketplace listing`, `Manual estimate`)
- confidence
- `lastVerifiedAt`
- optional note
5. Save.

The app will:
- update the current manual price on the position
- append a `PRICE_UPDATE` transaction
- keep the price history visible on the same page
- create an audit log entry
- show an outlier warning if the new quote deviates too much from the previous one

## Confidence model
Current quote status is derived from two inputs:

1. Manual confidence from the operator
- `high` or `medium` means the quote is eligible for `manual_high`
- `low` means the quote is eligible for `manual_low`

2. Freshness of `lastVerifiedAt`
- if there is no usable price: status becomes `unknown`
- if `lastVerifiedAt` is older than `TELEGRAM_PRICE_STALE_DAYS`: status becomes `stale`
- otherwise the manual confidence decides whether the quote is treated as `manual_high` or `manual_low`

This means a `high` confidence quote can still become `stale` if it is not reviewed on time.

## Review reminders
A Telegram Gift is marked as needing review when any of these is true:
- there is no current price
- `lastVerifiedAt` is older than the configured stale window
- the quote is marked as `low` confidence

These reminders appear in the Telegram pricing panel and also feed portfolio warnings.

## Outlier detection
Each new Telegram price update is compared with the previous known quote.

Current rule:
- if the absolute deviation is `>= 35%`, the update is flagged as an outlier

Outlier handling:
- the update is still saved
- the transaction history row is marked with an outlier message
- the portfolio detail page surfaces the warning for the gift
- the audit log severity becomes `WARNING`

This is intentional: OTC markets can move sharply, so the system warns instead of blocking the update.

## Why this is not live pricing
The Telegram provider in the SaaS price engine is explicitly manual / OTC:
- it never claims live execution from an official market API
- it uses the operator-maintained quote plus freshness rules
- warnings are shown when verification is overdue

## Related files
- `src/lib/saas/telegram-gift-pricing.ts`
- `src/lib/saas/price-engine/providers/telegram-provider.ts`
- `src/components/app/telegram-gift-pricing-panel.tsx`
- `src/app/api/app/portfolios/[portfolioId]/positions/[positionId]/telegram-price/route.ts`
