/**
 * Systematic Review Assistant Engine — Phase 8 Service Layer
 * Methodological evidence synthesis, deduplication, conflict management,
 * and PRISMA 2020 flow-reconciliation engine.
 */

// ============================================================================
// 1. Text Normalization & String Similarity
// ============================================================================

export function normalizeDoi(doi) {
  if (!doi || typeof doi !== 'string') return '';
  return doi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim();
}

export function normalizePmid(pmid) {
  if (!pmid || typeof pmid !== 'string') return '';
  return pmid.trim().replace(/^pmid:\s*/i, '').trim();
}

export function normalizeTitle(title) {
  if (!title || typeof title !== 'string') return '';
  return title
    .toLowerCase()
    .replace(/<[^>]+>/g, '') // remove HTML tags
    .replace(/[^\w\s]/g, '') // remove punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Standard Levenshtein Distance
 */
export function levenshteinDistance(a, b) {
  const s1 = a || '';
  const s2 = b || '';
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // deletion
        dp[i][j - 1] + 1,       // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

/**
 * Normalized string similarity ratio [0, 1]
 */
export function stringSimilarity(a, b) {
  const normA = normalizeTitle(a);
  const normB = normalizeTitle(b);
  if (!normA && !normB) return 1.0;
  if (!normA || !normB) return 0.0;
  if (normA === normB) return 1.0;

  const maxLen = Math.max(normA.length, normB.length);
  const dist = levenshteinDistance(normA, normB);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Author list overlap similarity (Jaccard on normalized last names)
 */
export function authorOverlapSimilarity(authorsA = [], authorsB = []) {
  if (!authorsA.length || !authorsB.length) return 0.0;
  const extractLastNames = (list) => {
    return new Set(
      list
        .map(a => {
          if (typeof a === 'string') {
            const parts = a.replace(/,\s*.+$/, '').trim().split(/\s+/);
            return parts[parts.length - 1].toLowerCase();
          }
          return (a.family || a.name || '').toLowerCase();
        })
        .filter(Boolean)
    );
  };

  const setA = extractLastNames(authorsA);
  const setB = extractLastNames(authorsB);
  if (!setA.size || !setB.size) return 0.0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0.0;
}

// ============================================================================
// 2. Systematic Review Deduplication Engine
// ============================================================================

/**
 * Classifies pairwise duplicate match between Record A and Record B
 */
export function classifyDuplicateMatch(recordA, recordB) {
  const doiA = normalizeDoi(recordA.doi);
  const doiB = normalizeDoi(recordB.doi);
  if (doiA && doiB && doiA === doiB) {
    return { isDuplicate: true, matchType: 'exact', similarityScore: 1.0, reason: 'Identical DOI' };
  }

  const pmidA = normalizePmid(recordA.pmid);
  const pmidB = normalizePmid(recordB.pmid);
  if (pmidA && pmidB && pmidA === pmidB) {
    return { isDuplicate: true, matchType: 'exact', similarityScore: 1.0, reason: 'Identical PMID' };
  }

  const titleA = normalizeTitle(recordA.title);
  const titleB = normalizeTitle(recordB.title);
  if (!titleA || !titleB) return { isDuplicate: false, matchType: 'none', similarityScore: 0.0 };

  const titleSim = stringSimilarity(titleA, titleB);
  const yearA = String(recordA.year || '').trim();
  const yearB = String(recordB.year || '').trim();
  const yearsMatch = yearA && yearB && Math.abs(parseInt(yearA, 10) - parseInt(yearB, 10)) <= 1;

  if (titleSim >= 0.98 && (yearsMatch || !yearA || !yearB)) {
    return { isDuplicate: true, matchType: 'exact', similarityScore: titleSim, reason: 'Identical title and publication period' };
  }

  if (titleSim >= 0.88 && yearsMatch) {
    const authorSim = authorOverlapSimilarity(recordA.authors, recordB.authors);
    return {
      isDuplicate: true,
      matchType: authorSim > 0.3 ? 'probable' : 'possible',
      similarityScore: Number(((titleSim * 0.7) + (authorSim * 0.3)).toFixed(3)),
      reason: 'High title similarity with matching year'
    };
  }

  if (titleSim >= 0.78) {
    const authorSim = authorOverlapSimilarity(recordA.authors, recordB.authors);
    if (authorSim >= 0.5) {
      return {
        isDuplicate: true,
        matchType: 'possible',
        similarityScore: Number(((titleSim * 0.6) + (authorSim * 0.4)).toFixed(3)),
        reason: 'Moderate title similarity with high author overlap'
      };
    }
  }

  return { isDuplicate: false, matchType: 'none', similarityScore: titleSim };
}

/**
 * Groups a collection of review records into unique canonical records and duplicate candidate sets
 */
export function identifyReviewDuplicates(records = []) {
  const duplicateGroups = [];
  const assigned = new Set();
  const duplicatesMap = new Map(); // recordId -> canonicalRecordId

  for (let i = 0; i < records.length; i++) {
    const recA = records[i];
    const idA = (recA._id || recA.id || `rec_${i}`).toString();
    if (assigned.has(idA)) continue;

    const groupMembers = [recA];

    for (let j = i + 1; j < records.length; j++) {
      const recB = records[j];
      const idB = (recB._id || recB.id || `rec_${j}`).toString();
      if (assigned.has(idB)) continue;

      const match = classifyDuplicateMatch(recA, recB);
      if (match.isDuplicate) {
        groupMembers.push(recB);
        assigned.add(idB);
        duplicatesMap.set(idB, idA);
      }
    }

    if (groupMembers.length > 1) {
      assigned.add(idA);
      // Select the canonical record (prefer record with abstract and DOI)
      groupMembers.sort((x, y) => {
        let scoreX = (x.doi ? 2 : 0) + (x.abstract ? 2 : 0) + (x.pmid ? 1 : 0);
        let scoreY = (y.doi ? 2 : 0) + (y.abstract ? 2 : 0) + (y.pmid ? 1 : 0);
        return scoreY - scoreX;
      });
      const canonical = groupMembers[0];
      const canonicalId = (canonical._id || canonical.id).toString();

      duplicateGroups.push({
        canonicalRecordId: canonicalId,
        recordIds: groupMembers.map(m => (m._id || m.id).toString()),
        matchType: groupMembers.some(m => classifyDuplicateMatch(canonical, m).matchType === 'exact') ? 'exact' : 'probable',
        records: groupMembers
      });
    }
  }

  return {
    duplicateGroups,
    duplicateCount: duplicateGroups.reduce((acc, g) => acc + (g.recordIds.length - 1), 0),
    duplicatesMap
  };
}

// ============================================================================
// 3. PRISMA 2020 Count Reconciliation & Flow Validation
// ============================================================================

/**
 * Derives exact, auditable PRISMA 2020 flow counts and checks reconciliation integrity
 */
export function reconcilePrisma2020Metrics(review, records = [], searchRuns = []) {
  // 1. Identification Stage
  let identifiedDatabases = 0;
  let identifiedRegisters = 0;
  let identifiedOther = 0;

  for (const run of searchRuns) {
    const count = Number(run.recordsRetrieved || 0);
    if (run.sourceType === 'register') {
      identifiedRegisters += count;
    } else if (run.sourceType === 'other_methods') {
      identifiedOther += count;
    } else {
      identifiedDatabases += count;
    }
  }

  // Fallback to record provenance if searchRuns not recorded
  if (searchRuns.length === 0 && records.length > 0) {
    identifiedDatabases = records.filter(r => r.sourceType !== 'other_methods' && r.sourceType !== 'register').length;
    identifiedRegisters = records.filter(r => r.sourceType === 'register').length;
    identifiedOther = records.filter(r => r.sourceType === 'other_methods').length;
  }

  const totalIdentified = identifiedDatabases + identifiedRegisters + identifiedOther;

  // Duplicates Removed
  const duplicates = records.filter(r => r.deduplicationStatus === 'duplicate');
  const duplicatesRemoved = duplicates.length;

  // Ineligible before screening
  const ineligibleBeforeScreening = records.filter(r => r.deduplicationStatus !== 'duplicate' && r.decision === 'excluded' && r.screeningStage === 'pre_screen').length;

  // 2. Screening Stage (Title & Abstract)
  const nonDuplicateRecords = records.filter(r => r.deduplicationStatus !== 'duplicate');
  const titleAbstractScreened = nonDuplicateRecords.filter(r => r.decision === 'included' || r.decision === 'excluded' || r.screeningStage === 'full_text' || r.screeningStage === 'included');
  const titleAbstractExcluded = nonDuplicateRecords.filter(r => r.screeningStage === 'title_abstract' && r.decision === 'excluded');

  // 3. Full-Text Retrieval Stage
  // Reports sought for retrieval = Title/Abstract Included records
  const soughtFullTextRecords = nonDuplicateRecords.filter(r => r.screeningStage === 'full_text' || r.screeningStage === 'included' || r.fullTextStatus === 'sought' || r.fullTextStatus === 'not_retrieved' || r.fullTextStatus === 'assessed');
  const soughtFullText = soughtFullTextRecords.length;
  const notRetrievedFullText = nonDuplicateRecords.filter(r => r.fullTextStatus === 'not_retrieved').length;

  // 4. Eligibility Assessment Stage
  const assessedFullTextRecords = nonDuplicateRecords.filter(r => r.fullTextStatus === 'assessed' || r.screeningStage === 'included' || (r.screeningStage === 'full_text' && r.decision === 'excluded'));
  const assessedFullText = Math.max(0, soughtFullText - notRetrievedFullText);

  // Full-Text Exclusions with Structured Reasons
  const fullTextExcludedRecords = nonDuplicateRecords.filter(r => r.screeningStage === 'full_text' && r.decision === 'excluded');
  const excludedFullText = fullTextExcludedRecords.length;

  const exclusionReasonsBreakdown = {};
  for (const r of fullTextExcludedRecords) {
    const reason = r.exclusionReason || 'Unspecified Reason';
    exclusionReasonsBreakdown[reason] = (exclusionReasonsBreakdown[reason] || 0) + 1;
  }

  // 5. Included Stage
  const includedStudiesRecords = nonDuplicateRecords.filter(r => r.screeningStage === 'included' || (r.decision === 'included' && r.screeningStage !== 'title_abstract'));
  const includedStudies = includedStudiesRecords.length;
  const includedReports = includedStudies; // 1:1 by default unless multi-report linking is present

  // 6. Reconciliation Integrity Audit
  const discrepancies = [];

  // Check 1: Screened + Duplicates + Ineligible <= Identified
  if (nonDuplicateRecords.length > totalIdentified && totalIdentified > 0) {
    discrepancies.push(`Total non-duplicate records (${nonDuplicateRecords.length}) exceeds identified records (${totalIdentified}).`);
  }

  // Check 2: Full-text sought + Title/Abstract excluded <= Screened
  if (soughtFullText + titleAbstractExcluded.length > nonDuplicateRecords.length && nonDuplicateRecords.length > 0) {
    discrepancies.push(`Sum of sought full texts (${soughtFullText}) and title exclusions (${titleAbstractExcluded.length}) exceeds non-duplicate records.`);
  }

  // Check 3: Assessed full text vs Excluded full text + Included studies
  const expectedIncluded = Math.max(0, assessedFullText - excludedFullText);
  if (assessedFullText > 0 && Math.abs(includedStudies - expectedIncluded) > 1) {
    discrepancies.push(`Included studies count (${includedStudies}) does not match Assessed (${assessedFullText}) minus Excluded (${excludedFullText}) = ${expectedIncluded}.`);
  }

  const isReconciled = discrepancies.length === 0;

  return {
    variant: review.reviewType === 'scoping_review' ? 'PRISMA_ScR' : 'PRISMA_2020',
    counts: {
      identified: totalIdentified,
      identifiedDatabases,
      identifiedRegisters,
      identifiedOther,
      duplicatesRemoved,
      ineligibleBeforeScreening,
      screenedTitleAbstract: titleAbstractScreened.length,
      excludedTitleAbstract: titleAbstractExcluded.length,
      soughtFullText,
      notRetrievedFullText,
      assessedFullText,
      excludedFullText,
      exclusionReasonsBreakdown,
      includedStudies,
      includedReports
    },
    isReconciled,
    discrepancies
  };
}

// ============================================================================
// 4. Methodological Risk-of-Bias Frameworks
// ============================================================================

export const RISK_OF_BIAS_TEMPLATES = {
  'RoB 2': {
    name: 'Cochrane Risk of Bias 2 (RoB 2)',
    description: 'Recommended tool for randomized controlled trials (RCTs).',
    domains: [
      { id: 'D1', name: 'Bias arising from the randomization process', prompt: 'Was allocation sequence random and concealed?' },
      { id: 'D2', name: 'Bias due to deviations from intended interventions', prompt: 'Were participants and carers aware of assigned intervention?' },
      { id: 'D3', name: 'Bias due to missing outcome data', prompt: 'Were outcome data available for nearly all participants randomized?' },
      { id: 'D4', name: 'Bias in measurement of the outcome', prompt: 'Was the method of outcome assessment appropriate and blinded?' },
      { id: 'D5', name: 'Bias in selection of the reported result', prompt: 'Were data analyzed in accordance with a pre-specified protocol?' }
    ],
    judgments: ['low', 'some_concerns', 'high']
  },
  'ROBINS-I': {
    name: 'Risk of Bias in Non-randomized Studies of Interventions (ROBINS-I)',
    description: 'Gold standard tool for cohort, case-control, and quasi-experimental studies.',
    domains: [
      { id: 'D1', name: 'Bias due to confounding', prompt: 'Did the study adequately control for major confounding factors?' },
      { id: 'D2', name: 'Bias in selection of participants into the study', prompt: 'Was selection into study related to intervention and outcome?' },
      { id: 'D3', name: 'Bias in classification of interventions', prompt: 'Were intervention groups clearly defined and recorded at baseline?' },
      { id: 'D4', name: 'Bias due to deviations from intended interventions', prompt: 'Did co-interventions or switching occur differentially?' },
      { id: 'D5', name: 'Bias due to missing data', prompt: 'Were participants excluded due to missing data or lost to follow-up?' },
      { id: 'D6', name: 'Bias in measurement of outcomes', prompt: 'Were outcome assessors unaware of intervention received?' },
      { id: 'D7', name: 'Bias in selection of the reported result', prompt: 'Are reported outcomes free from selective reporting?' }
    ],
    judgments: ['low', 'moderate', 'serious', 'critical', 'no_information']
  },
  'QUADAS-2': {
    name: 'Quality Assessment of Diagnostic Accuracy Studies (QUADAS-2)',
    description: 'Tool for diagnostic test accuracy systematic reviews.',
    domains: [
      { id: 'D1', name: 'Patient Selection', prompt: 'Was a consecutive or random sample of patients enrolled?' },
      { id: 'D2', name: 'Index Test', prompt: 'Were index test results interpreted without knowledge of reference standard?' },
      { id: 'D3', name: 'Reference Standard', prompt: 'Is the reference standard likely to correctly classify the condition?' },
      { id: 'D4', name: 'Flow and Timing', prompt: 'Was there an appropriate interval between index test and reference standard?' }
    ],
    judgments: ['low', 'high', 'unclear']
  }
};

/**
 * Computes deterministic overall Risk of Bias judgment from individual domain evaluations
 */
export function computeOverallRiskOfBias(toolName, domains = []) {
  if (!domains.length) return 'unclear';

  if (toolName === 'RoB 2') {
    if (domains.some(d => d.judgment === 'high')) return 'high';
    if (domains.some(d => d.judgment === 'some_concerns')) return 'some_concerns';
    if (domains.every(d => d.judgment === 'low')) return 'low';
    return 'some_concerns';
  }

  if (toolName === 'ROBINS-I') {
    if (domains.some(d => d.judgment === 'critical')) return 'critical';
    if (domains.some(d => d.judgment === 'serious')) return 'serious';
    if (domains.some(d => d.judgment === 'moderate')) return 'moderate';
    if (domains.every(d => d.judgment === 'low')) return 'low';
    return 'moderate';
  }

  if (toolName === 'QUADAS-2') {
    if (domains.some(d => d.judgment === 'high')) return 'high';
    if (domains.some(d => d.judgment === 'unclear')) return 'unclear';
    return 'low';
  }

  return 'low';
}

// ============================================================================
// 5. PRISMA 2020 27-Item Checklist Definition
// ============================================================================

export const PRISMA_2020_CHECKLIST_ITEMS = [
  { item: '1', section: 'Title', description: 'Identify the report as a systematic review.', essential: true },
  { item: '2', section: 'Abstract', description: 'See the PRISMA 2020 for Abstracts checklist.', essential: true },
  { item: '3', section: 'Introduction', topic: 'Rationale', description: 'Describe the rationale for the review in the context of existing knowledge.', essential: true },
  { item: '4', section: 'Introduction', topic: 'Objectives', description: 'Provide an explicit statement of the objective(s) or question(s) the review addresses (e.g., PICO).', essential: true },
  { item: '5', section: 'Methods', topic: 'Eligibility criteria', description: 'Specify inclusion and exclusion criteria and how studies were grouped for synthesis.', essential: true },
  { item: '6', section: 'Methods', topic: 'Information sources', description: 'Specify all databases, registers, and other sources searched, with search dates.', essential: true },
  { item: '7', section: 'Methods', topic: 'Search strategy', description: 'Present the full search strategies for all databases, registers, and websites.', essential: true },
  { item: '8', section: 'Methods', topic: 'Selection process', description: 'Specify the methods used to decide whether a study met the inclusion criteria (e.g. independent dual review).', essential: true },
  { item: '9', section: 'Methods', topic: 'Data collection process', description: 'Specify the methods used to extract data from reports, including validation and pilot testing.', essential: true },
  { item: '10a', section: 'Methods', topic: 'Data items', description: 'List and define all outcomes and other variables sought.', essential: true },
  { item: '11', section: 'Methods', topic: 'Study risk of bias assessment', description: 'Specify the tool(s) used to assess risk of bias in the included studies (e.g., RoB 2, ROBINS-I).', essential: true },
  { item: '12', section: 'Methods', topic: 'Effect measures', description: 'Specify for each outcome the effect measure(s) (e.g. risk ratio, mean difference) used.', essential: false },
  { item: '13a', section: 'Methods', topic: 'Synthesis methods', description: 'Describe the processes used to decide which studies were eligible for each synthesis.', essential: true },
  { item: '16a', section: 'Results', topic: 'Study selection', description: 'Describe the results of the search and selection process (using the PRISMA 2020 flow diagram).', essential: true },
  { item: '17', section: 'Results', topic: 'Study characteristics', description: 'Cite each included study and present its characteristics in an evidence table.', essential: true },
  { item: '18', section: 'Results', topic: 'Risk of bias in studies', description: 'Present assessments of risk of bias for each included study.', essential: true },
  { item: '19', section: 'Results', topic: 'Results of individual studies', description: 'For all outcomes, present summary statistics and effect estimates with confidence intervals.', essential: true },
  { item: '23', section: 'Discussion', topic: 'Discussion', description: 'Provide a general interpretation of the results in the context of other evidence.', essential: true },
  { item: '24a', section: 'Other', topic: 'Registration and protocol', description: 'Provide registration information, including register name and registration number (e.g., PROSPERO).', essential: true },
  { item: '25', section: 'Other', topic: 'Support', description: 'Describe sources of financial or non-financial support for the review.', essential: true },
  { item: '26', section: 'Other', topic: 'Competing interests', description: 'Declare any competing interests of review authors.', essential: true },
  { item: '27', section: 'Other', topic: 'Availability of data', description: 'Report which data extraction sheets, analytic code, or materials are publicly available.', essential: true }
];

// ============================================================================
// 6. CSV Study Records Parser
// ============================================================================

export function parseCsvStudyRecords(csvContent) {
  if (!csvContent || typeof csvContent !== 'string') return [];
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const parseCsvLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (!cols.some(c => c.length > 0)) continue;

    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] || '';
    });

    const title = row.title || row.articletitle || row.documenttitle || row.name || 'Untitled Record';
    const authorsStr = row.authors || row.author || row.investigators || '';
    const authors = authorsStr.split(/;|and|,/).map(a => a.trim()).filter(Boolean);
    const year = row.year || row.publicationyear || row.date || '';
    const journal = row.journal || row.sourcetitle || row.publication || '';
    const doi = normalizeDoi(row.doi || row.digitalobjectidentifier || '');
    const pmid = normalizePmid(row.pmid || row.pubmedid || '');
    const abstract = row.abstract || row.summary || '';

    records.push({
      title,
      authors: authors.length ? authors : ['Unknown'],
      year: year ? String(year).slice(0, 4) : '',
      journal,
      doi,
      pmid,
      abstract,
      sourceType: 'database'
    });
  }

  return records;
}

