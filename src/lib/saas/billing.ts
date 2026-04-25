import "server-only";

import type { Prisma, SubscriptionPlan, SubscriptionStatus } from "@prisma/client";

import { canManageWorkspace } from "@/lib/auth/authorization";
import { getWorkspaceMembershipForUser, normalizeWorkspaceRole } from "@/lib/auth/workspace";
import { getPrismaClient } from "@/lib/db/client";
import {
  getEnv,
  isStripeBillingConfigured,
  isStripeWebhookConfigured,
} from "@/lib/env";
import {
  getBillingPlanCardCatalog,
  getBillingPlanDefinition,
  getStripePriceIdForPlan,
  normalizeSubscriptionPlan,
  normalizeSubscriptionStatus,
  toPrismaSubscriptionPlan,
  toPrismaSubscriptionStatus,
} from "@/lib/saas/billing/plans";
import {
  createStripeCheckoutSession,
  createStripeCustomer,
  createStripeCustomerPortalSession,
  verifyStripeWebhookEvent,
} from "@/lib/saas/billing/stripe-client";
import type {
  SaasSubscriptionPlan,
  SaasSubscriptionStatus,
  SaasWorkspaceBillingSummary,
} from "@/types/saas";

type BillingWorkspaceContext = {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  role: ReturnType<typeof normalizeWorkspaceRole>;
  canManage: boolean;
};

type StripeSubscriptionPatch = {
  plan?: SubscriptionPlan;
  status?: SubscriptionStatus;
  billingProvider?: string | null;
  billingCustomerId?: string | null;
  billingSubscriptionId?: string | null;
  seatCount?: number;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  trialEndsAt?: Date | null;
  cancelAtPeriodEnd?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function getObject(value: unknown) {
  return isRecord(value) ? value : null;
}

function getMetadata(value: unknown) {
  if (!isRecord(value)) {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0)
      .map(([key, item]) => [key, item.trim()]),
  );
}

function unixToDate(value: unknown) {
  const timestamp = getNumber(value);
  return timestamp !== null ? new Date(timestamp * 1000) : null;
}

function toIsoString(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function getBaseUrl(origin: string) {
  const env = getEnv();
  return env.NEXTAUTH_URL?.trim() || env.NEXT_PUBLIC_SITE_URL?.trim() || origin;
}

function getWorkspaceReturnUrl(origin: string, query?: string) {
  const baseUrl = getBaseUrl(origin).replace(/\/$/, "");
  const suffix = query ? `?${query}` : "";
  return `${baseUrl}/app/billing${suffix}`;
}

function isManagedStripeSubscription(plan: SaasSubscriptionPlan, status: SaasSubscriptionStatus, billingSubscriptionId: string | null) {
  return Boolean(
    billingSubscriptionId &&
      plan !== "free" &&
      (status === "active" || status === "trialing" || status === "past_due"),
  );
}

async function resolveWorkspaceBillingContext(userId: string, workspaceId: string): Promise<BillingWorkspaceContext | null> {
  const membership = await getWorkspaceMembershipForUser(userId, workspaceId);

  if (!membership) {
    return null;
  }

  const role = normalizeWorkspaceRole(membership.role);
  return {
    workspaceId: membership.workspaceId,
    workspaceName: membership.workspace.name,
    workspaceSlug: membership.workspace.slug,
    role,
    canManage: canManageWorkspace(role),
  };
}

async function loadWorkspaceBillingRecord(workspaceId: string) {
  const prisma = getPrismaClient();

  return prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      isArchived: false,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      owner: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
      subscription: true,
      _count: {
        select: {
          portfolios: true,
          integrations: true,
        },
      },
    },
  });
}

function buildDefaultSubscriptionSummary() {
  return {
    plan: "free" as SaasSubscriptionPlan,
    status: "active" as SaasSubscriptionStatus,
    billingProvider: null,
    billingCustomerId: null,
    billingSubscriptionId: null,
    seatCount: 1,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
  };
}

function mapSubscriptionRecord(
  record: NonNullable<Awaited<ReturnType<typeof loadWorkspaceBillingRecord>>>["subscription"],
) {
  if (!record) {
    return buildDefaultSubscriptionSummary();
  }

  return {
    plan: normalizeSubscriptionPlan(record.plan),
    status: normalizeSubscriptionStatus(record.status),
    billingProvider: record.billingProvider,
    billingCustomerId: record.billingCustomerId,
    billingSubscriptionId: record.billingSubscriptionId,
    seatCount: record.seatCount,
    currentPeriodStart: toIsoString(record.currentPeriodStart),
    currentPeriodEnd: toIsoString(record.currentPeriodEnd),
    trialEndsAt: toIsoString(record.trialEndsAt),
    cancelAtPeriodEnd: record.cancelAtPeriodEnd,
  };
}

