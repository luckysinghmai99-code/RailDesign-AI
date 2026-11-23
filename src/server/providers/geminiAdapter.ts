import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type {
  AIProviderAdapter,
  ProviderGenerateInput,
  ProviderGenerateResult,
  ProviderImageInput,
  ProviderImageResult,
} from './types.ts';

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

export class GeminiProviderAdapter implements AIProviderAdapter {
  readonly id = 'google_gemini' as const;

  isConfigured(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return Boolean(key && key.trim().length > 0 && key !== 'MY_GEMINI_API_KEY');
  }

  private getClient(): GoogleGenAI {
    if (!this.isConfigured()) {
      throw new Error('GOOGLE_GEMINI_NOT_CONFIGURED: GEMINI_API_KEY is not set on the server.');
    }
    return new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  async generateText(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    const ai = this.getClient();
    const validTextModels = ['gemini-4-hydrogen', 'gemini-4-neon', 'gemini-4-carbon', 'gemini-4-argon', 'gemini-3.1-flash-lite'];
    const modelId = validTextModels.includes(input.modelId) ? input.modelId : 'gemini-4-hydrogen';

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    if (input.referenceImageDataUrl) {
      const parsed = parseDataUrl(input.referenceImageDataUrl);
      if (parsed) {
        parts.push({ inlineData: parsed });
      }
    }
    parts.push({ text: input.prompt });

    const config: Record<string, unknown> = {
      systemInstruction: input.systemInstruction,
    };

    if (input.expectJson) {
      config.responseMimeType = 'application/json';
    }

    if (modelId.startsWith('gemini-4-')) {
      config.thinkingConfig = {
        thinkingLevel: modelId === 'gemini-4-hydrogen' ? ThinkingLevel.LOW : ThinkingLevel.MEDIUM,
      };
    }

    const response = await ai.models.generateContent({
      model: modelId,
      contents: parts.length === 1 ? input.prompt : { parts },
      config,
    });

    const text = (response.text ?? '').trim();
    if (!text) {
      throw new Error('Gemini returned an empty response.');
    }

    return {
      text,
      providerId: this.id,
      modelId,
    };
  }

  async generateImage(input: ProviderImageInput): Promise<ProviderImageResult> {
    const ai = this.getClient();
    const modelId = 'gemini-3.1-flash-lite-image';

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    if (input.referenceImageDataUrl) {
      const parsed = parseDataUrl(input.referenceImageDataUrl);
      if (parsed) {
        parts.push({ inlineData: parsed });
      }
    }
    parts.push({ text: input.prompt });

    const response = await ai.models.generateContent({
      model: modelId,
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: input.aspectRatio || '4:3',
        },
      },
    });

    let base64Data = '';
    let mimeType = 'image/png';
    let caption = '';

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        base64Data = part.inlineData.data;
        mimeType = part.inlineData.mimeType ?? 'image/png';
      } else if (part.text) {
        caption += part.text;
      }
    }

    if (!base64Data) {
      throw new Error('Image model did not return image bytes.');
    }

    return {
      mimeType,
      base64Data,
      caption: caption.trim(),
      providerId: this.id,
      modelId,
    };
  }
}
