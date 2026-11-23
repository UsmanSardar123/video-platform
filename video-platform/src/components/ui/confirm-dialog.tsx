import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Design } from '@/constants/design';
import { useDesignTheme } from '@/contexts/theme-context';
import { BottomSheet } from './bottom-sheet';

export type ConfirmDialogProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  icon?: { ios: string; android: string; web: string };
};

export function ConfirmDialog({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  icon,
}: ConfirmDialogProps) {
  const { colors } = useDesignTheme();

  const accentBg = destructive ? colors.danger : colors.accent;
  const iconSurface = destructive ? colors.dangerSurface : colors.accentSurface;

  return (
    <BottomSheet visible={visible} onClose={busy ? () => {} : onClose} maxWidth={440}>
      <View style={styles.content}>
        {icon ? (
          <View style={[styles.iconCircle, { backgroundColor: iconSurface }]}>
            <SymbolView name={icon as any} size={26} tintColor={accentBg} />
          </View>
        ) : null}
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.message, { color: colors.secondary }]}>{message}</Text>

        <View style={styles.actions}>
          <Pressable
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={cancelLabel}
            onPress={onClose}
            style={({ pressed }) => [
              styles.secondaryBtn,
              { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
          >
            <Text style={[styles.secondaryText, { color: colors.text }]}>{cancelLabel}</Text>
          </Pressable>

          <Pressable
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: accentBg },
              pressed && styles.pressed,
              busy && styles.disabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.primaryText}>{confirmLabel}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingTop: 4,
    paddingHorizontal: 6,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    ...Design.typography.heading,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    ...Design.typography.body,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: Design.radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    ...Design.typography.bodyStrong,
  },
  primaryBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: Design.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.55,
  },
});
