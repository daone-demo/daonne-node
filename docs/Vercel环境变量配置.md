# Vercel 环境变量配置

本文记录部署到 Vercel 时需要在 Project Settings -> Environment Variables 中配置的变量。

## 短信验证码必填

如果验证码发送给中国大陆手机号，使用国内短信通道，不要配置新加坡短信地域。
阿里云客服确认短信接入地址使用 `dysmsapi.aliyuncs.com` 即可；项目里对应的地域参数使用 `cn-hangzhou`。
如果 Vercel 上曾经配置过新加坡地域或新加坡 endpoint，需要改回下面的值并重新部署。

| Key | Value | 说明 |
|---|---|---|
| `DAONE_SMS_MOCK_ENABLED` | `false` | 关闭短信 mock，启用真实阿里云短信。 |
| `SMS_REGION_ID` | `cn-hangzhou` | 国内短信 OpenAPI 地域。 |
| `SMS_ENDPOINT` | `dysmsapi.aliyuncs.com` | 国内短信 OpenAPI endpoint。 |
| `SMS_SIGN_NAME` | `杭州稻青文化科技有限公司` | 阿里云短信签名名称，必须和控制台审核通过的签名完全一致。 |
| `SMS_TEMPLATE_CODE` | `SMS_507820018` | 阿里云短信模板 Code，必须是国内短信模板。 |
| `ALIYUN_ACCESS_KEY_ID` | `<你的 AccessKeyId>` | 阿里云访问密钥 ID。 |
| `ALIYUN_ACCESS_KEY_SECRET` | `<你的 AccessKeySecret>` | 阿里云访问密钥 Secret。 |

不要使用下面的新加坡配置发送中国大陆手机号验证码：

```env
SMS_REGION_ID=ap-southeast-1
SMS_ENDPOINT=dysmsapi.ap-southeast-1.aliyuncs.com
```

阿里云密钥也可以使用下面这组官方常见命名，二选一即可，不要两组填不同值：

| Key | Value |
|---|---|
| `ALIBABA_CLOUD_ACCESS_KEY_ID` | `<你的 AccessKeyId>` |
| `ALIBABA_CLOUD_ACCESS_KEY_SECRET` | `<你的 AccessKeySecret>` |

## 验证码缓存必填

生产和预览环境会先把验证码写入 Redis，再调用阿里云发送短信。Redis 没配时，验证码发送流程会失败。

推荐使用连接串：

| Key | Value | 说明 |
|---|---|---|
| `DAONE_AUTH_CACHE_TYPE` | `redis` | 登录 token 和短信验证码使用 Redis。 |
| `REDIS_ENABLED` | `true` | 启用 Redis 中间件。 |
| `REDIS_URL` | `<你的 Redis 连接串>` | 例如 Vercel/Upstash/云 Redis 提供的连接串。 |

如果没有 `REDIS_URL`，可以改用主机方式：

| Key | Value |
|---|---|
| `REDIS_HOST` | `<你的 Redis 地址>` |
| `REDIS_PORT` | `6379` |
| `REDIS_PASSWORD` | `<你的 Redis 密码>` |

## 基础环境建议

| Key | Value | 说明 |
|---|---|---|
| `DAONE_PROFILE` | `prod` | Production 环境使用；Vercel Production 也会自动识别为 `prod`。 |
| `DAONE_FRONTEND_BASE_URL` | `https://www.daoneai.com` | 前端站点地址。 |
| `DAONE_CORS_ALLOWED_ORIGINS` | `https://www.daoneai.com,https://admin.daoneai.com` | 允许跨域访问的前台和管理后台域名，多个域名用英文逗号分隔。 |
| `DAONE_ADMIN_PHONES` | `<管理员手机号>` | 管理后台允许短信登录的手机号，多个手机号用英文逗号分隔。 |
| `DAONE_SMS_CODE_TTL_SECONDS` | `300` | 短信验证码有效期，默认 5 分钟。 |

