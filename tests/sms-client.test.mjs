import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

process.env.DAONE_PROFILE = "local";

const { appConfig } = await import("../src/infrastructure/config/env.js");
const { sendSms } = await import("../src/infrastructure/middleware/smsClient.js");

describe("Aliyun SMS client", () => {
  it("uses SMS-specific region and endpoint instead of content safety region", async () => {
    const originalFetch = globalThis.fetch;
    const originalSms = { ...appConfig.sms };
    const originalAliyun = { ...appConfig.aliyun };
    const originalContentSafety = { ...appConfig.contentSafety };
    let requestUrl;

    try {
      appConfig.sms.mockEnabled = false;
      appConfig.sms.regionId = "cn-hangzhou";
      appConfig.sms.endpoint = "dysmsapi.aliyuncs.com";
      appConfig.sms.signName = "Daone";
      appConfig.sms.templateCode = "SMS_TEST";
      appConfig.aliyun.accessKeyId = "ak-test";
      appConfig.aliyun.accessKeySecret = "sk-test";
      appConfig.contentSafety.regionId = "cn-shanghai";

      globalThis.fetch = async (url) => {
        requestUrl = String(url);
        return new Response(JSON.stringify({
          Code: "OK",
          Message: "OK",
          RequestId: "request-1",
          BizId: "biz-1"
        }), { status: 200 });
      };

      const result = await sendSms("13800138000", "123456", "LOGIN");
      assert.equal(result.Code, "OK");

      const url = new URL(requestUrl);
      assert.equal(url.hostname, "dysmsapi.aliyuncs.com");
      assert.equal(url.searchParams.get("RegionId"), "cn-hangzhou");
      assert.equal(url.searchParams.get("SignName"), "Daone");
      assert.equal(url.searchParams.get("TemplateCode"), "SMS_TEST");
      assert.deepEqual(JSON.parse(url.searchParams.get("TemplateParam")), {
        code: "123456",
        scene: "LOGIN"
      });
      assert.ok(url.searchParams.get("Signature"));
    } finally {
      globalThis.fetch = originalFetch;
      appConfig.sms = originalSms;
      appConfig.aliyun = originalAliyun;
      appConfig.contentSafety = originalContentSafety;
    }
  });

  it("accepts Alibaba Cloud credential environment variable aliases", () => {
    const child = spawnSync(process.execPath, [
      "--input-type=module",
      "-e",
      [
        "const { appConfig, configHealth } = await import('./src/infrastructure/config/env.js');",
        "console.log(JSON.stringify({ accessKeyId: appConfig.aliyun.accessKeyId, accessKeySecret: appConfig.aliyun.accessKeySecret, missingRequired: configHealth().missingRequired }));"
      ].join("")
    ], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DAONE_PROFILE: "test",
        ALIYUN_ACCESS_KEY_ID: "",
        ALIYUN_ACCESS_KEY_SECRET: "",
        ALIBABA_CLOUD_ACCESS_KEY_ID: "ak-alias",
        ALIBABA_CLOUD_ACCESS_KEY_SECRET: "sk-alias",
        SMS_SIGN_NAME: "Daone",
        SMS_TEMPLATE_CODE: "SMS_TEST",
        DAONE_SMS_MOCK_ENABLED: "false",
        DAONE_STORAGE_MOCK_ENABLED: "true",
        DAONE_MODEL_MOCK_ENABLED: "true",
        DAONE_CONTENT_SAFETY_MOCK_ENABLED: "true",
        DAONE_PAYMENT_MOCK_ENABLED: "true",
        DAONE_AUTH_CACHE_TYPE: "memory",
        REDIS_ENABLED: "false"
      },
      encoding: "utf8"
    });

    assert.equal(child.status, 0, child.stderr);
    const output = JSON.parse(child.stdout.trim());
    assert.equal(output.accessKeyId, "ak-alias");
    assert.equal(output.accessKeySecret, "sk-alias");
    assert.equal(output.missingRequired.includes("ALIYUN_ACCESS_KEY_ID or ALIBABA_CLOUD_ACCESS_KEY_ID or ALICLOUD_ACCESS_KEY_ID"), false);
    assert.equal(output.missingRequired.includes("ALIYUN_ACCESS_KEY_SECRET or ALIBABA_CLOUD_ACCESS_KEY_SECRET or ALICLOUD_ACCESS_KEY_SECRET"), false);
  });
});
