import "server-only";

import type {
  AlertDeliveryChannel,
  AlertEvent,
  AlertEventStatus,
  AlertRule,
  AlertRuleStatus,
  AlertRuleType,
  Prisma,
} from "@prisma/client";

import { canManageWorkspace } from "@/lib/auth/authorization";
import {
  getWorkspaceMembershipForUser,
  normalizeWorkspaceRole,
} from "@/lib/auth/workspace";
import { getPrismaClient } from "@/lib/db/client";
import { getEmailProvider } from "@/lib/notifications/email/provider";
import { buildSaasPortfolioAnalytics } from "@/lib/saas/portfolio-analytics";
import { pricePortfolioPositions } from "@/lib/saas/portfolio-pricing";
import type {
  AlertRuleCreateInput,
  AlertRuleUpdateInput,
} from "@/lib/saas/schema";
import { decimalToNumber, normalizeAssetCategory } from "@/lib/saas/utils";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import type {
  SaasAlertAssetOption,
  SaasAlertDirection,
  SaasAlertEventRow,
  SaasAlertPortfolioOption,
  SaasAlertRuleRow,
  SaasAlertsEvaluationResult,
  SaasAlertsWorkspaceView,
} from "@/types/saas";

type AlertRuleWithRelations = AlertRule & {
  portfolio: { id: string; name: string; baseCurrency: string } | null;
  asset: { id: string; name: string; symbol: string | null } | null;
};

type AlertEventWithRelations = AlertEvent & {
  rule: { id: string; name: string } | null;
  portfolio: { id: string; name: string } | null;
  asset: { id: string; name: string; symbol: string | null } | null;
};

type EvaluatedPortfolio = {
  id: string;
  name: string;
  baseCurrency: string;
  totalValue: number;
  positions: Awaited<ReturnType<typeof pricePortfolioPositions>>["positions"];
  analytics: ReturnType<typeof buildSaasPortfolioAnalytics>;
};

type TriggerPayload = {
  triggered: boolean;
  title?: string;
  message?: string;
  metricValue?: number | null;
  thresholdValue?: number | null;
  payload?: Record<string, unknown>;
};

type EvaluateOptions = {
  workspaceId: string;
  triggeredByUserId?: string | null;
  source: "manual" | "cron";
};

