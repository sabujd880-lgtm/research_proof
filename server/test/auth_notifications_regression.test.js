import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { app } from '../src/index.js';
import { requireAuth, clearAuthCookies } from '../src/middleware.js';

let server;
let baseUrl;

const JWT_SECRET = process.env.JWT_SECRET || 'researchproof-super-secure-jwt-secret-key-32chars';

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

test('ResearchProof AI — Auth & Notification Regression Test Suite', async (t) => {

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

  await t.test('1. Stale token for non-existent user returns 401 with ACCOUNT_NOT_FOUND and clears session cookies', async () => {
    const fakeToken = jwt.sign(
      { id: 'nonexistent-user-id-999999', email: 'ghost@nowhere.com', tokenVersion: 1 },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await api('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${fakeToken}`
      }
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.error, 'User account not found or has been deleted.');
    assert.equal(res.body.code, 'ACCOUNT_NOT_FOUND');

    // Verify Set-Cookie header clearing cookies
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Expected set-cookie header clearing invalid session');
    assert.ok(setCookie.includes('Max-Age=0') || setCookie.includes('Expires=Thu, 01 Jan 1970'), 'Cookie must be invalidated with Max-Age=0 or past date');
  });

  await t.test('2. Missing auth token returns 401 with AUTH_REQUIRED', async () => {
    const res = await api('/api/projects');
    assert.equal(res.status, 401);
    assert.equal(res.body.code, 'AUTH_REQUIRED');
  });

  await t.test('3. Expired token returns 401 with SESSION_EXPIRED and clears cookies', async () => {
    const expiredToken = jwt.sign(
      { id: 'expired-user', email: 'expired@test.com' },
      JWT_SECRET,
      { expiresIn: '-10s' }
    );

    const res = await api('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${expiredToken}`
      }
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.code, 'SESSION_EXPIRED');
    assert.ok(res.headers.get('set-cookie'), 'Must clear cookies on expired token');
  });

  await t.test('4. Valid token for demo researcher successfully accesses /auth/me', async () => {
    const loginRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'demo@researchproof.ai',
        password: 'Password1234!'
      })
    });

    assert.equal(loginRes.status, 200);
    assert.ok(loginRes.body.token);

    const meRes = await api('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${loginRes.body.token}`
      }
    });

    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.user.email, 'demo@researchproof.ai');
    assert.equal(meRes.body.user.role, 'researcher');
  });

  await t.test('5. Suspended user token returns 403 with ACCOUNT_SUSPENDED', async () => {
    // Register temporary user to suspend
    const email = `suspend-${Date.now()}@test.com`;
    const regRes = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: 'Password1234!',
        displayName: 'Suspended User'
      })
    });
    assert.equal(regRes.status, 201);
    const token = regRes.body.token;

    // Manually mark user as suspended in store
    if (mongoose.connection.readyState === 1) {
      await mongoose.model('User').updateOne({ email }, { $set: { status: 'suspended' } });
    } else {
      const u = app.locals.memUsers.get(email);
      if (u) u.status = 'suspended';
    }

    const testRes = await api('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    assert.equal(testRes.status, 403);
    assert.equal(testRes.body.code, 'ACCOUNT_SUSPENDED');
  });

  await t.test('6. Invalidation via tokenVersion increment rejects older token', async () => {
    const email = `tokenv-${Date.now()}@test.com`;
    const regRes = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: 'Password1234!',
        displayName: 'Token Version User'
      })
    });
    assert.equal(regRes.status, 201);
    const oldToken = regRes.body.token;

    // Increment tokenVersion in store
    if (mongoose.connection.readyState === 1) {
      await mongoose.model('User').updateOne({ email }, { $inc: { tokenVersion: 1 } });
    } else {
      const u = app.locals.memUsers.get(email);
      if (u) u.tokenVersion = (u.tokenVersion || 1) + 1;
    }

    const testRes = await api('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${oldToken}`
      }
    });

    assert.equal(testRes.status, 401);
    assert.equal(testRes.body.code, 'SESSION_INVALIDATED');
  });
});
