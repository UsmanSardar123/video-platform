import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StatusBar, Text, View } from '@/components/theme-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import { apiRequest } from '@/lib/api';
import { creatorLabel, durationLabel, type VideoRecord } from '@/types/video';
import { Design } from '@/constants/design';

function getEmbedUrl(url: string, sourceType: string): string | null {
  try {
    if (sourceType === 'youtube') {
      const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
      if (match) return `https://www.youtube.com/embed/${match[1]}?autoplay=0&rel=0`;
    }
    if (sourceType === 'vimeo') {
      const match = url.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/);
      if (match) return `https://player.vimeo.com/video/${match[1]}`;
    }
  } catch {}
  return null;
}

export default function WatchScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [video, setVideo] = useState<VideoRecord | null>(null);
  const [related, setRelated] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const player = useVideoPlayer(null, (instance) => { instance.loop = false; });
  const playback = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError('');
      try {
        if (!id) throw new Error('Video ID is missing.');
        const [detail, feed] = await Promise.all([
          apiRequest<VideoRecord>(`/api/videos/${encodeURIComponent(id)}`),
          apiRequest<VideoRecord[]>('/api/videos?limit=8'),
        ]);
        if (!active) return;
        setVideo(detail.data);
        setRelated(feed.data.filter((item) => item._id !== id));
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Could not load this video.'); }
      finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; player.pause(); player.replace(null); };
  }, [id, player]);

  useEffect(() => {
    if (video?.sourceType === 'cloudinary') {
      player.replace(video.videoUrl);
    } else {
      player.pause(); player.replace(null);
    }
    return () => { player.pause(); };
  }, [player, video?._id, video?.sourceType, video?.videoUrl]);

  const openExternal = async () => {
    if (!video || !['youtube', 'vimeo', 'twitch'].includes(video.sourceType)) return;
    try { await WebBrowser.openBrowserAsync(video.videoUrl); }
    catch { setError(`Could not open ${video.sourceType}. Check your connection and try again.`); }
  };

  const embedUrl = video ? getEmbedUrl(video.videoUrl, video.sourceType) : null;

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <StatusBar barStyle="light-content" />
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.link}>‹ Back</Text></Pressable><Text style={styles.brand}>Streanub</Text><Pressable onPress={() => router.push('/main/profile')}><Text style={styles.link}>Profile</Text></Pressable></View>
      {loading ? <ActivityIndicator color="#ff3434" style={styles.state} /> : null}
      {error ? <View style={styles.state}><Text style={styles.error}>{error}</Text><Pressable onPress={() => router.replace({ pathname: '/watch', params: { id } })}><Text style={styles.link}>Try again</Text></Pressable></View> : null}
      {video ? <>
        <View style={styles.player}>
          {video.sourceType === 'cloudinary' ? (
            <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} />
          ) : Platform.OS === 'web' && embedUrl ? (
            <iframe
              src={embedUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={video.title}
            />
          ) : (
            <>
              {video.thumbnailUrl ? <Image source={{ uri: video.thumbnailUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={styles.externalBackground} />}
              <View style={styles.overlay}><Text style={styles.externalLabel}>{video.sourceType === 'youtube' ? 'YouTube video' : video.sourceType === 'vimeo' ? 'Vimeo video' : 'Twitch video'}</Text><Text style={styles.externalInfo}>Playback opens on {video.sourceType === 'youtube' ? 'YouTube' : video.sourceType === 'vimeo' ? 'Vimeo' : 'Twitch'}.</Text><Pressable style={styles.playButton} onPress={openExternal}><Text style={styles.playText}>Open video</Text></Pressable></View>
            </>
          )}
        </View>
        {playback.status === 'error' ? <Text style={styles.error}>This video could not be played. Check the source and try again.</Text> : null}
        <View style={styles.details}>
          <Text style={styles.title}>{video.title}</Text>
          <Text style={styles.creator}>{creatorLabel(video.creator)}</Text>
          <Text style={styles.meta}>{video.category}{video.duration ? ` · ${durationLabel(video.duration)}` : ''}</Text>
          {video.description ? <Text style={styles.description}>{video.description}</Text> : null}
        </View>
      </> : null}
      {related.length > 0 ? <View style={styles.related}><Text style={styles.relatedTitle}>More public videos</Text>{related.map((item) => <Pressable key={item._id} style={styles.relatedRow} onPress={() => router.replace({ pathname: '/watch', params: { id: item._id } })}>
        <View style={styles.relatedImage}>{item.thumbnailUrl ? <Image source={{ uri: item.thumbnailUrl }} style={styles.relatedThumb} contentFit="cover" /> : null}</View><View style={styles.relatedMeta}><Text style={styles.relatedName} numberOfLines={2}>{item.title}</Text><Text style={styles.meta}>{creatorLabel(item.creator)}</Text></View>
      </Pressable>)}</View> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Design.color.background }, content: { paddingBottom: 28, width: '100%', maxWidth: 1100, alignSelf: 'center' }, header: { minHeight: 58, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { color: Design.color.text, fontWeight: '900', fontSize: 17 }, link: { color: Design.color.accent, fontSize: 13, fontWeight: '700', minHeight: 44, textAlignVertical: 'center' },
  player: { width: '100%', aspectRatio: 16 / 9, maxHeight: 620, backgroundColor: '#050505', position: 'relative', overflow: 'hidden' }, externalBackground: { flex: 1, backgroundColor: Design.color.surface }, overlay: { ...StyleSheet.absoluteFill, backgroundColor: '#0009', alignItems: 'center', justifyContent: 'center', gap: 10 }, externalLabel: { color: '#fff', fontWeight: '800', fontSize: 18 }, externalInfo: { color: '#ddd', fontSize: 13 }, playButton: { minHeight: 48, justifyContent: 'center', backgroundColor: Design.color.accent, paddingHorizontal: 22, paddingVertical: 11, borderRadius: Design.radius.sm, marginTop: 8 }, playText: { color: '#fff', fontWeight: '800' },
  details: { margin: 18, marginBottom: 10, padding: 18, gap: 8, backgroundColor: Design.color.surface, borderColor: Design.color.border, borderWidth: 1, borderRadius: Design.radius.lg }, title: { color: Design.color.text, fontWeight: '800', fontSize: 22, lineHeight: 28 }, creator: { color: Design.color.secondary, fontSize: 14 }, meta: { color: Design.color.muted, fontSize: 12 }, description: { color: Design.color.secondary, fontSize: 14, lineHeight: 21, marginTop: 6 }, error: { color: Design.color.danger, textAlign: 'center', padding: 14 }, state: { padding: 30, alignItems: 'center', gap: 12 },
  related: { paddingHorizontal: 18, paddingTop: 20 }, relatedTitle: { color: Design.color.text, fontWeight: '800', fontSize: 18, marginBottom: 14 }, relatedRow: { flexDirection: 'row', gap: 11, marginBottom: 14, padding: 10, backgroundColor: Design.color.surface, borderWidth: 1, borderColor: Design.color.border, borderRadius: Design.radius.md }, relatedImage: { width: 124, aspectRatio: 16 / 9, borderRadius: Design.radius.sm, overflow: 'hidden', backgroundColor: Design.color.surfaceRaised }, relatedThumb: { width: '100%', height: '100%' }, relatedMeta: { flex: 1, justifyContent: 'center', gap: 6 }, relatedName: { color: Design.color.text, fontSize: 13, fontWeight: '600' },
});
