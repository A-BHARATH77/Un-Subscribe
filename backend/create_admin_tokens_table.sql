-- Run this once in Supabase SQL Editor
-- Dashboard → SQL Editor → New query → paste and run

CREATE TABLE IF NOT EXISTS admin_tokens (
  id         INTEGER PRIMARY KEY DEFAULT 1,
  token_data JSONB   NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enforce exactly one row (single admin token)
CREATE UNIQUE INDEX IF NOT EXISTS admin_tokens_single ON admin_tokens (id);

-- Auto-update the timestamp on every upsert
CREATE OR REPLACE FUNCTION update_admin_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_tokens_updated_at_trigger ON admin_tokens;
CREATE TRIGGER admin_tokens_updated_at_trigger
  BEFORE UPDATE ON admin_tokens
  FOR EACH ROW EXECUTE FUNCTION update_admin_tokens_updated_at();
