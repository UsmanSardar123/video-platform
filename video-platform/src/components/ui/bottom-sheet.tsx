import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Design } from '@/constants/design';
import { useDesignTheme } from '@/contexts/theme-context';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: number;
};

export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 540,
}: BottomSheetProps) {
  const { colors, isDark } = useDesignTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.overlay, { backgroundColor: colors.backdrop }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close sheet"
          />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 16) + 8,
                maxWidth,
              },
              !isDark && Design.shadow.lg,
            ]}
          >
            <View style={[styles.handle, { backgroundColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.18)' }]} />

            {title || subtitle ? (
              <View style={[styles.header, { borderBottomColor: colors.divider }]}>
                {title ? (
                  <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                    {title}
                  </Text>
                ) : null}
                {subtitle ? (
                  <Text style={[styles.subtitle, { color: colors.muted }]} numberOfLines={2}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <View style={styles.body}>{children}</View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardWrap: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: Design.radius.xl,
    borderTopRightRadius: Design.radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingHorizontal: 16,
    elevation: 16,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  title: {
    ...Design.typography.heading,
  },
  subtitle: {
    ...Design.typography.caption,
  },
  body: {
    width: '100%',
  },
});
