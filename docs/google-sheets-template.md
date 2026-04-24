# Google Sheets template

The dashboard now supports two modes at the same time:

1. Canonical structure: the long-term schema the project expects going forward.
2. Legacy compatibility: older workbooks such as `CS2 Assets` / `Telegram Gifts` still load in read-only mode.

If you are building or migrating the spreadsheet now, use the canonical structure below.

## Canonical tabs
- `Summary`
- `CS2_Positions`
- `Telegram_Gifts`
- `Crypto`
- `Transactions`
- `Portfolio_History`
- `Settings`
- `Audit_Log`

## Required columns

### `Summary`
- `metric`
- `value`

### `CS2_Positions`
- `id`
- `assetType`
- `assetName`
- `category`
- `quantity`
- `entryPrice`
- `manualCurrentPrice`
- `currentPrice`
- `priceSource`
- `currency`
- `status`
- `notes`
- `lastUpdated`

Optional but supported:
- `wear`
- `rarity`
- `riskScore`
- `liquidityLabel`
- `market`

### `Telegram_Gifts`
- `id`
- `giftName`
- `collection`
- `quantity`
- `entryPrice`
- `manualCurrentPrice`
- `currentPrice`
- `priceConfidence`
- `liquidityNote`
- `status`
- `notes`
- `lastUpdated`

Optional but supported:
- `price_ton`
- `total_ton`

### `Crypto`
- `id`
- `symbol`
- `name`
- `quantity`
- `entryPrice`
- `currentPrice`
- `priceSource`
- `walletNote`
- `status`
- `notes`
- `lastUpdated`

Optional but supported:
- `currency`

### `Transactions`
- `id`
- `date`
- `assetType`
- `assetName`
- `action`
- `quantity`
- `price`
- `fees`
- `currency`
- `notes`

Recommended `action` values:
- `buy`
- `sell`
- `transfer`
- `price_update`
- `fee`

### `Portfolio_History`
- `date`
- `totalValue`
- `cs2Value`
- `telegramValue`
- `cryptoValue`
- `totalPnl`
- `notes`

### `Settings`
- `key`
- `value`

Recommended keys:
- `currency`
- `owner_label`

### `Audit_Log`
- `date`
- `userAction`
- `entityType`
- `entityId`
- `before`
- `after`
- `notes`

## Legacy compatibility
The read-only dashboard still accepts these older layouts:
- `CS2 Assets` as an alias for `CS2_Positions`
- `Telegram Gifts` as an alias for `Telegram_Gifts`
- legacy price fields like `average_entry_price`, `current_price`, `estimated_price`, `price_ton`
- legacy naming columns like `name`, `gift`, `item_name`, `ticker`

This keeps the current workbook working while you migrate to the canonical schema.

## Validation workflow
Run:

```bash
node --env-file=.env.local scripts/validate-google-sheet.mjs
```

The validator reports two independent states:
- `Runtime compatibility`: whether the current read-only dashboard can load the workbook.
- `Canonical structure ready`: whether the workbook already matches the target schema exactly.

A legacy workbook can be runtime-compatible even if canonical migration is still incomplete.

## Notes
- `currentPrice` is the preferred resolved current price from the sheet.
- `manualCurrentPrice` is the manual fallback maintained by the operator.
- Live providers such as CoinGecko or Steam Market may override sheet values at runtime, but the sheet still acts as the fallback layer.
- Use `Settings.currency=USD` unless you explicitly want another reporting currency.
- When you add new provider-specific columns, update both the normalizer and `scripts/validate-google-sheet.mjs`.
