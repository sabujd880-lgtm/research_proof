import { useEffect, useMemo, useState, useRef } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import {
  Activity, BookOpen, BookOpenCheck, Check, ChevronDown, CircleHelp, Clock3,
  Download, FileCheck2, FileText, FolderKanban, Gauge, History, LayoutDashboard,
  LogOut, Moon, PanelLeft, Plus, RefreshCw, ScanText, Settings2, ShieldAlert,
  ShieldCheck, Sparkles, Sun, Trash2, Upload, WandSparkles, X, AlertTriangle, AlertCircle
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '/api' : 'http://localhost:4000/api');
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const isGoogleConfigured = Boolean(
  GOOGLE_CLIENT_ID &&
  !GOOGLE_CLIENT_ID.includes('your-google-oauth-client-id') &&
  GOOGLE_CLIENT_ID.trim().length > 10
);

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

type Project = { _id: string; title: string; description: string; updatedAt: string };

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
  { id: 'grammar-correction', name: 'Grammar correction', desc: 'Fix syntax and errors with minimal changes' },
  { id: 'concise-academic', name: 'Concise academic', desc: 'Remove circumlocution and redundancy' },
  { id: 'formal-scientific', name: 'Formal scientific tone', desc: 'Elevate phrasing for peer-reviewed literature' },
  { id: 'readability-improvement', name: 'Readability improvement', desc: 'Optimize sentence lengths and cognitive flow' },
  { id: 'paragraph-restructure', name: 'Paragraph restructuring', desc: 'Reorganize topic sentences and transitions' },
  { id: 'thesis-dissertation', name: 'Thesis / dissertation', desc: 'In-depth academic framing and rigor' },
  { id: 'journal-manuscript', name: 'Journal manuscript', desc: 'Publication-ready top-tier prose' }
];

