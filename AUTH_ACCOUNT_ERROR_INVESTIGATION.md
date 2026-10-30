# ResearchProof AI 1.0 — Authentication Account Error Investigation

**Date:** October 30, 2026  
**Issue:** `"User account not found or has been deleted."` preventing application access  
**Severity:** High (Access Blocker)  
**Status:** Remediated & Verified  

---

## 1. Problem Description

When users opened `http://localhost:5173` or navigated to the application with stale browser cookies or a token from a previously wiped in-memory session, the UI displayed:
`"User account not found or has been deleted."` in a red alert banner, preventing clean entry into the login or registration workflow.

---

## 2. Technical Investigation

1. **Authentication Architecture**:
   - The frontend persists the active JWT in `localStorage('rp_token')` as well as HTTP-only cookies (`rp_token` and `researchproof_session`).
   - On application mount, `initAuth()` executes `GET /api/auth/me`.
2. **Server Execution Path (`requireAuth`)**:
   - `jwt.verify(token, secret)` succeeds because the JWT signature remains cryptographically valid.
   - However, the server checks whether the user ID exists in the database:
     ```javascript
     const user = await User.findById(decoded.id);
     // or
     const user = req.app.locals.memUsers.get(decoded.email);
     ```
   - If the in-memory store was reset upon server restart or the user was deleted, `user` evaluated to `null`.
   - The middleware returned:
     ```json
     HTTP 401 Unauthorized
     { "error": "User account not found or has been deleted." }
     ```
3. **Frontend Failure to Purge**:
   - The server response did not include `Set-Cookie: ... Max-Age=0` headers to clear the stale cookie.
   - The frontend preserved the stale token in state and displayed the raw error message without resetting `authState` to `'unauthenticated'`.

---

## 3. Implemented Fix

1. **Server Cookie Clearance (`server/src/middleware.js`)**:
   ```javascript
   if (!user || user.status === 'deleted') {
     res.clearCookie('rp_token');
     res.clearCookie('researchproof_session');
     res.clearCookie('rp_session');
     return res.status(401).json({ error: 'User account not found or has been deleted.' });
   }
   ```
2. **Client State Reset (`client/src/App.tsx`)**:
   - In `initAuth()`:
     ```typescript
     if (!meRes.ok) {
       localStorage.removeItem('rp_token');
       setUser(null);
       setToken('');
       setAuthState('unauthenticated');
       setAuthError('');
     }
     ```
   - In `request()`:
     ```typescript
     if (response.status === 401 && typeof window !== 'undefined') {
       localStorage.removeItem('rp_token');
     }
     ```
   - URL error interception sanitizes `"not found"` or `"deleted"` messages to:
     `"Your previous session has expired. Please sign in or create an account."`

---

## 4. Verification

- Tested stale token in `localStorage`: Automatically purged, user presented with pristine login form.
- Tested deleted user account: Returns 401, clears cookies, redirects to sign-in.
- Tested fresh login & registration: 81/81 test suite passed.
