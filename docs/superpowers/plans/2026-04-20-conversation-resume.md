# Conversation Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add login-time conversation resume with local-first recovery and Neon database fallback, so users can continue the last chat or start fresh by re-selecting a character.

**Architecture:** Keep pages focused on rendering and user decisions. Add a server-side conversation domain for resume candidate lookup, conversation creation, full-history fetch, and message sync. Upgrade browser storage to user-scoped keys with one-time migration from legacy global keys, then let the home page orchestrate local-first recovery and the chat page keep local cache plus async server sync in step.

**Tech Stack:** Next.js App Router, React 19, TypeScript 5, Drizzle ORM, PostgreSQL/Neon, Node `assert` + `tsx` script tests, shadcn/ui dialog components.

---

## File Map

### Create

- `src/server/db/schema/conversations.ts`
- `src/server/conversations/conversation-repository.ts`
- `src/server/conversations/conversation-service.ts`
- `src/server/conversations/default-conversation-service.ts`
- `src/server/conversations/route-handlers.ts`
- `src/app/api/conversations/route.ts`
- `src/app/api/conversations/resume-candidate/route.ts`
- `src/app/api/conversations/[conversationId]/route.ts`
- `src/app/api/conversations/[conversationId]/messages/sync/route.ts`
- `src/components/home/resume-dialog.tsx`
- `scripts/conversation-service.test.ts`
- `scripts/conversation-route-handlers.test.ts`
- `scripts/conversation-storage.test.ts`

### Modify

- `src/server/db/schema/index.ts`
- `package.json`
- `src/lib/config.ts`
- `src/lib/storage.ts`
- `src/app/page.tsx`
- `src/app/chat/page.tsx`
- `README.md`

### Responsibilities

- `src/server/db/schema/conversations.ts`
  - Drizzle schema for conversations and conversation messages.
- `src/server/conversations/conversation-repository.ts`
  - Database-only reads/writes for conversation entities.
- `src/server/conversations/conversation-service.ts`
  - Business logic for resume candidate lookup, conversation creation, detail fetch, and message sync.
- `src/server/conversations/default-conversation-service.ts`
  - Lazy singleton wiring to the live repository and DB client.
- `src/server/conversations/route-handlers.ts`
  - Request parsing, auth-aware error handling, JSON responses.
- `src/lib/storage.ts`
  - User-scoped local storage helpers plus legacy migration.
- `src/components/home/resume-dialog.tsx`
  - Reusable “continue / reselect” dialog UI.
- `src/app/page.tsx`
  - Local-first resume candidate check and home-page decision flow.
- `src/app/chat/page.tsx`
  - Conversation-aware loading, creation, restore, and sync behavior.

## Task 1: Add Conversation Domain Tests and Core Service

**Files:**
- Create: `scripts/conversation-service.test.ts`
- Create: `src/server/conversations/conversation-service.ts`

- [ ] **Step 1: Write the failing service test**

```ts
import assert from 'node:assert/strict';

type StoredConversation = {
  id: string;
  userId: string;
  characterId: string;
  lastMessagePreview: string | null;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

type StoredMessage = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'image' | 'video' | null;
  mediaUrl: string | null;
  videoRequestId: string | null;
  videoStatus: 'pending' | 'completed' | 'failed' | null;
  pendingCaption: string | null;
  mediaKind: 'dance' | 'workout' | null;
  createdAt: Date;
};

async function main() {
  const { createConversationService } = await import(
    '../src/server/conversations/conversation-service'
  );

  const conversations = new Map<string, StoredConversation>();
  const messages = new Map<string, StoredMessage>();
  let nextConversationId = 1;

  const service = createConversationService({
    now: () => new Date('2026-04-20T10:00:00.000Z'),
    createConversationId: () => `conversation_${nextConversationId++}`,
    repository: {
      async findLatestActiveConversationByUserId(userId) {
        return [...conversations.values()]
          .filter(item => item.userId === userId && item.archivedAt === null)
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null;
      },
      async createConversation(input) {
        const row: StoredConversation = { ...input, archivedAt: null };
        conversations.set(row.id, row);
        return row;
      },
      async findConversationById(userId, conversationId) {
        const row = conversations.get(conversationId);
        return row && row.userId === userId ? row : null;
      },
      async listMessages(conversationId) {
        return [...messages.values()]
          .filter(item => item.conversationId === conversationId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      },
      async upsertMessages(input) {
        for (const item of input.messages) {
          messages.set(item.id, item);
        }
        return input.messages.length;
      },
      async touchConversation(input) {
        const row = conversations.get(input.conversationId);
        if (!row) return;
        row.lastMessagePreview = input.lastMessagePreview;
        row.lastMessageAt = input.lastMessageAt;
        row.updatedAt = input.updatedAt;
      },
    },
  });

  const created = await service.createConversation({
    userId: 'user_1',
    characterId: 'uncle',
  });

  assert.equal(created.characterId, 'uncle');

  const syncCount = await service.syncConversationMessages({
    userId: 'user_1',
    conversationId: created.id,
    characterId: 'uncle',
    messages: [
      {
        id: 'message_1',
        role: 'assistant',
        content: '你好，终于见到你了。',
        timestamp: 1713600000000,
        type: 'text',
      },
    ],
  });

  assert.equal(syncCount.persistedCount, 1);

  const latest = await service.getResumeCandidate('user_1');
  assert.ok(latest);
  assert.equal(latest?.conversationId, created.id);
  assert.equal(latest?.characterId, 'uncle');

  const detail = await service.getConversationDetail({
    userId: 'user_1',
    conversationId: created.id,
  });
  assert.equal(detail.messages.length, 1);
  assert.equal(detail.messages[0]?.content, '你好，终于见到你了。');

  console.log('conversation service test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx scripts/conversation-service.test.ts`

