"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Spinner } from "@heroui/react";
import { toast } from "@heroui/react";
import { Plus,  AlertCircle } from "lucide-react";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import PageHeader from "@/components/layout/PageHeader";
import { useAuthStore } from "@/store/authStore";
import { usePaymentMethodsQuery } from "@/features/paymentMethods/hooks/usePaymentMethodsQuery";
import { useTogglePaymentMethodMutation } from "@/features/paymentMethods/hooks/useTogglePaymentMethodMutation";
import { useDeletePaymentMethodMutation } from "@/features/paymentMethods/hooks/useDeletePaymentMethodMutation";
import { PaymentMethodsGrid } from "@/features/paymentMethods/components/PaymentMethodsGrid";
import { PaymentMethodSummaryStats } from "@/features/paymentMethods/components/PaymentMethodSummaryStats";
import { PaymentMethodFormModal } from "@/features/paymentMethods/components/PaymentMethodFormModal";
import { PaymentMethodPayersModal } from "@/features/paymentMethods/components/PaymentMethodPayersModal";
import { exportPaymentMethodCSV } from "@/features/paymentMethods/utils/exportPaymentMethod";
import { fetchPayersForExport } from "@/features/paymentMethods/services/paymentMethodBalance.service";
import type { PaymentMethod, BalancePeriod } from "@/features/paymentMethods/types";

const tran = { duration: 0.32, ease: "easeOut" } as const;

const PERIOD_OPTIONS: { value: BalancePeriod; label: string }[] = [
  { value: "currentMonth", label: "الشهر الحالي" },
  { value: "last30",       label: "آخر 30 يوم" },
  { value: "lifetime",     label: "كل الوقت" },
];

type ModalState =
  | { type: "none" }
  | { type: "form";          method?: PaymentMethod }
  | { type: "payers";        method: PaymentMethod }
  | { type: "confirmDelete"; method: PaymentMethod };

export default function PaymentMethodsPage() {
  const { user, can }       = useAuthStore();
  const [period, setPeriod] = useState<BalancePeriod>("currentMonth");
  const [modal, setModal]   = useState<ModalState>({ type: "none" });

  const { data: methods, isLoading } = usePaymentMethodsQuery();
  const toggleMutation = useTogglePaymentMethodMutation();
  const deleteMutation = useDeletePaymentMethodMutation();
  const canManage      = can("canManagePaymentMethods");

  const visibleMethods = useMemo(
    () => (methods ?? []).filter((m) => !m.deleted),
    [methods]
  );

  async function handleToggle(m: PaymentMethod) {
    try {
      await toggleMutation.mutateAsync({ id: m.id, currentStatus: m.status, name: m.name });
      toast.success(m.status === "active" ? "تم تعطيل طريقة الدفع" : "تم تفعيل طريقة الدفع");
    } catch {
      toast.danger("حدث خطأ أثناء تغيير الحالة");
    }
  }

  async function confirmDelete(m: PaymentMethod) {
    try {
      await deleteMutation.mutateAsync({ id: m.id, name: m.name });
      toast.success("تم حذف طريقة الدفع");
      setModal({ type: "none" });
    } catch {
      toast.danger("حدث خطأ أثناء الحذف");
    }
  }

  async function handleExport(m: PaymentMethod) {
    try {
      const payers = await fetchPayersForExport(m.id, period);
      exportPaymentMethodCSV(m.name, period, payers);
    } catch {
      toast.danger("حدث خطأ أثناء التصدير");
    }
  }

  if (!user) return null;

  if (!canManage) {
    return (
      <ProtectedLayout>
        <div className="min-h-full flex flex-col items-center justify-center gap-3" style={{ background: "var(--page-bg)" }}>
          <AlertCircle size={36} style={{ color: "#EF4444" }} />
          <p className="font-bold" style={{ color: "var(--text-primary)" }}>غير مصرح بالوصول</p>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <div className="min-h-full" style={{ background: "var(--page-bg)" }}>
        <div className="mx-auto max-w-6xl px-4 py-7 md:px-8 space-y-6">

          {/* Header */}
          <PageHeader
            title="طرق الدفع"
            subtitle="إدارة طرق الدفع وتتبع الأرصدة"
            actions={
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex p-1 rounded-xl gap-0.5"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  {PERIOD_OPTIONS.map((opt) => (
                    <button key={opt.value} onClick={() => setPeriod(opt.value)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={period === opt.value
                        ? { background: "var(--surface)", color: "var(--text-primary)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                        : { color: "var(--text-muted)" }
                      }>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setModal({ type: "form" })}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg,#5B5FEF 0%,#5B5FEF 100%)" }}>
                  <Plus size={15} /> إضافة طريقة دفع
                </button>
              </div>
            }
          />

          {/* Content */}
          {isLoading ? (
            <div className="flex justify-center items-center py-24"><Spinner size="lg" /></div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ ...tran, delay: 0.1 }} className="space-y-5">
              <PaymentMethodSummaryStats methods={visibleMethods} period={period} />
              <PaymentMethodsGrid
                methods={visibleMethods} period={period}
                onEdit={(m) => setModal({ type: "form", method: m })}
                onToggle={handleToggle}
                onDelete={(m) => setModal({ type: "confirmDelete", method: m })}
                onViewPayers={(m) => setModal({ type: "payers", method: m })}
                onExport={handleExport}
              />
            </motion.div>
          )}
        </div>
      </div>

      <PaymentMethodFormModal
        isOpen={modal.type === "form"}
        onClose={() => setModal({ type: "none" })}
        initialData={modal.type === "form" ? (modal.method ?? null) : null}
      />

      <PaymentMethodPayersModal
        isOpen={modal.type === "payers"}
        onClose={() => setModal({ type: "none" })}
        method={modal.type === "payers" ? modal.method : null}
        period={period}
      />

      {modal.type === "confirmDelete" && (
        <div className="modal-overlay" style={{ zIndex: 55 }} onClick={() => setModal({ type: "none" })}>
          <div className="modal-panel max-w-sm w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#EF444418" }}>
                <AlertCircle size={18} style={{ color: "#EF4444" }} />
              </div>
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>تأكيد الحذف</h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              هل أنت متأكد من حذف{" "}
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{modal.method.name}</span>؟{" "}
              ستُحذف الطريقة لكن جميع الدفعات السابقة ستبقى محفوظة.
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setModal({ type: "none" })} disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-xl text-sm font-semibold border transition-colors hover:bg-slate-50 disabled:opacity-50"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                إلغاء
              </button>
              <button disabled={deleteMutation.isPending} onClick={() => confirmDelete(modal.method)}
                className="px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-2"
                style={{ background: "linear-gradient(135deg,#EF4444,#EF4444)" }}>
                {deleteMutation.isPending && <Spinner size="sm" color="current" />}
                حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedLayout>
  );
}
