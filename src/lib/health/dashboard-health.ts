import { getEnv, isDashboardConfigured, isGoogleSheetsConfigured } from "@/lib/env";
import { getPortfolioSnapshot } from "@/lib/portfolio/build-portfolio";
import { resolveCryptoPositions } from "@/lib/providers/crypto-price-provider";
import { resolveCs2Positions } from "@/lib/providers/cs2-price-provider";
import { resolveTelegramGiftPositions } from "@/lib/providers/telegram-gift-price-provider";
import { fetchSpreadsheetDocument } from "@/lib/sheets/client";
import type { SpreadsheetDocument } from "@/lib/sheets/client";
import type {
  NormalizedCryptoRow,
  NormalizedWorkbook,
} from "@/lib/sheets/normalizers";
import { getAdminWriteStatus } from "@/lib/sheets/writeback";
import { validateSpreadsheetDocument } from "@/lib/sheets/validation";
import { getPortfolioCacheHealth } from "@/lib/cache/portfolio-cache";
import type {
  DashboardHealthSnapshot,
  HealthIndicator,
  HealthTone,
  PriceProviderDiagnosticResult,
} from "@/types/health";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function buildIndicator(
  id: string,
  label: string,
  tone: HealthTone,
  summary: string,
  details: string[] = [],
): HealthIndicator {
  return {
    id,
    label,
    tone,
    summary,
    details,
  };
}

function buildDocumentModeLabel(mode: DashboardHealthSnapshot["documentMode"]) {
  if (mode === "native_sheet") {
    return "Native Google Sheet";
  }

  if (mode === "drive_workbook") {
    return "Drive workbook / Excel";
  }

  return "Недоступно";
}

