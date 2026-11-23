import type { DesignSystem, ProjectRecord, ScreenNode } from '../../shared/types.ts';

function esc(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildIsolatedSrcDoc(project: ProjectRecord, activeScreenId?: string): string {
  const htmlFile = project.files.find((f) => f.path === 'index.html');
  const cssFile = project.files.find((f) => f.path === 'styles.css');
  const jsFile = project.files.find((f) => f.path === 'app.js');

  // If user edited raw HTML/CSS/JS directly and project has custom files without screens, render files directly
  if (htmlFile && (project.engineId === 'engine04_coding' || project.engineId === 'engine03_graphic_image' || project.engineId === 'engine05_animation_gif')) {
    let doc = htmlFile.content;
    if (cssFile) {
      doc = doc.replace(/<link[^>]*href=["']\.?\/?styles\.css["'][^>]*>/i, `<style>${cssFile.content}</style>`);
    }
    if (jsFile) {
      doc = doc.replace(/<script[^>]*src=["']\.?\/?app\.js["'][^>]*><\/script>/i, `<script>${jsFile.content}</script>`);
    }
    return doc;
  }

  const ds: DesignSystem = project.designSystem;
  const screens = project.screens || [];
  const startId = activeScreenId || screens[0]?.id || '';

  const navButtons = screens
    .map(
      (s) =>
        `<button class="rd-nav-btn${s.id === startId ? ' active' : ''}" data-screen="${esc(s.id)}">${esc(s.name)}</button>`
    )
    .join('');

  const screensMarkup = screens
    .map((scr: ScreenNode) => {
      const sectionsHtml = scr.sections
        .map((sec) => {
          const padY = sec.paddingY ?? (ds.spacingScale === 'compact' ? 40 : ds.spacingScale === 'spacious' ? 84 : 60);
          const padX = sec.paddingX ?? 24;
          const marY = sec.marginY ?? 0;
          const baseRadius = sec.borderRadius ?? ds.borderRadius;
          const btnStyle = sec.buttonStyle || ds.buttonStyle || 'solid';
          const textAlign = sec.textAlign || ds.textAlign || 'left';
          const maxW =
            sec.maxWidth === 'narrow'
              ? '768px'
              : sec.maxWidth === 'wide'
              ? '1280px'
              : sec.maxWidth === 'full'
              ? '100%'
              : '1080px';
          const bg =
            sec.backgroundStyle === 'gradient'
              ? `linear-gradient(135deg, ${sec.backgroundColor || ds.surfaceColor}, ${ds.backgroundColor})`
              : sec.backgroundStyle === 'surface'
              ? ds.surfaceColor
              : sec.backgroundColor || 'transparent';
          const secColor = sec.textColor || ds.textColor;
          const borderStyle = sec.borderWidth
            ? `border:${sec.borderWidth}px solid ${sec.borderColor || 'rgba(148,163,184,0.25)'};`
            : '';
          const fontSizeRule = sec.fontSize ? `font-size:${sec.fontSize}px;` : '';
          const btnRadius = btnStyle === 'sharp' ? '2px' : `${baseRadius}px`;
          const btnInline =
            btnStyle === 'outline'
              ? `background:transparent;color:${ds.primaryColor};border:1.5px solid ${ds.primaryColor};border-radius:${btnRadius};`
              : btnStyle === 'soft'
              ? `background:${ds.primaryColor}22;color:${ds.primaryColor};border:1px solid ${ds.primaryColor}44;border-radius:${btnRadius};`
              : `background:${ds.primaryColor};color:#fff;border-radius:${btnRadius};`;

          const visClasses = [
            sec.hideOnMobile ? 'rd-hide-mobile' : '',
            sec.hideOnTablet ? 'rd-hide-tablet' : '',
            sec.hideOnDesktop ? 'rd-hide-desktop' : '',
            sec.customClass ? esc(sec.customClass) : '',
          ]
            .filter(Boolean)
            .join(' ');

          const itemsHtml = sec.items?.length
            ? `<div class="rd-grid">${sec.items
                .map(
                  (it) => `<div class="rd-card" style="border-radius:${baseRadius}px;">
                ${it.metric ? `<div class="rd-metric">${esc(it.metric)}</div>` : ''}
                <h3>${esc(it.title)}</h3>
                <p>${esc(it.description)}</p>
              </div>`
                )
                .join('')}</div>`
            : '';

          const imgHtml = sec.imageUrl
            ? `<img src="${esc(sec.imageUrl)}" alt="${esc(sec.title)}" style="margin-top:20px;max-width:100%;border-radius:${baseRadius}px;border:1px solid rgba(148,163,184,0.2);" />`
            : '';

          const formHtml =
            sec.type === 'form'
              ? `<form class="rd-form" onsubmit="event.preventDefault(); this.querySelector('.rd-msg').textContent='Submitted successfully';">
                  <input type="text" placeholder="Full Name" required />
                  <input type="email" placeholder="Work Email" required />
                  <button type="submit" class="rd-btn" style="${btnInline}">${esc(sec.ctaLabel || 'Submit')}</button>
                  <p class="rd-msg"></p>
                </form>`
              : '';

          return `<section ${sec.customId ? `id="${esc(sec.customId)}"` : ''} class="rd-section ${visClasses}" style="padding:${padY}px 0;margin:${marY}px 0;background:${esc(bg)};color:${esc(secColor)};text-align:${textAlign};${borderStyle}${fontSizeRule}border-radius:${sec.borderWidth ? `${baseRadius}px` : '0'};">
            <div class="rd-container" style="max-width:${maxW};padding:0 ${padX}px;">
              ${sec.subtitle ? `<p class="rd-kicker">${esc(sec.subtitle)}</p>` : ''}
              <h2 style="${sec.headingFont ? `font-family:'${esc(sec.headingFont)}',system-ui,sans-serif;` : ''}${textAlign === 'center' ? 'margin-left:auto;margin-right:auto;' : ''}">${esc(sec.title)}</h2>
              <p class="rd-body" style="${sec.bodyFont ? `font-family:'${esc(sec.bodyFont)}',system-ui,sans-serif;` : ''}${textAlign === 'center' ? 'margin-left:auto;margin-right:auto;' : ''}">${esc(sec.body)}</p>
              ${sec.type !== 'form' && sec.ctaLabel ? `<a class="rd-btn" style="${btnInline}" href="${esc(sec.ctaHref || '#')}">${esc(sec.ctaLabel)}</a>` : ''}
              ${imgHtml}
              ${itemsHtml}
              ${formHtml}
            </div>
          </section>`;
        })
        .join('');

      return `<div class="rd-screen${scr.id === startId ? ' is-active' : ''}" id="screen-${esc(scr.id)}">${sectionsHtml}</div>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(project.name)}</title>
  <style>
    :root {
      --primary: ${ds.primaryColor};
      --secondary: ${ds.secondaryColor};
      --bg: ${ds.backgroundColor};
      --surface: ${ds.surfaceColor};
      --text: ${ds.textColor};
      --radius: ${ds.borderRadius}px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: '${ds.bodyFont}', system-ui, sans-serif; font-size: ${ds.fontSize || 16}px; background: var(--bg); color: var(--text); line-height: 1.6; }
    h1, h2, h3 { font-family: '${ds.headingFont}', system-ui, sans-serif; line-height: 1.15; }
    .rd-container { max-width: 1080px; margin: 0 auto; padding: 0 24px; }
    .rd-header { border-bottom: 1px solid rgba(148,163,184,0.18); position: sticky; top: 0; background: var(--bg); z-index: 10; }
    .rd-header-inner { display: flex; align-items: center; justify-content: space-between; min-height: 60px; gap: 16px; }
    .rd-brand { font-size: 1rem; font-weight: 700; }
    .rd-nav { display: flex; gap: 6px; flex-wrap: wrap; }
    .rd-nav-btn { background: transparent; border: 1px solid transparent; color: inherit; opacity: 0.75; padding: 6px 12px; border-radius: var(--radius); cursor: pointer; font: inherit; font-size: 0.85rem; }
    .rd-nav-btn.active { opacity: 1; background: var(--primary); color: #fff; }
    .rd-screen { display: none; }
    .rd-screen.is-active { display: block; }
    .rd-section { border-bottom: 1px solid rgba(148,163,184,0.12); }
    .rd-kicker { font-size: 0.8rem; color: var(--secondary); font-weight: 600; margin-bottom: 8px; }
    .rd-section h2 { font-size: clamp(1.5rem, 3vw, 2.4rem); margin-bottom: 12px; max-width: 24ch; }
    .rd-body { max-width: 64ch; opacity: 0.85; margin-bottom: 20px; }
    .rd-btn { display: inline-block; background: var(--primary); color: #fff; padding: 10px 20px; border-radius: var(--radius); text-decoration: none; font-weight: 600; border: 0; cursor: pointer; font-size: 0.9rem; }
    .rd-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-top: 24px; text-align: left; }
    .rd-card { background: var(--surface); border: 1px solid rgba(148,163,184,0.18); border-radius: var(--radius); padding: 18px; }
    .rd-card h3 { font-size: 1rem; margin-bottom: 6px; }
    .rd-card p { font-size: 0.88rem; opacity: 0.8; }
    .rd-metric { font-size: 1.4rem; font-weight: 700; color: var(--secondary); margin-bottom: 6px; }
    .rd-form { display: flex; flex-direction: column; gap: 10px; max-width: 380px; margin-top: 12px; }
    .rd-form input { padding: 10px 12px; border-radius: var(--radius); border: 1px solid rgba(148,163,184,0.28); background: var(--surface); color: var(--text); }
    .rd-msg { font-size: 0.85rem; color: var(--secondary); min-height: 1.2em; }
    .rd-footer { padding: 28px 0; font-size: 0.8rem; opacity: 0.65; }
    .rd-footer .rd-container { display: flex; justify-content: space-between; }
    @media (max-width: 639px) { .rd-hide-mobile { display: none !important; } }
    @media (min-width: 640px) and (max-width: 1023px) { .rd-hide-tablet { display: none !important; } }
    @media (min-width: 1024px) { .rd-hide-desktop { display: none !important; } }
  </style>
</head>
<body>
  <header class="rd-header">
    <div class="rd-container rd-header-inner">
      <strong class="rd-brand">${esc(project.name)}</strong>
      <nav class="rd-nav">${navButtons}</nav>
    </div>
  </header>
  <main>${screensMarkup}</main>
  <footer class="rd-footer">
    <div class="rd-container">
      <span>${esc(project.name)}</span>
      <span>Built with RailDesign AI</span>
    </div>
  </footer>
  <script>
    document.querySelectorAll('.rd-nav-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var target = 'screen-' + btn.getAttribute('data-screen');
        document.querySelectorAll('.rd-nav-btn').forEach(function(b) { b.classList.remove('active'); });
        document.querySelectorAll('.rd-screen').forEach(function(s) { s.classList.remove('is-active'); });
        btn.classList.add('active');
        var el = document.getElementById(target);
        if (el) el.classList.add('is-active');
      });
    });
  </script>
</body>
</html>`;
}

/**
 * Renders the active project screen to a crisp PNG or JPG Blob via HTML5 Canvas
 * so PNG/JPG export works reliably without external network calls or tainted canvases.
 */
export async function exportScreenToRasterBlob(
  project: ProjectRecord,
  screen: ScreenNode,
  format: 'png' | 'jpeg',
  width = 1440,
  height = 900
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  const ds = project.designSystem;
  ctx.fillStyle = ds.backgroundColor || '#0B0E14';
  ctx.fillRect(0, 0, width, height);

  // Header bar
  ctx.fillStyle = ds.surfaceColor || '#131823';
  ctx.fillRect(0, 0, width, 72);
  ctx.fillStyle = ds.textColor || '#F8FAFC';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(project.name, 56, 44);

  ctx.fillStyle = ds.secondaryColor || '#0EA5E9';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText(screen.name, width - 220, 44);

  let y = 128;
  for (const sec of screen.sections.slice(0, 3)) {
    ctx.fillStyle = ds.secondaryColor || '#0EA5E9';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText((sec.subtitle || sec.type).toUpperCase(), 56, y);
    y += 32;

    ctx.fillStyle = ds.textColor || '#F8FAFC';
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText(sec.title.slice(0, 56), 56, y);
    y += 34;

    ctx.fillStyle = '#94A3B8';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(sec.body.slice(0, 95), 56, y);
    y += 42;

    if (sec.items && sec.items.length > 0) {
      const cols = Math.min(3, sec.items.length);
      const cardW = (width - 112 - (cols - 1) * 20) / cols;
      for (let i = 0; i < cols; i++) {
        const it = sec.items[i];
        const cx = 56 + i * (cardW + 20);
        ctx.fillStyle = ds.surfaceColor || '#131823';
        ctx.fillRect(cx, y, cardW, 130);
        ctx.strokeStyle = 'rgba(148,163,184,0.25)';
        ctx.strokeRect(cx, y, cardW, 130);

        if (it.metric) {
          ctx.fillStyle = ds.primaryColor || '#2563EB';
          ctx.font = 'bold 26px system-ui, sans-serif';
          ctx.fillText(it.metric, cx + 18, y + 40);
        }
        ctx.fillStyle = ds.textColor || '#F8FAFC';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.fillText(it.title.slice(0, 26), cx + 18, y + 72);

        ctx.fillStyle = '#94A3B8';
        ctx.font = '14px system-ui, sans-serif';
        ctx.fillText(it.description.slice(0, 38), cx + 18, y + 100);
      }
      y += 164;
    } else {
      y += 28;
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Image rasterization failed.'));
      },
      format === 'jpeg' ? 'image/jpeg' : 'image/png',
      0.94
    );
  });
}

export function exportScreenToSvgString(project: ProjectRecord, screen: ScreenNode): string {
  const ds = project.designSystem;
  const first = screen.sections[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720" width="1200" height="720">
  <rect width="1200" height="720" fill="${esc(ds.backgroundColor)}"/>
  <rect width="1200" height="68" fill="${esc(ds.surfaceColor)}"/>
  <text x="48" y="42" fill="${esc(ds.textColor)}" font-family="sans-serif" font-size="22" font-weight="700">${esc(project.name)}</text>
  <text x="1040" y="42" fill="${esc(ds.secondaryColor)}" font-family="sans-serif" font-size="16" font-weight="600">${esc(screen.name)}</text>
  <text x="48" y="140" fill="${esc(ds.secondaryColor)}" font-family="sans-serif" font-size="14" font-weight="600">${esc(first?.subtitle || '')}</text>
  <text x="48" y="190" fill="${esc(ds.textColor)}" font-family="sans-serif" font-size="38" font-weight="700">${esc(first?.title || screen.name)}</text>
  <text x="48" y="236" fill="#94A3B8" font-family="sans-serif" font-size="18">${esc((first?.body || '').slice(0, 90))}</text>
  <rect x="48" y="270" width="180" height="44" rx="${ds.borderRadius}" fill="${esc(ds.primaryColor)}"/>
  <text x="82" y="298" fill="#FFFFFF" font-family="sans-serif" font-size="15" font-weight="600">${esc(first?.ctaLabel || 'Explore')}</text>
</svg>`;
}
