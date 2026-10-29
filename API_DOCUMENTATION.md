# ResearchProof AI 1.0 — API Documentation

**Canonical Prefix:** `/api/v1` (with backward-compatible `/api` mirroring)  
**Authentication:** Bearer Token via `Authorization: Bearer <token>` or Cookie `rp_session`  
**Content-Type:** `application/json` (unless binary export / file upload)

---

## 1. Authentication Endpoints

### `POST /api/v1/auth/register`
Creates a new researcher account.
- **Request Body**:
  ```json
  {
    "email": "researcher@university.edu",
    "password": "StrongPassword123!",
    "turnstileToken": "optional-token-when-enabled"
  }
  ```
- **Responses**:
  - `201 Created`: `{ "token": "...", "user": { "id": "...", "email": "...", "displayName": "..." } }`
  - `400 Bad Request`: `{ "error": "...", "requiresTurnstile": true, "siteKey": "..." }`
  - `409 Conflict`: `{ "error": "An account with this email already exists." }`

### `POST /api/v1/auth/login`
Authenticates with email and password.
- **Request Body**: `{ "email": "...", "password": "...", "turnstileToken": "..." }`
- **Responses**:
  - `200 OK`: `{ "token": "...", "user": { ... } }`
  - `401 Unauthorized`: `{ "error": "Invalid email or password.", "requiresTurnstile": false }`
  - `403 Forbidden`: `{ "error": "Security verification required...", "requiresTurnstile": true }`

### `GET /api/v1/auth/config`
Public authentication configuration.
- **Response `200 OK`**:
  ```json
  {
    "googleClientId": "387878022617-624p2r5hfa278npj531373cc8lf64t1e.apps.googleusercontent.com",
    "googleConfigured": true,
    "googleRedirectUri": "https://research-proof-1.onrender.com/api/auth/google/callback",
    "turnstileSiteKey": "1x00000000000000000000AA",
    "turnstileEnabled": false,
    "environment": "production"
  }
  ```

### `GET /api/v1/auth/google/start`
Initiates Google OAuth 2.0 PKCE flow. Sets state and verifier cookies, redirects to `accounts.google.com`.

### `GET /api/v1/auth/google/callback`
Processes OAuth authorization code exchange, establishes authenticated session, and redirects to client.

### `POST /api/v1/auth/logout`
Invalidates active server-side session token version and clears `rp_session` cookie.

### `GET /api/v1/auth/me`
Retrieves authenticated user profile, preferences, and usage metrics.

---

## 2. Unified Research Projects (`/api/v1/projects`)

### `GET /api/v1/projects`
Lists all active research projects accessible to the authenticated user.

### `POST /api/v1/projects`
Creates a new research project.
- **Request Body**:
  ```json
  {
    "title": "Neurocognitive Study 2026",
    "description": "Investigating memory consolidation during sleep",
    "discipline": "Cognitive Neuroscience",
    "documentType": "Empirical Article"
  }
  ```

### `GET /api/v1/projects/:id`
Retrieves project details, member roles, milestones, and linked documents.

### `PUT /api/v1/projects/:id`
Updates project metadata or workflow stage (`literature` -> `analysis` -> `drafting` -> `review` -> `submission`).

### `DELETE /api/v1/projects/:id`
Archives or deletes a project.

---

## 3. Reference & Citation Manager (`/api/v1/citations` & `/api/v1/references`)

### `POST /api/v1/citations/verify-doi`
Resolves metadata for a DOI via Crossref.
- **Request Body**: `{ "doi": "10.1037/0003-066X.54.3.180" }`
- **Response**: `{ "verified": true, "citation": { "title": "...", "authors": [...], "year": 1999, ... } }`

### `POST /api/v1/citations/format`
Formats a bibliographic entry according to target style (`apa7`, `mla9`, `chicago17`, `ieee`, `harvard`).

### `POST /api/v1/references/import-bibtex`
Parses and imports BibTeX / RIS records into the active project library.

---

## 4. Literature Review Studio (`/api/v1/literature`)

### `GET /api/v1/literature?projectId=:id`
Retrieves all literature entries and study matrices for a project.

### `POST /api/v1/literature/extract`
Extracts structured study matrix data (design, sample, measures, findings, limitations) from an imported paper.

### `POST /api/v1/literature/synthesize`
Generates an evidence-backed synthesis paragraph with traceable source citations.

---

## 5. PDF Research Chat (`/api/v1/pdf-chat`)

### `POST /api/v1/pdf-chat/upload`
Uploads and indexes a PDF manuscript for grounded question answering.

### `POST /api/v1/pdf-chat/query`
Asks a research question grounded in uploaded project PDFs.
- **Request Body**: `{ "projectId": "...", "query": "What were the primary inclusion criteria?" }`
- **Response**: `{ "answer": "...", "citations": [{ "page": 4, "passage": "..." }] }`

---

## 6. Statistical Analysis Studio (`/api/v1/statistics`)

### `POST /api/v1/statistics/import-dataset`
Ingests a CSV / Excel file and classifies variables into Numeric, Categorical, or Date.

### `POST /api/v1/statistics/run-test`
Executes an empirical statistical test.
- **Supported Tests**: `descriptive`, `ttest_ind`, `ttest_paired`, `anova_oneway`, `pearson_corr`, `linear_regression`.
- **Response**: `{ "statistic": 3.42, "pValue": 0.0018, "df": 48, "effectSize": { "name": "Cohen's d", "value": 0.98 }, "apaReport": "t(48) = 3.42, p = .002, d = 0.98" }`

---

## 7. Systematic Reviews (`/api/v1/systematic-reviews`)

### `GET /api/v1/systematic-reviews?projectId=:id`
Retrieves review protocols, screening queues, and PRISMA counts.

### `POST /api/v1/systematic-reviews/decision`
Records a title/abstract or full-text screening decision (`include`, `exclude`, `maybe`) with explicit exclusion rationale.

---

## 8. Journal Submission Studio (`/api/v1/journal-submission`)

### `POST /api/v1/journal-submission/check-compliance`
Validates manuscript against verified journal requirements (word limits, citation style, required ethics declarations).

### `POST /api/v1/journal-submission/generate-package`
Generates submission-ready ZIP bundle containing manuscript, cover letter, declarations, and checklist.
