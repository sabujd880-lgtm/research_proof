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
  pipeName = `\\\\.\\pipe\\rp-phase3-test-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
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

test('ResearchProof AI — Phase 3 Enterprise Dashboard & Projects Suite', async (t) => {
  let userToken = '';
  let userId = '';
  const userEmail = `phase3-researcher-${Date.now()}@university.edu`;
  const userPassword = 'RigorPassword123!';
  let testProjectId = '';
  let testTaskId1 = '';
  let testTaskId2 = '';

  // 1. Setup authenticated user
  await t.test('1. Setup test user registration', async () => {
    const res = await api('/api/v1/auth/register', {
      method: 'POST',
      body: { email: userEmail, password: userPassword }
    });
    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    userToken = res.body.token;
    userId = res.body.user.id;
  });

  // 2. Unauthenticated access security checks
  await t.test('2. Unauthenticated requests to Phase 3 endpoints return 401 Unauthorized', async () => {
    const res1 = await api('/api/v1/dashboard/overview');
    assert.equal(res1.status, 401);

    const res2 = await api('/api/v1/dashboard/upcoming-tasks');
    assert.equal(res2.status, 401);

    const res3 = await api('/api/v1/projects', { method: 'POST', body: { title: 'Test' } });
    assert.equal(res3.status, 401);
  });

  // 3. Initial Dashboard Overview (empty state metrics)
  await t.test('3. Authenticated user receives structured dashboard overview', async () => {
    const res = await api('/api/v1/dashboard/overview', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.metrics);
    assert.equal(typeof res.body.metrics.totalProjects, 'number');
    assert.equal(typeof res.body.metrics.totalDocuments, 'number');
    assert.equal(typeof res.body.metrics.totalCitations, 'number');
    assert.ok(res.body.metrics.tasks);
    assert.equal(typeof res.body.metrics.tasks.completionRate, 'number');
    assert.ok(Array.isArray(res.body.recentProjects));
    assert.ok(Array.isArray(res.body.recentActivity));
    assert.ok(Array.isArray(res.body.upcomingTasks));
  });

  // 4. Project Creation validation
  await t.test('4. Project creation rejects short title (<3 chars)', async () => {
    const res = await api('/api/v1/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { title: 'No' }
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  // 5. Successful Project Creation with complete schema
  await t.test('5. Valid project creation initializes default progress 0% and membership', async () => {
    const projectPayload = {
      title: 'Neural Dynamics of Semantic Memory Recall',
      discipline: 'Medicine & Health',
      researchType: 'Experimental',
      description: 'Investigating hippocampal oscillations during paired-associate recall.',
      objectives: ['Identify theta-gamma phase coupling', 'Evaluate fMRI correlates'],
      keywords: ['hippocampus', 'theta oscillations', 'memory recall'],
      startDate: new Date().toISOString(),
      targetDate: new Date(Date.now() + 86400000 * 90).toISOString(),
      visibility: 'private'
    };

    const res = await api('/api/v1/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: projectPayload
    });

    assert.equal(res.status, 201);
    assert.ok(res.body._id);
    assert.equal(res.body.title, projectPayload.title);
    assert.equal(res.body.discipline, projectPayload.discipline);
    assert.equal(res.body.researchType, projectPayload.researchType);
    assert.equal(res.body.progress, 0);
    assert.equal(res.body.status, 'active');
    assert.deepEqual(res.body.keywords, projectPayload.keywords);
    testProjectId = res.body._id;
  });

  // 6. Query projects with filtering and pagination headers
  await t.test('6. GET /projects supports status filter, search query, and pagination headers', async () => {
    const res = await api('/api/v1/projects?paginated=true&discipline=Medicine%20%26%20Health&q=Neural', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.projects));
    assert.equal(res.body.projects.length, 1);
    assert.equal(res.body.projects[0]._id, testProjectId);
    assert.ok(res.body.pagination);
    assert.ok(res.headers['x-total-count'], 'X-Total-Count header must be present');
    assert.ok(res.headers['x-page'], 'X-Page header must be present');
    assert.ok(res.headers['x-total-pages'], 'X-Total-Pages header must be present');
  });

  // 7. Backward compatibility: GET /projects without paginated=true returns array
  await t.test('7. GET /projects without paginated parameter returns raw array for backward compatibility', async () => {
    const res = await api('/api/v1/projects', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 1);
  });

  // 8. Update project metadata
  await t.test('8. PATCH /projects/:id updates allowed fields and preserves progress', async () => {
    const res = await api(`/api/v1/projects/${testProjectId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { description: 'Updated empirical protocol description.' }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.description, 'Updated empirical protocol description.');
  });

  // 9. Task Creation & Deterministic Progress Recalculation
  await t.test('9. Adding task initializes deterministic progress to 0% (0/1 completed)', async () => {
    const res = await api(`/api/v1/projects/${testProjectId}/tasks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        title: 'Complete Institutional Review Board (IRB) submission',
        priority: 'high',
        stage: 'methodology',
        dueDate: new Date(Date.now() + 86400000 * 14).toISOString()
      }
    });
    assert.equal(res.status, 201);
    assert.ok(res.body._id);
    assert.equal(res.body.status, 'todo');
    testTaskId1 = res.body._id;

    // Verify project progress derives deterministically
    const projRes = await api(`/api/v1/projects/${testProjectId}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(projRes.status, 200);
    assert.equal(projRes.body.progress, 0);
  });

  // 10. Task Completion & Progress Calculation
  await t.test('10. Completing task recalculates project progress to 100% (1/1 completed)', async () => {
    const res = await api(`/api/v1/projects/${testProjectId}/tasks/${testTaskId1}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { status: 'done' }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'done');

    const projRes = await api(`/api/v1/projects/${testProjectId}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(projRes.status, 200);
    assert.equal(projRes.body.progress, 100);
  });

  // 11. Add second task and verify 50% deterministic progress
  await t.test('11. Adding second todo task recalculates progress to 50% (1/2 completed)', async () => {
    const res = await api(`/api/v1/projects/${testProjectId}/tasks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        title: 'Calibrate high-density EEG sensor array',
        priority: 'medium'
      }
    });
    assert.equal(res.status, 201);
    testTaskId2 = res.body._id;

    const projRes = await api(`/api/v1/projects/${testProjectId}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(projRes.status, 200);
    assert.equal(projRes.body.progress, 50);
  });

  // 12. Delete second task and verify return to 100%
  await t.test('12. Deleting task recalculates progress to 100% (1/1 completed)', async () => {
    const res = await api(`/api/v1/projects/${testProjectId}/tasks/${testTaskId2}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(res.status, 200);

    const projRes = await api(`/api/v1/projects/${testProjectId}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(projRes.status, 200);
    assert.equal(projRes.body.progress, 100);
  });

  // 13. Project Activity Timeline
  await t.test('13. GET /projects/:id/activity returns chronological activity events', async () => {
    const res = await api(`/api/v1/projects/${testProjectId}/activity`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0, 'Activity trail should contain logged actions');
  });

  // 14. Project Archive Action
  await t.test('14. POST /projects/:id/archive sets status: archived and records timestamp', async () => {
    const res = await api(`/api/v1/projects/${testProjectId}/archive`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'archived');
    assert.ok(res.body.archivedAt);
  });

  // 15. Project Restore Action
  await t.test('15. POST /projects/:id/restore resets status: active and clears archivedAt', async () => {
    const res = await api(`/api/v1/projects/${testProjectId}/restore`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'active');
    assert.equal(res.body.archivedAt, null);
  });

  // 16. Soft Delete Action
  await t.test('16. DELETE /projects/:id performs non-destructive soft deletion', async () => {
    const res = await api(`/api/v1/projects/${testProjectId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.deleted, true);

    // Filtered project list should exclude deleted project by default
    const listRes = await api('/api/v1/projects', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(listRes.status, 200);
    const found = listRes.body.find(p => p._id === testProjectId);
    assert.equal(found, undefined, 'Soft-deleted project must not appear in active project queries');
  });

  // 17. Dashboard Upcoming Tasks endpoint
  await t.test('17. GET /dashboard/upcoming-tasks returns user task items', async () => {
    const res = await api('/api/v1/dashboard/upcoming-tasks', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  // 18. Dashboard Recent Projects endpoint
  await t.test('18. GET /dashboard/recent-projects returns list of projects', async () => {
    const res = await api('/api/v1/dashboard/recent-projects', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });
});
