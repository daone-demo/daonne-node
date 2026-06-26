import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createLogger, withLogContext } from "../src/infrastructure/common/logger.js";

describe("structured logger", () => {
  it("writes JSON logs with context", async () => {
    const lines = await captureLogs(async () => {
      await withLogContext({ traceId: "trace-1", method: "POST", path: "/api/v1/orders", userId: "u1" }, async () => {
        createLogger("billing").info("order.created", "Order created", {
          orderNo: "DN1",
          amountFen: 9900
        });
      });
    });

    assert.equal(lines.stdout.length, 1);
    const entry = JSON.parse(lines.stdout[0]);
    assert.equal(entry.level, "info");
    assert.equal(entry.category, "billing");
    assert.equal(entry.event, "order.created");
    assert.equal(entry.traceId, "trace-1");
    assert.equal(entry.method, "POST");
    assert.equal(entry.path, "/api/v1/orders");
    assert.equal(entry.userId, "u1");
    assert.equal(entry.orderNo, "DN1");
    assert.equal(entry.amountFen, 9900);
    assert.match(entry.time, /^\d{4}-\d{2}-\d{2}T/);
  });

  it("filters by DAONE_LOG_LEVEL", async () => {
    const originalLevel = process.env.DAONE_LOG_LEVEL;
    try {
      process.env.DAONE_LOG_LEVEL = "warn";
      const lines = await captureLogs(async () => {
        const log = createLogger("request");
        log.info("request.completed", "Request completed");
        log.warn("request.slow", "Request is slow");
      });

      assert.equal(lines.stdout.length, 0);
      assert.equal(lines.stderr.length, 1);
      assert.equal(JSON.parse(lines.stderr[0]).level, "warn");
    } finally {
      restoreEnv("DAONE_LOG_LEVEL", originalLevel);
    }
  });

  it("redacts sensitive fields", async () => {
    const lines = await captureLogs(async () => {
      createLogger("payment").info("payment.created", "Payment created", {
        authorization: "Bearer secret",
        nested: {
          apiKey: "key",
          privateKey: "private",
          sign: "signature",
          qrCodeContent: "weixin://pay",
          redirectUrl: "https://pay.example.com"
        },
        code: "PAYMENT_FAILED",
        productCode: "TEAM_MONTH"
      });
    });

    const entry = JSON.parse(lines.stdout[0]);
    assert.equal(entry.authorization, "[REDACTED]");
    assert.equal(entry.nested.apiKey, "[REDACTED]");
    assert.equal(entry.nested.privateKey, "[REDACTED]");
    assert.equal(entry.nested.sign, "[REDACTED]");
    assert.equal(entry.nested.qrCodeContent, "[REDACTED]");
    assert.equal(entry.nested.redirectUrl, "[REDACTED]");
    assert.equal(entry.code, "PAYMENT_FAILED");
    assert.equal(entry.productCode, "TEAM_MONTH");
  });
});

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

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
