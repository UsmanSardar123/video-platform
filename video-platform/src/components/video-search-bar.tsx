import { StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { TextInput, View } from '@/components/theme-native';
import { Design } from '@/constants/design';

export function VideoSearchBar({ value, onChangeText, placeholder = 'Search videos or creators' }: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  return <View style={styles.container}>
    <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={19} tintColor={Design.color.muted} />
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#999"
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType="search"
      accessibilityLabel="Search videos"
      maxLength={120}
      selectionColor={Design.color.accent}
    />
  </View>;
}

const styles = StyleSheet.create({
  container: { minHeight: 50, borderWidth: 1, borderColor: Design.color.border, borderRadius: Design.radius.sm, backgroundColor: Design.color.surface, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginBottom: 18 },
  input: { flex: 1, color: Design.color.text, paddingVertical: 12, fontSize: 14 },
});
