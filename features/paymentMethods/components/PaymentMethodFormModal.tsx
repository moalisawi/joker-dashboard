"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Spinner } from "@heroui/react";
import { toast } from "@heroui/react";
import { X } from "lucide-react";
import {
  createPaymentMethodSchema,
  SUPPORTED_CURRENCIES,
  COUNTRY_OPTIONS,
  TYPE_OPTIONS,
  type CreatePaymentMethodInput,
} from "../schemas/paymentMethod.schema";
import { useCreatePaymentMethodMutation } from "../hooks/useCreatePaymentMethodMutation";
import { useUpdatePaymentMethodMutation } from "../hooks/useUpdatePaymentMethodMutation";
import { PaymentMethodTypeIcon, getTypeLabel } from "./PaymentMethodTypeIcon";
import type { PaymentMethod, PaymentMethodType, SupportedCurrency } from "../types";

const COUNTRY_LABELS: Record<string, string> = {
  EG: "مصر", PS_GAZA: "فلسطين - غزة", PS_WB: "فلسطين - الضفة",
  PS_48: "فلسطين - 48", JO: "الأردن", SA: "السعودية", AE: "الإمارات", SY: "سوريا", LB: "لبنان",
};

interface Props {
  isOpen:       boolean;
  onClose:      () => void;
  initialData?: PaymentMethod | null;
}

