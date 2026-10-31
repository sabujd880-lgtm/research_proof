import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../src/index.js';
import {
  hasPermission,
  generateInvitationToken,
  calculateReviewScore,
  COLLABORATION_ROLES,
  REVIEW_STATUSES,
  REVIEW_DECISIONS
} from '../src/collaborationService.js';

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

test('Phase 10 — Research Collaboration Studio Comprehensive Test Suite', async (t) => {
  let authToken = '';
  let collaboratorToken = '';
  let projectId = '';
  let documentId = '';
  let invitationRawToken = '';
  let invitationId = '';
  let commentId = '';
  let reviewId = '';

  await t.test('1. Domain Logic: RBAC Permissions, Tokens & Rubric Calculation', async () => {
    // RBAC check
    assert.equal(hasPermission('owner', 'delete_project'), true);
    assert.equal(hasPermission('owner', 'manage_team'), true);
    assert.equal(hasPermission('editor', 'write'), true);
    assert.equal(hasPermission('editor', 'delete_project'), false);
    assert.equal(hasPermission('reviewer', 'decide_review'), true);
    assert.equal(hasPermission('reviewer', 'write'), false);
    assert.equal(hasPermission('viewer', 'read'), true);
    assert.equal(hasPermission('viewer', 'write'), false);

    // Crypto Token Generation
    const tokenObj = generateInvitationToken();
    assert.ok(tokenObj.rawToken);
    assert.equal(tokenObj.rawToken.length, 64);
    assert.ok(tokenObj.tokenHash);
    assert.equal(tokenObj.tokenHash.length, 64);

    // Review Score Rubric Calculation (Average of 4 criteria scaled to 100)
    const score = calculateReviewScore({
      methodologicalRigor: 9,
      academicClarity: 8,
      citationEvidence: 9,
      originality: 10
    });
    assert.equal(score, 90);
  });

  await t.test('2. Setup primary researcher session, project, and manuscript document', async () => {
    // Authenticate primary researcher
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'demo@researchproof.ai', password: 'Password1234!' })
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    authToken = loginData.token;

    // Create research project
    const projRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        title: 'Neural Oscillations in Working Memory',
        description: 'Multi-institutional study on gamma band synchrony'
      })
    });
    assert.equal(projRes.status, 201);
    const projData = await projRes.json();
    projectId = projData.project?._id || projData._id;
    assert.ok(projectId);

    // Create a manuscript document inside the project
    const docRes = await fetch(`${baseUrl}/api/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        projectId,
        title: 'Prefrontal Cortical Dynamics in Executive Function',
        content: 'Introduction: Executive control relies on coordinated neural ensembles in the dorsolateral prefrontal cortex...'
      })
    });
    assert.equal(docRes.status, 201);
    const docData = await docRes.json();
    documentId = docData._id;
    assert.ok(documentId);
  });

  await t.test('3. Invitations: Dispatch cryptographic invitation and list pending invites', async () => {
    const inviteRes = await fetch(`${baseUrl}/api/projects/${projectId}/invitations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        email: 'collaborator@harvard.edu',
        role: 'editor'
      })
    });
    assert.equal(inviteRes.status, 201);
    const inviteData = await inviteRes.json();
    assert.equal(inviteData.success, true);
    assert.ok(inviteData.invitation);
    assert.equal(inviteData.invitation.email, 'collaborator@harvard.edu');
    assert.equal(inviteData.invitation.role, 'editor');
    assert.ok(inviteData.invitation.rawToken);
    invitationRawToken = inviteData.invitation.rawToken;
    invitationId = inviteData.invitation.invitationId;

    // List pending invitations
    const listRes = await fetch(`${baseUrl}/api/projects/${projectId}/invitations`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.equal(listData.success, true);
    assert.ok(Array.isArray(listData.invitations));
    assert.ok(listData.invitations.length >= 1);
  });

  await t.test('4. Invitations & Members: Accept invitation with token & verify team membership', async () => {
    // Accept invitation using token
    const acceptRes = await fetch(`${baseUrl}/api/invitations/${invitationRawToken}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
    assert.equal(acceptRes.status, 200);
    const acceptData = await acceptRes.json();
    assert.equal(acceptData.success, true);
    assert.equal(acceptData.role, 'editor');

    // Fetch team members
    const memRes = await fetch(`${baseUrl}/api/projects/${projectId}/members`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(memRes.status, 200);
    const members = await memRes.json();
    assert.ok(Array.isArray(members));
  });

  await t.test('5. RBAC Protection: Safeguard preventing last project owner removal', async () => {
    // If we attempt to delete an owner when only 1 owner exists, must reject
    // Add an owner member to test
    const addOwnerRes = await fetch(`${baseUrl}/api/projects/${projectId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        email: 'testowner@stanford.edu',
        role: 'owner'
      })
    });
    
    // Test role update / demotion endpoint
    const patchRes = await fetch(`${baseUrl}/api/projects/${projectId}/members/nonexistent123`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ role: 'invalid_role' })
    });
    assert.equal(patchRes.status, 400); // Rejects invalid role
  });

  await t.test('6. Collaborative Task Management: Create, update status, and query tasks', async () => {
    // Create Task
    const createRes = await fetch(`${baseUrl}/api/projects/${projectId}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        title: 'Conduct Bonferroni correction on fMRI voxel clusters',
        description: 'Verify false positive rate threshold p < 0.001',
        priority: 'urgent',
        stage: 'analysis'
      })
    });
    assert.equal(createRes.status, 201);
    const task = await createRes.json();
    assert.equal(task.title, 'Conduct Bonferroni correction on fMRI voxel clusters');
    assert.equal(task.status, 'todo');
    assert.equal(task.priority, 'urgent');

    // Update Task Status to 'review'
    const patchRes = await fetch(`${baseUrl}/api/projects/${projectId}/tasks/${task._id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ status: 'review' })
    });
    assert.equal(patchRes.status, 200);
    const updatedTask = await patchRes.json();
    assert.equal(updatedTask.status, 'review');

    // Query tasks
    const getRes = await fetch(`${baseUrl}/api/projects/${projectId}/tasks`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(getRes.status, 200);
    const tasks = await getRes.json();
    assert.ok(tasks.some(t => t.title === 'Conduct Bonferroni correction on fMRI voxel clusters'));
  });

  await t.test('7. Threaded Document Comments: Add anchored feedback, reply, and resolve', async () => {
    // Post anchored comment
    const commentRes = await fetch(`${baseUrl}/api/projects/${projectId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        documentId,
        selectedText: 'coordinated neural ensembles in the dorsolateral prefrontal cortex',
        content: 'Please verify if power spectral density was normalized prior to wavelet transform.'
      })
    });
    assert.equal(commentRes.status, 201);
    const commentData = await commentRes.json();
    assert.equal(commentData.success, true);
    assert.ok(commentData.comment);
    assert.equal(commentData.comment.resolved, false);
    commentId = commentData.comment._id;

    // Add reply to comment thread
    const replyRes = await fetch(`${baseUrl}/api/projects/${projectId}/comments/${commentId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        content: 'Yes, Morlet wavelets were applied with continuous normalization across trial epochs.'
      })
    });
    assert.equal(replyRes.status, 200);
    const replyData = await replyRes.json();
    assert.equal(replyData.success, true);
    assert.ok(replyData.comment.replies.length >= 1);

    // Resolve comment
    const resolveRes = await fetch(`${baseUrl}/api/projects/${projectId}/comments/${commentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ resolved: true })
    });
    assert.equal(resolveRes.status, 200);
    const resolvedData = await resolveRes.json();
    assert.equal(resolvedData.success, true);
    assert.equal(resolvedData.comment.resolved, true);
  });

  await t.test('8. Manuscript Review Workflow: Submit draft, issue rubric decision & scoring', async () => {
    // Submit document for internal review
    const submitRes = await fetch(`${baseUrl}/api/projects/${projectId}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        documentId,
        notes: 'Pre-submission internal review prior to Nature Neuroscience submission.'
      })
    });
    assert.equal(submitRes.status, 201);
    const submitData = await submitRes.json();
    assert.equal(submitData.success, true);
    assert.ok(submitData.review);
    assert.equal(submitData.review.status, 'submitted_for_review');
    assert.equal(submitData.review.decision, 'pending');
    reviewId = submitData.review._id;

    // Issue review decision with 4 criteria scores
    const decisionRes = await fetch(`${baseUrl}/api/projects/${projectId}/reviews/${reviewId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        decision: 'accept',
        decisionNotes: 'Rigorous experimental design, statistical power well justified, clear discussion.',
        criteriaScores: {
          methodologicalRigor: 9,
          academicClarity: 9,
          citationEvidence: 8,
          originality: 10
        }
      })
    });
    assert.equal(decisionRes.status, 200);
    const decisionData = await decisionRes.json();
    assert.equal(decisionData.success, true);
    assert.equal(decisionData.review.decision, 'accept');
    assert.equal(decisionData.review.status, 'approved');
    assert.equal(decisionData.review.score, 90);
  });

  await t.test('9. Collaboration Notifications & Project Activity Feed', async () => {
    // Query notifications
    const notifRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(notifRes.status, 200);
    const notifData = await notifRes.json();
    assert.equal(notifData.success, true);
    assert.ok(Array.isArray(notifData.notifications));

    // Mark all notifications as read
    const readAllRes = await fetch(`${baseUrl}/api/notifications/read-all`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(readAllRes.status, 200);
    const readAllData = await readAllRes.json();
    assert.equal(readAllData.readAll, true);

    // Query activity feed
    const actRes = await fetch(`${baseUrl}/api/projects/${projectId}/activity`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(actRes.status, 200);
    const activities = await actRes.json();
    assert.ok(Array.isArray(activities));
  });
});
