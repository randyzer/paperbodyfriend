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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 初始化
  useEffect(() => {
    const characterId = getSelectedCharacter();
    const history = getChatHistory();

    if (!characterId) {
      router.push('/');
      return;
    }

    setCharacter(CHARACTERS[characterId as keyof typeof CHARACTERS]);
    
    if (history.length > 0) {
      setMessages(history);
    } else {
      // 发送初始问候
      sendInitialGreeting();
    }
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 获取天气信息（模拟）
  const getWeatherInfo = () => {
    const weathers = [
      { type: '晴天', temp: '25°C', advice: '今天阳光很好，记得涂防晒霜哦' },
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
这是你们第一次对话，请根据以下信息，给她一个温暖的问候：
1. 当前时间：${hour < 12 ? '早上' : hour < 18 ? '下午' : '晚上'}，${hour}点
2. 天气情况：${weather.type}，${weather.temp}
3. 天气提醒：${weather.advice}
4. 用轻松自然的语气开启话题，展现你作为${character.name}的性格特点
5. 不要太长，2-3句话即可`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: '你好' }],
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
        
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.content = fullContent;
          }
          return newMessages;
        });
      }

      // 生成语音
      if (fullContent) {
        generateTTS(initialMessage.id, fullContent);
        saveChatHistory([{
          ...initialMessage,
          content: fullContent
        }]);
      }
    } catch (error) {
      console.error('Initial greeting error:', error);
      const hour = new Date().getHours();
      let greeting = hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
      
      const fallbackMessage: ChatMessage = {
        id: `msg_${Date.now()}_fallback`,
        role: 'assistant',
        content: `${greeting}！终于等到你了~ 今天过得怎么样？`,
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
  const generateSelfie = async () => {
    if (!character) return;

    try {
      const prompt = `一个${character.name}的帅气自拍照片，${character.id === 'uncle' ? '成熟稳重，深邃的眼神' : character.id === 'sunshine' ? '阳光灿烂的笑容' : '略带腼腆的表情'}，高清写真风格`;
      
      const response = await fetch('/api/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();
      
      if (data.imageUrls && data.imageUrls[0]) {
        const imageMessage: ChatMessage = {
          id: `msg_${Date.now()}_image`,
          role: 'assistant',
          content: character.id === 'uncle' ? '刚拍的照片，给你看看~' : character.id === 'sunshine' ? '嘿嘿，今天状态不错！' : '拍了张照片...你觉得怎么样？',
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
  const generateDance = async () => {
    if (!character) return;

    try {
      const prompt = `一个${character.name}正在跳舞，动作流畅自然，表情生动，背景简洁温馨`;
      
      const response = await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, duration: 5 }),
      });

      const data = await response.json();
      
      if (data.videoUrl) {
        const videoMessage: ChatMessage = {
          id: `msg_${Date.now()}_video`,
          role: 'assistant',
          content: character.id === 'uncle' ? '给你跳个舞，希望能让你开心' : character.id === 'sunshine' ? '看我给你跳个舞！🎵' : '虽然不太会跳舞...但还是想给你看看',
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
    saveChatHistory(newMessages);
    
    setInputText('');
    setIsLoading(true);

    try {
      // 构建消息历史
      const chatMessages = newMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatMessages,
          characterPrompt: character.prompt,
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
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;
        
        setMessages(prev => {
          const newMsgs = [...prev];
          const lastMsg = newMsgs[newMsgs.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.content = fullContent;
          }
          return newMsgs;
        });
      }

      // 生成语音
      if (fullContent) {
        generateTTS(assistantMessage.id, fullContent);
        
        setMessages(prev => {
          saveChatHistory(prev);
          return prev;
        });

        // AI主动发自拍或跳舞（约15%概率）
        const shouldSendMedia = Math.random() < 0.15;
        if (shouldSendMedia) {
          setTimeout(() => {
            // 80%概率发照片，20%概率发视频
            if (Math.random() < 0.8) {
              generateSelfie();
            } else {
              generateDance();
            }
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: '抱歉，我遇到一点问题，能再说一次吗？',
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
            <AvatarFallback className="bg-gradient-to-br from-pink-300 to-purple-400 text-xl">
              {character.id === 'uncle' && '👨'}
              {character.id === 'sunshine' && '👦'}
              {character.id === 'straight_man' && '🤓'}
            </AvatarFallback>
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
            ref={inputRef}
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
