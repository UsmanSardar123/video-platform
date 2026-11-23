import { useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useDesignTheme } from '@/contexts/theme-context';

export type AvatarProps = {
  uri?: string | null;
  name?: string | null;
  size?: number;
  verified?: boolean;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
};

function getInitials(name?: string | null): string {
  const clean = (name || '').trim().replace(/^@/, '');
  if (!clean) return 'U';
  const parts = clean.split(/\s+/);
  if (parts.length >= 2 && parts[0][0] && parts[1][0]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.charAt(0).toUpperCase();
}

export function Avatar({ uri, name, size = 38, verified = false, borderColor, style }: AvatarProps) {
  const { colors, isDark } = useDesignTheme();
  const [failed, setFailed] = useState(false);

  const cleanUri = uri?.trim() || '';
  const showImage = Boolean(cleanUri) && !failed;
  const radius = size / 2;
  const fontSize = Math.max(11, Math.round(size * 0.37));
  const badgeSize = Math.max(14, Math.round(size * 0.36));

  return (
    <View style={[styles.wrap, { width: size, height: size }, style]}>
      {showImage ? (
        <Image
          source={{ uri: cleanUri }}
          style={[
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: colors.surfaceRaised,
            },
            borderColor ? { borderWidth: 1.5, borderColor } : undefined,
          ]}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: isDark ? '#232b36' : '#dbe3ee',
            },
            borderColor ? { borderWidth: 1.5, borderColor } : undefined,
          ]}
        >
          <Text style={[styles.initials, { color: colors.text, fontSize }]} numberOfLines={1}>
            {getInitials(name)}
          </Text>
        </View>
      )}
      {verified ? (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <SymbolView
            name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }}
            size={Math.max(10, badgeSize - 3)}
            tintColor={colors.accent}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
