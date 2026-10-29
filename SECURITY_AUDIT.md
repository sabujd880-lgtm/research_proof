# ResearchProof AI 1.0 — Security & Privacy Audit

**Audit Date:** October 29, 2026  
**Status:** PASSED (All Core Security Controls Validated)  
**Standard:** Academic Integrity, GDPR Privacy, and Cloud Production Hardening

---

## 1. Security Architecture & Controls

### 1.1 Authentication & Credential Storage
- **Password Protection**: Passwords hashed using `bcryptjs` with salt rounds = 12. Password hashes are strictly excluded from all JSON serialization and API responses (`select('-passwordHash')`).
- **Input Validation**: `zod` schema enforcement requires emails to be RFC 5322 compliant (max 254 characters) and passwords to be a minimum of 10 characters (max 128 characters).
- **Session Security**: JWT tokens signed with SHA-256 HMAC. In production, unconfigured or default secrets trigger high-entropy 256-bit cryptographic generation (`crypto.randomBytes(32)`).
- **Session Cookie Attributes**:
  - `HttpOnly: true` (prevents XSS access to tokens)
  - `Secure: true` in production (enforces HTTPS)
  - `SameSite: 'lax'` (prevents CSRF cross-origin leakage)
  - `Path: '/'`
  - Explicit session TTL (default 24 hours).

### 1.2 Google OAuth 2.0 PKCE Protection
- Full PKCE (`code_challenge` / `code_verifier`) generation with SHA-256 (`S256`).
- Cryptographic state parameters (32 random bytes) verified during code exchange to mitigate authorization code injection and replay attacks.
- Strict account linking prevents silent merging: accounts registered via password require password authentication before linking a Google identity with matching email.

### 1.3 Bot Protection & Abuse Mitigation
- Cloudflare Turnstile integration with dynamic frontend challenge rendering.
- Replay protection cache prevents reuse of spent Turnstile tokens within a 10-minute window.
- Rate limiting on authentication routes (30 requests per 15 minutes per IP).
- Risk-based login enforcement: 3 consecutive failures trigger mandatory Turnstile challenge on subsequent login attempts.

### 1.4 Research Manuscript Privacy & Isolation
- User document isolation verified: Cross-user access returns `404 Not Found` or `403 Forbidden`.
- In-memory ephemeral file processing: Word `.docx` imports and exports use memory buffers (`multer.memoryStorage()` and `Packer.toBuffer()`). No user manuscripts are persisted to container disks.
- User data consent: `persistenceConsent` flag allows researchers to use analysis tools without storing manuscript text.
- GDPR Data Purge: User deletion cascades through projects, documents, revisions, citations, and integrity scans, followed by audit logging.

### 1.5 Header & Network Security
- `helmet` middleware sets:
  - `Cross-Origin-Opener-Policy: 'same-origin-allow-popups'` (required for Google Identity Services popups)
  - `Cross-Origin-Resource-Policy: 'cross-origin'` (enables Google avatar loading)
  - `Content-Security-Policy` protections against frame injection and clickjacking.
- Container network binding restricted to `0.0.0.0:${process.env.PORT}` on Render.

---

## 2. Secrets Management & Diagnostic Sanitization

- Password strings in MongoDB URIs are automatically redacted before logging:
  `mongodb://user:***@cluster.mongodb.net`
- All diagnostic errors classify connection types without exposing credentials or internal host topologies.
- Git push protection verified: Commit history is clean of live secrets and tokens.

