export function openApiSpec() {
  return {
    openapi: "3.0.3",
    info: {
      title: "Daone Node API",
      version: "v1",
      description: "Daone Vercel Node.js Serverless 后端接口"
    },
    servers: [{ url: "/api" }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer"
        }
      },
      schemas: {
        ApiResponse: object({
          code: string("OK"),
          message: string("success"),
          data: object({}, "接口返回数据"),
          traceId: string("f3b2c1d0e9a8476b")
        }, "统一响应结构"),
        PageResponse: object({
          records: array(object({}, "分页记录")),
          page: integer(1),
          pageSize: integer(20),
          total: integer(100)
        }, "分页数据"),
        SmsCodeRequest: object({
          phone: string("13800138000", "手机号"),
          scene: string("LOGIN", "验证码场景，登录默认为 LOGIN")
        }, "发送短信验证码请求", ["phone"]),
        SmsLoginRequest: object({
          phone: string("13800138000", "手机号"),
          code: string("123456", "短信验证码")
        }, "短信登录请求", ["phone", "code"]),
        AdminSmsCodeRequest: object({
          phone: string("13800138000", "管理员手机号"),
          scene: string("LOGIN", "使用场景，仅支持登录")
        }, "管理后台发送短信验证码请求", ["phone", "scene"]),
        AdminSmsLoginRequest: object({
          phone: string("13800138000", "管理员手机号"),
          code: string("123456", "短信验证码")
        }, "管理后台短信登录请求", ["phone", "code"]),
        UserProfileUpdateRequest: object({
          nickname: string("Daone 用户", "昵称"),
          avatarUrl: string("https://example.com/avatar.png", "头像 URL")
        }, "修改当前用户资料"),
        ProjectCreateRequest: object({
          title: string("测试项目", "项目标题")
        }, "创建项目请求", ["title"]),
        ProjectUpdateRequest: object({
          title: string("新项目标题", "项目标题")
        }, "修改项目请求"),
        CanvasSaveRequest: object({
          revision: integer(0, "客户端当前画布版本"),
          saveType: string("MANUAL", "保存类型"),
          canvasData: object({
            version: integer(1, "快照版本"),
            savedAt: string("2026-06-22T03:29:02.477Z", "保存时间"),
            meta: object({
              projectId: string("100000000000000001", "项目 ID"),
              projectName: string("未命名创作", "项目名称"),
              canvasBgTheme: string("light", "画布主题"),
              gridVisible: boolean(false, "是否显示网格"),
              panMode: boolean(false, "是否平移模式"),
              showMinimap: boolean(false, "是否显示小地图")
            }, "画布元信息"),
            viewport: object({
              zoom: number(1),
              translateX: number(0),
              translateY: number(0),
              scrollLeft: number(0),
              scrollTop: number(0)
            }, "视口"),
            graph: object({
              cells: array(object({}, "X6 节点/连线"))
            }, "X6 图数据"),
            summary: object({
              nodeCount: integer(0),
              edgeCount: integer(0)
            }, "画布摘要")
          }, "画布快照 JSON 数据")
        }, "保存画布请求", ["revision", "canvasData"]),
        ShareCreateRequest: object({
          expireDays: integer(7, "有效天数")
        }, "创建分享请求"),
        UploadTicketRequest: object({
          projectId: string("100000000000000001", "项目 ID，可选"),
          fileName: string("cover.png", "文件名"),
          contentType: string("image/png", "文件 MIME 类型"),
          fileSize: integer(128, "文件大小，单位字节")
        }, "上传完成后登记素材并返回 OSS URL 请求", ["fileName", "contentType", "fileSize"]),
        AssetCompleteUploadRequest: object({
          projectId: string("100000000000000001", "项目 ID，可选"),
          fileName: string("cover.png", "文件名"),
          contentType: string("image/png", "文件 MIME 类型"),
          fileSize: integer(128, "文件大小，单位字节")
        }, "上传完成后登记素材并返回 OSS URL 请求", ["fileName", "contentType", "fileSize"]),
        PointEstimateRequest: object({
          capabilityCode: string("IMAGE_GENERAL_V1", "AI 能力编码"),
          parameters: object({
            count: integer(2, "生成数量")
          }, "能力参数")
        }, "预估积分请求", ["capabilityCode"]),
        PromptTranslateRequest: object({
          text: string("白底运动鞋", "待翻译提示词"),
          targetLanguage: string("en", "目标语言")
        }, "提示词翻译请求", ["text", "targetLanguage"]),
        GenerationTaskCreateRequest: object({
          projectId: string("100000000000000001", "项目 ID"),
          capabilityCode: string("IMAGE_GENERAL_V1", "AI 能力编码"),
          prompt: string("白底运动鞋", "生成提示词"),
          parameters: object({
            count: integer(2, "生成数量")
          }, "生成参数"),
          assetIds: array(string("100000000000000002"), "参考素材 ID")
        }, "创建生成任务请求", ["projectId", "capabilityCode", "prompt"]),
        ProviderChatCompletionRequest: object({
          model: string("gpt5.5", "模型别名或 302.AI 模型名"),
          messages: array(object({
            role: string("user", "消息角色"),
            content: string("帮我生成商品图提示词", "消息内容")
          }, "聊天消息"), "OpenAI Chat Completions messages"),
          stream: boolean(true, "是否使用 ChatGPT/OpenAI SSE 流式响应")
        }, "模型网关聊天请求", ["messages"]),
        ProviderImageGenerationRequest: object({
          model: string("image2.0", "图片模型别名或 302.AI 模型名"),
          prompt: string("白底运动鞋商品主图", "图片提示词"),
          n: integer(1, "生成数量"),
          size: string("1024x1024", "图片尺寸"),
          stream: boolean(false, "是否透传图片生成 SSE")
        }, "模型网关图片生成请求", ["prompt"]),
        ProviderVideoGenerationRequest: object({
          model: string("seedance2.0", "视频模型：seedance2.0 或 happy-horse"),
          prompt: string("商品鞋在白色摄影棚中旋转展示", "视频提示词"),
          imageUrl: string("https://example.com/product.png", "可选参考图 URL"),
          duration: integer(5, "视频时长，按模型支持范围传递"),
          aspectRatio: string("16:9", "画幅比例"),
          resolution: string("720p", "分辨率"),
          stream: boolean(true, "是否使用 ChatGPT/OpenAI 风格 SSE"),
          providerBody: object({}, "可选：直接按官方平台参数转发")
        }, "视频模型网关请求", ["model", "prompt"]),
        ProviderToolRequest: object({
          imageUrl: string("https://example.com/input.png", "工具输入图片 URL"),
          parameters: object({}, "工具参数，按 302.AI 对应工具文档传递")
        }, "模型网关工具请求"),
        ChatSessionCreateRequest: object({
          projectId: string("100000000000000001", "项目 ID，可选"),
          title: string("新的对话", "对话标题")
        }, "创建对话请求"),
        ChatMessageCreateRequest: object({
          content: string("帮我生成一张白底运动鞋海报", "用户消息内容"),
          assetIds: array(string("100000000000000002"), "附带素材 ID")
        }, "发送对话消息请求", ["content"]),
        WorkflowSaveRequest: object({
          title: string("商品海报工作流", "工作流标题"),
          description: string("生成商品海报的流程", "工作流描述"),
          flowData: object({}, "工作流画布数据")
        }, "保存工作流请求"),
        WorkflowProjectCreateRequest: object({
          title: string("从工作流创建的项目", "项目标题")
        }, "从工作流创建项目请求", ["title"]),
        TrialSmsCodeRequest: object({
          phone: string("13900139000", "手机号")
        }, "发送试用申请短信验证码请求", ["phone"]),
        TrialApplicationRequest: object({
          phone: string("13900139000", "手机号"),
          code: string("123456", "短信验证码"),
          contactName: string("试用客户", "联系人称呼"),
          position: string("运营负责人", "职位")
        }, "提交试用申请请求", ["phone", "code", "contactName", "position"]),
        OrderCreateRequest: object({
          orderType: string("PLAN", "订单类型，一期仅支持 PLAN"),
          productCode: string("TEAM_MONTH", "套餐价格编码")
        }, "创建订单请求", ["orderType", "productCode"]),
        PaymentCreateRequest: object({
          payType: string("WECHAT", "支付方式：WECHAT、ALIPAY")
        }, "创建支付请求", ["payType"]),
        PaymentNotifyRequest: object({
          orderNo: string("DN202606170001", "订单号"),
          amountFen: integer(9900, "支付金额，单位分"),
          currency: string("CNY", "币种"),
          channelTransactionNo: string("WX123456789", "渠道交易号")
        }, "支付回调请求", ["orderNo", "amountFen", "currency"]),
        AdminUserStatusRequest: object({
          status: string("ENABLED", "用户状态")
        }, "修改用户状态请求", ["status"]),
        AdminPointAdjustmentRequest: object({
          amount: integer(100, "调整积分，正数增加，负数扣减"),
          reason: string("运营补偿", "调整原因")
        }, "人工调整积分请求", ["amount", "reason"]),
        AdminPlanSaveRequest: object({
          planCode: string("PRO", "套餐编码"),
          planName: string("专业版", "套餐名称"),
          benefits: array(string("2000积分/月"), "权益说明"),
          prices: array(object({
            priceCode: string("PRO_MONTH", "价格编码"),
            cycleUnit: string("MONTH", "周期单位：DAY、MONTH、YEAR"),
            cycleCount: integer(1, "周期数量"),
            priceFen: integer(9900, "售价，单位分"),
            originalPriceFen: integer(19900, "原价，单位分"),
            grantPoints: integer(2000, "赠送积分")
          }, "价格配置"), "价格列表")
        }, "保存套餐请求", ["planCode", "planName", "prices"]),
        AdminPlanStatusRequest: object({
          status: string("DISABLED", "套餐状态")
        }, "修改套餐状态请求", ["status"]),
        AdminModelConfigRequest: object({
          basePoints: integer(25, "基础积分"),
          parameters: object({
            count: object({
              min: integer(1),
              max: integer(4)
            }, "数量限制")
          }, "模型参数配置")
        }, "修改模型配置请求"),
        AdminModelStatusRequest: object({
          status: string("ENABLED", "模型状态")
        }, "修改模型状态请求", ["status"]),
        AdminPromptTemplateSaveRequest: object({
          code: string("IMAGE_POSTER", "模板编码"),
          name: string("图片海报提示词", "模板名称"),
          scenario: string("IMAGE", "使用场景"),
          content: string("生成一张商业海报", "模板内容")
        }, "保存提示词模板请求", ["name", "content"]),
        AdminInspirationSaveRequest: object({
          title: string("灵感标题", "标题"),
          categoryCode: string("BRAND", "分类编码"),
          coverUrl: string("https://example.com/cover.png", "封面 URL"),
          prompt: string("生成一张品牌海报", "提示词")
        }, "保存灵感请求"),
        AdminWorkflowSaveRequest: object({
          name: string("电商主图批量生成", "工作流名称"),
          description: string("商品图上传、抠图、场景生成与导出", "说明"),
          categoryCode: string("ECOMMERCE", "分类编码"),
          categoryName: string("电商营销", "分类名称"),
          workflowData: object({}, "工作流 JSON")
        }, "保存后台工作流请求", ["name", "workflowData"]),
        AdminCategorySaveRequest: object({
          categoryCode: string("ECOMMERCE", "分类编码"),
          categoryName: string("电商营销", "分类名称"),
          scope: string("ALL", "使用范围：ALL、INSPIRATION、TEMPLATE"),
          sortNo: integer(10, "排序")
        }, "保存分类请求", ["categoryCode", "categoryName"]),
        AdminInvoiceSaveRequest: object({
          userId: string("10001", "用户 ID"),
          orderNo: string("DN20260618001", "订单号"),
          invoiceTitle: string("杭州星图创意有限公司", "发票抬头"),
          taxNo: string("913301********221X", "税号"),
          invoiceType: string("VAT_NORMAL", "发票类型"),
          amountFen: integer(599900, "开票金额，单位分")
        }, "保存开票申请请求", ["userId", "orderNo", "invoiceTitle", "taxNo"]),
        AdminInvoiceStatusRequest: object({
          status: string("ISSUED", "开票状态"),
          rejectReason: string("资料不完整", "驳回原因"),
          expressCompany: string("顺丰", "快递公司"),
          expressNo: string("SF123", "快递单号")
        }, "修改开票状态请求", ["status"])
      }
    },
    security: [{ BearerAuth: [] }],
    paths: {
      "/v1/auth/sms-codes": { post: op("发送短信验证码", { public: true, body: "SmsCodeRequest" }) },
      "/v1/auth/sms-login": { post: op("手机验证码登录", { public: true, body: "SmsLoginRequest" }) },
      "/admin/v1/sms-codes": { post: op("管理后台发送短信验证码", { public: true, body: "AdminSmsCodeRequest" }) },
      "/admin/v1/sms-login": { post: op("管理后台手机验证码登录", { public: true, body: "AdminSmsLoginRequest" }) },
      "/v1/auth/wechat/qr-sessions": { post: op("创建微信扫码登录会话", { public: true }) },
      "/v1/auth/wechat/qr-sessions/{ticket}": { get: op("查询微信扫码状态", { public: true, params: [pathParam("ticket", "微信扫码登录票据")] }) },
      "/v1/auth/logout": { post: op("退出登录") },
      "/v1/users/me": { get: op("当前用户"), patch: op("修改资料", { body: "UserProfileUpdateRequest" }) },
      "/v1/points/account": { get: op("积分账户") },
      "/v1/points/ledger": { get: op("积分流水", { query: [queryParam("direction", "积分方向，如 INCOME、EXPENSE"), ...pageParams()] }) },
      "/v1/points/ledger/{ledgerId}": { get: op("积分流水详情", { params: [pathParam("ledgerId", "积分流水 ID")] }) },
      "/v1/projects": { get: op("项目列表", { query: [queryParam("keyword", "项目关键词"), ...pageParams()] }), post: op("创建项目", { body: "ProjectCreateRequest" }) },
      "/v1/projects/{projectId}": { get: op("项目详情", { params: [projectIdParam()] }), patch: op("修改项目", { params: [projectIdParam()], body: "ProjectUpdateRequest" }), delete: op("删除项目", { params: [projectIdParam()] }) },
      "/v1/projects/{projectId}/canvas": { get: op("画布详情", { params: [projectIdParam()] }), put: op("保存画布", { params: [projectIdParam()], body: "CanvasSaveRequest" }) },
      "/v1/projects/{projectId}/versions": { get: op("历史版本列表", { params: [projectIdParam()], query: pageParams() }) },
      "/v1/projects/{projectId}/versions/{versionId}": { get: op("历史版本详情", { params: [projectIdParam(), pathParam("versionId", "历史版本 ID")] }) },
      "/v1/projects/{projectId}/versions/{versionId}/restore": { post: op("恢复历史版本", { params: [projectIdParam(), pathParam("versionId", "历史版本 ID")] }) },
      "/v1/projects/{projectId}/shares": { post: op("创建项目分享", { params: [projectIdParam()], body: "ShareCreateRequest" }) },
      "/v1/projects/{projectId}/shares/{shareCode}": { delete: op("关闭项目分享", { params: [projectIdParam(), pathParam("shareCode", "分享码")] }) },
      "/v1/shares/{shareCode}": { get: op("访问分享", { public: true, params: [pathParam("shareCode", "分享码")] }) },
      "/v1/assets": { get: op("素材列表", { query: [queryParam("scope", "素材范围：FILES、CENTER、RECOMMENDED、FAVORITE"), queryParam("projectId", "项目 ID"), queryParam("type", "素材类型：IMAGE、VIDEO"), queryParam("source", "素材来源：UPLOAD、GENERATED、TEMPLATE"), queryParam("keyword", "文件名关键词"), ...pageParams()] }), post: op("上传完成后登记素材并返回 OSS URL", { body: "AssetCompleteUploadRequest" }) },
      "/v1/assets/upload-tickets": { post: op("上传完成后登记素材并返回 OSS URL", { body: "UploadTicketRequest" }) },
      "/v1/assets/{assetId}": { get: op("素材详情", { params: [assetIdParam()] }), delete: op("删除素材", { params: [assetIdParam()] }) },
      "/v1/assets/{assetId}/favorite": { put: op("收藏素材", { params: [assetIdParam()] }), delete: op("取消收藏素材", { params: [assetIdParam()] }) },
      "/v1/ai/capabilities": { get: op("AI 能力") },
      "/v1/ai/skills": { get: op("AI 技能") },
      "/v1/ai/point-estimates": { post: op("预估积分", { body: "PointEstimateRequest" }) },
      "/v1/ai/prompt-translations": { post: op("提示词翻译", { body: "PromptTranslateRequest" }) },
      "/v1/generation-tasks": { get: op("任务列表", { query: [queryParam("projectId", "项目 ID"), queryParam("status", "任务状态"), ...pageParams()] }), post: op("创建任务", { headers: [headerParam("Idempotency-Key", "幂等键，建议创建任务时传入")], body: "GenerationTaskCreateRequest" }) },
      "/v1/generation-tasks/{taskId}": { get: op("任务详情", { params: [pathParam("taskId", "生成任务 ID")] }) },
      "/v1/generation-tasks/{taskId}/cancel": { post: op("取消任务", { params: [pathParam("taskId", "生成任务 ID")] }) },
      "/v1/provider/chat/models": { get: op("聊天模型可选列表") },
      "/v1/provider/chat/completions": { post: op("302.AI 聊天模型网关，支持 ChatGPT/OpenAI SSE", { body: "ProviderChatCompletionRequest" }) },
      "/v1/provider/images/generations": { post: op("302.AI 图片生成模型网关", { body: "ProviderImageGenerationRequest" }) },
      "/v1/provider/videos/generations": { post: op("官方视频模型网关，支持 Seedance 2.0 和 HappyHorse", { body: "ProviderVideoGenerationRequest" }) },
      "/v1/provider/tools": { get: op("模型小工具白名单") },
      "/v1/provider/tools/{toolCode}": { post: op("302.AI 小工具网关", { params: [pathParam("toolCode", "工具编码")], body: "ProviderToolRequest" }) },
      "/v1/chat-sessions": { get: op("对话列表", { query: [queryParam("projectId", "项目 ID"), ...pageParams()] }), post: op("创建对话", { body: "ChatSessionCreateRequest" }) },
      "/v1/chat-sessions/{sessionId}": { delete: op("删除对话", { params: [pathParam("sessionId", "对话 ID")] }) },
      "/v1/chat-sessions/{sessionId}/messages": { get: op("对话消息列表", { params: [pathParam("sessionId", "对话 ID")], query: pageParams() }), post: op("发送对话消息", { params: [pathParam("sessionId", "对话 ID")], body: "ChatMessageCreateRequest" }) },
      "/v1/workflows": { get: op("工作流列表", { query: [queryParam("keyword", "工作流关键词"), ...pageParams()] }), post: op("保存工作流", { body: "WorkflowSaveRequest" }) },
      "/v1/workflows/{workflowId}": { get: op("工作流详情", { params: [pathParam("workflowId", "工作流 ID")] }), put: op("修改工作流", { params: [pathParam("workflowId", "工作流 ID")], body: "WorkflowSaveRequest" }), delete: op("删除工作流", { params: [pathParam("workflowId", "工作流 ID")] }) },
      "/v1/workflows/{workflowId}/projects": { post: op("从工作流创建项目", { params: [pathParam("workflowId", "工作流 ID")], body: "WorkflowProjectCreateRequest" }) },
      "/v1/plans": { get: op("套餐列表", { public: true }) },
      "/v1/trial-applications/sms-codes": { post: op("发送试用申请短信验证码", { public: true, body: "TrialSmsCodeRequest" }) },
      "/v1/trial-applications": { post: op("提交试用申请并创建试用订单", { public: true, headers: [headerParam("Idempotency-Key", "幂等键，可选")], body: "TrialApplicationRequest" }) },
      "/v1/orders": { get: op("订单列表", { query: [queryParam("status", "订单状态"), ...pageParams()] }), post: op("创建订单", { headers: [headerParam("Idempotency-Key", "幂等键，必填")], body: "OrderCreateRequest" }) },
      "/v1/orders/{orderNo}": { get: op("订单详情", { params: [pathParam("orderNo", "订单号")] }) },
      "/v1/orders/{orderNo}/payments": { post: op("创建支付", { params: [pathParam("orderNo", "订单号")], body: "PaymentCreateRequest" }) },
      "/v1/orders/{orderNo}/mock-paid": { post: op("本地模拟支付成功", { params: [pathParam("orderNo", "订单号")] }) },
      "/v1/payments/{payType}/notify": { post: op("支付服务端通知", { public: true, params: [pathParam("payType", "支付方式：WECHAT、ALIPAY")], headers: [headerParam("X-Daone-Payment-Signature", "支付通知签名")], body: "PaymentNotifyRequest" }) },
      "/v1/subscriptions/cancel-auto-renew": { post: op("取消自动续费") },
      "/v1/home": { get: op("首页聚合", { public: true, query: [queryParam("categoryCode", "灵感分类编码，默认 ALL")] }) },
      "/admin/v1/dashboard": { get: op("后台首页运营概览") },
      "/admin/v1/users": { get: op("后台用户列表", { query: [queryParam("keyword", "关键词"), queryParam("status", "用户状态"), ...pageParams()] }) },
      "/admin/v1/users/{userId}": { get: op("后台用户详情", { params: [pathParam("userId", "用户 ID")] }) },
      "/admin/v1/users/{userId}/status": { patch: op("修改用户状态", { params: [pathParam("userId", "用户 ID")], body: "AdminUserStatusRequest" }) },
      "/admin/v1/users/{userId}/point-adjustments": { post: op("人工调整积分", { params: [pathParam("userId", "用户 ID")], body: "AdminPointAdjustmentRequest" }) },
      "/admin/v1/orders": { get: op("后台订单列表", { query: [queryParam("keyword", "关键词"), queryParam("status", "订单状态"), queryParam("payType", "支付方式"), queryParam("dateFrom", "开始日期"), queryParam("dateTo", "结束日期"), ...pageParams()] }) },
      "/admin/v1/orders/{orderNo}": { get: op("后台订单详情", { params: [pathParam("orderNo", "订单号")] }) },
      "/admin/v1/plans": { get: op("后台套餐列表"), post: op("创建套餐", { body: "AdminPlanSaveRequest" }) },
      "/admin/v1/plans/{planCode}": { get: op("套餐详情", { params: [pathParam("planCode", "套餐编码")] }), put: op("修改套餐", { params: [pathParam("planCode", "套餐编码")], body: "AdminPlanSaveRequest" }) },
      "/admin/v1/plans/{planCode}/status": { patch: op("修改套餐状态", { params: [pathParam("planCode", "套餐编码")], body: "AdminPlanStatusRequest" }) },
      "/admin/v1/model-configs": { get: op("模型配置列表") },
      "/admin/v1/model-configs/{modelCode}": { get: op("模型配置详情", { params: [pathParam("modelCode", "模型编码")] }), put: op("修改模型配置", { params: [pathParam("modelCode", "模型编码")], body: "AdminModelConfigRequest" }) },
      "/admin/v1/model-configs/{modelCode}/status": { patch: op("修改模型状态", { params: [pathParam("modelCode", "模型编码")], body: "AdminModelStatusRequest" }) },
      "/admin/v1/prompt-templates": { get: op("提示词模板列表"), post: op("创建提示词模板", { body: "AdminPromptTemplateSaveRequest" }) },
      "/admin/v1/prompt-templates/{code}": { get: op("提示词模板详情", { params: [pathParam("code", "模板编码")] }), put: op("修改提示词模板", { params: [pathParam("code", "模板编码")], body: "AdminPromptTemplateSaveRequest" }) },
      "/admin/v1/prompt-templates/{code}/status": { patch: op("修改提示词模板状态", { params: [pathParam("code", "模板编码")], body: "AdminPlanStatusRequest" }) },
      "/admin/v1/inspirations": { get: op("后台灵感列表"), post: op("创建灵感", { body: "AdminInspirationSaveRequest" }) },
      "/admin/v1/inspirations/{id}": { get: op("灵感详情", { params: [pathParam("id", "灵感 ID")] }), put: op("修改灵感", { params: [pathParam("id", "灵感 ID")], body: "AdminInspirationSaveRequest" }) },
      "/admin/v1/inspirations/{id}/status": { patch: op("修改灵感状态", { params: [pathParam("id", "灵感 ID")], body: "AdminPlanStatusRequest" }) },
      "/admin/v1/categories": { get: op("分类列表", { query: [queryParam("keyword", "关键词"), queryParam("status", "状态"), queryParam("scope", "使用范围"), ...pageParams()] }), post: op("创建分类", { body: "AdminCategorySaveRequest" }) },
      "/admin/v1/categories/{code}": { get: op("分类详情", { params: [pathParam("code", "分类编码")] }), put: op("修改分类", { params: [pathParam("code", "分类编码")], body: "AdminCategorySaveRequest" }), delete: op("删除分类", { params: [pathParam("code", "分类编码")] }) },
      "/admin/v1/categories/{code}/status": { patch: op("修改分类状态", { params: [pathParam("code", "分类编码")], body: "AdminPlanStatusRequest" }) },
      "/admin/v1/workflows": { get: op("后台工作流列表", { query: [queryParam("keyword", "关键词"), queryParam("status", "状态"), queryParam("categoryCode", "分类编码"), ...pageParams()] }), post: op("创建后台工作流", { body: "AdminWorkflowSaveRequest" }) },
      "/admin/v1/workflows/{workflowId}": { get: op("后台工作流详情", { params: [pathParam("workflowId", "工作流 ID")] }), put: op("修改后台工作流", { params: [pathParam("workflowId", "工作流 ID")], body: "AdminWorkflowSaveRequest" }), delete: op("删除后台工作流", { params: [pathParam("workflowId", "工作流 ID")] }) },
      "/admin/v1/workflows/{workflowId}/status": { patch: op("修改后台工作流状态", { params: [pathParam("workflowId", "工作流 ID")], body: "AdminPlanStatusRequest" }) },
      "/admin/v1/invoices": { get: op("开票申请列表", { query: [queryParam("keyword", "关键词"), queryParam("status", "状态"), queryParam("invoiceType", "发票类型"), queryParam("dateFrom", "开始日期"), queryParam("dateTo", "结束日期"), ...pageParams()] }), post: op("创建开票申请", { body: "AdminInvoiceSaveRequest" }) },
      "/admin/v1/invoices/{invoiceId}": { get: op("开票详情", { params: [pathParam("invoiceId", "开票申请 ID")] }), put: op("修改开票申请", { params: [pathParam("invoiceId", "开票申请 ID")], body: "AdminInvoiceSaveRequest" }) },
      "/admin/v1/invoices/{invoiceId}/status": { patch: op("修改开票状态", { params: [pathParam("invoiceId", "开票申请 ID")], body: "AdminInvoiceStatusRequest" }) },
      "/mock-files/upload": { post: op("本地 Mock 上传，仅 storage mock 启用时可用", { public: true }) },
      "/mock-files/{objectKey}": { get: op("本地 Mock 文件读取，仅 storage mock 启用时可用", { public: true, params: [pathParam("objectKey", "Mock 文件对象 Key")] }) },
      "/health": { get: op("健康检查与环境配置状态", { public: true }) },
      "/v3/swagger": { get: op("OpenAPI JSON", { public: true }) },
      "/doc.html": { get: op("Swagger UI 接口文档页", { public: true }) },
      "/swagger-ui.html": { get: op("Swagger UI 接口文档页", { public: true }) }
    }
  };
}

