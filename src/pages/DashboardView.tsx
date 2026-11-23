import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Archive,
  ArrowUpRight,
  Blocks,
  Bot,
  Briefcase,
  Code2,
  Copy,
  FileText,
  Film,
  FolderKanban,
  FolderPlus,
  Globe,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  Menu,
  Palette,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { ProjectPreviewThumbnail } from '../components/internal/ProjectPreviewThumbnail.tsx';
import { ServicesFolderPanel } from '../components/internal/ServicesFolderPanel.tsx';
import { SettingsFolderPanel } from '../components/internal/SettingsFolderPanel.tsx';
import { usePlatform, type WorkspaceSidebarTab } from '../context/PlatformContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { ENGINE_CATALOG } from '../shared/catalog.ts';
import type {
  EngineId,
  GenerationJob,
  PaymentRecord,
  ProjectRecord,
} from '../shared/types.ts';

type DashboardArea =
  | 'overview'
  | 'projects'
  | 'activity'
  | 'services'
  | 'settings';

const ENGINE_ICONS: Record<EngineId, React.ComponentType<{ className?: string }>> = {
  engine01_website: Globe,
  engine02_app_uiux: Smartphone,
  engine03_graphic_image: ImageIcon,
  engine04_coding: Code2,
  engine05_animation_gif: Film,
  engine06_testing_export: ShieldCheck,
};

