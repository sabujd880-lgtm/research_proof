import AdmZip from 'adm-zip';
import path from 'path';

/**
 * APA 7 Word-to-LaTeX Manuscript Converter Engine
 * Implements APA 7 Student Paper (`stu`) and Professional Manuscript (`man`) standards.
 */

// Characters requiring LaTeX escaping in plain text
const LATEX_SPECIAL_CHARS = [
  { regex: /\\/g, replacement: '\\textbackslash{}' },
  { regex: /&/g, replacement: '\\&' },
  { regex: /%/g, replacement: '\\%' },
  { regex: /\$/g, replacement: '\\$' },
  { regex: /#/g, replacement: '\\#' },
  { regex: /_/g, replacement: '\\_' },
  { regex: /\{/g, replacement: '\\{' },
  { regex: /\}/g, replacement: '\\}' },
  { regex: /~/g, replacement: '\\textasciitilde{}' },
  { regex: /\^/g, replacement: '\\textasciicircum{}' }
];

/**
 * Escapes plain text for LaTeX while preserving math mode segments and statistical formulas.
 */
export function escapeLatex(text = '', preserveMath = true) {
  if (typeof text !== 'string') return '';
  if (!text) return '';

  if (!preserveMath) {
    let result = text;
    for (const { regex, replacement } of LATEX_SPECIAL_CHARS) {
      result = result.replace(regex, replacement);
    }
    return result;
  }

  const mathSegments = [];

  // 1. Preserve explicit LaTeX math expressions like $p < .05$ or \[ ... \]
  let tokenized = text.replace(/(\$(?!\s)[^\$\n]+?(?<!\s)\$|\\\[[\s\S]*?\\\])/g, (match) => {
    const placeholder = `XRPXMATHTOKEN${mathSegments.length}XENDX`;
    mathSegments.push(match);
    return placeholder;
  });

  // 2. Also preserve Greek statistical indicators and common scientific notation
  const STAT_PATTERNS = [
    { regex: /\bp\s*([<>=])\s*(\.?\d+)/gi, format: (_m, op, v) => `$p ${op} ${v}$` },
    { regex: /\b(alpha|beta|chi\^2|eta\^2)\s*=\s*(\.?\d+)/gi, format: (_m, sym, v) => `$\\${sym} = ${v}$` },
    { regex: /\b(alpha|beta|chi\^2|eta\^2)\b/gi, format: (_m, sym) => `$\\${sym}$` },
    { regex: /\b(M|SD|SE|CI)\s*=\s*(\d+\.?\d*)/gi, format: (_m, sym, v) => `$${sym} = ${v}$` },
    { regex: /\bF\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*=\s*(\d+\.?\d*)/gi, format: (_m, df1, df2, f) => `$F(${df1}, ${df2}) = ${f}$` },
    { regex: /\bt\s*\(\s*(\d+)\s*\)\s*=\s*(\d+\.?\d*)/gi, format: (_m, df, t) => `$t(${df}) = ${t}$` },
    { regex: /\br\s*=\s*(-?\d*\.?\d+)/gi, format: (_m, r) => `$r = ${r}$` }
  ];

  for (const stat of STAT_PATTERNS) {
    tokenized = tokenized.replace(stat.regex, (...args) => {
      const placeholder = `XRPXMATHTOKEN${mathSegments.length}XENDX`;
      mathSegments.push(stat.format(...args));
      return placeholder;
    });
  }

  // 3. Escape all plain text special characters
  let escaped = tokenized;
  for (const { regex, replacement } of LATEX_SPECIAL_CHARS) {
    escaped = escaped.replace(regex, replacement);
  }

  // 4. Restore preserved math segments
  for (let i = 0; i < mathSegments.length; i++) {
    escaped = escaped.replace(`XRPXMATHTOKEN${i}XENDX`, mathSegments[i]);
  }

  return escaped;
}

/**
 * Maps heading levels to APA 7 LaTeX sectioning commands.
 * APA 7 Heading Hierarchy:
 * Level 1: Centered, Bold, Title Case -> \section{...}
 * Level 2: Flush Left, Bold, Title Case -> \subsection{...}
 * Level 3: Flush Left, Bold Italic, Title Case -> \subsubsection{...}
 * Level 4: Indented, Bold, Title Case, Ending with a period -> \paragraph{...}
 * Level 5: Indented, Bold Italic, Title Case, Ending with a period -> \subparagraph{...}
 */
export function mapHeadingToApa7(title, level = 1) {
  const safeTitle = escapeLatex(title.trim());
  const normalizedLevel = Math.max(1, Math.min(5, Number(level) || 1));

  switch (normalizedLevel) {
    case 1:
      return `\\section{${safeTitle}}`;
    case 2:
      return `\\subsection{${safeTitle}}`;
    case 3:
      return `\\subsubsection{${safeTitle}}`;
    case 4:
      return `\\paragraph{${safeTitle}}`;
    case 5:
      return `\\subparagraph{${safeTitle}}`;
    default:
      return `\\section{${safeTitle}}`;
  }
}

/**
 * Normalizes an author name into a BibTeX citation key (e.g. 'smith2024apa').
 */
export function generateCitationKey(author = 'author', year = '2024', title = 'ref') {
  const cleanAuthor = author.replace(/[^a-zA-Z]/g, '').toLowerCase().slice(0, 10) || 'author';
  const cleanYear = year.replace(/[^0-9]/g, '').slice(0, 4) || '2024';
  const cleanTitle = title.replace(/[^a-zA-Z]/g, '').toLowerCase().slice(0, 6) || 'study';
  return `${cleanAuthor}${cleanYear}${cleanTitle}`;
}

/**
 * Converts citation metadata into clean BibTeX format for biblatex with style=apa.
 */
export function generateBibtex(citations = []) {
  if (!Array.isArray(citations) || citations.length === 0) {
    return {
      bibContent: '% ResearchProof AI — references.bib\n% No external references provided.\n',
      duplicateWarnings: []
    };
  }


  const seenDois = new Set();
  const duplicateWarnings = [];
  const entries = [];

  citations.forEach((cite, index) => {
    const rawDoi = (cite.doi || '').trim();
    if (rawDoi) {
      const lowerDoi = rawDoi.toLowerCase();
      if (seenDois.has(lowerDoi)) {
        duplicateWarnings.push(`Duplicate DOI detected: ${rawDoi}`);
      } else {
        seenDois.add(lowerDoi);
      }
    }

    // Extract first author family name
    let firstAuthorFamily = 'Author';
    let authorListStr = 'Unknown Author';
    if (Array.isArray(cite.authors) && cite.authors.length > 0) {
      const authorStrs = cite.authors.map(a => {
        if (typeof a === 'string') return a;
        if (a.family && a.given) return `${a.family}, ${a.given}`;
        return a.name || a.family || 'Author';
      });
      authorListStr = authorStrs.join(' and ');
      firstAuthorFamily = cite.authors[0].family || cite.authors[0].name || 'Author';
    } else if (typeof cite.author === 'string' && cite.author) {
      authorListStr = cite.author;
      firstAuthorFamily = cite.author.split(/[\s,]+/)[0] || 'Author';
    }

    const key = cite.citationKey || generateCitationKey(firstAuthorFamily, cite.year || cite.publishedYear || '2024', cite.title || `ref${index + 1}`);
    const entryType = cite.entryType || (cite.journal ? 'article' : (cite.publisher ? 'book' : 'misc'));

    const fields = [
      `  author = {${escapeLatex(authorListStr, false)}}`,
      `  title = {{${escapeLatex(cite.title || 'Untitled Reference', false)}}}`,
      cite.journal ? `  journal = {${escapeLatex(cite.journal, false)}}` : null,
      cite.year ? `  year = {${cite.year}}` : null,
      cite.volume ? `  volume = {${cite.volume}}` : null,
      cite.issue || cite.number ? `  number = {${cite.issue || cite.number}}` : null,
      cite.pages ? `  pages = {${cite.pages}}` : null,
      cite.publisher ? `  publisher = {${escapeLatex(cite.publisher, false)}}` : null,
      rawDoi ? `  doi = {${rawDoi}}` : null,
      cite.url ? `  url = {${cite.url}}` : null
    ].filter(Boolean);

    entries.push(`@${entryType}{${key},\n${fields.join(',\n')}\n}`);
  });

  return {
    bibContent: entries.join('\n\n') + '\n',
    duplicateWarnings
  };
}

/**
 * Maps in-text citations in manuscript text to \parencite{key} and \textcite{key}.
 * Plain-text citations that cannot be reliably matched are retained with a warning.
 */
export function resolveInTextCitations(text, citations = []) {
  if (!text) return { resolvedText: '', warnings: [] };

  const warnings = [];
  let resolvedText = text;

  // Build a lookup map from author/year and DOIs to citationKey
  const citeMap = new Map();
  citations.forEach((c) => {
    const key = c.citationKey || generateCitationKey(
      Array.isArray(c.authors) && c.authors[0] ? (c.authors[0].family || c.authors[0].name) : (c.author || 'Author'),
      c.year || '2024',
      c.title || 'ref'
    );
    if (c.doi) citeMap.set(c.doi.toLowerCase(), key);
    const authorName = Array.isArray(c.authors) && c.authors[0] ? (c.authors[0].family || c.authors[0].name) : (c.author || '');
    if (authorName && c.year) {
      citeMap.set(`${authorName.toLowerCase()}_${c.year}`, key);
    }
    citeMap.set(key.toLowerCase(), key);
  });

  // Regex for parenthetical citations: (Smith, 2020) or (Smith & Jones, 2020)
  const PAREN_REGEX = /\(([A-Z][a-zA-Z\s&]+),\s*(\d{4})\)/g;
  resolvedText = resolvedText.replace(PAREN_REGEX, (fullMatch, authorStr, yearStr) => {
    const firstAuthor = authorStr.split(/[\s&,]+/)[0].toLowerCase();
    const lookupKey = `${firstAuthor}_${yearStr}`;
    const key = citeMap.get(lookupKey);
    if (key) {
      return `\\parencite{${key}}`;
    }
    warnings.push({
      category: 'citation',
      severity: 'info',
      message: `Unmatched parenthetical citation preserved as plain text: "${fullMatch}". No matching bibliography entry found.`
    });
    return fullMatch;
  });

  // Regex for narrative citations: Smith (2020) demonstrated
  const NARRATIVE_REGEX = /\b([A-Z][a-zA-Z]+)\s*\(\s*(\d{4})\s*\)/g;
  resolvedText = resolvedText.replace(NARRATIVE_REGEX, (fullMatch, authorStr, yearStr) => {
    const lookupKey = `${authorStr.toLowerCase()}_${yearStr}`;
    const key = citeMap.get(lookupKey);
    if (key) {
      return `\\textcite{${key}}`;
    }
    warnings.push({
      category: 'citation',
      severity: 'info',
      message: `Unmatched narrative citation preserved as plain text: "${fullMatch}". No matching bibliography entry found.`
    });
    return fullMatch;
  });

  return { resolvedText, warnings };
}

/**
 * Formats structured tabular data into APA 7 compliant booktabs table.
 */
export function formatApaTable(tableData, tableIndex = 1) {
  const { title = `Table ${tableIndex}`, headers = [], rows = [], note = '' } = tableData;
  const colCount = Math.max(headers.length, ...rows.map(r => r.length), 1);
  const colSpec = 'l' + 'r'.repeat(Math.max(0, colCount - 1));

  let tex = `\\begin{table}[htbp]\n`;
  tex += `  \\caption{${escapeLatex(title)}}\n`;
  tex += `  \\label{tab:table${tableIndex}}\n`;
  tex += `  \\centering\n`;
  tex += `  \\begin{tabular}{${colSpec}}\n`;
  tex += `    \\toprule\n`;

  if (headers.length > 0) {
    tex += `    ${headers.map(h => escapeLatex(String(h))).join(' & ')} \\\\\n`;
    tex += `    \\midrule\n`;
  }

  rows.forEach(row => {
    const paddedRow = [...row];
    while (paddedRow.length < colCount) paddedRow.push('');
    tex += `    ${paddedRow.map(cell => escapeLatex(String(cell))).join(' & ')} \\\\\n`;
  });

  tex += `    \\bottomrule\n`;
  tex += `  \\end{tabular}\n`;

  if (note) {
    tex += `  \\par\\vspace{4pt}\\raggedright{\\footnotesize \\textit{Note.} ${escapeLatex(note)}}\n`;
  }

  tex += `\\end{table}\n`;
  return tex;
}

/**
 * Generates the complete, compilable main.tex APA 7 manuscript.
 */
export function generateApa7MainTex(options = {}) {
  const {
    variant = 'student', // 'student' | 'professional'
    title = 'Untitled Manuscript',
    authors = [],
    affiliations = [],
    abstract = '',
    keywords = [],
    // Student variant fields
    course = '',
    instructor = '',
    dueDate = '',
    // Professional variant fields
    runningHead = '',
    authorNote = '',
    sections = [],
    hasBibliography = true
  } = options;

  const isStudent = variant === 'student';
  const classOption = isStudent ? 'stu' : 'man';

  // Format Authors and Affiliations
  let authorStr = 'Author Name';
  if (Array.isArray(authors) && authors.length > 0) {
    authorStr = authors.map(a => typeof a === 'string' ? a : (a.name || 'Author')).join(' \\and ');
  }

  let affiliationStr = 'University';
  if (Array.isArray(affiliations) && affiliations.length > 0) {
    affiliationStr = affiliations.join(' \\and ');
  } else if (authors.length > 0 && authors[0].affiliation) {
    affiliationStr = authors.map(a => a.affiliation).filter(Boolean).join(' \\and ');
  }

  let preamble = `\\documentclass[${classOption},12pt]{apa7}\n\n`;
  preamble += `\\usepackage[american]{babel}\n`;
  preamble += `\\usepackage{csquotes}\n`;
  preamble += `\\usepackage{amsmath}\n`;
  preamble += `\\usepackage{graphicx}\n`;
  preamble += `\\usepackage{booktabs}\n`;
  preamble += `\\usepackage{longtable}\n`;
  preamble += `\\usepackage{hyperref}\n`;

  if (hasBibliography) {
    preamble += `\\usepackage[style=apa,backend=biber]{biblatex}\n`;
    preamble += `\\addbibresource{references.bib}\n\n`;
  } else {
    preamble += `\n`;
  }

  // Manuscript Metadata
  preamble += `\\title{${escapeLatex(title)}}\n`;
  preamble += `\\author{${escapeLatex(authorStr)}}\n`;
  preamble += `\\affiliation{${escapeLatex(affiliationStr)}}\n`;

  if (isStudent) {
    if (course) preamble += `\\course{${escapeLatex(course)}}\n`;
    if (instructor) preamble += `\\professor{${escapeLatex(instructor)}}\n`;
    if (dueDate) preamble += `\\duedate{${escapeLatex(dueDate)}}\n`;
  } else {
    if (runningHead) {
      preamble += `\\shorttitle{${escapeLatex(runningHead.slice(0, 50).toUpperCase())}}\n`;
    }
    if (authorNote) {
      preamble += `\\authornote{${escapeLatex(authorNote)}}\n`;
    }
  }

  // Abstract & Keywords
  if (abstract && abstract.trim()) {
    preamble += `\\abstract{${escapeLatex(abstract.trim())}}\n`;
  }
  if (Array.isArray(keywords) && keywords.length > 0) {
    preamble += `\\keywords{${keywords.map(k => escapeLatex(k.trim())).join(', ')}}\n`;
  }

  let body = `\\begin{document}\n\n`;
  body += `\\maketitle\n\n`;

  // Content Sections
  if (Array.isArray(sections) && sections.length > 0) {
    sections.forEach((sec, idx) => {
      if (sec.heading) {
        body += `${mapHeadingToApa7(sec.heading, sec.level || 1)}\n\n`;
      }
      if (sec.content) {
        body += `${sec.content}\n\n`;
      }
      if (sec.tableData) {
        body += `${formatApaTable(sec.tableData, idx + 1)}\n\n`;
      }
    });
  } else {
    body += `\\section{Introduction}\n\nThis manuscript was converted using ResearchProof AI Phase 5 APA 7 Studio.\n\n`;
  }

  if (hasBibliography) {
    body += `\\printbibliography\n\n`;
  }

  body += `\\end{document}\n`;

  return preamble + body;
}

/**
 * Creates standard latexmkrc configuration file for automated Biber + LaTeX build.
 */
export function generateLatexmkrc() {
  return [
    `# ResearchProof AI — latexmkrc`,
    `$pdf_mode = 1;`,
    `$pdflatex = 'pdflatex -interaction=nonstopmode -synctex=1 %O %S';`,
    `$biber = 'biber %O %S';`,
    `$bibtex_use = 2;`,
    `$clean_ext = 'bbl bcf fdb_latexmk fls run.xml synctex.gz';`,
    `$max_repeat = 5;`,
    ``
  ].join('\n');
}

/**
 * Creates user-friendly README with local and Overleaf compilation instructions.
 */
export function generateReadme(variant, title) {
  const modeStr = variant === 'student' ? 'APA 7 Student Paper' : 'APA 7 Professional Manuscript';
  return [
    `# ${title}`,
    `Generated by ResearchProof AI — Phase 5 APA 7 LaTeX Studio`,
    `Format: ${modeStr}`,
    ``,
    `## Directory Structure`,
    `\`\`\`text`,
    `├── main.tex                 # Primary compilable APA 7 LaTeX source`,
    `├── references.bib           # BibLaTeX bibliography entries (style=apa)`,
    `├── latexmkrc                # Automation script for latexmk + biber`,
    `├── conversion-report.json   # Full conversion audit & integrity warnings`,
    `├── sections/                # Modular manuscript sections (if partitioned)`,
    `├── figures/                 # Extracted images and visual assets`,
    `├── tables/                  # Formatted tabular structures`,
    `└── README.md                # Compilation instructions`,
    `\`\`\``,
    ``,
    `## Compiling Your Manuscript`,
    ``,
    `### Method 1: Using latexmk (Recommended)`,
    `\`\`\`bash`,
    `latexmk -pdf main.tex`,
    `\`\`\``,
    ``,
    `### Method 2: Manual LaTeX & Biber Sequence`,
    `\`\`\`bash`,
    `pdflatex main.tex`,
    `biber main`,
    `pdflatex main.tex`,
    `pdflatex main.tex`,
    `\`\`\``,
    ``,
    `### Method 3: Overleaf Import`,
    `1. Create a "New Project" -> "Upload Project".`,
    `2. Upload this complete ZIP archive.`,
    `3. In Overleaf Settings, verify the TeX Engine is set to **pdfLaTeX** and the TeX Live version is at least **2021**.`,
    `4. Click **Recompile**.`,
    ``,
    `## Package Requirements`,
    `- \`apa7\` document class`,
    `- \`biblatex\` with \`biber\` backend`,
    `- Standard CTAN packages: \`amsmath\`, \`graphicx\`, \`booktabs\`, \`longtable\`, \`csquotes\`, \`babel\``,
    ``,
    `*Protected by ResearchProof AI Verification Protocol.*`
  ].join('\n');
}

/**
 * Main conversion pipeline that takes raw text or parsed DOCX structure,
 * builds the multi-file APA 7 project, and packages it into a ZIP buffer.
 */
export async function convertToApa7Project(inputData = {}) {
  const {
    variant = 'student',
    title = 'Untitled Manuscript',
    authors = [],
    affiliations = [],
    abstract = '',
    keywords = [],
    course = '',
    instructor = '',
    dueDate = '',
    runningHead = '',
    authorNote = '',
    rawText = '',
    citations = [],
    tables = [],
    sections: inputSections = []
  } = inputData;

  const warnings = [];

  // Metadata Validation
  if (!title || !title.trim()) {
    warnings.push({
      category: 'metadata',
      severity: 'warning',
      message: 'Manuscript title is empty. Defaulted to "Untitled Manuscript".'
    });
  }

  if (variant === 'student') {
    if (!course) {
      warnings.push({
        category: 'metadata',
        severity: 'info',
        message: 'Course information was not provided for this Student Paper.'
      });
    }
  } else if (variant === 'professional') {
    if (!runningHead) {
      warnings.push({
        category: 'metadata',
        severity: 'info',
        message: 'No running head specified. APA 7 Professional manuscripts typically include a running head (max 50 chars).'
      });
    }
  }

  // Parse Sections from rawText or structured input
  let parsedSections = [];
  if (Array.isArray(inputSections) && inputSections.length > 0) {
    parsedSections = [...inputSections];
  } else if (rawText && rawText.trim()) {
    // Break paragraphs and headings
    const lines = rawText.split(/\r?\n\r?\n/);
    let currentSec = { heading: 'Introduction', level: 1, content: '' };
    lines.forEach(block => {
      const trimmed = block.trim();
      if (!trimmed) return;
      // Heading detection heuristic: lines starting with # or Title Case short lines
      if (trimmed.startsWith('#')) {
        const hashMatch = trimmed.match(/^(#{1,5})\s+(.+)/);
        if (hashMatch) {
          if (currentSec.content || currentSec.heading !== 'Introduction') {
            parsedSections.push(currentSec);
          }
          currentSec = {
            heading: hashMatch[2],
            level: hashMatch[1].length,
            content: ''
          };
          return;
        }
      }

      // Check for section headings like "Method", "Results", "Discussion"
      if (/^(Introduction|Method|Methods|Results|Discussion|Conclusion|References)$/i.test(trimmed)) {
        if (currentSec.content || currentSec.heading !== 'Introduction') {
          parsedSections.push(currentSec);
        }
        currentSec = { heading: trimmed, level: 1, content: '' };
        return;
      }

      const { resolvedText, warnings: citeWarns } = resolveInTextCitations(trimmed, citations);
      warnings.push(...citeWarns);

      currentSec.content += (currentSec.content ? '\n\n' : '') + escapeLatex(resolvedText);
    });
    parsedSections.push(currentSec);
  }

  // Validate Heading Hierarchy
  let previousLevel = 0;
  parsedSections.forEach(sec => {
    const lvl = sec.level || 1;
    if (previousLevel > 0 && lvl > previousLevel + 1) {
      warnings.push({
        category: 'heading',
        severity: 'warning',
        message: `Skipped heading level detected: from Level ${previousLevel} to Level ${lvl} at "${sec.heading}". APA 7 recommends progressive subheadings.`
      });
    }
    previousLevel = lvl;
  });

  // Generate Bibliography
  const { bibContent, duplicateWarnings } = generateBibtex(citations);
  duplicateWarnings.forEach(msg => {
    warnings.push({ category: 'bibliography', severity: 'warning', message: msg });
  });

  // Generate main.tex
  const mainTex = generateApa7MainTex({
    variant,
    title,
    authors,
    affiliations,
    abstract,
    keywords,
    course,
    instructor,
    dueDate,
    runningHead,
    authorNote,
    sections: parsedSections,
    hasBibliography: citations.length > 0
  });

  const latexmkrc = generateLatexmkrc();
  const readme = generateReadme(variant, title);

  const report = {
    converterVersion: '5.0.0-apa7',
    generatedAt: new Date().toISOString(),
    template: 'apa7',
    variant,
    metadata: {
      title,
      authorsCount: authors.length,
      affiliationsCount: affiliations.length,
      hasAbstract: Boolean(abstract && abstract.trim()),
      keywordsCount: keywords.length
    },
    sectionsCount: parsedSections.length,
    referencesCount: citations.length,
    warnings,
    compilationRecommendation: 'Use latexmk with pdf mode or Overleaf pdfLaTeX compiler.'
  };

  // Build ZIP Archive with AdmZip
  const zip = new AdmZip();
  const ROOT_DIR = 'researchproof-apa7-manuscript/';

  zip.addFile(`${ROOT_DIR}main.tex`, Buffer.from(mainTex, 'utf8'));
  zip.addFile(`${ROOT_DIR}references.bib`, Buffer.from(bibContent, 'utf8'));
  zip.addFile(`${ROOT_DIR}README.md`, Buffer.from(readme, 'utf8'));
  zip.addFile(`${ROOT_DIR}latexmkrc`, Buffer.from(latexmkrc, 'utf8'));
  zip.addFile(`${ROOT_DIR}conversion-report.json`, Buffer.from(JSON.stringify(report, null, 2), 'utf8'));

  // Add modular section files
  parsedSections.forEach((sec, idx) => {
    const safeName = (sec.heading || `section${idx + 1}`).toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
    const secTex = `${mapHeadingToApa7(sec.heading, sec.level || 1)}\n\n${sec.content}\n`;
    zip.addFile(`${ROOT_DIR}sections/${safeName}.tex`, Buffer.from(secTex, 'utf8'));
  });

  // Add tables and figures directory placeholders
  zip.addFile(`${ROOT_DIR}figures/README.md`, Buffer.from('# Figures Directory\nPlace figure image files (.png, .pdf, .jpg) here and reference via `\\includegraphics{figures/...}`.\n', 'utf8'));
  zip.addFile(`${ROOT_DIR}tables/README.md`, Buffer.from('# Tables Directory\nAPA 7 compliant booktabs table definitions.\n', 'utf8'));

  const zipBuffer = zip.toBuffer();

  return {
    zipBuffer,
    mainTex,
    bibContent,
    report,
    warnings,
    stats: {
      zipSize: zipBuffer.length,
      sectionsCount: parsedSections.length,
      referencesCount: citations.length,
      warningsCount: warnings.length
    }
  };
}
