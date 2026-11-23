import type { ProjectFile } from '../../shared/types.ts';
import {
  callProviderText,
  extractJsonFromText,
  logEngine,
  type EngineContext,
  type EngineOutput,
  type IndependentEngine,
} from './baseEngine.ts';

interface CodeGenPayload {
  summary?: string;
  files?: Array<{ path: string; language?: string; content: string }>;
}

function inferLanguage(filePath: string): ProjectFile['language'] {
  if (filePath.endsWith('.html')) return 'html';
  if (filePath.endsWith('.css')) return 'css';
  if (filePath.endsWith('.tsx')) return 'tsx';
  if (filePath.endsWith('.ts')) return 'typescript';
  if (filePath.endsWith('.json')) return 'json';
  if (filePath.endsWith('.md')) return 'markdown';
  return 'javascript';
}

export class AICodingEngine implements IndependentEngine {
  readonly id = 'engine04_coding' as const;
  readonly name = 'AI Coding Engine';

  async execute(ctx: EngineContext): Promise<EngineOutput> {
    logEngine(ctx.jobId, this.id, 'info', `Starting AI Coding Engine (${ctx.modelId})`);

    const existingFilesSummary = ctx.existingProject?.files?.length
      ? `\nExisting files in project:\n${ctx.existingProject.files
          .map((f) => `- ${f.path} (${f.content.length} chars)`)
          .join('\n')}`
      : '';

    const systemInstruction = `You are Engine 04 (AI Coding Engine) of RailDesign AI.
Generate clean, modular, production-ready frontend/backend code files (HTML, CSS, JavaScript, React TSX, or Express API routes).
Return strictly valid JSON:
{
  "summary": "What was built, refactored, or fixed",
  "files": [
    {
      "path": "index.html",
      "language": "html",
      "content": "<!doctype html>..."
    },
    {
      "path": "src/App.tsx",
      "language": "tsx",
      "content": "import React from 'react'; ..."
    }
  ]
}
Always include a runnable index.html preview entrypoint plus modular source files (styles.css, app.js, src/App.tsx, or server/api.ts as appropriate).`;

    const raw = await callProviderText({
      ctx,
      engineId: this.id,
      systemInstruction,
      userPrompt: `${ctx.prompt}${existingFilesSummary}`,
      expectJson: true,
    });

    const parsed = extractJsonFromText<CodeGenPayload>(raw);
    const files: ProjectFile[] = (parsed.files || [])
      .filter((f) => f && typeof f.path === 'string' && typeof f.content === 'string')
      .map((f) => ({
        path: f.path.replace(/^\/+/, ''),
        language: inferLanguage(f.path),
        content: f.content,
      }));

    if (files.length === 0) {
      throw new Error('AI Coding Engine produced no valid source files.');
    }

    logEngine(ctx.jobId, this.id, 'info', `Generated ${files.length} source files`);

    return {
      summary: parsed.summary || `Generated ${files.length} project source files.`,
      files,
    };
  }
}

export const aiCodingEngine = new AICodingEngine();
