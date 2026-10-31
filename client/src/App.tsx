import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import './styles.css';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import {
  Activity, ArrowRight, ArrowUpRight, BookOpen, BookOpenCheck, Check, ChevronDown, ChevronRight, ChevronLeft, ChevronUp,
  CircleHelp, Clock3, Copy, Download, FileCheck2, FileText, FolderKanban, Gauge, History,
  LayoutDashboard, LogOut, Menu, Moon, PanelLeft, Plus, RefreshCw, ScanText, Settings2,
  ShieldAlert, ShieldCheck, Sliders, Sparkles, Sun, Trash2, Upload, WandSparkles, X,
  AlertTriangle, AlertCircle, ExternalLink, Printer, Eye, Edit3, GitCompare, Search,
  Users, Send, FileSpreadsheet, Layers, Share2, Table,
  Archive, RotateCcw, Calendar, CheckSquare, Square, Filter, Grid, List, Tag, Target,
  CheckCircle2, MoreVertical
} from 'lucide-react';
import { notify, useNotification } from './components/NotificationCenter';

import LiteratureReview from './modules/LiteratureReview';
import StatisticalAnalysis from './modules/StatisticalAnalysis';
import PdfResearchChat from './modules/PdfResearchChat';
import SystematicReviews from './modules/SystematicReviews';
import JournalSubmission from './modules/JournalSubmission';
import ResearchCollaboration from './modules/ResearchCollaboration';
import DocumentStudio from './modules/DocumentStudio';
import ReferenceManager from './modules/ReferenceManager';

function resolveApiUrl() {
  const envUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
  if (!envUrl) return '/api';
  if (envUrl.endsWith('/api')) return envUrl;
  return `${envUrl}/api`;
}
const API = resolveApiUrl();
const DEFAULT_GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();

// Google Identity Services (GSI) origin support detection
const isLocalhostOrigin = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '[::1]'
);
const isHttpsOrigin = typeof window !== 'undefined' && window.location.protocol === 'https:';
// Google Identity Services requires HTTPS or localhost loopback
const isOriginSupportedByGoogle = isLocalhostOrigin || isHttpsOrigin;
const isLanHttpOrigin = typeof window !== 'undefined' && !isLocalhostOrigin && !isHttpsOrigin;

type User = {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  authProviders?: string[];
  role?: string;
  status?: string;
  usage?: {
    dailyRequests: number;
    dailyLimit: number;
    lastResetDate?: string;
  };
};

type Revision = {
  _id: string;
  mode: string;
  summary: string;
  createdAt: string;
  originalText: string;
  revisedText: string;
  status?: string;
  meaningWarnings?: any[];
};

type Project = {
  _id: string;
  title: string;
  description?: string;
  discipline?: string;
  researchType?: string;
  objectives?: string[];
  keywords?: string[];
  documentType?: string;
  workflowStage?: string;
  completionPercentage?: number;
  progress?: number;
  tags?: string[];
  status?: string;
  startDate?: string;
  targetDate?: string;
  visibility?: string;
  archivedAt?: string;
  createdAt?: string;
  updatedAt: string;
};

type DocumentItem = {
  _id: string;
  title: string;
  content: string;
  version: number;
  wordCount: number;
  characterCount: number;
  projectId?: string;
  updatedAt: string;
  revisions?: Revision[];
};

type CitationItem = {
  _id: string;
  title: string;
  doi?: string;
  authors?: any[];
  year?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  projectId?: string;
};

type MeaningWarning = {
  category: string;
  severity: 'critical' | 'warning' | 'info';
  detail: string;
  excerpt?: string;
  originalValue?: string;
  revisedValue?: string;
};

const sampleText = `The present study aims to examine the relationship between the variables under consideration. The findings did not demonstrate a statistically significant difference between the two experimental groups (p > 0.05, n = 150). Further research may help clarify whether these patterns are consistent across different populations.`;

const REWRITE_MODES = [
  { id: 'academic-clarity', name: 'Academic clarity', desc: 'Eliminate ambiguity and improve flow' },
  { id: 'standard', name: 'Standard Paraphrase', desc: 'Balanced vocabulary and syntax rewrite' },
  { id: 'humanize', name: 'AI Humanizer (Bypass)', desc: 'Natural burstiness and AI detector bypass' },
  { id: 'summarize', name: 'Summarize / Abstract', desc: 'Dense summary of methods, results & impact' },
  { id: 'grammar-correction', name: 'Grammar correction', desc: 'Fix syntax and errors with minimal changes' },
  { id: 'fluency', name: 'Fluency & Readability', desc: 'Improve rhythmic cadence and smooth phrasing' },
  { id: 'formal-scientific', name: 'Formal scientific tone', desc: 'Elevate phrasing for peer-reviewed literature' },
  { id: 'shorten', name: 'Shorten / Condense', desc: 'Cut fluff and tighten sentences' },
  { id: 'expand', name: 'Expand & Elaborate', desc: 'Develop arguments with nuanced depth' },
  { id: 'creative', name: 'Creative rephrase', desc: 'Dynamic expressions and diverse phrasing' },
  { id: 'concise-academic', name: 'Concise academic', desc: 'Remove circumlocution and redundancy' },
  { id: 'readability-improvement', name: 'Readability improvement', desc: 'Optimize sentence lengths and cognitive flow' },
  { id: 'paragraph-restructure', name: 'Paragraph restructuring', desc: 'Reorganize topic sentences and transitions' },
  { id: 'thesis-dissertation', name: 'Thesis / dissertation', desc: 'In-depth academic framing and rigor' },
  { id: 'journal-manuscript', name: 'Journal manuscript', desc: 'Publication-ready top-tier prose' }
];

async function request(path: string, token: string, body?: unknown, method = 'POST') {
  const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('rp_token') || '' : '');
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {})
    },
    credentials: 'include',
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('rp_token');
      localStorage.removeItem('rp_active_project_id');
      window.dispatchEvent(new CustomEvent('rp_auth_invalidated', {
        detail: {
          message: data.error || 'Your session has expired. Please sign in again.',
          code: data.code || 'UNAUTHORIZED'
        }
      }));
    }
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

// Word-level diff calculation
function computeWordDiff(orig: string, rev: string) {
  const origWords = orig.trim() ? orig.trim().split(/\s+/) : [];
  const revWords = rev.trim() ? rev.trim().split(/\s+/) : [];
  const diff: { type: 'added' | 'removed' | 'unchanged'; text: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < origWords.length || j < revWords.length) {
    if (i < origWords.length && j < revWords.length && origWords[i] === revWords[j]) {
      diff.push({ type: 'unchanged', text: origWords[i] });
      i++;
      j++;
    } else if (j < revWords.length && (!origWords.includes(revWords[j]) || (origWords.indexOf(revWords[j]) > i + 3))) {
      diff.push({ type: 'added', text: revWords[j] });
      j++;
    } else if (i < origWords.length) {
      diff.push({ type: 'removed', text: origWords[i] });
      i++;
    } else {
      diff.push({ type: 'added', text: revWords[j] });
      j++;
    }
  }
  return diff;
}

export interface NavItemConfig {
  id: string;
  name: string;
  path: string;
  icon: any;
  badge?: (ctx: { revisions: Revision[]; citationsList: CitationItem[] }) => number | undefined;
  role?: string;
}

export interface NavGroupConfig {
  id: string;
  title: string;
  path?: string;
  icon: any;
  role?: string;
  items: NavItemConfig[];
}

export const NAV_GROUPS: NavGroupConfig[] = [
  {
    id: 'workspace',
    title: 'Workspace',
    path: '/dashboard',
    icon: LayoutDashboard,
    items: [
      { id: 'overview', name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
      { id: 'my-projects', name: 'My Research Projects', path: '/projects', icon: FolderKanban },
      {
        id: 'reference-manager',
        name: 'Reference Manager',
        path: '/reference-manager',
        icon: BookOpenCheck,
        badge: (ctx) => (ctx.citationsList.length > 0 ? ctx.citationsList.length : undefined)
      }
    ]
  },
  {
    id: 'research',
    title: 'Research Tools',
    path: '/literature',
    icon: BookOpen,
    items: [
      { id: 'literature-review', name: 'Literature Review', path: '/literature', icon: BookOpen },
      { id: 'systematic-reviews', name: 'Systematic Reviews', path: '/systematic-reviews', icon: Layers },
      { id: 'statistical-analysis', name: 'Statistical Analysis', path: '/statistical-analysis', icon: Activity },
      { id: 'pdf-research-chat', name: 'PDF Research Chat', path: '/pdf-chat', icon: FileText }
    ]
  },
  {
    id: 'publishing',
    title: 'Publishing & Studio',
    path: '/studio',
    icon: WandSparkles,
    items: [
      { id: 'writing-studio', name: 'Writing Studio', path: '/studio', icon: WandSparkles },
      { id: 'paraphrasing-tool', name: 'Paraphrasing Tool', path: '/paraphrase', icon: RefreshCw },
      { id: 'ai-text-humanizer', name: 'AI Text Humanizer', path: '/humanizer', icon: ShieldCheck },
      { id: 'summarization-tool', name: 'Summarization Tool', path: '/summarize', icon: FileText },
      { id: 'grammar-fluency', name: 'Grammar & Fluency', path: '/grammar-fluency', icon: Sparkles },
      { id: 'tone-rewriting', name: 'Tone & Rewriting', path: '/tone-rewriting', icon: Sliders },
      { id: 'document-studio', name: 'Document Studio', path: '/document-studio', icon: Download },
      { id: 'journal-submission', name: 'Journal Submission', path: '/journal-submission', icon: Send }
    ]
  },
  {
    id: 'collaboration',
    title: 'Integrity & Team',
    path: '/integrity',
    icon: ShieldCheck,
    items: [
      { id: 'research-integrity', name: 'Research Integrity', path: '/integrity', icon: ShieldCheck },
      { id: 'plagiarism-similarity', name: 'Plagiarism & Similarity', path: '/plagiarism-similarity', icon: FileCheck2 },
      { id: 'ai-authorship-indicators', name: 'AI-Authorship Indicators', path: '/ai-authorship', icon: ScanText },
      { id: 'research-collaboration', name: 'Research Collaboration', path: '/collaboration', icon: Users }
    ]
  },
  {
    id: 'governance',
    title: 'System & Governance',
    path: '/history',
    icon: History,
    items: [
      {
        id: 'revision-history',
        name: 'Revision History',
        path: '/history',
        icon: History,
        badge: (ctx) => (ctx.revisions.length > 0 ? ctx.revisions.length : undefined)
      },
      { id: 'usage-analytics', name: 'Usage Analytics', path: '/usage-analytics', icon: Activity },
      { id: 'privacy-data', name: 'Privacy & Data', path: '/privacy-data', icon: ShieldAlert },
      { id: 'settings', name: 'Settings', path: '/settings', icon: Settings2 },
      { id: 'admin-overview', name: 'Admin Overview', path: '/admin/overview', icon: Gauge, role: 'admin' },
      { id: 'user-management', name: 'User Management', path: '/admin/users', icon: FolderKanban, role: 'admin' },
      { id: 'platform-audit-logs', name: 'Platform Audit Logs', path: '/admin/logs', icon: History, role: 'admin' }
    ]
  }
];

export function getSectionFromPath(pathname: string): string {
  const clean = (pathname || '').toLowerCase().replace(/\/+$/, '') || '/';
  if (clean === '/' || clean === '/dashboard') return 'Overview';
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.path.toLowerCase() === clean) {
        return item.name;
      }
    }
  }
  if (clean === '/studio') return 'Writing Studio';
  if (clean === '/projects') return 'My Research Projects';
  if (clean === '/literature') return 'Literature Review';
  if (clean === '/citations' || clean === '/reference-manager') return 'Reference Manager';
  if (clean === '/statistical-analysis') return 'Statistical Analysis';
  if (clean === '/pdf-chat') return 'PDF Research Chat';
  if (clean === '/systematic-reviews') return 'Systematic Reviews';
  if (clean === '/journal-submission') return 'Journal Submission';
  if (clean === '/collaboration') return 'Research Collaboration';
  if (clean === '/integrity') return 'Research Integrity';
  if (clean === '/document-studio') return 'Document Studio';
  if (clean === '/humanizer') return 'AI Text Humanizer';
  if (clean === '/paraphrase') return 'Paraphrasing Tool';
  if (clean === '/originality' || clean === '/plagiarism-similarity') return 'Plagiarism & Similarity';
  if (clean === '/history') return 'Revision History';
  if (clean === '/settings') return 'Settings';
  return 'Overview';
}

export function getPathForSection(sectionName: string): string {
  if (sectionName === 'Overview' || sectionName === 'Dashboard') return '/dashboard';
  if (sectionName === 'My Research Projects' || sectionName === 'Projects') return '/projects';
  if (sectionName === 'Literature Review') return '/literature';
  if (sectionName === 'Statistical Analysis' || sectionName === 'Statistical Checker') return '/statistical-analysis';
  if (sectionName === 'PDF Research Chat') return '/pdf-chat';
  if (sectionName === 'Systematic Reviews') return '/systematic-reviews';
  if (sectionName === 'Journal Submission' || sectionName === 'Journal Readiness') return '/journal-submission';
  if (sectionName === 'Research Collaboration') return '/collaboration';
  if (sectionName === 'Research Integrity' || sectionName === 'Integrity Reports') return '/integrity';
  if (sectionName === 'Document Studio' || sectionName === 'DOCX / PDF Export' || sectionName === 'LaTeX Export Studio') return '/document-studio';
  if (sectionName === 'Originality Review') return '/plagiarism-similarity';
  if (sectionName === 'AI Assessment') return '/ai-authorship';
  if (sectionName === 'Citation Assistant') return '/reference-manager';
  if (sectionName === 'Citation Checker') return '/citation-formatter';
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.name === sectionName) {
        return item.path;
      }
    }
  }
  return '/dashboard';
}

export function getGroupIdForSection(sectionName: string): string {
  for (const group of NAV_GROUPS) {
    if (group.items.some(item => item.name === sectionName)) {
      return group.id;
    }
  }
  if (['Overview', 'My Research Projects', 'Reference Manager', 'Citation Assistant'].includes(sectionName)) {
    return 'workspace';
  }
  if (['Literature Review', 'Systematic Reviews', 'Statistical Analysis', 'Statistical Checker', 'PDF Research Chat'].includes(sectionName)) {
    return 'research';
  }
  if (['Writing Studio', 'Paraphrasing Tool', 'AI Text Humanizer', 'Summarization Tool', 'Grammar & Fluency', 'Tone & Rewriting', 'Document Studio', 'DOCX / PDF Export', 'LaTeX Export Studio', 'Journal Submission', 'Journal Readiness'].includes(sectionName)) {
    return 'publishing';
  }
  if (['Research Integrity', 'Plagiarism & Similarity', 'Originality Review', 'Source Verification', 'AI-Authorship Indicators', 'AI Assessment', 'Research Collaboration'].includes(sectionName)) {
    return 'collaboration';
  }
  return 'governance';
}

interface TurnstileWidgetProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (error: string) => void;
  dark?: boolean;
  resetTrigger?: number;
}

function TurnstileWidget({ siteKey, onVerify, onExpire, onError, dark, resetTrigger }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    function renderWidget() {
      if (!isMounted || !containerRef.current || !window.turnstile || !siteKey) return;
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: dark ? 'dark' : 'light',
          callback: (token: string) => {
            if (isMounted) onVerify(token);
          },
          'expired-callback': () => {
            if (isMounted) onExpire?.();
          },
          'error-callback': (err: string) => {
            if (isMounted) onError?.(err);
          }
        });
        widgetIdRef.current = id;
      } catch (err: any) {
        console.warn('Turnstile render warning:', err);
      }
    }

    const scriptId = 'cf-turnstile-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.turnstile) {
          renderWidget();
        }
      };
      document.head.appendChild(script);
    } else if (window.turnstile) {
      renderWidget();
    } else {
      script.addEventListener('load', () => {
        if (window.turnstile) renderWidget();
      });
    }

    return () => {
      isMounted = false;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, dark]);

  useEffect(() => {
    if (resetTrigger && widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {}
    }
  }, [resetTrigger]);

  return <div ref={containerRef} className="cf-turnstile-slot" />;
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('rp_token') || '');
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [section, setSection] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return getSectionFromPath(window.location.pathname);
    }
    return 'Dashboard';
  });

  // Sync URL with active section
  useEffect(() => {
    const targetPath = getPathForSection(section);
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath && window.location.pathname !== '/') {
      window.history.pushState({ section }, '', targetPath);
    }
  }, [section]);

  // Support browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        setSection(getSectionFromPath(window.location.pathname));
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  // Requirement: Light Theme is the default for all new users & first-time visitors.
  // Explicitly do not force device dark-mode preference for first-time visitors.
  const [dark, setDark] = useState<boolean>(() => {
    try {
      const savedTheme = localStorage.getItem('rp_theme');
      return savedTheme === 'dark';
    } catch {
      return false;
    }
  });

  // Synchronize theme changes to localStorage, document classes, and meta theme-color
  useEffect(() => {
    try {
      const themeVal = dark ? 'dark' : 'light';
      localStorage.setItem('rp_theme', themeVal);

      if (dark) {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
        document.body.classList.remove('dark');
      }

      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        meta.setAttribute('content', dark ? '#0c1220' : '#f5f7fb');
      }
    } catch (e) {
      console.warn('Theme synchronization error:', e);
    }
  }, [dark]);

  const [persist, setPersist] = useState(true);
  const [googleClientId, setGoogleClientId] = useState<string>(DEFAULT_GOOGLE_CLIENT_ID);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string>('');
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [requiresTurnstile, setRequiresTurnstile] = useState<boolean>(false);
  const [turnstileResetCount, setTurnstileResetCount] = useState<number>(0);

  // Dynamic Google OAuth & Turnstile configuration resolution (from backend /api/auth/config)
  useEffect(() => {
    fetch(`${API}/auth/config`)
      .then(r => (r.ok ? r.json() : null))
      .then(cfg => {
        if (cfg?.googleClientId && cfg.googleClientId.trim().length > 10) {
          setGoogleClientId(cfg.googleClientId.trim());
        }
        if (cfg?.turnstileSiteKey && cfg.turnstileSiteKey.trim().length > 0) {
          setTurnstileSiteKey(cfg.turnstileSiteKey.trim());
        }
      })
      .catch((err) => {
        console.warn('Backend auth config check failed or offline:', err);
      });
  }, []);

  const isGoogleConfigured = Boolean(
    googleClientId &&
    !googleClientId.includes('your-google-oauth-client-id') &&
    googleClientId.trim().length > 10
  );

  // Collapsible Navigation & Responsive Sidebar State
  const [isCompact, setIsCompact] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rp_sidebar_compact') === 'true';
    } catch {
      return false;
    }
  });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleUserMenuOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleUserMenuOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleUserMenuOutside);
    };
  }, [userMenuOpen]);

  const [expandedGroup, setExpandedGroup] = useState<string>(() => {
    return getGroupIdForSection('Writing Studio');
  });

  // Ensure active route's group is expanded automatically
  useEffect(() => {
    const activeGroupId = getGroupIdForSection(section);
    if (activeGroupId) {
      setExpandedGroup(activeGroupId);
    }
  }, [section]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroup(prev => (prev === groupId ? '' : groupId));
  };

  const toggleCompact = () => {
    setIsCompact(prev => {
      const next = !prev;
      try {
        localStorage.setItem('rp_sidebar_compact', String(next));
      } catch {}
      return next;
    });
  };

  // Command Palette State & Keyboard Navigation
  const [showCmdPalette, setShowCmdPalette] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [cmdSelectedIndex, setCmdSelectedIndex] = useState(0);

  // Global Keyboard Shortcuts (Ctrl+B sidebar toggle, Ctrl+K command palette, Esc close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCompact();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCmdPalette(prev => !prev);
        setCmdQuery('');
        setCmdSelectedIndex(0);
      }
      if (e.key === 'Escape') {
        setShowCmdPalette(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Core Data
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [citationsList, setCitationsList] = useState<CitationItem[]>([]);
  const [usage, setUsage] = useState<any>(null);

  useEffect(() => {
    if (projects.length > 0) {
      const savedId = typeof window !== 'undefined' ? localStorage.getItem('rp_active_project_id') : null;
      const found = projects.find(p => p._id === savedId) || projects[0];
      setActiveProject(found);
    }
  }, [projects]);

  // Active Document State
  const [activeDoc, setActiveDoc] = useState<DocumentItem | null>(null);
  const [docTitle, setDocTitle] = useState('Untitled Academic Document');
  const [text, setText] = useState(sampleText);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // AI Rewriting & Inspector State
  const [rewriteMode, setRewriteMode] = useState('academic-clarity');
  const [preserveTerms, setPreserveTerms] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessageState] = useState('');
  const [error, setErrorState] = useState('');

  const setError = useCallback((val: string) => {
    setErrorState(val);
    if (val) {
      notify.error(val);
    }
  }, []);

  const setMessage = useCallback((val: string) => {
    setMessageState(val);
    if (val) {
      notify.success(val);
    }
  }, []);

  // Listen for global session invalidation to safely return user to sign in
  useEffect(() => {
    const handleAuthInvalidated = (e: any) => {
      const detail = e.detail || {};
      setUser(null);
      setToken('');
      setAuthState('unauthenticated');
      setErrorState('');
      const msg = detail.message || 'Your session has expired. Please sign in again.';
      notify.error(msg, {
        title: 'Authentication Required',
        persistent: true,
        action: {
          label: 'Sign In Again',
          onClick: () => {
            setAuthMode('login');
          }
        }
      });
    };
    window.addEventListener('rp_auth_invalidated' as any, handleAuthInvalidated);
    return () => window.removeEventListener('rp_auth_invalidated' as any, handleAuthInvalidated);
  }, []);
  const [inspectorTab, setInspectorTab] = useState<'warnings' | 'diff' | 'similarity' | 'ai-authorship' | 'citations' | 'history'>('warnings');
  const [proposedText, setProposedText] = useState('');
  const [currentWarnings, setCurrentWarnings] = useState<MeaningWarning[]>([]);
  const [proposedRevision, setProposedRevision] = useState<any>(null);
  const [meaningModalData, setMeaningModalData] = useState<any>(null);

  // Citation Assistant Local State
  const [lookupDoiInput, setLookupDoiInput] = useState('');
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [citationFormatStyle, setCitationFormatStyle] = useState<'apa' | 'mla' | 'ieee'>('apa');
  const [citationAuditResult, setCitationAuditResult] = useState<any>(null);

  // Analysis Page Results
  const [assessment, setAssessment] = useState<any>(null);
  const [originality, setOriginality] = useState<any>(null);
  const [plagiarismAnalysis, setPlagiarismAnalysis] = useState<any>(null);
  const [aiAuthorship, setAiAuthorship] = useState<any>(null);
  const [citationsAnalysis, setCitationsAnalysis] = useState<any>(null);

  // Project Creation Modal
  const [projectTitle, setProjectTitle] = useState('');
  const [showProjectForm, setShowProjectForm] = useState(false);

  // Debounced Autosave ref
  const autosaveTimeout = useRef<any>(null);

  // Unified, authoritative Authentication State Machine (Loading, Authenticated, Unauthenticated)
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const authStatus = urlParams.get('auth_status');
        const authErr = urlParams.get('auth_error');
        const ticket = urlParams.get('ticket');
        const emailParam = urlParams.get('email');

        // 1. Handle OAuth Error Redirect
        if (authErr) {
          if (authErr === 'account_linking_required') {
            setAuthMode('login');
            if (emailParam) setEmail(emailParam);
            setAuthError('An account with this email already exists using password authentication. Please sign in with your password to link your Google account.');
          } else if (authErr.includes('not found') || authErr.includes('deleted')) {
            setAuthError('Your previous session has expired. Please sign in or create an account.');
          } else {
            setAuthError(decodeURIComponent(authErr));
          }
          window.history.replaceState({}, document.title, window.location.pathname);
          if (isMounted) setAuthState('unauthenticated');
          return;
        }

        // 2. Handle Google OAuth Return via short-lived Session Claim Ticket
        if (ticket) {
          window.history.replaceState({}, document.title, window.location.pathname);
          try {
            const claimRes = await fetch(`${API}/auth/session/claim`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ ticket })
            });
            if (claimRes.ok) {
              const data = await claimRes.json();
              if (data?.user && isMounted) {
                setUser(data.user);
                if (data.token) {
                  setToken(data.token);
                  localStorage.setItem('rp_token', data.token);
                }
                setAuthState('authenticated');
                setSection('Dashboard');
                return;
              }
            }
          } catch (e) {
            console.warn('Session claim notice, falling back to /auth/me:', e);
          }
        }

        // 3. Clean up URL if auth_status is present without ticket
        if (authStatus) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        // 4. Validate session via GET /api/auth/me (using cookies and any existing Bearer token)
        const storedToken = localStorage.getItem('rp_token') || '';
        const meRes = await fetch(`${API}/auth/me`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {})
          },
          credentials: 'include'
        });

        if (meRes.ok) {
          const data = await meRes.json();
          if (data?.user && isMounted) {
            setUser(data.user);
            if (data.token) {
              setToken(data.token);
              localStorage.setItem('rp_token', data.token);
            }
            setAuthState('authenticated');
            return;
          }
        }

        // 5. Unauthenticated session or expired token
        if (isMounted) {
          const errData = await meRes.json().catch(() => ({}));
          if (authStatus === 'google_success') {
            setAuthError('Google authentication succeeded, but an active application session could not be established. Please ensure cookies are allowed and try signing in again.');
          } else if (storedToken && (meRes.status === 401 || errData.code === 'ACCOUNT_NOT_FOUND' || errData.error?.includes('not found') || errData.error?.includes('deleted'))) {
            setAuthError('Your previous session has expired or the account was not found. Please sign in or create an account.');
            notify.info('Your previous session has expired. Please sign in or register.', {
              title: 'Session Expired'
            });
          } else if (meRes.status === 503) {
            setAuthError('The database service is currently initializing. Please refresh in a moment.');
            notify.warning('The service is temporarily initializing. Please refresh in a moment.', {
              title: 'Service Initializing'
            });
          }
          setUser(null);
          setToken('');
          localStorage.removeItem('rp_token');
          localStorage.removeItem('rp_active_project_id');
          setAuthState('unauthenticated');
        }
      } catch (err) {
        if (isMounted) {
          setUser(null);
          setToken('');
          localStorage.removeItem('rp_token');
          localStorage.removeItem('rp_active_project_id');
          setAuthState('unauthenticated');
        }
      }
    }

    initAuth();
    return () => { isMounted = false; };
  }, []);

  async function refreshData() {
    if (!token && !user) return;
    try {
      const [p, r, u, d, c] = await Promise.all([
        request('/projects', token, undefined, 'GET').catch(() => []),
        request('/revisions', token, undefined, 'GET').catch(() => []),
        request('/usage/me', token, undefined, 'GET').catch(() => null),
        request('/documents', token, undefined, 'GET').catch(() => []),
        request('/citations', token, undefined, 'GET').catch(() => [])
      ]);
      setProjects(p);
      setRevisions(r);
      if (u) setUsage(u);
      setDocuments(d);
      setCitationsList(c);

      // Default select first document if none active
      if (!activeDoc && d.length > 0) {
        selectDocument(d[0]);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    if (user) refreshData();
  }, [user]);

  async function handleCreateProject(projectData: any) {
    setBusy(true);
    try {
      const created = await request('/projects', token, projectData, 'POST');
      setShowProjectForm(false);
      await refreshData();
      if (created && created._id) {
        setActiveProject(created);
        if (typeof window !== 'undefined') {
          localStorage.setItem('rp_active_project_id', created._id);
        }
      }
      setMessage(`Project "${projectData.title}" created successfully.`);
    } catch (e: any) {
      setError(e.message || 'Failed to create project');
    } finally {
      setBusy(false);
    }
  }

  function selectDocument(doc: DocumentItem) {
    setActiveDoc(doc);
    setDocTitle(doc.title);
    setText(doc.content || '');
    setProposedText('');
    setCurrentWarnings([]);
    setProposedRevision(null);
    setSaveStatus('saved');
  }

  // Trigger autosave when text or title changes
  function handleTextChange(newText: string) {
    setText(newText);
    setSaveStatus('unsaved');
    if (activeDoc) {
      if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
      autosaveTimeout.current = setTimeout(async () => {
        try {
          setSaveStatus('saving');
          const updated = await request(`/documents/${activeDoc._id}`, token, {
            title: docTitle,
            content: newText,
            version: activeDoc.version
          }, 'PATCH');
          setActiveDoc(updated);
          setSaveStatus('saved');
        } catch (err: any) {
          setSaveStatus('unsaved');
          if (err.message.includes('modified by another session')) {
            setError('Notice: Document was modified in another tab. Reload recommended.');
          }
        }
      }, 1500);
    }
  }

  async function handleCreateNewDocument() {
    try {
      const title = `Manuscript Draft ${documents.length + 1}`;
      const newDoc = await request('/documents', token, {
        title,
        content: sampleText
      });
      setDocuments([newDoc, ...documents]);
      selectDocument(newDoc);
      setMessage(`Created "${newDoc.title}".`);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteDocument(id: string) {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await request(`/documents/${id}`, token, undefined, 'DELETE');
      const filtered = documents.filter(d => d._id !== id);
      setDocuments(filtered);
      if (activeDoc?._id === id) {
        if (filtered.length > 0) selectDocument(filtered[0]);
        else {
          setActiveDoc(null);
          setText('');
        }
      }
      setMessage('Document deleted.');
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Meaning-Preserving AI Rewrite Action
  async function handleAiRewrite() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (!text.trim()) throw new Error('Document has no text to rewrite.');
      const res = await request('/revisions/rewrite', token, {
        text,
        mode: rewriteMode,
        documentId: activeDoc?._id,
        preserveTerms,
        saveRevision: persist
      });

      setProposedText(res.revisedText);
      setCurrentWarnings(res.meaningWarnings || []);
      setProposedRevision(res.revision);
      setInspectorTab(res.meaningWarnings && res.meaningWarnings.length > 0 ? 'warnings' : 'diff');
      setMessage(`Generated revision in "${REWRITE_MODES.find(m => m.id === rewriteMode)?.name}" mode.`);
      await refreshData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Accept Proposed Revision with Deterministic Meaning-Preservation Guardrail
  async function handleAcceptRevision(force?: boolean | React.MouseEvent) {
    if (!proposedRevision) return;

    if (force !== true && text && proposedText) {
      try {
        const valRes = await request('/meaning/validate', token, {
          originalText: text,
          revisedText: proposedText
        });
        if (valRes && !valRes.canAcceptWithoutWarning && (valRes.changed?.length > 0 || valRes.warnings?.length > 0)) {
          setMeaningModalData(valRes);
          return;
        }
      } catch (_) {
        // Continue if validation endpoint had minor network error
      }
    }

    setMeaningModalData(null);
    try {
      setBusy(true);
      const res = await request(`/revisions/${proposedRevision._id || proposedRevision.id}/accept`, token);
      setText(proposedText);
      if (res.document) setActiveDoc(res.document);
      setProposedText('');
      setProposedRevision(null);
      setCurrentWarnings([]);
      setInspectorTab('history');
      setMessage('Revision accepted and saved to active manuscript.');
      await refreshData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Reject Proposed Revision
  async function handleRejectRevision() {
    if (!proposedRevision) return;
    try {
      await request(`/revisions/${proposedRevision._id || proposedRevision.id}/reject`, token);
      setProposedText('');
      setProposedRevision(null);
      setCurrentWarnings([]);
      setMessage('Revision proposal rejected.');
      await refreshData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Restore Revision Version
  async function handleRestoreRevision(revId: string) {
    if (!activeDoc) return;
    try {
      setBusy(true);
      const res = await request(`/documents/${activeDoc._id}/restore`, token, { revisionId: revId });
      setActiveDoc(res.document);
      setText(res.document.content);
      setMessage('Restored earlier revision to active document.');
      await refreshData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // DOI Lookup
  async function handleLookupDoi() {
    if (!lookupDoiInput.trim()) return;
    setBusy(true);
    setLookupResult(null);
    try {
      const res = await request('/citations/lookup', token, { doi: lookupDoiInput.trim() });
      setLookupResult(res);
      setMessage('Crossref metadata retrieved successfully.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Add Citation to Library
  async function handleAddCitationToLibrary() {
    if (!lookupResult?.metadata) return;
    try {
      const added = await request('/citations', token, {
        ...lookupResult.metadata,
        documentId: activeDoc?._id,
        projectId: activeDoc?.projectId
      });
      setCitationsList([added, ...citationsList]);
      setLookupResult(null);
      setLookupDoiInput('');
      setMessage(`Added "${added.title}" to citation library.`);
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Validate In-Text Citations
  async function handleValidateCitations() {
    try {
      setBusy(true);
      const res = await request('/citations/validate', token, {
        text,
        projectId: activeDoc?.projectId
      });
      setCitationAuditResult(res);
      setMessage(`Citation audit complete: ${res.missingCitations.length} missing, ${res.uncitedReferences.length} uncited.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Document & Manuscript Import (.docx, .txt, .md)
  async function handleImportDocx(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (/\.(txt|md)$/i.test(file.name)) {
      try {
        const fileContent = await file.text();
        setText(fileContent);
        setDocTitle(file.name.replace(/\.[^/.]+$/, ''));
        setMessage(`Imported "${file.name}" (${fileContent.trim().split(/\s+/).filter(Boolean).length} words).`);
      } catch (err: any) {
        setError('Failed to read text file.');
      } finally {
        e.target.value = '';
      }
      return;
    }

    if (!/\.docx$/i.test(file.name)) {
      setError('Please upload a valid Microsoft Word (.docx), .txt, or .md file.');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    if (activeDoc?.projectId) formData.append('projectId', activeDoc.projectId);

    setBusy(true);
    try {
      const res = await fetch(`${API}/documents/import-docx`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed.');
      if (data.document) {
        setDocuments([data.document, ...documents]);
        selectDocument(data.document);
      } else {
        setText(data.content);
        setDocTitle(data.title);
      }
      setMessage(`Imported "${file.name}" (${data.wordCount} words).`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  // DOCX Export Download
  async function handleExportDocx() {
    if (!activeDoc) return;
    try {
      const res = await fetch(`${API}/documents/${activeDoc._id}/export-docx`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Export failed.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(activeDoc.title || 'Manuscript').replace(/\s+/g, '_')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('DOCX export downloaded.');
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Auth Handlers
  async function authenticate(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');

    // Pre-flight validation for Turnstile verification
    if (authMode === 'register' && turnstileSiteKey && !turnstileToken) {
      setAuthError('Please complete the security verification challenge before continuing.');
      return;
    }
    if (authMode === 'login' && requiresTurnstile && turnstileSiteKey && !turnstileToken) {
      setAuthError('Security verification required. Please complete the verification challenge.');
      return;
    }

    try {
      const payload: Record<string, string> = { email, password };
      if (turnstileToken) {
        payload.turnstileToken = turnstileToken;
      }

      const d = await fetch(`${API}/auth/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const result = await d.json();
      if (!d.ok) {
        if (result.requiresTurnstile) {
          setRequiresTurnstile(true);
        }
        if (result.siteKey) {
          setTurnstileSiteKey(result.siteKey);
        }
        setTurnstileToken('');
        setTurnstileResetCount(c => c + 1);
        throw new Error(result.error || 'Authentication failed.');
      }
      localStorage.setItem('rp_token', result.token);
      setToken(result.token);
      setUser(result.user);
      setAuthState('authenticated');
      setSection('Dashboard');
    } catch (e: any) {
      setAuthError(e.message);
    }
  }

  async function handleGoogleSuccess(credentialResponse: any) {
    setAuthError('');
    try {
      if (!credentialResponse?.credential) throw new Error('No credential token received from Google.');
      const d = await fetch(`${API}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credential: credentialResponse.credential })
      });
      const result = await d.json();
      if (!d.ok) {
        if (result.code === 'ACCOUNT_LINKING_REQUIRED') {
          setAuthMode('login');
          if (result.email) setEmail(result.email);
          throw new Error('An account with this email already exists using password authentication. Please sign in with your password to link your Google account.');
        }
        throw new Error(result.error || 'Google login failed.');
      }
      localStorage.setItem('rp_token', result.token);
      setToken(result.token);
      setUser(result.user);
      setAuthState('authenticated');
      setSection('Dashboard');
    } catch (err: any) {
      setAuthError(err.message);
    }
  }

  async function handleLinkGoogle(credentialResponse: any) {
    setError('');
    setMessage('');
    try {
      if (!credentialResponse?.credential) throw new Error('No credential token received from Google.');
      const res = await request('/auth/link-google', token, { credential: credentialResponse.credential });
      setUser(res.user);
      setMessage('Google account linked successfully!');
      await refreshData();
    } catch (err: any) {
      setError(err.message || 'Failed to link Google account.');
    }
  }

  async function logout() {
    try {
      await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch (_) {}
    localStorage.removeItem('rp_token');
    setToken('');
    setUser(null);
    setAuthState('unauthenticated');
  }

  async function runAction(action: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (!text.trim()) throw new Error('Add text to the editor first.');
      if (action === 'writing') {
        const res = await request('/analyze/writing', token, { text });
        setAssessment(res);
        setSection('Writing Assessment');
      } else if (action === 'originality' || action === 'plagiarism' || action === 'similarity') {
        const res = await request('/analyze/plagiarism', token, { text });
        setPlagiarismAnalysis(res);
        setOriginality(res);
        setSection('Plagiarism & Similarity');
      } else if (action === 'ai-detection' || action === 'ai-authorship') {
        const res = await request('/analyze/ai-detection', token, { text });
        setAiAuthorship(res);
        setSection('AI-Authorship Indicators');
      } else if (action === 'citations') {
        const res = await request('/analyze/citations', token, { text });
        setCitationsAnalysis(res);
        setSection('Citation Formatter');
      } else if (action === 'statistical') {
        const res = await request('/analyze/writing', token, { text });
        setAssessment(res);
        setSection('Statistical Checker');
      } else if (action === 'journal-readiness') {
        const res = await request('/analyze/writing', token, { text });
        setAssessment(res);
        setSection('Journal Readiness');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const wordCount = useMemo(() => text.trim() ? text.trim().split(/\s+/).length : 0, [text]);
  const diffChunks = useMemo(() => {
    if (!proposedText) return [];
    return computeWordDiff(text, proposedText);
  }, [text, proposedText]);

  // Loading Screen (prevents flash of login screen during session validation or OAuth return)
  if (authState === 'loading') {
    return (
      <div className={`auth-page ${dark ? 'dark' : ''}`}>
        <div className="auth-card" style={{ textAlign: 'center', padding: '40px 30px' }}>
          <div className="brand-mark" style={{ margin: '0 auto 18px' }}><ShieldCheck size={26} /></div>
          <h1 style={{ fontSize: '22px', marginBottom: '8px' }}>ResearchProof <span>AI</span></h1>
          <p className="muted" style={{ fontSize: '11.5px', marginBottom: '24px' }}>Verifying your secure session...</p>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '20px auto' }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: '3px solid var(--border, #e4e9f1)',
              borderTopColor: '#7867e9',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
          </div>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // Auth Screen
  if (!user || authState === 'unauthenticated') {
    const authContent = (
      <div className="auth-card" style={{ width: '100%', maxWidth: '440px', margin: '0 auto' }}>
        <div className="brand-mark auth-brand-badge"><ShieldCheck size={26} /></div>
        <p className="eyebrow auth-eyebrow">ACADEMIC WORKSPACE</p>
        <h1 className="auth-title">ResearchProof <span>AI</span></h1>
        <p className="muted auth-subtitle">Rigorous scientific writing assistance and research integrity platform.</p>

        {/* Google Authentication Section */}
        {isGoogleConfigured ? (
          <>
            <div className="google-btn-wrap" style={{ width: '100%' }}>
              <button
                type="button"
                className="google-oauth-redirect-btn auth-google-btn"
                style={{ width: '100%' }}
                onClick={() => {
                  const returnTo = encodeURIComponent(window.location.origin);
                  window.location.href = `${API}/auth/google/start?return_to=${returnTo}`;
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>
            <div className="auth-divider"><span>or continue with email</span></div>
          </>
        ) : null}

        <form onSubmit={authenticate} className="auth-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
          <label className="auth-field-label" style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left', width: '100%' }}>
            <span>Email address</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@university.edu"
              className="auth-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </label>
          <label className="auth-field-label" style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left', width: '100%' }}>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={10}
              placeholder="At least 10 characters"
              className="auth-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </label>

          {/* Turnstile verification widget rendered if active for registration or flagged for login */}
          {((authMode === 'register' && Boolean(turnstileSiteKey)) || (authMode === 'login' && requiresTurnstile && Boolean(turnstileSiteKey))) && (
            <div className="turnstile-container" style={{ margin: '14px 0 8px', minHeight: '65px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <TurnstileWidget
                siteKey={turnstileSiteKey}
                onVerify={(tok) => {
                  setTurnstileToken(tok);
                  setAuthError('');
                }}
                onExpire={() => {
                  setTurnstileToken('');
                  setAuthError('Security challenge expired. Please complete it again.');
                }}
                onError={(err) => {
                  setTurnstileToken('');
                  console.warn('Turnstile widget notice:', err);
                }}
                dark={dark}
                resetTrigger={turnstileResetCount}
              />
            </div>
          )}

          {authError && (
            <div className="alert error" role="alert">
              <div className="alert-content">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{authError}</span>
              </div>
              <button
                type="button"
                className="alert-dismiss-btn"
                onClick={() => setAuthError('')}
                aria-label="Dismiss alert"
                title="Dismiss alert"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )}
          <button className="primary full auth-submit-btn" type="submit" style={{ width: '100%', boxSizing: 'border-box' }}>
            <span>{authMode === 'register' ? 'Create secure account' : 'Sign in'}</span>
            <ArrowRight size={15} />
          </button>
        </form>
        <p className="switch-auth auth-switch">
          {authMode === 'register' ? 'Already registered?' : 'New to ResearchProof?'}{' '}
          <button className="text-button auth-text-btn" type="button" onClick={() => {
            const nextMode = authMode === 'register' ? 'login' : 'register';
            setAuthMode(nextMode);
            setAuthError('');
            setTurnstileToken('');
            setTurnstileResetCount(c => c + 1);
          }}>{authMode === 'register' ? 'Sign in' : 'Create account'}</button>
        </p>
        <div className="privacy-note auth-privacy-note">
          <ShieldCheck size={16} />
          <span>Your research manuscripts are never persisted without your consent.</span>
        </div>
      </div>
    );

    const canInitializeGoogle = Boolean(isGoogleConfigured && isOriginSupportedByGoogle && googleClientId);
    return (
      <div className={`auth-page ${dark ? 'dark' : ''}`} style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <button
          type="button"
          className="auth-theme-toggle"
          style={{ position: 'absolute', top: '24px', right: '24px' }}
          onClick={() => setDark(!dark)}
          title={`Switch to ${dark ? 'Light' : 'Dark'} theme`}
          aria-label="Toggle theme"
        >
          {dark ? <Sun size={15} /> : <Moon size={15} />}
          <span>{dark ? 'Light theme' : 'Dark theme'}</span>
        </button>
        {canInitializeGoogle ? (
          <GoogleOAuthProvider clientId={googleClientId}>
            {authContent}
          </GoogleOAuthProvider>
        ) : (
          authContent
        )}
      </div>
    );
  }

  const appShellContent = (
    <div className={`app-shell ${dark ? 'dark' : ''}`}>
      {/* Mobile Backdrop Overlay */}
      <div
        className={`sidebar-backdrop ${mobileDrawerOpen ? 'active' : ''}`}
        onClick={() => setMobileDrawerOpen(false)}
        aria-hidden="true"
      />

      <aside className={`sidebar ${isCompact ? 'compact' : ''} ${mobileDrawerOpen ? 'mobile-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark" title="ResearchProof AI">
            <ShieldCheck size={20} />
          </div>
          {!isCompact && (
            <div className="brand-text">
              <strong>ResearchProof <span>AI</span></strong>
              <small>PHASE 3 PLATFORM MANAGEMENT</small>
            </div>
          )}
          <button
            type="button"
            className="icon-button desktop-compact-btn"
            onClick={toggleCompact}
            title={isCompact ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
            aria-label="Toggle compact sidebar"
          >
            <PanelLeft size={17} />
          </button>
          <button
            type="button"
            className="icon-button mobile-close-btn"
            onClick={() => setMobileDrawerOpen(false)}
            title="Close navigation"
            aria-label="Close navigation drawer"
          >
            <X size={18} />
          </button>
        </div>

        <div
          className="workspace-pill"
          onClick={() => setSection('Settings')}
          style={{ cursor: 'pointer' }}
          title={isCompact ? `${user.displayName || user.email} (Open Settings)` : 'Open Settings & Preferences'}
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.displayName || user.email} className="avatar-img" />
          ) : (
            <div className="avatar">{(user.displayName || user.email)[0]?.toUpperCase()}</div>
          )}
          {!isCompact && (
            <div>
              <strong>{user.displayName || 'Research workspace'}</strong>
              <small>{user.email}</small>
            </div>
          )}
          {!isCompact && <ChevronDown size={15} />}
        </div>

        <nav className="nav-accordion" aria-label="Main Navigation">
          {NAV_GROUPS
            .filter(group => !group.role || (group.role === 'admin' && user.role === 'admin'))
            .map(group => {
              const isExpanded = expandedGroup === group.id;
              const hasActiveChild = group.items.some(it =>
                section === it.name ||
                (it.name === 'Plagiarism & Similarity' && (section === 'Originality Review' || section === 'Source Verification')) ||
                (it.name === 'AI-Authorship Indicators' && section === 'AI Assessment') ||
                (it.name === 'Reference Manager' && section === 'Citation Assistant') ||
                (it.name === 'Citation Formatter' && section === 'Citation Checker')
              );

              return (
                <div className="nav-group-wrapper" key={group.id}>
                  <button
                    type="button"
                    className={`nav-group-header ${isExpanded ? 'expanded' : ''} ${hasActiveChild ? 'has-active-child' : ''}`}
                    onClick={() => toggleGroup(group.id)}
                    aria-expanded={isExpanded}
                    aria-controls={`nav-group-content-${group.id}`}
                    id={`nav-group-heading-${group.id}`}
                    title={group.title}
                  >
                    <div className="nav-group-title-wrap">
                      <group.icon size={16} className="nav-group-icon" />
                      {!isCompact && <span className="nav-group-title">{group.title}</span>}
                    </div>
                    {!isCompact && (
                      <span className="nav-group-chevron">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    )}
                  </button>

                  <div
                    id={`nav-group-content-${group.id}`}
                    role="region"
                    aria-labelledby={`nav-group-heading-${group.id}`}
                    className={`nav-group-content ${isExpanded ? 'expanded' : 'collapsed'}`}
                  >
                    <div className="nav-group-content-inner">
                      {group.items
                        .filter(item => !item.role || (item.role === 'admin' && user.role === 'admin'))
                        .map(item => {
                          const isActive = section === item.name ||
                            (item.name === 'Plagiarism & Similarity' && (section === 'Originality Review' || section === 'Source Verification')) ||
                            (item.name === 'AI-Authorship Indicators' && section === 'AI Assessment') ||
                            (item.name === 'Reference Manager' && section === 'Citation Assistant') ||
                            (item.name === 'Citation Formatter' && section === 'Citation Checker');
                          const count = item.badge ? item.badge({ revisions, citationsList }) : undefined;

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setSection(item.name);
                                setMobileDrawerOpen(false);
                              }}
                              className={`nav-item ${isActive ? 'active' : ''}`}
                              title={isCompact ? item.name : undefined}
                              aria-current={isActive ? 'page' : undefined}
                            >
                              <item.icon size={16} className="nav-item-icon" />
                              {!isCompact && <span className="nav-item-text">{item.name}</span>}
                              {!isCompact && count !== undefined && count > 0 && (
                                <small className="nav-count">{count}</small>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>
              );
            })}
        </nav>

        <div className="sidebar-bottom">
          {!isCompact && (
            <div className="integrity-card">
              <div className="integrity-icon"><ShieldCheck size={18} /></div>
              <strong>Meaning preservation</strong>
              <p>Empirical facts, p-values, sample sizes, and citations are deterministically validated.</p>
            </div>
          )}
          <div className="user-profile-container" ref={userMenuRef}>
            <div
              className={`user-row ${userMenuOpen ? 'menu-active' : ''}`}
              onClick={() => setUserMenuOpen(prev => !prev)}
              title={isCompact ? `${user.displayName || user.email} — Click for account menu` : 'Account menu'}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setUserMenuOpen(prev => !prev);
                }
              }}
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.displayName || user.email} className="avatar-img" />
              ) : (
                <div className="avatar">{(user.displayName || user.email)[0]?.toUpperCase()}</div>
              )}
              {!isCompact && (
                <div className="user-meta">
                  <strong>{user.displayName || user.email.split('@')[0]}</strong>
                  <small title={user.email}>{user.email}</small>
                </div>
              )}
              {!isCompact && (
                <div className="user-chevron">
                  <ChevronUp size={13} style={{ transform: userMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                </div>
              )}
            </div>

            {userMenuOpen && (
              <div className="user-menu-dropdown" role="menu">
                <div className="user-menu-header">
                  <strong>{user.displayName || user.email.split('@')[0]}</strong>
                  <small title={user.email}>{user.email}</small>
                </div>
                <div className="user-menu-divider" />
                <button
                  type="button"
                  className="user-menu-item"
                  onClick={() => {
                    setSection('Settings');
                    setUserMenuOpen(false);
                  }}
                  role="menuitem"
                >
                  <Settings2 size={13} />
                  <span>Settings & Preferences</span>
                </button>
                <button
                  type="button"
                  className="user-menu-item danger"
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  role="menuitem"
                >
                  <LogOut size={13} />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="icon-button mobile-drawer-btn"
              onClick={() => setMobileDrawerOpen(true)}
              title="Open menu"
              aria-label="Open navigation menu"
            >
              <Menu size={18} />
            </button>
            <button
              type="button"
              className="icon-button topbar-collapse-btn"
              onClick={toggleCompact}
              title={isCompact ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)'}
              aria-label="Toggle compact sidebar"
            >
              <PanelLeft size={16} />
            </button>
            <div className="breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <span style={{ color: 'var(--rp-text-muted)', fontWeight: 500 }}>Workspace</span>
              <ChevronRight size={13} style={{ color: 'var(--rp-text-dim)' }} />
              <strong style={{ color: 'var(--rp-text)', fontWeight: 600 }}>{section}</strong>
            </div>

            {/* Global Active Project Context Selector */}
            <div className="topbar-project-context" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '10px' }}>
              <span style={{ color: 'var(--rp-border)' }}>|</span>
              <FolderKanban size={14} style={{ color: 'var(--rp-accent)' }} />
              <select
                value={activeProject?._id || ''}
                onChange={(e) => {
                  const found = projects.find(p => p._id === e.target.value);
                  setActiveProject(found || null);
                  if (found) localStorage.setItem('rp_active_project_id', found._id);
                  else localStorage.removeItem('rp_active_project_id');
                }}
                className="topbar-project-select"
                title="Select active project context"
              >
                <option value="">(All Projects)</option>
                {projects.map(p => (
                  <option key={p._id} value={p._id}>
                    {p.title}
                  </option>
                ))}
              </select>
              {activeProject && (
                <span className="rp-badge rp-badge-accent" style={{ fontSize: '10px' }}>
                  {activeProject.workflowStage || 'literature'} · {activeProject.completionPercentage || 0}%
                </span>
              )}
            </div>
          </div>

          <div className="top-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="rp-header-search-btn"
              onClick={() => {
                setShowCmdPalette(true);
                setCmdQuery('');
                setCmdSelectedIndex(0);
              }}
              title="Search tools, projects, and actions (Ctrl+K)"
              aria-label="Open Command Palette"
            >
              <Search size={13} />
              <span>Search or jump to...</span>
              <kbd className="rp-cmd-shortcut">Ctrl+K</kbd>
            </button>

            <div className="secure-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--rp-text-muted)' }}>
              <span className="green-dot"></span>
              <span>Online</span>
            </div>

            <button
              className="icon-button"
              onClick={() => setDark(!dark)}
              title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-label="Toggle theme"
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button
              className="icon-button"
              onClick={() => setSection('Settings')}
              title="Settings & Preferences"
              aria-label="Open Settings"
            >
              <Settings2 size={16} />
            </button>
          </div>
        </header>

        <div className="page-content">
          {error && (
            <div className="alert error" role="alert">
              <div className="alert-content">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                className="alert-dismiss-btn"
                onClick={() => setErrorState('')}
                aria-label="Dismiss alert"
                title="Dismiss alert"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )}
          {message && (
            <div className="alert success" role="status">
              <div className="alert-content">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>{message}</span>
              </div>
              <button
                type="button"
                className="alert-dismiss-btn"
                onClick={() => setMessageState('')}
                aria-label="Dismiss notification"
                title="Dismiss notification"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )}

          {/* ACADEMIC WRITING STUDIO VIEW */}
          {section === 'Writing Studio' && (
            <div className="studio-layout">
              {/* Left Sidebar: Documents & Project Context */}
              <div className="studio-sidebar">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <strong style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--muted)' }}>My Documents</strong>
                  <button className="text-button" onClick={handleCreateNewDocument}><Plus size={14} /> New</button>
                </div>

                <div className="studio-doc-list">
                  {documents.length > 0 ? documents.map(d => (
                    <button
                      key={d._id}
                      onClick={() => selectDocument(d)}
                      className={`studio-doc-item ${activeDoc?._id === d._id ? 'active' : ''}`}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                        <small style={{ color: 'var(--muted)', fontSize: '9px' }}>{d.wordCount || 0} words · v{d.version || 1}</small>
                      </div>
                      <button
                        className="icon-button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteDocument(d._id); }}
                        title="Delete document"
                        style={{ padding: '2px' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </button>
                  )) : (
                    <div style={{ fontSize: '11px', color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>No documents yet. Click "New" to start.</div>
                  )}
                </div>

                <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '8px', color: 'var(--muted)', textTransform: 'uppercase' }}>DOCX Tools</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label className="secondary small upload-button" style={{ width: '100%', justifyContent: 'center' }}>
                      <Upload size={14} /> Import DOCX
                      <input type="file" accept=".docx" onChange={handleImportDocx} hidden />
                    </label>
                    <button className="secondary small" onClick={handleExportDocx} disabled={!activeDoc} style={{ width: '100%' }}>
                      <Download size={14} /> Export DOCX
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Citation Library</span>
                    <small style={{ fontSize: '10px', color: 'var(--muted)' }}>{citationsList.length} refs</small>
                  </div>
                  {citationsList.slice(0, 3).map(c => (
                    <div key={c._id} style={{ fontSize: '10px', padding: '6px 8px', background: 'var(--surface2)', borderRadius: '6px', marginBottom: '6px' }}>
                      <strong style={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{c.title}</strong>
                      <span style={{ color: 'var(--muted)' }}>{c.year} · {c.doi || 'No DOI'}</span>
                    </div>
                  ))}
                  <button className="text-button" onClick={() => setSection('Citation Assistant')} style={{ width: '100%', textAlign: 'left', marginTop: '4px' }}>
                    Manage references <ArrowUpRight size={13} />
                  </button>
                </div>
              </div>

              {/* Main Workspace: Academic Document Editor */}
              <div className="studio-editor-card">
                <input
                  type="text"
                  className="studio-title-input"
                  value={docTitle}
                  onChange={(e) => { setDocTitle(e.target.value); setSaveStatus('unsaved'); }}
                  placeholder="Document Title…"
                />

                <div className="studio-toolbar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <select
                      value={rewriteMode}
                      onChange={(e) => setRewriteMode(e.target.value)}
                      style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)' }}
                    >
                      {REWRITE_MODES.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>

                    <input
                      type="text"
                      placeholder="Preserve terms (e.g. p < 0.05, fMRI)…"
                      value={preserveTerms}
                      onChange={(e) => setPreserveTerms(e.target.value)}
                      style={{ fontSize: '11px', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)', width: '220px', background: 'var(--surface)' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      {saveStatus === 'saving' && 'Saving…'}
                      {saveStatus === 'saved' && <><Check size={11} color="#10b981" /> Saved</>}
                      {saveStatus === 'unsaved' && '● Unsaved'}
                    </span>

                    <button
                      className="secondary small"
                      onClick={() => setSection('Paraphrasing Tool')}
                      title="Open full-screen QuillBot Paraphraser"
                    >
                      <RefreshCw size={12} /> Paraphraser
                    </button>
                    <button
                      className="secondary small"
                      onClick={() => setSection('AI Text Humanizer')}
                      title="Open AI Text Humanizer"
                    >
                      <ShieldCheck size={12} /> Humanizer
                    </button>
                    <button
                      className="primary small"
                      onClick={handleAiRewrite}
                      disabled={busy || !text.trim()}
                    >
                      <Sparkles size={14} />
                      {busy ? 'Rewriting…' : 'AI Rewrite'}
                    </button>
                  </div>
                </div>

                <textarea
                  className="studio-textarea"
                  value={text}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="Type or paste your academic manuscript here…"
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--muted)' }}>
                  <span>{wordCount} words · {text.length} characters · Version {activeDoc?.version || 1}</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="text-button" onClick={() => runAction('writing')}>Writing Assessment <ArrowUpRight size={13} /></button>
                    <button className="text-button" onClick={() => runAction('originality')}>Originality Check <ArrowUpRight size={13} /></button>
                  </div>
                </div>
              </div>

              {/* Right Sidebar: Inspector, Warnings, Diff, Citations */}
              <div className="studio-inspector">
                <div className="studio-tabs">
                  <button
                    className={`studio-tab-btn ${inspectorTab === 'warnings' ? 'active' : ''}`}
                    onClick={() => setInspectorTab('warnings')}
                  >
                    Warnings {currentWarnings.length > 0 && `(${currentWarnings.length})`}
                  </button>
                  <button
                    className={`studio-tab-btn ${inspectorTab === 'diff' ? 'active' : ''}`}
                    onClick={() => setInspectorTab('diff')}
                  >
                    Diff
                  </button>
                  <button
                    className={`studio-tab-btn ${inspectorTab === 'similarity' ? 'active' : ''}`}
                    onClick={async () => {
                      setInspectorTab('similarity');
                      if (!plagiarismAnalysis && text.trim()) {
                        try {
                          const res = await request('/analyze/plagiarism', token, { text });
                          setPlagiarismAnalysis(res);
                        } catch (_) {}
                      }
                    }}
                  >
                    Similarity
                  </button>
                  <button
                    className={`studio-tab-btn ${inspectorTab === 'ai-authorship' ? 'active' : ''}`}
                    onClick={async () => {
                      setInspectorTab('ai-authorship');
                      if (!aiAuthorship && text.trim()) {
                        try {
                          const res = await request('/analyze/ai-detection', token, { text });
                          setAiAuthorship(res);
                        } catch (_) {}
                      }
                    }}
                  >
                    AI Detector
                  </button>
                  <button
                    className={`studio-tab-btn ${inspectorTab === 'citations' ? 'active' : ''}`}
                    onClick={() => setInspectorTab('citations')}
                  >
                    Citations
                  </button>
                  <button
                    className={`studio-tab-btn ${inspectorTab === 'history' ? 'active' : ''}`}
                    onClick={() => setInspectorTab('history')}
                  >
                    History
                  </button>
                </div>

                {/* Tab 1: Meaning-Preservation Warnings */}
                {inspectorTab === 'warnings' && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>Meaning-Preservation Audit</div>
                    <p style={{ fontSize: '10px', color: 'var(--muted)', lineHeight: '1.5', marginBottom: '12px' }}>
                      Deterministic checks guard against research finding inversions, statistical modifications, and lost citations.
                    </p>

                    {currentWarnings.length > 0 ? currentWarnings.map((w, idx) => (
                      <div key={idx} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '9px', padding: '10px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span className={`warning-badge ${w.severity}`}>{w.severity}: {w.category}</span>
                        </div>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)', margin: '4px 0' }}>{w.detail}</p>
                        {w.originalValue && (
                          <div style={{ fontSize: '10px', color: 'var(--muted)', background: 'var(--surface)', padding: '4px 6px', borderRadius: '4px', marginTop: '4px' }}>
                            Original: <code>{w.originalValue}</code> → Revised: <code>{w.revisedValue}</code>
                          </div>
                        )}
                      </div>
                    )) : (
                      <div className="empty-state" style={{ padding: '25px 0' }}>
                        <ShieldCheck size={28} />
                        <strong>No meaning deviations detected</strong>
                        <p>Run "AI Rewrite" to evaluate proposed revisions against your original manuscript.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Visual Revision Diff */}
                {inspectorTab === 'diff' && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>Proposed Revision & Diff</div>
                    {proposedText ? (
                      <div>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                          <button className="primary small" onClick={() => handleAcceptRevision(false)} disabled={busy} style={{ flex: 1 }}>
                            <Check size={14} /> Accept Revision
                          </button>
                          <button className="secondary small" onClick={handleRejectRevision} disabled={busy}>
                            <X size={14} /> Reject
                          </button>
                        </div>

                        <div style={{ fontSize: '11px', lineHeight: '1.8', background: 'var(--surface2)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', maxHeight: '420px', overflowY: 'auto' }}>
                          {diffChunks.map((c, i) => {
                            if (c.type === 'added') return <span key={i} className="diff-added">{c.text} </span>;
                            if (c.type === 'removed') return <span key={i} className="diff-removed">{c.text} </span>;
                            return <span key={i}>{c.text} </span>;
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="empty-state" style={{ padding: '25px 0' }}>
                        <WandSparkles size={28} />
                        <strong>No active proposed revision</strong>
                        <p>Select a mode and click "AI Rewrite" to generate an academic draft comparison.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Plagiarism & Similarity */}
                {inspectorTab === 'similarity' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700 }}>Similarity & Plagiarism Check</span>
                      <button
                        className="secondary small"
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const res = await request('/analyze/plagiarism', token, { text });
                            setPlagiarismAnalysis(res);
                            setMessage('Similarity analysis updated.');
                          } catch (e: any) { setError(e.message); }
                          finally { setBusy(false); }
                        }}
                        disabled={busy || !text.trim()}
                        style={{ fontSize: '10px', padding: '3px 8px' }}
                      >
                        <RefreshCw size={11} /> Re-scan
                      </button>
                    </div>

                    {plagiarismAnalysis ? (
                      <div>
                        <div style={{ background: 'var(--surface2)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700 }}>Similarity Index: {plagiarismAnalysis.similarityScore}%</span>
                            <span className={`originality-score-pill ${plagiarismAnalysis.similarityScore > 25 ? 'low' : plagiarismAnalysis.similarityScore > 12 ? 'moderate' : 'high'}`}>
                              {plagiarismAnalysis.similarityLevel}
                            </span>
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', lineHeight: '1.4' }}>
                            {plagiarismAnalysis.excludedContent?.quotationsExcluded ? `${plagiarismAnalysis.excludedContent.quotationsCount} quotes excluded · ` : ''}
                            {plagiarismAnalysis.analyzedWords} words compared
                          </div>
                        </div>

                        <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '10px', lineHeight: '1.4' }}>
                          {plagiarismAnalysis.disclaimer}
                        </div>

                        {plagiarismAnalysis.matchedPassages && plagiarismAnalysis.matchedPassages.length > 0 ? (
                          <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>
                              Matches ({plagiarismAnalysis.matchedPassages.length})
                            </div>
                            {plagiarismAnalysis.matchedPassages.map((m: any, idx: number) => (
                              <div key={idx} style={{ background: 'var(--surface2)', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '6px', fontSize: '10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                                  <span>{m.sourceLocation}</span>
                                  {m.sourceLink && (
                                    <a href={m.sourceLink} target="_blank" rel="noreferrer" style={{ color: '#8876ee', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                      Source <ArrowUpRight size={11} />
                                    </a>
                                  )}
                                </div>
                                <p style={{ margin: '3px 0' }}>“{m.excerpt}”</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="empty-state" style={{ padding: '15px 0' }}>
                            <Check size={20} style={{ color: '#34c98b' }} />
                            <strong style={{ fontSize: '11px' }}>No significant passage overlap detected</strong>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="empty-state" style={{ padding: '25px 0' }}>
                        <FileCheck2 size={26} />
                        <strong>Similarity analysis not yet run</strong>
                        <p>Click "Re-scan" to evaluate manuscript against authorized comparison sources.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: AI-Authorship Indicators */}
                {inspectorTab === 'ai-authorship' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700 }}>AI Authorship Advisory</span>
                      <button
                        className="secondary small"
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const res = await request('/analyze/ai-detection', token, { text });
                            setAiAuthorship(res);
                            setMessage('AI Authorship indicators updated.');
                          } catch (e: any) { setError(e.message); }
                          finally { setBusy(false); }
                        }}
                        disabled={busy || !text.trim()}
                        style={{ fontSize: '10px', padding: '3px 8px' }}
                      >
                        <RefreshCw size={11} /> Re-evaluate
                      </button>
                    </div>

                    {aiAuthorship ? (
                      <div>
                        <div style={{ background: 'var(--surface2)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700 }}>AI Index: {aiAuthorship.aiLikelihood}%</span>
                            <span style={{ fontSize: '9px', color: 'var(--muted)' }}>Uncertainty: {aiAuthorship.uncertaintyBand}</span>
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--muted)', lineHeight: '1.4' }}>
                            Burstiness: {aiAuthorship.burstinessScore} σ · {aiAuthorship.burstinessEvaluation}
                          </div>
                        </div>

                        <div style={{ fontSize: '9px', color: 'var(--muted)', background: 'var(--surface)', padding: '6px 8px', borderRadius: '6px', marginBottom: '10px', border: '1px solid var(--border)' }}>
                          <strong>Advisory note:</strong> {aiAuthorship.advisoryNotice}
                        </div>

                        {aiAuthorship.flaggedSegments && aiAuthorship.flaggedSegments.length > 0 && (
                          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>
                              Formulaic Clichés & Markers ({aiAuthorship.flaggedSegments.length})
                            </div>
                            {aiAuthorship.flaggedSegments.map((f: any, idx: number) => (
                              <div key={idx} style={{ background: 'var(--surface2)', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '4px', fontSize: '10px' }}>
                                <strong>{f.label}</strong> ({f.occurrences}x)
                                <div style={{ color: 'var(--muted)', fontSize: '9px' }}>{f.note}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="empty-state" style={{ padding: '25px 0' }}>
                        <ScanText size={26} />
                        <strong>AI Authorship indicator not yet run</strong>
                        <p>Click "Re-evaluate" to inspect structural burstiness and formulaic patterns.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 5: Citation Assistant */}
                {inspectorTab === 'citations' && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>Quick DOI Lookup</div>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                      <input
                        type="text"
                        placeholder="10.1038/s41586-..."
                        value={lookupDoiInput}
                        onChange={(e) => setLookupDoiInput(e.target.value)}
                        style={{ flex: 1, minWidth: 0, fontSize: '11px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)' }}
                      />
                      <button className="secondary small" onClick={handleLookupDoi} disabled={busy || !lookupDoiInput.trim()}>
                        Lookup
                      </button>
                    </div>

                    {lookupResult?.formatted && (
                      <div style={{ background: 'var(--surface2)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#8876ee' }}>Crossref Verified</span>
                          <select
                            value={citationFormatStyle}
                            onChange={(e: any) => setCitationFormatStyle(e.target.value)}
                            style={{ fontSize: '10px', padding: '2px 4px', border: '1px solid var(--border)' }}
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              
              >
                            <option value="apa">APA 7th</option>
                            <option value="mla">MLA 9th</option>
                            <option value="ieee">IEEE</option>
                          </select>
                        </div>
                        <p style={{ fontSize: '10px', lineHeight: '1.5', margin: '4px 0', color: 'var(--text)' }}>
                          {lookupResult.formatted[citationFormatStyle]}
                        </p>
                        <button className="primary small" onClick={handleAddCitationToLibrary} style={{ width: '100%', marginTop: '8px' }}>
                          <Plus size={13} /> Add to Project Library
                        </button>
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '12px' }}>
                      <button className="secondary small" onClick={handleValidateCitations} disabled={busy} style={{ width: '100%' }}>
                        <BookOpenCheck size={14} /> Validate In-Text Citations
                      </button>

                      {citationAuditResult && (
                        <div style={{ marginTop: '10px', fontSize: '10px' }}>
                          <div style={{ fontWeight: 700, color: citationAuditResult.valid ? '#34c98b' : '#e46f7a', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {citationAuditResult.valid ? <><Check size={12} /> All citations verified</> : <><AlertTriangle size={12} /> Citation discrepancies detected</>}
                          </div>
                          {citationAuditResult.missingCitations.map((m: any, i: number) => (
                            <div key={i} style={{ color: '#e46f7a', marginBottom: '4px' }}>• Missing reference for: {m.marker}</div>
                          ))}
                          {citationAuditResult.uncitedReferences.map((u: any, i: number) => (
                            <div key={i} style={{ color: '#e7a43b', marginBottom: '4px' }}>• Uncited in text: {u.title}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab 4: History & Restore */}
                {inspectorTab === 'history' && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>Document Revision Timeline</div>
                    {revisions.filter(r => !activeDoc || (r as any).documentId === activeDoc._id).length > 0 ? (
                      revisions.filter(r => !activeDoc || (r as any).documentId === activeDoc._id).map(r => (
                        <div key={r._id} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className="mode-badge">{r.mode}</span>
                            <small style={{ fontSize: '9px', color: 'var(--muted)' }}>{new Date(r.createdAt).toLocaleDateString()}</small>
                          </div>
                          <p style={{ fontSize: '10px', color: 'var(--muted)', margin: '6px 0' }}>{r.summary || 'Revision'}</p>
                          <button
                            className="secondary small"
                            onClick={() => handleRestoreRevision(r._id)}
                            style={{ width: '100%', fontSize: '10px', padding: '4px 6px' }}
                          >
                            <RefreshCw size={12} /> Restore this version
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state" style={{ padding: '25px 0' }}>
                        <History size={26} />
                        <strong>No revisions for this document</strong>
                        <p>Accepted revisions and restores will be recorded in this timeline.</p>
                        </div>
                    )}
                  </div>
                )}
              </div>

              {/* Deterministic Meaning-Preservation Confirmation Modal */}
              {meaningModalData && (
                <div className="meaning-confirm-overlay" onClick={() => setMeaningModalData(null)}>
                  <div className="meaning-confirm-modal" onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <ShieldAlert size={22} style={{ color: '#ef4444' }} />
                      <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text)' }}>
                        Critical Empirical Fact Modification Warning
                      </h3>
                    </div>
                    <p style={{ fontSize: '11.5px', color: 'var(--muted)', lineHeight: '1.5', margin: '0 0 14px' }}>
                      Deterministic validation detected that the proposed AI revision modifies quantitative data, p-values, sample sizes, or citations. Please verify each altered claim before accepting:
                    </p>

                    <table className="meaning-diff-table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Original Fact</th>
                          <th>AI Revision</th>
                          <th>Audit Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {meaningModalData.changed?.map((item: any, idx: number) => (
                          <tr key={idx}>
                            <td><strong>{item.type || 'numerical'}</strong></td>
                            <td style={{ color: '#10b981' }}><code>{item.original}</code></td>
                            <td style={{ color: '#ef4444' }}><code>{item.revised}</code></td>
                            <td><span className="badge-critical">Critical Tampering</span></td>
                          </tr>
                        ))}
                        {meaningModalData.warnings?.map((w: string, idx: number) => (
                          <tr key={`warn-${idx}`}>
                            <td><strong>Warning</strong></td>
                            <td colSpan={2}>{w}</td>
                            <td><span className="badge-warning">Review Needed</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                      <button
                        className="secondary"
                        onClick={() => setMeaningModalData(null)}
                      >
                        Cancel & Keep Original
                      </button>
                      <button
                        className="primary"
                        style={{ background: '#dc2626', borderColor: '#b91c1c' }}
                        onClick={() => handleAcceptRevision(true)}
                      >
                        I Acknowledge & Accept Changes
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DASHBOARD VIEW */}
          {(section === 'Overview' || section === 'Dashboard') && (
            <Dashboard
              user={user}
              usage={usage}
              projects={projects}
              activeProject={activeProject}
              setActiveProject={setActiveProject}
              revisions={revisions}
              documents={documents}
              citationsList={citationsList}
              setSection={setSection}
              setShowProjectForm={setShowProjectForm}
              token={token}
              refreshData={refreshData}
            />
          )}

          {/* LITERATURE REVIEW STUDIO */}
          {section === 'Literature Review' && (
            <LiteratureReview
              token={token}
              activeProject={activeProject}
              setSection={setSection}
              setMessage={setMessage}
              setError={setError}
              onSendToStudio={(text: string) => {
                setText(prev => `${prev}\n\n${text}`);
                setSection('Writing Studio');
                setMessage('Literature synthesis added to active manuscript.');
              }}
            />
          )}

          {/* STATISTICAL ANALYSIS STUDIO */}
          {(section === 'Statistical Analysis' || section === 'Statistical Checker') && (
            <StatisticalAnalysis
              token={token}
              activeProject={activeProject}
              setSection={setSection}
              setMessage={setMessage}
              setError={setError}
              onSendToStudio={(narrative: string) => {
                setText(prev => `${prev}\n\n${narrative}`);
                setSection('Writing Studio');
                setMessage('Statistical results narrative inserted into manuscript.');
              }}
            />
          )}

          {/* PDF RESEARCH CHAT */}
          {section === 'PDF Research Chat' && (
            <PdfResearchChat
              token={token}
              activeProject={activeProject}
              setSection={setSection}
              setMessage={setMessage}
              setError={setError}
            />
          )}

          {/* SYSTEMATIC REVIEWS (PRISMA 2020) */}
          {section === 'Systematic Reviews' && (
            <SystematicReviews
              token={token}
              activeProject={activeProject}
              setSection={setSection}
              setMessage={setMessage}
              setError={setError}
            />
          )}

          {/* JOURNAL SUBMISSION STUDIO */}
          {(section === 'Journal Submission' || section === 'Journal Readiness') && (
            <JournalSubmission
              token={token}
              activeProject={activeProject}
              setSection={setSection}
              setMessage={setMessage}
              setError={setError}
            />
          )}

          {/* RESEARCH COLLABORATION */}
          {section === 'Research Collaboration' && (
            <ResearchCollaboration
              token={token}
              activeProject={activeProject}
              setSection={setSection}
              setMessage={setMessage}
              setError={setError}
            />
          )}

          {/* DOCUMENT STUDIO */}
          {(section === 'Document Studio' || section === 'DOCX / PDF Export') && (
            <DocumentStudio
              token={token}
              activeDoc={activeDoc}
              documents={documents}
              citationsList={citationsList}
              setSection={setSection}
              setMessage={setMessage}
              setError={setError}
              onExportDocx={handleExportDocx}
              onImportChange={handleImportDocx}
            />
          )}

          {/* REFERENCE & CITATION MANAGER (PHASE 4) */}
          {(section === 'Citation Assistant' || section === 'Reference Manager') && (
            <ReferenceManager
              token={token}
              activeProject={activeProject}
              setSection={setSection}
              setMessage={setMessage}
              setError={setError}
              onRefreshCitations={() => {
                request('/citations', token).then(c => {
                  if (Array.isArray(c)) setCitationsList(c);
                }).catch(() => {});
              }}
            />
          )}

          {/* PARAPHRASING, HUMANIZER, SUMMARIZATION, GRAMMAR & TONE */}
          {(section === 'Paraphrasing Tool' || section === 'AI Text Humanizer' || section === 'Summarization Tool' || section === 'Grammar & Fluency' || section === 'Tone & Rewriting') && (
            <ParaphrasingSuite
              text={text}
              setText={setText}
              initialMode={
                section === 'AI Text Humanizer' ? 'humanize' :
                section === 'Summarization Tool' ? 'summarize' :
                section === 'Grammar & Fluency' ? 'grammar-correction' :
                section === 'Tone & Rewriting' ? 'formal-scientific' :
                'standard'
              }
              token={token}
              activeDoc={activeDoc}
              onSendToStudio={(revised: string) => {
                setText(revised);
                setSection('Writing Studio');
                setMessage('Transferred text to Writing Studio editor.');
              }}
              onError={setError}
              onSuccess={setMessage}
            />
          )}

          {/* TEXTGUARD PLAGIARISM & AUTHENTICITY STUDIO */}
          {(section === 'Plagiarism & Similarity' || section === 'Originality Review' || section === 'Source Verification') && (
            <TextGuardStudio
              text={text}
              setText={setText}
              token={token}
              activeDoc={activeDoc}
              onImportFile={handleImportDocx}
              onError={setError}
              onSuccess={setMessage}
              onSendToStudio={(revised: string) => {
                setText(revised);
                setSection('Writing Studio');
                setMessage('Transferred text to Writing Studio editor.');
              }}
              onSendToHumanizer={(passage: string) => {
                setText(passage);
                setSection('AI Text Humanizer');
                setMessage('Transferred flagged passage to AI Text Humanizer.');
              }}
            />
          )}

          {/* AI-AUTHORSHIP INDICATORS */}
          {(section === 'AI-Authorship Indicators' || section === 'AI Assessment') && (
            <AnalysisPage
              title="AI-Authorship Indicators"
              subtitle="Advisory burstiness, perplexity variance, and machine pattern heuristics. Advisory only with ±20% uncertainty."
              resultsTitle="AI Authorship Heuristics Report"
              resultsSubtitle="Probabilistic stylistic indicators with prominent uncertainty disclosure"
              icon={<ScanText />}
              run={() => runAction('ai-authorship')}
              busy={busy}
              result={aiAuthorship || assessment}
              text={text}
              setText={setText}
              activeDoc={activeDoc}
              onImportFile={handleImportDocx}
            />
          )}

          {/* CITATION & REFERENCE TOOLS */}
          {(section === 'Citation Formatter' || section === 'Citation Checker') && (
            <AnalysisPage
              title="Citation Formatter & Consistency"
              subtitle="Audit in-text citation markers and formatting across APA, MLA, and IEEE standards."
              resultsTitle="Citation Consistency Report"
              resultsSubtitle="Reference integrity, author-year matching & formatting audit"
              icon={<BookOpenCheck />}
              run={() => runAction('citations')}
              busy={busy}
              result={citationsAnalysis}
              text={text}
              setText={setText}
              activeDoc={activeDoc}
              onImportFile={handleImportDocx}
            />
          )}

          {/* STATISTICAL CHECKER */}
          {section === 'Statistical Checker' && (
            <AnalysisPage
              title="Statistical Reporting Checker"
              subtitle="Deterministic verification of p-values, sample sizes (n), confidence intervals, and empirical findings."
              resultsTitle="Statistical Consistency Report"
              resultsSubtitle="Empirical values, p-values, and quantitative polarity checks"
              icon={<Activity />}
              run={() => runAction('statistical')}
              busy={busy}
              result={assessment}
              text={text}
              setText={setText}
              activeDoc={activeDoc}
              onImportFile={handleImportDocx}
            />
          )}

          {/* JOURNAL READINESS */}
          {section === 'Journal Readiness' && (
            <AnalysisPage
              title="Journal Submission Readiness Assistant"
              subtitle="Comprehensive pre-submission review against high-impact journal standards (headings, abstract, references, styling)."
              resultsTitle="Journal Readiness Assessment"
              resultsSubtitle="Pre-flight submission compliance analysis across academic criteria"
              icon={<FileCheck2 />}
              run={() => runAction('journal-readiness')}
              busy={busy}
              result={assessment}
              text={text}
              setText={setText}
              activeDoc={activeDoc}
              onImportFile={handleImportDocx}
            />
          )}

          {/* DOCX / PDF EXPORT */}
          {section === 'DOCX / PDF Export' && (
            <section className="analysis-page">
              <div className="page-title-row">
                <div>
                  <p className="eyebrow">PUBLISHING & ARCHIVING</p>
                  <h1>DOCX, PDF & LaTeX Export Studio</h1>
                  <p className="muted">Generate publication-ready Office Open XML (.docx), APA 7 multilingual LaTeX (.zip), and compiled PDF manuscripts.</p>
                </div>
                <div className="page-title-icon"><Download size={24} /></div>
              </div>
              <div className="analysis-workspace">
                <div className="panel" style={{ flex: 1 }}>
                  <div className="panel-heading">
                    <h3>Manuscript Export Formats</h3>
                    <p>Select your target format to generate and download.</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', padding: '10px 0' }}>
                    <div style={{ background: 'var(--surface2)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <Download size={18} style={{ color: '#8876ee' }} />
                        <strong>Microsoft Word (.docx)</strong>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '14px', lineHeight: '1.5' }}>
                        Export your active document as an Office Open XML (.docx) manuscript with proper typography.
                      </p>
                      <button className="primary small" onClick={handleExportDocx} disabled={!activeDoc} style={{ width: '100%' }}>
                        Download .docx
                      </button>
                    </div>

                    <div style={{ background: 'var(--surface2)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <BookOpen size={18} style={{ color: '#34c98b' }} />
                        <strong>Multilingual APA 7 LaTeX (.zip)</strong>
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '14px', lineHeight: '1.5' }}>
                        Complete Overleaf-ready project bundle including main.tex, references.bib, and UTF-8 font settings.
                      </p>
                      <button className="primary small" onClick={() => setSection('LaTeX Export Studio')} style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        Open LaTeX Studio <ArrowUpRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

                    {/* PROJECTS VIEW */}
          {(section === 'My Research Projects' || section === 'Projects') && (
            <Projects
              projects={projects}
              activeProject={activeProject}
              setActiveProject={setActiveProject}
              showForm={showProjectForm}
              setShowForm={setShowProjectForm}
              token={token}
              documents={documents}
              citationsList={citationsList}
              revisions={revisions}
              setSection={setSection}
              onOpenInStudio={(doc: any) => {
                selectDocument(doc);
                setSection('Writing Studio');
                setMessage(`Loaded "${doc.title}" into Writing Studio.`);
              }}
              setMessage={setMessage}
              setError={setError}
              refreshData={refreshData}
              onCreateProjectClick={() => setShowProjectForm(true)}
            />
          )}

          {/* REVISION HISTORY VIEW */}
          {section === 'Revision History' && (
            <HistoryPage revisions={revisions} token={token} />
          )}

          {/* INTEGRITY REPORTS VIEW */}
          {section === 'Integrity Reports' && (
            <IntegrityReportsPage
              token={token}
              documents={documents}
              activeDoc={activeDoc}
              setMessage={setMessage}
              setError={setError}
            />
          )}

          {/* PRIVACY & DATA VIEW */}
          {section === 'Privacy & Data' && (
            <PrivacyPage
              token={token}
              user={user}
              projects={projects}
              documents={documents}
              revisions={revisions}
              citations={citationsList}
              setMessage={setMessage}
              setError={setError}
              logout={logout}
            />
          )}

          {/* ADMIN VIEWS */}
          {section === 'Admin Overview' && user?.role === 'admin' && (
            <AdminOverviewPage token={token} setError={setError} />
          )}

          {section === 'User Management' && user?.role === 'admin' && (
            <AdminUsersPage token={token} currentUser={user} setMessage={setMessage} setError={setError} />
          )}

          {section === 'Usage Analytics' && (
            <AdminAnalyticsPage token={token} user={user} setError={setError} />
          )}

          {section === 'Platform Audit Logs' && user?.role === 'admin' && (
            <AdminAuditLogsPage token={token} setError={setError} />
          )}

          {/* Access Restricted fallback for non-admin accounts */}
          {(section === 'Admin Overview' || section === 'User Management' || section === 'Platform Audit Logs') && user?.role !== 'admin' && (
            <div className="card" style={{ padding: '3rem', textAlign: 'center', margin: '2rem auto', maxWidth: '520px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Access Restricted</h2>
              <p className="muted" style={{ marginBottom: '1.5rem' }}>Administrator privileges are required to view this section.</p>
              <button className="primary small" onClick={() => setSection('Dashboard')}>Return to Dashboard</button>
            </div>
          )}

          {/* PHASE 5: LATEX EXPORT STUDIO VIEW */}
          {section === 'LaTeX Export Studio' && (
            <LatexExportStudioPage
              token={token}
              activeDoc={activeDoc}
              documents={documents}
              citationsList={citationsList}
              setError={setError}
              setMessage={setMessage}
            />
          )}

          {/* SETTINGS VIEW */}
          {section === 'Settings' && (
            <SettingsPage
              user={user}
              usage={usage}
              dark={dark}
              setDark={setDark}
              persist={persist}
              setPersist={setPersist}
              isCompact={isCompact}
              setIsCompact={setIsCompact}
              logout={logout}
              onLinkGoogle={handleLinkGoogle}
              isGoogleConfigured={isGoogleConfigured}
              isOriginSupportedByGoogle={isOriginSupportedByGoogle}
              isLanHttpOrigin={isLanHttpOrigin}
              googleClientId={googleClientId}
              token={token}
              setMessage={setMessage}
              setError={setError}
            />
          )}
        </div>

      </main>

      <ProjectCreationModal
        isOpen={showProjectForm}
        onClose={() => setShowProjectForm(false)}
        onSubmit={handleCreateProject}
        isSubmitting={busy}
      />

      <CommandPaletteModal
        isOpen={showCmdPalette}
        onClose={() => setShowCmdPalette(false)}
        onNavigate={(sec) => setSection(sec)}
        projects={projects}
        onSelectProject={(p) => {
          setActiveProject(p);
          localStorage.setItem('rp_active_project_id', p._id);
        }}
        dark={dark}
        onToggleTheme={() => setDark(!dark)}
        onCreateDoc={handleCreateNewDocument}
        onCreateProject={() => {
          setSection('My Research Projects');
          setShowProjectForm(true);
        }}
      />
    </div>
  );

  const canInitializeGoogle = Boolean(isGoogleConfigured && isOriginSupportedByGoogle && googleClientId);
  return canInitializeGoogle ? (
    <GoogleOAuthProvider clientId={googleClientId}>
      {appShellContent}
    </GoogleOAuthProvider>
  ) : (
    appShellContent
  );
}

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (section: string) => void;
  projects: Project[];
  onSelectProject: (p: Project) => void;
  dark: boolean;
  onToggleTheme: () => void;
  onCreateDoc: () => void;
  onCreateProject: () => void;
}

function CommandPaletteModal({
  isOpen,
  onClose,
  onNavigate,
  projects,
  onSelectProject,
  dark,
  onToggleTheme,
  onCreateDoc,
  onCreateProject
}: CommandPaletteModalProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const q = search.trim().toLowerCase();

  // Navigation Items from NAV_GROUPS
  const navItems = NAV_GROUPS.flatMap(g => g.items.map(it => ({
    type: 'nav',
    id: it.id,
    title: it.name,
    category: g.title,
    icon: it.icon,
    action: () => {
      onNavigate(it.name);
      onClose();
    }
  }))).filter(item => !q || item.title.toLowerCase().includes(q) || item.category.toLowerCase().includes(q));

  // Quick Action Items
  const actionItems = [
    {
      type: 'action',
      id: 'act-new-doc',
      title: 'New Manuscript Document',
      category: 'Actions',
      icon: Plus,
      action: () => {
        onCreateDoc();
        onClose();
      }
    },
    {
      type: 'action',
      id: 'act-new-proj',
      title: 'Create New Research Project',
      category: 'Actions',
      icon: FolderKanban,
      action: () => {
        onCreateProject();
        onClose();
      }
    },
    {
      type: 'action',
      id: 'act-toggle-theme',
      title: dark ? 'Switch to Light Theme' : 'Switch to Dark Theme',
      category: 'Actions',
      icon: dark ? Sun : Moon,
      action: () => {
        onToggleTheme();
        onClose();
      }
    }
  ].filter(item => !q || item.title.toLowerCase().includes(q));

  // Project Items
  const projectItems = projects.map(p => ({
    type: 'project',
    id: `proj-${p._id}`,
    title: p.title,
    category: 'Projects',
    icon: FolderKanban,
    action: () => {
      onSelectProject(p);
      onClose();
    }
  })).filter(item => !q || item.title.toLowerCase().includes(q));

  const allItems = [...actionItems, ...projectItems, ...navItems];
  const safeIndex = Math.min(selectedIndex, Math.max(0, allItems.length - 1));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, allItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + allItems.length) % Math.max(1, allItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[safeIndex]) {
        allItems[safeIndex].action();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="rp-cmd-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Command Palette">
      <div className="rp-cmd-dialog" onClick={e => e.stopPropagation()}>
        <div className="rp-cmd-header">
          <Search size={16} style={{ color: 'var(--rp-text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            className="rp-cmd-input"
            placeholder="Type a command, tool, or project..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="rp-cmd-shortcut" onClick={onClose} style={{ cursor: 'pointer' }}>ESC</kbd>
        </div>

        <div className="rp-cmd-list">
          {allItems.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--rp-text-muted)', fontSize: '12px' }}>
              No matching tools, projects, or commands.
            </div>
          ) : (
            allItems.map((item, idx) => {
              const isSelected = idx === safeIndex;
              const IconComp = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`rp-cmd-item ${isSelected ? 'selected' : ''}`}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <IconComp size={15} style={{ color: isSelected ? 'var(--rp-accent)' : 'var(--rp-text-muted)' }} />
                    <span style={{ fontWeight: isSelected ? 600 : 400 }}>{item.title}</span>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--rp-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {item.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="rp-cmd-footer">
          <span>Navigate with <kbd className="rp-cmd-shortcut">↑</kbd> <kbd className="rp-cmd-shortcut">↓</kbd></span>
          <span>Select with <kbd className="rp-cmd-shortcut">↵ Enter</kbd></span>
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(dateStr?: string | Date): string {
  if (!dateStr) return 'Recently';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Recently';
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function ProjectCreationModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [title, setTitle] = useState('');
  const [discipline, setDiscipline] = useState('Computer Science');
  const [researchType, setResearchType] = useState('Quantitative');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState('');
  const [keywords, setKeywords] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [validationError, setValidationError] = useState('');

  const DISCIPLINES = [
    'Computer Science',
    'Medicine & Health',
    'Social Sciences',
    'Physical Sciences',
    'Life Sciences',
    'Humanities',
    'Engineering',
    'Economics & Business',
    'Interdisciplinary'
  ];

  const RESEARCH_TYPES = [
    'Quantitative',
    'Qualitative',
    'Mixed Methods',
    'Systematic Review',
    'Meta-Analysis',
    'Experimental',
    'Observational',
    'Computational',
    'Theoretical'
  ];

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || title.trim().length < 3) {
      setValidationError('Project title must be at least 3 characters.');
      return;
    }
    if (title.trim().length > 160) {
      setValidationError('Project title cannot exceed 160 characters.');
      return;
    }
    if (startDate && targetDate && new Date(targetDate) < new Date(startDate)) {
      setValidationError('Target completion date cannot precede the start date.');
      return;
    }
    setValidationError('');

    const parsedObjectives = objectives
      .split('\n')
      .map(o => o.trim())
      .filter(Boolean);
    const parsedKeywords = keywords
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    await onSubmit({
      title: title.trim(),
      discipline,
      researchType,
      description: description.trim(),
      objectives: parsedObjectives,
      keywords: parsedKeywords,
      startDate: startDate || undefined,
      targetDate: targetDate || undefined,
      visibility
    });
  };

  return (
    <div
      className="rp-cmd-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Create Research Project"
      style={{ zIndex: 1200 }}
    >
      <div
        className="rp-cmd-dialog"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '640px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--rp-border-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--rp-radius-md)',
              background: 'var(--rp-accent-subtle)',
              color: 'var(--rp-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FolderKanban size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--rp-text)' }}>
                New Research Project
              </h2>
              <p style={{ fontSize: '11.5px', color: 'var(--rp-text-muted)', margin: '2px 0 0' }}>
                Define your research scope, methodology, and target milestones.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ color: 'var(--rp-text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {validationError && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              background: '#fef2f2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              borderRadius: 'var(--rp-radius-sm)',
              fontSize: '12px',
              marginBottom: '16px'
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{validationError}</span>
            </div>
          )}

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--rp-text)', marginBottom: '5px' }}>
              Project Title <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={160}
              placeholder="e.g. Empirical Evaluation of Latency in Distributed Consensus"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--rp-radius-sm)',
                border: '1px solid var(--rp-border)',
                background: 'var(--rp-surface)',
                color: 'var(--rp-text)',
                fontSize: '13px'
              }}
            />
            <small style={{ fontSize: '10.5px', color: 'var(--rp-text-muted)', display: 'block', marginTop: '3px' }}>
              3 to 160 characters. Clearly identifies your research initiative.
            </small>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--rp-text)', marginBottom: '5px' }}>
                Discipline <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={discipline}
                onChange={e => setDiscipline(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--rp-radius-sm)',
                  border: '1px solid var(--rp-border)',
                  background: 'var(--rp-surface)',
                  color: 'var(--rp-text)',
                  fontSize: '12.5px'
                }}
              >
                {DISCIPLINES.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--rp-text)', marginBottom: '5px' }}>
                Research Type <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={researchType}
                onChange={e => setResearchType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--rp-radius-sm)',
                  border: '1px solid var(--rp-border)',
                  background: 'var(--rp-surface)',
                  color: 'var(--rp-text)',
                  fontSize: '12.5px'
                }}
              >
                {RESEARCH_TYPES.map(rt => (
                  <option key={rt} value={rt}>{rt}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--rp-text)', marginBottom: '5px' }}>
              Description & Problem Statement
            </label>
            <textarea
              rows={3}
              maxLength={1000}
              placeholder="Describe the research questions, theoretical context, and hypotheses..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--rp-radius-sm)',
                border: '1px solid var(--rp-border)',
                background: 'var(--rp-surface)',
                color: 'var(--rp-text)',
                fontSize: '12.5px',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--rp-text)', marginBottom: '5px' }}>
              Research Objectives (one per line)
            </label>
            <textarea
              rows={3}
              placeholder="e.g.&#10;Synthesize literature on Byzantine fault tolerance&#10;Construct testbed with 100 heterogeneous nodes&#10;Conduct two-way ANOVA on throughput variance"
              value={objectives}
              onChange={e => setObjectives(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--rp-radius-sm)',
                border: '1px solid var(--rp-border)',
                background: 'var(--rp-surface)',
                color: 'var(--rp-text)',
                fontSize: '12.5px',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--rp-text)', marginBottom: '5px' }}>
              Keywords (comma-separated)
            </label>
            <input
              type="text"
              placeholder="e.g. consensus, distributed systems, latency, fault tolerance"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--rp-radius-sm)',
                border: '1px solid var(--rp-border)',
                background: 'var(--rp-surface)',
                color: 'var(--rp-text)',
                fontSize: '12.5px'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--rp-text)', marginBottom: '5px' }}>
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--rp-radius-sm)',
                  border: '1px solid var(--rp-border)',
                  background: 'var(--rp-surface)',
                  color: 'var(--rp-text)',
                  fontSize: '12px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--rp-text)', marginBottom: '5px' }}>
                Target Completion Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 'var(--rp-radius-sm)',
                  border: '1px solid var(--rp-border)',
                  background: 'var(--rp-surface)',
                  color: 'var(--rp-text)',
                  fontSize: '12px'
                }}
              />
            </div>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            paddingTop: '16px',
            borderTop: '1px solid var(--rp-border-subtle)'
          }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || !title.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={13} className="spin" /> Creating Project...
                </>
              ) : (
                <>
                  <Plus size={14} /> Create Research Project
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Dashboard({
  user,
  usage,
  projects = [],
  activeProject,
  setActiveProject,
  revisions = [],
  documents = [],
  citationsList = [],
  setSection,
  setShowProjectForm,
  token,
  refreshData
}: any) {
  const [overview, setOverview] = useState<any>(null);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(true);
  const [overviewError, setOverviewError] = useState<string>('');
  const [taskToggling, setTaskToggling] = useState<string | null>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState<string>('');
  const [addingTask, setAddingTask] = useState<boolean>(false);

  const fetchOverview = async () => {
    if (!token) {
      setLoadingOverview(false);
      return;
    }
    setLoadingOverview(true);
    setOverviewError('');
    try {
      const data = await request('/dashboard/overview', token, undefined, 'GET');
      setOverview(data);
    } catch (e: any) {
      setOverviewError(e.message || 'Failed to load live overview metrics.');
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [token, activeProject?._id]);

  const handleToggleTask = async (task: any) => {
    if (taskToggling) return;
    setTaskToggling(task._id);
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      await request(`/projects/${task.projectId}/tasks/${task._id}`, token, { status: newStatus }, 'PATCH');
      await fetchOverview();
      if (refreshData) await refreshData();
    } catch (e: any) {
      console.error('Failed to toggle task:', e);
    } finally {
      setTaskToggling(null);
    }
  };

  const handleAddQuickTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim() || !activeProject) return;
    setAddingTask(true);
    try {
      await request(`/projects/${activeProject._id}/tasks`, token, {
        title: quickTaskTitle.trim(),
        priority: 'medium',
        stage: 'general'
      }, 'POST');
      setQuickTaskTitle('');
      await fetchOverview();
      if (refreshData) await refreshData();
    } catch (e: any) {
      console.error('Failed to add quick task:', e);
    } finally {
      setAddingTask(false);
    }
  };

  // Derive metrics with fallbacks
  const totalProjects = overview?.metrics?.totalProjects ?? projects.length;
  const activeProjectsCount = overview?.metrics?.activeProjects ?? projects.filter((p: any) => p.status === 'active' || !p.status).length;
  const draftProjectsCount = overview?.metrics?.draftProjects ?? projects.filter((p: any) => p.status === 'draft').length;
  const totalDocuments = overview?.metrics?.totalDocuments ?? documents.length;
  const totalWords = overview?.metrics?.totalWords ?? documents.reduce((acc: number, d: any) => acc + (d.wordCount || 0), 0);
  const totalCitations = overview?.metrics?.totalCitations ?? citationsList.length;
  const verifiedDois = overview?.metrics?.verifiedDois ?? citationsList.filter((c: any) => !!c.doi).length;
  const taskRate = overview?.metrics?.tasks?.completionRate ?? (activeProject?.progress || activeProject?.completionPercentage || 0);
  const tasksCompleted = overview?.metrics?.tasks?.completed ?? 0;
  const tasksTotal = overview?.metrics?.tasks?.total ?? 0;
  const upcomingDeadlines = overview?.metrics?.upcomingDeadlines ?? 0;

  const currentHour = new Date().getHours();
  const timeGreeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';
  const userName = user?.displayName || user?.email?.split('@')[0] || 'Researcher';

  const upcomingTasksList = overview?.upcomingTasks || [];
  const recentActivityList = overview?.recentActivity || [];
  const recentProjectsList = overview?.recentProjects || projects.slice(0, 4);

  const workflowStages = [
    { id: 'literature', label: '1. Literature', section: 'Literature Review', icon: BookOpen },
    { id: 'statistics', label: '2. Statistics', section: 'Statistical Analysis', icon: Activity },
    { id: 'pdf-chat', label: '3. PDF Chat', section: 'PDF Research Chat', icon: FileText },
    { id: 'writing', label: '4. Manuscript', section: 'Writing Studio', icon: WandSparkles },
    { id: 'journal', label: '5. Submission', section: 'Journal Submission', icon: Send }
  ];

  return (
    <section className="dashboard">
      {/* GREETING & RESEARCH COMMAND CENTER HEADER */}
      <div className="welcome-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="eyebrow" style={{ margin: 0 }}>ENTERPRISE RESEARCH COMMAND CENTER</span>
            <span className="rp-badge rp-badge-accent" style={{ fontSize: '10px' }}>v1.0 Production</span>
          </div>
          <h1 style={{ margin: '4px 0 6px', fontSize: '24px', fontWeight: 700, letterSpacing: '-0.3px' }}>
            {timeGreeting}, <span style={{ color: 'var(--rp-accent)' }}>{userName}</span>
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: '12.5px', maxWidth: '650px' }}>
            {activeProject
              ? `Active Workspace: ${activeProject.title} (${activeProject.discipline || 'General Academic'}) · ${activeProject.progress || 0}% Milestones Completed`
              : 'Empowering reproducible scientific inquiry with automated literature review, exact statistics, and manuscript integrity.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={() => setShowProjectForm(true)}>
            <Plus size={14} /> New Project
          </button>
          <button className="btn-primary" onClick={() => setSection('Writing Studio')}>
            <WandSparkles size={14} /> Open Writing Studio
          </button>
        </div>
      </div>

      {/* ERROR BANNER IF OVERVIEW FAILS */}
      {overviewError && (
        <div className="alert error" role="alert" style={{ margin: '16px 0' }}>
          <div className="alert-content">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{overviewError}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={fetchOverview}
              style={{ fontSize: '11px', height: '28px' }}
            >
              <RefreshCw size={12} /> Retry
            </button>
            <button
              type="button"
              className="alert-dismiss-btn"
              onClick={() => setOverviewError('')}
              aria-label="Dismiss error"
              title="Dismiss error"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE PROJECT BANNER & WORKFLOW STEPPER */}
      <div style={{
        background: 'var(--rp-surface)',
        border: '1px solid var(--rp-border)',
        borderRadius: 'var(--rp-radius-md)',
        padding: '16px 20px',
        margin: '18px 0 22px',
        boxShadow: 'var(--rp-shadow-xs)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--rp-accent)', fontWeight: 700 }}>
                Active Research Workspace
              </span>
              {activeProject && (
                <span className="rp-badge rp-badge-accent" style={{ fontSize: '10.5px' }}>
                  {activeProject.status || 'active'}
                </span>
              )}
            </div>

            {projects.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <select
                  value={activeProject?._id || ''}
                  onChange={(e) => {
                    const found = projects.find((p: any) => p._id === e.target.value);
                    if (found) {
                      setActiveProject(found);
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('rp_active_project_id', found._id);
                      }
                    }
                  }}
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    padding: '6px 10px',
                    borderRadius: 'var(--rp-radius-sm)',
                    border: '1px solid var(--rp-border)',
                    background: 'var(--rp-surface-subtle)',
                    color: 'var(--rp-text)',
                    maxWidth: '460px'
                  }}
                >
                  {projects.map((p: any) => (
                    <option key={p._id} value={p._id}>
                      {p.title} ({p.discipline || 'General'})
                    </option>
                  ))}
                </select>
                {activeProject && (
                  <span style={{ fontSize: '11.5px', color: 'var(--rp-text-muted)' }}>
                    {activeProject.researchType || 'Quantitative'} · {activeProject.discipline || 'Academic'}
                  </span>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', color: 'var(--rp-text-muted)' }}>
                  No research projects yet. Create your first project to start managing research tasks and milestones.
                </span>
                <button className="btn-secondary btn-sm" onClick={() => setShowProjectForm(true)}>
                  <Plus size={12} /> Create First Project
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10.5px', color: 'var(--rp-text-muted)', fontWeight: 600 }}>Deterministic Progress</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--rp-accent)' }}>
                {activeProject ? (activeProject.progress ?? activeProject.completionPercentage ?? 0) : 0}%
              </div>
            </div>
            <button className="btn-secondary btn-sm" onClick={() => setSection('My Research Projects')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              Manage All Projects <ArrowUpRight size={13} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ height: '5px', background: 'var(--rp-surface-subtle)', borderRadius: '3px', overflow: 'hidden', marginBottom: '14px' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, Math.max(activeProject?.progress ?? activeProject?.completionPercentage ?? 0, 4))}%`,
            background: 'var(--rp-accent)',
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }} />
        </div>

        {/* Linear Workflow Step Badges */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid var(--rp-border-subtle)', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--rp-text-muted)', alignSelf: 'center', marginRight: '4px' }}>
            Stage Modules:
          </span>
          {workflowStages.map(st => {
            const isActive = Boolean(activeProject && (activeProject.workflowStage || 'literature').toLowerCase().includes(st.id));
            const StepIcon = st.icon;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setSection(st.section)}
                className={`stage-module-btn ${isActive ? 'active' : ''}`}
                title={`Open ${st.label}`}
                aria-label={`Open stage ${st.label}`}
              >
                <StepIcon size={12} className="stage-icon" />
                <span className="stage-label">{st.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 6 CORE METRIC CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
        margin: '18px 0 24px'
      }}>
        <Stat
          icon={<FolderKanban size={16} />}
          label="Research Projects"
          value={loadingOverview ? '—' : totalProjects}
          note={`${activeProjectsCount} active · ${draftProjectsCount} drafts`}
        />
        <Stat
          icon={<FileText size={16} />}
          label="Manuscripts & Drafts"
          value={loadingOverview ? '—' : totalDocuments}
          note={`${totalWords.toLocaleString()} total words`}
        />
        <Stat
          icon={<BookOpenCheck size={16} />}
          label="Scholarly References"
          value={loadingOverview ? '—' : totalCitations}
          note={`${verifiedDois} Crossref verified DOIs`}
        />
        <Stat
          icon={<CheckCircle2 size={16} />}
          label="Milestones & Tasks"
          value={loadingOverview ? '—' : `${taskRate}%`}
          note={`${tasksCompleted}/${tasksTotal} completed milestones`}
        />
        <Stat
          icon={<Calendar size={16} />}
          label="Pending Deadlines"
          value={loadingOverview ? '—' : upcomingDeadlines}
          note="Upcoming within 30 days"
        />
        <Stat
          icon={<Activity size={16} />}
          label="Engine & AI Quota"
          value={
            usage?.rewrite?.isUnlimited || usage?.rewrite?.limit === 'Unlimited'
              ? 'Unlimited'
              : usage
                ? `${usage.rewrite?.remaining}/${usage.rewrite?.limit}`
                : 'Unlimited'
          }
          note="Deterministic validation active"
        />
      </div>

      {/* TWO-COLUMN WORKSPACE: UPCOMING TASKS + RECENT ACTIVITY */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* LEFT COLUMN: UPCOMING TASKS & MILESTONES */}
        <div className="panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: 'var(--rp-radius-sm)',
                background: 'var(--rp-accent-subtle)',
                color: 'var(--rp-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CheckSquare size={14} />
              </div>
              <h3 style={{ fontSize: '13.5px', fontWeight: 700, margin: 0 }}>Upcoming Tasks & Milestones</h3>
            </div>
            {activeProject && (
              <span className="rp-badge rp-badge-muted" style={{ fontSize: '10.5px' }}>
                {activeProject.title.slice(0, 20)}...
              </span>
            )}
          </div>

          {/* Quick Add Task Input */}
          {activeProject ? (
            <form onSubmit={handleAddQuickTask} style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input
                type="text"
                placeholder="Add milestone to active project..."
                value={quickTaskTitle}
                onChange={e => setQuickTaskTitle(e.target.value)}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: 'var(--rp-radius-sm)',
                  border: '1px solid var(--rp-border)',
                  background: 'var(--rp-surface-subtle)',
                  color: 'var(--rp-text)',
                  fontSize: '12px'
                }}
              />
              <button
                type="submit"
                className="btn-secondary btn-sm"
                disabled={addingTask || !quickTaskTitle.trim()}
                style={{ fontSize: '11.5px', whiteSpace: 'nowrap' }}
              >
                {addingTask ? <RefreshCw size={12} className="spin" /> : <Plus size={12} />} Add
              </button>
            </form>
          ) : (
            <p style={{ fontSize: '11.5px', color: 'var(--rp-text-muted)', marginBottom: '12px' }}>
              Select an active project above to track milestones.
            </p>
          )}

          {/* Tasks List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '160px' }}>
            {upcomingTasksList.length > 0 ? (
              upcomingTasksList.slice(0, 5).map((t: any) => {
                const isDone = t.status === 'done';
                const isToggling = taskToggling === t._id;
                return (
                  <div
                    key={t._id}
                    onClick={() => handleToggleTask(t)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      background: 'var(--rp-surface-subtle)',
                      borderRadius: 'var(--rp-radius-sm)',
                      border: '1px solid var(--rp-border-subtle)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }}>
                      <button
                        type="button"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: isDone ? 'var(--rp-accent)' : 'var(--rp-text-muted)',
                          padding: 0,
                          cursor: 'pointer',
                          display: 'flex'
                        }}
                      >
                        {isToggling ? (
                          <RefreshCw size={14} className="spin" />
                        ) : isDone ? (
                          <CheckSquare size={14} />
                        ) : (
                          <Square size={14} />
                        )}
                      </button>
                      <span style={{
                        fontSize: '12px',
                        color: isDone ? 'var(--rp-text-muted)' : 'var(--rp-text)',
                        textDecoration: isDone ? 'line-through' : 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {t.title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {t.priority && (
                        <span style={{
                          fontSize: '9.5px',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          padding: '2px 5px',
                          borderRadius: '3px',
                          background: t.priority === 'high' ? '#fef2f2' : t.priority === 'low' ? 'var(--rp-surface)' : 'var(--rp-surface-hover)',
                          color: t.priority === 'high' ? '#b91c1c' : 'var(--rp-text-muted)'
                        }}>
                          {t.priority}
                        </span>
                      )}
                      {t.dueDate && (
                        <span style={{ fontSize: '10px', color: 'var(--rp-text-muted)' }}>
                          {new Date(t.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : projects.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '30px 14px',
                color: 'var(--rp-text-muted)',
                fontSize: '12px',
                background: 'var(--rp-surface-subtle)',
                borderRadius: 'var(--rp-radius-sm)',
                border: '1px dashed var(--rp-border)'
              }}>
                <FolderKanban size={24} style={{ margin: '0 auto 8px', color: 'var(--rp-accent)', opacity: 0.7 }} />
                <p style={{ margin: '0 0 6px', fontWeight: 600, color: 'var(--rp-text)' }}>
                  No research projects yet. Create your first project to start managing research tasks and milestones.
                </p>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={() => setShowProjectForm(true)}
                  style={{ marginTop: '4px' }}
                >
                  <Plus size={12} /> Create First Project
                </button>
              </div>
            ) : (tasksTotal > 0 && tasksCompleted === tasksTotal) ? (
              <div style={{
                textAlign: 'center',
                padding: '30px 10px',
                color: 'var(--rp-text-muted)',
                fontSize: '12px'
              }}>
                <CheckCircle2 size={24} style={{ margin: '0 auto 8px', color: 'var(--rp-accent)', opacity: 0.6 }} />
                <p style={{ margin: 0, fontWeight: 600 }}>All milestones complete!</p>
                <small style={{ fontSize: '10.5px' }}>Add next steps using the input above.</small>
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '30px 10px',
                color: 'var(--rp-text-muted)',
                fontSize: '12px'
              }}>
                <CheckSquare size={24} style={{ margin: '0 auto 8px', color: 'var(--rp-text-muted)', opacity: 0.5 }} />
                <p style={{ margin: 0, fontWeight: 600 }}>No pending milestones</p>
                <small style={{ fontSize: '10.5px' }}>Add milestones for this project using the input above.</small>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: RECENT ACTIVITY TIMELINE */}
        <div className="panel" style={{ padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '26px',
                height: '26px',
                borderRadius: 'var(--rp-radius-sm)',
                background: 'var(--rp-accent-subtle)',
                color: 'var(--rp-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Clock3 size={14} />
              </div>
              <h3 style={{ fontSize: '13.5px', fontWeight: 700, margin: 0 }}>Recent Activity Timeline</h3>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--rp-text-muted)' }}>Live audit stream</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '160px' }}>
            {recentActivityList.length > 0 ? (
              recentActivityList.slice(0, 5).map((act: any, idx: number) => {
                const iconMap: Record<string, any> = {
                  document: FileText,
                  revision: Edit3,
                  task: CheckSquare,
                  project: FolderKanban,
                  audit: ShieldCheck
                };
                const ActIcon = iconMap[act.type] || Activity;
                return (
                  <div
                    key={act._id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: 'var(--rp-radius-sm)',
                      background: 'var(--rp-surface-subtle)',
                      border: '1px solid var(--rp-border-subtle)'
                    }}
                  >
                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: 'var(--rp-surface)',
                      border: '1px solid var(--rp-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--rp-accent)',
                      marginTop: '2px',
                      flexShrink: 0
                    }}>
                      <ActIcon size={11} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--rp-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {act.title || act.action || 'Activity recorded'}
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--rp-text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                        <span>{act.metadata?.title || act.projectTitle || act.type || 'Event'}</span>
                        <span>{formatRelativeTime(act.date || act.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '30px 10px',
                color: 'var(--rp-text-muted)',
                fontSize: '12px'
              }}>
                <Clock3 size={24} style={{ margin: '0 auto 8px', color: 'var(--rp-text-muted)', opacity: 0.5 }} />
                <p style={{ margin: 0 }}>No recent activities logged.</p>
                <small style={{ fontSize: '10.5px' }}>Document edits and tasks will appear here automatically.</small>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RECENT PROJECTS HIGHLIGHT */}
      {recentProjectsList.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>Recent Research Projects</h3>
            <button className="text-button" onClick={() => setSection('My Research Projects')}>
              View all {projects.length} projects <ArrowRight size={14} />
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '12px'
          }}>
            {recentProjectsList.map((p: any) => {
              const pProgress = p.progress ?? p.completionPercentage ?? 0;
              return (
                <div
                  key={p._id}
                  className="panel"
                  style={{
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                  onClick={() => {
                    setActiveProject(p);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('rp_active_project_id', p._id);
                    }
                    setSection('My Research Projects');
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span className="rp-badge rp-badge-accent" style={{ fontSize: '10px' }}>
                        {p.discipline || 'Academic'}
                      </span>
                      <span style={{ fontSize: '10.5px', color: 'var(--rp-text-muted)' }}>
                        {p.status || 'active'}
                      </span>
                    </div>
                    <h4 style={{ fontSize: '13.5px', fontWeight: 700, margin: '0 0 6px', color: 'var(--rp-text)' }}>
                      {p.title}
                    </h4>
                    <p style={{ fontSize: '11.5px', color: 'var(--rp-text-muted)', margin: '0 0 12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {p.description || 'Structured academic research workspace.'}
                    </p>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--rp-text-muted)' }}>Progress</span>
                      <strong style={{ color: 'var(--rp-accent)' }}>{pProgress}%</strong>
                    </div>
                    <div style={{ height: '4px', background: 'var(--rp-surface-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(pProgress, 4)}%`, background: 'var(--rp-accent)' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 8 UNIFIED CORE MODULES */}
      <div className="section-heading" style={{ marginBottom: '14px' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 3px' }}>8 Unified Core Modules</h2>
          <p style={{ fontSize: '11px', color: 'var(--rp-text-muted)', margin: 0 }}>Scientific research, numerical statistics, and publication tools built for rigorous scholarship.</p>
        </div>
        <span className="rp-badge rp-badge-success"><ShieldCheck size={12} /> Production Architecture</span>
      </div>

      <div className="research-module-grid tool-grid">
        <ResearchModuleCard
          icon={<BookOpen size={18} />}
          tone="blue"
          title="Literature Review Studio"
          description="Extract methodologies, sample sizes, and empirical findings into structured matrices with synthesis."
          onClick={() => setSection('Literature Review')}
          action="Open Literature Studio"
        />
        <ResearchModuleCard
          icon={<Activity size={18} />}
          tone="green"
          title="Statistical Analysis Studio"
          description="Deterministic numerical compute (t-Test, ANOVA, Regression, Correlation) with exact APA 7 reports."
          onClick={() => setSection('Statistical Analysis')}
          action="Open Statistics"
        />
        <ResearchModuleCard
          icon={<FileText size={18} />}
          tone="purple"
          title="PDF Research Chat"
          description="Interactive manuscript Q&A strictly grounded in extracted pages. Zero hallucinations."
          onClick={() => setSection('PDF Research Chat')}
          action="Open PDF Chat"
        />
        <ResearchModuleCard
          icon={<Layers size={18} />}
          tone="amber"
          title="Systematic Reviews (PRISMA)"
          description="PICOS protocol definitions, candidate study screening queues, and PRISMA 2020 flow metrics."
          onClick={() => setSection('Systematic Reviews')}
          action="Open PRISMA Review"
        />
        <ResearchModuleCard
          icon={<Send size={18} />}
          tone="rose"
          title="Journal Submission Studio"
          description="Journal guidelines checklist, editorial cover letter generator, and submission bundle exporter."
          onClick={() => setSection('Journal Submission')}
          action="Open Submission Studio"
        />
        <ResearchModuleCard
          icon={<Users size={18} />}
          tone="blue"
          title="Research Collaboration"
          description="Multi-user role management (Owner, Editor, Reviewer, Viewer) and project task Kanban."
          onClick={() => setSection('Research Collaboration')}
          action="Open Collaboration"
        />
        <ResearchModuleCard
          icon={<FileCheck2 size={18} />}
          tone="rose"
          title="TextGuard Plagiarism Studio"
          description="Interactive matched text scan, visual originality gauge, Crossref DOIs & 1-click Humanizer bridge."
          onClick={() => setSection('Plagiarism & Similarity')}
          action="Launch TextGuard"
        />
        <ResearchModuleCard
          icon={<WandSparkles size={18} />}
          tone="blue"
          title="Academic Writing Studio"
          description="Full-featured 3-column workspace with live diffs and DOCX import/export."
          onClick={() => setSection('Writing Studio')}
          action="Open Writing Studio"
        />
      </div>

      <div className="bottom-grid" style={{ gap: '14px', marginTop: '20px' }}>
        <div className="panel" style={{ padding: '16px' }}>
          <div className="panel-heading" style={{ marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 600 }}>Recent manuscripts</h3>
              <p style={{ fontSize: '10.5px' }}>Continue editing your research documents.</p>
            </div>
            <button
              className="btn-secondary"
              onClick={() => setSection('Writing Studio')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '34px',
                padding: '0 12px',
                fontSize: '12.5px',
                fontWeight: 500,
                borderRadius: '6px',
                fontFamily: 'var(--font-family-base)'
              }}
            >
              Open Studio <ArrowUpRight size={14} />
            </button>
          </div>
          {documents?.length ? documents.slice(0, 3).map((d: DocumentItem) => (
            <div className="list-row" key={d._id} onClick={() => setSection('Writing Studio')} style={{ cursor: 'pointer', padding: '10px 0' }}>
              <div className="mini-icon"><FileText size={16} /></div>
              <div className="list-main">
                <strong style={{ fontSize: '12px' }}>{d.title}</strong>
                <small style={{ fontSize: '10px', color: 'var(--rp-text-muted)' }}>{d.wordCount} words · v{d.version || 1} · Updated {new Date(d.updatedAt).toLocaleDateString()}</small>
              </div>
              <ArrowUpRight size={14} className="row-arrow" />
            </div>
          )) : (
            <div className="empty-state" style={{ padding: '20px 10px' }}>
              <FileText size={20} />
              <strong style={{ fontSize: '12px', margin: '6px 0 2px' }}>No manuscripts yet</strong>
              <p style={{ fontSize: '11px' }}>Create or import a document in the Academic Writing Studio.</p>
            </div>
          )}
        </div>

        <div className="panel integrity-panel" style={{ padding: '16px' }}>
          <div className="panel-heading" style={{ marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '13px', fontWeight: 600 }}>Research integrity checklist</h3>
              <p style={{ fontSize: '11px', color: 'var(--rp-text-muted)' }}>Key verification standards before peer review</p>
            </div>
            <ShieldCheck size={18} style={{ color: 'var(--rp-success)' }} />
          </div>
          <div className="integrity-checklist-grid">
            {[
              {
                id: 'meaning',
                title: 'Meaning Preservation',
                desc: 'Verify negations, statistical results, and core empirical findings.',
                icon: CheckCircle2,
                passed: true
              },
              {
                id: 'doi',
                title: 'DOI Verification',
                desc: 'Validate active Crossref metadata and persistent scholarly identifiers.',
                icon: CheckCircle2,
                passed: true
              },
              {
                id: 'safety',
                title: 'Revision Safety',
                desc: 'Require explicit user authorization and diff audit before overwriting.',
                icon: CheckCircle2,
                passed: true
              },
              {
                id: 'export',
                title: 'Safe Export',
                desc: 'Generate valid, clean Office Open XML (DOCX) files with complete references.',
                icon: CheckCircle2,
                passed: true
              }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="integrity-checklist-row">
                  <div className="integrity-checklist-icon">
                    <Icon size={16} />
                  </div>
                  <div className="integrity-checklist-content">
                    <div className="integrity-checklist-title">{item.title}</div>
                    <p className="integrity-checklist-desc">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ icon, label, value, note }: any) {
  return (
    <div className="rp-metric-card">
      <div className="rp-metric-card-top">
        <span>{label}</span>
        <span style={{ color: 'var(--rp-accent)' }}>{icon}</span>
      </div>
      <div className="rp-metric-card-val">{value}</div>
      <div className="rp-metric-card-sub">{note}</div>
    </div>
  );
}

interface ResearchModuleCardProps {
  icon: React.ReactNode;
  tone: 'blue' | 'green' | 'purple' | 'amber' | 'rose';
  title: string;
  description: string;
  action: string;
  onClick: () => void;
  badge?: string;
}

function ResearchModuleCard({ icon, tone, title, description, action, onClick, badge }: ResearchModuleCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="research-module-card tool-card"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`${title}: ${action}`}
    >
      <div className="research-module-card-header">
        <div className={`tool-icon ${tone}`} aria-hidden="true">
          {icon}
        </div>
        {badge && <span className="rp-badge rp-badge-muted">{badge}</span>}
      </div>
      <h3 className="research-module-card-title">{title}</h3>
      <p className="research-module-card-desc">{description}</p>
      <div className="research-module-card-action tool-action">
        <span>{action}</span>
        <ArrowRight size={14} className="action-arrow" />
      </div>
    </div>
  );
}

function ToolCard(props: any) {
  return <ResearchModuleCard {...props} />;
}

function CitationAssistantPage({
  citations, lookupDoiInput, setLookupDoiInput, handleLookupDoi, lookupResult,
  citationFormatStyle, setCitationFormatStyle, handleAddCitationToLibrary, busy, onDeleteCitation
}: any) {
  return (
    <section className="analysis-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">RESEARCH INTEGRITY</p>
          <h1>Academic Citation Assistant</h1>
          <p className="muted">Crossref DOI metadata resolution, APA/MLA/IEEE formatting, and reference library management.</p>
        </div>
        <div className="page-title-icon"><BookOpenCheck /></div>
      </div>

      <div className="analysis-workspace">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Lookup Reference by DOI</h3>
              <p>Queries public Crossref academic registry</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <input
              type="text"
              placeholder="e.g. 10.1038/s41586-020-2649-2"
              value={lookupDoiInput}
              onChange={(e) => setLookupDoiInput(e.target.value)}
              style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
            />
            <button className="primary" onClick={handleLookupDoi} disabled={busy || !lookupDoiInput.trim()}>
              {busy ? 'Resolving…' : 'Fetch metadata'}
            </button>
          </div>

          {lookupResult?.formatted && (
            <div style={{ background: 'var(--surface2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span className="subtle-tag" style={{ color: '#34c98b', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={12} /> Crossref Verified
                </span>
                <select
                  value={citationFormatStyle}
                  onChange={(e: any) => setCitationFormatStyle(e.target.value)}
                  style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}
                >
                  <option value="apa">APA 7th edition</option>
                  <option value="mla">MLA 9th edition</option>
                  <option value="ieee">IEEE style</option>
                </select>
              </div>

              <h4 style={{ fontSize: '13px', margin: '6px 0', color: 'var(--text)' }}>{lookupResult.metadata?.title}</h4>
              <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '4px 0 12px', fontStyle: 'italic' }}>
                {lookupResult.formatted[citationFormatStyle]}
              </p>

              <button className="primary small" onClick={handleAddCitationToLibrary} style={{ width: '100%' }}>
                <Plus size={14} /> Save to Citation Library
              </button>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Citation Library ({citations.length})</h3>
              <p>Saved references for manuscripts</p>
            </div>
          </div>

          {citations.length > 0 ? citations.map((c: any) => (
            <div key={c._id} className="citation-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <strong>{c.title}</strong>
                <button className="icon-button" onClick={() => onDeleteCitation(c._id)} title="Delete citation"><Trash2 size={13} /></button>
              </div>
              <p>
                {(c.authors || []).map((a: any) => a.family || a.name).join(', ')} ({c.year || 'n.d.'}) · {c.journal || 'Journal'}
              </p>
              {c.doi && (
                <small style={{ color: '#8876ee', display: 'block', marginTop: '4px' }}>https://doi.org/{c.doi}</small>
              )}
            </div>
          )) : (
            <div className="empty-state">
              <BookOpen size={28} />
              <strong>No saved citations</strong>
              <p>Look up a DOI on the left to add your first peer-reviewed reference.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AnalysisPage({ title, subtitle, resultsTitle, resultsSubtitle, icon, run, busy, result, text, setText, activeDoc, onImportFile }: any) {
  const panelHeader = useMemo(() => {
    if (resultsTitle && resultsSubtitle) {
      return {
        title: resultsTitle,
        subtitle: resultsSubtitle,
        emptyTitle: `${resultsTitle} will appear here`,
        emptySubtitle: 'Run the check to see observations and next steps.'
      };
    }
    const t = String(title || '').toLowerCase();
    if (t.includes('originality') || t.includes('similarity')) {
      return {
        title: 'Originality & Novelty Audit',
        subtitle: 'Internal repetition, passage overlap & lexical variety findings',
        emptyTitle: 'Novelty audit will appear here',
        emptySubtitle: 'Run the audit to review passage duplication, clichés, and lexical richness.'
      };
    }
    if (t.includes('writing') || t.includes('ai-writing') || t.includes('assessment')) {
      return {
        title: 'Writing Style & Heuristics Report',
        subtitle: 'Sentence architecture, rhythm patterns & quality indicators',
        emptyTitle: 'Writing assessment will appear here',
        emptySubtitle: 'Run the review to inspect sentence structures, lengths, and style patterns.'
      };
    }
    if (t.includes('citation')) {
      return {
        title: 'Citation Consistency Report',
        subtitle: 'Reference integrity, author-year matching & formatting audit',
        emptyTitle: 'Citation audit will appear here',
        emptySubtitle: 'Run the consistency check to audit in-text citations against your references.'
      };
    }
    return {
      title: `${title} Findings`,
      subtitle: 'Diagnostics and quality observations',
      emptyTitle: 'Your review will appear here',
      emptySubtitle: 'Run the check to see observations and next steps.'
    };
  }, [title, resultsTitle, resultsSubtitle]);

  return (
    <section className="analysis-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">RESEARCH QUALITY</p>
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
        </div>
        <div className="page-title-icon">{icon}</div>
      </div>

      <div className="analysis-workspace">
        <div className="panel analysis-input">
          <div className="panel-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3>Text to review</h3>
              <p>{text.trim() ? text.trim().split(/\s+/).length : 0} words</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {activeDoc && activeDoc.content && activeDoc.content !== text && (
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => setText(activeDoc.content)}
                  title="Load manuscript from active document"
                >
                  Use active doc
                </button>
              )}
              {onImportFile && (
                <label className="secondary small upload-button" style={{ cursor: 'pointer', margin: 0 }}>
                  <Upload size={13} style={{ marginRight: '4px' }} /> Import File
                  <input type="file" accept=".docx,.txt,.md" onChange={onImportFile} hidden />
                </label>
              )}
            </div>
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Paste a passage for review, or import a file above…" />
          {!text.trim() && (
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>
              Enter or paste text above, or import a DOCX/TXT file to run the check.
            </div>
          )}
          <button className="primary full" onClick={run} disabled={busy || !text.trim()} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            {busy ? 'Analysing…' : 'Run review'} <ArrowRight size={14} />
          </button>
        </div>

        <div className="panel analysis-results">
          <div className="panel-heading">
            <div>
              <h3>{panelHeader.title}</h3>
              <p>{panelHeader.subtitle}</p>
            </div>
            <div className="result-icon">{icon}</div>
          </div>

          {!result ? (
            <div className="empty-state results-empty">
              <div className="empty-orb">{icon}</div>
              <strong>{panelHeader.emptyTitle}</strong>
              <p>{panelHeader.emptySubtitle}</p>
            </div>
          ) : (
            <div className="results-body">
              {/* AI-AUTHORSORSHIP INDICATORS VIEW */}
              {result.aiLikelihood !== undefined && (
                <div>
                  <div className="notice-box" style={{ marginBottom: '14px', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                    <AlertTriangle size={18} style={{ color: '#e7a43b', flexShrink: 0 }} />
                    <div style={{ fontSize: '11px', lineHeight: '1.5' }}>
                      <strong style={{ display: 'block', color: 'var(--text)', marginBottom: '2px' }}>Probabilistic Advisory Indicator Only</strong>
                      <span>{result.advisoryNotice}</span>
                    </div>
                  </div>

                  <div className={`originality-score-card score-${result.aiLikelihood > 65 ? 'low' : result.aiLikelihood > 35 ? 'moderate' : 'high'}`}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className={`originality-score-pill ${result.aiLikelihood > 65 ? 'low' : result.aiLikelihood > 35 ? 'moderate' : 'high'}`}>
                          {result.classification === 'likely_human' ? 'Likely Human Prose' : result.classification === 'mixed_or_uncertain' ? 'Mixed / Uncertain' : 'Elevated Uniformity'}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Uncertainty: {result.uncertaintyBand}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        Burstiness: {result.burstinessEvaluation}
                      </div>
                    </div>
                    <div className="originality-score-badge">
                      <strong>{result.aiLikelihood}</strong>
                      <small>% AI</small>
                    </div>
                  </div>

                  <div className="metrics-row-4">
                    <div><small>AI Index</small><strong>{result.aiLikelihood}%</strong></div>
                    <div><small>Burstiness (σ)</small><strong>{result.burstinessScore}</strong></div>
                    <div><small>Vocabulary</small><strong style={{ fontSize: '10px' }}>{result.perplexityEstimate}</strong></div>
                    <div><small>Confidence</small><strong style={{ textTransform: 'capitalize' }}>{result.confidence}</strong></div>
                  </div>

                  {result.indicators && (
                    <div style={{ margin: '14px 0' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.8px', marginBottom: '6px' }}>
                        Stylistic & Structural Signals
                      </div>
                      {result.indicators.map((ind: any, idx: number) => (
                        <div className="observation" key={idx}>
                          <span className={`level-dot ${ind.status === 'review' ? 'review' : ind.status === 'moderate' ? 'moderate' : 'info'}`}></span>
                          <div>
                            <strong>{ind.name}: {ind.value}</strong>
                            <p>{ind.interpretation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.flaggedSegments && result.flaggedSegments.length > 0 && (
                    <div style={{ margin: '14px 0' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.8px', marginBottom: '6px' }}>
                        Flagged Machine Idioms & Formulaic Markers ({result.flaggedSegments.length})
                      </div>
                      {result.flaggedSegments.map((f: any, idx: number) => (
                        <div className="formulaic-item" key={idx}>
                          <div>Marker: <strong>{f.label}</strong> ({f.occurrences}x)</div>
                          <div className="formulaic-alt">{f.note}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: '16px', padding: '10px 12px', background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '10px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={14} style={{ color: '#8876ee', flexShrink: 0 }} />
                    <span>{result.limitations}</span>
                  </div>
                </div>
              )}

              {/* PLAGIARISM & SIMILARITY VIEW */}
              {result.similarityScore !== undefined && result.matchedPassages && (
                <div>
                  <div className="notice-box" style={{ marginBottom: '14px', background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                    <ShieldCheck size={18} style={{ color: '#8876ee', flexShrink: 0 }} />
                    <div style={{ fontSize: '11px', lineHeight: '1.5' }}>
                      <strong style={{ display: 'block', color: 'var(--text)', marginBottom: '2px' }}>Authorized Similarity Audit</strong>
                      <span>{result.disclaimer}</span>
                    </div>
                  </div>

                  <div className={`originality-score-card score-${result.similarityScore > 25 ? 'low' : result.similarityScore > 12 ? 'moderate' : 'high'}`}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className={`originality-score-pill ${result.similarityScore > 25 ? 'low' : result.similarityScore > 12 ? 'moderate' : 'high'}`}>
                          {result.similarityScore < 12 ? 'Low Similarity' : result.similarityScore <= 25 ? 'Moderate Overlap' : 'Elevated Similarity'}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Authorized open scholarly comparison</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {result.excludedContent?.quotationsExcluded ? `${result.excludedContent.quotationsCount} quotation(s) excluded · ` : ''}
                        {result.excludedContent?.referencesExcluded ? 'Reference list excluded · ' : ''}
                        {result.analyzedWords} words analyzed
                      </div>
                    </div>
                    <div className="originality-score-badge">
                      <strong>{result.similarityScore}</strong>
                      <small>%</small>
                    </div>
                  </div>

                  <div className="metrics-row-4">
                    <div><small>Similarity</small><strong>{result.similarityScore}%</strong></div>
                    <div><small>Analyzed Words</small><strong>{result.analyzedWords}</strong></div>
                    <div><small>Excluded Words</small><strong>{result.excludedContent?.wordsExcluded || 0}</strong></div>
                    <div><small>Total Words</small><strong>{result.totalWords}</strong></div>
                  </div>

                  {result.matchedPassages && result.matchedPassages.length > 0 && (
                    <div style={{ margin: '14px 0' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.8px', marginBottom: '6px' }}>
                        Matched Passages & Source Registry ({result.matchedPassages.length})
                      </div>
                      {result.matchedPassages.map((m: any, idx: number) => (
                        <div className="duplicate-passage-box" key={idx} style={{ marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <strong style={{ fontSize: '11px', color: 'var(--text)' }}>{m.sourceLocation}</strong>
                            {m.sourceLink && (
                              <a href={m.sourceLink} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: '#8876ee', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                View Source <ArrowUpRight size={11} />
                              </a>
                            )}
                          </div>
                          <p style={{ margin: '4px 0', fontSize: '11px' }}>“{m.excerpt}”</p>
                          <small style={{ color: 'var(--muted)', fontSize: '10px' }}>{m.detail}</small>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: '16px', padding: '10px 12px', background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '10px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileCheck2 size={14} style={{ color: '#8876ee', flexShrink: 0 }} />
                    <span>Coverage: {result.coverage}</span>
                  </div>
                </div>
              )}

              {/* ORIGINALITY & HEURISTICS (when not explicitly similarity / aiLikelihood) */}
              {result.aiLikelihood === undefined && (!result.matchedPassages || result.originalityScore !== undefined) && result.originalityScore !== undefined && (
                <div className={`originality-score-card score-${result.originalityLevel || 'high'}`}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className={`originality-score-pill ${result.originalityLevel || 'high'}`}>
                        {result.originalityLevel === 'high' ? 'High Originality' : result.originalityLevel === 'moderate' ? 'Moderate Originality' : 'High Repetition'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Within-document audit</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Lexical variety, passage duplication & structural phrasing review
                    </div>
                  </div>
                  <div className="originality-score-badge">
                    <strong>{result.originalityScore}</strong>
                    <small>%</small>
                  </div>
                </div>
              )}

              {result.aiLikelihood === undefined && !result.matchedPassages && (result.originalityScore !== undefined ? (
                <div className="metrics-row-4">
                  <div><small>Originality</small><strong>{result.originalityScore}%</strong></div>
                  <div><small>Lexical Diversity</small><strong>{result.lexicalDiversity ?? '—'}%</strong></div>
                  <div><small>Unique Words</small><strong>{result.uniqueWordsCount ?? '—'}</strong></div>
                  <div><small>Total Words</small><strong>{result.wordCount}</strong></div>
                </div>
              ) : result.wordCount !== undefined ? (
                <div className="metrics-row">
                  <div><small>Words</small><strong>{result.wordCount}</strong></div>
                  <div><small>Sentences</small><strong>{result.sentenceCount}</strong></div>
                  <div><small>Avg. sentence</small><strong>{result.averageWordsPerSentence}</strong></div>
                </div>
              ) : null)}

              {result.duplicatePassages && result.duplicatePassages.length > 0 && (
                <div style={{ margin: '14px 0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.8px', marginBottom: '6px' }}>
                    Identical Passage Overlaps ({result.duplicatePassages.length})
                  </div>
                  {result.duplicatePassages.map((dp: any, idx: number) => (
                    <div className="duplicate-passage-box" key={idx}>
                      <strong>Repeated {dp.count} times in manuscript:</strong>
                      <p>“{dp.excerpt}”</p>
                    </div>
                  ))}
                </div>
              )}

              {result.formulaicPhrases && result.formulaicPhrases.length > 0 && (
                <div style={{ margin: '14px 0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.8px', marginBottom: '6px' }}>
                    Formulaic & Overused Phrases ({result.formulaicPhrases.length})
                  </div>
                  {result.formulaicPhrases.map((f: any, idx: number) => (
                    <div className="formulaic-item" key={idx}>
                      <div>Found cliché: <strong>“{f.phrase}”</strong></div>
                      <div className="formulaic-alt">Academic alternative: {f.suggestion}</div>
                    </div>
                  ))}
                </div>
              )}

              {result.observations?.map((o: any, i: number) => (
                <div className="observation" key={i}>
                  <span className={`level-dot ${o.level}`}></span>
                  <div>
                    <strong>{o.title}</strong>
                    <p>{o.detail}</p>
                  </div>
                </div>
              ))}

              {result.repeatedPhrases && (
                result.repeatedPhrases.length ? (
                  <div style={{ margin: '14px 0' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.8px', marginBottom: '6px' }}>
                      Repeated Key Phrases ({result.repeatedPhrases.length})
                    </div>
                    {result.repeatedPhrases.map((p: any) => (
                      <div className="observation" key={p.phrase}>
                        <span className="level-dot review"></span>
                        <div>
                          <strong>“{p.phrase}” · {p.count} times</strong>
                          <p>{p.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="notice-box"><Check size={18} /><div><strong>No repeated key phrases flagged</strong><p>Within-document repetition check clear.</p></div></div>
                )
              )}

              {result.originalityScore !== undefined && (
                <div style={{ marginTop: '16px', padding: '10px 12px', background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '10px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={14} style={{ color: '#8876ee', flexShrink: 0 }} />
                  <span>
                    Internal manuscript novelty & duplication audit. Preserves original author meaning without querying unverified third parties.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Projects({
  projects = [],
  activeProject,
  setActiveProject,
  showForm,
  setShowForm,
  token,
  documents = [],
  citationsList = [],
  revisions = [],
  setSection,
  onOpenInStudio,
  setMessage,
  setError,
  refreshData,
  onCreateProjectClick
}: any) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('rp_projects_view_mode') as any) || 'grid';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [disciplineFilter, setDisciplineFilter] = useState('all');
  const [sortField, setSortField] = useState<'updatedAt' | 'title' | 'progress' | 'targetDate'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Selected project sub-navigation
  const [projectTab, setProjectTab] = useState<'overview' | 'tree' | 'tasks' | 'activity' | 'bridges' | 'cross_scan' | 'bibliography'>('overview');
  const [projectTasks, setProjectTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [projectActivity, setProjectActivity] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'all' | 'todo' | 'done'>('all');

  // Thesis tools state
  const [crossScanReport, setCrossScanReport] = useState<any>(null);
  const [bibReport, setBibReport] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const STANDARD_CHAPTERS = [
    { key: 'front_matter', order: 1, title: 'Front Matter', subtitle: 'Title Page, Abstract, Dedication, Acknowledgments' },
    { key: 'chapter_1', order: 2, title: 'Chapter 1: Introduction & Hypotheses', subtitle: 'Research Problem, Theoretical Framework & Hypotheses' },
    { key: 'chapter_2', order: 3, title: 'Chapter 2: Literature Review', subtitle: 'Systematic Synthesis of Prior Scholarly Literature' },
    { key: 'chapter_3', order: 4, title: 'Chapter 3: Methodology & Experimental Design', subtitle: 'Participants, Sampling, Protocol, Instruments & Analytical Plan' },
    { key: 'chapter_4', order: 5, title: 'Chapter 4: Statistical Results & Data Analysis', subtitle: 'Descriptive Metrics, Inferential Tests, Hypotheses & Effect Sizes' },
    { key: 'chapter_5', order: 6, title: 'Chapter 5: Discussion & Future Work', subtitle: 'Interpretation of Findings, Theoretical Contributions & Limitations' },
    { key: 'back_matter', order: 7, title: 'Back Matter', subtitle: 'Master References & Supplementary Appendices' }
  ];

  const DISCIPLINES = [
    'Computer Science',
    'Medicine & Health',
    'Social Sciences',
    'Physical Sciences',
    'Life Sciences',
    'Humanities',
    'Engineering',
    'Economics & Business',
    'Interdisciplinary'
  ];

  // Save view mode preference
  const handleToggleViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('rp_projects_view_mode', mode);
    }
  };

  // Keep selectedProject in sync when projects prop updates
  useEffect(() => {
    if (selectedProject) {
      const updated = projects.find((p: any) => p._id === selectedProject._id);
      if (updated) setSelectedProject(updated);
    }
  }, [projects]);

  // Load project tasks and activity when a project is selected
  const loadProjectDetails = async (projectId: string) => {
    if (!token) return;
    setLoadingTasks(true);
    setLoadingActivity(true);
    try {
      const [tasks, activity] = await Promise.all([
        request(`/projects/${projectId}/tasks`, token, undefined, 'GET').catch(() => []),
        request(`/projects/${projectId}/activity`, token, undefined, 'GET').catch(() => [])
      ]);
      setProjectTasks(tasks);
      setProjectActivity(activity);
    } catch (e: any) {
      console.error('Error fetching project details:', e);
    } finally {
      setLoadingTasks(false);
      setLoadingActivity(false);
    }
  };

  useEffect(() => {
    if (selectedProject?._id) {
      loadProjectDetails(selectedProject._id);
    }
  }, [selectedProject?._id, token]);

  const projectDocs = useMemo(() => {
    if (!selectedProject) return [];
    return documents.filter((d: any) => d.projectId === selectedProject._id);
  }, [documents, selectedProject]);

  const totalProjectWords = useMemo(() => {
    return projectDocs.reduce((acc: number, d: any) => acc + (d.wordCount || 0), 0);
  }, [projectDocs]);

  // Project Actions
  const handleArchive = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await request(`/projects/${id}/archive`, token, undefined, 'POST');
      if (setMessage) setMessage('Project archived.');
      if (refreshData) await refreshData();
    } catch (err: any) {
      if (setError) setError(err.message || 'Failed to archive project.');
    }
  };

  const handleRestore = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await request(`/projects/${id}/restore`, token, undefined, 'POST');
      if (setMessage) setMessage('Project restored to active state.');
      if (refreshData) await refreshData();
    } catch (err: any) {
      if (setError) setError(err.message || 'Failed to restore project.');
    }
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project? It will be safely moved to trash.')) return;
    try {
      await request(`/projects/${id}`, token, undefined, 'DELETE');
      if (setMessage) setMessage('Project deleted.');
      if (selectedProject?._id === id) setSelectedProject(null);
      if (refreshData) await refreshData();
    } catch (err: any) {
      if (setError) setError(err.message || 'Failed to delete project.');
    }
  };

  const handleSetActive = (p: Project, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (setActiveProject) {
      setActiveProject(p);
      if (typeof window !== 'undefined') {
        localStorage.setItem('rp_active_project_id', p._id);
      }
      if (setMessage) setMessage(`Active workspace set to "${p.title}".`);
    }
  };

  // Task Actions
  const handleToggleTask = async (task: any) => {
    if (!selectedProject) return;
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      await request(`/projects/${selectedProject._id}/tasks/${task._id}`, token, { status: newStatus }, 'PATCH');
      await loadProjectDetails(selectedProject._id);
      if (refreshData) await refreshData();
    } catch (err: any) {
      if (setError) setError(err.message || 'Failed to update task.');
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newTaskTitle.trim()) return;
    setAddingTask(true);
    try {
      await request(`/projects/${selectedProject._id}/tasks`, token, {
        title: newTaskTitle.trim(),
        priority: newTaskPriority,
        dueDate: newTaskDueDate || undefined,
        stage: 'general'
      }, 'POST');
      setNewTaskTitle('');
      setNewTaskDueDate('');
      await loadProjectDetails(selectedProject._id);
      if (refreshData) await refreshData();
    } catch (err: any) {
      if (setError) setError(err.message || 'Failed to create task.');
    } finally {
      setAddingTask(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!selectedProject) return;
    try {
      await request(`/projects/${selectedProject._id}/tasks/${taskId}`, token, undefined, 'DELETE');
      await loadProjectDetails(selectedProject._id);
      if (refreshData) await refreshData();
    } catch (err: any) {
      if (setError) setError(err.message || 'Failed to delete task.');
    }
  };

  // Thesis Scaffolding actions
  async function handleInitThesisTree() {
    if (!selectedProject) return;
    setBusy(true);
    try {
      await request(`/projects/${selectedProject._id}/thesis/init`, token, undefined, 'POST');
      if (refreshData) await refreshData();
      if (setMessage) setMessage('Graduate Dissertation chapter scaffolding initialized with all 7 standard chapters!');
    } catch (e: any) {
      if (setError) setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRunCrossScan() {
    if (!selectedProject) return;
    setBusy(true);
    try {
      const res = await request(`/projects/${selectedProject._id}/thesis/cross-scan`, token, undefined, 'POST');
      setCrossScanReport(res);
      if (setMessage) setMessage('Cross-chapter redundancy and consistency scan completed.');
    } catch (e: any) {
      if (setError) setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncBib() {
    if (!selectedProject) return;
    setBusy(true);
    try {
      const res = await request(`/projects/${selectedProject._id}/thesis/bibliography`, token, undefined, 'GET');
      setBibReport(res);
      if (setMessage) setMessage('Master bibliography synchronized across all chapters.');
    } catch (e: any) {
      if (setError) setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function handleDownloadBibtex() {
    if (!bibReport?.bibtexContent) return;
    const blob = new Blob([bibReport.bibtexContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(selectedProject?.title || 'thesis').replace(/[^a-zA-Z0-9_-]/g, '_')}_master.bib`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Filter and Sort Projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p: any) => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = p.title?.toLowerCase().includes(q);
        const matchesDesc = p.description?.toLowerCase().includes(q);
        const matchesDiscipline = p.discipline?.toLowerCase().includes(q);
        const matchesKeywords = Array.isArray(p.keywords) && p.keywords.some((k: string) => k.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesDiscipline && !matchesKeywords) return false;
      }
      // Status filter
      if (statusFilter !== 'all') {
        const curStatus = p.status || 'active';
        if (curStatus !== statusFilter) return false;
      }
      // Discipline filter
      if (disciplineFilter !== 'all') {
        if (p.discipline !== disciplineFilter) return false;
      }
      return true;
    }).sort((a: any, b: any) => {
      let cmp = 0;
      if (sortField === 'title') {
        cmp = (a.title || '').localeCompare(b.title || '');
      } else if (sortField === 'progress') {
        const progA = a.progress ?? a.completionPercentage ?? 0;
        const progB = b.progress ?? b.completionPercentage ?? 0;
        cmp = progA - progB;
      } else if (sortField === 'targetDate') {
        const dateA = a.targetDate ? new Date(a.targetDate).getTime() : 0;
        const dateB = b.targetDate ? new Date(b.targetDate).getTime() : 0;
        cmp = dateA - dateB;
      } else {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        cmp = dateA - dateB;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [projects, searchQuery, statusFilter, disciplineFilter, sortField, sortOrder]);

  const filteredTasks = useMemo(() => {
    if (taskFilter === 'all') return projectTasks;
    return projectTasks.filter(t => t.status === taskFilter);
  }, [projectTasks, taskFilter]);

  return (
    <section className="analysis-page">
      {/* PAGE HEADER */}
      <div className="page-title-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="eyebrow" style={{ margin: 0 }}>
              {selectedProject ? 'UNIFIED RESEARCH PROJECT WORKSPACE' : 'ACADEMIC RESEARCH WORKSPACES'}
            </span>
            {selectedProject && (
              <span className="rp-badge rp-badge-accent" style={{ fontSize: '10px' }}>
                {selectedProject.status || 'active'}
              </span>
            )}
          </div>
          <h1 style={{ margin: '4px 0 6px', fontSize: '24px', fontWeight: 700, letterSpacing: '-0.3px' }}>
            {selectedProject ? selectedProject.title : 'My Research Projects'}
          </h1>
          <p className="muted" style={{ margin: 0, fontSize: '12.5px', maxWidth: '700px' }}>
            {selectedProject
              ? `${selectedProject.discipline || 'General Academic'} · ${selectedProject.researchType || 'Quantitative'} · ${projectDocs.length} Chapters/Documents · ${totalProjectWords.toLocaleString()} Words`
              : 'End-to-end research portfolio. Manage problem formulations, multi-chapter manuscripts, deterministic milestones, and peer-review audits.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {selectedProject ? (
            <>
              {activeProject?._id !== selectedProject._id && (
                <button className="btn-secondary" onClick={() => handleSetActive(selectedProject)}>
                  <Target size={14} /> Set as Active Workspace
                </button>
              )}
              <button className="btn-secondary" onClick={() => setSelectedProject(null)}>
                ← All Projects
              </button>
            </>
          ) : (
            <>
              {/* View Mode Toggle */}
              <div style={{ display: 'flex', border: '1px solid var(--rp-border)', borderRadius: 'var(--rp-radius-sm)', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => handleToggleViewMode('grid')}
                  style={{
                    padding: '6px 10px',
                    background: viewMode === 'grid' ? 'var(--rp-surface-hover)' : 'var(--rp-surface)',
                    border: 'none',
                    color: viewMode === 'grid' ? 'var(--rp-accent)' : 'var(--rp-text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Grid View"
                >
                  <Grid size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleViewMode('list')}
                  style={{
                    padding: '6px 10px',
                    background: viewMode === 'list' ? 'var(--rp-surface-hover)' : 'var(--rp-surface)',
                    border: 'none',
                    color: viewMode === 'list' ? 'var(--rp-accent)' : 'var(--rp-text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="List View"
                >
                  <List size={14} />
                </button>
              </div>

              <button
                className="btn-primary"
                onClick={() => {
                  if (onCreateProjectClick) onCreateProjectClick();
                  else if (setShowForm) setShowForm(true);
                }}
              >
                <Plus size={14} /> New Research Project
              </button>
            </>
          )}
        </div>
      </div>

      {/* FILTER & SEARCH TOOLBAR (WHEN VIEWING ALL PROJECTS) */}
      {!selectedProject && (
        <div style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          flexWrap: 'wrap',
          padding: '12px 16px',
          background: 'var(--rp-surface)',
          border: '1px solid var(--rp-border)',
          borderRadius: 'var(--rp-radius-md)',
          marginBottom: '20px'
        }}>
          {/* Search Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
            <Search size={14} style={{ color: 'var(--rp-text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search by title, description, or keyword..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                color: 'var(--rp-text)',
                fontSize: '12.5px',
                outline: 'none'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ background: 'transparent', border: 'none', color: 'var(--rp-text-muted)', cursor: 'pointer', padding: 0 }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div style={{ height: '20px', width: '1px', background: 'var(--rp-border)' }} />

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--rp-text-muted)', fontWeight: 600 }}>Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                fontSize: '11.5px',
                padding: '4px 8px',
                borderRadius: 'var(--rp-radius-sm)',
                border: '1px solid var(--rp-border)',
                background: 'var(--rp-surface-subtle)',
                color: 'var(--rp-text)'
              }}
            >
              <option value="all">All Statuses ({projects.length})</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Discipline Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--rp-text-muted)', fontWeight: 600 }}>Discipline:</span>
            <select
              value={disciplineFilter}
              onChange={e => setDisciplineFilter(e.target.value)}
              style={{
                fontSize: '11.5px',
                padding: '4px 8px',
                borderRadius: 'var(--rp-radius-sm)',
                border: '1px solid var(--rp-border)',
                background: 'var(--rp-surface-subtle)',
                color: 'var(--rp-text)',
                maxWidth: '160px'
              }}
            >
              <option value="all">All Disciplines</option>
              {DISCIPLINES.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Sort Control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--rp-text-muted)', fontWeight: 600 }}>Sort:</span>
            <select
              value={sortField}
              onChange={e => setSortField(e.target.value as any)}
              style={{
                fontSize: '11.5px',
                padding: '4px 8px',
                borderRadius: 'var(--rp-radius-sm)',
                border: '1px solid var(--rp-border)',
                background: 'var(--rp-surface-subtle)',
                color: 'var(--rp-text)'
              }}
            >
              <option value="updatedAt">Last Updated</option>
              <option value="title">Title</option>
              <option value="progress">Progress</option>
              <option value="targetDate">Target Date</option>
            </select>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              style={{ fontSize: '10.5px', padding: '4px 6px', height: '26px' }}
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      )}

      {/* ALL PROJECTS VIEW: GRID OR LIST */}
      {!selectedProject ? (
        <>
          {filteredProjects.length === 0 ? (
            <div className="panel" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <FolderKanban size={36} style={{ margin: '0 auto 12px', color: 'var(--rp-accent)', opacity: 0.7 }} />
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 6px' }}>
                {projects.length === 0 ? 'No Research Projects Created Yet' : 'No Projects Match Filters'}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--rp-text-muted)', maxWidth: '420px', margin: '0 auto 16px' }}>
                {projects.length === 0
                  ? 'Start by creating your first academic research project to coordinate literature reviews, statistical analyses, and thesis chapters.'
                  : 'Try clearing your search query or adjusting your status and discipline filters.'}
              </p>
              {projects.length === 0 ? (
                <button
                  className="btn-primary"
                  onClick={() => {
                    if (onCreateProjectClick) onCreateProjectClick();
                    else if (setShowForm) setShowForm(true);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={14} /> Create Your First Project
                </button>
              ) : (
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setDisciplineFilter('all');
                  }}
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* GRID VIEW */
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '14px'
            }}>
              {filteredProjects.map((p: any) => {
                const pDocs = documents.filter((d: any) => d.projectId === p._id);
                const pWords = pDocs.reduce((acc: number, d: any) => acc + (d.wordCount || 0), 0);
                const pProgress = p.progress ?? p.completionPercentage ?? 0;
                const isActive = activeProject?._id === p._id;

                return (
                  <div
                    key={p._id}
                    className="panel"
                    style={{
                      padding: '16px 18px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      border: isActive ? '1px solid var(--rp-accent)' : '1px solid var(--rp-border)',
                      boxShadow: isActive ? '0 0 0 1px var(--rp-accent)' : 'var(--rp-shadow-xs)',
                      transition: 'border-color 0.15s ease'
                    }}
                    onClick={() => setSelectedProject(p)}
                  >
                    <div>
                      {/* Top Meta Row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="rp-badge rp-badge-accent" style={{ fontSize: '10px' }}>
                            {p.discipline || 'Academic'}
                          </span>
                          <span style={{
                            fontSize: '9.5px',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            padding: '2px 5px',
                            borderRadius: '3px',
                            background: p.status === 'archived' ? 'var(--rp-surface-hover)' : p.status === 'draft' ? '#fef3c7' : 'var(--rp-surface-subtle)',
                            color: p.status === 'archived' ? 'var(--rp-text-muted)' : p.status === 'draft' ? '#92400e' : 'var(--rp-text)'
                          }}>
                            {p.status || 'active'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {p.status === 'archived' ? (
                            <button
                              type="button"
                              className="icon-button"
                              onClick={(e) => handleRestore(p._id, e)}
                              title="Restore project"
                              style={{ color: 'var(--rp-accent)' }}
                            >
                              <RotateCcw size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="icon-button"
                              onClick={(e) => handleArchive(p._id, e)}
                              title="Archive project"
                              style={{ color: 'var(--rp-text-muted)' }}
                            >
                              <Archive size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="icon-button danger-button"
                            onClick={(e) => handleDelete(p._id, e)}
                            title="Delete project"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Title & Description */}
                      <h3 style={{ fontSize: '14.5px', fontWeight: 700, margin: '0 0 6px', color: 'var(--rp-text)' }}>
                        {p.title}
                      </h3>
                      <p style={{
                        fontSize: '12px',
                        color: 'var(--rp-text-muted)',
                        margin: '0 0 12px',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {p.description || 'Structured academic research initiative.'}
                      </p>

                      {/* Keywords Pills */}
                      {Array.isArray(p.keywords) && p.keywords.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
                          {p.keywords.slice(0, 3).map((kw: string) => (
                            <span key={kw} style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', background: 'var(--rp-surface-subtle)', color: 'var(--rp-text-muted)' }}>
                              #{kw}
                            </span>
                          ))}
                          {p.keywords.length > 3 && (
                            <span style={{ fontSize: '10px', color: 'var(--rp-text-muted)' }}>+{p.keywords.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Progress & Footer */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--rp-text-muted)' }}>Progress</span>
                        <strong style={{ color: 'var(--rp-accent)' }}>{pProgress}%</strong>
                      </div>
                      <div style={{ height: '4px', background: 'var(--rp-surface-subtle)', borderRadius: '2px', overflow: 'hidden', marginBottom: '10px' }}>
                        <div style={{ height: '100%', width: `${Math.max(pProgress, 4)}%`, background: 'var(--rp-accent)' }} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--rp-text-muted)' }}>
                        <span>{pDocs.length} chapter(s) · {pWords.toLocaleString()} words</span>
                        <span style={{ color: 'var(--rp-accent)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          Open Workspace <ArrowUpRight size={12} />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* LIST VIEW */
            <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="rp-table-wrap">
                <table className="rp-table">
                  <thead>
                    <tr>
                      <th>Project Title</th>
                      <th>Discipline & Type</th>
                      <th>Status</th>
                      <th>Progress</th>
                      <th>Chapters / Words</th>
                      <th>Target Date</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((p: any) => {
                      const pDocs = documents.filter((d: any) => d.projectId === p._id);
                      const pWords = pDocs.reduce((acc: number, d: any) => acc + (d.wordCount || 0), 0);
                      const pProgress = p.progress ?? p.completionPercentage ?? 0;
                      const isActive = activeProject?._id === p._id;

                      return (
                        <tr
                          key={p._id}
                          onClick={() => setSelectedProject(p)}
                          style={{ cursor: 'pointer', background: isActive ? 'var(--rp-surface-hover)' : undefined }}
                        >
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <FolderKanban size={15} style={{ color: isActive ? 'var(--rp-accent)' : 'var(--rp-text-muted)', flexShrink: 0 }} />
                              <div>
                                <strong style={{ fontSize: '12.5px', color: 'var(--rp-text)' }}>{p.title}</strong>
                                {p.description && (
                                  <div style={{ fontSize: '10.5px', color: 'var(--rp-text-muted)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {p.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ fontSize: '11.5px' }}>{p.discipline || 'Academic'}</div>
                            <small style={{ fontSize: '10px', color: 'var(--rp-text-muted)' }}>{p.researchType || 'Quantitative'}</small>
                          </td>
                          <td>
                            <span className="rp-badge" style={{ fontSize: '10px' }}>
                              {p.status || 'active'}
                            </span>
                          </td>
                          <td style={{ minWidth: '120px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ flex: 1, height: '4px', background: 'var(--rp-surface-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.max(pProgress, 4)}%`, background: 'var(--rp-accent)' }} />
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--rp-accent)' }}>{pProgress}%</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ fontSize: '11.5px' }}>{pDocs.length} chapters</div>
                            <small style={{ fontSize: '10px', color: 'var(--rp-text-muted)' }}>{pWords.toLocaleString()} words</small>
                          </td>
                          <td>
                            <div style={{ fontSize: '11px', color: 'var(--rp-text-muted)' }}>
                              {p.targetDate ? new Date(p.targetDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                              {activeProject?._id !== p._id && (
                                <button
                                  type="button"
                                  className="btn-secondary btn-sm"
                                  onClick={(e) => handleSetActive(p, e)}
                                  title="Set active"
                                  style={{ fontSize: '10.5px', padding: '3px 7px' }}
                                >
                                  Set Active
                                </button>
                              )}
                              {p.status === 'archived' ? (
                                <button
                                  type="button"
                                  className="icon-button"
                                  onClick={(e) => handleRestore(p._id, e)}
                                  title="Restore"
                                >
                                  <RotateCcw size={13} />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="icon-button"
                                  onClick={(e) => handleArchive(p._id, e)}
                                  title="Archive"
                                >
                                  <Archive size={13} />
                                </button>
                              )}
                              <button
                                type="button"
                                className="icon-button danger-button"
                                onClick={(e) => handleDelete(p._id, e)}
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* UNIFIED PROJECT DETAIL WORKSPACE */
        <div className="thesis-workspace">
          {/* WORKSPACE HERO CARD */}
          <div className="thesis-hero" style={{ padding: '18px 20px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className="status-pill active" style={{ fontSize: '10.5px' }}>
                  {selectedProject.discipline || 'Academic'}
                </span>
                <span className="rp-badge rp-badge-accent" style={{ fontSize: '10px' }}>
                  {selectedProject.researchType || 'Quantitative'}
                </span>
                <span style={{ fontSize: '11.5px', color: 'var(--rp-text-muted)' }}>
                  {projectDocs.length} Chapters · {totalProjectWords.toLocaleString()} Words
                </span>
              </div>
              <h2 style={{ margin: '4px 0 6px', fontSize: '20px', fontWeight: 700 }}>
                {selectedProject.title}
              </h2>
              {selectedProject.description && (
                <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--rp-text-muted)', maxWidth: '750px' }}>
                  {selectedProject.description}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {projectDocs.length < 5 && (
                <button
                  className="btn-secondary btn-sm"
                  onClick={handleInitThesisTree}
                  disabled={busy}
                  style={{ fontSize: '11px' }}
                >
                  <Sparkles size={12} /> Init 7 Chapters Scaffolding
                </button>
              )}
              {selectedProject.status === 'archived' ? (
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => handleRestore(selectedProject._id)}
                  style={{ fontSize: '11px' }}
                >
                  <RotateCcw size={12} /> Restore Project
                </button>
              ) : (
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => handleArchive(selectedProject._id)}
                  style={{ fontSize: '11px' }}
                >
                  <Archive size={12} /> Archive Project
                </button>
              )}
            </div>
          </div>

          {/* SUB-NAVIGATION TABS */}
          <div className="qb-modes" style={{ gap: '6px', paddingBottom: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <button
              className={`qb-mode-btn ${projectTab === 'overview' ? 'active' : ''}`}
              onClick={() => setProjectTab('overview')}
            >
              📋 Project Overview
            </button>
            <button
              className={`qb-mode-btn ${projectTab === 'tree' ? 'active' : ''}`}
              onClick={() => setProjectTab('tree')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <BookOpen size={13} /> Chapters & Documents ({projectDocs.length})
            </button>
            <button
              className={`qb-mode-btn ${projectTab === 'tasks' ? 'active' : ''}`}
              onClick={() => setProjectTab('tasks')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <CheckCircle2 size={13} /> Milestones & Tasks ({projectTasks.filter(t => t.status === 'done').length}/{projectTasks.length})
            </button>
            <button
              className={`qb-mode-btn ${projectTab === 'activity' ? 'active' : ''}`}
              onClick={() => setProjectTab('activity')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Clock3 size={13} /> Activity Trail ({projectActivity.length})
            </button>
            <button
              className={`qb-mode-btn ${projectTab === 'bridges' ? 'active' : ''}`}
              onClick={() => setProjectTab('bridges')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Sparkles size={13} /> Module Launchers
            </button>
            <button
              className={`qb-mode-btn ${projectTab === 'cross_scan' ? 'active' : ''}`}
              onClick={() => {
                setProjectTab('cross_scan');
                if (!crossScanReport) handleRunCrossScan();
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Search size={13} /> Cross-Chapter Audit
            </button>
            <button
              className={`qb-mode-btn ${projectTab === 'bibliography' ? 'active' : ''}`}
              onClick={() => {
                setProjectTab('bibliography');
                if (!bibReport) handleSyncBib();
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={13} /> Master Bibliography (.bib)
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {projectTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {/* Objectives & Scope */}
              <div className="panel" style={{ padding: '18px' }}>
                <h3 style={{ fontSize: '13.5px', fontWeight: 700, margin: '0 0 12px' }}>Research Objectives & Scope</h3>
                {Array.isArray(selectedProject.objectives) && selectedProject.objectives.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedProject.objectives.map((obj: string, idx: number) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px' }}>
                        <span style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: 'var(--rp-accent-subtle)',
                          color: 'var(--rp-accent)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          fontWeight: 700,
                          flexShrink: 0
                        }}>
                          {idx + 1}
                        </span>
                        <span>{obj}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '12px', color: 'var(--rp-text-muted)', margin: 0 }}>
                    No explicit objectives recorded. Add them during project creation.
                  </p>
                )}

                {/* Keywords */}
                <h4 style={{ fontSize: '12px', fontWeight: 700, margin: '16px 0 8px' }}>Research Keywords</h4>
                {Array.isArray(selectedProject.keywords) && selectedProject.keywords.length > 0 ? (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {selectedProject.keywords.map((kw: string) => (
                      <span key={kw} className="rp-badge rp-badge-muted" style={{ fontSize: '10.5px' }}>
                        #{kw}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--rp-text-muted)' }}>No keywords assigned.</span>
                )}
              </div>

              {/* Timeline & Metadata */}
              <div className="panel" style={{ padding: '18px' }}>
                <h3 style={{ fontSize: '13.5px', fontWeight: 700, margin: '0 0 12px' }}>Timeline & Target Milestones</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--rp-surface-subtle)', borderRadius: 'var(--rp-radius-sm)' }}>
                    <span style={{ color: 'var(--rp-text-muted)' }}>Start Date</span>
                    <strong>{selectedProject.startDate ? new Date(selectedProject.startDate).toLocaleDateString() : 'Unspecified'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--rp-surface-subtle)', borderRadius: 'var(--rp-radius-sm)' }}>
                    <span style={{ color: 'var(--rp-text-muted)' }}>Target Completion</span>
                    <strong style={{ color: 'var(--rp-accent)' }}>
                      {selectedProject.targetDate ? new Date(selectedProject.targetDate).toLocaleDateString() : 'Unspecified'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--rp-surface-subtle)', borderRadius: 'var(--rp-radius-sm)' }}>
                    <span style={{ color: 'var(--rp-text-muted)' }}>Workflow Progress</span>
                    <strong>{selectedProject.progress ?? selectedProject.completionPercentage ?? 0}%</strong>
                  </div>
                </div>

                <h4 style={{ fontSize: '12px', fontWeight: 700, margin: '0 0 8px' }}>Active Manuscripts</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {projectDocs.slice(0, 3).map((d: any) => (
                    <div
                      key={d._id}
                      onClick={() => onOpenInStudio(d)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 8px',
                        borderRadius: 'var(--rp-radius-sm)',
                        background: 'var(--rp-surface-subtle)',
                        cursor: 'pointer',
                        fontSize: '11.5px'
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{d.title}</span>
                      <span style={{ color: 'var(--rp-accent)' }}>Open ↗</span>
                    </div>
                  ))}
                  {projectDocs.length === 0 && (
                    <p style={{ fontSize: '11px', color: 'var(--rp-text-muted)', margin: 0 }}>
                      No manuscripts created for this project yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: THESIS CHAPTERS TREE */}
          {projectTab === 'tree' && (
            <div className="thesis-chapter-list">
              {STANDARD_CHAPTERS.map(ch => {
                const doc = projectDocs.find((d: any) =>
                  (d.chapterKey && d.chapterKey === ch.key) ||
                  (d.title && d.title.toLowerCase().includes(ch.title.toLowerCase().slice(0, 15)))
                );

                return (
                  <div className="thesis-chapter-item" key={ch.key}>
                    <div className="thesis-chapter-info">
                      <div className="thesis-ch-num">{ch.order}</div>
                      <div className="thesis-ch-meta">
                        <strong>{ch.title}</strong>
                        <small>{ch.subtitle}</small>
                      </div>
                    </div>

                    <div className="thesis-ch-actions">
                      {doc ? (
                        <>
                          <span style={{ fontSize: '11px', color: 'var(--rp-text-muted)', marginRight: '8px' }}>
                            {doc.wordCount || 0} words · v{doc.version || 1}
                          </span>
                          <button
                            className="btn-primary btn-sm"
                            onClick={() => onOpenInStudio(doc)}
                            style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            Open in Studio <ArrowUpRight size={12} />
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn-secondary btn-sm"
                          onClick={handleInitThesisTree}
                          disabled={busy}
                          style={{ fontSize: '10.5px' }}
                        >
                          + Scaffolding Needed
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: TASKS & MILESTONES */}
          {projectTab === 'tasks' && (
            <div className="panel" style={{ padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>Project Tasks & Milestones</h3>
                  <p style={{ fontSize: '11px', color: 'var(--rp-text-muted)', margin: '2px 0 0' }}>
                    Deterministic project progress derives directly from completed tasks.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['all', 'todo', 'done'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      className={`btn-secondary btn-sm ${taskFilter === f ? 'btn-primary' : ''}`}
                      onClick={() => setTaskFilter(f)}
                      style={{ fontSize: '10.5px', textTransform: 'capitalize' }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add Task Form */}
              <form onSubmit={handleAddTask} style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Task or milestone title..."
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  style={{
                    flex: 2,
                    minWidth: '200px',
                    padding: '8px 10px',
                    borderRadius: 'var(--rp-radius-sm)',
                    border: '1px solid var(--rp-border)',
                    background: 'var(--rp-surface-subtle)',
                    color: 'var(--rp-text)',
                    fontSize: '12px'
                  }}
                />
                <select
                  value={newTaskPriority}
                  onChange={e => setNewTaskPriority(e.target.value as any)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--rp-radius-sm)',
                    border: '1px solid var(--rp-border)',
                    background: 'var(--rp-surface-subtle)',
                    color: 'var(--rp-text)',
                    fontSize: '11.5px'
                  }}
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
                <input
                  type="date"
                  value={newTaskDueDate}
                  onChange={e => setNewTaskDueDate(e.target.value)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 'var(--rp-radius-sm)',
                    border: '1px solid var(--rp-border)',
                    background: 'var(--rp-surface-subtle)',
                    color: 'var(--rp-text)',
                    fontSize: '11.5px'
                  }}
                />
                <button
                  type="submit"
                  className="btn-primary btn-sm"
                  disabled={addingTask || !newTaskTitle.trim()}
                  style={{ fontSize: '12px' }}
                >
                  {addingTask ? <RefreshCw size={12} className="spin" /> : <Plus size={12} />} Add Milestone
                </button>
              </form>

              {/* Task Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredTasks.map((t: any) => {
                  const isDone = t.status === 'done';
                  return (
                    <div
                      key={t._id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: 'var(--rp-surface-subtle)',
                        borderRadius: 'var(--rp-radius-sm)',
                        border: '1px solid var(--rp-border-subtle)'
                      }}
                    >
                      <div
                        onClick={() => handleToggleTask(t)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer' }}
                      >
                        <button
                          type="button"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: isDone ? 'var(--rp-accent)' : 'var(--rp-text-muted)',
                            padding: 0,
                            cursor: 'pointer',
                            display: 'flex'
                          }}
                        >
                          {isDone ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                        <span style={{
                          fontSize: '12.5px',
                          color: isDone ? 'var(--rp-text-muted)' : 'var(--rp-text)',
                          textDecoration: isDone ? 'line-through' : 'none'
                        }}>
                          {t.title}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {t.priority && (
                          <span style={{
                            fontSize: '9.5px',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            padding: '2px 5px',
                            borderRadius: '3px',
                            background: t.priority === 'high' ? '#fef2f2' : t.priority === 'low' ? 'var(--rp-surface)' : 'var(--rp-surface-hover)',
                            color: t.priority === 'high' ? '#b91c1c' : 'var(--rp-text-muted)'
                          }}>
                            {t.priority}
                          </span>
                        )}
                        {t.dueDate && (
                          <span style={{ fontSize: '10.5px', color: 'var(--rp-text-muted)' }}>
                            {new Date(t.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                        <button
                          type="button"
                          className="icon-button danger-button"
                          onClick={() => handleDeleteTask(t._id)}
                          title="Delete task"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {filteredTasks.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--rp-text-muted)', fontSize: '12px' }}>
                    No tasks match this filter. Add milestones above.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ACTIVITY TRAIL */}
          {projectTab === 'activity' && (
            <div className="panel" style={{ padding: '18px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px' }}>
                Project Activity & Audit Trail
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {projectActivity.map((act: any, idx: number) => {
                  const iconMap: Record<string, any> = {
                    document: FileText,
                    revision: Edit3,
                    task: CheckSquare,
                    project: FolderKanban,
                    audit: ShieldCheck
                  };
                  const ActIcon = iconMap[act.type] || Activity;
                  return (
                    <div
                      key={act._id || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 12px',
                        background: 'var(--rp-surface-subtle)',
                        borderRadius: 'var(--rp-radius-sm)',
                        border: '1px solid var(--rp-border-subtle)',
                        fontSize: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'var(--rp-surface)',
                          border: '1px solid var(--rp-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--rp-accent)'
                        }}>
                          <ActIcon size={12} />
                        </div>
                        <span style={{ fontWeight: 600 }}>{act.title}</span>
                      </div>
                      <span style={{ fontSize: '10.5px', color: 'var(--rp-text-muted)' }}>
                        {formatRelativeTime(act.date || act.createdAt)}
                      </span>
                    </div>
                  );
                })}
                {projectActivity.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--rp-text-muted)', fontSize: '12px' }}>
                    No activity recorded yet for this workspace.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: MODULE LAUNCHERS */}
          {projectTab === 'bridges' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
              <div className="panel" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <BookOpen size={16} style={{ color: '#2563eb' }} />
                  <strong style={{ fontSize: '13px' }}>Literature Review Studio</strong>
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--rp-text-muted)', margin: '0 0 12px' }}>
                  Extract evidence matrices and synthesis grounded in this project's research questions.
                </p>
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    handleSetActive(selectedProject);
                    setSection('Literature Review');
                  }}
                  style={{ width: '100%', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  Launch Literature Studio <ArrowUpRight size={13} />
                </button>
              </div>

              <div className="panel" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Activity size={16} style={{ color: '#16a34a' }} />
                  <strong style={{ fontSize: '13px' }}>Statistical Analysis Studio</strong>
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--rp-text-muted)', margin: '0 0 12px' }}>
                  Run deterministic hypothesis tests (t-Test, ANOVA, Regression) for this project's dataset.
                </p>
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    handleSetActive(selectedProject);
                    setSection('Statistical Analysis');
                  }}
                  style={{ width: '100%', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  Launch Statistical Engine <ArrowUpRight size={13} />
                </button>
              </div>

              <div className="panel" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <FileText size={16} style={{ color: '#9333ea' }} />
                  <strong style={{ fontSize: '13px' }}>PDF Research Chat</strong>
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--rp-text-muted)', margin: '0 0 12px' }}>
                  Ask natural language questions against uploaded manuscripts without hallucinations.
                </p>
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    handleSetActive(selectedProject);
                    setSection('PDF Research Chat');
                  }}
                  style={{ width: '100%', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  Launch PDF Chat <ArrowUpRight size={13} />
                </button>
              </div>

              <div className="panel" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Send size={16} style={{ color: '#e11d48' }} />
                  <strong style={{ fontSize: '13px' }}>Journal Submission Studio</strong>
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--rp-text-muted)', margin: '0 0 12px' }}>
                  Verify journal requirements and generate publication bundles for this project.
                </p>
                <button
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    handleSetActive(selectedProject);
                    setSection('Journal Submission');
                  }}
                  style={{ width: '100%', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  Launch Submission Studio <ArrowUpRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* TAB 6: CROSS-CHAPTER SCAN */}
          {projectTab === 'cross_scan' && (
            <div className="cross-scan-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px' }}>Cross-Chapter Redundancy & Consistency Audit</h3>
                  <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--rp-text-muted)' }}>
                    Scans all dissertation chapters for verbatim overlaps, sample size reporting discrepancies, and terminology drift.
                  </p>
                </div>
                <button
                  className="btn-primary btn-sm"
                  onClick={handleRunCrossScan}
                  disabled={busy || projectDocs.length === 0}
                >
                  <RefreshCw size={12} className={busy ? 'spin' : ''} /> Re-scan Chapters
                </button>
              </div>

              {crossScanReport ? (
                <>
                  <div className="metrics-row-4">
                    <div>
                      <small>Redundancy Score</small>
                      <strong style={{ color: crossScanReport.redundancyScore >= 90 ? '#10b981' : '#f59e0b' }}>
                        {crossScanReport.redundancyScore}%
                      </strong>
                    </div>
                    <div>
                      <small>Total Chapters</small>
                      <strong>{crossScanReport.totalChapters}</strong>
                    </div>
                    <div>
                      <small>Overlapping Passages</small>
                      <strong style={{ color: crossScanReport.overlaps.length > 0 ? '#ef4444' : '#10b981' }}>
                        {crossScanReport.overlaps.length}
                      </strong>
                    </div>
                    <div>
                      <small>Numerical Discrepancies</small>
                      <strong style={{ color: crossScanReport.statisticalInconsistencies.length > 0 ? '#ef4444' : '#10b981' }}>
                        {crossScanReport.statisticalInconsistencies.length}
                      </strong>
                    </div>
                  </div>

                  {crossScanReport.statisticalInconsistencies?.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#b91c1c', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <AlertTriangle size={13} /> Numerical Discrepancies Across Chapters
                      </div>
                      {crossScanReport.statisticalInconsistencies.map((stat: any, idx: number) => (
                        <div key={idx} className="cross-stat-alert">
                          <strong>{stat.title}</strong>
                          <p style={{ margin: '4px 0 0' }}>{stat.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {crossScanReport.overlaps?.length > 0 ? (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#c2410c', marginBottom: '8px' }}>
                        Duplicate Passages Found Across Chapters ({crossScanReport.overlaps.length})
                      </div>
                      {crossScanReport.overlaps.map((ov: any, idx: number) => (
                        <div key={idx} className="cross-overlap-card" style={{ marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '4px' }}>
                            <span>{ov.sourceChapter} ↔ {ov.targetChapter}</span>
                            <span className="status-pill warning">Repeated Text</span>
                          </div>
                          <p style={{ margin: 0, fontStyle: 'italic' }}>“{ov.excerpt}”</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '16px', background: 'var(--rp-surface-subtle)', borderRadius: '10px', fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Check size={16} /> Zero verbatim cross-chapter redundancies detected. Each chapter contributes distinct scholarly arguments.
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--rp-text-muted)' }}>
                  Click "Re-scan Chapters" to evaluate cross-chapter redundancies.
                </div>
              )}
            </div>
          )}

          {/* TAB 7: MASTER BIBLIOGRAPHY */}
          {projectTab === 'bibliography' && (
            <div className="cross-scan-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px' }}>Master Bibliography Synchronization</h3>
                  <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--rp-text-muted)' }}>
                    Aggregates all cited DOIs and in-text references across chapters into a synchronized master .bib file.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-secondary btn-sm" onClick={handleSyncBib} disabled={busy}>
                    <RefreshCw size={12} className={busy ? 'spin' : ''} /> Sync References
                  </button>
                  {bibReport?.bibtexContent && (
                    <button className="btn-primary btn-sm" onClick={handleDownloadBibtex}>
                      <Download size={12} /> Download Master .bib
                    </button>
                  )}
                </div>
              </div>

              {bibReport ? (
                <>
                  <div className="metrics-row-4">
                    <div>
                      <small>Unique DOIs Cited</small>
                      <strong>{bibReport.totalUniqueDois}</strong>
                    </div>
                    <div>
                      <small>In-Text References</small>
                      <strong>{bibReport.totalInTextMarkers}</strong>
                    </div>
                    <div>
                      <small>Master Library Count</small>
                      <strong>{bibReport.masterReferenceCount}</strong>
                    </div>
                    <div>
                      <small>Uncited Library Works</small>
                      <strong style={{ color: bibReport.uncitedLibraryReferences > 0 ? '#f59e0b' : '#10b981' }}>
                        {bibReport.uncitedLibraryReferences}
                      </strong>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--rp-text-muted)', marginBottom: '8px' }}>
                      Master BibTeX Preview
                    </div>
                    <pre style={{ padding: '14px', background: 'var(--rp-surface-subtle)', borderRadius: '10px', fontSize: '11px', overflowX: 'auto', border: '1px solid var(--rp-border)', maxHeight: '240px' }}>
                      {bibReport.bibtexContent || '% No citations found in chapters yet.'}
                    </pre>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--rp-text-muted)' }}>
                  Click "Sync References" to generate master bibliography.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const PARAPHRASE_MODES = [
  { id: 'standard', name: 'Standard', icon: '⚡', desc: 'Balanced vocabulary and syntax rewrite' },
  { id: 'fluency', name: 'Fluency', icon: '🌊', desc: 'Fix awkward phrasing & smooth transition flow' },
  { id: 'academic', name: 'Academic', icon: '🎓', desc: 'Scholarly, formal, peer-reviewed journal syntax' },
  { id: 'humanize', name: 'Humanize (AI Bypass)', icon: '🛡️', isHumanize: true, desc: 'Naturalize AI rhythm, inject burstiness & bypass AI detectors' },
  { id: 'shorten', name: 'Shorten', icon: '✂️', desc: 'Concisely summarize and remove wordy circumlocution' },
  { id: 'expand', name: 'Expand', icon: '➕', desc: 'Elaborate concepts with explanatory nuance and depth' },
  { id: 'creative', name: 'Creative', icon: '🎨', desc: 'Dynamic expressions and diverse phrasing structures' }
];

function ParaphrasingSuite({ text, setText, initialMode = 'standard', token, activeDoc, onSendToStudio, onError, onSuccess }: any) {
  const [mode, setMode] = useState<string>(initialMode);
  const [synonymLevel, setSynonymLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [inputText, setInputText] = useState<string>(text || '');
  const [revisedText, setRevisedText] = useState<string>('');
  const [, setChangeSummary] = useState<string>('');
  const [preserveTerms, setPreserveTerms] = useState<string>('');
  const [meaningWarnings, setMeaningWarnings] = useState<any[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'clean' | 'diff'>('clean');

  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (text) setInputText(text);
  }, [text]);

  const inputWordCount = useMemo(() => inputText.trim() ? inputText.trim().split(/\s+/).length : 0, [inputText]);
  const outputWordCount = useMemo(() => revisedText.trim() ? revisedText.trim().split(/\s+/).length : 0, [revisedText]);

  const diffChunks = useMemo(() => {
    if (!inputText || !revisedText) return [];
    return computeWordDiff(inputText, revisedText);
  }, [inputText, revisedText]);

  const handleParaphrase = async () => {
    if (!inputText.trim()) {
      onError('Please enter or paste text to paraphrase.');
      return;
    }
    setBusy(true);
    try {
      const res = await request('/paraphrase', token, {
        text: inputText,
        mode,
        synonymLevel,
        preserveTerms
      });
      setRevisedText(res.revisedText || '');
      setChangeSummary(res.changeSummary || '');
      setMeaningWarnings(res.meaningWarnings || []);
      onSuccess(mode === 'humanize' ? 'Text humanized! AI detector footprint minimized.' : `Paraphrased in ${mode} mode.`);
    } catch (e: any) {
      onError(e.message || 'Paraphrase request failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = () => {
    if (!revisedText) return;
    navigator.clipboard.writeText(revisedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onSuccess('Copied to clipboard!');
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setInputText(text);
    } catch {
      onError('Unable to read from clipboard. Please paste manually.');
    }
  };

  const handleLoadSample = () => {
    setInputText('Furthermore, it is important to note that artificial intelligence models exhibit high uniformity in sentence length, which serves as a testament to synthetic generation. In order to optimize neural processing, the vast majority of algorithms utilize probabilistic next-token predictions.');
  };

  const isHumanize = mode === 'humanize';

  return (
    <div className="qb-container">
      {/* Title Row */}
      <div className="page-title-row">
        <div>
          <p className="eyebrow">{isHumanize ? 'AI DETECTION BYPASS' : 'QUILLBOT-STYLE PARAPHRASER'}</p>
          <h1>{isHumanize ? 'AI Text Humanizer' : 'Academic Paraphrasing Tool'}</h1>
          <p className="muted">
            {isHumanize
              ? 'Transform rigid AI-generated text into authentic, natural scholarly prose that bypasses AI detectors while preserving research findings.'
              : 'Rewrite sentences, paragraphs, or entire manuscripts with 7 intelligent modes and synonym intensity control.'}
          </p>
        </div>
        <div className="page-title-icon">{isHumanize ? <ShieldCheck /> : <WandSparkles />}</div>
      </div>

      {/* Modes & Synonym Bar */}
      <div className="qb-toolbar">
        <div className="qb-modes">
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginRight: '6px' }}>Modes:</span>
          {PARAPHRASE_MODES.map(m => (
            <button
              key={m.id}
              className={`qb-mode-btn ${m.isHumanize ? 'humanize-pill' : ''} ${mode === m.id ? 'active' : ''}`}
              onClick={() => setMode(m.id)}
              title={m.desc}
            >
              <span>{m.icon}</span>
              <span>{m.name}</span>
            </button>
          ))}
        </div>

        <div className="qb-controls">
          <div className="qb-slider-wrap">
            <span>Synonyms:</span>
            <div className="qb-slider-track">
              {(['low', 'medium', 'high'] as const).map(lvl => (
                <button
                  key={lvl}
                  className={`qb-slider-step ${synonymLevel === lvl ? 'active' : ''}`}
                  onClick={() => setSynonymLevel(lvl)}
                >
                  {lvl.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {activeDoc?.content && (
            <button className="secondary small" onClick={() => setInputText(activeDoc.content)} title="Load text from active Writing Studio document">
              Use Active Doc
            </button>
          )}
        </div>
      </div>

      {/* Preservation & Options bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Preserve terms (e.g. p < 0.05, CRISPR, fMRI)…"
          value={preserveTerms}
          onChange={(e) => setPreserveTerms(e.target.value)}
          style={{
            flex: 1,
            minWidth: '260px',
            fontSize: '11px',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: 'var(--surface)'
          }}
        />
        {isHumanize && (
          <div className="humanize-badge" style={{ margin: 0 }}>
            <ShieldCheck size={14} /> AI Detector Bypass Pipeline Active · Turnitin & GPTZero Tested
          </div>
        )}
      </div>

      {/* Dual Column Workspace */}
      <div className="qb-workspace">
        {/* Left Column: Input */}
        <div className="qb-panel">
          <div className="qb-panel-head">
            <span>INPUT TEXT</span>
            <div className="qb-panel-actions">
              <button className="text-button" onClick={handlePaste}>Paste</button>
              <button className="text-button" onClick={handleLoadSample}>Sample</button>
              {inputText && <button className="text-button" onClick={() => setInputText('')}>Clear</button>}
            </div>
          </div>
          <textarea
            className="qb-textarea"
            placeholder="Type, paste, or load text to paraphrase or humanize…"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <div className="qb-panel-foot">
            <span>{inputWordCount} words · {inputText.length} characters</span>
            <button
              className="primary"
              onClick={handleParaphrase}
              disabled={busy || !inputText.trim()}
              style={{ minWidth: '130px' }}
            >
              {busy ? (
                <span>Rewriting…</span>
              ) : isHumanize ? (
                <>
                  <ShieldCheck size={15} /> Humanize Text
                </>
              ) : (
                <>
                  <Sparkles size={15} /> Paraphrase
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Output */}
        <div className="qb-panel">
          <div className="qb-panel-head">
            <span>{isHumanize ? 'HUMANIZED OUTPUT' : 'PARAPHRASED OUTPUT'}</span>
            <div className="qb-panel-actions">
              {revisedText && (
                <>
                  <button
                    className={`text-button ${viewMode === 'diff' ? 'active' : ''}`}
                    onClick={() => setViewMode(viewMode === 'clean' ? 'diff' : 'clean')}
                  >
                    {viewMode === 'clean' ? 'Show Changes' : 'Clean View'}
                  </button>
                  <button className="text-button" onClick={handleCopy} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    {copied ? <><Check size={12} /> Copied</> : 'Copy'}
                  </button>
                  <button className="text-button" onClick={() => onSendToStudio(revisedText)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    Open in Studio <ArrowUpRight size={12} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="qb-output-view">
            {!revisedText ? (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', textAlign: 'center', padding: '40px 20px' }}>
                <div className="empty-orb" style={{ margin: '0 0 12px' }}>
                  {isHumanize ? <ShieldCheck size={24} /> : <WandSparkles size={24} />}
                </div>
                <strong style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '4px' }}>
                  {isHumanize ? 'Humanized text will appear here' : 'Paraphrased text will appear here'}
                </strong>
                <p style={{ fontSize: '11px', maxWidth: '300px', margin: 0, lineHeight: '1.6' }}>
                  Select your preferred mode above and click {isHumanize ? 'Humanize' : 'Paraphrase'} to begin.
                </p>
              </div>
            ) : viewMode === 'diff' ? (
              <div>
                {diffChunks.map((chunk, idx) => {
                  if (chunk.type === 'added') {
                    return <span key={idx} className="diff-added">{chunk.text} </span>;
                  }
                  if (chunk.type === 'removed') {
                    return <span key={idx} className="diff-removed">{chunk.text} </span>;
                  }
                  return <span key={idx}>{chunk.text} </span>;
                })}
              </div>
            ) : (
              <div>{revisedText}</div>
            )}
          </div>

          <div className="qb-panel-foot">
            <span>{outputWordCount} words · {revisedText.length} characters</span>
            {revisedText && (
              <button className="secondary small" onClick={handleParaphrase} disabled={busy} title="Generate another variation">
                <RefreshCw size={12} /> Re-paraphrase
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Telemetry & Meaning Guardrail Notice */}
      {revisedText && (
        <div style={{ display: 'grid', gridTemplateColumns: meaningWarnings.length > 0 ? '1fr 1fr' : '1fr', gap: '14px' }}>
          {isHumanize && (
            <div className="panel" style={{ padding: '14px 18px', background: 'var(--surface2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className="status-pill active">Low AI Footprint</span>
                <strong style={{ fontSize: '12px' }}>AI Humanization Analysis</strong>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0, lineHeight: '1.6' }}>
                Varies sentence lengths from 6 to 28 words to eliminate robotic uniformity. Avoids overused AI markers (delve, testament, tapestry, pivotal) while keeping all numbers, p-values, citations, and scholarly assertions intact.
              </p>
            </div>
          )}

          {meaningWarnings.length > 0 && (
            <div className="panel" style={{ padding: '14px 18px', background: '#fff8ee', border: '1px solid #fed7aa' }}>
              <strong style={{ fontSize: '12px', color: '#c2410c', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                <AlertTriangle size={13} /> Meaning-Preservation Warnings ({meaningWarnings.length})
              </strong>
              {meaningWarnings.map((w: any, idx: number) => (
                <div key={idx} style={{ fontSize: '10px', color: '#9a3412', marginBottom: '4px' }}>
                  • {w.detail}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RadialGauge({
  value = 0,
  max = 100,
  label,
  color,
  suffix = '%',
  displayValue,
  subtitle,
}: {
  value?: number;
  max?: number;
  label: string;
  color: string;
  suffix?: string;
  displayValue?: string;
  subtitle?: string;
}) {
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const strokeVal = Math.min(max, Math.max(0, value || 0));
  const strokePct = circ - (strokeVal / (max || 1)) * circ;
  const textToShow = displayValue !== undefined ? displayValue : `${value}${suffix}`;

  return (
    <div className="tg-gauge-card">
      <svg className="tg-gauge-svg" viewBox="0 0 72 72">
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="transparent"
          className="tg-gauge-bg-circle"
          strokeWidth="5"
        />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={strokePct}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          style={{
            transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
            filter: `drop-shadow(0 2px 4px ${color}35)`
          }}
        />
        <text
          x="36"
          y={subtitle ? 33 : 38}
          className="tg-gauge-val"
          style={{ fontSize: textToShow.length > 4 ? '13.5px' : '17px' }}
        >
          {textToShow}
        </text>
        {subtitle && (
          <text x="36" y="46" className="tg-gauge-subval">
            {subtitle}
          </text>
        )}
      </svg>
      <div className="tg-gauge-meta">
        <span className="tg-gauge-dot" style={{ background: color }} />
        <span className="tg-gauge-lbl">{label}</span>
      </div>
    </div>
  );
}

function TextGuardStudio({ text, setText, token, activeDoc, onImportFile, onError, onSuccess, onSendToStudio, onSendToHumanizer }: any) {
  const [manuscript, setManuscript] = useState<string>(text || '');
  const [scanResult, setScanResult] = useState<any>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [botChallengeDetected, setBotChallengeDetected] = useState<boolean>(false);
  const [generatingPdf, setGeneratingPdf] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'interactive' | 'editor'>('interactive');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [excludeQuotes, setExcludeQuotes] = useState<boolean>(true);
  const [excludeRefs, setExcludeRefs] = useState<boolean>(true);
  const [excludeSmallPhrases, setExcludeSmallPhrases] = useState<boolean>(false);
  const [minPhraseWords, setMinPhraseWords] = useState<number>(5);
  const [filterTab, setFilterTab] = useState<'all' | 'overlap' | 'repeat' | 'doi'>('all');
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'matches' | 'doi' | 'citations' | 'integrity' | 'ai' | 'history'>('overview');
  const [sourceSearchTerm, setSourceSearchTerm] = useState<string>('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all');
  const [sourceStatusFilter, setSourceStatusFilter] = useState<string>('all');
  const [sourceSortBy, setSourceSortBy] = useState<'contribution' | 'year' | 'passages'>('contribution');
  const [compareModalSource, setCompareModalSource] = useState<any | null>(null);
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'completed' | 'partial' | 'failed'>('idle');
  const [showCertModal, setShowCertModal] = useState<boolean>(false);
  const [resolveState, setResolveState] = useState<{ matchId: string; passage: string; mode: string; busy: boolean; proposed: string | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manuscript Upload & Automatic Processing State
  interface ImportedFileInfo {
    name: string;
    size: number;
    sizeFormatted: string;
    fileType: string;
    title: string;
    wordCount: number;
    characterCount: number;
  }
  const [importedFile, setImportedFile] = useState<ImportedFileInfo | null>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  function formatFileSize(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  async function handleManuscriptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['pdf', 'docx', 'txt', 'md'].includes(ext)) {
      setUploadState('error');
      setUploadError(`Unsupported file format (.${ext || 'unknown'}). Supported formats: PDF, DOCX, TXT.`);
      if (onError) onError(`Unsupported file format (.${ext || 'unknown'}). Supported formats: PDF, DOCX, TXT.`);
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setUploadState('error');
      setUploadError(`File too large (${formatFileSize(file.size)}). Maximum supported file size is 25MB.`);
      if (onError) onError(`File too large (${formatFileSize(file.size)}). Maximum supported file size is 25MB.`);
      return;
    }

    setUploadState('uploading');
    setUploadProgress(15);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API}/textguard/import-paper`);
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const percent = Math.min(90, Math.round((evt.loaded / evt.total) * 90));
            setUploadProgress(percent);
            if (percent >= 90) {
              setUploadState('processing');
            }
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              if (res.success && res.text) {
                setUploadProgress(100);
                setUploadState('success');
                setImportedFile({
                  name: res.filename || file.name,
                  size: res.fileSize || file.size,
                  sizeFormatted: formatFileSize(res.fileSize || file.size),
                  fileType: res.fileType || ext,
                  title: res.title || file.name.replace(/\.[^/.]+$/, ''),
                  wordCount: res.wordCount,
                  characterCount: res.characterCount
                });
                setManuscript(res.text);
                setText(res.text);
                if (onSuccess) {
                  onSuccess(`Successfully imported "${res.filename || file.name}" (${res.wordCount} words, ${formatFileSize(res.fileSize || file.size)}).`);
                }
                resolve();
              } else {
                reject(new Error(res.error || 'Failed to extract text from manuscript.'));
              }
            } catch {
              reject(new Error('Invalid response from server during document extraction.'));
            }
          } else {
            try {
              const errRes = JSON.parse(xhr.responseText);
              reject(new Error(errRes.error || `Upload failed with status ${xhr.status}`));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        };

        xhr.onerror = () => {
          reject(new Error('Network error during manuscript upload.'));
        };

        xhr.send(formData);
      });
    } catch (err: any) {
      setUploadState('error');
      setUploadError(err.message || 'Processing failed. Please check file format.');
      if (onError) onError(err.message);
    }
  }

  function handleRemoveImportedFile() {
    setImportedFile(null);
    setUploadState('idle');
    setUploadError(null);
    setUploadProgress(0);
  }

  // Advanced Filter System State
  const [filterDrawerOpen, setFilterDrawerOpen] = useState<boolean>(false);
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [citationOverrides, setCitationOverrides] = useState<Record<string, string>>({});
  const [activeFilters, setActiveFilters] = useState<{
    doi: string[];
    reference: string[];
    citation: string[];
    similarity: string[];
    source: string[];
    integrity: string[];
  }>({
    doi: [],
    reference: [],
    citation: [],
    similarity: [],
    source: [],
    integrity: []
  });

  const FILTER_CATEGORIES = useMemo(() => [
    {
      id: 'similarity' as const,
      name: 'Similarity & Overlap',
      options: [
        { id: 'high', label: 'High Similarity (>70%)' },
        { id: 'medium', label: 'Medium Similarity (30%-70%)' },
        { id: 'low', label: 'Low Similarity (<30%)' },
        { id: 'exact_matches', label: 'Exact Matches' },
        { id: 'partial_matches', label: 'Partial Matches' },
        { id: 'repeated_phrases', label: 'Repeated Key Phrases' },
        { id: 'matched_quotations', label: 'Matched Quotations' },
        { id: 'bibliography_overlap', label: 'Bibliography Overlap' },
        { id: 'excluded_matches', label: 'Excluded Matches' },
        { id: 'needs_review', label: 'Matches Needing Review' },
      ]
    },
    {
      id: 'doi' as const,
      name: 'DOI Verification',
      options: [
        { id: 'verified', label: 'Verified DOI' },
        { id: 'unverified', label: 'Unverified DOI' },
        { id: 'invalid_format', label: 'Invalid DOI Format' },
        { id: 'not_found', label: 'DOI Not Found in Crossref' },
        { id: 'pending', label: 'DOI Lookup Pending' },
        { id: 'lookup_failed', label: 'DOI Lookup Failed' },
        { id: 'metadata_mismatch', label: 'DOI Metadata Mismatch' },
        { id: 'duplicate', label: 'Duplicate DOI' },
        { id: 'missing_from_ref', label: 'DOI Missing from Reference' },
        { id: 'retracted', label: 'Retracted Publication' },
        { id: 'corrected', label: 'Corrected Publication' },
        { id: 'wrong_article', label: 'DOI Linked to Wrong Article' },
      ]
    },
    {
      id: 'reference' as const,
      name: 'Scholarly References',
      options: [
        { id: 'verified', label: 'Verified References' },
        { id: 'unverified', label: 'Unverified References' },
        { id: 'with_doi', label: 'References with DOI' },
        { id: 'without_doi', label: 'References without DOI' },
        { id: 'incomplete', label: 'Incomplete References' },
        { id: 'duplicate', label: 'Duplicate References' },
        { id: 'author_mismatch', label: 'Incorrect Author Metadata' },
        { id: 'year_mismatch', label: 'Publication Year Mismatch' },
        { id: 'title_mismatch', label: 'Title Mismatch' },
        { id: 'journal_mismatch', label: 'Journal Mismatch' },
        { id: 'missing_from_bib', label: 'References Missing from Bibliography' },
        { id: 'needs_review', label: 'References Needing Manual Review' },
      ]
    },
    {
      id: 'citation' as const,
      name: 'In-Text Citations',
      options: [
        { id: 'verified_match', label: 'Verified Citation-Reference Matches' },
        { id: 'unmatched', label: 'Unmatched In-Text Citations' },
        { id: 'missing_bib', label: 'Missing Bibliography Entries' },
        { id: 'uncited_bib', label: 'Uncited Bibliography Entries' },
        { id: 'duplicate', label: 'Duplicate Citations' },
        { id: 'format_issue', label: 'Formatting Issues' },
        { id: 'author_year_mismatch', label: 'Author-Year Mismatches' },
        { id: 'multiple_citations', label: 'Multiple Citations to Same Reference' },
        { id: 'needs_review', label: 'Citations Needing Review' },
        { id: 'unsupported_claim', label: 'Unsupported Claims' },
      ]
    },
    {
      id: 'source' as const,
      name: 'Source Repositories',
      options: [
        { id: 'scholarly_publications', label: 'Scholarly Publications' },
        { id: 'institutional_repositories', label: 'Institutional Repositories' },
        { id: 'uploaded_documents', label: 'Uploaded Documents' },
        { id: 'authorized_web_sources', label: 'Authorized Web Sources' },
        { id: 'crossref_metadata', label: 'Crossref Metadata Records' },
        { id: 'verified_source', label: 'Verified Source' },
        { id: 'unverified_source', label: 'Unverified Source' },
        { id: 'source_unavailable', label: 'Source Unavailable' },
        { id: 'metadata_mismatch', label: 'Source Metadata Mismatch' },
      ]
    },
    {
      id: 'integrity' as const,
      name: 'Research Integrity',
      options: [
        { id: 'meaning_preservation', label: 'Meaning Preservation Warnings' },
        { id: 'numerical_inconsistency', label: 'Numerical Inconsistencies' },
        { id: 'statistical_mismatch', label: 'Statistical Claim Mismatches' },
        { id: 'missing_source_support', label: 'Missing Source Support' },
        { id: 'contradictory_finding', label: 'Contradictory Findings' },
        { id: 'citation_metadata_issue', label: 'Citation Metadata Issues' },
        { id: 'ai_authorship_indicator', label: 'AI-Authorship Indicators (Advisory)' },
        { id: 'manual_review_required', label: 'Manual Review Required' },
      ]
    }
  ], []);

  const totalActiveFilterCount = useMemo(() => {
    return Object.values(activeFilters).reduce((acc, curr) => acc + curr.length, 0);
  }, [activeFilters]);

  function toggleFilter(category: keyof typeof activeFilters, filterId: string) {
    setActiveFilters(prev => {
      const exists = prev[category].includes(filterId);
      return {
        ...prev,
        [category]: exists ? prev[category].filter(id => id !== filterId) : [...prev[category], filterId]
      };
    });
  }

  function selectAllCategory(category: keyof typeof activeFilters) {
    const cat = FILTER_CATEGORIES.find(c => c.id === category);
    if (!cat) return;
    setActiveFilters(prev => ({
      ...prev,
      [category]: cat.options.map(o => o.id)
    }));
  }

  function clearCategory(category: keyof typeof activeFilters) {
    setActiveFilters(prev => ({
      ...prev,
      [category]: []
    }));
  }

  function resetAllFilters() {
    setActiveFilters({
      doi: [],
      reference: [],
      citation: [],
      similarity: [],
      source: [],
      integrity: []
    });
    setFilterSearch('');
  }

  function toggleCategoryCollapse(categoryId: string) {
    setCollapsedCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
  }

  // Sync external text changes
  useEffect(() => {
    if (text !== manuscript) {
      setManuscript(text || '');
    }
  }, [text]);

  // Load scan history when token is present or tab switched
  async function loadHistory() {
    if (!token) return;
    setLoadingHistory(true);
    try {
      const res = await request('/textguard/scans', token, undefined, 'GET');
      if (Array.isArray(res)) {
        setScanHistory(res);
      }
    } catch {
      // Non-blocking history load
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    if (token) {
      loadHistory();
    }
  }, [token]);

  const wordCount = useMemo(() => manuscript.trim() ? manuscript.trim().split(/\s+/).length : 0, [manuscript]);

  async function runScan(customOpts: any = {}) {
    if (!manuscript.trim()) return;
    setBusy(true);
    setScanStatus('scanning');
    setBotChallengeDetected(false);
    try {
      const payload = {
        text: manuscript,
        documentTitle: activeDoc?.title || 'Academic Manuscript Draft',
        options: {
          excludeQuotes: customOpts.excludeQuotes ?? excludeQuotes,
          excludeReferences: customOpts.excludeRefs ?? excludeRefs,
          excludeSmallPhrases: customOpts.excludeSmallPhrases ?? excludeSmallPhrases,
          minPhraseWords: customOpts.minPhraseWords ?? minPhraseWords
        }
      };
      const res = await request('/textguard/scan', token, payload, 'POST');
      if (res.isBotChallenge) {
        setBotChallengeDetected(true);
        setScanStatus('failed');
      } else {
        setScanStatus(res.status === 'partial' ? 'partial' : 'completed');
      }
      setScanResult(res);
      setViewMode('interactive');
      loadHistory();
      onSuccess?.('TextGuard deep scan completed with similarity and Crossref verification.');
    } catch (e: any) {
      setScanStatus('failed');
      if (e.message?.includes('Security verification') || e.message?.includes('bot protection') || e.message?.includes('Cloudflare')) {
        setBotChallengeDetected(true);
      }
      onError?.(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadPdf() {
    if (!scanResult) return;
    setGeneratingPdf(true);
    try {
      const res = await fetch(`${API}/textguard/report/pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify(scanResult)
      });
      if (!res.ok) throw new Error('PDF report generation failed.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ResearchProof-TextGuard-Report-${scanResult.scanId || Date.now().toString(36)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      onSuccess?.('Downloaded official TextGuard Similarity & Authenticity PDF report.');
    } catch (err: any) {
      onError?.(err.message);
    } finally {
      setGeneratingPdf(false);
    }
  }

  // Initial scan if text is provided and scanResult is empty
  useEffect(() => {
    if (!scanResult && manuscript.trim().length > 40 && token) {
      runScan();
    }
  }, []);

  function handlePassageClick(matchId: string) {
    setSelectedMatchId(matchId);
    const el = document.getElementById(matchId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // 1-Click Quick Resolve with Humanizer/Paraphraser
  async function handleGenerateRewrite(match: any, mode: string) {
    const snippet = match.matchText || match.fullText || match.excerpt;
    if (!snippet) return;
    setResolveState({ matchId: match.id, passage: snippet, mode, busy: true, proposed: null });
    try {
      const endpoint = mode === 'humanize' ? '/humanize' : mode === 'standard' ? '/paraphrase' : '/rewrite';
      const body: any = { text: snippet, mode };
      const res = await request(endpoint, token || '', body, 'POST');
      setResolveState({ matchId: match.id, passage: snippet, mode, busy: false, proposed: res.revisedText || res.revised || '' });
    } catch (e: any) {
      onError?.(e.message);
      setResolveState(prev => prev ? { ...prev, busy: false } : null);
    }
  }

  function handleAcceptRewrite(originalSnippet: string, newSnippet: string, match?: any) {
    if (!newSnippet) return;
    let updated = manuscript;
    if (originalSnippet && manuscript.includes(originalSnippet)) {
      updated = manuscript.replace(originalSnippet, newSnippet);
    } else if (originalSnippet && manuscript.includes(originalSnippet.trim())) {
      updated = manuscript.replace(originalSnippet.trim(), newSnippet);
    } else if (match?.startOffset !== undefined && match?.endOffset !== undefined && match.endOffset <= manuscript.length) {
      updated = manuscript.slice(0, match.startOffset) + newSnippet + manuscript.slice(match.endOffset);
    } else if (originalSnippet) {
      const unquoted = originalSnippet.replace(/^["'“](.*)["'”]$/, '$1').trim();
      if (manuscript.includes(unquoted)) {
        updated = manuscript.replace(unquoted, newSnippet);
      }
    }
    setManuscript(updated);
    setText(updated);
    setResolveState(null);
    onSuccess?.('✓ Flagged text replaced with authentic humanized prose! Re-scanning...');
    setTimeout(() => {
      runScan();
    }, 300);
  }

  // Filtered Passages according to Similarity & Source Filter Categories
  const filteredPassages = useMemo(() => {
    const rawList = scanResult?.matchedPassages || [];
    return rawList.filter((m: any) => {
      // 1. Similarity filter (OR within category)
      if (activeFilters.similarity.length > 0) {
        const matchesSim = activeFilters.similarity.some(filterKey => {
          const sim = m.similarityPercent || 0;
          if (filterKey === 'high') return sim >= 70;
          if (filterKey === 'medium') return sim >= 30 && sim < 70;
          if (filterKey === 'low') return sim < 30;
          if (filterKey === 'exact_matches') return m.type === 'exact' || m.matchTypeLabel?.toLowerCase().includes('exact');
          if (filterKey === 'partial_matches') return m.type === 'near_exact' || m.matchCategory === 'partial_matches';
          if (filterKey === 'repeated_phrases') return m.type === 'repeated_key_phrase';
          if (filterKey === 'matched_quotations') return Boolean(m.isQuotation);
          if (filterKey === 'bibliography_overlap') return Boolean(m.isBibOverlap);
          if (filterKey === 'excluded_matches') return Boolean(m.isExcluded);
          if (filterKey === 'needs_review') return Boolean(m.needsReview || sim >= 50);
          return false;
        });
        if (!matchesSim) return false;
      }
      // 2. Source filter (OR within category)
      if (activeFilters.source.length > 0) {
        const matchesSrc = activeFilters.source.some(filterKey => {
          const st = (m.sourceType || '').toLowerCase();
          const vs = (m.verificationStatus || '').toLowerCase();
          if (filterKey === 'scholarly_publications') return st.includes('scholarly') || Boolean(m.sourceDoi);
          if (filterKey === 'institutional_repositories') return st.includes('repository') || st.includes('institutional');
          if (filterKey === 'uploaded_documents') return st.includes('upload') || st.includes('internal');
          if (filterKey === 'authorized_web_sources') return st.includes('web');
          if (filterKey === 'crossref_metadata') return Boolean(m.sourceDoi);
          if (filterKey === 'verified_source') return vs.includes('verified');
          if (filterKey === 'unverified_source') return vs.includes('unverified');
          if (filterKey === 'source_unavailable') return vs.includes('unavailable');
          if (filterKey === 'metadata_mismatch') return vs.includes('mismatch');
          return false;
        });
        if (!matchesSrc) return false;
      }
      return true;
    });
  }, [scanResult, activeFilters.similarity, activeFilters.source]);

  // Filtered DOI References
  const filteredDois = useMemo(() => {
    const rawList = scanResult?.doiVerification?.references || [];
    if (activeFilters.doi.length === 0) return rawList;
    return rawList.filter((r: any) => {
      return activeFilters.doi.some(filterKey => {
        const status = r.status || '';
        if (filterKey === 'verified') return status === 'verified';
        if (filterKey === 'unverified') return status === 'unverified';
        if (filterKey === 'invalid_format') return status === 'invalid_format' || r.isInvalidFormat;
        if (filterKey === 'not_found') return status === 'not_found';
        if (filterKey === 'pending') return status === 'pending';
        if (filterKey === 'lookup_failed') return status === 'lookup_failed';
        if (filterKey === 'metadata_mismatch') return status === 'metadata_mismatch';
        if (filterKey === 'duplicate') return Boolean(r.isDuplicate);
        if (filterKey === 'missing_from_ref') return Boolean(r.missingFromReference);
        if (filterKey === 'retracted') return Boolean(r.isRetracted || r.retractionNotice);
        if (filterKey === 'corrected') return Boolean(r.isCorrected);
        if (filterKey === 'wrong_article') return Boolean(r.wrongArticle);
        return false;
      });
    });
  }, [scanResult, activeFilters.doi]);

  // Filtered Bibliographic References
  const filteredReferences = useMemo(() => {
    const rawList = scanResult?.bibliographicReferences || scanResult?.references || [];
    if (activeFilters.reference.length === 0) return rawList;
    return rawList.filter((ref: any) => {
      return activeFilters.reference.some(filterKey => {
        if (filterKey === 'verified') return ref.status === 'verified';
        if (filterKey === 'unverified') return ref.status === 'unverified';
        if (filterKey === 'with_doi') return Boolean(ref.doi);
        if (filterKey === 'without_doi') return !ref.doi;
        if (filterKey === 'incomplete') return Boolean(ref.isIncomplete);
        if (filterKey === 'duplicate') return Boolean(ref.isDuplicate);
        if (filterKey === 'author_mismatch') return Boolean(ref.authorMismatch);
        if (filterKey === 'year_mismatch') return Boolean(ref.yearMismatch);
        if (filterKey === 'title_mismatch') return Boolean(ref.titleMismatch);
        if (filterKey === 'journal_mismatch') return Boolean(ref.journalMismatch);
        if (filterKey === 'missing_from_bib') return Boolean(ref.missingFromBibliography);
        if (filterKey === 'needs_review') return Boolean(ref.needsReview);
        return false;
      });
    });
  }, [scanResult, activeFilters.reference]);

  // Filtered In-Text Citations with User Manual Match Overrides
  const filteredCitations = useMemo(() => {
    const rawList = scanResult?.inTextCitations || scanResult?.citations || [];
    const listWithOverrides = rawList.map((c: any) => {
      if (citationOverrides[c.id]) {
        return {
          ...c,
          matchStatus: 'verified',
          matchedReferenceId: citationOverrides[c.id],
          isManuallyOverridden: true
        };
      }
      return c;
    });

    if (activeFilters.citation.length === 0) return listWithOverrides;
    return listWithOverrides.filter((c: any) => {
      return activeFilters.citation.some(filterKey => {
        if (filterKey === 'verified_match') return c.matchStatus === 'verified';
        if (filterKey === 'unmatched') return c.matchStatus === 'unmatched';
        if (filterKey === 'missing_bib') return Boolean(c.missingBibliography);
        if (filterKey === 'uncited_bib') return Boolean(c.uncitedBibliography);
        if (filterKey === 'duplicate') return Boolean(c.isDuplicate);
        if (filterKey === 'format_issue') return Boolean(c.formatIssue);
        if (filterKey === 'author_year_mismatch') return Boolean(c.authorYearMismatch);
        if (filterKey === 'multiple_citations') return Boolean(c.multipleCitations);
        if (filterKey === 'needs_review') return Boolean(c.needsReview || c.matchStatus === 'ambiguous');
        if (filterKey === 'unsupported_claim') return Boolean(c.unsupportedClaim);
        return false;
      });
    });
  }, [scanResult, citationOverrides, activeFilters.citation]);

  // Filtered Research Integrity Findings
  const filteredIntegrity = useMemo(() => {
    const rawList = scanResult?.integrityFindings || [];
    if (activeFilters.integrity.length === 0) return rawList;
    return rawList.filter((f: any) => {
      return activeFilters.integrity.some(filterKey => {
        if (filterKey === 'meaning_preservation') return f.type === 'meaning_preservation' || f.category === 'empirical';
        if (filterKey === 'numerical_inconsistency') return f.type === 'numerical_inconsistency' || f.category === 'empirical';
        if (filterKey === 'statistical_mismatch') return f.type === 'statistical_mismatch' || f.category === 'statistical';
        if (filterKey === 'missing_source_support') return f.type === 'missing_source_support' || f.category === 'source';
        if (filterKey === 'contradictory_finding') return f.type === 'contradictory_finding' || f.category === 'contradictory';
        if (filterKey === 'citation_metadata_issue') return f.type === 'citation_metadata_issue' || f.category === 'citation';
        if (filterKey === 'ai_authorship_indicator') return f.type === 'ai_authorship_indicator' || f.category === 'ai';
        if (filterKey === 'manual_review_required') return f.type === 'manual_review_required' || f.category === 'review';
        return false;
      });
    });
  }, [scanResult, activeFilters.integrity]);

  // Highlighting parser (Dynamically restricted to filteredPassages)
  const highlightedElements = useMemo(() => {
    if (!scanResult || !manuscript) return manuscript;

    const matches = filteredPassages;
    const quotes = scanResult.excludedContent?.quotesFound || [];

    // Collect all intervals to highlight
    interface Interval {
      start: number;
      end: number;
      match: any;
      kind: 'overlap' | 'repeat' | 'doi' | 'quote';
    }

    const intervals: Interval[] = [];

    // 1. Matched passages
    matches.forEach((m: any) => {
      const searchTarget = (m.matchText || m.fullText || m.excerpt || '').trim();
      if (searchTarget.length < 4) return;

      let pos = manuscript.indexOf(searchTarget);
      while (pos !== -1) {
        let kind: 'overlap' | 'repeat' | 'doi' = 'overlap';
        if (m.type === 'repeated_key_phrase') kind = 'repeat';
        else if (m.type === 'scholarly_citation_reference') kind = 'doi';

        intervals.push({
          start: pos,
          end: pos + searchTarget.length,
          match: m,
          kind
        });
        pos = manuscript.indexOf(searchTarget, pos + searchTarget.length);
      }
    });

    // 2. Excluded quotes
    quotes.forEach((q: string) => {
      const cleanQ = q.trim();
      if (cleanQ.length < 8) return;
      let pos = manuscript.indexOf(cleanQ);
      while (pos !== -1) {
        intervals.push({
          start: pos,
          end: pos + cleanQ.length,
          match: { id: `quote-${pos}`, excerpt: cleanQ },
          kind: 'quote'
        });
        pos = manuscript.indexOf(cleanQ, pos + cleanQ.length);
      }
    });

    if (intervals.length === 0) return manuscript;

    // Sort intervals by start ASC, longer interval first
    intervals.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

    // Filter overlapping intervals
    const nonOverlapping: Interval[] = [];
    let lastEnd = 0;
    intervals.forEach(iv => {
      if (iv.start >= lastEnd) {
        nonOverlapping.push(iv);
        lastEnd = iv.end;
      }
    });

    // Build React nodes
    const nodes: any[] = [];
    let currentIndex = 0;

    nonOverlapping.forEach((iv, idx) => {
      if (iv.start > currentIndex) {
        nodes.push(manuscript.slice(currentIndex, iv.start));
      }

      const snippet = manuscript.slice(iv.start, iv.end);
      const isSelected = selectedMatchId === iv.match.id;

      if (iv.kind === 'overlap') {
        nodes.push(
          <mark
            key={`hl-${idx}`}
            className={`tg-hl-overlap ${isSelected ? 'active' : ''}`}
            onClick={() => handlePassageClick(iv.match.id)}
            title="Verbatim Overlap — Click to inspect and humanize"
          >
            {snippet}
          </mark>
        );
      } else if (iv.kind === 'repeat') {
        nodes.push(
          <mark
            key={`hl-${idx}`}
            className={`tg-hl-repeat ${isSelected ? 'active' : ''}`}
            onClick={() => handlePassageClick(iv.match.id)}
            title="Repeated Key Phrase — Click to rephrase"
          >
            {snippet}
          </mark>
        );
      } else if (iv.kind === 'doi') {
        nodes.push(
          <mark
            key={`hl-${idx}`}
            className={`tg-hl-doi ${isSelected ? 'active' : ''}`}
            onClick={() => handlePassageClick(iv.match.id)}
            title="Scholarly DOI Citation — Verified open registry"
          >
            {snippet}
          </mark>
        );
      } else if (iv.kind === 'quote') {
        nodes.push(
          <span
            key={`hl-${idx}`}
            className="tg-hl-quote"
            title="Excluded Direct Quotation"
          >
            {snippet}
          </span>
        );
      }

      currentIndex = iv.end;
    });

    if (currentIndex < manuscript.length) {
      nodes.push(manuscript.slice(currentIndex));
    }

    return nodes;
  }, [manuscript, scanResult, filteredPassages, selectedMatchId]);

  // Filtered source matches
  const filteredMatches = useMemo(() => {
    if (filterTab === 'all') return filteredPassages;
    if (filterTab === 'overlap') return filteredPassages.filter((m: any) => m.type === 'internal_passage_overlap' || m.type === 'exact' || m.type === 'near_exact');
    if (filterTab === 'repeat') return filteredPassages.filter((m: any) => m.type === 'repeated_key_phrase' || m.type === 'semantic');
    if (filterTab === 'doi') return filteredPassages.filter((m: any) => m.type === 'scholarly_citation_reference' || m.sourceDoi);
    return filteredPassages;
  }, [filteredPassages, filterTab]);

  // Industrial Sources Table: filtered, searched, and sorted
  const processedSources = useMemo(() => {
    let list: any[] = [];
    if (scanResult?.matchedSources && Array.isArray(scanResult.matchedSources)) {
      list = [...scanResult.matchedSources];
    } else if (filteredPassages && Array.isArray(filteredPassages)) {
      // Fallback derivation if matchedSources is absent
      const grp = new Map();
      filteredPassages.forEach((m: any) => {
        const sid = m.sourceId || m.sourceTitle || 'src';
        if (!grp.has(sid)) {
          grp.set(sid, {
            sourceId: sid,
            title: m.sourceTitle || 'Scholarly Record',
            authors: m.sourceAuthors || 'Unknown Author(s)',
            year: m.sourceYear || '',
            journal: m.sourceJournal || '',
            domain: m.sourceDomain || (m.sourceUrl ? (() => { try { return new URL(m.sourceUrl).hostname; } catch { return 'doi.org'; } })() : 'authorized-corpus'),
            url: m.sourceUrl,
            doi: m.sourceDoi,
            verificationStatus: m.verificationStatus || 'Text Match Verified',
            matchType: m.type,
            matchTypeLabel: m.matchTypeLabel || (m.type === 'exact' ? 'Exact Match' : m.type === 'near_exact' ? 'Near-Exact Match' : 'Semantic'),
            matchingPassagesCount: 0,
            matchedWordCount: 0,
            similarityContribution: m.similarityPercent || 15,
            passages: []
          });
        }
        const s = grp.get(sid);
        s.matchingPassagesCount += 1;
        s.matchedWordCount += (m.wordCount || 0);
        s.passages.push(m);
      });
      list = Array.from(grp.values());
    }

    // Restrict sources to those having matching filtered passages if similarity or source filter active
    if (activeFilters.similarity.length > 0 || activeFilters.source.length > 0) {
      const allowedSourceIds = new Set(filteredPassages.map((p: any) => p.sourceId || p.sourceTitle));
      list = list.filter(s => allowedSourceIds.has(s.sourceId) || allowedSourceIds.has(s.title));
    }

    if (sourceSearchTerm.trim()) {
      const q = sourceSearchTerm.toLowerCase().trim();
      list = list.filter(s =>
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.authors && String(s.authors).toLowerCase().includes(q)) ||
        (s.doi && s.doi.toLowerCase().includes(q)) ||
        (s.domain && s.domain.toLowerCase().includes(q)) ||
        (s.journal && s.journal.toLowerCase().includes(q))
      );
    }

    if (sourceTypeFilter !== 'all') {
      list = list.filter(s => s.matchType === sourceTypeFilter || (sourceTypeFilter === 'exact' && s.matchTypeLabel?.toLowerCase().includes('exact')));
    }

    if (sourceStatusFilter !== 'all') {
      list = list.filter(s => s.verificationStatus === sourceStatusFilter);
    }

    list.sort((a, b) => {
      if (sourceSortBy === 'year') {
        return (Number(b.year) || 0) - (Number(a.year) || 0);
      }
      if (sourceSortBy === 'passages') {
        return (b.matchingPassagesCount || 0) - (a.matchingPassagesCount || 0);
      }
      return (b.similarityContribution || 0) - (a.similarityContribution || 0);
    });

    return list;
  }, [scanResult, filteredPassages, activeFilters.similarity, activeFilters.source, sourceSearchTerm, sourceTypeFilter, sourceStatusFilter, sourceSortBy]);

  return (
    <div className="tg-container">
      {/* TextGuard Hero Action Header */}
      <div className="tg-hero-bar">
        <div className="tg-hero-title">
          <div className="tg-hero-icon">
            <FileCheck2 size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>TextGuard Plagiarism & Authenticity Studio</h2>
              <span className="status-pill active" style={{ fontSize: '10px' }}>Active Scanner</span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
              Interactive matched text highlighting, visual originality meter, Crossref scholarly DOI verification & 1-click Humanizer bridge.
            </p>
          </div>
        </div>

        <div className="tg-hero-actions">
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".pdf,.docx,.txt"
            onChange={handleManuscriptUpload}
          />

          {importedFile ? (
            <div className="tg-imported-file-pill" title={`Imported from ${importedFile.name} (${importedFile.sizeFormatted})`}>
              <FileText size={13} color="#6366f1" />
              <span className="tg-imported-filename">{importedFile.name}</span>
              <span className="tg-imported-filesize">({importedFile.sizeFormatted})</span>
              <button
                type="button"
                className="tg-file-pill-action replace"
                onClick={() => fileInputRef.current?.click()}
                title="Replace manuscript with another file"
              >
                Replace
              </button>
              <button
                type="button"
                className="tg-file-pill-action remove"
                onClick={handleRemoveImportedFile}
                title="Remove imported file"
              >
                <X size={11} />
              </button>
            </div>
          ) : uploadState === 'uploading' || uploadState === 'processing' ? (
            <div className="tg-upload-progress-pill">
              <RefreshCw size={12} className="spin" />
              <span>{uploadState === 'uploading' ? `Uploading ${uploadProgress}%` : 'Processing text...'}</span>
            </div>
          ) : (
            <button
              className="secondary"
              onClick={() => fileInputRef.current?.click()}
              title="Upload PDF, DOCX, or TXT manuscript draft"
              style={{ fontSize: '11px' }}
            >
              <Upload size={13} /> Import Paper
            </button>
          )}

          {uploadState === 'error' && uploadError && (
            <div className="tg-upload-error-pill" title={uploadError}>
              <AlertCircle size={12} style={{ flexShrink: 0 }} />
              <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadError}</span>
              <button type="button" onClick={() => { setUploadState('idle'); setUploadError(null); }} title="Dismiss error">
                <X size={10} />
              </button>
            </div>
          )}

          {scanResult && (
            <button
              className="secondary"
              onClick={handleDownloadPdf}
              disabled={generatingPdf}
              style={{ fontSize: '11px', borderColor: '#8876ee', color: '#8876ee' }}
              title="Download Official 6-Section PDF Report"
            >
              <Download size={13} className={generatingPdf ? 'spin' : ''} />
              {generatingPdf ? 'Compiling PDF...' : 'Download PDF Report'}
            </button>
          )}

          {scanResult && (
            <button
              className="secondary"
              onClick={() => setShowCertModal(true)}
              style={{ fontSize: '11px', borderColor: '#10b981', color: '#10b981' }}
            >
              <ShieldCheck size={13} /> Integrity Certificate
            </button>
          )}

          <button
            className="primary"
            onClick={() => runScan()}
            disabled={busy || !manuscript.trim()}
            style={{ fontSize: '11px', background: 'linear-gradient(135deg,#e11d48,#be123c)' }}
          >
            <RefreshCw size={13} className={busy ? 'spin' : ''} />
            {busy ? 'Scanning Manuscript...' : 'Deep Scan'}
          </button>
        </div>
      </div>

      {/* Bot Challenge Detection Warning */}
      {botChallengeDetected && (
        <div className="tg-challenge-banner" role="alert" style={{ margin: '14px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <ShieldAlert size={18} style={{ color: '#d97706' }} />
            <strong>Security Verification Handled: Automated Challenge Detected</strong>
          </div>
          <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#92400e', lineHeight: '1.5' }}>
            The input or queried source presented a Cloudflare "Performing security verification" bot-protection challenge. ResearchProof AI identified this as an access challenge rather than manuscript content or scholarly evidence, preventing corrupted similarity scores.
          </p>
          <button className="secondary small" onClick={() => setBotChallengeDetected(false)} style={{ fontSize: '10px' }}>
            Dismiss Notice
          </button>
        </div>
      )}

      {/* Main Dual-Pane Studio Workspace */}
      <div className="tg-workspace">
        {/* Left Pane: Interactive Manuscript Inspector */}
        <div className="tg-pane">
          <div className="tg-pane-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span style={{ whiteSpace: 'nowrap' }}>MANUSCRIPT INSPECTOR</span>
              {importedFile ? (
                <span className="tg-inspector-doc-badge" title={importedFile.title}>
                  <FileCheck2 size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                  {importedFile.title} ({importedFile.sizeFormatted})
                </span>
              ) : activeDoc ? (
                <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>({activeDoc.title})</span>
              ) : null}
            </div>

            <div className="tg-view-toggle">
              <button
                className={`tg-view-btn ${viewMode === 'interactive' ? 'active' : ''}`}
                onClick={() => setViewMode('interactive')}
              >
                <Eye size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                Interactive Scan
              </button>
              <button
                className={`tg-view-btn ${viewMode === 'editor' ? 'active' : ''}`}
                onClick={() => setViewMode('editor')}
              >
                <Edit3 size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                Editor
              </button>
            </div>
          </div>

          {viewMode === 'interactive' ? (
            <div className="tg-text-display">
              {highlightedElements}
            </div>
          ) : (
            <textarea
              className="tg-textarea"
              value={manuscript}
              onChange={e => {
                setManuscript(e.target.value);
                setText(e.target.value);
              }}
              placeholder="Paste or write manuscript text here..."
            />
          )}

          <div className="tg-pane-foot">
            <span>{wordCount} words · {manuscript.length} characters</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span> Overlap
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span> Repetition
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8876ee', display: 'inline-block' }}></span> DOI Citation
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span> Excluded Quote
              </span>
            </div>
          </div>
        </div>

        {/* Right Pane: Authenticity & Sources Hub — Industrial Analytics Dashboard */}
        <div className="tg-pane">
          {/* Dashboard Header Bar */}
          <div className="tg-pane-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} color="#e11d48" />
              <span style={{ letterSpacing: '0.5px' }}>AUTHENTICITY & SOURCES HUB</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="tg-filter-toggle-btn"
                onClick={() => setFilterDrawerOpen(true)}
                title="Open Advanced Filters for similarity, DOIs, references, citations, and research integrity"
              >
                <Filter size={13} />
                <span>Advanced Filters</span>
                {totalActiveFilterCount > 0 && (
                  <span className="tg-filter-badge">{totalActiveFilterCount}</span>
                )}
              </button>
              {/* Scan State Pill */}
              <div className="tg-status-indicator">
                <span className={`tg-status-dot ${scanStatus}`} />
                <span>
                  {scanStatus === 'scanning' ? 'Scanning...' :
                   scanStatus === 'completed' ? 'Scan Completed' :
                   scanStatus === 'partial' ? 'Partial Results' :
                   scanStatus === 'failed' ? 'Scan Failed' : 'Not Started'}
                </span>
              </div>
              {scanResult && (
                <span className={`tg-metric-badge ${scanResult.similarityScore > 25 ? 'elevated' : scanResult.similarityScore > 12 ? 'moderate' : 'clean'}`}>
                  {scanResult.similarityScore < 12 ? 'Clean & Authentic' : scanResult.similarityScore <= 25 ? 'Similarity: Moderate' : 'Similarity Coverage: Elevated'}
                </span>
              )}
            </div>
          </div>

          {/* 4 Primary Industrial Metric Cards */}
          <div className="tg-metrics-grid">
            {/* Card 1 — Similarity Coverage */}
            <div
              className={`tg-metric-card ${activeDetailTab === 'matches' ? 'active' : ''}`}
              onClick={() => setActiveDetailTab('matches')}
              title="Click to view Matched Sources breakdown"
            >
              <div className="tg-metric-header">
                <span className="tg-metric-label">Similarity Coverage</span>
                {scanResult ? (
                  <span className={`tg-metric-badge ${scanResult.similarityScore > 25 ? 'elevated' : scanResult.similarityScore > 12 ? 'moderate' : 'clean'}`}>
                    {scanResult.similarityScore > 25 ? 'Elevated' : scanResult.similarityScore > 12 ? 'Moderate' : 'Low Overlap'}
                  </span>
                ) : (
                  <span className="tg-metric-badge neutral">Awaiting Scan</span>
                )}
              </div>
              <div className="tg-metric-main">
                <span className="tg-metric-value">{scanResult ? scanResult.similarityScore : '—'}</span>
                {scanResult && <span className="tg-metric-unit">%</span>}
              </div>
              <div className="tg-metric-progress-track">
                <div
                  className="tg-metric-progress-fill"
                  style={{
                    width: scanResult ? `${Math.min(100, Math.max(0, scanResult.similarityScore))}%` : '0%',
                    background: scanResult?.similarityScore > 25 ? '#ef4444' : scanResult?.similarityScore > 12 ? '#f59e0b' : '#10b981'
                  }}
                />
              </div>
              <div className="tg-metric-footer">
                <span>{scanResult ? `${scanResult.matchedPassages?.length || 0} matching passages` : 'No passages scanned'}</span>
                <button
                  type="button"
                  className="tg-metric-action-link"
                  onClick={(e) => { e.stopPropagation(); setActiveDetailTab('matches'); }}
                >
                  Review Matches →
                </button>
              </div>
            </div>

            {/* Card 2 — Unmatched Text */}
            <div
              className={`tg-metric-card ${activeDetailTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveDetailTab('overview')}
              title="Click to view manuscript analysis overview"
            >
              <div className="tg-metric-header">
                <span className="tg-metric-label">Unmatched Text</span>
                <span className="tg-metric-badge clean">Baseline</span>
              </div>
              <div className="tg-metric-main">
                <span className="tg-metric-value">{scanResult ? (100 - scanResult.similarityScore) : '—'}</span>
                {scanResult && <span className="tg-metric-unit">%</span>}
              </div>
              <div className="tg-metric-progress-track">
                <div
                  className="tg-metric-progress-fill"
                  style={{
                    width: scanResult ? `${Math.max(0, 100 - scanResult.similarityScore)}%` : '0%',
                    background: '#10b981'
                  }}
                />
              </div>
              <div className="tg-metric-footer">
                <span title="Proportion with no matches across checked corpora; does not certify absolute originality">
                  No matches in corpora*
                </span>
                <button
                  type="button"
                  className="tg-metric-action-link"
                  onClick={(e) => { e.stopPropagation(); setActiveDetailTab('overview'); }}
                >
                  Details →
                </button>
              </div>
            </div>

            {/* Card 3 — Reference Verification */}
            {(() => {
              const doiTotal = scanResult?.doiVerification?.total ?? 0;
              const doiVerified = scanResult?.doiVerification?.verified ?? 0;
              const hasNoDoi = !scanResult || doiTotal === 0;
              return (
                <div
                  className={`tg-metric-card ${activeDetailTab === 'doi' ? 'active' : ''}`}
                  onClick={() => setActiveDetailTab('doi')}
                  title="Click to view DOI Reference Verification table"
                  style={{ cursor: 'pointer' }}
                >
                  <div className="tg-metric-header">
                    <span className="tg-metric-label">Reference Verification</span>
                    <span className={`tg-metric-badge ${hasNoDoi ? 'neutral' : doiVerified === doiTotal ? 'clean' : 'moderate'}`}>
                      {hasNoDoi ? '0 DOIs' : `${doiVerified}/${doiTotal} Valid`}
                    </span>
                  </div>
                  <div className="tg-metric-main">
                    <span className="tg-metric-value">
                      {hasNoDoi ? '0' : `${doiVerified}/${doiTotal}`}
                    </span>
                    <span className="tg-metric-unit">{hasNoDoi ? 'DOIs' : 'verified'}</span>
                  </div>
                  <div className="tg-metric-progress-track">
                    <div
                      className="tg-metric-progress-fill"
                      style={{
                        width: doiTotal > 0 ? `${Math.round((doiVerified / doiTotal) * 100)}%` : '0%',
                        background: '#0284c7'
                      }}
                    />
                  </div>
                  <div className="tg-metric-footer">
                    <span>{hasNoDoi ? 'No DOI references detected' : `${doiTotal} scholarly items`}</span>
                    <button
                      type="button"
                      className="tg-metric-action-link"
                      onClick={(e) => { e.stopPropagation(); setActiveDetailTab('doi'); }}
                    >
                      View References →
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Card 4 — AI-Authorship Indicator */}
            {(() => {
              const aiVal = scanResult?.aiLikelihood ?? (scanResult ? 12 : null);
              const aiUncertainty = scanResult?.aiAssessment?.uncertaintyBand || '± 15%';
              return (
                <div
                  className={`tg-metric-card ${activeDetailTab === 'ai' ? 'active' : ''}`}
                  onClick={() => setActiveDetailTab('ai')}
                  title="Click to view AI Stylistic Analysis & Burstiness indicators"
                >
                  <div className="tg-metric-header">
                    <span className="tg-metric-label">AI-Authorship</span>
                    <span className={`tg-metric-badge ${!aiVal ? 'neutral' : aiVal > 35 ? 'moderate' : 'clean'}`}>
                      {!aiVal ? 'Advisory' : aiVal > 35 ? 'Review Pattern' : 'Low AI Trace'}
                    </span>
                  </div>
                  <div className="tg-metric-main">
                    <span className="tg-metric-value">{aiVal !== null ? aiVal : '—'}</span>
                    {aiVal !== null && <span className="tg-metric-unit">% ({aiUncertainty})</span>}
                  </div>
                  <div className="tg-metric-progress-track">
                    <div
                      className="tg-metric-progress-fill"
                      style={{
                        width: aiVal !== null ? `${Math.min(100, Math.max(0, aiVal))}%` : '0%',
                        background: '#8876ee'
                      }}
                    />
                  </div>
                  <div className="tg-metric-footer">
                    <span title="Statistical stylistic probability score; advisory indicator only, not proof of authorship">
                      Stylistic probability*
                    </span>
                    <button
                      type="button"
                      className="tg-metric-action-link"
                      onClick={(e) => { e.stopPropagation(); setActiveDetailTab('ai'); }}
                    >
                      View Analysis →
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Clean Horizontal Stacked Coverage Progress Bar */}
          <div className="tg-coverage-panel">
            <div className="tg-coverage-header">
              <strong>Corpus Coverage Distribution</strong>
              <span style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
                {scanResult ? `${scanResult.analyzedWords || wordCount} words analyzed` : '0 words analyzed'}
              </span>
            </div>
            <div className="tg-stacked-bar-container">
              {scanResult ? (
                <>
                  <div
                    className="tg-bar-segment matched"
                    style={{ width: `${Math.min(100, Math.max(0, scanResult.similarityScore))}%` }}
                    title={`Matched Text: ${scanResult.similarityScore}%`}
                  />
                  <div
                    className="tg-bar-segment unmatched"
                    style={{ width: `${Math.max(0, 100 - scanResult.similarityScore)}%` }}
                    title={`Unmatched Text: ${100 - scanResult.similarityScore}%`}
                  />
                </>
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'var(--soft)' }} />
              )}
            </div>
            <div className="tg-coverage-legend">
              <span className="tg-legend-item">
                <span className="tg-legend-color" style={{ background: '#ef4444' }} />
                Matched Overlap ({scanResult ? `${scanResult.similarityScore}%` : '0%'})
              </span>
              <span className="tg-legend-item">
                <span className="tg-legend-color" style={{ background: '#10b981' }} />
                Unmatched Text ({scanResult ? `${100 - scanResult.similarityScore}%` : '100%'})
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '9.5px', color: 'var(--muted)', fontStyle: 'italic' }}>
                *Unmatched coverage reflects absence of overlap in queried repositories; not a guarantee of originality.
              </span>
            </div>
          </div>

          {/* Exclusion Toggles Bar */}
          <div className="tg-exclusions-box">
            <div className="tg-exclusions-title">
              <span>TextGuard Exclusion Controls</span>
              <button
                className="text-button"
                onClick={() => runScan()}
                disabled={busy}
                style={{ fontSize: '10px', padding: '2px 6px' }}
              >
                Apply & Re-scan ↻
              </button>
            </div>

            <div className="tg-exclusion-row">
              <label className="tg-check-label">
                <input
                  type="checkbox"
                  checked={excludeQuotes}
                  onChange={e => setExcludeQuotes(e.target.checked)}
                />
                <span>Exclude Quotes ("...")</span>
              </label>

              <label className="tg-check-label">
                <input
                  type="checkbox"
                  checked={excludeRefs}
                  onChange={e => setExcludeRefs(e.target.checked)}
                />
                <span>Exclude Bibliography</span>
              </label>

              <label className="tg-check-label">
                <input
                  type="checkbox"
                  checked={excludeSmallPhrases}
                  onChange={e => setExcludeSmallPhrases(e.target.checked)}
                />
                <span>Exclude Phrases &lt; 8 words</span>
              </label>
            </div>
          </div>

          {/* Active Filter Chips Bar */}
          {totalActiveFilterCount > 0 && (
            <div className="tg-filter-chips-bar">
              <span className="tg-chips-label">Active Filters ({totalActiveFilterCount}):</span>
              {Object.entries(activeFilters).map(([catKey, ids]) => {
                const catDef = FILTER_CATEGORIES.find(c => c.id === catKey);
                return ids.map(id => {
                  const optDef = catDef?.options.find(o => o.id === id);
                  return (
                    <span key={`${catKey}-${id}`} className="tg-filter-chip">
                      <span className="tg-chip-category">{catDef?.name.split(' ')[0]}:</span>
                      <span>{optDef?.label || id}</span>
                      <button
                        type="button"
                        className="tg-filter-chip-remove"
                        onClick={() => toggleFilter(catKey as any, id)}
                        title="Remove filter"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  );
                });
              })}
              <button
                type="button"
                className="text-button"
                onClick={resetAllFilters}
                style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--rp-danger, #ef4444)' }}
              >
                Reset all
              </button>
            </div>
          )}

          {/* 7 Tab Detail Sections Header */}
          <div className="tg-tabs-nav">
            <button
              type="button"
              className={`tg-tab-btn ${activeDetailTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveDetailTab('overview')}
            >
              <FileCheck2 size={13} />
              Overview
            </button>
            <button
              type="button"
              className={`tg-tab-btn ${activeDetailTab === 'matches' ? 'active' : ''}`}
              onClick={() => setActiveDetailTab('matches')}
            >
              <GitCompare size={13} />
              Matched Sources
              <span className="tg-tab-count-pill">{filteredPassages.length}</span>
            </button>
            <button
              type="button"
              className={`tg-tab-btn ${activeDetailTab === 'doi' ? 'active' : ''}`}
              onClick={() => setActiveDetailTab('doi')}
            >
              <BookOpenCheck size={13} />
              DOI & References
              <span className="tg-tab-count-pill">{filteredDois.length}</span>
            </button>
            <button
              type="button"
              className={`tg-tab-btn ${activeDetailTab === 'citations' ? 'active' : ''}`}
              onClick={() => setActiveDetailTab('citations')}
            >
              <Layers size={13} />
              Citations
              <span className="tg-tab-count-pill">{filteredCitations.length}</span>
            </button>
            <button
              type="button"
              className={`tg-tab-btn ${activeDetailTab === 'integrity' ? 'active' : ''}`}
              onClick={() => setActiveDetailTab('integrity')}
            >
              <ShieldAlert size={13} />
              Integrity
              <span className="tg-tab-count-pill">{filteredIntegrity.length}</span>
            </button>
            <button
              type="button"
              className={`tg-tab-btn ${activeDetailTab === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveDetailTab('ai')}
            >
              <Sparkles size={13} />
              AI Analysis
            </button>
            <button
              type="button"
              className={`tg-tab-btn ${activeDetailTab === 'history' ? 'active' : ''}`}
              onClick={() => { setActiveDetailTab('history'); loadHistory(); }}
            >
              <History size={13} />
              Scan History
              <span className="tg-tab-count-pill">{scanHistory.length}</span>
            </button>
          </div>

          {/* Tabbed Detail Content Panels */}
          <div className="tg-tab-content-area">
            {/* TAB 1: OVERVIEW */}
            {activeDetailTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <table className="tg-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '35%' }}>Audit Metric</th>
                      <th>Observed Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Document Title</strong></td>
                      <td>{activeDoc?.title || scanResult?.documentTitle || 'Academic Manuscript Draft'}</td>
                    </tr>
                    <tr>
                      <td><strong>Similarity Coverage</strong></td>
                      <td>
                        <strong>{scanResult ? `${scanResult.similarityScore}%` : 'Not Scanned'}</strong>
                        <span style={{ marginLeft: '8px', color: 'var(--muted)', fontSize: '10px' }}>
                          ({scanResult ? (scanResult.similarityScore < 12 ? 'Within acceptable institutional thresholds' : 'Elevated similarity requires citation review') : '—'})
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Unmatched Text Coverage</strong></td>
                      <td>
                        <strong>{scanResult ? `${100 - scanResult.similarityScore}%` : '—'}</strong>
                        <span style={{ marginLeft: '8px', color: 'var(--muted)', fontSize: '10px' }}>
                          (Proportion of text with no lexical matches across checked corpora)
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Words Compared</strong></td>
                      <td>{scanResult ? `${scanResult.analyzedWords || wordCount} words (${wordCount} total in manuscript)` : `${wordCount} words`}</td>
                    </tr>
                    <tr>
                      <td><strong>Matching Passages Found</strong></td>
                      <td>{scanResult ? `${scanResult.matchedPassages?.length || 0} passages across ${scanResult.distinctSourcesCount || 0} distinct sources` : '—'}</td>
                    </tr>
                    <tr>
                      <td><strong>Scholarly DOIs Extracted</strong></td>
                      <td>
                        {scanResult?.doiVerification?.total ? (
                          `${scanResult.doiVerification.verified} verified out of ${scanResult.doiVerification.total} references`
                        ) : (
                          'No DOI references detected in manuscript text'
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Corpus Scope</strong></td>
                      <td>{scanResult?.corpusCoverage || 'Authorized institutional repository, user document history, and Crossref scholarly registry.'}</td>
                    </tr>
                    <tr>
                      <td><strong>Cryptographic SHA-256</strong></td>
                      <td style={{ fontFamily: 'monospace', fontSize: '9.5px', color: 'var(--muted)' }}>
                        {scanResult?.sha256 || 'Pending scan completion'}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Advisory Disclaimer */}
                <div className="tg-advisory-banner info">
                  <CircleHelp size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Interpretive Guidance:</strong> Text similarity coverage indicates verbatim or close-paraphrase lexical overlap with indexed records. It does not certify academic misconduct or originality. Properly formatted citations and methodological phrases should be evaluated in context.
                  </div>
                </div>

                {scanResult && (
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="secondary small"
                      onClick={() => setShowCertModal(true)}
                    >
                      <ShieldCheck size={12} /> View Integrity Certificate
                    </button>
                    <button
                      type="button"
                      className="primary small"
                      onClick={handleDownloadPdf}
                      disabled={generatingPdf}
                    >
                      <Download size={12} className={generatingPdf ? 'spin' : ''} />
                      {generatingPdf ? 'Compiling PDF...' : 'Download PDF Report'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: MATCHED SOURCES & EVIDENCE */}
            {activeDetailTab === 'matches' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Search & Filter Toolbar */}
                <div className="tg-sources-toolbar">
                  <div className="tg-search-input">
                    <Search size={13} style={{ color: 'var(--muted)' }} />
                    <input
                      type="text"
                      placeholder="Search title, author, DOI, domain..."
                      value={sourceSearchTerm}
                      onChange={e => setSourceSearchTerm(e.target.value)}
                    />
                    {sourceSearchTerm && (
                      <button
                        type="button"
                        style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--muted)' }}
                        onClick={() => setSourceSearchTerm('')}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <div className="tg-sources-filters">
                    <select
                      value={sourceTypeFilter}
                      onChange={e => setSourceTypeFilter(e.target.value)}
                      title="Filter by match type"
                    >
                      <option value="all">All Match Types</option>
                      <option value="exact">Exact Overlap</option>
                      <option value="near_exact">Near-Exact Overlap</option>
                      <option value="semantic">Semantic / Internal</option>
                    </select>

                    <select
                      value={sourceStatusFilter}
                      onChange={e => setSourceStatusFilter(e.target.value)}
                      title="Filter by source verification status"
                    >
                      <option value="all">All Verification Statuses</option>
                      <option value="Metadata Verified">Metadata Verified</option>
                      <option value="Text Match Verified">Text Match Verified</option>
                      <option value="Source Unavailable">Source Unavailable</option>
                    </select>

                    <select
                      value={sourceSortBy}
                      onChange={e => setSourceSortBy(e.target.value as any)}
                      title="Sort sources"
                    >
                      <option value="contribution">Sort: Highest Match %</option>
                      <option value="passages">Sort: Most Passages</option>
                      <option value="year">Sort: Newest Year</option>
                    </select>
                  </div>
                </div>

                {!scanResult ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
                    <FileCheck2 size={28} style={{ opacity: 0.4, marginBottom: '8px' }} />
                    <p style={{ margin: 0, fontSize: '12px' }}>Run a similarity scan to discover matching sources.</p>
                  </div>
                ) : processedSources.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', background: 'var(--surface2)', borderRadius: '10px' }}>
                    <ShieldCheck size={28} style={{ color: '#10b981', marginBottom: '8px' }} />
                    <strong style={{ display: 'block', color: 'var(--text)', fontSize: '13px' }}>
                      {sourceSearchTerm || sourceTypeFilter !== 'all' || sourceStatusFilter !== 'all'
                        ? 'No sources match the active filter criteria'
                        : 'No matching sources were identified within the available comparison coverage.'}
                    </strong>
                    <p style={{ margin: '4px 0 0', fontSize: '11px', maxWidth: '440px', marginInline: 'auto' }}>
                      {sourceSearchTerm || sourceTypeFilter !== 'all' || sourceStatusFilter !== 'all'
                        ? 'Try clearing search keywords or selecting all statuses.'
                        : 'Your text demonstrates authentic composition with no detected verbatim or near-verbatim overlaps in indexed corpora.'}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Industrial Sources Table */}
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <table className="tg-data-table" style={{ margin: 0, border: 0 }}>
                        <thead>
                          <tr>
                            <th style={{ width: '38%' }}>Source & Authors</th>
                            <th style={{ width: '12%' }}>Match %</th>
                            <th style={{ width: '14%' }}>Type</th>
                            <th style={{ width: '14%' }}>DOI / Domain</th>
                            <th style={{ width: '12%' }}>Status</th>
                            <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {processedSources.map((src: any) => {
                            const isSelected = selectedMatchId === src.sourceId;
                            const doiClean = src.doi ? src.doi.replace(/^https?:\/\/doi\.org\//i, '') : null;
                            const externalUrl = src.url || (doiClean ? `https://doi.org/${doiClean}` : null);
                            const firstPassage = src.passages?.[0];

                            return (
                              <tr
                                key={src.sourceId}
                                style={{ background: isSelected ? 'rgba(99, 102, 241, 0.08)' : undefined }}
                              >
                                <td>
                                  <strong style={{ display: 'block', color: 'var(--text)', fontSize: '11.5px', marginBottom: '2px' }}>
                                    {src.title}
                                  </strong>
                                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
                                    {src.authors} {src.year ? `(${src.year})` : ''} {src.journal ? `· ${src.journal}` : ''}
                                  </div>
                                  <div style={{ fontSize: '9.5px', color: 'var(--muted)', marginTop: '2px' }}>
                                    {src.matchingPassagesCount} passage{src.matchingPassagesCount > 1 ? 's' : ''} ({src.matchedWordCount} words)
                                  </div>
                                </td>
                                <td>
                                  <span style={{ font: '800 13px Manrope', color: src.similarityContribution > 25 ? '#ef4444' : src.similarityContribution > 12 ? '#f59e0b' : '#10b981' }}>
                                    {src.similarityContribution}%
                                  </span>
                                </td>
                                <td>
                                  <span className={`tg-metric-badge ${src.matchType === 'exact' ? 'elevated' : src.matchType === 'near_exact' ? 'moderate' : 'clean'}`}>
                                    {src.matchTypeLabel || src.matchType}
                                  </span>
                                </td>
                                <td>
                                  {doiClean ? (
                                    <div>
                                      <a
                                        href={`https://doi.org/${doiClean}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="tg-metric-action-link"
                                        style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                        title={`Open validated DOI: ${doiClean}`}
                                      >
                                        <ExternalLink size={10} /> doi.org/{doiClean.slice(0, 16)}...
                                      </a>
                                      <div style={{ fontSize: '9px', color: 'var(--muted)' }}>Crossref Registry</div>
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
                                      {src.domain || '—'}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <span className={`tg-metric-badge ${src.verificationStatus?.includes('Verified') ? 'clean' : 'neutral'}`}>
                                    {src.verificationStatus || 'Metadata Verified'}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div className="tg-action-btn-group" style={{ justifyContent: 'flex-end' }}>
                                    {firstPassage && (
                                      <button
                                        type="button"
                                        className="tg-source-action-btn"
                                        onClick={() => {
                                          handlePassageClick(firstPassage.id);
                                          onSuccess?.(`Navigated to matched passage in manuscript.`);
                                        }}
                                        title="Highlight and navigate to passage in manuscript"
                                      >
                                        <Eye size={10} /> View Text
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      className="tg-source-action-btn"
                                      onClick={() => setCompareModalSource(src)}
                                      title="Open side-by-side text comparison"
                                    >
                                      <GitCompare size={10} /> Compare
                                    </button>

                                    {externalUrl && (
                                      <a
                                        href={externalUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="tg-source-action-btn"
                                        title="Open original publication or website"
                                      >
                                        <ExternalLink size={10} /> Open Source
                                      </a>
                                    )}

                                    <button
                                      type="button"
                                      className="tg-source-action-btn"
                                      onClick={() => {
                                        const citationText = `${src.authors} (${src.year || 'n.d.'}). ${src.title}. ${src.journal || src.publisher || ''}. ${doiClean ? 'https://doi.org/' + doiClean : src.url || ''}`.trim();
                                        navigator.clipboard?.writeText(citationText);
                                        onSuccess?.(`✓ Copied APA reference: ${src.title.slice(0, 40)}...`);
                                      }}
                                      title="Copy formatted citation"
                                    >
                                      <Copy size={10} /> Copy Citation
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Matched Passages Detail Cards */}
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <strong style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', color: 'var(--muted)' }}>
                          Evidence Passages Breakdown ({filteredMatches.length})
                        </strong>
                        <div className="qb-modes" style={{ gap: '4px' }}>
                          <button
                            type="button"
                            className={`qb-mode-btn ${filterTab === 'all' ? 'active' : ''}`}
                            onClick={() => setFilterTab('all')}
                            style={{ padding: '3px 7px', fontSize: '9.5px' }}
                          >
                            All
                          </button>
                          <button
                            type="button"
                            className={`qb-mode-btn ${filterTab === 'overlap' ? 'active' : ''}`}
                            onClick={() => setFilterTab('overlap')}
                            style={{ padding: '3px 7px', fontSize: '9.5px' }}
                          >
                            Overlaps
                          </button>
                          <button
                            type="button"
                            className={`qb-mode-btn ${filterTab === 'repeat' ? 'active' : ''}`}
                            onClick={() => setFilterTab('repeat')}
                            style={{ padding: '3px 7px', fontSize: '9.5px' }}
                          >
                            Repetitions
                          </button>
                        </div>
                      </div>

                      {filteredMatches.map((m: any, idx: number) => {
                        const isSelected = selectedMatchId === m.id;
                        const isResolveOpen = resolveState?.matchId === m.id;
                        const isDoi = m.type === 'scholarly_citation_reference';
                        const isOverlap = m.type === 'exact' || m.type === 'near_exact' || m.type === 'internal_passage_overlap';
                        const sourceLink = m.sourceDoi ? `https://doi.org/${m.sourceDoi}` : m.sourceUrl;

                        return (
                          <div
                            key={m.id || idx}
                            id={m.id}
                            className={`tg-match-card ${isSelected ? 'active' : ''}`}
                            style={{ marginBottom: '10px' }}
                          >
                            <div className="tg-match-card-head">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className={`tg-badge-match ${isDoi ? 'doi' : isOverlap ? 'overlap' : 'repeat'}`}>
                                  {m.matchTypeLabel || (isDoi ? 'Crossref DOI' : isOverlap ? 'Verbatim Overlap' : 'Repeated Phrase')}
                                </span>
                                <strong style={{ fontSize: '11px', color: 'var(--text)' }}>
                                  {m.sourceTitle || m.sourceLocation}
                                </strong>
                              </div>
                              {m.similarityPercent && (
                                <span style={{ fontSize: '10px', fontWeight: 700, color: m.similarityPercent > 70 ? '#e11d48' : '#f59e0b' }}>
                                  {m.similarityPercent}% match
                                </span>
                              )}
                            </div>

                            <div className="tg-excerpt-grid">
                              <div className="tg-excerpt-side">
                                <small>Your Manuscript Passage</small>
                                <p>“{m.matchText || m.excerpt}”</p>
                              </div>
                              <div className="tg-excerpt-side">
                                <small>Retrieved Source Evidence</small>
                                <p style={{ color: 'var(--muted)' }}>
                                  {m.evidenceExcerpt ? `“${m.evidenceExcerpt}”` : (m.detail || m.targetLocation || 'Matched against benchmark corpus')}
                                </p>
                              </div>
                            </div>

                            <div className="tg-match-actions">
                              <div className="tg-match-left">
                                <span className="tg-word-pill">
                                  <FileText size={11} />
                                  {m.wordCount || (m.matchText || m.fullText || m.excerpt || '').trim().split(/\s+/).filter(Boolean).length} words
                                </span>

                                {sourceLink && (
                                  <a
                                    href={sourceLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontSize: '11px', color: '#8876ee', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  >
                                    View Evidence <ExternalLink size={11} />
                                  </a>
                                )}
                              </div>

                              <div className="tg-match-right">
                                {onSendToHumanizer && (
                                  <button
                                    type="button"
                                    className="tg-btn-transfer"
                                    onClick={() => onSendToHumanizer(m.matchText || m.fullText || m.excerpt)}
                                    title="Transfer passage to AI Text Humanizer workspace"
                                  >
                                    <span>Open in Humanizer</span>
                                    <ExternalLink size={11} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className={`tg-btn-humanize ${isResolveOpen ? 'open' : ''}`}
                                  onClick={() => {
                                    if (isResolveOpen) setResolveState(null);
                                    else handleGenerateRewrite(m, 'humanize');
                                  }}
                                >
                                  {isResolveOpen ? <X size={12} /> : <Sparkles size={12} />}
                                  {isResolveOpen ? 'Close Resolve' : '⚡ Fix with Humanizer'}
                                </button>
                              </div>
                            </div>

                            {/* Inline Quick Resolve Drawer */}
                            {isResolveOpen && (
                              <div className="tg-resolve-card">
                                <div className="tg-resolve-head">
                                  <div className="tg-resolve-title">
                                    <Sparkles size={13} />
                                    <span>⚡ Humanize & Paraphrase to Resolve</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {resolveState?.busy && <RefreshCw size={12} className="spin" />}
                                    <button
                                      type="button"
                                      className="tg-resolve-close"
                                      onClick={() => setResolveState(null)}
                                      title="Close resolve panel"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                </div>

                                <div className="tg-resolve-modes">
                                  <button
                                    type="button"
                                    className={`tg-mode-chip ${resolveState?.mode === 'humanize' ? 'active' : ''}`}
                                    onClick={() => handleGenerateRewrite(m, 'humanize')}
                                    disabled={resolveState?.busy}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                  >
                                    <ShieldCheck size={13} /> TextGuard Humanizer
                                  </button>
                                  <button
                                    type="button"
                                    className={`tg-mode-chip ${resolveState?.mode === 'academic-clarity' ? 'active' : ''}`}
                                    onClick={() => handleGenerateRewrite(m, 'academic-clarity')}
                                    disabled={resolveState?.busy}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                  >
                                    <BookOpen size={13} /> Academic Clarity
                                  </button>
                                  <button
                                    type="button"
                                    className={`tg-mode-chip ${resolveState?.mode === 'standard' ? 'active' : ''}`}
                                    onClick={() => handleGenerateRewrite(m, 'standard')}
                                    disabled={resolveState?.busy}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                  >
                                    <Sparkles size={13} /> Standard
                                  </button>
                                  <button
                                    type="button"
                                    className={`tg-mode-chip ${resolveState?.mode === 'formal-scientific' ? 'active' : ''}`}
                                    onClick={() => handleGenerateRewrite(m, 'formal-scientific')}
                                    disabled={resolveState?.busy}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                  >
                                    <Activity size={13} /> Formal Scientific
                                  </button>
                                </div>

                                {resolveState?.proposed ? (
                                  <>
                                    <div className="tg-resolve-diff">
                                      <div className="tg-diff-head">
                                        <span className="tg-diff-label">PROPOSED REWRITE</span>
                                        <span className="tg-diff-words">
                                          {resolveState.proposed.trim().split(/\s+/).filter(Boolean).length} words
                                        </span>
                                      </div>
                                      <div style={{ color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                                        {resolveState.proposed}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                                      <button
                                        type="button"
                                        className="secondary small"
                                        onClick={() => handleGenerateRewrite(m, resolveState.mode)}
                                        disabled={resolveState.busy}
                                      >
                                        Try Another
                                      </button>
                                      <button
                                        type="button"
                                        className="primary small"
                                        style={{ background: '#059669', borderColor: '#059669', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                        onClick={() => handleAcceptRewrite(resolveState.passage, resolveState.proposed!, m)}
                                      >
                                        <Check size={12} /> Accept & Replace in Manuscript
                                      </button>
                                    </div>
                                  </>
                                ) : resolveState?.busy ? (
                                  <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: '12px', color: 'var(--muted)' }}>
                                    <RefreshCw size={16} className="spin" style={{ display: 'block', margin: '0 auto 8px', color: '#ea580c' }} />
                                    Generating authentic humanized academic prose...
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB 3: DOI & REFERENCES AUDIT */}
            {activeDetailTab === 'doi' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <strong>Scholarly DOI & Reference Audit ({filteredDois.length} DOIs · {filteredReferences.length} refs)</strong>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                      Authoritative verification against Crossref metadata records, retraction registries, and bibliography completeness.
                    </p>
                  </div>
                </div>

                {!scanResult ? (
                  <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--muted)' }}>
                    <BookOpenCheck size={28} style={{ opacity: 0.5, marginBottom: '8px' }} />
                    <p style={{ fontSize: '12px' }}>Run a scan to extract and verify scholarly references.</p>
                  </div>
                ) : filteredDois.length === 0 && filteredReferences.length === 0 ? (
                  <div className="tg-filter-empty-state">
                    <div className="tg-empty-icon"><Filter size={24} /></div>
                    <strong style={{ fontSize: '13px', color: 'var(--rp-text)' }}>
                      {totalActiveFilterCount > 0 ? 'No DOIs or references match active filters' : 'No DOI references detected in manuscript'}
                    </strong>
                    <p style={{ fontSize: '11.5px', color: 'var(--rp-text-muted)', margin: '4px 0 14px' }}>
                      {totalActiveFilterCount > 0 ? 'Try clearing or resetting active DOI / Reference filters.' : 'Include standard DOI identifiers (10.xxxx/yyyy) in your bibliography to enable automated Crossref verification.'}
                    </p>
                    {totalActiveFilterCount > 0 && (
                      <button type="button" className="secondary small" onClick={resetAllFilters}>
                        Reset all filters
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {filteredDois.length > 0 && (
                      <table className="tg-data-table">
                        <thead>
                          <tr>
                            <th>Identifier / DOI</th>
                            <th>Resolution Status</th>
                            <th>Matched Metadata / Registry</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDois.map((r: any, idx: number) => {
                            const isRetracted = Boolean(r.isRetracted || r.retractionNotice);
                            const isCorrected = Boolean(r.isCorrected);
                            const isNotFound = r.status === 'not_found';
                            const isPending = r.status === 'pending';
                            const isInvalid = r.status === 'invalid_format';
                            const isMismatch = r.status === 'metadata_mismatch';

                            return (
                              <tr key={r.id || idx}>
                                <td>
                                  <strong style={{ display: 'block', fontFamily: 'monospace', fontSize: '10.5px' }}>
                                    {r.doi || r.rawCitation?.slice(0, 40) || 'DOI Reference'}
                                  </strong>
                                  {r.doi && (
                                    <a
                                      href={`https://doi.org/${r.doi}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ fontSize: '10px', color: '#6366f1', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                    >
                                      doi.org/{r.doi} <ExternalLink size={9} />
                                    </a>
                                  )}
                                </td>
                                <td>
                                  <span className={`tg-metric-badge ${
                                    isRetracted ? 'elevated' :
                                    isInvalid ? 'elevated' :
                                    isNotFound ? 'moderate' :
                                    isPending ? 'neutral' :
                                    isMismatch ? 'moderate' :
                                    r.status === 'verified' ? 'clean' : 'moderate'
                                  }`}>
                                    {isRetracted ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={11} /> Retracted Publication</span> :
                                     isCorrected ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertCircle size={11} /> Corrected Publication</span> :
                                     isInvalid ? 'Invalid DOI Format' :
                                     isPending ? 'Lookup Pending' :
                                     isNotFound ? 'Not Found in Crossref' :
                                     isMismatch ? 'Metadata Mismatch' :
                                     r.status === 'verified' ? 'Verified' : 'Unverified'}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ fontSize: '11px', color: 'var(--text)' }}>
                                    {r.title || r.detail || 'Metadata record retrieved from open Crossref scholarly index'}
                                  </div>
                                  {r.journal && (
                                    <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                                      <em>{r.journal}</em> {r.year ? `(${r.year})` : ''}
                                    </div>
                                  )}
                                  {r.retractionNotice && (
                                    <div style={{ fontSize: '10px', color: '#ef4444', fontWeight: 600, marginTop: '3px' }}>
                                      {r.retractionNotice}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </>
                )}

                <div className="tg-advisory-banner info">
                  <CircleHelp size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Verification Criteria:</strong> ResearchProof AI queries Crossref to confirm DOI authenticity, matching article titles, published years, and indexed journals against author citations. Crossref absence alone does not imply a DOI is invalid.
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: IN-TEXT CITATIONS & REFERENCE MATCHING */}
            {activeDetailTab === 'citations' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <strong>In-Text Citations & Bibliography Alignment ({filteredCitations.length})</strong>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                      Bidirectional matching between manuscript in-text mentions and bibliography references.
                    </p>
                  </div>
                </div>

                {!scanResult ? (
                  <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--muted)' }}>
                    <Layers size={28} style={{ opacity: 0.5, marginBottom: '8px' }} />
                    <p style={{ fontSize: '12px' }}>Run a scan to extract and verify in-text citations.</p>
                  </div>
                ) : filteredCitations.length === 0 ? (
                  <div className="tg-filter-empty-state">
                    <div className="tg-empty-icon"><Filter size={24} /></div>
                    <strong style={{ fontSize: '13px', color: 'var(--rp-text)' }}>
                      {totalActiveFilterCount > 0 ? 'No citations match the active filter criteria' : 'No in-text citations detected in manuscript'}
                    </strong>
                    <p style={{ fontSize: '11.5px', color: 'var(--rp-text-muted)', margin: '4px 0 14px' }}>
                      {totalActiveFilterCount > 0 ? 'Try clearing or resetting active citation filters.' : 'Include author-year citations like (Smith, 2021) or numbered references [1] in your text.'}
                    </p>
                    {totalActiveFilterCount > 0 && (
                      <button type="button" className="secondary small" onClick={resetAllFilters}>
                        Reset all filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredCitations.map((c: any, idx: number) => {
                      const matchedRef = (scanResult?.bibliographicReferences || []).find((r: any) => r.id === c.matchedReferenceId || r.doi === c.matchedReferenceId);
                      return (
                        <div key={c.id || idx} className="tg-citation-card">
                          <div className="tg-citation-head">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '12px', background: 'var(--surface2)', padding: '2px 8px', borderRadius: '4px' }}>
                                {c.rawCitation}
                              </span>
                              <span className={`tg-metric-badge ${c.matchStatus === 'verified' ? 'clean' : c.matchStatus === 'ambiguous' ? 'moderate' : 'elevated'}`}>
                                {c.matchStatus === 'verified' ? 'Verified Match' : c.matchStatus === 'ambiguous' ? 'Ambiguous Match' : 'Unmatched'}
                              </span>
                              {c.isManuallyOverridden && (
                                <span className="status-pill active" style={{ fontSize: '9px', background: '#ecfdf5', color: '#059669', borderColor: '#a7f3d0' }}>
                                  Manual Override
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '10.5px', color: 'var(--muted)', fontWeight: 600 }}>
                              Confidence: {c.confidence || (c.matchStatus === 'verified' ? 95 : 40)}%
                            </span>
                          </div>

                          <div style={{ fontSize: '11.5px', color: 'var(--text)' }}>
                            <strong>Matched Reference:</strong>{' '}
                            {matchedRef ? (
                              <span>{matchedRef.rawText || `${matchedRef.authors?.join(', ')} (${matchedRef.year}). ${matchedRef.title}`}</span>
                            ) : (
                              <span style={{ color: 'var(--rp-danger, #ef4444)' }}>Missing corresponding bibliography entry</span>
                            )}
                          </div>

                          {/* Manual Match Correction Override Control */}
                          <div className="tg-citation-override-row">
                            <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>Override / Re-link:</span>
                            <select
                              value={citationOverrides[c.id] || c.matchedReferenceId || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setCitationOverrides(prev => ({ ...prev, [c.id]: val }));
                                onSuccess?.(`✓ Re-linked citation "${c.rawCitation}" to bibliography entry.`);
                              }}
                              style={{ flex: 1, padding: '4px 8px', fontSize: '11px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)' }}
                            >
                              <option value="">-- Select matching reference or mark unmatched --</option>
                              {(scanResult?.bibliographicReferences || []).map((b: any) => (
                                <option key={b.id} value={b.id}>
                                  {b.authors?.[0] || 'Author'} ({b.year || 'n.d.'}) - {(b.title || b.rawText || '').slice(0, 50)}...
                                </option>
                              ))}
                            </select>
                            {citationOverrides[c.id] && (
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => {
                                  setCitationOverrides(prev => {
                                    const next = { ...prev };
                                    delete next[c.id];
                                    return next;
                                  });
                                }}
                                style={{ fontSize: '10px', color: 'var(--muted)' }}
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: RESEARCH INTEGRITY FINDINGS */}
            {activeDetailTab === 'integrity' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <strong>Empirical & Methodological Integrity Findings ({filteredIntegrity.length})</strong>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
                      Automated screening for statistical reporting consistency, empirical claims, and disciplinary integrity standards.
                    </p>
                  </div>
                </div>

                {!scanResult ? (
                  <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--muted)' }}>
                    <ShieldAlert size={28} style={{ opacity: 0.5, marginBottom: '8px' }} />
                    <p style={{ fontSize: '12px' }}>Run a scan to analyze empirical integrity and claims.</p>
                  </div>
                ) : filteredIntegrity.length === 0 ? (
                  <div className="tg-filter-empty-state">
                    <ShieldCheck size={32} style={{ color: '#10b981', marginBottom: '8px' }} />
                    <strong style={{ fontSize: '13px', color: 'var(--rp-text)' }}>
                      {totalActiveFilterCount > 0 ? 'No integrity findings match the active filters' : 'No Empirical Integrity Anomalies Detected'}
                    </strong>
                    <p style={{ fontSize: '11.5px', color: 'var(--rp-text-muted)', margin: '4px 0 14px' }}>
                      {totalActiveFilterCount > 0
                        ? 'Try clearing active integrity filters to see all findings.'
                        : 'Manuscript demonstrates consistent statistical reporting, aligned empirical claims, and valid citation anchors.'}
                    </p>
                    {totalActiveFilterCount > 0 && (
                      <button type="button" className="secondary small" onClick={resetAllFilters}>
                        Reset all filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredIntegrity.map((f: any, idx: number) => {
                      const sevClass = f.severity === 'high' ? 'high' : f.severity === 'medium' ? 'medium' : 'advisory';
                      return (
                        <div key={f.id || idx} className={`tg-integrity-card ${sevClass}`}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className={`tg-metric-badge ${f.severity === 'high' ? 'elevated' : f.severity === 'medium' ? 'moderate' : 'neutral'}`}>
                                {f.severity.toUpperCase()}
                              </span>
                              <strong style={{ fontSize: '12.5px', color: 'var(--text)' }}>
                                {f.title}
                              </strong>
                            </div>
                            <span style={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--muted)' }}>
                              Category: {f.category}
                            </span>
                          </div>

                          {f.excerpt && (
                            <div style={{ padding: '6px 10px', background: 'var(--surface2)', borderRadius: '6px', fontSize: '11px', fontStyle: 'italic', color: 'var(--text)', marginBottom: '8px' }}>
                              “{f.excerpt}”
                            </div>
                          )}

                          <p style={{ margin: '0 0 8px', fontSize: '11.5px', color: 'var(--muted)', lineHeight: '1.5' }}>
                            {f.detail}
                          </p>

                          {f.actionSuggested && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#4f46e5', fontWeight: 600 }}>
                              <span>Recommended Action:</span>
                              <span style={{ color: 'var(--text)' }}>{f.actionSuggested}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: AI ANALYSIS */}
            {activeDetailTab === 'ai' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="tg-ai-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sparkles size={16} color="#8876ee" />
                      <strong>AI Stylistic Authorship Assessment</strong>
                    </div>
                    <span className="tg-metric-badge neutral">
                      Provider: Internal Heuristic Analyzer (Local)
                    </span>
                  </div>

                  <div className="tg-ai-metrics-row">
                    <div className="tg-ai-submetric">
                      <small>Stylistic AI Likelihood</small>
                      <strong>{scanResult?.aiLikelihood ?? 12}%</strong>
                    </div>
                    <div className="tg-ai-submetric">
                      <small>Uncertainty Band</small>
                      <strong>{scanResult?.aiAssessment?.uncertaintyBand || '± 15%'}</strong>
                    </div>
                    <div className="tg-ai-submetric">
                      <small>Burstiness & Cadence</small>
                      <strong>{scanResult?.aiAssessment?.burstinessEvaluation || 'Dynamic variance (Human cadence)'}</strong>
                    </div>
                  </div>

                  {scanResult?.aiAssessment?.indicators?.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <strong style={{ fontSize: '11px', display: 'block', marginBottom: '6px' }}>Observed Stylistic Patterns:</strong>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {scanResult.aiAssessment.indicators.map((ind: string, idx: number) => (
                          <span key={idx} className="tg-metric-badge moderate">
                            {ind}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Clear Uncertainty Explanation */}
                <div className="tg-advisory-banner warning">
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ fontSize: '12px' }}>Critical Advisory Notice:</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '11px', lineHeight: '1.5' }}>
                      Statistical indicators cannot definitively prove human vs. AI authorship. Text generated by non-native English speakers or highly structured academic writing can produce false positives. Never use this score as sole proof of academic misconduct.
                    </p>
                  </div>
                </div>

                <div className="tg-advisory-banner info">
                  <CircleHelp size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ fontSize: '12px' }}>Methodology & Limitations:</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '11px', lineHeight: '1.5' }}>
                      Analysis is heuristic-based, examining sentence length variance (burstiness), vocabulary distribution, and formulaic AI transition patterns. No external commercial detector database is queried.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: SCAN HISTORY */}
            {activeDetailTab === 'history' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <strong>Previous TextGuard Scans</strong>
                  <button
                    type="button"
                    className="text-button"
                    onClick={loadHistory}
                    disabled={loadingHistory}
                    style={{ fontSize: '10px' }}
                  >
                    Refresh ↻
                  </button>
                </div>

                {loadingHistory ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)', fontSize: '11px' }}>
                    <RefreshCw size={16} className="spin" style={{ display: 'block', margin: '0 auto 6px' }} />
                    Loading scan audit records...
                  </div>
                ) : scanHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--muted)', background: 'var(--surface2)', borderRadius: '10px' }}>
                    <History size={26} style={{ opacity: 0.5, marginBottom: '6px' }} />
                    <strong style={{ display: 'block', color: 'var(--text)', fontSize: '12px' }}>No scan history found</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '11px' }}>Run a deep scan on your manuscript to record audit history.</p>
                  </div>
                ) : (
                  <table className="tg-data-table">
                    <thead>
                      <tr>
                        <th>Date & Time</th>
                        <th>Document Title</th>
                        <th>Similarity</th>
                        <th>DOIs</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scanHistory.map((s: any) => {
                        const sid = s._id || s.id;
                        return (
                          <tr key={sid}>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '10px', color: 'var(--muted)' }}>
                              {new Date(s.createdAt).toLocaleDateString()} {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td>
                              <strong>{s.documentTitle || 'Untitled Draft'}</strong>
                              <div style={{ fontSize: '9.5px', color: 'var(--muted)' }}>
                                {s.analyzedWordCount || s.totalWords || 0} words analyzed
                              </div>
                            </td>
                            <td>
                              <span className={`tg-metric-badge ${s.similarityCoverage > 25 ? 'elevated' : s.similarityCoverage > 12 ? 'moderate' : 'clean'}`}>
                                {s.similarityCoverage || 0}%
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '10.5px' }}>
                                {s.doiVerification?.verified ?? 0}/{s.doiVerification?.total ?? 0}
                              </span>
                            </td>
                            <td>
                              <a
                                href={`${API}/textguard/scans/${sid}/report`}
                                target="_blank"
                                rel="noreferrer"
                                className="tg-metric-action-link"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                              >
                                <Download size={11} /> PDF Report
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Official Integrity & Authenticity Audit Certificate Modal */}
      {showCertModal && scanResult && (
        <div className="tg-cert-overlay" onClick={() => setShowCertModal(false)}>
          <div className="tg-cert-modal" onClick={e => e.stopPropagation()}>
            <div className="tg-cert-body">
              <div className="tg-cert-header">
                <div className="tg-cert-seal">
                  <ShieldCheck size={32} />
                </div>
                <h1 className="tg-cert-title">TextGuard Academic Authenticity Certificate</h1>
                <p className="tg-cert-subtitle">Official Manuscript Originality & Crossref Scholarly Integrity Audit</p>
                <div style={{ display: 'inline-block', padding: '4px 12px', background: 'var(--surface2)', borderRadius: '12px', fontSize: '11px', fontWeight: 700, color: 'var(--muted)', marginTop: '8px' }}>
                  Certificate ID: TG-RP-{Date.now().toString(36).toUpperCase()}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '11.5px', marginBottom: '16px', padding: '12px', background: 'var(--surface2)', borderRadius: '10px' }}>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Manuscript Title:</span>{' '}
                  <strong>{activeDoc?.title || 'Academic Manuscript Draft'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Verification Date:</span>{' '}
                  <strong>{new Date().toLocaleString()}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Word Count Analyzed:</span>{' '}
                  <strong>{scanResult.analyzedWords || wordCount} words</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Exclusions Applied:</span>{' '}
                  <strong>
                    {excludeQuotes ? 'Quotes, ' : ''}
                    {excludeRefs ? 'Bibliography, ' : ''}
                    {excludeSmallPhrases ? 'Short phrases' : 'Standard'}
                  </strong>
                </div>
              </div>

              <div className="tg-cert-grid">
                <div className="tg-cert-stat">
                  <small>Originality Index</small>
                  <strong style={{ color: '#10b981' }}>{100 - scanResult.similarityScore}%</strong>
                </div>
                <div className="tg-cert-stat">
                  <small>Similarity Score</small>
                  <strong style={{ color: scanResult.similarityScore > 25 ? '#ef4444' : '#3b82f6' }}>{scanResult.similarityScore}%</strong>
                </div>
                <div className="tg-cert-stat">
                  <small>AI-Likelihood Heuristic</small>
                  <strong style={{ color: '#8876ee' }}>{scanResult.aiLikelihood || 12}%</strong>
                </div>
              </div>

              <div style={{ padding: '12px 14px', background: 'var(--surface2)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '10.5px', color: 'var(--muted)', lineHeight: '1.6' }}>
                <strong>Institutional Integrity Advisory:</strong> {scanResult.advisoryNotice || 'Document similarity indicates shared phrasing or internal repetition; it is NOT proof of plagiarism. Legitimate scientific writing routinely utilizes standardized methodologies, disciplinary terminology, and properly attributed citations.'}
              </div>
            </div>

            <div className="tg-cert-footer">
              <button className="secondary" onClick={() => setShowCertModal(false)}>
                Close
              </button>
              <button
                className="primary"
                onClick={() => window.print()}
                style={{ background: '#059669', borderColor: '#059669' }}
              >
                <Printer size={14} /> Print / Save as PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Source Text Comparison Modal */}
      {compareModalSource && (
        <div className="tg-modal-overlay" onClick={() => setCompareModalSource(null)}>
          <div className="tg-compare-modal-box" onClick={e => e.stopPropagation()}>
            <div className="tg-compare-modal-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <GitCompare size={18} color="#6366f1" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '13.5px' }}>Side-by-Side Passage & Evidence Comparison</h3>
                  <div style={{ fontSize: '10.5px', color: 'var(--muted)', marginTop: '2px' }}>
                    {compareModalSource.title}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="tg-resolve-close"
                onClick={() => setCompareModalSource(null)}
                title="Close modal"
              >
                <X size={14} />
              </button>
            </div>

            <div className="tg-compare-modal-body">
              {/* Source Provenance Header Banner */}
              <div style={{ padding: '12px 14px', background: 'var(--surface2)', borderRadius: '10px', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', fontSize: '11px' }}>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Authors & Year</span>
                  <strong>{compareModalSource.authors} {compareModalSource.year ? `(${compareModalSource.year})` : ''}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Publication / Registry</span>
                  <strong>{compareModalSource.journal || compareModalSource.publisher || compareModalSource.domain || 'Scholarly Index'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Match Contribution</span>
                  <strong style={{ color: compareModalSource.similarityContribution > 25 ? '#ef4444' : '#f59e0b' }}>
                    {compareModalSource.similarityContribution}% ({compareModalSource.matchedWordCount} words)
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)', display: 'block', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Verification Status</span>
                  <span className={`tg-metric-badge ${compareModalSource.verificationStatus?.includes('Verified') ? 'clean' : 'neutral'}`} style={{ marginTop: '2px' }}>
                    {compareModalSource.verificationStatus || 'Metadata Verified'}
                  </span>
                </div>
              </div>

              {/* Passages Side-by-Side Comparison */}
              {(compareModalSource.passages && compareModalSource.passages.length > 0) ? (
                compareModalSource.passages.map((p: any, idx: number) => (
                  <div key={p.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: idx < compareModalSource.passages.length - 1 ? '1px dashed var(--border)' : 'none', paddingBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--muted)' }}>
                        Passage {idx + 1} of {compareModalSource.passages.length}
                      </span>
                      <span className={`tg-metric-badge ${p.type === 'exact' ? 'elevated' : 'moderate'}`}>
                        {p.matchTypeLabel || p.type}
                      </span>
                    </div>

                    <div className="tg-compare-grid">
                      <div className="tg-compare-column">
                        <div className="tg-compare-column-title">
                          <span>Your Manuscript Passage</span>
                          <span>{(p.matchText || p.excerpt || '').trim().split(/\s+/).filter(Boolean).length} words</span>
                        </div>
                        <div className="tg-compare-column-text">
                          “{p.matchText || p.excerpt || '—'}”
                        </div>
                      </div>

                      <div className="tg-compare-column">
                        <div className="tg-compare-column-title">
                          <span>Retrieved Source Evidence</span>
                          <span>{(p.evidenceExcerpt || '').trim().split(/\s+/).filter(Boolean).length || '—'} words</span>
                        </div>
                        <div className="tg-compare-column-text" style={{ color: p.evidenceExcerpt ? 'var(--text)' : 'var(--muted)', fontStyle: p.evidenceExcerpt ? 'normal' : 'italic' }}>
                          {p.evidenceExcerpt ? `“${p.evidenceExcerpt}”` : (p.detail || 'Passage verbatim match identified in source index. Complete authorized text excerpt subject to publisher copyright.')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)', fontSize: '12px' }}>
                  No matching passage excerpts recorded for this source.
                </div>
              )}
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {compareModalSource.doi && (
                  <a
                    href={`https://doi.org/${compareModalSource.doi.replace(/^https?:\/\/doi\.org\//i, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tg-source-action-btn"
                  >
                    <ExternalLink size={11} /> Open DOI ({compareModalSource.doi.replace(/^https?:\/\/doi\.org\//i, '')})
                  </a>
                )}
                {(compareModalSource.url || compareModalSource.domain) && (
                  <a
                    href={compareModalSource.url || `https://${compareModalSource.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tg-source-action-btn"
                  >
                    <ExternalLink size={11} /> Open Original Source
                  </a>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="tg-source-action-btn"
                  onClick={() => {
                    const doiClean = compareModalSource.doi ? compareModalSource.doi.replace(/^https?:\/\/doi\.org\//i, '') : null;
                    const citation = `${compareModalSource.authors} (${compareModalSource.year || 'n.d.'}). ${compareModalSource.title}. ${compareModalSource.journal || compareModalSource.publisher || ''}. ${doiClean ? 'https://doi.org/' + doiClean : compareModalSource.url || ''}`.trim();
                    navigator.clipboard?.writeText(citation);
                    onSuccess?.(`✓ Copied formatted citation to clipboard.`);
                  }}
                >
                  <Copy size={11} /> Copy Citation
                </button>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => setCompareModalSource(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Filters Slide-In Drawer */}
      {filterDrawerOpen && (
        <div className="tg-filter-drawer-overlay" onClick={() => setFilterDrawerOpen(false)}>
          <div className="tg-filter-drawer" onClick={e => e.stopPropagation()}>
            {/* Drawer Header */}
            <div className="tg-filter-drawer-head">
              <div className="tg-filter-drawer-title">
                <Filter size={15} color="#6366f1" />
                <span>Advanced Verification Filters</span>
                {totalActiveFilterCount > 0 && (
                  <span className="tg-filter-badge">{totalActiveFilterCount}</span>
                )}
              </div>
              <button
                type="button"
                className="tg-resolve-close"
                onClick={() => setFilterDrawerOpen(false)}
                title="Close filter drawer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Filter Search */}
            <div className="tg-filter-search-box">
              <input
                type="text"
                placeholder="Search filter options (e.g., retracted, high, missing)..."
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                className="tg-filter-search-input"
              />
            </div>

            {/* Drawer Body: Collapsible Filter Categories */}
            <div className="tg-filter-drawer-body">
              {FILTER_CATEGORIES.map(category => {
                const selectedInCat = activeFilters[category.id] || [];
                const isCollapsed = Boolean(collapsedCategories[category.id]);
                const q = filterSearch.toLowerCase().trim();
                const visibleOptions = q
                  ? category.options.filter(o => o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q))
                  : category.options;

                if (q && visibleOptions.length === 0) return null;

                return (
                  <div key={category.id} className="tg-category-accordion">
                    <div
                      className="tg-category-head"
                      onClick={() => toggleCategoryCollapse(category.id)}
                    >
                      <div className="tg-category-title">
                        {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                        <span>{category.name}</span>
                        {selectedInCat.length > 0 && (
                          <span className="tg-filter-badge" style={{ minWidth: '16px', height: '16px', fontSize: '9.5px' }}>
                            {selectedInCat.length}
                          </span>
                        )}
                      </div>
                      <div className="tg-category-actions" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          className="tg-category-btn"
                          onClick={() => selectAllCategory(category.id)}
                          title="Select all in category"
                        >
                          Select all
                        </button>
                        <span style={{ color: 'var(--rp-border, #cbd5e1)' }}>·</span>
                        <button
                          type="button"
                          className="tg-category-btn"
                          onClick={() => clearCategory(category.id)}
                          title="Clear category"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {!isCollapsed && (
                      <div className="tg-category-options">
                        {visibleOptions.map(opt => {
                          const isChecked = selectedInCat.includes(opt.id);
                          return (
                            <label key={opt.id} className="tg-filter-checkbox-row">
                              <span className="tg-checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleFilter(category.id, opt.id)}
                                  style={{ cursor: 'pointer' }}
                                />
                                <span>{opt.label}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Drawer Footer */}
            <div className="tg-filter-drawer-foot">
              <button
                type="button"
                className="secondary small"
                onClick={resetAllFilters}
                disabled={totalActiveFilterCount === 0}
              >
                <RotateCcw size={11} style={{ marginRight: '4px' }} /> Reset all
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => setFilterDrawerOpen(false)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="primary small"
                  onClick={() => setFilterDrawerOpen(false)}
                >
                  Apply Filters {totalActiveFilterCount > 0 ? `(${totalActiveFilterCount})` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryPage({ revisions, token }: { revisions: Revision[]; token?: string }) {
  const [selected, setSelected] = useState<Revision | null>(null);
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<any>(null);

  async function handleCompare() {
    if (!selected) return;
    setComparing(true);
    try {
      const data = await request('/documents/compare', token || '', {
        originalText: selected.originalText,
        revisedText: selected.revisedText,
        title: `Revision ${selected.mode} (${new Date(selected.createdAt).toLocaleDateString()})`
      }, 'POST');
      setComparison(data.comparison || data);
    } catch (_) {}
    finally { setComparing(false); }
  }

  function handleSelect(r: Revision) {
    setSelected(r);
    setComparison(null);
  }

  return (
    <section className="analysis-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">YOUR RECORD</p>
          <h1>Revision history & Version Comparison</h1>
          <p className="muted">Complete chronological record of all proposed revisions with deep empirical comparison.</p>
        </div>
        <div className="page-title-icon"><History /></div>
      </div>

      <div className="panel history-panel">
        {revisions.length ? revisions.map(r => (
          <button className={`history-row ${selected?._id === r._id ? 'selected' : ''}`} key={r._id} onClick={() => handleSelect(r)}>
            <div className="mini-icon"><FileText size={17} /></div>
            <div className="list-main">
              <strong>{r.mode} mode {r.status ? `(${r.status})` : ''}</strong>
              <small>{new Date(r.createdAt).toLocaleString()} · {r.originalText.trim().split(/\s+/).length} words</small>
              <p>{r.summary || 'Revision recorded'}</p>
            </div>
            <ArrowRight size={14} className="row-arrow" />
          </button>
        )) : (
          <div className="empty-state">
            <History size={24} />
            <strong>No saved revisions</strong>
            <p>Revisions created in the Writing Studio will appear in this history timeline.</p>
          </div>
        )}
      </div>

      {selected && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface2)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div>
              <strong>Empirical Version Comparison</strong>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                Inspect citation additions/removals, statistical p-value consistency, and polarity shifts between drafts.
              </p>
            </div>
            <button
              className="primary"
              onClick={handleCompare}
              disabled={comparing}
              style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', fontSize: '12px', padding: '8px 14px' }}
            >
              {comparing ? <RefreshCw size={13} className="spin" /> : <GitCompare size={13} />} Run Empirical Comparison
            </button>
          </div>

          {comparison && (
            <div className="panel" style={{ border: '1px solid #3b82f6', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <span className="status-pill active" style={{ fontSize: '11px' }}>
                  {comparison.metrics?.wordCountDelta >= 0 ? `+${comparison.metrics?.wordCountDelta}` : comparison.metrics?.wordCountDelta} words ({comparison.metrics?.percentChange}%)
                </span>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  {comparison.metrics?.factsPreservedCount || 0} facts preserved · {comparison.metrics?.factsAlteredCount || 0} altered
                </span>
              </div>
              <p style={{ fontSize: '13px', lineHeight: 1.5, marginBottom: '14px', color: 'var(--text)' }}>
                {comparison.semanticDeltaSummary || comparison.comparisonSummary}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div style={{ background: 'var(--surface2)', padding: '10px', borderRadius: '6px' }}>
                  <small style={{ fontWeight: 700, color: 'var(--muted)' }}>Citations</small>
                  <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                    Added: {comparison.citations?.added?.length || 0} · Removed: {comparison.citations?.removed?.length || 0} · Kept: {comparison.citations?.preserved?.length || 0}
                  </p>
                </div>
                <div style={{ background: 'var(--surface2)', padding: '10px', borderRadius: '6px' }}>
                  <small style={{ fontWeight: 700, color: 'var(--muted)' }}>Quantitative P-Values</small>
                  <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                    Original: {comparison.statistics?.originalStats?.pValues?.length || 0} · Revised: {comparison.statistics?.revisedStats?.pValues?.length || 0}
                  </p>
                </div>
                <div style={{ background: 'var(--surface2)', padding: '10px', borderRadius: '6px' }}>
                  <small style={{ fontWeight: 700, color: 'var(--muted)' }}>Polarity & Claims</small>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: comparison.empiricalDeltas?.hasReversals ? '#ef4444' : '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {comparison.empiricalDeltas?.hasReversals ? (
                      <><AlertTriangle size={12} /> Warning: Potential claim reversal</>
                    ) : (
                      <><Check size={12} /> Preserved scientific polarity</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="comparison-grid">
            <div className="panel">
              <h3>Original Draft</h3>
              <p className="history-text">{selected.originalText}</p>
            </div>
            <div className="panel">
              <h3>Revised Proposal</h3>
              <p className="history-text">{selected.revisedText}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SettingsPage({ user, usage, dark, setDark, persist, setPersist, isCompact, setIsCompact, logout, onLinkGoogle, isGoogleConfigured, isOriginSupportedByGoogle, isLanHttpOrigin, googleClientId, token, setMessage, setError }: any) {
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [citationStyle, setCitationStyle] = useState('apa');
  const [rewriteMode, setRewriteMode] = useState('academic-clarity');
  const [meaningStrictness, setMeaningStrictness] = useState('high');
  const [saving, setSaving] = useState(false);
  const [systemVerification, setSystemVerification] = useState<any>(null);

  useEffect(() => {
    if (token) {
      request('/settings', token, undefined, 'GET').then(data => {
        if (data?.preferences) {
          if (data.preferences.defaultCitationStyle) setCitationStyle(data.preferences.defaultCitationStyle);
          if (data.preferences.defaultRewriteMode) setRewriteMode(data.preferences.defaultRewriteMode);
          if (data.preferences.meaningPreservationStrictness) setMeaningStrictness(data.preferences.meaningPreservationStrictness);
        }
        if (data?.displayName) setDisplayName(data.displayName);
      }).catch(() => {});
    }

    request('/system/verification', token, undefined, 'GET').then(v => {
      setSystemVerification(v);
    }).catch(() => {});
  }, [token]);

  async function handleSavePreferences(updated: any = {}) {
    setSaving(true);
    try {
      const payload = {
        displayName: updated.displayName !== undefined ? updated.displayName : displayName,
        preferences: {
          theme: updated.theme !== undefined ? updated.theme : (dark ? 'dark' : 'light'),
          compactSidebar: isCompact,
          defaultCitationStyle: updated.citationStyle || citationStyle,
          defaultRewriteMode: updated.rewriteMode || rewriteMode,
          meaningPreservationStrictness: updated.meaningStrictness || meaningStrictness
        }
      };
      await request('/settings', token, payload, 'PUT');
      setMessage?.('Research preferences updated & persisted.');
    } catch (err: any) {
      setError?.(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="analysis-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">PREFERENCES & TELEMETRY</p>
          <h1>Settings & Research Preferences</h1>
          <p className="muted">Configure profile identity, AI rewriting modes, citation styles, and inspect live service health.</p>
        </div>
        <div className="page-title-icon"><Settings2 /></div>
      </div>

      <div className="settings-list panel">
        {/* Profile & Identity */}
        <div className="setting-row">
          <div className="setting-icon"><ShieldCheck size={18} /></div>
          <div className="setting-copy" style={{ flex: 1 }}>
            <strong>Account & Researcher Profile</strong>
            <p>Signed in as <strong>{user?.email}</strong> · Role: <strong>{user?.role || 'researcher'}</strong> · Status: <strong>{user?.status || 'active'}</strong></p>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Researcher Display Name"
                style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '11px', width: '220px' }}
              />
              <button
                className="primary small"
                onClick={() => handleSavePreferences({ displayName })}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Name'}
              </button>
            </div>
            <div style={{ marginTop: '8px' }}>
              {(user?.authProviders || ['email']).map((p: string) => (
                <span key={p} className="provider-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={12} /> {p === 'google' ? 'Google Connected' : 'Password Auth'}
                </span>
              ))}
            </div>

            {/* Google Account Linking Section */}
            {user?.authProviders?.includes('google') ? (
              <div style={{ marginTop: '14px', background: 'var(--surface2)', padding: '12px 14px', borderRadius: '10px', border: '1px solid #10b98144' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 700, fontSize: '11.5px' }}>
                  <Check size={16} />
                  <span>Google Account Connected</span>
                </div>
                <p style={{ fontSize: '10.5px', color: 'var(--muted)', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                  Your Google identity ({user.email}) is securely linked. You can sign in using either Google or your password.
                </p>
              </div>
            ) : isGoogleConfigured && isOriginSupportedByGoogle ? (
              <div style={{ marginTop: '14px', background: 'var(--surface2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <strong style={{ fontSize: '11.5px', display: 'block', marginBottom: '4px' }}>Connect Google Account</strong>
                <p style={{ fontSize: '10.5px', color: 'var(--muted)', marginBottom: '12px', lineHeight: '1.4' }}>
                  Link your Google identity for instant one-click sign-in and verified researcher profile status.
                </p>
                <div className="google-btn-wrap" style={{ display: 'inline-block' }}>
                  <button
                    type="button"
                    className="google-oauth-redirect-btn link-btn"
                    onClick={() => {
                      const returnTo = encodeURIComponent(window.location.origin);
                      window.location.href = `${API}/auth/google/start?return_to=${returnTo}&action=link`;
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Connect Google Account</span>
                  </button>
                </div>
              </div>
            ) : isLanHttpOrigin ? (
              <div style={{ marginTop: '14px', background: 'var(--surface2)', padding: '14px', borderRadius: '10px', border: '1px solid #f59e0b44' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontWeight: 700, fontSize: '11.5px' }}>
                  <AlertTriangle size={15} />
                  <span>Google Linking Unavailable on HTTP LAN</span>
                </div>
                <p style={{ fontSize: '10.5px', color: 'var(--muted)', margin: '6px 0 0 0', lineHeight: '1.4' }}>
                  Google Identity Services strictly enforces HTTPS. OAuth linking cannot be initiated over plain HTTP network IPs (<code>{typeof window !== 'undefined' ? window.location.hostname : 'LAN'}</code>).
                </p>
                <p style={{ fontSize: '10.5px', color: 'var(--text)', margin: '6px 0 0 0', lineHeight: '1.4' }}>
                  To link your Google account, open ResearchProof AI via <a href={`http://localhost:${typeof window !== 'undefined' ? window.location.port || '5173' : '5173'}`} style={{ color: '#8876ee', textDecoration: 'underline' }}>http://localhost:{typeof window !== 'undefined' ? window.location.port || '5173' : '5173'}</a> or through your production HTTPS URL.
                </p>
              </div>
            ) : (
              <div style={{ marginTop: '14px', background: 'var(--surface2)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--muted)', fontWeight: 700, fontSize: '11.5px' }}>
                  <CircleHelp size={15} />
                  <span>Connect Google Account (Configuration Required)</span>
                </div>
                <p style={{ fontSize: '10.5px', color: 'var(--muted)', margin: '6px 0 0 0', lineHeight: '1.4' }}>
                  Google OAuth Web Client is not configured on this environment. Set <code>VITE_GOOGLE_CLIENT_ID</code> in the frontend environment or <code>GOOGLE_CLIENT_ID</code> in backend settings to activate one-click Google account linking.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Unlimited AI Usage Tier */}
        <div className="setting-row">
          <div className="setting-icon"><Gauge size={18} /></div>
          <div className="setting-copy">
            <strong>Unlimited Academic AI Processing Tier</strong>
            <p>
              AI rewriting: <strong>Unlimited</strong> (No daily limits or artificial 0/5 restrictions) · Plagiarism & Authenticity scans: <strong>Unlimited</strong> · Reference DOI checks: <strong>Unlimited</strong>.
            </p>
            <div style={{ marginTop: '6px', fontSize: '10px', fontWeight: 600, color: '#34c98b' }}>
              ● AI Provider & TextGuard Engine Active (Unlimited Mode)
            </div>
          </div>
        </div>

        {/* Research & Citation Preferences */}
        <div className="setting-row">
          <div className="setting-icon"><BookOpenCheck size={18} /></div>
          <div className="setting-copy" style={{ flex: 1 }}>
            <strong>Research & Citation Defaults</strong>
            <p>Select your default academic citation style and preferred AI rewriting framing.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '10px' }}>
              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>DEFAULT CITATION STYLE</label>
                <select
                  value={citationStyle}
                  onChange={e => {
                    setCitationStyle(e.target.value);
                    handleSavePreferences({ citationStyle: e.target.value });
                  }}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '11px' }}
                >
                  <option value="apa">APA 7th Edition</option>
                  <option value="mla">MLA 9th Edition</option>
                  <option value="ieee">IEEE Standard</option>
                  <option value="chicago">Chicago 17th Edition</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>DEFAULT REWRITING MODE</label>
                <select
                  value={rewriteMode}
                  onChange={e => {
                    setRewriteMode(e.target.value);
                    handleSavePreferences({ rewriteMode: e.target.value });
                  }}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '11px' }}
                >
                  <option value="academic-clarity">Academic Clarity & Precision</option>
                  <option value="formal-scientific">Formal Scientific Literature</option>
                  <option value="humanize">TextGuard Humanizer (Low AI Footprint)</option>
                  <option value="standard">Standard Fluency</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>MEANING PRESERVATION STRICTNESS</label>
                <select
                  value={meaningStrictness}
                  onChange={e => {
                    setMeaningStrictness(e.target.value);
                    handleSavePreferences({ meaningStrictness: e.target.value });
                  }}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '11px' }}
                >
                  <option value="strict">Strict (Halt on any p-value or sample alteration)</option>
                  <option value="high">High (Prominent diff confirmation dialog)</option>
                  <option value="standard">Standard (Advisory badge)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Appearance & Theme */}
        <div className="setting-row">
          <div className="setting-icon"><Sun size={18} /></div>
          <div className="setting-copy">
            <strong>Appearance & Layout</strong>
            <p>Customize workspace theme and collapsible navigation drawer.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="secondary small" onClick={() => {
              const next = !dark;
              setDark(next);
              handleSavePreferences({ theme: next ? 'dark' : 'light' });
            }}>
              {dark ? 'Dark mode' : 'Light mode'} · Toggle
            </button>
            {setIsCompact && (
              <button className="secondary small" onClick={() => {
                const next = !isCompact;
                setIsCompact(next);
                handleSavePreferences();
              }}>
                {isCompact ? 'Compact Sidebar' : 'Expanded Sidebar'}
              </button>
            )}
          </div>
        </div>

        {/* Manuscript Persistence */}
        <div className="setting-row">
          <div className="setting-icon"><History size={18} /></div>
          <div className="setting-copy">
            <strong>Manuscript Cloud Persistence</strong>
            <p>Automatically save revision history and document drafts to your private workspace.</p>
          </div>
          <label className="switch-label">
            <input type="checkbox" checked={persist} onChange={e => {
              setPersist(e.target.checked);
              handleSavePreferences();
            }} />
            <span>{persist ? 'On' : 'Off'}</span>
          </label>
        </div>

        {/* Sign Out */}
        <div className="setting-row">
          <div className="setting-icon"><LogOut size={18} /></div>
          <div className="setting-copy">
            <strong>Sign out</strong>
            <p>End the current session on this device.</p>
          </div>
          <button className="secondary small" onClick={logout}>Sign out</button>
        </div>
      </div>

      {/* SYSTEM VERIFICATION PANEL */}
      <div className="panel" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '14px', margin: 0 }}>System Health & Infrastructure Verification</h3>
            <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
              Live connection telemetry across similarity engines, Crossref APIs, AI backends, and PDF compilers.
            </p>
          </div>
          <button
            className="secondary small"
            onClick={() => {
              request('/system/verification', token, undefined, 'GET').then(v => setSystemVerification(v)).catch(() => {});
            }}
            style={{ fontSize: '10px' }}
          >
            <RefreshCw size={11} /> Refresh Health
          </button>
        </div>

        {systemVerification ? (
          <div className="system-verification-grid">
            <div className="sys-card">
              <div className="sys-title">Similarity Engine</div>
              <div className="sys-val">
                <span className="sys-dot operational" />
                {systemVerification.services?.similarityEngine?.version || 'TextGuard 2.0'}
              </div>
              <div style={{ fontSize: '9.5px', color: 'var(--muted)', marginTop: '4px' }}>
                Exact, Shingling & MinHash
              </div>
            </div>

            <div className="sys-card">
              <div className="sys-title">Crossref Scholarly API</div>
              <div className="sys-val">
                <span className={`sys-dot ${systemVerification.services?.crossrefApi?.status?.includes('operational') ? 'operational' : 'degraded'}`} />
                {systemVerification.services?.crossrefApi?.status || 'Operational'}
              </div>
              <div style={{ fontSize: '9.5px', color: 'var(--muted)', marginTop: '4px' }}>
                {systemVerification.services?.crossrefApi?.provider || 'REST API v1'}
              </div>
            </div>

            <div className="sys-card">
              <div className="sys-title">Academic AI Provider</div>
              <div className="sys-val">
                <span className="sys-dot operational" />
                Unlimited Tier
              </div>
              <div style={{ fontSize: '9.5px', color: 'var(--muted)', marginTop: '4px' }}>
                {systemVerification.services?.aiProvider?.defaultModel || 'Academic Rewrite'}
              </div>
            </div>

            <div className="sys-card">
              <div className="sys-title">PDF Report Generator</div>
              <div className="sys-val">
                <span className="sys-dot operational" />
                Binary PDF-1.4 Native
              </div>
              <div style={{ fontSize: '9.5px', color: 'var(--muted)', marginTop: '4px' }}>
                6-Section Standard Layout
              </div>
            </div>

            <div className="sys-card">
              <div className="sys-title">Primary Database</div>
              <div className="sys-val">
                <span className="sys-dot operational" />
                {systemVerification.services?.database?.cluster || 'Operational'}
              </div>
              <div style={{ fontSize: '9.5px', color: 'var(--muted)', marginTop: '4px' }}>
                Indexed user isolation
              </div>
            </div>

            <div className="sys-card">
              <div className="sys-title">Meaning Preservation Engine</div>
              <div className="sys-val">
                <span className="sys-dot operational" />
                Active Guardrail
              </div>
              <div style={{ fontSize: '9.5px', color: 'var(--muted)', marginTop: '4px' }}>
                p-values, $n$, CIs, citations
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '11px' }}>
            Checking system infrastructure connectivity...
          </div>
        )}
      </div>
    </section>
  );
}

/* =========================================================
   PHASE 3: RESEARCH INTEGRITY REPORTS VIEW
   ========================================================= */
function IntegrityReportsPage({ token, documents, activeDoc, setMessage, setError }: any) {
  const [selectedDocId, setSelectedDocId] = useState(activeDoc?._id || '');
  const [reportText, setReportText] = useState(activeDoc?.content || sampleText);
  const [currentReport, setCurrentReport] = useState<any>(null);
  const [currentDossier, setCurrentDossier] = useState<any>(null);
  const [currentChecklist, setCurrentChecklist] = useState<any>(null);
  const [targetPublisher, setTargetPublisher] = useState('nature');
  const [pastReports, setPastReports] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<'findings' | 'dossier' | 'checklist'>('dossier');
  const [copiedHash, setCopiedHash] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    try {
      const data = await request('/integrity/reports', token, undefined, 'GET');
      setPastReports(data);
    } catch (_) {}
  }

  async function handleRunAudit() {
    setBusy(true);
    try {
      const res = await request('/integrity/reports', token, {
        documentId: selectedDocId || undefined,
        text: reportText,
        title: activeDoc?.title ? `Integrity Audit: ${activeDoc.title}` : 'Research Integrity Audit'
      });
      setCurrentReport(res);
      setActiveTab('findings');
      setMessage(`Audit complete: ${res.summaryMetrics.totalFindings} findings identified.`);
      await fetchReports();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateDossier() {
    if (!reportText.trim()) return;
    setBusy(true);
    try {
      const res = await request('/integrity/dossier', token, {
        documentId: selectedDocId || undefined,
        text: reportText,
        title: activeDoc?.title ? `Integrity Dossier: ${activeDoc.title}` : 'Comprehensive Research Integrity Dossier'
      }, 'POST');
      setCurrentDossier(res);
      setActiveTab('dossier');
      setMessage('Comprehensive Research Integrity Dossier generated with SHA-256 validation!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateChecklist() {
    if (!reportText.trim()) return;
    setBusy(true);
    try {
      const res = await request('/integrity/submission-checklist', token, {
        text: reportText,
        publisher: targetPublisher
      }, 'POST');
      setCurrentChecklist(res.checklist || res);
      setActiveTab('checklist');
      setMessage(`Submission checklist generated for ${res.checklist?.targetJournal?.name || targetPublisher}!`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleExportDocx(reportId: string, title: string) {
    try {
      const res = await fetch(`${API}/integrity/reports/${reportId}/export?format=docx`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('DOCX export failed.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleCopyHash(hash: string) {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  }

  return (
    <section className="analysis-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">INSTITUTIONAL RESEARCH RIGOR</p>
          <h1>Comprehensive Research Integrity Dossier</h1>
          <p className="muted">
            Consolidated scorecard for similarity, AI likelihood, citation integrity, statistical precision & 5 journal publisher profiles with SHA-256 cryptographic verification.
          </p>
        </div>
        <div className="page-title-icon"><FileCheck2 /></div>
      </div>

      <div className="panel" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <select
            value={selectedDocId}
            onChange={(e) => {
              setSelectedDocId(e.target.value);
              const found = documents.find((d: any) => d._id === e.target.value);
              if (found) setReportText(found.content);
            }}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }}
          >
            <option value="">Manual / Custom Text Input</option>
            {documents.map((d: any) => (
              <option key={d._id} value={d._id}>{d.title} ({d.wordCount} words)</option>
            ))}
          </select>

          <button
            className="primary"
            onClick={handleGenerateDossier}
            disabled={busy || !reportText.trim()}
            style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}
          >
            {busy ? <RefreshCw size={14} className="spin" /> : <ShieldCheck size={14} />} ⚡ Generate Institutional Dossier
          </button>

          <button
            className="secondary"
            onClick={handleGenerateChecklist}
            disabled={busy || !reportText.trim()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            📋 Pre-Flight Submission Checklist
          </button>

          <button className="secondary" onClick={handleRunAudit} disabled={busy || !reportText.trim()}>
            Heuristic Check
          </button>
        </div>

        <textarea
          value={reportText}
          onChange={(e) => setReportText(e.target.value)}
          rows={5}
          style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'monospace', fontSize: '12px' }}
          placeholder="Paste or edit manuscript excerpt to audit..."
        />
      </div>

      {/* Tabs */}
      {(currentDossier || currentReport || currentChecklist) && (
        <div className="qb-modes" style={{ gap: '8px', marginBottom: '18px' }}>
          {currentDossier && (
            <button
              className={`qb-mode-btn ${activeTab === 'dossier' ? 'active' : ''}`}
              onClick={() => setActiveTab('dossier')}
            >
              🏆 Comprehensive Dossier (SHA-256 & Publisher Compliance)
            </button>
          )}
          {currentChecklist && (
            <button
              className={`qb-mode-btn ${activeTab === 'checklist' ? 'active' : ''}`}
              onClick={() => setActiveTab('checklist')}
            >
              📋 Pre-Flight Submission Checklist ({currentChecklist.readinessScore}% Ready)
            </button>
          )}
          {currentReport && (
            <button
              className={`qb-mode-btn ${activeTab === 'findings' ? 'active' : ''}`}
              onClick={() => setActiveTab('findings')}
            >
              📑 Heuristic Issue Breakdown ({currentReport.findings?.length || 0})
            </button>
          )}
        </div>
      )}

      {/* COMPREHENSIVE RESEARCH INTEGRITY DOSSIER VIEW (PILLAR 3) */}
      {activeTab === 'dossier' && currentDossier && (
        <div style={{ marginBottom: '28px' }}>
          {/* Dossier Hero Bar */}
          <div className="dossier-hero">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span className="status-pill active" style={{ fontSize: '10px' }}>Institutional Certificate</span>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  ID: {currentDossier.reportId} · Verified {new Date(currentDossier.generatedAt).toLocaleString()}
                </span>
              </div>
              <h2 style={{ margin: '4px 0 6px', fontSize: '20px', fontWeight: 800 }}>{currentDossier.title}</h2>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                {currentDossier.wordCount} words evaluated against TextGuard similarity, AI heuristics, citation integrity, and 5 journal profiles.
              </p>
            </div>

            <div className="dossier-qr-wrap">
              <div dangerouslySetInnerHTML={{ __html: currentDossier.qrSvg }} />
              <div>
                <small style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  SHA-256 Cryptographic Hash
                </small>
                <div className="dossier-hash-box">
                  {currentDossier.verificationHash.slice(0, 32)}...
                </div>
                <div style={{ marginTop: '6px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    className="text-button"
                    onClick={() => handleCopyHash(currentDossier.verificationHash)}
                    style={{ fontSize: '10px', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                  >
                    {copiedHash ? <><Check size={11} /> Copied</> : 'Copy Hash'}
                  </button>
                  <a
                    href={`${API}/integrity/verify/${currentDossier.verificationHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-button"
                    style={{ fontSize: '10px', padding: '2px 6px', color: '#3b82f6', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    🔍 Verify Public Certificate
                  </a>
                  <button
                    className="text-button"
                    onClick={() => window.print()}
                    style={{ fontSize: '11px', padding: '2px 8px', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Printer size={12} /> Print PDF
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Consolidated Scorecard (4 Metrics) */}
          <div className="dossier-scorecard-grid">
            <div className="dossier-stat-box" style={{ borderColor: '#10b981' }}>
              <small>Composite Integrity Index</small>
              <strong style={{ color: '#10b981' }}>{currentDossier.compositeIntegrityScore}/100</strong>
              <span className="status-pill active" style={{ fontSize: '10px', marginTop: '6px' }}>
                {currentDossier.compositeIntegrityScore >= 90 ? 'High Integrity' : 'Review Recommended'}
              </span>
            </div>

            <div className="dossier-stat-box">
              <small>TextGuard Similarity</small>
              <strong style={{ color: currentDossier.scorecard.plagiarism.similarityScore > 20 ? '#ef4444' : '#3b82f6' }}>
                {currentDossier.scorecard.plagiarism.similarityScore}%
              </strong>
              <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>
                {currentDossier.scorecard.plagiarism.originalityScore}% Unique prose
              </div>
            </div>

            <div className="dossier-stat-box">
              <small>AI-Likelihood Heuristic</small>
              <strong style={{ color: '#8876ee' }}>
                {currentDossier.scorecard.aiAuthorship.aiLikelihood}%
              </strong>
              <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>
                Burstiness: {currentDossier.scorecard.aiAuthorship.burstinessScore} σ
              </div>
            </div>

            <div className="dossier-stat-box">
              <small>Statistical Rigor</small>
              <strong style={{ color: '#059669' }}>
                {currentDossier.scorecard.statisticalRigor.rigorScore}%
              </strong>
              <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>
                {currentDossier.scorecard.statisticalRigor.totalPValuesReported} p-values · {currentDossier.scorecard.statisticalRigor.confidenceIntervalsCount} CIs
              </div>
            </div>
          </div>

          {/* 5 Journal Publisher Profiles */}
          <div style={{ margin: '24px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '15px' }}>Journal Publisher Submission Profiles (5 Standards)</h3>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Pre-submission automated formatting & disclosure rulesets</span>
            </div>

            <div className="publisher-profile-grid">
              {currentDossier.publisherProfiles?.map((pub: any) => (
                <div key={pub.id} className="pub-card">
                  <div className="pub-card-head">
                    <strong style={{ fontSize: '13px' }}>{pub.name}</strong>
                    <span className={`status-pill ${pub.isCompliant ? 'active' : 'warning'}`}>
                      {pub.isCompliant ? 'Compliant' : 'Action Needed'}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)', lineHeight: 1.4 }}>
                    {pub.description}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                    {pub.checks?.map((c: any) => (
                      <div key={c.id} className="pub-card-rule">
                        <span className={c.passed ? 'pub-rule-pass' : 'pub-rule-fail'} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          {c.passed ? <Check size={11} /> : <X size={11} />}
                        </span>
                        <div>
                          <strong style={{ fontSize: '11px', color: 'var(--text)' }}>{c.name}</strong>
                          {!c.passed && (
                            <div style={{ fontSize: '10px', color: '#b91c1c', marginTop: '2px' }}>
                              {c.guidance}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PRE-FLIGHT SUBMISSION CHECKLIST VIEW (FEATURE 3) */}
      {activeTab === 'checklist' && currentChecklist && (
        <div style={{ marginBottom: '28px' }}>
          <div className="dossier-hero" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <span className={`status-pill ${currentChecklist.readinessScore >= 80 ? 'active' : 'warning'}`}>
                  {currentChecklist.status}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  Target: <strong>{currentChecklist.targetPublisher || currentChecklist.targetJournal?.name}</strong> · {currentChecklist.wordCount} words
                </span>
              </div>
              <h2 style={{ margin: '4px 0 8px', fontSize: '20px', fontWeight: 800 }}>Pre-Flight Submission Checklist</h2>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', maxWidth: '650px' }}>
                Comprehensive institutional evaluation of IMRAD structure, disciplinary declarations, citation alignment, figure/table callouts, and target publisher guidelines.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>Target Journal Profile</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <select
                  value={targetPublisher}
                  onChange={(e) => setTargetPublisher(e.target.value)}
                  style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '12px' }}
                >
                  <option value="nature">Nature Portfolio</option>
                  <option value="ieee">IEEE Transactions</option>
                  <option value="elsevier">Elsevier Journals</option>
                  <option value="springer">Springer / Nature SN</option>
                  <option value="plos_one">PLOS ONE</option>
                </select>
                <button
                  className="primary small"
                  onClick={handleGenerateChecklist}
                  disabled={busy}
                  style={{ fontSize: '11px', padding: '6px 10px' }}
                >
                  {busy ? <RefreshCw size={12} className="spin" /> : 'Check'}
                </button>
              </div>

              <div style={{ textAlign: 'center', padding: '8px', borderRadius: '6px', background: 'var(--surface2)', marginTop: '4px' }}>
                <small style={{ fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Readiness Score</small>
                <div style={{ fontSize: '22px', fontWeight: 900, color: currentChecklist.readinessScore >= 80 ? '#10b981' : '#f59e0b' }}>
                  {currentChecklist.readinessScore}%
                </div>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="dossier-scorecard-grid" style={{ margin: '18px 0' }}>
            <div className="dossier-stat-box">
              <small>IMRAD Core Structure</small>
              <strong style={{ color: currentChecklist.structure?.isIMRaDCompliant ? '#10b981' : '#f59e0b' }}>
                {currentChecklist.structure?.isIMRaDCompliant ? 'Compliant' : 'Incomplete'}
              </strong>
              <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>
                {currentChecklist.structure?.missingSections?.length === 0
                  ? 'All 4 canonical sections present'
                  : `Missing: ${currentChecklist.structure?.missingSections?.join(', ')}`}
              </div>
            </div>

            <div className="dossier-stat-box">
              <small>Declarations & Ethics</small>
              <strong style={{ color: currentChecklist.declarations?.hasDataAvailability && currentChecklist.declarations?.hasCompetingInterests ? '#10b981' : '#f59e0b' }}>
                {currentChecklist.declarations?.hasDataAvailability && currentChecklist.declarations?.hasCompetingInterests ? 'Complete' : 'Attention'}
              </strong>
              <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                  Data: {currentChecklist.declarations?.hasDataAvailability ? <Check size={11} color="#10b981" /> : <X size={11} color="#ef4444" />}
                </span>
                <span>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                  Competing: {currentChecklist.declarations?.hasCompetingInterests ? <Check size={11} color="#10b981" /> : <X size={11} color="#ef4444" />}
                </span>
              </div>
            </div>

            <div className="dossier-stat-box">
              <small>Figures & Tables</small>
              <strong style={{ color: '#3b82f6' }}>
                {(currentChecklist.figuresAndTables?.figureCalloutsFound?.length || 0) + (currentChecklist.figuresAndTables?.tableCalloutsFound?.length || 0)} Assets
              </strong>
              <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>
                {currentChecklist.figuresAndTables?.figureCalloutsFound?.length || 0} Figures · {currentChecklist.figuresAndTables?.tableCalloutsFound?.length || 0} Tables
              </div>
            </div>

            <div className="dossier-stat-box">
              <small>Submission Items</small>
              <strong style={{ color: '#059669' }}>
                {currentChecklist.summary?.passedChecks}/{currentChecklist.summary?.totalChecks}
              </strong>
              <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>
                {currentChecklist.summary?.warningChecks || 0} warnings · {currentChecklist.summary?.infoChecks || 0} informational
              </div>
            </div>
          </div>

          {/* Itemized Checklist Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3 style={{ fontSize: '14px', margin: '8px 0 4px' }}>Submission Requirements Breakdown</h3>
            {currentChecklist.checklistItems?.map((item: any, idx: number) => {
              const isPass = item.status === 'passed';
              const isWarn = item.status === 'warning';
              return (
                <div
                  key={idx}
                  className="panel"
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    borderLeft: `4px solid ${isPass ? '#10b981' : (isWarn ? '#f59e0b' : '#3b82f6')}`
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                        {item.category}
                      </span>
                      <strong style={{ fontSize: '13px' }}>{item.name}</strong>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: isWarn ? 'var(--text)' : 'var(--muted)', lineHeight: 1.4 }}>
                      {item.details}
                    </p>
                  </div>
                  <div>
                    <span className={`status-pill ${isPass ? 'active' : (isWarn ? 'warning' : '')}`} style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                      {item.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STANDARD HEURISTICS REPORT VIEW */}
      {activeTab === 'findings' && currentReport && (
        <div style={{ marginBottom: '28px' }}>
          <div className="stat-grid">
            <div className="stat-card">
              <span className="stat-label">Total Words</span>
              <span className="stat-value">{currentReport.summaryMetrics?.wordCount || 0}</span>
              <span className="stat-sub">Analyzed tokens</span>
            </div>
            <div className="stat-card" style={{ borderColor: '#fca5a5' }}>
              <span className="stat-label" style={{ color: '#b91c1c' }}>High Priority</span>
              <span className="stat-value" style={{ color: '#b91c1c' }}>{currentReport.summaryMetrics?.highPriorityCount || 0}</span>
              <span className="stat-sub">Action required</span>
            </div>
            <div className="stat-card" style={{ borderColor: '#fde68a' }}>
              <span className="stat-label" style={{ color: '#b45309' }}>Review Recommended</span>
              <span className="stat-value" style={{ color: '#b45309' }}>{currentReport.summaryMetrics?.reviewRecommendedCount || 0}</span>
              <span className="stat-sub">Advisory review</span>
            </div>
            <div className="stat-card">
              <span className="stat-label" style={{ color: '#0369a1' }}>Informational</span>
              <span className="stat-value" style={{ color: '#0369a1' }}>{currentReport.summaryMetrics?.informationalCount || 0}</span>
              <span className="stat-sub">Stylistic notices</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '16px', margin: 0 }}>Audit Findings ({currentReport.findings?.length || 0})</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="secondary small" onClick={() => handleExportDocx(currentReport._id, currentReport.title)}>
                <Download size={13} /> Export DOCX
              </button>
              <button className="secondary small" onClick={() => {
                const blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `integrity-report-${currentReport._id}.json`;
                a.click();
              }}>
                <Download size={13} /> Export JSON
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {currentReport.findings?.length > 0 ? (
              currentReport.findings.map((f: any, i: number) => {
                const sev = f.severity?.includes('high') || f.severity === 'critical' ? 'high' : (f.severity?.includes('review') ? 'medium' : 'low');
                return (
                  <div key={i} className="panel" style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className={`severity-pill ${sev}`}>{f.severity.replace(/_/g, ' ')}</span>
                      <small style={{ color: 'var(--muted)', fontSize: '10px' }}>Category: {f.category}</small>
                    </div>
                    <strong style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>{f.evidenceLocation}</strong>
                    <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 8px 0', lineHeight: 1.5 }}>{f.explanation}</p>
                    <div style={{ fontSize: '10px', background: 'var(--surface2)', padding: '6px 10px', borderRadius: '6px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text)' }}>Action: </span>
                      <span style={{ color: 'var(--muted)' }}>{f.suggestedAction}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="panel empty-state">
                <Check size={28} style={{ color: '#15803d' }} />
                <strong>Clean Manuscript Audit</strong>
                <p>No critical structural or semantic meaning deviations detected.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {pastReports.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '12px' }}>Audit History</h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Report Title</th>
                  <th>Generated</th>
                  <th>Status</th>
                  <th>Findings</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pastReports.map((r: any) => (
                  <tr key={r._id}>
                    <td><strong>{r.title}</strong></td>
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                    <td><span className="status-pill active">{r.reviewStatus}</span></td>
                    <td>{r.summaryMetrics?.totalFindings || 0} issues</td>
                    <td>
                      <button className="text-button" onClick={async () => {
                        const full = await request(`/integrity/reports/${r._id}`, token, undefined, 'GET');
                        setCurrentReport(full);
                        setActiveTab('findings');
                      }}>View Report</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

/* =========================================================
   PHASE 3: PRIVACY CONTROL CENTER & DATA DELETION
   ========================================================= */
function PrivacyPage({ token, user, projects, documents, revisions, citations, setMessage, setError, logout }: any) {
  const [settings, setSettings] = useState<any>({ persistDocumentText: true, allowAiProcessing: true });
  const [policies, setPolicies] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [confirmGoogleDelete, setConfirmGoogleDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    request('/privacy/settings', token, undefined, 'GET')
      .then(d => {
        setSettings(d.settings);
        setPolicies(d.policies);
      })
      .catch(() => {});
  }, []);

  async function handleTogglePersistence(val: boolean) {
    try {
      const res = await request('/privacy/settings', token, { persistDocumentText: val }, 'PATCH');
      setSettings(res.settings);
      setMessage(`Manuscript persistence updated: ${val ? 'Enabled' : 'Disabled (Stateless Mode)'}`);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleToggleAiProcessing(val: boolean) {
    try {
      const res = await request('/privacy/settings', token, { allowAiProcessing: val }, 'PATCH');
      setSettings(res.settings);
      setMessage(`AI data processing preference updated: ${val ? 'Consented' : 'Revoked'}`);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleExportData() {
    try {
      const res = await fetch(`${API}/privacy/export`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Data export failed.');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `researchproof-data-export-${user?.id || 'account'}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('Account data export downloaded successfully.');
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const res = await request('/privacy/delete-account', token, {
        password: deletePassword || undefined,
        confirm: confirmGoogleDelete || undefined
      });
      if (res.success) {
        alert('Your account and research data have been permanently deleted.');
        logout();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="analysis-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">PRIVACY BY DESIGN</p>
          <h1>Privacy & Data Management</h1>
          <p className="muted">Transparent controls over your research manuscripts, cloud retention, data exports, and deletion.</p>
        </div>
        <div className="page-title-icon"><ShieldAlert /></div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Saved Documents</span>
          <span className="stat-value">{documents?.length || 0}</span>
          <span className="stat-sub">Manuscript drafts</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Research Projects</span>
          <span className="stat-value">{projects?.length || 0}</span>
          <span className="stat-sub">Active project workspaces</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Revision History</span>
          <span className="stat-value">{revisions?.length || 0}</span>
          <span className="stat-sub">Recorded edits</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Citations Stored</span>
          <span className="stat-value">{citations?.length || 0}</span>
          <span className="stat-sub">Bibliographic entries</span>
        </div>
      </div>

      <div className="settings-list panel" style={{ marginBottom: '24px' }}>
        <div className="setting-row">
          <div className="setting-icon"><History size={18} /></div>
          <div className="setting-copy">
            <strong>Manuscript Cloud Persistence</strong>
            <p>When enabled, active document text and revision proposals are saved in your private MongoDB database. When disabled, the editor operates in stateless mode.</p>
            {policies?.serverPersistEnforced && (
              <small style={{ color: '#b45309', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                <AlertTriangle size={12} /> Server policy overrides local preference: PERSIST_DOCUMENT_TEXT is globally disabled on this deployment.
              </small>
            )}
          </div>
          <label className="switch-label">
            <input
              type="checkbox"
              checked={settings.persistDocumentText}
              disabled={policies?.serverPersistEnforced}
              onChange={e => handleTogglePersistence(e.target.checked)}
            />
            <span>{settings.persistDocumentText ? 'Active' : 'Disabled'}</span>
          </label>
        </div>

        <div className="setting-row">
          <div className="setting-icon"><Sparkles size={18} /></div>
          <div className="setting-copy">
            <strong>AI Provider Processing Consent</strong>
            <p>Consent to transmitting selected paragraphs to configured LLM providers for academic revision. Zero manuscript text is retained by providers for model training.</p>
          </div>
          <label className="switch-label">
            <input
              type="checkbox"
              checked={settings.allowAiProcessing}
              onChange={e => handleToggleAiProcessing(e.target.checked)}
            />
            <span>{settings.allowAiProcessing ? 'Consented' : 'Opted Out'}</span>
          </label>
        </div>

        <div className="setting-row">
          <div className="setting-icon"><Download size={18} /></div>
          <div className="setting-copy">
            <strong>Download Complete Data Export (GDPR / CCPA)</strong>
            <p>Receive a structured JSON archive containing your profile, projects, manuscripts, citations, and revision timeline. Excludes authentication secrets.</p>
          </div>
          <button className="secondary small" onClick={handleExportData}>
            <Download size={13} /> Export My Data
          </button>
        </div>

        <div className="setting-row">
          <div className="setting-icon"><FileCheck2 size={18} /></div>
          <div className="setting-copy">
            <strong>Erase TextGuard Scan History</strong>
            <p>Permanently remove all previous document similarity scans, matched passage caches, and generated PDF reports from cloud storage.</p>
          </div>
          <button className="secondary small" style={{ color: '#ef4444', borderColor: '#ef4444' }} onClick={async () => {
            if (!confirm('Are you sure you want to permanently erase all your TextGuard authenticity scans and reports? This action cannot be undone.')) return;
            try {
              const res = await request('/privacy/scans', token, undefined, 'DELETE');
              setMessage(res.message || 'All scan history erased.');
            } catch (err: any) {
              setError(err.message);
            }
          }}>
            <Trash2 size={13} /> Erase All Scans
          </button>
        </div>
      </div>

      {/* DANGER ZONE */}
      <div className="danger-zone">
        <h3>Permanent Account & Data Deletion</h3>
        <p>
          Deleting your account is permanent and irreversible. All your stored projects, documents, revisions, citations, and integrity audit records will be purged immediately from primary storage.
        </p>
        <button className="primary" style={{ background: '#b91c1c', borderColor: '#991b1b' }} onClick={() => setShowDeleteModal(true)}>
          <Trash2 size={14} /> Delete My Account & Research Data
        </button>
      </div>

      {/* DELETION CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <h3 style={{ color: '#b91c1c' }}>Confirm Account Purge</h3>
            <p>
              Are you sure you want to delete account <strong>{user?.email}</strong>? All {documents?.length || 0} manuscripts and {citations?.length || 0} citations will be erased.
            </p>

            {user?.authProviders?.includes('email') ? (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '11px', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                  Enter your current password to confirm:
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  placeholder="Your password"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }}
                />
              </div>
            ) : (
              <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '11px', marginBottom: '16px' }}>
                <input
                  type="checkbox"
                  checked={confirmGoogleDelete}
                  onChange={e => setConfirmGoogleDelete(e.target.checked)}
                />
                I understand this Google-authenticated account and all data will be permanently purged.
              </label>
            )}

            <div className="modal-actions">
              <button className="secondary" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                Cancel
              </button>
              <button
                className="primary"
                style={{ background: '#b91c1c', borderColor: '#991b1b' }}
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Confirm Permanent Deletion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* =========================================================
   PHASE 3: ADMINISTRATOR OVERVIEW VIEW
   ========================================================= */
function AdminOverviewPage({ token, setError }: any) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    request('/admin/overview', token, undefined, 'GET')
      .then(d => setData(d))
      .catch(e => setError(e.message));
  }, []);

  if (!data) {
    return (
      <div className="analysis-page">
        <div className="panel empty-state">Loading administrator metrics...</div>
      </div>
    );
  }

  return (
    <section className="analysis-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">PLATFORM MANAGEMENT</p>
          <h1>Administrator Overview</h1>
          <p className="muted">Real database-backed platform telemetry, active accounts, and infrastructure status.</p>
        </div>
        <div className="page-title-icon"><Gauge /></div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Total Users</span>
          <span className="stat-value">{data.users?.total || 0}</span>
          <span className="stat-sub">{data.users?.newToday || 0} registered today</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Daily Active Users (DAU)</span>
          <span className="stat-value" style={{ color: '#8876ee' }}>{data.users?.dau || 0}</span>
          <span className="stat-sub">Active in last 24h</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Weekly Active (WAU)</span>
          <span className="stat-value">{data.users?.wau || 0}</span>
          <span className="stat-sub">Active in last 7d</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Monthly Active (MAU)</span>
          <span className="stat-value">{data.users?.mau || 0}</span>
          <span className="stat-sub">Active in last 30d</span>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Total Projects</span>
          <span className="stat-value">{data.content?.projects || 0}</span>
          <span className="stat-sub">Research projects</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Documents</span>
          <span className="stat-value">{data.content?.documents || 0}</span>
          <span className="stat-sub">Cloud persisted manuscripts</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Revisions Created</span>
          <span className="stat-value">{data.content?.revisions || 0}</span>
          <span className="stat-sub">AI & manual revisions</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Integrity Reports</span>
          <span className="stat-value">{data.content?.integrityReports || 0}</span>
          <span className="stat-sub">Scientific audits</span>
        </div>
      </div>

      <div className="panel" style={{ marginTop: '20px' }}>
        <h3 style={{ fontSize: '14px', marginBottom: '14px' }}>System Infrastructure Status</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '11px' }}>
          <div><span style={{ color: 'var(--muted)' }}>Database: </span><strong>{data.system?.database}</strong></div>
          <div><span style={{ color: 'var(--muted)' }}>AI Provider: </span><strong>{data.system?.aiProvider} ({data.system?.aiConfigured ? 'Ready' : 'Not configured'})</strong></div>
          <div><span style={{ color: 'var(--muted)' }}>Node Engine: </span><strong>{data.system?.nodeVersion}</strong></div>
          <div><span style={{ color: 'var(--muted)' }}>Server Clock: </span><strong>{new Date(data.system?.serverTime).toUTCString()}</strong></div>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   PHASE 3: ADMINISTRATOR USER MANAGEMENT VIEW
   ========================================================= */
function AdminUsersPage({ token, currentUser, setMessage, setError }: any) {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);
  const [targetUser, setTargetUser] = useState<any>(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [page, statusFilter, roleFilter]);

  async function fetchUsers() {
    try {
      const q = new URLSearchParams({
        page: String(page),
        limit: '15',
        ...(search ? { search } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(roleFilter ? { role: roleFilter } : {})
      });
      const res = await request(`/admin/users?${q.toString()}`, token, undefined, 'GET');
      setUsers(res.users);
      setPagination(res.pagination);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleToggleStatus() {
    if (!targetUser) return;
    try {
      const nextStatus = targetUser.status === 'suspended' ? 'active' : 'suspended';
      const res = await request(`/admin/users/${targetUser._id}/status`, token, {
        status: nextStatus,
        reason: suspensionReason || 'Administrative decision'
      }, 'PATCH');
      setMessage(res.message);
      setShowModal(false);
      setTargetUser(null);
      setSuspensionReason('');
      await fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleRevokeSessions(userId: string) {
    if (!confirm('Revoke all active sessions for this user? They will be required to log in again.')) return;
    try {
      const res = await request(`/admin/users/${userId}/revoke-sessions`, token, undefined, 'POST');
      setMessage(res.message);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <section className="analysis-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">ACCESS CONTROL</p>
          <h1>User Management</h1>
          <p className="muted">Search users, view aggregate metadata, manage account status, and revoke sessions.</p>
        </div>
        <div className="page-title-icon"><FolderKanban /></div>
      </div>

      <div className="panel" style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by email or name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchUsers()}
          style={{ flex: 1, minWidth: '200px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '11px' }}
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '11px' }}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '11px' }}
        >
          <option value="">All Roles</option>
          <option value="researcher">Researcher</option>
          <option value="reviewer">Reviewer</option>
          <option value="admin">Administrator</option>
        </select>
        <button className="primary small" onClick={() => { setPage(1); fetchUsers(); }}>Search</button>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Registered</th>
              <th>Last Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u._id}>
                <td>
                  <strong>{u.displayName || 'Researcher'}</strong>
                  <div style={{ color: 'var(--muted)', fontSize: '10px' }}>{u.email}</div>
                </td>
                <td><span className={`status-pill ${u.role === 'admin' ? 'admin' : ''}`}>{u.role}</span></td>
                <td><span className={`status-pill ${u.status === 'suspended' ? 'suspended' : 'active'}`}>{u.status}</span></td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td>{new Date(u.lastActiveAt || u.createdAt).toLocaleDateString()}</td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="text-button"
                      onClick={() => {
                        if (u._id === currentUser?.id) {
                          alert('Administrative safety constraint: You cannot suspend your own account.');
                          return;
                        }
                        setTargetUser(u);
                        setShowModal(true);
                      }}
                    >
                      {u.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                    </button>
                    <button className="text-button" onClick={() => handleRevokeSessions(u._id)}>
                      Revoke Sessions
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && targetUser && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <h3>{targetUser.status === 'suspended' ? 'Reactivate User Account' : 'Suspend User Account'}</h3>
            <p>
              Target user: <strong>{targetUser.email}</strong>
            </p>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                Mandatory Administrative Reason:
              </label>
              <textarea
                value={suspensionReason}
                onChange={e => setSuspensionReason(e.target.value)}
                placeholder="State the reason for this action (recorded in audit logs)..."
                rows={3}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '11px' }}
              />
            </div>
            <div className="modal-actions">
              <button className="secondary" onClick={() => { setShowModal(false); setTargetUser(null); }}>Cancel</button>
              <button className="primary" onClick={handleToggleStatus} disabled={!suspensionReason.trim()}>
                Confirm {targetUser.status === 'suspended' ? 'Reactivation' : 'Suspension'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* =========================================================
   PHASE 3: USAGE ANALYTICS VIEW
   ========================================================= */
function AdminAnalyticsPage({ token, user, setError }: any) {
  const [overview, setOverview] = useState<any>(null);
  const [features, setFeatures] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      request('/analytics/overview', token, undefined, 'GET').catch(() => null),
      user?.role === 'admin' ? request('/admin/analytics/features', token, undefined, 'GET').catch(() => []) : Promise.resolve([]),
      user?.role === 'admin' ? request('/admin/analytics/errors', token, undefined, 'GET').catch(() => []) : Promise.resolve([])
    ]).then(([ov, f, e]) => {
      if (ov) setOverview(ov);
      setFeatures(f || []);
      setErrors(e || []);
    }).catch(err => setError?.(err.message))
      .finally(() => setLoading(false));
  }, [token, user]);

  const maxCount = Math.max(...features.map((f: any) => f.count), 1);
  const metrics = overview?.metrics || {
    totalDocuments: 0,
    totalScans: 0,
    totalRevisions: 0,
    totalWordsProcessed: 0,
    reportsGenerated: 0,
    latexConversions: 0
  };

  return (
    <section className="analysis-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">RESEARCH TELEMETRY & INSIGHTS</p>
          <h1>Platform Usage Analytics</h1>
          <p className="muted">Live document statistics, authenticity scan history, processing volume, and system quotas.</p>
        </div>
        <div className="page-title-icon"><Activity /></div>
      </div>

      {/* Unlimited AI Quota Banner */}
      <div className="panel" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.08))', border: '1px solid rgba(16,185,129,0.3)', marginBottom: '20px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="status-pill active" style={{ background: '#10b981', color: '#fff' }}>Unlimited AI Tier</span>
            <strong style={{ fontSize: '12.5px', color: 'var(--text)' }}>Full Research Platform Access Enabled</strong>
          </div>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)', lineHeight: '1.5' }}>
            Your account operates with unlimited daily rewriting, unlimited TextGuard scans, and full Crossref reference validations without artificial quota caps.
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: '11px' }}>
          <strong style={{ color: '#10b981', display: 'block' }}>Daily Quota: Unlimited</strong>
          <span style={{ color: 'var(--muted)', fontSize: '10px' }}>Max 15,000 words / batch</span>
        </div>
      </div>

      {/* 6 Key Telemetry Metrics */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <span className="stat-label">Saved Documents</span>
          <span className="stat-value">{metrics.totalDocuments}</span>
          <span className="stat-sub">Persisted manuscripts</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Authenticity Scans</span>
          <span className="stat-value" style={{ color: '#38bdf8' }}>{metrics.totalScans}</span>
          <span className="stat-sub">TextGuard evaluations</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Words Analyzed</span>
          <span className="stat-value" style={{ color: '#10b981' }}>{metrics.totalWordsProcessed}</span>
          <span className="stat-sub">Full vocabulary coverage</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Revisions Created</span>
          <span className="stat-value">{metrics.totalRevisions}</span>
          <span className="stat-sub">Academic mode edits</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">PDF Reports</span>
          <span className="stat-value">{metrics.reportsGenerated}</span>
          <span className="stat-sub">Authenticity dossiers</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">LaTeX Projects</span>
          <span className="stat-value">{metrics.latexConversions}</span>
          <span className="stat-sub">APA 7 Overleaf bundles</span>
        </div>
      </div>

      {/* Recent Research Activity History */}
      <div className="panel" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', marginBottom: '14px' }}>Recent Manuscript Activity</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Operation / Service</th>
                <th>Timeline</th>
                <th>Word Count</th>
                <th>Execution Status</th>
              </tr>
            </thead>
            <tbody>
              {overview?.activityHistory?.length ? (
                overview.activityHistory.map((act: any, idx: number) => (
                  <tr key={idx}>
                    <td><strong>{act.feature}</strong></td>
                    <td style={{ color: 'var(--muted)' }}>{act.date}</td>
                    <td>{act.wordCount ? `${act.wordCount} words` : '—'}</td>
                    <td><span className="status-pill active">{act.status}</span></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px' }}>
                    {loading ? 'Aggregating usage metrics from MongoDB...' : 'No activity recorded yet today.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Telemetry Drilldown */}
      {user?.role === 'admin' && (
        <>
          <div className="panel" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', marginBottom: '16px' }}>Platform Feature Request Distribution (Admin)</h3>
            {features.length ? features.map((f: any) => (
              <div key={f.feature} className="chart-bar-row">
                <span style={{ width: '150px', fontWeight: 600, textTransform: 'capitalize' }}>{f.feature}</span>
                <div className="chart-bar-bg">
                  <div className="chart-bar-fill" style={{ width: `${Math.round((f.count / maxCount) * 100)}%` }} />
                </div>
                <span style={{ width: '60px', textAlign: 'right', color: 'var(--muted)' }}>{f.count} reqs</span>
              </div>
            )) : (
              <div className="empty-state">No platform feature requests logged yet.</div>
            )}
          </div>

          <div className="panel">
            <h3 style={{ fontSize: '14px', marginBottom: '14px' }}>System Operational Reliability & Error Trends</h3>
            {errors.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Feature</th>
                      <th>Error Category</th>
                      <th>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errors.map((e: any, i: number) => (
                      <tr key={i}>
                        <td>{new Date(e.timestamp).toLocaleTimeString()}</td>
                        <td>{e.feature}</td>
                        <td style={{ color: '#b91c1c' }}>{e.errorCategory || 'Unknown'}</td>
                        <td>{e.durationMs}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: '11px' }}>Zero recorded platform errors. Operational stability is 100%.</div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/* =========================================================
   PHASE 3: PLATFORM AUDIT LOGS VIEW
   ========================================================= */
function AdminAuditLogsPage({ token, setError }: any) {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    request('/admin/audit-events', token, undefined, 'GET')
      .then(d => setLogs(d.events || []))
      .catch(e => setError(e.message));
  }, []);

  return (
    <section className="analysis-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">SECURITY TRAIL</p>
          <h1>Platform Audit Logs</h1>
          <p className="muted">Append-only administrative audit records of status changes, exports, and session revocations.</p>
        </div>
        <div className="page-title-icon"><History /></div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Resource</th>
              <th>Target</th>
              <th>Result</th>
              <th>Reason / Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length ? logs.map((l: any) => (
              <tr key={l._id}>
                <td>{new Date(l.createdAt).toLocaleString()}</td>
                <td><strong style={{ textTransform: 'uppercase', fontSize: '10px' }}>{l.action}</strong></td>
                <td>{l.resourceType}</td>
                <td>{l.targetId?.email || l.targetId || 'System'}</td>
                <td><span className="status-pill active">{l.result || 'success'}</span></td>
                <td>{l.reason || JSON.stringify(l.metadata || {})}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
                  No administrative events recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* =========================================================
   PHASE 5: APA 7 LATEX EXPORT STUDIO VIEW
   ========================================================= */
const SUPPORTED_LANGUAGES = [
  { code: 'auto', name: 'Auto-detect Scripts & Language', native: 'Automatic' },
  { code: 'en', name: 'English', native: 'English' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'ur', name: 'Urdu', native: 'اردو' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'zh', name: 'Chinese (Simplified)', native: '中文' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' }
];

function detectClientScripts(str: string) {
  if (!str) return [];
  const scripts = [
    { name: 'Latin', count: (str.match(/[\u0041-\u005A\u0061-\u007A]/g) || []).length },
    { name: 'Bengali (বাংলা)', count: (str.match(/[\u0980-\u09FF]/g) || []).length },
    { name: 'Devanagari (हिन्दी/मराठी)', count: (str.match(/[\u0900-\u097F]/g) || []).length },
    { name: 'Tamil (தமிழ்)', count: (str.match(/[\u0B80-\u0BFF]/g) || []).length },
    { name: 'Telugu (తెలుగు)', count: (str.match(/[\u0C00-\u0C7F]/g) || []).length },
    { name: 'Malayalam (മലയാളം)', count: (str.match(/[\u0D00-\u0D7F]/g) || []).length },
    { name: 'Kannada (ಕನ್ನಡ)', count: (str.match(/[\u0C80-\u0CFF]/g) || []).length },
    { name: 'Gujarati (ગુજરાતી)', count: (str.match(/[\u0A80-\u0AFF]/g) || []).length },
    { name: 'Gurmukhi (ਪੰਜਾਬੀ)', count: (str.match(/[\u0A00-\u0A7F]/g) || []).length },
    { name: 'Arabic / Urdu (العربية)', count: (str.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length },
    { name: 'Chinese (中文)', count: (str.match(/[\u4E00-\u9FFF]/g) || []).length },
    { name: 'Japanese (日本語)', count: (str.match(/[\u3040-\u30FF]/g) || []).length },
    { name: 'Korean (한국어)', count: (str.match(/[\uAC00-\uD7AF]/g) || []).length }
  ].filter(s => s.count > 0);

  const total = scripts.reduce((acc, s) => acc + s.count, 0);
  if (total === 0) return [];
  return scripts.map(s => ({
    name: s.name,
    percent: Math.round((s.count / total) * 100)
  })).sort((a, b) => b.percent - a.percent);
}

function LatexExportStudioPage({ token, activeDoc, documents, citationsList, setError, setMessage }: any) {
  const [variant, setVariant] = useState<'student' | 'professional' | 'thesis' | 'custom'>('professional');
  const [title, setTitle] = useState(activeDoc?.title || 'Cognitive Load and Working Memory in Academic Writing');
  const [authors, setAuthors] = useState('Alex Rivera');
  const [affiliation, setAffiliation] = useState('Department of Psychology, Stanford University');
  const [abstract, setAbstract] = useState('This empirical manuscript examines the impact of cognitive load on working memory retention and academic problem solving.');
  const [keywords, setKeywords] = useState('cognitive load, working memory, academic writing, empirical methods');
  
  // Multilingual Configuration States
  const [documentLanguage, setDocumentLanguage] = useState('auto');
  const [documentMode, setDocumentMode] = useState<'single' | 'mixed' | 'preserve'>('mixed');
  const [engine, setEngine] = useState<'auto' | 'xelatex' | 'lualatex' | 'pdflatex'>('auto');

  // Student Specific
  const [course, setCourse] = useState('PSY 301: Advanced Cognitive Psychology');
  const [instructor, setInstructor] = useState('Dr. Eleanor Vance');
  const [dueDate, setDueDate] = useState('October 24, 2026');

  // Professional Specific
  const [runningHead, setRunningHead] = useState('COGNITIVE LOAD AND WORKING MEMORY');
  const [authorNote, setAuthorNote] = useState('Correspondence concerning this manuscript should be addressed to Alex Rivera, Department of Psychology, Stanford University.');
  const [correspondingAuthor, setCorrespondingAuthor] = useState('arivera@stanford.edu');

  // Thesis & Dissertation Specific
  const [degree, setDegree] = useState('Doctor of Philosophy (Ph.D.)');
  const [department, setDepartment] = useState('Department of Psychology');
  const [advisor, setAdvisor] = useState('Prof. Eleanor Vance');
  const [defenseDate, setDefenseDate] = useState('May 2026');

  // Custom & Uploaded Template Specific
  const [customFormatName, setCustomFormatName] = useState('Custom Institutional Template');
  const [customClassOptions, setCustomClassOptions] = useState('man,11pt,a4paper');
  const [customPreamble, setCustomPreamble] = useState('\\usepackage{geometry}\n\\geometry{margin=1in}');
  const [customTemplateFile, setCustomTemplateFile] = useState<File | null>(null);
  const [customTemplateFileName, setCustomTemplateFileName] = useState('');
  const customTemplateFileInputRef = useRef<HTMLInputElement>(null);

  function handleCustomTemplateUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setCustomTemplateFile(f);
    setCustomTemplateFileName(f.name);
    const cleaned = f.name.replace(/\.docx$/i, '').replace(/[-_]/g, ' ');
    const formatted = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    setCustomFormatName(formatted);
    setMessage(`Custom format template "${f.name}" loaded successfully.`);
  }

  // Source selection & File upload
  const [sourceMode, setSourceMode] = useState<'active' | 'upload' | 'text'>('active');
  const [customText, setCustomText] = useState(activeDoc?.content || sampleText);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsingFile, setParsingFile] = useState(false);
  const [parsedFileInfo, setParsedFileInfo] = useState<{ filename: string; wordCount: number; charCount: number } | null>(null);
  const [showExtractedPreview, setShowExtractedPreview] = useState(false);

  // Metadata Detection State
  const [detectingMetadata, setDetectingMetadata] = useState(false);
  const [metadataDetected, setMetadataDetected] = useState(false);

  // Conversion state
  const [busy, setBusy] = useState(false);
  const [jobResult, setJobResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'latex' | 'warnings' | 'structure'>('latex');
  const [selectedSegment, setSelectedSegment] = useState<string>('standalone');
  const [copied, setCopied] = useState<boolean>(false);

  function handleCopy(text: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  function applyExtractedMetadata(meta: any, fallbackTitle?: string) {
    if (meta.title || fallbackTitle) setTitle(meta.title || fallbackTitle);
    if (meta.authors) setAuthors(meta.authors);
    if (meta.affiliation) setAffiliation(meta.affiliation);
    if (meta.abstract) setAbstract(meta.abstract);
    if (meta.keywords) setKeywords(meta.keywords);
    if (meta.runningHead) setRunningHead(meta.runningHead);
    if (meta.course) setCourse(meta.course);
    if (meta.instructor) setInstructor(meta.instructor);
    if (meta.dueDate) setDueDate(meta.dueDate);
    if (meta.degree) {
      setDegree(meta.degree);
      setVariant('thesis');
    }
    if (meta.department) setDepartment(meta.department);
    if (meta.advisor) setAdvisor(meta.advisor);
    if (meta.defenseDate) setDefenseDate(meta.defenseDate);
    setMetadataDetected(true);
  }

  async function handleFileUpload(file: File) {
    setUploadedFile(file);
    setParsingFile(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API}/latex/extract-metadata`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse Word document.');

      if (data.content) {
        setCustomText(data.content);
      }
      setParsedFileInfo({
        filename: file.name,
        wordCount: data.wordCount || (data.content ? data.content.split(/\s+/).filter(Boolean).length : 0),
        charCount: data.characterCount || (data.content ? data.content.length : 0)
      });

      if (data.metadata) {
        applyExtractedMetadata(data.metadata, data.title);
      }
      setMessage(`✓ Parsed "${file.name}" (${data.wordCount || 0} words). Text and metadata successfully auto-detected!`);
    } catch (err: any) {
      setError(`File upload note: ${err.message}. Direct conversion remains enabled.`);
    } finally {
      setParsingFile(false);
    }
  }

  async function handleAutoDetectMetadata() {
    const currentText = sourceMode === 'active' && activeDoc ? activeDoc.content : customText;
    if (!currentText.trim() && !uploadedFile) {
      setError('Please provide manuscript text or upload a document to auto-detect metadata.');
      return;
    }
    setDetectingMetadata(true);
    setError('');
    try {
      let resData: any;
      if (sourceMode === 'upload' && uploadedFile) {
        const formData = new FormData();
        formData.append('file', uploadedFile);
        const res = await fetch(`${API}/latex/extract-metadata`, {
          method: 'POST',
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          credentials: 'include',
          body: formData
        });
        resData = await res.json();
        if (!res.ok) throw new Error(resData.error || 'Metadata extraction failed');
      } else {
        const res = await fetch(`${API}/latex/extract-metadata`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          credentials: 'include',
          body: JSON.stringify({ text: currentText })
        });
        resData = await res.json();
        if (!res.ok) throw new Error(resData.error || 'Metadata extraction failed');
      }

      if (resData.metadata) {
        applyExtractedMetadata(resData.metadata, resData.title);
        setMessage('✨ Manuscript metadata auto-detected and copied into form fields successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Auto-detection failed.');
    } finally {
      setDetectingMetadata(false);
    }
  }

  const currentSegmentData = useMemo(() => {
    if (!jobResult) return { filename: 'main.tex', content: '', label: 'LaTeX Master', description: '' };
    if (selectedSegment === 'standalone') {
      return {
        filename: 'main.tex (Standalone All-in-One)',
        content: jobResult.standaloneMainTex || jobResult.mainTex || jobResult.mainTexSnippet || '',
        label: 'Standalone All-in-One (Overleaf 1-Click Paste)',
        description: 'Complete self-contained document with embedded bibliography. Simply paste into Overleaf main.tex and hit Recompile.'
      };
    }
    if (selectedSegment === 'main') {
      return {
        filename: 'main.tex (Standard Master Document)',
        content: jobResult.mainTex || jobResult.mainTexSnippet || '',
        label: 'Master Document (main.tex)',
        description: 'Complete APA 7 master document referencing references.bib.'
      };
    }
    if (selectedSegment === 'modular') {
      return {
        filename: 'main_modular.tex (Segmented)',
        content: jobResult.modularMainTex || jobResult.mainTex || '',
        label: 'Modular Master (main_modular.tex)',
        description: 'Master document using \\input{sections/...} for segmented project structures.'
      };
    }
    if (selectedSegment === 'bib') {
      return {
        filename: 'references.bib',
        content: jobResult.bibContent || '% No bibliography citations provided',
        label: 'Bibliography (references.bib)',
        description: 'BibLaTeX entries formatted for style=apa, backend=biber.'
      };
    }
    if (selectedSegment.startsWith('sec-')) {
      const idx = parseInt(selectedSegment.replace('sec-', ''), 10);
      const sec = jobResult.sections?.[idx];
      if (sec) {
        return {
          filename: sec.filename || `sections/section${idx + 1}.tex`,
          content: sec.content || '',
          label: `Section: ${sec.heading || `Section ${idx + 1}`}`,
          description: `Segmented section file for Overleaf sections/ directory.`
        };
      }
    }
    return {
      filename: 'main.tex',
      content: jobResult.mainTex || jobResult.mainTexSnippet || '',
      label: 'Master Document',
      description: 'LaTeX source code'
    };
  }, [jobResult, selectedSegment]);

  // Live script analysis
  const detectedPreview = useMemo(() => {
    const textToAnalyze = `${title} ${abstract} ${sourceMode === 'active' && activeDoc ? activeDoc.content : customText}`;
    return detectClientScripts(textToAnalyze);
  }, [title, abstract, sourceMode, activeDoc, customText]);

  function handleAutoOptimizeMultilingual() {
    const topScript = detectedPreview[0]?.name || '';
    if (topScript.includes('Bengali')) {
      setDocumentLanguage('bn');
      setEngine('xelatex');
      setDocumentMode('mixed');
    } else if (topScript.includes('Devanagari')) {
      setDocumentLanguage('hi');
      setEngine('xelatex');
      setDocumentMode('mixed');
    } else if (topScript.includes('Tamil')) {
      setDocumentLanguage('ta');
      setEngine('xelatex');
      setDocumentMode('mixed');
    } else if (topScript.includes('Arabic') || topScript.includes('Urdu')) {
      setDocumentLanguage('ar');
      setEngine('xelatex');
      setDocumentMode('mixed');
    } else if (topScript.includes('Chinese')) {
      setDocumentLanguage('zh');
      setEngine('xelatex');
      setDocumentMode('mixed');
    } else {
      setDocumentLanguage('auto');
      setEngine('xelatex');
      setDocumentMode('preserve');
    }
    setMessage('⚡ Multilingual settings optimized based on detected document script distribution!');
  }

  // Update title/content if activeDoc changes
  useEffect(() => {
    if (activeDoc) {
      if (!title || title === 'Untitled Academic Document') setTitle(activeDoc.title);
      if (sourceMode === 'active') setCustomText(activeDoc.content);
    }
  }, [activeDoc]);

  async function handleConvert() {
    const effectiveTitle = title.trim() || parsedFileInfo?.filename?.replace(/\.docx$/i, '') || 'Manuscript';

    setBusy(true);
    setError('');
    setMessage('');
    try {
      let bodyData: any;
      let isMultipart = false;

      const authorList = authors.split(/[\n,]+/).map(a => a.trim()).filter(Boolean).map(a => ({ name: a, affiliation }));
      const affiliationList = affiliation.split(/[\n,]+/).map(a => a.trim()).filter(Boolean);
      const keywordList = keywords.split(',').map(k => k.trim()).filter(Boolean);

      if (sourceMode === 'upload' && uploadedFile) {
        isMultipart = true;
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('variant', variant);
        formData.append('title', effectiveTitle);
        formData.append('author', authors.trim());
        formData.append('affiliation', affiliation.trim());
        formData.append('abstract', abstract.trim());
        formData.append('keywords', keywords);
        formData.append('documentLanguage', documentLanguage);
        formData.append('documentMode', documentMode);
        formData.append('engine', engine);
        if (variant === 'student') {
          formData.append('course', course.trim());
          formData.append('instructor', instructor.trim());
          formData.append('dueDate', dueDate.trim());
        } else if (variant === 'thesis') {
          formData.append('degree', degree.trim());
          formData.append('department', department.trim());
          formData.append('advisor', advisor.trim());
          formData.append('defenseDate', defenseDate.trim());
          formData.append('runningHead', runningHead.trim().toUpperCase());
          formData.append('authorNote', authorNote.trim());
        } else if (variant === 'custom') {
          formData.append('customFormatName', customFormatName.trim());
          formData.append('customClassOptions', customClassOptions.trim());
          formData.append('customPreamble', customPreamble.trim());
          formData.append('runningHead', runningHead.trim().toUpperCase());
          formData.append('authorNote', authorNote.trim());
          if (customTemplateFile) {
            formData.append('customTemplateFile', customTemplateFile);
          }
        } else {
          formData.append('runningHead', runningHead.trim().toUpperCase());
          formData.append('authorNote', authorNote.trim());
          formData.append('correspondingAuthor', correspondingAuthor.trim());
        }
        bodyData = formData;
      } else {
        const textPayload = sourceMode === 'active' && activeDoc ? activeDoc.content : customText;
        bodyData = JSON.stringify({
          variant,
          title: effectiveTitle,
          authors: authorList,
          affiliations: affiliationList,
          abstract: abstract.trim(),
          keywords: keywordList,
          documentLanguage,
          documentMode,
          engine,
          course: variant === 'student' ? course.trim() : undefined,
          instructor: variant === 'student' ? instructor.trim() : undefined,
          dueDate: variant === 'student' ? dueDate.trim() : undefined,
          degree: variant === 'thesis' ? degree.trim() : undefined,
          department: variant === 'thesis' ? department.trim() : undefined,
          advisor: variant === 'thesis' ? advisor.trim() : undefined,
          defenseDate: variant === 'thesis' ? defenseDate.trim() : undefined,
          customFormatName: variant === 'custom' ? customFormatName.trim() : undefined,
          customClassOptions: variant === 'custom' ? customClassOptions.trim() : undefined,
          customPreamble: variant === 'custom' ? customPreamble.trim() : undefined,
          runningHead: variant !== 'student' ? runningHead.trim().toUpperCase() : undefined,
          authorNote: variant !== 'student' ? authorNote.trim() : undefined,
          correspondingAuthor: variant === 'professional' ? correspondingAuthor.trim() : undefined,
          rawText: textPayload,
          citations: (citationsList || []).map((c: any) => ({
            author: Array.isArray(c.authors) && c.authors[0] ? (c.authors[0].family || c.authors[0].name) : 'Author',
            authors: c.authors,
            title: c.title,
            year: c.year || '2024',
            journal: c.journal,
            volume: c.volume,
            pages: c.pages,
            doi: c.doi
          }))
        });
      }

      const res = await fetch(`${API}/latex/apa7/convert`, {
        method: 'POST',
        headers: {
          ...(isMultipart ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: bodyData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Conversion failed.');

      setJobResult(data);
      const variantLabel = variant === 'thesis' ? 'Thesis & Dissertation' : (variant === 'student' ? 'Student Paper' : 'Research Paper');
      setMessage(`APA 7 ${variantLabel} generated successfully!`);
    } catch (err: any) {
      setError(err.message || 'LaTeX conversion failed.');
    } finally {
      setBusy(false);
    }
  }

  async function downloadArtifact(type: 'zip' | 'pdf') {
    if (!jobResult?.jobId) return;
    try {
      const endpoint = type === 'zip' ? 'download-zip' : 'download-pdf';
      const res = await fetch(`${API}/latex/jobs/${jobResult.jobId}/${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include'
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Failed to download ${type.toUpperCase()}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'zip' ? 'researchproof-apa7-manuscript.zip' : 'manuscript.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <section className="analysis-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">PHASE 5 LATEX EXPORT STUDIO</p>
          <h1>APA 7 Word-to-LaTeX Converter</h1>
          <p className="muted">Generate publication-grade APA 7 LaTeX manuscripts using the official <code style={{ color: 'var(--primary)' }}>apa7</code> document class with Biber, booktabs, and multilingual Unicode typography.</p>
        </div>
        <div className="page-title-icon"><BookOpen /></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 440px) 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column: Configuration Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 1. Template Selection */}
          <div className="panel">
            <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
              1. Manuscript Format
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
              <button
                type="button"
                className={`tool-card ${variant === 'professional' ? 'active' : ''}`}
                onClick={() => setVariant('professional')}
                style={{
                  padding: '10px 8px',
                  textAlign: 'left',
                  border: variant === 'professional' ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: variant === 'professional' ? 'var(--surface2)' : 'transparent',
                  borderRadius: '8px'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '12px' }}>Research Paper</div>
                <small style={{ color: 'var(--muted)', fontSize: '10px' }}>\documentclass[man] · Journal submission</small>
              </button>

              <button
                type="button"
                className={`tool-card ${variant === 'thesis' ? 'active' : ''}`}
                onClick={() => setVariant('thesis')}
                style={{
                  padding: '10px 8px',
                  textAlign: 'left',
                  border: variant === 'thesis' ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: variant === 'thesis' ? 'var(--surface2)' : 'transparent',
                  borderRadius: '8px'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '12px' }}>Thesis & Dissertation</div>
                <small style={{ color: 'var(--muted)', fontSize: '10px' }}>\documentclass[man] · Degree, Committee & Dept</small>
              </button>

              <button
                type="button"
                className={`tool-card ${variant === 'student' ? 'active' : ''}`}
                onClick={() => setVariant('student')}
                style={{
                  padding: '10px 8px',
                  textAlign: 'left',
                  border: variant === 'student' ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: variant === 'student' ? 'var(--surface2)' : 'transparent',
                  borderRadius: '8px'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '12px' }}>Student Paper</div>
                <small style={{ color: 'var(--muted)', fontSize: '10px' }}>\documentclass[stu] · Course & Instructor page</small>
              </button>

              <button
                type="button"
                className={`tool-card ${variant === 'custom' ? 'active' : ''}`}
                onClick={() => setVariant('custom')}
                style={{
                  padding: '10px 8px',
                  textAlign: 'left',
                  border: variant === 'custom' ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: variant === 'custom' ? 'var(--surface2)' : 'transparent',
                  borderRadius: '8px'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '12px' }}>Custom / Uploaded</div>
                <small style={{ color: 'var(--muted)', fontSize: '10px' }}>\documentclass[custom] · Customized .docx template</small>
              </button>
            </div>

            {variant === 'custom' && (
              <div style={{ marginTop: '12px', padding: '12px', background: 'var(--surface2)', borderRadius: '8px', border: '1px dashed var(--primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.4px' }}>
                    📁 UPLOAD CUSTOM DOC FORMAT (.DOCX) / SPECIFICATION
                  </span>
                  {customTemplateFileName && (
                    <span style={{ fontSize: '10px', color: '#16a34a', background: 'rgba(22, 163, 74, 0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      ✓ {customTemplateFileName}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px', lineHeight: 1.4 }}>
                  Upload an institutional doc format template (.docx) to automatically configure your custom format, or customize the document class options and preamble below.
                </p>
                <input
                  ref={customTemplateFileInputRef}
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  style={{ display: 'none' }}
                  onChange={handleCustomTemplateUpload}
                />
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="filter-btn active"
                    onClick={() => customTemplateFileInputRef.current?.click()}
                    style={{ fontSize: '11px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <FileText size={13} /> {customTemplateFileName ? 'Replace Uploaded Template' : 'Upload Template (.docx)'}
                  </button>
                  {customTemplateFileName && (
                    <button
                      type="button"
                      className="filter-btn"
                      onClick={() => {
                        setCustomTemplateFile(null);
                        setCustomTemplateFileName('');
                        setCustomFormatName('Custom Institutional Template');
                      }}
                      style={{ fontSize: '10px', padding: '6px 8px', color: 'var(--danger)' }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. Document Content Source */}
          <div className="panel">
            <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
              2. Document Source
            </h3>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                className={`filter-btn ${sourceMode === 'active' ? 'active' : ''}`}
                onClick={() => setSourceMode('active')}
              >
                Active Document ({activeDoc ? '1 Selected' : 'None'})
              </button>
              <button
                className={`filter-btn ${sourceMode === 'upload' ? 'active' : ''}`}
                onClick={() => setSourceMode('upload')}
              >
                Upload Word (.docx)
              </button>
              <button
                className={`filter-btn ${sourceMode === 'text' ? 'active' : ''}`}
                onClick={() => setSourceMode('text')}
              >
                Manual Text
              </button>
            </div>

            {sourceMode === 'upload' && (
              <div style={{ border: '2px dashed var(--border)', padding: '16px', borderRadius: '8px', textAlign: 'center', background: 'var(--surface)' }}>
                <Upload size={22} style={{ color: 'var(--primary)', margin: '0 auto 6px' }} />
                <p style={{ fontSize: '12px', fontWeight: 600 }}>Upload Word Manuscript (.docx)</p>
                <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '2px 0 8px' }}>
                  Auto-converts Word headings, tables, citations, and metadata directly into LaTeX.
                </p>
                <input
                  type="file"
                  accept=".docx"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                  }}
                  style={{ fontSize: '11px' }}
                />
                
                {parsingFile && (
                  <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <RefreshCw size={12} className="spin" /> Parsing Word document and auto-detecting metadata...
                  </div>
                )}

                {parsedFileInfo && !parsingFile && (
                  <div style={{ marginTop: '12px', textAlign: 'left', background: 'var(--surface2)', padding: '10px 12px', borderRadius: '6px', fontSize: '11px' }}>
                    <div style={{ color: '#16a34a', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Check size={13} /> Converted & Ready: {parsedFileInfo.filename}
                    </div>
                    <div style={{ color: 'var(--muted)' }}>
                      Extracted: <strong>{parsedFileInfo.wordCount}</strong> words · <strong>{parsedFileInfo.charCount}</strong> characters
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button
                        type="button"
                        className="filter-btn"
                        style={{ fontSize: '10px', padding: '3px 8px' }}
                        onClick={() => setShowExtractedPreview(!showExtractedPreview)}
                      >
                        {showExtractedPreview ? 'Hide Extracted Text' : 'View Extracted Text'}
                      </button>
                    </div>
                  </div>
                )}

                {showExtractedPreview && (
                  <div style={{ marginTop: '10px', textAlign: 'left' }}>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                      PARSED MANUSCRIPT TEXT
                    </label>
                    <textarea
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      rows={5}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', fontSize: '11px' }}
                    />
                  </div>
                )}
              </div>
            )}

            {sourceMode === 'active' && (
              <div style={{ fontSize: '12px', color: 'var(--muted)', background: 'var(--surface2)', padding: '10px', borderRadius: '6px' }}>
                Source: <strong>{activeDoc ? activeDoc.title : 'Sample Manuscript Draft'}</strong> ({activeDoc?.wordCount || 150} words)
              </div>
            )}

            {sourceMode === 'text' && (
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Paste or write manuscript text here..."
                rows={5}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
              />
            )}
          </div>

          {/* 3. Multilingual & Unicode Settings */}
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                3. Multilingual & Unicode Settings
              </h3>
              <button
                type="button"
                className="filter-btn"
                onClick={handleAutoOptimizeMultilingual}
                style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--surface2)', border: '1px solid var(--border)' }}
                title="Automatically configure ideal language, engine, and mode based on detected writing scripts"
              >
                ⚡ Auto-Optimize
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                  DOCUMENT LANGUAGE
                </label>
                <select
                  value={documentLanguage}
                  onChange={(e) => setDocumentLanguage(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
                >
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name} {lang.native !== lang.name ? `(${lang.native})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                  DOCUMENT CONVERSION MODE
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                  <button
                    type="button"
                    className={`filter-btn ${documentMode === 'single' ? 'active' : ''}`}
                    onClick={() => setDocumentMode('single')}
                    style={{ fontSize: '11px', padding: '6px 4px', textAlign: 'center' }}
                  >
                    Mode A: Single
                  </button>
                  <button
                    type="button"
                    className={`filter-btn ${documentMode === 'mixed' ? 'active' : ''}`}
                    onClick={() => setDocumentMode('mixed')}
                    style={{ fontSize: '11px', padding: '6px 4px', textAlign: 'center' }}
                  >
                    Mode B: Mixed
                  </button>
                  <button
                    type="button"
                    className={`filter-btn ${documentMode === 'preserve' ? 'active' : ''}`}
                    onClick={() => setDocumentMode('preserve')}
                    style={{ fontSize: '11px', padding: '6px 4px', textAlign: 'center' }}
                  >
                    Mode C: Preserve
                  </button>
                </div>
                <small style={{ color: 'var(--muted)', fontSize: '10px', display: 'block', marginTop: '4px' }}>
                  {documentMode === 'single' && 'Single language manuscript typeset with primary script font.'}
                  {documentMode === 'mixed' && 'Multi-script text (e.g. English main text with Bengali/Hindi/Arabic quotes) with font-switching macros.'}
                  {documentMode === 'preserve' && 'Preserves exact original Unicode scripts without translation or alteration.'}
                </small>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
                  LATEX COMPILATION ENGINE
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                  <button
                    type="button"
                    className={`filter-btn ${engine === 'auto' ? 'active' : ''}`}
                    onClick={() => setEngine('auto')}
                    style={{ fontSize: '10px', padding: '6px 2px' }}
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    className={`filter-btn ${engine === 'xelatex' ? 'active' : ''}`}
                    onClick={() => setEngine('xelatex')}
                    style={{ fontSize: '10px', padding: '6px 2px' }}
                  >
                    XeLaTeX
                  </button>
                  <button
                    type="button"
                    className={`filter-btn ${engine === 'lualatex' ? 'active' : ''}`}
                    onClick={() => setEngine('lualatex')}
                    style={{ fontSize: '10px', padding: '6px 2px' }}
                  >
                    LuaLaTeX
                  </button>
                  <button
                    type="button"
                    className={`filter-btn ${engine === 'pdflatex' ? 'active' : ''}`}
                    onClick={() => setEngine('pdflatex')}
                    style={{ fontSize: '10px', padding: '6px 2px' }}
                  >
                    pdfLaTeX
                  </button>
                </div>
              </div>

              {/* Real-time Script Detection preview */}
              {detectedPreview.length > 0 && (
                <div style={{ background: 'var(--surface2)', padding: '10px', borderRadius: '6px', fontSize: '11px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '6px' }}>Detected Writing Systems:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {detectedPreview.map((s, idx) => (
                      <span key={idx} className="subtle-tag" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        {s.name}: <strong>{s.percent}%</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Compatibility warning if pdfLaTeX is chosen for complex script */}
              {engine === 'pdflatex' && detectedPreview.some(s => s.name !== 'Latin') && (
                <div style={{ padding: '8px 10px', borderRadius: '6px', background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0 }} /> <span><strong>Compatibility Notice:</strong> pdfLaTeX does not support OpenType Indic, Arabic, or CJK scripts. XeLaTeX or LuaLaTeX is strongly recommended.</span>
                </div>
              )}
            </div>
          </div>

          {/* 4. Manuscript Metadata */}
          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                4. Manuscript Metadata
              </h3>
              <button
                type="button"
                className="filter-btn"
                onClick={handleAutoDetectMetadata}
                disabled={detectingMetadata}
                style={{ fontSize: '10px', padding: '3px 8px', background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="Auto-detect title, authors, affiliation, abstract, and keywords from manuscript content"
              >
                {detectingMetadata ? '⏳ Detecting...' : '⚡ Auto-Detect & Fill'}
              </button>
            </div>

            {metadataDetected && (
              <div style={{ marginBottom: '10px', fontSize: '10px', color: '#16a34a', background: 'rgba(22, 163, 74, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                ✨ Metadata auto-detected from manuscript content. You can review or adjust any field below.
              </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>MANUSCRIPT TITLE *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>AUTHOR(S)</label>
                  <input
                    type="text"
                    value={authors}
                    onChange={(e) => setAuthors(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>AFFILIATION</label>
                  <input
                    type="text"
                    value={affiliation}
                    onChange={(e) => setAffiliation(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
                  />
                </div>
              </div>

              {variant === 'student' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>COURSE NAME & NUMBER</label>
                      <input
                        type="text"
                        value={course}
                        onChange={(e) => setCourse(e.target.value)}
                        placeholder="e.g. PSY 301: Research Methods"
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>INSTRUCTOR / PROFESSOR</label>
                      <input
                        type="text"
                        value={instructor}
                        onChange={(e) => setInstructor(e.target.value)}
                        placeholder="e.g. Dr. Eleanor Vance"
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>ASSIGNMENT DUE DATE</label>
                    <input
                      type="text"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      placeholder="e.g. October 24, 2026"
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
                    />
                  </div>
                </>
              ) : variant === 'thesis' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>TARGET DEGREE</label>
                      <input
                        type="text"
                        value={degree}
                        onChange={(e) => setDegree(e.target.value)}
                        placeholder="e.g. Doctor of Philosophy (Ph.D.)"
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>DEPARTMENT / FACULTY</label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="e.g. Department of Computer Science"
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>THESIS ADVISOR / SUPERVISOR</label>
                      <input
                        type="text"
                        value={advisor}
                        onChange={(e) => setAdvisor(e.target.value)}
                        placeholder="e.g. Prof. Alan Turing, Ph.D."
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>DEFENSE / GRADUATION DATE</label>
                      <input
                        type="text"
                        value={defenseDate}
                        onChange={(e) => setDefenseDate(e.target.value)}
                        placeholder="e.g. May 2026"
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>RUNNING HEAD</label>
                    <input
                      type="text"
                      maxLength={50}
                      value={runningHead}
                      onChange={(e) => setRunningHead(e.target.value.toUpperCase())}
                      placeholder="SHORT TITLE FOR RUNNING HEAD"
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
                    />
                  </div>
                </>
              ) : variant === 'custom' ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>CUSTOM FORMAT / TEMPLATE NAME</label>
                      <input
                        type="text"
                        value={customFormatName}
                        onChange={(e) => setCustomFormatName(e.target.value)}
                        placeholder="e.g. Harvard Institutional Format / Nature Style"
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>DOCUMENTCLASS OPTIONS</label>
                      <input
                        type="text"
                        value={customClassOptions}
                        onChange={(e) => setCustomClassOptions(e.target.value)}
                        placeholder="e.g. man,11pt,a4paper or jou,draft"
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>CUSTOM PREAMBLE / PACKAGES (\usepackage&#123;...&#125;)</label>
                    <textarea
                      value={customPreamble}
                      onChange={(e) => setCustomPreamble(e.target.value)}
                      rows={2}
                      placeholder="\usepackage{geometry}&#10;\geometry{margin=1in}"
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>RUNNING HEAD</label>
                    <input
                      type="text"
                      maxLength={50}
                      value={runningHead}
                      onChange={(e) => setRunningHead(e.target.value.toUpperCase())}
                      placeholder="SHORT TITLE FOR HEADER"
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>AUTHOR NOTE / ACKNOWLEDGMENTS</label>
                    <textarea
                      value={authorNote}
                      onChange={(e) => setAuthorNote(e.target.value)}
                      rows={2}
                      placeholder="Custom institutional notes, grant support, or disclosures..."
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>RUNNING HEAD (MAX 50 CHARACTERS)</label>
                    <input
                      type="text"
                      maxLength={50}
                      value={runningHead}
                      onChange={(e) => setRunningHead(e.target.value.toUpperCase())}
                      placeholder="SHORT TITLE FOR HEADER"
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>AUTHOR NOTE</label>
                    <textarea
                      value={authorNote}
                      onChange={(e) => setAuthorNote(e.target.value)}
                      rows={2}
                      placeholder="Disclosures, department changes, or correspondence..."
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
                    />
                  </div>
                </>
              )}

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>ABSTRACT ({variant === 'student' ? 'OPTIONAL' : 'REQUIRED'})</label>
                <textarea
                  value={abstract}
                  onChange={(e) => setAbstract(e.target.value)}
                  rows={3}
                  placeholder="Summary of research purpose, hypothesis, method, and findings..."
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)' }}>KEYWORDS</label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="e.g. psychology, memory, reaction time"
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px' }}
                />
              </div>
            </div>

            <button
              className="primary"
              onClick={handleConvert}
              disabled={busy}
              style={{ width: '100%', marginTop: '16px', padding: '12px' }}
            >
              {busy ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <RefreshCw className="spin" size={16} /> Generating APA 7 Project…
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} /> Convert to APA 7 LaTeX
                </span>
              )}
            </button>
          </div>

        </div>

        {/* Right Column: Conversion Results, Artifact Downloads & LaTeX Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {jobResult ? (
            <>
              {/* Status Header */}
              <div className="panel" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                      <span className="status-pill active">Conversion Completed</span>
                      <span className="subtle-tag">Class: apa7 ({jobResult.variant === 'student' ? 'stu' : 'man'})</span>
                    </div>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{title}</h2>
                    <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '4px' }}>
                      Archive Size: {(jobResult.artifactReferences.zipSize / 1024).toFixed(1)} KB · Sections: {jobResult.artifactReferences.texFilesCount} · Citations: {jobResult.artifactReferences.referencesCount}
                    </p>
                  </div>

                  {/* Primary Download Buttons */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      className="primary"
                      onClick={() => downloadArtifact('zip')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px' }}
                    >
                      <Download size={16} /> Download ZIP Archive
                    </button>
                    
                    <button
                      className="secondary"
                      onClick={() => downloadArtifact('pdf')}
                      disabled={jobResult.compilationStatus !== 'compiled'}
                      title={jobResult.compilationStatus === 'compiled' ? 'Download PDF' : 'PDF compilation is unavailable in current hosting tier.'}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '10px 16px',
                        opacity: jobResult.compilationStatus === 'compiled' ? 1 : 0.6
                      }}
                    >
                      <FileText size={16} /> Download PDF
                    </button>
                  </div>
                </div>

                {/* Compilation Status Explanation */}
                <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', background: jobResult.compilationStatus === 'compiled' ? '#dcfce7' : '#fef3c7', border: `1px solid ${jobResult.compilationStatus === 'compiled' ? '#86efac' : '#fde68a'}`, color: jobResult.compilationStatus === 'compiled' ? '#166534' : '#92400e' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '12px' }}>
                    {jobResult.compilationStatus === 'compiled' ? <Check size={16} /> : <AlertTriangle size={16} />}
                    {jobResult.compilationStatus === 'compiled' ? 'Validated PDF Output Available' : 'TeX Compiler Unavailable on Render Container'}
                  </div>
                  <p style={{ fontSize: '11px', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                    {jobResult.compilationMessage || (jobResult.compilationStatus === 'compiled' ? 'Full Biber and pdfLaTeX compilation succeeded.' : 'The host container does not include a full TeX Live distribution. The generated ZIP archive contains complete, compilable LaTeX sources, BibLaTeX references, and latexmk configuration for compiling locally or on Overleaf.')}
                  </p>
                </div>

                {/* Multilingual & Unicode Summary Card */}
                {jobResult.languageReport && (
                  <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        🌐 {jobResult.languageReport.languageName} {jobResult.languageReport.nativeName ? `(${jobResult.languageReport.nativeName})` : ''}
                      </span>
                      <span className="subtle-tag">
                        Mode: {jobResult.languageReport.documentMode?.toUpperCase()} · Engine: {jobResult.languageReport.selectedEngine || jobResult.languageReport.engine}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '11px', color: 'var(--muted)' }}>
                      <span>Primary Font: <strong style={{ color: 'var(--text)' }}>{jobResult.languageReport.fontFamily}</strong></span>
                      {jobResult.languageReport.isRtl && (
                        <span style={{ color: '#d97706', fontWeight: 600 }}>· RTL BiDi Direction (bidi/luabidi)</span>
                      )}
                      {jobResult.languageReport.isMixed && (
                        <span style={{ color: '#2563eb' }}>· Secondary Scripts Wrapped with \text&lt;script&gt;</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Preview Tabs */}
              <div className="panel">
                <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '14px' }}>
                  <button
                    className={`filter-btn ${activeTab === 'latex' ? 'active' : ''}`}
                    onClick={() => setActiveTab('latex')}
                  >
                    LaTeX Source (main.tex)
                  </button>
                  <button
                    className={`filter-btn ${activeTab === 'warnings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('warnings')}
                  >
                    Integrity Warnings ({jobResult.warnings?.length || 0})
                  </button>
                  <button
                    className={`filter-btn ${activeTab === 'structure' ? 'active' : ''}`}
                    onClick={() => setActiveTab('structure')}
                  >
                    Project ZIP Structure
                  </button>
                </div>

                {/* Tab 1: LaTeX Code & Overleaf Segments Studio */}
                {activeTab === 'latex' && (
                  <div>
                    {/* Segment Selector & Copy Actions Bar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ flex: '1', minWidth: '260px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                            SELECT MANUSCRIPT SEGMENT FOR OVERLEAF:
                          </label>
                          <select
                            value={selectedSegment}
                            onChange={(e) => setSelectedSegment(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              color: 'var(--text)',
                              fontSize: '12px',
                              fontWeight: 600
                            }}
                          >
                            <optgroup label="Complete Master Documents">
                              <option value="standalone">⚡ Standalone All-in-One (Overleaf 1-Click Paste)</option>
                              <option value="main">📄 Master Document (main.tex)</option>
                              <option value="modular">🗂️ Modular Master Document (main_modular.tex)</option>
                            </optgroup>
                            <optgroup label="Bibliography">
                              <option value="bib">📚 References Bibliography (references.bib)</option>
                            </optgroup>
                            {jobResult.sections && jobResult.sections.length > 0 && (
                              <optgroup label="Individual Section Segments">
                                {jobResult.sections.map((s: any, idx: number) => (
                                  <option key={idx} value={`sec-${idx}`}>
                                    📑 {s.filename || `sections/${s.name}.tex`} — {s.heading}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>

                        {/* Copy Code Button */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                          <button
                            type="button"
                            className="primary"
                            onClick={() => handleCopy(currentSegmentData.content)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '9px 16px',
                              fontSize: '12px',
                              fontWeight: 600,
                              background: copied ? '#16a34a' : undefined,
                              borderColor: copied ? '#16a34a' : undefined,
                              cursor: 'pointer'
                            }}
                          >
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                            {copied ? 'Copied to Clipboard!' : 'Copy LaTeX Code'}
                          </button>
                        </div>
                      </div>

                      {/* Overleaf Quick Paste & Compiler Guide */}
                      <div style={{
                        padding: '12px 14px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(16,185,129,0.06))',
                        border: '1px solid var(--border)',
                        fontSize: '11px',
                        lineHeight: 1.5
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '4px' }}>
                          <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text)' }}>
                            🍀 Overleaf Copy-Paste Instructions
                          </strong>
                          <span className="subtle-tag" style={{ fontSize: '10px' }}>
                            Active File: <code style={{ color: 'var(--primary)', fontWeight: 600 }}>{currentSegmentData.filename}</code>
                          </span>
                        </div>
                        <div style={{ color: 'var(--muted)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px', marginTop: '6px' }}>
                          <div>
                            <strong style={{ color: 'var(--text)' }}>1. Fastest (Single File):</strong>
                            <div>Select <em>Standalone All-in-One</em>, click <strong>Copy LaTeX Code</strong>, paste directly into Overleaf's <code>main.tex</code>, and click <strong>Recompile</strong>.</div>
                          </div>
                          <div>
                            <strong style={{ color: 'var(--text)' }}>2. Separate Segments:</strong>
                            <div>Create <code>references.bib</code> in Overleaf and paste the bibliography. Create a <code>sections/</code> folder and paste each section segment into its own <code>.tex</code> file.</div>
                          </div>
                          <div>
                            <strong style={{ color: 'var(--text)' }}>3. Compiler Setting:</strong>
                            <div>
                              In Overleaf, click <strong>Menu</strong> (top left) <ArrowRight size={11} style={{ display: 'inline', verticalAlign: 'middle', margin: '0 2px' }} /> set <strong>Compiler</strong> to{' '}
                              <strong style={{ color: 'var(--text)' }}>
                                {jobResult.languageReport?.selectedEngine === 'lualatex' ? 'LuaLaTeX' : 'XeLaTeX'}
                              </strong>.
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* File Metadata Row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--muted)' }}>
                        <span>
                          {currentSegmentData.description}
                        </span>
                        <span>
                          {(currentSegmentData.content || '').split('\n').length} lines · {((currentSegmentData.content || '').length / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </div>

                    {/* Full Code Display */}
                    <pre style={{
                      background: 'var(--surface2)',
                      padding: '16px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      overflowX: 'auto',
                      maxHeight: '480px',
                      lineHeight: 1.5,
                      border: '1px solid var(--border)',
                      whiteSpace: 'pre',
                      margin: 0
                    }}>
                      {currentSegmentData.content || '% No content available for this segment'}
                    </pre>
                  </div>
                )}

                {/* Tab 2: Warnings Review */}
                {activeTab === 'warnings' && (
                  <div>
                    {jobResult.warnings && jobResult.warnings.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {jobResult.warnings.map((w: any, idx: number) => (
                          <div key={idx} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                              <span className="subtle-tag" style={{ textTransform: 'uppercase', fontSize: '10px' }}>{w.category || 'General'}</span>
                              <span style={{ fontSize: '11px', color: w.severity === 'error' ? '#dc2626' : (w.severity === 'warning' ? '#d97706' : '#2563eb'), fontWeight: 600 }}>
                                {w.severity || 'notice'}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '12px' }}>{w.message}</p>
                            {w.detail && <small style={{ color: 'var(--muted)', fontSize: '10px' }}>{w.detail}</small>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '32px', color: '#16a34a' }}>
                        <Check size={24} style={{ margin: '0 auto 8px' }} />
                        <strong>Zero Conversion Warnings</strong>
                        <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '4px 0 0 0' }}>All headings, citations, and structural nodes mapped cleanly.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Project Structure */}
                {activeTab === 'structure' && (
                  <div style={{ fontSize: '12px' }}>
                    <p style={{ color: 'var(--muted)', marginBottom: '12px' }}>
                      The generated ZIP package complies with the recommended Overleaf and TeX Live layout:
                    </p>
                    <pre style={{ background: 'var(--surface2)', padding: '14px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '11px' }}>
{`researchproof-apa7-manuscript/
├── main.tex                 # Compilable APA 7 LaTeX master document
├── references.bib           # Formatted BibTeX bibliography
├── README.md                # Local & Overleaf compilation instructions
├── conversion-report.json   # Machine-readable conversion findings
├── latexmkrc                # Automation script for latexmk + biber
├── sections/                # Partitioned manuscript sections
│   ├── introduction.tex
│   └── method.tex
├── figures/                 # Figure image assets
└── tables/                  # Booktabs table definitions`}
                    </pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Empty State before first conversion */
            <div className="panel" style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--muted)' }}>
              <BookOpen size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
              <h3 style={{ fontSize: '16px', color: 'var(--text)', marginBottom: '8px' }}>Ready for APA 7 Conversion</h3>
              <p style={{ maxWidth: '440px', margin: '0 auto 20px', fontSize: '13px', lineHeight: 1.5 }}>
                Select a manuscript template, confirm author metadata, and click <strong>"Convert to APA 7 LaTeX"</strong> to generate a complete downloadable ZIP package with LaTeX sources and BibTeX references.
              </p>
              <div style={{ display: 'inline-flex', gap: '16px', fontSize: '11px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Check size={12} style={{ color: 'var(--rp-success)' }} /> apa7 stu & man support</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Check size={12} style={{ color: 'var(--rp-success)' }} /> Booktabs formatting</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Check size={12} style={{ color: 'var(--rp-success)' }} /> BibLaTeX & Biber</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Check size={12} style={{ color: 'var(--rp-success)' }} /> Overleaf compatible</span>
              </div>
            </div>
          )}

        </div>

      </div>
    </section>
  );
}


