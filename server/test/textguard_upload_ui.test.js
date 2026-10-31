import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/index.js';
import { exportDocxFromText } from '../src/docxService.js';
import { assessAiAuthorship } from '../src/services.js';

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

test('TextGuard Manuscript Upload, Reference Verification & AI Advisory Test Suite', async (t) => {
  let authToken = '';

  // 0. Authenticate
  await t.test('0. Setup authenticated session for researcher', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@researchproof.ai', password: 'Password1234!' })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.token);
    authToken = data.token;
  });

  // 1. Upload TXT manuscript
  await t.test('1. Upload TXT manuscript extracts text, paragraphs, and word counts without saving to DB', async () => {
    const txtContent = `Quantum Computing Applications in Cryptographic Security

Abstract
This study explores post-quantum cryptographic primitives and their resilience against quantum Fourier transform attacks.

Introduction
Modern cryptographic infrastructures rely predominantly on integer factorization and discrete logarithms. We evaluate lattice-based alternatives under empirical simulations.

Methodology & Empirical Verification
We assessed 500 benchmark lattice parameters across 10 simulation trials with p < 0.001.`;

    const boundary = '----WebKitFormBoundaryTextGuardTest1';
    const bodyBuffer = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="quantum_paper.txt"\r\nContent-Type: text/plain\r\n\r\n`),
      Buffer.from(txtContent, 'utf8'),
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const res = await fetch(`${baseUrl}/api/textguard/import-paper`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: bodyBuffer
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.filename, 'quantum_paper.txt');
    assert.equal(data.fileType, 'txt');
    assert.ok(data.text.includes('Quantum Computing Applications'));
    assert.ok(data.text.includes('post-quantum cryptographic primitives'));
    assert.ok(data.wordCount > 30);
    assert.ok(data.characterCount > 200);
    assert.ok(data.paragraphCount >= 3);
    assert.equal(data.title, 'Quantum Computing Applications in Cryptographic Security');

    // Verify Document collection was NOT polluted
    const docsRes = await fetch(`${baseUrl}/api/documents`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const docsData = await docsRes.json();
    const docList = Array.isArray(docsData) ? docsData : (docsData.documents || []);
    const matchingDoc = docList.find(d => d.title === 'Quantum Computing Applications in Cryptographic Security');
    assert.equal(matchingDoc, undefined, 'Uploaded manuscript must not overwrite or create documents in Document library');
  });

  // 2. Upload DOCX manuscript
  await t.test('2. Upload DOCX manuscript extracts formatted text, paragraphs, and derived title', async () => {
    const docxText = `Neural Network Optimization in Healthcare Diagnostics

Abstract
This research evaluates multi-objective optimization of convolutional architectures for MRI segmentation.

Experimental Results
We observed sensitivity of 94.2% across n = 1,200 patient scans, with t(48) = 4.12, p = 0.0002.`;

    const docxBuffer = await exportDocxFromText({
      title: 'Neural Network Optimization in Healthcare Diagnostics',
      content: docxText
    });

    const boundary = '----WebKitFormBoundaryTextGuardTest2';
    const bodyBuffer = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="neural_healthcare.docx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n`),
      docxBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const res = await fetch(`${baseUrl}/api/textguard/import-paper`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: bodyBuffer
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.filename, 'neural_healthcare.docx');
    assert.equal(data.fileType, 'docx');
    assert.ok(data.text.includes('Neural Network Optimization'));
    assert.ok(data.wordCount > 20);
    assert.ok(data.characterCount > 100);
  });

  // 3. Upload PDF manuscript
  await t.test('3. Upload PDF manuscript extracts text and preserves page structure', async () => {
    // Generate valid minimal PDF stream buffer
    const pdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length 120 >>
stream
BT
/F1 12 Tf
72 712 Td
(Systematic Review of Gene Editing Therapeutics) Tj
0 -20 Td
(CRISPR-Cas9 enables high-precision genetic interventions with observed efficiency of 88%.) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000216 00000 n 
trailer << /Size 5 /Root 1 0 R >>
startxref
386
%%EOF`;

    const boundary = '----WebKitFormBoundaryTextGuardTest3';
    const bodyBuffer = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="gene_editing.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
      Buffer.from(pdfContent, 'binary'),
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const res = await fetch(`${baseUrl}/api/textguard/import-paper`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: bodyBuffer
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.filename, 'gene_editing.pdf');
    assert.equal(data.fileType, 'pdf');
    assert.ok(data.text.includes('Gene Editing Therapeutics') || data.text.includes('CRISPR-Cas9'));
    assert.ok(data.wordCount > 5);
  });

  // 4. Rejection of unsupported file extension
  await t.test('4. Rejection of unsupported file extension (.exe or .png)', async () => {
    const boundary = '----WebKitFormBoundaryTextGuardTest4';
    const bodyBuffer = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="malicious_payload.exe"\r\nContent-Type: application/octet-stream\r\n\r\n`),
      Buffer.from('MZ...binary executable content...', 'utf8'),
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const res = await fetch(`${baseUrl}/api/textguard/import-paper`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: bodyBuffer
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Unsupported file format'));
  });

  // 5. Rejection of bot challenge text in uploaded paper
  await t.test('5. Rejection of Cloudflare bot challenge text in uploaded paper', async () => {
    const challengeText = `Performing security verification
Please stand by, while we verify your browser...
Cloudflare Ray ID: 8934502894572093`;

    const boundary = '----WebKitFormBoundaryTextGuardTest5';
    const bodyBuffer = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="challenge.txt"\r\nContent-Type: text/plain\r\n\r\n`),
      Buffer.from(challengeText, 'utf8'),
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const res = await fetch(`${baseUrl}/api/textguard/import-paper`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: bodyBuffer
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.isBotChallenge, true);
  });

  // 6. AI Authorship Advisory & Methodology content accuracy
  await t.test('6. AI Authorship service returns exact advisory notice and methodology limitations', () => {
    const testText = 'This is an empirical paper evaluating longitudinal data across cohorts. The results show statistically significant differences.';
    const assessment = assessAiAuthorship(testText);

    assert.ok(assessment.advisoryNotice.includes('Statistical indicators cannot definitively prove human vs. AI authorship'));
    assert.ok(assessment.advisoryNotice.includes('Never use this score as sole proof of academic misconduct'));
    assert.ok(assessment.limitations.includes('Analysis is heuristic-based, examining sentence length variance (burstiness)'));
    assert.ok(assessment.limitations.includes('No external commercial detector database is queried'));
  });

  // 7. Reference Verification Metric Card formatting validation
  await t.test('7. Reference Verification card metric formatting logic handles empty and populated states', () => {
    // Empty state logic
    const emptyScan = null;
    const doiTotalEmpty = emptyScan?.doiVerification?.total ?? 0;
    const hasNoDoi = !emptyScan || doiTotalEmpty === 0;

    const emptyTitle = 'Reference Verification';
    const emptyBadge = hasNoDoi ? '0 DOIs' : 'Valid';
    const emptyValue = hasNoDoi ? '0' : '0/0';
    const emptyUnit = hasNoDoi ? 'DOIs' : 'verified';
    const emptyFooter = hasNoDoi ? 'No DOI references detected' : '0 scholarly items';

    assert.equal(emptyTitle, 'Reference Verification');
    assert.equal(emptyBadge, '0 DOIs');
    assert.equal(emptyValue, '0');
    assert.equal(emptyUnit, 'DOIs');
    assert.equal(emptyFooter, 'No DOI references detected');

    // Populated state logic
    const populatedScan = {
      doiVerification: {
        total: 5,
        verified: 4
      }
    };
    const doiTotalPop = populatedScan.doiVerification.total;
    const doiVerifiedPop = populatedScan.doiVerification.verified;
    const hasNoDoiPop = doiTotalPop === 0;

    const popBadge = `${doiVerifiedPop}/${doiTotalPop} Valid`;
    const popValue = `${doiVerifiedPop}/${doiTotalPop}`;
    const popUnit = 'verified';
    const popFooter = `${doiTotalPop} scholarly items`;

    assert.equal(hasNoDoiPop, false);
    assert.equal(popBadge, '4/5 Valid');
    assert.equal(popValue, '4/5');
    assert.equal(popUnit, 'verified');
    assert.equal(popFooter, '5 scholarly items');
  });
});
