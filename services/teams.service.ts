import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db }                  from "@/lib/firestore";
import { COLLECTIONS }         from "@/constants/collections";
import { activityLogService }  from "./activityLog.service";
import type { Team, TeamType } from "@/types";
import type { ActivityLogActor } from "@/types";

// ─── input types ──────────────────────────────────────────────────────────────

export type TeamCreateInput = {
  name:         string;
  type:         TeamType;
  description?: string | null;
  active?:      boolean;
  createdBy?:   string;
};

export type TeamUpdateInput = Partial<Pick<Team, "name" | "type" | "active" | "description">>;

// ─── read ─────────────────────────────────────────────────────────────────────

async function getAll(): Promise<Team[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.TEAMS), where("deleted", "!=", true))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Team);
}

async function getActive(): Promise<Team[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.TEAMS),
      where("active",   "==", true),
      where("deleted",  "!=", true)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Team);
}

async function getById(id: string): Promise<Team | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.TEAMS, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Team) : null;
}

// ─── create ───────────────────────────────────────────────────────────────────

async function create(input: TeamCreateInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIONS.TEAMS), {
    name:         input.name,
    type:         input.type,
    description:  input.description  ?? null,
    active:       input.active        ?? true,
    membersCount: 0,
    leaderId:     null,
    deleted:      false,
    createdBy:    input.createdBy    ?? null,
    createdAt:    serverTimestamp(),
    updatedAt:    serverTimestamp(),
  });
  return ref.id;
}

// ─── update ───────────────────────────────────────────────────────────────────

async function update(id: string, data: TeamUpdateInput, updatedBy?: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.TEAMS, id), {
    ...data,
    updatedAt: serverTimestamp(),
    ...(updatedBy ? { updatedBy } : {}),
  });
}

async function deactivate(id: string, updatedBy?: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.TEAMS, id), {
    active:    false,
    updatedAt: serverTimestamp(),
    ...(updatedBy ? { updatedBy } : {}),
  });
}

async function activate(id: string, updatedBy?: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.TEAMS, id), {
    active:    true,
    updatedAt: serverTimestamp(),
    ...(updatedBy ? { updatedBy } : {}),
  });
}

// ─── leader ───────────────────────────────────────────────────────────────────

/**
 * Assign a team leader.
 * The employee must have employeeRole: "team_leader" — enforced in the UI,
 * not here (service layer stays free of UI-level validation).
 */
async function assignLeader(
  teamId:       string,
  leaderId:     string,
  leaderName:   string,
  actor:        ActivityLogActor
): Promise<void> {
  const teamSnap = await getDoc(doc(db, COLLECTIONS.TEAMS, teamId));
  if (!teamSnap.exists()) throw new Error(`Team ${teamId} does not exist`);

  await updateDoc(doc(db, COLLECTIONS.TEAMS, teamId), {
    leaderId,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });

  activityLogService.logLeaderAssigned({
    actor,
    teamId,
    teamName:     teamSnap.data().name as string,
    employeeId:   leaderId,
    employeeName: leaderName,
  }).catch(console.warn);
}

async function removeLeader(teamId: string, actor: ActivityLogActor): Promise<void> {
  const teamSnap = await getDoc(doc(db, COLLECTIONS.TEAMS, teamId));
  if (!teamSnap.exists()) throw new Error(`Team ${teamId} does not exist`);

  await updateDoc(doc(db, COLLECTIONS.TEAMS, teamId), {
    leaderId:  null,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });

  activityLogService.logLeaderRemoved({
    actor,
    teamId,
    teamName: teamSnap.data().name as string,
  }).catch(console.warn);
}

// ─── safe delete ──────────────────────────────────────────────────────────────

/**
 * Safely delete a team:
 * 1. Fetch all members (users where teamId == id).
 * 2. In a chunked batch, set their teamId to null.
 * 3. Soft-delete the team document (deleted: true, membersCount: 0, leaderId: null).
 * 4. Log the deletion to activityLogs.
 *
 * Uses batched writes (max 500 per batch) so large teams are handled correctly.
 * Not wrapped in a single transaction because batch + members query is too large
 * for a single runTransaction — instead we soft-delete last so the team remains
 * findable if a mid-way failure occurs; a re-run will clean up remaining members.
 */
async function safeDelete(teamId: string, actor: ActivityLogActor): Promise<void> {
  // 1. Fetch team info
  const teamSnap = await getDoc(doc(db, COLLECTIONS.TEAMS, teamId));
  if (!teamSnap.exists()) throw new Error(`Team ${teamId} does not exist`);
  if (teamSnap.data().deleted === true) return; // already deleted — idempotent

  const teamName = teamSnap.data().name as string;

  // 2. Fetch all members
  const membersSnap = await getDocs(
    query(
      collection(db, COLLECTIONS.USERS),
      where("isEmployee", "==", true),
      where("teamId",     "==", teamId)
    )
  );

  const memberDocs = membersSnap.docs;

  // 3. Null out teamId in chunks of 499 (Firestore batch limit is 500)
  const CHUNK = 499;
  for (let i = 0; i < memberDocs.length; i += CHUNK) {
    const batch = writeBatch(db);
    memberDocs.slice(i, i + CHUNK).forEach((memberDoc) => {
      batch.update(doc(db, COLLECTIONS.USERS, memberDoc.id), {
        teamId:    null,
        updatedAt: serverTimestamp(),
        updatedBy: actor.uid,
      });
    });
    await batch.commit();
  }

  // 4. Soft-delete the team
  await updateDoc(doc(db, COLLECTIONS.TEAMS, teamId), {
    deleted:      true,
    active:       false,
    membersCount: 0,
    leaderId:     null,
    updatedAt:    serverTimestamp(),
    updatedBy:    actor.uid,
    deletedAt:    serverTimestamp(),
    deletedBy:    actor.uid,
  });

  // 5. Log
  activityLogService.logTeamDeleted({
    actor,
    teamId,
    teamName,
    affectedCount: memberDocs.length,
  }).catch(console.warn);
}

// ─── public API ───────────────────────────────────────────────────────────────

export const teamsService = {
  getAll,
  getActive,
  getById,
  create,
  update,
  activate,
  deactivate,
  assignLeader,
  removeLeader,
  safeDelete,

  /** @deprecated Use safeDelete — kept for backward compat with existing hooks */
  softDelete: (id: string, updatedBy?: string) =>
    updateDoc(doc(db, COLLECTIONS.TEAMS, id), {
      deleted:   true,
      active:    false,
      updatedAt: serverTimestamp(),
      ...(updatedBy ? { updatedBy } : {}),
    }),
};
