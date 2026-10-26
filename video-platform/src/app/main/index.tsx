import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet } from 'react-native';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StatusBar, Text, ThemeToggleButton, View } from '@/components/theme-native';
import { apiRequest } from '@/lib/api';
import { VideoSearchBar } from '@/components/video-search-bar';
import { Design } from '@/constants/design';
import { creatorLabel, durationLabel, type VideoRecord } from '@/types/video';

const C = Design.color;

export default function HomeScreen() {
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [feedHasVideos, setFeedHasVideos] = useState<boolean | null>(null);

  const setFeedExists = (exists: boolean) => {
    setFeedHasVideos(exists);
  };

  const loadVideos = useCallback(async (pull = false, signal?: AbortSignal) => {
    if (pull) setRefreshing(true); else setLoading(true);
    try {
      const term = query.trim();
      if (term) {
        const [results, feed] = await Promise.all([
          apiRequest<VideoRecord[]>(`/api/search?q=${encodeURIComponent(term)}&limit=50`, { signal }),
          apiRequest<VideoRecord[]>('/api/videos?limit=1', { signal }),
        ]);
        if (!signal?.aborted) {
          setVideos(results.data);
          setFeedExists(feed.data.length > 0);
          setError('');
        }
      } else {
        const result = await apiRequest<VideoRecord[]>('/api/videos?limit=50', { signal });
        if (!signal?.aborted) { setVideos(result.data); setFeedExists(result.data.length > 0); setError(''); }
      }
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Could not load videos.');
    } finally { if (!signal?.aborted) { setLoading(false); setRefreshing(false); } }
  }, [query]);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => { void loadVideos(false, controller.signal); }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [loadVideos]));

  const categories = useMemo(() => ['All', ...new Set(videos.map((video) => video.category).filter(Boolean))], [videos]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return videos.filter((video) => (category === 'All' || video.category === category) &&
      (!term || video.title.toLowerCase().includes(term) || creatorLabel(video.creator).toLowerCase().includes(term)));
  }, [category, query, videos]);
  const openVideo = (id: string) => router.push({ pathname: '/watch', params: { id } });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadVideos(true)} tintColor={C.accent} />} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.brandBlock}><Text style={styles.brand}>Streanub</Text><Text style={styles.tagline}>Videos from the community</Text></View>
          <ThemeToggleButton />
        </View>
        <VideoSearchBar value={query} onChangeText={setQuery} />
        {!loading && videos.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
          {categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.chipActive]}><Text style={styles.chipText}>{item}</Text></Pressable>)}
        </ScrollView>}

        {loading && videos.length === 0 ? <View style={styles.state}><ActivityIndicator color={C.accent} /><Text style={styles.stateText}>Loading videos…</Text></View> : null}
        {error ? <View style={styles.state}><Text style={styles.stateTitle}>Videos could not be loaded</Text><Text style={styles.stateText}>{error}</Text><Pressable style={styles.retry} onPress={() => loadVideos()}><Text style={styles.retryText}>Try again</Text></Pressable></View> : null}
        {!loading && !error && feedHasVideos === false && !query.trim() ? <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Your feed is ready for its first video</Text>
          <Text style={styles.stateText}>Share a video with the Streanub community.</Text>
          <Pressable style={styles.uploadButton} onPress={() => router.push('/upload')}><Text style={styles.uploadButtonText}>Upload Video</Text></Pressable>
        </View> : null}
        {!loading && !error && videos.length === 0 && (query.trim() || feedHasVideos === true) ? <View style={styles.state}><Text style={styles.stateTitle}>{query.trim() ? 'No matching videos' : 'No videos in this category'}</Text><Text style={styles.stateText}>{query.trim() ? 'Try another search.' : 'Choose another category to see more.'}</Text></View> : null}
        {!loading && !error && videos.length > 0 && filtered.length === 0 ? <View style={styles.state}><Text style={styles.stateTitle}>No matching videos</Text><Text style={styles.stateText}>Try another search or category.</Text></View> : null}

        {filtered.map((video) => <VideoCard key={video._id} video={video} onPress={() => openVideo(video._id)} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

function VideoCard({ video, onPress }: { video: VideoRecord; onPress: () => void }) {
  return <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Play ${video.title}`}>
    <View style={styles.thumbnailWrap}>
      {video.thumbnailUrl ? <Image source={{ uri: video.thumbnailUrl }} style={styles.thumbnail} contentFit="cover" transition={180} /> : <View style={styles.noThumbnail}><Text style={styles.noThumbnailText}>STREANUB</Text></View>}
      {video.duration > 0 && <Text style={styles.duration}>{durationLabel(video.duration)}</Text>}
    </View>
    <View style={styles.videoMeta}>
      <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text>
      <Text style={styles.creator}>{creatorLabel(video.creator)}</Text>
      <Text style={styles.detail}>{video.category}</Text>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background }, content: { padding: 20, paddingBottom: 34, width: '100%', maxWidth: 960, alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }, brandBlock: { gap: 4 }, brand: { color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.7 }, tagline: { color: C.muted, fontSize: 13 },
  categoryList: { gap: 8, paddingBottom: 18 }, chip: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: Design.radius.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }, chipActive: { backgroundColor: C.accentSurface, borderColor: C.accent }, chipText: { color: C.text, fontSize: 12, fontWeight: '600' },
  card: { backgroundColor: C.surface, borderRadius: Design.radius.lg, overflow: 'hidden', marginBottom: 18, borderWidth: 1, borderColor: C.border }, pressed: { opacity: 0.84 }, thumbnailWrap: { width: '100%', aspectRatio: 16 / 9, backgroundColor: C.surfaceRaised, position: 'relative' }, thumbnail: { width: '100%', height: '100%' }, noThumbnail: { flex: 1, alignItems: 'center', justifyContent: 'center' }, noThumbnailText: { color: C.muted, fontSize: 12, fontWeight: '900', letterSpacing: 3 }, duration: { position: 'absolute', right: 10, bottom: 10, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#000c', borderRadius: 7, color: '#fff', fontSize: 11 },
  videoMeta: { padding: 15, gap: 6 }, videoTitle: { color: C.text, fontSize: 16, fontWeight: '700' }, creator: { color: C.secondary, fontSize: 13 }, detail: { color: C.muted, fontSize: 12 },
  state: { paddingVertical: 42, alignItems: 'center', gap: 12 }, stateTitle: { color: C.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }, stateText: { color: C.muted, fontSize: 13, textAlign: 'center', lineHeight: 20 }, retry: { backgroundColor: C.surfaceRaised, borderWidth: 1, borderColor: C.border, borderRadius: Design.radius.sm, paddingHorizontal: 18, paddingVertical: 11 }, retryText: { color: C.text, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingVertical: 48, marginTop: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: Design.radius.lg }, emptyTitle: { color: C.text, fontSize: 22, fontWeight: '800', textAlign: 'center' }, uploadButton: { minHeight: 48, justifyContent: 'center', marginTop: 10, backgroundColor: C.accent, borderRadius: Design.radius.sm, paddingHorizontal: 25, paddingVertical: 14 }, uploadButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
