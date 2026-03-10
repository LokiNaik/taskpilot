-- ============================================================
--  WorkLog AI — PostgreSQL Schema
--  Run this ONCE in pgAdmin on the worklog_ai database
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(150) UNIQUE NOT NULL,
  timezone   VARCHAR(50)  DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Enums ────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE task_status   AS ENUM ('todo','in_progress','blocked','done','deferred');
  CREATE TYPE task_priority AS ENUM ('critical','high','medium','low');
  CREATE TYPE task_source   AS ENUM ('manual','natural_language','meeting','digest');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tasks ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  raw_input         TEXT,
  status            task_status   DEFAULT 'todo',
  priority          task_priority DEFAULT 'medium',
  source            task_source   DEFAULT 'manual',
  due_date          DATE,
  due_time          TIME,
  reminder_at       TIMESTAMPTZ,
  reminder_sent     BOOLEAN DEFAULT FALSE,
  tags              TEXT[]   DEFAULT '{}',
  ai_priority_score FLOAT,
  ai_notes          TEXT,
  meeting_id        UUID,
  log_date          DATE DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date  ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status    ON tasks(status);

-- ── Meetings ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meetings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(200) NOT NULL,
  meeting_at TIMESTAMPTZ  NOT NULL,
  attendees  TEXT[]   DEFAULT '{}',
  raw_notes  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Daily Digests ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_digests (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  digest_date  DATE NOT NULL,
  summary_text TEXT NOT NULL,
  stats        JSONB,
  top_tasks    JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, digest_date)
);

-- ── Task History ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_history (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  old_status task_status,
  new_status task_status NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  note       TEXT
);

-- ── Auto-update updated_at on tasks ──────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tasks_updated ON tasks;
CREATE TRIGGER trg_tasks_updated
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Default user (change name/email as needed) ────────────────
INSERT INTO users (name, email)
VALUES ('Lokesh', 'lokesh@worklog.ai')
ON CONFLICT (email) DO NOTHING;
