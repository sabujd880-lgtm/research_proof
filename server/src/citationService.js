/**
 * ResearchProof AI — Academic Citation Assistant Service
 * 
 * Capabilities:
 * - DOI lookup via public Crossref REST API
 * - Local in-memory and database caching
 * - Citation formatting: APA 7th edition, MLA 9th edition, IEEE
 * - Citation integrity analysis (missing references, uncited references, duplicates)
 */

import { DoiCache } from './models.js';

// In-memory cache fallback for development/test runs
const memDoiCache = new Map();

/**
 * Normalizes DOI strings into clean standard identifiers (e.g., 10.1038/s41586-020-2649-2)
 */
export function normalizeDoi(raw = '') {
  if (!raw) return '';
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
  cleaned = cleaned.replace(/^doi:\s*/i, '');
  cleaned = cleaned.replace(/[,\s);.]+$/, '');
  return cleaned.toLowerCase();
}

/**
 * Validates DOI format syntax
 */
export function isValidDoi(doi = '') {
  const norm = normalizeDoi(doi);
  return /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/i.test(norm);
}

/**
 * Normalizes author objects from Crossref into standard format
 */
function normalizeAuthors(crossrefAuthors = []) {
  if (!Array.isArray(crossrefAuthors) || crossrefAuthors.length === 0) {
    return [{ given: '', family: 'Unknown Author', name: 'Unknown Author' }];
  }
  return crossrefAuthors.map(a => {
    const given = a.given || '';
    const family = a.family || '';
    const name = a.name || `${family}${given ? ', ' + given : ''}` || 'Anonymous';
    return { given, family, name };
  });
}

/**
 * Fetches academic reference metadata from Crossref REST API with caching
 */
export async function lookupDoiMetadata(rawDoi, isDbConnected = false) {
  const doi = normalizeDoi(rawDoi);
  if (!isValidDoi(doi)) {
    const err = new Error(`Invalid DOI format: "${rawDoi}". Must match pattern 10.xxxx/...`);
    err.status = 400;
    throw err;
  }

  // 1. Check database or memory cache
  if (isDbConnected) {
    try {
      const cached = await DoiCache.findOne({ doi }).lean();
      if (cached && cached.metadata) return cached.metadata;
    } catch (_) {}
  } else if (memDoiCache.has(doi)) {
    return memDoiCache.get(doi);
  }

  // 2. Query Crossref REST API
  const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ResearchProofAI/1.0 (https://researchproof.ai; mailto:support@researchproof.ai)',
        'Accept': 'application/json'
      }
    });

    clearTimeout(timeoutId);

    if (res.status === 404) {
      const notFound = new Error(`DOI "${doi}" was not found in Crossref records.`);
      notFound.status = 404;
      throw notFound;
    }

    if (!res.ok) {
      const err = new Error(`Crossref API responded with status ${res.status}.`);
      err.status = res.status >= 500 ? 502 : res.status;
      throw err;
    }

    const data = await res.json();
    const item = data.message;
    if (!item) {
      throw new Error('Crossref response contained no metadata message.');
    }

    // Extract publication year
    let year = '';
    const dateParts = item['published-print']?.['date-parts'] ||
                      item['published-online']?.['date-parts'] ||
                      item['issued']?.['date-parts'] ||
                      item['created']?.['date-parts'];
    if (dateParts && dateParts[0] && dateParts[0][0]) {
      year = String(dateParts[0][0]);
    }

    const title = Array.isArray(item.title) ? item.title[0] : (item.title || 'Untitled Article');
    const journal = Array.isArray(item['container-title']) ? item['container-title'][0] : (item['container-title'] || '');
    const authors = normalizeAuthors(item.author);

    const updates = Array.isArray(item['update-to']) ? item['update-to'] : [];
    const relation = item.relation || {};
    const titleLower = title.toLowerCase();
    const isRetracted = Boolean(
      updates.some(u => String(u.type || u.label || '').toLowerCase().includes('retract')) ||
      relation['is-retracted-by'] ||
      titleLower.includes('retracted') ||
      titleLower.startsWith('retraction:')
    );
    const hasCorrection = Boolean(
      updates.some(u => String(u.type || u.label || '').toLowerCase().includes('correct')) ||
      relation['is-corrected-by'] ||
      titleLower.includes('erratum') ||
      titleLower.includes('corrigendum')
    );
    let retractionNotice = '';
    if (isRetracted) {
      retractionNotice = 'Publisher retraction notice recorded on Crossref';
    } else if (hasCorrection) {
      retractionNotice = 'Formal erratum or author correction published on Crossref';
    }

    const metadata = {
      doi,
      title: title.replace(/<[^>]+>/g, '').trim(),
      authors,
      year: year || 'n.d.',
      journal: journal.replace(/<[^>]+>/g, '').trim(),
      volume: item.volume || '',
      issue: item.issue || '',
      pages: item.page || '',
      publisher: item.publisher || '',
      metadataSource: 'crossref',
      verificationStatus: isRetracted ? 'retracted' : 'verified',
      isRetracted,
      hasCorrection,
      retractionNotice,
      rawUrl: item.URL || `https://doi.org/${doi}`
    };

    // Save to cache
    if (isDbConnected) {
      DoiCache.findOneAndUpdate({ doi }, { metadata, cachedAt: new Date() }, { upsert: true }).catch(() => {});
    } else {
      memDoiCache.set(doi, metadata);
    }

    return metadata;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const toErr = new Error('Crossref DOI metadata request timed out after 6 seconds.');
      toErr.status = 504;
      throw toErr;
    }
    throw err;
  }
}

