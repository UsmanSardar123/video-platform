import { Platform } from 'react-native';
import type { SessionUser, ApiEnvelope } from './api';
import type { VideoRecord } from '@/types/video';

const MOCK_USERS_KEY = 'streanub_mock_users';
const MOCK_VIDEOS_KEY = 'streanub_mock_videos';

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

const INITIAL_VIDEOS: VideoRecord[] = [
  {
    _id: 'vid_1',
    title: 'React 19 Complete Guide & Practical Architecture',
    description: 'A comprehensive walkthrough of React 19 features, hooks, component design, and state management.',
    videoUrl: 'https://www.youtube.com/watch?v=8pDqJVdNa44',
    thumbnailUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
    creator: {
      _id: 'user_sarah_2',
      username: 'sarah_dev',
      fullName: 'Sarah Chen',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160',
    },
    category: 'Education',
    visibility: 'public',
    sourceType: 'youtube',
    duration: 742,
    views: 1420,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    _id: 'vid_2',
    title: 'Building Fluid Mobile & Web UI in React Native',
    description: 'Learn how to create responsive, accessible layouts that adapt smoothly from phone screens to desktop browsers.',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800',
    creator: {
      _id: 'user_alex_1',
      username: 'alex',
      fullName: 'Alex Rivera',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160',
    },
    category: 'Technology',
    visibility: 'public',
    sourceType: 'cloudinary',
    duration: 596,
    views: 980,
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    _id: 'vid_3',
    title: 'Design Systems & Component Tokens',
    description: 'How to build scalable, themeable component libraries using design tokens and CSS variables.',
    videoUrl: 'https://vimeo.com/76979871',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800',
    creator: {
      _id: 'user_sarah_2',
      username: 'sarah_dev',
      fullName: 'Sarah Chen',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160',
    },
    category: 'Design',
    visibility: 'public',
    sourceType: 'vimeo',
    duration: 480,
    views: 654,
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    _id: 'vid_4',
    title: 'Lo-Fi Chill Coding Beats & Study Stream',
    description: 'Relaxing ambient beats for coding sessions, problem solving, and late night development.',
    videoUrl: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    thumbnailUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800',
    creator: {
      _id: 'user_alex_1',
      username: 'alex',
      fullName: 'Alex Rivera',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160',
    },
    category: 'Music',
    visibility: 'public',
    sourceType: 'youtube',
    duration: 3600,
    views: 3120,
    createdAt: new Date(Date.now() - 86400000 * 8).toISOString(),
  },
  {
    _id: 'vid_5',
    title: 'Live Coding: Interactive Dashboard in React',
    description: 'Building an interactive video analytics dashboard with real-time state and responsive layouts.',
    videoUrl: 'https://www.twitch.tv/videos/1234567890',
    thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
    creator: {
      _id: 'user_alex_1',
      username: 'alex',
      fullName: 'Alex Rivera',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=160',
    },
    category: 'Technology',
    visibility: 'public',
    sourceType: 'twitch',
    duration: 1820,
    views: 840,
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
];

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

  // 3. Videos routes
  if (pathname === '/api/videos' && method === 'GET') {
    const videos = getMockVideos();
    const category = params.get('category');
    const limit = parseInt(params.get('limit') || '50', 10);
    let filtered = videos.filter((v) => v.visibility === 'public');
    if (category && category !== 'All') {
      filtered = filtered.filter((v) => v.category.toLowerCase() === category.toLowerCase());
    }
    return { success: true, data: filtered.slice(0, limit) as unknown as T };
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
    const page = parseInt(params.get('page') || '1', 10);
    const limit = parseInt(params.get('limit') || '20', 10);

    let list = getMockVideos().filter((v) => v.visibility === 'public');

    if (sourceType && sourceType !== 'all') {
      list = list.filter((v) => v.sourceType === sourceType);
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
      category: category || 'General',
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
      category: category || 'General',
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

  throw new Error(`Mock endpoint not found: ${method} ${pathname}`);
}
