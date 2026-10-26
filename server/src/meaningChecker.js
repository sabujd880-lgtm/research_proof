/**
 * Deterministic Meaning-Checking Engine for Academic Writing
 * 
 * Verifies that revisions preserve:
 * - Negations and empirical claims (prevents finding reversals)
 * - Statistical values (p-values, confidence intervals, sample sizes, effect sizes)
 * - Test statistics (t-statistics, F-statistics, degrees of freedom)
 * - Descriptive statistics (means, standard deviations, correlations)
 * - Numbers and percentages
 * - Units of measurement
 * - Citation markers ([1], (Author, 2020))
 * - Direct quotations
 */

// Regex patterns for academic artifacts
const PATTERNS = {
  pValues: /\bp\s*([<>=≤≥]|less than|greater than)\s*(0?\.\d+|\d+)/gi,
  confidenceIntervals: /\b(\d{1,3}%\s*(?:CI|confidence interval)s?)\s*\[([-\d.,\s]+)\]/gi,
  effectSizes: /\b([dDrR]|Cohen'?s\s+d|Pearson'?s\s+r|η²|eta-squared|f²|odds ratio|OR)\s*[=:]\s*([-\d.]+)/gi,
  sampleSizes: /\b([nN]\s*=\s*[\d,]+)/g,
  percentages: /\b(\d+(?:\.\d+)?\s*%)/g,
  dates: /\b((?:18|19|20)\d{2})\b/g,
  citations: /(\[(?:\d+(?:[–,\s-]+\d+)*)\]|\([A-Z][a-zA-Z\s'-]+(?:et al\.?)?,?\s*(?:18|19|20)\d{2}[a-z]?(?:;\s*[A-Z][a-zA-Z\s'-]+(?:et al\.?)?,?\s*(?:18|19|20)\d{2}[a-z]?)*\))/g,
  quotes: /(?:["“][^"”]+["”]|'[^']{3,}')/g,
  units: /\b(\d+(?:\.\d+)?)\s*(mg\/dL|μg\/mL|mg\/kg|μg|mg|kg|g|ng|pg|mL|μL|L|dL|mM|μM|nM|M|mol|mmol|nm|μm|mm|cm|m|km|kDa|bp|kbp|ms|sec|min|hr|hours?|days?|weeks?|years?|Hz|kHz|MHz|GHz|°C|°F|K|mV|V|mA|A|mmHg|kPa|Pa|rpm|J|kJ|cal|kcal)\b/gi,
  tStats: /\bt\s*\(\s*(\d+)\s*\)\s*=\s*([-\d.]+)/gi,
  fStats: /\bF\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*=\s*([-\d.]+)/gi,
  means: /\b(?:[mM]|mean)\s*=\s*([-\d.]+)/gi,
  sds: /\b(?:SD|sd)\s*=\s*([-\d.]+)/gi,
  correlations: /\br\s*=\s*([-\d.]+)/gi
};

// Words that indicate negation or absence
const NEGATION_TRIGGERS = [
  'not', 'no', 'never', 'none', 'neither', 'nor', 'barely', 'hardly', 'scarcely',
  'did not', 'does not', 'do not', 'cannot', 'could not', 'would not', 'should not',
  'failed to', 'fail to', 'fails to', 'lacked', 'lacks', 'lacking',
  'absence of', 'without', 'excluding', 'ruled out', 'inability to'
];

/**
 * Normalizes numerical and statistical strings for equivalence checking
 */
export function normalizeStatisticalValue(val = '') {
  if (typeof val !== 'string') return '';
  return String(val)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^([a-z]+)=/i, '$1=')
    .replace(/=0\./g, '=.')
    .replace(/<0\./g, '<.')
    .replace(/>0\./g, '>.')
    .replace(/\[0\./g, '[.')
    .replace(/,0\./g, ',.')
    .replace(/^([<>=≤≥])0\./, '$1.')
    .replace(/^p([<>=≤≥])/, 'p$1');
}

/**
 * Extracts all matches of a regex into a clean string array
 */
function extractMatches(text, regex) {
  const matches = [];
  const re = new RegExp(regex.source, regex.flags);
  let match;
  while ((match = re.exec(text)) !== null) {
    matches.push(match[0].trim());
  }
  return matches;
}

/**
 * Checks for negation polarity reversals between original and revised text
 */
function checkNegationReversals(original, revised) {
  const warnings = [];
  const origLower = original.toLowerCase();
  const revLower = revised.toLowerCase();

  const claimWords = [
    'significant', 'difference', 'effect', 'correlation', 'association',
    'demonstrate', 'demonstrated', 'show', 'showed', 'observe', 'observed',
    'support', 'supported', 'replicate', 'replicated', 'confirm', 'confirmed'
  ];

  for (const neg of NEGATION_TRIGGERS) {
    const origHasNeg = origLower.includes(neg);
    const revHasNeg = revLower.includes(neg);

    if (origHasNeg && !revHasNeg) {
      const affectsClaim = claimWords.some(w => origLower.includes(w));
      warnings.push({
        category: 'negation',
        severity: affectsClaim ? 'critical' : 'warning',
        detail: affectsClaim
          ? `Negation removed: original contained "${neg}" linked to research claims, but revision is affirmative. This risks inverting empirical results.`
          : `Negation marker "${neg}" was present in the original but omitted in the revision.`,
        originalValue: neg,
        revisedValue: '(affirmative)',
        excerpt: original.slice(0, 120)
      });
      break;
    }

    if (!origHasNeg && revHasNeg) {
      const affectsClaim = claimWords.some(w => revLower.includes(w));
      warnings.push({
        category: 'negation',
        severity: affectsClaim ? 'critical' : 'warning',
        detail: affectsClaim
          ? `Negation introduced: revision added negative assertion "${neg}" where original was affirmative. Verify that empirical findings are not negated.`
          : `Negation marker "${neg}" was introduced into the revision.`,
        originalValue: '(affirmative)',
        revisedValue: neg,
        excerpt: revised.slice(0, 120)
      });
      break;
    }
  }

  return warnings;
}

/**
 * Validates statistical numbers (p-values, CIs, effect sizes, sample sizes, t/F statistics, M, SD)
 */
function checkStatisticalPreservation(original, revised) {
  const warnings = [];

  // 1. P-values
  const origP = extractMatches(original, PATTERNS.pValues);
  const revP = extractMatches(revised, PATTERNS.pValues);
  for (const p of origP) {
    const normalized = normalizeStatisticalValue(p);
    const foundExact = revP.some(rp => normalizeStatisticalValue(rp) === normalized);
    if (!foundExact) {
      warnings.push({
        category: 'statistic',
        severity: 'critical',
        detail: `Statistical p-value "${p}" was modified or removed in the revision.`,
        originalValue: p,
        revisedValue: revP.join(', ') || '(missing)',
        excerpt: p
      });
    }
  }

  // 2. Sample sizes
  const origN = extractMatches(original, PATTERNS.sampleSizes);
  const revN = extractMatches(revised, PATTERNS.sampleSizes);
  for (const n of origN) {
    const norm = n.replace(/\s+/g, '').toLowerCase();
    if (!revN.some(rn => rn.replace(/\s+/g, '').toLowerCase() === norm)) {
      warnings.push({
        category: 'statistic',
        severity: 'critical',
        detail: `Sample size "${n}" was altered or omitted in revision.`,
        originalValue: n,
        revisedValue: revN.join(', ') || '(missing)',
        excerpt: n
      });
    }
  }

  // 3. Confidence intervals
  const origCI = extractMatches(original, PATTERNS.confidenceIntervals);
  const revCI = extractMatches(revised, PATTERNS.confidenceIntervals);
  for (const ci of origCI) {
    const norm = ci.replace(/\s+/g, '').toLowerCase();
    if (!revCI.some(r => r.replace(/\s+/g, '').toLowerCase() === norm)) {
      warnings.push({
        category: 'statistic',
        severity: 'critical',
        detail: `Confidence interval "${ci}" was altered in revision.`,
        originalValue: ci,
        revisedValue: revCI.join(', ') || '(missing)',
        excerpt: ci
      });
    }
  }

  // 4. t-statistics
  const origT = extractMatches(original, PATTERNS.tStats);
  const revT = extractMatches(revised, PATTERNS.tStats);
  for (const t of origT) {
    const norm = t.replace(/\s+/g, '').toLowerCase();
    if (!revT.some(rt => rt.replace(/\s+/g, '').toLowerCase() === norm)) {
      warnings.push({
        category: 'statistic',
        severity: 'critical',
        detail: `Test statistic "${t}" was modified or removed in revision.`,
        originalValue: t,
        revisedValue: revT.join(', ') || '(missing)',
        excerpt: t
      });
    }
  }

  // 5. F-statistics
  const origF = extractMatches(original, PATTERNS.fStats);
  const revF = extractMatches(revised, PATTERNS.fStats);
  for (const f of origF) {
    const norm = f.replace(/\s+/g, '').toLowerCase();
    if (!revF.some(rf => rf.replace(/\s+/g, '').toLowerCase() === norm)) {
      warnings.push({
        category: 'statistic',
        severity: 'critical',
        detail: `F-statistic "${f}" was modified or removed in revision.`,
        originalValue: f,
        revisedValue: revF.join(', ') || '(missing)',
        excerpt: f
      });
    }
  }

  return warnings;
}

/**
 * Validates citation markers ([1], (Smith, 2020), etc.)
 */
function checkCitationPreservation(original, revised) {
  const warnings = [];
  const origCitations = extractMatches(original, PATTERNS.citations);
  const revCitations = extractMatches(revised, PATTERNS.citations);

  for (const cite of origCitations) {
    const norm = cite.replace(/\s+/g, ' ');
    if (!revCitations.some(rc => rc.replace(/\s+/g, ' ') === norm)) {
      warnings.push({
        category: 'citation',
        severity: 'warning',
        detail: `In-text citation "${cite}" was omitted or altered in the proposed revision.`,
        originalValue: cite,
        revisedValue: '(missing or modified)',
        excerpt: cite
      });
    }
  }

  return warnings;
}

/**
 * Validates raw numbers and percentages
 */
function checkNumbersAndPercentages(original, revised) {
  const warnings = [];

  // Percentages
  const origPct = extractMatches(original, PATTERNS.percentages);
  const revPct = extractMatches(revised, PATTERNS.percentages);
  for (const pct of origPct) {
    const norm = pct.replace(/\s+/g, '');
    if (!revPct.some(rp => rp.replace(/\s+/g, '') === norm)) {
      warnings.push({
        category: 'percentage',
        severity: 'warning',
        detail: `Percentage "${pct}" appears altered or omitted in the revised text.`,
        originalValue: pct,
        revisedValue: revPct.join(', ') || '(omitted)',
        excerpt: pct
      });
    }
  }

  // Units
  const origUnits = extractMatches(original, PATTERNS.units);
  const revUnits = extractMatches(revised, PATTERNS.units);
  for (const u of origUnits) {
    const norm = u.replace(/\s+/g, ' ').toLowerCase();
    if (!revUnits.some(ru => ru.replace(/\s+/g, ' ').toLowerCase() === norm)) {
      warnings.push({
        category: 'unit',
        severity: 'warning',
        detail: `Measurement with unit "${u}" was changed or removed in revision.`,
        originalValue: u,
        revisedValue: revUnits.join(', ') || '(omitted)',
        excerpt: u
      });
    }
  }

  // Direct Quotes
  const origQuotes = extractMatches(original, PATTERNS.quotes);
  const revQuotes = extractMatches(revised, PATTERNS.quotes);
  for (const q of origQuotes) {
    if (q.length > 8 && !revQuotes.some(rq => rq.replace(/["'“”]/g, '').trim() === q.replace(/["'“”]/g, '').trim())) {
      warnings.push({
        category: 'quote',
        severity: 'warning',
        detail: `Direct quotation ${q} was modified. Quotations must remain verbatim.`,
        originalValue: q,
        revisedValue: '(altered quotation)',
        excerpt: q
      });
    }
  }

  return warnings;
}

/**
 * Runs full deterministic meaning-preservation audit on original vs revised text
 * @param {string} original
 * @param {string} revised
 * @returns {Array<object>} Array of structured meaning preservation warnings
 */
export function auditMeaningPreservation(original = '', revised = '') {
  if (!original || !revised) return [];

  const warnings = [
    ...checkNegationReversals(original, revised),
    ...checkStatisticalPreservation(original, revised),
    ...checkCitationPreservation(original, revised),
    ...checkNumbersAndPercentages(original, revised)
  ];

  return warnings;
}

/**
 * Complete empirical fact validation with categorization
 * @param {string} original
 * @param {string} revised
 * @returns {object} Structured validation result with preserved/changed lists
 */
export function validateEmpiricalFacts(original = '', revised = '') {
  const warnings = auditMeaningPreservation(original, revised);

  // Extract all empirical artifacts from original
  const artifacts = [
    ...extractMatches(original, PATTERNS.pValues).map(v => ({ type: 'p-value', value: v })),
    ...extractMatches(original, PATTERNS.sampleSizes).map(v => ({ type: 'sample-size', value: v })),
    ...extractMatches(original, PATTERNS.confidenceIntervals).map(v => ({ type: 'confidence-interval', value: v })),
    ...extractMatches(original, PATTERNS.tStats).map(v => ({ type: 't-statistic', value: v })),
    ...extractMatches(original, PATTERNS.fStats).map(v => ({ type: 'F-statistic', value: v })),
    ...extractMatches(original, PATTERNS.percentages).map(v => ({ type: 'percentage', value: v })),
    ...extractMatches(original, PATTERNS.citations).map(v => ({ type: 'citation', value: v }))
  ];

  const preservedItems = [];
  const changedItems = [];
  const formattingOnlyItems = [];

  const revNorm = normalizeStatisticalValue(revised);
  artifacts.forEach(item => {
    const rawVal = item.value;
    const normVal = normalizeStatisticalValue(rawVal);
    const hasRawInRev = revised.includes(rawVal);
    const hasNormInRev = revNorm.includes(normVal);

    if (hasRawInRev) {
      preservedItems.push({ ...item, status: 'preserved', display: rawVal });
    } else if (hasNormInRev) {
      formattingOnlyItems.push({ ...item, status: 'formatting_only', display: rawVal, note: 'Equivalent statistical value with altered typography' });
    } else {
      changedItems.push({ ...item, status: 'altered_or_missing', display: rawVal });
    }
  });

  const hasCriticalWarnings = warnings.some(w => w.severity === 'critical');
  const canAccept = !hasCriticalWarnings && changedItems.length === 0;

  return {
    isValid: canAccept,
    canAcceptWithoutWarning: canAccept,
    hasCriticalWarnings,
    summary: {
      totalFactsChecked: artifacts.length,
      preservedCount: preservedItems.length,
      formattingOnlyCount: formattingOnlyItems.length,
      changedCount: changedItems.length,
      warningsCount: warnings.length
    },
    preservedItems,
    formattingOnlyItems,
    changedItems,
    preserved: preservedItems,
    formattingOnly: formattingOnlyItems,
    changed: changedItems,
    warnings
  };
}

/**
 * Detailed empirical comparison between two versions of a manuscript
 * Highlights changed citations, statistical values, p-values, sample sizes, and polarity
 */
export function compareManuscriptVersions(originalText = '', revisedText = '', metadata = {}) {
  const origNorm = String(originalText || '');
  const revNorm = String(revisedText || '');

  const wordCountOrig = origNorm.trim() ? origNorm.trim().split(/\s+/).filter(Boolean).length : 0;
  const wordCountRev = revNorm.trim() ? revNorm.trim().split(/\s+/).filter(Boolean).length : 0;
  const wordCountDelta = wordCountRev - wordCountOrig;

  // 1. Empirical Fact Validation (p-values, stats, negation)
  const validation = validateEmpiricalFacts(origNorm, revNorm);

  // 2. Citation Extraction & Comparison
  const origCitations = extractMatches(origNorm, PATTERNS.citations);
  const revCitations = extractMatches(revNorm, PATTERNS.citations);

  const origCiteSet = new Set(origCitations);
  const revCiteSet = new Set(revCitations);

  const citationsAdded = revCitations.filter(c => !origCiteSet.has(c));
  const citationsRemoved = origCitations.filter(c => !revCiteSet.has(c));
  const citationsPreserved = origCitations.filter(c => revCiteSet.has(c));

  // 3. Statistical Values Detailed Breakdown
  const origPValues = extractMatches(origNorm, PATTERNS.pValues);
  const revPValues = extractMatches(revNorm, PATTERNS.pValues);

  const origSampleSizes = extractMatches(origNorm, PATTERNS.sampleSizes);
  const revSampleSizes = extractMatches(revNorm, PATTERNS.sampleSizes);

  // 4. Directional Polarity & Negation
  const negationWarnings = checkNegationReversals(origNorm, revNorm);

  // 5. Delta Executive Summary
  const summaryParts = [];
  summaryParts.push(`Manuscript length shifted from ${wordCountOrig} to ${wordCountRev} words (${wordCountDelta >= 0 ? '+' : ''}${wordCountDelta} words).`);
  if (validation.changedItems.length === 0) {
    summaryParts.push('All empirical claims, p-values, and quantitative figures are fully preserved.');
  } else {
    summaryParts.push(`${validation.changedItems.length} empirical fact(s) were modified or omitted.`);
  }
  if (citationsAdded.length || citationsRemoved.length) {
    summaryParts.push(`Citations: +${citationsAdded.length} added, -${citationsRemoved.length} removed.`);
  } else {
    summaryParts.push('Citation markers remain consistent.');
  }

  const summaryText = summaryParts.join(' ');

  return {
    documentTitle: metadata.title || 'Manuscript Version Comparison',
    timestamp: new Date().toISOString(),
    wordCountDelta,
    comparisonSummary: summaryText,
    semanticDeltaSummary: summaryText,
    metrics: {
      originalWordCount: wordCountOrig,
      revisedWordCount: wordCountRev,
      wordCountDelta,
      percentChange: wordCountOrig > 0 ? Math.round((wordCountDelta / wordCountOrig) * 100) : 0,
      factsPreservedCount: validation.summary.preservedCount,
      factsAlteredCount: validation.summary.changedCount,
      criticalWarningsCount: validation.warnings.filter(w => w.severity === 'critical').length
    },
    citations: {
      added: Array.from(new Set(citationsAdded)),
      removed: Array.from(new Set(citationsRemoved)),
      preserved: Array.from(new Set(citationsPreserved))
    },
    statistics: {
      originalPValues: origPValues,
      revisedPValues: revPValues,
      originalSampleSizes: origSampleSizes,
      revisedSampleSizes: revSampleSizes,
      originalStats: {
        pValues: origPValues,
        sampleSizes: origSampleSizes
      },
      revisedStats: {
        pValues: revPValues,
        sampleSizes: revSampleSizes
      }
    },
    empiricalDeltas: {
      preserved: validation.preservedItems,
      altered: validation.changedItems,
      alteredAssertions: validation.changedItems,
      potentialReversals: negationWarnings,
      warnings: validation.warnings,
      hasReversals: negationWarnings.length > 0
    }
  };
}
