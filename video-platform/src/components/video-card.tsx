import { useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { ActionSheet, Avatar, type ActionSheetOption } from '@/components/ui';
import { Design } from '@/constants/design';
import { useAuth } from '@/contexts/auth-context';
import { useSubscription } from '@/contexts/subscription-context';
import { useDesignTheme } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import { reportContent, setWatchLater, type ReportReason } from '@/lib/video-service';
import {
  cleanDescriptionPreview,
  cleanTitle,
  creatorAvatarUrl,
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

const REPORT_REASONS: { id: ReportReason; label: string }[] = [
  { id: 'inappropriate_content', label: 'Inappropriate content' },
  { id: 'spam', label: 'Spam or misleading' },
  { id: 'harassment', label: 'Harassment or hate' },
  { id: 'copyright', label: 'Copyright infringement' },
  { id: 'misinformation', label: 'Misinformation' },
  { id: 'violence', label: 'Violent or harmful content' },
];

export function VideoCard({ video, onPress, onOverflowPress }: VideoCardProps) {
  const { colors, isDark } = useDesignTheme();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { showSignInModal } = useSubscription();
  const [imageError, setImageError] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);

  const title = cleanTitle(video.title);
  const description = cleanDescriptionPreview(video.description);
  const creator = creatorLabel(video.creator);
  const avatarUrl = creatorAvatarUrl(video.creator);
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

  const handleStartReport = () => {
    if (!user) {
      showSignInModal('report this video');
      return;
    }
    setShowReportSheet(true);
  };

  const handleSubmitReport = async (reason: ReportReason) => {
    try {
      await reportContent({
        targetType: 'video',
        targetId: video._id,
        reason,
      });
      showToast('Report submitted. Thank you for keeping Streanub safe.');
    } catch (cause) {
      showToast(
        cause instanceof Error ? cause.message : 'Could not submit report right now.',
        'error'
      );
    }
  };

  const menuOptions: ActionSheetOption[] = [
    {
      id: 'watch-later',
      label: 'Save to Watch Later',
      icon: { ios: 'bookmark', android: 'bookmark_border', web: 'bookmark' },
      onPress: () => void handleSave(),
    },
    ...(creatorId
      ? [
          {
            id: 'channel',
            label: `Go to ${creator}`,
            icon: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
            onPress: () => handleCreatorPress(),
          },
        ]
      : []),
    {
      id: 'share',
      label: 'Share video',
      icon: { ios: 'square.and.arrow.up', android: 'share', web: 'share' },
      onPress: () => void handleShare(),
    },
    {
      id: 'report',
      label: 'Report video',
      icon: { ios: 'flag', android: 'flag', web: 'flag' },
      destructive: true,
      onPress: handleStartReport,
    },
  ];

  const reportOptions: ActionSheetOption[] = REPORT_REASONS.map((item) => ({
    id: item.id,
    label: item.label,
    icon: { ios: 'flag', android: 'flag', web: 'flag' },
    destructive: true,
    onPress: () => void handleSubmitReport(item.id),
  }));

  return (
    <>
      <Pressable
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          !isDark && Design.shadow.sm,
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
              transition={180}
              cachePolicy="memory-disk"
              onError={() => setImageError(true)}
            />
          ) : (
            <View
              style={[
                styles.fallbackThumbnail,
                { backgroundColor: isDark ? '#131821' : '#f1f5f9' },
              ]}
            >
              <View style={styles.fallbackIconBadge}>
                <SymbolView
                  name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
                  size={28}
                  tintColor={colors.accent}
                />
              </View>
              <Text style={styles.fallbackBrand}>STREANUB</Text>
              {video.category ? (
                <Text style={[styles.fallbackCategory, { color: colors.accent }]}>
                  {video.category.toUpperCase()}
                </Text>
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
          <Pressable
            style={styles.avatarWrap}
            onPress={handleCreatorPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`View ${creator}'s channel`}
          >
            <Avatar uri={avatarUrl} name={creator} size={38} />
          </Pressable>

          <View style={styles.detailsColumn}>
            <Text
              style={[styles.title, { color: colors.text }]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {title}
            </Text>

            <View style={styles.metadataRow}>
              <Pressable onPress={handleCreatorPress} hitSlop={4}>
                <Text style={[styles.channelName, { color: colors.secondary }]} numberOfLines={1}>
                  {creator}
                </Text>
              </Pressable>
              {views ? (
                <>
                  <Text style={[styles.dot, { color: colors.muted }]}>•</Text>
                  <Text style={[styles.metaText, { color: colors.muted }]}>{views}</Text>
                </>
              ) : null}
              {timeAgo ? (
                <>
                  <Text style={[styles.dot, { color: colors.muted }]}>•</Text>
                  <Text style={[styles.metaText, { color: colors.muted }]}>{timeAgo}</Text>
                </>
              ) : null}
            </View>

            {description ? (
              <Text
                style={[styles.description, { color: colors.muted }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {description}
              </Text>
            ) : null}

            {video.category ? (
              <View style={styles.categoryPillWrap}>
                <View
                  style={[
                    styles.categoryPill,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.categoryPillText, { color: colors.muted }]}>
                    {video.category}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.overflowBtn,
              pressed && {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
              },
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
              tintColor={colors.muted}
            />
          </Pressable>
        </View>
      </Pressable>

      <ActionSheet
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        title={title}
        subtitle={creator}
        options={menuOptions}
      />

      <ActionSheet
        visible={showReportSheet}
        onClose={() => setShowReportSheet(false)}
        title="Report video"
        subtitle="Select the reason that best describes the issue"
        options={reportOptions}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Design.radius.lg,
    overflow: 'hidden',
    marginBottom: 18,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.9,
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
  detailsColumn: {
    flex: 1,
    gap: 3,
  },
  title: {
    ...Design.typography.subheading,
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
});
