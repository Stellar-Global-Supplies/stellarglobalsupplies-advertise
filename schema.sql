-- =============================================================
-- AdPlatform D1 Schema
-- Run: wrangler d1 execute adplatform-db --file=schema.sql
-- =============================================================

-- Users (mirrors Supabase Auth, for local profile/settings)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,  
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  gmail_client_id TEXT,
  gmail_client_secret TEXT,
  gmail_refresh_token TEXT,
  gmail_sender_email TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  preview_text TEXT,
  thumbnail_url TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);


CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  size_bytes INTEGER,
  mime_type TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);


CREATE TABLE IF NOT EXISTS contact_lists (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  neon_table_name TEXT NOT NULL,        
  neon_email_column TEXT DEFAULT 'email',
  neon_name_column TEXT DEFAULT 'name',
  description TEXT,
  subscriber_count INTEGER DEFAULT 0,
  last_synced_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);


CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  template_id TEXT REFERENCES templates(id),
  contact_list_id TEXT NOT NULL REFERENCES contact_lists(id),
  html_content TEXT NOT NULL,          
  status TEXT DEFAULT 'draft'          
    CHECK (status IN ('draft','scheduled','sending','sent','failed')),
  scheduled_at TEXT,
  sent_at TEXT,
  from_name TEXT,
  from_email TEXT,
  reply_to TEXT,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);


CREATE TABLE IF NOT EXISTS campaign_sends (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed','bounced')),
  error_message TEXT,
  sent_at TEXT,
  message_id TEXT                        
);


CREATE TABLE IF NOT EXISTS email_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  send_id TEXT REFERENCES campaign_sends(id),
  recipient_email TEXT NOT NULL,
  event_type TEXT NOT NULL              
    CHECK (event_type IN ('open','click','unsubscribe','bounce')),
  metadata TEXT,                        
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);


CREATE TABLE IF NOT EXISTS unsubscribes (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  campaign_id TEXT REFERENCES campaigns(id),
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, email)
);


CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_sends_campaign ON campaign_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sends_status ON campaign_sends(status);
CREATE INDEX IF NOT EXISTS idx_events_campaign ON email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON email_events(created_at);
CREATE INDEX IF NOT EXISTS idx_templates_user ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_images_user ON images(user_id);
CREATE INDEX IF NOT EXISTS idx_unsubscribes_email ON unsubscribes(email);

-- ================================================================
-- Migration: Convert per-user isolation → shared org workspace
-- Run: wrangler d1 execute adplatform-db --file=migration_shared_workspace.sql
-- ================================================================


ALTER TABLE templates     ADD COLUMN org_id TEXT;
ALTER TABLE images        ADD COLUMN org_id TEXT;
ALTER TABLE contact_lists ADD COLUMN org_id TEXT;
ALTER TABLE campaigns     ADD COLUMN org_id TEXT;
ALTER TABLE unsubscribes  ADD COLUMN org_id TEXT;


CREATE TABLE IF NOT EXISTS org_settings (
  org_id              TEXT PRIMARY KEY DEFAULT 'default',
  name                TEXT DEFAULT 'Stellar Global Supplies',
  gmail_client_id     TEXT,
  gmail_client_secret TEXT,
  gmail_refresh_token TEXT,
  gmail_sender_email  TEXT,
  updated_at          TEXT DEFAULT (datetime('now'))
);


INSERT OR IGNORE INTO org_settings (org_id) VALUES ('default');


UPDATE templates     SET org_id = 'default' WHERE org_id IS NULL;
UPDATE images        SET org_id = 'default' WHERE org_id IS NULL;
UPDATE contact_lists SET org_id = 'default' WHERE org_id IS NULL;
UPDATE campaigns     SET org_id = 'default' WHERE org_id IS NULL;
UPDATE unsubscribes  SET org_id = 'default' WHERE org_id IS NULL;

INSERT INTO org_settings (
  org_id, gmail_client_id, gmail_client_secret, gmail_refresh_token, gmail_sender_email
)
SELECT
  'default',
  gmail_client_id,
  gmail_client_secret,
  gmail_refresh_token,
  gmail_sender_email
FROM users
WHERE gmail_refresh_token IS NOT NULL
LIMIT 1
ON CONFLICT(org_id) DO UPDATE SET
  gmail_client_id     = excluded.gmail_client_id,
  gmail_client_secret = excluded.gmail_client_secret,
  gmail_refresh_token = excluded.gmail_refresh_token,
  gmail_sender_email  = excluded.gmail_sender_email;

CREATE INDEX IF NOT EXISTS idx_templates_org     ON templates(org_id);
CREATE INDEX IF NOT EXISTS idx_images_org        ON images(org_id);
CREATE INDEX IF NOT EXISTS idx_contact_lists_org ON contact_lists(org_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_org     ON campaigns(org_id);
CREATE INDEX IF NOT EXISTS idx_unsubscribes_org  ON unsubscribes(org_id);