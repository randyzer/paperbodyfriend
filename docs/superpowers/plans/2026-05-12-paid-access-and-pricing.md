# Paid Access and Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Creem billing demo into a real gated product flow: anonymous users can试玩 3 rounds, logged-in free users can chat 7 rounds, paid subscribers are unlimited, and the homepage clearly sells the `$9.9/month` plan.

**Architecture:** Keep Creem and billing persistence exactly where they already live. Add a dedicated server-side chat access policy layer plus a small anonymous quota cookie utility, then thread that policy through `/api/chat`. On the client, add anonymous local conversation storage, a homepage pricing table, and clear paywall/login cards in chat while reusing the existing billing status API for paid-vs-free decisions.

**Tech Stack:** Next.js App Router, React 19, TypeScript 5, Drizzle ORM, PostgreSQL/Neon, Node `assert` + `tsx` script tests, shadcn/ui cards/buttons/dialog primitives, Creem Test Mode.

---

## File Map

### Create

- `src/server/access/chat-access-errors.ts`
- `src/server/access/chat-access-service.ts`
- `src/server/access/anon-chat-cookie.ts`
- `src/components/home/pricing-table.tsx`
- `src/components/chat/chat-limit-card.tsx`
- `scripts/chat-access-service.test.ts`
- `scripts/homepage-pricing.test.ts`
- `scripts/chat-limit-card.test.ts`

### Modify

- `src/server/auth/request-auth.ts`
- `src/app/api/chat/route.ts`
- `src/lib/storage.ts`
- `src/hooks/use-auth-session.ts`
- `src/app/page.tsx`
- `src/app/chat/page.tsx`
- `src/app/pricing/page.tsx`
- `package.json`

### Responsibilities

- `src/server/access/chat-access-errors.ts`
  - Shared business error codes for anonymous and free-tier limits.
- `src/server/access/chat-access-service.ts`
  - Central policy: resolve access tier, current usage, max rounds, and allow/deny result.
- `src/server/access/anon-chat-cookie.ts`
  - Read/write a lightweight anonymous usage cookie for server-enforced anonymous limits.
- `src/lib/storage.ts`
  - Add anonymous character/history helpers without disturbing existing user-scoped storage.
- `src/app/api/chat/route.ts`
  - Call the access policy before generating AI output and return structured errors.
- `src/components/home/pricing-table.tsx`
- Homepage pricing comparison and CTA rendering.
- `src/components/chat/chat-limit-card.tsx`
  - Reusable paywall / login prompt inside chat.
- `src/app/page.tsx`
  - Anonymous start, homepage pricing placement, and logged-in user tier label rendering.
- `src/app/chat/page.tsx`
  - Anonymous bootstrapping, tier-aware limit handling, and visible free/paid status indicator rendering.

## Assumptions

- Anonymous conversation history remains local-only in this phase.
- Logging in after hitting the anonymous limit does **not** migrate old anonymous messages into a new account conversation; the user resumes as an authenticated user from the normal account flow.
- Billing status keeps using the existing latest-subscription lookup; no new quota/usage table is introduced.

## Task 1: Add Failing Tests for Chat Access Policy

**Files:**
- Create: `scripts/chat-access-service.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing policy test**

```ts
import assert from 'node:assert/strict';

