/**
 * Subscriber Notes Service
 *
 * Notes live in the `subscriberNotes` collection (separate documents for
 * scalability and independent queries).
 *
 * Firestore rules scope reads to the employee who owns the subscriber (via the
 * denormalised `convincedByUid`) or the note's own author — they used to allow
 * any active user to read every note, which made the note a way around the
 * subscriber rule. Creates require an employee to stamp their own uid, so a
 * note cannot be filed under a colleague.
 *
 * Updates are the author's alone and are restricted to the fields `edit` and
 * `delete` below actually write: content, updatedAt, deleted, deletedAt,
 * deletedBy. Adding a field here means widening the rule to match — see
 * __tests__/lib/rulesAlignment.test.ts, which fails if the two drift.
 *
 * Deletion is soft-only (set deleted=true); hard delete is denied outright.
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
    noteType: NoteType,
    /** The subscriber's convincedByUid. Falls back to the author when unknown. */
    subscriberConvincedByUid?: string
  ): Promise<string> {
    const ref = await addDoc(collection(db, COL), {
      subscriberId,
      subscriberName,
      // Scopes the note to the employee who owns the subscriber, so
      // firestore.rules can stop every active user reading every note.
      //
      // The subscriber's own convincedByUid is the value that matters: it is
      // what the read rule matches, so a note stamped with anything else is
      // invisible to the person working the record. Callers pass it down from
      // the subscriber they are already displaying. The fallback to actor.uid
      // covers legacy subscribers that never had an owner recorded — there the
      // author is the only link available, and the note stays readable to them.
      convincedByUid: subscriberConvincedByUid?.trim() || actor.uid,
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
