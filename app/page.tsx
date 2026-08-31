"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import dynamicImport from "next/dynamic";
import type { Step, EventData } from "react-joyride";
import type { Controls } from "react-joyride";
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
import AlertsPanel from "@/components/stats/AlertsPanel";
import AdvancedStats from "@/components/stats/AdvancedStats";
import SmartInsights from "@/components/stats/SmartInsights";
import SubscriptionChart from "@/components/stats/SubscriptionChart";
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
import ExchangeRatesModal from "@/components/stats/ExchangeRatesModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/Tabs";
import TableSkeleton from "@/components/ui/TableSkeleton";
import FadeIn from "@/components/ui/FadeIn";
import StatsCardsSkeleton from "@/components/stats/StatsCardsSkeleton";
import DashboardHero from "@/components/dashboard/DashboardHero";
import ActivityTimeline from "@/components/dashboard/ActivityTimeline";
import TodaySummary from "@/components/stats/TodaySummary";
import type { Subscriber, Payment, RefundTransaction } from "@/types";
import { Plus, DollarSign, BarChart2, Users, Bell } from "lucide-react";
import { Button, Skeleton } from "@heroui/react";
import { useRefunds } from "@/hooks/useRefunds";
import { omitDeletedSubscriberRows } from "@/lib/subscriberLifecycle";
import { toast } from "@/lib/toast";
import { motion } from "framer-motion";

const Joyride = dynamicImport(
  () => import("react-joyride").then((m) => ({ default: m.Joyride })),
  { ssr: false }
);

const TOUR_STEPS: Step[] = [
  {
    target: "#tour-header",
    content: "مرحباً بك في لوحة التحكم! من هنا تضيف مشتركين جدد وتتابع الأسعار.",
    placement: "bottom",
    skipBeacon: true,
  },
  {
    target: "#tour-stats",
    content: "بطاقات الإحصائيات — تعرض الإجمالي، النشطين، المنتهين، والإيرادات حسب الفترة الزمنية.",
    placement: "bottom",
  },
  {
    target: "#tour-tabs",
    content: "التبويبات — انتقل بين النظرة العامة وجدول المشتركين والتنبيهات من هنا.",
    placement: "top",
  },
];

