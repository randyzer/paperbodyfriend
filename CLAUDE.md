# Project Configuration

## Project Overview
- **Name**: PaperBoyfriend (AI 虚拟男友互动项目)
- **Type**: AI-powered interactive chat application
- **Tech Stack**: Next.js 16, React 19, Drizzle ORM, Neon Postgres, shadcn/ui, Tailwind CSS v4
- **Package Manager**: pnpm 9+ (强制使用)
- **AI Providers**: 火山引擎 Ark (对话/视频), SiliconFlow (TTS/ASR/图像)
- **Storage**: Cloudflare R2 (媒体文件)
- **Email**: Resend
- **Security**: Cloudflare Turnstile, Crisp Chat

## 项目简介

这是一个基于 Next.js 16 App Router 的 AI 虚拟男友互动应用，用户可以：
- 通过邮箱注册/登录
- 选择不同性格的虚拟男友角色（大叔、阳光男孩、直男）
- 进行文字、语音、图像、视频的多模态 AI 对话
- 会话数据本地优先存储，数据库回退
- 支持会话恢复和历史记录管理

## 核心目录结构

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                 # 首页（角色选择/会话恢复）
│   ├── layout.tsx               # 根布局（主题、字体、Crisp）
│   ├── globals.css              # 全局样式（Tailwind + shadcn 主题）
│   ├── chat/                    # 聊天页面
│   ├── login/                   # 登录页面
│   ├── register/                # 注册页面
│   ├── contact/                 # 联系我们页面
│   └── api/                     # API 路由
│       ├── auth/                # 认证相关（login/logout/session）
│       ├── chat/                # 对话接口（流式响应）
│       ├── conversations/       # 会话管理（CRUD + 恢复）
│       ├── image/               # 图像生成
│       ├── video/               # 视频生成（异步轮询）
│       ├── tts/                 # 文字转语音
│       ├── asr/                 # 语音识别
│       ├── profile/             # 用户头像上传
│       └── cron/                # 定时任务（每日邮件）
│
├── components/
│   ├── ui/                      # shadcn/ui 基础组件（完整集合）
│   ├── auth/                    # 认证组件（logout-button）
│   └── home/                    # 首页组件（resume-dialog）
│
├── lib/
│   ├── ai/                      # AI 服务核心
│   │   ├── config.ts           # AI 配置（超时、模型、API Key）
│   │   ├── provider-factory.ts # Provider 工厂
│   │   ├── providers/          # AI Provider 实现
│   │   │   ├── volcengine/    # 火山引擎（对话/视频）
│   │   │   └── siliconflow/   # SiliconFlow（TTS/ASR/图像）
│   │   ├── services/           # AI 服务层
│   │   │   ├── game-ai-service.ts    # 对话服务
│   │   │   ├── media-service.ts      # 媒体服务
│   │   │   └── speech-service.ts     # 语音服务
│   │   ├── types.ts            # AI 类型定义
│   │   ├── errors.ts           # 错误处理
│   │   └── utils/              # 工具函数（轮询、媒体处理）
│   ├── utils.ts                # 通用工具（cn 等）
│   ├── config.ts               # 应用配置
│   ├── r2.ts                   # Cloudflare R2 客户端
│   ├── video-jobs.ts           # 视频任务管理
│   ├── video-presets.ts        # 视频预设配置
│   └── fetch-with-timeout.ts   # 带超时的 fetch
│
├── server/
│   ├── auth/                    # 认证服务
│   │   ├── default-auth-service.ts  # 认证服务实现
│   │   ├── password.ts              # 密码哈希
│   │   ├── session-token.ts         # Session Token 生成
│   │   └── session-cookie.ts        # Cookie 管理
│   ├── conversations/           # 会话服务
│   │   ├── default-conversation-service.ts  # 会话服务实现
│   │   ├── conversation-repository.ts       # 数据访问层
│   │   └── route-handlers.ts               # 路由处理器
│   ├── db/
│   │   ├── client.ts           # Drizzle 客户端
│   │   └── schema/             # 数据库 Schema
│   │       ├── auth.ts         # 用户、会话表
│   │       └── conversations.ts # 会话、消息表
│   ├── profile/                # 用户资料服务
│   ├── storage/                # 存储服务
│   └── media/                  # 媒体处理服务
│
├── hooks/
│   └── use-mobile.ts           # 移动端检测 Hook
│
└── server.ts                    # 自定义服务器入口（开发模式）
```

## 技术栈详情

### 前端
- **框架**: Next.js 16.1.1 (App Router)
- **React**: 19.2.3
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **样式**: Tailwind CSS v4
- **表单**: React Hook Form + Zod 4.3.5
- **图标**: Lucide React
- **主题**: next-themes (亮色/暗色切换)
- **Toast**: Sonner
- **字体**: Geist Sans & Geist Mono

### 后端
- **数据库**: Neon Postgres (Serverless)
- **ORM**: Drizzle ORM 0.45.1
- **认证**: 自定义 Session Cookie (HttpOnly)
- **存储**: Cloudflare R2 (S3 兼容)
- **邮件**: Resend
- **验证码**: Cloudflare Turnstile
- **客服**: Crisp Chat

### AI 服务
- **对话**: 火山引擎 Ark (doubao-seed-2-0-pro-260215)
- **视频生成**: 火山引擎 Ark (doubao-seedance-1-5-pro-251215)
- **TTS**: SiliconFlow (FunAudioLLM/CosyVoice2-0.5B)
- **ASR**: SiliconFlow (FunAudioLLM/SenseVoiceSmall)
- **图像生成**: SiliconFlow (Kwai-Kolors/Kolors)
- **图像编辑**: SiliconFlow (Qwen/Qwen-Image-Edit)

## 常用命令

| 命令 | 用途 |
|------|------|
| `pnpm dev` | 启动开发服务器（http://localhost:3000） |
| `pnpm build` | 构建生产版本 |
| `pnpm start` | 启动生产服务器 |
| `pnpm lint` | 运行 ESLint 检查 |
| `pnpm ts-check` | TypeScript 类型检查 |
| `pnpm db:generate` | 生成 Drizzle 迁移文件 |
| `pnpm db:push` | 推送 Schema 到数据库 |
| `pnpm test:auth` | 运行认证相关测试 |
| `pnpm test:conversation` | 运行会话相关测试 |
| `pnpm test:ai-contract` | 测试 AI Provider 契约 |
| `pnpm test:chat-route` | 测试聊天路由 |
| `pnpm test:media-routes` | 测试媒体路由（图像/视频/TTS） |

## 开发规范

### 1. 组件开发

**必须优先使用 shadcn/ui 基础组件**

项目已预装完整的 shadcn/ui 组件库（位于 `src/components/ui/`），开发时应优先使用这些组件：

```tsx
// ✅ 推荐
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

