# Import Center

## Stage 17 scope
Import Center adds a database-backed import workflow for the hosted SaaS mode without changing the legacy private dashboard runtime.

Routes:
- `/app/import`
- `POST /api/app/import/preview`
- `POST /api/app/import/commit`

## Supported sources
- Google Sheets URL or spreadsheet ID
- CSV text or file upload
- JSON text or file upload
- Steam inventory export JSON
- Manual CSV template

## Import flow
1. Choose the target portfolio inside the active workspace.
2. Select the source type.
3. Provide the source payload.
4. Build preview.
5. Review warnings, deduplication and auto-mapped fields.
6. Adjust column mapping if the source is tabular.
7. Rebuild preview if needed.
8. Commit import into PostgreSQL.

## Preview behavior
Preview never writes to the database.

The preview response includes:
- detected source label and summary
- total raw row count
- import-ready row count
- deduplicated record count
- duplicate row count
- category distribution
- warnings
- deduplicated import records
- editable column mapping for CSV / JSON / Steam / manual template inputs

## Deduplication strategy
The current strategy is snapshot-oriented.

Inside the same import batch:
- rows are deduplicated by `externalSource + externalId` when both exist
- otherwise by `category + symbol` for crypto
- otherwise by `category + canonicalized name`
- duplicate rows inside the same payload aggregate `quantity`

When committing to the database:
- `Asset` is upserted by `(workspaceId, normalizedKey)`
- `Position` is upserted by `(portfolioId, assetId)`
- imported `quantity` replaces the existing portfolio position quantity for that asset
- imported prices update the position when present
- the import writes a summary row into `AuditLog`

This is intentionally a holdings snapshot import, not a transaction replay engine.

## Supported JSON shapes
Generic JSON preview supports:
- top-level array of objects
- object with `items`
- object with `positions`
- object with `assets`
- object with `data`
- object with `rows`

Steam inventory preview additionally supports:
- native `assets + descriptions` inventory payloads
- flat arrays containing `market_hash_name` / `name`, `amount` / `quantity`, `assetid` / `id`

## Google Sheets behavior
The import route accepts any Google Sheets URL or spreadsheet ID that is readable by the configured service account.

The same Google Sheets / Drive workbook adapter is reused:
- native Google Sheet -> Sheets API
- uploaded Excel workbook in Drive -> Drive API + xlsx fallback

Structured import currently reads supported asset sheets and converts them into SaaS import records:
- `CS2_Positions` / `CS2 Assets`
- `Telegram_Gifts` / `Telegram Gifts`
- `Crypto`

## Manual template
Manual template uses CSV columns:

```csv
category,name,symbol,quantity,averageEntryPrice,currentPrice,notes,externalId,externalSource,collection
crypto,Bitcoin,BTC,0.25,52000,64000,Manual template example,btc-wallet-1,manual,
telegram,Plush Pepe,,3,45,80,Rare series,pepe-3,manual,Pepe Series
cs2,Sticker | Crown (Foil),,2,900,1100,Example CS2 position,crown-foil,steam,
```

## Current limitations
- import writes positions only; it does not create historical transactions yet
- import is snapshot-based; reimporting the same holdings updates quantities instead of appending
- Google Sheets import requires valid service-account access to the provided sheet/workbook
- column mapping currently exists only for generic tabular imports, not structured Google Sheets tabs
- Steam export import treats data as CS2 holdings snapshot and does not infer buy history

## Manual test
1. Configure `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL`.
2. Run Prisma generate and migrations.
3. Login to `/app`.
4. Open `/app/import`.
5. Choose a portfolio.
6. Test preview with:
   - a CSV file
   - a JSON payload
   - a Steam export JSON
   - a Google Sheets URL readable by the service account
7. Adjust mapping for CSV/JSON if needed.
8. Commit import.
9. Open `/app/portfolios/[portfolioId]` and verify imported positions.
10. Inspect `AuditLog` in PostgreSQL for `import.run`.
