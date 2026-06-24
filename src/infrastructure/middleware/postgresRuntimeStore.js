import pg from "pg";
import { appConfig } from "../config/env.js";
import { exportStoreSnapshot, importStoreSnapshot } from "../db/memoryStore.js";
import { mirrorPostgresBusinessTables } from "./postgresBusinessMirror.js";

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
  await mirrorPostgresBusinessTables(getPool());
}

export async function postgresRuntimeStoreHealth() {
  if (!postgresRuntimeStoreEnabled()) {
    return { enabled: false };
  }
  await ensureRuntimeTable();
  await getPool().query("SELECT 1");
  return { enabled: true, status: "UP" };
}

export async function findOrCreatePostgresUser({ phone, nickname, role }) {
  if (!postgresRuntimeStoreEnabled()) {
    return null;
  }
  await ensureRuntimeTable();
  const { rows } = await getPool().query(
    `INSERT INTO user_account
       (phone, nickname, gender, status, role, created_at, updated_at)
     VALUES ($1, $2, 'UNKNOWN', 'ENABLED', $3, NOW(), NOW())
     ON CONFLICT (phone) DO UPDATE SET
       phone = EXCLUDED.phone,
       role = CASE
         WHEN user_account.role IS NULL OR user_account.role = '' THEN EXCLUDED.role
         WHEN EXCLUDED.role IS NULL OR EXCLUDED.role = '' THEN user_account.role
         WHEN (',' || user_account.role || ',') LIKE ('%,' || EXCLUDED.role || ',%') THEN user_account.role
         ELSE user_account.role || ',' || EXCLUDED.role
       END,
       updated_at = NOW()
     RETURNING id, phone, nickname, avatar_url, email, gender, birthday, status, role, created_at, updated_at`,
    [phone, nickname, role]
  );
  const row = rows[0];
  const pointResult = await getPool().query(
    `SELECT available_points, frozen_points, granted_total, version, updated_at
       FROM point_account WHERE user_id = $1`,
    [row.id]
  );
  return {
    user: {
      id: String(row.id),
      phone: row.phone,
      nickname: row.nickname,
      avatarUrl: row.avatar_url,
      email: row.email,
      gender: row.gender,
      birthday: row.birthday ? toIsoDate(row.birthday) : null,
      status: row.status,
      role: row.role,
      createdAt: toIsoDate(row.created_at),
      updatedAt: toIsoDate(row.updated_at)
    },
    pointAccount: pointResult.rows[0]
      ? {
          userId: String(row.id),
          availablePoints: Number(pointResult.rows[0].available_points),
          frozenPoints: Number(pointResult.rows[0].frozen_points),
          grantedTotal: Number(pointResult.rows[0].granted_total),
          version: Number(pointResult.rows[0].version || 0),
          updatedAt: toIsoDate(pointResult.rows[0].updated_at)
        }
      : null
  };
}

export async function findPostgresUserByPhone(phone) {
  if (!postgresRuntimeStoreEnabled()) {
    return null;
  }
  await ensureRuntimeTable();
  const { rows } = await getPool().query(
    `SELECT id, phone, nickname, avatar_url, email, gender, birthday, status, role, created_at, updated_at
       FROM user_account
      WHERE phone = $1
      LIMIT 1`,
    [phone]
  );
  return rows[0] ? mapUserRow(rows[0]) : null;
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
  await ensureUserIdentity();
  initialized = true;
}

function mapUserRow(row) {
  return {
    id: String(row.id),
    phone: row.phone,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    email: row.email,
    gender: row.gender,
    birthday: row.birthday ? toIsoDate(row.birthday) : null,
    status: row.status,
    role: row.role,
    createdAt: toIsoDate(row.created_at),
    updatedAt: toIsoDate(row.updated_at)
  };
}

async function ensureUserIdentity() {
  const { rows } = await getPool().query(
    `SELECT is_identity
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'user_account'
        AND column_name = 'id'`
  );
  if (!rows.length) {
    return;
  }
  if (rows[0].is_identity !== "YES") {
    await getPool().query(
      "ALTER TABLE user_account ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY"
    );
    await getPool().query(
      `SELECT setval(
         pg_get_serial_sequence('user_account', 'id'),
         COALESCE((SELECT MAX(id) FROM user_account), 0) + 1,
         false
       )`
    );
  }
}

function toIsoDate(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function getPool() {
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