// ❌ 避免从零开发基础组件
```

**可用组件清单**: button, input, textarea, select, checkbox, radio-group, switch, slider, card, separator, tabs, accordion, dialog, alert-dialog, toast, dropdown-menu, table, avatar, badge, tooltip, popover, calendar, command, carousel, sidebar 等 50+ 组件。

### 2. 路由开发

使用 Next.js 16 App Router，在 `src/app/` 下创建文件夹：

```bash
# 页面路由
src/app/about/page.tsx          # /about

# 动态路由
src/app/posts/[id]/page.tsx     # /posts/:id

# API 路由
src/app/api/users/route.ts      # /api/users
```

**动态路由参数必须 await**（Next.js 16 要求）：

```tsx
export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;  // ✅ 必须 await
  return <div>Post {id}</div>;
}
```

### 3. 依赖管理

**强制使用 pnpm**（项目已配置 `preinstall` 脚本）：

```bash
# ✅ 正确
pnpm install
pnpm add package-name
pnpm add -D package-name

# ❌ 禁止使用 npm 或 yarn
```

### 4. 样式开发

使用 Tailwind CSS v4 + shadcn 主题变量：

```tsx
// 使用 Tailwind 类名
<div className="flex items-center gap-4 p-4 rounded-lg bg-background">
  <Button className="bg-primary text-primary-foreground">按钮</Button>
