import { ChatAccessError } from './chat-access-errors';

type BillingStatus = {
  active: boolean;
};

type ChatAccessDeps = {
  getBillingStatus(userId: string): Promise<BillingStatus>;
};

type ChatAccessInput = {
  userId: string | null;
  currentRoundTripCount: number;
};

type ChatAccessResult =
  | {
      tier: 'anonymous';
      maxRoundTrips: 3;
    }
  | {
      tier: 'free';
      maxRoundTrips: 7;
    }
  | {
      tier: 'paid';
      maxRoundTrips: null;
    };

const ANON_MAX_ROUND_TRIPS = 3;
const FREE_MAX_ROUND_TRIPS = 7;

export function createChatAccessService(deps: ChatAccessDeps) {
  async function resolveChatAccess(input: {
    userId: string | null;
  }): Promise<ChatAccessResult> {
    if (!input.userId) {
      return {
        tier: 'anonymous',
        maxRoundTrips: ANON_MAX_ROUND_TRIPS,
      };
    }

    const billingStatus = await deps.getBillingStatus(input.userId);
    if (billingStatus.active) {
      return {
        tier: 'paid',
        maxRoundTrips: null,
      };
    }

    return {
      tier: 'free',
      maxRoundTrips: FREE_MAX_ROUND_TRIPS,
    };
  }

  return {
    resolveChatAccess,

    async assertChatAllowed(input: ChatAccessInput): Promise<ChatAccessResult> {
      const access = await resolveChatAccess({
        userId: input.userId,
      });

      if (access.maxRoundTrips !== null && input.currentRoundTripCount >= access.maxRoundTrips) {
        throw new ChatAccessError(
          access.tier === 'anonymous'
            ? 'ANON_CHAT_LIMIT_REACHED'
            : 'FREE_CHAT_LIMIT_REACHED',
        );
      }

      return access;
    },
  };
}
