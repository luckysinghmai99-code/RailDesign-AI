import type {
  DemoGalleryItem,
  DesignSystem,
  EngineId,
  EngineMetadata,
  PricingPlan,
  ProviderId,
  ProviderModel,
  TokenPackage,
} from './types.ts';

export const PROVIDER_DEFINITIONS: Record<
  ProviderId,
  { name: string; shortName: string; defaultModel: string; models: ProviderModel[] }
> = {
  google_gemini: {
    name: 'Google Gemini',
    shortName: 'Gemini',
    defaultModel: 'gemini-4-hydrogen',
    models: [
      {
        id: 'gemini-4-hydrogen',
        label: 'Gemini 4 Hydrogen',
        description: 'Fast multimodal generation for websites, UI screens, and structured layouts.',
        capabilities: { text: true, code: true, vision: true, imageGeneration: false },
        tier: 'standard',
      },
      {
        id: 'gemini-4-neon',
        label: 'Gemini 4 Neon',
        description: 'High-precision reasoning for complex React architectures and multi-page apps.',
        capabilities: { text: true, code: true, vision: true, imageGeneration: false },
        tier: 'pro',
      },
      {
        id: 'gemini-4-carbon',
        label: 'Gemini 4 Carbon',
        description: 'Deep architectural synthesis, refactoring, and automated security auditing.',
        capabilities: { text: true, code: true, vision: true, imageGeneration: false },
        tier: 'deep',
      },
      {
        id: 'gemini-3.1-flash-lite-image',
        label: 'Gemini Flash Image',
        description: 'Native image generation and reference-guided graphic editing.',
        capabilities: { text: false, code: false, vision: true, imageGeneration: true },
        tier: 'standard',
      },
    ],
  },
  openai_chatgpt: {
    name: 'OpenAI — ChatGPT Models',
    shortName: 'OpenAI',
    defaultModel: 'gpt-4.1',
    models: [
      {
        id: 'gpt-4.1',
        label: 'GPT-4.1',
        description: 'Flagship instruction-following and multi-file frontend code generation.',
        capabilities: { text: true, code: true, vision: true, imageGeneration: false },
        tier: 'pro',
      },
      {
        id: 'gpt-4.1-mini',
        label: 'GPT-4.1 Mini',
        description: 'Low-latency UI generation, copywriting, and component revisions.',
        capabilities: { text: true, code: true, vision: true, imageGeneration: false },
        tier: 'standard',
      },
      {
        id: 'o3-mini',
        label: 'OpenAI o3-mini',
        description: 'Structured engineering reasoning and algorithmic problem solving.',
        capabilities: { text: true, code: true, vision: false, imageGeneration: false },
        tier: 'deep',
      },
      {
        id: 'gpt-image-1',
        label: 'GPT Image 1',
        description: 'High-resolution raster product visuals and marketing graphics.',
        capabilities: { text: false, code: false, vision: true, imageGeneration: true },
        tier: 'pro',
      },
    ],
  },
  anthropic_claude: {
    name: 'Anthropic — Claude Models',
    shortName: 'Claude',
    defaultModel: 'claude-sonnet-4-20250514',
    models: [
      {
        id: 'claude-sonnet-4-20250514',
        label: 'Claude Sonnet 4',
        description: 'Precision full-stack engineering, layout craft, and clean TypeScript output.',
        capabilities: { text: true, code: true, vision: true, imageGeneration: false },
        tier: 'pro',
      },
      {
        id: 'claude-3-7-sonnet-20250219',
        label: 'Claude 3.7 Sonnet',
        description: 'Extended reasoning for design systems and complex multi-screen flows.',
        capabilities: { text: true, code: true, vision: true, imageGeneration: false },
        tier: 'deep',
      },
      {
        id: 'claude-3-5-haiku-20241022',
        label: 'Claude 3.5 Haiku',
        description: 'Rapid design copy edits, responsive CSS adjustments, and quick iterations.',
        capabilities: { text: true, code: true, vision: true, imageGeneration: false },
        tier: 'standard',
      },
    ],
  },
};

