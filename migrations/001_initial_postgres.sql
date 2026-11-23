-- RailDesign AI PostgreSQL Schema & Initial Migration (001)
-- Compatible with PostgreSQL 15+

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- 'user' | 'admin' | 'super_admin'
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token TEXT,
  reset_token TEXT,
  reset_token_expires_at TIMESTAMPTZ,
  oauth_provider TEXT,
  oauth_provider_id TEXT,
  preferred_provider TEXT NOT NULL DEFAULT 'google_gemini',
  preferred_model TEXT NOT NULL DEFAULT 'gemini-4-hydrogen',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avatar_url TEXT,
  company TEXT,
  job_title TEXT,
  bio TEXT,
  theme_preference TEXT NOT NULL DEFAULT 'dark',
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  engine_id TEXT NOT NULL DEFAULT 'engine01_website',
  provider_id TEXT NOT NULL DEFAULT 'google_gemini',
  model_id TEXT NOT NULL DEFAULT 'gemini-4-hydrogen',
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'archived'
  design_system_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  screens_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  files_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_slug TEXT UNIQUE,
  published_url TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  label TEXT NOT NULL,
  screens_json JSONB NOT NULL,
  files_json JSONB NOT NULL,
  design_system_json JSONB NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_generation_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  engine_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  reference_image_url TEXT,
  screen_count INTEGER NOT NULL DEFAULT 1,
  estimated_tokens INTEGER NOT NULL DEFAULT 50,
  reserved_tokens INTEGER NOT NULL DEFAULT 0,
  settled_tokens INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued' | 'running' | 'completed' | 'failed' | 'refunded'
  result_summary TEXT,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS engine_execution_logs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES ai_generation_jobs(id) ON DELETE CASCADE,
  engine_id TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info', -- 'info' | 'warn' | 'error'
  message TEXT NOT NULL,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provider_configurations (
  provider_id TEXT PRIMARY KEY, -- 'google_gemini' | 'openai_chatgpt' | 'anthropic_claude'
  display_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  default_model TEXT NOT NULL,
  models_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_wallets (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  available_tokens INTEGER NOT NULL DEFAULT 100 CHECK (available_tokens >= 0),
  reserved_tokens INTEGER NOT NULL DEFAULT 0 CHECK (reserved_tokens >= 0),
  used_tokens INTEGER NOT NULL DEFAULT 0 CHECK (used_tokens >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT REFERENCES ai_generation_jobs(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- 'grant' | 'reserve' | 'settle' | 'refund' | 'purchase' | 'admin_adjust'
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT NOT NULL,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL, -- 'cashfree'
  order_id TEXT NOT NULL UNIQUE,
  gateway_order_id TEXT,
  gateway_payment_id TEXT,
  package_id TEXT NOT NULL,
  tokens_purchased INTEGER NOT NULL,
  amount_inr NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded'
  webhook_verified BOOLEAN NOT NULL DEFAULT FALSE,
  metadata_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL, -- 'free' | 'starter' | 'pro' | 'premium' | 'enterprise'
  status TEXT NOT NULL DEFAULT 'active',
  monthly_token_allowance INTEGER NOT NULL,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shared_projects (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  visibility TEXT NOT NULL DEFAULT 'public', -- 'public' | 'private'
  permission TEXT NOT NULL DEFAULT 'view', -- 'view' | 'duplicate'
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_roles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL DEFAULT 'admin',
  permissions_json JSONB NOT NULL DEFAULT '["*"]'::jsonb,
  granted_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL, -- 'uploaded' | 'generated' | 'gif' | 'logo' | 'icon'
  mime_type TEXT NOT NULL,
  data_url TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'generation' | 'payment' | 'wallet' | 'project' | 'system'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  audience TEXT NOT NULL,
  price_monthly_inr INTEGER NOT NULL,
  price_monthly_usd INTEGER NOT NULL,
  token_allowance INTEGER NOT NULL,
  max_screens_per_job INTEGER NOT NULL,
  features_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  category TEXT NOT NULL, -- 'support' | 'bug' | 'feedback'
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON ai_generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_user ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_token ON shared_projects(share_token);
