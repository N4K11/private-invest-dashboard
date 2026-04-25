"use client";

import { useSyncExternalStore } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartSurfaceSkeleton } from "@/components/dashboard/chart-surface-skeleton";
import { HistoryEmptyState } from "@/components/dashboard/history-empty-state";
import {
  formatHistoryAxisDate,
  formatHistoryTooltipDate,
  HISTORY_TOOLTIP_STYLE,
  subscribe,
} from "@/components/dashboard/history-chart-utils";
import { formatCompactNumber, formatCurrency } from "@/lib/utils";
import type { AssetClassHistoryDatum } from "@/types/portfolio";

type AssetClassHistoryChartProps = {
  data: AssetClassHistoryDatum[];
  currency: string;
};

export function AssetClassHistoryChart({ data, currency }: AssetClassHistoryChartProps) {
  const isMounted = useSyncExternalStore(subscribe, () => true, () => false);
  const hasOtherSeries = data.some((entry) => (entry.otherValue ?? 0) > 0);

  if (!isMounted) {
    return <ChartSurfaceSkeleton />;
  }

  if (data.length === 0) {
    return (
      <HistoryEmptyState
        title="Нет данных по классам активов"
        description="Как только в системе появятся исторические snapshots или текущая точка оценки, график покажет, как классы активов меняют долю во времени."
      />
    );
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 8, right: 12 }}>
          <defs>
            <linearGradient id="history-cs2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3d8bff" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#3d8bff" stopOpacity={0.06} />
            </linearGradient>
            <linearGradient id="history-telegram" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00d1a0" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#00d1a0" stopOpacity={0.06} />
            </linearGradient>
            <linearGradient id="history-crypto" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f3b23a" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#f3b23a" stopOpacity={0.06} />
            </linearGradient>
            <linearGradient id="history-other" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="rgba(226,232,240,0.55)"
            tickFormatter={formatHistoryAxisDate}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="rgba(226,232,240,0.55)"
            tickFormatter={(value) => formatCompactNumber(Number(value ?? 0))}
            tickLine={false}
            axisLine={false}
            width={72}
          />
          <Tooltip
            labelFormatter={(label) => formatHistoryTooltipDate(String(label))}
            formatter={(value, name) => [formatCurrency(Number(value ?? 0), currency), String(name)]}
            contentStyle={HISTORY_TOOLTIP_STYLE}
          />
          <Area type="monotone" dataKey="cs2Value" name="CS2" stroke="#3d8bff" fill="url(#history-cs2)" strokeWidth={2.5} />
          <Area type="monotone" dataKey="telegramValue" name="Telegram" stroke="#00d1a0" fill="url(#history-telegram)" strokeWidth={2.5} />
          <Area type="monotone" dataKey="cryptoValue" name="Crypto" stroke="#f3b23a" fill="url(#history-crypto)" strokeWidth={2.5} />
          {hasOtherSeries ? (
            <Area type="monotone" dataKey="otherValue" name="Other" stroke="#94a3b8" fill="url(#history-other)" strokeWidth={2.5} />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
