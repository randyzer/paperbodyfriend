'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Volume2, VolumeX, RefreshCw } from 'lucide-react';
import { CHARACTERS } from '@/lib/config';
import { 
  ChatMessage, 
  getSelectedCharacter, 
  getChatHistory, 
  saveChatHistory,
  clearAllData
} from '@/lib/storage';

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [character, setCharacter] = useState<typeof CHARACTERS.uncle | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioMap, setAudioMap] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);
  const [messageCount, setMessageCount] = useState(0); // 追踪对话轮数
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 初始化 - 获取角色和历史
  useEffect(() => {
    const characterId = getSelectedCharacter();
    
    if (!characterId) {
      router.push('/');
      return;
    }

    const char = CHARACTERS[characterId as keyof typeof CHARACTERS];
    setCharacter(char);
    
    const history = getChatHistory();
    if (history.length > 0) {
      setMessages(history);
      // 计算已有对话轮数（用户消息数）
      const userMsgCount = history.filter(m => m.role === 'user').length;
      setMessageCount(userMsgCount);
      setInitialized(true);
    } else {
      setInitialized(false);
    }
  }, []);

  // 发送初始问候 - 当character设置好且没有历史记录时
  useEffect(() => {
    if (character && !initialized && messages.length === 0) {
      sendInitialGreeting();
      setInitialized(true);
    }
  }, [character, initialized]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 获取天气信息（模拟）
  const getWeatherInfo = () => {
    const weathers = [
      { type: '晴天', temp: '25°C', advice: '今天阳光很好，记得涂防晒霜' },
      { type: '多云', temp: '22°C', advice: '今天天气凉爽，很适合出去走走' },
      { type: '阴天', temp: '20°C', advice: '今天天气有点阴沉，要注意保暖' },
      { type: '小雨', temp: '18°C', advice: '今天有小雨，出门记得带伞' },
    ];
    const index = Math.floor(Math.random() * weathers.length);
    return weathers[index];
  };

  // 发送初始问候
  const sendInitialGreeting = async () => {
    if (!character) return;

    setIsLoading(true);
    
    try {
      const weather = getWeatherInfo();
      const hour = new Date().getHours();
      
      let systemPrompt = character.prompt;
      
      systemPrompt += `

当前时间：${hour < 12 ? '早上' : hour < 18 ? '下午' : '晚上'}，天气：${weather.type}，${weather.temp}
${weather.advice}

这是你们第一次对话，请给她一个简短温暖的问候（1-2句话），自然地开启话题。不要太正式，像朋友一样打招呼。`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: '打招呼' }],
          characterPrompt: systemPrompt,
        }),
      });

      if (!response.ok) throw new Error('请求失败');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应');

      const initialMessage: ChatMessage = {
        id: `msg_${Date.now()}_welcome`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        type: 'text',
      };

      setMessages([initialMessage]);

      const decoder = new TextDecoder();
      let fullContent = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        
        // 解析媒体标记
        const { text, mediaType } = parseMediaMarker(fullContent);
        
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.content = text;
          }
          return newMessages;
        });
      }

      // 最终解析
      const { text: finalText, mediaType } = parseMediaMarker(fullContent);
      
      if (finalText) {
        generateTTS(initialMessage.id, finalText);
        saveChatHistory([{
          ...initialMessage,
          content: finalText
        }]);
      }
    } catch (error) {
      console.error('Initial greeting error:', error);
      const hour = new Date().getHours();
      let greeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
      
      const fallbackMessage: ChatMessage = {
        id: `msg_${Date.now()}_fallback`,
        role: 'assistant',
        content: `${greeting}，终于等到你了~`,
        timestamp: Date.now(),
        type: 'text',
      };

      setMessages([fallbackMessage]);
      saveChatHistory([fallbackMessage]);
      generateTTS(fallbackMessage.id, fallbackMessage.content);
    } finally {
      setIsLoading(false);
    }
  };

  // 解析媒体标记
  const parseMediaMarker = (content: string): { text: string; mediaType: 'selfie' | 'dance' | 'workout' | null } => {
    const mediaMatch = content.match(/\[MEDIA:(selfie|dance|workout)\]$/);
    if (mediaMatch) {
      return {
        text: content.replace(/\[MEDIA:(selfie|dance|workout)\]$/, '').trim(),
        mediaType: mediaMatch[1] as 'selfie' | 'dance' | 'workout'
      };
    }
    return { text: content, mediaType: null };
  };

  // 生成语音
  const generateTTS = async (messageId: string, text: string) => {
    if (!character) return;
    
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, characterId: character.id }),
      });

      const data = await response.json();
      if (data.audioUri) {
        setAudioMap(prev => ({ ...prev, [messageId]: data.audioUri }));
      }
    } catch (error) {
      console.error('TTS error:', error);
    }
  };

  // 播放语音
  const playAudio = (messageId: string) => {
    const audioUrl = audioMap[messageId];
    if (!audioUrl) return;

    if (audioRef.current) {
      audioRef.current.pause();
    }

    if (playingId === messageId) {
      setPlayingId(null);
      return;
    }

    audioRef.current = new Audio(audioUrl);
    audioRef.current.onended = () => setPlayingId(null);
    audioRef.current.play();
    setPlayingId(messageId);
  };

  // 生成AI自拍照片
  const generateSelfie = async (caption?: string) => {
    if (!character) return;

    type CharId = 'uncle' | 'sunshine' | 'straight_man';
    const charId = character.id as CharId;
    
    try {
      const prompts: Record<CharId, string> = {
        uncle: '一个成熟稳重的中年男性自拍照片，深邃的眼神，穿着休闲衬衫，高清写真风格，阳光背景',
        sunshine: '一个阳光帅气的年轻男性自拍照片，灿烂的笑容，穿着时尚，高清写真风格',
        straight_man: '一个斯文的年轻男性自拍照片，略带腼腆的表情，穿着简约，高清写真风格'
      };
      
      const response = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompts[charId] }),
      });

      const data = await response.json();
      
      if (data.imageUrls && data.imageUrls[0]) {
        const captionsByChar: Record<CharId, string[]> = {
          uncle: ['给你看看今天的我', '刚拍的', '嘿嘿'],
          sunshine: ['看看我今天帅不帅~', '给你发张自拍！', '嘿嘿，今天状态不错'],
          straight_man: ['拍了张照片', '额...给你看看', '这个角度还行吗']
        };
        
        const imageMessage: ChatMessage = {
          id: `msg_${Date.now()}_image`,
          role: 'assistant',
          content: caption || captionsByChar[charId][Math.floor(Math.random() * 3)],
          timestamp: Date.now(),
          type: 'image',
          mediaUrl: data.imageUrls[0],
        };
        
        setMessages(prev => {
          const newMessages = [...prev, imageMessage];
          saveChatHistory(newMessages);
          return newMessages;
        });
        
        generateTTS(imageMessage.id, imageMessage.content);
      }
    } catch (error) {
      console.error('Image generation error:', error);
    }
  };

  // 生成AI跳舞视频
  const generateDance = async (caption?: string) => {
    if (!character) return;

    type CharId = 'uncle' | 'sunshine' | 'straight_man';
    const charId = character.id as CharId;
    
    try {
      const prompts: Record<CharId, string> = {
        uncle: '一个成熟稳重的中年男性正在跳舞，动作优雅从容，表情自信',
        sunshine: '一个阳光帅气的年轻男性正在跳舞，动作充满活力，笑容灿烂',
        straight_man: '一个斯文的年轻男性正在跳舞，动作有点笨拙但很认真'
      };
      
      const response = await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompts[charId], duration: 5 }),
      });

      const data = await response.json();
      
      if (data.videoUrl) {
        const captionsByChar: Record<CharId, string[]> = {
          uncle: ['给你跳个舞', '献丑了', '希望你喜欢'],
          sunshine: ['看我给你跳个舞！', '嘿嘿，来一段！', '看我的！'],
          straight_man: ['不太会跳...但还是给你看', '跳得不好别笑话我', '试试看...']
        };
        
        const videoMessage: ChatMessage = {
          id: `msg_${Date.now()}_video`,
          role: 'assistant',
          content: caption || captionsByChar[charId][Math.floor(Math.random() * 3)],
          timestamp: Date.now(),
          type: 'video',
          mediaUrl: data.videoUrl,
        };
        
        setMessages(prev => {
          const newMessages = [...prev, videoMessage];
          saveChatHistory(newMessages);
          return newMessages;
        });
        
        generateTTS(videoMessage.id, videoMessage.content);
      }
    } catch (error) {
      console.error('Video generation error:', error);
    }
  };

  // 生成AI运动视频
  const generateWorkout = async (caption?: string) => {
    if (!character) return;

    type CharId = 'uncle' | 'sunshine' | 'straight_man';
    const charId = character.id as CharId;
    
    try {
      const prompts: Record<CharId, string> = {
        uncle: '一个成熟稳重的中年男性正在健身房运动，举哑铃，表情专注',
        sunshine: '一个阳光帅气的年轻男性正在健身房运动，充满活力，汗水和笑容',
        straight_man: '一个斯文的年轻男性正在健身房运动，动作认真，有点吃力'
      };
      
      const response = await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompts[charId], duration: 5 }),
      });

      const data = await response.json();
      
      if (data.videoUrl) {
        const captionsByChar: Record<CharId, string[]> = {
          uncle: ['刚健完身，给你看看', '今天的运动打卡', '运动完精神好多了'],
          sunshine: ['看我健身！', '今天练得很爽！', '流汗的感觉真棒~'],
          straight_man: ['刚在健身房...', '运动视频...有点尴尬', '练了一会儿']
        };
        
        const videoMessage: ChatMessage = {
          id: `msg_${Date.now()}_workout`,
          role: 'assistant',
          content: caption || captionsByChar[charId][Math.floor(Math.random() * 3)],
          timestamp: Date.now(),
          type: 'video',
          mediaUrl: data.videoUrl,
        };
        
        setMessages(prev => {
          const newMessages = [...prev, videoMessage];
          saveChatHistory(newMessages);
          return newMessages;
        });
        
        generateTTS(videoMessage.id, videoMessage.content);
      }
    } catch (error) {
      console.error('Workout video generation error:', error);
    }
  };

  // 发送消息
  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading || !character) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: inputText.trim(),
      timestamp: Date.now(),
      type: 'text',
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    
    setInputText('');
    setIsLoading(true);

    // 更新对话轮数
    const newCount = messageCount + 1;
    setMessageCount(newCount);

    try {
      // 构建消息历史（只取最近10条）
      const recentMessages = newMessages.slice(-10);
      const chatMessages = recentMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatMessages,
          characterPrompt: character.prompt,
          messageCount: newCount,
        }),
      });

      if (!response.ok) throw new Error('请求失败');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应');

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        type: 'text',
      };

      setMessages(prev => [...prev, assistantMessage]);

      const decoder = new TextDecoder();
      let fullContent = '';
      let mediaType: 'selfie' | 'dance' | 'workout' | null = null;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        
        // 实时解析
        const parsed = parseMediaMarker(fullContent);
        
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.content = parsed.text;
          }
          return newMsgs;
        });
        
        if (parsed.mediaType) {
          mediaType = parsed.mediaType;
        }
      }

      // 最终解析
      const { text: finalText, mediaType: finalMediaType } = parseMediaMarker(fullContent);
      const actualMediaType = finalMediaType || mediaType;
      
      if (finalText) {
        generateTTS(assistantMessage.id, finalText);
        
        setMessages(prev => {
          saveChatHistory(prev);
          return prev;
        });

        // 根据媒体类型生成内容
        if (actualMediaType) {
          setTimeout(() => {
            if (actualMediaType === 'selfie') {
              generateSelfie();
            } else if (actualMediaType === 'dance') {
              generateDance();
            } else if (actualMediaType === 'workout') {
              generateWorkout();
            }
          }, 1500);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: '抱歉，能再说一次吗？',
        timestamp: Date.now(),
        type: 'text',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // 重置
  const handleReset = () => {
    if (confirm('确定要重新选择角色吗？聊天记录将被清空。')) {
      clearAllData();
      router.push('/');
    }
  };

  if (!character) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>加载中...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* 顶部栏 */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <img 
              src={character.avatar} 
              alt={character.name}
              className="w-full h-full object-cover rounded-full"
            />
          </Avatar>
          <div>
            <h1 className="font-semibold text-gray-800">{character.name}</h1>
            <Badge variant="outline" className="text-xs text-green-600 border-green-200">
              在线
            </Badge>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleReset}
          title="重新选择角色"
        >
          <RefreshCw className="w-5 h-5" />
        </Button>
      </div>

      {/* 消息区域 */}
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] ${
                  msg.role === 'user'
                    ? 'bg-pink-500 text-white'
                    : 'bg-white text-gray-800 shadow-sm'
                } rounded-2xl px-4 py-2`}
              >
                {/* 文字内容 */}
                <p className="whitespace-pre-wrap">{msg.content}</p>
                
                {/* 图片 */}
                {msg.type === 'image' && msg.mediaUrl && (
                  <div className="mt-2">
                    <img
                      src={msg.mediaUrl}
                      alt="AI男友自拍"
                      className="rounded-lg max-w-full cursor-pointer"
                      onClick={() => window.open(msg.mediaUrl, '_blank')}
                    />
                  </div>
                )}
                
                {/* 视频 */}
                {msg.type === 'video' && msg.mediaUrl && (
                  <div className="mt-2">
                    <video
                      src={msg.mediaUrl}
                      controls
                      className="rounded-lg max-w-full"
                    />
                  </div>
                )}
                
                {/* 底部：时间 + 语音按钮 */}
                <div className={`flex items-center justify-between mt-1 ${
                  msg.role === 'user' ? 'text-pink-100' : 'text-gray-400'
                }`}>
                  <span className="text-xs">
                    {new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  
                  {/* AI消息显示语音按钮 */}
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => playAudio(msg.id)}
                      className="ml-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
                      title={playingId === msg.id ? '停止播放' : '播放语音'}
                    >
                      {playingId === msg.id ? (
                        <VolumeX className="w-4 h-4 text-pink-500" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-gray-400 hover:text-pink-500" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl px-4 py-2 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* 输入区域 */}
      <div className="bg-white border-t px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <Input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="发送消息..."
            disabled={isLoading}
            className="flex-1"
          />
          
          <Button 
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isLoading}
            className="bg-pink-500 hover:bg-pink-600 shrink-0"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
