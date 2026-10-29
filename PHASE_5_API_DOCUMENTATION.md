# ResearchProof AI 1.0 — Phase 5 API Documentation
## Complete Literature Review Studio REST Endpoints Specification

### Base URLs
- `/api/v1` (Standard versioned REST router)
- `/api` (Dual compatibility prefix)

All endpoints require JWT Bearer Authentication (`Authorization: Bearer <token>`) unless marked as public.

---

### 1. Scholarly Literature Discovery
#### `GET /api/v1/literature/search`
Queries Crossref and OpenAlex academic discovery databases with multi-criteria metadata filtering and automated offline fallbacks.

**Query Parameters:**
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `query` / `q` | `string` | **Yes** | Research topic, title keywords, or author names |
| `provider` | `string` | No | `'crossref'`, `'openalex'`, or `'all'` (default: `'crossref'`) |
| `limit` | `number` | No | Max results to return (default: `15`, max: `50`) |
| `yearMin` / `yearFrom` | `string` | No | Starting publication year (e.g., `2018`) |
| `yearMax` / `yearTo` | `string` | No | Ending publication year (e.g., `2025`) |
| `journal` | `string` | No | Journal name filter |
| `openAccessOnly` | `boolean` | No | Only open-access articles |

**Response (200 OK):**
```json
{
  "query": "cognitive load generative AI",
  "total": 12,
  "results": [
    {
      "title": "Cognitive Architecture and Instructional Design in Generative Tasks",
      "authors": ["Sweller, J.", "Paas, F."],
      "year": "2024",
      "journal": "Educational Psychology Review",
      "doi": "10.1007/s10648-023-09801-4",
      "url": "https://doi.org/10.1007/s10648-023-09801-4",
      "abstract": "We systematically evaluate working memory limits during generative AI prompting...",
      "studyDesign": "Randomized Controlled Trial",
      "sourceProvider": "crossref",
      "isOpenAccess": true
    }
  ]
}
```

---

### 2. Literature Paper Import
#### `POST /api/v1/literature/import`
Imports academic references into the active research project's literature matrix from the Reference Manager or external discovery.

**Request Body:**
```json
{
  "projectId": "654c123...",
  "source": "reference",
  "referenceId": "654c789...",
  "paperData": {
    "title": "Attention Is All You Need",
    "authors": ["Vaswani, A.", "Shazeer, N."],
    "year": "2017",
    "journal": "NeurIPS",
    "doi": "10.5555/3295222.3295349",
    "abstract": "The dominant sequence transduction models...",
    "status": "identified"
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "importedCount": 1,
  "imported": [
    {
      "_id": "654cf01...",
      "id": "654cf01...",
      "projectId": "654c123...",
      "title": "Attention Is All You Need",
      "status": "identified",
      "extractionStatus": "pending"
    }
  ],
  "entry": { ... }
}
```

---

### 3. Literature Matrix Entries CRUD
#### `GET /api/v1/literature`
Lists studies included in the literature review with multi-facet filtering and pagination headers.

**Query Parameters:**
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `projectId` | `string` | No | Scope by project ID |
| `status` | `string` | No | Filter by screening: `identified`, `screened`, `included`, `excluded` |
| `extractionStatus` | `string` | No | `pending`, `in_progress`, `completed`, `verified` |
| `thematicTag` | `string` | No | Filter by thematic clustering tag |
| `search` / `q` | `string` | No | Search within title, abstract, methodology, findings |
| `page` | `number` | No | Page number (default: `1`) |
| `limit` | `number` | No | Items per page (default: `50`) |
| `paginated` | `boolean` | No | Set to `'false'` for backward-compatible array |

**Headers Returned:**
- `X-Total-Count`: Total active records matching filter
- `X-Page`: Current page index
- `X-Total-Pages`: Total number of pages

**Response (200 OK):**
```json
{
  "entries": [
    {
      "_id": "654cf01...",
      "id": "654cf01...",
      "title": "Cognitive Architecture and Instructional Design in Generative Tasks",
      "authors": ["Sweller, J.", "Paas, F."],
      "year": "2024",
      "studyDesign": "Randomized Controlled Trial",
      "methodology": "Experimental laboratory study measuring secondary cognitive load",
      "sampleSize": "240",
      "keyFindings": "Structured scaffolding significantly reduced extraneous cognitive load...",
      "limitations": "Single-institution cohort; immediate post-test only.",
      "status": "included",
      "extractionStatus": "completed"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "totalCount": 1,
    "totalPages": 1
  }
}
```

#### `POST /api/v1/literature`
Creates a new literature review study entry with 25+ academic dimensions.

**Request Body:**
```json
{
  "projectId": "654c123...",
  "title": "Empirical Verification of Transformer Memory Constraints",
  "authors": ["Vaswani, A."],
  "year": "2024",
  "studyDesign": "Observational",
  "methodology": "Benchmarking memory footprint",
  "sampleSize": "1000 trials",
  "keyFindings": "Self-attention demonstrates O(n^2) scaling.",
  "status": "identified"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "_id": "654c333...",
  "id": "654c333...",
  "entry": { ... }
}
```

#### `GET /api/v1/literature/:entryId`
Retrieves a single literature entry by ID including its associated evidence extracts. Enforces user tenant isolation.

#### `PATCH /api/v1/literature/:entryId`
Updates metadata or empirical dimensions of a study.

#### `DELETE /api/v1/literature/:entryId`
Performs non-destructive soft deletion (`deletedAt: ISODate`) and enforces tenant ownership.

---

### 4. AI Structured Evidence Extraction
#### `POST /api/v1/literature/extract`
Extracts structured academic dimensions (objectives, study design, methodology, sample size, sampling method, statistical methods, key findings, effect estimates, limitations, future directions) from abstract or paper text.

