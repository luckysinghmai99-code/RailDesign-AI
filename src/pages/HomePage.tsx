import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  Download,
  ImagePlus,
  Layers,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { ModelSelector } from '../components/ModelSelector.tsx';
import { PromptTrainWrapper } from '../components/train/GlobalTrainSystem.tsx';
import { usePlatform } from '../context/PlatformContext.tsx';
import { apiRequest } from '../lib/api.ts';
import {
  DEMO_GALLERY,
  ENGINE_CATALOG,
  estimateGenerationTokens,
} from '../shared/catalog.ts';
import type { EngineId, ProviderId } from '../shared/types.ts';

const HERO_IMAGE = '/src/assets/images/hero_raildesign_studio_1795442197494.jpg';

const GALLERY_CATEGORIES = [
  'All',
  'Websites',
  'E-commerce',
  'Mobile applications',
  'SaaS dashboards',
  'Business websites',
  'Hotel and resort websites',
  'Portfolio websites',
  'Admin dashboards',
  'Product designs',
  'Posters',
  'Creative graphics',
  'Landing pages',
];

const FAQ_ITEMS = [
  {
    q: 'How does token pricing work for multi-screen projects?',
    a: '50 tokens cover up to 3 standard design screens under normal generation conditions. Additional screens add 15 tokens each, and you always see the exact estimated cost before generating.',
  },
  {
    q: 'Which AI providers and models are available?',
    a: 'RailDesign AI supports Google Gemini (Gemini 4 Hydrogen, Neon, Carbon, Flash Image), OpenAI ChatGPT models (GPT-4.1, o3-mini, GPT Image 1), and Anthropic Claude models (Sonnet 4, 3.7 Sonnet, 3.5 Haiku).',
  },
  {
    q: 'Can I edit generated designs and source code afterward?',
    a: 'Yes. Every generation opens in the post-generation Workspace where you can edit text, swap images, adjust colors and typography, manage up to 25 screens, edit HTML/CSS/JS/React files directly, and export PNG, JPG, SVG, GIF89a, or verified ZIP archives.',
  },
  {
    q: 'What happens if a generation fails mid-run?',
    a: 'Tokens are reserved before execution and settled only upon verified completion. If any upstream provider error occurs, reserved tokens are automatically refunded in full.',
  },
];

