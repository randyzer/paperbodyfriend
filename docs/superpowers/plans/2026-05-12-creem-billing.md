# Creem Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为当前项目接入 Creem Checkout、支付成功回跳校验、Webhook 同步与站内订阅状态展示。

**Architecture:** 使用服务端 REST API 调用 Creem Test Mode，前端只负责发起购买和展示状态。支付成功后的真正授权以 webhook 为准，return URL 只负责 UX 与基础签名校验。订阅状态落到本地 Postgres 表中，供站内页面和后续功能读取。

**Tech Stack:** Next.js 16 App Router、TypeScript、Drizzle ORM、Neon/Postgres、Creem REST API、Node crypto。

---

## 文件边界

- `src/server/env.ts`：Creem 环境变量读取
- `src/server/db/schema/billing.ts`：billing 相关表
- `src/server/creem/*`：Creem API、签名校验、仓库/服务
- `src/app/api/creem/*`：checkout 与 webhook 路由
- `src/app/api/billing/status/route.ts`：站内订阅状态接口
- `src/app/pricing/page.tsx`、`src/app/billing/success/page.tsx`：前端入口与回跳页
- `src/components/auth/user-account-menu.tsx`：账号菜单增加订阅入口
- `scripts/creem-*.test.ts`：路由与签名测试

## 实施顺序

1. 先写 failing tests，锁住 checkout、return 签名和 webhook 行为。
2. 增加 billing schema 与 env，保证服务端有持久化与配置入口。
3. 实现 Creem 服务层与 API 路由。
4. 接 `/pricing`、成功页和账号入口。
5. 跑 `pnpm ts-check`、相关脚本测试、`pnpm build`，最后推库时再执行 `pnpm db:push`。
