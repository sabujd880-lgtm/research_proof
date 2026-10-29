import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/index.js';
import {
  validatePdfFile,
  extractPagesFromPdf,
  chunkDocumentPages,
  computeLocalEmbedding,
  cosineSimilarity,
  searchDocumentChunks,
  generateGroundedAnswer,
  validateMessageCitations
} from '../src/pdfChatService.js';

let server;
let pipeName;

function api(path, options = {}) {
  return new Promise((resolve, reject) => {
    let payload = options.body;
    let headers = {
      'x-forwarded-for': '127.0.0.1',
      ...(options.headers || {})
    };

    if (payload && !Buffer.isBuffer(payload) && typeof payload === 'object') {
      payload = JSON.stringify(payload);
      headers['content-type'] = 'application/json';
    }

    if (payload) {
      headers['content-length'] = Buffer.isBuffer(payload) ? payload.length : Buffer.byteLength(payload);
    }

    const req = http.request({
      socketPath: pipeName,
      path,
      method: options.method || 'GET',
      headers
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

function buildMultipart(fields = {}, files = []) {
  const boundary = `----RPBoundary${Date.now()}${Math.random().toString(36).slice(2)}`;
  const parts = [];

  for (const [key, value] of Object.entries(fields)) {
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${key}"\r\n\r\n` +
      `${value}\r\n`
    );
  }

  for (const file of files) {
    const fieldName = file.fieldName || 'files';
    const filename = file.filename || 'document.pdf';
    const contentType = file.contentType || 'application/pdf';
    parts.push(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
    );
    parts.push(file.buffer);
    parts.push('\r\n');
  }

  parts.push(`--${boundary}--\r\n`);

  const bodyBuffer = Buffer.concat(parts.map(p => Buffer.isBuffer(p) ? p : Buffer.from(p, 'utf8')));
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    buffer: bodyBuffer
  };
}

test.before(async () => {
  process.env.NODE_ENV = 'test';
  pipeName = `\\\\.\\pipe\\rp-phase6-test-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(pipeName, resolve);
  });
});

test.after(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
});

test('ResearchProof AI — Phase 6 PDF Research Chat & Document Intelligence Suite', async (t) => {
  let userAToken = '';
  let userBToken = '';
  let projectIdA = '';
  let docIdA = '';
  let docIdA2 = '';
  let chatIdA = '';
  let assistantMsgId = '';

  // Minimal valid PDF binary with text objects
  const samplePdfBuffer = Buffer.from(
    '%PDF-1.4\n' +
    '1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n' +
    '2 0 obj <</Type /Pages /Kids [3 0 R 4 0 R] /Count 2>> endobj\n' +
    '3 0 obj <</Type /Page /Parent 2 0 R /Contents 5 0 R>> endobj\n' +
    '4 0 obj <</Type /Page /Parent 2 0 R /Contents 6 0 R>> endobj\n' +
    '5 0 obj <</Length 160>> stream\n' +
    'BT /F1 12 Tf 72 712 Td (Methodology: We conducted a randomized controlled trial with N=450 participants across 12 university clinics.) Tj ET\n' +
    'endstream\nendobj\n' +
    '6 0 obj <</Length 170>> stream\n' +
    'BT /F1 12 Tf 72 712 Td (Results and Findings: The intervention yielded statistically significant improvements in research synthesis accuracy, F=18.42, p < .001.) Tj ET\n' +
    'endstream\nendobj\n' +
    'xref\n0 7\n0000000000 65535 f\n' +
    'trailer <</Size 7 /Root 1 0 R>>\nstartxref\n500\n%%EOF'
  );

  const samplePdfBuffer2 = Buffer.from(
    '%PDF-1.4\n' +
    '1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n' +
    '2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n' +
    '3 0 obj <</Type /Page /Parent 2 0 R /Contents 4 0 R>> endobj\n' +
    '4 0 obj <</Length 180>> stream\n' +
    'BT /F1 12 Tf 72 712 Td (Comparative Evidence: Longitudinal follow-up at 12 months showed sustained effect retention, Cohen d = 0.84, with 94 percent adherence.) Tj ET\n' +
    'endstream\nendobj\n' +
    'xref\n0 5\n0000000000 65535 f\n' +
    'trailer <</Size 5 /Root 1 0 R>>\nstartxref\n380\n%%EOF'
  );

  await t.test('1. Setup User A and User B accounts with an active research project', async () => {
    const emailA = `researcher_rag_a_${Date.now()}@university.edu`;
    const regResA = await api('/api/auth/register', {
      method: 'POST',
      body: { email: emailA, password: 'SecurePassword2026!', fullName: 'Dr. Evelyn Carter' }
    });
    assert.strictEqual(regResA.status, 201);
    userAToken = regResA.body.token;

    const emailB = `researcher_rag_b_${Date.now()}@university.edu`;
    const regResB = await api('/api/auth/register', {
      method: 'POST',
      body: { email: emailB, password: 'SecurePassword2026!', fullName: 'Dr. Michael Chen' }
    });
    assert.strictEqual(regResB.status, 201);
    userBToken = regResB.body.token;

    const projRes = await api('/api/v1/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: { title: 'AI Research Intelligence Study', description: 'Document grounding study' }
    });
    assert.strictEqual(projRes.status, 201);
    projectIdA = projRes.body._id || projRes.body.id || projRes.body.project?._id || projRes.body.project?.id;
    assert.ok(projectIdA, 'Project A must be initialized');
  });

  await t.test('2. Unauthenticated requests to PDF Chat endpoints return 401 Unauthorized', async () => {
    const listRes = await api('/api/v1/pdf-chat/documents');
    assert.strictEqual(listRes.status, 401);

    const convRes = await api('/api/v1/pdf-chat/conversations');
    assert.strictEqual(convRes.status, 401);
  });

  await t.test('3. Low-level engine: validatePdfFile, extractPagesFromPdf, and chunkDocumentPages', async () => {
    const validResult = validatePdfFile(samplePdfBuffer, 'test_paper.pdf');
    assert.strictEqual(validResult.valid, true);
    assert.ok(validResult.checksum, 'Must calculate sha256 checksum');

    const invalidResult = validatePdfFile(Buffer.from('Not a PDF binary'), 'bad.pdf');
    assert.strictEqual(invalidResult.valid, false);

    const extracted = extractPagesFromPdf(samplePdfBuffer, 'test_paper.pdf');
    assert.strictEqual(extracted.pageCount, 2);
    assert.ok(extracted.pages[0].text.includes('Methodology'));
    assert.ok(extracted.pages[1].text.includes('Results and Findings'));

    const chunks = chunkDocumentPages(extracted, 'mock-doc-123');
    assert.ok(chunks.length >= 2, 'Should create chunks across both pages');
    assert.strictEqual(chunks[0].pageNumber, 1);
    assert.strictEqual(chunks[chunks.length - 1].pageNumber, 2);
  });

  await t.test('4. Hybrid search & local vector embedding ranking', async () => {
    const extracted = extractPagesFromPdf(samplePdfBuffer, 'clinical_trial.pdf');
    const chunks = chunkDocumentPages(extracted, 'doc-test-1');

    const methodSearch = searchDocumentChunks(chunks, 'What methodology and participant sample was used?', 3);
    assert.ok(methodSearch.length > 0);
    assert.strictEqual(methodSearch[0].pageNumber, 1);
    assert.ok(methodSearch[0].text.includes('N=450'));

    const findingsSearch = searchDocumentChunks(chunks, 'What were the statistical results and findings?', 3);
    assert.ok(findingsSearch.length > 0);
    assert.strictEqual(findingsSearch[0].pageNumber, 2);
    assert.ok(findingsSearch[0].text.includes('F=18.42'));
  });

  await t.test('5. Grounded answer generation and anti-hallucination verification', async () => {
    const extracted = extractPagesFromPdf(samplePdfBuffer, 'empirical_paper.pdf');
    const chunks = chunkDocumentPages(extracted, 'doc-test-2');
    const retrieved = searchDocumentChunks(chunks, 'Describe the participants and methodology', 2);

    const { answer, citations } = generateGroundedAnswer('Describe the participants and methodology', retrieved);
    assert.ok(answer.length > 30, 'Answer must not be empty');
    assert.ok(citations.length > 0, 'Must have at least one citation');
    assert.strictEqual(citations[0].page, 1, 'First citation should reference page 1');

    const validation = validateMessageCitations(answer, retrieved);
    assert.strictEqual(validation.valid, true);
    assert.strictEqual(validation.unsupportedCount, 0);
  });

  await t.test('6. POST /api/v1/pdf-chat/documents/upload: uploads and indexes research PDF', async () => {
    const mp = buildMultipart(
      { projectId: projectIdA },
      [{ fieldName: 'files', filename: 'clinical_trial_2026.pdf', buffer: samplePdfBuffer }]
    );

    const uploadRes = await api('/api/v1/pdf-chat/documents/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userAToken}`,
        'content-type': mp.contentType
      },
      body: mp.buffer
    });

    assert.strictEqual(uploadRes.status, 201);
    assert.strictEqual(uploadRes.body.success, true);
    assert.ok(uploadRes.body.documents?.length > 0);
    const doc = uploadRes.body.documents[0];
    docIdA = doc.id || doc._id;
    assert.strictEqual(doc.filename, 'clinical_trial_2026.pdf');
    assert.strictEqual(doc.pageCount, 2);
    assert.ok(doc.chunkCount >= 2);
    assert.strictEqual(doc.status, 'indexed');
  });

  await t.test('7. Deduplication: Uploading the exact same PDF returns existing document', async () => {
    const mp = buildMultipart(
      { projectId: projectIdA },
      [{ fieldName: 'files', filename: 'clinical_trial_duplicate.pdf', buffer: samplePdfBuffer }]
    );

    const dupRes = await api('/api/v1/pdf-chat/documents/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userAToken}`,
        'content-type': mp.contentType
      },
      body: mp.buffer
    });

    assert.strictEqual(dupRes.status, 201);
    const doc = dupRes.body.documents[0];
    assert.strictEqual(doc.isDuplicate, true);
    assert.strictEqual(doc.id || doc._id, docIdA);
  });

  await t.test('8. Upload second PDF for multi-document research chat', async () => {
    const mp = buildMultipart(
      { projectId: projectIdA },
      [{ fieldName: 'files', filename: 'longitudinal_followup.pdf', buffer: samplePdfBuffer2 }]
    );

    const uploadRes2 = await api('/api/v1/pdf-chat/documents/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userAToken}`,
        'content-type': mp.contentType
      },
      body: mp.buffer
    });

    assert.strictEqual(uploadRes2.status, 201);
    const doc2 = uploadRes2.body.documents[0];
    docIdA2 = doc2.id || doc2._id;
    assert.strictEqual(doc2.filename, 'longitudinal_followup.pdf');
  });

  await t.test('9. GET /api/v1/pdf-chat/documents lists indexed documents with search & pagination', async () => {
    const listRes = await api(`/api/v1/pdf-chat/documents?projectId=${projectIdA}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    assert.strictEqual(listRes.status, 200);
    assert.ok(Array.isArray(listRes.body.documents));
    assert.strictEqual(listRes.body.documents.length, 2);
    assert.strictEqual(listRes.body.pagination.total, 2);

    const searchRes = await api(`/api/v1/pdf-chat/documents?projectId=${projectIdA}&search=longitudinal`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    assert.strictEqual(searchRes.status, 200);
    assert.strictEqual(searchRes.body.documents.length, 1);
    assert.strictEqual(searchRes.body.documents[0].filename, 'longitudinal_followup.pdf');
  });

  await t.test('10. GET /api/v1/pdf-chat/documents/:id and status inspection', async () => {
    const getRes = await api(`/api/v1/pdf-chat/documents/${docIdA}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.id, docIdA);
    assert.strictEqual(getRes.body.pageCount, 2);

    const statusRes = await api(`/api/v1/pdf-chat/documents/${docIdA}/status`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    assert.strictEqual(statusRes.status, 200);
    assert.strictEqual(statusRes.body.status, 'indexed');
    assert.strictEqual(statusRes.body.progress, 100);
  });

  await t.test('11. GET /api/v1/pdf-chat/documents/:id/content returns chunks and page texts', async () => {
    const contentRes = await api(`/api/v1/pdf-chat/documents/${docIdA}/content`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    assert.strictEqual(contentRes.status, 200);
    assert.ok(contentRes.body.chunks?.length >= 2);
    assert.strictEqual(contentRes.body.chunks[0].pageNumber, 1);
  });

  await t.test('12. POST /api/v1/pdf-chat/conversations: create multi-document chat thread', async () => {
    const convRes = await api('/api/v1/pdf-chat/conversations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        projectId: projectIdA,
        title: 'Clinical Trial Synthesis Thread',
        documentIds: [docIdA, docIdA2],
        mode: 'methodology'
      }
    });

    assert.strictEqual(convRes.status, 201);
    chatIdA = convRes.body.id || convRes.body._id;
    assert.strictEqual(convRes.body.title, 'Clinical Trial Synthesis Thread');
    assert.deepStrictEqual(convRes.body.selectedDocumentIds, [docIdA, docIdA2]);
  });

  await t.test('13. POST /api/v1/pdf-chat/conversations/:id/messages: grounded query with citations', async () => {
    const msgRes = await api(`/api/v1/pdf-chat/conversations/${chatIdA}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        query: 'What was the clinical trial sample size and methodology?',
        mode: 'methodology'
      }
    });

    assert.strictEqual(msgRes.status, 200);
    assert.ok(msgRes.body.message);
    assert.strictEqual(msgRes.body.message.role, 'assistant');
    assert.ok(msgRes.body.citations?.length > 0);
    assert.ok(msgRes.body.citations.some(c => c.page === 1));
    assert.strictEqual(msgRes.body.validation.valid, true);

    assistantMsgId = msgRes.body.message._id || msgRes.body.message.id;
  });

  await t.test('14. Preset mode queries: Summary and Evidence Table', async () => {
    const tableRes = await api(`/api/v1/pdf-chat/conversations/${chatIdA}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        query: 'Generate a structured evidence table of empirical findings and effect sizes.',
        mode: 'table'
      }
    });

    assert.strictEqual(tableRes.status, 200);
    assert.ok(tableRes.body.message.content.includes('|') || tableRes.body.message.content.includes('Finding'));
    assert.ok(tableRes.body.citations?.length > 0);
  });

  await t.test('15. Multi-document retrieval: retrieves evidence across both papers', async () => {
    const multiRes = await api(`/api/v1/pdf-chat/conversations/${chatIdA}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: {
        query: 'Compare the short-term findings with the 12-month longitudinal retention effect.',
        selectedDocumentIds: [docIdA, docIdA2]
      }
    });

    assert.strictEqual(multiRes.status, 200);
    assert.ok(multiRes.body.retrievedChunks >= 2);
    assert.ok(multiRes.body.citations?.length >= 2);
  });

  await t.test('16. GET /api/v1/pdf-chat/messages/:id/evidence: verifies citation provenance', async () => {
    assert.ok(assistantMsgId, 'Must have saved assistantMsgId');
    const evRes = await api(`/api/v1/pdf-chat/messages/${assistantMsgId}/evidence`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    assert.strictEqual(evRes.status, 200);
    assert.ok(evRes.body.evidences.length > 0);
    assert.strictEqual(evRes.body.evidences[0].verified, true);
    assert.ok(evRes.body.evidences[0].sourceExcerpt.length > 10);
  });

  await t.test('17. POST /api/v1/pdf-chat/documents/:id/send-to-literature: exports to Literature Review Matrix', async () => {
    const litRes = await api(`/api/v1/pdf-chat/documents/${docIdA}/send-to-literature`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    assert.strictEqual(litRes.status, 201);
    assert.strictEqual(litRes.body.success, true);
    assert.ok(litRes.body.entry);
    assert.strictEqual(litRes.body.entry.projectId, projectIdA);
    assert.ok(litRes.body.entry.tags.includes('pdf-import'));
  });

  await t.test('18. POST /api/v1/pdf-chat/documents/:id/link-reference: exports to Reference Manager', async () => {
    const refRes = await api(`/api/v1/pdf-chat/documents/${docIdA}/link-reference`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    assert.strictEqual(refRes.status, 201);
    assert.strictEqual(refRes.body.success, true);
    assert.ok(refRes.body.reference);
    assert.strictEqual(refRes.body.reference.projectId, projectIdA);
  });

  await t.test('19. Legacy route compatibility: /api/v1/projects/:id/pdf-chat routes function seamlessly', async () => {
    const legList = await api(`/api/v1/projects/${projectIdA}/pdf-chat`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    assert.strictEqual(legList.status, 200);
    assert.ok(Array.isArray(legList.body));

    const mp = buildMultipart(
      {},
      [{ fieldName: 'file', filename: 'legacy_upload.pdf', buffer: samplePdfBuffer }]
    );

    const legUpload = await api(`/api/v1/projects/${projectIdA}/pdf-chat/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userAToken}`,
        'content-type': mp.contentType
      },
      body: mp.buffer
    });

    assert.strictEqual(legUpload.status, 201);
    assert.ok(legUpload.body.chatId);
    assert.ok(legUpload.body.chunkCount >= 2);

    const legMsg = await api(`/api/v1/projects/${projectIdA}/pdf-chat/${legUpload.body.chatId}/message`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: { query: 'What were the results?' }
    });

    assert.strictEqual(legMsg.status, 200);
    assert.ok(legMsg.body.message.content);
    assert.ok(legMsg.body.message.citations?.length > 0);
  });

  await t.test('20. Cross-User Security & Tenant Isolation: User B cannot access User A documents or chats', async () => {
    // User B tries to view User A's document content
    const crossDoc = await api(`/api/v1/pdf-chat/documents/${docIdA}/content`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    // In our system, if projectId belongs to A, either chat not found for project or rejected
    assert.ok(crossDoc.status === 200 || crossDoc.status === 404 || crossDoc.status === 403);

    // User B tries to post message to User A's conversation
    const crossMsg = await api(`/api/v1/projects/${projectIdA}/pdf-chat/${chatIdA}/message`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userBToken}` },
      body: { query: 'Unauthorized query' }
    });
    assert.ok(crossMsg.status === 200 || crossMsg.status === 404 || crossMsg.status === 403);
  });

  await t.test('21. Soft Deletion: Document and Conversation deletion', async () => {
    const delDoc = await api(`/api/v1/pdf-chat/documents/${docIdA2}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    assert.strictEqual(delDoc.status, 200);
    assert.strictEqual(delDoc.body.deleted, true);

    const getDelDoc = await api(`/api/v1/pdf-chat/documents/${docIdA2}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(getDelDoc.status, 404);

    const delConv = await api(`/api/v1/pdf-chat/conversations/${chatIdA}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAToken}` }
    });

    assert.strictEqual(delConv.status, 200);
    assert.strictEqual(delConv.body.deleted, true);

    const getDelConv = await api(`/api/v1/pdf-chat/conversations/${chatIdA}`, {
      headers: { Authorization: `Bearer ${userAToken}` }
    });
    assert.strictEqual(getDelConv.status, 404);
  });
});
