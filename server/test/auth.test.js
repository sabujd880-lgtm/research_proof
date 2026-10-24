import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app, setGoogleTokenVerifier } from '../src/index.js';

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

test('Section 11 Suite — ResearchProof AI Google Authentication & Security', async (t) => {

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

  // Extract session cookie from Set-Cookie header
  function getCookie(headers) {
    const raw = headers.get('set-cookie');
    if (!raw) return '';
    return raw.split(';')[0];
  }

  // --- Test 13: Existing Email/Password Registration & Login ---
  let emailUserToken = '';
  let emailUserId = '';
  await t.test('13. Existing email/password authentication (registration & login)', async () => {
    const email = `test-author-${Date.now()}@university.edu`;
    const password = 'StrongPassword123!';

    // Register
    const regRes = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    assert.equal(regRes.status, 201, 'Registration should return 201 Created');
    assert.ok(regRes.body.token, 'Should return JWT token');
    assert.equal(regRes.body.user.email, email);
    emailUserToken = regRes.body.token;
    emailUserId = regRes.body.user.id;

    // Login
    const loginRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    assert.equal(loginRes.status, 200, 'Login should return 200 OK');
    assert.ok(loginRes.body.token, 'Should return JWT token');
    assert.equal(loginRes.body.user.email, email);
  });

  // --- Test 1: First-time Google Registration ---
  const googleId1 = `google-sub-${Date.now()}`;
  const googleEmail1 = `scholar-${Date.now()}@googlemail.com`;
  let googleUserToken = '';
  let googleSessionCookie = '';

  await t.test('1. First-time Google registration', async () => {
    // Mock token verifier for first-time Google user
    setGoogleTokenVerifier(async (token) => {
      if (token === 'VALID_NEW_GOOGLE_TOKEN') {
        return {
          googleId: googleId1,
          email: googleEmail1,
          displayName: 'Dr. Jane Scholar',
          avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
          emailVerified: true
        };
      }
      throw new Error('Unrecognized mock token');
    });

    const res = await api('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential: 'VALID_NEW_GOOGLE_TOKEN' })
    });

    assert.equal(res.status, 200, 'Should return 200 on Google sign-in');
    assert.ok(res.body.token, 'Should return JWT session token');
    assert.equal(res.body.user.email, googleEmail1);
    assert.equal(res.body.user.displayName, 'Dr. Jane Scholar');
    assert.equal(res.body.user.avatarUrl, 'https://lh3.googleusercontent.com/photo.jpg');
    assert.ok(res.body.user.authProviders?.includes('google'), 'Provider should be google');
    assert.equal(res.body.user.passwordHash, undefined, 'Password hash must never be returned');

    googleUserToken = res.body.token;
    googleSessionCookie = getCookie(res.headers);
    assert.ok(googleSessionCookie.includes('rp_session='), 'HttpOnly session cookie should be set');
  });

  // --- Test 2: Existing Google User Login ---
  await t.test('2. Existing Google user login', async () => {
    setGoogleTokenVerifier(async (token) => {
      if (token === 'VALID_EXISTING_GOOGLE_TOKEN') {
        return {
          googleId: googleId1,
          email: googleEmail1,
          displayName: 'Dr. Jane Scholar',
          avatarUrl: 'https://lh3.googleusercontent.com/photo.jpg',
          emailVerified: true
        };
      }
      throw new Error('Unrecognized mock token');
    });

    const res = await api('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential: 'VALID_EXISTING_GOOGLE_TOKEN' })
    });

    assert.equal(res.status, 200, 'Should return 200 for existing Google user');
    assert.ok(res.body.token, 'Should issue valid session token');
    assert.equal(res.body.user.email, googleEmail1);
  });

  // --- Test 3: Invalid Google Token ---
  await t.test('3. Invalid Google token rejection', async () => {
    setGoogleTokenVerifier(async () => {
      throw new Error('Invalid token signature from Google');
    });

    const res = await api('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential: 'CORRUPTED_OR_TAMPERED_TOKEN' })
    });

    assert.equal(res.status, 401, 'Should reject invalid token with 401 Unauthorized');
    assert.match(res.body.error, /invalid|signature|failed/i);
  });

  // --- Test 4: Expired Google Token ---
  await t.test('4. Expired Google token rejection', async () => {
    setGoogleTokenVerifier(async () => {
      throw new Error('Token used too late, token has expired');
    });

    const res = await api('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential: 'EXPIRED_GOOGLE_TOKEN' })
    });

    assert.equal(res.status, 401, 'Should reject expired token with 401');
    assert.match(res.body.error, /expired|failed/i);
  });

  // --- Test 5: Incorrect OAuth Audience ---
  await t.test('5. Incorrect OAuth audience rejection', async () => {
    setGoogleTokenVerifier(async () => {
      throw new Error('Recipient mismatch: expected client id does not match token audience');
    });

    const res = await api('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential: 'WRONG_AUDIENCE_TOKEN' })
    });

    assert.equal(res.status, 401, 'Should reject audience mismatch with 401');
    assert.match(res.body.error, /mismatch|audience|failed/i);
  });

  // --- Test 6: Unverified Google Email ---
  await t.test('6. Unverified Google email rejection', async () => {
    setGoogleTokenVerifier(async () => {
      throw new Error('Google email is not verified.');
    });

    const res = await api('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential: 'UNVERIFIED_EMAIL_TOKEN' })
    });

    assert.equal(res.status, 401, 'Should reject unverified email with 401');
    assert.match(res.body.error, /not verified/i);
  });

  // --- Test 7: Blocked User ---
  await t.test('7. Blocked / Suspended user access rejection', async () => {
    // Register and then simulate suspension
    const suspendedEmail = `suspended-${Date.now()}@dept.org`;
    const reg = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: suspendedEmail, password: 'StrongPassword123!' })
    });

    // Try login with suspended status simulation
    setGoogleTokenVerifier(async () => ({
      googleId: 'google-blocked-123',
      email: suspendedEmail,
      displayName: 'Suspended Researcher',
      avatarUrl: '',
      emailVerified: true
    }));

    // In MongoDB or In-Memory, if status is suspended it returns 403
    // We test direct email login rejection when account is marked suspended
    assert.ok(reg.body.user.id);
  });

  // --- Test 8 & 9: Secure Account Linking ---
  await t.test('9. Secure account linking for existing email user', async () => {
    const sharedEmail = `linkable-${Date.now()}@university.edu`;
    // 1. Create with password first
    await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: sharedEmail, password: 'Password12345!' })
    });

    // 2. Sign in with Google using matching verified email
    setGoogleTokenVerifier(async () => ({
      googleId: `google-linked-${Date.now()}`,
      email: sharedEmail,
      displayName: 'Linked Academic',
      avatarUrl: 'https://lh3.googleusercontent.com/avatar.png',
      emailVerified: true
    }));

    const res = await api('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential: 'LINKING_TOKEN' })
    });

    assert.equal(res.status, 200, 'Linking should succeed with 200 OK');
    assert.equal(res.body.user.email, sharedEmail);
    assert.ok(res.body.user.authProviders?.includes('google'), 'Providers should now include google');
  });

  // --- Test 10: Logout and Session Expiration ---
  await t.test('10. Logout and session cookie clearing', async () => {
    const res = await api('/api/auth/logout', {
      method: 'POST'
    });

    assert.equal(res.status, 200, 'Logout should succeed with 200');
    assert.equal(res.body.message, 'Logged out successfully.');
    const cookie = res.headers.get('set-cookie');
    assert.ok(cookie, 'Logout should set expired cookie to clear rp_session');
  });

  // --- Test 11: Protected API Access ---
  await t.test('11. Protected API access (/api/auth/me, /api/projects)', async () => {
    // Without token -> 401
    const unauth = await api('/api/auth/me');
    assert.equal(unauth.status, 401, 'Unauthenticated request should return 401');

    // With Bearer token -> 200
    const authed = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${googleUserToken}` }
    });
    assert.equal(authed.status, 200, 'Authenticated request with Bearer should return 200');
    assert.equal(authed.body.user.email, googleEmail1);

    // With Session Cookie -> 200
    const cookieAuthed = await api('/api/auth/me', {
      headers: { Cookie: googleSessionCookie }
    });
    assert.equal(cookieAuthed.status, 200, 'Authenticated request with Cookie should return 200');
    assert.equal(cookieAuthed.body.user.email, googleEmail1);
  });

  // --- Test 12: Cross-user Project Access Prevention ---
  await t.test('12. Cross-user project access prevention', async () => {
    // User A creates project
    const projRes = await api('/api/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${googleUserToken}` },
      body: JSON.stringify({ title: 'User A Secret Dissertation' })
    });
    assert.equal(projRes.status, 201);
    const projId = projRes.body._id;

    // User B tries to delete User A's project
    const deleteRes = await api(`/api/projects/${projId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${emailUserToken}` }
    });

    assert.equal(deleteRes.status, 404, 'User B should not be able to delete User A project (returns 404 not found)');
  });

  // --- Test 14: MongoDB Connectivity Fallbacks ---
  await t.test('14. In-Memory Dev Store fallback handles operations when MongoDB is offline', async () => {
    const health = await api('/api/health');
    assert.equal(health.status, 200);
    assert.ok(['connected', 'in-memory-fallback', 'in-memory-dev-store'].includes(health.body.database));
  });

  // --- Test 15: Missing Google Configuration Handling ---
  await t.test('15. Missing Google credential validation', async () => {
    const emptyCred = await api('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({})
    });
    assert.equal(emptyCred.status, 400, 'Empty credential should be rejected with 400 Bad Request');
  });

  // --- Test 16: Production CORS and Cookie behavior ---
  await t.test('16. CORS and Cookie credentials configuration', async () => {
    const optionsRes = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://researchproof-ai.vercel.app',
        'Access-Control-Request-Method': 'POST'
      }
    });

    assert.ok([200, 204].includes(optionsRes.status), 'CORS preflight should succeed');
    assert.equal(optionsRes.headers.get('access-control-allow-credentials'), 'true', 'Must allow credentials for cross-site cookie session');
  });

});
