import { DEFAULT_DESIGN_SYSTEM } from '../../shared/catalog.ts';
import type { DesignSystem, ScreenNode } from '../../shared/types.ts';
import {
  callProviderText,
  compileScreensToProjectFiles,
  extractJsonFromText,
  logEngine,
  normalizeScreens,
  type EngineContext,
  type EngineOutput,
  type IndependentEngine,
} from './baseEngine.ts';

interface AppGenPayload {
  projectName?: string;
  summary?: string;
  designSystem?: Partial<DesignSystem>;
  screens?: Array<Record<string, unknown>>;
}

export class AppUiUxEngine implements IndependentEngine {
  readonly id = 'engine02_app_uiux' as const;
  readonly name = 'App & UI/UX Engine';

  async execute(ctx: EngineContext): Promise<EngineOutput> {
    logEngine(ctx.jobId, this.id, 'info', `Starting App & UI/UX Engine for ${ctx.screenCount} app screen(s)`);

    const systemInstruction = `You are Engine 02 (App & UI/UX Engine) of RailDesign AI.
Design a connected multi-screen application (mobile app, desktop software, SaaS dashboard, admin panel, or auth flow) with a cohesive design system.
Return strictly valid JSON:
{
  "projectName": "App Name",
  "summary": "Brief UI/UX architecture overview",
  "designSystem": {
    "primaryColor": "#2563EB",
    "secondaryColor": "#10B981",
    "backgroundColor": "#090D16",
    "surfaceColor": "#111827",
    "textColor": "#F8FAFC",
    "headingFont": "Outfit",
    "bodyFont": "Plus Jakarta Sans",
    "borderRadius": 12,
    "spacingScale": "balanced"
  },
  "screens": [
    {
      "name": "Screen Name (e.g. Overview, Analytics, Settings, Sign In)",
      "slug": "/screen-slug",
      "sections": [
        {
          "type": "stats" | "features" | "form" | "hero" | "gallery",
          "title": "Panel or Screen Title",
          "subtitle": "View context",
          "body": "Operational description",
          "ctaLabel": "Action label",
          "ctaHref": "#action",
          "items": [{ "title": "Widget / Metric", "description": "Detail", "metric": "99.4%" }]
        }
      ]
    }
  ]
}
Include exactly ${ctx.screenCount} connected screens with real metrics, structured widgets, and realistic form states.`;

    const raw = await callProviderText({
      ctx,
      engineId: this.id,
      systemInstruction,
      userPrompt: ctx.prompt,
      expectJson: true,
    });

    const parsed = extractJsonFromText<AppGenPayload>(raw);
    const designSystem: DesignSystem = {
      ...DEFAULT_DESIGN_SYSTEM,
      ...(ctx.existingProject?.designSystem || {}),
      ...(parsed.designSystem || {}),
    };
    const projectName = parsed.projectName || ctx.existingProject?.name || 'RailDesign App';
    const screens: ScreenNode[] = normalizeScreens(parsed.screens, projectName, ctx.screenCount);
    const files = compileScreensToProjectFiles(projectName, designSystem, screens);

    logEngine(ctx.jobId, this.id, 'info', `Generated ${screens.length} UI/UX screens and design system tokens`);

    return {
      summary: parsed.summary || `Generated ${screens.length}-screen UI/UX system for ${projectName}.`,
      designSystem,
      screens,
      files,
    };
  }
}

export const appUiUxEngine = new AppUiUxEngine();
