import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StatusBar, Text, TextInput, ThemeToggleButton, View } from '@/components/theme-native';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { apiRequest } from '@/lib/api';
import { Design } from '@/constants/design';
import { type VideoRecord, durationLabel } from '@/types/video';

export default function ProfileScreen() {
  const { user, loading: authLoading, logout, deleteAccount } = useAuth();
  const { showToast } = useToast();
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmVideoId, setConfirmVideoId] = useState('');
  const [deletingVideoId, setDeletingVideoId] = useState('');
  const [showAccountDeletion, setShowAccountDeletion] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const mine = await apiRequest<VideoRecord[]>('/api/videos/mine');
      setVideos(mine.data);
      setError('');
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load your videos.'); }
    finally { setLoading(false); }
  }, [user]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const removeVideo = async (videoId: string) => {
    setError(''); setDeletingVideoId(videoId);
    try {
      await apiRequest(`/api/videos/${encodeURIComponent(videoId)}`, { method: 'DELETE' });
      setVideos((current) => current.filter((video) => video._id !== videoId));
      setConfirmVideoId('');
      showToast('Video deleted.');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not delete this video.';
      setError(message); showToast(message, 'error');
    }
    finally { setDeletingVideoId(''); }
  };

  const removeAccount = async () => {
    setError('');
    if (!accountPassword) { setError('Enter your current password to delete your account.'); return; }
    setDeletingAccount(true);
    try { await deleteAccount(accountPassword); showToast('Account deleted.'); router.replace('/main'); }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not delete your account.';
      setError(message); showToast(message, 'error');
    }
    finally { setDeletingAccount(false); }
  };

  if (authLoading) return <SafeAreaView edges={['top']} style={styles.center}><ActivityIndicator color="#ff3434" /></SafeAreaView>;

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <StatusBar barStyle="light-content" />
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}><View><Text style={styles.eyebrow}>YOUR ACCOUNT</Text><Text style={styles.heading}>Profile</Text></View><ThemeToggleButton /></View>
      {user ? <>
        <View style={styles.identity}>
          {user.avatar ? <Image source={{ uri: user.avatar }} style={styles.avatar} contentFit="cover" /> : <View style={styles.avatarFallback}><Text style={styles.initial}>{(user.fullName || user.username).charAt(0).toUpperCase()}</Text></View>}
          <Text style={styles.name}>{user.fullName || user.username}</Text><Text style={styles.username}>@{user.username}</Text>
          <Text style={styles.email}>{user.email}</Text>
          {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
          <View style={styles.stats}><View style={styles.stat}><Text style={styles.statValue}>{videos.length}</Text><Text style={styles.statLabel}>Videos</Text></View></View>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Upload a video" accessibilityHint="Opens the video upload form" style={styles.primary} onPress={() => router.push({ pathname: '/upload', params: { returnTo: '/main/profile' } })}><SymbolView name={{ ios: 'square.and.arrow.up.fill', android: 'file_upload', web: 'file_upload' }} size={18} tintColor="#fff" /><Text style={styles.primaryText}>Upload Video</Text></Pressable>
            <Pressable style={styles.secondary} onPress={() => router.push('/main/edit-profile')}><Text style={styles.secondaryText}>Edit Profile</Text></Pressable>
          </View>
          <Pressable onPress={async () => { await logout(); router.replace('/main'); }}><Text style={styles.logout}>Sign out</Text></Pressable>
          {showAccountDeletion ? <View style={styles.deleteAccountPanel}>
            <Text style={styles.deleteWarning}>Deleting your account removes your profile, video records, and uploaded files.</Text>
            <TextInput style={styles.passwordInput} value={accountPassword} onChangeText={setAccountPassword} placeholder="Current password" placeholderTextColor="#888" secureTextEntry autoCapitalize="none" />
            <View style={styles.deleteActions}>
              <Pressable style={styles.cancelDelete} disabled={deletingAccount} onPress={() => { setShowAccountDeletion(false); setAccountPassword(''); }}><Text style={styles.deleteActionText}>Cancel</Text></Pressable>
              <Pressable style={styles.confirmDelete} disabled={deletingAccount} onPress={removeAccount}>{deletingAccount ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteActionText}>Confirm delete account</Text>}</Pressable>
            </View>
          </View> : <Pressable accessibilityRole="button" onPress={() => setShowAccountDeletion(true)}><Text style={styles.deleteAccountLink}>Delete account</Text></Pressable>}
        </View>
        <View style={styles.listHeader}>
          <View style={styles.listHeaderInfo}><Text style={styles.sectionTitle}>My Uploads</Text><Text style={styles.muted}>{videos.length} videos</Text></View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Upload a video"
            accessibilityHint="Opens the video upload form"
            hitSlop={4}
            style={styles.addVideoButton}
            onPress={() => router.push({ pathname: '/upload', params: { returnTo: '/main/profile' } })}
          >
            <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={23} tintColor="#fff" />
          </Pressable>
        </View>
        {loading && videos.length === 0 ? <ActivityIndicator color="#ff3434" style={styles.loader} /> : null}
        {error ? <View style={styles.state}><Text style={styles.error}>{error}</Text><Pressable onPress={() => load()}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}
        {!loading && !error && videos.length === 0 ? <Text style={styles.empty}>Your videos will appear here after you upload them.</Text> : null}
        {videos.map((video) => <View key={video._id} style={styles.videoRow}>
          <Pressable style={styles.videoOpen} accessibilityRole="button" accessibilityLabel={`Open ${video.title}`} onPress={() => router.push({ pathname: '/watch', params: { id: video._id } })}>
            <View style={styles.thumbWrap}>{video.thumbnailUrl ? <Image source={{ uri: video.thumbnailUrl }} style={styles.thumb} contentFit="cover" /> : <View style={styles.thumbFallback} />}{video.duration > 0 ? <Text style={styles.duration}>{durationLabel(video.duration)}</Text> : null}</View>
            <View style={styles.videoMeta}><Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text><Text style={styles.muted}>{video.sourceType === 'cloudinary' ? 'Source: File' : `Source: Link (${video.sourceType})`} · {video.visibility}</Text></View>
          </Pressable>
          {confirmVideoId === video._id ? <View style={styles.deleteActions}>
            <Pressable style={styles.confirmDelete} disabled={deletingVideoId === video._id} onPress={() => removeVideo(video._id)}>{deletingVideoId === video._id ? <ActivityIndicator color="#fff" /> : <Text style={styles.deleteActionText}>Confirm</Text>}</Pressable>
            <Pressable style={styles.cancelDelete} disabled={!!deletingVideoId} onPress={() => setConfirmVideoId('')}><Text style={styles.deleteActionText}>Cancel</Text></Pressable>
          </View> : <Pressable style={styles.deleteVideoButton} accessibilityRole="button" accessibilityLabel={`Delete ${video.title}`} onPress={() => setConfirmVideoId(video._id)}><Text style={styles.deleteAccountLink}>Delete</Text></Pressable>}
        </View>)}
      </> : <View style={styles.guest}><Text style={styles.name}>Your Streanub profile</Text><Text style={styles.bio}>Sign in to manage your profile and uploads.</Text><Pressable accessibilityRole="button" accessibilityLabel="Upload a video" accessibilityHint="Opens sign in before video upload" style={[styles.primary, styles.guestPrimary]} onPress={() => router.push('/upload')}><SymbolView name={{ ios: 'square.and.arrow.up.fill', android: 'file_upload', web: 'file_upload' }} size={18} tintColor="#fff" /><Text style={styles.primaryText}>Upload Video</Text></Pressable><Pressable style={styles.guestSignIn} onPress={() => router.push('/auth')}><Text style={styles.guestSignInText}>Sign in to your account</Text></Pressable></View>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Design.color.background }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Design.color.background }, content: { padding: 20, paddingBottom: 30, width: '100%', maxWidth: 820, alignSelf: 'center' },
  header: { minHeight: 58, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }, eyebrow: { color: Design.color.accent, letterSpacing: 1.5, fontSize: 10, fontWeight: '800' }, heading: { color: Design.color.text, fontSize: 27, fontWeight: '900', letterSpacing: -0.5, marginTop: 3 }, muted: { color: Design.color.muted, fontSize: 12 },
  identity: { alignItems: 'center', padding: 22, backgroundColor: Design.color.surface, borderWidth: 1, borderColor: Design.color.border, borderRadius: Design.radius.lg }, avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: Design.color.border }, avatarFallback: { width: 88, height: 88, borderRadius: 44, backgroundColor: Design.color.accentSurface, alignItems: 'center', justifyContent: 'center' }, initial: { color: Design.color.accent, fontSize: 34, fontWeight: '800' },
  name: { color: Design.color.text, fontSize: 23, fontWeight: '800', marginTop: 14, textAlign: 'center' }, username: { color: Design.color.muted, fontSize: 13, marginTop: 4 }, email: { color: Design.color.muted, fontSize: 13, marginTop: 2 }, bio: { color: Design.color.secondary, textAlign: 'center', lineHeight: 20, marginTop: 12, maxWidth: 360 },
  stats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28, marginTop: 18, paddingHorizontal: 20, paddingVertical: 12, borderRadius: Design.radius.sm, backgroundColor: Design.color.surfaceRaised }, stat: { alignItems: 'center' }, statValue: { color: Design.color.text, fontSize: 19, fontWeight: '800' }, statLabel: { color: Design.color.muted, fontSize: 11, marginTop: 4 }, divider: { height: 30, width: 1, backgroundColor: Design.color.border },
  actions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 10 }, primary: { flex: 1, minHeight: 48, borderRadius: Design.radius.sm, backgroundColor: Design.color.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 }, primaryText: { color: '#fff', fontWeight: '800', fontSize: 13 }, secondary: { flex: 1, minHeight: 48, borderRadius: Design.radius.sm, backgroundColor: Design.color.surfaceRaised, borderWidth: 1, borderColor: Design.color.border, alignItems: 'center', justifyContent: 'center', marginTop: 12 }, secondaryText: { color: Design.color.text, fontWeight: '700', fontSize: 13 }, logout: { color: Design.color.danger, padding: 16, fontSize: 13 },
  deleteAccountLink: { color: Design.color.danger, fontWeight: '700', padding: 12, textAlign: 'center' }, deleteAccountPanel: { width: '100%', backgroundColor: Design.color.accentSurface, padding: 14, borderRadius: Design.radius.md, gap: 10, marginTop: 8 }, deleteWarning: { color: Design.color.danger, fontSize: 12, lineHeight: 18 }, passwordInput: { minHeight: 46, borderWidth: 1, borderColor: Design.color.border, borderRadius: Design.radius.sm, paddingHorizontal: 12, color: Design.color.text, backgroundColor: Design.color.surface }, deleteActions: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }, confirmDelete: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, backgroundColor: '#a42b2b', borderRadius: Design.radius.sm }, cancelDelete: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, backgroundColor: Design.color.surfaceRaised, borderRadius: Design.radius.sm }, deleteActionText: { color: '#fff', fontSize: 12, fontWeight: '700' }, deleteVideoButton: { minWidth: 64, minHeight: 44, justifyContent: 'center', alignItems: 'center' }, videoOpen: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'center' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }, listHeaderInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }, sectionTitle: { color: Design.color.text, fontWeight: '800', fontSize: 18 }, addVideoButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: Design.color.accent, borderWidth: 1, borderColor: Design.color.accent }, videoRow: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'center', padding: 10, backgroundColor: Design.color.surface, borderWidth: 1, borderColor: Design.color.border, borderRadius: Design.radius.md }, thumbWrap: { width: 132, aspectRatio: 16 / 9, borderRadius: Design.radius.sm, overflow: 'hidden', backgroundColor: Design.color.surfaceRaised, position: 'relative' }, thumb: { width: '100%', height: '100%' }, thumbFallback: { flex: 1 }, duration: { position: 'absolute', right: 5, bottom: 4, color: '#fff', backgroundColor: '#000c', fontSize: 10, padding: 4, borderRadius: 4 }, videoMeta: { flex: 1, gap: 7 }, videoTitle: { color: Design.color.text, fontWeight: '600', fontSize: 13 },
  loader: { margin: 24 }, state: { padding: 18, alignItems: 'center', gap: 10 }, error: { color: Design.color.danger, textAlign: 'center' }, retry: { color: Design.color.accent, fontWeight: '700', padding: 9 }, empty: { color: Design.color.muted, textAlign: 'center', padding: 30, lineHeight: 20 }, guest: { alignItems: 'center', padding: 28, width: '100%', backgroundColor: Design.color.surface, borderRadius: Design.radius.lg, borderColor: Design.color.border, borderWidth: 1 }, guestPrimary: { width: '100%', flex: 0 }, guestSignIn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }, guestSignInText: { color: Design.color.accent, fontSize: 13, fontWeight: '700' },
});
