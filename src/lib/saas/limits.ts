import "server-only";

import type { Prisma } from "@prisma/client";

import { getWorkspaceMembershipForUser } from "@/lib/auth/workspace";
import { getPrismaClient } from "@/lib/db/client";
import {
  getBillingPlanDefinition,
  normalizeSubscriptionPlan,
  normalizeSubscriptionStatus,
} from "@/lib/saas/billing/plans";
import { decimalToNumber } from "@/lib/saas/utils";
import type {
  SaasBillingUsageMetric,
  SaasSubscriptionPlan,
  SaasUsageLimitKey,
  SaasWorkspaceLimitEnvelope,
  SaasWorkspaceLimitOverrides,
  SaasWorkspaceLimitSnapshot,
} from "@/types/saas";

type PrismaLimitClient = ReturnType<typeof getPrismaClient> | Prisma.TransactionClient;

type WorkspaceLimitRecord = {
  id: string;
  subscription: {
    plan: string;
    status: string;
    overrideLimitsEnabled: boolean;
    overridePortfolioLimit: number | null;
    overridePositionLimit: number | null;
    overrideIntegrationLimit: number | null;
    overrideAlertLimit: number | null;
    overridePriceRefreshHours: Prisma.Decimal | null;
    overrideHistoryRetentionDays: number | null;
    overrideNotes: string | null;
  } | null;
  _count: {
    portfolios: number;
    integrations: number;
  };
};

const NEAR_LIMIT_THRESHOLD = 0.8;

const COUNT_LIMIT_META: Record<SaasUsageLimitKey, { label: string; unit: string }> = {
  portfolios: { label: "Портфели", unit: "шт." },
  positions: { label: "Позиции", unit: "шт." },
  integrations: { label: "Интеграции", unit: "шт." },
  alerts: { label: "Alerts", unit: "шт." },
};

function createUsageMetric(key: SaasUsageLimitKey, used: number, limit: number | null): SaasBillingUsageMetric {
  const utilizationPercent = limit !== null && limit > 0 ? Math.min((used / limit) * 100, 100) : null;
  const isExceeded = limit !== null && used >= limit;
  const isNearLimit = limit !== null && !isExceeded && limit > 0 && used / limit >= NEAR_LIMIT_THRESHOLD;

  return {
    key,
    label: COUNT_LIMIT_META[key].label,
    used,
    limit,
    remaining: limit === null ? null : Math.max(limit - used, 0),
    unit: COUNT_LIMIT_META[key].unit,
    utilizationPercent,
    isNearLimit,
    isExceeded,
  };
}

function buildOverrideSummary(subscription: WorkspaceLimitRecord["subscription"]): SaasWorkspaceLimitOverrides {
  const enabled = subscription?.overrideLimitsEnabled ?? false;
  const portfolios = subscription?.overridePortfolioLimit ?? null;
  const positions = subscription?.overridePositionLimit ?? null;
  const integrations = subscription?.overrideIntegrationLimit ?? null;
  const priceRefreshHours = decimalToNumber(subscription?.overridePriceRefreshHours);
  const alerts = subscription?.overrideAlertLimit ?? null;
  const historyRetentionDays = subscription?.overrideHistoryRetentionDays ?? null;

  return {
    enabled,
    portfolios,
    positions,
    integrations,
    priceRefreshHours,
    alerts,
    historyRetentionDays,
    notes: subscription?.overrideNotes ?? null,
    isAnyApplied: enabled && [portfolios, positions, integrations, priceRefreshHours, alerts, historyRetentionDays].some((value) => value !== null),
  };
}

function buildEffectiveLimits(plan: SaasSubscriptionPlan, overrides: SaasWorkspaceLimitOverrides): SaasWorkspaceLimitEnvelope {
  const planLimits = getBillingPlanDefinition(plan).limits;

  if (!overrides.enabled) {
    return planLimits;
  }

  return {
    portfolios: overrides.portfolios ?? planLimits.portfolios,
    positions: overrides.positions ?? planLimits.positions,
    integrations: overrides.integrations ?? planLimits.integrations,
    priceRefreshHours: overrides.priceRefreshHours ?? planLimits.priceRefreshHours,
    alerts: overrides.alerts ?? planLimits.alerts,
    historyRetentionDays: overrides.historyRetentionDays ?? planLimits.historyRetentionDays,
  };
}

async function loadWorkspaceLimitRecord(client: PrismaLimitClient, workspaceId: string): Promise<WorkspaceLimitRecord | null> {
  return client.workspace.findFirst({
    where: {
      id: workspaceId,
      isArchived: false,
    },
    select: {
      id: true,
      subscription: {
        select: {
          plan: true,
          status: true,
          overrideLimitsEnabled: true,
          overridePortfolioLimit: true,
          overridePositionLimit: true,
          overrideIntegrationLimit: true,
          overrideAlertLimit: true,
          overridePriceRefreshHours: true,
          overrideHistoryRetentionDays: true,
          overrideNotes: true,
        },
      },
      _count: {
        select: {
          portfolios: {
            where: {
              isArchived: false,
            },
          },
          integrations: true,
        },
      },
    },
  });
}

