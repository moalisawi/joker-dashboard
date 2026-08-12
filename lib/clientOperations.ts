"use client";

import { auth } from "@/lib/auth";

type SubscriberOperation =
  | "createSubscriber"
  | "updateSubscriber"
  | "deleteSubscriber"
  | "addPayment"
  | "renewSubscription"
  | "withdrawSubscriber"
  | "pauseSubscription"
  | "resumePausedSubscription"
  | "freezeSubscription"
  | "resumeSubscription"
  | "verifyReceipt"
  | "adjustPayment";

type OperationResponse<T> = T & {
  success: boolean;
  error?: string;
};

export async function callSubscriberOperation<T = Record<string, unknown>>(
  operation: SubscriberOperation,
  payload: Record<string, unknown>
): Promise<OperationResponse<T>> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Unauthorized");

  const response = await fetch("/api/subscriber-operations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ operation, payload }),
  });

  const data = (await response.json()) as OperationResponse<T>;
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Operation failed");
  }

  return data;
}
