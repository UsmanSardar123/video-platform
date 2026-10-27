import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import { fetchUnreadCount } from '@/lib/notification-service';

type NotificationContextValue = {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  setUnreadCount: (count: number) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: import('react').ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const inFlightRef = useRef(false);
  const userIdRef = useRef(userId);
  const [counter, setCounter] = useState<{ userId: string | null; count: number }>({ userId: null, count: 0 });
  // A count belonging to a previous user is never exposed to the current one.
  const unreadCount = userId && counter.userId === userId ? counter.count : 0;
  const setUnreadCount = useCallback((count: number) => {
    setCounter({ userId: userIdRef.current, count });
  }, []);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const refreshUnreadCount = useCallback(async () => {
    if (!userIdRef.current || inFlightRef.current) return;
    inFlightRef.current = true;
    const requestedFor = userIdRef.current;
    try {
      const count = await fetchUnreadCount();
      if (userIdRef.current === requestedFor) setCounter({ userId: requestedFor, count });
    } catch {
      // The badge is non-critical; keep the last known value.
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  // Load once per signed-in user.
  useEffect(() => {
    if (userId) void refreshUnreadCount();
  }, [userId, refreshUnreadCount]);

  // Refresh unread count when app returns to foreground
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active' && userIdRef.current) {
        void refreshUnreadCount();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      sub.remove();
    };
  }, [refreshUnreadCount]);

  const value = useMemo(
    () => ({ unreadCount, refreshUnreadCount, setUnreadCount }),
    [unreadCount, refreshUnreadCount, setUnreadCount]
  );
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
}