async function main() {
  const { createChatAccessService, ChatAccessError } = await import(
    '../src/server/access/chat-access-service'
  );

  const service = createChatAccessService({
    getBillingStatus: async userId => {
      if (userId === 'paid-user') {
        return { active: true };
      }

      return { active: false };
    },
  });

  const anonymousAllowed = await service.assertCanSendMessage({
    userId: null,
    currentRoundTripCount: 2,
  });
  assert.equal(anonymousAllowed.tier, 'anonymous');
  assert.equal(anonymousAllowed.maxRoundTrips, 3);

  await assert.rejects(
    () =>
      service.assertCanSendMessage({
        userId: null,
        currentRoundTripCount: 3,
      }),
    (error: unknown) =>
      error instanceof ChatAccessError &&
      error.code === 'ANON_CHAT_LIMIT_REACHED',
  );

  const freeAllowed = await service.assertCanSendMessage({
    userId: 'free-user',
    currentRoundTripCount: 6,
  });
  assert.equal(freeAllowed.tier, 'free');
  assert.equal(freeAllowed.maxRoundTrips, 7);

  await assert.rejects(
    () =>
      service.assertCanSendMessage({
        userId: 'free-user',
        currentRoundTripCount: 7,
      }),
    (error: unknown) =>
      error instanceof ChatAccessError &&
      error.code === 'FREE_CHAT_LIMIT_REACHED',
  );

  const paidAllowed = await service.assertCanSendMessage({
    userId: 'paid-user',
    currentRoundTripCount: 999,
  });
  assert.equal(paidAllowed.tier, 'paid');
  assert.equal(paidAllowed.maxRoundTrips, null);

  console.log('chat access service test passed');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --import tsx scripts/chat-access-service.test.ts`

Expected: fail with `Cannot find module '../src/server/access/chat-access-service'`.

- [ ] **Step 3: Add a test script entry**

```json
{
  "scripts": {
    "test:chat-access": "node --import tsx scripts/chat-access-service.test.ts"
  }
}
```

- [ ] **Step 4: Run package script to confirm it still fails for the right reason**

Run: `pnpm test:chat-access`

Expected: fail with missing module / export errors, not JSON parse or command-not-found errors.

## Task 2: Implement Server-Side Chat Access Policy

**Files:**
- Create: `src/server/access/chat-access-errors.ts`
- Create: `src/server/access/chat-access-service.ts`
- Run test: `scripts/chat-access-service.test.ts`

- [ ] **Step 1: Add the business error type**

```ts
export type ChatAccessErrorCode =
  | 'ANON_CHAT_LIMIT_REACHED'
  | 'FREE_CHAT_LIMIT_REACHED';

export class ChatAccessError extends Error {
  readonly code: ChatAccessErrorCode;
  readonly statusCode: number;
  readonly userMessage: string;

  constructor(input: {
    code: ChatAccessErrorCode;
    userMessage: string;
    statusCode?: number;
  }) {
    super(input.userMessage);
    this.name = 'ChatAccessError';
    this.code = input.code;
    this.userMessage = input.userMessage;
    this.statusCode = input.statusCode ?? 403;
  }
}
```

- [ ] **Step 2: Add the minimal access service implementation**

```ts
import { ChatAccessError } from './chat-access-errors';

type BillingLookupResult = {
  active: boolean;
};

export function createChatAccessService(deps: {
  getBillingStatus(userId: string): Promise<BillingLookupResult>;
}) {
  return {
    async assertCanSendMessage(input: {
      userId: string | null;
      currentRoundTripCount: number;
    }) {
      if (!input.userId) {
        if (input.currentRoundTripCount >= 3) {
          throw new ChatAccessError({
            code: 'ANON_CHAT_LIMIT_REACHED',
            userMessage: '试玩次数已用完，请先登录后继续聊天。',
          });
        }

        return {
          tier: 'anonymous' as const,
          maxRoundTrips: 3,
        };
      }

      const billing = await deps.getBillingStatus(input.userId);
      if (billing.active) {
        return {
          tier: 'paid' as const,
          maxRoundTrips: null,
        };
      }

      if (input.currentRoundTripCount >= 7) {
        throw new ChatAccessError({
          code: 'FREE_CHAT_LIMIT_REACHED',
          userMessage: '免费额度已用完，开通会员后可无限次使用。',
        });
      }

      return {
        tier: 'free' as const,
        maxRoundTrips: 7,
      };
    },
  };
}

export { ChatAccessError };
```

- [ ] **Step 3: Run the policy test and verify GREEN**

Run: `pnpm test:chat-access`

Expected: PASS with `chat access service test passed`.

- [ ] **Step 4: Commit the policy layer**

```bash
git add package.json scripts/chat-access-service.test.ts src/server/access/chat-access-errors.ts src/server/access/chat-access-service.ts
git commit -m "feat: add chat access policy service"
```

## Task 3: Add Anonymous Usage Cookie and Wire It Into `/api/chat`

**Files:**
- Create: `src/server/access/anon-chat-cookie.ts`
- Modify: `src/server/auth/request-auth.ts`
- Modify: `src/app/api/chat/route.ts`
- Modify existing test file if present: `scripts/chat-route.test.ts`

- [ ] **Step 1: Write a failing chat route test for anonymous and free limits**

Add cases like:

```ts
const limitResponse = await POST(
  new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: 'paper_boyfriend_anon_rounds=3',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'hi' }],
      characterPrompt: 'test prompt',
      messageCount: 3,
    }),
  }),
);

