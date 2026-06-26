import crypto from "node:crypto";
import { appConfig } from "../../infrastructure/config/env.js";
import { store } from "../../infrastructure/db/memoryStore.js";
import { nextId } from "../../infrastructure/common/id.js";
import { badRequest, forbidden, unauthorized } from "../common/errors.js";
import { cacheDel, cacheGetJson, cacheSetJson, redisCacheEnabled } from "../../infrastructure/middleware/redisCache.js";
import { sendSms } from "../../infrastructure/middleware/smsClient.js";
import { findOrCreatePostgresUser, findPostgresUserByPhone } from "../../infrastructure/middleware/postgresRuntimeStore.js";

export async function sendSmsCode(phone, scene = "LOGIN") {
  const normalizedPhone = normalizePhone(phone);
  const normalizedScene = normalizeScene(scene);
  assertPhone(normalizedPhone);
  const code = appConfig.sms.mockEnabled ? appConfig.auth.localSmsCode : randomSmsCode();
  const payload = {
    code,
    expiresAt: Date.now() + appConfig.auth.smsCodeTtlSeconds * 1000,
    sentAt: Date.now(),
    scene: normalizedScene
  };
  const key = smsKey(normalizedPhone, normalizedScene);
  if (redisCacheEnabled()) {
    await cacheSetJson(key, payload, appConfig.auth.smsCodeTtlSeconds);
  } else {
    store.smsCodes.set(key, payload);
  }
  try {
    await sendSms(normalizedPhone, code, normalizedScene);
  } catch (error) {
    await deleteSmsCode(normalizedPhone, normalizedScene);
    throw error;
  }
  return { retryAfterSeconds: 60 };
}

export async function loginBySms(phone, code) {
  const normalizedPhone = normalizePhone(phone);
  const normalizedCode = normalizeCode(code);
  assertPhone(normalizedPhone);
  await assertSmsCode(normalizedPhone, normalizedCode, "LOGIN");
  const user = await ensureUserByPhone(normalizedPhone, { role: "USER" });
  if (user.status !== "ENABLED") {
    throw badRequest("USER_DISABLED", "账号已被禁用");
  }
  return createLoginSession(user);
}

export async function sendAdminSmsCode(phone, scene = "ADMIN_LOGIN") {
  const normalizedPhone = normalizePhone(phone);
  assertPhone(normalizedPhone);
  await assertAdminPhone(normalizedPhone);
  return sendSmsCode(normalizedPhone, normalizeAdminScene(scene));
}

export async function loginAdminBySms(phone, code) {
  const normalizedPhone = normalizePhone(phone);
  const normalizedCode = normalizeCode(code);
  assertPhone(normalizedPhone);
  await assertAdminPhone(normalizedPhone);
  await assertSmsCode(normalizedPhone, normalizedCode, "ADMIN_LOGIN");
  const user = await ensureUserByPhone(normalizedPhone, { role: "ADMIN" });
  if (user.status !== "ENABLED") {
    throw badRequest("USER_DISABLED", "账号已被禁用");
  }
  return createLoginSession(user, true);
}

async function createLoginSession(user, includeAdminFields = false) {
  const token = `dn_${crypto.randomUUID().replaceAll("-", "")}`;
  const session = {
    userId: user.id,
    expiresAt: Date.now() + appConfig.auth.tokenTtlSeconds * 1000
  };
  if (redisCacheEnabled()) {
    await cacheSetJson(tokenKey(token), session, appConfig.auth.tokenTtlSeconds);
  } else {
    store.tokens.set(token, session);
  }
  return {
    token,
    accessToken: token,
    refreshToken: token,
    expires: new Date(session.expiresAt).toISOString(),
    expiresInSeconds: appConfig.auth.tokenTtlSeconds,
    user: includeAdminFields ? toAdminLoginUser(user) : toLoginUser(user)
  };
}

export async function logout(token) {
  if (redisCacheEnabled()) {
    await cacheDel(tokenKey(token));
  } else {
    store.tokens.delete(token);
  }
}

export async function resolveUser(token) {
  const session = redisCacheEnabled() ? await cacheGetJson(tokenKey(token)) : store.tokens.get(token);
  if (!session || session.expiresAt < Date.now()) {
    throw unauthorized();
  }
  const user = store.users.get(session.userId);
  if (!user || user.status !== "ENABLED") {
    throw unauthorized();
  }
  return user;
}

export function createQrSession() {
  const ticket = `qr_${crypto.randomUUID().replaceAll("-", "")}`;
  const expiresAt = new Date(Date.now() + 300 * 1000).toISOString();
  const authorizeUrl = `${appConfig.frontendBaseUrl}/wechat-login?ticket=${ticket}`;
  return {
    ticket,
    authorizeUrl,
    qrCodeUrl: authorizeUrl,
    expiresAt,
    expiresInSeconds: 300
  };
}

export function getQrStatus(ticket) {
  return { ticket, status: "WAITING" };
}

export async function verifySmsCode(phone, code, scene) {
  const normalizedPhone = normalizePhone(phone);
  const normalizedCode = normalizeCode(code);
  const normalizedScene = normalizeScene(scene);
  assertPhone(normalizedPhone);
  await assertSmsCode(normalizedPhone, normalizedCode, normalizedScene);
}

