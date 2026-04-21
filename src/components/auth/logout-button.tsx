'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

type LogoutButtonProps = {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
};

export function LogoutButton({
  variant = 'outline',
  size = 'sm',
  className,
}: LogoutButtonProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    try {
      setIsSubmitting(true);
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
      router.replace('/login');
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={isSubmitting}
      onClick={handleLogout}
    >
      {isSubmitting ? '退出中...' : '退出登录'}
    </Button>
  );
}
