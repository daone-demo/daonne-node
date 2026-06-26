import { AsyncLocalStorage } from "node:async_hooks";

const contextStorage = new AsyncLocalStorage();
const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};
const REDACTED = "[REDACTED]";
const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "token",
  "accesstoken",
  "refreshtoken",
  "password",
  "secret",
  "apikey",
  "privatekey",
  "signature",
  "sign",
  "qrcodecontent",
  "redirecturl",
  "smscode",
  "verificationcode"
]);

export function withLogContext(context, handler) {
  return contextStorage.run({ ...context }, handler);
}

export function updateLogContext(context) {
  const current = contextStorage.getStore();
  if (!current) return;
  Object.assign(current, context);
}

export function getLogContext() {
  return contextStorage.getStore() || {};
}

export function createLogger(category) {
  return {
    debug: (event, message, fields) => writeLog("debug", category, event, message, fields),
    info: (event, message, fields) => writeLog("info", category, event, message, fields),
    warn: (event, message, fields) => writeLog("warn", category, event, message, fields),
    error: (event, message, fields) => writeLog("error", category, event, message, fields)
  };
}

export const logger = {
  debug: (category, event, message, fields) => writeLog("debug", category, event, message, fields),
  info: (category, event, message, fields) => writeLog("info", category, event, message, fields),
  warn: (category, event, message, fields) => writeLog("warn", category, event, message, fields),
  error: (category, event, message, fields) => writeLog("error", category, event, message, fields)
};

export function errorFields(error) {
  if (!error) return {};
  return {
    errorName: error.name,
    errorMessage: error.message,
    errorStack: error.stack,
    errorCode: error.code,
    errorStatus: error.status,
    errorData: error.data
  };
}

function writeLog(level, category, event, message, fields = {}) {
  const normalizedLevel = normalizeLevel(level);
  if (!shouldLog(normalizedLevel)) return;
  const entry = sanitize({
    ...getLogContext(),
    ...fields,
    time: new Date().toISOString(),
    level: normalizedLevel,
    category,
    event,
    message
  });
  const line = `${JSON.stringify(entry)}\n`;
  if (normalizedLevel === "error" || normalizedLevel === "warn") {
    process.stderr.write(line);
    return;
  }
  process.stdout.write(line);
}

function shouldLog(level) {
  const configured = normalizeLevel(process.env.DAONE_LOG_LEVEL || "info");
  return LEVELS[level] >= LEVELS[configured];
}

function normalizeLevel(level) {
  const key = String(level || "").toLowerCase();
  return LEVELS[key] ? key : "info";
}

function sanitize(value, seen = new WeakSet()) {
  if (value instanceof Error) {
    return sanitize(errorFields(value), seen);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, seen));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (isSensitiveKey(key)) {
      result[key] = REDACTED;
    } else {
      result[key] = sanitize(item, seen);
    }
  }
  seen.delete(value);
  return result;
}

function isSensitiveKey(key) {
  const normalized = String(key || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (SENSITIVE_KEYS.has(normalized)) return true;
  return normalized.endsWith("token")
    || normalized.endsWith("secret")
    || normalized.endsWith("apikey")
    || normalized.endsWith("privatekey");
}
