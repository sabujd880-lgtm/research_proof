# Phase 6 — Database Schema & Data Models

## 1. Overview

Phase 6 introduces five dedicated MongoDB Mongoose schemas to support multi-document indexing, traceable evidence extraction, and grounded chat conversations. All models are backed by an in-memory development store for complete zero-dependency operation.

---

## 2. Model Specifications

### 2.1. `ResearchDocument`
Represents an uploaded manuscript, preprint, or empirical publication.
```typescript
interface IResearchDocument {
  projectId: ObjectId;              // Scoped project
  ownerId: ObjectId;                // User who uploaded the document
  userId?: ObjectId;                // Compatibility alias
  referenceId?: ObjectId;           // Optional link to Reference record
  filename: string;                 // Original filename (e.g. "lancet_trial.pdf")
  title: string;                    // Extracted title or filename base
  fileSize: number;                 // Size in bytes (up to 25MB)
  mimeType: string;                 // Default "application/pdf"
  checksum: string;                 // SHA-256 hash for deduplication
  storageKey?: string;              // Private storage or in-memory key
  pageCount: number;                // Total extracted pages
  chunkCount: number;               // Total generated chunks
  status: 'pending' | 'processing' | 'indexed' | 'failed';
  metadata: {
    authors: Array<{ name?: string; family?: string; given?: string }>;
    year?: number;
    journal?: string;
    doi?: string;
    abstract?: string;
  };
  deletedAt?: Date;                 // Non-destructive soft deletion timestamp
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2. `DocumentChunk`
Granular, page-aware text chunks preserving provenance and vector representations.
```typescript
interface IDocumentChunk {
  documentId: ObjectId;             // Parent ResearchDocument
  projectId: ObjectId;              // Scoped project
  chunkId: string;                  // Unique key, e.g. "doc1_p2_c3"
  chunkIndex: number;               // 0-indexed position
  pageNumber: number;               // Verified 1-based page number
  sectionTitle?: string;            // Detected section heading
  text: string;                     // Verbatim passage text
  content?: string;                 // Alias for compatibility
  tokenCount: number;               // Estimated token count
  characterStart?: number;          // Page character offset start
  characterEnd?: number;            // Page character offset end
  embedding?: number[];             // 64-dim dense vector
  textHash: string;                 // MD5 checksum of chunk text
  createdAt: Date;
}
```

### 2.3. `DocumentIndex`
Tracks aggregate indexing telemetry and token counts.
```typescript
interface IDocumentIndex {
  documentId: ObjectId;             // Parent ResearchDocument
  projectId: ObjectId;              // Scoped project
  totalChunks: number;              // Total chunks indexed
  totalTokens: number;              // Total token volume
  lastIndexedAt: Date;              // Timestamp of last indexation
  version: number;                  // Index format version
}
```

### 2.4. `CitationEvidence`
Fine-grained provenance linking synthesized statements back to exact source excerpts.
```typescript
interface ICitationEvidence {
  messageId: string;                // Assistant message ID
  chatId: string;                   // ResearchChat conversation ID
  documentId: ObjectId;             // Source document
  documentTitle?: string;           // Human-readable document title
  pageNumber: number;               // Source page
  sourceExcerpt: string;            // Verbatim excerpt
  score: number;                    // Combined relevance score (0.0 to 1.0)
  claim: string;                    // Specific empirical claim supported
  verified: boolean;                // Whether citation tag verified against source
  createdAt: Date;
}
```

### 2.5. Extended `ResearchChat`
Enhanced conversation thread supporting multi-document grounding.
```typescript
interface IResearchChat {
  projectId: ObjectId;
  userId: ObjectId;
  ownerId?: ObjectId;
  title: string;
  documentName?: string;
  selectedDocumentIds: ObjectId[];  // Multi-document selection array
  mode: string;                     // e.g. 'summary' | 'methodology' | 'table' | 'default'
  documentChunks?: any[];           // Legacy compatibility chunks
  messages: Array<{
    _id?: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    citations?: Array<{
      documentId?: string;
      documentTitle?: string;
      page: number;
      passage?: string;
      score: number;
      evidenceId?: string;
    }>;
    retrievalStatus?: 'grounded' | 'empty';
    timestamp: Date;
  }>;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 3. Storage Strategy & Binary Handling
- **Raw PDF Buffers**: Kept in ephemeral memory storage (`memDocumentStorage`) and never embedded inside MongoDB documents, preventing BSON 16MB document size limit issues.
- **Deduplication**: Enforced via SHA-256 checksums on `checksum` field. Uploading an identical PDF reuses the existing `ResearchDocument` and `DocumentChunk` records.
- **Soft Deletion**: Implemented with `deletedAt` timestamps across all models to ensure non-destructive archival and easy restoration.
