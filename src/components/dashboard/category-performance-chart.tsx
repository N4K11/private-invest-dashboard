"use client";

import { useEffect, useState } from "react";
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
import type { CategoryPerformanceDatum } from "@/types/portfolio";

type CategoryPerformanceChartProps = {
  data: CategoryPerformanceDatum[];
  currency: string;
};

export function CategoryPerformanceChart({
  data,
  currency,
}: CategoryPerformanceChartProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className="h-[320px] w-full rounded-2xl bg-white/5" />;
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={10}>
          <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
          <XAxis
            dataKey="category"
            stroke="rgba(226,232,240,0.55)"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="rgba(226,232,240,0.55)"
            tickFormatter={(value) => formatCurrency(value, currency)}
            tickLine={false}
            axisLine={false}
            width={90}
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
          <Bar
            dataKey="cost"
            radius={[10, 10, 0, 0]}
            fill="rgba(61,139,255,0.75)"
          />
          <Bar
            dataKey="value"
            radius={[10, 10, 0, 0]}
            fill="rgba(0,209,160,0.8)"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
