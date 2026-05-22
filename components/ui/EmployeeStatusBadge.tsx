import type { AccountStatus } from "@/types";

interface Props {
  active: boolean;
  status?: AccountStatus;
}

const CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  active:    { label: "نشط",           bg: "#83A2DB18", color: "#83A2DB" },
  pending:   { label: "معلّق التفعيل", bg: "#E8B57018", color: "#E8B570" },
  suspended: { label: "موقوف",         bg: "#CE696918", color: "#CE6969" },
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
