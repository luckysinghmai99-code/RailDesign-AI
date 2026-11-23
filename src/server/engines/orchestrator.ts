import { estimateGenerationTokens } from '../../shared/catalog.ts';
import type { EngineId, GenerationJob, ProjectRecord, ProviderId } from '../../shared/types.ts';
import {
  addEngineLog,
  addNotification,
  createProjectRecord,
  getProjectById,
  mapJobRow,
  newId,
  nowIso,
  refundReservedTokensForJob,
  reserveTokensForJob,
  saveAssetRecord,
  settleTokensForJob,
  sqliteDb,
  updateProjectRecord,
} from '../db/database.ts';
import type { EngineContext, EngineOutput, IndependentEngine } from './baseEngine.ts';
import { websiteDesignEngine } from './engine01-website.ts';
import { appUiUxEngine } from './engine02-app-uiux.ts';
import { graphicImageEngine } from './engine03-graphic-image.ts';
import { aiCodingEngine } from './engine04-coding.ts';
import { animationGifEngine } from './engine05-animation-gif.ts';
import { testingExportEngine } from './engine06-testing-export.ts';

const ENGINE_MAP = new Map<EngineId, IndependentEngine>([
  ['engine01_website', websiteDesignEngine],
  ['engine02_app_uiux', appUiUxEngine],
  ['engine03_graphic_image', graphicImageEngine],
  ['engine04_coding', aiCodingEngine],
  ['engine05_animation_gif', animationGifEngine],
  ['engine06_testing_export', testingExportEngine],
]);

// Bounded concurrency queue designed for up to 600 active users / queued jobs
class ConcurrencyQueue {
  private active = 0;
  private readonly maxConcurrent = 60;
  private readonly maxQueued = 600;
  private waitQueue: Array<() => void> = [];

  getStats() {
    return {
      activeWorkers: this.active,
      queuedJobs: this.waitQueue.length,
      maxConcurrent: this.maxConcurrent,
      maxQueuedCapacity: this.maxQueued,
    };
  }

  async acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active += 1;
      return;
    }
    if (this.waitQueue.length >= this.maxQueued) {
      throw new Error('QUEUE_CAPACITY_REACHED: Generation queue is at capacity. Please retry shortly.');
    }
    await new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
    this.active += 1;
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.waitQueue.shift();
    if (next) next();
  }
}

export const generationQueue = new ConcurrencyQueue();

export function detectEngineFromPrompt(prompt: string): EngineId {
  const lower = prompt.toLowerCase();
  if (/\b(gif|animat|motion|loading spinner|frame)\b/.test(lower)) return 'engine05_animation_gif';
  if (/\b(poster|banner|mockup|thumbnail|logo|graphic|image|illustration)\b/.test(lower)) return 'engine03_graphic_image';
  if (/\b(test|audit|verify|zip|export|fix bugs)\b/.test(lower)) return 'engine06_testing_export';
  if (/\b(api|backend|endpoint|refactor|typescript|algorithm|function|debug)\b/.test(lower)) return 'engine04_coding';
  if (/\b(dashboard|mobile app|admin panel|saas|ui\/ux|fintech|login screen|crm)\b/.test(lower)) return 'engine02_app_uiux';
  return 'engine01_website';
}

export interface OrchestrateRequest {
  userId: string;
  projectId?: string | null;
  engineId?: EngineId | 'auto';
  providerId: ProviderId;
  modelId: string;
  prompt: string;
  screenCount?: number;
  referenceImageDataUrl?: string | null;
}

