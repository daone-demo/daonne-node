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

function mockSseResponse(items) {
  return {
    status: 200,
    ok: true,
    headers: new Headers({ "content-type": "text/event-stream" }),
    body: ReadableStreamFrom(items.map((item) => `data: ${item}\n\n`).join(""))
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
