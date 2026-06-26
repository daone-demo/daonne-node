import crypto from "node:crypto";
import { appConfig } from "../../infrastructure/config/env.js";
import { store } from "../../infrastructure/db/memoryStore.js";
import { nextId } from "../../infrastructure/common/id.js";
import { badGateway, badRequest, forbidden, notFound } from "../common/errors.js";
import { requireProject } from "./projectService.js";
import { reviewAsset } from "../../infrastructure/middleware/contentSafetyClient.js";

const MB = 1024 * 1024;
const MAX_UPLOAD_SIZE_BY_TYPE = {
  IMAGE: 10 * MB,
  VIDEO: 50 * MB
};

export async function createUploadTicket(userId, body) {
  const upload = normalizeUploadBody(body);
  if (!upload.fileName || !upload.contentType || !upload.fileSize) {
    throw badRequest("PARAM_INVALID", "fileName、contentType、fileSize 不能为空");
  }
  const type = mediaType(upload.contentType);
  validateUploadSize(type, upload.fileSize);
  if (upload.projectId) {
    requireProject(userId, upload.projectId);
  }
  const extension = upload.fileName.includes(".") ? upload.fileName.slice(upload.fileName.lastIndexOf(".")) : "";
  const objectKey = `${type.toLowerCase()}/${userId}/${crypto.randomUUID()}${extension}`;
  return createUploadedAsset(userId, {
    projectId: upload.projectId,
    fileName: upload.fileName,
    contentType: upload.contentType,
    fileSize: upload.fileSize,
    content: upload.content,
    type,
    objectKey
  });
}

export async function completeUpload(userId, body) {
  return createUploadTicket(userId, body);
}

async function createUploadedAsset(userId, upload) {
  await uploadObjectToStorage(upload);
  const id = nextId();
  const t = new Date().toISOString();
  const asset = {
    id,
    userId,
    projectId: upload.projectId ? String(upload.projectId) : null,
    type: upload.type,
    source: "UPLOAD",
    fileName: upload.fileName,
    objectKey: upload.objectKey,
    contentType: upload.contentType,
    fileSize: Number(upload.fileSize),
    width: null,
    height: null,
    durationSeconds: null,
    reviewStatus: "REVIEWING",
    previewUrl: publicObjectUrl(upload.objectKey),
    createdAt: t,
    updatedAt: t
  };
  const review = await safeReviewAsset(asset);
  asset.reviewStatus = review.status;
  store.assets.set(id, asset);
  const view = toAssetView(asset, userId);
  return {
    ...view,
    url: asset.previewUrl,
    objectKey: asset.objectKey
  };
}

function normalizeUploadBody(body) {
  const file = body.file || body.asset || body.uploadFile || null;
  const content = uploadContent(body, file);
  const fileSize = body.fileSize !== undefined && body.fileSize !== null && body.fileSize !== ""
    ? Number(body.fileSize)
    : file?.fileSize || content?.length;
  if (content && fileSize !== content.length) {
    throw badRequest("FILE_SIZE_MISMATCH", "上传文件大小与文件内容不一致");
  }
  return {
    projectId: body.projectId,
    fileName: body.fileName || file?.fileName,
    contentType: body.contentType || file?.contentType,
    fileSize,
    content
  };
}

function uploadContent(body, file) {
  if (Buffer.isBuffer(file?.content)) return file.content;
  if (typeof body.fileBase64 === "string") return Buffer.from(stripDataUrlPrefix(body.fileBase64), "base64");
  if (typeof body.fileContent === "string") return Buffer.from(stripDataUrlPrefix(body.fileContent), "base64");
  return null;
}

function stripDataUrlPrefix(value) {
  return value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
}

async function uploadObjectToStorage(upload) {
  if (appConfig.storage.mockEnabled) {
    if (!isLocalRuntime()) {
      throw badGateway("STORAGE_MOCK_NOT_ALLOWED", "Storage mock 仅允许本地环境使用");
    }
    return;
  }
  if (!upload.content) {
    throw badRequest("FILE_REQUIRED", "请上传文件内容");
  }
  const response = await fetch(ossUploadObjectUrl(upload.objectKey), {
    method: "PUT",
    headers: ossPutObjectHeaders(upload),
    body: upload.content
  });
  if (!response.ok) {
    const responseBody = await response.text().catch(() => "");
    throw badGateway("OSS_UPLOAD_ERROR", "OSS 文件上传失败", {
      status: response.status,
      reason: responseBody.slice(0, 500)
    });
  }
}

function isLocalRuntime() {
  return appConfig.profile === "local" && !process.env.VERCEL && !process.env.VERCEL_ENV;
}

