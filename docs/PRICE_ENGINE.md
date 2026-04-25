# PRICE_ENGINE

## Purpose
The SaaS runtime now uses a unified price engine for portfolio valuation. It resolves quotes per asset category, normalizes confidence status, stores `PriceSnapshot` rows in PostgreSQL and keeps provider-specific TTL behavior isolated from the UI.

## Scope
This layer currently powers the SaaS database-backed pages under `/app`:
- `/app`
- `/app/portfolios`
- `/app/portfolios/[portfolioId]`

The legacy private dashboard under `/invest-dashboard/[slug]` is not replaced by this module and continues to use the existing Google Sheets / workbook pricing flow.

## Location
Core files:
- `src/lib/saas/price-engine/types.ts`
- `src/lib/saas/price-engine/utils.ts`
- `src/lib/saas/price-engine/engine.ts`
- `src/lib/saas/portfolio-pricing.ts`

Providers:
- `src/lib/saas/price-engine/providers/crypto-provider.ts`
- `src/lib/saas/price-engine/providers/cs2-provider.ts`
- `src/lib/saas/price-engine/providers/telegram-provider.ts`
- `src/lib/saas/price-engine/providers/custom-provider.ts`

## Provider model
Each provider implements the same `SaasPriceProvider` contract:
- receives normalized portfolio positions for one or more categories
- returns resolved quotes keyed by `positionId`
- returns warnings when a provider is degraded, manual-only or otherwise incomplete

Current providers:
- `crypto`: CoinGecko first, Binance fallback, then manual/imported/entry fallback
- `cs2`: manual/mock provider for now, with adapter slots reserved for future direct integrations
- `telegram`: manual / OTC pricing flow
- `custom`: manual pricing only

## Confidence statuses
Supported normalized statuses:
- `live_high`
- `live_medium`
- `manual_high`
- `manual_low`
- `stale`
- `unknown`

Meaning:
- `live_high`: live quote from the primary provider
- `live_medium`: live quote from a fallback provider
- `manual_high`: manual quote is fresh and operator confidence is acceptable
- `manual_low`: manual quote exists but confidence is weak
- `stale`: manual quote exists but is older than the configured freshness threshold
- `unknown`: no usable quote was resolved

## Snapshot persistence
Resolved prices are persisted into `PriceSnapshot` with:
- `portfolioId`
- `assetId`
- `capturedAt`
- `currency`
- `price`
- `source`
- `confidence`
- metadata such as `sourceId`, `sourceLabel`, `isLive`, provider TTL and warnings

The engine buckets `capturedAt` by TTL window so repeat page loads do not endlessly append duplicate snapshots. `createMany(... skipDuplicates: true)` is used against the unique key `(portfolioId, assetId, capturedAt, source)`.

## Cache policy
Current env controls:
- `SAAS_CRYPTO_PRICE_TTL_SECONDS`
- `SAAS_CS2_PRICE_TTL_SECONDS`
- `SAAS_TELEGRAM_PRICE_TTL_SECONDS`
- `SAAS_CUSTOM_PRICE_TTL_SECONDS`
- `SAAS_MANUAL_PRICE_STALE_HOURS`

Category-specific stale rules:
- CS2 manual freshness still uses `CS2_PRICE_STALE_HOURS`
- Telegram Gifts manual freshness still uses `TELEGRAM_PRICE_STALE_DAYS`
- other SaaS manual assets use `SAAS_MANUAL_PRICE_STALE_HOURS`

## UI contract
The SaaS portfolio position row now exposes:
- `priceConfidenceStatus`
- `priceUpdatedAt`
- `priceWarning`
- `priceSource`

This allows the UI to show:
- source label
- confidence badge
- stale / missing warnings
- last pricing timestamp

## Known limitations
Current limitations are intentional for this stage:
- no FX conversion between non-USD manual prices and workspace base currency
- CS2 provider is still manual/mock in SaaS mode
- Telegram provider is still manual/OTC in SaaS mode
- no scheduled snapshot job yet; snapshots are created during portfolio valuation requests

## Next extension points
Future stages can extend this layer by:
1. adding direct CSFloat / PriceEmpire / Steam adapters for SaaS positions
2. adding an external Telegram OTC or marketplace adapter
3. adding background snapshot jobs / cron refreshes
4. adding FX normalization for multi-currency SaaS portfolios
