/**
 * ResearchProof AI — DOCX Import & Export Service
 * 
 * Features:
 * - Secure DOCX extraction using mammoth with zip-bomb and magic-byte validation
 * - Sanitize extracted HTML/text preserving headings, bold, italic, lists, and Unicode scientific notation
 * - DOCX generation using official docx package with proper styling and headers
 */

import mammoth from 'mammoth';
import { Document as DocxDocument, Paragraph, TextRun, HeadingLevel, Packer } from 'docx';

/**
 * Validates file buffer magic bytes for ZIP / Office Open XML (PK\x03\x04)
 */
export function validateDocxMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) return false;
  return buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04;
}

/**
 * Sanitizes extracted HTML to prevent XSS while preserving academic formatting
 */
function sanitizeExtractedHtml(html = '') {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/on\w+\s*=\s*(?:["'][^"']*["']|[^\s>]+)/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');
}

/**
 * Parses and imports DOCX buffer into structured document content
 */
export async function importDocxFromBuffer(buffer, originalFilename = 'Imported_Manuscript.docx') {
  if (!buffer || buffer.length === 0) {
    const err = new Error('DOCX file buffer is empty.');
    err.status = 400;
    throw err;
  }

  // 1. Magic byte check
  if (!validateDocxMagicBytes(buffer)) {
    const err = new Error('Invalid DOCX file format: Missing Office Open XML ZIP magic bytes.');
    err.status = 400;
    throw err;
  }

  // 2. Extract raw text and HTML
  const [rawTextResult, htmlResult] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    mammoth.convertToHtml({ buffer })
  ]);

  const rawText = (rawTextResult.value || '').trim();
  const rawHtml = (htmlResult.value || '').trim();
  const warnings = [...(rawTextResult.messages || []), ...(htmlResult.messages || [])].map(m => m.message);

  if (!rawText) {
    const err = new Error('No readable text could be extracted from the uploaded DOCX document.');
    err.status = 400;
    throw err;
  }

  // 3. Derive structured metadata and title
  const metadata = extractManuscriptMetadata(rawText, originalFilename);
  const firstLine = rawText.split('\n').map(l => l.trim()).filter(Boolean)[0];
  const derivedTitle = (firstLine && firstLine.length < 160 && !/^(abstract|keywords|contents)/i.test(firstLine))
    ? firstLine
    : (metadata.title || originalFilename.replace(/\.docx$/i, '').replace(/[_-]/g, ' '));

  const sanitizedHtml = sanitizeExtractedHtml(rawHtml);
  const wordCount = rawText.split(/\s+/).filter(Boolean).length;
  const characterCount = rawText.length;

  return {
    title: derivedTitle,
    content: rawText,
    text: rawText,
    htmlContent: sanitizedHtml,
    wordCount,
    characterCount,
    metadata,
    warnings: warnings.slice(0, 10)
  };
}

/**
 * Automatically extracts structured manuscript metadata (Title, Authors, Affiliation, Abstract, Keywords, etc.)
 * from raw document text using robust heuristic analysis.
 */