type EvaluateAllOptions = {
  source: "manual" | "cron";
  triggeredByUserId?: string | null;
  workspaceIds?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeAlertRuleType(type: AlertRuleType) {
  return type.toLowerCase() as SaasAlertRuleRow["type"];
}

function normalizeAlertRuleStatus(status: AlertRuleStatus) {
  return status.toLowerCase() as SaasAlertRuleRow["status"];
}

function normalizeAlertChannel(channel: AlertDeliveryChannel) {
  return channel.toLowerCase() as SaasAlertRuleRow["channel"];
}

function normalizeAlertEventStatus(status: AlertEventStatus) {
  return status.toLowerCase() as SaasAlertEventRow["status"];
}

function mapAlertRuleTypeToPrisma(type: AlertRuleCreateInput["type"]): AlertRuleType {
  switch (type) {
    case "price_above":
      return "PRICE_ABOVE";
    case "price_below":
      return "PRICE_BELOW";
    case "portfolio_value_change":
      return "PORTFOLIO_VALUE_CHANGE";
    case "stale_price":
      return "STALE_PRICE";
    case "concentration_risk":
      return "CONCENTRATION_RISK";
    default:
      return "PRICE_ABOVE";
  }
}

function mapAlertRuleStatusToPrisma(status: AlertRuleCreateInput["status"]): AlertRuleStatus {
  return status === "paused" ? "PAUSED" : "ACTIVE";
}

function mapDeliveryStatusToEventStatus(status: "delivered" | "failed" | "skipped"): AlertEventStatus {
  switch (status) {
    case "delivered":
      return "DELIVERED";
    case "failed":
      return "FAILED";
    default:
      return "SKIPPED";
  }
}

function extractDirection(config: Prisma.JsonValue | null | undefined): SaasAlertDirection {
  if (isRecord(config)) {
    const direction = config.direction;
    if (direction === "up" || direction === "down" || direction === "either") {
      return direction;
    }
  }

  return "either";
}

function buildAlertRuleRow(rule: AlertRuleWithRelations): SaasAlertRuleRow {
  return {
    id: rule.id,
    workspaceId: rule.workspaceId,
    portfolioId: rule.portfolioId,
    portfolioName: rule.portfolio?.name ?? null,
    assetId: rule.assetId,
    assetName: rule.asset?.name ?? null,
    assetSymbol: rule.asset?.symbol ?? null,
    type: normalizeAlertRuleType(rule.type),
    name: rule.name,
    status: normalizeAlertRuleStatus(rule.status),
    channel: normalizeAlertChannel(rule.channel),
    thresholdValue: decimalToNumber(rule.thresholdValue),
    thresholdPercent: decimalToNumber(rule.thresholdPercent),
    cooldownMinutes: rule.cooldownMinutes,
    recipientEmail: rule.recipientEmail,
    direction: extractDirection(rule.config),
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
    lastEvaluatedAt: rule.lastEvaluatedAt?.toISOString() ?? null,
    lastTriggeredAt: rule.lastTriggeredAt?.toISOString() ?? null,
  };
}

function buildAlertEventRow(event: AlertEventWithRelations): SaasAlertEventRow {
  return {
    id: event.id,
    ruleId: event.ruleId,
    ruleName: event.rule?.name ?? null,
    type: normalizeAlertRuleType(event.type),
    status: normalizeAlertEventStatus(event.status),
    channel: normalizeAlertChannel(event.channel),
    title: event.title,
    message: event.message,
    recipientEmail: event.recipientEmail,
    metricValue: decimalToNumber(event.metricValue),
    thresholdValue: decimalToNumber(event.thresholdValue),
    triggeredAt: event.triggeredAt.toISOString(),
    deliveredAt: event.deliveredAt?.toISOString() ?? null,
    portfolioId: event.portfolioId,
    portfolioName: event.portfolio?.name ?? null,
    assetId: event.assetId,
    assetName: event.asset?.name ?? null,
    assetSymbol: event.asset?.symbol ?? null,
  };
}

function getEffectivePositionPrice(position: EvaluatedPortfolio["positions"][number]) {
  return position.manualCurrentPrice ?? position.currentPrice ?? position.averageEntryPrice;
}

async function assertWorkspaceManagePermission(userId: string, workspaceId: string) {
  const membership = await getWorkspaceMembershipForUser(userId, workspaceId);

  if (!membership) {
    throw new Error("Workspace не найден или доступ к нему потерян.");
  }

  const role = normalizeWorkspaceRole(membership.role);
  if (!canManageWorkspace(role)) {
    throw new Error("Недостаточно прав для управления alert rules.");
  }

  return {
    membership,
    role,
  };
}

async function validateAlertTargets(workspaceId: string, input: AlertRuleCreateInput | AlertRuleUpdateInput) {
  const prisma = getPrismaClient();

  if (input.portfolioId) {
    const portfolio = await prisma.portfolio.findFirst({
      where: {
        id: input.portfolioId,
        workspaceId,
        isArchived: false,
      },
      select: {
        id: true,
      },
    });

    if (!portfolio) {
      throw new Error("Выбранный портфель не найден в этом workspace.");
    }
  }

  if (input.assetId) {
    const asset = await prisma.asset.findFirst({
      where: {
        id: input.assetId,
        workspaceId,
      },
      select: {
        id: true,
      },
    });

    if (!asset) {
      throw new Error("Выбранный актив не найден в этом workspace.");
    }
  }

  if (
    (input.type === "price_above" || input.type === "price_below") &&
    input.portfolioId &&
    input.assetId
  ) {
    const position = await prisma.position.findUnique({
      where: {
        portfolioId_assetId: {
          portfolioId: input.portfolioId,
          assetId: input.assetId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!position) {
      throw new Error("Выбранный актив отсутствует в указанном портфеле.");
    }
  }
}

async function fetchAlertRulesForWorkspace(workspaceId: string) {
  const prisma = getPrismaClient();
  const rules = await prisma.alertRule.findMany({
    where: {
      workspaceId,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      portfolio: {
        select: {
          id: true,
          name: true,
          baseCurrency: true,
        },
      },
      asset: {
        select: {
          id: true,
          name: true,
          symbol: true,
        },
      },
    },
  });

  return rules.map((rule) => buildAlertRuleRow(rule));
}

async function fetchAlertEventsForWorkspace(workspaceId: string, take = 50) {
  const prisma = getPrismaClient();
  const events = await prisma.alertEvent.findMany({
    where: {
      workspaceId,
    },
    take,
    orderBy: [{ triggeredAt: "desc" }, { createdAt: "desc" }],
    include: {
      rule: {
        select: {
          id: true,
          name: true,
        },
      },
      portfolio: {
        select: {
          id: true,
          name: true,
        },
      },
      asset: {
        select: {
          id: true,
          name: true,
          symbol: true,
        },
      },
    },
  });

  return events.map((event) => buildAlertEventRow(event));
}

async function buildPortfolioEvaluationMap(workspaceId: string) {
  const prisma = getPrismaClient();
  const portfolios = await prisma.portfolio.findMany({
    where: {
      workspaceId,
      isArchived: false,
    },
    include: {
      positions: {
        include: {
          asset: true,
          integration: {
            select: {
              name: true,
            },
          },
        },
      },
      transactions: {
        orderBy: [{ occurredAt: "asc" }],
        select: {
          assetId: true,
          action: true,
          occurredAt: true,
          quantity: true,
          unitPrice: true,
          fees: true,
        },
      },
      priceSnapshots: {
        orderBy: [{ capturedAt: "asc" }],
        select: {
          assetId: true,
          capturedAt: true,
          price: true,
          asset: {
            select: {
              category: true,
            },
          },
        },
      },
    },
  });

  const evaluated = await Promise.all(
    portfolios.map(async (portfolio) => {
      const priced = await pricePortfolioPositions({
        portfolioId: portfolio.id,
        baseCurrency: portfolio.baseCurrency,
        positions: portfolio.positions,
      });

      const analytics = buildSaasPortfolioAnalytics({
        baseCurrency: portfolio.baseCurrency,
        positions: priced.positions,
        transactions: portfolio.transactions,
        snapshots: portfolio.priceSnapshots,
      });

      const context: EvaluatedPortfolio = {
        id: portfolio.id,
        name: portfolio.name,
        baseCurrency: portfolio.baseCurrency,
        totalValue: priced.totalValue,
        positions: priced.positions,
        analytics,
      };

      return context;
    }),
  );

  return new Map(evaluated.map((portfolio) => [portfolio.id, portfolio]));
}

function evaluatePriceRule(rule: AlertRuleWithRelations, portfolio: EvaluatedPortfolio): TriggerPayload {
  if (!rule.assetId) {
    return { triggered: false };
  }

  const position = portfolio.positions.find((entry) => entry.assetId === rule.assetId);
  if (!position) {
    return { triggered: false };
  }

  const price = getEffectivePositionPrice(position);
  const threshold = decimalToNumber(rule.thresholdValue);
  if (price === null || threshold === null) {
    return { triggered: false };
  }

  const isAbove = rule.type === "PRICE_ABOVE";
  const triggered = isAbove ? price > threshold : price < threshold;
  if (!triggered) {
    return { triggered: false, metricValue: price, thresholdValue: threshold };
  }

  const comparisonLabel = isAbove ? "выше" : "ниже";
  return {
    triggered: true,
    title: `${position.assetName}: цена ${comparisonLabel} порога`,
    message: `Актив ${position.assetName} в портфеле ${portfolio.name} сейчас стоит ${formatCurrency(price, position.currency ?? portfolio.baseCurrency, 2)}, что ${comparisonLabel} заданного порога ${formatCurrency(threshold, position.currency ?? portfolio.baseCurrency, 2)}.`,
    metricValue: price,
    thresholdValue: threshold,
    payload: {
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      assetId: position.assetId,
      assetName: position.assetName,
      currentPrice: price,
      threshold,
      priceSource: position.priceSource,
      priceConfidenceStatus: position.priceConfidenceStatus,
    },
  };
}

function evaluatePortfolioValueChangeRule(rule: AlertRuleWithRelations, portfolio: EvaluatedPortfolio): TriggerPayload {
  const history = portfolio.analytics.totalValueHistory;
  if (history.length < 2) {
    return { triggered: false };
  }

  const current = history[history.length - 1];
  const previous = history[history.length - 2];
  if (!current || !previous || previous.totalValue <= 0) {
    return { triggered: false };
  }

  const changePercent = ((current.totalValue - previous.totalValue) / previous.totalValue) * 100;
  const thresholdPercent = decimalToNumber(rule.thresholdPercent);
  if (thresholdPercent === null) {
    return { triggered: false };
  }

  const direction = extractDirection(rule.config);
  const matchesDirection =
    direction === "either" ||
    (direction === "up" && changePercent >= 0) ||
    (direction === "down" && changePercent <= 0);
  const triggered = matchesDirection && Math.abs(changePercent) >= thresholdPercent;

  if (!triggered) {
    return {
      triggered: false,
      metricValue: changePercent,
      thresholdValue: thresholdPercent,
    };
  }

  return {
    triggered: true,
    title: `${portfolio.name}: изменение стоимости ${formatPercent(changePercent, 1)}`,
    message: `Стоимость портфеля ${portfolio.name} изменилась на ${formatPercent(changePercent, 1)} относительно предыдущей точки истории: ${formatCurrency(previous.totalValue, portfolio.baseCurrency, 2)} -> ${formatCurrency(current.totalValue, portfolio.baseCurrency, 2)}.`,
    metricValue: changePercent,
    thresholdValue: thresholdPercent,
    payload: {
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      currentValue: current.totalValue,
      previousValue: previous.totalValue,
      changePercent,
      direction,
    },
  };
}

function evaluateStalePriceRule(rule: AlertRuleWithRelations, portfoliosById: Map<string, EvaluatedPortfolio>): TriggerPayload {
  const relevantPortfolios = rule.portfolioId
    ? [portfoliosById.get(rule.portfolioId)].filter(Boolean) as EvaluatedPortfolio[]
    : [...portfoliosById.values()];

  const stalePositions = relevantPortfolios.flatMap((portfolio) =>
    portfolio.positions.filter((position) => position.priceConfidenceStatus === "stale"),
  );
  const threshold = decimalToNumber(rule.thresholdValue) ?? 1;
  const triggered = stalePositions.length >= threshold;

  if (!triggered) {
    return {
      triggered: false,
      metricValue: stalePositions.length,
      thresholdValue: threshold,
    };
  }

  const scopeLabel = rule.portfolioId && relevantPortfolios[0] ? `в портфеле ${relevantPortfolios[0].name}` : "в workspace";
  return {
    triggered: true,
    title: `Обнаружены устаревшие цены ${scopeLabel}`,
    message: `Найдено ${formatNumber(stalePositions.length, 0)} позиций с устаревшими ценами ${scopeLabel}. Это уже влияет на точность valuation и alert analytics.`,
    metricValue: stalePositions.length,
    thresholdValue: threshold,
    payload: {
      portfolioIds: relevantPortfolios.map((portfolio) => portfolio.id),
      staleAssetNames: stalePositions.slice(0, 10).map((position) => position.assetName),
      staleCount: stalePositions.length,
    },
  };
}

function evaluateConcentrationRule(rule: AlertRuleWithRelations, portfolio: EvaluatedPortfolio): TriggerPayload {
  const weight = portfolio.analytics.concentrationRisk.maxPositionWeight;
  const threshold = decimalToNumber(rule.thresholdPercent) ?? decimalToNumber(rule.thresholdValue);
  if (threshold === null) {
    return { triggered: false };
  }

  const triggered = weight >= threshold;
  if (!triggered) {
    return {
      triggered: false,
      metricValue: weight,
      thresholdValue: threshold,
    };
  }

  return {
    triggered: true,
    title: `${portfolio.name}: риск концентрации превышен`,
    message: `Крупнейшая позиция в портфеле ${portfolio.name} занимает ${formatPercent(weight, 1)}. Это выше заданного лимита ${formatPercent(threshold, 1)}.`,
    metricValue: weight,
    thresholdValue: threshold,
    payload: {
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      maxPositionWeight: weight,
      topThreeWeight: portfolio.analytics.concentrationRisk.topThreeWeight,
      summary: portfolio.analytics.concentrationRisk.summary,
    },
  };
}

function evaluateRuleAgainstContext(rule: AlertRuleWithRelations, portfoliosById: Map<string, EvaluatedPortfolio>) {
  const portfolio = rule.portfolioId ? portfoliosById.get(rule.portfolioId) : null;

  if ((rule.type === "PRICE_ABOVE" || rule.type === "PRICE_BELOW") && portfolio) {
    return evaluatePriceRule(rule, portfolio);
  }

  if (rule.type === "PORTFOLIO_VALUE_CHANGE" && portfolio) {
    return evaluatePortfolioValueChangeRule(rule, portfolio);
  }

  if (rule.type === "STALE_PRICE") {
    return evaluateStalePriceRule(rule, portfoliosById);
  }

  if (rule.type === "CONCENTRATION_RISK" && portfolio) {
    return evaluateConcentrationRule(rule, portfolio);
  }

  return { triggered: false } satisfies TriggerPayload;
}

function shouldSuppressByCooldown(rule: AlertRuleWithRelations) {
  if (!rule.lastTriggeredAt) {
    return false;
  }

  const cooldownMs = Math.max(5, rule.cooldownMinutes) * 60 * 1000;
  return Date.now() - rule.lastTriggeredAt.getTime() < cooldownMs;
}

async function createAlertEventAndDeliver(options: {
  rule: AlertRuleWithRelations;
  evaluation: Required<Pick<TriggerPayload, "title" | "message">> & TriggerPayload;
  triggeredByUserId?: string | null;
}) {
  const prisma = getPrismaClient();
  const emailProvider = getEmailProvider();
  const recipientEmail = options.rule.recipientEmail?.trim() || null;

  let deliveryStatus: AlertEventStatus = "TRIGGERED";
  let deliveredAt: Date | null = null;
  let deliveryPayload: Record<string, unknown> = {
    ...(options.evaluation.payload ?? {}),
    provider: emailProvider.id,
  };

  if (!recipientEmail) {
    deliveryStatus = "SKIPPED";
    deliveryPayload = {
      ...deliveryPayload,
      deliveryReason: "Missing recipient email.",
    };
  } else {
    const delivery = await emailProvider.send({
      to: recipientEmail,
      subject: options.evaluation.title,
      text: options.evaluation.message,
      html: `<p>${options.evaluation.message}</p>`,
    });
    deliveryStatus = mapDeliveryStatusToEventStatus(delivery.status);
    deliveredAt = delivery.status === "delivered" ? new Date() : null;
    deliveryPayload = {
      ...deliveryPayload,
      provider: delivery.provider,
      providerMessageId: delivery.messageId ?? null,
      deliveryError: delivery.error ?? null,
    };
  }

  const event = await prisma.alertEvent.create({
    data: {
      ruleId: options.rule.id,
      workspaceId: options.rule.workspaceId,
      portfolioId: options.rule.portfolioId,
      assetId: options.rule.assetId,
      type: options.rule.type,
      channel: options.rule.channel,
      status: deliveryStatus,
      title: options.evaluation.title,
      message: options.evaluation.message,
      recipientEmail,
      metricValue: options.evaluation.metricValue ?? null,
      thresholdValue: options.evaluation.thresholdValue ?? null,
      payload: deliveryPayload as Prisma.InputJsonValue,
      deliveredAt,
    },
    include: {
      rule: {
        select: {
          id: true,
          name: true,
        },
      },
      portfolio: {
        select: {
          id: true,
          name: true,
        },
      },
      asset: {
        select: {
          id: true,
          name: true,
          symbol: true,
        },
      },
    },
  });

  await prisma.alertRule.update({
    where: {
      id: options.rule.id,
    },
    data: {
      lastTriggeredAt: event.triggeredAt,
      lastEvaluatedAt: event.triggeredAt,
    },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: options.rule.workspaceId,
      portfolioId: options.rule.portfolioId,
      userId: options.triggeredByUserId ?? null,
      actorType: options.triggeredByUserId ? "USER" : "SYSTEM",
      action: "alert.triggered",
      entityType: "alert_rule",
      entityId: options.rule.id,
      severity: deliveryStatus === "FAILED" ? "WARNING" : "INFO",
      message: `Triggered alert rule ${options.rule.name} with status ${deliveryStatus.toLowerCase()}.`,
      payload: deliveryPayload as Prisma.InputJsonValue,
    },
  });

  return buildAlertEventRow(event);
}

async function markRuleEvaluated(ruleId: string) {
  const prisma = getPrismaClient();
  await prisma.alertRule.update({
    where: {
      id: ruleId,
    },
    data: {
      lastEvaluatedAt: new Date(),
    },
  });
}

function buildRuleConfig(input: AlertRuleCreateInput | AlertRuleUpdateInput) {
  return {
    direction: input.direction,
  } satisfies Record<string, unknown>;
}

export async function getAlertsWorkspaceViewForUser(
  userId: string,
  workspaceId: string,
): Promise<SaasAlertsWorkspaceView | null> {
  const membership = await getWorkspaceMembershipForUser(userId, workspaceId);

  if (!membership) {
    return null;
  }

  const role = normalizeWorkspaceRole(membership.role);
  const canManage = canManageWorkspace(role);
  const prisma = getPrismaClient();

  const [user, portfolios, rules, events] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        email: true,
      },
    }),
    prisma.portfolio.findMany({
      where: {
        workspaceId,
        isArchived: false,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: {
        positions: {
          orderBy: [{ updatedAt: "desc" }],
          include: {
            asset: {
              select: {
                id: true,
                name: true,
                symbol: true,
                category: true,
              },
            },
          },
        },
      },
    }),
    fetchAlertRulesForWorkspace(workspaceId),
    fetchAlertEventsForWorkspace(workspaceId),
  ]);

  const portfolioOptions: SaasAlertPortfolioOption[] = portfolios.map((portfolio) => ({
    id: portfolio.id,
    name: portfolio.name,
    baseCurrency: portfolio.baseCurrency,
    assetCount: portfolio.positions.length,
  }));

  const assetOptions: SaasAlertAssetOption[] = portfolios.flatMap((portfolio) =>
    portfolio.positions.map((position) => ({
      assetId: position.asset.id,
      portfolioId: portfolio.id,
      assetName: position.asset.name,
      symbol: position.asset.symbol,
      category: normalizeAssetCategory(position.asset.category),
    })),
  );

  return {
    workspaceId,
    workspaceName: membership.workspace.name,
    workspaceSlug: membership.workspace.slug,
    defaultCurrency: membership.workspace.defaultCurrency,
    role,
    canManage,
    defaultRecipientEmail: user?.email ?? null,
    portfolios: portfolioOptions,
    assets: assetOptions,
    rules,
    events,
  };
}

