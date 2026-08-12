"use client";

import { useQuery } from "@tanstack/react-query";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "@/lib/firestore";
import type { Installment, Invoice, PaymentAdjustment, SubscriptionCycle } from "@/types/billing";

/**
 * Reading the billing ledger from the client.
 *
 * Every query here is a single equality filter with a `limit`, sorted in
 * JavaScript. Ordering in Firestore on a different field than the filter needs
 * a composite index, and a query whose index has not been deployed does not
 * degrade — it throws, and the billing tab would render as "no invoice" for a
 * subscriber who has one. The indexes are declared in firestore.indexes.json for
 * when reporting needs them server-side; nothing on this path depends on them.
 *
 * `enabled` is threaded through so a subscriber with no `currentCycleId` — every
 * record created before the ledger existed — never issues a query at all.
 */

const MAX_ROWS = 200;

export const billingKeys = {
  cycles:       (subscriberId: string) => ["billing", "cycles", subscriberId] as const,
  invoice:      (invoiceId: string)    => ["billing", "invoice", invoiceId] as const,
  invoices:     (subscriberId: string) => ["billing", "invoices", subscriberId] as const,
  installments: (invoiceId: string)    => ["billing", "installments", invoiceId] as const,
  adjustments:  (subscriberId: string) => ["billing", "adjustments", subscriberId] as const,
};

export function useSubscriptionCycles(subscriberId: string | undefined) {
  return useQuery({
    queryKey: billingKeys.cycles(subscriberId ?? ""),
    enabled: Boolean(subscriberId),
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<SubscriptionCycle[]> => {
      const snap = await getDocs(
        query(collection(db, "subscriptionCycles"), where("subscriberId", "==", subscriberId), limit(MAX_ROWS))
      );
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as SubscriptionCycle))
        .sort((a, b) => b.cycleNumber - a.cycleNumber);
    },
  });
}

export function useSubscriberInvoices(subscriberId: string | undefined) {
  return useQuery({
    queryKey: billingKeys.invoices(subscriberId ?? ""),
    enabled: Boolean(subscriberId),
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<Invoice[]> => {
      const snap = await getDocs(
        query(collection(db, "invoices"), where("subscriberId", "==", subscriberId), limit(MAX_ROWS))
      );
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Invoice))
        .sort((a, b) => b.cycleNumber - a.cycleNumber);
    },
  });
}

export function useInstallments(invoiceId: string | null | undefined) {
  return useQuery({
    queryKey: billingKeys.installments(invoiceId ?? ""),
    enabled: Boolean(invoiceId),
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<Installment[]> => {
      const snap = await getDocs(
        query(collection(db, "installments"), where("invoiceId", "==", invoiceId), limit(MAX_ROWS))
      );
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Installment))
        .sort((a, b) => a.installmentNumber - b.installmentNumber);
    },
  });
}

/**
 * Corrections raised against this subscriber's money.
 *
 * Surfaced beside the payments rather than tucked away: an adjustment is the
 * only thing that can make the balance disagree with the sum of the payment
 * rows, so a reader who cannot see it is looking at arithmetic that does not
 * add up.
 */
export function useAdjustments(subscriberId: string | undefined) {
  return useQuery({
    queryKey: billingKeys.adjustments(subscriberId ?? ""),
    enabled: Boolean(subscriberId),
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<PaymentAdjustment[]> => {
      const snap = await getDocs(
        query(collection(db, "paymentAdjustments"), where("subscriberId", "==", subscriberId), limit(MAX_ROWS))
      );
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as PaymentAdjustment))
        .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    },
  });
}

/**
 * Everything the billing tab needs, in one call.
 *
 * Returns `hasLedger: false` for a subscriber that predates the ledger, which
 * the tab renders from the legacy summary fields instead of showing an empty
 * state. That distinction is surfaced rather than hidden — a reconstructed view
 * has no invoice and no schedule behind it, and implying otherwise would promise
 * history that does not exist.
 */
export function useBillingOverview(subscriber: {
  id: string;
  currentCycleId?: string | null;
  currentInvoiceId?: string | null;
}) {
  const cycles       = useSubscriptionCycles(subscriber.id);
  const invoices     = useSubscriberInvoices(subscriber.id);
  const currentCycle = cycles.data?.find((c) => c.id === subscriber.currentCycleId) ?? cycles.data?.[0] ?? null;
  const currentInvoice =
    invoices.data?.find((i) => i.id === (subscriber.currentInvoiceId ?? currentCycle?.invoiceId)) ??
    invoices.data?.[0] ??
    null;
  const installments = useInstallments(currentInvoice?.id);

  return {
    cycles: cycles.data ?? [],
    invoices: invoices.data ?? [],
    currentCycle,
    currentInvoice,
    installments: installments.data ?? [],
    hasLedger: Boolean(subscriber.currentCycleId) && Boolean(currentCycle),
    isLoading: cycles.isLoading || invoices.isLoading || installments.isLoading,
    isError: cycles.isError || invoices.isError,
  };
}
