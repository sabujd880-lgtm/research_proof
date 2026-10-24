# ResearchProof AI — Privacy Controls & Data Deletion Architecture

## 1. Privacy Control Center
ResearchProof AI adheres to strict Privacy by Design principles tailored for scientific researchers working with unpublished manuscripts.

### User Settings (`GET /api/privacy/settings` & `PATCH /api/privacy/settings`)
1. **Manuscript Cloud Persistence (`persistDocumentText`)**:
   - When enabled: active manuscripts, document versions, and revision proposals are persisted in the user's private MongoDB collections.
   - When disabled: the application functions in **Stateless Editing Mode**. Manuscript text is processed in-memory and returned to the browser without being written to the database.
   - **Server Precedence**: If the server environment has `PERSIST_DOCUMENT_TEXT=false`, persistence is globally disabled and cannot be overridden by user preferences.
2. **AI Provider Consent (`allowAiProcessing`)**:
   - Controls whether manuscript excerpts may be transmitted to external LLM providers for rewriting.
   - Disclosures clarify that external model providers process text strictly in-memory and do not retain customer inputs for public training.

---

## 2. Complete Data Export (`POST /api/privacy/export`)
Compliant with GDPR Article 20 and CCPA data portability requirements:
- Allows authenticated users to download a comprehensive structured JSON archive of their research workspace.
- **Included Content**: User profile metadata, project details, document records, revision histories, citation libraries, and generated integrity reports.
- **Strict Exclusions**: Password hashes, JWT tokens, session cookies, internal security audit trails, and data belonging to any other user.

---

## 3. Data Deletion Workflows

### 3.1 Individual Resource Deletion
- Documents: `DELETE /api/privacy/documents/:id` cascades to associated document revisions.
- Projects: `DELETE /api/privacy/projects/:id` cascades to all documents, revisions, and citations associated with the project.
- Strict ownership verification ensures users can only delete their own assets.

### 3.2 Permanent Account Purge (`POST /api/privacy/delete-account`)
1. **Step-Up Verification**:
   - Email/password users must provide their current password, cryptographically validated via `bcryptjs`.
   - Google-authenticated users must explicitly submit `{ confirm: true }`.
2. **Cascade Deletion**:
   - Permanently deletes all `Document`, `Revision`, `Citation`, `Project`, `IntegrityReport`, and `UsageRecord` rows belonging to the user.
3. **Identity Anonymization & Revocation**:
   - The user record is marked `status: 'deleted'`.
   - Email is scrubbed (`deleted-user-{id}@deleted.local`).
   - `passwordHash` and `googleId` are set to null.
   - `tokenVersion` is incremented and session cookies are cleared (`clearSessionCookie(res)`).
4. **Audit Receipt**:
   - Creates a minimal `AuditEvent` recording completion of the deletion job with total counts of purged resources.