function createUsageMetric(label: string, key: string, used: number, limit: number | null, unit: string) {
  return {
    key,
    label,
    used,
    limit,
    remaining: limit === null ? null : Math.max(limit - used, 0),
    unit,
  };
}

export async function getWorkspaceBillingSummaryForUser(
  userId: string,
  workspaceId: string,
): Promise<SaasWorkspaceBillingSummary | null> {
  const context = await resolveWorkspaceBillingContext(userId, workspaceId);
  if (!context) {
    return null;
  }

  const prisma = getPrismaClient();
  const [workspace, positionCount, alertCount] = await Promise.all([
    loadWorkspaceBillingRecord(workspaceId),
    prisma.position.count({
      where: {
        portfolio: {
          workspaceId,
          isArchived: false,
        },
      },
    }),
    prisma.alertRule.count({
      where: {
        workspaceId,
      },
    }),
  ]);

  if (!workspace) {
    return null;
  }

  const currentSubscription = mapSubscriptionRecord(workspace.subscription);
  const currentPlanDefinition = getBillingPlanDefinition(currentSubscription.plan);
  const providerConfigured = isStripeBillingConfigured();
  const webhookConfigured = isStripeWebhookConfigured();
  const customerPortalReady = Boolean(providerConfigured && currentSubscription.billingCustomerId);
  const managedByPortal = isManagedStripeSubscription(
    currentSubscription.plan,
    currentSubscription.status,
    currentSubscription.billingSubscriptionId,
  );

  const warnings = new Set<string>();
  if (!providerConfigured) {
    warnings.add("Stripe env РµС‰Рµ РЅРµ РЅР°СЃС‚СЂРѕРµРЅ. Checkout Рё Customer Portal РїРѕРєР° РЅРµРґРѕСЃС‚СѓРїРЅС‹.");
  }
  if (providerConfigured && !webhookConfigured) {
    warnings.add("STRIPE_WEBHOOK_SECRET РЅРµ РЅР°СЃС‚СЂРѕРµРЅ. Checkout СЃРјРѕР¶РµС‚ РѕС‚РєСЂС‹РІР°С‚СЊСЃСЏ, РЅРѕ sync СЃС‚Р°С‚СѓСЃР° РёР· Stripe Р±СѓРґРµС‚ РЅРµРїРѕР»РЅС‹Рј.");
  }
  if (providerConfigured && currentSubscription.plan !== "free" && !currentSubscription.billingSubscriptionId) {
    warnings.add("Р”Р»СЏ РїР»Р°С‚РЅРѕРіРѕ РїР»Р°РЅР° РµС‰Рµ РЅРµС‚ Stripe subscription id. РџСЂРѕРІРµСЂСЊ webhook flow РёР»Рё checkout completion.");
  }
  if (managedByPortal) {
    warnings.add("Р”Р»СЏ Р°РєС‚РёРІРЅРѕР№ РїР»Р°С‚РЅРѕР№ РїРѕРґРїРёСЃРєРё СЃРјРµРЅР° РїР»Р°РЅР° РґРѕР»Р¶РЅР° РёРґС‚Рё С‡РµСЂРµР· Stripe Customer Portal, Р° РЅРµ С‡РµСЂРµР· РЅРѕРІС‹Р№ Checkout.");
  }

  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    workspaceSlug: workspace.slug,
    role: context.role,
    canManage: context.canManage,
    providerConfigured,
    webhookConfigured,
    customerPortalReady,
    currentSubscription,
    usage: [
      createUsageMetric(
        "РџРѕСЂС‚С„РµР»Рё",
        "portfolios",
        workspace._count.portfolios,
        currentPlanDefinition.limits.portfolios,
        "С€С‚.",
      ),
      createUsageMetric(
        "РџРѕР·РёС†РёРё",
        "positions",
        positionCount,
        currentPlanDefinition.limits.positions,
        "С€С‚.",
      ),
      createUsageMetric(
        "РРЅС‚РµРіСЂР°С†РёРё",
        "integrations",
        workspace._count.integrations,
        currentPlanDefinition.limits.integrations,
        "С€С‚.",
      ),
      createUsageMetric(
        "Alerts",
        "alerts",
        alertCount,
        currentPlanDefinition.limits.alerts,
        "С€С‚.",
      ),
    ],
    plans: getBillingPlanCardCatalog(currentSubscription.plan, context.canManage && providerConfigured && !managedByPortal),
    warnings: [...warnings],
  };
}

