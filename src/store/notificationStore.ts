import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotificationType =
  | 'delay_warning'
  | 'assignment'
  | 'weekly_reminder'
  | 'status_change'
  | 'mention'
  | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  projectId?: string;
  taskId?: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;

  addNotification: (notification: Omit<Notification, 'id' | 'isRead' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

function computeUnreadCount(notifications: Notification[]): number {
  return notifications.filter((n) => !n.isRead).length;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: [],
      unreadCount: 0,

      addNotification: (partial) => {
        const notification: Notification = {
          ...partial,
          id: crypto.randomUUID(),
          isRead: false,
          createdAt: new Date().toISOString(),
        };
        set((state) => {
          const updated = [notification, ...state.notifications].slice(0, 100);
          return { notifications: updated, unreadCount: computeUnreadCount(updated) };
        });
      },

      markAsRead: (id) =>
        set((state) => {
          const updated = state.notifications.map((n) =>
            n.id === id ? { ...n, isRead: true } : n
          );
          return { notifications: updated, unreadCount: computeUnreadCount(updated) };
        }),

      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
          unreadCount: 0,
        })),

      removeNotification: (id) =>
        set((state) => {
          const updated = state.notifications.filter((n) => n.id !== id);
          return { notifications: updated, unreadCount: computeUnreadCount(updated) };
        }),

      clearAll: () => set({ notifications: [], unreadCount: 0 }),
    }),
    {
      name: 'dk-flow-notifications',
      partialize: (state: NotificationState) => ({
        notifications: state.notifications,
      }),
      onRehydrateStorage: () => {
        return (state: NotificationState | undefined) => {
          if (state) {
            state.unreadCount = computeUnreadCount(state.notifications);
          }
        };
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as unknown as any
  )
);
