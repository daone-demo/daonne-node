# Daone 项目导览

这份文档面向第一次接触项目的人，用来快速理解当前仓库每个模块在做什么、业务能力覆盖到哪里，以及已经使用了哪些技术栈。

## 1. 项目定位

Daone 当前仓库是一个适配 Vercel Serverless 的 Node.js 后端 API 项目，服务对象是一个“AI 视觉创作 / 电商视觉设计”平台。

核心业务包括：

- 用户登录、会话、个人资料和积分账户。
- 首页灵感内容、最近项目和内容分类。
- 创作项目、画布数据、历史版本、项目分享。
- 图片 / 视频素材上传、素材库、收藏、内容安全审核。
- AI 文本、图片、视频生成任务，以及模型网关透传接口。
- AI 对话会话。
- 工作流保存、复用，并可从工作流创建项目。
- 套餐、订单、微信 / 支付宝支付、订阅和积分发放。
- 管理后台：用户、订单、套餐、模型、提示词、灵感、分类、工作流、开票等运营管理。

当前实现不是 Java/Spring Boot 项目。`docs/technical_solution/后端技术方案.md` 中有一期 Java 单体方案背景，但当前可运行代码是 Node.js ESM + Vercel Serverless。

## 2. 顶层目录

| 目录 / 文件 | 作用 |
|---|---|
| `api/` | Vercel Serverless 函数入口。把线上请求转发到统一应用处理器。 |
| `src/starter/` | 应用启动层，负责注册路由、统一请求处理、OpenAPI / Swagger 输出、健康检查。 |
| `src/service/` | 业务服务层，按业务域组织登录、用户、创作、计费、首页、后台等能力。 |
| `src/infrastructure/` | 基础设施层，包含配置、内存数据仓库、ID、Redis、MySQL、Postgres、短信、模型、支付、内容安全等适配。 |
| `scripts/` | 本地启动、配置检查、Vercel 构建检查、运行态数据同步脚本。 |
| `tests/` | Node 内置测试框架写的接口级自动化测试。 |
| `config/` | 不同环境配置文件：local / test / prod。 |
| `docs/` | 需求、接口、SQL、技术方案文档。 |
| `public/` | Vercel 静态首页，占位显示 API 正在运行。 |
| `vercel.json` | Vercel 函数时长与 `/api/:path*` rewrite 配置。 |
| `package.json` | Node 项目元信息、脚本、依赖和 Node 版本声明。 |

## 3. 请求入口与运行链路

### 3.1 Vercel 入口

- `api/[...path].js`：Vercel catch-all API 入口，直接调用 `src/starter/app.js` 的 `handleRequest`。
- `api/index.js`：配合 `vercel.json` 的 rewrite，把 `/api/:path*` 转成 `__daone_path` 后再交给同一个处理器。
- `api/v3/swagger.js`：Swagger / OpenAPI 入口，同样复用统一处理器。

### 3.2 应用入口

`src/starter/app.js` 是当前项目最重要的入口文件，主要职责是：

- 创建并注册所有 HTTP 路由。
- 统一解析 JSON 请求体、分页参数、Bearer Token。
- 处理 CORS。
- 对普通接口做登录校验，对管理后台接口做 `role=ADMIN` 校验。
- 按统一格式返回成功 / 分页 / 错误响应。
- 在非本地环境对运行态 store 做 hydrate / persist。
- 提供健康检查、OpenAPI JSON 和 Swagger UI。

### 3.3 本地服务

- `scripts/local-server.mjs`：使用 Node `http` 模块启动本地服务，默认端口 `8080`。
- 常用命令：
  - `npm install`
  - `npm test`
  - `npm start`

## 4. 业务模块

### 4.1 `src/service/auth`

认证模块，负责用户和管理员登录。

主要能力：

- 发送短信验证码。
- 普通用户短信登录。
- 管理员短信登录。
- 退出登录。
- Bearer Token 解析和用户恢复。
- 微信扫码登录占位接口。

实现特点：

- 本地环境默认使用固定验证码 `123456`。
- Token 形如 `dn_xxx`。
- 本地或未启用 Redis 时，验证码和 token 存在内存 store；启用 Redis 时走 `redisCache`。
- 管理员手机号由 `DAONE_ADMIN_PHONES` 配置决定。

### 4.2 `src/service/user`

