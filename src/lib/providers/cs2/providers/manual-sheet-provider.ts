import type { Cs2PriceProvider } from "@/lib/providers/cs2/types";
import { isTimestampStale } from "@/lib/providers/cs2/utils";

export function createManualCs2PriceProvider(): Cs2PriceProvider {
  return {
    id: "manual",
    sourceName: "Manual Sheet Fallback",
    isEnabled() {
      return true;
    },
    async getPrice(input) {
      const price = input.row.manualCurrentPrice ?? input.row.currentPrice;
      if (price === null) {
        return null;
      }

      const stale = isTimestampStale(input.row.lastUpdated ?? null);

      return {
        assetId: input.assetId,
        assetName: input.assetName,
        price,
        sourceId: "manual",
        sourceName: "Manual Sheet Fallback",
        matchedName: input.row.name,
        lastUpdated: input.row.lastUpdated ?? null,
        confidence: stale ? "low" : "medium",
        isLive: false,
        warning: stale
          ? "Ручная цена устарела и требует обновления в таблице."
          : null,
      };
    },
    async getBulkPrices(inputs) {
      const quotes = new Map();

      for (const input of inputs) {
        const quote = await this.getPrice(input);
        if (quote) {
          quotes.set(input.assetId, quote);
        }
      }

      return {
        quotes,
        warnings: [],
      };
    },
  };
}
