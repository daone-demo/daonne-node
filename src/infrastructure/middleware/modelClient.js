import { appConfig } from "../config/env.js";
import { store } from "../db/memoryStore.js";
import { badGateway, badRequest } from "../../service/common/errors.js";

const TOOL_DEFINITIONS = [
  { code: "remove-background", label: "抠图", type: "image", category: "image-edit", path: appConfig.model.tools.removeBackground },
  { code: "eraser", label: "擦除", type: "image", category: "image-edit", path: appConfig.model.tools.eraser },
  { code: "expand-image", label: "扩图", type: "image", category: "image-edit", path: appConfig.model.tools.expandImage },
  { code: "increase-resolution", label: "图片高清", type: "image", category: "image-enhance", path: appConfig.model.tools.increaseResolution },
  { code: "image-to-3d", label: "图片转 3D", type: "image", category: "image-generate", path: appConfig.model.tools.imageTo3d },
  { code: "prompt-expert", label: "图片反推提示词", type: "text", category: "text-generate", path: appConfig.model.tools.promptExpert },
  { code: "product-image-replacement", label: "商品图替换", type: "image", category: "image-edit", path: appConfig.model.tools.productImageReplacement },
  { code: "pose-transfer", label: "人物姿态变换", type: "image", category: "image-edit", path: appConfig.model.tools.poseTransfer },
  { code: "topaz-enhance", label: "画质增强", type: "image", category: "image-enhance", path: appConfig.model.tools.topazEnhance }
];

const TOOL_PATHS = Object.fromEntries(TOOL_DEFINITIONS.map((tool) => [tool.code, tool.path]));

