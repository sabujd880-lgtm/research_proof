# ResearchProof AI 1.0 — Architecture Audit

**Date:** October 29, 2026  
**Auditor:** Principal Full-Stack & Systems Debugging Engineer  
**Repository:** [https://github.com/sabujd880-lgtm/research_proof](https://github.com/sabujd880-lgtm/research_proof)  
**Production URL:** [https://research-proof-1.onrender.com](https://research-proof-1.onrender.com)  
**Branch:** `main` (Latest Commit: `48d2ad2`)

---

## 1. Executive Summary

ResearchProof AI is an all-in-one academic research and scientific writing platform designed for researchers, authors, and academic institutions. The platform combines core research discovery and execution workflows (Project Management, Reference Management, Literature Review, PDF Grounded Chat, Statistical Analysis, Systematic Reviews, Journal Submission, and Research Collaboration) with existing AI rewriting, research integrity scanning, and publication formatting tools.

This audit evaluates the codebase's current architectural health, identifies stabilized components, catalogs API contracts, details database schemas, and outlines the precise migration path to the complete 1.0 architecture.

---

## 2. Technology Stack & Runtime Topology

| Layer | Technology | Current Version / Config | Notes |
|---|---|---|---|
| **Frontend Framework** | React + Vite + TypeScript | React 18, Vite 6.4, TypeScript 5.8 | SPA running in client/ |
| **Styling & Icons** | Vanilla CSS + Lucide Icons | Manrope font, Lucide React icons | Custom design system with full Light/Dark mode |
| **Authentication Client**| Google OAuth + JWT Session | `@react-oauth/google`, Cloudflare Turnstile | Supports popup OAuth, full redirect, email/password |
| **Backend Runtime** | Node.js + Express (ES Modules)| Node 20+, Express 4.21, Mongoose 8.9 | Dual-prefixed `/api` and `/api/v1` |
| **Database** | MongoDB Atlas / In-Memory | Mongoose ODM + local memory fallback | Replica set with multi-shard DNS support |
| **Security & Middleware**| Helmet, CORS, Rate Limit, Multer| Cookie-parser, Zod schema validation | HttpOnly cookies with SameSite lax/strict |
| **Export Formats** | Docx, Adm-Zip, Custom LaTeX | `docx` v9.14, `mammoth` v1.13 | In-memory stream generation; no disk pollution |
| **Hosting (Backend)** | Render Web Service | Service `srv-dbdm41t9fdbs73bjtlmg` | Ephemeral container listening on `0.0.0.0:$PORT` |
| **Hosting (Frontend)** | Vercel Static Web App | Rewrites to `/index.html` via `vercel.json` | Global edge distribution |

---

## 3. Repository Structure & Code Organization

```
research_proof/
├── client/                     # Frontend SPA workspace
│   ├── index.html              # HTML shell with viewport, fonts, and meta theme-color
│   ├── package.json            # Vite, React, Lucide, React OAuth dependencies
│   ├── tsconfig.json           # Strict TypeScript configuration
│   ├── vite.config.ts          # Vite build config with port 5173 and proxy
│   └── src/
│       ├── App.tsx             # Central application component with navigation & modules
│       ├── main.tsx            # React root mount point
│       ├── styles.css          # Unified CSS tokens, responsive layout, dark theme
│       └── vite-env.d.ts       # Global typings and Turnstile window definitions
├── server/                     # Backend API service
│   ├── package.json            # Node.js dependencies (express, mongoose, docx, etc.)
│   ├── src/
│   │   ├── index.js            # Express router, authentication, controller routes
│   │   ├── models.js           # Mongoose schemas for Users, Projects, Docs, etc.
│   │   ├── turnstileService.js # Cloudflare Turnstile token validation & risk tracking
│   │   ├── textGuardService.js # Plagiarism, similarity, and bot-challenge detector
│   │   ├── citationService.js  # Crossref DOI metadata lookup and citation formatter
│   │   ├── apa7Converter.js    # APA 7 manuscript formatting & conversion rules
│   │   ├── docxService.js      # Word .docx binary generation from structured AST
│   │   ├── pdfReportService.js # Downloadable PDF audit report compilation
│   │   ├── latexCompiler.js    # Modular LaTeX apa7 package generation
│   │   ├── dossierService.js   # Cryptographic thesis verification dossier compiler
│   │   ├── analyticsService.js # Platform usage aggregation and audit tracking
│   │   └── multilingualRegistry.js # Multilingual academic dictionary and rules
│   └── test/                   # Automated test suites (Node.js test runner)
│       ├── system_audit_regression.test.js # Core regression suite (31 tests)
│       ├── auth.test.js        # Auth, Google OAuth, and Turnstile suite (25 suites)
│       ├── phase2.test.js      # Document import/export and citation tests
│       ├── phase3.test.js      # Analytics, audit log, and deletion tests
│       ├── phase5.test.js      # LaTeX apa7 generation tests
│       └── textguard_full.test.js # Plagiarism & bot challenge recognition tests
└── docs/                       # Architectural documentation and guides
```

---

## 4. Phase A Stabilization Audit (Verified Fixes)

Before initiating Phase B, all historical blockers were inspected, resolved, and verified:

1. **Production 502 Bad Gateway (`x-render-routing: no-deploy`)**:
   - **Root Cause**: Synchronous `process.exit(1)` invocations inside `validateStartupConfiguration()` killed the Express process during boot whenever MongoDB was cold or unconfigured, and `app.listen` failed to explicitly bind to `0.0.0.0`.
   - **Fix Implemented**: Server bound explicitly to `0.0.0.0:${port}`, `process.exit(1)` replaced with non-fatal diagnostics, unhandled rejections trapped, and database disconnections gracefully return `503 Service Unavailable` on database operations while keeping health and OAuth routes operational.
2. **Registration Security Verification Token Error**:
   - **Root Cause**: The backend required `turnstileToken` whenever `isTurnstileEnabled()` returned true, but the frontend had no Turnstile challenge widget or token submission logic.
   - **Fix Implemented**: Built `TurnstileWidget` in `client/src/App.tsx` with dynamic Cloudflare script loading, theme sync, and reset handlers; updated `isTurnstileEnabled()` on the backend to activate only when explicitly set to `true` with a valid site key; enabled seamless registration without a token when Turnstile is disabled.
3. **Mongoose Schema CastError on `"Unlimited"`**:
   - **Root Cause**: `userSchema.usage.dailyLimit` was typed as `{ type: Number }`. In unlimited mode, `"Unlimited"` caused a Mongoose cast failure on `User.create`.
   - **Fix Implemented**: Changed `dailyLimit` to `mongoose.Schema.Types.Mixed`, permitting numerical and string tiers.
4. **Vite TypeScript Build Failures**:
   - Resolved `vite/client` type definitions and window extensions in `client/src/vite-env.d.ts`. `tsc -b && vite build` now completes with 0 errors.

---

## 5. Database Schema Status & Gap Analysis

### 5.1 Existing Models (`server/src/models.js`)
- `User`: Identity, passwordHash, Google OAuth, roles (`researcher`, `reviewer`, `admin`), preferences, usage quotas.
- `Project`: Project container (`title`, `discipline`, `documentType`, `userId`).
- `Document`: Academic manuscript (`title`, `content`, `wordCount`, `version`, `projectId`).
- `Revision`: Diff tracking (`originalText`, `revisedText`, `proposedText`, `meaningWarnings`).
- `Citation` / `DoiCache`: Scholarly bibliographic references, Crossref DOI cache.
- `IntegrityReport`: Originality and plagiarism review summaries.
- `LatexJob`: APA 7 conversion jobs and file manifests.
- `TextGuardScan`: Multi-source similarity and bot challenge detection.
- `AuditEvent`: Security and user action audit log.
- `UsageRecord` / `UsageEvent` / `DailyUsageAggregate`: Usage metrics and rate limiting.
- `DataDeletionJob`: GDPR/privacy compliant user data purging.

### 5.2 Required Models for 1.0 Full Blueprint
To support the 8 unified research modules, the following schemas are scheduled for implementation:
- `ProjectMember`: User role bindings (`owner`, `editor`, `reviewer`, `viewer`), permissions, invitations.
- `DocumentVersion`: Immutable point-in-time snapshots of project manuscripts.
- `LiteratureEntry` & `EvidenceExtract`: Extracted literature evidence, methodology matrices, and thematic clusters.
- `DocumentChunk` & `ResearchChat`: Vector/text chunk indexing and conversational grounded QA over PDFs.
- `Dataset` & `Analysis`: Tabular research data schema, variables, statistical computation logs, and run history.
- `SystematicReview` & `ScreeningDecision`: PRISMA screening flow, inclusion/exclusion criteria, dual-reviewer votes.
- `JournalProfile` & `JournalSubmission`: Journal compliance profiles, checklist verification, package manifests.
- `Task` & `Comment`: Threaded manuscript annotations and project milestone tasks.

---

## 6. Authentication & Authorization Architecture

- **Session Mechanics**:
  - JWT tokens issued upon successful registration, login, or Google OAuth code exchange.
  - Dual delivery: Sent in JSON body for localStorage/Bearer header and as an `HttpOnly`, `SameSite=Lax`, `Secure` cookie (`rp_session`).
  - Cryptographic token version tracking in MongoDB enables immediate server-side revocation on logout or account compromise.
- **Google OAuth 2.0 Flow**:
  - Full-page redirect via `/api/auth/google/start` with cryptographic state and PKCE (`code_challenge` / `code_verifier`).
  - Callback processing at `/api/auth/google/callback` with dual-route alias `/auth/google/callback`.
  - Non-blocking error handling returning user-friendly redirect messages on OAuth denial or domain restrictions.
- **Rate Limiting & Abuse Prevention**:
  - `express-rate-limit` configured on `/api/auth/*` endpoints (30 requests/15 minutes per IP).
  - Risk-based login tracking: 3 consecutive failed logins trigger Turnstile verification requirement for subsequent attempts.

---

## 7. Next Steps & Target Milestones

1. Complete `FEATURE_INVENTORY.md` detailing every current and target feature.
2. Advance to **Phase B: Unified Workspace & Permissions**:
   - Implement project-scoped data modeling (`ProjectMember`, `Task`, shared project switcher).
   - Refactor navigation to reflect the canonical ResearchProof AI 1.0 sidebar structure.
3. Advance through Phases C through H in structured, test-verified increments.