function filterByPeriod<T extends object>(
  items: T[],
  period: StatsPeriod,
  dateKey: keyof T = "date" as keyof T,
): T[] {
  // Returns null for absent / non-string dates; callers must handle null explicitly.
  const getDate = (item: T): string | null => {
    const v = item[dateKey];
    return v && typeof v === "string" ? v : null;
  };
  if (period.mode === "current_month") {
    const ym = new Date().toISOString().slice(0, 7);
    return items.filter((i) => { const d = getDate(i); return d !== null && d.startsWith(ym); });
  }
  if (period.mode === "days") {
    const cutoff = new Date(Date.now() - period.n * 86_400_000).toISOString().split("T")[0];
    return items.filter((i) => { const d = getDate(i); return d !== null && d >= cutoff; });
  }
  if (period.mode === "month") {
    return items.filter((i) => { const d = getDate(i); return d !== null && d.startsWith(period.ym); });
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
  const { subscribers, deletedIds, loading, error } = useSubscribers();
  const { payments: allPayments } = usePayments();
  const { refunds: allRefunds }   = useRefunds();

  /*
   * Money belonging to archived subscribers is dropped here, once, so every
   * consumer below agrees.
   *
   * Archiving a subscriber removed them from the lists but left their payments
   * counting: the header revenue, the currency counters and the activity feed
   * all kept reporting them, so the feed listed payments from people the
   * subscriber screen said did not exist. Same reasoning as the finance page —
   * a total whose parts disagree about who exists is worse than either answer.
   *
   * Rows with no subscriberId are kept; see omitDeletedSubscriberRows.
   */
  const payments = omitDeletedSubscriberRows(allPayments, deletedIds);
  const refunds  = omitDeletedSubscriberRows(allRefunds, deletedIds);
  const [modal, setModal]             = useState<ModalState>({ type: "none" });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriod>({ mode: "current_month" });
  const [tourRun, setTourRun]         = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("joker-tour-done");
    if (!seen) { setTourRun(true); localStorage.setItem("joker-tour-done", "1"); }
  }, []);

  function handleTourCallback(data: EventData, _controls: Controls) {
    const { status } = data;
    const finished = ["finished", "skipped"] as string[];
    if (finished.includes(status as string)) setTourRun(false);
  }

  const activeCount = useMemo(
    () => subscribers.filter(
      (s) => s.subscriptionState !== "withdrawn" &&
             s.subscriptionStatus !== "paused" &&
             s.freezeData?.isFrozen !== true &&
             s.status === "نشط"
    ).length,
    [subscribers],
  );

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

  const alertCount = useMemo(() =>
    subscribers.filter(
      (s) =>
        s.subscriptionStatus === "paused" ||
        s.freezeData?.isFrozen === true ||
        (s.daysRemaining > 0 && s.daysRemaining <= 15 && s.subscriptionState !== "withdrawn")
    ).length,
    [subscribers]
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
      await callSubscriberOperation("deleteSubscriber", { subscriberId, subscriberName });
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
        steps={TOUR_STEPS}
        run={tourRun}
        continuous
        onEvent={handleTourCallback}
        locale={{ back: "السابق", close: "إغلاق", last: "إنهاء", next: "التالي", skip: "تخطى" }}
        options={{ primaryColor: "#5B5FEF", zIndex: 10000, arrowColor: "#fff", showProgress: true }}
        styles={{
          tooltip: { borderRadius: 22, fontFamily: "inherit", direction: "rtl", boxShadow: "0 20px 48px rgba(16,20,26,.25)" },
          buttonPrimary: { borderRadius: 9999, fontWeight: 700, background: "#5B5FEF" },
          buttonBack: { borderRadius: 9999 },
          buttonSkip: { borderRadius: 9999 },
        }}
      />

      <div className="p-3 sm:p-5 md:p-8 max-w-screen-2xl mx-auto">

        {/* ── Top Action Bar ─────────────────────────────────────── */}
        <motion.div
          id="tour-header"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38 }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 12, marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {!loading && <StatsDateFilter value={statsPeriod} onChange={setStatsPeriod} />}
            <button
              onClick={() => setTourRun(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 999,
                fontSize: 12, fontWeight: 600,
                background: "var(--jk-surface)",
                color: "var(--jk-muted)",
                border: "1px solid var(--jk-border)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="جولة تعريفية"
            >
              🎯 جولة
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
        </motion.div>

        {error && (
          <div style={{
            marginBottom: 20, padding: "12px 18px",
            background: "#FEF2F2", border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 14, fontSize: 13.5, color: "#EF4444",
            fontWeight: 500, display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#EF4444", flexShrink: 0 }} />
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-6">
            {/* Hero skeleton */}
            <div style={{ borderRadius: 28, overflow: "hidden" }}>
              <Skeleton className="h-52 w-full rounded-3xl" />
            </div>
            <StatsCardsSkeleton count={8} />
            <div className="panel overflow-hidden">
              <div className="p-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <Skeleton className="h-9 w-52 rounded-xl" />
              </div>
              <TableSkeleton rows={8} cols={7} />
            </div>
          </div>
        ) : (
          <>
            {/* ── HERO SECTION ──────────────────────────────────────── */}
            <DashboardHero subscribers={subscribers} payments={payments} />

            {/* ── KPI STATS CARDS ───────────────────────────────────── */}
            <div id="tour-stats">
              <StatsCards
                subscribers={filteredSubscribers}
                payments={filteredPayments}
                refunds={filteredRefunds}
                periodLabel={getPeriodLabel(statsPeriod)}
              />
            </div>

            {/* ── CURRENCY BALANCE CARDS ────────────────────────────── */}
            <CurrencyCounters payments={payments} />

            {/* ── SMART INSIGHTS ────────────────────────────────────── */}
            <FadeIn delay={0.05}>
              <SmartInsights subscribers={subscribers} payments={payments} />
            </FadeIn>

            {/* ── TABBED CONTENT ────────────────────────────────────── */}
            <Tabs defaultValue="overview" className="mt-2">
              <TabList id="tour-tabs" className="mb-6">
                <Tab value="overview">
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <BarChart2 size={13} />
                    النظرة العامة
                  </span>
                </Tab>
                <Tab value="subscribers">
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Users size={13} />
                    المشتركون
                  </span>
                </Tab>
                <Tab
                  value="alerts"
                  badge={alertCount}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Bell size={13} />
                    التنبيهات
                  </span>
                </Tab>
              </TabList>

              {/* ── TAB: OVERVIEW ────────────────────────────────────── */}
              <TabPanel value="overview">
                {/* Chart + Timeline + Today Summary row */}
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-5 mb-5">
                  <FadeIn className="xl:col-span-2">
                    <SubscriptionChart subscribers={subscribers} payments={payments} />
                  </FadeIn>
                  <FadeIn delay={0.06}>
                    <ActivityTimeline subscribers={subscribers} payments={payments} />
                  </FadeIn>
                  <FadeIn delay={0.10}>
                    <TodaySummary subscribers={subscribers} />
                  </FadeIn>
                </div>

                {/* Team performance + Alerts row */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
                  <FadeIn className="xl:col-span-2">
                    <TeamPerformance subscribers={subscribers} />
                  </FadeIn>
                  <FadeIn delay={0.08}>
                    <Alerts subscribers={subscribers} />
                  </FadeIn>
                </div>

                {/* Calendar */}
                <FadeIn delay={0.06} className="mb-5">
                  <MonthlyCalendar subscribers={subscribers} />
                </FadeIn>

                {/* Advanced stats */}
                <FadeIn delay={0.1}>
                  <AdvancedStats subscribers={subscribers} />
                </FadeIn>
              </TabPanel>

              {/* ── TAB: SUBSCRIBERS ─────────────────────────────────── */}
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

              {/* ── TAB: ALERTS ──────────────────────────────────────── */}
              <TabPanel value="alerts">
                <AlertsPanel subscribers={subscribers} />
              </TabPanel>
            </Tabs>
          </>
        )}
      </div>

      {/* ═══ MODALS ═══════════════════════════════════════════════ */}
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
