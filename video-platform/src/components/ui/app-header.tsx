import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Design } from '@/constants/design';
import { useAuth } from '@/contexts/auth-context';
import { useNotifications } from '@/contexts/notification-context';
import { useDesignTheme } from '@/contexts/theme-context';
import { Avatar } from './avatar';

export type AppHeaderProps = {
  /** Leave undefined to show the Streanub brand mark + wordmark */
  title?: string;
  showSearch?: boolean;
  showNotifications?: boolean;
  showAvatar?: boolean;
  showThemeToggle?: boolean;
  onSearchPress?: () => void;
  rightSlot?: ReactNode;
  bordered?: boolean;
};

export function AppHeader({
  title,
  showSearch = true,
  showNotifications = true,
  showAvatar = true,
  showThemeToggle = false,
  onSearchPress,
  rightSlot,
  bordered = false,
}: AppHeaderProps) {
  const { colors, isDark, toggleTheme } = useDesignTheme();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  const handleSearch = () => {
    if (onSearchPress) {
      onSearchPress();
    } else {
      router.push('/explore');
    }
  };

  const handleAvatarPress = () => {
    if (user) {
      router.push('/main/profile');
    } else {
      router.push('/auth');
    }
  };

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.background },
        bordered && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      {/* Left: Brand or Screen Title */}
      {title ? (
        <View style={styles.titleRow}>
          <Text style={[styles.screenTitle, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      ) : (
        <View style={styles.brandRow}>
          <View style={[styles.logoMark, { backgroundColor: colors.accent }]}>
            <SymbolView
              name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
              size={15}
              tintColor="#ffffff"
            />
          </View>
          <Text style={[styles.brandTitle, { color: colors.text }]}>Streanub</Text>
        </View>
      )}

      {/* Right: Mobile Utility Icons */}
      <View style={styles.actions}>
        {rightSlot}

        {showThemeToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Switch to ${isDark ? 'light' : 'dark'} theme`}
            onPress={toggleTheme}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            hitSlop={4}
          >
            <SymbolView
              name={
                isDark
                  ? { ios: 'sun.max.fill', android: 'light_mode', web: 'light_mode' }
                  : { ios: 'moon.fill', android: 'dark_mode', web: 'dark_mode' }
              }
              size={20}
              tintColor={colors.text}
            />
          </Pressable>
        ) : null}

        {showNotifications ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
            }
            onPress={() => router.push('/notifications')}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            hitSlop={4}
          >
            <SymbolView
              name={{ ios: 'bell', android: 'notifications_none', web: 'notifications_none' }}
              size={22}
              tintColor={colors.text}
            />
            {unreadCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: colors.accent, borderColor: colors.background }]}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}

        {showSearch ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search videos and creators"
            onPress={handleSearch}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            hitSlop={4}
          >
            <SymbolView
              name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
              size={22}
              tintColor={colors.text}
            />
          </Pressable>
        ) : null}

        {showAvatar ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={user ? 'Open your profile' : 'Sign in'}
            onPress={handleAvatarPress}
            style={({ pressed }) => [styles.avatarBtn, pressed && styles.pressed]}
            hitSlop={4}
          >
            {user ? (
              <Avatar
                uri={user.avatar}
                name={user.fullName || user.username}
                size={30}
                borderColor={colors.border}
              />
            ) : (
              <View
                style={[
                  styles.guestCircle,
                  { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
                ]}
              >
                <SymbolView
                  name={{ ios: 'person.fill', android: 'person', web: 'person' }}
                  size={16}
                  tintColor={colors.secondary}
                />
              </View>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: Design.touch.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoMark: {
    width: 30,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  titleRow: {
    flex: 1,
    paddingRight: 12,
  },
  screenTitle: {
    ...Design.typography.title,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: Design.touch.iconButton,
    height: Design.touch.iconButton,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarBtn: {
    width: Design.touch.iconButton,
    height: Design.touch.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 3,
    right: 2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1.5,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.72,
  },
});
