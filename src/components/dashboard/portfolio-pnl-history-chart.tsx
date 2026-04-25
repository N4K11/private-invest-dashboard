"use client";

import { useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import type { PortfolioPnlHistoryDatum } from "@/types/portfolio";

type PortfolioPnlHistoryChartProps = {
  data: PortfolioPnlHistoryDatum[];
  currency: string;
};

export function PortfolioPnlHistoryChart({ data, currency }: PortfolioPnlHistoryChartProps) {
  const isMounted = useSyncExternalStore(subscribe, () => true, () => false);

  if (!isMounted) {
    return <ChartSurfaceSkeleton />;
  }

  if (data.length === 0) {
    return (
      <HistoryEmptyState
        title="PnL-история появится после snapshot"
        description="График строится только по сохраненным строкам Portfolio_History, поэтому сначала запиши первый snapshot дня."
      />
    );
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 8, right: 12 }}>
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
            formatter={(value) => formatCurrency(Number(value ?? 0), currency)}
            contentStyle={HISTORY_TOOLTIP_STYLE}
          />
          <Bar dataKey="totalPnl" radius={[10, 10, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.date}
                fill={entry.totalPnl >= 0 ? "rgba(0,209,160,0.82)" : "rgba(244,63,94,0.82)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
