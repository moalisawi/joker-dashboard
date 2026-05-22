"use client";

import { useState, useEffect, useRef, useCallback, startTransition } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, X, CheckCircle2, AlertTriangle, Paperclip, Trash2 } from "lucide-react";

import type { Subscriber, Currency } from "@/types";
import { storage } from "@/lib/storage";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuthStore } from "@/store/authStore";
import { callSubscriberOperation } from "@/lib/clientOperations";
import { calculateExpiry, todayString, PHONE_COUNTRIES, RESIDENCE_COUNTRIES } from "@/lib/utils";
import PhoneInput from "@/components/ui/PhoneInput";
import { SOURCES } from "@/lib/permissions";
import { useActiveMethodsForResidenceQuery } from "@/features/paymentMethods/hooks/useActiveMethodsForResidenceQuery";
import { getAllowedCurrencies, CURRENCY_LABELS } from "@/features/paymentMethods/utils/countryMapping";
import { useEmployees } from "@/hooks/useEmployees";
import { useTeams } from "@/hooks/useTeams";
import { useSubscribersQuery } from "@/features/subscribers/hooks/useSubscribersQuery";
import { createSubscriberSchema } from "@/features/subscribers/schemas/subscriber.schema";

// ─── Form schema ──────────────────────────────────────────────────────────────

const formSchema = z.object({
  date:            z.string().min(1, "التاريخ مطلوب"),
  name:            createSubscriberSchema.shape.name,
  age:             z.string().optional(),
  residence:       createSubscriberSchema.shape.residence,
  package:         createSubscriberSchema.shape.package,
  durationPreset:  z.enum(["15", "30", "60", "90", "custom"]),
  duration:        z.string().min(1, "المدة مطلوبة"),
  currencyOriginal: createSubscriberSchema.shape.currencyOriginal,
  totalPrice:      z.string().min(1, "المبلغ مطلوب"),
  initialPayment:  z.string().optional(),
  payment:         createSubscriberSchema.shape.payment,
  source:          createSubscriberSchema.shape.source,
  sourceDetail:    z.string().optional(),
  convincedBy:     createSubscriberSchema.shape.convincedBy,
  paidShift:       createSubscriberSchema.shape.paidShift,
  team:            z.string().optional(),
  notes:           createSubscriberSchema.shape.notes,
  referrer:        z.string().optional(),
}).superRefine((data, ctx) => {
  const total   = parseFloat(data.totalPrice) || 0;
  const initial = data.initialPayment ? parseFloat(data.initialPayment) || 0 : 0;
  if (data.initialPayment && initial > total) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "الدفعة الأولى لا يمكن أن تتجاوز المبلغ الكلي",
      path: ["initialPayment"],
    });
  }
});

type FormValues = z.infer<typeof formSchema>;

// ─── Constants ────────────────────────────────────────────────────────────────

const RESIDENCE_DIAL_MAP: Record<string, string> = {
  "فلسطين-غزة":    "+970",
  "فلسطين-الضفة":  "+970",
  "فلسطين-الداخل": "+972",
  "JO":             "+962",
  "EG":             "+20",
};

const DURATION_PRESETS = [
  { label: "15 يوم",  value: "15"     as const },
  { label: "شهر",     value: "30"     as const },
  { label: "شهرين",   value: "60"     as const },
  { label: "3 شهور",  value: "90"     as const },
  { label: "مخصص",    value: "custom" as const },
];

const AD_SOURCE_OPTIONS = [
  { label: "فيسبوك",   value: "Facebook"  },
  { label: "إنستغرام", value: "Instagram" },
  { label: "تيك توك",  value: "TikTok"    },
  { label: "يوتيوب",   value: "YouTube"   },
  { label: "أخرى",     value: "أخرى"      },
];

const DRAFT_KEY = "subscriber-draft";
const DRAFT_TTL = 24 * 60 * 60 * 1000;

const SECTIONS = [
  { key: "info",      icon: "👤", title: "بيانات المشترك",  color: "#5B5FEF",  colorAlpha: "rgba(59,130,246,0.1)" },
  { key: "package",   icon: "💳", title: "تفاصيل الباقة",  color: "#3B82F6",  colorAlpha: "rgba(139,92,246,0.1)" },
  { key: "payment",   icon: "💰", title: "الدفعة والدفع",  color: "#5B5FEF",  colorAlpha: "rgba(16,185,129,0.1)" },
  { key: "assign",    icon: "👥", title: "التعيين والمصدر", color: "#F59E0B",  colorAlpha: "rgba(245,158,11,0.1)" },
  { key: "notes",     icon: "📎", title: "ملاحظات ومرفقات", color: "#6b7280",  colorAlpha: "rgba(100,116,139,0.1)" },
] as const;

