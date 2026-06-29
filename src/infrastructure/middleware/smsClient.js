import crypto from "node:crypto";
import { appConfig } from "../config/env.js";
import { createLogger } from "../common/logger.js";
import { badGateway } from "../../service/common/errors.js";

const smsProviderLog = createLogger("sms_provider");

export async function sendSms(phone, code, scene = "LOGIN") {
  const accessKeyId = appConfig.aliyun.accessKeyId.trim();
  const accessKeySecret = appConfig.aliyun.accessKeySecret.trim();
  const signName = appConfig.sms.signName.trim();
  const templateCode = appConfig.sms.templateCode.trim();
  if (appConfig.sms.mockEnabled) {
    logSmsProvider("sms_provider_mock_send", {
      phone: maskPhone(phone),
      scene
    });
    return { mock: true, code };
  }
  logSmsProvider("sms_provider_aliyun_send_start", {
    phone: maskPhone(phone),
    scene,
    regionId: appConfig.contentSafety.regionId || "cn-shanghai",
    hasAccessKeyId: Boolean(accessKeyId),
    hasAccessKeySecret: Boolean(accessKeySecret),
    hasSignName: Boolean(signName),
    hasTemplateCode: Boolean(templateCode),
    signNameLength: signName.length,
    templateCode: templateCode || null
  });
  assertSmsProviderConfigured({ accessKeyId, accessKeySecret, signName, templateCode });
  const params = {
    AccessKeyId: accessKeyId,
    Action: "SendSms",
    Format: "JSON",
    PhoneNumbers: phone,
    RegionId: appConfig.contentSafety.regionId || "cn-shanghai",
    SignName: signName,
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: "1.0",
    TemplateCode: templateCode,
    TemplateParam: JSON.stringify({ code, scene }),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: "2017-05-25"
  };
  const canonical = canonicalQuery(params);
  const stringToSign = `GET&%2F&${percentEncode(canonical)}`;
  const signature = crypto
    .createHmac("sha1", `${accessKeySecret}&`)
    .update(stringToSign)
    .digest("base64");
  const url = `https://dysmsapi.aliyuncs.com/?${canonical}&Signature=${percentEncode(signature)}`;
  let response;
  let result;
  try {
    response = await fetch(url);
    result = await response.json();
  } catch (error) {
    logSmsProvider("sms_provider_aliyun_network_error", {
      phone: maskPhone(phone),
      scene,
      errorName: error.name,
      errorMessage: error.message
    }, "error");
    throw badGateway("SMS_PROVIDER_NETWORK_ERROR", "短信服务网络异常", {
      reason: error.message
    });
  }
  logSmsProvider("sms_provider_aliyun_response", {
    phone: maskPhone(phone),
    scene,
    httpStatus: response.status,
    aliyunCode: result.Code,
    aliyunMessage: result.Message,
    aliyunRequestId: result.RequestId,
    aliyunBizId: result.BizId
  }, response.ok && result.Code === "OK" ? "info" : "error");
  if (!response.ok || result.Code !== "OK") {
    throw badGateway("SMS_PROVIDER_ERROR", "短信服务发送失败", {
      status: response.status,
      providerCode: result.Code,
      providerMessage: result.Message,
      providerRequestId: result.RequestId
    });
  }
  return result;
}

function assertSmsProviderConfigured({ accessKeyId, accessKeySecret, signName, templateCode }) {
  const missing = [];
  if (!accessKeyId) missing.push("ALIYUN_ACCESS_KEY_ID");
  if (!accessKeySecret) missing.push("ALIYUN_ACCESS_KEY_SECRET");
  if (!signName) missing.push("SMS_SIGN_NAME");
  if (!templateCode) missing.push("SMS_TEMPLATE_CODE");
  if (missing.length) {
    throw badGateway("SMS_PROVIDER_NOT_CONFIGURED", "短信服务未配置完整", { missing });
  }
}

function canonicalQuery(params) {
  return Object.entries(params)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
    .join("&");
}

function percentEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
}

function maskPhone(phone) {
  return String(phone || "").replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
}

function logSmsProvider(event, fields, level = "info") {
  const method = ["debug", "info", "warn", "error"].includes(level) ? level : "info";
  smsProviderLog[method](event, "SMS provider event", fields);
}
