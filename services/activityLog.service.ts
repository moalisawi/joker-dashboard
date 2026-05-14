import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db }          from "@/lib/firestore";
import { COLLECTIONS } from "@/constants/collections";
import type { ActivityLog, ActivityLogActor, ActivityLogType } from "@/types";

type LogInput = Omit<ActivityLog, "id" | "createdAt">;

async function write(input: LogInput): Promise<void> {
  try {
    await addDoc(collection(db, COLLECTIONS.ACTIVITY_LOGS), {
      ...input,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("[activityLog] write failed:", err);
  }
}

// ─── typed helpers ────────────────────────────────────────────────────────────

function logTeamAssigned(params: {
  actor:        ActivityLogActor;
  employeeId:   string;
  employeeName: string;
  newTeamId:    string;
  newTeamName:  string;
  reason?:      string;
}): Promise<void> {
  return write({
    type:         "team_assigned",
    performedBy:  params.actor,
    employeeId:   params.employeeId,
    employeeName: params.employeeName,
    newTeamId:    params.newTeamId,
    newTeamName:  params.newTeamName,
    reason:       params.reason,
  });
}

function logTeamRemoved(params: {
  actor:        ActivityLogActor;
  employeeId:   string;
  employeeName: string;
  oldTeamId:    string;
  oldTeamName:  string;
  reason?:      string;
}): Promise<void> {
  return write({
    type:         "team_removed",
    performedBy:  params.actor,
    employeeId:   params.employeeId,
    employeeName: params.employeeName,
    oldTeamId:    params.oldTeamId,
    oldTeamName:  params.oldTeamName,
    reason:       params.reason,
  });
}

function logTeamTransferred(params: {
  actor:        ActivityLogActor;
  employeeId:   string;
  employeeName: string;
  oldTeamId:    string;
  oldTeamName:  string;
  newTeamId:    string;
  newTeamName:  string;
  reason?:      string;
}): Promise<void> {
  return write({
    type:         "team_transferred",
    performedBy:  params.actor,
    employeeId:   params.employeeId,
    employeeName: params.employeeName,
    oldTeamId:    params.oldTeamId,
    oldTeamName:  params.oldTeamName,
    newTeamId:    params.newTeamId,
    newTeamName:  params.newTeamName,
    reason:       params.reason,
  });
}

function logTeamDeleted(params: {
  actor:           ActivityLogActor;
  teamId:          string;
  teamName:        string;
  affectedCount:   number;
}): Promise<void> {
  return write({
    type:        "team_deleted",
    performedBy: params.actor,
    teamId:      params.teamId,
    teamName:    params.teamName,
    metadata:    { affectedMembersCount: params.affectedCount },
  });
}

function logLeaderAssigned(params: {
  actor:        ActivityLogActor;
  teamId:       string;
  teamName:     string;
  employeeId:   string;
  employeeName: string;
}): Promise<void> {
  return write({
    type:         "leader_assigned",
    performedBy:  params.actor,
    teamId:       params.teamId,
    teamName:     params.teamName,
    employeeId:   params.employeeId,
    employeeName: params.employeeName,
  });
}

function logLeaderRemoved(params: {
  actor:      ActivityLogActor;
  teamId:     string;
  teamName:   string;
}): Promise<void> {
  return write({
    type:        "leader_removed",
    performedBy: params.actor,
    teamId:      params.teamId,
    teamName:    params.teamName,
  });
}

function logRoleChanged(params: {
  actor:        ActivityLogActor;
  employeeId:   string;
  employeeName: string;
  oldRole:      string;
  newRole:      string;
}): Promise<void> {
  return write({
    type:         "role_changed",
    performedBy:  params.actor,
    employeeId:   params.employeeId,
    employeeName: params.employeeName,
    oldRole:      params.oldRole,
    newRole:      params.newRole,
  });
}

// ─── queries ──────────────────────────────────────────────────────────────────

async function getByEmployee(employeeId: string, maxItems = 50): Promise<ActivityLog[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.ACTIVITY_LOGS),
      where("employeeId", "==", employeeId),
      orderBy("createdAt", "desc"),
      limit(maxItems)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog));
}

async function getByTeam(teamId: string, maxItems = 50): Promise<ActivityLog[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.ACTIVITY_LOGS),
      where("teamId", "==", teamId),
      orderBy("createdAt", "desc"),
      limit(maxItems)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog));
}

async function getByType(type: ActivityLogType, maxItems = 100): Promise<ActivityLog[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.ACTIVITY_LOGS),
      where("type", "==", type),
      orderBy("createdAt", "desc"),
      limit(maxItems)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog));
}

// ─── public API ───────────────────────────────────────────────────────────────

export const activityLogService = {
  logTeamAssigned,
  logTeamRemoved,
  logTeamTransferred,
  logTeamDeleted,
  logLeaderAssigned,
  logLeaderRemoved,
  logRoleChanged,

  getByEmployee,
  getByTeam,
  getByType,
};
