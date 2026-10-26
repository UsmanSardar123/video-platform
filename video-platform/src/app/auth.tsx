import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, TextInput, ThemeToggleButton, View } from '@/components/theme-native';
import { useAuth } from '@/contexts/auth-context';
import { Design } from '@/constants/design';

export default function AuthScreen() {
  const params = useLocalSearchParams<{ returnTo?: string }>();
  // Direct sign-in and signup return to Home. Preserve supported protected
  // actions that redirected here for authentication.
  const destination = params.returnTo === '/upload' || params.returnTo === '/main/edit-profile'
    ? params.returnTo
    : '/main';
  const { user, loading: sessionLoading, login, register } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionLoading && user) router.replace(destination);
  }, [destination, sessionLoading, user]);

  const submit = async () => {
    setError('');
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    if (isRegistering && !username.trim()) { setError('Choose a username.'); return; }
    setBusy(true);
    try {
      if (isRegistering) await register({ username, fullName, email, password });
      else await login(email, password);
      // The auth-state effect redirects once; a second replace here can race it.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed. Try again.');
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.topActions}><Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.back}>‹ Back</Text></Pressable><ThemeToggleButton /></View>
          <View style={styles.brand}><View style={styles.brandMark}><Text style={styles.brandMarkText}>S</Text></View><Text style={styles.brandText}>Streanub</Text><Text style={styles.subtitle}>A home for videos and creators</Text></View>
          <View style={styles.card}>
            <View><Text style={styles.heading}>{isRegistering ? 'Create your account' : 'Welcome back'}</Text><Text style={styles.cardSubtitle}>{isRegistering ? 'Join the Streanub community.' : 'Sign in to continue to your account.'}</Text></View>
            {isRegistering && <>
              <TextInput accessibilityLabel="Username" style={styles.input} placeholder="Username" placeholderTextColor={Design.color.muted} value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} maxLength={30} />
              <TextInput accessibilityLabel="Full name, optional" style={styles.input} placeholder="Full name (optional)" placeholderTextColor={Design.color.muted} value={fullName} onChangeText={setFullName} maxLength={80} />
            </>}
            <TextInput accessibilityLabel="Email address" style={styles.input} placeholder="Email address" placeholderTextColor={Design.color.muted} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" />
            <View style={styles.passwordRow}><TextInput accessibilityLabel="Password" style={styles.passwordInput} placeholder="Password" placeholderTextColor={Design.color.muted} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} textContentType={isRegistering ? 'newPassword' : 'password'} maxLength={128} /><Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} style={styles.passwordToggle} onPress={() => setShowPassword((current) => !current)}><Text style={styles.passwordToggleText}>{showPassword ? 'Hide' : 'Show'}</Text></Pressable></View>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <Pressable disabled={busy || sessionLoading} style={[styles.button, (busy || sessionLoading) && styles.disabled]} onPress={submit} accessibilityRole="button">
              {busy || sessionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isRegistering ? 'Create account' : 'Sign in'}</Text>}
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy} style={styles.toggleButton} onPress={() => { setError(''); setIsRegistering((value) => !value); }}>
              <Text style={styles.toggle}>{isRegistering ? 'Already have an account? Sign in' : 'New here? Create an account'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Design.color.background }, content: { flexGrow: 1, padding: 22, justifyContent: 'center', width: '100%', maxWidth: 500, alignSelf: 'center' }, topActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { color: Design.color.secondary, fontSize: 14, minHeight: 44, textAlignVertical: 'center' }, brand: { alignItems: 'center', marginVertical: 28 }, brandMark: { width: 58, height: 58, borderRadius: 18, backgroundColor: Design.color.accentSurface, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }, brandMarkText: { color: Design.color.accent, fontSize: 30, fontWeight: '900' }, brandText: { color: Design.color.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.7 }, subtitle: { color: Design.color.muted, fontSize: 14, marginTop: 6 },
  card: { backgroundColor: Design.color.surface, borderColor: Design.color.border, borderWidth: 1, borderRadius: Design.radius.lg, padding: 22, gap: 14 }, heading: { color: Design.color.text, fontSize: 22, fontWeight: '800', marginBottom: 4 }, cardSubtitle: { color: Design.color.muted, fontSize: 13, lineHeight: 19 },
  input: { minHeight: 50, color: Design.color.text, backgroundColor: Design.color.surfaceRaised, borderColor: Design.color.border, borderWidth: 1, borderRadius: Design.radius.sm, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14 }, passwordRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', backgroundColor: Design.color.surfaceRaised, borderColor: Design.color.border, borderWidth: 1, borderRadius: Design.radius.sm, paddingRight: 12 }, passwordInput: { flex: 1, minHeight: 48, color: Design.color.text, paddingHorizontal: 14, paddingVertical: 12 }, passwordToggle: { minWidth: 48, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, passwordToggleText: { color: Design.color.accent, fontWeight: '700', fontSize: 12 },
  button: { minHeight: 50, justifyContent: 'center', alignItems: 'center', backgroundColor: Design.color.accent, borderRadius: Design.radius.sm, marginTop: 5 }, buttonText: { color: '#fff', fontSize: 14, fontWeight: '800' }, disabled: { opacity: 0.6 }, error: { color: Design.color.danger, fontSize: 13 }, toggleButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, toggle: { color: Design.color.accent, textAlign: 'center', fontSize: 13, paddingVertical: 6, fontWeight: '600' },
});
