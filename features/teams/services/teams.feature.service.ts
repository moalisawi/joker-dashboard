"use client";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
} from "firebase/firestore";
import { db }          from "@/lib/firestore";
import { COLLECTIONS } from "@/constants/collections";
import type { Team, UserProfile } from "@/types";

export const teamsFeatureService = {
  async getTeamById(id: string): Promise<Team | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.TEAMS, id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Team) : null;
  },

  async getMembersByTeamId(teamId: string): Promise<UserProfile[]> {
    const snap = await getDocs(
      query(
        collection(db, COLLECTIONS.USERS),
        where("isEmployee", "==", true),
        where("teamId",     "==", teamId),
        orderBy("name",     "asc")
      )
    );
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
  },

  /**
   * Returns all non-deleted teams.
   * membersCount is read from the stored field — no runtime aggregation.
   */
  async getAllTeams(): Promise<Team[]> {
    const snap = await getDocs(
      query(collection(db, COLLECTIONS.TEAMS), where("deleted", "!=", true))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Team));
  },

  /**
   * @deprecated Runtime aggregation — use getAllTeams() and read team.membersCount instead.
   * Kept temporarily so any remaining call sites don't break during migration.
   */
  async getAllTeamsWithMemberCounts(): Promise<Array<Team & { memberCount: number }>> {
    const teams = await this.getAllTeams();
    return teams.map((t) => ({ ...t, memberCount: t.membersCount ?? 0 }));
  },
};
