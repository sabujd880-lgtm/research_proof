# ResearchProof AI 1.0 — Phase 4 Implementation Plan
## Complete Reference & Citation Manager

**Architect**: Principal Full-Stack & Research Integrity Engineer  
**Status**: Step 1 Verification Complete — Implementation Underway  
**Target Release**: Phase 4 Production Gate  

---

## 1. System Audit & Verification of Prior Phases

- **Git Status**: Clean working tree on `main` branch (commit `946a719`).
- **Phase 3 Verification**:
  - Unified Research Projects and Real-Time Dashboard verified with 100% test pass rate (79/79 tests passing).
  - Production build (`tsc -b && vite build`) compiles with 0 errors.
- **Existing Citation Infrastructure**:
  - `server/src/citationService.js`: Provides DOI normalization, syntax validation, and Crossref API caching (`DoiCache` / `memDoiCache`).
  - `server/src/bibtexRisService.js`: Parses basic BibTeX and RIS records; provides duplicate detection and basic styling.
  - `server/src/models.js`: Contains `citationSchema` with `ownerId`, `projectId`, `documentId`, `doi`, `title`, `authors`, `year`, `journal`, `volume`, `issue`, `pages`, `publisher`, `verificationStatus`.
- **Identified Gaps to Close for Phase 4**:
  1. *Schema Completeness*: Missing structured author objects (`givenName`, `familyName`, `literalName`, `orcid`), editors, publication types (preprints, datasets, book chapters), ISSN/ISBN, language, collections, tags, favorites, notes, and soft-delete (`deletedAt`).
  2. *REST API Granularity*: Need standard REST endpoints (`/api/v1/references`, `/api/v1/reference-collections`, `/lookup/doi`, `/search/scholarly`, `/import/bibtex`, `/import/ris`, `/duplicates`, `/merge`, `/format`, `/bibliography`, `/export`).
  3. *CSL Citation Engine*: Citation formatting must strictly conform to academic standards for APA 7 (single, double, 3+ authors, et al., corporate authors, no date, journal/book/conference), MLA 9, Chicago, Vancouver, IEEE, and Harvard.
  4. *Enterprise UI*: The current single-column `CitationAssistantPage` must be replaced by a 3-pane Linear-inspired workspace with collections, search, filtering, duplicate review, and inspector preview.

---

## 2. Technical Architecture & Component Design

### A. Data Layer (`server/src/models.js`)
- **Extend `citationSchema`** (aliased as `Reference`):
  - Structured `authors` and `editors` arrays: `{ given, family, name, givenName, familyName, literalName, orcid }`
  - Canonical metadata: `publicationType`, `journalTitle`, `bookTitle`, `articleNumber`, `isbn`, `issn`, `url`, `abstract`, `keywords`, `language`, `citationKey`
  - Provenance: `sourceProvider` (`crossref`, `openalex`, `bibtex`, `ris`, `manual`), `metadataStatus` (`verified`, `partially_verified`, `unverified`, `lookup_failed`), `metadataLastVerifiedAt`, `retractionStatus`
  - Organization: `collectionIds`, `tags`, `isFavorite`, `notes`, `deletedAt`
  - Performance indexes: `{ ownerId: 1, deletedAt: 1, updatedAt: -1 }`, `{ projectId: 1, deletedAt: 1 }`, `{ ownerId: 1, doi: 1 }`, `{ ownerId: 1, isFavorite: 1 }`
- **New `ReferenceCollection` Schema**:
  - `_id`, `ownerId`, `projectId`, `name`, `description`, `color`, `icon`, `createdAt`, `updatedAt`

### B. Core Services (`server/src/`)
1. **`referenceService.js` / Extended `citationService.js` & `bibtexRisService.js`**:
   - Scholarly Search engine integrating Crossref & OpenAlex public APIs with query debouncing, rate limiting, and result deduplication.
   - Robust BibTeX parser handling `@article`, `@book`, `@inproceedings`, `@phdthesis`, `@mastersthesis`, `@techreport`, `@misc`.
   - Comprehensive RIS parser supporting tags `TY`, `TI`, `AU`, `PY`, `JO`, `DO`, `UR`, `VL`, `IS`, `SP`, `EP`, `ER`.
   - Advanced Duplicate Detection engine classifying matches into `exact` (identical normalized DOI or ISBN), `probable` (high title similarity + publication year + first author), and `possible`.
   - Merge conflict resolution tool preserving historical citations and relations.
   - High-fidelity CSL Citation Engine executing validated APA 7, MLA 9, Chicago 17, Vancouver, IEEE, and Harvard styles.

