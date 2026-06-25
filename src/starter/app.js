import { Router } from "../service/common/router.js";
import { appConfig, configHealth } from "../infrastructure/config/env.js";
import { readJson, parsePage, paginate } from "../service/common/http.js";
import { pageResponse, sendError, sendJson, sendNoContent, success, traceId } from "../service/common/response.js";
import { forbidden, notFound, unauthorized } from "../service/common/errors.js";
import * as auth from "../service/auth/authService.js";
import * as userService from "../service/user/userService.js";
import * as projectService from "../service/creation/projectService.js";
import * as shareService from "../service/creation/shareService.js";
import * as assetService from "../service/creation/assetService.js";
import * as aiService from "../service/creation/aiService.js";
import * as chatService from "../service/creation/chatService.js";
import * as workflowService from "../service/creation/workflowService.js";
import * as billingService from "../service/billing/billingService.js";
import * as trialService from "../service/billing/trialService.js";
import * as homeService from "../service/home/homeService.js";
import * as adminService from "../service/admin/adminService.js";
import * as modelClient from "../infrastructure/middleware/modelClient.js";
import { docsHtml, openApiSpec } from "./openapi.js";
import { hydrateRuntimeStore, persistRuntimeStore, runtimeStoreHealth } from "../infrastructure/middleware/runtimeStore.js";

const router = new Router();

router.post("/api/v1/auth/sms-codes", async ({ body }) => auth.sendSmsCode(body.phone, body.scene || "LOGIN"), { public: true });
router.post("/api/v1/auth/sms-login", async ({ body }) => auth.loginBySms(body.phone, body.code), { public: true });
router.post("/api/admin/v1/sms-codes", async ({ body }) => auth.sendAdminSmsCode(body.phone, body.scene), { public: true });
router.post("/api/admin/v1/sms-login", async ({ body }) => auth.loginAdminBySms(body.phone, body.code), { public: true });
router.post("/api/v1/auth/wechat/qr-sessions", async () => auth.createQrSession(), { public: true });
router.get("/api/v1/auth/wechat/qr-sessions/:ticket", async ({ params }) => auth.getQrStatus(params.ticket), { public: true });
router.post("/api/v1/auth/logout", async ({ token }) => {
  if (token) await auth.logout(token);
  return null;
});

router.get("/api/v1/home", async ({ user, url }) => homeService.home(user?.id, url.searchParams.get("categoryCode") || "ALL"), { public: true });

router.get("/api/v1/users/me", async ({ user }) => userService.getProfile(user.id));
router.patch("/api/v1/users/me", async ({ user, body }) => userService.updateProfile(user.id, body));
router.get("/api/v1/points/account", async ({ user }) => userService.pointAccount(user.id));
router.get("/api/v1/points/ledger", async ({ user, url }) => page(userService.pointLedger(user.id, url.searchParams.get("direction")), url));
router.get("/api/v1/points/ledger/:ledgerId", async ({ user, params }) => userService.pointLedgerDetail(user.id, params.ledgerId));

router.post("/api/v1/projects", async ({ user, body }) => projectService.createProject(user.id, body.title));
router.get("/api/v1/projects", async ({ user, url }) => page(user ? projectService.listProjects(user.id, url.searchParams.get("keyword")) : [], url), { public: true });
router.get("/api/v1/projects/:projectId", async ({ user, params }) => projectService.getProject(user.id, params.projectId));
router.patch("/api/v1/projects/:projectId", async ({ user, params, body }) => projectService.updateProject(user.id, params.projectId, body));
router.delete("/api/v1/projects/:projectId", async ({ user, params }) => {
  projectService.deleteProject(user.id, params.projectId);
  return noContent();
});
router.get("/api/v1/projects/:projectId/canvas", async ({ user, params }) => projectService.getCanvas(user.id, params.projectId));
router.put("/api/v1/projects/:projectId/canvas", async ({ user, params, body }) => projectService.saveCanvas(user.id, params.projectId, body));
router.get("/api/v1/projects/:projectId/versions", async ({ user, params, url }) => page(projectService.listVersions(user.id, params.projectId), url));
router.get("/api/v1/projects/:projectId/versions/:versionId", async ({ user, params }) => projectService.getVersion(user.id, params.projectId, params.versionId));
router.post("/api/v1/projects/:projectId/versions/:versionId/restore", async ({ user, params }) => projectService.restoreVersion(user.id, params.projectId, params.versionId));
router.post("/api/v1/projects/:projectId/shares", async ({ user, params, body }) => shareService.createShare(user.id, params.projectId, body));
router.get("/api/v1/shares/:shareCode", async ({ params }) => shareService.getShare(params.shareCode), { public: true });
router.delete("/api/v1/projects/:projectId/shares/:shareCode", async ({ user, params }) => {
  shareService.deleteShare(user.id, params.projectId, params.shareCode);
  return noContent();
});

