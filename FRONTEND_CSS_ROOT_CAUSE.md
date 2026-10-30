# ResearchProof AI 1.0 — Frontend CSS Root Cause Analysis

**Document Version:** 1.0  
**Status:** Completed & Resolved  
**Scope:** Root cause investigation into frontend rendering anomalies, oversized gray cards, and login layout degradation.

---

## 1. Problem Statement

Screenshots from production and local instances revealed:
1. An unstyled, left-aligned login screen where labels, inputs, and buttons flowed horizontally across the viewport on a single line.
2. The Dashboard's 8 Unified Core Modules displaying as oversized, gray rectangular buttons without responsive grid columns or Linear visual hierarchy.
3. An account loading error displaying: `"User account not found or has been deleted."` upon application launch with stale credentials.

---

## 2. Root Cause Analysis

### Root Cause 1: Omission of Base Desktop Styles in `styles.css`
- **Mechanism**: During a previous CSS cleanup commit (`c072685`), base rule blocks for `.tool-grid`, `.tool-card`, `.tool-icon`, `.bottom-grid`, `.panel`, and `.project-grid` were inadvertently deleted from the top-level section of `client/src/styles.css`, leaving only their media-query overrides inside `@media (max-width: 1150px)` and `@media (max-width: 760px)`.
- **Impact**: Any desktop browser with a viewport width greater than `1150px` failed to match any media query for those selectors. Consequently, the browser applied standard user-agent default styles to `<button className="tool-card">` (native gray button background `#e9e9e9`, beveled borders, inline-block layout, unconstrained width).
- **Remediation**: Added authoritative desktop base rules directly preceding the responsive media queries in `client/src/styles.css` ensuring 4-column desktop grids, elevated white/dark card surfaces, 12px radii, and hover transitions.

### Root Cause 2: Entrypoint Stylesheet Decoupling in `App.tsx`
- **Mechanism**: `client/src/main.tsx` imported `./styles.css`, but `client/src/App.tsx` did not have an explicit stylesheet import. In development modes with Vite Hot Module Replacement (HMR) or when child modules dynamically imported subcomponents, `styles.css` could be detached or loaded out of order before component mounts.
- **Remediation**: Added explicit `import './styles.css';` directly at line 1 of `client/src/App.tsx`.

### Root Cause 3: Stale Credential Session Trap in `middleware.js` & `App.tsx`
- **Mechanism**: When running in in-memory dev mode or following a user database reset, a client with an existing JWT in `localStorage('rp_token')` or HTTP-only cookies made requests to `/api/auth/me` or `/api/projects`.
  1. `requireAuth` in `server/src/middleware.js` verified the JWT signature successfully, but failed the database/memory user lookup (`!user`).
  2. The server responded with HTTP 401 `{ error: 'User account not found or has been deleted.' }` without clearing the HTTP-only cookies (`rp_token` and `researchproof_session`).
  3. On the frontend, `initAuth()` and `request()` trapped the user on an error state rather than clearing `localStorage.removeItem('rp_token')` and cleanly transitioning `authState` to `'unauthenticated'`.
- **Remediation**:
  1. `server/src/middleware.js` now issues `res.clearCookie()` for all session cookies whenever a user record is missing or marked deleted.
  2. `server/src/index.js` `/api/auth/me` now clears cookies on 404 user lookups.
  3. `client/src/App.tsx` `request()` and `initAuth()` automatically purge stale tokens and reset auth state to `'unauthenticated'` with clean error notices.

---

## 3. Verification & Resolution Checklist

- [x] Verified base `.tool-grid` and `.tool-card` render with 4 columns on viewports >1150px.
- [x] Verified `.tool-icon` tone classes (`blue`, `green`, `purple`, `amber`, `rose`) provide distinct, high-contrast badges.
- [x] Verified login form renders centered 440px card with vertically stacked inputs and clear labels.
- [x] Verified stale token in `localStorage` automatically purges and redirects to clean login screen.
- [x] Verified client production build passes (`npm run build --prefix client`).
- [x] Verified 81/81 regression tests pass (`node --test ...`).
