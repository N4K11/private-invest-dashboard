import "server-only";

import type { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

import { getEnv } from "@/lib/env";
import type { SaasBillingPlanCard, SaasSubscriptionPlan, SaasSubscriptionStatus } from "@/types/saas";

type BillingPlanLimits = SaasBillingPlanCard["limits"];

type BillingPlanCatalogItem = Omit<SaasBillingPlanCard, "isCurrent" | "canCheckout" | "stripePriceConfigured"> & {
  stripePriceId: string | null;
};

const PLAN_LIMITS: Record<SaasSubscriptionPlan, BillingPlanLimits> = {
  free: {
    portfolios: 1,
    positions: 750,
    integrations: 1,
    priceRefreshHours: 24,
    alerts: 3,
    historyRetentionDays: 30,
  },
  pro: {
    portfolios: 5,
    positions: 5000,
    integrations: 5,
    priceRefreshHours: 6,
    alerts: 25,
    historyRetentionDays: 365,
  },
  whale: {
    portfolios: 20,
    positions: 50000,
    integrations: 15,
    priceRefreshHours: 1,
    alerts: 100,
    historyRetentionDays: 1095,
  },
  team: {
    portfolios: 50,
    positions: 100000,
    integrations: 25,
    priceRefreshHours: 0.5,
    alerts: 250,
    historyRetentionDays: 3650,
  },
};

const PLAN_META: Record<
  SaasSubscriptionPlan,
  Omit<BillingPlanCatalogItem, "plan" | "limits" | "stripePriceId">
> = {
  free: {
    label: "Free",
    description: "Личный стартовый план для первого workspace и базового мониторинга.",
    monthlyPriceUsd: 0,
    seatsIncluded: 1,
    highlights: [
      "1 workspace portfolio lane",
      "Базовые manual assets и import flow",
      "До 3 alerts",
    ],
  },
  pro: {
    label: "Pro",
    description: "Для активного личного учета и нескольких стратегий внутри одного workspace.",
    monthlyPriceUsd: 29,
    seatsIncluded: 1,
    highlights: [
      "Быстрее price refresh",
      "Больше портфелей и позиций",
      "Расширенный history retention",
    ],
  },
  whale: {
    label: "Whale",
    description: "Для крупных портфелей, high-volume tracking и плотного alerting.",
    monthlyPriceUsd: 99,
    seatsIncluded: 1,
    highlights: [
      "До 50k позиций",
      "Часовой refresh lane",
      "100 alerts и длинная история",
    ],
  },
  team: {
    label: "Team",
    description: "Для multi-seat workspace, совместной аналитики и более широкого operating envelope.",
    monthlyPriceUsd: 249,
    seatsIncluded: 5,
    highlights: [
      "5 включенных seats",
      "Максимальные лимиты по workspace",
      "Готовность к team workflow",
    ],
  },
};

function getStripePriceId(plan: SaasSubscriptionPlan) {
  const env = getEnv();

  switch (plan) {
    case "pro":
      return env.STRIPE_PRO_PRICE_ID ?? null;
    case "whale":
      return env.STRIPE_WHALE_PRICE_ID ?? null;
    case "team":
      return env.STRIPE_TEAM_PRICE_ID ?? null;
    default:
      return null;
  }
}

export function normalizeSubscriptionPlan(
  plan: SubscriptionPlan | SaasSubscriptionPlan | string | null | undefined,
): SaasSubscriptionPlan {
  const normalized = String(plan ?? "FREE").trim().toUpperCase();

  switch (normalized) {
    case "PRO":
      return "pro";
    case "WHALE":
      return "whale";
    case "TEAM":
      return "team";
    default:
      return "free";
  }
}

export function normalizeSubscriptionStatus(
  status: SubscriptionStatus | SaasSubscriptionStatus | string | null | undefined,
): SaasSubscriptionStatus {
  const normalized = String(status ?? "TRIALING").trim().toUpperCase();

  switch (normalized) {
    case "ACTIVE":
      return "active";
    case "PAST_DUE":
    case "UNPAID":
      return "past_due";
    case "CANCELED":
      return "canceled";
    case "INCOMPLETE":
    case "INCOMPLETE_EXPIRED":
      return "incomplete";
    default:
      return "trialing";
  }
}

export function toPrismaSubscriptionPlan(plan: SaasSubscriptionPlan): SubscriptionPlan {
  return plan.toUpperCase() as SubscriptionPlan;
}

export function toPrismaSubscriptionStatus(status: SaasSubscriptionStatus): SubscriptionStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "incomplete":
      return "INCOMPLETE";
    default:
      return "TRIALING";
  }
}

export function getBillingPlanCatalog(): BillingPlanCatalogItem[] {
  return (["free", "pro", "whale", "team"] as const).map((plan) => ({
    plan,
    ...PLAN_META[plan],
    limits: PLAN_LIMITS[plan],
    stripePriceId: getStripePriceId(plan),
  }));
}

export function getBillingPlanDefinition(plan: SaasSubscriptionPlan) {
  return getBillingPlanCatalog().find((entry) => entry.plan === plan) ?? getBillingPlanCatalog()[0]!;
}

export function getStripePriceIdForPlan(plan: SaasSubscriptionPlan) {
  return getBillingPlanDefinition(plan).stripePriceId;
}

export function getBillingPlanCardCatalog(currentPlan: SaasSubscriptionPlan, canCheckout: boolean) {
  return getBillingPlanCatalog().map((entry) => ({
    plan: entry.plan,
    label: entry.label,
    description: entry.description,
    monthlyPriceUsd: entry.monthlyPriceUsd,
    seatsIncluded: entry.seatsIncluded,
    highlights: entry.highlights,
    limits: entry.limits,
    stripePriceConfigured: Boolean(entry.stripePriceId),
    isCurrent: entry.plan === currentPlan,
    canCheckout: canCheckout && entry.plan !== "free" && entry.plan !== currentPlan && Boolean(entry.stripePriceId),
  }));
}