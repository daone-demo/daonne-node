# HTTP 接口与前端功能位置梳理

> 梳理依据：`src/starter/app.js` 当前实际注册路由、`docs/api_doc/前后端接口定义完整版.md`、`agent.md` 中记录的前端原型入口。  
> 备注：`https://dev.daoneai.com/` 当前未登录访问返回 401，本表的前端位置来自仓库内文档与原型观察记录；标注“推断”的位置建议前端联调时再核对一次。

## C 端产品接口

| 模块 | HTTP 接口 | 接口用途 | 对应前端功能位置 |
|---|---|---|---|
| 认证 | `POST /api/v1/auth/sms-codes` | 发送用户登录短信验证码。 | 登录/注册弹窗 - 手机号验证码登录。 |
| 认证 | `POST /api/v1/auth/sms-login` | 使用手机号和验证码登录，返回 token 与用户信息。 | 登录/注册弹窗 - 手机号验证码登录提交。 |
| 认证 | `POST /api/v1/auth/wechat/qr-sessions` | 创建微信扫码登录会话，返回二维码授权地址。 | 登录/注册弹窗 - 微信扫码登录。 |
| 认证 | `GET /api/v1/auth/wechat/qr-sessions/:ticket` | 轮询微信扫码状态，扫码成功后返回登录态。 | 登录/注册弹窗 - 微信二维码轮询。 |
| 认证 | `POST /api/v1/auth/logout` | 当前用户退出登录，使 token 失效。 | 用户头像菜单/个人中心 - 退出登录。 |
| 首页 | `GET /api/v1/home` | 获取首页聚合数据：最近项目、灵感分类、灵感内容。 | 首页 - 最近项目、灵感发现分类与内容流。 |
| 用户 | `GET /api/v1/users/me` | 获取当前用户资料、订阅、积分概览。 | 用户页/个人中心、顶部用户信息、会员状态展示。 |
| 用户 | `PATCH /api/v1/users/me` | 修改昵称、头像、邮箱、性别、生日等个人资料。 | 用户页/个人中心 - 编辑资料。 |
| 积分 | `GET /api/v1/points/account` | 查询积分账户余额、冻结积分、累计发放积分。 | 顶部积分入口、用户页/积分概览、生成前余额展示。 |
| 积分 | `GET /api/v1/points/ledger` | 分页查询积分流水，可按增加/减少筛选。 | 用户页/积分日志 - 全部、增加、减少筛选。 |
| 积分 | `GET /api/v1/points/ledger/:ledgerId` | 查询单条积分流水详情，包括关联任务、模型、失败原因等。 | 用户页/积分日志 - 详情按钮。 |
| 项目 | `POST /api/v1/projects` | 创建新项目。 | 首页“新建/创建项目”、画布页项目切换的新建项目。 |
| 项目 | `GET /api/v1/projects` | 分页搜索当前用户项目列表。 | 首页最近项目、项目切换器、我的项目页；文档提示左侧“项目”当前实际更像素材页。 |
| 项目 | `GET /api/v1/projects/:projectId` | 获取项目标题、封面、revision、创建/更新时间。 | 项目详情、画布页打开项目时的项目基础信息。 |
| 项目 | `PATCH /api/v1/projects/:projectId` | 修改项目标题或封面。 | 项目卡片重命名/封面更新、画布页项目名称编辑。 |
| 项目 | `DELETE /api/v1/projects/:projectId` | 逻辑删除项目。 | 项目列表/最近项目 - 删除项目。 |
| 画布 | `GET /api/v1/projects/:projectId/canvas` | 获取项目当前画布 JSON 与 revision。 | 画布页 - 进入编辑器时加载画布。 |
| 画布 | `PUT /api/v1/projects/:projectId/canvas` | 保存当前画布，支持自动保存和手动保存，revision 冲突返回 409。 | 画布页 - 自动保存、手动保存、已保存状态。 |
| 画布版本 | `GET /api/v1/projects/:projectId/versions` | 查询手动画布历史版本列表。 | 画布页 - 历史版本/版本列表。 |
| 画布版本 | `GET /api/v1/projects/:projectId/versions/:versionId` | 获取某个历史版本的画布内容。 | 画布页 - 查看历史版本。 |
| 画布版本 | `POST /api/v1/projects/:projectId/versions/:versionId/restore` | 将历史版本恢复为当前画布并生成新版本。 | 画布页 - 恢复历史版本。 |
| 分享 | `POST /api/v1/projects/:projectId/shares` | 创建项目只读分享链接。 | 画布页/项目操作菜单 - 分享。 |
| 分享 | `GET /api/v1/shares/:shareCode` | 公开访问分享内容，返回项目标题、只读画布、素材预览地址。 | 分享落地页/外部访问的只读画布页。 |
| 分享 | `DELETE /api/v1/projects/:projectId/shares/:shareCode` | 关闭项目分享链接。 | 画布页/项目操作菜单 - 取消分享/关闭分享。 |
| 素材 | `POST /api/v1/assets/upload-tickets` | 申请 OSS 或本地 mock 上传凭证。 | 画布页上传图片/视频/文件、素材页上传入口、聊天附件上传前置步骤。 |
| 素材 | `POST /api/v1/assets` | 文件上传完成后确认入库并触发/记录内容安全状态。 | 画布页上传完成、素材页上传完成、聊天附件上传完成。 |
| 素材 | `GET /api/v1/assets` | 查询素材列表，支持 scope/type/source/keyword/projectId 筛选。 | 项目/素材页 - 智能推荐、素材中心、我的素材、我的收藏、我的文件；画布页素材面板。 |
| 素材 | `GET /api/v1/assets/:assetId` | 获取素材元数据、预览地址、下载地址。 | 素材详情弹窗、画布节点预览、单个素材下载。 |
| 素材 | `PUT /api/v1/assets/:assetId/favorite` | 收藏素材。 | 素材卡片/素材详情 - 收藏。 |
| 素材 | `DELETE /api/v1/assets/:assetId/favorite` | 取消收藏素材。 | 我的收藏、素材卡片/素材详情 - 取消收藏。 |
| 素材 | `DELETE /api/v1/assets/:assetId` | 逻辑删除素材。 | 我的素材/我的文件 - 删除素材。 |
| AI 能力 | `GET /api/v1/ai/capabilities` | 获取可用模型/能力、参数 schema、默认积分规则。 | 画布页右侧面板 - Models/模型选择、生成参数面板。 |
| AI 能力 | `GET /api/v1/ai/skills` | 获取可用技能列表。 | 画布页右侧聊天面板 - Skills/技能选择。 |
| AI 能力 | `POST /api/v1/ai/point-estimates` | 根据能力和参数预估本次生成消耗积分。 | 画布页生成按钮旁的积分预估、生成确认前提示。 |
| AI 能力 | `POST /api/v1/ai/prompt-translations` | 将提示词翻译为目标语言。 | 画布页/聊天面板 - 提示词翻译或英文优化。 |
| 生成任务 | `POST /api/v1/generation-tasks` | 创建文本/图片/视频生成任务，冻结或预扣积分。 | 画布页 - 生成图片/视频/文本节点，聊天面板触发生成。 |
| 生成任务 | `GET /api/v1/generation-tasks` | 查询任务列表，支持项目、状态、类型、关键词、日期筛选。 | 画布页 - 历史记录，恢复运行中任务。 |
| 生成任务 | `GET /api/v1/generation-tasks/:taskId` | 轮询任务进度、结果素材、失败原因。 | 画布页 - 生成中进度条/结果回填；前端建议约 2 秒轮询。 |
| 生成任务 | `POST /api/v1/generation-tasks/:taskId/cancel` | 取消排队中或可取消的运行中生成任务。 | 画布页 - 生成任务卡片取消按钮。 |
| 模型网关 | `POST /api/v1/provider/chat/completions` | 后端代理 302.AI OpenAI 兼容聊天接口；支持 `stream=true`，SSE 直接透传，前端不接触 API Key。 | 画布页右侧聊天面板、智能体/Codex skill 提取等需要 ChatGPT SSE 的入口。 |
| 模型网关 | `POST /api/v1/provider/images/generations` | 后端代理 302.AI OpenAI 兼容图片生成接口；支持 `image2.0` 和 `Nanobanana 2.0` 模型别名，支持流式图片事件透传。 | 画布页 - 图片生成节点、图片创作面板。 |
| 模型网关 | `GET /api/v1/provider/tools` | 返回后端白名单小工具及当前是否配置真实 302 endpoint。 | 前端启动时判断抠图、擦除、扩图、放大等工具入口是否可用。 |
| 模型网关 | `POST /api/v1/provider/tools/:toolCode` | 后端代理白名单小工具调用，真实 endpoint 由环境变量配置，避免开放代理。 | 画布页/素材详情 - 抠图、物体擦除、图片扩展、图片放大、图片转 3D、反推提示词、商品图替换、姿态变换、画质增强。 |
| AI 对话 | `POST /api/v1/chat-sessions` | 创建 AI 对话会话，可绑定项目。 | 画布页右侧聊天面板 - 新建对话。 |
| AI 对话 | `GET /api/v1/chat-sessions` | 查询对话会话列表，可按项目筛选。 | 画布页右侧面板 - 对话历史。 |
| AI 对话 | `GET /api/v1/chat-sessions/:sessionId/messages` | 查询某个会话的消息列表。 | 画布页右侧聊天面板 - 打开历史对话。 |
| AI 对话 | `POST /api/v1/chat-sessions/:sessionId/messages` | 发送用户消息，可能返回助手消息并创建生成任务。 | 画布页右侧聊天面板 - 发送消息/带附件生成。 |
| AI 对话 | `DELETE /api/v1/chat-sessions/:sessionId` | 删除对话会话，不删除已生成素材。 | 画布页右侧聊天面板 - 删除历史对话。 |
| 工作流 | `POST /api/v1/workflows` | 保存用户工作流。 | 画布页 - 工作流面板/保存为工作流。 |
| 工作流 | `GET /api/v1/workflows` | 分页搜索工作流列表。 | 画布页 - 工作流列表/选择工作流。 |
| 工作流 | `GET /api/v1/workflows/:workflowId` | 获取工作流详情与 flowData。 | 画布页 - 打开工作流详情/预览工作流。 |
| 工作流 | `PUT /api/v1/workflows/:workflowId` | 修改工作流名称、描述、封面、数据。 | 画布页 - 编辑/更新工作流。 |
| 工作流 | `DELETE /api/v1/workflows/:workflowId` | 删除工作流。 | 画布页 - 工作流列表删除。 |
| 工作流 | `POST /api/v1/workflows/:workflowId/projects` | 基于工作流创建新项目。 | 画布页/工作流面板 - 使用工作流创建项目。 |
| 会员套餐 | `GET /api/v1/plans` | 获取可购买套餐与价格：团队协作版、团队 Plus、团队 Max、企业版、试用版等。 | 会员弹窗/升级套餐/顶部“充值”入口；文档建议若无独立积分商品，“充值”应改为“升级套餐”。 |
| 试用申请 | `POST /api/v1/trial-applications/sms-codes` | 发送试用申请短信验证码。 | 会员弹窗 - 申请试用表单。 |
| 试用申请 | `POST /api/v1/trial-applications` | 提交试用申请，创建或复用手机号用户，并生成试用订单。 | 会员弹窗 - 申请试用提交。 |
| 订单 | `POST /api/v1/orders` | 创建套餐订单，要求 `Idempotency-Key`。 | 会员弹窗 - 选择套餐后创建订单。 |
| 订单 | `GET /api/v1/orders` | 查询当前用户订单列表，可按状态筛选。 | 用户页/账单页 - 订单记录。 |
| 订单 | `GET /api/v1/orders/:orderNo` | 查询订单详情和支付状态。 | 支付页/支付弹窗轮询订单状态、账单详情。 |
| 支付 | `POST /api/v1/orders/:orderNo/payments` | 创建微信 Native 或支付宝支付参数。 | 支付弹窗 - 选择微信/支付宝后展示二维码或跳转支付。 |
| 支付 | `POST /api/v1/subscriptions/cancel-auto-renew` | 取消订阅自动续费标记。 | 用户页/会员订阅页 - 取消自动续费。 |

