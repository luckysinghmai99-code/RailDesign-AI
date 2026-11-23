import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';
import {
  DEFAULT_DESIGN_SYSTEM,
  DEFAULT_PRICING_PLANS,
  DEFAULT_TOKEN_PACKAGES,
  PROVIDER_DEFINITIONS,
} from '../../shared/catalog.ts';
import type {
  AssetItem,
  DesignSystem,
  EngineId,
  EngineLogEntry,
  GenerationJob,
  NotificationItem,
  PaymentRecord,
  PricingPlan,
  ProjectFile,
  ProjectRecord,
  ProjectVersion,
  ProviderId,
  ScreenNode,
  SharedProjectLink,
  TokenPackage,
  TokenTransaction,
  TokenWallet,
  UserProfile,
  UserRole,
} from '../../shared/types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.join(DATA_DIR, 'raildesign.db');

export const sqliteDb = new DatabaseSync(DB_PATH);
sqliteDb.exec('PRAGMA journal_mode = WAL;');
sqliteDb.exec('PRAGMA busy_timeout = 5000;');
sqliteDb.exec('PRAGMA foreign_keys = ON;');

// Optional PostgreSQL Pool if DATABASE_URL is configured
let pgPool: Pool | null = null;
export function getPgPool(): Pool | null {
  if (process.env.DATABASE_URL && !pgPool) {
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 25,
      connectionTimeoutMillis: 10000,
    });
    pgPool.on('error', (err) => {
      console.error('PostgreSQL idle pool error:', err);
    });
  }
  return pgPool;
}