Expected: FAIL with `Cannot find module '../src/server/conversations/conversation-service'` or missing export errors.

- [ ] **Step 3: Write the minimal service implementation**

```ts
export type ConversationMessageInput = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  type?: 'text' | 'image' | 'video';
  mediaUrl?: string;
  videoRequestId?: string;
  videoStatus?: 'pending' | 'completed' | 'failed';
  pendingCaption?: string;
  mediaKind?: 'dance' | 'workout';
};

export function createConversationService(deps: {
  now?: () => Date;
  createConversationId?: () => string;
  repository: {
    findLatestActiveConversationByUserId(userId: string): Promise<any>;
    createConversation(input: any): Promise<any>;
    findConversationById(userId: string, conversationId: string): Promise<any>;
    listMessages(conversationId: string): Promise<any[]>;
    upsertMessages(input: { conversationId: string; messages: any[] }): Promise<number>;
    touchConversation(input: {
      conversationId: string;
      lastMessagePreview: string | null;
      lastMessageAt: Date;
      updatedAt: Date;
    }): Promise<void>;
  };
}) {
  const now = deps.now ?? (() => new Date());
  const createConversationId =
    deps.createConversationId ?? (() => crypto.randomUUID());

  return {
    async getResumeCandidate(userId: string) {
      const conversation =
        await deps.repository.findLatestActiveConversationByUserId(userId);
      if (!conversation) {
        return null;
      }

      return {
        conversationId: conversation.id,
        characterId: conversation.characterId,
        lastMessagePreview: conversation.lastMessagePreview,
        lastMessageAt: conversation.lastMessageAt,
      };
    },

    async createConversation(input: { userId: string; characterId: string }) {
      const timestamp = now();
      return deps.repository.createConversation({
        id: createConversationId(),
        userId: input.userId,
        characterId: input.characterId,
        title: null,
        lastMessagePreview: null,
        lastMessageAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    },

    async getConversationDetail(input: {
      userId: string;
      conversationId: string;
    }) {
      const conversation = await deps.repository.findConversationById(
        input.userId,
        input.conversationId,
      );
      if (!conversation) {
        return null;
      }

      const messages = await deps.repository.listMessages(input.conversationId);
      return {
        conversation,
        messages: messages.map(message => ({
          id: message.id,
          role: message.role,
          content: message.content,
          timestamp: message.createdAt.getTime(),
          type: message.type ?? 'text',
          mediaUrl: message.mediaUrl ?? undefined,
          videoRequestId: message.videoRequestId ?? undefined,
          videoStatus: message.videoStatus ?? undefined,
          pendingCaption: message.pendingCaption ?? undefined,
          mediaKind: message.mediaKind ?? undefined,
        })),
      };
    },

    async syncConversationMessages(input: {
      userId: string;
      conversationId: string;
      characterId: string;
      messages: ConversationMessageInput[];
    }) {
      const conversation = await deps.repository.findConversationById(
        input.userId,
        input.conversationId,
      );
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      const rows = input.messages.map(message => ({
        id: message.id,
        conversationId: input.conversationId,
        role: message.role,
        content: message.content,
        type: message.type ?? 'text',
        mediaUrl: message.mediaUrl ?? null,
        videoRequestId: message.videoRequestId ?? null,
        videoStatus: message.videoStatus ?? null,
        pendingCaption: message.pendingCaption ?? null,
        mediaKind: message.mediaKind ?? null,
        createdAt: new Date(message.timestamp),
      }));

      const persistedCount = await deps.repository.upsertMessages({
        conversationId: input.conversationId,
        messages: rows,
      });

      const lastMessage = input.messages[input.messages.length - 1] ?? null;
      if (lastMessage) {
        await deps.repository.touchConversation({
          conversationId: input.conversationId,
          lastMessagePreview: lastMessage.content.slice(0, 120),
          lastMessageAt: new Date(lastMessage.timestamp),
          updatedAt: now(),
        });
      }

      return { conversationId: input.conversationId, persistedCount };
    },
  };
}
```

- [ ] **Step 4: Run the service test to verify it passes**

Run: `node --import tsx scripts/conversation-service.test.ts`

Expected: PASS with `conversation service test passed.`

- [ ] **Step 5: Commit**

```bash
git add scripts/conversation-service.test.ts src/server/conversations/conversation-service.ts
git commit -m "feat: add conversation service contract"
```

