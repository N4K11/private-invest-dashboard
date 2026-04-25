# Manual Asset Manager

## Scope
Stage 18 adds a database-backed Manual Asset Manager to the SaaS portfolio detail page at `/app/portfolios/[portfolioId]`.

Supported asset types:
- CS2 item
- Telegram Gift
- Crypto
- Custom collectible

Supported fields:
- name
- quantity
- entry price
- current manual price
- currency
- notes
- tags
- liquidity
- confidence

## API routes
Protected SaaS write routes:
- `POST /api/app/portfolios/[portfolioId]/positions`
- `PATCH /api/app/portfolios/[portfolioId]/positions/[positionId]`
- `DELETE /api/app/portfolios/[portfolioId]/positions/[positionId]`

All routes require:
- Auth.js session
- active workspace membership
- owner/admin portfolio permissions
- standard SaaS API rate limit

## Write behavior
Create:
- creates or reuses a workspace asset
- creates a portfolio position
- writes manual metadata into `position.metadata.manualAsset`
- appends `BUY` transaction when `transactionMode=buy`
- appends `position.create` audit log

Update:
- can rename / reclassify the asset
- updates quantity, entry price, manual price, notes and manual metadata
- `transactionMode=buy` creates a `BUY` transaction for the positive delta
- `transactionMode=sell` creates a `SELL` transaction for the negative delta
- `transactionMode=adjustment` updates the snapshot without creating a transaction
- appends `position.update` audit log

Delete:
- removes the position row from PostgreSQL
- preserves transaction history
- removes the asset only when it becomes fully orphaned
- appends `position.delete` audit log

## Portfolio detail integration
The SaaS portfolio detail page now exposes:
- add asset drawer
- edit/delete buttons on positions
- manual metadata chips for tags, liquidity and confidence
- automatic refresh of cards and recent transactions after each mutation

## Manual testing
1. Login and open `/app/portfolios/[portfolioId]`.
2. Create a new manual asset with `transactionMode=buy`.
3. Verify the position appears in the positions list.
4. Verify a new `BUY` row appears in recent transactions.
5. Edit the same position with:
   - higher quantity + `buy`
   - lower quantity + `sell`
   - same quantity + `adjustment`
6. Verify transaction rows only appear for `buy` / `sell`.
7. Delete the position and confirm the row disappears.
8. Check `AuditLog` for `position.create`, `position.update`, `position.delete`.

## Current limitations
- price currency is stored as manual metadata and transaction currency; no FX conversion is performed yet
- there is no dedicated transaction editor for manual asset trades yet; the manager only auto-generates buy/sell rows from quantity deltas
- imported assets and manual assets currently share the same `Asset` model and normalization key strategy
