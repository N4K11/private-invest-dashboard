type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type InFlightEntry<T> = Promise<T>;

const globalScope = globalThis as typeof globalThis & {
  __portfolioTtlCache?: Map<string, CacheEntry<unknown>>;
  __portfolioInFlight?: Map<string, InFlightEntry<unknown>>;
};

const cacheStore =
  globalScope.__portfolioTtlCache ?? new Map<string, CacheEntry<unknown>>();
const inFlightStore =
  globalScope.__portfolioInFlight ?? new Map<string, InFlightEntry<unknown>>();

globalScope.__portfolioTtlCache = cacheStore;
globalScope.__portfolioInFlight = inFlightStore;

export async function remember<T>(
  key: string,
  ttlMs: number,
  factory: () => Promise<T>,
) {
  const existing = cacheStore.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > Date.now()) {
    return existing.value;
  }

  const pending = inFlightStore.get(key) as Promise<T> | undefined;
  if (pending) {
    return pending;
  }

  const nextPromise = factory()
    .then((value) => {
      cacheStore.set(key, {
        expiresAt: Date.now() + ttlMs,
        value,
      });
      inFlightStore.delete(key);
      return value;
    })
    .catch((error) => {
      inFlightStore.delete(key);
      throw error;
    });

  inFlightStore.set(key, nextPromise);
  return nextPromise;
}
