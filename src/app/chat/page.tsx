'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Mic, 
  MicOff, 
  PhoneOff, 
  Image as ImageIcon, 
  Video, 
  Share2, 
  Download,
  Send,
  MoreVertical,
  RefreshCw
} from 'lucide-react';
import { CHARACTERS } from '@/lib/config';
import { 
  ChatMessage, 
  getSelectedCharacter, 
  getUserInfo, 
  getChatHistory, 
  saveChatHistory,
  exportChatHistory,
  clearAllData
} from '@/lib/storage';

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [character, setCharacter] = useState<typeof CHARACTERS.uncle | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 初始化
  useEffect(() => {
    const characterId = getSelectedCharacter();
    const info = getUserInfo();
    const history = getChatHistory();

    if (!characterId) {
      router.push('/');
      return;
    }

    setCharacter(CHARACTERS[characterId as keyof typeof CHARACTERS]);
    setUserInfo(info);
    
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
      { type: '大雨', temp: '16°C', advice: '今天雨很大，尽量少出门，注意安全' },
    ];
    // 根据城市和时间模拟不同的天气
    const index = (userInfo?.city?.length || 0) % weathers.length;
    return weathers[index];
  };

  // 发送初始问候 - 调用LLM生成个性化问候
  const sendInitialGreeting = async () => {
    if (!character) return;

    setIsLoading(true);
    
    try {
      const weather = getWeatherInfo();
      const now = new Date();
      const hour = now.getHours();
      
      // 构建系统提示，包含天气和用户信息
      let systemPrompt = character.prompt;
      
      // 添加用户背景信息
      if (userInfo) {
        const userContext = `
用户基本信息：
- 年龄：${userInfo.age || '未知'}
- 城市：${userInfo.city || '未知'}
- 工作：${userInfo.job || '未知'}
- 性格：${userInfo.personality || '未知'}
- 吃饭口味：${userInfo.foodPreference || '未知'}
- 运动类型：${userInfo.sports || '未知'}
- 兴趣爱好：${userInfo.hobbies || '未知'}
- 睡眠时间：${userInfo.sleepTime || '未知'}

这是你们第一次对话，请根据以上信息，给她一个温暖的问候。记得：
1. 称呼她的名字或昵称（如果有）
2. 提到她所在城市的天气情况：${weather.type}，${weather.temp}
3. 根据天气给出贴心的提醒：${weather.advice}
4. 根据她的兴趣爱好或工作，提出一个相关的话题
5. 展现出你作为${character.name}的性格特点
6. 用轻松自然的语气，不要太正式

请生成一段温暖、个性化的开场白，让她感受到你的关心和理解。`;
        systemPrompt += userContext;
      } else {
        // 如果没有用户信息
        systemPrompt += `
这是你们第一次对话，请给她一个温暖的问候。记得：
1. 用${hour < 12 ? '早上' : hour < 18 ? '下午' : '晚上'}好的方式问候
2. 天气是${weather.type}，${weather.temp}
3. 根据天气给出贴心的提醒：${weather.advice}
4. 用轻松自然的语气开启话题

请生成一段温暖的开场白。`;
      }

      // 调用API生成个性化问候
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: '你好，我是第一次来' }],
          characterPrompt: systemPrompt,
          userInfo,
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
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.content += chunk;
          }
          saveChatHistory(newMessages);
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Initial greeting error:', error);
      // 如果API调用失败，使用备用问候
      const hour = new Date().getHours();
      let greeting = '';
      if (hour < 12) greeting = '早上好';
      else if (hour < 18) greeting = '下午好';
      else greeting = '晚上好';

      const fallbackMessage: ChatMessage = {
        id: `msg_${Date.now()}_fallback`,
        role: 'assistant',
        content: `${greeting}！终于等到你了~ 今天过得怎么样？我很想你呢。有什么想聊的，或者遇到什么开心的事、烦心的事，都可以告诉我，我会一直在这里陪着你。`,
        timestamp: Date.now(),
        type: 'text',
      };

      setMessages([fallbackMessage]);
      saveChatHistory([fallbackMessage]);
    } finally {
      setIsLoading(false);
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

    setMessages(prev => {
      const newMessages = [...prev, userMessage];
      saveChatHistory(newMessages);
      return newMessages;
    });
    
    setInputText('');
    setIsLoading(true);

    try {
      // 构建消息历史
      const chatMessages = messages.concat(userMessage).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // 调用API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatMessages,
          characterPrompt: character.prompt,
          userInfo,
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
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.role === 'assistant') {
            lastMsg.content += chunk;
          }
          saveChatHistory(newMessages);
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: '抱歉，我遇到了一点问题，请稍后重试。',
        timestamp: Date.now(),
        type: 'text',
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // 生成AI男友自拍
  const handleGenerateImage = async () => {
    if (!character) return;
    
    setIsLoading(true);
    
    try {
      const prompt = `一个${character.name}的帅气的自拍照片，${character.id === 'uncle' ? '成熟稳重，深邃的眼神' : character.id === 'sunshine' ? '阳光灿烂的笑容' : '略带腼腆的表情'}，高清写真风格，画面清晰美观`;
      
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
          content: '给你看看我的照片~',
          timestamp: Date.now(),
          type: 'image',
          mediaUrl: data.imageUrls[0],
        };
        
        setMessages(prev => {
          const newMessages = [...prev, imageMessage];
          saveChatHistory(newMessages);
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Image generation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 生成AI跳舞视频
  const handleGenerateVideo = async () => {
    if (!character) return;
    
    setIsLoading(true);
    
    try {
      const prompt = `一个${character.name}正在跳舞，动作流畅，活力四射，背景简洁`;
      
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
          content: '给你跳个舞~',
          timestamp: Date.now(),
          type: 'video',
          mediaUrl: data.videoUrl,
        };
        
        setMessages(prev => {
          const newMessages = [...prev, videoMessage];
          saveChatHistory(newMessages);
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Video generation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 语音录制
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          
          try {
            const response = await fetch('/api/asr', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64: base64 }),
            });

            const data = await response.json();
            if (data.text) {
              setInputText(data.text);
              inputRef.current?.focus();
            }
          } catch (error) {
            console.error('ASR error:', error);
          }
        };
        reader.readAsDataURL(audioBlob);
        
        // 关闭麦克风
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Recording error:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // 导出聊天记录
  const handleExport = () => {
    if (messages.length > 0 && character) {
      exportChatHistory(messages, character.name);
    }
  };

  // 分享
  const handleShare = async () => {
    const shareData = {
      title: 'AI虚拟男友',
      text: '快来试试我的AI男友~',
      url: window.location.origin,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      // 复制链接
      navigator.clipboard.writeText(shareData.url);
      alert('链接已复制到剪贴板');
    }
  };

  // TTS播放
  const playTTS = async (text: string) => {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await response.json();
      if (data.audioUri) {
        const audio = new Audio(data.audioUri);
        audio.play();
      }
    } catch (error) {
      console.error('TTS error:', error);
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
            <AvatarFallback className="bg-gradient-to-br from-pink-300 to-purple-400">
              {character.id === 'uncle' && '👨'}
              {character.id === 'sunshine' && '👦'}
              {character.id === 'straight_man' && '🤓'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-semibold text-gray-800">{character.name}</h1>
            <Badge variant="outline" className="text-xs">
              {isVoiceMode ? '语音通话中' : '在线'}
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleExport}>
            <Download className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleShare}>
            <Share2 className="w-5 h-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              if (confirm('确定要重置所有数据吗？')) {
                clearAllData();
                router.push('/');
              }
            }}
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
        </div>
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
                className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-pink-500 text-white'
                    : 'bg-white text-gray-800 shadow-sm'
                }`}
              >
                {/* 文字内容 */}
                <p className="whitespace-pre-wrap">{msg.content}</p>
                
                {/* 图片 */}
                {msg.type === 'image' && msg.mediaUrl && (
                  <div className="mt-2">
                    <img
                      src={msg.mediaUrl}
                      alt="AI男友自拍"
                      className="rounded-lg max-w-full"
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
                
                {/* 时间 */}
                <div className={`text-xs mt-1 ${
                  msg.role === 'user' ? 'text-pink-100' : 'text-gray-400'
                }`}>
                  {new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
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

      {/* 功能按钮 */}
      <div className="bg-white border-t px-4 py-2">
        <div className="max-w-2xl mx-auto flex justify-center gap-4 mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateImage}
            disabled={isLoading}
            className="text-pink-500 border-pink-200 hover:bg-pink-50"
          >
            <ImageIcon className="w-4 h-4 mr-1" />
            自拍
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateVideo}
            disabled={isLoading}
            className="text-purple-500 border-purple-200 hover:bg-purple-50"
          >
            <Video className="w-4 h-4 mr-1" />
            跳舞
          </Button>
          <Button
            variant={isVoiceMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsVoiceMode(!isVoiceMode)}
            className={isVoiceMode ? 'bg-green-500 hover:bg-green-600' : 'text-green-500 border-green-200'}
          >
            <Mic className="w-4 h-4 mr-1" />
            {isVoiceMode ? '语音模式' : '语音通话'}
          </Button>
        </div>
      </div>

      {/* 输入区域 */}
      <div className="bg-white border-t px-4 py-3 pb-safe">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <Input
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={isVoiceMode ? '点击麦克风开始录音' : '发送消息...'}
            disabled={isLoading}
            className="flex-1"
          />
          
          {isVoiceMode ? (
            <Button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              className={`${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
          ) : (
            <Button 
              onClick={handleSendMessage}
              disabled={!inputText.trim() || isLoading}
              className="bg-pink-500 hover:bg-pink-600"
            >
              <Send className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
