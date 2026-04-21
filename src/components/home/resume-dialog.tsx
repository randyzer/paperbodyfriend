'use client';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

type ResumeDialogProps = {
  open: boolean;
  characterName: string;
  lastMessagePreview?: string | null;
  onContinue: () => void;
  onReselect: () => void;
  loading?: boolean;
};

export function ResumeDialog({
  open,
  characterName,
  lastMessagePreview,
  onContinue,
  onReselect,
  loading = false,
}: ResumeDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={() => undefined}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>要继续上一次的对话吗？</AlertDialogTitle>
          <AlertDialogDescription>
            检测到你和 {characterName} 还有一段最近的聊天记录。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-xl bg-pink-50 p-4 text-sm text-gray-600">
          <p className="mb-2 font-medium text-gray-800">上次对话片段</p>
          <p className="line-clamp-3">
            {lastMessagePreview?.trim() || '上次对话已保存，可以继续聊下去。'}
          </p>
        </div>

        <AlertDialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={onReselect}
            disabled={loading}
          >
            重新选择角色
          </Button>
          <Button
            type="button"
            className="bg-pink-500 hover:bg-pink-600"
            onClick={onContinue}
            disabled={loading}
          >
            {loading ? '正在进入...' : '继续上一次对话'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
