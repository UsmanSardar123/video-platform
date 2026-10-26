import type { ComponentProps } from 'react';
import { ActivityIndicator as NativeActivityIndicator, Pressable as NativePressable, ScrollView as NativeScrollView, StatusBar as NativeStatusBar, StyleSheet, Text as NativeText, TextInput as NativeTextInput, View as NativeView, type ActivityIndicatorProps, type PressableStateCallbackType } from 'react-native';
import { SafeAreaView as NativeSafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { themeStyle, useThemeMode } from '@/contexts/theme-context';
import { Design } from '@/constants/design';

export function Text({ style, ...props }: ComponentProps<typeof NativeText>) {
  const { mode } = useThemeMode();
  return <NativeText {...props} style={themeStyle(style, mode)} />;
}

export function View({ style, ...props }: ComponentProps<typeof NativeView>) {
  const { mode } = useThemeMode();
  return <NativeView {...props} style={themeStyle(style, mode)} />;
}

export function Pressable({ style, ...props }: ComponentProps<typeof NativePressable>) {
  const { mode } = useThemeMode();
  const themedStyle = typeof style === 'function'
    ? (state: PressableStateCallbackType) => themeStyle(style(state), mode)
    : themeStyle(style, mode);
  return <NativePressable {...props} style={themedStyle} />;
}

export function TextInput({ style, placeholderTextColor, ...props }: ComponentProps<typeof NativeTextInput>) {
  const { mode } = useThemeMode();
  const placeholder = placeholderTextColor ? themeStyle({ color: placeholderTextColor }, mode).color : undefined;
  return <NativeTextInput {...props} placeholderTextColor={placeholder} style={themeStyle(style, mode)} />;
}

export function ScrollView({ style, contentContainerStyle, ...props }: ComponentProps<typeof NativeScrollView>) {
  const { mode } = useThemeMode();
  return <NativeScrollView {...props} style={themeStyle(style, mode)} contentContainerStyle={themeStyle(contentContainerStyle, mode)} />;
}

export function SafeAreaView({ style, ...props }: ComponentProps<typeof NativeSafeAreaView>) {
  const { mode } = useThemeMode();
  return <NativeSafeAreaView {...props} style={themeStyle(style, mode)} />;
}

export function StatusBar(props: ComponentProps<typeof NativeStatusBar>) {
  const { mode } = useThemeMode();
  return <NativeStatusBar {...props} barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />;
}

export function ActivityIndicator(props: ActivityIndicatorProps) {
  const { mode } = useThemeMode();
  const color = props.color ? themeStyle({ color: props.color }, mode).color : undefined;
  return <NativeActivityIndicator {...props} color={color} />;
}

export function ThemeToggleButton() {
  const { mode, toggleTheme } = useThemeMode();
  const icon = mode === 'dark'
    ? { ios: 'sun.max.fill', android: 'light_mode', web: 'light_mode' } as const
    : { ios: 'moon.fill', android: 'dark_mode', web: 'dark_mode' } as const;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`} style={styles.themeButton} onPress={toggleTheme}>
    <SymbolView name={icon} size={18} tintColor={Design.color.accent} />
  </Pressable>;
}

const styles = StyleSheet.create({
  themeButton: { minWidth: 44, minHeight: 44, paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center', borderRadius: Design.radius.sm, backgroundColor: Design.color.surfaceRaised, borderWidth: 1, borderColor: Design.color.border },
});
