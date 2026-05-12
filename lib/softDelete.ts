import {
  doc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  Query,
  CollectionReference,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firestore";

export interface SoftDeletePayload {
  deleted: true;
  deletedAt: ReturnType<typeof serverTimestamp>;
  deletedBy: string;
}

/** Returns the Firestore update payload for a soft delete. */
export function buildSoftDeletePayload(deletedBy: string): SoftDeletePayload {
  return {
    deleted: true,
    deletedAt: serverTimestamp(),
    deletedBy,
  };
}

/**
 * Soft-deletes a document by setting deleted=true, deletedAt, deletedBy.
 * The document remains in Firestore; it is excluded from normal queries via
 * excludeDeleted().
 */
export async function softDelete(
  collectionName: string,
  docId: string,
  deletedBy: string
): Promise<void> {
  await updateDoc(
    doc(db, collectionName, docId),
    buildSoftDeletePayload(deletedBy)
  );
}

/**
 * Wraps a Firestore query to exclude soft-deleted documents.
 *
 * Usage:
 *   const q = excludeDeleted(query(collection(db, COLLECTIONS.SUBSCRIBERS)))
 */
export function excludeDeleted<T extends DocumentData>(
  q: Query<T> | CollectionReference<T>
): Query<T> {
  return query(q as Query<T>, where("deleted", "!=", true));
}

/** Returns true if a document is soft-deleted. */
export function isDeleted(doc: { deleted?: boolean }): boolean {
  return doc.deleted === true;
}
