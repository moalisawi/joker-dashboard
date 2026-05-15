import { create } from "zustand";

interface SearchStore {
  open: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
}

export const useSearchStore = create<SearchStore>((set) => ({
  open: false,
  openSearch:  () => set({ open: true }),
  closeSearch: () => set({ open: false }),
  toggleSearch: () => set((s) => ({ open: !s.open })),
}));
