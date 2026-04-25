import { getEnv } from "@/lib/env";
import type { NormalizedCs2Row } from "@/lib/sheets/normalizers";
import type { Cs2PriceConfidence } from "@/types/portfolio";
import type { Cs2MarketLiquidity } from "@/lib/providers/cs2/types";

const WEAR_ALIAS_MAP: Record<string, string> = {
  fn: "Factory New",
  "factory new": "Factory New",
  "factory-new": "Factory New",
  mw: "Minimal Wear",
  "minimal wear": "Minimal Wear",
  "minimal-wear": "Minimal Wear",
  ft: "Field-Tested",
  "field tested": "Field-Tested",
  "field-tested": "Field-Tested",
  ww: "Well-Worn",
  "well worn": "Well-Worn",
  "well-worn": "Well-Worn",
  bs: "Battle-Scarred",
  "battle scarred": "Battle-Scarred",
  "battle-scarred": "Battle-Scarred",
};

function normalizeCs2Spacing(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeCs2Prefixes(value: string) {
  return normalizeCs2Spacing(
    value
      .replace(/\bstat\s*trak(?:™)?\b/gi, "StatTrak™")
      .replace(/\bsouvenir\b/gi, "Souvenir")
      .replace(/[™®]/g, (token) => (token === "™" ? "™" : "")),
  );
}

function stripTrailingWear(value: string) {
  return normalizeCs2Spacing(value.replace(/\(([^)]+)\)\s*$/u, ""));
}

export function normalizeCs2Wear(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[-–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return WEAR_ALIAS_MAP[normalized] ?? null;
}

export function extractCs2WearFromName(value: string) {
  const match = value.match(/\(([^)]+)\)\s*$/u);
  return normalizeCs2Wear(match?.[1] ?? null);
}

export function canonicalizeCs2AssetName(name: string, explicitWear?: string | null) {
  const canonicalWear = normalizeCs2Wear(explicitWear ?? extractCs2WearFromName(name));
  const canonicalBase = normalizeCs2Prefixes(stripTrailingWear(name));

  if (!canonicalBase) {
    return canonicalWear ? `(${canonicalWear})` : "";
  }

  return canonicalWear ? `${canonicalBase} (${canonicalWear})` : canonicalBase;
}

export function normalizeCs2MarketText(value: string) {
  return canonicalizeCs2AssetName(value)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[™®]/g, "")
    .replace(/[()]/g, " ")
    .replace(/[-–—]/g, " ")
    .replace(/[^\p{L}\p{N}|]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSteamTargetName(row: NormalizedCs2Row) {
  return canonicalizeCs2AssetName(row.name, row.wear);
}

export function buildCs2QueryVariants(row: NormalizedCs2Row) {
  const variants = new Set<string>();
  const canonicalTarget = buildSteamTargetName(row);
  const canonicalBase = stripTrailingWear(canonicalTarget);
  const canonicalWear = normalizeCs2Wear(row.wear ?? extractCs2WearFromName(row.name));
  const rawBaseName = normalizeCs2Prefixes(normalizeCs2Spacing(row.name));

  for (const value of [canonicalTarget, canonicalBase, rawBaseName]) {
    if (value) {
      variants.add(value);
      variants.add(value.replace(/[™®]/g, "").trim());
      variants.add(value.replace(/\|/g, " ").replace(/\s+/g, " ").trim());
    }
  }

  if (canonicalBase && canonicalWear) {
    variants.add(`${canonicalBase} ${canonicalWear}`.replace(/\s+/g, " ").trim());
    variants.add(`${canonicalBase} (${canonicalWear})`);
    variants.add(`${canonicalBase} ${canonicalWear.replace(/-/g, " ")}`);
  }

  return [...variants].filter((value) => value.length > 0);
}

export function scoreSteamCandidate(targetName: string, candidateName: string) {
  const normalizedTarget = normalizeCs2MarketText(targetName);
  const normalizedCandidate = normalizeCs2MarketText(candidateName);

  if (!normalizedTarget || !normalizedCandidate) {
    return 0;
  }

  if (normalizedTarget === normalizedCandidate) {
    return 10_000;
  }

  let score = 0;

  if (
    normalizedCandidate.includes(normalizedTarget) ||
    normalizedTarget.includes(normalizedCandidate)
  ) {
    score += 2_000;
  }

  const targetTokens = normalizedTarget.split(" ");
  const candidateTokens = new Set(normalizedCandidate.split(" "));
  const sharedTokenCount = targetTokens.filter((token) => candidateTokens.has(token)).length;

  score += sharedTokenCount * 140;
  score -= Math.abs(targetTokens.length - candidateTokens.size) * 20;

  return score;
}

export function normalizeCs2LiquidityLabel(value: string | null | undefined): Cs2MarketLiquidity | null {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "high" || normalized === "высокая") {
    return "high";
  }

  if (normalized === "medium" || normalized === "средняя") {
    return "medium";
  }

  if (normalized === "low" || normalized === "низкая") {
    return "low";
  }

  if (normalized === "unknown" || normalized === "неизвестно") {
    return "unknown";
  }

  return null;
}

export function inferCs2LiquidityFromDepth(depth: number | null | undefined): Cs2MarketLiquidity {
  if (typeof depth !== "number" || !Number.isFinite(depth) || depth <= 0) {
    return "unknown";
  }

  if (depth >= 100) {
    return "high";
  }

  if (depth >= 20) {
    return "medium";
  }

  return "low";
}

export function getCs2PriceStaleThresholdMs() {
  return getEnv().CS2_PRICE_STALE_HOURS * 60 * 60 * 1000;
}

export function isTimestampStale(value: string | null) {
  if (!value) {
    return true;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return true;
  }

  return Date.now() - parsed > getCs2PriceStaleThresholdMs();
}

export function getCs2ConfidenceLabel(confidence: Cs2PriceConfidence) {
  if (confidence === "high") {
    return "Высокая";
  }

  if (confidence === "medium") {
    return "Средняя";
  }

  return "Низкая";
}

export async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TOutput>,
) {
  if (items.length === 0) {
    return [] as TOutput[];
  }

  const results = new Array<TOutput>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const currentIndex = cursor;
      cursor += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
}
