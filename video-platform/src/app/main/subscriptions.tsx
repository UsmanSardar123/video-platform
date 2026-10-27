import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import {
  Pressable,
  SafeAreaView,
  StatusBar,
  Text,
  ThemeToggleButton,
  View,
} from '@/components/theme-native';
import { VideoCard } from '@/components/video-card';
import { VideoCardSkeleton } from '@/components/video-card-skeleton';
import { Design } from '@/constants/design';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { useSubscription } from '@/contexts/subscription-context';

export default function SubscriptionsScreen() {
  const { user } = useAuth();
  const { mode } = useThemeMode();
  const {
    creators,
    feed,
    loadingFeed: loading,
    refreshingFeed: refreshing,
    refreshFeed,
  } = useSubscription();

  const isDark = mode === 'dark';
  const C = isDark ? Design.color : Design.light;

  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refreshFeed();
    }, [refreshFeed])
  );

  const onRefresh = async () => {
    await refreshFeed();
  };

  const filteredVideos = selectedCreatorId
    ? feed.filter((v) => {
      const cId = typeof v.creator === 'object' && v.creator?._id ? v.creator._id : v.creator;
      return cId === selectedCreatorId;
    })
    : feed;

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
          />
        </View>
      ) : null}

      {selectedCreatorId ? (
        <View style={[styles.filterBar, { backgroundColor: C.surfaceRaised, borderBottomColor: C.border }]}>
          <Text style={[styles.filterBarText, { color: C.text }]} numberOfLines={1}>
            Channel:{' '}
            <Text style={{ fontWeight: '700' }}>
              {creators.find((c) => c._id === selectedCreatorId)?.fullName ||
                creators.find((c) => c._id === selectedCreatorId)?.username ||
                'Creator'}
            </Text>
          </Text>
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
            : 'No videos from this creator'}
        </Text>
        <Text style={[styles.emptySubtitle, { color: C.muted }]}>
          {creators.length === 0
            ? 'When you subscribe to creators, their latest videos will appear here.'
            : 'Check back soon for new uploads.'}
        </Text>
        {creators.length === 0 ? (
          <Pressable
            style={[styles.exploreBtn, { backgroundColor: Design.color.accent }]}
            onPress={() => router.push('/main/explore')}
          >
            <Text style={styles.exploreBtnText}>Discover Creators</Text>
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
            onPress={() => router.push('/main/explore')}
            style={styles.headerIconBtn}
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
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Design.spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterBarText: {
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  viewChannelBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  viewChannelText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
