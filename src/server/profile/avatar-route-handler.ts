import { NextResponse } from 'next/server';

const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map<string, string>([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
]);

type CurrentUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
};

type ProfileAvatarRouteDeps = {
  getCurrentUser(): Promise<CurrentUser | null>;
  uploadAvatar(input: {
    userId: string;
    buffer: Buffer;
    contentType: string;
    extension: string;
  }): Promise<string>;
  updateAvatar(userId: string, avatarUrl: string | null): Promise<CurrentUser>;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function internalError(message = '头像上传失败，请稍后重试。') {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function createProfileAvatarRouteHandler(deps: ProfileAvatarRouteDeps) {
  return async function handleProfileAvatarUpload(request: Request) {
    const currentUser = await deps.getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    try {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!(file instanceof File)) {
        return badRequest('请先选择要上传的头像图片。');
      }

      const extension = ALLOWED_IMAGE_TYPES.get(file.type);
      if (!extension) {
        return badRequest('仅支持 PNG、JPEG 或 WebP 图片。');
      }

      if (file.size === 0) {
        return badRequest('请先选择要上传的头像图片。');
      }

      if (file.size > MAX_AVATAR_SIZE_BYTES) {
        return badRequest('头像图片不能超过 2MB。');
      }

      const arrayBuffer = await file.arrayBuffer();
      const avatarUrl = await deps.uploadAvatar({
        userId: currentUser.id,
        buffer: Buffer.from(arrayBuffer),
        contentType: file.type,
        extension,
      });
      const updatedUser = await deps.updateAvatar(currentUser.id, avatarUrl);

      return NextResponse.json({
        user: updatedUser,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return internalError('R2 存储尚未配置完成，请先补齐环境变量。');
      }

      return internalError();
    }
  };
}
