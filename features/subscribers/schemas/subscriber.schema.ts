import { z } from "zod";
import { SUBSCRIPTION_STATE, SUBSCRIPTION_STATUS, CURRENCY } from "@/constants";

// ─── Shared sub-schemas ───────────────────────────────────────────────────────

const currencySchema = z.enum([
  CURRENCY.USD,
  CURRENCY.EGP,
  CURRENCY.JOD,
  CURRENCY.ILS,
]);

// ─── Create subscriber input ──────────────────────────────────────────────────

export const createSubscriberSchema = z.object({
  name:             z.string().min(2, "الاسم مطلوب"),
  phone:            z.string().min(7, "رقم الهاتف غير صحيح"),
  phoneCountry:     z.string().min(1, "الدولة مطلوبة"),
  dialCode:         z.string().min(1),
  residence:        z.string().min(1, "مكان الإقامة مطلوب"),
  age:              z.number().int().min(10).max(100).optional().nullable(),

  package:          z.enum(["فضية", "ذهبية"]),
  duration:         z.number().int().positive("المدة يجب أن تكون موجبة"),
  startDate:        z.string().min(1, "تاريخ البدء مطلوب"),

  currencyOriginal: currencySchema,
  totalPrice:       z.number().nonnegative(),
  paidAmount:       z.number().nonnegative(),

  payment:          z.string().min(1, "طريقة الدفع مطلوبة"),
  source:           z.string().min(1, "المصدر مطلوب"),
  convincedBy:      z.string().min(1, "المقنِع مطلوب"),
  paidShift:        z.string().min(1, "الوردية مطلوبة"),
  team:             z.string().min(1, "الفريق مطلوب"),

  notes:            z.string().optional(),
  referrer:         z.string().optional(),
});

export type CreateSubscriberInput = z.infer<typeof createSubscriberSchema>;

// ─── Update subscriber input ──────────────────────────────────────────────────

export const updateSubscriberSchema = createSubscriberSchema.partial().extend({
  id: z.string().min(1),
});

export type UpdateSubscriberInput = z.infer<typeof updateSubscriberSchema>;

// ─── Subscriber filter / search ───────────────────────────────────────────────

export const subscriberFilterSchema = z.object({
  search:              z.string().optional(),
  status:              z.string().optional(),
  subscriptionState:   z.enum([SUBSCRIPTION_STATE.ACTIVE, SUBSCRIPTION_STATE.WITHDRAWN]).optional(),
  subscriptionStatus:  z.enum([
    SUBSCRIPTION_STATUS.ACTIVE,
    SUBSCRIPTION_STATUS.PAUSED,
    SUBSCRIPTION_STATUS.EXPIRED,
    SUBSCRIPTION_STATUS.WITHDRAWN,
    SUBSCRIPTION_STATUS.FROZEN,
  ]).optional(),
  package:             z.enum(["فضية", "ذهبية"]).optional(),
  convincedBy:         z.string().optional(),
  team:                z.string().optional(),
  expiresWithinDays:   z.number().int().positive().optional(),
});

export type SubscriberFilterInput = z.infer<typeof subscriberFilterSchema>;
