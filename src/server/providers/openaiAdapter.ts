import type {
  AIProviderAdapter,
  ProviderGenerateInput,
  ProviderGenerateResult,
  ProviderImageInput,
  ProviderImageResult,
} from './types.ts';

export class OpenAIProviderAdapter implements AIProviderAdapter {
  readonly id = 'openai_chatgpt' as const;

  isConfigured(): boolean {
    const key = process.env.OPENAI_API_KEY;
    return Boolean(key && key.trim().length > 0);
  }

  async generateText(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    if (!this.isConfigured()) {
      throw new Error('OPENAI_NOT_CONFIGURED: OPENAI_API_KEY is not configured on the server.');
    }

    const modelId = input.modelId || 'gpt-4.1';
    const userContent: Array<Record<string, unknown>> = [{ type: 'text', text: input.prompt }];
    if (input.referenceImageDataUrl && modelId !== 'o3-mini') {
      userContent.push({
        type: 'image_url',
        image_url: { url: input.referenceImageDataUrl },
      });
    }

    const body: Record<string, unknown> = {
      model: modelId,
      messages: [
        { role: 'system', content: input.systemInstruction },
        { role: 'user', content: userContent.length === 1 ? input.prompt : userContent },
      ],
    };

    if (input.expectJson && modelId !== 'o3-mini') {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(input.timeoutMs || 60000),
    });

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(data.error?.message || `OpenAI API error (${res.status})`);
    }

    const text = (data.choices?.[0]?.message?.content ?? '').trim();
    if (!text) throw new Error('OpenAI returned an empty response.');

    return { text, providerId: this.id, modelId };
  }

  async generateImage(input: ProviderImageInput): Promise<ProviderImageResult> {
    if (!this.isConfigured()) {
      throw new Error('OPENAI_NOT_CONFIGURED: OPENAI_API_KEY is not configured on the server.');
    }

    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: input.prompt,
        size: '1024x1024',
      }),
    });

    const data = (await res.json()) as {
      data?: Array<{ b64_json?: string }>;
      error?: { message?: string };
    };

    if (!res.ok || !data.data?.[0]?.b64_json) {
      throw new Error(data.error?.message || 'OpenAI image generation failed.');
    }

    return {
      mimeType: 'image/png',
      base64Data: data.data[0].b64_json,
      providerId: this.id,
      modelId: 'gpt-image-1',
    };
  }
}
