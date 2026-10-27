import { SymbolView } from 'expo-symbols';
import { router, Tabs, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Keyboard,
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';
import { Design } from '@/constants/design';
import { useThemeMode } from '@/contexts/theme-context';
import { useNotifications } from '@/contexts/notification-context';
import {
  calculateNextTab,
  getTabIndexFromPathname,
  isInsideHorizontalScroll,
  shouldSwipeTrigger,
} from '@/lib/swipe-navigation';

const icons = {
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  subscriptions: { ios: 'play.square.stack.fill', android: 'subscriptions', web: 'subscriptions' },
  explore: { ios: 'safari.fill', android: 'explore', web: 'explore' },
  profile: { ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' },
} as const;

let activeSwipeMoveHandler: ((evt: any, gestureState: any) => boolean) | null = null;
let activeSwipeReleaseHandler: ((evt: any, gestureState: any) => void) | null = null;

const swipePanResponder = PanResponder.create({
  onStartShouldSetPanResponder: () => false,
  onStartShouldSetPanResponderCapture: () => false,
  onMoveShouldSetPanResponderCapture: () => false,
  onMoveShouldSetPanResponder: (evt, gestureState) => {
    return activeSwipeMoveHandler ? activeSwipeMoveHandler(evt, gestureState) : false;
  },
  onPanResponderGrant: () => {},
  onPanResponderRelease: (evt, gestureState) => {
    if (activeSwipeReleaseHandler) {
      activeSwipeReleaseHandler(evt, gestureState);
    }
  },
  onPanResponderTerminate: () => {},
});

export default function MainLayout() {
  const { mode } = useThemeMode();
  const colors = mode === 'dark' ? Design.color : Design.light;
  const pathname = usePathname();
  const { refreshUnreadCount } = useNotifications();

  useEffect(() => {
    void refreshUnreadCount();
  }, [pathname, refreshUnreadCount]);

  const isKeyboardOpenRef = useRef(false);
  const isNavigatingRef = useRef(false);
  const lastNavTimeRef = useRef(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      isKeyboardOpenRef.current = true;
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      isKeyboardOpenRef.current = false;
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    activeSwipeMoveHandler = (evt, gestureState) => {
      const now = Date.now();
      if (now - lastNavTimeRef.current < 350) return false;

      return shouldSwipeTrigger({
        pathname,
        dx: gestureState.dx,
        dy: gestureState.dy,
        isKeyboardOpen: isKeyboardOpenRef.current,
        isInsideHorizontalElement: isInsideHorizontalScroll(evt.nativeEvent?.target),
      });
    };

    activeSwipeReleaseHandler = (_evt, gestureState) => {
      if (isNavigatingRef.current) return;

      const now = Date.now();
      if (now - lastNavTimeRef.current < 350) return;

      const currentIndex = getTabIndexFromPathname(pathname);
      if (currentIndex < 0) return;

      const nextRoute = calculateNextTab(currentIndex, gestureState.dx, gestureState.vx);
      if (nextRoute) {
        isNavigatingRef.current = true;
        lastNavTimeRef.current = now;
        router.navigate(nextRoute as any);
        setTimeout(() => {
          isNavigatingRef.current = false;
        }, 350);
      }
    };

    return () => {
      activeSwipeMoveHandler = null;
      activeSwipeReleaseHandler = null;
    };
  }, [pathname]);

  return (
    <View style={styles.container} {...swipePanResponder.panHandlers}>
      <Tabs
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          animation: 'shift',
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          tabBarHideOnKeyboard: true,
          tabBarLabelStyle: styles.label,
          tabBarItemStyle: styles.item,
          tabBarStyle: [styles.bar, {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          }],
        }}>
        <Tabs.Screen name="index" options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home tab',
          tabBarIcon: ({ color, size }) => <SymbolView name={icons.home} tintColor={color} size={size} />,
        }} />
        <Tabs.Screen name="subscriptions" options={{
          title: 'Subscriptions',
          tabBarAccessibilityLabel: 'Subscriptions tab',
          tabBarIcon: ({ color, size }) => <SymbolView name={icons.subscriptions} tintColor={color} size={size} />,
        }} />
        <Tabs.Screen name="explore" options={{
          title: 'Explore',
          tabBarAccessibilityLabel: 'Explore videos tab',
          tabBarIcon: ({ color, size }) => <SymbolView name={icons.explore} tintColor={color} size={size} />,
        }} />
        <Tabs.Screen name="profile" options={{
          title: 'You',
          tabBarAccessibilityLabel: 'You tab',
          tabBarIcon: ({ color, size }) => <SymbolView name={icons.profile} tintColor={color} size={size} />,
        }} />
        <Tabs.Screen name="edit-profile" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 5,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
  },
  label: { fontSize: 11, fontWeight: '700' },
  item: { minHeight: 54 },
});
