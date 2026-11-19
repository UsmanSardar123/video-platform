import { useState, useEffect, useCallback } from 'react';
import { Redirect, router } from 'expo-router';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
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
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import { useSettings } from '@/contexts/settings-context';
import { Design } from '@/constants/design';
import { type SessionUser } from '@/lib/api';
import { uploadAvatarImage } from '@/lib/video-service';

export default function EditProfileScreen() {
  const { user, loading } = useAuth();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const C = isDark ? Design.color : Design.light;

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[styles.center, { backgroundColor: C.background }]}>
        <ActivityIndicator color={C.accent} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return <Redirect href={{ pathname: '/auth', params: { returnTo: '/edit-profile' } }} />;
  }

  return <ProfileForm user={user} />;
}

function ProfileForm({ user }: { user: SessionUser }) {
  const { updateProfile, changeEmail } = useAuth();
  const { mode } = useThemeMode();
  const { settings } = useSettings();
  const isDark = mode === 'dark';
  const C = isDark ? Design.color : Design.light;
  const { showToast } = useToast();

  const [fullName, setFullName] = useState(user.fullName || '');
  const [username, setUsername] = useState(user.username || '');
  const [email, setEmail] = useState(user.email || '');
  const [bio, setBio] = useState(user.bio || '');
  const [avatar, setAvatar] = useState(user.avatar || '');

  const [busy, setBusy] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Email re-authentication modal state
  const [showEmailConfirmModal, setShowEmailConfirmModal] = useState(false);
  const [emailPassword, setEmailPassword] = useState('');
  const [pendingNewEmail, setPendingNewEmail] = useState('');
  const [confirmingEmail, setConfirmingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Initial values state for change tracking
  const [initialValues, setInitialValues] = useState({
    fullName: user.fullName || '',
    username: user.username || '',
    email: user.email || '',
    bio: user.bio || '',
    avatar: user.avatar || '',
  });

  const hasUnsavedChanges =
    fullName !== initialValues.fullName ||
    username !== initialValues.username ||
    email !== initialValues.email ||
    bio !== initialValues.bio ||
    avatar !== initialValues.avatar;

  const handleBackNavigation = useCallback(() => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes to your profile. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  }, [hasUnsavedChanges]);

  // Handle hardware back button on Android
  useEffect(() => {
    const onBackPress = () => {
      handleBackNavigation();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [handleBackNavigation]);

  // Avatar Image Picker
  const handlePickAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || !result.assets[0]?.uri) return;

      const asset = result.assets[0];
      setAvatarUploading(true);

      const uploadedUrl = await uploadAvatarImage(asset);
      setAvatar(uploadedUrl);
      await updateProfile({ avatar: uploadedUrl });
      setInitialValues((prev) => ({ ...prev, avatar: uploadedUrl }));
      showToast('Profile photo updated.');
    } catch (err: any) {
      showToast(err?.message || 'Could not update avatar', 'error');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    setError('');
    setSaved(false);

    if (!fullName.trim()) {
      setError('Display name is required.');
      return;
    }
    if (!username.trim()) {
      setError('Username is required.');
      return;
    }
    if (!/^[a-z0-9_]{3,30}$/i.test(username.trim())) {
      setError('Username must be 3–30 characters and contain only letters, numbers, and underscores.');
      return;
    }

    // Check if email was changed
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail !== user.email.toLowerCase()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        setError('Please enter a valid email address.');
        return;
      }
      setPendingNewEmail(cleanEmail);
      setEmailPassword('');
      setEmailError('');
      setShowEmailConfirmModal(true);
      return;
    }

    if (!hasUnsavedChanges) {
      showToast('No changes to save.');
      return;
    }

    setBusy(true);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim(),
        avatar: avatar.trim(),
      });
      setInitialValues({
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        email: cleanEmail,
        bio: bio.trim(),
        avatar: avatar.trim(),
      });
      setSaved(true);
      showToast('Profile changes saved.');
    } catch (cause: any) {
      const message = cause instanceof Error ? cause.message : 'Profile update failed.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmEmailChange = async () => {
    setEmailError('');
    if (!emailPassword) {
      setEmailError('Please enter your current password to confirm.');
      return;
    }

    setConfirmingEmail(true);
    try {
      await changeEmail(emailPassword, pendingNewEmail);
      setShowEmailConfirmModal(false);
      showToast('Email address updated successfully.');

      // Update remaining fields
      await updateProfile({
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim(),
        avatar: avatar.trim(),
      });
      setInitialValues({
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        email: pendingNewEmail,
        bio: bio.trim(),
        avatar: avatar.trim(),
      });
      setSaved(true);
    } catch (cause: any) {
      const message = cause instanceof Error ? cause.message : 'Email change failed.';
      setEmailError(message);
      showToast(message, 'error');
    } finally {
      setConfirmingEmail(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Navigation Header */}
          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={handleBackNavigation}
              accessibilityRole="button"
              accessibilityLabel="Back to previous screen"
              hitSlop={10}
            >
              <SymbolView
                name={{ ios: 'chevron.backward', android: 'arrow_back', web: 'arrow_back' }}
                size={22}
                tintColor={C.text}
              />
            </Pressable>
            <View style={styles.titleBlock}>
              <Text style={[styles.eyebrow, { color: C.accent }]}>YOUR ACCOUNT</Text>
              <Text style={[styles.heading, { color: C.text }]}>Edit profile</Text>
            </View>
            <ThemeToggleButton />
          </View>

          {/* Avatar / Picture Card */}
          <View style={[styles.avatarCard, { backgroundColor: C.surface, borderColor: C.border }, !isDark && Design.shadow.sm]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Upload profile photo"
              disabled={avatarUploading}
              onPress={handlePickAvatar}
              style={styles.avatarWrap}
            >
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View
                  style={[
                    styles.avatarFallback,
                    { backgroundColor: isDark ? Design.color.accentSurface : '#fee2e2' },
                  ]}
                >
                  <Text style={[styles.initial, { color: Design.color.accent }]}>
                    {(fullName || username || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              {avatarUploading ? (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator color="#ffffff" size="small" />
                </View>
              ) : (
                <View
                  style={[
                    styles.avatarCameraBadge,
                    { backgroundColor: Design.color.accent, borderColor: C.background },
                  ]}
                >
                  <SymbolView
                    name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }}
                    size={14}
                    tintColor="#ffffff"
                  />
                </View>
              )}
            </Pressable>

            <View style={styles.avatarActions}>
              <Text style={[styles.avatarHeading, { color: C.text }]}>Profile Picture</Text>
              <Text style={[styles.avatarSub, { color: C.muted }]}>
                A picture helps viewers identify your channel across Streanub.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Change profile image"
                style={[styles.avatarButton, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}
                disabled={avatarUploading}
                onPress={handlePickAvatar}
              >
                <SymbolView
                  name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }}
                  size={16}
                  tintColor={C.accent}
                />
                <Text style={[styles.avatarButtonText, { color: C.text }]}>
                  {avatarUploading ? 'Uploading...' : 'Change Photo'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Profile Details Form Card */}
          <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }, !isDark && Design.shadow.sm]}>
            <Text style={[styles.sectionHeading, { color: C.text }]}>Profile Information</Text>

            {/* Display Name */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: C.secondary }]}>Display name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: C.surfaceRaised, borderColor: C.border, color: C.text }]}
                placeholderTextColor={C.muted}
                value={fullName}
                onChangeText={setFullName}
                maxLength={80}
                autoCapitalize="words"
                placeholder="Your channel or personal name"
              />
            </View>

            {/* Username / Handle */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: C.secondary }]}>Handle (@username)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: C.surfaceRaised, borderColor: C.border, color: C.text }]}
                placeholderTextColor={C.muted}
                value={username}
                onChangeText={(val) => setUsername(val.replace(/\s/g, '').replace(/^@/, ''))}
                maxLength={30}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="your_handle"
              />
            </View>

            {/* Email Address */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: C.secondary }]}>Email address</Text>
                <Text style={[styles.secureNote, { color: C.muted }]}>Protected by password</Text>
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: C.surfaceRaised, borderColor: C.border, color: C.text }]}
                placeholderTextColor={C.muted}
                value={email}
                onChangeText={setEmail}
                maxLength={254}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="name@example.com"
              />
            </View>

            {/* Bio / Description */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: C.secondary }]}>Channel description</Text>
                <Text style={[styles.secureNote, { color: C.muted }]}>{bio.length}/300</Text>
              </View>
              <TextInput
                style={[styles.input, styles.bio, { backgroundColor: C.surfaceRaised, borderColor: C.border, color: C.text }]}
                placeholderTextColor={C.muted}
                value={bio}
                onChangeText={setBio}
                multiline
                maxLength={300}
                textAlignVertical="top"
                placeholder="Tell viewers about your channel, tutorials, and uploads..."
              />
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: isDark ? Design.color.accentSurface : '#fee2e2' }]}>
                <SymbolView
                  name={{ ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' }}
                  size={16}
                  tintColor={Design.color.danger}
                />
                <Text style={[styles.errorText, { color: Design.color.danger }]}>{error}</Text>
              </View>
            ) : null}

            {saved ? (
              <View style={[styles.successBox, { backgroundColor: isDark ? '#143823' : '#dcfce7' }]}>
                <SymbolView
                  name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                  size={16}
                  tintColor={Design.color.success}
                />
                <Text style={[styles.successText, { color: Design.color.success }]}>Profile saved successfully.</Text>
              </View>
            ) : null}

            {/* Save & Cancel Action Buttons */}
            <View style={styles.formActions}>
              <Pressable
                style={[styles.cancelBtn, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}
                onPress={handleBackNavigation}
                disabled={busy}
              >
                <Text style={[styles.cancelBtnText, { color: C.text }]}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.saveBtn,
                  { backgroundColor: C.accent },
                  (!hasUnsavedChanges || busy) && styles.disabled,
                ]}
                disabled={!hasUnsavedChanges || busy}
                onPress={handleSaveProfile}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </Pressable>
            </View>

            <View style={[styles.divider, { backgroundColor: C.border }]} />

            {/* Change Password Shortcut */}
            <Pressable
              style={[styles.secondaryButton, { backgroundColor: C.surfaceRaised, borderColor: C.border }]}
              onPress={() => router.push('/change-password')}
            >
              <SymbolView
                name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
                size={16}
                tintColor={C.accent}
              />
              <Text style={[styles.secondaryButtonText, { color: C.text }]}>Change Account Password</Text>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={16}
                tintColor={C.muted}
              />
            </Pressable>
          </View>

          {/* Quick Preferences Overview Card */}
          <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border, marginTop: 16 }, !isDark && Design.shadow.sm]}>
            <View style={styles.labelRow}>
              <Text style={[styles.sectionHeading, { color: C.text }]}>Personal Preferences</Text>
              <Pressable onPress={() => router.push('/settings')}>
                <Text style={[styles.viewAllText, { color: C.accent }]}>View all in Settings ›</Text>
              </Pressable>
            </View>

            <View style={styles.prefRow}>
              <Text style={[styles.prefLabel, { color: C.text }]}>Active Theme</Text>
              <Text style={[styles.prefValue, { color: C.muted }]}>
                {mode === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </Text>
            </View>

            <View style={[styles.prefDivider, { backgroundColor: C.border }]} />

            <View style={styles.prefRow}>
              <Text style={[styles.prefLabel, { color: C.text }]}>Autoplay Next Video</Text>
              <Text style={[styles.prefValue, { color: settings.autoplay ? Design.color.success : C.muted }]}>
                {settings.autoplay ? 'Enabled' : 'Disabled'}
              </Text>
            </View>

            <View style={[styles.prefDivider, { backgroundColor: C.border }]} />

            <View style={styles.prefRow}>
              <Text style={[styles.prefLabel, { color: C.text }]}>Watch History Recording</Text>
              <Text style={[styles.prefValue, { color: !settings.historyPaused ? Design.color.success : Design.color.danger }]}>
                {!settings.historyPaused ? 'Active' : 'Paused'}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Password Re-verification Modal for Email Change */}
      <Modal
        visible={showEmailConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEmailConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: C.surface, borderColor: C.border }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>Confirm Email Change</Text>
            <Text style={[styles.modalSubtitle, { color: C.muted }]}>
              Changing your email to <Text style={{ color: C.accent, fontWeight: '700' }}>{pendingNewEmail}</Text> requires verifying your current password.
            </Text>

            <TextInput
              style={[styles.modalInput, { backgroundColor: C.surfaceRaised, borderColor: C.border, color: C.text }]}
              placeholder="Enter current password"
              placeholderTextColor={C.muted}
              secureTextEntry
              value={emailPassword}
              onChangeText={setEmailPassword}
              autoCapitalize="none"
            />

            {emailError ? (
              <Text style={[styles.modalError, { color: Design.color.danger }]}>{emailError}</Text>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalCancel, { backgroundColor: C.surfaceRaised }]}
                disabled={confirmingEmail}
                onPress={() => {
                  setShowEmailConfirmModal(false);
                  setEmail(user.email);
                }}
              >
                <Text style={[styles.modalCancelText, { color: C.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirm, { backgroundColor: C.accent }]}
                disabled={confirmingEmail}
                onPress={handleConfirmEmailChange}
              >
                {confirmingEmail ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm & Save</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, width: '100%', maxWidth: 680, alignSelf: 'center', paddingBottom: 40 },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  titleBlock: { flex: 1, alignItems: 'center' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  heading: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  avatarCard: {
    borderRadius: Design.radius.lg,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
  },
  avatarWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    position: 'relative',
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  avatarFallback: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
    fontSize: 28,
    fontWeight: '800',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarActions: {
    flex: 1,
    gap: 4,
  },
  avatarHeading: {
    fontSize: 15,
    fontWeight: '700',
  },
  avatarSub: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  avatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Design.radius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  avatarButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    borderRadius: Design.radius.lg,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  fieldGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { fontWeight: '700', fontSize: 13 },
  secureNote: { fontSize: 11 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Design.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  bio: { minHeight: 96 },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: Design.radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  saveBtn: {
    flex: 2,
    minHeight: 48,
    borderRadius: Design.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },
  secondaryButton: {
    minHeight: 46,
    borderRadius: Design.radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
    marginTop: 2,
  },
  secondaryButtonText: { fontWeight: '700', fontSize: 14, flex: 1 },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  disabled: { opacity: 0.55 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: Design.radius.sm,
  },
  errorText: { fontSize: 13, fontWeight: '600', flex: 1 },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: Design.radius.sm,
  },
  successText: { fontSize: 13, fontWeight: '700', flex: 1 },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  prefLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  prefValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  prefDivider: {
    height: StyleSheet.hairlineWidth,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Design.radius.lg,
    borderWidth: 1,
    padding: 22,
    gap: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Design.radius.sm,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  modalError: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  modalCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Design.radius.sm,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalConfirm: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Design.radius.sm,
    minWidth: 120,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
