/**
 * Statistical Analysis Studio Engine
 * Pure JavaScript rigorous numerical statistics without hallucinations.
 * Provides Descriptive, Independent/Paired t-test, One-Way ANOVA,
 * Pearson/Spearman Correlation, and Simple Linear Regression with APA 7 formatting.
 */

// Helper: Numerical p-value estimation for t-distribution using regularized incomplete beta function
function ibeta(x, a, b) {
  // Continued fraction expansion for incomplete beta
  if (x === 0) return 0;
  if (x === 1) return 1;

  // Symmetry transformation
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - ibeta(1 - x, b, a);
  }

  const lbeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;

  const maxIter = 100;
  const eps = 3.0e-7;
  let c = 1.0;
  let d = 1.0 / (1.0 - (a + b) * x / (a + 1.0));
  let h = d;

  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    // Even step
    let num = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1.0 + num * d;
    if (Math.abs(d) < 1.0e-30) d = 1.0e-30;
    c = 1.0 + num / c;
    if (Math.abs(c) < 1.0e-30) c = 1.0e-30;
    d = 1.0 / d;
    h *= d * c;

    // Odd step
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

  return front * h;
}

// Log-gamma Lanczos approximation
function lgamma(z) {
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

// Student's t two-tailed p-value
export function tDistributionPValue(t, df) {
  if (df <= 0) return 1;
  const absT = Math.abs(t);
  const x = df / (df + absT * absT);
  const p = ibeta(x, df / 2, 0.5);
  return Math.min(Math.max(p, 0.0001), 1.0);
}

// F-distribution right-tail p-value
export function fDistributionPValue(f, df1, df2) {
  if (f <= 0 || df1 <= 0 || df2 <= 0) return 1;
  const x = df2 / (df2 + df1 * f);
  const p = ibeta(x, df2 / 2, df1 / 2);
  return Math.min(Math.max(p, 0.0001), 1.0);
}

/**
 * Descriptive statistics for an array of numbers
 */
export function computeDescriptive(rawVals) {
  const vals = (rawVals || []).map(Number).filter(v => !isNaN(v) && isFinite(v));
  const n = vals.length;
  if (n === 0) return { count: 0, mean: 0, median: 0, stdDev: 0, variance: 0, min: 0, max: 0, q1: 0, q3: 0, iqr: 0 };

  const sum = vals.reduce((acc, v) => acc + v, 0);
  const mean = sum / n;
  const sorted = [...vals].sort((a, b) => a - b);
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;

  const sqDiffs = vals.map(v => Math.pow(v - mean, 2));
  const variance = n > 1 ? sqDiffs.reduce((a, b) => a + b, 0) / (n - 1) : 0;
  const stdDev = Math.sqrt(variance);

  // Skewness
  const m3 = vals.reduce((acc, v) => acc + Math.pow(v - mean, 3), 0) / n;
  const skewness = stdDev > 0 ? m3 / Math.pow(stdDev, 3) : 0;

  return {
    count: n,
    mean: Number(mean.toFixed(4)),
    median: Number(median.toFixed(4)),
    stdDev: Number(stdDev.toFixed(4)),
    variance: Number(variance.toFixed(4)),
    min: sorted[0],
    max: sorted[n - 1],
    q1,
    q3,
    iqr,
    skewness: Number(skewness.toFixed(4))
  };
}

/**
 * Independent or Paired Two-Sample t-Test
 */
export function computeTTest(groupA, groupB, isPaired = false) {
  const a = (groupA || []).map(Number).filter(v => !isNaN(v));
  const b = (groupB || []).map(Number).filter(v => !isNaN(v));

  if (isPaired) {
    const pairLength = Math.min(a.length, b.length);
    if (pairLength < 2) throw new Error('Paired t-test requires at least 2 pairs of observations.');
    const diffs = [];
    for (let i = 0; i < pairLength; i++) diffs.push(a[i] - b[i]);
    const desc = computeDescriptive(diffs);
    const df = pairLength - 1;
    const se = desc.stdDev / Math.sqrt(pairLength);
    const t = se !== 0 ? desc.mean / se : 0;
    const pValue = tDistributionPValue(t, df);
    const cohensD = desc.stdDev !== 0 ? desc.mean / desc.stdDev : 0;

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
      significant: pValue < 0.05
    };
  }

  // Independent two-sample t-test (Welch's t-test)
  const descA = computeDescriptive(a);
  const descB = computeDescriptive(b);

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

  // Pooled standard deviation for Cohen's d
  const pooledVariance = ((descA.count - 1) * descA.variance + (descB.count - 1) * descB.variance) / (descA.count + descB.count - 2);
  const pooledStdDev = Math.sqrt(pooledVariance);
  const cohensD = pooledStdDev > 0 ? meanDiff / pooledStdDev : 0;

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
    significant: pValue < 0.05
  };
}

/**
 * One-Way ANOVA across multiple groups
 */
export function computeAnova(groups) {
  const cleanGroups = groups.map(g => (g || []).map(Number).filter(v => !isNaN(v))).filter(g => g.length > 0);
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

  // Sum of squares between
  let ssBetween = 0;
  for (const g of groupDescs) {
    ssBetween += g.count * Math.pow(g.mean - grandMean, 2);
  }

  // Sum of squares within
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
  const etaSquared = (ssBetween + ssWithin) > 0 ? ssBetween / (ssBetween + ssWithin) : 0;

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
    significant: pValue < 0.05,
    groups: groupDescs.map(g => ({ count: g.count, mean: g.mean, stdDev: g.stdDev }))
  };
}

