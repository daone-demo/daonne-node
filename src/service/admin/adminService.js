import { store } from "../../infrastructure/db/memoryStore.js";
import { nextId } from "../../infrastructure/common/id.js";
import { appConfig } from "../../infrastructure/config/env.js";
import { badRequest, notFound } from "../common/errors.js";
import { createLogger } from "../../infrastructure/common/logger.js";

const ENABLED = "ENABLED";
const DISABLED = "DISABLED";
const pointsLog = createLogger("points");

export function dashboard() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const users = [...store.users.values()];
  const orders = [...store.orders.values()];
  const tasks = [...store.generationTasks.values()];
  const todayOrders = orders.filter((item) => sameDay(item.createdAt, today));
  const todayPaid = todayOrders.filter((item) => item.status === "PAID");
  const todayTasks = tasks.filter((item) => sameDay(item.createdAt, today));
  const trendDays = lastDays(7);
  return {
    overview: {
      totalUsers: users.length,
      todayOrders: todayOrders.length,
      todayPaidAmountFen: sum(todayPaid, "amountFen"),
      todayAiCalls: todayTasks.length
    },
    trends: trendDays.map((date) => ({
      date,
      newUsers: users.filter((item) => sameDay(item.createdAt, date)).length,
      orders: orders.filter((item) => sameDay(item.createdAt, date)).length
    })),
    todos: {
      pendingInvoices: invoices().filter((item) => item.status === "PENDING").length,
      pendingWorkflows: adminWorkflows().filter((item) => item.status === "DISABLED").length,
      abnormalFeedbacks: 0
    },
    quickEntries: [
      { title: "用户管理", path: "/users/list" },
      { title: "套餐配置", path: "/plans/list" },
      { title: "模型管理", path: "/models/list" },
      { title: "内容运营", path: "/content/inspirations" }
    ]
  };
}

