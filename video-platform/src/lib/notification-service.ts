import { apiRequest, type ApiEnvelope } from './api';

export type NotificationType = 'new_video' | 'new_comment' | 'new_subscriber' | 'comment_reply';

export type NotificationRecord = {
  _id: string;
  type: NotificationType;
  actor?: { _id: string; username?: string; fullName?: string; avatar?: string } | null;
  video?: string | null;
  comment?: string | null;
  message: string;
  link?: { screen?: string; params?: Record<string, string> };
  isRead: boolean;
  createdAt: string;
};

export type NotificationPage = {
  notifications: NotificationRecord[];
  page: number;
  hasMore: boolean;
  total: number;
};

type ListResponse = ApiEnvelope<NotificationRecord[]> & {
  pagination?: { page: number; hasMore: boolean; total: number };
};

export async function fetchNotifications(page = 1, limit = 20): Promise<NotificationPage> {
  const res = (await apiRequest<NotificationRecord[]>(
    `/api/notifications?page=${page}&limit=${limit}`
  )) as ListResponse;
  return {
    notifications: res.data || [],
    page: res.pagination?.page ?? page,
    hasMore: res.pagination?.hasMore ?? false,
    total: res.pagination?.total ?? 0,
  };
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await apiRequest<{ unreadCount: number }>('/api/notifications/unread-count');
  return res.data.unreadCount;
}

export async function markNotificationRead(id: string): Promise<number> {
  const res = await apiRequest<{ unreadCount: number }>(
    `/api/notifications/${encodeURIComponent(id)}/read`,
    { method: 'PATCH' }
  );
  return res.data.unreadCount;
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiRequest('/api/notifications/read-all', { method: 'PATCH' });
}
