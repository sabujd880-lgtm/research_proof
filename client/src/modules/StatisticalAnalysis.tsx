import { useState, useEffect } from 'react';
import { Activity, Upload, Play, Check, Copy, FileText, ArrowRight, Table, BarChart2 } from 'lucide-react';

interface Dataset {
  _id: string;
  projectId: string;
  name: string;
  fileName: string;
  rowCount: number;
  columnCount: number;
  columns: { name: string; type: 'numeric' | 'categorical'; sampleValues: any[] }[];
}

interface StatisticalAnalysisProps {
  token: string;
  activeProject: any;
  setSection: (section: string) => void;
  setMessage: (msg: string) => void;
  setError: (err: string) => void;
  onSendToStudio?: (text: string) => void;
}

export default function StatisticalAnalysis({
  token,
  activeProject,
  setSection,
  setMessage,
  setError,
  onSendToStudio
}: StatisticalAnalysisProps) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDataset, setActiveDataset] = useState<Dataset | null>(null);
  const [analysisType, setAnalysisType] = useState<string>('descriptive');
  const [varX, setVarX] = useState<string>('');
  const [varY, setVarY] = useState<string>('');
  const [groupVar, setGroupVar] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);

  const projectId = activeProject?._id;

  const fetchDatasets = async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/datasets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const list = await res.json();
        setDatasets(list || []);
        if (list?.length > 0 && !activeDataset) {
          setActiveDataset(list[0]);
          initVars(list[0]);
        }
      }
    } catch (err: any) {
      console.warn('Failed to load datasets:', err.message);
    }
  };

  const initVars = (ds: Dataset) => {
    const numCols = ds.columns.filter(c => c.type === 'numeric');
    const catCols = ds.columns.filter(c => c.type === 'categorical');
    if (numCols.length > 0) setVarX(numCols[0].name);
    if (numCols.length > 1) setVarY(numCols[1].name);
    if (catCols.length > 0) setGroupVar(catCols[0].name);
  };

  useEffect(() => {
    fetchDatasets();
  }, [projectId, token]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name.replace(/\.[^/.]+$/, ''));

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/datasets`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload dataset');

      setMessage(`Uploaded dataset "${data.name}" (${data.rowCount} rows, ${data.columnCount} columns).`);
      setDatasets(prev => [data, ...prev]);
      setActiveDataset(data);
      initVars(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLoadSampleData = async () => {
    if (!projectId) {
      setError('Please select or create an active project first.');
      return;
    }

    // Generate sample physiological/educational research data
    const sampleRows = [];
    for (let i = 1; i <= 60; i++) {
      const isIntervention = i <= 30;
      const baselineScore = 50 + Math.floor(Math.random() * 20);
      const postScore = baselineScore + (isIntervention ? 12 + Math.floor(Math.random() * 10) : 2 + Math.floor(Math.random() * 6));
      const latencyMs = isIntervention ? 320 + Math.floor(Math.random() * 40) : 410 + Math.floor(Math.random() * 50);

      sampleRows.push({
        ParticipantId: `P${i.toString().padStart(3, '0')}`,
        Condition: isIntervention ? 'AdaptiveAI' : 'StandardControl',
        PreTestScore: baselineScore,
        PostTestScore: postScore,
        LatencyMs: latencyMs
      });
    }

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/datasets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: 'Empirical Intervention Trial',
          rows: sampleRows
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load sample data');

      setMessage('Sample experimental dataset loaded successfully.');
      setDatasets(prev => [data, ...prev]);
      setActiveDataset(data);
      initVars(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRunAnalysis = async () => {
    if (!projectId || !activeDataset) {
      setError('Please select a dataset to analyze.');
      return;
    }

    setRunning(true);
    setAnalysisResult(null);

    try {
      const payload: any = {
        analysisType,
        varX,
        varY: ['independent_t_test', 'paired_t_test', 'pearson_correlation', 'spearman_correlation', 'linear_regression'].includes(analysisType) ? varY : undefined,
        groupVar: ['one_way_anova', 'independent_t_test'].includes(analysisType) ? groupVar : undefined
      };

      const res = await fetch(`/api/v1/projects/${projectId}/datasets/${activeDataset._id}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis computation failed');

      setAnalysisResult(data);
      setMessage(`Computed exact ${data.analysisType} without hallucinations.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const numericCols = activeDataset?.columns.filter(c => c.type === 'numeric') || [];
  const catCols = activeDataset?.columns.filter(c => c.type === 'categorical') || [];

  return (
    <div className="module-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', marginBottom: '4px' }}>
            <Activity size={20} />
            <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Module 5 · Statistical Analysis Studio
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0 }}>
            Transparent Numerical Statistical Engine
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px', margin: '4px 0 0' }}>
            Deterministic, mathematical statistics (t-Test, ANOVA, Correlation, Regression) with automatic APA 7 reporting.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="secondary"
            onClick={handleLoadSampleData}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Table size={16} />
            Load Sample Dataset
          </button>
          <label className="button primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0 }}>
            <Upload size={16} />
            {uploading ? 'Ingesting...' : 'Upload CSV / Excel'}
            <input
              type="file"
              accept=".csv,.xlsx,.json"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
        {/* Left Column: Dataset & Variable Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Active Dataset Card */}
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '12px',
            padding: '18px'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px' }}>Active Dataset</h3>
            {datasets.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>
                No datasets in project. Click "Upload CSV" or "Load Sample Dataset".
              </div>
            ) : (
              <div>
                <select
                  value={activeDataset?._id || ''}
                  onChange={(e) => {
                    const ds = datasets.find(d => d._id === e.target.value);
                    if (ds) {
                      setActiveDataset(ds);
                      initVars(ds);
                    }
                  }}
                  style={{ width: '100%', marginBottom: '12px' }}
                >
                  {datasets.map(d => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.rowCount} rows)
                    </option>
                  ))}
                </select>

                {activeDataset && (
                  <div style={{ fontSize: '11px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Observations (N):</span>
                      <strong>{activeDataset.rowCount}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Variables:</span>
                      <strong>{activeDataset.columnCount}</strong>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test Configuration */}
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '12px',
            padding: '18px'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 14px' }}>Analysis Configuration</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Statistical Test
                </label>
                <select
                  value={analysisType}
                  onChange={e => setAnalysisType(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="descriptive">Descriptive Statistics</option>
                  <option value="independent_t_test">Independent Two-Sample t-Test</option>
                  <option value="paired_t_test">Paired-Samples t-Test</option>
                  <option value="one_way_anova">One-Way ANOVA (F-Test)</option>
                  <option value="pearson_correlation">Pearson Correlation (r)</option>
                  <option value="spearman_correlation">Spearman Rank Correlation (rho)</option>
                  <option value="linear_regression">Simple Linear Regression</option>
                </select>
              </div>

              {/* Variable X */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Primary Variable (X)
                </label>
                <select
                  value={varX}
                  onChange={e => setVarX(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {numericCols.map(c => (
                    <option key={c.name} value={c.name}>{c.name} (Numeric)</option>
                  ))}
                </select>
              </div>

              {/* Variable Y (for 2-variable tests) */}
              {['independent_t_test', 'paired_t_test', 'pearson_correlation', 'spearman_correlation', 'linear_regression'].includes(analysisType) && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    {analysisType === 'linear_regression' ? 'Outcome Variable (Y)' : 'Comparison Variable (Y)'}
                  </label>
                  <select
                    value={varY}
                    onChange={e => setVarY(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {numericCols.filter(c => c.name !== varX).map(c => (
                      <option key={c.name} value={c.name}>{c.name} (Numeric)</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Group Variable (for ANOVA or grouped t-test) */}
              {['one_way_anova', 'independent_t_test'].includes(analysisType) && catCols.length > 0 && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                    Grouping Factor (Optional)
                  </label>
                  <select
                    value={groupVar}
                    onChange={e => setGroupVar(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">None / Compare 2 Variables</option>
                    {catCols.map(c => (
                      <option key={c.name} value={c.name}>{c.name} (Categorical)</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                className="primary"
                onClick={handleRunAnalysis}
                disabled={running || !activeDataset}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '8px' }}
              >
                <Play size={16} />
                {running ? 'Calculating...' : 'Run Statistical Computation'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Results & APA Narrative */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {analysisResult ? (
            <div style={{
              background: 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '12px',
              padding: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--primary)', fontWeight: 700 }}>
                    Deterministic Mathematical Output
                  </span>
                  <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '2px 0 0', textTransform: 'capitalize' }}>
                    {analysisResult.analysisType.replace(/_/g, ' ')}
                  </h2>
                </div>
                {analysisResult.results?.significant !== undefined && (
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '4px 12px',
                    borderRadius: '20px',
                    background: analysisResult.results.significant ? '#dcfce7' : '#fee2e2',
                    color: analysisResult.results.significant ? '#166534' : '#991b1b'
                  }}>
                    {analysisResult.results.significant ? 'p < .05 (Statistically Significant)' : 'p ≥ .05 (Not Significant)'}
                  </span>
                )}
              </div>

              {/* Exact Metrics Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '12px',
                marginBottom: '20px'
              }}>
                {analysisResult.results?.t !== undefined && (
                  <div style={{ background: 'var(--surface2)', padding: '12px', borderRadius: '8px' }}>
                    <small style={{ color: 'var(--muted)', fontSize: '10px' }}>t-Statistic</small>
                    <div style={{ fontSize: '18px', fontWeight: 800 }}>{analysisResult.results.t}</div>
                  </div>
                )}
                {analysisResult.results?.f !== undefined && (
                  <div style={{ background: 'var(--surface2)', padding: '12px', borderRadius: '8px' }}>
                    <small style={{ color: 'var(--muted)', fontSize: '10px' }}>F-Ratio</small>
                    <div style={{ fontSize: '18px', fontWeight: 800 }}>{analysisResult.results.f}</div>
                  </div>
                )}
                {analysisResult.results?.r !== undefined && (
                  <div style={{ background: 'var(--surface2)', padding: '12px', borderRadius: '8px' }}>
                    <small style={{ color: 'var(--muted)', fontSize: '10px' }}>Correlation (r)</small>
                    <div style={{ fontSize: '18px', fontWeight: 800 }}>{analysisResult.results.r}</div>
                  </div>
                )}
                {analysisResult.results?.pValue !== undefined && (
                  <div style={{ background: 'var(--surface2)', padding: '12px', borderRadius: '8px' }}>
                    <small style={{ color: 'var(--muted)', fontSize: '10px' }}>p-Value</small>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: analysisResult.results.significant ? '#16a34a' : 'inherit' }}>
                      {analysisResult.results.pValue < 0.001 ? '< .001' : analysisResult.results.pValue}
                    </div>
                  </div>
                )}
                {analysisResult.results?.cohensD !== undefined && (
                  <div style={{ background: 'var(--surface2)', padding: '12px', borderRadius: '8px' }}>
                    <small style={{ color: 'var(--muted)', fontSize: '10px' }}>Cohen's d</small>
                    <div style={{ fontSize: '18px', fontWeight: 800 }}>{analysisResult.results.cohensD}</div>
                  </div>
                )}
                {analysisResult.results?.rSquared !== undefined && (
                  <div style={{ background: 'var(--surface2)', padding: '12px', borderRadius: '8px' }}>
                    <small style={{ color: 'var(--muted)', fontSize: '10px' }}>R² (Variance)</small>
                    <div style={{ fontSize: '18px', fontWeight: 800 }}>{analysisResult.results.rSquared}</div>
                  </div>
                )}
                {analysisResult.results?.mean !== undefined && (
                  <div style={{ background: 'var(--surface2)', padding: '12px', borderRadius: '8px' }}>
                    <small style={{ color: 'var(--muted)', fontSize: '10px' }}>Mean (M)</small>
                    <div style={{ fontSize: '18px', fontWeight: 800 }}>{analysisResult.results.mean}</div>
                  </div>
                )}
                {analysisResult.results?.stdDev !== undefined && (
                  <div style={{ background: 'var(--surface2)', padding: '12px', borderRadius: '8px' }}>
                    <small style={{ color: 'var(--muted)', fontSize: '10px' }}>Std Dev (SD)</small>
                    <div style={{ fontSize: '18px', fontWeight: 800 }}>{analysisResult.results.stdDev}</div>
                  </div>
                )}
              </div>

              {/* APA 7th Edition Narrative Box */}
              <div style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    APA 7th Edition Manuscript Reporting Sentence
                  </strong>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="icon-button"
                      onClick={() => {
                        navigator.clipboard.writeText(analysisResult.apaReport);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                    </button>
                    {onSendToStudio && (
                      <button
                        className="primary small"
                        onClick={() => onSendToStudio(`\n\n${analysisResult.apaReport}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <FileText size={14} /> Insert into Manuscript <ArrowRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', fontStyle: 'italic', color: 'var(--text-main)' }}>
                  "{analysisResult.apaReport}"
                </p>
              </div>
            </div>
          ) : (
            <div style={{
              background: 'var(--card-bg, #ffffff)',
              border: '1px dashed var(--border-color, #cbd5e1)',
              borderRadius: '12px',
              padding: '48px 24px',
              textAlign: 'center',
              color: 'var(--muted)'
            }}>
              <BarChart2 size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <h3 style={{ margin: '0 0 6px', color: 'var(--text-main)' }}>No analysis executed yet</h3>
              <p style={{ margin: 0, fontSize: '13px' }}>
                Select your test type and variables on the left, then click "Run Statistical Computation".
              </p>
            </div>
          )}

          {/* Dataset Variable Inspection Preview */}
          {activeDataset && (
            <div style={{
              background: 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '12px',
              padding: '18px'
            }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 10px' }}>
                Detected Dataset Columns ({activeDataset.columns.length})
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {activeDataset.columns.map(col => (
                  <div key={col.name} style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: 'var(--surface2)',
                    border: '1px solid var(--border-color)',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <strong>{col.name}</strong>
                    <span style={{
                      fontSize: '9px',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: col.type === 'numeric' ? '#dbeafe' : '#fef3c7',
                      color: col.type === 'numeric' ? '#1e40af' : '#92400e',
                      textTransform: 'uppercase',
                      fontWeight: 700
                    }}>
                      {col.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
