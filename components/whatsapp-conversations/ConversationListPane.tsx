"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ConversationStatus, type WhatsappLead } from "@/types/whatsapp-lead";

interface Props {
  leads: WhatsappLead[];
  selectedId: string | null;
  onSelect: (lead: WhatsappLead) => void;
  t: Record<string, string>;
}

type Filter = "all" | "unread" | "مفتوحة" | "مغلقة" | "مؤرشفة";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",    label: "الكل" },
  { key: "unread", label: "غير مقروءة" },
  { key: ConversationStatus.OPEN,     label: "مفتوحة" },
  { key: ConversationStatus.CLOSED,   label: "مغلقة" },
  { key: ConversationStatus.ARCHIVED, label: "مؤرشفة" },
];

const FLAGS: Record<string, string> = {
  SA: "🇸🇦", EG: "🇪🇬", JO: "🇯🇴", AE: "🇦🇪", KW: "🇰🇼",
  "PS-WB": "🇵🇸", "PS-GZ": "🇵🇸",
};

function relativeTime(d: Date): string {
  const now   = Date.now();
  const diff  = now - d.getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return "الآن";
  if (mins < 60)  return `${mins}د`;
  if (hours < 24) return `${hours}س`;
  if (days < 7)   return `${days}ي`;
  return d.toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
}

function statusDot(status: ConversationStatus | undefined) {
  if (status === ConversationStatus.CLOSED)   return { bg: "#94A3B8", label: "مغلقة" };
  if (status === ConversationStatus.ARCHIVED) return { bg: "#E8B570", label: "مؤرشفة" };
  return { bg: "#25D366", label: "مفتوحة" };
}

export default function ConversationListPane({ leads, selectedId, onSelect, t }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const totalUnread = leads.reduce((s, l) => s + (l.unreadCount ?? 0), 0);

  const filtered = useMemo(() => {
    let list = leads;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (l) =>
          l.name?.toLowerCase().includes(q) ||
          l.phone.includes(q),
      );
    }
    if (filter === "unread") list = list.filter((l) => (l.unreadCount ?? 0) > 0);
    else if (filter !== "all") list = list.filter((l) => (l.conversationStatus ?? ConversationStatus.OPEN) === filter);
    return list;
  }, [leads, search, filter]);

  return (
    <div
      style={{
        width: 300,
        flexShrink: 0,
        borderInlineStart: `1px solid ${t.divider}`,
        display: "flex",
        flexDirection: "column",
        background: t.card,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px 16px 12px", borderBottom: `1px solid ${t.divider}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: t.textPri }}>المحادثات</span>
          {totalUnread > 0 && (
            <span style={{
              background: "#25D366", color: "#fff",
              borderRadius: 999, fontSize: 11, fontWeight: 700,
              padding: "1px 7px", lineHeight: "18px",
            }}>{totalUnread}</span>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", top: "50%", insetInlineEnd: 10, transform: "translateY(-50%)", color: t.textMut, pointerEvents: "none" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم أو الرقم..."
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "6px 32px 6px 10px", borderRadius: 8,
              border: `1px solid ${t.divider}`, background: t.bg,
              color: t.textPri, fontFamily: "inherit", fontSize: 12,
              outline: "none",
            }}
          />
        </div>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all .15s",
                background: filter === f.key ? "#10141A" : `${t.divider}`,
                color: filter === f.key ? "#fff" : t.textSec,
                fontWeight: filter === f.key ? 600 : 400,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: t.textMut, fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
            لا توجد محادثات مطابقة
          </div>
        ) : (
          filtered.map((lead) => {
            const active = lead.id === selectedId;
            const dot    = statusDot(lead.conversationStatus);
            const name   = lead.name ?? lead.phone;
            const letter = (lead.name?.[0] ?? lead.phone[0]).toUpperCase();

            return (
              <button
                key={lead.id}
                onClick={() => onSelect(lead)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  textAlign: "right",
                  fontFamily: "inherit",
                  transition: "background .12s",
                  background: active ? "rgba(37,211,102,.1)" : "transparent",
                  borderInlineStart: active ? "3px solid #25D366" : "3px solid transparent",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = t.headerBg;
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                  background: "#10141A", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 15, fontWeight: 700,
                }}>
                  {letter}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: t.textPri, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>
                      {name}
                    </span>
                    <span style={{ fontSize: 11, color: t.textMut, flexShrink: 0, marginInlineStart: 4 }}>
                      {relativeTime(lead.lastMessageAt.toDate())}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: t.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
                    {lead.lastMessagePreview}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot.bg, display: "inline-block" }} />
                      <span style={{ fontSize: 10, color: t.textMut }}>{dot.label}</span>
                      <span style={{ fontSize: 11 }}>{FLAGS[lead.country] ?? ""}</span>
                    </div>
                    {(lead.unreadCount ?? 0) > 0 && (
                      <span style={{
                        background: "#25D366", color: "#fff",
                        borderRadius: "50%", width: 18, height: 18,
                        fontSize: 10, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {lead.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
