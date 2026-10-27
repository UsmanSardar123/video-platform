import { StyleSheet } from 'react-native';
import { View } from '@/components/theme-native';
import { Design } from '@/constants/design';
import { useThemeMode } from '@/contexts/theme-context';

export function VideoCardSkeleton() {
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  return (
    <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
      {/* 16:9 Thumbnail skeleton */}
      <View style={[styles.thumbnail, isDark ? styles.skeletonDark : styles.skeletonLight]} />

      {/* Info row */}
      <View style={styles.infoRow}>
        {/* Avatar skeleton */}
        <View style={[styles.avatar, isDark ? styles.skeletonDark : styles.skeletonLight]} />

        {/* Text lines */}
        <View style={styles.textBlock}>
          <View style={[styles.titleLine1, isDark ? styles.skeletonDark : styles.skeletonLight]} />
          <View style={[styles.titleLine2, isDark ? styles.skeletonDark : styles.skeletonLight]} />
          <View style={[styles.metaLine, isDark ? styles.skeletonDark : styles.skeletonLight]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Design.radius.lg,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
  },
  cardDark: {
    backgroundColor: Design.color.surface,
    borderColor: Design.color.border,
  },
  cardLight: {
    backgroundColor: Design.light.surface,
    borderColor: Design.light.border,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  infoRow: {
    flexDirection: 'row',
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  textBlock: {
    flex: 1,
    gap: 8,
    paddingTop: 2,
  },
  titleLine1: {
    width: '90%',
    height: 14,
    borderRadius: 4,
  },
  titleLine2: {
    width: '60%',
    height: 14,
    borderRadius: 4,
  },
  metaLine: {
    width: '45%',
    height: 11,
    borderRadius: 4,
    marginTop: 2,
  },
  skeletonDark: {
    backgroundColor: '#1f2732',
  },
  skeletonLight: {
    backgroundColor: '#e2e7ef',
  },
});