## Task 2: Add Drizzle Schema, Repository, and Runtime Wiring

**Files:**
- Create: `src/server/db/schema/conversations.ts`
- Create: `src/server/conversations/conversation-repository.ts`
- Create: `src/server/conversations/default-conversation-service.ts`
- Modify: `src/server/db/schema/index.ts`

- [ ] **Step 1: Write the failing repository-backed assertion into the service test**

Append this block to `scripts/conversation-service.test.ts` after the current assertions:

```ts
  await service.syncConversationMessages({
    userId: 'user_1',
    conversationId: created.id,
    characterId: 'uncle',
    messages: [
      {
        id: 'message_1',
        role: 'assistant',
        content: '你好，终于见到你了。',
        timestamp: 1713600000000,
        type: 'text',
      },
      {
        id: 'message_1',
        role: 'assistant',
        content: '你好，终于见到你了。',
        timestamp: 1713600000000,
        type: 'text',
      },
    ],
  });

  const detailAfterDedup = await service.getConversationDetail({
    userId: 'user_1',
    conversationId: created.id,
  });
  assert.equal(detailAfterDedup?.messages.length, 1);
```

- [ ] **Step 2: Run the service test to verify it fails on duplicate handling**

Run: `node --import tsx scripts/conversation-service.test.ts`

Expected: FAIL because duplicate message ids are still counted twice.

- [ ] **Step 3: Add schema and repository implementation**

Create `src/server/db/schema/conversations.ts`:

```ts
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { users } from './auth';

export const conversations = pgTable(
  'paper_boyfriend_conversations',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    characterId: text('character_id').notNull(),
    title: text('title'),
    lastMessagePreview: text('last_message_preview'),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  table => ({
    userUpdatedAtIdx: index('paper_boyfriend_conversations_user_updated_at_idx').on(
      table.userId,
      table.updatedAt,
    ),
  }),
);

export const conversationMessages = pgTable(
  'paper_boyfriend_conversation_messages',
  {
    id: text('id').primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    type: text('type'),
    mediaUrl: text('media_url'),
    videoRequestId: text('video_request_id'),
    videoStatus: text('video_status'),
    pendingCaption: text('pending_caption'),
    mediaKind: text('media_kind'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  table => ({
    conversationCreatedAtIdx: index(
      'paper_boyfriend_conversation_messages_conversation_created_at_idx',
    ).on(table.conversationId, table.createdAt),
  }),
);
```

Create `src/server/conversations/conversation-repository.ts`:

```ts
import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { conversationMessages, conversations } from '@/server/db/schema/conversations';

export function createConversationRepository(database = db) {
  return {
    async findLatestActiveConversationByUserId(userId: string) {
      const [row] = await database
        .select()
        .from(conversations)
        .where(and(eq(conversations.userId, userId), isNull(conversations.archivedAt)))
        .orderBy(desc(conversations.updatedAt))
        .limit(1);

      return row ?? null;
    },

    async createConversation(input: typeof conversations.$inferInsert) {
      const [row] = await database.insert(conversations).values(input).returning();
      return row;
    },

    async findConversationById(userId: string, conversationId: string) {
      const [row] = await database
        .select()
        .from(conversations)
        .where(
          and(eq(conversations.id, conversationId), eq(conversations.userId, userId)),
        )
        .limit(1);

      return row ?? null;
    },

    async listMessages(conversationId: string) {
      return database
        .select()
        .from(conversationMessages)
        .where(eq(conversationMessages.conversationId, conversationId))
        .orderBy(asc(conversationMessages.createdAt));
    },

    async upsertMessages(input: {
      conversationId: string;
      messages: Array<typeof conversationMessages.$inferInsert>;
    }) {
      if (input.messages.length === 0) {
        return 0;
      }

      await database
        .insert(conversationMessages)
        .values(input.messages)
        .onConflictDoNothing({ target: conversationMessages.id });

      return input.messages.length;
    },

    async touchConversation(input: {
      conversationId: string;
      lastMessagePreview: string | null;
      lastMessageAt: Date;
      updatedAt: Date;
    }) {
      await database
        .update(conversations)
        .set({
          lastMessagePreview: input.lastMessagePreview,
          lastMessageAt: input.lastMessageAt,
          updatedAt: input.updatedAt,
        })
        .where(eq(conversations.id, input.conversationId));
    },
  };
}
```

Create `src/server/conversations/default-conversation-service.ts`:

```ts
import { createConversationRepository } from './conversation-repository';
import { createConversationService } from './conversation-service';

let conversationService:
  | ReturnType<typeof createConversationService>
  | null = null;

export function getConversationService() {
  if (!conversationService) {
    conversationService = createConversationService({
      repository: createConversationRepository(),
    });
  }

  return conversationService;
}
```

Modify `src/server/db/schema/index.ts`:

```ts
export * from './auth';
export * from './conversations';
```

- [ ] **Step 4: Deduplicate message ids inside the service**

Update `src/server/conversations/conversation-service.ts` to replace the `rows` mapping with:

