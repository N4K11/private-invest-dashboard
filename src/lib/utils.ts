import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const DEFAULT_LOCALE = "ru-RU";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function formatCurrency(
  value: number,
  currency = "USD",
  maximumFractionDigits = 0,
) {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(value);
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    maximumFractionDigits,
  }).format(value);
}

export function formatPercent(value: number | null, maximumFractionDigits = 1) {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(maximumFractionDigits)}%`;
}

export function formatRelativeTime(date: string | Date) {
  const targetDate = typeof date === "string" ? new Date(date) : date;
  const diffMs = targetDate.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const formatter = new Intl.RelativeTimeFormat("ru", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, "day");
}

export function parseNumberish(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "boolean" || value === null || value === undefined) {
    return null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  let normalized = raw
    .replace(/[$€£₽]/g, "")
    .replace(/\s+/g, "")
    .replace(/%/g, "");

  if (normalized.includes(",") && normalized.includes(".")) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    normalized =
      lastComma > lastDot
        ? normalized.replace(/\./g, "").replace(",", ".")
        : normalized.replace(/,/g, "");
  } else if (normalized.includes(",") && !normalized.includes(".")) {
    normalized =
      (normalized.match(/,/g) ?? []).length === 1
        ? normalized.replace(",", ".")
        : normalized.replace(/,/g, "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toSlugFragment(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}
