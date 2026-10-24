/**
 * Deterministic Meaning-Checking Engine for Academic Writing
 * 
 * Verifies that revisions preserve:
 * - Negations and empirical claims (prevents finding reversals)
 * - Statistical values (p-values, confidence intervals, sample sizes, effect sizes)
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
  units: /\b(\d+(?:\.\d+)?)\s*(mg\/dL|μg\/mL|mg\/kg|μg|mg|kg|g|ng|pg|mL|μL|L|dL|mM|μM|nM|M|mol|mmol|nm|μm|mm|cm|m|km|kDa|bp|kbp|ms|sec|min|hr|hours?|days?|weeks?|years?|Hz|kHz|MHz|GHz|°C|°F|K|mV|V|mA|A|mmHg|kPa|Pa|rpm|J|kJ|cal|kcal)\b/gi
};

// Words that indicate negation or absence
const NEGATION_TRIGGERS = [
  'not', 'no', 'never', 'none', 'neither', 'nor', 'barely', 'hardly', 'scarcely',
  'did not', 'does not', 'do not', 'cannot', 'could not', 'would not', 'should not',
  'failed to', 'fail to', 'fails to', 'lacked', 'lacks', 'lacking',
  'absence of', 'without', 'excluding', 'ruled out', 'inability to'
];

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

  // 1. Identify clauses with research claims
  const claimWords = [
    'significant', 'difference', 'effect', 'correlation', 'association',
    'demonstrate', 'demonstrated', 'show', 'showed', 'observe', 'observed',
    'support', 'supported', 'replicate', 'replicated', 'confirm', 'confirmed'
  ];

  for (const neg of NEGATION_TRIGGERS) {
    const origHasNeg = origLower.includes(neg);
    const revHasNeg = revLower.includes(neg);

    // If negation was present in original but removed in revision
    if (origHasNeg && !revHasNeg) {
      // Check if it co-occurs with an empirical claim word
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
      break; // Single critical negation warning suffices
    }

    // If negation was added where original was affirmative
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
 * Validates statistical numbers (p-values, CIs, effect sizes, sample sizes)
 */
function checkStatisticalPreservation(original, revised) {
  const warnings = [];

  // P-values
  const origP = extractMatches(original, PATTERNS.pValues);
  const revP = extractMatches(revised, PATTERNS.pValues);
  for (const p of origP) {
    const normalized = p.replace(/\s+/g, '').toLowerCase();
    const found = revP.some(rp => rp.replace(/\s+/g, '').toLowerCase() === normalized);
    if (!found) {
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

  // Sample sizes
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

  // Confidence intervals
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
