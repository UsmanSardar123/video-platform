import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { EmptyState, ErrorState } from '@/components/ui';
import { VideoCard } from '@/components/video-card';
import { VideoCardSkeleton } from '@/components/video-card-skeleton';
import { VideoSearchBar } from '@/components/video-search-bar';
import { Design } from '@/constants/design';
import { useDesignTheme } from '@/contexts/theme-context';
import { apiRequest, type ApiEnvelope } from '@/lib/api';
import { type VideoRecord } from '@/types/video';

type SourceFilter = 'all' | VideoRecord['sourceType'];
type SearchResponse = ApiEnvelope<VideoRecord[]> & {
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export default function ExploreScreen() {
  const { colors, isDark } = useDesignTheme();

  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [query, setQuery] = useState('');
  const [creator, setCreator] = useState('');
  const [sourceType, setSourceType] = useState<SourceFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const activeSearch = useRef('');
  const moreRequest = useRef(false);

  const searchPath = useCallback(
    (currentPage: number) => {
      const params = new URLSearchParams({ page: String(currentPage), limit: '20' });
      if (query.trim()) params.set('q', query.trim());
      if (creator.trim()) params.set('creator', creator.trim());
      if (sourceType !== 'all') params.set('sourceType', sourceType);
      return `/api/search?${params.toString()}`;
    },
    [creator, query, sourceType]
  );

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      const requestKey = `${searchPath(1)}#${retryKey}`;
      activeSearch.current = requestKey;
      const timer = setTimeout(async () => {
        setLoading(true);
        setError('');
        setPage(1);
        try {
          const response = (await apiRequest<VideoRecord[]>(searchPath(1), {
            signal: controller.signal,
          })) as SearchResponse;
          if (!controller.signal.aborted && activeSearch.current === requestKey) {
            setVideos(response.data || []);
            setTotalPages(response.pagination?.totalPages || 1);
          }
        } catch (cause) {
          if (!controller.signal.aborted && activeSearch.current === requestKey) {
            setError(cause instanceof Error ? cause.message : 'Could not load videos.');
          }
        } finally {
          if (!controller.signal.aborted && activeSearch.current === requestKey) {
            setLoading(false);
            setRefreshing(false);
          }
        }
      }, 220);
      return () => {
        clearTimeout(timer);
        controller.abort();
      };
    }, [retryKey, searchPath])
  );

  const loadMore = useCallback(async () => {
    if (moreRequest.current || loading || page >= totalPages) return;
    moreRequest.current = true;
    setLoadingMore(true);
    setError('');
    const nextPage = page + 1;
    const requestKey = `${searchPath(1)}#${retryKey}`;
    try {
      const response = (await apiRequest<VideoRecord[]>(searchPath(nextPage))) as SearchResponse;
      if (activeSearch.current === requestKey) {
        setVideos((current) => {
          const seen = new Set(current.map((v) => v._id));
          const fresh = (response.data || []).filter((v) => !seen.has(v._id));
          return [...current, ...fresh];
        });
        setPage(nextPage);
        setTotalPages(response.pagination?.totalPages || 1);
      }
    } catch (cause) {
      if (activeSearch.current === requestKey) {
        setError(cause instanceof Error ? cause.message : 'Could not load more videos.');
      }
    } finally {
      moreRequest.current = false;
      setLoadingMore(false);
    }
  }, [loading, page, retryKey, searchPath, totalPages]);

  const sourceOptions = useMemo(
    () => ['all', 'cloudinary', 'youtube', 'vimeo', 'twitch'] as const,
    []
  );

  const formatSource = (source: string) => {
    if (source === 'all') return 'All sources';
    if (source === 'cloudinary') return 'Uploaded';
    if (source === 'youtube') return 'YouTube';
    if (source === 'vimeo') return 'Vimeo';
    if (source === 'twitch') return 'Twitch';
    return source;
  };

  const hasActiveFilters = Boolean(query.trim() || creator.trim() || sourceType !== 'all');

  const clearAll = () => {
    setQuery('');
    setCreator('');
    setSourceType('all');
  };

  const renderFiltersHeader = () => (
    <View style={styles.filtersContainer}>
      {showFilters ? (
        <View
          style={[
            styles.filterCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
            !isDark && Design.shadow.sm,
          ]}
        >
          <Text style={[styles.filterLabel, { color: colors.muted }]}>CREATOR</Text>
          <TextInput
            accessibilityLabel="Filter by creator username or display name"
            style={[
              styles.creatorFilter,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            placeholder="Username or display name"
            placeholderTextColor={colors.muted}
            value={creator}
            onChangeText={setCreator}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.filterLabel, { color: colors.muted }]}>SOURCE</Text>
          <View style={styles.filters}>
            {sourceOptions.map((option) => {
              const isSelected = sourceType === option;
              return (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setSourceType(option)}
                  style={[
                    styles.filter,
                    {
                      backgroundColor: isSelected ? colors.accentSurface : colors.surfaceRaised,
                      borderColor: isSelected ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      {
                        color: isSelected ? colors.accent : colors.secondary,
                        fontWeight: isSelected ? '700' : '600',
                      },
                    ]}
                  >
                    {formatSource(option)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {hasActiveFilters ? (
        <View style={styles.activeRow}>
          <Text style={[styles.activeLabel, { color: colors.muted }]}>
            {loading ? 'Searching…' : `${videos.length} result${videos.length === 1 ? '' : 's'}`}
          </Text>
          <Pressable onPress={clearAll} hitSlop={8}>
            <Text style={[styles.clearText, { color: colors.accent }]}>Clear all</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Mobile Search Bar Header */}
      <View style={[styles.topRow, { borderBottomColor: colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={10}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/main'))}
          style={styles.iconBtn}
        >
          <SymbolView
            name={{ ios: 'chevron.backward', android: 'arrow_back', web: 'arrow_back' }}
            size={22}
            tintColor={colors.text}
          />
        </Pressable>

        <View style={styles.searchWrap}>
          <VideoSearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search Streanub"
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Toggle search filters"
          hitSlop={10}
          onPress={() => setShowFilters((v) => !v)}
          style={[
            styles.iconBtn,
            (showFilters || Boolean(creator.trim()) || sourceType !== 'all') && {
              backgroundColor: colors.accentSurface,
            },
          ]}
        >
          <SymbolView
            name={{ ios: 'line.3.horizontal.decrease.circle', android: 'tune', web: 'tune' }}
            size={21}
            tintColor={
              showFilters || Boolean(creator.trim()) || sourceType !== 'all'
                ? colors.accent
                : colors.text
            }
          />
        </Pressable>
      </View>

      <FlatList
        data={videos}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <VideoCard
            video={item}
            onPress={() =>
              router.push({ pathname: '/watch', params: { id: item._id } } as Href)
            }
          />
        )}
        ListHeaderComponent={renderFiltersHeader}
        ListEmptyComponent={
          loading ? (
            <View>
              <VideoCardSkeleton />
              <VideoCardSkeleton />
            </View>
          ) : error ? (
            <ErrorState
              title="Search unavailable"
              message={error}
              onRetry={() => setRetryKey((v) => v + 1)}
            />
          ) : (
            <EmptyState
              icon={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
              title={hasActiveFilters ? 'No matches found' : 'No public videos yet'}
              description={
                hasActiveFilters
                  ? 'Try another keyword or clear your creator/source filters.'
                  : 'New community videos will appear here as creators publish.'
              }
              actionLabel={hasActiveFilters ? 'Clear filters' : undefined}
              onAction={hasActiveFilters ? clearAll : undefined}
            />
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : undefined
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setRetryKey((v) => v + 1);
            }}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.45}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flex: 1,
    marginBottom: -18,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 32,
    width: '100%',
    maxWidth: 880,
    alignSelf: 'center',
    flexGrow: 1,
  },
  filtersContainer: {
    marginBottom: 8,
  },
  filterCard: {
    padding: 14,
    borderRadius: Design.radius.md,
    borderWidth: 1,
    marginBottom: 12,
  },
  filterLabel: {
    letterSpacing: 1.2,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 8,
  },
  creatorFilter: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Design.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    fontSize: 14,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filter: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: Design.radius.pill,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 12,
  },
  activeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  activeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  clearText: {
    fontSize: 13,
    fontWeight: '700',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
