import { getAuthService } from '@/server/auth/default-auth-service';
import { getAuthenticatedSession } from '@/server/auth/request-auth';
import { createProfileAvatarRouteHandler } from '@/server/profile/avatar-route-handler';
import { uploadUserAvatarToR2 } from '@/server/storage/r2';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return createProfileAvatarRouteHandler({
    async getCurrentUser() {
      const session = await getAuthenticatedSession(request);
      return session?.user ?? null;
    },
    async uploadAvatar(input) {
      return uploadUserAvatarToR2({
        userId: input.userId,
        fileBuffer: input.buffer,
        contentType: input.contentType,
        extension: input.extension,
      });
    },
    async updateAvatar(userId, avatarUrl) {
      return (await getAuthService()).updateAvatar({ userId, avatarUrl });
    },
  })(request);
}
