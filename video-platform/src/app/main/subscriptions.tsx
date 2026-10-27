import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {
  Pressable,
  SafeAreaView,
  StatusBar,
  Text,
  TextInput,
  ThemeToggleButton,
  View,
} from '@/components/theme-native';
import { VideoCard } from '@/components/video-card';
import { VideoCardSkeleton } from '@/components/video-card-skeleton';
import { Design } from '@/constants/design';
import { useAuth } from '@/contexts/auth-context';
import { useNotifications } from '@/contexts/notification-context';
import { useSubscription } from '@/contexts/subscription-context';
import { useThemeMode } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import { fetchHistory } from '@/lib/video-service';

type FeedFilter = 'all' | 'today' | 'unwatched';
type NotificationBellMode = 'all' | 'personalized' | 'none';

export default function SubscriptionsScreen() {
  const { user } = useAuth();
  const { mode } = useThemeMode();
  const { showToast } = useToast();
  const { unreadCount } = useNotifications();
  const {
    creators,
    feed,
    loadingFeed: loading,
    refreshingFeed: refreshing,
    refreshFeed,
    executeUnsubscribe,
  } = useSubscription();

  const isDark = mode === 'dark';
  const C = isDark ? Design.color : Design.light;

  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FeedFilter>('all');
  const [historyIds, setHistoryIds] = useState<Set<string>>(new Set());
  const [showManageModal, setShowManageModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, NotificationBellMode>>({});

  useFocusEffect(
    useCallback(() => {
      void refreshFeed();
      fetchHistory()
        .then((items) => {
          setHistoryIds(new Set(items.map((i) => i._id)));
        })
        .catch(() => {});
    }, [refreshFeed])
  );

  const onRefresh = async () => {
    await refreshFeed();
  };

  // Filter feed videos based on selected creator and active chip
  const filteredVideos = useMemo(() => {
    return feed.filter((v) => {
      if (selectedCreatorId) {
        const cId = typeof v.creator === 'object' && v.creator?._id ? v.creator._id : v.creator;
        if (cId !== selectedCreatorId) return false;
      }
      if (activeFilter === 'today') {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        return new Date(v.createdAt).getTime() >= oneDayAgo;
      }
      if (activeFilter === 'unwatched') {
        return !historyIds.has(v._id);
      }
      return true;
    });
  }, [feed, selectedCreatorId, activeFilter, historyIds]);

  // Subscribed creators filtered by search query in the manage modal
  const searchedCreators = useMemo(() => {
    if (!searchQuery.trim()) return creators;
    const q = searchQuery.trim().toLowerCase();
    return creators.filter((c) => {
      const name = (c.fullName || c.username || '').toLowerCase();
      const username = (c.username || '').toLowerCase();
      return name.includes(q) || username.includes(q);
    });
  }, [creators, searchQuery]);

  const toggleChannelBell = (creatorId: string, name: string) => {
    setNotificationPrefs((prev) => {
      const current = prev[creatorId] || 'all';
      const next: NotificationBellMode =
        current === 'all' ? 'personalized' : current === 'personalized' ? 'none' : 'all';
      const label =
        next === 'all'
          ? `All notifications for ${name}`
          : next === 'personalized'
          ? `Personalized notifications for ${name}`
          : `Notifications turned off for ${name}`;
      showToast(label);
      return { ...prev, [creatorId]: next };
    });
  };

  const handleUnsubscribeFromModal = async (creatorId: string, name: string) => {
    try {
      await executeUnsubscribe(creatorId, name);
      showToast(`Unsubscribed from ${name}`);
      if (selectedCreatorId === creatorId) {
        setSelectedCreatorId(null);
      }
    } catch {
      showToast('Could not unsubscribe', 'error');
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={[styles.header, { borderBottomColor: C.border }]}>
          <Text style={[styles.title, { color: C.text }]}>Subscriptions</Text>
          <ThemeToggleButton />
        </View>
        <View style={styles.authPromptContainer}>
          <View style={[styles.iconBadge, { backgroundColor: C.surfaceRaised }]}>
            <SymbolView
              name={{ ios: 'play.square.stack.fill', android: 'subscriptions', web: 'subscriptions' }}
              size={36}
              tintColor={Design.color.accent}
            />
          </View>
          <Text style={[styles.authTitle, { color: C.text }]}>{"Don't miss new videos"}</Text>
          <Text style={[styles.authSubtitle, { color: C.secondary }]}>
            Sign in to subscribe to your favorite channels and see their latest uploads right here.
          </Text>
          <Pressable
            style={[styles.signInBtn, { backgroundColor: Design.color.accent }]}
            onPress={() => router.push('/main/profile')}
          >
            <Text style={styles.signInBtnText}>Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
    <>
      {creators.length > 0 ? (
        <View style={[styles.creatorsContainer, { borderBottomColor: C.border }]}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={creators}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.creatorsList}
            ListHeaderComponent={
              <Pressable
                style={[
                  styles.creatorItem,
                  selectedCreatorId === null && styles.creatorItemActive,
                ]}
                onPress={() => setSelectedCreatorId(null)}
              >
                <View
                  style={[
                    styles.allChip,
                    {
                      backgroundColor:
                        selectedCreatorId === null
                          ? Design.color.accent
                          : C.surfaceRaised,
                      borderColor: selectedCreatorId === null ? Design.color.accent : C.border,
                      borderWidth: StyleSheet.hairlineWidth,
                    },
                    !isDark && Design.shadow.sm,
                  ]}
                >
                  <Text
                    style={[
                      styles.allChipText,
                      { color: selectedCreatorId === null ? '#ffffff' : C.text },
                    ]}
                  >
                    All
                  </Text>
                </View>
                <Text
                  style={[
                    styles.creatorName,
                    { color: selectedCreatorId === null ? C.text : C.muted },
                  ]}
                  numberOfLines={1}
                >
                  All
                </Text>
              </Pressable>
            }
            renderItem={({ item }) => {
              const isSelected = selectedCreatorId === item._id;
              const initials = (item.fullName || item.username || 'C').charAt(0).toUpperCase();
              return (
                <Pressable
                  style={[styles.creatorItem, isSelected && styles.creatorItemActive]}
                  onPress={() => setSelectedCreatorId(isSelected ? null : item._id)}
                >
                  {item.avatar ? (
                    <Image
                      source={{ uri: item.avatar }}
                      style={[
                        styles.creatorAvatar,
                        { borderColor: isSelected ? Design.color.accent : C.border, borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth },
                        !isDark && Design.shadow.sm,
                      ]}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.creatorAvatarFallback,
                        { backgroundColor: C.surfaceRaised, borderColor: isSelected ? Design.color.accent : C.border, borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth },
                        !isDark && Design.shadow.sm,
                      ]}
                    >
                      <Text style={[styles.avatarInitial, { color: C.secondary }]}>
                        {initials}
                      </Text>
                    </View>
                  )}
                  <Text
                    style={[
                      styles.creatorName,
                      { color: isSelected ? C.text : C.secondary, fontWeight: isSelected ? '700' : '500' },
                    ]}
                    numberOfLines={1}
                  >
                    {item.fullName || item.username}
                  </Text>
                </Pressable>
              );
            }}
            ListFooterComponent={
              <Pressable
                style={styles.creatorItem}
                onPress={() => setShowManageModal(true)}
              >
                <View
                  style={[
                    styles.allChip,
                    {
                      backgroundColor: C.surfaceRaised,
                      borderColor: C.border,
                      borderWidth: StyleSheet.hairlineWidth,
                    },
                    !isDark && Design.shadow.sm,
                  ]}
                >
                  <SymbolView
                    name={{ ios: 'chevron.forward', android: 'chevron_right', web: 'chevron_right' }}
                    size={18}
                    tintColor={C.text}
                  />
                </View>
                <Text
                  style={[styles.creatorName, { color: C.text, fontWeight: '700' }]}
                  numberOfLines={1}
                >
                  All ›
                </Text>
              </Pressable>
            }
          />
        </View>
      ) : null}

      {/* YouTube Filter Chips Row */}
      {creators.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          {(['all', 'today', 'unwatched'] as const).map((chip) => {
            const isChipActive = activeFilter === chip;
            const labels: Record<FeedFilter, string> = {
              all: 'All',
              today: 'Today',
              unwatched: 'Unwatched',
            };
            return (
              <Pressable
                key={chip}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isChipActive
                      ? (isDark ? '#ffffff' : '#0f0f0f')
                      : C.surfaceRaised,
                    borderColor: isChipActive ? (isDark ? '#ffffff' : '#0f0f0f') : C.border,
                  },
                ]}
                onPress={() => setActiveFilter(chip)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isChipActive ? (isDark ? '#000000' : '#ffffff') : C.text,
                      fontWeight: isChipActive ? '700' : '500',
                    },
                  ]}
                >
                  {labels[chip]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {/* Selected Creator Banner */}
      {selectedCreatorId ? (
        <View style={[styles.filterBar, { backgroundColor: C.surfaceRaised, borderBottomColor: C.border }]}>
          <View style={styles.filterBarLeft}>
            <Text style={[styles.filterBarText, { color: C.text }]} numberOfLines={1}>
              Channel:{' '}
              <Text style={{ fontWeight: '700' }}>
                {creators.find((c) => c._id === selectedCreatorId)?.fullName ||
                  creators.find((c) => c._id === selectedCreatorId)?.username ||
                  'Creator'}
              </Text>
            </Text>
          </View>
          <View style={styles.filterBarRight}>
            <Pressable
              style={styles.viewChannelBtn}
              onPress={() =>
                router.push({
                  pathname: '/main/profile',
                  params: { userId: selectedCreatorId },
                })
              }
            >
              <Text style={[styles.viewChannelText, { color: Design.color.accent }]}>
                Visit Channel →
              </Text>
            </Pressable>
            <Pressable
              style={styles.clearFilterBtn}
              onPress={() => setSelectedCreatorId(null)}
              hitSlop={6}
            >
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                size={14}
                tintColor={C.muted}
              />
            </Pressable>
          </View>
        </View>
      ) : null}
    </>
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.iconBadge, { backgroundColor: C.surfaceRaised }]}>
          <SymbolView
            name={{ ios: 'play.square.stack', android: 'subscriptions', web: 'subscriptions' }}
            size={34}
            tintColor={C.muted}
          />
        </View>
        <Text style={[styles.emptyTitle, { color: C.text }]}>
          {creators.length === 0
            ? 'No subscriptions yet'
            : activeFilter === 'today'
            ? 'No videos uploaded today'
            : activeFilter === 'unwatched'
            ? 'All caught up!'
            : 'No videos from this creator'}
        </Text>
        <Text style={[styles.emptySubtitle, { color: C.muted }]}>
          {creators.length === 0
            ? 'When you subscribe to creators, their latest videos will appear here.'
            : activeFilter === 'today'
            ? 'None of your subscribed creators uploaded in the last 24 hours. Tap "All" to browse recent uploads.'
            : activeFilter === 'unwatched'
            ? 'You have watched all available videos in your subscription feed.'
            : 'Check back soon for new uploads.'}
        </Text>
        {creators.length === 0 ? (
          <Pressable
            style={[styles.exploreBtn, { backgroundColor: Design.color.accent }]}
            onPress={() => router.push('/main/explore')}
          >
            <Text style={styles.exploreBtnText}>Discover Creators</Text>
          </Pressable>
        ) : activeFilter !== 'all' ? (
          <Pressable
            style={[styles.exploreBtn, { backgroundColor: Design.color.accent }]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={styles.exploreBtnText}>Show All Videos</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: C.border }]}>
        <View style={styles.headerTitleGroup}>
          <SymbolView
            name={{ ios: 'play.square.stack.fill', android: 'subscriptions', web: 'subscriptions' }}
            size={22}
            tintColor={Design.color.accent}
          />
          <Text style={[styles.title, { color: C.text }]}>Subscriptions</Text>
        </View>
        <View style={styles.headerRight}>
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
          <ThemeToggleButton />
        </View>
      </View>

      {/* Feed List */}
      {loading && !refreshing ? (
        <View style={styles.skeletonContainer}>
          <VideoCardSkeleton />
          <VideoCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={filteredVideos}
          keyExtractor={(item) => item._id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Design.color.accent}
              colors={[Design.color.accent]}
            />
          }
          renderItem={({ item }) => (
            <VideoCard
              video={item}
              onPress={() => router.push({ pathname: '/watch', params: { id: item._id } })}
            />
          )}
        />
      )}

      {/* Manage Subscriptions Modal Sheet */}
      <Modal
        visible={showManageModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowManageModal(false)}
      >
        <SafeAreaView style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: C.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: C.border }]}>
              <Text style={[styles.modalTitle, { color: C.text }]}>
                All Subscriptions ({creators.length})
              </Text>
              <Pressable
                onPress={() => setShowManageModal(false)}
                hitSlop={10}
                style={styles.closeBtn}
                accessibilityLabel="Close"
              >
                <SymbolView
                  name={{ ios: 'xmark', android: 'close', web: 'close' }}
                  size={20}
                  tintColor={C.text}
                />
              </Pressable>
            </View>

            {/* Subscriptions Search Bar */}
            <View style={[styles.searchBarBox, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}>
              <SymbolView
                name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
                size={16}
                tintColor={C.muted}
              />
              <TextInput
                style={[styles.searchInput, { color: C.text }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search subscriptions"
                placeholderTextColor={C.muted}
                clearButtonMode="while-editing"
                autoCapitalize="none"
              />
            </View>

            {/* Creators List */}
            <FlatList
              data={searchedCreators}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.manageList}
              ListEmptyComponent={
                <View style={styles.manageEmpty}>
                  <Text style={[styles.manageEmptyText, { color: C.muted }]}>
                    No subscribed channels matching "{searchQuery}".
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const initials = (item.fullName || item.username || 'C').charAt(0).toUpperCase();
                const bellState = notificationPrefs[item._id] || 'all';
                return (
                  <View style={[styles.manageRow, { borderBottomColor: C.border }]}>
                    <Pressable
                      style={styles.manageCreatorPressable}
                      onPress={() => {
                        setShowManageModal(false);
                        router.push({
                          pathname: '/main/profile',
                          params: { userId: item._id },
                        });
                      }}
                    >
                      {item.avatar ? (
                        <Image source={{ uri: item.avatar }} style={styles.manageAvatar} contentFit="cover" />
                      ) : (
                        <View style={[styles.manageAvatarFallback, { backgroundColor: C.surfaceRaised }]}>
                          <Text style={[styles.manageInitial, { color: Design.color.accent }]}>{initials}</Text>
                        </View>
                      )}
                      <View style={styles.manageInfo}>
                        <Text style={[styles.manageName, { color: C.text }]} numberOfLines={1}>
                          {item.fullName || item.username}
                        </Text>
                        <Text style={[styles.manageSubCount, { color: C.muted }]}>
                          {item.subscriberCount} {item.subscriberCount === 1 ? 'subscriber' : 'subscribers'}
                        </Text>
                      </View>
                    </Pressable>

                    <View style={styles.manageActionsRow}>
                      {/* Bell Toggle */}
                      <Pressable
                        style={[styles.bellBtn, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}
                        onPress={() => toggleChannelBell(item._id, item.fullName || item.username)}
                        hitSlop={6}
                        accessibilityLabel="Notification settings"
                      >
                        <SymbolView
                          name={{
                            ios: bellState === 'all' ? 'bell.fill' : bellState === 'personalized' ? 'bell.badge' : 'bell.slash',
                            android: bellState === 'all' ? 'notifications' : bellState === 'personalized' ? 'notifications_active' : 'notifications_off',
                            web: bellState === 'all' ? 'notifications' : bellState === 'personalized' ? 'notifications_active' : 'notifications_off',
                          }}
                          size={16}
                          tintColor={bellState === 'none' ? C.muted : Design.color.accent}
                        />
                      </Pressable>

                      {/* Unsubscribe Button */}
                      <Pressable
                        style={[styles.unsubBtn, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}
                        onPress={() => handleUnsubscribeFromModal(item._id, item.fullName || item.username)}
                        hitSlop={4}
                      >
                        <Text style={[styles.unsubBtnText, { color: C.text }]}>Subscribed</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }}
            />
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
  header: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
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
    position: 'relative',
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
  creatorsContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  creatorsList: {
    paddingHorizontal: 16,
    gap: 16,
    alignItems: 'center',
  },
  creatorItem: {
    alignItems: 'center',
    width: 64,
    gap: 4,
  },
  creatorItemActive: {
    opacity: 1,
  },
  creatorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  creatorAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '700',
  },
  allChip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  allChipText: {
    fontSize: 14,
    fontWeight: '700',
  },
  creatorName: {
    fontSize: 11,
    textAlign: 'center',
  },
  filterChipsRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Design.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterChipText: {
    fontSize: 13,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterBarLeft: {
    flex: 1,
  },
  filterBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterBarText: {
    fontSize: 13,
  },
  viewChannelBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  viewChannelText: {
    fontSize: 13,
    fontWeight: '700',
  },
  clearFilterBtn: {
    padding: 4,
  },
  listContent: {
    paddingBottom: 28,
  },
  skeletonContainer: {
    paddingVertical: 12,
  },
  authPromptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  authTitle: {
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  signInBtn: {
    marginTop: 10,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: Design.radius.pill,
  },
  signInBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 10,
    marginTop: 30,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 18,
  },
  exploreBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: Design.radius.pill,
  },
  exploreBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    flex: 1,
    marginTop: 70,
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
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Design.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  manageList: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  manageEmpty: {
    padding: 30,
    alignItems: 'center',
  },
  manageEmptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  manageCreatorPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 8,
  },
  manageAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  manageAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  manageInitial: {
    fontSize: 18,
    fontWeight: '800',
  },
  manageInfo: {
    flex: 1,
    gap: 2,
  },
  manageName: {
    fontSize: 14,
    fontWeight: '700',
  },
  manageSubCount: {
    fontSize: 12,
  },
  manageActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unsubBtn: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: Design.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unsubBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
