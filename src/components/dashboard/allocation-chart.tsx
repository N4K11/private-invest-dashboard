"use client";

import { useSyncExternalStore } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { formatCurrency } from "@/lib/utils";
import type { AllocationDatum } from "@/types/portfolio";

type AllocationChartProps = {
  data: AllocationDatum[];
  currency: string;
};

const subscribe = () => () => undefined;

export function AllocationChart({ data, currency }: AllocationChartProps) {
  const isMounted = useSyncExternalStore(subscribe, () => true, () => false);

  if (!isMounted) {
    return <div className="h-[320px] w-full rounded-2xl bg-white/5" />;
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={72}
            outerRadius={112}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={2}
            paddingAngle={4}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => formatCurrency(Number(value ?? 0), currency)}
            contentStyle={{
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(6, 12, 24, 0.92)",
              color: "#f8fafc",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
