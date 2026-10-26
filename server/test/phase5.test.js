import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import AdmZip from 'adm-zip';
import { app } from '../src/index.js';
import {
  escapeLatex,
  mapHeadingToApa7,
  generateCitationKey,
  generateBibtex,
  resolveInTextCitations,
  formatApaTable,
  generateApa7MainTex,
  convertToApa7Project
} from '../src/apa7Converter.js';
import { checkCompilerAvailability, attemptPdfCompilation } from '../src/latexCompiler.js';

let server;
let baseUrl = '';

test.before(async () => {
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
});

// Helper for HTTP requests
async function makeRequest(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, options);
  let body = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await res.json();
  } else if (contentType.includes('application/zip') || contentType.includes('application/pdf')) {
    const arrayBuffer = await res.arrayBuffer();
    body = Buffer.from(arrayBuffer);
  } else {
    body = await res.text();
  }
  return { status: res.status, headers: res.headers, body };
}

test('ResearchProof AI — Phase 5 APA 7 Manuscript Converter Suite', async (t) => {

  // 1. Template Generation: Student Paper
  await t.test('1. Student Paper generates valid apa7 class with stu option and student metadata', () => {
    const tex = generateApa7MainTex({
      variant: 'student',
      title: 'Cognitive Load and Working Memory in Problem Solving',
      authors: [{ name: 'Alex Rivera', affiliation: 'Department of Psychology, Stanford University' }],
      course: 'PSY 301: Cognitive Psychology',
      instructor: 'Dr. Eleanor Vance',
      dueDate: 'November 15, 2026',
      abstract: 'This empirical study explores cognitive load.',
      keywords: ['cognitive load', 'memory', 'retention']
    });

    assert.match(tex, /\\documentclass\[stu,12pt\]\{apa7\}/, 'Must declare apa7 with stu option');
    assert.match(tex, /\\course\{PSY 301: Cognitive Psychology\}/, 'Must include course metadata');
    assert.match(tex, /\\professor\{Dr\. Eleanor Vance\}/, 'Must include professor/instructor metadata');
    assert.match(tex, /\\duedate\{November 15, 2026\}/, 'Must include due date metadata');
    assert.match(tex, /\\title\{Cognitive Load and Working Memory in Problem Solving\}/, 'Must include title');
    assert.match(tex, /\\abstract\{This empirical study explores cognitive load\.\}/, 'Must include abstract');
    assert.match(tex, /\\keywords\{cognitive load, memory, retention\}/, 'Must include keywords');
    // Ensure student papers do NOT have a running head by default
    assert.doesNotMatch(tex, /\\shorttitle/, 'Student paper must not have running head by default');
  });

  // 2. Template Generation: Professional Manuscript
  await t.test('2. Professional Manuscript generates valid apa7 class with man option, short title, and author note', () => {
    const tex = generateApa7MainTex({
      variant: 'professional',
      title: 'Neural Correlates of Working Memory Under Time Pressure',
      authors: [
        { name: 'Dr. Jane Smith', affiliation: 'Harvard University' },
        { name: 'Dr. John Doe', affiliation: 'MIT' }
      ],
      runningHead: 'Working Memory Under Time Pressure',
      authorNote: 'Correspondence concerning this article should be addressed to Dr. Jane Smith.',
      abstract: 'Professional abstract summarizing experimental findings across three cohorts.',
      keywords: ['neuroscience', 'fMRI', 'decision making']
    });

    assert.match(tex, /\\documentclass\[man,12pt\]\{apa7\}/, 'Must declare apa7 with man option');
    assert.match(tex, /\\shorttitle\{WORKING MEMORY UNDER TIME PRESSURE\}/, 'Must uppercase short title up to 50 chars');
    assert.match(tex, /\\authornote\{Correspondence concerning this article should be addressed to Dr\. Jane Smith\.\}/, 'Must include author note');
    assert.match(tex, /\\printbibliography/, 'Must include printbibliography command');
  });

  // 3. LaTeX Escaping with Scientific Math & Statistics Preservation
  await t.test('3. LaTeX escaping preserves math tokens and statistical indicators while escaping plain text', () => {
    const plainText = 'Results showed 15% increase & significant improvement (p < .05, F(1, 42) = 5.23) with alpha = .05 and cost of $100 #1.';
    const escaped = escapeLatex(plainText);

    // Escaped plain text characters
    assert.ok(escaped.includes('15\\%'), 'Must escape percent signs');
    assert.ok(escaped.includes('\\&'), 'Must escape ampersand');
    assert.ok(escaped.includes('\\#1'), 'Must escape hash');

    // Preserved statistical expressions in math mode
    assert.ok(escaped.includes('$p < .05$'), 'Must preserve p-value in math mode');
    assert.ok(escaped.includes('$F(1, 42) = 5.23$'), 'Must preserve F-statistic');
    assert.ok(escaped.includes('$\\alpha = .05$') || escaped.includes('$\\alpha$'), 'Must preserve Greek symbol alpha');
  });

  // 4. APA 7 Heading Hierarchy Mapping
  await t.test('4. Heading mapping correctly translates 5 levels according to APA 7 rules', () => {
    const h1 = mapHeadingToApa7('Method', 1);
    const h2 = mapHeadingToApa7('Participants and Sampling', 2);
    const h3 = mapHeadingToApa7('Inclusion Criteria', 3);
    const h4 = mapHeadingToApa7('Age Range.', 4);
    const h5 = mapHeadingToApa7('Sub-cohort Analysis.', 5);

    assert.strictEqual(h1, '\\section{Method}');
    assert.strictEqual(h2, '\\subsection{Participants and Sampling}');
    assert.strictEqual(h3, '\\subsubsection{Inclusion Criteria}');
    assert.strictEqual(h4, '\\paragraph{Age Range.}');
    assert.strictEqual(h5, '\\subparagraph{Sub-cohort Analysis.}');
  });

  // 5. APA Citation & BibTeX Generation
  await t.test('5. BibTeX generator formats citations with DOIs and detects duplicates', () => {
    const citations = [
      {
        authors: [{ family: 'Kahneman', given: 'Daniel' }],
        year: '2011',
        title: 'Thinking, Fast and Slow',
        publisher: 'Farrar, Straus and Giroux',
        doi: '10.1037/0000001'
      },
      {
        authors: [{ family: 'Tversky', given: 'Amos' }, { family: 'Kahneman', given: 'Daniel' }],
        year: '1974',
        title: 'Judgment under Uncertainty: Heuristics and Biases',
        journal: 'Science',
        volume: '185',
        issue: '4157',
        pages: '1124-1131',
        doi: '10.1126/science.185.4157.1124'
      },
      {
        authors: [{ family: 'Duplicate', given: 'Author' }],
        year: '2020',
        title: 'Duplicate Entry',
        doi: '10.1037/0000001' // Duplicate DOI
      }
    ];

    const { bibContent, duplicateWarnings } = generateBibtex(citations);
    assert.match(bibContent, /@book\{kahneman2011think/i);
    assert.match(bibContent, /author = \{Kahneman, Daniel\}/);
    assert.match(bibContent, /doi = \{10.1126\/science.185.4157.1124\}/);
    assert.strictEqual(duplicateWarnings.length, 1, 'Must flag duplicate DOI');
    assert.ok(duplicateWarnings[0].includes('10.1037/0000001'));
  });

  // 6. In-Text Citation Resolution (Parenthetical & Narrative)
  await t.test('6. In-text citations resolve to parencite and textcite without fabricating unknown keys', () => {
    const citations = [
      { citationKey: 'smith2020', author: 'Smith', year: '2020', title: 'Memory Study' }
    ];

    const sampleText = 'Prior experiments (Smith, 2020) confirmed this effect, and Smith (2020) argued for replication. However, (Jones, 2022) was not found.';
    const { resolvedText, warnings } = resolveInTextCitations(sampleText, citations);

    assert.ok(resolvedText.includes('\\parencite{smith2020}'), 'Must resolve parenthetical citation');
    assert.ok(resolvedText.includes('\\textcite{smith2020}'), 'Must resolve narrative citation');
    assert.ok(resolvedText.includes('(Jones, 2022)'), 'Must preserve unresolved citation as plain text');
    assert.strictEqual(warnings.length, 1, 'Must warn for unresolved citation without inventing key');
  });

  // 7. Table Formatting with Booktabs
  await t.test('7. Table formatter produces clean booktabs layout without vertical lines', () => {
    const tableData = {
      title: 'Participant Demographics',
      headers: ['Condition', 'Sample Size (N)', 'Mean Age (SD)'],
      rows: [
        ['Control', '45', '21.4 (2.1)'],
        ['Experimental', '48', '21.8 (2.4)']
      ],
      note: 'Values reflect baseline measurements before intervention.'
    };

    const tableTex = formatApaTable(tableData, 1);
    assert.match(tableTex, /\\begin\{table\}\[htbp\]/);
    assert.match(tableTex, /\\toprule/);
    assert.match(tableTex, /\\midrule/);
    assert.match(tableTex, /\\bottomrule/);
    assert.match(tableTex, /\\caption\{Participant Demographics\}/);
    assert.match(tableTex, /\\textit\{Note\.\} Values reflect baseline measurements/);
    assert.doesNotMatch(tableTex, /\|/, 'Must avoid vertical rules in APA 7 tables');
  });

  // 8. ZIP Archive Project Packaging
  await t.test('8. convertToApa7Project produces valid ZIP buffer with all required files', async () => {
    const projectResult = await convertToApa7Project({
      variant: 'student',
      title: 'Validating APA 7 Conversion Architecture',
      authors: [{ name: 'Test Researcher', affiliation: 'ResearchProof Lab' }],
      course: 'CS 500',
      instructor: 'Prof. Miller',
      rawText: '## Introduction\n\nThis is the introductory section.\n\n## Method\n\nWe evaluated conversion pipelines.',
      citations: [
        { author: 'Miller', year: '2023', title: 'Automated Typesetting' }
      ]
    });

    assert.ok(projectResult.zipBuffer, 'Must return a zipBuffer');
    assert.ok(projectResult.zipBuffer.length > 500, 'ZIP buffer must have substantial size');

    // Verify ZIP magic bytes (PK\x03\x04)
    const magicBytes = projectResult.zipBuffer.slice(0, 4).toString('hex');
    assert.strictEqual(magicBytes, '504b0304', 'ZIP buffer must start with PK magic bytes');

    // Inspect entries with AdmZip
    const zip = new AdmZip(projectResult.zipBuffer);
    const entryNames = zip.getEntries().map(e => e.entryName);

    assert.ok(entryNames.includes('researchproof-apa7-manuscript/main.tex'), 'Must contain main.tex');
    assert.ok(entryNames.includes('researchproof-apa7-manuscript/references.bib'), 'Must contain references.bib');
    assert.ok(entryNames.includes('researchproof-apa7-manuscript/README.md'), 'Must contain README.md');
    assert.ok(entryNames.includes('researchproof-apa7-manuscript/latexmkrc'), 'Must contain latexmkrc');
    assert.ok(entryNames.includes('researchproof-apa7-manuscript/conversion-report.json'), 'Must contain conversion-report.json');
    assert.ok(entryNames.some(e => e.startsWith('researchproof-apa7-manuscript/sections/')), 'Must contain modular sections');

    // Verify Overleaf segment data
    assert.ok(projectResult.standaloneMainTex, 'Must return standaloneMainTex for 1-click Overleaf paste');
    assert.ok(projectResult.modularMainTex, 'Must return modularMainTex for modular Overleaf structures');
    assert.ok(Array.isArray(projectResult.sections), 'Must return sections segment array');
    assert.strictEqual(projectResult.sections.length, 2, 'Must parse 2 sections');
    assert.strictEqual(projectResult.sections[0].heading, 'Introduction');
    assert.strictEqual(projectResult.sections[1].heading, 'Method');
  });

  // 9. Compiler Fallback Verification (Render environment compatibility)
  await t.test('9. Compiler worker gracefully handles unavailable TeX compiler without crashing conversion', async () => {
    const compiler = checkCompilerAvailability();
    assert.strictEqual(typeof compiler.available, 'boolean');

    const fakeZip = new AdmZip();
    fakeZip.addFile('main.tex', Buffer.from('\\documentclass{apa7}\\begin{document}Hello\\end{document}'));
    const result = await attemptPdfCompilation(fakeZip.toBuffer());

    assert.ok(result.status === 'unavailable' || result.status === 'compiled' || result.status === 'failed');
    if (!compiler.available) {
      assert.strictEqual(result.compiled, false);
      assert.strictEqual(result.status, 'unavailable');
      assert.ok(result.message.includes('Render') || result.message.includes('LaTeX compiler'));
    }
  });

  // 10. API: GET /api/latex/templates/apa7
  await t.test('10. GET /api/latex/templates/apa7 returns Student and Professional schemas', async () => {
    const res = await makeRequest('/api/latex/templates/apa7');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.templates));
    assert.strictEqual(res.body.templates.length, 2);

    const ids = res.body.templates.map(t => t.id);
    assert.ok(ids.includes('student'));
    assert.ok(ids.includes('professional'));
    assert.ok(res.body.compilerStatus);
  });

  // 11. API Security: Unauthenticated Conversion Rejected (401)
  await t.test('11. POST /api/latex/apa7/convert rejects unauthenticated requests with 401', async () => {
    const res = await makeRequest('/api/latex/apa7/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Paper', variant: 'student' })
    });
    assert.strictEqual(res.status, 401);
  });

  // 12. Full End-to-End API Conversion & Download Flow
  await t.test('12. Authenticated user can convert document, inspect report, and download ZIP', async () => {
    // 1. Login demo researcher
    const loginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@researchproof.ai', password: 'Password1234!' })
    });
    assert.strictEqual(loginRes.status, 200);
    const token = loginRes.body.token;

    // 2. Perform Conversion
    const convertRes = await makeRequest('/api/latex/apa7/convert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title: 'Empirical Investigation of Working Memory Capacity',
        variant: 'student',
        course: 'PSY 401: Advanced Experimental Methods',
        instructor: 'Dr. Katherine Bell',
        dueDate: 'December 1, 2026',
        abstract: 'This manuscript reports experimental findings on memory capacity.',
        keywords: ['memory', 'cognition', 'recall'],
        rawText: '## Introduction\n\nWorking memory capacity varies across individuals.\n\n## Method\n\nWe tested 120 undergraduate participants (p < .01).'
      })
    });

    assert.strictEqual(convertRes.status, 201);
    assert.strictEqual(convertRes.body.success, true);
    assert.ok(convertRes.body.jobId);
    assert.strictEqual(convertRes.body.template, 'apa7');
    assert.strictEqual(convertRes.body.variant, 'student');
    assert.ok(convertRes.body.artifactReferences.zipSize > 0);
    assert.ok(convertRes.body.mainTex, 'Must return full mainTex');
    assert.ok(convertRes.body.standaloneMainTex, 'Must return standaloneMainTex for Overleaf paste');
    assert.ok(Array.isArray(convertRes.body.sections), 'Must return sections array');
    assert.strictEqual(convertRes.body.sections.length, 2);

    const jobId = convertRes.body.jobId;

    // 3. Inspect Job Status
    const jobRes = await makeRequest(`/api/latex/jobs/${jobId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(jobRes.status, 200);
    assert.strictEqual(jobRes.body._id, jobId);

    // 4. Retrieve Conversion Report
    const reportRes = await makeRequest(`/api/latex/jobs/${jobId}/report`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(reportRes.status, 200);
    assert.strictEqual(reportRes.body.template, 'apa7');

    // 5. Download ZIP Archive
    const zipRes = await makeRequest(`/api/latex/jobs/${jobId}/download-zip`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.strictEqual(zipRes.status, 200);
    assert.strictEqual(zipRes.headers.get('content-type'), 'application/zip');
    assert.ok(zipRes.body.length > 500);

    // 6. Cross-User Security Check: Another user cannot access or download this job
    // Register second user
    const user2Res = await makeRequest('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `intruder_${Date.now()}@example.com`,
        password: 'Password1234!',
        displayName: 'Intruder'
      })
    });
    assert.strictEqual(user2Res.status, 201);
    const token2 = user2Res.body.token;

    // Second user tries to access first user's job
    const unauthorizedJobRes = await makeRequest(`/api/latex/jobs/${jobId}`, {
      headers: { 'Authorization': `Bearer ${token2}` }
    });
    assert.strictEqual(unauthorizedJobRes.status, 403, 'Cross-user job view must be rejected with 403');

    // Second user tries to download first user's ZIP
    const unauthorizedZipRes = await makeRequest(`/api/latex/jobs/${jobId}/download-zip`, {
      headers: { 'Authorization': `Bearer ${token2}` }
    });
    assert.strictEqual(unauthorizedZipRes.status, 403, 'Cross-user ZIP download must be rejected with 403');
  });

});
