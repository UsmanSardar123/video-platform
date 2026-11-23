import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Design } from '@/constants/design';
import { useAuth } from '@/contexts/auth-context';
import { useDesignTheme } from '@/contexts/theme-context';
import { BottomSheet } from './bottom-sheet';

export type CreateSheetProps = {
  visible: boolean;
  onClose: () => void;
};

export function CreateSheet({ visible, onClose }: CreateSheetProps) {
  const { user } = useAuth();
  const { colors, isDark } = useDesignTheme();

  const isCreator = user?.role === 'creator';

  const navigateAndClose = (path: '/upload' | '/auth' | '/main/profile' | '/settings', params?: Record<string, string>) => {
    onClose();
    if (params) {
      router.push({ pathname: path, params });
    } else {
      router.push(path);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Create"
      subtitle={
        !user
          ? 'Sign in to publish videos and manage your channel'
          : isCreator
          ? 'Choose how you want to publish to Streanub'
          : 'Creator access is required to publish videos'
      }
    >
      {!user ? (
        <View style={styles.infoBlock}>
          <View style={[styles.infoIcon, { backgroundColor: colors.accentSurface }]}>
            <SymbolView
              name={{ ios: 'video.badge.plus', android: 'video_call', web: 'video_call' }}
              size={28}
              tintColor={colors.accent}
            />
          </View>
          <Text style={[styles.infoTitle, { color: colors.text }]}>Share your videos on Streanub</Text>
          <Text style={[styles.infoSubtitle, { color: colors.muted }]}>
            Sign in or create an account to upload videos, subscribe to creators, and build playlists.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in to create"
            onPress={() => navigateAndClose('/auth', { returnTo: '/upload' })}
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: colors.accent },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.primaryText}>Sign In / Create Account</Text>
          </Pressable>
        </View>
      ) : isCreator ? (
        <View style={styles.optionsList}>
          <CreateOptionRow
            icon={{ ios: 'arrow.up.circle.fill', android: 'upload', web: 'upload' }}
            title="Upload a video"
            subtitle="Choose an MP4, MOV, or WebM from your device"
            accent
            isDark={isDark}
            colors={colors}
            onPress={() => navigateAndClose('/upload')}
          />
          <CreateOptionRow
            icon={{ ios: 'bolt.fill', android: 'bolt', web: 'bolt' }}
            title="Create a Short"
            subtitle="Upload a vertical clip under 60 seconds"
            isDark={isDark}
            colors={colors}
            onPress={() => navigateAndClose('/upload', { mode: 'short' })}
          />
          <CreateOptionRow
            icon={{ ios: 'link', android: 'link', web: 'link' }}
            title="Share a video link"
            subtitle="Import a supported YouTube, Vimeo, or Twitch video"
            isDark={isDark}
            colors={colors}
            onPress={() => navigateAndClose('/upload', { mode: 'external' })}
          />
        </View>
      ) : (
        <View style={styles.infoBlock}>
          <View style={[styles.infoIcon, { backgroundColor: colors.surfaceRaised }]}>
            <SymbolView
              name={{ ios: 'person.crop.rectangle.stack', android: 'video_library', web: 'video_library' }}
              size={28}
              tintColor={colors.accent}
            />
          </View>
          <Text style={[styles.infoTitle, { color: colors.text }]}>Creator account required</Text>
          <Text style={[styles.infoSubtitle, { color: colors.muted }]}>
            Your account (@{user.username}) currently has viewer access. Ask an administrator to enable creator access to upload videos.
          </Text>
          <View style={styles.rowButtons}>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigateAndClose('/main/profile')}
              style={({ pressed }) => [
                styles.secondaryBtn,
                { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.secondaryText, { color: colors.text }]}>Go to You</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigateAndClose('/settings')}
              style={({ pressed }) => [
                styles.secondaryBtn,
                { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.secondaryText, { color: colors.text }]}>Settings</Text>
            </Pressable>
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

function CreateOptionRow({
  icon,
  title,
  subtitle,
  accent,
  isDark,
  colors,
  onPress,
}: {
  icon: { ios: string; android: string; web: string };
  title: string;
  subtitle: string;
  accent?: boolean;
  isDark: boolean;
  colors: typeof Design.color | typeof Design.light;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        pressed && {
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
        },
      ]}
    >
      <View
        style={[
          styles.optionIcon,
          { backgroundColor: accent ? colors.accentSurface : colors.surfaceRaised },
        ]}
      >
        <SymbolView
          name={icon as any}
          size={22}
          tintColor={accent ? colors.accent : colors.text}
        />
      </View>
      <View style={styles.optionText}>
        <Text style={[styles.optionTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.optionSubtitle, { color: colors.muted }]}>{subtitle}</Text>
      </View>
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        size={16}
        tintColor={colors.muted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  optionsList: {
    gap: 4,
    paddingVertical: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 60,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: Design.radius.md,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    ...Design.typography.subheading,
  },
  optionSubtitle: {
    ...Design.typography.caption,
  },
  infoBlock: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 10,
  },
  infoIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  infoTitle: {
    ...Design.typography.heading,
    textAlign: 'center',
  },
  infoSubtitle: {
    ...Design.typography.body,
    textAlign: 'center',
    maxWidth: 340,
  },
  primaryBtn: {
    width: '100%',
    minHeight: 46,
    borderRadius: Design.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 8,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: Design.radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    ...Design.typography.bodyStrong,
  },
  pressed: {
    opacity: 0.85,
  },
});
