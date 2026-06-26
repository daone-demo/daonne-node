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
        CanvasElementGroupSaveRequest: object({
          projectName: string("商品主视觉元素组", "元素组名称"),
          projectDescription: string("商品图、标题文本和价格标签组成的一组元素", "元素组描述"),
          projectStructure: object({
            cells: array(object({}, "选中的节点/连线"))
          }, "画布元素组结构 JSON")
        }, "保存画布元素组请求", ["projectName", "projectStructure"]),
        ShareCreateRequest: object({
          expireDays: integer(7, "有效天数")
        }, "创建分享请求"),
        UploadTicketRequest: object({
          projectId: string("100000000000000001", "项目 ID，可选"),
          fileName: string("cover.png", "文件名"),
          contentType: string("image/png", "文件 MIME 类型"),
          fileSize: integer(128, "文件大小，单位字节；图片最大 10M，视频最大 50M"),
          fileBase64: string("iVBORw0KGgo=", "JSON 兼容上传时的文件 base64；推荐 multipart/form-data 的 file 字段")
        }, "上传本地文件到 OSS 并登记素材请求；推荐 multipart/form-data，file 字段为文件内容", ["fileName", "contentType"]),
        AssetCompleteUploadRequest: object({
          projectId: string("100000000000000001", "项目 ID，可选"),
          fileName: string("cover.png", "文件名"),
          contentType: string("image/png", "文件 MIME 类型"),
          fileSize: integer(128, "文件大小，单位字节"),
          fileBase64: string("iVBORw0KGgo=", "JSON 兼容上传时的文件 base64；推荐 multipart/form-data 的 file 字段")
        }, "上传本地文件到 OSS 并登记素材请求；推荐 multipart/form-data，file 字段为文件内容", ["fileName", "contentType"]),
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
          orderNo: string("DN202606170001", "微信占位回调订单号"),
          amountFen: integer(9900, "微信占位回调支付金额，单位分"),
          currency: string("CNY", "微信占位回调币种"),
          channelTransactionNo: string("WX123456789", "微信占位回调渠道交易号"),
          out_trade_no: string("DN202606170001", "支付宝回调订单号"),
          trade_no: string("2026062622000000000001", "支付宝交易号"),
          trade_status: string("TRADE_SUCCESS", "支付宝交易状态"),
          total_amount: string("99.00", "支付宝支付金额，单位元"),
          app_id: string("2021006164633074", "支付宝应用 ID"),
          sign: string("base64-signature", "支付宝 RSA2 签名")
        }, "支付回调请求。微信当前使用 JSON + X-Daone-Payment-Signature 占位验签；支付宝使用 application/x-www-form-urlencoded 官方表单通知并校验 sign。"),
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
      "/v1/projects/{projectId}/element-groups": { get: op("画布元素组列表", { params: [projectIdParam()], query: pageParams() }), post: op("保存画布元素组", { params: [projectIdParam()], body: "CanvasElementGroupSaveRequest" }) },
      "/v1/projects/{projectId}/versions": { get: op("历史版本列表", { params: [projectIdParam()], query: pageParams() }) },
      "/v1/projects/{projectId}/versions/{versionId}": { get: op("历史版本详情", { params: [projectIdParam(), pathParam("versionId", "历史版本 ID")] }) },
      "/v1/projects/{projectId}/versions/{versionId}/restore": { post: op("恢复历史版本", { params: [projectIdParam(), pathParam("versionId", "历史版本 ID")] }) },
      "/v1/projects/{projectId}/shares": { post: op("创建项目分享", { params: [projectIdParam()], body: "ShareCreateRequest" }) },
      "/v1/projects/{projectId}/shares/{shareCode}": { delete: op("关闭项目分享", { params: [projectIdParam(), pathParam("shareCode", "分享码")] }) },
      "/v1/shares/{shareCode}": { get: op("访问分享", { public: true, params: [pathParam("shareCode", "分享码")] }) },
      "/v1/assets": { get: op("素材列表", { query: [queryParam("scope", "素材范围：FILES、CENTER、RECOMMENDED、FAVORITE"), queryParam("projectId", "项目 ID"), queryParam("type", "素材类型：IMAGE、VIDEO"), queryParam("source", "素材来源：UPLOAD、GENERATED、TEMPLATE"), queryParam("keyword", "文件名关键词"), ...pageParams()] }), post: op("上传本地文件到 OSS 并返回 URL", { body: "AssetCompleteUploadRequest" }) },
      "/v1/assets/upload-tickets": { post: op("上传本地文件到 OSS 并返回 URL", { body: "UploadTicketRequest" }) },
      "/v1/assets/{assetId}": { get: op("素材详情", { params: [assetIdParam()] }), delete: op("删除素材", { params: [assetIdParam()] }) },
      "/v1/assets/{assetId}/favorite": { put: op("收藏素材", { params: [assetIdParam()] }), delete: op("取消收藏素材", { params: [assetIdParam()] }) },
      "/v1/ai/capabilities": { get: op("AI 能力") },
      "/v1/ai/skills": { get: op("AI 技能") },
      "/v1/ai/point-estimates": { post: op("预估积分", { body: "PointEstimateRequest" }) },
      "/v1/ai/prompt-translations": { post: op("提示词翻译", { body: "PromptTranslateRequest" }) },
      "/v1/generation-tasks": { get: op("任务列表", { query: [queryParam("projectId", "项目 ID"), queryParam("status", "任务状态"), ...pageParams()] }), post: op("创建任务", { headers: [headerParam("Idempotency-Key", "幂等键，建议创建任务时传入")], body: "GenerationTaskCreateRequest" }) },
      "/v1/generation-tasks/{taskId}": { get: op("任务详情", { params: [pathParam("taskId", "生成任务 ID")] }) },
      "/v1/generation-tasks/{taskId}/cancel": { post: op("取消任务", { params: [pathParam("taskId", "生成任务 ID")] }) },
      "/v1/provider/chat/models": { get: op("模型网关可选模型列表", { query: [queryParam("type", "模型类型：chat/multimodal_chat、image/image_generation、video/video_generation；不传默认 chat")] }) },
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
      "/v1/payments/{payType}/notify": { post: op("支付服务端通知", { public: true, params: [pathParam("payType", "支付方式：WECHAT、ALIPAY")], headers: [headerParam("X-Daone-Payment-Signature", "微信占位回调签名；支付宝回调不使用该请求头")], body: "PaymentNotifyRequest" }) },
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
  <title>Daone Node API Knife4j</title>
  <style>
    :root{
      color-scheme:light;
      --bg:#f5f7fb;
      --panel:#fff;
      --panel-soft:#f8fafc;
      --line:#e5e9f2;
      --line-strong:#d6dde9;
      --text:#1f2a37;
      --muted:#6b7280;
      --primary:#1677ff;
      --primary-soft:#e8f2ff;
      --green:#18a058;
      --orange:#f59e0b;
      --red:#ef4444;
      --purple:#7c3aed;
      --shadow:0 8px 24px rgba(28,39,60,.08);
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",Arial,sans-serif;
    }
    *{box-sizing:border-box}
    html,body{height:100%}
    body{margin:0;background:var(--bg);color:var(--text);font-size:14px}
    button,input{font:inherit}
    .app{height:100vh;display:grid;grid-template-rows:56px 1fr;overflow:hidden}
    .topbar{display:flex;align-items:center;gap:18px;padding:0 22px;background:#1f2937;color:#fff;box-shadow:var(--shadow);z-index:3}
    .brand{display:flex;align-items:center;gap:10px;min-width:220px;font-weight:700;font-size:17px}
    .brand-mark{display:grid;place-items:center;width:30px;height:30px;border-radius:6px;background:var(--primary);font-size:15px}
    .top-meta{display:flex;align-items:center;gap:12px;color:#cbd5e1;font-size:13px;white-space:nowrap}
    .top-link{margin-left:auto;color:#dbeafe;text-decoration:none;font-size:13px}
    .layout{display:grid;grid-template-columns:300px minmax(0,1fr);height:100%;min-height:0}
    .sidebar{display:grid;grid-template-rows:auto 1fr;background:var(--panel);border-right:1px solid var(--line);min-height:0}
    .search-box{padding:14px;border-bottom:1px solid var(--line)}
    .search-box input{width:100%;height:36px;border:1px solid var(--line-strong);border-radius:6px;padding:0 12px;background:#fff;color:var(--text);outline:none}
    .search-box input:focus{border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-soft)}
    .nav{overflow:auto;padding:8px 8px 18px}
    .nav-group{margin-bottom:6px}
    .nav-group-title{display:flex;align-items:center;justify-content:space-between;width:100%;height:34px;border:0;background:transparent;border-radius:6px;padding:0 9px;color:#334155;font-weight:650;cursor:pointer}
    .nav-group-title:hover,.nav-item:hover{background:var(--panel-soft)}
    .nav-count{color:var(--muted);font-size:12px;font-weight:500}
    .nav-item{display:grid;grid-template-columns:54px minmax(0,1fr);gap:8px;width:100%;border:0;background:transparent;border-radius:6px;padding:8px 9px;text-align:left;cursor:pointer;color:var(--text)}
    .nav-item.active{background:var(--primary-soft);color:#0758bf}
    .method{display:inline-flex;align-items:center;justify-content:center;height:22px;border-radius:4px;color:#fff;font-weight:700;font-size:11px;letter-spacing:0;text-transform:uppercase}
    .method.get{background:var(--green)}
    .method.post{background:var(--primary)}
    .method.put{background:var(--orange)}
    .method.patch{background:var(--purple)}
    .method.delete{background:var(--red)}
    .method.other{background:#64748b}
    .nav-summary{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
    .nav-path{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:12px;margin-top:2px}
    .main{overflow:auto;min-width:0}
    .content{max-width:1180px;margin:0 auto;padding:22px}
    .hero,.section{background:var(--panel);border:1px solid var(--line);border-radius:8px;box-shadow:var(--shadow)}
    .hero{padding:22px;margin-bottom:16px}
    .hero h1{margin:0 0 8px;font-size:24px;line-height:1.25;letter-spacing:0}
    .hero p{margin:0;color:var(--muted);line-height:1.7}
    .stats{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
    .stat{display:flex;gap:6px;align-items:center;border:1px solid var(--line);border-radius:6px;background:var(--panel-soft);padding:8px 10px;color:#334155}
    .toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:16px}
    .tab{height:34px;border:1px solid var(--line-strong);background:#fff;border-radius:6px;padding:0 12px;color:#334155;cursor:pointer}
    .tab.active{border-color:var(--primary);background:var(--primary-soft);color:#0758bf;font-weight:650}
    .auth{display:flex;gap:8px;align-items:center;margin-left:auto;min-width:min(520px,100%)}
    .auth input{flex:1;min-width:220px;height:34px;border:1px solid var(--line-strong);border-radius:6px;padding:0 10px;outline:none}
    .auth button,.copy-btn,.send-btn{height:34px;border:0;border-radius:6px;background:var(--primary);color:#fff;padding:0 12px;cursor:pointer}
    .send-btn:disabled{background:#94a3b8;cursor:not-allowed}
    .auth-status{min-width:56px;color:var(--green);font-size:12px;white-space:nowrap}
    .auth-status.error{color:var(--red)}
    .section{margin-bottom:16px;overflow:hidden}
    .section-header{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line);background:var(--panel-soft)}
    .section-title{font-weight:700;font-size:16px}
    .section-body{padding:16px}
    .endpoint-title{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
    .endpoint-path{font-family:"SFMono-Regular",Consolas,"Liberation Mono",monospace;font-size:16px;overflow-wrap:anywhere}
    .desc{color:var(--muted);line-height:1.7;margin:8px 0 0}
    table{width:100%;border-collapse:collapse;border:1px solid var(--line);border-radius:6px;overflow:hidden}
    th,td{border-bottom:1px solid var(--line);padding:10px 12px;text-align:left;vertical-align:top}
    th{background:var(--panel-soft);color:#475569;font-weight:650}
    tr:last-child td{border-bottom:0}
    code,pre{font-family:"SFMono-Regular",Consolas,"Liberation Mono",monospace}
    code{color:#0f766e}
    pre{margin:0;white-space:pre-wrap;overflow:auto;background:#111827;color:#e5e7eb;border-radius:6px;padding:14px;line-height:1.55;font-size:13px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .debug-form{display:grid;gap:14px}
    .debug-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
    .field{display:grid;gap:6px}
    .field label{display:flex;align-items:center;gap:6px;color:#334155;font-weight:650}
    .field small{color:var(--muted);font-weight:400}
    .field input,.field textarea{width:100%;border:1px solid var(--line-strong);border-radius:6px;background:#fff;color:var(--text);outline:none}
    .field input{height:36px;padding:0 10px}
    .field textarea{min-height:150px;padding:10px 12px;resize:vertical;font-family:"SFMono-Regular",Consolas,"Liberation Mono",monospace;line-height:1.5}
    .field input:focus,.field textarea:focus{border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-soft)}
    .required{color:var(--red)}
    .debug-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .debug-url{color:var(--muted);font-family:"SFMono-Regular",Consolas,"Liberation Mono",monospace;overflow-wrap:anywhere}
    .response-meta{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
    .badge{display:inline-flex;align-items:center;height:24px;border-radius:4px;background:var(--panel-soft);border:1px solid var(--line);padding:0 8px;color:#334155;font-size:12px}
    .badge.ok{color:var(--green);border-color:#bbf7d0;background:#f0fdf4}
    .badge.fail{color:var(--red);border-color:#fecaca;background:#fef2f2}
    .empty{padding:36px;text-align:center;color:var(--muted)}
    .schema-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
    .schema-card{border:1px solid var(--line);border-radius:8px;background:#fff;overflow:hidden}
    .schema-card h3{margin:0;padding:12px 14px;border-bottom:1px solid var(--line);font-size:15px;background:var(--panel-soft)}
    .schema-card pre{border-radius:0;background:#0f172a}
    .hidden{display:none!important}
    @media (max-width:860px){
      .layout{grid-template-columns:1fr}
      .sidebar{height:42vh;border-right:0;border-bottom:1px solid var(--line)}
      .content{padding:14px}
      .grid{grid-template-columns:1fr}
      .top-meta{display:none}
      .auth{margin-left:0}
    }
  </style>
</head>
<body>
  <div class="app" data-ui="knife4j">
    <header class="topbar">
      <div class="brand"><span class="brand-mark">K</span><span>Daone API 文档</span></div>
      <div class="top-meta"><span id="api-version">OpenAPI</span><span id="api-server">/api</span></div>
      <a class="top-link" href="/api/v3/swagger" target="_blank" rel="noreferrer">OpenAPI JSON</a>
    </header>
    <div class="layout">
      <aside class="sidebar">
        <div class="search-box">
          <input id="search" type="search" placeholder="搜索接口名称或路径" />
        </div>
        <nav id="nav" class="nav" aria-label="接口列表"></nav>
      </aside>
      <main class="main">
        <div class="content">
          <section class="hero">
            <h1 id="title">Daone Node API</h1>
            <p id="description">正在加载接口定义...</p>
            <div class="stats">
              <div class="stat"><strong id="path-count">0</strong><span>个路径</span></div>
              <div class="stat"><strong id="operation-count">0</strong><span>个接口</span></div>
              <div class="stat"><strong id="schema-count">0</strong><span>个模型</span></div>
            </div>
          </section>
          <div class="toolbar">
            <button class="tab active" data-view="docs">接口文档</button>
            <button class="tab" data-view="schemas">数据模型</button>
            <div class="auth">
              <input id="token" type="password" placeholder="登录 Token，支持 Bearer xxx 或纯 token" />
              <button id="save-token" type="button">保存</button>
              <span id="token-status" class="auth-status"></span>
            </div>
          </div>
          <section id="docs-view"></section>
          <section id="schemas-view" class="hidden"></section>
        </div>
      </main>
    </div>
  </div>
  <script>
    const state = { spec: null, operations: [], activeId: "", query: "", view: "docs" };
    const methodOrder = ["get", "post", "put", "patch", "delete", "options", "head"];
    const methodNames = { get: "GET", post: "POST", put: "PUT", patch: "PATCH", delete: "DELETE", options: "OPTIONS", head: "HEAD" };

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function tokenFromObject(value) {
      if (!value || typeof value !== "object") return "";
      return value.token || value.accessToken || value.access_token || value.jwt || tokenFromObject(value.data) || "";
    }

    function normalizeToken(value) {
      let token = String(value || "").trim();
      if (!token) return "";
      if ((token.startsWith("{") && token.endsWith("}")) || (token.startsWith('"') && token.endsWith('"'))) {
        try {
          const parsed = JSON.parse(token);
          token = typeof parsed === "string" ? parsed : tokenFromObject(parsed);
        } catch {
          token = String(value || "").trim();
        }
      }
      token = token.trim();
      if (token.toLowerCase().startsWith("bearer ")) token = token.slice(7).trim();
      return token;
    }

    function authHeaderValue(value) {
      const token = normalizeToken(value);
      return token ? "Bearer " + token : "";
    }

    function savedToken() {
      return normalizeToken(localStorage.getItem("daone-doc-token") || "");
    }

    function resolveRef(ref) {
      if (!ref || !state.spec) return null;
      const name = ref.replace("#/components/schemas/", "");
      return state.spec.components?.schemas?.[name] || null;
    }

    function schemaLabel(schema) {
      if (!schema) return "-";
      if (schema.$ref) return schema.$ref.replace("#/components/schemas/", "");
      if (schema.type === "array") return "array<" + schemaLabel(schema.items) + ">";
      return schema.type || "object";
    }

    function schemaExample(schema, seen = new Set()) {
      if (!schema) return null;
      if (schema.example !== undefined) return schema.example;
      if (schema.$ref) {
        const name = schema.$ref.replace("#/components/schemas/", "");
        if (seen.has(name)) return {};
        seen.add(name);
        return schemaExample(resolveRef(schema.$ref), seen);
      }
      if (schema.type === "array") return [schemaExample(schema.items, seen)];
      if (schema.type === "object" || schema.properties) {
        return Object.fromEntries(Object.entries(schema.properties || {}).map(([key, value]) => [key, schemaExample(value, seen)]));
      }
      if (schema.type === "integer" || schema.type === "number") return 0;
      if (schema.type === "boolean") return false;
      return "";
    }

    function collectOperations(spec) {
      return Object.entries(spec.paths || {}).flatMap(([path, methods]) => {
        return methodOrder.filter((method) => methods[method]).map((method) => {
          const operation = methods[method];
          const group = path.startsWith("/admin/") ? "管理后台接口" : path.startsWith("/mock-") ? "本地 Mock 接口" : path.startsWith("/v3/") || path === "/doc.html" || path === "/swagger-ui.html" ? "接口文档" : "用户端接口";
          return {
            id: method + ":" + path,
            path,
            method,
            group,
            summary: operation.summary || path,
            operation
          };
        });
      });
    }

    function renderNav() {
      const query = state.query.trim().toLowerCase();
      const filtered = state.operations.filter((item) => {
        return !query || item.summary.toLowerCase().includes(query) || item.path.toLowerCase().includes(query) || item.method.toLowerCase().includes(query);
      });
      const groups = filtered.reduce((acc, item) => {
        (acc[item.group] ||= []).push(item);
        return acc;
      }, {});
      document.getElementById("nav").innerHTML = Object.entries(groups).map(([group, items]) => {
        return '<div class="nav-group"><button class="nav-group-title" type="button"><span>' + escapeHtml(group) + '</span><span class="nav-count">' + items.length + '</span></button>' +
          items.map((item) => '<button class="nav-item ' + (item.id === state.activeId ? "active" : "") + '" type="button" data-id="' + escapeHtml(item.id) + '">' +
            '<span class="method ' + escapeHtml(item.method) + '">' + methodNames[item.method] + '</span><span><span class="nav-summary">' + escapeHtml(item.summary) + '</span><span class="nav-path">' + escapeHtml(item.path) + '</span></span></button>').join("") +
          '</div>';
      }).join("") || '<div class="empty">没有匹配的接口</div>';
    }

    function renderParameters(parameters = []) {
      if (!parameters.length) return '<p class="desc">无请求参数。</p>';
      return '<table><thead><tr><th>名称</th><th>位置</th><th>必填</th><th>类型</th><th>说明</th></tr></thead><tbody>' +
        parameters.map((param) => '<tr><td><code>' + escapeHtml(param.name) + '</code></td><td>' + escapeHtml(param.in) + '</td><td>' + (param.required ? "是" : "否") + '</td><td>' + escapeHtml(schemaLabel(param.schema)) + '</td><td>' + escapeHtml(param.description || "") + '</td></tr>').join("") +
        '</tbody></table>';
    }

    function renderBody(operation) {
      const body = operation.requestBody?.content?.["application/json"]?.schema;
      if (!body) return '<p class="desc">无请求体。</p>';
      return '<div class="grid"><div><table><thead><tr><th>Content-Type</th><th>模型</th><th>必填</th></tr></thead><tbody><tr><td>application/json</td><td><code>' + escapeHtml(schemaLabel(body)) + '</code></td><td>' + (operation.requestBody.required ? "是" : "否") + '</td></tr></tbody></table></div><pre>' + escapeHtml(JSON.stringify(schemaExample(body), null, 2)) + '</pre></div>';
    }

    function requestBodySchema(operation) {
      return operation.requestBody?.content?.["application/json"]?.schema || null;
    }

    function sampleForInput(param) {
      if (param.schema?.example !== undefined) return param.schema.example;
      if (param.schema?.default !== undefined) return param.schema.default;
      return "";
    }

    function renderDebug(item) {
      const parameters = item.operation.parameters || [];
      const body = requestBodySchema(item.operation);
      const server = state.spec.servers?.[0]?.url || "";
      const actionUrl = server + item.path;
      const parameterFields = parameters.map((param) => {
        return '<div class="field"><label><span>' + escapeHtml(param.name) + '</span><small>' + escapeHtml(param.in) + '</small>' + (param.required ? '<span class="required">*</span>' : "") + '</label>' +
          '<input data-param-name="' + escapeHtml(param.name) + '" data-param-in="' + escapeHtml(param.in) + '" data-param-required="' + (param.required ? "true" : "false") + '" value="' + escapeHtml(sampleForInput(param)) + '" placeholder="' + escapeHtml(param.description || param.name) + '" /></div>';
      }).join("");
      const bodyField = body ? '<div class="field"><label><span>Request Body</span><small>application/json</small>' + (item.operation.requestBody?.required ? '<span class="required">*</span>' : "") + '</label><textarea data-debug-body>' + escapeHtml(JSON.stringify(schemaExample(body), null, 2)) + '</textarea></div>' : "";
      return '<div class="debug-form">' +
        (parameterFields ? '<div class="debug-grid">' + parameterFields + '</div>' : '<p class="desc">无可填写参数。</p>') +
        bodyField +
        '<div class="debug-actions"><button class="send-btn" type="button" data-send-debug>发送请求</button><span class="debug-url">' + escapeHtml(methodNames[item.method] + " " + actionUrl) + '</span></div>' +
        '<div id="debug-response"><p class="desc">尚未发送请求。</p></div>' +
        '</div>';
    }

    function renderResponses(operation) {
      const responses = Object.entries(operation.responses || {});
      if (!responses.length) return '<p class="desc">暂无响应定义。</p>';
      return '<table><thead><tr><th>状态码</th><th>说明</th><th>模型</th></tr></thead><tbody>' +
        responses.map(([status, response]) => {
          const schema = response.content?.["application/json"]?.schema;
          return '<tr><td><code>' + escapeHtml(status) + '</code></td><td>' + escapeHtml(response.description || "") + '</td><td><code>' + escapeHtml(schemaLabel(schema)) + '</code></td></tr>';
        }).join("") +
        '</tbody></table>';
    }

    function renderCurl(item) {
      const server = state.spec.servers?.[0]?.url || "";
      const authHeader = authHeaderValue(savedToken());
      const continuation = " " + String.fromCharCode(92, 10);
      const lines = ["curl -X " + methodNames[item.method] + " '" + server + item.path + "'"];
      if (authHeader) lines.push("  -H 'Authorization: " + authHeader + "'");
      if (item.operation.requestBody) {
        lines.push("  -H 'Content-Type: application/json'");
        lines.push("  -d '" + JSON.stringify(schemaExample(item.operation.requestBody.content?.["application/json"]?.schema)) + "'");
      }
      return lines.join(continuation);
    }

    function renderDocs() {
      const item = state.operations.find((operation) => operation.id === state.activeId);
      if (!item) {
        document.getElementById("docs-view").innerHTML = '<section class="section"><div class="empty">请选择一个接口。</div></section>';
        return;
      }
      document.getElementById("docs-view").innerHTML =
        '<section class="section"><div class="section-header"><div class="endpoint-title"><span class="method ' + escapeHtml(item.method) + '">' + methodNames[item.method] + '</span><span class="section-title">' + escapeHtml(item.summary) + '</span><span class="endpoint-path">' + escapeHtml(item.path) + '</span></div></div>' +
        '<div class="section-body"><p class="desc">' + escapeHtml(item.operation.description || "接口基础信息、请求参数和响应结构。") + '</p></div></section>' +
        '<section class="section"><div class="section-header"><span class="section-title">请求参数</span></div><div class="section-body">' + renderParameters(item.operation.parameters || []) + '</div></section>' +
        '<section class="section"><div class="section-header"><span class="section-title">请求体</span></div><div class="section-body">' + renderBody(item.operation) + '</div></section>' +
        '<section class="section"><div class="section-header"><span class="section-title">在线调试</span></div><div class="section-body">' + renderDebug(item) + '</div></section>' +
        '<section class="section"><div class="section-header"><span class="section-title">响应</span></div><div class="section-body">' + renderResponses(item.operation) + '</div></section>' +
        '<section class="section"><div class="section-header"><span class="section-title">Curl</span><button class="copy-btn" type="button" data-copy="curl">复制</button></div><div class="section-body"><pre id="curl-block">' + escapeHtml(renderCurl(item)) + '</pre></div></section>';
    }

    function renderSchemas() {
      const schemas = state.spec.components?.schemas || {};
      document.getElementById("schemas-view").innerHTML = '<div class="schema-list">' + Object.entries(schemas).map(([name, schema]) => {
        return '<article class="schema-card"><h3>' + escapeHtml(name) + '</h3><pre>' + escapeHtml(JSON.stringify(schema, null, 2)) + '</pre></article>';
      }).join("") + '</div>';
    }

    function setView(view) {
      state.view = view;
      document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
      document.getElementById("docs-view").classList.toggle("hidden", view !== "docs");
      document.getElementById("schemas-view").classList.toggle("hidden", view !== "schemas");
    }

    function renderAll() {
      renderNav();
      renderDocs();
      renderSchemas();
      setView(state.view);
    }

    function currentOperation() {
      return state.operations.find((operation) => operation.id === state.activeId);
    }

    function curlFromRequest(method, url, headers, body) {
      const continuation = " " + String.fromCharCode(92, 10);
      const lines = ["curl -X " + method + " '" + url + "'"];
      Object.entries(headers).forEach(([name, value]) => {
        lines.push("  -H '" + name + ": " + value.replaceAll("'", "'\\\\''") + "'");
      });
      if (body) lines.push("  -d '" + body.replaceAll("'", "'\\\\''") + "'");
      return lines.join(continuation);
    }

    function buildDebugRequest(item) {
      const server = state.spec.servers?.[0]?.url || "";
      let path = (server.endsWith("/") ? server.slice(0, -1) : server) + item.path;
      const query = [];
      const headers = {};
      document.querySelectorAll("[data-param-name]").forEach((input) => {
        const name = input.dataset.paramName;
        const location = input.dataset.paramIn;
        const value = input.value.trim();
        if (input.dataset.paramRequired === "true" && !value) throw new Error(name + " 为必填参数");
        if (!value) return;
        if (location === "path") path = path.split("{" + name + "}").join(encodeURIComponent(value));
        if (location === "query") query.push([name, value]);
        if (location === "header") headers[name] = value;
      });
      const url = new URL(path, window.location.origin);
      query.forEach(([name, value]) => url.searchParams.append(name, value));
      const authHeader = authHeaderValue(document.getElementById("token").value || savedToken());
      if (authHeader) headers.Authorization = authHeader;
      const bodyControl = document.querySelector("[data-debug-body]");
      let body = null;
      if (bodyControl) {
        const rawBody = bodyControl.value.trim();
        if (rawBody) {
          JSON.parse(rawBody);
          body = rawBody;
          if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
        }
      }
      return {
        method: methodNames[item.method],
        url,
        headers,
        body
      };
    }

    async function sendDebugRequest(button) {
      const item = currentOperation();
      const output = document.getElementById("debug-response");
      if (!item || !output) return;
      button.disabled = true;
      button.textContent = "发送中...";
      try {
        const request = buildDebugRequest(item);
        const startedAt = performance.now();
        const response = await fetch(request.url.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.body
        });
        const elapsed = Math.round(performance.now() - startedAt);
        const text = await response.text();
        let bodyText = text;
        try {
          bodyText = JSON.stringify(JSON.parse(text), null, 2);
        } catch {
          bodyText = text;
        }
        const responseHeaders = Object.fromEntries(response.headers.entries());
        const statusClass = response.ok ? "ok" : "fail";
        output.innerHTML = '<div class="response-meta"><span class="badge ' + statusClass + '">' + response.status + " " + escapeHtml(response.statusText) + '</span><span class="badge">' + elapsed + ' ms</span><span class="badge">' + escapeHtml(request.method) + '</span></div>' +
          '<pre>' + escapeHtml(bodyText || "(empty response)") + '</pre>' +
          '<p class="desc">Response Headers</p><pre>' + escapeHtml(JSON.stringify(responseHeaders, null, 2)) + '</pre>';
        const curlBlock = document.getElementById("curl-block");
        if (curlBlock) curlBlock.textContent = curlFromRequest(request.method, request.url.pathname + request.url.search, request.headers, request.body);
      } catch (error) {
        output.innerHTML = '<div class="response-meta"><span class="badge fail">请求失败</span></div><pre>' + escapeHtml(error.message) + '</pre>';
      } finally {
        button.disabled = false;
        button.textContent = "发送请求";
      }
    }

    document.addEventListener("click", async (event) => {
      const navItem = event.target.closest(".nav-item");
      if (navItem) {
        state.activeId = navItem.dataset.id;
        renderAll();
        document.querySelector(".main").scrollTop = 0;
        return;
      }
      const tab = event.target.closest(".tab");
      if (tab) setView(tab.dataset.view);
      if (event.target.dataset.copy === "curl") {
        await navigator.clipboard?.writeText(document.getElementById("curl-block")?.textContent || "");
      }
      const sendButton = event.target.closest("[data-send-debug]");
      if (sendButton) await sendDebugRequest(sendButton);
    });

    document.getElementById("search").addEventListener("input", (event) => {
      state.query = event.target.value;
      renderNav();
    });

    document.getElementById("token").addEventListener("input", () => {
      document.getElementById("token-status").textContent = "";
      document.getElementById("token-status").classList.remove("error");
    });

    document.getElementById("save-token").addEventListener("click", () => {
      const tokenInput = document.getElementById("token");
      const tokenStatus = document.getElementById("token-status");
      const token = normalizeToken(tokenInput.value);
      tokenStatus.classList.remove("error");
      if (!token) {
        localStorage.removeItem("daone-doc-token");
        tokenStatus.textContent = "已清空";
        renderDocs();
        return;
      }
      localStorage.setItem("daone-doc-token", token);
      tokenInput.value = token;
      tokenStatus.textContent = "已保存";
      renderDocs();
    });

    async function init() {
      const token = savedToken();
      document.getElementById("token").value = token;
      const response = await fetch("/api/v3/swagger");
      state.spec = await response.json();
      state.operations = collectOperations(state.spec);
      state.activeId = state.operations[0]?.id || "";
      document.getElementById("title").textContent = state.spec.info?.title || "Daone Node API";
      document.getElementById("description").textContent = state.spec.info?.description || "";
      document.getElementById("api-version").textContent = "OpenAPI " + (state.spec.openapi || "");
      document.getElementById("api-server").textContent = state.spec.servers?.[0]?.url || "/api";
      document.getElementById("path-count").textContent = Object.keys(state.spec.paths || {}).length;
      document.getElementById("operation-count").textContent = state.operations.length;
      document.getElementById("schema-count").textContent = Object.keys(state.spec.components?.schemas || {}).length;
      renderAll();
    }

    init().catch((error) => {
      document.getElementById("docs-view").innerHTML = '<section class="section"><div class="empty">接口定义加载失败：' + escapeHtml(error.message) + '</div></section>';
    });
  </script>
</body>
</html>`;
}
