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

export function durationLabel(seconds: number) {
  if (!seconds || !Number.isFinite(seconds)) return '';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function creatorLabel(creator: VideoRecord['creator'] | undefined) {
  if (!creator) return 'Creator';
  if (typeof creator === 'string') return 'Creator';
  return creator.fullName || `@${creator.username}`;
}
