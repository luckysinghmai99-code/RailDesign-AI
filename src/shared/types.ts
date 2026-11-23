export type ProviderId = 'google_gemini' | 'openai_chatgpt' | 'anthropic_claude';

export type EngineId =
  | 'engine01_website'
  | 'engine02_app_uiux'
  | 'engine03_graphic_image'
  | 'engine04_coding'
  | 'engine05_animation_gif'
  | 'engine06_testing_export';

export type UserRole = 'user' | 'admin' | 'super_admin';

export interface ProviderModel {
  id: string;
  label: string;
  description: string;
  capabilities: {
    text: boolean;
    code: boolean;
    vision: boolean;
    imageGeneration: boolean;
  };
  tier: 'standard' | 'pro' | 'deep';
}

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  shortName: string;
  configured: boolean;
  statusLabel: string;
  defaultModel: string;
  models: ProviderModel[];
}

export interface EngineMetadata {
  id: EngineId;
  number: string;
  name: string;
  shortName: string;
  description: string;
  capabilities: string[];
  tokenBaseCost: number;
  supportsMultiScreen: boolean;
  primaryView: 'design' | 'code' | 'preview' | 'image' | 'animation';
}

export interface UserWorkspaceSettings {
  defaultViewport: 'desktop' | 'tablet' | 'mobile';
  snapToGrid: boolean;
  autoSave: boolean;
  defaultScreenCount: number;
  defaultExportFormat: 'zip' | 'png' | 'svg' | 'gif';
  notifyGeneration: boolean;
  notifyPayments: boolean;
  notifyDeployments: boolean;
  notifySecurity: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  emailVerified: boolean;
  oauthProvider?: string | null;
  preferredProvider: ProviderId;
  preferredModel: string;
  company?: string;
  jobTitle?: string;
  bio?: string;
  themePreference?: 'dark' | 'light';
  settings?: UserWorkspaceSettings;
  createdAt: string;
}

export interface TokenWallet {
  userId: string;
  availableTokens: number;
  reservedTokens: number;
  usedTokens: number;
  updatedAt: string;
}

export interface TokenTransaction {
  id: string;
  userId: string;
  jobId?: string | null;
  type: 'grant' | 'reserve' | 'settle' | 'refund' | 'purchase' | 'admin_adjust';
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export interface DesignSystem {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  headingFont: string;
  bodyFont: string;
  fontSize?: number;
  borderRadius: number;
  spacingScale: 'compact' | 'balanced' | 'spacious';
  buttonStyle?: 'solid' | 'outline' | 'soft' | 'sharp';
  textAlign?: 'left' | 'center' | 'right';
}

export interface SectionBlock {
  id: string;
  type: 'hero' | 'features' | 'stats' | 'gallery' | 'form' | 'pricing' | 'navigation' | 'footer' | 'custom';
  title: string;
  subtitle: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl?: string;
  items?: Array<{ title: string; description: string; metric?: string }>;
  backgroundColor?: string;
  textColor?: string;
  headingFont?: string;
  bodyFont?: string;
  fontSize?: number;
  paddingY?: number;
  paddingX?: number;
  marginY?: number;
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  buttonStyle?: 'solid' | 'outline' | 'soft' | 'sharp';
  textAlign?: 'left' | 'center' | 'right';
  backgroundStyle?: 'solid' | 'gradient' | 'surface';
  customId?: string;
  customClass?: string;
  maxWidth?: 'narrow' | 'standard' | 'wide' | 'full';
  hideOnDesktop?: boolean;
  hideOnTablet?: boolean;
  hideOnMobile?: boolean;
}

export interface ScreenNode {
  id: string;
  name: string;
  slug: string;
  viewport: 'desktop' | 'tablet' | 'mobile';
  sections: SectionBlock[];
  customHtml?: string;
  customCss?: string;
}

export interface ProjectFile {
  path: string;
  language: 'html' | 'css' | 'javascript' | 'typescript' | 'tsx' | 'json' | 'markdown';
  content: string;
}

export interface AnimationFrame {
  id: string;
  label: string;
  durationMs: number;
  backgroundColor: string;
  accentColor: string;
  headline: string;
  subline: string;
  shape: 'train' | 'pulse' | 'bars' | 'orbit' | 'wave';
  progress: number;
}

export interface ProjectRecord {
  id: string;
  userId: string;
  name: string;
  description: string;
  engineId: EngineId;
  providerId: ProviderId;
  modelId: string;
  status: 'active' | 'archived';
  designSystem: DesignSystem;
  screens: ScreenNode[];
  files: ProjectFile[];
  generatedImages: Array<{ id: string; title: string; mimeType: string; dataUrl: string; prompt: string }>;
  animationFrames: AnimationFrame[];
  gifDataUrl?: string | null;
  testReport?: {
    passed: boolean;
    scoreLabel: string;
    checks: Array<{ name: string; status: 'pass' | 'fixed' | 'warn'; detail: string }>;
    ranAt: string;
  } | null;
  publishedSlug?: string | null;
  publishedUrl?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  versionNumber: number;
  label: string;
  screens: ScreenNode[];
  files: ProjectFile[];
  designSystem: DesignSystem;
  createdAt: string;
}

export interface GenerationJob {
  id: string;
  userId: string;
  projectId?: string | null;
  engineId: EngineId;
  providerId: ProviderId;
  modelId: string;
  prompt: string;
  screenCount: number;
  estimatedTokens: number;
  reservedTokens: number;
  settledTokens: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'refunded';
  resultSummary?: string | null;
  errorMessage?: string | null;
  durationMs?: number | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface EngineLogEntry {
  id: string;
  jobId: string;
  engineId: EngineId;
  level: 'info' | 'warn' | 'error';
  message: string;
  createdAt: string;
}

export interface TokenPackage {
  id: string;
  name: string;
  tokens: number;
  priceInr: number;
  priceUsd: number;
  description: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  audience: string;
  priceMonthlyInr: number;
  priceMonthlyUsd: number;
  tokenAllowance: number;
  maxScreensPerJob: number;
  features: string[];
  sortOrder: number;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  gateway: 'cashfree';
  orderId: string;
  gatewayOrderId?: string | null;
  gatewayPaymentId?: string | null;
  packageId: string;
  tokensPurchased: number;
  amountInr: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';
  webhookVerified: boolean;
  createdAt: string;
}

export interface SharedProjectLink {
  id: string;
  projectId: string;
  shareToken: string;
  visibility: 'public' | 'private';
  permission: 'view' | 'duplicate';
  revoked: boolean;
  expiresAt?: string | null;
  createdAt: string;
}

export interface AssetItem {
  id: string;
  userId: string;
  projectId?: string | null;
  name: string;
  kind: 'uploaded' | 'generated' | 'gif' | 'logo' | 'icon';
  mimeType: string;
  dataUrl: string;
  sizeBytes: number;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  category: 'generation' | 'payment' | 'wallet' | 'project' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface DemoGalleryItem {
  id: string;
  title: string;
  category: string;
  engineId: EngineId;
  imageUrl: string;
  accentHex: string;
  prompt: string;
  screensHint: number;
}
