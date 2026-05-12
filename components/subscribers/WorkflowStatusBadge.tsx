import { WORKFLOW_LABELS, WORKFLOW_COLORS, type WorkflowStatus } from "@/constants/subscriberWorkflow";

interface Props {
  status: WorkflowStatus | undefined;
  size?: "sm" | "md";
}

export default function WorkflowStatusBadge({ status, size = "md" }: Props) {
  if (!status) return null;

  const cfg   = WORKFLOW_COLORS[status];
  const label = WORKFLOW_LABELS[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold ${size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"}`}
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}25` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
      {label}
    </span>
  );
}