async function ensureBillingMutationAccess(userId: string, workspaceId: string) {
  const context = await resolveWorkspaceBillingContext(userId, workspaceId);

  if (!context) {
    throw new Error("Workspace РЅРµ РЅР°Р№РґРµРЅ РёР»Рё РґРѕСЃС‚СѓРї Рє РЅРµРјСѓ РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚.");
  }

  if (!context.canManage) {
    throw new Error("РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ Р±РёР»Р»РёРЅРіРѕРј СЌС‚РѕРіРѕ workspace.");
  }

  return context;
}

async function ensureStripeCustomerForWorkspace(workspaceId: string) {
  const prisma = getPrismaClient();
  const workspace = await loadWorkspaceBillingRecord(workspaceId);

  if (!workspace) {
    throw new Error("Workspace РґР»СЏ billing РЅРµ РЅР°Р№РґРµРЅ.");
  }

  if (workspace.subscription?.billingCustomerId) {
    return {
      workspace,
      customerId: workspace.subscription.billingCustomerId,
    };
  }

  const customer = await createStripeCustomer({
    email: workspace.owner.email,
    name: workspace.owner.displayName ?? workspace.name,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
  });

  await prisma.subscription.upsert({
    where: {
      workspaceId: workspace.id,
    },
    update: {
      billingProvider: "stripe",
      billingCustomerId: customer.id,
      seatCount: workspace.subscription?.seatCount ?? 1,
    },
    create: {
      workspaceId: workspace.id,
      plan: workspace.subscription?.plan ?? "FREE",
      status: workspace.subscription?.status ?? "ACTIVE",
      billingProvider: "stripe",
      billingCustomerId: customer.id,
      seatCount: workspace.subscription?.seatCount ?? 1,
    },
  });

  return {
    workspace: await loadWorkspaceBillingRecord(workspaceId),
    customerId: customer.id,
  };
}

export async function createCheckoutSessionForWorkspace(params: {
  userId: string;
  workspaceId: string;
  selectedPlan: SaasSubscriptionPlan;
  origin: string;
}) {
  if (!isStripeBillingConfigured()) {
    throw new Error("Stripe billing РµС‰Рµ РЅРµ РЅР°СЃС‚СЂРѕРµРЅ РґР»СЏ СЌС‚РѕРіРѕ РѕРєСЂСѓР¶РµРЅРёСЏ.");
  }

  if (params.selectedPlan === "free") {
    throw new Error("Р”Р»СЏ Р±РµСЃРїР»Р°С‚РЅРѕРіРѕ РїР»Р°РЅР° checkout РЅРµ РЅСѓР¶РµРЅ.");
  }

  await ensureBillingMutationAccess(params.userId, params.workspaceId);

  const { workspace, customerId } = await ensureStripeCustomerForWorkspace(params.workspaceId);
  if (!workspace) {
    throw new Error("Workspace РґР»СЏ billing РЅРµ РЅР°Р№РґРµРЅ.");
  }

  const currentSubscription = mapSubscriptionRecord(workspace.subscription);
  if (
    currentSubscription.plan === params.selectedPlan &&
    (currentSubscription.status === "active" || currentSubscription.status === "trialing")
  ) {
    throw new Error("Р­С‚РѕС‚ С‚Р°СЂРёС„ СѓР¶Рµ Р°РєС‚РёРІРµРЅ РґР»СЏ С‚РµРєСѓС‰РµРіРѕ workspace.");
  }

  if (
    isManagedStripeSubscription(
      currentSubscription.plan,
      currentSubscription.status,
      currentSubscription.billingSubscriptionId,
    )
  ) {
    throw new Error("Р”Р»СЏ СЃРјРµРЅС‹ Р°РєС‚РёРІРЅРѕРіРѕ РїР»Р°С‚РЅРѕРіРѕ С‚Р°СЂРёС„Р° РёСЃРїРѕР»СЊР·СѓР№С‚Рµ Stripe Customer Portal.");
  }

  const priceId = getStripePriceIdForPlan(params.selectedPlan);
  if (!priceId) {
    throw new Error("Р”Р»СЏ РІС‹Р±СЂР°РЅРЅРѕРіРѕ С‚Р°СЂРёС„Р° РµС‰Рµ РЅРµ Р·Р°РґР°РЅ Stripe price id.");
  }

  const checkout = await createStripeCheckoutSession({
    customerId,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    selectedPlan: params.selectedPlan,
    priceId,
    successUrl: getWorkspaceReturnUrl(params.origin, `checkout=success&plan=${params.selectedPlan}`),
    cancelUrl: getWorkspaceReturnUrl(params.origin, `checkout=cancel&plan=${params.selectedPlan}`),
    seatCount: Math.max(workspace.subscription?.seatCount ?? 1, 1),
  });

  if (!checkout.url) {
    throw new Error("Stripe checkout session РЅРµ РІРµСЂРЅСѓР»Р° redirect URL.");
  }

  const prisma = getPrismaClient();
  await prisma.subscription.upsert({
    where: {
      workspaceId: workspace.id,
    },
    update: {
      billingProvider: "stripe",
      billingCustomerId: customerId,
    },
    create: {
      workspaceId: workspace.id,
      plan: workspace.subscription?.plan ?? "FREE",
      status: workspace.subscription?.status ?? "ACTIVE",
      billingProvider: "stripe",
      billingCustomerId: customerId,
      seatCount: workspace.subscription?.seatCount ?? 1,
    },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId: workspace.id,
      userId: params.userId,
      actorType: "USER",
      action: "billing.checkout.create",
      entityType: "subscription",
      entityId: workspace.subscription?.id ?? workspace.id,
      severity: "INFO",
      message: "Created Stripe checkout session for workspace subscription.",
      payload: {
        selectedPlan: params.selectedPlan,
        checkoutSessionId: checkout.id,
      },
    },
  });

  return {
    sessionId: checkout.id,
    url: checkout.url,
  };
}

