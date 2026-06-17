-- Daone Vercel Postgres runtime store
-- Suitable for Vercel Postgres / Neon-compatible PostgreSQL.
-- The current Node/Vercel API uses this table to synchronize the in-memory
-- runtime snapshot across serverless invocations.

CREATE TABLE IF NOT EXISTS daone_runtime_store (
    store_key VARCHAR(64) PRIMARY KEY,
    store_value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
