# Project Knowledge Base

## 一页摘要

- 这个项目已经从“纯前端本地 MVP”升级成“带注册登录、Neon、R2、邮件、定时任务接口”的服务端驱动项目。后续做功能时，默认先看服务端边界，不要再按纯前端项目思路改。
- 页面只负责渲染和交互。认证、数据库、R2、邮件、AI 提供方调用，都应放在服务端 route handler / service 层。
- Vercel 构建最容易踩的坑是“构建脚本重复安装依赖”。`scripts/build.sh` 和 `scripts/prepare.sh` 不应再执行 `pnpm install`。
- 本地开发闪烁、反复在 `/` 和 `/login` 之间跳，多半不是业务逻辑错，而是 Turbopack root / 自定义 server / 请求挂住导致的开发态异常。
- 数据库 schema 文件写了不等于表已存在。凡是新增表或字段，必须实际检查 Neon 里是否已经落库。
- Resend 后台显示 `Delivered`，就说明代码链路和 API 配置基本是通的；“用户没在收件箱看到”通常已经是送达率或垃圾邮件问题，不是注册逻辑故障。
- `cron-job.org` 和 Vercel Cron 不要同时开，否则同一批用户会被重复触发，收到两封邮件。
- 每日情话批量发送最初是严格串行，用户多时会明显延迟。现在已改成有限并发，默认并发数为 `3`。
- 第三方脚本接入（Plausible、Google Analytics、Clarity、Crisp）统一从全局 [src/app/layout.tsx](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/app/layout.tsx:1) 进入，不要分散到各页面重复挂载。
- 首页或其他页面如果自己再写 `min-h-screen`，会把全局 footer 挤到下一屏，导致“联系我们”看起来像没加。吸底布局生效后，要检查页面根节点高度类名是否冲突。

## 最近几天已经完成的能力

### 认证与数据库

- 已实现邮箱注册、登录、登出、会话查询。
- 已接入 Neon，认证相关核心表已使用：
  - `paper_boyfriend_users`
  - `paper_boyfriend_auth_sessions`
- 密码服务端哈希存储，会话使用数据库会话 + `HttpOnly` Cookie。

### 会话恢复

- 登录后支持“继续上一次对话 / 重新选择角色”。
- 恢复策略是：
  - 先看当前用户的本地缓存
  - 本地没有，再回退到数据库最近会话
- 聊天历史、图片、视频、音频链接都能落到会话消息表里恢复。

### 媒体永久化

- AI 生成的图片、视频、音频都会在服务端转存到 Cloudflare R2。
- 返回给前端的是永久链接，不再依赖上游临时链接。
- 历史记录恢复时，使用的是数据库里保存的 R2 永久链接。

### 头像上传

- 用户头像已支持上传到 R2。
- 数据库存储 `avatar_url`。
- `/api/auth/session` 会返回 `avatarUrl`，前端头像菜单优先显示真实头像，没有才回退首字母。

### 邮件系统

- 注册成功后会尝试发送欢迎邮件，失败不会中断注册流程。
- 已支持按用户最近角色生成“每日情话”邮件内容。
- 已提供批量发送函数 `sendDailyLoveLetterToAll()`。
- 已提供 cron API：
  - `/api/cron/daily-email`
- 当前学习阶段的推荐调度方式是 `cron-job.org`，不再使用项目内的 Vercel Cron 配置。

### 联系与客服

- 已提供全局“联系我们”入口，目标页面为 `/contact`。
- 联系页已包含：
  - 邮箱：`feedback@paperboyfriend.shop`
  - Discord：`https://discord.gg/9vTtjzt2`
- Crisp 在线聊天脚本已接入全局 layout，网站级配置通过 `NEXT_PUBLIC_CRISP_WEBSITE_ID` 控制。

### 数据分析与追踪

- 已在全局 layout 接入三套统计/行为脚本：
  - Plausible
  - Google Analytics (`gtag.js`)
  - Microsoft Clarity
- 当前实现是直接在全局 `<head>` 中统一注入，避免页面级重复接入。

## 开始任务前必须先检查什么

### 工程基线

- 先看 [package.json](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/package.json:1)、[scripts/build.sh](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/scripts/build.sh:1)、[scripts/prepare.sh](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/scripts/prepare.sh:1)、[next.config.ts](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/next.config.ts:1)。
- 确认构建脚本没有重复安装依赖。
- 确认 `pnpm build`、`pnpm ts-check` 在本地能过。

