import React from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import { usePlatform } from '../context/PlatformContext.tsx';
import type { ProviderId } from '../shared/types.ts';

interface ModelSelectorProps {
  providerId: ProviderId;
  modelId: string;
  onChange: (providerId: ProviderId, modelId: string) => void;
  allowSaveDefault?: boolean;
  compact?: boolean;
}

export function ModelSelector({
  providerId,
  modelId,
  onChange,
  allowSaveDefault = false,
  compact = false,
}: ModelSelectorProps) {
  const { providers, user, setUser } = usePlatform();
  const [savedNotice, setSavedNotice] = React.useState(false);

  const selectedProvider = providers.find((p) => p.id === providerId) || providers[0];
  const models = selectedProvider?.models || [];
  const selectedModel = models.find((m) => m.id === modelId) || models[0];

  const handleProviderSelect = (nextProviderId: ProviderId) => {
    const prov = providers.find((p) => p.id === nextProviderId);
    const nextModel = prov?.defaultModel || prov?.models[0]?.id || 'gemini-4-hydrogen';
    onChange(nextProviderId, nextModel);
  };

  const handleSaveDefault = async () => {
    if (!user) return;
    try {
      const res = await apiRequest<{ user: typeof user }>('/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ preferredProvider: providerId, preferredModel: modelId }),
      });
      setUser(res.user);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
          AI Provider & Model
        </div>
        <div className="flex items-center gap-3 text-xs">
          {selectedProvider && (
            <span
              className={`inline-flex items-center gap-1.5 font-medium ${
                selectedProvider.configured
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {selectedProvider.configured ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {selectedProvider.statusLabel}
            </span>
          )}
          {allowSaveDefault && user && (
            <button
              type="button"
              onClick={handleSaveDefault}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
            >
              {savedNotice ? 'Saved as default' : 'Save preference'}
            </button>
          )}
        </div>
      </div>

      {/* Strictly ONLY the 3 configured providers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {providers.map((prov) => {
          const active = prov.id === providerId;
          return (
            <button
              key={prov.id}
              type="button"
              onClick={() => handleProviderSelect(prov.id)}
              className={`text-left px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                active
                  ? 'border-blue-600 bg-blue-600/10 text-slate-900 dark:text-white'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold truncate">{prov.name}</span>
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {prov.configured ? 'Ready' : 'Not configured'} · {prov.models.length} models
              </div>
            </button>
          );
        })}
      </div>

      {/* Model Select */}
      <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="sr-only" htmlFor="ai-model-select">
          Select model
        </label>
        <select
          id="ai-model-select"
          value={selectedModel?.id || modelId}
          onChange={(e) => onChange(providerId, e.target.value)}
          className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} ({m.id})
            </option>
          ))}
        </select>

        {selectedModel && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 shrink-0">
            <span>
              {[
                selectedModel.capabilities.text && 'Text',
                selectedModel.capabilities.code && 'Code',
                selectedModel.capabilities.vision && 'Vision',
                selectedModel.capabilities.imageGeneration && 'Image Gen',
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
        )}
      </div>
      {!compact && selectedModel && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{selectedModel.description}</p>
      )}
    </div>
  );
}
