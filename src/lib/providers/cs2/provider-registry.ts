import { getEnv } from "@/lib/env";
import { createBuffProxyCs2PriceProvider } from "@/lib/providers/cs2/providers/buff-proxy-provider";
import { createDisabledExternalCs2Provider } from "@/lib/providers/cs2/providers/disabled-external-provider";
import { createManualCs2PriceProvider } from "@/lib/providers/cs2/providers/manual-sheet-provider";
import { createSteamMarketCs2PriceProvider } from "@/lib/providers/cs2/providers/steam-market-provider";
import type { Cs2PriceProvider, Cs2ProviderId } from "@/lib/providers/cs2/types";

const PROVIDER_FACTORY_MAP: Record<Cs2ProviderId, () => Cs2PriceProvider> = {
  steam: () => createSteamMarketCs2PriceProvider(),
  manual: () => createManualCs2PriceProvider(),
  buff_proxy: () => createBuffProxyCs2PriceProvider(),
  csfloat: () =>
    createDisabledExternalCs2Provider({
      id: "csfloat",
      sourceName: "CSFloat",
      reason:
        "адаптер подготовлен, но прямую интеграцию лучше подключать после выбора официального плана/API-ключа.",
    }),
  pricempire: () =>
    createDisabledExternalCs2Provider({
      id: "pricempire",
      sourceName: "PriceEmpire",
      reason:
        "адаптер подготовлен, но прямую интеграцию лучше подключать после выбора официального плана/API-ключа.",
    }),
};

function isKnownProviderId(value: string): value is Cs2ProviderId {
  return Object.hasOwn(PROVIDER_FACTORY_MAP, value);
}

export function getConfiguredCs2Providers() {
  const env = getEnv();
  const requestedOrder = env.CS2_PROVIDER_ORDER.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(isKnownProviderId);
  const order: Cs2ProviderId[] = requestedOrder.length > 0 ? requestedOrder : ["steam", "manual"];
  const warnings: string[] = [];
  const providers: Cs2PriceProvider[] = [];

  for (const providerId of order) {
    const provider = PROVIDER_FACTORY_MAP[providerId]();

    if (!provider.isEnabled()) {
      warnings.push(`${provider.sourceName} provider пропущен: отсутствует конфигурация.`);
      continue;
    }

    providers.push(provider);
  }

  if (!providers.some((provider) => provider.id === "manual")) {
    providers.push(createManualCs2PriceProvider());
  }

  return {
    providers,
    warnings,
  };
}