router.post("/api/v1/assets/upload-tickets", async ({ user, body }) => assetService.createUploadTicket(user.id, body));
router.post("/api/mock-files/upload", async () => {
  if (!appConfig.storage.mockEnabled) {
    throw notFound("Mock 文件上传接口未启用");
  }
  return { uploaded: true };
}, { public: true });
router.post("/api/v1/assets", async ({ user, body }) => assetService.completeUpload(user.id, body));
router.get("/api/v1/assets", async ({ user, url }) => page(assetService.listAssets(user.id, Object.fromEntries(url.searchParams)), url));
router.get("/api/v1/assets/:assetId", async ({ user, params }) => assetService.getAsset(user.id, params.assetId));
router.put("/api/v1/assets/:assetId/favorite", async ({ user, params }) => assetService.favoriteAsset(user.id, params.assetId));
router.delete("/api/v1/assets/:assetId/favorite", async ({ user, params }) => {
  assetService.unfavoriteAsset(user.id, params.assetId);
  return noContent();
});
router.delete("/api/v1/assets/:assetId", async ({ user, params }) => {
  assetService.deleteAsset(user.id, params.assetId);
  return noContent();
});

router.get("/api/v1/ai/capabilities", async () => ({ items: aiService.capabilities() }));
router.get("/api/v1/ai/skills", async () => aiService.skills());
router.post("/api/v1/ai/point-estimates", async ({ body }) => aiService.estimatePoints(body.capabilityCode, body.parameters));
router.post("/api/v1/ai/prompt-translations", async ({ body }) => aiService.translatePrompt(body.text, body.targetLanguage));
router.post("/api/v1/generation-tasks", async ({ user, body, req }) => aiService.createTask(user.id, req.headers["idempotency-key"], body));
router.get("/api/v1/generation-tasks", async ({ user, url }) => page(aiService.listTasks(user.id, Object.fromEntries(url.searchParams)), url));
router.get("/api/v1/generation-tasks/:taskId", async ({ user, params }) => aiService.getTask(user.id, params.taskId));
router.post("/api/v1/generation-tasks/:taskId/cancel", async ({ user, params }) => aiService.cancelTask(user.id, params.taskId));
router.get("/api/v1/provider/chat/models", async () => ({ items: modelClient.supportedChatModels() }));
router.post("/api/v1/provider/chat/completions", async ({ body }) => {
  if (body.stream) {
    return providerStream(await modelClient.createChatCompletionStream(body));
  }
  return rawJson(await modelClient.createChatCompletion(body));
});
router.post("/api/v1/provider/images/generations", async ({ body }) => {
  if (body.stream) {
    return providerStream(await modelClient.createImageGenerationStream(body));
  }
  return rawJson(await modelClient.createImageGeneration(body));
});
router.post("/api/v1/provider/videos/generations", async ({ body }) => {
  if (body.stream !== false) {
    return providerStream(await modelClient.createVideoGenerationStream(body));
  }
  return rawJson(await modelClient.createVideoGeneration(body));
});
router.get("/api/v1/provider/tools", async () => ({ items: modelClient.supportedModelTools() }));
router.post("/api/v1/provider/tools/:toolCode", async ({ params, body }) => rawJson(await modelClient.callModelTool(params.toolCode, body)));

router.post("/api/v1/chat-sessions", async ({ user, body }) => chatService.createSession(user.id, body));
router.get("/api/v1/chat-sessions", async ({ user, url }) => page(chatService.sessions(user.id, url.searchParams.get("projectId")), url));
router.get("/api/v1/chat-sessions/:sessionId/messages", async ({ user, params, url }) => page(chatService.messages(user.id, params.sessionId), url));
router.post("/api/v1/chat-sessions/:sessionId/messages", async ({ user, params, body }) => chatService.sendMessage(user.id, params.sessionId, body));
router.delete("/api/v1/chat-sessions/:sessionId", async ({ user, params }) => {
  chatService.deleteSession(user.id, params.sessionId);
  return noContent();
});

