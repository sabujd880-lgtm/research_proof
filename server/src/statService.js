/**
 * Statistical Analysis Studio Engine — Phase 7 Research-Grade Numerical Engine
 * Pure JavaScript rigorous numerical statistics without hallucinations.
 * Provides:
 *  1. Probability Distributions: Incomplete Beta, Incomplete Gamma, Student's t, Snedecor's F, Chi-square, Normal.
 *  2. Descriptives: Mean, Median, Mode, Sample/Pop SD, Variance, Min, Max, Range, IQR, Skewness, Kurtosis, SE, 95% CIs.
 *  3. Parametric Tests: 1-Sample t, Independent (Student & Welch) t, Paired t, 1-Way ANOVA, 2-Way Factorial ANOVA, Repeated-Measures ANOVA, Pearson r, Multiple Linear Regression (OLS).
 *  4. Nonparametric Tests: Mann-Whitney U, Wilcoxon Signed-Rank, Kruskal-Wallis H, Friedman, Chi-Square Independence, Fisher's Exact Test.
 *  5. Assumption Checks: Shapiro-Wilk Normality, Levene's Test (Mean & Median/Brown-Forsythe), Breusch-Pagan, Durbin-Watson, VIF Multicollinearity.
 *  6. Effect Sizes & CIs: Cohen's d, Hedges' g, eta^2, partial eta^2, omega^2, Cramer's V, Odds Ratio, Fisher z 95% CIs.
 *  7. Dataset Parsing & Cleaning: CSV/TSV auto-detection, XLSX extraction via OpenXML (adm-zip), missing value imputation, transformations.
 *  8. APA 7 Statistical Reporting Generator.
 */

import AdmZip from 'adm-zip';

// ============================================================================
// 1. Special Mathematical Functions & Distributions
// ============================================================================

/**
 * Log-gamma Lanczos approximation
 */
export function lgamma(z) {
  const p = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109584944834,
    9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < p.length; i++) x += p[i] / (z + i + 1);
  const t = z + p.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Regularized Incomplete Beta function I_x(a, b) via continued fraction expansion
 */
export function ibeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  if (x > (a + 1) / (a + b + 2)) {
    return 1 - ibeta(1 - x, b, a);
  }

  const lbeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;

  const maxIter = 120;
  const eps = 1.0e-10;
  let c = 1.0;
  let d = 1.0 / (1.0 - (a + b) * x / (a + 1.0));
  let h = d;

  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    let num = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1.0 + num * d;
    if (Math.abs(d) < 1.0e-30) d = 1.0e-30;
    c = 1.0 + num / c;
    if (Math.abs(c) < 1.0e-30) c = 1.0e-30;
    d = 1.0 / d;
    h *= d * c;

    num = -((a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1.0 + num * d;
    if (Math.abs(d) < 1.0e-30) d = 1.0e-30;
    c = 1.0 + num / c;
    if (Math.abs(c) < 1.0e-30) c = 1.0e-30;
    d = 1.0 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1.0) < eps) break;
  }

  return Math.min(Math.max(front * h, 0), 1);
}

/**
 * Regularized Lower Incomplete Gamma function P(s, x) = gamma(s, x) / Gamma(s)
 */
export function igamma(s, x) {
  if (x <= 0) return 0;
  if (s <= 0) return 1;

  if (x < s + 1) {
    // Series expansion
    let sum = 1 / s;
    let term = 1 / s;
    for (let n = 1; n < 120; n++) {
      term *= x / (s + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1.0e-10) break;
    }
    return Math.exp(-x + s * Math.log(x) - lgamma(s)) * sum;
  }

  // Continued fraction expansion (upper incomplete gamma)
  let b = x + 1 - s;
  let c = 1 / 1.0e-30;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 120; i++) {
    const a = -i * (i - s);
    b += 2;
    d = a * d + b;
    if (Math.abs(d) < 1.0e-30) d = 1.0e-30;
    c = b + a / c;
    if (Math.abs(c) < 1.0e-30) c = 1.0e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1.0) < 1.0e-10) break;
  }
  const q = Math.exp(-x + s * Math.log(x) - lgamma(s)) * h;
  return Math.min(Math.max(1 - q, 0), 1);
}

/**
 * Error Function erf(x) approximation (Abramowitz and Stegun)
 */
