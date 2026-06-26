import crypto from "node:crypto";
import { AppError } from "./errors.js";
import { createLogger, errorFields } from "../../infrastructure/common/logger.js";

const log = createLogger("error");

export function success(data = null) {
  return {
    code: "OK",
    message: "success",
    data
  };
}

export function pageResponse(records, page, pageSize, total) {
  return {
    records,
    page,
    pageSize,
    total,
    pages: pageSize <= 0 ? 0 : Math.ceil(total / pageSize)
  };
}

export function traceId() {
  return crypto.randomUUID().replaceAll("-", "");
}

export function sendJson(res, status, payload, trace) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("x-trace-id", trace);
  res.end(JSON.stringify({ ...payload, traceId: trace }));
}

export function sendNoContent(res, trace) {
  res.statusCode = 204;
  res.setHeader("x-trace-id", trace);
  res.end();
}

export function sendError(res, error, trace) {
  if (error instanceof AppError) {
    logAppError(error, trace);
    sendJson(res, error.status, {
      code: error.code,
      message: error.message,
      data: error.data
    }, trace);
    return;
  }
  log.error("error.handled", "Unhandled request error", {
    traceId: trace,
    ...errorFields(error)
  });
  sendJson(res, 500, {
    code: "INTERNAL_ERROR",
    message: "服务器内部错误"
  }, trace);
}

function logAppError(error, trace) {
  const fields = {
    traceId: trace,
    status: error.status,
    code: error.code,
    errorMessage: error.message,
    data: error.data
  };
  if (error.status >= 500) {
    log.error("error.handled", "Request failed with application error", {
      ...fields,
      errorStack: error.stack
    });
    return;
  }
  if (error.status === 404) {
    log.debug("error.handled", "Request failed with not found", fields);
    return;
  }
  log.warn("error.handled", "Request failed with application error", fields);
}