router.post("/api/v1/workflows", async ({ user, body }) => workflowService.createWorkflow(user.id, body));
router.get("/api/v1/workflows", async ({ user, url }) => page(workflowService.listWorkflows(user.id, url.searchParams.get("keyword")), url));
router.get("/api/v1/workflows/:workflowId", async ({ user, params }) => workflowService.getWorkflow(user.id, params.workflowId));
router.put("/api/v1/workflows/:workflowId", async ({ user, params, body }) => workflowService.updateWorkflow(user.id, params.workflowId, body));
router.delete("/api/v1/workflows/:workflowId", async ({ user, params }) => {
  workflowService.deleteWorkflow(user.id, params.workflowId);
  return noContent();
});
router.post("/api/v1/workflows/:workflowId/projects", async ({ user, params, body }) => workflowService.createProjectFromWorkflow(user.id, params.workflowId, body.title));

router.get("/api/v1/plans", async () => ({ items: billingService.plans() }), { public: true });
router.post("/api/v1/trial-applications/sms-codes", async ({ body }) => trialService.sendTrialSmsCode(body.phone), { public: true });
router.post("/api/v1/trial-applications", async ({ body, req }) => trialService.createTrialApplication(body, req.headers["idempotency-key"]), { public: true });
router.post("/api/v1/orders", async ({ user, body, req }) => billingService.createOrder(user.id, req.headers["idempotency-key"], body));
router.get("/api/v1/orders", async ({ user, url }) => page(billingService.listOrders(user.id, url.searchParams.get("status")), url));
router.get("/api/v1/orders/:orderNo", async ({ user, params }) => billingService.getOrder(user.id, params.orderNo));
router.post("/api/v1/orders/:orderNo/payments", async ({ user, params, body }) => billingService.createPayment(user.id, params.orderNo, body));
router.post("/api/v1/orders/:orderNo/mock-paid", async ({ user, params }) => {
  billingService.completeLocalPayment(user.id, params.orderNo);
  return null;
});
router.post("/api/v1/payments/:payType/notify", async ({ params, body, req }) => billingService.notifyPayment(params.payType.toUpperCase(), body, req.headers), { public: true, rawSuccess: true });
router.post("/api/v1/subscriptions/cancel-auto-renew", async ({ user }) => {
  billingService.cancelAutoRenew(user.id);
  return null;
});

