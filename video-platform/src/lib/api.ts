import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { handleMockRequest } from './mock-storage';

function resolveApiUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  if (Platform.OS === 'web') {
    const hostname = globalThis.location?.hostname;
    return `http://${hostname || 'localhost'}:5000`;
  }

  const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (Platform.OS === 'android' && !Device.isDevice) {
    // Android emulator loopback points to the emulator; 10.0.2.2 reaches the host.
    return 'http://10.0.2.2:5000';
  }

  if (expoHost) return `http://${expoHost}:5000`;
  return 'http://localhost:5000';
}

const API_URL = resolveApiUrl();
const ACCESS_KEY = 'streanub_access_token';
const REFRESH_KEY = 'streanub_refresh_token';
const USER_KEY = 'streanub_user';

let mockModeActive = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

const getItem = (key: string) => {
  if (Platform.OS === 'web') {
    try {
      return Promise.resolve(globalThis.localStorage?.getItem(key) ?? null);
    } catch {
      return Promise.resolve(null);
    }
  }
  return SecureStore.getItemAsync(key);
};

const setItem = (key: string, value: string) => {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {}
    return Promise.resolve();
  }
  return SecureStore.setItemAsync(key, value);
};

const deleteItem = (key: string) => {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {}
    return Promise.resolve();
  }
  return SecureStore.deleteItemAsync(key);
};

export type SessionUser = {
  id: string;
  username: string;
  email: string;
  fullName: string;
  avatar: string;
  bio: string;
  role: string;
};
export type ApiEnvelope<T> = { success: boolean; message?: string; data: T };
export class ApiRequestError extends Error {
  constructor(message: string, readonly statusCode: number) { super(message); this.name = 'ApiRequestError'; }
}

async function fetchFromApi(path: string, init?: RequestInit) {
  try {
    return await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new Error(`Cannot reach the API at ${API_URL}. Check that the backend is running and the device is on the same network.`);
  }
}

let refreshInFlight: Promise<boolean> | null = null;
const expiredListeners = new Set<() => void>();

export const subscribeToSessionExpiry = (listener: () => void) => {
  expiredListeners.add(listener);
  return () => { expiredListeners.delete(listener); };
};
const notifySessionExpired = () => expiredListeners.forEach((listener) => listener());

export async function readStoredSession() {
  const [accessToken, refreshToken, storedUser] = await Promise.all([
    getItem(ACCESS_KEY), getItem(REFRESH_KEY), getItem(USER_KEY),
  ]);
  let user: SessionUser | null = null;
  try { user = storedUser ? JSON.parse(storedUser) as SessionUser : null; } catch { user = null; }
  return { accessToken, refreshToken, user };
}

async function persistSession(data: { accessToken: string; refreshToken: string; user?: SessionUser }) {
  await Promise.all([
    setItem(ACCESS_KEY, data.accessToken), setItem(REFRESH_KEY, data.refreshToken),
    ...(data.user ? [setItem(USER_KEY, JSON.stringify(data.user))] : []),
  ]);
}

export async function clearStoredSession() {
  await Promise.all([
    deleteItem(ACCESS_KEY), deleteItem(REFRESH_KEY), deleteItem(USER_KEY),
  ]);
  notifySessionExpired();
}

async function authRequest(path: string, input: object) {
  if (mockModeActive) {
    const mockResult = await handleMockRequest<{ accessToken: string; refreshToken: string; user: SessionUser }>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    await persistSession(mockResult.data);
    return mockResult.data.user;
  }

  const response = await fetchFromApi(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || 'Authentication failed');
  await persistSession(result.data);
  return result.data.user as SessionUser;
}

export const signIn = (email: string, password: string) =>
  authRequest('/api/auth/login', { email, password });
export const signUp = (input: { username: string; fullName: string; email: string; password: string }) =>
  authRequest('/api/auth/register', input);

export async function signOut() {
  const { refreshToken } = await readStoredSession();
  try {
    if (refreshToken && !mockModeActive) {
      await fetchFromApi('/api/auth/logout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch {
    // Local credentials are cleared even when offline.
  } finally {
    await clearStoredSession();
  }
}

async function refreshSession() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const { refreshToken } = await readStoredSession();
    if (!refreshToken) {
      await clearStoredSession();
      return false;
    }
    if (mockModeActive) {
      return true;
    }
    try {
      const response = await fetchFromApi('/api/auth/refresh', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const result = await response.json();
      if (!response.ok) {
        await clearStoredSession();
        return false;
      }
      await persistSession(result.data);
      return true;
    } catch {
      throw new Error('Could not refresh your session. Check your connection and retry.');
    }
  })();
  try { return await refreshInFlight; } finally { refreshInFlight = null; }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  let { accessToken, user } = await readStoredSession();

  if (mockModeActive) {
    return handleMockRequest<T>(path, init, user);
  }

  const headers = new Headers(init.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  let response = await fetchFromApi(path, { ...init, headers });
  if (response.status === 401 && accessToken) {
    if (await refreshSession()) {
      ({ accessToken } = await readStoredSession());
      headers.set('Authorization', `Bearer ${accessToken}`);
      response = await fetchFromApi(path, { ...init, headers });
      if (response.status === 401) {
        await clearStoredSession();
        throw new Error('Your session expired. Please sign in again.');
      }
    } else {
      notifySessionExpired();
      throw new Error('Your session expired. Please sign in again.');
    }
  }

  let result: ApiEnvelope<T> & { errors?: { message: string }[] };
  try { result = await response.json(); } catch { throw new Error('The server returned an invalid response.'); }
  if (!response.ok) {
    const details = result.errors?.length ? ` ${result.errors.map((item) => item.message).join(', ')}` : '';
    throw new ApiRequestError(`${result.message || 'Request failed'}${details}`, response.status);
  }
  return result;
}

export async function updateStoredUser(user: SessionUser) {
  await setItem(USER_KEY, JSON.stringify(user));
}

export const apiBaseUrl = API_URL;
