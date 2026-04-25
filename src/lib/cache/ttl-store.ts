import { getEnv, isExternalCacheConfigured } from "@/lib/env";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type InFlightEntry<T> = Promise<T>;

type RemoteCacheState = {
  healthy: boolean | null;
  lastError: string | null;
  lastCheckedAt: number | null;
};

export type RememberedStats = {
  driver: "memory" | "redis_rest";
  remoteEnabled: boolean;
  remoteHealthy: boolean | null;
  remoteSummary: string;
  totalEntries: number;
  inFlightEntries: number;
  cacheKeys: string[];
  inFlightKeys: string[];
  portfolioSourceCached: boolean;
};

const globalScope = globalThis as typeof globalThis & {
  __portfolioTtlCache?: Map<string, CacheEntry<unknown>>;
  __portfolioInFlight?: Map<string, InFlightEntry<unknown>>;
  __portfolioRemoteCacheState?: RemoteCacheState;
};

const cacheStore = globalScope.__portfolioTtlCache ?? new Map<string, CacheEntry<unknown>>();
const inFlightStore = globalScope.__portfolioInFlight ?? new Map<string, InFlightEntry<unknown>>();
const remoteCacheState =
  globalScope.__portfolioRemoteCacheState ?? {
    healthy: null,
    lastError: null,
    lastCheckedAt: null,
  };

globalScope.__portfolioTtlCache = cacheStore;
globalScope.__portfolioInFlight = inFlightStore;
globalScope.__portfolioRemoteCacheState = remoteCacheState;

function pruneExpiredEntries() {
  const now = Date.now();

  for (const [key, entry] of [...cacheStore.entries()]) {
    if (entry.expiresAt <= now) {
      cacheStore.delete(key);
    }
  }
}

function markRemoteHealthy() {
  remoteCacheState.healthy = true;
  remoteCacheState.lastError = null;
  remoteCacheState.lastCheckedAt = Date.now();
}

function markRemoteError(error: unknown) {
  remoteCacheState.healthy = false;
  remoteCacheState.lastError = error instanceof Error ? error.message : String(error);
  remoteCacheState.lastCheckedAt = Date.now();
}

function buildStorageKey(key: string) {
  return `${getEnv().CACHE_KEY_PREFIX}:${key}`;
}

function buildStoragePrefix(prefix: string) {
  return `${getEnv().CACHE_KEY_PREFIX}:${prefix}`;
}

