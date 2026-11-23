import { newId } from '../db/database.ts';
import { getProviderAdapter, withProviderRetry } from '../providers/registry.ts';
import {
  callProviderText,
  extractJsonFromText,
  logEngine,
  type EngineContext,
  type EngineOutput,
  type IndependentEngine,
} from './baseEngine.ts';

interface GraphicSpecPayload {
  title?: string;
  summary?: string;
  svgMarkup?: string;
  palette?: string[];
  analysis?: string;
}

export class GraphicImageEngine implements IndependentEngine {
  readonly id = 'engine03_graphic_image' as const;
  readonly name = 'Image & Graphic Design Engine';

  async execute(ctx: EngineContext): Promise<EngineOutput> {
    logEngine(ctx.jobId, this.id, 'info', `Starting Image & Graphic Design Engine via ${ctx.providerId}/${ctx.modelId}`);
    const adapter = getProviderAdapter(ctx.providerId);

    // Use native image generation when an image-capable model is selected
    const wantsNativeImage =
      ctx.modelId === 'gemini-3.1-flash-lite-image' ||
      ctx.modelId === 'gpt-image-1';

    if (wantsNativeImage && adapter.generateImage) {
      logEngine(ctx.jobId, this.id, 'info', `Invoking native raster image generation (${ctx.modelId})`);
      const img = await withProviderRetry(() =>
        adapter.generateImage!({
          modelId: ctx.modelId,
          prompt: ctx.prompt,
          referenceImageDataUrl: ctx.referenceImageDataUrl,
          aspectRatio: '4:3',
        })
      );

      const dataUrl = `data:${img.mimeType};base64,${img.base64Data}`;
      const imageEntry = {
        id: newId('img'),
        title: ctx.prompt.slice(0, 48),
        mimeType: img.mimeType,
        dataUrl,
        prompt: ctx.prompt,
      };

      const htmlPreview = `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Graphic Asset</title></head>
<body style="margin:0;background:#090B10;color:#F8FAFC;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:24px;">
  <figure style="max-width:860px;width:100%;margin:0;">
    <img src="${dataUrl}" alt="${ctx.prompt.replace(/"/g, '&quot;')}" style="width:100%;border-radius:12px;display:block;border:1px solid rgba(148,163,184,0.2);" />
    <figcaption style="margin-top:12px;font-size:14px;color:#94A3B8;">${img.caption || ctx.prompt}</figcaption>
  </figure>
</body>
</html>`;

      return {
        summary: img.caption || `Generated raster graphic using ${img.modelId}.`,
        generatedImages: [...(ctx.existingProject?.generatedImages || []), imageEntry],
        files: [
          { path: 'index.html', language: 'html', content: htmlPreview },
        ],
      };
    }

    // For text/vision models (Gemini 4, GPT-4.1, Claude), generate high-craft vector SVG poster/mockup & reference analysis
    const systemInstruction = `You are Engine 03 (Image & Graphic Design Engine) of RailDesign AI.
Create a crisp, publication-grade vector SVG poster, banner, product mockup, or social media graphic (800x600 viewBox) and optional reference image analysis.
Return strictly valid JSON:
{
  "title": "Design Title",
  "summary": "Brief graphic rationale",
  "palette": ["#0F172A", "#2563EB", "#F8FAFC"],
  "analysis": "If a reference image was supplied, summarize its composition and colors; otherwise design notes",
  "svgMarkup": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600' width='800' height='600'>...</svg>"
}
Ensure the SVG uses clean geometric shapes, gradients, and crisp legible text with zero external image URLs.`;

    const raw = await callProviderText({
      ctx,
      engineId: this.id,
      systemInstruction,
      userPrompt: ctx.prompt,
      expectJson: true,
    });

    const parsed = extractJsonFromText<GraphicSpecPayload>(raw);
    const svg =
      parsed.svgMarkup && parsed.svgMarkup.includes('<svg')
        ? parsed.svgMarkup
        : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600"><rect width="800" height="600" fill="#0B1120"/><rect x="48" y="48" width="704" height="504" rx="20" fill="#111827" stroke="#2563EB" stroke-width="2"/><text x="84" y="140" fill="#F8FAFC" font-family="sans-serif" font-size="38" font-weight="700">${(parsed.title || 'Graphic Composition').replace(/</g, '&lt;')}</text><text x="84" y="190" fill="#94A3B8" font-family="sans-serif" font-size="18">${ctx.prompt.slice(0, 68).replace(/</g, '&lt;')}</text></svg>`;

    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
    const imageEntry = {
      id: newId('img'),
      title: parsed.title || 'Vector Graphic',
      mimeType: 'image/svg+xml',
      dataUrl,
      prompt: ctx.prompt,
    };

    const htmlPreview = `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${parsed.title || 'Graphic Design'}</title></head>
<body style="margin:0;background:#090B10;color:#F8FAFC;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:24px;">
  <div style="max-width:840px;width:100%;">
    ${svg}
    <p style="margin-top:16px;color:#94A3B8;font-size:14px;">${parsed.analysis || parsed.summary || ''}</p>
  </div>
</body>
</html>`;

    logEngine(ctx.jobId, this.id, 'info', `Generated graphic composition "${imageEntry.title}"`);

    return {
      summary: parsed.summary || `Created graphic composition: ${imageEntry.title}.`,
      generatedImages: [...(ctx.existingProject?.generatedImages || []), imageEntry],
      files: [
        { path: 'graphic.svg', language: 'html', content: svg },
        { path: 'index.html', language: 'html', content: htmlPreview },
      ],
    };
  }
}

export const graphicImageEngine = new GraphicImageEngine();
