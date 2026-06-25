import { store } from "../../infrastructure/db/memoryStore.js";
import { nextId } from "../../infrastructure/common/id.js";
import { badRequest, forbidden, notFound } from "../common/errors.js";
import { requireProject } from "./projectService.js";
import { assertAssetsAccessible } from "./assetService.js";
import { createChatCompletion } from "../../infrastructure/middleware/modelClient.js";

export function createSession(userId, body) {
  if (body.projectId) {
    requireProject(userId, body.projectId);
  }
  const id = nextId();
  const t = new Date().toISOString();
  const session = {
    id,
    userId,
    projectId: body.projectId ? String(body.projectId) : null,
    title: body.title || "New Chat",
    deleted: false,
    createdAt: t,
    updatedAt: t
  };
  store.chatSessions.set(id, session);
  return toSession(session);
}

export function sessions(userId, projectId) {
  return [...store.chatSessions.values()]
    .filter((item) => item.userId === userId && !item.deleted)
    .filter((item) => !projectId || item.projectId === String(projectId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(toSession);
}

export function messages(userId, sessionId) {
  requireSession(userId, sessionId);
  return [...store.chatMessages.values()]
    .filter((item) => item.sessionId === String(sessionId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(toMessage);
}

export async function sendMessage(userId, sessionId, body = {}) {
  const session = requireSession(userId, sessionId);
  if (!body.content || !String(body.content).trim()) {
    throw badRequest("PARAM_INVALID", "消息内容不能为空");
  }
  assertAssetsAccessible(userId, body.attachmentAssetIds || []);
  const t = new Date().toISOString();
  const userMessage = {
    id: nextId(),
    sessionId: session.id,
    role: "USER",
    content: body.content,
    attachmentAssetIds: body.attachmentAssetIds || [],
    generationTaskIds: [],
    createdAt: t
  };
  store.chatMessages.set(userMessage.id, userMessage);
  const completion = await createChatCompletion({
    model: resolveChatModel(body),
    messages: providerMessages(session.id, {
      skillCode: body.skillCode,
      modelCode: body.modelCode,
      attachmentAssetIds: body.attachmentAssetIds || []
    })
  });
  const assistantMessage = {
    id: nextId(),
    sessionId: session.id,
    role: "ASSISTANT",
    content: completionText(completion),
    attachmentAssetIds: [],
    generationTaskIds: [],
    createdAt: new Date().toISOString()
  };
  store.chatMessages.set(assistantMessage.id, assistantMessage);
  session.updatedAt = assistantMessage.createdAt;
  return {
    message: toMessage(assistantMessage),
    generationTaskIds: []
  };
}

function resolveChatModel(body) {
  const explicitChatModel = body.chatModelCode || body.chatModel || body.model;
  if (explicitChatModel) return explicitChatModel;
  if (isEnabledChatModel(body.modelCode)) return body.modelCode;
  return undefined;
}

function isEnabledChatModel(modelCode) {
  if (!modelCode) return false;
  const model = store.models.get(String(modelCode));
  return model && !model.deleted && model.status === "ENABLED" && model.taskType === "CHAT";
}

function providerMessages(sessionId, context = {}) {
  const messages = [...store.chatMessages.values()]
    .filter((item) => item.sessionId === String(sessionId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((item) => ({
      role: item.role === "ASSISTANT" ? "assistant" : "user",
      content: item.content
    }));
  const system = systemPrompt(context);
  return system ? [{ role: "system", content: system }, ...messages] : messages;
}

function systemPrompt({ skillCode, modelCode, attachmentAssetIds }) {
  const parts = [
    "你是 Daone 产品前台画布里的 AI 助手。请用简洁、可执行的中文回答用户，并结合上下文帮助用户完成创作。"
  ];
  if (skillCode) {
    parts.push(`当前用户选择的技能编码：${skillCode}。`);
  }
  if (modelCode) {
    parts.push(`当前用户选择的生成能力编码：${modelCode}。`);
  }
  if (attachmentAssetIds?.length) {
    parts.push(`用户随消息附带了 ${attachmentAssetIds.length} 个素材附件，附件 ID：${attachmentAssetIds.join(", ")}。`);
  }
  return parts.join("\n");
}

function completionText(completion) {
  const choice = Array.isArray(completion?.choices) ? completion.choices[0] : null;
  const content = choice?.message?.content ?? choice?.delta?.content ?? completion?.content;
  return String(content || "").trim() || "模型暂未返回内容，请稍后再试。";
}

export function deleteSession(userId, sessionId) {
  const session = requireSession(userId, sessionId);
  session.deleted = true;
}

function requireSession(userId, sessionId) {
  const session = store.chatSessions.get(String(sessionId));
  if (!session || session.deleted) throw notFound("对话不存在");
  if (session.userId !== userId) throw forbidden();
  return session;
}

function toSession(session) {
  return {
    id: session.id,
    projectId: session.projectId,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  };
}

function toMessage(message) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    attachmentAssetIds: message.attachmentAssetIds,
    generationTaskIds: message.generationTaskIds,
    createdAt: message.createdAt
  };
}
