'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CHARACTERS, STORAGE_KEYS } from '@/lib/config';
import { getSelectedCharacter, getUserInfo, getChatHistory } from '@/lib/storage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function HomePage() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 检查是否已有选择
  useEffect(() => {
    const character = getSelectedCharacter();
    const userInfo = getUserInfo();
    const chatHistory = getChatHistory();

    if (character && userInfo) {
      // 如果已有完整信息，直接跳转到对话页面
      router.push('/chat');
    } else if (character) {
      // 如果已有角色选择，跳转到信息填写页面
      router.push('/onboarding');
    }
  }, [router]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
  };

  const handleConfirm = async () => {
    if (!selectedId) return;
    
    setIsLoading(true);
    
    // 保存选择的角色
    localStorage.setItem(STORAGE_KEYS.SELECTED_CHARACTER, selectedId);
    
    // 跳转到信息填写页面
    router.push('/onboarding');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 标题 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            🤖 AI 虚拟男友
          </h1>
          <p className="text-gray-600 text-lg">
            找一个懂你、疼你、呵护你的另一半
          </p>
        </div>

        {/* 角色选择说明 */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
            选择你喜欢的类型
          </h2>
          <p className="text-gray-500 text-center text-sm">
            选中你心仪的AI男友，开始你们的缘分
          </p>
        </div>

        {/* 角色卡片 */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {Object.values(CHARACTERS).map((character) => (
            <Card 
              key={character.id}
              className={`cursor-pointer transition-all duration-300 hover:shadow-xl ${
                selectedId === character.id 
                  ? 'ring-4 ring-pink-400 shadow-lg scale-105' 
                  : 'hover:scale-102'
              }`}
              onClick={() => handleSelect(character.id)}
            >
              <CardContent className="p-6">
                {/* 角色头像占位 */}
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-pink-300 to-purple-400 flex items-center justify-center text-4xl">
                  {character.id === 'uncle' && '👨'}
                  {character.id === 'sunshine' && '👦'}
                  {character.id === 'straight_man' && '🤓'}
                </div>
                
                <h3 className="text-xl font-bold text-center text-gray-800 mb-2">
                  {character.name}
                </h3>
                <p className="text-gray-600 text-sm text-center mb-4">
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

        {/* 确认按钮 */}
        <div className="text-center">
          <Button
            size="lg"
            disabled={!selectedId || isLoading}
            onClick={handleConfirm}
            className="bg-pink-500 hover:bg-pink-600 text-white px-12 py-6 text-lg rounded-full"
          >
            {isLoading ? '正在进入...' : '确认选择'}
          </Button>
        </div>

        {/* 底部说明 */}
        <div className="mt-12 text-center text-gray-400 text-sm">
          <p>未成年人请勿使用本产品</p>
          <p className="mt-1">本产品仅供娱乐休闲，请勿当真</p>
        </div>
      </div>
    </div>
  );
}
