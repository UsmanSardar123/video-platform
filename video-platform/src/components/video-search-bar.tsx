import { StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { TextInput, View } from '@/components/theme-native';
import { Design } from '@/constants/design';
import { useThemeMode } from '@/contexts/theme-context';

export function VideoSearchBar({ value, onChangeText, placeholder = 'Search videos or creators' }: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const C = isDark ? Design.color : Design.light;

  return (
    <View style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}>
      <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={19} tintColor={C.muted} />
      <TextInput
        style={[styles.input, { color: C.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search videos"
        maxLength={120}
        selectionColor={C.accent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: Design.radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  containerDark: {
    backgroundColor: Design.color.surface,
    borderColor: Design.color.border,
  },
  containerLight: {
    backgroundColor: Design.light.surface,
    borderColor: Design.light.border,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
  },
});
