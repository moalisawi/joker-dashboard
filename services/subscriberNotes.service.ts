/**
 * Subscriber Notes Service
 *
 * Notes live in the `subscriberNotes` collection (separate documents for
 * scalability and independent queries). Firestore rules allow any active
 * employee to read and create, but only the author can update their own note.
 * Deletion is soft-only (set deleted=true).
 */

import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db }              from "@/lib/firestore";
import { COLLECTIONS }     from "@/constants/collections";
import { auditService }    from "@/services/audit.service";
import type { UserProfile } from "@/types";
import type { SubscriberNote } from "@/types";
import type { NoteType } from "@/constants/subscriberWorkflow";

const COL = COLLECTIONS.SUBSCRIBER_NOTES;

export const subscriberNotesService = {
  /** Fetch all (non-deleted) notes for a subscriber, newest first. */
  async getBySubscriberId(subscriberId: string): Promise<SubscriberNote[]> {
    const q = query(
      collection(db, COL),
      where("subscriberId", "==", subscriberId),
      where("deleted", "!=", true),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SubscriberNote);
  },

  /** Subscribe to real-time updates. */
  listenBySubscriberId(
    subscriberId: string,
    callback: (notes: SubscriberNote[]) => void
  ): Unsubscribe {
    const q = query(
      collection(db, COL),
      where("subscriberId", "==", subscriberId),
      where("deleted", "!=", true),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SubscriberNote));
    });
  },

  /** Add a new note. Returns the new document ID. */
  async add(
    actor: UserProfile,
    subscriberId: string,
    subscriberName: string,
    content: string,
    noteType: NoteType
  ): Promise<string> {
    const ref = await addDoc(collection(db, COL), {
      subscriberId,
      subscriberName,
      authorId:   actor.uid,
      authorName: actor.name,
      content:    content.trim(),
      noteType,
      deleted:    false,
      createdAt:  serverTimestamp(),
      updatedAt:  serverTimestamp(),
    });

    auditService.track({
      actor,
      action:    "note_added",
      entity:    "subscriber",
      entityId:  subscriberId,
      entityName:subscriberName,
      metadata:  { noteId: ref.id, noteType },
      tags:      ["note", "subscriber"],
    }).catch(() => undefined);

    return ref.id;
  },

  /** Edit the content of a note (author only — enforced by Firestore rules). */
  async edit(
    actor: UserProfile,
    noteId: string,
    subscriberId: string,
    subscriberName: string,
    newContent: string
  ): Promise<void> {
    await updateDoc(doc(db, COL, noteId), {
      content:   newContent.trim(),
      updatedAt: serverTimestamp(),
    });

    auditService.track({
      actor,
      action:    "note_updated",
      entity:    "subscriber",
      entityId:  subscriberId,
      entityName:subscriberName,
      metadata:  { noteId },
      tags:      ["note", "subscriber"],
    }).catch(() => undefined);
  },

  /** Soft-delete a note (author only — enforced by Firestore rules). */
  async delete(
    actor: UserProfile,
    noteId: string,
    subscriberId: string,
    subscriberName: string
  ): Promise<void> {
    await updateDoc(doc(db, COL, noteId), {
      deleted:   true,
      deletedAt: serverTimestamp(),
      deletedBy: actor.uid,
      updatedAt: serverTimestamp(),
    });

    auditService.track({
      actor,
      action:    "note_deleted",
      entity:    "subscriber",
      entityId:  subscriberId,
      entityName:subscriberName,
      metadata:  { noteId },
      tags:      ["note", "subscriber"],
    }).catch(() => undefined);
  },
};
