# ResearchProof AI 1.0 — Phase 4 API Documentation
## Complete Reference & Citation Manager REST API Specification

### 1. Overview
The Reference & Citation Manager API provides a comprehensive, production-ready REST suite for searching, importing, validating, organizing, citing, and exporting academic literature. It mounts simultaneously on `/api/v1/references` and `/api/references` as well as `/api/v1/reference-collections` and `/api/reference-collections`.

---

### 2. Authentication & Headers
All endpoints require a Bearer token in the `Authorization` header:
```http
Authorization: Bearer <jwt_session_token>
```
Standard JSON endpoints accept and return `application/json`. Import and export endpoints additionally support `multipart/form-data` and `text/plain` file attachments.

---

### 3. Reference Endpoints

#### 3.1. Query References
- **Method**: `GET /api/v1/references`
- **Query Parameters**:
  - `projectId`: (string) Filter by project ID.
  - `collectionId`: (string) Filter by collection ID.
  - `type` or `publicationType`: (string) Filter by type (`journal-article`, `book`, `book-chapter`, `proceedings-article`, `thesis`, `preprint`, `dataset`, `report`).
  - `status` or `metadataStatus`: (string) Filter by verification status (`verified`, `unverified`).
  - `favorite`: (boolean string) Filter favorites (`true` / `false`).
  - `search` or `q`: (string) Free-text search across title, authors, DOI, journal.
  - `sort`: (string) Sort field (`updatedAt`, `title`, `year`, `author`). Default: `updatedAt`.
  - `order`: (`desc` | `asc`). Default: `desc`.
  - `page`: (number) Page number. Default: `1`.
  - `limit`: (number) Items per page (max: 100). Default: `50`.
  - `paginated`: (`true` | `false`). When `true`, returns `{ references, pagination }`. When omitted/false, returns array for backward compatibility.
- **Response Headers**:
  - `X-Total-Count`: Total number of matching references.
  - `X-Page`: Current page.
  - `X-Total-Pages`: Total number of pages.
- **Response (200 OK)**:
```json
{
  "references": [
    {
      "id": "67215321a9f1b2c3d4e5f601",
      "title": "Quantum Advantage in Scientific Discovery",
      "authors": [
        { "given": "Alice", "family": "Smith" },
        { "given": "Bob", "family": "Jones" }
      ],
      "publicationYear": "2024",
      "publicationType": "journal-article",
      "journalTitle": "Nature Physics",
      "volume": "20",
      "issue": "4",
      "pages": "512-520",
      "doi": "10.1038/s41567-024-001",
      "metadataStatus": "verified",
      "isFavorite": true,
      "collectionIds": ["67215321a9f1b2c3d4e5f602"],
      "tags": ["quantum", "supremacy"]
    }
  ],
  "pagination": { "page": 1, "limit": 50, "totalCount": 1, "totalPages": 1 }
}
```

---

#### 3.2. DOI Metadata Lookup
- **Method**: `GET /api/v1/references/lookup/doi?doi=<doi>` OR `POST /api/v1/references/lookup/doi`
- **Request Body (for POST)**:
```json
{ "doi": "10.1038/s41586-020-2649-2" }
```
- **Response (200 OK)**:
```json
{
  "doi": "10.1038/s41586-020-2649-2",
  "reference": {
    "title": "Array programming with NumPy",
    "authors": [{ "family": "Harris", "given": "Charles R." }],
    "year": "2020",
    "journal": "Nature",
    "volume": "585",
    "pages": "357-362",
    "doi": "10.1038/s41586-020-2649-2",
    "url": "https://doi.org/10.1038/s41586-020-2649-2"
  },
  "existsInLibrary": false,
  "existingId": null
}
```

---

