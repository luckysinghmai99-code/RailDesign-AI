import { addEngineLog, newId } from '../db/database.ts';
import { getProviderAdapter, withProviderRetry } from '../providers/registry.ts';
import type {
  AnimationFrame,
  DesignSystem,
  EngineId,
  ProjectFile,
  ProjectRecord,
  ProviderId,
  ScreenNode,
  SectionBlock,
} from '../../shared/types.ts';

export interface EngineContext {
  jobId: string;
  userId: string;
  providerId: ProviderId;
  modelId: string;
  prompt: string;
  screenCount: number;
  referenceImageDataUrl?: string | null;
  existingProject?: ProjectRecord | null;
}

export interface EngineOutput {
  summary: string;
  designSystem?: DesignSystem;
  screens?: ScreenNode[];
  files?: ProjectFile[];
  generatedImages?: ProjectRecord['generatedImages'];
  animationFrames?: AnimationFrame[];
  gifDataUrl?: string | null;
  testReport?: ProjectRecord['testReport'];
}

export interface IndependentEngine {
  readonly id: EngineId;
  readonly name: string;
  execute(ctx: EngineContext): Promise<EngineOutput>;
}

export function logEngine(jobId: string, engineId: EngineId, level: 'info' | 'warn' | 'error', message: string): void {
  addEngineLog(jobId, engineId, level, message);
}

export function extractJsonFromText<T>(raw: string): T {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as T;
    }
    throw new Error('Failed to parse structured JSON output from AI provider.');
  }
}

