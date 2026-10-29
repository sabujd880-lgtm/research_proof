/**
 * BibTeX & RIS Parser, Exporter, Duplicate Detector, and Multi-Style Citation Engine
 * Supports APA 7, MLA 9, Chicago 17, IEEE, Harvard, and Retraction Flagging.
 */

import { normalizeDoi } from './citationService.js';

/**
 * Parse BibTeX entries into normalized citation objects
 */
export function parseBibtex(rawText) {
  if (!rawText || !rawText.trim()) return [];
  const entries = [];
  const entryRegex = /@(\w+)\s*\{\s*([^,]+),([^@]*)/g;
  let match;

  while ((match = entryRegex.exec(rawText)) !== null) {
    const entryType = match[1].toLowerCase();
    const citeKey = match[2].trim();
    const body = match[3];

    const fields = {};
    const fieldRegex = /([a-zA-Z_]+)\s*=\s*[\{"]([^"\}]*)[\}"]/g;
    let fMatch;
    while ((fMatch = fieldRegex.exec(body)) !== null) {
      fields[fMatch[1].toLowerCase()] = fMatch[2].trim();
    }

    // Authors handling
    const rawAuthors = fields.author || '';
    const authors = rawAuthors
      .split(/\s+and\s+/i)
      .map(a => a.trim())
      .filter(Boolean)
      .map(a => {
        if (a.includes(',')) {
          const parts = a.split(',').map(p => p.trim());
          return { family: parts[0] || '', given: parts[1] || '', name: a };
        }
        const parts = a.split(/\s+/);
        const family = parts[parts.length - 1] || '';
        const given = parts.slice(0, -1).join(' ');
        return { family, given, name: a };
      });

    entries.push({
      citeKey,
      entryType,
      title: fields.title || citeKey,
      authors: authors.length > 0 ? authors : [{ name: 'Unknown Author' }],
      year: fields.year || '',
      journal: fields.journal || fields.booktitle || '',
      volume: fields.volume || '',
      issue: fields.number || '',
      pages: fields.pages || '',
      publisher: fields.publisher || '',
      doi: normalizeDoi(fields.doi || ''),
      url: fields.url || (fields.doi ? `https://doi.org/${normalizeDoi(fields.doi)}` : '')
    });
  }

  return entries;
}

/**
 * Parse RIS formatted text into normalized citation objects
 */
export function parseRis(rawText) {
  if (!rawText || !rawText.trim()) return [];
  const records = rawText.split(/ER\s*-\s*\r?\n/).filter(r => r.trim());
  const entries = [];

  for (const rec of records) {
    const lines = rec.split(/\r?\n/);
    const fields = {};
    const authors = [];

    for (const line of lines) {
      const tagMatch = line.match(/^([A-Z0-9]{2})\s*-\s*(.*)$/);
      if (tagMatch) {
        const tag = tagMatch[1].toUpperCase();
        const val = tagMatch[2].trim();

        if (tag === 'AU' || tag === 'A1') {
          if (val) authors.push({ name: val, family: val.split(',')[0]?.trim() || val });
        } else if (tag === 'TI' || tag === 'T1') {
          fields.title = val;
        } else if (tag === 'PY' || tag === 'Y1') {
          fields.year = (val.match(/\d{4}/) || [val])[0];
        } else if (tag === 'JO' || tag === 'JF' || tag === 'T2') {
          fields.journal = val;
        } else if (tag === 'VL') {
          fields.volume = val;
        } else if (tag === 'IS') {
          fields.issue = val;
        } else if (tag === 'SP') {
          fields.pages = val;
        } else if (tag === 'EP') {
          fields.pages = fields.pages ? `${fields.pages}-${val}` : val;
        } else if (tag === 'DO') {
          fields.doi = val;
        } else if (tag === 'PB') {
          fields.publisher = val;
        } else if (tag === 'UR') {
          fields.url = val;
        }
      }
    }

    if (fields.title || fields.doi || authors.length > 0) {
      entries.push({
        title: fields.title || 'Untitled Reference',
        authors: authors.length > 0 ? authors : [{ name: 'Unknown Author' }],
        year: fields.year || '',
        journal: fields.journal || '',
        volume: fields.volume || '',
        issue: fields.issue || '',
        pages: fields.pages || '',
        publisher: fields.publisher || '',
        doi: normalizeDoi(fields.doi || ''),
        url: fields.url || (fields.doi ? `https://doi.org/${normalizeDoi(fields.doi)}` : '')
      });
    }
  }

  return entries;
}

