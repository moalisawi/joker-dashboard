/**
 * Authorization for WhatsApp lead operations.
 *
 * `/api/whatsapp-operations` called `verifyServerUser` and nothing else. Every
 * one of its nine operations — reassigning a lead, retagging it, changing its
 * status, sending a message as the business, creating leads — was available to
 * any authenticated account, at any role, against any lead id. A subscriber
 * record is better protected than the pipeline that produces one.
 *
 * Two questions have to be answered, and they are different:
 *
 *   1. Does this actor hold the capability at all?  → LEAD_OPERATION_PERMISSION
 *   2. Does the capability reach *this* lead?       → canMutateLead
 *
 * Leads reuse the `subscribers` permission category rather than gaining one of
 * their own: a lead is a subscriber before they convert, the same people work
 * both, and inventing a parallel category would mean a second table to keep in
 * agreement with ROLE_CEILING — which is precisely the failure documented in
 * docs/CHANGELOG-2026-08-10.md.
 *
 * Pure by design — no Firestore, no request — so the rules are unit testable.
 */

import type { Role } from "@/types";

export type LeadOperation =
  | "updateLeadStatus"
  | "sendMessage"
  | "markAsRead"
  | "addNote"
  | "removeNote"
  | "updateTags"
  | "assignLead"
  | "updateConversationStatus"
  | "createLead";

/**
 * The granular permission each operation requires, as [category, action].
 *
 * `markAsRead` is deliberately absent: marking a conversation you can already
 * see as read changes no business state, and gating it would make the inbox
 * unusable for anyone who may read leads at all.
 */
export const LEAD_OPERATION_PERMISSION: Record<
  Exclude<LeadOperation, "markAsRead">,
  readonly [string, string]
> = {
  updateLeadStatus:         ["subscribers", "edit"],
  sendMessage:              ["subscribers", "edit"],
  addNote:                  ["subscribers", "edit"],
  removeNote:               ["subscribers", "edit"],
  updateTags:               ["subscribers", "edit"],
  updateConversationStatus: ["subscribers", "edit"],
  createLead:               ["subscribers", "create"],
  // Handing a lead to someone else is a supervisor action, the same way
  // reassigning a subscriber is.
  assignLead:               ["subscribers", "assign"],
} as const;

export interface LeadAccessActor {
  uid: string;
  role: Role;
}

/** The subset of the lead document these checks read. */
export interface LeadLinkFields {
  assignedTo?: unknown;
  assignedToUid?: unknown;
}

export interface LeadAccessDecision {
  allowed: boolean;
  reason?: string;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Who a lead currently belongs to, tolerating both field spellings in the data. */
export function leadOwnerUid(lead: LeadLinkFields | null | undefined): string {
  if (!lead) return "";
  return str(lead.assignedToUid) || str(lead.assignedTo);
}

/**
 * May this actor mutate this lead?
 *
 * An unassigned lead is open to any employee who holds the capability — that is
 * how the pipeline works: leads arrive unowned and whoever picks one up works
 * it. Once assigned it belongs to that person, and other employees are out.
 * owner and admin are unscoped.
 */
export function canMutateLead(
  actor: LeadAccessActor,
  lead: LeadLinkFields | null | undefined,
  operation: LeadOperation
): LeadAccessDecision {
  if (actor.role === "owner" || actor.role === "admin") return { allowed: true };

  if (!lead) return { allowed: false, reason: "المحادثة غير موجودة" };

  const owner = leadOwnerUid(lead);
  if (owner === "" || owner === str(actor.uid)) return { allowed: true };

  return {
    allowed: false,
    reason:
      operation === "assignLead"
        ? "لا يمكنك إعادة تعيين محادثة مسندة لموظف آخر"
        : "هذه المحادثة مسندة لموظف آخر",
  };
}

/**
 * Reassignment target check, mirroring subscribers: an employee may claim an
 * unassigned lead or release their own, but may not push one onto a colleague.
 * Passing an empty target means "unassign".
 */
export function canAssignLeadTo(
  actor: LeadAccessActor,
  lead: LeadLinkFields | null | undefined,
  targetUid: string | null | undefined
): LeadAccessDecision {
  if (actor.role === "owner" || actor.role === "admin") return { allowed: true };

  const base = canMutateLead(actor, lead, "assignLead");
  if (!base.allowed) return base;

  const target = str(targetUid);
  if (target !== "" && target !== str(actor.uid)) {
    return { allowed: false, reason: "لا يمكنك إسناد محادثة لموظف آخر" };
  }
  return { allowed: true };
}
