import { newId } from '../db/database.ts';
import type { AnimationFrame } from '../../shared/types.ts';
import {
  callProviderText,
  extractJsonFromText,
  logEngine,
  type EngineContext,
  type EngineOutput,
  type IndependentEngine,
} from './baseEngine.ts';
import { encodeFramesToGifDataUrl } from './gifEncoder.ts';

interface AnimationSpecPayload {
  summary?: string;
  frames?: Array<{
    label?: string;
    durationMs?: number;
    backgroundColor?: string;
    accentColor?: string;
    headline?: string;
    subline?: string;
    shape?: 'train' | 'pulse' | 'bars' | 'orbit' | 'wave';
  }>;
}

export class AnimationGifEngine implements IndependentEngine {
  readonly id = 'engine05_animation_gif' as const;
  readonly name = 'Animation & GIF Engine';

  async execute(ctx: EngineContext): Promise<EngineOutput> {
    logEngine(ctx.jobId, this.id, 'info', 'Starting Animation & GIF Engine choreography');

    const systemInstruction = `You are Engine 05 (Animation & GIF Engine) of RailDesign AI.
Design a 6-to-8 frame motion sequence suitable for animated banners, loading sequences, and binary GIF89a export.
Return strictly valid JSON:
{
  "summary": "Brief description of the animation sequence",
  "frames": [
    {
      "label": "Frame 1: Entry",
      "durationMs": 140,
      "backgroundColor": "#0B1120",
      "accentColor": "#3B82F6",
      "headline": "Short headline",
      "subline": "Motion cue",
      "shape": "train" | "pulse" | "bars" | "orbit" | "wave"
    }
  ]
}`;

    const raw = await callProviderText({
      ctx,
      engineId: this.id,
      systemInstruction,
      userPrompt: ctx.prompt,
      expectJson: true,
    });

    const parsed = extractJsonFromText<AnimationSpecPayload>(raw);
    const rawFrames = Array.isArray(parsed.frames) && parsed.frames.length >= 2 ? parsed.frames : [];

    const frames: AnimationFrame[] = (rawFrames.length > 0
      ? rawFrames
      : Array.from({ length: 6 }, (_, i) => ({
          label: `Frame ${i + 1}`,
          durationMs: 140,
          backgroundColor: '#0B1120',
          accentColor: '#2563EB',
          headline: 'RailDesign Motion',
          subline: `Step ${i + 1}/6`,
          shape: 'train' as const,
        }))
    ).map((f, idx, arr) => ({
      id: newId('frm'),
      label: String(f.label || `Frame ${idx + 1}`),
      durationMs: Math.max(50, Math.min(2000, Number(f.durationMs || 150))),
      backgroundColor: String(f.backgroundColor || '#0B1120'),
      accentColor: String(f.accentColor || '#2563EB'),
      headline: String(f.headline || 'Motion Sequence'),
      subline: String(f.subline || `Frame ${idx + 1}`),
      shape: (['train', 'pulse', 'bars', 'orbit', 'wave'].includes(String(f.shape))
        ? f.shape
        : 'train') as AnimationFrame['shape'],
      progress: idx / Math.max(1, arr.length - 1),
    }));

    const gifDataUrl = encodeFramesToGifDataUrl(frames, 400, 220);

    const htmlPreview = `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Animation & GIF Preview</title></head>
<body style="margin:0;background:#090B10;color:#F8FAFC;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:24px;">
  <div style="max-width:520px;width:100%;text-align:center;">
    <img src="${gifDataUrl}" alt="Generated GIF Animation" style="width:100%;border-radius:12px;border:1px solid rgba(148,163,184,0.22);" />
    <p style="margin-top:14px;font-size:14px;color:#94A3B8;">${frames.length} frames encoded to GIF89a</p>
  </div>
</body>
</html>`;

    logEngine(ctx.jobId, this.id, 'info', `Encoded ${frames.length}-frame GIF89a (${gifDataUrl.length} bytes base64)`);

    return {
      summary: parsed.summary || `Generated ${frames.length}-frame GIF animation.`,
      animationFrames: frames,
      gifDataUrl,
      files: [{ path: 'index.html', language: 'html', content: htmlPreview }],
    };
  }
}

export const animationGifEngine = new AnimationGifEngine();
