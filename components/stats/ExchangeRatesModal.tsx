"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
}

const CURRENCIES = [
  { code: "EGP", label: "جنيه مصري", hint: "كم جنيه = 1 دولار" },
  { code: "JOD", label: "دينار أردني", hint: "كم دينار = 1 دولار" },
  { code: "ILS", label: "شيكل إسرائيلي", hint: "كم شيكل = 1 دولار" },
] as const;

export default function ExchangeRatesModal({ onClose }: Props) {
  const { exchangeRates, setExchangeRates } = useAuthStore();

  const [rates, setRates] = useState({
    EGP: String(exchangeRates.EGP),
    JOD: String(exchangeRates.JOD),
    ILS: String(exchangeRates.ILS),
  });

  function handleSave() {
    const newRates = { ...exchangeRates };
    for (const cur of ["EGP", "JOD", "ILS"] as const) {
      const v = parseFloat(rates[cur]);
      if (v > 0) newRates[cur] = v;
    }
    setExchangeRates(newRates);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">أسعار الصرف</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500 bg-blue-50 rounded-xl p-3 border border-blue-100">
            أدخل كم وحدة من كل عملة تساوي <strong>1 دولار أمريكي</strong>.
            هذا يؤثر على تحويل المبالغ في العمليات الجديدة فقط.
          </p>

          {CURRENCIES.map((cur) => (
            <div key={cur.code}>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                {cur.label} ({cur.code})
              </label>
              <p className="text-xs text-slate-400 mb-1.5">{cur.hint}</p>
              <input
                type="number"
                min="0.001"
                step="0.01"
                value={rates[cur.code]}
                onChange={(e) => setRates((r) => ({ ...r, [cur.code]: e.target.value }))}
                className="form-input"
              />
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-2.5 rounded-xl transition-all"
            >
              حفظ الأسعار
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold transition"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
