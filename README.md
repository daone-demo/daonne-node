# Daone Vercel Node API

这是适配 Vercel 的 Node.js Serverless 后端实现。代码按原 Java 项目的基本思想组织，但符合 Vercel 项目规范。

## Structure

- `api/[...path].js`: Vercel Serverless 函数入口。
- `src/starter`: 应用启动、路由注册、OpenAPI。
- `src/service`: 业务服务，按 `auth`、`user`、`creation`、`billing`、`operation` 划分。
- `src/infrastructure`: 配置、内存仓储、ID、MySQL/Redis/OSS/短信/模型/支付等基础设施适配。
- `tests`: 接口级自动化测试。

## Local Run

```bash
export PATH="$HOME/.local/opt/node-20/bin:$PATH"
npm install
npm test
npm start
```

本地服务地址：

- Health: `http://localhost:8080/api/health`
- OpenAPI: `http://localhost:8080/api/v3/swagger`
- Swagger UI: `http://localhost:8080/api/doc.html`

## Vercel Deploy

在 Vercel 导入仓库时，Root Directory 必须选择 `nodejs`（或本仓库根目录，视 monorepo 结构而定）。

### 推荐项目设置

| 配置项 | 值 |
|--------|-----|
| Framework Preset | `Other` |
| Build Command | `npm run build`（自动按 `VERCEL_ENV` 选 profile） |
| Output Directory | 留空 |
| Node.js Version | `22.x` |
| Production Branch | `main` |

### test / prod 环境区分

构建脚本 `scripts/vercel-build.mjs` 会按以下规则选择 `DAONE_PROFILE`：

| 场景 | `VERCEL_ENV` | profile | 配置文件 |
|------|--------------|---------|----------|
| `main` 分支生产部署 | `production` | `prod` | `config/application.prod.env` + Vercel Production 环境变量 |
| `test` 分支 / PR 预览部署 | `preview` | `test` | `config/application.test.env` + Vercel Preview 环境变量 |
| 本地显式指定 | — | 由 `DAONE_PROFILE` 决定 | — |

也可在本地或 CI 中显式执行：

```bash
npm run build:test   # 强制 test profile
npm run build:prod   # 强制 prod profile
```

### 域名与分支建议（单项目）

- `main` → Production → `api.daoneai.com`
- `test` → Preview（可绑定 `api-test.daoneai.com`）

在 Vercel **Settings → Domains** 将 `api-test.daoneai.com` 绑定到 `test` 分支的 Preview 部署。

### 环境变量

- 非敏感默认值：`config/application.{local,test,prod}.env`
- 敏感配置：Vercel 控制台按 **Production / Preview** 分别配置（推荐），或本地 `.env.{profile}.local`
- Preview 与 Production 应使用**不同的** Postgres、Redis 等中间件实例

部署后接口前缀：

```text
https://api.daoneai.com/api/v1          # 生产
https://api-test.daoneai.com/api/v1     # 测试
```

## Environment Profiles

Node.js 版本使用轻量 `.env` 文件区分环境，作用类似 Java 的 `application-local.yml`、`application-test.yml`、`application-prod.yml`。

- `config/application.local.env`: 本地环境。默认使用内存数据和 Mock Redis、OSS、短信、模型、内容安全、支付。
- `config/application.test.env.example`: 测试环境模板。用于 Vercel Preview/Test，默认使用 Postgres/Neon，填写真实 Redis、OSS、支付等配置。
- `config/application.prod.env.example`: 生产环境模板。用于 Vercel Production，默认使用 Postgres/Neon，填写真实 Redis、OSS、支付等配置。
- `.env.vercel.example`: Vercel 控制台环境变量总模板。

环境识别规则：

- Vercel Production 自动识别为 `prod`。
- Vercel Preview 自动识别为 `test`。
- 显式配置 `DAONE_PROFILE=local|test|prod` 仅在非 Vercel 环境优先使用。
- 本地默认识别为 `local`。

健康检查会返回当前环境和 mock 开关：

```bash
curl http://localhost:8080/api/health
```

测试/生产如果缺少关键真实中间件配置，`ready=false`，`missingRequired` 会列出缺失变量名，
`middleware` 会列出当前启用的真实中间件能力，方便部署后排查。

也可以在本地直接检查配置：

```bash
npm run config:local
npm run config:test
npm run config:prod
```

如需在 CI 中强制测试/生产配置完整，可加：

```bash
DAONE_CONFIG_STRICT=true npm run config:prod
```

## Current Scope

当前 Node 版本已覆盖这些接口能力：

- 短信登录、微信扫码占位、退出登录。
- 试用申请短信验证码和试用订单。
- 用户资料、积分账户、积分流水。
- 首页最近项目、灵感分类和灵感内容。
- 项目、画布、历史版本、项目分享。
- 素材上传凭证、Mock 上传、素材列表、收藏。
- AI 能力、积分预估、提示词翻译、生成任务。
- AI 对话、工作流。
- 套餐、订单、微信/支付宝支付、本地支付成功模拟。
- 管理端用户、订单、套餐、模型、提示词、灵感内容维护。

## Important Notes

Vercel Serverless 函数不是长驻应用。local Profile 固定使用内存仓储和 Mock 外部能力，适合前后端联调和部署验证。

`test`/`prod` Profile 会启用真实中间件适配：

- Redis 存储短信验证码和登录 token。
- Postgres/Neon `daone_runtime_store` 保存 Node 运行态快照；仍保留 MySQL 兼容分支，可通过 `DAONE_DB_TYPE=mysql|postgres` 选择。
- OSS PUT 预签名上传。
- 阿里云短信发送验证码。
- 内容安全、模型服务通过 HTTP Provider 调用。
- 微信 Native 支付和支付宝 Page Pay 创建支付。

MySQL 与 Vercel Postgres 的运行态快照可通过脚本同步：

```bash
npm run db:sync -- mysql-to-postgres
npm run db:sync -- postgres-to-mysql
```

高并发生产前建议继续替换：

- Database runtime snapshot -> 表级 Repository 和事务边界。
- 通用内容安全 Provider -> 正式内容安全 SDK 或公司内部风控服务。
- 模型 HTTP Provider -> 统一模型网关、任务回调和重试补偿。

这些替换应优先收敛在 `src/infrastructure`，尽量不改变 `/api/v1` 接口契约。
# daone-nodejs
