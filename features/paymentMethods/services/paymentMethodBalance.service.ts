import {
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import { COLLECTIONS } from "@/constants";
import type { BalancePeriod, PaymentMethodBalance, PaymentMethodPayer, SupportedCurrency } from "../types";

function getPeriodStart(period: BalancePeriod): string | null {
  if (period === "lifetime") return null;
  const now = new Date();
  if (period === "currentMonth") {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  }
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Single equality query on paymentMethodId (no composite index needed).
// Date filtering done client-side to avoid requiring a deployed composite index.
export async function computeBalance(
  paymentMethodId: string,
  period: BalancePeriod
): Promise<PaymentMethodBalance> {
  const periodStart = getPeriodStart(period);

  const paymentsSnap = await getDocs(
    query(
      collection(db, COLLECTIONS.PAYMENTS),
      where("paymentMethodId", "==", paymentMethodId)
    )
  );

  const perCurrency: Partial<Record<SupportedCurrency, number>> = {};
  let totalUSD = 0;
  const payerSet = new Set<string>();

  paymentsSnap.docs.forEach((d) => {
    const p = d.data();
    if (periodStart && (p.date as string) < periodStart) return;

    const currency = p.currencyOriginal as SupportedCurrency;
    perCurrency[currency] = (perCurrency[currency] ?? 0) + ((p.amountOriginal as number) ?? 0);
    totalUSD += (p.amountUSD as number) ?? 0;
    if (p.subscriberId) payerSet.add(p.subscriberId as string);
  });

  const refundsSnap = await getDocs(
    query(
      collection(db, COLLECTIONS.REFUNDS),
      where("paymentMethodId", "==", paymentMethodId)
    )
  );
  let refundedUSD = 0;
  refundsSnap.docs.forEach((d) => {
    const r = d.data();
    if (periodStart && (r.refundDate as string) < periodStart) return;
    refundedUSD += (r.refundAmountUSD as number) ?? 0;
  });

  return { perCurrency, totalUSD, payerCount: payerSet.size, refundedUSD };
}

export async function fetchPayersForExport(
  paymentMethodId: string,
  period: BalancePeriod
): Promise<PaymentMethodPayer[]> {
  const periodStart = getPeriodStart(period);
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.PAYMENTS),
      where("paymentMethodId", "==", paymentMethodId)
    )
  );
  return snap.docs
    .map((d) => {
      const p = d.data();
      return {
        subscriberId:     p.subscriberId as string,
        subscriberName:   p.subscriberName as string,
        country:          (p.residence ?? p.country ?? "") as string,
        packageType:      (p.package ?? "") as string,
        paymentDate:      p.date as string,
        amountOriginal:   (p.amountOriginal as number) ?? 0,
        currencyOriginal: p.currencyOriginal as string,
        amountUSD:        (p.amountUSD as number) ?? 0,
        paymentId:        d.id,
      };
    })
    .filter((p) => !periodStart || p.paymentDate >= periodStart)
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
}