function getCountMetric(snapshot: SaasWorkspaceLimitSnapshot, key: SaasUsageLimitKey) {
  return snapshot.usage.find((metric) => metric.key === key) ?? null;
}

export function getPriceRefreshWindowMs(snapshot: SaasWorkspaceLimitSnapshot) {
  const hours = snapshot.effectiveLimits.priceRefreshHours;
  return hours !== null && hours > 0 ? hours * 60 * 60 * 1000 : null;
}

export function getHistoryRetentionCutoffDate(snapshot: SaasWorkspaceLimitSnapshot, now = Date.now()) {
  const days = snapshot.effectiveLimits.historyRetentionDays;
  if (days === null || days <= 0) {
    return null;
  }

  return new Date(now - days * 24 * 60 * 60 * 1000);
}

export class WorkspaceLimitError extends Error {
  readonly limitKey: SaasUsageLimitKey;
  readonly plan: SaasSubscriptionPlan;
  readonly used: number;
  readonly limit: number;
  readonly requestedDelta: number;

  constructor(options: { limitKey: SaasUsageLimitKey; plan: SaasSubscriptionPlan; used: number; limit: number; requestedDelta: number }) {
    const label = COUNT_LIMIT_META[options.limitKey].label.toLowerCase();
    super(`Достигнут лимит тарифа по категории «${label}»: ${options.used} из ${options.limit}. Откройте Billing и повысьте тариф или включите admin override.`);
    this.name = "WorkspaceLimitError";
    this.limitKey = options.limitKey;
    this.plan = options.plan;
    this.used = options.used;
    this.limit = options.limit;
    this.requestedDelta = options.requestedDelta;
  }
}

export function isWorkspaceLimitError(error: unknown): error is WorkspaceLimitError {
  return error instanceof WorkspaceLimitError;
}

export async function getWorkspaceLimitSnapshot(workspaceId: string, client: PrismaLimitClient = getPrismaClient()): Promise<SaasWorkspaceLimitSnapshot | null> {
  const workspace = await loadWorkspaceLimitRecord(client, workspaceId);
  if (!workspace) {
    return null;
  }

  const [positionCount, alertCount] = await Promise.all([
    client.position.count({
      where: {
        portfolio: {
          workspaceId,
          isArchived: false,
        },
      },
    }),
    client.alertRule.count({
      where: {
        workspaceId,
      },
    }),
  ]);

  const subscription = workspace.subscription;
  const normalizedPlan = normalizeSubscriptionPlan(subscription?.plan);
  const normalizedStatus = normalizeSubscriptionStatus(subscription?.status);
  const overrides = buildOverrideSummary(subscription);
  const effectiveLimits = buildEffectiveLimits(normalizedPlan, overrides);
  const usage = [
    createUsageMetric("portfolios", workspace._count.portfolios, effectiveLimits.portfolios),
    createUsageMetric("positions", positionCount, effectiveLimits.positions),
    createUsageMetric("integrations", workspace._count.integrations, effectiveLimits.integrations),
    createUsageMetric("alerts", alertCount, effectiveLimits.alerts),
  ];

  const warnings = new Set<string>();
  if (overrides.enabled) {
    warnings.add(overrides.isAnyApplied ? "Для workspace включен admin override limits. Effective limits могут отличаться от публичного плана." : "Флаг admin override включен, но конкретные override-поля не заданы. Используются базовые лимиты тарифа.");
  }

  for (const metric of usage) {
    if (metric.isExceeded) {
      warnings.add(`${metric.label}: достигнут лимит тарифа (${metric.used}/${metric.limit ?? 0}). Дальнейшие write-операции будут отклоняться.`);
      continue;
    }

    if (metric.isNearLimit && metric.remaining !== null) {
      warnings.add(`${metric.label}: до лимита осталось ${metric.remaining} ${metric.unit}. Рекомендуется обновить тариф заранее.`);
    }
  }

  return {
    workspaceId,
    plan: normalizedPlan,
    status: normalizedStatus,
    effectiveLimits,
    usage,
    overrides,
    warnings: [...warnings],
  };
}

export async function getWorkspaceLimitSnapshotForUser(userId: string, workspaceId: string) {
  const membership = await getWorkspaceMembershipForUser(userId, workspaceId);
  if (!membership) {
    return null;
  }

  return getWorkspaceLimitSnapshot(workspaceId);
}

export async function assertWorkspaceCountLimit(workspaceId: string, key: SaasUsageLimitKey, requestedDelta = 1, client: PrismaLimitClient = getPrismaClient()) {
  const snapshot = await getWorkspaceLimitSnapshot(workspaceId, client);
  if (!snapshot) {
    throw new Error("Workspace не найден или архивирован.");
  }

  if (requestedDelta <= 0) {
    return snapshot;
  }

  const metric = getCountMetric(snapshot, key);
  if (!metric) {
    return snapshot;
  }

  if (metric.limit !== null && metric.used + requestedDelta > metric.limit) {
    throw new WorkspaceLimitError({
      limitKey: key,
      plan: snapshot.plan,
      used: metric.used,
      limit: metric.limit,
      requestedDelta,
    });
  }

  return snapshot;
}