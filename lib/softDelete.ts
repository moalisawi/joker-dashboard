import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firestore";

export interface SoftDeletePayload extends Record<string, unknown> {
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
 * Removes soft-deleted documents — in the CLIENT, deliberately.
 *
 * The previous version added `where("deleted","!=",true)` to the query, which
 * looks right and is catastrophic: a Firestore inequality filter also excludes
 * every document that does not carry the field at all. Soft delete only writes
 * `deleted` when something is deleted, so on this data the filter returned
 * almost nothing — measured 31 Aug 2026 against production:
 *
 *     subscribers   55 documents,  4 carry the field  →  query returned 0
 *     payments      25 documents,  0 carry the field  →  query returned 0
 *     users          8 documents,  2 carry the field  →  query returned 1
 *     teams          4 documents,  4 carry the field  →  query returned 4  ✓
 *
 * Teams survived by accident: they happen to be written by newer code that sets
 * the field. Everything older simply vanished, silently, with no error — which
 * is how the sales page came to score every employee zero and get dropped from
 * the navigation instead of fixed.
 *
 * Filtering after the read costs one predicate and cannot lie.
 */
export function rejectDeleted<T extends { deleted?: boolean }>(rows: T[]): T[] {
  return rows.filter((r) => r.deleted !== true);
}

/** Returns true if a document is soft-deleted. */
export function isDeleted(doc: { deleted?: boolean }): boolean {
  return doc.deleted === true;
}
