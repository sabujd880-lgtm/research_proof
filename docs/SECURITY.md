# ResearchProof AI — Security Architecture & Threat Model

## 1. Authentication & Session Security
- **Dual Authentication**: Supports Google OAuth 2.0 (with cryptographic token audience and signature verification) and Argon2/bcrypt-hashed email/password credentials.
- **Session Management**: Dual-mode session support via `HttpOnly`, `SameSite=Lax` cookies (`rp_session`) and `Bearer` authorization headers.
- **Server-Side Invalidation**: All sessions carry a `tokenVersion` counter. Suspending an account, logging out, or invoking administrative session revocation increments `tokenVersion`, invalidating tokens immediately across all devices.

## 2. Authorization & Least Privilege (RBAC)
- All privileged endpoints under `/api/admin/*` enforce the `requireAdmin` middleware.
- Client requests cannot manipulate roles: registration and profile update routes ignore `role` fields.
- Resource isolation is strictly enforced across every document, revision, citation, and report query (`ownerId: req.user.id`).

## 3. Ephemeral & In-Memory Processing
- Designed specifically for Render cloud containers: DOCX uploads and exports run in memory buffers (`multer.memoryStorage()`, `Packer.toBuffer()`).
- No uploaded Word documents or generated exports are retained on disk, eliminating filesystem storage leakage and container bloat.

## 4. Input Validation & Magic Byte Defense
- Every DOCX upload is validated at the binary level for PKZIP magic bytes (`PK\x03\x04`). Corrupt files, non-ZIP extensions, and files exceeding `MAX_DOCX_UPLOAD_SIZE` (10MB) are rejected immediately.
- Zod schemas validate all JSON payloads across all API routes.
- Helmet secures HTTP headers with frameguard, XSS protection, and MIME sniffing protection.
- Express rate-limiting guards against brute-force authentication and quota abuse.

## 5. Audit Logging
- Security events (login, session revocation, account suspension, data export, account deletion) are recorded in an append-only `AuditEvent` log.
- Passwords, authentication tokens, manuscripts, and API secrets are strictly scrubbed from audit records.