export function users(filters = {}) {
  return [...store.users.values()]
    .filter((item) => hasRole(item.role, "USER"))
    .filter((item) => matchKeyword(item, filters.keyword, ["id", "nickname", "phone", "email"]))
    .filter((item) => !filters.status || item.status === filters.status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(userRow);
}

function hasRole(currentRole, role) {
  return String(currentRole || "USER")
    .split(/[,\s]+/)
    .map((item) => item.trim().toUpperCase())
    .includes(String(role || "").trim().toUpperCase());
}

export function userDetail(userId) {
  const user = requireUser(userId);
  const account = store.pointAccounts.get(user.id) || {};
  const subscription = store.subscriptions.get(user.id) || null;
  const projects = [...store.projects.values()]
    .filter((item) => item.userId === user.id && item.status !== "DELETED")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return {
    ...userRow(user),
    points: {
      available: account.availablePoints || 0,
      frozen: account.frozenPoints || 0,
      grantedTotal: account.grantedTotal || 0
    },
    subscription,
    projectCount: projects.length,
    recentProjects: projects.slice(0, 5).map((item) => ({
      id: item.id,
      title: item.title,
      updatedAt: item.updatedAt
    }))
  };
}

export function updateUserStatus(adminUser, userId, status) {
  const user = requireUser(userId);
  const before = { ...user };
  user.status = normalizeStatus(status);
  user.updatedAt = now();
  audit(adminUser, "USER_STATUS_UPDATE", "USER", user.id, before, user);
  return userRow(user);
}

export function adjustPoints(adminUser, userId, amount, reason) {
  const user = requireUser(userId);
  const account = store.pointAccounts.get(user.id);
  if (!account) throw notFound("积分账户不存在");
  const value = Number(amount);
  if (!Number.isFinite(value) || value === 0) {
    throw badRequest("PARAM_INVALID", "积分调整数量不能为空");
  }
  const before = { ...account };
  const balanceBefore = account.availablePoints;
  account.availablePoints += value;
  account.grantedTotal += value > 0 ? value : 0;
  account.updatedAt = now();
  const ledgerId = nextId();
  store.pointLedgers.set(ledgerId, {
    id: ledgerId,
    userId: user.id,
    action: value >= 0 ? "ADMIN_GRANT" : "ADMIN_DEDUCT",
    amount: value,
    balanceAfter: account.availablePoints,
    bizType: "ADMIN",
    bizId: ledgerId,
    description: reason || "后台人工调整",
    createdAt: now()
  });
  audit(adminUser, "POINT_ADJUST", "USER", user.id, before, account, reason);
  const logFields = {
    adminUserId: adminUser?.id || "SYSTEM",
    userId: user.id,
    amount: value,
    balanceBefore,
    balanceAfter: account.availablePoints,
    ledgerId,
    reason: reason || "后台人工调整"
  };
  if (value < 0) {
    pointsLog.warn("points.admin_adjusted", "Admin deducted points", logFields);
  } else {
    pointsLog.info("points.admin_adjusted", "Admin granted points", logFields);
  }
  return {
    userId: user.id,
    availablePoints: account.availablePoints,
    frozenPoints: account.frozenPoints,
    grantedTotal: account.grantedTotal
  };
}

export function adminOrders(filters = {}) {
  return [...store.orders.values()]
    .filter((item) => matchKeyword(item, filters.keyword, ["orderNo", "userId", "productName", "productCode"]))
    .filter((item) => !filters.status || item.status === filters.status)
    .filter((item) => inDateRange(item.createdAt, filters.dateFrom, filters.dateTo))
    .filter((item) => {
      if (!filters.payType) return true;
      return orderTransactions(item.orderNo).some((tx) => tx.payType === filters.payType);
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(orderRow);
}

export function orderDetail(orderNo) {
  const order = store.orders.get(String(orderNo));
  if (!order) throw notFound("订单不存在");
  return {
    ...orderRow(order),
    productCode: order.productCode,
    orderType: order.orderType,
    currency: order.currency,
    expireAt: order.expireAt,
    paidAt: order.paidAt,
    productSnapshot: order.productSnapshot,
    transactions: orderTransactions(order.orderNo)
  };
}

export function plans() {
  return [...store.plans.values()]
    .filter((item) => !item.deleted)
    .map(planRow)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function planDetail(planCode) {
  const plan = requirePlan(planCode);
  return planRow(plan);
}

export function savePlan(adminUser, body, planCode = null) {
  if (!body.planCode && !planCode) {
    throw badRequest("PARAM_INVALID", "planCode 不能为空");
  }
  const t = now();
  const existing = planCode
    ? [...store.plans.values()].find((item) => item.planCode === String(planCode))
    : [...store.plans.values()].find((item) => item.planCode === String(body.planCode));
  const before = existing ? structuredCloneSafe(existing) : null;
  const plan = existing || { id: nextId(), createdAt: t };
  const code = planCode || body.planCode;
  Object.assign(plan, {
    planCode: String(code),
    planName: body.planName || body.name || plan.planName || String(code),
    description: body.description || plan.description || "",
    benefits: body.benefits || parseLines(body.benefitsText) || plan.benefits || [],
    status: body.status || plan.status || ENABLED,
    deleted: false,
    attributes: body.attributes || plan.attributes || {},
    updatedAt: t
  });
  store.plans.set(plan.id, plan);
  const prices = Array.isArray(body.prices) ? body.prices : parseJsonArray(body.pricesText);
  if (Array.isArray(prices)) {
    for (const item of prices) savePrice(plan, item, t);
  }
  audit(adminUser, existing ? "PLAN_UPDATE" : "PLAN_CREATE", "PLAN", plan.planCode, before, plan);
  return planRow(plan);
}

export function updatePlanStatus(adminUser, planCode, status) {
  const plan = requirePlan(planCode);
  const before = { ...plan };
  plan.status = normalizeStatus(status);
  plan.updatedAt = now();
  audit(adminUser, "PLAN_STATUS_UPDATE", "PLAN", plan.planCode, before, plan);
  return planRow(plan);
}

export function deletePlan(adminUser, planCode) {
  const plan = requirePlan(planCode);
  const before = structuredCloneSafe(plan);
  plan.deleted = true;
  plan.updatedAt = now();
  audit(adminUser, "PLAN_DELETE", "PLAN", plan.planCode, before, plan);
}

export function modelConfigs() {
  return [...store.models.values()]
    .filter((item) => !item.deleted)
    .map(modelRow)
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
}

export function modelDetail(modelCode) {
  const model = requireModel(modelCode);
  return modelRow(model);
}

export function saveModelConfig(adminUser, modelCode, body) {
  const model = requireModel(modelCode);
  const before = { ...model };
  let parameters = body.parameters !== undefined ? body.parameters : { ...(model.parameters || {}) };
  if (body.providerModel !== undefined) {
    if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) {
      parameters = {};
    }
    parameters.providerModel = String(body.providerModel);
  }
  const attributes = {
    ...(model.attributes || {}),
    ...(body.attributes || {})
  };
  if (body.gateway !== undefined) attributes.gateway = String(body.gateway).toUpperCase();
  if (body.provider !== undefined) attributes.provider = body.provider;
  if (body.description !== undefined) attributes.description = body.description;
  if (body.supportsStreaming !== undefined) attributes.supportsStreaming = Boolean(body.supportsStreaming);
  if (body.aliases !== undefined) attributes.aliases = parseAliases(body.aliases);
  Object.assign(model, {
    modelName: body.modelName || body.name || model.modelName,
    taskType: body.taskType || model.taskType,
    basePoints: body.basePoints !== undefined ? Number(body.basePoints) : model.basePoints,
    parameters,
    status: body.status || model.status,
    attributes,
    updatedAt: now()
  });
  audit(adminUser, "MODEL_UPDATE", "MODEL", model.modelCode, before, model);
  return modelRow(model);
}

export function updateModelStatus(adminUser, modelCode, status) {
  const model = requireModel(modelCode);
  const before = { ...model };
  model.status = normalizeStatus(status);
  model.updatedAt = now();
  audit(adminUser, "MODEL_STATUS_UPDATE", "MODEL", model.modelCode, before, model);
  return modelRow(model);
}

export function promptTemplates(filters = {}) {
  return [...store.promptTemplates.values()]
    .filter((item) => !item.deleted)
    .filter((item) => matchKeyword(item, filters.keyword, ["code", "name", "scenario", "content"]))
    .filter((item) => !filters.status || item.status === filters.status)
    .map(promptRow)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function promptTemplateDetail(code) {
  return promptRow(requirePromptTemplate(code));
}

export function savePromptTemplate(adminUser, body, code = null) {
  const templateCode = String(code || body.code || body.templateCode || "");
  if (!templateCode) throw badRequest("PARAM_INVALID", "code 不能为空");
  const t = now();
  const existing = store.promptTemplates.get(templateCode);
  const before = existing ? { ...existing } : null;
  const template = existing || { id: nextId(), code: templateCode, createdAt: t };
  Object.assign(template, {
    code: templateCode,
    name: body.name || body.templateName || template.name || templateCode,
    scenario: body.scenario || template.scenario || "GENERAL",
    content: body.content || body.prompt || template.content || "",
    status: body.status || template.status || ENABLED,
    deleted: false,
    attributes: body.attributes || template.attributes || {},
    updatedAt: t
  });
  store.promptTemplates.set(templateCode, template);
  audit(adminUser, existing ? "PROMPT_TEMPLATE_UPDATE" : "PROMPT_TEMPLATE_CREATE", "PROMPT_TEMPLATE", templateCode, before, template);
  return promptRow(template);
}

export function updatePromptTemplateStatus(adminUser, code, status) {
  const template = requirePromptTemplate(code);
  const before = { ...template };
  template.status = normalizeStatus(status);
  template.updatedAt = now();
  audit(adminUser, "PROMPT_TEMPLATE_STATUS_UPDATE", "PROMPT_TEMPLATE", template.code, before, template);
  return promptRow(template);
}

export function deletePromptTemplate(adminUser, code) {
  const template = requirePromptTemplate(code);
  const before = { ...template };
  template.deleted = true;
  template.updatedAt = now();
  audit(adminUser, "PROMPT_TEMPLATE_DELETE", "PROMPT_TEMPLATE", template.code, before, template);
}

export function inspirations(filters = {}) {
  return [...store.inspirations.values()]
    .filter((item) => !item.deleted)
    .filter((item) => matchKeyword(item, filters.keyword, ["title", "categoryCode", "authorName", "prompt"]))
    .filter((item) => !filters.status || item.status === filters.status)
    .map(inspirationRow)
    .sort((a, b) => (b.sortNo || 0) - (a.sortNo || 0));
}

export function inspirationDetail(id) {
  return inspirationRow(requireInspiration(id));
}

export function saveInspiration(adminUser, body, id = null) {
  const t = now();
  const item = id ? requireInspiration(id) : { id: nextId(), createdAt: t };
  const before = id ? { ...item } : null;
  Object.assign(item, {
    title: body.title || item.title,
    coverUrl: body.coverUrl || item.coverUrl,
    categoryCode: body.categoryCode || item.categoryCode || "BRAND",
    authorName: body.authorName || item.authorName || "Daone",
    authorAvatarUrl: body.authorAvatarUrl || item.authorAvatarUrl || null,
    prompt: body.prompt || item.prompt || "",
    likeCount: Number(body.likeCount ?? item.likeCount ?? 0),
    viewCount: Number(body.viewCount ?? item.viewCount ?? 0),
    sortNo: Number(body.sortNo ?? item.sortNo ?? 0),
    status: body.status || item.status || ENABLED,
    deleted: false,
    attributes: body.attributes || item.attributes || {},
    updatedAt: t
  });
  store.inspirations.set(item.id, item);
  audit(adminUser, id ? "INSPIRATION_UPDATE" : "INSPIRATION_CREATE", "INSPIRATION", item.id, before, item);
  return inspirationRow(item);
}

export function updateInspirationStatus(adminUser, id, status) {
  const item = requireInspiration(id);
  const before = { ...item };
  item.status = normalizeStatus(status);
  item.updatedAt = now();
  audit(adminUser, "INSPIRATION_STATUS_UPDATE", "INSPIRATION", item.id, before, item);
  return inspirationRow(item);
}

export function deleteInspiration(adminUser, id) {
  const item = requireInspiration(id);
  const before = { ...item };
  item.deleted = true;
  item.updatedAt = now();
  audit(adminUser, "INSPIRATION_DELETE", "INSPIRATION", item.id, before, item);
}

export function categories(filters = {}) {
  return [...store.contentCategories.values()]
    .filter((item) => !item.deleted)
    .filter((item) => matchKeyword(item, filters.keyword, ["categoryCode", "categoryName", "scope"]))
    .filter((item) => !filters.status || item.status === filters.status)
    .filter((item) => !filters.scope || item.scope === filters.scope)
    .map(categoryRow)
    .sort((a, b) => a.sortNo - b.sortNo);
}

export function categoryDetail(code) {
  return categoryRow(requireCategory(code));
}

export function saveCategory(adminUser, body, code = null) {
  const categoryCode = String(code || body.categoryCode || body.code || "");
  if (!categoryCode) throw badRequest("PARAM_INVALID", "categoryCode 不能为空");
  const t = now();
  const existing = store.contentCategories.get(categoryCode);
  const before = existing ? { ...existing } : null;
  const item = existing || { id: nextId(), categoryCode, createdAt: t };
  Object.assign(item, {
    categoryCode,
    categoryName: body.categoryName || body.name || item.categoryName || categoryCode,
    scope: body.scope || item.scope || "ALL",
    parentCode: body.parentCode || item.parentCode || null,
    sortNo: Number(body.sortNo ?? body.sort ?? item.sortNo ?? 0),
    status: body.status || item.status || ENABLED,
    deleted: false,
    attributes: body.attributes || item.attributes || {}
  });
  item.updatedAt = t;
  store.contentCategories.set(categoryCode, item);
  audit(adminUser, existing ? "CATEGORY_UPDATE" : "CATEGORY_CREATE", "CATEGORY", categoryCode, before, item);
  return categoryRow(item);
}

export function updateCategoryStatus(adminUser, code, status) {
  const item = requireCategory(code);
  const before = { ...item };
  item.status = normalizeStatus(status);
  item.updatedAt = now();
  audit(adminUser, "CATEGORY_STATUS_UPDATE", "CATEGORY", item.categoryCode, before, item);
  return categoryRow(item);
}

export function deleteCategory(adminUser, code) {
  const item = requireCategory(code);
  const before = { ...item };
  item.deleted = true;
  item.updatedAt = now();
  audit(adminUser, "CATEGORY_DELETE", "CATEGORY", item.categoryCode, before, item);
}

export function adminWorkflows(filters = {}) {
  return adminWorkflowsRaw()
    .filter((item) => matchKeyword(item, filters.keyword, ["id", "name", "description"]))
    .filter((item) => !filters.status || workflowStatus(item) === filters.status)
    .filter((item) => !filters.categoryCode || item.attributes?.categoryCode === filters.categoryCode)
    .map(workflowRow)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function workflowDetail(id) {
  return workflowRow(requireAdminWorkflow(id));
}

export function saveWorkflow(adminUser, body, id = null) {
  const t = now();
  const workflow = id ? requireAdminWorkflow(id) : { id: nextId(), userId: null, createdAt: t };
  const before = id ? structuredCloneSafe(workflow) : null;
  const workflowData = body.workflowData || body.flowData || workflow.workflowData || { schemaVersion: 1, nodes: [], edges: [] };
  Object.assign(workflow, {
    name: body.name || body.title || workflow.name || "未命名工作流",
    description: body.description || workflow.description || null,
    coverAssetId: body.coverAssetId || workflow.coverAssetId || null,
    workflowData,
    deleted: false,
    attributes: {
      ...(workflow.attributes || {}),
      ...(body.attributes || {}),
      adminTemplate: true,
      workflowCode: body.workflowCode || workflow.attributes?.workflowCode || `WF-${workflow.id}`,
      categoryCode: body.categoryCode || workflow.attributes?.categoryCode || "GENERAL",
      categoryName: body.categoryName || workflow.attributes?.categoryName || body.category || "通用",
      nodeCount: countNodes(workflowData),
      ownerName: body.ownerName || workflow.attributes?.ownerName || adminUser?.nickname || "运营管理员",
      status: body.status || workflow.attributes?.status || ENABLED
    },
    updatedAt: t
  });
  store.workflows.set(workflow.id, workflow);
  audit(adminUser, id ? "WORKFLOW_UPDATE" : "WORKFLOW_CREATE", "WORKFLOW", workflow.id, before, workflow);
  return workflowRow(workflow);
}

export function updateWorkflowStatus(adminUser, id, status) {
  const workflow = requireAdminWorkflow(id);
  const before = structuredCloneSafe(workflow);
  workflow.attributes = {
    ...(workflow.attributes || {}),
    status: normalizeStatus(status)
  };
  workflow.updatedAt = now();
  audit(adminUser, "WORKFLOW_STATUS_UPDATE", "WORKFLOW", workflow.id, before, workflow);
  return workflowRow(workflow);
}

export function deleteWorkflow(adminUser, id) {
  const workflow = requireAdminWorkflow(id);
  const before = structuredCloneSafe(workflow);
  workflow.deleted = true;
  workflow.updatedAt = now();
  audit(adminUser, "WORKFLOW_DELETE", "WORKFLOW", workflow.id, before, workflow);
}

export function invoices(filters = {}) {
  return [...store.invoiceApplications.values()]
    .filter((item) => !item.deleted)
    .filter((item) => matchKeyword(item, filters.keyword, ["invoiceNo", "invoiceTitle", "orderNo", "taxNo"]))
    .filter((item) => !filters.status || item.status === filters.status)
    .filter((item) => !filters.invoiceType || item.invoiceType === filters.invoiceType)
    .filter((item) => inDateRange(item.createdAt, filters.dateFrom, filters.dateTo))
    .map(invoiceRow)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function invoiceDetail(id) {
  return invoiceRow(requireInvoice(id));
}

export function saveInvoice(adminUser, body, id = null) {
  const t = now();
  const item = id ? requireInvoice(id) : { id: nextId(), createdAt: t };
  const before = id ? { ...item } : null;
  Object.assign(item, {
    invoiceNo: body.invoiceNo || item.invoiceNo || `INV-${Date.now()}`,
    userId: body.userId || item.userId,
    orderNo: body.orderNo || item.orderNo,
    invoiceTitle: body.invoiceTitle || body.company || item.invoiceTitle,
    taxNo: body.taxNo || item.taxNo,
    invoiceType: body.invoiceType || body.type || item.invoiceType || "VAT_NORMAL",
    amountFen: body.amountFen !== undefined ? Number(body.amountFen) : yuanToFen(body.amount ?? item.amountFen ?? 0),
    status: body.status || item.status || "PENDING",
    email: body.email || item.email || null,
    receiverName: body.receiverName || item.receiverName || null,
    receiverPhone: body.receiverPhone || item.receiverPhone || null,
    receiverAddress: body.receiverAddress || item.receiverAddress || null,
    rejectReason: body.rejectReason || item.rejectReason || null,
    issuedAt: body.issuedAt || item.issuedAt || null,
    invoiceFileAssetId: body.invoiceFileAssetId || item.invoiceFileAssetId || null,
    expressCompany: body.expressCompany || item.expressCompany || null,
    expressNo: body.expressNo || item.expressNo || null,
    deleted: false,
    attributes: body.attributes || item.attributes || {},
    updatedAt: t
  });
  assertInvoice(item);
  store.invoiceApplications.set(item.id, item);
  audit(adminUser, id ? "INVOICE_UPDATE" : "INVOICE_CREATE", "INVOICE", item.id, before, item);
  return invoiceRow(item);
}

export function updateInvoiceStatus(adminUser, id, status, body = {}) {
  const item = requireInvoice(id);
  const before = { ...item };
  item.status = String(status || "").trim().toUpperCase();
  if (!["PENDING", "PROCESSING", "ISSUED", "REJECTED", "CANCELLED"].includes(item.status)) {
    throw badRequest("PARAM_INVALID", "开票状态不正确");
  }
  if (item.status === "ISSUED") {
    item.issuedAt = body.issuedAt || now();
  }
  if (body.rejectReason) item.rejectReason = body.rejectReason;
  if (body.expressCompany) item.expressCompany = body.expressCompany;
  if (body.expressNo) item.expressNo = body.expressNo;
  item.updatedAt = now();
  audit(adminUser, "INVOICE_STATUS_UPDATE", "INVOICE", item.id, before, item);
  return invoiceRow(item);
}

export function deleteInvoice(adminUser, id) {
  const item = requireInvoice(id);
  const before = { ...item };
  item.deleted = true;
  item.updatedAt = now();
  audit(adminUser, "INVOICE_DELETE", "INVOICE", item.id, before, item);
}

function userRow(user) {
  const account = store.pointAccounts.get(user.id) || {};
  return {
    id: user.id,
    nickname: user.nickname,
    phone: user.phone,
    email: user.email,
    role: user.role,
    points: account.availablePoints || 0,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    gmtCreate: user.createdAt,
    gmtModified: user.updatedAt
  };
}

function orderRow(order) {
  const transaction = orderTransactions(order.orderNo).find(Boolean);
  return {
    id: order.orderNo,
    orderNo: order.orderNo,
    userId: order.userId,
    productName: order.productName,
    amountFen: order.amountFen,
    amountYuan: Math.round(order.amountFen / 100),
    payType: transaction?.payType || null,
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    gmtCreate: order.createdAt,
    gmtModified: order.updatedAt
  };
}

function planRow(plan) {
  const prices = [...store.prices.values()]
    .filter((price) => price.planId === plan.id)
    .sort((a, b) => a.priceFen - b.priceFen);
  return {
    ...plan,
    prices,
    priceSummary: prices.map((item) => `${displayCycle(item)} ¥${Math.round(item.priceFen / 100)}`).join(" / "),
    benefitSummary: (plan.benefits || []).join("、"),
    gmtCreate: plan.createdAt,
    gmtModified: plan.updatedAt
  };
}

function modelRow(model) {
  return {
    ...model,
    surface: model.attributes?.surface || "CAPABILITY",
    gateway: model.attributes?.gateway || null,
    provider: model.attributes?.provider || null,
    providerModel: modelProviderName(model),
    aliases: Array.isArray(model.attributes?.aliases) ? model.attributes.aliases : [],
    description: model.attributes?.description || "",
    supportsStreaming: model.attributes?.supportsStreaming === undefined ? null : model.attributes.supportsStreaming,
    todayCalls: [...store.generationTasks.values()].filter((item) => item.capabilityCode === model.modelCode && sameDay(item.createdAt, new Date().toISOString().slice(0, 10))).length,
    calls: [...store.generationTasks.values()].filter((item) => item.capabilityCode === model.modelCode).length,
    gmtCreate: model.createdAt,
    gmtModified: model.updatedAt
  };
}

function modelProviderName(model) {
  const configKey = model.attributes?.providerModelConfigKey;
  if (configKey && appConfig.model[configKey]) {
    return appConfig.model[configKey];
  }
  return model.parameters?.providerModel || model.attributes?.providerModel || null;
}

function promptRow(item) {
  return {
    ...item,
    gmtCreate: item.createdAt,
    gmtModified: item.updatedAt
  };
}

function inspirationRow(item) {
  return {
    ...item,
    gmtCreate: item.createdAt,
    gmtModified: item.updatedAt
  };
}

function categoryRow(item) {
  return {
    ...item,
    code: item.categoryCode,
    name: item.categoryName,
    contentCount: Number(item.attributes?.contentCount || 0),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    gmtCreate: item.createdAt,
    gmtModified: item.updatedAt
  };
}

function workflowRow(item) {
  return {
    id: item.id,
    workflowCode: item.attributes?.workflowCode || `WF-${item.id}`,
    name: item.name,
    description: item.description,
    categoryCode: item.attributes?.categoryCode || "GENERAL",
    categoryName: item.attributes?.categoryName || item.attributes?.category || "通用",
    category: item.attributes?.categoryName || "通用",
    nodeCount: Number(item.attributes?.nodeCount || countNodes(item.workflowData)),
    ownerName: item.attributes?.ownerName || "运营管理员",
    coverAssetId: item.coverAssetId,
    workflowData: item.workflowData,
    status: workflowStatus(item),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    gmtCreate: item.createdAt,
    gmtModified: item.updatedAt,
    attributes: item.attributes || {}
  };
}

function invoiceRow(item) {
  return {
    ...item,
    invoiceTypeName: item.invoiceType === "VAT_SPECIAL" ? "增值税专用发票" : "增值税普通发票",
    amountYuan: Math.round(Number(item.amountFen || 0) / 100),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    gmtCreate: item.createdAt,
    gmtModified: item.updatedAt
  };
}

function audit(adminUser, action, targetType, targetId, before, after, remark = "") {
  const id = nextId();
  const t = now();
  store.adminOperationLogs.set(id, {
    id,
    adminUserId: adminUser?.id || "SYSTEM",
    action,
    targetType,
    targetId: String(targetId || ""),
    before,
    after,
    remark,
    deleted: false,
    attributes: {},
    createdAt: t,
    updatedAt: t
  });
}

function requireUser(userId) {
  const user = store.users.get(String(userId));
  if (!user) throw notFound("用户不存在");
  return user;
}

function requirePlan(planCode) {
  const plan = [...store.plans.values()].find((item) => item.planCode === String(planCode));
  if (!plan || plan.deleted) throw notFound("套餐不存在");
  return plan;
}

function requireModel(modelCode) {
  const model = store.models.get(String(modelCode));
  if (!model || model.deleted) throw notFound("模型配置不存在");
  return model;
}

function requirePromptTemplate(code) {
  const item = store.promptTemplates.get(String(code));
  if (!item || item.deleted) throw notFound("提示词模板不存在");
  return item;
}

function requireInspiration(id) {
  const item = store.inspirations.get(String(id));
  if (!item || item.deleted) throw notFound("灵感内容不存在");
  return item;
}

function requireCategory(code) {
  const item = store.contentCategories.get(String(code));
  if (!item || item.deleted) throw notFound("分类不存在");
  return item;
}

function requireAdminWorkflow(id) {
  const workflow = store.workflows.get(String(id));
  if (!workflow || workflow.deleted || !workflow.attributes?.adminTemplate) {
    throw notFound("工作流不存在");
  }
  return workflow;
}

function requireInvoice(id) {
  const item = store.invoiceApplications.get(String(id));
  if (!item || item.deleted) throw notFound("开票申请不存在");
  return item;
}

function adminWorkflowsRaw() {
  return [...store.workflows.values()].filter((item) => !item.deleted && item.attributes?.adminTemplate);
}

function workflowStatus(item) {
  return item.attributes?.status || ENABLED;
}

function orderTransactions(orderNo) {
  return [...store.transactions.values()].filter((item) => item.orderNo === orderNo);
}

function savePrice(plan, item, t) {
  if (!item.priceCode && !item.code) {
    throw badRequest("PARAM_INVALID", "priceCode 不能为空");
  }
  const priceCode = String(item.priceCode || item.code);
  const price = store.prices.get(priceCode) || { id: nextId(), priceCode, createdAt: t };
  Object.assign(price, {
    planId: plan.id,
    priceCode,
    cycleUnit: item.cycleUnit || item.cycle || price.cycleUnit || "MONTH",
    cycleCount: Number(item.cycleCount || 1),
    priceFen: Number(item.priceFen || 0),
    originalPriceFen: item.originalPriceFen === undefined || item.originalPriceFen === null ? null : Number(item.originalPriceFen),
    grantPoints: Number(item.grantPoints || 0),
    status: item.status || price.status || ENABLED,
    updatedAt: t
  });
  store.prices.set(priceCode, price);
}

function assertInvoice(item) {
  if (!item.userId) throw badRequest("PARAM_INVALID", "userId 不能为空");
  if (!item.orderNo) throw badRequest("PARAM_INVALID", "orderNo 不能为空");
  if (!item.invoiceTitle) throw badRequest("PARAM_INVALID", "发票抬头不能为空");
  if (!item.taxNo) throw badRequest("PARAM_INVALID", "税号不能为空");
}

function normalizeStatus(status) {
  const raw = String(status || "").trim();
  if (raw === "启用") return ENABLED;
  if (raw === "停用") return DISABLED;
  const value = raw.toUpperCase();
  if ([ENABLED, DISABLED].includes(value)) return value;
  throw badRequest("PARAM_INVALID", "状态不正确");
}

function matchKeyword(item, keyword, keys) {
  const text = String(keyword || "").trim().toLowerCase();
  if (!text) return true;
  return keys.some((key) => String(item[key] ?? "").toLowerCase().includes(text));
}

function inDateRange(value, dateFrom, dateTo) {
  if (!value) return true;
  const date = value.slice(0, 10);
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
}

function sameDay(value, date) {
  return String(value || "").slice(0, 10) === date;
}

function lastDays(days) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    return date.toISOString().slice(0, 10);
  });
}

function sum(items, key) {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function now() {
  return new Date().toISOString();
}

function displayCycle(price) {
  if (price.cycleUnit === "DAY") return `${price.cycleCount}天`;
  if (price.cycleUnit === "YEAR") return price.cycleCount === 1 ? "年付" : `${price.cycleCount}年`;
  return price.cycleCount === 1 ? "月付" : `${price.cycleCount}个月`;
}

function countNodes(workflowData) {
  if (Array.isArray(workflowData?.nodes)) return workflowData.nodes.length;
  if (Array.isArray(workflowData?.graph?.cells)) return workflowData.graph.cells.filter((item) => item.shape !== "edge").length;
  return 0;
}

function parseLines(value) {
  if (typeof value !== "string") return null;
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function parseJsonArray(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    throw badRequest("PARAM_INVALID", "价格配置必须是 JSON 数组");
  }
}

function parseAliases(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function yuanToFen(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return number > 10000 ? Math.round(number) : Math.round(number * 100);
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}
