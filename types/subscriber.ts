import { Timestamp } from "firebase/firestore";
import type { FreezeData } from "./freeze";

export type SubscriptionState = "active" | "withdrawn";
export type SubscriptionStatus = "active" | "paused" | "expired" | "withdrawn" | "frozen";
export type SubscriberStatus = "نشط" | "ينتهي قريباً" | "منتهي" | "منسحب" | "موقوف" | "متجمد";
export type PackageType = "فضية" | "ذهبية";
export type Currency = "USD" | "EGP" | "JOD" | "ILS";

/** Snapshot of a past subscription period, stored inside renewals[] */
export interface RenewalSnapshot {
  package: PackageType;
  startDate: string;
  endDate: string;
  duration: number;
  totalPrice: number;
  totalPriceUSD: number;
  paidAmountUSD: number;
  remainingAmountUSD: number;
  netAmountUSD: number;
  currency: Currency;
  lockedRate: number;
  payment: string;
  convincedBy: string;
  paidShift: string;
  snapshotStatus: SubscriptionState | "expired";
  renewedAt: Timestamp | null;
  renewedBy: string;
  renewedByName: string;
}

export interface Subscriber {
  id: string;
  date: string;
  startDate?: string;
  name: string;
  residence: string;
  phoneCountry: string;
  dialCode: string;
  phone: string;
  age?: number | null;
  package: PackageType;
  duration: number;
  expiryDate: string;
  daysRemaining: number;
  status: SubscriberStatus;

  // Pricing
  currencyOriginal: Currency;
  currency: Currency;
  lockedRate: number;
  totalPrice: number;
  totalPriceUSD: number;
  paidAmount: number;
  paidAmountUSD: number;
  remainingAmount: number;
  remainingAmountUSD: number;
  netAmountUSD: number;

  // Payment
  payment: string;
  source: string;
  referrer?: string;
  convincedBy: string;
  paidShift: string;
  team: string;
  notes?: string;

  // Withdrawal
  subscriptionState: SubscriptionState;
  /** @deprecated Use refunds collection instead. Kept for backward compatibility only. */
  refundAmount?: number;
  /** @deprecated Use refunds collection instead. Kept for backward compatibility only. */
  refundAmountUSD?: number;
  /** @deprecated Use refunds collection instead. Kept for backward compatibility only. */
  refundCurrency?: Currency;
  /** @deprecated Use refunds collection instead. Kept for backward compatibility only. */
  refundRate?: number;
  withdrawalDate?: Timestamp | null;
  withdrawalReason?: string;
  withdrawnAt?: string;

  // Pause system
  subscriptionStatus?: SubscriptionStatus;
  pausedAt?: Timestamp | null;
  pausedBy?: string | null;
  pauseReason?: string | null;
  remainingDaysAtPause?: number | null;
  totalPausedDays?: number;

  // Renewal lifecycle (new system — in-place update)
  renewals: RenewalSnapshot[];
  renewalCount: number;
  lifetimeValueUSD: number;
  lastRenewalDate?: Timestamp | null;

  // Legacy renewal flags (old system — kept for backward compat)
  isRenewal?: boolean;
  renewalOf?: string;
  isUpgrade?: boolean;
  isDowngrade?: boolean;
  originalTeam?: string;
  originalConvincedBy?: string;
  renewedBy?: string;

  // Freeze system
  freezeData?: FreezeData;

  // Withdrawal system (new — full structured snapshot)
  withdrawalData?: import("./withdrawal").WithdrawalData;

  // Meta
  createdAt?: Timestamp;
  createdBy?: string;
  updatedAt?: Timestamp;
  updatedBy?: string;

  // ── Workflow extension (Phase 3) ────────────────────────────────────────────
  // Assignment
  assignedSalesId?:          string | null;
  assignedSalesName?:        string | null;
  assignedNutritionistId?:   string | null;
  assignedNutritionistName?: string | null;
  assignedTeamId?:           string | null;
  assignedTeamName?:         string | null;
  assignmentType?:           import("@/constants/subscriberWorkflow").AssignmentType;
  assignmentHistory?:        import("./subscriberWorkflow").AssignmentHistoryEntry[];

  // Workflow status
  workflowStatus?:           import("@/constants/subscriberWorkflow").WorkflowStatus;
  workflowStatusChangedAt?:  Timestamp;
  workflowStatusChangedBy?:  string;
  workflowStatusNote?:       string;

  // Renewal workflow
  renewalWorkflowStatus?:    import("@/constants/subscriberWorkflow").RenewalWorkflowStatus;
  renewalSuggestedBy?:       string | null;
  renewalSuggestedByName?:   string | null;
  renewalHandledBy?:         string | null;
  renewalHandledByName?:     string | null;
  renewalNote?:              string;

  // Soft delete
  deleted?:    boolean;
  deletedAt?:  Timestamp;
  deletedBy?:  string;
}
