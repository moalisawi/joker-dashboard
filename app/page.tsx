"use client";
export const dynamic = "force-dynamic";

import { useState, useCallback, useMemo, useEffect } from "react";
import dynamicImport from "next/dynamic";
import type { Step, CallBackProps } from "react-joyride";
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
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/Tabs";
import TableSkeleton from "@/components/ui/TableSkeleton";
import type { Subscriber, Payment, RefundTransaction } from "@/types";
import { Plus, DollarSign } from "lucide-react";
import { Button, Skeleton } from "@heroui/react";
import { useRefunds } from "@/hooks/useRefunds";
import { toast } from "@/lib/toast";

const Joyride = dynamicImport(() => import("@/components/ui/JoyrideWrapper"), { ssr: false });

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
  | { type: "profile";       subscriber: Subscriber }
  | { type: "edit";          subscriber: Subscriber }
  | { type: "withdraw";      subscriber: Subscriber }
  | { type: "payment";       subscriber: Subscriber }
  | { type: "renew";         subscriber: Subscriber }
  | { type: "pause";         subscriber: Subscriber }
  | { type: "freeze";        subscriber: Subscriber }
  | { type: "resume";        subscriber: Subscriber }
  | { type: "rates" }
  | { type: "confirmDelete"; subscriberId: string; subscriberName: string };

