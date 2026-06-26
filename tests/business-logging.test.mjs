import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.DAONE_PROFILE = "local";

const { appConfig } = await import("../src/infrastructure/config/env.js");
const { exportStoreSnapshot, importStoreSnapshot, store } = await import("../src/infrastructure/db/memoryStore.js");
const billingService = await import("../src/service/billing/billingService.js");
const aiService = await import("../src/service/creation/aiService.js");
const { withLogContext } = await import("../src/infrastructure/common/logger.js");

describe("business logging", () => {
  it("logs order payment, subscription activation, and granted points", async () => {
    await withStoreSnapshot(async () => {
      appConfig.profile = "local";
      appConfig.payment.mockEnabled = true;
      seedUser("log-billing-user", 20);

      const lines = await captureLogs(async () => {
        await withLogContext({ traceId: "billing-trace" }, async () => {
          const order = billingService.createOrder("log-billing-user", "log-order-1", {
            orderType: "PLAN",
            productCode: "TEAM_MONTH"
          });
          await billingService.createPayment("log-billing-user", order.orderNo, { payType: "WECHAT" });
          billingService.completeLocalPayment("log-billing-user", order.orderNo);
        });
      });

      const entries = parseEntries(lines);
      assert.ok(findEvent(entries, "order.created"));
      assert.ok(findEvent(entries, "payment.create_requested"));
      assert.ok(findEvent(entries, "payment.channel_created"));
      assert.ok(findEvent(entries, "order.paid"));

      const subscription = findEvent(entries, "subscription.activated");
      assert.equal(subscription.userId, "log-billing-user");
      assert.equal(subscription.planCode, "TEAM");
      assert.equal(subscription.priceCode, "TEAM_MONTH");
      assert.ok(subscription.expireAt);

      const granted = findEvent(entries, "points.granted");
      assert.equal(granted.grantPoints, 1000);
      assert.equal(granted.balanceBefore, 20);
      assert.equal(granted.balanceAfter, 1020);
      assert.ok(granted.ledgerId);
    });
  });

  it("logs AI point consumption", async () => {
    await withStoreSnapshot(async () => {
      appConfig.model.mockEnabled = true;
      seedUser("log-ai-user", 10);

      const lines = await captureLogs(async () => {
        await withLogContext({ traceId: "ai-trace" }, async () => {
          await aiService.createTask("log-ai-user", "log-task-1", {
            capabilityCode: "TEXT_COPY_V1",
            prompt: "写一段商品文案",
            parameters: {}
          });
        });
      });

      const entries = parseEntries(lines);
      const created = findEvent(entries, "generation_task.created");
      assert.equal(created.userId, "log-ai-user");
      assert.equal(created.capabilityCode, "TEXT_COPY_V1");
      assert.equal(created.estimatedPoints, 5);

      const consumed = findEvent(entries, "points.consumed");
      assert.equal(consumed.userId, "log-ai-user");
      assert.equal(consumed.capabilityCode, "TEXT_COPY_V1");
      assert.equal(consumed.estimatedPoints, 5);
      assert.equal(consumed.balanceBefore, 10);
      assert.equal(consumed.balanceAfter, 5);
      assert.ok(consumed.ledgerId);
    });
  });

  it("logs insufficient points as warn", async () => {
    await withStoreSnapshot(async () => {
      seedUser("log-poor-user", 0);

      const lines = await captureLogs(async () => {
        await assert.rejects(
          () => aiService.createTask("log-poor-user", "log-task-poor", {
            capabilityCode: "TEXT_COPY_V1",
            prompt: "写一段商品文案",
            parameters: {}
          }),
          (error) => error.code === "POINTS_NOT_ENOUGH"
        );
      });

      const entries = parseEntries(lines);
      const warning = findEvent(entries, "points.not_enough");
      assert.equal(warning.level, "warn");
      assert.equal(warning.userId, "log-poor-user");
      assert.equal(warning.availablePoints, 0);
      assert.equal(warning.estimatedPoints, 5);
    });
  });
});

async function withStoreSnapshot(callback) {
  const snapshot = exportStoreSnapshot();
  const originalProfile = appConfig.profile;
  const originalPaymentMock = appConfig.payment.mockEnabled;
  const originalModelMock = appConfig.model.mockEnabled;
  try {
    await callback();
  } finally {
    appConfig.profile = originalProfile;
    appConfig.payment.mockEnabled = originalPaymentMock;
    appConfig.model.mockEnabled = originalModelMock;
    importStoreSnapshot(snapshot);
  }
}

function seedUser(userId, availablePoints) {
  const t = new Date().toISOString();
  store.users.set(userId, {
    id: userId,
    phone: `139${String(Math.floor(Math.random() * 100000000)).padStart(8, "0")}`,
    nickname: userId,
    status: "ENABLED",
    role: "USER",
    createdAt: t,
    updatedAt: t
  });
  store.pointAccounts.set(userId, {
    userId,
    availablePoints,
    frozenPoints: 0,
    grantedTotal: availablePoints,
    updatedAt: t
  });
}

async function captureLogs(callback) {
  const stdout = [];
  const stderr = [];
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  process.stdout.write = (chunk, ...args) => {
    stdout.push(String(chunk).trimEnd());
    const cb = args.find((item) => typeof item === "function");
    if (cb) cb();
    return true;
  };
  process.stderr.write = (chunk, ...args) => {
    stderr.push(String(chunk).trimEnd());
    const cb = args.find((item) => typeof item === "function");
    if (cb) cb();
    return true;
  };
  try {
    await callback();
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
  return {
    stdout: stdout.filter(Boolean),
    stderr: stderr.filter(Boolean)
  };
}

function parseEntries(lines) {
  return [...lines.stdout, ...lines.stderr].map((line) => JSON.parse(line));
}

function findEvent(entries, event) {
  return entries.find((entry) => entry.event === event);
}
