import type {
  AssetCategory,
  CategoryBreakdown,
  Cs2AssetType,
  TransactionAction,
} from "@/types/portfolio";

export const DASHBOARD_BASE_PATH = "invest-dashboard";
export const DASHBOARD_COOKIE_NAME = "invest_dashboard_session";
export const DASHBOARD_SLUG_PLACEHOLDER = "setup-required";

export const DEFAULT_CURRENCY = "USD";
export const PORTFOLIO_HIGH_RISK_SCORE = 62;

export const CATEGORY_META: Record<
  AssetCategory,
  Pick<CategoryBreakdown, "label" | "color">
> = {
  cs2: {
    label: "CS2",
    color: "#00d1a0",
  },
  telegram: {
    label: "Подарки Telegram",
    color: "#3d8bff",
  },
  crypto: {
    label: "Крипта",
    color: "#f3b23a",
  },
};

export const CS2_TYPE_OPTIONS: {
  label: string;
  value: Cs2AssetType | "all";
}[] = [
  { label: "Все", value: "all" },
  { label: "Скины", value: "skins" },
  { label: "Наклейки", value: "stickers" },
  { label: "Кейсы", value: "cases" },
  { label: "Брелоки", value: "charms" },
  { label: "Граффити", value: "graffiti" },
  { label: "Другое", value: "other" },
];

export const ADMIN_STATUS_OPTIONS = [
  { label: "Hold", value: "hold" },
  { label: "Sell", value: "sell" },
  { label: "Watch", value: "watch" },
  { label: "Archived", value: "archived" },
  { label: "Dead", value: "dead" },
] as const;

export const TELEGRAM_PRICE_CONFIDENCE_OPTIONS = [
  { label: "Низкая", value: "low" },
  { label: "Средняя", value: "medium" },
  { label: "Высокая", value: "high" },
] as const;

export const TRANSACTION_ACTION_OPTIONS: {
  label: string;
  value: TransactionAction | "all";
}[] = [
  { label: "Все действия", value: "all" },
  { label: "Покупка", value: "buy" },
  { label: "Продажа", value: "sell" },
  { label: "Трансфер", value: "transfer" },
  { label: "Обновление цены", value: "price_update" },
  { label: "Комиссия", value: "fee" },
];

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
