# ResearchProof AI 1.0 — Phase 6 Implementation Plan
## PDF Research Chat & Document Intelligence (Grounded RAG Architecture)

### 1. Executive Summary & Verification of Previous Phases
- **Application:** ResearchProof AI 1.0
- **Repository:** `https://github.com/sabujd880-lgtm/research_proof` (Branch: `main`, latest commit `af32b67`)
- **Production Target:** Render Production (`https://research-proof-1.onrender.com`)
- **Regression Baseline:** All 88 platform tests across Phase 3 (Projects Dashboard), Phase 4 (Reference Manager), Phase 5 (Literature Review Studio), and System Audit pass with 100% success rate.
- **Client Build Status:** Vite v6.4.5 + TypeScript bundle builds in 7.33s with 0 errors.

---

### 2. Primary Objective & Research Workflow
Implement a complete, secure, evidence-grounded PDF Research Chat & Document Intelligence workspace integrated natively within ResearchProof AI 1.0.

$$\text{Upload PDFs} \longrightarrow \text{Page-Aware Extraction} \longrightarrow \text{Evidence Chunking \& Indexing} \longrightarrow \text{Document Selection} \longrightarrow \text{Query / Preset} \longrightarrow \text{Hybrid Semantic \& Keyword Retrieval} \longrightarrow \text{Grounded Answer Synthesis} \longrightarrow \text{Page-Level Citation Verification} \longrightarrow \text{PDF Viewer \& Evidence Highlight} \longrightarrow \text{Persistent Research Conversation}$$

**Guiding Integrity Principle:** Never fabricate document content, quotations, statistics, page numbers, or citations. If evidence is absent or ambiguous, the system explicitly reports insufficient evidence.

---

### 3. Architecture & Technical Strategy

```
                                      ┌─────────────────────────────────────────┐
                                      │  User / Client (Split-View Workspace)  │
                                      └────────────────────┬────────────────────┘
                                                           │
                                      ┌────────────────────▼────────────────────┐
                                      │    POST /api/v1/pdf-chat/documents/upload│
                                      └────────────────────┬────────────────────┘
                                                           │
                               ┌───────────────────────────┴───────────────────────────┐
                               ▼                                                       ▼
                [ File Validation & Safety ]                              [ Private File Storage ]
                - Magic bytes (`%PDF-`) check                             - Project-scoped storage key
                - Size & page count bounds                                - SHA-256 integrity checksum
                - PDF script stripping                                    - Never stored in public web dir
                               │                                                       │
                               └───────────────────────────┬───────────────────────────┘
                                                           │
                                      ┌────────────────────▼────────────────────┐
                                      │  Page-Aware Text & Structural Extractor │
                                      │  - Page numbers, paragraphs, headings   │
                                      │  - Handles multi-column & hyphenation   │
                                      └────────────────────┬────────────────────┘
                                                           │
                                      ┌────────────────────▼────────────────────┐
                                      │  Evidence-Preserving Document Chunking │
                                      │  - Stable chunk IDs (`doc-pX-cIndex`)   │
                                      │  - Context preservation & token bounds  │
                                      └────────────────────┬────────────────────┘
                                                           │
                                      ┌────────────────────▼────────────────────┐
                                      │  Vector & Inverted Hybrid Index Store  │
                                      │  - DocumentChunk collection             │
                                      │  - TF-IDF / BM25 term frequency index   │
                                      │  - Dense vector embeddings              │
                                      └────────────────────┬────────────────────┘
                                                           │
                                      ┌────────────────────▼────────────────────┐
                                      │   User Query & Research Question Modes  │
                                      │   (Single or Multi-PDF Selection)       │
                                      └────────────────────┬────────────────────┘
                                                           │
                                      ┌────────────────────▼────────────────────┐
                                      │   Hybrid Retrieval & Reranker Engine   │
                                      │   - Project & tenant permission filter  │
                                      │   - Bounded Top-K passage scoring       │
                                      └────────────────────┬────────────────────┘
                                                           │
                                      ┌────────────────────▼────────────────────┐
                                      │ Grounded Evidence Synthesis & Citations │
                                      │ - Exact page anchors [Paper, p. 4]     │
                                      │ - CitationEvidence provenance records   │
                                      │ - Anti-hallucination validation gate    │
                                      └────────────────────┬────────────────────┘
                                                           │
                                      ┌────────────────────▼────────────────────┐
                                      │ Integrated PDF Viewer & Evidence Panel  │
                                      │ - Navigate directly to cited page       │
                                      │ - Highlight verbatim evidence passage   │
                                      │ - Link to Reference & Literature Studio │
                                      └─────────────────────────────────────────┘
```

---

