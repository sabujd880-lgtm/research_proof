# ResearchProof AI 1.0 — Phase 7 API Documentation

## Overview

All statistical endpoints are mounted under both `/api` and `/api/v1` prefixes and require Bearer token authentication via the `Authorization: Bearer <token>` header or `rp_session` cookie.

---

## 1. Dataset Management Endpoints

### `POST /api/v1/statistics/datasets/upload`
Uploads and indexes a research dataset in CSV, TSV, or XLSX format.
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `file`: Binary file (.csv, .tsv, .xlsx)
  - `projectId`: Target research project ID
  - `name`: (Optional) Custom dataset title
- **Response (201 Created)**:
  ```json
  {
    "_id": "672...",
    "name": "Cognitive Trial",
    "rowCount": 80,
    "columnCount": 6,
    "missingValueCount": 0,
    "columns": [
      { "name": "Score", "type": "numeric", "measurementLevel": "scale" }
    ],
    "currentVersionNumber": 1,
    "status": "ready"
  }
  ```

### `GET /api/v1/statistics/datasets`
Lists datasets owned by the authenticated researcher.
- **Query Parameters**:
  - `projectId`: Filter by project
  - `search`: Filter by dataset name or filename
  - `page`: Page index (default: 1)
  - `limit`: Items per page (default: 50)
- **Response (200 OK)**:
  ```json
  {
    "datasets": [ ... ],
    "pagination": { "total": 1, "page": 1, "limit": 50, "totalPages": 1 }
  }
  ```

### `GET /api/v1/statistics/datasets/:datasetId`
Retrieves dataset metadata and column definitions.

### `GET /api/v1/statistics/datasets/:datasetId/variables`
Retrieves the data dictionary and measurement levels for all columns.

### `PATCH /api/v1/statistics/datasets/:datasetId/variables/:varName`
Updates measurement level or display name of a variable.
- **Request Body**:
  ```json
  {
    "measurementLevel": "ordinal",
    "displayName": "Participant Cohort"
  }
  ```

### `GET /api/v1/statistics/datasets/:datasetId/preview`
Returns a paginated slice of raw rows for data grid visualization.
- **Query Parameters**: `page=1&limit=50`

### `POST /api/v1/statistics/datasets/:datasetId/transform`
Applies deterministic data cleaning operations and increments version number.
- **Request Body**:
  ```json
  {
    "type": "standardize_z",
    "column": "PreScore",
    "summary": "Standardize PreScore to z-scores"
  }
  ```
- **Supported Operations**:
  - `impute_mean`: Fill missing cells with column mean
  - `impute_median`: Fill missing cells with column median
  - `standardize_z`: Convert values to standard deviations from mean
  - `log_transform`: Calculate $ln(x + 1)$

### `GET /api/v1/statistics/datasets/:datasetId/versions`
Retrieves immutable historical version snapshots for the dataset.

### `DELETE /api/v1/statistics/datasets/:datasetId`
Performs non-destructive soft deletion (`deletedAt = new Date()`).

---

## 2. Statistical Analysis Endpoints

### `POST /api/v1/statistics/analyses`
Configures and executes a statistical analysis.
- **Request Body**:
  ```json
  {
    "projectId": "672...",
    "datasetId": "672...",
    "analysisType": "independent_t_test",
    "title": "Intervention vs Control Trial",
    "variables": {
      "dependent": "PostScore",
      "groupFactor": "Condition"
    },
    "parameters": {
      "confidenceLevel": 0.95,
      "checkAssumptions": true
    }
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "_id": "672...",
    "analysisType": "independent_t_test",
    "status": "completed",
    "results": {
      "t": 11.842,
      "df": 10,
      "pValue": 0.0001,
      "cohensD": 6.33,
      "hedgesG": 5.926,
      "confidenceInterval": [14.9614, 21.8958],
      "significant": true
    },
    "assumptions": {
      "homogeneityOfVariance": { "equalVariances": true, "f": 1.25, "pValue": 0.28 },
      "normalityA": { "isNormal": true, "w": 0.95 }
    },
    "apaReport": "An independent-samples t-test revealed a statistically significant difference between Group 1 (M = 90.43, SD = 3.51) and Group 2 (M = 72.00, SD = 2.16), t(10) = 11.842, p < .001, d = 6.33, 95% CI [14.9614, 21.8958]."
  }
  ```

### `GET /api/v1/statistics/analyses`
Lists past analyses with filtering by project.

### `POST /api/v1/statistics/analyses/:analysisId/run`
Re-runs a configured analysis with optional updated parameters.

### `GET /api/v1/statistics/analyses/:analysisId/results`
Retrieves structured numerical audit results.

### `DELETE /api/v1/statistics/analyses/:analysisId`
Soft-deletes analysis record.
