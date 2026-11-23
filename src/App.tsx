import React from 'react';
import { Navbar } from './components/Navbar.tsx';
import { GlobalTrainBackdrop } from './components/train/GlobalTrainSystem.tsx';
import { PlatformProvider, usePlatform } from './context/PlatformContext.tsx';
import { AdminView } from './pages/AdminView.tsx';
import { AuthView } from './pages/AuthView.tsx';
import { DashboardView } from './pages/DashboardView.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { SharedPreviewView } from './pages/SharedPreviewView.tsx';
import { WalletView } from './pages/WalletView.tsx';
import { WorkspaceView } from './pages/WorkspaceView.tsx';

function PlatformRouter() {
  const { view, user, authLoading, navigate } = usePlatform();

  if (authLoading && view !== 'home' && view !== 'shared') {
    return (
      <div className="relative z-10 min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-sm text-slate-500 font-mono">Loading RailDesign AI workspace...</div>
      </div>
    );
  }

  const protectedViews = new Set(['dashboard', 'workspace', 'wallet', 'admin']);
  if (protectedViews.has(view) && !user) {
    return <AuthView mode="login" />;
  }

  if (view === 'login') return <AuthView mode="login" />;
  if (view === 'signup') return <AuthView mode="signup" />;
  if (view === 'reset') return <AuthView mode="reset" />;
  if (view === 'dashboard') return <DashboardView />;
  if (view === 'workspace') return <WorkspaceView />;
  if (view === 'wallet') return <WalletView />;
  if (view === 'admin') return <AdminView />;
  if (view === 'shared') return <SharedPreviewView />;

  return <HomePage />;
}

function AppShell() {
  const { view } = usePlatform();
  const isInternalView =
    view === 'dashboard' || view === 'workspace' || view === 'wallet' || view === 'admin';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#090B10] dark:text-slate-100 relative overflow-x-hidden">
      <GlobalTrainBackdrop elevated={isInternalView} />
      <Navbar />
      <PlatformRouter />
    </div>
  );
}

export default function App() {
  return (
    <PlatformProvider>
      <AppShell />
    </PlatformProvider>
  );
}