const TOOL_UI = {
  textPickerActions: [
    { key: "write", label: "自己编写内容", icon: "doc", type: "local" },
    { key: "text2video", label: "文生视频", icon: "play", type: "generation", endpoint: "/api/v1/provider/videos/generations" },
    { key: "img2prompt", label: "图片反推提示词", icon: "image", type: "provider", toolCode: "prompt-expert" }
  ],
  imageGenActions: [
    { key: "img2img", label: "图生图", icon: "img2img", type: "generation", endpoint: "/api/v1/provider/images/generations" },
    { key: "hd", label: "图片高清", icon: "hd", type: "provider", toolCode: "increase-resolution" }
  ],
  imageNodeToolbar: {
    chat: { key: "chat", label: "对话", icon: "chat", type: "local" },
    actions: [
      {
        key: "cutout",
        label: "抠图",
        icon: "cutout",
        type: "menu",
        menuKey: "imageCutoutModes",
        children: [
          { key: "quick", code: "cutout.quick", label: "快速", type: "provider", toolCode: "remove-background" },
          { key: "precise", code: "cutout.precise", label: "精准", type: "provider", toolCode: "remove-background" },
          { key: "eraser", code: "cutout.eraser", label: "擦除", type: "provider", toolCode: "eraser" }
        ]
      },
      { key: "hd", label: "HD 高清", type: "provider", toolCode: "increase-resolution" },
      {
        key: "crop",
        label: "裁剪",
        icon: "crop",
        type: "menu",
        menuKey: "imageCropAspectRatios",
        children: [
          { key: "free", code: "crop.free", label: "自由裁剪", type: "local", ratio: null },
          { key: "original", code: "crop.original", label: "原图比例", type: "local", ratio: "original" },
          { key: "1:1", code: "crop.1:1", label: "1:1", type: "local", ratio: 1 },
          { key: "4:3", code: "crop.4:3", label: "4:3", type: "local", ratio: 4 / 3 },
          { key: "3:4", code: "crop.3:4", label: "3:4", type: "local", ratio: 3 / 4 },
          { key: "16:9", code: "crop.16:9", label: "16:9", type: "local", ratio: 16 / 9 },
          { key: "9:16", code: "crop.9:16", label: "9:16", type: "local", ratio: 9 / 16 },
          { key: "3:2", code: "crop.3:2", label: "3:2", type: "local", ratio: 3 / 2 },
          { key: "2:3", code: "crop.2:3", label: "2:3", type: "local", ratio: 2 / 3 }
        ]
      },
      { key: "inpaint", label: "局部修改", icon: "edit", type: "provider", toolCode: "product-image-replacement" },
      { key: "preview", label: "预览", icon: "preview", type: "local" },
      { key: "addToDialog", label: "", icon: "addToDialog", type: "local" },
      { key: "more", label: "更多", icon: "more", type: "menu", menuKey: "imageNodeToolbarMoreMenu" }
    ]
  },
  imageNodeToolbarMore: {
    actions: [
      {
        key: "split",
        label: "拆图",
        icon: "split",
        type: "menu",
        children: [
          { key: "grid-4", code: "split.grid-4", label: "4宫格", type: "local" },
          { key: "grid-9", code: "split.grid-9", label: "9宫格", type: "local" },
          { key: "free", code: "split.free", label: "自由", type: "local" }
        ]
      },
      { key: "annotate", label: "标注", icon: "annotate", type: "local" },
      {
        key: "decompose",
        label: "元素拆解",
        icon: "decompose",
        type: "menu",
        children: [
          { key: "all", code: "decompose.all", label: "全部", type: "local" },
          { key: "single", code: "decompose.single", label: "单个", type: "local" }
        ]
      },
      {
        key: "erase",
        label: "消除",
        icon: "erase",
        type: "menu",
        children: [
          { key: "smart", code: "erase.smart", label: "智能", type: "provider", toolCode: "eraser" },
          { key: "quick", code: "erase.quick", label: "快速", type: "provider", toolCode: "eraser" }
        ]
      },
      {
        key: "search",
        label: "搜同款",
        icon: "search",
        type: "menu",
        children: [
          { key: "same", code: "search.same", label: "同款", type: "local" },
          { key: "similar", code: "search.similar", label: "类似", type: "local" }
        ]
      },
      { key: "parse", label: "解析", icon: "parse", type: "provider", toolCode: "prompt-expert" },
      { key: "more", label: "更多", icon: "more", type: "menu", menuKey: "imageNodeToolbarMoreMenu" }
    ]
  },
  imageNodeCreativeToolbar: {
    actions: [
      { key: "panorama", label: "全景", badge: "NEW", type: "provider", toolCode: "expand-image" },
      { key: "multi-angle", label: "多角度", type: "provider", toolCode: "image-to-3d" },
      { key: "lighting", label: "打光", type: "local" },
      { key: "grid", label: "九宫格", type: "local" },
      { key: "hd", label: "高清", type: "provider", toolCode: "topaz-enhance" },
      { key: "grid-split", label: "宫格切分", type: "local" }
    ],
    icons: [
      { key: "rotate", label: "旋转", icon: "rotate", type: "local" },
      { key: "flip", label: "翻转", icon: "flip", type: "local" },
      { key: "download", label: "下载", icon: "download", type: "local" },
      { key: "expand", label: "展开", icon: "expand", type: "local" }
    ]
  },
  imageNodeToolbarMoreMenu: [
    { key: "expand", label: "扩图", icon: "expand", type: "provider", toolCode: "expand-image" },
    { key: "restore", label: "细节还原", icon: "restore", type: "provider", toolCode: "topaz-enhance" },
    { key: "perspective", label: "多视角", icon: "perspective", type: "provider", toolCode: "image-to-3d" },
    { key: "text-edit", label: "编辑文字", icon: "text-edit", type: "local" },
    {
      key: "adjust",
      label: "调节",
      icon: "adjust",
      hasSubmenu: true,
      type: "menu",
      children: [
        { key: "brightness", code: "adjust.brightness", label: "亮度", type: "local" },
        { key: "contrast", code: "adjust.contrast", label: "对比度", type: "local" },
        { key: "saturation", code: "adjust.saturation", label: "饱和度", type: "local" },
        { key: "sharpness", code: "adjust.sharpness", label: "锐化", type: "local" }
      ]
    },
    { key: "layers", label: "图层分离", icon: "layers", type: "local" },
    {
      key: "svg",
      label: "矢量SVG",
      icon: "svg",
      hasSubmenu: true,
      type: "menu",
      children: [
        { key: "vectorize", code: "svg.vectorize", label: "矢量化", type: "local" },
        { key: "download", code: "svg.download", label: "下载 SVG", type: "local" }
      ]
    },
    { key: "customize", label: "自定义", icon: "customize", type: "local" }
  ],
  imageCutoutModes: [
    { key: "quick", code: "cutout.quick", label: "快速", type: "provider", toolCode: "remove-background" },
    { key: "precise", code: "cutout.precise", label: "精准", type: "provider", toolCode: "remove-background" },
    { key: "eraser", code: "cutout.eraser", label: "擦除", type: "provider", toolCode: "eraser" }
  ],
  imageCropAspectRatios: [
    { key: "free", code: "crop.free", label: "自由裁剪", type: "local", ratio: null },
    { key: "original", code: "crop.original", label: "原图比例", type: "local", ratio: "original" },
    { key: "1:1", code: "crop.1:1", label: "1:1", type: "local", ratio: 1 },
    { key: "4:3", code: "crop.4:3", label: "4:3", type: "local", ratio: 4 / 3 },
    { key: "3:4", code: "crop.3:4", label: "3:4", type: "local", ratio: 3 / 4 },
    { key: "16:9", code: "crop.16:9", label: "16:9", type: "local", ratio: 16 / 9 },
    { key: "9:16", code: "crop.9:16", label: "9:16", type: "local", ratio: 9 / 16 },
    { key: "3:2", code: "crop.3:2", label: "3:2", type: "local", ratio: 3 / 2 },
    { key: "2:3", code: "crop.2:3", label: "2:3", type: "local", ratio: 2 / 3 }
  ],
  imageToolbarMoreHover: {
    split: {
      menu: ["4宫格", "9宫格", "自由"],
      children: [
        { key: "grid-4", code: "split.grid-4", label: "4宫格", type: "local" },
        { key: "grid-9", code: "split.grid-9", label: "9宫格", type: "local" },
        { key: "free", code: "split.free", label: "自由", type: "local" }
      ]
    },
    annotate: { tooltip: "标注" },
    decompose: {
      tooltip: "图层分离",
      menu: ["全部", "单个"],
      children: [
        { key: "all", code: "decompose.all", label: "全部", type: "local" },
        { key: "single", code: "decompose.single", label: "单个", type: "local" }
      ]
    },
    erase: {
      tooltip: "消除",
      menu: ["智能", "快速"],
      children: [
        { key: "smart", code: "erase.smart", label: "智能", type: "provider", toolCode: "eraser" },
        { key: "quick", code: "erase.quick", label: "快速", type: "provider", toolCode: "eraser" }
      ]
    },
    search: {
      tooltip: "搜同款",
      menu: ["同款", "类似"],
      children: [
        { key: "same", code: "search.same", label: "同款", type: "local" },
        { key: "similar", code: "search.similar", label: "类似", type: "local" }
      ]
    },
    parse: { tooltip: "解析" }
  }
};

