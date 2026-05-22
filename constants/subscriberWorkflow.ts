// ─── Workflow Status ──────────────────────────────────────────────────────────

export const WORKFLOW_STATUS = {
  NEW:              "new",
  INTERESTED:       "interested",
  FOLLOW_UP:        "follow_up",
  AWAITING_PAYMENT: "awaiting_payment",
  ACTIVE:           "active",
  PAUSED:           "paused",
  COMPLETED:        "completed",
  CANCELLED:        "cancelled",
  REFUNDED:         "refunded",
} as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUS)[keyof typeof WORKFLOW_STATUS];

export const WORKFLOW_LABELS: Record<WorkflowStatus, string> = {
  new:              "جديد",
  interested:       "مهتم",
  follow_up:        "متابعة",
  awaiting_payment: "ينتظر الدفع",
  active:           "نشط",
  paused:           "موقوف",
  completed:        "مكتمل",
  cancelled:        "ملغي",
  refunded:         "مُسترد",
};

export const WORKFLOW_COLORS: Record<WorkflowStatus, { bg: string; color: string }> = {
  new:              { bg: "#e0f2fe18", color: "#0284c7" },
  interested:       { bg: "#fef9c318", color: "#a16207" },
  follow_up:        { bg: "#ede9fe18", color: "#7c3aed" },
  awaiting_payment: { bg: "#fef3c718", color: "#d97706" },
  active:           { bg: "#d1fae518", color: "#059669" },
  paused:           { bg: "#fee2e218", color: "#dc2626" },
  completed:        { bg: "#d1fae518", color: "#047857" },
  cancelled:        { bg: "#f1f5f918", color: "#6b7280" },
  refunded:         { bg: "#fce7f318", color: "#db2777" },
};

// ─── Assignment Type ──────────────────────────────────────────────────────────

export const ASSIGNMENT_TYPE = {
  SALES:      "sales",
  NUTRITION:  "nutrition",
  OWNER:      "owner",
  UNASSIGNED: "unassigned",
} as const;

export type AssignmentType = (typeof ASSIGNMENT_TYPE)[keyof typeof ASSIGNMENT_TYPE];

export const ASSIGNMENT_TYPE_LABELS: Record<AssignmentType, string> = {
  sales:      "مبيعات",
  nutrition:  "متابعة تغذوية",
  owner:      "المالك مباشرة",
  unassigned: "غير معيّن",
};

// ─── Note Type ────────────────────────────────────────────────────────────────

export const NOTE_TYPE = {
  SALES:    "sales",
  NUTRITION:"nutrition",
  RENEWAL:  "renewal",
  PAYMENT:  "payment",
  GENERAL:  "general",
} as const;

export type NoteType = (typeof NOTE_TYPE)[keyof typeof NOTE_TYPE];

export const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  sales:    "مبيعات",
  nutrition:"تغذية",
  renewal:  "تجديد",
  payment:  "دفع",
  general:  "عام",
};

export const NOTE_TYPE_COLORS: Record<NoteType, string> = {
  sales:    "#10b981",
  nutrition:"#8b5cf6",
  renewal:  "#f59e0b",
  payment:  "#6366f1",
  general:  "#6b7280",
};

// ─── Renewal Workflow Status ──────────────────────────────────────────────────

export const RENEWAL_STATUS = {
  PENDING:   "pending",
  CONTACTED: "contacted",
  RENEWED:   "renewed",
  DECLINED:  "declined",
} as const;

export type RenewalWorkflowStatus = (typeof RENEWAL_STATUS)[keyof typeof RENEWAL_STATUS];

export const RENEWAL_STATUS_LABELS: Record<RenewalWorkflowStatus, string> = {
  pending:   "قيد الانتظار",
  contacted: "تم التواصل",
  renewed:   "تم التجديد",
  declined:  "رفض التجديد",
};

export const RENEWAL_STATUS_COLORS: Record<RenewalWorkflowStatus, { bg: string; color: string }> = {
  pending:   { bg: "#fef3c718", color: "#d97706" },
  contacted: { bg: "#ede9fe18", color: "#7c3aed" },
  renewed:   { bg: "#d1fae518", color: "#059669" },
  declined:  { bg: "#fee2e218", color: "#dc2626" },
};

// ─── Package ownership helpers ────────────────────────────────────────────────

/** Gold package is handled directly by the owner */
export function isGoldPackage(pkg: string): boolean {
  return pkg === "ذهبية";
}

/** Silver package is handled by nutrition teams */
export function isSilverPackage(pkg: string): boolean {
  return pkg === "فضية";
}

/** Default assignment type based on package */
export function defaultAssignmentType(pkg: string): AssignmentType {
  if (isGoldPackage(pkg)) return ASSIGNMENT_TYPE.OWNER;
  return ASSIGNMENT_TYPE.UNASSIGNED;
}
