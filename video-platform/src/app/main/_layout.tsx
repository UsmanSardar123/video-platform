import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Design } from '@/constants/design';
import { useThemeMode } from '@/contexts/theme-context';

const icons = {
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  explore: { ios: 'safari.fill', android: 'explore', web: 'explore' },
  profile: { ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' },
} as const;

export default function MainLayout() {
  const { mode } = useThemeMode();
  const colors = mode === 'dark' ? Design.color : Design.light;

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
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
      <Tabs.Screen name="explore" options={{
        title: 'Explore',
        tabBarAccessibilityLabel: 'Explore videos tab',
        tabBarIcon: ({ color, size }) => <SymbolView name={icons.explore} tintColor={color} size={size} />,
      }} />
      <Tabs.Screen name="profile" options={{
        title: 'Profile',
        tabBarAccessibilityLabel: 'Profile tab',
        tabBarIcon: ({ color, size }) => <SymbolView name={icons.profile} tintColor={color} size={size} />,
      }} />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
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
