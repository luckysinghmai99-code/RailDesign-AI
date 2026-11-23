import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Blocks,
  Bot,
  Briefcase,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Film,
  FolderPlus,
  Globe,
  GripVertical,
  History,
  Image as ImageIcon,
  ImagePlus,
  Layers,
  Maximize2,
  Monitor,
  Palette,
  PanelLeft,
  PanelRight,
  Plus,
  Redo2,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  Share2,
  Sliders,
  Smartphone,
  Sparkles,
  Tablet,
  Trash2,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { ModelSelector } from '../components/ModelSelector.tsx';
import { ServicesFolderPanel } from '../components/internal/ServicesFolderPanel.tsx';
import {
  SettingsFolderPanel,
  type SettingsSectionId,
} from '../components/internal/SettingsFolderPanel.tsx';
import { PromptTrainWrapper } from '../components/train/GlobalTrainSystem.tsx';
import {
  buildIsolatedSrcDoc,
  exportScreenToRasterBlob,
  exportScreenToSvgString,
} from '../components/workspace/DesignPreviewRenderer.ts';
import { usePlatform, type WorkspaceSidebarTab } from '../context/PlatformContext.tsx';
import { apiRequest } from '../lib/api.ts';
import {
  DEMO_GALLERY,
  ENGINE_CATALOG,
  estimateGenerationTokens,
} from '../shared/catalog.ts';
import type {
  AnimationFrame,
  AssetItem,
  DesignSystem,
  EngineId,
  GenerationJob,
  ProjectFile,
  ProjectRecord,
  ProjectVersion,
  ProviderId,
  ScreenNode,
  SectionBlock,
  SharedProjectLink,
  TokenWallet,
} from '../shared/types.ts';

type CenterTab = 'design' | 'preview' | 'code' | 'image' | 'animation';
type RightInspectorTab = 'style' | 'advanced';