</div>

// 使用 cn() 合并类名
import { cn } from '@/lib/utils';

<div className={cn(
  "base-class",
  condition && "conditional-class",
  className
)}>内容</div>
```

**主题变量**（定义在 `src/app/globals.css`）：
- `--background`, `--foreground`
- `--primary`, `--primary-foreground`
- `--secondary`, `--secondary-foreground`
- `--muted`, `--muted-foreground`
- `--accent`, `--accent-foreground`
- `--destructive`, `--destructive-foreground`
- `--border`, `--input`, `--ring`

### 5. 数据库操作

使用 Drizzle ORM，Schema 定义在 `src/server/db/schema/`：

```typescript
// 查询示例
import { db } from '@/server/db/client';
import { users } from '@/server/db/schema';
import { eq } from 'drizzle-orm';

const user = await db.query.users.findFirst({
  where: eq(users.email, email),
});

// 插入示例
await db.insert(users).values({
  email: 'user@example.com',
  passwordHash: hashedPassword,
});
```

**数据库变更流程**：
1. 修改 `src/server/db/schema/` 中的 Schema
2. 运行 `pnpm db:generate` 生成迁移
3. 运行 `pnpm db:push` 推送到数据库

### 6. 认证与会话

使用自定义 Session Cookie 认证（HttpOnly, Secure）：

```typescript
// 服务端获取当前用户
import { getSessionUser } from '@/lib/session-user';

export async function GET(request: Request) {
  const user = await getSessionUser(request);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }
  // ...
}
```

**认证流程**：
- 注册：`POST /api/auth/register` → 验证 Turnstile → 创建用户 → 设置 Session Cookie
- 登录：`POST /api/auth/login` → 验证密码 → 设置 Session Cookie
- 登出：`POST /api/auth/logout` → 清除 Cookie
- 会话检查：`GET /api/auth/session` → 返回当前用户信息

### 7. AI 服务调用

AI 服务统一通过 `src/lib/ai/services/` 调用：

```typescript
// 对话服务
import { GameAiService } from '@/lib/ai/services/game-ai-service';

const service = new GameAiService();
const stream = await service.chat({
  messages: [...],
  characterType: 'uncle',
});

// 媒体服务
import { MediaService } from '@/lib/ai/services/media-service';