type SectionKey = typeof SECTIONS[number]["key"];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  mode:          "add" | "edit";
  subscriber?:   Subscriber | null;
  exchangeRates: Record<string, number>;
  onClose:       () => void;
  onSaved:       () => void;
  onOpenPayment?: (subscriberId: string) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SubscriberModal({
  mode, subscriber, exchangeRates, onClose, onSaved, onOpenPayment,
}: Props) {
  const { user } = useAuthStore();
  const isEdit = mode === "edit" && !!subscriber;

  const { employees: allEmployees } = useEmployees({ activeOnly: true });
  const { data: allTeams = [] }     = useTeams(false);
  const { data: allSubscribers = [] } = useSubscribersQuery();

  const salesEmployees = allEmployees.filter(
    (e) => e.employeeRole === "sales" || e.employeeRole === "admin" || e.employeeRole === "owner"
  );
  const nutritionTeams = allTeams.filter((t) => t.type === "nutrition" && t.active !== false);
  const allActiveNames = allEmployees.map((e) => e.name);

  // ── Local state ──────────────────────────────────────────────────────────────
  const [phoneE164,           setPhoneE164]           = useState(() => {
    if (isEdit && subscriber?.phone) {
      const dc = subscriber.dialCode || PHONE_COUNTRIES.find(c => c.iso === subscriber.phoneCountry)?.dialCode || "+970";
      return `${dc}${subscriber.phone}`;
    }
    return "";
  });
  const [paymentMethodId,    setPaymentMethodId]    = useState("");
  const [loading,            setLoading]            = useState(false);
  const [serverError,        setServerError]        = useState("");
  const [openPaymentAfterSave, setOpenPaymentAfterSave] = useState(false);
  const [draftPrompt,        setDraftPrompt]        = useState<FormValues | null>(null);
  const [openSections,       setOpenSections]       = useState<Set<SectionKey>>(
    new Set(["info"] as SectionKey[])
  );
  const [selectedFiles,      setSelectedFiles]      = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── React Hook Form ──────────────────────────────────────────────────────────
  const defaultValues: FormValues = {
    date:             todayString(),
    name:             "",
    age:              "",
    residence:        "فلسطين-غزة",
    package:          "فضية",
    durationPreset:   "30",
    duration:         "30",
    currencyOriginal: "USD",
    totalPrice:       "",
    initialPayment:   "",
    payment:          "",
    source:           "",
    sourceDetail:     "",
    convincedBy:      user?.employeeName || user?.name || "",
    paidShift:        user?.employeeName || user?.name || "",
    team:             "",
    notes:            "",
    referrer:         "",
  };

  const { control, register, handleSubmit, setValue, reset, formState: { errors, isValid } } =
    useForm<FormValues, unknown, FormValues>({
      resolver:      zodResolver(formSchema) as import("react-hook-form").Resolver<FormValues>,
      defaultValues,
      mode:          "onChange",
    });

  // ── Watches ──────────────────────────────────────────────────────────────────
  const watchedResidence      = useWatch({ control, name: "residence"       });
  const watchedSource         = useWatch({ control, name: "source"          });
  const watchedCurrency       = useWatch({ control, name: "currencyOriginal"});
  const watchedTotalPrice     = useWatch({ control, name: "totalPrice"      });
  const watchedDate           = useWatch({ control, name: "date"            });
  const watchedDurationPreset = useWatch({ control, name: "durationPreset"  });
  const watchedPayment        = useWatch({ control, name: "payment"         });
  const watchedAll            = useWatch({ control                          });

  // ── Edit mode populate ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !subscriber) return;
    const d = subscriber.duration || 30;
    const preset = (["15","30","60","90"] as const).find(p => String(d) === p) ?? "custom";
    reset({
      date:             subscriber.date || todayString(),
      name:             subscriber.name || "",
      age:              subscriber.age ? String(subscriber.age) : "",
      residence:        subscriber.residence || "فلسطين-غزة",
      package:          subscriber.package  || "فضية",
      durationPreset:   preset,
      duration:         String(d),
      currencyOriginal: subscriber.currencyOriginal || "USD",
      totalPrice:       String(subscriber.totalPrice || ""),
      initialPayment:   "",
      payment:          subscriber.payment  || "",
      source:           subscriber.source   || "",
      sourceDetail:     "",
      convincedBy:      subscriber.convincedBy || "",
      paidShift:        subscriber.paidShift   || "",
      team:             subscriber.team        || "",
      notes:            subscriber.notes       || "",
      referrer:         subscriber.referrer    || "",
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, subscriber?.id]);

  // ── Draft restore on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (isEdit) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed.version === 1 && Date.now() - parsed.timestamp < DRAFT_TTL) {
        startTransition(() => setDraftPrompt(parsed.data as FormValues));
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Draft autosave ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (isEdit) return;
    if (!watchedAll.name && !watchedAll.totalPrice && !phoneE164) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, timestamp: Date.now(), data: watchedAll }));
      } catch { /* ignore */ }
    }, 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(watchedAll)]);

  // ── Auto dial code ───────────────────────────────────────────────────────────
  useEffect(() => {
    const dialCode = RESIDENCE_DIAL_MAP[watchedResidence];
    if (!dialCode) return;
    startTransition(() => {
      setPhoneE164(prev => {
        if (!prev) return dialCode;
        const knownCodes = Object.values(RESIDENCE_DIAL_MAP);
        const existing = knownCodes.find(d => prev.startsWith(d));
        if (existing) return `${dialCode}${prev.slice(existing.length)}`;
        return prev;
      });
    });
  }, [watchedResidence]);

  // ── Payment methods ──────────────────────────────────────────────────────────
  const { methods: firestoreMethods, isLoading: methodsLoading } =
    useActiveMethodsForResidenceQuery(watchedResidence);

  const selectedFirestoreMethod = firestoreMethods.find((m) => m.id === paymentMethodId);
  const allowedCurrencies = selectedFirestoreMethod
    ? getAllowedCurrencies(selectedFirestoreMethod.supportedCurrencies)
    : ["USD", "EGP", "JOD", "ILS"] as Currency[];

  function handlePaymentMethodChange(value: string) {
    if (!value) { setValue("payment", ""); setPaymentMethodId(""); return; }
    const fm = firestoreMethods.find(m => m.id === value);
    if (fm) { setValue("payment", fm.name, { shouldValidate: true }); setPaymentMethodId(fm.id); }
    else    { setValue("payment", value,   { shouldValidate: true }); setPaymentMethodId(""); }
  }

  // ── Derived values ───────────────────────────────────────────────────────────
  const lockedRate    = exchangeRates[watchedCurrency] || 1;
  const totalPrice    = parseFloat(watchedTotalPrice) || 0;
  const totalPriceUSD = totalPrice / lockedRate;
  const isToday       = watchedDate === todayString();

  const localPhone = phoneE164
    ? (() => {
        const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
        const match  = sorted.find(c => phoneE164.startsWith(c.dialCode));
        return match ? phoneE164.slice(match.dialCode.length) : phoneE164.replace(/^\+\d{1,4}/, "");
      })()
    : "";
  const duplicateSubscriber = localPhone.length >= 7
    ? allSubscribers.find(s => s.phone === localPhone && s.id !== subscriber?.id)
    : undefined;

  // ── Section completion tracking ──────────────────────────────────────────────
  const sectionDone: Record<SectionKey, boolean> = {
    info:    !!(watchedAll.name && phoneE164),
    package: !!(watchedAll.totalPrice && watchedAll.duration),
    payment: !!(watchedAll.payment),
    assign:  !!(watchedAll.convincedBy && watchedAll.source),
    notes:   true,
  };
  const doneCount = Object.values(sectionDone).filter(Boolean).length;

  function toggleSection(key: SectionKey) {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // ── File handling ────────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setSelectedFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...files.filter(f => !names.has(f.name))];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(name: string) {
    setSelectedFiles(prev => prev.filter(f => f.name !== name));
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  const onSubmit = useCallback(async (data: FormValues) => {
    if (!user) return;
    setServerError("");
    setLoading(true);
    try {
      const sorted     = [...PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
      const match      = phoneE164 ? sorted.find(c => phoneE164.startsWith(c.dialCode)) : PHONE_COUNTRIES.find(c => c.iso === "PS");
      const dialCode   = match?.dialCode    ?? "+970";
      const phoneISO   = match?.iso         ?? "PS";
      const phone      = phoneE164.startsWith(dialCode) ? phoneE164.slice(dialCode.length) : phoneE164.replace(/^\+\d{1,4}/, "");

      const durationDays = parseInt(data.duration) || 0;
      const expiryDate   = calculateExpiry(data.date, durationDays);

      let paidAmount: number, remainingAmount: number, paidAmountUSD: number, remainingAmountUSD: number;
      if (!isEdit) {
        const init         = data.initialPayment?.trim() ?? "";
        paidAmount         = init === "" ? totalPrice : parseFloat(init) || 0;
        remainingAmount    = totalPrice - paidAmount;
        paidAmountUSD      = paidAmount / lockedRate;
        remainingAmountUSD = remainingAmount / lockedRate;
      } else {
        paidAmountUSD      = subscriber!.paidAmountUSD ?? totalPriceUSD;
        paidAmount         = subscriber!.paidAmount    ?? paidAmountUSD * lockedRate;
        remainingAmountUSD = Math.max(0, totalPriceUSD - paidAmountUSD);
        remainingAmount    = Math.max(0, totalPrice    - paidAmount);
      }

      const refundAmountUSD = subscriber?.refundAmountUSD || 0;
      const netAmountUSD    = Math.max(0, paidAmountUSD - refundAmountUSD);

      const payload = {
        date:               data.date,
        name:               data.name.trim(),
        residence:          data.residence,
        phoneCountry:       phoneISO,
        dialCode,
        phone,
        phoneE164:          phoneE164 || null,
        age:                data.age ? Number(data.age) : null,
        package:            data.package,
        duration:           durationDays,
        expiryDate,
        currencyOriginal:   data.currencyOriginal,
        currency:           data.currencyOriginal,
        lockedRate,
        totalPrice,
        totalPriceUSD,
        amount:             totalPrice,
        amountUSD:          totalPriceUSD,
        paidAmount,
        paidAmountUSD,
        remainingAmount,
        remainingAmountUSD,
        netAmountUSD,
        payment:            data.payment,
        source:             data.source,
        sourceDetail:       data.sourceDetail  || null,
        referrer:           data.referrer?.trim() || null,
        convincedBy:        data.convincedBy,
        paidShift:          data.paidShift,
        team:               data.team || null,
        notes:              data.notes?.trim() || null,
      };

      let newSubscriberId: string | undefined;

      if (isEdit) {
        await callSubscriberOperation("updateSubscriber", { subscriberId: subscriber!.id, subscriber: payload });
      } else {
        // Upload all selected files
        const uploadedUrls: string[] = [];
        for (const file of selectedFiles) {
          const storageRef = ref(storage, `receipts/pending/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          uploadedUrls.push(await getDownloadURL(storageRef));
        }
        const receiptUrl  = uploadedUrls[0] ?? null;

        const result = await callSubscriberOperation<{ subscriberId: string }>("createSubscriber", {
          subscriber:     { ...payload, ...(uploadedUrls.length > 1 ? { receiptUrls: uploadedUrls } : {}) },
          initialPayment: paidAmount > 0
            ? { amountOriginal: paidAmount, currencyOriginal: data.currencyOriginal, exchangeRate: lockedRate, paymentMethod: data.payment, paymentMethodId: paymentMethodId || undefined, receiptUrl, date: data.date, notes: null }
            : null,
        });
        newSubscriberId = result.subscriberId;
      }

      localStorage.removeItem(DRAFT_KEY);
      onSaved();
      if (openPaymentAfterSave && newSubscriberId && onOpenPayment) onOpenPayment(newSubscriberId);
      onClose();
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }, [user, isEdit, subscriber, phoneE164, paymentMethodId, openPaymentAfterSave, lockedRate, totalPrice, totalPriceUSD, selectedFiles, onClose, onSaved, onOpenPayment]);

  const formSubmit = handleSubmit(onSubmit);

  function handleCancel() { localStorage.removeItem(DRAFT_KEY); onClose(); }
  function restoreDraft()  { if (draftPrompt) reset(draftPrompt); setDraftPrompt(null); }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel max-w-2xl w-full flex flex-col"
        style={{ maxHeight: "92vh" }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-5 py-3.5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-base font-bold shrink-0"
              style={{ background: "var(--accent-glow)", color: "var(--accent)" }}
            >
              {isEdit ? "✏️" : "＋"}
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight" style={{ color: "var(--text-primary)" }}>
                {isEdit ? "تعديل بيانات المشترك" : "إضافة مشترك جديد"}
              </h3>
              {!isEdit && (
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex gap-0.5">
                    {SECTIONS.map(s => (
                      <div
                        key={s.key}
                        className="h-1 w-5 rounded-full transition-all duration-300"
                        style={{ background: sectionDone[s.key] ? s.color : "var(--border)" }}
                      />
                    ))}
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {doneCount}/{SECTIONS.length}
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors opacity-40 hover:opacity-80"
            style={{ color: "var(--text-secondary)" }}
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          <form id="sub-form" onSubmit={formSubmit}>

            {/* Error */}
            {serverError && (
              <div className="mx-4 mt-4 px-3 py-2.5 rounded-xl text-sm flex items-center gap-2"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444" }}>
                <AlertTriangle size={14} className="shrink-0" />
                {serverError}
              </div>
            )}
            {isEdit && subscriber?.subscriptionState === "withdrawn" && (
              <div className="mx-4 mt-4 px-3 py-2.5 rounded-xl text-xs"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                هذا المشترك منسحب — التعديل يغير البيانات فقط.
              </div>
            )}
            {draftPrompt && (
              <div className="mx-4 mt-4 px-3 py-2.5 rounded-xl text-sm flex items-center justify-between gap-3"
                style={{ background: "var(--accent-glow)", border: "1px solid var(--accent)", color: "var(--accent)" }}>
                <span className="text-xs font-medium">📝 يوجد مسودة محفوظة</span>
                <div className="flex gap-1.5">
                  <button type="button" onClick={restoreDraft}
                    className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                    style={{ background: "var(--accent)", color: "#fff" }}>
                    استكمال
                  </button>
                  <button type="button" onClick={() => setDraftPrompt(null)}
                    className="text-xs px-2.5 py-1 rounded-lg font-semibold opacity-70"
                    style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                    تجاهل
                  </button>
                </div>
              </div>
            )}

            <div className="px-4 py-3 space-y-2">

              {/* ══════════════════════════════════════════════════════════════
                  SECTION 1 — بيانات المشترك
              ══════════════════════════════════════════════════════════════ */}
              <Section
                sectionKey="info"
                open={openSections.has("info")}
                onToggle={toggleSection}
                done={sectionDone.info}
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="الاسم الكامل *" error={errors.name?.message}>
                      <input {...register("name")} placeholder="أحمد محمد" className="form-input" />
                    </Field>
                    <Field label="العمر" error={errors.age?.message}>
                      <input {...register("age")} type="number" min="10" max="100" placeholder="اختياري" className="form-input" />
                    </Field>
                  </div>

                  <Field label="الإقامة *" error={errors.residence?.message}>
                    <Controller name="residence" control={control} render={({ field }) => (
                      <NativeSelect
                        value={field.value}
                        onChange={field.onChange}
                        options={[
                          ...RESIDENCE_COUNTRIES.map(c => ({ label: c.name, value: c.value })),
                          ...PHONE_COUNTRIES.filter(c => !RESIDENCE_COUNTRIES.find(r => r.value === c.iso)).map(c => ({ label: c.name, value: c.iso })),
                        ]}
                      />
                    )} />
                  </Field>

                  <Field label="رقم الهاتف">
                    <PhoneInput value={phoneE164} onChange={setPhoneE164} />
                    {duplicateSubscriber && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs"
                        style={{ color: "#F59E0B" }}>
                        <AlertTriangle size={11} />
                        مشترك موجود بنفس الرقم: <strong>{duplicateSubscriber.name}</strong>
                      </div>
                    )}
                  </Field>
                </div>
              </Section>

              {/* ══════════════════════════════════════════════════════════════
                  SECTION 2 — تفاصيل الباقة
              ══════════════════════════════════════════════════════════════ */}
              <Section
                sectionKey="package"
                open={openSections.has("package")}
                onToggle={toggleSection}
                done={sectionDone.package}
              >
                <div className="space-y-3">

                  {/* Date */}
                  <Field label="تاريخ الاشتراك *" error={errors.date?.message}>
                    <div className="flex items-center gap-2">
                      <input {...register("date")} type="date" className="form-input flex-1" />
                      {isToday && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-lg shrink-0"
                          style={{ background: "var(--accent-glow)", color: "var(--accent)" }}>
                          اليوم
                        </span>
                      )}
                    </div>
                  </Field>

                  {/* Package */}
                  <Field label="الباقة *" error={errors.package?.message}>
                    <Controller name="package" control={control} render={({ field }) => (
                      <div className="grid grid-cols-2 gap-2">
                        {(["فضية", "ذهبية"] as const).map(pkg => (
                          <button
                            key={pkg} type="button"
                            onClick={() => field.onChange(pkg)}
                            className="py-2.5 rounded-xl text-sm font-bold border-2 transition-all"
                            style={{
                              borderColor: field.value === pkg
                                ? (pkg === "فضية" ? "#5B5FEF" : "#F59E0B")
                                : "var(--border)",
                              background:  field.value === pkg
                                ? (pkg === "فضية" ? "rgba(96,165,250,0.1)" : "rgba(251,191,36,0.1)")
                                : "var(--surface-2)",
                              color:       field.value === pkg
                                ? (pkg === "فضية" ? "#5B5FEF" : "#F59E0B")
                                : "var(--text-secondary)",
                            }}
                          >
                            {pkg === "فضية" ? "🥈 فضية" : "🥇 ذهبية"}
                          </button>
                        ))}
                      </div>
                    )} />
                  </Field>

                  {/* Duration presets */}
                  <Field label="مدة الاشتراك *" error={errors.duration?.message}>
                    <Controller name="durationPreset" control={control} render={({ field: pf }) => (
                      <Controller name="duration" control={control} render={({ field: df }) => (
                        <div className="space-y-2">
                          <div className="flex gap-1.5 flex-wrap">
                            {DURATION_PRESETS.map(({ label, value }) => (
                              <button
                                key={value} type="button"
                                onClick={() => {
                                  pf.onChange(value);
                                  if (value !== "custom") df.onChange(value, { shouldValidate: true });
                                }}
                                className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
                                style={{
                                  borderColor: pf.value === value ? "var(--accent)" : "var(--border)",
                                  background:  pf.value === value ? "var(--accent-glow)" : "var(--surface-2)",
                                  color:       pf.value === value ? "var(--accent)" : "var(--text-secondary)",
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          {watchedDurationPreset === "custom" && (
                            <input
                              {...df}
                              type="number" min="1"
                              placeholder="أدخل عدد الأيام"
                              className="form-input"
                            />
                          )}
                        </div>
                      )} />
                    )} />
                  </Field>

                  {/* Currency + Price */}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="العملة *" error={errors.currencyOriginal?.message}>
                      <Controller name="currencyOriginal" control={control} render={({ field }) => (
                        <NativeSelect
                          value={field.value}
                          onChange={field.onChange}
                          options={allowedCurrencies.map(c => ({ label: CURRENCY_LABELS[c] ?? c, value: c }))}
                        />
                      )} />
                    </Field>

                    <Field label={`المبلغ (${watchedCurrency}) *`} error={errors.totalPrice?.message}>
                      <input {...register("totalPrice")} type="number" min="0" step="0.01" placeholder="0.00" className="form-input" />
                      {totalPrice > 0 && watchedCurrency !== "USD" && (
                        <span className="text-xs mt-1 block" style={{ color: "var(--text-secondary)" }}>
                          ≈ ${totalPriceUSD.toFixed(2)} USD
                        </span>
                      )}
                    </Field>
                  </div>

                </div>
              </Section>

              {/* ══════════════════════════════════════════════════════════════
                  SECTION 3 — الدفعة والدفع
              ══════════════════════════════════════════════════════════════ */}
              <Section
                sectionKey="payment"
                open={openSections.has("payment")}
                onToggle={toggleSection}
                done={sectionDone.payment}
              >
                <div className="space-y-3">

                  {!isEdit && (
                    <Field label="الدفعة الأولى" error={errors.initialPayment?.message}>
                      <input
                        {...register("initialPayment")}
                        type="number" min="0" step="0.01"
                        placeholder="فارغ = استلام المبلغ كاملاً"
                        className="form-input"
                      />
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                          فارغ = {watchedTotalPrice || 0} {watchedCurrency}
                        </span>
                        {totalPrice > 0 && (
                          <button
                            type="button"
                            onClick={() => setValue("initialPayment", watchedTotalPrice, { shouldValidate: true })}
                            className="flex items-center gap-1 text-xs font-semibold rounded-lg px-2 py-1 transition-colors"
                            style={{ color: "#5B5FEF", background: "rgba(16,185,129,0.1)" }}
                          >
                            <CheckCircle2 size={11} />
                            استلمت المبلغ كاملاً
                          </button>
                        )}
                      </div>
                    </Field>
                  )}

                  <Field label="طريقة الدفع *" error={errors.payment?.message}>
                    <NativeSelect
                      value={paymentMethodId || watchedPayment}
                      onChange={handlePaymentMethodChange}
                      options={
                        !methodsLoading && firestoreMethods.length > 0
                          ? [{ label: "اختر...", value: "" }, ...firestoreMethods.map(m => ({ label: m.name, value: m.id }))]
                          : [{ label: methodsLoading ? "جاري التحميل..." : "اختر...", value: "" }]
                      }
                    />
                  </Field>

                  {/* Multi-file upload */}
                  {!isEdit && (
                    <Field label="وصل/وصولات الدفع">
                      <div
                        className="rounded-xl border-2 border-dashed p-3 text-center cursor-pointer transition-colors hover:opacity-80"
                        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Paperclip size={16} className="mx-auto mb-1 opacity-40" style={{ color: "var(--text-secondary)" }} />
                        <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                          اضغط لإضافة ملفات · JPG / PNG / PDF · حتى 5MB لكل ملف
                        </p>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,application/pdf"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      {selectedFiles.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {selectedFiles.map(f => (
                            <div
                              key={f.name}
                              className="flex items-center justify-between px-3 py-2 rounded-xl text-xs"
                              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="opacity-50">📄</span>
                                <span className="truncate font-medium" style={{ color: "var(--text-primary)" }}>{f.name}</span>
                                <span className="shrink-0 opacity-50" style={{ color: "var(--text-secondary)" }}>
                                  ({(f.size / 1024).toFixed(0)} KB)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); removeFile(f.name); }}
                                className="p-1 rounded-lg opacity-40 hover:opacity-80 transition-opacity shrink-0"
                                style={{ color: "#EF4444" }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </Field>
                  )}

                </div>
              </Section>

              {/* ══════════════════════════════════════════════════════════════
                  SECTION 4 — التعيين والمصدر
              ══════════════════════════════════════════════════════════════ */}
              <Section
                sectionKey="assign"
                open={openSections.has("assign")}
                onToggle={toggleSection}
                done={sectionDone.assign}
              >
                <div className="space-y-3">

                  <Field label="مصدر الاشتراك *" error={errors.source?.message}>
                    <Controller name="source" control={control} render={({ field }) => (
                      <NativeSelect
                        value={field.value}
                        onChange={field.onChange}
                        options={[{ label: "اختر...", value: "" }, ...SOURCES.map(s => ({ label: s, value: s }))]}
                      />
                    )} />
                  </Field>

                  {watchedSource === "إعلان" && (
                    <Field label="منصة الإعلان" error={errors.sourceDetail?.message}>
                      <Controller name="sourceDetail" control={control} render={({ field }) => (
                        <NativeSelect
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          options={[{ label: "اختر المنصة...", value: "" }, ...AD_SOURCE_OPTIONS]}
                        />
                      )} />
                    </Field>
                  )}

                  {watchedSource === "ترشيح" && (
                    <Field label="اسم المرشِّح" error={errors.referrer?.message}>
                      <input {...register("referrer")} placeholder="اسم الشخص الذي رشّح المشترك" className="form-input" />
                    </Field>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="أقنعه بالاشتراك *" error={errors.convincedBy?.message} hint="من بدأ المحادثة">
                      <Controller name="convincedBy" control={control} render={({ field }) => (
                        <NativeSelect
                          value={field.value}
                          onChange={field.onChange}
                          options={[{ label: "اختر...", value: "" }, ...salesEmployees.map(e => ({ label: e.name, value: e.name }))]}
                        />
                      )} />
                    </Field>

                    <Field label="استلم الدفعة *" error={errors.paidShift?.message} hint="من استلم المبلغ">
                      <Controller name="paidShift" control={control} render={({ field }) => (
                        <NativeSelect
                          value={field.value}
                          onChange={field.onChange}
                          options={[{ label: "اختر...", value: "" }, ...allActiveNames.map(n => ({ label: n, value: n }))]}
                        />
                      )} />
                    </Field>
                  </div>

                  <Field label="فريق التغذية">
                    <Controller name="team" control={control} render={({ field }) => (
                      <NativeSelect
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        options={[
                          { label: "بدون تعيين", value: "" },
                          ...nutritionTeams.map(t => ({ label: t.name, value: t.name })),
                        ]}
                        placeholder={nutritionTeams.length === 0 ? "لا يوجد فرق تغذية بعد" : undefined}
                      />
                    )} />
                  </Field>

                </div>
              </Section>

              {/* ══════════════════════════════════════════════════════════════
                  SECTION 5 — ملاحظات ومرفقات
              ══════════════════════════════════════════════════════════════ */}
              <Section
                sectionKey="notes"
                open={openSections.has("notes")}
                onToggle={toggleSection}
                done={false}
              >
                <Field label="ملاحظات" error={errors.notes?.message}>
                  <textarea
                    {...register("notes")}
                    rows={3}
                    placeholder="أي ملاحظات إضافية عن المشترك أو الاتفاق..."
                    className="form-input resize-none"
                  />
                </Field>
              </Section>

            </div>
          </form>
        </div>

        {/* ── Footer ── */}
        <div
          className="px-4 py-3 flex items-center gap-2"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 h-9 rounded-xl text-sm font-semibold border transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "transparent" }}
          >
            إلغاء
          </button>

          {/* Save + open payment */}
          {!isEdit && onOpenPayment && (
            <button
              type="submit"
              form="sub-form"
              disabled={loading || !isValid}
              onClick={() => setOpenPaymentAfterSave(true)}
              className="h-9 px-3 rounded-xl text-xs font-semibold border transition-all disabled:opacity-40"
              style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "var(--accent-glow)" }}
            >
              حفظ + دفعة
            </button>
          )}

          {/* Primary save */}
          <button
            type="submit"
            form="sub-form"
            disabled={loading || !isValid}
            onClick={() => setOpenPaymentAfterSave(false)}
            className="flex-2 h-9 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
            style={{ flex: 2, background: loading || !isValid ? "var(--surface-2)" : "var(--accent)", color: loading || !isValid ? "var(--text-secondary)" : "#fff" }}
          >
            {loading ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "حفظ المشترك"}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Section component ────────────────────────────────────────────────────────

function Section({
  sectionKey, open, onToggle, done, children,
}: {
  sectionKey: SectionKey;
  open:       boolean;
  onToggle:   (k: SectionKey) => void;
  done:       boolean;
  children:   React.ReactNode;
}) {
  const meta = SECTIONS.find(s => s.key === sectionKey)!;
  const idx  = SECTIONS.findIndex(s => s.key === sectionKey) + 1;

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{ border: `1px solid ${open ? meta.color + "40" : "var(--border)"}` }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => onToggle(sectionKey)}
        className="w-full flex items-center gap-3 px-4 py-3 text-right transition-colors"
        style={{ background: open ? meta.colorAlpha : "var(--surface-2)" }}
      >
        <div
          className="w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0"
          style={{ background: done ? meta.color : "var(--border)", color: done ? "#fff" : "var(--text-secondary)" }}
        >
          {done ? "✓" : idx}
        </div>
        <span className="text-sm font-semibold flex-1" style={{ color: open ? meta.color : "var(--text-primary)" }}>
          {meta.icon} {meta.title}
        </span>
        <ChevronDown
          size={15}
          className="shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", color: "var(--text-secondary)" }}
        />
      </button>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4 pt-3" style={{ borderTop: `1px solid ${meta.color}20` }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label, children, error, hint,
}: {
  label:    string;
  children: React.ReactNode;
  error?:   string;
  hint?:    string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          {label}
        </label>
        {hint && (
          <span className="text-xs opacity-60" style={{ color: "var(--text-secondary)" }}>{hint}</span>
        )}
      </div>
      {children}
      {error && (
        <span className="text-xs" style={{ color: "#EF4444" }}>{error}</span>
      )}
    </div>
  );
}

// ─── Native select (styled) ───────────────────────────────────────────────────

function NativeSelect({
  value, onChange, options, placeholder,
}: {
  value:       string;
  onChange:    (v: string) => void;
  options:     { label: string; value: string }[];
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="form-input appearance-none pe-8"
        style={{ color: value ? "var(--text-primary)" : "var(--text-secondary)" }}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown
        size={13}
        className="absolute top-1/2 -translate-y-1/2 pointer-events-none opacity-50"
        style={{ insetInlineEnd: "0.75rem", color: "var(--text-secondary)" }}
      />
    </div>
  );
}
