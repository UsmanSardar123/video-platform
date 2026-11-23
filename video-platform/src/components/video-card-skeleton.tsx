import { StyleSheet, View } from 'react-native';
import { Skeleton } from '@/components/ui/skeleton';
import { Design } from '@/constants/design';
import { useDesignTheme } from '@/contexts/theme-context';

export function VideoCardSkeleton() {
  const { colors, isDark } = useDesignTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        !isDark && Design.shadow.sm,
      ]}
    >
      <Skeleton width="100%" aspectRatio={16 / 9} borderRadius={0} />

      <View style={styles.infoRow}>
        <Skeleton width={38} height={38} borderRadius={19} />

        <View style={styles.textBlock}>
          <Skeleton width="90%" height={14} borderRadius={5} />
          <Skeleton width="62%" height={14} borderRadius={5} />
          <Skeleton width="46%" height={11} borderRadius={4} style={styles.metaLine} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Design.radius.lg,
    overflow: 'hidden',
    marginBottom: 18,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    padding: 14,
    gap: 12,
  },
  textBlock: {
    flex: 1,
    gap: 8,
    paddingTop: 2,
  },
  metaLine: {
    marginTop: 2,
  },
});
