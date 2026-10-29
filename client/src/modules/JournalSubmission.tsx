import { useState, useEffect } from 'react';
import { Send, CheckSquare, FileText, Download, Copy, Check, Sparkles, Building, AlertCircle } from 'lucide-react';

interface JournalSubmissionProps {
  token: string;
  activeProject: any;
  setSection: (section: string) => void;
  setMessage: (msg: string) => void;
  setError: (err: string) => void;
}

export default function JournalSubmission({
  token,
  activeProject,
  setSection,
  setMessage,
  setError
}: JournalSubmissionProps) {
  const [targetJournal, setTargetJournal] = useState('Journal of Cognitive Neuroscience');
  const [publisher, setPublisher] = useState('MIT Press');
  const [wordLimit, setWordLimit] = useState(8000);
  const [citationStyle, setCitationStyle] = useState('apa');
  const [coverLetter, setCoverLetter] = useState('');
  const [editorName, setEditorName] = useState('Editor-in-Chief');
  const [copied, setCopied] = useState(false);
  const [generatingLetter, setGeneratingLetter] = useState(false);

  const [checklist, setChecklist] = useState([
    { id: 'abstract', item: 'Structured Abstract formatted per journal guidelines', compliant: true },
    { id: 'anonymized', item: 'All author identifying information removed for double-blind review', compliant: true },
    { id: 'ethics', item: 'Institutional Review Board (IRB) / Ethics approval statement included', compliant: true },
    { id: 'data', item: 'Data availability and code repository statement provided', compliant: true },
    { id: 'figures', item: 'Figures provided in high resolution (minimum 300 DPI vector / TIFF)', compliant: false },
    { id: 'declarations', item: 'Declaration of competing financial and personal interests', compliant: true }
  ]);

  const projectId = activeProject?._id;

  const fetchSubmission = async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/submission`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.targetJournal) setTargetJournal(data.targetJournal);
        if (data.publisher) setPublisher(data.publisher);
        if (data.wordLimit) setWordLimit(data.wordLimit);
        if (data.citationStyle) setCitationStyle(data.citationStyle);
        if (data.coverLetter) setCoverLetter(data.coverLetter);
        if (data.guidelinesChecklist && data.guidelinesChecklist.length > 0) {
          setChecklist(data.guidelinesChecklist);
        }
      }
    } catch (err: any) {
      console.warn('Failed to load submission info:', err.message);
    }
  };

  useEffect(() => {
    fetchSubmission();
  }, [projectId, token]);

  const toggleChecklist = (idx: number) => {
    setChecklist(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], compliant: !updated[idx].compliant };
      saveSubmission(updated, coverLetter);
      return updated;
    });
  };

  const saveSubmission = async (currentChecklist = checklist, currentLetter = coverLetter) => {
    if (!projectId) return;
    try {
      await fetch(`/api/v1/projects/${projectId}/submission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          targetJournal,
          publisher,
          wordLimit,
          citationStyle,
          guidelinesChecklist: currentChecklist,
          coverLetter: currentLetter,
          status: 'drafting'
        })
      });
    } catch (err) {
      console.warn('Save submission notice:', err);
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!projectId) {
      setError('Please select an active project first.');
      return;
    }

    setGeneratingLetter(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/submission/cover-letter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          targetJournal,
          editorName,
          manuscriptTitle: activeProject?.title || 'Empirical Investigation'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate cover letter');

      setCoverLetter(data.coverLetter);
      saveSubmission(checklist, data.coverLetter);
      setMessage('Academic cover letter generated.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGeneratingLetter(false);
    }
  };

  const compliantCount = checklist.filter(c => c.compliant).length;
  const readinessPercentage = Math.round((compliantCount / checklist.length) * 100);

  return (
    <div className="module-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '4px' }}>
            <Send size={20} />
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Module 7 · Journal Submission Studio
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>
            Journal Readiness & Submission Package
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', margin: '4px 0 0' }}>
            Target specific journal standards, verify compliance checklists, and draft custom editorial cover letters.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="secondary"
            onClick={() => setSection('Document Studio')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={16} /> Bundle Manuscript (.docx / .zip)
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left Column: Target Journal & Guidelines Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Target Journal Settings */}
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 14px' }}>
              Target Journal Profile
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Target Journal Name</label>
                <input
                  type="text"
                  value={targetJournal}
                  onChange={e => { setTargetJournal(e.target.value); saveSubmission(); }}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Publisher</label>
                  <input
                    type="text"
                    value={publisher}
                    onChange={e => { setPublisher(e.target.value); saveSubmission(); }}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Max Word Count</label>
                  <input
                    type="number"
                    value={wordLimit}
                    onChange={e => { setWordLimit(Number(e.target.value)); saveSubmission(); }}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Required Citation Style</label>
                <select
                  value={citationStyle}
                  onChange={e => { setCitationStyle(e.target.value); saveSubmission(); }}
                  style={{ width: '100%' }}
                >
                  <option value="apa">APA 7th Edition</option>
                  <option value="mla">MLA 9th Edition</option>
                  <option value="chicago">Chicago 17th Edition</option>
                  <option value="ieee">IEEE Standard</option>
                  <option value="harvard">Harvard Referencing</option>
                </select>
              </div>
            </div>
          </div>

          {/* Submission Readiness Checklist */}
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                  Submission Compliance Checklist
                </h3>
                <small style={{ color: 'var(--muted)' }}>
                  {compliantCount} of {checklist.length} standards verified
                </small>
              </div>
              <span style={{
                fontSize: '13px',
                fontWeight: 800,
                padding: '4px 10px',
                borderRadius: '12px',
                background: readinessPercentage === 100 ? '#dcfce7' : '#fef3c7',
                color: readinessPercentage === 100 ? '#166534' : '#92400e'
              }}>
                {readinessPercentage}% Ready
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{ height: '6px', background: 'var(--surface2)', borderRadius: '3px', overflow: 'hidden', marginBottom: '16px' }}>
              <div style={{
                height: '100%',
                width: `${readinessPercentage}%`,
                background: readinessPercentage === 100 ? '#16a34a' : 'var(--primary)',
                transition: 'width 0.3s'
              }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {checklist.map((c, idx) => (
                <label
                  key={c.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: 'var(--surface2)',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={c.compliant}
                    onChange={() => toggleChecklist(idx)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                  />
                  <span style={{ textDecoration: c.compliant ? 'none' : 'none', color: c.compliant ? 'var(--text-main)' : 'var(--muted)' }}>
                    {c.item}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Custom Academic Cover Letter */}
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
              Editorial Cover Letter
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="secondary small"
                onClick={handleGenerateCoverLetter}
                disabled={generatingLetter}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Sparkles size={14} />
                {generatingLetter ? 'Generating...' : 'Auto-Draft Letter'}
              </button>
              {coverLetter && (
                <button
                  className="icon-button"
                  onClick={() => {
                    navigator.clipboard.writeText(coverLetter);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', marginBottom: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '2px' }}>
                Addressed To (Editor Title / Name)
              </label>
              <input
                type="text"
                value={editorName}
                onChange={e => setEditorName(e.target.value)}
                placeholder="e.g. Prof. Jane Doe, Editor-in-Chief"
                style={{ width: '100%', fontSize: '12px', padding: '6px 10px' }}
              />
            </div>
          </div>

          <textarea
            rows={16}
            value={coverLetter}
            onChange={e => {
              setCoverLetter(e.target.value);
              saveSubmission(checklist, e.target.value);
            }}
            placeholder="Click 'Auto-Draft Letter' above to generate a formal submission cover letter tailored to your manuscript and target journal..."
            style={{
              flex: 1,
              width: '100%',
              padding: '12px',
              fontFamily: 'monospace',
              fontSize: '12px',
              lineHeight: '1.6',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'var(--surface2)',
              resize: 'none'
            }}
          />
        </div>
      </div>
    </div>
  );
}

