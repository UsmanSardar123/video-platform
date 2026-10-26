import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { Pressable, Text, View } from '@/components/theme-native';

type ToastTone = 'success' | 'error';
type ToastValue = { showToast: (message: string, tone?: ToastTone) => void };
type ToastItem = { id: number; message: string; tone: ToastTone };
const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    setToast({ id: Date.now(), message, tone });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast((current) => current?.id === toast.id ? null : current), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  const value = useMemo(() => ({ showToast }), [showToast]);
  return <ToastContext.Provider value={value}>
    <View style={styles.root}>
      {children}
      {toast ? <View pointerEvents="box-none" style={styles.viewport}>
        <Pressable accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.toast, toast.tone === 'error' && styles.error]} onPress={() => setToast(null)}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </Pressable>
      </View> : null}
    </View>
  </ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, viewport: { position: 'absolute', top: 12, left: 12, right: 12, alignItems: 'center' },
  toast: { maxWidth: 600, minHeight: 46, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, backgroundColor: '#1d6737', elevation: 8 },
  error: { backgroundColor: '#8f2626' }, toastText: { color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