export async function createProviderGenerationTask(task, capability) {
  if (appConfig.model.mockEnabled) {
    return null;
  }
  const response = await fetchModelProvider(appConfig.model.endpoint.replace(/\/$/, ""), {
    method: "POST",
    signal: modelRequestTimeoutSignal(),
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${appConfig.model.apiKey}`
    },
    body: JSON.stringify({
      idempotencyKey: task.idempotencyKey,
      taskId: task.id,
      projectId: task.projectId,
      nodeId: task.nodeId,
      taskType: task.taskType,
      capabilityCode: task.capabilityCode,
      capability,
      prompt: task.prompt,
      parameters: task.parameters,
      referenceAssetIds: task.referenceAssetIds
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Model provider failed: ${response.status}`);
  }
  return {
    providerTaskId: result.providerTaskId || result.id || null,
    status: normalizeStatus(result.status),
    progress: Number(result.progress ?? 0),
    results: Array.isArray(result.results) ? result.results : [],
    raw: result
  };
}

export async function createChatCompletion(body = {}) {
  if (appConfig.model.mockEnabled) {
    return mockChatCompletion(body);
  }
  return proxyOpenAiJson("/v1/chat/completions", {
    ...body,
    model: normalizeChatModel(body.model)
  });
}

export async function createChatCompletionStream(body = {}) {
  if (appConfig.model.mockEnabled) {
    return mockSseResponse([
      chatChunk("chatcmpl_mock", normalizeChatModel(body.model), "assistant", ""),
      chatChunk("chatcmpl_mock", normalizeChatModel(body.model), null, "Daone mock response"),
      chatChunk("chatcmpl_mock", normalizeChatModel(body.model), null, "", "stop"),
      "[DONE]"
    ]);
  }
  return proxyOpenAiStream("/v1/chat/completions", {
    ...body,
    model: normalizeChatModel(body.model),
    stream: true
  });
}

