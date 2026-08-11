"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore }  from "@/store/authStore";
import {
  useSubscriberNotesListener,
  useAddNote, useEditNote, useDeleteNote,
} from "@/hooks/useSubscriberNotes";
import { canViewInternalNotes, canAddInternalNotes } from "@/lib/permissionGuards";
import {
  NOTE_TYPE_LABELS, NOTE_TYPE_COLORS, NOTE_TYPE,
  type NoteType,
} from "@/constants/subscriberWorkflow";
import type { SubscriberNote } from "@/types";
import { StickyNote, Plus, Pencil, Trash2, X, Check } from "lucide-react";

// ─── Single note ──────────────────────────────────────────────────────────────

function NoteItem({
  note, currentUserId, onEdit, onDelete,
}: {
  note: SubscriberNote; currentUserId: string;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const isOwn  = note.authorId === currentUserId;
  const color  = NOTE_TYPE_COLORS[note.noteType];
  const ts     = note.createdAt
    ? new Date(typeof note.createdAt === "string" ? note.createdAt : (note.createdAt as { toDate?(): Date }).toDate?.()?.toISOString() ?? "")
        .toLocaleDateString("ar-SA", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })
    : "";

  return (
    <div className="rounded-xl p-3 mb-2"
      style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${color}18`, color }}>
            {NOTE_TYPE_LABELS[note.noteType]}
          </span>
          <span className="text-[10px] font-semibold" style={{ color: "var(--text-muted)" }}>
            {note.authorName} · {ts}
          </span>
        </div>
        {isOwn && !editing && (
          <div className="flex gap-1 shrink-0">
            <button onClick={() => setEditing(true)}
              className="p-1 rounded-lg opacity-50 hover:opacity-80 transition-opacity"
              style={{ color: "var(--text-secondary)" }}>
              <Pencil size={11}/>
            </button>
            <button onClick={() => onDelete(note.id)}
              className="p-1 rounded-lg opacity-50 hover:opacity-80 transition-opacity"
              style={{ color: "#EF4444" }}>
              <Trash2 size={11}/>
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div>
          <textarea value={content} onChange={(e) => setContent(e.target.value)}
            className="form-input w-full resize-none text-xs" rows={2} autoFocus/>
          <div className="flex gap-2 mt-1.5">
            <button onClick={() => { onEdit(note.id, content); setEditing(false); }}
              className="p-1 rounded-lg text-emerald-500 hover:opacity-80"><Check size={13}/></button>
            <button onClick={() => { setContent(note.content); setEditing(false); }}
              className="p-1 rounded-lg text-red-500 hover:opacity-80"><X size={13}/></button>
          </div>
        </div>
      ) : (
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-primary)" }}>{note.content}</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  subscriberId:   string;
  subscriberName: string;
  /** The subscriber's convincedByUid — stamped on new notes so the employee who
   *  owns the subscriber can read them. See subscriberNotes.service. */
  subscriberConvincedByUid?: string;
}

export default function NotesPanel({ subscriberId, subscriberName, subscriberConvincedByUid }: Props) {
  const { user }           = useAuthStore();
  const { notes, loading } = useSubscriberNotesListener(subscriberId);
  const addNote            = useAddNote(subscriberId, subscriberName, subscriberConvincedByUid);
  const editNote           = useEditNote(subscriberId, subscriberName);
  const deleteNote         = useDeleteNote(subscriberId, subscriberName);

  const [showForm, setShowForm] = useState(false);
  const [content, setContent]   = useState("");
  const [noteType, setNoteType] = useState<NoteType>(NOTE_TYPE.GENERAL);

  const canView = canViewInternalNotes(user) || user?.role === "owner" || user?.role === "admin";
  const canAdd  = canAddInternalNotes(user)  || user?.role === "owner" || user?.role === "admin";

  if (!canView) return null;

  async function handleAdd() {
    if (!content.trim()) return;
    try {
      await addNote.mutateAsync({ content, noteType });
      setContent(""); setShowForm(false);
    } catch { /* handled by hook */ }
  }

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2.5">
          <StickyNote size={15} style={{ color: "#F59E0B" }}/>
          <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            الملاحظات الداخلية
          </span>
          {notes.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "#F59E0B18", color: "#F59E0B" }}>
              {notes.length}
            </span>
          )}
        </div>
        {canAdd && (
          <button onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl text-white"
            style={{ background: showForm ? "#9ca3af" : "linear-gradient(135deg,#F59E0B,#F59E0B)" }}>
            {showForm ? <X size={12}/> : <Plus size={12}/>}
            {showForm ? "إلغاء" : "إضافة"}
          </button>
        )}
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
            exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }}
            className="border-b overflow-hidden" style={{ borderColor: "var(--border)" }}
          >
            <div className="px-5 py-4 space-y-3">
              {/* Note type selector */}
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(NOTE_TYPE_LABELS) as NoteType[]).map((t) => (
                  <button key={t} onClick={() => setNoteType(t)}
                    className="px-2.5 py-1 rounded-full text-[10px] font-bold transition-all"
                    style={{
                      background: noteType === t ? `${NOTE_TYPE_COLORS[t]}20` : "var(--surface-2)",
                      color:      noteType === t ? NOTE_TYPE_COLORS[t] : "var(--text-muted)",
                      border:     `1px solid ${noteType === t ? NOTE_TYPE_COLORS[t] + "40" : "var(--border)"}`,
                    }}>
                    {NOTE_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>

              <textarea value={content} onChange={(e) => setContent(e.target.value)}
                className="form-input w-full resize-none text-sm" rows={3}
                placeholder="اكتب ملاحظتك هنا..." autoFocus/>

              <div className="flex gap-2">
                <button onClick={handleAdd} disabled={!content.trim() || addNote.isPending}
                  className="flex-1 py-2 rounded-xl text-white font-bold text-xs disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#F59E0B,#F59E0B)" }}>
                  {addNote.isPending ? "جاري..." : "إضافة الملاحظة"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes list */}
      <div className="px-5 py-4">
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1,2].map((i) => (
              <div key={i} className="h-14 rounded-xl" style={{ background: "var(--surface-2)" }}/>
            ))}
          </div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>
            لا توجد ملاحظات بعد
          </p>
        ) : (
          notes.map((note) => (
            <NoteItem
              key={note.id} note={note}
              currentUserId={user?.uid ?? ""}
              onEdit={(id, content) => editNote.mutate({ noteId: id, content })}
              onDelete={(id) => deleteNote.mutate(id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
