import mysql from "mysql2/promise";
import pg from "pg";

const profile = process.env.DAONE_PROFILE || "prod";
process.env.DAONE_PROFILE = profile;

const { appConfig } = await import("../src/infrastructure/config/env.js");
const direction = process.argv[2] || "mysql-to-postgres";
const supportedDirections = ["mysql-to-postgres", "postgres-to-mysql"];

if (!supportedDirections.includes(direction)) {
  throw new Error(`Usage: npm run db:sync -- ${supportedDirections.join("|")}`);
}

const mysqlPool = mysql.createPool({
  host: appConfig.dataSource.mysql.host,
  port: appConfig.dataSource.mysql.port,
  database: appConfig.dataSource.mysql.database,
  user: appConfig.dataSource.mysql.username,
  password: appConfig.dataSource.mysql.password,
  waitForConnections: true,
  connectionLimit: 1,
  maxIdle: 1
});

const { Pool } = pg;
const postgresConfig = appConfig.dataSource.postgres.url
  ? { connectionString: appConfig.dataSource.postgres.url }
  : {
      host: appConfig.dataSource.postgres.host,
      port: appConfig.dataSource.postgres.port,
      database: appConfig.dataSource.postgres.database,
      user: appConfig.dataSource.postgres.username,
      password: appConfig.dataSource.postgres.password
    };
const postgresPool = new Pool({
  ...postgresConfig,
  max: 1,
  ssl: appConfig.dataSource.postgres.ssl ? { rejectUnauthorized: false } : false
});

try {
  await ensureMysqlRuntimeTable();
  await ensurePostgresRuntimeTable();
  const rows = direction === "mysql-to-postgres"
    ? await readMysqlRows()
    : await readPostgresRows();
  if (direction === "mysql-to-postgres") {
    await writePostgresRows(rows);
  } else {
    await writeMysqlRows(rows);
  }
  console.log(`Synced ${rows.length} daone_runtime_store row(s): ${direction}`);
} finally {
  await mysqlPool.end();
  await postgresPool.end();
}

async function ensureMysqlRuntimeTable() {
  await mysqlPool.execute(`
    CREATE TABLE IF NOT EXISTS daone_runtime_store (
      store_key VARCHAR(64) NOT NULL,
      store_value LONGTEXT NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (store_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
}

async function ensurePostgresRuntimeTable() {
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS daone_runtime_store (
      store_key VARCHAR(64) PRIMARY KEY,
      store_value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `);
}

async function readMysqlRows() {
  const [rows] = await mysqlPool.execute(
    "SELECT store_key, store_value, updated_at FROM daone_runtime_store"
  );
  return rows;
}

async function readPostgresRows() {
  const { rows } = await postgresPool.query(
    "SELECT store_key, store_value, updated_at FROM daone_runtime_store"
  );
  return rows;
}

async function writeMysqlRows(rows) {
  const keys = rows.map((row) => row.store_key);
  for (const row of rows) {
    await mysqlPool.execute(
      `INSERT INTO daone_runtime_store (store_key, store_value, updated_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE store_value = VALUES(store_value), updated_at = VALUES(updated_at)`,
      [row.store_key, row.store_value, row.updated_at]
    );
  }
  await deleteMysqlRowsNotIn(keys);
}

async function writePostgresRows(rows) {
  const keys = rows.map((row) => row.store_key);
  for (const row of rows) {
    await postgresPool.query(
      `INSERT INTO daone_runtime_store (store_key, store_value, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (store_key)
       DO UPDATE SET store_value = EXCLUDED.store_value, updated_at = EXCLUDED.updated_at`,
      [row.store_key, row.store_value, row.updated_at]
    );
  }
  await deletePostgresRowsNotIn(keys);
}

async function deleteMysqlRowsNotIn(keys) {
  if (!keys.length) {
    await mysqlPool.execute("DELETE FROM daone_runtime_store");
    return;
  }
  await mysqlPool.query(
    "DELETE FROM daone_runtime_store WHERE store_key NOT IN (?)",
    [keys]
  );
}

async function deletePostgresRowsNotIn(keys) {
  if (!keys.length) {
    await postgresPool.query("DELETE FROM daone_runtime_store");
    return;
  }
  await postgresPool.query(
    "DELETE FROM daone_runtime_store WHERE store_key <> ALL($1)",
    [keys]
  );
}