**Request Body:**
```json
{
  "entryId": "654cf01...",
  "sourceText": "We conducted a randomized trial with N = 180 graduate nursing students...",
  "metadata": {
    "title": "High-Fidelity Simulation Trial",
    "year": "2024"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "entryId": "654cf01...",
  "extractionStatus": "extracted",
  "extractedCount": 6,
  "evidence": {
    "sampleSize": "180 graduate nursing students",
    "keyFindings": "statistically significant improvement in reasoning for the simulation group (F(1, 177) = 18.4, p < .001, Cohen's d = 0.65).",
    "limitations": "lack of blinding among clinical raters.",
    "methodology": "randomized controlled trial"
  },
  "studyUpdates": { ... },
  "entry": { ... }
}
```

---

### 5. Multi-Study Side-by-Side Comparison
#### `POST /api/v1/literature/compare`
Constructs side-by-side empirical comparison across 2 to 5 selected studies, generating consensus and divergence analysis.

**Request Body:**
```json
{
  "projectId": "654c123...",
  "entryIds": ["654cf01...", "654c333..."],
  "dimensions": ["studyDesign", "methodology", "sampleSize", "keyFindings", "limitations"]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "studyCount": 2,
  "studies": [
    {
      "id": "654cf01...",
      "title": "Study A",
      "authors": ["Author 1"],
      "year": "2024",
      "studyDesign": "Randomized Controlled Trial",
      "sampleSize": "240"
    },
    {
      "id": "654c333...",
      "title": "Study B",
      "authors": ["Author 2"],
      "year": "2023",
      "studyDesign": "Quasi-Experimental",
      "sampleSize": "180"
    }
  ],
  "comparisonGrid": { ... },
  "consensusAnalysis": "Sample sizes range across reviewed trials. Common limitations noted across literature.",
  "divergenceAnalysis": "Methodological divergence: Studies utilize differing designs (Randomized Controlled Trial vs. Quasi-Experimental)."
}
```

---

### 6. Thematic Analysis & Clustering
#### `GET /api/v1/literature/themes?projectId=...`
Returns all thematic clusters associated with a project.

#### `POST /api/v1/literature/themes`
Creates or updates a thematic cluster.

**Request Body:**
```json
{
  "projectId": "654c123...",
  "name": "Cognitive Architecture & Working Memory Limits",
  "description": "Studies exploring cognitive load theories and extraneous processing.",
  "color": "#6366f1",
  "studyIds": ["654cf01..."]
}
```

---

### 7. Empirical Research Gap Analysis
#### `POST /api/v1/literature/gaps`
Evaluates the corpus of literature to identify grounded candidate research gaps across 8 academic typologies.

**Request Body:**
```json
{
  "projectId": "654c123...",
  "entryIds": ["654cf01...", "654c333..."]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "projectId": "654c123...",
  "totalGaps": 4,
  "candidateGaps": [
    {
      "title": "Predominance of Cross-Sectional Designs and Causal Inference Limitations",
      "gapType": "methodological",
      "category": "methodological",
      "description": "The evaluated studies predominantly utilize cross-sectional observational methodology...",
      "evidenceBasis": "Identified across 2 study(ies) relying on observational snapshot data.",
      "researchQuestions": [
        "Does the observed association persist when tested within a multi-wave longitudinal panel design?",
        "What causal mechanisms emerge when tested under controlled experimental manipulation?"
      ]
    }
  ]
}
```

---

### 8. Evidence-Linked Synthesis Generation
#### `POST /api/v1/literature/synthesis`
Generates structured academic review drafts with strict APA 7 in-text citations.

**Synthesis Typologies:**
- `thematic`: Organizes evidence by conceptual thematic clusters
- `narrative`: Fluid narrative review structured around overarching research questions
- `chronological`: Traces theoretical and empirical progression across timeline
- `methodological`: Groups studies by empirical design (RCT, Quasi-exp, Qualitative, Meta-analysis)

**Request Body:**
```json
{
  "projectId": "654c123...",
  "type": "thematic",
  "focusResearchQuestion": "How does cognitive load influence generative task performance?"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "draftId": "654d999...",
  "title": "Systematic Literature Review Synthesis",
  "type": "thematic",
  "studyCount": 2,
  "sections": [
    {
      "title": "Cognitive Architecture",
      "synthesisText": "A critical examination of the literature regarding 'Cognitive Architecture' incorporates findings from 1 study(ies) (Sweller & Paas, 2024)...",
      "citations": ["654cf01..."]
    }
  ],
  "fullDraft": "# Systematic Literature Review Synthesis\n\n## Executive Overview...",
  "evidenceLinks": [
    {
      "claimText": "Empirical findings in Cognitive Architecture",
      "studyId": "654cf01..."
    }
  ]
}
```

---

### 9. Multi-Format Literature Matrix & Citation Export
#### `GET /api/v1/literature/export`
Exports the empirical literature matrix or citations in academic formats.

**Query Parameters:**
- `projectId`: **Required**
- `format`: `'csv'` (RFC 4180 spreadsheet) or `'bibtex'` (BibTeX citations)

**Responses:**
- `format=csv`: `Content-Type: text/csv; charset=utf-8`
- `format=bibtex`: `Content-Type: text/plain; charset=utf-8`

---

### 10. Backward Compatibility Endpoints
To guarantee existing client components continue functioning without breakage:
- `GET /api/v1/projects/:id/literature` $\to$ Returns array of entries
- `POST /api/v1/projects/:id/literature` $\to$ Creates entry with legacy payload
- `DELETE /api/v1/projects/:id/literature/:entryId` $\to$ Soft deletes entry
- `POST /api/v1/projects/:id/literature/synthesize` $\to$ Returns synthesis object
