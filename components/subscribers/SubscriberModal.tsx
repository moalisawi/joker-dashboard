"use client";

import { useState, useEffect, useRef } from "react";
import type { Subscriber, Currency } from "@/types";
import { storage } from "@/lib/storage";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuthStore } from "@/store/authStore";
import { callSubscriberOperation } from "@/lib/clientOperations";
import {
  calculateExpiry, todayString, PHONE_COUNTRIES, RESIDENCE_COUNTRIES,
} from "@/lib/utils";
import PhoneInput from "@/components/ui/PhoneInput";
import { PAYMENT_METHODS, SOURCES } from "@/lib/permissions";
import { useEmployees } from "@/hooks/useEmployees";
import { useTeams } from "@/hooks/useTeams";
import { X } from "lucide-react";

interface Props {
  mode: "add" | "edit";
  subscriber?: Subscriber | null;
  exchangeRates: Record<string, number>;
  onClose: () => void;
  onSaved: () => void;
}

export default function SubscriberModal({
  mode,
  subscriber,
  exchangeRates,
  onClose,
  onSaved,
}: Props) {
  const { user, can } = useAuthStore();
  const isEdit = mode === "edit" && !!subscriber;

  // Dynamic employees & teams from Firestore
  const { employees: allEmployees } = useEmployees({ activeOnly: true });
  const { data: activeTeams = [] }  = useTeams(true);

  // Sales employees list for convincedBy
  const salesEmployees = allEmployees.filter(
    (e) => e.employeeRole === "sales" || e.employeeRole === "admin" || e.employeeRole === "owner"
  );
  // Nutrition teams only
  const nutritionTeams = activeTeams.filter((t) => t.type === "nutrition");
  // All employee names for paidShift
  const allActiveNames = allEmployees.map((e) => e.name);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  // Duration unit toggle — "days" stores directly, "months" converts ×30
  const [durationUnit, setDurationUnit] = useState<"days" | "months">("days");

  // E.164 phone state
  const [phoneE164, setPhoneE164] = useState(() => {
    if (mode === "edit" && subscriber?.phone) {
      const dc = subscriber.dialCode || PHONE_COUNTRIES.find(c => c.iso === subscriber.phoneCountry)?.dialCode || "+970";
      return `${dc}${subscriber.phone}`;
    }
    return "";
  });

  // Form state
  const [form, setForm] = useState({
    date:            todayString(),
    name:            "",
    residence:       "فلسطين-غزة",
    phoneCountry:    "PS",
    phone:           "",
    age:             "",
    package:         "فضية" as "فضية" | "ذهبية",
    duration:        "30",
    currency:        "USD" as Currency,
    totalPrice:      "",
    initialPayment:  "",
    payment:         "",
    source:          "",
    referrer:        "",
    convincedBy:     user?.employeeName || user?.name || "",
    paidShift:       user?.employeeName || user?.name || "",
    team:            "",
    notes:           "",
  });

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEdit && subscriber) {
      // Detect unit from stored duration for display
      const storedDuration = subscriber.duration || 30;
      const isMultipleOf30 = storedDuration > 0 && storedDuration % 30 === 0;
      if (isMultipleOf30 && storedDuration >= 30) {
        setDurationUnit("months");
        setForm({
          date:           subscriber.date || todayString(),
          name:           subscriber.name || "",
          residence:      subscriber.residence || "فلسطين-غزة",
          phoneCountry:   subscriber.phoneCountry || "PS",
          phone:          subscriber.phone || "",
          age:            subscriber.age ? String(subscriber.age) : "",
          package:        subscriber.package || "فضية",
          duration:       String(storedDuration / 30),
          currency:       subscriber.currencyOriginal || "USD",
          totalPrice:     String(subscriber.totalPrice || ""),
          initialPayment: "",
          payment:        subscriber.payment || "",
          source:         subscriber.source || "",
          referrer:       subscriber.referrer || "",
          convincedBy:    subscriber.convincedBy || "",
          paidShift:      subscriber.paidShift || "",
          team:           subscriber.team || "",
          notes:          subscriber.notes || "",
        });
      } else {
        setDurationUnit("days");
        setForm({
          date:           subscriber.date || todayString(),
          name:           subscriber.name || "",
          residence:      subscriber.residence || "فلسطين-غزة",
          phoneCountry:   subscriber.phoneCountry || "PS",
          phone:          subscriber.phone || "",
          age:            subscriber.age ? String(subscriber.age) : "",
          package:        subscriber.package || "فضية",
          duration:       String(storedDuration),
          currency:       subscriber.currencyOriginal || "USD",
          totalPrice:     String(subscriber.totalPrice || ""),
          initialPayment: "",
          payment:        subscriber.payment || "",
          source:         subscriber.source || "",
          referrer:       subscriber.referrer || "",
          convincedBy:    subscriber.convincedBy || "",
          paidShift:      subscriber.paidShift || "",
          team:           subscriber.team || "",
          notes:          subscriber.notes || "",
        });
      }
    }
  }, [isEdit, subscriber]);

  function setField<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Actual duration in days for calculations/saving
  const durationDays = durationUnit === "months"
    ? (parseInt(form.duration) || 0) * 30
    : parseInt(form.duration) || 0;

  const lockedRate   = exchangeRates[form.currency] || 1;
  const totalPrice   = parseFloat(form.totalPrice) || 0;
  const totalPriceUSD = totalPrice / lockedRate;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    setLoading(true);

    try {
      // Parse E.164 phone → individual fields
      const sortedCountries = [...PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
      const matchedCountry = phoneE164
        ? sortedCountries.find((c) => phoneE164.startsWith(c.dialCode))
        : PHONE_COUNTRIES.find((c) => c.iso === "PS");
      const resolvedDialCode    = matchedCountry?.dialCode ?? "+970";
      const resolvedPhoneCountry = matchedCountry?.iso ?? "PS";
      const resolvedPhone = phoneE164.startsWith(resolvedDialCode)
        ? phoneE164.slice(resolvedDialCode.length)
        : phoneE164.replace(/^\+\d{1,4}/, "");

      const expiryDate = calculateExpiry(form.date, durationDays);

      let paidAmount: number, remainingAmount: number, paidAmountUSD: number, remainingAmountUSD: number;

      if (!isEdit) {
        const init = form.initialPayment.trim();
        paidAmount         = init === "" ? totalPrice : parseFloat(init) || 0;
        remainingAmount    = totalPrice - paidAmount;
        paidAmountUSD      = paidAmount / lockedRate;
        remainingAmountUSD = remainingAmount / lockedRate;
      } else {
        paidAmountUSD      = subscriber!.paidAmountUSD ?? totalPriceUSD;
        paidAmount         = subscriber!.paidAmount ?? paidAmountUSD * lockedRate;
        remainingAmountUSD = Math.max(0, totalPriceUSD - paidAmountUSD);
        remainingAmount    = Math.max(0, totalPrice - paidAmount);
      }

      const refundAmountUSD = subscriber?.refundAmountUSD || 0;
      const netAmountUSD    = Math.max(0, paidAmountUSD - refundAmountUSD);

      const payload = {
        date:               form.date,
        name:               form.name.trim(),
        residence:          form.residence,
        phoneCountry:       resolvedPhoneCountry,
        dialCode:           resolvedDialCode,
        phone:              resolvedPhone,
        phoneE164:          phoneE164 || null,
        age:                form.age ? Number(form.age) : null,
        package:            form.package,
        duration:           durationDays,
        expiryDate,
        currencyOriginal:   form.currency,
        currency:           form.currency,
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
        payment:            form.payment,
        source:             form.source,
        referrer:           form.referrer.trim(),
        convincedBy:        form.convincedBy,
        paidShift:          form.paidShift,
        team:               form.team,
        notes:              form.notes.trim(),
      };

      if (isEdit) {
        await callSubscriberOperation("updateSubscriber", {
          subscriberId: subscriber!.id,
          subscriber: payload,
        });
      } else {
        let receiptUrl: string | null = null;
        const file = fileRef.current?.files?.[0];
        if (file) {
          const storageRef = ref(storage, `receipts/pending/${Date.now()}_${file.name}`);
          await uploadBytes(storageRef, file);
          receiptUrl = await getDownloadURL(storageRef);
        }

        await callSubscriberOperation("createSubscriber", {
          subscriber: payload,
          initialPayment: paidAmount > 0
            ? {
                amountOriginal:   paidAmount,
                currencyOriginal: form.currency,
                exchangeRate:     lockedRate,
                paymentMethod:    form.payment,
                receiptUrl,
                date:             form.date,
                notes:            null,
              }
            : null,
        });
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel max-w-2xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-lg">
            {isEdit ? "تعديل بيانات المشترك" : "إضافة مشترك جديد"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
          )}
          {isEdit && subscriber?.subscriptionState === "withdrawn" && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              هذا المشترك منسحب. التعديل يغير البيانات فقط ولا يغير حالة الانسحاب.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="تاريخ الاشتراك">
              <input type="date" required value={form.date}
                onChange={(e) => setField("date", e.target.value)}
                className="form-input" />
            </Field>
            <Field label="الاسم الكامل">
              <input type="text" required value={form.name} placeholder="أحمد محمد"
                onChange={(e) => setField("name", e.target.value)}
                className="form-input" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="الإقامة">
              <select value={form.residence} onChange={(e) => setField("residence", e.target.value)}
                className="form-input">
                {RESIDENCE_COUNTRIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.name}</option>
                ))}
                {PHONE_COUNTRIES.filter((c) =>
                  !RESIDENCE_COUNTRIES.find((r) => r.value === c.iso)
                ).map((c) => (
                  <option key={c.iso} value={c.iso}>{c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="العمر">
              <input type="number" min="10" max="100" value={form.age} placeholder="اختياري"
                onChange={(e) => setField("age", e.target.value)}
                className="form-input" />
            </Field>
          </div>

          {/* Phone */}
          <Field label="رقم الهاتف">
            <PhoneInput value={phoneE164} onChange={setPhoneE164} />
          </Field>

          {/* Package */}
          <Field label="الباقة">
            <div className="flex gap-3">
              {(["فضية", "ذهبية"] as const).map((pkg) => (
                <label key={pkg} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="package" value={pkg} checked={form.package === pkg}
                    onChange={() => setField("package", pkg)} />
                  <span className={`text-sm px-3 py-1 rounded-lg font-bold ${pkg === "فضية" ? "pkg-silver" : "pkg-gold"}`}>
                    {pkg}
                  </span>
                </label>
              ))}
            </div>
          </Field>

          {/* Duration — days OR months toggle */}
          <Field label="مدة الاشتراك">
            <div className="flex gap-2">
              <input
                type="number"
                required
                min="1"
                value={form.duration}
                onChange={(e) => setField("duration", e.target.value)}
                className="form-input flex-1"
                placeholder={durationUnit === "months" ? "عدد الأشهر" : "عدد الأيام"}
              />
              {/* Unit toggle */}
              <div className="flex rounded-xl overflow-hidden border border-slate-200 shrink-0 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => setDurationUnit("days")}
                  className={`px-3 py-2 transition-colors ${
                    durationUnit === "days"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  يوم
                </button>
                <button
                  type="button"
                  onClick={() => setDurationUnit("months")}
                  className={`px-3 py-2 border-r border-slate-200 transition-colors ${
                    durationUnit === "months"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  شهر
                </button>
              </div>
            </div>
            {/* Preview in days when months selected */}
            {durationUnit === "months" && parseInt(form.duration) > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                = {durationDays} يوم
              </p>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="العملة">
              <select value={form.currency} onChange={(e) => setField("currency", e.target.value as Currency)}
                className="form-input">
                <option value="USD">دولار USD</option>
                <option value="EGP">جنيه EGP</option>
                <option value="JOD">دينار JOD</option>
                <option value="ILS">شيكل ILS</option>
              </select>
            </Field>
            <Field label={`المبلغ الكلي (${form.currency})`}>
              <input type="number" required min="0" step="0.01" value={form.totalPrice}
                onChange={(e) => setField("totalPrice", e.target.value)}
                className="form-input" />
              {totalPrice > 0 && form.currency !== "USD" && (
                <p className="text-xs text-slate-400 mt-1">≈ ${(totalPrice / lockedRate).toFixed(2)}</p>
              )}
            </Field>
          </div>

          {!isEdit && (
            <Field label="الدفعة الأولى (فارغ = السداد الكامل)">
              <input type="number" min="0" step="0.01" value={form.initialPayment}
                placeholder={`فارغ = ${form.totalPrice || 0} (كامل)`}
                onChange={(e) => setField("initialPayment", e.target.value)}
                className="form-input" />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="طريقة الدفع">
              <select value={form.payment} onChange={(e) => setField("payment", e.target.value)}
                className="form-input">
                <option value="">اختر...</option>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="مصدر الاشتراك">
              <select value={form.source} onChange={(e) => setField("source", e.target.value)}
                className="form-input">
                <option value="">اختر...</option>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          {form.source === "ترشيح" && (
            <Field label="اسم المرشِّح">
              <input type="text" value={form.referrer}
                onChange={(e) => setField("referrer", e.target.value)}
                className="form-input" />
            </Field>
          )}

          {/* convincedBy — all roles can now choose freely */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="أقنعه بالاشتراك">
              <select
                value={form.convincedBy}
                onChange={(e) => setField("convincedBy", e.target.value)}
                className="form-input"
              >
                <option value="">اختر الموظف...</option>
                {salesEmployees.map((e) => (
                  <option key={e.uid} value={e.name}>{e.name}</option>
                ))}
              </select>
            </Field>

            {/* Nutrition team */}
            <Field label="فريق التغذية">
              <select value={form.team} onChange={(e) => setField("team", e.target.value)}
                className="form-input">
                <option value="">بدون تعيين</option>
                {nutritionTeams.length > 0
                  ? nutritionTeams.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)
                  : activeTeams.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)
                }
              </select>
            </Field>
          </div>

          {/* paidShift — all employees selectable */}
          <Field label="شيفت الاستلام">
            <select value={form.paidShift} onChange={(e) => setField("paidShift", e.target.value)}
              className="form-input">
              <option value="">اختر الموظف...</option>
              {allActiveNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </Field>

          <Field label="ملاحظات">
            <textarea value={form.notes} rows={2}
              onChange={(e) => setField("notes", e.target.value)}
              className="form-input resize-none" />
          </Field>

          {!isEdit && (
            <Field label="وصل الدفع (اختياري — JPG/PNG/PDF حتى 5MB)">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="text-sm text-slate-600"
              />
            </Field>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl transition-all shadow-sm">
              {loading ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "حفظ المشترك"}
            </button>
            <button type="button" onClick={onClose}
              className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold transition">
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
