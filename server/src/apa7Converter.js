import AdmZip from 'adm-zip';
import path from 'path';
import {
  resolveDocumentLanguage,
  detectScripts,
  wrapMixedLanguageSegments,
  generateUnicodePreamble,
  LANGUAGE_REGISTRY,
  SCRIPT_DEFINITIONS
} from './multilingualRegistry.js';

/**
 * APA 7 Word-to-LaTeX Multilingual Manuscript Converter Engine
 * Implements APA 7 Student Paper (`stu`) and Professional Manuscript (`man`) standards
 * with native Unicode typesetting for Indic, Arabic/Urdu, CJK, and European languages.
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
 * Preserves all Unicode code points (Bengali, Hindi, Tamil, Arabic, Chinese, etc.) intact.
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
 * Normalizes an author name into a BibTeX citation key.
 */
export function generateCitationKey(author = 'author', year = '2024', title = 'ref') {
  // Transliterate or clean non-ASCII for citation keys
  const cleanAuthor = author.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 10) || 'author';
  const cleanYear = year.replace(/[^0-9]/g, '').slice(0, 4) || '2024';
  const cleanTitle = title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 6) || 'study';
  return `${cleanAuthor}${cleanYear}${cleanTitle}`;
}

/**
 * Converts citation metadata into clean BibTeX format for biblatex with style=apa.
 * Preserves Unicode author names, multilingual book/journal titles, and DOIs.
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
 */
