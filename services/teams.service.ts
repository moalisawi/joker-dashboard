import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firestore";
import { COLLECTIONS } from "@/constants/collections";
import type { Team, TeamType } from "@/types";

type TeamCreateInput = {
  name: string;
  type: TeamType;
  active?: boolean;
  createdBy?: string;
};

export const teamsService = {
  async getAll(): Promise<Team[]> {
    const snap = await getDocs(
      query(collection(db, COLLECTIONS.TEAMS), where("deleted", "!=", true))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Team);
  },

  async getActive(): Promise<Team[]> {
    const snap = await getDocs(
      query(
        collection(db, COLLECTIONS.TEAMS),
        where("active", "==", true),
        where("deleted", "!=", true)
      )
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Team);
  },

  async getById(id: string): Promise<Team | null> {
    const snap = await getDoc(doc(db, COLLECTIONS.TEAMS, id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Team) : null;
  },

  async create(input: TeamCreateInput): Promise<string> {
    const ref = await addDoc(collection(db, COLLECTIONS.TEAMS), {
      name: input.name,
      type: input.type,
      active: input.active ?? true,
      deleted: false,
      createdBy: input.createdBy ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  },

  async update(
    id: string,
    data: Partial<Pick<Team, "name" | "type" | "active">>,
    updatedBy?: string
  ): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.TEAMS, id), {
      ...data,
      updatedAt: serverTimestamp(),
      ...(updatedBy ? { updatedBy } : {}),
    });
  },

  async deactivate(id: string, updatedBy?: string): Promise<void> {
    await updateDoc(doc(db, COLLECTIONS.TEAMS, id), {
      active: false,
      updatedAt: serverTimestamp(),
      ...(updatedBy ? { updatedBy } : {}),
    });
  },
};
