import { COLLECTIONS } from "@/constants/collections";

/**
 * The links between a person and the work assigned to them that can be handed
 * to someone else.
 *
 * Each entry names a real field on a real document — `convincedByUid`,
 * `assignedSalesId` and `assignedNutritionistId` on subscribers,`assignedTo` on
 * WhatsApp leads. Nothing here is aspirational: a scope that does not correspond
 * to a stored field would show a count of zero forever and quietly convince the
 * person archiving an account that there was nothing to move.
 *
 * Payments, refunds and audit entries are intentionally not scopes. They record
 * what happened; reassigning them would rewrite history rather than reassign
 * work. The impact summary reports them so the reader knows they stay put.
 *
 * This file is shared by the browser (labels, forms) and the server (queries),
 * so it must stay free of firebase-admin imports.
 */

export const TRANSFER_SCOPES = [
  "convincedByUid",
  "assignedSalesId",
  "assignedNutritionistId",
  "leadAssignedTo",
] as const;

export type TransferScope = (typeof TRANSFER_SCOPES)[number];

export const SCOPE_META: Record<
  TransferScope,
  { collection: string; field: string; label: string; hint: string }
> = {
  convincedByUid: {
    collection: COLLECTIONS.SUBSCRIBERS,
    field:      "convincedByUid",
    label:      "المشتركون الذين أقنعهم",
    hint:       "ينقل نسبة الاكتساب — يؤثر على لوحة الأداء والتقارير",
  },
  assignedSalesId: {
    collection: COLLECTIONS.SUBSCRIBERS,
    field:      "assignedSalesId",
    label:      "مشتركون مسندون له كمبيعات",
    hint:       "مسؤولية المتابعة البيعية",
  },
  assignedNutritionistId: {
    collection: COLLECTIONS.SUBSCRIBERS,
    field:      "assignedNutritionistId",
    label:      "مشتركون مسندون له كأخصائي تغذية",
    hint:       "مسؤولية المتابعة الغذائية",
  },
  leadAssignedTo: {
    collection: COLLECTIONS.WHATSAPP_LEADS,
    field:      "assignedTo",
    label:      "محادثات واتساب مسندة له",
    hint:       "المحادثات المفتوحة التي ستُترك بلا مسؤول",
  },
};
