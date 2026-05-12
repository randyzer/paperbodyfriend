import { createConversationService } from './conversation-service';
import { createConversationRepository } from './conversation-repository';

let cachedConversationService: ReturnType<typeof createConversationService> | null = null;
const testGlobals = globalThis as typeof globalThis & {
  __paperBoyfriendTestConversationService?: Pick<
    ReturnType<typeof createConversationService>,
    'releaseConversationRoundTrip' | 'reserveConversationRoundTrip'
  >;
  __paperBoyfriendTestAuthenticatedRoundTripCount?: number;
};

export function getConversationService() {
  if (
    process.env.AUTH_TEST_BYPASS === 'true' &&
    testGlobals.__paperBoyfriendTestConversationService
  ) {
    return testGlobals.__paperBoyfriendTestConversationService as ReturnType<
      typeof createConversationService
    >;
  }

  if (
    process.env.AUTH_TEST_BYPASS === 'true' &&
    typeof testGlobals.__paperBoyfriendTestAuthenticatedRoundTripCount === 'number'
  ) {
    return {
      async getCurrentRoundTripCount() {
        return testGlobals.__paperBoyfriendTestAuthenticatedRoundTripCount ?? 0;
      },
    } as unknown as ReturnType<typeof createConversationService>;
  }

  if (cachedConversationService) {
    return cachedConversationService;
  }

  cachedConversationService = createConversationService({
    repository: createConversationRepository(),
  });

  return cachedConversationService;
}