async function request(path: string, token: string, body?: unknown, method = 'POST') {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    credentials: 'include',
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
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

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('rp_token') || '');
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [section, setSection] = useState('Writing Studio');
  const [dark, setDark] = useState(true);
  const [persist, setPersist] = useState(true);

  // Core Data
  const [projects, setProjects] = useState<Project[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [citationsList, setCitationsList] = useState<CitationItem[]>([]);
  const [usage, setUsage] = useState<any>(null);

  // Active Document State
  const [activeDoc, setActiveDoc] = useState<DocumentItem | null>(null);
  const [docTitle, setDocTitle] = useState('Untitled Academic Document');
  const [text, setText] = useState(sampleText);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // AI Rewriting & Inspector State
  const [rewriteMode, setRewriteMode] = useState('academic-clarity');
  const [preserveTerms, setPreserveTerms] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [inspectorTab, setInspectorTab] = useState<'warnings' | 'diff' | 'citations' | 'history'>('warnings');
  const [proposedText, setProposedText] = useState('');
  const [currentWarnings, setCurrentWarnings] = useState<MeaningWarning[]>([]);
  const [proposedRevision, setProposedRevision] = useState<any>(null);

  // Citation Assistant Local State
  const [lookupDoiInput, setLookupDoiInput] = useState('');
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [citationFormatStyle, setCitationFormatStyle] = useState<'apa' | 'mla' | 'ieee'>('apa');
  const [citationAuditResult, setCitationAuditResult] = useState<any>(null);

  // Analysis Page Results
  const [assessment, setAssessment] = useState<any>(null);
  const [originality, setOriginality] = useState<any>(null);
  const [citationsAnalysis, setCitationsAnalysis] = useState<any>(null);

  // Project Creation Modal
  const [projectTitle, setProjectTitle] = useState('');
  const [showProjectForm, setShowProjectForm] = useState(false);

  // Debounced Autosave ref
  const autosaveTimeout = useRef<any>(null);

  useEffect(() => {
    request('/auth/me', token, undefined, 'GET')
      .then((d) => setUser(d.user))
      .catch(() => {
        if (token) {
          localStorage.removeItem('rp_token');
          setToken('');
        }
        setUser(null);
      });
  }, [token]);

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

  // Accept Proposed Revision
  async function handleAcceptRevision() {
    if (!proposedRevision) return;
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

  // DOCX Import
  async function handleImportDocx(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.docx$/i.test(file.name)) {
      setError('Please upload a valid Microsoft Word (.docx) file.');
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
    try {
      const d = await fetch(`${API}/auth/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      const result = await d.json();
      if (!d.ok) throw new Error(result.error || 'Authentication failed.');
      localStorage.setItem('rp_token', result.token);
      setToken(result.token);
      setUser(result.user);
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
  }

  async function runAction(action: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (!text.trim()) throw new Error('Add text to the editor first.');
      if (action === 'writing') {
        setAssessment(await request('/analyze/writing', token, { text }));
        setSection('AI Assessment');
      } else if (action === 'originality') {
        setOriginality(await request('/analyze/originality', token, { text }));
        setSection('Originality Review');
      } else if (action === 'citations') {
        setCitationsAnalysis(await request('/analyze/citations', token, { text }));
        setSection('Citation Checker');
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

  // Auth Screen
  if (!user) {
    const authContent = (
      <div className="auth-card">
        <div className="brand-mark"><ShieldCheck size={25} /></div>
        <p className="eyebrow">ACADEMIC WORKSPACE</p>
        <h1>ResearchProof <span>AI</span></h1>
        <p className="muted">Rigorous scientific writing assistance and research integrity platform.</p>

        {isGoogleConfigured ? (
          <div className="google-btn-wrap">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setAuthError('Google sign-in encountered an error.')}
              theme={dark ? 'filled_black' : 'outline'}
              shape="rectangular"
              size="large"
              width="340"
              text="continue_with"
            />
          </div>
        ) : (
          <div className="google-notice">
            <strong>Google Sign-In Ready</strong>
            <span>Set <code>VITE_GOOGLE_CLIENT_ID</code> in client/.env to activate one-click Google Sign-In.</span>
          </div>
        )}

        <div className="auth-divider">or continue with email</div>

        <form onSubmit={authenticate} className="auth-form">
          <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@university.edu" /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={10} placeholder="At least 10 characters" /></label>
          {authError && <div className="alert error">{authError}</div>}
          <button className="primary full" type="submit">{authMode === 'register' ? 'Create secure account' : 'Sign in'} <span>→</span></button>
        </form>
        <p className="switch-auth">
          {authMode === 'register' ? 'Already registered?' : 'New to ResearchProof?'} <button className="text-button" onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')}>{authMode === 'register' ? 'Sign in' : 'Create account'}</button>
        </p>
        <div className="privacy-note"><ShieldCheck size={16} /> Your research manuscripts are never persisted without your consent.</div>
      </div>
    );

    return (
      <div className={`auth-page ${dark ? 'dark' : ''}`}>
        {isGoogleConfigured ? (
          <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            {authContent}
          </GoogleOAuthProvider>
        ) : (
          authContent
        )}
      </div>
    );
  }

  // Navigation Items
  const nav = [
    { name: 'Writing Studio', icon: WandSparkles, group: 'WORKSPACE' },
    { name: 'Dashboard', icon: LayoutDashboard, group: 'WORKSPACE' },
    { name: 'Citation Assistant', icon: BookOpenCheck, group: 'RESEARCH TOOLS' },
    { name: 'AI Assessment', icon: ScanText, group: 'RESEARCH TOOLS' },
    { name: 'Originality Review', icon: FileCheck2, group: 'RESEARCH TOOLS' },
    { name: 'Projects', icon: FolderKanban, group: 'MANAGE' },
    { name: 'Revision History', icon: History, group: 'MANAGE' },
    { name: 'Settings', icon: Settings2, group: 'MANAGE' }
  ];
  const groups = [...new Set(nav.map(n => n.group))];

  return (
    <div className={`app-shell ${dark ? 'dark' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={20} /></div>
          <div><strong>ResearchProof <span>AI</span></strong><small>PHASE 2 ACADEMIC SUITE</small></div>
          <button className="icon-button mobile-menu" aria-label="Toggle sidebar"><PanelLeft size={18} /></button>
        </div>

        <div className="workspace-pill">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.displayName || user.email} className="avatar-img" />
          ) : (
            <div className="avatar">{(user.displayName || user.email)[0]?.toUpperCase()}</div>
          )}
          <div>
            <strong>{user.displayName || 'Research workspace'}</strong>
            <small>{user.email}</small>
          </div>
          <ChevronDown size={15} />
        </div>

        <nav>
          {groups.map(group => (
            <div className="nav-group" key={group}>
              <p>{group}</p>
              {nav.filter(n => n.group === group).map(item => (
                <button
                  key={item.name}
                  onClick={() => setSection(item.name)}
                  className={`nav-item ${section === item.name ? 'active' : ''}`}
                >
                  <item.icon size={17} />
                  <span>{item.name}</span>
                  {item.name === 'Revision History' && revisions.length > 0 && <small className="nav-count">{revisions.length}</small>}
                  {item.name === 'Citation Assistant' && citationsList.length > 0 && <small className="nav-count">{citationsList.length}</small>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="integrity-card">
            <div className="integrity-icon"><ShieldCheck size={18} /></div>
            <strong>Meaning preservation</strong>
            <p>Empirical facts, p-values, sample sizes, and citations are deterministically validated.</p>
          </div>
          <div className="user-row">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.displayName || user.email} className="avatar-img" />
            ) : (
              <div className="avatar">{(user.displayName || user.email)[0]?.toUpperCase()}</div>
            )}
            <div className="user-meta">
              <strong>{user.displayName || user.email.split('@')[0]}</strong>
              <small>{user.email}</small>
            </div>
            <button className="icon-button" onClick={logout} title="Sign out"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>{section}</strong>
          </div>
          <div className="top-actions">
            <div className="secure-label"><span className="green-dot"></span> Authenticated Session</div>
            <button className="icon-button" onClick={() => setDark(!dark)} title="Toggle theme">
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="help-button" onClick={() => setSection('Settings')}>
              <CircleHelp size={17} /> Help & settings
            </button>
          </div>
        </header>

        <div className="page-content">
          {error && <div className="alert error">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
          {message && <div className="alert success"><Check size={16} />{message}<button onClick={() => setMessage('')}>Dismiss</button></div>}

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
                    Manage references ↗
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
                    <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
                      {saveStatus === 'saving' && 'Saving…'}
                      {saveStatus === 'saved' && '✓ Saved'}
                      {saveStatus === 'unsaved' && '● Unsaved'}
                    </span>

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
                    <button className="text-button" onClick={() => runAction('writing')}>Writing Assessment ↗</button>
                    <button className="text-button" onClick={() => runAction('originality')}>Originality Check ↗</button>
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
                    Revision Diff
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
                          <button className="primary small" onClick={handleAcceptRevision} disabled={busy} style={{ flex: 1 }}>
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

                {/* Tab 3: Citation Assistant */}
                {inspectorTab === 'citations' && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '8px' }}>Quick DOI Lookup</div>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                      <input
                        type="text"
                        placeholder="10.1038/s41586-..."
                        value={lookupDoiInput}
                        onChange={(e) => setLookupDoiInput(e.target.value)}
                        style={{ flex: 1, fontSize: '11px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)' }}
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
                          <div style={{ fontWeight: 700, color: citationAuditResult.valid ? '#34c98b' : '#e46f7a', marginBottom: '6px' }}>
                            {citationAuditResult.valid ? '✓ All citations verified' : '⚠ Citation discrepancies detected'}
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
            </div>
          )}

          {/* DASHBOARD VIEW */}
          {section === 'Dashboard' && (
            <Dashboard
              user={user}
              usage={usage}
              projects={projects}
              revisions={revisions}
              documents={documents}
              setSection={setSection}
              setShowProjectForm={setShowProjectForm}
            />
          )}

          {/* CITATION ASSISTANT VIEW */}
          {section === 'Citation Assistant' && (
            <CitationAssistantPage
              citations={citationsList}
              lookupDoiInput={lookupDoiInput}
              setLookupDoiInput={setLookupDoiInput}
              handleLookupDoi={handleLookupDoi}
              lookupResult={lookupResult}
              citationFormatStyle={citationFormatStyle}
              setCitationFormatStyle={setCitationFormatStyle}
              handleAddCitationToLibrary={handleAddCitationToLibrary}
              busy={busy}
              onDeleteCitation={async (id: string) => {
                await request(`/citations/${id}`, token, undefined, 'DELETE');
                setCitationsList(citationsList.filter(c => c._id !== id));
                setMessage('Citation removed from library.');
              }}
            />
          )}

          {/* ANALYSIS PAGES */}
          {section === 'AI Assessment' && (
            <AnalysisPage
              title="AI-writing assessment"
              subtitle="Review writing patterns that may deserve a closer look. This is not an authorship detector."
              icon={<ScanText />}
              run={() => runAction('writing')}
              busy={busy}
              result={assessment}
              text={text}
              setText={setText}
            />
          )}

          {section === 'Originality Review' && (
            <AnalysisPage
              title="Originality review"
              subtitle="Find repeated phrases inside this document. No external databases are queried."
              icon={<FileCheck2 />}
              run={() => runAction('originality')}
              busy={busy}
              result={originality}
              text={text}
              setText={setText}
            />
          )}

          {section === 'Citation Checker' && (
            <AnalysisPage
              title="Citation consistency"
              subtitle="Check basic author-year citation and reference-list patterns."
              icon={<BookOpenCheck />}
              run={() => runAction('citations')}
              busy={busy}
              result={citationsAnalysis}
              text={text}
              setText={setText}
            />
          )}

          {/* PROJECTS VIEW */}
          {section === 'Projects' && (
            <Projects
              projects={projects}
              showForm={showProjectForm}
              setShowForm={setShowProjectForm}
              title={projectTitle}
              setTitle={setProjectTitle}
              createProject={async (e: any) => {
                e.preventDefault();
                try {
                  await request('/projects', token, { title: projectTitle });
                  setProjectTitle('');
                  setShowProjectForm(false);
                  await refreshData();
                  setMessage('Project created.');
                } catch (e: any) { setError(e.message); }
              }}
              deleteProject={async (id: string) => {
                if (!confirm('Delete this project?')) return;
                try {
                  await request(`/projects/${id}`, token, undefined, 'DELETE');
                  await refreshData();
                } catch (e: any) { setError(e.message); }
              }}
            />
          )}

          {/* REVISION HISTORY VIEW */}
          {section === 'Revision History' && (
            <HistoryPage revisions={revisions} />
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
              logout={logout}
              onLinkGoogle={handleLinkGoogle}
              isGoogleConfigured={isGoogleConfigured}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function Dashboard({ user, usage, projects, revisions, documents, setSection, setShowProjectForm }: any) {
  return (
    <section className="dashboard">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">YOUR RESEARCH, IN FOCUS</p>
          <h1>Good work starts with <span>clarity.</span></h1>
          <p className="muted">A focused workspace for stronger academic writing and responsible research.</p>
        </div>
        <button className="primary" onClick={() => setSection('Writing Studio')}><Plus size={17} /> Open Writing Studio</button>
      </div>

      <div className="stats-grid">
        <Stat icon={<FileText />} label="Manuscripts & Docs" value={documents?.length || 0} note="Active studio documents" />
        <Stat icon={<FolderKanban />} label="Research Projects" value={projects?.length || 0} note="Organised research workspaces" />
        <Stat
          icon={<Activity />}
          label="Free AI Rewriting Quota"
          value={usage ? `${usage.rewrite?.remaining}/${usage.rewrite?.limit}` : '5/5'}
          note={usage?.aiAvailable ? 'Revisions remaining today' : 'Non-AI tools active'}
        />
      </div>

      <div className="section-heading">
        <div>
          <h2>Phase 2 Academic Toolkit</h2>
          <p>Scientific writing tools built for research rigor.</p>
        </div>
        <span className="subtle-tag"><ShieldCheck size={14} /> Meaning-preserving pipeline</span>
      </div>

      <div className="tool-grid">
        <ToolCard icon={<WandSparkles />} tone="purple" title="Academic Writing Studio" description="Full-featured 3-column workspace with live diffs and DOCX import/export." onClick={() => setSection('Writing Studio')} action="Open studio" />
        <ToolCard icon={<BookOpenCheck />} tone="amber" title="Citation Assistant" description="DOI lookup via Crossref, APA/MLA/IEEE formatting, and integrity audits." onClick={() => setSection('Citation Assistant')} action="Open citations" />
        <ToolCard icon={<ScanText />} tone="blue" title="AI Assessment" description="Review sentence structures and readability without automated claims." onClick={() => setSection('AI Assessment')} action="Review text" />
        <ToolCard icon={<FileCheck2 />} tone="green" title="Originality Check" description="Scan for internal phrase repetition across sections." onClick={() => setSection('Originality Review')} action="Run check" />
      </div>

      <div className="bottom-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Recent manuscripts</h3>
              <p>Continue editing your research.</p>
            </div>
            <button className="text-button" onClick={() => setSection('Writing Studio')}>Open Studio ↗</button>
          </div>
          {documents?.length ? documents.slice(0, 3).map((d: DocumentItem) => (
            <div className="list-row" key={d._id} onClick={() => setSection('Writing Studio')} style={{ cursor: 'pointer' }}>
              <div className="mini-icon"><FileText size={17} /></div>
              <div className="list-main">
                <strong>{d.title}</strong>
                <small>{d.wordCount} words · v{d.version || 1} · Updated {new Date(d.updatedAt).toLocaleDateString()}</small>
              </div>
              <span className="row-arrow">↗</span>
            </div>
          )) : (
            <div className="empty-state">
              <FileText size={22} />
              <strong>No manuscripts yet</strong>
              <p>Create or import a document in the Academic Writing Studio.</p>
            </div>
          )}
        </div>

        <div className="panel integrity-panel">
          <div className="panel-heading">
            <div>
              <h3>Research integrity checklist</h3>
              <p>Key standards before submission</p>
            </div>
            <ShieldCheck size={20} />
          </div>
          {[
            'Deterministic meaning audit: Check negations and findings',
            'Crossref metadata verification: Validate all active DOIs',
            'No silent overwrite: Revisions require explicit user acceptance',
            'Safe export: Clean Office Open XML generation with references'
          ].map((s, i) => (
            <div className="check-row" key={s}>
              <span>{i + 1}</span>
              <p>{s}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({ icon, label, value, note }: any) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function ToolCard({ icon, tone, title, description, onClick, action }: any) {
  return (
    <button className="tool-card" onClick={onClick}>
      <div className={`tool-icon ${tone}`}>{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      <span className="tool-action">{action} <span>→</span></span>
    </button>
  );
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
                <span className="subtle-tag" style={{ color: '#34c98b' }}>✓ Crossref Verified</span>
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

function AnalysisPage({ title, subtitle, icon, run, busy, result, text, setText }: any) {
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
          <div className="panel-heading">
            <div>
              <h3>Text to review</h3>
              <p>{text.trim() ? text.trim().split(/\s+/).length : 0} words</p>
            </div>
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Paste a passage for review…" />
          <button className="primary full" onClick={run} disabled={busy || !text.trim()}>
            {busy ? 'Analysing…' : 'Run review'} <span>→</span>
          </button>
        </div>

        <div className="panel analysis-results">
          <div className="panel-heading">
            <div>
              <h3>Review results</h3>
              <p>Indicators for human review</p>
            </div>
            <div className="result-icon">{icon}</div>
          </div>

          {!result ? (
            <div className="empty-state results-empty">
              <div className="empty-orb">{icon}</div>
              <strong>Your review will appear here</strong>
              <p>Run the check to see observations and next steps.</p>
            </div>
          ) : (
            <div className="results-body">
              {result.wordCount !== undefined && (
                <div className="metrics-row">
                  <div><small>Words</small><strong>{result.wordCount}</strong></div>
                  <div><small>Sentences</small><strong>{result.sentenceCount}</strong></div>
                  <div><small>Avg. sentence</small><strong>{result.averageWordsPerSentence}</strong></div>
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
                result.repeatedPhrases.length ? result.repeatedPhrases.map((p: any) => (
                  <div className="observation" key={p.phrase}>
                    <span className="level-dot review"></span>
                    <div>
                      <strong>“{p.phrase}” · {p.count} times</strong>
                      <p>{p.note}</p>
                    </div>
                  </div>
                )) : (
                  <div className="notice-box"><Check size={18} /><div><strong>No repeated phrases flagged</strong><p>Within-document repetition check clear.</p></div></div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Projects({ projects, showForm, setShowForm, title, setTitle, createProject, deleteProject }: any) {
  return (
    <section className="analysis-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">ORGANISE YOUR WORK</p>
          <h1>Research projects</h1>
          <p className="muted">Group research drafts, citations, and revision histories by project.</p>
        </div>
        <button className="primary" onClick={() => setShowForm(!showForm)}><Plus size={16} /> New project</button>
      </div>

      {showForm && (
        <form className="panel project-form" onSubmit={createProject}>
          <label>Project title<input value={title} onChange={e => setTitle(e.target.value)} required maxLength={160} placeholder="e.g. Dissertation — Cognitive Neurobiology" /></label>
          <button className="primary" type="submit">Create project</button>
        </form>
      )}

      <div className="project-grid">
        {projects.map((p: Project) => (
          <div className="panel project-card" key={p._id}>
            <div className="project-icon"><FolderKanban size={20} /></div>
            <button className="icon-button danger-button" onClick={() => deleteProject(p._id)} title="Delete project"><Trash2 size={16} /></button>
            <h3>{p.title}</h3>
            <p>{p.description || 'Research workspace'}</p>
            <small>Updated {new Date(p.updatedAt).toLocaleDateString()}</small>
          </div>
        ))}
        {!projects.length && (
          <div className="panel empty-projects">
            <FolderKanban size={30} />
            <h3>No projects created</h3>
            <p>Create a project to organise your academic manuscripts and references.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function HistoryPage({ revisions }: { revisions: Revision[] }) {
  const [selected, setSelected] = useState<Revision | null>(null);
  return (
    <section className="analysis-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">YOUR RECORD</p>
          <h1>Revision history</h1>
          <p className="muted">Complete chronological record of all proposed and accepted revisions.</p>
        </div>
        <div className="page-title-icon"><History /></div>
      </div>

      <div className="panel history-panel">
        {revisions.length ? revisions.map(r => (
          <button className={`history-row ${selected?._id === r._id ? 'selected' : ''}`} key={r._id} onClick={() => setSelected(r)}>
            <div className="mini-icon"><FileText size={17} /></div>
            <div className="list-main">
              <strong>{r.mode} mode {r.status ? `(${r.status})` : ''}</strong>
              <small>{new Date(r.createdAt).toLocaleString()} · {r.originalText.trim().split(/\s+/).length} words</small>
              <p>{r.summary || 'Revision recorded'}</p>
            </div>
            <span className="row-arrow">→</span>
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
      )}
    </section>
  );
}

function SettingsPage({ user, usage, dark, setDark, persist, setPersist, logout, onLinkGoogle, isGoogleConfigured }: any) {
  return (
    <section className="analysis-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">PREFERENCES</p>
          <h1>Settings & privacy</h1>
          <p className="muted">Configure authentication, quotas, and research persistence settings.</p>
        </div>
        <div className="page-title-icon"><Settings2 /></div>
      </div>

      <div className="settings-list panel">
        <div className="setting-row">
          <div className="setting-icon"><ShieldCheck size={18} /></div>
          <div className="setting-copy">
            <strong>Account & Identity</strong>
            <p>Signed in as <strong>{user?.email}</strong> · Role: <strong>{user?.role || 'researcher'}</strong> · Status: <strong>{user?.status || 'active'}</strong></p>
            <div style={{ marginTop: '8px' }}>
              {(user?.authProviders || ['email']).map((p: string) => (
                <span key={p} className="provider-tag">{p === 'google' ? '✓ Google Connected' : '✓ Password Auth'}</span>
              ))}
            </div>
            {isGoogleConfigured && !user?.authProviders?.includes('google') && (
              <div style={{ marginTop: '14px', background: 'var(--surface2)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <strong style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Connect Google Account</strong>
                <p style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '10px' }}>Link your Google identity for instant one-click sign-in across devices.</p>
                <GoogleLogin
                  onSuccess={onLinkGoogle}
                  onError={() => {}}
                  theme={dark ? 'filled_black' : 'outline'}
                  shape="rectangular"
                  size="medium"
                  text="continue_with"
                />
              </div>
            )}
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-icon"><Gauge size={18} /></div>
          <div className="setting-copy">
            <strong>Daily Free AI Quota (Phase 1 & 2)</strong>
            <p>
              AI rewriting: <strong>{usage?.rewrite?.used || 0} / {usage?.rewrite?.limit || 5}</strong> used today (max {usage?.rewrite?.maxWords || 2000} words) · Analysis checks: <strong>{usage?.analysis?.used || 0} / {usage?.analysis?.limit || 10}</strong> used today (max {usage?.analysis?.maxWords || 5000} words).
            </p>
            <div style={{ marginTop: '6px', fontSize: '10px', fontWeight: 600, color: usage?.aiAvailable ? '#34c98b' : '#e7a43b' }}>
              {usage?.aiAvailable ? '● AI Provider Connected and Ready' : '○ AI Provider Unconfigured (Non-AI tools remain fully functional)'}
            </div>
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-icon"><Sun size={18} /></div>
          <div className="setting-copy">
            <strong>Appearance</strong>
            <p>Choose workspace theme mode.</p>
          </div>
          <button className="secondary small" onClick={() => setDark(!dark)}>
            {dark ? 'Dark mode' : 'Light mode'} · Toggle
          </button>
        </div>

        <div className="setting-row">
          <div className="setting-icon"><History size={18} /></div>
          <div className="setting-copy">
            <strong>Manuscript Persistence</strong>
            <p>Automatically save revision history and document drafts.</p>
          </div>
          <label className="switch-label">
            <input type="checkbox" checked={persist} onChange={e => setPersist(e.target.checked)} />
            <span>{persist ? 'On' : 'Off'}</span>
          </label>
        </div>

        <div className="setting-row">
          <div className="setting-icon"><LogOut size={18} /></div>
          <div className="setting-copy">
            <strong>Sign out</strong>
            <p>End the current session on this device.</p>
          </div>
          <button className="secondary small" onClick={logout}>Sign out</button>
        </div>
      </div>
    </section>
  );
}