## 微信支付必填

项目部署在 Vercel 后，会优先读取 Vercel Project Settings -> Environment Variables 中配置的环境变量。下面的微信支付变量需要分别配置到 Production 和 Preview/Test 环境。

### Production

| Key | Value | 说明 |
|---|---|---|
| `DAONE_PAYMENT_MOCK_ENABLED` | `false` | 关闭支付 mock，启用真实支付通道。 |
| `WECHAT_PAY_APP_ID` | `<微信支付关联的 AppID>` | 微信支付关联的 AppID。 |
| `WECHAT_PAY_MERCHANT_ID` | `<微信支付商户号>` | 微信支付商户号。 |
| `WECHAT_PAY_MERCHANT_SERIAL_NUMBER` | `<API 证书序列号>` | API 证书序列号。 |
| `WECHAT_PAY_API_V3_KEY` | `<微信支付 APIv3 密钥>` | 微信支付 APIv3 密钥，不要提交到代码仓库。 |
| `WECHAT_PAY_NOTIFY_URL` | `https://www.daoneai.com/api/v1/payments/WECHAT/notify` | 微信支付服务端回调地址。 |
| `WECHAT_PAY_PRIVATE_KEY` | `<apiclient_key.pem 文件内容>` | 商户 API 私钥内容，推荐在 Vercel 直接配置该项。 |
| `WECHAT_PAY_PRIVATE_KEY_PATH` | 留空 | Vercel 上通常不用文件路径方式。 |

### Preview / Test

| Key | Value | 说明 |
|---|---|---|
| `DAONE_PAYMENT_MOCK_ENABLED` | `false` | 关闭支付 mock，启用真实支付通道。 |
| `WECHAT_PAY_APP_ID` | `<微信支付关联的 AppID>` | 微信支付关联的 AppID。 |
| `WECHAT_PAY_MERCHANT_ID` | `<微信支付商户号>` | 微信支付商户号。 |
| `WECHAT_PAY_MERCHANT_SERIAL_NUMBER` | `<API 证书序列号>` | API 证书序列号。 |
| `WECHAT_PAY_API_V3_KEY` | `<微信支付 APIv3 密钥>` | 微信支付 APIv3 密钥，不要提交到代码仓库。 |
| `WECHAT_PAY_NOTIFY_URL` | `https://dev.daoneai.com/api/v1/payments/WECHAT/notify` | 微信支付服务端回调地址。 |
| `WECHAT_PAY_PRIVATE_KEY` | `<apiclient_key.pem 文件内容>` | 商户 API 私钥内容，推荐在 Vercel 直接配置该项。 |
| `WECHAT_PAY_PRIVATE_KEY_PATH` | 留空 | Vercel 上通常不用文件路径方式。 |

`WECHAT_PAY_PRIVATE_KEY` 需要填写微信商户平台下载的 `apiclient_key.pem` 内容，格式通常是：

```text
-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----
```

在 Vercel 环境变量中建议把换行写成 `\n`：

```env
WECHAT_PAY_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```

不要把 `-----BEGIN CERTIFICATE-----` 开头的证书内容填到 `WECHAT_PAY_PRIVATE_KEY`。证书不是商户 API 私钥，用证书会导致微信支付请求签名失败。

## 排查方式

部署后访问：

```bash
curl https://你的域名/api/health
```

重点查看返回里的：

- `mocks.sms` 应为 `false`
- `middleware.smsProvider` 应为 `true`
- `middleware.redisCache` 应为 `true`
- `ready` 应为 `true`
- `missingRequired` 应为空数组

如果短信仍发送失败，查看 Vercel Function Logs 中 `sms_provider_aliyun_response` 的 `aliyunCode` 和 `aliyunMessage`。常见原因包括签名或模板不是国内短信审核通过、模板变量不匹配、AccessKey 权限不足、账号欠费或短信服务未开通。
