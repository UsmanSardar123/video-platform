const Video = require('../../models/video.model');
const { completeUploadSchema } = require('../../validators/video.validator');

describe('video model and upload metadata contract', () => {
  test('requires a creator and valid visibility, with sparse unique Cloudinary identity', () => {
    expect(Video.schema.path('creator').isRequired).toBe(true);
    expect(Video.schema.path('visibility').enumValues).toEqual(['public', 'private', 'unlisted']);
    expect(Video.schema.path('cloudinaryPublicId').options).toMatchObject({ unique: true, sparse: true });
    expect(Video.schema.path('sourceType').enumValues).toEqual(['cloudinary', 'youtube', 'vimeo', 'twitch']);
  });

  test('rejects missing titles, oversized titles, and injected owner fields', () => {
    const validAsset = { publicId: 'cloudinary-id', format: 'mp4' };
    expect(completeUploadSchema.safeParse({ body: validAsset }).success).toBe(false);
    expect(completeUploadSchema.safeParse({ body: { ...validAsset, title: 'x'.repeat(151) } }).success).toBe(false);
    expect(completeUploadSchema.safeParse({ body: { ...validAsset, title: 'Title', creator: 'forged' } }).success).toBe(false);
  });

  test('indexes both titles and descriptions for public text search', () => {
    expect(Video.schema.indexes()).toContainEqual([
      { title: 'text', description: 'text' },
      { background: true },
    ]);
  });
});
