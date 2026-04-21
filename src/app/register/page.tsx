'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthSession } from '@/hooks/use-auth-session';

export default function RegisterPage() {
  const router = useRouter();
  const { isLoading } = useAuthSession({
    redirectAuthenticatedTo: '/',
  });
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName,
          email,
          password,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? '注册失败，请稍后重试。');
        return;
      }

      router.replace('/');
      router.refresh();
    } catch {
      setError('注册失败，请稍后重试。');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pink-50">
        <p className="text-sm text-gray-500">正在检查登录状态...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-purple-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-xl border-pink-100">
        <CardHeader>
          <CardTitle className="text-2xl text-center text-gray-800">
            注册账号
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="displayName">昵称</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={event => setDisplayName(event.target.value)}
                placeholder="给自己起个昵称"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="至少 8 位"
                minLength={8}
                required
              />
            </div>

            {error ? (
              <p className="text-sm text-red-500" role="alert">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              className="w-full bg-pink-500 hover:bg-pink-600"
              disabled={isSubmitting}
            >
              {isSubmitting ? '注册中...' : '注册并进入'}
            </Button>
          </form>

          <p className="mt-4 text-sm text-center text-gray-500">
            已经有账号？{' '}
            <Link className="text-pink-500 hover:text-pink-600" href="/login">
              去登录
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
