import type { AccountStatus } from "@/types";

interface Props {
  active: boolean;
  status?: AccountStatus;
}

const CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  active:    { label: "نشط",           bg: "#10b98118", color: "#10b981" },
  pending:   { label: "معلّق التفعيل", bg: "#f59e0b18", color: "#f59e0b" },
  suspended: { label: "موقوف",         bg: "#f43f5e18", color: "#f43f5e" },
  disabled:  { label: "معطّل",         bg: "#94a3b818", color: "#94a3b8" },
  inactive:  { label: "غير نشط",       bg: "#94a3b818", color: "#94a3b8" },
};

export default function EmployeeStatusBadge({ active, status }: Props) {
  const key = status ?? (active ? "active" : "inactive");
  const cfg = CONFIG[key] ?? CONFIG.inactive;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: cfg.color }}
      />
      {cfg.label}
    </span>
  );
}
