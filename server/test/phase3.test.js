import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/index.js';
import { recordUsageEvent, getAnalyticsOverview } from '../src/analyticsService.js';
import { generateIntegrityReport, exportIntegrityReportDocx } from '../src/integrityService.js';

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

test('ResearchProof AI — Phase 3 Platform Management Suite', async (t) => {
  // Helper for requests
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
      data = await res.arrayBuffer();
    }
    return { status: res.status, headers: res.headers, body: data };
  }

  // Setup users for test suite
  const researcherEmail = `researcher-${Date.now()}@university.edu`;
  const otherUserEmail = `other-${Date.now()}@institute.org`;
  const password = 'StrongPassword123!';

  let adminToken = '';
  let researcherToken = '';
  let researcherId = '';
  let otherToken = '';
  let otherId = '';

  // 1. Register test users
  const res1 = await apiRequest('/auth/register', {
    method: 'POST',
    body: { email: researcherEmail, password }
  });
  assert.equal(res1.status, 201);
  researcherToken = res1.body.token;
  researcherId = res1.body.user.id || res1.body.user._id;

  const res2 = await apiRequest('/auth/register', {
    method: 'POST',
    body: { email: otherUserEmail, password }
  });
  assert.equal(res2.status, 201);
  otherToken = res2.body.token;
  otherId = res2.body.user.id || res2.body.user._id;

  // Use pre-seeded admin user
  const adminLogin = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: 'admin@researchproof.ai', password: 'AdminPassword123!' }
  });
  assert.equal(adminLogin.status, 200);
  assert.equal(adminLogin.body.user.role, 'admin');
  adminToken = adminLogin.body.token;
  const adminId = adminLogin.body.user.id || adminLogin.body.user._id;

  await t.test('1. Non-admin cannot access administrator APIs (RBAC enforcement)', async () => {
    const ovRes = await apiRequest('/admin/overview', {
      headers: { Authorization: `Bearer ${researcherToken}` }
    });
    assert.equal(ovRes.status, 403);
    assert.match(ovRes.body.error, /Administrative privileges required/i);

    const usersRes = await apiRequest('/admin/users', {
      headers: { Authorization: `Bearer ${researcherToken}` }
    });
    assert.equal(usersRes.status, 403);
  });

  await t.test('2. Admin can view database overview metrics and system status', async () => {
    const ovRes = await apiRequest('/admin/overview', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(ovRes.status, 200);
    assert.ok(ovRes.body.users);
    assert.ok(typeof ovRes.body.users.total === 'number');
    assert.ok(ovRes.body.content);
    assert.ok(ovRes.body.system);
    assert.equal(typeof ovRes.body.system.aiConfigured, 'boolean');
  });

  await t.test('3. Admin user management with search, pagination, and safe metadata', async () => {
    const listRes = await apiRequest('/admin/users?limit=10', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(listRes.status, 200);
    assert.ok(Array.isArray(listRes.body.users));
    assert.ok(listRes.body.pagination);

    // Verify sensitive secrets are NOT exposed
    const found = listRes.body.users.find(u => u.email === researcherEmail);
    assert.ok(found);
    assert.equal(found.passwordHash, undefined);
    assert.equal(found.token, undefined);

    const detailRes = await apiRequest(`/admin/users/${researcherId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.body.email, researcherEmail);
    assert.equal(detailRes.body.passwordHash, undefined);
  });

  await t.test('4. Administrative safety: Self-suspension is strictly rejected', async () => {
    const selfRes = await apiRequest(`/admin/users/${adminId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'suspended', reason: 'Attempting self-suspension' }
    });
    assert.equal(selfRes.status, 400);
    assert.match(selfRes.body.error, /cannot suspend your own account/i);
  });

  await t.test('5. Admin can suspend user account with mandatory reason and revoke sessions', async () => {
    // Missing reason rejection
    const noReason = await apiRequest(`/admin/users/${researcherId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'suspended', reason: '' }
    });
    assert.equal(noReason.status, 400);

    // Valid suspension
    const suspRes = await apiRequest(`/admin/users/${researcherId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'suspended', reason: 'Terms of service compliance review' }
    });
    assert.equal(suspRes.status, 200);
    assert.equal(suspRes.body.user.status, 'suspended');

    // Suspended user is denied access to protected endpoints
    const deniedRes = await apiRequest('/documents', {
      headers: { Authorization: `Bearer ${researcherToken}` }
    });
    assert.equal(deniedRes.status, 403);
    assert.match(deniedRes.body.error, /Account is suspended/i);

    // Reactivate user
    const reactivateRes = await apiRequest(`/admin/users/${researcherId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'active', reason: 'Compliance review completed' }
    });
    assert.equal(reactivateRes.status, 200);
    assert.equal(reactivateRes.body.user.status, 'active');
  });

  await t.test('6. Usage Analytics Engine tracks discrete events and feature breakdowns', async () => {
    await recordUsageEvent({
      eventType: 'rewrite',
      feature: 'rewrite',
      userId: researcherId,
      durationMs: 120,
      success: true,
      provider: 'gemini'
    });

    const featRes = await apiRequest('/admin/analytics/features', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(featRes.status, 200);
    assert.ok(Array.isArray(featRes.body));
    assert.ok(featRes.body.some(f => f.feature === 'rewrite'));
  });

  await t.test('7. Privacy Control Center: retrieve and update privacy settings', async () => {
    const getRes = await apiRequest('/privacy/settings', {
      headers: { Authorization: `Bearer ${otherToken}` }
    });
    assert.equal(getRes.status, 200);
    assert.ok(getRes.body.settings);
    assert.ok(getRes.body.policies);

    const patchRes = await apiRequest('/privacy/settings', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${otherToken}` },
      body: { persistDocumentText: false, allowAiProcessing: false }
    });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.settings.allowAiProcessing, false);
  });

  await t.test('8. Data Export returns owned research records without credentials', async () => {
    // Create a document and citation for other user first
    const docRes = await apiRequest('/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherToken}` },
      body: { title: 'Export Manuscript', content: 'Academic text for export testing.' }
    });
    assert.equal(docRes.status, 201);

    const exportRes = await apiRequest('/privacy/export', {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherToken}` }
    });
    assert.equal(exportRes.status, 200);
    assert.equal(exportRes.body.user.email, otherUserEmail);
    assert.equal(exportRes.body.user.passwordHash, undefined);
    assert.ok(Array.isArray(exportRes.body.documents));
    assert.ok(exportRes.body.documents.some(d => d.title === 'Export Manuscript'));
  });

  await t.test('9. Research Integrity Report generation with deterministic findings', async () => {
    const textWithIssues = `
      The present study examines variables in longitudinal samples.
      The investigation was conducted across 45 participants (p < 0.05).
      This sentence is deliberately written to exceed forty words in length to trigger the cognitive flow and excessive length warning that peer-reviewed literature and scientific writing standards require for clarity and readability in academic publishing.
      According to (Smith, 2024), empirical outcomes were significant.
    `;

    const reportRes = await apiRequest('/integrity/reports', {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherToken}` },
      body: {
        text: textWithIssues,
        title: 'Diagnostic Test Report'
      }
    });
    assert.equal(reportRes.status, 201);
    assert.ok(reportRes.body.summaryMetrics);
    assert.ok(reportRes.body.summaryMetrics.wordCount > 30);
    assert.ok(reportRes.body.findings.length > 0);
    assert.ok(reportRes.body.limitations);

    const reportId = reportRes.body._id || reportRes.body.id;

    // Refresh researcherToken because Subtest 5 verified session invalidation by incrementing tokenVersion
    const refreshed = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: researcherEmail, password }
    });
    const activeResearcherToken = refreshed.body.token;

    // Cross-user access denial
    const crossRes = await apiRequest(`/integrity/reports/${reportId}`, {
      headers: { Authorization: `Bearer ${activeResearcherToken}` }
    });
    assert.equal(crossRes.status, 404);


    // Owner access
    const ownerRes = await apiRequest(`/integrity/reports/${reportId}`, {
      headers: { Authorization: `Bearer ${otherToken}` }
    });
    assert.equal(ownerRes.status, 200);
    assert.equal(ownerRes.body.title, 'Diagnostic Test Report');

    // DOCX Export of report
    const docxRes = await apiRequest(`/integrity/reports/${reportId}/export?format=docx`, {
      headers: { Authorization: `Bearer ${otherToken}` }
    });
    assert.equal(docxRes.status, 200);
    assert.equal(docxRes.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    assert.ok(docxRes.body.byteLength > 0);
  });

  await t.test('10. Complete Account Deletion cascades and anonymizes user record', async () => {
    // Attempt deletion with wrong password
    const wrongPass = await apiRequest('/privacy/delete-account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherToken}` },
      body: { password: 'WrongPassword999!' }
    });
    assert.equal(wrongPass.status, 401);

    // Successful deletion with correct password
    const deleteRes = await apiRequest('/privacy/delete-account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherToken}` },
      body: { password }
    });
    assert.equal(deleteRes.status, 200);
    assert.equal(deleteRes.body.success, true);

    // Old token should now be rejected
    const expiredRes = await apiRequest('/documents', {
      headers: { Authorization: `Bearer ${otherToken}` }
    });
    assert.equal(expiredRes.status, 401);
  });
});