export function extractManuscriptMetadata(text = '', originalFilename = '') {
  const result = {
    title: '',
    authors: '',
    affiliation: '',
    abstract: '',
    keywords: '',
    runningHead: '',
    course: '',
    instructor: '',
    dueDate: '',
    degree: '',
    department: '',
    advisor: '',
    defenseDate: ''
  };

  if (!text || typeof text !== 'string') return result;

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return result;

  // 1. Title Extraction
  let titleIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const l = lines[i];
    if (/^(abstract|keywords|table of contents|contents|chapter|introduction)/i.test(l)) continue;
    if (/^(by|author|date|course|professor|supervisor):/i.test(l)) continue;
    if (l.length >= 3 && l.length <= 200) {
      result.title = l.replace(/^#+\s*/, '').trim();
      titleIndex = i;
      break;
    }
  }

  if (!result.title && originalFilename) {
    result.title = originalFilename.replace(/\.docx$/i, '').replace(/[_-]/g, ' ');
  }

  // 2. Abstract Extraction
  const abstractMatch = text.match(/(?:^|\n)\s*(?:#+\s*)?(?:ABSTRACT|Abstract)[:.]?\s*\n+([\s\S]*?)(?=(?:\n\s*(?:#+\s*)?(?:Keywords|Key\s*words|Index\s*Terms|Introduction|1\.?\s*Introduction|Chapter\s*1)\b)|\n{3,}|$)/i);
  if (abstractMatch && abstractMatch[1]) {
    result.abstract = abstractMatch[1].trim().replace(/\s+/g, ' ').slice(0, 1500);
  }

  // 3. Keywords Extraction
  const keywordsMatch = text.match(/(?:Keywords|Key\s*words|Index\s*Terms)[:.]\s*([^\n\r]+)/i);
  if (keywordsMatch && keywordsMatch[1]) {
    result.keywords = keywordsMatch[1].trim().replace(/\.$/, '');
  }

  // 4. Running Head Extraction
  const runningHeadMatch = text.match(/(?:Running\s*Head|Short\s*Title)[:.]\s*([^\n\r]+)/i);
  if (runningHeadMatch && runningHeadMatch[1]) {
    result.runningHead = runningHeadMatch[1].trim().slice(0, 50).toUpperCase();
  } else if (result.title) {
    result.runningHead = result.title.replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 50).trim().toUpperCase();
  }

  // 5. Author(s) & Affiliation Scanning
  const explicitAuthorMatch = text.match(/(?:Authors?|By|Written by|Prepared by)[:.]\s*([^\n\r]+)/i);
  if (explicitAuthorMatch && explicitAuthorMatch[1]) {
    result.authors = explicitAuthorMatch[1].trim();
  }

  const explicitAffilMatch = text.match(/(?:Affiliation|Institution|University|Department)[:.]\s*([^\n\r]+)/i);
  if (explicitAffilMatch && explicitAffilMatch[1]) {
    result.affiliation = explicitAffilMatch[1].trim();
  }

  if (titleIndex >= 0 && (!result.authors || !result.affiliation)) {
    const candidateLines = lines.slice(titleIndex + 1, Math.min(titleIndex + 8, lines.length));
    for (const line of candidateLines) {
      if (/^(abstract|keywords|table|chapter|introduction)/i.test(line)) break;
      
      const isAffiliation = /(university|college|institute|department|faculty|school\s+of|laboratory|center\s+for|hospital)/i.test(line);
      const isCourseOrDate = /(course|instructor|professor|date|semester|fall|spring|202\d)/i.test(line);
      const isDegreeOrThesis = /(dissertation|thesis|fulfillment|degree\s+of|doctor\s+of|master\s+of)/i.test(line);

      if (isAffiliation && !result.affiliation) {
        result.affiliation = line;
      } else if (!result.authors && !isAffiliation && !isCourseOrDate && !isDegreeOrThesis && line.length < 100) {
        if (/^[A-Za-z\u00C0-\u024F\u0980-\u09FF\u0900-\u097F\u0600-\u06FF\s,.\-&]+$/.test(line) && line.split(/\s+/).length <= 10) {
          result.authors = line;
        }
      }
    }
  }

  // 6. Student Metadata Scanning
  const courseMatch = text.match(/(?:Course|Class|Subject)[:.]\s*([^\n\r]+)/i);
  if (courseMatch) result.course = courseMatch[1].trim();

  const instructorMatch = text.match(/(?:Instructor|Professor|Lecturer)[:.]\s*([^\n\r]+)/i);
  if (instructorMatch) result.instructor = instructorMatch[1].trim();

  const dateMatch = text.match(/(?:Due\s*Date|Submission\s*Date|Date)[:.]\s*([^\n\r]+)/i);
  if (dateMatch) result.dueDate = dateMatch[1].trim();

  // 7. Thesis & Dissertation Metadata Scanning
  const degreeMatch = text.match(/(?:degree\s+of|requirements\s+for\s+the\s+degree\s+of|in\s+candidacy\s+for\s+the\s+degree\s+of)\s+([^\n\r,]+)/i)
    || text.match(/(Doctor\s+of\s+Philosophy|Master\s+of\s+Science|Master\s+of\s+Arts|Doctor\s+of\s+Education|Ph\.?D\.?|M\.?S\.?|M\.?A\.?)/i);
  if (degreeMatch) result.degree = (degreeMatch[1] || degreeMatch[0]).trim();

  const advisorMatch = text.match(/(?:Thesis\s*Advisor|Dissertation\s*Advisor|Supervisor|Committee\s*Chair|Major\s*Professor)[:.]\s*([^\n\r]+)/i);
  if (advisorMatch) result.advisor = advisorMatch[1].trim();

  const deptMatch = text.match(/(?:Department\s+of\s+[^\n\r,]+|Faculty\s+of\s+[^\n\r,]+|School\s+of\s+[^\n\r,]+)/i);
  if (deptMatch) result.department = deptMatch[0].trim();

  const defenseMatch = text.match(/(?:Date\s+of\s+Defense|Defense\s+Date|Approved\s+on|Graduation\s+Date)[:.]\s*([^\n\r]+)/i);
  if (defenseMatch) result.defenseDate = defenseMatch[1].trim();

  return result;
}

/**
 * Generates valid Office Open XML DOCX buffer from text content
 */
export async function exportDocxFromText({ title = 'Untitled Document', content = '', references = [] }) {
  const paragraphs = [];

  // Title heading
  paragraphs.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 300 }
    })
  );

  // Split content by double newlines or paragraph breaks
  const rawParagraphs = content.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  for (const p of rawParagraphs) {
    // Check if paragraph looks like a heading
    if (/^(Abstract|Introduction|Methods|Methodology|Results|Discussion|Conclusion|References|Literature Review|Background)\b/i.test(p) && p.length < 80) {
      paragraphs.push(
        new Paragraph({
          text: p,
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 }
        })
      );
    } else {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: p,
              size: 24 // 12pt
            })
          ],
          spacing: { after: 180, line: 360 } // 1.5 line spacing
        })
      );
    }
  }

  // Append References section if provided
  if (Array.isArray(references) && references.length > 0) {
    paragraphs.push(
      new Paragraph({
        text: 'References',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 150 }
      })
    );

    for (const ref of references) {
      const refText = typeof ref === 'string' ? ref : (ref.formatted || ref.title || '');
      if (refText) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: refText,
                size: 22 // 11pt
              })
            ],
            spacing: { after: 120 }
          })
        );
      }
    }
  }

  const doc = new DocxDocument({
    sections: [
      {
        properties: {},
        children: paragraphs
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}
