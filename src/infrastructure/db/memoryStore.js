import { getSequence, nextId, setSequence, syncSequenceFromIds } from "../common/id.js";

const now = () => new Date().toISOString();

const DEFAULT_MODEL_CONFIGS = [
  {
    modelCode: "TEXT_COPY_V1",
    modelName: "文案生成",
    taskType: "TEXT",
    basePoints: 5,
    parameters: {},
    attributes: { surface: "CAPABILITY" }
  },
  {
    modelCode: "IMAGE_GENERAL_V1",
    modelName: "通用图片生成",
    taskType: "IMAGE",
    basePoints: 20,
    parameters: { aspectRatio: ["1:1", "3:4", "4:3", "16:9"], resolution: ["1K", "2K"], count: { min: 1, max: 4 } },
    attributes: { surface: "CAPABILITY" }
  },
  {
    modelCode: "VIDEO_GENERAL_V1",
    modelName: "通用视频生成",
    taskType: "VIDEO",
    basePoints: 100,
    parameters: { duration: [5, 10], aspectRatio: ["16:9", "9:16"] },
    attributes: { surface: "CAPABILITY" }
  },
  {
    modelCode: "gpt5.5",
    modelName: "GPT-5.5",
    taskType: "CHAT",
    basePoints: 0,
    parameters: { providerModel: "gpt-5.5" },
    attributes: {
      surface: "PROVIDER",
      gateway: "CHAT",
      provider: "302.AI",
      description: "通用智能体与复杂文本生成模型",
      supportsStreaming: true,
      aliases: ["gpt-5.5"]
    }
  },
  {
    modelCode: "gemini-3-1-pro-preview",
    modelName: "Gemini 3.1 Pro Preview",
    taskType: "CHAT",
    basePoints: 0,
    parameters: { providerModel: "gemini-3.1-pro-preview" },
    attributes: {
      surface: "PROVIDER",
      gateway: "CHAT",
      provider: "302.AI",
      description: "Gemini 3.1 Pro 预览模型",
      supportsStreaming: true,
      aliases: ["gemini-3.1-pro-preview", "gemini 3.1 pro preview"]
    }
  },
  {
    modelCode: "codex",
    modelName: "Codex",
    taskType: "CHAT",
    basePoints: 0,
    parameters: {},
    attributes: {
      surface: "PROVIDER",
      gateway: "CHAT",
      provider: "302.AI",
      description: "面向 skill 提取和代码类任务的模型入口",
      supportsStreaming: true,
      aliases: ["Codex"],
      providerModelConfigKey: "defaultCodexModel"
    }
  },
  {
    modelCode: "image2.0",
    modelName: "Image 2.0",
    taskType: "IMAGE",
    basePoints: 0,
    parameters: { providerModel: "gpt-image-2" },
    attributes: {
      surface: "PROVIDER",
      gateway: "IMAGE",
      provider: "302.AI",
      description: "OpenAI 兼容图片生成模型",
      supportsStreaming: true,
      aliases: ["gpt-image-2"]
    }
  },
  {
    modelCode: "nanobanana-2.0",
    modelName: "Nanobanana 2.0",
    taskType: "IMAGE",
    basePoints: 0,
    parameters: { providerModel: "gemini-3.1-flash-image-preview" },
    attributes: {
      surface: "PROVIDER",
      gateway: "IMAGE",
      provider: "302.AI",
      description: "Gemini 图片生成预览模型",
      supportsStreaming: true,
      aliases: ["Nanobanana 2.0", "nanobanana2", "gemini-3.1-flash-image-preview"]
    }
  },
  {
    modelCode: "seedance2.0",
    modelName: "Seedance 2.0",
    taskType: "VIDEO",
    basePoints: 0,
    parameters: { providerModel: "seedance2.0" },
    attributes: {
      surface: "PROVIDER",
      gateway: "VIDEO",
      provider: "BytePlus/火山方舟",
      providerKey: "seedance",
      description: "Seedance 2.0 视频生成模型",
      supportsStreaming: true,
      aliases: ["seedance", "seedance2", "seedance-2.0", "seedance-2-0"]
    }
  },
  {
    modelCode: "happy-horse",
    modelName: "HappyHorse",
    taskType: "VIDEO",
    basePoints: 0,
    parameters: { providerModel: "happy-horse" },
    attributes: {
      surface: "PROVIDER",
      gateway: "VIDEO",
      provider: "fal.ai",
      providerKey: "happyHorse",
      description: "HappyHorse 文生视频/图生视频模型",
      supportsStreaming: true,
      aliases: ["happy horse", "happyhorse"]
    }
  }
];

