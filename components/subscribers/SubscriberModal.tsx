"use client";

import { useState, useEffect, useMemo, useRef, useCallback, startTransition } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, X, CheckCircle2, AlertTriangle, Paperclip, Trash2, User, CreditCard, Wallet, Users2, FileText, UserPlus, Edit3 } from "lucide-react";

import type { Subscriber, Currency } from "@/types";
import { storage } from "@/lib/storage";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuthStore } from "@/store/authStore";
import { callSubscriberOperation } from "@/lib/clientOperations";
import PaymentPlanPicker, {
  defaultPaymentPlan, toPaymentPlanPayload, type PaymentPlanValue,
} from "@/components/subscribers/PaymentPlanPicker";
import { calculateExpiry, todayString, PHONE_COUNTRIES, RESIDENCE_COUNTRIES } from "@/lib/utils";
import PhoneInput from "@/components/ui/PhoneInput";
import { SOURCES } from "@/lib/permissions";
import { useActiveMethodsForResidenceQuery } from "@/features/paymentMethods/hooks/useActiveMethodsForResidenceQuery";
import { getAllowedCurrencies, CURRENCY_LABELS } from "@/features/paymentMethods/utils/countryMapping";
import { useEmployees } from "@/hooks/useEmployees";
import { useTeams } from "@/hooks/useTeams";
import { useSubscribersQuery } from "@/features/subscribers/hooks/useSubscribersQuery";
import { createSubscriberSchema } from "@/features/subscribers/schemas/subscriber.schema";
import { CREATE_ONLY_FIELDS } from "@/constants/subscriberFieldPolicy";

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

type SectionKey = "info" | "package" | "payment" | "assign" | "notes";

