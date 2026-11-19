import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StatusBar,
  Text,
  View,
} from '@/components/theme-native';
import { Design } from '@/constants/design';
import { useAuth } from '@/contexts/auth-context';
import { useNotifications } from '@/contexts/notification-context';
import { useThemeMode } from '@/contexts/theme-context';
import {
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRecord,
  type NotificationType,
  type NotificationVideoInfo,
} from '@/lib/notification-service';
import { formatTimeAgo } from '@/types/video';

const PAGE_SIZE = 20;

type FilterMode = 'all' | 'unread' | 'mentions';

const TYPE_ICONS: Record<NotificationType, any> = {
  new_video: { ios: 'play.rectangle.fill', android: 'play_circle', web: 'play_circle' },
  new_comment: { ios: 'bubble.left.fill', android: 'chat', web: 'chat' },
  new_subscriber: { ios: 'person.badge.plus', android: 'person_add', web: 'person_add' },
  comment_reply: { ios: 'arrowshape.turn.up.left.fill', android: 'reply', web: 'reply' },
};

type GroupedSection = {
  title: string;
  data: NotificationRecord[];
};

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { mode } = useThemeMode();
  const { unreadCount, setUnreadCount, refreshUnreadCount } = useNotifications();
  const isDark = mode === 'dark';
  const C = isDark ? Design.color : Design.light;

  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const [selectedItem, setSelectedItem] = useState<NotificationRecord | null>(null);

  // Avoid Date.now() during render for react-compiler purity
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());

  const pageRef = useRef(1);
  const hasMoreRef = useRef(false);
  const inFlightRef = useRef(false);
  const pendingReadRef = useRef(new Set<string>());
  const markingAllRef = useRef(false);

  const load = useCallback(
    async (targetPage: number, loadMode: 'initial' | 'refresh' | 'more') => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      if (loadMode === 'refresh') setRefreshing(true);
      else if (loadMode === 'more') setLoadingMore(true);
      else setLoading(true);

      try {
        const result = await fetchNotifications(targetPage, PAGE_SIZE);
        pageRef.current = result.page;
        hasMoreRef.current = result.hasMore;
        setItems((prev) => {
          if (targetPage === 1) return result.notifications;
          const seen = new Set(prev.map((n) => n._id));
          return [...prev, ...result.notifications.filter((n) => !seen.has(n._id))];
        });
        setError('');
        if (targetPage === 1) {
          void refreshUnreadCount();
          setCurrentTimestamp(Date.now());
        }
      } catch (cause) {
        if (targetPage === 1 && loadMode !== 'refresh') setItems([]);
        setError(cause instanceof Error ? cause.message : 'Could not load notifications.');
      } finally {
        inFlightRef.current = false;
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [refreshUnreadCount]
  );

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      setCurrentTimestamp(Date.now());
      void load(1, 'initial');
    }, [user?.id, load])
  );

  const onRefresh = useCallback(() => {
    setCurrentTimestamp(Date.now());
    void load(1, 'refresh');
  }, [load]);

  const onEndReached = useCallback(() => {
    if (!hasMoreRef.current || inFlightRef.current || error) return;
    void load(pageRef.current + 1, 'more');
  }, [load, error]);

  const getVideoDetails = (item: NotificationRecord): NotificationVideoInfo | null => {
    if (typeof item.video === 'object' && item.video) {
      return item.video;
    }
    return null;
  };

  const getVideoId = (item: NotificationRecord): string | undefined => {
    if (item.link?.params?.id) return item.link.params.id;
    if (typeof item.video === 'object' && item.video?._id) return item.video._id;
    if (typeof item.video === 'string') return item.video;
    return undefined;
  };

  const getActorId = (item: NotificationRecord): string | undefined => {
    if (item.link?.params?.userId) return item.link.params.userId;
    if (typeof item.actor === 'object' && item.actor?._id) return item.actor._id;
    if (typeof item.actor === 'string') return item.actor;
    return undefined;
  };

  const onPressItem = useCallback(
    async (item: NotificationRecord) => {
      // 1. Mark as read optimistically if unread
      if (!item.isRead && !pendingReadRef.current.has(item._id)) {
        pendingReadRef.current.add(item._id);
        setActionError('');
        setItems((prev) => prev.map((n) => (n._id === item._id ? { ...n, isRead: true } : n)));
        markNotificationRead(item._id)
          .then((newCount) => setUnreadCount(newCount))
          .catch((cause) => {
            setItems((prev) => prev.map((n) => (n._id === item._id ? { ...n, isRead: false } : n)));
            setActionError(cause instanceof Error ? cause.message : 'Could not mark as read.');
          })
          .finally(() => {
            pendingReadRef.current.delete(item._id);
          });
      }

      const videoId = getVideoId(item);
      const commentId = item.link?.params?.commentId || item.comment;
      const actorId = getActorId(item);

      if (item.type === 'new_video') {
        if (!videoId) {
          setActionError('The video referenced in this notification is no longer available.');
          return;
        }
        router.push({
          pathname: '/watch',
          params: { id: String(videoId) },
        });
        return;
      }

      if (item.type === 'new_comment' || item.type === 'comment_reply') {
        if (!videoId) {
          setActionError('The video for this comment is no longer available.');
          return;
        }
        router.push({
          pathname: '/watch',
          params: {
            id: String(videoId),
            ...(commentId ? { commentId: String(commentId) } : {}),
          },
        });
        return;
      }

      if (item.type === 'new_subscriber') {
        if (!actorId) {
          setActionError('The creator profile for this subscriber is no longer available.');
          return;
        }
        router.push({
          pathname: '/main/profile',
          params: { userId: String(actorId) },
        });
        return;
      }

      if (item.link?.screen === 'watch' && videoId) {
        router.push({
          pathname: '/watch',
          params: {
            id: String(videoId),
            ...(commentId ? { commentId: String(commentId) } : {}),
          },
        });
        return;
      }

      if (item.link?.screen === 'profile' && actorId) {
        router.push({
          pathname: '/main/profile',
          params: { userId: String(actorId) },
        });
      }
    },
    [setUnreadCount]
  );

  const onMarkAll = useCallback(async () => {
    if (markingAllRef.current) return;
    markingAllRef.current = true;
    setMarkingAll(true);
    setActionError('');
    try {
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not mark all as read.');
    } finally {
      markingAllRef.current = false;
      setMarkingAll(false);
    }
  }, [setUnreadCount]);

  const onDeleteNotification = useCallback(
    async (item: NotificationRecord) => {
      setSelectedItem(null);
      setActionError('');

      // Optimistic delete
      const previousItems = items;
      setItems((prev) => prev.filter((n) => n._id !== item._id));

      try {
        const remainingUnread = await deleteNotification(item._id);
        setUnreadCount(remainingUnread);
      } catch (cause) {
        setItems(previousItems);
        setActionError(cause instanceof Error ? cause.message : 'Could not delete notification.');
      }
    },
    [items, setUnreadCount]
  );

  const onToggleReadStatus = useCallback(
    async (item: NotificationRecord) => {
      setSelectedItem(null);
      if (!item.isRead) {
        // Mark as read
        setItems((prev) => prev.map((n) => (n._id === item._id ? { ...n, isRead: true } : n)));
        try {
          const count = await markNotificationRead(item._id);
          setUnreadCount(count);
        } catch {
          setItems((prev) => prev.map((n) => (n._id === item._id ? { ...n, isRead: false } : n)));
        }
      }
    },
    [setUnreadCount]
  );

  // Filtered and grouped items
  const filteredItems = useMemo(() => {
    if (filter === 'unread') {
      return items.filter((item) => !item.isRead);
    }
    if (filter === 'mentions') {
      return items.filter((item) => item.type === 'new_comment' || item.type === 'comment_reply');
    }
    return items;
  }, [items, filter]);

  const sections = useMemo<GroupedSection[]>(() => {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * oneDayMs;

    const todayItems: NotificationRecord[] = [];
    const thisWeekItems: NotificationRecord[] = [];
    const earlierItems: NotificationRecord[] = [];

    for (const item of filteredItems) {
      const itemTime = new Date(item.createdAt).getTime();
      const diff = currentTimestamp - itemTime;

      if (diff <= oneDayMs) {
        todayItems.push(item);
      } else if (diff <= sevenDaysMs) {
        thisWeekItems.push(item);
      } else {
        earlierItems.push(item);
      }
    }

    const result: GroupedSection[] = [];
    if (todayItems.length > 0) result.push({ title: 'Today', data: todayItems });
    if (thisWeekItems.length > 0) result.push({ title: 'This week', data: thisWeekItems });
    if (earlierItems.length > 0) result.push({ title: 'Earlier', data: earlierItems });

    return result;
  }, [filteredItems, currentTimestamp]);

  // Flattened data array with section headers for smooth FlatList rendering
  type ListItem =
    | { type: 'header'; title: string; id: string }
    | { type: 'item'; record: NotificationRecord; id: string };

  const flatListData = useMemo<ListItem[]>(() => {
    const list: ListItem[] = [];
    for (const section of sections) {
      list.push({ type: 'header', title: section.title, id: `header-${section.title}` });
      for (const record of section.data) {
        list.push({ type: 'item', record, id: record._id });
      }
    }
    return list;
  }, [sections]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/main'));

  const header = (
    <View style={[styles.header, { borderBottomColor: C.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={8}
        onPress={goBack}
        style={styles.iconBtn}
      >
        <SymbolView
          name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
          size={22}
          tintColor={C.text}
        />
      </Pressable>

      <View style={styles.titleGroup}>
        <Text style={[styles.title, { color: C.text }]}>Notifications</Text>
        {user && unreadCount > 0 ? (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.headerRight}>
        {user && unreadCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mark all notifications as read"
            disabled={markingAll}
            onPress={onMarkAll}
            hitSlop={8}
            style={styles.markAllBtn}
          >
            {markingAll ? (
              <ActivityIndicator size="small" color={Design.color.accent} />
            ) : (
              <Text style={[styles.markAllText, { color: Design.color.accent }]}>Mark read</Text>
            )}
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          hitSlop={8}
          onPress={() => router.push('/settings')}
          style={styles.iconBtn}
        >
          <SymbolView
            name={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
            size={20}
            tintColor={C.muted}
          />
        </Pressable>
      </View>
    </View>
  );

  const filterChips = (
    <View style={[styles.filterBar, { borderBottomColor: C.border }]}>
      {(['all', 'unread', 'mentions'] as const).map((modeKey) => {
        const isSelected = filter === modeKey;
        const label =
          modeKey === 'all'
            ? 'All'
            : modeKey === 'unread'
              ? `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`
              : 'Mentions';

        return (
          <Pressable
            key={modeKey}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => setFilter(modeKey)}
            style={[
              styles.chip,
              {
                backgroundColor: isSelected ? C.text : C.surfaceRaised,
                borderColor: isSelected ? C.text : C.border,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color: isSelected ? C.background : C.text,
                  fontWeight: isSelected ? '700' : '500',
                },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (!user) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        {header}
        <View style={styles.centerState}>
          <View style={[styles.stateBadge, { backgroundColor: C.surfaceRaised }]}>
            <SymbolView
              name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
              size={36}
              tintColor={Design.color.accent}
            />
          </View>
          <Text style={[styles.stateTitle, { color: C.text }]}>Sign in to see notifications</Text>
          <Text style={[styles.stateText, { color: C.muted }]}>
            Get updates about new videos, comments, and subscribers from channels you love.
          </Text>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: Design.color.accent }]}
            onPress={() => router.push('/main/profile')}
          >
            <Text style={styles.primaryBtnText}>Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const renderRow = (item: NotificationRecord) => {
    const actorName = item.actor?.fullName || item.actor?.username || '';
    const initial = (actorName || 'S').charAt(0).toUpperCase();
    const videoInfo = getVideoDetails(item);

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.isRead ? '' : 'Unread. '}${item.message}`}
        onPress={() => onPressItem(item)}
        style={[
          styles.row,
          {
            backgroundColor: item.isRead ? C.background : isDark ? '#1a1d24' : '#f0f4ff',
            borderBottomColor: C.border,
          },
        ]}
      >
        {/* Unread dot indicator on the extreme left like YouTube */}
        <View style={styles.indicatorCol}>
          {!item.isRead ? <View style={styles.unreadDot} /> : null}
        </View>

        {/* Actor Avatar with Action Badge */}
        <View style={styles.avatarContainer}>
          {item.actor?.avatar ? (
            <Image source={{ uri: item.actor.avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: C.surfaceRaised }]}>
              <Text style={[styles.avatarInitial, { color: C.secondary }]}>{initial}</Text>
            </View>
          )}
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor:
                  item.type === 'new_video'
                    ? Design.color.accent
                    : item.type === 'new_subscriber'
                      ? '#8a3ffc'
                      : '#0f62fe',
                borderColor: C.background,
              },
            ]}
          >
            <SymbolView name={TYPE_ICONS[item.type] ?? TYPE_ICONS.new_video} size={10} tintColor="#ffffff" />
          </View>
        </View>

        {/* Message body and timestamp */}
        <View style={styles.body}>
          <Text
            style={[
              styles.message,
              {
                color: C.text,
                fontWeight: item.isRead ? '400' : '700',
              },
            ]}
            numberOfLines={3}
          >
            {item.message}
          </Text>
          <Text style={[styles.time, { color: C.muted }]}>{formatTimeAgo(item.createdAt)}</Text>
        </View>

        {/* Right side: Video thumbnail preview if video notification */}
        {videoInfo?.thumbnailUrl ? (
          <View style={[styles.thumbWrap, { backgroundColor: C.surfaceRaised }]}>
            <Image source={{ uri: videoInfo.thumbnailUrl }} style={styles.thumbImage} contentFit="cover" />
          </View>
        ) : null}

        {/* 3-dots action menu button */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Notification options"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => setSelectedItem(item)}
          style={styles.menuBtn}
        >
          <SymbolView
            name={{ ios: 'ellipsis', android: 'more_vert', web: 'more_vert' }}
            size={18}
            tintColor={C.muted}
          />
        </TouchableOpacity>
      </Pressable>
    );
  };

  const renderFlatListItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return (
        <View style={[styles.sectionHeader, { backgroundColor: C.background }]}>
          <Text style={[styles.sectionHeaderText, { color: C.text }]}>{item.title}</Text>
        </View>
      );
    }
    return renderRow(item.record);
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={Design.color.accent} />
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centerState}>
          <SymbolView
            name={{ ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' }}
            size={36}
            tintColor={C.danger}
          />
          <Text style={[styles.stateTitle, { color: C.text }]}>Notifications could not be loaded</Text>
          <Text style={[styles.stateText, { color: C.muted }]}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            style={[styles.secondaryBtn, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}
            onPress={() => void load(1, 'initial')}
          >
            <Text style={[styles.secondaryBtnText, { color: C.text }]}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.centerState}>
        <View style={[styles.stateBadge, { backgroundColor: C.surfaceRaised }]}>
          <SymbolView
            name={{ ios: 'bell', android: 'notifications_none', web: 'notifications_none' }}
            size={36}
            tintColor={C.muted}
          />
        </View>
        <Text style={[styles.stateTitle, { color: C.text }]}>
          {filter === 'unread'
            ? 'No unread notifications'
            : filter === 'mentions'
              ? 'No mentions yet'
              : "You're all caught up"}
        </Text>
        <Text style={[styles.stateText, { color: C.muted }]}>
          {filter === 'unread'
            ? 'All your notifications have been marked as read.'
            : filter === 'mentions'
              ? 'Comments and replies mentioning you will show up here.'
              : 'New videos, comments, and subscribers will appear here.'}
        </Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (loadingMore) return <ActivityIndicator style={styles.footer} color={Design.color.accent} />;
    if (error && items.length > 0) {
      return (
        <Pressable style={styles.footer} onPress={() => void load(pageRef.current + 1, 'more')}>
          <Text style={[styles.markAllText, { color: Design.color.accent }]}>
            Could not load more. Tap to retry
          </Text>
        </Pressable>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      {header}
      {filterChips}

      {actionError ? (
        <View style={[styles.banner, { backgroundColor: C.accentSurface }]}>
          <Text style={[styles.bannerText, { color: C.danger }]}>{actionError}</Text>
        </View>
      ) : null}

      <FlatList
        data={flatListData}
        keyExtractor={(item) => item.id}
        renderItem={renderFlatListItem}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={flatListData.length === 0 ? styles.emptyContent : undefined}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Design.color.accent}
            colors={[Design.color.accent]}
          />
        }
      />

      {/* YouTube-style 3-dots Context Menu Sheet */}
      <Modal
        visible={Boolean(selectedItem)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedItem(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setSelectedItem(null)}
          style={styles.modalBackdrop}
        >
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: C.surface,
                borderTopColor: C.border,
              },
            ]}
          >
            <View style={styles.modalHandleWrap}>
              <View style={[styles.modalHandle, { backgroundColor: C.border }]} />
            </View>

            {selectedItem ? (
              <View style={styles.modalContent}>
                {/* Channel / Actor header */}
                <View style={styles.sheetHeader}>
                  <View style={styles.sheetHeaderLeft}>
                    {selectedItem.actor?.avatar ? (
                      <Image
                        source={{ uri: selectedItem.actor.avatar }}
                        style={styles.sheetAvatar}
                        contentFit="cover"
                      />
                    ) : null}
                    <View style={styles.sheetActorInfo}>
                      <Text style={[styles.sheetActorName, { color: C.text }]} numberOfLines={1}>
                        {selectedItem.actor?.fullName || selectedItem.actor?.username || 'Streanub notification'}
                      </Text>
                      <Text style={[styles.sheetTime, { color: C.muted }]}>
                        {formatTimeAgo(selectedItem.createdAt)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Action: Hide / Delete notification */}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Hide this notification"
                  style={styles.sheetActionRow}
                  onPress={() => void onDeleteNotification(selectedItem)}
                >
                  <View style={[styles.sheetActionIcon, { backgroundColor: C.surfaceRaised }]}>
                    <SymbolView
                      name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                      size={20}
                      tintColor={C.danger}
                    />
                  </View>
                  <View style={styles.sheetActionTextWrap}>
                    <Text style={[styles.sheetActionTitle, { color: C.danger }]}>
                      Hide this notification
                    </Text>
                    <Text style={[styles.sheetActionSub, { color: C.muted }]}>
                      Remove from your notification stream
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Action: Mark as read */}
                {!selectedItem.isRead ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Mark as read"
                    style={styles.sheetActionRow}
                    onPress={() => void onToggleReadStatus(selectedItem)}
                  >
                    <View style={[styles.sheetActionIcon, { backgroundColor: C.surfaceRaised }]}>
                      <SymbolView
                        name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                        size={20}
                        tintColor={C.text}
                      />
                    </View>
                    <View style={styles.sheetActionTextWrap}>
                      <Text style={[styles.sheetActionTitle, { color: C.text }]}>Mark as read</Text>
                      <Text style={[styles.sheetActionSub, { color: C.muted }]}>
                        Keep notification but clear unread indicator
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : null}

                {/* Action: Go to creator channel */}
                {getActorId(selectedItem) ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="View channel"
                    style={styles.sheetActionRow}
                    onPress={() => {
                      const actorId = getActorId(selectedItem);
                      setSelectedItem(null);
                      if (actorId) {
                        router.push({
                          pathname: '/main/profile',
                          params: { userId: String(actorId) },
                        });
                      }
                    }}
                  >
                    <View style={[styles.sheetActionIcon, { backgroundColor: C.surfaceRaised }]}>
                      <SymbolView
                        name={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }}
                        size={20}
                        tintColor={C.text}
                      />
                    </View>
                    <View style={styles.sheetActionTextWrap}>
                      <Text style={[styles.sheetActionTitle, { color: C.text }]}>View channel</Text>
                      <Text style={[styles.sheetActionSub, { color: C.muted }]}>
                        Visit creator profile and see all videos
                      </Text>
                    </View>
                  </TouchableOpacity>
                ) : null}

                {/* Action: Notification settings */}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Notification settings"
                  style={styles.sheetActionRow}
                  onPress={() => {
                    setSelectedItem(null);
                    router.push('/settings');
                  }}
                >
                  <View style={[styles.sheetActionIcon, { backgroundColor: C.surfaceRaised }]}>
                    <SymbolView
                      name={{ ios: 'gearshape', android: 'settings', web: 'settings' }}
                      size={20}
                      tintColor={C.text}
                    />
                  </View>
                  <View style={styles.sheetActionTextWrap}>
                    <Text style={[styles.sheetActionTitle, { color: C.text }]}>Settings</Text>
                    <Text style={[styles.sheetActionSub, { color: C.muted }]}>
                      Manage notifications and frequency
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Cancel Button */}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Close options"
                  style={[styles.sheetCancelBtn, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}
                  onPress={() => setSelectedItem(null)}
                >
                  <Text style={[styles.sheetCancelText, { color: C.text }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 19,
  },
  titleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 6,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  countPill: {
    backgroundColor: Design.color.accent,
    borderRadius: Design.radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  countPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markAllBtn: {
    minHeight: 36,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Design.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 13,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  indicatorCol: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Design.color.accent,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 17,
    fontWeight: '700',
  },
  typeBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    gap: 3,
    paddingRight: 8,
  },
  message: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  time: {
    fontSize: 11.5,
  },
  thumbWrap: {
    width: 58,
    height: 38,
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 4,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  menuBtn: {
    width: 32,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContent: {
    flexGrow: 1,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
    minHeight: 320,
  },
  stateBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateText: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 290,
    lineHeight: 18,
  },
  primaryBtn: {
    marginTop: 10,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: Design.radius.pill,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Design.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 28,
  },
  modalHandleWrap: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  modalContent: {
    paddingHorizontal: 16,
    gap: 4,
  },
  sheetHeader: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
    marginBottom: 6,
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  sheetActorInfo: {
    flex: 1,
    gap: 2,
  },
  sheetActorName: {
    fontSize: 14,
    fontWeight: '700',
  },
  sheetTime: {
    fontSize: 12,
  },
  sheetActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  sheetActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetActionTextWrap: {
    flex: 1,
    gap: 2,
  },
  sheetActionTitle: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  sheetActionSub: {
    fontSize: 12,
  },
  sheetCancelBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: Design.radius.pill,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  sheetCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
