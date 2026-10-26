const Video = require('../models/video.model');
const ApiError = require('../utils/apiError.util');

const parseProviderUrl = (rawUrl) => {
  let url;
  try { url = new URL(rawUrl); } catch { throw new ApiError(400, 'Enter a valid YouTube or Vimeo URL'); }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ApiError(400, 'Video URL must use HTTP or HTTPS');
  }
  if (url.username || url.password || url.port) throw new ApiError(400, 'Video URL is invalid');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  let provider;
  let id;
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
    provider = 'youtube';
    const parts = url.pathname.split('/').filter(Boolean);
    id = url.searchParams.get('v') || (['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : null);
    if (url.searchParams.has('v') && !url.pathname.match(/^\/(watch)?$/)) id = null;
    if (!/^[\w-]{11}$/.test(id || '')) throw new ApiError(400, 'YouTube URL does not contain a valid video ID');
    return { provider, id, canonicalUrl: `https://www.youtube.com/watch?v=${id}` };
  }
  if (host === 'youtu.be') {
    provider = 'youtube';
    id = url.pathname.split('/').filter(Boolean)[0];
    if (!/^[\w-]{11}$/.test(id || '')) throw new ApiError(400, 'YouTube URL does not contain a valid video ID');
    return { provider, id, canonicalUrl: `https://www.youtube.com/watch?v=${id}` };
  }
  if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
    provider = 'vimeo';
    const parts = url.pathname.split('/').filter(Boolean);
    id = host === 'player.vimeo.com' && parts[0] === 'video' ? parts[1] : parts[0];
    if (!/^\d{1,20}$/.test(id || '')) throw new ApiError(400, 'Vimeo URL does not contain a valid video ID');
    return { provider, id, canonicalUrl: `https://vimeo.com/${id}` };
  }
  if (host === 'twitch.tv' || host === 'www.twitch.tv' || host === 'm.twitch.tv' || host === 'clips.twitch.tv') {
    provider = 'twitch';
    const parts = url.pathname.split('/').filter(Boolean);
    if (host === 'clips.twitch.tv' && parts.length === 1 && /^[\w-]{2,100}$/.test(parts[0])) {
      id = parts[0];
      return { provider, id, canonicalUrl: `https://clips.twitch.tv/${id}` };
    }
    if (parts[0] === 'videos' && /^\d{1,20}$/.test(parts[1] || '')) {
      id = parts[1];
      return { provider, id, canonicalUrl: `https://www.twitch.tv/videos/${id}` };
    }
    if (parts.length === 3 && parts[1] === 'clip' && /^[\w-]{2,100}$/.test(parts[2])) {
      id = parts[2];
      return { provider, id, canonicalUrl: `https://clips.twitch.tv/${id}` };
    }
    if (host !== 'clips.twitch.tv' && parts.length === 1 && /^[a-z\d_]{4,25}$/i.test(parts[0]) &&
        !['directory', 'downloads', 'settings', 'videos', 'wallet', 'inventory'].includes(parts[0].toLowerCase())) {
      id = parts[0].toLowerCase();
      return { provider, id, canonicalUrl: `https://www.twitch.tv/${id}` };
    }
  }
  throw new ApiError(400, 'Only supported YouTube, Vimeo, and Twitch video URLs are accepted');
};

const createExternalVideo = async (userId, input) => {
  const parsed = parseProviderUrl(input.url);
  const videoUrl = parsed.canonicalUrl;
  const existing = await Video.findOne({ creator: userId, videoUrl });
  if (existing) return existing;
  return Video.create({
    title: input.title,
    description: input.description,
    category: input.category,
    visibility: input.visibility,
    creator: userId,
    videoUrl,
    thumbnailUrl: parsed.provider === 'youtube' ? `https://img.youtube.com/vi/${parsed.id}/hqdefault.jpg` : '',
    sourceType: parsed.provider,
  });
};

module.exports = { parseProviderUrl, createExternalVideo };