export function supportedChatModels() {
  return supportedProviderModels("CHAT");
}

export function supportedProviderModels(type = "CHAT") {
  const gateway = normalizeProviderModelType(type);
  const defaultProviderModel = defaultProviderModelName(gateway);
  return providerModels(gateway, { enabledOnly: true }).map((item) => ({
    code: item.modelCode,
    model: providerModelName(item),
    name: item.modelName,
    type: providerModelTypeName(gateway),
    gateway,
    provider: item.attributes?.provider || null,
    description: item.attributes?.description || "",
    supportsStreaming: item.attributes?.supportsStreaming !== false,
    default: providerModelName(item) === defaultProviderModel,
    attributes: item.attributes || {}
  }));
}

function normalizeProviderModelType(type) {
  const value = String(type || "chat").trim().toLowerCase();
  if (value === "chat") return "CHAT";
  if (value === "image") return "IMAGE";
  if (value === "video") return "VIDEO";
  throw badRequest("PROVIDER_MODEL_TYPE_NOT_SUPPORTED", "模型类型不支持");
}

function providerModelTypeName(gateway) {
  if (gateway === "IMAGE") return "IMAGE_GENERATION";
  if (gateway === "VIDEO") return "VIDEO_GENERATION";
  return "MULTIMODAL_CHAT";
}

function defaultProviderModelName(gateway) {
  const defaultModelByGateway = {
    CHAT: appConfig.model.defaultChatModel,
    IMAGE: appConfig.model.defaultImageModel,
    VIDEO: "seedance2.0"
  };
  const configured = defaultModelByGateway[gateway];
  const defaultModel = resolveProviderModel(gateway, configured, { allowPassthrough: true, ignoreStatus: true });
  return defaultModel ? providerModelName(defaultModel) : configured;
}

export async function createImageGeneration(body = {}) {
  if (appConfig.model.mockEnabled) {
    return mockImageGeneration(body);
  }
  return proxyOpenAiJson("/v1/images/generations", {
    ...body,
    model: normalizeImageModel(body.model)
  });
}

export async function createImageGenerationStream(body = {}) {
  if (appConfig.model.mockEnabled) {
    return mockSseResponse([
      JSON.stringify({ type: "image_generation.partial_image", b64_json: "" }),
      JSON.stringify({ type: "image_generation.completed", data: mockImageData(body) }),
      "[DONE]"
    ]);
  }
  return proxyOpenAiStream("/v1/images/generations", {
    ...body,
    model: normalizeImageModel(body.model),
    stream: true
  });
}

export async function createVideoGeneration(body = {}) {
  if (appConfig.model.mockEnabled) {
    return mockVideoGeneration(body);
  }
  const provider = normalizeVideoProvider(body.model);
  const submitted = await submitVideoGeneration(provider, body);
  return {
    id: submitted.taskId,
    object: "video.generation",
    created: Math.floor(Date.now() / 1000),
    model: provider.publicModel,
    status: submitted.status || "submitted",
    provider: provider.name,
    providerTaskId: submitted.taskId,
    raw: submitted.raw
  };
}

export async function createVideoGenerationStream(body = {}) {
  if (appConfig.model.mockEnabled) {
    return mockVideoGenerationStream(body);
  }
  const provider = normalizeVideoProvider(body.model);
  const maxPolls = Math.max(1, Math.min(120, Number(body.maxPolls || 60)));
  const pollIntervalMs = Math.max(500, Math.min(10000, Number(body.pollIntervalMs || 2000)));
  return sseResponseFromAsyncGenerator(async function * videoEvents() {
    const submitted = await submitVideoGeneration(provider, body);
    const id = submitted.taskId;
    yield videoChunk({ id, model: provider.publicModel, status: submitted.status || "submitted", progress: 0, provider: provider.name });
    for (let index = 0; index < maxPolls; index += 1) {
      await sleep(pollIntervalMs);
      const status = await getVideoGenerationStatus(provider, id);
      yield videoChunk({
        id,
        model: provider.publicModel,
        status: status.status,
        progress: status.progress,
        provider: provider.name,
        result: status.result,
        error: status.error
      });
      if (isVideoTerminal(status.status)) {
        yield "[DONE]";
        return;
      }
    }
    yield videoChunk({ id, model: provider.publicModel, status: "timeout", progress: null, provider: provider.name });
    yield "[DONE]";
  });
}

