// frontend/src/store/notificationStore.ts
// Path: src/store/ (bukan stores/) — sesuai struktur existing
import { create } from 'zustand';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type NotificationType = 'panic_alert' | 'false_alarm' | 'resolved' | 'info';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  incidentId?: string;
  reporterName?: string;
  distanceMeters?: number;
  isStranger?: boolean;
  aiSummary?: string;
  timestamp: Date;
  read: boolean;
}

export interface ActivePanicAlert {
  incidentId: string;
  reporterName: string;
  reporterRole: 'RW' | 'RT' | 'WARGA' | 'STRANGER';
  distanceMeters: number;
  isStranger: boolean;
  aiSummary?: string;
  timestamp: Date;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

interface NotificationStore {
  notifications: AppNotification[];
  activePanic: ActivePanicAlert | null;
  unreadCount: number;

  addNotification: (notif: Omit<AppNotification, 'read'>) => void;
  setActivePanic: (panic: ActivePanicAlert) => void;
  clearActivePanic: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  removeNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationStore>()((set) => ({
  notifications: [],
  activePanic: null,
  unreadCount: 0,

  addNotification: (notif) => {
    set((state) => {
      // Deduplikasi: skip jika incident + type yang sama sudah ada
      const isDuplicate =
        notif.incidentId &&
        state.notifications.some(
          (n) => n.incidentId === notif.incidentId && n.type === notif.type
        );
      if (isDuplicate) return state;

      // Simpan max 50 notifikasi terbaru
      const updated = [{ ...notif, read: false }, ...state.notifications].slice(0, 50);
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      };
    });
  },

  setActivePanic: (panic) => set({ activePanic: panic }),

  clearActivePanic: () => set({ activePanic: null }),

  markRead: (id) => {
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      };
    });
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  removeNotification: (id) => {
    set((state) => {
      const updated = state.notifications.filter((n) => n.id !== id);
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      };
    });
  },
}));