export function HomePage() {
  const {
    user,
    wallet,
    plans,
    navigate,
    setPendingPrompt,
    setActiveProjectId,
    setWallet,
  } = usePlatform();

  const promptSectionRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = useState(
    'Design a 3-screen SaaS analytics platform with executive KPI overview, customer retention cohorts, and workspace billing settings.'
  );
  const [engineId, setEngineId] = useState<EngineId | 'auto'>('auto');
  const [providerId, setProviderId] = useState<ProviderId>(user?.preferredProvider || 'google_gemini');
  const [modelId, setModelId] = useState<string>(user?.preferredModel || 'gemini-4-hydrogen');
  const [screenCount, setScreenCount] = useState(3);
  const [referenceImageDataUrl, setReferenceImageDataUrl] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  // Train ceremony + generation state
  const [isLooping, setIsLooping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [journeyStage, setJourneyStage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Support form state
  const [supportEmail, setSupportEmail] = useState(user?.email || '');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportStatus, setSupportStatus] = useState('');

  const estimatedTokens = useMemo(
    () =>
      estimateGenerationTokens({
        engineId: engineId === 'auto' ? 'engine01_website' : engineId,
        screenCount,
        prompt,
        hasReferenceImage: Boolean(referenceImageDataUrl),
      }),
    [engineId, screenCount, prompt, referenceImageDataUrl]
  );

  const filteredDemos = useMemo(() => {
    if (selectedCategory === 'All') return DEMO_GALLERY;
    return DEMO_GALLERY.filter((d) => d.category === selectedCategory);
  }, [selectedCategory]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setReferenceImageDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateClick = () => {
    setErrorMsg('');
    if (!prompt.trim()) {
      setErrorMsg('Please describe what you want to design or build.');
      return;
    }
    setJourneyStage('Looping locomotive around prompt payload...');
    setIsLooping(true);
  };

  const handleCeremonyComplete = async () => {
    setIsLooping(false);

    if (!user) {
      // Preserve prompt and uploaded reference image seamlessly across login/signup
      setPendingPrompt({
        prompt,
        engineId,
        providerId,
        modelId,
        screenCount,
        referenceImageDataUrl,
        autoGenerateAfterLogin: false,
      });
      navigate('login');
      return;
    }

    setIsGenerating(true);
    setJourneyStage('Dispatching to RailDesign AI orchestration queue...');
    try {
      const res = await apiRequest<{
        project: { id: string };
        wallet: typeof wallet;
      }>('/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          engineId,
          providerId,
          modelId,
          prompt,
          screenCount,
          referenceImageDataUrl,
        }),
      });
      if (res.wallet) setWallet(res.wallet);
      setActiveProjectId(res.project.id);
      navigate('workspace');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setIsGenerating(false);
      setJourneyStage('');
    }
  };

  const handleTryDemo = (item: (typeof DEMO_GALLERY)[number]) => {
    setPrompt(item.prompt);
    setEngineId(item.engineId);
    setScreenCount(item.screensHint);
    promptSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupportStatus('');
    try {
      await apiRequest('/api/support', {
        method: 'POST',
        body: JSON.stringify({
          email: supportEmail,
          category: 'support',
          subject: supportSubject,
          message: supportMessage,
        }),
      });
      setSupportStatus('Thank you. Your support ticket has been logged.');
      setSupportSubject('');
      setSupportMessage('');
    } catch (err) {
      setSupportStatus(err instanceof Error ? err.message : 'Unable to submit request.');
    }
  };

  return (
    <div className="relative z-10">
      {/* HERO SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-16 lg:pt-16 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-3">
              Six Independent AI Engines · Multi-Provider Orchestration
            </p>
            <h1
              className="font-display font-bold tracking-tight text-slate-900 dark:text-white leading-[1.08]"
              style={{ fontSize: 'clamp(2.25rem, 4vw, 3.65rem)', textWrap: 'balance' }}
            >
              Design, code, animate, and ship complete digital products on one rail.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              Enter a prompt once to generate multi-page websites, UI/UX app flows, graphics,
              production React code, binary GIF animations, and verified deployment bundles.
            </p>

            {/* HERO PROMPT BOX WITH 4-LOOP TRAIN CEREMONY */}
            <div ref={promptSectionRef} className="mt-8">
              <PromptTrainWrapper
                isLooping={isLooping}
                isGenerating={isGenerating}
                journeyStage={journeyStage}
                onCeremonyComplete={handleCeremonyComplete}
              >
                <div className="rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-[#0E131E] shadow-[0_14px_40px_-16px_rgba(15,23,42,0.12)] dark:shadow-[0_24px_56px_-20px_rgba(0,0,0,0.68)] overflow-hidden transition-all duration-200 focus-within:border-blue-600/80 dark:focus-within:border-blue-500/75 focus-within:ring-4 focus-within:ring-blue-600/10">
                  {/* Composer Header Controls */}
                  <div className="px-4 sm:px-5 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#121826]/70 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="flex items-center gap-2">
                        <label htmlFor="hero-engine-select" className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Engine
                        </label>
                        <select
                          id="hero-engine-select"
                          value={engineId}
                          onChange={(e) => setEngineId(e.target.value as EngineId | 'auto')}
                          className="rounded-lg border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-[#0A0E17] px-2.5 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                        >
                          <option value="auto">Auto-Route Best Engine</option>
                          {ENGINE_CATALOG.map((eng) => (
                            <option key={eng.id} value={eng.id}>
                              {eng.number}. {eng.shortName}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <label htmlFor="hero-screens" className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Screens
                        </label>
                        <select
                          id="hero-screens"
                          value={screenCount}
                          onChange={(e) => setScreenCount(Number(e.target.value))}
                          className="rounded-lg border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-[#0A0E17] px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                        >
                          {[1, 2, 3, 5, 8, 10].map((n) => (
                            <option key={n} value={n}>
                              {n} {n === 1 ? 'screen' : 'screens'}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      Est. {estimatedTokens} tokens
                    </span>
                  </div>

                  {/* Spacious Prompt Input & Provider Controls */}
                  <div className="px-4 sm:px-5 pt-4 pb-3.5 space-y-3.5">
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={4}
                      placeholder="Describe the website, app screens, brand poster, React module, or GIF animation you want to build..."
                      className="w-full min-h-[116px] sm:min-h-[128px] resize-y bg-transparent text-[15px] leading-[1.6] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                    />

                    {referenceImageDataUrl && (
                      <div className="flex items-center justify-between rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 px-3 py-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={referenceImageDataUrl}
                            alt="Uploaded reference"
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          />
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                            Reference image attached (+10 tokens)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReferenceImageDataUrl(null)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-500 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                          aria-label="Remove reference image"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <ModelSelector
                      providerId={providerId}
                      modelId={modelId}
                      onChange={(p, m) => {
                        setProviderId(p);
                        setModelId(m);
                      }}
                      compact
                    />

                    {errorMsg && (
                      <p className="text-xs text-red-600 dark:text-red-400 font-medium">{errorMsg}</p>
                    )}
                  </div>

                  {/* Composer Action Footer */}
                  <div className="px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0B0F17]/75 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#131926] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <ImagePlus className="w-4 h-4" />
                        Reference Image
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={isLooping || isGenerating}
                      onClick={handleGenerateClick}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold shadow-sm shadow-blue-600/25 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      {user ? 'Generate Project' : 'Generate & Continue'}
                    </button>
                  </div>
                </div>
              </PromptTrainWrapper>
            </div>
          </div>

          {/* Right Hero Visual Column */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="relative flex-1 min-h-[320px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900">
              {!imgErrors[HERO_IMAGE] ? (
                <img
                  src={HERO_IMAGE}
                  alt="RailDesign AI futuristic transit studio"
                  referrerPolicy="no-referrer"
                  onError={() => setImgErrors((prev) => ({ ...prev, [HERO_IMAGE]: true }))}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-blue-950 p-8 text-slate-200">
                  <Layers className="w-12 h-12 opacity-60" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent flex flex-col justify-end p-6">
                <p className="text-xs font-medium text-blue-300">
                  50 tokens · Covers up to 3 standard screens
                </p>
                <p className="mt-1 text-lg font-display font-semibold text-white">
                  From prompt to editable screens, live preview, binary GIF89a, and verified ZIP export.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DEMO GALLERY (12 Interactive Previews) */}
      <section id="explore" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 border-t border-slate-200 dark:border-slate-800/80">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white">
              Explore Design Blueprints
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Select any blueprint to load its full multi-screen prompt directly into the studio prompt box.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Showing {filteredDemos.length} of {DEMO_GALLERY.length} templates
          </span>
        </div>

        {/* Category Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-6">
          {GALLERY_CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDemos.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] overflow-hidden flex flex-col"
            >
              <div className="aspect-[4/3] bg-slate-900 overflow-hidden relative">
                {!imgErrors[item.imageUrl + item.id] ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    onError={() => setImgErrors((p) => ({ ...p, [item.imageUrl + item.id]: true }))}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-300 text-sm">
                    {item.title}
                  </div>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{item.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{item.screensHint} screens</span>
                  </div>
                  <h3 className="mt-1.5 text-base font-display font-semibold text-slate-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {item.prompt}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleTryDemo(item)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-blue-600 hover:border-blue-600 hover:text-white text-xs font-semibold text-slate-800 dark:text-slate-100 transition-colors cursor-pointer"
                >
                  Try This Design
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* SIX INDEPENDENT AI ENGINES */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 border-t border-slate-200 dark:border-slate-800/80">
        <div className="max-w-2xl mb-10">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white">
            Six Independent AI Engines
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Each stage of product creation runs on a dedicated engine with independent logging, validation, and provider routing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ENGINE_CATALOG.map((eng) => (
            <div
              key={eng.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-6"
            >
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-3">
                <span className="font-mono tabular-nums">Engine {eng.number}</span>
                <span className="font-mono tabular-nums">{eng.tokenBaseCost} base tokens</span>
              </div>
              <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-white">
                {eng.number}. {eng.name}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {eng.description}
              </p>
              <ul className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                {eng.capabilities.map((cap) => (
                  <li key={cap}>· {cap}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 border-t border-slate-200 dark:border-slate-800/80">
        <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white mb-8">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              step: '01. Prompt & Provider',
              desc: 'Write your specification, attach an optional reference image, and pick Gemini, OpenAI, or Claude.',
            },
            {
              step: '02. Express Orchestration',
              desc: 'Tokens are reserved atomically while the four-loop locomotive dispatches your job to the target engine.',
            },
            {
              step: '03. Visual & Code Editing',
              desc: 'Edit sections visually, manage up to 25 screens, inspect HTML/CSS/React files, and test in isolated preview.',
            },
            {
              step: '04. Export & Publish',
              desc: 'Export verified PNG, JPG, SVG, GIF89a, or complete ZIP bundles, generate share links, or publish live.',
            },
          ].map((item) => (
            <div key={item.step} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-5">
              <h3 className="text-base font-display font-semibold text-slate-900 dark:text-white">{item.step}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 border-t border-slate-200 dark:border-slate-800/80">
        <div className="max-w-2xl mb-10">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white">
            Transparent Token & Plan Pricing
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            50 tokens cover up to 3 standard design screens. Top up anytime via Cashfree.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-xl border p-5 flex flex-col justify-between ${
                plan.id === 'pro'
                  ? 'border-blue-600 bg-blue-600/5 dark:bg-blue-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]'
              }`}
            >
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{plan.audience}</p>
                <h3 className="mt-1 text-lg font-display font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1 font-mono tabular-nums">
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    ₹{plan.priceMonthlyInr.toLocaleString()}
                  </span>
                  <span className="text-xs text-slate-500">/mo</span>
                </div>
                <p className="mt-1 text-xs font-mono tabular-nums text-blue-600 dark:text-blue-400">
                  {plan.tokenAllowance.toLocaleString()} tokens · Up to {plan.maxScreensPerJob} screens/job
                </p>
                <ul className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  {plan.features.map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => navigate(user ? 'wallet' : 'signup')}
                className={`mt-6 w-full py-2 px-4 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  plan.id === 'pro'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {plan.priceMonthlyInr === 0 ? 'Start Free' : `Choose ${plan.name}`}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ & SUPPORT */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 border-t border-slate-200 dark:border-slate-800/80">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7">
            <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white mb-6">
              Frequently Asked Questions
            </h2>
            <div className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
              {FAQ_ITEMS.map((faq, idx) => {
                const open = openFaqIdx === idx;
                return (
                  <div key={faq.q} className="py-4">
                    <button
                      type="button"
                      onClick={() => setOpenFaqIdx(open ? null : idx)}
                      className="w-full flex items-center justify-between gap-4 text-left text-sm font-semibold text-slate-900 dark:text-white cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{faq.a}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-6">
              <h3 className="text-lg font-display font-semibold text-slate-900 dark:text-white">
                Contact & Support
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Questions about enterprise deployment, API adapters, or billing? Send a message.
              </p>
              <form onSubmit={handleSupportSubmit} className="mt-4 space-y-3">
                <input
                  type="email"
                  required
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="Work email"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  required
                  value={supportSubject}
                  onChange={(e) => setSupportSubject(e.target.value)}
                  placeholder="Subject"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <textarea
                  required
                  rows={3}
                  value={supportMessage}
                  onChange={(e) => setSupportMessage(e.target.value)}
                  placeholder="How can we help?"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Send Support Request
                </button>
                {supportStatus && <p className="text-xs text-blue-600 dark:text-blue-400">{supportStatus}</p>}
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* QUIET FOOTER */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-[#090B10]/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-4">
            <span className="font-display font-semibold text-slate-900 dark:text-white">RailDesign AI</span>
            <span>Six-Engine AI Creative & Engineering Platform</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/api/platform/download-zip"
              download="raildesign-ai-platform.zip"
              className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              Download Platform Source ZIP
            </a>
            <button onClick={() => navigate('login')} className="hover:text-slate-900 dark:hover:text-white cursor-pointer">
              Sign In
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
