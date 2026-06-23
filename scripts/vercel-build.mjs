#!/usr/bin/env node

/**
 * Vercel 统一构建入口：按部署环境选择 profile，再执行构建校验。
 *
 * 优先级：
 * 1. 显式 DAONE_PROFILE（build:test / build:prod）
 * 2. VERCEL_ENV=production → prod
 * 3. VERCEL_ENV=preview|development → test
 * 4. 默认 test
 */
function resolveBuildProfile() {
  if (process.env.DAONE_PROFILE) {
    return process.env.DAONE_PROFILE;
  }
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production") {
    return "prod";
  }
  if (vercelEnv === "preview" || vercelEnv === "development") {
    return "test";
  }
  return "test";
}

const profile = resolveBuildProfile();
process.env.DAONE_PROFILE = profile;

console.log(
  `Vercel build: VERCEL_ENV=${process.env.VERCEL_ENV ?? "local"}, profile=${profile}`,
);

await import("./vercel-build-check.mjs");