assert.equal(limitResponse.status, 403);
assert.deepEqual(await limitResponse.json(), {
  error: '试玩次数已用完，请先登录后继续聊天。',
  code: 'ANON_CHAT_LIMIT_REACHED',
});
```

Add another authenticated free-tier case expecting `FREE_CHAT_LIMIT_REACHED`.

- [ ] **Step 2: Run the targeted test and verify RED**

Run: `node --import tsx scripts/chat-route.test.ts`

Expected: fail because the route still requires authentication and does not return the new business error codes.

- [ ] **Step 3: Add a helper for anonymous round-trip cookies**

```ts
export const ANON_CHAT_ROUNDS_COOKIE = 'paper_boyfriend_anon_rounds';

export function readAnonChatRoundsCookie(rawCookieHeader: string | null) {
  if (!rawCookieHeader) return 0;

  const match = rawCookieHeader
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${ANON_CHAT_ROUNDS_COOKIE}=`));

  if (!match) return 0;

  const rawValue = match.slice(`${ANON_CHAT_ROUNDS_COOKIE}=`.length);
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function buildAnonChatRoundsCookie(nextRoundCount: number) {
  return `${ANON_CHAT_ROUNDS_COOKIE}=${nextRoundCount}; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`;
}
```

- [ ] **Step 4: Add optional-auth lookup in request auth helper**

Extend `src/server/auth/request-auth.ts` with:

```ts
export async function getOptionalAuthenticatedUser(request: Request) {
  try {
    return await requireAuthenticatedUser(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return null;
    }

    throw error;
  }
}
```

- [ ] **Step 5: Update `/api/chat` to enforce policy and set anonymous cookie**

Key code shape:

```ts
const currentUser = await getOptionalAuthenticatedUser(request);
const rawCookieHeader = request.headers.get('cookie');
const anonymousRoundTrips = readAnonChatRoundsCookie(rawCookieHeader);
const currentRoundTripCount = currentUser ? messageCount : anonymousRoundTrips;

await chatAccessService.assertCanSendMessage({
  userId: currentUser?.id ?? null,
  currentRoundTripCount,
});

const response = new Response(responseText, {
  headers: {
    'Content-Type': 'text/plain;charset=utf-8',
  },
});

if (!currentUser) {
  response.headers.set(
    'Set-Cookie',
    buildAnonChatRoundsCookie(currentRoundTripCount + 1),
  );
}

return response;
```

And in `catch`:

```ts
if (error instanceof ChatAccessError) {
  return NextResponse.json(
    { error: error.userMessage, code: error.code },
    { status: error.statusCode },
  );
}
```

- [ ] **Step 6: Run the chat route test and verify GREEN**

Run: `node --import tsx scripts/chat-route.test.ts`

Expected: PASS, including the new anonymous/free limit cases.

- [ ] **Step 7: Commit the route enforcement**

```bash
git add src/server/access/anon-chat-cookie.ts src/server/auth/request-auth.ts src/app/api/chat/route.ts scripts/chat-route.test.ts
git commit -m "feat: enforce chat limits in chat route"
```

## Task 4: Add Anonymous Local Storage Helpers

**Files:**
- Modify: `src/lib/storage.ts`
- Add tests into existing storage script if appropriate or create local assertions inside `scripts/chat-access-service.test.ts`

- [ ] **Step 1: Write a failing storage test for anonymous keys**

Add assertions for:

```ts
saveAnonymousSelectedCharacter('uncle');
assert.equal(getAnonymousSelectedCharacter(), 'uncle');

saveAnonymousChatHistory([
  {
    id: 'message_1',
    role: 'assistant',
    content: 'hello',
    timestamp: Date.now(),
    type: 'text',
  },
]);

assert.equal(getAnonymousChatHistory().length, 1);

clearAnonymousConversationState();
assert.equal(getAnonymousSelectedCharacter(), null);
assert.equal(getAnonymousChatHistory().length, 0);
```

- [ ] **Step 2: Run the storage test and verify RED**

Run: `node --import tsx scripts/conversation-storage.test.ts`

Expected: fail with missing anonymous storage exports.

- [ ] **Step 3: Add minimal anonymous storage API**

Add to `src/lib/storage.ts`:

```ts
const ANON_STORAGE_KEYS = {
  CHARACTER: 'ai_boyfriend_anon_character',
  CHAT_HISTORY: 'ai_boyfriend_anon_chat_history',
};

export function getAnonymousSelectedCharacter() {
  return loadItem(ANON_STORAGE_KEYS.CHARACTER);
}

export function saveAnonymousSelectedCharacter(characterId: string) {
  saveItem(ANON_STORAGE_KEYS.CHARACTER, characterId);
}

export function getAnonymousChatHistory() {
  return readMessages(ANON_STORAGE_KEYS.CHAT_HISTORY);
}

export function saveAnonymousChatHistory(messages: ChatMessage[]) {
  const limitedMessages = messages.slice(-100);
  saveItem(ANON_STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(limitedMessages));
}

export function clearAnonymousConversationState() {
  removeItem(ANON_STORAGE_KEYS.CHARACTER);
  removeItem(ANON_STORAGE_KEYS.CHAT_HISTORY);
}
```

- [ ] **Step 4: Run the storage test and verify GREEN**

Run: `node --import tsx scripts/conversation-storage.test.ts`

Expected: PASS and no regressions for user-scoped storage helpers.

- [ ] **Step 5: Commit storage support**

```bash
git add src/lib/storage.ts scripts/conversation-storage.test.ts
git commit -m "feat: add anonymous conversation storage"
```

## Task 5: Update Homepage to Allow Anonymous Start and Show Pricing Table

**Files:**
- Create: `src/components/home/pricing-table.tsx`
- Create: `scripts/homepage-pricing.test.ts`
- Modify: `src/hooks/use-auth-session.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write a failing homepage behavior test**

Create `scripts/homepage-pricing.test.ts` with assertions against a pure helper exported from `pricing-table.tsx`:

```ts
assert.equal(resolveHomepagePlanCta({ authenticated: false, active: false }), 'register');
assert.equal(resolveHomepagePlanCta({ authenticated: true, active: false }), 'pricing');
assert.equal(resolveHomepagePlanCta({ authenticated: true, active: true }), 'active');
```

Also add a tier-label helper assertion:

```ts
assert.equal(resolveHomepageTierLabel({ authenticated: true, active: false }), '免费用户');
assert.equal(resolveHomepageTierLabel({ authenticated: true, active: true }), '会员用户');
```

- [ ] **Step 2: Run the homepage helper test and verify RED**

Run: `node --import tsx scripts/homepage-pricing.test.ts`

Expected: fail with missing helper / module.

- [ ] **Step 3: Add the pricing table component and CTA helper**

Key shape:

```tsx
export function resolveHomepagePlanCta(input: {
  authenticated: boolean;
  active: boolean;
}) {
  if (!input.authenticated) return 'register';
  if (input.active) return 'active';
  return 'pricing';
}

export function resolveHomepageTierLabel(input: {
  authenticated: boolean;
  active: boolean;
}) {
  if (!input.authenticated) return null;
  return input.active ? '会员用户' : '免费用户';
}

export function PricingTable(props: {
  authenticated: boolean;
  hasActiveSubscription: boolean;
}) {
  return (
    <section className="rounded-3xl border border-pink-100 bg-white/90 p-6 shadow-lg">
      {/* 游客 / 免费 / 会员 三档 */}
    </section>
  );
}
```

- [ ] **Step 4: Make auth session optional on the homepage**

Use:

```ts
const { isLoading: sessionLoading, authenticated, user } = useAuthSession();
```

And only run resume-candidate / user-scoped recovery when `authenticated && user`.

- [ ] **Step 5: Allow anonymous start from the homepage**

In `handleConfirm()`:

```ts
if (!authenticated) {
  clearAnonymousConversationState();
  saveAnonymousSelectedCharacter(selectedId);
  saveAnonymousChatHistory([]);
  router.push('/chat');
  return;
}
```

Keep the authenticated path creating a real conversation via `/api/conversations`.

- [ ] **Step 6: Render the pricing table at the homepage bottom**

Mount `<PricingTable />` below the role selection area and above the global footer.

- [ ] **Step 7: Show tier status in a prominent homepage spot**

In the top-right account area, for authenticated users render:

```tsx
{authenticated ? (
  <div className="flex items-center gap-2">
    <Badge
      className={
        hasActiveSubscription
          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
          : 'bg-amber-100 text-amber-700 hover:bg-amber-100'
      }
    >
      {hasActiveSubscription ? '会员用户' : '免费用户'}
    </Badge>
    {!hasActiveSubscription ? (
      <Button asChild size="sm" variant="outline">
        <Link href="/pricing">升级会员</Link>
      </Button>
    ) : null}
  </div>
) : null}
```

- [ ] **Step 8: Run the homepage helper test and type-check**

Run:
- `node --import tsx scripts/homepage-pricing.test.ts`
- `pnpm ts-check`

Expected: helper test passes, type-check passes.

- [ ] **Step 9: Commit homepage changes**

```bash
git add src/components/home/pricing-table.tsx src/hooks/use-auth-session.ts src/app/page.tsx scripts/homepage-pricing.test.ts
git commit -m "feat: add homepage pricing and anonymous start"
```

## Task 6: Update Chat Page for Anonymous Mode and Limit Cards

**Files:**
- Create: `src/components/chat/chat-limit-card.tsx`
- Create: `scripts/chat-limit-card.test.ts`
- Modify: `src/app/chat/page.tsx`

- [ ] **Step 1: Write a failing UI helper test for limit-card copy**

Add a pure helper:

```ts
assert.deepEqual(
  resolveChatLimitCard('anonymous'),
  {
    title: '试玩已结束',
    primaryLabel: '注册继续',
  },
);

assert.deepEqual(
  resolveChatLimitCard('free'),
  {
    title: '免费额度已用完',
    primaryLabel: '立即开通会员',
  },
);

assert.equal(resolveChatTierLabel({ authenticated: true, active: false }), '免费用户');
assert.equal(resolveChatTierLabel({ authenticated: true, active: true }), '会员用户');
```

- [ ] **Step 2: Run the helper test and verify RED**

Run: `node --import tsx scripts/chat-limit-card.test.ts`

Expected: fail because the helper/component does not exist yet.

- [ ] **Step 3: Add the limit-card component**

```tsx
export function resolveChatLimitCard(kind: 'anonymous' | 'free') {
  return kind === 'anonymous'
    ? {
        title: '试玩已结束',
        description: '注册或登录后可继续体验更多对话。',
        primaryHref: '/register',
        primaryLabel: '注册继续',
        secondaryHref: '/login',
        secondaryLabel: '去登录',
      }
    : {
        title: '免费额度已用完',
        description: '开通会员后即可无限次使用。',
        primaryHref: '/pricing',
        primaryLabel: '立即开通会员',
        secondaryHref: '/',
        secondaryLabel: '返回首页',
      };
}
```

- [ ] **Step 4: Update chat page bootstrapping for anonymous mode**

When `!authenticated`:

```ts
const characterId = getAnonymousSelectedCharacter();
const history = getAnonymousChatHistory();
```

Skip any conversation-id or server fetch requirement.

When authenticated:

- keep existing user-scoped conversation restore behavior.

- [ ] **Step 5: Update send flow to handle limit errors**

Inside `handleSendMessage()`:

```ts
if (!response.ok) {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string; code?: string }
    | null;

  if (payload?.code === 'ANON_CHAT_LIMIT_REACHED') {
    setLimitState('anonymous');
    return;
  }

  if (payload?.code === 'FREE_CHAT_LIMIT_REACHED') {
    setLimitState('free');
    return;
  }

  throw new Error(payload?.error ?? '请求失败');
}
```

- [ ] **Step 6: Persist anonymous history separately**

Whenever `!user`:

```ts
saveAnonymousChatHistory(nextMessages);
```

and do not call `syncConversationSnapshot`.

- [ ] **Step 7: Show tier status in the chat header**

Use billing status plus auth state to render a visible header status block:

```tsx
<div className="flex items-center gap-2">
  <Badge
    className={
      isPaidUser
        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
        : 'bg-amber-100 text-amber-700 hover:bg-amber-100'
    }
  >
    {isPaidUser ? '会员用户' : '免费用户'}
  </Badge>
  {!isPaidUser && authenticated ? (
    <Button asChild size="sm" variant="outline">
      <Link href="/pricing">升级会员</Link>
    </Button>
  ) : null}