#### 3.3. Scholarly Search (Crossref & OpenAlex)
- **Method**: `GET /api/v1/references/search/scholarly?q=<query>&provider=<crossref|openalex>&limit=15` OR `POST /api/v1/references/search/scholarly`
- **Response (200 OK)**:
```json
{
  "query": "quantum computing",
  "total": 10,
  "results": [
    {
      "title": "Advances in Quantum Computing: A Systematic Analysis",
      "authors": [{ "given": "John", "family": "Doe" }, { "given": "Alice", "family": "Smith" }],
      "publicationYear": "2024",
      "journal": "Nature Physics",
      "doi": "10.1038/s41567-024-001",
      "sourceProvider": "crossref",
      "metadataStatus": "verified"
    }
  ]
}
```

---

#### 3.4. Create Reference Manually
- **Method**: `POST /api/v1/references`
- **Request Body**:
```json
{
  "title": "Foundations of Quantum Algorithms",
  "type": "book",
  "authors": [
    { "given": "Carol", "family": "Williams" },
    { "given": "David", "family": "Brown" }
  ],
  "publicationYear": "2023",
  "publisher": "Oxford University Press",
  "tags": ["textbook"],
  "collectionIds": ["67215321a9f1b2c3d4e5f602"]
}
```
- **Response (201 Created)**: Returns the persisted reference with its generated `id`.

---

#### 3.5. Single Reference CRUD
- `GET /api/v1/references/:id`: Fetch reference by ID.
- `PATCH /api/v1/references/:id`: Partially update fields (e.g., notes, tags, title, authors).
- `DELETE /api/v1/references/:id`: Non-destructive soft delete (sets `deletedAt: new Date()`).

---

#### 3.6. Import BibTeX & RIS
- **BibTeX**: `POST /api/v1/references/import/bibtex`
  - Body: `{ "bibtex": "@article{...}" }` or multipart file upload (`file`).
- **RIS**: `POST /api/v1/references/import/ris`
  - Body: `{ "ris": "TY  - JOUR\nTI  - ..." }` or multipart file upload (`file`).
- **Batch**: `POST /api/v1/references/import/batch`
  - Body: `{ "records": [...] }`.
- **Response (201 Created)**:
```json
{
  "importedCount": 5,
  "duplicateCount": 1,
  "references": [...],
  "duplicates": [{ "title": "Existing Paper", "reason": "Matching DOI", "matchType": "exact" }]
}
```

---

#### 3.7. Duplicate Detection & Merge
- **Detect**: `GET /api/v1/references/duplicates`
  - Returns duplicate pairs classified as `exact` (identical normalized DOI or citeKey), `probable` (high token title similarity + author overlap), or `possible`.
- **Merge**: `POST /api/v1/references/merge`
  - Request: `{ "primaryId": "<id1>", "secondaryId": "<id2>", "overrides": {} }`
  - Action: Consolidates metadata into `primaryId`, soft-deletes `secondaryId`, and records audit trace.

---

#### 3.8. CSL Citation Formatter & Bibliography Generator
- **Single Citation**: `POST /api/v1/references/format`
  - Body: `{ "reference": { ... }, "style": "apa7", "type": "parenthetical" }`
  - Styles: `apa7`, `mla9`, `chicago`, `harvard`, `ieee`, `vancouver`.
  - Types: `parenthetical`, `narrative`, `bibliography`.
  - Response: `{ "style": "apa7", "type": "parenthetical", "citation": "(Smith & Jones, 2024)" }`.
- **Multi-Reference Bibliography**: `POST /api/v1/references/bibliography`
  - Body: `{ "referenceIds": ["<id1>", "<id2>"], "style": "apa7", "format": "html" }`
  - Formats: `plaintext`, `html` (with `.csl-entry` and hanging indentation), `bibtex`, `ris`.
- **Export Library**: `GET /api/v1/references/export?format=bibtex` (or `format=ris`).

---

### 4. Reference Collections Endpoints
- `GET /api/v1/reference-collections`: List all collections owned by authenticated user.
- `POST /api/v1/reference-collections`: Create collection (`{ name, description, color, icon }`).
- `PATCH /api/v1/reference-collections/:id`: Update collection metadata.
- `DELETE /api/v1/reference-collections/:id`: Delete collection and automatically unlink it from associated references.