## 管理端接口

| 模块 | HTTP 接口 | 接口用途 | 对应前端功能位置 |
|---|---|---|---|
| 管理认证 | `POST /api/admin/v1/sms-codes` | 发送管理员登录短信验证码。 | 管理后台登录页 - 管理员验证码登录。 |
| 管理认证 | `POST /api/admin/v1/sms-login` | 管理员短信登录，返回管理员 token。 | 管理后台登录页 - 登录提交。 |
| 用户管理 | `GET /api/admin/v1/users` | 后台分页查询用户列表。 | 管理后台 - 用户管理。 |
| 用户管理 | `PATCH /api/admin/v1/users/:userId/status` | 修改用户启用/禁用等状态。 | 管理后台 - 用户管理 - 状态操作。 |
| 用户管理 | `POST /api/admin/v1/users/:userId/point-adjustments` | 人工增减用户积分，并记录原因。 | 管理后台 - 用户管理/积分管理 - 人工调账。 |
| 订单管理 | `GET /api/admin/v1/orders` | 后台分页查询订单，可按状态筛选。 | 管理后台 - 订单管理。 |
| 套餐管理 | `GET /api/admin/v1/plans` | 查询后台套餐配置列表。 | 管理后台 - 套餐管理。 |
| 套餐管理 | `POST /api/admin/v1/plans` | 创建套餐及价格配置。 | 管理后台 - 套餐管理 - 新建套餐。 |
| 套餐管理 | `PUT /api/admin/v1/plans/:planCode` | 修改已有套餐及价格配置。 | 管理后台 - 套餐管理 - 编辑套餐。 |
| 套餐管理 | `PATCH /api/admin/v1/plans/:planCode/status` | 启用或禁用套餐。 | 管理后台 - 套餐管理 - 上下架/状态开关。 |
| 模型管理 | `GET /api/admin/v1/model-configs` | 查询模型配置、参数和积分规则。 | 管理后台 - 模型配置。 |
| 模型管理 | `PUT /api/admin/v1/model-configs/:modelCode` | 修改模型参数、基础积分等配置。 | 管理后台 - 模型配置 - 编辑模型。 |
| 模型管理 | `PATCH /api/admin/v1/model-configs/:modelCode/status` | 启用或禁用模型。 | 管理后台 - 模型配置 - 状态开关。 |
| 提示词模板 | `GET /api/admin/v1/prompt-templates` | 查询提示词模板列表。 | 管理后台 - 提示词模板。 |
| 提示词模板 | `POST /api/admin/v1/prompt-templates` | 创建提示词模板。 | 管理后台 - 提示词模板 - 新建。 |
| 提示词模板 | `PUT /api/admin/v1/prompt-templates/:code` | 修改提示词模板。 | 管理后台 - 提示词模板 - 编辑。 |
| 灵感运营 | `GET /api/admin/v1/inspirations` | 查询首页灵感内容列表。 | 管理后台 - 首页灵感/内容运营。 |
| 灵感运营 | `POST /api/admin/v1/inspirations` | 创建首页灵感内容。 | 管理后台 - 首页灵感 - 新建。 |
| 灵感运营 | `PUT /api/admin/v1/inspirations/:id` | 修改首页灵感内容。 | 管理后台 - 首页灵感 - 编辑。 |

