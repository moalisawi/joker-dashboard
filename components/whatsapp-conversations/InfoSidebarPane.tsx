"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, ChevronUp, Copy, Plus, Trash2, X } from "lucide-react";
import {
  COMMON_TAGS,
  LeadStatus,
  type LeadNote,
  type LeadTag,
  type WhatsappLead,
} from "@/types/whatsapp-lead";

const STAFF = [
  { uid: "uid_meedo",  name: "محمد" },
  { uid: "uid_hanan",  name: "حنان" },
  { uid: "uid_miyar",  name: "مي ار" },
];

const FLAGS: Record<string, string> = {
  SA: "🇸🇦", EG: "🇪🇬", JO: "🇯🇴", AE: "🇦🇪", KW: "🇰🇼",
  "PS-WB": "🇵🇸", "PS-GZ": "🇵🇸",
};

const COUNTRY_LABELS: Record<string, string> = {
  SA: "السعودية", EG: "مصر", JO: "الأردن", AE: "الإمارات",
  KW: "الكويت", "PS-WB": "فلسطين (الضفة)", "PS-GZ": "فلسطين (غزة)",
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  [LeadStatus.INTERESTED]:          "مهتم",
  [LeadStatus.READY_TO_PAY]:        "جاهز للدفع",
  [LeadStatus.IMPORTANT_FOLLOW_UP]: "متابعة هامة",
  [LeadStatus.NEW]:                 "جديد",
  [LeadStatus.RETARGETING]:         "إعادة استهداف",
};

const noteSchema = z.object({ body: z.string().min(2, "الملاحظة قصيرة جداً") });
type NoteForm = z.infer<typeof noteSchema>;

interface Props {
  lead: WhatsappLead | null;
  history: WhatsappLead[];
  historyLoading: boolean;
  onStatusChange: (status: LeadStatus) => void;
  onAssign: (uid: string | null) => void;
  onAddNote: (body: string) => void;
  onRemoveNote: (noteId: string) => void;
  onAddTag: (tag: LeadTag) => void;
  onRemoveTag: (tag: LeadTag) => void;
  t: Record<string, string>;
}

function InfoRow({ label, value, t }: { label: string; value: React.ReactNode; t: Record<string, string> }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, fontSize: 12 }}>
      <span style={{ color: t.textMut }}>{label}</span>
      <span style={{ color: t.textPri, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {title}
    </div>
  );
}

