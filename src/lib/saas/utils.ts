import "server-only";

import type { AssetCategory, PortfolioVisibility } from "@prisma/client";

export function decimalToNumber(
  value:
    | number
    | string
    | { toString(): string }
    | null
    | undefined,
) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(typeof value === "string" ? value : value.toString());
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeAssetCategory(category: AssetCategory) {
  return category.toLowerCase() as "cs2" | "telegram" | "crypto" | "custom" | "nft";
}

export function normalizePortfolioVisibility(visibility: PortfolioVisibility) {
  return visibility.toLowerCase() as "private" | "shared_link" | "workspace";
}

export function mapVisibilityToPrisma(
  visibility: "private" | "shared_link" | "workspace",
): PortfolioVisibility {
  switch (visibility) {
    case "shared_link":
      return "SHARED_LINK";
    case "workspace":
      return "WORKSPACE";
    default:
      return "PRIVATE";
  }
}