export async function callModelTool(toolCode, body = {}) {
  const code = String(toolCode || "").trim();
  if (appConfig.model.mockEnabled) {
    return {
      toolCode: code,
      status: "SUCCEEDED",
      mock: true,
      input: body
    };
  }
  const path = TOOL_PATHS[code];
  if (!path) {
    throw badRequest("MODEL_TOOL_NOT_CONFIGURED", "模型工具未配置或不支持");
  }
  return proxyJson(appConfig.model.toolsBaseUrl, path, body);
}

export function supportedModelTools() {
  return {
    items: TOOL_DEFINITIONS.map((tool) => serializeTool(tool)),
    toolbars: withToolConfiguration(TOOL_UI)
  };
}

function serializeTool(tool) {
  return {
    code: tool.code,
    label: tool.label,
    type: tool.type,
    category: tool.category,
    configured: Boolean(tool.path)
  };
}

function withToolConfiguration(value) {
  if (Array.isArray(value)) {
    return value.map((item) => withToolConfiguration(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    output[key] = withToolConfiguration(child);
  }
  if (typeof output.toolCode === "string") {
    output.configured = Boolean(TOOL_PATHS[output.toolCode]);
  }
  return output;
}

function normalizeStatus(status) {
  if (["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELED"].includes(status)) {
    return status;
  }
  return "QUEUED";
}

function normalizeChatModel(model) {
  const value = String(model || appConfig.model.defaultChatModel || "gpt-5.5").trim();
  const managed = resolveProviderModel("CHAT", value, { allowPassthrough: true });
  return managed ? providerModelName(managed) : value;
}

function normalizeImageModel(model) {
  const value = String(model || appConfig.model.defaultImageModel || "gpt-image-2").trim();
  const managed = resolveProviderModel("IMAGE", value, { allowPassthrough: true });
  return managed ? providerModelName(managed) : value;
}

function normalizeVideoProvider(model) {
  const video = resolveVideoProviderModel(model);
  const name = video.name;
  const config = name === "seedance" ? appConfig.model.videos.seedance : appConfig.model.videos.happyHorse;
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw badGateway("VIDEO_MODEL_API_KEY_MISSING", "视频模型 API Key 未配置");
  }
  return {
    name,
    publicModel: video.publicModel,
    config
  };
}

function resolveVideoProviderModel(model) {
  const value = String(model || "seedance2.0").trim();
  const managed = resolveProviderModel("VIDEO", value, {
    allowPassthrough: false,
    unsupportedCode: "VIDEO_MODEL_NOT_SUPPORTED",
    unsupportedMessage: "视频模型不支持"
  });
  const name = managed?.attributes?.providerKey;
  if (!managed || !name) {
    throw badRequest("VIDEO_MODEL_NOT_SUPPORTED", "视频模型不支持");
  }
  return {
    name,
    publicModel: providerModelName(managed)
  };
}

function resolveProviderModel(gateway, requestedModel, options = {}) {
  const value = String(requestedModel || "").trim();
  const match = findProviderModel(gateway, value);
  if (!match) {
    if (options.allowPassthrough) {
      return null;
    }
    throw badRequest(options.unsupportedCode || "MODEL_NOT_SUPPORTED", options.unsupportedMessage || "模型不支持");
  }
  if (!options.ignoreStatus && match.status !== "ENABLED") {
    throw badRequest("MODEL_DISABLED", "模型已停用");
  }
  return match;
}

function findProviderModel(gateway, value) {
  const normalized = normalizeLookupKey(value);
  return providerModels(gateway).find((item) => providerLookupValues(item).some((candidate) => normalizeLookupKey(candidate) === normalized));
}

function providerModels(gateway, options = {}) {
  return [...store.models.values()]
    .filter((item) => !item.deleted)
    .filter((item) => item.attributes?.surface === "PROVIDER")
    .filter((item) => item.attributes?.gateway === gateway)
    .filter((item) => !options.enabledOnly || item.status === "ENABLED")
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
}

function providerLookupValues(model) {
  return [
    model.modelCode,
    model.modelName,
    providerModelName(model),
    ...(Array.isArray(model.attributes?.aliases) ? model.attributes.aliases : [])
  ].filter(Boolean);
}

function providerModelName(model) {
  const configKey = model.attributes?.providerModelConfigKey;
  if (configKey && appConfig.model[configKey]) {
    return appConfig.model[configKey];
  }
  return model.parameters?.providerModel || model.attributes?.providerModel || model.modelCode;
}

function normalizeLookupKey(value) {
  return String(value || "").trim().toLowerCase();
}

async function proxyOpenAiJson(path, body) {
  return proxyJson(appConfig.model.openaiBaseUrl, path, body);
}

async function proxyOpenAiStream(path, body) {
  const response = await fetchProvider(appConfig.model.openaiBaseUrl, path, body, {
    accept: "text/event-stream"
  });
  if (!response.ok) {
    await throwProviderError(response);
  }
  return response;
}

async function proxyJson(baseUrl, path, body) {
  const response = await fetchProvider(baseUrl, path, body);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw badGateway("MODEL_SERVICE_ERROR", "外部模型服务异常", {
      status: response.status,
      providerError: sanitizeProviderError(result)
    });
  }
  return result;
}

