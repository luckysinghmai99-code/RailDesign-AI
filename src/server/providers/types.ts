import type { ProviderId } from '../../shared/types.ts';

export interface ProviderGenerateInput {
  modelId: string;
  systemInstruction: string;
  prompt: string;
  referenceImageDataUrl?: string | null;
  expectJson?: boolean;
  timeoutMs?: number;
}

export interface ProviderImageInput {
  modelId?: string;
  prompt: string;
  referenceImageDataUrl?: string | null;
  aspectRatio?: '1:1' | '16:9' | '4:3' | '3:4' | '9:16';
}

export interface ProviderGenerateResult {
  text: string;
  providerId: ProviderId;
  modelId: string;
}

export interface ProviderImageResult {
  mimeType: string;
  base64Data: string;
  caption?: string;
  providerId: ProviderId;
  modelId: string;
}

export interface AIProviderAdapter {
  readonly id: ProviderId;
  isConfigured(): boolean;
  generateText(input: ProviderGenerateInput): Promise<ProviderGenerateResult>;
  generateImage?(input: ProviderImageInput): Promise<ProviderImageResult>;
}