/**
 * Correlation: Pearson r or Spearman rank rho
 */
export function computeCorrelation(xVals, yVals, method = 'pearson') {
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
    // Rank transform
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
  const t = Math.abs(boundedR) < 1 ? boundedR * Math.sqrt(df / (1 - Math.pow(boundedR, 2))) : 0;
  const pValue = tDistributionPValue(t, df);

  return {
    type: method === 'spearman' ? 'spearman_correlation' : 'pearson_correlation',
    n: x.length,
    df,
    r: Number(boundedR.toFixed(3)),
    rSquared: Number((boundedR * boundedR).toFixed(3)),
    t: Number(t.toFixed(3)),
    pValue: Number(pValue.toFixed(4)),
    significant: pValue < 0.05
  };
}

/**
 * Simple Linear Regression: Y = b0 + b1 * X
 */
export function computeLinearRegression(xVals, yVals) {
  const corr = computeCorrelation(xVals, yVals, 'pearson');
  const n = corr.n;
  const descX = computeDescriptive(xVals);
  const descY = computeDescriptive(yVals);

  const b1 = descX.stdDev > 0 ? (corr.r * descY.stdDev) / descX.stdDev : 0;
  const b0 = descY.mean - b1 * descX.mean;

  // Residual sum of squares
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const xi = Number(xVals[i]);
    const yi = Number(yVals[i]);
    const yPred = b0 + b1 * xi;
    ssRes += Math.pow(yi - yPred, 2);
    ssTot += Math.pow(yi - descY.mean, 2);
  }

  const se = Math.sqrt(ssRes / (n - 2));
  const f = (ssTot - ssRes) / (ssRes / (n - 2));
  const pValue = fDistributionPValue(f, 1, n - 2);

  return {
    type: 'linear_regression',
    n,
    slope: Number(b1.toFixed(4)),
    intercept: Number(b0.toFixed(4)),
    r: corr.r,
    rSquared: corr.rSquared,
    standardError: Number(se.toFixed(4)),
    f: Number(f.toFixed(3)),
    pValue: Number(pValue.toFixed(4)),
    equation: `Y = ${b0.toFixed(3)} + ${b1.toFixed(3)}*X`,
    significant: pValue < 0.05
  };
}

/**
 * Generate APA 7th Edition Statistical Narrative
 */
export function formatApa7StatisticalNarrative(analysisType, res, labels = {}) {
  const varX = labels.varX || 'Variable X';
  const varY = labels.varY || 'Variable Y';
  const groupA = labels.groupA || 'Group A';
  const groupB = labels.groupB || 'Group B';

  const pFmt = res.pValue < 0.001 ? 'p < .001' : `p = ${res.pValue.toFixed(3).replace(/^0/, '')}`;

  switch (analysisType) {
    case 'independent_t_test': {
      const sigText = res.significant
        ? `revealed a statistically significant difference between ${groupA} (M = ${res.groupA.mean}, SD = ${res.groupA.stdDev}) and ${groupB} (M = ${res.groupB.mean}, SD = ${res.groupB.stdDev})`
        : `indicated no statistically significant difference between ${groupA} (M = ${res.groupA.mean}, SD = ${res.groupA.stdDev}) and ${groupB} (M = ${res.groupB.mean}, SD = ${res.groupB.stdDev})`;
      return `An independent-samples t-test ${sigText}, t(${res.df}) = ${res.t}, ${pFmt}, d = ${res.cohensD}.`;
    }
    case 'paired_t_test': {
      const sigText = res.significant ? 'indicated a statistically significant mean change' : 'found no significant change';
      return `A paired-samples t-test ${sigText} (M_diff = ${res.meanDiff}, SD_diff = ${res.stdDevDiff}), t(${res.df}) = ${res.t}, ${pFmt}, d = ${res.cohensD}.`;
    }
    case 'one_way_anova': {
      const sigText = res.significant ? 'showed a statistically significant effect' : 'did not reach statistical significance';
      return `A one-way ANOVA across ${res.numGroups} groups ${sigText}, F(${res.dfBetween}, ${res.dfWithin}) = ${res.f}, ${pFmt}, η² = ${res.etaSquared}.`;
    }
    case 'pearson_correlation':
    case 'spearman_correlation': {
      const typeStr = analysisType === 'spearman_correlation' ? "Spearman's rank correlation" : "Pearson's correlation";
      const sym = analysisType === 'spearman_correlation' ? 'r_s' : 'r';
      const dir = res.r > 0 ? 'positive' : 'negative';
      const sigText = res.significant ? `a statistically significant ${dir}` : 'no statistically significant';
      return `A ${typeStr} analysis showed ${sigText} relationship between ${varX} and ${varY}, ${sym}(${res.df}) = ${res.r}, ${pFmt}, R² = ${res.rSquared}.`;
    }
    case 'linear_regression': {
      const sigText = res.significant ? 'significantly predicted' : 'did not significantly predict';
      return `A simple linear regression was calculated to predict ${varY} based on ${varX}. A significant regression equation was found (F(1, ${res.n - 2}) = ${res.f}, ${pFmt}), with an R² of ${res.rSquared}. The model predicted ${varY} as ${res.equation}.`;
    }
    default:
      return 'Statistical computation completed.';
  }
}
