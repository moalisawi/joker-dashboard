"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@heroui/react";
import { MoreVertical, Paperclip, Send, Sparkles } from "lucide-react";
import { ConversationStatus, type CannedResponse, type WhatsappLead, type WhatsappMessage } from "@/types/whatsapp-lead";

interface Props {
  lead: WhatsappLead | null;
  messages: WhatsappMessage[];
  loading: boolean;
  sending: boolean;
  cannedResponses: CannedResponse[];
  onSend: (body: string, isInternalNote: boolean) => void;
  onStatusChange: (status: ConversationStatus) => void;
  t: Record<string, string>;
}

function formatDateSeparator(date: Date): string {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d     = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff  = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "اليوم";
  if (diff === 1) return "أمس";
  return date.toLocaleDateString("ar-SA", { day: "numeric", month: "long", year: "numeric" });
}

function ReadIcon({ status }: { status: WhatsappMessage["status"] }) {
  if (status === "sent")      return <span style={{ color: "#94A3B8", fontSize: 11 }}>✓</span>;
  if (status === "delivered") return <span style={{ color: "#94A3B8", fontSize: 11 }}>✓✓</span>;
  return <span style={{ color: "#53BDEB", fontSize: 11 }}>✓✓</span>;
}

function groupByDay(msgs: WhatsappMessage[]): { date: Date; messages: WhatsappMessage[] }[] {
  const map = new Map<string, { date: Date; messages: WhatsappMessage[] }>();
  for (const m of msgs) {
    const d   = m.timestamp.toDate();
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!map.has(key)) map.set(key, { date: d, messages: [] });
    map.get(key)!.messages.push(m);
  }
  return Array.from(map.values());
}

const STATUS_META: Record<ConversationStatus, { label: string; bg: string; color: string }> = {
  [ConversationStatus.OPEN]:     { label: "مفتوحة",  bg: "rgba(37,211,102,.15)",  color: "#25D366" },
  [ConversationStatus.CLOSED]:   { label: "مغلقة",   bg: "rgba(100,116,139,.15)", color: "#64748B" },
  [ConversationStatus.ARCHIVED]: { label: "مؤرشفة",  bg: "rgba(245,158,11,.15)",  color: "#E8B570" },
};