export async function createAlertRuleForWorkspace(
  userId: string,
  workspaceId: string,
  input: AlertRuleCreateInput,
) {
  await assertWorkspaceManagePermission(userId, workspaceId);
  await validateAlertTargets(workspaceId, input);

  const prisma = getPrismaClient();
  const rule = await prisma.alertRule.create({
    data: {
      workspaceId,
      portfolioId: input.portfolioId ?? null,
      assetId: input.assetId ?? null,
      createdByUserId: userId,
      name: input.name,
      type: mapAlertRuleTypeToPrisma(input.type),
      status: mapAlertRuleStatusToPrisma(input.status),
      channel: "EMAIL",
      thresholdValue: input.thresholdValue ?? null,
      thresholdPercent: input.thresholdPercent ?? null,
      cooldownMinutes: input.cooldownMinutes,
      recipientEmail: input.recipientEmail ?? null,
      config: buildRuleConfig(input) as Prisma.InputJsonValue,
    },
    include: {
      portfolio: {
        select: {
          id: true,
          name: true,
          baseCurrency: true,
        },
      },
      asset: {
        select: {
          id: true,
          name: true,
          symbol: true,
        },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId,
      portfolioId: rule.portfolioId,
      userId,
      actorType: "USER",
      action: "alert.rule.create",
      entityType: "alert_rule",
      entityId: rule.id,
      severity: "INFO",
      message: `Created alert rule ${rule.name}.`,
      payload: {
        type: input.type,
        status: input.status,
      },
    },
  });

  return buildAlertRuleRow(rule);
}

export async function updateAlertRuleById(
  userId: string,
  workspaceId: string,
  ruleId: string,
  input: AlertRuleUpdateInput,
) {
  await assertWorkspaceManagePermission(userId, workspaceId);
  await validateAlertTargets(workspaceId, input);

  const prisma = getPrismaClient();
  const existingRule = await prisma.alertRule.findFirst({
    where: {
      id: ruleId,
      workspaceId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!existingRule) {
    throw new Error("Alert rule не найден.");
  }

  const rule = await prisma.alertRule.update({
    where: {
      id: ruleId,
    },
    data: {
      name: input.name,
      type: mapAlertRuleTypeToPrisma(input.type),
      status: mapAlertRuleStatusToPrisma(input.status),
      portfolioId: input.portfolioId ?? null,
      assetId: input.assetId ?? null,
      thresholdValue: input.thresholdValue ?? null,
      thresholdPercent: input.thresholdPercent ?? null,
      cooldownMinutes: input.cooldownMinutes,
      recipientEmail: input.recipientEmail ?? null,
      config: buildRuleConfig(input) as Prisma.InputJsonValue,
    },
    include: {
      portfolio: {
        select: {
          id: true,
          name: true,
          baseCurrency: true,
        },
      },
      asset: {
        select: {
          id: true,
          name: true,
          symbol: true,
        },
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId,
      portfolioId: rule.portfolioId,
      userId,
      actorType: "USER",
      action: "alert.rule.update",
      entityType: "alert_rule",
      entityId: rule.id,
      severity: "INFO",
      message: `Updated alert rule ${existingRule.name}.`,
      payload: {
        type: input.type,
        status: input.status,
      },
    },
  });

  return buildAlertRuleRow(rule);
}

export async function deleteAlertRuleById(userId: string, workspaceId: string, ruleId: string) {
  await assertWorkspaceManagePermission(userId, workspaceId);

  const prisma = getPrismaClient();
  const existingRule = await prisma.alertRule.findFirst({
    where: {
      id: ruleId,
      workspaceId,
    },
    select: {
      id: true,
      name: true,
      portfolioId: true,
    },
  });

  if (!existingRule) {
    throw new Error("Alert rule не найден.");
  }

  await prisma.alertRule.delete({
    where: {
      id: ruleId,
    },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId,
      portfolioId: existingRule.portfolioId,
      userId,
      actorType: "USER",
      action: "alert.rule.delete",
      entityType: "alert_rule",
      entityId: ruleId,
      severity: "WARNING",
      message: `Deleted alert rule ${existingRule.name}.`,
    },
  });

  return {
    id: ruleId,
    deleted: true,
  };
}

export async function evaluateAlertRulesForWorkspace(options: EvaluateOptions): Promise<SaasAlertsEvaluationResult> {
  const prisma = getPrismaClient();
  const activeRules = await prisma.alertRule.findMany({
    where: {
      workspaceId: options.workspaceId,
      status: "ACTIVE",
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    include: {
      portfolio: {
        select: {
          id: true,
          name: true,
          baseCurrency: true,
        },
      },
      asset: {
        select: {
          id: true,
          name: true,
          symbol: true,
        },
      },
    },
  });

  if (activeRules.length === 0) {
    return {
      checkedRules: 0,
      triggeredRules: 0,
      deliveredEvents: 0,
      failedEvents: 0,
      skippedEvents: 0,
      suppressedByCooldown: 0,
      events: [],
    };
  }

  const portfoliosById = await buildPortfolioEvaluationMap(options.workspaceId);
  const result: SaasAlertsEvaluationResult = {
    checkedRules: activeRules.length,
    triggeredRules: 0,
    deliveredEvents: 0,
    failedEvents: 0,
    skippedEvents: 0,
    suppressedByCooldown: 0,
    events: [],
  };

  for (const rule of activeRules) {
    const evaluation = evaluateRuleAgainstContext(rule, portfoliosById);

    if (!evaluation.triggered || !evaluation.title || !evaluation.message) {
      await markRuleEvaluated(rule.id);
      continue;
    }

    if (shouldSuppressByCooldown(rule)) {
      result.suppressedByCooldown += 1;
      await markRuleEvaluated(rule.id);
      continue;
    }

    result.triggeredRules += 1;
    const event = await createAlertEventAndDeliver({
      rule,
      evaluation: {
        ...evaluation,
        title: evaluation.title,
        message: evaluation.message,
      },
      triggeredByUserId: options.triggeredByUserId,
    });

    if (event.status === "delivered") {
      result.deliveredEvents += 1;
    } else if (event.status === "failed") {
      result.failedEvents += 1;
    } else {
      result.skippedEvents += 1;
    }

    result.events.push(event);
  }

  await prisma.auditLog.create({
    data: {
      workspaceId: options.workspaceId,
      userId: options.triggeredByUserId ?? null,
      actorType: options.triggeredByUserId ? "USER" : "SYSTEM",
      action: "alert.evaluate",
      entityType: "workspace",
      entityId: options.workspaceId,
      severity: result.failedEvents > 0 ? "WARNING" : "INFO",
      message: `Evaluated ${result.checkedRules} alert rules via ${options.source}.`,
      payload: result as unknown as Prisma.InputJsonValue,
    },
  });

  return result;
}

export async function evaluateAlertRulesForWorkspaces(options: EvaluateAllOptions) {
  const prisma = getPrismaClient();
  const workspaceIds = options.workspaceIds
    ? [...new Set(options.workspaceIds)]
    : [
        ...new Set(
          (
            await prisma.alertRule.findMany({
              where: {
                status: "ACTIVE",
              },
              select: {
                workspaceId: true,
              },
            })
          ).map((rule) => rule.workspaceId),
        ),
      ];

  const summaries: Array<{ workspaceId: string; result: SaasAlertsEvaluationResult }> = [];
  for (const workspaceId of workspaceIds) {
    summaries.push({
      workspaceId,
      result: await evaluateAlertRulesForWorkspace({
        workspaceId,
        triggeredByUserId: options.triggeredByUserId,
        source: options.source,
      }),
    });
  }

  return summaries;
}