### 环境变量

- `.env.local` 只放敏感信息，不要写进代码。
- 当前常用变量：
  - `DATABASE_URL`
  - `DATABASE_URL_UNPOOLED`
  - `TURNSTILE_SECRET_KEY`
  - `NEXT_PUBLIC_CRISP_WEBSITE_ID`
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
  - `APP_BASE_URL`
  - `CRON_SECRET`
  - `R2_ENDPOINT`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET_NAME`
  - `R2_PUBLIC_URL`

### 数据库

- 不要只改 schema 文件就认为数据库可用。
- 认证、会话、媒体、头像相关改动后，先确认目标表和字段在 Neon 里真实存在。
- 之前已经踩过：
  - 认证表存在，但会话表缺失
  - `paper_boyfriend_conversations` 缺失导致“确认选择”后进入聊天失败

### 邮件

- `RESEND_FROM_EMAIL` 必须和 Resend 已验证域名匹配。
- `APP_BASE_URL` 应尽量使用正式访问域名，不要长期用 `vercel.app`，否则会拖送达率。
- 判断“邮件功能是否正常”时，优先看 Resend 后台发送状态，而不是只看收件箱。

### 第三方脚本

- 统计脚本、客服脚本统一放在全局 layout，不要散落到首页、聊天页等单独页面。
- `Crisp` 依赖 `NEXT_PUBLIC_CRISP_WEBSITE_ID`，本地和线上都要检查是否已配置。
- 同一类脚本尽量只挂一次，避免开发态热更新或重复挂载导致双初始化。

## 已确认踩过的坑

### 1. Vercel 构建失败：`Cannot find module 'typescript'`

**现象**

- Vercel 构建报：
  - `Failed to transpile "next.config.ts"`
  - `Cannot find module 'typescript'`

**根因**

- 构建脚本重复执行 `pnpm install`
- Vercel 本来会先安装依赖，再执行 `pnpm build`
- 二次安装让构建环境变脏，最终 Next 在转译 `next.config.ts` 时找不到 `typescript`

**正确做法**

- `build.sh` 只负责 `build`
- `prepare.sh` 不要偷偷安装依赖
- 已补回归测试：
  - [scripts/build-script.test.ts](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/scripts/build-script.test.ts:1)

### 2. 本地开发打开首页闪烁，一直停在“正在检查登录状态”

**现象**

- 打开 `http://localhost:3000` 后反复闪烁
- 在 `/` 和 `/login` 之间跳
- 页面长时间停在“正在检查登录状态...”
- 日志出现 Turbopack panic

**根因**

- 有一次是真正的开发服务器根目录识别异常，Turbopack root 没锁死
- 另一次是首页会话恢复请求挂住或失败，UI 文案没把“登录检查”和“恢复历史”区分开

**正确做法**

- 在 [next.config.ts](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/next.config.ts:1) 显式固定 Turbopack root
- 给关键前端请求加超时兜底
- 把首页 loading 分成：
  - 登录状态检查
  - 历史会话恢复

### 3. 选择角色后“正在进入”，但实际进不了聊天

**现象**

- 点击“确认选择”后按钮转圈
- 最后又回到原状态

**根因**

- Neon 里缺少：
  - `paper_boyfriend_conversations`
  - `paper_boyfriend_conversation_messages`
- 服务端插入会话时报：
  - `relation "paper_boyfriend_conversations" does not exist`

**正确做法**

- 不是只改 schema，要实际确认表已落库
- 会话相关问题优先查：
  - route handler
  - Neon 实表
  - 构建后运行环境是否使用了最新 schema

### 4. 注册成功但欢迎邮件收不到

**阶段一：代码/配置问题**

**现象**

- Vercel 日志报：
  - `RESEND_FROM_EMAIL is missing`

**根因**

- Vercel 环境变量配置错误，`RESEND_FROM_EMAIL` 没被正确读取

**正确做法**

- `RESEND_FROM_EMAIL` 必须在 Vercel 中正确设置
- 更新环境变量后要重新部署

**阶段二：Resend 测试域限制**

**现象**

- 用 `onboarding@resend.dev` 发给真实用户邮箱，收不到

**根因**

- `resend.dev` 只适合测试，不能当正式发件域

**正确做法**

- 使用 Resend 已验证的正式域名邮箱

