import { create } from "zustand";
import type { AppNotification } from "@/types";

interface NotificationState {
  notifications: AppNotification[];
  loading: boolean;

  setNotifications:  (list: AppNotification[]) => void;
  setLoading:        (v: boolean) => void;
  addNotification:   (n: AppNotification) => void;

  /** Mark as read locally (optimistic). Service call should happen separately. */
  markReadLocally:   (id: string, uid: string) => void;
  markAllReadLocally:(uid: string) => void;
  archiveLocally:    (id: string) => void;

  unreadCount: (uid: string) => number;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  loading: true,

  setNotifications: (list) => set({ notifications: list, loading: false }),
  setLoading:       (v)    => set({ loading: v }),

  addNotification: (n) =>
    set((s) => ({
      notifications: [n, ...s.notifications.filter((x) => x.id !== n.id)],
    })),

  markReadLocally: (id, uid) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id && !n.readBy.includes(uid)
          ? { ...n, readBy: [...n.readBy, uid] }
          : n
      ),
    })),

  markAllReadLocally: (uid) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.readBy.includes(uid) ? n : { ...n, readBy: [...n.readBy, uid] }
      ),
    })),

  archiveLocally: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),

  unreadCount: (uid) =>
    get().notifications.filter((n) => !n.readBy.includes(uid) && !n.archived).length,
}));