const DEFAULT_CONTENT_CATEGORIES = [
  ["BRAND", "品牌设计", "ALL", 10, 128],
  ["POSTER", "海报与广告", "ALL", 20, 96],
  ["ILLUSTRATION", "插画", "INSPIRATION", 30, 74],
  ["UI", "UI设计", "INSPIRATION", 40, 0],
  ["CHARACTER", "角色设计", "INSPIRATION", 50, 0],
  ["SOFTWARE", "软件与开发", "INSPIRATION", 60, 0],
  ["PRODUCT", "产品设计", "ALL", 70, 0],
  ["ARCHITECTURE", "建筑设计", "INSPIRATION", 80, 0],
  ["VIDEO", "视频与分镜", "TEMPLATE", 90, 32]
];

export const store = globalThis.__DAONE_STORE__ ?? {
  users: new Map(),
  smsCodes: new Map(),
  tokens: new Map(),
  projects: new Map(),
  canvases: new Map(),
  versions: new Map(),
  shares: new Map(),
  assets: new Map(),
  favorites: new Set(),
  generationTasks: new Map(),
  chatSessions: new Map(),
  chatMessages: new Map(),
  workflows: new Map(),
  orders: new Map(),
  transactions: new Map(),
  subscriptions: new Map(),
  pointAccounts: new Map(),
  pointLedgers: new Map(),
  uploadTickets: new Map(),
  inspirations: new Map(),
  plans: new Map(),
  prices: new Map(),
  models: new Map(),
  promptTemplates: new Map(),
  invoiceApplications: new Map(),
  contentCategories: new Map(),
  adminOperationLogs: new Map()
};

globalThis.__DAONE_STORE__ = store;

seed();

export function exportStoreSnapshot() {
  const snapshot = {
    _sequence: getSequence().toString()
  };
  for (const [key, value] of Object.entries(store)) {
    if (value instanceof Map) {
      snapshot[key] = { type: "Map", entries: [...value.entries()] };
    } else if (value instanceof Set) {
      snapshot[key] = { type: "Set", values: [...value.values()] };
    }
  }
  return snapshot;
}

export function importStoreSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return;
  }
  for (const [key, value] of Object.entries(snapshot)) {
    if (key === "_sequence") {
      continue;
    }
    if (!(key in store) || !value || typeof value !== "object") {
      continue;
    }
    if (value.type === "Map" && Array.isArray(value.entries)) {
      store[key].clear();
      for (const [entryKey, entryValue] of value.entries) {
        store[key].set(entryKey, entryValue);
      }
    }
    if (value.type === "Set" && Array.isArray(value.values)) {
      store[key].clear();
      for (const item of value.values) {
        store[key].add(item);
      }
    }
  }
  if (snapshot._sequence) {
    setSequence(snapshot._sequence);
  }
  syncSequenceFromStore();
  seed();
}

const ID_MAP_KEYS = [
  "users",
  "projects",
  "versions",
  "shares",
  "assets",
  "generationTasks",
  "chatSessions",
  "chatMessages",
  "workflows",
  "orders",
  "transactions",
  "subscriptions",
  "uploadTickets",
  "inspirations",
  "plans",
  "models",
  "promptTemplates",
  "prices",
  "invoiceApplications",
  "contentCategories",
  "adminOperationLogs"
];

function syncSequenceFromStore() {
  const ids = [];
  for (const key of ID_MAP_KEYS) {
    const map = store[key];
    if (!(map instanceof Map)) {
      continue;
    }
    for (const [entryKey, entryValue] of map.entries()) {
      ids.push(entryKey);
      if (entryValue?.id !== undefined && entryValue?.id !== null) {
        ids.push(entryValue.id);
      }
    }
  }
  for (const projectId of store.canvases.keys()) {
    ids.push(projectId);
  }
  syncSequenceFromIds(ids);
}

