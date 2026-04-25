import { NextResponse } from "next/server";

type PrivateApiJsonInit = {
  status?: number;
  headers?: HeadersInit;
};

type PrivateApiErrorOptions = {
  headers?: HeadersInit;
  details?: unknown;
  code?: string;
  extraBody?: Record<string, unknown>;
};

const PRIVATE_API_SECURITY_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
} satisfies Record<string, string>;

const SENSITIVE_MESSAGE_PATTERNS = [
  /private[_ -]?key/i,
  /service[_ -]?account/i,
  /dashboard[_ -]?secret/i,
  /bearer\s+[a-z0-9._-]+/i,
  /api[_ -]?key/i,
  /token=/i,
];

function mergeHeaders(extraHeaders?: HeadersInit) {
  return {
    ...PRIVATE_API_SECURITY_HEADERS,
    ...(extraHeaders ? Object.fromEntries(new Headers(extraHeaders).entries()) : {}),
  };
}

export function privateApiJson(payload: unknown, init: PrivateApiJsonInit = {}) {
  return NextResponse.json(payload, {
    status: init.status,
    headers: mergeHeaders(init.headers),
  });
}

export function privateApiError(
  status: number,
  message: string,
  options: PrivateApiErrorOptions = {},
) {
  return privateApiJson(
    {
      error: message,
      ...(options.code ? { code: options.code } : {}),
      ...(options.details !== undefined ? { details: options.details } : {}),
      ...(options.extraBody ?? {}),
    },
    {
      status,
      headers: options.headers,
    },
  );
}

export function privateApiRateLimitError(message: string, retryAfter: number) {
  return privateApiError(429, message, {
    headers: {
      "Retry-After": String(retryAfter),
    },
  });
}

export function sanitizeErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  if (!message || message.length > 240) {
    return fallback;
  }

  if (SENSITIVE_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))) {
    return fallback;
  }

  return message;
}
