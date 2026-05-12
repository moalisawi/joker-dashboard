"use client";

import { useMutation } from "@tanstack/react-query";
import { subscriberAssignmentService, type AssignPayload } from "@/services/subscriberAssignment.service";
import { auth } from "@/lib/auth";

// ── Workflow status change ────────────────────────────────────────────────────

async function postWorkflowStatus(payload: {
  subscriberId:   string;
  subscriberName: string;
  status:         string;
  note?:          string;
}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Unauthorized");
  const res = await fetch("/api/subscribers/workflow-status", {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body:    JSON.stringify(payload),
  });
  const data = await res.json() as { success?: boolean; error?: string };
  if (!res.ok || !data.success) throw new Error(data.error ?? "Failed");
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useAssignSubscriber() {
  return useMutation({
    mutationFn: (payload: AssignPayload) => subscriberAssignmentService.assign(payload),
  });
}

export function useUnassignSubscriber() {
  return useMutation({
    mutationFn: ({ subscriberId, subscriberName, reason }: {
      subscriberId: string; subscriberName: string; reason?: string;
    }) => subscriberAssignmentService.unassign(subscriberId, subscriberName, reason),
  });
}

export function useChangeWorkflowStatus() {
  return useMutation({
    mutationFn: (payload: {
      subscriberId: string; subscriberName: string; status: string; note?: string;
    }) => postWorkflowStatus(payload),
  });
}
