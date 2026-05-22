import type { PaymentMethodPayer } from "../types";
import type { BalancePeriod } from "../types";

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

const PERIOD_LABELS: Record<BalancePeriod, string> = {
  currentMonth: "current-month",
  last30:       "last-30-days",
  lifetime:     "lifetime",
};

export function exportPaymentMethodCSV(
  methodName: string,
  period: BalancePeriod,
  payers: PaymentMethodPayer[]
): void {
  const headers = [
    "اسم المشترك",
    "الدولة",
    "الباقة",
    "تاريخ الدفع",
    "المبلغ",
    "العملة",
    "المعادل USD",
  ];

  const rows = payers.map((p) => [
    p.subscriberName,
    p.country,
    p.packageType,
    p.paymentDate,
    p.amountOriginal,
    p.currencyOriginal,
    p.amountUSD.toFixed(2),
  ]);

  const csv      = buildCsv(headers, rows);
  const today    = new Date().toISOString().slice(0, 10);
  const safeName = methodName.replace(/[^a-zA-Z0-9؀-ۿ]/g, "-");
  const filename = `${safeName}-${PERIOD_LABELS[period]}-${today}.csv`;

  downloadCsv(csv, filename);
}
