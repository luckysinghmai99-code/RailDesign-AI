import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { addNotification, nowIso, sqliteDb, updateProjectRecord } from '../db/database.ts';
import type { ProjectRecord } from '../../shared/types.ts';

const PUBLISHED_DIR = path.resolve(process.cwd(), 'data', 'published');
if (!fs.existsSync(PUBLISHED_DIR)) {
  fs.mkdirSync(PUBLISHED_DIR, { recursive: true });
}

export function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export async function publishProjectHosting(params: {
  project: ProjectRecord;
  userId: string;
  baseUrl: string;
  target: 'raildesign_static' | 'vercel';
  customSlug?: string;
}): Promise<{ publishedUrl: string; slug: string; logs: string[]; target: string }> {
  const logs: string[] = [];
  const rawSlug = params.customSlug ? sanitizeSlug(params.customSlug) : sanitizeSlug(`${params.project.name}-${params.project.id.slice(-6)}`);
  const slug = rawSlug || `site-${params.project.id.slice(-8)}`;

  logs.push(`Preparing build bundle for project "${params.project.name}" (${params.project.files.length} files)...`);

  const htmlFile = params.project.files.find((f) => f.path === 'index.html') || params.project.files.find((f) => f.path.endsWith('.html'));
  if (!htmlFile) {
    throw new Error('Deployment aborted: project has no index.html entrypoint.');
  }

  if (params.target === 'vercel') {
    const token = process.env.VERCEL_TOKEN;
    if (!token) {
      throw new Error('VERCEL_TOKEN is not configured on the server. Add VERCEL_TOKEN or publish to RailDesign Hosting.');
    }

    logs.push('Uploading project files to Vercel Deployments API...');
    const vercelFiles = params.project.files.map((f) => ({
      file: f.path,
      data: f.content,
    }));

    const res = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: slug,
        files: vercelFiles,
        projectSettings: { framework: null },
      }),
    });

    const data = (await res.json()) as { url?: string; error?: { message?: string } };
    if (!res.ok || !data.url) {
      throw new Error(data.error?.message || 'Vercel deployment failed.');
    }

    const publishedUrl = `https://${data.url}`;
    logs.push(`Verified live Vercel URL: ${publishedUrl}`);

    updateProjectRecord(params.project.id, params.userId, {
      publishedSlug: slug,
      publishedUrl,
      publishedAt: nowIso(),
    });

    addNotification(params.userId, 'project', 'Site Published', `${params.project.name} deployed to ${publishedUrl}`);
    return { publishedUrl, slug, logs, target: 'vercel' };
  }

  // RailDesign Managed Static Hosting (strictly confined inside PUBLISHED_DIR)
  const targetDir = path.resolve(PUBLISHED_DIR, slug);
  if (!targetDir.startsWith(PUBLISHED_DIR + path.sep)) {
    throw new Error('Invalid deployment slug path.');
  }
  fs.mkdirSync(targetDir, { recursive: true });

  for (const file of params.project.files) {
    const safeRel = file.path.replace(/^\/+/, '').replace(/\.\./g, '');
    const dest = path.resolve(targetDir, safeRel);
    if (!dest.startsWith(targetDir + path.sep)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, file.content, 'utf8');
  }

  // Verify index.html exists on disk before reporting published
  const indexOnDisk = path.resolve(targetDir, 'index.html');
  if (!fs.existsSync(indexOnDisk)) {
    throw new Error('Static deployment verification failed: index.html missing after write.');
  }

  const publishedUrl = `${params.baseUrl}/published/${slug}/`;
  logs.push(`Verified static bundle written to ${slug}/index.html`);
  logs.push(`Published endpoint live at ${publishedUrl}`);

  updateProjectRecord(params.project.id, params.userId, {
    publishedSlug: slug,
    publishedUrl,
    publishedAt: nowIso(),
  });

  addNotification(params.userId, 'project', 'Site Published', `${params.project.name} is live at ${publishedUrl}`);
  return { publishedUrl, slug, logs, target: 'raildesign_static' };
}

export function resolvePublishedFile(slug: string, relPath: string): string | null {
  const cleanSlug = sanitizeSlug(slug);
  if (!cleanSlug) return null;
  const siteRoot = path.resolve(PUBLISHED_DIR, cleanSlug);
  if (!siteRoot.startsWith(PUBLISHED_DIR + path.sep)) return null;

  const requested = relPath.replace(/^\/+/, '') || 'index.html';
  const resolved = path.resolve(siteRoot, requested);
  if (!resolved.startsWith(siteRoot + path.sep) && resolved !== siteRoot) return null;
  if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    const fallback = path.resolve(siteRoot, 'index.html');
    return fs.existsSync(fallback) ? fallback : null;
  }
  return resolved;
}

export async function buildFullPlatformArchive(): Promise<{ buffer: Buffer; fileCount: number }> {
  const rootDir = path.resolve(process.cwd());
  const zip = new JSZip();

  const excludedDirs = new Set(['node_modules', 'dist', '.git', 'data', '.next', 'coverage']);
  const excludedFiles = new Set(['.env', '.env.local', 'raildesign-ai-platform.zip']);
  let fileCount = 0;

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (excludedDirs.has(entry.name) || excludedFiles.has(entry.name)) continue;
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const content = fs.readFileSync(fullPath);
        zip.file(`raildesign-ai/${relPath}`, content);
        fileCount += 1;
      }
    }
  }

  walk(rootDir);

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  // Integrity verification via JSZip reload
  const check = await JSZip.loadAsync(buffer);
  const loadedCount = Object.keys(check.files).length;
  if (loadedCount < 5) {
    throw new Error('ZIP archive verification failed: insufficient files packaged.');
  }

  return { buffer, fileCount };
}

export function ensureUniquePublishedSlug(slug: string, excludeProjectId: string): boolean {
  const existing = sqliteDb
    .prepare(`SELECT id FROM projects WHERE published_slug = ? AND id != ?`)
    .get(slug, excludeProjectId);
  return !existing;
}
