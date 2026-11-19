import { Platform } from 'react-native';
import type { SessionUser, ApiEnvelope } from './api';
import type { VideoRecord } from '@/types/video';
import { VIDEO_CATEGORIES } from '@/constants/categories';

const MOCK_USERS_KEY = 'streanub_mock_users';
const MOCK_VIDEOS_KEY = 'streanub_mock_videos_real_only';

const inMemoryStore = new Map<string, string>();

function getStorageItem(key: string): string | null {
  if (Platform.OS === 'web') {
    try {
      return globalThis.localStorage?.getItem(key) ?? inMemoryStore.get(key) ?? null;
    } catch {
      return inMemoryStore.get(key) ?? null;
    }
  }
  return inMemoryStore.get(key) ?? null;
}

function setStorageItem(key: string, value: string): void {
  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Fallback to memory
    }
  }
  inMemoryStore.set(key, value);
}

const INITIAL_USERS: (SessionUser & { password: string })[] = [
  {
    id: 'user_alex_1',
    username: 'alex',
    fullName: 'Alex Rivera',
    email: 'alex@example.com',
    password: 'password123',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160',
    bio: 'Frontend developer and video content creator.',
    role: 'creator',
  },
  {
    id: 'user_sarah_2',
    username: 'sarah_dev',
    fullName: 'Sarah Chen',
    email: 'sarah@example.com',
    password: 'password123',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160',
    bio: 'React and UI design enthusiast sharing tutorials.',
    role: 'creator',
  },
];

// No predefined/default videos — only real user uploads via link or file are kept
const INITIAL_VIDEOS: VideoRecord[] = [];

export function getMockUsers(): (SessionUser & { password: string })[] {
  const raw = getStorageItem(MOCK_USERS_KEY);
  if (!raw) {
    setStorageItem(MOCK_USERS_KEY, JSON.stringify(INITIAL_USERS));
    return [...INITIAL_USERS];
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [...INITIAL_USERS];
  }
}

export function saveMockUsers(users: (SessionUser & { password: string })[]): void {
  setStorageItem(MOCK_USERS_KEY, JSON.stringify(users));
}

const MOCK_SUBSCRIPTIONS_KEY = 'streanub_mock_subscriptions';
const MOCK_INTERACTIONS_KEY = 'streanub_mock_interactions';
const MOCK_COMMENTS_KEY = 'streanub_mock_comments';
const MOCK_REVIEWS_KEY = 'streanub_mock_reviews';

export interface MockSubscription {
  subscriberId: string;
  creatorId: string;
  createdAt: string;
}

export interface MockReview {
  _id: string;
  creatorId: string;
  reviewer: {
    _id: string;
    username: string;
    fullName: string;
    avatar?: string;
  };
  rating: number;
  comment?: string;
  createdAt: string;
}

