# 登录后恢复上一段对话设计

## 背景

当前项目已经具备邮箱密码登录、Neon 用户表和会话表，但聊天记录仍然完全依赖浏览器本地存储。用户新的需求是：

1. 每次登录后，不要直接进入聊天页。
2. 如果存在“上一段对话”，提示用户选择：
   - 继续上一次对话
   - 重新选择角色
3. 恢复策略需要兼容两类数据源：
   - 优先使用当前设备上的本地记录
   - 本地没有时，再回退到 Neon 中该账号的最近一次聊天记录

这意味着当前“匿名本地聊天”模型要升级为“登录账号 + 可恢复会话线程”模型，但页面仍然只负责渲染和交互，恢复判断、数据查询、会话持久化都必须由服务端主导。

## 目标

### 目标内

- 登录后统一回到首页，由首页决定是继续还是重新开始
- 兼容本地恢复与数据库恢复，且本地优先
- 真正恢复完整聊天记录，而不仅是恢复角色
- 本地缓存按用户隔离，避免同一浏览器多账号串数据
- 服务端持久化最近聊天会话和消息，支持跨设备回退

### 目标外

- 多会话列表页
- 删除历史会话
- 重命名会话标题
- 聊天记录搜索
- 消息编辑、撤回
- 将 TTS/图片/视频二进制资源迁移到数据库

## 核心原则

1. 页面只负责渲染和选择动作，不直接读写数据库。
2. 账号级恢复以服务端接口为准，本地只作为优先缓存层。
3. “重新选择角色”不会删除旧会话，只是开始一条新的会话线程。
4. 本地存储必须按 `userId` 隔离。
5. 服务端数据库结构要支持未来扩展到多会话历史。

## 用户流程

### 1. 登录 / 注册成功后

- 登录页和注册页成功后统一跳转到 `/`
- 首页在已登录状态下先检查本地恢复候选
- 本地没有候选时，再请求服务端恢复候选
- 如果没有任何可恢复会话：直接展示角色选择页
- 如果存在可恢复会话：展示确认弹层

### 2. 确认弹层

展示信息：

- 上次聊天角色名
- 最后一条消息预览
- 最后更新时间

操作：

- `继续上一次对话`
  - 如果来源是本地：直接设置当前会话上下文并进入 `/chat`
  - 如果来源是数据库：先拉取完整消息，同步到本地用户缓存，再进入 `/chat`
- `重新选择角色`
  - 清空当前用户的“已选角色 / 当前会话指针 / 当前本地聊天缓存”
  - 保留数据库旧会话
  - 留在首页，等待重新选角色

### 3. 聊天页

- 优先从“当前用户当前会话”本地缓存加载
- 本地无当前会话且 URL 或服务端状态存在 DB 会话时，从服务端拉取完整会话
- 发送新消息时，除了继续更新本地缓存，还要异步持久化到服务端
- 当用户重新开始新角色对话时，创建新的会话线程

## 数据模型

### 现有表保留

- `paper_boyfriend_users`
- `paper_boyfriend_auth_sessions`

这两张表继续保留，不替换。

### 新增表

#### `paper_boyfriend_conversations`

用途：表示某个用户与某个角色的一段连续对话线程。

字段：

