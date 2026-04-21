'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImageUp, LogOut } from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  getSessionUserAvatarInitial,
  getSessionUserLabel,
} from '@/lib/session-user';
import { cn } from '@/lib/utils';

type UserAccountMenuProps = {
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  compact?: boolean;
  className?: string;
};

export function UserAccountMenu({
  displayName,
  email,
  avatarUrl,
  compact = false,
  className,
}: UserAccountMenuProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [localAvatarUrl, setLocalAvatarUrl] = useState(avatarUrl);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const user = { displayName, email };
  const label = getSessionUserLabel(user);

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

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      setIsUploadingAvatar(true);

      const formData = new FormData();
      formData.set('file', file);

      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as
        | { user?: { avatarUrl: string | null }; error?: string }
        | null;

      if (!response.ok || !payload?.user) {
        throw new Error(payload?.error ?? '头像上传失败，请稍后重试。');
      }

      setLocalAvatarUrl(payload.user.avatarUrl);
      toast.success('头像已更新');
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '头像上传失败，请稍后重试。',
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={event => {
          void handleAvatarChange(event);
        }}
      />

      <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'rounded-full p-0 hover:bg-pink-50',
            compact ? 'size-9' : 'size-10',
            className,
          )}
          aria-label="打开账号菜单"
        >
          <Avatar className={compact ? 'size-9' : 'size-10'}>
            {localAvatarUrl ? <AvatarImage src={localAvatarUrl} alt={label} /> : null}
            <AvatarFallback className="bg-pink-100 text-sm font-semibold text-pink-600">
              {getSessionUserAvatarInitial(user)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold text-gray-900">{label}</p>
          <p className="mt-1 truncate text-xs text-gray-500">{email}</p>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={isUploadingAvatar}
          onSelect={event => {
            event.preventDefault();
            fileInputRef.current?.click();
          }}
          className="rounded-xl px-3 py-2 text-sm"
        >
          <ImageUp className="size-4" />
          {isUploadingAvatar ? '上传中...' : '更换头像'}
        </DropdownMenuItem>

        <DropdownMenuItem
          variant="destructive"
          disabled={isSubmitting}
          onSelect={event => {
            event.preventDefault();
            void handleLogout();
          }}
          className="rounded-xl px-3 py-2 text-sm"
        >
          <LogOut className="size-4" />
          {isSubmitting ? '退出中...' : '退出登录'}
        </DropdownMenuItem>
      </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