async function executeRedisCommand<T>(command: Array<string | number>) {
  const env = getEnv();

  if (!isExternalCacheConfigured() || !env.CACHE_REDIS_REST_URL || !env.CACHE_REDIS_REST_TOKEN) {
    throw new Error("External Redis REST cache is not configured.");
  }

  try {
    const response = await fetch(env.CACHE_REDIS_REST_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CACHE_REDIS_REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Redis REST returned ${response.status}`);
    }

    const payload = (await response.json()) as { result?: T; error?: string };
    if (payload.error) {
      throw new Error(payload.error);
    }

    markRemoteHealthy();
    return payload.result as T;
  } catch (error) {
    markRemoteError(error);
    throw error;
  }
}

async function ensureRemoteHealthProbe() {
  if (!isExternalCacheConfigured() || remoteCacheState.healthy !== null) {
    return;
  }

  try {
    await executeRedisCommand<string>(["PING"]);
  } catch {
    // remote state is updated inside executeRedisCommand
  }
}

async function readRemoteEntry<T>(key: string) {
  if (!isExternalCacheConfigured()) {
    return null;
  }

  try {
    const rawEntry = await executeRedisCommand<string | null>(["GET", buildStorageKey(key)]);
    if (!rawEntry) {
      return null;
    }

    const parsedEntry = JSON.parse(rawEntry) as CacheEntry<T>;
    if (
      !parsedEntry ||
      typeof parsedEntry.expiresAt !== "number" ||
      parsedEntry.expiresAt <= Date.now()
    ) {
      await deleteRemoteEntry(key);
      return null;
    }

    return parsedEntry;
  } catch {
    return null;
  }
}

async function writeRemoteEntry<T>(key: string, entry: CacheEntry<T>, ttlMs: number) {
  if (!isExternalCacheConfigured()) {
    return;
  }

  const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));

  try {
    await executeRedisCommand(["SET", buildStorageKey(key), JSON.stringify(entry), "EX", ttlSeconds]);
  } catch {
    // fallback to memory cache only
  }
}

async function deleteRemoteEntry(key: string) {
  if (!isExternalCacheConfigured()) {
    return;
  }

  try {
    await executeRedisCommand<number>(["DEL", buildStorageKey(key)]);
  } catch {
    // fallback to memory cache only
  }
}

async function scanRemoteKeysByPrefix(prefix: string) {
  if (!isExternalCacheConfigured()) {
    return [] as string[];
  }

  const keys: string[] = [];
  let cursor = "0";

  try {
    do {
      const result = await executeRedisCommand<[string, string[]]>([
        "SCAN",
        cursor,
        "MATCH",
        `${buildStoragePrefix(prefix)}*`,
        "COUNT",
        "500",
      ]);
      const [nextCursor, batch] = result ?? ["0", []];
      cursor = String(nextCursor ?? "0");
      keys.push(...(Array.isArray(batch) ? batch : []));
    } while (cursor !== "0");
  } catch {
    return [];
  }

  return [...new Set(keys)];
}

async function deleteRemoteByPrefix(prefix: string) {
  if (!isExternalCacheConfigured()) {
    return;
  }

  const storageKeys = await scanRemoteKeysByPrefix(prefix);
  if (storageKeys.length === 0) {
    return;
  }

  try {
    await executeRedisCommand<number>(["DEL", ...storageKeys]);
  } catch {
    // fallback to memory cache only
  }
}

function buildRemoteSummary() {
  if (!isExternalCacheConfigured()) {
    return "Внешний cache не настроен, используется memory cache.";
  }

  if (remoteCacheState.healthy === true) {
    return "Redis REST cache активен, memory cache используется как локальный L1 слой.";
  }

  if (remoteCacheState.healthy === false) {
    return remoteCacheState.lastError
      ? `Redis REST cache недоступен, идет fallback на memory cache. Причина: ${remoteCacheState.lastError}`
      : "Redis REST cache недоступен, используется fallback на memory cache.";
  }

  return "Redis REST cache настроен, но еще не использовался текущим процессом.";
}

export async function remember<T>(
  key: string,
  ttlMs: number,
  factory: () => Promise<T>,
) {
  pruneExpiredEntries();

  const existing = cacheStore.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > Date.now()) {
    return existing.value;
  }

  const pending = inFlightStore.get(key) as Promise<T> | undefined;
  if (pending) {
    return pending;
  }

  const nextPromise = (async () => {
    const remoteEntry = await readRemoteEntry<T>(key);
    if (remoteEntry) {
      cacheStore.set(key, remoteEntry);
      return remoteEntry.value;
    }

    const value = await factory();
    const entry: CacheEntry<T> = {
      expiresAt: Date.now() + ttlMs,
      value,
    };

    cacheStore.set(key, entry);
    await writeRemoteEntry(key, entry, ttlMs);
    return value;
  })()
    .finally(() => {
      inFlightStore.delete(key);
    });

  inFlightStore.set(key, nextPromise);
  return nextPromise;
}

export async function forgetRemembered(key: string) {
  cacheStore.delete(key);
  inFlightStore.delete(key);
  await deleteRemoteEntry(key);
}

export async function forgetRememberedByPrefix(prefix: string) {
  for (const key of [...cacheStore.keys()]) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }

  for (const key of [...inFlightStore.keys()]) {
    if (key.startsWith(prefix)) {
      inFlightStore.delete(key);
    }
  }

  await deleteRemoteByPrefix(prefix);
}

export async function getRememberedStats(): Promise<RememberedStats> {
  pruneExpiredEntries();
  await ensureRemoteHealthProbe();

  const cacheKeys = [...cacheStore.keys()].sort();
  const inFlightKeys = [...inFlightStore.keys()].sort();

  return {
    driver: isExternalCacheConfigured() ? "redis_rest" : "memory",
    remoteEnabled: isExternalCacheConfigured(),
    remoteHealthy: isExternalCacheConfigured() ? remoteCacheState.healthy : null,
    remoteSummary: buildRemoteSummary(),
    totalEntries: cacheKeys.length,
    inFlightEntries: inFlightKeys.length,
    cacheKeys,
    inFlightKeys,
    portfolioSourceCached: cacheKeys.includes("portfolio-source"),
  };
}
