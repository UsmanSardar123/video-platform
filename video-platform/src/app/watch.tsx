import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Share,
  StyleSheet,
  TextInput as NativeTextInput,
} from 'react-native';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  View,
} from '@/components/theme-native';
import { Design } from '@/constants/design';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import { useSubscription } from '@/contexts/subscription-context';
import { useSettings } from '@/contexts/settings-context';
import { apiRequest } from '@/lib/api';
import {
  addVideoComment,
  deleteComment,
  fetchComments,
  fetchVideo,
  fetchVideoInteraction,
  recordHistory,
  recordView,
  setVideoLike,
  setWatchLater,
} from '@/lib/video-service';
import {
  cleanDescriptionPreview,
  cleanTitle,
  creatorAvatarUrl,
  creatorInitials,
  creatorLabel,
  durationLabel,
  formatTimeAgo,
  formatViews,
  type CommentRecord,
  type VideoInteractionState,
  type VideoRecord,
} from '@/types/video';

function getEmbedUrl(url: string, sourceType: string): string | null {
  try {
    if (sourceType === 'youtube') {
      const match = url.match(
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/
      );
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
  const { id, commentId } = useLocalSearchParams<{ id?: string; commentId?: string }>();
  const { user } = useAuth();
  const { mode } = useThemeMode();
  const { showToast } = useToast();
  const isDark = mode === 'dark';
  const C = isDark ? Design.color : Design.light;

  const [video, setVideo] = useState<VideoRecord | null>(null);
  const [related, setRelated] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const {
    isSubscribed,
    getSubscriberCount,
    isSubscribing,
    fetchStatus,
    toggleSubscribe,
    showSignInModal,
  } = useSubscription();

  const [descExpanded, setDescExpanded] = useState(false);

  // Social & interactions
  const [interaction, setInteraction] = useState<VideoInteractionState>({
    liked: false,
    disliked: false,
    watchLater: false,
    likeCount: 0,
  });

  // Comments
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);

  const { settings } = useSettings();

  const player = useVideoPlayer(null, (instance) => {
    instance.loop = false;
    instance.muted = settings.startMuted;
  });
  const playback = useEvent(player, 'statusChange', { status: player.status });

  // Autoplay next video when current video completes
  useEffect(() => {
    if (!settings.autoplay || !related.length) return;
    const sub = player.addListener('playToEnd', () => {
      const nextVideo = related[0];
      if (nextVideo?._id) {
        showToast(`Playing next: ${cleanTitle(nextVideo.title)}`);
        router.replace({ pathname: '/watch', params: { id: nextVideo._id } });
      }
    });
    return () => sub.remove();
  }, [player, related, settings.autoplay, showToast]);

  const viewRecordedRef = useRef<string | null>(null);

  // Load video details, interactions, comments, and related videos
  useEffect(() => {
    let active = true;
    if (!id) return;

    const loadAll = async () => {
      setLoading(true);
      setError('');
      try {
        const videoData = await fetchVideo(id);
        if (!active) return;
        setVideo(videoData);

        // Fetch related real videos
        try {
          const feedRes = await apiRequest<VideoRecord[]>('/api/videos?limit=12');
          if (active && feedRes.data) {
            setRelated(feedRes.data.filter((v) => v._id !== id));
          }
        } catch {
          // Non-blocking
        }

        // Fetch interaction state
        fetchVideoInteraction(id).then((state) => {
          if (active) setInteraction(state);
        });

        // Fetch comments
        fetchComments(id).then((commentList) => {
          if (active) {
            setComments(commentList);
            if (commentId) {
              const matched = commentList.some((c) => c._id === commentId);
              if (matched) {
                setShowCommentsModal(true);
              } else {
                showToast('The referenced comment has been deleted.', 'error');
              }
            }
          }
        });

        // Fetch creator subscription status
        const creatorId =
          typeof videoData.creator === 'object' && videoData.creator?._id
            ? videoData.creator._id
            : typeof videoData.creator === 'string'
            ? videoData.creator
            : null;

        if (creatorId) {
          void fetchStatus(creatorId);
        }

        // Record view and watch history once per video ID
        if (viewRecordedRef.current !== id) {
          viewRecordedRef.current = id;
          recordView(id).then((newViews) => {
            if (active && newViews > 0) {
              setVideo((v) => (v ? { ...v, views: newViews } : null));
            }
          });
          if (!settings.historyPaused) {
            recordHistory(id);
          }
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Could not load this video.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadAll();

    return () => {
      active = false;
      player.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Video player source handling (uses replaceAsync on supported platforms to avoid synchronous iOS main-thread stalls)
  useEffect(() => {
    let active = true;

    const syncPlayerSource = async () => {
      try {
        if (video?.sourceType === 'cloudinary' && video.videoUrl) {
          if (typeof player.replaceAsync === 'function') {
            await player.replaceAsync(video.videoUrl);
          } else {
            player.replace(video.videoUrl);
          }
        } else {
          player.pause();
          if (typeof player.replaceAsync === 'function') {
            await player.replaceAsync(null);
          } else {
            player.replace(null);
          }
        }
      } catch (err) {
        if (active) {
          console.warn('VideoPlayer source replacement failed:', err);
        }
      }
    };

    void syncPlayerSource();

    return () => {
      active = false;
      player.pause();
    };
  }, [player, video?._id, video?.sourceType, video?.videoUrl]);

  const openExternal = async () => {
    if (!video || !['youtube', 'vimeo', 'twitch'].includes(video.sourceType)) return;
    try {
      await WebBrowser.openBrowserAsync(video.videoUrl);
    } catch {
      setError(`Could not open ${video.sourceType}. Check your connection and try again.`);
    }
  };

  const handleToggleLike = async () => {
    if (!video) return;
    if (!user) {
      showSignInModal('like this video');
      return;
    }
    const nextAction = interaction.liked ? 'none' : 'like';
    // Optimistic update
    setInteraction((prev) => ({
      ...prev,
      liked: !prev.liked,
      disliked: false,
      likeCount: prev.liked ? Math.max(0, prev.likeCount - 1) : prev.likeCount + 1,
    }));
    try {
      const res = await setVideoLike(video._id, nextAction);
      setInteraction((prev) => ({
        ...prev,
        liked: res.liked,
        disliked: res.disliked,
        likeCount: res.likeCount,
      }));
    } catch {
      showToast('Could not update like status', 'error');
    }
  };

  const handleToggleDislike = async () => {
    if (!video) return;
    if (!user) {
      showSignInModal('rate this video');
      return;
    }
    const nextAction = interaction.disliked ? 'none' : 'dislike';
    // Optimistic update
    setInteraction((prev) => ({
      ...prev,
      disliked: !prev.disliked,
      liked: false,
      likeCount: prev.liked ? Math.max(0, prev.likeCount - 1) : prev.likeCount,
    }));
    try {
      const res = await setVideoLike(video._id, nextAction);
      setInteraction((prev) => ({
        ...prev,
        liked: res.liked,
        disliked: res.disliked,
        likeCount: res.likeCount,
      }));
    } catch {
      showToast('Could not update dislike status', 'error');
    }
  };

  const handleToggleWatchLater = async () => {
    if (!video) return;
    if (!user) {
      showSignInModal('save this video to Watch Later');
      return;
    }
    const nextState = !interaction.watchLater;
    setInteraction((prev) => ({ ...prev, watchLater: nextState }));
    showToast(nextState ? 'Saved to Watch Later' : 'Removed from Watch Later');
    try {
      await setWatchLater(video._id, nextState);
    } catch {
      showToast('Could not update Watch Later', 'error');
    }
  };

  const handleShare = async () => {
    if (!video) return;
    const origin =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : 'https://streanub.app';
    const watchUrl = `${origin}/watch?id=${video._id}`;

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(watchUrl);
        showToast('Link copied to clipboard!');
        return;
      } catch {
        // Fallback to Share API below
      }
    }

    try {
      await Share.share({
        title: video.title,
        message: `Watch "${cleanTitle(video.title)}" on Streanub:\n${watchUrl}`,
        url: watchUrl,
      });
    } catch {
      showToast('Could not share video.', 'error');
    }
  };

  const handleAddComment = async () => {
    if (!video || !commentText.trim()) return;
    if (!user) {
      showSignInModal('comment on this video');
      return;
    }

    setPostingComment(true);
    try {
      const newComment = await addVideoComment(video._id, commentText.trim());
      setComments((prev) => [newComment, ...prev]);
      setCommentText('');
      Keyboard.dismiss();
      showToast('Comment posted');
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Could not post comment', 'error');
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!video) return;
    try {
      await deleteComment(video._id, commentId);
      setComments((prev) => prev.filter((c) => c._id !== commentId));
      showToast('Comment deleted');
    } catch {
      showToast('Could not delete comment', 'error');
    }
  };

  const creator = video?.creator;
  const creatorId = typeof creator === 'object' && creator?._id ? creator._id : null;
  const isOwner = Boolean(user && creatorId && user.id === creatorId);
  const avatarUrl = creatorAvatarUrl(creator);
  const initials = creatorInitials(creator);
  const embedUrl = video ? getEmbedUrl(video.videoUrl, video.sourceType) : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Navigation Top Bar */}
      <View style={[styles.topBar, { backgroundColor: C.background, borderBottomColor: C.border }]}>
        <Pressable
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Back"
        >
          <SymbolView
            name={{ ios: 'chevron.backward', android: 'arrow_back', web: 'arrow_back' }}
            size={22}
            tintColor={C.text}
          />
        </Pressable>
        <Text style={[styles.brandText, { color: C.text }]}>STREANUB</Text>
        <Pressable
          hitSlop={10}
          onPress={() => router.push('/main/explore')}
          style={styles.searchButton}
          accessibilityLabel="Search"
        >
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={20}
            tintColor={C.text}
          />
        </Pressable>
      </View>

      {/* Main Content Area */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Loading State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Design.color.accent} />
          </View>
        ) : null}

        {/* Error State */}
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: Design.color.danger }]}>{error}</Text>
            <Pressable
              style={[styles.retryBtn, { backgroundColor: Design.color.accent }]}
              onPress={() => router.replace({ pathname: '/watch', params: { id } })}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {video && !loading ? (
          <>
            {/* 16:9 Video Player */}
            <View style={styles.playerContainer}>
              {video.sourceType === 'cloudinary' ? (
                <VideoView
                  player={player}
                  style={StyleSheet.absoluteFill}
                  nativeControls
                  contentFit="contain"
                  fullscreenOptions={{ enable: true }}
                />
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
                  {video.thumbnailUrl ? (
                    <Image
                      source={{ uri: video.thumbnailUrl }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.externalBackground, { backgroundColor: C.surface }]} />
                  )}
                  <View style={styles.overlay}>
                    <Text style={styles.externalLabel}>
                      {video.sourceType === 'youtube'
                        ? 'YouTube Video'
                        : video.sourceType === 'vimeo'
                        ? 'Vimeo Video'
                        : 'Twitch Stream'}
                    </Text>
                    <Text style={styles.externalInfo}>
                      Playback opens on{' '}
                      {video.sourceType === 'youtube'
                        ? 'YouTube'
                        : video.sourceType === 'vimeo'
                        ? 'Vimeo'
                        : 'Twitch'}
                    </Text>
                    <Pressable style={styles.playButton} onPress={openExternal}>
                      <Text style={styles.playText}>Open Video</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>

            {playback.status === 'error' ? (
              <View style={styles.playbackError}>
                <Text style={styles.playbackErrorText}>
                  This video format is currently unavailable. Check the video source.
                </Text>
              </View>
            ) : null}

            {/* Video Title and Metadata */}
            <View style={styles.metaSection}>
              <Text style={[styles.videoTitle, { color: C.text }]}>{cleanTitle(video.title)}</Text>
              <View style={styles.videoSubMeta}>
                <Text style={[styles.metaMuted, { color: C.muted }]}>
                  {formatViews(video.views)} • {formatTimeAgo(video.createdAt)}
                </Text>
                {video.category ? (
                  <View style={[styles.categoryBadge, { backgroundColor: C.surfaceRaised }]}>
                    <Text style={[styles.categoryBadgeText, { color: C.secondary }]}>
                      {video.category}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Creator / Channel Bar */}
            <View
              style={[
                styles.channelBar,
                { borderTopColor: C.border, borderBottomColor: C.border },
              ]}
            >
              <Pressable
                style={styles.channelInfo}
                onPress={() => {
                  if (creatorId) {
                    router.push({ pathname: '/main/profile', params: { userId: creatorId } });
                  }
                }}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View
                    style={[
                      styles.avatarFallback,
                      { backgroundColor: isDark ? Design.color.accentSurface : '#fee2e2' },
                    ]}
                  >
                    <Text style={[styles.avatarInitial, { color: Design.color.accent }]}>
                      {initials}
                    </Text>
                  </View>
                )}
                <View style={styles.channelTexts}>
                  <Text style={[styles.channelName, { color: C.text }]} numberOfLines={1}>
                    {creatorLabel(video.creator)}
                  </Text>
                  <Text style={[styles.subCount, { color: C.muted }]}>
                    {getSubscriberCount(creatorId, 0)} {getSubscriberCount(creatorId, 0) === 1 ? 'subscriber' : 'subscribers'}
                  </Text>
                </View>
              </Pressable>

              {/* Subscribe CTA */}
              {!isOwner ? (
                <Pressable
                  style={[
                    styles.subBtn,
                    isSubscribed(creatorId)
                      ? [styles.subBtnActive, { backgroundColor: C.surfaceRaised, borderColor: C.border, borderWidth: 1 }]
                      : [styles.subBtnInactive, { backgroundColor: C.accent }],
                    !isDark && Design.shadow.sm,
                  ]}
                  disabled={isSubscribing(creatorId)}
                  onPress={() => {
                    if (creatorId) {
                      toggleSubscribe({ id: creatorId, name: creatorLabel(video.creator) });
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={isSubscribed(creatorId) ? 'Unsubscribe' : 'Subscribe'}
                >
                  {isSubscribing(creatorId) ? (
                    <ActivityIndicator size="small" color={isSubscribed(creatorId) ? C.text : '#fff'} />
                  ) : isSubscribed(creatorId) ? (
                    <View style={styles.subscribedContent}>
                      <SymbolView
                        name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
                        size={15}
                        tintColor={C.secondary}
                      />
                      <Text style={[styles.subBtnText, styles.subBtnTextActive, { color: C.text }]}>
                        Subscribed
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.subBtnText, styles.subBtnTextInactive, { color: '#ffffff' }]}>
                      Subscribe
                    </Text>
                  )}
                </Pressable>
              ) : (
                <View style={[styles.ownerBadge, { backgroundColor: C.surfaceRaised, borderColor: C.border, borderWidth: StyleSheet.hairlineWidth }]}>
                  <Text style={[styles.ownerBadgeText, { color: C.secondary }]}>Your Video</Text>
                </View>
              )}
            </View>

            {/* Action Pill Buttons Row */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.actionRow}
            >
              {/* Like / Dislike Combined Pill */}
              <View
                style={[
                  styles.actionPill,
                  { backgroundColor: C.surfaceRaised, borderColor: C.border, borderWidth: StyleSheet.hairlineWidth },
                  !isDark && Design.shadow.sm,
                ]}
              >
                <Pressable
                  style={[
                    styles.likeSubPill,
                    interaction.liked && { backgroundColor: isDark ? '#ffffff22' : '#00000015' },
                  ]}
                  onPress={handleToggleLike}
                  accessibilityRole="button"
                  accessibilityLabel={`Like video, ${interaction.likeCount} likes`}
                >
                  <SymbolView
                    name={{
                      ios: interaction.liked ? 'hand.thumbsup.fill' : 'hand.thumbsup',
                      android: 'thumb_up',
                      web: 'thumb_up',
                    }}
                    size={18}
                    tintColor={interaction.liked ? Design.color.accent : C.text}
                  />
                  <Text
                    style={[
                      styles.actionPillText,
                      { color: interaction.liked ? Design.color.accent : C.text },
                    ]}
                  >
                    {interaction.likeCount > 0 ? interaction.likeCount : 'Like'}
                  </Text>
                </Pressable>

                <View style={[styles.pillDivider, { backgroundColor: C.border }]} />

                <Pressable
                  style={[
                    styles.dislikeSubPill,
                    interaction.disliked && { backgroundColor: isDark ? '#ffffff22' : '#00000015' },
                  ]}
                  onPress={handleToggleDislike}
                  accessibilityRole="button"
                  accessibilityLabel="Dislike video"
                >
                  <SymbolView
                    name={{
                      ios: interaction.disliked ? 'hand.thumbsdown.fill' : 'hand.thumbsdown',
                      android: 'thumb_down',
                      web: 'thumb_down',
                    }}
                    size={18}
                    tintColor={interaction.disliked ? Design.color.accent : C.text}
                  />
                </Pressable>
              </View>

              {/* Share Pill */}
              <Pressable
                style={[
                  styles.actionPillButton,
                  { backgroundColor: C.surfaceRaised, borderColor: C.border, borderWidth: StyleSheet.hairlineWidth },
                  !isDark && Design.shadow.sm,
                ]}
                onPress={handleShare}
                accessibilityRole="button"
                accessibilityLabel="Share video"
              >
                <SymbolView
                  name={{
                    ios: 'square.and.arrow.up',
                    android: 'share',
                    web: 'share',
                  }}
                  size={18}
                  tintColor={C.text}
                />
                <Text style={[styles.actionPillText, { color: C.text }]}>Share</Text>
              </Pressable>

              {/* Save / Watch Later Pill */}
              <Pressable
                style={[
                  styles.actionPillButton,
                  { backgroundColor: C.surfaceRaised, borderColor: C.border, borderWidth: StyleSheet.hairlineWidth },
                  interaction.watchLater && {
                    backgroundColor: isDark ? Design.color.accentSurface : '#fee2e2',
                  },
                  !isDark && Design.shadow.sm,
                ]}
                onPress={handleToggleWatchLater}
                accessibilityRole="button"
                accessibilityLabel="Save to Watch Later"
              >
                <SymbolView
                  name={{
                    ios: interaction.watchLater ? 'bookmark.fill' : 'bookmark',
                    android: 'bookmark',
                    web: 'bookmark',
                  }}
                  size={18}
                  tintColor={interaction.watchLater ? Design.color.accent : C.text}
                />
                <Text
                  style={[
                    styles.actionPillText,
                    { color: interaction.watchLater ? Design.color.accent : C.text },
                  ]}
                >
                  {interaction.watchLater ? 'Saved' : 'Save'}
                </Text>
              </Pressable>
            </ScrollView>

            {/* Expandable Description Card */}
            <Pressable
              style={[
                styles.descCard,
                { backgroundColor: C.surfaceRaised, borderColor: C.border, borderWidth: StyleSheet.hairlineWidth },
                !isDark && Design.shadow.sm,
              ]}
              onPress={() => setDescExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={descExpanded ? 'Collapse description' : 'Expand description'}
            >
              <Text
                style={[styles.descText, { color: C.secondary }]}
                numberOfLines={descExpanded ? undefined : 3}
              >
                {cleanDescriptionPreview(video.description) || 'No description provided.'}
              </Text>
              <Text style={[styles.descToggle, { color: Design.color.accent }]}>
                {descExpanded ? 'Show less' : '...more'}
              </Text>
            </Pressable>

            {/* Comments Section Box */}
            <View
              style={[
                styles.commentsSection,
                { backgroundColor: C.surface, borderColor: C.border, borderWidth: StyleSheet.hairlineWidth },
                !isDark && Design.shadow.sm,
              ]}
            >
              <View style={styles.commentsHeader}>
                <Text style={[styles.commentsTitle, { color: C.text }]}>
                  Comments <Text style={{ color: C.muted, fontWeight: 'normal' }}>{comments.length}</Text>
                </Text>
              </View>

              {/* Add Comment Input Bar */}
              <View style={styles.addCommentRow}>
                <View
                  style={[
                    styles.userCommentAvatar,
                    { backgroundColor: isDark ? Design.color.accentSurface : '#fee2e2' },
                  ]}
                >
                  <Text style={[styles.avatarInitialSmall, { color: Design.color.accent }]}>
                    {user ? (user.fullName || user.username).charAt(0).toUpperCase() : '?'}
                  </Text>
                </View>
                <NativeTextInput
                  style={[
                    styles.commentInput,
                    {
                      backgroundColor: C.surfaceRaised,
                      color: C.text,
                      borderColor: C.border,
                    },
                  ]}
                  placeholder={user ? 'Add a comment...' : 'Sign in to comment...'}
                  placeholderTextColor={C.muted}
                  value={commentText}
                  onChangeText={setCommentText}
                  maxLength={1000}
                />
                <Pressable
                  style={[
                    styles.sendCommentBtn,
                    {
                      backgroundColor:
                        commentText.trim() && !postingComment
                          ? Design.color.accent
                          : C.surfaceRaised,
                    },
                  ]}
                  disabled={!commentText.trim() || postingComment}
                  onPress={handleAddComment}
                >
                  {postingComment ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <SymbolView
                      name={{ ios: 'arrow.up', android: 'send', web: 'send' }}
                      size={16}
                      tintColor={commentText.trim() ? '#fff' : C.muted}
                    />
                  )}
                </Pressable>
              </View>

              {/* Comments List (Show top 5 preview or all) */}
              {comments.length === 0 ? (
                <Text style={[styles.emptyComments, { color: C.muted }]}>
                  No comments yet. Be the first to share your thoughts!
                </Text>
              ) : (
                comments.slice(0, 5).map((c) => {
                  const isAuthor = Boolean(user && c.user?._id === user.id);
                  const authorName = c.user?.fullName || `@${c.user?.username || 'user'}`;
                  const authorInitials = (c.user?.fullName || c.user?.username || 'U')
                    .charAt(0)
                    .toUpperCase();
                  return (
                    <View key={c._id} style={styles.commentItem}>
                      {c.user?.avatar ? (
                        <Image
                          source={{ uri: c.user.avatar }}
                          style={styles.commentAvatar}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          style={[
                            styles.commentAvatarFallback,
                            { backgroundColor: C.surfaceRaised },
                          ]}
                        >
                          <Text style={[styles.commentAvatarInitial, { color: C.secondary }]}>
                            {authorInitials}
                          </Text>
                        </View>
                      )}
                      <View style={styles.commentBody}>
                        <View style={styles.commentMetaRow}>
                          <Text style={[styles.commentAuthor, { color: C.text }]}>
                            {authorName}
                          </Text>
                          <Text style={[styles.commentDate, { color: C.muted }]}>
                            {formatTimeAgo(c.createdAt)}
                          </Text>
                          {isAuthor ? (
                            <Pressable
                              style={styles.deleteCommentBtn}
                              onPress={() => handleDeleteComment(c._id)}
                              hitSlop={8}
                            >
                              <SymbolView
                                name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                                size={14}
                                tintColor={C.muted}
                              />
                            </Pressable>
                          ) : null}
                        </View>
                        <Text style={[styles.commentContent, { color: C.secondary }]}>
                          {c.text}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}

              {comments.length > 5 ? (
                <Pressable
                  style={styles.viewAllCommentsBtn}
                  onPress={() => setShowCommentsModal(true)}
                >
                  <Text style={[styles.viewAllCommentsText, { color: Design.color.accent }]}>
                    View all {comments.length} comments
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {/* Related / Up Next Real Videos */}
            {related.length > 0 ? (
              <View style={styles.relatedSection}>
                <Text style={[styles.relatedHeader, { color: C.text }]}>Up Next</Text>
                {related.map((item) => (
                  <Pressable
                    key={item._id}
                    style={({ pressed }) => [
                      styles.relatedCard,
                      { backgroundColor: C.surface, borderColor: C.border },
                      !isDark && Design.shadow.sm,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      router.replace({ pathname: '/watch', params: { id: item._id } });
                    }}
                  >
                    <View style={styles.relatedThumbWrapper}>
                      {item.thumbnailUrl ? (
                        <Image
                          source={{ uri: item.thumbnailUrl }}
                          style={styles.relatedThumb}
                          contentFit="cover"
                        />
                      ) : (
                        <View
                          style={[styles.relatedThumbFallback, { backgroundColor: C.surfaceRaised }]}
                        >
                          <SymbolView
                            name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
                            size={18}
                            tintColor={Design.color.accent}
                          />
                        </View>
                      )}
                      {item.duration ? (
                        <View style={styles.durationBadge}>
                          <Text style={styles.durationText}>{durationLabel(item.duration)}</Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.relatedDetails}>
                      <Text style={[styles.relatedTitle, { color: C.text }]} numberOfLines={2}>
                        {cleanTitle(item.title)}
                      </Text>
                      <Text style={[styles.relatedCreator, { color: C.muted }]} numberOfLines={1}>
                        {creatorLabel(item.creator)}
                      </Text>
                      <Text style={[styles.relatedMetaText, { color: C.muted }]}>
                        {formatViews(item.views)} • {formatTimeAgo(item.createdAt)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {/* Modal for All Comments */}
      <Modal
        visible={showCommentsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCommentsModal(false)}
      >
        <SafeAreaView style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: C.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: C.border }]}>
              <Text style={[styles.modalTitle, { color: C.text }]}>
                Comments ({comments.length})
              </Text>
              <Pressable
                onPress={() => setShowCommentsModal(false)}
                hitSlop={10}
                style={styles.closeBtn}
              >
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={20}
                  tintColor={C.text}
                />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
              {comments.map((c) => {
                const isAuthor = Boolean(user && c.user?._id === user.id);
                return (
                  <View key={c._id} style={styles.commentItem}>
                    {c.user?.avatar ? (
                      <Image
                        source={{ uri: c.user.avatar }}
                        style={styles.commentAvatar}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.commentAvatarFallback,
                          { backgroundColor: C.surfaceRaised },
                        ]}
                      >
                        <Text style={[styles.commentAvatarInitial, { color: C.secondary }]}>
                          {(c.user?.fullName || c.user?.username || 'U').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.commentBody}>
                      <View style={styles.commentMetaRow}>
                        <Text style={[styles.commentAuthor, { color: C.text }]}>
                          {c.user?.fullName || `@${c.user?.username || 'user'}`}
                        </Text>
                        <Text style={[styles.commentDate, { color: C.muted }]}>
                          {formatTimeAgo(c.createdAt)}
                        </Text>
                        {isAuthor ? (
                          <Pressable
                            style={styles.deleteCommentBtn}
                            onPress={() => handleDeleteComment(c._id)}
                            hitSlop={8}
                          >
                            <SymbolView
                              name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                              size={14}
                              tintColor={C.muted}
                            />
                          </Pressable>
                        ) : null}
                      </View>
                      <Text style={[styles.commentContent, { color: C.secondary }]}>{c.text}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  brandText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  searchButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  content: {
    paddingBottom: 40,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  loadingContainer: {
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Design.radius.pill,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  playerContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  externalBackground: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    padding: 20,
  },
  externalLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  externalInfo: {
    color: '#cbd5e1',
    fontSize: 13,
    textAlign: 'center',
  },
  playButton: {
    marginTop: 10,
    backgroundColor: Design.color.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Design.radius.pill,
  },
  playText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  playbackError: {
    padding: 12,
    backgroundColor: '#fee2e2',
  },
  playbackErrorText: {
    color: Design.color.danger,
    fontSize: 13,
    textAlign: 'center',
  },
  metaSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  videoTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  videoSubMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  metaMuted: {
    fontSize: 12,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Design.radius.sm,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  channelBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  channelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: '700',
  },
  channelTexts: {
    flex: 1,
  },
  channelName: {
    fontSize: 14,
    fontWeight: '700',
  },
  subCount: {
    fontSize: 11,
    marginTop: 1,
  },
  subBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Design.radius.pill,
  },
  subBtnInactive: {
    backgroundColor: Design.color.accent,
  },
  subBtnActive: {
    backgroundColor: 'rgba(128, 128, 128, 0.18)',
  },
  subBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  subBtnTextInactive: {
    color: '#fff',
  },
  subBtnTextActive: {},
  subscribedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ownerBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Design.radius.pill,
  },
  ownerBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    alignItems: 'center',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Design.radius.pill,
    height: 38,
    overflow: 'hidden',
  },
  likeSubPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: '100%',
  },
  dislikeSubPill: {
    paddingHorizontal: 12,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillDivider: {
    width: 1,
    height: 20,
  },
  actionPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 38,
    borderRadius: Design.radius.pill,
  },
  actionPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  descCard: {
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 12,
    borderRadius: Design.radius.md,
  },
  descText: {
    fontSize: 13,
    lineHeight: 19,
  },
  descToggle: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  commentsSection: {
    marginHorizontal: 16,
    marginVertical: 10,
    padding: 14,
    borderRadius: Design.radius.md,
    gap: 12,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentsTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  addCommentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userCommentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialSmall: {
    fontSize: 13,
    fontWeight: '700',
  },
  commentInput: {
    flex: 1,
    height: 38,
    borderRadius: Design.radius.pill,
    paddingHorizontal: 14,
    fontSize: 13,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sendCommentBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyComments: {
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 12,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
  },
  commentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  commentAvatarFallback: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentAvatarInitial: {
    fontSize: 12,
    fontWeight: '700',
  },
  commentBody: {
    flex: 1,
  },
  commentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '700',
  },
  commentDate: {
    fontSize: 11,
  },
  deleteCommentBtn: {
    marginLeft: 'auto',
  },
  commentContent: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  viewAllCommentsBtn: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  viewAllCommentsText: {
    fontSize: 13,
    fontWeight: '700',
  },
  relatedSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  relatedHeader: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  relatedCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 8,
    borderRadius: Design.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  relatedThumbWrapper: {
    width: 128,
    aspectRatio: 16 / 9,
    borderRadius: Design.radius.sm,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  relatedThumb: {
    width: '100%',
    height: '100%',
  },
  relatedThumbFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: Design.radius.sm,
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  relatedDetails: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  relatedTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  relatedCreator: {
    fontSize: 11,
  },
  relatedMetaText: {
    fontSize: 11,
  },
  pressed: {
    opacity: 0.85,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    flex: 1,
    marginTop: 80,
    borderTopLeftRadius: Design.radius.lg,
    borderTopRightRadius: Design.radius.lg,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
});
