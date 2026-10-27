import { useState, useEffect } from 'react';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  ThemeToggleButton,
  View,
} from '@/components/theme-native';
import { Design } from '@/constants/design';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';

export default function ChangePasswordScreen() {
  const { user, changePassword } = useAuth();
  const { mode } = useThemeMode();
  const { showToast } = useToast();
  const isDark = mode === 'dark';
  const C = isDark ? Design.color : Design.light;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Hardware back button support for Android
  useEffect(() => {
    const onBackPress = () => {
      router.back();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, []);

  if (!user) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top', 'bottom']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <View style={styles.center}>
          <Text style={[styles.signedOutTitle, { color: C.text }]}>Sign in required</Text>
          <Text style={[styles.signedOutSubtitle, { color: C.muted }]}>
            You must be logged in to change your account password.
          </Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: C.accent }]}
            onPress={() => router.replace({ pathname: '/auth', params: { returnTo: '/change-password' } })}
          >
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const handleSubmit = async () => {
    setError('');

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      Alert.alert(
        'Password Changed',
        'Your password has been updated and existing sessions have been closed for security. Please sign in with your new password.',
        [
          {
            text: 'Sign In',
            onPress: () => {
              showToast('Password changed successfully.');
              router.replace('/auth');
            },
          },
        ],
        { cancelable: false }
      );
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Failed to change password. Please check your current password.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const hasMinLength = newPassword.length >= 8;
  const isDifferent = Boolean(newPassword && currentPassword && newPassword !== currentPassword);
  const passwordsMatch = Boolean(newPassword && confirmPassword && newPassword === confirmPassword);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { borderBottomColor: C.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
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
        <Text style={[styles.title, { color: C.text }]}>Change Password</Text>
        <ThemeToggleButton />
      </View>

      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }, !isDark && Design.shadow.sm]}>
            <Text style={[styles.cardHeading, { color: C.text }]}>Security & Credentials</Text>
            <Text style={[styles.cardSubtitle, { color: C.muted }]}>
              Enter your current password to verify ownership, then choose a secure new password of 8 or more characters.
            </Text>

            {/* Current Password Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: C.secondary }]}>Current password</Text>
              <View style={[styles.inputContainer, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}>
                <TextInput
                  style={[styles.input, { color: C.text }]}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor={C.muted}
                  secureTextEntry={!showCurrent}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showCurrent ? 'Hide current password' : 'Show current password'}
                  style={styles.eyeButton}
                  onPress={() => setShowCurrent(!showCurrent)}
                >
                  <SymbolView
                    name={showCurrent ? { ios: 'eye.slash.fill', android: 'visibility_off', web: 'visibility_off' } : { ios: 'eye.fill', android: 'visibility', web: 'visibility' }}
                    size={20}
                    tintColor={C.muted}
                  />
                </Pressable>
              </View>
            </View>

            {/* New Password Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: C.secondary }]}>New password</Text>
              <View style={[styles.inputContainer, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}>
                <TextInput
                  style={[styles.input, { color: C.text }]}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="At least 8 characters"
                  placeholderTextColor={C.muted}
                  secureTextEntry={!showNew}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showNew ? 'Hide new password' : 'Show new password'}
                  style={styles.eyeButton}
                  onPress={() => setShowNew(!showNew)}
                >
                  <SymbolView
                    name={showNew ? { ios: 'eye.slash.fill', android: 'visibility_off', web: 'visibility_off' } : { ios: 'eye.fill', android: 'visibility', web: 'visibility' }}
                    size={20}
                    tintColor={C.muted}
                  />
                </Pressable>
              </View>
            </View>

            {/* Confirm New Password Field */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: C.secondary }]}>Confirm new password</Text>
              <View style={[styles.inputContainer, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}>
                <TextInput
                  style={[styles.input, { color: C.text }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repeat new password"
                  placeholderTextColor={C.muted}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showConfirm ? 'Hide confirmed password' : 'Show confirmed password'}
                  style={styles.eyeButton}
                  onPress={() => setShowConfirm(!showConfirm)}
                >
                  <SymbolView
                    name={showConfirm ? { ios: 'eye.slash.fill', android: 'visibility_off', web: 'visibility_off' } : { ios: 'eye.fill', android: 'visibility', web: 'visibility' }}
                    size={20}
                    tintColor={C.muted}
                  />
                </Pressable>
              </View>
            </View>

            {/* Password Validation Checklist */}
            <View style={[styles.checklist, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}>
              <View style={styles.checkItem}>
                <SymbolView
                  name={hasMinLength ? { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' } : { ios: 'circle', android: 'radio_button_unchecked', web: 'radio_button_unchecked' }}
                  size={16}
                  tintColor={hasMinLength ? Design.color.success : C.muted}
                />
                <Text style={[styles.checkText, { color: hasMinLength ? C.text : C.muted }]}>
                  At least 8 characters long
                </Text>
              </View>

              <View style={styles.checkItem}>
                <SymbolView
                  name={isDifferent ? { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' } : { ios: 'circle', android: 'radio_button_unchecked', web: 'radio_button_unchecked' }}
                  size={16}
                  tintColor={isDifferent ? Design.color.success : C.muted}
                />
                <Text style={[styles.checkText, { color: isDifferent ? C.text : C.muted }]}>
                  Different from current password
                </Text>
              </View>

              <View style={styles.checkItem}>
                <SymbolView
                  name={passwordsMatch ? { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' } : { ios: 'circle', android: 'radio_button_unchecked', web: 'radio_button_unchecked' }}
                  size={16}
                  tintColor={passwordsMatch ? Design.color.success : C.muted}
                />
                <Text style={[styles.checkText, { color: passwordsMatch ? C.text : C.muted }]}>
                  Passwords match
                </Text>
              </View>
            </View>

            {error ? (
              <View style={[styles.errorContainer, { backgroundColor: isDark ? Design.color.accentSurface : '#fee2e2' }]}>
                <SymbolView
                  name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
                  size={16}
                  tintColor={Design.color.danger}
                />
                <Text style={[styles.errorText, { color: Design.color.danger }]}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Update password"
              style={[styles.submitButton, { backgroundColor: C.accent }, busy && styles.disabled]}
              disabled={busy}
              onPress={handleSubmit}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>Update Password</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    padding: 16,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    borderRadius: Design.radius.lg,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  cardHeading: {
    fontSize: 18,
    fontWeight: '800',
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -8,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Design.radius.sm,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
  eyeButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checklist: {
    borderRadius: Design.radius.sm,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginVertical: 4,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: Design.radius.sm,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  submitButton: {
    minHeight: 50,
    borderRadius: Design.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.65,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  signedOutTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  signedOutSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  primaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Design.radius.sm,
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