export async function runOrchestratedGeneration(req: OrchestrateRequest): Promise<{
  job: GenerationJob;
  project: ProjectRecord;
}> {
  const resolvedEngineId: EngineId =
    !req.engineId || req.engineId === 'auto'
      ? detectEngineFromPrompt(req.prompt)
      : req.engineId;

  const engine = ENGINE_MAP.get(resolvedEngineId);
  if (!engine) {
    throw new Error(`Unknown engine: ${resolvedEngineId}`);
  }

  const screenCount = Math.max(1, Math.min(25, Number(req.screenCount || 3)));
  const estimatedTokens = estimateGenerationTokens({
    engineId: resolvedEngineId,
    screenCount,
    prompt: req.prompt,
    hasReferenceImage: Boolean(req.referenceImageDataUrl),
  });

  const jobId = newId('job');
  const createdAt = nowIso();
  const startedMs = Date.now();

  let existingProject: ProjectRecord | null = null;
  if (req.projectId) {
    const p = getProjectById(req.projectId);
    if (!p || p.userId !== req.userId) {
      throw new Error('Project not found or access denied.');
    }
    existingProject = p;
  }

  // 1. Insert queued job record
  sqliteDb
    .prepare(
      `INSERT INTO ai_generation_jobs (
        id, user_id, project_id, engine_id, provider_id, model_id, prompt, reference_image_url,
        screen_count, estimated_tokens, reserved_tokens, settled_tokens, status, attempts, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'queued', 1, ?)`
    )
    .run(
      jobId,
      req.userId,
      existingProject?.id ?? null,
      resolvedEngineId,
      req.providerId,
      req.modelId,
      req.prompt,
      req.referenceImageDataUrl ? 'attached' : null,
      screenCount,
      estimatedTokens,
      createdAt
    );

  // 2. Reserve tokens atomically before executing
  reserveTokensForJob(
    req.userId,
    jobId,
    estimatedTokens,
    `Reserved ${estimatedTokens} tokens for ${engine.name} (${screenCount} screen${screenCount > 1 ? 's' : ''})`
  );

  sqliteDb
    .prepare(`UPDATE ai_generation_jobs SET reserved_tokens = ?, status = 'running' WHERE id = ?`)
    .run(estimatedTokens, jobId);

  addEngineLog(jobId, resolvedEngineId, 'info', `Queued on RailDesign Orchestrator (${req.providerId}/${req.modelId})`);

  await generationQueue.acquire();
  try {
    const ctx: EngineContext = {
      jobId,
      userId: req.userId,
      providerId: req.providerId,
      modelId: req.modelId,
      prompt: req.prompt,
      screenCount,
      referenceImageDataUrl: req.referenceImageDataUrl,
      existingProject,
    };

    const output: EngineOutput = await engine.execute(ctx);

    let finalProject: ProjectRecord;
    if (existingProject) {
      finalProject = updateProjectRecord(
        existingProject.id,
        req.userId,
        {
          engineId: resolvedEngineId,
          providerId: req.providerId,
          modelId: req.modelId,
          designSystem: output.designSystem ?? existingProject.designSystem,
          screens: output.screens ?? existingProject.screens,
          files: output.files ?? existingProject.files,
          generatedImages: output.generatedImages ?? existingProject.generatedImages,
          animationFrames: output.animationFrames ?? existingProject.animationFrames,
          gifDataUrl: output.gifDataUrl !== undefined ? output.gifDataUrl : existingProject.gifDataUrl,
          testReport: output.testReport !== undefined ? output.testReport : existingProject.testReport,
        },
        `${engine.name} revision`
      )!;
    } else {
      const derivedName =
        req.prompt
          .split(/\s+/)
          .slice(0, 5)
          .join(' ')
          .replace(/[^a-zA-Z0-9\s-]/g, '')
          .trim() || 'RailDesign Project';

      finalProject = createProjectRecord({
        userId: req.userId,
        name: derivedName.slice(0, 48),
        description: output.summary,
        engineId: resolvedEngineId,
        providerId: req.providerId,
        modelId: req.modelId,
        designSystem: output.designSystem,
        screens: output.screens,
        files: output.files,
        generatedImages: output.generatedImages,
        animationFrames: output.animationFrames,
        gifDataUrl: output.gifDataUrl,
        testReport: output.testReport,
      });
    }

    // Save generated images or GIF into the user's Asset Library automatically
    if (output.generatedImages?.length) {
      const latestImg = output.generatedImages[output.generatedImages.length - 1];
      saveAssetRecord({
        userId: req.userId,
        projectId: finalProject.id,
        name: latestImg.title,
        kind: 'generated',
        mimeType: latestImg.mimeType,
        dataUrl: latestImg.dataUrl,
      });
    }
    if (output.gifDataUrl) {
      saveAssetRecord({
        userId: req.userId,
        projectId: finalProject.id,
        name: `${finalProject.name} Animation.gif`,
        kind: 'gif',
        mimeType: 'image/gif',
        dataUrl: output.gifDataUrl,
      });
    }

    // Settle actual token usage
    const actualTokens = estimatedTokens;
    settleTokensForJob(
      req.userId,
      jobId,
      estimatedTokens,
      actualTokens,
      `Completed ${engine.name} (${actualTokens} tokens)`
    );

    const durationMs = Date.now() - startedMs;
    sqliteDb
      .prepare(
        `UPDATE ai_generation_jobs
         SET project_id = ?, settled_tokens = ?, status = 'completed', result_summary = ?, duration_ms = ?, completed_at = ?
         WHERE id = ?`
      )
      .run(finalProject.id, actualTokens, output.summary, durationMs, nowIso(), jobId);

    addNotification(
      req.userId,
      'generation',
      `${engine.name} Completed`,
      `${output.summary} (${actualTokens} tokens used)`
    );

    const jobRow = sqliteDb.prepare(`SELECT * FROM ai_generation_jobs WHERE id = ?`).get(jobId) as Record<string, unknown>;
    return {
      job: mapJobRow(jobRow),
      project: finalProject,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Generation failed unexpectedly.';
    addEngineLog(jobId, resolvedEngineId, 'error', errMsg);

    // Automatic full refund of reserved tokens on failure
    refundReservedTokensForJob(req.userId, jobId, estimatedTokens, `Refunded ${estimatedTokens} tokens after failure: ${errMsg.slice(0, 80)}`);

    const durationMs = Date.now() - startedMs;
    sqliteDb
      .prepare(
        `UPDATE ai_generation_jobs
         SET status = 'refunded', error_message = ?, duration_ms = ?, completed_at = ?
         WHERE id = ?`
      )
      .run(errMsg, durationMs, nowIso(), jobId);

    addNotification(
      req.userId,
      'generation',
      `${engine.name} Refunded`,
      `Your ${estimatedTokens} reserved tokens were automatically refunded because generation failed: ${errMsg}`
    );

    throw err;
  } finally {
    generationQueue.release();
  }
}