export default function InfoSidebarPane({
  lead,
  history,
  historyLoading,
  onStatusChange,
  onAssign,
  onAddNote,
  onRemoveNote,
  onAddTag,
  onRemoveTag,
  t,
}: Props) {
  const [addNoteOpen, setAddNoteOpen]   = useState(false);
  const [historyOpen, setHistoryOpen]   = useState(false);
  const [tagPopOpen, setTagPopOpen]     = useState(false);
  const [customTag, setCustomTag]       = useState("");
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<NoteForm>({
    resolver: zodResolver(noteSchema),
  });

  function submitNote(data: NoteForm) {
    onAddNote(data.body);
    reset();
    setAddNoteOpen(false);
  }

  if (!lead) return null;

  const notes = lead.notes  ?? [];
  const tags  = lead.tags   ?? [];

  const sectionStyle: React.CSSProperties = {
    padding: "14px 16px",
    borderBottom: `1px solid ${t.divider}`,
  };

  return (
    <div style={{
      width: 280,
      flexShrink: 0,
      borderInlineEnd: `1px solid ${t.divider}`,
      overflowY: "auto",
      background: t.card,
      direction: "rtl",
    }}>
      {/* Lead avatar + name */}
      <div style={{ padding: "20px 16px 14px", borderBottom: `1px solid ${t.divider}`, textAlign: "center" }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "#10141A", color: "#fff",
          fontSize: 22, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 10px",
        }}>
          {(lead.name?.[0] ?? lead.phone[0]).toUpperCase()}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.textPri }}>{lead.name ?? lead.phone}</div>
        <div style={{ fontSize: 12, color: t.textSec, marginTop: 2 }}>{FLAGS[lead.country]} {COUNTRY_LABELS[lead.country]}</div>
      </div>

      {/* Lead info */}
      <div style={sectionStyle}>
        <SectionTitle title="معلومات الليد" />
        <InfoRow label="الهاتف" value={
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ direction: "ltr", fontSize: 12 }}>
              {lead.countryCode} {lead.phone.slice(lead.countryCode.replace("+", "").length)}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(lead.phone)}
              style={{ border: "none", background: "transparent", cursor: "pointer", padding: 2, color: t.textMut }}
              title="نسخ"
            >
              <Copy size={12} />
            </button>
          </div>
        } t={t} />
        <InfoRow label="أول تواصل" value={
          lead.firstMessageAt.toDate().toLocaleDateString("ar-SA", { day: "numeric", month: "short", year: "numeric" })
        } t={t} />
        <InfoRow label="آخر نشاط" value={
          lead.lastMessageAt.toDate().toLocaleDateString("ar-SA", { day: "numeric", month: "short", year: "numeric" })
        } t={t} />
      </div>

      {/* Status & Assignment */}
      <div style={sectionStyle}>
        <SectionTitle title="الحالة والتعيين" />
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: t.textMut, marginBottom: 4 }}>حالة الليد</div>
          <select
            value={lead.status}
            onChange={(e) => onStatusChange(e.target.value as LeadStatus)}
            style={{
              width: "100%", padding: "6px 10px", borderRadius: 8,
              border: `1px solid ${t.divider}`, background: t.card,
              color: t.textPri, fontFamily: "inherit", fontSize: 13, cursor: "pointer",
            }}
          >
            {Object.values(LeadStatus).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: t.textMut, marginBottom: 4 }}>المعيّن</div>
          <select
            value={lead.assignedTo ?? ""}
            onChange={(e) => onAssign(e.target.value || null)}
            style={{
              width: "100%", padding: "6px 10px", borderRadius: 8,
              border: `1px solid ${t.divider}`, background: t.card,
              color: t.textPri, fontFamily: "inherit", fontSize: 13, cursor: "pointer",
            }}
          >
            <option value="">غير معيّن</option>
            {STAFF.map((s) => (
              <option key={s.uid} value={s.uid}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tags */}
      <div style={sectionStyle}>
        <SectionTitle title="التاجز" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {tags.map((tag) => (
            <span key={tag} style={{
              display: "flex", alignItems: "center", gap: 4,
              background: "rgba(16,20,26,.08)", borderRadius: 999,
              padding: "3px 8px", fontSize: 11, color: t.textPri,
            }}>
              {tag}
              <button
                onClick={() => onRemoveTag(tag)}
                style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, lineHeight: 1, color: t.textMut }}
              >
                <X size={10} />
              </button>
            </span>
          ))}

          {/* Tag popover trigger */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setTagPopOpen((o) => !o)}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                border: `1px dashed ${t.divider}`, borderRadius: 999,
                padding: "3px 8px", fontSize: 11, color: t.textSec,
                background: "transparent", cursor: "pointer",
              }}
            >
              <Plus size={10} /> إضافة تاج
            </button>
            {tagPopOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 90 }} onClick={() => setTagPopOpen(false)} />
                <div style={{
                  position: "absolute", top: 30, insetInlineStart: 0, zIndex: 100,
                  background: t.card, border: `1px solid ${t.divider}`,
                  borderRadius: 10, padding: 12, minWidth: 200,
                  boxShadow: "0 4px 20px rgba(0,0,0,.12)",
                }}>
                  <div style={{ fontSize: 11, color: t.textMut, marginBottom: 8 }}>اختر أو أضف</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {COMMON_TAGS.filter((ct) => !tags.includes(ct)).map((ct) => (
                      <button
                        key={ct}
                        onClick={() => { onAddTag(ct); setTagPopOpen(false); }}
                        style={{
                          fontSize: 11, padding: "3px 8px", borderRadius: 999,
                          border: `1px solid ${t.divider}`, background: "transparent",
                          cursor: "pointer", color: t.textPri, fontFamily: "inherit",
                        }}
                      >
                        {ct}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      value={customTag}
                      onChange={(e) => setCustomTag(e.target.value)}
                      placeholder="تاج مخصص..."
                      style={{
                        flex: 1, padding: "5px 8px", borderRadius: 6,
                        border: `1px solid ${t.divider}`, fontSize: 12,
                        fontFamily: "inherit", background: t.bg, color: t.textPri, outline: "none",
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customTag.trim()) {
                          onAddTag(customTag.trim());
                          setCustomTag("");
                          setTagPopOpen(false);
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        if (customTag.trim()) {
                          onAddTag(customTag.trim());
                          setCustomTag("");
                          setTagPopOpen(false);
                        }
                      }}
                      style={{
                        padding: "5px 10px", borderRadius: 6, border: "none",
                        background: "#10141A", color: "#fff", cursor: "pointer",
                        fontSize: 12, fontFamily: "inherit",
                      }}
                    >
                      إضافة
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Internal notes */}
      <div style={sectionStyle}>
        <SectionTitle title="الملاحظات الداخلية" />
        {notes.length === 0 && !addNoteOpen && (
          <div style={{ fontSize: 12, color: t.textMut, marginBottom: 10 }}>لا توجد ملاحظات</div>
        )}

        {notes.map((note: LeadNote) => (
          <div key={note.id} style={{
            background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)",
            borderRadius: 8, padding: "8px 10px", marginBottom: 8,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#F59E0B" }}>{note.authorName}</span>
              <span style={{ fontSize: 10, color: t.textMut }}>
                {note.createdAt.toDate().toLocaleDateString("ar-SA", { month: "short", day: "numeric" })}
              </span>
            </div>
            <div style={{ fontSize: 12, color: t.textPri, lineHeight: 1.5 }}>{note.body}</div>
            {noteToDelete === note.id ? (
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button
                  onClick={() => { onRemoveNote(note.id); setNoteToDelete(null); }}
                  style={{
                    fontSize: 11, padding: "3px 8px", borderRadius: 6, border: "none",
                    background: "#EF4444", color: "#fff", cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  تأكيد الحذف
                </button>
                <button
                  onClick={() => setNoteToDelete(null)}
                  style={{
                    fontSize: 11, padding: "3px 8px", borderRadius: 6,
                    border: `1px solid ${t.divider}`, background: "transparent",
                    cursor: "pointer", fontFamily: "inherit", color: t.textSec,
                  }}
                >
                  إلغاء
                </button>
              </div>
            ) : (
              <button
                onClick={() => setNoteToDelete(note.id)}
                style={{ marginTop: 4, border: "none", background: "transparent", cursor: "pointer", color: t.textMut, padding: 0 }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}

        {addNoteOpen ? (
          <form onSubmit={handleSubmit(submitNote)}>
            <textarea
              {...register("body")}
              rows={3}
              placeholder="اكتب ملاحظة..."
              style={{
                width: "100%", padding: "8px 10px", borderRadius: 8,
                border: `1px solid ${t.divider}`, fontFamily: "inherit",
                fontSize: 12, resize: "vertical", background: t.bg, color: t.textPri,
                boxSizing: "border-box", outline: "none",
              }}
            />
            {errors.body && (
              <div style={{ fontSize: 11, color: "#EF4444", marginTop: 2 }}>{errors.body.message}</div>
            )}
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button
                type="submit"
                style={{
                  fontSize: 12, padding: "5px 12px", borderRadius: 6, border: "none",
                  background: "#10141A", color: "#fff", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                حفظ
              </button>
              <button
                type="button"
                onClick={() => { setAddNoteOpen(false); reset(); }}
                style={{
                  fontSize: 12, padding: "5px 12px", borderRadius: 6,
                  border: `1px solid ${t.divider}`, background: "transparent",
                  cursor: "pointer", fontFamily: "inherit", color: t.textSec,
                }}
              >
                إلغاء
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAddNoteOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, padding: "6px 0", border: "none",
              background: "transparent", cursor: "pointer",
              color: t.textSec, fontFamily: "inherit",
            }}
          >
            <Plus size={12} /> إضافة ملاحظة
          </button>
        )}
      </div>

      {/* Conversation history (collapsible) */}
      <div style={{ padding: "10px 16px" }}>
        <button
          onClick={() => setHistoryOpen((o) => !o)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            width: "100%", border: "none", background: "transparent", cursor: "pointer",
            fontSize: 11, fontWeight: 700, color: t.textMut, fontFamily: "inherit",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}
        >
          المحادثات السابقة
          {historyOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {historyOpen && (
          <div style={{ marginTop: 10 }}>
            {historyLoading ? (
              <div style={{ height: 40, borderRadius: 8, background: t.divider }} />
            ) : history.length === 0 ? (
              <div style={{ fontSize: 12, color: t.textMut }}>لا توجد محادثات سابقة</div>
            ) : (
              history.map((h) => (
                <div key={h.id} style={{
                  padding: "8px 10px", borderRadius: 8,
                  border: `1px solid ${t.divider}`, marginBottom: 6,
                  fontSize: 12, color: t.textSec,
                }}>
                  <div style={{ fontWeight: 600, color: t.textPri }}>
                    {h.firstMessageAt.toDate().toLocaleDateString("ar-SA", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                  <div style={{ marginTop: 2, color: t.textMut, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {h.lastMessagePreview}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