const mediaService = new MediaService();
const imageUrl = await mediaService.generateImage({
  prompt: '描述',
  size: '1024x1024',
});
```

**AI 配置**（`src/lib/ai/config.ts`）：
- 所有超时时间、模型名称、API Key 都在此配置
- 通过环境变量覆盖默认值
- 使用 `getAiConfig()` 获取配置

### 8. 环境变量

敏感信息必须放在 `.env.local`（参考 `.env.example`）：

**必需变量**：
- `DATABASE_URL` - Neon Postgres 连接池 URL
- `DATABASE_URL_UNPOOLED` - Neon Postgres 直连 URL
- `ARK_API_KEY` - 火山引擎 API Key
- `SILICONFLOW_API_KEY` - SiliconFlow API Key
- `R2_*` - Cloudflare R2 配置（5 个变量）
- `RESEND_API_KEY` - Resend 邮件 API Key
- `TURNSTILE_SECRET_KEY` - Cloudflare Turnstile 密钥

**可选变量**：
- `AUTH_SESSION_COOKIE_NAME` - Session Cookie 名称（默认 `paperboyfriend_session`）
- `AUTH_SESSION_TTL_DAYS` - Session 有效期（默认 30 天）
- `AI_*` - AI 服务超时、模型配置（有默认值）

## 修改代码时的注意事项

### 1. 修改 AI 相关代码

**必须先阅读**：
- `src/lib/ai/config.ts` - 了解配置结构
- `src/lib/ai/types.ts` - 了解类型定义
- `src/lib/ai/provider-factory.ts` - 了解 Provider 创建逻辑

**修改 Provider 时**：
- 实现 `ChatProvider`, `VideoProvider`, `SpeechProvider`, `ImageProvider` 接口
- 处理超时、错误、重试逻辑
- 添加详细的错误日志（使用 `src/lib/ai/logger.ts`）

**修改 Service 时**：
- Service 层不应直接依赖具体 Provider
- 通过 `ProviderFactory` 获取 Provider
- 处理业务逻辑和数据转换

### 2. 修改认证相关代码

**必须先阅读**：
- `src/server/auth/default-auth-service.ts` - 认证服务实现
- `src/server/auth/session-cookie.ts` - Cookie 管理
- `src/lib/session-user.ts` - 获取当前用户

**注意事项**：
- Session Token 使用 crypto.randomBytes(32) 生成
- 密码使用 bcrypt 哈希（10 轮）
- Cookie 必须设置 HttpOnly, Secure (生产环境), SameSite=Lax
- Session 过期时间从环境变量读取

### 3. 修改会话相关代码

**必须先阅读**：
- `src/server/conversations/default-conversation-service.ts` - 会话服务
- `src/server/conversations/conversation-repository.ts` - 数据访问层
- `src/app/api/conversations/route.ts` - API 路由

**会话恢复逻辑**：
1. 登录后先检查本地缓存（localStorage）
2. 本地无数据时查询数据库最近会话
3. 提示用户"继续上一次对话"或"重新选择角色"
4. 用户选择后更新会话状态

### 4. 修改 API 路由

**必须遵循**：
- 使用 `getSessionUser()` 验证用户身份
- 返回标准 JSON 响应（使用 `NextResponse.json()`）
- 使用正确的 HTTP 状态码（200, 201, 400, 401, 404, 500）
- 捕获并记录所有错误
- 对流式响应使用 `ReadableStream`

**错误处理示例**：
```typescript
try {
  // 业务逻辑
} catch (error) {
  console.error('[DEBUG] Error in route:', error);
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

### 5. 修改数据库 Schema

**流程**：
1. 修改 `src/server/db/schema/` 中的表定义
2. 运行 `pnpm db:generate` 生成迁移文件
3. 检查生成的迁移 SQL（在 `drizzle/` 目录）
4. 运行 `pnpm db:push` 应用到数据库
5. 更新相关的 TypeScript 类型和查询代码

**注意事项**：
- 不要直接修改已生成的迁移文件
- 删除列时要考虑数据迁移
- 添加非空列时要提供默认值或先添加为可空

### 6. 添加新的 AI Provider

**步骤**：
1. 在 `src/lib/ai/providers/` 下创建新目录
2. 实现对应的 Provider 接口（`ChatProvider` 等）
3. 在 `src/lib/ai/provider-factory.ts` 中注册
4. 在 `src/lib/ai/config.ts` 中添加配置
5. 添加环境变量到 `.env.example`
6. 编写测试（参考 `scripts/ai-provider-contract.test.ts`）

## Claude 工作规范

### 输出风格

1. **简洁直接**：直接给出答案，不要过度解释
2. **代码优先**：用代码示例说明，而不是长篇文字
3. **中文为主**：项目文档和注释使用中文，代码使用英文
4. **标注位置**：引用代码时使用 `file_path:line_number` 格式

### 修改代码时

1. **先读后写**：修改文件前必须先用 Read 工具读取
2. **最小改动**：只修改必要的部分，不要重构无关代码
3. **保持风格**：遵循项目现有的代码风格和命名规范
4. **不添加测试**：除非用户明确要求，否则不自动添加测试代码
5. **不添加注释**：除非逻辑复杂，否则不添加额外注释

### 回答问题时

1. **检查最新代码**：不要依赖记忆，先读取当前文件内容
2. **给出具体位置**：告诉用户相关代码在哪个文件的哪一行
3. **提供可运行示例**：给出完整的、可直接使用的代码
4. **说明影响范围**：如果修改会影响其他部分，明确指出

### 调试问题时

1. **查看日志**：先检查控制台输出和错误信息
2. **验证配置**：检查环境变量和配置文件
3. **测试 API**：使用 `pnpm test:*` 命令验证功能
4. **逐步排查**：从最可能的原因开始，逐步缩小范围

## 已知问题与注意事项

### 1. Next.js 16 动态路由参数

Next.js 16 中，动态路由的 `params` 和 `searchParams` 必须 await：

```tsx
// ✅ 正确
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}

// ❌ 错误（Next.js 15 及以前的写法）
export default function Page({ params }: { params: { id: string } }) {
  const { id } = params;
}
```

### 2. 视频生成是异步的

视频生成使用轮询机制（`src/lib/ai/utils/polling.ts`）：
- 提交任务后立即返回 `jobId`
- 客户端需要轮询 `/api/video?jobId=xxx` 检查状态
- 默认每 5 秒轮询一次，最多 60 次（5 分钟）
- 完成后返回视频 URL

### 3. 会话存储策略

会话数据采用"本地优先、数据库回退"策略：
- 对话消息优先存储在 localStorage
- 登录后同步到数据库
- 跨设备时从数据库恢复
- 避免频繁的数据库写入

### 4. AI 服务超时配置

不同 AI 服务有不同的超时时间（`src/lib/ai/config.ts`）：
- 对话：60 秒
- 语音合成：45 秒
- 图像生成：90 秒
- 视频生成：300 秒（5 分钟）

如果遇到超时，可以通过环境变量调整：
```bash
AI_CHAT_TIMEOUT_MS=120000
AI_VIDEO_TIMEOUT_MS=600000
```

### 5. Cloudflare R2 存储

媒体文件（头像、生成的图像/视频）存储在 R2：
- 使用 S3 兼容 API（`@aws-sdk/client-s3`）
- 公开访问 URL 通过 `R2_PUBLIC_URL` 配置
- 上传前检查文件大小和类型
- 头像限制 5MB，其他媒体文件根据需要调整

## 测试策略

项目使用 Node.js 原生测试（`node --import tsx`），不依赖 Jest：

**测试文件位置**：`scripts/*.test.ts`

**测试分类**：
- `test:auth` - 认证服务、路由、密码哈希、Turnstile
- `test:conversation` - 会话存储、服务、路由
- `test:ai-contract` - AI Provider 契约测试
- `test:chat-route` - 聊天路由测试
- `test:media-routes` - 媒体路由测试（图像/视频/TTS）

**运行测试**：
```bash
# 运行所有认证测试
pnpm test:auth

# 运行单个测试文件
node --import tsx scripts/auth-service.test.ts
```

## 参考文档

- [Next.js 16 文档](https://nextjs.org/docs)
- [shadcn/ui 组件](https://ui.shadcn.com)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Drizzle ORM](https://orm.drizzle.team/docs/overview)
- [React Hook Form](https://react-hook-form.com)
- [Zod 验证](https://zod.dev)
- [火山引擎 Ark API](https://www.volcengine.com/docs/82379)
- [SiliconFlow API](https://docs.siliconflow.cn)

## 待确认事项

以下内容需要根据实际情况确认：

1. **生产环境部署方式**：Vercel / 自建服务器 / Docker？
2. **CI/CD 流程**：是否有自动化测试和部署？
3. **监控和日志**：使用什么监控工具？
4. **备份策略**：数据库和媒体文件的备份频率？
5. **性能优化**：是否需要 CDN、缓存策略？
6. **国际化**：是否需要支持多语言？

---
**Last Updated**: 2026-04-23
**Project Version**: 0.1.0
