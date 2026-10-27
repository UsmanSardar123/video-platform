import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StatusBar,
  Text,
  ThemeToggleButton,
  View,
} from '@/components/theme-native';
import { apiRequest, type ApiEnvelope } from '@/lib/api';
import { VideoSearchBar } from '@/components/video-search-bar';
import { CategoryChipBar } from '@/components/category-chip-bar';
import { VideoCard } from '@/components/video-card';
import { VideoCardSkeleton } from '@/components/video-card-skeleton';
import { Design } from '@/constants/design';
import { FEED_CATEGORIES } from '@/constants/categories';
import { useThemeMode } from '@/contexts/theme-context';
import { useNotifications } from '@/contexts/notification-context';
import { type VideoRecord } from '@/types/video';

type FeedResponse = ApiEnvelope<VideoRecord[]> & {
  pagination?: { page: number; limit: number; total: number; totalPages: number };
};

export default function HomeScreen() {
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const C = isDark ? Design.color : Design.light;
  const { unreadCount, refreshUnreadCount } = useNotifications();

  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const abortControllerRef = useRef<AbortController | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categoryRef = useRef(category);
  const queryRef = useRef(query);
  const pageRef = useRef(page);
  const totalPagesRef = useRef(totalPages);

  useEffect(() => {
    categoryRef.current = category;
    queryRef.current = query;
    pageRef.current = page;
    totalPagesRef.current = totalPages;
  }, [category, query, page, totalPages]);

  const loadVideos = useCallback(
    async (
      targetPage = 1,
      pull = false,
      targetCategory = categoryRef.current,
      targetQuery = queryRef.current,
      signal?: AbortSignal
    ) => {
      if (pull) setRefreshing(true);
      else if (targetPage === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        const term = targetQuery.trim();
        let endpoint = '';

        if (term) {
          const catParam = targetCategory !== 'All' ? `&category=${encodeURIComponent(targetCategory)}` : '';
          endpoint = `/api/search?q=${encodeURIComponent(term)}${catParam}&page=${targetPage}&limit=20`;
        } else {
          const catParam = targetCategory !== 'All' ? `category=${encodeURIComponent(targetCategory)}&` : '';
          endpoint = `/api/videos?${catParam}page=${targetPage}&limit=20`;
        }

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

  // Single focus effect that cleanly loads feed on mount and refetches on tab focus
  useFocusEffect(
    useCallback(() => {
      void refreshUnreadCount();
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      void loadVideos(1, false, categoryRef.current, queryRef.current, controller.signal);

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
      void loadVideos(1, false, newCategory, queryRef.current, controller.signal);
    },
    [loadVideos]
  );

  const handleQueryChange = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setVideos([]);
        void loadVideos(1, false, categoryRef.current, newQuery, controller.signal);
      }, 300);
    },
    [loadVideos]
  );

  const handleRefresh = useCallback(() => {
    void loadVideos(1, true, categoryRef.current, queryRef.current);
  }, [loadVideos]);

  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore || pageRef.current >= totalPagesRef.current) return;
    const nextPage = pageRef.current + 1;
    void loadVideos(nextPage, false, categoryRef.current, queryRef.current);
  }, [loading, loadingMore, loadVideos]);

  const openVideo = useCallback((id: string) => {
    router.push({ pathname: '/watch', params: { id } });
  }, []);

  const clearFilters = useCallback(() => {
    setQuery('');
    handleCategorySelect('All');
  }, [handleCategorySelect]);

  const renderHeader = useMemo(() => {
    return (
      <View style={styles.headerArea}>
        {/* Top App Bar */}
        <View style={styles.topBar}>
          <View style={styles.brandContainer}>
            <View style={styles.logoIcon}>
              <SymbolView
                name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
                size={18}
                tintColor="#ffffff"
              />
            </View>
            <View style={styles.brandTextBlock}>
              <Text style={[styles.brandTitle, { color: C.text }]}>Streanub</Text>
              <Text style={[styles.brandSubtitle, { color: C.muted }]}>
                Videos from the community
              </Text>
            </View>
          </View>

          <View style={styles.topActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              style={[
                styles.uploadShortcut,
                { backgroundColor: isDark ? Design.color.surfaceRaised : Design.light.surfaceRaised, borderColor: C.border },
              ]}
              onPress={() => router.push('/notifications')}
            >
              <SymbolView
                name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
                size={18}
                tintColor={Design.color.accent}
              />
              {unreadCount > 0 ? (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Upload Video"
              style={[
                styles.uploadShortcut,
                { backgroundColor: isDark ? Design.color.surfaceRaised : Design.light.surfaceRaised, borderColor: C.border },
              ]}
              onPress={() => router.push('/upload')}
            >
              <SymbolView
                name={{ ios: 'plus', android: 'add', web: 'add' }}
                size={18}
                tintColor={Design.color.accent}
              />
            </Pressable>
            <ThemeToggleButton />
          </View>
        </View>

        {/* Search Bar */}
        <VideoSearchBar value={query} onChangeText={handleQueryChange} />

        {/* Category Chip Bar */}
        <CategoryChipBar
          categories={FEED_CATEGORIES}
          selectedCategory={category}
          onSelectCategory={handleCategorySelect}
        />

        {/* Category indication badge when filtered */}
        {category !== 'All' && (
          <View style={styles.filterBar}>
            <Text style={[styles.filterBarText, { color: C.muted }]}>
              Category: <Text style={{ color: C.text, fontWeight: '700' }}>{category}</Text>
              {!loading && videos.length > 0 ? ` • ${videos.length} video${videos.length === 1 ? '' : 's'}` : ''}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear category filter"
              onPress={() => handleCategorySelect('All')}
              style={styles.clearFilterBtn}
            >
              <Text style={[styles.clearFilterText, { color: Design.color.accent }]}>Show All</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }, [C.border, C.muted, C.text, category, handleCategorySelect, handleQueryChange, isDark, loading, query, unreadCount, videos.length]);

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
        <View style={[styles.stateContainer, isDark ? styles.cardDark : styles.cardLight]}>
          <SymbolView
            name={{ ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' }}
            size={36}
            tintColor={Design.color.danger}
          />
          <Text style={[styles.stateTitle, { color: C.text }]}>Videos could not be loaded</Text>
          <Text style={[styles.stateText, { color: C.muted }]}>{error}</Text>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}
            onPress={() => loadVideos(1, false, categoryRef.current, queryRef.current)}
          >
            <Text style={[styles.actionBtnText, { color: C.text }]}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    if (!loading && !error && videos.length === 0) {
      if (query.trim()) {
        return (
          <View style={[styles.stateContainer, isDark ? styles.cardDark : styles.cardLight]}>
            <SymbolView
              name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
              size={36}
              tintColor={C.muted}
            />
            <Text style={[styles.stateTitle, { color: C.text }]}>
              No matching videos
            </Text>
            <Text style={[styles.stateText, { color: C.muted }]}>
              No videos matched &ldquo;{query}&rdquo;{category !== 'All' ? ` in ${category}` : ''}. Try another search term or clear the filter.
            </Text>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}
              onPress={clearFilters}
            >
              <Text style={[styles.actionBtnText, { color: C.text }]}>Clear search & filters</Text>
            </Pressable>
          </View>
        );
      }

      if (category !== 'All') {
        return (
          <View style={[styles.stateContainer, isDark ? styles.cardDark : styles.cardLight]}>
            <SymbolView
              name={{ ios: 'film', android: 'movie', web: 'movie' }}
              size={36}
              tintColor={C.muted}
            />
            <Text style={[styles.stateTitle, { color: C.text }]}>
              No videos in this category
            </Text>
            <Text style={[styles.stateText, { color: C.muted }]}>
              There are currently no videos published in the {category} category.
            </Text>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}
              onPress={() => handleCategorySelect('All')}
            >
              <Text style={[styles.actionBtnText, { color: C.text }]}>View All Videos</Text>
            </Pressable>
          </View>
        );
      }

      return (
        <View style={[styles.stateContainer, isDark ? styles.cardDark : styles.cardLight]}>
          <SymbolView
            name={{ ios: 'video.badge.plus', android: 'video_call', web: 'video_call' }}
            size={40}
            tintColor={Design.color.accent}
          />
          <Text style={[styles.stateTitle, { color: C.text }]}>
            Your feed is ready for its first video
          </Text>
          <Text style={[styles.stateText, { color: C.muted }]}>
            Share a video with the Streanub community to get started.
          </Text>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: Design.color.accent }]}
            onPress={() => router.push('/upload')}
          >
            <Text style={styles.primaryBtnText}>Upload Video</Text>
          </Pressable>
        </View>
      );
    }

    return undefined;
  }, [
    C.border,
    C.muted,
    C.surfaceRaised,
    C.text,
    category,
    clearFilters,
    error,
    handleCategorySelect,
    isDark,
    loadVideos,
    loading,
    query,
    videos.length,
  ]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
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
            tintColor={Design.color.accent}
            colors={[Design.color.accent]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMoreFooter}>
              <ActivityIndicator color={Design.color.accent} />
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
    padding: 16,
    paddingBottom: 36,
    width: '100%',
    maxWidth: 880,
    alignSelf: 'center',
  },
  headerArea: {
    marginBottom: 4,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    minHeight: 48,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: Design.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextBlock: {
    gap: 1,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  brandSubtitle: {
    fontSize: 12,
    letterSpacing: -0.1,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadShortcut: {
    width: 44,
    height: 44,
    borderRadius: Design.radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: Design.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '800' },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginBottom: 12,
  },
  filterBarText: {
    fontSize: 13,
  },
  clearFilterBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  clearFilterText: {
    fontSize: 13,
    fontWeight: '700',
  },
  skeletonContainer: {
    paddingTop: 8,
  },
  stateContainer: {
    alignItems: 'center',
    paddingVertical: 44,
    paddingHorizontal: 24,
    borderRadius: Design.radius.lg,
    borderWidth: 1,
    gap: 12,
    marginTop: 8,
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
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 400,
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: Design.radius.sm,
    paddingHorizontal: 20,
    paddingVertical: 11,
    marginTop: 6,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  primaryBtn: {
    borderRadius: Design.radius.sm,
    paddingHorizontal: 24,
    paddingVertical: 13,
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  loadingMoreFooter: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
