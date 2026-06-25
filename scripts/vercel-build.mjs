#!/usr/bin/env node

/**
 * Vercel 统一构建入口：按部署环境选择 profile，再执行构建校验。
 *
 * 优先级：
 * 1. Vercel Production → prod
 * 2. Vercel Preview / Development → test
 * 3. 非 Vercel 显式 DAONE_PROFILE（build:test / build:prod）
 * 4. 默认 test
 */
function resolveBuildProfile() {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production") {
    return "prod";
  }
  if (vercelEnv === "preview" || vercelEnv === "development") {
    return "test";
  }
  if (process.env.VERCEL && process.env.DAONE_PROFILE === "local") {
    return "test";
  }
  if (process.env.DAONE_PROFILE) {
    return process.env.DAONE_PROFILE;
  }
  return "test";
}

const profile = resolveBuildProfile();
process.env.DAONE_PROFILE = profile;

console.log(
  `Vercel build: VERCEL_ENV=${process.env.VERCEL_ENV ?? "local"}, profile=${profile}`,
);

await import("./vercel-build-check.mjs");
