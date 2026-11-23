import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { AppHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { Design } from '@/constants/design';
import { useAuth } from '@/contexts/auth-context';
import { useDesignTheme } from '@/contexts/theme-context';
import { apiRequest } from '@/lib/api';
import { cleanTitle, creatorLabel, durationLabel, formatViews, type VideoRecord } from '@/types/video';

const MAX_SHORT_DURATION_SEC = 60;

export default function ShortsScreen() {
  const { colors, isDark } = useDesignTheme();
  const { user } = useAuth();
  const [shorts, setShorts] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadShorts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await apiRequest<VideoRecord[]>('/api/videos?page=1&limit=40');
      const shortClips = (res.data || []).filter(
        (video) => video.duration > 0 && video.duration <= MAX_SHORT_DURATION_SEC
      );
      setShorts(shortClips);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load Shorts right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadShorts(false);
    }, [loadShorts])
  );

  const renderSkeletonGrid = () => (
    <View style={styles.skeletonGrid}>
      {[0, 1, 2, 3].map((idx) => (
        <View key={idx} style={styles.skeletonCard}>
          <Skeleton width="100%" aspectRatio={9 / 16} borderRadius={Design.radius.md} />
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AppHeader title="Shorts" bordered />

      <FlatList
        data={shorts}
        numColumns={2}
        keyExtractor={(item) => item._id}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadShorts(true)}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Watch Short ${cleanTitle(item.title)}`}
            onPress={() => router.push({ pathname: '/watch', params: { id: item._id } })}
            style={({ pressed }) => [
              styles.shortCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            {item.thumbnailUrl ? (
              <Image
                source={{ uri: item.thumbnailUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={[styles.fallbackThumb, { backgroundColor: colors.surfaceRaised }]}>
                <SymbolView
                  name={{ ios: 'bolt.fill', android: 'bolt', web: 'bolt' }}
                  size={30}
                  tintColor={colors.accent}
                />
              </View>
            )}

            <View style={styles.scrim} />

            {item.duration > 0 ? (
              <View style={styles.durationPill}>
                <Text style={styles.durationText}>{durationLabel(item.duration)}</Text>
              </View>
            ) : null}

            <View style={styles.shortMeta}>
              <Text style={styles.shortTitle} numberOfLines={2}>
                {cleanTitle(item.title)}
              </Text>
              <Text style={styles.shortSub} numberOfLines={1}>
                {creatorLabel(item.creator)} · {formatViews(item.views)}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? (
            renderSkeletonGrid()
          ) : error ? (
            <ErrorState
              title="Shorts unavailable"
              message={error}
              onRetry={() => void loadShorts(false)}
            />
          ) : (
            <EmptyState
              icon={{ ios: 'bolt.fill', android: 'bolt', web: 'bolt' }}
              accentIcon
              title="No Shorts yet"
              description="Short-form videos up to 60 seconds from Streanub creators will appear here."
              actionLabel={user?.role === 'creator' ? 'Upload a Short' : 'Browse Home'}
              onAction={() =>
                router.push(
                  user?.role === 'creator'
                    ? { pathname: '/upload', params: { mode: 'short' } }
                    : '/main'
                )
              }
              secondaryLabel={user?.role === 'creator' ? 'Browse Home' : undefined}
              onSecondaryAction={user?.role === 'creator' ? () => router.push('/main') : undefined}
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  listContent: {
    padding: 12,
    paddingBottom: 32,
    flexGrow: 1,
  },
  columnWrapper: {
    gap: 10,
    marginBottom: 10,
  },
  shortCard: {
    flex: 1,
    aspectRatio: 9 / 16,
    borderRadius: Design.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  fallbackThumb: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
  },
  durationPill: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  durationText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  shortMeta: {
    padding: 10,
    gap: 3,
  },
  shortTitle: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
  },
  shortSub: {
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 11,
    fontWeight: '500',
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  skeletonCard: {
    width: '48%',
  },
  pressed: {
    opacity: 0.88,
  },
});
