# PRICE_ENGINE

## Purpose
The SaaS runtime uses a unified price engine for portfolio valuation. It resolves quotes per asset category, normalizes confidence status, stores `PriceSnapshot` rows in PostgreSQL and keeps provider-specific TTL behavior isolated from the UI.

## Scope
This layer currently powers the database-backed SaaS pages under `/app`:
- `/app`
- `/app/portfolios`
- `/app/portfolios/[portfolioId]`

The legacy private dashboard under `/invest-dashboard/[slug]` still uses the existing Google Sheets / workbook flow and is not replaced by this module.

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

Shared CS2 provider chain reused by both legacy and SaaS:
- `src/lib/providers/cs2/provider-registry.ts`
- `src/lib/providers/cs2/types.ts`
- `src/lib/providers/cs2/utils.ts`
- `src/lib/providers/cs2/providers/*.ts`

## Provider model
Each provider implements the same `SaasPriceProvider` contract:
- receives normalized portfolio positions for one or more categories
- returns resolved quotes keyed by `positionId`
- returns warnings when a provider is degraded, manual-only or otherwise incomplete

Current providers:
- `crypto`: CoinGecko first, Binance fallback, then manual/imported/entry fallback
- `cs2`: real provider chain based on the shared CS2 adapters
- `telegram`: manual / OTC pricing flow
- `custom`: manual pricing only

## CS2 coverage
The SaaS CS2 provider now reuses the shared provider chain instead of a manual/mock stub.

What is really live:
- `steam_market_live`: real Steam Community Market search + matching
- `buff_proxy_live`: real external proxy quotes if `CS2_BUFF_PROXY_URL` is configured and returns fresh data

What is not live:
- `cs2_manual`: manual price from portfolio data
- `imported_price`: imported quote stored on the position
- `entry_price_fallback`: fallback to average entry price
- `csfloat_live` / `pricempire_live`: source ids are reserved for future direct adapters; current shells do not fake live quotes without a real integration

### Shared CS2 contract
The shared `Cs2ResolvedPriceQuote` now carries:
- `currency`
- `matchedName`
- `canonicalName`
- `lastUpdated`
- `liquidityLabel`
- `liquidityDepth`

This is used by both the private dashboard and the SaaS price engine.

### Canonical name normalization
CS2 matching now normalizes:
- wear aliases like `FN`, `MW`, `FT`, `WW`, `BS`
- common prefixes like `StatTrak` and `Souvenir`
- duplicated punctuation / spacing noise

The provider chain always builds a canonical target name before searching Steam or proxy sources.

### Currency conversion
Built-in Steam quotes are requested in `USD`.

For proxy quotes:
- if the proxy returns `currency`, the SaaS engine attempts conversion into the portfolio base currency
- if the proxy omits `currency`, the engine assumes the quote is already in the portfolio base currency
- if conversion is needed and no FX fallback exists, the engine does **not** claim a converted live quote and drops back to manual/missing pricing with a warning

FX fallback config:
- `CS2_FX_FALLBACK_RATES_JSON`

Expected format:
```json
{"USD":1,"EUR":1.08,"RUB":0.0109}
```

Meaning: each value is the USD value of `1` unit of that currency.

## Confidence statuses
Supported normalized statuses:
- `live_high`
- `live_medium`
- `manual_high`
- `manual_low`
- `stale`
- `unknown`

Meaning:
- `live_high`: live quote from the primary provider with strong matching
- `live_medium`: live quote from a fallback provider or weaker match
- `manual_high`: manual quote is fresh and operator confidence is acceptable
- `manual_low`: manual quote exists but confidence is weak
- `stale`: quote exists but is older than the configured freshness threshold
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
- metadata such as `sourceId`, `sourceLabel`, `lastUpdated`, `matchedName`, `canonicalName`, liquidity fields, provider TTL and warnings

The engine buckets `capturedAt` by TTL window so repeat page loads do not endlessly append duplicate snapshots. `createMany(... skipDuplicates: true)` is used against the unique key `(portfolioId, assetId, capturedAt, source)`.

## Cache policy
Current env controls:
- `SAAS_CRYPTO_PRICE_TTL_SECONDS`
- `SAAS_CS2_PRICE_TTL_SECONDS`
- `SAAS_TELEGRAM_PRICE_TTL_SECONDS`
- `SAAS_CUSTOM_PRICE_TTL_SECONDS`
- `SAAS_MANUAL_PRICE_STALE_HOURS`
- `CS2_PRICE_STALE_HOURS`

Category-specific stale rules:
- CS2 quotes use `CS2_PRICE_STALE_HOURS`
- Telegram Gifts use `TELEGRAM_PRICE_STALE_DAYS`
- other SaaS manual assets use `SAAS_MANUAL_PRICE_STALE_HOURS`

## UI contract
The SaaS portfolio position row exposes:
- `priceSource`
- `priceConfidenceStatus`
- `priceUpdatedAt`
- `priceWarning`
- `liquidity` fallback from provider estimate when the operator did not set a manual liquidity label

This allows the UI to show:
- source label
- confidence badge
- stale / missing warnings
- last pricing timestamp from the provider or manual source
- liquidity estimate for CS2 even when no manual label was entered

## Proxy contract
Optional proxy env:
- `CS2_BUFF_PROXY_URL`
- `CS2_BUFF_PROXY_TOKEN`

Expected response shape:
```json
{
  "items": [
    {
      "assetName": "AWP | Dragon Lore (Factory New)",
      "matchedName": "AWP | Dragon Lore (Factory New)",
      "canonicalName": "AWP | Dragon Lore (Factory New)",
      "price": 12345.67,
      "currency": "USD",
      "confidence": "high",
      "liquidityLabel": "high",
      "liquidityDepth": 142,
      "lastUpdated": "2026-04-25T12:00:00.000Z",
      "warning": null
    }
  ]
}
```

## Known limitations
Current limitations are intentional for this stage:
- direct `CSFloat` and `PriceEmpire` adapters are still shells until a real integration path is selected
- no background snapshot scheduler yet; snapshots are created during valuation requests
- proxy currency conversion depends on `CS2_FX_FALLBACK_RATES_JSON` when the quote is not already in the portfolio base currency
- Telegram and custom assets still use manual workflows

## Next extension points
Future stages can extend this layer by:
1. adding direct CSFloat / PriceEmpire adapters with real auth and quotas
2. adding an external Telegram OTC or marketplace adapter
3. adding background snapshot jobs / cron refreshes
4. adding full multi-currency FX normalization beyond the CS2 proxy fallback map
