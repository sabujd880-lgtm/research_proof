# ResearchProof AI — Deployment Guide (Render + Vercel)

## 1. Overview
ResearchProof AI is architected as a decoupled full-stack web application designed for zero-downtime, continuous deployment across standard cloud providers:
- **Backend API**: Render Web Service (`https://research-proof-1.onrender.com`, Service ID: `srv-dbdm41t9fdbs73bjtlmg`)
- **Frontend SPA**: Vercel Static Web App
- **Database**: MongoDB Atlas Cluster

---

## 2. Backend Deployment (Render)

### 2.1 Configuration
- **Environment**: Node.js (v20+)
- **Root Directory**: `server`
- **Build Command**: `npm install`
- **Start Command**: `node src/index.js`
- **Health Check Path**: `/api/health`

### 2.2 Environment Variables (Render Dashboard)
| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | HTTP Port for Express listener | `4000` (Render dynamically injects `10000`) |
| `NODE_ENV` | Environment mode | `production` |
| `MONGODB_URI` | MongoDB Atlas Connection String | `mongodb+srv://<user>:<password>@cluster0.mongodb.net/researchproof` |
| `JWT_SECRET` | Strong crypto secret for auth tokens | Minimum 32-character high-entropy string |
| `CLIENT_ORIGIN` | Allowed CORS frontend URL | `https://research-proof-ai.vercel.app` |
| `AI_PROVIDER` | Active AI provider (`gemini` or `openai`) | `gemini` |
| `AI_API_KEY` | Server-side API key for LLM provider | Set in Render secret dashboard |
| `AI_BASE_URL` | Base URL for OpenAI-compatible endpoint | `https://api.openai.com/v1` |
| `AI_MODEL` | LLM model identifier | `gemini-1.5-flash` or `gpt-4o-mini` |
| `PERSIST_DOCUMENT_TEXT` | Flag allowing storage of manuscript text | `true` |
| `MAX_DOCX_UPLOAD_SIZE` | Maximum file size in bytes for DOCX upload | `10485760` (10 MB) |
| `CROSSREF_MAILTO` | Polite pool contact email for Crossref API | `academic-integrity@researchproof.ai` |
| `CITATION_TIMEOUT_MS` | Timeout for external metadata lookups | `8000` (8 seconds) |

### 2.3 Ephemeral Filesystem Best Practices
- Render free and standard web services run on ephemeral container filesystems.
- All Phase 2 DOCX uploads and exports use Node.js memory buffers (`multer.memoryStorage()` and `Packer.toBuffer()`).
- No uploaded Word files or exported `.docx` binaries are written to disk, avoiding storage leaks and cold-start state corruption.

---

## 3. Frontend Deployment (Vercel)

### 3.1 Configuration
- **Framework Preset**: Vite
- **Root Directory**: `client`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 3.2 Environment Variables (Vercel Dashboard)
| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Render backend API base URL | `https://research-proof-1.onrender.com` |

### 3.3 SPA Routing Configuration
To allow client-side page refreshes on `/studio`, `/citations`, and other sub-routes, `client/vercel.json` rewrites all non-asset requests to `index.html`:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 4. Cold-Start & Graceful Degradation Handling
- **Render Cold Starts**: Render free instances spin down after inactivity. The client's `apiFetch` handles timeouts and displays a friendly spinning indicator rather than failing abruptly.
- **Provider Availability**: `GET /api/features/status` informs the client if `gemini` or `openai` is ready. If no API key is configured, non-AI features (Citation Assistant, DOCX Import/Export, Studio Editor, Diff Inspector) continue running 100% without interruption.