const BUILDER_SIDEBAR_ORDER: Array<{
  id: WorkspaceSidebarTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'sections', label: 'Sections', icon: Layers },
  { id: 'pages', label: 'Pages', icon: FileText },
  { id: 'styles', label: 'Styles', icon: Palette },
  { id: 'components', label: 'Components', icon: Blocks },
  { id: 'services', label: 'Services', icon: Briefcase },
  { id: 'ai_assistant', label: 'AI Assistant', icon: Bot },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function DashboardView() {
  const {
    user,
    wallet,
    navigate,
    setActiveProjectId,
    setPendingPrompt,
    setWorkspaceLeftTab,
  } = usePlatform();

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [area, setArea] = useState<DashboardArea>('overview');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pRes, jRes, wRes] = await Promise.all([
        apiRequest<{ projects: ProjectRecord[] }>('/api/projects'),
        apiRequest<{ jobs: GenerationJob[] }>('/api/jobs'),
        apiRequest<{ payments: PaymentRecord[] }>('/api/wallet'),
      ]);
      setProjects(pRes.projects);
      setJobs(jRes.jobs);
      setPayments(wRes.payments);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      void loadData();
    }
  }, [user]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [projects, search, statusFilter]);

  const completedJobsCount = useMemo(
    () => jobs.filter((j) => j.status === 'completed').length,
    [jobs]
  );

  const handleNewProject = async (engineId: EngineId = 'engine01_website') => {
    const res = await apiRequest<{ project: ProjectRecord }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: `Untitled ${ENGINE_CATALOG.find((e) => e.id === engineId)?.shortName || 'Project'}`,
        engineId,
        providerId: user?.preferredProvider || 'google_gemini',
        modelId: user?.preferredModel || 'gemini-4-hydrogen',
      }),
    });
    setActiveProjectId(res.project.id);
    setWorkspaceLeftTab('sections');
    navigate('workspace');
  };

  const handleOpenInWorkspace = (projectId?: string, targetTab: WorkspaceSidebarTab = 'sections') => {
    if (projectId) {
      setActiveProjectId(projectId);
    } else if (projects[0]) {
      setActiveProjectId(projects[0].id);
    }
    setWorkspaceLeftTab(targetTab);
    navigate('workspace');
  };

  const handleLaunchEngine = (engineId: EngineId) => {
    if (!user) return;
    const eng = ENGINE_CATALOG.find((e) => e.id === engineId);
    setPendingPrompt({
      prompt: '',
      engineId,
      providerId: user.preferredProvider,
      modelId: user.preferredModel,
      screenCount: eng?.supportsMultiScreen ? 3 : 1,
    });
    setWorkspaceLeftTab('ai_assistant');
    navigate('workspace');
  };

  const handleDuplicate = async (id: string) => {
    await apiRequest(`/api/projects/${id}/duplicate`, { method: 'POST' });
    await loadData();
  };

  const handleArchiveToggle = async (p: ProjectRecord) => {
    await apiRequest(`/api/projects/${p.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: p.status === 'active' ? 'archived' : 'active' }),
    });
    await loadData();
  };

  const handleDelete = async (id: string) => {
    await apiRequest(`/api/projects/${id}`, { method: 'DELETE' });
    await loadData();
  };

  const handleSidebarItemClick = (id: WorkspaceSidebarTab) => {
    setMobileSidebarOpen(false);
    if (id === 'services') {
      setArea('services');
      return;
    }
    if (id === 'settings') {
      setArea('settings');
      return;
    }
    handleOpenInWorkspace(projects[0]?.id, id);
  };

  if (!user) return null;

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between p-3 gap-5">
      <div className="space-y-5">
        {/* Workspace Overview Nav */}
        <div>
          <p className="px-2.5 mb-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            Studio Portal
          </p>
          <div className="space-y-1">
            {(
              [
                { id: 'overview', label: 'Studio Overview', icon: LayoutDashboard },
                { id: 'projects', label: 'Project Gallery', icon: FolderKanban },
                { id: 'activity', label: 'Recent Activity', icon: Activity },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = area === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setArea(item.id);
                    setMobileSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Visual Builder & Platform Folder (Exact 7 Ordered Options) */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <p className="px-2.5 mb-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            Visual Builder & Folders
          </p>
          <div className="space-y-1">
            {BUILDER_SIDEBAR_ORDER.map((item) => {
              const Icon = item.icon;
              const isSelected =
                (item.id === 'services' && area === 'services') ||
                (item.id === 'settings' && area === 'settings');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSidebarItemClick(item.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.id !== 'services' && item.id !== 'settings' && (
                    <ArrowUpRight className="w-3 h-3 opacity-45 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Wallet & Quick Workspace Card */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <button
          type="button"
          onClick={() => navigate('wallet')}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-600 text-xs transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
            <Wallet className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Token Balance
          </span>
          <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
            {wallet?.availableTokens ?? 0}
          </span>
        </button>
        <p className="px-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {user.email}
        </p>
      </div>
    </div>
  );

  return (
    <div className="relative z-10 min-h-[calc(100vh-4rem)] flex bg-slate-50 dark:bg-[#090B10]">
      {/* Fixed Desktop Left Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0D1017]/95">
        <div className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile Collapsible Sidebar Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] bg-white dark:bg-[#0D1017] border-r border-slate-200 dark:border-slate-800 h-full overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <span className="text-sm font-display font-bold">Studio Navigation</span>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Internal Content Viewport */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Polished Top Studio Toolbar */}
        <div className="sticky top-16 z-20 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#0D1017]/90 backdrop-blur-md px-4 sm:px-8 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Open sidebar navigation"
                className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>RailDesign Studio</span>
                  <span>/</span>
                  <span className="text-slate-900 dark:text-slate-200 font-medium capitalize">
                    {area === 'overview' ? 'Dashboard' : area}
                  </span>
                </div>
                <h1 className="text-lg sm:text-xl font-display font-bold text-slate-900 dark:text-white truncate">
                  Welcome back, {user.name}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative hidden sm:block">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    if (area !== 'projects' && e.target.value.trim()) {
                      setArea('projects');
                    }
                  }}
                  placeholder="Search projects..."
                  className="w-52 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-600"
                />
              </div>

              <button
                type="button"
                onClick={() => handleOpenInWorkspace(projects[0]?.id, 'sections')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] hover:border-blue-600 text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                AI Design Workspace
              </button>

              <button
                type="button"
                onClick={() => void handleNewProject('engine01_website')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                Create New Project
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 sm:px-8 py-6 max-w-[1400px] w-full mx-auto space-y-8">
          {/* Refined Inline Studio Telemetry Row (Zero Cluttered Box Sandwiches) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
            <div className="px-5 py-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Token Balance</p>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className="text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                  {wallet?.availableTokens ?? 0}
                </span>
                <button
                  type="button"
                  onClick={() => navigate('wallet')}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Top up
                </button>
              </div>
            </div>

            <div className="px-5 py-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Projects</p>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className="text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                  {projects.length}
                </span>
                <span className="text-xs text-slate-500 tabular-nums">
                  {projects.filter((p) => p.status === 'active').length} active
                </span>
              </div>
            </div>

            <div className="px-5 py-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Completed Jobs</p>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className="text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                  {completedJobsCount}
                </span>
                <span className="text-xs text-slate-500 tabular-nums">
                  {jobs.length} total runs
                </span>
              </div>
            </div>

            <div className="px-5 py-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Tokens Consumed</p>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className="text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                  {wallet?.usedTokens ?? 0}
                </span>
                <span className="text-xs font-mono text-slate-500 truncate max-w-[120px]">
                  {user.preferredModel}
                </span>
              </div>
            </div>
          </div>

          {area === 'services' && (
            <ServicesFolderPanel
              onLaunchEngine={handleLaunchEngine}
              onOpenWallet={() => navigate('wallet')}
              onOpenAssets={() => handleOpenInWorkspace(projects[0]?.id, 'services')}
              onOpenShare={() => handleOpenInWorkspace(projects[0]?.id, 'sections')}
              onOpenPublish={() => handleOpenInWorkspace(projects[0]?.id, 'pages')}
            />
          )}

          {area === 'settings' && <SettingsFolderPanel />}

          {area === 'overview' && (
            <div className="space-y-10">
              {/* Project Gallery & Recent Projects */}
              <section>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-display font-semibold text-slate-900 dark:text-white">
                      Recent Projects & Design Gallery
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Open any build in the visual canvas editor or start a fresh layout.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setArea('projects')}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Browse all ({projects.length})
                  </button>
                </div>

                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        className="h-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] animate-pulse"
                      />
                    ))}
                  </div>
                ) : projects.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-10 text-center">
                    <h3 className="text-base font-display font-semibold text-slate-900 dark:text-white">
                      Your visual studio is ready
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      Create your first responsive website, SaaS interface, or animated graphic sequence using any of the six AI engines below.
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => void handleNewProject('engine01_website')}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                      >
                        Create First Project
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLaunchEngine('engine01_website')}
                        className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold cursor-pointer"
                      >
                        Open AI Assistant
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {projects.slice(0, 6).map((p) => (
                      <article
                        key={p.id}
                        className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] overflow-hidden flex flex-col justify-between transition-colors hover:border-blue-600"
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenInWorkspace(p.id, 'sections')}
                          className="text-left block w-full cursor-pointer"
                        >
                          <ProjectPreviewThumbnail project={p} />
                        </button>

                        <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="font-mono">{p.modelId}</span>
                              <span>·</span>
                              <span className="tabular-nums">{p.screens.length} screens</span>
                              {p.publishedUrl && (
                                <>
                                  <span>·</span>
                                  <span className="text-emerald-600 dark:text-emerald-400">Live</span>
                                </>
                              )}
                            </div>
                            <h3 className="mt-1 text-base font-display font-semibold text-slate-900 dark:text-white truncate">
                              {p.name}
                            </h3>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                              {p.description || 'Multi-screen layout ready for visual styling and export.'}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                            <button
                              type="button"
                              onClick={() => handleOpenInWorkspace(p.id, 'sections')}
                              className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              Open Visual Builder
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => void handleDuplicate(p.id)}
                                title="Duplicate project"
                                className="p-1.5 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleArchiveToggle(p)}
                                title={p.status === 'active' ? 'Archive' : 'Unarchive'}
                                className="p-1.5 rounded text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              {/* Six Attractive AI Engine Cards */}
              <section>
                <div className="mb-4">
                  <h2 className="text-lg font-display font-semibold text-slate-900 dark:text-white">
                    Six Independent AI Engines
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Launch specialized engines for web architecture, UI/UX systems, graphics, full-stack code, GIF animations, or QA export.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {ENGINE_CATALOG.map((eng) => {
                    const Icon = ENGINE_ICONS[eng.id] || Globe;
                    return (
                      <div
                        key={eng.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-5 flex flex-col justify-between gap-4 hover:border-blue-600 transition-colors"
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span className="inline-flex items-center gap-2 font-mono font-semibold text-blue-600 dark:text-blue-400">
                              <Icon className="w-4 h-4" />
                              Engine {eng.number}
                            </span>
                            <span className="font-mono tabular-nums">{eng.tokenBaseCost} tokens</span>
                          </div>
                          <h3 className="mt-2.5 text-base font-display font-semibold text-slate-900 dark:text-white">
                            {eng.name}
                          </h3>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                            {eng.description}
                          </p>
                          <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {eng.capabilities.join(' · ')}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleLaunchEngine(eng.id)}
                          className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-blue-600 text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Launch {eng.shortName}
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Compact Recent Activity Table */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-display font-semibold text-slate-900 dark:text-white">
                    Recent Activity
                  </h2>
                  <button
                    type="button"
                    onClick={() => setArea('activity')}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    View full log
                  </button>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="py-3 px-4 font-medium">Prompt / Build</th>
                        <th className="py-3 px-4 font-medium">Engine</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                        <th className="py-3 px-4 font-medium text-right">Tokens</th>
                        <th className="py-3 px-4 font-medium text-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {jobs.slice(0, 5).map((j) => (
                        <tr key={j.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                          <td className="py-3 px-4 max-w-md truncate font-medium text-slate-900 dark:text-slate-100">
                            {j.prompt}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">{j.engineId}</td>
                          <td className="py-3 px-4 capitalize">{j.status}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {j.settledTokens || j.estimatedTokens}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                            {new Date(j.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                      {jobs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500">
                            No generation activity yet. Launch an AI engine to record your first run.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {area === 'projects' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter projects by title or description..."
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] pl-9 pr-3 py-2 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                  {(['all', 'active', 'archived'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setStatusFilter(f)}
                      className={`px-3 py-1 rounded-md text-xs font-medium capitalize cursor-pointer ${
                        statusFilter === f
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredProjects.map((p) => (
                  <article
                    key={p.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] overflow-hidden flex flex-col justify-between"
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenInWorkspace(p.id, 'sections')}
                      className="text-left block w-full cursor-pointer"
                    >
                      <ProjectPreviewThumbnail project={p} />
                    </button>
                    <div className="p-4 space-y-3">
                      <div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 font-mono">
                          <span>{p.modelId}</span>
                          <span>·</span>
                          <span className="capitalize">{p.status}</span>
                        </div>
                        <h3 className="mt-1 text-base font-display font-semibold text-slate-900 dark:text-white truncate">
                          {p.name}
                        </h3>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                        <button
                          type="button"
                          onClick={() => handleOpenInWorkspace(p.id, 'sections')}
                          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Open Visual Builder
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleDuplicate(p.id)}
                            title="Duplicate"
                            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleArchiveToggle(p)}
                            title={p.status === 'active' ? 'Archive' : 'Unarchive'}
                            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(p.id)}
                            title="Delete"
                            className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {area === 'activity' && (
            <div className="space-y-6">
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <tr>
                      <th className="py-3 px-4 font-medium">Prompt</th>
                      <th className="py-3 px-4 font-medium">Engine</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium text-right">Tokens</th>
                      <th className="py-3 px-4 font-medium text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {jobs.map((j) => (
                      <tr key={j.id}>
                        <td className="py-3 px-4 max-w-md truncate text-slate-900 dark:text-slate-100">{j.prompt}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{j.engineId}</td>
                        <td className="py-3 px-4 capitalize">{j.status}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {j.settledTokens || j.estimatedTokens}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                          {new Date(j.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {jobs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          No generation runs recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {payments.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                    Cashfree Payment History
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622]">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <tr>
                          <th className="py-2.5 px-4">Order ID</th>
                          <th className="py-2.5 px-4">Gateway</th>
                          <th className="py-2.5 px-4">Status</th>
                          <th className="py-2.5 px-4 text-right">Tokens</th>
                          <th className="py-2.5 px-4 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {payments.map((pay) => (
                          <tr key={pay.id}>
                            <td className="py-2.5 px-4 font-mono">{pay.orderId}</td>
                            <td className="py-2.5 px-4 capitalize">Cashfree</td>
                            <td className="py-2.5 px-4 capitalize">{pay.status}</td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums">+{pay.tokensPurchased}</td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums">₹{pay.amountInr}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
