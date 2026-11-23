import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  CreditCard,
  KeyRound,
  Layers,
  Lock,
  Shield,
  Sliders,
  Sparkles,
  User,
} from 'lucide-react';
import { ModelSelector } from '../ModelSelector.tsx';
import { usePlatform } from '../../context/PlatformContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import type {
  PaymentRecord,
  ProviderId,
  ProviderInfo,
  UserProfile,
  UserWorkspaceSettings,
} from '../../shared/types.ts';

export type SettingsSectionId =
  | 'account'
  | 'profile'
  | 'workspace'
  | 'ai_model'
  | 'api_config'
  | 'payment'
  | 'notifications'
  | 'security';

const SETTINGS_NAV: Array<{
  id: SettingsSectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'account', label: 'Account Settings', icon: User },
  { id: 'profile', label: 'Profile Settings', icon: Sliders },
  { id: 'workspace', label: 'Workspace Settings', icon: Layers },
  { id: 'ai_model', label: 'AI Model Settings', icon: Sparkles },
  { id: 'api_config', label: 'API Configuration', icon: KeyRound },
  { id: 'payment', label: 'Payment Settings', icon: CreditCard },
  { id: 'notifications', label: 'Notification Settings', icon: Bell },
  { id: 'security', label: 'Security Settings', icon: Lock },
];

const DEFAULT_SETTINGS: UserWorkspaceSettings = {
  defaultViewport: 'desktop',
  snapToGrid: true,
  autoSave: true,
  defaultScreenCount: 3,
  defaultExportFormat: 'zip',
  notifyGeneration: true,
  notifyPayments: true,
  notifyDeployments: true,
  notifySecurity: true,
};

