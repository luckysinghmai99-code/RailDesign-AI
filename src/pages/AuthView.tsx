import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound, Mail } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type { TokenWallet, UserProfile } from '../shared/types.ts';

export function AuthView({ mode }: { mode: 'login' | 'signup' | 'reset' }) {
  const { navigate, loginSuccess, pendingPrompt } = usePlatform();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [oauthStatus, setOauthStatus] = useState<{
    configured: { google: boolean; github: boolean };
    callbacks: { google: string; github: string };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');

  useEffect(() => {
    apiRequest<{
      configured: { google: boolean; github: boolean };
      callbacks: { google: string; github: string };
    }>('/api/oauth/status')
      .then(setOauthStatus)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        !event.origin.endsWith('.run.app') &&
        !event.origin.includes('localhost') &&
        event.origin !== window.location.origin
      ) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.token && event.data?.user) {
        apiRequest<{ user: UserProfile; wallet: TokenWallet }>('/api/auth/me', {
          headers: { Authorization: `Bearer ${event.data.token}` },
        })
          .then((res) => {
            loginSuccess(event.data.token, res.user, res.wallet);
          })
          .catch(() => {
            setError('Failed to finalize OAuth session.');
          });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [loginSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await apiRequest<{ token: string; user: UserProfile; wallet: TokenWallet }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        loginSuccess(res.token, res.user, res.wallet);
      } else if (mode === 'signup') {
        const res = await apiRequest<{
          token: string;
          user: UserProfile;
          wallet: TokenWallet;
          verificationToken: string;
        }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password }),
        });
        setVerificationToken(res.verificationToken);
        loginSuccess(res.token, res.user, res.wallet);
      } else if (mode === 'reset') {
        if (resetStep === 'request') {
          const res = await apiRequest<{ message: string; previewResetToken?: string }>(
            '/api/auth/forgot-password',
            {
              method: 'POST',
              body: JSON.stringify({ email }),
            }
          );
          setNotice(res.message);
          if (res.previewResetToken) {
            setResetToken(res.previewResetToken);
          }
          setResetStep('confirm');
        } else {
          const res = await apiRequest<{ message: string }>('/api/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token: resetToken, newPassword }),
          });
          setNotice(res.message);
          setTimeout(() => navigate('login'), 1200);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthPopup = async (provider: 'google' | 'github') => {
    setError('');
    try {
      const res = await apiRequest<{ url: string }>(`/api/auth/oauth/${provider}/url`);
      const popup = window.open(res.url, `${provider}_oauth_popup`, 'width=600,height=700');
      if (!popup) {
        setError('Popup blocked by browser. Please allow popups for this site.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OAuth error';
      if (msg.includes('NOT_CONFIGURED')) {
        setError(
          `${provider === 'google' ? 'Google' : 'GitHub'} OAuth client credentials are not yet configured in environment secrets. Callback URL: ${
            oauthStatus?.callbacks[provider] || `${window.location.origin}/auth/callback/${provider}`
          }`
        );
      } else {
        setError(msg);
      }
    }
  };

  return (
    <div className="relative z-10 min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-6 sm:p-8 shadow-sm">
        <button
          type="button"
          onClick={() => navigate('home')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Homepage
        </button>

        {pendingPrompt && pendingPrompt.prompt && (
          <div className="mb-5 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs">
            <p className="font-semibold text-blue-700 dark:text-blue-300">
              Prompt saved for Workspace
            </p>
            <p className="mt-1 text-slate-600 dark:text-slate-300 line-clamp-2">
              “{pendingPrompt.prompt}”
            </p>
            {pendingPrompt.referenceImageDataUrl && (
              <p className="mt-1 text-slate-500 dark:text-slate-400">
                Reference image preserved · Will restore automatically after login
              </p>
            )}
          </div>
        )}

        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
          {mode === 'login'
            ? 'Sign in to RailDesign AI'
            : mode === 'signup'
              ? 'Create your account'
              : 'Reset your password'}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          {mode === 'login'
            ? 'Access your projects, six AI engines, and token wallet.'
            : mode === 'signup'
              ? 'Start with 100 free tokens (covers up to 6 standard screens).'
              : 'Recover access to your RailDesign AI workspace.'}
        </p>

        {mode !== 'reset' && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => void handleOAuthPopup('google')}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
            >
              Google
            </button>
            <button
              type="button"
              onClick={() => void handleOAuthPopup('github')}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
            >
              GitHub
            </button>
          </div>
        )}

        {mode !== 'reset' && (
          <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span>or continue with email</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white"
              />
            </div>
          )}

          {(mode !== 'reset' || resetStep === 'request') && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {mode !== 'reset' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {mode === 'reset' && resetStep === 'confirm' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Reset Token
                </label>
                <input
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Paste reset token"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                />
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}
          {notice && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {notice}
            </p>
          )}
          {verificationToken && (
            <p className="text-xs text-slate-500 font-mono">Verification token issued: {verificationToken}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            {loading
              ? 'Processing...'
              : mode === 'login'
                ? 'Sign In'
                : mode === 'signup'
                  ? 'Create Account'
                  : resetStep === 'request'
                    ? 'Send Reset Token'
                    : 'Update Password'}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          {mode === 'login' ? (
            <>
              <button onClick={() => navigate('signup')} className="hover:text-slate-900 dark:hover:text-white cursor-pointer">
                Need an account? Sign up
              </button>
              <button onClick={() => navigate('reset')} className="hover:text-slate-900 dark:hover:text-white cursor-pointer">
                Forgot password?
              </button>
            </>
          ) : (
            <button onClick={() => navigate('login')} className="hover:text-slate-900 dark:hover:text-white cursor-pointer">
              Already have an account? Sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
