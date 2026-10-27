
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/contexts/auth-context';
import { ThemeModeProvider, useThemeMode } from '@/contexts/theme-context';
import { ToastProvider } from '@/contexts/toast-context';
import { SubscriptionProvider } from '@/contexts/subscription-context';
import { NotificationProvider } from '@/contexts/notification-context';
import { SettingsProvider } from '@/contexts/settings-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeModeProvider>
        <ToastProvider>
          <SubscriptionProvider>
            <NotificationProvider>
              <SettingsProvider>
                <AppNavigator />
              </SettingsProvider>
            </NotificationProvider>
          </SubscriptionProvider>
        </ToastProvider>
      </ThemeModeProvider>
    </AuthProvider>
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
    </Stack>
  </ThemeProvider>;
}
