import type { NormalizedTelegramGiftRow } from "@/lib/sheets/normalizers";
import type { TelegramGiftPosition } from "@/types/portfolio";

export async function resolveTelegramGiftPositions(
  rows: NormalizedTelegramGiftRow[],
) {
  const positions: TelegramGiftPosition[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    estimatedPrice: row.estimatedPrice,
    totalValue: row.quantity * (row.estimatedPrice ?? 0),
    notes: row.notes,
    priceSource: "manual_sheet",
  }));

  return {
    positions,
    warnings: positions.some((position) => position.estimatedPrice === null)
      ? [
          "Some Telegram Gifts are missing estimated prices. Fill the estimated_price column in Google Sheets for accurate valuation.",
        ]
      : [],
  };
}
