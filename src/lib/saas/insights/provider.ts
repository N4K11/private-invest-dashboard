import "server-only";

import type { PortfolioInsightsProvider } from "@/lib/saas/insights/types";
import { deterministicPortfolioInsightsProvider } from "@/lib/saas/insights/providers/deterministic-provider";

export function getPortfolioInsightsProvider(): PortfolioInsightsProvider {
  return deterministicPortfolioInsightsProvider;
}