// ============================================================================
// 7. Interactive PRISMA 2020 SVG Generator
// ============================================================================

export function generatePrismaSvg(counts = {}) {
  const c = {
    identifiedDatabases: counts.identifiedDatabases || 0,
    identifiedRegisters: counts.identifiedRegisters || 0,
    identifiedOther: counts.identifiedOther || 0,
    duplicatesRemoved: counts.duplicatesRemoved || 0,
    ineligibleBeforeScreening: counts.ineligibleBeforeScreening || 0,
    screenedTitleAbstract: counts.screenedTitleAbstract || 0,
    excludedTitleAbstract: counts.excludedTitleAbstract || 0,
    soughtFullText: counts.soughtFullText || 0,
    notRetrievedFullText: counts.notRetrievedFullText || 0,
    assessedFullText: counts.assessedFullText || 0,
    excludedFullText: counts.excludedFullText || 0,
    includedStudies: counts.includedStudies || 0,
    includedReports: counts.includedReports || counts.includedStudies || 0,
    ...counts
  };

  const reasonsList = Object.entries(c.exclusionReasonsBreakdown || {})
    .map(([r, n]) => `${r} (n = ${n})`)
    .slice(0, 4)
    .join('; ') || 'Criteria not met';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 740" width="100%" height="100%" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #ffffff;">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569"/>
    </marker>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.06"/>
    </filter>
  </defs>

  <!-- Title Header -->
  <text x="480" y="32" text-anchor="middle" font-size="18" font-weight="700" fill="#0f172a">PRISMA 2020 Flow Diagram</text>
  <text x="480" y="52" text-anchor="middle" font-size="12" fill="#64748b">Transparent reporting of systematic reviews and evidence synthesis</text>

  <!-- Phase Markers (Left Column) -->
  <g font-size="12" font-weight="700" fill="#4338ca" text-anchor="middle">
    <rect x="20" y="70" width="100" height="120" rx="6" fill="#eef2ff" stroke="#c7d2fe"/>
    <text x="70" y="135">IDENTIFICATION</text>

    <rect x="20" y="210" width="100" height="90" rx="6" fill="#eef2ff" stroke="#c7d2fe"/>
    <text x="70" y="260">SCREENING</text>

    <rect x="20" y="320" width="100" height="100" rx="6" fill="#eef2ff" stroke="#c7d2fe"/>
    <text x="70" y="375">RETRIEVAL</text>

    <rect x="20" y="440" width="100" height="130" rx="6" fill="#eef2ff" stroke="#c7d2fe"/>
    <text x="70" y="510">ELIGIBILITY</text>

    <rect x="20" y="590" width="100" height="100" rx="6" fill="#ecfdf5" stroke="#a7f3d0"/>
    <text x="70" y="645" fill="#047857">INCLUDED</text>
  </g>

  <!-- 1. IDENTIFICATION -->
  <!-- Box: Databases & Registers Searched -->
  <rect x="150" y="70" width="360" height="110" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" filter="url(#shadow)"/>
  <text x="170" y="96" font-size="13" font-weight="600" fill="#1e293b">Records identified from databases:</text>
  <text x="170" y="118" font-size="12" fill="#475569">Databases searched (n = ${c.identifiedDatabases})</text>
  <text x="170" y="138" font-size="12" fill="#475569">Registers searched (n = ${c.identifiedRegisters})</text>
  <text x="170" y="158" font-size="12" fill="#475569">Other sources / references (n = ${c.identifiedOther})</text>

  <!-- Box: Duplicates & Excluded Before Screening -->
  <rect x="560" y="70" width="370" height="110" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" filter="url(#shadow)"/>
  <text x="580" y="96" font-size="13" font-weight="600" fill="#1e293b">Records removed before screening:</text>
  <text x="580" y="122" font-size="12" fill="#475569">Duplicate records removed (n = ${c.duplicatesRemoved})</text>
  <text x="580" y="146" font-size="12" fill="#475569">Records marked ineligible by automation (n = ${c.ineligibleBeforeScreening})</text>

  <path d="M 510 125 L 560 125" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
  <path d="M 330 180 L 330 210" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>

  <!-- 2. SCREENING -->
  <rect x="150" y="210" width="360" height="80" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" filter="url(#shadow)"/>
  <text x="170" y="238" font-size="13" font-weight="600" fill="#1e293b">Records screened (Title &amp; Abstract):</text>
  <text x="170" y="264" font-size="13" fill="#4338ca" font-weight="700">(n = ${c.screenedTitleAbstract})</text>

  <rect x="560" y="210" width="370" height="80" rx="8" fill="#ffffff" stroke="#fecaca" stroke-width="1.5" filter="url(#shadow)"/>
  <text x="580" y="238" font-size="13" font-weight="600" fill="#991b1b">Records excluded during screening:</text>
  <text x="580" y="264" font-size="13" fill="#dc2626" font-weight="700">(n = ${c.excludedTitleAbstract})</text>

  <path d="M 510 250 L 560 250" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
  <path d="M 330 290 L 330 320" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>

  <!-- 3. RETRIEVAL -->
  <rect x="150" y="320" width="360" height="80" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" filter="url(#shadow)"/>
  <text x="170" y="348" font-size="13" font-weight="600" fill="#1e293b">Reports sought for retrieval:</text>
  <text x="170" y="374" font-size="13" fill="#4338ca" font-weight="700">(n = ${c.soughtFullText})</text>

  <rect x="560" y="320" width="370" height="80" rx="8" fill="#ffffff" stroke="#fed7aa" stroke-width="1.5" filter="url(#shadow)"/>
  <text x="580" y="348" font-size="13" font-weight="600" fill="#9a3412">Reports not retrieved:</text>
  <text x="580" y="374" font-size="13" fill="#ea580c" font-weight="700">(n = ${c.notRetrievedFullText})</text>

  <path d="M 510 360 L 560 360" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
  <path d="M 330 400 L 330 440" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>

  <!-- 4. ELIGIBILITY -->
  <rect x="150" y="440" width="360" height="110" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" filter="url(#shadow)"/>
  <text x="170" y="468" font-size="13" font-weight="600" fill="#1e293b">Reports assessed for full-text eligibility:</text>
  <text x="170" y="494" font-size="13" fill="#4338ca" font-weight="700">(n = ${c.assessedFullText})</text>

  <rect x="560" y="440" width="370" height="110" rx="8" fill="#ffffff" stroke="#fecaca" stroke-width="1.5" filter="url(#shadow)"/>
  <text x="580" y="466" font-size="13" font-weight="600" fill="#991b1b">Reports excluded (Full-Text): (n = ${c.excludedFullText})</text>
  <text x="580" y="490" font-size="11.5" fill="#475569">Exclusion reasons breakdown:</text>
  <text x="580" y="510" font-size="11" fill="#64748b">${reasonsList}</text>

  <path d="M 510 495 L 560 495" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>
  <path d="M 330 550 L 330 590" stroke="#64748b" stroke-width="1.5" marker-end="url(#arrow)"/>

  <!-- 5. INCLUDED -->
  <rect x="150" y="590" width="780" height="90" rx="8" fill="#f0fdf4" stroke="#86efac" stroke-width="1.5" filter="url(#shadow)"/>
  <text x="180" y="626" font-size="14" font-weight="700" fill="#166534">Studies included in review (n = ${c.includedStudies})</text>
  <text x="180" y="652" font-size="13" fill="#15803d">Reports of included studies (n = ${c.includedReports})</text>
</svg>`;
}

