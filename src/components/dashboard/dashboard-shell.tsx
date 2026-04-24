import { AllocationChart } from "@/components/dashboard/allocation-chart";
import { CategoryPerformanceChart } from "@/components/dashboard/category-performance-chart";
import { Cs2Table } from "@/components/dashboard/cs2-table";
import { Cs2TypeChart } from "@/components/dashboard/cs2-type-chart";
import { CryptoPanel } from "@/components/dashboard/crypto-panel";
import { SectionCard } from "@/components/dashboard/section-card";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { TelegramGiftsList } from "@/components/dashboard/telegram-gifts-list";
import { CATEGORY_META } from "@/lib/constants";
import { formatCs2TypeLabel, formatLiquidityLabel } from "@/lib/presentation";
import {
  formatCompactNumber,
  formatCurrency,
  formatPercent,
  formatRelativeTime,
} from "@/lib/utils";
import type { Cs2Position, PortfolioSnapshot, TopHolding } from "@/types/portfolio";

type DashboardShellProps = {
  snapshot: PortfolioSnapshot;
};

function HoldingsList({ holdings, currency }: { holdings: TopHolding[]; currency: string }) {
  if (holdings.length === 0) {
    return <p className="text-sm text-slate-400">Пока нет оцененных позиций для этого блока.</p>;
  }

  return (
    <div className="space-y-3">
      {holdings.map((holding, index) => (
        <div
          key={holding.id}
          className="flex items-center justify-between gap-3 rounded-3xl border border-white/8 bg-white/5 px-4 py-4"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/6 text-xs text-slate-300">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-white">{holding.name}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                {CATEGORY_META[holding.category].label}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-medium text-white">{formatCurrency(holding.value, currency)}</p>
            <p className="mt-1 text-xs text-slate-400">{formatPercent(holding.weight)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Cs2MiniList({
  positions,
  currency,
  mode,
}: {
  positions: Cs2Position[];
  currency: string;
  mode: "value" | "risk";
}) {
  if (positions.length === 0) {
    return <p className="text-sm text-slate-400">Для этого блока пока нет данных.</p>;
  }

  return (
    <div className="space-y-3">
      {positions.map((position) => (
        <div
          key={position.id}
          className="flex items-center justify-between gap-3 rounded-3xl border border-white/8 bg-white/5 px-4 py-4"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-white">{position.name}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
              {formatCs2TypeLabel(position.type)}
            </p>
          </div>
          <div className="text-right">
            {mode === "value" ? (
              <>
                <p className="font-medium text-white">
                  {formatCurrency(position.totalValue, currency)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatCompactNumber(position.quantity)} шт.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-white">Риск {position.riskScore}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatLiquidityLabel(position.liquidityLabel)} ликвидность
                </p>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardShell({ snapshot }: DashboardShellProps) {
  const currency = snapshot.settings.currency ?? "USD";

  return (
    <main className="relative overflow-hidden pb-16">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <section className="panel relative overflow-hidden rounded-[34px] border border-white/10 px-5 py-6 shadow-[0_30px_100px_rgba(2,8,23,0.72)] sm:px-7 sm:py-7 lg:px-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,209,160,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(61,139,255,0.16),transparent_38%),linear-gradient(120deg,rgba(255,255,255,0.02),transparent_45%)]" />
          <div className="relative grid gap-8 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
            <div className="space-y-5">
              <div className="flex flex-wrap gap-3 text-[0.7rem] uppercase tracking-[0.28em] text-cyan-200/70">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/8 px-3 py-1.5">
                  Приватный инвестиционный терминал
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300">
                  {snapshot.summary.sourceLabel}
                </span>
              </div>
              <div>
                <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-5xl xl:text-[3.35rem]">
                  Личный инвестиционный терминал для CS2-активов, подарков Telegram и крипты на одной приватной витрине.
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300/82 sm:text-base lg:text-lg">
                  Данные читаются из Google Sheets, подарки Telegram считаются по live-курсу TON, а CS2 подтягивает цены через Steam Market там, где позицию удается точно сматчить.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  Обновлено {formatRelativeTime(snapshot.summary.lastUpdatedAt)}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  {snapshot.summary.availableSheets.length} подключенных листа
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  {snapshot.summary.positionsCount.toLocaleString("ru-RU")} позиций
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {snapshot.summary.breakdown.map((item) => (
                <div
                  key={item.category}
                  className="rounded-[26px] border border-white/10 bg-white/[0.045] p-4 backdrop-blur-sm"
                >
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-white sm:text-[2rem]">
                    {formatCurrency(item.value, currency)}
                  </p>
                  <div className="mt-3 flex items-center justify-between text-sm text-slate-300/80">
                    <span>{item.positions} поз.</span>
                    <span>{formatCompactNumber(item.items)} шт.</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {snapshot.summary.warnings.length > 0 ? (
            <div className="relative mt-6 rounded-[26px] border border-amber-300/20 bg-amber-300/8 px-5 py-4 text-sm text-amber-100/92">
              <p className="text-xs uppercase tracking-[0.24em] text-amber-200/70">
                Статус данных
              </p>
              <div className="mt-3 space-y-2">
                {snapshot.summary.warnings.slice(0, 4).map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {snapshot.summary.cards.map((card) => (
            <SummaryCard key={card.id} card={card} currency={currency} />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <SectionCard
            title="Структура портфеля"
            eyebrow="Аллокация"
            description="Доля каждого класса активов в текущей оценке портфеля."
          >
            <AllocationChart data={snapshot.charts.allocation} currency={currency} />
          </SectionCard>
          <SectionCard
            title="Себестоимость vs стоимость"
            eyebrow="По категориям"
            description="Сравнение текущей оценки с известной себестоимостью по каждому блоку."
          >
            <CategoryPerformanceChart
              data={snapshot.charts.categoryPerformance}
              currency={currency}
            />
          </SectionCard>
          <SectionCard
            title="Срез CS2 по типам"
            eyebrow="Композиция инвентаря"
            description="Как текущая стоимость CS2 распределена между наклейками, скинами, кейсами и прочими сегментами."
          >
            <Cs2TypeChart data={snapshot.charts.cs2ByType} currency={currency} />
          </SectionCard>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <SectionCard
            title="Крупнейшие позиции"
            eyebrow="Концентрация"
            description="Топ кросс-категорийных позиций по текущей стоимости."
          >
            <HoldingsList holdings={snapshot.summary.topHoldings} currency={currency} />
          </SectionCard>
          <SectionCard
            title="Топ CS2 по стоимости"
            eyebrow="10 крупнейших"
            description="Самые крупные CS2-позиции по текущей оценке."
          >
            <Cs2MiniList
              positions={snapshot.cs2.topPositions}
              currency={currency}
              mode="value"
            />
          </SectionCard>
          <SectionCard
            title="Риск и неликвид"
            eyebrow="10 позиций"
            description="Ранжирование по концентрации, ликвидности и полноте ценовых данных."
          >
            <Cs2MiniList
              positions={snapshot.cs2.riskPositions}
              currency={currency}
              mode="risk"
            />
          </SectionCard>
        </section>

        <SectionCard
          title="Позиции CS2"
          eyebrow="Основной реестр"
          description="Поиск, фильтр и сортировка всех CS2-активов. На мобильном таблица автоматически переходит в карточки."
        >
          <Cs2Table positions={snapshot.cs2.positions} currency={currency} />
        </SectionCard>

        <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <SectionCard
            title="Подарки Telegram"
            eyebrow="Оценка через TON"
            description="Цены берутся из таблицы в TON и автоматически конвертируются в USD по live-курсу."
          >
            <TelegramGiftsList
              positions={snapshot.telegramGifts.positions}
              currency={currency}
            />
          </SectionCard>
          <SectionCard
            title="Крипта"
            eyebrow="Live-котировки"
            description="BTC и другие поддержанные тикеры обновляются через CoinGecko, а при сбое используется резерв из таблицы."
          >
            <CryptoPanel positions={snapshot.crypto.positions} currency={currency} />
          </SectionCard>
        </section>
      </div>
    </main>
  );
}

