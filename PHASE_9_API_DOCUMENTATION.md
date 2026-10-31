# RESEARCHPROOF AI 1.0 — PHASE 9 API SPECIFICATION
## JOURNAL SUBMISSION STUDIO ENDPOINT REFERENCE

### Overview
This document specifies all RESTful API endpoints for the Journal Submission Studio in ResearchProof AI 1.0. All endpoints are authenticated via JWT Bearer token or active session and enforce strict project-level access controls.

Base URL prefix: `/api/v1` (with alias `/api`)

---

### 1. Journal Discovery

#### `GET /api/v1/journals/search`
Discovers vetted scholarly journals matching search terms, research subjects, indexing agencies, access models, and fee caps.

- **Authentication**: Required (`Authorization: Bearer <token>`)
- **Query Parameters**:
  - `q` (string, optional): Full-text search across journal title, publisher, and subject areas.
  - `subject` (string, optional): Discipline filter (e.g., `"Computer Science"`, `"Medicine"`).
  - `indexing` (string, optional): Filter by verified indexing (`"Scopus"`, `"Web of Science"`, `"PubMed"`, `"DOAJ"`).
  - `openAccess` (boolean string, optional): `"true"` for Open Access journals.
  - `maxApc` (number, optional): Maximum Article Processing Charge in USD.
  - `page` (number, default: 1): Page number.
  - `limit` (number, default: 10): Results per page.
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "journals": [
      {
        "id": "nature-comms",
        "title": "Nature Communications",
        "publisher": "Springer Nature",
        "issn": "2041-1723",
        "openAccess": true,
        "impactFactor": 16.6,
        "citeScore": 23.4,
        "acceptanceRate": 15,
        "avgReviewWeeks": 12,
        "indexing": ["Scopus", "Web of Science", "PubMed", "DOAJ"],
        "apcUsd": 6490,
        "subjectAreas": ["Multidisciplinary", "Natural Sciences", "Bioengineering", "Computer Science"]
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10
  }
  ```

#### `GET /api/v1/journals/:id`
Retrieves detailed profile metadata for a specific scholarly journal.

- **Authentication**: Required
- **URL Parameters**: `id` (string) — Unique journal identifier.
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "journal": {
      "id": "nature-comms",
      "title": "Nature Communications",
      "guidelinesUrl": "https://www.nature.com/ncomms/submit",
      "ethicalFramework": "COPE (Committee on Publication Ethics)",
      "dataSharingPolicy": "Mandatory repository deposition upon acceptance"
    }
  }
  ```
- **Error Responses**:
  - `404 Not Found`: `{ "error": "Journal not found" }`

---

### 2. Journal Recommendation & Matching

#### `POST /api/v1/journals/match`
Ranks vetted journals against manuscript title, abstract, keywords, word count, and target constraints using tf-idf keyword vectors and criteria scoring.

- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "title": "Deep Learning for Genomic Variant Detection",
    "abstract": "We present a transformer-based framework...",
    "keywords": ["deep learning", "genomics", "bioinformatics"],
    "wordCount": 5400,
    "openAccessPreferred": true,
    "maxApc": 5000
  }
  ```
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "totalEvaluated": 10,
    "recommendations": [
      {
        "journal": { "id": "plos-comp-bio", "title": "PLOS Computational Biology" },
        "matchScore": 88,
        "category": "High Match",
        "reasons": [
          "Strong keyword alignment with aims & scope: computational biology, machine learning",
          "Open Access policy aligns with author preferences",
          "Within APC budget limit ($3,150 <= $5,000)"
        ],
        "strengths": ["Fully matches word limit requirements", "Indexed in Scopus and PubMed"],
        "considerations": ["Review turnaround averages 10 weeks"]
      }
    ]
  }
  ```

---

### 3. Guidelines & Automated Compliance Checking

#### `GET /api/v1/journals/:id/guidelines`
Retrieves structured author submission guidelines, formatting rules, word limits, reference styles, and declaration mandates.

- **Authentication**: Required
- **URL Parameters**: `id` (string)
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "guidelines": {
      "journalId": "nature-comms",
      "journalTitle": "Nature Communications",
      "wordLimit": 5000,
      "abstractLimit": 250,
      "maxFigures": 10,
      "maxTables": 6,
      "referenceStyle": "Nature / Vancouver (Numbered)",
      "requiredSections": ["Abstract", "Introduction", "Results", "Discussion", "Methods", "Data Availability", "References"],
      "ethicalDeclarations": ["Conflict of Interest statement", "Data Availability statement", "Funding information", "Author Contributions (CRediT)"]
    }
  }
  ```

#### `POST /api/v1/journals/check-compliance`
Audits manuscript content against journal constraints, verifying structure, limits, reference counts, and required ethical statements.

- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "journalId": "nature-comms",
    "manuscriptData": {
      "title": "Transformer Attention Mechanisms for Multi-Omics Data Integration",
      "abstract": "Comprehensive analysis of high-throughput genomic data...",
      "bodyText": "Introduction...\nResults...\nMethods...\nData Availability...",
      "wordCount": 4200,
      "figuresCount": 5,
      "tablesCount": 2,
      "referencesCount": 45,
      "declaredEthics": {
        "coi": true,
        "dataAvailability": true,
        "funding": true,
        "ethicsApproval": false,
        "authorContributions": true
      }
    }
  }
  ```
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "auditResult": {
      "journalId": "nature-comms",
      "journalTitle": "Nature Communications",
      "overallPassed": true,
      "complianceScore": 92,
      "checks": [
        { "item": "Word Count Check", "passed": true, "details": "4,200 words (Max: 5,000)" },
        { "item": "Required Sections Check", "passed": true, "details": "Found: Abstract, Introduction, Results, Discussion, Methods, Data Availability, References" },
        { "item": "Ethical Statements", "passed": true, "details": "4 of 4 required declarations verified" }
      ],
      "warnings": [],
      "blockingIssues": []
    }
  }
  ```

---

### 4. Submission Workspace Lifecycle

#### `GET /api/v1/projects/:id/submission`
Fetches the active submission workspace record for a research project.

- **Authentication**: Required
- **URL Parameters**: `id` (string) — Project ID
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "submission": {
      "_id": "6724...",
      "projectId": "6720...",
      "status": "ready_to_package",
      "targetJournal": {
        "journalId": "plos-comp-bio",
        "journalTitle": "PLOS Computational Biology"
      },
      "complianceReport": { "overallPassed": true, "complianceScore": 95 },
      "coverLetter": "Dear Editor-in-Chief...",
      "ethicalDeclarations": { "conflictOfInterest": "None", "dataAvailability": "Zenodo repository" },
      "timeline": [
        { "event": "created", "timestamp": "2026-10-31T05:30:00Z" }
      ]
    }
  }
  ```

