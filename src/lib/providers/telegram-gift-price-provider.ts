import { remember } from "@/lib/cache/ttl-store";
import { COINGECKO_SYMBOL_MAP } from "@/lib/constants";
import { getEnv } from "@/lib/env";
import type { NormalizedTelegramGiftRow } from "@/lib/sheets/normalizers";
import type { TelegramGiftPosition } from "@/types/portfolio";

async function fetchTonUsdPrice() {
  const env = getEnv();
  const tonId = COINGECKO_SYMBOL_MAP.TON;

  return remember("coingecko:telegram-gifts-ton-usd", env.PRICE_CACHE_TTL_SECONDS * 1000, async () => {
    try {
      const url = new URL("https://api.coingecko.com/api/v3/simple/price");
      url.searchParams.set("ids", tonId);
      url.searchParams.set("vs_currencies", "usd");

      const response = await fetch(url, {
        headers: env.COINGECKO_API_KEY
          ? {
              "x-cg-demo-api-key": env.COINGECKO_API_KEY,
            }
          : undefined,
        next: {
          revalidate: env.PRICE_CACHE_TTL_SECONDS,
        },
      });

      if (!response.ok) {
        throw new Error(`CoinGecko returned ${response.status}`);
      }

      const payload = (await response.json()) as Record<string, { usd?: number }>;
      const price = payload[tonId]?.usd;

      return typeof price === "number" ? price : null;
    } catch {
      return null;
    }
  });
}

export async function resolveTelegramGiftPositions(
  rows: NormalizedTelegramGiftRow[],
) {
  const requiresTonQuote = rows.some(
    (row) => row.estimatedPrice !== null && row.estimatedPriceQuoteSymbol === "TON",
  );
  const tonUsdPrice = requiresTonQuote ? await fetchTonUsdPrice() : null;

  const positions: TelegramGiftPosition[] = rows.map((row) => {
    const estimatedPrice =
      row.estimatedPriceQuoteSymbol === "TON"
        ? tonUsdPrice !== null && row.estimatedPrice !== null
          ? row.estimatedPrice * tonUsdPrice
          : row.estimatedPrice
        : row.estimatedPrice;

    return {
      id: row.id,
      name: row.name,
      quantity: row.quantity,
      estimatedPrice,
      totalValue: row.quantity * (estimatedPrice ?? 0),
      notes:
        row.notes ??
        (row.estimatedPriceQuoteSymbol === "TON" && tonUsdPrice !== null
          ? `Конвертация из TON по live-курсу ${tonUsdPrice.toFixed(2)} USD`
          : null),
      priceSource:
        row.estimatedPriceQuoteSymbol === "TON"
          ? tonUsdPrice !== null
            ? "ton_sheet_x_coingecko"
            : "ton_sheet_nominal"
          : row.priceSource ?? "manual_sheet",
    };
  });

  const warnings: string[] = [];

  if (requiresTonQuote && tonUsdPrice === null) {
    warnings.push(
      "Подарки Telegram в таблице указаны в TON, но live-курс TON/USD сейчас недоступен. До восстановления конвертации значения показываются в номинале TON.",
    );
  }

  if (positions.some((position) => position.estimatedPrice === null)) {
    warnings.push(
      "У части подарков Telegram нет цены. Заполни estimated_price или Price_TON в таблице.",
    );
  }

  return {
    positions,
    warnings,
  };
}


