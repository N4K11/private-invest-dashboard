import type { NextRequest } from "next/server";

type RateBucket = {
  count: number;
  resetAt: number;
};

const globalScope = globalThis as typeof globalThis & {
  __portfolioRateLimitBuckets?: Map<string, RateBucket>;
};

const rateLimitStore =
  globalScope.__portfolioRateLimitBuckets ?? new Map<string, RateBucket>();

globalScope.__portfolioRateLimitBuckets = rateLimitStore;

export function getClientIp(request: NextRequest) {
  const forwardedFor =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip");

  if (!forwardedFor) {
    return "unknown";
  }

  return forwardedFor.split(",")[0]?.trim() || "unknown";
}

export function applyRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
) {
  const now = Date.now();
  const bucket = rateLimitStore.get(key);

  if (!bucket || bucket.resetAt <= now) {
    const nextBucket = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(key, nextBucket);

    return {
      success: true,
      remaining: Math.max(maxRequests - 1, 0),
      retryAfter: 0,
    };
  }

  if (bucket.count >= maxRequests) {
    return {
      success: false,
      remaining: 0,
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  rateLimitStore.set(key, bucket);

  return {
    success: true,
    remaining: Math.max(maxRequests - bucket.count, 0),
    retryAfter: 0,
  };
}