router.get("/api/admin/v1/dashboard", async () => adminService.dashboard(), { admin: true });
router.get("/api/admin/v1/users", async ({ url }) => page(adminService.users(Object.fromEntries(url.searchParams)), url), { admin: true });
router.get("/api/admin/v1/users/:userId", async ({ params }) => adminService.userDetail(params.userId), { admin: true });
router.patch("/api/admin/v1/users/:userId/status", async ({ user, params, body }) => adminService.updateUserStatus(user, params.userId, body.status), { admin: true });
router.post("/api/admin/v1/users/:userId/point-adjustments", async ({ user, params, body }) => adminService.adjustPoints(user, params.userId, body.amount, body.reason), { admin: true });
router.get("/api/admin/v1/orders", async ({ url }) => page(adminService.adminOrders(Object.fromEntries(url.searchParams)), url), { admin: true });
router.get("/api/admin/v1/orders/:orderNo", async ({ params }) => adminService.orderDetail(params.orderNo), { admin: true });
router.get("/api/admin/v1/plans", async () => ({ items: adminService.plans() }), { admin: true });
router.get("/api/admin/v1/plans/:planCode", async ({ params }) => adminService.planDetail(params.planCode), { admin: true });
router.post("/api/admin/v1/plans", async ({ user, body }) => adminService.savePlan(user, body), { admin: true });
router.put("/api/admin/v1/plans/:planCode", async ({ user, params, body }) => adminService.savePlan(user, body, params.planCode), { admin: true });
router.patch("/api/admin/v1/plans/:planCode/status", async ({ user, params, body }) => adminService.updatePlanStatus(user, params.planCode, body.status), { admin: true });
router.get("/api/admin/v1/model-configs", async () => ({ items: adminService.modelConfigs() }), { admin: true });
router.get("/api/admin/v1/model-configs/:modelCode", async ({ params }) => adminService.modelDetail(params.modelCode), { admin: true });
router.put("/api/admin/v1/model-configs/:modelCode", async ({ user, params, body }) => adminService.saveModelConfig(user, params.modelCode, body), { admin: true });
router.patch("/api/admin/v1/model-configs/:modelCode/status", async ({ user, params, body }) => adminService.updateModelStatus(user, params.modelCode, body.status), { admin: true });
router.get("/api/admin/v1/prompt-templates", async ({ url }) => ({ items: adminService.promptTemplates(Object.fromEntries(url.searchParams)) }), { admin: true });
router.get("/api/admin/v1/prompt-templates/:code", async ({ params }) => adminService.promptTemplateDetail(params.code), { admin: true });
router.post("/api/admin/v1/prompt-templates", async ({ user, body }) => adminService.savePromptTemplate(user, body), { admin: true });
router.put("/api/admin/v1/prompt-templates/:code", async ({ user, params, body }) => adminService.savePromptTemplate(user, body, params.code), { admin: true });
router.patch("/api/admin/v1/prompt-templates/:code/status", async ({ user, params, body }) => adminService.updatePromptTemplateStatus(user, params.code, body.status), { admin: true });
router.get("/api/admin/v1/inspirations", async ({ url }) => ({ items: adminService.inspirations(Object.fromEntries(url.searchParams)) }), { admin: true });
router.get("/api/admin/v1/inspirations/:id", async ({ params }) => adminService.inspirationDetail(params.id), { admin: true });
router.post("/api/admin/v1/inspirations", async ({ user, body }) => adminService.saveInspiration(user, body), { admin: true });
router.put("/api/admin/v1/inspirations/:id", async ({ user, params, body }) => adminService.saveInspiration(user, body, params.id), { admin: true });
router.patch("/api/admin/v1/inspirations/:id/status", async ({ user, params, body }) => adminService.updateInspirationStatus(user, params.id, body.status), { admin: true });
router.get("/api/admin/v1/categories", async ({ url }) => page(adminService.categories(Object.fromEntries(url.searchParams)), url), { admin: true });
router.get("/api/admin/v1/categories/:code", async ({ params }) => adminService.categoryDetail(params.code), { admin: true });
router.post("/api/admin/v1/categories", async ({ user, body }) => adminService.saveCategory(user, body), { admin: true });
router.put("/api/admin/v1/categories/:code", async ({ user, params, body }) => adminService.saveCategory(user, body, params.code), { admin: true });
router.patch("/api/admin/v1/categories/:code/status", async ({ user, params, body }) => adminService.updateCategoryStatus(user, params.code, body.status), { admin: true });
router.delete("/api/admin/v1/categories/:code", async ({ user, params }) => {
  adminService.deleteCategory(user, params.code);
  return noContent();
}, { admin: true });
router.get("/api/admin/v1/workflows", async ({ url }) => page(adminService.adminWorkflows(Object.fromEntries(url.searchParams)), url), { admin: true });
router.get("/api/admin/v1/workflows/:workflowId", async ({ params }) => adminService.workflowDetail(params.workflowId), { admin: true });
router.post("/api/admin/v1/workflows", async ({ user, body }) => adminService.saveWorkflow(user, body), { admin: true });
router.put("/api/admin/v1/workflows/:workflowId", async ({ user, params, body }) => adminService.saveWorkflow(user, body, params.workflowId), { admin: true });
router.patch("/api/admin/v1/workflows/:workflowId/status", async ({ user, params, body }) => adminService.updateWorkflowStatus(user, params.workflowId, body.status), { admin: true });
router.delete("/api/admin/v1/workflows/:workflowId", async ({ user, params }) => {
  adminService.deleteWorkflow(user, params.workflowId);
  return noContent();
}, { admin: true });
router.get("/api/admin/v1/invoices", async ({ url }) => page(adminService.invoices(Object.fromEntries(url.searchParams)), url), { admin: true });
router.get("/api/admin/v1/invoices/:invoiceId", async ({ params }) => adminService.invoiceDetail(params.invoiceId), { admin: true });
router.post("/api/admin/v1/invoices", async ({ user, body }) => adminService.saveInvoice(user, body), { admin: true });
router.put("/api/admin/v1/invoices/:invoiceId", async ({ user, params, body }) => adminService.saveInvoice(user, body, params.invoiceId), { admin: true });
router.patch("/api/admin/v1/invoices/:invoiceId/status", async ({ user, params, body }) => adminService.updateInvoiceStatus(user, params.invoiceId, body.status, body), { admin: true });

router.get("/api/v3/swagger", async () => openApiSpec(), { public: true, rawSuccess: true });
router.get("/api/doc.html", async () => html(docsHtml()), { public: true });
router.get("/api/swagger-ui.html", async () => html(docsHtml()), { public: true });
router.get("/api/health", async () => {
  const database = await safeRuntimeStoreHealth();
  return {
    status: database.status === "DOWN" ? "DEGRADED" : "UP",
    runtime: "nodejs-vercel",
    ...configHealth(),
    database
  };
}, { public: true });

