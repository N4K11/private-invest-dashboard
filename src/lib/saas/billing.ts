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
  getStripePriceIdForPlan,
  normalizeSubscriptionPlan,
  normalizeSubscriptionStatus,
  toPrismaSubscriptionPlan,
  toPrismaSubscriptionStatus,
} from "@/lib/saas/billing/plans";
import { getWorkspaceLimitSnapshot } from "@/lib/saas/limits";
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
    overrideLimitsEnabled: false,
    overrideNotes: null,
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
    overrideLimitsEnabled: record.overrideLimitsEnabled,
    overrideNotes: record.overrideNotes,
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

  const [workspace, limitSnapshot] = await Promise.all([
    loadWorkspaceBillingRecord(workspaceId),
    getWorkspaceLimitSnapshot(workspaceId),
  ]);

  if (!workspace || !limitSnapshot) {
    return null;
  }

  const currentSubscription = mapSubscriptionRecord(workspace.subscription);
  const providerConfigured = isStripeBillingConfigured();
  const webhookConfigured = isStripeWebhookConfigured();
  const customerPortalReady = Boolean(providerConfigured && currentSubscription.billingCustomerId);
  const managedByPortal = isManagedStripeSubscription(
    currentSubscription.plan,
    currentSubscription.status,
    currentSubscription.billingSubscriptionId,
  );

  const warnings = new Set(limitSnapshot.warnings);
  if (!providerConfigured) {
    warnings.add("Stripe env еще не настроен. Checkout и Customer Portal пока недоступны.");
  }
  if (providerConfigured && !webhookConfigured) {
    warnings.add("STRIPE_WEBHOOK_SECRET не настроен. Checkout может работать, но sync статуса из Stripe будет неполным.");
  }
  if (providerConfigured && currentSubscription.plan !== "free" && !currentSubscription.billingSubscriptionId) {
    warnings.add("Для платного плана еще не найден Stripe subscription id. Проверьте webhook flow или completion checkout.");
  }
  if (managedByPortal) {
    warnings.add("Для активной платной подписки смена плана должна идти через Stripe Customer Portal, а не через новый Checkout.");
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
    usage: limitSnapshot.usage,
    limits: limitSnapshot,
    plans: getBillingPlanCardCatalog(currentSubscription.plan, context.canManage && providerConfigured && !managedByPortal),
    warnings: [...warnings],
  };
}

async function ensureBillingMutationAccess(userId: string, workspaceId: string) {
  const context = await resolveWorkspaceBillingContext(userId, workspaceId);

  if (!context) {
    throw new Error("Workspace Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р… Р С‘Р В»Р С‘ Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С— Р С” Р Р…Р ВµР СРЎС“ Р С•РЎвЂљРЎРѓРЎС“РЎвЂљРЎРѓРЎвЂљР Р†РЎС“Р ВµРЎвЂљ.");
  }

  if (!context.canManage) {
    throw new Error("Р СњР ВµР Т‘Р С•РЎРѓРЎвЂљР В°РЎвЂљР С•РЎвЂЎР Р…Р С• Р С—РЎР‚Р В°Р Р† Р Т‘Р В»РЎРЏ РЎС“Р С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р С‘РЎРЏ Р В±Р С‘Р В»Р В»Р С‘Р Р…Р С–Р С•Р С РЎРЊРЎвЂљР С•Р С–Р С• workspace.");
  }

  return context;
}

