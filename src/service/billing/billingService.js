import crypto from "node:crypto";
import { appConfig } from "../../infrastructure/config/env.js";
import { store } from "../../infrastructure/db/memoryStore.js";
import { nextId, orderNo as newOrderNo } from "../../infrastructure/common/id.js";
import { badGateway, badRequest, conflict, forbidden, notFound } from "../common/errors.js";
import { createChannelPayment } from "../../infrastructure/middleware/paymentClient.js";
import { createLogger, errorFields } from "../../infrastructure/common/logger.js";

const billingLog = createLogger("billing");
const paymentLog = createLogger("payment");
const subscriptionLog = createLogger("subscription");
const pointsLog = createLogger("points");
const PAYMENT_NOTIFY_MARKER = "[PAYMENT_NOTIFY]";

export function plans() {
  return [...store.prices.values()]
    .filter((price) => price.status === "ENABLED")
    .map((price) => {
      const plan = store.plans.get(price.planId);
      if (!plan || plan.status !== "ENABLED") return null;
      return {
        code: price.priceCode,
        name: plan.planName,
        cycle: displayCycle(price),
        cycleUnit: price.cycleUnit,
        cycleCount: price.cycleCount,
        priceFen: price.priceFen,
        originalPriceFen: price.originalPriceFen,
        grantPoints: price.grantPoints,
        benefits: plan.benefits
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.priceFen - b.priceFen);
}

export function createOrder(userId, idempotencyKey, body) {
  if (!idempotencyKey) {
    throw badRequest("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key 不能为空");
  }
  const existing = [...store.orders.values()].find((item) => item.userId === userId && item.idempotencyKey === idempotencyKey);
  if (existing) {
    billingLog.info("order.idempotent_hit", "Order create idempotency hit", {
      userId,
      orderNo: existing.orderNo,
      status: existing.status,
      productCode: existing.productCode,
      amountFen: existing.amountFen
    });
    return toOrderCreateView(existing);
  }
  if (body.orderType !== "PLAN") {
    throw badRequest("ORDER_TYPE_UNSUPPORTED", "一期仅支持套餐订单");
  }
  const price = store.prices.get(body.productCode);
  if (!price || price.status !== "ENABLED") {
    throw notFound("套餐商品不存在或已下架");
  }
  const plan = store.plans.get(price.planId);
  if (!plan || plan.status !== "ENABLED") {
    throw notFound("套餐商品不存在或已下架");
  }
  const t = new Date().toISOString();
  const orderNo = newOrderNo("DN");
  const order = {
    id: nextId(),
    orderNo,
    userId,
    orderType: body.orderType,
    productCode: price.priceCode,
    productName: plan.planName,
    productSnapshot: { plan, price },
    amountFen: price.priceFen,
    currency: "CNY",
    status: "PENDING",
    expireAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    paidAt: null,
    idempotencyKey,
    createdAt: t,
    updatedAt: t
  };
  store.orders.set(orderNo, order);
  billingLog.info("order.created", "Order created", {
    userId,
    orderNo,
    orderType: order.orderType,
    productCode: order.productCode,
    productName: order.productName,
    amountFen: order.amountFen,
    currency: order.currency,
    status: order.status,
    expireAt: order.expireAt
  });
  return toOrderCreateView(order);
}

export async function createPayment(userId, orderNo, body) {
  const order = requireOrder(userId, orderNo);
  if (order.status === "PAID") {
    throw conflict("ORDER_STATUS_INVALID", "订单已支付");
  }
  if (!["WECHAT", "ALIPAY"].includes(body.payType)) {
    throw badRequest("PAY_TYPE_UNSUPPORTED", "仅支持微信支付和支付宝支付");
  }
  paymentLog.info("payment.create_requested", "Payment create requested", {
    userId,
    orderNo,
    payType: body.payType,
    amountFen: order.amountFen,
    currency: order.currency,
    orderStatus: order.status
  });
  order.status = "PAYING";
  order.updatedAt = new Date().toISOString();
  const channelPayment = await safeCreateChannelPayment(order, body.payType);
  const transactionKey = `${orderNo}:${body.payType}`;
  const existingTransaction = store.transactions.get(transactionKey);
  const now = new Date().toISOString();
  const transaction = {
    id: existingTransaction?.id || nextId(),
    transactionNo: existingTransaction?.transactionNo || newOrderNo("PT"),
    orderNo,
    payType: body.payType,
    channelTransactionNo: existingTransaction?.channelTransactionNo || null,
    status: "CREATED",
    qrCodeContent: channelPayment.qrCodeContent,
    redirectUrl: channelPayment.redirectUrl,
    createdAt: existingTransaction?.createdAt || now,
    updatedAt: now
  };
  store.transactions.set(transactionKey, transaction);
  paymentLog.info("payment.channel_created", "Payment channel created", {
    userId,
    orderNo,
    payType: transaction.payType,
    transactionNo: transaction.transactionNo,
    status: transaction.status,
    expireAt: order.expireAt
  });
  return {
    payType: transaction.payType,
    qrCodeContent: transaction.qrCodeContent,
    redirectUrl: transaction.redirectUrl,
    expireAt: order.expireAt
  };
}

export function getOrder(userId, orderNo) {
  return toOrderView(requireOrder(userId, orderNo));
}

export function listOrders(userId, status) {
  return [...store.orders.values()]
    .filter((item) => item.userId === userId)
    .filter((item) => !status || item.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toOrderView);
}

export function completeLocalPayment(userId, orderNo) {
  if (appConfig.profile !== "local" || !appConfig.payment.mockEnabled) {
    throw forbidden();
  }
  const order = requireOrder(userId, orderNo);
  completeOrder(order, `LOCAL-${Date.now()}`);
}

export function notifyPayment(payType, body, headers = {}) {
  paymentLog.info("payment.notify_received", paymentNotifyMessage("Payment notify received"), paymentNotifyFields(payType, {
    payType,
    orderNo: notifyOrderNo(payType, body),
    channelTransactionNo: notifyChannelTransactionNo(payType, body),
    paymentStatus: notifyPaymentStatus(payType, body),
    amountFen: notifyAmountFen(payType, body),
    currency: notifyCurrency(payType, body),
    mockEnabled: appConfig.payment.mockEnabled
  }));
  let payment;
  try {
    payment = parsePaymentNotify(payType, body, headers);
  } catch (error) {
    paymentLog.warn("payment.notify_rejected", paymentNotifyMessage("Payment notify rejected"), paymentNotifyFields(payType, {
      payType,
      orderNo: notifyOrderNo(payType, body),
      channelTransactionNo: notifyChannelTransactionNo(payType, body),
      paymentStatus: notifyPaymentStatus(payType, body),
      ...errorFields(error)
    }));
    throw error;
  }
  paymentLog.info("payment.notify_verified", paymentNotifyMessage("Payment notify verified"), paymentNotifyFields(payType, {
    payType,
    orderNo: payment.orderNo,
    channelTransactionNo: payment.channelTransactionNo || null,
    amountFen: payment.amountFen,
    currency: payment.currency,
    paymentStatus: payment.paymentStatus || null
  }));
  const order = store.orders.get(payment.orderNo);
  if (!order) {
    paymentLog.warn("payment.notify_order_missing", paymentNotifyMessage("Payment notify order missing"), paymentNotifyFields(payType, {
      payType,
      orderNo: payment.orderNo,
      amountFen: payment.amountFen,
      currency: payment.currency
    }));
    throw notFound("订单不存在");
  }
  if (order.amountFen !== payment.amountFen || order.currency !== payment.currency) {
    paymentLog.warn("payment.amount_mismatch", paymentNotifyMessage("Payment notify amount or currency mismatch"), paymentNotifyFields(payType, {
      payType,
      orderNo: payment.orderNo,
      expectedAmountFen: order.amountFen,
      actualAmountFen: payment.amountFen,
      expectedCurrency: order.currency,
      actualCurrency: payment.currency
    }));
    throw conflict("PAYMENT_AMOUNT_MISMATCH", "支付金额或币种不一致");
  }
  const completion = completeOrder(order, payment.channelTransactionNo || `${payType}-${Date.now()}`, paymentNotifyFields(payType, { payType }));
  paymentLog.info("payment.notify_processed", paymentNotifyMessage("Payment notify processed"), paymentNotifyFields(payType, {
    payType,
    orderNo: payment.orderNo,
    channelTransactionNo: payment.channelTransactionNo || null,
    completed: completion.completed,
    idempotent: completion.idempotent,
    updatedTransactionCount: completion.updatedTransactionCount
  }));
  return payType === "ALIPAY" ? "success" : "SUCCESS";
}

export function cancelAutoRenew(userId) {
  const subscription = store.subscriptions.get(userId);
  if (subscription) {
    subscription.autoRenew = false;
    subscription.updatedAt = new Date().toISOString();
  }
}

function completeOrder(order, channelTransactionNo, logMeta = {}) {
  if (order.status === "PAID") {
    billingLog.info(
      "order.complete_idempotent_skip",
      markedMessage(logMeta, "Paid order completion skipped"),
      markedFields(logMeta, {
        userId: order.userId,
        orderNo: order.orderNo,
        channelTransactionNo
      })
    );
    return {
      completed: false,
      idempotent: true,
      updatedTransactionCount: 0
    };
  }
  const t = new Date().toISOString();
  order.status = "PAID";
  order.paidAt = t;
  order.updatedAt = t;
  const price = store.prices.get(order.productCode);
  const plan = store.plans.get(price.planId);
  const expireAt = addCycle(new Date(), price).toISOString();
  store.subscriptions.set(order.userId, {
    planCode: plan.planCode,
    planName: plan.planName,
    priceCode: price.priceCode,
    expireAt,
    autoRenew: false,
    latestOrderNo: order.orderNo
  });
  const account = store.pointAccounts.get(order.userId);
  const balanceBefore = account.availablePoints;
  account.availablePoints += price.grantPoints;
  account.grantedTotal += price.grantPoints;
  account.updatedAt = t;
  const ledgerId = nextId();
  store.pointLedgers.set(ledgerId, {
    id: ledgerId,
    userId: order.userId,
    action: "RECHARGE",
    amount: price.grantPoints,
    balanceAfter: account.availablePoints,
    bizType: "PAYMENT_ORDER",
    bizId: order.orderNo,
    description: `${order.productName}套餐赠送积分`,
    createdAt: t
  });
  let updatedTransactionCount = 0;
  for (const transaction of store.transactions.values()) {
    if (transaction.orderNo === order.orderNo) {
      transaction.status = "SUCCESS";
      transaction.channelTransactionNo = channelTransactionNo;
      transaction.updatedAt = t;
      updatedTransactionCount += 1;
    }
  }
  billingLog.info("order.paid", markedMessage(logMeta, "Order paid"), markedFields(logMeta, {
    userId: order.userId,
    orderNo: order.orderNo,
    amountFen: order.amountFen,
    currency: order.currency,
    channelTransactionNo,
    paidAt: order.paidAt
  }));
  subscriptionLog.info("subscription.activated", markedMessage(logMeta, "Subscription activated"), markedFields(logMeta, {
    userId: order.userId,
    orderNo: order.orderNo,
    planCode: plan.planCode,
    planName: plan.planName,
    priceCode: price.priceCode,
    expireAt
  }));
  pointsLog.info("points.granted", markedMessage(logMeta, "Points granted by paid order"), markedFields(logMeta, {
    userId: order.userId,
    orderNo: order.orderNo,
    planCode: plan.planCode,
    priceCode: price.priceCode,
    grantPoints: price.grantPoints,
    balanceBefore,
    balanceAfter: account.availablePoints,
    ledgerId
  }));
  return {
    completed: true,
    idempotent: false,
    updatedTransactionCount
  };
}

function requireOrder(userId, orderNo) {
  const order = store.orders.get(String(orderNo));
  if (!order) throw notFound("订单不存在");
  if (order.userId !== userId) throw forbidden();
  return order;
}

function toOrderCreateView(order) {
  return {
    orderNo: order.orderNo,
    amountFen: order.amountFen,
    status: order.status,
    expireAt: order.expireAt
  };
}

function toOrderView(order) {
  const transaction = [...store.transactions.values()].find((item) => item.orderNo === order.orderNo);
  return {
    orderNo: order.orderNo,
    orderType: order.orderType,
    productName: order.productName,
    amountFen: order.amountFen,
    payType: transaction?.payType || null,
    status: order.status,
    paidAt: order.paidAt,
    expireAt: order.expireAt,
    createdAt: order.createdAt
  };
}

function addCycle(date, price) {
  const result = new Date(date);
  if (price.cycleUnit === "DAY") result.setDate(result.getDate() + price.cycleCount);
  if (price.cycleUnit === "MONTH") result.setMonth(result.getMonth() + price.cycleCount);
  if (price.cycleUnit === "YEAR") result.setFullYear(result.getFullYear() + price.cycleCount);
  return result;
}

function displayCycle(price) {
  if (price.cycleUnit === "YEAR" && price.cycleCount === 2) return "TWO_YEARS";
  if (price.cycleUnit === "DAY") return `${price.cycleCount}_DAYS`;
  return price.cycleUnit;
}

async function safeCreateChannelPayment(order, payType) {
  try {
    return await createChannelPayment(order, payType);
  } catch (error) {
    paymentLog.error("payment.channel_failed", "Payment channel creation failed", {
      userId: order.userId,
      orderNo: order.orderNo,
      payType,
      ...errorFields(error)
    });
    throw badGateway("PAYMENT_FAILED", "支付创建失败", { reason: error.message });
  }
}

function verifyPaymentNotify(body, headers) {
  if (appConfig.payment.mockEnabled) {
    paymentLog.debug("payment.notify_signature_skipped", paymentNotifyMessage("Payment notify signature skipped in mock mode"), paymentNotifyFields("WECHAT", {
      payType: "WECHAT",
      orderNo: body?.orderNo || null
    }));
    return;
  }
  const signature = headers["x-daone-payment-signature"];
  if (!signature || !appConfig.payment.notifySecret) {
    paymentLog.warn("payment.notify_signature_missing", paymentNotifyMessage("Payment notify signature or secret missing"), paymentNotifyFields("WECHAT", {
      payType: "WECHAT",
      orderNo: body?.orderNo || null,
      hasSignature: Boolean(signature),
      hasNotifySecret: Boolean(appConfig.payment.notifySecret)
    }));
    throw forbidden();
  }
  const expected = paymentNotifySignature(body);
  if (!safeEqual(signature, expected)) {
    paymentLog.warn("payment.notify_signature_mismatch", paymentNotifyMessage("Payment notify signature mismatch"), paymentNotifyFields("WECHAT", {
      payType: "WECHAT",
      orderNo: body?.orderNo || null
    }));
    throw forbidden();
  }
}

function parsePaymentNotify(payType, body, headers) {
  if (payType === "ALIPAY") {
    verifyAlipayNotify(body);
    if (!["TRADE_SUCCESS", "TRADE_FINISHED"].includes(body.trade_status)) {
      paymentLog.warn("payment.notify_status_invalid", paymentNotifyMessage("Alipay notify status is not successful"), paymentNotifyFields(payType, {
        payType,
        orderNo: body.out_trade_no || null,
        channelTransactionNo: body.trade_no || null,
        paymentStatus: body.trade_status || null
      }));
      throw conflict("PAYMENT_STATUS_INVALID", "支付状态未成功");
    }
    return {
      orderNo: body.out_trade_no,
      amountFen: yuanToFen(body.total_amount),
      currency: "CNY",
      channelTransactionNo: body.trade_no,
      paymentStatus: body.trade_status
    };
  }
  if (payType !== "WECHAT") {
    throw badRequest("PAY_TYPE_UNSUPPORTED", "仅支持微信支付和支付宝支付");
  }
  verifyPaymentNotify(body, headers);
  return {
    orderNo: body.orderNo,
    amountFen: Number(body.amountFen),
    currency: body.currency,
    channelTransactionNo: body.channelTransactionNo,
    paymentStatus: body.status || body.tradeState || null
  };
}

function verifyAlipayNotify(body) {
  if (appConfig.payment.mockEnabled) {
    paymentLog.debug("payment.notify_signature_skipped", paymentNotifyMessage("Payment notify signature skipped in mock mode"), paymentNotifyFields("ALIPAY", {
      payType: "ALIPAY",
      orderNo: body?.out_trade_no || null,
      channelTransactionNo: body?.trade_no || null
    }));
    return;
  }
  if (body.app_id !== appConfig.payment.alipay.appId) {
    paymentLog.warn("payment.notify_app_mismatch", paymentNotifyMessage("Alipay notify app id mismatch"), paymentNotifyFields("ALIPAY", {
      payType: "ALIPAY",
      orderNo: body?.out_trade_no || null,
      channelTransactionNo: body?.trade_no || null,
      hasAppId: Boolean(body.app_id),
      expectedAppConfigured: Boolean(appConfig.payment.alipay.appId)
    }));
    throw forbidden();
  }
  const sign = body.sign;
  if (!sign || !appConfig.payment.alipay.publicKey) {
    paymentLog.warn("payment.notify_signature_missing", paymentNotifyMessage("Alipay notify signature or public key missing"), paymentNotifyFields("ALIPAY", {
      payType: "ALIPAY",
      orderNo: body?.out_trade_no || null,
      channelTransactionNo: body?.trade_no || null,
      hasSignature: Boolean(sign),
      hasPublicKey: Boolean(appConfig.payment.alipay.publicKey)
    }));
    throw forbidden();
  }
  const signContent = Object.entries(body)
    .filter(([key, value]) => key !== "sign" && key !== "sign_type" && value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");
  const verified = crypto.verify(
    "RSA-SHA256",
    Buffer.from(signContent),
    appConfig.payment.alipay.publicKey.replace(/\\n/g, "\n"),
    Buffer.from(sign, "base64")
  );
  if (!verified) {
    paymentLog.warn("payment.notify_signature_mismatch", paymentNotifyMessage("Alipay notify signature mismatch"), paymentNotifyFields("ALIPAY", {
      payType: "ALIPAY",
      orderNo: body?.out_trade_no || null,
      channelTransactionNo: body?.trade_no || null
    }));
    throw forbidden();
  }
}

function paymentNotifyFields(payType, fields = {}) {
  return {
    marker: PAYMENT_NOTIFY_MARKER,
    notifySource: `${payType}_PAYMENT_CALLBACK`,
    callbackImportant: true,
    ...fields
  };
}

function paymentNotifyMessage(message) {
  return `${PAYMENT_NOTIFY_MARKER} ${message}`;
}

function markedFields(logMeta, fields) {
  if (!logMeta?.marker) {
    return fields;
  }
  return {
    marker: logMeta.marker,
    notifySource: logMeta.notifySource,
    callbackImportant: logMeta.callbackImportant,
    payType: logMeta.payType,
    ...fields
  };
}

function markedMessage(logMeta, message) {
  return logMeta?.marker ? `${logMeta.marker} ${message}` : message;
}

function notifyOrderNo(payType, body) {
  return payType === "ALIPAY" ? body?.out_trade_no || null : body?.orderNo || null;
}

function notifyChannelTransactionNo(payType, body) {
  return payType === "ALIPAY" ? body?.trade_no || null : body?.channelTransactionNo || null;
}

function notifyPaymentStatus(payType, body) {
  if (payType === "ALIPAY") return body?.trade_status || null;
  return body?.status || body?.tradeState || null;
}

function notifyAmountFen(payType, body) {
  if (payType === "ALIPAY") {
    const amount = Number(body?.total_amount);
    return Number.isFinite(amount) ? Math.round(amount * 100) : null;
  }
  const amount = Number(body?.amountFen);
  return Number.isFinite(amount) ? amount : null;
}

function notifyCurrency(payType, body) {
  return payType === "ALIPAY" ? "CNY" : body?.currency || null;
}

function yuanToFen(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw conflict("PAYMENT_AMOUNT_MISMATCH", "支付金额或币种不一致");
  }
  return Math.round(amount * 100);
}

function paymentNotifySignature(body) {
  const payload = [
    body.orderNo || "",
    body.amountFen ?? "",
    body.currency || "",
    body.channelTransactionNo || ""
  ].join(":");
  return crypto
    .createHmac("sha256", appConfig.payment.notifySecret)
    .update(payload)
    .digest("hex");
}
function safeEqual(actual, expected) {
  const actualBuffer = Buffer.from(String(actual));
  const expectedBuffer = Buffer.from(String(expected));
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}