export async function handleRequest(req, res) {
  const trace = traceId();
  cors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (!isOperationalRoute(url.pathname)) {
      await hydrateRuntimeStore();
    }
    if (req.method === "GET" && url.pathname.startsWith("/api/mock-files/")) {
      if (!appConfig.storage.mockEnabled) {
        throw notFound("Mock 文件读取接口未启用");
      }
      sendMockFile(res, trace, decodeURIComponent(url.pathname.slice("/api/mock-files/".length)));
      return;
    }
    const matched = router.match(req.method, url.pathname);
    const token = bearerToken(req);
    let user = null;
    if (token) {
      user = await auth.resolveUser(token);
    }
    if (!matched.options.public && !user) {
      throw unauthorized();
    }
    if (matched.options.admin && !hasRole(user.role, "ADMIN")) {
      throw forbidden();
    }
    const body = ["POST", "PUT", "PATCH"].includes(req.method) ? await readJson(req) : {};
    const result = await matched.handler({ req, url, params: matched.params, body, user, token });
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      await persistRuntimeStore();
    }
    if (result?.__html) {
      res.statusCode = 200;
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(result.__html);
      return;
    }
    if (result?.__noContent) {
      sendNoContent(res, trace);
      return;
    }
    if (result?.__providerStream) {
      await sendProviderStream(res, result.response, trace);
      return;
    }
    if (result?.__rawJson) {
      sendRawJson(res, 200, result.data, trace);
      return;
    }
    if (matched.options.rawSuccess) {
      sendJson(res, 200, result, trace);
      return;
    }
    sendJson(res, 200, success(result), trace);
  } catch (error) {
    sendError(res, error, trace);
  }
}

function page(items, url) {
  const { page: current, pageSize } = parsePage(url.searchParams);
  const { records, total } = paginate(items, current, pageSize);
  return pageResponse(records, current, pageSize, total);
}

function bearerToken(req) {
  const value = req.headers.authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7) : null;
}

function hasRole(currentRole, role) {
  return String(currentRole || "USER")
    .split(/[,\s]+/)
    .map((item) => item.trim().toUpperCase())
    .includes(String(role || "").trim().toUpperCase());
}

function cors(req, res) {
  const origin = req.headers.origin || "*";
  const allowed = appConfig.cors.allowedOrigins;
  const allowOrigin = allowed.includes("*") || allowed.includes(origin) ? origin : allowed[0];
  res.setHeader("access-control-allow-origin", allowOrigin || "*");
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.setHeader("access-control-allow-headers", "Content-Type,Authorization,Accept,Idempotency-Key,X-Daone-Payment-Signature");
  res.setHeader("access-control-expose-headers", "X-Trace-Id");
}

function html(value) {
  return { __html: value };
}

function noContent() {
  return { __noContent: true };
}

function providerStream(response) {
  return { __providerStream: true, response };
}

function rawJson(data) {
  return { __rawJson: true, data };
}

function sendRawJson(res, status, payload, trace) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("x-trace-id", trace);
  res.end(JSON.stringify(payload));
}

async function sendProviderStream(res, response, trace) {
  res.statusCode = response.status || 200;
  res.setHeader("content-type", response.headers?.get?.("content-type") || "text/event-stream; charset=utf-8");
  res.setHeader("cache-control", "no-cache, no-transform");
  res.setHeader("connection", "keep-alive");
  res.setHeader("x-trace-id", trace);
  if (!response.body) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (typeof res.write === "function") {
      res.write(Buffer.from(value));
    } else {
      chunks.push(Buffer.from(value));
    }
  }
  res.end(chunks.length ? Buffer.concat(chunks) : undefined);
}

function isOperationalRoute(pathname) {
  return pathname === "/api/health" || pathname === "/api/v3/swagger" || pathname === "/api/doc.html" || pathname === "/api/swagger-ui.html";
}

async function safeRuntimeStoreHealth() {
  try {
    return await runtimeStoreHealth();
  } catch (error) {
    return {
      enabled: true,
      status: "DOWN",
      message: error.message
    };
  }
}

function sendMockFile(res, trace, objectKey) {
  res.statusCode = 200;
  res.setHeader("content-type", "image/svg+xml; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-trace-id", trace);
  res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#f4f4f5"/>
  <text x="400" y="285" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" fill="#18181b">Daone Mock File</text>
  <text x="400" y="330" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#71717a">${escapeXml(objectKey)}</text>
</svg>`);
}

function escapeXml(value) {
  return String(value).replace(/[<>&"']/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "\"": "&quot;",
    "'": "&apos;"
  })[char]);
}
