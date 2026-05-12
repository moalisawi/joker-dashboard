import { z } from "zod";
import { CURRENCY, PAYMENT_TYPE } from "@/constants";

const currencySchema = z.enum([
  CURRENCY.USD,
  CURRENCY.EGP,
  CURRENCY.JOD,
  CURRENCY.ILS,
]);

// ISO date string YYYY-MM-DD
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "صيغة التاريخ غير صحيحة (YYYY-MM-DD)");

// ─── Add payment input ────────────────────────────────────────────────────────

export const addPaymentSchema = z.object({
  subscriberId:     z.string().min(1, "معرّف المشترك مطلوب"),
  subscriberName:   z.string().min(1),
  amountOriginal:   z.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  currencyOriginal: currencySchema,
  exchangeRate:     z.number().positive("سعر الصرف يجب أن يكون موجباً"),
  amountUSD:        z.number().nonnegative(),
  paymentMethod:    z.string().min(1, "طريقة الدفع مطلوبة"),
  date:             dateStringSchema,
  notes:            z.string().optional().nullable(),
  receiptUrl:       z.string().url("رابط غير صحيح").optional().nullable(),
  receiptType:      z.string().optional().nullable(),
  isInitialPayment: z.boolean(),
  isRenewalPayment: z.boolean(),
  renewalNumber:    z.number().int().nonnegative().optional(),
  paymentType:      z.enum([
    PAYMENT_TYPE.INITIAL,
    PAYMENT_TYPE.INSTALLMENT,
    PAYMENT_TYPE.RENEWAL,
    PAYMENT_TYPE.REFUND,
  ]).optional(),
});

export type AddPaymentInput = z.infer<typeof addPaymentSchema>;

// ─── Refund input ─────────────────────────────────────────────────────────────

export const createRefundSchema = z.object({
  subscriberId:   z.string().min(1),
  subscriberName: z.string().min(1),
  amountOriginal: z.number().positive("مبلغ الاسترداد يجب أن يكون أكبر من صفر"),
  currency:       currencySchema,
  exchangeRate:   z.number().positive(),
  amountUSD:      z.number().nonnegative(),
  reason:         z.string().min(3, "سبب الاسترداد مطلوب"),
  date:           dateStringSchema,
  notes:          z.string().optional().nullable(),
});

export type CreateRefundInput = z.infer<typeof createRefundSchema>;
