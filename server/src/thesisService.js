import crypto from 'crypto';
import { assessPlagiarismAndSimilarity, assessAiAuthorship, findRepeatedPhrases } from './services.js';
import { validateDocumentCitations } from './citationService.js';

/**
 * Standard Graduate Dissertation & Thesis Chapter Structure
 */
export const STANDARD_THESIS_CHAPTERS = [
  {
    key: 'front_matter',
    title: 'Front Matter',
    subtitle: 'Title Page, Abstract, Dedication & Acknowledgments',
    order: 1,
    defaultTemplate: `# [Thesis Title]: An Empirical Investigation

## Abstract
[Provide a concise 250-350 word synthesis of the research problem, theoretical methodology, empirical findings, and primary contributions.]

### Keywords
Empirical Research, Academic Methodology, Statistical Analysis, Thesis Dissertation

## Dedication
This dissertation is dedicated to my mentors, family, and colleagues whose encouragement sustained this inquiry.

## Acknowledgments
The author expresses sincere gratitude to the faculty advisory committee, institutional collaborators, and research participants.
`
  },
  {
    key: 'chapter_1',
    title: 'Chapter 1: Introduction & Hypotheses',
    subtitle: 'Research Problem, Theoretical Framework & Research Questions',
    order: 2,
    defaultTemplate: `# Chapter 1: Introduction

## 1.1 Background & Context
[Establish the broader disciplinary context and scholarly background of the research problem.]

## 1.2 Problem Statement
[Articulate the specific empirical or theoretical gap this dissertation investigates.]

## 1.3 Theoretical Framework
[Detail the conceptual foundations, governing models, and foundational literature.]

## 1.4 Research Questions & Hypotheses
- **RQ1**: To what extent does the experimental intervention affect observed outcomes?
  - **H1 (Primary)**: The experimental intervention will yield a statistically significant improvement compared to the control group.
  - **H0 (Null)**: No significant divergence will be observed between intervention and control conditions.
`
  },
  {
    key: 'chapter_2',
    title: 'Chapter 2: Literature Review',
    subtitle: 'Systematic Synthesis of Prior Scholarly Literature',
    order: 3,
    defaultTemplate: `# Chapter 2: Literature Review

## 2.1 Historical Foundations
[Review foundational studies, paradigm developments, and early empirical discoveries.]

## 2.2 Contemporary Empirical Findings
[Synthesize current peer-reviewed research, contrasting methodologies and unresolved tensions.]

## 2.3 Synthesis and Research Gap
[Explicitly map how the present investigation resolves contradictions or gaps in prior scholarship.]
`
  },
  {
    key: 'chapter_3',
    title: 'Chapter 3: Methodology & Experimental Design',
    subtitle: 'Participants, Sampling, Protocol, Instruments & Analytical Plan',
    order: 4,
    defaultTemplate: `# Chapter 3: Methodology & Experimental Design

## 3.1 Research Paradigm
[Justify quantitative, qualitative, or mixed-methods empirical paradigm.]

## 3.2 Participants & Sampling
- **Target Population**: Defined academic or demographic cohort.
- **Sample Size**: N = 120 participants recruited through stratified sampling.
- **Inclusion Criteria**: Verified adult participants meeting protocol requirements.

## 3.3 Instrumentation & Materials
[Describe measurement scales, psychometric validity (Cronbach's alpha), and apparatus.]

## 3.4 Procedure & Data Collection
[Document chronological experimental protocol and institutional ethics review approvals.]

## 3.5 Statistical Analysis Plan
- Primary inferential tests: Repeated-measures ANOVA and multiple regression.
- Significance threshold established a priori at α = 0.05 with 95% confidence intervals.
`
  },
  {
    key: 'chapter_4',
    title: 'Chapter 4: Statistical Results & Data Analysis',
    subtitle: 'Descriptive Metrics, Inferential Tests, Hypotheses Testing & Effect Sizes',
    order: 5,
    defaultTemplate: `# Chapter 4: Statistical Results & Data Analysis

## 4.1 Descriptive Statistics
[Summarize sample demographics, means (M), standard deviations (SD), and distributional normality.]

## 4.2 Primary Hypothesis Testing
- **Hypothesis 1 Evaluation**:
  A repeated-measures ANOVA revealed a statistically significant main effect, F(2, 118) = 14.82, p < .001, η² = .20.
  Post-hoc Bonferroni corrections confirmed significant divergence between treatment and control cohorts.

## 4.3 Secondary Exploratory Findings
[Report regression coefficients, confidence intervals (95% CI), and observed effect sizes.]
`
  },
  {
    key: 'chapter_5',
    title: 'Chapter 5: Discussion & Future Work',
    subtitle: 'Interpretation of Findings, Theoretical Contributions & Limitations',
    order: 6,
    defaultTemplate: `# Chapter 5: Discussion

## 5.1 Interpretation of Findings
[Relate empirical outcomes directly back to H1 and Chapter 1 research questions.]

## 5.2 Theoretical & Practical Contributions
[Discuss how findings extend governing theories and offer actionable real-world implications.]

## 5.3 Limitations
[Acknowledge sample constraints, potential confounders, and measurement delimitations.]

## 5.4 Future Research Directions
[Outline promising avenues for subsequent empirical exploration.]
`
  },
  {
    key: 'back_matter',
    title: 'Back Matter',
    subtitle: 'Master References & Supplementary Appendices',
    order: 7,
    defaultTemplate: `# Back Matter

## References
[Master synchronized references will be compiled here.]

## Appendix A: Survey Instruments & Protocols
[Include full survey instruments, consent forms, and protocol materials.]

## Appendix B: Supplementary Tables
[Provide extended descriptive statistics, correlation matrices, and raw output data.]
`
  }
];

