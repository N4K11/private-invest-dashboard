import type {
  AssetCategory,
  CategoryBreakdown,
  Cs2AssetType,
} from "@/types/portfolio";

export const DASHBOARD_BASE_PATH = "invest-dashboard";
export const DASHBOARD_COOKIE_NAME = "invest_dashboard_session";
export const DASHBOARD_SLUG_PLACEHOLDER = "setup-required";

export const DEFAULT_CURRENCY = "USD";

export const CATEGORY_META: Record<
  AssetCategory,
  Pick<CategoryBreakdown, "label" | "color">
> = {
  cs2: {
    label: "CS2",
    color: "#00d1a0",
  },
  telegram: {
    label: "Telegram Gifts",
    color: "#3d8bff",
  },
  crypto: {
    label: "Crypto",
    color: "#f3b23a",
  },
};

export const CS2_TYPE_OPTIONS: {
  label: string;
  value: Cs2AssetType | "all";
}[] = [
  { label: "All", value: "all" },
  { label: "Skins", value: "skins" },
  { label: "Stickers", value: "stickers" },
  { label: "Cases", value: "cases" },
  { label: "Charms", value: "charms" },
  { label: "Graffiti", value: "graffiti" },
  { label: "Other", value: "other" },
];

export const REQUIRED_SHEET_TABS = [
  "Summary",
  "CS2_Positions",
  "Telegram_Gifts",
  "Crypto",
  "Transactions",
  "Settings",
] as const;

export const REQUIRED_SHEET_COLUMNS = {
  Summary: ["metric", "value"],
  CS2_Positions: [
    "name",
    "type",
    "quantity",
    "average_entry_price",
    "current_price",
    "notes",
  ],
  Telegram_Gifts: ["name", "quantity", "estimated_price", "notes"],
  Crypto: [
    "symbol",
    "name",
    "quantity",
    "average_entry_price",
    "current_price",
    "notes",
  ],
  Transactions: ["date", "category", "asset", "quantity", "price", "notes"],
  Settings: ["key", "value"],
} as const;

export const COINGECKO_SYMBOL_MAP: Record<string, string> = {
  ADA: "cardano",
  ARB: "arbitrum",
  AVAX: "avalanche-2",
  BNB: "binancecoin",
  BTC: "bitcoin",
  DOGE: "dogecoin",
  ETH: "ethereum",
  LTC: "litecoin",
  OP: "optimism",
  SOL: "solana",
  TON: "the-open-network",
  TRX: "tron",
  USDC: "usd-coin",
  USDT: "tether",
  XRP: "ripple",
};

export const CS2_TYPE_RISK_WEIGHT: Record<Cs2AssetType, number> = {
  stickers: 18,
  skins: 10,
  cases: 14,
  charms: 16,
  graffiti: 22,
  other: 12,
};