export function initializeDatabase(): void {
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      email_verified INTEGER NOT NULL DEFAULT 0,
      verification_token TEXT,
      reset_token TEXT,
      reset_token_expires_at TEXT,
      oauth_provider TEXT,
      oauth_provider_id TEXT,
      preferred_provider TEXT NOT NULL DEFAULT 'google_gemini',
      preferred_model TEXT NOT NULL DEFAULT 'gemini-4-hydrogen',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      company TEXT DEFAULT '',
      job_title TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      theme_preference TEXT NOT NULL DEFAULT 'dark',
      settings_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      engine_id TEXT NOT NULL DEFAULT 'engine01_website',
      provider_id TEXT NOT NULL DEFAULT 'google_gemini',
      model_id TEXT NOT NULL DEFAULT 'gemini-4-hydrogen',
      status TEXT NOT NULL DEFAULT 'active',
      design_system_json TEXT NOT NULL,
      screens_json TEXT NOT NULL,
      files_json TEXT NOT NULL,
      generated_images_json TEXT NOT NULL DEFAULT '[]',
      animation_frames_json TEXT NOT NULL DEFAULT '[]',
      gif_data_url TEXT,
      test_report_json TEXT,
      published_slug TEXT UNIQUE,
      published_url TEXT,
      published_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_versions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      label TEXT NOT NULL,
      screens_json TEXT NOT NULL,
      files_json TEXT NOT NULL,
      design_system_json TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
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
      status TEXT NOT NULL DEFAULT 'queued',
      result_summary TEXT,
      error_message TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS engine_execution_logs (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES ai_generation_jobs(id) ON DELETE CASCADE,
      engine_id TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS provider_configurations (
      provider_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      default_model TEXT NOT NULL,
      models_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS token_wallets (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      available_tokens INTEGER NOT NULL DEFAULT 100 CHECK (available_tokens >= 0),
      reserved_tokens INTEGER NOT NULL DEFAULT 0 CHECK (reserved_tokens >= 0),
      used_tokens INTEGER NOT NULL DEFAULT 0 CHECK (used_tokens >= 0),
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS token_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      job_id TEXT REFERENCES ai_generation_jobs(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      description TEXT NOT NULL,
      idempotency_key TEXT UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      gateway TEXT NOT NULL,
      order_id TEXT NOT NULL UNIQUE,
      gateway_order_id TEXT,
      gateway_payment_id TEXT,
      package_id TEXT NOT NULL,
      tokens_purchased INTEGER NOT NULL,
      amount_inr REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'pending',
      webhook_verified INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      monthly_token_allowance INTEGER NOT NULL DEFAULT 100,
      current_period_start TEXT NOT NULL,
      current_period_end TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shared_projects (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      share_token TEXT NOT NULL UNIQUE,
      visibility TEXT NOT NULL DEFAULT 'public',
      permission TEXT NOT NULL DEFAULT 'view',
      revoked INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_roles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      role_name TEXT NOT NULL DEFAULT 'admin',
      granted_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      data_url TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pricing_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      audience TEXT NOT NULL,
      price_monthly_inr INTEGER NOT NULL,
      price_monthly_usd INTEGER NOT NULL,
      token_allowance INTEGER NOT NULL,
      max_screens_per_job INTEGER NOT NULL,
      features_json TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS token_packages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tokens INTEGER NOT NULL,
      price_inr INTEGER NOT NULL,
      price_usd INTEGER NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      email TEXT NOT NULL,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  try {
    sqliteDb.exec(`ALTER TABLE profiles ADD COLUMN settings_json TEXT NOT NULL DEFAULT '{}';`);
  } catch {
    // Column already exists
  }

  const now = new Date().toISOString();

  // Seed 3 provider configurations
  const upsertProvider = sqliteDb.prepare(`
    INSERT INTO provider_configurations (provider_id, display_name, enabled, default_model, models_json, updated_at)
    VALUES (?, ?, 1, ?, ?, ?)
    ON CONFLICT(provider_id) DO NOTHING
  `);

  (Object.keys(PROVIDER_DEFINITIONS) as ProviderId[]).forEach((pid) => {
    const def = PROVIDER_DEFINITIONS[pid];
    upsertProvider.run(pid, def.name, def.defaultModel, JSON.stringify(def.models), now);
  });

  // Seed default pricing plans
  const upsertPlan = sqliteDb.prepare(`
    INSERT INTO pricing_plans (id, name, audience, price_monthly_inr, price_monthly_usd, token_allowance, max_screens_per_job, features_json, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);

  for (const plan of DEFAULT_PRICING_PLANS) {
    upsertPlan.run(
      plan.id,
      plan.name,
      plan.audience,
      plan.priceMonthlyInr,
      plan.priceMonthlyUsd,
      plan.tokenAllowance,
      plan.maxScreensPerJob,
      JSON.stringify(plan.features),
      plan.sortOrder
    );
  }

  // Seed default token packages
  const upsertPkg = sqliteDb.prepare(`
    INSERT INTO token_packages (id, name, tokens, price_inr, price_usd, description)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);

  for (const pkg of DEFAULT_TOKEN_PACKAGES) {
    upsertPkg.run(pkg.id, pkg.name, pkg.tokens, pkg.priceInr, pkg.priceUsd, pkg.description);
  }
}

initializeDatabase();

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix = ''): string {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

// ============================================================================
// USER & SESSION HELPERS
// ============================================================================

export function mapUserRow(row: Record<string, unknown>): UserProfile {
  let parsedSettings: UserProfile['settings'];
  try {
    const raw = row.settings_json ? JSON.parse(String(row.settings_json)) : {};
    parsedSettings = {
      defaultViewport: raw.defaultViewport || 'desktop',
      snapToGrid: raw.snapToGrid ?? true,
      autoSave: raw.autoSave ?? true,
      defaultScreenCount: Number(raw.defaultScreenCount || 3),
      defaultExportFormat: raw.defaultExportFormat || 'zip',
      notifyGeneration: raw.notifyGeneration ?? true,
      notifyPayments: raw.notifyPayments ?? true,
      notifyDeployments: raw.notifyDeployments ?? true,
      notifySecurity: raw.notifySecurity ?? true,
    };
  } catch {
    parsedSettings = undefined;
  }

  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: String(row.role) as UserRole,
    emailVerified: Boolean(row.email_verified),
    oauthProvider: row.oauth_provider ? String(row.oauth_provider) : null,
    preferredProvider: (row.preferred_provider as ProviderId) || 'google_gemini',
    preferredModel: String(row.preferred_model || 'gemini-4-hydrogen'),
    company: row.company ? String(row.company) : '',
    jobTitle: row.job_title ? String(row.job_title) : '',
    bio: row.bio ? String(row.bio) : '',
    themePreference: (row.theme_preference as 'dark' | 'light') || 'dark',
    settings: parsedSettings,
    createdAt: String(row.created_at),
  };
}

export function getUserById(userId: string): UserProfile | null {
  const row = sqliteDb
    .prepare(
      `SELECT u.*, p.company, p.job_title, p.bio, p.theme_preference, p.settings_json
       FROM users u LEFT JOIN profiles p ON u.id = p.user_id
       WHERE u.id = ? AND u.is_active = 1`
    )
    .get(userId) as Record<string, unknown> | undefined;
  return row ? mapUserRow(row) : null;
}

export function getUserAuthRowByEmail(email: string): Record<string, unknown> | undefined {
  return sqliteDb
    .prepare(`SELECT * FROM users WHERE lower(email) = lower(?)`)
    .get(email.trim()) as Record<string, unknown> | undefined;
}

export function createUserAccount(params: {
  email: string;
  name: string;
  passwordHash?: string | null;
  oauthProvider?: string | null;
  oauthProviderId?: string | null;
  emailVerified?: boolean;
  role?: UserRole;
}): { user: UserProfile; verificationToken: string } {
  const userId = newId('usr');
  const now = nowIso();
  const verificationToken = crypto.randomBytes(24).toString('hex');
  const role: UserRole = params.role || 'user';

  sqliteDb.exec('BEGIN IMMEDIATE');
  try {
    sqliteDb
      .prepare(
        `INSERT INTO users (id, email, password_hash, name, role, email_verified, verification_token, oauth_provider, oauth_provider_id, preferred_provider, preferred_model, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'google_gemini', 'gemini-4-hydrogen', 1, ?, ?)`
      )
      .run(
        userId,
        params.email.trim().toLowerCase(),
        params.passwordHash ?? null,
        params.name.trim(),
        role,
        params.emailVerified ? 1 : 0,
        verificationToken,
        params.oauthProvider ?? null,
        params.oauthProviderId ?? null,
        now,
        now
      );

    sqliteDb
      .prepare(`INSERT INTO profiles (user_id, company, job_title, bio, theme_preference, updated_at) VALUES (?, '', '', '', 'dark', ?)`)
      .run(userId, now);

    sqliteDb
      .prepare(`INSERT INTO token_wallets (user_id, available_tokens, reserved_tokens, used_tokens, updated_at) VALUES (?, 100, 0, 0, ?)`)
      .run(userId, now);

    sqliteDb
      .prepare(
        `INSERT INTO token_transactions (id, user_id, job_id, type, amount, balance_after, description, idempotency_key, created_at)
         VALUES (?, ?, NULL, 'grant', 100, 100, 'Welcome starter token grant (covers up to 6 screens)', ?, ?)`
      )
      .run(newId('tx'), userId, `welcome_${userId}`, now);

    const periodEnd = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
    sqliteDb
      .prepare(
        `INSERT INTO subscriptions (id, user_id, plan_id, status, monthly_token_allowance, current_period_start, current_period_end, updated_at)
         VALUES (?, ?, 'free', 'active', 100, ?, ?, ?)`
      )
      .run(newId('sub'), userId, now, periodEnd, now);

    if (role === 'admin' || role === 'super_admin') {
      sqliteDb
        .prepare(`INSERT INTO admin_roles (user_id, role_name, granted_by, created_at) VALUES (?, ?, 'system', ?)`)
        .run(userId, role, now);
    }

    sqliteDb
      .prepare(
        `INSERT INTO notifications (id, user_id, category, title, message, is_read, created_at)
         VALUES (?, ?, 'wallet', 'Welcome to RailDesign AI', '100 starter tokens have been credited to your wallet.', 0, ?)`
      )
      .run(newId('notif'), userId, now);

    sqliteDb.exec('COMMIT');
  } catch (err) {
    sqliteDb.exec('ROLLBACK');
    throw err;
  }

  const user = getUserById(userId)!;
  return { user, verificationToken };
}

export function createSessionRecord(userId: string, tokenHash: string, ip?: string, ua?: string): void {
  const now = nowIso();
  const expiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
  sqliteDb
    .prepare(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(newId('sess'), userId, tokenHash, expiresAt, ip || '', ua || '', now);
}

export function getSessionByTokenHash(tokenHash: string): { userId: string; expiresAt: string } | null {
  const row = sqliteDb
    .prepare(`SELECT user_id, expires_at FROM sessions WHERE token_hash = ?`)
    .get(tokenHash) as Record<string, unknown> | undefined;
  if (!row) return null;
  if (new Date(String(row.expires_at)).getTime() < Date.now()) {
    sqliteDb.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
    return null;
  }
  return { userId: String(row.user_id), expiresAt: String(row.expires_at) };
}

export function deleteSessionByTokenHash(tokenHash: string): void {
  sqliteDb.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
}

// ============================================================================
// ATOMIC TOKEN WALLET ACCOUNTING (NEVER NEGATIVE, NEVER DOUBLE DEDUCTED)
// ============================================================================

export function getWallet(userId: string): TokenWallet {
  let row = sqliteDb.prepare(`SELECT * FROM token_wallets WHERE user_id = ?`).get(userId) as Record<string, unknown> | undefined;
  if (!row) {
    const now = nowIso();
    sqliteDb
      .prepare(`INSERT OR IGNORE INTO token_wallets (user_id, available_tokens, reserved_tokens, used_tokens, updated_at) VALUES (?, 100, 0, 0, ?)`)
      .run(userId, now);
    row = sqliteDb.prepare(`SELECT * FROM token_wallets WHERE user_id = ?`).get(userId) as Record<string, unknown>;
  }
  return {
    userId: String(row.user_id),
    availableTokens: Number(row.available_tokens),
    reservedTokens: Number(row.reserved_tokens),
    usedTokens: Number(row.used_tokens),
    updatedAt: String(row.updated_at),
  };
}

export function reserveTokensForJob(userId: string, jobId: string, amount: number, description: string): TokenWallet {
  if (amount <= 0) throw new Error('Reservation amount must be positive');
  const idempotencyKey = `reserve_${jobId}`;
  const now = nowIso();

  sqliteDb.exec('BEGIN IMMEDIATE');
  try {
    const existing = sqliteDb
      .prepare(`SELECT id FROM token_transactions WHERE idempotency_key = ?`)
      .get(idempotencyKey);
    if (existing) {
      sqliteDb.exec('COMMIT');
      return getWallet(userId);
    }

    const wallet = sqliteDb.prepare(`SELECT * FROM token_wallets WHERE user_id = ?`).get(userId) as Record<string, unknown> | undefined;
    const avail = Number(wallet?.available_tokens ?? 0);
    if (avail < amount) {
      throw new Error(`INSUFFICIENT_TOKENS: Required ${amount} tokens, available ${avail}.`);
    }

    const nextAvail = avail - amount;
    const nextReserved = Number(wallet?.reserved_tokens ?? 0) + amount;

    sqliteDb
      .prepare(`UPDATE token_wallets SET available_tokens = ?, reserved_tokens = ?, updated_at = ? WHERE user_id = ?`)
      .run(nextAvail, nextReserved, now, userId);

    sqliteDb
      .prepare(
        `INSERT INTO token_transactions (id, user_id, job_id, type, amount, balance_after, description, idempotency_key, created_at)
         VALUES (?, ?, ?, 'reserve', ?, ?, ?, ?, ?)`
      )
      .run(newId('tx'), userId, jobId, -amount, nextAvail, description, idempotencyKey, now);

    sqliteDb.exec('COMMIT');
    return {
      userId,
      availableTokens: nextAvail,
      reservedTokens: nextReserved,
      usedTokens: Number(wallet?.used_tokens ?? 0),
      updatedAt: now,
    };
  } catch (err) {
    sqliteDb.exec('ROLLBACK');
    throw err;
  }
}

export function settleTokensForJob(
  userId: string,
  jobId: string,
  reservedAmount: number,
  actualAmount: number,
  description: string
): TokenWallet {
  const idempotencyKey = `settle_${jobId}`;
  const now = nowIso();
  const clampedActual = Math.max(0, Math.min(reservedAmount, actualAmount));
  const unusedRefund = reservedAmount - clampedActual;

  sqliteDb.exec('BEGIN IMMEDIATE');
  try {
    const existing = sqliteDb
      .prepare(`SELECT id FROM token_transactions WHERE idempotency_key = ?`)
      .get(idempotencyKey);
    if (existing) {
      sqliteDb.exec('COMMIT');
      return getWallet(userId);
    }

    const wallet = sqliteDb.prepare(`SELECT * FROM token_wallets WHERE user_id = ?`).get(userId) as Record<string, unknown>;
    const avail = Number(wallet.available_tokens);
    const reserved = Number(wallet.reserved_tokens);
    const used = Number(wallet.used_tokens);

    const nextReserved = Math.max(0, reserved - reservedAmount);
    const nextAvail = avail + unusedRefund;
    const nextUsed = used + clampedActual;

    sqliteDb
      .prepare(`UPDATE token_wallets SET available_tokens = ?, reserved_tokens = ?, used_tokens = ?, updated_at = ? WHERE user_id = ?`)
      .run(nextAvail, nextReserved, nextUsed, now, userId);

    sqliteDb
      .prepare(
        `INSERT INTO token_transactions (id, user_id, job_id, type, amount, balance_after, description, idempotency_key, created_at)
         VALUES (?, ?, ?, 'settle', ?, ?, ?, ?, ?)`
      )
      .run(newId('tx'), userId, jobId, -clampedActual, nextAvail, description, idempotencyKey, now);

    if (unusedRefund > 0) {
      sqliteDb
        .prepare(
          `INSERT INTO token_transactions (id, user_id, job_id, type, amount, balance_after, description, idempotency_key, created_at)
           VALUES (?, ?, ?, 'refund', ?, ?, ?, ?, ?)`
        )
        .run(
          newId('tx'),
          userId,
          jobId,
          unusedRefund,
          nextAvail,
          `Unused token reservation refund (${unusedRefund} tokens)`,
          `refund_unused_${jobId}`,
          now
        );
    }

    sqliteDb.exec('COMMIT');
    return {
      userId,
      availableTokens: nextAvail,
      reservedTokens: nextReserved,
      usedTokens: nextUsed,
      updatedAt: now,
    };
  } catch (err) {
    sqliteDb.exec('ROLLBACK');
    throw err;
  }
}

export function refundReservedTokensForJob(userId: string, jobId: string, reservedAmount: number, reason: string): TokenWallet {
  const idempotencyKey = `refund_fail_${jobId}`;
  const now = nowIso();

  sqliteDb.exec('BEGIN IMMEDIATE');
  try {
    const existing = sqliteDb
      .prepare(`SELECT id FROM token_transactions WHERE idempotency_key = ?`)
      .get(idempotencyKey);
    if (existing) {
      sqliteDb.exec('COMMIT');
      return getWallet(userId);
    }

    const wallet = sqliteDb.prepare(`SELECT * FROM token_wallets WHERE user_id = ?`).get(userId) as Record<string, unknown>;
    const avail = Number(wallet.available_tokens);
    const reserved = Number(wallet.reserved_tokens);

    const refundQty = Math.min(reserved, reservedAmount);
    const nextReserved = Math.max(0, reserved - refundQty);
    const nextAvail = avail + refundQty;

    sqliteDb
      .prepare(`UPDATE token_wallets SET available_tokens = ?, reserved_tokens = ?, updated_at = ? WHERE user_id = ?`)
      .run(nextAvail, nextReserved, now, userId);

    sqliteDb
      .prepare(
        `INSERT INTO token_transactions (id, user_id, job_id, type, amount, balance_after, description, idempotency_key, created_at)
         VALUES (?, ?, ?, 'refund', ?, ?, ?, ?, ?)`
      )
      .run(newId('tx'), userId, jobId, refundQty, nextAvail, reason, idempotencyKey, now);

    sqliteDb.exec('COMMIT');
    return {
      userId,
      availableTokens: nextAvail,
      reservedTokens: nextReserved,
      usedTokens: Number(wallet.used_tokens),
      updatedAt: now,
    };
  } catch (err) {
    sqliteDb.exec('ROLLBACK');
    throw err;
  }
}

export function creditTokens(
  userId: string,
  amount: number,
  type: 'purchase' | 'admin_adjust' | 'grant',
  description: string,
  idempotencyKey?: string
): TokenWallet {
  const now = nowIso();
  const key = idempotencyKey || newId('idem');

  sqliteDb.exec('BEGIN IMMEDIATE');
  try {
    const existing = sqliteDb.prepare(`SELECT id FROM token_transactions WHERE idempotency_key = ?`).get(key);
    if (existing) {
      sqliteDb.exec('COMMIT');
      return getWallet(userId);
    }

    const wallet = sqliteDb.prepare(`SELECT * FROM token_wallets WHERE user_id = ?`).get(userId) as Record<string, unknown>;
    const avail = Number(wallet?.available_tokens ?? 0);
    const nextAvail = Math.max(0, avail + amount);

    sqliteDb
      .prepare(`UPDATE token_wallets SET available_tokens = ?, updated_at = ? WHERE user_id = ?`)
      .run(nextAvail, now, userId);

    sqliteDb
      .prepare(
        `INSERT INTO token_transactions (id, user_id, job_id, type, amount, balance_after, description, idempotency_key, created_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)`
      )
      .run(newId('tx'), userId, type, amount, nextAvail, description, key, now);

    sqliteDb.exec('COMMIT');
    return getWallet(userId);
  } catch (err) {
    sqliteDb.exec('ROLLBACK');
    throw err;
  }
}

export function getTokenTransactions(userId: string, limit = 50): TokenTransaction[] {
  const rows = sqliteDb
    .prepare(`SELECT * FROM token_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`)
    .all(userId, limit) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    jobId: r.job_id ? String(r.job_id) : null,
    type: String(r.type) as TokenTransaction['type'],
    amount: Number(r.amount),
    balanceAfter: Number(r.balance_after),
    description: String(r.description),
    createdAt: String(r.created_at),
  }));
}

// ============================================================================
// PROJECTS & VERSIONS
// ============================================================================

export function mapProjectRow(r: Record<string, unknown>): ProjectRecord {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    name: String(r.name),
    description: String(r.description || ''),
    engineId: String(r.engine_id) as EngineId,
    providerId: String(r.provider_id) as ProviderId,
    modelId: String(r.model_id),
    status: (String(r.status) as 'active' | 'archived') || 'active',
    designSystem: JSON.parse(String(r.design_system_json || '{}')) as DesignSystem,
    screens: JSON.parse(String(r.screens_json || '[]')) as ScreenNode[],
    files: JSON.parse(String(r.files_json || '[]')) as ProjectFile[],
    generatedImages: JSON.parse(String(r.generated_images_json || '[]')),
    animationFrames: JSON.parse(String(r.animation_frames_json || '[]')),
    gifDataUrl: r.gif_data_url ? String(r.gif_data_url) : null,
    testReport: r.test_report_json ? JSON.parse(String(r.test_report_json)) : null,
    publishedSlug: r.published_slug ? String(r.published_slug) : null,
    publishedUrl: r.published_url ? String(r.published_url) : null,
    publishedAt: r.published_at ? String(r.published_at) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export function createProjectRecord(params: {
  userId: string;
  name: string;
  description?: string;
  engineId?: EngineId;
  providerId?: ProviderId;
  modelId?: string;
  designSystem?: DesignSystem;
  screens?: ScreenNode[];
  files?: ProjectFile[];
  generatedImages?: ProjectRecord['generatedImages'];
  animationFrames?: ProjectRecord['animationFrames'];
  gifDataUrl?: string | null;
  testReport?: ProjectRecord['testReport'];
}): ProjectRecord {
  const id = newId('prj');
  const now = nowIso();
  const designSystem = params.designSystem || DEFAULT_DESIGN_SYSTEM;
  const screens = params.screens || [
    {
      id: newId('scr'),
      name: 'Home',
      slug: '/',
      viewport: 'desktop',
      sections: [
        {
          id: newId('sec'),
          type: 'hero',
          title: params.name,
          subtitle: 'Crafted in RailDesign AI',
          body: params.description || 'Edit this section visually or prompt any of the six AI engines to expand this screen.',
          ctaLabel: 'Get Started',
          ctaHref: '#contact',
        },
      ],
    },
  ];
  const files = params.files || [];

  sqliteDb
    .prepare(
      `INSERT INTO projects (
        id, user_id, name, description, engine_id, provider_id, model_id, status,
        design_system_json, screens_json, files_json, generated_images_json, animation_frames_json, gif_data_url, test_report_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      params.userId,
      params.name,
      params.description || '',
      params.engineId || 'engine01_website',
      params.providerId || 'google_gemini',
      params.modelId || 'gemini-4-hydrogen',
      JSON.stringify(designSystem),
      JSON.stringify(screens),
      JSON.stringify(files),
      JSON.stringify(params.generatedImages || []),
      JSON.stringify(params.animationFrames || []),
      params.gifDataUrl ?? null,
      params.testReport ? JSON.stringify(params.testReport) : null,
      now,
      now
    );

  createProjectVersion(id, params.userId, 'Initial version', screens, files, designSystem);
  return getProjectById(id)!;
}

export function getProjectById(projectId: string): ProjectRecord | null {
  const row = sqliteDb.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId) as Record<string, unknown> | undefined;
  return row ? mapProjectRow(row) : null;
}

export function listProjectsForUser(userId: string): ProjectRecord[] {
  const rows = sqliteDb
    .prepare(`SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC`)
    .all(userId) as Record<string, unknown>[];
  return rows.map(mapProjectRow);
}

export function updateProjectRecord(
  projectId: string,
  userId: string,
  updates: Partial<{
    name: string;
    description: string;
    engineId: EngineId;
    providerId: ProviderId;
    modelId: string;
    status: 'active' | 'archived';
    designSystem: DesignSystem;
    screens: ScreenNode[];
    files: ProjectFile[];
    generatedImages: ProjectRecord['generatedImages'];
    animationFrames: ProjectRecord['animationFrames'];
    gifDataUrl: string | null;
    testReport: ProjectRecord['testReport'];
    publishedSlug: string | null;
    publishedUrl: string | null;
    publishedAt: string | null;
  }>,
  versionLabel?: string
): ProjectRecord | null {
  const existing = getProjectById(projectId);
  if (!existing || existing.userId !== userId) return null;

  const now = nowIso();
  const next = {
    name: updates.name ?? existing.name,
    description: updates.description ?? existing.description,
    engineId: updates.engineId ?? existing.engineId,
    providerId: updates.providerId ?? existing.providerId,
    modelId: updates.modelId ?? existing.modelId,
    status: updates.status ?? existing.status,
    designSystem: updates.designSystem ?? existing.designSystem,
    screens: updates.screens ?? existing.screens,
    files: updates.files ?? existing.files,
    generatedImages: updates.generatedImages ?? existing.generatedImages,
    animationFrames: updates.animationFrames ?? existing.animationFrames,
    gifDataUrl: updates.gifDataUrl !== undefined ? updates.gifDataUrl : existing.gifDataUrl,
    testReport: updates.testReport !== undefined ? updates.testReport : existing.testReport,
    publishedSlug: updates.publishedSlug !== undefined ? updates.publishedSlug : existing.publishedSlug,
    publishedUrl: updates.publishedUrl !== undefined ? updates.publishedUrl : existing.publishedUrl,
    publishedAt: updates.publishedAt !== undefined ? updates.publishedAt : existing.publishedAt,
  };

  sqliteDb
    .prepare(
      `UPDATE projects SET
        name = ?, description = ?, engine_id = ?, provider_id = ?, model_id = ?, status = ?,
        design_system_json = ?, screens_json = ?, files_json = ?,
        generated_images_json = ?, animation_frames_json = ?, gif_data_url = ?, test_report_json = ?,
        published_slug = ?, published_url = ?, published_at = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    )
    .run(
      next.name,
      next.description,
      next.engineId,
      next.providerId,
      next.modelId,
      next.status,
      JSON.stringify(next.designSystem),
      JSON.stringify(next.screens),
      JSON.stringify(next.files),
      JSON.stringify(next.generatedImages),
      JSON.stringify(next.animationFrames),
      next.gifDataUrl ?? null,
      next.testReport ? JSON.stringify(next.testReport) : null,
      next.publishedSlug ?? null,
      next.publishedUrl ?? null,
      next.publishedAt ?? null,
      now,
      projectId,
      userId
    );

  if (versionLabel) {
    createProjectVersion(projectId, userId, versionLabel, next.screens, next.files, next.designSystem);
  }

  return getProjectById(projectId);
}

export function createProjectVersion(
  projectId: string,
  userId: string,
  label: string,
  screens: ScreenNode[],
  files: ProjectFile[],
  designSystem: DesignSystem
): ProjectVersion {
  const row = sqliteDb
    .prepare(`SELECT COALESCE(MAX(version_number), 0) AS max_ver FROM project_versions WHERE project_id = ?`)
    .get(projectId) as Record<string, unknown>;
  const versionNumber = Number(row?.max_ver ?? 0) + 1;
  const id = newId('ver');
  const now = nowIso();

  sqliteDb
    .prepare(
      `INSERT INTO project_versions (id, project_id, version_number, label, screens_json, files_json, design_system_json, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      projectId,
      versionNumber,
      label,
      JSON.stringify(screens),
      JSON.stringify(files),
      JSON.stringify(designSystem),
      userId,
      now
    );

  return {
    id,
    projectId,
    versionNumber,
    label,
    screens,
    files,
    designSystem,
    createdAt: now,
  };
}

export function listProjectVersions(projectId: string): ProjectVersion[] {
  const rows = sqliteDb
    .prepare(`SELECT * FROM project_versions WHERE project_id = ? ORDER BY version_number DESC LIMIT 30`)
    .all(projectId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    projectId: String(r.project_id),
    versionNumber: Number(r.version_number),
    label: String(r.label),
    screens: JSON.parse(String(r.screens_json)),
    files: JSON.parse(String(r.files_json)),
    designSystem: JSON.parse(String(r.design_system_json)),
    createdAt: String(r.created_at),
  }));
}

// ============================================================================
// JOBS, LOGS, NOTIFICATIONS, ASSETS, SHARING, PAYMENTS, PRICING
// ============================================================================

export function addEngineLog(jobId: string, engineId: EngineId, level: 'info' | 'warn' | 'error', message: string): void {
  sqliteDb
    .prepare(`INSERT INTO engine_execution_logs (id, job_id, engine_id, level, message, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(newId('log'), jobId, engineId, level, message, nowIso());
}

export function addNotification(
  userId: string,
  category: NotificationItem['category'],
  title: string,
  message: string
): void {
  sqliteDb
    .prepare(`INSERT INTO notifications (id, user_id, category, title, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)`)
    .run(newId('notif'), userId, category, title, message, nowIso());
}

export function listNotifications(userId: string): NotificationItem[] {
  const rows = sqliteDb
    .prepare(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`)
    .all(userId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    category: String(r.category) as NotificationItem['category'],
    title: String(r.title),
    message: String(r.message),
    isRead: Boolean(r.is_read),
    createdAt: String(r.created_at),
  }));
}

export function listJobsForUser(userId: string, limit = 40): GenerationJob[] {
  const rows = sqliteDb
    .prepare(`SELECT * FROM ai_generation_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`)
    .all(userId, limit) as Record<string, unknown>[];
  return rows.map(mapJobRow);
}

export function mapJobRow(r: Record<string, unknown>): GenerationJob {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    projectId: r.project_id ? String(r.project_id) : null,
    engineId: String(r.engine_id) as EngineId,
    providerId: String(r.provider_id) as ProviderId,
    modelId: String(r.model_id),
    prompt: String(r.prompt),
    screenCount: Number(r.screen_count),
    estimatedTokens: Number(r.estimated_tokens),
    reservedTokens: Number(r.reserved_tokens),
    settledTokens: Number(r.settled_tokens),
    status: String(r.status) as GenerationJob['status'],
    resultSummary: r.result_summary ? String(r.result_summary) : null,
    errorMessage: r.error_message ? String(r.error_message) : null,
    durationMs: r.duration_ms != null ? Number(r.duration_ms) : null,
    createdAt: String(r.created_at),
    completedAt: r.completed_at ? String(r.completed_at) : null,
  };
}

export function listAssetsForUser(userId: string): AssetItem[] {
  const rows = sqliteDb
    .prepare(`SELECT * FROM assets WHERE user_id = ? ORDER BY created_at DESC`)
    .all(userId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    projectId: r.project_id ? String(r.project_id) : null,
    name: String(r.name),
    kind: String(r.kind) as AssetItem['kind'],
    mimeType: String(r.mime_type),
    dataUrl: String(r.data_url),
    sizeBytes: Number(r.size_bytes),
    createdAt: String(r.created_at),
  }));
}

export function saveAssetRecord(params: {
  userId: string;
  projectId?: string | null;
  name: string;
  kind: AssetItem['kind'];
  mimeType: string;
  dataUrl: string;
}): AssetItem {
  const id = newId('ast');
  const now = nowIso();
  const sizeBytes = Buffer.byteLength(params.dataUrl, 'utf8');
  sqliteDb
    .prepare(
      `INSERT INTO assets (id, user_id, project_id, name, kind, mime_type, data_url, size_bytes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, params.userId, params.projectId ?? null, params.name, params.kind, params.mimeType, params.dataUrl, sizeBytes, now);

  return {
    id,
    userId: params.userId,
    projectId: params.projectId ?? null,
    name: params.name,
    kind: params.kind,
    mimeType: params.mimeType,
    dataUrl: params.dataUrl,
    sizeBytes,
    createdAt: now,
  };
}

export function listPricingPlans(): PricingPlan[] {
  const rows = sqliteDb.prepare(`SELECT * FROM pricing_plans ORDER BY sort_order ASC`).all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    audience: String(r.audience),
    priceMonthlyInr: Number(r.price_monthly_inr),
    priceMonthlyUsd: Number(r.price_monthly_usd),
    tokenAllowance: Number(r.token_allowance),
    maxScreensPerJob: Number(r.max_screens_per_job),
    features: JSON.parse(String(r.features_json)),
    sortOrder: Number(r.sort_order),
  }));
}

export function listTokenPackages(): TokenPackage[] {
  const rows = sqliteDb.prepare(`SELECT * FROM token_packages ORDER BY price_inr ASC`).all() as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    tokens: Number(r.tokens),
    priceInr: Number(r.price_inr),
    priceUsd: Number(r.price_usd),
    description: String(r.description),
  }));
}

