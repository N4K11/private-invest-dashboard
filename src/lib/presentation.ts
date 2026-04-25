import { CATEGORY_META } from "@/lib/constants";
import type {
  AssetCategory,
  Cs2AssetType,
  Cs2Position,
  PriceConfidence,
  TransactionAction,
} from "@/types/portfolio";

const cs2TypeLabels: Record<Cs2AssetType, string> = {
  stickers: "Наклейки",
  skins: "Скины",
  cases: "Кейсы",
  charms: "Брелоки",
  graffiti: "Граффити",
  other: "Другое",
};

const liquidityLabels: Record<Cs2Position["liquidityLabel"], string> = {
  High: "Высокая",
  Medium: "Средняя",
  Low: "Низкая",
  Unknown: "Неизвестно",
};

const priceSourceLabels: Record<string, string> = {
  steam_market_live: "Steam Market",
  manual_sheet: "Ручная цена из таблицы",
  entry_price_fallback: "Резерв по цене входа",
  coingecko: "CoinGecko",
  sheet_fallback: "Резерв из таблицы",
  ton_sheet_x_coingecko: "TON по live-курсу",
  ton_sheet_nominal: "TON из таблицы",
  transaction_price_update: "Price update из Transactions",
  buff_proxy_live: "Buff proxy",
  csfloat_live: "CSFloat",
  pricempire_live: "PriceEmpire",
  missing: "Цена отсутствует",
};

const transactionActionLabels: Record<TransactionAction, string> = {
  buy: "Покупка",
  sell: "Продажа",
  transfer: "Трансфер",
  price_update: "Обновление цены",
  fee: "Комиссия",
};

const confidenceLabels: Record<PriceConfidence, string> = {
  high: "Высокая",
  medium: "Средняя",
  low: "Низкая",
};

export function formatCs2TypeLabel(type: string) {
  return cs2TypeLabels[type as Cs2AssetType] ?? type;
}

export function formatLiquidityLabel(label: Cs2Position["liquidityLabel"]) {
  return liquidityLabels[label] ?? label;
}

export function formatPriceSourceLabel(source: string) {
  return priceSourceLabels[source] ?? source.replace(/_/g, " ");
}

export function formatAssetCategoryLabel(category: AssetCategory | null) {
  if (!category) {
    return "Неизвестная категория";
  }

  return CATEGORY_META[category].label;
}

export function formatTransactionActionLabel(action: string) {
  return transactionActionLabels[action as TransactionAction] ?? action.replace(/_/g, " ");
}

export function formatPriceConfidenceLabel(confidence: PriceConfidence) {
  return confidenceLabels[confidence] ?? confidence;
}

