"use client";

import { useState, useEffect } from "react";
import { useMutation} from "@tanstack/react-query";
import { subscriberNotesService } from "@/services/subscriberNotes.service";
import { useAuthStore }           from "@/store/authStore";
import type { SubscriberNote }    from "@/types";
import type { NoteType }          from "@/constants/subscriberWorkflow";

export function useSubscriberNotesListener(subscriberId: string | undefined) {
  const [notes, setNotes]     = useState<SubscriberNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!subscriberId) { setLoading(false); return; }
    setLoading(true);
    const unsub = subscriberNotesService.listenBySubscriberId(subscriberId, (data) => {
      setNotes(data);
      setLoading(false);
    });
    return () => unsub();
  }, [subscriberId]);

  return { notes, loading };
}

/**
 * @param subscriberConvincedByUid the subscriber's own convincedByUid. It is
 * what firestore.rules matches when scoping note reads, so a note stamped with
 * anything else is invisible to the employee working the record. The caller has
 * the subscriber on screen already; passing it avoids a second read.
 */
export function useAddNote(
  subscriberId: string,
  subscriberName: string,
  subscriberConvincedByUid?: string
) {
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: ({ content, noteType }: { content: string; noteType: NoteType }) =>
      subscriberNotesService.add(
        user!,
        subscriberId,
        subscriberName,
        content,
        noteType,
        subscriberConvincedByUid
      ),
  });
}

export function useEditNote(subscriberId: string, subscriberName: string) {
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: ({ noteId, content }: { noteId: string; content: string }) =>
      subscriberNotesService.edit(user!, noteId, subscriberId, subscriberName, content),
  });
}

export function useDeleteNote(subscriberId: string, subscriberName: string) {
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (noteId: string) =>
      subscriberNotesService.delete(user!, noteId, subscriberId, subscriberName),
  });
}