```ts
      const dedupedMessages = [...new Map(
        input.messages.map(message => [message.id, message]),
      ).values()];

      const rows = dedupedMessages.map(message => ({
        id: message.id,
        conversationId: input.conversationId,
        role: message.role,
        content: message.content,
        type: message.type ?? 'text',
        mediaUrl: message.mediaUrl ?? null,
        videoRequestId: message.videoRequestId ?? null,
        videoStatus: message.videoStatus ?? null,
        pendingCaption: message.pendingCaption ?? null,
        mediaKind: message.mediaKind ?? null,
        createdAt: new Date(message.timestamp),
      }));
```

- [ ] **Step 5: Run the service test again**

Run: `node --import tsx scripts/conversation-service.test.ts`

Expected: PASS with the duplicate assertion now green.

- [ ] **Step 6: Commit**

```bash
git add src/server/db/schema/conversations.ts src/server/db/schema/index.ts src/server/conversations/conversation-repository.ts src/server/conversations/default-conversation-service.ts src/server/conversations/conversation-service.ts scripts/conversation-service.test.ts
git commit -m "feat: add conversation persistence layer"
```

## Task 3: Add User-Scoped Local Storage and Migration Helpers

**Files:**
- Create: `scripts/conversation-storage.test.ts`
- Modify: `src/lib/config.ts`
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Write the failing storage test**

Create `scripts/conversation-storage.test.ts`:

```ts
import assert from 'node:assert/strict';

const store = new Map<string, string>();

globalThis.localStorage = {
  getItem(key: string) {
    return store.has(key) ? store.get(key)! : null;
  },
  setItem(key: string, value: string) {
    store.set(key, value);
  },
  removeItem(key: string) {
    store.delete(key);
  },
  clear() {
    store.clear();
  },
  key(index: number) {
    return [...store.keys()][index] ?? null;
  },
  get length() {
    return store.size;
  },
} as Storage;

async function main() {
  const {
    saveSelectedCharacterForUser,
    getSelectedCharacterForUser,
    saveChatHistoryForUser,
    getChatHistoryForUser,
    saveConversationIdForUser,
    getConversationIdForUser,
    migrateLegacyStorageToUser,
    clearConversationStateForUser,
  } = await import('../src/lib/storage');

  localStorage.setItem('ai_boyfriend_character', 'uncle');
  localStorage.setItem(
    'ai_boyfriend_chat_history',
    JSON.stringify([
      {
        id: 'message_1',
        role: 'assistant',
        content: '旧记录',
        timestamp: 1713600000000,
        type: 'text',
      },
    ]),
  );

  migrateLegacyStorageToUser('user_1');

  assert.equal(getSelectedCharacterForUser('user_1'), 'uncle');
  assert.equal(getChatHistoryForUser('user_1').length, 1);

  saveSelectedCharacterForUser('user_2', 'sunshine');
  saveConversationIdForUser('user_2', 'conversation_2');
  saveChatHistoryForUser('user_2', [
    {
      id: 'message_2',
      role: 'assistant',
      content: '当前账号记录',
      timestamp: 1713600000001,
      type: 'text',
    },
  ]);

  assert.equal(getSelectedCharacterForUser('user_2'), 'sunshine');
  assert.equal(getConversationIdForUser('user_2'), 'conversation_2');
  assert.equal(getChatHistoryForUser('user_2')[0]?.content, '当前账号记录');

  clearConversationStateForUser('user_2');
  assert.equal(getSelectedCharacterForUser('user_2'), null);
  assert.equal(getConversationIdForUser('user_2'), null);
  assert.equal(getChatHistoryForUser('user_2').length, 0);

  console.log('conversation storage test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx scripts/conversation-storage.test.ts`

Expected: FAIL because the user-scoped storage helpers do not exist yet.

- [ ] **Step 3: Add storage keys and helper functions**

Modify `src/lib/config.ts`:

```ts
export const STORAGE_KEYS = {
  SELECTED_CHARACTER: 'ai_boyfriend_character',
  CHAT_HISTORY: 'ai_boyfriend_chat_history',
  CONVERSATION_ID: 'ai_boyfriend_conversation_id',
};
```

Modify `src/lib/storage.ts` to add:

