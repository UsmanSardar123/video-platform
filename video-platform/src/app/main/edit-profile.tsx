import { useState } from 'react';
import { Redirect, router } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, TextInput, ThemeToggleButton, View } from '@/components/theme-native';
import { useAuth } from '@/contexts/auth-context';
import type { SessionUser } from '@/lib/api';
import { useToast } from '@/contexts/toast-context';
import { Design } from '@/constants/design';

export default function EditProfileScreen() {
  const { user, loading } = useAuth();
  if (loading) return <SafeAreaView edges={['top']} style={styles.center}><ActivityIndicator color="#ff3434" /></SafeAreaView>;
  if (!user) return <Redirect href={{ pathname: '/auth', params: { returnTo: '/main/edit-profile' } }} />;
  return <ProfileForm user={user} />;
}

function ProfileForm({ user }: { user: SessionUser }) {
  const { updateProfile } = useAuth();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState(user.fullName || '');
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email);
  const [bio, setBio] = useState(user.bio || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const save = async () => {
    setError(''); setSaved(false);
    if (!fullName.trim() || !username.trim() || !email.trim()) { setError('Display name, username, and email are required.'); return; }
    setBusy(true);
    try { await updateProfile({ fullName: fullName.trim(), username: username.trim(), email: email.trim(), bio: bio.trim() }); setSaved(true); showToast('Profile saved.'); }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Profile update failed.';
      setError(message); showToast(message, 'error');
    }
    finally { setBusy(false); }
  };

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}><Pressable style={styles.backButton} onPress={() => router.back()} accessibilityRole="button"><Text style={styles.muted}>‹ Back</Text></Pressable><View style={styles.titleBlock}><Text style={styles.eyebrow}>YOUR ACCOUNT</Text><Text style={styles.heading}>Edit profile</Text></View><ThemeToggleButton /></View>
        <View style={styles.card}>
          <Text style={styles.label}>Display name</Text><TextInput style={styles.input} value={fullName} onChangeText={setFullName} maxLength={80} autoCapitalize="words" />
          <Text style={styles.label}>Username</Text><TextInput style={styles.input} value={username} onChangeText={(value) => setUsername(value.replace(/\s/g, '').replace(/^@/, ''))} maxLength={30} autoCapitalize="none" autoCorrect={false} />
          <Text style={styles.label}>Email</Text><TextInput style={styles.input} value={email} onChangeText={setEmail} maxLength={254} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <Text style={styles.label}>Bio</Text><TextInput style={[styles.input, styles.bio]} value={bio} onChangeText={setBio} multiline maxLength={300} textAlignVertical="top" />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {saved ? <Text style={styles.success}>Profile saved.</Text> : null}
          <Pressable style={[styles.button, busy && styles.disabled]} disabled={busy} onPress={save}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save changes</Text>}</Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Design.color.background }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Design.color.background }, content: { padding: 20, width: '100%', maxWidth: 680, alignSelf: 'center' }, header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }, backButton: { minWidth: 56, minHeight: 44, justifyContent: 'center' }, titleBlock: { flex: 1, alignItems: 'center' }, eyebrow: { color: Design.color.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }, heading: { color: Design.color.text, fontSize: 20, fontWeight: '800', marginTop: 3 }, muted: { color: Design.color.muted }, card: { backgroundColor: Design.color.surface, borderWidth: 1, borderColor: Design.color.border, borderRadius: Design.radius.lg, padding: 20, gap: 12 }, label: { color: Design.color.secondary, fontWeight: '700', marginTop: 4, fontSize: 13 }, input: { minHeight: 48, borderWidth: 1, borderColor: Design.color.border, borderRadius: Design.radius.sm, backgroundColor: Design.color.surfaceRaised, paddingHorizontal: 14, paddingVertical: 12, color: Design.color.text }, bio: { minHeight: 120 }, button: { minHeight: 50, borderRadius: Design.radius.sm, backgroundColor: Design.color.accent, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, buttonText: { color: '#fff', fontWeight: '800' }, disabled: { opacity: 0.6 }, error: { color: Design.color.danger }, success: { color: Design.color.success },
});