async function assertSmsCode(phone, normalizedCode, scene) {
  const cached = await getSmsCode(phone, scene);
  if (!cached || cached.expiresAt < Date.now() || cached.code !== normalizedCode) {
    throw badRequest("SMS_CODE_INVALID", "验证码错误或已过期");
  }
  await deleteSmsCode(phone, scene);
}

export async function ensureUserByPhone(phone, defaults = {}) {
  const normalizedPhone = normalizePhone(phone);
  assertPhone(normalizedPhone);
  const requestedRole = defaults.role || (adminPhones().includes(normalizedPhone) ? "ADMIN" : "USER");
  const persisted = await findOrCreatePostgresUser({
    phone: normalizedPhone,
    nickname: defaults.nickname || `Daone${normalizedPhone.slice(-4)}`,
    role: requestedRole
  });
  if (persisted) {
    store.users.set(persisted.user.id, persisted.user);
    store.pointAccounts.set(
      persisted.user.id,
      persisted.pointAccount || newPointAccount(persisted.user.id, persisted.user.createdAt)
    );
    return persisted.user;
  }
  let user = [...store.users.values()].find((item) => item.phone === normalizedPhone);
  if (user) {
    user.role = mergeRole(user.role, requestedRole);
    return user;
  }
  const id = nextId();
  const t = new Date().toISOString();
  user = {
    id,
    phone: normalizedPhone,
    nickname: defaults.nickname || `Daone${normalizedPhone.slice(-4)}`,
    avatarUrl: null,
    email: null,
    gender: "UNKNOWN",
    birthday: null,
    status: "ENABLED",
    role: requestedRole,
    createdAt: t,
    updatedAt: t
  };
  store.users.set(id, user);
  store.pointAccounts.set(id, newPointAccount(id, t));
  return user;
}

function newPointAccount(userId, updatedAt) {
  return {
    userId,
    availablePoints: 100,
    frozenPoints: 0,
    grantedTotal: 100,
    version: 0,
    updatedAt
  };
}

function toLoginUser(user) {
  return {
    id: user.id,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl
  };
}

function toAdminLoginUser(user) {
  return {
    ...toLoginUser(user),
    phone: user.phone,
    role: user.role
  };
}

function assertPhone(phone) {
  if (!/^1\d{10}$/.test(phone || "")) {
    throw badRequest("PARAM_INVALID", "手机号格式不正确");
  }
}

function normalizePhone(phone) {
  return String(phone || "").trim();
}

function normalizeCode(code) {
  return String(code || "").trim();
}

function normalizeScene(scene = "LOGIN") {
  const value = String(scene || "LOGIN").trim().toUpperCase().replace(/[-\s]/g, "_");
  if (["1", "LOGIN", "SMS_LOGIN", "AUTH_LOGIN", "REGISTER", "REGISTRATION", "SIGNUP", "SIGN_UP"].includes(value)) return "LOGIN";
  if (["2", "TRIAL", "TRIAL_APPLICATION"].includes(value)) return "TRIAL";
  return value;
}

function normalizeAdminScene(scene = "ADMIN_LOGIN") {
  const value = normalizeScene(scene);
  if (["LOGIN", "ADMIN_LOGIN", "ADMIN_SMS_LOGIN"].includes(value)) {
    return "ADMIN_LOGIN";
  }
  throw badRequest("PARAM_INVALID", "管理后台验证码场景仅支持登录");
}

async function assertAdminPhone(phone) {
  if (adminPhones().includes(phone)) {
    return;
  }
  const persisted = await findPostgresUserByPhone(phone);
  if (persisted?.status === "ENABLED" && hasRole(persisted.role, "ADMIN")) {
    store.users.set(persisted.id, persisted);
    return;
  }
  const localUser = [...store.users.values()].find((item) => item.phone === phone);
  if (localUser?.status === "ENABLED" && hasRole(localUser.role, "ADMIN")) {
    return;
  }
  throw forbidden();
}

function mergeRole(currentRole, role) {
  const roles = roleList(currentRole);
  const nextRole = String(role || "").trim().toUpperCase();
  if (nextRole && !roles.includes(nextRole)) {
    roles.push(nextRole);
  }
  return roles.length ? roles.join(",") : "USER";
}

function hasRole(currentRole, role) {
  return roleList(currentRole).includes(String(role || "").trim().toUpperCase());
}

function roleList(currentRole) {
  return String(currentRole || "USER")
    .split(/[,\s]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function adminPhones() {
  return appConfig.auth.adminPhones;
}

async function getSmsCode(phone, scene) {
  if (redisCacheEnabled()) {
    return cacheGetJson(smsKey(phone, scene));
  }
  return store.smsCodes.get(smsKey(phone, scene));
}

async function deleteSmsCode(phone, scene) {
  if (redisCacheEnabled()) {
    await cacheDel(smsKey(phone, scene));
  } else {
    store.smsCodes.delete(smsKey(phone, scene));
  }
}

function smsKey(phone, scene) {
  return `sms:${scene}:${phone}`;
}

function tokenKey(token) {
  return `token:${token}`;
}

function randomSmsCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