/**
 * Formats an author's name in APA format: Family, G. M.
 */
function formatAuthorApa(a) {
  if (!a.family) return a.name || 'Unknown Author';
  if (!a.given) return a.family;
  const initials = a.given.split(/\s+/).map(p => p[0].toUpperCase() + '.').join(' ');
  return `${a.family}, ${initials}`;
}

/**
 * Formats an author's name in MLA format: Family, Given
 */
function formatAuthorMla(a) {
  if (!a.family) return a.name || 'Unknown Author';
  return a.given ? `${a.family}, ${a.given}` : a.family;
}

/**
 * Formats an author's name in IEEE format: G. M. Family
 */
function formatAuthorIeee(a) {
  if (!a.family) return a.name || 'Unknown Author';
  if (!a.given) return a.family;
  const initials = a.given.split(/\s+/).map(p => p[0].toUpperCase() + '.').join(' ');
  return `${initials} ${a.family}`;
}

/**
 * Formats a reference into APA 7th edition string
 */
export function formatApa(ref) {
  const authors = ref.authors || [];
  let authorStr = '';
  if (authors.length === 1) {
    authorStr = formatAuthorApa(authors[0]);
  } else if (authors.length === 2) {
    authorStr = `${formatAuthorApa(authors[0])}, & ${formatAuthorApa(authors[1])}`;
  } else if (authors.length > 2 && authors.length <= 20) {
    const allButLast = authors.slice(0, -1).map(formatAuthorApa).join(', ');
    authorStr = `${allButLast}, & ${formatAuthorApa(authors[authors.length - 1])}`;
  } else if (authors.length > 20) {
    const first19 = authors.slice(0, 19).map(formatAuthorApa).join(', ');
    authorStr = `${first19}, ... ${formatAuthorApa(authors[authors.length - 1])}`;
  } else {
    authorStr = 'Unknown Author';
  }

  const year = ref.year || 'n.d.';
  const title = ref.title ? ref.title.replace(/\.$/, '') : 'Untitled';
  let journalPart = '';
  if (ref.journal) {
    journalPart = ` *${ref.journal}*`;
    if (ref.volume) {
      journalPart += `, *${ref.volume}*`;
      if (ref.issue) journalPart += `(${ref.issue})`;
    }
    if (ref.pages) journalPart += `, ${ref.pages}`;
    journalPart += '.';
  }

  const doiPart = ref.doi ? ` https://doi.org/${ref.doi}` : '';
  return `${authorStr} (${year}). ${title}.${journalPart}${doiPart}`.trim();
}

/**
 * Formats a reference into MLA 9th edition string
 */
