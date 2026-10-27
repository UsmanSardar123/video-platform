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
