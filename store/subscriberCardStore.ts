import { create } from "zustand";
import type { Subscriber } from "@/types";

interface SubscriberCardStore {
  subscriber: Subscriber | null;
  open:  (subscriber: Subscriber) => void;
  close: () => void;
}

export const useSubscriberCardStore = create<SubscriberCardStore>((set) => ({
  subscriber: null,
  open:  (subscriber) => set({ subscriber }),
  close: ()           => set({ subscriber: null }),
}));
