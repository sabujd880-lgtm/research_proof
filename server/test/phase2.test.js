import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/index.js';
import { auditMeaningPreservation } from '../src/meaningChecker.js';
import { formatApa, formatMla, formatIeee, validateDocumentCitations, normalizeDoi } from '../src/citationService.js';
import { exportDocxFromText, validateDocxMagicBytes } from '../src/docxService.js';

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

test('ResearchProof AI — Phase 2 Academic Tools Comprehensive Suite', async (t) => {

  // Helper for requests
  async function api(path, options = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, headers: res.headers, body };
  }

  // Helper to obtain fresh authenticated user token
  async function createUser(emailPrefix = 'scholar') {
    const email = `${emailPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@institute.ac.uk`;
    const password = 'AcademicPassword123!';
    const regRes = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    return { token: regRes.body.token, user: regRes.body.user, email, password };
  }

  // --- Test 1: Feature Status Endpoint ---
  await t.test('1. Feature availability status (/api/features/status)', async () => {
    const res = await api('/api/features/status');
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.aiAvailable, 'boolean');
    assert.equal(res.body.docxImport, true);
    assert.equal(res.body.docxExport, true);
    assert.equal(res.body.citationsApi, true);
    assert.equal(res.body.meaningChecking, true);
    assert.ok(Array.isArray(res.body.modes), 'Modes should be an array');
    assert.ok(res.body.modes.includes('academic-clarity'));
    assert.ok(res.body.modes.includes('formal-scientific'));
  });

  // --- Test 2: Document Creation & Retrieval ---
  const userA = await createUser('author-a');
  let docId = '';

  await t.test('2. Document creation and retrieval with word and character counting', async () => {
    const text = 'This study examines the neurobiological correlates of working memory in primates.';
    const createRes = await api('/api/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({
        title: 'Working Memory in Primates',
        content: text
      })
    });

    assert.equal(createRes.status, 201, 'Document creation should return 201');
    assert.ok(createRes.body._id || createRes.body.id);
    docId = createRes.body._id || createRes.body.id;
    assert.equal(createRes.body.title, 'Working Memory in Primates');
    assert.equal(createRes.body.content, text);
    assert.equal(createRes.body.wordCount, 11);
    assert.equal(createRes.body.version, 1);

    // Retrieve single document
    const getRes = await api(`/api/documents/${docId}`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.title, 'Working Memory in Primates');
  });

  // --- Test 3: Cross-User Document Access Isolation ---
  const userB = await createUser('author-b');
  await t.test('3. Cross-user document access rejection (user isolation)', async () => {
    // User B tries to read User A's document
    const readRes = await api(`/api/documents/${docId}`, {
      headers: { Authorization: `Bearer ${userB.token}` }
    });
    assert.equal(readRes.status, 404, 'User B should not be able to read User A document');

    // User B tries to update User A's document
    const updateRes = await api(`/api/documents/${docId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userB.token}` },
      body: JSON.stringify({ title: 'Hacked Title' })
    });
    assert.equal(updateRes.status, 404, 'User B should not be able to patch User A document');
  });

  // --- Test 4: Optimistic Concurrency Control ---
  await t.test('4. Optimistic concurrency control (preventing stale overwrites)', async () => {
    // Update version 1 to version 2
    const patchRes = await api(`/api/documents/${docId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({
        content: 'Updated content with twelve words describing cortical activations in spatial tasks.',
        version: 1
      })
    });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.version, 2);

    // Stale update using version 1 should be rejected with 409 Conflict
    const staleRes = await api(`/api/documents/${docId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({
        content: 'Stale tab content overwriting newer revision.',
        version: 1
      })
    });
    assert.equal(staleRes.status, 409, 'Stale version update should return 409 Conflict');
    assert.equal(staleRes.body.code, 'CONCURRENT_EDIT_CONFLICT');
  });

  // --- Test 5: Meaning-Preservation Engine (Unit & Deterministic Checks) ---
  await t.test('5. Meaning-preservation engine detects finding reversals and statistical alterations', async () => {
    // 5a. Negation reversal (Critical finding inversion)
    const origFinding = 'The experimental treatment did not demonstrate a statistically significant reduction in symptoms.';
    const invertedFinding = 'The experimental treatment demonstrated a statistically significant reduction in symptoms.';
    const negationWarnings = auditMeaningPreservation(origFinding, invertedFinding);

    assert.ok(negationWarnings.length > 0, 'Should generate meaning warning for negation reversal');
    const criticalWarn = negationWarnings.find(w => w.category === 'negation' && w.severity === 'critical');
    assert.ok(criticalWarn, 'Should flag negation removal as critical finding reversal');

    // 5b. Statistical value modification (p-value and sample size)
    const origStats = 'We evaluated n = 150 patients (p < 0.01, 95% CI [1.4, 3.2]).';
    const tamperedStats = 'We evaluated n = 300 patients (p < 0.05, 95% CI [2.0, 4.0]).';
    const statWarnings = auditMeaningPreservation(origStats, tamperedStats);
    assert.ok(statWarnings.some(w => w.category === 'statistic' && w.detail.includes('p < 0.01')));
    assert.ok(statWarnings.some(w => w.category === 'statistic' && w.detail.includes('n = 150')));

    // 5c. Citation marker removal
    const origCite = 'Prior models [1, 2] assumed static equilibrium (Smith et al., 2019).';
    const alteredCite = 'Prior models assumed static equilibrium.';
    const citeWarnings = auditMeaningPreservation(origCite, alteredCite);
    assert.ok(citeWarnings.some(w => w.category === 'citation'));
  });

  // --- Test 6: Revision Acceptance and Document Auto-Update ---
  // --- Test 6: Revision Acceptance and Document Auto-Update ---
  await t.test('6. Revision accept, reject, and restore lifecycle updates document content', async () => {
    // 6a. Verify 503 AI unavailable when AI API key is unconfigured
    const origKey = process.env.AI_API_KEY;
    const origReverse = process.env.REVERSEGPT_API_KEY;
    const origGemini = process.env.GEMINI_API_KEY;
    delete process.env.AI_API_KEY;
    delete process.env.REVERSEGPT_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const unavailRes = await api('/api/revisions/rewrite', {
        method: 'POST',
        headers: { Authorization: `Bearer ${userA.token}` },
        body: JSON.stringify({
          text: 'Sample text to rewrite',
          documentId: docId
        })
      });
      assert.equal(unavailRes.status, 503, 'Must return 503 when AI provider is unconfigured');
    } finally {
      if (origKey) process.env.AI_API_KEY = origKey;
      if (origReverse) process.env.REVERSEGPT_API_KEY = origReverse;
      if (origGemini) process.env.GEMINI_API_KEY = origGemini;
    }

    // 6b. Directly create a proposed revision to test accept lifecycle
    const revId = 'rev-' + Date.now();
    const revisedContent = 'Refined hypothesis examining activity-dependent synaptic plasticity.';
    app.locals.memRevisions.set(revId, {
      _id: revId,
      id: revId,
      userId: userA.user.id || userA.user._id,
      documentId: docId,
      mode: 'academic-clarity',
      originalText: 'Initial unedited hypothesis regarding synaptic plasticity.',
      revisedText: revisedContent,
      proposedText: revisedContent,
      summary: 'Enhanced technical precision.',
      status: 'proposed',
      createdAt: new Date().toISOString()
    });

    // Accept revision
    const acceptRes = await api(`/api/revisions/${revId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert.equal(acceptRes.status, 200, 'Accepting revision should return 200 OK');
    assert.equal(acceptRes.body.revision.status, 'accepted');
    assert.equal(acceptRes.body.document.content, revisedContent, 'Document content should update to accepted revision text');

    // 6c. Reject revision test
    const rejectRevId = 'rev-reject-' + Date.now();
    app.locals.memRevisions.set(rejectRevId, {
      _id: rejectRevId,
      id: rejectRevId,
      userId: userA.user.id || userA.user._id,
      documentId: docId,
      mode: 'formal-scientific',
      originalText: revisedContent,
      revisedText: 'An informal casual sentence.',
      proposedText: 'An informal casual sentence.',
      status: 'proposed',
      createdAt: new Date().toISOString()
    });

    const rejectRes = await api(`/api/revisions/${rejectRevId}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert.equal(rejectRes.status, 200);
    assert.equal(rejectRes.body.revision.status, 'rejected');

    // 6d. Restore previous version test
    const restoreRes = await api(`/api/documents/${docId}/restore`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ revisionId: revId })
    });
    assert.equal(restoreRes.status, 200, 'Restoring revision should succeed');
    assert.equal(restoreRes.body.document.content, revisedContent);
    assert.equal(restoreRes.body.revision.status, 'restored');
  });

  // --- Test 7: Citation Assistant — DOI Metadata Lookup ---
  await t.test('7. DOI normalization and validation', async () => {
    assert.equal(normalizeDoi('https://doi.org/10.1038/s41586-020-2649-2'), '10.1038/s41586-020-2649-2');
    assert.equal(normalizeDoi('doi: 10.1126/science.1249098'), '10.1126/science.1249098');

    // Invalid DOI lookup returns 400
    const invalidRes = await api('/api/citations/lookup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({ doi: 'invalid-doi-format' })
    });
    assert.equal(invalidRes.status, 400);
  });

  // --- Test 8: Citation Formatting (APA 7th, MLA 9th, IEEE) ---
  await t.test('8. Citation formatting across APA, MLA, and IEEE standards', async () => {
    const fixture = {
      title: 'Attention Is All You Need',
      authors: [
        { given: 'Ashish', family: 'Vaswani', name: 'Vaswani, Ashish' },
        { given: 'Noam', family: 'Shazeer', name: 'Shazeer, Noam' }
      ],
      year: '2017',
      journal: 'Advances in Neural Information Processing Systems',
      volume: '30',
      pages: '5998-6008',
      doi: '10.48550/arXiv.1706.03762'
    };

    const apa = formatApa(fixture);
    assert.ok(apa.includes('Vaswani, A., & Shazeer, N.'), 'APA should format authors with initials and ampersand');
    assert.ok(apa.includes('(2017)'), 'APA should place year in parentheses');
    assert.ok(apa.includes('https://doi.org/10.48550/arXiv.1706.03762'));

    const mla = formatMla(fixture);
    assert.ok(mla.includes('Vaswani, Ashish, and Noam Shazeer'), 'MLA should format two authors with "and"');
    assert.ok(mla.includes('"Attention Is All You Need."'), 'MLA should quote article titles');

    const ieee = formatIeee(fixture, 1);
    assert.ok(ieee.startsWith('[1] A. Vaswani and N. Shazeer'), 'IEEE should start with bracketed index');
  });

  // --- Test 9: Citation Integrity Analysis ---
  await t.test('9. Citation integrity detection (missing and uncited references)', async () => {
    const manuscript = 'Deep neural architectures have evolved rapidly (Vaswani et al., 2017). Furthermore, recent findings suggest emergent capabilities in larger parameter regimes (10.1038/s41586-020-2649-2).';
    
    const library = [
      {
        id: 'c1',
        title: 'Attention Is All You Need',
        authors: [{ family: 'Vaswani', given: 'Ashish' }],
        year: '2017',
        doi: '10.48550/arxiv.1706.03762'
      },
      {
        id: 'c2',
        title: 'Uncited Paper on Quantum Computing',
        authors: [{ family: 'Turing', given: 'Alan' }],
        year: '1936',
        doi: '10.1112/plms/s2-42.1.230'
      }
    ];

    const report = validateDocumentCitations(manuscript, library);
    assert.ok(report.uncitedReferences.some(r => r.title.includes('Uncited Paper')), 'Should detect uncited library reference');
    assert.ok(report.missingCitations.some(m => m.marker.includes('10.1038/s41586-020-2649-2')), 'Should detect missing reference for cited DOI');
  });

  // --- Test 10: Citation CRUD in API ---
  let citationId = '';
  await t.test('10. User citation library CRUD operations', async () => {
    // Add reference
    const addRes = await api('/api/citations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: JSON.stringify({
        title: 'Deep Residual Learning for Image Recognition',
        doi: '10.1109/CVPR.2016.90',
        authors: [{ given: 'Kaiming', family: 'He', name: 'He, Kaiming' }],
        year: '2016',
        journal: 'IEEE Conference on Computer Vision and Pattern Recognition'
      })
    });
    assert.equal(addRes.status, 201);
    citationId = addRes.body._id || addRes.body.id;

    // List references
    const listRes = await api('/api/citations', {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert.equal(listRes.status, 200);
    assert.ok(Array.isArray(listRes.body));
    assert.ok(listRes.body.some(c => c.title.includes('Residual Learning')));

    // Cross-user citation check: User B should not see User A's citations
    const listB = await api('/api/citations', {
      headers: { Authorization: `Bearer ${userB.token}` }
    });
    assert.equal(listB.body.length, 0, 'User B citation library must be isolated');
  });

  // --- Test 11: DOCX Generation & Export ---
  await t.test('11. DOCX generation produces valid Office Open XML buffers', async () => {
    const buffer = await exportDocxFromText({
      title: 'Neural Networks in Academic Writing',
      content: 'Abstract\nThis paper discusses automated scientific editing.\n\nMethods\nWe tested 50 academic manuscripts.',
      references: ['Vaswani, A. (2017). Attention is all you need.']
    });

    assert.ok(Buffer.isBuffer(buffer), 'Output must be a Node.js Buffer');
    assert.ok(buffer.length > 500, 'Buffer should contain valid docx archive size');
    assert.ok(validateDocxMagicBytes(buffer), 'Must match PK ZIP magic bytes for Office Open XML');

    // Test GET /documents/:id/export-docx
    const exportRes = await fetch(`${baseUrl}/api/documents/${docId}/export-docx`, {
      headers: { Authorization: `Bearer ${userA.token}` }
    });
    assert.equal(exportRes.status, 200);
    assert.equal(exportRes.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    const docxBuf = Buffer.from(await exportRes.arrayBuffer());
    assert.ok(validateDocxMagicBytes(docxBuf));
  });

  // --- Test 12: DOCX Import Validation ---
  await t.test('12. DOCX import rejects corrupt non-ZIP payloads', async () => {
    const corruptBuffer = Buffer.from('This is a plain text file pretending to be a docx');
    const formData = new FormData();
    const blob = new Blob([corruptBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    formData.append('file', blob, 'corrupt.docx');

    const importRes = await fetch(`${baseUrl}/api/documents/import-docx`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userA.token}` },
      body: formData
    });

    const resJson = await importRes.json().catch(() => ({}));
    assert.equal(importRes.status, 400, 'Non-zip corrupted docx upload should be rejected with 400');
    assert.match(resJson.error, /magic bytes|format/i);
  });

});
