import { desc, eq } from 'drizzle-orm';

import { db } from '@/server/db/client';
import {
  billingCheckouts,
  billingSubscriptions,
  billingWebhookEvents,
} from '@/server/db/schema';

type CheckoutInsert = typeof billingCheckouts.$inferInsert;
type CheckoutUpdate = Partial<typeof billingCheckouts.$inferInsert>;
type SubscriptionInsert = typeof billingSubscriptions.$inferInsert;

export function createCreemRepository(database = db) {
  return {
    async createCheckout(input: CheckoutInsert) {
      const [checkout] = await database
        .insert(billingCheckouts)
        .values(input)
        .returning();

      return checkout;
    },

    async updateCheckoutByRequestId(requestId: string, patch: CheckoutUpdate) {
      const [checkout] = await database
        .update(billingCheckouts)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(billingCheckouts.requestId, requestId))
        .returning();

      return checkout ?? null;
    },

    async findCheckoutByRequestId(requestId: string) {
      const [checkout] = await database
        .select()
        .from(billingCheckouts)
        .where(eq(billingCheckouts.requestId, requestId))
        .limit(1);

      return checkout ?? null;
    },

    async findLatestCheckoutByUserId(userId: string) {
      const [checkout] = await database
        .select()
        .from(billingCheckouts)
        .where(eq(billingCheckouts.userId, userId))
        .orderBy(desc(billingCheckouts.createdAt))
        .limit(1);

      return checkout ?? null;
    },

    async findLatestSubscriptionByUserId(userId: string) {
      const [subscription] = await database
        .select()
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.userId, userId))
        .orderBy(desc(billingSubscriptions.updatedAt))
        .limit(1);

      return subscription ?? null;
    },

    async findSubscriptionByCreemSubscriptionId(creemSubscriptionId: string) {
      const [subscription] = await database
        .select()
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.creemSubscriptionId, creemSubscriptionId))
        .limit(1);

      return subscription ?? null;
    },

    async findSubscriptionByCheckoutRequestId(requestId: string) {
      const [subscription] = await database
        .select()
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.checkoutRequestId, requestId))
        .limit(1);

      return subscription ?? null;
    },

    async upsertSubscription(input: SubscriptionInsert) {
      const [subscription] = await database
        .insert(billingSubscriptions)
        .values(input)
        .onConflictDoUpdate({
          target: billingSubscriptions.creemSubscriptionId,
          set: {
            userId: input.userId,
            creemCustomerId: input.creemCustomerId ?? null,
            creemProductId: input.creemProductId,
            checkoutRequestId: input.checkoutRequestId ?? null,
            status: input.status,
            currentPeriodStart: input.currentPeriodStart ?? null,
            currentPeriodEnd: input.currentPeriodEnd ?? null,
            canceledAt: input.canceledAt ?? null,
            endedAt: input.endedAt ?? null,
            metadata: input.metadata ?? null,
            updatedAt: new Date(),
          },
        })
        .returning();

      return subscription;
    },

    async recordWebhookEvent(input: {
      id: string;
      eventType: string;
      payload: Record<string, unknown>;
    }) {
      const [event] = await database
        .insert(billingWebhookEvents)
        .values(input)
        .onConflictDoNothing()
        .returning({ id: billingWebhookEvents.id });

      return Boolean(event);
    },
  };
}
