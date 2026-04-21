'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type SessionUser = {
  id: string;
  email: string;
  displayName: string | null;
};

type SessionResponse =
  | {
      authenticated: true;
      user: SessionUser;
    }
  | {
      authenticated: false;
      user: null;
    };

type UseAuthSessionOptions = {
  required?: boolean;
  redirectUnauthenticatedTo?: string;
  redirectAuthenticatedTo?: string;
};

export function useAuthSession(options: UseAuthSessionOptions = {}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const response = await fetch('/api/auth/session', {
          cache: 'no-store',
        });
        const data = (await response.json()) as SessionResponse;

        if (!active) {
          return;
        }

        if (data.authenticated && options.redirectAuthenticatedTo) {
          router.replace(options.redirectAuthenticatedTo);
          return;
        }

        if (!data.authenticated && options.required) {
          router.replace(options.redirectUnauthenticatedTo ?? '/login');
          return;
        }

        setAuthenticated(data.authenticated);
        setUser(data.user);
      } catch {
        if (!active) {
          return;
        }

        if (options.required) {
          router.replace(options.redirectUnauthenticatedTo ?? '/login');
          return;
        }

        setAuthenticated(false);
        setUser(null);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, [
    options.redirectAuthenticatedTo,
    options.redirectUnauthenticatedTo,
    options.required,
    router,
  ]);

  return {
    isLoading,
    authenticated,
    user,
  };
}
