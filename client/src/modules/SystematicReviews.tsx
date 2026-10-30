import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers, Plus, Check, X, Filter, FileText, ChevronRight, Search, Upload,
  AlertTriangle, ShieldCheck, CheckCircle2, XCircle, HelpCircle, Download,
  ExternalLink, Split, FileCheck, RefreshCw, BarChart2, BookOpen, Clock,
  ArrowRight, Users, Copy, Eye, EyeOff, ShieldAlert, Award, FileSpreadsheet
} from 'lucide-react';

interface StudyRecord {
  _id: string;
  reviewId: string;
  title: string;
  authors: string[];
  year: string;
  journal: string;
  doi: string;
  pmid?: string;
  abstract: string;
  screeningStage: 'pre_screen' | 'title_abstract' | 'full_text' | 'included' | string;
  decision: 'included' | 'excluded' | 'unclear' | 'pending';
  exclusionReason?: string;
  deduplicationStatus?: 'unique' | 'duplicate' | 'canonical';
  fullTextStatus?: 'not_sought' | 'sought' | 'not_retrieved' | 'assessed';
  fullTextPdfUrl?: string;
}

interface SystematicReviewData {
  _id: string;
  projectId?: string;
  userId?: string;
  title: string;
  reviewType: 'systematic_review' | 'scoping_review' | 'meta_analysis' | 'rapid_review';
  status: string;
  currentStage: string;
  registration?: {
    registered: boolean;
    registryName: string;
    registrationNumber: string;
    protocolUrl?: string;
  };
  picosFramework?: {
    framework: string;
    population: string;
    intervention: string;
    comparator: string;
    outcomes: string;
    studyDesign: string;
  };
  eligibility?: {
    inclusionCriteria: string[];
    exclusionCriteria: string[];
  };
  screeningSettings?: {
    dualReviewerMode: boolean;
    blindScreening: boolean;
    adjudicationMethod: string;
    minimumReviewersPerRecord: number;
    conflictResolutionPolicy: string;
  };
  prismaReconciled?: {
    variant: string;
    counts: {
      identified: number;
      identifiedDatabases: number;
      identifiedRegisters: number;
      identifiedOther: number;
      duplicatesRemoved: number;
      ineligibleBeforeScreening: number;
      screenedTitleAbstract: number;
      excludedTitleAbstract: number;
      soughtFullText: number;
      notRetrievedFullText: number;
      assessedFullText: number;
      excludedFullText: number;
      exclusionReasonsBreakdown: Record<string, number>;
      includedStudies: number;
      includedReports: number;
    };
    isReconciled: boolean;
    discrepancies: string[];
  };
}

interface SystematicReviewsProps {
  token: string;
  activeProject: any;
  setSection: (section: string) => void;
  setMessage: (msg: string) => void;
  setError: (err: string) => void;
}