function seed() {
  const t = now();
  if (store.plans.size === 0) {
    const planSeeds = [
      ["1001", "TEAM", "团队协作版", "Daone 团队套餐", ["12000积分/年", "3 人成员协作", "150G 存储空间"]],
      ["1002", "TEAM_PLUS", "团队Plus版", "Daone 团队 Plus 套餐", ["30000积分/年", "5 人成员协作", "200G 存储空间"]],
      ["1003", "TEAM_MAX", "团队Max版", "Daone 团队 Max 套餐", ["60000积分/年", "10 人成员协作", "300G 存储空间"]],
      ["1004", "ENTERPRISE", "企业版", "Daone 企业套餐", ["120000积分/2年", "20 人成员协作", "500G 存储空间", "1 对 1 专属服务"]],
      ["1005", "TRIAL", "试用版", "5 天全功能试用", ["5 天试用", "3000 积分", "专属指导服务"]]
    ];
    for (const [id, planCode, planName, description, benefits] of planSeeds) {
      store.plans.set(id, {
        id,
        planCode,
        planName,
        description,
        benefits,
        status: "ENABLED",
        createdAt: t,
        updatedAt: t
      });
    }
    for (const price of [
      ["1101", "1001", "TEAM_YEAR", "YEAR", 1, 599900, 799900, 12000],
      ["1102", "1001", "TEAM_MONTH", "MONTH", 1, 69900, 89900, 1000],
      ["1103", "1002", "TEAM_PLUS_YEAR", "YEAR", 1, 899900, 1199900, 30000],
      ["1104", "1002", "TEAM_PLUS_MONTH", "MONTH", 1, 99900, 129900, 2500],
      ["1105", "1003", "TEAM_MAX_YEAR", "YEAR", 1, 1299900, 1799900, 60000],
      ["1106", "1003", "TEAM_MAX_MONTH", "MONTH", 1, 139900, 189900, 5000],
      ["1107", "1004", "ENTERPRISE_TWO_YEARS", "YEAR", 2, 2999900, 3999900, 120000],
      ["1108", "1004", "ENTERPRISE_MONTH", "MONTH", 1, 299900, 399900, 10000],
      ["1109", "1005", "TRIAL_5D", "DAY", 5, 9900, null, 3000]
    ]) {
      store.prices.set(price[2], {
        id: price[0],
        planId: price[1],
        priceCode: price[2],
        cycleUnit: price[3],
        cycleCount: price[4],
        priceFen: price[5],
        originalPriceFen: price[6],
        grantPoints: price[7],
        status: "ENABLED",
        createdAt: t,
        updatedAt: t
      });
    }
  }
  for (const model of DEFAULT_MODEL_CONFIGS) {
    if (!store.models.has(model.modelCode)) {
      store.models.set(model.modelCode, {
        id: nextId(),
        ...model,
        status: "ENABLED",
        deleted: false,
        attributes: { ...(model.attributes || {}) },
        createdAt: t,
        updatedAt: t
      });
    }
  }
  if (store.inspirations.size === 0) {
    for (const item of [
      ["品牌视觉案例", "BRAND", "DesignLab", 110, 1140, "为新消费品牌生成一套现代视觉海报"],
      ["电商海报案例", "POSTER", "PosterLab", 92, 760, "高转化电商主图，突出商品卖点"],
      ["产品设计案例", "PRODUCT", "PixelFlow", 176, 2890, "未来科技产品概念设计，银色材质"]
    ]) {
      const id = nextId();
      store.inspirations.set(id, {
        id,
        title: item[0],
        coverUrl: `https://picsum.photos/seed/daone-${id}/800/600`,
        categoryCode: item[1],
        authorName: item[2],
        authorAvatarUrl: null,
        likeCount: item[3],
        viewCount: item[4],
        prompt: item[5],
        sortNo: Number(id),
        status: "ENABLED",
        deleted: false,
        attributes: {},
        createdAt: t,
        updatedAt: t
      });
    }
  }
  if (![...store.workflows.values()].some((item) => item.attributes?.adminTemplate)) {
    for (const item of [
      ["电商主图批量生成", "商品图上传、抠图、场景生成与导出", "ECOMMERCE", "电商营销", 12, "运营管理员", "ENABLED"],
      ["品牌海报工作流", "品牌信息到多尺寸活动海报", "POSTER", "海报广告", 9, "设计运营", "ENABLED"],
      ["短视频分镜生成", "脚本拆解、分镜图与视频片段生成", "VIDEO", "视频分镜", 18, "内容运营", "DISABLED"]
    ]) {
      const id = nextId();
      store.workflows.set(id, {
        id,
        userId: null,
        name: item[0],
        description: item[1],
        coverAssetId: null,
        workflowData: { schemaVersion: 1, nodes: [], edges: [] },
        deleted: false,
        attributes: {
          adminTemplate: true,
          workflowCode: `WF-${id}`,
          categoryCode: item[2],
          categoryName: item[3],
          nodeCount: item[4],
          ownerName: item[5],
          status: item[6]
        },
        createdAt: t,
        updatedAt: t
      });
    }
  }
  for (const item of DEFAULT_CONTENT_CATEGORIES) {
    if (!store.contentCategories.has(item[0])) {
      const id = nextId();
      store.contentCategories.set(item[0], {
        id,
        categoryCode: item[0],
        categoryName: item[1],
        scope: item[2],
        parentCode: null,
        sortNo: item[3],
        status: "ENABLED",
        deleted: false,
        attributes: { contentCount: item[4] },
        createdAt: t,
        updatedAt: t
      });
    }
  }
  if (store.invoiceApplications.size === 0) {
    for (const item of [
      ["INV-26061801", "杭州星图创意有限公司", "913301********221X", "DN20260618001", "VAT_NORMAL", 599900, "PENDING"],
      ["INV-26061703", "上海一格品牌设计有限公司", "913101********08XK", "DN20260617018", "VAT_SPECIAL", 1299900, "PROCESSING"],
      ["INV-26061605", "深圳像素文化科技有限公司", "914403********91A2", "DN20260616009", "VAT_NORMAL", 899900, "ISSUED"]
    ]) {
      const id = nextId();
      store.invoiceApplications.set(id, {
        id,
        invoiceNo: item[0],
        userId: "10001",
        orderNo: item[3],
        invoiceTitle: item[1],
        taxNo: item[2],
        invoiceType: item[4],
        amountFen: item[5],
        status: item[6],
        email: null,
        receiverName: null,
        receiverPhone: null,
        receiverAddress: null,
        rejectReason: null,
        issuedAt: item[6] === "ISSUED" ? t : null,
        invoiceFileAssetId: null,
        expressCompany: null,
        expressNo: null,
        deleted: false,
        attributes: {},
        createdAt: t,
        updatedAt: t
      });
    }
  }
  if (store.promptTemplates.size === 0) {
    for (const item of [
      ["IMAGE_POSTER", "图片海报提示词", "IMAGE", "生成一张具有明确视觉层级的商业海报"],
      ["VIDEO_STORYBOARD", "视频分镜提示词", "VIDEO", "根据脚本拆解镜头、景别、运动与时长"]
    ]) {
      store.promptTemplates.set(item[0], {
        id: nextId(),
        code: item[0],
        name: item[1],
        scenario: item[2],
        content: item[3],
        status: "ENABLED",
        deleted: false,
        attributes: {},
        createdAt: t,
        updatedAt: t
      });
    }
  }
  if (![...store.assets.values()].some((item) => item.source === "TEMPLATE")) {
    for (const item of [
      ["template-product", "商品主图模板.png", "IMAGE", "电商营销"],
      ["template-poster", "活动海报模板.png", "IMAGE", "海报广告"],
      ["template-video", "短视频分镜模板.mp4", "VIDEO", "视频脚本"]
    ]) {
      const id = nextId();
      const objectKey = `templates/${item[0]}`;
      store.assets.set(id, {
        id,
        userId: null,
        projectId: null,
        type: item[2],
        source: "TEMPLATE",
        fileName: item[1],
        objectKey,
        contentType: item[2] === "VIDEO" ? "video/mp4" : "image/png",
        fileSize: 0,
        width: item[2] === "IMAGE" ? 1024 : null,
        height: item[2] === "IMAGE" ? 1024 : null,
        durationSeconds: item[2] === "VIDEO" ? 8 : null,
        reviewStatus: "AVAILABLE",
        previewUrl: `https://picsum.photos/seed/daone-${item[0]}/800/600`,
        tags: [item[3]],
        createdAt: t,
        updatedAt: t
      });
    }
  }
}
