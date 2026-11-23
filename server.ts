import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { ENGINE_CATALOG, estimateGenerationTokens } from './src/shared/catalog.ts';
import type { EngineId, ProviderId } from './src/shared/types.ts';
import {
  buildOAuthAuthorizeUrl,
  clearSessionCookie,
  exchangeOAuthCode,
  getAppBaseUrl,
  getOAuthConfigurationStatus,
  hashPassword,
  hashToken,
  isAdminBootstrapClaimed,
  issueSession,
  resolveSessionUser,
  revokeToken,
  verifyAdminPasscode,
  verifyPassword,
} from './src/server/auth/authService.ts';
import { rateLimit, requireAdmin, requireAuth, type AuthenticatedRequest } from './src/server/auth/middleware.ts';
import {
  addNotification,
  createProjectRecord,
  createUserAccount,
  creditTokens,
  getProjectById,
  getTokenTransactions,
  getUserAuthRowByEmail,
  getUserById,
  getWallet,
  listAssetsForUser,
  listJobsForUser,
  listLogsForJob,
  listNotifications,
  listPaymentsForUser,
  listPricingPlans,
  listProjectsForUser,
  listProjectVersions,
  listShareLinksForProject,
  listTokenPackages,
  mapJobRow,
  newId,
  nowIso,
  saveAssetRecord,
  sqliteDb,
  updateProjectRecord,
} from './src/server/db/database.ts';
import { buildVerifiedProjectZip } from './src/server/engines/engine06-testing-export.ts';
import { encodeFramesToGifBuffer } from './src/server/engines/gifEncoder.ts';
import { generationQueue, runOrchestratedGeneration } from './src/server/engines/orchestrator.ts';
import {
  createCashfreeOrder,
  isCashfreeConfigured,
  verifyAndCreditCashfreeOrder,
  verifyCashfreeWebhookSignature,
} from './src/server/payments/cashfree.ts';
import { listPublicProviders } from './src/server/providers/registry.ts';
import {
  buildFullPlatformArchive,
  publishProjectHosting,
  resolvePublishedFile,
} from './src/server/services/publishingAndZip.ts';