export function listPaymentsForUser(userId: string): PaymentRecord[] {
  const rows = sqliteDb
    .prepare(`SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC`)
    .all(userId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    gateway: 'cashfree',
    orderId: String(r.order_id),
    gatewayOrderId: r.gateway_order_id ? String(r.gateway_order_id) : null,
    gatewayPaymentId: r.gateway_payment_id ? String(r.gateway_payment_id) : null,
    packageId: String(r.package_id),
    tokensPurchased: Number(r.tokens_purchased),
    amountInr: Number(r.amount_inr),
    currency: String(r.currency),
    status: String(r.status) as PaymentRecord['status'],
    webhookVerified: Boolean(r.webhook_verified),
    createdAt: String(r.created_at),
  }));
}

export function listShareLinksForProject(projectId: string, userId: string): SharedProjectLink[] {
  const rows = sqliteDb
    .prepare(`SELECT * FROM shared_projects WHERE project_id = ? AND user_id = ? ORDER BY created_at DESC`)
    .all(projectId, userId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    projectId: String(r.project_id),
    shareToken: String(r.share_token),
    visibility: String(r.visibility) as 'public' | 'private',
    permission: String(r.permission) as 'view' | 'duplicate',
    revoked: Boolean(r.revoked),
    expiresAt: r.expires_at ? String(r.expires_at) : null,
    createdAt: String(r.created_at),
  }));
}

export function listLogsForJob(jobId: string): EngineLogEntry[] {
  const rows = sqliteDb
    .prepare(`SELECT * FROM engine_execution_logs WHERE job_id = ? ORDER BY created_at ASC`)
    .all(jobId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    jobId: String(r.job_id),
    engineId: String(r.engine_id) as EngineId,
    level: String(r.level) as EngineLogEntry['level'],
    message: String(r.message),
    createdAt: String(r.created_at),
  }));
}
