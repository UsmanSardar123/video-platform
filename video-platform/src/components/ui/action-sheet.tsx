import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Design } from '@/constants/design';
import { useDesignTheme } from '@/contexts/theme-context';
import { BottomSheet } from './bottom-sheet';

export type ActionSheetOption = {
  id: string;
  label: string;
  subtitle?: string;
  icon: { ios: string; android: string; web: string };
  destructive?: boolean;
  accent?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export type ActionSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  options: ActionSheetOption[];
  cancelLabel?: string;
};

export function ActionSheet({
  visible,
  onClose,
  title,
  subtitle,
  options,
  cancelLabel = 'Cancel',
}: ActionSheetProps) {
  const { colors, isDark } = useDesignTheme();

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} subtitle={subtitle}>
      <View style={styles.list}>
        {options.map((opt) => {
          const tint = opt.destructive
            ? colors.danger
            : opt.accent
            ? colors.accent
            : colors.text;
          const iconBg = opt.destructive
            ? colors.dangerSurface
            : opt.accent
            ? colors.accentSurface
            : colors.surfaceRaised;

          return (
            <Pressable
              key={opt.id}
              disabled={opt.disabled}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              onPress={() => {
                onClose();
                opt.onPress();
              }}
              style={({ pressed }) => [
                styles.row,
                pressed && {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
                },
                opt.disabled && styles.disabled,
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
                <SymbolView name={opt.icon as any} size={20} tintColor={tint} />
              </View>
              <View style={styles.textBlock}>
                <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
                  {opt.label}
                </Text>
                {opt.subtitle ? (
                  <Text style={[styles.subtitle, { color: colors.muted }]} numberOfLines={1}>
                    {opt.subtitle}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.divider, { backgroundColor: colors.divider }]} />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cancelLabel}
        onPress={onClose}
        style={({ pressed }) => [
          styles.cancelBtn,
          pressed && {
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
          },
        ]}
      >
        <Text style={[styles.cancelText, { color: colors.secondary }]}>{cancelLabel}</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 52,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: Design.radius.md,
  },
  disabled: {
    opacity: 0.45,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...Design.typography.bodyStrong,
  },
  subtitle: {
    ...Design.typography.caption,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
  cancelBtn: {
    minHeight: Design.touch.minTarget,
    borderRadius: Design.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    ...Design.typography.bodyStrong,
  },
});