async function ensureStripeCustomerForWorkspace(workspaceId: string) {
  const prisma = getPrismaClient();
  const workspace = await loadWorkspaceBillingRecord(workspaceId);

  if (!workspace) {
    throw new Error("Workspace Р Т‘Р В»РЎРЏ billing Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р….");
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
    throw new Error("Stripe billing Р ВµРЎвЂ°Р Вµ Р Р…Р Вµ Р Р…Р В°РЎРѓРЎвЂљРЎР‚Р С•Р ВµР Р… Р Т‘Р В»РЎРЏ РЎРЊРЎвЂљР С•Р С–Р С• Р С•Р С”РЎР‚РЎС“Р В¶Р ВµР Р…Р С‘РЎРЏ.");
  }

  if (params.selectedPlan === "free") {
    throw new Error("Р вЂќР В»РЎРЏ Р В±Р ВµРЎРѓР С—Р В»Р В°РЎвЂљР Р…Р С•Р С–Р С• Р С—Р В»Р В°Р Р…Р В° checkout Р Р…Р Вµ Р Р…РЎС“Р В¶Р ВµР Р….");
  }

  await ensureBillingMutationAccess(params.userId, params.workspaceId);

  const { workspace, customerId } = await ensureStripeCustomerForWorkspace(params.workspaceId);
  if (!workspace) {
    throw new Error("Workspace Р Т‘Р В»РЎРЏ billing Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р….");
  }

  const currentSubscription = mapSubscriptionRecord(workspace.subscription);
  if (
    currentSubscription.plan === params.selectedPlan &&
    (currentSubscription.status === "active" || currentSubscription.status === "trialing")
  ) {
    throw new Error("Р В­РЎвЂљР С•РЎвЂљ РЎвЂљР В°РЎР‚Р С‘РЎвЂћ РЎС“Р В¶Р Вµ Р В°Р С”РЎвЂљР С‘Р Р†Р ВµР Р… Р Т‘Р В»РЎРЏ РЎвЂљР ВµР С”РЎС“РЎвЂ°Р ВµР С–Р С• workspace.");
  }

  if (
    isManagedStripeSubscription(
      currentSubscription.plan,
      currentSubscription.status,
      currentSubscription.billingSubscriptionId,
    )
  ) {
    throw new Error("Р вЂќР В»РЎРЏ РЎРѓР СР ВµР Р…РЎвЂ№ Р В°Р С”РЎвЂљР С‘Р Р†Р Р…Р С•Р С–Р С• Р С—Р В»Р В°РЎвЂљР Р…Р С•Р С–Р С• РЎвЂљР В°РЎР‚Р С‘РЎвЂћР В° Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·РЎС“Р в„–РЎвЂљР Вµ Stripe Customer Portal.");
  }

  const priceId = getStripePriceIdForPlan(params.selectedPlan);
  if (!priceId) {
    throw new Error("Р вЂќР В»РЎРЏ Р Р†РЎвЂ№Р В±РЎР‚Р В°Р Р…Р Р…Р С•Р С–Р С• РЎвЂљР В°РЎР‚Р С‘РЎвЂћР В° Р ВµРЎвЂ°Р Вµ Р Р…Р Вµ Р В·Р В°Р Т‘Р В°Р Р… Stripe price id.");
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
    throw new Error("Stripe checkout session Р Р…Р Вµ Р Р†Р ВµРЎР‚Р Р…РЎС“Р В»Р В° redirect URL.");
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
    throw new Error("Stripe billing Р ВµРЎвЂ°Р Вµ Р Р…Р Вµ Р Р…Р В°РЎРѓРЎвЂљРЎР‚Р С•Р ВµР Р… Р Т‘Р В»РЎРЏ РЎРЊРЎвЂљР С•Р С–Р С• Р С•Р С”РЎР‚РЎС“Р В¶Р ВµР Р…Р С‘РЎРЏ.");
  }

  await ensureBillingMutationAccess(params.userId, params.workspaceId);

  const workspace = await loadWorkspaceBillingRecord(params.workspaceId);
  if (!workspace) {
    throw new Error("Workspace Р Т‘Р В»РЎРЏ Customer Portal Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р….");
  }

  const customerId = workspace.subscription?.billingCustomerId;
  if (!customerId) {
    throw new Error("Customer Portal РЎРѓРЎвЂљР В°Р Р…Р ВµРЎвЂљ Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р ВµР Р… Р С—Р С•РЎРѓР В»Р Вµ Р С—Р ВµРЎР‚Р Р†Р С•Р в„– РЎС“РЎРѓР С—Р ВµРЎв‚¬Р Р…Р С•Р в„– Stripe checkout РЎРѓР ВµРЎРѓРЎРѓР С‘Р С‘.");
  }

  const portalSession = await createStripeCustomerPortalSession({
    customerId,
    returnUrl: getWorkspaceReturnUrl(params.origin, "portal=returned"),
  });

  if (!portalSession.url) {
    throw new Error("Stripe Customer Portal Р Р…Р Вµ Р Р†Р ВµРЎР‚Р Р…РЎС“Р В» redirect URL.");
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
    throw new Error("Stripe webhook Р Р…Р Вµ Р Р…Р В°РЎРѓРЎвЂљРЎР‚Р С•Р ВµР Р… Р Т‘Р В»РЎРЏ РЎРЊРЎвЂљР С•Р С–Р С• Р С•Р С”РЎР‚РЎС“Р В¶Р ВµР Р…Р С‘РЎРЏ.");
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