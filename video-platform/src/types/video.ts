export type VideoRecord = {
  _id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  creator: { _id: string; username: string; fullName: string; avatar: string } | string | null;
  category: string;
  visibility: 'public' | 'private' | 'unlisted';
  sourceType: 'cloudinary' | 'youtube' | 'vimeo' | 'twitch';
  duration: number;
  views: number;
  createdAt: string;
};

export type VideoInteractionState = {
  liked: boolean;
  disliked: boolean;
  watchLater: boolean;
  likeCount: number;
};

export type CommentRecord = {
  _id: string;
  videoId?: string;
  video?: string;
  user: {
    _id: string;
    username: string;
    fullName: string;
    avatar?: string;
  };
  text: string;
  createdAt: string;
};

export type CreatorProfile = {
  _id: string;
  username: string;
  fullName: string;
  avatar: string;
  bio: string;
  subscriberCount: number;
  videoCount: number;
  isSubscribed?: boolean;
};

export type CreatorReview = {
  _id: string;
  creator: string;
  reviewer: {
    _id: string;
    username: string;
    fullName: string;
    avatar?: string;
  };
  rating: number;
  comment?: string;
  createdAt: string;
};

export function durationLabel(seconds: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '';
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainder = (totalSeconds % 60).toString().padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainder}`;
  }
  return `${minutes}:${remainder}`;
}

export type CreatorLike =
  | { fullName?: string; username?: string; avatar?: string }
  | string
  | null
  | undefined;

export function creatorLabel(creator: CreatorLike): string {
  if (!creator) return 'Creator';
  if (typeof creator === 'string') return 'Creator';
  return creator.fullName || (creator.username ? `@${creator.username}` : 'Creator');
}

export function creatorAvatarUrl(creator: CreatorLike): string | null {
  if (!creator || typeof creator === 'string') return null;
  return creator.avatar?.trim() || null;
}

export function creatorInitials(creator: CreatorLike): string {
  if (!creator) return 'C';
  if (typeof creator === 'string') return 'C';
  const name = creator.fullName || creator.username || 'C';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0][0] && parts[1][0]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (name[0] || 'C').toUpperCase();
}

export function formatViews(views: number | undefined): string {
  if (views === undefined || views === null || !Number.isFinite(views) || views < 0) {
    return '0 views';
  }
  if (views === 0) return '0 views';
  if (views === 1) return '1 view';
  if (views < 1000) return `${views} views`;
  if (views < 1000000) {
    const k = views / 1000;
    return `${k >= 10 ? Math.round(k) : (Math.floor(k * 10) / 10).toFixed(1).replace(/\.0$/, '')}K views`;
  }
  const m = views / 1000000;
  return `${(Math.floor(m * 10) / 10).toFixed(1).replace(/\.0$/, '')}M views`;
}

export function formatTimeAgo(dateString: string | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return '';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'Just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'} ago`;

  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}

export function cleanTitle(title: string | undefined): string {
  if (!title) return 'Untitled Video';
  const trimmed = title.trim();
  // Strip raw storage paths or technical prefixes/extensions if presented as a bare filename
  if (/^[a-zA-Z0-9_\-/]+\.(mp4|mov|m4v|webm)$/i.test(trimmed)) {
    const filename = trimmed.split('/').pop() || trimmed;
    const withoutExt = filename.replace(/\.[^.]+$/, '');
    return withoutExt.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return trimmed;
}

export function cleanDescriptionPreview(description: string | undefined): string {
  if (!description) return '';
  return description.replace(/\s+/g, ' ').trim();
}
