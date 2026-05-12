import { createCreemRepository } from './repository';
import { createCreemService } from './service';

let cachedCreemService: ReturnType<typeof createCreemService> | null = null;

export function getCreemService() {
  if (cachedCreemService) {
    return cachedCreemService;
  }

  cachedCreemService = createCreemService({
    repository: createCreemRepository(),
  });

  return cachedCreemService;
}