const LEFT_SIDEBAR_ITEMS: Array<{
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

const COMPONENT_BLOCKS: Array<{
  type: SectionBlock['type'];
  label: string;
  description: string;
}> = [
  { type: 'hero', label: 'Hero Banner', description: 'Primary headline, value copy, and action button' },
  { type: 'features', label: 'Feature Grid', description: 'Multi-column capability cards' },
  { type: 'stats', label: 'Metrics Strip', description: 'KPI counters and performance callouts' },
  { type: 'gallery', label: 'Showcase Gallery', description: 'Visual media & portfolio frames' },
  { type: 'pricing', label: 'Pricing Tiers', description: 'Plan comparison cards with CTAs' },
  { type: 'form', label: 'Lead Capture Form', description: 'Interactive contact or waitlist form' },
  { type: 'navigation', label: 'Navigation Bar', description: 'Top horizontal link bar' },
  { type: 'footer', label: 'Site Footer', description: 'Bottom brand & copyright band' },
];

const PALETTE_PRESETS: Array<{
  name: string;
  ds: Partial<DesignSystem>;
}> = [
  {
    name: 'Midnight Cobalt',
    ds: {
      primaryColor: '#2563EB',
      secondaryColor: '#0EA5E9',
      backgroundColor: '#090B10',
      surfaceColor: '#111622',
      textColor: '#F8FAFC',
    },
  },
  {
    name: 'Editorial Daylight',
    ds: {
      primaryColor: '#1D4ED8',
      secondaryColor: '#0284C7',
      backgroundColor: '#F8FAFC',
      surfaceColor: '#FFFFFF',
      textColor: '#0F172A',
    },
  },
  {
    name: 'Obsidian Emerald',
    ds: {
      primaryColor: '#10B981',
      secondaryColor: '#34D399',
      backgroundColor: '#07100D',
      surfaceColor: '#0F1E18',
      textColor: '#ECFDF5',
    },
  },
  {
    name: 'Warm Studio',
    ds: {
      primaryColor: '#EA580C',
      secondaryColor: '#F59E0B',
      backgroundColor: '#14110F',
      surfaceColor: '#211C18',
      textColor: '#FAF5F0',
    },
  },
];

const FONT_OPTIONS = [
  'Outfit',
  'Plus Jakarta Sans',
  'Inter',
  'Playfair Display',
  'JetBrains Mono',
];

const SETTINGS_CATEGORIES: Array<{ id: SettingsSectionId; label: string }> = [
  { id: 'account', label: 'Account Settings' },
  { id: 'profile', label: 'Profile Settings' },
  { id: 'workspace', label: 'Workspace Settings' },
  { id: 'ai_model', label: 'AI Model Settings' },
  { id: 'api_config', label: 'API Configuration' },
  { id: 'payment', label: 'Payment Settings' },
  { id: 'notifications', label: 'Notification Settings' },
  { id: 'security', label: 'Security Settings' },
];

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function createSectionTemplate(type: SectionBlock['type']): SectionBlock {
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  return {
    id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    title:
      type === 'hero'
        ? 'Design Production Interfaces With Velocity'
        : type === 'pricing'
        ? 'Transparent Studio Plans'
        : type === 'form'
        ? 'Request Early Access'
        : `Modular ${label} Section`,
    subtitle: `${label} Block`,
    body: 'Customize typography, spacing, colors, and responsive visibility using the right Style & Advanced inspector.',
    ctaLabel: type === 'form' ? 'Submit Request' : 'Get Started',
    ctaHref: '#',
    paddingY: 56,
    paddingX: 24,
    marginY: 0,
    borderWidth: 0,
    borderRadius: 12,
    buttonStyle: 'solid',
    textAlign: 'left',
    backgroundStyle: 'solid',
    maxWidth: 'standard',
    items:
      type === 'features' || type === 'stats' || type === 'pricing' || type === 'gallery'
        ? [
            {
              title: type === 'pricing' ? 'Starter Tier' : 'High-Precision Grid',
              description: 'Responsive container engineered for multi-device clarity.',
              metric: type === 'stats' ? '99.9%' : type === 'pricing' ? '$29' : '01',
            },
            {
              title: type === 'pricing' ? 'Studio Pro' : 'Live Token Sync',
              description: 'Connected directly to your workspace Design System tokens.',
              metric: type === 'stats' ? '2.4x' : type === 'pricing' ? '$79' : '02',
            },
            {
              title: type === 'pricing' ? 'Enterprise Scale' : 'Verified Export',
              description: 'Clean semantic output audited across desktop and mobile.',
              metric: type === 'stats' ? '14ms' : type === 'pricing' ? '$199' : '03',
            },
          ]
        : undefined,
  };
}

export function WorkspaceView() {
  const {
    user,
    wallet,
    setWallet,
    navigate,
    activeProjectId,
    setActiveProjectId,
    pendingPrompt,
    setPendingPrompt,
    workspaceLeftTab,
    setWorkspaceLeftTab,
  } = usePlatform();

  const refImgInput = useRef<HTMLInputElement>(null);
  const assetUploadInput = useRef<HTMLInputElement>(null);

  // Studio Panels & Navigation
  const [leftTab, setLeftTab] = useState<WorkspaceSidebarTab>(workspaceLeftTab || 'sections');
  const [rightTab, setRightTab] = useState<RightInspectorTab>('style');
  const [centerTab, setCenterTab] = useState<CenterTab>('design');
  const [settingsSubSection, setSettingsSubSection] = useState<SettingsSectionId>('account');
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Project State
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [shares, setShares] = useState<SharedProjectLink[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);

  // Undo / Redo Stacks
  const [undoStack, setUndoStack] = useState<ProjectRecord[]>([]);
  const [redoStack, setRedoStack] = useState<ProjectRecord[]>([]);

  // Canvas & Selection State
  const [activeScreenId, setActiveScreenId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [activeFilePath, setActiveFilePath] = useState<string>('index.html');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>(
    user?.settings?.defaultViewport || 'desktop'
  );
  const [zoom, setZoom] = useState<number>(100);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);

  // Drag-and-Drop State
  const [dragSectionIdx, setDragSectionIdx] = useState<number | null>(null);
  const [dragComponentType, setDragComponentType] = useState<SectionBlock['type'] | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);

  // AI Orchestration State
  const [prompt, setPrompt] = useState('');
  const [engineId, setEngineId] = useState<EngineId | 'auto'>('auto');
  const [providerId, setProviderId] = useState<ProviderId>(user?.preferredProvider || 'google_gemini');
  const [modelId, setModelId] = useState<string>(user?.preferredModel || 'gemini-4-hydrogen');
  const [screenCount, setScreenCount] = useState(user?.settings?.defaultScreenCount || 3);
  const [referenceImageDataUrl, setReferenceImageDataUrl] = useState<string | null>(null);
  const [isLooping, setIsLooping] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [journeyStage, setJourneyStage] = useState('');
  const [aiMessage, setAiMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  // Code Editor Search & Replace
  const [codeSearch, setCodeSearch] = useState('');
  const [codeReplace, setCodeReplace] = useState('');
  const [codeDiagnostic, setCodeDiagnostic] = useState('');

  // Modals
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [shareUrlCreated, setShareUrlCreated] = useState('');
  const [publishSlug, setPublishSlug] = useState('');
  const [publishTarget, setPublishTarget] = useState<'raildesign_static' | 'vercel'>('raildesign_static');
  const [publishLogs, setPublishLogs] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

  // Sync left tab when navigated from Dashboard sidebar shortcut
  useEffect(() => {
    setLeftTab(workspaceLeftTab);
  }, [workspaceLeftTab]);

  // Restore pending prompt preserved across auth or launched from Dashboard
  useEffect(() => {
    if (pendingPrompt) {
      if (pendingPrompt.prompt) setPrompt(pendingPrompt.prompt);
      setEngineId(pendingPrompt.engineId);
      setProviderId(pendingPrompt.providerId);
      setModelId(pendingPrompt.modelId);
      setScreenCount(pendingPrompt.screenCount);
      if (pendingPrompt.referenceImageDataUrl) {
        setReferenceImageDataUrl(pendingPrompt.referenceImageDataUrl);
      }
      setLeftTab('ai_assistant');
      setWorkspaceLeftTab('ai_assistant');
      setPendingPrompt(null);
    }
  }, [pendingPrompt, setPendingPrompt, setWorkspaceLeftTab]);

  const loadWorkspaceData = useCallback(async () => {
    if (!user) return;
    try {
      const [pRes, aRes, jRes] = await Promise.all([
        apiRequest<{ projects: ProjectRecord[] }>('/api/projects'),
        apiRequest<{ assets: AssetItem[] }>('/api/assets'),
        apiRequest<{ jobs: GenerationJob[] }>('/api/jobs'),
      ]);
      setProjects(pRes.projects);
      setAssets(aRes.assets);
      setJobs(jRes.jobs);

      const targetId = activeProjectId || pRes.projects[0]?.id;
      if (targetId) {
        const detail = await apiRequest<{
          project: ProjectRecord;
          versions: ProjectVersion[];
          shares: SharedProjectLink[];
        }>(`/api/projects/${targetId}`);
        setProject(detail.project);
        setVersions(detail.versions);
        setShares(detail.shares);
        const firstScreen = detail.project.screens[0];
        setActiveScreenId(firstScreen?.id || '');
        setSelectedSectionId(firstScreen?.sections[0]?.id || null);
        setActiveFilePath(detail.project.files[0]?.path || 'index.html');
        setProviderId(detail.project.providerId);
        setModelId(detail.project.modelId);
        setPublishSlug(detail.project.publishedSlug || '');
      }
    } catch (err) {
      console.error('Workspace load error:', err);
    }
  }, [user, activeProjectId]);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  const openProject = async (id: string) => {
    setActiveProjectId(id);
    setUndoStack([]);
    setRedoStack([]);
    const detail = await apiRequest<{
      project: ProjectRecord;
      versions: ProjectVersion[];
      shares: SharedProjectLink[];
    }>(`/api/projects/${id}`);
    setProject(detail.project);
    setVersions(detail.versions);
    setShares(detail.shares);
    const firstScreen = detail.project.screens[0];
    setActiveScreenId(firstScreen?.id || '');
    setSelectedSectionId(firstScreen?.sections[0]?.id || null);
    setActiveFilePath(detail.project.files[0]?.path || 'index.html');
  };

  const handleCreateNewProject = async (presetEngine: EngineId = 'engine01_website') => {
    const res = await apiRequest<{ project: ProjectRecord }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: `Studio Project ${projects.length + 1}`,
        engineId: presetEngine,
        providerId,
        modelId,
      }),
    });
    setActiveProjectId(res.project.id);
    await loadWorkspaceData();
  };

  // Mutate project locally with Undo/Redo & persistence
  const mutateProject = useCallback(
    (updater: (prev: ProjectRecord) => ProjectRecord, versionLabel?: string) => {
      setProject((prev) => {
        if (!prev) return prev;
        setUndoStack((u) => [...u.slice(-19), prev]);
        setRedoStack([]);
        const next = updater(prev);
        setSaveStatus('Saving...');

        apiRequest<{ project: ProjectRecord; versions: ProjectVersion[] }>(`/api/projects/${next.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: next.name,
            description: next.description,
            providerId: next.providerId,
            modelId: next.modelId,
            designSystem: next.designSystem,
            screens: next.screens,
            files: next.files,
            animationFrames: next.animationFrames,
            versionLabel,
          }),
        })
          .then((res) => {
            setVersions(res.versions);
            setSaveStatus('Saved');
            window.setTimeout(() => setSaveStatus(''), 1600);
          })
          .catch(() => setSaveStatus('Save failed'));

        return next;
      });
    },
    []
  );

  const handleUndo = () => {
    if (undoStack.length === 0 || !project) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((u) => u.slice(0, -1));
    setRedoStack((r) => [...r, project]);
    setProject(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !project) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, project]);
    setProject(next);
  };

  const estimatedTokens = useMemo(
    () =>
      estimateGenerationTokens({
        engineId: engineId === 'auto' ? 'engine01_website' : engineId,
        screenCount,
        prompt,
        hasReferenceImage: Boolean(referenceImageDataUrl),
      }),
    [engineId, screenCount, prompt, referenceImageDataUrl]
  );

  const handleGenerateClick = () => {
    setErrorMsg('');
    if (!prompt.trim()) {
      setErrorMsg('Enter a prompt or revision instruction.');
      return;
    }
    setJourneyStage('Looping locomotive around prompt payload...');
    setIsLooping(true);
  };

  const handleCeremonyComplete = async () => {
    setIsLooping(false);
    setIsGenerating(true);
    setJourneyStage('Executing AI engine & saving version snapshot...');

    try {
      const res = await apiRequest<{
        job: GenerationJob;
        project: ProjectRecord;
        wallet: TokenWallet;
      }>('/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          projectId: project?.id,
          engineId,
          providerId,
          modelId,
          prompt,
          screenCount,
          referenceImageDataUrl,
        }),
      });
      setWallet(res.wallet);
      setProject(res.project);
      setActiveProjectId(res.project.id);
      const firstScr = res.project.screens[0];
      setActiveScreenId(firstScr?.id || '');
      setSelectedSectionId(firstScr?.sections[0]?.id || null);
      setActiveFilePath(res.project.files[0]?.path || 'index.html');
      setAiMessage(res.job.resultSummary || 'Generation complete.');
      const engMeta = ENGINE_CATALOG.find((e) => e.id === res.project.engineId);
      if (engMeta) {
        setCenterTab(engMeta.primaryView === 'preview' ? 'design' : engMeta.primaryView);
      }
      await loadWorkspaceData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation error.';
      setErrorMsg(msg);
    } finally {
      setIsGenerating(false);
      setJourneyStage('');
    }
  };

  const activeScreen: ScreenNode | undefined = useMemo(() => {
    if (!project) return undefined;
    return project.screens.find((s) => s.id === activeScreenId) || project.screens[0];
  }, [project, activeScreenId]);

  const selectedSection: SectionBlock | undefined = useMemo(() => {
    if (!activeScreen || !selectedSectionId) return undefined;
    return activeScreen.sections.find((sec) => sec.id === selectedSectionId);
  }, [activeScreen, selectedSectionId]);

  const activeFile: ProjectFile | undefined = useMemo(() => {
    if (!project) return undefined;
    return project.files.find((f) => f.path === activeFilePath) || project.files[0];
  }, [project, activeFilePath]);

  const isolatedSrcDoc = useMemo(() => {
    if (!project) return '';
    return buildIsolatedSrcDoc(project, activeScreen?.id);
  }, [project, activeScreen?.id, previewNonce]);

  // Screen / Page CRUD
  const addScreen = () => {
    if (!project) return;
    const idx = project.screens.length + 1;
    const initialSec = createSectionTemplate('hero');
    initialSec.title = `Page ${idx} Overview`;
    const newScreen: ScreenNode = {
      id: `scr_${Date.now()}`,
      name: `Page ${idx}`,
      slug: `/page-${idx}`,
      viewport: previewDevice,
      sections: [initialSec],
    };
    mutateProject(
      (p) => ({ ...p, screens: [...p.screens, newScreen] }),
      `Added ${newScreen.name}`
    );
    setActiveScreenId(newScreen.id);
    setSelectedSectionId(initialSec.id);
  };

  const duplicateScreen = (scr: ScreenNode) => {
    if (!project) return;
    const copy: ScreenNode = {
      ...scr,
      id: `scr_${Date.now()}`,
      name: `${scr.name} Copy`,
      slug: `${scr.slug}-copy`,
      sections: scr.sections.map((s) => ({ ...s, id: `sec_${Math.random().toString(36).slice(2, 9)}` })),
    };
    mutateProject((p) => ({ ...p, screens: [...p.screens, copy] }), `Duplicated ${scr.name}`);
    setActiveScreenId(copy.id);
    setSelectedSectionId(copy.sections[0]?.id || null);
  };

  const deleteScreen = (id: string) => {
    if (!project || project.screens.length <= 1) return;
    const nextScreens = project.screens.filter((s) => s.id !== id);
    mutateProject((p) => ({ ...p, screens: nextScreens }), 'Deleted page');
    if (activeScreenId === id) {
      setActiveScreenId(nextScreens[0].id);
      setSelectedSectionId(nextScreens[0].sections[0]?.id || null);
    }
  };

  const moveScreen = (idx: number, dir: -1 | 1) => {
    if (!project) return;
    const target = idx + dir;
    if (target < 0 || target >= project.screens.length) return;
    const arr = [...project.screens];
    const [moved] = arr.splice(idx, 1);
    arr.splice(target, 0, moved);
    mutateProject((p) => ({ ...p, screens: arr }));
  };

  // Visual Section Editing
  const updateSection = (secId: string, patch: Partial<SectionBlock>) => {
    if (!project || !activeScreen) return;
    mutateProject((p) => ({
      ...p,
      screens: p.screens.map((s) =>
        s.id !== activeScreen.id
          ? s
          : {
              ...s,
              sections: s.sections.map((sec) => (sec.id === secId ? { ...sec, ...patch } : sec)),
            }
      ),
    }));
  };

  const insertSectionAt = (type: SectionBlock['type'], atIndex?: number) => {
    if (!project || !activeScreen) return;
    const sec = createSectionTemplate(type);
    mutateProject(
      (p) => ({
        ...p,
        screens: p.screens.map((s) => {
          if (s.id !== activeScreen.id) return s;
          const next = [...s.sections];
          if (typeof atIndex === 'number' && atIndex >= 0 && atIndex <= next.length) {
            next.splice(atIndex, 0, sec);
          } else {
            next.push(sec);
          }
          return { ...s, sections: next };
        }),
      }),
      `Added ${type} section`
    );
    setSelectedSectionId(sec.id);
    setCenterTab('design');
  };

  const duplicateSection = (sec: SectionBlock) => {
    if (!project || !activeScreen) return;
    const copy: SectionBlock = {
      ...sec,
      id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    };
    mutateProject((p) => ({
      ...p,
      screens: p.screens.map((s) => {
        if (s.id !== activeScreen.id) return s;
        const idx = s.sections.findIndex((item) => item.id === sec.id);
        const next = [...s.sections];
        next.splice(idx >= 0 ? idx + 1 : next.length, 0, copy);
        return { ...s, sections: next };
      }),
    }));
    setSelectedSectionId(copy.id);
  };

  const removeSection = (secId: string) => {
    if (!project || !activeScreen) return;
    mutateProject((p) => ({
      ...p,
      screens: p.screens.map((s) =>
        s.id === activeScreen.id
          ? { ...s, sections: s.sections.filter((sec) => sec.id !== secId) }
          : s
      ),
    }));
    if (selectedSectionId === secId) {
      const remaining = activeScreen.sections.filter((s) => s.id !== secId);
      setSelectedSectionId(remaining[0]?.id || null);
    }
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    if (!project || !activeScreen) return;
    const target = idx + dir;
    if (target < 0 || target >= activeScreen.sections.length) return;
    const nextSecs = [...activeScreen.sections];
    const [item] = nextSecs.splice(idx, 1);
    nextSecs.splice(target, 0, item);
    mutateProject((p) => ({
      ...p,
      screens: p.screens.map((s) => (s.id === activeScreen.id ? { ...s, sections: nextSecs } : s)),
    }));
  };

  const reorderSectionDrop = (fromIdx: number, toIdx: number) => {
    if (!project || !activeScreen || fromIdx === toIdx) return;
    const nextSecs = [...activeScreen.sections];
    const [moved] = nextSecs.splice(fromIdx, 1);
    const adjustedTo = fromIdx < toIdx ? toIdx - 1 : toIdx;
    nextSecs.splice(Math.max(0, Math.min(nextSecs.length, adjustedTo)), 0, moved);
    mutateProject((p) => ({
      ...p,
      screens: p.screens.map((s) => (s.id === activeScreen.id ? { ...s, sections: nextSecs } : s)),
    }));
  };

  // Code Editor actions
  const updateCodeContent = (nextContent: string) => {
    if (!project || !activeFile) return;
    mutateProject((p) => ({
      ...p,
      files: p.files.map((f) => (f.path === activeFile.path ? { ...f, content: nextContent } : f)),
    }));
  };

  const handleCodeSearchReplace = () => {
    if (!activeFile || !codeSearch) return;
    updateCodeContent(activeFile.content.split(codeSearch).join(codeReplace));
  };

  const handleValidateCode = () => {
    if (!activeFile) return;
    if (activeFile.language === 'javascript') {
      try {
        new Function(activeFile.content);
        setCodeDiagnostic('JavaScript syntax verified: 0 errors.');
      } catch (err) {
        setCodeDiagnostic(err instanceof Error ? err.message : 'Syntax error');
      }
    } else if (activeFile.language === 'json') {
      try {
        JSON.parse(activeFile.content);
        setCodeDiagnostic('Valid JSON.');
      } catch (err) {
        setCodeDiagnostic(err instanceof Error ? err.message : 'Invalid JSON');
      }
    } else {
      setCodeDiagnostic(`${activeFile.path} checked (${activeFile.content.split('\n').length} lines).`);
    }
  };

  // Exports
  const handleExportRaster = async (format: 'png' | 'jpeg') => {
    if (!project || !activeScreen) return;
    const blob = await exportScreenToRasterBlob(project, activeScreen, format);
    triggerDownload(
      blob,
      `${project.name.toLowerCase().replace(/\s+/g, '-')}-${activeScreen.name}.${format === 'jpeg' ? 'jpg' : 'png'}`
    );
    setExportMenuOpen(false);
  };

  const handleExportSvg = () => {
    if (!project || !activeScreen) return;
    const svg = exportScreenToSvgString(project, activeScreen);
    triggerDownload(
      new Blob([svg], { type: 'image/svg+xml' }),
      `${project.name.toLowerCase().replace(/\s+/g, '-')}.svg`
    );
    setExportMenuOpen(false);
  };

  const handleExportGif = async () => {
    if (!project) return;
    const res = await apiRequest<{ gifDataUrl: string }>(`/api/projects/${project.id}/export-gif`, {
      method: 'POST',
      body: JSON.stringify({ frames: project.animationFrames }),
    });
    setProject((p) => (p ? { ...p, gifDataUrl: res.gifDataUrl } : p));
    const byteString = atob(res.gifDataUrl.split(',')[1]);
    const bytes = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
    triggerDownload(
      new Blob([bytes], { type: 'image/gif' }),
      `${project.name.toLowerCase().replace(/\s+/g, '-')}.gif`
    );
    setExportMenuOpen(false);
  };

  const handleExportZip = async () => {
    if (!project) return;
    const res = await apiRequest<Response>(`/api/projects/${project.id}/export-zip`, {
      method: 'POST',
      rawResponse: true,
    });
    const blob = await res.blob();
    triggerDownload(blob, `${project.name.toLowerCase().replace(/\s+/g, '-')}.zip`);
    setExportMenuOpen(false);
  };

  // Share & Publish
  const handleCreateShare = async (visibility: 'public' | 'private') => {
    if (!project) return;
    const res = await apiRequest<{ shareUrl: string; shares: SharedProjectLink[] }>(
      `/api/projects/${project.id}/share`,
      {
        method: 'POST',
        body: JSON.stringify({ visibility, permission: 'view', expiresInHours: 168 }),
      }
    );
    setShareUrlCreated(res.shareUrl);
    setShares(res.shares);
  };

  const handleRevokeShare = async (shareId: string) => {
    await apiRequest(`/api/shares/${shareId}`, { method: 'DELETE' });
    setShares((prev) => prev.map((s) => (s.id === shareId ? { ...s, revoked: true } : s)));
  };

  const handlePublish = async () => {
    if (!project) return;
    setPublishing(true);
    setPublishLogs([]);
    try {
      const res = await apiRequest<{
        publishedUrl: string;
        logs: string[];
        project: ProjectRecord;
      }>(`/api/projects/${project.id}/publish`, {
        method: 'POST',
        body: JSON.stringify({ target: publishTarget, customSlug: publishSlug }),
      });
      setPublishLogs(res.logs);
      setProject(res.project);
    } catch (err) {
      setPublishLogs([err instanceof Error ? err.message : 'Deployment failed.']);
    } finally {
      setPublishing(false);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!project) return;
    const res = await apiRequest<{ project: ProjectRecord; versions: ProjectVersion[] }>(
      `/api/projects/${project.id}/versions/${versionId}/restore`,
      { method: 'POST' }
    );
    setProject(res.project);
    setVersions(res.versions);
    const firstScr = res.project.screens[0];
    setActiveScreenId(firstScr?.id || '');
    setSelectedSectionId(firstScr?.sections[0]?.id || null);
  };

  const handleUploadAsset = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;
      const res = await apiRequest<{ asset: AssetItem }>('/api/assets', {
        method: 'POST',
        body: JSON.stringify({
          name: file.name,
          kind: 'uploaded',
          mimeType: file.type || 'image/png',
          dataUrl: reader.result,
          projectId: project?.id,
        }),
      });
      setAssets((prev) => [res.asset, ...prev]);
    };
    reader.readAsDataURL(file);
  };

  const selectLeftTab = (tab: WorkspaceSidebarTab) => {
    setLeftTab(tab);
    setWorkspaceLeftTab(tab);
  };

  if (!user) return null;

  const ds = project?.designSystem || {
    primaryColor: '#2563EB',
    secondaryColor: '#0EA5E9',
    backgroundColor: '#090B10',
    surfaceColor: '#111622',
    textColor: '#F8FAFC',
    headingFont: 'Outfit',
    bodyFont: 'Plus Jakarta Sans',
    fontSize: 16,
    borderRadius: 10,
    spacingScale: 'balanced' as const,
    buttonStyle: 'solid' as const,
    textAlign: 'left' as const,
  };

  const canvasMaxWidth =
    previewDevice === 'mobile' ? '375px' : previewDevice === 'tablet' ? '768px' : '100%';

  // Reusable Left Sidebar Inner Content (7 Ordered Navigation Rail + Active Panel Drawer)
  const leftSidebarBody = (
    <div className="flex h-full min-h-0">
      {/* Vertical Icon + Label Rail (Exact 7 Ordered Options) */}
      <nav
        aria-label="Visual workspace sidebar navigation"
        className="w-[92px] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#090B10]/95 flex flex-col justify-between py-2.5 px-1.5"
      >
        <div className="space-y-1">
          {LEFT_SIDEBAR_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const active = leftTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-sidebar-index={index + 1}
                onClick={() => selectLeftTab(item.id)}
                className={`w-full flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="leading-tight text-center truncate w-full">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
          <button
            type="button"
            onClick={() => navigate('wallet')}
            className="w-full flex flex-col items-center py-2 px-1 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-mono tabular-nums text-slate-700 dark:text-slate-200 hover:border-blue-600 cursor-pointer"
            title="Cashfree Token Wallet"
          >
            <span className="font-bold">{wallet?.availableTokens ?? 0}</span>
            <span className="text-slate-400">tokens</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className="w-full flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Home</span>
          </button>
        </div>
      </nav>

      {/* Active Sidebar Drawer */}
      <div className="flex-1 min-w-0 overflow-y-auto p-3.5 space-y-4">
        {/* 1. SECTIONS */}
        {leftTab === 'sections' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-display font-semibold text-slate-900 dark:text-white">
                  Sections
                </h2>
                <p className="text-[11px] text-slate-500 truncate max-w-[140px]">
                  {activeScreen?.name || 'No page'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => insertSectionAt('features')}
                disabled={!activeScreen}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>

            {!activeScreen || activeScreen.sections.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                No sections on this page yet.
              </p>
            ) : (
              <div className="space-y-1.5">
                {activeScreen.sections.map((sec, idx) => {
                  const selected = selectedSectionId === sec.id;
                  const hiddenAny = sec.hideOnDesktop || sec.hideOnTablet || sec.hideOnMobile;
                  return (
                    <div
                      key={sec.id}
                      draggable
                      onDragStart={() => {
                        setDragSectionIdx(idx);
                        setDragComponentType(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDropTargetIdx(idx);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragSectionIdx !== null) {
                          reorderSectionDrop(dragSectionIdx, idx);
                        } else if (dragComponentType) {
                          insertSectionAt(dragComponentType, idx);
                        }
                        setDragSectionIdx(null);
                        setDragComponentType(null);
                        setDropTargetIdx(null);
                      }}
                      onDragEnd={() => {
                        setDragSectionIdx(null);
                        setDropTargetIdx(null);
                      }}
                      className={`rounded-lg border p-2.5 text-xs transition-colors ${
                        selected
                          ? 'border-blue-600 bg-blue-600/10'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSectionId(sec.id);
                            setCenterTab('design');
                          }}
                          className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0 cursor-grab" />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-white truncate">
                              {sec.title || sec.type}
                            </div>
                            <div className="text-[10px] font-mono uppercase text-slate-500">
                              {sec.type}
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-0.5 shrink-0">
                          {hiddenAny && (
                            <span title="Has responsive visibility rule" className="mr-1 inline-flex">
                              <EyeOff className="w-3 h-3 text-amber-500" />
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => moveSection(idx, -1)}
                            disabled={idx === 0}
                            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSection(idx, 1)}
                            disabled={idx === activeScreen.sections.length - 1}
                            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSection(sec.id)}
                            className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                            title="Delete section"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 2. PAGES */}
        {leftTab === 'pages' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-display font-semibold text-slate-900 dark:text-white">
                Pages & Screens
              </h2>
              <button
                type="button"
                onClick={addScreen}
                disabled={!project}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Page
              </button>
            </div>

            {project && (
              <div className="space-y-2">
                {project.screens.map((scr, idx) => {
                  const isActive = activeScreen?.id === scr.id;
                  return (
                    <div
                      key={scr.id}
                      className={`rounded-lg border p-2.5 text-xs space-y-2 ${
                        isActive
                          ? 'border-blue-600 bg-blue-600/10'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveScreenId(scr.id);
                            setSelectedSectionId(scr.sections[0]?.id || null);
                          }}
                          className="text-left flex-1 min-w-0 cursor-pointer"
                        >
                          <div className="font-semibold text-slate-900 dark:text-white truncate">
                            {idx + 1}. {scr.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 truncate">
                            {scr.slug} · {scr.sections.length} sections
                          </div>
                        </button>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => moveScreen(idx, -1)}
                            disabled={idx === 0}
                            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveScreen(idx, 1)}
                            disabled={idx === project.screens.length - 1}
                            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateScreen(scr)}
                            title="Duplicate page"
                            className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          {project.screens.length > 1 && (
                            <button
                              type="button"
                              onClick={() => deleteScreen(scr.id)}
                              title="Delete page"
                              className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {isActive && (
                        <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-200/70 dark:border-slate-800">
                          <input
                            type="text"
                            value={scr.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              mutateProject((p) => ({
                                ...p,
                                screens: p.screens.map((s) => (s.id === scr.id ? { ...s, name: val } : s)),
                              }));
                            }}
                            placeholder="Page Name"
                            className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 py-1 text-[11px]"
                          />
                          <input
                            type="text"
                            value={scr.slug}
                            onChange={(e) => {
                              const val = e.target.value;
                              mutateProject((p) => ({
                                ...p,
                                screens: p.screens.map((s) => (s.id === scr.id ? { ...s, slug: val } : s)),
                              }));
                            }}
                            placeholder="/slug"
                            className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 py-1 text-[11px] font-mono"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Switch Studio Project */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">All Projects ({projects.length})</span>
                <button
                  type="button"
                  onClick={() => void handleCreateNewProject()}
                  className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                >
                  <FolderPlus className="w-3 h-3" /> New
                </button>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void openProject(p.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs truncate cursor-pointer ${
                      project?.id === p.id
                        ? 'bg-blue-600/10 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. STYLES */}
        {leftTab === 'styles' && project && (
          <div className="space-y-4 text-xs">
            <h2 className="text-xs font-display font-semibold text-slate-900 dark:text-white">
              Global Site Styles
            </h2>

            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-500">Theme Presets</span>
              <div className="grid grid-cols-2 gap-1.5">
                {PALETTE_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() =>
                      mutateProject(
                        (p) => ({
                          ...p,
                          designSystem: { ...p.designSystem, ...preset.ds },
                        }),
                        `Applied ${preset.name} theme`
                      )
                    }
                    className="text-left rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-600 p-2 cursor-pointer"
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <span
                        className="w-3 h-3 rounded-xs border border-white/20"
                        style={{ backgroundColor: preset.ds.backgroundColor }}
                      />
                      <span
                        className="w-3 h-3 rounded-xs border border-white/20"
                        style={{ backgroundColor: preset.ds.primaryColor }}
                      />
                      <span
                        className="w-3 h-3 rounded-xs border border-white/20"
                        style={{ backgroundColor: preset.ds.secondaryColor }}
                      />
                    </div>
                    <span className="text-[11px] font-medium block truncate">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] text-slate-500">Brand Tokens</span>
              <div className="grid grid-cols-1 gap-1.5">
                {(
                  [
                    { key: 'primaryColor', label: 'Primary Accent' },
                    { key: 'secondaryColor', label: 'Secondary' },
                    { key: 'backgroundColor', label: 'Page Background' },
                    { key: 'surfaceColor', label: 'Card Surface' },
                    { key: 'textColor', label: 'Body Text' },
                  ] as const
                ).map((c) => (
                  <label
                    key={c.key}
                    className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5"
                  >
                    <span className="text-[11px] text-slate-600 dark:text-slate-300">{c.label}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-slate-400">
                        {project.designSystem[c.key]}
                      </span>
                      <input
                        type="color"
                        value={project.designSystem[c.key]}
                        onChange={(e) => {
                          const val = e.target.value;
                          mutateProject((p) => ({
                            ...p,
                            designSystem: { ...p.designSystem, [c.key]: val },
                          }));
                        }}
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Heading Font</label>
                <select
                  value={project.designSystem.headingFont}
                  onChange={(e) => {
                    const headingFont = e.target.value;
                    mutateProject((p) => ({
                      ...p,
                      designSystem: { ...p.designSystem, headingFont },
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Body Font</label>
                <select
                  value={project.designSystem.bodyFont}
                  onChange={(e) => {
                    const bodyFont = e.target.value;
                    mutateProject((p) => ({
                      ...p,
                      designSystem: { ...p.designSystem, bodyFont },
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">
                  Global Radius ({project.designSystem.borderRadius}px)
                </label>
                <input
                  type="range"
                  min={0}
                  max={28}
                  value={project.designSystem.borderRadius}
                  onChange={(e) => {
                    const borderRadius = Number(e.target.value);
                    mutateProject((p) => ({
                      ...p,
                      designSystem: { ...p.designSystem, borderRadius },
                    }));
                  }}
                  className="w-full accent-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Spacing Density</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['compact', 'balanced', 'spacious'] as const).map((sc) => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() =>
                        mutateProject((p) => ({
                          ...p,
                          designSystem: { ...p.designSystem, spacingScale: sc },
                        }))
                      }
                      className={`py-1.5 rounded border capitalize text-[11px] cursor-pointer ${
                        project.designSystem.spacingScale === sc
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {sc}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. COMPONENTS */}
        {leftTab === 'components' && (
          <div className="space-y-3">
            <div>
              <h2 className="text-xs font-display font-semibold text-slate-900 dark:text-white">
                Components
              </h2>
              <p className="text-[11px] text-slate-500">
                Click or drag any block onto the design canvas.
              </p>
            </div>

            <div className="space-y-2">
              {COMPONENT_BLOCKS.map((blk) => (
                <button
                  key={blk.type}
                  type="button"
                  draggable
                  onDragStart={() => {
                    setDragComponentType(blk.type);
                    setDragSectionIdx(null);
                  }}
                  onDragEnd={() => {
                    setDragComponentType(null);
                    setDropTargetIdx(null);
                  }}
                  onClick={() => insertSectionAt(blk.type)}
                  className="w-full text-left rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-600 p-2.5 transition-colors cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">
                      {blk.label}
                    </span>
                    <Plus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500 leading-snug">{blk.description}</p>
                </button>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold text-slate-500">Starter Templates</span>
              {DEMO_GALLERY.slice(0, 6).map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    setPrompt(tpl.prompt);
                    setEngineId(tpl.engineId);
                    setScreenCount(tpl.screensHint);
                    selectLeftTab('ai_assistant');
                  }}
                  className="w-full text-left rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-600 p-2 text-xs cursor-pointer"
                >
                  <div className="font-semibold text-slate-900 dark:text-white truncate">{tpl.title}</div>
                  <div className="text-[10px] text-slate-500">{tpl.category}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 5. SERVICES */}
        {leftTab === 'services' && (
          <div className="space-y-4">
            <ServicesFolderPanel
              compact
              onLaunchEngine={(id) => {
                setEngineId(id);
                selectLeftTab('ai_assistant');
              }}
              onOpenWallet={() => navigate('wallet')}
              onOpenShare={() => setShareModalOpen(true)}
              onOpenPublish={() => setPublishModalOpen(true)}
              onExportZip={() => void handleExportZip()}
            />

            {/* Visual Asset Library */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                  Asset Library ({assets.length})
                </h3>
                <button
                  type="button"
                  onClick={() => assetUploadInput.current?.click()}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  <Upload className="w-3 h-3" /> Upload
                </button>
              </div>
              <input
                ref={assetUploadInput}
                type="file"
                accept="image/*"
                onChange={handleUploadAsset}
                className="hidden"
              />
              {assets.slice(0, 6).map((ast) => (
                <div key={ast.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-xs">
                  <img
                    src={ast.dataUrl}
                    alt={ast.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-16 object-cover rounded mb-1.5"
                  />
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-[11px] font-medium">{ast.name}</span>
                    {selectedSection && (
                      <button
                        type="button"
                        onClick={() => updateSection(selectedSection.id, { imageUrl: ast.dataUrl })}
                        className="text-[10px] font-semibold text-blue-600 hover:underline shrink-0 cursor-pointer"
                      >
                        Apply
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. AI ASSISTANT */}
        {leftTab === 'ai_assistant' && (
          <div className="space-y-3">
            <h2 className="text-xs font-display font-semibold text-slate-900 dark:text-white">
              AI Assistant
            </h2>

            <PromptTrainWrapper
              isLooping={isLooping}
              isGenerating={isGenerating}
              journeyStage={journeyStage}
              onCeremonyComplete={handleCeremonyComplete}
            >
              <div className="rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-[#0E131E] shadow-[0_12px_32px_-16px_rgba(15,23,42,0.14)] dark:shadow-[0_18px_42px_-18px_rgba(0,0,0,0.65)] overflow-hidden transition-all duration-200 focus-within:border-blue-600/80 dark:focus-within:border-blue-500/75 focus-within:ring-4 focus-within:ring-blue-600/10">
                {/* Composer Header Strip */}
                <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#121826]/70 space-y-2">
                  <select
                    value={engineId}
                    onChange={(e) => setEngineId(e.target.value as EngineId | 'auto')}
                    aria-label="AI Engine"
                    className="w-full rounded-lg border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-[#0A0E17] px-2.5 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                  >
                    <option value="auto">Auto-Select AI Engine</option>
                    {ENGINE_CATALOG.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.number}. {e.name}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center justify-between gap-2 text-xs">
                    <select
                      value={screenCount}
                      onChange={(e) => setScreenCount(Number(e.target.value))}
                      aria-label="Page count"
                      className="rounded-lg border border-slate-200/90 dark:border-slate-700/80 bg-white dark:bg-[#0A0E17] px-2.5 py-1 text-xs font-mono tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                    >
                      {[1, 2, 3, 5, 8, 10].map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? 'page' : 'pages'}
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      ~{estimatedTokens} tokens
                    </span>
                  </div>
                </div>

                {/* Spacious Prompt Input & Provider Area */}
                <div className="px-3.5 pt-3.5 pb-3 space-y-3">
                  <textarea
                    rows={5}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe a website, page revision, code feature, graphic, or GIF animation..."
                    className="w-full min-h-[124px] resize-y bg-transparent text-[13.5px] leading-relaxed text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                  />

                  {referenceImageDataUrl && (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 px-2.5 py-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={referenceImageDataUrl}
                          alt="Uploaded reference"
                          referrerPolicy="no-referrer"
                          className="w-7 h-7 rounded object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                        <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                          Reference attached
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReferenceImageDataUrl(null)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors cursor-pointer shrink-0"
                        aria-label="Remove reference image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <ModelSelector
                    providerId={providerId}
                    modelId={modelId}
                    onChange={(p, m) => {
                      setProviderId(p);
                      setModelId(m);
                    }}
                    compact
                  />
                </div>

                <input
                  ref={refImgInput}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const r = new FileReader();
                    r.onload = () => typeof r.result === 'string' && setReferenceImageDataUrl(r.result);
                    r.readAsDataURL(file);
                  }}
                  className="hidden"
                />

                {/* Composer Footer Toolbar */}
                <div className="px-3.5 py-2.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0B0F17]/75 space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => refImgInput.current?.click()}
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#131926] hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      {referenceImageDataUrl ? 'Ref Ready' : 'Ref Image'}
                    </button>
                    <button
                      type="button"
                      disabled={isLooping || isGenerating}
                      onClick={handleGenerateClick}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm shadow-blue-600/25 transition-all whitespace-nowrap cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate
                    </button>
                  </div>

                  {aiMessage && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{aiMessage}</p>
                  )}
                  {errorMsg && (
                    <div className="text-[11px] text-red-500 space-y-1">
                      <p>{errorMsg}</p>
                      {errorMsg.includes('INSUFFICIENT_TOKENS') && (
                        <button
                          type="button"
                          onClick={() => navigate('wallet')}
                          className="px-2.5 py-1 rounded bg-blue-600 text-white font-semibold cursor-pointer"
                        >
                          Top Up via Cashfree
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </PromptTrainWrapper>

            {/* Recent AI Runs */}
            <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500">Recent AI Runs</span>
              {jobs.slice(0, 4).map((j) => (
                <div
                  key={j.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-[11px]"
                >
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="capitalize">{j.status}</span>
                    <span className="font-mono tabular-nums">{j.settledTokens || j.estimatedTokens}t</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-slate-800 dark:text-slate-200">{j.prompt}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. SETTINGS */}
        {leftTab === 'settings' && (
          <div className="space-y-2">
            <div>
              <h2 className="text-xs font-display font-semibold text-slate-900 dark:text-white">
                Settings
              </h2>
              <p className="text-[11px] text-slate-500">
                Select any category to manage platform preferences.
              </p>
            </div>
            <div className="space-y-1">
              {SETTINGS_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSettingsSubSection(cat.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    settingsSubSection === cat.id
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Reusable Right Style Panel (Style & Advanced Tabs)
  const rightInspectorBody = (
    <div className="flex flex-col h-full min-h-0">
      {/* Inspector Header + Tab Switcher */}
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xs font-display font-semibold text-slate-900 dark:text-white truncate">
              {selectedSection ? `Section: ${selectedSection.type}` : 'Global Design Properties'}
            </h2>
            <p className="text-[11px] text-slate-500 truncate">
              {selectedSection ? selectedSection.title : project?.name || 'Select a section'}
            </p>
          </div>
          {selectedSection && (
            <button
              type="button"
              onClick={() => setSelectedSectionId(null)}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline shrink-0 cursor-pointer"
            >
              Global
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setRightTab('style')}
            className={`py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
              rightTab === 'style'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Style
          </button>
          <button
            type="button"
            onClick={() => setRightTab('advanced')}
            className={`py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
              rightTab === 'advanced'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Advanced
          </button>
        </div>
      </div>

      {/* Inspector Scroll Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-5 text-xs">
        {!project ? (
          <p className="text-slate-500 text-center py-8">Open or create a project to edit properties.</p>
        ) : rightTab === 'style' ? (
          <>
            {/* Content Copy (when section selected) */}
            {selectedSection && (
              <section className="space-y-2.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Content Copy
                </h3>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Subtitle / Kicker</label>
                  <input
                    type="text"
                    value={selectedSection.subtitle}
                    onChange={(e) => updateSection(selectedSection.id, { subtitle: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Heading Title</label>
                  <input
                    type="text"
                    value={selectedSection.title}
                    onChange={(e) => updateSection(selectedSection.id, { title: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Body Text</label>
                  <textarea
                    rows={3}
                    value={selectedSection.body}
                    onChange={(e) => updateSection(selectedSection.id, { body: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Button Label</label>
                  <input
                    type="text"
                    value={selectedSection.ctaLabel}
                    onChange={(e) => updateSection(selectedSection.id, { ctaLabel: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                  />
                </div>
              </section>
            )}

            {/* Colors & Background */}
            <section className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-slate-800 first:pt-0 first:border-t-0">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Colors & Background
              </h3>

              {selectedSection ? (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Background Mode</label>
                    <div className="grid grid-cols-3 gap-1">
                      {(['solid', 'surface', 'gradient'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => updateSection(selectedSection.id, { backgroundStyle: mode })}
                          className={`py-1.5 rounded border capitalize text-[11px] cursor-pointer ${
                            (selectedSection.backgroundStyle || 'solid') === mode
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5">
                      <span className="text-[11px] text-slate-500">Background</span>
                      <input
                        type="color"
                        value={selectedSection.backgroundColor || ds.backgroundColor}
                        onChange={(e) =>
                          updateSection(selectedSection.id, { backgroundColor: e.target.value })
                        }
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                      />
                    </label>
                    <label className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5">
                      <span className="text-[11px] text-slate-500">Text Color</span>
                      <input
                        type="color"
                        value={selectedSection.textColor || ds.textColor}
                        onChange={(e) =>
                          updateSection(selectedSection.id, { textColor: e.target.value })
                        }
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                      />
                    </label>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Section Media URL</label>
                    <input
                      type="text"
                      value={selectedSection.imageUrl || ''}
                      placeholder="https://... or upload in Services"
                      onChange={(e) => updateSection(selectedSection.id, { imageUrl: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { key: 'primaryColor', label: 'Primary' },
                      { key: 'secondaryColor', label: 'Secondary' },
                      { key: 'backgroundColor', label: 'Background' },
                      { key: 'surfaceColor', label: 'Surface' },
                      { key: 'textColor', label: 'Text Color' },
                    ] as const
                  ).map((c) => (
                    <label
                      key={c.key}
                      className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5"
                    >
                      <span className="text-[11px] text-slate-500">{c.label}</span>
                      <input
                        type="color"
                        value={ds[c.key]}
                        onChange={(e) => {
                          const val = e.target.value;
                          mutateProject((p) => ({
                            ...p,
                            designSystem: { ...p.designSystem, [c.key]: val },
                          }));
                        }}
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                      />
                    </label>
                  ))}
                </div>
              )}
            </section>

            {/* Typography */}
            <section className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Typography
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Heading Font</label>
                  <select
                    value={selectedSection?.headingFont || ds.headingFont}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (selectedSection) {
                        updateSection(selectedSection.id, { headingFont: val });
                      } else {
                        mutateProject((p) => ({
                          ...p,
                          designSystem: { ...p.designSystem, headingFont: val },
                        }));
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-[11px]"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Body Font</label>
                  <select
                    value={selectedSection?.bodyFont || ds.bodyFont}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (selectedSection) {
                        updateSection(selectedSection.id, { bodyFont: val });
                      } else {
                        mutateProject((p) => ({
                          ...p,
                          designSystem: { ...p.designSystem, bodyFont: val },
                        }));
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-[11px]"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 items-end">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Font Size ({selectedSection?.fontSize ?? ds.fontSize ?? 16}px)
                  </label>
                  <input
                    type="range"
                    min={12}
                    max={28}
                    value={selectedSection?.fontSize ?? ds.fontSize ?? 16}
                    onChange={(e) => {
                      const fontSize = Number(e.target.value);
                      if (selectedSection) {
                        updateSection(selectedSection.id, { fontSize });
                      } else {
                        mutateProject((p) => ({
                          ...p,
                          designSystem: { ...p.designSystem, fontSize },
                        }));
                      }
                    }}
                    className="w-full accent-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Alignment</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { id: 'left', icon: AlignLeft },
                        { id: 'center', icon: AlignCenter },
                        { id: 'right', icon: AlignRight },
                      ] as const
                    ).map((al) => {
                      const Icon = al.icon;
                      const current = selectedSection?.textAlign || ds.textAlign || 'left';
                      return (
                        <button
                          key={al.id}
                          type="button"
                          onClick={() => {
                            if (selectedSection) {
                              updateSection(selectedSection.id, { textAlign: al.id });
                            } else {
                              mutateProject((p) => ({
                                ...p,
                                designSystem: { ...p.designSystem, textAlign: al.id },
                              }));
                            }
                          }}
                          className={`flex items-center justify-center py-1.5 rounded border cursor-pointer ${
                            current === al.id
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* Spacing */}
            <section className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Spacing
              </h3>
              {selectedSection ? (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Pad Y (px)</label>
                    <input
                      type="number"
                      min={0}
                      max={160}
                      value={selectedSection.paddingY ?? 56}
                      onChange={(e) =>
                        updateSection(selectedSection.id, { paddingY: Number(e.target.value) })
                      }
                      className="w-full rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Pad X (px)</label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={selectedSection.paddingX ?? 24}
                      onChange={(e) =>
                        updateSection(selectedSection.id, { paddingX: Number(e.target.value) })
                      }
                      className="w-full rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Margin Y</label>
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={selectedSection.marginY ?? 0}
                      onChange={(e) =>
                        updateSection(selectedSection.id, { marginY: Number(e.target.value) })
                      }
                      className="w-full rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1">
                  {(['compact', 'balanced', 'spacious'] as const).map((sc) => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() =>
                        mutateProject((p) => ({
                          ...p,
                          designSystem: { ...p.designSystem, spacingScale: sc },
                        }))
                      }
                      className={`py-1.5 rounded border capitalize text-[11px] cursor-pointer ${
                        ds.spacingScale === sc
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {sc}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Borders & Button Style */}
            <section className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Borders & Buttons
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Radius ({selectedSection?.borderRadius ?? ds.borderRadius}px)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={28}
                    value={selectedSection?.borderRadius ?? ds.borderRadius}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (selectedSection) {
                        updateSection(selectedSection.id, { borderRadius: val });
                      } else {
                        mutateProject((p) => ({
                          ...p,
                          designSystem: { ...p.designSystem, borderRadius: val },
                        }));
                      }
                    }}
                    className="w-full accent-blue-600"
                  />
                </div>
                {selectedSection && (
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Border Width (px)</label>
                    <input
                      type="number"
                      min={0}
                      max={8}
                      value={selectedSection.borderWidth ?? 0}
                      onChange={(e) =>
                        updateSection(selectedSection.id, { borderWidth: Number(e.target.value) })
                      }
                      className="w-full rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono"
                    />
                  </div>
                )}
              </div>

              {selectedSection && (selectedSection.borderWidth ?? 0) > 0 && (
                <label className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5">
                  <span className="text-[11px] text-slate-500">Border Color</span>
                  <input
                    type="color"
                    value={selectedSection.borderColor || '#334155'}
                    onChange={(e) =>
                      updateSection(selectedSection.id, { borderColor: e.target.value })
                    }
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                  />
                </label>
              )}

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Button Style</label>
                <div className="grid grid-cols-4 gap-1">
                  {(['solid', 'outline', 'soft', 'sharp'] as const).map((bs) => {
                    const activeBtn = (selectedSection?.buttonStyle || ds.buttonStyle || 'solid') === bs;
                    return (
                      <button
                        key={bs}
                        type="button"
                        onClick={() => {
                          if (selectedSection) {
                            updateSection(selectedSection.id, { buttonStyle: bs });
                          } else {
                            mutateProject((p) => ({
                              ...p,
                              designSystem: { ...p.designSystem, buttonStyle: bs },
                            }));
                          }
                        }}
                        className={`py-1.5 rounded border capitalize text-[11px] cursor-pointer ${
                          activeBtn
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        {bs}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </>
        ) : (
          /* ADVANCED TAB */
          <div className="space-y-5">
            {selectedSection ? (
              <>
                <section className="space-y-2.5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Element Properties
                  </h3>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Section Semantic Type</label>
                    <select
                      value={selectedSection.type}
                      onChange={(e) =>
                        updateSection(selectedSection.id, {
                          type: e.target.value as SectionBlock['type'],
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                    >
                      {['hero', 'features', 'stats', 'gallery', 'pricing', 'form', 'navigation', 'footer', 'custom'].map(
                        (t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Container Max Width</label>
                    <select
                      value={selectedSection.maxWidth || 'standard'}
                      onChange={(e) =>
                        updateSection(selectedSection.id, {
                          maxWidth: e.target.value as SectionBlock['maxWidth'],
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5"
                    >
                      <option value="narrow">Narrow (768px)</option>
                      <option value="standard">Standard (1080px)</option>
                      <option value="wide">Wide (1280px)</option>
                      <option value="full">Full Bleed (100%)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">CTA Link / Route</label>
                    <input
                      type="text"
                      value={selectedSection.ctaHref}
                      onChange={(e) => updateSection(selectedSection.id, { ctaHref: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">HTML Element ID</label>
                      <input
                        type="text"
                        value={selectedSection.customId || ''}
                        placeholder="hero-main"
                        onChange={(e) => updateSection(selectedSection.id, { customId: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">CSS Class</label>
                      <input
                        type="text"
                        value={selectedSection.customClass || ''}
                        placeholder="custom-band"
                        onChange={(e) =>
                          updateSection(selectedSection.id, { customClass: e.target.value })
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1.5 font-mono"
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Responsive Visibility
                  </h3>
                  {(
                    [
                      { key: 'hideOnDesktop', label: 'Hide on Desktop (1024px+)' },
                      { key: 'hideOnTablet', label: 'Hide on Tablet (640px-1023px)' },
                      { key: 'hideOnMobile', label: 'Hide on Mobile (<640px)' },
                    ] as const
                  ).map((vis) => (
                    <label
                      key={vis.key}
                      className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 cursor-pointer"
                    >
                      <span>{vis.label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(selectedSection[vis.key])}
                        onChange={(e) =>
                          updateSection(selectedSection.id, { [vis.key]: e.target.checked })
                        }
                        className="h-4 w-4 accent-blue-600"
                      />
                    </label>
                  ))}
                </section>
              </>
            ) : (
              <p className="text-slate-500 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-4 text-center">
                Select any section on the canvas to configure element ID, CSS classes, container width, and responsive device visibility.
              </p>
            )}

            {/* Version Snapshots */}
            <section className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                <History className="w-3.5 h-3.5" />
                Version History
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        v{v.versionNumber} · {v.label}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {new Date(v.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleRestoreVersion(v.id)}
                      title="Restore version"
                      className="p-1 text-blue-600 hover:text-blue-500 cursor-pointer shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative z-10 h-[calc(100vh-4rem)] min-h-[620px] flex flex-col bg-slate-50 dark:bg-[#07090E] overflow-hidden">
      {/* TOP PROFESSIONAL VISUAL BUILDER TOOLBAR */}
      <header className="shrink-0 z-20 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1017] px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Drawer toggle, Back, Project Name & Page switcher */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setMobileLeftOpen(true)}
            aria-label="Open builder sidebar"
            className="lg:hidden p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => navigate('dashboard')}
            title="Back to Studio Dashboard"
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Dashboard
          </button>

          <input
            type="text"
            value={project?.name || ''}
            onChange={(e) => {
              const name = e.target.value;
              setProject((p) => (p ? { ...p, name } : p));
            }}
            onBlur={() => {
              if (project) {
                mutateProject((p) => ({ ...p, name: project.name }));
              }
            }}
            placeholder="Project Name"
            className="text-sm font-display font-bold bg-transparent border-b border-transparent focus:border-blue-600 focus:outline-none text-slate-900 dark:text-white truncate max-w-[160px] sm:max-w-[200px]"
          />

          {project && (
            <select
              value={activeScreen?.id || ''}
              onChange={(e) => {
                setActiveScreenId(e.target.value);
                const scr = project.screens.find((s) => s.id === e.target.value);
                setSelectedSectionId(scr?.sections[0]?.id || null);
              }}
              aria-label="Active page"
              className="hidden md:block rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs"
            >
              {project.screens.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.slug})
                </option>
              ))}
            </select>
          )}

          {saveStatus && (
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
              {saveStatus}
            </span>
          )}
        </div>

        {/* Center: View Modes, Viewport Switcher, Zoom */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg overflow-x-auto">
            {(
              [
                { id: 'design', label: 'Canvas', icon: Layers },
                { id: 'preview', label: 'Preview', icon: Eye },
                { id: 'code', label: 'Code', icon: Code2 },
                { id: 'image', label: 'Images', icon: ImageIcon },
                { id: 'animation', label: 'GIF', icon: Film },
              ] as const
            ).map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setCenterTab(m.id);
                    if (leftTab === 'settings') selectLeftTab('sections');
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                    centerTab === m.id && leftTab !== 'settings'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          <div className="hidden sm:flex items-center gap-0.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setPreviewDevice('desktop')}
              title="Desktop Viewport"
              className={`p-1.5 rounded cursor-pointer ${
                previewDevice === 'desktop' ? 'bg-blue-600 text-white' : 'text-slate-500'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice('tablet')}
              title="Tablet Viewport"
              className={`p-1.5 rounded cursor-pointer ${
                previewDevice === 'tablet' ? 'bg-blue-600 text-white' : 'text-slate-500'
              }`}
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice('mobile')}
              title="Mobile Viewport"
              className={`p-1.5 rounded cursor-pointer ${
                previewDevice === 'mobile' ? 'bg-blue-600 text-white' : 'text-slate-500'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="hidden xl:flex items-center gap-1 border border-slate-200 dark:border-slate-800 rounded-lg px-1.5 py-0.5 text-xs font-mono tabular-nums">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(50, z - 25))}
              className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="w-10 text-center">{zoom}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(125, z + 25))}
              className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Undo, Redo, Save, Share, Export, Publish, Inspector Toggle */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            title="Undo"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-35 cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            title="Redo"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-35 cursor-pointer"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => project && mutateProject((p) => p, 'Manual checkpoint')}
            disabled={!project}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Save</span>
          </button>

          <button
            type="button"
            onClick={() => setShareModalOpen(true)}
            disabled={!project}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Share</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              type="button"
              disabled={!project}
              onClick={() => setExportMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {exportMenuOpen && project && (
              <div className="absolute right-0 mt-1.5 w-48 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] shadow-lg p-1.5 z-50 text-xs space-y-0.5">
                <button
                  type="button"
                  onClick={() => void handleExportRaster('png')}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Export PNG Image
                </button>
                <button
                  type="button"
                  onClick={() => void handleExportRaster('jpeg')}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Export JPG Image
                </button>
                <button
                  type="button"
                  onClick={handleExportSvg}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Export Vector SVG
                </button>
                <button
                  type="button"
                  onClick={() => void handleExportGif()}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Export GIF89a Motion
                </button>
                <div className="border-t border-slate-200 dark:border-slate-800 my-1" />
                <button
                  type="button"
                  onClick={() => void handleExportZip()}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-600/10 cursor-pointer"
                >
                  Download Verified ZIP
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setPublishModalOpen(true)}
            disabled={!project}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            Publish
          </button>

          <button
            type="button"
            onClick={() => setMobileRightOpen(true)}
            aria-label="Open style inspector"
            className="lg:hidden p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <PanelRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* THREE-AREA WORKSPACE SHELL */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* A. FIXED LEFT SIDEBAR (Desktop) */}
        <aside className="hidden lg:block w-[320px] xl:w-[340px] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1017] h-full overflow-hidden">
          {leftSidebarBody}
        </aside>

        {/* Mobile Left Drawer */}
        {mobileLeftOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
              onClick={() => setMobileLeftOpen(false)}
            />
            <aside className="relative z-10 w-[320px] max-w-[92vw] h-full bg-white dark:bg-[#0D1017] border-r border-slate-200 dark:border-slate-800 flex flex-col">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold">Studio Toolbox</span>
                <button
                  type="button"
                  onClick={() => setMobileLeftOpen(false)}
                  className="p-1 text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0">{leftSidebarBody}</div>
            </aside>
          </div>
        )}

        {/* B. CENTER DESIGN CANVAS */}
        <main className="flex-1 min-w-0 h-full overflow-auto p-4 sm:p-6 flex flex-col">
          {leftTab === 'settings' ? (
            <div className="max-w-5xl w-full mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-display font-bold text-slate-900 dark:text-white">
                    Workspace & Account Settings
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Manage account credentials, AI model preferences, API configuration, and Cashfree billing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => selectLeftTab('sections')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] text-xs font-semibold cursor-pointer"
                >
                  Return to Canvas
                </button>
              </div>
              <SettingsFolderPanel initialSection={settingsSubSection} />
            </div>
          ) : !project ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <p className="text-sm text-slate-500 mb-4">
                Create a new project or launch an AI engine to start designing on the canvas.
              </p>
              <button
                type="button"
                onClick={() => void handleCreateNewProject()}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                Create First Project
              </button>
            </div>
          ) : centerTab === 'design' && activeScreen ? (
            <div className="flex-1 flex flex-col items-center">
              {/* Visual Canvas Device Frame */}
              <div
                style={{
                  width: canvasMaxWidth,
                  transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
                  transformOrigin: 'top center',
                }}
                className="w-full max-w-[1160px] rounded-xl border border-slate-300 dark:border-slate-800 shadow-xl overflow-hidden transition-all"
              >
                {/* Simulated Website Browser Chrome */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#0D1017] text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400/50" />
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400/50" />
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400/50" />
                  </div>
                  <span className="font-mono truncate max-w-[260px]">
                    {project.publishedSlug ? `${project.publishedSlug}.raildesign.ai` : 'preview.raildesign.studio'}
                    {activeScreen.slug}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCenterTab('preview')}
                    className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    <Eye className="w-3 h-3" /> Isolated View
                  </button>
                </div>

                {/* Live Styled Website Body */}
                <div
                  style={{
                    backgroundColor: ds.backgroundColor,
                    color: ds.textColor,
                    fontFamily: `'${ds.bodyFont}', system-ui, sans-serif`,
                    fontSize: `${ds.fontSize || 16}px`,
                  }}
                >
                  {/* Site Header Navigation */}
                  <div
                    style={{ backgroundColor: ds.backgroundColor }}
                    className="border-b border-white/10 px-6 py-4 flex flex-wrap items-center justify-between gap-4"
                  >
                    <span
                      style={{ fontFamily: `'${ds.headingFont}', system-ui, sans-serif` }}
                      className="text-base font-bold"
                    >
                      {project.name}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {project.screens.map((scr) => {
                        const active = scr.id === activeScreen.id;
                        return (
                          <button
                            key={scr.id}
                            type="button"
                            onClick={() => {
                              setActiveScreenId(scr.id);
                              setSelectedSectionId(scr.sections[0]?.id || null);
                            }}
                            style={{
                              backgroundColor: active ? ds.primaryColor : 'transparent',
                              color: active ? '#FFFFFF' : ds.textColor,
                              borderRadius: `${ds.borderRadius}px`,
                            }}
                            className="px-3 py-1 text-xs font-medium opacity-90 hover:opacity-100 cursor-pointer"
                          >
                            {scr.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Interactive Selectable & Droppable Sections */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragComponentType && dropTargetIdx === null) {
                        insertSectionAt(dragComponentType);
                      }
                      setDragComponentType(null);
                      setDragSectionIdx(null);
                      setDropTargetIdx(null);
                    }}
                  >
                    {activeScreen.sections.length === 0 ? (
                      <div className="py-24 px-6 text-center space-y-3 opacity-80">
                        <p className="text-sm font-medium">This page has no sections yet.</p>
                        <button
                          type="button"
                          onClick={() => insertSectionAt('hero')}
                          style={{
                            backgroundColor: ds.primaryColor,
                            borderRadius: `${ds.borderRadius}px`,
                          }}
                          className="px-4 py-2 text-xs font-semibold text-white cursor-pointer"
                        >
                          + Insert Hero Section
                        </button>
                      </div>
                    ) : (
                      activeScreen.sections.map((sec, idx) => {
                        const isSelected = selectedSectionId === sec.id;
                        const padY =
                          sec.paddingY ??
                          (ds.spacingScale === 'compact' ? 36 : ds.spacingScale === 'spacious' ? 76 : 56);
                        const padX = sec.paddingX ?? 24;
                        const marY = sec.marginY ?? 0;
                        const baseRadius = sec.borderRadius ?? ds.borderRadius;
                        const align = sec.textAlign || ds.textAlign || 'left';
                        const btnMode = sec.buttonStyle || ds.buttonStyle || 'solid';
                        const maxWidthCss =
                          sec.maxWidth === 'narrow'
                            ? '768px'
                            : sec.maxWidth === 'wide'
                            ? '1280px'
                            : sec.maxWidth === 'full'
                            ? '100%'
                            : '1080px';
                        const bgCss =
                          sec.backgroundStyle === 'gradient'
                            ? `linear-gradient(135deg, ${sec.backgroundColor || ds.surfaceColor}, ${ds.backgroundColor})`
                            : sec.backgroundStyle === 'surface'
                            ? ds.surfaceColor
                            : sec.backgroundColor || 'transparent';

                        const hiddenNow =
                          (previewDevice === 'desktop' && sec.hideOnDesktop) ||
                          (previewDevice === 'tablet' && sec.hideOnTablet) ||
                          (previewDevice === 'mobile' && sec.hideOnMobile);

                        const btnStyle: React.CSSProperties =
                          btnMode === 'outline'
                            ? {
                                backgroundColor: 'transparent',
                                color: ds.primaryColor,
                                border: `1.5px solid ${ds.primaryColor}`,
                                borderRadius: `${baseRadius}px`,
                              }
                            : btnMode === 'soft'
                            ? {
                                backgroundColor: `${ds.primaryColor}24`,
                                color: ds.primaryColor,
                                border: `1px solid ${ds.primaryColor}50`,
                                borderRadius: `${baseRadius}px`,
                              }
                            : btnMode === 'sharp'
                            ? {
                                backgroundColor: ds.primaryColor,
                                color: '#FFFFFF',
                                borderRadius: '2px',
                              }
                            : {
                                backgroundColor: ds.primaryColor,
                                color: '#FFFFFF',
                                borderRadius: `${baseRadius}px`,
                              };

                        return (
                          <div
                            key={sec.id}
                            draggable
                            onDragStart={() => {
                              setDragSectionIdx(idx);
                              setDragComponentType(null);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDropTargetIdx(idx);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (dragSectionIdx !== null) {
                                reorderSectionDrop(dragSectionIdx, idx);
                              } else if (dragComponentType) {
                                insertSectionAt(dragComponentType, idx);
                              }
                              setDragSectionIdx(null);
                              setDragComponentType(null);
                              setDropTargetIdx(null);
                            }}
                            onDragEnd={() => {
                              setDragSectionIdx(null);
                              setDropTargetIdx(null);
                            }}
                            onClick={() => {
                              setSelectedSectionId(sec.id);
                              setMobileRightOpen(true);
                            }}
                            style={{
                              paddingTop: `${padY}px`,
                              paddingBottom: `${padY}px`,
                              marginTop: `${marY}px`,
                              marginBottom: `${marY}px`,
                              background: bgCss,
                              color: sec.textColor || ds.textColor,
                              textAlign: align,
                              fontSize: sec.fontSize ? `${sec.fontSize}px` : undefined,
                              borderWidth: sec.borderWidth ? `${sec.borderWidth}px` : undefined,
                              borderStyle: sec.borderWidth ? 'solid' : undefined,
                              borderColor: sec.borderWidth
                                ? sec.borderColor || 'rgba(148,163,184,0.3)'
                                : undefined,
                              borderRadius: sec.borderWidth ? `${baseRadius}px` : undefined,
                            }}
                            className={`relative group border-b border-white/10 transition-all cursor-pointer ${
                              hiddenNow ? 'opacity-40' : ''
                            } ${
                              isSelected
                                ? 'ring-2 ring-inset ring-blue-500'
                                : 'hover:ring-1 hover:ring-inset hover:ring-blue-400/50'
                            } ${
                              dropTargetIdx === idx ? 'border-t-4 border-t-blue-500' : ''
                            }`}
                          >
                            {/* Floating Canvas Selection Toolbar */}
                            {isSelected && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute top-2 right-3 z-10 flex items-center gap-1 rounded-lg bg-slate-900/95 text-white px-2 py-1 text-[11px] shadow-md border border-slate-700"
                              >
                                <span className="font-mono uppercase text-blue-400 px-1">{sec.type}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPrompt(
                                      `Enhance and refine the "${sec.title}" section on page "${activeScreen.name}".`
                                    );
                                    selectLeftTab('ai_assistant');
                                  }}
                                  className="px-1.5 py-0.5 rounded hover:bg-slate-800 text-sky-300 cursor-pointer"
                                >
                                  AI Revise
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveSection(idx, -1)}
                                  disabled={idx === 0}
                                  className="p-1 hover:bg-slate-800 rounded disabled:opacity-30 cursor-pointer"
                                  title="Move Up"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveSection(idx, 1)}
                                  disabled={idx === activeScreen.sections.length - 1}
                                  className="p-1 hover:bg-slate-800 rounded disabled:opacity-30 cursor-pointer"
                                  title="Move Down"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => duplicateSection(sec)}
                                  className="p-1 hover:bg-slate-800 rounded cursor-pointer"
                                  title="Duplicate"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeSection(sec.id)}
                                  className="p-1 hover:bg-red-600/80 rounded cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            {/* Section Inner Content */}
                            <div
                              style={{ maxWidth: maxWidthCss, paddingLeft: `${padX}px`, paddingRight: `${padX}px` }}
                              className="mx-auto space-y-4"
                            >
                              {sec.subtitle && (
                                <p
                                  style={{ color: ds.secondaryColor }}
                                  className="text-xs font-semibold uppercase tracking-wider"
                                >
                                  {sec.subtitle}
                                </p>
                              )}

                              <h2
                                style={{ fontFamily: `'${sec.headingFont || ds.headingFont}', system-ui, sans-serif` }}
                                className="text-2xl sm:text-4xl font-bold leading-tight"
                              >
                                {sec.title}
                              </h2>

                              <p
                                style={{
                                  fontFamily: `'${sec.bodyFont || ds.bodyFont}', system-ui, sans-serif`,
                                  marginLeft: align === 'center' ? 'auto' : undefined,
                                  marginRight: align === 'center' ? 'auto' : undefined,
                                }}
                                className="max-w-2xl text-sm sm:text-base opacity-85 leading-relaxed"
                              >
                                {sec.body}
                              </p>

                              {sec.type !== 'form' && sec.ctaLabel && (
                                <div className="pt-1">
                                  <span
                                    style={btnStyle}
                                    className="inline-block px-5 py-2.5 text-sm font-semibold"
                                  >
                                    {sec.ctaLabel}
                                  </span>
                                </div>
                              )}

                              {sec.imageUrl && (
                                <div className="pt-3">
                                  <img
                                    src={sec.imageUrl}
                                    alt={sec.title}
                                    referrerPolicy="no-referrer"
                                    style={{ borderRadius: `${baseRadius}px` }}
                                    className="max-h-72 w-full object-cover border border-white/15"
                                  />
                                </div>
                              )}

                              {sec.items && sec.items.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 text-left">
                                  {sec.items.map((it, i) => (
                                    <div
                                      key={i}
                                      style={{
                                        backgroundColor: ds.surfaceColor,
                                        borderRadius: `${baseRadius}px`,
                                      }}
                                      className="p-4 border border-white/15 space-y-1.5"
                                    >
                                      {it.metric && (
                                        <div
                                          style={{ color: ds.secondaryColor }}
                                          className="text-xl font-bold font-mono tabular-nums"
                                        >
                                          {it.metric}
                                        </div>
                                      )}
                                      <h3
                                        style={{
                                          fontFamily: `'${sec.headingFont || ds.headingFont}', system-ui, sans-serif`,
                                        }}
                                        className="text-sm font-semibold"
                                      >
                                        {it.title}
                                      </h3>
                                      <p className="text-xs opacity-80 leading-relaxed">{it.description}</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {sec.type === 'form' && (
                                <div
                                  style={{
                                    marginLeft: align === 'center' ? 'auto' : undefined,
                                    marginRight: align === 'center' ? 'auto' : undefined,
                                  }}
                                  className="max-w-sm space-y-2.5 pt-2 text-left"
                                >
                                  <div
                                    style={{
                                      backgroundColor: ds.surfaceColor,
                                      borderRadius: `${baseRadius}px`,
                                    }}
                                    className="px-3 py-2 text-xs opacity-65 border border-white/15"
                                  >
                                    Full Name
                                  </div>
                                  <div
                                    style={{
                                      backgroundColor: ds.surfaceColor,
                                      borderRadius: `${baseRadius}px`,
                                    }}
                                    className="px-3 py-2 text-xs opacity-65 border border-white/15"
                                  >
                                    Work Email
                                  </div>
                                  <span style={btnStyle} className="inline-block px-5 py-2 text-xs font-semibold">
                                    {sec.ctaLabel || 'Submit'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Quick Drop / Add Block Bar at Bottom of Canvas */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDropTargetIdx(activeScreen.sections.length);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragComponentType) {
                          insertSectionAt(dragComponentType);
                        }
                        setDragComponentType(null);
                        setDropTargetIdx(null);
                      }}
                      className="p-5 flex flex-wrap items-center justify-center gap-2 border-t border-dashed border-white/15"
                    >
                      <span className="text-xs opacity-60 mr-1">Insert block:</span>
                      {(['hero', 'features', 'stats', 'pricing', 'form', 'footer'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => insertSectionAt(t)}
                          className="px-2.5 py-1 rounded border border-white/20 text-[11px] font-medium capitalize opacity-80 hover:opacity-100 cursor-pointer"
                        >
                          + {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Site Footer */}
                  <div className="px-6 py-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs opacity-65">
                    <span>{project.name}</span>
                    <span>Designed with RailDesign AI</span>
                  </div>
                </div>
              </div>
            </div>
          ) : centerTab === 'preview' ? (
            <div className={previewFullscreen ? 'fixed inset-0 z-50 bg-slate-950 p-4 flex flex-col' : 'flex-1 flex flex-col'}>
              <div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Sandboxed Interactive Preview ({previewDevice})
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewNonce((n) => n + 1)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] text-xs cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFullscreen((f) => !f)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] text-xs cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    {previewFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  </button>
                </div>
              </div>

              <div className="flex-1 flex justify-center bg-slate-200/70 dark:bg-slate-950 rounded-xl p-3 overflow-auto">
                <iframe
                  key={previewNonce}
                  title="Isolated Live Preview"
                  sandbox="allow-scripts"
                  srcDoc={isolatedSrcDoc}
                  style={{
                    width: canvasMaxWidth,
                    minHeight: '560px',
                  }}
                  className="bg-white rounded-lg border border-slate-300 dark:border-slate-800 transition-all"
                />
              </div>
            </div>
          ) : centerTab === 'code' ? (
            <div className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-4 grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-3 border-r border-slate-200 dark:border-slate-800 pr-3 space-y-1.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500">Project Files</span>
                  <button
                    type="button"
                    onClick={() => {
                      const path = `module-${project.files.length + 1}.js`;
                      mutateProject((p) => ({
                        ...p,
                        files: [...p.files, { path, language: 'javascript', content: '// Custom module\n' }],
                      }));
                      setActiveFilePath(path);
                    }}
                    className="text-xs text-blue-600 hover:underline cursor-pointer"
                  >
                    + File
                  </button>
                </div>
                {project.files.map((f) => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => setActiveFilePath(f.path)}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs font-mono truncate cursor-pointer ${
                      activeFile?.path === f.path
                        ? 'bg-blue-600/15 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
                    }`}
                  >
                    {f.path}
                  </button>
                ))}
              </div>

              <div className="md:col-span-9 flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                      <input
                        type="text"
                        value={codeSearch}
                        onChange={(e) => setCodeSearch(e.target.value)}
                        placeholder="Find..."
                        className="rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 pl-7 pr-2 py-1 text-xs w-28"
                      />
                    </div>
                    <input
                      type="text"
                      value={codeReplace}
                      onChange={(e) => setCodeReplace(e.target.value)}
                      placeholder="Replace..."
                      className="rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs w-28"
                    />
                    <button
                      type="button"
                      onClick={handleCodeSearchReplace}
                      className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 text-xs cursor-pointer"
                    >
                      Replace All
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleValidateCode}
                      className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 text-xs cursor-pointer"
                    >
                      Validate
                    </button>
                    <button
                      type="button"
                      onClick={() => activeFile && navigator.clipboard.writeText(activeFile.content)}
                      className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 text-xs cursor-pointer"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        activeFile &&
                        triggerDownload(
                          new Blob([activeFile.content], { type: 'text/plain' }),
                          activeFile.path.split('/').pop() || 'file.txt'
                        )
                      }
                      className="px-2.5 py-1 rounded bg-blue-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      Download
                    </button>
                  </div>
                </div>

                {codeDiagnostic && (
                  <p className="text-xs font-mono text-blue-600 dark:text-blue-400">{codeDiagnostic}</p>
                )}

                <textarea
                  value={activeFile?.content || ''}
                  onChange={(e) => updateCodeContent(e.target.value)}
                  spellCheck={false}
                  className="flex-1 min-h-[420px] w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 font-mono text-xs p-4 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          ) : centerTab === 'image' ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Generated Graphics & Visual Assets</h3>
                <button
                  type="button"
                  onClick={() => {
                    setEngineId('engine03_graphic_image');
                    setPrompt('Create a geometric technology product launch poster for ' + project.name);
                    selectLeftTab('ai_assistant');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Prepare Graphic Prompt
                </button>
              </div>
              {project.generatedImages.length === 0 ? (
                <p className="text-xs text-slate-500 py-10 text-center">
                  No generated images in this project yet. Open AI Assistant and select Engine 03 (Image & Graphic Design).
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {project.generatedImages.map((img) => (
                    <div key={img.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                      <img
                        src={img.dataUrl}
                        alt={img.title}
                        referrerPolicy="no-referrer"
                        className="w-full rounded-lg bg-slate-950"
                      />
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium truncate">{img.title}</span>
                        <a
                          href={img.dataUrl}
                          download={`${img.title.toLowerCase().replace(/\s+/g, '-')}.${
                            img.mimeType.includes('svg') ? 'svg' : 'png'
                          }`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Animation Timeline & GIF89a Studio</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const nextFrame: AnimationFrame = {
                        id: `frm_${Date.now()}`,
                        label: `Frame ${project.animationFrames.length + 1}`,
                        durationMs: 160,
                        backgroundColor: project.designSystem.backgroundColor,
                        accentColor: project.designSystem.primaryColor,
                        headline: project.name,
                        subline: `Step ${project.animationFrames.length + 1}`,
                        shape: 'train',
                        progress: Math.min(1, (project.animationFrames.length + 1) / 6),
                      };
                      mutateProject((p) => ({
                        ...p,
                        animationFrames: [...p.animationFrames, nextFrame],
                      }));
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium cursor-pointer"
                  >
                    + Add Frame
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExportGif()}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Compile & Download GIF89a
                  </button>
                </div>
              </div>

              {project.gifDataUrl && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col items-center bg-slate-950">
                  <img src={project.gifDataUrl} alt="Compiled GIF preview" className="max-w-md w-full rounded-lg" />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {project.animationFrames.map((frm, idx) => (
                  <div key={frm.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{frm.label}</span>
                      <span className="font-mono">{frm.durationMs}ms</span>
                    </div>
                    <input
                      type="number"
                      min={50}
                      max={2000}
                      step={20}
                      value={frm.durationMs}
                      onChange={(e) => {
                        const ms = Number(e.target.value);
                        mutateProject((p) => ({
                          ...p,
                          animationFrames: p.animationFrames.map((f, i) =>
                            i === idx ? { ...f, durationMs: ms } : f
                          ),
                        }));
                      }}
                      className="w-full rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1 font-mono"
                    />
                    <select
                      value={frm.shape}
                      onChange={(e) => {
                        const shape = e.target.value as AnimationFrame['shape'];
                        mutateProject((p) => ({
                          ...p,
                          animationFrames: p.animationFrames.map((f, i) =>
                            i === idx ? { ...f, shape } : f
                          ),
                        }));
                      }}
                      className="w-full rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1"
                    >
                      <option value="train">Express Train</option>
                      <option value="bars">Telemetry Bars</option>
                      <option value="orbit">Orbital Motion</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* C. FIXED RIGHT STYLE PANEL (Desktop) */}
        <aside className="hidden lg:block w-72 xl:w-80 shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1017] h-full overflow-hidden">
          {rightInspectorBody}
        </aside>

        {/* Mobile Right Drawer */}
        {mobileRightOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex justify-end">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
              onClick={() => setMobileRightOpen(false)}
            />
            <aside className="relative z-10 w-80 max-w-[92vw] h-full bg-white dark:bg-[#0D1017] border-l border-slate-200 dark:border-slate-800 flex flex-col">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" /> Style Inspector
                </span>
                <button
                  type="button"
                  onClick={() => setMobileRightOpen(false)}
                  className="p-1 text-slate-500 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0">{rightInspectorBody}</div>
            </aside>
          </div>
        )}
      </div>

      {/* SHARE MODAL */}
      {shareModalOpen && project && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-display font-bold">Share Project</h3>
              <button onClick={() => setShareModalOpen(false)} className="text-xs text-slate-500 cursor-pointer">
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleCreateShare('public')}
                className="py-2 px-3 rounded-lg bg-blue-600 text-white text-xs font-semibold cursor-pointer"
              >
                Create Public Link
              </button>
              <button
                type="button"
                onClick={() => void handleCreateShare('private')}
                className="py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
              >
                Create Private Link
              </button>
            </div>
            {shareUrlCreated && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs space-y-1.5">
                <div className="font-mono break-all text-emerald-700 dark:text-emerald-300">{shareUrlCreated}</div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(shareUrlCreated)}
                  className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> Copy Share URL
                </button>
              </div>
            )}
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {shares.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-xs border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1.5"
                >
                  <span className="font-mono truncate">
                    {s.visibility} · {s.revoked ? 'Revoked' : s.shareToken.slice(0, 12)}
                  </span>
                  {!s.revoked && (
                    <button
                      type="button"
                      onClick={() => void handleRevokeShare(s.id)}
                      className="text-red-500 hover:underline cursor-pointer"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PUBLISH MODAL */}
      {publishModalOpen && project && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-display font-bold">Publish & Deploy</h3>
              <button onClick={() => setPublishModalOpen(false)} className="text-xs text-slate-500 cursor-pointer">
                Close
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">Hosting Target</label>
                <select
                  value={publishTarget}
                  onChange={(e) => setPublishTarget(e.target.value as 'raildesign_static' | 'vercel')}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                >
                  <option value="raildesign_static">RailDesign Managed Hosting</option>
                  <option value="vercel">Vercel Deployments (requires VERCEL_TOKEN)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Custom Site Slug</label>
                <input
                  type="text"
                  value={publishSlug}
                  onChange={(e) => setPublishSlug(e.target.value)}
                  placeholder="my-site-slug"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                />
              </div>
              <button
                type="button"
                disabled={publishing}
                onClick={() => void handlePublish()}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
              >
                {publishing ? 'Deploying...' : project.publishedUrl ? 'Redeploy Live Site' : 'Deploy Now'}
              </button>
              {publishLogs.length > 0 && (
                <div className="rounded-lg bg-slate-950 text-slate-200 p-3 font-mono text-[11px] space-y-1">
                  {publishLogs.map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                </div>
              )}
              {project.publishedUrl && (
                <a
                  href={project.publishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                >
                  <span>Open Live Site ({project.publishedUrl})</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
