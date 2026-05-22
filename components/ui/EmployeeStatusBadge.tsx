import type { AccountStatus } from "@/types";

interface Props {
  active: boolean;
  status?: AccountStatus;
}

const CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  active:    { label: "نشط",           bg: "#5B5FEF18", color: "#5B5FEF" },
  pending:   { label: "معلّق التفعيل", bg: "#F59E0B18", color: "#F59E0B" },
  suspended: { label: "موقوف",         bg: "#EF444418", color: "#EF4444" },
  disabled:  { label: "معطّل",         bg: "#9ca3af18", color: "#9ca3af" },
  inactive:  { label: "غير نشط",       bg: "#9ca3af18", color: "#9ca3af" },
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