export function resolveInTextCitations(text, citations = []) {
  if (!text) return { resolvedText: '', warnings: [] };

  const warnings = [];
  let resolvedText = text;

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

  // Parenthetical citations: (Smith, 2020)
  const PAREN_REGEX = /\(([A-Z\u00C0-\u024F\u0980-\u09FF\u0900-\u097F\u0600-\u06FF\u4E00-\u9FFF][a-zA-Z\u00C0-\u024F\u0980-\u09FF\u0900-\u097F\u0600-\u06FF\u4E00-\u9FFF\s&]+),\s*(\d{4})\)/g;
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

  // Narrative citations: Smith (2020)
  const NARRATIVE_REGEX = /\b([A-Z\u00C0-\u024F\u0980-\u09FF\u0900-\u097F\u0600-\u06FF\u4E00-\u9FFF][a-zA-Z\u00C0-\u024F\u0980-\u09FF\u0900-\u097F\u0600-\u06FF\u4E00-\u9FFF]+)\s*\(\s*(\d{4})\s*\)/g;
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
 * Generates the complete, compilable main.tex APA 7 manuscript with multilingual support.
 */
export function generateApa7MainTex(options = {}) {
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
    sections = [],
    hasBibliography = true,
    documentLanguage = 'en',
    documentMode = 'mixed',
    engine = 'xelatex',
    detectedScripts = [],
    modular = false,
    embedBib = false,
    bibContent = '',
    degree = '',
    department = '',
    advisor = '',
    defenseDate = '',
    customFormatName = '',
    customClassOptions = '',
    customPreamble = ''
  } = options;

  const isStudent = variant === 'student';
  const isThesis = variant === 'thesis' || variant === 'dissertation';
  const isCustom = variant === 'custom';
  const classOption = isCustom
    ? (customClassOptions && customClassOptions.trim() ? customClassOptions.trim() : 'man')
    : (isStudent ? 'stu' : 'man');

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

  let preamble = '';

  // Embedded filecontents block for standalone zero-config Overleaf compilation
  if (embedBib && bibContent && hasBibliography) {
    preamble += `\\begin{filecontents*}{\\jobname.bib}\n${bibContent.trim()}\n\\end{filecontents*}\n\n`;
  }

  preamble += `\\documentclass[${classOption},12pt]{apa7}\n\n`;

  if (isCustom && customPreamble && customPreamble.trim()) {
    preamble += `% Custom Institutional Format Configuration\n${customPreamble.trim()}\n\n`;
  }

  // Multilingual & Unicode packages configuration
  const langConfig = LANGUAGE_REGISTRY[documentLanguage] || LANGUAGE_REGISTRY.en;
  const isUnicodeEngine = engine === 'xelatex' || engine === 'lualatex' || langConfig.script !== 'latin';

  if (isUnicodeEngine) {
    preamble += generateUnicodePreamble({
      primaryLanguage: langConfig.code,
      detectedScripts,
      documentMode,
      engine
    });
  } else {
    preamble += `\\usepackage[american]{babel}\n`;
  }

  preamble += `\\usepackage{csquotes}\n`;
  preamble += `\\usepackage{amsmath}\n`;
  preamble += `\\usepackage{graphicx}\n`;
  preamble += `\\usepackage{booktabs}\n`;
  preamble += `\\usepackage{longtable}\n`;
  preamble += `\\usepackage{hyperref}\n`;

  if (hasBibliography) {
    preamble += `\\usepackage[style=apa,backend=biber]{biblatex}\n`;
    if (embedBib && bibContent) {
      preamble += `\\addbibresource{\\jobname.bib}\n\n`;
    } else {
      preamble += `\\addbibresource{references.bib}\n\n`;
    }
  } else {
    preamble += `\n`;
  }

  // Metadata
  preamble += `\\title{${escapeLatex(title)}}\n`;
  preamble += `\\author{${escapeLatex(authorStr)}}\n`;
  preamble += `\\affiliation{${escapeLatex(affiliationStr)}}\n`;

  if (isStudent) {
    if (course) preamble += `\\course{${escapeLatex(course)}}\n`;
    if (instructor) preamble += `\\professor{${escapeLatex(instructor)}}\n`;
    if (dueDate) preamble += `\\duedate{${escapeLatex(dueDate)}}\n`;
  } else if (isThesis) {
    if (runningHead) {
      preamble += `\\shorttitle{${escapeLatex(runningHead.slice(0, 50).toUpperCase())}}\n`;
    }
    const thesisNotes = [];
    if (degree) thesisNotes.push(`A dissertation/thesis submitted in partial fulfillment of the requirements for the degree of ${degree}`);
    if (department) thesisNotes.push(`Department: ${department}`);
    if (advisor) thesisNotes.push(`Thesis Advisor/Supervisor: ${advisor}`);
    if (defenseDate) thesisNotes.push(`Defense/Graduation Date: ${defenseDate}`);
    if (authorNote) thesisNotes.push(authorNote);

    if (thesisNotes.length > 0) {
      preamble += `\\authornote{${escapeLatex(thesisNotes.join('. '))}}\n`;
    }
  } else {
    if (runningHead) {
      preamble += `\\shorttitle{${escapeLatex(runningHead.slice(0, 50).toUpperCase())}}\n`;
    }
    if (authorNote) {
      preamble += `\\authornote{${escapeLatex(authorNote)}}\n`;
    }
  }

  if (abstract && abstract.trim()) {
    preamble += `\\abstract{${escapeLatex(abstract.trim())}}\n`;
  }
  if (Array.isArray(keywords) && keywords.length > 0) {
    preamble += `\\keywords{${keywords.map(k => escapeLatex(k.trim())).join(', ')}}\n`;
  }

  let body = `\\begin{document}\n\n`;
  body += `\\maketitle\n\n`;

  // Sections
  if (modular && Array.isArray(sections) && sections.length > 0) {
    sections.forEach((sec, idx) => {
      const safeName = (sec.heading || `section${idx + 1}`).toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
      body += `\\input{sections/${safeName}.tex}\n\n`;
    });
  } else if (Array.isArray(sections) && sections.length > 0) {
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
    body += `\\section{Introduction}\n\nThis manuscript was converted using ResearchProof AI Phase 5 Multilingual APA 7 Studio.\n\n`;
  }

  if (hasBibliography) {
    body += `\\printbibliography\n\n`;
  }

  body += `\\end{document}\n`;

  return preamble + body;
}

/**
 * Creates standard latexmkrc configured for Unicode engines (XeLaTeX/LuaLaTeX) or pdfLaTeX.
 */
