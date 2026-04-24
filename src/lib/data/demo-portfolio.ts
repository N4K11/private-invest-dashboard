import type { NormalizedWorkbook } from "@/lib/sheets/normalizers";

type CreateDemoWorkbookOptions = {
  warnings?: string[];
};

export function createDemoWorkbook(
  options: CreateDemoWorkbookOptions = {},
): NormalizedWorkbook {
  return {
    spreadsheetTitle: "Demo Portfolio",
    availableSheets: [
      "Summary",
      "CS2_Positions",
      "Telegram_Gifts",
      "Crypto",
      "Transactions",
      "Settings",
    ],
    warnings:
      options.warnings ?? [
        "Google Sheets is not configured yet. The dashboard is showing demo data until service-account access is enabled.",
      ],
    summaryRows: [],
    cs2Rows: [
      {
        id: "cs2-awp-gungnir",
        name: "AWP | Gungnir",
        type: "skins",
        quantity: 1,
        averageEntryPrice: 10500,
        currentPrice: 12400,
        notes: "Blue-chip CS2 skin",
        market: "Manual sheet price",
        manualRiskScore: 28,
        liquidityLabel: "High",
      },
      {
        id: "cs2-capsule-antwerp",
        name: "Antwerp 2022 Legends Capsule",
        type: "cases",
        quantity: 180,
        averageEntryPrice: 2.4,
        currentPrice: 4.9,
        notes: "Steady carry position",
        market: "Manual sheet price",
        manualRiskScore: 38,
        liquidityLabel: "Medium",
      },
      {
        id: "cs2-ibp-holo",
        name: "Sticker | iBUYPOWER (Holo) | Katowice 2014",
        type: "stickers",
        quantity: 1,
        averageEntryPrice: 18200,
        currentPrice: 22800,
        notes: "Thin liquidity, collector premium",
        market: "Manual sheet price",
        manualRiskScore: 81,
        liquidityLabel: "Low",
      },
      {
        id: "cs2-charms-dragon",
        name: "Dragon Charm",
        type: "charms",
        quantity: 24,
        averageEntryPrice: 55,
        currentPrice: 48,
        notes: "Experimental segment",
        market: "Manual sheet price",
        manualRiskScore: 67,
        liquidityLabel: "Low",
      },
      {
        id: "cs2-cs20-case",
        name: "CS20 Case",
        type: "cases",
        quantity: 520,
        averageEntryPrice: 0.62,
        currentPrice: 0.88,
        notes: "Long-tail carry",
        market: "Manual sheet price",
        manualRiskScore: 44,
        liquidityLabel: "Medium",
      },
      {
        id: "cs2-graffiti-gold",
        name: "Sealed Graffiti | Crown (Foil)",
        type: "graffiti",
        quantity: 12,
        averageEntryPrice: 19,
        currentPrice: 13.5,
        notes: "Illiquid niche bucket",
        market: "Manual sheet price",
        manualRiskScore: 84,
        liquidityLabel: "Low",
      },
    ],
    telegramRows: [
      {
        id: "tg-gift-ton-chest",
        name: "TON Founder Chest",
        quantity: 6,
        estimatedPrice: 820,
        notes: "Manual OTC reference",
      },
      {
        id: "tg-gift-premium-badge",
        name: "Premium Badge Gift",
        quantity: 22,
        estimatedPrice: 145,
        notes: "Updated manually from marketplace chat",
      },
      {
        id: "tg-gift-limited-pass",
        name: "Limited Access Pass",
        quantity: 3,
        estimatedPrice: 1280,
        notes: "Very thin market",
      },
    ],
    cryptoRows: [
      {
        id: "crypto-btc",
        symbol: "BTC",
        name: "Bitcoin",
        quantity: 0.8125,
        averageEntryPrice: 44200,
        currentPrice: null,
        notes: "Core reserve",
      },
      {
        id: "crypto-ton",
        symbol: "TON",
        name: "Toncoin",
        quantity: 950,
        averageEntryPrice: 2.72,
        currentPrice: null,
        notes: "Telegram ecosystem exposure",
      },
    ],
    transactionRows: [],
    settings: {
      currency: "USD",
      owner_label: "Private Portfolio",
    },
  };
}