export const ENGINE_CATALOG: EngineMetadata[] = [
  {
    id: 'engine01_website',
    number: '01',
    name: 'Website Design Engine',
    shortName: 'Website Design',
    description: 'Generates responsive landing pages, multi-page websites, HTML/CSS/JS/React bundles, navigation, and lead forms.',
    capabilities: ['Multi-page websites', 'Responsive HTML/CSS/JS', 'React layouts', 'Contact & lead forms'],
    tokenBaseCost: 50,
    supportsMultiScreen: true,
    primaryView: 'design',
  },
  {
    id: 'engine02_app_uiux',
    number: '02',
    name: 'App & UI/UX Engine',
    shortName: 'App & UI/UX',
    description: 'Crafts connected mobile and desktop interfaces, SaaS dashboards, admin panels, and consistent design systems.',
    capabilities: ['SaaS dashboards', 'Mobile app screens', 'Auth & onboarding flows', 'Design token systems'],
    tokenBaseCost: 50,
    supportsMultiScreen: true,
    primaryView: 'design',
  },
  {
    id: 'engine03_graphic_image',
    number: '03',
    name: 'Image & Graphic Design Engine',
    shortName: 'Graphics & Images',
    description: 'Produces campaign posters, banners, product mockups, social assets, and reference-guided visual compositions.',
    capabilities: ['AI image generation', 'Posters & banners', 'Product mockups', 'Reference analysis'],
    tokenBaseCost: 35,
    supportsMultiScreen: false,
    primaryView: 'image',
  },
  {
    id: 'engine04_coding',
    number: '04',
    name: 'AI Coding Engine',
    shortName: 'AI Coding',
    description: 'Writes production React components, Express API endpoints, refactors existing modules, and resolves runtime errors.',
    capabilities: ['React & TypeScript', 'Backend API routes', 'Debugging & refactoring', 'Project file generation'],
    tokenBaseCost: 45,
    supportsMultiScreen: true,
    primaryView: 'code',
  },
  {
    id: 'engine05_animation_gif',
    number: '05',
    name: 'Animation & GIF Engine',
    shortName: 'Animation & GIF',
    description: 'Builds frame-by-frame motion sequences, animated web banners, loading states, and verified binary GIF89a exports.',
    capabilities: ['Binary GIF89a export', 'Frame duration control', 'Animated banners', 'Loading sequences'],
    tokenBaseCost: 40,
    supportsMultiScreen: false,
    primaryView: 'animation',
  },
  {
    id: 'engine06_testing_export',
    number: '06',
    name: 'Testing & Export Engine',
    shortName: 'Testing & Export',
    description: 'Runs syntax validation, responsive layout checks, automated error fixes, and compiles verified ZIP bundles.',
    capabilities: ['Automated code checks', 'Responsive audit', 'Auto-fix repair', 'Verified ZIP packaging'],
    tokenBaseCost: 20,
    supportsMultiScreen: true,
    primaryView: 'preview',
  },
];

export const DEFAULT_DESIGN_SYSTEM: DesignSystem = {
  primaryColor: '#2563EB',
  secondaryColor: '#0EA5E9',
  backgroundColor: '#0B0E14',
  surfaceColor: '#131823',
  textColor: '#F8FAFC',
  headingFont: 'Outfit',
  bodyFont: 'Plus Jakarta Sans',
  borderRadius: 10,
  spacingScale: 'balanced',
};