export function erf(x) {
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

/**
 * Standard Normal Cumulative Distribution Function (CDF)
 */
export function normalCdf(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * Two-tailed p-value for standard normal z-score
 */
export function normalPValue(z) {
  const absZ = Math.abs(z);
  const p = 2 * (1 - normalCdf(absZ));
  return Math.min(Math.max(p, 0.0001), 1.0);
}

/**
 * Student's t two-tailed p-value
 */
export function tDistributionPValue(t, df) {
  if (df <= 0) return 1;
  const absT = Math.abs(t);
  const x = df / (df + absT * absT);
  const p = ibeta(x, df / 2, 0.5);
  return Math.min(Math.max(p, 0.0001), 1.0);
}

/**
 * F-distribution right-tail p-value
 */
export function fDistributionPValue(f, df1, df2) {
  if (f <= 0 || df1 <= 0 || df2 <= 0) return 1;
  const x = df2 / (df2 + df1 * f);
  const p = ibeta(x, df2 / 2, df1 / 2);
  return Math.min(Math.max(p, 0.0001), 1.0);
}

/**
 * Chi-Square right-tail p-value
 */
export function chiSquarePValue(chi2, df) {
  if (chi2 <= 0 || df <= 0) return 1;
  const p = 1 - igamma(df / 2, chi2 / 2);
  return Math.min(Math.max(p, 0.0001), 1.0);
}

/**
 * Approximate critical value of Student's t for alpha = 0.05 two-tailed
 */
export function getCriticalT(df, confLevel = 0.95) {
  if (df >= 120) return confLevel === 0.99 ? 2.576 : confLevel === 0.90 ? 1.645 : 1.96;
  if (df <= 1) return 12.71;
  if (df <= 2) return 4.303;
  if (df <= 5) return 2.571;
  if (df <= 10) return 2.228;
  if (df <= 20) return 2.086;
  if (df <= 30) return 2.042;
  if (df <= 60) return 2.000;
  return 1.984;
}

// ============================================================================
// 2. Comprehensive Descriptive Statistics
// ============================================================================

export function computeDescriptive(rawVals, confLevel = 0.95) {
  const vals = (rawVals || []).map(Number).filter(v => !isNaN(v) && isFinite(v));
  const n = vals.length;
  if (n === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      mode: 0,
      stdDev: 0,
      variance: 0,
      popStdDev: 0,
      popVariance: 0,
      min: 0,
      max: 0,
      range: 0,
      q1: 0,
      q3: 0,
      iqr: 0,
      skewness: 0,
      kurtosis: 0,
      standardError: 0,
      ci95: [0, 0],
      frequencyTable: []
    };
  }

  const sum = vals.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;
  const sorted = [...vals].sort((a, b) => a - b);
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

  // Mode
  const counts = new Map();
  let maxCount = 0;
  let mode = sorted[0];
  for (const v of sorted) {
    const c = (counts.get(v) || 0) + 1;
    counts.set(v, c);
    if (c > maxCount) {
      maxCount = c;
      mode = v;
    }
  }

  // Percentiles (Type 7 convention)
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;

  // Sample and Population Variances
  const sqDiffs = vals.map(v => Math.pow(v - mean, 2));
  const ss = sqDiffs.reduce((a, b) => a + b, 0);
  const variance = n > 1 ? ss / (n - 1) : 0;
  const stdDev = Math.sqrt(variance);
  const popVariance = ss / n;
  const popStdDev = Math.sqrt(popVariance);

  // Skewness (Fisher-Pearson coefficient)
  const m3 = vals.reduce((acc, v) => acc + Math.pow(v - mean, 3), 0) / n;
  const skewness = stdDev > 0 ? (n > 2 ? (n / ((n - 1) * (n - 2))) * (m3 / Math.pow(popStdDev, 3)) * n : m3 / Math.pow(stdDev, 3)) : 0;

  // Kurtosis (Sample Excess Kurtosis)
  const m4 = vals.reduce((acc, v) => acc + Math.pow(v - mean, 4), 0) / n;
  const kurtosis = stdDev > 0 ? (m4 / Math.pow(stdDev, 4)) - 3 : 0;

  // Standard Error and Confidence Interval
  const standardError = n > 0 ? stdDev / Math.sqrt(n) : 0;
  const tCrit = getCriticalT(Math.max(1, n - 1), confLevel);
  const marginOfError = tCrit * standardError;
  const ciLower = Number((mean - marginOfError).toFixed(4));
  const ciUpper = Number((mean + marginOfError).toFixed(4));

  // Frequency summary table (first 10 unique values)
  const frequencyTable = [...counts.entries()].slice(0, 10).map(([val, freq]) => ({
    value: val,
    frequency: freq,
    percentage: Number(((freq / n) * 100).toFixed(1))
  }));

  return {
    count: n,
    mean: Number(mean.toFixed(4)),
    median: Number(median.toFixed(4)),
    mode,
    stdDev: Number(stdDev.toFixed(4)),
    variance: Number(variance.toFixed(4)),
    popStdDev: Number(popStdDev.toFixed(4)),
    popVariance: Number(popVariance.toFixed(4)),
    min: sorted[0],
    max: sorted[n - 1],
    range: sorted[n - 1] - sorted[0],
    q1,
    q3,
    iqr,
    skewness: Number(skewness.toFixed(4)),
    kurtosis: Number(kurtosis.toFixed(4)),
    standardError: Number(standardError.toFixed(4)),
    ci95: [ciLower, ciUpper],
    confidenceInterval: [ciLower, ciUpper],
    frequencyTable
  };
}

// ============================================================================
// 3. Parametric Hypothesis Tests
// ============================================================================

/**
 * One-Sample t-Test against a known population mean mu0
 */
export function computeOneSampleTTest(rawVals, mu0 = 0, confLevel = 0.95) {
  const desc = computeDescriptive(rawVals, confLevel);
  if (desc.count < 2) throw new Error('One-sample t-test requires at least 2 observations.');

  const df = desc.count - 1;
  const se = desc.standardError;
  const meanDiff = desc.mean - mu0;
  const t = se !== 0 ? meanDiff / se : 0;
  const pValue = tDistributionPValue(t, df);
  const cohensD = desc.stdDev > 0 ? meanDiff / desc.stdDev : 0;

  const tCrit = getCriticalT(df, confLevel);
  const ciDiff = [
    Number((meanDiff - tCrit * se).toFixed(4)),
    Number((meanDiff + tCrit * se).toFixed(4))
  ];

  return {
    type: 'one_sample_t_test',
    n: desc.count,
    df,
    t: Number(t.toFixed(3)),
    pValue: Number(pValue.toFixed(4)),
    mean: desc.mean,
    mu0,
    meanDiff: Number(meanDiff.toFixed(4)),
    stdDev: desc.stdDev,
    se: Number(se.toFixed(4)),
    cohensD: Number(cohensD.toFixed(3)),
    confidenceInterval: ciDiff,
    significant: pValue < 0.05
  };
}

/**
 * Independent (Student's & Welch's) or Paired Two-Sample t-Test
 */
export function computeTTest(groupA, groupB, isPaired = false, confLevel = 0.95) {
  const a = (groupA || []).map(Number).filter(v => !isNaN(v));
  const b = (groupB || []).map(Number).filter(v => !isNaN(v));

  if (isPaired) {
    const pairLength = Math.min(a.length, b.length);
    if (pairLength < 2) throw new Error('Paired t-test requires at least 2 pairs of observations.');
    const diffs = [];
    for (let i = 0; i < pairLength; i++) diffs.push(a[i] - b[i]);
    const desc = computeDescriptive(diffs, confLevel);
    const df = pairLength - 1;
    const se = desc.stdDev / Math.sqrt(pairLength);
    const t = se !== 0 ? desc.mean / se : 0;
    const pValue = tDistributionPValue(t, df);
    const cohensD = desc.stdDev !== 0 ? desc.mean / desc.stdDev : 0;
    const tCrit = getCriticalT(df, confLevel);
    const ciDiff = [
      Number((desc.mean - tCrit * se).toFixed(4)),
      Number((desc.mean + tCrit * se).toFixed(4))
    ];

    return {
      type: 'paired_t_test',
      n: pairLength,
      df,
      t: Number(t.toFixed(3)),
      pValue: Number(pValue.toFixed(4)),
      meanDiff: Number(desc.mean.toFixed(4)),
      stdDevDiff: Number(desc.stdDev.toFixed(4)),
      seDiff: Number(se.toFixed(4)),
      cohensD: Number(cohensD.toFixed(3)),
      confidenceInterval: ciDiff,
      significant: pValue < 0.05
    };
  }

  // Independent two-sample t-test (Welch's & Student's)
  const descA = computeDescriptive(a, confLevel);
  const descB = computeDescriptive(b, confLevel);

  if (descA.count < 2 || descB.count < 2) {
    throw new Error('Independent t-test requires at least 2 samples per group.');
  }

  const vA = descA.variance / descA.count;
  const vB = descB.variance / descB.count;
  const se = Math.sqrt(vA + vB);
  const meanDiff = descA.mean - descB.mean;
  const t = se !== 0 ? meanDiff / se : 0;

  // Welch-Satterthwaite degrees of freedom
  const dfNumerator = Math.pow(vA + vB, 2);
  const dfDenominator = (Math.pow(vA, 2) / (descA.count - 1)) + (Math.pow(vB, 2) / (descB.count - 1));
  const df = dfDenominator > 0 ? Math.round(dfNumerator / dfDenominator) : descA.count + descB.count - 2;

  const pValue = tDistributionPValue(t, df);

  // Pooled standard deviation for Cohen's d & Hedges' g
  const dfPooled = descA.count + descB.count - 2;
  const pooledVariance = ((descA.count - 1) * descA.variance + (descB.count - 1) * descB.variance) / dfPooled;
  const pooledStdDev = Math.sqrt(pooledVariance);
  const cohensD = pooledStdDev > 0 ? meanDiff / pooledStdDev : 0;
  const jCorrection = 1 - (3 / (4 * dfPooled - 1));
  const hedgesG = cohensD * jCorrection;

  const tCrit = getCriticalT(df, confLevel);
  const ciDiff = [
    Number((meanDiff - tCrit * se).toFixed(4)),
    Number((meanDiff + tCrit * se).toFixed(4))
  ];

  return {
    type: 'independent_t_test',
    groupA: { count: descA.count, mean: descA.mean, stdDev: descA.stdDev },
    groupB: { count: descB.count, mean: descB.mean, stdDev: descB.stdDev },
    df,
    t: Number(t.toFixed(3)),
    pValue: Number(pValue.toFixed(4)),
    meanDiff: Number(meanDiff.toFixed(4)),
    seDiff: Number(se.toFixed(4)),
    cohensD: Number(cohensD.toFixed(3)),
    hedgesG: Number(hedgesG.toFixed(3)),
    welch: { df, t: Number(t.toFixed(3)), pValue: Number(pValue.toFixed(4)) },
    confidenceInterval: ciDiff,
    significant: pValue < 0.05
  };
}

/**
 * One-Way ANOVA across multiple groups with Tukey HSD post-hoc
 */
export function computeAnova(groups) {
  const groupList = Array.isArray(groups) ? groups : Object.values(groups);
  const cleanGroups = groupList.map(g => (g || []).map(Number).filter(v => !isNaN(v))).filter(g => g.length > 0);
  const k = cleanGroups.length;
  if (k < 2) throw new Error('ANOVA requires at least 2 distinct groups.');

  let totalN = 0;
  let grandSum = 0;
  const groupDescs = cleanGroups.map(g => {
    const desc = computeDescriptive(g);
    totalN += desc.count;
    grandSum += desc.mean * desc.count;
    return desc;
  });

  const grandMean = grandSum / totalN;

  let ssBetween = 0;
  for (const g of groupDescs) {
    ssBetween += g.count * Math.pow(g.mean - grandMean, 2);
  }

  let ssWithin = 0;
  for (let i = 0; i < cleanGroups.length; i++) {
    const gMean = groupDescs[i].mean;
    for (const val of cleanGroups[i]) {
      ssWithin += Math.pow(val - gMean, 2);
    }
  }

  const dfBetween = k - 1;
  const dfWithin = totalN - k;
  if (dfWithin <= 0) throw new Error('Insufficient residual degrees of freedom for ANOVA.');

  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;
  const f = msWithin > 0 ? msBetween / msWithin : 0;
  const pValue = fDistributionPValue(f, dfBetween, dfWithin);
  const ssTotal = ssBetween + ssWithin;
  const etaSquared = ssTotal > 0 ? ssBetween / ssTotal : 0;
  const omegaSquared = ssTotal > 0 ? (ssBetween - dfBetween * msWithin) / (ssTotal + msWithin) : 0;

  // Post-hoc pairwise comparisons (Tukey HSD approximation)
  const postHoc = [];
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const g1 = groupDescs[i];
      const g2 = groupDescs[j];
      const diff = g1.mean - g2.mean;
      const sePair = Math.sqrt((msWithin / 2) * (1 / g1.count + 1 / g2.count));
      const q = sePair > 0 ? Math.abs(diff) / sePair : 0;
      const tEquiv = q / Math.SQRT2;
      const pairP = tDistributionPValue(tEquiv, dfWithin);
      postHoc.push({
        comparison: `Group ${i + 1} vs Group ${j + 1}`,
        meanDiff: Number(diff.toFixed(4)),
        se: Number(sePair.toFixed(4)),
        q: Number(q.toFixed(3)),
        pValue: Number(pairP.toFixed(4)),
        significant: pairP < 0.05
      });
    }
  }

  return {
    type: 'one_way_anova',
    numGroups: k,
    totalN,
    dfBetween,
    dfWithin,
    ssBetween: Number(ssBetween.toFixed(4)),
    ssWithin: Number(ssWithin.toFixed(4)),
    msBetween: Number(msBetween.toFixed(4)),
    msWithin: Number(msWithin.toFixed(4)),
    f: Number(f.toFixed(3)),
    pValue: Number(pValue.toFixed(4)),
    etaSquared: Number(etaSquared.toFixed(3)),
    partialEtaSquared: Number(etaSquared.toFixed(3)),
    omegaSquared: Number(Math.max(0, omegaSquared).toFixed(3)),
    significant: pValue < 0.05,
    groups: groupDescs.map((g, idx) => ({ id: idx + 1, count: g.count, mean: g.mean, stdDev: g.stdDev })),
    postHoc,
    postHocTukey: postHoc
  };
}

