jest.mock('../../config/cloudinary.config', () => ({
  utils: { api_sign_request: jest.fn(() => 'signed-value') },
  api: { resource: jest.fn() },
}));

const cloudinary = require('../../config/cloudinary.config');
const { createUploadAuthorization, verifyUploadedAsset } = require('../../services/cloudinary.service');
const { completeUploadSchema } = require('../../validators/video.validator');

describe('Cloudinary upload authorization', () => {
  beforeEach(() => {
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
  });

  test('signs server-controlled per-user video parameters without returning the secret', () => {
    const result = createUploadAuthorization('user123');
    const params = cloudinary.utils.api_sign_request.mock.calls.at(-1)[0];
    expect(result.publicId).toMatch(/^streanub\/user_user123\/clip_[\da-f-]{36}$/);
    expect(params).toMatchObject({ public_id: result.publicId, overwrite: false });
    expect(params.allowed_formats).toBe('mp4,mov,m4v,webm');
    expect(result).not.toHaveProperty('apiSecret');
  });

  test('rejects a public ID that does not belong to the authenticated user', async () => {
    await expect(verifyUploadedAsset({ userId: 'user123', publicId: 'streanub/user_other/clip_123', format: 'mp4' }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(cloudinary.api.resource).not.toHaveBeenCalled();
  });

  test('accepts only a verified Cloudinary video asset', async () => {
    const publicId = 'streanub/user_user123/clip_123e4567-e89b-12d3-a456-426614174000';
    cloudinary.api.resource.mockResolvedValue({ public_id: publicId, resource_type: 'video', format: 'mp4', bytes: 100, secure_url: 'https://res.cloudinary.com/test/video/upload/a.mp4', duration: 12 });
    await expect(verifyUploadedAsset({ userId: 'user123', publicId, format: 'mp4' }))
      .resolves.toMatchObject({ public_id: publicId });
    cloudinary.api.resource.mockResolvedValueOnce({ public_id: publicId, resource_type: 'image', format: 'mp4', bytes: 100, secure_url: 'https://res.cloudinary.com/test/a.mp4' });
    await expect(verifyUploadedAsset({ userId: 'user123', publicId, format: 'mp4' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('completion contract rejects missing or client-controlled ownership fields', () => {
    expect(completeUploadSchema.safeParse({ body: { title: 'Clip' } }).success).toBe(false);
    expect(completeUploadSchema.safeParse({ body: {
      title: 'Clip', publicId: 'asset', format: 'mp4', creator: 'attacker',
    } }).success).toBe(false);
  });

  test('maps Cloudinary SDK 404 error (nested in error.error.http_code) to ApiError 400 instead of 500', async () => {
    const publicId = 'streanub/user_user123/clip_123e4567-e89b-12d3-a456-426614174000';
    cloudinary.api.resource.mockRejectedValueOnce({
      error: { message: 'Resource not found', http_code: 404 },
    });
    await expect(verifyUploadedAsset({ userId: 'user123', publicId, format: 'mp4' }))
      .rejects.toMatchObject({ statusCode: 400, message: 'Uploaded video was not found in Cloudinary' });
  });

  test('maps Cloudinary SDK 401 error (nested in error.error.http_code) to ApiError 502 instead of 500', async () => {
    const publicId = 'streanub/user_user123/clip_123e4567-e89b-12d3-a456-426614174000';
    cloudinary.api.resource.mockRejectedValueOnce({
      error: { message: 'unknown api_key', http_code: 401 },
    });
    await expect(verifyUploadedAsset({ userId: 'user123', publicId, format: 'mp4' }))
      .rejects.toMatchObject({
        statusCode: 502,
        message: expect.stringContaining('Cloudinary storage authentication failed'),
      });
  });

  test('rejects authorization and explicitly identifies missing or placeholder environment variables instead of masking', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'your_cloudinary_cloud_name';
    process.env.CLOUDINARY_API_KEY = 'your_cloudinary_api_key';
    process.env.CLOUDINARY_API_SECRET = 'your_cloudinary_api_secret';

    expect(() => createUploadAuthorization('user123')).toThrow(
      /CLOUDINARY_CLOUD_NAME.*CLOUDINARY_API_KEY.*CLOUDINARY_API_SECRET/
    );
  });
});