/**
 * Export citations array to BibTeX
 */
export function exportToBibtex(citations) {
  return (citations || []).map((c, idx) => {
    const firstAuthor = c.authors?.[0]?.family || c.authors?.[0]?.name?.split(/\s+/).pop() || 'ref';
    const cleanKey = `${firstAuthor.toLowerCase().replace(/[^a-z0-9]/g, '')}${c.year || idx + 1}`;
    const authorStr = (c.authors || [])
      .map(a => a.name || `${a.family}, ${a.given}`.trim())
      .filter(Boolean)
      .join(' and ') || 'Unknown Author';

    const fields = [
      `  author = {${authorStr}}`,
      `  title = {${c.title || 'Untitled'}}`
    ];
    if (c.journal) fields.push(`  journal = {${c.journal}}`);
    if (c.year) fields.push(`  year = {${c.year}}`);
    if (c.volume) fields.push(`  volume = {${c.volume}}`);
    if (c.issue) fields.push(`  number = {${c.issue}}`);
    if (c.pages) fields.push(`  pages = {${c.pages}}`);
    if (c.doi) fields.push(`  doi = {${normalizeDoi(c.doi)}}`);
    if (c.publisher) fields.push(`  publisher = {${c.publisher}}`);

    return `@article{${cleanKey},\n${fields.join(',\n')}\n}`;
  }).join('\n\n');
}

/**
 * Export citations array to RIS format
 */
export function exportToRis(citations) {
  return (citations || []).map(c => {
    const lines = ['TY  - JOUR'];
    if (c.title) lines.push(`TI  - ${c.title}`);
    for (const a of (c.authors || [])) {
      lines.push(`AU  - ${a.name || `${a.family}, ${a.given}`}`);
    }
    if (c.year) lines.push(`PY  - ${c.year}`);
    if (c.journal) lines.push(`JO  - ${c.journal}`);
    if (c.volume) lines.push(`VL  - ${c.volume}`);
    if (c.issue) lines.push(`IS  - ${c.issue}`);
    if (c.pages) lines.push(`SP  - ${c.pages}`);
    if (c.doi) lines.push(`DO  - ${normalizeDoi(c.doi)}`);
    if (c.publisher) lines.push(`PB  - ${c.publisher}`);
    lines.push('ER  - ');
    return lines.join('\n');
  }).join('\n\n');
}

/**
 * Duplicate Reference Detector
 */
export function detectDuplicates(newEntries, existingEntries) {
  const duplicates = [];
  const unique = [];

  const norm = str => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const item of newEntries) {
    const itemDoi = normalizeDoi(item.doi);
    const itemTitle = norm(item.title);

    let match = null;
    let matchReason = '';

    for (const existing of existingEntries) {
      const exDoi = normalizeDoi(existing.doi);
      const exTitle = norm(existing.title);

      if (itemDoi && exDoi && itemDoi === exDoi) {
        match = existing;
        matchReason = `Exact DOI match (${itemDoi})`;
        break;
      }

      if (itemTitle && exTitle && (itemTitle === exTitle || (itemTitle.length > 20 && exTitle.includes(itemTitle)))) {
        match = existing;
        matchReason = `Identical Title match ("${item.title.slice(0, 40)}...")`;
        break;
      }
    }

    if (match) {
      duplicates.push({ entry: item, duplicateOf: match, reason: matchReason });
    } else {
      unique.push(item);
    }
  }

  return { unique, duplicates };
}

/**
 * Multi-Style Citation Formatter
 * Supports APA 7, MLA 9, Chicago 17, IEEE, Harvard
 */
