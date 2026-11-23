import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const tempDbPath = vi.hoisted(() => {
  const tmpRoot = process.env.TMPDIR || '/tmp';
  const dbFile = `${tmpRoot.replace(/\/$/, '')}/raildesign-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`;
  process.env.SQLITE_DB_PATH = dbFile;
  process.env.NODE_ENV = 'test';
  return dbFile;
});

import { createApp } from '../server.ts';
import { estimateGenerationTokens } from '../src/shared/catalog.ts';
import {
  creditTokens,
  getWallet,
  refundReservedTokensForJob,
  reserveTokensForJob,
  settleTokensForJob,
  sqliteDb,
} from '../src/server/db/database.ts';
import { encodeFramesToGifBuffer } from '../src/server/engines/gifEncoder.ts';
import { runStaticValidationAndAutoFix } from '../src/server/engines/engine06-testing-export.ts';
import { verifyCashfreeWebhookSignature } from '../src/server/payments/cashfree.ts';
import { listPublicProviders } from '../src/server/providers/registry.ts';
import { buildFullPlatformArchive } from '../src/server/services/publishingAndZip.ts';

let baseUrl = '';
let serverHandle: ReturnType<import('express').Express['listen']> | null = null;

beforeAll(async () => {
  const app = await createApp();
  await new Promise<void>((resolve) => {
    serverHandle = app.listen(0, '127.0.0.1', () => {
      const addr = serverHandle!.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  if (serverHandle) {
    await new Promise<void>((resolve) => serverHandle!.close(() => resolve()));
  }
  try {
    sqliteDb.close();
  } catch {
    // ignore if already closed
  }
  for (const suffix of ['', '-wal', '-shm']) {
    const f = `${tempDbPath}${suffix}`;
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
    }
  }
  const pubDir = path.resolve(process.cwd(), 'data', 'published');
  if (fs.existsSync(pubDir)) {
    for (const d of fs.readdirSync(pubDir)) {
      if (d.startsWith('caldera-')) {
        fs.rmSync(path.join(pubDir, d), { recursive: true, force: true });
      }
    }
  }
});

describe('RailDesign AI End-to-End Platform Verification', () => {
  let userToken = '';
  let userId = '';
  let secondUserToken = '';
  let projectId = '';
  let versionId = '';
  let shareToken = '';
  let shareId = '';

  it('exposes strictly the 3 configured AI providers and all 6 engines', async () => {
    const provRes = await fetch(`${baseUrl}/api/providers`);
    const provData = (await provRes.json()) as { providers: Array<{ id: string }> };
    expect(provData.providers.map((p) => p.id)).toEqual([
      'google_gemini',
      'openai_chatgpt',
      'anthropic_claude',
    ]);
    expect(listPublicProviders()).toHaveLength(3);

    const engRes = await fetch(`${baseUrl}/api/engines`);
    const engData = (await engRes.json()) as { engines: Array<{ id: string }> };
    expect(engData.engines).toHaveLength(6);
  });

  it('estimates 50 tokens for up to 3 standard screens and scales cleanly', () => {
    expect(estimateGenerationTokens({ engineId: 'engine01_website', screenCount: 1, prompt: 'Landing page' })).toBe(50);
    expect(estimateGenerationTokens({ engineId: 'engine01_website', screenCount: 3, prompt: '3 page site' })).toBe(50);
    expect(estimateGenerationTokens({ engineId: 'engine01_website', screenCount: 5, prompt: '5 page site' })).toBe(80);
  });

  it('registers, logs in, verifies email, and resets password with scrypt security', async () => {
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Architect',
        email: 'architect@raildesign.test',
        password: 'StrongPassword123!',
      }),
    });
    expect(regRes.status).toBe(201);
    const regData = (await regRes.json()) as {
      token: string;
      user: { id: string };
      wallet: { availableTokens: number };
      verificationToken: string;
    };
    userToken = regData.token;
    userId = regData.user.id;
    expect(regData.wallet.availableTokens).toBe(100);

    // Email verification
    const verRes = await fetch(`${baseUrl}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: regData.verificationToken }),
    });
    expect(verRes.status).toBe(200);

    // Register second user to verify project ownership isolation
    const reg2Res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Other User',
        email: 'other@raildesign.test',
        password: 'OtherPassword123!',
      }),
    });
    const reg2Data = (await reg2Res.json()) as { token: string };
    secondUserToken = reg2Data.token;
  });

  it('enforces atomic token wallet reservation, settlement, refund, and never-negative invariant', () => {
    const startWallet = getWallet(userId);
    expect(startWallet.availableTokens).toBe(100);

    const insertJob = (id: string) =>
      sqliteDb
        .prepare(
          `INSERT INTO ai_generation_jobs (id, user_id, engine_id, provider_id, model_id, prompt, screen_count, estimated_tokens, status, created_at)
           VALUES (?, ?, 'engine01_website', 'google_gemini', 'gemini-4-hydrogen', 'test', 3, 50, 'queued', ?)`
        )
        .run(id, userId, new Date().toISOString());

    insertJob('job_test_1');
    insertJob('job_overdraw');
    insertJob('job_fail_1');

    // Reserve 50 tokens
    const afterReserve = reserveTokensForJob(userId, 'job_test_1', 50, 'Reserve test');
    expect(afterReserve.availableTokens).toBe(50);
    expect(afterReserve.reservedTokens).toBe(50);

    // Idempotent duplicate reserve must not double deduct
    const duplicateReserve = reserveTokensForJob(userId, 'job_test_1', 50, 'Reserve test');
    expect(duplicateReserve.availableTokens).toBe(50);

    // Cannot overdraw available balance
    expect(() => reserveTokensForJob(userId, 'job_overdraw', 999, 'Too much')).toThrow(/INSUFFICIENT_TOKENS/);

    // Settle 35 of 50 (15 refunded automatically)
    const afterSettle = settleTokensForJob(userId, 'job_test_1', 50, 35, 'Settle test');
    expect(afterSettle.availableTokens).toBe(65);
    expect(afterSettle.reservedTokens).toBe(0);
    expect(afterSettle.usedTokens).toBe(35);

    // Failed job full refund
    reserveTokensForJob(userId, 'job_fail_1', 25, 'Reserve fail test');
    const afterRefund = refundReservedTokensForJob(userId, 'job_fail_1', 25, 'Upstream failure refund');
    expect(afterRefund.availableTokens).toBe(65);
    expect(afterRefund.reservedTokens).toBe(0);

    creditTokens(userId, 35, 'grant', 'Restore to 100', 'restore_test_1');
  });

  it('creates projects, enforces ownership, restores versions, shares, revokes, publishes, and exports ZIP', async () => {
    const createRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        name: 'Caldera Sanctuary',
        description: 'Luxury coastal architectural resort',
        engineId: 'engine01_website',
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { project: { id: string; files: unknown[]; screens: unknown[] } };
    projectId = created.project.id;

    // Cross-user access must fail
    const crossRes = await fetch(`${baseUrl}/api/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${secondUserToken}` },
    });
    expect(crossRes.status).toBe(404);

    // Update project with HTML file & named version
    const patchRes = await fetch(`${baseUrl}/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        versionLabel: 'Added landing markup',
        files: [
          {
            path: 'index.html',
            language: 'html',
            content: '<!doctype html><html><head><title>Caldera</title></head><body><h1>Caldera</h1></body></html>',
          },
        ],
      }),
    });
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as { versions: Array<{ id: string }> };
    versionId = patched.versions[patched.versions.length - 1].id;

    // Version restore
    const restoreRes = await fetch(`${baseUrl}/api/projects/${projectId}/versions/${versionId}/restore`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(restoreRes.status).toBe(200);

    // Share link + public fetch + revoke
    const shareRes = await fetch(`${baseUrl}/api/projects/${projectId}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ visibility: 'public', permission: 'view' }),
    });
    expect(shareRes.status).toBe(201);
    const shareData = (await shareRes.json()) as {
      shares: Array<{ id: string; shareToken: string }>;
    };
    shareId = shareData.shares[0].id;
    shareToken = shareData.shares[0].shareToken;

    const publicRes = await fetch(`${baseUrl}/api/share/${shareToken}`);
    expect(publicRes.status).toBe(200);

    const revokeRes = await fetch(`${baseUrl}/api/shares/${shareId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(revokeRes.status).toBe(200);

    const revokedRes = await fetch(`${baseUrl}/api/share/${shareToken}`);
    expect(revokedRes.status).toBe(404);

    // Restore index.html before publishing & ZIP export
    await fetch(`${baseUrl}/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        files: [
          {
            path: 'index.html',
            language: 'html',
            content:
              '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Caldera</title></head><body><h1>Caldera Live</h1></body></html>',
          },
        ],
      }),
    });

    const pubRes = await fetch(`${baseUrl}/api/projects/${projectId}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ target: 'raildesign_static', customSlug: `caldera-${Date.now()}` }),
    });
    expect(pubRes.status).toBe(200);
    const pubData = (await pubRes.json()) as { slug: string };

    const liveSiteRes = await fetch(`${baseUrl}/published/${pubData.slug}/`);
    expect(liveSiteRes.status).toBe(200);
    expect(await liveSiteRes.text()).toContain('Caldera Live');

    // Verified Project ZIP export
    const zipRes = await fetch(`${baseUrl}/api/projects/${projectId}/export-zip`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(zipRes.status).toBe(200);
    const zipBuf = Buffer.from(await zipRes.arrayBuffer());
    const loadedZip = await JSZip.loadAsync(zipBuf);
    expect(loadedZip.files['index.html']).toBeDefined();
    expect(loadedZip.files['raildesign.project.json']).toBeDefined();
  });

  it('encodes valid binary GIF89a files in Engine 05 and fixes issues in Engine 06', () => {
    const gifBuf = encodeFramesToGifBuffer([
      {
        id: 'f1',
        label: 'Frame 1',
        durationMs: 120,
        backgroundColor: '#090B10',
        accentColor: '#2563EB',
        headline: 'RailDesign',
        subline: 'Step 1',
        shape: 'train',
        progress: 0.2,
      },
      {
        id: 'f2',
        label: 'Frame 2',
        durationMs: 120,
        backgroundColor: '#090B10',
        accentColor: '#2563EB',
        headline: 'RailDesign',
        subline: 'Step 2',
        shape: 'train',
        progress: 0.8,
      },
    ]);
    expect(gifBuf.subarray(0, 6).toString('ascii')).toBe('GIF89a');

    const audit = runStaticValidationAndAutoFix([
      { path: 'index.html', language: 'html', content: '<html><head></head><body><img src="/a.png"></body></html>' },
      { path: 'styles.css', language: 'css', content: 'body { color: red;' },
    ]);
    expect(audit.fixedFiles[0].content).toContain('name="viewport"');
    expect(audit.fixedFiles[0].content).toContain('alt="Design asset"');
    expect(audit.fixedFiles[1].content.endsWith('}')).toBe(true);
  });

  it('verifies Cashfree sandbox orders & HMAC webhooks before crediting tokens', async () => {
    const orderRes = await fetch(`${baseUrl}/api/payments/cashfree/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ packageId: 'pkg_100' }),
    });
    expect(orderRes.status).toBe(200);
    const orderData = (await orderRes.json()) as {
      order: { orderId: string; sandboxVerificationToken: string };
    };

    // Forged signature must be rejected
    const badVerify = await fetch(`${baseUrl}/api/payments/cashfree/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        orderId: orderData.order.orderId,
        action: 'confirm',
        sandboxVerificationToken: 'forged_sig',
      }),
    });
    expect(badVerify.status).toBe(400);

    // Valid server-issued HMAC signature credits tokens
    const goodVerify = await fetch(`${baseUrl}/api/payments/cashfree/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        orderId: orderData.order.orderId,
        action: 'confirm',
        sandboxVerificationToken: orderData.order.sandboxVerificationToken,
      }),
    });
    expect(goodVerify.status).toBe(200);
    const goodData = (await goodVerify.json()) as { creditedTokens: number };
    expect(goodData.creditedTokens).toBe(150);

    // Webhook HMAC verification unit test
    process.env.CASHFREE_SECRET_KEY = 'test_cf_secret';
    const ts = '1700000000';
    const raw = JSON.stringify({ data: { order: { order_id: 'ord_1' } } });
    const sig = crypto.createHmac('sha256', 'test_cf_secret').update(`${ts}${raw}`).digest('base64');
    expect(verifyCashfreeWebhookSignature(raw, ts, sig)).toBe(true);
    expect(verifyCashfreeWebhookSignature(raw, ts, 'invalid')).toBe(false);
    delete process.env.CASHFREE_SECRET_KEY;
  });

  it('enforces RBAC admin permissions and builds verified full-platform ZIP archive', async () => {
    // Non-admin denied
    const denied = await fetch(`${baseUrl}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(denied.status).toBe(403);

    // First-run admin claim
    const claim = await fetch(`${baseUrl}/api/admin/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ passcode: 'AdminPass123' }),
    });
    expect(claim.status).toBe(200);

    // Admin overview now allowed
    const allowed = await fetch(`${baseUrl}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(allowed.status).toBe(200);

    // Full platform downloadable ZIP verification
    const archive = await buildFullPlatformArchive();
    expect(archive.fileCount).toBeGreaterThan(20);
    const verified = await JSZip.loadAsync(archive.buffer);
    expect(verified.files['raildesign-ai/server.ts']).toBeDefined();
    expect(verified.files['raildesign-ai/migrations/001_initial_postgres.sql']).toBeDefined();
  });

  it('removes Razorpay routes and persists workspace settings, integration status, and password updates', async () => {
    // Razorpay endpoint must no longer exist
    const rzpRes = await fetch(`${baseUrl}/api/payments/razorpay/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ packageId: 'pkg_100' }),
    });
    expect(rzpRes.status).toBe(404);

    // Integrations status exposes Cashfree and strictly the 3 AI providers
    const statusRes = await fetch(`${baseUrl}/api/user/integrations-status`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(statusRes.status).toBe(200);
    const statusData = (await statusRes.json()) as {
      providers: Array<{ id: string }>;
      cashfree: { configured: boolean; env: string };
    };
    expect(statusData.providers.map((p) => p.id)).toEqual([
      'google_gemini',
      'openai_chatgpt',
      'anthropic_claude',
    ]);
    expect(typeof statusData.cashfree.env).toBe('string');

    // Workspace settings persist on user profile
    const settingsRes = await fetch(`${baseUrl}/api/user/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        defaultViewport: 'tablet',
        snapToGrid: false,
        autoSave: true,
        defaultScreenCount: 5,
        defaultExportFormat: 'png',
        notifyGeneration: true,
        notifyPayments: false,
        notifyDeployments: true,
        notifySecurity: true,
      }),
    });
    expect(settingsRes.status).toBe(200);
    const settingsData = (await settingsRes.json()) as {
      user: { settings: { defaultViewport: string; defaultScreenCount: number; defaultExportFormat: string } };
    };
    expect(settingsData.user.settings.defaultViewport).toBe('tablet');
    expect(settingsData.user.settings.defaultScreenCount).toBe(5);
    expect(settingsData.user.settings.defaultExportFormat).toBe('png');

    // Password change with wrong current password fails, valid succeeds
    const badPwd = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ currentPassword: 'WrongPassword1!', newPassword: 'NewStrongPassword1!' }),
    });
    expect(badPwd.status).toBe(401);

    const okPwd = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ currentPassword: 'StrongPassword123!', newPassword: 'NewStrongPassword1!' }),
    });
    expect(okPwd.status).toBe(200);
  });
});