export default function SystematicReviews({
  token,
  activeProject,
  setSection,
  setMessage,
  setError
}: SystematicReviewsProps) {
  const [reviews, setReviews] = useState<SystematicReviewData[]>([]);
  const [activeReview, setActiveReview] = useState<SystematicReviewData | null>(null);
  const [studies, setStudies] = useState<StudyRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<
    'overview' | 'protocol' | 'search_import' | 'deduplication' | 'screening' | 'full_text' | 'extraction_rob' | 'prisma_diagram'
  >('screening');

  // Protocol state
  const [protocolData, setProtocolData] = useState<any>(null);
  const [savingProtocol, setSavingProtocol] = useState(false);
  const [amendmentNote, setAmendmentNote] = useState('');

  // Search & Import state
  const [searchRuns, setSearchRuns] = useState<any[]>([]);
  const [importFormat, setImportFormat] = useState<'ris' | 'bibtex' | 'csv'>('ris');
  const [importContent, setImportContent] = useState('');
  const [importSourceDb, setImportSourceDb] = useState('PubMed / MEDLINE');
  const [importing, setImporting] = useState(false);

  // Deduplication state
  const [duplicateCandidates, setDuplicateCandidates] = useState<any[]>([]);
  const [dupesLoading, setDupesLoading] = useState(false);

  // Screening state
  const [screeningQueue, setScreeningQueue] = useState<StudyRecord[]>([]);
  const [currentScreenIndex, setCurrentScreenIndex] = useState(0);
  const [exclusionReason, setExclusionReason] = useState('Wrong Population');
  const [customReason, setCustomReason] = useState('');
  const [screeningSubmitting, setScreeningSubmitting] = useState(false);

  // Conflicts state
  const [conflicts, setConflicts] = useState<any[]>([]);

  // Extraction & RoB state
  const [extractions, setExtractions] = useState<any[]>([]);
  const [robAssessments, setRobAssessments] = useState<any[]>([]);
  const [selectedRoBStudyId, setSelectedRoBStudyId] = useState<string>('');
  const [robTool, setRobTool] = useState<'RoB 2' | 'ROBINS-I' | 'QUADAS-2'>('RoB 2');
  const [robDomains, setRobDomains] = useState<Record<string, { judgment: string; supportText: string }>>({
    D1: { judgment: 'low', supportText: '' },
    D2: { judgment: 'low', supportText: '' },
    D3: { judgment: 'low', supportText: '' },
    D4: { judgment: 'low', supportText: '' },
    D5: { judgment: 'low', supportText: '' }
  });

  // PRISMA SVG & Checklist state
  const [prismaSvg, setPrismaSvg] = useState<string>('');
  const [checklist, setChecklist] = useState<any[]>([]);

  // Filters for Records List
  const [recordFilterStage, setRecordFilterStage] = useState('all');
  const [recordFilterDecision, setRecordFilterDecision] = useState('all');
  const [recordSearchQuery, setRecordSearchQuery] = useState('');

  const projectId = activeProject?._id;

  // 1. Fetch Systematic Reviews
  const fetchReviews = async () => {
    try {
      let url = '/api/systematic-reviews';
      if (projectId) url += `?projectId=${projectId}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const list = await res.json();
        setReviews(list || []);
        if (list?.length > 0 && !activeReview) {
          selectReview(list[0]);
        }
      }
    } catch (err: any) {
      console.warn('Failed to load systematic reviews:', err.message);
    }
  };

  const selectReview = async (rev: SystematicReviewData) => {
    setActiveReview(rev);
    loadReviewDetails(rev._id);
  };

  const loadReviewDetails = async (reviewId: string) => {
    setLoading(true);
    try {
      const [revRes, recordsRes, protoRes, searchRes, prismaRes] = await Promise.all([
        fetch(`/api/systematic-reviews/${reviewId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/systematic-reviews/${reviewId}/records?limit=100`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/systematic-reviews/${reviewId}/protocol`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/systematic-reviews/${reviewId}/search-strategies`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/systematic-reviews/${reviewId}/prisma`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (revRes.ok) {
        const fullRev = await revRes.json();
        setActiveReview(fullRev);
      }
      if (recordsRes.ok) {
        const recData = await recordsRes.json();
        setStudies(recData.records || []);
      }
      if (protoRes.ok) {
        const pData = await protoRes.json();
        setProtocolData(pData);
      }
      if (searchRes.ok) {
        const sList = await searchRes.json();
        setSearchRuns(sList || []);
      }
      if (prismaRes.ok) {
        const pSvgData = await prismaRes.json();
        setPrismaSvg(pSvgData.svgDiagram || '');
      }

      // Load conflicts & queue
      fetchQueue(reviewId);
      fetchConflicts(reviewId);
    } catch (err: any) {
      console.warn('Failed to load review details:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueue = async (reviewId: string) => {
    try {
      const res = await fetch(`/api/systematic-reviews/${reviewId}/screening-queue?stage=title_abstract`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const qData = await res.json();
        setScreeningQueue(qData.queue || []);
        setCurrentScreenIndex(0);
      }
    } catch {}
  };

  const fetchConflicts = async (reviewId: string) => {
    try {
      const res = await fetch(`/api/systematic-reviews/${reviewId}/conflicts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const cList = await res.json();
        setConflicts(cList || []);
      }
    } catch {}
  };

  const fetchDuplicates = async (reviewId: string) => {
    setDupesLoading(true);
    try {
      const res = await fetch(`/api/systematic-reviews/${reviewId}/duplicates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const dData = await res.json();
        setDuplicateCandidates(dData.duplicateGroups || []);
      }
    } catch {} finally {
      setDupesLoading(false);
    }
  };

  const fetchChecklist = async (reviewId: string) => {
    try {
      const res = await fetch(`/api/systematic-reviews/${reviewId}/prisma/checklist`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const cData = await res.json();
        setChecklist(cData.checklist || []);
      }
    } catch {}
  };

  const fetchExtractionsAndRoB = async (reviewId: string) => {
    try {
      const [extRes, robRes] = await Promise.all([
        fetch(`/api/systematic-reviews/${reviewId}/extractions`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/systematic-reviews/${reviewId}/risk-of-bias`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (extRes.ok) setExtractions(await extRes.json());
      if (robRes.ok) {
        const data = await robRes.json();
        setRobAssessments(data.assessments || []);
      }
    } catch {}
  };

  useEffect(() => {
    fetchReviews();
  }, [projectId, token]);

  useEffect(() => {
    if (activeReview) {
      if (activeTab === 'deduplication') fetchDuplicates(activeReview._id);
      if (activeTab === 'prisma_diagram') fetchChecklist(activeReview._id);
      if (activeTab === 'extraction_rob') fetchExtractionsAndRoB(activeReview._id);
    }
  }, [activeTab, activeReview?._id]);

  // Create Review
  const handleCreateDefaultReview = async () => {
    try {
      const res = await fetch('/api/systematic-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: 'Cardiometabolic SGLT2 Inhibitor Systematic Review and PRISMA 2020 Flow',
          projectId: projectId || null,
          reviewType: 'systematic_review',
          registration: {
            registered: true,
            registryName: 'PROSPERO',
            registrationNumber: 'CRD4202688001',
            protocolUrl: 'https://www.crd.york.ac.uk/prospero/'
          },
          picosFramework: {
            framework: 'PICOS',
            population: 'Adults diagnosed with heart failure with preserved ejection fraction (HFpEF)',
            intervention: 'SGLT2 inhibitors (Empagliflozin, Dapagliflozin)',
            comparator: 'Placebo or standard medical therapy',
            outcomes: 'Composite cardiovascular death or heart failure hospitalization',
            studyDesign: 'Randomized controlled trials'
          },
          screeningSettings: {
            dualReviewerMode: true,
            blindScreening: true,
            adjudicationMethod: 'third_reviewer',
            minimumReviewersPerRecord: 2,
            conflictResolutionPolicy: 'consensus'
          }
        })
      });

      const newRev = await res.json();
      if (!res.ok) throw new Error(newRev.error || 'Failed to create review');

      setMessage('Systematic Review initialized with PRISMA 2020 framework.');
      setReviews(prev => [newRev, ...prev]);
      selectReview(newRev);

      // Seed initial studies for instant productivity
      await fetch(`/api/systematic-reviews/${newRev._id}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          format: 'ris',
          content: `TY  - JOUR
TI  - Empagliflozin in Heart Failure with a Preserved Ejection Fraction
AU  - Anker, Stefan D.
AU  - Butler, Javed
PY  - 2021
JF  - New England Journal of Medicine
DO  - 10.1056/NEJMoa2107038
AB  - Empagliflozin reduced the combined risk of cardiovascular death or hospitalization for heart failure in patients with heart failure and a preserved ejection fraction.
ER  - 

TY  - JOUR
TI  - Dapagliflozin in Heart Failure with Mildly Reduced or Preserved Ejection Fraction
AU  - Solomon, Scott D.
AU  - McMurray, John J.V.
PY  - 2022
JF  - New England Journal of Medicine
DO  - 10.1056/NEJMoa2206286
AB  - Dapagliflozin reduced the combined risk of worsening heart failure or cardiovascular death among patients with HFpEF.
ER  - 

TY  - JOUR
TI  - Observational registry analysis of sodium-glucose cotransporter-2 inhibitors in heart failure
AU  - Zhang, Wei
AU  - Smith, Patricia
PY  - 2023
JF  - Circulation: Heart Failure
DO  - 10.1161/CIRCHEARTFAILURE.123.010200
AB  - Non-randomized retrospective electronic health record cohort of 14,000 clinic outpatients.
ER  - `,
          sourceDatabase: 'PubMed'
        })
      });

      loadReviewDetails(newRev._id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Screening Decision
  const handleScreenDecision = async (decision: 'included' | 'excluded' | 'unclear') => {
    if (!activeReview || !screeningQueue.length) return;
    const currentRecord = screeningQueue[currentScreenIndex];
    if (!currentRecord) return;

    setScreeningSubmitting(true);
    try {
      const reasonToUse = decision === 'excluded' ? (customReason.trim() || exclusionReason) : '';
      const res = await fetch(`/api/systematic-reviews/${activeReview._id}/screening-decisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          recordId: currentRecord._id,
          stage: 'title_abstract',
          decision,
          reason: reasonToUse
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record decision');

      if (data.conflictDetected) {
        setMessage('Decision recorded: Reviewer conflict detected and queued for adjudication.');
      } else {
        setMessage(`Record screened as "${decision.toUpperCase()}".`);
      }

      setCustomReason('');

      // Advance queue
      if (currentScreenIndex < screeningQueue.length - 1) {
        setCurrentScreenIndex(prev => prev + 1);
      } else {
        // Refresh queue
        fetchQueue(activeReview._id);
      }

      // Refresh PRISMA & records
      loadReviewDetails(activeReview._id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScreeningSubmitting(false);
    }
  };

  // Full-Text Assessment
  const handleFullTextDecision = async (recordId: string, decision: 'included' | 'excluded', reason: string) => {
    if (!activeReview) return;
    try {
      const res = await fetch(`/api/systematic-reviews/${activeReview._id}/full-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          recordId,
          decision,
          exclusionReason: reason,
          fullTextStatus: 'assessed'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update full-text decision');

      setMessage(`Full-text decision recorded: ${decision.toUpperCase()}.`);
      loadReviewDetails(activeReview._id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Resolve Conflict
  const handleResolveConflict = async (conflictId: string, finalDecision: 'included' | 'excluded', notes: string) => {
    if (!activeReview) return;
    try {
      const res = await fetch(`/api/systematic-reviews/${activeReview._id}/conflicts/${conflictId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          finalDecision,
          resolutionNotes: notes,
          stage: 'title_abstract'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resolve conflict');

      setMessage(`Conflict adjudicated as "${finalDecision.toUpperCase()}".`);
      fetchConflicts(activeReview._id);
      loadReviewDetails(activeReview._id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Save Risk of Bias
  const handleSaveRiskOfBias = async () => {
    if (!activeReview || !selectedRoBStudyId) {
      setError('Please select an included study to assess.');
      return;
    }

    try {
      const domainAssessments = Object.entries(robDomains).map(([domainId, val]) => ({
        domainId,
        domainName: domainId,
        judgment: val.judgment,
        supportText: val.supportText
      }));

      const res = await fetch(`/api/systematic-reviews/${activeReview._id}/risk-of-bias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          recordId: selectedRoBStudyId,
          toolName: robTool,
          domainAssessments,
          consensusReached: true
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save Risk of Bias assessment');

      setMessage(`Risk of Bias (${robTool}) saved with overall judgment: ${data.overallJudgment.toUpperCase()}.`);
      fetchExtractionsAndRoB(activeReview._id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Execute Import
  const handleExecuteImport = async () => {
    if (!activeReview || !importContent.trim()) {
      setError('Please provide raw RIS, BibTeX, or CSV content to import.');
      return;
    }

    setImporting(true);
    try {
      const res = await fetch(`/api/systematic-reviews/${activeReview._id}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          format: importFormat,
          content: importContent,
          sourceDatabase: importSourceDb
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      setMessage(`Successfully imported ${data.importedCount} records (${data.duplicateCount} duplicates identified).`);
      setImportContent('');
      loadReviewDetails(activeReview._id);
      setActiveTab('screening');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  // Filtered Studies for Records Tab
  const filteredRecords = useMemo(() => {
    return studies.filter(s => {
      if (recordFilterStage !== 'all' && s.screeningStage !== recordFilterStage) return false;
      if (recordFilterDecision !== 'all' && s.decision !== recordFilterDecision) return false;
      if (recordSearchQuery.trim()) {
        const q = recordSearchQuery.toLowerCase();
        return (
          s.title.toLowerCase().includes(q) ||
          (s.abstract && s.abstract.toLowerCase().includes(q)) ||
          (s.doi && s.doi.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [studies, recordFilterStage, recordFilterDecision, recordSearchQuery]);

  const pCounts = activeReview?.prismaReconciled?.counts || {
    identified: studies.length,
    duplicatesRemoved: studies.filter(s => s.deduplicationStatus === 'duplicate').length,
    screenedTitleAbstract: studies.filter(s => s.decision !== 'pending').length,
    excludedTitleAbstract: studies.filter(s => s.screeningStage === 'title_abstract' && s.decision === 'excluded').length,
    soughtFullText: studies.filter(s => s.screeningStage === 'full_text' || s.screeningStage === 'included').length,
    assessedFullText: studies.filter(s => s.screeningStage === 'full_text' || s.screeningStage === 'included').length,
    excludedFullText: studies.filter(s => s.screeningStage === 'full_text' && s.decision === 'excluded').length,
    includedStudies: studies.filter(s => s.screeningStage === 'included').length,
    includedReports: studies.filter(s => s.screeningStage === 'included').length
  };

  const currentScreenRecord = screeningQueue[currentScreenIndex];

  return (
    <div className="module-container" style={{ padding: '24px 28px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '22px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--rp-accent, #6366f1)', marginBottom: '4px' }}>
            <Layers size={18} />
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Phase 8 · Systematic Review Assistant &amp; PRISMA 2020 Studio
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 6px', color: 'var(--rp-text, #0f172a)', letterSpacing: '-0.5px' }}>
            {activeReview ? activeReview.title : 'Systematic Review Assistant'}
          </h1>
          <p style={{ color: 'var(--rp-text-muted, #64748b)', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
            Methodological protocol authoring, multi-source record imports, deduplication, blind dual-reviewer screening, RoB 2, and live PRISMA 2020 flow reconciliation.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {activeReview ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <a
                href={`/api/systematic-reviews/${activeReview._id}/export?format=csv`}
                className="button outline"
                download
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 12px', textDecoration: 'none' }}
              >
                <Download size={14} /> Export CSV
              </a>
              <button
                className="button outline"
                onClick={() => handleCreateDefaultReview()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 12px' }}
              >
                <Plus size={14} /> New Review
              </button>
            </div>
          ) : (
            <button className="primary" onClick={handleCreateDefaultReview}>
              <Plus size={15} style={{ marginRight: '6px' }} /> Initialize PRISMA Review
            </button>
          )}
        </div>
      </div>

      {/* Review Selector Pill Bar */}
      {reviews.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', paddingBottom: '4px' }}>
          {reviews.map(r => (
            <button
              key={r._id}
              onClick={() => selectReview(r)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                border: activeReview?._id === r._id ? '1px solid var(--rp-accent, #6366f1)' : '1px solid var(--rp-border, #e2e8f0)',
                background: activeReview?._id === r._id ? 'var(--rp-accent-subtle, #eef2ff)' : 'var(--rp-surface, #ffffff)',
                color: activeReview?._id === r._id ? 'var(--rp-accent, #4338ca)' : 'var(--rp-text, #334155)',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {r.title.slice(0, 36)}...
            </button>
          ))}
        </div>
      )}

      {/* PRISMA 2020 Live Flow Metrics Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '10px',
        marginBottom: '20px'
      }}>
        <div className="card" style={{ padding: '12px 14px', textAlign: 'center', borderLeft: '3px solid #6366f1' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--rp-text-muted, #64748b)', textTransform: 'uppercase' }}>Identified</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--rp-text, #0f172a)', marginTop: '2px' }}>{pCounts.identified}</div>
          <div style={{ fontSize: '10px', color: 'var(--rp-text-dim, #94a3b8)' }}>all sources</div>
        </div>
        <div className="card" style={{ padding: '12px 14px', textAlign: 'center', borderLeft: '3px solid #f59e0b' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--rp-text-muted, #64748b)', textTransform: 'uppercase' }}>Duplicates</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>{pCounts.duplicatesRemoved}</div>
          <div style={{ fontSize: '10px', color: 'var(--rp-text-dim, #94a3b8)' }}>removed</div>
        </div>
        <div className="card" style={{ padding: '12px 14px', textAlign: 'center', borderLeft: '3px solid #3b82f6' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--rp-text-muted, #64748b)', textTransform: 'uppercase' }}>Screened</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>{pCounts.screenedTitleAbstract}</div>
          <div style={{ fontSize: '10px', color: 'var(--rp-text-dim, #94a3b8)' }}>title &amp; abstract</div>
        </div>
        <div className="card" style={{ padding: '12px 14px', textAlign: 'center', borderLeft: '3px solid #ef4444' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--rp-text-muted, #64748b)', textTransform: 'uppercase' }}>Excluded</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#dc2626', marginTop: '2px' }}>{pCounts.excludedTitleAbstract}</div>
          <div style={{ fontSize: '10px', color: 'var(--rp-text-dim, #94a3b8)' }}>title &amp; abstract</div>
        </div>
        <div className="card" style={{ padding: '12px 14px', textAlign: 'center', borderLeft: '3px solid #8b5cf6' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--rp-text-muted, #64748b)', textTransform: 'uppercase' }}>Full-Text</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#7c3aed', marginTop: '2px' }}>{pCounts.assessedFullText}</div>
          <div style={{ fontSize: '10px', color: 'var(--rp-text-dim, #94a3b8)' }}>assessed</div>
        </div>
        <div className="card" style={{ padding: '12px 14px', textAlign: 'center', borderLeft: '3px solid #10b981' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--rp-text-muted, #64748b)', textTransform: 'uppercase' }}>Included</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669', marginTop: '2px' }}>{pCounts.includedStudies}</div>
          <div style={{ fontSize: '10px', color: 'var(--rp-text-dim, #94a3b8)' }}>in synthesis</div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--rp-border, #e2e8f0)',
        marginBottom: '22px',
        gap: '4px',
        overflowX: 'auto'
      }}>
        {[
          { key: 'screening', label: 'Screening Queue', badge: screeningQueue.length, icon: Filter },
          { key: 'protocol', label: 'Protocol & PICOS', icon: FileText },
          { key: 'search_import', label: 'Search & Import', icon: Upload },
          { key: 'deduplication', label: 'Deduplication', icon: Split },
          { key: 'full_text', label: 'Full-Text Eligibility', icon: BookOpen },
          { key: 'extraction_rob', label: 'Data & Risk of Bias', icon: Award },
          { key: 'prisma_diagram', label: 'PRISMA 2020 Flow & Checklist', icon: BarChart2 }
        ].map(t => {
          const Icon = t.icon;
          const isSelected = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: isSelected ? 700 : 500,
                color: isSelected ? 'var(--rp-accent, #6366f1)' : 'var(--rp-text-muted, #64748b)',
                borderBottom: isSelected ? '2px solid var(--rp-accent, #6366f1)' : '2px solid transparent',
                background: 'transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={15} />
              <span>{t.label}</span>
              {t.badge !== undefined && t.badge > 0 && (
                <span style={{
                  background: isSelected ? 'var(--rp-accent, #6366f1)' : 'var(--rp-surface-subtle, #e2e8f0)',
                  color: isSelected ? '#ffffff' : 'var(--rp-text, #475569)',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '9999px'
                }}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: SCREENING QUEUE */}
      {activeTab === 'screening' && (
        <div style={{ display: 'grid', gridTemplateColumns: conflicts.length ? '1fr 340px' : '1fr', gap: '20px' }}>
          <div>
            {currentScreenRecord ? (
              <div className="card" style={{ padding: '24px 28px', border: '1px solid var(--rp-border, #e2e8f0)', borderRadius: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'var(--rp-accent-subtle, #eef2ff)',
                      color: 'var(--rp-accent-text, #4338ca)'
                    }}>
                      Record {currentScreenIndex + 1} of {screeningQueue.length}
                    </span>
                    {activeReview?.screeningSettings?.dualReviewerMode && (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: '#ecfdf5',
                        color: '#047857',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Users size={12} /> Blind Dual Review
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--rp-text-muted, #64748b)' }}>
                    Stage: <strong>Title &amp; Abstract</strong>
                  </div>
                </div>

                <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--rp-text, #0f172a)', margin: '0 0 10px', lineHeight: 1.4 }}>
                  {currentScreenRecord.title}
                </h2>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '12.5px', color: 'var(--rp-text-muted, #64748b)', marginBottom: '16px' }}>
                  <div><strong>Authors:</strong> {(currentScreenRecord.authors || []).join('; ') || 'Unknown'}</div>
                  {currentScreenRecord.year && <div><strong>Year:</strong> {currentScreenRecord.year}</div>}
                  {currentScreenRecord.journal && <div><strong>Journal:</strong> {currentScreenRecord.journal}</div>}
                  {currentScreenRecord.doi && (
                    <div>
                      <strong>DOI:</strong>{' '}
                      <a href={`https://doi.org/${currentScreenRecord.doi}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--rp-accent, #6366f1)', textDecoration: 'underline' }}>
                        {currentScreenRecord.doi}
                      </a>
                    </div>
                  )}
                </div>

                <div style={{
                  background: 'var(--rp-surface-subtle, #f8fafc)',
                  border: '1px solid var(--rp-border-subtle, #edf2f7)',
                  borderRadius: '10px',
                  padding: '16px 20px',
                  marginBottom: '24px',
                  fontSize: '13.5px',
                  lineHeight: 1.65,
                  color: 'var(--rp-text, #1e293b)'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--rp-text-muted, #64748b)', marginBottom: '6px', letterSpacing: '0.5px' }}>
                    Abstract
                  </div>
                  {currentScreenRecord.abstract || <em>No abstract provided for this study. Verify against published report.</em>}
                </div>

                {/* Exclusion Reason Selector */}
                <div style={{ marginBottom: '20px', padding: '14px', background: 'var(--rp-surface, #ffffff)', border: '1px dashed var(--rp-border, #cbd5e1)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--rp-text, #334155)', marginBottom: '8px' }}>
                    Standard Exclusion Reason (Applied if Excluded):
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {['Wrong Population', 'Wrong Intervention', 'Wrong Comparator', 'Wrong Study Design', 'Wrong Outcome'].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => { setExclusionReason(r); setCustomReason(''); }}
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 600,
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: exclusionReason === r && !customReason ? '1px solid var(--rp-danger, #dc2626)' : '1px solid var(--rp-border, #cbd5e1)',
                          background: exclusionReason === r && !customReason ? 'var(--rp-danger-subtle, #fef2f2)' : 'var(--rp-surface, #ffffff)',
                          color: exclusionReason === r && !customReason ? 'var(--rp-danger, #b91c1c)' : 'var(--rp-text, #475569)',
                          cursor: 'pointer'
                        }}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Decision Action Buttons */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    className="primary"
                    disabled={screeningSubmitting}
                    onClick={() => handleScreenDecision('included')}
                    style={{ flex: 1, minWidth: '160px', padding: '12px 18px', background: '#059669', borderColor: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <CheckCircle2 size={16} /> Include Study (I)
                  </button>
                  <button
                    className="danger"
                    disabled={screeningSubmitting}
                    onClick={() => handleScreenDecision('excluded')}
                    style={{ flex: 1, minWidth: '160px', padding: '12px 18px', background: '#dc2626', borderColor: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#fff' }}
                  >
                    <XCircle size={16} /> Exclude Study (E)
                  </button>
                  <button
                    className="button outline"
                    disabled={screeningSubmitting}
                    onClick={() => handleScreenDecision('unclear')}
                    style={{ minWidth: '130px', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <HelpCircle size={16} /> Unclear (U)
                  </button>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: '48px 24px', textAlign: 'center', borderRadius: '14px' }}>
                <CheckCircle2 size={42} style={{ color: '#059669', margin: '0 auto 14px' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px' }}>Screening Queue Complete!</h3>
                <p style={{ color: 'var(--rp-text-muted, #64748b)', fontSize: '13px', maxWidth: '480px', margin: '0 auto 20px' }}>
                  All pending study records for this stage have been screened by your account. Review any reviewer conflicts or proceed to full-text assessment.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                  <button className="button outline" onClick={() => setActiveTab('search_import')}>
                    <Upload size={14} style={{ marginRight: '6px' }} /> Import More Studies
                  </button>
                  <button className="primary" onClick={() => setActiveTab('prisma_diagram')}>
                    <BarChart2 size={14} style={{ marginRight: '6px' }} /> View PRISMA Diagram
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Drawer: Reviewer Conflicts */}
          {conflicts.length > 0 && (
            <div className="card" style={{ padding: '18px 20px', borderRadius: '14px', border: '1px solid #fecaca', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', marginBottom: '12px' }}>
                <AlertTriangle size={18} />
                <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase' }}>
                  Reviewer Conflicts ({conflicts.length})
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px' }}>
                Disagreements between independent dual screeners require adjudication.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {conflicts.map(c => (
                  <div key={c._id} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                      {c.recordId?.title ? c.recordId.title.slice(0, 50) + '...' : 'Conflicted Study Record'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569', marginBottom: '8px' }}>
                      Votes: {c.decisions?.map((d: any, i: number) => (
                        <span key={i} style={{ marginRight: '8px' }}>
                          <strong>Rev {i+1}:</strong> {d.decision}
                        </span>
                      ))}
                    </div>
                    {c.status === 'resolved' ? (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#047857' }}>✓ Resolved ({c.finalDecision})</span>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => handleResolveConflict(c._id, 'included', 'Adjudicated inclusion')}
                          style={{ fontSize: '11px', padding: '4px 8px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Include
                        </button>
                        <button
                          onClick={() => handleResolveConflict(c._id, 'excluded', 'Adjudicated exclusion')}
                          style={{ fontSize: '11px', padding: '4px 8px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                        >
                          Exclude
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PROTOCOL & PICOS */}
      {activeTab === 'protocol' && (
        <div className="card" style={{ padding: '24px 28px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px' }}>Review Protocol &amp; Eligibility Criteria</h2>
              <p style={{ fontSize: '12.5px', color: 'var(--rp-text-muted, #64748b)', margin: 0 }}>
                Pre-specified PICOS eligibility boundaries, registration details, and formal amendments.
              </p>
            </div>
            {protocolData?.registrationNumber && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--rp-accent-subtle, #eef2ff)', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--rp-accent-text, #4338ca)' }}>
                <Award size={15} /> {protocolData.registryName || 'PROSPERO'}: {protocolData.registrationNumber}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={{ padding: '14px', background: 'var(--rp-surface-subtle, #f8fafc)', borderRadius: '10px', border: '1px solid var(--rp-border-subtle, #edf2f7)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--rp-accent, #6366f1)', textTransform: 'uppercase', marginBottom: '4px' }}>Population (P)</div>
              <div style={{ fontSize: '13px', color: 'var(--rp-text, #0f172a)' }}>{activeReview?.picosFramework?.population || 'Not specified'}</div>
            </div>
            <div style={{ padding: '14px', background: 'var(--rp-surface-subtle, #f8fafc)', borderRadius: '10px', border: '1px solid var(--rp-border-subtle, #edf2f7)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--rp-accent, #6366f1)', textTransform: 'uppercase', marginBottom: '4px' }}>Intervention (I)</div>
              <div style={{ fontSize: '13px', color: 'var(--rp-text, #0f172a)' }}>{activeReview?.picosFramework?.intervention || 'Not specified'}</div>
            </div>
            <div style={{ padding: '14px', background: 'var(--rp-surface-subtle, #f8fafc)', borderRadius: '10px', border: '1px solid var(--rp-border-subtle, #edf2f7)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--rp-accent, #6366f1)', textTransform: 'uppercase', marginBottom: '4px' }}>Comparator (C)</div>
              <div style={{ fontSize: '13px', color: 'var(--rp-text, #0f172a)' }}>{activeReview?.picosFramework?.comparator || 'Not specified'}</div>
            </div>
            <div style={{ padding: '14px', background: 'var(--rp-surface-subtle, #f8fafc)', borderRadius: '10px', border: '1px solid var(--rp-border-subtle, #edf2f7)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--rp-accent, #6366f1)', textTransform: 'uppercase', marginBottom: '4px' }}>Outcomes (O)</div>
              <div style={{ fontSize: '13px', color: 'var(--rp-text, #0f172a)' }}>{activeReview?.picosFramework?.outcomes || 'Not specified'}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <div style={{ padding: '16px', background: '#ecfdf5', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#047857', textTransform: 'uppercase', marginBottom: '8px' }}>
                Inclusion Criteria
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#064e3b', lineHeight: 1.6 }}>
                {(activeReview?.eligibility?.inclusionCriteria || []).map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
            <div style={{ padding: '16px', background: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#b91c1c', textTransform: 'uppercase', marginBottom: '8px' }}>
                Exclusion Criteria
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#7f1d1d', lineHeight: 1.6 }}>
                {(activeReview?.eligibility?.exclusionCriteria || []).map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          </div>

          {/* Protocol Amendments History */}
          {protocolData?.amendments?.length > 0 && (
            <div style={{ marginTop: '20px', borderTop: '1px solid var(--rp-border, #e2e8f0)', paddingTop: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--rp-text, #0f172a)', marginBottom: '10px' }}>
                Protocol Amendments (Version {protocolData.version})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {protocolData.amendments.map((a: any, i: number) => (
                  <div key={i} style={{ fontSize: '12px', color: 'var(--rp-text-muted, #64748b)', padding: '8px 12px', background: 'var(--rp-surface-subtle, #f8fafc)', borderRadius: '6px' }}>
                    <strong>v{a.version} ({new Date(a.date).toLocaleDateString()}):</strong> {a.reason}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SEARCH & IMPORT */}
      {activeTab === 'search_import' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {/* Left: Import Raw Data */}
          <div className="card" style={{ padding: '24px', borderRadius: '14px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px' }}>Import Study Records</h2>
            <p style={{ fontSize: '12px', color: 'var(--rp-text-muted, #64748b)', margin: '0 0 16px' }}>
              Paste export files directly from PubMed, Scopus, Cochrane, or citation managers.
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              {(['ris', 'bibtex', 'csv'] as const).map(fmt => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setImportFormat(fmt)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    border: importFormat === fmt ? '1px solid var(--rp-accent, #6366f1)' : '1px solid var(--rp-border, #cbd5e1)',
                    background: importFormat === fmt ? 'var(--rp-accent, #6366f1)' : 'var(--rp-surface, #ffffff)',
                    color: importFormat === fmt ? '#ffffff' : 'var(--rp-text, #475569)',
                    cursor: 'pointer'
                  }}
                >
                  {fmt}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Information Source:</label>
              <input
                type="text"
                value={importSourceDb}
                onChange={e => setImportSourceDb(e.target.value)}
                placeholder="e.g. PubMed / MEDLINE, Embase, CENTRAL"
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--rp-border, #cbd5e1)' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Raw File Content:</label>
              <textarea
                value={importContent}
                onChange={e => setImportContent(e.target.value)}
                placeholder={importFormat === 'ris' ? 'TY  - JOUR\nTI  - Study Title\nAU  - Author, Name\nDO  - 10.1000/xyz\nER  -' : '@article{...\n}'}
                rows={10}
                style={{ width: '100%', padding: '10px 12px', fontSize: '12px', fontFamily: 'monospace', borderRadius: '8px', border: '1px solid var(--rp-border, #cbd5e1)' }}
              />
            </div>

            <button
              className="primary"
              disabled={importing || !importContent.trim()}
              onClick={handleExecuteImport}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Upload size={15} /> {importing ? 'Processing & Deduplicating...' : 'Import Records'}
            </button>
          </div>

          {/* Right: Search Execution Strategies History */}
          <div className="card" style={{ padding: '24px', borderRadius: '14px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px' }}>Search Execution Strategies</h2>
            <p style={{ fontSize: '12px', color: 'var(--rp-text-muted, #64748b)', margin: '0 0 16px' }}>
              PRISMA 2020 Item 7 requires reporting full search strategies and exact retrieval dates.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {searchRuns.length ? searchRuns.map(s => (
                <div key={s._id} style={{ padding: '12px 14px', border: '1px solid var(--rp-border, #e2e8f0)', borderRadius: '8px', background: 'var(--rp-surface-subtle, #f8fafc)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '13px', color: 'var(--rp-text, #0f172a)' }}>{s.databaseName}</strong>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--rp-accent, #6366f1)' }}>n = {s.recordsRetrieved}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--rp-text-muted, #64748b)', marginBottom: '6px' }}>
                    Date: {new Date(s.searchDate).toLocaleDateString()}
                  </div>
                  <div style={{ fontSize: '11.5px', fontFamily: 'monospace', background: 'var(--rp-surface, #ffffff)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--rp-border-subtle, #edf2f7)', color: 'var(--rp-text, #334155)' }}>
                    {s.searchString || 'Direct export / manual strategy'}
                  </div>
                </div>
              )) : (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--rp-text-muted, #64748b)', fontSize: '12px' }}>
                  No search strategies logged yet. Search strings are recorded when importing records.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DEDUPLICATION */}
      {activeTab === 'deduplication' && (
        <div className="card" style={{ padding: '24px 28px', borderRadius: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px' }}>Duplicate Records Inspector</h2>
              <p style={{ fontSize: '12.5px', color: 'var(--rp-text-muted, #64748b)', margin: 0 }}>
                Automated multi-field duplicate detection via normalized DOIs, PMIDs, Levenshtein title distance, and author overlap.
              </p>
            </div>
            <button className="button outline" onClick={() => activeReview && fetchDuplicates(activeReview._id)}>
              <RefreshCw size={14} style={{ marginRight: '6px' }} /> Refresh Matches
            </button>
          </div>

          {dupesLoading ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--rp-text-muted, #64748b)' }}>Scanning for duplicate clusters...</div>
          ) : duplicateCandidates.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {duplicateCandidates.map((group, idx) => (
                <div key={idx} style={{ padding: '16px', border: '1px solid #fed7aa', borderRadius: '10px', background: '#fffbeb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: '#f59e0b', color: '#fff' }}>
                        {group.matchType?.toUpperCase()} MATCH
                      </span>
                      <span style={{ fontSize: '12px', color: '#92400e', fontWeight: 600 }}>{group.recordIds.length} records clustered</span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    {group.records?.map((r: any, rIdx: number) => (
                      <div key={rIdx} style={{ padding: '10px 12px', background: '#fff', borderRadius: '6px', border: '1px solid #fde68a' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: rIdx === 0 ? '#047857' : '#b45309', marginBottom: '2px' }}>
                          {rIdx === 0 ? '★ Canonical Record (Retained)' : 'Candidate Duplicate'}
                        </div>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>{r.title}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {(r.authors || []).join('; ')} · {r.year} · DOI: {r.doi || 'None'}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={async () => {
                        const otherIds = group.recordIds.slice(1);
                        await fetch(`/api/systematic-reviews/${activeReview?._id}/duplicates/resolve`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ canonicalRecordId: group.canonicalRecordId, duplicateRecordIds: otherIds, action: 'merge' })
                        });
                        setMessage('Duplicate cluster merged into canonical record.');
                        activeReview && fetchDuplicates(activeReview._id);
                      }}
                      style={{ fontSize: '12px', fontWeight: 700, padding: '6px 14px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      Confirm Merge (Exclude Duplicate)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--rp-text-muted, #64748b)' }}>
              <CheckCircle2 size={36} style={{ color: '#059669', margin: '0 auto 10px' }} />
              <div style={{ fontWeight: 700 }}>No unresolved duplicate records detected.</div>
              <div style={{ fontSize: '12px' }}>All imported study records have distinct identifiers and titles.</div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: FULL-TEXT ELIGIBILITY */}
      {activeTab === 'full_text' && (
        <div className="card" style={{ padding: '24px 28px', borderRadius: '14px' }}>
          <div style={{ marginBottom: '18px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px' }}>Full-Text Eligibility Assessment</h2>
            <p style={{ fontSize: '12.5px', color: 'var(--rp-text-muted, #64748b)', margin: 0 }}>
              PRISMA 2020 requires reporting retrieval status and mandatory structured exclusion reasons for each rejected report.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {studies.filter(s => s.screeningStage === 'full_text' || s.screeningStage === 'included').map(s => (
              <div key={s._id} style={{ padding: '16px', border: '1px solid var(--rp-border, #e2e8f0)', borderRadius: '10px', background: 'var(--rp-surface, #ffffff)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <h3 style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--rp-text, #0f172a)', margin: '0 0 4px' }}>{s.title}</h3>
                    <div style={{ fontSize: '12px', color: 'var(--rp-text-muted, #64748b)' }}>
                      {(s.authors || []).join('; ')} · {s.journal} ({s.year})
                    </div>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: s.decision === 'included' ? '#ecfdf5' : '#fef2f2',
                    color: s.decision === 'included' ? '#047857' : '#b91c1c'
                  }}>
                    {s.decision.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '12px' }}>
                  {s.doi && (
                    <a
                      href={`https://doi.org/${s.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="button outline"
                      style={{ fontSize: '11.5px', padding: '5px 10px', textDecoration: 'none' }}
                    >
                      <ExternalLink size={12} style={{ marginRight: '4px' }} /> View Publisher PDF
                    </a>
                  )}

                  {s.decision !== 'included' && (
                    <button
                      className="primary"
                      onClick={() => handleFullTextDecision(s._id, 'included', '')}
                      style={{ fontSize: '11.5px', padding: '5px 12px', background: '#059669', borderColor: '#059669' }}
                    >
                      Mark Included
                    </button>
                  )}

                  <select
                    onChange={(e) => {
                      if (e.target.value) handleFullTextDecision(s._id, 'excluded', e.target.value);
                    }}
                    defaultValue=""
                    style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--rp-border, #cbd5e1)' }}
                  >
                    <option value="" disabled>Exclude with reason...</option>
                    <option value="Wrong Population (Non-HFpEF or age <18)">Wrong Population</option>
                    <option value="Wrong Intervention (Non-SGLT2 agent)">Wrong Intervention</option>
                    <option value="Wrong Comparator (Active non-standard control)">Wrong Comparator</option>
                    <option value="Wrong Study Design (Non-randomized or cohort)">Wrong Study Design</option>
                    <option value="Incomplete Outcome Data (Primary endpoint missing)">Incomplete Outcome Data</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: DATA EXTRACTION & RISK OF BIAS */}
      {activeTab === 'extraction_rob' && (
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px' }}>
          {/* Included Studies Selector */}
          <div className="card" style={{ padding: '20px', borderRadius: '14px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 8px' }}>Included Studies ({studies.filter(s => s.screeningStage === 'included').length})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {studies.filter(s => s.screeningStage === 'included').map(s => (
                <button
                  key={s._id}
                  onClick={() => setSelectedRoBStudyId(s._id)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: selectedRoBStudyId === s._id ? '2px solid var(--rp-accent, #6366f1)' : '1px solid var(--rp-border, #e2e8f0)',
                    background: selectedRoBStudyId === s._id ? 'var(--rp-accent-subtle, #eef2ff)' : 'var(--rp-surface, #ffffff)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--rp-text, #0f172a)' }}>{s.title.slice(0, 45)}...</div>
                  <div style={{ fontSize: '11px', color: 'var(--rp-text-muted, #64748b)' }}>{(s.authors || [])[0]} et al. ({s.year})</div>
                </button>
              ))}
            </div>
          </div>

          {/* RoB 2 Assessment Form */}
          <div className="card" style={{ padding: '24px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 4px' }}>Methodological Risk of Bias: {robTool}</h2>
                <p style={{ fontSize: '12px', color: 'var(--rp-text-muted, #64748b)', margin: 0 }}>
                  Evaluate standardized bias domains according to Cochrane Handbook guidelines.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['RoB 2', 'ROBINS-I', 'QUADAS-2'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setRobTool(t)}
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: robTool === t ? '1px solid var(--rp-accent, #6366f1)' : '1px solid var(--rp-border, #cbd5e1)',
                      background: robTool === t ? 'var(--rp-accent, #6366f1)' : 'var(--rp-surface, #ffffff)',
                      color: robTool === t ? '#fff' : 'var(--rp-text, #475569)',
                      cursor: 'pointer'
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              {[
                { id: 'D1', label: 'Domain 1: Bias arising from the randomization process' },
                { id: 'D2', label: 'Domain 2: Bias due to deviations from intended interventions' },
                { id: 'D3', label: 'Domain 3: Bias due to missing outcome data' },
                { id: 'D4', label: 'Domain 4: Bias in measurement of the outcome' },
                { id: 'D5', label: 'Domain 5: Bias in selection of the reported result' }
              ].map(d => (
                <div key={d.id} style={{ padding: '12px 14px', border: '1px solid var(--rp-border, #e2e8f0)', borderRadius: '8px', background: 'var(--rp-surface-subtle, #f8fafc)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--rp-text, #0f172a)' }}>{d.label}</span>
                    <select
                      value={robDomains[d.id]?.judgment || 'low'}
                      onChange={e => setRobDomains(prev => ({
                        ...prev,
                        [d.id]: { ...prev[d.id], judgment: e.target.value }
                      }))}
                      style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--rp-border, #cbd5e1)' }}
                    >
                      <option value="low">Low Risk</option>
                      <option value="some_concerns">Some Concerns</option>
                      <option value="high">High Risk</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder="Supporting quotation or rationale from manuscript..."
                    value={robDomains[d.id]?.supportText || ''}
                    onChange={e => setRobDomains(prev => ({
                      ...prev,
                      [d.id]: { ...prev[d.id], supportText: e.target.value }
                    }))}
                    style={{ width: '100%', padding: '6px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--rp-border, #cbd5e1)' }}
                  />
                </div>
              ))}
            </div>

            <button
              className="primary"
              onClick={handleSaveRiskOfBias}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Award size={15} /> Save Risk of Bias Assessment
            </button>
          </div>
        </div>
      )}

      {/* TAB 7: PRISMA 2020 FLOW DIAGRAM & CHECKLIST */}
      {activeTab === 'prisma_diagram' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* PRISMA SVG Flow Diagram Card */}
          <div className="card" style={{ padding: '24px 28px', borderRadius: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px' }}>PRISMA 2020 Flow Diagram</h2>
                <p style={{ fontSize: '12.5px', color: 'var(--rp-text-muted, #64748b)', margin: 0 }}>
                  Auto-reconciled count integrity across Identification, Screening, Retrieval, Eligibility, and Synthesis.
                </p>
              </div>
              <button
                className="button outline"
                onClick={() => {
                  const blob = new Blob([prismaSvg], { type: 'image/svg+xml' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `PRISMA_2020_${activeReview?._id || 'flow'}.svg`;
                  a.click();
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
              >
                <Download size={14} /> Download Diagram (SVG)
              </button>
            </div>

            <div
              dangerouslySetInnerHTML={{ __html: prismaSvg }}
              style={{
                width: '100%',
                maxHeight: '620px',
                border: '1px solid var(--rp-border, #e2e8f0)',
                borderRadius: '10px',
                padding: '16px',
                background: '#ffffff',
                overflow: 'auto'
              }}
            />
          </div>

          {/* PRISMA 2020 27-Item Checklist Tracker */}
          <div className="card" style={{ padding: '24px 28px', borderRadius: '14px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px' }}>PRISMA 2020 27-Item Reporting Checklist</h2>
            <p style={{ fontSize: '12.5px', color: 'var(--rp-text-muted, #64748b)', margin: '0 0 16px' }}>
              Ensure complete manuscript reporting compliance prior to journal submission.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {checklist.map(item => (
                <div key={item.item} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid var(--rp-border, #e2e8f0)', borderRadius: '8px', background: 'var(--rp-surface-subtle, #f8fafc)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--rp-accent, #6366f1)', minWidth: '32px' }}>#{item.item}</span>
                    <div>
                      <strong style={{ fontSize: '13px', color: 'var(--rp-text, #0f172a)' }}>{item.section} {item.topic ? `· ${item.topic}` : ''}:</strong>{' '}
                      <span style={{ fontSize: '12.5px', color: 'var(--rp-text-muted, #64748b)' }}>{item.description}</span>
                    </div>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: item.status === 'reported' ? '#ecfdf5' : '#f1f5f9',
                    color: item.status === 'reported' ? '#047857' : '#64748b'
                  }}>
                    {item.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
