import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
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
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRecord,
  type NotificationType,
} from '@/lib/notification-service';
import { formatTimeAgo } from '@/types/video';

const PAGE_SIZE = 20;

const TYPE_ICONS: Record<NotificationType, any> = {
  new_video: { ios: 'play.rectangle.fill', android: 'play_circle', web: 'play_circle' },
  new_comment: { ios: 'bubble.left.fill', android: 'chat', web: 'chat' },
  new_subscriber: { ios: 'person.badge.plus', android: 'person_add', web: 'person_add' },
  comment_reply: { ios: 'arrowshape.turn.up.left.fill', android: 'reply', web: 'reply' },
};

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { mode } = useThemeMode();
  const { unreadCount, setUnreadCount, refreshUnreadCount } = useNotifications();
  const isDark = mode === 'dark';
  const C = isDark ? Design.color : Design.light;

  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  const pageRef = useRef(1);
  const hasMoreRef = useRef(false);
  const inFlightRef = useRef(false);
  const pendingReadRef = useRef(new Set<string>());
  const markingAllRef = useRef(false);

  const load = useCallback(async (targetPage: number, mode: 'initial' | 'refresh' | 'more') => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (mode === 'refresh') setRefreshing(true);
    else if (mode === 'more') setLoadingMore(true);
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
      if (targetPage === 1) void refreshUnreadCount();
    } catch (cause) {
      // Keep already-loaded rows when only a refresh / next-page request fails.
      if (targetPage === 1 && mode !== 'refresh') setItems([]);
      setError(cause instanceof Error ? cause.message : 'Could not load notifications.');
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [refreshUnreadCount]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      void load(1, 'initial');
    }, [user?.id, load])
  );

  const onRefresh = useCallback(() => void load(1, 'refresh'), [load]);

  const onEndReached = useCallback(() => {
    if (!hasMoreRef.current || inFlightRef.current || error) return;
    void load(pageRef.current + 1, 'more');
  }, [load, error]);

  const onPressItem = useCallback(
    async (item: NotificationRecord) => {
      // 1. Mark as read optimistically if currently unread
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

      // 2. Validate referenced records and navigate gracefully
      const videoId = item.link?.params?.id || item.video;
      const commentId = item.link?.params?.commentId || item.comment;
      const actorId =
        item.link?.params?.userId ||
        (typeof item.actor === 'object' && item.actor?._id ? item.actor._id : (item.actor as string | undefined));

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

      // Screen navigation fallback based on link metadata
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
        return;
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
          size={20}
          tintColor={C.text}
        />
      </Pressable>
      <View style={styles.titleGroup}>
        <Text style={[styles.title, { color: C.text }]}>Notifications</Text>
        {user && unreadCount > 0 ? (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{unreadCount > 99 ? '99+' : unreadCount} new</Text>
          </View>
        ) : null}
      </View>
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
            <Text style={[styles.markAllText, { color: Design.color.accent }]}>Mark all read</Text>
          )}
        </Pressable>
      ) : (
        <View style={styles.iconBtn} />
      )}
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
              size={34}
              tintColor={Design.color.accent}
            />
          </View>
          <Text style={[styles.stateTitle, { color: C.text }]}>Sign in to see notifications</Text>
          <Text style={[styles.stateText, { color: C.muted }]}>
            Get updates about new videos, comments and subscribers.
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

  const renderItem = ({ item }: { item: NotificationRecord }) => {
    const actorName = item.actor?.fullName || item.actor?.username || '';
    const initial = (actorName || 'S').charAt(0).toUpperCase();
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.isRead ? '' : 'Unread. '}${item.message}`}
        onPress={() => onPressItem(item)}
        style={[
          styles.row,
          {
            backgroundColor: item.isRead ? C.background : C.accentSurface,
            borderBottomColor: C.border,
          },
        ]}
      >
        <View>
          {item.actor?.avatar ? (
            <Image source={{ uri: item.actor.avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: C.surfaceRaised }]}>
              <Text style={[styles.avatarInitial, { color: C.secondary }]}>{initial}</Text>
            </View>
          )}
          <View style={[styles.typeBadge, { backgroundColor: Design.color.accent, borderColor: C.background }]}>
            <SymbolView name={TYPE_ICONS[item.type] ?? TYPE_ICONS.new_video} size={10} tintColor="#ffffff" />
          </View>
        </View>
        <View style={styles.body}>
          <Text
            style={[styles.message, { color: C.text, fontWeight: item.isRead ? '500' : '700' }]}
            numberOfLines={3}
          >
            {item.message}
          </Text>
          <Text style={[styles.time, { color: C.muted }]}>{formatTimeAgo(item.createdAt)}</Text>
        </View>
        {!item.isRead ? <View style={styles.unreadDot} /> : null}
      </Pressable>
    );
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
            size={34}
            tintColor={C.muted}
          />
        </View>
        <Text style={[styles.stateTitle, { color: C.text }]}>{"You're all caught up"}</Text>
        <Text style={[styles.stateText, { color: C.muted }]}>
          New videos, comments and subscribers will show up here.
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
      {actionError ? (
        <View style={[styles.banner, { backgroundColor: C.accentSurface }]}>
          <Text style={[styles.bannerText, { color: C.danger }]}>{actionError}</Text>
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={items.length === 0 ? styles.emptyContent : undefined}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  titleGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 4 },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  countPill: {
    backgroundColor: Design.color.accent,
    borderRadius: Design.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  markAllBtn: { minWidth: 36, minHeight: 36, justifyContent: 'center', alignItems: 'flex-end' },
  markAllText: { fontSize: 13, fontWeight: '700' },
  banner: { paddingHorizontal: 16, paddingVertical: 8 },
  bannerText: { fontSize: 13, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 18, fontWeight: '700' },
  typeBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: { flex: 1, gap: 4 },
  message: { fontSize: 14, lineHeight: 19 },
  time: { fontSize: 12 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Design.color.accent },
  emptyContent: { flexGrow: 1 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10, minHeight: 320 },
  stateBadge: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  stateTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  stateText: { fontSize: 13, textAlign: 'center', maxWidth: 280, lineHeight: 18 },
  primaryBtn: { marginTop: 10, paddingHorizontal: 28, paddingVertical: 12, borderRadius: Design.radius.pill },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Design.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '700' },
  footer: { paddingVertical: 16, alignItems: 'center' },
});
