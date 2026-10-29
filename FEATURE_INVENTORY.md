# ResearchProof AI 1.0 — Feature Inventory

**Audit Date:** October 29, 2026  
**Auditor:** Principal Full-Stack & Systems QA Lead  
**Scope:** Inventory of Existing Capabilities, Duplicate Modules, Missing Features, and 1.0 Target Blueprint

---

## 1. Feature Status Matrix

| Module / Capability | Current Status | Implemented Components | Gaps to 1.0 Target |
|---|---|---|---|
| **01. Unified Research Projects** | **Partial** | Basic project create/list/delete in MongoDB & memory store | Needs project switcher context across all tools, members, milestones, version timeline, tasks |
| **02. Reference & Citation Manager** | **Working (Core)** | Crossref DOI lookup, APA 7 formatting, in-text citation generator, local collection | Needs BibTeX/RIS import/export, duplicate detection, CSL style switcher, retraction alerts |
| **03. Literature Review Studio** | **Missing** | None (only general rewriting & summarization tools exist) | Needs paper search, study matrix (design, sample, measures, findings), thematic clustering, synthesis draft |
| **04. PDF Research Chat** | **Missing** | Document import exists via Mammoth (.docx only) | Needs PDF parser, page-level chunking, grounded QA retrieval, passage inspector, conversation history |
| **05. Statistical Analysis Studio** | **Incomplete** | Basic statistical checker in UI (rule-based checks) | Needs CSV/XLSX import, variable classifier, descriptive stats, t-test, ANOVA, correlation, regression, APA plots |
| **06. Systematic Review Assistant** | **Missing** | None | Needs review protocol, study deduplication, screening queues, conflict resolution, PRISMA flow chart |
| **07. Journal Submission Studio** | **Incomplete** | Basic journal readiness score in UI | Needs journal discovery, guideline compliance rules, cover letter generator, submission package exporter |
| **08. Research Collaboration** | **Missing** | User roles (`researcher`, `reviewer`, `admin`) exist | Needs project invitations, permissions (`owner`, `editor`, `reviewer`, `viewer`), threaded comments, audit history |
| **Existing: Writing Studio** | **Working** | AI rewriting, tone adjustment, paraphrasing, grammar, humanizer | Fully operational; needs shared project context binding |
| **Existing: Research Integrity** | **Working** | TextGuard scan, multi-source similarity, AI authorship indicators | Fully operational; needs integration with project documents |
| **Existing: Document Studio** | **Working** | Word DOCX export/import, LaTeX APA 7 compiler, PDF report generation | Fully operational; needs version snapshot linkage |
| **Existing: Administration** | **Working** | User management, audit logs, analytics dashboard | Fully operational for admin users |

---

## 2. Inventory of Existing Endpoints

### 2.1 Authentication & Profile (`/api` and `/api/v1`)
- `POST /auth/register` — Email/password registration with optional Turnstile challenge verification (**Working**)
- `POST /auth/login` — Email/password authentication with risk-based Turnstile triggers (**Working**)
- `GET /auth/config` — Public Google Client ID, Turnstile site key, and environment flags (**Working**)
- `GET /auth/risk-status` — Returns failed attempt status and Turnstile requirement (**Working**)
- `GET /auth/google/start` — Full-page Google OAuth 2.0 PKCE redirect (**Working**)
- `GET /auth/google/callback` — Authorization code exchange, session creation, redirect (**Working**)
- `POST /auth/google` — Google Identity Services credential token exchange (**Working**)
- `POST /auth/link-google` — Manual linking of Google account to existing user (**Working**)
- `POST /auth/logout` — Server-side token invalidation and cookie clearing (**Working**)
- `GET /auth/me` — Authenticated user profile, role, and usage metrics (**Working**)

### 2.2 Projects & Documents (`/api` and `/api/v1`)
- `GET /projects` — User projects listing (**Working**)
- `POST /projects` — Create research project container (**Working**)
- `DELETE /projects/:id` — Delete project and cascade documents (**Working**)
- `GET /documents` — User manuscripts listing (**Working**)
- `POST /documents` — Create new manuscript document (**Working**)
- `GET /documents/:id` — Retrieve document content (**Working**)
- `PUT /documents/:id` — Update manuscript title and content (**Working**)
- `DELETE /documents/:id` — Delete manuscript (**Working**)
- `POST /documents/export-docx` — Export document as formatted `.docx` binary (**Working**)
- `POST /documents/import-docx` — Import `.docx`, `.txt`, `.bib` into editor (**Working**)

### 2.3 Citation & DOI Services
- `POST /citations/verify-doi` — Crossref API lookup with metadata extraction (**Working**)
- `POST /citations/format` — APA 7, MLA, Chicago, IEEE citation generation (**Working**)
- `GET /citations` — User reference bibliography (**Working**)
- `POST /citations` — Save reference to user collection (**Working**)
- `DELETE /citations/:id` — Remove reference from collection (**Working**)

### 2.4 Research Integrity & TextGuard
- `POST /integrity/analyze` — Originality, similarity, and AI authorship scan (**Working**)
- `POST /integrity/textguard-scan` — Multi-source web & academic text verification (**Working**)
- `GET /integrity/reports` — Saved audit reports (**Working**)
- `GET /integrity/report-pdf/:id` — Downloadable binary PDF integrity report (**Working**)

### 2.5 LaTeX APA 7 Publication Compiler
- `POST /latex/convert` — Generates modular apa7 LaTeX files (`main.tex`, `references.bib`) (**Working**)
- `GET /latex/jobs/:id` — Polls compilation status and preview (**Working**)
- `GET /latex/download/:id` — Downloads full submission ZIP bundle (**Working**)

---

## 3. Redundant & Duplicate Components

1. **Dual Routing Prefixes**:
   - Both `/api/*` and `/api/v1/*` are mounted. This was intentionally implemented to preserve backward compatibility while transitioning to `/api/v1`.
2. **In-Memory Store vs MongoDB**:
   - Both `memUsers`, `memProjects`, `memDocs` and Mongoose models coexist to support zero-dependency dev mode while connecting to MongoDB Atlas in production.
   - Guardrails are now active so production never silently writes to the in-memory store.
3. **Navigation Aliases in UI**:
   - In `client/src/App.tsx`, paths like `/studio`, `/citations`, `/humanizer`, `/originality` exist alongside new grouped paths like `/writing`, `/integrity`. Both are routed through `getSectionFromPath()`.

---

## 4. Phase-by-Phase Roadmap for 1.0 Delivery

- **Phase A (Completed)**: Codebase stabilization, 502 Bad Gateway fix, Turnstile verification widget, Mongoose schema cast fix, regression test suite (31/31 passed), clean production build.
- **Phase B (Next)**: Unified Workspace — Shared Project Context, Project Member schema, top bar project switcher, updated 12-item navigation sidebar.
- **Phase C**: Reference & Citation Manager expansion — BibTeX/RIS parser, CSL styles, duplicate detection.
- **Phase D**: Literature Review Studio — Study matrix, evidence extraction, synthesis draft.
- **Phase E**: PDF Research Chat — PDF text extraction, document chunking, grounded QA.
- **Phase F**: Statistical Analysis Studio — Reproducible numerical compute engine (descriptives, t-test, ANOVA, correlation, regression).
- **Phase G**: Systematic Review Assistant — PRISMA flow generator, title/abstract screening, reviewer decisions.
- **Phase H**: Journal Submission Studio & Research Collaboration — Journal checklist, cover letters, package builder, team invitations, threaded comments.
- **Phase I**: Integration & Full Production Sign-off — Cross-tool links, end-to-end tests, production verification report.
