import type {
  AIProviderAdapter,
  ProviderGenerateInput,
  ProviderGenerateResult,
} from './types.ts';

export class AnthropicProviderAdapter implements AIProviderAdapter {
  readonly id = 'anthropic_claude' as const;

  isConfigured(): boolean {
    const key = process.env.ANTHROPIC_API_KEY;
    return Boolean(key && key.trim().length > 0);
  }

  async generateText(input: ProviderGenerateInput): Promise<ProviderGenerateResult> {
    if (!this.isConfigured()) {
      throw new Error('ANTHROPIC_NOT_CONFIGURED: ANTHROPIC_API_KEY is not configured on the server.');
    }

    const modelId = input.modelId || 'claude-sonnet-4-20250514';
    const contentBlocks: Array<Record<string, unknown>> = [];

    if (input.referenceImageDataUrl) {
      const match = input.referenceImageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: match[1],
            data: match[2],
          },
        });
      }
    }

    contentBlocks.push({ type: 'text', text: input.prompt });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 4096,
        system: input.systemInstruction,
        messages: [{ role: 'user', content: contentBlocks }],
      }),
      signal: AbortSignal.timeout(input.timeoutMs || 60000),
    });

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(data.error?.message || `Anthropic API error (${res.status})`);
    }

    const text = (data.content?.find((b) => b.type === 'text')?.text ?? '').trim();
    if (!text) throw new Error('Anthropic returned an empty response.');

    return { text, providerId: this.id, modelId };
  }
}
