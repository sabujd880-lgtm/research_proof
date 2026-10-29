import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/index.js';

let server;
let pipeName;

function api(path, options = {}) {
  return new Promise((resolve, reject) => {
    const payload = options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : null;
    const req = http.request({
      socketPath: pipeName,
      path,
      method: options.method || 'GET',
      headers: {
        'x-forwarded-for': '127.0.0.1',
        ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}),
        ...(options.headers || {})
      }
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const rawBuffer = Buffer.concat(chunks);
        const text = rawBuffer.toString('utf8');
        let body = {};
        try { body = text ? JSON.parse(text) : {}; } catch (_) { body = text; }
        resolve({ status: res.statusCode, headers: res.headers, body, rawBuffer });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test.before(async () => {
  process.env.NODE_ENV = 'test';
  pipeName = `\\\\.\\pipe\\rp-phase5-test-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(pipeName, resolve);
  });
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('ResearchProof AI — Phase 5 Literature Review Studio Suite', async (t) => {
  let userAToken = '';
  let userBToken = '';
  let userAId = '';
  let userBId = '';
  let projectAId = '';
  const userAEmail = `phase5-lituserA-${Date.now()}@university.edu`;
  const userBEmail = `phase5-lituserB-${Date.now()}@university.edu`;

  await t.test('1. Setup User A and User B accounts with an active research project', async () => {
    const resA = await api('/api/auth/register', {
      method: 'POST',
      body: {
        email: userAEmail,
        password: 'Password123!Secure',
        name: 'Dr. Jane Literature'
      }
    });
    assert.strictEqual(resA.status, 201);
    assert.ok(resA.body.token);
    userAToken = resA.body.token;
    userAId = resA.body.user._id || resA.body.user.id;

    const resB = await api('/api/auth/register', {
      method: 'POST',
      body: {
        email: userBEmail,
        password: 'Password123!Secure',
        name: 'Dr. Bob Isolation'
      }
    });
    assert.strictEqual(resB.status, 201);
    assert.ok(resB.body.token);
    userBToken = resB.body.token;
    userBId = resB.body.user._id || resB.body.user.id;

    // Create research project for User A
    const projRes = await api('/api/v1/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        title: 'Cognitive Load and Generative Learning in STEM',
        description: 'Empirical investigation of generative AI prompts on learner schema acquisition.',
        category: 'Education & Cognitive Science',
        visibility: 'private'
      }
    });
    assert.strictEqual(projRes.status, 201);
    projectAId = projRes.body._id || projRes.body.id || projRes.body.project?._id;
    assert.ok(projectAId);
  });

  await t.test('2. Unauthenticated requests to Literature endpoints return 401 Unauthorized', async () => {
    const resList = await api('/api/v1/literature');
    assert.strictEqual(resList.status, 401);

    const resSearch = await api('/api/v1/literature/search?query=cognitive');
    assert.strictEqual(resSearch.status, 401);

    const resMatrix = await api('/api/v1/literature/matrix');
    assert.strictEqual(resMatrix.status, 401);

    const resThemes = await api('/api/v1/literature/themes');
    assert.strictEqual(resThemes.status, 401);

    const resExport = await api('/api/v1/literature/export');
    assert.strictEqual(resExport.status, 401);
  });

  await t.test('3. Scholarly Search returns structured results with source attribution', async () => {
    const res = await api('/api/v1/literature/search?query=attention+transformer+deep+learning&limit=5', {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.results));
    assert.ok(res.body.results.length > 0);
    const first = res.body.results[0];
    assert.ok(first.title);
    assert.ok(first.authors);
  });

  let importedEntryId = '';
  await t.test('4. Scholarly Paper Import endpoint creates literature entry for project', async () => {
    const res = await api('/api/v1/literature/import', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        projectId: projectAId,
        title: 'Attention Is All You Need',
        authors: ['Vaswani, A.', 'Shazeer, N.', 'Parmar, N.', 'Uszkoreit, J.'],
        year: '2017',
        journal: 'Advances in Neural Information Processing Systems',
        doi: '10.5555/3295222.3295349',
        abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose the Transformer, based solely on attention mechanisms.',
        status: 'identified',
        extractionStatus: 'pending'
      }
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.entry);
    assert.strictEqual(res.body.entry.title, 'Attention Is All You Need');
    assert.strictEqual(res.body.entry.status, 'identified');
    importedEntryId = res.body.entry._id || res.body.entry.id;
    assert.ok(importedEntryId);
  });

  let manualEntryId = '';
  await t.test('5. POST /api/v1/literature creates manual entry with 25+ empirical dimensions', async () => {
    const res = await api('/api/v1/literature', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        projectId: projectAId,
        title: 'Cognitive Architecture and Instructional Design in Generative Tasks',
        authors: ['Sweller, J.', 'Paas, F.'],
        year: '2024',
        journal: 'Educational Psychology Review',
        doi: '10.1007/s10648-023-09801-4',
        studyDesign: 'Randomized Controlled Trial (2x2 factorial)',
        methodology: 'Experimental laboratory study measuring secondary cognitive load during interactive prompting',
        population: 'Undergraduate computer science majors (N = 240)',
        sampleSize: '240',
        samplingMethod: 'Stratified randomized allocation across prior experience tiers',
        measures: ['Subjective Cognitive Load Rating Scale (Paas 1992)', 'Schema Acquisition Assessment (Post-test)'],
        variables: {
          independent: ['Prompt scaffolding (Structured vs. Open-ended)'],
          dependent: ['Germane cognitive load', 'Transfer problem solving accuracy'],
          control: ['Prior programming domain knowledge']
        },
        statisticalMethods: ['Two-way ANOVA', 'Multivariate regression', 'Cohen d effect size estimation'],
        keyFindings: 'Structured scaffolding significantly reduced extraneous cognitive load (F(1, 236) = 14.82, p < .001, eta2 = .06) and yielded higher far-transfer scores.',
        effectEstimates: [
          { metric: 'Cohen d', value: '0.74', ci: '95% CI [0.48, 1.00]', pValue: '< .001' }
        ],
        limitations: 'Single-institution cohort; post-test immediate without longitudinal retention follow-up.',
        futureDirections: 'Evaluate delayed retention effects across semester-long longitudinal interventions.',
        thematicTags: ['Cognitive Load', 'STEM Education', 'Instructional Scaffolding'],
        qualityRating: 5,
        status: 'included',
        extractionStatus: 'completed'
      }
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.entry);
    assert.strictEqual(res.body.entry.sampleSize, '240');
    assert.strictEqual(res.body.entry.status, 'included');
    manualEntryId = res.body.entry._id || res.body.entry.id;
    assert.ok(manualEntryId);
  });

  await t.test('6. GET /api/v1/literature supports search, status filter, and pagination headers', async () => {
    const res = await api(`/api/v1/literature?projectId=${projectAId}&status=included`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.entries));
    assert.strictEqual(res.body.entries.length, 1);
    assert.strictEqual(res.body.entries[0].title, 'Cognitive Architecture and Instructional Design in Generative Tasks');
    assert.ok(res.headers['x-total-count']);
    assert.ok(res.headers['x-page']);

    // Search query test
    const resSearch = await api(`/api/v1/literature?projectId=${projectAId}&search=Attention`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(resSearch.status, 200);
    assert.strictEqual(resSearch.body.entries.length, 1);
    assert.strictEqual(resSearch.body.entries[0].title, 'Attention Is All You Need');
  });

  await t.test('7. GET /api/v1/literature/:id and PATCH /api/v1/literature/:id work correctly', async () => {
    const resGet = await api(`/api/v1/literature/${manualEntryId}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(resGet.status, 200);
    assert.strictEqual(resGet.body.title, 'Cognitive Architecture and Instructional Design in Generative Tasks');

    const resPatch = await api(`/api/v1/literature/${manualEntryId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        status: 'screened',
        qualityRating: 4
      }
    });
    assert.strictEqual(resPatch.status, 200);
    assert.strictEqual(resPatch.body.entry.status, 'screened');
    assert.strictEqual(resPatch.body.entry.qualityRating, 4);
    // Verify persistence
    const resVerify = await api(`/api/v1/literature/${manualEntryId}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(resVerify.body.status, 'screened');
  });

  await t.test('8. AI Structured Evidence Extraction extracts academic dimensions without hallucination', async () => {
    const sampleAbstract = `We conducted a randomized trial with N = 180 graduate nursing students to evaluate the efficacy of high-fidelity simulation. Participants were randomly assigned to simulation (n = 90) or standard clinical practice (n = 90). Outcome measures included critical reasoning scores and task completion speed. ANCOVA revealed statistically significant improvement in reasoning for the simulation group (F(1, 177) = 18.4, p < .001, Cohen's d = 0.65). Key limitations included lack of blinding among clinical raters. Future research should examine retention at 6 months.`;

    const res = await api('/api/v1/literature/extract', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        entryId: importedEntryId,
        sourceText: sampleAbstract,
        metadata: {
          title: 'Attention Is All You Need',
          year: '2017'
        }
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.evidence);
    assert.ok(res.body.evidence.sampleSize.includes('180') || res.body.evidence.sampleSize.includes('N = 180'));
    assert.ok(res.body.evidence.keyFindings);
    assert.ok(res.body.evidence.limitations);
  });

  let matrixId = '';
  await t.test('9. Literature Matrix settings and column configurations CRUD', async () => {
    const resSave = await api('/api/v1/literature/matrix', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        projectId: projectAId,
        title: 'Primary Cognitive Load & AI Literature Matrix',
        columns: [
          { key: 'title', label: 'Study Title', visible: true, order: 0 },
          { key: 'authors', label: 'Authors & Year', visible: true, order: 1 },
          { key: 'studyDesign', label: 'Design', visible: true, order: 2 },
          { key: 'methodology', label: 'Methodology', visible: true, order: 3 },
          { key: 'sampleSize', label: 'Sample (N)', visible: true, order: 4 },
          { key: 'keyFindings', label: 'Empirical Findings', visible: true, order: 5 },
          { key: 'limitations', label: 'Limitations', visible: true, order: 6 }
        ]
      }
    });
    assert.strictEqual(resSave.status, 201);
    assert.strictEqual(resSave.body.success, true);
    assert.ok(resSave.body.matrix);
    matrixId = resSave.body.matrix._id || resSave.body.matrix.id;
    assert.ok(matrixId);

    const resGet = await api(`/api/v1/literature/matrix?projectId=${projectAId}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(resGet.status, 200);
    assert.strictEqual(resGet.body.matrix.title, 'Primary Cognitive Load & AI Literature Matrix');
    assert.strictEqual(resGet.body.matrix.columns.length, 7);
  });

  await t.test('10. Multi-Study Comparison produces side-by-side dimensions and consensus analysis', async () => {
    const res = await api('/api/v1/literature/compare', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        projectId: projectAId,
        entryIds: [importedEntryId, manualEntryId],
        dimensions: ['design', 'methodology', 'sampleSize', 'keyFindings', 'limitations']
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.studies));
    assert.strictEqual(res.body.studies.length, 2);
    assert.ok(res.body.consensusAnalysis);
    assert.ok(res.body.divergenceAnalysis);
  });

  let themeId = '';
  await t.test('11. Thematic Analysis CRUD creates themes and associates entries', async () => {
    const resCreate = await api('/api/v1/literature/themes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        projectId: projectAId,
        name: 'Cognitive Architecture & Working Memory Limits',
        description: 'Studies exploring cognitive load theories and extraneous processing.',
        color: '#6366f1',
        entryIds: [manualEntryId]
      }
    });
    assert.strictEqual(resCreate.status, 201);
    assert.strictEqual(resCreate.body.success, true);
    assert.ok(resCreate.body.theme);
    themeId = resCreate.body.theme._id || resCreate.body.theme.id;
    assert.ok(themeId);

    const resList = await api(`/api/v1/literature/themes?projectId=${projectAId}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(resList.status, 200);
    assert.ok(Array.isArray(resList.body));
    assert.strictEqual(resList.body.length, 1);
    assert.strictEqual(resList.body[0].name, 'Cognitive Architecture & Working Memory Limits');
  });

  await t.test('12. Research Gap Identification produces grounded candidate gaps with research questions', async () => {
    const res = await api('/api/v1/literature/gaps', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        projectId: projectAId,
        entryIds: [importedEntryId, manualEntryId]
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.gaps));
    assert.ok(res.body.gaps.length > 0);
    const gap = res.body.gaps[0];
    assert.ok(gap.title);
    assert.ok(gap.gapType);
    assert.ok(Array.isArray(gap.researchQuestions));
    assert.ok(gap.researchQuestions.length > 0);
  });

  await t.test('13. Evidence-Linked Synthesis produces structured drafts with APA 7 citations', async () => {
    const resThematic = await api('/api/v1/literature/synthesis', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        projectId: projectAId,
        type: 'thematic',
        focusResearchQuestion: 'How does cognitive load affect generative learning in STEM?'
      }
    });
    assert.strictEqual(resThematic.status, 200);
    assert.strictEqual(resThematic.body.success, true);
    assert.ok(resThematic.body.synthesis);
    assert.ok(resThematic.body.synthesis.fullDraft);
    assert.ok(resThematic.body.synthesis.fullDraft.includes('Sweller & Paas (2024)') || resThematic.body.synthesis.fullDraft.includes('(Sweller & Paas, 2024)'));
    assert.strictEqual(resThematic.body.synthesis.type, 'thematic');

    // Also test narrative synthesis
    const resNarrative = await api('/api/v1/literature/synthesis', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        projectId: projectAId,
        type: 'narrative'
      }
    });
    assert.strictEqual(resNarrative.status, 200);
    assert.strictEqual(resNarrative.body.synthesis.type, 'narrative');
  });

  await t.test('14. Backward Compatibility: Existing project literature routes function seamlessly', async () => {
    const resGet = await api(`/api/v1/projects/${projectAId}/literature`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(resGet.status, 200);
    assert.ok(Array.isArray(resGet.body));
    assert.ok(resGet.body.length >= 2);

    const resSynthesize = await api(`/api/v1/projects/${projectAId}/literature/synthesize`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(resSynthesize.status, 200);
    assert.ok(resSynthesize.body.fullDraft);
    assert.ok(resSynthesize.body.studyCount >= 2);
  });

  await t.test('15. Export Operations: Matrix CSV export and BibTeX export', async () => {
    const resCsv = await api(`/api/v1/literature/export?projectId=${projectAId}&format=csv`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(resCsv.status, 200);
    assert.ok(resCsv.headers['content-type'].includes('text/csv'));
    const csvText = resCsv.body.toString ? resCsv.body.toString() : String(resCsv.body);
    assert.ok(csvText.includes('Title,Authors,Year,Journal,DOI'));
    assert.ok(csvText.includes('Attention Is All You Need'));

    const resBib = await api(`/api/v1/literature/export?projectId=${projectAId}&format=bibtex`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(resBib.status, 200);
    const bibText = resBib.body.toString ? resBib.body.toString() : String(resBib.body);
    assert.ok(bibText.includes('@article{') || bibText.includes('@misc{'));
  });

  await t.test('16. Cross-User Security & Tenant Isolation: User B cannot access User A literature', async () => {
    // User B attempts to read User A entry
    const resForbiddenGet = await api(`/api/v1/literature/${manualEntryId}`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert.strictEqual(resForbiddenGet.status, 404);

    // User B attempts to patch User A entry
    const resForbiddenPatch = await api(`/api/v1/literature/${manualEntryId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userBToken}` },
      body: { title: 'Hacked Title By User B' }
    });
    assert.strictEqual(resForbiddenPatch.status, 404);

    // User B attempts to delete User A entry
    const resForbiddenDelete = await api(`/api/v1/literature/${manualEntryId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert.strictEqual(resForbiddenDelete.status, 404);

    // Verify User A entry remained intact
    const resIntact = await api(`/api/v1/literature/${manualEntryId}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(resIntact.status, 200);
    assert.strictEqual(resIntact.body.title, 'Cognitive Architecture and Instructional Design in Generative Tasks');
  });

  await t.test('17. Soft Deletion & Non-Destructive Operations: DELETE hides item from active lists', async () => {
    const resDel = await api(`/api/v1/literature/${importedEntryId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(resDel.status, 200);
    assert.strictEqual(resDel.body.success, true);

    // Check that it no longer appears in normal list
    const resListAfter = await api(`/api/v1/literature?projectId=${projectAId}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(resListAfter.status, 200);
    const found = resListAfter.body.entries.some(e => (e._id === importedEntryId || e.id === importedEntryId));
    assert.strictEqual(found, false);
  });
});
