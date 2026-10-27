import { useEffect, useRef, type ElementRef } from 'react';
import { ScrollView, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Pressable, Text, View } from '@/components/theme-native';
import { Design } from '@/constants/design';
import { FEED_CATEGORIES } from '@/constants/categories';
import { useThemeMode } from '@/contexts/theme-context';

type CategoryChipBarProps = {
  categories?: readonly string[] | string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
};

export function CategoryChipBar({
  categories = FEED_CATEGORIES,
  selectedCategory,
  onSelectCategory,
}: CategoryChipBarProps) {
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const scrollViewRef = useRef<ElementRef<typeof ScrollView> | null>(null);
  const chipLayoutsRef = useRef<Record<string, { x: number; width: number }>>({});

  useEffect(() => {
    const layout = chipLayoutsRef.current[selectedCategory];
    if (layout && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: Math.max(0, layout.x - 24),
        animated: true,
      });
    }
  }, [selectedCategory]);

  const handleChipLayout = (category: string, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    chipLayoutsRef.current[category] = { x, width };
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        accessibilityRole="tablist"
      >
        {categories.map((category) => {
          const isSelected = selectedCategory === category;
          return (
            <Pressable
              key={category}
              accessibilityRole="tab"
              accessibilityLabel={`Filter by ${category}`}
              accessibilityState={{ selected: isSelected }}
              onLayout={(e) => handleChipLayout(category, e)}
              onPress={() => onSelectCategory(category)}
              style={({ pressed }) => [
                styles.chip,
                isDark ? styles.chipDark : styles.chipLight,
                isSelected && (isDark ? styles.chipSelectedDark : styles.chipSelectedLight),
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  isDark ? styles.chipTextDark : styles.chipTextLight,
                  isSelected && (isDark ? styles.chipTextSelectedDark : styles.chipTextSelectedLight),
                ]}
              >
                {category}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Design.radius.pill,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipDark: {
    backgroundColor: Design.color.surfaceRaised,
    borderColor: Design.color.border,
  },
  chipLight: {
    backgroundColor: Design.light.surfaceRaised,
    borderColor: Design.light.border,
  },
  chipSelectedDark: {
    backgroundColor: Design.color.text,
    borderColor: Design.color.text,
  },
  chipSelectedLight: {
    backgroundColor: Design.light.text,
    borderColor: Design.light.text,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  chipTextDark: {
    color: Design.color.secondary,
  },
  chipTextLight: {
    color: Design.light.secondary,
  },
  chipTextSelectedDark: {
    color: Design.color.background,
    fontWeight: '700',
  },
  chipTextSelectedLight: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