export default function HomePage() {
  const { user, can, exchangeRates } = useAuthStore();
  const { subscribers, loading, error } = useSubscribers();
  const { payments } = usePayments();
  const { refunds }  = useRefunds();
  const [modal, setModal]             = useState<ModalState>({ type: "none" });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>({ mode: "current_month" });
  const [tourRun, setTourRun]         = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("joker-tour-done");
    if (!seen) { setTourRun(true); localStorage.setItem("joker-tour-done", "1"); }
  }, []);

  const tourSteps: Step[] = [
    {
      target: "#tour-header",
      content: "مرحباً بك في لوحة التحكم! من هنا تضيف مشتركين جدد وتتابع الأسعار.",
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: "#tour-stats",
      content: "بطاقات الإحصائيات — تعرض الإجمالي، النشطين، المنتهين، والإيرادات حسب الفترة الزمنية التي تختارها.",
      placement: "bottom",
    },
    {
      target: "#tour-tabs",
      content: "التبويبات — انتقل بين النظرة العامة وجدول المشتركين والتنبيهات من هنا.",
      placement: "top",
    },
  ];

  function handleTourCallback(data: CallBackProps) {
    const { status } = data;
    const finished = ["finished", "skipped"] as string[];
    if (finished.includes(status as string)) setTourRun(false);
  }

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
  const onSaved    = useCallback(() => toast.success("تم الحفظ بنجاح"), []);

  async function handleDelete(id: string, name: string) {
    if (!user || !can("canDelete")) return;
    setModal({ type: "confirmDelete", subscriberId: id, subscriberName: name });
  }

  async function confirmDelete() {
    if (modal.type !== "confirmDelete") return;
    const { subscriberId, subscriberName } = modal;
    setDeleteLoading(true);
    try {
      await callSubscriberOperation("deleteSubscriber", {
        subscriberId,
        subscriberName,
      });
      toast.success("تم الحذف بنجاح");
      closeModal();
    } catch {
      toast.error("فشل الحذف، حاول مجدداً");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <ProtectedLayout>
      <Joyride
        steps={tourSteps}
        run={tourRun}
        continuous
        showSkipButton
        showProgress
        callback={handleTourCallback}
        locale={{ back: "السابق", close: "إغلاق", last: "إنهاء", next: "التالي", skip: "تخطى" }}
        styles={{
          options: {
            primaryColor: "#6366f1",
            zIndex: 10000,
            arrowColor: "#fff",
          },
          tooltip: { borderRadius: 14, fontFamily: "inherit", direction: "rtl" },
          buttonNext: { borderRadius: 10, fontWeight: 700 },
          buttonBack: { borderRadius: 10 },
          buttonSkip: { borderRadius: 10 },
        }}
      />
      <div className="p-5 md:p-8 max-w-screen-2xl mx-auto">

        {/* Page header */}
        <div id="tour-header" className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">المشتركون</h1>
            <p className="text-slate-500 text-sm mt-1 font-medium">
              أهلاً، {user?.name} ·{" "}
              <span className="text-slate-700 font-semibold">{subscribers.length}</span> مشترك
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setTourRun(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
              style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              title="جولة تعريفية"
            >
              🎯 جولة
            </button>
            {can("canViewRevenue") && (
              <Button
                variant="outline"
                size="sm"
                onPress={() => setModal({ type: "rates" })}
                className="gap-1.5"
              >
                <DollarSign size={14} />
                أسعار الصرف
              </Button>
            )}
            {can("canCreate") && (
              <Button
                variant="primary"
                size="sm"
                onPress={() => setModal({ type: "add" })}
                className="gap-2"
              >
                <Plus size={15} />
                مشترك جديد
              </Button>
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
          <div className="space-y-6">
            {/* Stats skeleton — @heroui Skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="panel p-5 space-y-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <Skeleton className="h-8 w-16 rounded-lg" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
              ))}
            </div>
            {/* Table skeleton */}
            <div className="panel overflow-hidden">
              <div className="p-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <Skeleton className="h-9 w-52 rounded-xl" />
              </div>
              <TableSkeleton rows={8} cols={7} />
            </div>
          </div>
        ) : (
          <>
            {/* ─── Stats strip ─────────────────────────────────────────── */}
            <StatsDateFilter value={statsPeriod} onChange={setStatsPeriod} />
            <div id="tour-stats">
              <StatsCards
                subscribers={filteredSubscribers}
                payments={filteredPayments}
                refunds={filteredRefunds}
                periodLabel={getPeriodLabel(statsPeriod)}
              />
            </div>
            <CurrencyCounters payments={payments} />

            {/* ─── Tabbed content ───────────────────────────────────────── */}
            <Tabs defaultValue="overview" className="mt-2">
              <TabList id="tour-tabs" className="mb-6">
                <Tab value="overview">النظرة العامة</Tab>
                <Tab value="subscribers">
                  المشتركون
                </Tab>
                <Tab
                  value="alerts"
                  badge={
                    subscribers.filter(
                      (s) =>
                        s.subscriptionStatus === "paused" ||
                        s.freezeData?.isFrozen === true ||
                        (s.daysRemaining > 0 && s.daysRemaining <= 15 && s.subscriptionState !== "withdrawn")
                    ).length
                  }
                >
                  التنبيهات
                </Tab>
              </TabList>

              {/* ── Tab: Overview ────────────────────────────────────── */}
              <TabPanel value="overview">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-6">
                  <div className="xl:col-span-2">
                    <MonthlyCalendar subscribers={subscribers} />
                  </div>
                  <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-[0_1px_2px_rgba(0,0,0,0.05),_0_2px_8px_rgba(0,0,0,0.06)] p-5"
                         style={{ background: "var(--surface)" }}>
                      <h3 className="font-bold text-sm mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                        <span className="w-1 h-4 rounded-full bg-blue-500 inline-block" />
                        أداء الفريق
                      </h3>
                      <TeamPerformance subscribers={subscribers} />
                    </div>
                    <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] shadow-[0_1px_2px_rgba(0,0,0,0.05),_0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden"
                         style={{ background: "var(--surface)" }}>
                      <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
                        <span className="w-1 h-4 rounded-full bg-amber-500 inline-block" />
                        <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>تنبيهات الانتهاء</h3>
                      </div>
                      <Alerts subscribers={subscribers} />
                    </div>
                  </div>
                </div>
                <AdvancedStats subscribers={subscribers} />
              </TabPanel>

              {/* ── Tab: Subscribers ─────────────────────────────────── */}
              <TabPanel value="subscribers">
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
              </TabPanel>

              {/* ── Tab: Alerts ──────────────────────────────────────── */}
              <TabPanel value="alerts">
                <Expiry15Days subscribers={subscribers} />
                <PausedSubscribersSection
                  subscribers={subscribers}
                  onProfile={(s) => setModal({ type: "profile", subscriber: s })}
                  onEdit={(s)    => setModal({ type: "edit",    subscriber: s })}
                />
                <FrozenSubscribersSection
                  subscribers={subscribers}
                  onProfile={(s) => setModal({ type: "profile", subscriber: s })}
                  onResume={(s)  => setModal({ type: "resume",  subscriber: s })}
                  onEdit={(s)    => setModal({ type: "edit",    subscriber: s })}
                />
              </TabPanel>
            </Tabs>
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
          onSaved={() => { closeModal(); toast.success("تم إيقاف الاشتراك"); }}
        />
      )}
      {modal.type === "freeze" && (
        <FreezeModal
          subscriber={modal.subscriber}
          isOpen={true}
          onClose={closeModal}
          onFrozen={() => { closeModal(); toast.success("تم تجميد الاشتراك"); }}
          currentUser={{ uid: user?.uid || "", displayName: user?.name || "" }}
        />
      )}
      {modal.type === "resume" && (
        <ResumeModal
          subscriber={modal.subscriber}
          isOpen={true}
          onClose={closeModal}
          onResumed={() => { closeModal(); toast.success("تم استئناف الاشتراك"); }}
          currentUser={{ uid: user?.uid || "", displayName: user?.name || "" }}
        />
      )}
      {modal.type === "rates" && (
        <ExchangeRatesModal onClose={closeModal} />
      )}
      <ConfirmDialog
        open={modal.type === "confirmDelete"}
        onClose={closeModal}
        onConfirm={confirmDelete}
        loading={deleteLoading}
        destructive
        title="حذف المشترك"
        description={
          modal.type === "confirmDelete"
            ? `هل أنت متأكد من حذف "${modal.subscriberName}"؟ هذا الإجراء لا يمكن التراجع عنه.`
            : undefined
        }
        confirmLabel="حذف نهائياً"
      />
    </ProtectedLayout>
  );
}
