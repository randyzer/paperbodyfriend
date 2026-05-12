'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { UserAccountMenu } from '@/components/auth/user-account-menu';
import { PricingTable } from '@/components/home/pricing-table';
import { ResumeDialog } from '@/components/home/resume-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthSession } from '@/hooks/use-auth-session';
import { CHARACTERS } from '@/lib/config';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import {
  getTierBadgeClassName,
  getTierDescription,
  getTierLabel,
  resolveAccessTier,
  type BillingStatusSnapshot,
} from '@/lib/paid-access';
import {
  clearAnonymousConversationState,
  clearResumeSkipForUser,
  clearConversationStateForUser,
  getChatHistoryForUser,
  getConversationIdForUser,
  getSelectedCharacterForUser,
  markResumeSkipForUser,
  migrateLegacyStorageToUser,
  saveAnonymousChatHistory,
  saveAnonymousConversationId,
  saveAnonymousSelectedCharacter,
  saveChatHistoryForUser,
  saveConversationIdForUser,
  saveSelectedCharacterForUser,
  shouldSkipResumeForUser,
  type ChatMessage,
} from '@/lib/storage';

type ResumeCandidate = {
  source: 'local' | 'database';
  conversationId: string;
  characterId: string;
  characterName: string;
  lastMessagePreview: string | null;
};

type ResumeCandidateResponse = {
  hasResumeCandidate: boolean;
  source: 'database' | null;
  conversationId?: string;
  characterId?: string;
  lastMessagePreview?: string | null;
};

type ConversationDetailResponse = {
  conversation: {
    id: string;
    characterId: string;
  };
  messages: ChatMessage[];
};

type BillingStatusResponse = {
  active: boolean;
  currentPeriodEnd: string | null;
};

function getCharacterById(characterId: string) {
  return CHARACTERS[characterId as keyof typeof CHARACTERS] ?? null;
}

function createAnonymousConversationId() {
  return `anon_${crypto.randomUUID()}`;
}

