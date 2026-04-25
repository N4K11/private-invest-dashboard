import type { Cs2PriceProvider, Cs2ProviderId } from "@/lib/providers/cs2/types";

export function createDisabledExternalCs2Provider(params: {
  id: Extract<Cs2ProviderId, "csfloat" | "pricempire">;
  sourceName: string;
  reason: string;
}): Cs2PriceProvider {
  return {
    id: params.id,
    sourceName: params.sourceName,
    isEnabled() {
      return true;
    },
    async getPrice() {
      return null;
    },
    async getBulkPrices() {
      return {
        quotes: new Map(),
        warnings: [`${params.sourceName} provider пропущен: ${params.reason}`],
      };
    },
  };
}
