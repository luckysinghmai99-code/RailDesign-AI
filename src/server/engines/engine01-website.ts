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

interface WebsiteGenPayload {
  projectName?: string;
  summary?: string;
  designSystem?: Partial<DesignSystem>;
  screens?: Array<Record<string, unknown>>;
}

export class WebsiteDesignEngine implements IndependentEngine {
  readonly id = 'engine01_website' as const;
  readonly name = 'Website Design Engine';

  async execute(ctx: EngineContext): Promise<EngineOutput> {
    logEngine(ctx.jobId, this.id, 'info', `Starting Website Design Engine for ${ctx.screenCount} screen(s)`);

    const systemInstruction = `You are Engine 01 (Website Design Engine) of RailDesign AI.
Generate a complete, responsive, multi-page website specification as valid JSON.
Return strictly JSON with this shape:
{
  "projectName": "Short Brand Name",
  "summary": "1-2 sentence architectural summary",
  "designSystem": {
    "primaryColor": "#2563EB",
    "secondaryColor": "#0EA5E9",
    "backgroundColor": "#0B0E14",
    "surfaceColor": "#131823",
    "textColor": "#F8FAFC",
    "headingFont": "Outfit",
    "bodyFont": "Plus Jakarta Sans",
    "borderRadius": 10,
    "spacingScale": "balanced"
  },
  "screens": [
    {
      "name": "Home",
      "slug": "/",
      "sections": [
        {
          "type": "hero" | "features" | "stats" | "gallery" | "form" | "pricing" | "footer",
          "title": "Section heading",
          "subtitle": "Short kicker",
          "body": "Concrete domain-specific copy",
          "ctaLabel": "Primary action",
          "ctaHref": "#contact",
          "items": [{ "title": "Feature", "description": "Details", "metric": "Optional metric" }]
        }
      ]
    }
  ]
}
Produce exactly ${ctx.screenCount} cohesive screens with rich, realistic copy (never lorem ipsum).`;

    const existingContext = ctx.existingProject
      ? `\nExisting project "${ctx.existingProject.name}" has ${ctx.existingProject.screens.length} screens. Preserve brand continuity while applying the requested changes.`
      : '';

    const raw = await callProviderText({
      ctx,
      engineId: this.id,
      systemInstruction,
      userPrompt: `${ctx.prompt}${existingContext}`,
      expectJson: true,
    });

    const parsed = extractJsonFromText<WebsiteGenPayload>(raw);
    const designSystem: DesignSystem = {
      ...DEFAULT_DESIGN_SYSTEM,
      ...(ctx.existingProject?.designSystem || {}),
      ...(parsed.designSystem || {}),
    };

    const projectName = parsed.projectName || ctx.existingProject?.name || 'RailDesign Website';
    const screens: ScreenNode[] = normalizeScreens(parsed.screens, projectName, ctx.screenCount);
    const files = compileScreensToProjectFiles(projectName, designSystem, screens);

    logEngine(ctx.jobId, this.id, 'info', `Compiled ${screens.length} screens and ${files.length} source files`);

    return {
      summary: parsed.summary || `Generated ${screens.length}-screen responsive website for ${projectName}.`,
      designSystem,
      screens,
      files,
    };
  }
}

export const websiteDesignEngine = new WebsiteDesignEngine();
