import type { NormalizedCs2Row } from "@/lib/sheets/normalizers";
import type { Cs2PriceConfidence } from "@/types/portfolio";

export type Cs2ProviderId = "steam" | "manual" | "buff_proxy" | "csfloat" | "pricempire";

export interface Cs2PriceLookupInput {
  assetId: string;
  assetName: string;
  row: NormalizedCs2Row;
}

export interface Cs2ResolvedPriceQuote {
  assetId: string;
  assetName: string;
  price: number | null;
  sourceId: Cs2ProviderId;
  sourceName: string;
  matchedName: string | null;
  lastUpdated: string | null;
  confidence: Cs2PriceConfidence;
  isLive: boolean;
  warning: string | null;
}

export interface Cs2ProviderBulkResult {
  quotes: Map<string, Cs2ResolvedPriceQuote>;
  warnings: string[];
}

export interface Cs2PriceProvider {
  readonly id: Cs2ProviderId;
  readonly sourceName: string;
  isEnabled(): boolean;
  getPrice(input: Cs2PriceLookupInput): Promise<Cs2ResolvedPriceQuote | null>;
  getBulkPrices(inputs: Cs2PriceLookupInput[]): Promise<Cs2ProviderBulkResult>;
}
