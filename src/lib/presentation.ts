import type { Cs2AssetType, Cs2Position } from "@/types/portfolio";

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
  manual_sheet: "Цена из таблицы",
  entry_price_fallback: "Резерв по цене входа",
  coingecko: "CoinGecko",
  sheet_fallback: "Резерв из таблицы",
  ton_sheet_x_coingecko: "TON по live-курсу",
  ton_sheet_nominal: "TON из таблицы",
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


