# AI Insights

## Purpose
The AI Insights layer adds structured commentary for SaaS portfolio detail pages without pretending to be an autonomous financial advisor. It turns already-calculated analytics, snapshots and valuation-quality signals into readable insights for the current workspace and portfolio.

Current route:
- `/app/portfolios/[portfolioId]`

## Current provider
Stage 24 ships only one provider:
- `deterministic_v1`

It is implemented in:
- `src/lib/saas/insights/providers/deterministic-provider.ts`

The provider abstraction lives in:
- `src/lib/saas/insights/types.ts`
- `src/lib/saas/insights/provider.ts`
- `src/lib/saas/portfolio-insights.ts`

## What the current deterministic provider does
It generates six sections:
- portfolio summary
- risk explanation
- liquidity warnings
- concentration warnings
- what changed since the last snapshot
- valuation quality

The output is built from structured data only:
- portfolio totals
- allocation and category weights
- transaction-aware analytics
- risk watchlist explainability
- price confidence states
- price snapshots
- liquidity markers

No free-form user notes, secret env values or raw external prompts are required for the current provider.

## Prompt-safe context
Before insight generation, the service builds a sanitized context scoped to the current workspace and portfolio.

Included:
- workspace id
- portfolio id and name
- base currency
- total value / cost / PnL / ROI
- position and transaction counts
- analytics aggregates
- sanitized position rows
- sanitized price snapshots

Excluded on purpose:
- private tokens and secrets
- raw sheet credentials
- free-form notes from positions and transactions
- tags and other noisy user text fields
- anything from other workspaces

This keeps the future AI surface narrower and easier to audit.

## No financial advice
The UI must always display a disclaimer.

Current wording:
- `Это не финансовая рекомендация. Блок Insights описывает текущие структурные сигналы и качество данных, а не советует покупать, продавать или удерживать активы.`

The deterministic provider only explains:
- where the portfolio is concentrated
- where valuation quality is weak
- which positions look illiquid or stale
- what changed between recent snapshots

It does not issue buy/sell recommendations.

## How to extend with a real LLM later
A future LLM provider should only be added behind explicit env/config and should keep deterministic mode as the fallback.

Recommended path:
1. Add a new provider inside `src/lib/saas/insights/providers/`.
2. Gate provider selection in `src/lib/saas/insights/provider.ts`.
3. Keep the sanitized context contract stable.
4. Preserve workspace scoping and never mix tenant data.
5. Keep the disclaimer visible even when LLM output is enabled.
6. Log provider usage in audit/observability before enabling it broadly.

## Manual verification
1. Open `/app/portfolios/[portfolioId]`.
2. Check the new `Insights` section.
3. Verify the disclaimer is visible.
4. Confirm sections are deterministic and match the current analytics data.
5. Change a manual price or add transactions, then refresh the page and confirm the change summary updates.
6. Ensure insights never show secrets, raw notes or cross-workspace data.