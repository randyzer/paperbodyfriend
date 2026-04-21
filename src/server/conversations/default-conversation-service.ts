import { createConversationRepository } from './conversation-repository';
import { createConversationService } from './conversation-service';

let cachedConversationService: ReturnType<typeof createConversationService> | null = null;

export function getConversationService() {
  if (cachedConversationService) {
    return cachedConversationService;
  }

  cachedConversationService = createConversationService({
    repository: createConversationRepository(),
  });

  return cachedConversationService;
}
