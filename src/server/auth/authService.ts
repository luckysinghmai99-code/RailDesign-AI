import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import {
  createSessionRecord,
  createUserAccount,
  deleteSessionByTokenHash,
  getSessionByTokenHash,
  getUserAuthRowByEmail,
  getUserById,
  nowIso,
  sqliteDb,
} from '../db/database.ts';
import type { UserProfile } from '../../shared/types.ts';

// Runtime-only signing secret fallback (never hardcoded secret in .env.example)
const RUNTIME_SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function hashToken(token: string): string {
  return crypto.createHmac('sha256', RUNTIME_SESSION_SECRET).update(token).digest('hex');
}

export function issueSession(userId: string, req: Request, res?: Response): string {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  createSessionRecord(userId, tokenHash, req.ip, req.get('user-agent') || '');

  if (res) {
    res.setHeader(
      'Set-Cookie',
      `rd_session=${rawToken}; Path=/; Max-Age=${7 * 86400}; HttpOnly; Secure; SameSite=None; Partitioned`
    );
  }
  return rawToken;
}

export function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    'rd_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None; Partitioned'
  );
}

export function revokeToken(rawToken: string): void {
  deleteSessionByTokenHash(hashToken(rawToken));
}

export function resolveSessionUser(req: Request): { user: UserProfile; token: string } | null {
  let token: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.headers.cookie) {
    const match = req.headers.cookie
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('rd_session='));
    if (match) {
      token = decodeURIComponent(match.slice('rd_session='.length));
    }
  }

  if (!token) return null;
  const sess = getSessionByTokenHash(hashToken(token));
  if (!sess) return null;
  const user = getUserById(sess.userId);
  if (!user) return null;
  return { user, token };
}

export function getAppBaseUrl(req?: Request): string {
  if (process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL') {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  if (req) {
    const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
    const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
    return `${proto}://${host}`;
  }
  return 'http://localhost:3000';
}

export function getOAuthConfigurationStatus() {
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  };
}

export function buildOAuthAuthorizeUrl(provider: 'google' | 'github', req: Request): string {
  const baseUrl = getAppBaseUrl(req);
  const state = crypto.randomBytes(16).toString('hex');

  if (provider === 'google') {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error('GOOGLE_OAUTH_NOT_CONFIGURED');
    }
    const redirectUri = `${baseUrl}/auth/callback/google`;
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    throw new Error('GITHUB_OAUTH_NOT_CONFIGURED');
  }
  const redirectUri = `${baseUrl}/auth/callback/github`;
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeOAuthCode(
  provider: 'google' | 'github',
  code: string,
  req: Request
): Promise<{ user: UserProfile; token: string }> {
  const baseUrl = getAppBaseUrl(req);
  let email = '';
  let name = '';
  let providerId = '';

  if (provider === 'google') {
    const redirectUri = `${baseUrl}/auth/callback/google`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error || 'Google OAuth token exchange failed');
    }
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = (await profileRes.json()) as { id: string; email: string; name?: string };
    if (!profile.email) throw new Error('Google account has no email');
    email = profile.email;
    name = profile.name || profile.email.split('@')[0];
    providerId = String(profile.id);
  } else {
    const redirectUri = `${baseUrl}/auth/callback/github`;
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID!,
        client_secret: process.env.GITHUB_CLIENT_SECRET!,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error || 'GitHub OAuth token exchange failed');
    }
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'User-Agent': 'RailDesign-AI',
      },
    });
    const ghUser = (await userRes.json()) as { id: number; name?: string; login: string; email?: string };
    let resolvedEmail = ghUser.email || '';
    if (!resolvedEmail) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'User-Agent': 'RailDesign-AI',
        },
      });
      const emails = (await emailsRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
      const primary = emails.find((e) => e.primary && e.verified) || emails[0];
      resolvedEmail = primary?.email || `${ghUser.login}@users.noreply.github.com`;
    }
    email = resolvedEmail;
    name = ghUser.name || ghUser.login;
    providerId = String(ghUser.id);
  }

  const existing = getUserAuthRowByEmail(email);
  let user: UserProfile;
  if (existing) {
    sqliteDb
      .prepare(`UPDATE users SET oauth_provider = ?, oauth_provider_id = ?, email_verified = 1, updated_at = ? WHERE id = ?`)
      .run(provider, providerId, nowIso(), String(existing.id));
    user = getUserById(String(existing.id))!;
  } else {
    const created = createUserAccount({
      email,
      name,
      oauthProvider: provider,
      oauthProviderId: providerId,
      emailVerified: true,
    });
    user = created.user;
  }

  const token = issueSession(user.id, req);
  return { user, token };
}

export function isAdminBootstrapClaimed(): boolean {
  if (process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0) {
    return true;
  }
  const row = sqliteDb.prepare(`SELECT value FROM system_settings WHERE key = 'admin_passcode_hash'`).get() as
    | { value: string }
    | undefined;
  return Boolean(row?.value);
}

export function verifyAdminPasscode(passcode: string): boolean {
  if (process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0) {
    const a = Buffer.from(passcode);
    const b = Buffer.from(process.env.ADMIN_PASSCODE.trim());
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  const row = sqliteDb.prepare(`SELECT value FROM system_settings WHERE key = 'admin_passcode_hash'`).get() as
    | { value: string }
    | undefined;
  if (!row?.value) return false;
  return verifyPassword(passcode, row.value);
}