const SECTIONS: ReadonlyArray<{
  readonly key:        SectionKey;
  readonly icon:       React.ReactNode;
  readonly title:      string;
  readonly color:      string;
  readonly colorAlpha: string;
}> = [
  { key: "info",    icon: <User size={16} />,       title: "بيانات المشترك",   color: "#5B5FEF", colorAlpha: "rgba(91,95,239,0.08)"   },
  { key: "package", icon: <CreditCard size={16} />,  title: "تفاصيل الباقة",   color: "#3B82F6", colorAlpha: "rgba(59,130,246,0.08)"  },
  { key: "payment", icon: <Wallet size={16} />,      title: "الدفعة والدفع",   color: "#10B981", colorAlpha: "rgba(16,185,129,0.08)"  },
  { key: "assign",  icon: <Users2 size={16} />,      title: "التعيين والمصدر", color: "#F59E0B", colorAlpha: "rgba(245,158,11,0.08)"  },
  { key: "notes",   icon: <FileText size={16} />,    title: "ملاحظات ومرفقات", color: "#6B7280", colorAlpha: "rgba(107,114,128,0.08)" },
];

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

  // Memoised so it can be a dependency of onSubmit without re-creating the
  // callback on every render. onSubmit reads it to resolve convincedByUid, and
  // omitting it from the deps meant the callback could close over the list as
  // it was before useEmployees resolved — saving a subscriber with no
  // convincedByUid, which is the field row-level access reads.
  const salesEmployees = useMemo(
    () => allEmployees.filter(
      (e) => e.employeeRole === "sales" || e.employeeRole === "admin" || e.employeeRole === "owner"
    ),
    [allEmployees]
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
  // The plan lives outside react-hook-form: it is a compound value with its
  // own preview, and the form schema validates the money fields, not the
  // schedule (the generator does that and reports its own error).
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlanValue>(() => defaultPaymentPlan(""));
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
      /*
       * Prefilled, not blanked.
       *
       * This was hardcoded to "" and harmless while the server dropped
       * sourceDetail on every write — there was never a stored value to lose.
       * Now that the field is stored, opening a subscriber and pressing save
       * would submit an empty box over the real platform. A field is only safe
       * to leave out of an edit form while nothing keeps it.
       */
      sourceDetail:     subscriber.sourceDetail || "",
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

      // Resolve the Firebase UID for the convincedBy employee.
      // useEmployees maps docs as { uid: d.id, ... } so the UID is .uid.
      const convincedByEmp    = salesEmployees.find(e => e.name === data.convincedBy);
      const convincedByUid    = convincedByEmp?.uid
                                  ?? (isEdit ? (subscriber?.convincedByUid ?? undefined) : undefined);

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
        convincedByUid:     convincedByUid ?? null,
        paidShift:          data.paidShift,
        team:               data.team || null,
        notes:              data.notes?.trim() || null,
      };

      let newSubscriberId: string | undefined;

      if (isEdit) {
        /*
         * Send who the person is, not what they bought.
         *
         * The terms of the sale — price, rate, currency, duration, package,
         * dates — are fixed when the subscription is sold and moved afterwards
         * only by renew, freeze or resume. The server refuses them here anyway;
         * stripping them client-side means an ordinary rename does not arrive
         * carrying nine fields it has no business restating.
         */
        const editable = Object.fromEntries(
          Object.entries(payload).filter(([k]) => !(CREATE_ONLY_FIELDS as readonly string[]).includes(k))
        );
        await callSubscriberOperation("updateSubscriber", { subscriberId: subscriber!.id, subscriber: editable });
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
          paymentPlan: toPaymentPlanPayload(paymentPlan, totalPrice - paidAmount),
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
  }, [user, isEdit, subscriber, phoneE164, paymentMethodId, openPaymentAfterSave, lockedRate, totalPrice, totalPriceUSD, selectedFiles, salesEmployees, onClose, onSaved, onOpenPayment]);

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
          className="flex items-center justify-between"
          style={{ borderBottom: "1px solid #E5E7EB", padding: "20px 24px 18px" }}
        >
          <div className="flex items-center gap-3.5">
            <div style={{
              width: 42, height: 42, borderRadius: 14, flexShrink: 0,
              background: isEdit ? "#F5F3FF" : "#EEF0FF",
              color: "#5B5FEF",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid rgba(91,95,239,0.18)",
            }}>
              {isEdit ? <Edit3 size={18} /> : <UserPlus size={18} />}
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.01em" }}>
                {isEdit ? "تعديل بيانات المشترك" : "إضافة مشترك جديد"}
              </h3>
              {!isEdit && (
                <div className="flex items-center gap-2.5" style={{ marginTop: 6 }}>
                  <div className="flex gap-1">
                    {SECTIONS.map(s => (
                      <div
                        key={s.key}
                        style={{
                          height: 4,
                          width: sectionDone[s.key] ? 22 : 14,
                          borderRadius: 999,
                          background: sectionDone[s.key] ? s.color : "#E5E7EB",
                          transition: "all 0.3s ease",
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>
                    {doneCount} / {SECTIONS.length} مكتمل
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "transparent", border: "none",
              color: "#9CA3AF", cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = "#F1F5F9"; el.style.color = "#6B7280";
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = "transparent"; el.style.color = "#9CA3AF";
            }}
          >
            <X size={16} />
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

            <div className="px-5 py-4 space-y-3">

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
                                className="px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all"
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

                  {!isEdit && totalPrice > 0 && (
                    <PaymentPlanPicker
                      totalOriginal={totalPrice}
                      downPaymentOriginal={
                        (watchedAll.initialPayment ?? "").trim() === ""
                          ? totalPrice
                          : parseFloat(watchedAll.initialPayment ?? "0") || 0
                      }
                      exchangeRate={lockedRate}
                      currency={watchedCurrency}
                      startDate={watchedAll.date ?? ""}
                      value={paymentPlan}
                      onChange={setPaymentPlan}
                    />
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
          className="flex items-center gap-2.5"
          style={{ borderTop: "1px solid #E5E7EB", padding: "16px 20px" }}
        >
          <button
            type="button"
            onClick={handleCancel}
            style={{
              flex: 1, height: 44, borderRadius: 14,
              background: "transparent", border: "1px solid #E5E7EB",
              color: "#6B7280", fontSize: 14, fontWeight: 600,
              cursor: "pointer", transition: "all 0.15s ease",
            }}
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
              style={{
                height: 44, padding: "0 18px", borderRadius: 14,
                background: loading || !isValid ? "#F1F5F9" : "#EEF0FF",
                border: `1px solid ${loading || !isValid ? "#E5E7EB" : "rgba(91,95,239,0.25)"}`,
                color: loading || !isValid ? "#9CA3AF" : "#5B5FEF",
                fontSize: 13, fontWeight: 600,
                cursor: loading || !isValid ? "not-allowed" : "pointer",
                opacity: loading || !isValid ? 0.5 : 1,
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
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
            style={{
              flex: 2, height: 44, borderRadius: 14,
              background: loading || !isValid ? "#F1F5F9" : "#5B5FEF",
              color: loading || !isValid ? "#9CA3AF" : "#fff",
              fontSize: 14, fontWeight: 700,
              border: "none",
              cursor: loading || !isValid ? "not-allowed" : "pointer",
              opacity: loading || !isValid ? 0.5 : 1,
              transition: "all 0.15s ease",
              boxShadow: loading || !isValid ? "none" : "0 4px 14px rgba(91,95,239,0.30)",
            }}
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

  return (
    <div
      style={{
        borderRadius: 18,
        overflow: "hidden",
        border: `1px solid ${open ? meta.color + "28" : "#E5E7EB"}`,
        background: "#FFFFFF",
        boxShadow: open
          ? `0 4px 20px ${meta.color}12`
          : "0 2px 6px rgba(15,23,42,0.04)",
        transition: "all 0.2s ease",
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => onToggle(sectionKey)}
        className="w-full flex items-center gap-3.5 text-right"
        style={{
          background: open ? meta.colorAlpha : "transparent",
          padding: "14px 18px",
          border: "none", cursor: "pointer",
          transition: "background 0.15s ease",
        }}
      >
        {/* Icon */}
        <div style={{
          width: 36, height: 36, borderRadius: 12, flexShrink: 0,
          background: done ? meta.color : open ? meta.colorAlpha : "#F8FAFC",
          color: done ? "#fff" : open ? meta.color : "#9CA3AF",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: `1px solid ${done ? "transparent" : open ? meta.color + "22" : "#E5E7EB"}`,
          transition: "all 0.2s ease",
        }}>
          {done ? <CheckCircle2 size={16} /> : meta.icon}
        </div>

        {/* Title */}
        <div style={{ flex: 1, textAlign: "right" }}>
          <p style={{
            fontSize: 14, fontWeight: 700, margin: 0,
            color: open ? meta.color : "#111827",
            transition: "color 0.15s ease",
          }}>
            {meta.title}
          </p>
          {!open && (
            <p style={{ fontSize: 11.5, color: "#9CA3AF", margin: "2px 0 0 0" }}>
              {done ? "مكتمل ✓" : "اضغط للتوسيع"}
            </p>
          )}
        </div>

        {/* Done badge */}
        {done && !open && (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
            background: "#ECFDF3", color: "#22C55E", flexShrink: 0,
          }}>
            مكتمل
          </span>
        )}

        <ChevronDown
          size={16}
          style={{
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            color: "#9CA3AF",
            transition: "transform 0.2s ease",
          }}
        />
      </button>

      {/* Body */}
      {open && (
        <div style={{ padding: "16px 20px 20px", borderTop: `1px solid ${meta.color}18` }}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <label style={{ fontSize: 12.5, fontWeight: 600, color: "#374151" }}>
          {label}
        </label>
        {hint && (
          <span style={{ fontSize: 11.5, color: "#9CA3AF" }}>{hint}</span>
        )}
      </div>
      {children}
      {error && (
        <span style={{ fontSize: 12, color: "#EF4444" }}>{error}</span>
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