## 支付回调、联调与运维接口

| 模块 | HTTP 接口 | 接口用途 | 对应前端功能位置 |
|---|---|---|---|
| 支付回调 | `POST /api/v1/payments/:payType/notify` | 微信/支付宝服务端异步通知，验签、校验金额并激活订阅/发放积分。 | 非前端调用；由支付平台回调，前端只轮询订单状态。 |
| 本地支付 | `POST /api/v1/orders/:orderNo/mock-paid` | 本地/mock 环境模拟支付成功。 | 非正式前端功能；本地联调支付流程使用。 |
| Mock 文件 | `POST /api/mock-files/upload` | 本地 mock 文件上传接收接口，仅 mock storage 开启时可用。 | 非正式前端功能；本地上传联调由上传组件调用。 |
| Mock 文件 | `GET /api/mock-files/:objectKey` | 本地 mock 文件读取接口，仅 mock storage 开启时可用。 | 非正式前端功能；本地预览素材时由浏览器加载。 |
| 接口文档 | `GET /api/v3/swagger` | 返回 OpenAPI JSON。 | 开发/联调 - 接口文档。 |
| 接口文档 | `GET /api/doc.html` | Swagger UI 页面。 | 开发/联调 - 接口文档页面。 |
| 接口文档 | `GET /api/swagger-ui.html` | Swagger UI 页面别名。 | 开发/联调 - 接口文档页面。 |
| 健康检查 | `GET /api/health` | 返回运行环境、配置完整性、中间件健康状态。 | 运维/部署健康检查；非业务前端页面。 |

## 需要前端注意的未闭环入口

| 前端入口/文案 | 当前后端状态 | 建议 |
|---|---|---|
| 通知 | 未定义通知接口。 | 一期隐藏或展示“暂未开放”。 |
| 开票 | 未定义电子发票接口。 | 账单页开票按钮隐藏或置灰。 |
| 品牌制作 | 未看到对应后端闭环。 | 另立需求或暂时置灰。 |
| 批量下载/画布 ZIP 导出 | 当前只有素材详情里的单个下载地址。 | 一期只支持单素材下载。 |
| 画布协作、成员管理、无限并发 | 套餐文案提到，但后端未实现协作/成员接口。 | 正式上线前调整套餐文案或补接口。 |
| 技能创建、`.md skill` 导入 | 普通用户侧未开放创建接口。 | 一期隐藏，只展示后台配置好的技能。 |
| 密码登录/修改密码 | 系统一期没有密码登录。 | 编辑资料里的密码字段删除或隐藏。 |
