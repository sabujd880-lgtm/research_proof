import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen, Plus, Search, Sparkles, Copy, Check, Trash2, Tag, FileText,
  ArrowRight, Download, Upload, Filter, SlidersHorizontal, Table,
  GitCompare, Lightbulb, Layers, RefreshCw, ExternalLink, Edit3,
  CheckCircle2, AlertCircle, Eye, EyeOff, ChevronDown, ChevronRight,
  Columns
} from 'lucide-react';

export interface LiteratureEntry {
  _id: string;
  id?: string;
  projectId?: string;
  referenceId?: string;
  documentId?: string;
  title: string;
  authors: string[];
  year: string;
  journal?: string;
  doi?: string;
  url?: string;
  abstract?: string;
  researchQuestion?: string;
  studyObjectives?: string;
  studyDesign?: string;
  methodology?: string;
  population?: string;
  sampleSize?: string;
  samplingMethod?: string;
  measures?: string[];
  variables?: {
    independent?: string[];
    dependent?: string[];
    control?: string[];
    mediators?: string[];
    moderators?: string[];
  };
  statisticalMethods?: string[];
  keyFindings?: string;
  effectEstimates?: Array<{ metric: string; value: string; ci?: string; pValue?: string }>;
  limitations?: string;
  futureDirections?: string;
  thematicTags?: string[];
  qualityNotes?: string;
  qualityRating?: number;
  extractionStatus?: 'pending' | 'in_progress' | 'completed' | 'verified';
  status?: 'identified' | 'screened' | 'included' | 'excluded';
  matrixData?: {
    methodology?: string;
    sampleSize?: string;
    instruments?: string;
    findings?: string;
    limitations?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface LiteratureTheme {
  _id?: string;
  id?: string;
  projectId: string;
  name: string;
  description?: string;
  color?: string;
  entryIds?: string[];
}

export interface LiteratureReviewProps {
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
  const projectId = activeProject?._id;

  // Active workspace tab
  const [activeTab, setActiveTab] = useState<
    'matrix' | 'discover' | 'studies' | 'compare' | 'themes' | 'gaps' | 'synthesis' | 'export'
  >('matrix');

  // Core Data
  const [entries, setEntries] = useState<LiteratureEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [detailEntry, setDetailEntry] = useState<LiteratureEntry | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  // Discover & Scholarly Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [searchYearFrom, setSearchYearFrom] = useState('');
  const [searchYearTo, setSearchYearTo] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [doiInput, setDoiInput] = useState('');
  const [doiLookingUp, setDoiLookingUp] = useState(false);

  // Compare Studies
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [comparing, setComparing] = useState(false);

  // Thematic Analysis
  const [themes, setThemes] = useState<LiteratureTheme[]>([]);
  const [newThemeName, setNewThemeName] = useState('');
  const [newThemeDesc, setNewThemeDesc] = useState('');
  const [newThemeColor, setNewThemeColor] = useState('#4f46e5');

  // Research Gaps
  const [gaps, setGaps] = useState<any[]>([]);
  const [loadingGaps, setLoadingGaps] = useState(false);

  // Synthesis Studio
  const [synthesisResult, setSynthesisResult] = useState<any>(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesisType, setSynthesisType] = useState<
    'narrative' | 'thematic' | 'chronological' | 'methodological'
  >('thematic');
  const [synthesisFocus, setSynthesisFocus] = useState('');
  const [copied, setCopied] = useState(false);

  // Extraction State
  const [extractingId, setExtractingId] = useState<string | null>(null);

  // Add Paper Manual Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formAuthors, setFormAuthors] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formJournal, setFormJournal] = useState('');
  const [formDoi, setFormDoi] = useState('');
  const [formAbstract, setFormAbstract] = useState('');
  const [formStudyDesign, setFormStudyDesign] = useState('');
  const [formMethodology, setFormMethodology] = useState('');
  const [formPopulation, setFormPopulation] = useState('');
  const [formSampleSize, setFormSampleSize] = useState('');
  const [formFindings, setFormFindings] = useState('');
  const [formLimitations, setFormLimitations] = useState('');
  const [formTags, setFormTags] = useState('');

  // Column Visibility for Matrix Table
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    title: true,
    authors: true,
    design: true,
    methodology: true,
    sampleSize: true,
    findings: true,
    effectEstimates: true,
    limitations: true,
    status: true,
    actions: true
  });

