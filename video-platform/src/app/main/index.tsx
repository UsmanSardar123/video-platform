import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader, EmptyState, ErrorState } from '@/components/ui';
import { CategoryChipBar } from '@/components/category-chip-bar';
import { VideoCard } from '@/components/video-card';
import { VideoCardSkeleton } from '@/components/video-card-skeleton';
import { FEED_CATEGORIES } from '@/constants/categories';
import { useAuth } from '@/contexts/auth-context';
import { useNotifications } from '@/contexts/notification-context';
import { useDesignTheme } from '@/contexts/theme-context';
import { apiRequest, type ApiEnvelope } from '@/lib/api';
import { type VideoRecord } from '@/types/video';

type FeedResponse = ApiEnvelope<VideoRecord[]> & {
  pagination?: { page: number; limit: number; total: number; totalPages: number };
};

export default function HomeScreen() {
  const { colors, isDark } = useDesignTheme();
  const { user } = useAuth();
  const { refreshUnreadCount } = useNotifications();

  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const abortControllerRef = useRef<AbortController | null>(null);
  const categoryRef = useRef(category);
  const pageRef = useRef(page);
  const totalPagesRef = useRef(totalPages);

  useEffect(() => {
    categoryRef.current = category;
    pageRef.current = page;
    totalPagesRef.current = totalPages;
  }, [category, page, totalPages]);

  const loadVideos = useCallback(
    async (
      targetPage: number,
      pull: boolean,
      targetCategory: string,
      signal?: AbortSignal
    ) => {
      if (pull) setRefreshing(true);
      else if (targetPage === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        const catParam =
          targetCategory !== 'All' ? `category=${encodeURIComponent(targetCategory)}&` : '';
        const endpoint = `/api/videos?${catParam}page=${targetPage}&limit=20`;

        const result = (await apiRequest<VideoRecord[]>(endpoint, { signal })) as FeedResponse;

        if (!signal?.aborted) {
          const newVideos = result.data || [];
          const pages = result.pagination?.totalPages || 1;

          if (targetPage === 1) {
            setVideos(newVideos);
            setPage(1);
            setTotalPages(pages);
          } else {
            setVideos((prev) => {
              const existingIds = new Set(prev.map((v: VideoRecord) => v._id));
              const uniqueNew = newVideos.filter((v: VideoRecord) => !existingIds.has(v._id));
              return [...prev, ...uniqueNew];
            });
            setPage(targetPage);
            setTotalPages(pages);
          }

          setError('');
        }
      } catch (cause) {
        if (!signal?.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load videos.');
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      void refreshUnreadCount();
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      void loadVideos(1, false, categoryRef.current, controller.signal);

      return () => {
        controller.abort();
      };
    }, [loadVideos, refreshUnreadCount])
  );

  const handleCategorySelect = useCallback(
    (newCategory: string) => {
      setCategory(newCategory);
      setVideos([]);
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      void loadVideos(1, false, newCategory, controller.signal);
    },
    [loadVideos]
  );

  const handleRefresh = useCallback(() => {
    void loadVideos(1, true, categoryRef.current);
  }, [loadVideos]);

  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore || pageRef.current >= totalPagesRef.current) return;
    void loadVideos(pageRef.current + 1, false, categoryRef.current);
  }, [loading, loadingMore, loadVideos]);

  const openVideo = useCallback((id: string) => {
    router.push({ pathname: '/watch', params: { id } });
  }, []);

  const renderHeader = useMemo(() => {
    return (
      <View style={styles.headerArea}>
        <CategoryChipBar
          categories={FEED_CATEGORIES}
          selectedCategory={category}
          onSelectCategory={handleCategorySelect}
        />

        {category !== 'All' ? (
          <View style={styles.filterBar}>
            <Text style={[styles.filterBarText, { color: colors.muted }]}>
              Category:{' '}
              <Text style={{ color: colors.text, fontWeight: '700' }}>{category}</Text>
              {!loading && videos.length > 0
                ? ` • ${videos.length} video${videos.length === 1 ? '' : 's'}`
                : ''}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear category filter"
              onPress={() => handleCategorySelect('All')}
              style={styles.clearFilterBtn}
            >
              <Text style={[styles.clearFilterText, { color: colors.accent }]}>Show All</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }, [category, colors.accent, colors.muted, colors.text, handleCategorySelect, loading, videos.length]);

  const renderEmpty = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.skeletonContainer}>
          <VideoCardSkeleton />
          <VideoCardSkeleton />
          <VideoCardSkeleton />
        </View>
      );
    }

    if (error) {
      return (
        <ErrorState
          title="Videos could not be loaded"
          message={error}
          onRetry={() => void loadVideos(1, false, category)}
        />
      );
    }

    if (category !== 'All') {
      return (
        <EmptyState
          icon={{ ios: 'film', android: 'movie', web: 'movie' }}
          title="No videos in this category"
          description={`There are currently no published videos in ${category}.`}
          actionLabel="View All Videos"
          onAction={() => handleCategorySelect('All')}
        />
      );
    }

    return (
      <EmptyState
        icon={{ ios: 'video.badge.plus', android: 'video_call', web: 'video_call' }}
        accentIcon
        title="Your feed is ready for its first video"
        description="Videos published by Streanub creators will appear here."
        actionLabel={user?.role === 'creator' ? 'Upload Video' : 'Explore Search'}
        onAction={() => router.push(user?.role === 'creator' ? '/upload' : '/explore')}
      />
    );
  }, [category, error, handleCategorySelect, loadVideos, loading, user?.role]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <AppHeader showThemeToggle bordered />

      <FlatList
        data={videos}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <VideoCard video={item} onPress={() => openVideo(item._id)} />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        removeClippedSubviews
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMoreFooter}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : undefined
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 32,
    width: '100%',
    maxWidth: 880,
    alignSelf: 'center',
  },
  headerArea: {
    marginBottom: 2,
  },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginBottom: 10,
  },
  filterBarText: {
    fontSize: 13,
  },
  clearFilterBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  clearFilterText: {
    fontSize: 13,
    fontWeight: '700',
  },
  skeletonContainer: {
    paddingTop: 4,
  },
  loadingMoreFooter: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
