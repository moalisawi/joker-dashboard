"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  collection, query, orderBy, limit,
  onSnapshot, getDocs, startAfter,
  type QueryDocumentSnapshot, type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import type { AuditLog, AuditLogFilters, NormalizedAuditLog, AuditCategory, AuditSeverity } from "@/types";
import { auditService } from "@/services/audit.service";

const PAGE_SIZE   = 100; // realtime window
const EXTRA_BATCH = 50;  // each "load more"

function toTimestamp(val: unknown): number {
  if (!val) return 0;
  if (typeof val === "object" && val !== null) {
    if ("toMillis" in val) return (val as { toMillis(): number }).toMillis();
    if ("seconds" in val) return (val as { seconds: number }).seconds * 1000;
  }
  return 0;
}

export function normalizeLog(raw: AuditLog): NormalizedAuditLog {
  return {
    ...raw,
    _performedByName: raw.performedBy?.name ?? raw.actorName ?? "",
    _performedByRole: raw.performedBy?.role ?? raw.actorRole ?? "",
    _entityName:      raw.entityName        ?? raw.targetName ?? raw.targetId ?? "",
    _description:     raw.description       ?? raw.summary    ?? "",
    _createdAt:       raw.createdAt         ?? null,
    // fill inferred fields if absent
    category:  raw.category ?? auditService.ACTION_CATEGORY[raw.action] as AuditCategory | undefined,
    severity:  raw.severity ?? auditService.ACTION_SEVERITY[raw.action] as AuditSeverity | undefined,
    source:    raw.source   ?? "dashboard",
  };
}

function matchesFilters(log: NormalizedAuditLog, f: AuditLogFilters): boolean {
  if (f.action   && log.action    !== f.action)   return false;
  if (f.category && log.category  !== f.category) return false;
  if (f.severity && log.severity  !== f.severity) return false;
  if (f.source   && log.source    !== f.source)   return false;

  if (f.dateFrom || f.dateTo) {
    const ms = toTimestamp(log.createdAt);
    if (ms === 0) return false;
    if (f.dateFrom && ms < new Date(f.dateFrom).getTime()) return false;
    if (f.dateTo   && ms > new Date(f.dateTo + "T23:59:59").getTime()) return false;
  }

  if (f.search) {
    const s = f.search.toLowerCase();
    const haystack = [
      log._performedByName,
      log._performedByRole,
      log._entityName,
      log._description,
      log.action,
    ].join(" ").toLowerCase();
    if (!haystack.includes(s)) return false;
  }

  return true;
}

// Group a sorted array of logs into date buckets
export interface LogGroup {
  label: string;
  logs: NormalizedAuditLog[];
}

export function groupByDate(logs: NormalizedAuditLog[]): LogGroup[] {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86_400_000;
  const weekAgo   = today - 6 * 86_400_000;

  const buckets: Record<string, NormalizedAuditLog[]> = {
    today:     [],
    yesterday: [],
    thisWeek:  [],
    older:     [],
  };

  for (const log of logs) {
    const ms = toTimestamp(log.createdAt);
    if (ms >= today)     buckets.today.push(log);
    else if (ms >= yesterday) buckets.yesterday.push(log);
    else if (ms >= weekAgo)   buckets.thisWeek.push(log);
    else                      buckets.older.push(log);
  }

  const LABELS: Record<string, string> = {
    today:     "اليوم",
    yesterday: "الأمس",
    thisWeek:  "هذا الأسبوع",
    older:     "أقدم",
  };

  return Object.entries(buckets)
    .filter(([, list]) => list.length > 0)
    .map(([key, list]) => ({ label: LABELS[key] ?? key, logs: list }));
}

export function useAuditLogs() {
  const [live, setLive]                 = useState<NormalizedAuditLog[]>([]);
  const [extra, setExtra]               = useState<NormalizedAuditLog[]>([]);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [hasMore, setHasMore]           = useState(true);
  const [lastDoc, setLastDoc]           = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [filters, setFilters]           = useState<AuditLogFilters>({});
  const [error, setError]               = useState<string | null>(null);

  // realtime listener — always watches the newest PAGE_SIZE docs
  useEffect(() => {
    const q = query(
      collection(db, "auditLogs"),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => normalizeLog({ id: d.id, ...d.data() } as AuditLog));
        setLive(docs);
        if (snap.docs.length > 0) setLastDoc(snap.docs[snap.docs.length - 1]);
        setHasMore(snap.docs.length === PAGE_SIZE);
        setLoading(false);
      },
      (err) => {
        console.error("[useAuditLogs]", err);
        setError("فشل تحميل السجلات");
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const loadMore = useCallback(async () => {
    if (!lastDoc || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, "auditLogs"),
        orderBy("createdAt", "desc"),
        startAfter(lastDoc),
        limit(EXTRA_BATCH)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => normalizeLog({ id: d.id, ...d.data() } as AuditLog));
      setExtra((prev) => [...prev, ...docs]);
      if (snap.docs.length > 0) setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length === EXTRA_BATCH);
    } catch (err) {
      console.error("[useAuditLogs] loadMore:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [lastDoc, loadingMore, hasMore]);

  // merge live + extra, dedupe by id, keep order (live first = newest)
  const allLogs = useMemo<NormalizedAuditLog[]>(() => {
    const seen = new Set<string>();
    const merged: NormalizedAuditLog[] = [];
    for (const log of [...live, ...extra]) {
      if (!seen.has(log.id)) {
        seen.add(log.id);
        merged.push(log);
      }
    }
    return merged;
  }, [live, extra]);

  const filtered = useMemo(
    () => allLogs.filter((l) => matchesFilters(l, filters)),
    [allLogs, filters]
  );

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  // quick stats computed from allLogs (unfiltered)
  const stats = useMemo(() => {
    const today = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    let todayCount    = 0;
    let criticalCount = 0;
    let financialCount = 0;

    for (const log of allLogs) {
      const ms = toTimestamp(log.createdAt);
      if (ms >= today) todayCount++;
      if (log.severity === "critical") criticalCount++;
      if (log.category === "financial") financialCount++;
    }

    return {
      total:    allLogs.length,
      today:    todayCount,
      critical: criticalCount,
      financial: financialCount,
    };
  }, [allLogs]);

  return {
    logs:        filtered,
    grouped,
    allLogs,
    loading,
    loadingMore,
    hasMore,
    error,
    filters,
    setFilters,
    loadMore,
    stats,
  };
}
