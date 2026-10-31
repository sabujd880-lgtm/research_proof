import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/index.js';
import {
  searchJournals,
  getJournalById,
  matchManuscriptToJournals,
  getJournalGuidelines,
  checkManuscriptCompliance,
  generateAcademicCoverLetter,
  buildSubmissionPackage,
  SUBMISSION_STATUSES
} from '../src/journalSubmissionService.js';

let server;
let baseUrl;

test.before(async () => {
  process.env.NODE_ENV = 'test';
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('Phase 9 — Journal Submission Studio Comprehensive Test Suite', async (t) => {
  let authToken = '';
  let projectId = '';

  await t.test('0. Setup authenticated session and project for researcher', async () => {
    // Authenticate
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@researchproof.ai', password: 'Password1234!' })
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.ok(loginData.token);
    authToken = loginData.token;

    // Create project
    const projRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        title: 'Cognitive Substrates of Decision Making',
        description: 'Empirical study on prefrontal cortex activations'
      })
    });
    assert.equal(projRes.status, 201);
    const projData = await projRes.json();
    projectId = projData._id || projData.id;
    assert.ok(projectId);
  });

  await t.test('1. Journal Discovery: Search by discipline, publisher, and query keywords', async () => {
    // 1a. Search by title
    const searchRes = await fetch(`${baseUrl}/api/journals/search?q=cognitive`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(searchRes.status, 200);
    const searchData = await searchRes.json();
    assert.equal(searchData.success, true);
    assert.ok(searchData.count >= 1);
    const j1 = searchData.journals.find(j => j.title.includes('Cognitive'));
    assert.ok(j1);
    assert.equal(j1.publisher, 'MIT Press');
    assert.equal(j1.issn, '0898-929X');

    // 1b. Search open access journals
    const oaRes = await fetch(`${baseUrl}/api/journals/search?openAccess=oa_only`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const oaData = await oaRes.json();
    assert.ok(oaData.journals.every(j => j.openAccess === true));
  });

  await t.test('2. Journal Details & Author Guidelines retrieval', async () => {
    const guideRes = await fetch(`${baseUrl}/api/journals/j-mit-jocn/guidelines`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(guideRes.status, 200);
    const data = await guideRes.json();
    assert.equal(data.success, true);
    assert.equal(data.guidelines.journalTitle, 'Journal of Cognitive Neuroscience');
    assert.equal(data.guidelines.wordLimit, 8500);
    assert.equal(data.guidelines.citationStyle, 'apa7');
    assert.ok(data.guidelines.requiredSections.includes('Methods'));
    assert.ok(data.guidelines.guidelinesUrl.startsWith('https://'));
    assert.ok(data.guidelines.lastVerified);
  });

  await t.test('3. Multi-Attribute Journal Matching against manuscript attributes', async () => {
    const matchRes = await fetch(`${baseUrl}/api/journals/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        title: 'Neural Substrates of Visual Working Memory in Prefrontal Networks',
        abstract: 'We conducted high-resolution fMRI across 48 participants performing complex working memory tasks to map cognitive neural substrates.',
        keywords: ['fMRI', 'working memory', 'prefrontal cortex', 'cognitive neuroscience'],
        discipline: 'Neuroscience & Psychology',
        studyType: 'empirical',
        wordCount: 6500
      })
    });
    assert.equal(matchRes.status, 200);
    const matchData = await matchRes.json();
    assert.equal(matchData.success, true);
    assert.ok(matchData.matches.length >= 5);

    // Top match should be Cognitive Neuroscience
    const topMatch = matchData.matches[0];
    assert.ok(topMatch.journal.title.includes('Cognitive') || topMatch.journal.title.includes('Human Behaviour'));
    assert.ok(topMatch.matchScore > 70);
    assert.ok(topMatch.scopeAlignment);
    assert.ok(topMatch.articleTypeCompatibility);
    assert.ok(matchData.disclaimer);
  });

  await t.test('4. Manuscript Compliance Checker audits sections, word count, and ethics', async () => {
    const manuscriptText = `Neural Substrates of Visual Working Memory in Prefrontal Networks

Abstract
This study examines the neural correlates of visual working memory using functional neuroimaging. We evaluated 48 participants performing continuous visual retention tasks. Results indicate sustained activation within the dorsolateral prefrontal cortex.

Keywords: working memory, fMRI, prefrontal cortex, cognitive neuroscience

Introduction
Understanding human cognitive architecture requires identifying the neural systems that support active representations (Miller et al., 2018).

Methods
Forty-eight healthy adults participated. Functional MRI scanning was acquired on a 3T scanner with standard preprocessing.

Results
Significant clusters of activation emerged within bilateral prefrontal regions, t(47) = 4.82, p < 0.001.

Discussion
These findings provide direct empirical support for distributed executive models.

Ethics & Data Availability
Institutional review board approval was obtained from University Ethics Committee (IRB-2026-08). Informed consent was documented. Data and code are openly available on OSF.

References
Miller, E. K., et al. (2018). Neural mechanisms of working memory. Journal of Cognitive Neuroscience, 30(4), 512-525.`;

    const compRes = await fetch(`${baseUrl}/api/journals/check-compliance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        manuscriptText,
        journalId: 'j-mit-jocn'
      })
    });
    assert.equal(compRes.status, 200);
    const compData = await compRes.json();
    assert.equal(compData.success, true);
    assert.ok(compData.report.compliancePercentage >= 75);
    assert.ok(compData.report.checks.some(c => c.id === 'word_count' && c.status === 'passed'));
    assert.ok(compData.report.checks.some(c => c.id === 'abstract_length' && c.status === 'passed'));
    assert.ok(compData.report.checks.some(c => c.id === 'ethics_statement' && c.status === 'passed'));
  });

  await t.test('5. Academic Cover Letter Generator produces formal and concise letters', async () => {
    const letterRes = await fetch(`${baseUrl}/api/projects/${projectId}/submission/cover-letter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        targetJournal: 'Journal of Cognitive Neuroscience',
        editorName: 'Bradley R. Postle, Ph.D.',
        manuscriptTitle: 'Neural Substrates of Visual Working Memory',
        articleType: 'Research Article',
        keyFindings: 'We demonstrate that prefrontal top-down modulation directly gates storage in posterior parietal cortex.',
        mode: 'formal'
      })
    });
    assert.equal(letterRes.status, 200);
    const letterData = await letterRes.json();
    assert.equal(letterData.success, true);
    assert.ok(letterData.coverLetter.includes('Bradley R. Postle, Ph.D.'));
    assert.ok(letterData.coverLetter.includes('Journal of Cognitive Neuroscience'));
    assert.ok(letterData.coverLetter.includes('Neural Substrates of Visual Working Memory'));
    assert.ok(letterData.coverLetter.includes('Research Article'));
  });

  await t.test('6. Build Submission Package: Compiles ZIP package with manifest and verified checksums', async () => {
    const pkgRes = await fetch(`${baseUrl}/api/projects/${projectId}/submission/package`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        manuscriptText: 'Title: Neural Substrates\n\nAbstract\nThis study explores memory networks.\n\nMethods\nfMRI trial...',
        manuscriptTitle: 'Neural Substrates of Visual Working Memory',
        coverLetter: 'Dear Editor,\n\nPlease consider our work.\n\nSincerely,\nResearcher',
        targetJournal: 'Journal of Cognitive Neuroscience'
      })
    });
    assert.equal(pkgRes.status, 200);
    const pkgData = await pkgRes.json();
    assert.equal(pkgData.success, true);
    assert.ok(pkgData.manifest.packageName.endsWith('.zip'));
    assert.ok(pkgData.manifest.totalFiles >= 4);
    assert.ok(pkgData.manifest.files.some(f => f.fileName === '01_Main_Manuscript.txt'));
    assert.ok(pkgData.manifest.files.some(f => f.fileName === '02_Cover_Letter.txt'));
    assert.ok(pkgData.manifest.files.some(f => f.fileName === '03_Ethics_and_Declarations.txt'));
    assert.ok(pkgData.manifest.files.every(f => f.sha256.length === 64));
  });

  await t.test('7. Download Submission Package: Streams compiled ZIP buffer with HTTP 200 and attachment header', async () => {
    const dlRes = await fetch(`${baseUrl}/api/projects/${projectId}/submission/package/download`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(dlRes.status, 200);
    assert.equal(dlRes.headers.get('content-type'), 'application/zip');
    assert.ok(dlRes.headers.get('content-disposition').includes('attachment; filename='));
    const buffer = await dlRes.arrayBuffer();
    assert.ok(buffer.byteLength > 100);
  });

  await t.test('8. Submission Tracking: Lifecycle milestone state updates and chronological audit logging', async () => {
    // 8a. Update status to 'submitted'
    const statusRes = await fetch(`${baseUrl}/api/projects/${projectId}/submission/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        status: 'submitted',
        manuscriptId: 'JOCN-2026-0492',
        note: 'Uploaded via ScholarOne portal with 4 figure files.'
      })
    });
    assert.equal(statusRes.status, 200);
    const statusData = await statusRes.json();
    assert.equal(statusData.success, true);
    assert.equal(statusData.submission.status, 'submitted');
    assert.equal(statusData.submission.manuscriptId, 'JOCN-2026-0492');

    // 8b. Transition to 'peer_review'
    const reviewRes = await fetch(`${baseUrl}/api/projects/${projectId}/submission/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        status: 'peer_review',
        note: 'Assigned to Associate Editor and 2 anonymous peer reviewers.'
      })
    });
    const reviewData = await reviewRes.json();
    assert.equal(reviewData.submission.status, 'peer_review');
    assert.ok(reviewData.submission.events.length >= 2);

    // 8c. Reject invalid status
    const invalidRes = await fetch(`${baseUrl}/api/projects/${projectId}/submission/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ status: 'invalid_status_xyz' })
    });
    assert.equal(invalidRes.status, 400);
  });
});