- `id uuid primary key`
- `user_id uuid not null`
- `character_id text not null`
- `title text null`
- `last_message_preview text null`
- `last_message_at timestamptz not null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `archived_at timestamptz null`

约束与索引：

- 外键 `user_id -> paper_boyfriend_users.id`
- `user_id + updated_at` 索引，用于查询最近会话
- `character_id` 索引，可选

#### `paper_boyfriend_conversation_messages`

用途：保存完整消息历史，支持跨设备恢复。

字段：

- `id text primary key`
- `conversation_id uuid not null`
- `role text not null`
- `content text not null`
- `type text null`
- `media_url text null`
- `video_request_id text null`
- `video_status text null`
- `pending_caption text null`
- `media_kind text null`
- `created_at timestamptz not null`

约束与索引：

- 外键 `conversation_id -> paper_boyfriend_conversations.id`
- `conversation_id + created_at` 索引，用于顺序拉取消息

## 本地存储调整

当前全局 key：

- `ai_boyfriend_character`
- `ai_boyfriend_chat_history`

存在问题：

- 不区分账号
- 无法知道当前缓存属于谁
- 无法记录“当前会话 id”

### 新方案

本地 key 改为按用户隔离：

- `ai_boyfriend_character:<userId>`
- `ai_boyfriend_chat_history:<userId>`
- `ai_boyfriend_conversation_id:<userId>`

### 兼容迁移

对于已有老用户：

- 如果当前登录用户还没有用户级 key
- 但浏览器里有旧的全局 `character/chat_history`
- 则在首次登录时把旧数据迁移到该用户命名空间

迁移完成后：

- 保留一次兜底读取
- 新写入只使用用户级 key

## 恢复优先级

### 优先级规则

1. 先检查当前登录用户的本地会话缓存
2. 本地存在有效会话且消息数大于 0：直接作为恢复候选
3. 本地不存在时，再查数据库最近一条未归档会话
4. DB 也不存在时，不弹恢复提示，直接显示角色选择页

### 有效本地会话定义

满足以下条件：

- 有 `conversationId`
- 有 `selectedCharacter`
- 有至少 1 条消息

## 服务端接口

### `GET /api/conversations/resume-candidate`

用途：给首页返回是否存在可恢复的上一段对话。

返回：

- `source: "database" | null`
- `hasResumeCandidate: boolean`
- `conversationId`
- `characterId`
- `characterName`
- `lastMessagePreview`
- `lastMessageAt`

说明：

- 服务端只负责 DB 候选查询和当前用户校验
- 本地优先判断由首页先做，只有本地没有时才请求这个接口

### `POST /api/conversations`

用途：当用户重新选择角色并开始新对话时，创建新的会话线程。

请求：

- `characterId`

返回：

- `conversationId`
- `characterId`

### `GET /api/conversations/:id`

用途：拉取某一条会话的完整消息历史。

返回：

- 会话元信息
- 完整消息数组

### `POST /api/conversations/:id/messages/sync`

用途：将当前本地消息快照同步到服务端。

说明：

- 首版可采用“客户端提交当前完整消息数组，服务端按 message id 去重插入”的方式
- 这样实现最稳，适合当前项目现状

请求：

- `characterId`
- `messages`

返回：

- `success: true`
- `conversationId`
- `persistedCount`

## 服务端模块设计

新增模块：

- `src/server/db/schema/conversations.ts`
- `src/server/conversations/conversation-repository.ts`
- `src/server/conversations/conversation-service.ts`
- `src/server/conversations/conversation-mapper.ts`

职责：

- `repository`
  - 只负责数据库读写
- `service`
  - 负责恢复候选判断、会话创建、消息同步
- `mapper`
  - 负责 DB 行与前端消息结构转换

## 页面与组件设计

### 首页 `src/app/page.tsx`

新增职责：

- 读取当前登录用户
- 检查当前用户本地是否存在可恢复会话
- 本地没有时请求 `/api/conversations/resume-candidate`
- 有候选时展示确认弹层
- 无候选时正常显示角色选择

新增状态：

- `resumeCandidate`
- `resumeDecisionLoading`
- `isCheckingResume`

### 登录页 / 注册页

保持：

- 成功后跳转 `/`

不做：

- 不直接跳 `/chat`
- 不在登录页处理恢复弹层

### 聊天页 `src/app/chat/page.tsx`

新增职责：

- 根据当前用户 + 当前 conversation id 加载消息
- 新消息发送后同步本地缓存和服务端
- 当没有会话上下文时回首页

## 数据流

### 继续上一段对话

1. 登录成功，进入 `/`
2. 首页查本地用户缓存
3. 本地有候选：展示恢复弹层
4. 用户点击继续：写入当前用户会话上下文，跳转 `/chat`
5. 聊天页从本地加载消息并继续同步

### 从数据库恢复

1. 登录成功，进入 `/`
2. 本地无候选
3. 首页请求 DB 最近会话
4. 用户点击继续
5. 拉取完整会话消息
6. 同步到当前用户本地缓存
7. 跳转 `/chat`

### 重新选择角色

1. 首页展示恢复弹层
2. 用户点击重新选择
3. 清空当前用户本地角色 / 当前会话 / 当前聊天缓存
4. 首页停留在角色选择视图
5. 选择角色后创建新会话并进入 `/chat`

## 错误处理

- DB 查询失败：不阻塞首页，降级为直接显示角色选择
- DB 会话存在但拉取详情失败：提示“恢复失败，请重新选择角色或稍后重试”
- 本地缓存损坏：忽略本地缓存并回退到 DB 查询
- 角色 id 无效：清空本地当前会话，回首页重新选择
- 同步消息失败：不打断当前聊天，记录控制台错误并允许后续重试

## 测试方案

### 单元测试

- 本地用户级 key 生成与读取
- 旧全局缓存迁移到用户级缓存
- 恢复候选判断逻辑
- DB 消息映射逻辑

### 服务端测试

- 创建会话
- 查询最近会话
- 拉取完整会话
- 同步消息去重

### 路由测试

- `GET /api/conversations/resume-candidate`
- `POST /api/conversations`
- `GET /api/conversations/:id`
- `POST /api/conversations/:id/messages/sync`

### 页面行为测试

- 本地有记录时，首页优先使用本地候选
- 本地无记录时，首页回退 DB 候选
- 选择继续时进入聊天页
- 选择重新选择时停留首页重新选角色
- 同一浏览器多个账号互不串数据

## 风险与回滚

### 风险

- 当前聊天页是强本地驱动，接入会话线程后状态边界更复杂
- 本地旧数据迁移如果处理不好，可能导致用户误看到别人的旧聊天
- 服务端同步如果做成强依赖，可能影响聊天流畅度

### 降低风险措施

- 本地 key 全部改为 `userId` 命名空间
- 服务端同步采用“尽力而为”，不阻塞主聊天流程
- 数据库仅新增表，不改已有用户/会话表

### 回滚方案

- 关闭首页恢复弹层逻辑
- 保留新增会话表但不使用
- 聊天页退回仅依赖本地用户级缓存

## 实施拆分建议

1. 先做数据库 schema 和服务端 conversation service
2. 再做用户级本地存储和旧数据迁移
3. 然后做首页恢复弹层与“继续 / 重选”交互
4. 最后改聊天页的会话加载与消息同步

## 验收标准

- 登录后不直接进入聊天页
- 有上一段对话时一定出现“继续 / 重选”提示
- 本地有记录时优先本地恢复
- 本地无记录时可从同账号 DB 历史恢复完整消息
- 重新选择角色会创建新会话，而不是覆盖旧会话
- 同一浏览器多个账号互不串角色和聊天记录
