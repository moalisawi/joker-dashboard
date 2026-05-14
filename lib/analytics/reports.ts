/**
 * Reports: data preparation + CSV export
 */

import type { Subscriber }        from "@/types";
import type { Payment }           from "@/types";
import type { RefundTransaction } from "@/types";

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function escCsv(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(escCsv).join(","),
    ...rows.map((row) => row.map(escCsv).join(",")),
  ];
  return "﻿" + lines.join("\r\n"); // UTF-8 BOM for Arabic in Excel
}

function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toDateStr(raw: unknown): string {
  if (typeof raw === "string") return raw.slice(0, 10);
  if (raw && typeof (raw as { toDate?: () => Date }).toDate === "function")
    return (raw as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return "";
}

// ─── Subscriber report ────────────────────────────────────────────────────────

export interface SubscriberReportOptions {
  dateFrom?: string;
  dateTo?:   string;
  status?:   string;
  pkg?:      string;
}

export function exportSubscribersCSV(
  subscribers: Subscriber[],
  opts: SubscriberReportOptions = {},
  filename = "subscribers-report.csv"
): void {
  let data = [...subscribers];

  if (opts.dateFrom) data = data.filter((s) => s.date >= opts.dateFrom!);
  if (opts.dateTo)   data = data.filter((s) => s.date <= opts.dateTo!);
  if (opts.status)   data = data.filter((s) => s.status === opts.status);
  if (opts.pkg)      data = data.filter((s) => s.package === opts.pkg);

  const headers = [
    "الاسم", "الهاتف", "الدولة", "الباقة", "المدة", "تاريخ البدء",
    "تاريخ الانتهاء", "الحالة", "الإيراد USD", "المدفوع USD",
    "المتبقي USD", "الموظف المسؤول", "الفريق", "المصدر",
  ];

  const rows = data.map((s) => [
    s.name, s.phone, s.residence, s.package, s.duration,
    s.startDate ?? s.date, s.expiryDate, s.status,
    (s.netAmountUSD ?? 0).toFixed(2),
    (s.paidAmountUSD ?? 0).toFixed(2),
    (s.remainingAmountUSD ?? 0).toFixed(2),
    s.convincedBy, s.team, s.source,
  ]);

  downloadCsv(buildCsv(headers, rows), filename);
}

// ─── Payments report ──────────────────────────────────────────────────────────

export function exportPaymentsCSV(
  payments: Payment[],
  refunds:  RefundTransaction[] = [],
  dateFrom?: string,
  dateTo?:   string,
  filename = "payments-report.csv"
): void {
  let data = [...payments];
  if (dateFrom) data = data.filter((p) => toDateStr(p.date) >= dateFrom);
  if (dateTo)   data = data.filter((p) => toDateStr(p.date) <= dateTo);

  // مجموع الاسترداد لكل مشترك
  const refundBySubscriber: Record<string, number> = {};
  refunds.forEach((r) => {
    if (r.subscriberId)
      refundBySubscriber[r.subscriberId] = (refundBySubscriber[r.subscriberId] || 0) + (r.refundAmountUSD || 0);
  });

  const headers = [
    "التاريخ", "المشترك", "النوع", "المبلغ الأصلي", "العملة",
    "المبلغ USD", "الاسترداد USD", "صافي USD", "طريقة الدفع", "موظف المبيعات",
  ];

  // تجميع الاسترداد على أول دفعة للمشترك فقط لتجنب التكرار
  const seenRefund = new Set<string>();
  const rows = data.map((p) => {
    const sid = p.subscriberId ?? "";
    let refundUSD = 0;
    if (sid && !seenRefund.has(sid) && refundBySubscriber[sid]) {
      refundUSD = refundBySubscriber[sid];
      seenRefund.add(sid);
    }
    const netUSD = (p.amountUSD ?? 0) - refundUSD;
    return [
      p.date ?? "",
      p.subscriberName ?? sid,
      p.paymentType ?? "",
      (p.amountOriginal ?? 0).toFixed(2),
      p.currencyOriginal ?? "",
      (p.amountUSD ?? 0).toFixed(2),
      refundUSD.toFixed(2),
      netUSD.toFixed(2),
      p.paymentMethod ?? "",
      p.createdBy ?? "",
    ];
  });

  downloadCsv(buildCsv(headers, rows), filename);
}

// ─── Subscribers by month report ─────────────────────────────────────────────

/**
 * Export all subscribers whose subscription start date falls in the given month.
 * @param month  "YYYY-MM"
 */
export function exportSubscribersByMonthCSV(
  subscribers: Subscriber[],
  month: string,
  filename = `subscribers-${month}.csv`
): void {
  const data = subscribers.filter((s) => {
    const d = s.startDate ?? s.date ?? "";
    return d.slice(0, 7) === month;
  });

  const headers = [
    "الاسم", "الهاتف", "الدولة", "الباقة", "المدة",
    "تاريخ البدء", "تاريخ الانتهاء", "الحالة",
    "الإيراد USD", "المدفوع USD", "المتبقي USD",
    "أقنعه", "الفريق", "المصدر", "طريقة الدفع",
  ];

  const rows = data.map((s) => [
    s.name,
    s.phone ?? "",
    s.residence ?? "",
    s.package,
    s.duration,
    s.startDate ?? s.date,
    s.expiryDate,
    s.status,
    (s.netAmountUSD      ?? 0).toFixed(2),
    (s.paidAmountUSD     ?? 0).toFixed(2),
    (s.remainingAmountUSD ?? 0).toFixed(2),
    s.convincedBy ?? "",
    s.team ?? "",
    s.source ?? "",
    s.payment ?? "",
  ]);

  downloadCsv(buildCsv(headers, rows), filename);
}

// ─── Employee performance report ─────────────────────────────────────────────

import { employeePerformanceFromSubscribers } from "@/lib/analytics/calculations";

export function exportEmployeePerformanceCSV(
  subscribers: Subscriber[],
  filename = "employee-performance.csv"
): void {
  const metrics = employeePerformanceFromSubscribers(subscribers);

  const headers = [
    "الموظف", "المشتركون", "الإيراد USD", "النشطون",
    "التجديدات", "الاسترداد", "متوسط القيمة USD",
  ];

  const rows = metrics.map((m) => [
    m.name, m.subscribers, m.revenue.toFixed(2),
    m.active, m.renewals, m.refunds, m.avgValue.toFixed(2),
  ]);

  downloadCsv(buildCsv(headers, rows), filename);
}
