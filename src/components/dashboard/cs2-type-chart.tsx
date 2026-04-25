"use client";

import { useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartSurfaceSkeleton } from "@/components/dashboard/chart-surface-skeleton";
import { DashboardStatePanel } from "@/components/dashboard/dashboard-state-panel";
import { formatCs2TypeLabel } from "@/lib/presentation";
import { formatCurrency } from "@/lib/utils";
import type { Cs2TypeBreakdownDatum } from "@/types/portfolio";

type Cs2TypeChartProps = {
  data: Cs2TypeBreakdownDatum[];
  currency: string;
};

const subscribe = () => () => undefined;

export function Cs2TypeChart({ data, currency }: Cs2TypeChartProps) {
  const isMounted = useSyncExternalStore(subscribe, () => true, () => false);
  const hasData = data.some((entry) => entry.value > 0);

  if (!isMounted) {
    return <ChartSurfaceSkeleton />;
  }

  if (!hasData) {
    return (
      <DashboardStatePanel
        eyebrow="CS2 composition пуст"
        title="Типы CS2 пока не оценены"
        description="Когда позиции получат live price или sheet fallback price, этот блок покажет распределение стоимости по stickers, skins, cases и другим сегментам."
        className="h-[320px] min-h-[320px]"
      />
    );
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 12 }}>
          <CartesianGrid stroke="rgba(148,163,184,0.1)" horizontal={false} />
          <XAxis
            type="number"
            stroke="rgba(226,232,240,0.55)"
            tickFormatter={(value) => formatCurrency(value, currency)}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="type"
            stroke="rgba(226,232,240,0.55)"
            tickFormatter={(value) => formatCs2TypeLabel(value)}
            tickLine={false}
            axisLine={false}
            width={92}
          />
          <Tooltip
            formatter={(value) => formatCurrency(Number(value ?? 0), currency)}
            labelFormatter={(label) => formatCs2TypeLabel(String(label))}
            contentStyle={{
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(6, 12, 24, 0.92)",
              color: "#f8fafc",
            }}
          />
          <Bar dataKey="value" radius={[10, 10, 10, 10]} fill="#f3b23a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
