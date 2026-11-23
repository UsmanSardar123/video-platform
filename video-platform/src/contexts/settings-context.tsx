import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { Image } from 'expo-image';
import * as SecureStore from 'expo-secure-store';
import { clearHistory, fetchUserPreferences, updateUserPreferences } from '@/lib/video-service';
import { useAuth } from '@/contexts/auth-context';

export type AppSettings = {
  autoplay: boolean;
  startMuted: boolean;
  dataSaver: boolean;
  notifySubscriptions: boolean;
  notifyComments: boolean;
  notifyNewVideos: boolean;
  historyPaused: boolean;
};

const DEFAULT_SETTINGS: AppSettings = {
  autoplay: true,
  startMuted: false,
  dataSaver: false,
  notifySubscriptions: true,
  notifyComments: true,
  notifyNewVideos: true,
  historyPaused: false,
};

const SETTINGS_KEY = 'streanub_user_settings';

type SettingsContextValue = {
  settings: AppSettings;
  loading: boolean;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  clearLocalCache: () => Promise<void>;
  clearWatchHistory: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

const settingsKey = (userId: string | null) => `${SETTINGS_KEY}:${userId ?? 'guest'}`;

async function readSettings(userId: string | null): Promise<AppSettings> {
  const key = settingsKey(userId);
  try {
    const raw = Platform.OS === 'web'
      ? globalThis.localStorage?.getItem(key)
      : await SecureStore.getItemAsync(key);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function writeSettings(userId: string | null, settings: AppSettings) {
  const key = settingsKey(userId);
  try {
    const json = JSON.stringify(settings);
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, json);
    } else {
      await SecureStore.setItemAsync(key, json);
    }
  } catch {
    // Non-blocking in-memory fallback
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsOwnerId, setSettingsOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const localSaved = await readSettings(userId);
      if (mounted) {
        setSettings(localSaved);
        setSettingsOwnerId(userId);
        setLoading(false);
      }
      if (userId) {
        try {
          const remote = await fetchUserPreferences();
          if (mounted) {
            const merged = { ...DEFAULT_SETTINGS, ...remote };
            setSettings(merged);
            setSettingsOwnerId(userId);
            void writeSettings(userId, merged);
          }
        } catch {
          // Offline / unauthenticated fallback keeps local preferences.
        }
      }
    };
    void load();
    return () => { mounted = false; };
  }, [userId]);

  const visibleSettings = settingsOwnerId === userId ? settings : DEFAULT_SETTINGS;

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    setSettings((current) => {
      const base = settingsOwnerId === userId ? current : DEFAULT_SETTINGS;
      const updated = { ...base, ...partial };
      void writeSettings(userId, updated);
      return updated;
    });
    setSettingsOwnerId(userId);
    if (userId) {
      try {
        const synced = await updateUserPreferences(partial);
        setSettings((current) => {
          const merged = { ...current, ...synced };
          void writeSettings(userId, merged);
          return merged;
        });
      } catch {
        // Local update remains applied when offline.
      }
    }
  }, [settingsOwnerId, userId]);

  const clearLocalCache = useCallback(async () => {
    // Safely clear image & transient device caches without affecting user tokens or uploads
    try {
      if (Platform.OS === 'web') {
        const keysToRemove: string[] = [];
        for (let i = 0; i < (globalThis.localStorage?.length || 0); i++) {
          const key = globalThis.localStorage?.key(i);
          if (key && (key.startsWith('streanub_cache_') || key.startsWith('streanub_temp_'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => globalThis.localStorage?.removeItem(k));
      } else {
        await Promise.allSettled([
          typeof Image.clearMemoryCache === 'function' ? Image.clearMemoryCache() : Promise.resolve(),
          typeof Image.clearDiskCache === 'function' ? Image.clearDiskCache() : Promise.resolve(),
        ]);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  const clearWatchHistory = useCallback(async () => {
    await clearHistory();
  }, []);

  const value = useMemo(
    () => ({ settings: visibleSettings, loading: loading || settingsOwnerId !== userId, updateSettings, clearLocalCache, clearWatchHistory }),
    [visibleSettings, loading, settingsOwnerId, userId, updateSettings, clearLocalCache, clearWatchHistory]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
}
