import { getEnv } from "@/lib/env";
import type { NormalizedCs2Row } from "@/lib/sheets/normalizers";
import type { Cs2PriceConfidence } from "@/types/portfolio";

export function normalizeCs2MarketText(value: string) {
  return value
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
  return row.wear ? `${row.name} (${row.wear})` : row.name;
}

export function buildCs2QueryVariants(row: NormalizedCs2Row) {
  const variants = new Set<string>();
  const baseName = row.name.replace(/\s+/g, " ").trim();

  if (baseName) {
    variants.add(baseName);
    variants.add(baseName.replace(/[™®]/g, "").replace(/\s+/g, " ").trim());
    variants.add(baseName.replace(/\|/g, " ").replace(/\s+/g, " ").trim());
  }

  if (row.wear) {
    variants.add(`${baseName} ${row.wear}`.replace(/\s+/g, " ").trim());
    variants.add(buildSteamTargetName(row));
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
