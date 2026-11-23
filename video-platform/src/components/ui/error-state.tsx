import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Design } from '@/constants/design';
import { useDesignTheme } from '@/contexts/theme-context';

export type ErrorStateProps = {
  title?: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function ErrorState({
  title = 'Something went wrong',
  message,
  retryLabel = 'Try again',
  onRetry,
  style,
}: ErrorStateProps) {
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
      <View style={[styles.iconBadge, { backgroundColor: colors.dangerSurface }]}>
        <SymbolView
          name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
          size={28}
          tintColor={colors.danger}
        />
      </View>

      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.muted }]}>{message}</Text>

      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryBtn,
            { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <SymbolView
            name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
            size={16}
            tintColor={colors.text}
          />
          <Text style={[styles.retryText, { color: colors.text }]}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderRadius: Design.radius.lg,
    borderWidth: 1,
    gap: 10,
    marginTop: 8,
  },
  iconBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    ...Design.typography.heading,
    textAlign: 'center',
  },
  message: {
    ...Design.typography.body,
    textAlign: 'center',
    maxWidth: 340,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: Design.touch.minTarget,
    paddingHorizontal: 22,
    borderRadius: Design.radius.pill,
    borderWidth: 1,
    marginTop: 6,
  },
  retryText: {
    ...Design.typography.bodyStrong,
  },
  pressed: {
    opacity: 0.85,
  },
});