用户中心模块，负责个人资料和积分。

主要能力：

- 获取当前用户资料。
- 修改昵称、邮箱、性别、生日、头像。
- 查询积分账户。
- 查询积分流水和流水详情。

涉及数据：

- 用户基础信息。
- 订阅信息。
- 积分账户：可用积分、冻结积分、累计发放积分。
- 积分流水：充值、消耗等。

### 4.3 `src/service/home`

首页模块，负责前台首页聚合数据。

主要能力：

- 返回用户最近项目。
- 返回灵感分类。
- 返回灵感内容列表。

说明：

- 未登录用户也可以访问首页。
- 登录用户会额外返回最近项目。
- 灵感内容来自内存 store 中的 seed 数据或持久化快照。

### 4.4 `src/service/creation/projectService.js`

项目与画布模块，是创作业务的核心。

主要能力：

- 创建、查询、更新、删除项目。
- 获取和保存画布。
- 管理画布 revision，避免覆盖冲突。
- 手动保存时生成历史版本。
- 查询历史版本和恢复版本。

画布数据格式：

- 当前标准格式是 `version: 1` 的 canvas snapshot。
- 兼容 X6 graph 格式：`{ cells: [...] }`。
- 兼容旧格式：`nodes / edges / schemaVersion`。
- 会记录 viewport、meta、graph 和节点 / 连线统计 summary。

### 4.5 `src/service/creation/assetService.js`

素材模块，负责图片 / 视频上传和素材库。

主要能力：

- 创建上传凭证。
- 本地 mock 上传。
- 完成上传并创建素材记录。
- 内容安全审核。
- 素材列表、详情、收藏、取消收藏、删除。

实现特点：

- 只支持 `image/*` 和 `video/*`。
- 本地环境默认使用 `/api/mock-files/upload` 和 mock SVG 预览。
- 生产可走 OSS PUT 预签名 URL。
- 上传完成后会调用内容安全 client；本地默认 mock。

### 4.6 `src/service/creation/aiService.js`

AI 生成任务模块，负责平台内部 AI 能力和积分扣减。

主要能力：

- 查询 AI capabilities。
- 查询 AI skills。
- 估算积分消耗。
- 提示词翻译占位。
- 创建生成任务。
- 查询 / 筛选 / 取消生成任务。

实现特点：

- 生成任务要求 `Idempotency-Key`，避免重复创建。
- 会校验项目和引用素材权限。
- 会按模型配置估算积分，并检查积分余额。
- 本地 mock 模式下任务直接成功，并生成 mock 结果素材。
- 非 mock 模式下通过 `infrastructure/middleware/modelClient.js` 调模型服务。

### 4.7 `src/service/creation/chatService.js`

AI 对话模块，负责项目内或独立聊天会话。

主要能力：

- 创建聊天会话。
- 查询会话列表。
- 查询消息列表。
- 发送消息。
- 删除会话。

当前实现说明：

- 当前 assistant 回复是 mock 文本：`已收到：...`。
- 支持消息附件素材校验。
- 尚未真正接入大模型对话编排；模型透传能力在 `modelClient` 和 provider 路由里。

### 4.8 `src/service/creation/workflowService.js`

工作流模块，负责用户自定义工作流保存与复用。

主要能力：

- 创建、查询、更新、删除工作流。
- 保存 `workflowData`。
- 从工作流创建项目，并把工作流数据写入新项目画布。

用途：

- 用户可以把一组画布节点 / 流程保存为模板。
- 后续可用工作流快速生成项目。

### 4.9 `src/service/creation/shareService.js`

项目分享模块。

主要能力：

- 为项目创建分享链接。
- 根据分享码公开读取项目和画布。
- 删除分享。
- 支持可选过期天数。

说明：

- 分享读取接口是公开接口。
- 分享会校验项目是否仍然存在且分享未过期。

### 4.10 `src/service/billing`

计费模块，包含套餐、订单、支付、订阅、试用申请和积分发放。

主要能力：

- 查询套餐价格。
- 创建套餐订单。
- 创建微信 / 支付宝支付。
- 本地支付成功模拟。
- 支付回调通知。
- 支付成功后发放订阅和积分。
- 取消自动续费标记。
- 试用申请短信验证码和试用订单。

实现特点：