export function PaymentMethodFormModal({ isOpen, onClose, initialData }: Props) {
  const isEdit         = !!initialData;
  const createMutation = useCreatePaymentMethodMutation();
  const updateMutation = useUpdatePaymentMethodMutation();

  const [logoPreviewError, setLogoPreviewError] = useState(false);

  const { register, control, handleSubmit, watch, reset, setValue, formState: { errors, isSubmitting } } =
    useForm<CreatePaymentMethodInput>({
      resolver: zodResolver(createPaymentMethodSchema),
      defaultValues: {
        name: "", scope: "country", country: null,
        type: "ewallet", supportedCurrencies: [], holderName: "", accountDetails: "", logoUrl: "",
      },
    });

  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      reset({
        name: initialData.name, scope: initialData.scope, country: initialData.country,
        type: initialData.type, supportedCurrencies: initialData.supportedCurrencies,
        holderName: initialData.holderName, accountDetails: initialData.accountDetails ?? "",
        logoUrl: initialData.logoUrl ?? "",
      });
    } else {
      reset({ name: "", scope: "country", country: null, type: "ewallet", supportedCurrencies: [], holderName: "", accountDetails: "", logoUrl: "" });
    }
  }, [isOpen, initialData, reset]);

  const scope              = watch("scope");
  const selectedType       = watch("type");
  const selectedCurrencies = watch("supportedCurrencies") ?? [];
  const logoUrl            = watch("logoUrl") ?? "";

  function toggleCurrency(cur: SupportedCurrency) {
    const next = selectedCurrencies.includes(cur)
      ? selectedCurrencies.filter((c) => c !== cur)
      : [...selectedCurrencies, cur];
    setValue("supportedCurrencies", next, { shouldValidate: true });
  }

  async function onSubmit(data: CreatePaymentMethodInput) {
    try {
      if (isEdit && initialData) {
        await updateMutation.mutateAsync({ id: initialData.id, data, before: initialData as unknown as Record<string, unknown> });
        toast.success("تم تحديث طريقة الدفع");
      } else {
        await createMutation.mutateAsync(data);
        toast.success("تمت إضافة طريقة الدفع");
      }
      onClose();
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "حدث خطأ، حاول مجدداً");
    }
  }

  const loading = isSubmitting || createMutation.isPending || updateMutation.isPending;
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 50 }} onClick={onClose}>
      <div
        className="modal-panel max-w-lg w-full"
        style={{ maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>
            {isEdit ? "تعديل طريقة الدفع" : "إضافة طريقة دفع جديدة"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg opacity-40 hover:opacity-70 transition-opacity" style={{ color: "var(--text-secondary)" }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-5">

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>اسم طريقة الدفع</label>
            <input {...register("name")} placeholder="مثال: إنستاباي - محمد" className="form-input w-full" />
            {errors.name && <p className="text-rose-500 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>النطاق الجغرافي</label>
            <div className="flex gap-2">
              {(["country", "global"] as const).map((s) => (
                <button key={s} type="button"
                  onClick={() => { setValue("scope", s, { shouldValidate: true }); if (s === "global") setValue("country", null); }}
                  className="flex-1 py-2 px-3 rounded-xl text-sm font-semibold border transition-all"
                  style={{ borderColor: scope === s ? "var(--accent)" : "var(--border)", background: scope === s ? "var(--accent-glow)" : "transparent", color: scope === s ? "var(--accent)" : "var(--text-secondary)" }}
                >
                  {s === "country" ? "دولة محددة" : "عالمية"}
                </button>
              ))}
            </div>
          </div>

          {scope === "country" && (
            <Controller name="country" control={control} render={({ field }) => (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>الدولة</label>
                <div className="grid grid-cols-2 gap-2">
                  {COUNTRY_OPTIONS.map((c) => (
                    <button key={c} type="button" onClick={() => field.onChange(c)}
                      className="py-2 px-3 rounded-xl text-sm border transition-all text-right"
                      style={{ borderColor: field.value === c ? "var(--accent)" : "var(--border)", background: field.value === c ? "var(--accent-glow)" : "transparent", color: field.value === c ? "var(--accent)" : "var(--text-secondary)" }}
                    >
                      {COUNTRY_LABELS[c] ?? c}
                    </button>
                  ))}
                </div>
                {errors.country && <p className="text-rose-500 text-xs mt-1">{errors.country.message}</p>}
              </div>
            )} />
          )}

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>نوع طريقة الدفع</label>
            <div className="flex gap-2 flex-wrap">
              {TYPE_OPTIONS.map((t) => (
                <button key={t} type="button"
                  onClick={() => setValue("type", t as PaymentMethodType, { shouldValidate: true })}
                  className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs border transition-all"
                  style={{ borderColor: selectedType === t ? "var(--accent)" : "var(--border)", background: selectedType === t ? "var(--accent-glow)" : "transparent", color: selectedType === t ? "var(--accent)" : "var(--text-secondary)" }}
                >
                  <PaymentMethodTypeIcon type={t as PaymentMethodType} size="sm" />
                  {getTypeLabel(t as PaymentMethodType)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>العملات المدعومة</label>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_CURRENCIES.map((cur) => {
                const on = selectedCurrencies.includes(cur as SupportedCurrency);
                return (
                  <button key={cur} type="button" onClick={() => toggleCurrency(cur as SupportedCurrency)}
                    className="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
                    style={{ borderColor: on ? "var(--accent)" : "var(--border)", background: on ? "var(--accent-glow)" : "transparent", color: on ? "var(--accent)" : "var(--text-muted)" }}
                  >
                    {cur}
                  </button>
                );
              })}
            </div>
            {errors.supportedCurrencies && <p className="text-rose-500 text-xs mt-1">{errors.supportedCurrencies.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>اسم صاحب الحساب</label>
            <input {...register("holderName")} placeholder="الاسم الكامل" className="form-input w-full" />
            {errors.holderName && <p className="text-rose-500 text-xs mt-1">{errors.holderName.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
              رقم/تفاصيل الحساب <span className="font-normal opacity-60">(اختياري)</span>
            </label>
            <input {...register("accountDetails")} placeholder="رقم المحفظة أو IBAN أو عنوان المحفظة" className="form-input w-full" />
          </div>

          {/* شعار طريقة الدفع */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
              شعار طريقة الدفع <span className="font-normal opacity-60">(رابط صورة — اختياري)</span>
            </label>
            <div className="flex items-center gap-3">
              {logoUrl && !logoPreviewError && (
                <div style={{
                  width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                  border: "1px solid var(--jk-border)", background: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden", boxShadow: "var(--jk-shadow-flat)",
                }}>
                  <img
                    src={logoUrl}
                    alt="preview"
                    style={{ width: 30, height: 30, objectFit: "contain" }}
                    onError={() => setLogoPreviewError(true)}
                    onLoad={() => setLogoPreviewError(false)}
                  />
                </div>
              )}
              <input
                {...register("logoUrl")}
                placeholder="https://example.com/logo.png"
                className="form-input w-full"
                onChange={(e) => { setLogoPreviewError(false); register("logoUrl").onChange(e); }}
                dir="ltr"
              />
            </div>
            {logoUrl && logoPreviewError && (
              <p className="text-xs mt-1" style={{ color: "var(--jk-danger)" }}>تعذّر تحميل الصورة — تحقق من الرابط</p>
            )}
          </div>

          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "var(--accent-glow)", border: "1px solid var(--accent-mid)", color: "var(--text-secondary)" }}>
            ستظهر هذه الطريقة عند إضافة مشترك وستُحتسب دفعاته ضمن رصيدها تلقائياً.
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} disabled={loading}
              className="px-4 py-2 rounded-xl text-sm font-semibold border transition-colors hover:bg-slate-50 disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >إلغاء</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
              style={{ background: "linear-gradient(135deg,#5B5FEF 0%,#5B5FEF 100%)" }}
            >
              {loading && <Spinner size="sm" color="current" />}
              {isEdit ? "حفظ التعديلات" : "حفظ طريقة الدفع"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