function op(summary, options = {}) {
  const parameters = [
    ...(options.params || []),
    ...(options.query || []),
    ...(options.headers || [])
  ];
  const operation = {
    summary,
    responses: {
      200: {
        description: "成功",
        content: {
          "application/json": {
            schema: ref("ApiResponse")
          }
        }
      }
    }
  };
  if (parameters.length) operation.parameters = parameters;
  if (options.body) operation.requestBody = jsonBody(options.body);
  if (options.public) operation.security = [];
  return operation;
}

function jsonBody(schemaName) {
  return {
    required: true,
    content: {
      "application/json": {
        schema: ref(schemaName)
      }
    }
  };
}

function pathParam(name, description) {
  return {
    name,
    in: "path",
    required: true,
    description,
    schema: { type: "string" }
  };
}

function queryParam(name, description, schema = { type: "string" }) {
  return {
    name,
    in: "query",
    required: false,
    description,
    schema
  };
}

function headerParam(name, description) {
  return {
    name,
    in: "header",
    required: false,
    description,
    schema: { type: "string" }
  };
}

function pageParams() {
  return [
    queryParam("page", "页码，从 1 开始", { type: "integer", minimum: 1, default: 1 }),
    queryParam("pageSize", "每页数量，最大 100", { type: "integer", minimum: 1, maximum: 100, default: 20 })
  ];
}