export function SettingsFolderPanel({
  initialSection = 'account',
  compact = false,
}: {
  initialSection?: SettingsSectionId;
  compact?: boolean;
}) {
  const {
    user,
    setUser,
    wallet,
    theme,
    toggleTheme,
    notifications,
    refreshNotifications,
    navigate,
  } = usePlatform();

  const [section, setSection] = useState<SettingsSectionId>(initialSection);
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // Profile & Model state
  const [name, setName] = useState(user?.name || '');
  const [company, setCompany] = useState(user?.company || '');
  const [jobTitle, setJobTitle] = useState(user?.jobTitle || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [prefProvider, setPrefProvider] = useState<ProviderId>(user?.preferredProvider || 'google_gemini');
  const [prefModel, setPrefModel] = useState<string>(user?.preferredModel || 'gemini-4-hydrogen');

  // Workspace & Notification settings
  const [wsSettings, setWsSettings] = useState<UserWorkspaceSettings>({
    ...DEFAULT_SETTINGS,
    ...(user?.settings || {}),
  });

  // Verification / Password state
  const [verifyToken, setVerifyToken] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Server Integration Status & Payments
  const [integrations, setIntegrations] = useState<{
    providers: ProviderInfo[];
    oauth: { google: boolean; github: boolean };
    callbacks: { google: string; github: string };
    cashfree: { configured: boolean; env: string; webhookUrl: string };
    hosting: { managedStatic: boolean; vercelConfigured: boolean };
  } | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setCompany(user.company || '');
    setJobTitle(user.jobTitle || '');
    setBio(user.bio || '');
    setPrefProvider(user.preferredProvider || 'google_gemini');
    setPrefModel(user.preferredModel || 'gemini-4-hydrogen');
    setWsSettings({ ...DEFAULT_SETTINGS, ...(user.settings || {}) });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    apiRequest<{
      providers: ProviderInfo[];
      oauth: { google: boolean; github: boolean };
      callbacks: { google: string; github: string };
      cashfree: { configured: boolean; env: string; webhookUrl: string };
      hosting: { managedStatic: boolean; vercelConfigured: boolean };
    }>('/api/user/integrations-status')
      .then(setIntegrations)
      .catch(() => undefined);

    apiRequest<{ payments: PaymentRecord[] }>('/api/wallet')
      .then((res) => setPayments(res.payments))
      .catch(() => undefined);
  }, [user]);

  const showNotice = (msg: string) => {
    setErrorMsg('');
    setFeedback(msg);
    window.setTimeout(() => setFeedback(''), 3200);
  };

  const saveProfilePatch = async (payload: Record<string, unknown>, message: string) => {
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setUser(res.user);
      showNotice(message);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save changes.');
    } finally {
      setBusy(false);
    }
  };

  const saveWorkspaceSettings = async (next: UserWorkspaceSettings, message: string) => {
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/user/settings', {
        method: 'PATCH',
        body: JSON.stringify(next),
      });
      setUser(res.user);
      setWsSettings(res.user.settings || next);
      showNotice(message);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save workspace preferences.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyToken.trim()) return;
    setBusy(true);
    setErrorMsg('');
    try {
      await apiRequest('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: verifyToken.trim() }),
      });
      if (user) {
        setUser({ ...user, emailVerified: true });
      }
      setVerifyToken('');
      showNotice('Email verified successfully.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    try {
      await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showNotice('Password updated.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeSessions = async () => {
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await apiRequest<{ revokedCount: number }>('/api/auth/revoke-other-sessions', {
        method: 'POST',
      });
      showNotice(`Signed out ${res.revokedCount} other active session(s).`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to revoke sessions.');
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] ${
        compact ? 'flex flex-col' : 'grid grid-cols-1 lg:grid-cols-12'
      } overflow-hidden`}
    >
      {/* Settings Category List */}
      <nav
        aria-label="Settings sections"
        className={`${
          compact
            ? 'flex items-center gap-1 overflow-x-auto p-2 border-b border-slate-200 dark:border-slate-800'
            : 'lg:col-span-4 xl:col-span-3 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 p-3 space-y-1 bg-slate-50/70 dark:bg-[#0D1017]'
        }`}
      >
        {!compact && (
          <div className="px-2.5 py-2 mb-1">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">Settings</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Account, AI & Cashfree billing</p>
          </div>
        )}
        {SETTINGS_NAV.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSection(item.id);
                setErrorMsg('');
                setFeedback('');
              }}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                compact ? '' : 'w-full text-left'
              } ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Settings Content Area */}
      <div className={`${compact ? 'p-4' : 'lg:col-span-8 xl:col-span-9 p-6'} space-y-5`}>
        {feedback && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}
        {errorMsg && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-600 dark:text-red-400">
            {errorMsg}
          </div>
        )}

        {section === 'account' && (
          <div className="space-y-5">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h4 className="text-base font-display font-semibold text-slate-900 dark:text-white">
                Account Settings
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Identity details, verification status, and default export format.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5">
                <span className="text-slate-500 dark:text-slate-400">Primary Email</span>
                <p className="mt-1 font-medium text-slate-900 dark:text-white truncate">{user.email}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Status: {user.emailVerified ? 'Verified' : 'Pending verification'}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5">
                <span className="text-slate-500 dark:text-slate-400">Workspace Role</span>
                <p className="mt-1 font-medium capitalize text-slate-900 dark:text-white">
                  {user.role.replace('_', ' ')}
                </p>
                <p className="mt-1 text-[11px] font-mono tabular-nums text-slate-500">
                  Joined {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {!user.emailVerified && (
              <form onSubmit={handleVerifyEmail} className="space-y-2 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Enter Email Verification Token
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={verifyToken}
                    onChange={(e) => setVerifyToken(e.target.value)}
                    placeholder="Paste verification token"
                    className="flex-1 min-w-[180px] rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Verify Email
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Default Project Export Format
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={wsSettings.defaultExportFormat}
                  onChange={(e) => {
                    const next = {
                      ...wsSettings,
                      defaultExportFormat: e.target.value as UserWorkspaceSettings['defaultExportFormat'],
                    };
                    setWsSettings(next);
                    void saveWorkspaceSettings(next, 'Default export format updated.');
                  }}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                >
                  <option value="zip">Verified Source ZIP Archive</option>
                  <option value="png">High-Resolution PNG</option>
                  <option value="svg">Vector SVG Markup</option>
                  <option value="gif">Binary GIF89a Sequence</option>
                </select>
                {(user.role === 'admin' || user.role === 'super_admin') && (
                  <button
                    type="button"
                    onClick={() => navigate('admin')}
                    className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Open Admin Control Center
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {section === 'profile' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveProfilePatch({ name, company, jobTitle, bio }, 'Profile updated.');
            }}
            className="space-y-4"
          >
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between gap-4">
              <div>
                <h4 className="text-base font-display font-semibold text-slate-900 dark:text-white">
                  Profile Settings
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Personal metadata and interface theme preference.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium cursor-pointer"
              >
                Theme: {theme === 'dark' ? 'Dark' : 'Light'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Company / Studio</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Role / Title</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Bio</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              Save Profile
            </button>
          </form>
        )}

        {section === 'workspace' && (
          <div className="space-y-4">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h4 className="text-base font-display font-semibold text-slate-900 dark:text-white">
                Workspace Settings
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure your visual canvas defaults, viewport size, and auto-save behavior.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Default Canvas Viewport</label>
                <select
                  value={wsSettings.defaultViewport}
                  onChange={(e) =>
                    setWsSettings((s) => ({
                      ...s,
                      defaultViewport: e.target.value as UserWorkspaceSettings['defaultViewport'],
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                >
                  <option value="desktop">Desktop (100%)</option>
                  <option value="tablet">Tablet (768px)</option>
                  <option value="mobile">Mobile (375px)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Default Multi-Screen Count</label>
                <select
                  value={wsSettings.defaultScreenCount}
                  onChange={(e) =>
                    setWsSettings((s) => ({ ...s, defaultScreenCount: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                >
                  {[1, 2, 3, 5, 8, 10].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'screen' : 'screens'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <label className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 p-3 cursor-pointer">
                <span>Show visual alignment guides on canvas</span>
                <input
                  type="checkbox"
                  checked={wsSettings.snapToGrid}
                  onChange={(e) => setWsSettings((s) => ({ ...s, snapToGrid: e.target.checked }))}
                  className="h-4 w-4 accent-blue-600"
                />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 p-3 cursor-pointer">
                <span>Automatically save project version checkpoints</span>
                <input
                  type="checkbox"
                  checked={wsSettings.autoSave}
                  onChange={(e) => setWsSettings((s) => ({ ...s, autoSave: e.target.checked }))}
                  className="h-4 w-4 accent-blue-600"
                />
              </label>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void saveWorkspaceSettings(wsSettings, 'Workspace preferences saved.')}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              Save Workspace Preferences
            </button>
          </div>
        )}

        {section === 'ai_model' && (
          <div className="space-y-4">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h4 className="text-base font-display font-semibold text-slate-900 dark:text-white">
                AI Model Settings
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Choose your default provider across Google Gemini, OpenAI ChatGPT, and Anthropic Claude.
              </p>
            </div>

            <ModelSelector
              providerId={prefProvider}
              modelId={prefModel}
              onChange={(p, m) => {
                setPrefProvider(p);
                setPrefModel(m);
              }}
            />

            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void saveProfilePatch(
                  { preferredProvider: prefProvider, preferredModel: prefModel },
                  'Default AI provider and model saved.'
                )
              }
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              Save Preferred Model
            </button>
          </div>
        )}

        {section === 'api_config' && (
          <div className="space-y-4">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h4 className="text-base font-display font-semibold text-slate-900 dark:text-white">
                API Configuration
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live server-side connection status for AI providers, OAuth, Cashfree, and deployment adapters. Keys remain strictly on the server.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              {(integrations?.providers || []).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3.5 py-2.5"
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{p.name}</p>
                    <p className="text-[11px] font-mono text-slate-500">Default: {p.defaultModel}</p>
                  </div>
                  <span
                    className={`font-medium ${
                      p.configured ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {p.statusLabel}
                  </span>
                </div>
              ))}

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-white">Cashfree Payments</span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {integrations?.cashfree.configured
                      ? `Live (${integrations.cashfree.env})`
                      : 'HMAC Sandbox Mode'}
                  </span>
                </div>
                {integrations?.cashfree.webhookUrl && (
                  <p className="text-[11px] font-mono text-slate-500 break-all">
                    Webhook: {integrations.cashfree.webhookUrl}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-white">OAuth Callbacks</span>
                  <span className="text-[11px] text-slate-500">
                    Google: {integrations?.oauth.google ? 'Ready' : 'Not set'} · GitHub:{' '}
                    {integrations?.oauth.github ? 'Ready' : 'Not set'}
                  </span>
                </div>
                {integrations?.callbacks && (
                  <div className="text-[11px] font-mono text-slate-500 space-y-0.5 break-all">
                    <div>Google: {integrations.callbacks.google}</div>
                    <div>GitHub: {integrations.callbacks.github}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {section === 'payment' && (
          <div className="space-y-4">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-base font-display font-semibold text-slate-900 dark:text-white">
                  Payment Settings — Cashfree
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  All token purchases and top-ups are processed exclusively via Cashfree.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('wallet')}
                className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                Open Cashfree Checkout
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5">
                <span className="text-slate-500">Available Tokens</span>
                <p className="mt-1 text-xl font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                  {wallet?.availableTokens ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5">
                <span className="text-slate-500">Gateway</span>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Cashfree PG</p>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3.5">
                <span className="text-slate-500">Environment</span>
                <p className="mt-1 text-sm font-mono text-slate-900 dark:text-white">
                  {integrations?.cashfree.configured ? integrations.cashfree.env : 'sandbox_verified'}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">Order ID</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Tokens</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-5 text-center text-slate-500">
                        No Cashfree transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    payments.slice(0, 8).map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 px-3 font-mono truncate max-w-[160px]">{p.orderId}</td>
                        <td className="py-2 px-3 capitalize">{p.status}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">+{p.tokensPurchased}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">₹{p.amountInr}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {section === 'notifications' && (
          <div className="space-y-4">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h4 className="text-base font-display font-semibold text-slate-900 dark:text-white">
                  Notification Settings
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Control workspace, billing, and deployment alerts.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await apiRequest('/api/notifications/read-all', { method: 'POST' });
                  await refreshNotifications();
                  showNotice('All notifications marked read.');
                }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Mark all read
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {(
                [
                  { key: 'notifyGeneration', label: 'AI engine generation completions and refunds' },
                  { key: 'notifyPayments', label: 'Cashfree token purchase and ledger alerts' },
                  { key: 'notifyDeployments', label: 'Static hosting and Vercel deployment status' },
                  { key: 'notifySecurity', label: 'Password changes and sign-in security alerts' },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 p-3 cursor-pointer"
                >
                  <span>{item.label}</span>
                  <input
                    type="checkbox"
                    checked={wsSettings[item.key]}
                    onChange={(e) => {
                      const next = { ...wsSettings, [item.key]: e.target.checked };
                      setWsSettings(next);
                    }}
                    className="h-4 w-4 accent-blue-600"
                  />
                </label>
              ))}
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => void saveWorkspaceSettings(wsSettings, 'Notification preferences saved.')}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              Save Notification Preferences
            </button>

            {notifications.length > 0 && (
              <div className="pt-2 space-y-1.5 max-h-40 overflow-y-auto">
                {notifications.slice(0, 5).map((n) => (
                  <div key={n.id} className="text-xs rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2">
                    <p className="font-medium text-slate-900 dark:text-white">{n.title}</p>
                    <p className="text-slate-500 dark:text-slate-400">{n.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {section === 'security' && (
          <div className="space-y-5">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h4 className="text-base font-display font-semibold text-slate-900 dark:text-white">
                Security Settings
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Update your scrypt password and manage active authentication sessions.
              </p>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-3 max-w-md text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Required if password is set"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">New Password (8+ characters)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
              >
                Update Password
              </button>
            </form>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Shield className="w-4 h-4 text-blue-600" />
                <span>Sign out all other devices and browsers</span>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRevokeSessions()}
                className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium cursor-pointer"
              >
                Revoke Other Sessions
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
