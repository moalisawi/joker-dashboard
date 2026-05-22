"use client";

import { useQuery } from "@tanstack/react-query";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firestore";
import { COLLECTIONS } from "@/constants";
import { paymentMethodKeys } from "../keys";
import type { BalancePeriod, PaymentMethodPayer } from "../types";

function getPeriodStart(period: BalancePeriod): string | null {
  if (period === "lifetime") return null;
  const now = new Date();
  if (period === "currentMonth") {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  }
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function fetchPayers(
  methodId: string,
  period: BalancePeriod
): Promise<PaymentMethodPayer[]> {
  const periodStart = getPeriodStart(period);
  const constraints = [where("paymentMethodId", "==", methodId)];
  if (periodStart) {
    constraints.push(where("date", ">=", periodStart));
  }
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.PAYMENTS), ...constraints)
  );
  return snap.docs.map((d) => {
    const p = d.data();
    return {
      subscriberId:    p.subscriberId as string,
      subscriberName:  p.subscriberName as string,
      country:         (p.residence ?? p.country ?? "") as string,
      packageType:     (p.package ?? "") as string,
      paymentDate:     p.date as string,
      amountOriginal:  (p.amountOriginal as number) ?? 0,
      currencyOriginal: p.currencyOriginal as string,
      amountUSD:       (p.amountUSD as number) ?? 0,
      paymentId:       d.id,
    };
  });
}

export function usePaymentMethodPayersQuery(
  methodId: string | undefined,
  period: BalancePeriod
) {
  return useQuery({
    queryKey: paymentMethodKeys.payers(methodId ?? "", period),
    queryFn:  () => fetchPayers(methodId!, period),
    enabled:  !!methodId,
  });
}
