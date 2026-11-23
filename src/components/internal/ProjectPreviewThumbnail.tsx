import React from 'react';
import type { ProjectRecord } from '../../shared/types.ts';

/**
 * Renders an authentic scaled miniature thumbnail of a project's actual design system,
 * hero copy, section cards, generated imagery, or GIF animation—so dashboard project
 * gallery cards show rich live previews rather than generic boxes.
 */
export function ProjectPreviewThumbnail({ project }: { project: ProjectRecord }) {
  const ds = project.designSystem;
  const firstScreen = project.screens[0];
  const hero = firstScreen?.sections[0];
  const secondary = firstScreen?.sections[1];
  const firstImage = project.generatedImages?.[0]?.dataUrl || project.gifDataUrl;

  if (firstImage && (project.engineId === 'engine03_graphic_image' || project.engineId === 'engine05_animation_gif')) {
    return (
      <div className="relative h-44 w-full overflow-hidden border-b border-slate-200 dark:border-slate-800 bg-slate-950">
        <img
          src={firstImage}
          alt={project.name}
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className="relative h-44 w-full overflow-hidden border-b border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between select-none"
      style={{
        backgroundColor: ds.backgroundColor || '#0B0E14',
        color: ds.textColor || '#F8FAFC',
        fontFamily: `'${ds.bodyFont || 'Plus Jakarta Sans'}', system-ui, sans-serif`,
      }}
    >
      {/* Mini Top Navigation Chrome */}
      <div
        className="flex items-center justify-between px-3 py-1.5 rounded-md border border-white/10"
        style={{ backgroundColor: ds.surfaceColor || '#131823' }}
      >
        <span className="text-[11px] font-bold truncate max-w-[140px]" style={{ fontFamily: ds.headingFont }}>
          {project.name}
        </span>
        <div className="flex items-center gap-2 text-[9px] opacity-75">
          {project.screens.slice(0, 3).map((s) => (
            <span key={s.id} className="truncate max-w-[48px]">
              {s.name}
            </span>
          ))}
        </div>
      </div>

      {/* Mini Hero Block */}
      <div className="my-auto py-1 space-y-1">
        {hero?.subtitle && (
          <p className="text-[9px] font-semibold uppercase tracking-wider truncate" style={{ color: ds.secondaryColor }}>
            {hero.subtitle}
          </p>
        )}
        <h4
          className="text-sm font-bold leading-tight line-clamp-1"
          style={{ fontFamily: `'${ds.headingFont || 'Outfit'}', system-ui, sans-serif` }}
        >
          {hero?.title || project.name}
        </h4>
        <p className="text-[10px] opacity-75 line-clamp-1">
          {hero?.body || project.description || 'Responsive multi-screen project layout'}
        </p>
        <div className="pt-1 flex items-center gap-2">
          <span
            className="inline-block px-2.5 py-0.5 text-[9px] font-semibold text-white"
            style={{
              backgroundColor: ds.primaryColor || '#2563EB',
              borderRadius: `${Math.min(12, ds.borderRadius ?? 6)}px`,
            }}
          >
            {hero?.ctaLabel || 'Explore'}
          </span>
          {secondary?.items?.slice(0, 2).map((it, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 text-[9px] border border-white/15 truncate max-w-[80px]"
              style={{
                backgroundColor: ds.surfaceColor || '#131823',
                borderRadius: `${Math.min(10, ds.borderRadius ?? 6)}px`,
              }}
            >
              {it.title}
            </span>
          ))}
        </div>
      </div>

      {/* Color Swatch Footer */}
      <div className="flex items-center justify-between text-[9px] opacity-60 font-mono">
        <span>{project.screens.length} screens</span>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm border border-white/20" style={{ backgroundColor: ds.primaryColor }} />
          <span className="w-2.5 h-2.5 rounded-sm border border-white/20" style={{ backgroundColor: ds.secondaryColor }} />
          <span className="w-2.5 h-2.5 rounded-sm border border-white/20" style={{ backgroundColor: ds.surfaceColor }} />
        </div>
      </div>
    </div>
  );
}
