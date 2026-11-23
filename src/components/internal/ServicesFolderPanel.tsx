import React from 'react';
import {
  ArrowUpRight,
  Code2,
  Download,
  Film,
  Globe,
  Image as ImageIcon,
  LayoutGrid,
  Share2,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { ENGINE_CATALOG } from '../../shared/catalog.ts';
import type { EngineId } from '../../shared/types.ts';

const ENGINE_ICONS: Record<EngineId, React.ComponentType<{ className?: string }>> = {
  engine01_website: Globe,
  engine02_app_uiux: Smartphone,
  engine03_graphic_image: ImageIcon,
  engine04_coding: Code2,
  engine05_animation_gif: Film,
  engine06_testing_export: ShieldCheck,
};

export function ServicesFolderPanel({
  onLaunchEngine,
  onOpenWallet,
  onOpenAssets,
  onOpenShare,
  onOpenPublish,
  onExportZip,
  compact = false,
}: {
  onLaunchEngine: (engineId: EngineId) => void;
  onOpenWallet: () => void;
  onOpenAssets?: () => void;
  onOpenShare?: () => void;
  onOpenPublish?: () => void;
  onExportZip?: () => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Platform Services & Tools */}
      <section>
        <div className="mb-3">
          <h3 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
            Platform Services & Tools
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Core hosting, Cashfree token billing, sharing, and verified export pipelines.
          </p>
        </div>
        <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
          <button
            type="button"
            onClick={onOpenWallet}
            className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] hover:border-blue-600 p-4 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
              <Wallet className="w-4 h-4" />
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
            <p className="mt-2.5 text-sm font-semibold text-slate-900 dark:text-white">Cashfree Token Wallet</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Top up generation credits exclusively through Cashfree and inspect token ledgers.
            </p>
          </button>

          {onOpenPublish && (
            <button
              type="button"
              onClick={onOpenPublish}
              className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] hover:border-blue-600 p-4 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
                <Globe className="w-4 h-4" />
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
              <p className="mt-2.5 text-sm font-semibold text-slate-900 dark:text-white">Managed Hosting & Deploy</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Deploy live sites to RailDesign static hosting or Vercel production environments.
              </p>
            </button>
          )}

          {onOpenShare && (
            <button
              type="button"
              onClick={onOpenShare}
              className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] hover:border-blue-600 p-4 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
                <Share2 className="w-4 h-4" />
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
              <p className="mt-2.5 text-sm font-semibold text-slate-900 dark:text-white">Client Share Links</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Create or revoke public and private review links with view permissions.
              </p>
            </button>
          )}

          {onExportZip && (
            <button
              type="button"
              onClick={onExportZip}
              className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] hover:border-blue-600 p-4 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
                <Download className="w-4 h-4" />
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
              <p className="mt-2.5 text-sm font-semibold text-slate-900 dark:text-white">Verified Project Archive</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Bundle audited HTML, CSS, JavaScript, and manifests into a verified ZIP download.
              </p>
            </button>
          )}

          {onOpenAssets && (
            <button
              type="button"
              onClick={onOpenAssets}
              className="text-left rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] hover:border-blue-600 p-4 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
                <LayoutGrid className="w-4 h-4" />
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
              <p className="mt-2.5 text-sm font-semibold text-slate-900 dark:text-white">Visual Asset Library</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Upload brand photography, icons, and generated raster visuals for canvas sections.
              </p>
            </button>
          )}
        </div>
      </section>

      {/* Six Independent AI Engine Services */}
      <section>
        <div className="mb-3">
          <h3 className="text-sm font-display font-semibold text-slate-900 dark:text-white">
            Six Specialized AI Engines
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Launch any specialized generation engine directly into the visual studio.
          </p>
        </div>
        <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
          {ENGINE_CATALOG.map((eng) => {
            const Icon = ENGINE_ICONS[eng.id] || Globe;
            return (
              <div
                key={eng.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-4 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-blue-600 dark:text-blue-400 font-semibold">
                      <Icon className="w-3.5 h-3.5" />
                      Engine {eng.number}
                    </span>
                    <span className="font-mono tabular-nums">{eng.tokenBaseCost} tokens</span>
                  </div>
                  <h4 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{eng.name}</h4>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{eng.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onLaunchEngine(eng.id)}
                  className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Launch Engine {eng.number}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
