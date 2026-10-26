import { useCallback, useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, TextInput, ThemeToggleButton, View } from '@/components/theme-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { apiRequest, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { UploadDropZone } from '@/components/upload-drop-zone';
import { Design } from '@/constants/design';

type VideoRecord = { _id: string; title: string; videoUrl: string; sourceType: string; thumbnailUrl?: string };
type Signature = { apiKey: string; timestamp: number; publicId: string; uploadUrl: string; signature: string; allowedFormats: string[]; maxBytes: number; expiresAt: string };
type SelectedVideo = { uri: string; name: string; mimeType: string; fileSize: number; duration?: number; browserFile?: File };
type UploadedAsset = { public_id: string; format: string };

const formats = ['mp4', 'mov', 'm4v', 'webm'];

export default function UploadScreen() {
  const { user, loading: authLoading } = useAuth();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [visibility, setVisibility] = useState<'public' | 'private' | 'unlisted'>('public');
  const [externalMode, setExternalMode] = useState(false);
  const [externalUrl, setExternalUrl] = useState('');
  const [video, setVideo] = useState<SelectedVideo | null>(null);
  const [pendingAsset, setPendingAsset] = useState<UploadedAsset | null>(null);
  const [pendingAuthorization, setPendingAuthorization] = useState<Signature | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [canCancelUpload, setCanCancelUpload] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [myVideos, setMyVideos] = useState<VideoRecord[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const uploadRequest = useRef<XMLHttpRequest | null>(null);

  useEffect(() => () => {
    if (video?.uri.startsWith('blob:')) URL.revokeObjectURL(video.uri);
  }, [video]);

  const refreshVideos = useCallback(async () => {
    setLoadingVideos(true);
    try {
      const result = await apiRequest<VideoRecord[]>('/api/videos/mine');
      setMyVideos(result.data);
      setError('');
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your videos.');
      return false;
    } finally { setLoadingVideos(false); }
  }, []);

  useFocusEffect(useCallback(() => { if (user) void refreshVideos(); }, [refreshVideos, user]));

  const chooseVideo = async () => {
    setError('');
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) { setError('Allow access to your library to choose a video.'); return; }
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: false });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const name = asset.fileName || asset.uri.split('/').pop() || 'video';
      const extension = name.split('.').pop()?.toLowerCase() || '';
      if (!formats.includes(extension)) { setError('Choose an MP4, MOV, M4V, or WebM video.'); return; }
      if (Platform.OS === 'web' && !asset.file) { setError('This browser did not provide the selected file. Try dragging the video into the upload area.'); return; }
      if (!asset.fileSize || asset.fileSize > 500 * 1024 * 1024) {
        setError(asset.fileSize ? 'Video must be 500 MB or smaller.' : 'This device could not verify the video size. Choose a local file with a readable size.');
        return;
      }
      const uri = Platform.OS === 'web' && asset.file ? URL.createObjectURL(asset.file) : asset.uri;
      setVideo({ uri, name, mimeType: asset.mimeType || `video/${extension}`, fileSize: asset.fileSize, duration: asset.duration ? asset.duration / 1000 : undefined, browserFile: asset.file });
      setPendingAsset(null);
      setPendingAuthorization(null);
      setMessage('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open the video library.'); }
  };

  const uploadToCloudinary = (auth: Signature, selected: SelectedVideo) => new Promise<UploadedAsset>((resolve, reject) => {
    if (auth.uploadUrl === 'mock') {
      setProgress(100);
      resolve({ public_id: auth.publicId, format: selected.name.split('.').pop() || 'mp4' });
      return;
    }
    const body = new FormData();
    body.append('api_key', auth.apiKey);
    body.append('timestamp', String(auth.timestamp));
    body.append('public_id', auth.publicId);
    body.append('overwrite', 'false');
    body.append('allowed_formats', auth.allowedFormats.join(','));
    body.append('signature', auth.signature);
      if (Platform.OS === 'web' && selected.browserFile) body.append('file', selected.browserFile, selected.name);
      else body.append('file', { uri: selected.uri, name: selected.name, type: selected.mimeType } as never);
    const request = new XMLHttpRequest();
    uploadRequest.current = request;
    setCanCancelUpload(true);
    request.open('POST', auth.uploadUrl);
    request.timeout = 15 * 60 * 1000;
    request.upload.onprogress = (event) => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
    request.onerror = () => reject(new Error('Network error while sending the video. Retry when connected.'));
    request.ontimeout = () => reject(new Error('Upload timed out. Retry the upload.'));
    request.onabort = () => reject(new Error('Upload cancelled. Your selected file is ready to retry.'));
    request.onload = () => {
      let response: any;
      try { response = JSON.parse(request.responseText); } catch { reject(new Error('Cloudinary returned an invalid response.')); return; }
      if (request.status < 200 || request.status >= 300) { reject(new Error(response.error?.message || 'Cloudinary upload failed.')); return; }
      resolve({ public_id: response.public_id, format: response.format });
    };
    request.onloadend = () => { if (uploadRequest.current === request) uploadRequest.current = null; setCanCancelUpload(false); };
    request.send(body);
  });

  const submit = async () => {
    setError(''); setMessage('');
    if (!title.trim()) { setError('Add a title for this video.'); return; }
    if (!externalMode && !video) { setError('Choose a video file first.'); return; }
    if (externalMode && !externalUrl.trim()) { setError('Enter a YouTube or Vimeo URL.'); return; }
    setBusy(true); setProgress(0);
    try {
      if (externalMode) {
        await apiRequest('/api/external-videos', { method: 'POST', body: JSON.stringify({ title, description, category, visibility, url: externalUrl }) });
        setPendingAsset(null); setPendingAuthorization(null);
      } else {
        const selected = video!;
        if (selected.fileSize > 500 * 1024 * 1024) throw new Error('Video must be 500 MB or smaller.');
        let asset = pendingAsset;
        let authorization = pendingAuthorization;
        let recovered = false;
        const format = selected.name.split('.').pop()?.toLowerCase() || '';
        if (!asset && authorization) {
          try {
            await apiRequest('/api/uploads/complete', { method: 'POST', body: JSON.stringify({ title, description, category, visibility, publicId: authorization.publicId, format }) });
            recovered = true;
            setPendingAuthorization(null);
          } catch (cause) {
            if (!(cause instanceof ApiRequestError && cause.statusCode === 400)) throw cause;
          }
        }
        if (!asset && !recovered) {
          if (!authorization || Date.parse(authorization.expiresAt) < Date.now() + 30000) {
            authorization = (await apiRequest<Signature>('/api/uploads/signature', { method: 'POST', body: JSON.stringify({}) })).data;
            setPendingAuthorization(authorization);
          }
          asset = await uploadToCloudinary(authorization, selected);
          setPendingAsset(asset);
        }
        if (!recovered) {
          if (!asset) throw new Error('Upload did not finish. Retry the selected file.');
          await apiRequest('/api/uploads/complete', { method: 'POST', body: JSON.stringify({ title, description, category, visibility, publicId: asset.public_id, format: asset.format }) });
        }
        setPendingAsset(null);
        setPendingAuthorization(null);
      }
      setMessage('Video saved successfully.');
      showToast('Video saved successfully.');
      setTitle(''); setDescription(''); setExternalUrl(''); setVideo(null); setProgress(0);
      if (!await refreshVideos()) setMessage('Video saved, but My Uploads could not refresh.');
      if (returnTo === '/main/profile') router.replace('/main/profile');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Upload failed. Retry when ready.';
      setError(message); showToast(message, 'error');
    }
    finally { setBusy(false); }
  };

  const acceptBrowserFile = (file: File) => {
    setError('');
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!formats.includes(extension)) { setError('Choose an MP4, MOV, M4V, or WebM video.'); return; }
    if (!file.size || file.size > 500 * 1024 * 1024) { setError(file.size ? 'Video must be 500 MB or smaller.' : 'The selected file size could not be read.'); return; }
    const uri = URL.createObjectURL(file);
    setVideo({ uri, name: file.name, mimeType: file.type || `video/${extension}`, fileSize: file.size, browserFile: file });
    setPendingAsset(null); setPendingAuthorization(null); setMessage('');
  };

  if (authLoading) return <SafeAreaView edges={['top']} style={styles.center}><ActivityIndicator color="#ff3434" /></SafeAreaView>;
  if (!user) return <Redirect href={{ pathname: '/auth', params: { returnTo: '/upload' } }} />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}><Text style={styles.muted}>‹ Back</Text></Pressable>
          <View style={styles.headingBlock}><Text style={styles.eyebrow}>CREATOR STUDIO</Text><Text style={styles.heading}>Create</Text></View>
          <ThemeToggleButton />
        </View>
        <View style={styles.switchRow}>
          <ModeButton label="Upload file" selected={!externalMode} onPress={() => { setExternalMode(false); setError(''); }} />
          <ModeButton label="Video link" selected={externalMode} onPress={() => { setExternalMode(true); setError(''); }} />
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>{externalMode ? 'Share an external video' : 'Upload a video'}</Text>
          {externalMode ? <TextInput style={styles.input} placeholder="YouTube, Vimeo, or Twitch video URL" placeholderTextColor="#777" value={externalUrl} onChangeText={setExternalUrl} autoCapitalize="none" keyboardType="url" /> : (
            <UploadDropZone onFile={acceptBrowserFile}>
              <Pressable style={styles.picker} onPress={chooseVideo} disabled={busy}>
                <Text style={styles.pickTitle}>{video?.name || (Platform.OS === 'web' ? 'Choose or drop a video' : 'Choose a video')}</Text>
                <Text style={styles.muted}>{video ? `${(video.fileSize / 1024 / 1024).toFixed(1)} MB${video.duration ? ` · ${Math.round(video.duration)} sec` : ''}` : 'MP4, MOV, M4V, or WebM · up to 500 MB'}</Text>
              </Pressable>
            </UploadDropZone>
          )}
          {video && !externalMode ? <LocalVideoPreview uri={video.uri} /> : null}
          <TextInput style={styles.input} placeholder="Title" placeholderTextColor="#777" value={title} onChangeText={setTitle} maxLength={150} />
          <TextInput style={[styles.input, styles.description]} placeholder="Description (optional)" placeholderTextColor="#777" value={description} onChangeText={setDescription} multiline maxLength={5000} />
          <TextInput style={styles.input} placeholder="Category" placeholderTextColor="#777" value={category} onChangeText={setCategory} maxLength={60} />
          <View style={styles.visibilityRow}>{(['public', 'unlisted', 'private'] as const).map((value) => <ModeButton key={value} label={value} selected={visibility === value} onPress={() => setVisibility(value)} />)}</View>
          {progress > 0 && <View><Text style={styles.muted}>{progress < 100 ? `Uploading ${progress}%` : 'Verifying video…'}</Text><View style={styles.track}><View style={[styles.bar, { width: `${progress}%` }]} /></View></View>}
          <Pressable style={[styles.submit, busy && styles.disabled]} disabled={busy} onPress={submit} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{externalMode ? 'Save video link' : 'Upload video'}</Text>}
          </Pressable>
          {busy && canCancelUpload ? <Pressable onPress={() => uploadRequest.current?.abort()} accessibilityRole="button"><Text style={styles.cancel}>Cancel upload</Text></Pressable> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.success}>{message}</Text> : null}
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>My uploads</Text>
          {loadingVideos ? <ActivityIndicator color="#ff3434" /> : myVideos.length ? myVideos.map((item) => (
            <Pressable key={item._id} style={styles.videoRow} onPress={() => router.push({ pathname: '/watch', params: { id: item._id } })}>
              <Text style={styles.videoTitle}>{item.title}</Text><Text style={styles.muted}>{item.sourceType === 'cloudinary' ? 'File' : `Link (${item.sourceType})`}</Text>
            </Pressable>
          )) : <Text style={styles.muted}>You have not uploaded a video yet.</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LocalVideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => { instance.loop = false; instance.muted = true; });
  return <View style={styles.preview}><VideoView player={player} style={StyleSheet.absoluteFill} nativeControls contentFit="contain" /></View>;
}

function ModeButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} style={[styles.modeButton, selected && styles.selected]} onPress={onPress}><Text style={styles.modeText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Design.color.background }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Design.color.background },
  content: { padding: 20, paddingBottom: 30, width: '100%', maxWidth: 760, alignSelf: 'center' }, header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }, headingBlock: { gap: 3 }, eyebrow: { color: Design.color.accent, letterSpacing: 1.4, fontSize: 10, fontWeight: '800' }, heading: { color: Design.color.text, fontSize: 27, fontWeight: '900', letterSpacing: -0.4 }, title: { color: Design.color.text, fontSize: 18, fontWeight: '700' }, muted: { color: Design.color.muted, fontSize: 13 },
  card: { backgroundColor: Design.color.surface, borderWidth: 1, borderColor: Design.color.border, borderRadius: Design.radius.lg, padding: 18, marginBottom: 16, gap: 13 }, input: { minHeight: 48, color: Design.color.text, backgroundColor: Design.color.surfaceRaised, borderColor: Design.color.border, borderWidth: 1, borderRadius: Design.radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 }, description: { minHeight: 100, textAlignVertical: 'top' }, preview: { width: '100%', aspectRatio: 16 / 9, borderRadius: Design.radius.md, backgroundColor: '#080808', overflow: 'hidden' },
  picker: { minHeight: 90, borderColor: Design.color.accent, borderWidth: 1, borderStyle: 'dashed', borderRadius: Design.radius.md, padding: 18, gap: 7, justifyContent: 'center', backgroundColor: Design.color.surfaceRaised }, pickTitle: { color: Design.color.text, fontWeight: '700', fontSize: 14 },
  switchRow: { flexDirection: 'row', gap: 10, marginBottom: 14 }, modeButton: { flex: 1, minHeight: 42, justifyContent: 'center', alignItems: 'center', backgroundColor: Design.color.surface, borderRadius: Design.radius.sm, paddingVertical: 10, borderWidth: 1, borderColor: Design.color.border }, modeText: { color: Design.color.secondary, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }, selected: { backgroundColor: Design.color.accentSurface, borderColor: Design.color.accent }, visibilityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  submit: { minHeight: 50, justifyContent: 'center', alignItems: 'center', borderRadius: Design.radius.sm, backgroundColor: Design.color.accent }, disabled: { opacity: 0.58 }, submitText: { color: '#fff', fontWeight: '800', fontSize: 14 }, cancel: { color: Design.color.danger, textAlign: 'center', padding: 8 },
  error: { color: Design.color.danger, fontSize: 13 }, success: { color: Design.color.success, fontSize: 13 }, track: { height: 6, borderRadius: 4, backgroundColor: Design.color.border, marginTop: 8, overflow: 'hidden' }, bar: { height: 6, backgroundColor: Design.color.accent },
  videoRow: { borderTopColor: Design.color.border, borderTopWidth: 1, paddingTop: 12, gap: 4 }, videoTitle: { color: Design.color.text, fontSize: 14, fontWeight: '600' },
});