```ts
function buildUserStorageKey(baseKey: string, userId: string) {
  return `${baseKey}:${userId}`;
}

export function saveSelectedCharacterForUser(userId: string, characterId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(buildUserStorageKey(STORAGE_KEYS.SELECTED_CHARACTER, userId), characterId);
}

export function getSelectedCharacterForUser(userId: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(buildUserStorageKey(STORAGE_KEYS.SELECTED_CHARACTER, userId));
}

export function saveConversationIdForUser(userId: string, conversationId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(buildUserStorageKey(STORAGE_KEYS.CONVERSATION_ID, userId), conversationId);
}

export function getConversationIdForUser(userId: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(buildUserStorageKey(STORAGE_KEYS.CONVERSATION_ID, userId));
}

export function saveChatHistoryForUser(userId: string, messages: ChatMessage[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    buildUserStorageKey(STORAGE_KEYS.CHAT_HISTORY, userId),
    JSON.stringify(messages.slice(-100)),
  );
}

export function getChatHistoryForUser(userId: string): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(buildUserStorageKey(STORAGE_KEYS.CHAT_HISTORY, userId));
  return raw ? JSON.parse(raw) : [];
}

export function clearConversationStateForUser(userId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(buildUserStorageKey(STORAGE_KEYS.SELECTED_CHARACTER, userId));
  localStorage.removeItem(buildUserStorageKey(STORAGE_KEYS.CONVERSATION_ID, userId));
  localStorage.removeItem(buildUserStorageKey(STORAGE_KEYS.CHAT_HISTORY, userId));
}

export function migrateLegacyStorageToUser(userId: string): void {
  if (typeof window === 'undefined') return;
  const scopedCharacterKey = buildUserStorageKey(STORAGE_KEYS.SELECTED_CHARACTER, userId);
  const scopedHistoryKey = buildUserStorageKey(STORAGE_KEYS.CHAT_HISTORY, userId);

  if (!localStorage.getItem(scopedCharacterKey)) {
    const legacyCharacter = localStorage.getItem(STORAGE_KEYS.SELECTED_CHARACTER);
    if (legacyCharacter) {
      localStorage.setItem(scopedCharacterKey, legacyCharacter);
    }
  }

  if (!localStorage.getItem(scopedHistoryKey)) {
    const legacyHistory = localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);
    if (legacyHistory) {
      localStorage.setItem(scopedHistoryKey, legacyHistory);
    }
  }
}
```

- [ ] **Step 4: Keep existing wrappers backward-safe**

At the bottom of `src/lib/storage.ts`, keep the old wrappers but make them explicit no-ops for unauthenticated legacy flows only:

```ts
export function saveSelectedCharacter(characterId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.SELECTED_CHARACTER, characterId);
}

export function getSelectedCharacter(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.SELECTED_CHARACTER);
}
```

Keep `saveChatHistory`, `getChatHistory`, and `clearAllData` similarly for transitional compatibility, but do not use them in new authenticated flows.

- [ ] **Step 5: Run the storage test**

Run: `node --import tsx scripts/conversation-storage.test.ts`

Expected: PASS with `conversation storage test passed.`

- [ ] **Step 6: Commit**

```bash
git add scripts/conversation-storage.test.ts src/lib/config.ts src/lib/storage.ts
git commit -m "feat: add user-scoped conversation storage"
```

## Task 4: Add Conversation Routes and Home Resume Flow

**Files:**
- Create: `scripts/conversation-route-handlers.test.ts`
- Create: `src/server/conversations/route-handlers.ts`
- Create: `src/app/api/conversations/route.ts`
- Create: `src/app/api/conversations/resume-candidate/route.ts`
- Create: `src/app/api/conversations/[conversationId]/route.ts`
- Create: `src/app/api/conversations/[conversationId]/messages/sync/route.ts`
- Create: `src/components/home/resume-dialog.tsx`
- Modify: `package.json`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write the failing route-handler test**

Create `scripts/conversation-route-handlers.test.ts`:

```ts
import assert from 'node:assert/strict';

async function main() {
  const { createConversationRouteHandlers } = await import(
    '../src/server/conversations/route-handlers'
  );

  const handlers = createConversationRouteHandlers({
    getCurrentUser: async () => ({
      id: 'user_1',
      email: 'user@example.com',
      displayName: 'Randy',
    }),
    conversationService: {
      async getResumeCandidate() {
        return {
          conversationId: 'conversation_1',
          characterId: 'uncle',
          characterName: '林远山',
          lastMessagePreview: '你好，终于见到你了。',
          lastMessageAt: new Date('2026-04-20T10:00:00.000Z'),
        };
      },
      async createConversation(input) {
        return {
          id: 'conversation_2',
          characterId: input.characterId,
        };
      },
      async getConversationDetail() {
        return {
          conversation: {
            id: 'conversation_1',
            characterId: 'uncle',
          },
          messages: [
            {
              id: 'message_1',
              role: 'assistant',
              content: '你好，终于见到你了。',
              timestamp: 1713600000000,
              type: 'text',
            },
          ],
        };
      },
      async syncConversationMessages() {
        return {
          conversationId: 'conversation_1',
          persistedCount: 1,
        };
      },
    },
  });

  const resumeResponse = await handlers.resumeCandidate(
    new Request('http://localhost/api/conversations/resume-candidate'),
  );
  assert.equal(resumeResponse.status, 200);
  assert.equal((await resumeResponse.json()).hasResumeCandidate, true);

  const createResponse = await handlers.createConversation(
    new Request('http://localhost/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: 'sunshine' }),
    }),
  );
  assert.equal(createResponse.status, 201);

  const detailResponse = await handlers.getConversation(
    new Request('http://localhost/api/conversations/conversation_1'),
    { params: { conversationId: 'conversation_1' } },
  );
  assert.equal(detailResponse.status, 200);

  const syncResponse = await handlers.syncMessages(
    new Request('http://localhost/api/conversations/conversation_1/messages/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterId: 'uncle',
        messages: [
          {
            id: 'message_1',
            role: 'assistant',
            content: '你好，终于见到你了。',
            timestamp: 1713600000000,
            type: 'text',
          },
        ],
      }),
    }),
    { params: { conversationId: 'conversation_1' } },
  );
  assert.equal(syncResponse.status, 200);

  console.log('conversation route handlers test passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx scripts/conversation-route-handlers.test.ts`

