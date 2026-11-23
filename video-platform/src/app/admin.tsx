import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, View } from '@/components/theme-native';
import { Design } from '@/constants/design';
import { useAuth } from '@/contexts/auth-context';
import { useThemeMode } from '@/contexts/theme-context';
import { apiRequest } from '@/lib/api';

type AdminStats = { totalUsers: number; totalVideos: number; totalViews: number; pendingModeration: number; pendingReports: number };
type AdminUser = { id: string; username: string; fullName: string; role: 'user' | 'creator' | 'admin'; isActive: boolean; videosCount: number };
const roles: AdminUser['role'][] = ['user', 'creator', 'admin'];

export default function AdminScreen() {
  const { user, loading: authLoading } = useAuth();
  const { mode } = useThemeMode();
  const colors = mode === 'dark' ? Design.color : Design.light;
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    const [statsResult, usersResult] = await Promise.all([
      apiRequest<AdminStats>('/api/admin/stats'),
      apiRequest<AdminUser[]>('/api/admin/users?page=1&limit=20'),
    ]);
    return { stats: statsResult.data, users: usersResult.data };
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    let active = true;
    void fetchDashboard().then((result) => {
      if (!active) return;
      setStats(result.stats);
      setUsers(result.users);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load the admin dashboard.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [user?.role, fetchDashboard]);

  if (authLoading) return <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator /></SafeAreaView>;
  if (user?.role !== 'admin') return <Redirect href="/main/profile" />;

  const updateRole = async (target: AdminUser, role: AdminUser['role']) => {
    setBusyId(target.id);
    setError('');
    try {
      await apiRequest(`/api/admin/users/${encodeURIComponent(target.id)}/role`, {
        method: 'PATCH', body: JSON.stringify({ role }),
      });
      setLoading(true);
      const result = await fetchDashboard();
      setStats(result.stats);
      setUsers(result.users);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this role.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={{ color: colors.accent, fontWeight: '700' }}>‹ Back</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Admin dashboard</Text>
          <Text style={{ color: colors.secondary }}>Platform overview and role management</Text>
        </View>
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text> : null}
        {loading ? <ActivityIndicator style={styles.loader} /> : null}
        {stats ? <View style={styles.stats}>
          {([
            ['Users', stats.totalUsers], ['Videos', stats.totalVideos], ['Views', stats.totalViews],
            ['Pending review', stats.pendingModeration], ['Reports', stats.pendingReports],
          ] as const).map(([label, value]) => <View key={label} style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.text }]}>{value.toLocaleString()}</Text>
            <Text style={{ color: colors.secondary }}>{label}</Text>
          </View>)}
        </View> : null}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent accounts</Text>
        {users.map((account) => {
          const nextRole = roles[(roles.indexOf(account.role) + 1) % roles.length];
          return <View key={account.id} style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.userInfo}>
              <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{account.fullName || account.username}</Text>
              <Text style={{ color: colors.secondary }}>@{account.username} · {account.videosCount} uploads</Text>
              <Text style={{ color: colors.secondary }}>Role: {account.role}{account.isActive ? '' : ' · inactive'}</Text>
            </View>
            {account.id !== user.id ? <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Change ${account.username} role to ${nextRole}`}
              disabled={busyId === account.id}
              onPress={() => void updateRole(account, nextRole)}
              style={[styles.roleButton, { backgroundColor: colors.surfaceRaised }]}
            >
              {busyId === account.id ? <ActivityIndicator /> : <Text style={{ color: colors.accent, fontWeight: '700' }}>Set {nextRole}</Text>}
            </Pressable> : <Text style={{ color: colors.muted }}>You</Text>}
          </View>;
        })}
        {!loading && users.length === 0 ? <Text style={{ color: colors.secondary }}>No accounts found.</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => {
          setLoading(true);
          setError('');
          void fetchDashboard().then((result) => { setStats(result.stats); setUsers(result.users); })
            .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not load the admin dashboard.'))
            .finally(() => setLoading(false));
        }} style={[styles.refresh, { backgroundColor: colors.accent }]}>
          <Text style={styles.refreshText}>Refresh dashboard</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 18, paddingBottom: 36 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading: { gap: 8, marginBottom: 20 },
  title: { fontSize: 25, fontWeight: '800' },
  loader: { margin: 20 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 24 },
  stat: { minWidth: '30%', flexGrow: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: Design.radius.md, padding: 12 },
  statValue: { fontSize: 20, fontWeight: '800' },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
  userCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: Design.radius.md, marginBottom: 8 },
  userInfo: { flex: 1, gap: 3 },
  name: { fontWeight: '700' },
  roleButton: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: Design.radius.pill },
  refresh: { alignItems: 'center', padding: 13, borderRadius: Design.radius.pill, marginTop: 14 },
  refreshText: { color: '#fff', fontWeight: '700' },
});
