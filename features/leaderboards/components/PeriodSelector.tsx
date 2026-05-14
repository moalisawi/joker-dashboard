"use client";

import { PERIOD_OPTIONS, type LeaderboardPeriod } from "@/features/leaderboards/lib/leaderboardMetrics";

const ACC_INDIGO = "#6366f1";

interface Props {
  value:    LeaderboardPeriod;
  onChange: (p: LeaderboardPeriod) => void;
}

export default function PeriodSelector({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {PERIOD_OPTIONS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all"
          style={{
            background: value === key ? ACC_INDIGO : "var(--surface-2)",
            color:      value === key ? "#fff" : "var(--text-muted)",
            border:     `1px solid ${value === key ? ACC_INDIGO : "var(--border)"}`,
          }}>
          {label}
        </button>
      ))}
    </div>
  );
}
