import { useEffect, useMemo, useState } from 'react';
import {
  Activity, BookOpenCheck, Check, ChevronDown, CircleHelp, Clock3, FileCheck2,
  FileText, FolderKanban, Gauge, History, LayoutDashboard, LogOut, Moon, PanelLeft,
  Plus, ScanText, Settings2, ShieldCheck, Sparkles, Sun, Trash2, Upload, WandSparkles
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '/api' : 'http://localhost:4000/api');
type User = { id: string; email: string };
type Revision = { _id: string; mode: string; summary: string; createdAt: string; originalText: string; revisedText: string };
type Project = { _id: string; title: string; description: string; updatedAt: string };

const sampleText = `The present study aims to examine the relationship between the variables under consideration. The findings should be interpreted within the limits of the sample and the methods used. Further research may help clarify whether these patterns are consistent across different populations.`;

async function request(path: string, token: string, body?: unknown, method = 'POST') {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('rp_token') || '');
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [section, setSection] = useState('Dashboard');
  const [text, setText] = useState(sampleText);
  const [revised, setRevised] = useState('');
  const [style, setStyle] = useState('Natural Scholarly');
  const [preserveTerms, setPreserveTerms] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [assessment, setAssessment] = useState<any>(null);
  const [originality, setOriginality] = useState<any>(null);
  const [citations, setCitations] = useState<any>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [projectTitle, setProjectTitle] = useState('');
  const [dark, setDark] = useState(true);
  const [persist, setPersist] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);

  useEffect(() => {
    if (!token) return;
    request('/me', token, undefined, 'GET')
      .then((d) => setUser(d.user))
      .catch(() => { localStorage.removeItem('rp_token'); setToken(''); setUser(null); });
  }, [token]);

  async function refreshData() {
    if (!token) return;
    try {
      const [p, r] = await Promise.all([
        request('/projects', token, undefined, 'GET'),
        request('/revisions', token, undefined, 'GET')
      ]);
      setProjects(p); setRevisions(r);
    } catch (e: any) { setError(e.message); }
  }
  useEffect(() => { if (user) refreshData(); }, [user]);

  async function authenticate(e: React.FormEvent) {
    e.preventDefault(); setAuthError('');
    try {
      const d = await fetch(`${API}/auth/${authMode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const result = await d.json();
      if (!d.ok) throw new Error(result.error || 'Authentication failed.');
      localStorage.setItem('rp_token', result.token); setToken(result.token); setUser(result.user);
    } catch (e: any) { setAuthError(e.message); }
  }
  function logout() {
    localStorage.removeItem('rp_token'); setToken(''); setUser(null); setAssessment(null); setOriginality(null); setCitations(null);
  }
  async function runAction(action: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      if (!text.trim()) throw new Error('Add text to the editor first.');
      if (action === 'humanize') {
        const d = await request('/humanize', token, { text, style, preserveTerms, saveRevision: persist });
        setRevised(d.revisedText); setMessage('Revision ready. Review every change before using it in your research.');
        await refreshData();
      } else if (action === 'writing') {
        setAssessment(await request('/analyze/writing', token, { text }));
        setSection('AI Assessment');
      } else if (action === 'originality') {
        setOriginality(await request('/analyze/originality', token, { text }));
        setSection('Originality Review');
      } else if (action === 'citations') {
        setCitations(await request('/analyze/citations', token, { text }));
        setSection('Citation Checker');
      }
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    try {
      await request('/projects', token, { title: projectTitle });
      setProjectTitle(''); setShowProjectForm(false); await refreshData(); setMessage('Project created.');
    } catch (e: any) { setError(e.message); }
  }
  async function deleteProject(id: string) {
    if (!confirm('Delete this project and its associated revision history?')) return;
    try { await request(`/projects/${id}`, token, undefined, 'DELETE'); await refreshData(); }
    catch (e: any) { setError(e.message); }
  }
  function exportText(value: string, filename: string) {
    const blob = new Blob([value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }
  function importText(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (!/\.(txt|md)$/i.test(file.name)) { setError('This starter supports .txt and .md import. DOCX support can be added next.'); return; }
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ''));
    reader.readAsText(file); e.target.value = '';
  }
  const wordCount = useMemo(() => text.trim() ? text.trim().split(/\s+/).length : 0, [text]);

  if (!user) return <div className={`auth-page ${dark ? 'dark' : ''}`}>
    <div className="auth-card">
      <div className="brand-mark"><ShieldCheck size={25} /></div>
      <p className="eyebrow">ACADEMIC WORKSPACE</p>
      <h1>ResearchProof <span>AI</span></h1>
      <p className="muted">A clearer writing process. A stronger research record.</p>
      <form onSubmit={authenticate} className="auth-form">
        <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@university.edu" /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={10} placeholder="At least 10 characters" /></label>
        {authError && <div className="alert error">{authError}</div>}
        <button className="primary full" type="submit">{authMode === 'register' ? 'Create secure account' : 'Sign in'} <span>→</span></button>
      </form>
      <p className="switch-auth">{authMode === 'register' ? 'Already registered?' : 'New to ResearchProof?'} <button className="text-button" onClick={() => setAuthMode(authMode === 'register' ? 'login' : 'register')}>{authMode === 'register' ? 'Sign in' : 'Create account'}</button></p>
      <div className="privacy-note"><ShieldCheck size={16} /> Your research text is not saved to revision history unless you opt in.</div>
    </div>
  </div>;

  const nav = [
    { name: 'Dashboard', icon: LayoutDashboard, group: 'WORKSPACE' },
    { name: 'Writing Humanizer', icon: WandSparkles, group: 'WORKSPACE' },
    { name: 'AI Assessment', icon: ScanText, group: 'ANALYSIS' },
    { name: 'Originality Review', icon: FileCheck2, group: 'ANALYSIS' },
    { name: 'Citation Checker', icon: BookOpenCheck, group: 'ANALYSIS' },
    { name: 'Projects', icon: FolderKanban, group: 'MANAGE' },
    { name: 'History', icon: History, group: 'MANAGE' },
    { name: 'Settings', icon: Settings2, group: 'MANAGE' }
  ];
  const groups = [...new Set(nav.map(n => n.group))];

  return <div className={`app-shell ${dark ? 'dark' : ''}`}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><ShieldCheck size={20} /></div><div><strong>ResearchProof <span>AI</span></strong><small>ACADEMIC INTEGRITY</small></div><button className="icon-button mobile-menu" aria-label="Toggle sidebar"><PanelLeft size={18}/></button></div>
      <div className="workspace-pill"><div className="avatar">{user.email[0]?.toUpperCase()}</div><div><strong>Research workspace</strong><small>Personal account</small></div><ChevronDown size={15}/></div>
      <nav>{groups.map(group => <div className="nav-group" key={group}><p>{group}</p>{nav.filter(n => n.group === group).map(item => <button key={item.name} onClick={() => setSection(item.name)} className={`nav-item ${section === item.name ? 'active' : ''}`}><item.icon size={17}/><span>{item.name}</span>{item.name === 'History' && revisions.length > 0 && <small className="nav-count">{revisions.length}</small>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="integrity-card"><div className="integrity-icon"><ShieldCheck size={18}/></div><strong>Research integrity first</strong><p>AI suggestions are drafts. You remain the author and final reviewer.</p><button onClick={() => setSection('Settings')}>Privacy & settings <span>↗</span></button></div><div className="user-row"><div className="avatar">{user.email[0]?.toUpperCase()}</div><div className="user-meta"><strong>{user.email.split('@')[0]}</strong><small>{user.email}</small></div><button className="icon-button" onClick={logout} title="Sign out"><LogOut size={17}/></button></div></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><span className="slash">/</span><strong>{section}</strong></div><div className="top-actions"><div className="secure-label"><span className="green-dot"></span> Private workspace</div><button className="icon-button" onClick={() => setDark(!dark)} title="Toggle theme">{dark ? <Sun size={18}/> : <Moon size={18}/>}</button><button className="help-button" onClick={() => setSection('Settings')}><CircleHelp size={17}/> Help & privacy</button></div></header>
      <div className="page-content">
        {error && <div className="alert error">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
        {message && <div className="alert success"><Check size={16}/>{message}<button onClick={() => setMessage('')}>Dismiss</button></div>}
        {section === 'Dashboard' && <Dashboard user={user} projects={projects} revisions={revisions} setSection={setSection} setShowProjectForm={setShowProjectForm} />}
        {(section === 'Writing Humanizer' || section === 'Dashboard') && <Editor
          text={text} setText={setText} revised={revised} style={style} setStyle={setStyle}
          preserveTerms={preserveTerms} setPreserveTerms={setPreserveTerms} busy={busy}
          persist={persist} setPersist={setPersist} wordCount={wordCount} runAction={runAction}
          exportText={exportText} importText={importText} compact={section === 'Dashboard'} />}
        {section === 'AI Assessment' && <AnalysisPage title="AI-writing assessment" subtitle="Review writing patterns that may deserve a closer look. This is not an authorship detector." icon={<ScanText/>} run={() => runAction('writing')} busy={busy} result={assessment} text={text} setText={setText} exportText={exportText}/>}
        {section === 'Originality Review' && <AnalysisPage title="Originality review" subtitle="Find repeated phrases inside this document. No external databases are queried." icon={<FileCheck2/>} run={() => runAction('originality')} busy={busy} result={originality} text={text} setText={setText} exportText={exportText}/>}
        {section === 'Citation Checker' && <AnalysisPage title="Citation consistency" subtitle="Check basic author-year citation and reference-list patterns." icon={<BookOpenCheck/>} run={() => runAction('citations')} busy={busy} result={citations} text={text} setText={setText} exportText={exportText}/>}
        {section === 'Projects' && <Projects projects={projects} showForm={showProjectForm} setShowForm={setShowProjectForm} title={projectTitle} setTitle={setProjectTitle} createProject={createProject} deleteProject={deleteProject}/>}
        {section === 'History' && <HistoryPage revisions={revisions} />}
        {section === 'Settings' && <SettingsPage dark={dark} setDark={setDark} persist={persist} setPersist={setPersist} logout={logout}/>}
      </div>
    </main>
  </div>;
}

function Dashboard({ user, projects, revisions, setSection, setShowProjectForm }: any) {
  return <section className="dashboard">
    <div className="welcome-row"><div><p className="eyebrow">YOUR RESEARCH, IN FOCUS</p><h1>Good work starts with <span>clarity.</span></h1><p className="muted">A focused workspace for stronger academic writing and responsible research.</p></div><button className="primary" onClick={() => setSection('Writing Humanizer')}><Plus size={17}/> New writing session</button></div>
    <div className="stats-grid"><Stat icon={<FileText/>} label="Projects" value={projects.length} note="Your research spaces"/><Stat icon={<Clock3/>} label="Saved revisions" value={revisions.length} note="Opt-in history"/><Stat icon={<Activity/>} label="Writing workspace" value="Ready" note="Analysis tools available"/></div>
    <div className="section-heading"><div><h2>Research toolkit</h2><p>Choose a task to get started.</p></div><span className="subtle-tag"><ShieldCheck size={14}/> Integrity-led workflow</span></div>
    <div className="tool-grid">
      <ToolCard icon={<WandSparkles/>} tone="purple" title="Academic humanizer" description="Improve clarity and flow while preserving your research meaning." onClick={() => setSection('Writing Humanizer')} action="Open editor"/>
      <ToolCard icon={<ScanText/>} tone="blue" title="AI-writing assessment" description="Review sentence patterns and readability indicators, not authorship verdicts." onClick={() => setSection('AI Assessment')} action="Review writing"/>
      <ToolCard icon={<FileCheck2/>} tone="green" title="Originality review" description="Find repeated phrases in the current document." onClick={() => setSection('Originality Review')} action="Check text"/>
      <ToolCard icon={<BookOpenCheck/>} tone="amber" title="Citation checker" description="Spot possible gaps between citations and reference sections." onClick={() => setSection('Citation Checker')} action="Review citations"/>
    </div>
    <div className="bottom-grid"><div className="panel"><div className="panel-heading"><div><h3>Recent projects</h3><p>Keep related writing organised.</p></div><button className="text-button" onClick={() => {setShowProjectForm(true);setSection('Projects')}}>View all ↗</button></div>
      {projects.length ? projects.slice(0, 3).map((p: Project) => <div className="list-row" key={p._id}><div className="mini-icon"><FolderKanban size={17}/></div><div className="list-main"><strong>{p.title}</strong><small>Updated {new Date(p.updatedAt).toLocaleDateString()}</small></div><span className="row-arrow">↗</span></div>) : <div className="empty-state"><FolderKanban size={22}/><strong>No projects yet</strong><p>Create a project to group your research work.</p><button className="secondary small" onClick={() => {setShowProjectForm(true);setSection('Projects')}}><Plus size={14}/> Create project</button></div>}
    </div><div className="panel integrity-panel"><div className="panel-heading"><div><h3>Integrity checklist</h3><p>Before submitting academic work</p></div><ShieldCheck size={20}/></div>{['Verify every reference against the original source','Review all AI-suggested edits yourself','Preserve accurate results and limitations','Follow your institution’s AI-use policy'].map((s,i)=><div className="check-row" key={s}><span>{i+1}</span><p>{s}</p></div>)}<div className="fineprint">Automated checks support judgement; they do not replace it.</div></div></div>
  </section>;
}
function Stat({ icon, label, value, note }: any) { return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong>{value}</strong><small>{note}</small></div>; }
function ToolCard({ icon, tone, title, description, onClick, action }: any) { return <button className="tool-card" onClick={onClick}><div className={`tool-icon ${tone}`}>{icon}</div><h3>{title}</h3><p>{description}</p><span className="tool-action">{action} <span>→</span></span></button>; }

function Editor({ text, setText, revised, style, setStyle, preserveTerms, setPreserveTerms, busy, persist, setPersist, wordCount, runAction, exportText, importText, compact }: any) {
  return <section className={`editor-section ${compact ? 'compact-editor' : ''}`}>
    <div className="section-heading"><div><p className="eyebrow">WRITING STUDIO</p><h2>{compact ? 'Academic writing studio' : 'Academic humanizer'}</h2><p>Refine the expression. Keep the research yours.</p></div><div className="editor-actions"><label className="secondary small upload-button"><Upload size={15}/> Import text<input type="file" accept=".txt,.md" onChange={importText} hidden/></label><button className="secondary small" onClick={() => exportText(text, 'research-original.txt')}>Export original</button></div></div>
    <div className="editor-controls"><label>Writing style<select value={style} onChange={e => setStyle(e.target.value)}><option>Natural Scholarly</option><option>Formal Academic</option><option>Concise Research</option><option>Plain Academic</option></select></label><label className="terms-field">Terms to preserve <input value={preserveTerms} onChange={e => setPreserveTerms(e.target.value)} placeholder="e.g. Stroop task, inhibitory control, p &lt; .05"/></label></div>
    <div className="editor-grid"><div className="text-panel"><div className="text-panel-head"><span><span className="status-dot neutral"></span> Original draft</span><span className="panel-label">Editable</span></div><textarea value={text} onChange={e => setText(e.target.value)} placeholder="Paste your research text here…" maxLength={50000}/><div className="text-panel-foot"><span>{wordCount} words · {text.length.toLocaleString()} characters</span><button className="text-button" onClick={() => setText('')}>Clear</button></div></div>
      <div className="text-panel revised-panel"><div className="text-panel-head"><span><span className="status-dot purple-dot"></span> Revised draft</span><span className="panel-label">AI suggestion</span></div><div className={`revised-content ${revised ? '' : 'placeholder'}`}>{revised || 'Your revised draft will appear here. Review the changes carefully before accepting them.'}</div><div className="text-panel-foot"><span>{revised ? `${revised.trim().split(/\s+/).length} words` : 'Waiting for revision'}</span><button className="text-button" disabled={!revised} onClick={() => exportText(revised, 'research-revised.txt')}>Export</button></div></div></div>
    <div className="editor-bottom"><label className="checkbox-label"><input type="checkbox" checked={persist} onChange={e => setPersist(e.target.checked)}/> Save this revision to my history</label><div className="action-buttons"><button className="secondary" onClick={() => runAction('writing')} disabled={busy}><Gauge size={16}/> Assess writing</button><button className="primary" onClick={() => runAction('humanize')} disabled={busy || !text.trim()}><Sparkles size={16}/>{busy ? 'Working…' : 'Improve academic writing'}</button></div></div>
    <div className="editor-disclaimer"><ShieldCheck size={16}/><p><strong>Your research stays in control.</strong> Review every edit. The model may make mistakes; check claims, citations, statistics and technical terms against your source material.</p></div>
  </section>;
}

function AnalysisPage({ title, subtitle, icon, run, busy, result, text, setText, exportText }: any) {
  return <section className="analysis-page"><div className="page-title-row"><div><p className="eyebrow">RESEARCH QUALITY</p><h1>{title}</h1><p className="muted">{subtitle}</p></div><div className="page-title-icon">{icon}</div></div>
    <div className="analysis-workspace"><div className="panel analysis-input"><div className="panel-heading"><div><h3>Text to review</h3><p>{text.trim() ? text.trim().split(/\s+/).length : 0} words</p></div></div><textarea value={text} onChange={e => setText(e.target.value)} placeholder="Paste a passage for review…"/><button className="primary full" onClick={run} disabled={busy || !text.trim()}>{busy ? 'Analysing…' : 'Run review'} <span>→</span></button></div>
      <div className="panel analysis-results"><div className="panel-heading"><div><h3>Review results</h3><p>Indicators for human review</p></div><div className="result-icon">{icon}</div></div>
        {!result ? <div className="empty-state results-empty"><div className="empty-orb">{icon}</div><strong>Your review will appear here</strong><p>Run the check to see observations and next steps.</p></div> : <div className="results-body">
          {result.wordCount !== undefined && <div className="metrics-row"><div><small>Words</small><strong>{result.wordCount}</strong></div><div><small>Sentences</small><strong>{result.sentenceCount}</strong></div><div><small>Avg. sentence</small><strong>{result.averageWordsPerSentence}</strong></div></div>}
          {result.verdict && <div className="notice-box"><ShieldCheck size={18}/><div><strong>{result.verdict}</strong><p>Writing patterns cannot reliably determine authorship.</p></div></div>}
          {result.observations?.map((o: any, i: number) => <div className="observation" key={i}><span className={`level-dot ${o.level}`}></span><div><strong>{o.title}</strong><p>{o.detail}</p></div></div>)}
          {result.repeatedPhrases && (result.repeatedPhrases.length ? result.repeatedPhrases.map((p: any) => <div className="observation" key={p.phrase}><span className="level-dot review"></span><div><strong>“{p.phrase}” · {p.count} times</strong><p>{p.note}</p></div></div>) : <div className="notice-box"><Check size={18}/><div><strong>No repeated phrases flagged</strong><p>This is not a plagiarism clearance.</p></div></div>)}
          {result.issues?.map((o: any, i: number) => <div className="observation" key={i}><span className={`level-dot ${o.level}`}></span><div><strong>{o.level === 'warning' ? 'Check needed' : 'Observation'}</strong><p>{o.detail}</p></div></div>)}
          {result.detectedAuthorYearCitations && <div className="notice-box"><BookOpenCheck size={18}/><div><strong>{result.detectedAuthorYearCitations.length} citation-like pattern(s) · {result.referenceEntryCount} reference line(s)</strong><p>{result.limitation}</p></div></div>}
          {result.doiVerifications && result.doiVerifications.length > 0 && (
            <div className="doi-list" style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: '6px' }}>
                Crossref Metadata Verification ({result.doiVerifications.filter((d: any) => d.verified).length}/{result.doiVerifications.length} verified)
              </div>
              {result.doiVerifications.map((d: any, idx: number) => (
                <div className="observation" key={idx}>
                  <span className={`level-dot ${d.verified ? 'info' : 'warning'}`}></span>
                  <div>
                    <strong>{d.doi} {d.verified ? `— ${d.title || 'Verified'}` : '(Unresolved)'}</strong>
                    <p>{d.verified ? `${(d.authors || []).join(', ')} (${d.year || 'n.d.'}) ${d.journal ? `· ${d.journal}` : ''}` : (d.status || 'Not confirmed via Crossref')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button className="secondary full" onClick={() => exportText(JSON.stringify(result, null, 2), 'researchproof-review.json')}>Export report</button>
        </div>}
      </div></div>
    <div className="notice-box page-notice"><CircleHelp size={18}/><div><strong>Understand the scope</strong><p>These tools provide limited checks, not an external Turnitin report, a web-wide plagiarism scan, or a definitive AI-authorship result.</p></div></div>
  </section>;
}
function Projects({ projects, showForm, setShowForm, title, setTitle, createProject, deleteProject }: any) {
  return <section className="analysis-page"><div className="page-title-row"><div><p className="eyebrow">ORGANISE YOUR WORK</p><h1>Research projects</h1><p className="muted">Keep research drafts and writing sessions organised.</p></div><button className="primary" onClick={() => setShowForm(!showForm)}><Plus size={16}/> New project</button></div>
    {showForm && <form className="panel project-form" onSubmit={createProject}><label>Project title<input value={title} onChange={e => setTitle(e.target.value)} required maxLength={160} placeholder="e.g. Dissertation — cognitive flexibility"/></label><button className="primary" type="submit">Create project</button></form>}
    <div className="project-grid">{projects.map((p: Project) => <div className="panel project-card" key={p._id}><div className="project-icon"><FolderKanban size={20}/></div><button className="icon-button danger-button" onClick={() => deleteProject(p._id)} title="Delete project"><Trash2 size={16}/></button><h3>{p.title}</h3><p>{p.description || 'Research workspace'}</p><small>Updated {new Date(p.updatedAt).toLocaleDateString()}</small></div>)}
      {!projects.length && <div className="panel empty-projects"><FolderKanban size={30}/><h3>No projects created</h3><p>Create your first project to start organising your academic work.</p><button className="secondary" onClick={() => setShowForm(true)}><Plus size={15}/> Create a project</button></div>}</div>
  </section>;
}
function HistoryPage({ revisions }: { revisions: Revision[] }) {
  const [selected, setSelected] = useState<Revision | null>(null);
  return <section className="analysis-page"><div className="page-title-row"><div><p className="eyebrow">YOUR RECORD</p><h1>Revision history</h1><p className="muted">Only revisions you explicitly chose to save are shown.</p></div><div className="page-title-icon"><History/></div></div>
    <div className="panel history-panel">{revisions.length ? revisions.map(r => <button className={`history-row ${selected?._id === r._id ? 'selected' : ''}`} key={r._id} onClick={() => setSelected(r)}><div className="mini-icon"><FileText size={17}/></div><div className="list-main"><strong>{r.mode === 'humanize' ? 'Academic writing revision' : r.mode}</strong><small>{new Date(r.createdAt).toLocaleString()} · {r.originalText.trim().split(/\s+/).length} original words</small><p>{r.summary || 'Revision saved'}</p></div><span className="row-arrow">→</span></button>) : <div className="empty-state"><History size={24}/><strong>No saved revisions</strong><p>Enable “Save this revision to my history” in the writing studio.</p></div>}</div>
    {selected && <div className="comparison-grid"><div className="panel"><h3>Original</h3><p className="history-text">{selected.originalText}</p></div><div className="panel"><h3>Revised</h3><p className="history-text">{selected.revisedText}</p></div></div>}
  </section>;
}
function SettingsPage({ dark, setDark, persist, setPersist, logout }: any) {
  return <section className="analysis-page"><div className="page-title-row"><div><p className="eyebrow">PREFERENCES</p><h1>Settings & privacy</h1><p className="muted">Choose how ResearchProof AI behaves in your workspace.</p></div><div className="page-title-icon"><Settings2/></div></div>
    <div className="settings-list panel"><div className="setting-row"><div className="setting-icon"><Sun size={18}/></div><div className="setting-copy"><strong>Appearance</strong><p>Choose the workspace colour theme.</p></div><button className="secondary small" onClick={() => setDark(!dark)}>{dark ? 'Dark mode' : 'Light mode'} · Toggle</button></div>
      <div className="setting-row"><div className="setting-icon"><History size={18}/></div><div className="setting-copy"><strong>Revision history default</strong><p>When enabled, humanizer runs can be saved if you select the save option.</p></div><label className="switch-label"><input type="checkbox" checked={persist} onChange={e => setPersist(e.target.checked)}/><span>{persist ? 'On' : 'Off'}</span></label></div>
      <div className="setting-row"><div className="setting-icon"><ShieldCheck size={18}/></div><div className="setting-copy"><strong>Text processing & privacy</strong><p>Text is sent to your configured AI provider when you run humanization. Review that provider’s data policy before submitting sensitive research data. Analysis endpoints run on your server.</p></div></div>
      <div className="setting-row"><div className="setting-icon"><CircleHelp size={18}/></div><div className="setting-copy"><strong>Assessment limitations</strong><p>AI indicators and citation checks are limited review aids, not proof of authorship, plagiarism, or source validity.</p></div></div>
      <div className="setting-row"><div className="setting-icon"><LogOut size={18}/></div><div className="setting-copy"><strong>Sign out</strong><p>End the current session on this browser.</p></div><button className="secondary small" onClick={logout}>Sign out</button></div>
    </div>
  </section>;
}
