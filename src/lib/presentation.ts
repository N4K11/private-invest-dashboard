import { CATEGORY_META } from "@/lib/constants";
import type {
  AssetCategory,
  Cs2AssetType,
  Cs2Position,
  PositionRecommendation,
  PriceConfidence,
  TransactionAction,
} from "@/types/portfolio";
import type {
  SaasPriceConfidenceStatus,
  SaasTelegramPriceSource,
} from "@/types/saas";

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
  coingecko_live: "CoinGecko live",
  binance_live: "Binance live",
  sheet_fallback: "Резерв из таблицы",
  ton_sheet_x_coingecko: "TON по live-курсу",
  ton_sheet_nominal: "TON из таблицы",
  transaction_price_update: "Price update из Transactions",
  buff_proxy_live: "Buff proxy",
  csfloat_live: "CSFloat",
  pricempire_live: "PriceEmpire",
  cs2_manual: "Ручная цена CS2",
  telegram_manual_otc: "Ручная OTC-цена Telegram",
  custom_manual: "Ручная цена custom-актива",
  manual_crypto: "Ручная цена crypto",
  imported_price: "Импортированная цена",
  crypto_missing: "Цена crypto отсутствует",
  cs2_missing: "Цена CS2 отсутствует",
  telegram_missing: "Цена Telegram Gift отсутствует",
  custom_missing: "Цена custom-актива отсутствует",
  missing: "Цена отсутствует",
};

const telegramPriceSourceLabels: Record<SaasTelegramPriceSource, string> = {
  fragment: "Fragment",
  otc_deal: "OTC deal",
  marketplace_listing: "Marketplace listing",
  manual_estimate: "Manual estimate",
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

const recommendationLabels: Record<PositionRecommendation, string> = {
  hold: "Держать",
  watch: "Наблюдать",
  consider_trimming: "Сократить долю",
  needs_price_update: "Обновить цену",
  illiquid: "Неликвид",
};

const saasPriceConfidenceLabels: Record<SaasPriceConfidenceStatus, string> = {
  live_high: "Live high",
  live_medium: "Live medium",
  manual_high: "Manual high",
  manual_low: "Manual low",
  stale: "Устарела",
  unknown: "Нет цены",
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

export function formatTelegramPriceSourceLabel(source: SaasTelegramPriceSource) {
  return telegramPriceSourceLabels[source] ?? source.replace(/_/g, " ");
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

export function formatRecommendationLabel(recommendation: PositionRecommendation) {
  return recommendationLabels[recommendation] ?? recommendation.replace(/_/g, " ");
}

export function formatSaasPriceConfidenceLabel(status: SaasPriceConfidenceStatus) {
  return saasPriceConfidenceLabels[status] ?? status.replace(/_/g, " ");
}
