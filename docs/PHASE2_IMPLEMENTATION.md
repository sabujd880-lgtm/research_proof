# ResearchProof AI — Phase 2: Academic Tools Implementation

## 1. Overview

Phase 2 transitions ResearchProof AI from a basic writing check utility into a full **Academic Writing Studio & Research Integrity Platform**. It introduces a unified 3-column academic document editor, 8 research-focused rewriting modes with deterministic meaning-preservation auditing, DOI metadata resolution with Crossref, APA/MLA/IEEE citation formatting, in-text citation validation, and Office Open XML (.docx) import/export.

---

## 2. Core Modules Implemented

### A. Academic Writing Studio (`client/src/App.tsx`, `client/src/styles.css`)
- **Left Workspace Sidebar:** Documents list, projects switcher, citation quick-access, and DOCX import/export triggers.
- **Center Editing Canvas:** Real-time word count, character count, optimistic concurrency version tracking, and debounced autosave.
- **Right Inspector Panel:** Tabbed interface with Meaning & Integrity Warnings, Visual Word Diff, Citation Assistant, and Document Revision History with one-click restore.

### B. Meaning-Preserving Academic Rewriting (`server/src/meaningChecker.js`, `server/src/services.js`)
- Supports 8 distinct academic rewriting modes:
  1. `academic-clarity`
  2. `grammar-correction`
  3. `concise-academic`
  4. `formal-scientific`
  5. `readability-improvement`
  6. `paragraph-restructure`
  7. `thesis-dissertation`
  8. `journal-manuscript`
- Deterministic Meaning-Checking Engine:
  - Detects negation inversions (e.g., "did not demonstrate" altered to affirmative "demonstrated").
  - Flags alterations to p-values, confidence intervals, effect sizes, and sample sizes (`n = ...`).
  - Detects changes to raw numbers, units of measurement, dates, and direct quotations.
  - Returns structured alerts with severity levels: `critical`, `warning`, `info`.

### C. Revision Lifecycle & Concurrency (`server/src/index.js`, `server/src/models.js`)
- Proposed revisions do not overwrite original text until explicitly accepted via `POST /api/revisions/:id/accept`.
- Rejections are tracked via `POST /api/revisions/:id/reject`.
- Historical revisions can be restored via `POST /api/documents/:id/restore`.
- Optimistic concurrency control prevents concurrent tabs from silently overwriting newer revisions using document `version` checks (returns `409 Conflict` with `CONCURRENT_EDIT_CONFLICT`).

### D. Citation Assistant (`server/src/citationService.js`, `server/src/models.js`)
- Public Crossref REST API integration (`https://api.crossref.org/works/{doi}`) with timeout and rate-limit handling.
- Local in-memory and database TTL caching (`DoiCache` collection) to minimize external network requests.
- CSL formatting for APA 7th edition, MLA 9th edition, and IEEE styles.
- In-text citation auditing detects uncited references, missing citations, and duplicate catalog entries.

### E. DOCX Import & Export (`server/src/docxService.js`)
- **Import:** Validates ZIP/Office Open XML magic bytes (`PK\x03\x04`), extracts text and headings via `mammoth`, sanitizes HTML, and preserves Unicode symbols.
- **Export:** Builds valid `.docx` files using the `docx` library with title, headings, formatted paragraphs, and bibliography references. Streams buffer directly without retaining temporary files on disk.

---

## 3. Data Model Changes

1. **`Document`**:
   - `content`: String (active manuscript text).
   - `version`: Number (default: 1, incremented on every save/accept/restore).
   - `wordCount`: Number.
   - `characterCount`: Number.
2. **`Revision`**:
   - `parentRevisionId`: ObjectId ref Revision.
   - `proposedText`: String.
   - `acceptedText`: String.
   - `status`: Enum (`'proposed'`, `'accepted'`, `'rejected'`, `'restored'`).
   - `acceptedAt`: Date.
   - `meaningWarnings`: Array of structured warning objects.
3. **`Citation`**:
   - `ownerId`: ObjectId ref User.
   - `projectId`: ObjectId ref Project.
   - `documentId`: ObjectId ref Document.
   - `doi`: Normalized DOI string.
   - `title`: String.
   - `authors`: Array of `{ given, family, name }`.
   - `year`: String.
   - `journal`, `volume`, `issue`, `pages`: String.
   - `verificationStatus`: `'verified'` | `'unverified'` | `'manual'`.
4. **`DoiCache`**:
   - `doi`: String, unique index.
   - `metadata`: Mixed.
   - `cachedAt`: TTL indexed for 30-day automatic expiration.

---

## 4. Verification & Testing

34 automated tests run via `npm test --prefix server`:
- 21 Phase 1 Security, Google OAuth, Session, and Quota tests.
- 13 Phase 2 Academic Writing Studio, Concurrency, Meaning Preservation, Citation, and DOCX tests.
- 100% test pass rate with zero failures.
