jest.mock('../../models/video.model', () => ({ findOne: jest.fn(), create: jest.fn() }));
const { parseProviderUrl } = require('../../services/externalVideo.service');
const Video = require('../../models/video.model');
const { createExternalVideo } = require('../../services/externalVideo.service');

describe('external video URL validation', () => {
  test.each([
    ['https://www.youtube.com/watch?v=abcdefghijk', 'youtube', 'abcdefghijk'],
    ['https://youtu.be/abcdefghijk?t=10', 'youtube', 'abcdefghijk'],
    ['https://youtube.com/shorts/abcdefghijk', 'youtube', 'abcdefghijk'],
    ['https://vimeo.com/12345678', 'vimeo', '12345678'],
    ['https://player.vimeo.com/video/12345678', 'vimeo', '12345678'],
    ['https://www.twitch.tv/videos/1234567890', 'twitch', '1234567890'],
    ['https://www.twitch.tv/StreamerName', 'twitch', 'streamername'],
    ['https://clips.twitch.tv/ShortClipName', 'twitch', 'ShortClipName'],
    ['https://www.twitch.tv/creator/clip/ShortClipName', 'twitch', 'ShortClipName'],
  ])('normalizes %s', (url, provider, id) => {
    expect(parseProviderUrl(url)).toMatchObject({ provider, id });
  });

  test.each([
    'https://youtube.com.evil.example/watch?v=abcdefghijk',
    'https://notvimeo.com/12345678',
    'https://example.com/video.mp4',
    'https://youtube.com/watch?v=bad',
    'https://user:pass@youtu.be/abcdefghijk',
  ])('rejects unsupported or deceptive URL %s', (url) => {
    expect(() => parseProviderUrl(url)).toThrow();
  });

  test('stores an external provider URL separately and derives owner from the caller', async () => {
    Video.findOne.mockResolvedValue(null);
    const saved = { _id: 'v1' };
    Video.create.mockResolvedValue(saved);
    await expect(createExternalVideo('authenticated-user', {
      title: 'YouTube clip', url: 'https://youtu.be/abcdefghijk',
      description: '', category: 'General', visibility: 'public',
    })).resolves.toBe(saved);
    expect(Video.create).toHaveBeenCalledWith(expect.objectContaining({
      creator: 'authenticated-user', sourceType: 'youtube',
      videoUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
    }));
  });
});