export async function callProviderText(params: {
  ctx: EngineContext;
  engineId: EngineId;
  systemInstruction: string;
  userPrompt: string;
  expectJson?: boolean;
}): Promise<string> {
  const { ctx, engineId, systemInstruction, userPrompt, expectJson } = params;
  const adapter = getProviderAdapter(ctx.providerId);
  logEngine(ctx.jobId, engineId, 'info', `Dispatching request to ${ctx.providerId} (${ctx.modelId})`);

  const result = await withProviderRetry(() =>
    adapter.generateText({
      modelId: ctx.modelId,
      systemInstruction,
      prompt: userPrompt,
      referenceImageDataUrl: ctx.referenceImageDataUrl,
      expectJson,
    })
  );

  logEngine(ctx.jobId, engineId, 'info', `Received ${result.text.length} chars from ${result.providerId}`);
  return result.text;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function compileScreensToProjectFiles(
  projectName: string,
  designSystem: DesignSystem,
  screens: ScreenNode[]
): ProjectFile[] {
  const navLinks = screens
    .map(
      (s, i) =>
        `<button class="rd-nav-btn${i === 0 ? ' active' : ''}" data-screen="${escapeHtml(s.id)}">${escapeHtml(s.name)}</button>`
    )
    .join('\n        ');

  const screensHtml = screens
    .map((screen, idx) => {
      const sectionsMarkup = screen.sections
        .map((sec: SectionBlock) => {
          const itemsMarkup =
            sec.items && sec.items.length > 0
              ? `<div class="rd-grid">${sec.items
                  .map(
                    (it) => `<div class="rd-card">
                ${it.metric ? `<div class="rd-metric">${escapeHtml(it.metric)}</div>` : ''}
                <h3>${escapeHtml(it.title)}</h3>
                <p>${escapeHtml(it.description)}</p>
              </div>`
                  )
                  .join('')}</div>`
              : '';

          const formMarkup =
            sec.type === 'form'
              ? `<form class="rd-form" onsubmit="event.preventDefault(); this.querySelector('.rd-form-status').textContent='Submitted successfully';">
                  <input type="text" placeholder="Your name" required />
                  <input type="email" placeholder="Work email" required />
                  <button type="submit" class="rd-btn">${escapeHtml(sec.ctaLabel || 'Submit')}</button>
                  <p class="rd-form-status" aria-live="polite"></p>
                </form>`
              : '';

          const bgStyle = sec.backgroundColor ? ` style="background:${escapeHtml(sec.backgroundColor)};"` : '';
          return `<section class="rd-section rd-type-${escapeHtml(sec.type)}"${bgStyle}>
            <div class="rd-container">
              ${sec.subtitle ? `<p class="rd-kicker">${escapeHtml(sec.subtitle)}</p>` : ''}
              <h2>${escapeHtml(sec.title)}</h2>
              <p class="rd-body">${escapeHtml(sec.body)}</p>
              ${sec.type !== 'form' && sec.ctaLabel ? `<a href="${escapeHtml(sec.ctaHref || '#')}" class="rd-btn">${escapeHtml(sec.ctaLabel)}</a>` : ''}
              ${itemsMarkup}
              ${formMarkup}
            </div>
          </section>`;
        })
        .join('\n');

      return `<div class="rd-screen${idx === 0 ? ' is-active' : ''}" id="screen-${escapeHtml(screen.id)}">
        ${sectionsMarkup}
      </div>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(projectName)}</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <header class="rd-header">
    <div class="rd-container rd-header-inner">
      <strong class="rd-brand">${escapeHtml(projectName)}</strong>
      <nav class="rd-nav">
        ${navLinks}
      </nav>
    </div>
  </header>
  <main>
    ${screensHtml}
  </main>
  <footer class="rd-footer">
    <div class="rd-container">
      <span>${escapeHtml(projectName)}</span>
      <span>Built with RailDesign AI</span>
    </div>
  </footer>
  <script src="./app.js"></script>
</body>
</html>`;

  const css = `:root {
  --primary: ${designSystem.primaryColor};
  --secondary: ${designSystem.secondaryColor};
  --bg: ${designSystem.backgroundColor};
  --surface: ${designSystem.surfaceColor};
  --text: ${designSystem.textColor};
  --radius: ${designSystem.borderRadius}px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: '${designSystem.bodyFont}', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
}
h1, h2, h3 { font-family: '${designSystem.headingFont}', system-ui, sans-serif; line-height: 1.15; }
.rd-container { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
.rd-header { border-bottom: 1px solid rgba(148,163,184,0.18); position: sticky; top: 0; background: var(--bg); z-index: 10; }
.rd-header-inner { display: flex; align-items: center; justify-content: space-between; min-height: 64px; gap: 16px; }
.rd-brand { font-size: 1.125rem; font-weight: 700; }
.rd-nav { display: flex; gap: 8px; flex-wrap: wrap; }
.rd-nav-btn { background: transparent; border: 1px solid transparent; color: inherit; opacity: 0.75; padding: 6px 12px; border-radius: var(--radius); cursor: pointer; font: inherit; font-size: 0.875rem; }
.rd-nav-btn.active, .rd-nav-btn:hover { opacity: 1; background: var(--surface); border-color: rgba(148,163,184,0.22); }
.rd-screen { display: none; }
.rd-screen.is-active { display: block; }
.rd-section { padding: 64px 0; border-bottom: 1px solid rgba(148,163,184,0.12); }
.rd-kicker { font-size: 0.85rem; color: var(--secondary); font-weight: 600; margin-bottom: 10px; }
.rd-section h2 { font-size: clamp(1.75rem, 3vw, 2.75rem); margin-bottom: 16px; max-width: 24ch; }
.rd-body { max-width: 64ch; opacity: 0.82; margin-bottom: 24px; }
.rd-btn { display: inline-block; background: var(--primary); color: #ffffff; padding: 11px 22px; border-radius: var(--radius); text-decoration: none; font-weight: 600; border: 0; cursor: pointer; }
.rd-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-top: 32px; }
.rd-card { background: var(--surface); border: 1px solid rgba(148,163,184,0.16); border-radius: var(--radius); padding: 22px; }
.rd-card h3 { font-size: 1.05rem; margin-bottom: 8px; }
.rd-card p { font-size: 0.92rem; opacity: 0.8; }
.rd-metric { font-size: 1.5rem; font-weight: 700; color: var(--secondary); margin-bottom: 8px; }
.rd-form { display: flex; flex-direction: column; gap: 12px; max-width: 420px; margin-top: 16px; }
.rd-form input { padding: 11px 14px; border-radius: var(--radius); border: 1px solid rgba(148,163,184,0.25); background: var(--surface); color: var(--text); }
.rd-footer { padding: 32px 0; font-size: 0.85rem; opacity: 0.7; }
.rd-footer .rd-container { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
`;

  const js = `document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('.rd-nav-btn');
  const screens = document.querySelectorAll('.rd-screen');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = 'screen-' + btn.getAttribute('data-screen');
      buttons.forEach((b) => b.classList.remove('active'));
      screens.forEach((s) => s.classList.remove('is-active'));
      btn.classList.add('active');
      const target = document.getElementById(targetId);
      if (target) target.classList.add('is-active');
    });
  });
});
`;

  const reactTsx = `import React, { useState } from 'react';

const SCREENS = ${JSON.stringify(
    screens.map((s) => ({ id: s.id, name: s.name, sections: s.sections })),
    null,
    2
  )};

export default function GeneratedApp() {
  const [activeScreenId, setActiveScreenId] = useState(SCREENS[0]?.id ?? '');
  const current = SCREENS.find((s) => s.id === activeScreenId) ?? SCREENS[0];

  return (
    <div style={{ background: '${designSystem.backgroundColor}', color: '${designSystem.textColor}', minHeight: '100vh' }}>
      <header style={{ borderBottom: '1px solid rgba(148,163,184,0.2)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>${projectName.replace(/'/g, "\\'")}</strong>
        <nav style={{ display: 'flex', gap: 8 }}>
          {SCREENS.map((scr) => (
            <button
              key={scr.id}
              onClick={() => setActiveScreenId(scr.id)}
              style={{
                padding: '6px 12px',
                borderRadius: ${designSystem.borderRadius},
                background: scr.id === activeScreenId ? '${designSystem.primaryColor}' : 'transparent',
                color: '${designSystem.textColor}',
                border: '1px solid rgba(148,163,184,0.25)',
                cursor: 'pointer',
              }}
            >
              {scr.name}
            </button>
          ))}
        </nav>
      </header>
      <main style={{ maxWidth: 1120, margin: '0 auto', padding: '48px 24px' }}>
        {current?.sections.map((sec) => (
          <section key={sec.id} style={{ marginBottom: 48 }}>
            <p style={{ color: '${designSystem.secondaryColor}', fontSize: 13, fontWeight: 600 }}>{sec.subtitle}</p>
            <h2 style={{ fontSize: 32, margin: '8px 0 12px' }}>{sec.title}</h2>
            <p style={{ opacity: 0.85, maxWidth: 680 }}>{sec.body}</p>
          </section>
        ))}
      </main>
    </div>
  );
}
`;

  return [
    { path: 'index.html', language: 'html', content: html },
    { path: 'styles.css', language: 'css', content: css },
    { path: 'app.js', language: 'javascript', content: js },
    { path: 'src/App.tsx', language: 'tsx', content: reactTsx },
  ];
}

export function normalizeScreens(rawScreens: unknown, fallbackTitle: string, screenCount: number): ScreenNode[] {
  const arr = Array.isArray(rawScreens) ? rawScreens : [];
  const normalized: ScreenNode[] = arr.slice(0, 25).map((item: Record<string, unknown>, idx) => {
    const rawSections = Array.isArray(item?.sections) ? item.sections : [];
    const sections: SectionBlock[] = rawSections.map((s: Record<string, unknown>) => ({
      id: newId('sec'),
      type: (['hero', 'features', 'stats', 'gallery', 'form', 'pricing', 'navigation', 'footer', 'custom'].includes(
        String(s?.type || '')
      )
        ? String(s.type)
        : 'features') as SectionBlock['type'],
      title: String(s?.title || `${fallbackTitle} Section`),
      subtitle: String(s?.subtitle || ''),
      body: String(s?.body || ''),
      ctaLabel: String(s?.ctaLabel || 'Continue'),
      ctaHref: String(s?.ctaHref || '#'),
      items: Array.isArray(s?.items)
        ? s.items.map((it: Record<string, unknown>) => ({
            title: String(it?.title || 'Item'),
            description: String(it?.description || ''),
            metric: it?.metric ? String(it.metric) : undefined,
          }))
        : undefined,
    }));

    return {
      id: newId('scr'),
      name: String(item?.name || `Screen ${idx + 1}`),
      slug: String(item?.slug || (idx === 0 ? '/' : `/screen-${idx + 1}`)),
      viewport: 'desktop',
      sections:
        sections.length > 0
          ? sections
          : [
              {
                id: newId('sec'),
                type: 'hero',
                title: String(item?.name || fallbackTitle),
                subtitle: 'Overview',
                body: 'Edit this screen directly in the visual workspace.',
                ctaLabel: 'Explore',
                ctaHref: '#details',
              },
            ],
    };
  });

  while (normalized.length < screenCount) {
    const idx = normalized.length + 1;
    normalized.push({
      id: newId('scr'),
      name: `Screen ${idx}`,
      slug: `/screen-${idx}`,
      viewport: 'desktop',
      sections: [
        {
          id: newId('sec'),
          type: 'features',
          title: `${fallbackTitle} — View ${idx}`,
          subtitle: `Screen ${idx}`,
          body: 'Structured screen ready for visual or AI editing.',
          ctaLabel: 'Continue',
          ctaHref: '#',
        },
      ],
    });
  }

  return normalized;
}
