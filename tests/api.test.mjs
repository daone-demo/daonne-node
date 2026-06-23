import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.DAONE_PROFILE = "local";
process.env.DAONE_ADMIN_PHONES = "13800138000";
const { handleRequest } = await import("../src/starter/app.js");
const { default: vercelIndexHandler } = await import("../api/index.js");
const { appConfig } = await import("../src/infrastructure/config/env.js");

describe("Daone Vercel Node API", () => {
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
    assert.ok(response.body.data.token.startsWith("dn_"));

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
    assert.equal(response.status, 200);
    assert.equal(response.body.data.user.id, secondUserId);
    assert.notEqual(response.body.data.user.id, firstUserId);

    response = await request("GET", "/api/v1/home?categoryCode=BRAND", null, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.inspirationCategories.length, 9);
    assert.equal(response.body.data.inspirations.length, 1);

    response = await request("POST", "/api/v1/projects", { title: "测试项目" }, token);
    assert.equal(response.status, 200);
    const projectId = response.body.data.id;
    assert.ok(projectId);
    assert.equal(response.body.data.revision, 0);

    response = await request("GET", `/api/v1/projects/${projectId}/canvas`, null, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.revision, 0);
    assert.ok(response.body.data.canvasData);

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

    response = await request("POST", "/api/v1/assets/upload-tickets", {
      projectId,
      fileName: "cover.png",
      contentType: "image/png",
      fileSize: 128
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.uploadUrl, "/api/mock-files/upload");
    const uploadTicket = response.body.data.uploadTicket;

    response = await request("GET", `/api/mock-files/${response.body.data.objectKey}`);
    assert.equal(response.status, 200);
    assert.match(response.rawBody, /Daone Mock File/);

    response = await request("POST", "/api/v1/assets", {
      uploadTicket,
      projectId,
      fileSize: 128
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.source, "UPLOAD");

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
    assert.equal(response.body.data.items.length, 3);

    response = await request("GET", "/api/v1/assets?scope=CENTER", null, token);
    assert.equal(response.status, 200);
    assert.ok(response.body.data.items.length >= 1);

    response = await request("GET", `/api/v1/assets?scope=CENTER&projectId=${projectId}`, null, token);
    assert.equal(response.status, 200);
    assert.ok(response.body.data.items.length >= 1);

    response = await request("POST", "/api/v1/generation-tasks", {
      projectId,
      capabilityCode: "VIDEO_GENERAL_V1",
      prompt: "一个高成本视频",
      parameters: {}
    }, token, { "Idempotency-Key": "task-expensive" });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, "POINTS_NOT_ENOUGH");

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

    const originalProfile = appConfig.profile;
    const originalPaymentMock = appConfig.payment.mockEnabled;
    appConfig.profile = "prod";
    appConfig.payment.mockEnabled = false;
    response = await request("POST", `/api/v1/orders/${orderNo}/mock-paid`, {}, token);
    assert.equal(response.status, 403);
    appConfig.profile = originalProfile;
    appConfig.payment.mockEnabled = originalPaymentMock;

    const originalStorageMock = appConfig.storage.mockEnabled;
    appConfig.storage.mockEnabled = false;
    response = await request("GET", "/api/mock-files/user/test.png");
    assert.equal(response.status, 404);
    response = await request("POST", "/api/mock-files/upload", {});
    assert.equal(response.status, 404);
    appConfig.storage.mockEnabled = originalStorageMock;

    response = await request("GET", "/api/admin/v1/users", null, token);
    assert.equal(response.status, 200);
    assert.ok(response.body.data.records.length >= 1);

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

    response = await request("PUT", "/api/admin/v1/model-configs/IMAGE_GENERAL_V1", {
      basePoints: 25,
      parameters: { count: { min: 1, max: 4 } }
    }, token);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.basePoints, 25);

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
    assert.match(response.rawBody, /SwaggerUIBundle/);
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
