'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { USER_INFO_FIELDS, CHARACTERS, STORAGE_KEYS } from '@/lib/config';
import { saveUserInfo, getSelectedCharacter } from '@/lib/storage';

export default function OnboardingPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const selectedCharacterId = getSelectedCharacter();
  const character = selectedCharacterId ? CHARACTERS[selectedCharacterId as keyof typeof CHARACTERS] : null;

  const handleInputChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // 保存用户信息
    saveUserInfo(formData as any);

    // 跳转到对话页面
    router.push('/chat');
  };

  if (!character) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-pink-50 to-purple-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-gray-600">请先选择角色</p>
            <Button onClick={() => router.push('/')} className="mt-4">
              返回选择
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-purple-50 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* 标题 */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-pink-300 to-purple-400 flex items-center justify-center text-3xl">
            {character.id === 'uncle' && '👨'}
            {character.id === 'sunshine' && '👦'}
            {character.id === 'straight_man' && '🤓'}
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            你的 {character.name}
          </h1>
          <p className="text-gray-600">
            为了更好地了解你，请填写以下信息
          </p>
        </div>

        {/* 表单 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">个人信息</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {USER_INFO_FIELDS.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  
                  {field.type === 'select' ? (
                    <Select
                      value={formData[field.key] || ''}
                      onValueChange={(value) => handleInputChange(field.key, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`请选择${field.label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={field.key}
                      type={field.type === 'number' ? 'number' : 'text'}
                      placeholder={field.placeholder}
                      value={formData[field.key] || ''}
                      onChange={(e) => handleInputChange(field.key, e.target.value)}
                    />
                  )}
                </div>
              ))}

              {/* 提交按钮 */}
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-pink-500 hover:bg-pink-600 text-white py-6 text-lg"
                >
                  {isLoading ? '保存中...' : '开始聊天'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* 跳过按钮 */}
        <div className="text-center mt-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/chat')}
            className="text-gray-500"
          >
            跳过填写，直接聊天
          </Button>
        </div>
      </div>
    </div>
  );
}
