import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, setAuthToken } from '../lib/api.ts';
import { ENGINE_CATALOG } from '../shared/catalog.ts';
import type {
  EngineId,
  EngineMetadata,
  NotificationItem,
  PricingPlan,
  ProviderId,
  ProviderInfo,
  TokenPackage,
  TokenWallet,
  UserProfile,
} from '../shared/types.ts';

export type AppView =
  | 'home'
  | 'login'
  | 'signup'
  | 'reset'
  | 'dashboard'
  | 'workspace'
  | 'wallet'
  | 'admin'
  | 'shared';

export type WorkspaceSidebarTab =
  | 'sections'
  | 'pages'
  | 'styles'
  | 'components'
  | 'services'
  | 'ai_assistant'
  | 'settings';

export interface PendingPromptDraft {
  prompt: string;
  engineId: EngineId | 'auto';
  providerId: ProviderId;
  modelId: string;
  screenCount: number;
  referenceImageDataUrl?: string | null;
  autoGenerateAfterLogin?: boolean;
}

interface PlatformContextValue {
  view: AppView;
  navigate: (next: AppView) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  user: UserProfile | null;
  wallet: TokenWallet | null;
  providers: ProviderInfo[];
  engines: EngineMetadata[];
  plans: PricingPlan[];
  packages: TokenPackage[];
  notifications: NotificationItem[];
  pendingPrompt: PendingPromptDraft | null;
  setPendingPrompt: (draft: PendingPromptDraft | null) => void;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  authLoading: boolean;
  refreshSession: () => Promise<void>;
  refreshCatalog: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  loginSuccess: (token: string, user: UserProfile, wallet: TokenWallet) => void;
  logout: () => Promise<void>;
  setWallet: React.Dispatch<React.SetStateAction<TokenWallet | null>>;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  shareToken: string | null;
  workspaceLeftTab: WorkspaceSidebarTab;
  setWorkspaceLeftTab: (tab: WorkspaceSidebarTab) => void;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<AppView>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('share')) return 'shared';
    return 'home';
  });
  const [shareToken] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('share');
  });

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [wallet, setWallet] = useState<TokenWallet | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [engines] = useState<EngineMetadata[]>(ENGINE_CATALOG);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [packages, setPackages] = useState<TokenPackage[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [pendingPrompt, setPendingPrompt] = useState<PendingPromptDraft | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [workspaceLeftTab, setWorkspaceLeftTab] = useState<WorkspaceSidebarTab>('sections');
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (user) {
        apiRequest('/api/user/profile', {
          method: 'PATCH',
          body: JSON.stringify({ themePreference: next }),
        }).catch(() => undefined);
      }
      return next;
    });
  }, [user]);

  const navigate = useCallback((next: AppView) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const refreshCatalog = useCallback(async () => {
    try {
      const [provRes, priceRes] = await Promise.all([
        apiRequest<{ providers: ProviderInfo[] }>('/api/providers'),
        apiRequest<{ plans: PricingPlan[]; packages: TokenPackage[] }>('/api/pricing'),
      ]);
      setProviders(provRes.providers);
      setPlans(priceRes.plans);
      setPackages(priceRes.packages);
    } catch (err) {
      console.error('Catalog load error:', err);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const res = await apiRequest<{ notifications: NotificationItem[] }>('/api/notifications');
      setNotifications(res.notifications);
    } catch {
      // Unauthenticated
    }
  }, []);

  const refreshSession = useCallback(async () => {
    setAuthLoading(true);
    try {
      const res = await apiRequest<{ user: UserProfile; wallet: TokenWallet }>('/api/auth/me');
      setUser(res.user);
      setWallet(res.wallet);
      if (res.user.themePreference) {
        setTheme(res.user.themePreference);
      }
      refreshNotifications();
    } catch {
      setUser(null);
      setWallet(null);
    } finally {
      setAuthLoading(false);
    }
  }, [refreshNotifications]);

  useEffect(() => {
    refreshCatalog();
    refreshSession();
  }, [refreshCatalog, refreshSession]);

  const loginSuccess = useCallback(
    (token: string, nextUser: UserProfile, nextWallet: TokenWallet) => {
      setAuthToken(token);
      setUser(nextUser);
      setWallet(nextWallet);
      if (nextUser.themePreference) {
        setTheme(nextUser.themePreference);
      }
      refreshNotifications();
      // Auto-redirect to AI Workspace if a visitor entered a prompt before logging in
      if (pendingPrompt && pendingPrompt.prompt.trim().length > 0) {
        setView('workspace');
      } else {
        setView('dashboard');
      }
    },
    [pendingPrompt, refreshNotifications]
  );

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAuthToken(null);
    setUser(null);
    setWallet(null);
    setNotifications([]);
    setActiveProjectId(null);
    setView('home');
  }, []);

  return (
    <PlatformContext.Provider
      value={{
        view,
        navigate,
        theme,
        toggleTheme,
        user,
        wallet,
        providers,
        engines,
        plans,
        packages,
        notifications,
        pendingPrompt,
        setPendingPrompt,
        activeProjectId,
        setActiveProjectId,
        authLoading,
        refreshSession,
        refreshCatalog,
        refreshNotifications,
        loginSuccess,
        logout,
        setWallet,
        setUser,
        shareToken,
        workspaceLeftTab,
        setWorkspaceLeftTab,
      }}
    >
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform() {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used within PlatformProvider');
  return ctx;
}
