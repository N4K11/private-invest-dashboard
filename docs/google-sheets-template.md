# Google Sheets template

The dashboard is optimized for these tabs:

## Required tabs
- `Summary`
- `CS2_Positions`
- `Telegram_Gifts`
- `Crypto`
- `Transactions`
- `Settings`

## Recommended columns

### `CS2_Positions`
- `name`
- `type`
- `quantity`
- `average_entry_price`
- `current_price`
- `notes`
- `market`
- `risk_score`
- `liquidity`

### `Telegram_Gifts`
- `name`
- `quantity`
- `estimated_price`
- `notes`

### `Crypto`
- `symbol`
- `name`
- `quantity`
- `average_entry_price`
- `current_price`
- `notes`

### `Transactions`
- `date`
- `category`
- `asset`
- `quantity`
- `price`
- `notes`

### `Settings`
- `key`
- `value`

## Notes
- The normalization layer already accepts several aliases in English and Russian, so you do not need a perfect migration before the first read-only launch.
- `current_price` for `CS2_Positions` and `estimated_price` for `Telegram_Gifts` are currently manual fields from Google Sheets.
- `Crypto.current_price` is optional because live pricing comes from CoinGecko when a mapped symbol exists.
- Use `Settings.currency=USD` unless you intentionally want another reporting currency.
- Add new price-provider-specific columns only after updating the provider module in `src/lib/providers`.
