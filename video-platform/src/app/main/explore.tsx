import { Image } from 'expo-image';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StatusBar, Text, TextInput, ThemeToggleButton, View } from '@/components/theme-native';
import { VideoSearchBar } from '@/components/video-search-bar';
import { Design } from '@/constants/design';
import { apiRequest, type ApiEnvelope } from '@/lib/api';
import { creatorLabel, type VideoRecord } from '@/types/video';

type SourceFilter = 'all' | VideoRecord['sourceType'];
type SearchResponse = ApiEnvelope<VideoRecord[]> & { pagination: { page: number; limit: number; total: number; totalPages: number } };

export default function ExploreScreen() {
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [query, setQuery] = useState('');
  const [creator, setCreator] = useState('');
  const [sourceType, setSourceType] = useState<SourceFilter>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const activeSearch = useRef('');
  const moreRequest = useRef(false);
  const { width } = useWindowDimensions();
  const columns = width >= 1000 ? 3 : width >= 620 ? 2 : 1;
  const cardWidth = (Math.min(width - 36, 960) - (columns - 1) * 14) / columns;

  const searchPath = useCallback((currentPage: number) => {
    const params = new URLSearchParams({ page: String(currentPage), limit: '20' });
    if (query.trim()) params.set('q', query.trim());
    if (creator.trim()) params.set('creator', creator.trim());
    if (sourceType !== 'all') params.set('sourceType', sourceType);
    return `/api/search?${params.toString()}`;
  }, [creator, query, sourceType]);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    const requestKey = `${searchPath(1)}#${retryKey}`;
    activeSearch.current = requestKey;
    const timer = setTimeout(async () => {
      setLoading(true); setError(''); setPage(1); setVideos([]);
      try {
        const response = await apiRequest<VideoRecord[]>(searchPath(1), { signal: controller.signal }) as SearchResponse;
        if (!controller.signal.aborted && activeSearch.current === requestKey) {
          setVideos(response.data);
          setTotalPages(response.pagination.totalPages);
        }
      } catch (cause) {
        if (!controller.signal.aborted && activeSearch.current === requestKey) setError(cause instanceof Error ? cause.message : 'Could not load videos.');
      } finally { if (!controller.signal.aborted && activeSearch.current === requestKey) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [retryKey, searchPath]));

  const loadMore = async () => {
    if (moreRequest.current || page >= totalPages) return;
    moreRequest.current = true; setLoadingMore(true); setError('');
    const nextPage = page + 1;
    const requestKey = `${searchPath(1)}#${retryKey}`;
    try {
      const response = await apiRequest<VideoRecord[]>(searchPath(nextPage)) as SearchResponse;
      if (activeSearch.current === requestKey) {
        setVideos((current) => [...current, ...response.data]);
        setPage(nextPage); setTotalPages(response.pagination.totalPages);
      }
    } catch (cause) { if (activeSearch.current === requestKey) setError(cause instanceof Error ? cause.message : 'Could not load more videos.'); }
    finally { moreRequest.current = false; setLoadingMore(false); }
  };

  const sourceOptions = useMemo(() => ['all', 'cloudinary', 'youtube', 'vimeo', 'twitch'] as const, []);

  const formatSource = (source: string) => {
    if (source === 'all') return 'All sources';
    if (source === 'cloudinary') return 'Local / File';
    if (source === 'youtube') return 'YouTube';
    if (source === 'vimeo') return 'Vimeo';
    if (source === 'twitch') return 'Twitch';
    return source;
  };

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <StatusBar barStyle="light-content" />
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      onScroll={({ nativeEvent }) => {
        const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
        if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 180) {
          void loadMore();
        }
      }}
      scrollEventThrottle={300}
    >
      <View style={styles.header}><View><Text style={styles.eyebrow}>DISCOVER</Text><Text style={styles.title}>Explore</Text><Text style={styles.subtitle}>Find videos from the community</Text></View><ThemeToggleButton /></View>
      <VideoSearchBar value={query} onChangeText={setQuery} placeholder="Search titles, descriptions, or creators" />
      <Text style={styles.filterLabel}>CREATOR</Text>
      <TextInput accessibilityLabel="Filter by creator username or display name" style={styles.creatorFilter} placeholder="Username or display name" placeholderTextColor={Design.color.muted} value={creator} onChangeText={setCreator} autoCapitalize="none" autoCorrect={false} />
      <Text style={styles.filterLabel}>SOURCE</Text>
      <View style={styles.filters}>{sourceOptions.map((option) => <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: sourceType === option }} onPress={() => setSourceType(option)} style={[styles.filter, sourceType === option && styles.filterSelected]}><Text style={styles.filterText}>{formatSource(option)}</Text></Pressable>)}</View>
      {loading && videos.length === 0 ? <ActivityIndicator color="#ff3434" style={styles.loader} /> : null}
      {error ? <View style={styles.state}><Text style={styles.error}>{error}</Text><Pressable onPress={() => setRetryKey((value) => value + 1)}><Text style={styles.link}>Try again</Text></Pressable></View> : null}
      {!loading && !error && videos.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyTitle}>{query || creator || sourceType !== 'all' ? 'No matches yet' : 'No public videos yet'}</Text><Text style={styles.empty}>{query || creator || sourceType !== 'all' ? 'Try another search or adjust your filters.' : 'New community videos will appear here.'}</Text></View> : null}
      <View style={styles.grid}>{videos.map((video) => <Pressable key={video._id} accessibilityRole="button" accessibilityLabel={`Open ${video.title}`} style={[styles.card, { width: cardWidth }]} onPress={() => router.push({ pathname: '/watch', params: { id: video._id } } as Href)}>
        <View style={styles.imageWrap}>{video.thumbnailUrl ? <Image source={{ uri: video.thumbnailUrl }} style={styles.image} contentFit="cover" /> : <View style={styles.imageFallback}><Text style={styles.fallbackLabel}>{video.sourceType.toUpperCase()}</Text></View>}</View>
        <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text><Text style={styles.creatorName} numberOfLines={1}>{creatorLabel(video.creator)}</Text><Text style={styles.detail}>{formatSource(video.sourceType)} · {video.category}</Text>
      </Pressable>)}</View>
      {loadingMore ? <ActivityIndicator color="#ff3434" style={styles.loader} /> : null}
      {!loading && !error && page < totalPages ? <Pressable style={styles.loadMore} onPress={loadMore}><Text style={styles.link}>Load more videos</Text></Pressable> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Design.color.background }, content: { padding: 20, paddingBottom: 28, width: '100%', maxWidth: 1080, alignSelf: 'center' }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }, eyebrow: { color: Design.color.accent, letterSpacing: 1.8, fontSize: 10, fontWeight: '800' }, title: { color: Design.color.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.6, marginTop: 3 }, subtitle: { color: Design.color.muted, fontSize: 13, marginTop: 4 },
  link: { color: Design.color.accent, fontWeight: '700' }, filterLabel: { color: Design.color.muted, letterSpacing: 1.2, fontSize: 10, fontWeight: '800', marginBottom: 8 }, creatorFilter: { minHeight: 48, borderWidth: 1, borderColor: Design.color.border, borderRadius: Design.radius.sm, backgroundColor: Design.color.surface, color: Design.color.text, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 18 }, filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 }, filter: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 13, borderRadius: Design.radius.pill, backgroundColor: Design.color.surface, borderWidth: 1, borderColor: Design.color.border }, filterSelected: { backgroundColor: Design.color.accentSurface, borderColor: Design.color.accent }, filterText: { color: Design.color.secondary, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  loader: { margin: 30 }, state: { gap: 12, alignItems: 'center', padding: 25 }, error: { color: Design.color.danger, textAlign: 'center' }, emptyState: { gap: 8, alignItems: 'center', paddingVertical: 42, paddingHorizontal: 22, backgroundColor: Design.color.surface, borderColor: Design.color.border, borderWidth: 1, borderRadius: Design.radius.lg }, emptyTitle: { color: Design.color.text, fontSize: 18, fontWeight: '800' }, empty: { color: Design.color.muted, textAlign: 'center', fontSize: 13, lineHeight: 19 }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 14 }, card: { marginBottom: 9, overflow: 'hidden', backgroundColor: Design.color.surface, borderRadius: Design.radius.md, borderWidth: 1, borderColor: Design.color.border }, imageWrap: { width: '100%', aspectRatio: 16 / 9, backgroundColor: Design.color.surfaceRaised, overflow: 'hidden' }, image: { width: '100%', height: '100%' }, imageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' }, fallbackLabel: { color: Design.color.muted, fontSize: 11, fontWeight: '800' }, videoTitle: { color: Design.color.text, fontWeight: '700', fontSize: 14, lineHeight: 19, marginTop: 11, marginHorizontal: 12 }, creatorName: { color: Design.color.secondary, fontSize: 12, marginTop: 5, marginHorizontal: 12 }, detail: { color: Design.color.muted, fontSize: 11, marginTop: 4, marginHorizontal: 12, marginBottom: 12 }, loadMore: { minHeight: 46, justifyContent: 'center', alignItems: 'center', marginTop: 14, backgroundColor: Design.color.surface, borderWidth: 1, borderColor: Design.color.border, borderRadius: Design.radius.sm },
});
