import { badRequest, notFound } from "./errors.js";

export async function readJson(req) {
  const raw = (await readRawBody(req)).toString("utf8");
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw badRequest("JSON_INVALID", "请求体不是合法 JSON");
  }
}

export async function readBody(req) {
  const contentType = headerValue(req.headers, "content-type");
  if (contentType.includes("multipart/form-data")) {
    return readMultipartForm(req, contentType);
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return readUrlEncodedForm(req);
  }
  return readJson(req);
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function readUrlEncodedForm(req) {
  const raw = (await readRawBody(req)).toString("utf8");
  return Object.fromEntries(new URLSearchParams(raw));
}

async function readMultipartForm(req, contentType) {
  const boundary = multipartBoundary(contentType);
  if (!boundary) {
    throw badRequest("MULTIPART_BOUNDARY_MISSING", "multipart/form-data 缺少 boundary");
  }
  const raw = (await readRawBody(req)).toString("latin1");
  const parts = raw.split(`--${boundary}`);
  const body = {};
  for (const rawPart of parts) {
    if (!rawPart || rawPart === "--\r\n" || rawPart === "--") continue;
    const part = rawPart.replace(/^\r\n/, "").replace(/\r\n$/, "").replace(/--$/, "");
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd < 0) continue;
    const headers = parsePartHeaders(part.slice(0, headerEnd));
    const content = Buffer.from(part.slice(headerEnd + 4), "latin1");
    const disposition = parseContentDisposition(headers["content-disposition"] || "");
    if (!disposition.name) continue;
    if (disposition.filename !== undefined) {
      body[disposition.name] = {
        fileName: disposition.filename,
        contentType: headers["content-type"] || "application/octet-stream",
        fileSize: content.length,
        content
      };
    } else {
      body[disposition.name] = content.toString("utf8");
    }
  }
  return body;
}

function headerValue(headers, name) {
  const lowerName = name.toLowerCase();
  return String(headers[lowerName] || headers[name] || "");
}

function multipartBoundary(contentType) {
  const match = /(?:^|;)\s*boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  return match ? match[1] || match[2] : "";
}

function parsePartHeaders(value) {
  const headers = {};
  for (const line of value.split("\r\n")) {
    const index = line.indexOf(":");
    if (index < 0) continue;
    headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
  }
  return headers;
}

function parseContentDisposition(value) {
  const result = {};
  for (const part of value.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim().toLowerCase();
    let fieldValue = part.slice(index + 1).trim();
    if (fieldValue.startsWith("\"") && fieldValue.endsWith("\"")) {
      fieldValue = fieldValue.slice(1, -1);
    }
    result[key] = fieldValue;
  }
  return result;
}

export function required(value, name) {
  if (value === undefined || value === null || value === "") {
    throw badRequest("PARAM_INVALID", `${name} 不能为空`);
  }
  return value;
}

export function parsePage(searchParams) {
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") || 20)));
  return { page, pageSize };
}

export function paginate(items, page, pageSize) {
  const start = (page - 1) * pageSize;
  return {
    records: items.slice(start, start + pageSize),
    total: items.length
  };
}

export function routeNotFound() {
  throw notFound("接口不存在");
}
