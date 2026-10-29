# Phase 6 — API Documentation

## 1. Overview & Dual-Prefix Support

All Phase 6 endpoints are mounted under `apiRouter` and accessible via both `/api` and `/api/v1` prefixes. Authentication is strictly required via `Authorization: Bearer <token>`.

---

## 2. PDF Document Intelligence Endpoints

### 2.1. Upload & Index Documents
- **`POST /api/v1/pdf-chat/documents/upload`**
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `files` or `file`: Binary document(s) (PDF, TXT, DOCX; up to 25MB).
  - `projectId`: Target research project ID.
  - `force`: Optional boolean (`true` forces reindexing even if duplicate checksum exists).
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "count": 1,
    "documents": [
      {
        "id": "673f8a...",
        "title": "Clinical Trial Analysis",
        "filename": "trial.pdf",
        "pageCount": 14,
        "chunkCount": 28,
        "checksum": "a8f3...",
        "status": "indexed",
        "isDuplicate": false
      }
    ]
  }
  ```

### 2.2. List Project Documents
- **`GET /api/v1/pdf-chat/documents`**
- **Query Parameters**:
  - `projectId`: Scoped project ID.
  - `search`: Filter by filename, title, or abstract.
  - `page`: Page number (default: 1).
  - `limit`: Items per page (default: 50).
- **Response**: `200 OK`
  ```json
  {
    "documents": [...],
    "pagination": { "total": 4, "page": 1, "limit": 50, "totalPages": 1 }
  }
  ```

### 2.3. Get Document Details & Status
- **`GET /api/v1/pdf-chat/documents/:documentId`**
- **`GET /api/v1/pdf-chat/documents/:documentId/status`**
- **Response**: `200 OK`
  ```json
  {
    "status": "indexed",
    "progress": 100,
    "pageCount": 14,
    "chunkCount": 28,
    "updatedAt": "2026-10-29T14:00:00.000Z"
  }
  ```

### 2.4. Document Content & Streaming
- **`GET /api/v1/pdf-chat/documents/:documentId/content`**
- **Query Parameters**:
  - `format`: `text` (default) or `raw` (streams PDF binary buffer with inline disposition).
- **Response**: `200 OK` with JSON array of page chunks or binary stream.

### 2.5. Reindex Document
- **`POST /api/v1/pdf-chat/documents/:documentId/reindex`**
- **Response**: `200 OK`
  ```json
  { "success": true, "message": "Document reindexed successfully.", "chunkCount": 28 }
  ```

### 2.6. Soft Delete Document
- **`DELETE /api/v1/pdf-chat/documents/:documentId`**
- **Response**: `200 OK`
  ```json
  { "success": true, "deleted": true }
  ```

---

## 3. Grounded Research Conversations

### 3.1. List Conversations
- **`GET /api/v1/pdf-chat/conversations?projectId=:projectId`**
- **Response**: `200 OK`

### 3.2. Create Conversation
- **`POST /api/v1/pdf-chat/conversations`**
- **Body**:
  ```json
  {
    "projectId": "673f...",
    "title": "Oncology Clinical Trial Review",
    "documentIds": ["673f8a...", "673f8b..."],
    "mode": "methodology"
  }
  ```
- **Response**: `201 Created`

### 3.3. Grounded Message Synthesis
- **`POST /api/v1/pdf-chat/conversations/:chatId/messages`**
- **Body**:
  ```json
  {
    "query": "What were the primary empirical findings and effect sizes?",
    "mode": "findings",
    "selectedDocumentIds": ["673f8a..."]
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": {
      "role": "assistant",
      "content": "Based on the manuscript evidence...",
      "citations": [
        {
          "documentTitle": "Clinical Trial Analysis",
          "page": 7,
          "score": 0.88,
          "citationTag": "[Clinical Trial Analysis, p. 7]"
        }
      ],
      "retrievalStatus": "grounded"
    },
    "citations": [...],
    "validation": { "valid": true, "unverifiedTags": [], "unsupportedCount": 0 },
    "retrievedChunks": 4
  }
  ```

### 3.4. Citation Provenance & Verification
- **`GET /api/v1/pdf-chat/messages/:messageId/evidence`**
- **Response**: `200 OK`
  ```json
  {
    "messageId": "msg123",
    "count": 1,
    "evidences": [
      {
        "id": "ev456",
        "documentTitle": "Clinical Trial Analysis",
        "documentId": "673f8a...",
        "pageNumber": 7,
        "sourceExcerpt": "The intervention yielded statistically significant improvements...",
        "score": 0.88,
        "verified": true
      }
    ]
  }
  ```

---

## 4. Cross-Module Integration Endpoints

### 4.1. Send Document to Literature Review Matrix
- **`POST /api/v1/pdf-chat/documents/:documentId/send-to-literature`**
- Creates a `LiteratureEntry` populated with extracted metadata, methodology, and findings.
- **Response**: `201 Created`

### 4.2. Link Document to Reference Manager
- **`POST /api/v1/pdf-chat/documents/:documentId/link-reference`**
- Creates a structured `Reference` record in the project library.
- **Response**: `201 Created`

---

## 5. Legacy Route Compatibility

The following endpoints remain 100% backward-compatible:
- `POST /api/v1/projects/:id/pdf-chat/upload`
- `GET /api/v1/projects/:id/pdf-chat`
- `GET /api/v1/projects/:id/pdf-chat/:chatId`
- `POST /api/v1/projects/:id/pdf-chat/:chatId/message`
