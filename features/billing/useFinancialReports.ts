"use client";

import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { db } from "@/lib/firestore";
import { COLLECTIONS } from "@/constants/collections";
import {
  agingBucketFor,
  deriveRenewalStatus,
  resolveReceiptStatus,
  type AgingBucket,
  deletedSubscriberIds,
  omitDeletedSubscriberRows,
} from "@/lib/subscriberLifecycle";
import { todayString } from "@/lib/utils";
import { summarizeRevenue } from "@/lib/revenueRecognition";
import type { Installment, Invoice } from "@/types/billing";
import type { PaymentTransaction, RefundTransaction, Subscriber } from "@/types";

/**
 * The aggregate financial picture.
 *
 * Reads collections whole and reduces in memory rather than issuing per-metric
 * Firestore aggregations. That is the right trade at this data size — a few
 * thousand documents — and it keeps every number on the page derived from one
 * consistent snapshot. Twelve separate `count()` queries would each see a
 * slightly different instant, so the totals would not add up, which is worse
 * than being a second stale.
 *
 * Outstanding is deliberately computed two ways and both are reported:
 *
 *   from instalments  — precise, dated, ageable, but only covers subscribers
 *                       that have a schedule
 *   from subscribers  — covers everyone including pre-ledger records, but has
 *                       no dates so it cannot be aged
 *
 * Showing only the first would understate what is owed by every legacy
 * subscriber; showing only the second would lose the aging that makes the number
 * actionable. They are labelled separately rather than added together.
 */

const MAX_ROWS = 3000;

export interface FinancialReports {
  isLoading: boolean;
  isError: boolean;

  /** Every non-deleted subscriber, for coverage figures. */
  subscriberCount: number;

  // ── Outstanding ──
  outstandingFromSubscribersUSD: number;
  subscribersWithBalance: number;
  outstandingFromInstallmentsUSD: number;
  /** Instalment balances grouped by how late they are. */
  aging: Record<AgingBucket, { count: number; amountUSD: number }>;
  overdueInstallments: (Installment & { subscriberName?: string })[];

  // ── Collected ──
  collectedUSD: number;
  refundedUSD: number;
  netUSD: number;
  /** collected ÷ (collected + outstanding). */
  collectionRate: number;

  // ── By method ──
  byMethod: {
    methodId: string;
    method: string;
    count: number;
    totalUSD: number;
    unreconciledCount: number;
    unreconciledUSD: number;
  }[];

  // ── Receipts ──
  receiptsPendingReview: number;
  receiptsMissing: number;

  // ── Renewals ──
  renewalDue: number;
  renewalContacted: number;
  renewalPromised: number;
  renewalRenewed: number;
  renewalDeclined: number;
  /** renewed ÷ (renewed + declined) among subscribers that reached a decision. */
  renewalConversion: number;

  // ── Invoices ──
  invoicesByStatus: Record<string, number>;

  // ── Accrual ──
  /*
   * Cash and revenue must describe the SAME population, so recognition is
   * computed here from the same `subscribers` array every other figure on this
   * page uses. It was briefly computed in the page from useSubscribers instead,
   * which is permission-scoped — so an employee without canViewAll would have
   * seen cash for the whole business beside revenue for their own book alone.
   * Two rows, one screen, two different sets of people. Sharing the source makes
   * that impossible by construction rather than by discipline.
   */
  /** Earned this month to date, straight-line by day. */
  recognizedRevenueUSD: number;
  /** Collected for service not yet delivered — a liability, not profit. */
  deferredRevenueUSD: number;
  /** Subscribers with no start date or duration, so not recognisable. */
  unrecognizableCount: number;
  /** Cash received this month — the like-for-like partner of recognizedRevenueUSD. */
  cashThisMonthUSD: number;
}

