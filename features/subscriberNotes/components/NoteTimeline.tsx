"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Edit2, Check, X, MessageSquare } from "lucide-react";
import { useAuthStore }  from "@/store/authStore";
import { useSubscriberNotes } from "@/features/subscriberNotes/hooks/useSubscriberNotes";
import { useEditNote, useDeleteNote } from "@/features/subscriberNotes/hooks/useNoteMutations";
import { NOTE_TYPE_LABELS, NOTE_TYPE_COLORS } from "@/constants/subscriberWorkflow";
import type { SubscriberNote } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(ts: unknown): string {
  if (!ts) return "";
  const d = typeof ts === "object" && "toDate" in (ts as object)
    ? (ts as { toDate: () => Date }).toDate()
    : new Date(ts as string);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `منذ ${days} يوم`;
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

// ─── Single Note ──────────────────────────────────────────────────────────────

function NoteItem({
  note,
  subscriberName,
  canDelete,
}: {
  note: SubscriberNote;
  subscriberName: string;
  canDelete: boolean;
}) {
  const editNote   = useEditNote();
  const deleteNote = useDeleteNote();
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(note.content);

  const color = NOTE_TYPE_COLORS[note.noteType] ?? "#64748b";

  async function handleSave() {
    if (!draft.trim()) return;
    await editNote.mutateAsync({
      noteId:         note.id,
      subscriberId:   note.subscriberId,
      subscriberName,
      newContent:     draft,
    });
    setEditing(false);
  }

  async function handleDelete() {
    await deleteNote.mutateAsync({
      noteId:         note.id,
      subscriberId:   note.subscriberId,
      subscriberName,
    });
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="flex gap-3"
    >
      {/* Timeline dot */}
      <div className="flex flex-col items-center pt-1 flex-shrink-0">
        <div className="h-2.5 w-2.5 rounded-full ring-2 ring-offset-2"
          style={{ background: color }}/>
        <div className="flex-1 w-px mt-1" style={{ background: "var(--border)" }}/>
      </div>

      {/* Body */}
      <div className="flex-1 pb-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
              {note.authorName}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: `${color}18`, color }}>
              {NOTE_TYPE_LABELS[note.noteType]}
            </span>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {formatRelative(note.createdAt)}
            </span>
          </div>

          {canDelete && !editing && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => { setDraft(note.content); setEditing(true); }}
                className="p-1 rounded-lg transition-colors"
                style={{ color: "var(--text-muted)" }}
                title="تعديل">
                <Edit2 size={12}/>
              </button>
              <button onClick={handleDelete}
                disabled={deleteNote.isPending}
                className="p-1 rounded-lg transition-colors disabled:opacity-40"
                style={{ color: "#CE6969" }}
                title="حذف">
                <Trash2 size={12}/>
              </button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="form-input w-full text-sm resize-none"
            />
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={editNote.isPending}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
                style={{ background: "#83A2DB" }}>
                <Check size={11}/> حفظ
              </button>
              <button onClick={() => setEditing(false)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                <X size={11}/> إلغاء
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap leading-relaxed"
            style={{ color: "var(--text-secondary)" }}>
            {note.content}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

interface Props {
  subscriberId:   string;
  subscriberName: string;
}

export default function NoteTimeline({ subscriberId, subscriberName }: Props) {
  const user   = useAuthStore((s) => s.user);
  const { data: notes = [], isLoading } = useSubscriberNotes(subscriberId);

  if (isLoading) {
    return (
      <div className="space-y-3 py-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-xl animate-pulse"
            style={{ background: "var(--surface-2)" }}/>
        ))}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center"
          style={{ background: "var(--surface-2)" }}>
          <MessageSquare size={18} style={{ color: "var(--text-muted)" }}/>
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>لا توجد ملاحظات بعد</p>
      </div>
    );
  }

  return (
    <div className="space-y-0 py-2">
      <AnimatePresence>
        {notes.map((note) => (
          <NoteItem
            key={note.id}
            note={note}
            subscriberName={subscriberName}
            canDelete={user?.uid === note.authorId || user?.role === "owner"}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
