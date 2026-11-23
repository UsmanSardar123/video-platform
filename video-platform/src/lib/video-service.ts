import { Platform } from 'react-native';
import { apiRequest } from './api';
import type {
  VideoRecord,
  VideoInteractionState,
  CommentRecord,
  CreatorProfile,
  CreatorReview,
} from '@/types/video';

export async function fetchVideo(id: string): Promise<VideoRecord> {
  const res = await apiRequest<VideoRecord>(`/api/videos/${encodeURIComponent(id)}`);
  return res.data;
}

export async function recordView(id: string): Promise<number> {
  try {
    const res = await apiRequest<{ views: number }>(`/api/videos/${encodeURIComponent(id)}/view`, {
      method: 'POST',
    });
    return res.data.views;
  } catch {
    return 0;
  }
}

export async function fetchVideoInteraction(id: string): Promise<VideoInteractionState> {
  try {
    const res = await apiRequest<VideoInteractionState>(
      `/api/videos/${encodeURIComponent(id)}/interaction`
    );
    return res.data;
  } catch {
    return { liked: false, disliked: false, watchLater: false, likeCount: 0 };
  }
}

export async function setVideoLike(
  id: string,
  action: 'like' | 'dislike' | 'none'
): Promise<{ liked: boolean; disliked: boolean; likeCount: number }> {
  const res = await apiRequest<{ liked: boolean; disliked: boolean; likeCount: number }>(
    `/api/videos/${encodeURIComponent(id)}/like`,
    {
      method: 'POST',
      body: JSON.stringify({ action }),
    }
  );
  return res.data;
}

export async function setWatchLater(
  id: string,
  save: boolean
): Promise<{ watchLater: boolean }> {
  const res = await apiRequest<{ watchLater: boolean }>(
    `/api/videos/${encodeURIComponent(id)}/watch-later`,
    {
      method: save ? 'POST' : 'DELETE',
    }
  );
  return res.data;
}

export async function recordHistory(id: string): Promise<void> {
  try {
    await apiRequest(`/api/videos/${encodeURIComponent(id)}/history`, {
      method: 'POST',
    });
  } catch {
    // Non-blocking
  }
}

export async function fetchWatchLater(): Promise<VideoRecord[]> {
  const res = await apiRequest<VideoRecord[]>('/api/videos/library/watch-later');
  return res.data || [];
}

export async function fetchLikedVideos(): Promise<VideoRecord[]> {
  const res = await apiRequest<VideoRecord[]>('/api/videos/library/liked');
  return res.data || [];
}

export async function fetchHistory(): Promise<(VideoRecord & { watchedAt?: string })[]> {
  const res = await apiRequest<(VideoRecord & { watchedAt?: string })[]>(
    '/api/videos/library/history'
  );
  return res.data || [];
}

export async function clearHistory(): Promise<void> {
  await apiRequest('/api/videos/library/history', { method: 'DELETE' });
}

