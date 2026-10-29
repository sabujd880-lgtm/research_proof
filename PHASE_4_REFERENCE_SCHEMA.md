# ResearchProof AI 1.0 — Phase 4 Reference & Collection Database Schema

**Schema Status**: Verified & Applied  
**Model Name**: `Citation` (aliased as `Reference`) and `ReferenceCollection`  
**Database**: MongoDB Atlas / Mongoose ODM (with In-Memory Dev Store Mirroring)  

---

## 1. Reference Model (`Citation` / `Reference`)

```typescript
interface IAuthor {
  given?: string;
  family?: string;
  name?: string;
  givenName?: string;
  familyName?: string;
  literalName?: string;
  orcid?: string;
}

interface IReference {
  _id: string;
  ownerId: string;
  projectId?: string | null;
  documentId?: string | null;
  title: string;
  subtitle?: string;
  authors: IAuthor[];
  editors?: IAuthor[];
  publicationYear?: string;
  publicationDate?: string;
  year?: string;
  publicationType:
    | 'journal-article'
    | 'book'
    | 'book-chapter'
    | 'proceedings-article'
    | 'thesis'
    | 'report'
    | 'website'
    | 'preprint'
    | 'dataset'
    | 'other';
  journal?: string;
  journalTitle?: string;
  bookTitle?: string;
  publisher?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  articleNumber?: string;
  doi?: string;
  normalizedDoi?: string;
  isbn?: string;
  issn?: string;
  url?: string;
  abstract?: string;
  keywords?: string[];
  language?: string;
  citationKey?: string;
  sourceProvider: 'crossref' | 'openalex' | 'bibtex' | 'ris' | 'manual';
  metadataSource?: string;
  metadataStatus: 'verified' | 'partially_verified' | 'unverified' | 'lookup_failed';
  verificationStatus?: string;
  metadataLastVerifiedAt?: Date | null;
  retractionStatus: 'clean' | 'retracted' | 'expression_of_concern' | 'corrected' | 'unknown';
  tags?: string[];
  collectionIds?: string[];
  isFavorite?: boolean;
  notes?: string;
  deletedAt?: Date | null;
  rawMetadata?: any;
  createdAt: string;
  updatedAt: string;
}
```

---

## 2. Reference Collection Model (`ReferenceCollection`)

```typescript
interface IReferenceCollection {
  _id: string;
  ownerId: string;
  projectId?: string | null;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## 3. Performance Indexes

```javascript
citationSchema.index({ ownerId: 1, deletedAt: 1, updatedAt: -1 });
citationSchema.index({ projectId: 1, deletedAt: 1 });
citationSchema.index({ ownerId: 1, doi: 1 });
citationSchema.index({ ownerId: 1, isFavorite: 1 });
citationSchema.index({ collectionIds: 1 });
referenceCollectionSchema.index({ ownerId: 1, name: 1 });
referenceCollectionSchema.index({ projectId: 1 });
```

---

## 4. In-Memory Store Mirroring (`server/src/index.js`)

All schema structures are mirrored in memory:
- `memCitations` Map: Mirrors all fields with soft-delete filtering.
- `memReferenceCollections` Map: Tracks custom user/project collections.
