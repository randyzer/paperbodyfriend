# Daily Love Letter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable daily love-letter email flow that generates role-specific AI copy based on the user's latest active conversation character and sends it through Resend.

**Architecture:** Keep email delivery in `src/lib/email.ts`, but make it dependency-injectable so tests can cover welcome and daily emails without real network calls. Generate the love letter through a dedicated AI service and resolve the current character from the existing conversations table instead of adding new schema.

**Tech Stack:** Next.js 16, TypeScript, Resend, existing AI text provider, Drizzle conversation repository.

---

### Task 1: Add failing tests for reusable email service behavior

**Files:**
- Create: `scripts/daily-love-letter.test.ts`
- Modify: `src/lib/email.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';

async function main() {
  const { createEmailService } = await import('../src/lib/email');

  const sent: Array<{ to: string; subject: string; html: string }> = [];
  const service = createEmailService({
    getFromEmail: () => '纸片人男友 <hello@example.com>',
    getAppBaseUrl: () => 'https://paperboyfriend.example.com',
    async sendEmail(input) {
      sent.push({
        to: String(input.to),
        subject: input.subject,
        html: String(input.html),
      });
    },
    async findLatestCharacterId() {
      return 'sunshine';
    },
    async generateLoveLetter() {
      return '今天也想抱抱你。';
    },
  });

  await service.sendWelcomeEmail('user@example.com', 'Randy');
  await service.sendDailyLoveLetter({
    userId: 'user_1',
    userEmail: 'user@example.com',
    userName: 'Randy',
  });

  assert.equal(sent[0]?.to, 'user@example.com');
  assert.match(sent[1]?.subject ?? '', /早安 Randy/);
  assert.match(sent[1]?.html ?? '', /今天也想抱抱你/);
  assert.match(sent[1]?.html ?? '', /paperboyfriend\\.example\\.com/);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx scripts/daily-love-letter.test.ts`
Expected: FAIL because `createEmailService` or `sendDailyLoveLetter` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Add a dependency-injectable `createEmailService` in `src/lib/email.ts` and keep exported wrappers for `sendWelcomeEmail` and `sendDailyLoveLetter`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx scripts/daily-love-letter.test.ts`
Expected: PASS

### Task 2: Add role-aware AI love-letter generation

**Files:**
- Create: `src/lib/ai/services/love-letter-service.ts`
- Modify: `src/lib/config.ts`

- [ ] **Step 1: Write the failing test**

Extend `scripts/daily-love-letter.test.ts` with one case that injects `findLatestCharacterId` returning `uncle` and asserts the service passes `characterId` into the generator dependency.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx scripts/daily-love-letter.test.ts`
Expected: FAIL because the generator dependency is not called with role context yet.

- [ ] **Step 3: Write minimal implementation**

Create `generateLoveLetter({ userName, characterId })` that uses the existing text provider to generate a short, role-specific morning message with three style branches:
- `uncle`: mature, steady, gentle
- `sunshine`: bright, playful, energetic
- `straight_man`: sincere, slightly awkward, grounded

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx scripts/daily-love-letter.test.ts`
Expected: PASS

### Task 3: Wire environment variables and default dependencies

**Files:**
- Modify: `src/lib/email.ts`
- Modify: `src/server/env.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write the failing test**

Add a case in `scripts/daily-love-letter.test.ts` that asserts the daily email HTML contains the configured app URL and that welcome email still targets the requested recipient instead of a hard-coded address.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx scripts/daily-love-letter.test.ts`
Expected: FAIL if `APP_BASE_URL` / recipient handling is still hard-coded.

- [ ] **Step 3: Write minimal implementation**

Add `APP_BASE_URL` to server env handling and `.env.example`, then make the daily email footer link use that value. Also remove any hard-coded welcome email recipient.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx scripts/daily-love-letter.test.ts`
Expected: PASS

### Task 4: Run project verification

**Files:**
- Modify: `package.json` (only if a dedicated test script adds value)

- [ ] **Step 1: Run focused tests**

Run: `node --import tsx scripts/daily-love-letter.test.ts`
Expected: PASS

- [ ] **Step 2: Run auth regression**

Run: `pnpm test:auth`
Expected: PASS

- [ ] **Step 3: Run type check and build**

Run:
```bash
pnpm ts-check
pnpm build
```

Expected: both PASS
