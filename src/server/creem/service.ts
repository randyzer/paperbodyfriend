import crypto from 'node:crypto';

import { createCreemCheckoutSession } from './client';

type CheckoutStatus = 'pending' | 'completed' | 'failed' | 'expired';
type SubscriptionStatus =
  | 'active'
  | 'paid'
  | 'trialing'
  | 'scheduled_cancel'
  | 'paused'
  | 'expired'
  | 'canceled'
  | 'past_due'
  | 'incomplete'
  | 'unknown';

type CreemRepository = {
  createCheckout(input: {
    id: string;
    userId: string;
    requestId: string;
    creemProductId: string;
    checkoutUrl: string;
    creemCheckoutId: string;
    status: CheckoutStatus;
    mode: 'test' | 'live';
    metadata: Record<string, string>;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<unknown>;
  updateCheckoutByRequestId(
    requestId: string,
    patch: {
      creemCheckoutId?: string | null;
      creemOrderId?: string | null;
      creemCustomerId?: string | null;
      creemSubscriptionId?: string | null;
      creemProductId?: string;
      status?: CheckoutStatus;
      mode?: 'test' | 'live';
      completedAt?: Date | null;
    },
  ): Promise<{ userId: string; requestId: string } | null>;
  findCheckoutByRequestId(requestId: string): Promise<{
    userId: string;
    requestId: string;
    creemSubscriptionId: string | null;
    creemProductId: string;
    status: CheckoutStatus;
  } | null>;
  findLatestCheckoutByUserId(userId: string): Promise<{
    status: CheckoutStatus;
    creemProductId: string;
    creemCustomerId: string | null;
  } | null>;
  findLatestSubscriptionByUserId(userId: string): Promise<{
    creemSubscriptionId: string;
    creemCustomerId: string | null;
    creemProductId: string;
    status: SubscriptionStatus;
    currentPeriodEnd: Date | null;
  } | null>;
  findSubscriptionByCreemSubscriptionId(creemSubscriptionId: string): Promise<{
    userId: string;
    checkoutRequestId: string | null;
    status: SubscriptionStatus;
  } | null>;
  findSubscriptionByCheckoutRequestId(requestId: string): Promise<{
    status: SubscriptionStatus;
  } | null>;
  upsertSubscription(input: {
    id: string;
    userId: string;
    creemSubscriptionId: string;
    creemCustomerId: string | null;
    creemProductId: string;
    checkoutRequestId: string | null;
    status: SubscriptionStatus;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    canceledAt: Date | null;
    endedAt: Date | null;
    metadata: Record<string, string> | null;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<unknown>;
  recordWebhookEvent(input: {
    id: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<boolean>;
};

type WebhookEvent = {
  id: string;
  eventType: string;
  object?: unknown;
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set<SubscriptionStatus>([
  'active',
  'paid',
  'trialing',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readDate(value: unknown): Date | null {
  const raw = readString(value);
  if (!raw) {
    return null;
  }

  const date = new Date(raw);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function readNestedId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (isRecord(value)) {
    return readString(value.id);
  }

  return null;
}

function readMetadata(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) {
    return null;
  }

  const metadata: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') {
      metadata[key] = entry;
    }
  }

  return Object.keys(metadata).length > 0 ? metadata : null;
}

function inferSubscriptionStatus(
  eventType: string,
  explicitStatus: unknown,
): SubscriptionStatus {
  const status = readString(explicitStatus);
  if (
    status === 'active' ||
    status === 'paid' ||
    status === 'trialing' ||
    status === 'scheduled_cancel' ||
    status === 'paused' ||
    status === 'expired' ||
    status === 'canceled' ||
    status === 'past_due' ||
    status === 'incomplete'
  ) {
    return status;
  }

  const suffix = eventType.replace('subscription.', '');
  if (
    suffix === 'active' ||
    suffix === 'paid' ||
    suffix === 'trialing' ||
    suffix === 'scheduled_cancel' ||
    suffix === 'paused' ||
    suffix === 'expired' ||
    suffix === 'canceled' ||
    suffix === 'past_due'
  ) {
    return suffix;
  }

  return 'unknown';
}

function normalizeAppBaseUrl(appBaseUrl: string) {
  return appBaseUrl.replace(/\/+$/, '');
}

function buildSuccessUrl(appBaseUrl: string) {
  return `${normalizeAppBaseUrl(appBaseUrl)}/billing/success`;
}

function readSubscriptionUserId(
  subscription: Record<string, unknown>,
  existingUserId: string | null,
) {
  if (existingUserId) {
    return existingUserId;
  }

  const metadata = readMetadata(subscription.metadata);
  return metadata?.userId ?? null;
}

function extractSubscriptionIdFromCheckout(
  checkout: Record<string, unknown>,
) {
  return readNestedId(checkout.subscription);
}

function extractProductIdFromCheckout(checkout: Record<string, unknown>) {
  return (
    readNestedId(checkout.product) ||
    (isRecord(checkout.order) ? readNestedId(checkout.order.product) : null)
  );
}

function extractCustomerIdFromCheckout(checkout: Record<string, unknown>) {
  return (
    readNestedId(checkout.customer) ||
    (isRecord(checkout.order) ? readNestedId(checkout.order.customer) : null)
  );
}

function extractOrderIdFromCheckout(checkout: Record<string, unknown>) {
  return readNestedId(checkout.order);
}

export function createCreemService(deps: {
  repository: CreemRepository;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  createId?: () => string;
}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => new Date());
  const createId = deps.createId ?? (() => crypto.randomUUID());

  async function handleCheckoutCompleted(
    eventType: string,
    checkoutObject: Record<string, unknown>,
  ) {
    const requestId = readString(checkoutObject.request_id);
    if (!requestId) {
      return;
    }

    const existingCheckout = await deps.repository.findCheckoutByRequestId(requestId);
    const productId =
      extractProductIdFromCheckout(checkoutObject) ??
      existingCheckout?.creemProductId;

    if (!productId) {
      return;
    }

    const subscriptionId = extractSubscriptionIdFromCheckout(checkoutObject);
    const updatedCheckout = await deps.repository.updateCheckoutByRequestId(requestId, {
      creemCheckoutId: readNestedId(checkoutObject),
      creemOrderId: extractOrderIdFromCheckout(checkoutObject),
      creemCustomerId: extractCustomerIdFromCheckout(checkoutObject),
      creemSubscriptionId: subscriptionId,
      creemProductId: productId,
      status: 'completed',
      mode:
        readString(checkoutObject.mode) === 'live'
          ? 'live'
          : 'test',
      completedAt: now(),
    });

    const userId = updatedCheckout?.userId ?? existingCheckout?.userId ?? null;
    if (!userId || !subscriptionId) {
      return;
    }

    const metadata = readMetadata(checkoutObject.metadata);
    await deps.repository.upsertSubscription({
      id: createId(),
      userId,
      creemSubscriptionId: subscriptionId,
      creemCustomerId: extractCustomerIdFromCheckout(checkoutObject),
      creemProductId: productId,
      checkoutRequestId: requestId,
      status:
        inferSubscriptionStatus(eventType, checkoutObject.status) === 'unknown'
          ? 'active'
          : inferSubscriptionStatus(eventType, checkoutObject.status),
      currentPeriodStart: null,
      currentPeriodEnd: null,
      canceledAt: null,
      endedAt: null,
      metadata,
      createdAt: now(),
      updatedAt: now(),
    });
  }

  async function handleSubscriptionEvent(
    eventType: string,
    subscriptionObject: Record<string, unknown>,
  ) {
    const subscriptionId = readNestedId(subscriptionObject);
    const productId = readNestedId(subscriptionObject.product);
    if (!subscriptionId || !productId) {
      return;
    }

    const existingSubscription =
      await deps.repository.findSubscriptionByCreemSubscriptionId(subscriptionId);
    const userId = readSubscriptionUserId(subscriptionObject, existingSubscription?.userId ?? null);
    if (!userId) {
      return;
    }

    await deps.repository.upsertSubscription({
      id: createId(),
      userId,
      creemSubscriptionId: subscriptionId,
      creemCustomerId: readNestedId(subscriptionObject.customer),
      creemProductId: productId,
      checkoutRequestId: existingSubscription?.checkoutRequestId ?? null,
      status: inferSubscriptionStatus(eventType, subscriptionObject.status),
      currentPeriodStart: readDate(subscriptionObject.current_period_start_date),
      currentPeriodEnd: readDate(subscriptionObject.current_period_end_date),
      canceledAt: readDate(subscriptionObject.canceled_at),
      endedAt: readDate(subscriptionObject.ended_at),
      metadata: readMetadata(subscriptionObject.metadata),
      createdAt: now(),
      updatedAt: now(),
    });
  }

  return {
    async createCheckoutSession(input: {
      userId: string;
      email: string;
      productId: string;
      apiKey: string;
      appBaseUrl: string;
      testMode: boolean;
      units: number;
    }): Promise<{
      checkoutId: string;
      checkoutUrl: string;
      requestId: string;
      status: string;
      mode: 'test' | 'live';
    }> {
      const requestId = createId();
      const createdAt = now();
      const checkout = await createCreemCheckoutSession(
        {
          apiKey: input.apiKey,
          testMode: input.testMode,
          productId: input.productId,
          requestId,
          successUrl: buildSuccessUrl(input.appBaseUrl),
          email: input.email,
          units: input.units,
          metadata: {
            userId: input.userId,
          },
        },
        fetchImpl,
      );

      await deps.repository.createCheckout({
        id: createId(),
        userId: input.userId,
        requestId,
        creemProductId: input.productId,
        checkoutUrl: checkout.checkoutUrl,
        creemCheckoutId: checkout.checkoutId,
        status: checkout.status === 'completed' ? 'completed' : 'pending',
        mode: checkout.mode,
        metadata: {
          userId: input.userId,
        },
        createdAt,
        updatedAt: createdAt,
      });

      return {
        checkoutId: checkout.checkoutId,
        checkoutUrl: checkout.checkoutUrl,
        requestId,
        status: checkout.status,
        mode: checkout.mode,
      };
    },

    async getBillingStatus(userId: string) {
      const subscription = await deps.repository.findLatestSubscriptionByUserId(userId);
      const checkout = await deps.repository.findLatestCheckoutByUserId(userId);

      return {
        active: subscription
          ? ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)
          : false,
        productId: subscription?.creemProductId ?? checkout?.creemProductId ?? null,
        subscriptionStatus: subscription?.status ?? null,
        checkoutStatus: checkout?.status ?? null,
        subscriptionId: subscription?.creemSubscriptionId ?? null,
        customerId: subscription?.creemCustomerId ?? checkout?.creemCustomerId ?? null,
        currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      };
    },

    async getCheckoutSummaryByRequestId(requestId: string) {
      const checkout = await deps.repository.findCheckoutByRequestId(requestId);
      if (!checkout) {
        return null;
      }

      const subscription = checkout.creemSubscriptionId
        ? await deps.repository.findSubscriptionByCreemSubscriptionId(
            checkout.creemSubscriptionId,
          )
        : await deps.repository.findSubscriptionByCheckoutRequestId(requestId);

      return {
        requestId: checkout.requestId,
        productId: checkout.creemProductId,
        checkoutStatus: checkout.status,
        subscriptionStatus: subscription?.status ?? null,
      };
    },

    async handleWebhook(input: {
      rawBody: string;
      webhookSecret: string;
      signature: string;
    }) {
      const payload = JSON.parse(input.rawBody) as WebhookEvent;
      if (!payload.id || !payload.eventType || !isRecord(payload)) {
        throw new Error('Invalid webhook payload');
      }

      const recorded = await deps.repository.recordWebhookEvent({
        id: payload.id,
        eventType: payload.eventType,
        payload: payload as unknown as Record<string, unknown>,
      });

      if (!recorded) {
        return;
      }

      const object = isRecord(payload.object) ? payload.object : null;
      if (!object) {
        return;
      }

      if (payload.eventType === 'checkout.completed') {
        await handleCheckoutCompleted(payload.eventType, object);
        return;
      }

      if (payload.eventType.startsWith('subscription.')) {
        await handleSubscriptionEvent(payload.eventType, object);
      }
    },
  };
}
