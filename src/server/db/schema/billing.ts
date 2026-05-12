import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './auth';

export const billingCheckouts = pgTable(
  'paper_boyfriend_billing_checkouts',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    requestId: text('request_id').notNull(),
    creemCheckoutId: text('creem_checkout_id'),
    creemOrderId: text('creem_order_id'),
    creemCustomerId: text('creem_customer_id'),
    creemSubscriptionId: text('creem_subscription_id'),
    creemProductId: text('creem_product_id').notNull(),
    checkoutUrl: text('checkout_url'),
    status: text('status')
      .$type<'pending' | 'completed' | 'failed' | 'expired'>()
      .notNull()
      .default('pending'),
    mode: text('mode').$type<'test' | 'live'>().notNull().default('test'),
    metadata: jsonb('metadata').$type<Record<string, string>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  table => ({
    requestIdUnique: uniqueIndex('paper_boyfriend_billing_checkouts_request_id_unique').on(
      table.requestId,
    ),
    userCreatedAtIdx: index('paper_boyfriend_billing_checkouts_user_created_at_idx').on(
      table.userId,
      table.createdAt,
    ),
    creemSubscriptionIdx: index(
      'paper_boyfriend_billing_checkouts_creem_subscription_idx',
    ).on(table.creemSubscriptionId),
  }),
);

export const billingSubscriptions = pgTable(
  'paper_boyfriend_billing_subscriptions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    creemSubscriptionId: text('creem_subscription_id').notNull(),
    creemCustomerId: text('creem_customer_id'),
    creemProductId: text('creem_product_id').notNull(),
    checkoutRequestId: text('checkout_request_id'),
    status: text('status')
      .$type<
        | 'active'
        | 'paid'
        | 'trialing'
        | 'scheduled_cancel'
        | 'paused'
        | 'expired'
        | 'canceled'
        | 'past_due'
        | 'incomplete'
        | 'unknown'
      >()
      .notNull()
      .default('unknown'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, string>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    creemSubscriptionUnique: uniqueIndex(
      'paper_boyfriend_billing_subscriptions_creem_subscription_unique',
    ).on(table.creemSubscriptionId),
    userUpdatedAtIdx: index('paper_boyfriend_billing_subscriptions_user_updated_at_idx').on(
      table.userId,
      table.updatedAt,
    ),
  }),
);

export const billingWebhookEvents = pgTable(
  'paper_boyfriend_billing_webhook_events',
  {
    id: text('id').primaryKey(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    processedAtIdx: index('paper_boyfriend_billing_webhook_events_processed_at_idx').on(
      table.processedAt,
    ),
  }),
);