**阶段三：已显示 Delivered，但邮件在垃圾箱**

**现象**

- Resend 后台显示 `Delivered`
- 收件人实际在垃圾邮件里看到欢迎邮件

**结论**

- 代码链路正常
- 问题变成送达率和邮箱信誉问题，不再是注册逻辑 bug

**正确做法**

- 优先把这件事当成 deliverability 问题处理
- 不要继续怀疑注册 API 主流程

### 5. Resend 返回错误但代码没有显式识别

**现象**

- 邮件 SDK 调用了，但失败原因不够清晰

**根因**

- `resend.emails.send(...)` 返回的是 `{ data, error }`
- 之前只是 `await` 调用，没有检查 `error`

**正确做法**

- 已在 [src/lib/email.ts](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/lib/email.ts:1) 中增加 `sendWithResendClient(...)`
- 必须把 `error` 显式当成失败处理

### 6. 邮件进入垃圾箱，不等于功能坏了

**经验结论**

- 只要 Resend 后台显示 `Delivered`，发信链路通常就是成功的
- 这时应该优先排查：
  - 垃圾箱
  - 收件服务商策略
  - 域名信誉
  - 邮件内容/主题/链接域名

**当前项目的改善建议**

- `APP_BASE_URL` 尽量使用正式域名
- 后续补 `DMARC`
- 欢迎邮件内容尽量少营销感，减少过多 emoji
- 后面可以补纯文本版本

### 7. `cron-job.org` 和 Vercel Cron 同时启用会重复发信

**现象**

- 两边都调用同一个 `/api/cron/daily-email`
- 用户可能收到两封一样的每日情话

**结论**

- 这不是接口冲突，而是双重触发

**当前项目的决定**

- 学习阶段统一使用 `cron-job.org`
- 已移除项目内 `vercel.json`
- 以后不要再同时启用两边的调度

### 8. 每日情话定时邮件比定时点晚几分钟收到

**现象**

- 设定时间已到，但真正收到邮件晚几分钟

**根因**

- 最初的 `sendDailyLoveLetterToAll()` 是严格串行
- 每个用户都要：
  - 查最近角色
  - 调 AI 生成情话
  - 调邮件发送
- 用户越多，后面的用户越晚收到

**当前优化**

- 已改成有限并发
- 默认并发数：`3`
- 仍然保留“单用户失败不影响其他用户”

**经验结论**

- 几分钟延迟并不一定异常
- 真正需要看的是：
  - cron 触发时间
  - AI 生成耗时
  - Resend 发送时间
  - 收件箱实际出现时间

### 9. 全局 footer 已经加了，但首页仍然要下拉才能看到“联系我们”

**现象**

- 全局 layout 已经有 footer
- 首页仍然需要往下滚，才看到“联系我们”

**根因**

- layout 已经改成了吸底结构：
  - `body` 使用 `flex min-h-screen flex-col`
  - `main` 使用 `flex-1`
- 但首页自身仍然写了 `min-h-screen`
- 结果变成“页面内容自己先占满一整屏，footer 再被挤到下一屏”

**正确做法**

- 吸底 footer 生效后，要检查页面根节点是否还在额外使用 `min-h-screen`
- 当前首页已经改成和 layout 兼容的 `h-full min-h-full`

### 10. 第三方脚本接入位置不统一，后面很容易重复挂载

**现象**

- 统计、客服脚本需求越来越多：
  - Plausible
  - Google Analytics
  - Clarity
  - Crisp
- 如果各自接在不同页面，后续很容易重复挂载、初始化多次，排查也很乱

**正确做法**

- 所有“网站级脚本”统一从 [src/app/layout.tsx](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/app/layout.tsx:1) 接入
- 客服类脚本用独立组件更清晰，比如 [src/components/crisp-chat.tsx](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/components/crisp-chat.tsx:1)
- 统计类脚本统一放在 `<head>`，减少页面级散落

### 11. Crisp 脚本开发态可能重复插入

**现象**

- React 开发态热更新或组件重新挂载时，第三方脚本可能被重复插入

**正确做法**

- 当前 [src/components/crisp-chat.tsx](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/components/crisp-chat.tsx:1) 已通过固定脚本 `id` 的方式避免重复插入
- 后续新增类似脚本组件时，优先复用这个模式

## 当前稳定约束

