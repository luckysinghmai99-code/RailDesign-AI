import React, { useState } from 'react';
import { Bell, Menu, Moon, Sun, X } from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import { usePlatform } from '../context/PlatformContext.tsx';

export function Navbar({ onScrollToSection }: { onScrollToSection?: (id: string) => void }) {
  const {
    view,
    navigate,
    theme,
    toggleTheme,
    user,
    wallet,
    notifications,
    refreshNotifications,
    logout,
  } = usePlatform();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleNavClick = (target: 'home' | 'explore' | 'features' | 'pricing' | 'workspace') => {
    setMobileOpen(false);
    if (target === 'workspace') {
      navigate(user ? 'workspace' : 'login');
      return;
    }
    if (target === 'home') {
      navigate('home');
      return;
    }
    if (view !== 'home') {
      navigate('home');
      setTimeout(() => {
        document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    } else if (onScrollToSection) {
      onScrollToSection(target);
    } else {
      document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const markAllRead = async () => {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'POST' });
      await refreshNotifications();
    } catch {
      // ignore
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-[#090B10]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single clean text element wordmark */}
        <button
          onClick={() => navigate('home')}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          RailDesign AI
        </button>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            onClick={() => handleNavClick('home')}
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Home
          </button>
          <button
            onClick={() => handleNavClick('explore')}
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Explore
          </button>
          <button
            onClick={() => handleNavClick('features')}
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Features
          </button>
          <button
            onClick={() => handleNavClick('pricing')}
            className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Pricing
          </button>
          {user && (
            <button
              onClick={() => navigate('dashboard')}
              className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                view === 'dashboard' ? 'text-blue-600 dark:text-blue-400' : ''
              }`}
            >
              Dashboard
            </button>
          )}
        </nav>

        {/* Zone 3: Theme + Auth / Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {user ? (
            <>
              <button
                onClick={() => navigate('wallet')}
                className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-mono tabular-nums text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {wallet?.availableTokens ?? 0} tokens
              </button>

              <div className="relative">
                <button
                  onClick={() => setNotifOpen((o) => !o)}
                  aria-label="Notifications"
                  className="relative p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full bg-blue-600 text-[10px] font-mono text-white flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-3 z-50">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">Notifications</span>
                      <button
                        onClick={markAllRead}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        Mark all read
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 mt-1">
                      {notifications.length === 0 ? (
                        <p className="py-4 text-xs text-slate-500 text-center">No notifications yet.</p>
                      ) : (
                        notifications.slice(0, 8).map((n) => (
                          <div key={n.id} className="py-2.5 text-xs">
                            <p className="font-medium text-slate-900 dark:text-slate-100">{n.title}</p>
                            <p className="text-slate-500 dark:text-slate-400 mt-0.5">{n.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {(user.role === 'admin' || user.role === 'super_admin' || view === 'dashboard') && (
                <button
                  onClick={() => navigate('admin')}
                  className="hidden lg:inline-flex px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Admin
                </button>
              )}

              <button
                onClick={() => navigate('workspace')}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Open Workspace
              </button>

              <button
                onClick={() => void logout()}
                className="hidden sm:inline-flex px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('login')}
                className="hidden sm:inline-flex px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                Login
              </button>
              <button
                onClick={() => navigate('signup')}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign Up
              </button>
            </>
          )}

          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle navigation menu"
            className="md:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090B10] px-4 py-4 space-y-2">
          <button onClick={() => handleNavClick('home')} className="block w-full text-left py-2 text-sm font-medium">
            Home
          </button>
          <button onClick={() => handleNavClick('explore')} className="block w-full text-left py-2 text-sm font-medium">
            Explore
          </button>
          <button onClick={() => handleNavClick('features')} className="block w-full text-left py-2 text-sm font-medium">
            Features
          </button>
          <button onClick={() => handleNavClick('pricing')} className="block w-full text-left py-2 text-sm font-medium">
            Pricing
          </button>
          {user ? (
            <>
              <button onClick={() => { setMobileOpen(false); navigate('dashboard'); }} className="block w-full text-left py-2 text-sm font-medium">
                Dashboard
              </button>
              <button onClick={() => { setMobileOpen(false); navigate('wallet'); }} className="block w-full text-left py-2 text-sm font-medium">
                Wallet ({wallet?.availableTokens ?? 0} tokens)
              </button>
              <button onClick={() => { setMobileOpen(false); navigate('admin'); }} className="block w-full text-left py-2 text-sm font-medium">
                Admin Center
              </button>
              <button onClick={() => { setMobileOpen(false); void logout(); }} className="block w-full text-left py-2 text-sm font-medium text-red-500">
                Logout
              </button>
            </>
          ) : (
            <button onClick={() => { setMobileOpen(false); navigate('login'); }} className="block w-full text-left py-2 text-sm font-medium">
              Login
            </button>
          )}
        </div>
      )}
    </header>
  );
}
