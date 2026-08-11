/**
 * Row-level authorization for subscriber mutations.
 *
 * `firestore.rules` scopes what an employee can *read* to subscribers they are
 * linked to. It does not — and cannot — constrain the API routes: every write
 * goes through the Admin SDK, which bypasses rules entirely by design. So the
 * routes were the only thing standing between an employee and any subscriber in
 * the database, and they only asked "may this person edit subscribers?", never
 * "may this person edit *this* subscriber?".
 *
 * The practical consequence: an employee holding `subscribers.edit` could POST
 * any subscriberId to /api/subscriber-operations, /api/subscribers/assign,
 * /api/subscribers/workflow-status or /api/subscribers/renewal-status and
 * mutate a colleague's record — reassign it to themselves, change its workflow
 * state, take payments against it. The id is the only thing they needed, and the
 * UI hands out ids freely.
 *
 * This module is the missing half. It is deliberately pure: no Firestore, no
 * request, no Admin SDK — the caller loads the document and passes it in — so
 * the rules it encodes can be unit tested directly.
 *
 * The ownership test mirrors `canReadSubscriberAsEmployee()` in firestore.rules.
 * Keep the two in step: if one gains a link field, so must the other.
 */

import type { Role } from "@/types";

/** What the caller is trying to do. Used for the message, and for `view`. */
export type SubscriberAction =
  | "view"
  | "edit"
  | "delete"
  | "payment"
  | "renew"
  | "withdraw"
  | "pause"
  | "freeze"
  | "resume"
  | "changeStatus"
  | "assign";

/** The subset of the verified actor these checks need. */
export interface SubscriberAccessActor {
  uid: string;
  role: Role;
  /** Legacy link: subscribers tagged by name before convincedByUid existed. */
  employeeName?: string;
}

/** The subset of the subscriber document these checks read. */
export interface SubscriberLinkFields {
  convincedByUid?: unknown;
  convincedBy?: unknown;
  assignedSalesId?: unknown;
  assignedNutritionistId?: unknown;
}

export interface AccessDecision {
  allowed: boolean;
  /** Present when denied. Safe to return to the client. */
  reason?: string;
}

const ACTION_LABELS: Record<SubscriberAction, string> = {
  view:         "عرض",
  edit:         "تعديل",
  delete:       "حذف",
  payment:      "تسجيل دفعة على",
  renew:        "تجديد اشتراك",
  withdraw:     "تسجيل انسحاب",
  pause:        "إيقاف اشتراك",
  freeze:       "تجميد اشتراك",
  resume:       "استئناف اشتراك",
  changeStatus: "تغيير حالة",
  assign:       "تعيين",
};

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Is this employee linked to this subscriber?
 *
 * Three current links plus one legacy fallback:
 *   convincedByUid          — who brought them in (the primary link)
 *   assignedSalesId         — who handles their sales
 *   assignedNutritionistId  — who handles their nutrition
 *   convincedBy === employeeName — records predating convincedByUid
 *
 * The name fallback only applies when the record carries no uid at all. Once a
 * record has `convincedByUid`, that field is the answer and a matching name on
 * a different account does not grant access — otherwise the two employees who
 * share a display name (ميدو, حنان — see docs/SECURITY-HARDENING-2026-08.md)
 * would each reach the other's subscribers.
 */
export function isLinkedToSubscriber(
  actor: SubscriberAccessActor,
  subscriber: SubscriberLinkFields | null | undefined
): boolean {
  if (!subscriber) return false;

  const uid = str(actor.uid);
  if (!uid) return false;

  if (str(subscriber.convincedByUid) === uid) return true;
  if (str(subscriber.assignedSalesId) === uid) return true;
  if (str(subscriber.assignedNutritionistId) === uid) return true;

  // Legacy path — only when no uid was ever recorded on the subscriber.
  if (!str(subscriber.convincedByUid)) {
    const name = str(actor.employeeName);
    if (name && str(subscriber.convincedBy) === name) return true;
  }

  return false;
}

/**
 * May this actor perform `action` on this subscriber?
 *
 * Assumes the caller has already checked that the actor holds the *capability*
 * (e.g. `hasServerPermission(actor, "subscribers", "edit")`). This answers the
 * separate question of whether the capability reaches this particular record.
 * Both checks are required; neither replaces the other.
 *
 * owner and admin are unscoped — they supervise the whole book of business, and
 * `ROLE_CEILING` already governs which actions they hold at all.
 */
export function canMutateSubscriber(
  actor: SubscriberAccessActor,
  subscriber: SubscriberLinkFields | null | undefined,
  action: SubscriberAction
): AccessDecision {
  if (actor.role === "owner" || actor.role === "admin") return { allowed: true };

  if (!subscriber) {
    return { allowed: false, reason: "المشترك غير موجود" };
  }

  if (isLinkedToSubscriber(actor, subscriber)) return { allowed: true };

  return {
    allowed: false,
    reason: `لا تملك صلاحية ${ACTION_LABELS[action] ?? action} هذا المشترك — غير مرتبط بك`,
  };
}

/** Throwing form, for the operation handlers that already surface thrown errors. */
export function assertCanAccessSubscriber(
  actor: SubscriberAccessActor,
  subscriber: SubscriberLinkFields | null | undefined,
  action: SubscriberAction
): void {
  const decision = canMutateSubscriber(actor, subscriber, action);
  if (!decision.allowed) {
    const error = new Error(decision.reason ?? "Forbidden") as Error & { status?: number };
    // Read by the route's catch block so an ownership failure answers 403 and
    // not the 500 a bare throw would produce.
    error.status = 403;
    throw error;
  }
}

/**
 * Reassignment is the one action where the *target* matters as much as the
 * record: letting a linked employee hand a subscriber to anyone would let them
 * launder records between colleagues, and letting them take one is the
 * privilege escalation this whole module exists to stop.
 *
 * Employees may only unassign themselves or assign to themselves. Moving a
 * subscriber to a third party is a supervisor action.
 */
export function canAssignSubscriberTo(
  actor: SubscriberAccessActor,
  subscriber: SubscriberLinkFields | null | undefined,
  targetUids: Array<string | null | undefined>
): AccessDecision {
  if (actor.role === "owner" || actor.role === "admin") return { allowed: true };

  const base = canMutateSubscriber(actor, subscriber, "assign");
  if (!base.allowed) return base;

  const foreign = targetUids.map(str).filter((t) => t !== "" && t !== str(actor.uid));
  if (foreign.length > 0) {
    return { allowed: false, reason: "لا يمكنك تعيين مشترك لموظف آخر" };
  }
  return { allowed: true };
}