export async function createCustomerPortalSessionForWorkspace(params: {
  userId: string;
  workspaceId: string;
  origin: string;
}) {
  if (!isStripeBillingConfigured()) {
    throw new Error("Stripe billing РµС‰Рµ РЅРµ РЅР°СЃС‚СЂРѕРµРЅ РґР»СЏ СЌС‚РѕРіРѕ РѕРєСЂСѓР¶РµРЅРёСЏ.");
  }

  await ensureBillingMutationAccess(params.userId, params.workspaceId);

  const workspace = await loadWorkspaceBillingRecord(params.workspaceId);
  if (!workspace) {
    throw new Error("Workspace РґР»СЏ Customer Portal РЅРµ РЅР°Р№РґРµРЅ.");
  }

  const customerId = workspace.subscription?.billingCustomerId;
  if (!customerId) {
    throw new Error("Customer Portal СЃС‚Р°РЅРµС‚ РґРѕСЃС‚СѓРїРµРЅ РїРѕСЃР»Рµ РїРµСЂРІРѕР№ СѓСЃРїРµС€РЅРѕР№ Stripe checkout СЃРµСЃСЃРёРё.");
  }

  const portalSession = await createStripeCustomerPortalSession({
    customerId,
    returnUrl: getWorkspaceReturnUrl(params.origin, "portal=returned"),
  });

  if (!portalSession.url) {
    throw new Error("Stripe Customer Portal РЅРµ РІРµСЂРЅСѓР» redirect URL.");
  }

  const prisma = getPrismaClient();
  await prisma.auditLog.create({
    data: {
      workspaceId: workspace.id,
      userId: params.userId,
      actorType: "USER",
      action: "billing.portal.create",
      entityType: "subscription",
      entityId: workspace.subscription?.id ?? workspace.id,
      severity: "INFO",
      message: "Created Stripe customer portal session.",
      payload: {
        portalSessionId: portalSession.id,
      },
    },
  });

  return {
    sessionId: portalSession.id,
    url: portalSession.url,
  };
}

function extractStripeSubscriptionPriceIds(object: Record<string, unknown>) {
  const items = getObject(object.items);
  const data = Array.isArray(items?.data) ? items.data : [];

  return data
    .map((item) => getString(getObject(getObject(item)?.price)?.id))
    .filter((value): value is string => Boolean(value));
}