export function generateLatexmkrc(engine = 'xelatex') {
  if (engine === 'xelatex') {
    return [
      `# ResearchProof AI — latexmkrc (XeLaTeX Unicode Engine)`,
      `$pdf_mode = 5;`,
      `$xelatex = 'xelatex -interaction=nonstopmode -synctex=1 %O %S';`,
      `$biber = 'biber %O %S';`,
      `$bibtex_use = 2;`,
      `$clean_ext = 'bbl bcf fdb_latexmk fls run.xml synctex.gz xdv';`,
      `$max_repeat = 5;`,
      ``
    ].join('\n');
  } else if (engine === 'lualatex') {
    return [
      `# ResearchProof AI — latexmkrc (LuaLaTeX Unicode Engine)`,
      `$pdf_mode = 4;`,
      `$lualatex = 'lualatex -interaction=nonstopmode -synctex=1 %O %S';`,
      `$biber = 'biber %O %S';`,
      `$bibtex_use = 2;`,
      `$clean_ext = 'bbl bcf fdb_latexmk fls run.xml synctex.gz';`,
      `$max_repeat = 5;`,
      ``
    ].join('\n');
  }

  return [
    `# ResearchProof AI — latexmkrc (pdfLaTeX Engine)`,
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
export function generateReadme(variant, title, engine = 'xelatex', languageConfig = {}) {
  const modeStr = variant === 'student'
    ? 'APA 7 Student Paper'
    : (variant === 'thesis' || variant === 'dissertation'
        ? 'APA 7 Thesis & Dissertation'
        : (variant === 'custom' ? 'Custom / Uploaded Institutional Template' : 'APA 7 Professional Manuscript'));
  const engineStr = engine === 'xelatex' ? 'XeLaTeX (Recommended for Unicode)' : (engine === 'lualatex' ? 'LuaLaTeX' : 'pdfLaTeX');
  const langName = languageConfig.name || 'Multilingual';

  return [
    `# ${title}`,
    `Generated by ResearchProof AI — Phase 5 Multilingual APA 7 LaTeX Studio`,
    `Format: ${modeStr}`,
    `Primary Language: ${langName}`,
    `Recommended Engine: ${engineStr}`,
    ``,
    `## Directory Structure`,
    `\`\`\`text`,
    `├── main.tex                 # Primary compilable APA 7 LaTeX source`,
    `├── references.bib           # BibLaTeX bibliography entries (style=apa)`,
    `├── language-config.json     # Multilingual metadata, scripts, and font specs`,
    `├── latexmkrc                # Automation script for latexmk + biber`,
    `├── conversion-report.json   # Full conversion audit & integrity warnings`,
    `├── sections/                # Modular manuscript sections`,
    `├── figures/                 # Extracted images and visual assets`,
    `├── tables/                  # Formatted tabular structures`,
    `└── README.md                # Compilation instructions`,
    `\`\`\``,
    ``,
    `## Compiling Your Manuscript`,
    ``,
    `### Method 1: Using latexmk (Recommended)`,
    `\`\`\`bash`,
    engine === 'xelatex' ? `latexmk -pdfxe main.tex` : (engine === 'lualatex' ? `latexmk -pdflua main.tex` : `latexmk -pdf main.tex`),
    `\`\`\``,
    ``,
    `### Method 2: Manual Unicode Sequence`,
    `\`\`\`bash`,
    engine === 'xelatex' ? `xelatex main.tex\nbiber main\nxelatex main.tex\nxelatex main.tex` : `pdflatex main.tex\nbiber main\npdflatex main.tex\npdflatex main.tex`,
    `\`\`\``,
    ``,
    `### Method 3: Overleaf Import`,
    `1. Create a "New Project" -> "Upload Project".`,
    `2. Upload this complete ZIP archive.`,
    `3. In Overleaf Settings, set **LaTeX Engine** to **${engine === 'lualatex' ? 'LuaLaTeX' : 'XeLaTeX'}**.`,
    `4. Click **Recompile**.`,
    ``,
    `## Font Requirements`,
    `For non-Latin scripts (Indic, Arabic, CJK), install the Google Noto fonts:`,
    `- Ubuntu/Debian: \`sudo apt-get install fonts-noto-core fonts-noto-cjk fonts-noto-extra fonts-sil-amiri\``,
    `- macOS: Download from Google Fonts or install via \`brew install --cask font-noto-serif-bengali\` etc.`,
    ``,
    `*Protected by ResearchProof AI Verification Protocol.*`
  ].join('\n');
}

/**
 * Main conversion pipeline that takes raw text or parsed DOCX structure,
 * builds the multi-file APA 7 multilingual project, and packages it into a ZIP buffer.
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
    degree = '',
    department = '',
    advisor = '',
    defenseDate = '',
    customFormatName = '',
    customClassOptions = '',
    customPreamble = '',
    rawText = '',
    citations = [],
    tables = [],
    sections: inputSections = [],
    documentLanguage = 'auto',
    documentMode = 'mixed',
    engine = 'auto'
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
  } else if (variant === 'thesis' || variant === 'dissertation') {
    if (!degree) {
      warnings.push({
        category: 'metadata',
        severity: 'info',
        message: 'Degree (e.g. Master of Science, Ph.D.) was not specified for Thesis/Dissertation.'
      });
    }
  } else if (variant === 'custom') {
    if (customFormatName) {
      warnings.push({
        category: 'metadata',
        severity: 'info',
        message: `Custom template applied: ${customFormatName}`
      });
    }
  }

  // 1. Multilingual Resolution & Script Detection
  const fullCorpus = `${title} ${abstract} ${rawText}`;
  const langResolution = resolveDocumentLanguage(fullCorpus, documentLanguage);
  const primaryLang = langResolution.language;
  const scriptAnalysis = langResolution.scriptAnalysis;

  // Determine effective engine
  let effectiveEngine = engine;
  if (!effectiveEngine || effectiveEngine === 'auto') {
    if (primaryLang.script !== 'latin' || scriptAnalysis.isMixed || scriptAnalysis.isRtl) {
      effectiveEngine = 'xelatex';
    } else {
      effectiveEngine = 'xelatex'; // Default modern Unicode engine
    }
  }

  // 2. Parse Sections
  let parsedSections = [];
  if (Array.isArray(inputSections) && inputSections.length > 0) {
    parsedSections = [...inputSections];
  } else if (rawText && rawText.trim()) {
    const lines = rawText.split(/\r?\n\r?\n/);
    let currentSec = { heading: 'Introduction', level: 1, content: '' };
    lines.forEach(block => {
      const trimmed = block.trim();
      if (!trimmed) return;
      const subLines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const firstLine = subLines[0] || '';

      if (firstLine.startsWith('#')) {
        const hashMatch = firstLine.match(/^(#{1,5})\s+(.+)/);
        if (hashMatch) {
          if (currentSec.content || currentSec.heading !== 'Introduction') {
            parsedSections.push(currentSec);
          }
          currentSec = {
            heading: hashMatch[2].trim(),
            level: hashMatch[1].length,
            content: ''
          };
          const rest = subLines.slice(1).join('\n\n');
          if (rest) {
            const { resolvedText, warnings: citeWarns } = resolveInTextCitations(rest, citations);
            warnings.push(...citeWarns);
            let escapedParagraph = escapeLatex(resolvedText);
            if (documentMode === 'mixed') {
              escapedParagraph = wrapMixedLanguageSegments(escapedParagraph, primaryLang.script);
            }
            currentSec.content += (currentSec.content ? '\n\n' : '') + escapedParagraph;
          }
          return;
        }
      }

      // Check standard academic and thesis section headings on first line of block
      const headingMatch = firstLine.match(/^(?:(?:Chapter\s+\d+|[0-9]+(?:\.[0-9]+)*)\s*[:.-]?\s*)?(Abstract|Introduction|Background|Related\s*Work|Literature\s*Review|Theoretical\s*Framework|Methodology|Methods|Materials\s*and\s*Methods|Experimental\s*Setup|Experiment\s*\d*|Results|Findings|Data\s*Analysis|Discussion|Limitations|Conclusion|Conclusions|Future\s*Work|Acknowledgements?|Dedication|References|Bibliography|Appendix|Appendices)$/i);
      if (headingMatch && firstLine.length < 90) {
        if (currentSec.content || currentSec.heading !== 'Introduction') {
          parsedSections.push(currentSec);
        }
        let level = 1;
        const numPrefixMatch = firstLine.match(/^([0-9]+(?:\.[0-9]+)*)/);
        if (numPrefixMatch) {
          level = (numPrefixMatch[1].match(/\./g) || []).length + 1;
        }
        currentSec = { heading: firstLine, level: Math.min(level, 5), content: '' };
        const rest = subLines.slice(1).join('\n\n');
        if (rest) {
          const { resolvedText, warnings: citeWarns } = resolveInTextCitations(rest, citations);
          warnings.push(...citeWarns);
          let escapedParagraph = escapeLatex(resolvedText);
          if (documentMode === 'mixed') {
            escapedParagraph = wrapMixedLanguageSegments(escapedParagraph, primaryLang.script);
          }
          currentSec.content += (currentSec.content ? '\n\n' : '') + escapedParagraph;
        }
        return;
      }

      const { resolvedText, warnings: citeWarns } = resolveInTextCitations(trimmed, citations);
      warnings.push(...citeWarns);

      let escapedParagraph = escapeLatex(resolvedText);

      // Mode B: Mixed Language segment wrapping
      if (documentMode === 'mixed') {
        escapedParagraph = wrapMixedLanguageSegments(escapedParagraph, primaryLang.script);
      }

      currentSec.content += (currentSec.content ? '\n\n' : '') + escapedParagraph;
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

  // Generate main.tex (standard full document with references.bib)
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
    degree,
    department,
    advisor,
    defenseDate,
    customFormatName,
    customClassOptions,
    customPreamble,
    sections: parsedSections,
    hasBibliography: citations.length > 0,
    documentLanguage: primaryLang.code,
    documentMode,
    engine: effectiveEngine,
    detectedScripts: scriptAnalysis.detectedScripts,
    modular: false
  });

  // Generate modular main.tex (segments with \input{sections/...})
  const modularMainTex = generateApa7MainTex({
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
    degree,
    department,
    advisor,
    defenseDate,
    customFormatName,
    customClassOptions,
    customPreamble,
    sections: parsedSections,
    hasBibliography: citations.length > 0,
    documentLanguage: primaryLang.code,
    documentMode,
    engine: effectiveEngine,
    detectedScripts: scriptAnalysis.detectedScripts,
    modular: true
  });

  // Generate standalone main.tex with embedded filecontents bibliography for 1-click Overleaf paste
  const standaloneMainTex = generateApa7MainTex({
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
    degree,
    department,
    advisor,
    defenseDate,
    customFormatName,
    customClassOptions,
    customPreamble,
    sections: parsedSections,
    hasBibliography: citations.length > 0,
    documentLanguage: primaryLang.code,
    documentMode,
    engine: effectiveEngine,
    detectedScripts: scriptAnalysis.detectedScripts,
    modular: false,
    embedBib: true,
    bibContent
  });

  const sectionsList = parsedSections.map((sec, idx) => {
    const safeName = (sec.heading || `section${idx + 1}`).toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
    const secTex = `${mapHeadingToApa7(sec.heading, sec.level || 1)}\n\n${sec.content || ''}\n`;
    return {
      name: safeName,
      filename: `sections/${safeName}.tex`,
      heading: sec.heading || `Section ${idx + 1}`,
      level: sec.level || 1,
      content: secTex
    };
  });

  const latexmkrc = generateLatexmkrc(effectiveEngine);
  const readme = generateReadme(variant, title, effectiveEngine, primaryLang);

  const languageConfig = {
    documentLanguage: primaryLang.code,
    languageName: primaryLang.name,
    nativeName: primaryLang.nativeName,
    primaryScript: SCRIPT_DEFINITIONS[primaryLang.script]?.name || primaryLang.script,
    direction: primaryLang.direction,
    documentMode,
    engine: effectiveEngine,
    selectedEngine: effectiveEngine,
    recommendedEngine: primaryLang.recommendedEngine || effectiveEngine,
    fontFamily: primaryLang.fontFamily,
    font: primaryLang.fontFamily,
    requiredFonts: [primaryLang.fontFamily, ...(primaryLang.fallbackFonts || [])],
    fallbackFonts: primaryLang.fallbackFonts,
    detectedScripts: scriptAnalysis.detectedScripts,
    detectedScriptDetails: scriptAnalysis.detectedScriptDetails,
    scriptDistribution: scriptAnalysis.distribution,
    isMixed: scriptAnalysis.isMixed,
    isMixedScript: scriptAnalysis.isMixed,
    isRtl: scriptAnalysis.isRtl
  };

  const report = {
    converterVersion: '5.1.0-multilingual-apa7',
    generatedAt: new Date().toISOString(),
    template: 'apa7',
    variant,
    language: languageConfig,
    languageConfig,
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
    compilationRecommendation: `Use ${effectiveEngine === 'lualatex' ? 'lualatex' : 'xelatex'} with fontspec and polyglossia.`
  };

  // Build ZIP Archive with AdmZip
  const zip = new AdmZip();
  const ROOT_DIR = 'researchproof-multilingual-apa7/';
  const LEGACY_DIR = 'researchproof-apa7-manuscript/'; // Legacy mirror for phase 5 tests

  const fileBundle = [
    { name: 'main.tex', content: mainTex },
    { name: 'main_modular.tex', content: modularMainTex },
    { name: 'references.bib', content: bibContent },
    { name: 'README.md', content: readme },
    { name: 'latexmkrc', content: latexmkrc },
    { name: 'language-config.json', content: JSON.stringify(languageConfig, null, 2) },
    { name: 'conversion-report.json', content: JSON.stringify(report, null, 2) }
  ];

  fileBundle.forEach(f => {
    zip.addFile(`${ROOT_DIR}${f.name}`, Buffer.from(f.content, 'utf8'));
    zip.addFile(`${LEGACY_DIR}${f.name}`, Buffer.from(f.content, 'utf8'));
  });

  sectionsList.forEach((sec) => {
    zip.addFile(`${ROOT_DIR}${sec.filename}`, Buffer.from(sec.content, 'utf8'));
    zip.addFile(`${LEGACY_DIR}${sec.filename}`, Buffer.from(sec.content, 'utf8'));
  });

  zip.addFile(`${ROOT_DIR}figures/README.md`, Buffer.from('# Figures Directory\nPlace figure image files (.png, .pdf, .jpg) here and reference via `\\includegraphics{figures/...}`.\n', 'utf8'));
  zip.addFile(`${ROOT_DIR}tables/README.md`, Buffer.from('# Tables Directory\nAPA 7 compliant booktabs table definitions.\n', 'utf8'));
  zip.addFile(`${LEGACY_DIR}figures/README.md`, Buffer.from('# Figures Directory\nPlace figure image files here.\n', 'utf8'));
  zip.addFile(`${LEGACY_DIR}tables/README.md`, Buffer.from('# Tables Directory\nAPA 7 table definitions.\n', 'utf8'));

  const zipBuffer = zip.toBuffer();

  return {
    zipBuffer,
    mainTex,
    modularMainTex,
    standaloneMainTex,
    bibContent,
    sections: sectionsList,
    languageConfig,
    report,
    warnings,
    stats: {
      zipSize: zipBuffer.length,
      sectionsCount: parsedSections.length,
      referencesCount: citations.length,
      warningsCount: warnings.length,
      primaryLanguage: primaryLang.code,
      primaryScript: primaryLang.script
    }
  };
}
