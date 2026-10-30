# ResearchProof AI 1.0 — Phase 7 Database Schema Specification

## 1. Schema Overview

Phase 7 introduces structured data models and versioning collections in `server/src/models.js` while maintaining backward compatibility with legacy collections.

---

## 2. Model Definitions

### 2.1 `Dataset` Collection (`datasets`)
Represents an uploaded or synthesized research dataset.

```typescript
interface IDataset {
  _id: ObjectId;
  projectId: ObjectId;              // Reference to Project
  userId: ObjectId;                 // Reference to User
  ownerId: ObjectId;                // Explicit tenant owner
  name: string;                     // Dataset display name
  description?: string;
  fileName?: string;                // Uploaded filename
  originalFilename?: string;
  fileType: 'csv' | 'xlsx' | 'tsv' | 'json';
  checksum?: string;                // SHA-256 hash of dataset buffer
  rowCount: number;                 // Total valid rows (N)
  columnCount: number;              // Total detected variables
  missingValueCount: number;        // Count of empty/null cells
  status: 'pending' | 'processing' | 'ready' | 'error';
  currentVersionNumber: number;     // Monotonic version counter
  columns: Array<{
    name: string;
    displayName?: string;
    type: 'numeric' | 'categorical';
    measurementLevel: 'scale' | 'ordinal' | 'nominal';
    missingCount?: number;
    uniqueCount?: number;
    sampleValues?: any[];
  }>;
  rawData?: any[];                  // In-memory or database cached rows
  deletedAt?: Date | null;          // Soft delete flag
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.2 `DatasetVersion` Collection (`dataset_versions`)
Immutable historical snapshots created whenever data cleaning or mathematical transformations are applied.

```typescript
interface IDatasetVersion {
  _id: ObjectId;
  datasetId: ObjectId;              // Reference to Dataset
  projectId: ObjectId;
  versionNumber: number;            // 1, 2, 3...
  transformationSummary: string;    // e.g. "Standardize PreScore to z-scores"
  rowCount: number;
  columnCount: number;
  checksum: string;
  rawData?: any[];
  createdAt: Date;
}
```

### 2.3 `DatasetVariable` Collection (`dataset_variables`)
Data dictionary entry for each column.

```typescript
interface IDatasetVariable {
  _id: ObjectId;
  datasetId: ObjectId;
  name: string;
  label?: string;
  displayName?: string;
  dataType: 'numeric' | 'categorical';
  measurementLevel: 'scale' | 'ordinal' | 'nominal';
  role: 'dependent' | 'independent' | 'covariate' | 'group' | 'none';
  missingValueCodes?: string[];
  sampleValues?: any[];
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.4 `Analysis` Collection (`analyses`)
Configuration and execution state for a statistical procedure.

```typescript
interface IAnalysis {
  _id: ObjectId;
  projectId: ObjectId;
  userId: ObjectId;
  datasetId: ObjectId;
  datasetVersionId?: ObjectId;
  title: string;
  analysisType: 
    | 'descriptive'
    | 'one_sample_t_test'
    | 'independent_t_test'
    | 'paired_t_test'
    | 'one_way_anova'
    | 'two_way_anova'
    | 'pearson_correlation'
    | 'spearman_correlation'
    | 'linear_regression'
    | 'multiple_linear_regression'
    | 'mann_whitney_u'
    | 'wilcoxon_signed_rank'
    | 'kruskal_wallis'
    | 'chi_square_independence';
  variables: {
    dependent?: string;
    independents?: string[];
    groupFactor?: string;
    factorB?: string;
    varX?: string;
    varY?: string;
  };
  parameters: {
    mu0?: number;
    confidenceLevel?: number;       // 0.90, 0.95, 0.99
    missingDataPolicy?: 'exclude_listwise' | 'exclude_pairwise';
    checkAssumptions?: boolean;
    postHoc?: 'tukey';
  };
  results?: any;
  assumptions?: any;
  diagnostics?: any;
  apaReport?: string;
  apaNarrative?: string;
  status: 'configured' | 'running' | 'completed' | 'failed';
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.5 `AnalysisResult` Collection (`analysis_results`)
Detailed numerical audit trail containing exact computed statistics, assumptions, and software versions.

```typescript
interface IAnalysisResult {
  _id: ObjectId;
  analysisId: ObjectId;
  projectId: ObjectId;
  numericalResults: Record<string, any>;
  assumptions: Record<string, any>;
  apa7Narrative: string;
  softwareVersions: {
    statEngine: string;
    node: string;
  };
  createdAt: Date;
}
```

---

## 3. Database Indexes

- `datasets`: `{ projectId: 1, deletedAt: 1 }`, `{ ownerId: 1, deletedAt: 1 }`
- `dataset_versions`: `{ datasetId: 1, versionNumber: -1 }`
- `dataset_variables`: `{ datasetId: 1, name: 1 }` (unique compound)
- `analyses`: `{ projectId: 1, deletedAt: 1 }`, `{ userId: 1, deletedAt: 1 }`
- `analysis_results`: `{ analysisId: 1 }` (unique)

