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
    { name: 'Integrity Reports', icon: FileCheck2, group: 'RESEARCH TOOLS' },
    { name: 'AI Assessment', icon: ScanText, group: 'RESEARCH TOOLS' },
    { name: 'Originality Review', icon: FileText, group: 'RESEARCH TOOLS' },
    { name: 'Projects', icon: FolderKanban, group: 'MANAGE' },
    { name: 'Revision History', icon: History, group: 'MANAGE' },
    { name: 'Privacy & Data', icon: ShieldAlert, group: 'MANAGE' },
    { name: 'Settings', icon: Settings2, group: 'MANAGE' },
    ...(user.role === 'admin' ? [
      { name: 'Admin Overview', icon: Gauge, group: 'ADMINISTRATION' },
      { name: 'User Management', icon: FolderKanban, group: 'ADMINISTRATION' },
      { name: 'Usage Analytics', icon: Activity, group: 'ADMINISTRATION' },
      { name: 'Platform Audit Logs', icon: History, group: 'ADMINISTRATION' }
    ] : [])
  ];
  const groups = [...new Set(nav.map(n => n.group))];

  return (
    <div className={`app-shell ${dark ? 'dark' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={20} /></div>
          <div><strong>ResearchProof <span>AI</span></strong><small>PHASE 3 PLATFORM MANAGEMENT</small></div>
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

          {section === 'Usage Analytics' && user?.role === 'admin' && (
            <AdminAnalyticsPage token={token} setError={setError} />
          )}

          {section === 'Platform Audit Logs' && user?.role === 'admin' && (
            <AdminAuditLogsPage token={token} setError={setError} />
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

/* =========================================================
   PHASE 3: RESEARCH INTEGRITY REPORTS VIEW
   ========================================================= */
function IntegrityReportsPage({ token, documents, activeDoc, setMessage, setError }: any) {
  const [selectedDocId, setSelectedDocId] = useState(activeDoc?._id || '');
  const [reportText, setReportText] = useState(activeDoc?.content || sampleText);
  const [currentReport, setCurrentReport] = useState<any>(null);
  const [pastReports, setPastReports] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

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
      setMessage(`Audit complete: ${res.summaryMetrics.totalFindings} findings identified.`);
      await fetchReports();
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

  return (
    <section className="analysis-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">SCIENTIFIC RIGOR</p>
          <h1>Research Integrity Reports</h1>
          <p className="muted">Transparent heuristic checks for sentence complexity, meaning preservation, citation integrity, and acronym consistency.</p>
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
          <button className="primary" onClick={handleRunAudit} disabled={busy}>
            {busy ? <RefreshCw size={14} className="spin" /> : <ShieldCheck size={14} />} Run Integrity Audit
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

      {currentReport && (
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

          <div className="panel" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
            <strong style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Scope & Scientific Limitations</strong>
            <p style={{ fontSize: '10px', color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>{currentReport.limitations}</p>
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
              <small style={{ color: '#b45309', fontWeight: 600, display: 'block', marginTop: '4px' }}>
                ⚠ Server policy overrides local preference: PERSIST_DOCUMENT_TEXT is globally disabled on this deployment.
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
function AdminAnalyticsPage({ token, setError }: any) {
  const [features, setFeatures] = useState<any[]>([]);
  const [errors, setErrors] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      request('/admin/analytics/features', token, undefined, 'GET').catch(() => []),
      request('/admin/analytics/errors', token, undefined, 'GET').catch(() => [])
    ]).then(([f, e]) => {
      setFeatures(f);
      setErrors(e);
    }).catch(err => setError(err.message));
  }, []);

  const maxCount = Math.max(...features.map(f => f.count), 1);

  return (
    <section className="analysis-page">
      <div className="page-title-row">
        <div>
          <p className="eyebrow">TELEMETRY & INSIGHTS</p>
          <h1>Platform Usage Analytics</h1>
          <p className="muted">Aggregate feature distribution, error trends, and provider requests.</p>
        </div>
        <div className="page-title-icon"><Activity /></div>
      </div>

      <div className="panel" style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '14px', marginBottom: '16px' }}>Feature Request Distribution</h3>
        {features.length ? features.map((f: any) => (
          <div key={f.feature} className="chart-bar-row">
            <span style={{ width: '140px', fontWeight: 600, textTransform: 'capitalize' }}>{f.feature}</span>
            <div className="chart-bar-bg">
              <div className="chart-bar-fill" style={{ width: `${Math.round((f.count / maxCount) * 100)}%` }} />
            </div>
            <span style={{ width: '60px', textAlign: 'right', color: 'var(--muted)' }}>{f.count} reqs</span>
          </div>
        )) : (
          <div className="empty-state">No feature activity recorded yet.</div>
        )}
      </div>

      <div className="panel">
        <h3 style={{ fontSize: '14px', marginBottom: '14px' }}>Recent System Error Trends</h3>
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

