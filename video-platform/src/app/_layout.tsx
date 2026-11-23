
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { ThemeModeProvider, useThemeMode } from '@/contexts/theme-context';
import { ToastProvider } from '@/contexts/toast-context';
import { SubscriptionProvider } from '@/contexts/subscription-context';
import { NotificationProvider } from '@/contexts/notification-context';
import { SettingsProvider } from '@/contexts/settings-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ThemeModeProvider>
            <ToastProvider>
              <AccountScopedProviders />
            </ToastProvider>
          </ThemeModeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Remount private client state when the authenticated account changes so no
// account-scoped context or screen cache survives an account switch.
function AccountScopedProviders() {
  const { user } = useAuth();
  const accountKey = user?.id ?? 'signed-out';
  return (
    <SubscriptionProvider key={`subscriptions-${accountKey}`}>
      <NotificationProvider key={`notifications-${accountKey}`}>
        <SettingsProvider key={`settings-${accountKey}`}>
          <AppNavigator />
        </SettingsProvider>
      </NotificationProvider>
    </SubscriptionProvider>
  );
}

function AppNavigator() {
  const { mode } = useThemeMode();
  return <ThemeProvider value={mode === 'dark' ? DarkTheme : DefaultTheme}>
    <AnimatedSplashOverlay />
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="explore" />
      <Stack.Screen name="main" />
      <Stack.Screen name="upload" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="watch" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="change-password" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="admin" />
    </Stack>
  </ThemeProvider>;
}