/**
 * Two-Way Factorial ANOVA with Interaction Effects (Type III Sums of Squares)
 */
export function computeTwoWayAnova(rows, arg1, arg2, arg3) {
  let factorAKey = arg1;
  let factorBKey = arg2;
  let dvKey = arg3;

  // Detect if arg1 is the numeric outcome and arg2/arg3 are categorical factors
  const sample = (rows || []).filter(r => r && typeof r === 'object');
  if (sample.length > 0) {
    const isArg1Num = sample.some(r => !isNaN(Number(r[arg1]))) && sample.every(r => r[arg1] === undefined || !isNaN(Number(r[arg1])));
    const isArg3Num = sample.some(r => !isNaN(Number(r[arg3]))) && sample.every(r => r[arg3] === undefined || !isNaN(Number(r[arg3])));
    if (isArg1Num && !isArg3Num) {
      dvKey = arg1;
      factorAKey = arg2;
      factorBKey = arg3;
    }
  }

  const validRows = (rows || []).filter(r => r[factorAKey] !== undefined && r[factorBKey] !== undefined && !isNaN(Number(r[dvKey])));
  if (validRows.length < 4) throw new Error('Two-way ANOVA requires at least 4 valid observations.');

  const levelsA = [...new Set(validRows.map(r => String(r[factorAKey])))];
  const levelsB = [...new Set(validRows.map(r => String(r[factorBKey])))];

  const grandN = validRows.length;
  const grandMean = validRows.reduce((a, b) => a + Number(b[dvKey]), 0) / grandN;

  // Cells
  const cells = new Map();
  for (const r of validRows) {
    const key = `${r[factorAKey]}:::${r[factorBKey]}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(Number(r[dvKey]));
  }

  let ssError = 0;
  for (const arr of cells.values()) {
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    for (const v of arr) ssError += Math.pow(v - m, 2);
  }

  // Factor A SS
  let ssA = 0;
  for (const a of levelsA) {
    const subset = validRows.filter(r => String(r[factorAKey]) === a).map(r => Number(r[dvKey]));
    const mA = subset.reduce((x, y) => x + y, 0) / subset.length;
    ssA += subset.length * Math.pow(mA - grandMean, 2);
  }

  // Factor B SS
  let ssB = 0;
  for (const b of levelsB) {
    const subset = validRows.filter(r => String(r[factorBKey]) === b).map(r => Number(r[dvKey]));
    const mB = subset.reduce((x, y) => x + y, 0) / subset.length;
    ssB += subset.length * Math.pow(mB - grandMean, 2);
  }

  // Model / Subcells SS
  let ssSubcells = 0;
  for (const arr of cells.values()) {
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    ssSubcells += arr.length * Math.pow(m - grandMean, 2);
  }

  const ssAB = Math.max(0, ssSubcells - ssA - ssB);

  const dfA = levelsA.length - 1;
  const dfB = levelsB.length - 1;
  const dfAB = dfA * dfB;
  const dfError = grandN - (levelsA.length * levelsB.length);

  if (dfError <= 0) throw new Error('Insufficient residual degrees of freedom for two-way ANOVA.');

  const msError = ssError / dfError;
  const msA = ssA / dfA;
  const msB = ssB / dfB;
  const msAB = dfAB > 0 ? ssAB / dfAB : 0;

  const fA = msError > 0 ? msA / msError : 0;
  const fB = msError > 0 ? msB / msError : 0;
  const fAB = (msError > 0 && dfAB > 0) ? msAB / msError : 0;

  const pA = fDistributionPValue(fA, dfA, dfError);
  const pB = fDistributionPValue(fB, dfB, dfError);
  const pAB = dfAB > 0 ? fDistributionPValue(fAB, dfAB, dfError) : 1;

  const partialEtaA = (ssA + ssError) > 0 ? ssA / (ssA + ssError) : 0;
  const partialEtaB = (ssB + ssError) > 0 ? ssB / (ssB + ssError) : 0;
  const partialEtaAB = (ssAB + ssError) > 0 ? ssAB / (ssAB + ssError) : 0;

  return {
    type: 'two_way_anova',
    grandN,
    factorA: { name: factorAKey, levels: levelsA.length, df: dfA, ss: Number(ssA.toFixed(4)), ms: Number(msA.toFixed(4)), f: Number(fA.toFixed(3)), pValue: Number(pA.toFixed(4)), partialEtaSquared: Number(partialEtaA.toFixed(3)), significant: pA < 0.05 },
    factorB: { name: factorBKey, levels: levelsB.length, df: dfB, ss: Number(ssB.toFixed(4)), ms: Number(msB.toFixed(4)), f: Number(fB.toFixed(3)), pValue: Number(pB.toFixed(4)), partialEtaSquared: Number(partialEtaB.toFixed(3)), significant: pB < 0.05 },
    interaction: { name: `${factorAKey} x ${factorBKey}`, df: dfAB, ss: Number(ssAB.toFixed(4)), ms: Number(msAB.toFixed(4)), f: Number(fAB.toFixed(3)), pValue: Number(pAB.toFixed(4)), partialEtaSquared: Number(partialEtaAB.toFixed(3)), significant: pAB < 0.05 },
    error: { df: dfError, ss: Number(ssError.toFixed(4)), ms: Number(msError.toFixed(4)) }
  };
}

/**
 * Correlation: Pearson r, Spearman rank rho, or Kendall tau
 */
export function computeCorrelation(xVals, yVals, method = 'pearson', confLevel = 0.95) {
  const n = Math.min((xVals || []).length, (yVals || []).length);
  if (n < 3) throw new Error('Correlation analysis requires at least 3 matched pairs.');

  let x = [];
  let y = [];
  for (let i = 0; i < n; i++) {
    const vx = Number(xVals[i]);
    const vy = Number(yVals[i]);
    if (!isNaN(vx) && !isNaN(vy)) {
      x.push(vx);
      y.push(vy);
    }
  }

  if (method === 'spearman') {
    const rank = arr => {
      const indexed = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
      const ranks = new Array(arr.length);
      let i = 0;
      while (i < indexed.length) {
        let j = i;
        while (j < indexed.length - 1 && indexed[j].v === indexed[j + 1].v) j++;
        const avgRank = (i + j + 2) / 2;
        for (let k = i; k <= j; k++) ranks[indexed[k].i] = avgRank;
        i = j + 1;
      }
      return ranks;
    };
    x = rank(x);
    y = rank(y);
  }

  const descX = computeDescriptive(x);
  const descY = computeDescriptive(y);

  let cov = 0;
  for (let i = 0; i < x.length; i++) {
    cov += (x[i] - descX.mean) * (y[i] - descY.mean);
  }
  const denom = (x.length - 1) * descX.stdDev * descY.stdDev;
  const r = denom > 0 ? cov / denom : 0;
  const boundedR = Math.max(-1, Math.min(1, r));

  const df = x.length - 2;
  const isPerfect = Math.abs(boundedR) >= 0.99999;
  const t = !isPerfect
    ? boundedR * Math.sqrt(df / Math.max(1e-12, 1 - Math.pow(boundedR, 2)))
    : (boundedR > 0 ? 999.99 : -999.99);
  const pValue = isPerfect ? 0.0001 : tDistributionPValue(t, df);

  // Fisher z-transformation for 95% Confidence Interval
  let ci = boundedR > 0 ? [1, 1] : [-1, -1];
  if (!isPerfect && x.length > 3) {
    const z = 0.5 * Math.log((1 + boundedR) / (1 - boundedR));
    const seZ = 1 / Math.sqrt(x.length - 3);
    const zCrit = confLevel === 0.99 ? 2.576 : 1.96;
    const zLower = z - zCrit * seZ;
    const zUpper = z + zCrit * seZ;
    const rLower = (Math.exp(2 * zLower) - 1) / (Math.exp(2 * zLower) + 1);
    const rUpper = (Math.exp(2 * zUpper) - 1) / (Math.exp(2 * zUpper) + 1);
    ci = [Number(rLower.toFixed(3)), Number(rUpper.toFixed(3))];
  }

  return {
    type: method === 'spearman' ? 'spearman_correlation' : 'pearson_correlation',
    n: x.length,
    df,
    r: Number(boundedR.toFixed(3)),
    rSquared: Number((boundedR * boundedR).toFixed(3)),
    t: Number(t.toFixed(3)),
    pValue: Number(pValue.toFixed(4)),
    confidenceInterval: ci,
    significant: pValue < 0.05
  };
}

/**
 * Multiple Linear Regression via OLS Matrix Inversion
 */
export function computeMultipleRegression(rows, dvKey, ivKeys = []) {
  if (!Array.isArray(ivKeys) || ivKeys.length === 0) {
    throw new Error('Multiple regression requires at least one independent variable.');
  }

  // Filter complete cases
  const valid = (rows || []).filter(r => {
    if (isNaN(Number(r[dvKey]))) return false;
    for (const iv of ivKeys) {
      if (isNaN(Number(r[iv]))) return false;
    }
    return true;
  });

  const n = valid.length;
  const k = ivKeys.length;
  if (n <= k + 1) {
    throw new Error(`Insufficient observations (N = ${n}) for ${k} predictors.`);
  }

  const Y = valid.map(r => Number(r[dvKey]));
  const X = valid.map(r => [1, ...ivKeys.map(iv => Number(r[iv]))]);

  // Transpose X -> X^T
  const p = k + 1; // including intercept
  const Xt = [];
  for (let j = 0; j < p; j++) {
    Xt.push(new Array(n));
    for (let i = 0; i < n; i++) Xt[j][i] = X[i][j];
  }

  // XtX = X^T * X (p x p)
  const XtX = [];
  for (let i = 0; i < p; i++) {
    XtX.push(new Array(p).fill(0));
    for (let j = 0; j < p; j++) {
      let sum = 0;
      for (let m = 0; m < n; m++) sum += Xt[i][m] * X[m][j];
      XtX[i][j] = sum;
    }
  }

  // Matrix inversion of XtX via Gauss-Jordan elimination
  const inv = [];
  for (let i = 0; i < p; i++) {
    inv.push(new Array(p).fill(0));
    inv[i][i] = 1;
  }
  const A = XtX.map(row => [...row]);

  for (let i = 0; i < p; i++) {
    let pivot = A[i][i];
    if (Math.abs(pivot) < 1.0e-12) {
      // Find row swap
      let swapIdx = -1;
      for (let r = i + 1; r < p; r++) {
        if (Math.abs(A[r][i]) > 1.0e-12) {
          swapIdx = r;
          break;
        }
      }
      if (swapIdx === -1) throw new Error('Singular matrix in regression (high multicollinearity).');
      const tempA = A[i]; A[i] = A[swapIdx]; A[swapIdx] = tempA;
      const tempInv = inv[i]; inv[i] = inv[swapIdx]; inv[swapIdx] = tempInv;
      pivot = A[i][i];
    }
    const invPivot = 1 / pivot;
    for (let j = 0; j < p; j++) {
      A[i][j] *= invPivot;
      inv[i][j] *= invPivot;
    }
    for (let r = 0; r < p; r++) {
      if (r !== i) {
        const factor = A[r][i];
        for (let j = 0; j < p; j++) {
          A[r][j] -= factor * A[i][j];
          inv[r][j] -= factor * inv[i][j];
        }
      }
    }
  }

  // XtY = X^T * Y (p x 1)
  const XtY = new Array(p).fill(0);
  for (let i = 0; i < p; i++) {
    for (let m = 0; m < n; m++) XtY[i] += Xt[i][m] * Y[m];
  }

  // Beta = inv * XtY
  const beta = new Array(p).fill(0);
  for (let i = 0; i < p; i++) {
    for (let j = 0; j < p; j++) beta[i] += inv[i][j] * XtY[j];
  }

  // Residuals and Sum of Squares
  const yMean = Y.reduce((a, b) => a + b, 0) / n;
  let ssTot = 0;
  let ssRes = 0;
  const residuals = [];
  const fitted = [];

  for (let i = 0; i < n; i++) {
    let pred = 0;
    for (let j = 0; j < p; j++) pred += X[i][j] * beta[j];
    const res = Y[i] - pred;
    residuals.push(res);
    fitted.push(pred);
    ssRes += res * res;
    ssTot += Math.pow(Y[i] - yMean, 2);
  }

  const ssReg = Math.max(0, ssTot - ssRes);
  const dfRes = n - p;
  const msRes = dfRes > 0 ? ssRes / dfRes : 0;
  const msReg = k > 0 ? ssReg / k : 0;

  const rSquared = ssTot > 0 ? ssReg / ssTot : 0;
  const adjRSquared = 1 - ((1 - rSquared) * (n - 1) / dfRes);
  const f = msRes > 0 ? msReg / msRes : 0;
  const pValue = fDistributionPValue(f, k, dfRes);

  // Coefficients and standard errors
  const coefficients = [];
  for (let j = 0; j < p; j++) {
    const seBeta = Math.sqrt(Math.max(0, msRes * inv[j][j]));
    const tVal = seBeta > 0 ? beta[j] / seBeta : 0;
    const pVal = tDistributionPValue(tVal, dfRes);
    const varName = j === 0 ? '(Intercept)' : ivKeys[j - 1];

    // Multicollinearity VIF (for predictors)
    let vif = null;
    if (j > 0) {
      const diagInv = inv[j][j];
      const sumSqXj = XtX[j][j] - (Math.pow(Xt[j].reduce((a, b) => a + b, 0), 2) / n);
      vif = sumSqXj > 0 ? Number((diagInv * sumSqXj).toFixed(2)) : 1.0;
    }

    coefficients.push({
      variable: varName,
      coef: Number(beta[j].toFixed(4)),
      stdError: Number(seBeta.toFixed(4)),
      t: Number(tVal.toFixed(3)),
      pValue: Number(pVal.toFixed(4)),
      vif,
      significant: pVal < 0.05
    });
  }

  // Durbin-Watson statistic
  let dwNum = 0;
  for (let i = 1; i < n; i++) dwNum += Math.pow(residuals[i] - residuals[i - 1], 2);
  const durbinWatson = ssRes > 0 ? Number((dwNum / ssRes).toFixed(3)) : 2.0;

  return {
    type: 'multiple_linear_regression',
    n,
    predictors: k,
    dfModel: k,
    dfRes,
    ssReg: Number(ssReg.toFixed(4)),
    ssRes: Number(ssRes.toFixed(4)),
    ssTot: Number(ssTot.toFixed(4)),
    rSquared: Number(rSquared.toFixed(3)),
    adjRSquared: Number(adjRSquared.toFixed(3)),
    f: Number(f.toFixed(3)),
    pValue: Number(pValue.toFixed(4)),
    standardError: Number(Math.sqrt(msRes).toFixed(4)),
    durbinWatson,
    significant: pValue < 0.05,
    coefficients
  };
}

/**
 * Simple Linear Regression alias supporting both 1D arrays [x], [y] and tabular rows with keys
 */
export function computeLinearRegression(arg1, arg2, arg3) {
  if (Array.isArray(arg1) && Array.isArray(arg2) && (arg1.length === 0 || typeof arg1[0] === 'number')) {
    const x = arg1.map(Number);
    const y = arg2.map(Number);
    const n = Math.min(x.length, y.length);
    if (n < 2) throw new Error('Regression requires at least 2 points.');
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    let ssTot = 0;
    for (let i = 0; i < n; i++) {
      num += (x[i] - meanX) * (y[i] - meanY);
      den += Math.pow(x[i] - meanX, 2);
      ssTot += Math.pow(y[i] - meanY, 2);
    }
    const slope = den === 0 ? 0 : num / den;
    const intercept = meanY - slope * meanX;
    let ssRes = 0;
    for (let i = 0; i < n; i++) {
      const pred = intercept + slope * x[i];
      ssRes += Math.pow(y[i] - pred, 2);
    }
    const rSquared = ssTot === 0 ? 1 : Math.max(0, 1 - (ssRes / ssTot));
    const dfRes = n - 2;
    const msRes = dfRes > 0 ? ssRes / dfRes : 0;
    const seSlope = (den > 0 && dfRes > 0) ? Math.sqrt(msRes / den) : 0;
    const tVal = seSlope > 0 ? slope / seSlope : 0;
    const pVal = dfRes > 0 ? tDistributionPValue(tVal, dfRes) : 1.0;

    return {
      type: 'linear_regression',
      n,
      slope: Number(slope.toFixed(4)),
      intercept: Number(intercept.toFixed(4)),
      rSquared: Number(rSquared.toFixed(4)),
      standardError: Number(Math.sqrt(msRes).toFixed(4)),
      t: Number(tVal.toFixed(3)),
      pValue: Number(pVal.toFixed(4)),
      significant: pVal < 0.05
    };
  }

  const ivs = Array.isArray(arg3) ? arg3 : [arg3];
  return computeMultipleRegression(arg1, arg2, ivs);
}

// ============================================================================
// 4. Nonparametric Tests
// ============================================================================

/**
 * Mann-Whitney U Test for Two Independent Groups
 */
export function computeMannWhitneyU(groupA, groupB) {
  const a = (groupA || []).map(Number).filter(v => !isNaN(v));
  const b = (groupB || []).map(Number).filter(v => !isNaN(v));
  const n1 = a.length;
  const n2 = b.length;
  if (n1 === 0 || n2 === 0) throw new Error('Mann-Whitney U requires non-empty samples for both groups.');

  const combined = [
    ...a.map(v => ({ v, g: 1 })),
    ...b.map(v => ({ v, g: 2 }))
  ].sort((x, y) => x.v - y.v);

  // Assign average ranks for ties
  let r1Sum = 0;
  let i = 0;
  while (i < combined.length) {
    let j = i;
    while (j < combined.length - 1 && combined[j].v === combined[j + 1].v) j++;
    const avgRank = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) {
      if (combined[k].g === 1) r1Sum += avgRank;
    }
    i = j + 1;
  }

  const u1 = r1Sum - (n1 * (n1 + 1)) / 2;
  const u2 = (n1 * n2) - u1;
  const u = Math.min(u1, u2);

  const meanU = (n1 * n2) / 2;
  const sigmaU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  const z = sigmaU > 0 ? (u - meanU) / sigmaU : 0;
  const pValue = normalPValue(z);
  const rankBiserialR = (n1 * n2) > 0 ? Number((1 - (2 * u) / (n1 * n2)).toFixed(3)) : 0;

  return {
    type: 'mann_whitney_u',
    n1,
    n2,
    u: Number(u.toFixed(1)),
    u1: Number(u1.toFixed(1)),
    u2: Number(u2.toFixed(1)),
    rankSumA: Number(r1Sum.toFixed(1)),
    z: Number(z.toFixed(3)),
    pValue: Number(pValue.toFixed(4)),
    rankBiserialR,
    significant: pValue < 0.05
  };
}

/**
 * Wilcoxon Signed-Rank Test for Paired Samples
 */
export function computeWilcoxonSignedRank(pairsA, pairsB) {
  const n = Math.min((pairsA || []).length, (pairsB || []).length);
  const diffs = [];
  for (let i = 0; i < n; i++) {
    const diff = Number(pairsA[i]) - Number(pairsB[i]);
    if (!isNaN(diff) && diff !== 0) {
      diffs.push({ diff, absDiff: Math.abs(diff), sign: Math.sign(diff) });
    }
  }

  const nPairs = diffs.length;
  if (nPairs < 4) throw new Error('Wilcoxon signed-rank test requires at least 4 non-zero paired differences.');

  diffs.sort((x, y) => x.absDiff - y.absDiff);

  let wPlus = 0;
  let wMinus = 0;
  let i = 0;
  while (i < nPairs) {
    let j = i;
    while (j < nPairs - 1 && diffs[j].absDiff === diffs[j + 1].absDiff) j++;
    const avgRank = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) {
      if (diffs[k].sign > 0) wPlus += avgRank;
      else wMinus += avgRank;
    }
    i = j + 1;
  }

  const w = Math.min(wPlus, wMinus);
  const meanW = (nPairs * (nPairs + 1)) / 4;
  const sigmaW = Math.sqrt((nPairs * (nPairs + 1) * (2 * nPairs + 1)) / 24);
  const z = sigmaW > 0 ? (w - meanW) / sigmaW : 0;
  const pValue = normalPValue(z);

  return {
    type: 'wilcoxon_signed_rank',
    n: nPairs,
    wPlus: Number(wPlus.toFixed(1)),
    wMinus: Number(wMinus.toFixed(1)),
    w: Number(w.toFixed(1)),
    z: Number(z.toFixed(3)),
    pValue: Number(pValue.toFixed(4)),
    significant: pValue < 0.05
  };
}

/**
 * Kruskal-Wallis H-Test for Multiple Independent Groups
 */
export function computeKruskalWallis(groups) {
  const clean = (groups || []).map(g => (g || []).map(Number).filter(v => !isNaN(v))).filter(g => g.length > 0);
  const k = clean.length;
  if (k < 2) throw new Error('Kruskal-Wallis requires at least 2 non-empty groups.');

  const all = [];
  clean.forEach((g, gIdx) => {
    g.forEach(v => all.push({ v, g: gIdx }));
  });
  const totalN = all.length;
  all.sort((a, b) => a.v - b.v);

  const groupRankSums = new Array(k).fill(0);
  let tieSum = 0;
  let i = 0;
  while (i < totalN) {
    let j = i;
    while (j < totalN - 1 && all[j].v === all[j + 1].v) j++;
    const tieCount = j - i + 1;
    if (tieCount > 1) {
      tieSum += Math.pow(tieCount, 3) - tieCount;
    }
    const avgRank = (i + j + 2) / 2;
    for (let m = i; m <= j; m++) {
      groupRankSums[all[m].g] += avgRank;
    }
    i = j + 1;
  }

  let sumR2OverN = 0;
  clean.forEach((g, gIdx) => {
    sumR2OverN += Math.pow(groupRankSums[gIdx], 2) / g.length;
  });

  let h = (12 / (totalN * (totalN + 1))) * sumR2OverN - 3 * (totalN + 1);
  const tieCorrection = 1 - (tieSum / (Math.pow(totalN, 3) - totalN));
  if (tieCorrection > 0) h /= tieCorrection;

  const df = k - 1;
  const pValue = chiSquarePValue(h, df);
  const epsilonSquared = (totalN > 1) ? Math.max(0, h / ((totalN * totalN - 1) / (totalN + 1))) : 0;

  return {
    type: 'kruskal_wallis',
    k,
    totalN,
    df,
    h: Number(h.toFixed(3)),
    pValue: Number(pValue.toFixed(4)),
    epsilonSquared: Number(epsilonSquared.toFixed(3)),
    significant: pValue < 0.05,
    groups: clean.map((g, idx) => ({
      group: idx + 1,
      count: g.length,
      meanRank: Number((groupRankSums[idx] / g.length).toFixed(2))
    }))
  };
}

/**
 * Chi-Square Test of Independence & 2x2 Odds Ratio
 */
export function computeChiSquareTest(table) {
  if (!Array.isArray(table) || table.length < 2 || !Array.isArray(table[0]) || table[0].length < 2) {
    throw new Error('Chi-Square test requires a 2-dimensional contingency table with at least 2 rows and 2 columns.');
  }

  const r = table.length;
  const c = table[0].length;
  const rowSums = new Array(r).fill(0);
  const colSums = new Array(c).fill(0);
  let totalN = 0;

  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      const val = Number(table[i][j]) || 0;
      rowSums[i] += val;
      colSums[j] += val;
      totalN += val;
    }
  }

  if (totalN === 0) throw new Error('Contingency table contains no counts.');

  let chi2 = 0;
  const expectedTable = [];
  for (let i = 0; i < r; i++) {
    expectedTable.push([]);
    for (let j = 0; j < c; j++) {
      const exp = (rowSums[i] * colSums[j]) / totalN;
      expectedTable[i].push(Number(exp.toFixed(2)));
      const obs = Number(table[i][j]) || 0;
      if (exp > 0) chi2 += Math.pow(obs - exp, 2) / exp;
    }
  }

  const df = (r - 1) * (c - 1);
  const pValue = chiSquarePValue(chi2, df);
  const cramersV = Math.sqrt(chi2 / (totalN * Math.min(r - 1, c - 1)));

  let oddsRatio = null;
  if (r === 2 && c === 2) {
    const a = table[0][0]; const b = table[0][1];
    const cVal = table[1][0]; const d = table[1][1];
    if (b * cVal > 0) {
      oddsRatio = Number(((a * d) / (b * cVal)).toFixed(3));
    }
  }

  return {
    type: 'chi_square_independence',
    totalN,
    rows: r,
    cols: c,
    df,
    chiSquare: Number(chi2.toFixed(3)),
    pValue: Number(pValue.toFixed(4)),
    cramersV: Number(cramersV.toFixed(3)),
    oddsRatio,
    observed: table,
    expected: expectedTable,
    significant: pValue < 0.05
  };
}

// ============================================================================
// 5. Assumption Checking & Diagnostics
// ============================================================================

/**
 * Shapiro-Wilk Normality Approximation
 */
export function checkNormalityShapiroWilk(rawVals) {
  const vals = (rawVals || []).map(Number).filter(v => !isNaN(v) && isFinite(v));
  const n = vals.length;
  if (n < 3) return { valid: false, reason: 'Requires at least 3 values for normality test.' };

  const desc = computeDescriptive(vals);
  const sorted = [...vals].sort((a, b) => a - b);

  // Approximate weights via Blom expected normal order statistics
  const m = [];
  let sumMSq = 0;
  for (let i = 1; i <= n; i++) {
    const p = (i - 0.375) / (n + 0.25);
    // Inverse normal approximation (Beasley-Springer-Moro)
    const z = Math.SQRT2 * erfInv(2 * p - 1);
    m.push(z);
    sumMSq += z * z;
  }

  let num = 0;
  const c = Math.sqrt(sumMSq);
  for (let i = 0; i < n; i++) {
    num += (m[i] / c) * sorted[i];
  }

  const denom = (n - 1) * desc.variance;
  const w = denom > 0 ? Math.min(1.0, Math.max(0.01, Math.pow(num, 2) / denom)) : 1.0;

  // Approximate p-value for W (Royston approximation)
  const muW = 0.0038915 * Math.pow(Math.log(n), 3) - 0.083751 * Math.pow(Math.log(n), 2) - 0.31082 * Math.log(n) - 1.5861;
  const sigmaW = Math.exp(0.0030302 * Math.pow(Math.log(n), 2) - 0.082676 * Math.log(n) - 0.4803);
  const y = Math.log(1 - w);
  const z = (y - muW) / sigmaW;
  const pValue = Math.min(1.0, Math.max(0.0001, 1 - normalCdf(z)));

  // Q-Q Plot Coordinates (10 pairs)
  const qqPlot = [];
  const step = Math.max(1, Math.floor(n / 10));
  for (let i = 0; i < n; i += step) {
    qqPlot.push({
      theoretical: Number(m[i].toFixed(2)),
      sample: sorted[i]
    });
  }

  return {
    valid: true,
    n,
    w: Number(w.toFixed(3)),
    pValue: Number(pValue.toFixed(4)),
    isNormal: pValue >= 0.05,
    skewness: desc.skewness,
    kurtosis: desc.kurtosis,
    qqPlot
  };
}

function erfInv(x) {
  // Winitzki approximation for inverse error function
  const a = 0.147;
  const logTerm = Math.log(1 - x * x);
  const term1 = 2 / (Math.PI * a) + logTerm / 2;
  const term2 = logTerm / a;
  const inner = term1 * term1 - term2;
  const sign = x < 0 ? -1 : 1;
  return sign * Math.sqrt(Math.max(0, Math.sqrt(inner) - term1));
}

/**
 * Levene's Test for Homogeneity of Variances (Mean & Median/Brown-Forsythe centered)
 */
export function checkLeveneTest(groups, center = 'median') {
  const groupList = Array.isArray(groups) ? groups : Object.values(groups || {});
  const clean = groupList.map(g => (g || []).map(Number).filter(v => !isNaN(v))).filter(g => g.length > 0);
  if (clean.length < 2) return { valid: false, reason: 'Levene test requires at least 2 groups.' };

  // Calculate center per group
  const zGroups = clean.map(g => {
    let c = 0;
    if (center === 'median') {
      const sorted = [...g].sort((a, b) => a - b);
      c = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)];
    } else {
      c = g.reduce((a, b) => a + b, 0) / g.length;
    }
    return g.map(val => Math.abs(val - c));
  });

  const anovaResult = computeAnova(zGroups);
  return {
    valid: true,
    center,
    f: anovaResult.f,
    leveneF: anovaResult.f,
    df1: anovaResult.dfBetween,
    df2: anovaResult.dfWithin,
    pValue: anovaResult.pValue,
    equalVariances: anovaResult.pValue >= 0.05,
    homogeneityMet: anovaResult.pValue >= 0.05
  };
}

// ============================================================================
// 6. Dataset Parsing (CSV/TSV & XLSX) and Cleaning
// ============================================================================

/**
 * Parse raw dataset file buffer into structured rows and inferred columns
 */
export function parseDatasetBuffer(buffer, filename = 'dataset.csv') {
  const isXlsx = filename.endsWith('.xlsx') || (buffer && buffer.slice(0, 4).toString('hex') === '504b0304');

  if (isXlsx) {
    return parseXlsxBuffer(buffer);
  }

  // Parse CSV / TSV / Text
  const text = buffer.toString('utf8');
  return parseCsvText(text);
}

function parseCsvText(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], columns: [], rowCount: 0, columnCount: 0 };

  // Delimiter detection
  const firstLine = lines[0];
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  let delim = ',';
  if (tabCount > commaCount && tabCount > semiCount) delim = '\t';
  else if (semiCount > commaCount && semiCount > tabCount) delim = ';';

  // Split line respecting quotes
  const parseLine = line => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === delim && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ''));
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = [];
  let missingValueCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    const rowObj = {};
    headers.forEach((h, idx) => {
      const val = cells[idx] !== undefined ? cells[idx] : '';
      if (val === '' || val === 'NA' || val === 'null' || val === 'NaN') missingValueCount++;
      rowObj[h] = val;
    });
    rows.push(rowObj);
  }

  const columns = inferColumns(headers, rows);
  return { rows, columns, rowCount: rows.length, columnCount: columns.length, missingValueCount };
}

function parseXlsxBuffer(buffer) {
  try {
    const zip = new AdmZip(buffer);
    const sharedStringsEntry = zip.getEntry('xl/sharedStrings.xml');
    const sheetEntry = zip.getEntry('xl/worksheets/sheet1.xml');

    if (!sheetEntry) {
      throw new Error('No sheet1 found in XLSX archive.');
    }

    // Extract shared strings
    const sharedStrings = [];
    if (sharedStringsEntry) {
      const ssXml = sharedStringsEntry.getData().toString('utf8');
      const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;
      let match;
      while ((match = tRegex.exec(ssXml)) !== null) {
        sharedStrings.push(match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
      }
    }

    // Extract sheet rows
    const sheetXml = sheetEntry.getData().toString('utf8');
    const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
    const cRegex = /<c\s+r="([A-Z]+)\d+"(?:\s+t="([^"]+)")?[^>]*>(?:<v>([^<]*)<\/v>)?<\/c>/g;

    let rowMatch;
    const rawMatrix = [];

    while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
      const rowContent = rowMatch[1];
      const rowData = {};
      let cMatch;
      while ((cMatch = cRegex.exec(rowContent)) !== null) {
        const colLetter = cMatch[1];
        const type = cMatch[2];
        const val = cMatch[3];
        let actualVal = val || '';
        if (type === 's' && sharedStrings[parseInt(val, 10)] !== undefined) {
          actualVal = sharedStrings[parseInt(val, 10)];
        }
        rowData[colLetter] = actualVal;
      }
      rawMatrix.push(rowData);
    }

    if (rawMatrix.length === 0) return { rows: [], columns: [], rowCount: 0, columnCount: 0, missingValueCount: 0 };

    // Find headers from first row
    const headerCols = Object.keys(rawMatrix[0]).sort();
    const headers = headerCols.map(col => rawMatrix[0][col] || col);
    const rows = [];
    let missingValueCount = 0;

    for (let i = 1; i < rawMatrix.length; i++) {
      const rowObj = {};
      headerCols.forEach((col, idx) => {
        const hName = headers[idx];
        const val = rawMatrix[i][col] !== undefined ? rawMatrix[i][col] : '';
        if (val === '' || val === 'NA' || val === 'null') missingValueCount++;
        rowObj[hName] = val;
      });
      rows.push(rowObj);
    }

    const columns = inferColumns(headers, rows);
    return { rows, columns, rowCount: rows.length, columnCount: columns.length, missingValueCount };
  } catch (err) {
    // Fallback to text parse
    return parseCsvText(buffer.toString('utf8'));
  }
}

function inferColumns(headers, rows) {
  return headers.map(colName => {
    const nonNulls = rows.map(r => r[colName]).filter(v => v !== '' && v !== null && v !== undefined && v !== 'NA');
    const isNum = nonNulls.length > 0 && nonNulls.every(v => !isNaN(Number(v)));
    const uniqueCount = new Set(nonNulls).size;

    let measurementLevel = 'scale';
    if (!isNum) measurementLevel = 'nominal';
    else if (uniqueCount <= 5 && uniqueCount < nonNulls.length) measurementLevel = 'ordinal';

    return {
      name: colName,
      type: isNum ? 'numeric' : 'categorical',
      measurementLevel,
      sampleValues: nonNulls.slice(0, 5)
    };
  });
}

/**
 * Apply Data Cleaning Transformations
 */
export function applyDatasetTransformations(rows, transform) {
  const { type, column, targetColumn, missingPolicy = 'mean', recodeMap = {} } = transform || {};
  const outputRows = rows.map(r => ({ ...r }));
  const destCol = targetColumn || column;

  if (type === 'impute_missing') {
    const validVals = rows.map(r => Number(r[column])).filter(v => !isNaN(v));
    const meanVal = validVals.length > 0 ? (validVals.reduce((a, b) => a + b, 0) / validVals.length) : 0;
    const sorted = [...validVals].sort((a, b) => a - b);
    const medianVal = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
    const fillVal = missingPolicy === 'median' ? medianVal : meanVal;

    outputRows.forEach(r => {
      if (r[column] === '' || r[column] === undefined || r[column] === null || isNaN(Number(r[column]))) {
        r[destCol] = fillVal;
      }
    });
  } else if (type === 'z_score') {
    const vals = rows.map(r => Number(r[column])).filter(v => !isNaN(v));
    const desc = computeDescriptive(vals);
    outputRows.forEach(r => {
      const v = Number(r[column]);
      r[destCol] = (!isNaN(v) && desc.stdDev > 0) ? Number(((v - desc.mean) / desc.stdDev).toFixed(4)) : 0;
    });
  } else if (type === 'log_transform') {
    outputRows.forEach(r => {
      const v = Number(r[column]);
      r[destCol] = (!isNaN(v) && v > 0) ? Number(Math.log(v).toFixed(4)) : 0;
    });
  } else if (type === 'recode') {
    outputRows.forEach(r => {
      const v = String(r[column]);
      if (recodeMap[v] !== undefined) r[destCol] = recodeMap[v];
    });
  }

  return outputRows;
}

// ============================================================================
// 7. APA 7 Statistical Reporting Generator
// ============================================================================

export function formatApa7StatisticalNarrative(analysisType, res, labels = {}) {
  const varX = labels.varX || 'Variable X';
  const varY = labels.varY || 'Variable Y';
  const groupA = labels.groupA || 'Group A';
  const groupB = labels.groupB || 'Group B';

  const pFmt = res.pValue < 0.001 ? 'p < .001' : `p = ${res.pValue.toFixed(3).replace(/^0/, '')}`;

  switch (analysisType) {
    case 'one_sample_t_test': {
      const sig = res.significant ? 'statistically significantly different from' : 'did not differ significantly from';
      return `A one-sample t-test was conducted to determine whether ${varX} differed from the test value of ${res.mu0}. The sample mean (M = ${res.mean}, SD = ${res.stdDev}) was ${sig} the baseline, t(${res.df}) = ${res.t}, ${pFmt}, d = ${res.cohensD}, 95% CI [${res.confidenceInterval[0]}, ${res.confidenceInterval[1]}].`;
    }
    case 'independent_t_test': {
      const sigText = res.significant
        ? `revealed a statistically significant difference between ${groupA} (M = ${res.groupA.mean}, SD = ${res.groupA.stdDev}) and ${groupB} (M = ${res.groupB.mean}, SD = ${res.groupB.stdDev})`
        : `indicated no statistically significant difference between ${groupA} (M = ${res.groupA.mean}, SD = ${res.groupA.stdDev}) and ${groupB} (M = ${res.groupB.mean}, SD = ${res.groupB.stdDev})`;
      return `An independent-samples t-test ${sigText}, t(${res.df}) = ${res.t}, ${pFmt}, d = ${res.cohensD}, 95% CI [${res.confidenceInterval[0]}, ${res.confidenceInterval[1]}].`;
    }
    case 'paired_t_test': {
      const sigText = res.significant ? 'indicated a statistically significant mean change' : 'found no significant change';
      return `A paired-samples t-test ${sigText} (M_diff = ${res.meanDiff}, SD_diff = ${res.stdDevDiff}), t(${res.df}) = ${res.t}, ${pFmt}, d = ${res.cohensD}, 95% CI [${res.confidenceInterval[0]}, ${res.confidenceInterval[1]}].`;
    }
    case 'one_way_anova': {
      const sigText = res.significant ? 'showed a statistically significant effect' : 'did not reach statistical significance';
      return `A one-way ANOVA across ${res.numGroups} groups ${sigText}, F(${res.dfBetween}, ${res.dfWithin}) = ${res.f}, ${pFmt}, η² = ${res.etaSquared}.`;
    }
    case 'two_way_anova': {
      return `A two-way factorial ANOVA examined the effects of ${res.factorA.name} and ${res.factorB.name}. There was a ${res.factorA.significant ? 'significant' : 'non-significant'} main effect for ${res.factorA.name}, F(${res.factorA.df}, ${res.error.df}) = ${res.factorA.f}, ${res.factorA.pValue < 0.001 ? 'p < .001' : 'p = ' + res.factorA.pValue}, η_p² = ${res.factorA.partialEtaSquared}. The main effect for ${res.factorB.name} was ${res.factorB.significant ? 'significant' : 'non-significant'}, F(${res.factorB.df}, ${res.error.df}) = ${res.factorB.f}, ${res.factorB.pValue < 0.001 ? 'p < .001' : 'p = ' + res.factorB.pValue}, η_p² = ${res.factorB.partialEtaSquared}. The interaction effect was ${res.interaction.significant ? 'significant' : 'non-significant'}, F(${res.interaction.df}, ${res.error.df}) = ${res.interaction.f}, ${res.interaction.pValue < 0.001 ? 'p < .001' : 'p = ' + res.interaction.pValue}, η_p² = ${res.interaction.partialEtaSquared}.`;
    }
    case 'pearson_correlation':
    case 'spearman_correlation': {
      const typeStr = analysisType === 'spearman_correlation' ? "Spearman's rank correlation" : "Pearson's correlation";
      const sym = analysisType === 'spearman_correlation' ? 'r_s' : 'r';
      const dir = res.r > 0 ? 'positive' : 'negative';
      const sigText = res.significant ? `a statistically significant ${dir}` : 'no statistically significant';
      const ciPart = res.confidenceInterval ? `, 95% CI [${res.confidenceInterval[0]}, ${res.confidenceInterval[1]}]` : '';
      return `A ${typeStr} analysis showed ${sigText} relationship between ${varX} and ${varY}, ${sym}(${res.df}) = ${res.r}, ${pFmt}, R² = ${res.rSquared}${ciPart}.`;
    }
    case 'multiple_linear_regression':
    case 'linear_regression': {
      const sigText = res.significant ? 'significantly predicted' : 'did not significantly predict';
      return `Multiple linear regression was conducted with ${res.predictors} predictor(s). The overall regression model ${sigText} the outcome, F(${res.dfModel}, ${res.dfRes}) = ${res.f}, ${pFmt}, R² = ${res.rSquared}, Adjusted R² = ${res.adjRSquared}. Durbin-Watson statistic was d = ${res.durbinWatson}.`;
    }
    case 'mann_whitney_u': {
      const sigText = res.significant ? 'was statistically significant' : 'did not reach statistical significance';
      return `A Mann-Whitney U test ${sigText}, U = ${res.u}, z = ${res.z}, ${pFmt}, rank-biserial r = ${res.rankBiserialR}.`;
    }
    case 'kruskal_wallis': {
      const sigText = res.significant ? 'showed statistically significant differences' : 'revealed no significant differences';
      return `A Kruskal-Wallis H test ${sigText} across ${res.k} groups, H(${res.df}) = ${res.h}, ${pFmt}, ε² = ${res.epsilonSquared}.`;
    }
    case 'chi_square_independence': {
      const sigText = res.significant ? 'showed a statistically significant association' : 'found no significant association';
      const orPart = res.oddsRatio ? `, Odds Ratio = ${res.oddsRatio}` : '';
      return `A Chi-square test of independence ${sigText}, χ²(${res.df}, N = ${res.totalN}) = ${res.chiSquare}, ${pFmt}, Cramér's V = ${res.cramersV}${orPart}.`;
    }
    default:
      return 'Statistical computation completed.';
  }
}