export default function HomePage() {
  const router = useRouter();
  const { isLoading: sessionLoading, authenticated, user } = useAuthSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resumeCandidate, setResumeCandidate] = useState<ResumeCandidate | null>(null);
  const [isCheckingResume, setIsCheckingResume] = useState(true);
  const [resumeDecisionLoading, setResumeDecisionLoading] = useState(false);
  const [billingStatus, setBillingStatus] = useState<BillingStatusSnapshot | null>(null);

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    if (!authenticated || !user) {
      setResumeCandidate(null);
      setIsCheckingResume(false);
      return;
    }

    const currentUser = user;
    let active = true;

    async function loadResumeCandidate() {
      setIsCheckingResume(true);
      migrateLegacyStorageToUser(currentUser.id);

      if (shouldSkipResumeForUser(currentUser.id)) {
        setResumeCandidate(null);
        setIsCheckingResume(false);
        return;
      }

      const localCharacterId = getSelectedCharacterForUser(currentUser.id);
      const localConversationId = getConversationIdForUser(currentUser.id);
      const localHistory = getChatHistoryForUser(currentUser.id);
      const localCharacter = localCharacterId
        ? getCharacterById(localCharacterId)
        : null;

      if (
        active &&
        localCharacter &&
        localConversationId &&
        localHistory.length > 0
      ) {
        setResumeCandidate({
          source: 'local',
          conversationId: localConversationId,
          characterId: localCharacter.id,
          characterName: localCharacter.name,
          lastMessagePreview:
            localHistory[localHistory.length - 1]?.content ?? null,
        });
        setIsCheckingResume(false);
        return;
      }

      try {
        const response = await fetchWithTimeout('/api/conversations/resume-candidate', {
          cache: 'no-store',
          timeoutMs: 5_000,
        });

        if (!response.ok) {
          throw new Error('Failed to load resume candidate');
        }

        const data = (await response.json()) as ResumeCandidateResponse;
        const databaseCharacter =
          data.characterId ? getCharacterById(data.characterId) : null;

        if (
          active &&
          data.hasResumeCandidate &&
          data.source === 'database' &&
          data.conversationId &&
          data.characterId &&
          databaseCharacter
        ) {
          setResumeCandidate({
            source: 'database',
            conversationId: data.conversationId,
            characterId: data.characterId,
            characterName: databaseCharacter.name,
            lastMessagePreview: data.lastMessagePreview ?? null,
          });
          return;
        }

        if (active) {
          setResumeCandidate(null);
        }
      } catch {
        if (active) {
          setResumeCandidate(null);
        }
      } finally {
        if (active) {
          setIsCheckingResume(false);
        }
      }
    }

    void loadResumeCandidate();

    return () => {
      active = false;
    };
  }, [authenticated, sessionLoading, user]);

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    if (!authenticated || !user) {
      setBillingStatus(null);
      return;
    }

    let active = true;

    async function loadBillingStatus() {
      try {
        const response = await fetchWithTimeout('/api/billing/status', {
          cache: 'no-store',
          timeoutMs: 5_000,
        });

        if (!response.ok) {
          throw new Error('Failed to load billing status');
        }

        const data = (await response.json()) as BillingStatusResponse;
        if (!active) {
          return;
        }

        setBillingStatus({
          active: data.active,
          currentPeriodEnd: data.currentPeriodEnd,
        });
      } catch {
        if (active) {
          setBillingStatus({
            active: false,
            currentPeriodEnd: null,
          });
        }
      }
    }

    void loadBillingStatus();

    return () => {
      active = false;
    };
  }, [authenticated, sessionLoading, user]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setActionError(null);
  };

  const handleConfirm = async () => {
    if (!selectedId) return;

    setIsLoading(true);
    setActionError(null);

    try {
      if (!user) {
        const anonymousConversationId = createAnonymousConversationId();

        clearAnonymousConversationState();
        saveAnonymousSelectedCharacter(selectedId);
        saveAnonymousConversationId(anonymousConversationId);
        saveAnonymousChatHistory([]);
        router.push('/chat');
        return;
      }

      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: selectedId }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? 'Failed to create conversation');
      }

      const data = (await response.json()) as {
        conversationId: string;
        characterId: string;
      };

      clearResumeSkipForUser(user.id);
      clearConversationStateForUser(user.id);
      saveSelectedCharacterForUser(user.id, data.characterId);
      saveConversationIdForUser(user.id, data.conversationId);
      saveChatHistoryForUser(user.id, []);
      router.push('/chat');
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message === 'Conversation service unavailable'
            ? '对话服务还没有准备好，请先完成数据库表初始化。'
            : '进入对话失败，请稍后重试。'
          : '进入对话失败，请稍后重试。',
      );
      setIsLoading(false);
    }
  };

  const handleContinueResume = async () => {
    if (!resumeCandidate || !user) return;

    if (resumeCandidate.source === 'local') {
      setResumeDecisionLoading(true);
      clearResumeSkipForUser(user.id);
      saveSelectedCharacterForUser(user.id, resumeCandidate.characterId);
      saveConversationIdForUser(user.id, resumeCandidate.conversationId);
      router.push('/chat');
      return;
    }

    setResumeDecisionLoading(true);

    try {
      const response = await fetch(
        `/api/conversations/${resumeCandidate.conversationId}`,
        { cache: 'no-store' },
      );

      if (!response.ok) {
        throw new Error('Failed to load conversation detail');
      }

      const detail = (await response.json()) as ConversationDetailResponse;

      clearResumeSkipForUser(user.id);
      saveSelectedCharacterForUser(user.id, detail.conversation.characterId);
      saveConversationIdForUser(user.id, detail.conversation.id);
      saveChatHistoryForUser(user.id, detail.messages);

      router.push('/chat');
    } catch {
      setResumeCandidate(null);
      setResumeDecisionLoading(false);
    }
  };

  const handleReselect = () => {
    if (!user) return;

    markResumeSkipForUser(user.id);
    clearConversationStateForUser(user.id);
    setResumeCandidate(null);
    setResumeDecisionLoading(false);
  };

  if (sessionLoading || (authenticated && isCheckingResume)) {
    const loadingMessage =
      sessionLoading
        ? '正在检查登录状态...'
        : '正在加载历史对话...';

    return (
      <div className="flex h-full min-h-full items-center justify-center bg-pink-50">
        <p className="text-sm text-gray-500">{loadingMessage}</p>
      </div>
    );
  }

  const currentTier = resolveAccessTier({
    authenticated,
    billingStatus,
  });

  return (
    <div id="top" className="h-full min-h-full bg-gradient-to-b from-pink-50 to-purple-50">
      <ResumeDialog
        open={Boolean(resumeCandidate)}
        characterName={resumeCandidate?.characterName ?? ''}
        lastMessagePreview={resumeCandidate?.lastMessagePreview}
        onContinue={() => {
          void handleContinueResume();
        }}
        onReselect={handleReselect}
        loading={resumeDecisionLoading}
      />

      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-4 flex justify-end">
          {user ? (
            <UserAccountMenu
              displayName={user.displayName}
              email={user.email}
              avatarUrl={user.avatarUrl}
            />
          ) : null}
        </div>

        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-800">AI 虚拟男友</h1>
          <p className="text-lg text-gray-600">找一个懂你、疼你、呵护你的另一半</p>
        </div>

        <div className="mb-8 rounded-3xl border border-pink-100 bg-white/90 p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className={getTierBadgeClassName(currentTier)}>
                  {getTierLabel(currentTier)}
                </Badge>
                {authenticated && currentTier === 'free' ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/pricing">升级会员</Link>
                  </Button>
                ) : null}
                {authenticated && currentTier === 'paid' ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href="/pricing">查看订阅</Link>
                  </Button>
                ) : null}
              </div>
              <p className="text-sm text-gray-600">{getTierDescription(currentTier)}</p>
            </div>

            {!authenticated ? (
              <div className="flex flex-wrap gap-2">
                <Button asChild className="bg-pink-500 hover:bg-pink-600">
                  <Link href="/register">注册后继续</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/login">已有账号，去登录</Link>
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mb-8 rounded-2xl bg-white p-6 shadow-lg">
          <h2 className="mb-4 text-center text-xl font-semibold text-gray-800">
            选择你喜欢的类型
          </h2>
          <p className="text-center text-sm text-gray-500">
            选中你心仪的AI男友，开始你们的缘分
          </p>
        </div>

        <div className="mb-8 grid gap-6 md:grid-cols-3">
          {Object.values(CHARACTERS).map((character) => (
            <Card
              key={character.id}
              className={`cursor-pointer transition-all duration-300 hover:shadow-xl ${
                selectedId === character.id
                  ? 'scale-105 ring-4 ring-pink-400 shadow-lg'
                  : 'hover:scale-102'
              }`}
              onClick={() => handleSelect(character.id)}
            >
              <CardContent className="p-6">
                <div className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full ring-4 ring-pink-100">
                  <img
                    src={character.avatar}
                    alt={character.name}
                    className="h-full w-full object-cover"
                  />
                </div>

                <h3 className="mb-1 text-center text-xl font-bold text-gray-800">
                  {character.name}
                </h3>
                <p className="mb-2 text-center text-sm text-pink-500">
                  {character.title}
                </p>
                <p className="mb-4 text-center text-sm text-gray-600">
                  {character.description}
                </p>

                {selectedId === character.id && (
                  <Badge className="w-full justify-center bg-pink-500">
                    ✓ 已选择
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          {actionError ? (
            <p className="mb-4 text-sm text-red-500" role="alert">
              {actionError}
            </p>
          ) : null}
          <Button
            size="lg"
            disabled={!selectedId || isLoading}
            onClick={() => {
              void handleConfirm();
            }}
            className="rounded-full bg-pink-500 px-12 py-6 text-lg text-white hover:bg-pink-600"
          >
            {isLoading ? '正在进入...' : '确认选择'}
          </Button>
        </div>

        <div className="mt-12">
          <PricingTable currentTier={currentTier} />
        </div>

        <div className="mt-12 text-center text-sm text-gray-400">
          <p>未成年人请勿使用本产品</p>
          <p className="mt-1">本产品仅供娱乐休闲，请勿当真</p>
        </div>
      </div>
    </div>
  );
}