export function listAssets(userId, query) {
  let items = [...store.assets.values()].filter((item) => item.reviewStatus === "AVAILABLE");
  if (query.type) items = items.filter((item) => item.type === query.type);
  if (query.source) items = items.filter((item) => item.source === query.source);
  if (query.keyword) items = items.filter((item) => item.fileName.includes(query.keyword));
  if (query.scope === "FAVORITE") {
    items = items.filter((item) => store.favorites.has(`${userId}:${item.id}`));
    if (query.projectId) items = items.filter((item) => !item.projectId || item.projectId === String(query.projectId));
  } else if (query.scope === "CENTER" || query.scope === "RECOMMENDED") {
    items = items.filter((item) => item.source === "TEMPLATE");
  } else if (query.scope === "FILES") {
    items = items.filter((item) => item.userId === userId && ["UPLOAD", "GENERATED"].includes(item.source));
    if (query.projectId) items = items.filter((item) => item.projectId === String(query.projectId));
  } else {
    items = items.filter((item) => item.userId === userId);
    if (query.projectId) items = items.filter((item) => item.projectId === String(query.projectId));
  }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((item) => toAssetView(item, userId));
}

export function getAsset(userId, assetId) {
  return toAssetView(requireAsset(userId, assetId), userId);
}

export function favoriteAsset(userId, assetId) {
  requireAsset(userId, assetId);
  store.favorites.add(`${userId}:${assetId}`);
  return { favorited: true };
}

export function unfavoriteAsset(userId, assetId) {
  store.favorites.delete(`${userId}:${assetId}`);
}

export function deleteAsset(userId, assetId) {
  const asset = requireAsset(userId, assetId);
  if (asset.userId !== userId) throw forbidden();
  asset.reviewStatus = "DELETED";
}

export function assertAssetsAccessible(userId, assetIds = []) {
  for (const assetId of assetIds || []) {
    requireAsset(userId, assetId);
  }
}

function requireAsset(userId, assetId) {
  const asset = store.assets.get(String(assetId));
  if (!asset || asset.reviewStatus === "DELETED") {
    throw notFound("素材不存在");
  }
  if (asset.userId !== userId && asset.source !== "TEMPLATE") {
    throw forbidden();
  }
  return asset;
}

function toAssetView(asset, userId) {
  return {
    id: asset.id,
    type: asset.type,
    source: asset.source,
    fileName: asset.fileName,
    previewUrl: asset.previewUrl,
    fileSize: asset.fileSize,
    width: asset.width,
    height: asset.height,
    durationSeconds: asset.durationSeconds,
    status: asset.reviewStatus,
    favorited: store.favorites.has(`${userId}:${asset.id}`),
    tags: asset.tags || [],
    createdAt: asset.createdAt
  };
}

function mediaType(contentType) {
  if (contentType.startsWith("image/")) return "IMAGE";
  if (contentType.startsWith("video/")) return "VIDEO";
  throw badRequest("FILE_TYPE_NOT_SUPPORTED", "仅支持图片和视频");
}

function validateUploadSize(type, fileSize) {
  const maxSize = MAX_UPLOAD_SIZE_BY_TYPE[type];
  if (Number(fileSize) > maxSize) {
    throw badRequest("FILE_SIZE_TOO_LARGE", `上传文件过大，图片最大 10M，视频最大 50M`);
  }
}

async function safeReviewAsset(asset) {
  try {
    return await reviewAsset(asset);
  } catch (error) {
    throw badGateway("CONTENT_SAFETY_ERROR", "内容安全服务异常", { reason: error.message });
  }
}

function publicObjectUrl(objectKey) {
  if (appConfig.storage.publicBaseUrl) {
    return joinUrl(appConfig.storage.publicBaseUrl, objectKey);
  }
  return ossObjectUrl(objectKey);
}

function ossObjectUrl(objectKey) {
  const endpoint = appConfig.storage.oss.endpoint.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const bucket = appConfig.storage.oss.bucket;
  if (!endpoint || !bucket) {
    return joinUrl(appConfig.storage.publicBaseUrl || "/api/mock-files", objectKey);
  }
  return `https://${bucket}.${endpoint}/${encodeObjectKey(objectKey)}`;
}

function ossUploadObjectUrl(objectKey) {
  const endpoint = appConfig.storage.oss.endpoint.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const bucket = appConfig.storage.oss.bucket;
  if (!endpoint || !bucket || !appConfig.aliyun.accessKeyId || !appConfig.aliyun.accessKeySecret) {
    throw badGateway("OSS_CONFIG_MISSING", "OSS 配置不完整");
  }
  return `https://${bucket}.${endpoint}/${encodeObjectKey(objectKey)}`;
}

function ossPutObjectHeaders(upload) {
  const date = new Date().toUTCString();
  const resource = `/${appConfig.storage.oss.bucket}/${upload.objectKey}`;
  const stringToSign = ["PUT", "", upload.contentType, date, resource].join("\n");
  const signature = crypto
    .createHmac("sha1", appConfig.aliyun.accessKeySecret)
    .update(stringToSign)
    .digest("base64");
  return {
    Date: date,
    "Content-Type": upload.contentType,
    "Content-Length": String(upload.content.length),
    Authorization: `OSS ${appConfig.aliyun.accessKeyId}:${signature}`
  };
}

function joinUrl(baseUrl, objectKey) {
  return `${baseUrl.replace(/\/$/, "")}/${encodeObjectKey(objectKey)}`;
}

function encodeObjectKey(objectKey) {
  return String(objectKey).split("/").map(encodeURIComponent).join("/");
}
