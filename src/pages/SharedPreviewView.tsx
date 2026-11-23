import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { buildIsolatedSrcDoc } from '../components/workspace/DesignPreviewRenderer.ts';
import { usePlatform } from '../context/PlatformContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type { ProjectRecord } from '../shared/types.ts';

export function SharedPreviewView() {
  const { shareToken, navigate } = usePlatform();
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shareToken) return;
    apiRequest<{ project: ProjectRecord }>(`/api/share/${shareToken}`)
      .then((res) => setProject(res.project))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load shared project.'));
  }, [shareToken]);

  return (
    <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800 mb-6">
        <div>
          <p className="text-xs text-slate-500">Shared Preview</p>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
            {project?.name || 'RailDesign AI Shared Project'}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => {
            window.history.replaceState({}, '', '/');
            navigate('home');
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          RailDesign Home
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-500">
          {error}
        </div>
      ) : !project ? (
        <div className="h-96 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse bg-slate-100 dark:bg-slate-900" />
      ) : (
        <iframe
          title="Shared Project Preview"
          sandbox="allow-scripts"
          srcDoc={buildIsolatedSrcDoc(project)}
          className="w-full h-[680px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white"
        />
      )}
    </div>
  );
}
