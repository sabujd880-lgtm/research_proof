# ResearchProof AI

A full-stack academic writing and research-integrity starter project.

## Features
- React + Vite + TypeScript frontend
- Express REST API with security hardening (Helmet, CORS, rate limiting)
- MongoDB persistence (Mongoose) with optimistic concurrency control
- JWT authentication and Google OAuth 2.0 Sign-In
- Academic Writing Studio with 3-column workspace and debounced autosave
- Meaning-preserving academic rewriting engine (8 scientific modes)
- Deterministic meaning auditor (flagging negation inversions, statistical changes, citations)
- Original vs. Revised diff inspector with accept, reject, and restore lifecycle
- Citation Assistant with Crossref REST API lookup, APA 7th/MLA 9th/IEEE formatting, and validation
- Secure DOCX Import (Mammoth) with PKZIP magic byte checks & DOCX Export (Office Open XML)
- Administrator Dashboard & RBAC User Management (`requireAdmin`)
- Usage Analytics Engine with TTL-bounded retention & daily aggregates
- User Privacy Control Center, GDPR/CCPA Data Export & Cascading Account Deletion
- Research Integrity Reporting Engine with multi-dimensional auditing & DOCX export
- Projects, document versioning, and revision history
- Privacy-first option not to persist submitted text (`PERSIST_DOCUMENT_TEXT`)

## Requirements
- Node.js 20+
- npm
- MongoDB local instance or MongoDB Atlas connection
- Optional: API key for Gemini or an OpenAI-compatible model endpoint (non-AI features work without an API key)

## Setup

### 1. Configure environment
Copy `.env.example` to `.env` in the `server` directory and set values.

### 2. Install dependencies
From the project root:
```bash
npm install
npm run install:all
```

### 3. Run in development
```bash
npm run dev
```
Frontend: http://localhost:5173  
API health check: http://localhost:4000/api/health

### 4. Run Automated Tests
```bash
npm test --prefix server
```
Executes **45 comprehensive tests** across:
- Phase 1 Security, Google OAuth, and Usage Quotas (20 tests)
- Phase 2 Academic Writing Studio, Citations, and DOCX (12 tests)
- Phase 3 Platform Management, RBAC, Analytics, Privacy, and Integrity Reports (10 tests)

### 5. Production Build
```bash
npm run build --prefix client
```

### 6. Provision an Administrator Account
```bash
npm run --prefix server seed:admin <email> <password> [displayName]
```

## Documentation
- [Phase 3 Implementation Guide](docs/PHASE3_IMPLEMENTATION.md)
- [Administrator Dashboard & RBAC](docs/ADMIN_DASHBOARD.md)
- [Usage Analytics Engine](docs/USAGE_ANALYTICS.md)
- [Privacy Controls & Data Deletion](docs/PRIVACY_AND_DELETION.md)
- [Research Integrity Reporting Engine](docs/INTEGRITY_REPORTS.md)
- [Platform Security & Threat Model](docs/SECURITY.md)
- [Phase 2 Implementation Guide](docs/PHASE2_IMPLEMENTATION.md)
- [Academic Rewriting & Meaning Preservation](docs/ACADEMIC_REWRITING.md)
- [Citation Assistant & Crossref Integration](docs/CITATION_ASSISTANT.md)
- [DOCX Import & Export](docs/DOCX_IMPORT_EXPORT.md)
- [Deployment Guide (Render & Vercel)](docs/DEPLOYMENT.md)
- [System Architecture](ARCHITECTURE.md)

## AI provider configuration
Set `AI_PROVIDER` (`gemini` or `openai`), `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL` in `server/.env`.
If no API key is configured, the application functions cleanly for all non-AI tools (Writing Studio, Citation Assistant, DOCX import/export, Privacy Center, and Integrity Reports).

## Important limitations
- The writing assessment is a heuristic review aid, not a reliable determination of authorship.
- Citation checks format and verify bibliographic metadata against Crossref; they do not prove that a source substantively supports a specific claim.
- Research integrity reports evaluate internal manuscript characteristics; they do not verify external Turnitin or plagiarism databases.
- Always verify sources, data, quotations, and institutional AI-use policies.


