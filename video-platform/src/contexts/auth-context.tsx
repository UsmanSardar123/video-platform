import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  apiRequest, clearStoredSession, readStoredSession, signIn, signOut,
  signUp, subscribeToSessionExpiry, updateStoredUser,
  type SessionUser,
} from '@/lib/api';

type RegisterInput = { username: string; fullName: string; email: string; password: string };
type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (input: Pick<SessionUser, 'username' | 'fullName' | 'email' | 'bio'>) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: import('react').ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => subscribeToSessionExpiry(() => setUser(null)), []);

  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      try {
        const stored = await readStoredSession();
        if (!stored.accessToken || !stored.refreshToken || !stored.user) {
          if (stored.accessToken || stored.refreshToken) await clearStoredSession();
          return;
        }
        if (mounted) setUser(stored.user);
        try {
          const result = await apiRequest<{ user: SessionUser }>('/api/users/me');
          if (mounted) {
            setUser(result.data.user);
            await updateStoredUser(result.data.user);
          }
        } catch {
          // Keep the restored session for transient network errors; a rejected refresh clears it.
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void restore();
    return () => { mounted = false; };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setUser(await signIn(email, password));
  }, []);
  const register = useCallback(async (input: RegisterInput) => {
    setUser(await signUp(input));
  }, []);
  const logout = useCallback(async () => {
    try { await signOut(); } finally { setUser(null); }
  }, []);
  const updateProfile = useCallback(async (input: Pick<SessionUser, 'username' | 'fullName' | 'email' | 'bio'>) => {
    const result = await apiRequest<{ user: SessionUser }>('/api/users/me', {
      method: 'PATCH', body: JSON.stringify(input),
    });
    setUser(result.data.user);
    await updateStoredUser(result.data.user);
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    await apiRequest('/api/users/me', { method: 'DELETE', body: JSON.stringify({ password }) });
    await clearStoredSession();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout, updateProfile, deleteAccount }), [
    user, loading, login, register, logout, updateProfile, deleteAccount,
  ]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
