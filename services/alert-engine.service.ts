/**
 * Smart Alert Engine
 * Runs pattern-based checks against recent activity and creates
 * aggregated notifications when thresholds are crossed.
 *
 * Designed to run on-demand (e.g., when the notification center opens)
 * or on a timer. Results are deduplicated via notificationService.createSmartAlert.
 */

import {
  collection, query, where, getDocs,
  limit, Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import { notificationService } from "./notification.service";

const now = () => Date.now();

function daysAgoTs(days: number): Timestamp {
  return Timestamp.fromMillis(now() - days * 86_400_000);
}

// ─── individual checks ────────────────────────────────────────────────────────

async function checkHighRefundActivity(): Promise<void> {
  try {
    const thisWeekStart = daysAgoTs(7);
    const lastWeekStart = daysAgoTs(14);

    const [thisSnap, lastSnap] = await Promise.all([
      getDocs(query(
        collection(db, "refunds"),
        where("createdAt", ">=", thisWeekStart),
        limit(200)
      )),
      getDocs(query(
        collection(db, "refunds"),
        where("createdAt", ">=", lastWeekStart),
        where("createdAt", "<", thisWeekStart),
        limit(200)
      )),
    ]);

    const thisTotal = thisSnap.docs.reduce(
      (s, d) => s + (Number(d.data().refundAmountUSD) || 0), 0
    );
    const lastTotal = lastSnap.docs.reduce(
      (s, d) => s + (Number(d.data().refundAmountUSD) || 0), 0
    );

    if (lastTotal > 0) {
      const change = ((thisTotal - lastTotal) / lastTotal) * 100;
      if (change >= 30) {
        await notificationService.createHighRefundAlert(thisTotal, change);
      }
    } else if (thisTotal > 100) {
      // No previous data but high refunds this week
      await notificationService.createHighRefundAlert(thisTotal, 100);
    }
  } catch (err) {
    console.warn("[alertEngine] checkHighRefundActivity:", err);
  }
}

async function checkWithdrawalSpike(): Promise<void> {
  try {
    const thisWeekStart = daysAgoTs(7);
    const lastWeekStart = daysAgoTs(14);

    const [thisSnap, lastSnap] = await Promise.all([
      getDocs(query(
        collection(db, "subscribers"),
        where("subscriptionState", "==", "withdrawn"),
        where("updatedAt", ">=", thisWeekStart),
        limit(200)
      )),
      getDocs(query(
        collection(db, "subscribers"),
        where("subscriptionState", "==", "withdrawn"),
        where("updatedAt", ">=", lastWeekStart),
        where("updatedAt", "<", thisWeekStart),
        limit(200)
      )),
    ]);

    const thisCount = thisSnap.size;
    const lastCount = lastSnap.size;

    if (lastCount > 0 && thisCount > 0) {
      const change = ((thisCount - lastCount) / lastCount) * 100;
      if (change >= 30) {
        await notificationService.createWithdrawalSpikeAlert(thisCount, change);
      }
    }
  } catch (err) {
    console.warn("[alertEngine] checkWithdrawalSpike:", err);
  }
}

async function checkFailedLogins(): Promise<void> {
  try {
    const oneHourAgo = Timestamp.fromMillis(now() - 3_600_000);

    const snap = await getDocs(query(
      collection(db, "auditLogs"),
      where("action",    "==", "login_failed"),
      where("createdAt", ">=", oneHourAgo),
      limit(20)
    ));

    if (snap.size >= 3) {
      // Find the most targeted email
      const emails: Record<string, number> = {};
      snap.docs.forEach((d) => {
        const email = (d.data().entityId as string) ?? "";
        if (email) emails[email] = (emails[email] ?? 0) + 1;
      });
      const topEmail = Object.entries(emails).sort((a, b) => b[1] - a[1])[0]?.[0];
      await notificationService.createFailedLoginAlert(snap.size, topEmail);
    }
  } catch (err) {
    console.warn("[alertEngine] checkFailedLogins:", err);
  }
}

async function checkUnusualEmployeeRefunds(): Promise<void> {
  try {
    const oneDayAgo = daysAgoTs(1);

    const snap = await getDocs(query(
      collection(db, "refunds"),
      where("createdAt", ">=", oneDayAgo),
      limit(200)
    ));

    // Group by creator
    const byCreator: Record<string, { count: number; total: number; name: string }> = {};
    snap.docs.forEach((d) => {
      const data = d.data();
      const uid  = (data.createdBy as string) ?? "unknown";
      const name = (data.createdByName as string) ?? uid;
      if (!byCreator[uid]) byCreator[uid] = { count: 0, total: 0, name };
      byCreator[uid].count++;
      byCreator[uid].total += Number(data.refundAmountUSD) || 0;
    });

    for (const { count, total, name } of Object.values(byCreator)) {
      if (count >= 5 || total >= 500) {
        await notificationService.createUnusualRefundAlert(name, count, total);
      }
    }
  } catch (err) {
    console.warn("[alertEngine] checkUnusualEmployeeRefunds:", err);
  }
}

async function checkRevenueDrop(): Promise<void> {
  try {
    const thisWeekStart = daysAgoTs(7);
    const lastWeekStart = daysAgoTs(14);

    const [thisSnap, lastSnap] = await Promise.all([
      getDocs(query(
        collection(db, "payments"),
        where("createdAt", ">=", thisWeekStart),
        limit(300)
      )),
      getDocs(query(
        collection(db, "payments"),
        where("createdAt", ">=", lastWeekStart),
        where("createdAt", "<", thisWeekStart),
        limit(300)
      )),
    ]);

    const thisRev = thisSnap.docs.reduce(
      (s, d) => s + (Number(d.data().amountUSD) || 0), 0
    );
    const lastRev = lastSnap.docs.reduce(
      (s, d) => s + (Number(d.data().amountUSD) || 0), 0
    );

    if (lastRev > 0 && thisRev < lastRev) {
      const dropPercent = ((lastRev - thisRev) / lastRev) * 100;
      if (dropPercent >= 25) {
        await notificationService.createRevenuDropAlert(thisRev, lastRev);
      }
    }
  } catch (err) {
    console.warn("[alertEngine] checkRevenueDrop:", err);
  }
}

async function checkExpiringSubscriptions(): Promise<void> {
  try {
    const today = new Date().toISOString().split("T")[0];
    const in3Days = new Date(Date.now() + 3 * 86_400_000).toISOString().split("T")[0];

    const snap = await getDocs(query(
      collection(db, "subscribers"),
      where("subscriptionState", "==", "active"),
      where("expiryDate", ">=", today),
      where("expiryDate", "<=", in3Days),
      limit(100)
    ));

    if (snap.size > 0) {
      await notificationService.createExpiringSubscriptionAlert(snap.size);
    }
  } catch (err) {
    console.warn("[alertEngine] checkExpiringSubscriptions:", err);
  }
}

// ─── run all checks ───────────────────────────────────────────────────────────

const LS_KEY = "alertEngine_lastRunAt";
const RUN_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes, survives page refresh

function getLastRunAt(): number {
  try { return Number(localStorage.getItem(LS_KEY) ?? 0); } catch { return 0; }
}
function setLastRunAt(ts: number): void {
  try { localStorage.setItem(LS_KEY, String(ts)); } catch { /* ignore */ }
}

async function runAll(): Promise<void> {
  const lastRunAt = getLastRunAt();
  if (now() - lastRunAt < RUN_COOLDOWN_MS) return;
  setLastRunAt(now());

  await Promise.allSettled([
    checkHighRefundActivity(),
    checkWithdrawalSpike(),
    checkFailedLogins(),
    checkUnusualEmployeeRefunds(),
    checkRevenueDrop(),
    checkExpiringSubscriptions(),
    notificationService.createRenewalRemindersForAssignedEmployees(7),
  ]);
}

export const alertEngineService = {
  runAll,
  checkHighRefundActivity,
  checkWithdrawalSpike,
  checkFailedLogins,
  checkUnusualEmployeeRefunds,
  checkRevenueDrop,
  checkExpiringSubscriptions,
};
