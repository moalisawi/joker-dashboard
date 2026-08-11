"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { LeaderboardEntry } from "@/features/leaderboards/lib/leaderboardMetrics";
import { Trophy, ChevronDown, ChevronUp } from "lucide-react";

const MEDAL: Record<number, { emoji: string; color: string }> = {
  1: { emoji:"🥇", color:"#F59E0B" },
  2: { emoji:"🥈", color:"#9ca3af" },
  3: { emoji:"🥉", color:"#b45309" },
};


const PREVIEW = 3;

interface Props {
  title:    string;
  icon?:    React.ReactNode;
  entries:  LeaderboardEntry[];
  accent:   string;
  format:   (value: number) => string;
  subFormat?: (value: number) => string;
  subLabel?:  string;
  linkPrefix?: string; // "/sales" → links to /sales/uid
  isLoading?: boolean;
}

export default function LeaderboardCard({
  title, icon, entries, accent, format, subFormat, subLabel,
  linkPrefix, isLoading,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? entries : entries.slice(0, PREVIEW);

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background:"var(--surface)", border:"1px solid var(--border)", boxShadow:"var(--shadow-card)" }}>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b"
        style={{ borderColor:"var(--border)" }}>
        <div className="h-8 w-8 flex items-center justify-center rounded-xl"
          style={{ background:`${accent}18` }}>
          <span style={{ color:accent }}>{icon ?? <Trophy size={14}/>}</span>
        </div>
        <span className="font-bold text-sm" style={{ color:"var(--text-primary)" }}>{title}</span>
      </div>

      {/* Entries */}
      <div className="px-4 py-3">
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {[1,2,3].map((i) => (
              <div key={i} className="h-10 rounded-xl" style={{ background:"var(--surface-2)" }}/>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color:"var(--text-muted)" }}>
            لا توجد بيانات للفترة المحددة
          </p>
        ) : (
          <AnimatePresence initial={false}>
            <div className="space-y-1.5">
              {visible.map((entry) => {
                const medal = MEDAL[entry.rank];
                const isTop3 = entry.rank <= 3;
                return (
                  <motion.div
                    key={entry.uid}
                    initial={{ opacity:0, y:6 }}
                    animate={{ opacity:1, y:0 }}
                    transition={{ duration:0.22, ease:"easeOut" }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                    style={{
                      background: isTop3 ? `${medal?.color ?? accent}08` : "var(--surface-2)",
                      border:     `1px solid ${isTop3 ? (medal?.color ?? accent) + "20" : "transparent"}`,
                    }}>

                    {/* Rank */}
                    <div className="w-7 text-center shrink-0">
                      {medal
                        ? <span className="text-base">{medal.emoji}</span>
                        : <span className="text-xs font-black tabular-nums"
                            style={{ color:"var(--text-muted)" }}>#{entry.rank}</span>
                      }
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      {linkPrefix
                        ? <Link href={`${linkPrefix}/${entry.uid}`}
                            className="text-xs font-bold truncate hover:underline"
                            style={{ color:"var(--text-primary)" }}>
                            {entry.name}
                          </Link>
                        : <p className="text-xs font-bold truncate" style={{ color:"var(--text-primary)" }}>
                            {entry.name}
                          </p>
                      }
                      {subFormat && entry.subValue != null && (
                        <p className="text-[10px]" style={{ color:"var(--text-muted)" }}>
                          {subLabel} {subFormat(entry.subValue)}
                        </p>
                      )}
                    </div>

                    {/* Value */}
                    <span className="text-sm font-black tabular-nums shrink-0"
                      style={{ color: isTop3 ? medal?.color ?? accent : "var(--text-primary)" }}>
                      {format(entry.value)}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        )}
      </div>

      {/* Expand toggle */}
      {entries.length > PREVIEW && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 border-t
            text-[11px] font-semibold transition-colors hover:opacity-70"
          style={{ borderColor:"var(--border)", color:"var(--text-muted)" }}>
          {expanded
            ? <><ChevronUp size={12}/>إخفاء</>
            : <><ChevronDown size={12}/>عرض {entries.length - PREVIEW} أكثر</>}
        </button>
      )}
    </div>
  );
}
