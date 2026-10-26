import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, Platform, StyleSheet } from 'react-native';
import { Design } from '@/constants/design';

export type ThemeMode = 'light' | 'dark';
type ThemeContextValue = { mode: ThemeMode; toggleTheme: () => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_KEY = 'streanub_theme';

async function readTheme(): Promise<ThemeMode | null> {
  try {
    const value = Platform.OS === 'web'
      ? globalThis.localStorage?.getItem(THEME_KEY)
      : await SecureStore.getItemAsync(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
  } catch { return null; }
}

async function writeTheme(mode: ThemeMode) {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(THEME_KEY, mode);
    else await SecureStore.setItemAsync(THEME_KEY, mode);
  } catch { /* The in-memory preference still applies for this session. */ }
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void readTheme().then((saved) => {
      if (mounted) { if (saved) setMode(saved); setReady(true); }
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    Appearance.setColorScheme(mode);
    void writeTheme(mode);
  }, [mode, ready]);

  const toggleTheme = useCallback(() => setMode((current) => current === 'dark' ? 'light' : 'dark'), []);
  const value = useMemo(() => ({ mode, toggleTheme }), [mode, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return context;
}

const lightColors: Record<string, string> = {
  '#fff': Design.light.text, '#ffffff': Design.light.text, '#f5f7fa': Design.light.text, '#eee': '#262b32', '#ddd': '#303741',
  '#ccc': '#4a5562', '#c0c7d0': Design.light.secondary, '#aaa': Design.light.muted, '#999': Design.light.muted, '#9698a4': Design.light.muted,
  '#a5a5a5': Design.light.muted, '#929dab': Design.light.muted, '#8d8d97': Design.light.muted, '#777': Design.light.muted, '#555': '#7b8591', '#444': '#87919d',
  '#ff7777': Design.light.accent, '#ff6a6a': Design.light.accent, '#ff8b8b': Design.light.accent, '#ff9292': Design.light.danger,
  '#ff9393': Design.light.danger, '#ff8686': Design.light.danger, '#ff7b86': Design.light.danger, '#ffb6b6': '#8e3440',
  '#84d9a0': Design.light.success, '#7fe0a0': Design.light.success, '#72d59a': Design.light.success,
  '#ff3434': Design.light.accent, '#ef4657': Design.light.accent, '#d93849': Design.light.accentPressed,
  '#0d1015': Design.light.background, '#101010': Design.light.background, '#101114': Design.light.background,
  '#151a21': Design.light.surface, '#1b1b1b': Design.light.surface, '#1b1c22': Design.light.surface,
  '#1c232c': Design.light.surfaceRaised, '#202020': Design.light.surfaceRaised, '#242424': Design.light.surfaceRaised,
  '#252525': Design.light.surfaceRaised, '#25262d': Design.light.surfaceRaised, '#292a30': Design.light.surfaceRaised,
  '#2b3440': Design.light.border, '#303030': Design.light.border, '#333': Design.light.border, '#363636': Design.light.border,
  '#383943': Design.light.border, '#080808': Design.light.surfaceRaised, '#050505': Design.light.surfaceRaised,
  '#351f25': Design.light.accentSurface, '#241b1b': '#fff0f0', '#542424': '#f4dede', '#492020': '#fae5e8', '#000c': '#000b',
};

export function themeStyle<T>(style: T, mode: ThemeMode): T {
  if (mode === 'dark' || !style) return style;
  const flattened = StyleSheet.flatten(style as never) as Record<string, unknown> | undefined;
  if (!flattened) return style;
  const result = { ...flattened };
  for (const key of ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor']) {
    const color = result[key];
    if (typeof color === 'string') result[key] = lightColors[color.toLowerCase()] || color;
  }
  return result as T;
}