</div>
```

Only render this block for authenticated users.

- [ ] **Step 8: Run helper test and type-check**

Run:
- `node --import tsx scripts/chat-limit-card.test.ts`
- `pnpm ts-check`

Expected: both pass.

- [ ] **Step 9: Commit chat UI changes**

```bash
git add src/components/chat/chat-limit-card.tsx src/app/chat/page.tsx scripts/chat-limit-card.test.ts
git commit -m "feat: add chat paywalls for anonymous and free tiers"
```

## Task 7: Polish `/pricing` for Real User Messaging

**Files:**
- Modify: `src/app/pricing/page.tsx`

- [ ] **Step 1: Update the user-facing copy**

Replace demo-flavored bullets with real product copy, for example:

```tsx
<ul className="mt-2 list-disc space-y-1 pl-5">
  <li>无限次与纸片人男友聊天</li>
  <li>持续使用图片、视频、语音等生成能力</li>
  <li>订阅状态自动同步，无需重复购买</li>
</ul>
```

- [ ] **Step 2: Update the price presentation**

Add a clear price block:

```tsx
<div className="flex items-end gap-2">
  <span className="text-4xl font-semibold text-gray-900">$9.9</span>
  <span className="pb-1 text-sm text-gray-500">/ 月</span>
</div>
```

- [ ] **Step 3: Keep existing status logic but tighten CTA states**

Ensure button text resolves to:

- `立即开通`
- `正在跳转支付...`
- `当前已开通`

with no demo wording left in the primary CTA area.

- [ ] **Step 4: Run type-check and build**

Run:
- `pnpm ts-check`
- `pnpm build`

Expected: both pass.

- [ ] **Step 5: Commit pricing polish**

```bash
git add src/app/pricing/page.tsx
git commit -m "feat: polish pricing page copy and pricing block"
```

## Task 8: Final Verification

**Files:**
- No new files

- [ ] **Step 1: Run all relevant automated checks**

Run:
- `pnpm test:chat-access`
- `node --import tsx scripts/chat-route.test.ts`
- `node --import tsx scripts/conversation-storage.test.ts`
- `pnpm test:creem`
- `pnpm ts-check`
- `pnpm build`

Expected:
- all pass

- [ ] **Step 2: Do a local smoke test**

Run: `pnpm dev`

Verify manually:

- anonymous user can start chat from `/`
- anonymous user is blocked on the 4th send attempt with login card
- logged-in unpaid user is blocked on the 8th send attempt with pricing card
- paid user still sees active subscription and no send limit
- homepage bottom shows pricing table

- [ ] **Step 3: Commit final integration**

```bash
git add src package.json scripts
git commit -m "feat: add paid chat access and homepage pricing"
```