function resolvePlanFromStripeData(params: {
  metadata: Record<string, string>;
  priceIds?: string[];
  fallbackPlan?: SubscriptionPlan | null;
}) {
  const metadataPlan = normalizeSubscriptionPlan(
    params.metadata.selectedPlan ?? params.metadata.plan ?? params.fallbackPlan ?? null,
  );

  if (metadataPlan !== "free") {
    return toPrismaSubscriptionPlan(metadataPlan);
  }

  const catalog = ["pro", "whale", "team"] as const;
  for (const plan of catalog) {
    const configuredPriceId = getStripePriceIdForPlan(plan);
    if (configuredPriceId && params.priceIds?.includes(configuredPriceId)) {
      return toPrismaSubscriptionPlan(plan);
    }
  }

  return params.fallbackPlan ?? "FREE";
}

async function resolveWorkspaceIdFromStripeIdentifiers(params: {
  metadata?: Record<string, string>;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
}) {
  if (params.metadata?.workspaceId) {
    return params.metadata.workspaceId;
  }

  const prisma = getPrismaClient();

  if (params.stripeSubscriptionId) {
    const subscription = await prisma.subscription.findFirst({
      where: {
        billingSubscriptionId: params.stripeSubscriptionId,
      },
      select: {
        workspaceId: true,
      },
    });

    if (subscription?.workspaceId) {
      return subscription.workspaceId;
    }
  }

  if (params.stripeCustomerId) {
    const subscription = await prisma.subscription.findFirst({
      where: {
        billingCustomerId: params.stripeCustomerId,
      },
      select: {
        workspaceId: true,
      },
    });

    if (subscription?.workspaceId) {
      return subscription.workspaceId;
    }
  }

  return null;
}

async function upsertStripeSubscription(workspaceId: string, patch: StripeSubscriptionPatch, auditPayload: Prisma.InputJsonObject) {
  const prisma = getPrismaClient();
  const workspace = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      isArchived: false,
    },
    select: {
      id: true,
      subscription: true,
    },
  });

  if (!workspace) {
    return null;
  }

  const current = workspace.subscription;
  const subscription = await prisma.subscription.upsert({
    where: {
      workspaceId,
    },
    update: {
      ...(patch.plan ? { plan: patch.plan } : {}),
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.billingProvider !== undefined ? { billingProvider: patch.billingProvider } : {}),
      ...(patch.billingCustomerId !== undefined ? { billingCustomerId: patch.billingCustomerId } : {}),
      ...(patch.billingSubscriptionId !== undefined ? { billingSubscriptionId: patch.billingSubscriptionId } : {}),
      ...(patch.seatCount !== undefined ? { seatCount: patch.seatCount } : {}),
      ...(patch.currentPeriodStart !== undefined ? { currentPeriodStart: patch.currentPeriodStart } : {}),
      ...(patch.currentPeriodEnd !== undefined ? { currentPeriodEnd: patch.currentPeriodEnd } : {}),
      ...(patch.trialEndsAt !== undefined ? { trialEndsAt: patch.trialEndsAt } : {}),
      ...(patch.cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd: patch.cancelAtPeriodEnd } : {}),
    },
    create: {
      workspaceId,
      plan: patch.plan ?? current?.plan ?? "FREE",
      status: patch.status ?? current?.status ?? "ACTIVE",
      billingProvider: patch.billingProvider ?? "stripe",
      billingCustomerId: patch.billingCustomerId ?? current?.billingCustomerId ?? null,
      billingSubscriptionId: patch.billingSubscriptionId ?? current?.billingSubscriptionId ?? null,
      seatCount: patch.seatCount ?? current?.seatCount ?? 1,
      currentPeriodStart: patch.currentPeriodStart ?? null,
      currentPeriodEnd: patch.currentPeriodEnd ?? null,
      trialEndsAt: patch.trialEndsAt ?? null,
      cancelAtPeriodEnd: patch.cancelAtPeriodEnd ?? false,
    },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId,
      actorType: "SYSTEM",
      action: "billing.webhook.sync",
      entityType: "subscription",
      entityId: subscription.id,
      severity: "INFO",
      message: "Stripe webhook synchronized subscription state.",
      payload: auditPayload,
    },
  });

  return subscription;
}