function buildStatusIndicators(params: {
  readDocument: SpreadsheetDocument | null;
  readError: string | null;
  writeAccess: Awaited<ReturnType<typeof getAdminWriteStatus>>;
  cache: Awaited<ReturnType<typeof getPortfolioCacheHealth>>;
}) {
  const statuses: HealthIndicator[] = [];

  statuses.push(
    buildIndicator(
      "token-gate",
      "Token-gate",
      isDashboardConfigured() ? "ok" : "error",
      isDashboardConfigured()
        ? "Token-gate активен: приватный route и API не отдают данные без токена или session-cookie."
        : "Token-gate не настроен: проверь PRIVATE_DASHBOARD_SLUG и DASHBOARD_SECRET_TOKEN.",
      isDashboardConfigured()
        ? ["Секреты не показываются в UI и не возвращаются API."]
        : [],
    ),
  );

  if (!isGoogleSheetsConfigured()) {
    statuses.push(
      buildIndicator(
        "sheets-read",
        "Google Sheets read",
        "warning",
        "Google Sheets credentials не настроены, поэтому dashboard работает в demo/fallback режиме.",
      ),
    );
  } else if (params.readDocument) {
    statuses.push(
      buildIndicator(
        "sheets-read",
        "Google Sheets read",
        "ok",
        "Чтение таблицы работает корректно.",
        [
          `Документ: ${params.readDocument.fileName ?? params.readDocument.workbook.spreadsheetTitle ?? "Без названия"}`,
          `Режим: ${buildDocumentModeLabel(params.readDocument.mode)}`,
          `${params.readDocument.workbook.availableSheets.length} листов доступны для чтения.`,
        ],
      ),
    );
  } else {
    statuses.push(
      buildIndicator(
        "sheets-read",
        "Google Sheets read",
        "error",
        "Чтение Google Sheets сейчас не работает.",
        params.readError ? [params.readError] : [],
      ),
    );
  }

  statuses.push(
    buildIndicator(
      "sheets-write",
      "Google Sheets write",
      params.writeAccess.canWrite ? "ok" : params.writeAccess.enabled ? "warning" : "error",
      params.writeAccess.canWrite
        ? "Service account может писать обратно в таблицу или workbook."
        : params.writeAccess.message ?? "Запись сейчас недоступна.",
      [
        `Режим документа: ${buildDocumentModeLabel(params.writeAccess.mode)}`,
        params.writeAccess.fileName ? `Файл: ${params.writeAccess.fileName}` : null,
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  statuses.push(
    buildIndicator(
      "cache",
      "Cache status",
      params.cache.tone,
      params.cache.summary,
      [
        `Cache driver: ${params.cache.driver}`,
        `Portfolio source cached: ${params.cache.portfolioSourceCached ? "yes" : "no"}`,
        `Price entries: ${params.cache.priceEntries}`,
        `In-flight entries: ${params.cache.inFlightEntries}`,
        params.cache.remoteEnabled
          ? `Remote cache: ${params.cache.remoteHealthy === false ? "degraded" : params.cache.remoteHealthy === true ? "healthy" : "pending"}`
          : "Remote cache: disabled",
      ],
    ),
  );

  return statuses;
}

function buildProviderIndicators(snapshot: Awaited<ReturnType<typeof getPortfolioSnapshot>>) {
  const env = getEnv();
  const providers: HealthIndicator[] = [];

  const cryptoPositions = snapshot.crypto.positions;
  const cryptoLiveCount = cryptoPositions.filter((position) => position.isLivePrice).length;
  const cryptoFallbackCount = cryptoPositions.length - cryptoLiveCount;
  providers.push(
    buildIndicator(
      "crypto-provider",
      "Crypto price provider",
      cryptoPositions.length === 0
        ? "info"
        : cryptoLiveCount === cryptoPositions.length
          ? "ok"
          : "warning",
      cryptoPositions.length === 0
        ? "Крипто-позиций пока нет, но provider-chain настроен на CoinGecko + fallback из sheet."
        : `CoinGecko дает live-котировки для ${cryptoLiveCount} из ${cryptoPositions.length} крипто-позиций.`,
      [
        "Основной provider: CoinGecko",
        cryptoFallbackCount > 0 ? `Fallback на sheet/entry price: ${cryptoFallbackCount}` : null,
        env.COINGECKO_API_KEY ? "API key для CoinGecko задан." : "API key не задан, используется публичная квота.",
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  const cs2Positions = snapshot.cs2.positions;
  const cs2LiveCount = cs2Positions.filter((position) => position.priceSource.endsWith("_live")).length;
  const cs2ManualCount = cs2Positions.filter((position) => position.priceSource === "manual_sheet").length;
  const cs2MissingCount = cs2Positions.filter((position) => position.priceSource === "missing").length;
  const cs2StaleCount = cs2Positions.filter((position) => Boolean(position.priceWarning)).length;
  providers.push(
    buildIndicator(
      "cs2-provider",
      "CS2 price provider",
      cs2Positions.length === 0
        ? "info"
        : cs2MissingCount > 0 || cs2StaleCount > 0
          ? "warning"
          : "ok",
      cs2Positions.length === 0
        ? "CS2-позиций пока нет, provider-chain ждет данные из sheet."
        : `CS2 chain ${env.CS2_PROVIDER_ORDER} закрывает live-ценами ${cs2LiveCount} из ${cs2Positions.length} позиций.`,
      [
        `Manual fallback: ${cs2ManualCount}`,
        `Missing prices: ${cs2MissingCount}`,
        `Warnings / stale: ${cs2StaleCount}`,
      ],
    ),
  );

  const telegramPositions = snapshot.telegramGifts.positions;
  const telegramManualCount = telegramPositions.filter((position) => position.priceSource === "manual_sheet").length;
  const telegramTonCount = telegramPositions.filter(
    (position) => position.priceSource === "ton_sheet_x_coingecko" || position.priceSource === "ton_sheet_nominal",
  ).length;
  const telegramStaleCount = telegramPositions.filter((position) => position.isPriceStale).length;
  const telegramLowConfidenceCount = telegramPositions.filter(
    (position) => position.priceConfidence === "low" || position.priceConfidence === null,
  ).length;
  providers.push(
    buildIndicator(
      "telegram-provider",
      "Telegram pricing mode",
      telegramPositions.length === 0
        ? "info"
        : telegramStaleCount > 0 || telegramLowConfidenceCount > 0
          ? "warning"
          : "ok",
      telegramPositions.length === 0
        ? "Telegram Gifts пока отсутствуют, используется manual/semi-auto pricing flow."
        : `Telegram Gifts сейчас работают в manual/semi-auto режиме для ${telegramPositions.length} позиций.`,
      [
        `Manual prices: ${telegramManualCount}`,
        `TON-based conversion: ${telegramTonCount}`,
        `Stale prices: ${telegramStaleCount}`,
        `Low confidence: ${telegramLowConfidenceCount}`,
      ],
    ),
  );

  return providers;
}

function createMockCryptoRow(): NormalizedCryptoRow {
  return {
    id: "health-check-btc",
    symbol: "BTC",
    name: "Bitcoin",
    quantity: 0.1,
    averageEntryPrice: null,
    currentPrice: null,
    priceSource: null,
    walletNote: null,
    status: null,
    currency: "USD",
    lastUpdated: null,
    notes: "Health provider diagnostic sample",
    sheetRef: {
      sheetName: "Health_Check",
      rowNumber: 1,
      isCanonical: true,
    },
  };
}

export async function runPriceProviderDiagnostics(
  workbook: NormalizedWorkbook,
): Promise<PriceProviderDiagnosticResult[]> {
  const diagnostics: PriceProviderDiagnosticResult[] = [];

  try {
    const sampleRows = workbook.cryptoRows.length > 0 ? workbook.cryptoRows.slice(0, 2) : [createMockCryptoRow()];
    const result = await resolveCryptoPositions(sampleRows);
    const liveCount = result.positions.filter((position) => position.isLivePrice).length;
    diagnostics.push({
      provider: "crypto",
      tone: liveCount > 0 ? "ok" : "warning",
      summary:
        sampleRows.length === 0
          ? "Crypto provider не получил sample rows."
          : `Crypto provider проверен на ${sampleRows.length} sample rows, live quotes: ${liveCount}.`,
      details: result.warnings.slice(0, 4),
    });
  } catch (error) {
    diagnostics.push({
      provider: "crypto",
      tone: "error",
      summary: "Crypto provider test завершился ошибкой.",
      details: [getErrorMessage(error)],
    });
  }

  if (workbook.cs2Rows.length === 0) {
    diagnostics.push({
      provider: "cs2",
      tone: "info",
      summary: "CS2 provider test пропущен: в workbook нет CS2 sample rows.",
      details: [],
    });
  } else {
    try {
      const sampleRows = workbook.cs2Rows.slice(0, 3);
      const result = await resolveCs2Positions(sampleRows);
      const pricedCount = result.positions.filter((position) => position.currentPrice !== null).length;
      diagnostics.push({
        provider: "cs2",
        tone: pricedCount > 0 ? "ok" : "warning",
        summary: `CS2 chain проверен на ${sampleRows.length} sample rows, цена найдена для ${pricedCount}.`,
        details: result.warnings.slice(0, 4),
      });
    } catch (error) {
      diagnostics.push({
        provider: "cs2",
        tone: "error",
        summary: "CS2 provider test завершился ошибкой.",
        details: [getErrorMessage(error)],
      });
    }
  }

  if (workbook.telegramRows.length === 0) {
    diagnostics.push({
      provider: "telegram",
      tone: "info",
      summary: "Telegram provider test пропущен: в workbook нет Telegram sample rows.",
      details: [],
    });
  } else {
    try {
      const sampleRows = workbook.telegramRows.slice(0, 3);
      const result = await resolveTelegramGiftPositions(sampleRows);
      const pricedCount = result.positions.filter((position) => position.estimatedPrice !== null).length;
      diagnostics.push({
        provider: "telegram",
        tone: pricedCount > 0 ? "ok" : "warning",
        summary: `Telegram pricing проверен на ${sampleRows.length} sample rows, оценка найдена для ${pricedCount}.`,
        details: result.warnings.slice(0, 4),
      });
    } catch (error) {
      diagnostics.push({
        provider: "telegram",
        tone: "error",
        summary: "Telegram provider test завершился ошибкой.",
        details: [getErrorMessage(error)],
      });
    }
  }

  return diagnostics;
}

export async function getDashboardHealthSnapshot(): Promise<DashboardHealthSnapshot> {
  const snapshot = await getPortfolioSnapshot();
  const cache = await getPortfolioCacheHealth();
  const admin = await getAdminWriteStatus();

  let readDocument: SpreadsheetDocument | null = null;
  let readError: string | null = null;
  let validation = null;

  if (isGoogleSheetsConfigured()) {
    try {
      readDocument = await fetchSpreadsheetDocument();
      validation = validateSpreadsheetDocument(readDocument);
    } catch (error) {
      readError = getErrorMessage(error);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    sourceMode: snapshot.summary.sourceMode,
    dashboardConfigured: isDashboardConfigured(),
    tokenGateActive: isDashboardConfigured(),
    documentTitle:
      readDocument?.fileName ?? readDocument?.workbook.spreadsheetTitle ?? admin.fileName ?? null,
    documentMode: readDocument?.mode ?? admin.mode,
    availableSheets: readDocument?.workbook.availableSheets ?? snapshot.summary.availableSheets,
    lastPortfolioRefresh: snapshot.summary.lastUpdatedAt,
    lastSnapshotDate: snapshot.history.lastSnapshotDate,
    statuses: buildStatusIndicators({
      readDocument,
      readError,
      writeAccess: admin,
      cache,
    }),
    providers: buildProviderIndicators(snapshot),
    cache,
    validation,
    warnings: snapshot.summary.warnings.slice(0, 12),
    admin: {
      enabled: admin.enabled,
      canWrite: admin.canWrite,
      missingEditorAccess: admin.missingEditorAccess,
      mode: admin.mode,
      fileName: admin.fileName,
      message: admin.message,
    },
  };
}




