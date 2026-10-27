import { useState, useEffect } from 'react';
import {
  Alert,
  BackHandler,
  Modal,
  Platform,
  StyleSheet,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  ThemeToggleButton,
  View,
} from '@/components/theme-native';
import { Design } from '@/constants/design';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode, type ThemePreference } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import { useSettings } from '@/contexts/settings-context';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { mode, preference, setPreference } = useThemeMode();
  const { settings, updateSettings, clearLocalCache, clearWatchHistory } = useSettings();
  const { showToast } = useToast();
  const isDark = mode === 'dark';
  const C = isDark ? Design.color : Design.light;

  const [clearingHistory, setClearingHistory] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  // Android hardware back button support
  useEffect(() => {
    const onBackPress = () => {
      router.back();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  const handleClearHistory = () => {
    Alert.alert(
      'Clear Watch History',
      'This will clear your video watch history from all devices where you are signed in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear History',
          style: 'destructive',
          onPress: async () => {
            setClearingHistory(true);
            try {
              await clearWatchHistory();
              showToast('Watch history cleared successfully.');
            } catch (err: any) {
              showToast(err?.message || 'Failed to clear watch history.', 'error');
            } finally {
              setClearingHistory(false);
            }
          },
        },
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Local Cache',
      'This clears temporary video and image caches stored locally on this device. Uploaded videos and account data will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          onPress: async () => {
            setClearingCache(true);
            try {
              await clearLocalCache();
              showToast('Temporary device cache cleared.');
            } catch {
              showToast('Temporary cache cleared.');
            } finally {
              setClearingCache(false);
            }
          },
        },
      ]
    );
  };

  const handleOpenLink = async (title: string, fallbackUrl?: string) => {
    if (fallbackUrl) {
      try {
        await WebBrowser.openBrowserAsync(fallbackUrl);
        return;
      } catch {
        // Fallback
      }
    }
    Alert.alert(
      title,
      `Streanub terms and community guidelines apply. Contact support@streanub.com for inquiries.`
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of Streanub?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              showToast('Signed out successfully.');
              router.replace('/main');
            } catch (err: any) {
              showToast(err?.message || 'Error signing out', 'error');
            }
          },
        },
      ]
    );
  };

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  const themeLabelMap: Record<ThemePreference, string> = {
    system: 'Use device theme',
    dark: 'Dark theme',
    light: 'Light theme',
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: C.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to previous screen"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <SymbolView
            name={{ ios: 'chevron.backward', android: 'arrow_back', web: 'arrow_back' }}
            size={22}
            tintColor={C.text}
          />
        </Pressable>
        <Text style={[styles.title, { color: C.text }]}>Settings</Text>
        <ThemeToggleButton />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ========================================================
            1. ACCOUNT SECTION
            ======================================================== */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.accent }]}>ACCOUNT AND PROFILE</Text>
        </View>

        {user ? (
          <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }, !isDark && Design.shadow.sm]}>
            {/* User Profile Summary */}
            <View style={styles.userHeader}>
              {user.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View
                  style={[
                    styles.avatarFallback,
                    { backgroundColor: isDark ? Design.color.accentSurface : '#fee2e2' },
                  ]}
                >
                  <Text style={[styles.initial, { color: Design.color.accent }]}>
                    {(user.fullName || user.username).charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: C.text }]} numberOfLines={1}>
                  {user.fullName || user.username}
                </Text>
                <Text style={[styles.userHandle, { color: C.muted }]} numberOfLines={1}>
                  @{user.username}
                </Text>
                <Text style={[styles.userEmail, { color: C.muted }]} numberOfLines={1}>
                  {user.email}
                </Text>
              </View>
            </View>

            <View style={[styles.separator, { backgroundColor: C.border }]} />

            {/* Edit Profile */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit profile name, bio, and email"
              style={styles.row}
              onPress={() => router.push('/edit-profile')}
            >
              <View style={[styles.iconCircle, { backgroundColor: C.surfaceRaised }]}>
                <SymbolView
                  name={{ ios: 'person.fill', android: 'person', web: 'person' }}
                  size={18}
                  tintColor={C.accent}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: C.text }]}>Edit profile</Text>
                <Text style={[styles.rowSubtitle, { color: C.muted }]}>
                  Change photo, display name, handle, and email
                </Text>
              </View>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={16}
                tintColor={C.muted}
              />
            </Pressable>

            <View style={[styles.separator, { backgroundColor: C.border }]} />

            {/* Change Password */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change password"
              style={styles.row}
              onPress={() => router.push('/change-password')}
            >
              <View style={[styles.iconCircle, { backgroundColor: C.surfaceRaised }]}>
                <SymbolView
                  name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                  size={18}
                  tintColor={C.accent}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: C.text }]}>Change password</Text>
                <Text style={[styles.rowSubtitle, { color: C.muted }]}>
                  Manage password and active sessions
                </Text>
              </View>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={16}
                tintColor={C.muted}
              />
            </Pressable>

            <View style={[styles.separator, { backgroundColor: C.border }]} />

            {/* Sign Out */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out of your account"
              style={styles.row}
              onPress={handleSignOut}
            >
              <View style={[styles.iconCircle, { backgroundColor: isDark ? Design.color.accentSurface : '#fee2e2' }]}>
                <SymbolView
                  name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
                  size={18}
                  tintColor={Design.color.danger}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: Design.color.danger }]}>Sign out</Text>
                <Text style={[styles.rowSubtitle, { color: C.muted }]}>
                  Sign out from @{user.username}
                </Text>
              </View>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }, !isDark && Design.shadow.sm]}>
            <View style={styles.signedOutBox}>
              <SymbolView
                name={{ ios: 'person.crop.circle.badge.plus', android: 'account_circle', web: 'account_circle' }}
                size={36}
                tintColor={C.accent}
              />
              <Text style={[styles.signedOutTitle, { color: C.text }]}>You are not signed in</Text>
              <Text style={[styles.signedOutSubtitle, { color: C.muted }]}>
                Sign in to manage your Streanub channel, uploads, and account settings.
              </Text>
              <Pressable
                style={[styles.primaryButton, { backgroundColor: C.accent }]}
                onPress={() => router.push({ pathname: '/auth', params: { returnTo: '/settings' } })}
              >
                <Text style={styles.primaryButtonText}>Sign In / Register</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ========================================================
            2. APPEARANCE SECTION
            ======================================================== */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.accent }]}>APPEARANCE</Text>
        </View>

        <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }, !isDark && Design.shadow.sm]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Choose theme preference, current is ${themeLabelMap[preference]}`}
            style={styles.row}
            onPress={() => setShowThemeModal(true)}
          >
            <View style={[styles.iconCircle, { backgroundColor: C.surfaceRaised }]}>
              <SymbolView
                name={isDark ? { ios: 'moon.fill', android: 'dark_mode', web: 'dark_mode' } : { ios: 'sun.max.fill', android: 'light_mode', web: 'light_mode' }}
                size={18}
                tintColor={C.accent}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: C.text }]}>Appearance</Text>
              <Text style={[styles.rowSubtitle, { color: C.muted }]}>
                {themeLabelMap[preference]} {preference === 'system' ? `(${mode} active)` : ''}
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}>
              <Text style={[styles.statusPillText, { color: C.text }]}>
                {preference === 'system' ? 'System' : preference === 'dark' ? 'Dark' : 'Light'}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* ========================================================
            3. PLAYBACK SECTION
            ======================================================== */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.accent }]}>PLAYBACK</Text>
        </View>

        <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }, !isDark && Design.shadow.sm]}>
          {/* Autoplay Toggle */}
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: C.surfaceRaised }]}>
              <SymbolView
                name={{ ios: 'play.circle.fill', android: 'play_circle', web: 'play_circle' }}
                size={18}
                tintColor={C.accent}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: C.text }]}>Autoplay next video</Text>
              <Text style={[styles.rowSubtitle, { color: C.muted }]}>
                Automatically play the next related video when current video completes
              </Text>
            </View>
            <Switch
              value={settings.autoplay}
              onValueChange={(val) => updateSettings({ autoplay: val })}
              trackColor={{ false: C.surfaceRaised, true: C.accent }}
              thumbColor={Platform.OS === 'android' ? (settings.autoplay ? '#ffffff' : C.muted) : undefined}
            />
          </View>

          <View style={[styles.separator, { backgroundColor: C.border }]} />

          {/* Muted Playback Toggle */}
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: C.surfaceRaised }]}>
              <SymbolView
                name={{ ios: 'speaker.slash.fill', android: 'volume_off', web: 'volume_off' }}
                size={18}
                tintColor={C.accent}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: C.text }]}>Start playback muted</Text>
              <Text style={[styles.rowSubtitle, { color: C.muted }]}>
                Videos start with audio muted by default
              </Text>
            </View>
            <Switch
              value={settings.startMuted}
              onValueChange={(val) => updateSettings({ startMuted: val })}
              trackColor={{ false: C.surfaceRaised, true: C.accent }}
              thumbColor={Platform.OS === 'android' ? (settings.startMuted ? '#ffffff' : C.muted) : undefined}
            />
          </View>
        </View>

        {/* ========================================================
            4. NOTIFICATIONS SECTION
            ======================================================== */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.accent }]}>NOTIFICATIONS</Text>
        </View>

        <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }, !isDark && Design.shadow.sm]}>
          {/* Subscriptions notifications */}
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: C.surfaceRaised }]}>
              <SymbolView
                name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
                size={18}
                tintColor={C.accent}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: C.text }]}>Subscription uploads</Text>
              <Text style={[styles.rowSubtitle, { color: C.muted }]}>
                In-app notifications when creators you subscribe to upload videos
              </Text>
            </View>
            <Switch
              value={settings.notifySubscriptions}
              onValueChange={(val) => updateSettings({ notifySubscriptions: val })}
              trackColor={{ false: C.surfaceRaised, true: C.accent }}
              thumbColor={Platform.OS === 'android' ? (settings.notifySubscriptions ? '#ffffff' : C.muted) : undefined}
            />
          </View>

          <View style={[styles.separator, { backgroundColor: C.border }]} />

          {/* Comments notifications */}
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: C.surfaceRaised }]}>
              <SymbolView
                name={{ ios: 'bubble.left.fill', android: 'chat_bubble', web: 'chat_bubble' }}
                size={18}
                tintColor={C.accent}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: C.text }]}>Comments and activity</Text>
              <Text style={[styles.rowSubtitle, { color: C.muted }]}>
                In-app alerts when viewers comment on your videos
              </Text>
            </View>
            <Switch
              value={settings.notifyComments}
              onValueChange={(val) => updateSettings({ notifyComments: val })}
              trackColor={{ false: C.surfaceRaised, true: C.accent }}
              thumbColor={Platform.OS === 'android' ? (settings.notifyComments ? '#ffffff' : C.muted) : undefined}
            />
          </View>

          <View style={[styles.separator, { backgroundColor: C.border }]} />

          {/* Push status notice */}
          <View style={styles.infoRow}>
            <SymbolView
              name={{ ios: 'info.circle', android: 'info', web: 'info' }}
              size={15}
              tintColor={C.muted}
            />
            <Text style={[styles.infoRowText, { color: C.muted }]}>
              In-app notifications deliver activity badges directly to your Streanub inbox.
            </Text>
          </View>
        </View>

        {/* ========================================================
            5. PRIVACY SECTION
            ======================================================== */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.accent }]}>PRIVACY</Text>
        </View>

        <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }, !isDark && Design.shadow.sm]}>
          {/* Pause Watch History */}
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: C.surfaceRaised }]}>
              <SymbolView
                name={{ ios: 'pause.circle.fill', android: 'pause_circle', web: 'pause_circle' }}
                size={18}
                tintColor={C.accent}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: C.text }]}>Pause watch history</Text>
              <Text style={[styles.rowSubtitle, { color: C.muted }]}>
                Do not record newly watched videos to your profile library
              </Text>
            </View>
            <Switch
              value={settings.historyPaused}
              onValueChange={(val) => {
                updateSettings({ historyPaused: val });
                showToast(val ? 'Watch history recording paused.' : 'Watch history recording resumed.');
              }}
              trackColor={{ false: C.surfaceRaised, true: C.accent }}
              thumbColor={Platform.OS === 'android' ? (settings.historyPaused ? '#ffffff' : C.muted) : undefined}
            />
          </View>

          <View style={[styles.separator, { backgroundColor: C.border }]} />

          {/* Clear Watch History */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear watch history"
            style={styles.row}
            disabled={clearingHistory}
            onPress={handleClearHistory}
          >
            <View style={[styles.iconCircle, { backgroundColor: C.surfaceRaised }]}>
              <SymbolView
                name={{ ios: 'clock.arrow.circlepath', android: 'history', web: 'history' }}
                size={18}
                tintColor={C.accent}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: C.text }]}>Clear watch history</Text>
              <Text style={[styles.rowSubtitle, { color: C.muted }]}>
                Erase viewed videos from your library history
              </Text>
            </View>
            {clearingHistory ? (
              <ActivityIndicator color={C.accent} size="small" />
            ) : (
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={16}
                tintColor={C.muted}
              />
            )}
          </Pressable>
        </View>

        {/* ========================================================
            6. DATA AND STORAGE SECTION
            ======================================================== */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.accent }]}>DATA AND STORAGE</Text>
        </View>

        <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }, !isDark && Design.shadow.sm]}>
          {/* Data Saver Mode */}
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: C.surfaceRaised }]}>
              <SymbolView
                name={{ ios: 'antenna.radiowaves.left.and.right', android: 'network_check', web: 'network_check' }}
                size={18}
                tintColor={C.accent}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: C.text }]}>Data saver</Text>
              <Text style={[styles.rowSubtitle, { color: C.muted }]}>
                Conserves bandwidth when streaming video on mobile connections
              </Text>
            </View>
            <Switch
              value={settings.dataSaver}
              onValueChange={(val) => updateSettings({ dataSaver: val })}
              trackColor={{ false: C.surfaceRaised, true: C.accent }}
              thumbColor={Platform.OS === 'android' ? (settings.dataSaver ? '#ffffff' : C.muted) : undefined}
            />
          </View>

          <View style={[styles.separator, { backgroundColor: C.border }]} />

          {/* Clear Cache */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear temporary local storage"
            style={styles.row}
            disabled={clearingCache}
            onPress={handleClearCache}
          >
            <View style={[styles.iconCircle, { backgroundColor: C.surfaceRaised }]}>
              <SymbolView
                name={{ ios: 'trash.fill', android: 'delete', web: 'delete' }}
                size={18}
                tintColor={C.accent}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: C.text }]}>Clear local cache</Text>
              <Text style={[styles.rowSubtitle, { color: C.muted }]}>
                Free up temporary device storage without removing media or sessions
              </Text>
            </View>
            {clearingCache ? (
              <ActivityIndicator color={C.accent} size="small" />
            ) : (
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={16}
                tintColor={C.muted}
              />
            )}
          </Pressable>
        </View>

        {/* ========================================================
            7. ABOUT STREANUB SECTION
            ======================================================== */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.accent }]}>ABOUT STREANUB</Text>
        </View>

        <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }, !isDark && Design.shadow.sm]}>
          <View style={styles.row}>
            <View style={[styles.iconCircle, { backgroundColor: C.surfaceRaised }]}>
              <SymbolView
                name={{ ios: 'info.circle.fill', android: 'info', web: 'info' }}
                size={18}
                tintColor={C.accent}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: C.text }]}>Streanub Version</Text>
              <Text style={[styles.rowSubtitle, { color: C.muted }]}>
                Production build v{appVersion}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}>
              <Text style={[styles.badgeText, { color: C.accent }]}>v{appVersion}</Text>
            </View>
          </View>

          <View style={[styles.separator, { backgroundColor: C.border }]} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View Terms of Service"
            style={styles.row}
            onPress={() => handleOpenLink('Terms of Service')}
          >
            <View style={[styles.iconCircle, { backgroundColor: C.surfaceRaised }]}>
              <SymbolView
                name={{ ios: 'doc.plaintext.fill', android: 'description', web: 'description' }}
                size={18}
                tintColor={C.accent}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: C.text }]}>Terms of Service</Text>
              <Text style={[styles.rowSubtitle, { color: C.muted }]}>
                Platform usage guidelines and community standards
              </Text>
            </View>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={16}
              tintColor={C.muted}
            />
          </Pressable>

          <View style={[styles.separator, { backgroundColor: C.border }]} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View Privacy Policy"
            style={styles.row}
            onPress={() => handleOpenLink('Privacy Policy')}
          >
            <View style={[styles.iconCircle, { backgroundColor: C.surfaceRaised }]}>
              <SymbolView
                name={{ ios: 'hand.raised.fill', android: 'shield', web: 'shield' }}
                size={18}
                tintColor={C.accent}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: C.text }]}>Privacy Policy</Text>
              <Text style={[styles.rowSubtitle, { color: C.muted }]}>
                Data privacy and account protection policies
              </Text>
            </View>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={16}
              tintColor={C.muted}
            />
          </Pressable>

          <View style={[styles.separator, { backgroundColor: C.border }]} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View Open Source Licenses"
            style={styles.row}
            onPress={() => handleOpenLink('Open Source Licenses')}
          >
            <View style={[styles.iconCircle, { backgroundColor: C.surfaceRaised }]}>
              <SymbolView
                name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }}
                size={18}
                tintColor={C.accent}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: C.text }]}>Open Source Licenses</Text>
              <Text style={[styles.rowSubtitle, { color: C.muted }]}>
                Expo, React Native, and open-source acknowledgments
              </Text>
            </View>
            <SymbolView
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
              size={16}
              tintColor={C.muted}
            />
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: C.muted }]}>
            Streanub • Mobile Video Platform
          </Text>
        </View>
      </ScrollView>

      {/* Theme Selection Modal */}
      <Modal
        visible={showThemeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowThemeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.themeModalContent, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[styles.themeModalTitle, { color: C.text }]}>Choose theme</Text>

            {(['system', 'dark', 'light'] as ThemePreference[]).map((pref) => {
              const selected = preference === pref;
              return (
                <Pressable
                  key={pref}
                  style={[
                    styles.themeOptionRow,
                    selected && { backgroundColor: C.surfaceRaised, borderRadius: Design.radius.sm },
                  ]}
                  onPress={() => {
                    setPreference(pref);
                    setShowThemeModal(false);
                    showToast(`Theme updated to ${themeLabelMap[pref]}.`);
                  }}
                >
                  <View style={styles.themeRadio}>
                    <SymbolView
                      name={selected ? { ios: 'checkmark.circle.fill', android: 'radio_button_checked', web: 'radio_button_checked' } : { ios: 'circle', android: 'radio_button_unchecked', web: 'radio_button_unchecked' }}
                      size={20}
                      tintColor={selected ? C.accent : C.muted}
                    />
                  </View>
                  <View style={styles.themeOptionTextWrap}>
                    <Text style={[styles.themeOptionTitle, { color: C.text }]}>
                      {themeLabelMap[pref]}
                    </Text>
                    {pref === 'system' ? (
                      <Text style={[styles.themeOptionSubtitle, { color: C.muted }]}>
                        Automatically adjust to your system display settings
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}

            <Pressable
              style={[styles.themeCloseBtn, { backgroundColor: C.surfaceRaised }]}
              onPress={() => setShowThemeModal(false)}
            >
              <Text style={[styles.themeCloseText, { color: C.text }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  sectionHeader: {
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  card: {
    borderRadius: Design.radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
    fontSize: 22,
    fontWeight: '800',
  },
  userInfo: {
    marginLeft: 14,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
  },
  userHandle: {
    fontSize: 13,
    marginTop: 2,
  },
  userEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rowText: {
    flex: 1,
    paddingRight: 8,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 66,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  infoRowText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Design.radius.pill,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  signedOutBox: {
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  signedOutTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  signedOutSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  primaryButton: {
    marginTop: 6,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: Design.radius.sm,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 16,
  },
  footerText: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  themeModalContent: {
    width: '100%',
    maxWidth: 380,
    borderRadius: Design.radius.lg,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  themeModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  themeOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  themeRadio: {
    marginRight: 12,
  },
  themeOptionTextWrap: {
    flex: 1,
  },
  themeOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  themeOptionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  themeCloseBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: Design.radius.sm,
    marginTop: 8,
  },
  themeCloseText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