/**
 * Perform Cross-Chapter Redundancy & Consistency Scan
 */
export function scanCrossChapterConsistency(chapters = []) {
  const validChapters = chapters.filter(c => c && c.content && c.content.trim().length > 20);
  const totalWords = validChapters.reduce((acc, c) => acc + (c.content.trim().split(/\s+/).filter(Boolean).length || 0), 0);

  // 1. Chapter word distribution
  const distribution = validChapters.map(c => {
    const w = c.content.trim().split(/\s+/).filter(Boolean).length;
    const pct = totalWords > 0 ? Math.round((w / totalWords) * 100) : 0;
    return {
      key: c.key || c._id,
      title: c.title,
      wordCount: w,
      percentage: pct,
      status: pct > 45 ? 'disproportionate_high' : pct < 5 ? 'too_brief' : 'balanced'
    };
  });

  // 2. Cross-chapter pairwise passage overlap
  const overlaps = [];
  for (let i = 0; i < validChapters.length; i++) {
    for (let j = i + 1; j < validChapters.length; j++) {
      const chA = validChapters[i];
      const chB = validChapters[j];

      const parasA = chA.content.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 50);
      const parasB = chB.content.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 50);

      parasA.forEach(pa => {
        const cleanA = pa.toLowerCase().replace(/[^a-z0-9]/g, '');
        parasB.forEach(pb => {
          const cleanB = pb.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanA.length > 40 && (cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA))) {
            overlaps.push({
              sourceChapter: chA.title,
              targetChapter: chB.title,
              type: 'verbatim_paragraph_overlap',
              excerpt: pa.length > 140 ? `${pa.slice(0, 140)}...` : pa,
              detail: `Identical or near-identical passage repeated between "${chA.title}" and "${chB.title}".`
            });
          }
        });
      });
    }
  }

  // 3. Statistical consistency checks across chapters (e.g. Sample Size N and p-values)
  const statisticalInconsistencies = [];
  const sampleSizeMap = new Map();
  const sampleRegex = /\b[nN]\s*=\s*(\d{1,6})\b/g;

  validChapters.forEach(c => {
    let match;
    while ((match = sampleRegex.exec(c.content)) !== null) {
      const val = parseInt(match[1], 10);
      if (!sampleSizeMap.has(val)) sampleSizeMap.set(val, []);
      sampleSizeMap.get(val).push(c.title);
    }
  });

  if (sampleSizeMap.size > 1) {
    const entries = [...sampleSizeMap.entries()];
    statisticalInconsistencies.push({
      type: 'divergent_sample_sizes',
      severity: 'warning',
      title: 'Discrepant Sample Sizes Detected Across Chapters',
      detail: `Different sample sizes were reported across chapters: ${entries.map(([n, chs]) => `N = ${n} in [${[...new Set(chs)].join(', ')}]`).join(' vs ')}. Verify participant attrition or reporting consistency.`
    });
  }

  // 4. Terminology and Acronym consistency
  const acronyms = new Map();
  const acronymRegex = /\b([A-Z]{2,6})\b/g;
  validChapters.forEach(c => {
    const found = c.content.match(acronymRegex) || [];
    found.forEach(a => {
      if (['ANOVA', 'MANOVA', 'SPSS', 'IEEE', 'APA', 'DOI', 'PDF', 'HTML', 'URL'].includes(a)) return;
      if (!acronyms.has(a)) acronyms.set(a, []);
      acronyms.get(a).push(c.title);
    });
  });

  const terminologyNotes = [];
  acronyms.forEach((chs, acr) => {
    const uniqueChs = [...new Set(chs)];
    if (uniqueChs.length === 1 && validChapters.length > 2) {
      terminologyNotes.push({
        acronym: acr,
        chapter: uniqueChs[0],
        note: `Acronym "${acr}" appears only in "${uniqueChs[0]}". Ensure it is formally defined upon first introduction.`
      });
    }
  });

  return {
    totalChapters: validChapters.length,
    totalWords,
    distribution,
    overlaps,
    statisticalInconsistencies,
    terminologyNotes: terminologyNotes.slice(0, 10),
    redundancyScore: overlaps.length === 0 ? 100 : Math.max(50, 100 - overlaps.length * 12),
    verdict: overlaps.length === 0 && statisticalInconsistencies.length === 0
      ? 'Consistent & Well-Partitioned Dissertation Workspace'
      : 'Review Recommended: Cross-Chapter Redundancies or Numerical Discrepancies Found'
  };
}

