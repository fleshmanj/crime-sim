-- 0021_seed_default_users.sql
-- Create/patch users table and seed default admin + analyst users.
-- Idempotent: safe to run multiple times (uses ON CONFLICT upsert).

BEGIN;

-- 1) Ensure users table exists
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(320) NOT NULL,
  password_hash TEXT         NOT NULL,
  role          VARCHAR(32)  NOT NULL,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 2) Patch older schemas (add any missing columns)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_active') THEN
    ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='created_at') THEN
    ALTER TABLE users ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='updated_at') THEN
    ALTER TABLE users ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role') THEN
    ALTER TABLE users ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'ANALYST';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_hash') THEN
    ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email') THEN
    ALTER TABLE users ADD COLUMN email VARCHAR(320) NOT NULL DEFAULT '';
  END IF;
END $$;

-- 3) Unique index on email (required for upsert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename='users' AND indexname='ux_users_email'
  ) THEN
    CREATE UNIQUE INDEX ux_users_email ON users (email);
  END IF;
END $$;

-- 4) Seed default users (precomputed hashes)
-- admin@example.com / AdminPass!123  -> scrypt
-- analyst@example.com / password123  -> pbkdf2:sha256
WITH seed(email, password_hash, role) AS (
  VALUES
    ('admin@example.com',
     'scrypt:32768:8:1$mDYsNk1S73vPUKm9$90a351ec163d6cd2551e0a3702e5f15a6b44870838676b98be8369d419a3b354ab61d098de22b7d03380e0a449c696c6fb45269a48cd26857da991b0a491e034',
     'ADMIN'),
    ('analyst@example.com',
     'pbkdf2:sha256:260000$1f2e3d4c5b6a7980$1a48da6c7c5b5ce5d049f8632eca581ba9776bd64dd406726a815fa9c80ee126',
     'ANALYST')
)
INSERT INTO users (email, password_hash, role, is_active, created_at, updated_at)
SELECT email, password_hash, role, TRUE, now(), now()
FROM seed
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    role          = EXCLUDED.role,
    is_active     = TRUE,
    updated_at    = now();

COMMIT;
