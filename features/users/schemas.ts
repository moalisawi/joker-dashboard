import { z } from "zod";

// ─── Create employee (owner creates new Firebase Auth user) ───────────────────

export const createEmployeeSchema = z.object({
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z
    .string()
    .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل")
    .max(128),
  fullName: z.string().min(2, "الاسم مطلوب").max(100),
  phone: z.string().max(20).optional(),
  employeeRole: z.enum(["sales", "followup", "admin", "owner"]),
  department: z.enum(["مبيعات", "متابعة", "إدارة", "أخرى"]),
  teamId: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

// ─── Update employee profile / role / team ────────────────────────────────────

export const updateEmployeeSchema = z.object({
  uid: z.string().min(1),
  employeeRole: z.enum(["sales", "followup", "admin", "owner"]).optional(),
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
});

export type DeactivateEmployeeInput = z.infer<typeof deactivateEmployeeSchema>;

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
