"use client";
export const dynamic = "force-dynamic";

import { useState, useCallback, useMemo } from "react";
import { useAuthStore } from "@/store/authStore";
import { callSubscriberOperation } from "@/lib/clientOperations";
import { useSubscribers } from "@/hooks/useSubscribers";
import { usePayments } from "@/hooks/usePayments";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import StatsCards from "@/components/stats/StatsCards";
import StatsDateFilter, { type StatsPeriod, getPeriodLabel } from "@/components/stats/StatsDateFilter";
import CurrencyCounters from "@/components/stats/CurrencyCounters";
import TeamPerformance from "@/components/stats/TeamPerformance";
import Alerts from "@/components/stats/Alerts";
import Expiry15Days from "@/components/stats/Expiry15Days";
import AdvancedStats from "@/components/stats/AdvancedStats";
import MonthlyCalendar from "@/components/calendar/MonthlyCalendar";
import SubscribersTable from "@/components/subscribers/SubscribersTable";
import SubscriberModal from "@/components/subscribers/SubscriberModal";
import WithdrawModal from "@/components/subscribers/WithdrawModal";
import PaymentModal from "@/components/subscribers/PaymentModal";
import ProfileModal from "@/components/subscribers/ProfileModal";
import RenewalModal from "@/components/subscribers/RenewalModal";
import PauseModal from "@/components/subscribers/PauseModal";
import FreezeModal from "@/components/subscribers/FreezeModal";
import ResumeModal from "@/components/subscribers/ResumeModal";
import PausedSubscribersSection from "@/components/subscribers/PausedSubscribersSection";
import FrozenSubscribersSection from "@/components/subscribers/FrozenSubscribersSection";
import ExchangeRatesModal from "@/components/stats/ExchangeRatesModal";
import type { Subscriber, Payment, RefundTransaction } from "@/types";
import { Plus, RefreshCw, DollarSign } from "lucide-react";
import { useRefunds } from "@/hooks/useRefunds";

function filterByPeriod<T extends object>(
  items: T[],
  period: StatsPeriod,
  dateKey: keyof T = "date" as keyof T,
): T[] {
  const getDate = (item: T): string => {
    const v = item[dateKey];
    if (!v || typeof v !== "string") return "";
    return v;
  };
  if (period.mode === "current_month") {
    const ym = new Date().toISOString().slice(0, 7);
    return items.filter((i) => getDate(i).startsWith(ym));
  }
  if (period.mode === "days") {
    const cutoff = new Date(Date.now() - period.n * 86_400_000).toISOString().split("T")[0];
    return items.filter((i) => getDate(i) >= cutoff);
  }
  if (period.mode === "month") {
    return items.filter((i) => getDate(i).startsWith(period.ym));
  }
  return items;
}

type ModalState =
  | { type: "none" }
  | { type: "add" }
  | { type: "profile";  subscriber: Subscriber }
  | { type: "edit";     subscriber: Subscriber }
  | { type: "withdraw"; subscriber: Subscriber }
  | { type: "payment";  subscriber: Subscriber }
  | { type: "renew";    subscriber: Subscriber }
  | { type: "pause";    subscriber: Subscriber }
  | { type: "freeze";   subscriber: Subscriber }
  | { type: "resume";   subscriber: Subscriber }
  | { type: "rates" };