async function submitVideoGeneration(provider, body) {
  if (provider.name === "seedance") {
    const response = await fetchVideoProvider(provider, provider.config.createPath, "POST", buildSeedanceVideoBody(provider, body));
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw badGateway("VIDEO_MODEL_SERVICE_ERROR", "视频模型服务异常", {
        status: response.status,
        providerError: sanitizeProviderError(result)
      });
    }
    return {
      taskId: result.id || result.task_id || result.taskId || result.data?.id || result.data?.task_id,
      status: normalizeVideoStatus(result.status || result.data?.status),
      raw: result
    };
  }
    const response = await fetchVideoProvider(provider, provider.config.createPath, "POST", buildHappyHorseVideoBody(body), selectHappyHorseModel(provider, body));
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw badGateway("VIDEO_MODEL_SERVICE_ERROR", "视频模型服务异常", {
      status: response.status,
      providerError: sanitizeProviderError(result)
    });
  }
  return {
    taskId: result.request_id || result.requestId || result.id,
    status: normalizeVideoStatus(result.status),
    raw: result
  };
}

async function getVideoGenerationStatus(provider, taskId) {
  const providerModel = provider.providerModel || provider.config.model;
  const statusPath = provider.config.statusPath.replaceAll("{taskId}", encodeURIComponent(taskId));
  const response = await fetchVideoProvider(provider, statusPath, "GET", undefined, providerModel);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      status: "failed",
      progress: null,
      error: sanitizeProviderError(result),
      raw: result
    };
  }
  if (provider.name === "happyHorse" && isFalCompleted(result.status)) {
    const finalResult = await getHappyHorseResult(provider, taskId);
    return {
      status: "succeeded",
      progress: 100,
      result: extractVideoResult(finalResult),
      raw: finalResult
    };
  }
  return {
    status: normalizeVideoStatus(result.status || result.data?.status),
    progress: extractProgress(result),
    result: extractVideoResult(result),
    error: result.error || result.data?.error || null,
    raw: result
  };
}

async function getHappyHorseResult(provider, taskId) {
  const providerModel = provider.providerModel || provider.config.model;
  const resultPath = provider.config.resultPath.replaceAll("{taskId}", encodeURIComponent(taskId));
  const response = await fetchVideoProvider(provider, resultPath, "GET", undefined, providerModel);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { error: sanitizeProviderError(result) };
  }
  return result;
}