- 订单创建和生成任务一样要求 `Idempotency-Key`。
- 一期只支持 `orderType=PLAN`。
- 支付渠道支持 `WECHAT` 和 `ALIPAY`。
- 本地 mock 支付时可通过 `/mock-paid` 直接完成订单。

### 4.11 `src/service/admin`

管理后台模块，负责运营侧 API。

主要能力：

- 首页 dashboard 聚合。
- 用户列表、用户详情、禁用 / 启用用户、积分调整。
- 订单列表和详情。
- 套餐、价格配置管理。
- 模型配置管理。
- 提示词模板管理。
- 灵感内容管理。
- 分类管理。
- 后台工作流模板管理。
- 开票申请管理。
- 写操作审计日志。

接口前缀：

- `/api/admin/v1/...`

鉴权要求：

- 必须登录。
- 当前用户 `role` 必须是 `ADMIN`。

### 4.12 `src/service/operation`

旧版 / 备用后台服务模块。

说明：

- 文件名也是 `adminService.js`，但当前 `src/starter/app.js` 实际引用的是 `src/service/admin/adminService.js`。
- 可以把它理解为早期较简化的运营后台实现，目前不是主路由使用的模块。

### 4.13 `src/service/common`

业务公共模块。

主要文件：

- `router.js`：轻量路由器，支持 HTTP method、路径参数和 route options。
- `http.js`：读取 JSON、分页参数、分页切片、必填校验。
- `response.js`：统一响应结构、分页响应、错误响应、trace id。
- `errors.js`：业务错误构造函数，如 badRequest、unauthorized、forbidden、notFound、conflict、badGateway。

## 5. 基础设施模块

### 5.1 `src/infrastructure/config/env.js`

配置中心。

主要职责：

- 根据 `DAONE_PROFILE` 或 Vercel 环境识别 `local / test / prod`。
- 依次加载：
  - `config/application.{profile}.env`
  - `.env.{profile}`
  - `.env.{profile}.local`
  - `.env`
- 汇总 auth、数据库、Redis、短信、存储、模型、内容安全、支付、阿里云等配置。
- 提供 `configHealth()` 给 `/api/health` 使用。
- 检查非本地环境缺失的关键配置。

### 5.2 `src/infrastructure/db/memoryStore.js`

内存数据仓库。

主要职责：

- 用 `Map` / `Set` 保存用户、短信码、token、项目、画布、素材、生成任务、订单、后台运营内容等数据。
- 使用 `globalThis.__DAONE_STORE__` 在同一 Node 进程内复用数据。
- 提供 seed 数据：套餐、价格、模型、灵感、后台工作流模板、分类、模板素材等。
- 支持导出 / 导入快照，用于 serverless 非长驻环境下的运行态持久化。

注意：

- local profile 主要依赖内存 store。
- test / prod 可以通过 Postgres 或 MySQL runtime store 保存快照，但它还不是细粒度 repository 模式。

### 5.3 `src/infrastructure/common/id.js`

ID 和订单号生成。

主要职责：

- 生成递增 ID。
- 生成订单号。
- 在导入快照后同步 ID sequence，避免重复。

### 5.4 `src/infrastructure/middleware/redisCache.js`

Redis 缓存适配。

主要职责：

- 管理 Redis 连接。
- 提供 `cacheGet`、`cacheSetJson`、`cacheGetJson`、`cacheDel`。
- 提供 Redis 健康检查。

主要用途：

- 短信验证码。
- 登录 token。

### 5.5 Runtime Store：MySQL / Postgres

相关文件：

- `runtimeStore.js`
- `mysqlRuntimeStore.js`
- `postgresRuntimeStore.js`
- `postgresBusinessMirror.js`

主要职责：

- 在 serverless 环境启动时 hydrate 内存 store。
- 写请求后 persist 内存 store。
- 支持 MySQL 或 Postgres 存储运行态快照。
- Postgres 版本还支持用户查找 / 创建，以及业务表 mirror。

设计现状：

- 当前仍是“内存 store + 快照持久化”的过渡架构。
- README 也明确建议高并发生产前替换成表级 Repository 和事务边界。

### 5.6 `src/infrastructure/middleware/smsClient.js`

短信服务适配。

主要职责：

- 本地 mock 短信发送。
- 非 mock 时按阿里云短信 OpenAPI 签名方式发送验证码。

