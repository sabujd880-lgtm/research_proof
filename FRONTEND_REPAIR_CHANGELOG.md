# ResearchProof AI 1.0 — Frontend Repair Changelog

**Release:** Critical UI/UX Repair & Authentication Stabilization  
**Date:** October 30, 2026  
**Target:** Linear-Inspired Minimal Enterprise Experience  

---

## Changes by Component & File

### 1. `client/src/styles.css`
- **Dashboard & Core Modules Base Styles**:
  - Added `.welcome-row`, `.page-title-row`, and `.section-heading` flex alignment.
  - Added `.eyebrow` uppercase 10px bold accent typography.
  - Added `.stats-grid` 4-column base grid and `.stat-card` elevated surface tokens.
  - Added `.tool-grid` with `grid-template-columns: repeat(4, minmax(0, 1fr))` for viewports >1150px.
  - Added `.tool-card` elevated flex card, rounded corners (`12px`), smooth hover transform (`translateY(-2px)`), and accent border focus.
  - Added `.tool-icon` and color tone variants (`.blue`, `.green`, `.purple`, `.amber`, `.rose`) with dark mode support.
  - Added `.bottom-grid` 2-column layout and `.panel` container styles.
  - Added `.list-row`, `.mini-icon`, `.list-main`, and `.row-arrow` hover interactions.
  - Added `.project-grid`, `.project-card`, `.empty-projects`, and `.project-form` styles.
- **Authentication & Login Screen**:
  - Preserved `.auth-page` centered flex container.
  - Reinforced `.auth-card` 440px max-width, elevated drop shadow, and padding.
  - Reinforced `.auth-form` vertical stack with 16px gap and full-width input controls.
  - Reinforced `.alert`, `.alert.error`, `.alert.info`, and `.alert.success` styling.

### 2. `client/src/App.tsx`
- **Stylesheet Import**: Added `import './styles.css';` at line 1.
- **Request Error Interception**: In `request()`, intercepted HTTP 401 responses to automatically purge `localStorage.removeItem('rp_token')`.
- **Authentication State Machine**: In `initAuth()`, ensured missing/deleted account errors gracefully transition to `'unauthenticated'` and replace harsh error messages with informative session expiration notices.

### 3. `server/src/middleware.js`
- **Session Cookie Invalidation**: In `requireAuth`, when a token lookup fails because the user was deleted or no longer exists in MongoDB/memUsers, now executes `res.clearCookie('rp_token')`, `res.clearCookie('researchproof_session')`, and `res.clearCookie('rp_session')` before sending HTTP 401.

### 4. `server/src/index.js`
- **Profile Endpoint Invalidation**: In `/api/auth/me`, added cookie clearance on 404 lookup failure to prevent orphaned client sessions.