export async function removeHistoryItem(id: string): Promise<void> {
  await apiRequest(`/api/videos/library/history/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function fetchComments(videoId: string): Promise<CommentRecord[]> {
  const res = await apiRequest<CommentRecord[]>(
    `/api/videos/${encodeURIComponent(videoId)}/comments`
  );
  return res.data || [];
}

export async function postComment(videoId: string, text: string): Promise<CommentRecord> {
  const res = await apiRequest<CommentRecord>(
    `/api/videos/${encodeURIComponent(videoId)}/comments`,
    {
      method: 'POST',
      body: JSON.stringify({ text }),
    }
  );
  return res.data;
}

export const addVideoComment = postComment;

export async function deleteComment(videoId: string, commentId: string): Promise<void> {
  await apiRequest(
    `/api/videos/${encodeURIComponent(videoId)}/comments/${encodeURIComponent(commentId)}`,
    { method: 'DELETE' }
  );
}

export async function fetchSubscriptionStatus(
  creatorId: string
): Promise<{ isSubscribed: boolean; subscriberCount: number }> {
  try {
    const res = await apiRequest<{ isSubscribed: boolean; subscriberCount: number }>(
      `/api/subscriptions/status/${encodeURIComponent(creatorId)}`
    );
    return res.data;
  } catch {
    return { isSubscribed: false, subscriberCount: 0 };
  }
}

export async function subscribeToCreator(
  creatorId: string
): Promise<{ subscribed: boolean; subscriberCount: number }> {
  const res = await apiRequest<{ subscribed: boolean; subscriberCount: number }>(
    `/api/subscriptions/${encodeURIComponent(creatorId)}`,
    { method: 'POST' }
  );
  return res.data;
}

export async function unsubscribeFromCreator(
  creatorId: string
): Promise<{ subscribed: boolean; subscriberCount: number }> {
  const res = await apiRequest<{ subscribed: boolean; subscriberCount: number }>(
    `/api/subscriptions/${encodeURIComponent(creatorId)}`,
    { method: 'DELETE' }
  );
  return res.data;
}

export async function fetchSubscriptions(): Promise<CreatorProfile[]> {
  const res = await apiRequest<CreatorProfile[]>('/api/subscriptions');
  return res.data || [];
}

export async function fetchSubscriptionsFeed(): Promise<VideoRecord[]> {
  const res = await apiRequest<VideoRecord[]>('/api/subscriptions/feed');
  return res.data || [];
}

export async function fetchUserProfile(
  userId: string
): Promise<{ id: string; username: string; fullName: string; avatar: string; bio?: string; role?: string } | null> {
  try {
    const res = await apiRequest<{
      user: { id: string; username: string; fullName: string; avatar: string; bio?: string; role?: string };
    }>(`/api/users/${encodeURIComponent(userId)}`);
    return res.data?.user || null;
  } catch {
    return null;
  }
}

export async function fetchCreatorReviews(
  creatorId: string
): Promise<{ reviews: CreatorReview[]; averageRating: number; totalReviews: number; userReview?: CreatorReview | null }> {
  try {
    const res = await apiRequest<{
      reviews: CreatorReview[];
      averageRating: number;
      totalReviews: number;
      userReview?: CreatorReview | null;
    }>(`/api/users/${encodeURIComponent(creatorId)}/reviews`);
    return res.data;
  } catch {
    return { reviews: [], averageRating: 0, totalReviews: 0, userReview: null };
  }
}

export async function submitCreatorReview(
  creatorId: string,
  rating: number,
  comment?: string
): Promise<{ review: CreatorReview; averageRating: number; totalReviews: number }> {
  const res = await apiRequest<{ review: CreatorReview; averageRating: number; totalReviews: number }>(
    `/api/users/${encodeURIComponent(creatorId)}/reviews`,
    {
      method: 'POST',
      body: JSON.stringify({ rating, comment: comment || '' }),
    }
  );
  return res.data;
}

export async function deleteCreatorReview(
  creatorId: string,
  reviewId: string
): Promise<{ averageRating: number; totalReviews: number }> {
  const res = await apiRequest<{ averageRating: number; totalReviews: number }>(
    `/api/users/${encodeURIComponent(creatorId)}/reviews/${encodeURIComponent(reviewId)}`,
    { method: 'DELETE' }
  );
  return res.data;
}

export type SubscriptionNotificationLevel = 'all' | 'personalized' | 'none';

export async function updateSubscriptionNotification(
  creatorId: string,
  notificationLevel: SubscriptionNotificationLevel
): Promise<{ creatorId: string; notificationLevel: SubscriptionNotificationLevel }> {
  const res = await apiRequest<{
    creatorId: string;
    notificationLevel: SubscriptionNotificationLevel;
  }>(`/api/subscriptions/${encodeURIComponent(creatorId)}/notifications`, {
    method: 'PATCH',
    body: JSON.stringify({ notificationLevel }),
  });
  return res.data;
}

export type UserPreferencesPayload = {
  autoplay: boolean;
  startMuted: boolean;
  dataSaver: boolean;
  notifySubscriptions: boolean;
  notifyComments: boolean;
  notifyNewVideos: boolean;
  historyPaused: boolean;
};

export async function fetchUserPreferences(): Promise<UserPreferencesPayload> {
  const res = await apiRequest<UserPreferencesPayload>('/api/users/me/preferences');
  return res.data;
}

export async function updateUserPreferences(
  partial: Partial<UserPreferencesPayload>
): Promise<UserPreferencesPayload> {
  const res = await apiRequest<UserPreferencesPayload>('/api/users/me/preferences', {
    method: 'PATCH',
    body: JSON.stringify(partial),
  });
  return res.data;
}

export type ReportReason =
  | 'inappropriate_content'
  | 'harassment'
  | 'copyright'
  | 'spam'
  | 'misinformation'
  | 'violence'
  | 'other';

export async function reportContent(input: {
  targetType: 'video' | 'user' | 'comment';
  targetId: string;
  reason: ReportReason;
  details?: string;
}): Promise<{ id: string; status: string }> {
  const res = await apiRequest<{ id: string; status: string }>('/api/reports', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function uploadAvatarImage(asset: {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  file?: any;
}): Promise<string> {
  const authRes = await apiRequest<{
    apiKey: string;
    timestamp: number;
    publicId: string;
    uploadUrl: string;
    signature: string;
    allowedFormats: string[];
  }>('/api/uploads/avatar-signature', { method: 'POST', body: JSON.stringify({}) });

  const auth = authRes.data;

  // Mock / offline environment support
  if (!auth.uploadUrl || auth.uploadUrl === 'mock' || !auth.uploadUrl.startsWith('http')) {
    return 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
  }

  const body = new FormData();
  body.append('api_key', auth.apiKey);
  body.append('timestamp', String(auth.timestamp));
  body.append('public_id', auth.publicId);
  body.append('overwrite', 'false');
  body.append('allowed_formats', auth.allowedFormats.join(','));
  body.append('signature', auth.signature);

  if (Platform.OS === 'web' && (asset as any).file) {
    body.append('file', (asset as any).file, asset.fileName || 'avatar.jpg');
  } else {
    body.append('file', {
      uri: asset.uri,
      name: asset.fileName || 'avatar.jpg',
      type: asset.mimeType || 'image/jpeg',
    } as never);
  }

  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', auth.uploadUrl);
    request.timeout = 60 * 1000;
    request.onerror = () => reject(new Error('Network error while uploading photo. Please try again.'));
    request.ontimeout = () => reject(new Error('Upload timed out. Please try again.'));
    request.onload = () => {
      let response: any;
      try {
        response = JSON.parse(request.responseText);
      } catch {
        reject(new Error('Upload service returned an invalid response.'));
        return;
      }
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(response.error?.message || 'Avatar upload failed.'));
        return;
      }
      const secureUrl = response.secure_url || response.url;
      if (!secureUrl) {
        reject(new Error('No image URL returned from upload provider.'));
        return;
      }
      resolve(secureUrl);
    };
    request.send(body);
  });
}

