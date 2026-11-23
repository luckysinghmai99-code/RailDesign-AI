import { PROVIDER_DEFINITIONS } from '../../shared/catalog.ts';
import type { ProviderId, ProviderInfo } from '../../shared/types.ts';
import { AnthropicProviderAdapter } from './anthropicAdapter.ts';
import { GeminiProviderAdapter } from './geminiAdapter.ts';
import { OpenAIProviderAdapter } from './openaiAdapter.ts';
import type { AIProviderAdapter } from './types.ts';

// Strictly limited to the 3 configured providers for initial release,
// while preserving clean map-based extensibility for future adapters.
const adapterRegistry = new Map<ProviderId, AIProviderAdapter>([
  ['google_gemini', new GeminiProviderAdapter()],
  ['openai_chatgpt', new OpenAIProviderAdapter()],
  ['anthropic_claude', new AnthropicProviderAdapter()],
]);

export function getProviderAdapter(providerId: ProviderId): AIProviderAdapter {
  const adapter = adapterRegistry.get(providerId);
  if (!adapter) {
    throw new Error(`Unsupported AI provider: ${providerId}`);
  }
  return adapter;
}

export function listPublicProviders(): ProviderInfo[] {
  return (['google_gemini', 'openai_chatgpt', 'anthropic_claude'] as ProviderId[]).map((id) => {
    const def = PROVIDER_DEFINITIONS[id];
    const adapter = adapterRegistry.get(id)!;
    const configured = adapter.isConfigured();
    return {
      id,
      name: def.name,
      shortName: def.shortName,
      configured,
      statusLabel: configured ? 'Connected' : 'API key required on server',
      defaultModel: def.defaultModel,
      models: def.models,
    };
  });
}

export async function withProviderRetry<T>(fn: () => Promise<T>, maxAttempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Do not retry configuration or auth errors
      if (
        msg.includes('NOT_CONFIGURED') ||
        msg.includes('API_KEY_INVALID') ||
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('401') ||
        msg.includes('403')
      ) {
        throw err;
      }
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 450 * attempt));
      }
    }
  }
  throw lastError;
}