function useCollection<T>(name: string, enabled: boolean) {
  return useQuery({
    queryKey: ["finance", name],
    enabled,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<T[]> => {
      // Read unfiltered. Soft-deleted subscribers are dropped in the body
      // rather than in a Firestore filter, because `where("deleted","!=",true)`
      // also excludes documents with no `deleted` field at all, which is most
      // of them. Reading them here is also what lets the ledger collections be
      // filtered against that same set — see `deletedIds` below.
      const snap = await getDocs(query(collection(db, name), limit(MAX_ROWS)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
    },
  });
}

export function useFinancialReports(enabled = true): FinancialReports {
  const today = todayString();

  const subs      = useCollection<Subscriber>(COLLECTIONS.SUBSCRIBERS, enabled);
  const payments  = useCollection<PaymentTransaction>(COLLECTIONS.PAYMENTS, enabled);
  const refunds   = useCollection<RefundTransaction>(COLLECTIONS.REFUNDS, enabled);
  const invoices  = useCollection<Invoice>("invoices", enabled);
  const installs  = useCollection<Installment>("installments", enabled);

  /*
   * Deliberately not wrapped in useMemo.
   *
   * The React Compiler is enabled for this project and memoizes this
   * automatically from the values actually read. A hand-written dependency
   * array here could not be verified against the body — the reduce reads five
   * query results plus their loading and error flags — so the compiler refused
   * to preserve it and skipped compiling the hook entirely, which is strictly
   * worse than letting it do the work.
   */
  {
    const allSubscribers = subs.data ?? [];

    /*
     * Every collection below is filtered against the same soft-delete set.
     *
     * Filtering only `subscribers` was a real defect: a soft-deleted subscriber
     * vanished from the subscribers screen while their payments, invoices and
     * instalments went on counting toward collected, outstanding and aging, with
     * nothing on any screen to explain the gap. Found on 31 Aug 2026 against
     * production, where all six invoices and all nine instalments belonged to
     * deleted subscribers — the finance page was reporting $600 outstanding that
     * nobody was ever going to collect.
     *
     * Outstanding is the clear half: an uncollectable balance is not a
     * receivable, the same reasoning that already excludes withdrawn
     * subscriptions below. Collected is the arguable half, since that money did
     * arrive — but a collection rate whose numerator and denominator disagree
     * about which subscribers exist is worse than either answer, so the two are
     * kept consistent. Nothing is deleted: these rows remain in Firestore and
     * remain reachable from the subscriber's own record.
     */
    const deletedIds = deletedSubscriberIds(allSubscribers);
    const owned = <R extends { subscriberId?: string }>(rows: R[]) =>
      omitDeletedSubscriberRows(rows, deletedIds);

    const subscribers  = allSubscribers.filter((s) => !deletedIds.has(s.id));
    const paymentRows  = owned(payments.data ?? []);
    const refundRows   = owned(refunds.data ?? []);
    const invoiceRows  = owned(invoices.data ?? []);
    const installRows  = owned(installs.data ?? []);

    // ── Outstanding ──
    let outstandingFromSubscribersUSD = 0;
    let subscribersWithBalance = 0;
    for (const s of subscribers) {
      const remaining = Number(s.remainingAmountUSD) || 0;
      // A withdrawn subscription is not a receivable — nobody is going to
      // collect it, and counting it inflates outstanding for ever.
      if (s.subscriptionState === "withdrawn") continue;
      if (remaining > 0.01) { outstandingFromSubscribersUSD += remaining; subscribersWithBalance++; }
    }

    const aging: Record<AgingBucket, { count: number; amountUSD: number }> = {
      not_due:   { count: 0, amountUSD: 0 },
      due_today: { count: 0, amountUSD: 0 },
      d1_7:      { count: 0, amountUSD: 0 },
      d8_30:     { count: 0, amountUSD: 0 },
      d31_plus:  { count: 0, amountUSD: 0 },
    };
    let outstandingFromInstallmentsUSD = 0;
    const overdueInstallments: Installment[] = [];

    for (const i of installRows) {
      if (i.status === "paid" || i.status === "waived" || i.status === "cancelled") continue;
      const owed = Math.max(0, (Number(i.amountUSD) || 0) - (Number(i.paidUSD) || 0));
      if (owed <= 0.01) continue;
      outstandingFromInstallmentsUSD += owed;
      const bucket = agingBucketFor(i.dueDate, today);
      aging[bucket].count++;
      aging[bucket].amountUSD += owed;
      if (bucket !== "not_due") overdueInstallments.push(i);
    }
    overdueInstallments.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    // ── Collected ──
    const collectedUSD = paymentRows.reduce((n, p) => n + (Number(p.amountUSD) || 0), 0);
    /*
     * Cash for THIS MONTH, kept separate from the all-time figure above.
     *
     * Recognised revenue is month-to-date, and the two were briefly subtracted
     * from each other on screen — all-time cash minus one month's revenue, a
     * difference of two incompatible periods reported as if it meant something.
     */
    const ym = today.slice(0, 7);
    const cashThisMonthUSD = paymentRows
      .filter((p) => String(p.date ?? "").startsWith(ym))
      .reduce((n, p) => n + (Number(p.amountUSD) || 0), 0);
    const refundedUSD  = refundRows.reduce((n, r) => n + (Number(r.refundAmountUSD) || 0), 0);
    const billed = collectedUSD + outstandingFromSubscribersUSD;

    // ── By method ──
    const methodMap = new Map<string, FinancialReports["byMethod"][number]>();
    for (const p of paymentRows) {
      const key = p.paymentMethodId || p.paymentMethod || "—";
      const row = methodMap.get(key) ?? {
        methodId: p.paymentMethodId ?? "",
        method: p.paymentMethod || "—",
        count: 0, totalUSD: 0, unreconciledCount: 0, unreconciledUSD: 0,
      };
      const amount = Number(p.amountUSD) || 0;
      row.count++;
      row.totalUSD += amount;
      if ((p.settlementStatus ?? "unreconciled") === "unreconciled") {
        row.unreconciledCount++;
        row.unreconciledUSD += amount;
      }
      methodMap.set(key, row);
    }

    // ── Receipts ──
    let receiptsPendingReview = 0, receiptsMissing = 0;
    for (const p of paymentRows) {
      const st = resolveReceiptStatus(p);
      if (st === "pending_review") receiptsPendingReview++;
      if (st === "missing") receiptsMissing++;
    }

    // ── Renewals ──
    let renewalDue = 0, renewalContacted = 0, renewalPromised = 0, renewalRenewed = 0, renewalDeclined = 0;
    for (const s of subscribers) {
      switch (deriveRenewalStatus(s, today)) {
        case "due": case "upcoming": renewalDue++; break;
        case "contacted": renewalContacted++; break;
        case "promised":  renewalPromised++;  break;
        case "renewed":   renewalRenewed++;   break;
        case "declined":  renewalDeclined++;  break;
      }
    }
    const decided = renewalRenewed + renewalDeclined;

    // ── Invoices ──
    const invoicesByStatus: Record<string, number> = {};
    for (const inv of invoiceRows) {
      invoicesByStatus[inv.status] = (invoicesByStatus[inv.status] ?? 0) + 1;
    }

    const monthStart = today.slice(0, 8) + "01";
    const revenue = summarizeRevenue(subscribers, monthStart, today, today);

    return {
      isLoading: subs.isLoading || payments.isLoading || refunds.isLoading,
      isError:   subs.isError || payments.isError,

      subscriberCount: subscribers.length,

      recognizedRevenueUSD: revenue.recognizedUSD,
      deferredRevenueUSD:   revenue.deferredUSD,
      unrecognizableCount:  revenue.unrecognizable,
      cashThisMonthUSD,

      outstandingFromSubscribersUSD,
      subscribersWithBalance,
      outstandingFromInstallmentsUSD,
      aging,
      overdueInstallments: overdueInstallments.slice(0, 50),

      collectedUSD,
      refundedUSD,
      netUSD: Math.max(0, collectedUSD - refundedUSD),
      collectionRate: billed > 0 ? collectedUSD / billed : 0,

      byMethod: [...methodMap.values()].sort((a, b) => b.totalUSD - a.totalUSD),

      receiptsPendingReview,
      receiptsMissing,

      renewalDue, renewalContacted, renewalPromised, renewalRenewed, renewalDeclined,
      renewalConversion: decided > 0 ? renewalRenewed / decided : 0,

      invoicesByStatus,
    };
  }
}
