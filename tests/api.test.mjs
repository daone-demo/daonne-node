import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";

process.env.DAONE_PROFILE = "local";
process.env.DAONE_ADMIN_PHONES = "13800138000";
const { handleRequest } = await import("../src/starter/app.js");
const { default: vercelIndexHandler } = await import("../api/index.js");
const { appConfig, resolveProfile } = await import("../src/infrastructure/config/env.js");
const { createChannelPayment } = await import("../src/infrastructure/middleware/paymentClient.js");

describe("Daone Vercel Node API", () => {
  it("does not allow Vercel deployments to resolve to local profile", () => {
    const originalProfile = process.env.DAONE_PROFILE;
    const originalVercel = process.env.VERCEL;
    const originalVercelEnv = process.env.VERCEL_ENV;
    try {
      process.env.DAONE_PROFILE = "local";
      process.env.VERCEL_ENV = "preview";
      assert.equal(resolveProfile(), "test");

      process.env.VERCEL_ENV = "production";
      assert.equal(resolveProfile(), "prod");

      delete process.env.VERCEL_ENV;
      process.env.VERCEL = "1";
      assert.equal(resolveProfile(), "test");

      delete process.env.VERCEL;
      assert.equal(resolveProfile(), "local");
    } finally {
      restoreEnv("DAONE_PROFILE", originalProfile);
      restoreEnv("VERCEL", originalVercel);
      restoreEnv("VERCEL_ENV", originalVercelEnv);
    }
  });

  it("does not allow payment mock on Vercel even when profile is local", async () => {
    const originalVercel = process.env.VERCEL;
    const originalProfile = appConfig.profile;
    const originalPaymentMock = appConfig.payment.mockEnabled;
    try {
      process.env.VERCEL = "1";
      appConfig.profile = "local";
      appConfig.payment.mockEnabled = true;
      await assert.rejects(
        () => createChannelPayment({
          orderNo: "DNMOCK",
          productName: "测试套餐",
          amountFen: 9900,
          currency: "CNY"
        }, "ALIPAY"),
        /Payment mock is only allowed/
      );
    } finally {
      restoreEnv("VERCEL", originalVercel);
      appConfig.profile = originalProfile;
      appConfig.payment.mockEnabled = originalPaymentMock;
    }
  });

  it("uploads assets to OSS when storage mock is disabled", async () => {
    const { createUploadTicket } = await import("../src/service/creation/assetService.js");
    const originalFetch = globalThis.fetch;
    const originalStorageMock = appConfig.storage.mockEnabled;
    const originalPublicBaseUrl = appConfig.storage.publicBaseUrl;
    const originalOss = { ...appConfig.storage.oss };
    const originalAliyun = { ...appConfig.aliyun };
    const originalContentSafetyMock = appConfig.contentSafety.mockEnabled;
    const uploaded = Buffer.from("real oss payload");
    let putObjectCalled = false;
    try {
      appConfig.storage.mockEnabled = false;
      appConfig.storage.publicBaseUrl = "https://cdn.example.com";
      appConfig.storage.oss.endpoint = "oss-cn-shanghai.aliyuncs.com";
      appConfig.storage.oss.bucket = "daone-test";
      appConfig.aliyun.accessKeyId = "ak-test";
      appConfig.aliyun.accessKeySecret = "sk-test";
      appConfig.contentSafety.mockEnabled = true;
      globalThis.fetch = async (url, options) => {
        putObjectCalled = true;
        assert.equal(options.method, "PUT");
        assert.match(url, /^https:\/\/daone-test\.oss-cn-shanghai\.aliyuncs\.com\/image\/oss-user\/[0-9a-f-]{36}\.png$/);
        assert.equal(options.headers["Content-Type"], "image/png");
        assert.equal(options.headers["Content-Length"], String(uploaded.length));
        assert.match(options.headers.Authorization, /^OSS ak-test:/);
        assert.equal(Buffer.compare(options.body, uploaded), 0);
        return new Response("", { status: 200 });
      };
      const asset = await createUploadTicket("oss-user", {
        fileName: "photo.png",
        contentType: "image/png",
        fileContent: uploaded.toString("base64")
      });
      assert.equal(putObjectCalled, true);
      assert.match(asset.objectKey, /^image\/oss-user\/[0-9a-f-]{36}\.png$/);
      assert.equal(asset.url, `https://cdn.example.com/${asset.objectKey}`);
      assert.equal(asset.source, "UPLOAD");
      assert.equal(asset.status, "AVAILABLE");
    } finally {
      globalThis.fetch = originalFetch;
      appConfig.storage.mockEnabled = originalStorageMock;
      appConfig.storage.publicBaseUrl = originalPublicBaseUrl;
      appConfig.storage.oss = originalOss;
      appConfig.aliyun.accessKeyId = originalAliyun.accessKeyId;
      appConfig.aliyun.accessKeySecret = originalAliyun.accessKeySecret;
      appConfig.contentSafety.mockEnabled = originalContentSafetyMock;
    }
  });

  it("does not allow storage mock outside local runtime", async () => {
    const { createUploadTicket } = await import("../src/service/creation/assetService.js");
    const originalVercel = process.env.VERCEL;
    const originalProfile = appConfig.profile;
    const originalStorageMock = appConfig.storage.mockEnabled;
    try {
      process.env.VERCEL = "1";
      appConfig.profile = "test";
      appConfig.storage.mockEnabled = true;
      await assert.rejects(
        () => createUploadTicket("mock-user", {
          fileName: "photo.png",
          contentType: "image/png",
          fileContent: Buffer.from("mock payload").toString("base64")
        }),
        (error) => error.code === "STORAGE_MOCK_NOT_ALLOWED"
      );
    } finally {
      restoreEnv("VERCEL", originalVercel);
      appConfig.profile = originalProfile;
      appConfig.storage.mockEnabled = originalStorageMock;
    }
  });

  it("supports core frontend flow", async () => {
    let response = await request("POST", "/api/v1/auth/sms-codes", {
      phone: "13800138000",
      scene: "LOGIN"
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.code, "OK");

    response = await requestViaVercelIndex("POST", "/api/v1/auth/sms-codes", {
      phone: "13800138000",
      scene: "LOGIN"
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.code, "OK");

    response = await request("GET", "/api/health");
    assert.equal(response.status, 200);
    assert.equal(response.body.data.profile, "local");
    assert.equal(response.body.data.dataSourceType, "memory");
    assert.equal(response.body.data.mocks.storage, true);

    response = await request("POST", "/api/admin/v1/sms-codes", {
      phone: "13800138000",
      scene: "LOGIN"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/admin/v1/sms-login", {
      phone: "13800138000",
      code: "123456"
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.user.phone, "13800138000");
    assert.equal(response.body.data.user.role, "ADMIN");
    const adminUserId = response.body.data.user.id;
    assert.ok(response.body.data.token.startsWith("dn_"));
    assert.equal(response.body.data.accessToken, response.body.data.token);

    response = await request("POST", "/api/admin/v1/sms-codes", {
      phone: "13900139000",
      scene: "LOGIN"
    });
    assert.equal(response.status, 403);

    response = await request("POST", "/api/v1/auth/sms-login", {
      phone: "13800138000",
      code: "123456"
    });
    assert.equal(response.status, 200);
    const token = response.body.data.token;
    const firstUserId = response.body.data.user.id;
    assert.ok(token.startsWith("dn_"));
    assert.equal(response.body.data.accessToken, token);

    response = await request("POST", "/api/v1/auth/sms-codes", {
      phone: "13800138001",
      scene: "login"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/v1/auth/sms-login", {
      phone: " 13800138001 ",
      code: " 123456 "
    });
    assert.equal(response.status, 200);
    const secondUserId = response.body.data.user.id;

    response = await request("POST", "/api/v1/auth/sms-login", {
      phone: "13800138001",
      code: "123456"
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "SMS_CODE_INVALID");
    assert.notEqual(secondUserId, firstUserId);

    response = await request("POST", "/api/v1/auth/sms-codes", {
      phone: "13800138009",
      scene: "REGISTER"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/v1/auth/sms-login", {
      phone: "13800138009",
      code: "123456"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/v1/auth/sms-login", {
      phone: "13800138009",
      code: "123456"
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "SMS_CODE_INVALID");

    response = await request("GET", "/api/v1/home?categoryCode=BRAND", null, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.inspirationCategories.length, 9);
    assert.equal(response.body.data.inspirations.length, 1);

    response = await request("POST", "/api/v1/projects", { title: "测试项目" }, token);
    assert.equal(response.status, 200);
    const projectId = response.body.data.id;
    assert.ok(projectId);
    assert.equal(response.body.data.revision, 0);

    response = await request("POST", "/api/v1/chat-sessions", { projectId, title: "商品图对话" }, token);
    assert.equal(response.status, 200);
    const chatSessionId = response.body.data.id;

    response = await request("POST", `/api/v1/chat-sessions/${chatSessionId}/messages`, {
      content: "帮我想一个白底运动鞋商品图提示词",
      skillCode: "ECOMMERCE_IMAGE",
      modelCode: "IMAGE_GENERAL_V1",
      chatModelCode: "gpt5.5"
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.message.role, "ASSISTANT");
    assert.equal(response.body.data.message.content, "Daone mock response");
    assert.deepEqual(response.body.data.generationTaskIds, []);

    response = await request("GET", `/api/v1/chat-sessions/${chatSessionId}/messages`, null, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.records.length, 2);
    assert.equal(response.body.data.records[0].role, "USER");
    assert.equal(response.body.data.records[1].content, "Daone mock response");

    response = await request("POST", `/api/v1/chat-sessions/${chatSessionId}/messages`, {
      content: "继续优化一下，不要太夸张",
      skillCode: "ECOMMERCE_IMAGE",
      modelCode: "IMAGE_GENERAL_V1"
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.message.content, "Daone mock response");

    response = await request("GET", `/api/v1/projects/${projectId}/canvas`, null, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.revision, 0);
    assert.ok(response.body.data.canvasData);

    response = await request("GET", "/api/v1/projects");
    assert.equal(response.status, 200);
    assert.equal(response.body.data.items, undefined);
    assert.deepEqual(response.body.data.records, []);
    assert.equal(response.body.data.total, 0);

    response = await request("PUT", `/api/v1/projects/${projectId}/canvas`, {
      revision: 0,
      saveType: "MANUAL",
      canvasData: {
        version: 1,
        savedAt: new Date().toISOString(),
        meta: {
          projectId,
          projectName: "测试项目",
          canvasBgTheme: "light",
          gridVisible: false,
          panMode: false,
          showMinimap: false
        },
        viewport: {
          zoom: 1,
          translateX: 0,
          translateY: 0,
          scrollLeft: 0,
          scrollTop: 0
        },
        graph: { cells: [] },
        summary: { nodeCount: 0, edgeCount: 0 }
      }
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.revision, 1);
    assert.ok(response.body.data.savedAt);
    assert.equal(response.body.data.canvasData.version, 1);
    assert.ok(Array.isArray(response.body.data.canvasData.graph.cells));

    response = await request("POST", `/api/v1/projects/${projectId}/element-groups`, {
      projectName: "商品主视觉元素组",
      projectDescription: "商品图、标题文本和价格标签组成的一组元素",
      projectStructure: {
        cells: [
          { id: "product-image", shape: "image", x: 120, y: 80 },
          { id: "price-label", shape: "text", text: "限时优惠" }
        ]
      }
    }, token);
    assert.equal(response.status, 200);
    const elementGroupId = response.body.data.id;
    assert.ok(elementGroupId);
    assert.equal(response.body.data.projectId, projectId);
    assert.equal(response.body.data.projectName, "商品主视觉元素组");
    assert.equal(response.body.data.projectDescription, "商品图、标题文本和价格标签组成的一组元素");
    assert.equal(response.body.data.projectStructure.cells.length, 2);

    response = await request("GET", `/api/v1/projects/${projectId}/element-groups`, null, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.records.length, 1);
    assert.equal(response.body.data.records[0].id, elementGroupId);
    assert.equal(response.body.data.records[0].projectName, "商品主视觉元素组");
    assert.equal(response.body.data.records[0].projectStructure.cells.length, 2);

    response = await request("POST", `/api/v1/projects/${projectId}/element-groups`, {
      projectName: "结构错误",
      projectStructure: []
    }, token);
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "PARAM_INVALID");

    response = await request("PUT", `/api/v1/projects/${projectId}/canvas`, {
      revision: 0,
      canvasData: {
        version: 1,
        graph: { cells: [] },
        summary: { nodeCount: 0, edgeCount: 0 }
      }
    }, token);
    assert.equal(response.status, 409);
    assert.equal(response.body.code, "CANVAS_REVISION_CONFLICT");
    assert.equal(response.body.data.latestRevision, 1);

    response = await request("POST", `/api/v1/projects/${projectId}/shares`, { expireDays: 7 }, token);
    assert.equal(response.status, 200);
    const shareCode = response.body.data.shareCode;

    response = await request("GET", `/api/v1/shares/${shareCode}`);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.project.id, projectId);

    response = await requestMultipart("POST", "/api/v1/assets/upload-tickets", {
      projectId,
      file: {
        fileName: "cover.png",
        contentType: "image/png",
        content: Buffer.from("mock image")
      }
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.source, "UPLOAD");
    assert.match(response.body.data.url, /\/api\/mock-files\/image\/\d+\//);
    const objectKey = response.body.data.objectKey;

    response = await request("POST", "/api/v1/assets/upload-tickets", {
      projectId,
      fileName: "large-cover.png",
      contentType: "image/png",
      fileSize: 10 * 1024 * 1024
    }, token);
    assert.equal(response.status, 200);

    response = await request("POST", "/api/v1/assets/upload-tickets", {
      projectId,
      fileName: "too-large-cover.png",
      contentType: "image/png",
      fileSize: 10 * 1024 * 1024 + 1
    }, token);
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "FILE_SIZE_TOO_LARGE");

    response = await request("POST", "/api/v1/assets/upload-tickets", {
      projectId,
      fileName: "large-demo.mp4",
      contentType: "video/mp4",
      fileSize: 50 * 1024 * 1024
    }, token);
    assert.equal(response.status, 200);

    response = await request("POST", "/api/v1/assets/upload-tickets", {
      projectId,
      fileName: "too-large-demo.mp4",
      contentType: "video/mp4",
      fileSize: 50 * 1024 * 1024 + 1
    }, token);
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "FILE_SIZE_TOO_LARGE");

    response = await request("GET", `/api/mock-files/${objectKey}`);
    assert.equal(response.status, 200);
    assert.match(response.rawBody, /Daone Mock File/);

    response = await request("GET", "/api/v1/ai/capabilities", null, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.items.length, 3);
    assert.equal(response.body.data.items.find((item) => item.code === "IMAGE_GENERAL_V1").estimatedPoints, 20);

    response = await request("POST", "/api/v1/generation-tasks", {
      projectId,
      capabilityCode: "IMAGE_GENERAL_V1",
      prompt: "白底运动鞋",
      parameters: { count: 2 }
    }, token, { "Idempotency-Key": "task-1" });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "SUCCEEDED");
    assert.equal(response.body.data.results.length, 2);
    assert.equal(response.body.data.resultThumbnails.length, 2);

    response = await request("GET", `/api/v1/assets?scope=FILES&projectId=${projectId}`, null, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.records.length, 5);
    assert.equal(response.body.data.items, undefined);

    response = await request("GET", "/api/v1/assets?scope=CENTER", null, token);
    assert.equal(response.status, 200);
    assert.ok(response.body.data.records.length >= 1);
    assert.equal(response.body.data.items, undefined);

    response = await request("GET", `/api/v1/assets?scope=CENTER&projectId=${projectId}`, null, token);
    assert.equal(response.status, 200);
    assert.ok(response.body.data.records.length >= 1);
    assert.equal(response.body.data.items, undefined);

    response = await request("POST", "/api/v1/generation-tasks", {
      projectId,
      capabilityCode: "VIDEO_GENERAL_V1",
      prompt: "一个高成本视频",
      parameters: {}
    }, token, { "Idempotency-Key": "task-expensive" });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "POINTS_NOT_ENOUGH");

    response = await request("POST", "/api/v1/provider/chat/completions", {
      model: "gpt5.5",
      messages: [{ role: "user", content: "hello" }]
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.object, "chat.completion");
    assert.equal(response.body.model, "gpt-5.5");
    assert.equal(response.body.choices[0].message.role, "assistant");
    assert.equal(response.body.traceId, undefined);
    assert.equal(response.body.code, undefined);
    assert.equal(response.body.data, undefined);

    response = await request("GET", "/api/v1/provider/chat/models", null, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.code, "OK");
    assert.ok(response.body.data.items.some((item) => item.code === "gpt5.5" && item.model === "gpt-5.5"));
    assert.ok(response.body.data.items.some((item) => item.code === "gemini-3-1-pro-preview" && item.model === "gemini-3.1-pro-preview"));
    assert.ok(response.body.data.items.every((item) => item.type === "MULTIMODAL_CHAT" && item.gateway === "CHAT"));
    assert.ok(response.body.data.items.every((item) => item.supportsStreaming === true));

    response = await request("GET", "/api/v1/provider/chat/models?type=image", null, token);
    assert.equal(response.status, 200);
    assert.ok(response.body.data.items.some((item) => item.code === "image2.0" && item.model === "gpt-image-2"));
    assert.ok(response.body.data.items.some((item) => item.code === "nanobanana-2.0" && item.model === "gemini-3.1-flash-image-preview"));
    assert.ok(response.body.data.items.every((item) => item.type === "IMAGE_GENERATION" && item.gateway === "IMAGE"));
    assert.ok(!response.body.data.items.some((item) => item.code === "gpt5.5"));

    response = await request("GET", "/api/v1/provider/chat/models?type=video", null, token);
    assert.equal(response.status, 200);
    assert.ok(response.body.data.items.some((item) => item.code === "seedance2.0" && item.model === "seedance2.0"));
    assert.ok(response.body.data.items.some((item) => item.code === "happy-horse" && item.model === "happy-horse"));
    assert.ok(response.body.data.items.every((item) => item.type === "VIDEO_GENERATION" && item.gateway === "VIDEO"));
    assert.ok(!response.body.data.items.some((item) => item.code === "image2.0"));

    response = await request("GET", "/api/v1/provider/chat/models?type=audio", null, token);
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "PROVIDER_MODEL_TYPE_NOT_SUPPORTED");

    response = await request("GET", "/api/v1/provider/chat/models?type=multimodal_chat", null, token);
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "PROVIDER_MODEL_TYPE_NOT_SUPPORTED");

    response = await request("GET", "/api/v1/provider/chat/models?type=image_generation", null, token);
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "PROVIDER_MODEL_TYPE_NOT_SUPPORTED");

    response = await request("GET", "/api/v1/provider/chat/models?type=video_generation", null, token);
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "PROVIDER_MODEL_TYPE_NOT_SUPPORTED");

    response = await request("GET", "/api/v1/provider/chat/models?type=dialog", null, token);
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "PROVIDER_MODEL_TYPE_NOT_SUPPORTED");

    response = await request("POST", "/api/v1/provider/chat/completions", {
      model: "gemini-3-1-pro-preview",
      messages: [{ role: "user", content: "hello" }]
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.object, "chat.completion");
    assert.equal(response.body.model, "gemini-3.1-pro-preview");

    response = await request("POST", "/api/v1/provider/chat/completions", {
      model: "Codex",
      messages: [{ role: "user", content: "hello" }],
      stream: true
    }, token);
    assert.equal(response.status, 200);
    assert.match(response.headers["content-type"], /text\/event-stream/);
    assert.match(response.rawBody, /chat\.completion\.chunk/);
    assert.match(response.rawBody, /^data: /);
    assert.match(response.rawBody, /data: \[DONE\]\n\n$/);

    response = await request("POST", "/api/v1/provider/images/generations", {
      model: "image2.0",
      prompt: "white sneaker",
      n: 1
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.traceId, undefined);

    response = await request("POST", "/api/v1/provider/images/generations", {
      model: "Nanobanana 2.0",
      prompt: "white sneaker",
      stream: true
    }, token);
    assert.equal(response.status, 200);
    assert.match(response.headers["content-type"], /text\/event-stream/);
    assert.match(response.rawBody, /^data: /);
    assert.match(response.rawBody, /data: \[DONE\]\n\n$/);

    response = await request("POST", "/api/v1/provider/videos/generations", {
      model: "seedance2.0",
      prompt: "product video",
      stream: false
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.object, "video.generation");
    assert.equal(response.body.model, "seedance2.0");
    assert.equal(response.body.provider, "seedance");
    assert.equal(response.body.traceId, undefined);

    response = await request("POST", "/api/v1/provider/videos/generations", {
      model: "happy-horse",
      prompt: "product video",
      stream: true
    }, token);
    assert.equal(response.status, 200);
    assert.match(response.headers["content-type"], /text\/event-stream/);
    assert.match(response.rawBody, /^data: /);
    assert.match(response.rawBody, /video\.generation\.chunk/);
    assert.match(response.rawBody, /"model":"happy-horse"/);
    assert.match(response.rawBody, /data: \[DONE\]\n\n$/);

    response = await request("GET", "/api/v1/provider/tools", null, token);
    assert.equal(response.status, 200);
    assert.ok(response.body.data.items.some((item) => item.code === "remove-background"));
    assert.equal(response.body.data.items.find((item) => item.code === "remove-background").label, "抠图");
    assert.equal(response.body.data.toolbars.imageNodeToolbar.actions[0].key, "cutout");
    assert.equal(response.body.data.toolbars.imageNodeToolbar.actions[0].children[0].code, "cutout.quick");
    assert.equal(response.body.data.toolbars.imageNodeToolbar.actions[0].children[0].toolCode, "remove-background");
    assert.equal(response.body.data.toolbars.imageNodeToolbar.actions[0].children[2].code, "cutout.eraser");
    assert.equal(response.body.data.toolbars.imageNodeToolbar.actions[2].children[0].code, "crop.free");
    assert.equal(response.body.data.toolbars.imageNodeToolbarMore.actions[0].children[1].code, "split.grid-9");
    assert.equal(response.body.data.toolbars.imageNodeToolbarMore.actions[3].children[0].code, "erase.smart");
    assert.equal(response.body.data.toolbars.imageNodeToolbarMore.actions[3].children[0].toolCode, "eraser");
    assert.equal(response.body.data.toolbars.imageNodeToolbarMoreMenu[4].children[0].code, "adjust.brightness");
    assert.equal(response.body.data.toolbars.imageCutoutModes[2].toolCode, "eraser");

    response = await request("POST", "/api/v1/provider/tools/remove-background", {
      imageUrl: "https://example.com/a.png"
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "SUCCEEDED");

    response = await request("GET", "/api/v1/plans", null, token);
    assert.equal(response.status, 200);
    assert.ok(response.body.data.items.length >= 9);
    assert.ok(response.body.data.items.some((item) => item.code === "ENTERPRISE_TWO_YEARS"));
    assert.ok(response.body.data.items.some((item) => item.code === "TRIAL_5D"));

    response = await request("GET", "/api/v1/plans");
    assert.equal(response.status, 200);
    assert.ok(response.body.data.items.some((item) => item.code === "TEAM_YEAR"));

    response = await request("POST", "/api/v1/trial-applications/sms-codes", {
      phone: "13900139000"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/v1/trial-applications", {
      phone: "13900139000",
      code: "123456",
      contactName: "试用客户",
      position: "运营负责人"
    }, null, { "Idempotency-Key": "trial-1" });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.amountFen, 9900);

    response = await request("POST", "/api/v1/orders", {
      orderType: "PLAN",
      productCode: "TEAM_MONTH"
    }, token, { "Idempotency-Key": "order-1" });
    assert.equal(response.status, 200);
    const orderNo = response.body.data.orderNo;

    response = await request("POST", `/api/v1/orders/${orderNo}/payments`, {
      payType: "WECHAT"
    }, token);
    assert.equal(response.status, 200);
    assert.ok(response.body.data.qrCodeContent);

    response = await request("POST", `/api/v1/orders/${orderNo}/mock-paid`, {}, token);
    assert.equal(response.status, 200);

    response = await request("GET", `/api/v1/orders/${orderNo}`, null, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "PAID");

    response = await request("GET", "/api/v1/users/me", null, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.vipName, "团队协作版");
    assert.equal(response.body.data.subscription.planName, "团队协作版");

    response = await request("POST", "/api/v1/orders", {
      orderType: "PLAN",
      productCode: "TEAM_MONTH"
    }, token, { "Idempotency-Key": "order-2" });
    assert.equal(response.status, 200);
    const nonLocalPaymentOrderNo = response.body.data.orderNo;
    const originalNonLocalProfile = appConfig.profile;
    const originalNonLocalPaymentMock = appConfig.payment.mockEnabled;
    try {
      appConfig.profile = "test";
      appConfig.payment.mockEnabled = true;
      response = await request("POST", `/api/v1/orders/${nonLocalPaymentOrderNo}/payments`, {
        payType: "ALIPAY"
      }, token);
      assert.equal(response.status, 502);
      assert.equal(response.body.code, "PAYMENT_FAILED");
    } finally {
      appConfig.profile = originalNonLocalProfile;
      appConfig.payment.mockEnabled = originalNonLocalPaymentMock;
    }

    const originalProfile = appConfig.profile;
    const originalPaymentMock = appConfig.payment.mockEnabled;
    try {
      appConfig.profile = "prod";
      appConfig.payment.mockEnabled = false;
      response = await request("POST", `/api/v1/orders/${orderNo}/mock-paid`, {}, token);
      assert.equal(response.status, 403);
    } finally {
      appConfig.profile = originalProfile;
      appConfig.payment.mockEnabled = originalPaymentMock;
    }

    const originalStorageMock = appConfig.storage.mockEnabled;
    appConfig.storage.mockEnabled = false;
    response = await request("GET", "/api/mock-files/image/test.png");
    assert.equal(response.status, 404);
    response = await request("POST", "/api/mock-files/upload", {});
    assert.equal(response.status, 404);
    appConfig.storage.mockEnabled = originalStorageMock;

    response = await request("GET", "/api/admin/v1/users", null, token);
    assert.equal(response.status, 200);
    assert.ok(response.body.data.records.length >= 1);
    assert.equal(response.body.data.records.some((item) => item.id === adminUserId), true);
    assert.equal(response.body.data.records.some((item) => item.id === secondUserId), true);

    response = await request("GET", "/api/admin/v1/dashboard", null, token);
    assert.equal(response.status, 200);
    assert.equal(typeof response.body.data.overview.totalUsers, "number");
    assert.ok(Array.isArray(response.body.data.trends));

    response = await request("GET", `/api/admin/v1/users/${firstUserId}`, null, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.id, firstUserId);
    assert.equal(typeof response.body.data.projectCount, "number");

    response = await request("POST", "/api/admin/v1/plans", {
      planCode: "PRO",
      planName: "专业版",
      benefits: ["2000积分/月"],
      prices: [{ priceCode: "PRO_MONTH", cycleUnit: "MONTH", cycleCount: 1, priceFen: 9900, grantPoints: 2000 }]
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.planCode, "PRO");

    response = await request("PATCH", "/api/admin/v1/plans/PRO/status", { status: "DISABLED" }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "DISABLED");

    response = await request("POST", "/api/admin/v1/plans", {
      planCode: "FRONT_FORM",
      planName: "前端表单版",
      benefitsText: "1000积分/月\n模板中心",
      pricesText: JSON.stringify([{ priceCode: "FRONT_FORM_MONTH", cycleUnit: "MONTH", cycleCount: 1, priceFen: 4900, grantPoints: 1000 }])
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.prices[0].priceCode, "FRONT_FORM_MONTH");

    response = await request("PATCH", "/api/admin/v1/plans/FRONT_FORM/status", { status: "停用" }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "DISABLED");

    response = await request("DELETE", "/api/admin/v1/plans/FRONT_FORM", null, token);
    assert.equal(response.status, 204);

    response = await request("GET", "/api/admin/v1/plans/FRONT_FORM", null, token);
    assert.equal(response.status, 404);

    response = await request("GET", "/api/admin/v1/plans/PRO", null, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.planCode, "PRO");

    response = await request("PUT", "/api/admin/v1/model-configs/IMAGE_GENERAL_V1", {
      basePoints: 25,
      parameters: { count: { min: 1, max: 4 } }
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.basePoints, 25);

    response = await request("GET", "/api/admin/v1/model-configs/IMAGE_GENERAL_V1", null, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.modelCode, "IMAGE_GENERAL_V1");

    response = await request("GET", "/api/admin/v1/model-configs", null, token);
    assert.equal(response.status, 200);
    assert.ok(response.body.data.items.some((item) => item.modelCode === "gpt5.5" && item.surface === "PROVIDER" && item.gateway === "CHAT"));
    assert.ok(response.body.data.items.some((item) => item.modelCode === "image2.0" && item.surface === "PROVIDER" && item.gateway === "IMAGE"));
    assert.ok(response.body.data.items.some((item) => item.modelCode === "happy-horse" && item.surface === "PROVIDER" && item.gateway === "VIDEO"));

    response = await request("PATCH", "/api/admin/v1/model-configs/gpt5.5/status", { status: "DISABLED" }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "DISABLED");

    response = await request("GET", "/api/v1/provider/chat/models", null, token);
    assert.equal(response.status, 200);
    assert.ok(!response.body.data.items.some((item) => item.code === "gpt5.5"));

    response = await request("POST", "/api/v1/provider/chat/completions", {
      model: "gpt5.5",
      messages: [{ role: "user", content: "hello" }]
    }, token);
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "MODEL_DISABLED");

    response = await request("PATCH", "/api/admin/v1/model-configs/gpt5.5/status", { status: "ENABLED" }, token);
    assert.equal(response.status, 200);

    response = await request("PATCH", "/api/admin/v1/model-configs/IMAGE_GENERAL_V1/status", { status: "ENABLED" }, token);
    assert.equal(response.status, 200);

    response = await request("POST", "/api/admin/v1/prompt-templates", {
      code: "IMAGE_POSTER",
      name: "图片海报提示词",
      scenario: "IMAGE",
      content: "生成一张商业海报"
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.code, "IMAGE_POSTER");

    response = await request("PUT", "/api/admin/v1/prompt-templates/IMAGE_POSTER", {
      name: "图片海报提示词 v2",
      content: "生成一张高级商业海报"
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.name, "图片海报提示词 v2");

    response = await request("PATCH", "/api/admin/v1/prompt-templates/IMAGE_POSTER/status", { status: "DISABLED" }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "DISABLED");

    response = await request("DELETE", "/api/admin/v1/prompt-templates/IMAGE_POSTER", null, token);
    assert.equal(response.status, 204);

    response = await request("GET", "/api/admin/v1/prompt-templates/IMAGE_POSTER", null, token);
    assert.equal(response.status, 404);

    response = await request("POST", "/api/admin/v1/categories", {
      categoryCode: "ECOMMERCE",
      categoryName: "电商营销",
      scope: "ALL",
      sortNo: 5
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.categoryCode, "ECOMMERCE");

    response = await request("GET", "/api/v1/home", null, token);
    assert.equal(response.status, 200);
    assert.ok(response.body.data.inspirationCategories.some((item) => item.code === "ECOMMERCE" && item.name === "电商营销"));

    response = await request("PATCH", "/api/admin/v1/categories/ECOMMERCE/status", { status: "DISABLED" }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "DISABLED");

    response = await request("GET", "/api/v1/home", null, token);
    assert.equal(response.status, 200);
    assert.ok(!response.body.data.inspirationCategories.some((item) => item.code === "ECOMMERCE"));

    response = await request("GET", "/api/admin/v1/categories", null, token);
    assert.equal(response.status, 200);
    assert.ok(response.body.data.records.some((item) => item.categoryCode === "ECOMMERCE"));

    response = await request("POST", "/api/admin/v1/workflows", {
      name: "后台测试工作流",
      description: "后台接口测试",
      categoryCode: "ECOMMERCE",
      categoryName: "电商营销",
      workflowData: { nodes: [{ id: "n1" }], edges: [] }
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.nodeCount, 1);
    const adminWorkflowId = response.body.data.id;

    response = await request("PATCH", `/api/admin/v1/workflows/${adminWorkflowId}/status`, { status: "DISABLED" }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "DISABLED");

    response = await request("GET", `/api/admin/v1/workflows/${adminWorkflowId}`, null, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.id, adminWorkflowId);

    response = await request("DELETE", `/api/admin/v1/workflows/${adminWorkflowId}`, null, token);
    assert.equal(response.status, 204);

    response = await request("GET", `/api/admin/v1/workflows/${adminWorkflowId}`, null, token);
    assert.equal(response.status, 404);

    response = await request("POST", "/api/admin/v1/invoices", {
      userId: firstUserId,
      orderNo,
      invoiceTitle: "测试公司",
      taxNo: "913300000000000000",
      invoiceType: "VAT_NORMAL",
      amountFen: 9900
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.invoiceTitle, "测试公司");
    const invoiceId = response.body.data.id;

    response = await request("PATCH", `/api/admin/v1/invoices/${invoiceId}/status`, { status: "ISSUED" }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "ISSUED");
    assert.ok(response.body.data.issuedAt);

    response = await request("DELETE", `/api/admin/v1/invoices/${invoiceId}`, null, token);
    assert.equal(response.status, 204);

    response = await request("GET", `/api/admin/v1/invoices/${invoiceId}`, null, token);
    assert.equal(response.status, 404);

    response = await request("GET", `/api/admin/v1/orders/${orderNo}`, null, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.orderNo, orderNo);
    assert.ok(Array.isArray(response.body.data.transactions));

    response = await request("POST", "/api/admin/v1/inspirations", {
      title: "测试灵感",
      categoryCode: "ECOMMERCE",
      coverUrl: "https://example.com/cover.png",
      prompt: "生成一张测试海报"
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.prompt, "生成一张测试海报");
    const inspirationId = response.body.data.id;

    response = await request("PATCH", `/api/admin/v1/inspirations/${inspirationId}/status`, { status: "DISABLED" }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "DISABLED");

    response = await request("DELETE", `/api/admin/v1/inspirations/${inspirationId}`, null, token);
    assert.equal(response.status, 204);

    response = await request("GET", `/api/admin/v1/inspirations/${inspirationId}`, null, token);
    assert.equal(response.status, 404);

    response = await request("DELETE", "/api/admin/v1/categories/ECOMMERCE", null, token);
    assert.equal(response.status, 204);

    response = await request("GET", "/api/admin/v1/categories/ECOMMERCE", null, token);
    assert.equal(response.status, 404);

    response = await request("DELETE", `/api/v1/projects/${projectId}/shares/${shareCode}`, null, token);
    assert.equal(response.status, 204);

    response = await request("GET", "/api/v3/swagger");
    assert.equal(response.status, 200);
    assert.equal(response.body.info.title, "Daone Node API");
    assert.equal(response.body.paths["/v1/auth/sms-codes"].post.requestBody.content["application/json"].schema.$ref, "#/components/schemas/SmsCodeRequest");
    assert.equal(response.body.paths["/admin/v1/sms-codes"].post.requestBody.content["application/json"].schema.$ref, "#/components/schemas/AdminSmsCodeRequest");
    assert.equal(response.body.paths["/admin/v1/sms-login"].post.requestBody.content["application/json"].schema.$ref, "#/components/schemas/AdminSmsLoginRequest");
    assert.equal(response.body.paths["/v1/projects"].get.parameters.some((parameter) => parameter.name === "keyword" && parameter.in === "query"), true);
    assert.equal(response.body.paths["/v1/projects/{projectId}"].get.parameters.some((parameter) => parameter.name === "projectId" && parameter.in === "path"), true);

    response = await request("GET", "/api/doc.html");
    assert.equal(response.status, 200);
    assert.match(response.rawBody, /data-ui="knife4j"/);
    assert.match(response.rawBody, /\/api\/v3\/swagger/);
  });

  it("returns monotonic project ids and restores sequence from runtime snapshot", async () => {
    const { exportStoreSnapshot, importStoreSnapshot } = await import("../src/infrastructure/db/memoryStore.js");
    const { setSequence } = await import("../src/infrastructure/common/id.js");

    let response = await request("POST", "/api/v1/auth/sms-codes", {
      phone: "13800138002",
      scene: "LOGIN"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/v1/auth/sms-login", {
      phone: "13800138002",
      code: "123456"
    });
    assert.equal(response.status, 200);
    const token = response.body.data.token;

    response = await request("POST", "/api/v1/projects", { title: "项目 A" }, token);
    assert.equal(response.status, 200);
    const firstProjectId = BigInt(response.body.data.id);

    response = await request("POST", "/api/v1/projects", { title: "项目 B" }, token);
    assert.equal(response.status, 200);
    const secondProjectId = BigInt(response.body.data.id);
    assert.equal(secondProjectId, firstProjectId + 1n);

    const snapshot = exportStoreSnapshot();
    assert.ok(snapshot._sequence);
    assert.equal(BigInt(snapshot._sequence), secondProjectId);

    setSequence(1000n);
    importStoreSnapshot(snapshot);

    response = await request("POST", "/api/v1/projects", { title: "项目 C" }, token);
    assert.equal(response.status, 200);
    const thirdProjectId = BigInt(response.body.data.id);
    assert.ok(thirdProjectId > secondProjectId);

    const legacySnapshot = { ...snapshot };
    delete legacySnapshot._sequence;
    setSequence(1000n);
    importStoreSnapshot(legacySnapshot);

    response = await request("POST", "/api/v1/projects", { title: "项目 D" }, token);
    assert.equal(response.status, 200);
    assert.ok(BigInt(response.body.data.id) > thirdProjectId);
  });

  it("keeps project id stable when patching title and canvas meta", async () => {
    let response = await request("POST", "/api/v1/auth/sms-codes", {
      phone: "13800138005",
      scene: "LOGIN"
    });
    assert.equal(response.status, 200);

    response = await request("POST", "/api/v1/auth/sms-login", {
      phone: "13800138005",
      code: "123456"
    });
    assert.equal(response.status, 200);
    const token = response.body.data.token;

    response = await request("POST", "/api/v1/projects", { title: "原始名称" }, token);
    assert.equal(response.status, 200);
    const projectId = response.body.data.id;

    response = await request("PUT", `/api/v1/projects/${projectId}/canvas`, {
      revision: 0,
      canvasData: {
        version: 1,
        meta: {
          projectId: "WRONG_ID",
          projectName: "原始名称"
        },
        graph: { cells: [] },
        summary: { nodeCount: 0, edgeCount: 0 }
      }
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.canvasData.meta.projectId, projectId);

    response = await request("PATCH", `/api/v1/projects/${projectId}`, { title: "新名称" }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.id, projectId);
    assert.equal(response.body.data.title, "新名称");

    response = await request("GET", `/api/v1/projects/${projectId}/canvas`, null, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.canvasData.meta.projectId, projectId);
    assert.equal(response.body.data.canvasData.meta.projectName, "新名称");
  });

  it("creates signed Alipay page payments with redirect url", async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" }
    });
    const originalProfile = appConfig.profile;
    const originalPaymentMock = appConfig.payment.mockEnabled;
    const originalAlipay = { ...appConfig.payment.alipay };
    try {
      appConfig.profile = "test";
      appConfig.payment.mockEnabled = false;
      appConfig.payment.alipay.appId = "2021000000000000";
      appConfig.payment.alipay.privateKey = privateKey;
      appConfig.payment.alipay.publicKey = publicKey;
      appConfig.payment.alipay.notifyUrl = "https://www.daoneai.com/api/v1/payments/ALIPAY/notify";
      const payment = await createChannelPayment({
        orderNo: "DNTEST",
        productName: "测试套餐",
        amountFen: 9900,
        currency: "CNY"
      }, "ALIPAY");
      assert.equal(payment.payType, "ALIPAY");
      assert.match(payment.redirectUrl, /^https:\/\/openapi\.alipay\.com\/gateway\.do\?/);
      assert.match(payment.qrCodeContent, /^data:image\/png;base64,/);
      assert.deepEqual(pngDimensions(payment.qrCodeContent), { width: 512, height: 512 });
      const url = new URL(payment.redirectUrl);
      assert.equal(url.searchParams.get("method"), "alipay.trade.page.pay");
      assert.equal(url.searchParams.get("app_id"), "2021000000000000");
      const bizContent = JSON.parse(url.searchParams.get("biz_content"));
      assert.equal(bizContent.out_trade_no, "DNTEST");
      assert.equal(bizContent.total_amount, "99.00");
      assert.equal(bizContent.subject, "测试套餐");
      assert.equal(bizContent.product_code, "FAST_INSTANT_TRADE_PAY");
      const sign = url.searchParams.get("sign");
      url.searchParams.delete("sign");
      const signContent = [...url.searchParams.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, value]) => `${key}=${value}`)
        .join("&");
      assert.equal(crypto.verify("RSA-SHA256", Buffer.from(signContent), publicKey, Buffer.from(sign, "base64")), true);
    } finally {
      appConfig.profile = originalProfile;
      appConfig.payment.mockEnabled = originalPaymentMock;
      appConfig.payment.alipay = originalAlipay;
    }
  });

  it("accepts signed Alipay page payment notifications", async () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" }
    });
    const originalPaymentMock = appConfig.payment.mockEnabled;
    const originalAlipay = { ...appConfig.payment.alipay };
    try {
      appConfig.payment.mockEnabled = false;
      appConfig.payment.alipay.appId = "2021000000000000";
      appConfig.payment.alipay.privateKey = privateKey;
      appConfig.payment.alipay.publicKey = publicKey;
      appConfig.payment.alipay.notifyUrl = "https://www.daoneai.com/api/v1/payments/ALIPAY/notify";

      let response = await request("POST", "/api/v1/auth/sms-codes", {
        phone: "13800138006",
        scene: "LOGIN"
      });
      assert.equal(response.status, 200);

      response = await request("POST", "/api/v1/auth/sms-login", {
        phone: "13800138006",
        code: "123456"
      });
      assert.equal(response.status, 200);
      const token = response.body.data.token;

      response = await request("POST", "/api/v1/orders", {
        orderType: "PLAN",
        productCode: "TEAM_MONTH"
      }, token, { "Idempotency-Key": "alipay-order-1" });
      assert.equal(response.status, 200);
      const orderNo = response.body.data.orderNo;

      response = await request("POST", `/api/v1/orders/${orderNo}/payments`, {
        payType: "ALIPAY"
      }, token);
      assert.equal(response.status, 200);
      assert.ok(response.body.data.redirectUrl);
      assert.match(response.body.data.qrCodeContent, /^data:image\/png;base64,/);

      response = await request("POST", `/api/v1/orders/${orderNo}/payments`, {
        payType: "ALIPAY"
      }, token);
      assert.equal(response.status, 200);
      assert.match(response.body.data.qrCodeContent, /^data:image\/png;base64,/);

      const notifyBody = signedAlipayNotify({
        app_id: "2021000000000000",
        trade_no: "2026062622000000000001",
        out_trade_no: orderNo,
        trade_status: "TRADE_SUCCESS",
        total_amount: "699.00",
        seller_id: "2088000000000000",
        timestamp: "2026-06-26 12:00:00"
      }, privateKey);
      response = await requestForm("POST", "/api/v1/payments/ALIPAY/notify", notifyBody);
      assert.equal(response.status, 200);
      assert.equal(response.rawBody, "success");

      response = await request("GET", `/api/v1/orders/${orderNo}`, null, token);
      assert.equal(response.status, 200);
      assert.equal(response.body.data.status, "PAID");
    } finally {
      appConfig.payment.mockEnabled = originalPaymentMock;
      appConfig.payment.alipay = originalAlipay;
    }
  });
});

async function request(method, path, body = null, token = null, extraHeaders = {}) {
  const req = makeReq(method, path, body, token, extraHeaders);
  const res = makeRes();
  await handleRequest(req, res);
  return {
    status: res.statusCode,
    body: parseJson(res.body),
    rawBody: res.body,
    headers: res.headers
  };
}

async function requestMultipart(method, path, body, token = null) {
  const req = makeMultipartReq(method, path, body, token);
  const res = makeRes();
  await handleRequest(req, res);
  return {
    status: res.statusCode,
    body: parseJson(res.body),
    rawBody: res.body,
    headers: res.headers
  };
}

async function requestForm(method, path, body, token = null) {
  const req = makeFormReq(method, path, body, token);
  const res = makeRes();
  await handleRequest(req, res);
  return {
    status: res.statusCode,
    body: parseJson(res.body),
    rawBody: res.body,
    headers: res.headers
  };
}

async function requestViaVercelIndex(method, path, body = null, token = null, extraHeaders = {}) {
  const req = makeReq(method, rewrittenIndexPath(path), body, token, extraHeaders);
  const res = makeRes();
  await vercelIndexHandler(req, res);
  return {
    status: res.statusCode,
    body: parseJson(res.body),
    rawBody: res.body,
    headers: res.headers
  };
}

function makeMultipartReq(method, path, body, token) {
  const boundary = `----daone-test-${crypto.randomUUID()}`;
  const chunks = [];
  for (const [name, value] of Object.entries(body)) {
    if (value && Buffer.isBuffer(value.content)) {
      chunks.push(Buffer.from(`--${boundary}\r\n`));
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${name}"; filename="${value.fileName}"\r\n`));
      chunks.push(Buffer.from(`Content-Type: ${value.contentType}\r\n\r\n`));
      chunks.push(value.content);
      chunks.push(Buffer.from("\r\n"));
    } else {
      chunks.push(Buffer.from(`--${boundary}\r\n`));
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${name}"\r\n\r\n`));
      chunks.push(Buffer.from(String(value)));
      chunks.push(Buffer.from("\r\n"));
    }
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  const payload = Buffer.concat(chunks);
  const headers = {
    host: "localhost:8080",
    "content-type": `multipart/form-data; boundary=${boundary}`,
    "content-length": String(payload.length)
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return {
    method,
    url: path,
    headers,
    async *[Symbol.asyncIterator]() {
      yield payload;
    }
  };
}

function rewrittenIndexPath(path) {
  const url = new URL(path, "http://localhost:8080");
  const rewrittenPath = url.pathname.startsWith("/api/")
    ? url.pathname.slice("/api/".length)
    : url.pathname.replace(/^\//, "");
  url.searchParams.set("__daone_path", rewrittenPath);
  return `/api?${url.searchParams.toString()}`;
}

function makeReq(method, path, body, token, extraHeaders) {
  const payload = body === null ? "" : JSON.stringify(body);
  const headers = {
    host: "localhost:8080",
    "content-type": "application/json",
    ...lowerHeaders(extraHeaders)
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return {
    method,
    url: path,
    headers,
    async *[Symbol.asyncIterator]() {
      if (payload) yield Buffer.from(payload);
    }
  };
}

function makeFormReq(method, path, body, token) {
  const payload = new URLSearchParams(body).toString();
  const headers = {
    host: "localhost:8080",
    "content-type": "application/x-www-form-urlencoded",
    "content-length": String(Buffer.byteLength(payload))
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return {
    method,
    url: path,
    headers,
    async *[Symbol.asyncIterator]() {
      if (payload) yield Buffer.from(payload);
    }
  };
}

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(value = "") {
      this.body += value;
    }
  };
}

function lowerHeaders(headers) {
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function signedAlipayNotify(body, privateKey) {
  const signContent = Object.entries(body)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");
  return {
    ...body,
    sign_type: "RSA2",
    sign: crypto.sign("RSA-SHA256", Buffer.from(signContent), privateKey).toString("base64")
  };
}

function pngDimensions(dataUrl) {
  const buffer = Buffer.from(dataUrl.split(",")[1], "base64");
  assert.equal(buffer.toString("ascii", 1, 4), "PNG");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