Expected: FAIL with missing `route-handlers` module.

- [ ] **Step 3: Implement route handlers and API routes**

Create `src/server/conversations/route-handlers.ts`:

```ts
import { NextResponse } from 'next/server';

export function createConversationRouteHandlers(deps: {
  getCurrentUser: (request: Request) => Promise<{ id: string }>;
  conversationService: {
    getResumeCandidate(userId: string): Promise<any>;
    createConversation(input: { userId: string; characterId: string }): Promise<any>;
    getConversationDetail(input: {
      userId: string;
      conversationId: string;
    }): Promise<any>;
    syncConversationMessages(input: {
      userId: string;
      conversationId: string;
      characterId: string;
      messages: any[];
    }): Promise<any>;
  };
}) {
  return {
    async resumeCandidate(request: Request) {
      const user = await deps.getCurrentUser(request);
      const candidate = await deps.conversationService.getResumeCandidate(user.id);
      return NextResponse.json({
        hasResumeCandidate: Boolean(candidate),
        source: candidate ? 'database' : null,
        ...candidate,
      });
    },

    async createConversation(request: Request) {
      const user = await deps.getCurrentUser(request);
      const body = (await request.json()) as { characterId?: string };
      const conversation = await deps.conversationService.createConversation({
        userId: user.id,
        characterId: body.characterId ?? '',
      });
      return NextResponse.json(
        {
          conversationId: conversation.id,
          characterId: conversation.characterId,
        },
        { status: 201 },
      );
    },

    async getConversation(request: Request, context: { params: { conversationId: string } }) {
      const user = await deps.getCurrentUser(request);
      const detail = await deps.conversationService.getConversationDetail({
        userId: user.id,
        conversationId: context.params.conversationId,
      });
      return NextResponse.json(detail);
    },

    async syncMessages(request: Request, context: { params: { conversationId: string } }) {
      const user = await deps.getCurrentUser(request);
      const body = (await request.json()) as {
        characterId: string;
        messages: any[];
      };
      const result = await deps.conversationService.syncConversationMessages({
        userId: user.id,
        conversationId: context.params.conversationId,
        characterId: body.characterId,
        messages: body.messages,
      });
      return NextResponse.json({
        success: true,
        conversationId: result.conversationId,
        persistedCount: result.persistedCount,
      });
    },
  };
}
```

Create `src/app/api/conversations/resume-candidate/route.ts`:

```ts
import { getAuthenticatedSession } from '@/server/auth/request-auth';
import { getConversationService } from '@/server/conversations/default-conversation-service';
import { createConversationRouteHandlers } from '@/server/conversations/route-handlers';

const handlers = createConversationRouteHandlers({
  getCurrentUser: async request => {
    const session = await getAuthenticatedSession(request);
    if (!session) {
      throw new Error('Authentication required');
    }
    return session.user;
  },
  conversationService: getConversationService(),
});

export async function GET(request: Request) {
  return handlers.resumeCandidate(request);
}
```

Create `src/app/api/conversations/route.ts`:

```ts
import { getAuthenticatedSession } from '@/server/auth/request-auth';
import { getConversationService } from '@/server/conversations/default-conversation-service';
import { createConversationRouteHandlers } from '@/server/conversations/route-handlers';

const handlers = createConversationRouteHandlers({
  getCurrentUser: async request => {
    const session = await getAuthenticatedSession(request);
    if (!session) {
      throw new Error('Authentication required');
    }
    return session.user;
  },
  conversationService: getConversationService(),
});

export async function POST(request: Request) {
  return handlers.createConversation(request);
}
```

Create `src/app/api/conversations/[conversationId]/route.ts`:

```ts
import { getAuthenticatedSession } from '@/server/auth/request-auth';
import { getConversationService } from '@/server/conversations/default-conversation-service';
import { createConversationRouteHandlers } from '@/server/conversations/route-handlers';

const handlers = createConversationRouteHandlers({
  getCurrentUser: async request => {
    const session = await getAuthenticatedSession(request);
    if (!session) {
      throw new Error('Authentication required');
    }
    return session.user;
  },
  conversationService: getConversationService(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  return handlers.getConversation(request, { params: await context.params });
}
```

Create `src/app/api/conversations/[conversationId]/messages/sync/route.ts`:

```ts
import { getAuthenticatedSession } from '@/server/auth/request-auth';
import { getConversationService } from '@/server/conversations/default-conversation-service';
import { createConversationRouteHandlers } from '@/server/conversations/route-handlers';

const handlers = createConversationRouteHandlers({
  getCurrentUser: async request => {
    const session = await getAuthenticatedSession(request);
    if (!session) {
      throw new Error('Authentication required');
    }
    return session.user;
  },
  conversationService: getConversationService(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  return handlers.syncMessages(request, { params: await context.params });
}
```