#### `POST /api/v1/projects/:id/submission`
Initializes or updates the target journal, ethical statements, and manuscript parameters for a project submission.

- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "journalId": "plos-comp-bio",
    "journalTitle": "PLOS Computational Biology",
    "manuscriptDocumentId": "6721...",
    "coverLetter": "Dear Editor...",
    "ethicalDeclarations": {
      "coi": "No conflicts of interest to declare.",
      "funding": "Funded by NIH grant R01-HG001234.",
      "dataAvailability": "All datasets deposited in NCBI GEO GSE12345.",
      "irbApproval": "IRB exempt — non-human subject computational research."
    }
  }
  ```
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "submission": { ... }
  }
  ```

---

### 5. Academic Cover Letter Generation

#### `POST /api/v1/projects/:id/submission/cover-letter`
Synthesizes a publication-ready academic cover letter adhering to editorial protocols.

- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "journalId": "nature-comms",
    "manuscriptTitle": "Transformer Models in Genomic Diagnostics",
    "authorNames": ["Dr. Jane Doe", "Dr. John Smith"],
    "correspondingAuthorEmail": "j.doe@institution.edu",
    "keyFindings": ["30% accuracy improvement over standard CNNs", "Identified 12 novel pathogen markers"],
    "significanceStatement": "Transforms clinical interpretation of long-read sequencing.",
    "suggestedReviewers": ["Prof. Alan Turing (Cambridge)", "Dr. Rosalind Franklin (King's)"],
    "opposedReviewers": []
  }
  ```
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "coverLetter": "Date: October 31, 2026\n\nTo the Editor-in-Chief,\nNature Communications\n\nDear Editor,\n\nPlease find enclosed our manuscript entitled \"Transformer Models in Genomic Diagnostics\"..."
  }
  ```

---

### 6. Submission Package Assembly & Download

#### `POST /api/v1/projects/:id/submission/package`
Generates a cryptographically verified ZIP archive bundling the main manuscript, cover letter, ethical declarations, compliance report, and SHA-256 manifest.

- **Authentication**: Required
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "manifest": {
      "generatedAt": "2026-10-31T05:40:00Z",
      "files": [
        { "name": "01_Main_Manuscript.txt", "sizeBytes": 28410, "sha256": "4b6e..." },
        { "name": "02_Cover_Letter.txt", "sizeBytes": 2180, "sha256": "8a3c..." },
        { "name": "03_Ethics_and_Declarations.txt", "sizeBytes": 1540, "sha256": "7c12..." },
        { "name": "04_Manuscript_Compliance_Report.json", "sizeBytes": 3490, "sha256": "9f01..." },
        { "name": "manifest.json", "sizeBytes": 890, "sha256": "2d54..." }
      ],
      "packageSha256": "e2a1b9c3f4..."
    },
    "message": "Submission package assembled successfully"
  }
  ```

#### `GET /api/v1/projects/:id/submission/package/download`
Streams the compiled ZIP submission package binary to the client.

- **Authentication**: Required
- **Response Headers**:
  - `Content-Type: application/zip`
  - `Content-Disposition: attachment; filename="researchproof_submission_package_<projectId>.zip"`
- **Response Body**: Raw binary stream of ZIP file.

---

### 7. Submission Tracking & Editorial Milestones

#### `POST /api/v1/projects/:id/submission/status`
Updates the peer review lifecycle status and appends timestamped editorial milestones.

- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "status": "under_review",
    "note": "Manuscript sent to three external peer reviewers.",
    "manuscriptTrackingId": "NCOMMS-26-14920-T"
  }
  ```
- **Valid Status Values**:
  - `draft`, `journal_selected`, `compliance_checked`, `package_generated`, `submitted`, `under_review`, `minor_revision`, `major_revision`, `revised_submitted`, `accepted`, `in_production`, `published`, `rejected`
- **Success Response** (`200 OK`):
  ```json
  {
    "success": true,
    "status": "under_review",
    "timeline": [
      { "event": "created", "timestamp": "2026-10-31T05:30:00Z" },
      { "event": "package_generated", "timestamp": "2026-10-31T05:40:00Z" },
      { "event": "under_review", "timestamp": "2026-10-31T05:45:00Z", "note": "Manuscript sent to three external peer reviewers." }
    ]
  }
  ```