### 5.7 `src/infrastructure/middleware/contentSafetyClient.js`

内容安全适配。

主要职责：

- 对上传素材做审核。
- 本地 mock 直接返回可用状态。
- 非 mock 时走外部内容安全配置。

### 5.8 `src/infrastructure/middleware/modelClient.js`

模型服务适配，是 AI 能力最复杂的基础设施模块。

主要职责：

- 生成任务 provider 调用。
- OpenAI 风格 chat completions 代理。
- 图片生成代理。
- 视频生成代理。
- 流式 SSE 响应转发。
- 模型工具调用，如去背景、擦除、扩图、超分、图生 3D、提示词专家、商品图替换、姿态迁移等。
- 本地 mock chat / image / video 结果。

已支持的外部模型 / provider 概念：

- OpenAI 风格 chat / image API。
- 302.ai 作为默认 OpenAI Base URL。
- Seedance 视频生成。
- Happy Horse / fal 风格视频生成。

### 5.9 `src/infrastructure/middleware/paymentClient.js`

支付适配。

主要职责：

- 本地 mock 支付。
- 微信 Native 支付参数构造。
- 支付宝 Page Pay 参数构造。

说明：

- 实际订单状态流转在 `src/service/billing/billingService.js`。
- 支付通知签名校验由 billing service 处理。

## 6. API 分组

当前路由集中注册在 `src/starter/app.js`。

| 分组 | 前缀 / 代表接口 | 用途 |
|---|---|---|
| 健康检查 | `GET /api/health` | 查看运行环境、mock 状态、数据库健康、缺失配置。 |
| API 文档 | `GET /api/v3/swagger`、`GET /api/doc.html` | OpenAPI JSON 和 Swagger UI。 |
| 认证 | `/api/v1/auth/*` | 短信登录、微信扫码占位、退出。 |
| 管理员认证 | `/api/admin/v1/sms-*` | 管理后台短信登录。 |
| 首页 | `GET /api/v1/home` | 最近项目、灵感分类、灵感内容。 |
| 用户 | `/api/v1/users/me` | 当前用户资料。 |
| 积分 | `/api/v1/points/*` | 积分账户和流水。 |
| 项目 / 画布 | `/api/v1/projects/*` | 项目 CRUD、画布保存、版本恢复、分享。 |
| 分享 | `GET /api/v1/shares/:shareCode` | 公开读取分享项目。 |
| 素材 | `/api/v1/assets/*` | 上传凭证、素材列表、收藏、删除。 |
| AI 能力 | `/api/v1/ai/*` | 能力查询、积分估算、提示词翻译。 |
| 生成任务 | `/api/v1/generation-tasks/*` | 创建、查询、取消 AI 生成任务。 |
| 模型网关 | `/api/v1/provider/*` | chat / image / video / tools 代理。 |
| 对话 | `/api/v1/chat-sessions/*` | 聊天会话和消息。 |
| 工作流 | `/api/v1/workflows/*` | 用户工作流 CRUD 和创建项目。 |
| 计费 | `/api/v1/plans`、`/api/v1/orders/*`、`/api/v1/payments/*` | 套餐、订单、支付、订阅。 |
| 试用 | `/api/v1/trial-applications/*` | 试用申请验证码和申请。 |
| 管理后台 | `/api/admin/v1/*` | 运营管理全部接口。 |
| Mock 文件 | `/api/mock-files/*` | 本地上传和预览 mock。 |

## 7. 已使用技术栈

### 7.1 运行时与语言

- Node.js `22.x`
- JavaScript ESM：`"type": "module"`
- Node 原生模块：
  - `node:http`
  - `node:crypto`
  - `node:fs`
  - `node:url`
  - `node:path`
  - `node:test`

### 7.2 Web / 部署

- Vercel Serverless Functions
- `vercel.json` rewrites
- 自研轻量 Router，没有使用 Express / Koa / Fastify
- OpenAPI / Swagger 文档由 `src/starter/openapi.js` 生成

### 7.3 数据与缓存

- 内存 store：`Map` / `Set`
- Redis：`ioredis`
- MySQL：`mysql2`
- Postgres / Neon：`pg`
- 运行态快照持久化：MySQL 或 Postgres

### 7.4 外部能力