Update `package.json` scripts:

```json
"test:conversation": "node --import tsx scripts/conversation-storage.test.ts && node --import tsx scripts/conversation-service.test.ts && node --import tsx scripts/conversation-route-handlers.test.ts"
```

- [ ] **Step 4: Add the home-page resume dialog**

Create `src/components/home/resume-dialog.tsx`:

```tsx
'use client';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type ResumeDialogProps = {
  open: boolean;
  characterName: string;
  lastMessagePreview: string | null;
  onContinue: () => void;
  onReselect: () => void;
  loading?: boolean;
};

export function ResumeDialog(props: ResumeDialogProps) {
  return (
    <AlertDialog open={props.open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>继续上一次对话？</AlertDialogTitle>
          <AlertDialogDescription>
            上次聊天角色：{props.characterName}
            {props.lastMessagePreview ? `\n最后一条：${props.lastMessagePreview}` : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" onClick={props.onReselect} disabled={props.loading}>
              重新选择角色
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={props.onContinue} disabled={props.loading}>
              继续上一次对话
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

Modify `src/app/page.tsx` to add:

```tsx
  const [resumeCandidate, setResumeCandidate] = useState<{
    source: 'local' | 'database';
    conversationId: string;
    characterId: string;
    characterName: string;
    lastMessagePreview: string | null;
  } | null>(null);
  const [isCheckingResume, setIsCheckingResume] = useState(true);
  const [resumeDecisionLoading, setResumeDecisionLoading] = useState(false);
```

and the core effect:

```tsx
  useEffect(() => {
    if (!authenticated || !user) {
      return;
    }

    migrateLegacyStorageToUser(user.id);

    const localCharacterId = getSelectedCharacterForUser(user.id);
    const localConversationId = getConversationIdForUser(user.id);
    const localHistory = getChatHistoryForUser(user.id);

    if (localCharacterId && localConversationId && localHistory.length > 0) {
      const character = CHARACTERS[localCharacterId as keyof typeof CHARACTERS];
      setResumeCandidate({
        source: 'local',
        conversationId: localConversationId,
        characterId: localCharacterId,
        characterName: character?.name ?? localCharacterId,
        lastMessagePreview: localHistory[localHistory.length - 1]?.content ?? null,
      });
      setIsCheckingResume(false);
      return;
    }

    void (async () => {
      try {
        const response = await fetch('/api/conversations/resume-candidate', {
          cache: 'no-store',
        });
        const data = await response.json();
        if (data.hasResumeCandidate) {
          setResumeCandidate({
            source: 'database',
            conversationId: data.conversationId,
            characterId: data.characterId,
            characterName: data.characterName,
            lastMessagePreview: data.lastMessagePreview,
          });
        }
      } finally {
        setIsCheckingResume(false);
      }
    })();
  }, [authenticated, user]);
```

- [ ] **Step 5: Run the conversation route test**

Run: `node --import tsx scripts/conversation-route-handlers.test.ts`

Expected: PASS with `conversation route handlers test passed.`

- [ ] **Step 6: Commit**

```bash
git add scripts/conversation-route-handlers.test.ts src/server/conversations/route-handlers.ts src/app/api/conversations/route.ts src/app/api/conversations/resume-candidate/route.ts src/app/api/conversations/[conversationId]/route.ts src/app/api/conversations/[conversationId]/messages/sync/route.ts src/components/home/resume-dialog.tsx src/app/page.tsx package.json
git commit -m "feat: add resume candidate routes and home flow"
```

## Task 5: Integrate Chat Page Restore, Sync, and New Conversation Creation

**Files:**
- Modify: `src/app/chat/page.tsx`
- Modify: `src/app/page.tsx`
- Modify: `README.md`

- [ ] **Step 1: Add the failing restore assertion to the storage test**

Append this block to `scripts/conversation-storage.test.ts`:

```ts
  saveConversationIdForUser('user_3', 'conversation_3');
  saveSelectedCharacterForUser('user_3', 'straight_man');
  saveChatHistoryForUser('user_3', [
    {
      id: 'message_3',
      role: 'assistant',
      content: '等你很久了。',
      timestamp: 1713600000002,
      type: 'text',
    },
  ]);

  assert.equal(getConversationIdForUser('user_3'), 'conversation_3');
  assert.equal(getSelectedCharacterForUser('user_3'), 'straight_man');
  assert.equal(getChatHistoryForUser('user_3').length, 1);