async function handleCheckoutCompleted(eventId: string, object: Record<string, unknown>) {
  const metadata = getMetadata(object.metadata);
  const workspaceId = await resolveWorkspaceIdFromStripeIdentifiers({
    metadata,
    stripeSubscriptionId: getString(object.subscription),
    stripeCustomerId: getString(object.customer),
  });

  if (!workspaceId) {
    return {
      handled: false,
      workspaceId: null,
      reason: "workspace_not_resolved",
    };
  }

  const selectedPlan = resolvePlanFromStripeData({
    metadata,
  });

  await upsertStripeSubscription(
    workspaceId,
    {
      plan: selectedPlan,
      billingProvider: "stripe",
      billingCustomerId: getString(object.customer),
      billingSubscriptionId: getString(object.subscription),
      status: getString(object.payment_status) === "paid" ? "ACTIVE" : "INCOMPLETE",
    },
    {
      eventId,
      eventType: "checkout.session.completed",
      workspaceId,
      selectedPlan,
    },
  );

  return {
    handled: true,
    workspaceId,
    reason: null,
  };
}

async function handleStripeSubscriptionEvent(eventId: string, eventType: string, object: Record<string, unknown>) {
  const metadata = getMetadata(object.metadata);
  const stripeSubscriptionId = getString(object.id);
  const stripeCustomerId = getString(object.customer);
  const workspaceId = await resolveWorkspaceIdFromStripeIdentifiers({
    metadata,
    stripeSubscriptionId,
    stripeCustomerId,
  });

  if (!workspaceId) {
    return {
      handled: false,
      workspaceId: null,
      reason: "workspace_not_resolved",
    };
  }

  const status = normalizeSubscriptionStatus(getString(object.status));
  const plan = resolvePlanFromStripeData({
    metadata,
    priceIds: extractStripeSubscriptionPriceIds(object),
  });

  await upsertStripeSubscription(
    workspaceId,
    {
      plan,
      status: toPrismaSubscriptionStatus(status),
      billingProvider: "stripe",
      billingCustomerId: stripeCustomerId,
      billingSubscriptionId: stripeSubscriptionId,
      seatCount: getNumber(object.quantity) ?? 1,
      currentPeriodStart: unixToDate(object.current_period_start),
      currentPeriodEnd: unixToDate(object.current_period_end),
      trialEndsAt: unixToDate(object.trial_end),
      cancelAtPeriodEnd: getBoolean(object.cancel_at_period_end) ?? false,
    },
    {
      eventId,
      eventType,
      workspaceId,
      plan,
      status,
      stripeSubscriptionId,
    },
  );

  return {
    handled: true,
    workspaceId,
    reason: null,
  };
}

async function handleInvoiceEvent(eventId: string, eventType: string, object: Record<string, unknown>) {
  const stripeSubscriptionId = getString(object.subscription);
  const stripeCustomerId = getString(object.customer);
  const workspaceId = await resolveWorkspaceIdFromStripeIdentifiers({
    stripeSubscriptionId,
    stripeCustomerId,
  });

  if (!workspaceId) {
    return {
      handled: false,
      workspaceId: null,
      reason: "workspace_not_resolved",
    };
  }

  const status = eventType === "invoice.paid" ? "ACTIVE" : "PAST_DUE";
  await upsertStripeSubscription(
    workspaceId,
    {
      status,
      billingProvider: "stripe",
      billingCustomerId: stripeCustomerId,
      billingSubscriptionId: stripeSubscriptionId,
    },
    {
      eventId,
      eventType,
      workspaceId,
      status,
      stripeSubscriptionId,
    },
  );

  return {
    handled: true,
    workspaceId,
    reason: null,
  };
}

export async function handleStripeWebhookRequest(payload: string, signatureHeader: string | null) {
  if (!isStripeWebhookConfigured()) {
    throw new Error("Stripe webhook РЅРµ РЅР°СЃС‚СЂРѕРµРЅ РґР»СЏ СЌС‚РѕРіРѕ РѕРєСЂСѓР¶РµРЅРёСЏ.");
  }

  const event = verifyStripeWebhookEvent(payload, signatureHeader);
  const object = getObject(event.data.object);
  if (!object) {
    throw new Error("Stripe webhook object is invalid.");
  }

  switch (event.type) {
    case "checkout.session.completed":
      return {
        eventId: event.id,
        eventType: event.type,
        ...(await handleCheckoutCompleted(event.id, object)),
      };
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return {
        eventId: event.id,
        eventType: event.type,
        ...(await handleStripeSubscriptionEvent(event.id, event.type, object)),
      };
    case "invoice.paid":
    case "invoice.payment_failed":
      return {
        eventId: event.id,
        eventType: event.type,
        ...(await handleInvoiceEvent(event.id, event.type, object)),
      };
    default:
      return {
        eventId: event.id,
        eventType: event.type,
        handled: false,
        workspaceId: null,
        reason: "event_ignored",
      };
  }
}