export function formatMla(ref) {
  const authors = ref.authors || [];
  let authorStr = '';
  if (authors.length === 1) {
    authorStr = `${formatAuthorMla(authors[0])}.`;
  } else if (authors.length === 2) {
    authorStr = `${formatAuthorMla(authors[0])}, and ${authors[1].given || ''} ${authors[1].family || ''}.`.replace(/\s+/g, ' ');
  } else if (authors.length > 2) {
    authorStr = `${formatAuthorMla(authors[0])}, et al.`;
  } else {
    authorStr = 'Anonymous.';
  }

  const title = ref.title ? `"${ref.title.replace(/\.$/, '')}."` : 'Untitled.';
  let containerPart = '';
  if (ref.journal) {
    containerPart = ` *${ref.journal}*`;
    if (ref.volume) containerPart += `, vol. ${ref.volume}`;
    if (ref.issue) containerPart += `, no. ${ref.issue}`;
    if (ref.year) containerPart += `, ${ref.year}`;
    if (ref.pages) containerPart += `, pp. ${ref.pages}`;
    containerPart += '.';
  } else if (ref.year) {
    containerPart = ` ${ref.year}.`;
  }

  const doiPart = ref.doi ? ` https://doi.org/${ref.doi}.` : '';
  return `${authorStr} ${title}${containerPart}${doiPart}`.replace(/\s+/g, ' ').trim();
}

/**
 * Formats a reference into IEEE format string (index default [1])
 */
export function formatIeee(ref, index = 1) {
  const authors = ref.authors || [];
  let authorStr = '';
  if (authors.length === 1) {
    authorStr = formatAuthorIeee(authors[0]);
  } else if (authors.length === 2) {
    authorStr = `${formatAuthorIeee(authors[0])} and ${formatAuthorIeee(authors[1])}`;
  } else if (authors.length > 2 && authors.length <= 6) {
    const allButLast = authors.slice(0, -1).map(formatAuthorIeee).join(', ');
    authorStr = `${allButLast}, and ${formatAuthorIeee(authors[authors.length - 1])}`;
  } else if (authors.length > 6) {
    authorStr = `${formatAuthorIeee(authors[0])} et al.`;
  } else {
    authorStr = 'Unknown Author';
  }

  const title = ref.title ? `"${ref.title.replace(/\.$/, '')},"` : 'Untitled,';
  let journalPart = '';
  if (ref.journal) {
    journalPart = ` *${ref.journal}*`;
    if (ref.volume) journalPart += `, vol. ${ref.volume}`;
    if (ref.issue) journalPart += `, no. ${ref.issue}`;
    if (ref.pages) journalPart += `, pp. ${ref.pages}`;
  }
  const yearPart = ref.year ? `, ${ref.year}` : '';
  const doiPart = ref.doi ? `, doi: ${ref.doi}` : '';

  return `[${index}] ${authorStr}, ${title}${journalPart}${yearPart}${doiPart}.`.replace(/\s+/g, ' ').trim();
}

/**
 * Formats in-text citation marker
 */
export function formatInTextCitation(ref, style = 'apa', index = 1) {
  const authors = ref.authors || [];
  const primaryFamily = authors[0]?.family || authors[0]?.name || 'Unknown';
  const year = ref.year || 'n.d.';

  if (style.toLowerCase() === 'ieee') {
    return `[${index}]`;
  }

  if (style.toLowerCase() === 'mla') {
    return `(${primaryFamily})`;
  }

  // APA default
  if (authors.length === 1) {
    return `(${primaryFamily}, ${year})`;
  }
  if (authors.length === 2) {
    const secondFamily = authors[1]?.family || authors[1]?.name || '';
    return `(${primaryFamily} & ${secondFamily}, ${year})`;
  }
  return `(${primaryFamily} et al., ${year})`;
}

/**
 * Comprehensive Citation Integrity Validator
 * 
 * Inspects document text against a citation library:
 * - Detects in-text citations that have no entry in library
 * - Detects references in library never cited in document
 * - Detects duplicate DOIs in library
 */
