import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app, resolveMongoUri, getSanitizedMongoDiagnostics, setTurnstileVerifier } from '../src/index.js';
import { memDoiCache } from '../src/citationService.js';

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
  pipeName = `\\\\.\\pipe\\rp-audit-test-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
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

test('ResearchProof AI — Comprehensive System & Auth Audit Suite', async (t) => {
  let userToken = '';
  let userId = '';
  let userEmail = `auditor-${Date.now()}@university.edu`;
  const userPassword = 'StrongPassword123!';
  let docId = '';
  let scanId = '';

  // 1. Health Endpoints
  await t.test('1. Health check works on both /api and /api/v1 prefixes', async () => {
    const res1 = await api('/api/health');
    assert.equal(res1.status, 200);
    assert.equal(res1.body.status, 'ok');

    const res2 = await api('/api/v1/health');
    assert.equal(res2.status, 200);
    assert.equal(res2.body.status, 'ok');
  });

  // 2. Auth Config: Google client ID present, Turnstile disabled by default
  await t.test('2. Auth Config endpoint reflects non-blocking security posture', async () => {
    const res = await api('/api/auth/config');
    assert.equal(res.status, 200);
    assert.ok(res.body.googleConfigured !== undefined);
    assert.equal(res.body.turnstileSiteKey, '', 'Turnstile should be disabled by default');
  });

  // 3. Risk status returns requiresTurnstile: false for unflagged users
  await t.test('3. Risk status returns false by default for clean login', async () => {
    const res = await api(`/api/auth/risk-status?email=${encodeURIComponent(userEmail)}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.requiresTurnstile, false);
  });

  // 4. Registration without Turnstile
  await t.test('4. Direct email/password registration succeeds without CAPTCHA challenge', async () => {
    const res = await api('/api/auth/register', {
      method: 'POST',
      body: { email: userEmail, password: userPassword }
    });
    assert.equal(res.status, 201);
    assert.ok(res.body.token, 'Should issue JWT token');
    assert.equal(res.body.user.email, userEmail);
    assert.ok(!res.body.user.passwordHash, 'Password hash must never be returned');
    userId = res.body.user.id;
    userToken = res.body.token;
  });

  // 5. Duplicate registration rejected
  await t.test('5. Duplicate user registration rejected with 409 Conflict', async () => {
    const res = await api('/api/auth/register', {
      method: 'POST',
      body: { email: userEmail, password: userPassword }
    });
    assert.equal(res.status, 409);
  });

  // 5a. Invalid input rejection
  await t.test('5a. Registration rejects invalid email and weak passwords (<10 chars)', async () => {
    const invalidEmailRes = await api('/api/auth/register', {
      method: 'POST',
      body: { email: 'invalid-email', password: 'ValidPassword123!' }
    });
    assert.equal(invalidEmailRes.status, 400);

    const shortPassRes = await api('/api/auth/register', {
      method: 'POST',
      body: { email: `test-${Date.now()}@university.edu`, password: 'short' }
    });
    assert.equal(shortPassRes.status, 400);
  });

  // 5b. When Turnstile is enabled: Missing token rejected
  await t.test('5b. Verification Challenge: When Turnstile is active, registration without token is rejected', async () => {
    // Inject mock verifier
    setTurnstileVerifier(async (token) => {
      if (!token) return { success: false, error: 'Missing security verification token. Please complete the verification challenge.', code: 'MISSING_TOKEN' };
      if (token === 'VALID_TEST_TOKEN') return { success: true };
      return { success: false, error: 'Invalid security verification token.', code: 'INVALID_TOKEN' };
    });

    try {
      const res = await api('/api/auth/register', {
        method: 'POST',
        body: { email: `turnstile-test-${Date.now()}@university.edu`, password: 'StrongPassword123!' }
      });
      assert.equal(res.status, 400);
      assert.ok(res.body.code === 'MISSING_TOKEN' || res.body.code === 'TURNSTILE_REQUIRED');
      assert.equal(res.body.requiresTurnstile, true);
    } finally {
      setTurnstileVerifier(null);
    }
  });

  // 5c. When Turnstile is enabled: Valid token succeeds
  await t.test('5c. Verification Challenge: When Turnstile is active, registration with valid token succeeds', async () => {
    setTurnstileVerifier(async (token) => {
      if (token === 'VALID_TEST_TOKEN') return { success: true };
      return { success: false, error: 'Invalid token.' };
    });

    try {
      const turnstileEmail = `turnstile-success-${Date.now()}@university.edu`;
      const res = await api('/api/auth/register', {
        method: 'POST',
        body: { email: turnstileEmail, password: 'StrongPassword123!', turnstileToken: 'VALID_TEST_TOKEN' }
      });
      assert.equal(res.status, 201);
      assert.ok(res.body.token);
      assert.equal(res.body.user.email, turnstileEmail);
    } finally {
      setTurnstileVerifier(null);
    }
  });

  // 6. Direct Login without Turnstile
  await t.test('6. Direct login succeeds without CAPTCHA challenge', async () => {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: { email: userEmail, password: userPassword }
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, userEmail);
    userToken = res.body.token;
  });

  // 7. Wrong password rejected
  await t.test('7. Wrong password rejected with 401 Unauthorized', async () => {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: { email: userEmail, password: 'IncorrectPassword999!' }
    });
    assert.equal(res.status, 401);
  });

  // 8. Session validation via /api/auth/me
  await t.test('8. Authenticated session validation (/api/auth/me) works with Bearer token', async () => {
    const res = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, userEmail);
  });

  // 9. Unauthenticated /api/auth/me rejected
  await t.test('9. Unauthenticated /api/auth/me request rejected with 401', async () => {
    const res = await api('/api/auth/me');
    assert.equal(res.status, 401);
  });

  // 10. Google OAuth 2.0 Start flow
  await t.test('10. Google OAuth start endpoint redirects to Google with state and PKCE cookies', async () => {
    const res = await api('/api/auth/google/start?return_to=http%3A%2F%2Flocalhost%3A5173');
    assert.equal(res.status, 302);
    assert.ok(res.headers.location?.startsWith('https://accounts.google.com/o/oauth2/v2/auth'));
    const cookies = res.headers['set-cookie'] || [];
    assert.ok(cookies.some(c => c.includes('rp_oauth_state')), 'Must set rp_oauth_state cookie');
    assert.ok(cookies.some(c => c.includes('rp_oauth_verifier')), 'Must set rp_oauth_verifier cookie');
  });

  // 11. Document creation
  await t.test('11. Authenticated user can create a manuscript document', async () => {
    const res = await api('/api/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        title: 'Neural Networks in Empirical Econometrics',
        content: 'This manuscript explores non-linear functional estimation across high-dimensional macroeconomic panels.'
      }
    });
    assert.equal(res.status, 201);
    assert.ok(res.body._id);
    assert.equal(res.body.title, 'Neural Networks in Empirical Econometrics');
    docId = res.body._id;
  });

  // 12. Document reading & patching
  await t.test('12. Authenticated user can retrieve and update their document', async () => {
    const getRes = await api(`/api/documents/${docId}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body._id, docId);

    const patchRes = await api(`/api/documents/${docId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        title: 'Neural Networks in Empirical Econometrics (Revised)',
        content: 'Updated content with additional empirical specifications (p < 0.01).'
      }
    });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.title, 'Neural Networks in Empirical Econometrics (Revised)');
  });

  // 13. DOCX Export
  await t.test('13. Authenticated user can export document as DOCX binary', async () => {
    const res = await api(`/api/documents/${docId}/export-docx`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /vnd\.openxmlformats-officedocument\.wordprocessingml\.document/i);
  });

  // 14. Academic Citation Formatting
  await t.test('14. Citation formatting endpoint works with APA 7', async () => {
    const res = await api('/api/citations/format', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        style: 'apa',
        citation: {
          title: 'Deep Learning in Scholarly Publishing',
          authors: [{ given: 'Alan', family: 'Turing' }],
          year: 2024,
          journal: 'Journal of Academic Computing',
          volume: '42',
          doi: '10.1000/182'
        }
      }
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.formatted?.includes('Turing'));
  });

  // 15. System verification health grid
  await t.test('15. System verification panel returns operational service diagnostics', async () => {
    const res = await api('/api/system/verification');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'healthy');
    assert.ok(res.body.services?.similarityEngine);
    assert.ok(res.body.services?.database);
  });

  // 16. Logout clears session
  await t.test('16. Logout invalidates session and clears cookies', async () => {
    const res = await api('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const cookies = res.headers['set-cookie'] || [];
    assert.ok(cookies.some(c => c.includes('Max-Age=0') || c.includes('Expires=')), 'Must clear session cookie');
  });

  // 17. Authentication Contract & User Object Schema
  await t.test('17. Authentication Contract: /api/auth/me returns complete User schema with usage metrics', async () => {
    const loginRes = await api('/api/auth/login', {
      method: 'POST',
      body: { email: userEmail, password: userPassword }
    });
    assert.equal(loginRes.status, 200);
    const meRes = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${loginRes.body.token}` }
    });
    assert.equal(meRes.status, 200);
    const u = meRes.body.user;
    assert.ok(u.id, 'User must have id');
    assert.equal(u.email, userEmail);
    assert.ok('displayName' in u, 'Must contain displayName');
    assert.ok('avatarUrl' in u, 'Must contain avatarUrl');
    assert.ok('role' in u, 'Must contain role');
    assert.ok('status' in u, 'Must contain status');
    assert.ok('usage' in u, 'Must contain usage metrics');
    assert.ok('dailyRequests' in u.usage, 'Usage must specify dailyRequests');
    assert.ok('dailyLimit' in u.usage, 'Usage must specify dailyLimit');
  });

  // 18. Cross-User Document Isolation
  await t.test('18. Cross-User Document Isolation: User B cannot access User A documents', async () => {
    const userBEmail = `userb-${Date.now()}@university.edu`;
    const regB = await api('/api/auth/register', {
      method: 'POST',
      body: { email: userBEmail, password: 'StrongPassword123!' }
    });
    assert.equal(regB.status, 201);
    const userBToken = regB.body.token;

    // User B tries to read User A's document
    const readAttempt = await api(`/api/documents/${docId}`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert.equal(readAttempt.status, 404, 'User B must not access User A document');

    // User B tries to patch User A's document
    const patchAttempt = await api(`/api/documents/${docId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userBToken}` },
      body: { title: 'Compromised Document Title' }
    });
    assert.equal(patchAttempt.status, 404, 'User B must not modify User A document');

    // User B tries to export User A's document
    const exportAttempt = await api(`/api/documents/${docId}/export-docx`, {
      headers: { Authorization: `Bearer ${userBToken}` }
    });
    assert.equal(exportAttempt.status, 404, 'User B must not export User A document');
  });

  // 19. Dual API Prefix Contract Consistency (/api vs /api/v1)
  await t.test('19. Dual API Prefix Consistency: /api and /api/v1 share identical contracts', async () => {
    const resA = await api('/api/documents', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    const resB = await api('/api/v1/documents', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(resA.status, resB.status);
    assert.equal(Array.isArray(resA.body), Array.isArray(resB.body));
    assert.equal(resA.body.length, resB.body.length);
  });

  // 20. File Upload Security Filter
  await t.test('20. File Upload Security: Unsupported file formats (.exe, .sh) are rejected', async () => {
    // Re-login to get active session
    const authRes = await api('/api/auth/login', {
      method: 'POST',
      body: { email: userEmail, password: userPassword }
    });
    const activeTok = authRes.body.token;

    // Send multipart-like boundary with invalid file extension
    const boundary = '----WebKitFormBoundaryTest123';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="malware.exe"',
      'Content-Type: application/octet-stream',
      '',
      'MZThisIsNotADocx',
      `--${boundary}--`
    ].join('\r\n');

    const res = await api('/api/documents/import-docx', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${activeTok}`,
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      body
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Unsupported file format/i);
    userToken = activeTok;
  });

  // 21. Research Tool: TextGuard Similarity Scan
  await t.test('21. Research Integrity Tool: TextGuard scan calculates similarity and hashes', async () => {
    const scanRes = await api('/api/textguard/scan', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        documentTitle: 'Econometric Estimation Study',
        text: 'This paper evaluates high dimensional vector autoregressions with sparse factor structures across macroeconomic time series.',
        documentId: docId
      }
    });
    assert.equal(scanRes.status, 200);
    assert.ok(scanRes.body.sha256, 'Must generate cryptographic document hash');
    assert.ok(scanRes.body.status === 'completed' || scanRes.body.status === 'clean');
    assert.ok(typeof scanRes.body.analyzedWordCount === 'number');
    scanId = scanRes.body._id || scanRes.body.id;
    assert.ok(scanId, 'Scan must produce persistent ID');
  });

  // 22. PDF Report Generation & Export
  await t.test('22. PDF Report Generation: Downloadable binary PDF produced for audit scan', async () => {
    const pdfRes = await api(`/api/textguard/scans/${scanId}/report`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(pdfRes.status, 200);
    assert.equal(pdfRes.headers['content-type'], 'application/pdf');
    assert.ok(pdfRes.rawBuffer.length > 50, 'PDF buffer must contain binary payload');
  });

  // 23. DOI Verification & Citation Lookup
  await t.test('23. DOI Verification: Pre-seeded DOI returns structured metadata with APA/MLA/IEEE formats', async () => {
    const testDoi = '10.1038/s41586-020-2649-2';
    memDoiCache.set(testDoi, {
      title: 'Array programming with NumPy',
      authors: [{ given: 'Charles R.', family: 'Harris' }, { given: 'K. Jarrod', family: 'Millman' }],
      year: 2020,
      journal: 'Nature',
      volume: '585',
      pages: '357-362',
      doi: testDoi
    });

    const doiRes = await api('/api/citations/lookup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { doi: testDoi }
    });
    assert.equal(doiRes.status, 200);
    assert.equal(doiRes.body.metadata?.doi, testDoi);
    assert.ok(doiRes.body.formatted?.apa?.includes('Harris'));
    assert.ok(doiRes.body.formatted?.mla?.includes('Harris'));
    assert.ok(doiRes.body.formatted?.ieee?.includes('Harris'));
  });

  // 24. End-to-End Workflow: Post-Logout Protected Resource Access Denied
  await t.test('24. Logout Security: Access to protected endpoints strictly denied after logout', async () => {
    const logoutRes = await api('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(logoutRes.status, 200);

    const docAccess = await api('/api/documents', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(docAccess.status, 401, 'Subsequent request with revoked token must return 401');
  });

  // 25. MongoDB Resolution: Resolves across MONGODB_URI, MONGO_URI, and DATABASE_URL
  await t.test('25. MongoDB URI Resolution: Supports multiple environment variable aliases', async () => {
    const origMongo = process.env.MONGODB_URI;
    const origAlt = process.env.DATABASE_URL;

    delete process.env.MONGODB_URI;
    process.env.DATABASE_URL = 'mongodb+srv://admin:pass@cluster0.abcde.mongodb.net/testdb';

    const res = resolveMongoUri();
    assert.equal(res.sourceKey, 'DATABASE_URL');
    assert.equal(res.uri, 'mongodb+srv://admin:pass@cluster0.abcde.mongodb.net/testdb');

    // Clean up
    delete process.env.DATABASE_URL;
    if (origMongo !== undefined) process.env.MONGODB_URI = origMongo;
    if (origAlt !== undefined) process.env.DATABASE_URL = origAlt;
  });

  // 26. MongoDB Diagnostics: Redacts credentials and distinguishes Atlas SRV vs Localhost
  await t.test('26. MongoDB Diagnostics: Redacts passwords and detects Atlas vs Localhost', async () => {
    const atlasUri = 'mongodb+srv://secretUser:superSecretPass123!@cluster0.xyz123.mongodb.net/prod_data?retryWrites=true&w=majority';
    const diag = getSanitizedMongoDiagnostics(atlasUri, 'MONGODB_URI');

    assert.equal(diag.scheme, 'mongodb+srv');
    assert.equal(diag.targetType, 'ATLAS_SRV');
    assert.equal(diag.host, 'cluster0.xyz123.mongodb.net');
    assert.equal(diag.isLocalhost, false);
    assert.ok(!diag.summary.includes('superSecretPass123!'), 'Password must never be logged');
    assert.ok(!diag.summary.includes('secretUser'), 'Username should be excluded from sanitized summary');

    const localUri = 'mongodb://127.0.0.1:27017/researchproof_ai';
    const localDiag = getSanitizedMongoDiagnostics(localUri, 'MONGODB_URI');
    assert.equal(localDiag.scheme, 'mongodb');
    assert.equal(localDiag.targetType, 'LOCALHOST');
    assert.equal(localDiag.isLocalhost, true);
  });

  // 27. Production Localhost Prevention: Rejects localhost in production environment
  await t.test('27. Production Guardrail: Localhost/127.0.0.1 flagged to prevent cloud ECONNREFUSED', async () => {
    const localhostUris = [
      'mongodb://127.0.0.1:27017/researchproof_ai',
      'mongodb://localhost:27017/researchproof_ai',
      'mongodb://0.0.0.0:27017/researchproof_ai'
    ];

    for (const uri of localhostUris) {
      const diag = getSanitizedMongoDiagnostics(uri, 'MONGODB_URI');
      assert.equal(diag.isLocalhost, true, `URI ${uri} must be recognized as localhost`);
    }
  });
});
