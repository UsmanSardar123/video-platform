import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs, usePathname } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Avatar, CreateSheet } from '@/components/ui';
import { Design } from '@/constants/design';
import { useAuth } from '@/contexts/auth-context';
import { useNotifications } from '@/contexts/notification-context';
import { useDesignTheme } from '@/contexts/theme-context';

const ICONS = {
  home: {
    active: { ios: 'house.fill', android: 'home', web: 'home' },
    inactive: { ios: 'house', android: 'home', web: 'home' },
  },
  shorts: {
    active: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' },
    inactive: { ios: 'bolt', android: 'bolt', web: 'bolt' },
  },
  subscriptions: {
    active: { ios: 'play.square.stack.fill', android: 'subscriptions', web: 'subscriptions' },
    inactive: { ios: 'play.square.stack', android: 'subscriptions', web: 'subscriptions' },
  },
  profile: {
    active: { ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' },
    inactive: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
  },
} as const;

export default function MainLayout() {
  const { colors, isDark } = useDesignTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { refreshUnreadCount } = useNotifications();
  const [createSheetOpen, setCreateSheetOpen] = useState(false);

  useEffect(() => {
    void refreshUnreadCount();
  }, [pathname, refreshUnreadCount]);

  const bottomInset = Math.max(insets.bottom, 6);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Tabs
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          animation: 'shift',
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.muted,
          tabBarHideOnKeyboard: true,
          tabBarLabelStyle: styles.label,
          tabBarItemStyle: styles.item,
          tabBarStyle: [
            styles.bar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              height: Design.touch.tabBarHeight + bottomInset,
              paddingBottom: bottomInset,
            },
          ],
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarAccessibilityLabel: 'Home tab',
            tabBarIcon: ({ color, focused }) => (
              <SymbolView
                name={focused ? ICONS.home.active : ICONS.home.inactive}
                tintColor={focused ? colors.accent : color}
                size={23}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="shorts"
          options={{
            title: 'Shorts',
            tabBarAccessibilityLabel: 'Shorts tab',
            tabBarIcon: ({ color, focused }) => (
              <SymbolView
                name={focused ? ICONS.shorts.active : ICONS.shorts.inactive}
                tintColor={focused ? colors.accent : color}
                size={23}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="create"
          options={{
            title: '',
            tabBarLabel: () => null,
            tabBarButton: ({ accessibilityState }) => (
              <View style={styles.createSlot}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Create video or Short"
                  accessibilityState={accessibilityState}
                  onPress={() => setCreateSheetOpen(true)}
                  style={({ pressed }) => [
                    styles.createBtn,
                    {
                      backgroundColor: isDark ? colors.surfaceRaised : colors.surfaceElevated,
                      borderColor: colors.border,
                    },
                    pressed && styles.createBtnPressed,
                  ]}
                >
                  <SymbolView
                    name={{ ios: 'plus', android: 'add', web: 'add' }}
                    tintColor={colors.text}
                    size={24}
                  />
                </Pressable>
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="subscriptions"
          options={{
            title: 'Subscriptions',
            tabBarAccessibilityLabel: 'Subscriptions tab',
            tabBarIcon: ({ color, focused }) => (
              <SymbolView
                name={focused ? ICONS.subscriptions.active : ICONS.subscriptions.inactive}
                tintColor={focused ? colors.accent : color}
                size={23}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="profile"
          options={{
            title: 'You',
            tabBarAccessibilityLabel: 'You tab',
            tabBarIcon: ({ color, focused }) =>
              user ? (
                <Avatar
                  uri={user.avatar}
                  name={user.fullName || user.username}
                  size={24}
                  borderColor={focused ? colors.accent : colors.border}
                />
              ) : (
                <SymbolView
                  name={focused ? ICONS.profile.active : ICONS.profile.inactive}
                  tintColor={focused ? colors.accent : color}
                  size={23}
                />
              ),
          }}
        />

        {/* Hidden routes preserved for deep links and top-bar Search navigation */}
        <Tabs.Screen name="explore" options={{ href: null }} />
        <Tabs.Screen name="edit-profile" options={{ href: null }} />
      </Tabs>

      <CreateSheet visible={createSheetOpen} onClose={() => setCreateSheetOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  item: {
    paddingVertical: 2,
  },
  createSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.94 }],
  },
});
