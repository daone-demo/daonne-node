import { appConfig } from "../config/env.js";
import {
  hydrateRuntimeStore as hydrateMysqlRuntimeStore,
  mysqlRuntimeStoreHealth,
  persistRuntimeStore as persistMysqlRuntimeStore
} from "./mysqlRuntimeStore.js";
import {
  hydratePostgresRuntimeStore,
  persistPostgresRuntimeStore,
  postgresRuntimeStoreHealth
} from "./postgresRuntimeStore.js";

export async function hydrateRuntimeStore() {
  if (appConfig.dataSource.type === "mysql") {
    await hydrateMysqlRuntimeStore();
    return;
  }
  if (appConfig.dataSource.type === "postgres") {
    await hydratePostgresRuntimeStore();
  }
}

export async function persistRuntimeStore() {
  if (appConfig.dataSource.type === "mysql") {
    await persistMysqlRuntimeStore();
    return;
  }
  if (appConfig.dataSource.type === "postgres") {
    await persistPostgresRuntimeStore();
  }
}

export async function runtimeStoreHealth() {
  if (appConfig.dataSource.type === "mysql") {
    return mysqlRuntimeStoreHealth();
  }
  if (appConfig.dataSource.type === "postgres") {
    return postgresRuntimeStoreHealth();
  }
  return { enabled: false };
}