export function getMockReviews(): MockReview[] {
  const raw = getStorageItem(MOCK_REVIEWS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveMockReviews(items: MockReview[]): void {
  setStorageItem(MOCK_REVIEWS_KEY, JSON.stringify(items));
}

export interface MockInteraction {
  userId: string;
  videoId: string;
  liked?: boolean;
  disliked?: boolean;
  watchLater?: boolean;
  watchedAt?: string;
}

export interface MockComment {
  _id: string;
  videoId: string;
  user: {
    _id: string;
    username: string;
    fullName: string;
    avatar?: string;
  };
  text: string;
  createdAt: string;
}

export function getMockSubscriptions(): MockSubscription[] {
  const raw = getStorageItem(MOCK_SUBSCRIPTIONS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveMockSubscriptions(items: MockSubscription[]): void {
  setStorageItem(MOCK_SUBSCRIPTIONS_KEY, JSON.stringify(items));
}

export function getMockInteractions(): MockInteraction[] {
  const raw = getStorageItem(MOCK_INTERACTIONS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveMockInteractions(items: MockInteraction[]): void {
  setStorageItem(MOCK_INTERACTIONS_KEY, JSON.stringify(items));
}

export function getMockComments(): MockComment[] {
  const raw = getStorageItem(MOCK_COMMENTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveMockComments(items: MockComment[]): void {
  setStorageItem(MOCK_COMMENTS_KEY, JSON.stringify(items));
}

export function getMockVideos(): VideoRecord[] {
  const raw = getStorageItem(MOCK_VIDEOS_KEY);
  if (!raw) {
    setStorageItem(MOCK_VIDEOS_KEY, JSON.stringify(INITIAL_VIDEOS));
    return [...INITIAL_VIDEOS];
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [...INITIAL_VIDEOS];
  }
}

export function saveMockVideos(videos: VideoRecord[]): void {
  setStorageItem(MOCK_VIDEOS_KEY, JSON.stringify(videos));
}

function parseYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

export async function handleMockRequest<T>(
  path: string,
  init?: RequestInit,
  currentUser?: SessionUser | null
): Promise<ApiEnvelope<T>> {
  const method = (init?.method || 'GET').toUpperCase();
  const [pathname, queryString] = path.split('?');
  const params = new URLSearchParams(queryString || '');
  let bodyData: any = {};
  if (init?.body && typeof init.body === 'string') {
    try {
      bodyData = JSON.parse(init.body);
    } catch {}
  }

  // 1. Auth routes
  if (pathname === '/api/auth/register' && method === 'POST') {
    const { username, fullName, email, password } = bodyData;
    if (!username || !email || !password) {
      throw new Error('Username, email, and password are required.');
    }
    const users = getMockUsers();
    const existing = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() || u.username.toLowerCase() === username.toLowerCase()
    );
    if (existing) {
      throw new Error('An account with this email or username already exists.');
    }
    const newUser: SessionUser & { password: string } = {
      id: `user_${Date.now()}`,
      username: username.trim().toLowerCase(),
      fullName: (fullName || username).trim(),
      email: email.trim().toLowerCase(),
      password,
      avatar: '',
      bio: '',
      role: 'creator',
    };
    users.push(newUser);
    saveMockUsers(users);
    const { password: _, ...safeUser } = newUser;
    return {
      success: true,
      message: 'Account registered successfully.',
      data: {
        accessToken: `mock_jwt_${newUser.id}_${Date.now()}`,
        refreshToken: `mock_refresh_${newUser.id}_${Date.now()}`,
        user: safeUser,
      } as unknown as T,
    };
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const { email, password } = bodyData;
    if (!email || !password) throw new Error('Email and password are required.');
    const users = getMockUsers();
    const user = users.find(
      (u) => (u.email.toLowerCase() === email.toLowerCase() || u.username.toLowerCase() === email.toLowerCase()) && u.password === password
    );
    if (!user) throw new Error('Invalid email or password.');
    const { password: _, ...safeUser } = user;
    return {
      success: true,
      message: 'Signed in successfully.',
      data: {
        accessToken: `mock_jwt_${user.id}_${Date.now()}`,
        refreshToken: `mock_refresh_${user.id}_${Date.now()}`,
        user: safeUser,
      } as unknown as T,
    };
  }

  if (pathname === '/api/auth/refresh' && method === 'POST') {
    const users = getMockUsers();
    const fallbackUser = users[0] || INITIAL_USERS[0];
    const { password: _, ...safeUser } = fallbackUser;
    return {
      success: true,
      data: {
        accessToken: `mock_jwt_refreshed_${Date.now()}`,
        refreshToken: `mock_refresh_refreshed_${Date.now()}`,
        user: safeUser,
      } as unknown as T,
    };
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    return { success: true, message: 'Logged out successfully.', data: null as unknown as T };
  }

  // 2. User profile routes
  if (pathname === '/api/users/me') {
    if (method === 'GET') {
      const users = getMockUsers();
      const user = currentUser ? users.find((u) => u.id === currentUser.id) : null;
      if (!user) {
        if (currentUser) return { success: true, data: { user: currentUser } as unknown as T };
        throw new Error('Authentication required.');
      }
      const { password: _, ...safeUser } = user;
      return { success: true, data: { user: safeUser } as unknown as T };
    }
    if (method === 'PATCH') {
      if (!currentUser) throw new Error('Authentication required.');
      const users = getMockUsers();
      const index = users.findIndex((u) => u.id === currentUser.id);
      if (index === -1) throw new Error('User not found.');
      const updated = {
        ...users[index],
        fullName: bodyData.fullName || users[index].fullName,
        username: (bodyData.username || users[index].username).toLowerCase(),
        email: (bodyData.email || users[index].email).toLowerCase(),
        bio: bodyData.bio !== undefined ? bodyData.bio : users[index].bio,
        avatar: bodyData.avatar !== undefined ? bodyData.avatar : users[index].avatar,
      };
      users[index] = updated;
      saveMockUsers(users);

      // Update creator info on user's videos
      const videos = getMockVideos();
      const updatedVideos = videos.map((v) => {
        if (typeof v.creator === 'object' && v.creator && v.creator._id === currentUser.id) {
          return {
            ...v,
            creator: {
              _id: updated.id,
              username: updated.username,
              fullName: updated.fullName,
              avatar: updated.avatar,
            },
          };
        }
        return v;
      });
      saveMockVideos(updatedVideos);

      const { password: _, ...safeUser } = updated;
      return { success: true, message: 'Profile updated.', data: { user: safeUser } as unknown as T };
    }
    if (method === 'DELETE') {
      if (!currentUser) throw new Error('Authentication required.');
      const users = getMockUsers();
      const user = users.find((u) => u.id === currentUser.id);
      if (!user || user.password !== bodyData.password) {
        throw new Error('Current password is required to delete your account.');
      }
      saveMockUsers(users.filter((u) => u.id !== currentUser.id));
      const videos = getMockVideos();
      saveMockVideos(videos.filter((v) => {
        const creatorId = typeof v.creator === 'object' ? v.creator?._id : v.creator;
        return creatorId !== currentUser.id;
      }));
      return { success: true, message: 'Account deleted.', data: null as unknown as T };
    }
  }

  if (pathname === '/api/users/me/change-password' && method === 'POST') {
    if (!currentUser) throw new Error('Authentication required.');
    const { currentPassword, newPassword } = bodyData;
    if (!currentPassword || !newPassword) throw new Error('Current and new password are required.');
    if (newPassword.length < 8) throw new Error('New password must be at least 8 characters.');
    const users = getMockUsers();
    const userIndex = users.findIndex((u) => u.id === currentUser.id);
    if (userIndex === -1) throw new Error('User not found.');
    if (users[userIndex].password !== currentPassword) {
      throw new Error('Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new Error('New password must be different from your current password.');
    }
    users[userIndex].password = newPassword;
    saveMockUsers(users);
    return { success: true, message: 'Password changed successfully. Please sign in again.', data: null as unknown as T };
  }

  if (pathname === '/api/users/me/change-email' && method === 'POST') {
    if (!currentUser) throw new Error('Authentication required.');
    const { password, email } = bodyData;
    if (!password || !email) throw new Error('Password and email are required.');
    const users = getMockUsers();
    const userIndex = users.findIndex((u) => u.id === currentUser.id);
    if (userIndex === -1) throw new Error('User not found.');
    if (users[userIndex].password !== password) {
      throw new Error('Current password is incorrect');
    }
    const normalized = email.trim().toLowerCase();
    const conflict = users.find((u) => u.id !== currentUser.id && u.email.toLowerCase() === normalized);
    if (conflict) throw new Error('Email is already registered.');
    users[userIndex].email = normalized;
    saveMockUsers(users);
    const { password: _, ...safeUser } = users[userIndex];
    return { success: true, message: 'Email changed successfully', data: { user: safeUser } as unknown as T };
  }

  // 2b. Public User Profile route
  if (pathname.startsWith('/api/users/') && pathname !== '/api/users/me' && method === 'GET') {
    const targetUserId = decodeURIComponent(pathname.replace('/api/users/', ''));
    const users = getMockUsers();
    const targetUser = users.find((u) => u.id === targetUserId);
    if (!targetUser) {
      const videos = getMockVideos();
      const videoWithCreator = videos.find((v) => {
        const cId = typeof v.creator === 'object' ? v.creator?._id : v.creator;
        return cId === targetUserId;
      });
      if (videoWithCreator && typeof videoWithCreator.creator === 'object' && videoWithCreator.creator) {
        const c = videoWithCreator.creator;
        return {
          success: true,
          data: {
            user: {
              id: c._id,
              _id: c._id,
              username: c.username,
              fullName: c.fullName,
              avatar: c.avatar,
              bio: '',
              role: 'creator',
            },
          } as unknown as T,
        };
      }
      throw new Error('User not found.');
    }
    const { password: _, ...safeUser } = targetUser;
    return {
      success: true,
      data: {
        user: {
          ...safeUser,
          _id: safeUser.id,
        },
      } as unknown as T,
    };
  }

  // 3. Videos routes
  if (pathname === '/api/videos' && method === 'GET') {
    const videos = getMockVideos();
    const category = params.get('category');
    const creatorParam = params.get('creator');
    const limit = Math.min(50, Math.max(1, parseInt(params.get('limit') || '20', 10)));
    const page = Math.max(1, parseInt(params.get('page') || '1', 10));
    let filtered = videos.filter((v) => v.visibility === 'public');
    if (creatorParam) {
      filtered = filtered.filter((v) => {
        const creatorId = typeof v.creator === 'object' ? v.creator?._id : v.creator;
        return creatorId === creatorParam;
      });
    }
    if (category && category.trim() && category.trim().toLowerCase() !== 'all') {
      const cat = category.trim().toLowerCase();
      if (cat === 'other') {
        filtered = filtered.filter(
          (v) =>
            !v.category ||
            v.category.toLowerCase() === 'other' ||
            v.category.toLowerCase() === 'general' ||
            !VIDEO_CATEGORIES.some((c) => c.toLowerCase() === (v.category || '').toLowerCase())
        );
      } else {
        filtered = filtered.filter((v) => (v.category || '').toLowerCase() === cat);
      }
    }
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);
    return {
      success: true,
      data: paginated as unknown as T,
      pagination: { page, limit, total, totalPages },
    } as unknown as ApiEnvelope<T>;
  }

  if (pathname === '/api/videos/mine' && method === 'GET') {
    if (!currentUser) throw new Error('Authentication required.');
    const videos = getMockVideos();
    const mine = videos.filter((v) => {
      const creatorId = typeof v.creator === 'object' ? v.creator?._id : v.creator;
      return creatorId === currentUser.id;
    });
    return { success: true, data: mine as unknown as T };
  }

  // 3a. Library routes
  if (pathname === '/api/videos/library/watch-later' && method === 'GET') {
    if (!currentUser) throw new Error('Authentication required.');
    const interactions = getMockInteractions().filter((i) => i.userId === currentUser.id && i.watchLater);
    const videos = getMockVideos();
    const list = interactions
      .map((i) => videos.find((v) => v._id === i.videoId))
      .filter((v): v is VideoRecord => Boolean(v && v.visibility === 'public'));
    return { success: true, data: list as unknown as T };
  }

  if (pathname === '/api/videos/library/liked' && method === 'GET') {
    if (!currentUser) throw new Error('Authentication required.');
    const interactions = getMockInteractions().filter((i) => i.userId === currentUser.id && i.liked);
    const videos = getMockVideos();
    const list = interactions
      .map((i) => videos.find((v) => v._id === i.videoId))
      .filter((v): v is VideoRecord => Boolean(v && v.visibility === 'public'));
    return { success: true, data: list as unknown as T };
  }

  if (pathname === '/api/videos/library/history') {
    if (!currentUser) throw new Error('Authentication required.');
    if (method === 'GET') {
      const interactions = getMockInteractions()
        .filter((i) => i.userId === currentUser.id && i.watchedAt)
        .sort((a, b) => new Date(b.watchedAt || '').getTime() - new Date(a.watchedAt || '').getTime());
      const videos = getMockVideos();
      const list = interactions
        .map((i) => {
          const v = videos.find((vid) => vid._id === i.videoId);
          return v ? { ...v, watchedAt: i.watchedAt } : null;
        })
        .filter((v): v is VideoRecord & { watchedAt: string } => Boolean(v && v.visibility === 'public'));
      return { success: true, data: list as unknown as T };
    }
    if (method === 'DELETE') {
      const interactions = getMockInteractions().map((i) =>
        i.userId === currentUser.id ? { ...i, watchedAt: undefined } : i
      );
      saveMockInteractions(interactions);
      return { success: true, message: 'History cleared', data: null as unknown as T };
    }
  }

  if (pathname.startsWith('/api/videos/library/history/') && method === 'DELETE') {
    if (!currentUser) throw new Error('Authentication required.');
    const videoId = decodeURIComponent(pathname.replace('/api/videos/library/history/', ''));
    const interactions = getMockInteractions().map((i) =>
      i.userId === currentUser.id && i.videoId === videoId ? { ...i, watchedAt: undefined } : i
    );
    saveMockInteractions(interactions);
    return { success: true, message: 'History item removed', data: null as unknown as T };
  }

  // 3b. Video interaction routes
  if (pathname.match(/^\/api\/videos\/[^/]+\/view$/) && method === 'POST') {
    const videoId = pathname.split('/')[3];
    const videos = getMockVideos();
    const index = videos.findIndex((v) => v._id === videoId);
    let views = 1;
    if (index !== -1) {
      videos[index].views = (videos[index].views || 0) + 1;
      views = videos[index].views || 1;
      saveMockVideos(videos);
    }
    return { success: true, data: { views } as unknown as T };
  }

  if (pathname.match(/^\/api\/videos\/[^/]+\/like$/) && method === 'POST') {
    if (!currentUser) throw new Error('Authentication required.');
    const videoId = pathname.split('/')[3];
    const action = bodyData.action || 'like'; // 'like', 'dislike', 'none'
    const interactions = getMockInteractions();
    const idx = interactions.findIndex((i) => i.userId === currentUser.id && i.videoId === videoId);
    const existing = idx !== -1 ? interactions[idx] : { userId: currentUser.id, videoId };

    if (action === 'like') {
      existing.liked = true;
      existing.disliked = false;
    } else if (action === 'dislike') {
      existing.liked = false;
      existing.disliked = true;
    } else {
      existing.liked = false;
      existing.disliked = false;
    }

    if (idx !== -1) interactions[idx] = existing;
    else interactions.push(existing);
    saveMockInteractions(interactions);

    const likeCount = interactions.filter((i) => i.videoId === videoId && i.liked).length;
    return {
      success: true,
      data: {
        liked: action === 'like',
        disliked: action === 'dislike',
        likeCount,
      } as unknown as T,
    };
  }

  if (pathname.match(/^\/api\/videos\/[^/]+\/interaction$/) && method === 'GET') {
    const videoId = pathname.split('/')[3];
    const interactions = getMockInteractions();
    const userInter = currentUser
      ? interactions.find((i) => i.userId === currentUser.id && i.videoId === videoId)
      : null;
    const likeCount = interactions.filter((i) => i.videoId === videoId && i.liked).length;
    return {
      success: true,
      data: {
        liked: Boolean(userInter?.liked),
        disliked: Boolean(userInter?.disliked),
        watchLater: Boolean(userInter?.watchLater),
        likeCount,
      } as unknown as T,
    };
  }

  if (pathname.match(/^\/api\/videos\/[^/]+\/watch-later$/)) {
    if (!currentUser) throw new Error('Authentication required.');
    const videoId = pathname.split('/')[3];
    const save = method === 'POST';
    const interactions = getMockInteractions();
    const idx = interactions.findIndex((i) => i.userId === currentUser.id && i.videoId === videoId);
    if (idx !== -1) {
      interactions[idx].watchLater = save;
    } else {
      interactions.push({ userId: currentUser.id, videoId, watchLater: save });
    }
    saveMockInteractions(interactions);
    return { success: true, data: { watchLater: save } as unknown as T };
  }

  if (pathname.match(/^\/api\/videos\/[^/]+\/history$/) && method === 'POST') {
    if (currentUser) {
      const videoId = pathname.split('/')[3];
      const interactions = getMockInteractions();
      const idx = interactions.findIndex((i) => i.userId === currentUser.id && i.videoId === videoId);
      if (idx !== -1) {
        interactions[idx].watchedAt = new Date().toISOString();
      } else {
        interactions.push({
          userId: currentUser.id,
          videoId,
          watchedAt: new Date().toISOString(),
        });
      }
      saveMockInteractions(interactions);
    }
    return { success: true, data: null as unknown as T };
  }

  // 3c. Video comment routes
  if (pathname.match(/^\/api\/videos\/[^/]+\/comments$/)) {
    const videoId = pathname.split('/')[3];
    if (method === 'GET') {
      const comments = getMockComments()
        .filter((c) => c.videoId === videoId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return { success: true, data: comments as unknown as T };
    }
    if (method === 'POST') {
      if (!currentUser) throw new Error('Authentication required.');
      const text = (bodyData.text || '').trim();
      if (!text) throw new Error('Comment text is required.');
      const newComment: MockComment = {
        _id: `com_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        videoId,
        user: {
          _id: currentUser.id,
          username: currentUser.username,
          fullName: currentUser.fullName,
          avatar: currentUser.avatar,
        },
        text,
        createdAt: new Date().toISOString(),
      };
      const comments = getMockComments();
      comments.unshift(newComment);
      saveMockComments(comments);
      return { success: true, data: newComment as unknown as T };
    }
  }

  if (pathname.match(/^\/api\/videos\/[^/]+\/comments\/[^/]+$/) && method === 'DELETE') {
    if (!currentUser) throw new Error('Authentication required.');
    const commentId = pathname.split('/')[5];
    const comments = getMockComments();
    const comment = comments.find((c) => c._id === commentId);
    if (!comment) throw new Error('Comment not found.');
    if (comment.user._id !== currentUser.id) throw new Error('You can only delete your own comments.');
    saveMockComments(comments.filter((c) => c._id !== commentId));
    return { success: true, message: 'Comment deleted', data: null as unknown as T };
  }

  // 3d. Single video get & delete
  if (pathname.startsWith('/api/videos/') && pathname !== '/api/videos/mine') {
    const videoId = decodeURIComponent(pathname.replace('/api/videos/', ''));
    const videos = getMockVideos();
    if (method === 'GET') {
      const video = videos.find((v) => v._id === videoId);
      if (!video) throw new Error('Video not found.');
      return { success: true, data: video as unknown as T };
    }
    if (method === 'DELETE') {
      if (!currentUser) throw new Error('Authentication required.');
      const video = videos.find((v) => v._id === videoId);
      if (!video) throw new Error('Video not found.');
      const creatorId = typeof video.creator === 'object' ? video.creator?._id : video.creator;
      if (creatorId !== currentUser.id) throw new Error('You can only delete your own videos.');
      saveMockVideos(videos.filter((v) => v._id !== videoId));
      return { success: true, message: 'Video deleted.', data: null as unknown as T };
    }
  }

  // 4. Search routes
  if (pathname === '/api/search' && method === 'GET') {
    const q = (params.get('q') || '').trim().toLowerCase();
    const creator = (params.get('creator') || '').trim().toLowerCase();
    const sourceType = params.get('sourceType');
    const category = params.get('category');
    const page = parseInt(params.get('page') || '1', 10);
    const limit = parseInt(params.get('limit') || '20', 10);

    let list = getMockVideos().filter((v) => v.visibility === 'public');

    if (sourceType && sourceType !== 'all') {
      list = list.filter((v) => v.sourceType === sourceType);
    }

    if (category && category.trim() && category.trim().toLowerCase() !== 'all') {
      const cat = category.trim().toLowerCase();
      if (cat === 'other') {
        list = list.filter(
          (v) =>
            !v.category ||
            v.category.toLowerCase() === 'other' ||
            v.category.toLowerCase() === 'general' ||
            !VIDEO_CATEGORIES.some((c) => c.toLowerCase() === (v.category || '').toLowerCase())
        );
      } else {
        list = list.filter((v) => (v.category || '').toLowerCase() === cat);
      }
    }

    if (creator) {
      list = list.filter((v) => {
        if (!v.creator || typeof v.creator === 'string') return false;
        return (
          v.creator.username.toLowerCase().includes(creator) ||
          v.creator.fullName.toLowerCase().includes(creator)
        );
      });
    }

    if (q) {
      list = list.filter((v) => {
        const titleMatch = v.title.toLowerCase().includes(q);
        const descMatch = (v.description || '').toLowerCase().includes(q);
        const creatorMatch =
          typeof v.creator === 'object' && v.creator
            ? v.creator.username.toLowerCase().includes(q) || v.creator.fullName.toLowerCase().includes(q)
            : false;
        return titleMatch || descMatch || creatorMatch;
      });
    }

    const total = list.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = list.slice(startIndex, startIndex + limit);

    return {
      success: true,
      data: paginated as unknown as T,
      pagination: { page, limit, total, totalPages },
    } as unknown as ApiEnvelope<T>;
  }

  // 5. Upload signature
  if (pathname === '/api/uploads/signature' && method === 'POST') {
    if (!currentUser) throw new Error('Authentication required.');
    return {
      success: true,
      data: {
        apiKey: 'mock_key',
        timestamp: Date.now(),
        publicId: `mock_${currentUser.id}_${Date.now()}`,
        uploadUrl: 'mock',
        signature: 'mock_signature',
        allowedFormats: ['mp4', 'mov', 'm4v', 'webm'],
        maxBytes: 524288000,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      } as unknown as T,
    };
  }

  // 5b. Avatar upload signature
  if (
    (pathname === '/api/uploads/avatar-signature' || pathname === '/api/upload/avatar-signature') &&
    method === 'POST'
  ) {
    if (!currentUser) throw new Error('Authentication required.');
    return {
      success: true,
      data: {
        apiKey: 'mock_key',
        timestamp: Date.now(),
        publicId: `mock_${currentUser.id}_avatar_${Date.now()}`,
        uploadUrl: 'mock',
        signature: 'mock_signature',
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      } as unknown as T,
    };
  }

  // 6. Upload complete (local file upload)
  if (pathname === '/api/uploads/complete' && method === 'POST') {
    if (!currentUser) throw new Error('Authentication required.');
    const { title, description, category, visibility } = bodyData;
    const newVideo: VideoRecord = {
      _id: `vid_${Date.now()}`,
      title: title || 'Untitled Video',
      description: description || '',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800',
      creator: {
        _id: currentUser.id,
        username: currentUser.username,
        fullName: currentUser.fullName,
        avatar: currentUser.avatar,
      },
      category: category || 'Other',
      visibility: visibility || 'public',
      sourceType: 'cloudinary',
      duration: 120,
      views: 0,
      createdAt: new Date().toISOString(),
    };
    const videos = getMockVideos();
    videos.unshift(newVideo);
    saveMockVideos(videos);
    return { success: true, message: 'Video uploaded successfully.', data: newVideo as unknown as T };
  }

  // 7. External video upload
  if (pathname === '/api/external-videos' && method === 'POST') {
    if (!currentUser) throw new Error('Authentication required.');
    const { title, description, category, visibility, url } = bodyData;
    if (!url) throw new Error('External video URL is required.');

    let sourceType: VideoRecord['sourceType'] = 'youtube';
    let thumbnailUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800';

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      sourceType = 'youtube';
      const ytId = parseYouTubeId(url);
      if (ytId) thumbnailUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    } else if (url.includes('vimeo.com')) {
      sourceType = 'vimeo';
      thumbnailUrl = 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800';
    } else if (url.includes('twitch.tv')) {
      sourceType = 'twitch';
      thumbnailUrl = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800';
    } else {
      throw new Error('Only YouTube, Vimeo, and Twitch URLs are supported.');
    }

    const newVideo: VideoRecord = {
      _id: `vid_ext_${Date.now()}`,
      title: title || 'External Video',
      description: description || '',
      videoUrl: url,
      thumbnailUrl,
      creator: {
        _id: currentUser.id,
        username: currentUser.username,
        fullName: currentUser.fullName,
        avatar: currentUser.avatar,
      },
      category: category || 'Other',
      visibility: visibility || 'public',
      sourceType,
      duration: 180,
      views: 0,
      createdAt: new Date().toISOString(),
    };
    const videos = getMockVideos();
    videos.unshift(newVideo);
    saveMockVideos(videos);
    return { success: true, message: 'External video saved.', data: newVideo as unknown as T };
  }

  // 8. Subscription routes
  if (pathname.startsWith('/api/subscriptions/status/') && method === 'GET') {
    const creatorId = decodeURIComponent(pathname.replace('/api/subscriptions/status/', ''));
    const subscriptions = getMockSubscriptions();
    const isSub = currentUser
      ? subscriptions.some((s) => s.subscriberId === currentUser.id && s.creatorId === creatorId)
      : false;
    const subscriberCount = subscriptions.filter((s) => s.creatorId === creatorId).length;
    return {
      success: true,
      data: { isSubscribed: isSub, subscriberCount } as unknown as T,
    };
  }

  if (pathname.match(/^\/api\/subscriptions\/[^/]+$/) && method === 'POST') {
    if (!currentUser) throw new Error('Authentication required.');
    const creatorId = decodeURIComponent(pathname.replace('/api/subscriptions/', ''));
    if (creatorId === currentUser.id) throw new Error('You cannot subscribe to yourself.');
    const subscriptions = getMockSubscriptions();
    if (!subscriptions.some((s) => s.subscriberId === currentUser.id && s.creatorId === creatorId)) {
      subscriptions.push({
        subscriberId: currentUser.id,
        creatorId,
        createdAt: new Date().toISOString(),
      });
      saveMockSubscriptions(subscriptions);
    }
    const subscriberCount = subscriptions.filter((s) => s.creatorId === creatorId).length;
    return {
      success: true,
      message: 'Subscribed successfully',
      data: { subscribed: true, subscriberCount } as unknown as T,
    };
  }

  if (pathname.match(/^\/api\/subscriptions\/[^/]+$/) && method === 'DELETE') {
    if (!currentUser) throw new Error('Authentication required.');
    const creatorId = decodeURIComponent(pathname.replace('/api/subscriptions/', ''));
    let subscriptions = getMockSubscriptions();
    subscriptions = subscriptions.filter(
      (s) => !(s.subscriberId === currentUser.id && s.creatorId === creatorId)
    );
    saveMockSubscriptions(subscriptions);
    const subscriberCount = subscriptions.filter((s) => s.creatorId === creatorId).length;
    return {
      success: true,
      message: 'Unsubscribed successfully',
      data: { subscribed: false, subscriberCount } as unknown as T,
    };
  }

  if (pathname === '/api/subscriptions' && method === 'GET') {
    if (!currentUser) throw new Error('Authentication required.');
    const subscriptions = getMockSubscriptions().filter((s) => s.subscriberId === currentUser.id);
    const users = getMockUsers();
    const videos = getMockVideos();
    const creators = subscriptions.map((s) => {
      const u = users.find((usr) => usr.id === s.creatorId);
      const subCount = getMockSubscriptions().filter((sub) => sub.creatorId === s.creatorId).length;
      const vidCount = videos.filter((v) => {
        const cId = typeof v.creator === 'object' ? v.creator?._id : v.creator;
        return cId === s.creatorId && v.visibility === 'public';
      }).length;
      return {
        _id: s.creatorId,
        username: u?.username || 'creator',
        fullName: u?.fullName || 'Creator',
        avatar: u?.avatar || '',
        bio: u?.bio || '',
        subscriberCount: subCount,
        videoCount: vidCount,
      };
    });
    return { success: true, data: creators as unknown as T };
  }

  if (pathname === '/api/subscriptions/feed' && method === 'GET') {
    if (!currentUser) throw new Error('Authentication required.');
    const subscriptions = getMockSubscriptions().filter((s) => s.subscriberId === currentUser.id);
    const creatorIds = subscriptions.map((s) => s.creatorId);
    const videos = getMockVideos().filter((v) => {
      const cId = typeof v.creator === 'object' ? v.creator?._id : v.creator;
      return creatorIds.includes(cId || '') && v.visibility === 'public';
    });
    return { success: true, data: videos as unknown as T };
  }

  // 9. Review routes
  if (pathname.match(/^\/api\/users\/[^/]+\/reviews$/) && method === 'GET') {
    const creatorId = pathname.split('/')[3];
    const allReviews = getMockReviews().filter((r) => r.creatorId === creatorId);
    const totalReviews = allReviews.length;
    const averageRating =
      totalReviews > 0
        ? Number((allReviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1))
        : 0;
    const userReview = currentUser
      ? allReviews.find((r) => r.reviewer._id === currentUser.id) || null
      : null;
    return {
      success: true,
      data: {
        reviews: allReviews,
        averageRating,
        totalReviews,
        userReview,
      } as unknown as T,
    };
  }

  if (pathname.match(/^\/api\/users\/[^/]+\/reviews$/) && method === 'POST') {
    if (!currentUser) throw new Error('Authentication required.');
    const creatorId = pathname.split('/')[3];
    if (creatorId === currentUser.id) throw new Error('You cannot review yourself.');

    const rating = Number(bodyData.rating);
    if (!rating || rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5.');

    const reviews = getMockReviews();
    const existingIndex = reviews.findIndex(
      (r) => r.creatorId === creatorId && r.reviewer._id === currentUser.id
    );

    const reviewObj: MockReview = {
      _id: existingIndex !== -1 ? reviews[existingIndex]._id : `rev_${Date.now()}`,
      creatorId,
      reviewer: {
        _id: currentUser.id,
        username: currentUser.username,
        fullName: currentUser.fullName,
        avatar: currentUser.avatar,
      },
      rating,
      comment: typeof bodyData.comment === 'string' ? bodyData.comment.trim() : '',
      createdAt: new Date().toISOString(),
    };

    if (existingIndex !== -1) {
      reviews[existingIndex] = reviewObj;
    } else {
      reviews.unshift(reviewObj);
    }
    saveMockReviews(reviews);

    const creatorReviews = reviews.filter((r) => r.creatorId === creatorId);
    const totalReviews = creatorReviews.length;
    const averageRating = Number(
      (creatorReviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1)
    );

    return {
      success: true,
      message: 'Review submitted successfully',
      data: {
        review: reviewObj,
        averageRating,
        totalReviews,
      } as unknown as T,
    };
  }

  if (pathname.match(/^\/api\/users\/[^/]+\/reviews\/[^/]+$/) && method === 'DELETE') {
    if (!currentUser) throw new Error('Authentication required.');
    const parts = pathname.split('/');
    const creatorId = parts[3];
    const reviewId = parts[5];

    let reviews = getMockReviews();
    reviews = reviews.filter(
      (r) => !(r._id === reviewId && r.creatorId === creatorId && r.reviewer._id === currentUser.id)
    );
    saveMockReviews(reviews);

    const creatorReviews = reviews.filter((r) => r.creatorId === creatorId);
    const totalReviews = creatorReviews.length;
    const averageRating =
      totalReviews > 0
        ? Number((creatorReviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1))
        : 0;

    return {
      success: true,
      message: 'Review deleted',
      data: {
        averageRating,
        totalReviews,
      } as unknown as T,
    };
  }

  throw new Error(`Mock endpoint not found: ${method} ${pathname}`);
}