### C. Backend API Endpoints (`server/src/index.js`)
- `GET /api/v1/references`: Filtered, paginated reference queries (`projectId`, `collectionId`, `type`, `status`, `search`, `favorite`, `sort`, `page`, `limit`).
- `POST /api/v1/references`: Manual reference entry with schema validation.
- `GET /api/v1/references/:id`: Single reference retrieval with collection details.
- `PATCH /api/v1/references/:id`: Reference update (metadata, notes, favorite toggle, collections).
- `DELETE /api/v1/references/:id`: Soft delete (`deletedAt: new Date()`).
- `POST /api/v1/references/lookup/doi`: Normalized Crossref metadata resolution.
- `POST /api/v1/references/search/scholarly`: Crossref & OpenAlex discovery queries.
- `POST /api/v1/references/import/bibtex`: Batch BibTeX ingestion with per-record error feedback.
- `POST /api/v1/references/import/ris`: Batch RIS ingestion.
- `POST /api/v1/references/import/batch`: Multi-source batch ingestion.
- `GET /api/v1/references/duplicates`: Duplicate candidates detection.
- `POST /api/v1/references/merge`: Merge duplicate records with customizable primary selection.
- `POST /api/v1/references/format`: Real-time CSL in-text and bibliography generation.
- `POST /api/v1/references/bibliography`: Full bibliography generation for selected references.
- `GET /api/v1/references/export`: File download in BibTeX, RIS, HTML, plain text, and DOCX.
- `GET /api/v1/reference-collections`: List user reference collections.
- `POST /api/v1/reference-collections`: Create named collection.
- `PATCH /api/v1/reference-collections/:id`: Update collection name/color.
- `DELETE /api/v1/reference-collections/:id`: Delete collection (unlinks references without deleting them).

### D. Frontend Linear UI (`client/src/modules/ReferenceManager.tsx`)
- 3-Pane Responsive Layout:
  - **Left Pane (Library Navigation)**:
    - All References (counter)
    - Project Library Filter
    - Favorites
    - Recently Added
    - Duplicate Review queue
    - Named Collections with "+ New Collection" modal
  - **Center Pane (Reference List & Toolbar)**:
    - Search bar (debounced title, author, keyword search)
    - Filter controls: Publication Type, Verification Status (`Verified`, `Partially Verified`, `Unverified`), Project Scope
    - Sorting controls: Year, Title, Added Date, Author
    - Bulk action bar: Export selected, Add to collection, Delete selected
    - Table / Card view switcher
  - **Right Pane (Reference Inspector)**:
    - Selected reference header with verification badge and retraction indicator
    - Formatted CSL Citation live preview with style switcher (APA 7, MLA 9, Chicago, Vancouver, IEEE, Harvard)
    - Full metadata inspector and quick editor
    - Abstract & Keywords
    - Personal Notes editor
  - **Modals**:
    - DOI Lookup & Scholarly Search Modal
    - BibTeX & RIS File Import Modal with record preview
    - Manual Reference Entry Modal
    - Export Bibliography Modal (Copy HTML/Text, download .bib, .ris, or .docx)
    - Duplicate Resolution Modal

---

## 3. Implementation Sequence

1. **Step 2**: Enhance Mongoose schema in `server/src/models.js` and in-memory store mirroring.
2. **Step 3-10**: Implement backend citation engine, scholarly search, import/export, and reference APIs in `server/src/`.
3. **Step 11-13**: Implement and validate CSL citation formatter for APA 7 and other styles.
4. **Step 14-15**: Build frontend `client/src/modules/ReferenceManager.tsx` and integrate with `client/src/App.tsx`.
5. **Step 16-19**: Write comprehensive test suite `server/test/phase4_reference_manager.test.js` and verify builds.
6. **Step 20-21**: Create all required documentation artifacts and verify Phase 4 Release Gate.