export function formatCitationInStyle(citation, style = 'apa') {
  const c = citation || {};
  const authors = c.authors || [];
  const year = c.year || 'n.d.';
  const title = c.title || 'Untitled';
  const journal = c.journal || '';
  const volume = c.volume || '';
  const pages = c.pages || '';
  const doi = normalizeDoi(c.doi || '');
  const doiUrl = doi ? `https://doi.org/${doi}` : '';

  const formatAuthorsApa = () => {
    if (authors.length === 0) return 'Unknown Author.';
    if (authors.length === 1) return `${authors[0].family || authors[0].name}, ${authors[0].given ? authors[0].given[0] + '.' : ''}`.trim();
    if (authors.length === 2) {
      return `${authors[0].family || authors[0].name}, ${authors[0].given ? authors[0].given[0] + '.' : ''} & ${authors[1].family || authors[1].name}, ${authors[1].given ? authors[1].given[0] + '.' : ''}`.trim();
    }
    return `${authors[0].family || authors[0].name}, ${authors[0].given ? authors[0].given[0] + '.' : ''} et al.`;
  };

  switch ((style || 'apa').toLowerCase()) {
    case 'mla':
    case 'mla9': {
      const a = authors[0] ? `${authors[0].family || authors[0].name}, ${authors[0].given || ''}.` : 'Unknown.';
      return `${a} "${title}." ${journal ? `*${journal}*` : ''}${volume ? `, vol. ${volume}` : ''}${year ? `, ${year}` : ''}${pages ? `, pp. ${pages}` : ''}.${doiUrl ? ` ${doiUrl}` : ''}`.trim();
    }
    case 'ieee': {
      const initials = (authors || []).map(a => `${a.given ? a.given[0] + '. ' : ''}${a.family || a.name}`).join(', ');
      return `[1] ${initials || 'Anon.'}, "${title}," ${journal ? `*${journal}*` : ''}${volume ? `, vol. ${volume}` : ''}${pages ? `, pp. ${pages}` : ''}, ${year}.${doi ? ` doi: ${doi}.` : ''}`.trim();
    }
    case 'chicago':
    case 'chicago17': {
      const a = authors[0] ? `${authors[0].family || authors[0].name}, ${authors[0].given || ''}.` : 'Unknown.';
      return `${a} "${title}." ${journal ? `*${journal}*` : ''} ${volume ? `${volume}` : ''} (${year})${pages ? `: ${pages}` : ''}.${doiUrl ? ` ${doiUrl}.` : ''}`.trim();
    }
    case 'harvard': {
      const a = authors[0] ? `${authors[0].family || authors[0].name}, ${authors[0].given ? authors[0].given[0] + '.' : ''}` : 'Unknown';
      return `${a} (${year}) '${title}', ${journal ? `*${journal}*` : ''}${volume ? `, ${volume}` : ''}${pages ? `, pp. ${pages}` : ''}.${doiUrl ? ` Available at: ${doiUrl}` : ''}`.trim();
    }
    case 'apa':
    case 'apa7':
    default: {
      const authStr = formatAuthorsApa();
      let res = `${authStr} (${year}). ${title}.`;
      if (journal) res += ` *${journal}*`;
      if (volume) res += `, *${volume}*`;
      if (pages) res += `, ${pages}.`;
      else res += '.';
      if (doiUrl) res += ` ${doiUrl}`;
      return res;
    }
  }
}

/**
 * Retraction Check Flagging
 */
export function checkRetractionStatus(doi, title) {
  const cleanDoi = normalizeDoi(doi || '');
  const lowerTitle = (title || '').toLowerCase();

  const isRetracted =
    lowerTitle.includes('retracted:') ||
    lowerTitle.includes('retraction:') ||
    lowerTitle.includes('statement of retraction') ||
    lowerTitle.includes('notice of retraction');

  return {
    doi: cleanDoi,
    isRetracted,
    status: isRetracted ? 'retracted' : 'valid',
    warning: isRetracted ? 'Caution: This article has been flagged as RETRACTED by the issuing journal.' : null
  };
}