export function validateDocumentCitations(text = '', citations = []) {
  const issues = [];
  const missingCitations = [];
  const uncitedReferences = [];
  const duplicateReferences = [];

  // Check for duplicate DOIs in the provided library
  const seenDois = new Map();
  for (const c of citations) {
    const norm = normalizeDoi(c.doi);
    if (norm) {
      if (seenDois.has(norm)) {
        duplicateReferences.push({
          doi: norm,
          title: c.title,
          detail: `Duplicate DOI "${norm}" is cataloged multiple times.`
        });
      } else {
        seenDois.set(norm, c);
      }
    }
  }

  // Extract citation markers from text
  // 1. DOIs cited in text
  const doiRegex = /\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+\b/gi;
  const citedDois = new Set();
  let m;
  while ((m = doiRegex.exec(text)) !== null) {
    citedDois.add(normalizeDoi(m[0]));
  }

  // 2. Author-year markers e.g. (Smith, 2020)
  const authorYearRegex = /\(([A-Z][a-zA-Z\s'-]+(?:et al\.?)?),?\s*((?:18|19|20)\d{2}[a-z]?)\)/g;
  const citedAuthorYears = [];
  while ((m = authorYearRegex.exec(text)) !== null) {
    citedAuthorYears.push({
      author: m[1].replace(/et al\.?/i, '').trim(),
      year: m[2].trim(),
      raw: m[0]
    });
  }

  // 3. Numbered markers e.g. [1], [2]
  const bracketRegex = /\[(\d+)\]/g;
  const citedNumbers = new Set();
  while ((m = bracketRegex.exec(text)) !== null) {
    citedNumbers.add(parseInt(m[1], 10));
  }

  // Check each cited DOI against library
  for (const cDoi of citedDois) {
    const found = citations.some(c => normalizeDoi(c.doi) === cDoi);
    if (!found) {
      missingCitations.push({
        marker: cDoi,
        type: 'doi',
        detail: `DOI "${cDoi}" is referenced in text but not present in citation library.`
      });
    }
  }

  // Check each cited Author-Year against library
  for (const ay of citedAuthorYears) {
    const found = citations.some(c => {
      const yearMatch = String(c.year) === String(ay.year);
      const authorMatch = (c.authors || []).some(a =>
        (a.family && a.family.toLowerCase().includes(ay.author.toLowerCase())) ||
        (a.name && a.name.toLowerCase().includes(ay.author.toLowerCase()))
      );
      return yearMatch && authorMatch;
    });

    if (!found) {
      missingCitations.push({
        marker: ay.raw,
        type: 'author-year',
        detail: `In-text citation "${ay.raw}" has no matching author/year entry in the citation library.`
      });
    }
  }

  // Check each library item for being cited in text
  citations.forEach((c, idx) => {
    const indexNum = idx + 1;
    const norm = normalizeDoi(c.doi);
    const hasDoiMatch = norm && citedDois.has(norm);
    const hasBracketMatch = citedNumbers.has(indexNum);
    const primaryAuthor = c.authors?.[0]?.family || c.authors?.[0]?.name || '';
    const hasAuthorYearMatch = primaryAuthor && c.year &&
      text.toLowerCase().includes(primaryAuthor.toLowerCase()) &&
      text.includes(String(c.year));

    if (!hasDoiMatch && !hasBracketMatch && !hasAuthorYearMatch) {
      uncitedReferences.push({
        id: c._id || c.id || norm || c.title,
        title: c.title,
        doi: norm,
        detail: `Reference "${c.title}" is in your citation list but is not cited anywhere in the document text.`
      });
    }
  });

  // Check library items for active retraction/correction notices
  const retractedReferences = [];
  for (const c of citations) {
    const isRetracted = Boolean(
      c.isRetracted ||
      (c.title && c.title.toLowerCase().includes('retracted')) ||
      c.verificationStatus === 'retracted' ||
      c.rawMetadata?.isRetracted
    );
    if (isRetracted) {
      retractedReferences.push({
        doi: normalizeDoi(c.doi),
        title: c.title,
        detail: `WARNING: Cited reference "${c.title}" has an active retraction or correction notice.`
      });
    }
  }

  return {
    valid: missingCitations.length === 0 && duplicateReferences.length === 0 && retractedReferences.length === 0,
    totalCitationsInLibrary: citations.length,
    missingCitations,
    uncitedReferences,
    duplicateReferences,
    retractedReferences,
    summary: {
      citedDoisCount: citedDois.size,
      citedAuthorYearsCount: citedAuthorYears.length,
      citedBracketNumbersCount: citedNumbers.size,
      retractedCount: retractedReferences.length
    }
  };
}
