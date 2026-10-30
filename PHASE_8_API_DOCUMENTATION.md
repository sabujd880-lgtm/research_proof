# RESEARCHPROOF AI 1.0 — PHASE 8 API DOCUMENTATION
## SYSTEMATIC REVIEW ASSISTANT & PRISMA 2020 REST ENDPOINTS

### 1. Architectural Conventions
- **Prefix Availability**: Both `/api` and `/api/v1` prefixes are supported.
- **Authentication**: JWT Bearer token in the `Authorization` header (`Bearer <token>`).
- **Data Formats**: `application/json` for requests and responses; `text/csv` for dataset and flow exports; `image/svg+xml` for PRISMA diagrams.
- **Security**: Tenant-isolated by user and linked project.

---

### 2. Systematic Reviews Lifecycle

#### `GET /api/systematic-reviews`
Retrieves all systematic reviews belonging to the authenticated researcher or active project.
- **Query Parameters**:
  - `projectId` *(optional)*: Filter reviews by linked project.
- **Response** (`200 OK`):
  Array of `SystematicReview` objects.

#### `POST /api/systematic-reviews`
Initializes a new systematic review with PICO boundaries and screening settings.
- **Request Body**:
  ```json
  {
    "title": "SGLT2 Inhibitors in HFpEF: A Systematic Review",
    "projectId": "672...",
    "reviewType": "systematic_review",
    "registration": {
      "registered": true,
      "registryName": "PROSPERO",
      "registrationNumber": "CRD42026123456"
    },
    "picosFramework": {
      "framework": "PICOS",
      "population": "Adults with LVEF >= 50%",
      "intervention": "Empagliflozin or Dapagliflozin",
      "comparator": "Placebo",
      "outcomes": "Cardiovascular mortality and HF hospitalizations"
    },
    "screeningSettings": {
      "dualReviewerMode": true,
      "blindScreening": true,
      "minimumReviewersPerRecord": 2
    }
  }
  ```
- **Response** (`201 Created`): Created `SystematicReview` object.

#### `GET /api/systematic-reviews/:reviewId`
Retrieves a single systematic review, including its live reconciled PRISMA 2020 counts.

#### `PATCH /api/systematic-reviews/:reviewId`
Updates review configuration, stage, or screening settings.

#### `DELETE /api/systematic-reviews/:reviewId`
Performs non-destructive soft deletion.

---

### 3. Protocol & Search Strategy Endpoints

#### `GET /api/systematic-reviews/:reviewId/protocol`
Retrieves the active protocol draft and historical amendment log.

#### `PUT /api/systematic-reviews/:reviewId/protocol`
Updates protocol details. If `amendmentNote` is supplied, increments protocol version and creates an immutable audit entry.

#### `GET /api/systematic-reviews/:reviewId/search-strategies`
Lists all logged search execution runs with search strings and record counts.

#### `POST /api/systematic-reviews/:reviewId/search-strategies`
Logs a search execution on a database or register.

---

### 4. Record Import & Deduplication

#### `POST /api/systematic-reviews/:reviewId/import`
Parses and ingests records from multiple standard formats:
- **Formats**: `ris`, `bibtex`, `csv`, or `referenceIds` (Reference Manager integration).
- **Automatic Matching**: Runs pairwise comparison against existing records.
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "importedCount": 142,
    "duplicateCount": 18,
    "uniqueCount": 124,
    "records": [...]
  }
  ```

#### `GET /api/systematic-reviews/:reviewId/records`
Paginated search and filter query for review records.
- **Query Parameters**:
  - `stage`: `pre_screen`, `title_abstract`, `full_text`, `included`
  - `decision`: `pending`, `included`, `excluded`, `unclear`
  - `search`: Keyword string matching title, abstract, or DOI
  - `page`: Page index (default: 1)
  - `limit`: Page size (default: 50)

#### `GET /api/systematic-reviews/:reviewId/duplicates`
Returns all detected duplicate clusters with candidate similarity scores.

#### `POST /api/systematic-reviews/:reviewId/duplicates/resolve`
Resolves duplicate candidates by merging into a canonical record or marking them separate.

---

### 5. Screening & Conflict Adjudication

#### `GET /api/systematic-reviews/:reviewId/screening-queue`
Returns records requiring evaluation by the current authenticated reviewer.

#### `POST /api/systematic-reviews/:reviewId/screening-decisions`
Submits an atomic screening decision (`included`, `excluded`, `unclear`). In dual-reviewer mode, discrepancies trigger automatic creation of a `ReviewConflict`.

#### `GET /api/systematic-reviews/:reviewId/conflicts`
Retrieves all unresolved reviewer disputes.

#### `POST /api/systematic-reviews/:reviewId/conflicts/:conflictId/resolve`
Adjudicates a dispute with a final decision and rationale.

---

### 6. Full-Text, Extraction, & Risk of Bias

#### `POST /api/systematic-reviews/:reviewId/full-text`
Records retrieval status and full-text eligibility. Under PRISMA 2020 rules, exclusion requires a mandatory structured reason.

#### `GET` / `POST /api/systematic-reviews/:reviewId/extractions`
Structured data extraction sheets linking variables to study records.

#### `GET` / `POST /api/systematic-reviews/:reviewId/risk-of-bias`
Assesses Cochrane RoB 2, ROBINS-I, or QUADAS-2 domains with deterministic overall judgment calculation.

---

### 7. PRISMA 2020 Flow, Checklist & Exports

#### `GET /api/systematic-reviews/:reviewId/prisma`
Returns the reconciled PRISMA 2020 flow counts, discrepancy diagnostics, and generated vector SVG diagram.

#### `GET` / `PUT /api/systematic-reviews/:reviewId/prisma/checklist`
Tracks 27-item PRISMA 2020 compliance.

#### `GET /api/systematic-reviews/:reviewId/audit-trail`
Chronological event log of all screening, adjudication, and protocol actions.

#### `GET /api/systematic-reviews/:reviewId/export`
Exports reproducible review packages as JSON or CSV.

