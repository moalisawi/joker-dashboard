import { z } from "zod";
import { TRANSFER_SCOPES } from "@/constants/transferScopes";

// ─── Create employee (owner creates new Firebase Auth user) ───────────────────

export const createEmployeeSchema = z.object({
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z
    .string()
    .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل")
    .max(128),
  fullName: z.string().min(2, "الاسم مطلوب").max(100),
  phone: z.string().max(20).optional(),
  employeeRole: z.enum(["sales", "followup", "team_leader", "admin", "owner"]),
  department: z.enum(["مبيعات", "متابعة", "إدارة", "أخرى"]),
  teamId: z.string().optional(),
  notes: z.string().max(500).optional(),

  /**
   * The state the account starts in.
   *
   * `pending` creates the identity and the profile but withholds access, which
   * is what an invite flow needs on day one: verifyServerUser() and
   * firestore.rules both require status === "active", so a pending account is
   * fully provisioned and fully locked out until someone activates it.
   *
   * The temporary password stays required — there is no mail transport in this
   * project and inventing one here would ship a broken invite. When an invite
   * sender exists it replaces the password field, not this one.
   *
   * Optional rather than `.default("active")`: a Zod default makes the parsed
   * output type diverge from the input type, and react-hook-form resolves the
   * form against the input side. The route reads `?? "active"`.
   */
  initialStatus: z.enum(["active", "pending"]).optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

// ─── Update employee profile / role / team ────────────────────────────────────

export const updateEmployeeSchema = z.object({
  uid: z.string().min(1),
  employeeRole: z.enum(["sales", "followup", "team_leader", "admin", "owner"]).optional(),
  department: z.enum(["مبيعات", "متابعة", "إدارة", "أخرى"]).optional(),
  teamId: z.string().nullable().optional(),
  notes: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
});

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

// ─── Deactivate employee ──────────────────────────────────────────────────────

export const deactivateEmployeeSchema = z.object({
  uid: z.string().min(1),
  reason: z.string().max(300).optional(),
  /**
   * Optional hand-over performed before access is withdrawn.
   *
   * Deactivation without it is still valid and still the common case — the
   * records simply keep pointing at a disabled account, which stays readable.
   * When a recipient is named the transfer runs first: moving work off an
   * account that is already locked out is the same operation, but doing it in
   * this order means the queue is never briefly owned by nobody.
   */
  transferToUid: z.string().min(1).optional(),
  transferScopes: z.array(z.enum(TRANSFER_SCOPES)).optional(),
});

export type DeactivateEmployeeInput = z.infer<typeof deactivateEmployeeSchema>;

// ─── Reactivate ───────────────────────────────────────────────────────────────

export const reactivateEmployeeSchema = z.object({
  uid: z.string().min(1),
  reason: z.string().max(300).optional(),
});

export type ReactivateEmployeeInput = z.infer<typeof reactivateEmployeeSchema>;

// ─── Archive (soft delete) ────────────────────────────────────────────────────

export const archiveEmployeeSchema = z.object({
  uid: z.string().min(1),
  reason: z.string().max(300).optional(),
  transferToUid: z.string().min(1).optional(),
  transferScopes: z.array(z.enum(TRANSFER_SCOPES)).optional(),
  /**
   * Explicit consent to leave assigned work pointing at an archived account.
   *
   * The route refuses to archive someone with live assignments unless either a
   * recipient is named or this is true. Silently orphaning a hundred subscribers
   * because the confirm button was the fastest way out of the dialog is the
   * failure this exists to prevent.
   */
  keepAssignments: z.boolean().optional(),
});

export type ArchiveEmployeeInput = z.infer<typeof archiveEmployeeSchema>;

// ─── Transfer assigned data ───────────────────────────────────────────────────

export const transferDataSchema = z.object({
  fromUid: z.string().min(1),
  toUid:   z.string().min(1),
  scopes:  z.array(z.enum(TRANSFER_SCOPES)).min(1, "اختر نوع بيانات واحداً على الأقل"),
  reason:  z.string().max(300).optional(),
}).refine((v) => v.fromUid !== v.toUid, {
  message: "لا يمكن نقل البيانات إلى نفس الموظف",
  path: ["toUid"],
});

export type TransferDataInput = z.infer<typeof transferDataSchema>;

// ─── Granular permissions editor ──────────────────────────────────────────────

export const granularPermissionsSchema = z.object({
  subscribers: z.object({
    view:   z.boolean(),
    create: z.boolean(),
    edit:   z.boolean(),
    delete: z.boolean(),
  }),
  subscriptions: z.object({
    renew:    z.boolean(),
    freeze:   z.boolean(),
    resume:   z.boolean(),
    withdraw: z.boolean(),
  }),
  payments: z.object({
    create: z.boolean(),
    edit:   z.boolean(),
    refund: z.boolean(),
  }),
  analytics: z.object({
    view:   z.boolean(),
    export: z.boolean(),
  }),
  logs: z.object({
    view: z.boolean(),
  }),
  users: z.object({
    manage:           z.boolean(),
    changeRoles:      z.boolean(),
    activateAccounts: z.boolean(),
  }),
  settings: z.object({
    manage: z.boolean(),
  }),
});

export type GranularPermissionsInput = z.infer<typeof granularPermissionsSchema>;

// ─── Team creation ────────────────────────────────────────────────────────────

export const createTeamSchema = z.object({
  name: z.string().min(2, "الاسم مطلوب").max(60),
  type: z.enum(["sales", "nutrition"]),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
