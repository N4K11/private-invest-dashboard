"use client";

import { useMemo, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { DashboardStatePanel } from "@/components/dashboard/dashboard-state-panel";
import { SectionCard } from "@/components/dashboard/section-card";
import { formatNumber } from "@/lib/utils";
import type {
  ImportColumnMapping,
  ImportFieldKey,
  ImportPreview,
  ImportSourceType,
} from "@/types/imports";
import type { SaasPortfolioListItem } from "@/types/saas";

const SOURCE_OPTIONS: { value: ImportSourceType; label: string; description: string }[] = [
  {
    value: "google_sheets",
    label: "Google Sheets",
    description: "Импорт напрямую по URL или spreadsheet ID через service account.",
  },
  {
    value: "csv",
    label: "CSV",
    description: "Загрузка табличных позиций из CSV через preview и ручной mapping.",
  },
  {
    value: "json",
    label: "JSON",
    description: "Импорт массивов items/positions/assets/data из JSON файлов.",
  },
  {
    value: "steam_export",
    label: "Steam export",
    description: "Распознавание Steam inventory export и snapshot-import CS2 holdings.",
  },
  {
    value: "manual_template",
    label: "Manual template",
    description: "Ручной CSV-шаблон для быстрого ввода активов без интеграции.",
  },
];

const FIELD_LABELS: Record<ImportFieldKey, string> = {
  category: "Категория",
  name: "Название",
  symbol: "Символ",
  quantity: "Количество",
  averageEntryPrice: "Цена входа",
  currentPrice: "Текущая цена",
  notes: "Заметки",
  externalId: "External ID",
  externalSource: "Источник",
  collection: "Коллекция",
};

type ImportCenterProps = {
  workspaceName: string;
  portfolios: SaasPortfolioListItem[];
  canManage: boolean;
  manualTemplateCsv: string;
};

function previewSummary(preview: ImportPreview | null) {
  if (!preview) {
    return null;
  }

  return `${preview.importableRowCount} import-ready / ${preview.totalSourceRows} raw / ${preview.deduplicatedRecordCount} deduped`;
}

export function ImportCenter({
  workspaceName,
  portfolios,
  canManage,
  manualTemplateCsv,
}: ImportCenterProps) {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<ImportSourceType>("google_sheets");
  const [selectedPortfolioId, setSelectedPortfolioId] = useState(portfolios[0]?.id ?? "");
  const [spreadsheetIdOrUrl, setSpreadsheetIdOrUrl] = useState("");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<ImportColumnMapping>({});
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null);
  const [isPreviewPending, startPreviewTransition] = useTransition();
  const [isCommitPending, startCommitTransition] = useTransition();

  const selectedPortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.id === selectedPortfolioId) ?? null,
    [portfolios, selectedPortfolioId],
  );

  function resetPreviewState() {
    setPreview(null);
    setFeedback(null);
    setMapping({});
  }

  function selectSource(nextSource: ImportSourceType) {
    setSourceType(nextSource);
    resetPreviewState();

    if (nextSource === "manual_template") {
      setContent(manualTemplateCsv);
      setFileName("manual-template.csv");
      return;
    }

    if (fileName === "manual-template.csv") {
      setContent("");
      setFileName("");
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    setFileName(file.name);
    setContent(text);
    setPreview(null);
    setFeedback(null);
  }

  function buildPreviewPayload(nextMapping?: ImportColumnMapping) {
    return {
      portfolioId: selectedPortfolioId,
      sourceType,
      spreadsheetIdOrUrl,
      content,
      fileName,
      mapping: nextMapping ?? mapping,
    };
  }

  function runPreview(nextMapping?: ImportColumnMapping) {
    setFeedback(null);

    startPreviewTransition(async () => {
      const response = await fetch("/api/app/import/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPreviewPayload(nextMapping)),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; preview?: ImportPreview }
        | null;

      if (!response.ok || !payload?.preview) {
        setPreview(null);
        setFeedback({
          tone: "error",
          message: payload?.error ?? "Не удалось построить preview импорта.",
        });
        return;
      }

      setPreview(payload.preview);
      setMapping(payload.preview.suggestedMapping);
      setFeedback({
        tone: "success",
        message: `Preview готов: ${previewSummary(payload.preview)}`,
      });
    });
  }

  function handleCommit() {
    if (!preview) {
      return;
    }

    setFeedback(null);

    startCommitTransition(async () => {
      const response = await fetch("/api/app/import/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          portfolioId: selectedPortfolioId,
          sourceType,
          sourceLabel: preview.sourceLabel,
          sourceSummary: preview.sourceSummary,
          duplicateRowCount: preview.duplicateRowCount,
          totalSourceRows: preview.totalSourceRows,
          records: preview.records,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; result?: { importedRecordCount: number; createdPositionCount: number; updatedPositionCount: number } }
        | null;

      if (!response.ok || !payload?.result) {
        setFeedback({
          tone: "error",
          message: payload?.error ?? "Не удалось завершить импорт.",
        });
        return;
      }

      setFeedback({
        tone: "success",
        message: `Импорт завершен: ${payload.result.importedRecordCount} записей, ${payload.result.createdPositionCount} новых позиций, ${payload.result.updatedPositionCount} обновлено.`,
      });
      router.refresh();
    });
  }

  if (portfolios.length === 0) {
    return (
      <DashboardStatePanel
        eyebrow="Нет портфелей"
        title="Import Center требует хотя бы один портфель"
        description="Сначала создайте портфель, затем вернитесь сюда для preview, mapping и импорта активов в базу данных."
        action={
          <Link
            href="/app/portfolios"
            className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            Открыть портфели
          </Link>
        }
      />
    );
  }

  return (
    <main className="space-y-6">
      <section className="panel rounded-[32px] border border-white/10 px-6 py-6 sm:px-8">
        <p className="text-xs uppercase tracking-[0.34em] text-cyan-200/70">Import Center</p>
        <div className="mt-3 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">
              Импорт активов в {workspaceName}
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-300/80 sm:text-base">
              Поток Stage 17: preview before import, column mapping, deduplication и запись snapshot-позиций в PostgreSQL с audit log.
            </p>
          </div>
          {!canManage ? (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
              Для запуска preview и commit нужны права owner/admin.
            </div>
          ) : null}
        </div>
      </section>

      <SectionCard
        eyebrow="Source"
        title="Выбор источника"
        description="Поддерживаются Google Sheets, CSV, JSON, Steam inventory export и ручной CSV-template."
      >
        <div className="grid gap-3 lg:grid-cols-5">
          {SOURCE_OPTIONS.map((option) => {
            const isActive = option.value === sourceType;
            return (
              <button
                key={option.value}
                type="button"
                disabled={!canManage}
                onClick={() => selectSource(option.value)}
                className={`rounded-[24px] border px-4 py-4 text-left transition ${
                  isActive
                    ? "border-cyan-300/40 bg-cyan-300/10"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20"
                } ${!canManage ? "opacity-70" : ""}`}
              >
                <p className="text-sm font-semibold text-white">{option.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-300/75">{option.description}</p>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Target"
        title="Целевой портфель и payload"
        description="Preview и commit применяются к выбранному portfolio внутри активного workspace."
      >
        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="portfolio-select">
                Портфель назначения
              </label>
              <select
                id="portfolio-select"
                value={selectedPortfolioId}
                onChange={(event) => {
                  setSelectedPortfolioId(event.target.value);
                  setPreview(null);
                  setFeedback(null);
                }}
                disabled={!canManage || isPreviewPending || isCommitPending}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              >
                {portfolios.map((portfolio) => (
                  <option key={portfolio.id} value={portfolio.id}>
                    {portfolio.name} · {portfolio.slug}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-300/80">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Выбранный portfolio</p>
              <p className="mt-2 text-lg font-medium text-white">{selectedPortfolio?.name ?? "—"}</p>
              <p className="mt-2">visibility: {selectedPortfolio?.visibility ?? "—"}</p>
              <p>currency: {selectedPortfolio?.baseCurrency ?? "—"}</p>
            </div>
          </div>

          <div className="space-y-4">
            {sourceType === "google_sheets" ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="sheet-url">
                  Google Sheets URL или spreadsheet ID
                </label>
                <input
                  id="sheet-url"
                  value={spreadsheetIdOrUrl}
                  onChange={(event) => {
                    setSpreadsheetIdOrUrl(event.target.value);
                    setPreview(null);
                  }}
                  disabled={!canManage || isPreviewPending || isCommitPending}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                  placeholder="https://docs.google.com/spreadsheets/d/... или spreadsheetId"
                />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-white/20 hover:text-white">
                    Загрузить файл
                    <input
                      type="file"
                      accept={sourceType === "json" || sourceType === "steam_export" ? ".json,application/json,.txt,text/plain" : ".csv,text/csv,.txt,text/plain"}
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={!canManage || isPreviewPending || isCommitPending}
                    />
                  </label>
                  {sourceType === "manual_template" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setContent(manualTemplateCsv);
                        setFileName("manual-template.csv");
                        setPreview(null);
                      }}
                      className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-100 transition hover:border-cyan-300/40"
                    >
                      Подставить шаблон
                    </button>
                  ) : null}
                  {fileName ? <span className="text-sm text-slate-400">Файл: {fileName}</span> : null}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200" htmlFor="content-payload">
                    {sourceType === "json" || sourceType === "steam_export" ? "JSON payload" : "CSV / text payload"}
                  </label>
                  <textarea
                    id="content-payload"
                    rows={14}
                    value={content}
                    onChange={(event) => {
                      setContent(event.target.value);
                      setPreview(null);
                    }}
                    disabled={!canManage || isPreviewPending || isCommitPending}
                    className="w-full rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60"
                    placeholder={sourceType === "json" || sourceType === "steam_export" ? "Вставьте JSON payload сюда" : "Вставьте CSV здесь"}
                  />
                </div>
              </>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => runPreview()}
                disabled={!canManage || !selectedPortfolioId || isPreviewPending || isCommitPending}
                className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPreviewPending ? "Строю preview..." : "Построить preview"}
              </button>
              <button
                type="button"
                onClick={handleCommit}
                disabled={!canManage || !preview || preview.importableRowCount === 0 || isCommitPending || isPreviewPending}
                className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/45 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCommitPending ? "Импортирую..." : "Импортировать в портфель"}
              </button>
            </div>

            {feedback ? (
              <div
                className={`rounded-2xl px-4 py-3 text-sm ${
                  feedback.tone === "error"
                    ? "border border-rose-400/30 bg-rose-400/10 text-rose-100"
                    : "border border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                }`}
              >
                {feedback.message}
              </div>
            ) : null}
          </div>
        </div>
      </SectionCard>

      {preview ? (
        <>
          {preview.mappingEditable ? (
            <SectionCard
              eyebrow="Mapping"
              title="Column mapping"
              description="При необходимости скорректируйте auto-detected сопоставление и заново постройте preview."
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {(Object.keys(FIELD_LABELS) as ImportFieldKey[]).map((field) => (
                  <div key={field}>
                    <label className="mb-2 block text-sm font-medium text-slate-200">
                      {FIELD_LABELS[field]}
                    </label>
                    <select
                      value={mapping[field] ?? ""}
                      onChange={(event) =>
                        setMapping((current) => ({
                          ...current,
                          [field]: event.target.value || undefined,
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
                    >
                      <option value="">Не использовать</option>
                      {preview.availableColumns.map((column) => (
                        <option key={`${field}-${column}`} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => runPreview(mapping)}
                  disabled={!canManage || isPreviewPending || isCommitPending}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:border-white/20 hover:text-white"
                >
                  Обновить preview с новым mapping
                </button>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard
            eyebrow="Preview"
            title="Предварительный результат"
            description={preview.sourceSummary}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Source</p>
                <p className="mt-2 text-sm font-medium text-white">{preview.sourceLabel}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Rows</p>
                <p className="mt-2 text-sm font-medium text-white">
                  {preview.importableRowCount} ready / {preview.totalSourceRows} raw
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Dedup</p>
                <p className="mt-2 text-sm font-medium text-white">
                  {preview.deduplicatedRecordCount} unique / {preview.duplicateRowCount} duplicates
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Target</p>
                <p className="mt-2 text-sm font-medium text-white">{selectedPortfolio?.name ?? "—"}</p>
              </div>
            </div>

            {preview.byCategory.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {preview.byCategory.map((entry) => (
                  <span
                    key={entry.category}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-300/80"
                  >
                    {entry.label}: {entry.count}
                  </span>
                ))}
              </div>
            ) : null}

            {preview.warnings.length > 0 ? (
              <div className="mt-5 grid gap-3">
                {preview.warnings.map((warning) => (
                  <div
                    key={warning}
                    className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-50/90"
                  >
                    {warning}
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              {preview.records.slice(0, 12).map((record) => (
                <article
                  key={record.id}
                  className="rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-white">{record.name}</h3>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.7rem] uppercase tracking-[0.18em] text-slate-300/80">
                          {record.category}
                        </span>
                        {record.symbol ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.7rem] uppercase tracking-[0.18em] text-slate-300/80">
                            {record.symbol}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-400">
                        quantity: {formatNumber(record.quantity, 6)}
                        {record.externalSource ? ` · source: ${record.externalSource}` : ""}
                        {record.externalId ? ` · externalId: ${record.externalId}` : ""}
                      </p>
                    </div>
                    <div className="text-sm text-slate-300/80 lg:text-right">
                      <p>entry: {record.averageEntryPrice !== null ? formatNumber(record.averageEntryPrice, 2) : "—"}</p>
                      <p>current: {record.currentPrice !== null ? formatNumber(record.currentPrice, 2) : "—"}</p>
                      <p>rows: {record.sourceRowIds.join(", ")}</p>
                    </div>
                  </div>
                  {record.notes ? <p className="mt-3 text-sm leading-7 text-slate-300/78">{record.notes}</p> : null}
                  {record.warnings.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {record.warnings.map((warning) => (
                        <span
                          key={`${record.id}-${warning}`}
                          className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100"
                        >
                          {warning}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>

            {preview.records.length > 12 ? (
              <p className="mt-4 text-sm text-slate-400">
                Показаны первые 12 записей из {preview.records.length} deduplicated rows.
              </p>
            ) : null}
          </SectionCard>
        </>
      ) : null}
    </main>
  );
}
