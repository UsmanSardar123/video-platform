import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Modal, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import {
  Pressable,
  Text,
  View,
} from '@/components/theme-native';
import { Design } from '@/constants/design';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import {
  fetchSubscriptionStatus,
  fetchSubscriptions,
  fetchSubscriptionsFeed,
  subscribeToCreator,
  unsubscribeFromCreator,
} from '@/lib/video-service';
import type { CreatorProfile, VideoRecord } from '@/types/video';

interface SubscriptionContextType {
  subscribedMap: Record<string, boolean>;
  subscriberCountMap: Record<string, number>;
  creators: CreatorProfile[];
  feed: VideoRecord[];
  loadingFeed: boolean;
  refreshingFeed: boolean;
  isSubscribed: (creatorId: string | null | undefined) => boolean;
  getSubscriberCount: (creatorId: string | null | undefined, fallback?: number) => number;
  isSubscribing: (creatorId: string | null | undefined) => boolean;
  fetchStatus: (creatorId: string) => Promise<{ isSubscribed: boolean; subscriberCount: number }>;
  toggleSubscribe: (creator: { id: string; name?: string }) => void;
  executeSubscribe: (creatorId: string, creatorName?: string) => Promise<boolean>;
  executeUnsubscribe: (creatorId: string, creatorName?: string) => Promise<boolean>;
  refreshFeed: () => Promise<void>;
  showSignInModal: (actionName?: string) => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { mode } = useThemeMode();
  const { showToast } = useToast();
  const isDark = mode === 'dark';
  const C = isDark ? Design.color : Design.light;

