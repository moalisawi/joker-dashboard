"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore }          from "@/store/authStore";
import { subscriberNotesService } from "@/services/subscriberNotes.service";
import { noteKeys }              from "@/features/subscriberNotes/hooks/queryKeys";
import type { SubscriberNote }   from "@/types";
import type { NoteType }         from "@/constants/subscriberWorkflow";
import { serverTimestamp }       from "firebase/firestore";

// ─── Add note ─────────────────────────────────────────────────────────────────

interface AddNoteVars {
  subscriberId:   string;
  subscriberName: string;
  content:        string;
  noteType:       NoteType;
}

export function useAddNote() {
  const qc   = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: ({ subscriberId, subscriberName, content, noteType }: AddNoteVars) => {
      if (!user) throw new Error("Not authenticated");
      return subscriberNotesService.add(user, subscriberId, subscriberName, content, noteType);
    },
    // Optimistic insert
    onMutate: async ({ subscriberId, subscriberName, content, noteType }) => {
      if (!user) return;
      await qc.cancelQueries({ queryKey: noteKeys.bySubscriber(subscriberId) });
      const prev = qc.getQueryData<SubscriberNote[]>(noteKeys.bySubscriber(subscriberId));

      const optimistic: SubscriberNote = {
        id:             `__optimistic__${Date.now()}`,
        subscriberId,
        subscriberName,
        authorId:       user.uid,
        authorName:     user.name,
        content,
        noteType,
        deleted:        false,
        createdAt:      serverTimestamp() as never,
        updatedAt:      serverTimestamp() as never,
      };

      qc.setQueryData<SubscriberNote[]>(noteKeys.bySubscriber(subscriberId), (old = []) => [
        optimistic,
        ...old,
      ]);

      return { prev, subscriberId };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(noteKeys.bySubscriber(ctx.subscriberId), ctx.prev);
      }
    },
    onSettled: (_data, _err, { subscriberId }) => {
      qc.invalidateQueries({ queryKey: noteKeys.bySubscriber(subscriberId) });
    },
  });
}

// ─── Edit note ────────────────────────────────────────────────────────────────

interface EditNoteVars {
  noteId:         string;
  subscriberId:   string;
  subscriberName: string;
  newContent:     string;
}

export function useEditNote() {
  const qc   = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: ({ noteId, subscriberId, subscriberName, newContent }: EditNoteVars) => {
      if (!user) throw new Error("Not authenticated");
      return subscriberNotesService.edit(user, noteId, subscriberId, subscriberName, newContent);
    },
    onSettled: (_data, _err, { subscriberId }) => {
      qc.invalidateQueries({ queryKey: noteKeys.bySubscriber(subscriberId) });
    },
  });
}

// ─── Delete note ──────────────────────────────────────────────────────────────

interface DeleteNoteVars {
  noteId:         string;
  subscriberId:   string;
  subscriberName: string;
}

export function useDeleteNote() {
  const qc   = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: ({ noteId, subscriberId, subscriberName }: DeleteNoteVars) => {
      if (!user) throw new Error("Not authenticated");
      return subscriberNotesService.delete(user, noteId, subscriberId, subscriberName);
    },
    onMutate: async ({ noteId, subscriberId }) => {
      await qc.cancelQueries({ queryKey: noteKeys.bySubscriber(subscriberId) });
      const prev = qc.getQueryData<SubscriberNote[]>(noteKeys.bySubscriber(subscriberId));
      qc.setQueryData<SubscriberNote[]>(noteKeys.bySubscriber(subscriberId), (old = []) =>
        old.filter((n) => n.id !== noteId)
      );
      return { prev, subscriberId };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        qc.setQueryData(noteKeys.bySubscriber(ctx.subscriberId), ctx.prev);
      }
    },
    onSettled: (_data, _err, { subscriberId }) => {
      qc.invalidateQueries({ queryKey: noteKeys.bySubscriber(subscriberId) });
    },
  });
}
