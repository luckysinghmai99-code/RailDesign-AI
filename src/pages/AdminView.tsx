import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, Shield } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type { PricingPlan, ProviderInfo, TokenPackage, UserProfile } from '../shared/types.ts';

interface AdminOverviewData {
  stats: {
    totalUsers: number;
    activeUsers: number;
    totalProjects: number;
    totalJobs: number;
    failedJobs: number;
  };
  queue: {
    activeWorkers: number;
    queuedJobs: number;
    maxConcurrent: number;
    maxQueuedCapacity: number;
  };
  providers: ProviderInfo[];
  plans: PricingPlan[];
  packages: TokenPackage[];
  users: Array<Record<string, unknown>>;
  projects: Array<Record<string, unknown>>;
  jobs: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  logs: Array<Record<string, unknown>>;
  tickets: Array<Record<string, unknown>>;
}

export function AdminView() {
  const { user, setUser, navigate, refreshCatalog } = usePlatform();
  const [bootstrapStatus, setBootstrapStatus] = useState<{
    passcodeConfigured: boolean;
    adminExists: boolean;
    isCurrentUserAdmin: boolean;
  } | null>(null);
  const [passcode, setPasscode] = useState('');
  const [claimError, setClaimError] = useState('');
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [tab, setTab] = useState<'overview' | 'users' | 'jobs' | 'payments' | 'pricing' | 'logs'>('overview');
  const [adjustUserId, setAdjustUserId] = useState('');
  const [adjustAmount, setAdjustAmount] = useState(100);
  const [adjustReason, setAdjustReason] = useState('Admin balance adjustment');
  const [feedback, setFeedback] = useState('');

  const loadStatusAndData = async () => {
    try {
      const status = await apiRequest<{
        passcodeConfigured: boolean;
        adminExists: boolean;
        isCurrentUserAdmin: boolean;
      }>('/api/admin/bootstrap-status');
      setBootstrapStatus(status);
      if (status.isCurrentUserAdmin) {
        const data = await apiRequest<AdminOverviewData>('/api/admin/overview');
        setOverview(data);
        if (data.users[0]) {
          setAdjustUserId(String(data.users[0].id));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (user) {
      void loadStatusAndData();
    }
  }, [user]);

  const handleClaimAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimError('');
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/admin/claim', {
        method: 'POST',
        body: JSON.stringify({ passcode }),
      });
      setUser(res.user);
      setPasscode('');
      await loadStatusAndData();
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Unable to claim admin access.');
    }
  };

  const handleAdjustTokens = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback('');
    await apiRequest('/api/admin/tokens/adjust', {
      method: 'POST',
      body: JSON.stringify({
        userId: adjustUserId,
        amount: Number(adjustAmount),
        reason: adjustReason,
      }),
    });
    setFeedback('Token balance updated.');
    await loadStatusAndData();
  };

  const handleUpdatePlan = async (plan: PricingPlan) => {
    await apiRequest(`/api/admin/pricing/${plan.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        priceMonthlyInr: plan.priceMonthlyInr,
        tokenAllowance: plan.tokenAllowance,
        maxScreensPerJob: plan.maxScreensPerJob,
      }),
    });
    await refreshCatalog();
    setFeedback(`Updated pricing tier: ${plan.name}`);
  };

  if (!user) return null;

  if (!bootstrapStatus?.isCurrentUserAdmin) {
    return (
      <div className="relative z-10 min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-6 space-y-4">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-semibold">
            <Shield className="w-4 h-4" />
            Role-Based Admin Access
          </div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white">
            {bootstrapStatus?.passcodeConfigured ? 'Unlock Admin Control Center' : 'First-Run Admin Setup'}
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {bootstrapStatus?.passcodeConfigured
              ? 'Enter the configured administrator passcode to unlock role-based platform controls.'
              : 'No administrator passcode is set yet. Choose a passcode (6+ characters) to claim Super Admin ownership for this workspace.'}
          </p>
          <form onSubmit={handleClaimAdmin} className="space-y-3">
            <input
              type="password"
              required
              minLength={6}
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder={bootstrapStatus?.passcodeConfigured ? 'Admin passcode' : 'Choose initial admin passcode'}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm"
            />
            {claimError && <p className="text-xs text-red-500">{claimError}</p>}
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              {bootstrapStatus?.passcodeConfigured ? 'Verify Admin Passcode' : 'Claim Admin Access'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div>
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Dashboard
          </button>
          <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
            Admin Control Center
          </h1>
        </div>

        <a
          href="/api/platform/download-zip"
          download="raildesign-ai-platform.zip"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
        >
          <Download className="w-3.5 h-3.5" />
          Download Full Platform ZIP
        </a>
      </div>

      {feedback && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-600 dark:text-emerald-400">
          {feedback}
        </div>
      )}

      {overview && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-4">
              <p className="text-xs text-slate-500">Total Users</p>
              <p className="mt-1 text-2xl font-mono font-bold tabular-nums">{overview.stats.totalUsers}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-4">
              <p className="text-xs text-slate-500">Active Users</p>
              <p className="mt-1 text-2xl font-mono font-bold tabular-nums">{overview.stats.activeUsers}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-4">
              <p className="text-xs text-slate-500">Projects</p>
              <p className="mt-1 text-2xl font-mono font-bold tabular-nums">{overview.stats.totalProjects}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-4">
              <p className="text-xs text-slate-500">Total Jobs</p>
              <p className="mt-1 text-2xl font-mono font-bold tabular-nums">{overview.stats.totalJobs}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-4">
              <p className="text-xs text-slate-500">Failed / Refunded</p>
              <p className="mt-1 text-2xl font-mono font-bold tabular-nums text-amber-500">{overview.stats.failedJobs}</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-4">
              <p className="text-xs text-slate-500">Queue Capacity</p>
              <p className="mt-1 text-xl font-mono font-bold tabular-nums">
                {overview.queue.activeWorkers}/{overview.queue.maxQueuedCapacity}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto">
            {(['overview', 'users', 'jobs', 'payments', 'pricing', 'logs'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize cursor-pointer ${
                  tab === t ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-5 space-y-3">
                <h2 className="text-sm font-semibold">AI Provider Configuration Status</h2>
                {overview.providers.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-slate-500 font-mono">{p.defaultModel}</div>
                    </div>
                    <span className={p.configured ? 'text-emerald-500 font-semibold' : 'text-amber-500 font-semibold'}>
                      {p.statusLabel}
                    </span>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-5">
                <h2 className="text-sm font-semibold mb-3">Admin Token Adjustment</h2>
                <form onSubmit={handleAdjustTokens} className="space-y-3 text-xs">
                  <select
                    value={adjustUserId}
                    onChange={(e) => setAdjustUserId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  >
                    {overview.users.map((u) => (
                      <option key={String(u.id)} value={String(u.id)}>
                        {String(u.email)} ({String(u.available_tokens ?? 0)} tokens)
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(Number(e.target.value))}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                    />
                    <input
                      type="text"
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                    />
                  </div>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold cursor-pointer">
                    Apply Token Adjustment
                  </button>
                </form>
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4 text-right">Available</th>
                    <th className="py-3 px-4 text-right">Used</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {overview.users.map((u) => (
                    <tr key={String(u.id)}>
                      <td className="py-3 px-4 font-mono">{String(u.email)}</td>
                      <td className="py-3 px-4">{String(u.name)}</td>
                      <td className="py-3 px-4">{String(u.role)}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{String(u.available_tokens ?? 0)}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{String(u.used_tokens ?? 0)}</td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const nextRole = u.role === 'admin' ? 'user' : 'admin';
                            await apiRequest(`/api/admin/users/${u.id}/role`, {
                              method: 'PATCH',
                              body: JSON.stringify({ role: nextRole }),
                            });
                            await loadStatusAndData();
                          }}
                          className="text-blue-600 hover:underline cursor-pointer"
                        >
                          Toggle Admin
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'jobs' && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Engine</th>
                    <th className="py-3 px-4">Model</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Prompt</th>
                    <th className="py-3 px-4 text-right">Settled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {overview.jobs.map((j) => (
                    <tr key={String(j.id)}>
                      <td className="py-3 px-4 font-mono">{String(j.engine_id)}</td>
                      <td className="py-3 px-4 font-mono">{String(j.model_id)}</td>
                      <td className="py-3 px-4 capitalize">{String(j.status)}</td>
                      <td className="py-3 px-4 max-w-md truncate">{String(j.prompt)}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{String(j.settled_tokens)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'payments' && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Gateway</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Tokens</th>
                    <th className="py-3 px-4 text-right">INR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {overview.payments.map((p) => (
                    <tr key={String(p.id)}>
                      <td className="py-3 px-4 font-mono">{String(p.order_id)}</td>
                      <td className="py-3 px-4 capitalize">{String(p.gateway)}</td>
                      <td className="py-3 px-4 capitalize">{String(p.status)}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{String(p.tokens_purchased)}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">₹{String(p.amount_inr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'pricing' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {overview.plans.map((plan) => (
                <div key={plan.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-4 space-y-3 text-xs">
                  <h3 className="font-semibold text-sm">{plan.name}</h3>
                  <label className="block">
                    <span className="text-slate-500">Monthly INR</span>
                    <input
                      type="number"
                      defaultValue={plan.priceMonthlyInr}
                      onChange={(e) => {
                        plan.priceMonthlyInr = Number(e.target.value);
                      }}
                      className="mt-1 w-full rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                    />
                  </label>
                  <label className="block">
                    <span className="text-slate-500">Token Allowance</span>
                    <input
                      type="number"
                      defaultValue={plan.tokenAllowance}
                      onChange={(e) => {
                        plan.tokenAllowance = Number(e.target.value);
                      }}
                      className="mt-1 w-full rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleUpdatePlan(plan)}
                    className="w-full py-2 rounded-lg bg-blue-600 text-white font-semibold cursor-pointer"
                  >
                    Save Tier
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === 'logs' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-200 p-4 font-mono text-xs space-y-1.5 max-h-[420px] overflow-y-auto">
              {overview.logs.map((l) => (
                <div key={String(l.id)}>
                  <span className="text-slate-500">[{String(l.created_at)}]</span>{' '}
                  <span className={l.level === 'error' ? 'text-red-400' : 'text-blue-400'}>
                    [{String(l.engine_id)}]
                  </span>{' '}
                  {String(l.message)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
