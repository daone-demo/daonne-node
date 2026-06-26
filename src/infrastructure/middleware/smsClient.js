import crypto from "node:crypto";
import { appConfig } from "../config/env.js";
import { createLogger } from "../common/logger.js";

const smsProviderLog = createLogger("sms_provider");

export async function sendSms(phone, code, scene = "LOGIN") {
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
    hasAccessKeyId: Boolean(appConfig.aliyun.accessKeyId),
    hasAccessKeySecret: Boolean(appConfig.aliyun.accessKeySecret),
    hasSignName: Boolean(appConfig.sms.signName),
    hasTemplateCode: Boolean(appConfig.sms.templateCode),
    signNameLength: appConfig.sms.signName.length,
    templateCode: appConfig.sms.templateCode || null
  });
  const params = {
    AccessKeyId: appConfig.aliyun.accessKeyId,
    Action: "SendSms",
    Format: "JSON",
    PhoneNumbers: phone,
    RegionId: appConfig.contentSafety.regionId || "cn-shanghai",
    SignName: appConfig.sms.signName,
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: "1.0",
    TemplateCode: appConfig.sms.templateCode,
    TemplateParam: JSON.stringify({ code, scene }),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: "2017-05-25"
  };
  const canonical = canonicalQuery(params);
  const stringToSign = `GET&%2F&${percentEncode(canonical)}`;
  const signature = crypto
    .createHmac("sha1", `${appConfig.aliyun.accessKeySecret}&`)
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
    throw error;
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
    const error = new Error(`Aliyun SMS failed: ${result.Code || response.status}`);
    error.providerCode = result.Code;
    error.providerMessage = result.Message;
    error.providerRequestId = result.RequestId;
    throw error;
  }
  return result;
}

function canonicalQuery(params) {
  return Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
    .join("&");
}

function percentEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/\+/g, "%20")
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
