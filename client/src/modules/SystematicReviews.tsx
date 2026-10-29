import { useState, useEffect } from 'react';
import { Layers, Plus, Check, X, Filter, FileText, ChevronRight } from 'lucide-react';

interface StudyRecord {
  _id: string;
  reviewId: string;
  title: string;
  authors: string[];
  year: string;
  journal: string;
  doi: string;
  abstract: string;
  screeningStage: string;
  decision: 'included' | 'excluded' | 'pending';
  exclusionReason?: string;
}

interface SystematicReviewData {
  _id: string;
  projectId: string;
  title: string;
  protocol: {
    population?: string;
    intervention?: string;
    comparison?: string;
    outcomes?: string;
    studyDesign?: string;
  };
  eligibility: {
    inclusionCriteria: string[];
    exclusionCriteria: string[];
  };
  prismaMetrics: {
    identified: number;
    duplicatesRemoved: number;
    screenedTitleAbstract: number;
    excludedTitleAbstract: number;
    assessedFullText: number;
    excludedFullText: number;
    includedInSynthesis: number;
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
  const [activeTab, setActiveTab] = useState<'screening' | 'protocol' | 'prisma'>('screening');
  const [exclusionReason, setExclusionReason] = useState('Wrong Population');

  const projectId = activeProject?._id;

  const fetchReviews = async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/systematic-reviews`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const list = await res.json();
        setReviews(list || []);
        if (list?.length > 0 && !activeReview) {
          setActiveReview(list[0]);
          fetchStudies(list[0]._id);
        }
      }
    } catch (err: any) {
      console.warn('Failed to load systematic reviews:', err.message);
    }
  };

  const fetchStudies = async (reviewId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/systematic-reviews/${reviewId}/studies`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const list = await res.json();
        setStudies(list || []);
      }
    } catch (err: any) {
      console.warn('Failed to load studies:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [projectId, token]);

  const handleCreateDefaultReview = async () => {
    if (!projectId) {
      setError('Please select or create an active project first.');
      return;
    }

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/systematic-reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: 'PRISMA 2020 Systematic Review Protocol',
          protocol: {
            population: 'Adults aged 18-65 diagnosed with mild-to-moderate depression',
            intervention: 'Digital cognitive behavioral therapy (dCBT) delivered via mobile app',
            comparison: 'Treatment as usual (TAU) or waitlist control',
            outcomes: 'Primary: PHQ-9 depression score at 8 and 12 weeks; Secondary: Retention rate',
            studyDesign: 'Randomized controlled trials (RCTs)'
          },
          eligibility: {
            inclusionCriteria: [
              'Peer-reviewed RCTs published between 2015 and 2026',
              'Standardized clinical outcome scale (PHQ-9, BDI-II)',
              'Minimum 4-week active intervention period'
            ],
            exclusionCriteria: [
              'Non-randomized observational designs',
              'Adolescent cohorts (<18 years old)',
              'Incomplete statistical reporting of post-intervention means'
            ]
          }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create review protocol');

      setMessage('PRISMA 2020 protocol initialized.');
      setReviews(prev => [data, ...prev]);
      setActiveReview(data);

      // Seed with initial candidate studies for screening
      await fetch(`/api/v1/projects/${projectId}/systematic-reviews/${data._id}/studies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          studies: [
            {
              title: 'Mobile app cognitive therapy vs waitlist in college students: A multi-center RCT',
              authors: ['Andrews, G.', 'Cuijpers, P.'],
              year: '2023',
              journal: 'Lancet Psychiatry',
              doi: '10.1016/S2215-0366(23)00112-X',
              abstract: 'Randomized controlled trial of 420 participants evaluated mobile dCBT against waitlist. Results showed significant PHQ-9 reductions (d = 0.68, p < .001).'
            },
            {
              title: 'Observational cohort tracking of digital mindfulness in adolescents',
              authors: ['Miller, S.', 'Kahn, T.'],
              year: '2022',
              journal: 'Journal of Adolescent Health',
              doi: '10.1016/j.jadohealth.2022.04.015',
              abstract: 'Naturalistic survey cohort of 150 teenagers using wellness apps without randomization.'
            },
            {
              title: 'Smartphone-guided behavioral activation versus TAU in primary care patients',
              authors: ['Carlbring, P.', 'Andersson, G.'],
              year: '2024',
              journal: 'JAMA Psychiatry',
              doi: '10.1001/jamapsychiatry.2024.0891',
              abstract: 'Double-blind RCT across 12 clinics comparing active mobile behavioral activation to standard GP care in 310 adult patients.'
            }
          ]
        })
      });

      fetchStudies(data._id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleScreenDecision = async (studyId: string, decision: 'included' | 'excluded') => {
    if (!activeReview) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/systematic-reviews/${activeReview._id}/studies/${studyId}/screen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          decision,
          reason: decision === 'excluded' ? exclusionReason : ''
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record screening decision');

      setStudies(prev => prev.map(s => s._id === studyId ? data : s));
      setMessage(`Study marked as ${decision.toUpperCase()}.`);

      // Refresh review PRISMA counts
      const prismaRes = await fetch(`/api/v1/projects/${projectId}/systematic-reviews/${activeReview._id}/prisma`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (prismaRes.ok) {
        const metrics = await prismaRes.json();
        setActiveReview({ ...activeReview, prismaMetrics: metrics });
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const pendingStudies = studies.filter(s => s.decision === 'pending');
  const screenedStudies = studies.filter(s => s.decision !== 'pending');

  return (
    <div className="module-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '4px' }}>
            <Layers size={20} />
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Module 6 · Systematic Review Assistant
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>
            PRISMA 2020 Systematic Review & Screening Flow
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', margin: '4px 0 0' }}>
            Manage PICOS protocols, title/abstract screening queues, exclusion tracking, and PRISMA flow diagrams.
          </p>
        </div>

        {!activeReview && (
          <button className="primary" onClick={handleCreateDefaultReview}>
            <Plus size={16} /> Initialize PRISMA Protocol
          </button>
        )}
      </div>

      {activeReview ? (
        <div>
          {/* Sub Navigation Tabs */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color, #e2e8f0)', marginBottom: '20px' }}>
            <button
              className={`filter-btn ${activeTab === 'screening' ? 'active' : ''}`}
              onClick={() => setActiveTab('screening')}
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              Screening Queue ({pendingStudies.length} Pending)
            </button>
            <button
              className={`filter-btn ${activeTab === 'prisma' ? 'active' : ''}`}
              onClick={() => setActiveTab('prisma')}
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              PRISMA 2020 Flow Diagram
            </button>
            <button
              className={`filter-btn ${activeTab === 'protocol' ? 'active' : ''}`}
              onClick={() => setActiveTab('protocol')}
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              PICOS Protocol & Criteria
            </button>
          </div>

          {/* SCREENING TAB */}
          {activeTab === 'screening' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 14px' }}>
                  Title & Abstract Screening Queue ({pendingStudies.length})
                </h3>

                {pendingStudies.length === 0 ? (
                  <div style={{
                    background: 'var(--card-bg, #ffffff)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '12px',
                    padding: '36px',
                    textAlign: 'center',
                    color: 'var(--muted)'
                  }}>
                    <Check size={36} style={{ color: '#16a34a', margin: '0 auto 8px' }} />
                    <h4 style={{ margin: '0 0 4px', color: 'var(--text-main)' }}>Screening Queue Completed</h4>
                    <p style={{ margin: 0, fontSize: '12px' }}>All candidate studies have been evaluated against your protocol criteria.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {pendingStudies.map(study => (
                      <div key={study._id} style={{
                        background: 'var(--card-bg, #ffffff)',
                        border: '1px solid var(--border-color, #e2e8f0)',
                        borderRadius: '12px',
                        padding: '20px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                            {study.title}
                          </h4>
                          <span style={{ fontSize: '11px', background: 'var(--surface2)', padding: '2px 8px', borderRadius: '4px', color: 'var(--muted)' }}>
                            {study.year || 'n.d.'} · {study.journal}
                          </span>
                        </div>

                        <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 10px', fontStyle: 'italic' }}>
                          Authors: {(study.authors || []).join(', ')}
                        </p>

                        <div style={{
                          background: 'var(--surface2)',
                          padding: '12px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          lineHeight: '1.6',
                          color: 'var(--text-main)',
                          marginBottom: '16px'
                        }}>
                          {study.abstract || 'No abstract text available for this candidate record.'}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>If Excluded:</span>
                            <select
                              value={exclusionReason}
                              onChange={e => setExclusionReason(e.target.value)}
                              style={{ fontSize: '12px', padding: '4px 8px' }}
                            >
                              <option value="Wrong Population">Wrong Population / Non-Clinical</option>
                              <option value="Wrong Intervention">Wrong Intervention / Non-dCBT</option>
                              <option value="Non-Randomized Design">Non-Randomized Design</option>
                              <option value="Incomplete Statistics">Incomplete Statistics / No Baseline</option>
                              <option value="Outdated Sample">Outdated Sample / Pre-2015</option>
                            </select>
                          </div>

                          <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                              className="secondary"
                              onClick={() => handleScreenDecision(study._id, 'excluded')}
                              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626' }}
                            >
                              <X size={15} /> Exclude
                            </button>
                            <button
                              className="primary"
                              onClick={() => handleScreenDecision(study._id, 'included')}
                              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              <Check size={15} /> Include in Review
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Screened Studies Log */}
              <div style={{
                background: 'var(--card-bg, #ffffff)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '12px',
                padding: '18px',
                height: 'fit-content'
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px' }}>
                  Decision Audit Log ({screenedStudies.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '450px', overflowY: 'auto' }}>
                  {screenedStudies.map(s => (
                    <div key={s._id} style={{
                      padding: '10px',
                      borderRadius: '8px',
                      background: 'var(--surface2)',
                      borderLeft: `4px solid ${s.decision === 'included' ? '#16a34a' : '#dc2626'}`,
                      fontSize: '11px'
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: '2px' }}>{s.title.slice(0, 50)}...</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
                        <span style={{ fontWeight: 700, color: s.decision === 'included' ? '#16a34a' : '#dc2626' }}>
                          {s.decision.toUpperCase()}
                        </span>
                        {s.exclusionReason && <span>{s.exclusionReason}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PRISMA 2020 DIAGRAM TAB */}
          {activeTab === 'prisma' && (
            <div style={{
              background: 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '12px',
              padding: '32px',
              maxWidth: '800px',
              margin: '0 auto'
            }}>
              <h3 style={{ textAlign: 'center', margin: '0 0 24px', fontSize: '18px', fontWeight: 800 }}>
                PRISMA 2020 Flow Diagram
              </h3>

              {/* Flow Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                {/* Identification */}
                <div style={{
                  width: '100%',
                  background: '#eff6ff',
                  border: '2px solid #3b82f6',
                  borderRadius: '10px',
                  padding: '16px',
                  textAlign: 'center'
                }}>
                  <strong style={{ fontSize: '13px', color: '#1e40af' }}>1. Identification</strong>
                  <div style={{ fontSize: '18px', fontWeight: 800, marginTop: '4px' }}>
                    Records Identified: {activeReview.prismaMetrics?.identified || studies.length}
                  </div>
                </div>

                <div style={{ fontSize: '20px', color: 'var(--muted)' }}>↓</div>

                {/* Screening */}
                <div style={{
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px'
                }}>
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '14px',
                    textAlign: 'center'
                  }}>
                    <strong style={{ fontSize: '12px' }}>Records Screened</strong>
                    <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '4px' }}>
                      {screenedStudies.length}
                    </div>
                  </div>
                  <div style={{
                    background: '#fee2e2',
                    border: '1px solid #f87171',
                    borderRadius: '10px',
                    padding: '14px',
                    textAlign: 'center'
                  }}>
                    <strong style={{ fontSize: '12px', color: '#991b1b' }}>Records Excluded</strong>
                    <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '4px', color: '#dc2626' }}>
                      {studies.filter(s => s.decision === 'excluded').length}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '20px', color: 'var(--muted)' }}>↓</div>

                {/* Included */}
                <div style={{
                  width: '100%',
                  background: '#dcfce7',
                  border: '2px solid #22c55e',
                  borderRadius: '10px',
                  padding: '16px',
                  textAlign: 'center'
                }}>
                  <strong style={{ fontSize: '13px', color: '#15803d' }}>3. Included in Synthesis</strong>
                  <div style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px', color: '#166534' }}>
                    Studies Included: {studies.filter(s => s.decision === 'included').length}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PROTOCOL TAB */}
          {activeTab === 'protocol' && (
            <div style={{
              background: 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '12px',
              padding: '24px'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px' }}>
                PICOS Systematic Review Protocol
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'var(--surface2)', padding: '14px', borderRadius: '8px' }}>
                  <small style={{ color: 'var(--muted)', fontWeight: 700 }}>Population (P)</small>
                  <p style={{ margin: '4px 0 0', fontSize: '13px' }}>{activeReview.protocol?.population || 'Not specified'}</p>
                </div>
                <div style={{ background: 'var(--surface2)', padding: '14px', borderRadius: '8px' }}>
                  <small style={{ color: 'var(--muted)', fontWeight: 700 }}>Intervention (I)</small>
                  <p style={{ margin: '4px 0 0', fontSize: '13px' }}>{activeReview.protocol?.intervention || 'Not specified'}</p>
                </div>
                <div style={{ background: 'var(--surface2)', padding: '14px', borderRadius: '8px' }}>
                  <small style={{ color: 'var(--muted)', fontWeight: 700 }}>Comparison (C)</small>
                  <p style={{ margin: '4px 0 0', fontSize: '13px' }}>{activeReview.protocol?.comparison || 'Not specified'}</p>
                </div>
                <div style={{ background: 'var(--surface2)', padding: '14px', borderRadius: '8px' }}>
                  <small style={{ color: 'var(--muted)', fontWeight: 700 }}>Outcomes (O)</small>
                  <p style={{ margin: '4px 0 0', fontSize: '13px' }}>{activeReview.protocol?.outcomes || 'Not specified'}</p>
                </div>
              </div>

              <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 10px' }}>Eligibility Criteria</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '14px', borderRadius: '8px' }}>
                  <strong style={{ fontSize: '12px', color: '#166534' }}>Inclusion Criteria</strong>
                  <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '12px', lineHeight: '1.6' }}>
                    {activeReview.eligibility?.inclusionCriteria?.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '14px', borderRadius: '8px' }}>
                  <strong style={{ fontSize: '12px', color: '#991b1b' }}>Exclusion Criteria</strong>
                  <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '12px', lineHeight: '1.6' }}>
                    {activeReview.eligibility?.exclusionCriteria?.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px dashed var(--border-color, #cbd5e1)',
          borderRadius: '12px',
          padding: '48px',
          textAlign: 'center',
          color: 'var(--muted)'
        }}>
          <Layers size={40} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
          <h3 style={{ margin: '0 0 6px', color: 'var(--text-main)' }}>No Systematic Review Active</h3>
          <p style={{ margin: '0 0 16px', fontSize: '13px' }}>
            Initialize a PRISMA 2020 review protocol to begin title and abstract screening.
          </p>
          <button className="primary" onClick={handleCreateDefaultReview}>
            Initialize PRISMA Protocol
          </button>
        </div>
      )}
    </div>
  );
}
