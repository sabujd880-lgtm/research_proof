import { useState, useEffect } from 'react';
import { BookOpen, Plus, Search, Sparkles, Copy, Check, Trash2, Tag, FileText, ArrowRight } from 'lucide-react';

interface LiteratureEntry {
  _id: string;
  projectId: string;
  title: string;
  authors: string[];
  year: string;
  journal: string;
  doi: string;
  abstract: string;
  matrixData?: {
    methodology: string;
    sampleSize: string;
    instruments: string;
    findings: string;
    limitations: string;
  };
  thematicTags: string[];
  status: string;
  createdAt?: string;
}

interface LiteratureReviewProps {
  token: string;
  activeProject: any;
  setSection: (section: string) => void;
  setMessage: (msg: string) => void;
  setError: (err: string) => void;
  onSendToStudio?: (text: string) => void;
}

export default function LiteratureReview({
  token,
  activeProject,
  setSection,
  setMessage,
  setError,
  onSendToStudio
}: LiteratureReviewProps) {
  const [entries, setEntries] = useState<LiteratureEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [synthesisResult, setSynthesisResult] = useState<any>(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const [copied, setCopied] = useState(false);

  // New Paper Form State
  const [formTitle, setFormTitle] = useState('');
  const [formAuthors, setFormAuthors] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formJournal, setFormJournal] = useState('');
  const [formDoi, setFormDoi] = useState('');
  const [formAbstract, setFormAbstract] = useState('');
  const [formMethodology, setFormMethodology] = useState('');
  const [formSampleSize, setFormSampleSize] = useState('');
  const [formFindings, setFormFindings] = useState('');
  const [formLimitations, setFormLimitations] = useState('');
  const [formTags, setFormTags] = useState('');

  const projectId = activeProject?._id;

  const fetchEntries = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/literature`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data || []);
      }
    } catch (err: any) {
      console.warn('Failed to load literature:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [projectId, token]);

  const handleAddPaper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setError('Please select or create an active project first.');
      return;
    }
    if (!formTitle.trim()) {
      setError('Paper title is required.');
      return;
    }

    try {
      const payload = {
        title: formTitle.trim(),
        authors: formAuthors.split(',').map(a => a.trim()).filter(Boolean),
        year: formYear.trim(),
        journal: formJournal.trim(),
        doi: formDoi.trim(),
        abstract: formAbstract.trim(),
        methodology: formMethodology.trim(),
        sampleSize: formSampleSize.trim(),
        findings: formFindings.trim(),
        limitations: formLimitations.trim(),
        thematicTags: formTags.split(',').map(t => t.trim()).filter(Boolean)
      };

      const res = await fetch(`/api/v1/projects/${projectId}/literature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add paper');

      setMessage(`Added "${payload.title}" to literature matrix.`);
      setShowAddModal(false);
      // Reset form
      setFormTitle('');
      setFormAuthors('');
      setFormYear('');
      setFormJournal('');
      setFormDoi('');
      setFormAbstract('');
      setFormMethodology('');
      setFormSampleSize('');
      setFormFindings('');
      setFormLimitations('');
      setFormTags('');
      fetchEntries();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Remove this paper from your literature matrix?')) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/literature/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setEntries(prev => prev.filter(e => e._id !== id));
        setMessage('Paper removed from matrix.');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSynthesize = async () => {
    if (!projectId || entries.length === 0) {
      setError('Add at least one paper to the matrix before synthesizing.');
      return;
    }
    setSynthesizing(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/literature/synthesize`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Synthesis generation failed');
      setSynthesisResult(data);
      setMessage(`Generated synthesis across ${data.themeCount} thematic clusters.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSynthesizing(false);
    }
  };

  const allTags = Array.from(new Set(entries.flatMap(e => e.thematicTags || [])));

  const filteredEntries = entries.filter(e => {
    const matchesSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.authors || []).some(a => a.toLowerCase().includes(search.toLowerCase())) ||
      (e.matrixData?.findings || '').toLowerCase().includes(search.toLowerCase());
    const matchesTag = selectedTag === 'all' || (e.thematicTags || []).includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="module-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '4px' }}>
            <BookOpen size={20} />
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Module 3 · Literature Review Studio
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>
            {activeProject ? activeProject.title : 'Literature Review Matrix'}
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', margin: '4px 0 0' }}>
            Systematically extract methodologies, samples, instruments, and findings into structured empirical matrices.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="secondary"
            onClick={handleSynthesize}
            disabled={synthesizing || entries.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Sparkles size={16} />
            {synthesizing ? 'Synthesizing...' : 'Generate Literature Synthesis'}
          </button>
          <button
            className="primary"
            onClick={() => setShowAddModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            Add Paper to Matrix
          </button>
        </div>
      </div>

      {/* Synthesis Output Panel (if generated) */}
      {synthesisResult && (
        <div style={{
          background: 'var(--surface2, #f8fafc)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} style={{ color: 'var(--primary)' }} />
              <strong style={{ fontSize: '15px' }}>Evidence-Grounded Literature Review Draft</strong>
              <span style={{ fontSize: '11px', background: 'var(--primary-subtle)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '12px' }}>
                {synthesisResult.studyCount} Studies · {synthesisResult.themeCount} Themes
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="icon-button"
                onClick={() => {
                  navigator.clipboard.writeText(synthesisResult.fullDraft);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                title="Copy markdown synthesis"
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '6px 10px' }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
              </button>
              {onSendToStudio && (
                <button
                  className="primary small"
                  onClick={() => onSendToStudio(synthesisResult.fullDraft)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <FileText size={14} /> Send to Studio <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>

          <div style={{
            background: 'var(--card-bg, #ffffff)',
            padding: '16px',
            borderRadius: '8px',
            fontSize: '13px',
            lineHeight: '1.7',
            whiteSpace: 'pre-wrap',
            maxHeight: '300px',
            overflowY: 'auto',
            border: '1px solid var(--border-color, #e2e8f0)'
          }}>
            {synthesisResult.fullDraft}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--muted)' }} />
          <input
            type="text"
            placeholder="Search papers, authors, methodologies, or findings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '36px', width: '100%' }}
          />
        </div>

        {allTags.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Theme:</span>
            <button
              className={`filter-btn ${selectedTag === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedTag('all')}
              style={{ fontSize: '11px', padding: '4px 10px' }}
            >
              All ({entries.length})
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                className={`filter-btn ${selectedTag === tag ? 'active' : ''}`}
                onClick={() => setSelectedTag(tag)}
                style={{ fontSize: '11px', padding: '4px 10px' }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Literature Matrix Table */}
      <div style={{ overflowX: 'auto', background: 'var(--card-bg, #ffffff)', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: 'var(--surface2, #f8fafc)', borderBottom: '1px solid var(--border-color, #e2e8f0)', color: 'var(--muted)' }}>
              <th style={{ padding: '12px 16px', minWidth: '220px' }}>Study / Title</th>
              <th style={{ padding: '12px 16px', minWidth: '130px' }}>Authors & Year</th>
              <th style={{ padding: '12px 16px', minWidth: '140px' }}>Methodology</th>
              <th style={{ padding: '12px 16px', minWidth: '100px' }}>Sample (N)</th>
              <th style={{ padding: '12px 16px', minWidth: '240px' }}>Core Empirical Findings</th>
              <th style={{ padding: '12px 16px', minWidth: '180px' }}>Limitations</th>
              <th style={{ padding: '12px 16px', minWidth: '120px' }}>Thematic Tags</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
                  Loading literature entries...
                </td>
              </tr>
            ) : filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: 'var(--muted)' }}>
                  {entries.length === 0 ? (
                    <div>
                      <BookOpen size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                      <p style={{ margin: 0, fontWeight: 600 }}>Literature matrix is empty.</p>
                      <small>Click "Add Paper to Matrix" above to extract and organize empirical studies.</small>
                    </div>
                  ) : (
                    'No studies match your current filter.'
                  )}
                </td>
              </tr>
            ) : (
              filteredEntries.map(entry => (
                <tr key={entry._id} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)', verticalAlign: 'top' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main, #0f172a)', marginBottom: '4px' }}>
                      {entry.title}
                    </div>
                    {entry.journal && (
                      <div style={{ color: 'var(--muted)', fontSize: '11px', fontStyle: 'italic' }}>
                        {entry.journal}
                      </div>
                    )}
                    {entry.doi && (
                      <a
                        href={`https://doi.org/${entry.doi}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: '10px', color: 'var(--primary)', textDecoration: 'none' }}
                      >
                        doi:{entry.doi}
                      </a>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>
                    <div>{(entry.authors || []).join(', ') || 'Unknown'}</div>
                    <strong>{entry.year || 'n.d.'}</strong>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {entry.matrixData?.methodology || <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {entry.matrixData?.sampleSize ? <code>{entry.matrixData.sampleSize}</code> : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px', lineHeight: '1.5' }}>
                    {entry.matrixData?.findings || <span style={{ color: 'var(--muted)' }}>{entry.abstract?.slice(0, 160) || '—'}</span>}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: '11px', lineHeight: '1.4' }}>
                    {entry.matrixData?.limitations || '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {(entry.thematicTags || []).map(t => (
                        <span key={t} style={{
                          fontSize: '10px',
                          background: 'var(--surface2)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)'
                        }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      className="icon-button"
                      onClick={() => handleDeleteEntry(entry._id)}
                      title="Delete study"
                      style={{ color: 'var(--danger, #ef4444)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Paper Modal */}
      {showAddModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '640px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px' }}>Add Study to Literature Matrix</h2>
            <form onSubmit={handleAddPaper} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Paper Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cognitive Load and Generative Learning in STEM"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Authors (comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Sweller, J., Paas, F."
                    value={formAuthors}
                    onChange={e => setFormAuthors(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Year</label>
                  <input
                    type="text"
                    placeholder="e.g. 2024"
                    value={formYear}
                    onChange={e => setFormYear(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Journal / Conference</label>
                  <input
                    type="text"
                    placeholder="e.g. Educational Psychology Review"
                    value={formJournal}
                    onChange={e => setFormJournal(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>DOI</label>
                  <input
                    type="text"
                    placeholder="e.g. 10.1007/s10648-023-09801-4"
                    value={formDoi}
                    onChange={e => setFormDoi(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Methodology</label>
                  <input
                    type="text"
                    placeholder="e.g. Randomized Controlled Trial (2x2)"
                    value={formMethodology}
                    onChange={e => setFormMethodology(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Sample Size (N)</label>
                  <input
                    type="text"
                    placeholder="e.g. N = 240 university students"
                    value={formSampleSize}
                    onChange={e => setFormSampleSize(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Core Empirical Findings</label>
                <textarea
                  rows={3}
                  placeholder="Summarize key statistical results, effect sizes, and primary conclusions..."
                  value={formFindings}
                  onChange={e => setFormFindings(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Limitations & Biases</label>
                <input
                  type="text"
                  placeholder="e.g. Convenience sample, short intervention duration"
                  value={formLimitations}
                  onChange={e => setFormLimitations(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Thematic Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Cognitive Load, STEM Education, Dual-Task"
                  value={formTags}
                  onChange={e => setFormTags(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" className="secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary">
                  Save to Matrix
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
