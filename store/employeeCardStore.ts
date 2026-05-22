import { create } from "zustand";

interface EmployeeCardStore {
  uid: string | null;
  open:  (uid: string) => void;
  close: () => void;
}

export const useEmployeeCardStore = create<EmployeeCardStore>((set) => ({
  uid:   null,
  open:  (uid) => set({ uid }),
  close: ()    => set({ uid: null }),
}));
