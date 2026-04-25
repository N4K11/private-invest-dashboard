import type { NormalizedTelegramGiftRow } from "@/lib/sheets/normalizers";
import type { TelegramPriceConfidence } from "@/types/portfolio";

export interface TelegramGiftPriceLookupInput {
  assetId: string;
  assetName: string;
  row: NormalizedTelegramGiftRow;
}

export interface TelegramGiftResolvedPriceQuote {
  assetId: string;
  assetName: string;
  price: number | null;
  sourceId: string;
  sourceName: string;
  confidence: TelegramPriceConfidence | null;
  sourceNote: string | null;
  lastCheckedAt: string | null;
  warning: string | null;
  isStale: boolean;
}

export interface TelegramGiftProviderBulkResult {
  quotes: Map<string, TelegramGiftResolvedPriceQuote>;
  warnings: string[];
}

export interface TelegramGiftPriceProvider {
  readonly id: string;
  readonly sourceName: string;
  getBulkPrices(inputs: TelegramGiftPriceLookupInput[]): Promise<TelegramGiftProviderBulkResult>;
}
