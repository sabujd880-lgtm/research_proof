# ResearchProof AI 1.0 — Phase 5 Implementation Plan
## Complete Literature Review Studio

### 1. Architectural Strategy & Role Definition
- **Role**: Principal Full-Stack Engineer, Academic Research Software Architect, React/TypeScript Engineer, Node.js/Express Engineer, MongoDB Engineer, AI/RAG Engineer, UI/UX Designer, Security Engineer, QA Lead.
- **Application**: ResearchProof AI 1.0
- **Repository**: `https://github.com/sabujd880-lgtm/research_proof` (Branch: `main`)
- **Production**: `https://research-proof-1.onrender.com`
- **Primary Goal**: Implement an end-to-end Literature Review Studio integrated with Unified Research Projects, Reference Manager, and Document Studio:
  $$\text{Discover Papers} \longrightarrow \text{Import References} \longrightarrow \text{Organize Studies} \longrightarrow \text{Extract Evidence} \longrightarrow \text{Build Matrices} \longrightarrow \text{Compare Studies} \longrightarrow \text{Identify Gaps} \longrightarrow \text{Synthesize Drafts} \longrightarrow \text{Export Outputs}$$

---

### 2. Dependency & Pre-Flight Verification
1. **Git State**: Clean working tree on `main` at commit `8cc96e9`.
2. **Phase 3 (Dashboard & Projects)**: 18/18 tests pass. Project scoping, tasks, and audit logs are fully active.
3. **Phase 4 (Reference Manager)**: 16/16 tests pass. CSL citation engine, Crossref/OpenAlex lookup, and duplicate detection are fully functional.
4. **Plagiarism & Authenticity**: 36/36 tests pass. TextGuard, DOCX import/export, and session auth are operational.
5. **No Regressions Guarantee**: All existing routes (`/projects`, `/references`, `/citations`, `/documents`, `/revisions`) will remain 100% operational with backward compatibility.

---

### 3. Step-by-Step Implementation Roadmap

#### Step 1: Literature Review Database Architecture
Extend Mongoose schemas in `server/src/models.js` and in-memory store in `server/src/index.js`:
- `LiteratureEntry`: 25+ academic dimensions including `researchQuestion`, `studyObjectives`, `studyDesign`, `methodology`, `population`, `sampleSize`, `samplingMethod`, `measures`, `variables`, `statisticalMethods`, `keyFindings`, `effectEstimates`, `limitations`, `futureDirections`, `extractionStatus`, `referenceId`, `documentId`.
- `EvidenceExtract`: Granular provenance records with `pageNumber`, `section`, `sourceText`, `extractedField`, `extractedValue`, `extractionMethod`, `confidenceOrReviewStatus`, `verifiedBy`.
- `LiteratureMatrix`: Configurable columns, ordering, widths, and saved views.
- `LiteratureTheme`: Thematic categories with assigned study IDs, descriptions, and summaries.
- `StudyComparison`: Side-by-side matrices comparing 2–5 selected studies.
- `ResearchGapCandidate`: 8 categories of academic gaps (population, methodological, measurement, geographic, theoretical, inconsistent findings, understudied variables, longitudinal) with supporting and contradictory study provenance.
- `SynthesisDraft`: Narrative, thematic, chronological, and methodological synthesis drafts with evidence link mapping and version history.

#### Step 2: Core Literature Business Logic Service (`server/src/literatureService.js`)
- Scholarly search with Crossref & OpenAlex.
- Structured evidence extraction parser.
- Study comparison engine.
- Research gap identification algorithm.
- Evidence-linked synthesis draft builder with APA 7 citation attribution.
- CSV and XLSX tabular matrix export.

#### Step 3: REST API Implementation (`server/src/index.js`)
Mount standard `/api/v1/literature` and `/api/literature` endpoints:
- `GET /api/v1/literature`: Filtered, paginated study library.
- `POST /api/v1/literature`: Add new literature entry.
- `GET /api/v1/literature/:entryId`: Single study details with evidence extracts.
- `PATCH /api/v1/literature/:entryId`: Update study details & matrix cells.
- `DELETE /api/v1/literature/:entryId`: Soft delete study.
- `GET /api/v1/literature/search`: Scholarly paper search.
- `POST /api/v1/literature/import`: Import from Reference Manager, DOI, or BibTeX/RIS.
- `POST /api/v1/literature/extract`: Extract structured evidence.
- `GET /api/v1/literature/matrix`: Matrix configuration and dataset.
- `PATCH /api/v1/literature/matrix/:entryId`: Inline cell updates.
- `POST /api/v1/literature/compare`: Multi-study comparison.
- `GET /api/v1/literature/themes` & `POST /api/v1/literature/themes`: Thematic management.
- `POST /api/v1/literature/gaps`: Candidate research gap identification.
- `POST /api/v1/literature/synthesis`: Evidence-linked synthesis generator.
- `GET /api/v1/literature/export`: Multi-format export center (CSV, XLSX, DOCX, BibTeX, RIS).

#### Step 4: Linear-Inspired UI/UX Workspace (`client/src/modules/LiteratureReview.tsx`)
Create 8 integrated views:
1. **Discover**: Scholarly paper discovery with filters & 1-click import.
2. **My Papers**: Study repository with screening status badges and abstract inspector.
3. **Literature Matrix**: Configurable interactive matrix table with inline cell editing and CSV export.
4. **Study Comparison**: Side-by-side comparative table for selected papers.
5. **Thematic Grouping**: Manage themes, assign studies, generate thematic summaries.
6. **Research Gaps**: Evidence-grounded candidate gap cards with research question prompts.
7. **Synthesis Studio**: Synthesis draft generator with citation links, manual editing, and versioning.
8. **Export Center**: CSV, DOCX, and BibTeX exports.

#### Step 5: Testing & Release Gate Verification
- Automated test suite in `server/test/phase5_literature_review.test.js`.
- Full platform regression verification.
- Complete documentation suite.
- Production commit & deployment.
