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

import { formatCurrency } from "@/lib/utils";
import type { Cs2TypeBreakdownDatum } from "@/types/portfolio";

type Cs2TypeChartProps = {
  data: Cs2TypeBreakdownDatum[];
  currency: string;
};

const subscribe = () => () => undefined;

export function Cs2TypeChart({ data, currency }: Cs2TypeChartProps) {
  const isMounted = useSyncExternalStore(subscribe, () => true, () => false);

  if (!isMounted) {
    return <div className="h-[320px] w-full rounded-2xl bg-white/5" />;
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
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <Tooltip
            formatter={(value) => formatCurrency(Number(value ?? 0), currency)}
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
