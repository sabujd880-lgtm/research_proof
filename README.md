# ResearchProof AI

A full-stack academic writing and research-integrity starter project.

## Features
- React + Vite + TypeScript frontend
- Express REST API
- MongoDB persistence (Mongoose)
- JWT authentication and bcrypt password hashing
- API-based academic revision via OpenAI-compatible chat completions endpoint
- Writing assessment with transparent heuristic indicators (not a definitive AI detector)
- Local repeated-phrase review
- Basic citation/reference consistency checks
- Projects and revision history
- Privacy-first option not to persist submitted text

## Requirements
- Node.js 20+
- npm
- MongoDB local instance or MongoDB Atlas connection
- Optional: API key for an OpenAI-compatible model endpoint

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

### 4. Create an account
Use the Register screen. The backend stores password hashes, never plain-text passwords.

## AI provider configuration
Set `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL` in `server/.env`.
The default adapter expects an OpenAI-compatible endpoint at:
`{AI_BASE_URL}/chat/completions`
For the standard OpenAI API, set `AI_BASE_URL=https://api.openai.com/v1`.

If no API key is configured, the humanizer endpoint returns a clear setup error. Other local checks still work.

## Important limitations
- The writing assessment is a heuristic review aid, not a reliable determination of authorship.
- Similarity checks compare repeated phrases within the submitted text only. They do not search the internet or proprietary plagiarism databases.
- Citation checks are consistency checks, not proof that a source exists or supports a claim.
- No result guarantees how Turnitin or another external system will classify a document.
- Always verify sources, data, quotations, and institutional AI-use policies.

## Security notes before deployment
This is a development starter. Before production deployment, add HTTPS, a managed secret store, CSRF strategy if using cookies, email verification/password reset, audit logging, backup/retention policies, malware scanning for uploads, and security review. Keep `.env` private and never commit API keys.
