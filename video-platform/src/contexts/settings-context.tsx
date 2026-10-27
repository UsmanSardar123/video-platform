import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { clearHistory } from '@/lib/video-service';

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

async function readSettings(): Promise<AppSettings> {
  try {
    const raw = Platform.OS === 'web'
      ? globalThis.localStorage?.getItem(SETTINGS_KEY)
      : await SecureStore.getItemAsync(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function writeSettings(settings: AppSettings) {
  try {
    const json = JSON.stringify(settings);
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(SETTINGS_KEY, json);
    } else {
      await SecureStore.setItemAsync(SETTINGS_KEY, json);
    }
  } catch {
    // Non-blocking in-memory fallback
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void readSettings().then((saved) => {
      if (mounted) {
        setSettings(saved);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    setSettings((current) => {
      const updated = { ...current, ...partial };
      void writeSettings(updated);
      return updated;
    });
  }, []);

  const clearLocalCache = useCallback(async () => {
    // Safely clear transient cache keys without affecting user tokens or uploads
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
      }
    } catch {
      // Non-blocking
    }
  }, []);

  const clearWatchHistory = useCallback(async () => {
    await clearHistory();
  }, []);

  const value = useMemo(
    () => ({ settings, loading, updateSettings, clearLocalCache, clearWatchHistory }),
    [settings, loading, updateSettings, clearLocalCache, clearWatchHistory]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
}