function toast(message: string) {
  const el = document.createElement("div");
  el.className = "toast-success";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

export default function HomePage() {
  const { user, can, exchangeRates } = useAuthStore();
  const { subscribers, loading, error } = useSubscribers();
  const { payments } = usePayments();
  const { refunds }  = useRefunds();
  const [modal, setModal]         = useState<ModalState>({ type: "none" });
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>({ mode: "current_month" });

  const filteredSubscribers = useMemo(
    () => filterByPeriod(subscribers as (Subscriber & { date: string })[], statsPeriod),
    [subscribers, statsPeriod],
  );
  const filteredPayments = useMemo(
    () => filterByPeriod(payments as (Payment & { date: string })[], statsPeriod),
    [payments, statsPeriod],
  );
  const filteredRefunds = useMemo(
    () => filterByPeriod(
      refunds.map((r) => ({ ...r, date: r.refundDate })) as (RefundTransaction & { date: string })[],
      statsPeriod,
    ),
    [refunds, statsPeriod],
  );

  const closeModal = useCallback(() => setModal({ type: "none" }), []);
  const onSaved    = useCallback(() => toast("تم الحفظ بنجاح"), []);

  async function handleDelete(id: string, name: string) {
    if (!user || !can("canDelete")) return;
    if (!confirm(`متأكد بدك تحذف المشترك: ${name}؟`)) return;
    try {
      await callSubscriberOperation("deleteSubscriber", {
        subscriberId: id,
        subscriberName: name,
      });
      toast("تم الحذف");
    } catch {
      alert("فشل الحذف");
    }
  }

  return (
    <ProtectedLayout>
      <div className="p-5 md:p-8 max-w-screen-2xl mx-auto">

        {/* Page header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">المشتركون</h1>
            <p className="text-slate-500 text-sm mt-1 font-medium">
              أهلاً، {user?.name} ·{" "}
              <span className="text-slate-700 font-semibold">{subscribers.length}</span> مشترك
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {can("canViewRevenue") && (
              <button
                onClick={() => setModal({ type: "rates" })}
                className="flex items-center gap-1.5 text-slate-600 hover:text-blue-700 border border-slate-200 hover:border-blue-300 text-xs font-bold px-3.5 py-2 rounded-xl transition-all bg-white shadow-sm hover:shadow"
              >
                <DollarSign size={15} />
                أسعار الصرف
              </button>
            )}
            {can("canCreate") && (
              <button
                onClick={() => setModal({ type: "add" })}
                className="flex items-center gap-2 text-white font-bold px-5 py-2.5 rounded-xl transition-all text-sm"
                style={{ background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)", boxShadow: "0 4px 12px rgba(37,99,235,0.35)" }}
              >
                <Plus size={17} />
                مشترك جديد
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 font-medium flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw size={24} className="text-blue-500 animate-spin" />
              <p className="text-slate-400 text-sm">جاري تحميل البيانات...</p>
            </div>
          </div>
        ) : (
          <>
            <StatsDateFilter value={statsPeriod} onChange={setStatsPeriod} />
            <StatsCards
              subscribers={filteredSubscribers}
              payments={filteredPayments}
              refunds={filteredRefunds}
              periodLabel={getPeriodLabel(statsPeriod)}
            />
            <CurrencyCounters payments={payments} />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-6">
              <div className="xl:col-span-2">
                <MonthlyCalendar subscribers={subscribers} />
              </div>
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-[0_1px_2px_rgba(0,0,0,0.05),_0_2px_8px_rgba(0,0,0,0.06)] p-5">
                  <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                    <span className="w-1 h-4 rounded-full bg-blue-500 inline-block" />
                    أداء الفريق
                  </h3>
                  <TeamPerformance subscribers={subscribers} />
                </div>
                <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-[0_1px_2px_rgba(0,0,0,0.05),_0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100/80 flex items-center gap-2">
                    <span className="w-1 h-4 rounded-full bg-amber-500 inline-block" />
                    <h3 className="font-bold text-slate-800 text-sm">تنبيهات الانتهاء</h3>
                  </div>
                  <Alerts subscribers={subscribers} />
                </div>
              </div>
            </div>

            <Expiry15Days subscribers={subscribers} />
            <AdvancedStats subscribers={subscribers} />

            {/* Paused subscribers — separate section */}
            <PausedSubscribersSection
              subscribers={subscribers}
              onProfile={(s) => setModal({ type: "profile", subscriber: s })}
              onEdit={(s)    => setModal({ type: "edit",    subscriber: s })}
            />

            {/* Frozen subscribers — separate section */}
            <FrozenSubscribersSection
              subscribers={subscribers}
              onProfile={(s) => setModal({ type: "profile", subscriber: s })}
              onResume={(s)  => setModal({ type: "resume",  subscriber: s })}
              onEdit={(s)    => setModal({ type: "edit",    subscriber: s })}
            />

            {/* Main subscribers table (paused excluded) */}
            <SubscribersTable
              subscribers={subscribers}
              onProfile={(s)    => setModal({ type: "profile",  subscriber: s })}
              onEdit={(s)       => setModal({ type: "edit",     subscriber: s })}
              onWithdraw={(s)   => setModal({ type: "withdraw", subscriber: s })}
              onDelete={handleDelete}
              onAddPayment={(s) => setModal({ type: "payment",  subscriber: s })}
              onRenew={(s)      => setModal({ type: "renew",    subscriber: s })}
              onPause={(s)      => setModal({ type: "pause",    subscriber: s })}
              onFreeze={(s)     => setModal({ type: "freeze",   subscriber: s })}
              onResume={(s)     => setModal({ type: "resume",   subscriber: s })}
            />
          </>
        )}
      </div>

      {/* ===== Modals ===== */}
      {modal.type === "profile" && (
        <ProfileModal
          subscriber={modal.subscriber}
          onClose={closeModal}
          onEdit={()        => setModal({ type: "edit",    subscriber: modal.subscriber })}
          onRenew={()       => setModal({ type: "renew",   subscriber: modal.subscriber })}
          onAddPayment={()  => setModal({ type: "payment", subscriber: modal.subscriber })}
        />
      )}
      {modal.type === "add" && (
        <SubscriberModal mode="add" exchangeRates={exchangeRates}
          onClose={closeModal} onSaved={onSaved} />
      )}
      {modal.type === "edit" && (
        <SubscriberModal mode="edit" subscriber={modal.subscriber}
          exchangeRates={exchangeRates} onClose={closeModal} onSaved={onSaved} />
      )}
      {modal.type === "withdraw" && (
        <WithdrawModal subscriber={modal.subscriber}
          exchangeRates={exchangeRates} onClose={closeModal} onSaved={onSaved} />
      )}
      {modal.type === "payment" && (
        <PaymentModal subscriber={modal.subscriber}
          exchangeRates={exchangeRates} onClose={closeModal} onSaved={onSaved} />
      )}
      {modal.type === "renew" && (
        <RenewalModal subscriber={modal.subscriber}
          exchangeRates={exchangeRates} onClose={closeModal} onSaved={onSaved} />
      )}
      {modal.type === "pause" && (
        <PauseModal
          subscriber={modal.subscriber}
          onClose={closeModal}
          onSaved={() => { closeModal(); toast("تم إيقاف الاشتراك"); }}
        />
      )}
      {modal.type === "freeze" && (
        <FreezeModal
          subscriber={modal.subscriber}
          isOpen={true}
          onClose={closeModal}
          onFrozen={() => { closeModal(); toast("تم تجميد الاشتراك"); }}
          currentUser={{ uid: user?.uid || "", displayName: user?.name || "" }}
        />
      )}
      {modal.type === "resume" && (
        <ResumeModal
          subscriber={modal.subscriber}
          isOpen={true}
          onClose={closeModal}
          onResumed={() => { closeModal(); toast("تم استئناف الاشتراك"); }}
          currentUser={{ uid: user?.uid || "", displayName: user?.name || "" }}
        />
      )}
      {modal.type === "rates" && (
        <ExchangeRatesModal onClose={closeModal} />
      )}
    </ProtectedLayout>
  );
}