async function fetchVideoProvider(provider, path, method, body, providerModel = provider.config.model) {
  const headers = provider.name === "happyHorse"
    ? { authorization: `Key ${provider.config.apiKey}` }
    : { authorization: `Bearer ${provider.config.apiKey}` };
  const resolved = resolveVideoProviderUrl(provider, path, providerModel);
  return fetchModelProvider(resolved, {
    method,
    signal: modelRequestTimeoutSignal(),
    headers: {
      ...headers,
      ...(body ? { "content-type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}

function resolveVideoProviderUrl(provider, path, providerModel = provider.config.model) {
  const withModel = String(path || "")
    .replaceAll("{model}", providerModel)
    .replaceAll("{modelUrlEncoded}", encodeURIComponent(providerModel));
  return resolveProviderUrl(provider.config.baseUrl, withModel);
}

function selectHappyHorseModel(provider, body) {
  const providerModel = body.providerModel || body.falModel || (body.imageUrl ? provider.config.imageModel : provider.config.textModel) || provider.config.model;
  provider.providerModel = providerModel;
  return providerModel;
}

function buildSeedanceVideoBody(provider, body) {
  if (body.providerBody && typeof body.providerBody === "object") {
    return {
      model: provider.config.model,
      ...body.providerBody
    };
  }
  return compactObject({
    model: provider.config.model,
    content: body.content || [
      compactObject({ type: "text", text: body.prompt }),
      ...(body.imageUrl ? [compactObject({ type: "image_url", image_url: { url: body.imageUrl } })] : [])
    ].filter((item) => item.text || item.image_url),
    duration: body.duration,
    aspect_ratio: body.aspectRatio,
    resolution: body.resolution,
    seed: body.seed,
    callback_url: body.callbackUrl
  });
}

function buildHappyHorseVideoBody(body) {
  if (body.providerBody && typeof body.providerBody === "object") {
    return body.providerBody;
  }
  if (body.input && typeof body.input === "object") {
    return body.input;
  }
  return compactObject({
    prompt: body.prompt,
    image_url: body.imageUrl,
    duration: body.duration,
    aspect_ratio: body.aspectRatio,
    resolution: body.resolution,
    seed: body.seed
  });
}

function normalizeVideoStatus(status) {
  const value = String(status || "submitted").toLowerCase();
  if (["succeeded", "success", "completed", "complete", "done"].includes(value)) return "succeeded";
  if (["failed", "failure", "error"].includes(value)) return "failed";
  if (["canceled", "cancelled"].includes(value)) return "canceled";
  if (value === "timeout") return "timeout";
  if (["running", "in_progress", "processing", "in_queue", "queued"].includes(value)) return "running";
  return "submitted";
}

function isFalCompleted(status) {
  return ["completed", "succeeded"].includes(String(status || "").toLowerCase());
}

function isVideoTerminal(status) {
  return ["succeeded", "failed", "canceled", "timeout"].includes(normalizeVideoStatus(status));
}

function extractProgress(result) {
  const value = result.progress ?? result.data?.progress ?? result.percent ?? result.data?.percent;
  return value === undefined || value === null ? null : Number(value);
}

function extractVideoResult(result) {
  const data = result.data || result;
  const video = data.video || data.output || data.result || data.videos?.[0] || data.video_url;
  if (!video) return null;
  if (typeof video === "string") {
    return { videoUrl: video };
  }
  return {
    videoUrl: video.url || video.video_url || video.download_url || null,
    thumbnailUrl: video.thumbnail_url || video.cover_url || null,
    raw: video
  };
}

async function fetchProvider(baseUrl, path, body, extraHeaders = {}) {
  if (!appConfig.model.apiKey) {
    throw badGateway("MODEL_API_KEY_MISSING", "模型服务 API Key 未配置");
  }
  return fetchModelProvider(resolveProviderUrl(baseUrl, path), {
    method: "POST",
    signal: modelRequestTimeoutSignal(),
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${appConfig.model.apiKey}`,
      ...extraHeaders
    },
    body: JSON.stringify(body)
  });
}

function modelRequestTimeoutSignal() {
  return AbortSignal.timeout(appConfig.model.requestTimeoutMs);
}

async function fetchModelProvider(url, options) {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (isModelRequestTimeout(error)) {
      throw badGateway("MODEL_SERVICE_TIMEOUT", "外部模型服务请求超时", {
        timeoutMs: appConfig.model.requestTimeoutMs
      });
    }
    throw error;
  }
}

function isModelRequestTimeout(error) {
  return error?.name === "TimeoutError" || error?.name === "AbortError";
}

function resolveProviderUrl(baseUrl, path) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalizedBase = String(baseUrl || "https://api.302.ai").replace(/\/$/, "");
  const normalizedPath = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function throwProviderError(response) {
  const result = await response.json().catch(() => ({}));
  throw badGateway("MODEL_SERVICE_ERROR", "外部模型服务异常", {
    status: response.status,
    providerError: sanitizeProviderError(result)
  });
}

function sanitizeProviderError(value) {
  if (!value || typeof value !== "object") return null;
  const error = value.error && typeof value.error === "object" ? value.error : value;
  return {
    code: error.code,
    message: error.message || error.error || "provider error",
    type: error.type
  };
}

function mockChatCompletion(body) {
  const id = "chatcmpl_mock";
  const created = Math.floor(Date.now() / 1000);
  const model = normalizeChatModel(body.model);
  return {
    id,
    object: "chat.completion",
    created,
    model,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: "Daone mock response"
      },
      finish_reason: "stop"
    }]
  };
}

function mockImageGeneration(body) {
  return {
    created: Math.floor(Date.now() / 1000),
    data: mockImageData(body)
  };
}

function mockImageData(body) {
  const count = Math.max(1, Math.min(4, Number(body.n || body.count || 1)));
  return Array.from({ length: count }, (_, index) => ({
    url: `${appConfig.storage.publicBaseUrl.replace(/\/$/, "")}/generated/mock-image-${index + 1}.png`,
    revised_prompt: body.prompt || ""
  }));
}

function mockVideoGeneration(body) {
  return {
    id: "video_mock",
    object: "video.generation",
    created: Math.floor(Date.now() / 1000),
    model: normalizeMockVideoModel(body.model),
    status: "succeeded",
    provider: normalizeVideoProviderNameForMock(body.model),
    providerTaskId: "video_mock",
    result: {
      videoUrl: `${appConfig.storage.publicBaseUrl.replace(/\/$/, "")}/generated/mock-video.mp4`
    }
  };
}

function mockVideoGenerationStream(body) {
  const id = "video_mock";
  const model = normalizeMockVideoModel(body.model);
  const provider = normalizeVideoProviderNameForMock(body.model);
  return mockSseResponse([
    videoChunk({ id, model, provider, status: "submitted", progress: 0 }),
    videoChunk({ id, model, provider, status: "running", progress: 50 }),
    videoChunk({
      id,
      model,
      provider,
      status: "succeeded",
      progress: 100,
      result: {
        videoUrl: `${appConfig.storage.publicBaseUrl.replace(/\/$/, "")}/generated/mock-video.mp4`
      }
    }),
    "[DONE]"
  ]);
}

function normalizeMockVideoModel(model) {
  return resolveVideoProviderModel(model).publicModel;
}

function normalizeVideoProviderNameForMock(model) {
  return resolveVideoProviderModel(model).name;
}

function chatChunk(id, model, role, content, finishReason = null) {
  return JSON.stringify({
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      delta: {
        ...(role ? { role } : {}),
        ...(content ? { content } : {})
      },
      finish_reason: finishReason
    }]
  });
}

function videoChunk({ id, model, status, progress, provider, result = null, error = null }) {
  return JSON.stringify({
    id,
    object: "video.generation.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    provider,
    choices: [{
      index: 0,
      delta: compactObject({
        status: normalizeVideoStatus(status),
        progress,
        result,
        error
      }),
      finish_reason: isVideoTerminal(status) ? normalizeVideoStatus(status) : null
    }]
  });
}

function mockSseResponse(items) {
  return {
    status: 200,
    ok: true,
    headers: new Headers({ "content-type": "text/event-stream" }),
    body: ReadableStreamFrom(items.map((item) => `data: ${item}\n\n`).join(""))
  };
}

function sseResponseFromAsyncGenerator(factory) {
  const encoder = new TextEncoder();
  return {
    status: 200,
    ok: true,
    headers: new Headers({ "content-type": "text/event-stream" }),
    body: new ReadableStream({
      async start(controller) {
        try {
          for await (const item of factory()) {
            controller.enqueue(encoder.encode(`data: ${item}\n\n`));
          }
          controller.close();
        } catch (error) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            object: "error",
            error: {
              code: error.code || "VIDEO_MODEL_STREAM_ERROR",
              message: error.message || "视频模型流式响应异常"
            }
          })}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      }
    })
  };
}

function ReadableStreamFrom(text) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    }
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""));
}
