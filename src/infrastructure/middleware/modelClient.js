import { appConfig } from "../config/env.js";
import { badGateway, badRequest } from "../../service/common/errors.js";

const CHAT_MODEL_ALIASES = {
  "gpt5.5": "gpt-5.5",
  "gpt-5.5": "gpt-5.5",
  codex: appConfig.model.defaultCodexModel
};

const IMAGE_MODEL_ALIASES = {
  "image2.0": "gpt-image-2",
  "gpt-image-2": "gpt-image-2",
  "nanobanana 2.0": "gemini-3.1-flash-image-preview",
  "nanobanana-2.0": "gemini-3.1-flash-image-preview",
  nanobanana2: "gemini-3.1-flash-image-preview",
  "gemini-3.1-flash-image-preview": "gemini-3.1-flash-image-preview"
};

const VIDEO_MODEL_ALIASES = {
  seedance: "seedance",
  "seedance2": "seedance",
  "seedance2.0": "seedance",
  "seedance-2.0": "seedance",
  "seedance-2-0": "seedance",
  "happy-horse": "happyHorse",
  "happy horse": "happyHorse",
  happyhorse: "happyHorse"
};

const TOOL_PATHS = {
  "remove-background": appConfig.model.tools.removeBackground,
  eraser: appConfig.model.tools.eraser,
  "expand-image": appConfig.model.tools.expandImage,
  "increase-resolution": appConfig.model.tools.increaseResolution,
  "image-to-3d": appConfig.model.tools.imageTo3d,
  "prompt-expert": appConfig.model.tools.promptExpert,
  "product-image-replacement": appConfig.model.tools.productImageReplacement,
  "pose-transfer": appConfig.model.tools.poseTransfer,
  "topaz-enhance": appConfig.model.tools.topazEnhance
};

export async function createProviderGenerationTask(task, capability) {
  if (appConfig.model.mockEnabled) {
    return null;
  }
  const response = await fetch(appConfig.model.endpoint.replace(/\/$/, ""), {
    method: "POST",
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
  return Object.entries(TOOL_PATHS).map(([code, path]) => ({
    code,
    configured: Boolean(path)
  }));
}

function normalizeStatus(status) {
  if (["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELED"].includes(status)) {
    return status;
  }
  return "QUEUED";
}

function normalizeChatModel(model) {
  const value = String(model || appConfig.model.defaultChatModel || "gpt-5.5").trim();
  return CHAT_MODEL_ALIASES[value.toLowerCase()] || value;
}

function normalizeImageModel(model) {
  const value = String(model || appConfig.model.defaultImageModel || "gpt-image-2").trim();
  return IMAGE_MODEL_ALIASES[value.toLowerCase()] || value;
}

function normalizeVideoProvider(model) {
  const value = String(model || "seedance2.0").trim();
  const name = VIDEO_MODEL_ALIASES[value.toLowerCase()];
  if (!name) {
    throw badRequest("VIDEO_MODEL_NOT_SUPPORTED", "视频模型不支持");
  }
  const config = name === "seedance" ? appConfig.model.videos.seedance : appConfig.model.videos.happyHorse;
  const apiKey = config.apiKey;
  if (!apiKey) {
    throw badGateway("VIDEO_MODEL_API_KEY_MISSING", "视频模型 API Key 未配置");
  }
  return {
    name,
    publicModel: name === "seedance" ? "seedance2.0" : "happy-horse",
    config
  };
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
  return fetch(resolved, {
    method,
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
  return fetch(resolveProviderUrl(baseUrl, path), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${appConfig.model.apiKey}`,
      ...extraHeaders
    },
    body: JSON.stringify(body)
  });
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
  const value = String(model || "seedance2.0").toLowerCase();
  return VIDEO_MODEL_ALIASES[value] === "happyHorse" ? "happy-horse" : "seedance2.0";
}

function normalizeVideoProviderNameForMock(model) {
  const value = String(model || "seedance2.0").toLowerCase();
  return VIDEO_MODEL_ALIASES[value] === "happyHorse" ? "happyHorse" : "seedance";
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
