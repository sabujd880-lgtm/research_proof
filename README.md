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
- Transparent writing heuristics & research integrity checks
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
Executes 34 comprehensive tests across Phase 1 authentication/quotas and Phase 2 Academic Tools (rewriting, diff, citations, DOCX import/export).

### 5. Production Build
```bash
npm run build --prefix client
```

## Documentation
- [Phase 2 Implementation Guide](docs/PHASE2_IMPLEMENTATION.md)
- [Academic Rewriting & Meaning Preservation](docs/ACADEMIC_REWRITING.md)
- [Citation Assistant & Crossref Integration](docs/CITATION_ASSISTANT.md)
- [DOCX Import & Export](docs/DOCX_IMPORT_EXPORT.md)
- [Deployment Guide (Render & Vercel)](docs/DEPLOYMENT.md)
- [System Architecture](ARCHITECTURE.md)

## AI provider configuration
Set `AI_PROVIDER` (`gemini` or `openai`), `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL` in `server/.env`.
If no API key is configured, the application functions cleanly for all non-AI tools (Writing Studio, Citation Assistant, DOCX import/export, and Diff comparison).

## Important limitations
- The writing assessment is a heuristic review aid, not a reliable determination of authorship.
- Citation checks format and verify bibliographic metadata against Crossref; they do not prove that a source substantively supports a specific claim.
- No result guarantees how Turnitin or another external system will classify a document.
- Always verify sources, data, quotations, and institutional AI-use policies.