```

This should already pass after Task 3 and serves as the explicit guard for chat-page restore state.

- [ ] **Step 2: Run the storage test as a guard**

Run: `node --import tsx scripts/conversation-storage.test.ts`

Expected: PASS.

- [ ] **Step 3: Update the home page continue / reselect actions**

Modify `src/app/page.tsx` to add:

```tsx
  async function handleContinueConversation() {
    if (!user || !resumeCandidate) return;

    setResumeDecisionLoading(true);

    try {
      if (resumeCandidate.source === 'database') {
        const response = await fetch(`/api/conversations/${resumeCandidate.conversationId}`, {
          cache: 'no-store',
        });
        const data = await response.json();
        saveSelectedCharacterForUser(user.id, data.conversation.characterId);
        saveConversationIdForUser(user.id, data.conversation.id);
        saveChatHistoryForUser(user.id, data.messages);
      }

      router.push('/chat');
    } finally {
      setResumeDecisionLoading(false);
    }
  }

  function handleReselectCharacter() {
    if (!user) return;
    clearConversationStateForUser(user.id);
    setResumeCandidate(null);
  }
```

Render the dialog:

```tsx
        {resumeCandidate ? (
          <ResumeDialog
            open
            characterName={resumeCandidate.characterName}
            lastMessagePreview={resumeCandidate.lastMessagePreview}
            onContinue={handleContinueConversation}
            onReselect={handleReselectCharacter}
            loading={resumeDecisionLoading}
          />
        ) : null}
```

- [ ] **Step 4: Make the chat page conversation-aware**

Modify `src/app/chat/page.tsx` imports:

```tsx
import {
  ChatMessage,
  clearConversationStateForUser,
  getChatHistoryForUser,
  getConversationIdForUser,
  getSelectedCharacterForUser,
  saveChatHistoryForUser,
  saveConversationIdForUser,
  saveSelectedCharacterForUser,
} from '@/lib/storage';
```

Change the auth hook usage:

```tsx
  const { isLoading: sessionLoading, authenticated, user } = useAuthSession({
    required: true,
  });
```

Replace the initial load effect with:

```tsx
  useEffect(() => {
    if (!user) {
      return;
    }

    const characterId = getSelectedCharacterForUser(user.id);
    const conversationId = getConversationIdForUser(user.id);
    const history = getChatHistoryForUser(user.id);

    if (!characterId || !conversationId) {
      router.push('/');
      return;
    }

    const char = CHARACTERS[characterId as keyof typeof CHARACTERS];
    if (!char) {
      clearConversationStateForUser(user.id);
      router.push('/');
      return;
    }

    setCharacter(char);

    if (history.length > 0) {
      setMessages(history);
      setMessageCount(history.filter(item => item.role === 'user').length);
      setInitialized(true);
      return;
    }

    void (async () => {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        cache: 'no-store',
      });
      const data = await response.json();
      saveChatHistoryForUser(user.id, data.messages);
      setMessages(data.messages);
      setMessageCount(data.messages.filter((item: ChatMessage) => item.role === 'user').length);
      setInitialized(data.messages.length > 0);
    })();
  }, [router, user]);
```

Then update every call site of `saveChatHistory(...)` to:

```tsx
      if (user) {
        saveChatHistoryForUser(user.id, nextMessages);
      }
```

and add async sync after successful message updates:

```tsx
  async function syncConversationSnapshot(nextMessages: ChatMessage[]) {
    if (!user || !character) return;
    const conversationId = getConversationIdForUser(user.id);
    if (!conversationId) return;

    await fetch(`/api/conversations/${conversationId}/messages/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterId: character.id,
        messages: nextMessages,
      }),
    });
  }
```

After role selection on the home page, create the conversation before routing:

```tsx
  const response = await fetch('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId: selectedId }),
  });
  const data = await response.json();

  saveSelectedCharacterForUser(user.id, selectedId);
  saveConversationIdForUser(user.id, data.conversationId);
  saveChatHistoryForUser(user.id, []);
```

- [ ] **Step 5: Run the full conversation test suite and core regressions**

Run:

```bash
pnpm test:conversation
pnpm test:auth
pnpm test:chat-route
pnpm ts-check
pnpm build
```

Expected:

- `conversation storage test passed.`
- `conversation service test passed.`
- `conversation route handlers test passed.`
- Existing auth tests still pass
- TypeScript exits `0`
- Build completes successfully

- [ ] **Step 6: Update README and commit**

Add a short section to `README.md`:

```md
## Conversation Resume

- Login always returns the user to `/`
- If a previous conversation exists, the home page offers:
  - Continue last conversation
  - Re-select character
- Recovery order is local user-scoped storage first, then Neon conversation history
```

Commit:

```bash
git add src/app/page.tsx src/app/chat/page.tsx README.md
git commit -m "feat: restore previous conversations after login"
```

## Self-Review Checklist

- Spec coverage
  - Login returns to home and prompts continue/reselect: Task 4 and Task 5
  - Local-first, DB fallback restore: Task 3, Task 4, and Task 5
  - Full-message recovery rather than role-only recovery: Task 1, Task 2, and Task 5
  - User-scoped local storage with legacy migration: Task 3
  - Server-side conversation tables and APIs: Task 2 and Task 4
- Placeholder scan
  - No `TODO`, `TBD`, or “implement later” placeholders remain in this plan
- Type consistency
  - `conversationId`, `characterId`, `messages`, and user-scoped storage names are consistent across tasks
