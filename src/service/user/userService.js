import { store } from "../../infrastructure/db/memoryStore.js";
import { findPostgresUserById, updatePostgresUserProfile } from "../../infrastructure/middleware/postgresRuntimeStore.js";
import { badRequest, forbidden, notFound } from "../common/errors.js";

export async function getProfile(userId) {
  const user = await loadProfileUser(userId);
  if (!user) {
    throw notFound("用户不存在");
  }
  syncStoreUser(user);
  return profileView(user);
}

export async function updateProfile(userId, body) {
  let user = await loadProfileUser(userId);
  if (!user) {
    throw notFound("用户不存在");
  }
  syncStoreUser(user);
  const fields = {};
  if (body.nickname !== undefined) fields.nickname = body.nickname;
  if (body.email !== undefined) fields.email = normalizeEmail(body.email);
  if (body.gender !== undefined) fields.gender = body.gender;
  if (body.birthday !== undefined) fields.birthday = body.birthday;
  if (body.avatarAssetId !== undefined && body.avatarAssetId !== null) {
    const asset = store.assets.get(String(body.avatarAssetId));
    if (!asset || asset.userId !== userId) {
      throw forbidden();
    }
    fields.avatarUrl = asset.previewUrl;
  } else if (body.avatarUrl !== undefined) {
    fields.avatarUrl = normalizeAvatarUrl(body.avatarUrl);
  }

  const persisted = await updatePostgresUserProfile(userId, fields);
  if (persisted) {
    syncStoreUser(persisted);
    return profileView(persisted);
  }

  const t = new Date().toISOString();
  user = store.users.get(userId);
  Object.assign(user, fields, { updatedAt: t });
  return profileView(user);
}

async function loadProfileUser(userId) {
  return (await findPostgresUserById(userId)) || store.users.get(userId) || null;
}

function syncStoreUser(user) {
  const existing = store.users.get(user.id) || {};
  store.users.set(user.id, { ...existing, ...user });
}

function profileView(user) {
  const points = store.pointAccounts.get(user.id) || { availablePoints: 0, frozenPoints: 0, grantedTotal: 0 };
  const subscription = store.subscriptions.get(user.id) || null;
  const vipName = resolveVipName(subscription);
  return {
    id: user.id,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    phoneMasked: maskPhone(user.phone),
    email: user.email,
    gender: user.gender,
    birthday: user.birthday,
    vipName,
    subscription,
    points: {
      available: points.availablePoints,
      frozen: points.frozenPoints,
      grantedTotal: points.grantedTotal
    }
  };
}

export function pointAccount(userId) {
  const account = store.pointAccounts.get(userId);
  if (!account) {
    throw notFound("积分账户不存在");
  }
  return {
    available: account.availablePoints,
    frozen: account.frozenPoints,
    grantedTotal: account.grantedTotal
  };
}

export function pointLedger(userId, direction) {
  let items = [...store.pointLedgers.values()].filter((item) => item.userId === userId);
  if (direction === "INCREASE") items = items.filter((item) => item.amount > 0);
  if (direction === "DECREASE") items = items.filter((item) => item.amount < 0);
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function pointLedgerDetail(userId, ledgerId) {
  const ledger = store.pointLedgers.get(String(ledgerId));
  if (!ledger) {
    throw notFound("积分流水不存在");
  }
  if (ledger.userId !== userId) {
    throw forbidden();
  }
  return { ledger };
}

function maskPhone(phone) {
  if (!phone || phone.length < 7) {
    return phone;
  }
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function normalizeEmail(value) {
  if (value === null || value === "") {
    return null;
  }
  const email = String(value).trim();
  if (!email) {
    return null;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw badRequest("PARAM_INVALID", "邮箱格式不正确");
  }
  return email;
}

function normalizeAvatarUrl(value) {
  if (value === null || value === "") {
    return null;
  }
  const avatarUrl = String(value).trim();
  if (!avatarUrl) {
    return null;
  }
  return avatarUrl;
}

function resolveVipName(subscription) {
  if (!subscription) {
    return null;
  }
  const plan = [...store.plans.values()].find((item) => item.planCode === subscription.planCode && !item.deleted);
  return plan?.planName || subscription.planName || null;
}