- 页面只做渲染和交互，不直接碰数据库、认证、R2、邮件。
- 所有敏感信息只放 `.env.local` / Vercel 环境变量。
- 构建脚本不准再次安装依赖。
- 新增数据库能力后，必须检查真实落库，不只看 schema。
- 新增邮件能力后，必须区分：
  - 代码调用成功
  - Resend 后台是否已发送
  - 用户是否在收件箱看到
- 批量任务默认不要无限并发，先做有限并发。
- 学习阶段的定时任务统一走 `cron-job.org`。
- 网站级第三方脚本统一放到全局 layout；页面级只放真正和当前页面强耦合的逻辑。
- 改全局 footer 或 layout 后，要回头检查首页、聊天页等页面是否还有自己的整屏高度类名。

## 排查顺序建议

### 遇到注册/登录问题

1. 看 `/api/auth/*` 路由是否返回正确状态码
2. 看 `.env.local` / Vercel 里认证相关变量
3. 看 Neon 认证表是否真实存在
4. 再看前端页面跳转和会话恢复逻辑

### 遇到媒体历史恢复问题

1. 看 API 返回的是不是 R2 永久链接
2. 看会话消息表里存的是不是永久链接
3. 看前端同步逻辑是否把永久链接写回消息

### 遇到邮件问题

1. 先看 Vercel 日志是否有“欢迎邮件发送失败”
2. 再看 Resend 后台是否有发送记录
3. 如果是 `Delivered`，就转去看垃圾箱/送达率
4. 不要一上来就怀疑注册逻辑或 Resend SDK

### 遇到定时任务问题

1. 先手动调用 `/api/cron/daily-email`
2. 看 `Authorization: Bearer <CRON_SECRET>` 是否正确
3. 再看 `cron-job.org` 的执行日志
4. 最后才排查邮件发送本身

### 遇到第三方脚本问题

1. 先确认脚本是否应该是“网站级能力”还是“页面级能力”
2. 网站级能力优先查 [src/app/layout.tsx](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/app/layout.tsx:1)
3. 客服脚本优先查对应组件，例如 [src/components/crisp-chat.tsx](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/components/crisp-chat.tsx:1)
4. 如果是前端看起来“没生效”，优先排查：
   - 环境变量是否存在
   - 是否被重复挂载
   - 是否只是被页面高度/布局问题遮住了

## 关键文件索引

### 认证

- [src/app/api/auth/register/route.ts](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/app/api/auth/register/route.ts:1)
- [src/app/api/auth/login/route.ts](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/app/api/auth/login/route.ts:1)
- [src/server/auth/auth-service.ts](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/server/auth/auth-service.ts:1)
- [src/server/auth/auth-repository.ts](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/server/auth/auth-repository.ts:1)

### 会话与历史恢复

- [src/app/api/conversations/route.ts](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/app/api/conversations/route.ts:1)
- [src/server/conversations/route-handlers.ts](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/server/conversations/route-handlers.ts:1)
- [src/server/db/schema/conversations.ts](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/server/db/schema/conversations.ts:1)

### 媒体永久化

- [src/app/api/image/route.ts](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/app/api/image/route.ts:1)
- [src/app/api/video/route.ts](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/app/api/video/route.ts:1)
- [src/app/api/tts/route.ts](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/app/api/tts/route.ts:1)
- [src/server/media](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/server/media)
- [src/lib/r2.ts](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/lib/r2.ts:1)

### 邮件与定时任务

- [src/lib/email.ts](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/lib/email.ts:1)
- [src/lib/ai/services/love-letter-service.ts](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/lib/ai/services/love-letter-service.ts:1)
- [src/app/api/cron/daily-email/route.ts](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/app/api/cron/daily-email/route.ts:1)

### 布局、联系页与第三方脚本

- [src/app/layout.tsx](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/app/layout.tsx:1)
- [src/app/contact/page.tsx](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/app/contact/page.tsx:1)
- [src/components/crisp-chat.tsx](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/components/crisp-chat.tsx:1)

### 环境变量与构建

- [src/server/env.ts](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/src/server/env.ts:1)
- [.env.example](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/.env.example:1)
- [scripts/build.sh](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/scripts/build.sh:1)
- [scripts/prepare.sh](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/scripts/prepare.sh:1)
- [next.config.ts](/Users/randyz/work/coding/deepsea_III/project/3st_demo_paperboyfriend/next.config.ts:1)
