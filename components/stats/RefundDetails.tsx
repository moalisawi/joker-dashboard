"use client";

import { useMemo, useState } from "react";
import type { RefundTransaction } from "@/types";
import { formatNumber, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useRefunds } from "@/hooks/useRefunds";
import { ChevronDown, Search } from "lucide-react";

interface RefundDetailsProps {
  limit?: number;
}

export default function RefundDetails({ limit = 50 }: RefundDetailsProps) {
  const { can } = useAuthStore();
  const canRev = can("canViewRevenue");

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { refunds, loading } = useRefunds({ limit });

  // Filter and sort refunds
  const filtered = useMemo(() => {
    let results = refunds;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      results = results.filter(
        (r) =>
          r.subscriberName?.toLowerCase().includes(term) ||
          r.refundReason?.toLowerCase().includes(term)
      );
    }

    if (sortBy === "date") {
      results = results.sort((a, b) =>
        (b.refundDate || "").localeCompare(a.refundDate || "")
      );
    } else if (sortBy === "amount") {
      results = results.sort((a, b) =>
        (b.refundAmountUSD || 0) - (a.refundAmountUSD || 0)
      );
    }

    return results;
  }, [refunds, searchTerm, sortBy]);

  const stats = useMemo(() => {
    return {
      totalRefunds: filtered.reduce((sum, r) => sum + (r.refundAmountUSD || 0), 0),
      count: filtered.length,
      avgRefund: filtered.length > 0 
        ? filtered.reduce((sum, r) => sum + (r.refundAmountUSD || 0), 0) / filtered.length 
        : 0,
    };
  }, [filtered]);

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpanded(newExpanded);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
        <p className="text-slate-500">جاري تحميل سجل الاستردادات...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className="px-5 py-4 border-b border-slate-50">
        <h3 className="font-bold text-slate-800">سجل الاستردادات</h3>
        <p className="text-xs text-slate-400 mt-1">
          جميع معاملات الاسترداد والانسحابات
        </p>
      </div>

      <div className="p-5 space-y-4">
        {/* Search and filter */}
        <div className="flex gap-3 flex-col sm:flex-row">
          <div className="flex-1 relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="ابحث عن اسم أو سبب..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input w-full pl-9"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "date" | "amount")}
            className="form-input w-full sm:w-auto"
          >
            <option value="date">ترتيب: الأحدث أولاً</option>
            <option value="amount">ترتيب: الأعلى مبلغاً</option>
          </select>
        </div>

        {/* Stats */}
        {canRev && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-500">إجمالي</p>
              <p className="text-lg font-bold text-red-600">
                ${formatNumber(stats.totalRefunds, 2)}
              </p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-500">العدد</p>
              <p className="text-lg font-bold text-amber-600">{stats.count}</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-500">المتوسط</p>
              <p className="text-lg font-bold text-orange-600">
                ${formatNumber(stats.avgRefund, 2)}
              </p>
            </div>
          </div>
        )}

        {/* Refunds list */}
        {filtered.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm">لا توجد استردادات</p>
          </div>
        ) : (
          <div className="space-y-2 divide-y divide-slate-100">
            {filtered.map((refund) => {
              const isExpanded = expanded.has(refund.id || "");
              return (
                <div key={refund.id} className="py-3">
                  <button
                    onClick={() => toggleExpanded(refund.id || "")}
                    className="w-full flex items-start justify-between gap-3 hover:bg-slate-50 -mx-2 px-2 py-1 rounded-lg transition"
                  >
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-slate-800">
                        {refund.subscriberName}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {refund.refundReason}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {canRev && (
                        <div className="text-right">
                          <p className="font-bold text-red-600">
                            ${formatNumber(refund.refundAmountUSD || 0, 2)}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatDate(refund.refundDate || "")}
                          </p>
                        </div>
                      )}

                      <ChevronDown
                        size={16}
                        className={`text-slate-400 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-3 ml-6 pt-3 border-l-2 border-slate-100 space-y-2 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>المبلغ الأصلي:</span>
                        <span className="font-semibold">
                          {formatNumber(refund.refundAmount || 0, 2)}{" "}
                          {refund.refundCurrency}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>سعر الصرف:</span>
                        <span className="font-semibold">
                          {formatNumber(refund.exchangeRate || 1, 4)}
                        </span>
                      </div>
                      {canRev && (
                        <div className="flex justify-between">
                          <span>المبلغ بالدولار:</span>
                          <span className="font-semibold text-red-600">
                            ${formatNumber(refund.refundAmountUSD || 0, 2)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>تاريخ الاسترداد:</span>
                        <span className="font-semibold">
                          {formatDate(refund.refundDate || "")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>بواسطة:</span>
                        <span className="font-semibold text-slate-700">
                          {refund.createdBy || "-"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
