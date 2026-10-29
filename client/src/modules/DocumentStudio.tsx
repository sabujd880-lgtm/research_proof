import { useState } from 'react';
import { Download, FileText, BookOpen, ShieldCheck, Upload, FileCheck2, Printer, Check } from 'lucide-react';

interface DocumentStudioProps {
  token: string;
  activeDoc: any;
  documents: any[];
  citationsList: any[];
  setSection: (section: string) => void;
  setMessage: (msg: string) => void;
  setError: (err: string) => void;
  onExportDocx: () => void;
  onImportFile?: (file: File) => void;
  onImportChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function DocumentStudio({
  token,
  activeDoc,
  documents,
  citationsList,
  setSection,
  setMessage,
  setError,
  onExportDocx,
  onImportFile,
  onImportChange
}: DocumentStudioProps) {
  const [importing, setImporting] = useState(false);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onImportChange) {
      onImportChange(e);
      return;
    }
    const file = e.target.files?.[0];
    if (file && onImportFile) {
      setImporting(true);
      try {
        onImportFile(file);
      } finally {
        setImporting(false);
      }
    }
  };

  return (
    <div className="module-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '4px' }}>
            <Download size={20} />
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Publishing & Document Studio
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>
            Unified Academic Export & Document Hub
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', margin: '4px 0 0' }}>
            Generate publication-ready Word manuscripts (.docx), APA 7 LaTeX bundles (.zip), and cryptographic integrity dossiers.
          </p>
        </div>

        <label className="button secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0 }}>
          <Upload size={16} />
          {importing ? 'Importing...' : 'Import Manuscript (.docx, .tex, .bib)'}
          <input
            type="file"
            accept=".docx,.tex,.bib,.txt,.ris"
            style={{ display: 'none' }}
            onChange={handleFileInput}
            disabled={importing}
          />
        </label>
      </div>

      {/* Active Document Status Banner */}
      <div style={{
        background: 'var(--card-bg, #ffffff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FileText size={22} style={{ color: 'var(--primary)' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>
              Target Document: {activeDoc ? activeDoc.title : 'No Document Selected'}
            </div>
            <small style={{ color: 'var(--muted)' }}>
              {activeDoc ? `${activeDoc.wordCount || 0} words · Version ${activeDoc.version || 1} · ${citationsList.length} linked citations` : 'Select a document in Writing Studio to enable single-click exports.'}
            </small>
          </div>
        </div>

        <button className="primary small" onClick={() => setSection('Writing Studio')}>
          Open in Studio ↗
        </button>
      </div>

      {/* Export Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        {/* Word (.docx) Export */}
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ background: '#eff6ff', color: '#2563eb', padding: '8px', borderRadius: '8px' }}>
                <FileText size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Microsoft Word (.docx)</h3>
                <small style={{ color: 'var(--muted)' }}>Office Open XML Manuscript</small>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: '1.5', margin: '0 0 16px' }}>
              Standard academic manuscript with proper paragraph indentation, heading hierarchies, running headers, and formatted reference lists.
            </p>
          </div>
          <button
            className="primary"
            onClick={onExportDocx}
            disabled={!activeDoc}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <Download size={15} /> Download Word Document
          </button>
        </div>

        {/* LaTeX APA 7 Bundle */}
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ background: '#ecfdf5', color: '#059669', padding: '8px', borderRadius: '8px' }}>
                <BookOpen size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>APA 7 LaTeX Bundle (.zip)</h3>
                <small style={{ color: 'var(--muted)' }}>Overleaf & TeXLive Compatible</small>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: '1.5', margin: '0 0 16px' }}>
              Complete standalone Overleaf project including `main.tex`, `references.bib`, apa7 documentclass, and UTF-8 font settings.
            </p>
          </div>
          <button
            className="secondary"
            onClick={() => setSection('LaTeX Export Studio')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <BookOpen size={15} /> Open LaTeX Studio ↗
          </button>
        </div>

        {/* Integrity Dossier */}
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ background: '#fef3c7', color: '#d97706', padding: '8px', borderRadius: '8px' }}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Research Integrity Dossier</h3>
                <small style={{ color: 'var(--muted)' }}>Peer-Review Audit Evidence</small>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: '1.5', margin: '0 0 16px' }}>
              Formal verification report auditing originality, DOI citations, statistical consistency, and linguistic authenticity.
            </p>
          </div>
          <button
            className="secondary"
            onClick={() => setSection('Research Integrity')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <FileCheck2 size={15} /> View Integrity Reports ↗
          </button>
        </div>
      </div>
    </div>
  );
}
