import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { Design } from '@/constants/design';

export type ToastTone = 'success' | 'error' | 'info';
type ToastValue = { showToast: (message: string, tone?: ToastTone) => void };
type ToastItem = { id: number; message: string; tone: ToastTone };
const ToastContext = createContext<ToastValue | null>(null);

const TONE_META: Record<
  ToastTone,
  { bg: string; icon: { ios: string; android: string; web: string } }
> = {
  success: {
    bg: '#166534',
    icon: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  },
  error: {
    bg: '#991b1b',
    icon: { ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' },
  },
  info: {
    bg: '#1e293b',
    icon: { ios: 'info.circle.fill', android: 'info', web: 'info' },
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastItem | null>(null);

  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(
      () => setToast((current) => (current?.id === toast.id ? null : current)),
      3600
    );
    return () => clearTimeout(timer);
  }, [toast]);

  const value = useMemo(() => ({ showToast }), [showToast]);
  const meta = toast ? TONE_META[toast.tone] : null;

  return (
    <ToastContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {toast && meta ? (
          <View
            pointerEvents="box-none"
            style={[styles.viewport, { top: Math.max(insets.top, 12) + 8 }]}
          >
            <Pressable
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[styles.toast, { backgroundColor: meta.bg }]}
              onPress={() => setToast(null)}
            >
              <SymbolView name={meta.icon as any} size={18} tintColor="#ffffff" />
              <Text style={styles.toastText} numberOfLines={3}>
                {toast.message}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  viewport: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: Design.zIndex.toast,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 520,
    width: '100%',
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: Design.radius.md,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  toastText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
});
