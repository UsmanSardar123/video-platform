import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { FlatList, Modal, StyleSheet } from 'react-native';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  ThemeToggleButton,
  View,
} from '@/components/theme-native';
import { Design } from '@/constants/design';
import { useAuth } from '@/contexts/auth-context';
import { useSubscription } from '@/contexts/subscription-context';
import { useThemeMode } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import { useNotifications } from '@/contexts/notification-context';
import { apiRequest } from '@/lib/api';
import {
  clearHistory,
  deleteCreatorReview,
  fetchCreatorReviews,
  fetchHistory,
  fetchLikedVideos,
  fetchSubscriptionStatus,
  fetchUserProfile,
  fetchWatchLater,
  removeHistoryItem,
  setVideoLike,
  setWatchLater,
  submitCreatorReview,
  uploadAvatarImage,
} from '@/lib/video-service';
import {
  cleanTitle,
  creatorInitials,
  creatorLabel,
  type CreatorReview,
  durationLabel,
  formatTimeAgo,
  formatViews,
  type VideoRecord,
} from '@/types/video';

type LibraryTab = 'uploads' | 'watch-later' | 'liked';

export default function ProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const { user, loading: authLoading, logout, deleteAccount, updateProfile } = useAuth();
  const { mode } = useThemeMode();
  const { showToast } = useToast();
  const { unreadCount } = useNotifications();
  const isDark = mode === 'dark';
  const C = isDark ? Design.color : Design.light;

  const [avatarUploading, setAvatarUploading] = useState(false);

  // Viewing someone else's channel vs own studio (safe parameter normalization)
  const rawUserId = Array.isArray(userId) ? userId[0] : userId;
  const targetUserId = typeof rawUserId === 'string' ? rawUserId.trim() : '';
  const isSelf = Boolean(user && targetUserId && user.id === targetUserId);
  const isOtherCreator = Boolean(targetUserId && !isSelf);

  const {
    isSubscribed: checkSubscribed,
    getSubscriberCount,
    isSubscribing: checkSubscribing,
    fetchStatus,
    toggleSubscribe,
    showSignInModal,
  } = useSubscription();

  // Other creator state
  const [creatorUser, setCreatorUser] = useState<{
    _id: string;
    username: string;
    fullName: string;
    avatar?: string;
    bio?: string;
  } | null>(null);

  // Reviews state
  const [reviews, setReviews] = useState<CreatorReview[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [userReview, setUserReview] = useState<CreatorReview | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [deletingReview, setDeletingReview] = useState(false);

  // Own Library State
  const [activeTab, setActiveTab] = useState<LibraryTab>('uploads');
  const [myVideos, setMyVideos] = useState<VideoRecord[]>([]);
  const [watchLaterVideos, setWatchLaterVideos] = useState<VideoRecord[]>([]);
  const [likedVideos, setLikedVideos] = useState<VideoRecord[]>([]);
  const [historyVideos, setHistoryVideos] = useState<(VideoRecord & { watchedAt?: string })[]>([]);
  const [subscriberCount, setSubscriberCount] = useState(0);

  const isSubscribed = isOtherCreator && targetUserId ? checkSubscribed(targetUserId) : false;
  const currentSubscriberCount = isOtherCreator && targetUserId
    ? getSubscriberCount(targetUserId, 0)
    : subscriberCount;
  const subscribing = isOtherCreator && targetUserId ? checkSubscribing(targetUserId) : false;

  // Loading & Action states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmVideoId, setConfirmVideoId] = useState('');
  const [deletingVideoId, setDeletingVideoId] = useState('');
  const [showAccountDeletion, setShowAccountDeletion] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Load data for other creator channel
  const loadOtherCreator = useCallback(async (targetId: string) => {
    if (!targetId) return;
    setLoading(true);
    setError('');
    try {
      const [userProfile, feedRes, , reviewData] = await Promise.all([
        fetchUserProfile(targetId),
        apiRequest<VideoRecord[]>(`/api/videos?creator=${encodeURIComponent(targetId)}&limit=50`).catch(() =>
          apiRequest<VideoRecord[]>('/api/videos?limit=50')
        ),
        fetchStatus(targetId),
        fetchCreatorReviews(targetId).catch(() => ({
          reviews: [] as CreatorReview[],
          averageRating: 0,
          totalReviews: 0,
          userReview: null,
        })),
      ]);
      const targetVideos = (feedRes.data || []).filter((v) => {
        const cId = typeof v.creator === 'object' && v.creator?._id ? v.creator._id : v.creator;
        return cId === targetId;
      });
      setMyVideos(targetVideos);
      setReviews(reviewData.reviews || []);
      setAverageRating(reviewData.averageRating || 0);
      setTotalReviews(reviewData.totalReviews || 0);
      setUserReview(reviewData.userReview || null);
      if (reviewData.userReview) {
        setReviewRating(reviewData.userReview.rating);
        setReviewComment(reviewData.userReview.comment || '');
      } else {
        setReviewRating(5);
        setReviewComment('');
      }

      if (userProfile) {
        setCreatorUser({
          _id: userProfile.id,
          username: userProfile.username,
          fullName: userProfile.fullName,
          avatar: userProfile.avatar,
          bio: userProfile.bio,
        });
      } else if (targetVideos.length > 0 && typeof targetVideos[0].creator === 'object' && targetVideos[0].creator) {
        const c = targetVideos[0].creator;
        setCreatorUser({
          _id: c._id,
          username: c.username,
          fullName: c.fullName,
          avatar: c.avatar,
        });
      } else {
        setCreatorUser(null);
        setError('This creator channel is no longer available.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load creator channel.');
    } finally {
      setLoading(false);
    }
  }, [
    fetchStatus,
    setAverageRating,
    setCreatorUser,
    setError,
    setLoading,
    setMyVideos,
    setReviewComment,
    setReviewRating,
    setReviews,
    setTotalReviews,
    setUserReview,
  ]);

  // Load data for own library & studio
  const loadOwnLibrary = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [mineRes, watchLater, liked, history, statusRes, reviewData] = await Promise.all([
        apiRequest<VideoRecord[]>('/api/videos/mine'),
        fetchWatchLater().catch(() => []),
        fetchLikedVideos().catch(() => []),
        fetchHistory().catch(() => []),
        fetchSubscriptionStatus(user.id).catch(() => ({ isSubscribed: false, subscriberCount: 0 })),
        fetchCreatorReviews(user.id).catch(() => ({
          reviews: [] as CreatorReview[],
          averageRating: 0,
          totalReviews: 0,
          userReview: null,
        })),
      ]);
      setMyVideos(mineRes.data || []);
      setWatchLaterVideos(watchLater);
      setLikedVideos(liked);
      setHistoryVideos(history);
      setSubscriberCount(statusRes.subscriberCount);
      setReviews(reviewData.reviews || []);
      setAverageRating(reviewData.averageRating || 0);
      setTotalReviews(reviewData.totalReviews || 0);
      setUserReview(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load library data.');
    } finally {
      setLoading(false);
    }
  }, [
    user,
    setAverageRating,
    setError,
    setHistoryVideos,
    setLikedVideos,
    setLoading,
    setMyVideos,
    setReviews,
    setSubscriberCount,
    setTotalReviews,
    setUserReview,
    setWatchLaterVideos,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (isOtherCreator && targetUserId) {
        void loadOtherCreator(targetUserId);
      } else {
        void loadOwnLibrary();
      }
    }, [isOtherCreator, targetUserId, loadOtherCreator, loadOwnLibrary])
  );

  const handleToggleSubscribe = () => {
    if (!targetUserId) return;
    toggleSubscribe({
      id: targetUserId,
      name: creatorUser?.fullName || creatorUser?.username || 'Creator',
    });
  };

  const handleOpenReviewModal = () => {
    if (!user) {
      showSignInModal('review creators');
      return;
    }
    if (userReview) {
      setReviewRating(userReview.rating);
      setReviewComment(userReview.comment || '');
    } else {
      setReviewRating(5);
      setReviewComment('');
    }
    setShowReviewModal(true);
  };

  const handleSubmitReview = async () => {
    if (!targetUserId || !user) return;
    setSubmittingReview(true);
    try {
      await submitCreatorReview(targetUserId, reviewRating, reviewComment.trim());
      showToast(userReview ? 'Review updated!' : 'Review submitted!');
      const reviewData = await fetchCreatorReviews(targetUserId);
      setReviews(reviewData.reviews || []);
      setAverageRating(reviewData.averageRating || 0);
      setTotalReviews(reviewData.totalReviews || 0);
      setUserReview(reviewData.userReview || null);
      setShowReviewModal(false);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Could not submit review', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!targetUserId || !userReview) return;
    setDeletingReview(true);
    try {
      await deleteCreatorReview(targetUserId, userReview._id);
      showToast('Review removed');
      const reviewData = await fetchCreatorReviews(targetUserId);
      setReviews(reviewData.reviews || []);
      setAverageRating(reviewData.averageRating || 0);
      setTotalReviews(reviewData.totalReviews || 0);
      setUserReview(null);
      setReviewRating(5);
      setReviewComment('');
      setShowReviewModal(false);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Could not delete review', 'error');
    } finally {
      setDeletingReview(false);
    }
  };

  const removeVideo = async (videoId: string) => {
    setError('');
    setDeletingVideoId(videoId);
    try {
      await apiRequest(`/api/videos/${encodeURIComponent(videoId)}`, { method: 'DELETE' });
      setMyVideos((current) => current.filter((video) => video._id !== videoId));
      setConfirmVideoId('');
      showToast('Video deleted.');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not delete this video.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setDeletingVideoId('');
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearHistory();
      setHistoryVideos([]);
      showToast('Watch history cleared');
    } catch {
      showToast('Could not clear history', 'error');
    }
  };

  const handleRemoveHistoryVideo = async (vidId: string) => {
    try {
      await removeHistoryItem(vidId);
      setHistoryVideos((prev) => prev.filter((v) => v._id !== vidId));
      showToast('Removed from history');
    } catch {
      showToast('Could not remove video from history', 'error');
    }
  };

  const handleRemoveWatchLater = async (videoId: string) => {
    try {
      await setWatchLater(videoId, false);
      setWatchLaterVideos((prev) => prev.filter((v) => v._id !== videoId));
      showToast('Removed from Watch Later');
    } catch {
      showToast('Could not remove video', 'error');
    }
  };

  const handleRemoveLiked = async (videoId: string) => {
    try {
      await setVideoLike(videoId, 'none');
      setLikedVideos((prev) => prev.filter((v) => v._id !== videoId));
      showToast('Removed from Liked videos');
    } catch {
      showToast('Could not remove video', 'error');
    }
  };

  const handlePlayAll = (playlist: VideoRecord[]) => {
    if (playlist.length > 0) {
      router.push({ pathname: '/watch', params: { id: playlist[0]._id } });
    }
  };

  const handlePickAvatar = async () => {
    if (!user) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || !result.assets[0]?.uri) return;

      const asset = result.assets[0];
      setAvatarUploading(true);

      const uploadedUrl = await uploadAvatarImage(asset);
      await updateProfile({ avatar: uploadedUrl });
      showToast('Profile picture updated!');
    } catch (err: any) {
      showToast(err?.message || 'Could not update profile picture', 'error');
    } finally {
      setAvatarUploading(false);
    }
  };

  const removeAccount = async () => {
    setError('');
    if (!accountPassword) {
      setError('Enter your current password to delete your account.');
      return;
    }
    setDeletingAccount(true);
    try {
      await deleteAccount(accountPassword);
      showToast('Account deleted.');
      router.replace('/main');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not delete your account.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setDeletingAccount(false);
    }
  };

  if (authLoading) {
    return (
      <SafeAreaView edges={['top']} style={[styles.center, { backgroundColor: C.background }]}>
        <ActivityIndicator color={Design.color.accent} />
      </SafeAreaView>
    );
  }

  // Active list of videos depending on selected tab
  const displayedVideos =
    activeTab === 'uploads'
      ? myVideos
      : activeTab === 'watch-later'
      ? watchLaterVideos
      : likedVideos;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Top Header */}
        <View style={[styles.header, { borderBottomColor: C.border }]}>
          {isOtherCreator ? (
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
          ) : (
            <View>
              <Text style={styles.eyebrow}>STREANUB STUDIO</Text>
              <Text style={[styles.heading, { color: C.text }]}>You</Text>
            </View>
          )}
          <View style={styles.headerRight}>
            {!isOtherCreator ? (
              <Pressable
                hitSlop={8}
                onPress={() => router.push('/notifications')}
                style={styles.headerIconBtn}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
              >
                <SymbolView
                  name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
                  size={20}
                  tintColor={C.text}
                />
                {unreadCount > 0 ? (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
            <Pressable
              hitSlop={8}
              onPress={() => router.push('/main/explore')}
              style={styles.headerIconBtn}
              accessibilityRole="button"
              accessibilityLabel="Search"
            >
              <SymbolView
                name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
                size={20}
                tintColor={C.text}
              />
            </Pressable>
            <Pressable
              hitSlop={8}
              onPress={() => router.push('/settings')}
              style={styles.headerIconBtn}
              accessibilityRole="button"
              accessibilityLabel="Settings"
            >
              <SymbolView
                name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }}
                size={20}
                tintColor={C.text}
              />
            </Pressable>
            <ThemeToggleButton />
          </View>
        </View>

        {/* -------------------- OTHER CREATOR CHANNEL VIEW -------------------- */}
        {isOtherCreator ? (
          <>
            {error ? (
              <View style={[styles.state, { marginHorizontal: 16, marginVertical: 12 }]}>
                <Text style={[styles.error, { color: Design.color.danger }]}>{error}</Text>
                <Pressable onPress={() => targetUserId && loadOtherCreator(targetUserId)}>
                  <Text style={[styles.retry, { color: Design.color.accent }]}>Try again</Text>
                </Pressable>
              </View>
            ) : null}
            {/* Channel Banner */}
            <View
              style={[
                styles.channelBanner,
                { backgroundColor: C.surfaceRaised, borderColor: C.border, borderWidth: StyleSheet.hairlineWidth },
                !isDark && Design.shadow.sm,
              ]}
            >
              <View style={styles.bannerDecor}>
                <SymbolView
                  name={{ ios: 'play.tv.fill', android: 'tv', web: 'tv' }}
                  size={42}
                  tintColor={Design.color.accent}
                />
                <Text style={styles.bannerBrand}>STREANUB CREATOR</Text>
              </View>
            </View>

            {/* Creator Identity Card */}
            <View
              style={[
                styles.identity,
                { backgroundColor: C.surface, borderColor: C.border },
                !isDark && Design.shadow.sm,
              ]}
            >
              {creatorUser?.avatar ? (
                <Image
                  source={{ uri: creatorUser.avatar }}
                  style={styles.avatar}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    styles.avatarFallback,
                    { backgroundColor: isDark ? Design.color.accentSurface : '#fee2e2' },
                  ]}
                >
                  <Text style={[styles.initial, { color: Design.color.accent }]}>
                    {creatorInitials(creatorUser)}
                  </Text>
                </View>
              )}
              <Text style={[styles.name, { color: C.text }]}>
                {creatorUser?.fullName || creatorUser?.username || 'Creator Channel'}
              </Text>
              <Text style={[styles.username, { color: C.muted }]}>
                @{creatorUser?.username || 'creator'}
              </Text>

              {creatorUser?.bio ? (
                <Text style={[styles.bio, { color: C.secondary }]}>{creatorUser.bio}</Text>
              ) : null}

              {/* Stats Bar */}
              <View style={[styles.stats, { backgroundColor: C.surfaceRaised, borderColor: C.border, borderWidth: StyleSheet.hairlineWidth }]}>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: C.text }]}>{currentSubscriberCount}</Text>
                  <Text style={[styles.statLabel, { color: C.muted }]}>Subscribers</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: C.border }]} />
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: C.text }]}>{myVideos.length}</Text>
                  <Text style={[styles.statLabel, { color: C.muted }]}>Videos</Text>
                </View>
                <View style={[styles.divider, { backgroundColor: C.border }]} />
                <Pressable style={styles.stat} onPress={() => setShowReviewModal(true)}>
                  <Text style={[styles.statValue, { color: C.text }]}>
                    ★ {averageRating > 0 ? averageRating.toFixed(1) : 'New'}
                  </Text>
                  <Text style={[styles.statLabel, { color: C.muted }]}>
                    {totalReviews === 1 ? '1 Review' : `${totalReviews} Reviews`}
                  </Text>
                </Pressable>
              </View>

              {/* Subscribe & Review Action Row */}
              <View style={styles.channelActionRow}>
                <Pressable
                  style={[
                    styles.channelSubBtn,
                    isSubscribed
                      ? [styles.channelSubBtnActive, { backgroundColor: C.surfaceRaised, borderColor: C.border, borderWidth: 1 }]
                      : [styles.channelSubBtnInactive, { backgroundColor: C.accent }],
                    !isDark && Design.shadow.sm,
                    { flex: 1 },
                  ]}
                  disabled={subscribing}
                  onPress={handleToggleSubscribe}
                >
                  {subscribing ? (
                    <ActivityIndicator size="small" color={isSubscribed ? C.text : '#fff'} />
                  ) : isSubscribed ? (
                    <SymbolView
                      name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
                      size={16}
                      tintColor={C.secondary}
                    />
                  ) : null}
                  <Text
                    style={[
                      styles.channelSubBtnText,
                      isSubscribed ? { color: C.text } : { color: '#ffffff' },
                    ]}
                  >
                    {subscribing ? 'Updating...' : isSubscribed ? 'Subscribed' : 'Subscribe'}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.channelReviewBtn,
                    { backgroundColor: C.surfaceRaised, borderColor: C.border, borderWidth: 1 },
                    !isDark && Design.shadow.sm,
                  ]}
                  onPress={handleOpenReviewModal}
                >
                  <SymbolView
                    name={{
                      ios: userReview ? 'star.fill' : 'star',
                      android: userReview ? 'star' : 'star_border',
                      web: 'star',
                    }}
                    size={16}
                    tintColor={userReview ? Design.color.accent : C.text}
                  />
                  <Text style={[styles.channelReviewBtnText, { color: C.text }]}>
                    {userReview ? 'Your Review' : 'Review'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Creator's Uploaded Videos */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: C.text }]}>Videos</Text>
              <Text style={[styles.muted, { color: C.muted }]}>{myVideos.length} uploaded</Text>
            </View>

            {myVideos.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={[styles.empty, { color: C.muted }]}>
                  This creator has not uploaded any public videos yet.
                </Text>
              </View>
            ) : (
              myVideos.map((video) => (
                <Pressable
                  key={video._id}
                  style={[
                    styles.videoRow,
                    { backgroundColor: C.surface, borderColor: C.border },
                    !isDark && Design.shadow.sm,
                  ]}
                  onPress={() => router.push({ pathname: '/watch', params: { id: video._id } })}
                >
                  <View style={styles.thumbWrap}>
                    {video.thumbnailUrl ? (
                      <Image
                        source={{ uri: video.thumbnailUrl }}
                        style={styles.thumb}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[styles.thumbFallback, { backgroundColor: C.surfaceRaised }]}
                      />
                    )}
                    {video.duration > 0 ? (
                      <Text style={styles.duration}>{durationLabel(video.duration)}</Text>
                    ) : null}
                  </View>
                  <View style={styles.videoMeta}>
                    <Text style={[styles.videoTitle, { color: C.text }]} numberOfLines={2}>
                      {cleanTitle(video.title)}
                    </Text>
                    <Text style={[styles.muted, { color: C.muted }]}>
                      {formatViews(video.views)} • {formatTimeAgo(video.createdAt)}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </>
        ) : user ? (
          /* -------------------- LOGGED IN USER "YOU" / STUDIO VIEW -------------------- */
          <>
            {/* YouTube-Style Account & Channel Header */}
            <View
              style={[
                styles.accountHeaderCard,
                { backgroundColor: C.surface, borderColor: C.border },
                !isDark && Design.shadow.sm,
              ]}
            >
              <View style={styles.accountHeaderTop}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Change profile picture"
                  disabled={avatarUploading}
                  onPress={handlePickAvatar}
                  style={styles.avatarButtonWrap}
                >
                  {user.avatar ? (
                    <Image source={{ uri: user.avatar }} style={styles.accountAvatar} contentFit="cover" />
                  ) : (
                    <View
                      style={[
                        styles.accountAvatarFallback,
                        { backgroundColor: isDark ? Design.color.accentSurface : '#fee2e2' },
                      ]}
                    >
                      <Text style={[styles.accountAvatarInitial, { color: Design.color.accent }]}>
                        {(user.fullName || user.username).charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {avatarUploading ? (
                    <View style={styles.avatarLoadingOverlay}>
                      <ActivityIndicator size="small" color="#ffffff" />
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.avatarCameraBadge,
                        { backgroundColor: Design.color.accent, borderColor: C.background },
                      ]}
                    >
                      <SymbolView
                        name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }}
                        size={12}
                        tintColor="#ffffff"
                      />
                    </View>
                  )}
                </Pressable>

                <View style={styles.accountInfo}>
                  <Text style={[styles.accountName, { color: C.text }]} numberOfLines={1}>
                    {user.fullName || user.username}
                  </Text>
                  <Pressable
                    onPress={() => router.push({ pathname: '/main/profile', params: { userId: user.id } })}
                    hitSlop={4}
                  >
                    <Text style={[styles.accountHandle, { color: C.muted }]}>
                      @{user.username} • <Text style={{ color: Design.color.accent, fontWeight: '700' }}>View channel ›</Text>
                    </Text>
                  </Pressable>
                  <Text style={[styles.accountMeta, { color: C.secondary }]}>
                    {subscriberCount} subscribers • {myVideos.length} uploads
                  </Text>
                </View>
              </View>

              {user.bio ? (
                <Text style={[styles.accountBio, { color: C.secondary }]} numberOfLines={2}>
                  {user.bio}
                </Text>
              ) : null}

              {/* Action Chips Bar */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.actionChipsRow}
              >
                <Pressable
                  style={[styles.actionChip, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}
                  onPress={() => router.push('/edit-profile')}
                >
                  <SymbolView
                    name={{ ios: 'pencil', android: 'edit', web: 'edit' }}
                    size={14}
                    tintColor={C.text}
                  />
                  <Text style={[styles.actionChipText, { color: C.text }]}>Edit profile</Text>
                </Pressable>

                <Pressable
                  style={[styles.actionChip, { backgroundColor: Design.color.accent }]}
                  onPress={() => router.push({ pathname: '/upload', params: { returnTo: '/main/profile' } })}
                >
                  <SymbolView
                    name={{ ios: 'plus', android: 'add', web: 'add' }}
                    size={14}
                    tintColor="#fff"
                  />
                  <Text style={[styles.actionChipText, { color: '#fff', fontWeight: '700' }]}>Upload video</Text>
                </Pressable>

                <Pressable
                  style={[styles.actionChip, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}
                  onPress={() => setShowReviewModal(true)}
                >
                  <SymbolView
                    name={{ ios: 'star.fill', android: 'star', web: 'star' }}
                    size={14}
                    tintColor={Design.color.accent}
                  />
                  <Text style={[styles.actionChipText, { color: C.text }]}>
                    Reviews ({averageRating > 0 ? averageRating.toFixed(1) : 'New'})
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.actionChip, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}
                  onPress={() => router.push('/settings')}
                >
                  <SymbolView
                    name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }}
                    size={14}
                    tintColor={C.text}
                  />
                  <Text style={[styles.actionChipText, { color: C.text }]}>Settings</Text>
                </Pressable>

                <Pressable
                  style={[styles.actionChip, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}
                  onPress={async () => {
                    await logout();
                    router.replace('/main');
                  }}
                >
                  <SymbolView
                    name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
                    size={14}
                    tintColor={Design.color.danger}
                  />
                  <Text style={[styles.actionChipText, { color: Design.color.danger }]}>Sign out</Text>
                </Pressable>
              </ScrollView>
            </View>

            {/* -------------------- WATCH HISTORY SECTION -------------------- */}
            <View style={styles.historySection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <SymbolView
                    name={{ ios: 'clock.fill', android: 'history', web: 'history' }}
                    size={18}
                    tintColor={Design.color.accent}
                  />
                  <Text style={[styles.sectionTitle, { color: C.text }]}>History</Text>
                </View>
                {historyVideos.length > 0 ? (
                  <View style={styles.historyActions}>
                    <Pressable
                      style={styles.historyActionBtn}
                      onPress={() => handlePlayAll(historyVideos)}
                      hitSlop={8}
                    >
                      <SymbolView
                        name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
                        size={12}
                        tintColor={Design.color.accent}
                      />
                      <Text style={[styles.historyActionText, { color: Design.color.accent }]}>
                        Play all
                      </Text>
                    </Pressable>
                    <Pressable onPress={handleClearHistory} hitSlop={8}>
                      <Text style={[styles.clearLink, { color: C.muted }]}>
                        Clear all
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>

              {historyVideos.length > 0 ? (
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={historyVideos}
                  keyExtractor={(item) => item._id}
                  contentContainerStyle={styles.historyList}
                  renderItem={({ item }) => (
                    <View
                      style={[
                        styles.historyCard,
                        { backgroundColor: C.surface, borderColor: C.border, borderWidth: StyleSheet.hairlineWidth },
                        !isDark && Design.shadow.sm,
                      ]}
                    >
                      <Pressable
                        style={styles.historyThumbWrapper}
                        onPress={() =>
                          router.push({ pathname: '/watch', params: { id: item._id } })
                        }
                      >
                        {item.thumbnailUrl ? (
                          <Image
                            source={{ uri: item.thumbnailUrl }}
                            style={styles.historyThumb}
                            contentFit="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.historyThumbFallback,
                              { backgroundColor: C.surfaceRaised },
                            ]}
                          />
                        )}
                        {item.duration > 0 ? (
                          <View style={styles.durationBadge}>
                            <Text style={styles.durationText}>{durationLabel(item.duration)}</Text>
                          </View>
                        ) : null}
                        <View style={styles.progressBarBackground}>
                          <View style={[styles.progressBarFill, { backgroundColor: Design.color.accent }]} />
                        </View>
                      </Pressable>
                      <View style={styles.historyCardMeta}>
                        <Text style={[styles.historyCardTitle, { color: C.text }]} numberOfLines={2}>
                          {cleanTitle(item.title)}
                        </Text>
                        <Text style={[styles.historyCardCreator, { color: C.muted }]} numberOfLines={1}>
                          {creatorLabel(item.creator)}
                        </Text>
                      </View>
                      <Pressable
                        style={styles.historyRemoveBtn}
                        onPress={() => handleRemoveHistoryVideo(item._id)}
                        hitSlop={6}
                        accessibilityLabel="Remove from history"
                      >
                        <SymbolView
                          name={{ ios: 'xmark', android: 'close', web: 'close' }}
                          size={11}
                          tintColor="#ffffff"
                        />
                      </Pressable>
                    </View>
                  )}
                />
              ) : (
                <View style={[styles.emptyHistoryCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <SymbolView
                    name={{ ios: 'clock', android: 'history', web: 'history' }}
                    size={28}
                    tintColor={C.muted}
                  />
                  <Text style={[styles.emptyHistoryTitle, { color: C.text }]}>No watch history</Text>
                  <Text style={[styles.emptyHistorySubtitle, { color: C.muted }]}>
                    Videos you watch will show up here.
                  </Text>
                </View>
              )}
            </View>

            {/* -------------------- PLAYLISTS HUB -------------------- */}
            <View style={styles.playlistsHubSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <SymbolView
                    name={{ ios: 'rectangle.stack.fill', android: 'queue_music', web: 'queue_music' }}
                    size={18}
                    tintColor={Design.color.accent}
                  />
                  <Text style={[styles.sectionTitle, { color: C.text }]}>Playlists</Text>
                </View>
                <Text style={[styles.playlistsCountText, { color: C.muted }]}>
                  3 playlists
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.playlistsCardsList}
              >
                {/* Watch Later Playlist Card */}
                <Pressable
                  style={[
                    styles.playlistHubCard,
                    activeTab === 'watch-later' && { borderColor: Design.color.accent, borderWidth: 2 },
                    { backgroundColor: C.surface, borderColor: activeTab === 'watch-later' ? Design.color.accent : C.border },
                    !isDark && Design.shadow.sm,
                  ]}
                  onPress={() => setActiveTab('watch-later')}
                >
                  <View style={styles.playlistThumbContainer}>
                    {watchLaterVideos[0]?.thumbnailUrl ? (
                      <Image source={{ uri: watchLaterVideos[0].thumbnailUrl }} style={styles.playlistThumbImage} contentFit="cover" />
                    ) : (
                      <View style={[styles.playlistThumbFallback, { backgroundColor: '#1e293b' }]}>
                        <SymbolView
                          name={{ ios: 'clock.fill', android: 'schedule', web: 'schedule' }}
                          size={32}
                          tintColor="#94a3b8"
                        />
                      </View>
                    )}
                    <View style={styles.playlistThumbBadge}>
                      <SymbolView
                        name={{ ios: 'clock.fill', android: 'schedule', web: 'schedule' }}
                        size={12}
                        tintColor="#ffffff"
                      />
                      <Text style={styles.playlistThumbBadgeText}>{watchLaterVideos.length}</Text>
                    </View>
                  </View>
                  <View style={styles.playlistCardContent}>
                    <Text style={[styles.playlistCardTitle, { color: C.text }]} numberOfLines={1}>
                      Watch Later
                    </Text>
                    <Text style={[styles.playlistCardMeta, { color: C.muted }]}>
                      Private • {watchLaterVideos.length} {watchLaterVideos.length === 1 ? 'video' : 'videos'}
                    </Text>
                    {watchLaterVideos.length > 0 ? (
                      <Pressable
                        style={[styles.playlistPlayBtn, { backgroundColor: Design.color.accent }]}
                        onPress={() => handlePlayAll(watchLaterVideos)}
                      >
                        <SymbolView
                          name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
                          size={11}
                          tintColor="#ffffff"
                        />
                        <Text style={styles.playlistPlayBtnText}>Play All</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Pressable>

                {/* Liked Videos Playlist Card */}
                <Pressable
                  style={[
                    styles.playlistHubCard,
                    activeTab === 'liked' && { borderColor: Design.color.accent, borderWidth: 2 },
                    { backgroundColor: C.surface, borderColor: activeTab === 'liked' ? Design.color.accent : C.border },
                    !isDark && Design.shadow.sm,
                  ]}
                  onPress={() => setActiveTab('liked')}
                >
                  <View style={styles.playlistThumbContainer}>
                    {likedVideos[0]?.thumbnailUrl ? (
                      <Image source={{ uri: likedVideos[0].thumbnailUrl }} style={styles.playlistThumbImage} contentFit="cover" />
                    ) : (
                      <View style={[styles.playlistThumbFallback, { backgroundColor: '#312e81' }]}>
                        <SymbolView
                          name={{ ios: 'hand.thumbsup.fill', android: 'thumb_up', web: 'thumb_up' }}
                          size={32}
                          tintColor="#a5b4fc"
                        />
                      </View>
                    )}
                    <View style={styles.playlistThumbBadge}>
                      <SymbolView
                        name={{ ios: 'hand.thumbsup.fill', android: 'thumb_up', web: 'thumb_up' }}
                        size={12}
                        tintColor="#ffffff"
                      />
                      <Text style={styles.playlistThumbBadgeText}>{likedVideos.length}</Text>
                    </View>
                  </View>
                  <View style={styles.playlistCardContent}>
                    <Text style={[styles.playlistCardTitle, { color: C.text }]} numberOfLines={1}>
                      Liked videos
                    </Text>
                    <Text style={[styles.playlistCardMeta, { color: C.muted }]}>
                      Private • {likedVideos.length} {likedVideos.length === 1 ? 'video' : 'videos'}
                    </Text>
                    {likedVideos.length > 0 ? (
                      <Pressable
                        style={[styles.playlistPlayBtn, { backgroundColor: Design.color.accent }]}
                        onPress={() => handlePlayAll(likedVideos)}
                      >
                        <SymbolView
                          name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
                          size={11}
                          tintColor="#ffffff"
                        />
                        <Text style={styles.playlistPlayBtnText}>Play All</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Pressable>

                {/* Your Uploads Playlist Card */}
                <Pressable
                  style={[
                    styles.playlistHubCard,
                    activeTab === 'uploads' && { borderColor: Design.color.accent, borderWidth: 2 },
                    { backgroundColor: C.surface, borderColor: activeTab === 'uploads' ? Design.color.accent : C.border },
                    !isDark && Design.shadow.sm,
                  ]}
                  onPress={() => setActiveTab('uploads')}
                >
                  <View style={styles.playlistThumbContainer}>
                    {myVideos[0]?.thumbnailUrl ? (
                      <Image source={{ uri: myVideos[0].thumbnailUrl }} style={styles.playlistThumbImage} contentFit="cover" />
                    ) : (
                      <View style={[styles.playlistThumbFallback, { backgroundColor: '#701a75' }]}>
                        <SymbolView
                          name={{ ios: 'video.fill', android: 'videocam', web: 'videocam' }}
                          size={32}
                          tintColor="#f0abfc"
                        />
                      </View>
                    )}
                    <View style={styles.playlistThumbBadge}>
                      <SymbolView
                        name={{ ios: 'video.fill', android: 'videocam', web: 'videocam' }}
                        size={12}
                        tintColor="#ffffff"
                      />
                      <Text style={styles.playlistThumbBadgeText}>{myVideos.length}</Text>
                    </View>
                  </View>
                  <View style={styles.playlistCardContent}>
                    <Text style={[styles.playlistCardTitle, { color: C.text }]} numberOfLines={1}>
                      Your videos
                    </Text>
                    <Text style={[styles.playlistCardMeta, { color: C.muted }]}>
                      Public • {myVideos.length} {myVideos.length === 1 ? 'upload' : 'uploads'}
                    </Text>
                    {myVideos.length > 0 ? (
                      <Pressable
                        style={[styles.playlistPlayBtn, { backgroundColor: Design.color.accent }]}
                        onPress={() => handlePlayAll(myVideos)}
                      >
                        <SymbolView
                          name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
                          size={11}
                          tintColor="#ffffff"
                        />
                        <Text style={styles.playlistPlayBtnText}>Play All</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Pressable>
              </ScrollView>
            </View>

            {/* -------------------- PLAYLISTS & LIBRARY TABS -------------------- */}
            <View style={styles.libraryTabsContainer}>
              <View
                style={[
                  styles.tabBar,
                  { backgroundColor: C.surfaceRaised, borderColor: C.border, borderWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <Pressable
                  style={[
                    styles.tabButton,
                    activeTab === 'uploads' && [styles.tabButtonActive, { backgroundColor: C.surface, borderColor: C.border }, !isDark && Design.shadow.sm],
                  ]}
                  onPress={() => setActiveTab('uploads')}
                >
                  <Text
                    style={[
                      styles.tabButtonText,
                      { color: activeTab === 'uploads' ? C.text : C.muted },
                      activeTab === 'uploads' && styles.tabButtonTextActive,
                    ]}
                  >
                    Your Videos ({myVideos.length})
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.tabButton,
                    activeTab === 'watch-later' && [styles.tabButtonActive, { backgroundColor: C.surface, borderColor: C.border }, !isDark && Design.shadow.sm],
                  ]}
                  onPress={() => setActiveTab('watch-later')}
                >
                  <Text
                    style={[
                      styles.tabButtonText,
                      { color: activeTab === 'watch-later' ? C.text : C.muted },
                      activeTab === 'watch-later' && styles.tabButtonTextActive,
                    ]}
                  >
                    Watch Later ({watchLaterVideos.length})
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.tabButton,
                    activeTab === 'liked' && [styles.tabButtonActive, { backgroundColor: C.surface, borderColor: C.border }, !isDark && Design.shadow.sm],
                  ]}
                  onPress={() => setActiveTab('liked')}
                >
                  <Text
                    style={[
                      styles.tabButtonText,
                      { color: activeTab === 'liked' ? C.text : C.muted },
                      activeTab === 'liked' && styles.tabButtonTextActive,
                    ]}
                  >
                    Liked ({likedVideos.length})
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Active Tab Title & Play All Bar */}
            <View style={styles.activeTabHeader}>
              <Text style={[styles.activeTabTitle, { color: C.text }]}>
                {activeTab === 'uploads'
                  ? 'Your Videos'
                  : activeTab === 'watch-later'
                  ? 'Watch Later'
                  : 'Liked Videos'}
              </Text>
              {displayedVideos.length > 0 ? (
                <Pressable
                  style={[styles.playAllPill, { backgroundColor: Design.color.accent }]}
                  onPress={() => handlePlayAll(displayedVideos)}
                >
                  <SymbolView
                    name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
                    size={13}
                    tintColor="#ffffff"
                  />
                  <Text style={styles.playAllPillText}>Play All</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Videos List for Selected Tab */}
            {loading && displayedVideos.length === 0 ? (
              <ActivityIndicator color={Design.color.accent} style={styles.loader} />
            ) : null}

            {error ? (
              <View style={styles.state}>
                <Text style={[styles.error, { color: Design.color.danger }]}>{error}</Text>
                <Pressable onPress={() => loadOwnLibrary()}>
                  <Text style={[styles.retry, { color: Design.color.accent }]}>Try again</Text>
                </Pressable>
              </View>
            ) : null}

            {!loading && !error && displayedVideos.length === 0 ? (
              <View style={[styles.emptyContainer, { backgroundColor: C.surface, borderColor: C.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: Design.radius.md }]}>
                <SymbolView
                  name={{
                    ios: activeTab === 'uploads' ? 'video' : activeTab === 'watch-later' ? 'clock' : 'hand.thumbsup',
                    android: activeTab === 'uploads' ? 'videocam' : activeTab === 'watch-later' ? 'schedule' : 'thumb_up',
                    web: activeTab === 'uploads' ? 'videocam' : activeTab === 'watch-later' ? 'schedule' : 'thumb_up',
                  }}
                  size={36}
                  tintColor={C.muted}
                />
                <Text style={[styles.empty, { color: C.muted }]}>
                  {activeTab === 'uploads'
                    ? 'Your uploaded videos will appear here. Tap "Upload Video" to share your first video!'
                    : activeTab === 'watch-later'
                    ? 'No videos saved to Watch Later yet. Tap the bookmark icon on any video to watch it later.'
                    : 'No liked videos yet. Tap the like button on videos you enjoy!'}
                </Text>
              </View>
            ) : null}

            {displayedVideos.map((video) => (
              <View
                key={video._id}
                style={[
                  styles.videoRow,
                  { backgroundColor: C.surface, borderColor: C.border },
                  !isDark && Design.shadow.sm,
                ]}
              >
                <Pressable
                  style={styles.videoOpen}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${video.title}`}
                  onPress={() => router.push({ pathname: '/watch', params: { id: video._id } })}
                >
                  <View style={styles.thumbWrap}>
                    {video.thumbnailUrl ? (
                      <Image
                        source={{ uri: video.thumbnailUrl }}
                        style={styles.thumb}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[styles.thumbFallback, { backgroundColor: C.surfaceRaised }]}
                      />
                    )}
                    {video.duration > 0 ? (
                      <Text style={styles.duration}>{durationLabel(video.duration)}</Text>
                    ) : null}
                  </View>
                  <View style={styles.videoMeta}>
                    <Text style={[styles.videoTitle, { color: C.text }]} numberOfLines={2}>
                      {cleanTitle(video.title)}
                    </Text>
                    <Text style={[styles.muted, { color: C.muted }]}>
                      {activeTab === 'uploads'
                        ? (video.sourceType === 'cloudinary' ? 'Source: File' : `Source: Link (${video.sourceType})`)
                        : creatorLabel(video.creator)}{' '}
                      • {formatViews(video.views)} • {formatTimeAgo(video.createdAt)}
                    </Text>
                  </View>
                </Pressable>

                {activeTab === 'uploads' ? (
                  confirmVideoId === video._id ? (
                    <View style={styles.deleteActions}>
                      <Pressable
                        style={styles.confirmDelete}
                        disabled={deletingVideoId === video._id}
                        onPress={() => removeVideo(video._id)}
                      >
                        {deletingVideoId === video._id ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.deleteActionText}>Confirm</Text>
                        )}
                      </Pressable>
                      <Pressable
                        style={[styles.cancelDelete, { backgroundColor: C.surfaceRaised }]}
                        disabled={!!deletingVideoId}
                        onPress={() => setConfirmVideoId('')}
                      >
                        <Text style={[styles.deleteActionText, { color: C.text }]}>Cancel</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.deleteVideoButton}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${video.title}`}
                      onPress={() => setConfirmVideoId(video._id)}
                    >
                      <SymbolView
                        name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                        size={16}
                        tintColor={Design.color.danger}
                      />
                    </Pressable>
                  )
                ) : activeTab === 'watch-later' ? (
                  <Pressable
                    style={styles.deleteVideoButton}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${video.title} from Watch Later`}
                    onPress={() => handleRemoveWatchLater(video._id)}
                  >
                    <SymbolView
                      name={{ ios: 'bookmark.slash', android: 'bookmark_remove', web: 'bookmark_remove' }}
                      size={18}
                      tintColor={C.muted}
                    />
                  </Pressable>
                ) : (
                  <Pressable
                    style={styles.deleteVideoButton}
                    accessibilityRole="button"
                    accessibilityLabel={`Unlike ${video.title}`}
                    onPress={() => handleRemoveLiked(video._id)}
                  >
                    <SymbolView
                      name={{ ios: 'heart.slash', android: 'favorite_border', web: 'favorite_border' }}
                      size={18}
                      tintColor={C.muted}
                    />
                  </Pressable>
                )}
              </View>
            ))}

            {/* -------------------- ACCOUNT TOOLS & SHORTCUTS -------------------- */}
            <View style={[styles.utilitySection, { backgroundColor: C.surface, borderColor: C.border, borderWidth: StyleSheet.hairlineWidth }]}>
              <Pressable
                style={[styles.utilityRow, { borderBottomColor: C.border }]}
                onPress={() => router.push({ pathname: '/upload', params: { returnTo: '/main/profile' } })}
              >
                <View style={styles.utilityLeft}>
                  <SymbolView
                    name={{ ios: 'video.fill', android: 'videocam', web: 'videocam' }}
                    size={20}
                    tintColor={Design.color.accent}
                  />
                  <Text style={[styles.utilityTitle, { color: C.text }]}>Your videos</Text>
                </View>
                <View style={styles.utilityRight}>
                  <Text style={[styles.utilityCount, { color: C.muted }]}>{myVideos.length}</Text>
                  <SymbolView
                    name={{ ios: 'chevron.forward', android: 'chevron_right', web: 'chevron_right' }}
                    size={16}
                    tintColor={C.muted}
                  />
                </View>
              </Pressable>

              <Pressable
                style={[styles.utilityRow, { borderBottomColor: C.border }]}
                onPress={() => router.push('/settings')}
              >
                <View style={styles.utilityLeft}>
                  <SymbolView
                    name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }}
                    size={20}
                    tintColor={C.text}
                  />
                  <Text style={[styles.utilityTitle, { color: C.text }]}>Settings</Text>
                </View>
                <SymbolView
                  name={{ ios: 'chevron.forward', android: 'chevron_right', web: 'chevron_right' }}
                  size={16}
                  tintColor={C.muted}
                />
              </Pressable>

              <Pressable
                style={styles.utilityRow}
                onPress={async () => {
                  await logout();
                  router.replace('/main');
                }}
              >
                <View style={styles.utilityLeft}>
                  <SymbolView
                    name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
                    size={20}
                    tintColor={Design.color.danger}
                  />
                  <Text style={[styles.utilityTitle, { color: Design.color.danger }]}>Sign out</Text>
                </View>
              </Pressable>
            </View>

            {/* Account Deletion Panel */}
            {showAccountDeletion ? (
              <View
                style={[
                  styles.deleteAccountPanel,
                  { backgroundColor: isDark ? Design.color.accentSurface : '#fee2e2' },
                ]}
              >
                <Text style={styles.deleteWarning}>
                  Deleting your account permanently removes your profile, uploaded videos, and
                  cloud assets.
                </Text>
                <TextInput
                  style={[
                    styles.passwordInput,
                    {
                      backgroundColor: C.surface,
                      borderColor: C.border,
                      color: C.text,
                    },
                  ]}
                  value={accountPassword}
                  onChangeText={setAccountPassword}
                  placeholder="Enter current password"
                  placeholderTextColor="#888"
                  secureTextEntry
                  autoCapitalize="none"
                />
                <View style={styles.deleteActions}>
                  <Pressable
                    style={[styles.cancelDelete, { backgroundColor: C.surfaceRaised }]}
                    disabled={deletingAccount}
                    onPress={() => {
                      setShowAccountDeletion(false);
                      setAccountPassword('');
                    }}
                  >
                    <Text style={[styles.deleteActionText, { color: C.text }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={styles.confirmDelete}
                    disabled={deletingAccount}
                    onPress={removeAccount}
                  >
                    {deletingAccount ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.deleteActionText}>Confirm Delete</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={styles.deleteAccountRow} onPress={() => setShowAccountDeletion(true)}>
                <Text style={styles.deleteAccountLink}>Delete account</Text>
              </Pressable>
            )}
          </>
        ) : (
          /* -------------------- GUEST / SIGN-IN VIEW -------------------- */
          <View
            style={[
              styles.guest,
              { backgroundColor: C.surface, borderColor: C.border },
              !isDark && Design.shadow.sm,
            ]}
          >
            <View style={[styles.guestIconBadge, { backgroundColor: C.surfaceRaised }]}>
              <SymbolView
                name={{ ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' }}
                size={48}
                tintColor={Design.color.accent}
              />
            </View>
            <Text style={[styles.guestName, { color: C.text }]}>Enjoy your favorite videos</Text>
            <Text style={[styles.guestBio, { color: C.secondary }]}>
              Sign in to subscribe to creators, like videos, save to Watch Later, track your viewing
              history, and upload your own content.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={[styles.guestPrimaryBtn, { backgroundColor: Design.color.accent }]}
              onPress={() => router.push('/auth')}
            >
              <Text style={styles.guestPrimaryBtnText}>Sign In</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Review Creator Modal */}
      <Modal
        visible={showReviewModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowReviewModal(false)}
      >
        <SafeAreaView style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: C.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: C.border }]}>
              <Text style={[styles.modalTitle, { color: C.text }]}>
                {isOtherCreator
                  ? `Reviews for ${creatorUser?.fullName || creatorUser?.username || 'Creator'}`
                  : 'Channel Reviews'}
              </Text>
              <Pressable
                onPress={() => setShowReviewModal(false)}
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
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              {/* Summary Scorecard */}
              <View style={[styles.reviewScorecard, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[styles.scorecardBigRating, { color: Design.color.accent }]}>
                  {averageRating > 0 ? averageRating.toFixed(1) : '—'}
                </Text>
                <View style={styles.scorecardStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Text
                      key={star}
                      style={{
                        fontSize: 16,
                        color: star <= Math.round(averageRating) ? Design.color.accent : C.border,
                      }}
                    >
                      ★
                    </Text>
                  ))}
                </View>
                <Text style={[styles.scorecardSub, { color: C.muted }]}>
                  {totalReviews === 0
                    ? 'No reviews yet'
                    : totalReviews === 1
                    ? 'Based on 1 review'
                    : `Based on ${totalReviews} reviews`}
                </Text>
              </View>

              {/* Review Form for Other Creators */}
              {isOtherCreator ? (
                user ? (
                  <View style={[styles.reviewFormCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                    <Text style={[styles.formHeading, { color: C.text }]}>
                      {userReview ? 'Edit Your Review' : 'Rate & Review This Creator'}
                    </Text>

                    {/* Star Picker */}
                    <View style={styles.starPicker}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Pressable
                          key={s}
                          hitSlop={8}
                          onPress={() => setReviewRating(s)}
                          style={styles.starTouch}
                        >
                          <Text
                            style={[
                              styles.starGlyph,
                              { color: s <= reviewRating ? Design.color.accent : C.border },
                            ]}
                          >
                            ★
                          </Text>
                        </Pressable>
                      ))}
                      <Text style={[styles.ratingLabel, { color: C.secondary }]}>
                        {reviewRating === 5
                          ? 'Excellent (5/5)'
                          : reviewRating === 4
                          ? 'Great (4/5)'
                          : reviewRating === 3
                          ? 'Good (3/5)'
                          : reviewRating === 2
                          ? 'Fair (2/5)'
                          : 'Poor (1/5)'}
                      </Text>
                    </View>

                    <TextInput
                      style={[
                        styles.reviewTextInput,
                        {
                          backgroundColor: C.surfaceRaised,
                          borderColor: C.border,
                          color: C.text,
                        },
                      ]}
                      value={reviewComment}
                      onChangeText={setReviewComment}
                      placeholder="Write feedback about this creator's content (optional)..."
                      placeholderTextColor={C.muted}
                      multiline
                      maxLength={500}
                    />

                    <View style={styles.formButtonRow}>
                      {userReview ? (
                        <Pressable
                          style={[styles.deleteReviewBtn, { borderColor: Design.color.danger }]}
                          disabled={deletingReview || submittingReview}
                          onPress={handleDeleteReview}
                        >
                          {deletingReview ? (
                            <ActivityIndicator size="small" color={Design.color.danger} />
                          ) : (
                            <Text style={[styles.deleteReviewBtnText, { color: Design.color.danger }]}>
                              Delete
                            </Text>
                          )}
                        </Pressable>
                      ) : null}

                      <Pressable
                        style={[
                          styles.submitReviewBtn,
                          {
                            backgroundColor: Design.color.accent,
                            flex: userReview ? 1 : undefined,
                            width: userReview ? undefined : '100%',
                          },
                        ]}
                        disabled={submittingReview || deletingReview}
                        onPress={handleSubmitReview}
                      >
                        {submittingReview ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.submitReviewBtnText}>
                            {userReview ? 'Update Review' : 'Submit Review'}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    style={[styles.reviewSignInPrompt, { backgroundColor: C.surface, borderColor: C.border }]}
                    onPress={() => showSignInModal('review creators')}
                  >
                    <Text style={[styles.reviewSignInPromptText, { color: Design.color.accent }]}>
                      Sign in to rate and review this creator
                    </Text>
                  </Pressable>
                )
              ) : null}

              {/* Reviews List */}
              <Text style={[styles.reviewsListHeading, { color: C.text }]}>
                All Reviews ({reviews.length})
              </Text>

              {reviews.length === 0 ? (
                <View style={styles.noReviewsBox}>
                  <Text style={[styles.noReviewsText, { color: C.muted }]}>
                    No reviews yet. Be the first to share your experience!
                  </Text>
                </View>
              ) : (
                reviews.map((r) => {
                  const reviewerName = r.reviewer?.fullName || r.reviewer?.username || 'User';
                  const initials = reviewerName.charAt(0).toUpperCase();
                  const isOwnReview = Boolean(user && r.reviewer?._id === user.id);
                  return (
                    <View
                      key={r._id}
                      style={[
                        styles.reviewItemCard,
                        { backgroundColor: C.surface, borderColor: C.border },
                        isOwnReview && { borderColor: Design.color.accent },
                      ]}
                    >
                      <View style={styles.reviewItemHeader}>
                        {r.reviewer?.avatar ? (
                          <Image
                            source={{ uri: r.reviewer.avatar }}
                            style={styles.reviewerAvatar}
                            contentFit="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.reviewerAvatarFallback,
                              { backgroundColor: isDark ? Design.color.accentSurface : '#fee2e2' },
                            ]}
                          >
                            <Text style={[styles.reviewerInitial, { color: Design.color.accent }]}>
                              {initials}
                            </Text>
                          </View>
                        )}
                        <View style={styles.reviewerInfo}>
                          <View style={styles.reviewerNameRow}>
                            <Text style={[styles.reviewerName, { color: C.text }]}>
                              {reviewerName}
                            </Text>
                            {isOwnReview ? (
                              <View style={[styles.ownReviewBadge, { backgroundColor: Design.color.accentSurface }]}>
                                <Text style={[styles.ownReviewBadgeText, { color: Design.color.accent }]}>
                                  You
                                </Text>
                              </View>
                            ) : null}
                          </View>
                          <View style={styles.reviewStarRow}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Text
                                key={s}
                                style={{
                                  fontSize: 12,
                                  color: s <= r.rating ? Design.color.accent : C.border,
                                }}
                              >
                                ★
                              </Text>
                            ))}
                            <Text style={[styles.reviewDate, { color: C.muted }]}>
                              • {formatTimeAgo(r.createdAt)}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {r.comment ? (
                        <Text style={[styles.reviewCommentBody, { color: C.secondary }]}>
                          {r.comment}
                        </Text>
                      ) : null}
                    </View>
                  );
                })
              )}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
  },
  header: {
    minHeight: 54,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyebrow: {
    color: Design.color.accent,
    letterSpacing: 1.5,
    fontSize: 10,
    fontWeight: '800',
  },
  heading: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  channelBanner: {
    width: '100%',
    height: 90,
    borderRadius: Design.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  bannerDecor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerBrand: {
    color: Design.color.accent,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  identity: {
    alignItems: 'center',
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Design.radius.lg,
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarFallback: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: 32,
    fontWeight: '800',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 12,
    textAlign: 'center',
  },
  username: {
    fontSize: 13,
    marginTop: 2,
  },
  email: {
    fontSize: 12,
    marginTop: 2,
  },
  bio: {
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    maxWidth: 340,
    fontSize: 13,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Design.radius.sm,
    width: '100%',
    maxWidth: 320,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  divider: {
    height: 24,
    width: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 14,
  },
  primary: {
    flex: 1,
    height: 42,
    borderRadius: Design.radius.pill,
    backgroundColor: Design.color.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  secondary: {
    flex: 1,
    height: 42,
    borderRadius: Design.radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontWeight: '700',
    fontSize: 13,
  },
  logout: {
    color: Design.color.danger,
    paddingTop: 14,
    fontSize: 13,
    fontWeight: '600',
  },
  channelActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    width: '100%',
    maxWidth: 320,
  },
  channelSubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 20,
    height: 42,
    borderRadius: Design.radius.pill,
  },
  channelSubBtnInactive: {
    backgroundColor: Design.color.accent,
  },
  channelSubBtnActive: {
    backgroundColor: 'rgba(128,128,128,0.18)',
  },
  channelSubBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  channelReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 42,
    borderRadius: Design.radius.pill,
  },
  channelReviewBtnText: {
    fontSize: 13,
    fontWeight: '700',
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
  modalScroll: {
    padding: 16,
    paddingBottom: 40,
  },
  reviewScorecard: {
    alignItems: 'center',
    padding: 16,
    borderRadius: Design.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  scorecardBigRating: {
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 42,
  },
  scorecardStars: {
    flexDirection: 'row',
    gap: 3,
    marginVertical: 4,
  },
  scorecardSub: {
    fontSize: 12,
    fontWeight: '500',
  },
  reviewFormCard: {
    padding: 14,
    borderRadius: Design.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 20,
  },
  formHeading: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  starPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  starTouch: {
    padding: 2,
  },
  starGlyph: {
    fontSize: 26,
  },
  ratingLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  reviewTextInput: {
    minHeight: 70,
    borderRadius: Design.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    fontSize: 14,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  formButtonRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  submitReviewBtn: {
    height: 40,
    borderRadius: Design.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  submitReviewBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteReviewBtn: {
    height: 40,
    borderRadius: Design.radius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  deleteReviewBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  reviewSignInPrompt: {
    padding: 14,
    borderRadius: Design.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    marginBottom: 16,
  },
  reviewSignInPromptText: {
    fontSize: 13,
    fontWeight: '700',
  },
  reviewsListHeading: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  noReviewsBox: {
    padding: 24,
    alignItems: 'center',
  },
  noReviewsText: {
    fontSize: 13,
    textAlign: 'center',
  },
  reviewItemCard: {
    padding: 12,
    borderRadius: Design.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  reviewItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  reviewerAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewerInitial: {
    fontSize: 14,
    fontWeight: '700',
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: '700',
  },
  ownReviewBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Design.radius.pill,
  },
  ownReviewBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  reviewStarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  reviewDate: {
    fontSize: 11,
    marginLeft: 4,
  },
  reviewCommentBody: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  deleteAccountLink: {
    color: Design.color.danger,
    fontWeight: '600',
    paddingTop: 10,
    fontSize: 12,
  },
  deleteAccountPanel: {
    width: '100%',
    padding: 14,
    borderRadius: Design.radius.md,
    gap: 10,
    marginTop: 12,
  },
  deleteWarning: {
    color: Design.color.danger,
    fontSize: 12,
    lineHeight: 17,
  },
  passwordInput: {
    height: 42,
    borderWidth: 1,
    borderRadius: Design.radius.sm,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  confirmDelete: {
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#b91c1c',
    borderRadius: Design.radius.pill,
  },
  cancelDelete: {
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: Design.radius.pill,
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  historySection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  clearLink: {
    fontSize: 12,
    fontWeight: '700',
  },
  historyList: {
    gap: 12,
  },
  historyCard: {
    width: 140,
    position: 'relative',
  },
  historyThumbWrapper: {
    width: 140,
    aspectRatio: 16 / 9,
    borderRadius: Design.radius.sm,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  historyThumb: {
    width: '100%',
    height: '100%',
  },
  historyThumbFallback: {
    flex: 1,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 3,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  durationText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  historyCardMeta: {
    marginTop: 5,
    gap: 2,
  },
  historyCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 15,
  },
  historyCardCreator: {
    fontSize: 10,
  },
  historyRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  libraryTabsContainer: {
    marginBottom: 14,
  },
  tabBar: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: Design.radius.pill,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Design.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  tabButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    fontWeight: '800',
  },
  videoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    alignItems: 'center',
    padding: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Design.radius.md,
  },
  videoOpen: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  thumbWrap: {
    width: 120,
    aspectRatio: 16 / 9,
    borderRadius: Design.radius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  thumbFallback: {
    flex: 1,
  },
  duration: {
    position: 'absolute',
    right: 4,
    bottom: 3,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.8)',
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  videoMeta: {
    flex: 1,
    gap: 4,
  },
  videoTitle: {
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 17,
  },
  muted: {
    fontSize: 11,
  },
  deleteVideoButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    margin: 24,
  },
  state: {
    padding: 18,
    alignItems: 'center',
    gap: 10,
  },
  error: {
    textAlign: 'center',
  },
  retry: {
    fontWeight: '700',
    padding: 8,
  },
  empty: {
    textAlign: 'center',
    padding: 30,
    lineHeight: 20,
    fontSize: 13,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
  },
  guest: {
    alignItems: 'center',
    padding: 32,
    borderRadius: Design.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 20,
  },
  guestIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  guestName: {
    fontSize: 18,
    fontWeight: '800',
  },
  guestBio: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    maxWidth: 280,
  },
  guestPrimaryBtn: {
    marginTop: 18,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: Design.radius.pill,
  },
  guestPrimaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Design.color.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  accountHeaderCard: {
    padding: 16,
    borderRadius: Design.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
  accountHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  accountAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarButtonWrap: {
    position: 'relative',
    width: 64,
    height: 64,
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountAvatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountAvatarInitial: {
    fontSize: 26,
    fontWeight: '800',
  },
  accountInfo: {
    flex: 1,
    gap: 2,
  },
  accountName: {
    fontSize: 18,
    fontWeight: '800',
  },
  accountHandle: {
    fontSize: 13,
  },
  accountMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  accountBio: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },
  actionChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Design.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  historyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressBarBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressBarFill: {
    width: '65%',
    height: '100%',
  },
  emptyHistoryCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Design.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  emptyHistoryTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyHistorySubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  playlistsHubSection: {
    marginBottom: 20,
  },
  playlistsCountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  playlistsCardsList: {
    gap: 12,
  },
  playlistHubCard: {
    width: 170,
    borderRadius: Design.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  playlistThumbContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    backgroundColor: '#000',
  },
  playlistThumbImage: {
    width: '100%',
    height: '100%',
  },
  playlistThumbFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistThumbBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playlistThumbBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  playlistCardContent: {
    padding: 10,
    gap: 3,
  },
  playlistCardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  playlistCardMeta: {
    fontSize: 11,
  },
  playlistPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 6,
    paddingVertical: 5,
    borderRadius: Design.radius.pill,
  },
  playlistPlayBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  activeTabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  activeTabTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  playAllPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Design.radius.pill,
  },
  playAllPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  utilitySection: {
    borderRadius: Design.radius.md,
    marginTop: 14,
    marginBottom: 8,
    overflow: 'hidden',
  },
  utilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  utilityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  utilityRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  utilityTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  utilityCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  deleteAccountRow: {
    alignItems: 'center',
    paddingVertical: 14,
  },
});