export const DEMO_GALLERY: DemoGalleryItem[] = [
  {
    id: 'demo-saas-analytics',
    title: 'Meridian Financial Analytics',
    category: 'SaaS dashboards',
    engineId: 'engine02_app_uiux',
    imageUrl: '/src/assets/images/demo_saas_analytics_1795442196365.jpg',
    accentHex: '#2563EB',
    screensHint: 3,
    prompt:
      'Design a 3-screen enterprise SaaS financial analytics dashboard named Meridian with executive KPI overview, cohort retention matrix, and regional revenue breakdown in crisp cobalt and slate.',
  },
  {
    id: 'demo-resort-editorial',
    title: 'Caldera Cliffside Sanctuary',
    category: 'Hotel and resort websites',
    engineId: 'engine01_website',
    imageUrl: '/src/assets/images/demo_resort_editorial_1795442195956.jpg',
    accentHex: '#D97706',
    screensHint: 3,
    prompt:
      'Build a 3-page luxury coastal cliffside resort website called Caldera Sanctuary featuring suite reservations, architectural gallery, dining menu, and concierge booking form.',
  },
  {
    id: 'demo-ecommerce-watch',
    title: 'Aeon Horology Storefront',
    category: 'E-commerce',
    engineId: 'engine01_website',
    imageUrl: '/src/assets/images/demo_ecommerce_watch_1795442197219.jpg',
    accentHex: '#475569',
    screensHint: 3,
    prompt:
      'Create a minimalist luxury mechanical watch e-commerce storefront named Aeon Horology with collection grid, caliber specification comparison, and streamlined checkout drawer.',
  },
  {
    id: 'demo-mobile-fintech',
    title: 'Veloce Private Wealth App',
    category: 'Mobile applications',
    engineId: 'engine02_app_uiux',
    imageUrl: '/src/assets/images/demo_mobile_fintech_1795442195913.jpg',
    accentHex: '#1D4ED8',
    screensHint: 3,
    prompt:
      'Design a 3-screen mobile wealth management application called Veloce with portfolio performance chart, instant transfer sheet, and asset allocation breakdown.',
  },
  {
    id: 'demo-business-logistics',
    title: 'Northstar Freight & Rail',
    category: 'Business websites',
    engineId: 'engine01_website',
    imageUrl: '/src/assets/images/hero_raildesign_studio_1795442197494.jpg',
    accentHex: '#0284C7',
    screensHint: 3,
    prompt:
      'Build a B2B global rail freight & logistics corporate website named Northstar Transit with route corridor calculator, fleet telemetry highlights, and enterprise RFQ form.',
  },
  {
    id: 'demo-portfolio-architect',
    title: 'Klara Lindqvist Architecture',
    category: 'Portfolio websites',
    engineId: 'engine01_website',
    imageUrl: '/src/assets/images/demo_resort_editorial_1795442195956.jpg',
    accentHex: '#334155',
    screensHint: 2,
    prompt:
      'Design a minimalist architectural studio portfolio for Klara Lindqvist featuring selected timber and concrete residences, studio monograph, and project inquiry page.',
  },
  {
    id: 'demo-admin-ops',
    title: 'PulseGrid Fleet Operations',
    category: 'Admin dashboards',
    engineId: 'engine02_app_uiux',
    imageUrl: '/src/assets/images/demo_saas_analytics_1795442196365.jpg',
    accentHex: '#0F766E',
    screensHint: 3,
    prompt:
      'Create an enterprise admin operations dashboard named PulseGrid for managing 600+ concurrent worker nodes, role permissions, audit logs, and billing queues.',
  },
  {
    id: 'demo-product-audio',
    title: 'Monolith Studio Reference DAC',
    category: 'Product designs',
    engineId: 'engine03_graphic_image',
    imageUrl: '/src/assets/images/demo_ecommerce_watch_1795442197219.jpg',
    accentHex: '#B45309',
    screensHint: 1,
    prompt:
      'Generate an industrial product launch visual and technical spec sheet for Monolith Reference DAC crafted in brushed anodized aluminum and walnut.',
  },
  {
    id: 'demo-poster-symposium',
    title: 'Zurich Transit Design Expo',
    category: 'Posters',
    engineId: 'engine03_graphic_image',
    imageUrl: '/src/assets/images/hero_raildesign_studio_1795442197494.jpg',
    accentHex: '#DC2626',
    screensHint: 1,
    prompt:
      'Create a Swiss-inspired international design symposium poster for Zurich Transit Expo 2026 with bold geometric grid typography and architectural balance.',
  },
  {
    id: 'demo-graphics-launch',
    title: 'Kinetix Motion Brand Kit',
    category: 'Creative graphics',
    engineId: 'engine05_animation_gif',
    imageUrl: '/src/assets/images/demo_mobile_fintech_1795442195913.jpg',
    accentHex: '#2563EB',
    screensHint: 1,
    prompt:
      'Create a 6-frame animated product announcement banner and looping GIF sequence for Kinetix Motion Labs with crisp geometric transitions.',
  },
  {
    id: 'demo-landing-devtools',
    title: 'Relay CI Deployment Cloud',
    category: 'Landing pages',
    engineId: 'engine01_website',
    imageUrl: '/src/assets/images/demo_saas_analytics_1795442196365.jpg',
    accentHex: '#2563EB',
    screensHint: 2,
    prompt:
      'Build a high-converting developer infrastructure landing page for Relay CI showing zero-downtime edge pipelines, benchmark comparison table, and pricing tiers.',
  },
  {
    id: 'demo-website-clinic',
    title: 'Helios Preventive Diagnostics',
    category: 'Websites',
    engineId: 'engine01_website',
    imageUrl: '/src/assets/images/demo_ecommerce_watch_1795442197219.jpg',
    accentHex: '#0D9488',
    screensHint: 3,
    prompt:
      'Build a modern 3-page preventive diagnostics clinic website called Helios Health with biomarker packages, physician directory, and appointment booking.',
  },
];

