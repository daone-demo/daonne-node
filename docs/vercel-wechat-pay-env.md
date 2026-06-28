# Vercel 微信支付环境变量配置

## Production

```env
WECHAT_PAY_APP_ID=<你的微信支付 AppID>
WECHAT_PAY_MERCHANT_ID=<你的微信支付商户号>
WECHAT_PAY_MERCHANT_SERIAL_NUMBER=<你的商户 API 证书序列号>
WECHAT_PAY_API_V3_KEY=<你的微信支付 API v3 密钥>
WECHAT_PAY_NOTIFY_URL=https://www.daoneai.com/api/v1/payments/WECHAT/notify
WECHAT_PAY_PRIVATE_KEY=
WECHAT_PAY_PRIVATE_KEY_PATH=
```

## Preview / Test

```env
WECHAT_PAY_APP_ID=<你的微信支付 AppID>
WECHAT_PAY_MERCHANT_ID=<你的微信支付商户号>
WECHAT_PAY_MERCHANT_SERIAL_NUMBER=<你的商户 API 证书序列号>
WECHAT_PAY_API_V3_KEY=<你的微信支付 API v3 密钥>
WECHAT_PAY_NOTIFY_URL=https://dev.daoneai.com/api/v1/payments/WECHAT/notify
WECHAT_PAY_PRIVATE_KEY=
WECHAT_PAY_PRIVATE_KEY_PATH=
```

## 私钥配置说明

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

`WECHAT_PAY_PRIVATE_KEY_PATH` 在 Vercel 上通常不用配置，除非部署包里明确包含私钥文件。二选一即可：

- 使用 `WECHAT_PAY_PRIVATE_KEY`：直接配置私钥内容。
- 使用 `WECHAT_PAY_PRIVATE_KEY_PATH`：配置私钥文件路径。