export default function ChatPane({
  lead,
  messages,
  loading,
  sending,
  cannedResponses,
  onSend,
  onStatusChange,
  t,
}: Props) {
  const [text, setText]             = useState("");
  const [isNote, setIsNote]         = useState(false);
  const [menuOpen, setMenuOpen]     = useState(false);
  const [cannedOpen, setCannedOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const body = text.trim();
    if (!body || sending) return;
    onSend(body, isNote);
    setText("");
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!lead) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: t.textMut }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>💬</div>
        <div style={{ fontSize: 15, fontWeight: 500 }}>اختر محادثة لعرضها</div>
      </div>
    );
  }

  const groups = groupByDay(messages);
  const convSt = lead.conversationStatus ?? ConversationStatus.OPEN;
  const stMeta = STATUS_META[convSt];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: t.bg }}>
      {/* Header */}
      <div style={{
        padding: "12px 20px",
        borderBottom: `1px solid ${t.divider}`,
        background: t.card,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.textPri }}>{lead.name ?? lead.phone}</div>
          <div style={{ fontSize: 12, color: t.textSec, direction: "ltr", textAlign: "right" }}>
            {lead.countryCode} {lead.phone.slice(lead.countryCode.replace("+", "").length)}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
            background: stMeta.bg, color: stMeta.color,
          }}>
            {stMeta.label}
          </span>

          {/* Three-dot menu */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              style={{
                width: 32, height: 32, borderRadius: "50%", border: "none",
                background: "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: t.textSec,
              }}
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 90 }} onClick={() => setMenuOpen(false)} />
                <div style={{
                  position: "absolute", top: 36, insetInlineEnd: 0, zIndex: 100,
                  background: t.card, border: `1px solid ${t.divider}`,
                  borderRadius: 10, padding: "4px 0", minWidth: 160,
                  boxShadow: "0 4px 20px rgba(0,0,0,.12)",
                }}>
                  {([
                    { label: "إغلاق المحادثة",  status: ConversationStatus.CLOSED },
                    { label: "أرشفة",            status: ConversationStatus.ARCHIVED },
                    { label: "إعادة فتح",        status: ConversationStatus.OPEN },
                  ] as { label: string; status: ConversationStatus }[]).map((item) => (
                    <button
                      key={item.label}
                      onClick={() => { onStatusChange(item.status); setMenuOpen(false); }}
                      style={{
                        width: "100%", padding: "9px 16px", border: "none",
                        background: "transparent", cursor: "pointer",
                        textAlign: "right", fontFamily: "inherit",
                        fontSize: 13, color: t.textPri,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = t.headerBg; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  height: 48, borderRadius: 12,
                  width: i % 2 === 0 ? "55%" : "45%",
                  alignSelf: i % 2 === 0 ? "flex-end" : "flex-start",
                  background: `${t.divider}`,
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
            ))}
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.date.toISOString()}>
              {/* Date separator */}
              <div style={{ textAlign: "center", margin: "12px 0" }}>
                <span style={{
                  fontSize: 11, color: t.textMut, background: t.bg,
                  padding: "2px 12px", borderRadius: 999,
                  border: `1px solid ${t.divider}`,
                }}>
                  {formatDateSeparator(group.date)}
                </span>
              </div>

              {group.messages.map((msg) => {
                if (msg.isInternalNote) {
                  return (
                    <div key={msg.id} style={{ margin: "8px 0" }}>
                      <div style={{
                        background: "rgba(245,158,11,.12)",
                        border: "1px solid rgba(245,158,11,.3)",
                        borderRadius: 10, padding: "8px 14px",
                      }}>
                        <div style={{ fontSize: 10, color: "#E8B570", fontWeight: 600, marginBottom: 4 }}>ملاحظة داخلية</div>
                        <div style={{ fontSize: 13, color: t.textPri, fontStyle: "italic" }}>{msg.body}</div>
                        <div style={{ fontSize: 10, color: t.textMut, marginTop: 4 }}>
                          {msg.timestamp.toDate().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                }

                const isOut = msg.direction === "outbound";
                return (
                  <div key={msg.id} style={{ display: "flex", justifyContent: isOut ? "flex-start" : "flex-end", marginBottom: 6 }}>
                    <div style={{
                      maxWidth: "70%",
                      background: isOut ? "#25D366" : t.inboundBubble,
                      color: isOut ? "#fff" : t.textPri,
                      borderRadius: isOut ? "12px 12px 12px 2px" : "12px 12px 2px 12px",
                      padding: "8px 12px",
                    }}>
                      {msg.attachmentType === "image" && msg.attachmentUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={msg.attachmentUrl}
                          alt="مرفق"
                          style={{ width: "100%", maxWidth: 260, borderRadius: 8, marginBottom: 6, display: "block" }}
                        />
                      )}
                      <div style={{ fontSize: 13, lineHeight: 1.5, wordBreak: "break-word" }}>{msg.body}</div>
                      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 3 }}>
                        <span style={{ fontSize: 10, color: isOut ? "rgba(255,255,255,.7)" : t.textMut }}>
                          {msg.timestamp.toDate().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {isOut && <ReadIcon status={msg.status} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{ borderTop: `1px solid ${t.divider}`, padding: "12px 16px", background: t.card, flexShrink: 0 }}>
        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          {/* Canned responses */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setCannedOpen((o) => !o)}
              style={{
                width: 30, height: 30, borderRadius: 8, border: `1px solid ${t.divider}`,
                background: "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: cannedOpen ? "#25D366" : t.textSec,
              }}
              title="ردود جاهزة"
            >
              <Sparkles size={14} />
            </button>
            {cannedOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 90 }} onClick={() => setCannedOpen(false)} />
                <div style={{
                  position: "absolute", bottom: 38, insetInlineStart: 0, zIndex: 100,
                  background: t.card, border: `1px solid ${t.divider}`,
                  borderRadius: 10, minWidth: 280, maxHeight: 320,
                  overflowY: "auto", boxShadow: "0 4px 20px rgba(0,0,0,.12)",
                }}>
                  <div style={{ padding: "8px 12px", fontSize: 11, color: t.textMut, fontWeight: 600, borderBottom: `1px solid ${t.divider}` }}>
                    ردود جاهزة
                  </div>
                  {cannedResponses.map((cr) => (
                    <button
                      key={cr.id}
                      onClick={() => { setText(cr.body); setCannedOpen(false); }}
                      style={{
                        width: "100%", padding: "8px 12px", border: "none",
                        background: "transparent", cursor: "pointer",
                        textAlign: "right", fontFamily: "inherit",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = t.headerBg; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.textPri }}>{cr.title}</div>
                      <div style={{ fontSize: 11, color: t.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cr.body.slice(0, 60)}...</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Attach */}
          <button
            onClick={() => alert("قريباً")}
            style={{
              width: 30, height: 30, borderRadius: 8, border: `1px solid ${t.divider}`,
              background: "transparent", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: t.textSec,
            }}
            title="إرفاق ملف"
          >
            <Paperclip size={14} />
          </button>

          {/* Internal note toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginInlineStart: "auto" }}>
            <input
              type="checkbox"
              checked={isNote}
              onChange={(e) => setIsNote(e.target.checked)}
              style={{ cursor: "pointer", accentColor: "#E8B570" }}
            />
            <span style={{ fontSize: 12, color: isNote ? "#E8B570" : t.textSec, fontWeight: isNote ? 600 : 400 }}>
              ملاحظة داخلية
            </span>
          </label>
        </div>

        {/* Textarea + Send */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder={isNote ? "اكتب ملاحظة داخلية..." : "اكتب رسالة..."}
            rows={2}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 10,
              border: `1px solid ${isNote ? "rgba(245,158,11,.5)" : t.divider}`,
              background: isNote ? "rgba(245,158,11,.07)" : t.bg,
              color: t.textPri,
              fontFamily: "inherit",
              fontSize: 13,
              resize: "none",
              outline: "none",
              lineHeight: 1.5,
              maxHeight: 100,
              overflowY: "auto",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            style={{
              width: 40, height: 40, borderRadius: 10, border: "none",
              background: text.trim() && !sending ? "#25D366" : t.divider,
              color: "#fff", cursor: text.trim() && !sending ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, transition: "background .15s",
            }}
          >
            {sending ? <Spinner size="sm" /> : <Send size={16} style={{ transform: "scaleX(-1)" }} />}
          </button>
        </div>
        {sending && (
          <div style={{ fontSize: 11, color: t.textMut, marginTop: 4 }}>جاري الإرسال...</div>
        )}
      </div>
    </div>
  );
}
