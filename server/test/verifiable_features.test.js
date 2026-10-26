import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/index.js';
import { validateDocumentCitations } from '../src/citationService.js';
import { compareManuscriptVersions } from '../src/meaningChecker.js';
import { generateSubmissionChecklist, generateComprehensiveDossier } from '../src/dossierService.js';

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

test('ResearchProof AI — Verifiable Reports, Version Comparison, & Checklist Suite', async (t) => {
  async function apiRequest(path, options = {}) {
    const url = `${baseUrl}/api${path}`;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined
    });
    let data;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => ({}));
    } else {
      data = await res.text();
    }
    return { status: res.status, headers: res.headers, body: data };
  }

  // Setup test user
  const email = `audit-${Date.now()}@university.edu`;
  const password = 'StrongPassword123!';
  let authToken = '';

  const regRes = await apiRequest('/auth/register', {
    method: 'POST',
    body: { name: 'Audit Researcher', email, password }
  });
  authToken = regRes.body.token;

  await t.test('1. Retraction and correction detection in citation verification', () => {
    const text = 'Recent meta-analyses (10.1038/retracted-paper-1) suggested high efficacy, while control trials demonstrated moderate response.';
    const citations = [
      {
        _id: 'cit-retracted',
        doi: '10.1038/retracted-paper-1',
        title: 'RETRACTED ARTICLE: Cognitive enhancement through micro-stimulation',
        year: '2021',
        isRetracted: true,
        authors: [{ family: 'Smith', given: 'John' }]
      },
      {
        _id: 'cit-valid',
        doi: '10.1038/s41586-020-0001-x',
        title: 'Synaptic Plasticity and Long-Term Memory',
        year: '2020',
        authors: [{ family: 'Taylor', given: 'Sarah' }]
      }
    ];

    const result = validateDocumentCitations(text, citations);
    assert.equal(result.valid, false, 'Should be invalid due to retracted citation');
    assert.equal(result.retractedReferences.length, 1);
    assert.equal(result.retractedReferences[0].doi, '10.1038/retracted-paper-1');
    assert.ok(result.retractedReferences[0].detail.includes('active retraction'));
    assert.equal(result.summary.retractedCount, 1);
  });

  await t.test('2. Manuscript Version Comparison: detects citation additions, statistical shifts, and polarity reversals', () => {
    const v1 = `
      Prior research in distributed computing shows significant speedup (Smith, 2020).
      Our cohort consisted of N = 120 participants across 3 centers.
      The experimental intervention significantly increased cognitive scores, F(2, 118) = 8.42, p = 0.003.
      In summary, our findings confirm the working hypothesis that stimulation facilitates neural activation.
    `;

    const v2 = `
      Prior research in distributed computing shows significant speedup (Smith, 2020; Johnson, 2023).
      Our cohort consisted of N = 95 participants across 3 centers after strict exclusion criteria.
      The experimental intervention did not significantly increase cognitive scores, F(2, 93) = 1.15, p = 0.320.
      In summary, our findings reject the working hypothesis that stimulation facilitates neural activation.
    `;

    const comparison = compareManuscriptVersions(v1, v2, {
      originalLabel: 'Manuscript Draft 1',
      revisedLabel: 'Revision 2 (Post-Peer Review)'
    });

    assert.ok(comparison.comparisonSummary);
    assert.equal(typeof comparison.wordCountDelta, 'number');

    // Citations
    assert.ok(comparison.citations.added.length >= 1 || comparison.citations.preserved.length >= 1);

    // Statistics
    assert.ok(comparison.statistics.originalStats.pValues.length >= 1);
    assert.ok(comparison.statistics.revisedStats.pValues.length >= 1);
    assert.ok(comparison.statistics.originalStats.sampleSizes.length >= 1);
    assert.ok(comparison.statistics.revisedStats.sampleSizes.length >= 1);

    // Empirical and polarity reversals
    assert.ok(comparison.empiricalDeltas.alteredAssertions.length >= 1);
    assert.ok(comparison.empiricalDeltas.potentialReversals.length >= 1, 'Should detect polarity flip (increased vs did not significantly increase / confirm vs reject)');
  });

  await t.test('3. Pre-Flight Submission Checklist: validates IMRAD structure, figures/tables, and publisher declarations', () => {
    const incompletePaper = `
      # Preliminary Results on Carbon Capture
      We tested a new porous material for CO2 absorption.
      The material absorbed 14 mmol/g under ambient conditions.
    `;

    const incompleteCheck = generateSubmissionChecklist(incompletePaper, { targetJournal: 'nature' });
    assert.equal(incompleteCheck.structure.isIMRaDCompliant, false);
    assert.ok(incompleteCheck.structure.missingSections.length > 0);
    assert.ok(incompleteCheck.readinessScore < 70);
    assert.equal(incompleteCheck.declarations.hasDataAvailability, false);
    assert.equal(incompleteCheck.declarations.hasCompetingInterests, false);

    const completePaper = `
      # High-Capacity Porous Frameworks for Ambient Carbon Capture
      ## Abstract
      Direct air capture requires scalable porous materials with high selectivity.
      ## Introduction
      Atmospheric carbon dioxide concentrations demand innovative sorbents (10.1038/s41586-020-0001-x).
      ## Methods
      We synthesized MOF-303 using solvothermal crystallization. See Figure 1 for crystalline structure.
      ## Results
      As shown in Table 1, the framework achieved 14.2 mmol/g uptake, p = 0.002, with N = 45 trial runs.
      ## Discussion
      These findings demonstrate superior kinetic performance over commercial zeolites.
      ## Data Availability
      Crystallographic datasets are available in the Cambridge Structural Database (CCDC 2054123).
      ## Competing Interests
      The authors declare no competing financial interests.
      ## Ethics Statement
      No human participants or vertebrate animals were involved in this study.
      ## References
      10.1038/s41586-020-0001-x
    `;

    const completeCheck = generateSubmissionChecklist(completePaper, { targetJournal: 'nature' });
    assert.equal(completeCheck.structure.isIMRaDCompliant, true);
    assert.equal(completeCheck.structure.missingSections.length, 0);
    assert.equal(completeCheck.figuresAndTables.figureCalloutsFound.length, 1);
    assert.equal(completeCheck.figuresAndTables.tableCalloutsFound.length, 1);
    assert.equal(completeCheck.declarations.hasDataAvailability, true);
    assert.equal(completeCheck.declarations.hasCompetingInterests, true);
    assert.ok(completeCheck.readinessScore >= 80);
    assert.ok(completeCheck.targetJournal.name.includes('Nature'));
  });

  await t.test('4. GET /api/integrity/verify/:hash: Public verification without exposing manuscript raw text', async () => {
    // 4.1 Querying non-existent hash returns 404
    const notFoundRes = await apiRequest('/integrity/verify/0000000000000000000000000000000000000000000000000000000000000000');
    assert.equal(notFoundRes.status, 404);
    assert.equal(notFoundRes.body.valid, false);

    // 4.2 Generate a genuine dossier to obtain a verification hash
    const text = `# Genuine Verified Study on Memory Retention
## Abstract
We evaluated distributed practice across cohorts.
## Methods
Participants engaged in spaced repetition.
## Results
Retention rates increased significantly, p = 0.012, N = 80.
## Discussion
Results support cognitive consolidation models.
## Data Availability
All data is open on OSF.
## Competing Interests
None.
`;
    const dossier = await generateComprehensiveDossier({
      text,
      title: 'Genuine Memory Study',
      documentId: 'doc-verify-test',
      ownerId: 'user-audit-1'
    });

    const hash = dossier.verificationHash;
    assert.ok(hash);

    // 4.3 Look up via public verification endpoint
    const verifyRes = await apiRequest(`/integrity/verify/${hash}`);
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.valid, true);
    assert.equal(verifyRes.body.reportId, dossier.reportId);
    assert.equal(verifyRes.body.sha256, hash);
    assert.equal(verifyRes.body.title, 'Genuine Memory Study');
    assert.equal(typeof verifyRes.body.similarityScore, 'number');
    assert.equal(typeof verifyRes.body.meaningValidationStatus, 'string');
    // Confirm raw text is never exposed
    assert.equal(verifyRes.body.text, undefined);
    assert.equal(verifyRes.body.content, undefined);
    assert.equal(verifyRes.body.manuscript, undefined);
  });

  await t.test('5. POST /api/documents/compare: Compares manuscript versions via HTTP API', async () => {
    // Unauthenticated
    const unauthRes = await apiRequest('/documents/compare', {
      method: 'POST',
      body: { originalText: 'test 1', revisedText: 'test 2' }
    });
    assert.equal(unauthRes.status, 401);

    // Authenticated
    const compRes = await apiRequest('/documents/compare', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: {
        originalText: 'Initial study cohort N = 50 with p = .045 showed positive effects.',
        revisedText: 'Revised study cohort N = 75 with p = .008 showed robust positive effects.'
      }
    });

    assert.equal(compRes.status, 200);
    assert.ok(compRes.body.comparison);
    assert.ok(compRes.body.comparison.wordCountDelta !== undefined);
    assert.ok(compRes.body.comparison.statistics);
    assert.ok(compRes.body.comparison.citations);
  });

  await t.test('6. POST /api/integrity/submission-checklist: Generates pre-flight submission report via HTTP API', async () => {
    // Unauthenticated
    const unauthRes = await apiRequest('/integrity/submission-checklist', {
      method: 'POST',
      body: { text: 'Brief text', targetJournal: 'ieee' }
    });
    assert.equal(unauthRes.status, 401);

    // Authenticated
    const checkRes = await apiRequest('/integrity/submission-checklist', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: {
        text: `# Neural Architecture Search for Edge Devices
## Abstract
We present a hardware-aware search algorithm.
## Introduction
Deploying deep learning on microcontrollers requires Pareto-optimal models.
## Methods
We formulated a multi-objective evolutionary strategy.
## Results
Model size decreased by 40% with no loss in accuracy, p = 0.001.
## Discussion
Edge latency reduced to 12ms.
## Data Availability
Code is published on GitHub.
## Competing Interests
None declared.
`,
        targetJournal: 'ieee'
      }
    });

    assert.equal(checkRes.status, 200);
    assert.ok(checkRes.body.checklist);
    assert.equal(checkRes.body.checklist.targetJournal.name, 'IEEE Transactions');
    assert.equal(checkRes.body.checklist.structure.isIMRaDCompliant, true);
    assert.ok(checkRes.body.checklist.readinessScore > 50);
  });
});
