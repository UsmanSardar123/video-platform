import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { EmptyState, ErrorState } from '@/components/ui';
import { Design } from '@/constants/design';
import { useAuth } from '@/contexts/auth-context';
import { useDesignTheme } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import { apiRequest } from '@/lib/api';

type AdminTab = 'users' | 'moderation' | 'reports';

type AdminStats = {
  totalUsers: number;
  totalVideos: number;
  totalViews: number;
  pendingModeration: number;
  pendingReports: number;
};
type AdminUser = {
  id: string;
  username: string;
  fullName: string;
  role: 'user' | 'creator' | 'admin';
  isActive: boolean;
  videosCount: number;
};
type AdminPendingVideo = {
  id: string;
  title: string;
  category: string;
  visibility: string;
  sourceType: string;
  createdAt: string;
  creator?: { username?: string; fullName?: string } | null;
};
type AdminReport = {
  id: string;
  targetType: 'video' | 'user' | 'comment';
  targetId: string;
  reason: string;
  details?: string;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  createdAt: string;
  reporter?: { username?: string; fullName?: string } | null;
  targetDetails?: { title?: string; username?: string; text?: string } | null;
};

const ROLES: AdminUser['role'][] = ['user', 'creator', 'admin'];

export default function AdminScreen() {
  const { user, loading: authLoading } = useAuth();
  const { colors, isDark } = useDesignTheme();
  const { showToast } = useToast();

  const [tab, setTab] = useState<AdminTab>('users');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pendingVideos, setPendingVideos] = useState<AdminPendingVideo[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    const [statsRes, usersRes, pendingRes, reportsRes] = await Promise.all([
      apiRequest<AdminStats>('/api/admin/stats'),
      apiRequest<AdminUser[]>('/api/admin/users?page=1&limit=25'),
      apiRequest<AdminPendingVideo[]>('/api/admin/videos/pending?page=1&limit=25'),
      apiRequest<AdminReport[]>('/api/admin/reports?page=1&limit=25'),
    ]);
    return {
      stats: statsRes.data,
      users: usersRes.data || [],
      pendingVideos: pendingRes.data || [],
      reports: reportsRes.data || [],
    };
  }, []);

  const reloadAll = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        const result = await fetchDashboard();
        setStats(result.stats);
        setUsers(result.users);
        setPendingVideos(result.pendingVideos);
        setReports(result.reports);
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : 'Could not load the admin dashboard.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetchDashboard]
  );

  useEffect(() => {
    if (user?.role !== 'admin') return;
    let active = true;
    void fetchDashboard()
      .then((result) => {
        if (!active) return;
        setStats(result.stats);
        setUsers(result.users);
        setPendingVideos(result.pendingVideos);
        setReports(result.reports);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Could not load the admin dashboard.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user?.role, fetchDashboard]);

  if (authLoading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }
  if (user?.role !== 'admin') return <Redirect href="/main/profile" />;

  const updateRole = async (target: AdminUser, role: AdminUser['role']) => {
    setBusyId(target.id);
    setError('');
    try {
      await apiRequest(`/api/admin/users/${encodeURIComponent(target.id)}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      showToast(`Updated @${target.username} to ${role}`);
      await reloadAll(true);
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : 'Could not update this role.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setBusyId('');
    }
  };

  const handleApproveVideo = async (video: AdminPendingVideo) => {
    setBusyId(video.id);
    try {
      await apiRequest(`/api/admin/videos/${encodeURIComponent(video.id)}/approve`, {
        method: 'PATCH',
      });
      showToast(`Approved "${video.title}"`);
      await reloadAll(true);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Approval failed', 'error');
    } finally {
      setBusyId('');
    }
  };

  const handleRejectVideo = (video: AdminPendingVideo) => {
    Alert.alert(
      'Reject video',
      `Reject "${video.title}" and hide it from public feeds?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setBusyId(video.id);
            try {
              await apiRequest(`/api/admin/videos/${encodeURIComponent(video.id)}/reject`, {
                method: 'PATCH',
                body: JSON.stringify({ reason: 'Did not meet community moderation guidelines' }),
              });
              showToast(`Rejected "${video.title}"`);
              await reloadAll(true);
            } catch (cause) {
              showToast(cause instanceof Error ? cause.message : 'Rejection failed', 'error');
            } finally {
              setBusyId('');
            }
          },
        },
      ]
    );
  };

  const handleUpdateReport = async (
    report: AdminReport,
    status: 'resolved' | 'dismissed'
  ) => {
    setBusyId(report.id);
    try {
      await apiRequest(`/api/admin/reports/${encodeURIComponent(report.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          resolutionNotes: status === 'resolved' ? 'Reviewed and actioned by admin' : 'Dismissed after review',
        }),
      });
      showToast(`Report marked ${status}`);
      await reloadAll(true);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Could not update report', 'error');
    } finally {
      setBusyId('');
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          style={styles.backBtn}
        >
          <SymbolView
            name={{ ios: 'chevron.backward', android: 'arrow_back', web: 'arrow_back' }}
            size={22}
            tintColor={colors.text}
          />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>Admin Console</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Moderation, reports & roles
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void reloadAll(true)}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {error ? (
          <ErrorState message={error} onRetry={() => void reloadAll(false)} />
        ) : null}

        {loading && !stats ? (
          <ActivityIndicator style={styles.loader} color={colors.accent} />
        ) : null}

        {stats ? (
          <View style={styles.stats}>
            {(
              [
                ['Users', stats.totalUsers],
                ['Videos', stats.totalVideos],
                ['Views', stats.totalViews],
                ['Pending', stats.pendingModeration],
                ['Reports', stats.pendingReports],
              ] as const
            ).map(([label, value]) => (
              <View
                key={label}
                style={[
                  styles.stat,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {value.toLocaleString()}
                </Text>
                <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Section Tabs */}
        <View style={[styles.tabRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {(
            [
              { id: 'users', label: `Users (${users.length})` },
              { id: 'moderation', label: `Pending (${pendingVideos.length})` },
              { id: 'reports', label: `Reports (${reports.length})` },
            ] as const
          ).map((item) => {
            const active = tab === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setTab(item.id)}
                style={[
                  styles.tabBtn,
                  active && { backgroundColor: colors.accent },
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    { color: active ? '#ffffff' : colors.secondary },
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'users' ? (
          users.length === 0 && !loading ? (
            <EmptyState
              icon={{ ios: 'person.2', android: 'group', web: 'group' }}
              title="No accounts found"
              description="Registered accounts will appear here."
            />
          ) : (
            users.map((account) => {
              const nextRole = ROLES[(ROLES.indexOf(account.role) + 1) % ROLES.length];
              return (
                <View
                  key={account.id}
                  style={[
                    styles.card,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.cardInfo}>
                    <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
                      {account.fullName || account.username}
                    </Text>
                    <Text style={[styles.meta, { color: colors.secondary }]}>
                      @{account.username} · {account.videosCount} uploads
                    </Text>
                    <Text style={[styles.meta, { color: colors.muted }]}>
                      Role: {account.role}
                      {account.isActive ? '' : ' · inactive'}
                    </Text>
                  </View>
                  {account.id !== user.id ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Change ${account.username} role to ${nextRole}`}
                      disabled={busyId === account.id}
                      onPress={() => void updateRole(account, nextRole)}
                      style={[styles.pillBtn, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
                    >
                      {busyId === account.id ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <Text style={[styles.pillBtnText, { color: colors.accent }]}>
                          Set {nextRole}
                        </Text>
                      )}
                    </Pressable>
                  ) : (
                    <Text style={[styles.meta, { color: colors.muted }]}>You</Text>
                  )}
                </View>
              );
            })
          )
        ) : null}

        {tab === 'moderation' ? (
          pendingVideos.length === 0 && !loading ? (
            <EmptyState
              icon={{ ios: 'checkmark.shield', android: 'verified_user', web: 'verified_user' }}
              title="Moderation queue is clear"
              description="All submitted videos have been reviewed."
            />
          ) : (
            pendingVideos.map((video) => (
              <View
                key={video.id}
                style={[
                  styles.stackCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                  {video.title}
                </Text>
                <Text style={[styles.meta, { color: colors.secondary }]}>
                  By @{video.creator?.username || 'creator'} · {video.category} · {video.sourceType}
                </Text>
                <View style={styles.actionRow}>
                  <Pressable
                    disabled={busyId === video.id}
                    onPress={() => void handleApproveVideo(video)}
                    style={[styles.approveBtn, { backgroundColor: colors.successSurface }]}
                  >
                    {busyId === video.id ? (
                      <ActivityIndicator size="small" color={colors.success} />
                    ) : (
                      <Text style={[styles.pillBtnText, { color: colors.success }]}>Approve</Text>
                    )}
                  </Pressable>
                  <Pressable
                    disabled={busyId === video.id}
                    onPress={() => handleRejectVideo(video)}
                    style={[styles.rejectBtn, { backgroundColor: colors.dangerSurface }]}
                  >
                    <Text style={[styles.pillBtnText, { color: colors.danger }]}>Reject</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )
        ) : null}

        {tab === 'reports' ? (
          reports.length === 0 && !loading ? (
            <EmptyState
              icon={{ ios: 'flag', android: 'flag', web: 'flag' }}
              title="No reports yet"
              description="User-submitted content reports will appear here for review."
            />
          ) : (
            reports.map((report) => (
              <View
                key={report.id}
                style={[
                  styles.stackCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.reportTop}>
                  <Text style={[styles.name, { color: colors.text }]}>
                    {report.targetType.toUpperCase()} · {report.reason.replace(/_/g, ' ')}
                  </Text>
                  <Text style={[styles.statusBadge, { color: colors.accent }]}>
                    {report.status}
                  </Text>
                </View>
                <Text style={[styles.meta, { color: colors.secondary }]}>
                  Reported by @{report.reporter?.username || 'user'}
                  {report.targetDetails?.title ? ` · "${report.targetDetails.title}"` : ''}
                  {report.targetDetails?.text ? ` · "${report.targetDetails.text}"` : ''}
                </Text>
                {report.status === 'pending' || report.status === 'investigating' ? (
                  <View style={styles.actionRow}>
                    <Pressable
                      disabled={busyId === report.id}
                      onPress={() => void handleUpdateReport(report, 'resolved')}
                      style={[styles.approveBtn, { backgroundColor: colors.successSurface }]}
                    >
                      <Text style={[styles.pillBtnText, { color: colors.success }]}>Resolve</Text>
                    </Pressable>
                    <Pressable
                      disabled={busyId === report.id}
                      onPress={() => void handleUpdateReport(report, 'dismissed')}
                      style={[styles.rejectBtn, { backgroundColor: colors.surfaceRaised }]}
                    >
                      <Text style={[styles.pillBtnText, { color: colors.secondary }]}>Dismiss</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))
          )
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { ...Design.typography.title },
  subtitle: { ...Design.typography.caption },
  content: { padding: 14, paddingBottom: 36, gap: 12 },
  loader: { marginVertical: 20 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: {
    minWidth: '30%',
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Design.radius.md,
    padding: 12,
  },
  statValue: { fontSize: 19, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
  tabRow: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: Design.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: Design.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabLabel: { fontSize: 12, fontWeight: '700' },
  card: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Design.radius.md,
  },
  stackCard: {
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Design.radius.md,
    gap: 6,
  },
  cardInfo: { flex: 1, gap: 2 },
  name: { ...Design.typography.subheading },
  meta: { ...Design.typography.caption },
  pillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: Design.radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillBtnText: { fontSize: 12, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  approveBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: Design.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: Design.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusBadge: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
