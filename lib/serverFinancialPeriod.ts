import { getFirestore } from "firebase-admin/firestore";
import {
  canWriteMoneyIn,
  backdatedRefusal,
  periodOf,
  type FinancialPeriod,
} from "@/lib/financialPeriod";

export const PERIODS = "financialPeriods";

/** Read one period, or null when the month has no document — which means open. */
export async function readPeriod(period: string): Promise<FinancialPeriod | null> {
  const snap = await getFirestore().collection(PERIODS).doc(period).get();
  return snap.exists ? ({ period, ...snap.data() } as FinancialPeriod) : null;
}

/** Every month currently closed. Small by construction: one document per month. */
export async function readClosedPeriods(): Promise<Set<string>> {
  const snap = await getFirestore().collection(PERIODS).where("status", "==", "closed").get();
  return new Set(snap.docs.map((d) => d.id));
}

/**
 * Refuse money dated into a closed month.
 *
 * Called before the write, on the document's OWN date — a payment recorded
 * today and dated to May belongs to May, and that is the whole point. The date
 * is never quietly moved to the open month: doing so would hide when the money
 * actually happened, which is the one thing the date is for.
 */
export async function assertPeriodOpenForDate(
  date: string,
  kind: "payment" | "refund" | "invoice"
): Promise<void> {
  const period = periodOf(date);
  if (!period) return;
  const doc = await readPeriod(period);
  if (canWriteMoneyIn(doc)) return;

  const error = new Error(backdatedRefusal(period, kind)) as Error & { status?: number };
  error.status = 422;
  throw error;
}
