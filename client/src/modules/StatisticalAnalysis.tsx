import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity, Upload, Play, Check, Copy, FileText, ArrowRight, Table, BarChart2,
  SlidersHorizontal, Database, RefreshCw, AlertCircle, CheckCircle2, ChevronRight,
  TrendingUp, Layers, HelpCircle, Download, FileSpreadsheet, Sparkles, Filter,
  ArrowUpDown, Eye, Trash2
} from 'lucide-react';

export interface ColumnMeta {
  name: string;
  type: 'numeric' | 'categorical';
  measurementLevel?: 'scale' | 'ordinal' | 'nominal';
  missingCount?: number;
  uniqueCount?: number;
  sampleValues?: any[];
}

export interface Dataset {
  _id: string;
  id?: string;
  projectId: string;
  name: string;
  fileName?: string;
  originalFilename?: string;
  fileType?: string;
  rowCount: number;
  columnCount: number;
  missingValueCount?: number;
  status?: string;
  currentVersionNumber?: number;
  columns: ColumnMeta[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DatasetVersion {
  _id: string;
  versionNumber: number;
  transformationSummary?: string;
  rowCount: number;
  columnCount: number;
  createdAt: string;
}

export interface StatisticalAnalysisProps {
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
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'data' | 'wizard' | 'results'>('overview');

  // Datasets State
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDataset, setActiveDataset] = useState<Dataset | null>(null);
  const [datasetRows, setDatasetRows] = useState<any[]>([]);
  const [datasetVersions, setDatasetVersions] = useState<DatasetVersion[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Analysis Wizard State
  const [analysisType, setAnalysisType] = useState<string>('descriptive');
  const [analysisTitle, setAnalysisTitle] = useState<string>('');
  const [dvKey, setDvKey] = useState<string>('');
  const [ivKeys, setIvKeys] = useState<string[]>([]);
  const [groupVar, setGroupVar] = useState<string>('');
  const [factorB, setFactorB] = useState<string>('');
  const [mu0, setMu0] = useState<number>(0);
  const [confidenceLevel, setConfidenceLevel] = useState<number>(0.95);
  const [missingDataPolicy, setMissingDataPolicy] = useState<'exclude_listwise' | 'exclude_pairwise'>('exclude_listwise');
  const [checkAssumptions, setCheckAssumptions] = useState<boolean>(true);
  const [running, setRunning] = useState(false);

  // Results State
  const [currentResult, setCurrentResult] = useState<any>(null);
  const [pastAnalyses, setPastAnalyses] = useState<any[]>([]);
  const [activeChartType, setActiveChartType] = useState<'histogram' | 'boxplot' | 'scatter' | 'qq' | 'heatmap'>('histogram');
  const [copied, setCopied] = useState(false);

  // Transformation Dialog State
  const [transforming, setTransforming] = useState(false);
  const [transformMethod, setTransformMethod] = useState<'impute_mean' | 'impute_median' | 'standardize_z' | 'log_transform'>('impute_mean');
  const [transformTargetCol, setTransformTargetCol] = useState<string>('');

  const projectId = activeProject?._id;

  // ==========================================================================
  // Ingestion & Fetching
  // ==========================================================================
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
          selectDataset(list[0]);
        }
      }
    } catch (err: any) {
      console.warn('Failed to load datasets:', err.message);
    }
  };

  const selectDataset = async (ds: Dataset) => {
    setActiveDataset(ds);
    initVariableDefaults(ds);
    fetchDatasetPreview(ds._id);
    fetchDatasetVersions(ds._id);
  };

  const fetchDatasetPreview = async (datasetId: string) => {
    setLoadingData(true);
    try {
      const res = await fetch(`/api/v1/statistics/datasets/${datasetId}/preview?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDatasetRows(data.rows || []);
      } else {
        // Fallback to legacy GET dataset
        const fallbackRes = await fetch(`/api/v1/statistics/datasets/${datasetId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (fallbackRes.ok) {
          const fbData = await fallbackRes.json();
          setDatasetRows(fbData.data || fbData.rows || []);
        }
      }
    } catch (err: any) {
      console.warn('Error fetching dataset preview:', err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchDatasetVersions = async (datasetId: string) => {
    try {
      const res = await fetch(`/api/v1/statistics/datasets/${datasetId}/versions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const vList = await res.json();
        setDatasetVersions(vList || []);
      }
    } catch (err) {
      console.warn('Versions not available');
    }
  };

  const fetchPastAnalyses = async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/v1/statistics/analyses?projectId=${projectId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPastAnalyses(data.analyses || data || []);
      }
    } catch (err) {
      console.warn('Could not fetch past analyses');
    }
  };

  const initVariableDefaults = (ds: Dataset) => {
    const numCols = ds.columns?.filter(c => c.type === 'numeric') || [];
    const catCols = ds.columns?.filter(c => c.type === 'categorical') || [];
    if (numCols.length > 0) {
      setDvKey(numCols[0].name);
      setTransformTargetCol(numCols[0].name);
      if (numCols.length > 1) {
        setIvKeys([numCols[1].name]);
      } else {
        setIvKeys([]);
      }
    }
    if (catCols.length > 0) {
      setGroupVar(catCols[0].name);
      if (catCols.length > 1) setFactorB(catCols[1].name);
    }
  };

  useEffect(() => {
    fetchDatasets();
    fetchPastAnalyses();
  }, [projectId, token]);

  // ==========================================================================
  // Dataset Upload & Sample Generation
  // ==========================================================================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    formData.append('name', file.name.replace(/\.[^/.]+$/, ''));

    try {
      const res = await fetch(`/api/v1/statistics/datasets/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload dataset');

      setMessage(`Uploaded dataset "${data.name}" (${data.rowCount} rows, ${data.columnCount} columns).`);
      setDatasets(prev => [data, ...prev]);
      selectDataset(data);
      setActiveTab('data');
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

    const sampleRows = [];
    for (let i = 1; i <= 80; i++) {
      const isAI = i <= 40;
      const preScore = Math.round(52 + Math.random() * 18);
      const postScore = Math.round(preScore + (isAI ? 14 + Math.random() * 9 : 3 + Math.random() * 5));
      const reactionMs = Math.round(isAI ? 310 + Math.random() * 45 : 395 + Math.random() * 60);
      const retentionLevel = isAI ? (Math.random() > 0.3 ? 'High' : 'Medium') : (Math.random() > 0.6 ? 'Medium' : 'Low');
      const cohort = i % 2 === 0 ? 'Spring' : 'Autumn';

      sampleRows.push({
        ParticipantId: `P${i.toString().padStart(3, '0')}`,
        Condition: isAI ? 'AdaptiveAI' : 'StandardControl',
        Cohort: cohort,
        RetentionLevel: retentionLevel,
        PreScore: preScore,
        PostScore: postScore,
        ReactionMs: reactionMs,
        GainScore: postScore - preScore
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
          name: 'Cognitive Intervention Trial (N=80)',
          rows: sampleRows
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load sample data');

      setMessage('Empirical research dataset (N=80) initialized successfully.');
      setDatasets(prev => [data, ...prev]);
      selectDataset(data);
      setActiveTab('data');
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ==========================================================================
  // Variable Level Mutation & Data Cleaning Transformation
  // ==========================================================================
  const handleUpdateMeasurementLevel = async (varName: string, level: 'scale' | 'ordinal' | 'nominal') => {
    if (!activeDataset) return;
    try {
      const res = await fetch(`/api/v1/statistics/datasets/${activeDataset._id}/variables/${encodeURIComponent(varName)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ measurementLevel: level })
      });
      if (res.ok) {
        setActiveDataset(prev => {
          if (!prev) return null;
          return {
            ...prev,
            columns: prev.columns.map(c => c.name === varName ? { ...c, measurementLevel: level } : c)
          };
        });
        setMessage(`Updated variable "${varName}" level to ${level.toUpperCase()}.`);
      }
    } catch (err: any) {
      setError('Failed to update variable measurement level.');
    }
  };

  const handleApplyTransformation = async () => {
    if (!activeDataset) return;
    setTransforming(true);
    try {
      const transformations = [{
        operation: transformMethod,
        column: transformTargetCol
      }];
      const res = await fetch(`/api/v1/statistics/datasets/${activeDataset._id}/transform`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          transformations,
          summary: `${transformMethod.replace('_', ' ')} applied to ${transformTargetCol}`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transformation failed');

      setMessage(`Transformation applied. Dataset updated to Version ${data.currentVersionNumber || 2}.`);
      if (data.dataset) {
        selectDataset(data.dataset);
      } else {
        fetchDatasetPreview(activeDataset._id);
        fetchDatasetVersions(activeDataset._id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTransforming(false);
    }
  };

  // ==========================================================================
  // Statistical Execution
  // ==========================================================================
  const handleRunAnalysis = async () => {
    if (!activeDataset) {
      setError('Please select or upload a dataset first.');
      return;
    }
    if (!dvKey) {
      setError('Please designate at least one primary variable.');
      return;
    }

    setRunning(true);
    setCurrentResult(null);

    const title = analysisTitle.trim() || `${analysisType.replace(/_/g, ' ').toUpperCase()} on ${dvKey}`;
    const payload: any = {
      datasetId: activeDataset._id,
      analysisType,
      title,
      variables: {
        dependent: dvKey,
        independents: ivKeys,
        groupFactor: groupVar,
        factorB: ['two_way_anova'].includes(analysisType) ? factorB : undefined,
        varX: dvKey,
        varY: ivKeys.length > 0 ? ivKeys[0] : undefined
      },
      parameters: {
        mu0,
        confidenceLevel,
        checkAssumptions,
        missingDataPolicy
      }
    };

    try {
      const res = await fetch(`/api/v1/statistics/analyses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Statistical computation failed');

      setCurrentResult(data);
      setPastAnalyses(prev => [data, ...prev]);
      setActiveTab('results');
      setMessage(`Computed exact ${data.analysisType.replace(/_/g, ' ')} with validated numerical engine.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  // Data helpers
  const numericCols = useMemo(() => activeDataset?.columns.filter(c => c.type === 'numeric') || [], [activeDataset]);
  const catCols = useMemo(() => activeDataset?.columns.filter(c => c.type === 'categorical') || [], [activeDataset]);

  // Derived numeric series for rendering scientific charts
  const activeSeries = useMemo(() => {
    if (!datasetRows.length || !dvKey) return [];
    return datasetRows.map(r => Number(r[dvKey])).filter(v => !isNaN(v));
  }, [datasetRows, dvKey]);

  const activeSeriesY = useMemo(() => {
    if (!datasetRows.length || !ivKeys.length) return [];
    return datasetRows.map(r => Number(r[ivKeys[0]])).filter(v => !isNaN(v));
  }, [datasetRows, ivKeys]);

  // ==========================================================================
  // Scientific Chart Renderers (Pure SVG Vector Graphics)
  // ==========================================================================
  const renderHistogram = () => {
    if (activeSeries.length < 3) return <div className="text-center p-8 text-sm text-gray-500">Need at least 3 data points</div>;
    const n = activeSeries.length;
    const min = Math.min(...activeSeries);
    const max = Math.max(...activeSeries);
    const mean = activeSeries.reduce((a, b) => a + b, 0) / n;
    const variance = activeSeries.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
    const sd = Math.sqrt(variance);

    const binCount = Math.min(15, Math.max(5, Math.ceil(Math.log2(n) + 1)));
    const binWidth = (max - min) / binCount || 1;
    const bins = new Array(binCount).fill(0);

    activeSeries.forEach(val => {
      const idx = Math.min(binCount - 1, Math.floor((val - min) / binWidth));
      bins[idx]++;
    });
    const maxBin = Math.max(...bins, 1);

    const width = 600;
    const height = 280;
    const padding = 45;

    // Normal curve overlay coordinates
    const curvePoints: string[] = [];
    const steps = 50;
    for (let i = 0; i <= steps; i++) {
      const xVal = min + (i / steps) * (max - min);
      const z = (xVal - mean) / (sd || 1);
      const density = (1 / ((sd || 1) * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
      // scale density to max bin height
      const scaledHeight = (density * n * binWidth / maxBin) * (height - 2 * padding);
      const svgX = padding + (i / steps) * (width - 2 * padding);
      const svgY = (height - padding) - scaledHeight;
      curvePoints.push(`${svgX.toFixed(1)},${svgY.toFixed(1)}`);
    }

    return (
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', background: '#fafafa', borderRadius: '8px' }}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = height - padding - pct * (height - 2 * padding);
            return (
              <g key={i}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
                <text x={padding - 6} y={y + 4} fontSize="10" textAnchor="end" fill="#64748b">
                  {Math.round(pct * maxBin)}
                </text>
              </g>
            );
          })}

          {/* Histogram Bars */}
          {bins.map((count, idx) => {
            const barW = (width - 2 * padding) / binCount - 3;
            const barH = (count / maxBin) * (height - 2 * padding);
            const x = padding + idx * ((width - 2 * padding) / binCount) + 1.5;
            const y = height - padding - barH;
            return (
              <g key={idx}>
                <rect x={x} y={y} width={barW} height={barH} fill="#3b82f6" rx="2" opacity="0.85" />
                {count > 0 && (
                  <text x={x + barW / 2} y={y - 4} fontSize="10" textAnchor="middle" fill="#1e40af" fontWeight="600">
                    {count}
                  </text>
                )}
                <text x={x + barW / 2} y={height - padding + 14} fontSize="9" textAnchor="middle" fill="#64748b">
                  {(min + idx * binWidth).toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Theoretical Normal Distribution Curve */}
          <polyline
            fill="none"
            stroke="#ef4444"
            strokeWidth="2.5"
            points={curvePoints.join(' ')}
          />

          {/* Axes labels */}
          <text x={width / 2} y={height - 8} fontSize="11" textAnchor="middle" fill="#334155" fontWeight="600">
            {dvKey} (Mean = {mean.toFixed(2)}, SD = {sd.toFixed(2)})
          </text>
          <text x={14} y={height / 2} fontSize="11" textAnchor="middle" fill="#334155" fontWeight="600" transform={`rotate(-90 14 ${height / 2})`}>
            Frequency
          </text>
        </svg>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '8px', fontSize: '11px', color: '#64748b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#3b82f6', borderRadius: '2px' }} />
            Observed Frequencies
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '16px', height: '3px', background: '#ef4444' }} />
            Fitted Gaussian Distribution
          </div>
        </div>
      </div>
    );
  };

  const renderBoxPlot = () => {
    if (activeSeries.length < 5) return <div className="text-center p-8 text-sm text-gray-500">Need at least 5 points for boxplot</div>;
    const sorted = [...activeSeries].sort((a, b) => a - b);
    const n = sorted.length;
    const min = sorted[0];
    const max = sorted[n - 1];
    const q1 = sorted[Math.floor(n * 0.25)];
    const median = sorted[Math.floor(n * 0.5)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const lowerWhisker = Math.max(min, q1 - 1.5 * iqr);
    const upperWhisker = Math.min(max, q3 + 1.5 * iqr);
    const outliers = sorted.filter(v => v < lowerWhisker || v > upperWhisker);

    const width = 500;
    const height = 240;
    const padding = 50;
    const range = (max - min) || 1;

    const scaleY = (val: number) => (height - padding) - ((val - min) / range) * (height - 2 * padding);

    const boxX = width / 2 - 40;
    const boxW = 80;

    return (
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', background: '#fafafa', borderRadius: '8px' }}>
          {/* Whiskers vertical stem */}
          <line x1={width / 2} y1={scaleY(lowerWhisker)} x2={width / 2} y2={scaleY(q1)} stroke="#334155" strokeWidth="2" strokeDasharray="3 3" />
          <line x1={width / 2} y1={scaleY(q3)} x2={width / 2} y2={scaleY(upperWhisker)} stroke="#334155" strokeWidth="2" strokeDasharray="3 3" />

          {/* Whisker caps */}
          <line x1={width / 2 - 20} y1={scaleY(lowerWhisker)} x2={width / 2 + 20} y2={scaleY(lowerWhisker)} stroke="#334155" strokeWidth="2" />
          <line x1={width / 2 - 20} y1={scaleY(upperWhisker)} x2={width / 2 + 20} y2={scaleY(upperWhisker)} stroke="#334155" strokeWidth="2" />

          {/* Box (Q1 to Q3) */}
          <rect
            x={boxX}
            y={scaleY(q3)}
            width={boxW}
            height={Math.max(2, scaleY(q1) - scaleY(q3))}
            fill="#dbeafe"
            stroke="#2563eb"
            strokeWidth="2"
            rx="4"
          />

          {/* Median line */}
          <line x1={boxX} y1={scaleY(median)} x2={boxX + boxW} y2={scaleY(median)} stroke="#1e40af" strokeWidth="3" />

          {/* Outliers */}
          {outliers.map((out, idx) => (
            <circle key={idx} cx={width / 2} cy={scaleY(out)} r="4" fill="#ef4444" stroke="#991b1b" strokeWidth="1" />
          ))}

          {/* Labels */}
          <text x={boxX + boxW + 12} y={scaleY(upperWhisker) + 4} fontSize="10" fill="#64748b">Upper: {upperWhisker.toFixed(1)}</text>
          <text x={boxX + boxW + 12} y={scaleY(q3) + 4} fontSize="10" fill="#2563eb" fontWeight="600">Q3: {q3.toFixed(1)}</text>
          <text x={boxX + boxW + 12} y={scaleY(median) + 4} fontSize="10" fill="#1e40af" fontWeight="700">Median: {median.toFixed(1)}</text>
          <text x={boxX + boxW + 12} y={scaleY(q1) + 4} fontSize="10" fill="#2563eb" fontWeight="600">Q1: {q1.toFixed(1)}</text>
          <text x={boxX + boxW + 12} y={scaleY(lowerWhisker) + 4} fontSize="10" fill="#64748b">Lower: {lowerWhisker.toFixed(1)}</text>

          <text x={width / 2} y={height - 12} fontSize="11" textAnchor="middle" fill="#334155" fontWeight="600">
            Distribution of {dvKey} (IQR = {iqr.toFixed(2)})
          </text>
        </svg>
      </div>
    );
  };

  const renderScatterPlot = () => {
    if (!activeSeries.length || !activeSeriesY.length) {
      return <div className="text-center p-8 text-sm text-gray-500">Need both X and Y numeric variables for scatterplot</div>;
    }
    const n = Math.min(activeSeries.length, activeSeriesY.length);
    const xVals = activeSeries.slice(0, n);
    const yVals = activeSeriesY.slice(0, n);

    const minX = Math.min(...xVals);
    const maxX = Math.max(...xVals);
    const minY = Math.min(...yVals);
    const maxY = Math.max(...yVals);

    const width = 600;
    const height = 280;
    const padding = 50;

    const scaleX = (x: number) => padding + ((x - minX) / (maxX - minX || 1)) * (width - 2 * padding);
    const scaleY = (y: number) => (height - padding) - ((y - minY) / (maxY - minY || 1)) * (height - 2 * padding);

    // Compute regression line
    const meanX = xVals.reduce((a, b) => a + b, 0) / n;
    const meanY = yVals.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (xVals[i] - meanX) * (yVals[i] - meanY);
      den += Math.pow(xVals[i] - meanX, 2);
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = meanY - slope * meanX;

    const regY1 = intercept + slope * minX;
    const regY2 = intercept + slope * maxX;

    return (
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', background: '#fafafa', borderRadius: '8px' }}>
          {/* Axes */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#94a3b8" strokeWidth="1.5" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#94a3b8" strokeWidth="1.5" />

          {/* Regression Line */}
          <line
            x1={scaleX(minX)}
            y1={scaleY(regY1)}
            x2={scaleX(maxX)}
            y2={scaleY(regY2)}
            stroke="#ef4444"
            strokeWidth="2.5"
          />

          {/* Points */}
          {xVals.map((x, i) => (
            <circle
              key={i}
              cx={scaleX(x)}
              cy={scaleY(yVals[i])}
              r="4.5"
              fill="#2563eb"
              fillOpacity="0.7"
              stroke="#1e3a8a"
              strokeWidth="1"
            />
          ))}

          {/* Axes labels */}
          <text x={width / 2} y={height - 10} fontSize="11" textAnchor="middle" fill="#334155" fontWeight="600">
            {dvKey} (Predictor / X)
          </text>
          <text x={14} y={height / 2} fontSize="11" textAnchor="middle" fill="#334155" fontWeight="600" transform={`rotate(-90 14 ${height / 2})`}>
            {ivKeys[0] || 'Outcome'} (Y)
          </text>
        </svg>
        <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
          OLS Line: <strong>Y = {slope.toFixed(3)}X {intercept >= 0 ? '+' : '-'} {Math.abs(intercept).toFixed(3)}</strong>
        </div>
      </div>
    );
  };

  const renderQQPlot = () => {
    if (activeSeries.length < 5) return <div className="text-center p-8 text-sm text-gray-500">Need at least 5 points for Q-Q plot</div>;
    const sorted = [...activeSeries].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = sorted.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(sorted.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1)) || 1;

    // Approximate theoretical normal quantiles via Blom's formula
    const qqPoints = sorted.map((obs, i) => {
      const p = (i + 1 - 0.375) / (n + 0.25);
      // Hastings rational approximation for normal quantile
      const t = p < 0.5 ? Math.sqrt(-2 * Math.log(p)) : Math.sqrt(-2 * Math.log(1 - p));
      const zApprox = t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t);
      const theoreticalZ = p < 0.5 ? -zApprox : zApprox;
      const empiricalZ = (obs - mean) / sd;
      return { theoreticalZ, empiricalZ };
    });

    const width = 500;
    const height = 280;
    const padding = 50;

    const scaleCoord = (z: number) => padding + ((z + 3) / 6) * (width - 2 * padding);
    const scaleCoordY = (z: number) => (height - padding) - ((z + 3) / 6) * (height - 2 * padding);

    return (
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', background: '#fafafa', borderRadius: '8px' }}>
          {/* Reference 45-degree diagonal line */}
          <line
            x1={scaleCoord(-2.8)}
            y1={scaleCoordY(-2.8)}
            x2={scaleCoord(2.8)}
            y2={scaleCoordY(2.8)}
            stroke="#ef4444"
            strokeWidth="2"
            strokeDasharray="4 4"
          />

          {/* Q-Q Points */}
          {qqPoints.map((pt, i) => (
            <circle
              key={i}
              cx={scaleCoord(pt.theoreticalZ)}
              cy={scaleCoordY(pt.empiricalZ)}
              r="4"
              fill="#2563eb"
              opacity="0.8"
            />
          ))}

          <text x={width / 2} y={height - 10} fontSize="11" textAnchor="middle" fill="#334155" fontWeight="600">
            Theoretical Normal Quantiles (Z)
          </text>
          <text x={14} y={height / 2} fontSize="11" textAnchor="middle" fill="#334155" fontWeight="600" transform={`rotate(-90 14 ${height / 2})`}>
            Sample Standardized Quantiles
          </text>
        </svg>
        <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
          Normal Q-Q Plot: Adherence to red diagonal indicates Gaussian normality.
        </div>
      </div>
    );
  };

  // ==========================================================================
  // Tab Content Renderers
  // ==========================================================================
  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary, #2563eb)', marginBottom: '4px' }}>
            <Activity size={18} />
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Module 5 · Statistical Analysis Studio
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: 'var(--text-main, #0f172a)' }}>
            Transparent Numerical Statistical Engine
          </h1>
          <p style={{ color: 'var(--muted, #64748b)', fontSize: '13px', margin: '4px 0 0' }}>
            Deterministic, verifiable parametric & nonparametric hypothesis testing with APA 7th edition manuscript reporting.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="secondary"
            onClick={handleLoadSampleData}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
          >
            <Table size={15} />
            Load Trial Sample (N=80)
          </button>
          <label className="button primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0, fontSize: '13px' }}>
            <Upload size={15} />
            {uploading ? 'Ingesting...' : 'Upload Dataset (CSV/XLSX)'}
            <input
              type="file"
              accept=".csv,.xlsx,.tsv,.json"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Modern Linear-Style Tab Bar */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '1px solid var(--border-color, #e2e8f0)',
        marginBottom: '24px',
        paddingBottom: '8px'
      }}>
        {[
          { key: 'overview', label: '1. Overview & Datasets', icon: Database },
          { key: 'data', label: '2. Variable Explorer & Grid', icon: Table },
          { key: 'wizard', label: '3. Statistical Wizard', icon: SlidersHorizontal },
          { key: 'results', label: '4. Results & Visualizations', icon: BarChart2 }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: isActive ? 'var(--primary, #2563eb)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-main, #334155)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={15} />
              {tab.label}
              {tab.key === 'results' && currentResult && (
                <span style={{
                  background: '#22c55e',
                  color: '#fff',
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '10px'
                }}>
                  New
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: OVERVIEW & DATASET HUB                                         */}
      {/* ==================================================================== */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={{
              background: 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '12px',
              padding: '18px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '12px', marginBottom: '6px' }}>
                <span>Active Dataset Size</span>
                <Database size={16} />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                {activeDataset ? `${activeDataset.rowCount} rows` : 'None'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                {activeDataset ? `${activeDataset.columnCount} columns detected` : 'Upload or load a sample'}
              </div>
            </div>

            <div style={{
              background: 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '12px',
              padding: '18px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '12px', marginBottom: '6px' }}>
                <span>Available Variables</span>
                <Table size={16} />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                {activeDataset ? `${numericCols.length} Numeric / ${catCols.length} Cat` : '0'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Measurement level metadata indexed
              </div>
            </div>

            <div style={{
              background: 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '12px',
              padding: '18px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '12px', marginBottom: '6px' }}>
                <span>Executed Analyses</span>
                <Activity size={16} />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                {pastAnalyses.length}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                APA 7 narratives archived
              </div>
            </div>

            <div style={{
              background: 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '12px',
              padding: '18px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '12px', marginBottom: '6px' }}>
                <span>Data Completeness</span>
                <CheckCircle2 size={16} color="#16a34a" />
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a' }}>
                {activeDataset ? `${Math.max(0, 100 - Math.round(((activeDataset.missingValueCount || 0) / (activeDataset.rowCount * activeDataset.columnCount || 1)) * 100))}%` : '100%'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                {activeDataset?.missingValueCount || 0} missing cells detected
              </div>
            </div>
          </div>

          {/* Dataset Selector & Management List */}
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '12px',
            padding: '20px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px' }}>
              Project Research Datasets
            </h3>

            {datasets.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: '8px' }}>
                <Database size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                <p style={{ margin: '0 0 12px' }}>No research datasets loaded in this project yet.</p>
                <button className="primary" onClick={handleLoadSampleData}>Load Empirical Sample Dataset</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {datasets.map(d => {
                  const isSelected = activeDataset?._id === d._id;
                  return (
                    <div
                      key={d._id}
                      onClick={() => selectDataset(d)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 18px',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: isSelected ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <FileSpreadsheet size={22} color={isSelected ? '#2563eb' : '#64748b'} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                            {d.name}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            {d.rowCount} rows · {d.columnCount} columns · Version {d.currentVersionNumber || 1}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {isSelected && (
                          <span style={{ fontSize: '11px', fontWeight: 700, background: '#2563eb', color: '#ffffff', padding: '3px 10px', borderRadius: '12px' }}>
                            Active
                          </span>
                        )}
                        <ChevronRight size={18} color="#94a3b8" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: VARIABLE EXPLORER & DATA GRID                                  */}
      {/* ==================================================================== */}
      {activeTab === 'data' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Action Bar for Transformations & Versions */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '12px',
            padding: '14px 20px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                Active Dataset: {activeDataset?.name || 'None selected'}
              </span>
              {datasetVersions.length > 0 && (
                <span style={{ fontSize: '11px', background: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '10px' }}>
                  {datasetVersions.length} Version Snapshot(s)
                </span>
              )}
            </div>

            {/* Quick Transformation Tools */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={transformTargetCol}
                onChange={e => setTransformTargetCol(e.target.value)}
                style={{ fontSize: '12px', padding: '6px 10px' }}
              >
                {numericCols.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>

              <select
                value={transformMethod}
                onChange={e => setTransformMethod(e.target.value as any)}
                style={{ fontSize: '12px', padding: '6px 10px' }}
              >
                <option value="impute_mean">Impute Missing (Mean)</option>
                <option value="impute_median">Impute Missing (Median)</option>
                <option value="standardize_z">Standardize (Z-Score)</option>
                <option value="log_transform">Log Transform ln(x+1)</option>
              </select>

              <button
                className="secondary"
                onClick={handleApplyTransformation}
                disabled={transforming || !activeDataset}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                {transforming ? 'Transforming...' : 'Apply Transform'}
              </button>
            </div>
          </div>

          {/* Variable Metadata Dictionary Cards */}
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '12px',
            padding: '18px'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px' }}>
              Variable Codebook & Measurement Levels
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '12px'
            }}>
              {activeDataset?.columns.map(col => (
                <div
                  key={col.name}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>{col.name}</strong>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: col.type === 'numeric' ? '#dbeafe' : '#fef3c7',
                      color: col.type === 'numeric' ? '#1e40af' : '#92400e'
                    }}>
                      {col.type.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#64748b' }}>
                    <span>Measurement:</span>
                    <select
                      value={col.measurementLevel || (col.type === 'numeric' ? 'scale' : 'nominal')}
                      onChange={e => handleUpdateMeasurementLevel(col.name, e.target.value as any)}
                      style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="scale">Scale / Continuous</option>
                      <option value="ordinal">Ordinal</option>
                      <option value="nominal">Nominal / Discrete</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Data Preview Grid */}
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '12px',
            padding: '18px',
            overflowX: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
                Data Records Preview (First {datasetRows.length} Rows)
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Total: {activeDataset?.rowCount || 0} observations
              </span>
            </div>

            {loadingData ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading records...</div>
            ) : datasetRows.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No data loaded</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px', color: '#64748b', fontWeight: 600 }}>#</th>
                    {activeDataset?.columns.map(c => (
                      <th key={c.name} style={{ padding: '8px 12px', color: '#334155', fontWeight: 700 }}>
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datasetRows.slice(0, 50).map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{idx + 1}</td>
                      {activeDataset?.columns.map(c => (
                        <td key={c.name} style={{ padding: '8px 12px', color: '#0f172a' }}>
                          {row[c.name] !== undefined && row[c.name] !== null ? String(row[c.name]) : <span style={{ color: '#ef4444' }}>NA</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: STATISTICAL TEST WIZARD                                        */}
      {/* ==================================================================== */}
      {activeTab === 'wizard' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) 1fr', gap: '24px' }}>
          {/* Test Setup Form */}
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '12px',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              Configure Statistical Test
            </h3>

            {/* Test Type Selection */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                Statistical Procedure
              </label>
              <select
                value={analysisType}
                onChange={e => setAnalysisType(e.target.value)}
                style={{ width: '100%', fontSize: '13px' }}
              >
                <optgroup label="Descriptives & Normality">
                  <option value="descriptive">Descriptive Statistics (Mean, SD, IQR, Skew)</option>
                  <option value="normality_shapiro">Normality Check (Shapiro-Wilk W)</option>
                </optgroup>
                <optgroup label="Parametric Hypothesis Tests">
                  <option value="one_sample_t_test">One-Sample t-Test (vs mu0)</option>
                  <option value="independent_t_test">Independent-Samples t-Test (Student & Welch)</option>
                  <option value="paired_t_test">Paired-Samples Repeated Measures t-Test</option>
                  <option value="one_way_anova">One-Way ANOVA with Post-Hoc Tukey HSD</option>
                  <option value="two_way_anova">Two-Way Factorial ANOVA (Main & Interaction)</option>
                </optgroup>
                <optgroup label="Correlations & Regressions">
                  <option value="pearson_correlation">Pearson Correlation (r with 95% Fisher CI)</option>
                  <option value="spearman_correlation">Spearman Rank Correlation (rho)</option>
                  <option value="linear_regression">Simple Linear Regression (OLS)</option>
                  <option value="multiple_linear_regression">Multiple Linear Regression (OLS Matrix Inversion)</option>
                </optgroup>
                <optgroup label="Nonparametric Tests">
                  <option value="mann_whitney_u">Mann-Whitney U Test (Rank Sum)</option>
                  <option value="wilcoxon_signed_rank">Wilcoxon Signed-Rank Test</option>
                  <option value="kruskal_wallis">Kruskal-Wallis H Test (with Epsilon²)</option>
                  <option value="chi_square_independence">Chi-Square Independence (with Cramér's V)</option>
                </optgroup>
              </select>
            </div>

            {/* Title / Description */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                Analysis Title (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Cognitive Intervention Pre vs Post"
                value={analysisTitle}
                onChange={e => setAnalysisTitle(e.target.value)}
                style={{ width: '100%', fontSize: '13px' }}
              />
            </div>

            {/* Primary Variable Selection (DV) */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                {['chi_square_independence'].includes(analysisType) ? 'Row Variable' : 'Primary / Dependent Variable (DV)'}
              </label>
              <select
                value={dvKey}
                onChange={e => setDvKey(e.target.value)}
                style={{ width: '100%', fontSize: '13px' }}
              >
                {(['chi_square_independence'].includes(analysisType) ? catCols : numericCols).map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Comparison / Predictor Variable (IV) */}
            {['independent_t_test', 'paired_t_test', 'pearson_correlation', 'spearman_correlation', 'linear_regression', 'mann_whitney_u', 'wilcoxon_signed_rank', 'chi_square_independence'].includes(analysisType) && (
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                  {['linear_regression'].includes(analysisType) ? 'Predictor Variable (X)' :
                   ['chi_square_independence'].includes(analysisType) ? 'Column Variable' : 'Comparison Variable (Y)'}
                </label>
                <select
                  value={ivKeys[0] || ''}
                  onChange={e => setIvKeys([e.target.value])}
                  style={{ width: '100%', fontSize: '13px' }}
                >
                  {(['chi_square_independence'].includes(analysisType) ? catCols : numericCols).filter(c => c.name !== dvKey).map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Multiple Regression Predictor Multi-Select */}
            {['multiple_linear_regression'].includes(analysisType) && (
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                  Independent Predictor Variables (IVs)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                  {numericCols.filter(c => c.name !== dvKey).map(c => (
                    <label key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                      <input
                        type="checkbox"
                        checked={ivKeys.includes(c.name)}
                        onChange={e => {
                          if (e.target.checked) setIvKeys(prev => [...prev, c.name]);
                          else setIvKeys(prev => prev.filter(k => k !== c.name));
                        }}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Group Factor for ANOVA / Grouped t-Test */}
            {['one_way_anova', 'two_way_anova', 'kruskal_wallis'].includes(analysisType) && (
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                  Primary Grouping Factor (Between-Subjects)
                </label>
                <select
                  value={groupVar}
                  onChange={e => setGroupVar(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                >
                  {catCols.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Second Factor for Two-Way ANOVA */}
            {['two_way_anova'].includes(analysisType) && (
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                  Secondary Factor (B)
                </label>
                <select
                  value={factorB}
                  onChange={e => setFactorB(e.target.value)}
                  style={{ width: '100%', fontSize: '13px' }}
                >
                  {catCols.filter(c => c.name !== groupVar).map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Confidence Level & Missing Data Policy */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Confidence Interval
                </label>
                <select
                  value={confidenceLevel}
                  onChange={e => setConfidenceLevel(Number(e.target.value))}
                  style={{ width: '100%', fontSize: '12px' }}
                >
                  <option value={0.90}>90% (α = .10)</option>
                  <option value={0.95}>95% (α = .05)</option>
                  <option value={0.99}>99% (α = .01)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Missing Data Policy
                </label>
                <select
                  value={missingDataPolicy}
                  onChange={e => setMissingDataPolicy(e.target.value as any)}
                  style={{ width: '100%', fontSize: '12px' }}
                >
                  <option value="exclude_listwise">Listwise Deletion</option>
                  <option value="exclude_pairwise">Pairwise Deletion</option>
                </select>
              </div>
            </div>

            {/* Assumption Checks Toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={checkAssumptions}
                onChange={e => setCheckAssumptions(e.target.checked)}
              />
              Run Assumption Checks (Shapiro-Wilk, Levene, VIF)
            </label>

            {/* Submit Action */}
            <button
              className="primary"
              onClick={handleRunAnalysis}
              disabled={running || !activeDataset}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                fontSize: '14px',
                fontWeight: 700,
                marginTop: '8px'
              }}
            >
              <Play size={16} />
              {running ? 'Running Mathematical Engine...' : 'Run Statistical Analysis'}
            </button>
          </div>

          {/* Test Guidance & Mathematical Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{
              background: 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '12px',
              padding: '20px'
            }}>
              <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 10px', color: '#0f172a' }}>
                Statistical Engine Methodology & Guarantees
              </h4>
              <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#475569', margin: '0 0 12px' }}>
                ResearchProof AI 1.0 executes all statistical operations via an independent, deterministic mathematical engine. All p-values derive from verified numerical approximations of Incomplete Beta, Incomplete Gamma, Student's t, Snedecor's F, and Gaussian distributions.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '16px' }}>
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <strong style={{ fontSize: '12px', color: '#1e40af', display: 'block', marginBottom: '4px' }}>
                    Zero Hallucinations
                  </strong>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Calculations run strictly in JavaScript numerical routines, never generated by LLM prompts.
                  </span>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <strong style={{ fontSize: '12px', color: '#1e40af', display: 'block', marginBottom: '4px' }}>
                    APA 7 Reporting
                  </strong>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Exact degrees of freedom, confidence intervals, effect sizes (d, η², r, V), and APA narrative text.
                  </span>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <strong style={{ fontSize: '12px', color: '#1e40af', display: 'block', marginBottom: '4px' }}>
                    Assumption Diagnostics
                  </strong>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Automated Shapiro-Wilk normality and Levene's test of homogeneity with visual diagnostics.
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Past Analyses History */}
            {pastAnalyses.length > 0 && (
              <div style={{
                background: 'var(--card-bg, #ffffff)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '12px',
                padding: '20px'
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 12px' }}>
                  Recent Executed Analyses
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {pastAnalyses.slice(0, 5).map((a, i) => (
                    <div
                      key={a._id || i}
                      onClick={() => {
                        setCurrentResult(a);
                        setActiveTab('results');
                      }}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        background: '#f8fafc',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{a.title || a.analysisType}</span>
                      <span style={{ color: '#2563eb', fontWeight: 600 }}>View Results →</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: RESULTS & APA 7 VISUALIZATIONS                                 */}
      {/* ==================================================================== */}
      {activeTab === 'results' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {currentResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Header Box with Significance Badge */}
              <div style={{
                background: 'var(--card-bg, #ffffff)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '12px',
                padding: '24px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#2563eb', fontWeight: 700 }}>
                      Deterministic Mathematical Output
                    </span>
                    <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '2px 0 0', textTransform: 'capitalize', color: '#0f172a' }}>
                      {currentResult.title || currentResult.analysisType?.replace(/_/g, ' ')}
                    </h2>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {currentResult.results?.significant !== undefined && (
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '6px 14px',
                        borderRadius: '20px',
                        background: currentResult.results.significant ? '#dcfce7' : '#fee2e2',
                        color: currentResult.results.significant ? '#166534' : '#991b1b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        {currentResult.results.significant ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                        {currentResult.results.significant ? 'p < .05 (Statistically Significant)' : 'p ≥ .05 (Not Significant)'}
                      </span>
                    )}

                    <button
                      className="secondary small"
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(currentResult, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `analysis-${currentResult.analysisType}-${Date.now()}.json`;
                        a.click();
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                    >
                      <Download size={13} /> Export JSON
                    </button>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '12px',
                  marginBottom: '20px'
                }}>
                  {currentResult.results?.t !== undefined && (
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <small style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>t-Statistic</small>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{currentResult.results.t}</div>
                    </div>
                  )}

                  {currentResult.results?.df !== undefined && (
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <small style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>df</small>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{currentResult.results.df}</div>
                    </div>
                  )}

                  {currentResult.results?.f !== undefined && (
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <small style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>F-Ratio</small>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{currentResult.results.f}</div>
                    </div>
                  )}

                  {currentResult.results?.pValue !== undefined && (
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <small style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>p-Value</small>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: currentResult.results.significant ? '#16a34a' : '#0f172a' }}>
                        {currentResult.results.pValue < 0.001 ? '< .001' : currentResult.results.pValue}
                      </div>
                    </div>
                  )}

                  {currentResult.results?.r !== undefined && (
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <small style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Correlation (r)</small>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{currentResult.results.r}</div>
                    </div>
                  )}

                  {currentResult.results?.cohensD !== undefined && (
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <small style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Cohen's d</small>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{currentResult.results.cohensD}</div>
                    </div>
                  )}

                  {currentResult.results?.rSquared !== undefined && (
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <small style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>R² (Variance)</small>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{currentResult.results.rSquared}</div>
                    </div>
                  )}

                  {currentResult.results?.u !== undefined && (
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <small style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Mann-Whitney U</small>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{currentResult.results.u}</div>
                    </div>
                  )}

                  {currentResult.results?.chiSquare !== undefined && (
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <small style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700 }}>Chi-Square (χ²)</small>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>{currentResult.results.chiSquare}</div>
                    </div>
                  )}
                </div>

                {/* APA 7th Edition Reporting Block */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#1e40af' }}>
                      APA 7th Edition Manuscript Reporting Sentence
                    </strong>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="icon-button"
                        onClick={() => {
                          const narrative = currentResult.apaReport || currentResult.apaNarrative || '';
                          navigator.clipboard.writeText(narrative);
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
                          onClick={() => {
                            const narrative = currentResult.apaReport || currentResult.apaNarrative || '';
                            onSendToStudio(`\n\n${narrative}`);
                            setMessage('Statistical sentence inserted into manuscript editor.');
                          }}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                        >
                          <FileText size={14} /> Insert into Manuscript <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', fontStyle: 'italic', color: '#0f172a' }}>
                    "{currentResult.apaReport || currentResult.apaNarrative || 'Statistical computation completed.'}"
                  </p>
                </div>
              </div>

              {/* Assumption Checks Diagnostics Box */}
              {currentResult.diagnostics && (
                <div style={{
                  background: 'var(--card-bg, #ffffff)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '12px',
                  padding: '20px'
                }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 12px', color: '#0f172a' }}>
                    Assumption Diagnostics & Model Validation
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
                    {currentResult.diagnostics.normality && (
                      <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '13px' }}>Shapiro-Wilk Normality</strong>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: currentResult.diagnostics.normality.isNormal ? '#dcfce7' : '#fee2e2',
                            color: currentResult.diagnostics.normality.isNormal ? '#166534' : '#991b1b'
                          }}>
                            {currentResult.diagnostics.normality.isNormal ? 'Normal (p ≥ .05)' : 'Non-Normal (p < .05)'}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                          W = {currentResult.diagnostics.normality.w}, p = {currentResult.diagnostics.normality.pValue}
                        </div>
                      </div>
                    )}

                    {currentResult.diagnostics.homogeneityOfVariance && (
                      <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '13px' }}>Levene's Test (Homogeneity)</strong>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: currentResult.diagnostics.homogeneityOfVariance.equalVariances ? '#dcfce7' : '#fee2e2',
                            color: currentResult.diagnostics.homogeneityOfVariance.equalVariances ? '#166534' : '#991b1b'
                          }}>
                            {currentResult.diagnostics.homogeneityOfVariance.equalVariances ? 'Equal Variance' : 'Unequal Variance'}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                          F = {currentResult.diagnostics.homogeneityOfVariance.f}, p = {currentResult.diagnostics.homogeneityOfVariance.pValue}
                        </div>
                      </div>
                    )}

                    {currentResult.results?.durbinWatson && (
                      <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '13px' }}>Residual Independence</strong>
                          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: '#dcfce7', color: '#166534' }}>
                            d ≈ 2.0
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                          Durbin-Watson = {currentResult.results.durbinWatson}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Scientific Visualizations Panel */}
              <div style={{
                background: 'var(--card-bg, #ffffff)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '12px',
                padding: '20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    Scientific Chart Visualizations
                  </h3>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[
                      { key: 'histogram', label: 'Histogram' },
                      { key: 'boxplot', label: 'Boxplot' },
                      { key: 'scatter', label: 'Scatterplot' },
                      { key: 'qq', label: 'Q-Q Plot' }
                    ].map(chart => (
                      <button
                        key={chart.key}
                        onClick={() => setActiveChartType(chart.key as any)}
                        style={{
                          fontSize: '11px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: activeChartType === chart.key ? '1px solid #2563eb' : '1px solid #cbd5e1',
                          background: activeChartType === chart.key ? '#eff6ff' : '#ffffff',
                          color: activeChartType === chart.key ? '#2563eb' : '#475569',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {chart.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ padding: '8px' }}>
                  {activeChartType === 'histogram' && renderHistogram()}
                  {activeChartType === 'boxplot' && renderBoxPlot()}
                  {activeChartType === 'scatter' && renderScatterPlot()}
                  {activeChartType === 'qq' && renderQQPlot()}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              background: 'var(--card-bg, #ffffff)',
              border: '1px dashed var(--border-color, #cbd5e1)',
              borderRadius: '12px',
              padding: '60px 24px',
              textAlign: 'center',
              color: 'var(--muted, #64748b)'
            }}>
              <BarChart2 size={42} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <h3 style={{ margin: '0 0 6px', color: 'var(--text-main, #0f172a)' }}>No Analysis Run Yet</h3>
              <p style={{ margin: '0 0 16px', fontSize: '13px' }}>
                Open the Statistical Wizard tab, select your variables and hypothesis test, and click "Run Statistical Analysis".
              </p>
              <button className="primary" onClick={() => setActiveTab('wizard')}>
                Open Statistical Wizard →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
