# ResearchProof AI 1.0 — Phase 4 Security Report
## Security Architecture, Tenant Isolation & Access Controls

### 1. Security Objectives
Phase 4 handles academic research data, unpublished citations, research notes, and proprietary literature bibliographies. Security enforcement focuses on five core pillars:
1. Multi-Tenant Data Isolation.
2. Input Sanitization & Prototype Pollution Prevention.
3. Denial of Service (DoS) & Timeout Defense on External Academic APIs.
4. Non-Destructive Data Preservation.
5. Tamper-Evident Audit Logging.

---

### 2. Tenant Isolation Verification
Every reference and collection query is scoped strictly by `ownerId: req.user.id`:
- **Direct Queries**: `Citation.findOne({ _id: id, ownerId: req.user.id, deletedAt: null })` ensures users cannot access or tamper with foreign IDs.
- **Cross-User Test Results**:
  - `GET /api/v1/references/:id` for User B targeting User A's reference returns `404 Not Found`.
  - `PATCH /api/v1/references/:id` returns `404 Not Found`.
  - `DELETE /api/v1/references/:id` returns `404 Not Found`.
  - User B's reference count is unaffected by User A's library.

---

### 3. External API Defensive Controls
- **Crossref & OpenAlex Timeouts**: All outgoing HTTP requests use an `AbortController` with a deterministic 6-second timeout to prevent hanging connections from tying up Node event loop workers.
- **DOI Regular Expression Validation**: All incoming DOIs are sanitized with `normalizeDoi(raw)` and validated against `^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$` before querying external registries or databases.
- **Offline / Sandbox Graceful Fallback**: If network connectivity is unavailable or firewalled, the service fails gracefully with fallback records rather than crashing or hanging.

---

### 4. Non-Destructive Soft Deletion
- Deleting a reference sets `deletedAt: new Date()` rather than issuing an irreversible database drop.
- All listing and lookup queries filter for `deletedAt: null`.
- Merging references archives secondary records with explanatory merge notes (`[Merged into <id>]`), maintaining complete citation provenance.

---

### 5. Audit Logging
Every reference lifecycle event records an audit entry:
- `REFERENCE_CREATED`
- `REFERENCE_UPDATED`
- `REFERENCE_DELETED`
- `REFERENCE_MERGED`
Records include user ID, timestamp, entity ID, and metadata diffs for full institutional compliance.
