import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { getEnv } from "@/lib/env";
import type { SaasSubscriptionPlan } from "@/types/saas";

const STRIPE_API_BASE_URL = "https://api.stripe.com/v1";
const WEBHOOK_TOLERANCE_SECONDS = 300;

type StripeCustomerResponse = {
  id: string;
  email?: string | null;
};

type StripeCheckoutSessionResponse = {
  id: string;
  url: string | null;
};

type StripePortalSessionResponse = {
  id: string;
  url: string | null;
};

type StripeVerifiedEvent = {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
};

function getStripeSecretKey() {
  const key = getEnv().STRIPE_SECRET_KEY?.trim();

  if (!key) {
    throw new Error("Stripe billing не настроен: отсутствует STRIPE_SECRET_KEY.");
  }

  return key;
}

function getStripeWebhookSecret() {
  const secret = getEnv().STRIPE_WEBHOOK_SECRET?.trim();

  if (!secret) {
    throw new Error("Stripe webhook не настроен: отсутствует STRIPE_WEBHOOK_SECRET.");
  }

  return secret;
}

function appendMetadata(form: URLSearchParams, metadata: Record<string, string | null | undefined>) {
  for (const [key, value] of Object.entries(metadata)) {
    if (value) {
      form.append(`metadata[${key}]`, value);
    }
  }
}

async function stripeFormRequest<T>(path: string, form: URLSearchParams): Promise<T> {
  const response = await fetch(`${STRIPE_API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | T
    | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? payload.error?.message?.trim()
        : null;
    throw new Error(message || "Stripe request failed.");
  }

  return payload as T;
}

export async function createStripeCustomer(params: {
  email: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
}) {
  const form = new URLSearchParams();
  form.append("email", params.email);
  form.append("name", params.name);
  appendMetadata(form, {
    workspaceId: params.workspaceId,
    workspaceName: params.workspaceName,
  });

  return stripeFormRequest<StripeCustomerResponse>("/customers", form);
}

export async function createStripeCheckoutSession(params: {
  customerId: string;
  workspaceId: string;
  workspaceName: string;
  selectedPlan: SaasSubscriptionPlan;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  seatCount: number;
}) {
  const form = new URLSearchParams();
  form.append("mode", "subscription");
  form.append("customer", params.customerId);
  form.append("success_url", params.successUrl);
  form.append("cancel_url", params.cancelUrl);
  form.append("allow_promotion_codes", "true");
  form.append("client_reference_id", params.workspaceId);
  form.append("line_items[0][price]", params.priceId);
  form.append("line_items[0][quantity]", String(Math.max(params.seatCount, 1)));
  appendMetadata(form, {
    workspaceId: params.workspaceId,
    workspaceName: params.workspaceName,
    selectedPlan: params.selectedPlan,
  });
  form.append("subscription_data[metadata][workspaceId]", params.workspaceId);
  form.append("subscription_data[metadata][workspaceName]", params.workspaceName);
  form.append("subscription_data[metadata][selectedPlan]", params.selectedPlan);

  return stripeFormRequest<StripeCheckoutSessionResponse>("/checkout/sessions", form);
}

export async function createStripeCustomerPortalSession(params: {
  customerId: string;
  returnUrl: string;
}) {
  const form = new URLSearchParams();
  form.append("customer", params.customerId);
  form.append("return_url", params.returnUrl);

  const portalConfigurationId = getEnv().STRIPE_PORTAL_CONFIGURATION_ID?.trim();
  if (portalConfigurationId) {
    form.append("configuration", portalConfigurationId);
  }

  return stripeFormRequest<StripePortalSessionResponse>("/billing_portal/sessions", form);
}

function parseStripeSignatureHeader(signatureHeader: string) {
  const segments = signatureHeader.split(",").map((segment) => segment.trim()).filter(Boolean);
  const timestamp = segments.find((segment) => segment.startsWith("t="))?.slice(2) ?? null;
  const signatures = segments
    .filter((segment) => segment.startsWith("v1="))
    .map((segment) => segment.slice(3))
    .filter(Boolean);

  return {
    timestamp,
    signatures,
  };
}

export function verifyStripeWebhookEvent(
  payload: string,
  signatureHeader: string | null,
): StripeVerifiedEvent {
  if (!signatureHeader) {
    throw new Error("Missing Stripe signature header.");
  }

  const secret = getStripeWebhookSecret();
  const parsed = parseStripeSignatureHeader(signatureHeader);
  if (!parsed.timestamp || parsed.signatures.length === 0) {
    throw new Error("Malformed Stripe signature header.");
  }

  const signedPayload = `${parsed.timestamp}.${payload}`;
  const expectedSignature = createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const hasValidSignature = parsed.signatures.some((signature) => {
    try {
      const received = Buffer.from(signature, "hex");
      return received.length === expectedBuffer.length && timingSafeEqual(expectedBuffer, received);
    } catch {
      return false;
    }
  });

  if (!hasValidSignature) {
    throw new Error("Stripe signature verification failed.");
  }

  const timestamp = Number(parsed.timestamp);
  if (!Number.isFinite(timestamp)) {
    throw new Error("Stripe signature timestamp is invalid.");
  }

  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > WEBHOOK_TOLERANCE_SECONDS) {
    throw new Error("Stripe signature timestamp is outside the allowed tolerance.");
  }

  const event = JSON.parse(payload) as StripeVerifiedEvent;
  if (!event?.type || !event?.data?.object || !event.id) {
    throw new Error("Stripe webhook payload is invalid.");
  }

  return event;
}