/**
 * Synchronize Master Bibliography across all chapters
 */
export function synchronizeProjectBibliography(chapters = [], existingCitations = []) {
  const doiRegex = /\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+\b/g;
  const authorYearRegex = /\(([A-Z][a-zA-Z]+(?:\s+et\s+al\.)?,\s*(?:19|20)\d{2}[a-z]?)\)/g;

  const foundDois = new Set();
  const foundInText = new Set();
  const chapterCitationMap = {};

  chapters.forEach(c => {
    if (!c || !c.content) return;
    const dois = (c.content.match(doiRegex) || []).map(d => d.replace(/[,.;:)]$/, ''));
    const inText = (c.content.match(authorYearRegex) || []);

    dois.forEach(d => foundDois.add(d));
    inText.forEach(it => foundInText.add(it));

    chapterCitationMap[c.title || c.key] = {
      doiCount: dois.length,
      inTextCount: inText.length
    };
  });

  // Cross-reference with existing citations library
  const masterBibEntries = [];
  const matchedLibraryIds = new Set();

  existingCitations.forEach(cit => {
    const isCited = [...foundDois].some(d => cit.doi && cit.doi.toLowerCase().includes(d.toLowerCase())) ||
      [...foundInText].some(it => cit.author && it.toLowerCase().includes(cit.author.toLowerCase()));

    if (isCited) matchedLibraryIds.add(cit._id);

    masterBibEntries.push({
      id: cit._id,
      title: cit.title,
      author: cit.author || 'Unknown Author',
      year: cit.year || 'n.d.',
      journal: cit.journal || '',
      doi: cit.doi || '',
      isCitedInManuscript: isCited
    });
  });

  // Generate clean BibTeX content
  const bibtexLines = masterBibEntries.map(e => {
    const key = `${(e.author.split(/[\s,]+/)[0] || 'ref').toLowerCase()}${e.year || '2026'}`;
    return `@article{${key},
  author = {${e.author}},
  title = {${e.title}},
  year = {${e.year}},
  journal = {${e.journal || 'Academic Repository'}},
  ${e.doi ? `doi = {${e.doi}},` : ''}
}`;
  }).join('\n\n');

  return {
    totalUniqueDois: foundDois.size,
    totalInTextMarkers: foundInText.size,
    masterReferenceCount: masterBibEntries.length,
    chapterBreakdown: chapterCitationMap,
    masterBibEntries,
    bibtexContent: bibtexLines,
    uncitedLibraryReferences: masterBibEntries.filter(e => !e.isCitedInManuscript).length
  };
}