### 4. Implementation Steps & Milestones

#### Phase 6.1 — Database Architecture (`server/src/models.js`)
- Create or extend:
  - `Document`: Dedicated research document record (`projectId`, `ownerId`, `referenceId`, `filename`, `originalFilename`, `mimeType`, `fileSize`, `storageKey`, `checksum`, `pageCount`, `extractionStatus`, `indexingStatus`, `language`, `deletedAt`).
  - `DocumentChunk`: Page-anchored chunks (`documentId`, `projectId`, `pageNumber`, `chunkIndex`, `text`, `textHash`, `tokenCount`, `sectionHeading`, `embedding`, `boundingBoxes`).
  - `DocumentIndex`: Metadata index and term statistics for hybrid search.
  - `ResearchChat`: Conversation sessions (`projectId`, `ownerId`, `title`, `selectedDocumentIds`, `mode`).
  - `ResearchChatMessage`: Messages with structured citations (`chatId`, `role`, `content`, `citations`, `retrievalStatus`).
  - `CitationEvidence`: Provenance records tying message citations directly to exact chunk and page.
  - `DocumentProcessingJob`: Durable processing queue (`documentId`, `status: queued|processing|completed|failed`, `progress`, `error`).

#### Phase 6.2 — Core Engine & Extraction Service (`server/src/pdfChatService.js`)
- Robust page-aware PDF text stream extractor supporting compressed streams, text matrix operators, character offsets, and structural paragraph reconstruction.
- Evidence-preserving chunker retaining page numbers and section headers.
- Hybrid retrieval engine combining semantic vector matching and BM25 term scoring.
- Grounded synthesis engine enforcing strict evidence bounds and APA/page-level citation generation (`[Title, p. X]`).
- Citation validation engine confirming all generated citation tags match retrieved passages.

#### Phase 6.3 — REST API Endpoints (`server/src/index.js`)
- Document Upload & Management:
  - `POST /api/v1/pdf-chat/documents/upload`
  - `GET /api/v1/pdf-chat/documents`
  - `GET /api/v1/pdf-chat/documents/:documentId`
  - `GET /api/v1/pdf-chat/documents/:documentId/status`
  - `DELETE /api/v1/pdf-chat/documents/:documentId`
  - `GET /api/v1/pdf-chat/documents/:documentId/content` (Private PDF stream)
- Conversation & Chat Management:
  - `GET /api/v1/pdf-chat/conversations`
  - `POST /api/v1/pdf-chat/conversations`
  - `GET /api/v1/pdf-chat/conversations/:chatId`
  - `PATCH /api/v1/pdf-chat/conversations/:chatId`
  - `DELETE /api/v1/pdf-chat/conversations/:chatId`
- Messaging & Evidence:
  - `POST /api/v1/pdf-chat/conversations/:chatId/messages`
  - `GET /api/v1/pdf-chat/messages/:messageId/evidence`
- Integrations:
  - `POST /api/v1/pdf-chat/documents/:documentId/send-to-literature`
  - `POST /api/v1/pdf-chat/documents/:documentId/link-reference`
- Full backward compatibility for `/projects/:id/pdf-chat/*`.

#### Phase 6.4 — Split-View Enterprise UI (`client/src/modules/PdfResearchChat.tsx`)
- Linear-inspired split-view interface:
  - **Left Panel:** Document library, multi-select checkboxes, document upload zone, integrated PDF page viewer with zoom, page navigation, search, and evidence highlights.
  - **Right Panel:** Conversation history, preset research question triggers (Summarize, Methodology, Sample Size, Statistical Findings, Limitations, Research Gaps, Evidence Table), message thread, citation pills, evidence passage inspector, and chat input.
  - **Cross-Module Integrations:** "Send Evidence to Literature Review Matrix" and "View Linked Reference".

#### Phase 6.5 — Verification & Automated Testing (`server/test/phase6_pdf_chat.test.js`)
- Comprehensive test suite covering PDF upload, text extraction, page mapping, chunking, hybrid retrieval, single & multi-document chat, citation verification, missing evidence responses, tenant isolation, and soft deletion.
- Full regression verification across all 88+ platform tests.

#### Phase 6.6 — Documentation Deliverables
- `PHASE_6_IMPLEMENTATION_PLAN.md`
- `PHASE_6_RAG_ARCHITECTURE.md`
- `PHASE_6_DATABASE_SCHEMA.md`
- `PHASE_6_API_DOCUMENTATION.md`
- `PHASE_6_CITATION_VALIDATION.md`
- `PHASE_6_SECURITY_REPORT.md`
- `PHASE_6_TEST_REPORT.md`
- `PHASE_6_RELEASE_GATE.md`

