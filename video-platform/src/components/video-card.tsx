import { useState } from 'react';
import { Modal, Platform, Share, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from '@/components/theme-native';
import { Design } from '@/constants/design';
import { useAuth } from '@/contexts/auth-context';
import { useSubscription } from '@/contexts/subscription-context';
import { useThemeMode } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import { setWatchLater } from '@/lib/video-service';
import {
  cleanDescriptionPreview,
  cleanTitle,
  creatorAvatarUrl,
  creatorInitials,
  creatorLabel,
  durationLabel,
  formatTimeAgo,
  formatViews,
  type VideoRecord,
} from '@/types/video';

type VideoCardProps = {
  video: VideoRecord;
  onPress: () => void;
  onOverflowPress?: (video: VideoRecord) => void;
};

export function VideoCard({ video, onPress, onOverflowPress }: VideoCardProps) {
  const { mode } = useThemeMode();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { showSignInModal } = useSubscription();
  const [imageError, setImageError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const isDark = mode === 'dark';
  const C = isDark ? Design.color : Design.light;

  const title = cleanTitle(video.title);
  const description = cleanDescriptionPreview(video.description);
  const creator = creatorLabel(video.creator);
  const avatarUrl = creatorAvatarUrl(video.creator);
  const initials = creatorInitials(video.creator);
  const duration = durationLabel(video.duration);
  const views = formatViews(video.views);
  const timeAgo = formatTimeAgo(video.createdAt);

  const creatorId =
    typeof video.creator === 'object' && video.creator?._id
      ? video.creator._id
      : typeof video.creator === 'string'
      ? video.creator
      : null;

  const handleCreatorPress = (e?: any) => {
    e?.stopPropagation?.();
    if (creatorId) {
      router.push({ pathname: '/main/profile', params: { userId: creatorId } });
    }
  };

  const handleShare = async () => {
    setShowMenu(false);
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
        title,
        message: `Watch "${title}" on Streanub:\n${watchUrl}`,
        url: watchUrl,
      });
    } catch {
      showToast('Could not share video.', 'error');
    }
  };

  const handleSave = async () => {
    setShowMenu(false);
    if (!user) {
      showSignInModal('save videos to Watch Later');
      return;
    }
    try {
      await setWatchLater(video._id, true);
      showToast('Saved to Watch Later');
    } catch {
      showToast('Could not save video', 'error');
    }
  };

  const handleReport = () => {
    setShowMenu(false);
    showToast('Thank you for reporting this video');
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          isDark ? styles.cardDark : styles.cardLight,
          pressed && styles.pressed,
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Play ${title} by ${creator}`}
      >
        {/* Thumbnail Container (16:9 Aspect Ratio) */}
        <View style={styles.thumbnailContainer}>
          {video.thumbnailUrl && !imageError ? (
            <Image
              source={{ uri: video.thumbnailUrl }}
              style={styles.thumbnail}
              contentFit="cover"
              transition={200}
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={[styles.fallbackThumbnail, isDark ? styles.fallbackDark : styles.fallbackLight]}>
              <View style={styles.fallbackIconBadge}>
                <SymbolView
                  name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
                  size={28}
                  tintColor={Design.color.accent}
                />
              </View>
              <Text style={styles.fallbackBrand}>STREANUB</Text>
              {video.category ? (
                <Text style={styles.fallbackCategory}>{video.category.toUpperCase()}</Text>
              ) : null}
            </View>
          )}

          {/* Provider badge if external */}
          {video.sourceType && video.sourceType !== 'cloudinary' ? (
            <View
              style={[
                styles.providerBadge,
                video.sourceType === 'youtube'
                  ? styles.ytBadge
                  : video.sourceType === 'vimeo'
                  ? styles.vimeoBadge
                  : styles.twitchBadge,
              ]}
            >
              <Text style={styles.providerBadgeText}>{video.sourceType.toUpperCase()}</Text>
            </View>
          ) : null}

          {/* Duration Badge */}
          {duration ? (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{duration}</Text>
            </View>
          ) : null}
        </View>

        {/* Video Information Row */}
        <View style={styles.infoRow}>
          {/* Creator Profile Image / Avatar */}
          <Pressable
            style={styles.avatarWrap}
            onPress={handleCreatorPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`View ${creator}'s channel`}
          >
            {avatarUrl && !avatarError ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatar}
                contentFit="cover"
                transition={150}
                onError={() => setAvatarError(true)}
              />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: isDark ? '#232b36' : '#dbe1ea' }]}>
                <Text style={[styles.avatarInitials, { color: C.text }]}>{initials}</Text>
              </View>
            )}
          </Pressable>

          {/* Video Metadata Column */}
          <View style={styles.detailsColumn}>
            {/* Video Title: max 2 lines with ellipsis */}
            <Text
              style={[styles.title, isDark ? styles.titleDark : styles.titleLight]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {title}
            </Text>

            {/* Channel info & metadata line */}
            <View style={styles.metadataRow}>
              <Pressable onPress={handleCreatorPress} hitSlop={4}>
                <Text style={[styles.channelName, { color: C.secondary }]} numberOfLines={1}>
                  {creator}
                </Text>
              </Pressable>
              {views ? (
                <>
                  <Text style={[styles.dot, { color: C.muted }]}>•</Text>
                  <Text style={[styles.metaText, { color: C.muted }]}>{views}</Text>
                </>
              ) : null}
              {timeAgo ? (
                <>
                  <Text style={[styles.dot, { color: C.muted }]}>•</Text>
                  <Text style={[styles.metaText, { color: C.muted }]}>{timeAgo}</Text>
                </>
              ) : null}
            </View>

            {/* Video description preview cleanly truncated */}
            {description ? (
              <Text
                style={[styles.description, { color: C.muted }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {description}
              </Text>
            ) : null}

            {/* Category chip preview */}
            {video.category ? (
              <View style={styles.categoryPillWrap}>
                <View
                  style={[
                    styles.categoryPill,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                      borderColor: C.border,
                    },
                  ]}
                >
                  <Text style={[styles.categoryPillText, { color: C.muted }]}>{video.category}</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Overflow Menu (Three-dot button) */}
          <Pressable
            style={({ pressed }) => [
              styles.overflowBtn,
              pressed && (isDark ? styles.overflowBtnPressedDark : styles.overflowBtnPressedLight),
            ]}
            onPress={(e) => {
              e?.stopPropagation?.();
              if (onOverflowPress) {
                onOverflowPress(video);
              } else {
                setShowMenu(true);
              }
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={`Options for ${title}`}
          >
            <SymbolView
              name={{ ios: 'ellipsis', android: 'more_vert', web: 'more_vert' }}
              size={18}
              tintColor={C.muted}
            />
          </Pressable>
        </View>
      </Pressable>

      {/* Overflow Menu Modal */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
          <View
            style={[
              styles.modalSheet,
              isDark ? styles.modalSheetDark : styles.modalSheetLight,
            ]}
          >
            {/* Header info */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderInfo}>
                <Text
                  style={[styles.modalTitle, { color: C.text }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {title}
                </Text>
                <Text style={[styles.modalCreator, { color: C.muted }]}>{creator}</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: C.border }]} />

            {/* Action Items */}
            <Pressable
              style={({ pressed }) => [
                styles.menuItem,
                pressed && (isDark ? styles.menuItemPressedDark : styles.menuItemPressedLight),
              ]}
              onPress={handleSave}
            >
              <SymbolView
                name={{ ios: 'bookmark', android: 'bookmark_border', web: 'bookmark' }}
                size={20}
                tintColor={C.text}
              />
              <Text style={[styles.menuItemText, { color: C.text }]}>Save to Watch Later</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.menuItem,
                pressed && (isDark ? styles.menuItemPressedDark : styles.menuItemPressedLight),
              ]}
              onPress={handleShare}
            >
              <SymbolView
                name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
                size={20}
                tintColor={C.text}
              />
              <Text style={[styles.menuItemText, { color: C.text }]}>Share video</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.menuItem,
                pressed && (isDark ? styles.menuItemPressedDark : styles.menuItemPressedLight),
              ]}
              onPress={handleReport}
            >
              <SymbolView
                name={{ ios: 'flag', android: 'flag', web: 'flag' }}
                size={20}
                tintColor={Design.color.danger}
              />
              <Text style={[styles.menuItemText, { color: Design.color.danger }]}>Report video</Text>
            </Pressable>

            <View style={[styles.divider, { backgroundColor: C.border }]} />

            <Pressable
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && (isDark ? styles.menuItemPressedDark : styles.menuItemPressedLight),
              ]}
              onPress={() => setShowMenu(false)}
            >
              <Text style={[styles.cancelBtnText, { color: C.muted }]}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Design.radius.lg,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
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
  pressed: {
    opacity: 0.88,
  },
  thumbnailContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    backgroundColor: '#0c0e12',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  fallbackThumbnail: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  fallbackDark: {
    backgroundColor: '#131821',
  },
  fallbackLight: {
    backgroundColor: '#f1f5f9',
  },
  fallbackIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(239, 70, 87, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 70, 87, 0.3)',
  },
  fallbackBrand: {
    color: '#828e9e',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
  fallbackCategory: {
    color: Design.color.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  providerBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  ytBadge: {
    backgroundColor: '#cc0000e6',
  },
  vimeoBadge: {
    backgroundColor: '#1ab7eae6',
  },
  twitchBadge: {
    backgroundColor: '#9146ffe6',
  },
  providerBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  durationBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    borderRadius: 5,
  },
  durationText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
  },
  avatarWrap: {
    paddingTop: 2,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#202632',
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  detailsColumn: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  titleDark: {
    color: Design.color.text,
  },
  titleLight: {
    color: Design.light.text,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  channelName: {
    fontSize: 12,
    fontWeight: '600',
  },
  dot: {
    fontSize: 12,
  },
  metaText: {
    fontSize: 12,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  categoryPillWrap: {
    flexDirection: 'row',
    marginTop: 4,
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  overflowBtn: {
    padding: 6,
    borderRadius: Design.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  overflowBtnPressedDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  overflowBtnPressedLight: {
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    paddingBottom: 28,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  modalSheetDark: {
    backgroundColor: Design.color.surface,
    borderColor: Design.color.border,
    borderTopWidth: 1,
  },
  modalSheetLight: {
    backgroundColor: Design.light.surface,
    borderColor: Design.light.border,
    borderTopWidth: 1,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
  },
  modalHeaderInfo: {
    flex: 1,
    gap: 3,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalCreator: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: Design.radius.sm,
  },
  menuItemPressedDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  menuItemPressedLight: {
    backgroundColor: 'rgba(15, 23, 42, 0.05)',
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