  // Fetch all literature entries
  const fetchEntries = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const url = projectId
        ? `/api/v1/literature?projectId=${projectId}`
        : `/api/v1/literature`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(Array.isArray(data) ? data : data.entries || []);
      }
    } catch (err: any) {
      console.warn('Failed to fetch literature entries:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Themes
  const fetchThemes = async () => {
    if (!token) return;
    try {
      const url = projectId
        ? `/api/v1/literature/themes?projectId=${projectId}`
        : `/api/v1/literature/themes`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setThemes(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      console.warn('Failed to fetch themes:', err.message);
    }
  };

  useEffect(() => {
    fetchEntries();
    fetchThemes();
  }, [projectId, token]);

  // Handle Search Scholarly Literature
  const handleSearchScholarly = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      setError('Please enter search terms or keywords.');
      return;
    }
    setSearching(true);
    setSearchResults([]);
    try {
      const params = new URLSearchParams({
        query: searchQuery.trim(),
        limit: '15'
      });
      if (searchType !== 'all') params.append('type', searchType);
      if (searchYearFrom) params.append('yearFrom', searchYearFrom);
      if (searchYearTo) params.append('yearTo', searchYearTo);

      const res = await fetch(`/api/v1/literature/search?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scholarly search failed');
      setSearchResults(data.results || []);
      setMessage(`Discovered ${data.results?.length || 0} scholarly articles.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  // Handle Direct DOI Lookup
  const handleLookupDoi = async () => {
    if (!doiInput.trim()) {
      setError('Please provide a valid DOI string.');
      return;
    }
    setDoiLookingUp(true);
    try {
      const res = await fetch('/api/v1/references/lookup-doi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ doi: doiInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'DOI lookup failed');

      // Add to search results for easy import
      setSearchResults(prev => [data.reference || data, ...prev]);
      setMessage(`Resolved metadata for DOI ${doiInput.trim()}`);
      setDoiInput('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDoiLookingUp(false);
    }
  };

  // Import paper into project literature review
  const handleImportToProject = async (paper: any) => {
    try {
      const payload = {
        projectId,
        title: paper.title,
        authors: Array.isArray(paper.authors)
          ? paper.authors.map((a: any) => typeof a === 'string' ? a : `${a.family || ''}, ${a.given || ''}`.trim())
          : [],
        year: paper.year || paper.publicationYear || '',
        journal: paper.journal || paper.journalTitle || '',
        doi: paper.doi || '',
        abstract: paper.abstract || '',
        url: paper.url || '',
        status: 'identified',
        extractionStatus: 'pending'
      };

      const res = await fetch('/api/v1/literature/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      setMessage(`Imported "${payload.title}" into literature matrix.`);
      fetchEntries();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Manual Add Paper
  const handleAddManualPaper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setError('Paper title is required.');
      return;
    }

    try {
      const payload = {
        projectId,
        title: formTitle.trim(),
        authors: formAuthors.split(',').map(a => a.trim()).filter(Boolean),
        year: formYear.trim(),
        journal: formJournal.trim(),
        doi: formDoi.trim(),
        abstract: formAbstract.trim(),
        studyDesign: formStudyDesign.trim(),
        methodology: formMethodology.trim(),
        population: formPopulation.trim(),
        sampleSize: formSampleSize.trim(),
        keyFindings: formFindings.trim(),
        limitations: formLimitations.trim(),
        thematicTags: formTags.split(',').map(t => t.trim()).filter(Boolean),
        status: 'identified',
        extractionStatus: formFindings || formMethodology ? 'completed' : 'pending'
      };

      const res = await fetch('/api/v1/literature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add study');

      setMessage(`Study "${payload.title}" added to literature matrix.`);
      setShowAddModal(false);
      // Reset form
      setFormTitle('');
      setFormAuthors('');
      setFormYear('');
      setFormJournal('');
      setFormDoi('');
      setFormAbstract('');
      setFormStudyDesign('');
      setFormMethodology('');
      setFormPopulation('');
      setFormSampleSize('');
      setFormFindings('');
      setFormLimitations('');
      setFormTags('');
      fetchEntries();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // AI Evidence Extraction
  const handleExtractEvidence = async (entry: LiteratureEntry) => {
    setExtractingId(entry._id);
    try {
      const res = await fetch('/api/v1/literature/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          entryId: entry._id,
          sourceText: entry.abstract || entry.title,
          metadata: {
            title: entry.title,
            authors: entry.authors,
            year: entry.year,
            journal: entry.journal
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extraction failed');

      setMessage(`AI extracted structured evidence for "${entry.title}".`);
      fetchEntries();
      if (detailEntry?._id === entry._id) {
        setDetailEntry(data.entry || null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExtractingId(null);
    }
  };

  // Update Screening Status
  const handleUpdateStatus = async (entryId: string, status: string) => {
    try {
      const res = await fetch(`/api/v1/literature/${entryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setEntries(prev => prev.map(e => (e._id === entryId ? { ...e, status: status as any } : e)));
        setMessage(`Updated screening status to ${status}.`);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Delete Entry
  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Remove this study from your literature matrix?')) return;
    try {
      const res = await fetch(`/api/v1/literature/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setEntries(prev => prev.filter(e => e._id !== id));
        setMessage('Study removed from matrix.');
        if (detailEntry?._id === id) {
          setIsDetailDrawerOpen(false);
          setDetailEntry(null);
        }
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Save Detail Updates
  const handleSaveDetailUpdates = async () => {
    if (!detailEntry) return;
    try {
      const res = await fetch(`/api/v1/literature/${detailEntry._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(detailEntry)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update study');

      setMessage('Study details updated successfully.');
      fetchEntries();
      setIsDetailDrawerOpen(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Side-by-Side Study Comparison
  const handleCompareStudies = async () => {
    if (selectedEntryIds.length < 2) {
      setError('Select at least 2 studies to perform side-by-side comparison.');
      return;
    }
    setComparing(true);
    try {
      const res = await fetch('/api/v1/literature/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          entryIds: selectedEntryIds,
          projectId
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Comparison failed');

      setComparisonResult(data);
      setActiveTab('compare');
      setMessage(`Compared ${data.studies?.length || 0} studies with consensus and divergence analysis.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setComparing(false);
    }
  };

  // Automated Research Gaps
  const handleIdentifyGaps = async () => {
    if (entries.length === 0) {
      setError('Add studies to the matrix before analyzing research gaps.');
      return;
    }
    setLoadingGaps(true);
    try {
      const res = await fetch('/api/v1/literature/gaps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          projectId,
          entryIds: selectedEntryIds.length > 0 ? selectedEntryIds : undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gap analysis failed');

      setGaps(data.gaps || []);
      setActiveTab('gaps');
      setMessage(`Identified ${data.gaps?.length || 0} candidate research gaps across empirical dimensions.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingGaps(false);
    }
  };

  // Generate Literature Synthesis
  const handleGenerateSynthesis = async () => {
    if (entries.length === 0) {
      setError('Add at least one study to the matrix before synthesizing.');
      return;
    }
    setSynthesizing(true);
    try {
      const res = await fetch('/api/v1/literature/synthesis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          projectId,
          type: synthesisType,
          focusResearchQuestion: synthesisFocus.trim() || undefined,
          entryIds: selectedEntryIds.length > 0 ? selectedEntryIds : undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Synthesis generation failed');

      setSynthesisResult(data.synthesis || data);
      setActiveTab('synthesis');
      setMessage(`Generated evidence-linked synthesis (${synthesisType}) with APA 7 attributions.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSynthesizing(false);
    }
  };

  // Create Theme
  const handleCreateTheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThemeName.trim()) {
      setError('Theme name is required.');
      return;
    }
    try {
      const res = await fetch('/api/v1/literature/themes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          projectId,
          name: newThemeName.trim(),
          description: newThemeDesc.trim(),
          color: newThemeColor
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create theme');

      setMessage(`Created theme "${newThemeName}".`);
      setNewThemeName('');
      setNewThemeDesc('');
      fetchThemes();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Export Matrix CSV
  const handleExportCsv = () => {
    const url = projectId
      ? `/api/v1/literature/export?format=csv&projectId=${projectId}`
      : `/api/v1/literature/export?format=csv`;
    window.open(url, '_blank');
    setMessage('Exporting literature matrix as CSV.');
  };

  // Export BibTeX
  const handleExportBibtex = () => {
    const url = projectId
      ? `/api/v1/literature/export?format=bibtex&projectId=${projectId}`
      : `/api/v1/literature/export?format=bibtex`;
    window.open(url, '_blank');
    setMessage('Exporting literature citations as BibTeX.');
  };

  // Filtered Entries
  const allTags = useMemo(() => {
    return Array.from(new Set(entries.flatMap(e => e.thematicTags || [])));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const query = search.toLowerCase();
      const matchesSearch =
        !query ||
        e.title.toLowerCase().includes(query) ||
        (e.authors || []).some(a => a.toLowerCase().includes(query)) ||
        (e.methodology || '').toLowerCase().includes(query) ||
        (e.keyFindings || '').toLowerCase().includes(query) ||
        (e.limitations || '').toLowerCase().includes(query);

      const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
      const matchesTag = tagFilter === 'all' || (e.thematicTags || []).includes(tagFilter);

      return matchesSearch && matchesStatus && matchesTag;
    });
  }, [entries, search, statusFilter, tagFilter]);

  // Toggle selection for comparison
  const toggleSelectEntry = (id: string) => {
    setSelectedEntryIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    if (selectedEntryIds.length === filteredEntries.length) {
      setSelectedEntryIds([]);
    } else {
      setSelectedEntryIds(filteredEntries.map(e => e._id));
    }
  };

  return (
    <div
      className="module-container"
      style={{
        padding: '24px',
        maxWidth: '1600px',
        margin: '0 auto',
        minHeight: '100vh',
        background: 'var(--rp-bg, #0f172a)',
        color: 'var(--rp-text, #f8fafc)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--rp-border, #1e293b)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--rp-accent, #6366f1)', marginBottom: '4px' }}>
            <BookOpen size={18} />
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Academic Module · Literature Review Studio
            </span>
            {activeProject && (
              <span
                style={{
                  fontSize: '11px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--rp-accent, #818cf8)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: '1px solid rgba(99, 102, 241, 0.3)'
                }}
              >
                Project: {activeProject.title}
              </span>
            )}
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            Empirical Literature Review & Evidence Matrix
          </h1>
          <p style={{ color: 'var(--rp-text-muted, #94a3b8)', fontSize: '13px', margin: '4px 0 0' }}>
            Systematically discover, extract, compare, and synthesize scientific evidence with rigorous methodological attribution.
          </p>
        </div>

        {/* Global Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="secondary small"
            onClick={fetchEntries}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Refresh literature entries"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
          </button>

          <button
            className="secondary small"
            onClick={handleExportCsv}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Download CSV literature matrix"
          >
            <Download size={13} /> Export CSV
          </button>

          <button
            className="secondary small"
            onClick={handleIdentifyGaps}
            disabled={loadingGaps || entries.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Run AI Research Gap Analysis"
          >
            <Lightbulb size={13} style={{ color: '#eab308' }} />
            {loadingGaps ? 'Detecting Gaps...' : 'Identify Gaps'}
          </button>

          <button
            className="secondary small"
            onClick={handleGenerateSynthesis}
            disabled={synthesizing || entries.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Generate evidence-linked synthesis draft"
          >
            <Sparkles size={13} style={{ color: 'var(--rp-accent, #6366f1)' }} />
            {synthesizing ? 'Synthesizing...' : 'Synthesize Literature'}
          </button>

          <button
            className="primary small"
            onClick={() => setShowAddModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} /> Add Study
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          borderBottom: '1px solid var(--rp-border, #1e293b)',
          marginBottom: '20px',
          overflowX: 'auto',
          paddingBottom: '2px'
        }}
      >
        {[
          { id: 'matrix', label: 'Literature Matrix', icon: Table, count: entries.length },
          { id: 'discover', label: 'Discover & Search', icon: Search },
          { id: 'studies', label: 'Studies & Extraction', icon: BookOpen, count: entries.length },
          { id: 'compare', label: 'Study Comparison', icon: GitCompare, badge: selectedEntryIds.length ? `${selectedEntryIds.length} sel` : undefined },
          { id: 'themes', label: 'Thematic Analysis', icon: Layers, count: themes.length },
          { id: 'gaps', label: 'Research Gaps', icon: Lightbulb, count: gaps.length },
          { id: 'synthesis', label: 'Synthesis Studio', icon: Sparkles },
          { id: 'export', label: 'Export Center', icon: Download }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--rp-accent, #818cf8)' : 'var(--rp-text-muted, #94a3b8)',
                background: isActive ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--rp-accent, #6366f1)' : '2px solid transparent',
                borderRadius: '6px 6px 0 0',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  style={{
                    fontSize: '11px',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: isActive ? 'var(--rp-accent, #6366f1)' : 'var(--rp-surface-2, #1e293b)',
                    color: isActive ? '#ffffff' : 'var(--rp-text-muted, #94a3b8)'
                  }}
                >
                  {tab.count}
                </span>
              )}
              {tab.badge && (
                <span
                  style={{
                    fontSize: '10px',
                    padding: '1px 5px',
                    borderRadius: '8px',
                    background: 'var(--rp-accent, #6366f1)',
                    color: '#fff'
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ============================================================== */}
      {/* TAB 1: LITERATURE MATRIX TABLE                                 */}
      {/* ============================================================== */}
      {activeTab === 'matrix' && (
        <div>
          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '16px',
              background: 'var(--rp-surface, #1e293b)',
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid var(--rp-border, #334155)'
            }}
          >
            {/* Search Input */}
            <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '10px',
                  color: 'var(--rp-text-muted, #94a3b8)'
                }}
              />
              <input
                type="text"
                placeholder="Filter by title, author, methodology, findings, or limitations..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  paddingLeft: '34px',
                  paddingRight: '12px',
                  paddingTop: '6px',
                  paddingBottom: '6px',
                  fontSize: '13px',
                  background: 'var(--rp-bg, #0f172a)',
                  border: '1px solid var(--rp-border, #334155)',
                  borderRadius: '6px',
                  color: 'var(--rp-text, #f8fafc)'
                }}
              />
            </div>

            {/* Screening Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--rp-text-muted, #94a3b8)' }}>Screening:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{
                  fontSize: '12px',
                  padding: '6px 10px',
                  background: 'var(--rp-bg, #0f172a)',
                  border: '1px solid var(--rp-border, #334155)',
                  borderRadius: '6px',
                  color: 'var(--rp-text, #f8fafc)'
                }}
              >
                <option value="all">All ({entries.length})</option>
                <option value="identified">Identified</option>
                <option value="screened">Screened</option>
                <option value="included">Included</option>
                <option value="excluded">Excluded</option>
              </select>
            </div>

            {/* Thematic Tag Filter */}
            {allTags.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--rp-text-muted, #94a3b8)' }}>Theme:</span>
                <select
                  value={tagFilter}
                  onChange={e => setTagFilter(e.target.value)}
                  style={{
                    fontSize: '12px',
                    padding: '6px 10px',
                    background: 'var(--rp-bg, #0f172a)',
                    border: '1px solid var(--rp-border, #334155)',
                    borderRadius: '6px',
                    color: 'var(--rp-text, #f8fafc)'
                  }}
                >
                  <option value="all">All Themes</option>
                  {allTags.map(tag => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Selection actions */}
            {selectedEntryIds.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--rp-accent, #818cf8)', fontWeight: 600 }}>
                  {selectedEntryIds.length} selected
                </span>
                <button
                  className="secondary small"
                  onClick={handleCompareStudies}
                  disabled={comparing || selectedEntryIds.length < 2}
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                >
                  <GitCompare size={12} /> Compare
                </button>
                <button
                  className="secondary small"
                  onClick={() => setSelectedEntryIds([])}
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Table Container */}
          <div
            style={{
              overflowX: 'auto',
              background: 'var(--rp-surface, #1e293b)',
              borderRadius: '8px',
              border: '1px solid var(--rp-border, #334155)',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '12px',
                lineHeight: '1.4'
              }}
            >
              <thead>
                <tr
                  style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    borderBottom: '1px solid var(--rp-border, #334155)',
                    color: 'var(--rp-text-muted, #94a3b8)',
                    textTransform: 'uppercase',
                    fontSize: '11px',
                    letterSpacing: '0.05em'
                  }}
                >
                  <th style={{ padding: '10px 12px', width: '36px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={
                        filteredEntries.length > 0 &&
                        selectedEntryIds.length === filteredEntries.length
                      }
                      onChange={selectAllFiltered}
                    />
                  </th>
                  <th style={{ padding: '10px 14px', minWidth: '240px' }}>Study / Reference</th>
                  <th style={{ padding: '10px 14px', minWidth: '120px' }}>Design</th>
                  <th style={{ padding: '10px 14px', minWidth: '140px' }}>Methodology</th>
                  <th style={{ padding: '10px 14px', minWidth: '90px' }}>Sample (N)</th>
                  <th style={{ padding: '10px 14px', minWidth: '260px' }}>Core Empirical Findings</th>
                  <th style={{ padding: '10px 14px', minWidth: '160px' }}>Effect Estimates</th>
                  <th style={{ padding: '10px 14px', minWidth: '160px' }}>Limitations</th>
                  <th style={{ padding: '10px 14px', minWidth: '110px' }}>Screening</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', width: '100px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: 'var(--rp-text-muted, #94a3b8)' }}>
                      <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
                      Loading literature entries...
                    </td>
                  </tr>
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '48px', textAlign: 'center', color: 'var(--rp-text-muted, #94a3b8)' }}>
                      <BookOpen size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: 'var(--rp-text, #f8fafc)' }}>
                        {entries.length === 0
                          ? 'No studies in this literature matrix yet.'
                          : 'No studies match your current filter.'}
                      </p>
                      <p style={{ margin: '4px 0 16px', fontSize: '12px' }}>
                        {entries.length === 0
                          ? 'Discover scholarly literature or add papers manually to construct your empirical matrix.'
                          : 'Try resetting your search query or status filter.'}
                      </p>
                      {entries.length === 0 && (
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            className="primary small"
                            onClick={() => setActiveTab('discover')}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Search size={13} /> Discover Papers
                          </button>
                          <button
                            className="secondary small"
                            onClick={() => setShowAddModal(true)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Plus size={13} /> Add Manually
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map(entry => {
                    const isSelected = selectedEntryIds.includes(entry._id);
                    return (
                      <tr
                        key={entry._id}
                        style={{
                          borderBottom: '1px solid var(--rp-border, #334155)',
                          verticalAlign: 'top',
                          background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        {/* Checkbox */}
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectEntry(entry._id)}
                          />
                        </td>

                        {/* Title & Reference */}
                        <td style={{ padding: '12px 14px' }}>
                          <div
                            onClick={() => {
                              setDetailEntry(entry);
                              setIsDetailDrawerOpen(true);
                            }}
                            style={{
                              fontWeight: 600,
                              color: 'var(--rp-text, #f8fafc)',
                              cursor: 'pointer',
                              marginBottom: '3px'
                            }}
                            className="hover-underline"
                            title="Click to view full extraction details"
                          >
                            {entry.title}
                          </div>
                          <div style={{ color: 'var(--rp-text-muted, #94a3b8)', fontSize: '11px' }}>
                            {(entry.authors || []).join(', ') || 'Unknown Authors'}
                            {entry.year ? ` (${entry.year})` : ''}
                          </div>
                          {entry.journal && (
                            <div style={{ color: 'var(--rp-text-muted, #64748b)', fontSize: '11px', fontStyle: 'italic' }}>
                              {entry.journal}
                            </div>
                          )}
                          {entry.doi && (
                            <a
                              href={`https://doi.org/${entry.doi}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '10px',
                                color: 'var(--rp-accent, #818cf8)',
                                textDecoration: 'none',
                                marginTop: '2px'
                              }}
                            >
                              <span>doi:{entry.doi}</span>
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </td>

                        {/* Study Design */}
                        <td style={{ padding: '12px 14px', color: 'var(--rp-text-muted, #cbd5e1)' }}>
                          {entry.studyDesign || <span style={{ color: 'var(--rp-text-muted, #64748b)' }}>—</span>}
                        </td>

                        {/* Methodology */}
                        <td style={{ padding: '12px 14px' }}>
                          {entry.methodology || entry.matrixData?.methodology || (
                            <span style={{ color: 'var(--rp-text-muted, #64748b)' }}>—</span>
                          )}
                        </td>

                        {/* Sample Size (N) */}
                        <td style={{ padding: '12px 14px' }}>
                          {entry.sampleSize || entry.matrixData?.sampleSize ? (
                            <code
                              style={{
                                background: 'rgba(99, 102, 241, 0.1)',
                                color: 'var(--rp-accent, #818cf8)',
                                padding: '2px 5px',
                                borderRadius: '4px',
                                fontSize: '11px'
                              }}
                            >
                              {entry.sampleSize || entry.matrixData?.sampleSize}
                            </code>
                          ) : (
                            <span style={{ color: 'var(--rp-text-muted, #64748b)' }}>—</span>
                          )}
                        </td>

                        {/* Core Findings */}
                        <td style={{ padding: '12px 14px', lineHeight: '1.45' }}>
                          {entry.keyFindings || entry.matrixData?.findings ? (
                            <span>{entry.keyFindings || entry.matrixData?.findings}</span>
                          ) : entry.abstract ? (
                            <span style={{ color: 'var(--rp-text-muted, #64748b)', fontSize: '11px' }}>
                              {entry.abstract.slice(0, 160)}...
                            </span>
                          ) : (
                            <span style={{ color: 'var(--rp-text-muted, #64748b)' }}>—</span>
                          )}
                        </td>

                        {/* Effect Estimates */}
                        <td style={{ padding: '12px 14px', fontSize: '11px' }}>
                          {entry.effectEstimates && entry.effectEstimates.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              {entry.effectEstimates.map((ee, idx) => (
                                <div key={idx} style={{ color: 'var(--rp-accent, #a5b4fc)' }}>
                                  <strong>{ee.metric}:</strong> {ee.value}
                                  {ee.ci && <span style={{ color: 'var(--rp-text-muted, #94a3b8)' }}> ({ee.ci})</span>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--rp-text-muted, #64748b)' }}>—</span>
                          )}
                        </td>

                        {/* Limitations */}
                        <td style={{ padding: '12px 14px', color: 'var(--rp-text-muted, #94a3b8)', fontSize: '11px' }}>
                          {entry.limitations || entry.matrixData?.limitations || '—'}
                        </td>

                        {/* Screening Status */}
                        <td style={{ padding: '12px 14px' }}>
                          <select
                            value={entry.status || 'identified'}
                            onChange={e => handleUpdateStatus(entry._id, e.target.value)}
                            style={{
                              fontSize: '11px',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              background:
                                entry.status === 'included'
                                  ? 'rgba(34, 197, 94, 0.15)'
                                  : entry.status === 'excluded'
                                  ? 'rgba(239, 68, 68, 0.15)'
                                  : 'rgba(99, 102, 241, 0.1)',
                              color:
                                entry.status === 'included'
                                  ? '#4ade80'
                                  : entry.status === 'excluded'
                                  ? '#f87171'
                                  : '#818cf8',
                              border: '1px solid var(--rp-border, #334155)',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="identified">Identified</option>
                            <option value="screened">Screened</option>
                            <option value="included">Included</option>
                            <option value="excluded">Excluded</option>
                          </select>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <button
                              className="icon-button"
                              onClick={() => handleExtractEvidence(entry)}
                              disabled={extractingId === entry._id}
                              title="Extract structured evidence with AI"
                              style={{ color: 'var(--rp-accent, #818cf8)' }}
                            >
                              <Sparkles size={13} className={extractingId === entry._id ? 'spin' : ''} />
                            </button>

                            <button
                              className="icon-button"
                              onClick={() => {
                                setDetailEntry(entry);
                                setIsDetailDrawerOpen(true);
                              }}
                              title="View & edit details"
                            >
                              <Edit3 size={13} />
                            </button>

                            <button
                              className="icon-button"
                              onClick={() => handleDeleteEntry(entry._id)}
                              title="Delete study"
                              style={{ color: 'var(--rp-danger, #ef4444)' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: DISCOVER & SEARCH PAPERS                                */}
      {/* ============================================================== */}
      {activeTab === 'discover' && (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          {/* Search Card */}
          <div
            style={{
              background: 'var(--rp-surface, #1e293b)',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid var(--rp-border, #334155)',
              marginBottom: '24px'
            }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 12px' }}>
              Scholarly Literature Discovery
            </h2>
            <p style={{ color: 'var(--rp-text-muted, #94a3b8)', fontSize: '13px', margin: '0 0 16px' }}>
              Directly query Crossref and OpenAlex academic databases for peer-reviewed journal articles, conference papers, and preprints.
            </p>

            <form onSubmit={handleSearchScholarly} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Enter keywords, author names, or research topic (e.g. quantum annealing optimization)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '13px',
                    background: 'var(--rp-bg, #0f172a)',
                    border: '1px solid var(--rp-border, #334155)',
                    borderRadius: '6px',
                    color: 'var(--rp-text, #f8fafc)'
                  }}
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Search size={14} /> {searching ? 'Searching...' : 'Search'}
                </button>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '2px' }}>
                    Type
                  </label>
                  <select
                    value={searchType}
                    onChange={e => setSearchType(e.target.value)}
                    style={{
                      fontSize: '12px',
                      padding: '4px 8px',
                      background: 'var(--rp-bg, #0f172a)',
                      border: '1px solid var(--rp-border, #334155)',
                      borderRadius: '4px',
                      color: 'var(--rp-text, #f8fafc)'
                    }}
                  >
                    <option value="all">All Types</option>
                    <option value="journal-article">Journal Article</option>
                    <option value="proceedings-article">Conference Paper</option>
                    <option value="book-chapter">Book Chapter</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '2px' }}>
                    From Year
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2018"
                    value={searchYearFrom}
                    onChange={e => setSearchYearFrom(e.target.value)}
                    style={{
                      width: '80px',
                      padding: '4px 8px',
                      fontSize: '12px',
                      background: 'var(--rp-bg, #0f172a)',
                      border: '1px solid var(--rp-border, #334155)',
                      borderRadius: '4px',
                      color: 'var(--rp-text, #f8fafc)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '2px' }}>
                    To Year
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2026"
                    value={searchYearTo}
                    onChange={e => setSearchYearTo(e.target.value)}
                    style={{
                      width: '80px',
                      padding: '4px 8px',
                      fontSize: '12px',
                      background: 'var(--rp-bg, #0f172a)',
                      border: '1px solid var(--rp-border, #334155)',
                      borderRadius: '4px',
                      color: 'var(--rp-text, #f8fafc)'
                    }}
                  />
                </div>
              </div>
            </form>

            {/* Direct DOI Lookup Row */}
            <div
              style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid var(--rp-border, #334155)',
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '12px', color: 'var(--rp-text-muted, #94a3b8)', whiteSpace: 'nowrap' }}>
                Or Direct DOI:
              </span>
              <input
                type="text"
                placeholder="e.g. 10.1038/s41586-020-2649-2"
                value={doiInput}
                onChange={e => setDoiInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: '12px',
                  background: 'var(--rp-bg, #0f172a)',
                  border: '1px solid var(--rp-border, #334155)',
                  borderRadius: '6px',
                  color: 'var(--rp-text, #f8fafc)'
                }}
              />
              <button
                type="button"
                className="secondary small"
                onClick={handleLookupDoi}
                disabled={doiLookingUp}
              >
                {doiLookingUp ? 'Resolving...' : 'Lookup DOI'}
              </button>
            </div>
          </div>

          {/* Results List */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: 'var(--rp-text-muted, #94a3b8)' }}>
              Discovery Results ({searchResults.length})
            </h3>

            {searchResults.length === 0 ? (
              <div
                style={{
                  background: 'var(--rp-surface, #1e293b)',
                  borderRadius: '8px',
                  padding: '36px',
                  textAlign: 'center',
                  color: 'var(--rp-text-muted, #94a3b8)',
                  border: '1px solid var(--rp-border, #334155)'
                }}
              >
                <Search size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                <p style={{ margin: 0 }}>Search Crossref and OpenAlex above to discover relevant literature.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {searchResults.map((res, idx) => {
                  const alreadyImported = entries.some(
                    e => (res.doi && e.doi === res.doi) || e.title.toLowerCase() === (res.title || '').toLowerCase()
                  );
                  return (
                    <div
                      key={res.id || res.doi || idx}
                      style={{
                        background: 'var(--rp-surface, #1e293b)',
                        border: '1px solid var(--rp-border, #334155)',
                        borderRadius: '8px',
                        padding: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '16px'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                          {res.title}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--rp-text-muted, #94a3b8)', marginBottom: '4px' }}>
                          {Array.isArray(res.authors)
                            ? res.authors.map((a: any) => typeof a === 'string' ? a : `${a.family || ''}, ${a.given || ''}`.trim()).join('; ')
                            : 'Unknown'}
                          {res.year || res.publicationYear ? ` · ${res.year || res.publicationYear}` : ''}
                          {res.journal || res.journalTitle ? ` · ${res.journal || res.journalTitle}` : ''}
                        </div>
                        {res.abstract && (
                          <p style={{ fontSize: '12px', color: 'var(--rp-text-muted, #cbd5e1)', margin: '6px 0', lineHeight: '1.4' }}>
                            {res.abstract.slice(0, 240)}...
                          </p>
                        )}
                        {res.doi && (
                          <div style={{ fontSize: '11px', color: 'var(--rp-accent, #818cf8)' }}>
                            DOI: {res.doi}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                        <button
                          className={alreadyImported ? 'secondary small' : 'primary small'}
                          disabled={alreadyImported}
                          onClick={() => handleImportToProject(res)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                        >
                          {alreadyImported ? (
                            <>
                              <CheckCircle2 size={12} style={{ color: '#4ade80' }} /> In Matrix
                            </>
                          ) : (
                            <>
                              <Plus size={12} /> Add to Matrix
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: STUDIES & EXTRACTION CARDS                              */}
      {/* ============================================================== */}
      {activeTab === 'studies' && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '16px'
            }}
          >
            {entries.map(entry => (
              <div
                key={entry._id}
                style={{
                  background: 'var(--rp-surface, #1e293b)',
                  border: '1px solid var(--rp-border, #334155)',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background:
                          entry.extractionStatus === 'completed'
                            ? 'rgba(34, 197, 94, 0.15)'
                            : 'rgba(234, 179, 8, 0.15)',
                        color: entry.extractionStatus === 'completed' ? '#4ade80' : '#facc15',
                        textTransform: 'uppercase',
                        fontWeight: 600
                      }}
                    >
                      {entry.extractionStatus || 'Pending'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)' }}>
                      {entry.year || 'n.d.'}
                    </span>
                  </div>

                  <h3
                    onClick={() => {
                      setDetailEntry(entry);
                      setIsDetailDrawerOpen(true);
                    }}
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      margin: '0 0 6px',
                      cursor: 'pointer',
                      color: 'var(--rp-text, #f8fafc)'
                    }}
                    className="hover-underline"
                  >
                    {entry.title}
                  </h3>

                  <p style={{ fontSize: '12px', color: 'var(--rp-text-muted, #94a3b8)', margin: '0 0 8px' }}>
                    {(entry.authors || []).join(', ') || 'Unknown'}
                  </p>

                  {entry.methodology && (
                    <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                      <strong style={{ color: 'var(--rp-text-muted, #94a3b8)' }}>Methodology: </strong>
                      <span>{entry.methodology}</span>
                    </div>
                  )}

                  {entry.sampleSize && (
                    <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                      <strong style={{ color: 'var(--rp-text-muted, #94a3b8)' }}>Sample: </strong>
                      <code>{entry.sampleSize}</code>
                    </div>
                  )}

                  {entry.keyFindings && (
                    <div style={{ fontSize: '11px', marginTop: '6px', color: 'var(--rp-text-muted, #cbd5e1)', lineHeight: '1.4' }}>
                      <strong style={{ color: 'var(--rp-text-muted, #94a3b8)' }}>Findings: </strong>
                      {entry.keyFindings.slice(0, 140)}...
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '16px',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--rp-border, #334155)'
                  }}
                >
                  <button
                    className="secondary small"
                    onClick={() => handleExtractEvidence(entry)}
                    disabled={extractingId === entry._id}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                  >
                    <Sparkles size={11} className={extractingId === entry._id ? 'spin' : ''} />
                    Extract AI Evidence
                  </button>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="icon-button"
                      onClick={() => {
                        setDetailEntry(entry);
                        setIsDetailDrawerOpen(true);
                      }}
                      title="Edit Study"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => handleDeleteEntry(entry._id)}
                      title="Remove Study"
                      style={{ color: 'var(--rp-danger, #ef4444)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: STUDY COMPARISON                                        */}
      {/* ============================================================== */}
      {activeTab === 'compare' && (
        <div>
          {/* Header instructions */}
          <div
            style={{
              background: 'var(--rp-surface, #1e293b)',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid var(--rp-border, #334155)',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div>
              <strong style={{ fontSize: '14px', display: 'block' }}>Side-by-Side Empirical Comparison</strong>
              <span style={{ fontSize: '12px', color: 'var(--rp-text-muted, #94a3b8)' }}>
                Select 2 or more studies from your matrix to run comparative methodology and findings synthesis.
              </span>
            </div>
            <button
              className="primary small"
              onClick={handleCompareStudies}
              disabled={comparing || selectedEntryIds.length < 2}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <GitCompare size={13} /> {comparing ? 'Comparing...' : 'Compare Selected Studies'}
            </button>
          </div>

          {comparisonResult ? (
            <div>
              {/* Studies Comparison Table */}
              <div
                style={{
                  overflowX: 'auto',
                  background: 'var(--rp-surface, #1e293b)',
                  borderRadius: '8px',
                  border: '1px solid var(--rp-border, #334155)',
                  marginBottom: '20px'
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(15, 23, 42, 0.7)', borderBottom: '1px solid var(--rp-border, #334155)' }}>
                      <th style={{ padding: '10px 14px', width: '160px', color: 'var(--rp-text-muted, #94a3b8)' }}>Dimension</th>
                      {comparisonResult.studies?.map((s: any) => (
                        <th key={s.id || s.title} style={{ padding: '10px 14px', minWidth: '220px', verticalAlign: 'top' }}>
                          <div style={{ fontWeight: 600 }}>{s.title}</div>
                          <div style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', fontWeight: 400 }}>
                            {s.authors} ({s.year})
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: 'design', label: 'Study Design' },
                      { key: 'methodology', label: 'Methodology' },
                      { key: 'sampleSize', label: 'Sample (N)' },
                      { key: 'keyFindings', label: 'Key Findings' },
                      { key: 'limitations', label: 'Limitations' }
                    ].map(dim => (
                      <tr key={dim.key} style={{ borderBottom: '1px solid var(--rp-border, #334155)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--rp-text-muted, #94a3b8)', background: 'rgba(15, 23, 42, 0.3)' }}>
                          {dim.label}
                        </td>
                        {comparisonResult.studies?.map((s: any) => (
                          <td key={s.id || s.title} style={{ padding: '12px 14px', verticalAlign: 'top', lineHeight: '1.4' }}>
                            {s[dim.key] || <span style={{ color: 'var(--rp-text-muted, #64748b)' }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Consensus & Divergence Panels */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div
                  style={{
                    background: 'var(--rp-surface, #1e293b)',
                    borderRadius: '8px',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4ade80', marginBottom: '8px' }}>
                    <CheckCircle2 size={16} />
                    <strong style={{ fontSize: '14px' }}>Points of Consensus</strong>
                  </div>
                  <p style={{ fontSize: '12px', lineHeight: '1.5', color: 'var(--rp-text-muted, #cbd5e1)' }}>
                    {comparisonResult.consensusAnalysis || 'All compared studies converge on standard empirical methodologies and observable effects.'}
                  </p>
                </div>

                <div
                  style={{
                    background: 'var(--rp-surface, #1e293b)',
                    borderRadius: '8px',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#facc15', marginBottom: '8px' }}>
                    <AlertCircle size={16} />
                    <strong style={{ fontSize: '14px' }}>Divergence & Conflicting Results</strong>
                  </div>
                  <p style={{ fontSize: '12px', lineHeight: '1.5', color: 'var(--rp-text-muted, #cbd5e1)' }}>
                    {comparisonResult.divergenceAnalysis || 'Divergence identified primarily in sample size coverage and measurement instrumentation variance.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: 'var(--rp-surface, #1e293b)',
                borderRadius: '8px',
                padding: '48px',
                textAlign: 'center',
                color: 'var(--rp-text-muted, #94a3b8)',
                border: '1px solid var(--rp-border, #334155)'
              }}
            >
              <GitCompare size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p style={{ margin: 0, fontWeight: 600 }}>Select 2 or more studies from the Matrix tab to compare.</p>
              <p style={{ margin: '4px 0 16px', fontSize: '12px' }}>
                Currently {selectedEntryIds.length} studies are selected.
              </p>
              <button className="secondary small" onClick={() => setActiveTab('matrix')}>
                Go to Matrix
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 5: THEMATIC ANALYSIS                                       */}
      {/* ============================================================== */}
      {activeTab === 'themes' && (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {/* Create Theme Form */}
          <div
            style={{
              background: 'var(--rp-surface, #1e293b)',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid var(--rp-border, #334155)',
              marginBottom: '24px'
            }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 12px' }}>Create Thematic Cluster</h2>
            <form onSubmit={handleCreateTheme} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="Theme Name (e.g., Cognitive Load in AI-assisted Learning)..."
                  value={newThemeName}
                  onChange={e => setNewThemeName(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    background: 'var(--rp-bg, #0f172a)',
                    border: '1px solid var(--rp-border, #334155)',
                    borderRadius: '6px',
                    color: 'var(--rp-text, #f8fafc)'
                  }}
                />
                <input
                  type="color"
                  value={newThemeColor}
                  onChange={e => setNewThemeColor(e.target.value)}
                  style={{
                    height: '38px',
                    width: '100%',
                    background: 'var(--rp-bg, #0f172a)',
                    border: '1px solid var(--rp-border, #334155)',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                />
              </div>

              <textarea
                placeholder="Theme scope, conceptual definition, and inclusion criteria..."
                value={newThemeDesc}
                onChange={e => setNewThemeDesc(e.target.value)}
                rows={2}
                style={{
                  padding: '8px 12px',
                  fontSize: '13px',
                  background: 'var(--rp-bg, #0f172a)',
                  border: '1px solid var(--rp-border, #334155)',
                  borderRadius: '6px',
                  color: 'var(--rp-text, #f8fafc)'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="primary small" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={13} /> Add Theme
                </button>
              </div>
            </form>
          </div>

          {/* Theme List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {themes.length === 0 ? (
              <div
                style={{
                  background: 'var(--rp-surface, #1e293b)',
                  borderRadius: '8px',
                  padding: '36px',
                  textAlign: 'center',
                  color: 'var(--rp-text-muted, #94a3b8)',
                  border: '1px solid var(--rp-border, #334155)'
                }}
              >
                <Layers size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <p style={{ margin: 0 }}>No thematic clusters defined yet.</p>
              </div>
            ) : (
              themes.map(th => {
                const associatedEntries = entries.filter(e =>
                  (e.thematicTags || []).includes(th.name)
                );
                return (
                  <div
                    key={th._id || th.id || th.name}
                    style={{
                      background: 'var(--rp-surface, #1e293b)',
                      border: '1px solid var(--rp-border, #334155)',
                      borderRadius: '8px',
                      padding: '16px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: th.color || 'var(--rp-accent, #6366f1)'
                          }}
                        />
                        <strong style={{ fontSize: '15px' }}>{th.name}</strong>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--rp-text-muted, #94a3b8)' }}>
                        {associatedEntries.length} studies
                      </span>
                    </div>

                    {th.description && (
                      <p style={{ fontSize: '12px', color: 'var(--rp-text-muted, #cbd5e1)', margin: '4px 0 10px' }}>
                        {th.description}
                      </p>
                    )}

                    {associatedEntries.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {associatedEntries.map(e => (
                          <span
                            key={e._id}
                            style={{
                              fontSize: '11px',
                              background: 'var(--rp-bg, #0f172a)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--rp-border, #334155)'
                            }}
                          >
                            {e.title.slice(0, 40)}...
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 6: RESEARCH GAPS & QUESTIONS                               */}
      {/* ============================================================== */}
      {activeTab === 'gaps' && (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div
            style={{
              background: 'var(--rp-surface, #1e293b)',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid var(--rp-border, #334155)',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div>
              <strong style={{ fontSize: '14px', display: 'block' }}>Empirical Research Gap Analysis</strong>
              <span style={{ fontSize: '12px', color: 'var(--rp-text-muted, #94a3b8)' }}>
                Identifies methodological, empirical, theoretical, and sample gaps with grounded research questions.
              </span>
            </div>
            <button
              className="primary small"
              onClick={handleIdentifyGaps}
              disabled={loadingGaps || entries.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Lightbulb size={13} style={{ color: '#eab308' }} />
              {loadingGaps ? 'Detecting Gaps...' : 'Run Gap Analysis'}
            </button>
          </div>

          {gaps.length === 0 ? (
            <div
              style={{
                background: 'var(--rp-surface, #1e293b)',
                borderRadius: '8px',
                padding: '48px',
                textAlign: 'center',
                color: 'var(--rp-text-muted, #94a3b8)',
                border: '1px solid var(--rp-border, #334155)'
              }}
            >
              <Lightbulb size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p style={{ margin: 0, fontWeight: 600 }}>No candidate research gaps generated yet.</p>
              <p style={{ margin: '4px 0 16px', fontSize: '12px' }}>
                Click "Run Gap Analysis" to inspect your literature matrix across 8 academic gap typologies.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {gaps.map((gap, idx) => (
                <div
                  key={gap.id || idx}
                  style={{
                    background: 'var(--rp-surface, #1e293b)',
                    borderRadius: '8px',
                    border: '1px solid var(--rp-border, #334155)',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        background: 'rgba(234, 179, 8, 0.15)',
                        color: '#facc15',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}
                    >
                      {gap.gapType || 'Empirical'} Gap
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)' }}>
                      Confidence: {gap.confidenceScore ? `${Math.round(gap.confidenceScore * 100)}%` : 'High'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 6px', color: 'var(--rp-text, #f8fafc)' }}>
                    {gap.title}
                  </h3>

                  <p style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--rp-text-muted, #cbd5e1)', margin: '0 0 12px' }}>
                    {gap.description}
                  </p>

                  {gap.researchQuestions && gap.researchQuestions.length > 0 && (
                    <div
                      style={{
                        background: 'var(--rp-bg, #0f172a)',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        border: '1px solid var(--rp-border, #334155)'
                      }}
                    >
                      <strong style={{ fontSize: '12px', color: 'var(--rp-accent, #818cf8)', display: 'block', marginBottom: '4px' }}>
                        Proposed Future Research Questions:
                      </strong>
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--rp-text-muted, #94a3b8)' }}>
                        {gap.researchQuestions.map((rq: string, rqIdx: number) => (
                          <li key={rqIdx} style={{ marginBottom: '2px' }}>{rq}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 7: EVIDENCE-LINKED SYNTHESIS STUDIO                        */}
      {/* ============================================================== */}
      {activeTab === 'synthesis' && (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          {/* Synthesis Config Form */}
          <div
            style={{
              background: 'var(--rp-surface, #1e293b)',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid var(--rp-border, #334155)',
              marginBottom: '24px'
            }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 12px' }}>
              Evidence-Linked Literature Review Synthesis
            </h2>
            <p style={{ color: 'var(--rp-text-muted, #94a3b8)', fontSize: '13px', margin: '0 0 16px' }}>
              Synthesizes included empirical studies into academic manuscript sections with strict APA 7 in-text citations.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '12px', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                  Synthesis Type
                </label>
                <select
                  value={synthesisType}
                  onChange={e => setSynthesisType(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '12px',
                    background: 'var(--rp-bg, #0f172a)',
                    border: '1px solid var(--rp-border, #334155)',
                    borderRadius: '6px',
                    color: 'var(--rp-text, #f8fafc)'
                  }}
                >
                  <option value="thematic">Thematic Synthesis</option>
                  <option value="narrative">Narrative Synthesis</option>
                  <option value="methodological">Methodological Synthesis</option>
                  <option value="chronological">Chronological Synthesis</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                  Optional Research Question Focus
                </label>
                <input
                  type="text"
                  placeholder="e.g. How does cognitive load influence task completion?"
                  value={synthesisFocus}
                  onChange={e => setSynthesisFocus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    background: 'var(--rp-bg, #0f172a)',
                    border: '1px solid var(--rp-border, #334155)',
                    borderRadius: '6px',
                    color: 'var(--rp-text, #f8fafc)'
                  }}
                />
              </div>

              <button
                className="primary"
                onClick={handleGenerateSynthesis}
                disabled={synthesizing || entries.length === 0}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '38px' }}
              >
                <Sparkles size={14} />
                {synthesizing ? 'Synthesizing...' : 'Generate Draft'}
              </button>
            </div>
          </div>

          {/* Synthesis Draft Display */}
          {synthesisResult && (
            <div
              style={{
                background: 'var(--rp-surface, #1e293b)',
                borderRadius: '8px',
                border: '1px solid var(--rp-border, #334155)',
                padding: '24px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                  paddingBottom: '12px',
                  borderBottom: '1px solid var(--rp-border, #334155)'
                }}
              >
                <div>
                  <strong style={{ fontSize: '16px' }}>Generated Synthesis Draft</strong>
                  <div style={{ fontSize: '12px', color: 'var(--rp-text-muted, #94a3b8)' }}>
                    Type: <span style={{ textTransform: 'capitalize' }}>{synthesisResult.type || synthesisType}</span> · Studies Synthesized: {synthesisResult.studyCount || entries.length}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="secondary small"
                    onClick={() => {
                      navigator.clipboard.writeText(synthesisResult.fullDraft || '');
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
                  </button>

                  {onSendToStudio && (
                    <button
                      className="primary small"
                      onClick={() => onSendToStudio(synthesisResult.fullDraft || '')}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <FileText size={13} /> Send to Writing Studio <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div
                style={{
                  background: 'var(--rp-bg, #0f172a)',
                  padding: '20px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  lineHeight: '1.7',
                  color: 'var(--rp-text, #f8fafc)',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '500px',
                  overflowY: 'auto',
                  border: '1px solid var(--rp-border, #334155)'
                }}
              >
                {synthesisResult.fullDraft}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 8: EXPORT CENTER                                           */}
      {/* ============================================================== */}
      {activeTab === 'export' && (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div
            style={{
              background: 'var(--rp-surface, #1e293b)',
              padding: '24px',
              borderRadius: '8px',
              border: '1px solid var(--rp-border, #334155)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px' }}>Literature Export Center</h2>
              <p style={{ color: 'var(--rp-text-muted, #94a3b8)', fontSize: '13px', margin: 0 }}>
                Export your structured literature review matrix and citations in standard academic formats.
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '14px',
                marginTop: '8px'
              }}
            >
              {/* CSV Export Card */}
              <div
                style={{
                  background: 'var(--rp-bg, #0f172a)',
                  padding: '16px',
                  borderRadius: '6px',
                  border: '1px solid var(--rp-border, #334155)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div>
                  <strong style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                    Literature Matrix (CSV)
                  </strong>
                  <p style={{ fontSize: '12px', color: 'var(--rp-text-muted, #94a3b8)', margin: 0 }}>
                    RFC 4180 compliant spreadsheet with all 15+ empirical dimensions.
                  </p>
                </div>
                <button className="primary small" onClick={handleExportCsv} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Download size={13} /> Download CSV
                </button>
              </div>

              {/* BibTeX Export Card */}
              <div
                style={{
                  background: 'var(--rp-bg, #0f172a)',
                  padding: '16px',
                  borderRadius: '6px',
                  border: '1px solid var(--rp-border, #334155)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div>
                  <strong style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                    BibTeX Bibliography
                  </strong>
                  <p style={{ fontSize: '12px', color: 'var(--rp-text-muted, #94a3b8)', margin: 0 }}>
                    Complete .bib file ready for LaTeX, Overleaf, or reference managers.
                  </p>
                </div>
                <button className="secondary small" onClick={handleExportBibtex} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Download size={13} /> Download .bib
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STUDY DETAIL & EDITING DRAWER / MODAL                          */}
      {/* ============================================================== */}
      {isDetailDrawerOpen && detailEntry && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 1000
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '650px',
              height: '100vh',
              background: 'var(--rp-surface, #1e293b)',
              overflowY: 'auto',
              padding: '24px',
              borderLeft: '1px solid var(--rp-border, #334155)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Study Extraction Details</h2>
              <button
                className="icon-button"
                onClick={() => setIsDetailDrawerOpen(false)}
                style={{ fontSize: '16px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                  Title
                </label>
                <input
                  type="text"
                  value={detailEntry.title || ''}
                  onChange={e => setDetailEntry({ ...detailEntry, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '13px',
                    background: 'var(--rp-bg, #0f172a)',
                    border: '1px solid var(--rp-border, #334155)',
                    borderRadius: '6px',
                    color: 'var(--rp-text, #f8fafc)'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                    Year
                  </label>
                  <input
                    type="text"
                    value={detailEntry.year || ''}
                    onChange={e => setDetailEntry({ ...detailEntry, year: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: '12px',
                      background: 'var(--rp-bg, #0f172a)',
                      border: '1px solid var(--rp-border, #334155)',
                      borderRadius: '6px',
                      color: 'var(--rp-text, #f8fafc)'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                    DOI
                  </label>
                  <input
                    type="text"
                    value={detailEntry.doi || ''}
                    onChange={e => setDetailEntry({ ...detailEntry, doi: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: '12px',
                      background: 'var(--rp-bg, #0f172a)',
                      border: '1px solid var(--rp-border, #334155)',
                      borderRadius: '6px',
                      color: 'var(--rp-text, #f8fafc)'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                  Study Design
                </label>
                <input
                  type="text"
                  value={detailEntry.studyDesign || ''}
                  onChange={e => setDetailEntry({ ...detailEntry, studyDesign: e.target.value })}
                  placeholder="e.g. Quasi-experimental pre-post design with control group"
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '12px',
                    background: 'var(--rp-bg, #0f172a)',
                    border: '1px solid var(--rp-border, #334155)',
                    borderRadius: '6px',
                    color: 'var(--rp-text, #f8fafc)'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                  Methodology
                </label>
                <input
                  type="text"
                  value={detailEntry.methodology || ''}
                  onChange={e => setDetailEntry({ ...detailEntry, methodology: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '12px',
                    background: 'var(--rp-bg, #0f172a)',
                    border: '1px solid var(--rp-border, #334155)',
                    borderRadius: '6px',
                    color: 'var(--rp-text, #f8fafc)'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                    Sample Size (N)
                  </label>
                  <input
                    type="text"
                    value={detailEntry.sampleSize || ''}
                    onChange={e => setDetailEntry({ ...detailEntry, sampleSize: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: '12px',
                      background: 'var(--rp-bg, #0f172a)',
                      border: '1px solid var(--rp-border, #334155)',
                      borderRadius: '6px',
                      color: 'var(--rp-text, #f8fafc)'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                    Population / Sampling
                  </label>
                  <input
                    type="text"
                    value={detailEntry.population || ''}
                    onChange={e => setDetailEntry({ ...detailEntry, population: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: '12px',
                      background: 'var(--rp-bg, #0f172a)',
                      border: '1px solid var(--rp-border, #334155)',
                      borderRadius: '6px',
                      color: 'var(--rp-text, #f8fafc)'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                  Core Empirical Findings
                </label>
                <textarea
                  rows={4}
                  value={detailEntry.keyFindings || ''}
                  onChange={e => setDetailEntry({ ...detailEntry, keyFindings: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '12px',
                    background: 'var(--rp-bg, #0f172a)',
                    border: '1px solid var(--rp-border, #334155)',
                    borderRadius: '6px',
                    color: 'var(--rp-text, #f8fafc)'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                  Limitations
                </label>
                <textarea
                  rows={2}
                  value={detailEntry.limitations || ''}
                  onChange={e => setDetailEntry({ ...detailEntry, limitations: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '12px',
                    background: 'var(--rp-bg, #0f172a)',
                    border: '1px solid var(--rp-border, #334155)',
                    borderRadius: '6px',
                    color: 'var(--rp-text, #f8fafc)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => setIsDetailDrawerOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary small"
                  onClick={handleSaveDetailUpdates}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MANUAL ADD PAPER MODAL                                         */}
      {/* ============================================================== */}
      {showAddModal && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }}
        >
          <div
            style={{
              background: 'var(--rp-surface, #1e293b)',
              borderRadius: '10px',
              width: '100%',
              maxWidth: '640px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              border: '1px solid var(--rp-border, #334155)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
            }}
          >
            <h2 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 16px' }}>
              Add Study to Literature Matrix
            </h2>
            <form onSubmit={handleAddManualPaper} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                  Paper Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cognitive Load and Generative Learning in STEM"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '13px',
                    background: 'var(--rp-bg, #0f172a)',
                    border: '1px solid var(--rp-border, #334155)',
                    borderRadius: '6px',
                    color: 'var(--rp-text, #f8fafc)'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                    Authors (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Sweller, J., Paas, F."
                    value={formAuthors}
                    onChange={e => setFormAuthors(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: '12px',
                      background: 'var(--rp-bg, #0f172a)',
                      border: '1px solid var(--rp-border, #334155)',
                      borderRadius: '6px',
                      color: 'var(--rp-text, #f8fafc)'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                    Year
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2024"
                    value={formYear}
                    onChange={e => setFormYear(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: '12px',
                      background: 'var(--rp-bg, #0f172a)',
                      border: '1px solid var(--rp-border, #334155)',
                      borderRadius: '6px',
                      color: 'var(--rp-text, #f8fafc)'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                    Journal / Publication
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Educational Psychology Review"
                    value={formJournal}
                    onChange={e => setFormJournal(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: '12px',
                      background: 'var(--rp-bg, #0f172a)',
                      border: '1px solid var(--rp-border, #334155)',
                      borderRadius: '6px',
                      color: 'var(--rp-text, #f8fafc)'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                    DOI
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10.1007/s10648-023-09801-4"
                    value={formDoi}
                    onChange={e => setFormDoi(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: '12px',
                      background: 'var(--rp-bg, #0f172a)',
                      border: '1px solid var(--rp-border, #334155)',
                      borderRadius: '6px',
                      color: 'var(--rp-text, #f8fafc)'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                    Study Design
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Randomized Controlled Trial"
                    value={formStudyDesign}
                    onChange={e => setFormStudyDesign(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: '12px',
                      background: 'var(--rp-bg, #0f172a)',
                      border: '1px solid var(--rp-border, #334155)',
                      borderRadius: '6px',
                      color: 'var(--rp-text, #f8fafc)'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                    Sample Size (N)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. N = 240 university students"
                    value={formSampleSize}
                    onChange={e => setFormSampleSize(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      fontSize: '12px',
                      background: 'var(--rp-bg, #0f172a)',
                      border: '1px solid var(--rp-border, #334155)',
                      borderRadius: '6px',
                      color: 'var(--rp-text, #f8fafc)'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                  Core Empirical Findings
                </label>
                <textarea
                  rows={3}
                  placeholder="Summarize key statistical findings, effect sizes, and outcomes..."
                  value={formFindings}
                  onChange={e => setFormFindings(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '12px',
                    background: 'var(--rp-bg, #0f172a)',
                    border: '1px solid var(--rp-border, #334155)',
                    borderRadius: '6px',
                    color: 'var(--rp-text, #f8fafc)'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--rp-text-muted, #94a3b8)', display: 'block', marginBottom: '4px' }}>
                  Limitations
                </label>
                <input
                  type="text"
                  placeholder="e.g. Single institution, short observation window"
                  value={formLimitations}
                  onChange={e => setFormLimitations(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '12px',
                    background: 'var(--rp-bg, #0f172a)',
                    border: '1px solid var(--rp-border, #334155)',
                    borderRadius: '6px',
                    color: 'var(--rp-text, #f8fafc)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary small">
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
