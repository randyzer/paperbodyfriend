import assert from 'node:assert/strict';

async function main() {
  const { createProfileAvatarRouteHandler } = await import(
    '../src/server/profile/avatar-route-handler'
  );

  let uploadedFile: {
    buffer: Buffer;
    contentType: string;
    extension: string;
    userId: string;
  } | null = null;
  let updatedAvatar: { userId: string; avatarUrl: string | null } | null = null;

  const handler = createProfileAvatarRouteHandler({
    async getCurrentUser() {
      return {
        id: 'user_1',
        email: 'user@example.com',
        displayName: 'Randy',
        avatarUrl: null,
      };
    },
    async uploadAvatar(input) {
      uploadedFile = input;
      return 'https://cdn.example.com/avatars/user_1/avatar.png';
    },
    async updateAvatar(userId, avatarUrl) {
      updatedAvatar = { userId, avatarUrl };
      return {
        id: userId,
        email: 'user@example.com',
        displayName: 'Randy',
        avatarUrl,
      };
    },
  });

  const pngFile = new File([new Uint8Array([137, 80, 78, 71])], 'avatar.png', {
    type: 'image/png',
  });
  const successForm = new FormData();
  successForm.set('file', pngFile);

  const successResponse = await handler(
    new Request('http://localhost/api/profile/avatar', {
      method: 'POST',
      body: successForm,
    }),
  );

  assert.equal(successResponse.status, 200);
  assert.deepEqual(await successResponse.json(), {
    user: {
      id: 'user_1',
      email: 'user@example.com',
      displayName: 'Randy',
      avatarUrl: 'https://cdn.example.com/avatars/user_1/avatar.png',
    },
  });
  assert.deepEqual(uploadedFile, {
    buffer: Buffer.from([137, 80, 78, 71]),
    contentType: 'image/png',
    extension: 'png',
    userId: 'user_1',
  });
  assert.deepEqual(updatedAvatar, {
    userId: 'user_1',
    avatarUrl: 'https://cdn.example.com/avatars/user_1/avatar.png',
  });

  const invalidFileForm = new FormData();
  invalidFileForm.set(
    'file',
    new File([new TextEncoder().encode('hello')], 'avatar.txt', {
      type: 'text/plain',
    }),
  );

  const invalidFileResponse = await handler(
    new Request('http://localhost/api/profile/avatar', {
      method: 'POST',
      body: invalidFileForm,
    }),
  );

  assert.equal(invalidFileResponse.status, 400);
  assert.deepEqual(await invalidFileResponse.json(), {
    error: '仅支持 PNG、JPEG 或 WebP 图片。',
  });

  const missingFileResponse = await handler(
    new Request('http://localhost/api/profile/avatar', {
      method: 'POST',
      body: new FormData(),
    }),
  );

  assert.equal(missingFileResponse.status, 400);
  assert.deepEqual(await missingFileResponse.json(), {
    error: '请先选择要上传的头像图片。',
  });

  const unauthorizedHandler = createProfileAvatarRouteHandler({
    async getCurrentUser() {
      return null;
    },
    async uploadAvatar() {
      throw new Error('should not upload when unauthorized');
    },
    async updateAvatar() {
      throw new Error('should not update when unauthorized');
    },
  });

  const unauthorizedResponse = await unauthorizedHandler(
    new Request('http://localhost/api/profile/avatar', {
      method: 'POST',
      body: successForm,
    }),
  );

  assert.equal(unauthorizedResponse.status, 401);
  assert.deepEqual(await unauthorizedResponse.json(), {
    error: 'Authentication required',
  });

  console.log('profile avatar route test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
