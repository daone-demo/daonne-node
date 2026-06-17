import pg from "pg";
import { appConfig } from "../config/env.js";
import { exportStoreSnapshot, importStoreSnapshot } from "../db/memoryStore.js";

const { Pool } = pg;
const STORE_KEY = "daone-memory-store-v1";
let pool = null;
let initialized = false;

export function postgresRuntimeStoreEnabled() {
  return appConfig.profile !== "local" && appConfig.dataSource.type === "postgres";
}

export async function hydratePostgresRuntimeStore() {
  if (!postgresRuntimeStoreEnabled()) {
    return;
  }
  await ensureRuntimeTable();
  const { rows } = await getPool().query(
    "SELECT store_value FROM daone_runtime_store WHERE store_key = $1",
    [STORE_KEY]
  );
  if (!rows.length) {
    await persistPostgresRuntimeStore();
    return;
  }
  importStoreSnapshot(JSON.parse(rows[0].store_value));
}

export async function persistPostgresRuntimeStore() {
  if (!postgresRuntimeStoreEnabled()) {
    return;
  }
  await ensureRuntimeTable();
  const payload = JSON.stringify(exportStoreSnapshot());
  await getPool().query(
    `INSERT INTO daone_runtime_store (store_key, store_value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (store_key)
     DO UPDATE SET store_value = EXCLUDED.store_value, updated_at = NOW()`,
    [STORE_KEY, payload]
  );
}

export async function postgresRuntimeStoreHealth() {
  if (!postgresRuntimeStoreEnabled()) {
    return { enabled: false };
  }
  await ensureRuntimeTable();
  await getPool().query("SELECT 1");
  return { enabled: true, status: "UP" };
}

async function ensureRuntimeTable() {
  if (initialized) {
    return;
  }
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS daone_runtime_store (
      store_key VARCHAR(64) PRIMARY KEY,
      store_value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `);
  initialized = true;
}

function getPool() {
  if (!pool) {
    const config = appConfig.dataSource.postgres.url
      ? { connectionString: appConfig.dataSource.postgres.url }
      : {
          host: appConfig.dataSource.postgres.host,
          port: appConfig.dataSource.postgres.port,
          database: appConfig.dataSource.postgres.database,
          user: appConfig.dataSource.postgres.username,
          password: appConfig.dataSource.postgres.password
        };
    pool = new Pool({
      ...config,
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: appConfig.dataSource.postgres.ssl ? { rejectUnauthorized: false } : false
    });
  }
  return pool;
}
