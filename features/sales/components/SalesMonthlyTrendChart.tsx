"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import type { MonthlyAcquisition } from "@/lib/analytics/calculations";
import { formatNumber } from "@/lib/utils";

const MONTH_LABELS: Record<string, string> = {
  "01":"يناير","02":"فبراير","03":"مارس","04":"أبريل",
  "05":"مايو","06":"يونيو","07":"يوليو","08":"أغسطس",
  "09":"سبتمبر","10":"أكتوبر","11":"نوفمبر","12":"ديسمبر",
};

function shortMonth(ym: string): string {
  const [, m] = ym.split("-");
  return MONTH_LABELS[m] ?? ym;
}

interface CustomTooltipProps {
  active?:  boolean;
  payload?: { value: number; name: string }[];
  label?:   string;
  canRev:   boolean;
}

function CustomTooltip({ active, payload, label, canRev }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-lg"
      style={{ background:"var(--surface)", border:"1px solid var(--border)" }}>
      <p className="font-bold mb-1" style={{ color:"var(--text-primary)" }}>
        {label ? shortMonth(label) : ""}
      </p>
      {payload.map((p) => (
        <p key={p.name} style={{ color:"var(--text-secondary)" }}>
          {p.name === "subscribers"
            ? `${p.value} مشترك`
            : canRev
              ? `$${formatNumber(p.value, 0)}`
              : "—"}
        </p>
      ))}
    </div>
  );
}

interface Props {
  data:   MonthlyAcquisition[];
  canRev: boolean;
  height?: number;
}

export default function SalesMonthlyTrendChart({ data, canRev, height = 200 }: Props) {
  const axisColor = "#9CA3AF";
  const gridColor = "#f1f5f9";

  const chartData = data.map((d) => ({
    ...d,
    label: shortMonth(d.month),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} barGap={4} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke={gridColor}/>
        <XAxis
          dataKey="label"
          tick={{ fontSize:11, fill: "#9ca3af" }}
          axisLine={{ stroke:axisColor }}
          tickLine={false}
        />
        <YAxis
          yAxisId="subs"
          tick={{ fontSize:11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          width={24}
        />
        <Tooltip content={(props) => (
          <CustomTooltip {...(props as unknown as CustomTooltipProps)} canRev={canRev}/>
        )}/>
        <Bar
          yAxisId="subs"
          dataKey="subscribers"
          name="subscribers"
          fill="#5B5FEF"
          radius={[4,4,0,0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
