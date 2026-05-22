import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import { COLLECTIONS } from "@/constants";
import { softDelete } from "@/lib/softDelete";
import { auditService } from "@/services/audit.service";
import type { UserProfile } from "@/types";
import type { PaymentMethod, PaymentMethodStatus } from "../types";
import type { CreatePaymentMethodInput, UpdatePaymentMethodInput } from "../schemas/paymentMethod.schema";

function colRef() {
  return collection(db, COLLECTIONS.PAYMENT_METHODS);
}

function toPaymentMethod(id: string, data: Record<string, unknown>): PaymentMethod {
  return { id, ...data } as PaymentMethod;
}

// Fetch all non-deleted, sort client-side (avoids composite index on deleted+name)
async function getAll(): Promise<PaymentMethod[]> {
  const snap = await getDocs(colRef());
  return snap.docs
    .map((d) => toPaymentMethod(d.id, d.data()))
    .filter((m) => !m.deleted)
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

async function getById(id: string): Promise<PaymentMethod | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.PAYMENT_METHODS, id));
  if (!snap.exists()) return null;
  return toPaymentMethod(snap.id, snap.data());
}

// Active methods for a given country: scope=global OR scope=country AND country matches
// Single equality filter on status — no composite index needed
async function getActiveByCountry(country: string | null): Promise<PaymentMethod[]> {
  const snap = await getDocs(
    query(colRef(), where("status", "==", "active"))
  );
  return snap.docs
    .map((d) => toPaymentMethod(d.id, d.data()))
    .filter(
      (m) =>
        !m.deleted &&
        (m.scope === "global" || (m.scope === "country" && m.country === country))
    )
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

async function create(
  input: CreatePaymentMethodInput,
  actor: UserProfile
): Promise<string> {
  const ref = await addDoc(colRef(), {
    ...input,
    country:   input.country ?? null,
    status:    "active" as PaymentMethodStatus,
    deleted:   false,
    createdBy: actor.uid,
    updatedBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await auditService.track({
    actor,
    action:     "paymentMethod_created",
    entity:     "paymentMethod",
    entityId:   ref.id,
    entityName: input.name,
    after:      { ...input, status: "active" },
    tags:       ["paymentMethod"],
  });
  return ref.id;
}

async function update(
  id: string,
  input: UpdatePaymentMethodInput,
  actor: UserProfile,
  before: Record<string, unknown>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.PAYMENT_METHODS, id), {
    ...input,
    updatedBy: actor.uid,
    updatedAt: serverTimestamp(),
  });
  await auditService.track({
    actor,
    action:     "paymentMethod_updated",
    entity:     "paymentMethod",
    entityId:   id,
    entityName: (input.name ?? before.name) as string,
    before,
    after:      { ...before, ...input },
    tags:       ["paymentMethod"],
  });
}

async function toggleStatus(
  id: string,
  currentStatus: PaymentMethodStatus,
  methodName: string,
  actor: UserProfile
): Promise<void> {
  const newStatus: PaymentMethodStatus = currentStatus === "active" ? "disabled" : "active";
  await updateDoc(doc(db, COLLECTIONS.PAYMENT_METHODS, id), {
    status:    newStatus,
    updatedBy: actor.uid,
    updatedAt: serverTimestamp(),
  });
  await auditService.track({
    actor,
    action:     "paymentMethod_status_changed",
    entity:     "paymentMethod",
    entityId:   id,
    entityName: methodName,
    before:     { status: currentStatus },
    after:      { status: newStatus },
    metadata:   { fromStatus: currentStatus, toStatus: newStatus },
    tags:       ["paymentMethod"],
  });
}

async function remove(id: string, methodName: string, actor: UserProfile): Promise<void> {
  await softDelete(COLLECTIONS.PAYMENT_METHODS, id, actor.uid);
  await auditService.track({
    actor,
    action:     "paymentMethod_deleted",
    entity:     "paymentMethod",
    entityId:   id,
    entityName: methodName,
    tags:       ["paymentMethod", "delete"],
  });
}

export const paymentMethodService = {
  getAll,
  getById,
  getActiveByCountry,
  create,
  update,
  toggleStatus,
  remove,
};
