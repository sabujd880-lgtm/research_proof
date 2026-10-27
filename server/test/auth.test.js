import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app, setGoogleTokenVerifier, setTurnstileVerifier } from '../src/index.js';

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

test('ResearchProof AI — Phase 1 Comprehensive Security & Test Suite', async (t) => {

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

  // --- Test 0: Security Headers (COOP for Google Identity Services Popups) ---
  await t.test('0. Security Headers: Cross-Origin-Opener-Policy allows Google Sign-In popups', async () => {
    const configRes = await api('/api/auth/config');
    assert.equal(configRes.status, 200);
    const coop = configRes.headers.get('cross-origin-opener-policy');
    assert.equal(coop, 'same-origin-allow-popups', 'COOP must be same-origin-allow-popups so Google OAuth popups can communicate');
    const corp = configRes.headers.get('cross-origin-resource-policy');
    assert.equal(corp, 'cross-origin', 'CORP must be cross-origin so external Google user avatar pictures can be loaded');
  });

  // --- Turnstile Mock & Verification Harness ---
  const validTurnstileToken = 'VALID_TURNSTILE_TOKEN_123';
  const usedTurnstileTokens = new Set();
  setTurnstileVerifier(async (token) => {
    if (!token) return { success: false, error: 'Missing security verification token.', code: 'MISSING_TOKEN' };
    if (usedTurnstileTokens.has(token)) return { success: false, error: 'Security verification token has already been used.', code: 'REUSED_TOKEN' };
    if (token === 'EXPIRED_TURNSTILE_TOKEN') return { success: false, error: 'Security challenge expired.', code: 'EXPIRED_OR_DUPLICATE' };
    if (token === 'INVALID_TURNSTILE_TOKEN') return { success: false, error: 'Invalid security verification token.', code: 'INVALID_TOKEN' };
    if (token === validTurnstileToken || token === '1x00000000000000000000AA') {
      usedTurnstileTokens.add(token);
      return { success: true, hostname: '127.0.0.1' };
    }
    return { success: false, error: 'Verification failed.', code: 'VERIFICATION_FAILED' };
  });

  // --- Test 1a: Missing Turnstile Token Rejection ---
  await t.test('1a. Bot Protection: Registration rejects missing Turnstile token', async () => {
    const res = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: `bot-${Date.now()}@test.edu`, password: 'StrongPassword123!' })
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'MISSING_TOKEN');
    assert.equal(res.body.requiresTurnstile, true);
  });

  // --- Test 1b: Invalid Turnstile Token Rejection ---
  await t.test('1b. Bot Protection: Registration rejects invalid Turnstile token', async () => {
    const res = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: `bot-${Date.now()}@test.edu`, password: 'StrongPassword123!', turnstileToken: 'INVALID_TURNSTILE_TOKEN' })
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'INVALID_TOKEN');
  });

  // --- Test 1c: Expired Turnstile Token Rejection ---
  await t.test('1c. Bot Protection: Registration rejects expired Turnstile token', async () => {
    const res = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: `bot-${Date.now()}@test.edu`, password: 'StrongPassword123!', turnstileToken: 'EXPIRED_TURNSTILE_TOKEN' })
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'EXPIRED_OR_DUPLICATE');
  });

  // --- Test 1d: Reused Turnstile Token Rejection (Replay Protection) ---
  await t.test('1d. Bot Protection: Registration rejects reused Turnstile token (Replay Protection)', async () => {
    const freshToken = `REPLAY_TOKEN_${Date.now()}`;
    usedTurnstileTokens.add(freshToken); // Mark as already used
    const res = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: `bot-${Date.now()}@test.edu`, password: 'StrongPassword123!', turnstileToken: freshToken })
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'REUSED_TOKEN');
  });

  // --- Test 1e: Password Registration & Login Regression ---
  let emailUserToken = '';
  let emailUserId = '';
  const email = `author-${Date.now()}@university.edu`;
  const password = 'StrongPassword123!';

  await t.test('1e. Existing email/password authentication (registration & login regression)', async () => {
    // Register with valid Turnstile token
    const regRes = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, turnstileToken: '1x00000000000000000000AA' })
    });
    assert.equal(regRes.status, 201, 'Registration should return 201 Created');
    assert.ok(regRes.body.token, 'Should return JWT token');
    assert.equal(regRes.body.user.email, email);
    emailUserToken = regRes.body.token;
    emailUserId = regRes.body.user.id;

    // Login without Turnstile (normal zero-friction researcher login)
    const loginRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    assert.equal(loginRes.status, 200, 'Normal login should return 200 OK without Turnstile challenge');
    assert.ok(loginRes.body.token, 'Should return JWT token');
    assert.equal(loginRes.body.user.email, email);
    assert.equal(loginRes.body.user.passwordHash, undefined, 'Password hash must never be returned');
  });

  // --- Test 1f: Risk-Based Login Verification ---
  await t.test('1f. Risk-Based Bot Protection: Repeated failed logins trigger Turnstile requirement', async () => {
    const attackEmail = `target-${Date.now()}@university.edu`;

    // 1. Fail login 3 times
    for (let i = 0; i < 3; i++) {
      const failRes = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: attackEmail, password: 'WrongPassword123!' })
      });
      assert.equal(failRes.status, 401);
    }

    // 2. 4th attempt without Turnstile is rejected with 403 Forbidden (Turnstile Required)
    const blockedRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: attackEmail, password: 'WrongPassword123!' })
    });
    assert.equal(blockedRes.status, 403, 'Should return 403 Forbidden when risk threshold is met');
    assert.equal(blockedRes.body.requiresTurnstile, true);
    assert.ok(blockedRes.body.siteKey, 'Should provide siteKey for frontend widget initialization');
  });

  // --- Test 2: First-time Google Registration ---
  const googleId1 = `google-sub-${Date.now()}`;
  const googleEmail1 = `scholar-${Date.now()}@googlemail.com`;
  let googleUserToken = '';
  let googleSessionCookie = '';

  await t.test('2. First-time Google registration', async () => {
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
    assert.ok(res.body.user.authProviders?.includes('google'), 'Provider list must contain google');
    assert.equal(res.body.user.passwordHash, undefined, 'Password hash must never be returned');

    googleUserToken = res.body.token;
    googleSessionCookie = getCookie(res.headers);
    assert.ok(googleSessionCookie.includes('rp_session='), 'HttpOnly session cookie should be set');
  });

  // --- Test 2b: OAuth 2.0 Redirect Start Flow (/api/auth/google/start) ---
  await t.test('2b. OAuth 2.0 Redirect Start: constructs secure Google authorization URL with PKCE & state', async () => {
    const res = await fetch(`${baseUrl}/api/auth/google/start?return_to=${encodeURIComponent('http://localhost:5173')}`, {
      redirect: 'manual'
    });
    assert.equal(res.status, 302, 'Should return HTTP 302 Found redirect');
    const location = res.headers.get('location');
    assert.ok(location, 'Must provide Location header for redirect');
    assert.ok(location.startsWith('https://accounts.google.com/o/oauth2/v2/auth'), 'Target must be Google OAuth authorization endpoint');

    const authUrl = new URL(location);
    assert.ok(authUrl.searchParams.get('client_id'), 'Must include client_id');
    assert.equal(authUrl.searchParams.get('response_type'), 'code', 'Must request authorization code');
    assert.equal(authUrl.searchParams.get('scope'), 'openid email profile');
    assert.ok(authUrl.searchParams.get('state'), 'Must include cryptographically random state');
    assert.ok(authUrl.searchParams.get('code_challenge'), 'Must include PKCE code_challenge');
    assert.equal(authUrl.searchParams.get('code_challenge_method'), 'S256', 'Must enforce S256 PKCE');
    assert.ok(authUrl.searchParams.get('redirect_uri').includes('/api/auth/google/callback'), 'Callback URI must route to /api/auth/google/callback');

    // Check cookies set
    const rawCookie = res.headers.get('set-cookie') || '';
    assert.ok(rawCookie.includes('rp_oauth_state='), 'Sets HttpOnly state cookie');
    assert.ok(rawCookie.includes('rp_oauth_verifier='), 'Sets HttpOnly PKCE verifier cookie');
  });

  // --- Test 2c: OAuth 2.0 Redirect Callback (/api/auth/google/callback) - CSRF / State protection ---
  await t.test('2c. OAuth 2.0 Redirect Callback: rejects invalid or mismatched state', async () => {
    const res = await fetch(`${baseUrl}/api/auth/google/callback?code=fake_code&state=mismatched_state`, {
      redirect: 'manual'
    });
    assert.equal(res.status, 302, 'Should redirect with error');
    const redirectUrl = new URL(res.headers.get('location') || '', baseUrl);
    assert.ok(redirectUrl.searchParams.get('auth_error'), 'Must return auth_error parameter on state mismatch');
    assert.ok(!redirectUrl.searchParams.get('token'), 'Must NEVER put JWT in URL parameters');
  });

  // --- Test 3: Returning Google User Login ---
  await t.test('3. Returning Google user login', async () => {
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

  // --- Test 4: Invalid Google Token ---
  await t.test('4. Invalid Google token rejection', async () => {
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

  // --- Test 5: Expired Google Token ---
  await t.test('5. Expired Google token rejection', async () => {
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

  // --- Test 6: Incorrect OAuth Audience ---
  await t.test('6. Incorrect OAuth audience rejection', async () => {
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

  // --- Test 7: Unverified Google Email Rejection ---
  await t.test('7. Unverified Google email rejection', async () => {
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

  // --- Test 8: Blocked / Suspended User Access ---
  await t.test('8. Blocked / Suspended user rejection', async () => {
    const suspendedEmail = `suspended-${Date.now()}@dept.org`;
    const reg = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: suspendedEmail, password: 'StrongPassword123!' })
    });
    assert.equal(reg.status, 201);

    // Mark suspended in app.locals.memUsers
    const memUser = app.locals.memUsers?.get(suspendedEmail);
    if (memUser) memUser.status = 'suspended';

    // Attempt login with suspended account
    const loginRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: suspendedEmail, password: 'StrongPassword123!' })
    });
    assert.equal(loginRes.status, 403, 'Suspended user login should be rejected with 403');
  });

  // --- Test 9: Strict Account Linking Rule (No Silent Merging) ---
  const unlinkedEmail = `unlinked-${Date.now()}@university.edu`;
  await t.test('9. Strict account-linking rule (rejection of silent merge)', async () => {
    // 1. Create password account
    const regRes = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: unlinkedEmail, password: 'Password12345!' })
    });
    assert.equal(regRes.status, 201);

    // 2. Attempt Google login with matching email on unlinked password account
    setGoogleTokenVerifier(async () => ({
      googleId: `google-unlinked-${Date.now()}`,
      email: unlinkedEmail,
      displayName: 'Unlinked Researcher',
      avatarUrl: 'https://lh3.googleusercontent.com/avatar.png',
      emailVerified: true
    }));

    const googleRes = await api('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential: 'UNLINKED_GOOGLE_CREDENTIAL' })
    });

    // Must return 409 Conflict with code ACCOUNT_LINKING_REQUIRED
    assert.equal(googleRes.status, 409, 'Must NOT silently merge; must return 409 Conflict');
    assert.equal(googleRes.body.code, 'ACCOUNT_LINKING_REQUIRED');
  });

  // --- Test 10: Authenticated Account Linking via POST /api/auth/link-google ---
  await t.test('10. Secure account linking after authenticating to existing account', async () => {
    // 1. Authenticate with password
    const loginRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: unlinkedEmail, password: 'Password12345!' })
    });
    assert.equal(loginRes.status, 200);
    const authToken = loginRes.body.token;

    // 2. Link Google account while authenticated
    setGoogleTokenVerifier(async () => ({
      googleId: `google-linked-${Date.now()}`,
      email: unlinkedEmail,
      displayName: 'Linked Researcher',
      avatarUrl: 'https://lh3.googleusercontent.com/avatar.png',
      emailVerified: true
    }));

    const linkRes = await api('/api/auth/link-google', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ credential: 'VERIFIED_LINK_TOKEN' })
    });

    assert.equal(linkRes.status, 200, 'Authenticated linking should succeed with 200 OK');
    assert.ok(linkRes.body.user.authProviders.includes('google'), 'User should now have google provider');
  });

  // --- Test 11: Server-Side Session Invalidation on Logout ---
  await t.test('11. Server-side session invalidation on logout', async () => {
    // Login to obtain a fresh token
    const loginRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    assert.equal(loginRes.status, 200);
    const activeToken = loginRes.body.token;

    // Verify token works
    const checkBefore = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${activeToken}` }
    });
    assert.equal(checkBefore.status, 200);

    // Call logout endpoint with token
    const logoutRes = await api('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${activeToken}` }
    });
    assert.equal(logoutRes.status, 200);

    // Subsequent call with the old token MUST be rejected server-side
    const checkAfter = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${activeToken}` }
    });
    assert.equal(checkAfter.status, 401, 'Old token must be rejected server-side after logout');
    assert.match(checkAfter.body.error, /invalidated|expired/i);
  });

  // --- Test 12: Protected API Access and Authorization ---
  await t.test('12. Protected API access (/api/auth/me, Bearer vs Cookie)', async () => {
    // Unauthenticated
    const unauth = await api('/api/auth/me');
    assert.equal(unauth.status, 401, 'Unauthenticated request should return 401');

    // Authenticated via Google user token
    const authed = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${googleUserToken}` }
    });
    assert.equal(authed.status, 200);
    assert.equal(authed.body.user.email, googleEmail1);

    // Authenticated via session cookie
    const cookieAuthed = await api('/api/auth/me', {
      headers: { Cookie: googleSessionCookie }
    });
    assert.equal(cookieAuthed.status, 200);
    assert.equal(cookieAuthed.body.user.email, googleEmail1);
  });

  // --- Test 13: Cross-User Project Access Prevention ---
  await t.test('13. Cross-user project access prevention', async () => {
    // Google user creates project
    const projRes = await api('/api/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${googleUserToken}` },
      body: JSON.stringify({ title: 'Google User Confidential Thesis' })
    });
    assert.equal(projRes.status, 201);
    const projId = projRes.body._id;

    // Login email user again to get a valid token
    const emailLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    const currentEmailToken = emailLogin.body.token;

    // Email user attempts to delete Google user's project
    const deleteRes = await api(`/api/projects/${projId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${currentEmailToken}` }
    });
    assert.equal(deleteRes.status, 404, 'Cross-user deletion must be rejected with 404');
  });

  // --- Test 14: Free Usage Endpoint (/api/usage/me) ---
  await t.test('14. Free usage status API (/api/usage/me)', async () => {
    const usageRes = await api('/api/usage/me', {
      headers: { Authorization: `Bearer ${googleUserToken}` }
    });

    assert.equal(usageRes.status, 200);
    assert.ok(usageRes.body.rewrite, 'Must include rewrite quota');
    assert.ok(usageRes.body.analysis, 'Must include analysis quota');
    const rawLimit = String(process.env.FREE_REWRITE_DAILY_LIMIT || '5').trim().toLowerCase();
    const isUnlimited = rawLimit === '0' || rawLimit === '-1' || rawLimit === 'unlimited' || Number(rawLimit) >= 999999;
    const expectedRewriteLimit = isUnlimited ? 'Unlimited' : Number(rawLimit || 5);
    assert.equal(usageRes.body.rewrite.limit, expectedRewriteLimit, `Rewrite daily limit should match configured limit (${expectedRewriteLimit})`);
    const expectedRewriteWords = Number(process.env.FREE_REWRITE_MAX_WORDS || 2000);
    const expectedAnalysisWords = Number(process.env.FREE_ANALYSIS_MAX_WORDS || 5000);
    const rawAnalysisLimit = String(process.env.FREE_ANALYSIS_DAILY_LIMIT || '10').trim().toLowerCase();
    const isAnalysisUnlimited = rawAnalysisLimit === '0' || rawAnalysisLimit === '-1' || rawAnalysisLimit === 'unlimited' || Number(rawAnalysisLimit) >= 999999;
    const expectedAnalysisLimit = isAnalysisUnlimited ? 'Unlimited' : Number(rawAnalysisLimit || 10);
    assert.equal(usageRes.body.analysis.limit, expectedAnalysisLimit, `Analysis daily limit should match configured limit (${expectedAnalysisLimit})`);
    assert.equal(usageRes.body.analysis.maxWords, expectedAnalysisWords, `Analysis max words should match configured limit (${expectedAnalysisWords})`);
    assert.ok(usageRes.body.resetAt, 'Must include reset timing');
  });

  // --- Test 15: Word Count Limit Enforcement ---
  await t.test('15. Word count limit enforcement (> analysis limit words rejected for analysis)', async () => {
    const analysisLimit = Number(process.env.FREE_ANALYSIS_MAX_WORDS || 5000);
    const excessiveText = Array(analysisLimit + 5).fill('academic').join(' ');

    const analysisRes = await api('/api/analyze/writing', {
      method: 'POST',
      headers: { Authorization: `Bearer ${googleUserToken}` },
      body: JSON.stringify({ text: excessiveText })
    });

    assert.equal(analysisRes.status, 400, `Word count > ${analysisLimit} must be rejected with 400 Bad Request`);
    assert.match(analysisRes.body.error, new RegExp(`exceeds the analysis limit of ${analysisLimit} words`, 'i'));
  });

  // --- Test 16: AI Unavailable Resilience (503 without consuming quota) ---
  await t.test('16. AI unavailable response (503) without consuming quota when AI key unconfigured', async () => {
    const originalAiKey = process.env.AI_API_KEY;
    const originalReverseKey = process.env.REVERSEGPT_API_KEY;
    delete process.env.AI_API_KEY;
    delete process.env.REVERSEGPT_API_KEY;

    try {
      const rewriteRes = await api('/api/humanize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${googleUserToken}` },
        body: JSON.stringify({ text: 'This manuscript explores quantum coherence in molecular systems.' })
      });

      assert.equal(rewriteRes.status, 503, 'Must return 503 Service Unavailable when AI key is missing');
      assert.equal(rewriteRes.body.code, 'AI_UNAVAILABLE');

      // Check that quota was NOT consumed
      const usageCheck = await api('/api/usage/me', {
        headers: { Authorization: `Bearer ${googleUserToken}` }
      });
      assert.equal(usageCheck.body.rewrite.used, 0, 'Quota must not be consumed when AI provider is unavailable');
    } finally {
      if (originalAiKey) process.env.AI_API_KEY = originalAiKey;
      if (originalReverseKey) process.env.REVERSEGPT_API_KEY = originalReverseKey;
    }
  });

  // --- Test 17: Non-AI Writing Checks Work Flawlessly ---
  await t.test('17. Non-AI academic writing checks work without an AI key', async () => {
    const text = 'The experiment was performed by the team. This demonstrates clear statistical significance.';

    // Writing assessment
    const assessRes = await api('/api/analyze/writing', {
      method: 'POST',
      headers: { Authorization: `Bearer ${googleUserToken}` },
      body: JSON.stringify({ text })
    });
    assert.equal(assessRes.status, 200, 'Writing assessment should return 200 OK');
    assert.ok(assessRes.body.wordCount !== undefined, 'Should return word count');
    assert.ok(assessRes.body.observations, 'Should return style observations');

    // Similarity check (both /api/analyze/originality and /api/analyze/similarity with text or content)
    const simRes = await api('/api/analyze/originality', {
      method: 'POST',
      headers: { Authorization: `Bearer ${googleUserToken}` },
      body: JSON.stringify({ text })
    });
    assert.equal(simRes.status, 200, 'Originality check should return 200 OK');
    assert.equal(simRes.body.scope, 'Within-document phrase repetition only');
    assert.ok(simRes.body.wordCount !== undefined, 'Should return word count metric');

    // Similarity alias check with content payload
    const simAliasRes = await api('/api/analyze/similarity', {
      method: 'POST',
      headers: { Authorization: `Bearer ${googleUserToken}` },
      body: JSON.stringify({ content: text })
    });
    assert.equal(simAliasRes.status, 200, 'Similarity check alias should return 200 OK');
    assert.equal(simAliasRes.body.scope, 'Within-document phrase repetition only');
  });

  // --- Test 18: Missing Google Credential Validation ---
  await t.test('18. Empty Google credential validation', async () => {
    const emptyCred = await api('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({})
    });
    assert.equal(emptyCred.status, 400, 'Empty credential should be rejected with 400 Bad Request');
  });

  // --- Test 19: Health Check & Database Status ---
  await t.test('19. System health check (/api/health)', async () => {
    const health = await api('/api/health');
    assert.equal(health.status, 200);
    assert.ok(['connected', 'in-memory-fallback', 'in-memory-dev-store'].includes(health.body.database));
  });

  // --- Test 20: Production CORS and Cookie Behavior ---
  await t.test('20. CORS and Cookie credentials configuration', async () => {
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

  // --- Test 21: Public Auth Configuration Endpoint (/api/auth/config) ---
  await t.test('21. Public Auth Configuration Endpoint (/api/auth/config)', async () => {
    const configRes = await api('/api/auth/config');
    assert.equal(configRes.status, 200, 'Auth config should return 200 OK');
    assert.ok('googleConfigured' in configRes.body, 'Must include googleConfigured boolean flag');
    assert.ok('googleClientId' in configRes.body, 'Must include googleClientId');
    assert.ok(!('clientSecret' in configRes.body), 'Must never expose Google Client Secret');
  });

  // --- Test 22: Mismatched Email Rejection on Account Linking ---
  await t.test('22. Mismatched email rejection on account linking (/api/auth/link-google)', async () => {
    // Register user A
    const userAEmail = `user-a-${Date.now()}@university.edu`;
    const regRes = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: userAEmail, password: 'SecurePassword123!' })
    });
    assert.equal(regRes.status, 201);
    const userAToken = regRes.body.token;

    // Attempt to link a Google account with DIFFERENT email
    setGoogleTokenVerifier(async () => ({
      googleId: `google-diff-${Date.now()}`,
      email: `different-email-${Date.now()}@gmail.com`,
      displayName: 'Different User',
      avatarUrl: '',
      emailVerified: true
    }));

    const linkRes = await api('/api/auth/link-google', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ credential: 'MISMATCHED_EMAIL_TOKEN' })
    });

    assert.equal(linkRes.status, 400, 'Should reject mismatched email with 400 Bad Request');
    assert.match(linkRes.body.error, /does not match/i);
  });

  // --- Test 23: Duplicate Google Identity Conflict (409 Conflict) ---
  await t.test('23. Duplicate Google identity conflict rejection', async () => {
    const sharedGoogleId = `shared-google-${Date.now()}`;
    const userBEmail = `user-b-${Date.now()}@university.edu`;
    const userCEmail = `user-c-${Date.now()}@university.edu`;

    // 1. Register User B and link sharedGoogleId
    const regB = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: userBEmail, password: 'SecurePassword123!' })
    });
    assert.equal(regB.status, 201);
    const tokenB = regB.body.token;

    setGoogleTokenVerifier(async () => ({
      googleId: sharedGoogleId,
      email: userBEmail,
      displayName: 'User B',
      avatarUrl: '',
      emailVerified: true
    }));

    const linkB = await api('/api/auth/link-google', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ credential: 'TOKEN_B' })
    });
    assert.equal(linkB.status, 200, 'User B linking should succeed');

    // 2. Register User C
    const regC = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: userCEmail, password: 'SecurePassword123!' })
    });
    assert.equal(regC.status, 201);
    const tokenC = regC.body.token;

    // 3. User C attempts to link the SAME sharedGoogleId
    setGoogleTokenVerifier(async () => ({
      googleId: sharedGoogleId,
      email: userCEmail,
      displayName: 'User C',
      avatarUrl: '',
      emailVerified: true
    }));

    const linkC = await api('/api/auth/link-google', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenC}` },
      body: JSON.stringify({ credential: 'TOKEN_C' })
    });

    assert.equal(linkC.status, 409, 'Should reject duplicate Google ID linking with 409 Conflict');
    assert.match(linkC.body.error, /already linked/i);
  });

  // --- Test 24: Unauthenticated Account Linking Rejection (401) ---
  await t.test('24. Unauthenticated account linking rejection', async () => {
    const unauthLink = await api('/api/auth/link-google', {
      method: 'POST',
      body: JSON.stringify({ credential: 'SOME_TOKEN' })
    });
    assert.equal(unauthLink.status, 401, 'Should require authentication with 401');
  });

});
