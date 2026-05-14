/**
 * employees.service.ts
 *
 * Handles all employee ↔ team relationship mutations.
 * Every operation that touches teamId MUST go through this service
 * so membersCount stays in sync via Firestore transactions.
 *
 * Rule: never update user.teamId or team.membersCount directly —
 * always call these functions.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db }                  from "@/lib/firestore";
import { COLLECTIONS }         from "@/constants/collections";
import { activityLogService }  from "./activityLog.service";
import type { UserProfile }    from "@/types";
import type { ActivityLogActor } from "@/types";

// ─── internal helpers ─────────────────────────────────────────────────────────

async function fetchEmployee(uid: string): Promise<UserProfile> {
  const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  if (!snap.exists()) throw new Error(`Employee ${uid} not found`);
  return { uid: snap.id, ...snap.data() } as UserProfile;
}

async function fetchTeamName(teamId: string): Promise<string> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.TEAMS, teamId));
    return (snap.data()?.name as string) ?? teamId;
  } catch {
    return teamId;
  }
}

// ─── assign ───────────────────────────────────────────────────────────────────

/**
 * Assign an employee to a team.
 * - If the employee already belongs to a different team → throws; use moveEmployeeBetweenTeams instead.
 * - If the employee is already in the same team → no-op.
 * - Atomically increments team.membersCount.
 */
export async function assignEmployeeToTeam(
  uid:      string,
  teamId:   string,
  actor:    ActivityLogActor,
  reason?:  string
): Promise<void> {
  const [employee, teamName] = await Promise.all([
    fetchEmployee(uid),
    fetchTeamName(teamId),
  ]);

  if (employee.teamId === teamId) return; // already in this team — no-op

  if (employee.teamId && employee.teamId !== teamId) {
    throw new Error(
      `Employee is already in team ${employee.teamId}. Use moveEmployeeBetweenTeams() instead.`
    );
  }

  const userRef = doc(db, COLLECTIONS.USERS, uid);
  const teamRef = doc(db, COLLECTIONS.TEAMS, teamId);

  await runTransaction(db, async (tx) => {
    const teamSnap = await tx.get(teamRef);
    if (!teamSnap.exists()) throw new Error(`Team ${teamId} does not exist`);
    if (teamSnap.data().deleted === true) throw new Error(`Team ${teamId} has been deleted`);

    tx.update(userRef, {
      teamId,
      updatedAt: serverTimestamp(),
    });
    tx.update(teamRef, {
      membersCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  });

  activityLogService.logTeamAssigned({
    actor,
    employeeId:   uid,
    employeeName: employee.name,
    newTeamId:    teamId,
    newTeamName:  teamName,
    reason,
  }).catch(console.warn);
}

// ─── remove ───────────────────────────────────────────────────────────────────

/**
 * Remove an employee from their current team.
 * - If the employee has no team → no-op.
 * - Atomically decrements team.membersCount (floor: 0).
 */
export async function removeEmployeeFromTeam(
  uid:     string,
  actor:   ActivityLogActor,
  reason?: string
): Promise<void> {
  const employee = await fetchEmployee(uid);
  const oldTeamId = employee.teamId;

  if (!oldTeamId) return; // no team — nothing to do

  const oldTeamName = await fetchTeamName(oldTeamId);
  const userRef     = doc(db, COLLECTIONS.USERS, uid);
  const teamRef     = doc(db, COLLECTIONS.TEAMS, oldTeamId);

  await runTransaction(db, async (tx) => {
    const teamSnap  = await tx.get(teamRef);
    const current   = (teamSnap.data()?.membersCount as number) ?? 0;

    tx.update(userRef, {
      teamId:    null,
      updatedAt: serverTimestamp(),
    });

    // Guard against going below 0 (data inconsistency safety)
    tx.update(teamRef, {
      membersCount: Math.max(0, current - 1),
      updatedAt:    serverTimestamp(),
    });
  });

  activityLogService.logTeamRemoved({
    actor,
    employeeId:   uid,
    employeeName: employee.name,
    oldTeamId,
    oldTeamName,
    reason,
  }).catch(console.warn);
}

// ─── move ─────────────────────────────────────────────────────────────────────

/**
 * Move an employee from one team to another atomically.
 * Decrements old team, increments new team, updates user — all in one transaction.
 */
export async function moveEmployeeBetweenTeams(
  uid:      string,
  newTeamId: string,
  actor:    ActivityLogActor,
  reason?:  string
): Promise<void> {
  const [employee, newTeamName] = await Promise.all([
    fetchEmployee(uid),
    fetchTeamName(newTeamId),
  ]);

  const oldTeamId = employee.teamId ?? null;

  if (oldTeamId === newTeamId) return; // same team — no-op

  if (!oldTeamId) {
    // No previous team → delegate to assign
    return assignEmployeeToTeam(uid, newTeamId, actor, reason);
  }

  const oldTeamName = await fetchTeamName(oldTeamId);
  const userRef     = doc(db, COLLECTIONS.USERS, uid);
  const oldTeamRef  = doc(db, COLLECTIONS.TEAMS, oldTeamId);
  const newTeamRef  = doc(db, COLLECTIONS.TEAMS, newTeamId);

  await runTransaction(db, async (tx) => {
    const [oldSnap, newSnap] = await Promise.all([
      tx.get(oldTeamRef),
      tx.get(newTeamRef),
    ]);

    if (!newSnap.exists()) throw new Error(`Target team ${newTeamId} does not exist`);
    if (newSnap.data().deleted === true) throw new Error(`Target team ${newTeamId} has been deleted`);

    const oldCount = (oldSnap.data()?.membersCount as number) ?? 0;

    tx.update(userRef, {
      teamId:    newTeamId,
      updatedAt: serverTimestamp(),
    });
    tx.update(oldTeamRef, {
      membersCount: Math.max(0, oldCount - 1),
      updatedAt:    serverTimestamp(),
    });
    tx.update(newTeamRef, {
      membersCount: increment(1),
      updatedAt:    serverTimestamp(),
    });
  });

  activityLogService.logTeamTransferred({
    actor,
    employeeId:   uid,
    employeeName: employee.name,
    oldTeamId,
    oldTeamName,
    newTeamId,
    newTeamName,
    reason,
  }).catch(console.warn);
}

// ─── get employees by team ────────────────────────────────────────────────────

export async function getEmployeesByTeam(teamId: string): Promise<UserProfile[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.USERS),
      where("isEmployee", "==", true),
      where("teamId",     "==", teamId)
    )
  );
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
}

// ─── public export ────────────────────────────────────────────────────────────

export const employeesService = {
  assignEmployeeToTeam,
  removeEmployeeFromTeam,
  moveEmployeeBetweenTeams,
  getEmployeesByTeam,
};