export async function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  // Capture rawBody for payment webhook HMAC verification
  app.use(
    express.json({
      limit: '15mb',
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
      },
    })
  );

  // Security headers compatible with iframe preview & isolated child preview iframes
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // ==========================================================================
  // PUBLIC CATALOG & HEALTH
  // ==========================================================================

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'RailDesign AI',
      queue: generationQueue.getStats(),
      timestamp: nowIso(),
    });
  });

  app.get('/api/providers', (_req, res) => {
    res.json({ providers: listPublicProviders() });
  });

  app.get('/api/engines', (_req, res) => {
    res.json({ engines: ENGINE_CATALOG });
  });

  app.get('/api/pricing', (_req, res) => {
    res.json({
      plans: listPricingPlans(),
      packages: listTokenPackages(),
      gateways: {
        cashfreeConfigured: isCashfreeConfigured(),
      },
    });
  });

  app.get('/api/oauth/status', (req, res) => {
    const baseUrl = getAppBaseUrl(req);
    res.json({
      configured: getOAuthConfigurationStatus(),
      callbacks: {
        google: `${baseUrl}/auth/callback/google`,
        github: `${baseUrl}/auth/callback/github`,
      },
    });
  });

  // ==========================================================================
  // AUTHENTICATION & OAUTH
  // ==========================================================================

  const authRateLimit = rateLimit({ windowMs: 60_000, maxRequests: 60, keyPrefix: 'auth' });

  app.post('/api/auth/register', authRateLimit, (req, res) => {
    try {
      const { email, password, name } = req.body as { email?: string; password?: string; name?: string };
      if (!email || !password || !name) {
        res.status(400).json({ error: 'Name, email, and password are required.' });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters.' });
        return;
      }

      const existing = getUserAuthRowByEmail(email);
      if (existing) {
        res.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }

      const passwordHash = hashPassword(password);
      const { user, verificationToken } = createUserAccount({
        email,
        name,
        passwordHash,
        emailVerified: false,
      });

      const token = issueSession(user.id, req, res);
      res.status(201).json({
        token,
        user,
        wallet: getWallet(user.id),
        verificationToken,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Registration failed.' });
    }
  });

  app.post('/api/auth/login', authRateLimit, (req, res) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required.' });
        return;
      }

      const row = getUserAuthRowByEmail(email);
      if (!row || !row.password_hash || !verifyPassword(password, String(row.password_hash))) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      if (!row.is_active) {
        res.status(403).json({ error: 'This account has been suspended.' });
        return;
      }

      const user = getUserById(String(row.id))!;
      const token = issueSession(user.id, req, res);
      res.json({ token, user, wallet: getWallet(user.id) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Sign-in failed.' });
    }
  });

  app.post('/api/auth/logout', (req: AuthenticatedRequest, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      revokeToken(authHeader.slice(7).trim());
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({
      user: req.authUser,
      wallet: getWallet(req.authUser!.id),
    });
  });

  app.post('/api/auth/verify-email', (req, res) => {
    const { token } = req.body as { token?: string };
    if (!token) {
      res.status(400).json({ error: 'Verification token is required.' });
      return;
    }
    const row = sqliteDb
      .prepare(`SELECT id FROM users WHERE verification_token = ?`)
      .get(token) as { id: string } | undefined;
    if (!row) {
      res.status(400).json({ error: 'Invalid or expired verification token.' });
      return;
    }
    sqliteDb
      .prepare(`UPDATE users SET email_verified = 1, verification_token = NULL, updated_at = ? WHERE id = ?`)
      .run(nowIso(), row.id);
    res.json({ ok: true, message: 'Email verified successfully.' });
  });

  app.post('/api/auth/forgot-password', authRateLimit, (req, res) => {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: 'Email is required.' });
      return;
    }
    const row = getUserAuthRowByEmail(email);
    let resetToken: string | undefined;
    if (row) {
      resetToken = crypto.randomBytes(20).toString('hex');
      const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
      sqliteDb
        .prepare(`UPDATE users SET reset_token = ?, reset_token_expires_at = ?, updated_at = ? WHERE id = ?`)
        .run(resetToken, expiresAt, nowIso(), String(row.id));
    }
    res.json({
      ok: true,
      message: 'If an account matches that email, a password reset code has been generated.',
      // Returned in dev/sandbox preview when no SMTP relay is attached so reset flow is testable end-to-end
      previewResetToken: process.env.NODE_ENV !== 'production' ? resetToken : undefined,
    });
  });

  app.post('/api/auth/reset-password', authRateLimit, (req, res) => {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };
    if (!token || !newPassword || newPassword.length < 8) {
      res.status(400).json({ error: 'Valid reset token and a new password (8+ chars) are required.' });
      return;
    }
    const row = sqliteDb
      .prepare(`SELECT id, reset_token_expires_at FROM users WHERE reset_token = ?`)
      .get(token) as { id: string; reset_token_expires_at: string } | undefined;

    if (!row || new Date(row.reset_token_expires_at).getTime() < Date.now()) {
      res.status(400).json({ error: 'Invalid or expired password reset token.' });
      return;
    }

    sqliteDb
      .prepare(`UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL, updated_at = ? WHERE id = ?`)
      .run(hashPassword(newPassword), nowIso(), row.id);
    res.json({ ok: true, message: 'Password updated. You may now sign in.' });
  });

  app.get('/api/auth/oauth/:provider/url', (req, res) => {
    const provider = req.params.provider;
    if (provider !== 'google' && provider !== 'github') {
      res.status(400).json({ error: 'Unsupported OAuth provider.' });
      return;
    }
    try {
      const url = buildOAuthAuthorizeUrl(provider, req);
      res.json({ url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OAuth setup error';
      res.status(400).json({
        error: msg,
        callbacks: {
          google: `${getAppBaseUrl(req)}/auth/callback/google`,
          github: `${getAppBaseUrl(req)}/auth/callback/github`,
        },
      });
    }
  });

  const handleOAuthCallback = async (provider: 'google' | 'github', req: express.Request, res: express.Response) => {
    try {
      const code = String(req.query.code || '');
      if (!code) {
        res.status(400).send('<p>Authorization code missing.</p>');
        return;
      }
      const { token, user } = await exchangeOAuthCode(provider, code, req);
      res.send(`<!doctype html>
<html>
<body style="font-family:system-ui,sans-serif;background:#090B10;color:#F8FAFC;display:grid;place-items:center;min-height:100vh;">
  <p>Signed in as ${user.email.replace(/</g, '&lt;')}. Returning to RailDesign AI...</p>
  <script>
    if (window.opener) {
      window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', token: ${JSON.stringify(token)}, user: ${JSON.stringify(user)} }, '*');
      window.close();
    } else {
      window.location.href = '/';
    }
  </script>
</body>
</html>`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OAuth callback failed';
      res.status(500).send(`<!doctype html><html><body><p>Authentication error: ${msg.replace(/</g, '&lt;')}</p></body></html>`);
    }
  };

  app.get(['/auth/callback/google', '/auth/callback/google/'], (req, res) => {
    void handleOAuthCallback('google', req, res);
  });
  app.get(['/auth/callback/github', '/auth/callback/github/'], (req, res) => {
    void handleOAuthCallback('github', req, res);
  });

  // ==========================================================================
  // USER PROFILE, NOTIFICATIONS & SUPPORT
  // ==========================================================================

  app.patch('/api/user/profile', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const { name, company, jobTitle, bio, themePreference, preferredProvider, preferredModel } = req.body as Record<
      string,
      string | undefined
    >;
    const now = nowIso();

    if (name || preferredProvider || preferredModel) {
      sqliteDb
        .prepare(
          `UPDATE users SET
            name = COALESCE(?, name),
            preferred_provider = COALESCE(?, preferred_provider),
            preferred_model = COALESCE(?, preferred_model),
            updated_at = ?
           WHERE id = ?`
        )
        .run(name || null, preferredProvider || null, preferredModel || null, now, userId);
    }

    sqliteDb
      .prepare(
        `UPDATE profiles SET
          company = COALESCE(?, company),
          job_title = COALESCE(?, job_title),
          bio = COALESCE(?, bio),
          theme_preference = COALESCE(?, theme_preference),
          updated_at = ?
         WHERE user_id = ?`
      )
      .run(company ?? null, jobTitle ?? null, bio ?? null, themePreference ?? null, now, userId);

    res.json({ user: getUserById(userId) });
  });

  app.patch('/api/user/settings', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const incoming = req.body as Record<string, unknown>;
    const existing = getUserById(userId)?.settings || {
      defaultViewport: 'desktop',
      snapToGrid: true,
      autoSave: true,
      defaultScreenCount: 3,
      defaultExportFormat: 'zip',
      notifyGeneration: true,
      notifyPayments: true,
      notifyDeployments: true,
      notifySecurity: true,
    };
    const merged = {
      ...existing,
      defaultViewport:
        incoming.defaultViewport === 'tablet' || incoming.defaultViewport === 'mobile'
          ? incoming.defaultViewport
          : incoming.defaultViewport === 'desktop'
          ? 'desktop'
          : existing.defaultViewport,
      snapToGrid: typeof incoming.snapToGrid === 'boolean' ? incoming.snapToGrid : existing.snapToGrid,
      autoSave: typeof incoming.autoSave === 'boolean' ? incoming.autoSave : existing.autoSave,
      defaultScreenCount:
        typeof incoming.defaultScreenCount === 'number'
          ? Math.max(1, Math.min(15, incoming.defaultScreenCount))
          : existing.defaultScreenCount,
      defaultExportFormat:
        incoming.defaultExportFormat === 'png' ||
        incoming.defaultExportFormat === 'svg' ||
        incoming.defaultExportFormat === 'gif' ||
        incoming.defaultExportFormat === 'zip'
          ? incoming.defaultExportFormat
          : existing.defaultExportFormat,
      notifyGeneration:
        typeof incoming.notifyGeneration === 'boolean' ? incoming.notifyGeneration : existing.notifyGeneration,
      notifyPayments: typeof incoming.notifyPayments === 'boolean' ? incoming.notifyPayments : existing.notifyPayments,
      notifyDeployments:
        typeof incoming.notifyDeployments === 'boolean' ? incoming.notifyDeployments : existing.notifyDeployments,
      notifySecurity: typeof incoming.notifySecurity === 'boolean' ? incoming.notifySecurity : existing.notifySecurity,
    };

    sqliteDb
      .prepare(`UPDATE profiles SET settings_json = ?, updated_at = ? WHERE user_id = ?`)
      .run(JSON.stringify(merged), nowIso(), userId);

    res.json({ user: getUserById(userId) });
  });

  app.get('/api/user/integrations-status', requireAuth, (req: AuthenticatedRequest, res) => {
    const baseUrl = getAppBaseUrl(req);
    res.json({
      providers: listPublicProviders(),
      oauth: getOAuthConfigurationStatus(),
      callbacks: {
        google: `${baseUrl}/auth/callback/google`,
        github: `${baseUrl}/auth/callback/github`,
      },
      cashfree: {
        configured: isCashfreeConfigured(),
        env: process.env.CASHFREE_ENV === 'production' ? 'production' : 'sandbox',
        webhookUrl: `${baseUrl}/api/webhooks/cashfree`,
      },
      hosting: {
        managedStatic: true,
        vercelConfigured: Boolean(process.env.VERCEL_TOKEN),
      },
    });
  });

  app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters.' });
      return;
    }
    const row = sqliteDb
      .prepare(`SELECT password_hash FROM users WHERE id = ?`)
      .get(userId) as { password_hash: string | null } | undefined;
    if (!row) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    if (row.password_hash) {
      if (!currentPassword || !verifyPassword(currentPassword, row.password_hash)) {
        res.status(401).json({ error: 'Current password is incorrect.' });
        return;
      }
    }
    sqliteDb
      .prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`)
      .run(hashPassword(newPassword), nowIso(), userId);
    addNotification(userId, 'system', 'Password Updated', 'Your account password was updated successfully.');
    res.json({ ok: true, message: 'Password updated successfully.' });
  });

  app.post('/api/auth/revoke-other-sessions', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const resolved = resolveSessionUser(req);
    const currentHash = resolved ? hashToken(resolved.token) : '';
    const info = sqliteDb
      .prepare(`DELETE FROM sessions WHERE user_id = ? AND token_hash != ?`)
      .run(userId, currentHash);
    res.json({ ok: true, revokedCount: Number(info.changes || 0) });
  });

  app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ notifications: listNotifications(req.authUser!.id) });
  });

  app.post('/api/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res) => {
    sqliteDb.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`).run(req.authUser!.id);
    res.json({ ok: true });
  });

  app.post('/api/support', (req: AuthenticatedRequest, res) => {
    const { email, category, subject, message } = req.body as {
      email?: string;
      category?: string;
      subject?: string;
      message?: string;
    };
    if (!email || !subject || !message) {
      res.status(400).json({ error: 'Email, subject, and message are required.' });
      return;
    }
    sqliteDb
      .prepare(
        `INSERT INTO support_tickets (id, user_id, email, category, subject, message, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`
      )
      .run(newId('tkt'), req.authUser?.id ?? null, email, category || 'support', subject, message, nowIso());
    res.status(201).json({ ok: true, message: 'Support request logged. Our team will respond shortly.' });
  });

  // ==========================================================================
  // CENTRAL ORCHESTRATION & SIX AI ENGINES
  // ==========================================================================

  app.post('/api/generate/estimate', (req, res) => {
    const { engineId, screenCount, prompt, hasReferenceImage } = req.body as {
      engineId?: EngineId;
      screenCount?: number;
      prompt?: string;
      hasReferenceImage?: boolean;
    };
    const tokens = estimateGenerationTokens({
      engineId: engineId || 'engine01_website',
      screenCount: Number(screenCount || 3),
      prompt: String(prompt || ''),
      hasReferenceImage: Boolean(hasReferenceImage),
    });
    res.json({ estimatedTokens: tokens });
  });

  const genRateLimit = rateLimit({ windowMs: 60_000, maxRequests: 60, keyPrefix: 'gen' });

  app.post('/api/generate', requireAuth, genRateLimit, async (req: AuthenticatedRequest, res) => {
    try {
      const { projectId, engineId, providerId, modelId, prompt, screenCount, referenceImageDataUrl } = req.body as {
        projectId?: string;
        engineId?: EngineId | 'auto';
        providerId?: ProviderId;
        modelId?: string;
        prompt?: string;
        screenCount?: number;
        referenceImageDataUrl?: string | null;
      };

      if (!prompt || !prompt.trim()) {
        res.status(400).json({ error: 'Please enter a design or engineering prompt.' });
        return;
      }

      const result = await runOrchestratedGeneration({
        userId: req.authUser!.id,
        projectId,
        engineId: engineId || 'auto',
        providerId: providerId || req.authUser!.preferredProvider,
        modelId: modelId || req.authUser!.preferredModel,
        prompt: prompt.trim(),
        screenCount: Number(screenCount || 3),
        referenceImageDataUrl,
      });

      res.json({
        job: result.job,
        project: result.project,
        wallet: getWallet(req.authUser!.id),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed.';
      const status = msg.startsWith('INSUFFICIENT_TOKENS') ? 402 : 500;
      res.status(status).json({
        error: msg,
        wallet: getWallet(req.authUser!.id),
      });
    }
  });

  app.get('/api/jobs', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ jobs: listJobsForUser(req.authUser!.id) });
  });

  app.get('/api/jobs/:jobId/logs', requireAuth, (req: AuthenticatedRequest, res) => {
    const jobRow = sqliteDb
      .prepare(`SELECT * FROM ai_generation_jobs WHERE id = ? AND user_id = ?`)
      .get(req.params.jobId, req.authUser!.id) as Record<string, unknown> | undefined;
    if (!jobRow) {
      res.status(404).json({ error: 'Generation job not found.' });
      return;
    }
    res.json({
      job: mapJobRow(jobRow),
      logs: listLogsForJob(req.params.jobId),
    });
  });

  // ==========================================================================
  // PROJECTS, VERSIONS, EXPORT, SHARING & PUBLISHING
  // ==========================================================================

  app.get('/api/projects', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ projects: listProjectsForUser(req.authUser!.id) });
  });

  app.post('/api/projects', requireAuth, (req: AuthenticatedRequest, res) => {
    const { name, description, engineId, providerId, modelId } = req.body as {
      name?: string;
      description?: string;
      engineId?: EngineId;
      providerId?: ProviderId;
      modelId?: string;
    };
    const project = createProjectRecord({
      userId: req.authUser!.id,
      name: name?.trim() || 'Untitled Project',
      description: description || '',
      engineId: engineId || 'engine01_website',
      providerId: providerId || req.authUser!.preferredProvider,
      modelId: modelId || req.authUser!.preferredModel,
    });
    res.status(201).json({ project });
  });

  app.get('/api/projects/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectById(req.params.id);
    if (!project || project.userId !== req.authUser!.id) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    res.json({
      project,
      versions: listProjectVersions(project.id),
      shares: listShareLinksForProject(project.id, req.authUser!.id),
    });
  });

  app.patch('/api/projects/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const { versionLabel, ...updates } = req.body as Record<string, unknown>;
    const updated = updateProjectRecord(req.params.id, req.authUser!.id, updates, versionLabel ? String(versionLabel) : undefined);
    if (!updated) {
      res.status(404).json({ error: 'Project not found or permission denied.' });
      return;
    }
    res.json({
      project: updated,
      versions: listProjectVersions(updated.id),
    });
  });

  app.post('/api/projects/:id/duplicate', requireAuth, (req: AuthenticatedRequest, res) => {
    const src = getProjectById(req.params.id);
    if (!src || src.userId !== req.authUser!.id) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    const copy = createProjectRecord({
      userId: req.authUser!.id,
      name: `${src.name} (Copy)`,
      description: src.description,
      engineId: src.engineId,
      providerId: src.providerId,
      modelId: src.modelId,
      designSystem: src.designSystem,
      screens: src.screens,
      files: src.files,
      generatedImages: src.generatedImages,
      animationFrames: src.animationFrames,
      gifDataUrl: src.gifDataUrl,
    });
    res.status(201).json({ project: copy });
  });

  app.delete('/api/projects/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const info = sqliteDb
      .prepare(`DELETE FROM projects WHERE id = ? AND user_id = ?`)
      .run(req.params.id, req.authUser!.id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/projects/:id/versions', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectById(req.params.id);
    if (!project || project.userId !== req.authUser!.id) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    res.json({ versions: listProjectVersions(project.id) });
  });

  app.post('/api/projects/:id/versions/:versionId/restore', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectById(req.params.id);
    if (!project || project.userId !== req.authUser!.id) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    const ver = sqliteDb
      .prepare(`SELECT * FROM project_versions WHERE id = ? AND project_id = ?`)
      .get(req.params.versionId, project.id) as Record<string, unknown> | undefined;
    if (!ver) {
      res.status(404).json({ error: 'Version snapshot not found.' });
      return;
    }
    const restored = updateProjectRecord(
      project.id,
      req.authUser!.id,
      {
        screens: JSON.parse(String(ver.screens_json)),
        files: JSON.parse(String(ver.files_json)),
        designSystem: JSON.parse(String(ver.design_system_json)),
      },
      `Restored v${ver.version_number}`
    );
    res.json({ project: restored, versions: listProjectVersions(project.id) });
  });

  app.post('/api/projects/:id/export-zip', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const project = getProjectById(req.params.id);
      if (!project || project.userId !== req.authUser!.id) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }
      const zipBuffer = await buildVerifiedProjectZip(project);
      const safeName = project.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'project';
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);
      res.send(zipBuffer);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'ZIP export failed.' });
    }
  });

  app.post('/api/projects/:id/export-gif', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectById(req.params.id);
    if (!project || project.userId !== req.authUser!.id) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    const frames = req.body?.frames || project.animationFrames;
    const gifBuf = encodeFramesToGifBuffer(frames, 400, 220);
    const dataUrl = `data:image/gif;base64,${gifBuf.toString('base64')}`;
    updateProjectRecord(project.id, req.authUser!.id, {
      animationFrames: frames,
      gifDataUrl: dataUrl,
    });
    res.json({ gifDataUrl: dataUrl, sizeBytes: gifBuf.length });
  });

  app.post('/api/projects/:id/share', requireAuth, (req: AuthenticatedRequest, res) => {
    const project = getProjectById(req.params.id);
    if (!project || project.userId !== req.authUser!.id) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    const { visibility, permission, expiresInHours } = req.body as {
      visibility?: 'public' | 'private';
      permission?: 'view' | 'duplicate';
      expiresInHours?: number;
    };
    const shareToken = crypto.randomBytes(16).toString('hex');
    const id = newId('shr');
    const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString() : null;
    sqliteDb
      .prepare(
        `INSERT INTO shared_projects (id, project_id, user_id, share_token, visibility, permission, revoked, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
      )
      .run(id, project.id, req.authUser!.id, shareToken, visibility || 'public', permission || 'view', expiresAt, nowIso());

    res.status(201).json({
      shareUrl: `${getAppBaseUrl(req)}/?share=${shareToken}`,
      shares: listShareLinksForProject(project.id, req.authUser!.id),
    });
  });

  app.delete('/api/shares/:shareId', requireAuth, (req: AuthenticatedRequest, res) => {
    const info = sqliteDb
      .prepare(`UPDATE shared_projects SET revoked = 1 WHERE id = ? AND user_id = ?`)
      .run(req.params.shareId, req.authUser!.id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Share link not found.' });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/share/:token', (req, res) => {
    const share = sqliteDb
      .prepare(`SELECT * FROM shared_projects WHERE share_token = ?`)
      .get(req.params.token) as Record<string, unknown> | undefined;

    if (!share || share.revoked) {
      res.status(404).json({ error: 'This shared project link is invalid or has been revoked.' });
      return;
    }
    if (share.expires_at && new Date(String(share.expires_at)).getTime() < Date.now()) {
      res.status(410).json({ error: 'This shared project link has expired.' });
      return;
    }

    const project = getProjectById(String(share.project_id));
    if (!project) {
      res.status(404).json({ error: 'Shared project no longer exists.' });
      return;
    }

    res.json({
      share: {
        visibility: share.visibility,
        permission: share.permission,
        expiresAt: share.expires_at,
      },
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        engineId: project.engineId,
        designSystem: project.designSystem,
        screens: project.screens,
        files: project.files,
        gifDataUrl: project.gifDataUrl,
        generatedImages: project.generatedImages,
      },
    });
  });

  app.post('/api/projects/:id/publish', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const project = getProjectById(req.params.id);
      if (!project || project.userId !== req.authUser!.id) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }
      const { target, customSlug } = req.body as {
        target?: 'raildesign_static' | 'vercel';
        customSlug?: string;
      };
      const result = await publishProjectHosting({
        project,
        userId: req.authUser!.id,
        baseUrl: getAppBaseUrl(req),
        target: target || 'raildesign_static',
        customSlug,
      });
      res.json({
        ...result,
        project: getProjectById(project.id),
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Publishing failed.' });
    }
  });

  app.get('/published/:slug/*', (req, res) => {
    const rest = (req.params as Record<string, string>)['0'] || 'index.html';
    const filePath = resolvePublishedFile(req.params.slug, rest);
    if (!filePath) {
      res.status(404).send('Published site not found.');
      return;
    }
    res.sendFile(filePath);
  });

  app.get('/published/:slug', (req, res) => {
    const filePath = resolvePublishedFile(req.params.slug, 'index.html');
    if (!filePath) {
      res.status(404).send('Published site not found.');
      return;
    }
    res.sendFile(filePath);
  });

  // ==========================================================================
  // ASSET LIBRARY
  // ==========================================================================

  app.get('/api/assets', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ assets: listAssetsForUser(req.authUser!.id) });
  });

  app.post('/api/assets', requireAuth, (req: AuthenticatedRequest, res) => {
    const { name, kind, mimeType, dataUrl, projectId } = req.body as {
      name?: string;
      kind?: 'uploaded' | 'generated' | 'gif' | 'logo' | 'icon';
      mimeType?: string;
      dataUrl?: string;
      projectId?: string;
    };
    if (!name || !dataUrl || !dataUrl.startsWith('data:')) {
      res.status(400).json({ error: 'Valid asset name and base64 data URL are required.' });
      return;
    }
    const asset = saveAssetRecord({
      userId: req.authUser!.id,
      projectId: projectId ?? null,
      name,
      kind: kind || 'uploaded',
      mimeType: mimeType || 'image/png',
      dataUrl,
    });
    res.status(201).json({ asset });
  });

  app.patch('/api/assets/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const { name } = req.body as { name?: string };
    if (!name) {
      res.status(400).json({ error: 'Asset name is required.' });
      return;
    }
    const info = sqliteDb
      .prepare(`UPDATE assets SET name = ? WHERE id = ? AND user_id = ?`)
      .run(name, req.params.id, req.authUser!.id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Asset not found.' });
      return;
    }
    res.json({ ok: true });
  });

  app.delete('/api/assets/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const info = sqliteDb
      .prepare(`DELETE FROM assets WHERE id = ? AND user_id = ?`)
      .run(req.params.id, req.authUser!.id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Asset not found.' });
      return;
    }
    res.json({ ok: true });
  });

  // ==========================================================================
  // TOKEN WALLET & CASHFREE PAYMENTS
  // ==========================================================================

  app.get('/api/wallet', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({
      wallet: getWallet(req.authUser!.id),
      transactions: getTokenTransactions(req.authUser!.id),
      payments: listPaymentsForUser(req.authUser!.id),
    });
  });

  app.post('/api/payments/cashfree/create-order', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { packageId } = req.body as { packageId?: string };
      const pkg = listTokenPackages().find((p) => p.id === packageId);
      if (!pkg) {
        res.status(400).json({ error: 'Invalid token package.' });
        return;
      }
      const order = await createCashfreeOrder({
        user: req.authUser!,
        pkg,
        returnUrl: `${getAppBaseUrl(req)}/`,
      });
      res.json({ order, package: pkg });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Order creation failed.' });
    }
  });

  app.post('/api/payments/cashfree/verify', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { orderId, action, sandboxVerificationToken } = req.body as {
        orderId?: string;
        action?: 'confirm' | 'fail' | 'cancel';
        sandboxVerificationToken?: string;
      };
      if (!orderId) {
        res.status(400).json({ error: 'Order ID is required.' });
        return;
      }
      const result = await verifyAndCreditCashfreeOrder({
        orderId,
        userId: req.authUser!.id,
        action: action || 'confirm',
        sandboxVerificationToken,
      });
      res.json({
        ...result,
        wallet: getWallet(req.authUser!.id),
        payments: listPaymentsForUser(req.authUser!.id),
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Payment verification failed.' });
    }
  });

  app.post('/api/webhooks/cashfree', (req, res) => {
    const rawBody = (req as express.Request & { rawBody?: string }).rawBody || JSON.stringify(req.body);
    const sig = req.get('x-webhook-signature');
    const ts = req.get('x-webhook-timestamp');

    if (!verifyCashfreeWebhookSignature(rawBody, ts, sig)) {
      res.status(401).json({ error: 'Invalid Cashfree webhook signature.' });
      return;
    }

    const orderId = req.body?.data?.order?.order_id;
    const orderStatus = req.body?.data?.payment?.payment_status;
    if (orderId && orderStatus === 'SUCCESS') {
      const payment = sqliteDb
        .prepare(`SELECT * FROM payments WHERE order_id = ?`)
        .get(orderId) as Record<string, unknown> | undefined;
      if (payment && payment.status !== 'paid') {
        sqliteDb
          .prepare(`UPDATE payments SET status = 'paid', webhook_verified = 1, updated_at = ? WHERE order_id = ?`)
          .run(nowIso(), orderId);
        creditTokens(
          String(payment.user_id),
          Number(payment.tokens_purchased),
          'purchase',
          `Cashfree webhook verified credit (${orderId})`,
          `pay_${orderId}`
        );
        addNotification(
          String(payment.user_id),
          'payment',
          'Payment Verified',
          `+${payment.tokens_purchased} tokens added to your wallet.`
        );
      }
    }
    res.json({ received: true });
  });

  // ==========================================================================
  // ADMIN CONTROL CENTER (RBAC + FIRST-RUN CLAIM)
  // ==========================================================================

  app.get('/api/admin/bootstrap-status', requireAuth, (req: AuthenticatedRequest, res) => {
    const adminExists = Boolean(
      sqliteDb.prepare(`SELECT id FROM users WHERE role IN ('admin', 'super_admin') LIMIT 1`).get()
    );
    res.json({
      passcodeConfigured: isAdminBootstrapClaimed(),
      adminExists,
      isCurrentUserAdmin: req.authUser!.role === 'admin' || req.authUser!.role === 'super_admin',
    });
  });

  app.post('/api/admin/claim', requireAuth, (req: AuthenticatedRequest, res) => {
    const { passcode } = req.body as { passcode?: string };
    if (!passcode || passcode.length < 6) {
      res.status(400).json({ error: 'Passcode must be at least 6 characters.' });
      return;
    }

    const claimed = isAdminBootstrapClaimed();
    if (!claimed) {
      // First-run atomic bootstrap: claim passcode and grant caller admin role
      const hash = hashPassword(passcode);
      sqliteDb
        .prepare(
          `INSERT INTO system_settings (key, value, updated_at) VALUES ('admin_passcode_hash', ?, ?)
           ON CONFLICT(key) DO NOTHING`
        )
        .run(hash, nowIso());
      sqliteDb.prepare(`UPDATE users SET role = 'super_admin', updated_at = ? WHERE id = ?`).run(nowIso(), req.authUser!.id);
      sqliteDb
        .prepare(`INSERT OR REPLACE INTO admin_roles (user_id, role_name, granted_by, created_at) VALUES (?, 'super_admin', 'bootstrap', ?)`)
        .run(req.authUser!.id, nowIso());
      res.json({ user: getUserById(req.authUser!.id) });
      return;
    }

    if (!verifyAdminPasscode(passcode)) {
      res.status(403).json({ error: 'Invalid admin passcode.' });
      return;
    }

    sqliteDb.prepare(`UPDATE users SET role = 'admin', updated_at = ? WHERE id = ?`).run(nowIso(), req.authUser!.id);
    sqliteDb
      .prepare(`INSERT OR REPLACE INTO admin_roles (user_id, role_name, granted_by, created_at) VALUES (?, 'admin', 'passcode', ?)`)
      .run(req.authUser!.id, nowIso());
    res.json({ user: getUserById(req.authUser!.id) });
  });

  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const users = sqliteDb
      .prepare(
        `SELECT u.id, u.email, u.name, u.role, u.is_active, u.preferred_provider, u.created_at, w.available_tokens, w.used_tokens
         FROM users u LEFT JOIN token_wallets w ON u.id = w.user_id ORDER BY u.created_at DESC`
      )
      .all();
    const projects = sqliteDb
      .prepare(`SELECT id, user_id, name, engine_id, provider_id, status, published_url, updated_at FROM projects ORDER BY updated_at DESC LIMIT 100`)
      .all();
    const jobs = sqliteDb
      .prepare(`SELECT * FROM ai_generation_jobs ORDER BY created_at DESC LIMIT 100`)
      .all();
    const payments = sqliteDb.prepare(`SELECT * FROM payments ORDER BY created_at DESC LIMIT 100`).all();
    const transactions = sqliteDb
      .prepare(`SELECT * FROM token_transactions ORDER BY created_at DESC LIMIT 100`)
      .all();
    const logs = sqliteDb
      .prepare(`SELECT * FROM engine_execution_logs ORDER BY created_at DESC LIMIT 120`)
      .all();
    const tickets = sqliteDb
      .prepare(`SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 50`)
      .all();

    res.json({
      stats: {
        totalUsers: users.length,
        activeUsers: users.filter((u: Record<string, unknown>) => Boolean(u.is_active)).length,
        totalProjects: projects.length,
        totalJobs: jobs.length,
        failedJobs: jobs.filter((j: Record<string, unknown>) => j.status === 'failed' || j.status === 'refunded').length,
      },
      queue: generationQueue.getStats(),
      providers: listPublicProviders(),
      plans: listPricingPlans(),
      packages: listTokenPackages(),
      users,
      projects,
      jobs,
      payments,
      transactions,
      logs,
      tickets,
    });
  });

  app.post('/api/admin/tokens/adjust', requireAdmin, (req: AuthenticatedRequest, res) => {
    const { userId, amount, reason } = req.body as { userId?: string; amount?: number; reason?: string };
    if (!userId || typeof amount !== 'number' || !Number.isFinite(amount) || amount === 0) {
      res.status(400).json({ error: 'Target userId and non-zero numeric amount are required.' });
      return;
    }
    const wallet = creditTokens(
      userId,
      Math.trunc(amount),
      'admin_adjust',
      reason || `Admin adjustment by ${req.authUser!.email}`
    );
    addNotification(userId, 'wallet', 'Token Balance Adjusted', `Admin updated your balance by ${amount > 0 ? `+${amount}` : amount} tokens.`);
    res.json({ wallet });
  });

  app.patch('/api/admin/users/:id/role', requireAdmin, (req, res) => {
    const { role, isActive } = req.body as { role?: string; isActive?: boolean };
    sqliteDb
      .prepare(`UPDATE users SET role = COALESCE(?, role), is_active = COALESCE(?, is_active), updated_at = ? WHERE id = ?`)
      .run(role ?? null, isActive === undefined ? null : isActive ? 1 : 0, nowIso(), req.params.id);
    res.json({ ok: true });
  });

  app.put('/api/admin/pricing/:planId', requireAdmin, (req, res) => {
    const { priceMonthlyInr, priceMonthlyUsd, tokenAllowance, maxScreensPerJob } = req.body as Record<string, number>;
    sqliteDb
      .prepare(
        `UPDATE pricing_plans SET
          price_monthly_inr = COALESCE(?, price_monthly_inr),
          price_monthly_usd = COALESCE(?, price_monthly_usd),
          token_allowance = COALESCE(?, token_allowance),
          max_screens_per_job = COALESCE(?, max_screens_per_job)
         WHERE id = ?`
      )
      .run(priceMonthlyInr ?? null, priceMonthlyUsd ?? null, tokenAllowance ?? null, maxScreensPerJob ?? null, req.params.planId);
    res.json({ plans: listPricingPlans() });
  });

  app.put('/api/admin/packages/:pkgId', requireAdmin, (req, res) => {
    const { tokens, priceInr, priceUsd } = req.body as Record<string, number>;
    sqliteDb
      .prepare(
        `UPDATE token_packages SET
          tokens = COALESCE(?, tokens),
          price_inr = COALESCE(?, price_inr),
          price_usd = COALESCE(?, price_usd)
         WHERE id = ?`
      )
      .run(tokens ?? null, priceInr ?? null, priceUsd ?? null, req.params.pkgId);
    res.json({ packages: listTokenPackages() });
  });

  // ==========================================================================
  // COMPLETE PLATFORM SOURCE ARCHIVE DOWNLOAD
  // ==========================================================================

  app.get('/api/platform/download-zip', async (_req, res) => {
    try {
      const { buffer, fileCount } = await buildFullPlatformArchive();
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="raildesign-ai-platform.zip"');
      res.setHeader('X-Archive-Files', String(fileCount));
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Archive build failed.' });
    }
  });

  // ==========================================================================
  // VITE MIDDLEWARE (DEV) OR STATIC ASSETS (PROD)
  // ==========================================================================

  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist'))) {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else if (process.env.NODE_ENV !== 'test') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.NODE_ENV === 'production' ? Number(process.env.PORT || 3000) : 3000;
  createApp().then((app) => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`RailDesign AI running on http://0.0.0.0:${PORT}`);
    });
  });
}
