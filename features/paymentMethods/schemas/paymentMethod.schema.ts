import { z } from "zod";

export const SUPPORTED_CURRENCIES = ["USD", "EGP", "JOD", "ILS", "SAR", "AED", "USDT"] as const;
export const COUNTRY_OPTIONS = ["EG", "PS_GAZA", "PS_WB", "PS_48", "JO", "SA", "AE", "SY", "LB"] as const;
export const SCOPE_OPTIONS = ["country", "global"] as const;
export const TYPE_OPTIONS = ["ewallet", "bank", "cash", "crypto", "international"] as const;

export const createPaymentMethodSchema = z.object({
  name:                z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
  scope:               z.enum(SCOPE_OPTIONS),
  country:             z.string().nullable().optional(),
  type:                z.enum(TYPE_OPTIONS),
  supportedCurrencies: z.array(z.enum(SUPPORTED_CURRENCIES)).min(1, "يجب اختيار عملة واحدة على الأقل"),
  holderName:          z.string().min(2, "اسم صاحب الحساب مطلوب"),
  accountDetails:      z.string().optional(),
  logoUrl:             z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.scope === "country" && (!d.country || d.country === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "الدولة مطلوبة عند اختيار نطاق دولة محددة",
      path: ["country"],
    });
  }
});

export const updatePaymentMethodSchema = z.object({
  name:                z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل").optional(),
  scope:               z.enum(SCOPE_OPTIONS).optional(),
  country:             z.string().nullable().optional(),
  type:                z.enum(TYPE_OPTIONS).optional(),
  supportedCurrencies: z.array(z.enum(SUPPORTED_CURRENCIES)).min(1, "يجب اختيار عملة واحدة على الأقل").optional(),
  holderName:          z.string().min(2, "اسم صاحب الحساب مطلوب").optional(),
  accountDetails:      z.string().optional(),
  logoUrl:             z.string().optional(),
});

export type CreatePaymentMethodInput = z.infer<typeof createPaymentMethodSchema>;
export type UpdatePaymentMethodInput = z.infer<typeof updatePaymentMethodSchema>;
