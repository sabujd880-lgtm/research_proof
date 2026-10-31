# RESEARCHPROOF AI 1.0 — PHASE 9 DATABASE SCHEMA
## JOURNAL SUBMISSION STUDIO

**Date:** October 31, 2026  
**Status:** Active Production Schema  
**Database:** MongoDB Atlas + Mongoose ODM (with In-Memory Dev Store fallback)  

---

## 1. Schema Definitions

### 1.1 `Journal` Schema
Stores verified scholarly publishing venues with Crossref and DOAJ provenance:
```typescript
interface IJournal {
  id: string; // Unique registry identifier, e.g., 'j-mit-jocn'
  title: string; // Official journal title
  issn: string; // Print ISSN
  eissn?: string; // Electronic ISSN
  publisher: string; // Publishing organization (MIT Press, Nature Portfolio, IEEE, etc.)
  discipline: string; // Academic field
  publicationModel: 'gold_oa' | 'hybrid' | 'diamond_oa' | 'subscription';
  openAccess: boolean;
  aimsAndScope: string; // Official editorial scope description
  articleTypes: string[]; // Supported submission formats
  wordLimit: number; // Maximum manuscript word count
  abstractLimit: number; // Maximum abstract word count
  keywordLimit: number; // Maximum index keywords allowed
  requiredSections: string[]; // Mandatory structural headers
  citationStyle: string; // APA 7, Vancouver, IEEE, etc.
  figuresRequirements: string; // DPI and image file format specifications
  supplementaryAllowed: boolean;
  reportingGuideline: string; // CONSORT, PRISMA, STROBE, etc.
  sourceProvenance: string; // e.g., 'DOAJ / Crossref Verified'
  guidelinesUrl: string; // Direct link to publisher author instructions
  lastVerified: Date | string; // Timestamp of latest editorial audit
}
```

### 1.2 `JournalSubmission` Schema
Maintains the submission lifecycle for an empirical project manuscript:
```typescript
interface IJournalSubmission {
  projectId: ObjectId; // Ref: Project (Indexed)
  userId: ObjectId; // Ref: User (Indexed)
  targetJournal: string; // Target journal name
  selectedJournalId?: string; // Registry ID
  publisher: string;
  aimsAndScope: string;
  manuscriptTitle: string;
  manuscriptId?: string; // Official publisher tracking code (e.g. JOCN-2026-0492)
  wordLimit: number;
  citationStyle: string;
  guidelinesChecklist: Array<{
    item: string;
    compliant: boolean;
    notes?: string;
  }>;
  coverLetter: string;
  submissionPackage: Array<{
    fileName: string;
    fileType: string;
    urlOrPath: string;
  }>;
  packageManifest?: {
    packageName: string;
    targetJournal: string;
    generatedAt: string;
    totalFiles: number;
    files: Array<{
      fileName: string;
      description: string;
      sha256: string;
      bytes: number;
    }>;
  };
  complianceReport?: {
    overallCompliance: 'compliant' | 'minor_issues' | 'non_compliant';
    compliancePercentage: number;
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    reviewChecks: number;
    checks: Array<{
      id: string;
      category: string;
      requirement: string;
      actual: string;
      status: 'passed' | 'failed' | 'needs_review';
      remediation: string;
    }>;
  };
  status:
    | 'draft'
    | 'ready_for_submission'
    | 'submitted'
    | 'editorial_review'
    | 'peer_review'
    | 'revision_requested'
    | 'revised_submission'
    | 'accepted'
    | 'rejected'
    | 'withdrawn';
  notes?: string;
  submissionDate?: Date;
  decisionDate?: Date;
  revisionDeadline?: Date;
  events: Array<{
    status: string;
    timestamp: Date;
    note: string;
    author: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## 2. Indexes and Constraints

| Collection | Key | Index Type | Purpose |
|---|---|---|---|
| `journals` | `title` | Text / Ascending | Multi-parameter search |
| `journals` | `issn` | Unique / Sparse | Direct ISSN lookup |
| `journals` | `discipline` | Ascending | Subject taxonomy filter |
| `journalsubmissions` | `projectId` | Ascending | Fast project scoping |
| `journalsubmissions` | `userId` | Ascending | Author isolation |
| `journalsubmissions` | `status` | Ascending | Editorial milestone filtering |
| `journalsubmissions` | `projectId, createdAt` | Compound (-1) | Chronological submission ordering |