function projectIdParam() {
  return pathParam("projectId", "项目 ID");
}

function assetIdParam() {
  return pathParam("assetId", "素材 ID");
}

function ref(name) {
  return { $ref: `#/components/schemas/${name}` };
}

function object(properties = {}, description, required = []) {
  const schema = {
    type: "object",
    properties
  };
  if (description) schema.description = description;
  if (required.length) schema.required = required;
  return schema;
}

function array(items = {}, description) {
  const schema = {
    type: "array",
    items
  };
  if (description) schema.description = description;
  return schema;
}

function string(example, description) {
  const schema = { type: "string" };
  if (example !== undefined) schema.example = example;
  if (description) schema.description = description;
  return schema;
}

function integer(example, description) {
  const schema = { type: "integer" };
  if (example !== undefined) schema.example = example;
  if (description) schema.description = description;
  return schema;
}

function number(example, description) {
  const schema = { type: "number" };
  if (example !== undefined) schema.example = example;
  if (description) schema.description = description;
  return schema;
}

function boolean(example, description) {
  const schema = { type: "boolean" };
  if (example !== undefined) schema.example = example;
  if (description) schema.description = description;
  return schema;
}

export function docsHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Daone Node API Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
  <style>
    body{margin:0;background:#fff}
    .swagger-ui .topbar{display:none}
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-standalone-preset.js"></script>
  <script>
    window.addEventListener("load", () => {
      window.ui = SwaggerUIBundle({
        url: "/api/v3/swagger",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "StandaloneLayout",
        persistAuthorization: true,
        displayRequestDuration: true
      });
    });
  </script>
</body>
</html>`;
}