  const [subscribedMap, setSubscribedMap] = useState<Record<string, boolean>>({});
  const [subscriberCountMap, setSubscriberCountMap] = useState<Record<string, number>>({});
  const [subscribingIds, setSubscribingIds] = useState<Record<string, boolean>>({});
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [feed, setFeed] = useState<VideoRecord[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [refreshingFeed, setRefreshingFeed] = useState(false);

  // Modal Sheet states
  const [unsubModalTarget, setUnsubModalTarget] = useState<{ id: string; name: string } | null>(null);
  const [signInModalVisible, setSignInModalVisible] = useState(false);
  const [signInModalAction, setSignInModalAction] = useState('subscribe to this channel');

  // Load all user subscriptions when user logs in or switches
  const loadUserSubscriptions = useCallback(async (pull = false) => {
    if (!user) {
      setSubscribedMap({});
      setCreators([]);
      setFeed([]);
      return;
    }
    if (pull) setRefreshingFeed(true);
    else setLoadingFeed(true);

    try {
      const [subsList, feedList] = await Promise.all([
        fetchSubscriptions().catch(() => []),
        fetchSubscriptionsFeed().catch(() => []),
      ]);

      const newMap: Record<string, boolean> = {};
      const newCounts: Record<string, number> = {};
      subsList.forEach((c) => {
        newMap[c._id] = true;
        newCounts[c._id] = c.subscriberCount;
      });

      setSubscribedMap(newMap);
      setSubscriberCountMap((prev) => ({ ...prev, ...newCounts }));
      setCreators(subsList);
      setFeed(feedList);
    } catch {
      // Non-blocking
    } finally {
      setLoadingFeed(false);
      setRefreshingFeed(false);
    }
  }, [user]);

  useEffect(() => {
    let isCancelled = false;
    if (!user) {
      Promise.resolve().then(() => {
        if (!isCancelled) {
          setSubscribedMap({});
          setCreators([]);
          setFeed([]);
        }
      });
      return () => {
        isCancelled = true;
      };
    }

    Promise.resolve().then(() => {
      if (!isCancelled) {
        setLoadingFeed(true);
      }
    });

    Promise.all([
      fetchSubscriptions().catch(() => []),
      fetchSubscriptionsFeed().catch(() => []),
    ])
      .then(([subsList, feedList]) => {
        if (isCancelled) return;
        const newMap: Record<string, boolean> = {};
        const newCounts: Record<string, number> = {};
        subsList.forEach((c) => {
          newMap[c._id] = true;
          newCounts[c._id] = c.subscriberCount;
        });

        setSubscribedMap(newMap);
        setSubscriberCountMap((prev) => ({ ...prev, ...newCounts }));
        setCreators(subsList);
        setFeed(feedList);
      })
      .finally(() => {
        if (!isCancelled) {
          setLoadingFeed(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [user]);

  const subscribedMapRef = React.useRef<Record<string, boolean>>({});
  const subscriberCountMapRef = React.useRef<Record<string, number>>({});
  const inFlightSubscribes = React.useRef<Set<string>>(new Set());
  const inFlightStatusRef = React.useRef<Map<string, Promise<{ isSubscribed: boolean; subscriberCount: number }>>>(new Map());

  useEffect(() => {
    subscribedMapRef.current = subscribedMap;
  }, [subscribedMap]);

  useEffect(() => {
    subscriberCountMapRef.current = subscriberCountMap;
  }, [subscriberCountMap]);

  const isSubscribed = useCallback(
    (creatorId: string | null | undefined): boolean => {
      if (!creatorId) return false;
      return Boolean(subscribedMap[creatorId]);
    },
    [subscribedMap]
  );

  const getSubscriberCount = useCallback(
    (creatorId: string | null | undefined, fallback = 0): number => {
      if (!creatorId) return Math.max(0, fallback);
      if (subscriberCountMap[creatorId] !== undefined) {
        return Math.max(0, subscriberCountMap[creatorId]);
      }
      return Math.max(0, fallback);
    },
    [subscriberCountMap]
  );

  const isSubscribing = useCallback(
    (creatorId: string | null | undefined): boolean => {
      if (!creatorId) return false;
      return Boolean(subscribingIds[creatorId]);
    },
    [subscribingIds]
  );

  const fetchStatus = useCallback(
    async (creatorId: string) => {
      if (!creatorId) return { isSubscribed: false, subscriberCount: 0 };

      const cachedPromise = inFlightStatusRef.current.get(creatorId);
      if (cachedPromise) return cachedPromise;

      const promise = (async () => {
        try {
          const res = await fetchSubscriptionStatus(creatorId);
          setSubscribedMap((prev) => {
            if (prev[creatorId] === res.isSubscribed) return prev;
            return { ...prev, [creatorId]: res.isSubscribed };
          });
          setSubscriberCountMap((prev) => {
            if (prev[creatorId] === res.subscriberCount) return prev;
            return { ...prev, [creatorId]: res.subscriberCount };
          });
          return res;
        } catch {
          return {
            isSubscribed: Boolean(subscribedMapRef.current[creatorId]),
            subscriberCount: subscriberCountMapRef.current[creatorId] ?? 0,
          };
        } finally {
          inFlightStatusRef.current.delete(creatorId);
        }
      })();

      inFlightStatusRef.current.set(creatorId, promise);
      return promise;
    },
    []
  );

  const executeSubscribe = useCallback(
    async (creatorId: string, creatorName = 'Creator'): Promise<boolean> => {
      if (!user) {
        setSignInModalAction(`subscribe to ${creatorName}`);
        setSignInModalVisible(true);
        return false;
      }

      if (user.id === creatorId) {
        showToast('You cannot subscribe to your own channel');
        return false;
      }

      // Synchronous concurrency lock — guarantees 1 tap triggers 1 request
      if (inFlightSubscribes.current.has(creatorId)) {
        return false;
      }
      inFlightSubscribes.current.add(creatorId);

      setSubscribingIds((prev) => ({ ...prev, [creatorId]: true }));

      // Optimistic update
      setSubscribedMap((prev) => ({ ...prev, [creatorId]: true }));
      setSubscriberCountMap((prev) => ({
        ...prev,
        [creatorId]: (prev[creatorId] || 0) + 1,
      }));
      showToast(`Subscribed to ${creatorName}`);

      try {
        const res = await subscribeToCreator(creatorId);
        setSubscriberCountMap((prev) => ({
          ...prev,
          [creatorId]: Math.max(0, res.subscriberCount),
        }));
        return true;
      } catch {
        // Rollback
        setSubscribedMap((prev) => ({ ...prev, [creatorId]: false }));
        setSubscriberCountMap((prev) => ({
          ...prev,
          [creatorId]: Math.max(0, (prev[creatorId] || 1) - 1),
        }));
        showToast(`Could not subscribe to ${creatorName}. Tap to retry.`, 'error');
        return false;
      } finally {
        inFlightSubscribes.current.delete(creatorId);
        setSubscribingIds((prev) => ({ ...prev, [creatorId]: false }));
      }
    },
    [showToast, user]
  );

  const executeUnsubscribe = useCallback(
    async (creatorId: string, creatorName = 'Creator'): Promise<boolean> => {
      if (!user) return false;
      if (inFlightSubscribes.current.has(creatorId)) return false;
      inFlightSubscribes.current.add(creatorId);

      setSubscribingIds((prev) => ({ ...prev, [creatorId]: true }));

      // Optimistic update
      setSubscribedMap((prev) => ({ ...prev, [creatorId]: false }));
      setSubscriberCountMap((prev) => ({
        ...prev,
        [creatorId]: Math.max(0, (prev[creatorId] || 1) - 1),
      }));
      setCreators((prev) => prev.filter((c) => c._id !== creatorId));
      setFeed((prev) =>
        prev.filter((v) => {
          const cId = typeof v.creator === 'object' && v.creator?._id ? v.creator._id : v.creator;
          return cId !== creatorId;
        })
      );
      showToast(`Unsubscribed from ${creatorName}`);

      try {
        const res = await unsubscribeFromCreator(creatorId);
        setSubscriberCountMap((prev) => ({
          ...prev,
          [creatorId]: Math.max(0, res.subscriberCount),
        }));
        return true;
      } catch {
        // Rollback
        setSubscribedMap((prev) => ({ ...prev, [creatorId]: true }));
        setSubscriberCountMap((prev) => ({
          ...prev,
          [creatorId]: (prev[creatorId] || 0) + 1,
        }));
        showToast(`Could not unsubscribe from ${creatorName}`, 'error');
        return false;
      } finally {
        inFlightSubscribes.current.delete(creatorId);
        setSubscribingIds((prev) => ({ ...prev, [creatorId]: false }));
      }
    },
    [showToast, user]
  );

  // Smart toggle: if already subscribed, prompt with Unsubscribe Confirmation Sheet!
  const toggleSubscribe = useCallback(
    (creator: { id: string; name?: string }) => {
      const creatorName = creator.name || 'Creator';
      if (!user) {
        setSignInModalAction(`subscribe to ${creatorName}`);
        setSignInModalVisible(true);
        return;
      }

      if (user.id === creator.id) {
        showToast('You cannot subscribe to your own channel');
        return;
      }

      if (inFlightSubscribes.current.has(creator.id)) {
        return;
      }

      if (isSubscribed(creator.id)) {
        // Show confirmation sheet on unsubscribe
        setUnsubModalTarget({ id: creator.id, name: creatorName });
      } else {
        void executeSubscribe(creator.id, creatorName);
      }
    },
    [executeSubscribe, isSubscribed, showToast, user]
  );

  const refreshFeed = useCallback(async () => {
    await loadUserSubscriptions(true);
  }, [loadUserSubscriptions]);

  const showSignInModal = useCallback((actionName = 'perform this action') => {
    setSignInModalAction(actionName);
    setSignInModalVisible(true);
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        subscribedMap,
        subscriberCountMap,
        creators,
        feed,
        loadingFeed,
        refreshingFeed,
        isSubscribed,
        getSubscriberCount,
        isSubscribing,
        fetchStatus,
        toggleSubscribe,
        executeSubscribe,
        executeUnsubscribe,
        refreshFeed,
        showSignInModal,
      }}
    >
      {children}

      {/* --- UNPUBLISH / UNSUBSCRIBE CONFIRMATION SHEET MODAL --- */}
      <Modal
        visible={Boolean(unsubModalTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => setUnsubModalTarget(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setUnsubModalTarget(null)}
        >
          <Pressable
            style={[
              styles.sheetContent,
              {
                backgroundColor: C.surface,
                borderColor: C.border,
              },
            ]}
            onPress={(e) => e?.stopPropagation?.()}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={[styles.sheetIconCircle, { backgroundColor: isDark ? '#2a1a1c' : '#fee2e2' }]}>
                <SymbolView
                  name={{ ios: 'bell.slash.fill', android: 'notifications_off', web: 'notifications_off' }}
                  size={26}
                  tintColor={Design.color.danger}
                />
              </View>
              <Text style={[styles.sheetTitle, { color: C.text }]}>
                Unsubscribe from {unsubModalTarget?.name || 'this channel'}?
              </Text>
              <Text style={[styles.sheetSubtitle, { color: C.secondary }]}>
                You will no longer receive new video uploads or updates from this creator in your Subscriptions feed.
              </Text>
            </View>

            <View style={styles.sheetActions}>
              <Pressable
                style={[
                  styles.sheetBtnSecondary,
                  { backgroundColor: C.surfaceRaised, borderColor: C.border },
                ]}
                onPress={() => setUnsubModalTarget(null)}
              >
                <Text style={[styles.sheetBtnSecondaryText, { color: C.text }]}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.sheetBtnPrimary, { backgroundColor: Design.color.danger }]}
                onPress={() => {
                  if (unsubModalTarget) {
                    const { id, name } = unsubModalTarget;
                    setUnsubModalTarget(null);
                    void executeUnsubscribe(id, name);
                  }
                }}
              >
                <Text style={styles.sheetBtnPrimaryText}>Unsubscribe</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* --- SIGN-IN PROMPT SHEET FOR LOGGED-OUT USERS --- */}
      <Modal
        visible={signInModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSignInModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSignInModalVisible(false)}
        >
          <Pressable
            style={[
              styles.sheetContent,
              {
                backgroundColor: C.surface,
                borderColor: C.border,
              },
            ]}
            onPress={(e) => e?.stopPropagation?.()}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View style={[styles.sheetIconCircle, { backgroundColor: isDark ? Design.color.accentSurface : '#fee2e2' }]}>
                <SymbolView
                  name={{ ios: 'person.crop.circle.badge.plus', android: 'account_circle', web: 'account_circle' }}
                  size={28}
                  tintColor={Design.color.accent}
                />
              </View>
              <Text style={[styles.sheetTitle, { color: C.text }]}>
                Want to {signInModalAction}?
              </Text>
              <Text style={[styles.sheetSubtitle, { color: C.secondary }]}>
                Sign in to subscribe to creators, like videos, save to Watch Later, and build your personalized video library.
              </Text>
            </View>

            <View style={styles.sheetActions}>
              <Pressable
                style={[
                  styles.sheetBtnSecondary,
                  { backgroundColor: C.surfaceRaised, borderColor: C.border },
                ]}
                onPress={() => setSignInModalVisible(false)}
              >
                <Text style={[styles.sheetBtnSecondaryText, { color: C.text }]}>Not Now</Text>
              </Pressable>

              <Pressable
                style={[styles.sheetBtnPrimary, { backgroundColor: Design.color.accent }]}
                onPress={() => {
                  setSignInModalVisible(false);
                  router.push('/auth');
                }}
              >
                <Text style={styles.sheetBtnPrimaryText}>Sign In</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 24,
  },
  sheetContent: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 22,
    borderWidth: 1,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(150,150,150,0.3)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: 20,
  },
  sheetIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  sheetBtnSecondary: {
    flex: 1,
    minHeight: 46,
    borderRadius: Design.radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnSecondaryText: {
    fontSize: 14,
    fontWeight: '700',
  },
  sheetBtnPrimary: {
    flex: 1,
    minHeight: 46,
    borderRadius: Design.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
