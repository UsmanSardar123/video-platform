export const VIDEO_CATEGORIES = [
  'Entertainment',
  'Sports',
  'Gaming',
  'Music',
  'Education',
  'Technology',
  'News',
  'Comedy',
  'Movies',
  'Lifestyle',
  'Other',
] as const;

export type VideoCategory = (typeof VIDEO_CATEGORIES)[number];

export const FEED_CATEGORIES = ['All', ...VIDEO_CATEGORIES] as const;
export type FeedCategory = (typeof FEED_CATEGORIES)[number];

export const DEFAULT_CATEGORY: VideoCategory = 'Other';
