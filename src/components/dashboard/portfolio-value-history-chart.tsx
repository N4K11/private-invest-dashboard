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

import { HistoryEmptyState } from "@/components/dashboard/history-empty-state";
import {
  formatHistoryAxisDate,
  formatHistoryTooltipDate,
  HISTORY_TOOLTIP_STYLE,
  subscribe,
} from "@/components/dashboard/history-chart-utils";
import { formatCompactNumber, formatCurrency } from "@/lib/utils";
import type { PortfolioValueHistoryDatum } from "@/types/portfolio";

type PortfolioValueHistoryChartProps = {
  data: PortfolioValueHistoryDatum[];
  currency: string;
};

export function PortfolioValueHistoryChart({ data, currency }: PortfolioValueHistoryChartProps) {
  const isMounted = useSyncExternalStore(subscribe, () => true, () => false);

  if (!isMounted) {
    return <div className="h-[320px] w-full rounded-2xl bg-white/5" />;
  }

  if (data.length === 0) {
    return (
      <HistoryEmptyState
        title="История пока не записана"
        description="Создай первый daily snapshot в admin mode, и здесь появится кривая роста портфеля по датам."
      />
    );
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 8, right: 12 }}>
          <defs>
            <linearGradient id="portfolio-value-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00d1a0" stopOpacity={0.42} />
              <stop offset="95%" stopColor="#00d1a0" stopOpacity={0.02} />
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
            formatter={(value) => formatCurrency(Number(value ?? 0), currency)}
            contentStyle={HISTORY_TOOLTIP_STYLE}
          />
          <Area
            type="monotone"
            dataKey="totalValue"
            stroke="#00d1a0"
            strokeWidth={3}
            fill="url(#portfolio-value-gradient)"
            activeDot={{ r: 6, strokeWidth: 0, fill: "#67e8f9" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
