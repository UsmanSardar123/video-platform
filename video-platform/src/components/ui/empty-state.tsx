import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Design } from '@/constants/design';
import { useDesignTheme } from '@/contexts/theme-context';

export type EmptyStateProps = {
  icon: { ios: string; android: string; web: string };
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
  accentIcon?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
  accentIcon = false,
  style,
}: EmptyStateProps) {
  const { colors, isDark } = useDesignTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        !isDark && Design.shadow.sm,
        style,
      ]}
    >
      <View
        style={[
          styles.iconBadge,
          { backgroundColor: accentIcon ? colors.accentSurface : colors.surfaceRaised },
        ]}
      >
        <SymbolView
          name={icon as any}
          size={30}
          tintColor={accentIcon ? colors.accent : colors.muted}
        />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.muted }]}>{description}</Text>

      {actionLabel && onAction ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={onAction}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: colors.accent },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryText}>{actionLabel}</Text>
          </Pressable>

          {secondaryLabel && onSecondaryAction ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={secondaryLabel}
              onPress={onSecondaryAction}
              style={({ pressed }) => [
                styles.secondaryBtn,
                { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.secondaryText, { color: colors.text }]}>{secondaryLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    paddingVertical: 38,
    paddingHorizontal: 24,
    borderRadius: Design.radius.lg,
    borderWidth: 1,
    gap: 10,
    marginTop: 8,
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    ...Design.typography.heading,
    textAlign: 'center',
  },
  description: {
    ...Design.typography.body,
    textAlign: 'center',
    maxWidth: 340,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  primaryBtn: {
    minHeight: Design.touch.minTarget,
    paddingHorizontal: 22,
    borderRadius: Design.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryBtn: {
    minHeight: Design.touch.minTarget,
    paddingHorizontal: 20,
    borderRadius: Design.radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    ...Design.typography.bodyStrong,
  },
  pressed: {
    opacity: 0.85,
  },
});