export const DEFAULT_TOKEN_PACKAGES: TokenPackage[] = [
  {
    id: 'pkg_100',
    name: 'Starter Top-Up',
    tokens: 150,
    priceInr: 249,
    priceUsd: 3,
    description: 'Covers up to 9 standard screens across any engine.',
  },
  {
    id: 'pkg_500',
    name: 'Builder Pack',
    tokens: 600,
    priceInr: 799,
    priceUsd: 10,
    description: 'Ideal for multi-page client websites, apps, and code iterations.',
  },
  {
    id: 'pkg_1500',
    name: 'Studio Pack',
    tokens: 1800,
    priceInr: 1999,
    priceUsd: 24,
    description: 'Full creative suite capacity including image & GIF generation.',
  },
  {
    id: 'pkg_5000',
    name: 'Enterprise Rail Pack',
    tokens: 6000,
    priceInr: 5499,
    priceUsd: 65,
    description: 'High-volume multi-engine production throughput for agencies.',
  },
];

export const DEFAULT_PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    audience: 'For individual exploration',
    priceMonthlyInr: 0,
    priceMonthlyUsd: 0,
    tokenAllowance: 100,
    maxScreensPerJob: 3,
    features: [
      '100 starter tokens (covers up to 6 screens)',
      'Access to all 6 AI engines',
      'HTML/CSS/JS & Live Preview',
      '1 active project with version history',
    ],
    sortOrder: 1,
  },
  {
    id: 'starter',
    name: 'Starter',
    audience: 'For freelance designers',
    priceMonthlyInr: 799,
    priceMonthlyUsd: 10,
    tokenAllowance: 600,
    maxScreensPerJob: 5,
    features: [
      '600 monthly tokens included',
      'Up to 5 connected screens per generation',
      'PNG, JPG, SVG & ZIP source exports',
      'Public & private share links',
    ],
    sortOrder: 2,
  },
  {
    id: 'pro',
    name: 'Pro',
    audience: 'For product teams & studios',
    priceMonthlyInr: 1999,
    priceMonthlyUsd: 24,
    tokenAllowance: 2000,
    maxScreensPerJob: 10,
    features: [
      '2,000 monthly tokens included',
      'Up to 10 screens per multi-page project',
      'Binary GIF89a & AI image generation',
      'React + Express full-stack code export',
    ],
    sortOrder: 3,
  },
  {
    id: 'premium',
    name: 'Premium',
    audience: 'For high-output creative agencies',
    priceMonthlyInr: 4499,
    priceMonthlyUsd: 54,
    tokenAllowance: 5500,
    maxScreensPerJob: 15,
    features: [
      '5,500 monthly tokens included',
      'Priority 600-concurrency worker lane',
      'One-click static & Vercel publishing',
      'Unlimited version snapshots & asset storage',
    ],
    sortOrder: 4,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    audience: 'For scaling engineering orgs',
    priceMonthlyInr: 11999,
    priceMonthlyUsd: 145,
    tokenAllowance: 20000,
    maxScreensPerJob: 25,
    features: [
      '20,000 monthly tokens & custom pool',
      'Dedicated provider key routing (Gemini, OpenAI, Claude)',
      'Role-based admin control & audit trails',
      'SLA-backed deployment support',
    ],
    sortOrder: 5,
  },
];

export function estimateGenerationTokens(params: {
  engineId: EngineId;
  screenCount: number;
  prompt: string;
  hasReferenceImage?: boolean;
}): number {
  const { engineId, screenCount, prompt, hasReferenceImage } = params;
  const clampedScreens = Math.max(1, Math.min(25, screenCount));

  // Standard rule: 50 tokens covers up to 3 standard design screens under normal conditions.
  let base = 50;
  if (engineId === 'engine06_testing_export') {
    base = 20;
  } else if (engineId === 'engine03_graphic_image') {
    base = 35;
  } else if (engineId === 'engine05_animation_gif') {
    base = 40;
  } else if (engineId === 'engine04_coding') {
    base = 45;
  }

  const extraScreens = Math.max(0, clampedScreens - 3);
  const extraScreenCost = extraScreens * 15;
  const longPromptExtra = prompt.length > 400 ? Math.min(25, Math.ceil((prompt.length - 400) / 200) * 5) : 0;
  const refImageExtra = hasReferenceImage ? 10 : 0;

  return base + extraScreenCost + longPromptExtra + refImageExtra;
}