- 阿里云短信。
- 阿里云 OSS PUT 预签名上传。
- 内容安全 HTTP Provider。
- OpenAI 兼容模型 API。
- 302.ai 模型网关配置。
- Seedance 视频生成。
- Happy Horse / fal 风格视频生成。
- 微信支付 Native。
- 支付宝 Page Pay。

### 7.5 测试与校验

- Node 内置测试框架：`node --test`
- 接口级测试：`tests/api.test.mjs`
- 配置检查脚本：`scripts/config-check.mjs`
- Vercel 构建检查脚本：`scripts/vercel-build-check.mjs`

## 8. 环境配置

环境由 `DAONE_PROFILE` 决定：

- `local`：本地开发，默认内存 store 和 mock 外部能力。
- `test`：Vercel Preview / 测试环境，默认 Postgres，外部中间件需要真实配置。
- `prod`：Vercel Production，默认 Postgres，外部中间件需要真实配置。

配置文件：

- `config/application.local.env`
- `config/application.test.env`
- `config/application.prod.env`
- `config/model-provider.local.example.json`

常用检查命令：

```bash
npm run config:local
npm run config:test
npm run config:prod
```

严格检查生产配置：

```bash
DAONE_CONFIG_STRICT=true npm run config:prod
```

## 9. 重要数据对象

当前内存 store 中的核心集合包括：

| Store Key | 业务含义 |
|---|---|
| `users` | 用户账户。 |
| `smsCodes` | 短信验证码。 |
| `tokens` | 登录会话。 |
| `projects` | 创作项目。 |
| `canvases` | 项目画布当前版本。 |
| `versions` | 画布历史版本。 |
| `shares` | 项目分享。 |
| `assets` | 上传 / 生成 / 模板素材。 |
| `favorites` | 素材收藏关系。 |
| `generationTasks` | AI 生成任务。 |
| `chatSessions` / `chatMessages` | AI 对话会话和消息。 |
| `workflows` | 用户工作流和后台工作流模板。 |
| `orders` / `transactions` | 订单和支付交易。 |
| `subscriptions` | 用户订阅。 |
| `pointAccounts` / `pointLedgers` | 积分账户和流水。 |
| `plans` / `prices` | 套餐和价格。 |
| `models` | AI 能力 / 模型配置。 |
| `promptTemplates` | 提示词模板。 |
| `inspirations` | 首页灵感内容。 |
| `contentCategories` | 内容分类。 |
| `invoiceApplications` | 开票申请。 |
| `adminOperationLogs` | 管理后台操作日志。 |

## 10. 当前架构特点与注意事项

1. 当前是轻量 Serverless 后端，不是传统常驻 Node Web 服务。
2. 业务逻辑大多直接操作 `memoryStore`，没有 repository / DAO 抽象。
3. test / prod 通过 runtime snapshot 让 serverless 环境具备运行态持久化能力。
4. 本地开发默认大量使用 mock：短信、存储、模型、内容安全、支付。
5. 管理后台和前台 API 在同一个服务内，通过 `/api/admin/v1` 前缀和 `role=ADMIN` 区分。
6. 生成任务、订单创建等关键写操作使用 `Idempotency-Key` 防重复。
7. 画布保存使用 revision 乐观锁，避免前端旧数据覆盖新数据。
8. 高并发生产前，需要重点改造数据访问层，把内存快照替换为表级 Repository、事务和更细粒度的数据持久化。

## 11. 新人建议阅读顺序

1. `README.md`：了解项目怎么启动、部署和当前覆盖范围。
2. `package.json`：看脚本、Node 版本和依赖。
3. `src/starter/app.js`：看所有接口入口和统一请求处理方式。
4. `src/infrastructure/config/env.js`：理解环境配置和 mock 开关。
5. `src/infrastructure/db/memoryStore.js`：理解当前数据模型和 seed 数据。
6. `src/service/auth/authService.js`：理解登录和 token。
7. `src/service/creation/projectService.js`：理解项目 / 画布核心业务。
8. `src/service/creation/aiService.js` 和 `src/infrastructure/middleware/modelClient.js`：理解 AI 生成和模型网关。
9. `src/service/billing/billingService.js`：理解套餐、订单、支付和积分发放。
10. `src/service/admin/adminService.js`：理解管理后台能力。
11. `tests/api.test.mjs`：通过接口级测试串起完整业务流程。
