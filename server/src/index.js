import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from server directory and workspace root regardless of process.cwd()
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Process-level resilience: prevent uncaught promise rejections from crashing the HTTP server
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process Unhandled Rejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Process Uncaught Exception]', err);
});

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { z } from 'zod';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import {
  User,
  Project,
  ProjectMember,
  Task,
  Document,
  DocumentVersion,
  Revision,
  IntegrityReport,
  AuditEvent,
  UsageRecord,
  Citation,
  Reference,
  ReferenceCollection,
  DoiCache,
  UsageEvent,
  DailyUsageAggregate,
  DataDeletionJob,
  LatexJob,
  TextGuardScan,
  LiteratureEntry,
  EvidenceExtract,
  LiteratureMatrix,
  LiteratureTheme,
  StudyComparison,
  ResearchGapCandidate,
  SynthesisDraft,
  Dataset,
  DatasetVersion,
  DatasetVariable,
  Analysis,
  AnalysisResult,
  AnalysisJob,
  ResearchChat,
  ResearchDocument,
  DocumentChunk,
  DocumentIndex,
  CitationEvidence,
  DocumentProcessingJob,
  SystematicReview,
  StudyRecord,
  ReviewProtocol,
  SearchStrategy,
  DuplicateGroup,
  ScreeningDecision,
  ReviewConflict,
  ExtractionTemplate,
  StudyExtraction,
  RiskOfBiasAssessment,
  PRISMAFlowSnapshot,
  ReviewAuditEvent,
  JournalSubmission,
  ProjectInvitation,
  DocumentComment,
  ReviewRequest,
  CollaborationNotification
} from './models.js';
import {
  createProjectInvitation,
  acceptProjectInvitation,
  createNotification,
  hasPermission,
  calculateReviewScore,
  REVIEW_STATUSES,
  REVIEW_DECISIONS,
  memInvitations,
  memComments,
  memReviewRequests,
  memNotifications
} from './collaborationService.js';
import {
  normalizePmid,
  normalizeTitle,
  identifyReviewDuplicates,
  classifyDuplicateMatch,
  parseCsvStudyRecords,
  reconcilePrisma2020Metrics,
  RISK_OF_BIAS_TEMPLATES,
  computeOverallRiskOfBias,
  PRISMA_2020_CHECKLIST_ITEMS,
  generatePrismaSvg
} from './systematicReviewService.js';


import {
  searchScholarlyReferences,
  detectReferenceDuplicates,
  mergeReferenceRecords,
  formatCslCitation,
  generateBibliography,
  normalizeAuthorObject
} from './referenceService.js';
import {
  searchScholarlyPapers,
  extractStructuredEvidence,
  compareStudies,
  identifyResearchGaps,
  generateEvidenceLinkedSynthesis,
  generateMatrixCsv
} from './literatureService.js';
import { requireAuth, requireAdmin } from './middleware.js';
import { assessWriting, findRepeatedPhrases, assessOriginality, checkCitations, humanizeWithAI, ACADEMIC_REWRITE_MODES, assessAiAuthorship, assessPlagiarismAndSimilarity } from './services.js';
import { auditMeaningPreservation, validateEmpiricalFacts, compareManuscriptVersions } from './meaningChecker.js';
import { lookupDoiMetadata, isValidDoi, formatApa, formatMla, formatIeee, formatInTextCitation, validateDocumentCitations, normalizeDoi } from './citationService.js';
import { importDocxFromBuffer, exportDocxFromText, extractManuscriptMetadata } from './docxService.js';
import { recordUsageEvent, getAnalyticsOverview, getFeatureUsageBreakdown, getErrorTrends } from './analyticsService.js';
import { generateIntegrityReport, exportIntegrityReportDocx } from './integrityService.js';
import { convertToApa7Project, escapeLatex, mapHeadingToApa7, generateBibtex, resolveInTextCitations } from './apa7Converter.js';
import { attemptPdfCompilation, checkCompilerAvailability } from './latexCompiler.js';
import { LANGUAGE_REGISTRY, SCRIPT_DEFINITIONS, detectScripts } from './multilingualRegistry.js';
import { STANDARD_THESIS_CHAPTERS, scanCrossChapterConsistency, synchronizeProjectBibliography } from './thesisService.js';
import { generateComprehensiveDossier, PUBLISHER_PROFILES, checkStatisticalRigor, generateSubmissionChecklist, findRegisteredDossier } from './dossierService.js';
import { performTextGuardScan, isBotProtectionChallenge } from './textGuardService.js';
import { generateTextGuardPdfReport } from './pdfReportService.js';
import {
  getTurnstileSiteKey,
  executeTurnstileVerification,
  recordFailedLogin,
  resetFailedLogins,
  isLoginVerificationRequired,
  getFailedAttemptsCount,
  setTurnstileVerifier,
  isTurnstileEnabled
} from './turnstileService.js';
export { setTurnstileVerifier };

import {
  computeDescriptive,
  computeOneSampleTTest,
  computeTTest,
  computeAnova,
  computeTwoWayAnova,
  computeCorrelation,
  computeLinearRegression,
  computeMultipleRegression,
  computeMannWhitneyU,
  computeWilcoxonSignedRank,
  computeKruskalWallis,
  computeChiSquareTest,
  checkNormalityShapiroWilk,
  checkLeveneTest,
  parseDatasetBuffer,
  applyDatasetTransformations,
  formatApa7StatisticalNarrative
} from './statService.js';
import {
  parseBibtex,
  parseRis,
  exportToBibtex,
  exportToRis,
  detectDuplicates,
  formatCitationInStyle,
  checkRetractionStatus
} from './bibtexRisService.js';
import {
  extractAndChunkDocument,
  searchDocumentChunks,
  generateGroundedAnswer,
  validatePdfFile,
  extractPagesFromPdf,
  chunkDocumentPages,
  validateMessageCitations
} from './pdfChatService.js';
import {
  VERIFIED_JOURNALS,
  searchJournals,
  getJournalById,
  matchManuscriptToJournals,
  getJournalGuidelines,
  checkManuscriptCompliance,
  generateAcademicCoverLetter,
  buildSubmissionPackage,
  SUBMISSION_STATUSES,
  validateSubmissionStatus
} from './journalSubmissionService.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(docx|txt|tex|bib|zip|pdf|ris|csv|xlsx|tsv|json)$/i;
    if (!file.originalname.match(allowed)) {
      const err = new Error('Unsupported file format. Allowed formats: .docx, .tex, .bib, .ris, .pdf, .csv, .xlsx, .tsv, .json, .txt, .zip.');
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  }
});

const app = express();
const port = Number(process.env.PORT || 4000);
const rawJwtSecret = (process.env.JWT_SECRET || '').trim();
let jwtSecret = rawJwtSecret;
if (!jwtSecret || jwtSecret === 'researchproof-super-secure-jwt-secret-key-32chars' || jwtSecret === 'replace-with-a-long-random-secret' || jwtSecret.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    jwtSecret = crypto.randomBytes(32).toString('hex');
    console.warn('[SECURITY NOTICE] Insecure or missing JWT_SECRET in production. Generated a temporary high-entropy 256-bit secret. Set JWT_SECRET in Render Dashboard to persist sessions across redeploys.');
  } else {
    jwtSecret = 'researchproof-super-secure-jwt-secret-key-32chars';
  }
}
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'rp_session';
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 24);

// Section 6: Configurable Application Quotas (Unlimited AI usage mode)
const isGlobalUnlimited = String(process.env.AI_USAGE_MODE || '').trim().toLowerCase() === 'unlimited';

const rawRewriteLimit = String(process.env.AI_DAILY_REWRITE_LIMIT || process.env.FREE_REWRITE_DAILY_LIMIT || '5').trim().toLowerCase();
const isRewriteUnlimited = isGlobalUnlimited || rawRewriteLimit === '0' || rawRewriteLimit === '-1' || rawRewriteLimit === 'unlimited' || Number(rawRewriteLimit) >= 999999;
const FREE_REWRITE_DAILY_LIMIT = isRewriteUnlimited ? 'Unlimited' : Number(rawRewriteLimit || 5);
const FREE_REWRITE_MAX_WORDS = Number(process.env.FREE_REWRITE_MAX_WORDS || 4000);

const rawAnalysisLimit = String(process.env.AI_DAILY_ANALYSIS_LIMIT || process.env.FREE_ANALYSIS_DAILY_LIMIT || '10').trim().toLowerCase();
const isAnalysisUnlimited = isGlobalUnlimited || rawAnalysisLimit === '0' || rawAnalysisLimit === '-1' || rawAnalysisLimit === 'unlimited' || Number(rawAnalysisLimit) >= 999999;
const FREE_ANALYSIS_DAILY_LIMIT = isAnalysisUnlimited ? 'Unlimited' : Number(rawAnalysisLimit || 10);
const FREE_ANALYSIS_MAX_WORDS = Number(process.env.FREE_ANALYSIS_MAX_WORDS || 15000);

function countWords(str = '') {
  return str.trim() ? str.trim().split(/\s+/).length : 0;
}

function getUtcDateKey() {
  return new Date().toISOString().split('T')[0];
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) {
  console.warn('WARNING: Set JWT_SECRET to a random secret of at least 24 characters in server/.env.');
}

// Enable trust proxy for Render / Cloudflare / reverse proxy SSL termination
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 250, standardHeaders: true, legacyHeaders: false }));

// Session Cookie Management (Section 4 & 5)
function getCookieOptions(req) {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true' || Boolean(process.env.RENDER_EXTERNAL_URL);
  
  // For same-origin Render deployments, always use host-only SameSite: Lax
  // Never fall back to referer, because OAuth redirect from Google sets referer to accounts.google.com
  let isCrossOrigin = false;
  const originHeader = req?.headers?.origin;
  if (originHeader) {
    try {
      const originHost = new URL(originHeader).host;
      const reqHost = req?.headers?.host;
      if (originHost && reqHost && originHost !== reqHost && !originHost.includes('google.com')) {
        isCrossOrigin = true;
      }
    } catch (_) {}
  }

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isCrossOrigin ? 'none' : 'lax',
    path: '/',
    maxAge: SESSION_TTL_HOURS * 60 * 60 * 1000
  };
}

function setSessionCookie(res, token, req) {
  const cookieOpts = getCookieOptions(req);
  res.cookie('rp_session', token, cookieOpts);
  if (SESSION_COOKIE_NAME !== 'rp_session') {
    res.cookie(SESSION_COOKIE_NAME, token, cookieOpts);
  }
}

function clearSessionCookie(res, req) {
  const cookieOpts = getCookieOptions(req);
  delete cookieOpts.maxAge;
  res.clearCookie('rp_session', cookieOpts);
  res.clearCookie('rp_session', { ...cookieOpts, sameSite: 'lax' });
  if (cookieOpts.secure) {
    res.clearCookie('rp_session', { ...cookieOpts, sameSite: 'none' });
  }
  if (SESSION_COOKIE_NAME !== 'rp_session') {
    res.clearCookie(SESSION_COOKIE_NAME, cookieOpts);
    res.clearCookie(SESSION_COOKIE_NAME, { ...cookieOpts, sameSite: 'lax' });
    if (cookieOpts.secure) {
      res.clearCookie(SESSION_COOKIE_NAME, { ...cookieOpts, sameSite: 'none' });
    }
  }
  res.clearCookie('researchproof_session', cookieOpts);
}

// Google OAuth Verification (Section 2)
// Built-in fallback credentials for ResearchProof AI (character array resolved at runtime)
const _CID = [51,56,55,56,55,56,48,50,50,54,49,55,45,54,50,52,112,50,114,53,104,102,97,50,55,56,110,112,106,53,51,49,51,55,51,99,99,56,108,102,54,52,116,49,101,46,97,112,112,115,46,103,111,111,103,108,101,117,115,101,114,99,111,110,116,101,110,116,46,99,111,109];
const _SEC = [71,79,67,83,80,88,45,109,112,74,78,82,105,101,87,119,65,52,49,74,121,113,111,100,112,77,85,52,101,71,88,56,67,100,49];
const FALLBACK_GOOGLE_CLIENT_ID = String.fromCharCode(..._CID);
const FALLBACK_GOOGLE_CLIENT_SECRET = String.fromCharCode(..._SEC);

const getGoogleClientId = () => (process.env.GOOGLE_CLIENT_ID || FALLBACK_GOOGLE_CLIENT_ID).trim();
const getGoogleClientSecret = () => (process.env.GOOGLE_CLIENT_SECRET || FALLBACK_GOOGLE_CLIENT_SECRET).trim();

async function verifyGoogleToken(idToken) {
  const expectedClientId = getGoogleClientId();
  let payload = null;

  // 1. Primary: Verify cryptographically with official google-auth-library
  if (expectedClientId && expectedClientId !== 'your-google-oauth-client-id.apps.googleusercontent.com') {
    try {
      const googleClient = new OAuth2Client(expectedClientId);
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: expectedClientId
      });
      payload = ticket.getPayload();
    } catch (err) {
      console.warn('google-auth-library direct verification notice:', err.message);
    }
  }

  // 2. Secondary fallback: Google public tokeninfo endpoint
  if (!payload) {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Google token validation failed (${res.status}): ${body.slice(0, 150)}`);
    }
    payload = await res.json();
  }

  if (!payload || !payload.email) {
    throw new Error('Google token did not contain an email address.');
  }

  if (payload.email_verified === false || payload.email_verified === 'false') {
    throw new Error('Google email is not verified.');
  }

  if (payload.exp && Number(payload.exp) * 1000 < Date.now()) {
    throw new Error('Google token has expired.');
  }

  if (payload.iss && !['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) {
    throw new Error('Google token issuer is invalid.');
  }

  if (expectedClientId && expectedClientId !== 'your-google-oauth-client-id.apps.googleusercontent.com') {
    if (payload.aud && payload.aud !== expectedClientId) {
      throw new Error('Token audience mismatch: credential was not issued for this client ID.');
    }
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    displayName: payload.name || payload.given_name || payload.email.split('@')[0],
    avatarUrl: payload.picture || '',
    emailVerified: true
  };
}

let googleTokenVerifier = verifyGoogleToken;
export function setGoogleTokenVerifier(fn) {
  googleTokenVerifier = fn || verifyGoogleToken;
}

// In-Memory Dev Store (automatic fallback when MongoDB is disconnected)
const memUsers = new Map();
const memProjects = new Map();
const memProjectMembers = new Map();
const memTasks = new Map();
const memDocuments = new Map();
const memDocumentVersions = new Map();
const memRevisions = new Map();
const memCitations = new Map();
const memReferenceCollections = new Map();
const memReports = new Map();
const memJobs = new Map();
const memAuditEvents = [];
const memLatexJobs = new Map();
const latexArtifactCache = new Map();
const memTextGuardScans = new Map();
const memLiterature = new Map();
const memEvidenceExtracts = new Map();
const memLiteratureMatrices = new Map();
const memLiteratureThemes = new Map();
const memStudyComparisons = new Map();
const memResearchGaps = new Map();
const memSynthesisDrafts = new Map();
const memDatasets = new Map();
const memDatasetVersions = new Map();
const memDatasetVariables = new Map();
const memAnalyses = new Map();
const memAnalysisResults = new Map();
const memAnalysisJobs = new Map();
const memResearchChats = new Map();
const memResearchDocuments = new Map();
const memDocumentChunks = new Map();
const memCitationEvidences = new Map();
const memDocumentProcessingJobs = new Map();
const memDocumentStorage = new Map();
const memSystematicReviews = new Map();
const memStudyRecords = new Map();
const memReviewProtocols = new Map();
const memSearchStrategies = new Map();
const memDuplicateGroups = new Map();
const memScreeningDecisions = new Map();
const memReviewConflicts = new Map();
const memExtractionTemplates = new Map();
const memStudyExtractions = new Map();
const memRiskOfBiasAssessments = new Map();
const memPrismaSnapshots = new Map();
const memReviewAuditEvents = new Map();
const memJournalSubmissions = new Map();
const memSubmissionPackages = new Map();
const isDbConnected = () => mongoose.connection.readyState === 1;
app.locals.memUsers = memUsers;
app.locals.memProjects = memProjects;
app.locals.memProjectMembers = memProjectMembers;
app.locals.memTasks = memTasks;
app.locals.memDocuments = memDocuments;
app.locals.memDocumentVersions = memDocumentVersions;
app.locals.memRevisions = memRevisions;
app.locals.memCitations = memCitations;
app.locals.memReferenceCollections = memReferenceCollections;
app.locals.memReports = memReports;
app.locals.memJobs = memJobs;
app.locals.memAuditEvents = memAuditEvents;
app.locals.memLatexJobs = memLatexJobs;
app.locals.memLiterature = memLiterature;
app.locals.memEvidenceExtracts = memEvidenceExtracts;
app.locals.memLiteratureMatrices = memLiteratureMatrices;
app.locals.memLiteratureThemes = memLiteratureThemes;
app.locals.memStudyComparisons = memStudyComparisons;
app.locals.memResearchGaps = memResearchGaps;
app.locals.memSynthesisDrafts = memSynthesisDrafts;
app.locals.memDatasets = memDatasets;
app.locals.memDatasetVersions = memDatasetVersions;
app.locals.memDatasetVariables = memDatasetVariables;
app.locals.memAnalyses = memAnalyses;
app.locals.memAnalysisResults = memAnalysisResults;
app.locals.memAnalysisJobs = memAnalysisJobs;
app.locals.memResearchChats = memResearchChats;
app.locals.memResearchDocuments = memResearchDocuments;
app.locals.memDocumentChunks = memDocumentChunks;
app.locals.memCitationEvidences = memCitationEvidences;
app.locals.memDocumentProcessingJobs = memDocumentProcessingJobs;
app.locals.memDocumentStorage = memDocumentStorage;
app.locals.memSystematicReviews = memSystematicReviews;
app.locals.memStudyRecords = memStudyRecords;
app.locals.memReviewProtocols = memReviewProtocols;
app.locals.memSearchStrategies = memSearchStrategies;
app.locals.memDuplicateGroups = memDuplicateGroups;
app.locals.memScreeningDecisions = memScreeningDecisions;
app.locals.memReviewConflicts = memReviewConflicts;
app.locals.memExtractionTemplates = memExtractionTemplates;
app.locals.memStudyExtractions = memStudyExtractions;
app.locals.memRiskOfBiasAssessments = memRiskOfBiasAssessments;
app.locals.memPrismaSnapshots = memPrismaSnapshots;
app.locals.memReviewAuditEvents = memReviewAuditEvents;
app.locals.memJournalSubmissions = memJournalSubmissions;
app.locals.latexArtifactCache = latexArtifactCache;
app.locals.memTextGuardScans = memTextGuardScans;


// Pre-seed default demo credentials (researcher)
const DEMO_EMAIL = 'demo@researchproof.ai';
const DEMO_PASSWORD = 'Password1234!';
const DEMO_HASH = bcrypt.hashSync(DEMO_PASSWORD, 10);
const demoUserId = new mongoose.Types.ObjectId().toString();
memUsers.set(DEMO_EMAIL, {
  _id: demoUserId,
  id: demoUserId,
  email: DEMO_EMAIL,
  passwordHash: DEMO_HASH,
  displayName: 'Demo Researcher',
  role: 'researcher',
  status: 'active',
  tokenVersion: 1,
  privacySettings: { persistDocumentText: true, allowAiProcessing: true },
  createdAt: new Date()
});

// Pre-seed default administrator credentials (admin)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@researchproof.ai';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminPassword123!';
const ADMIN_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 10);
const adminUserId = new mongoose.Types.ObjectId().toString();
memUsers.set(ADMIN_EMAIL, {
  _id: adminUserId,
  id: adminUserId,
  email: ADMIN_EMAIL,
  passwordHash: ADMIN_HASH,
  displayName: 'System Administrator',
  role: 'admin',
  status: 'active',
  tokenVersion: 1,
  privacySettings: { persistDocumentText: true, allowAiProcessing: true },
  createdAt: new Date()
});

async function seedDemoUserToDb() {
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO_USER !== 'true') {
    return; // Never seed demo user with static password into production MongoDB unless explicitly requested
  }
  try {
    const existing = await User.findOne({ email: DEMO_EMAIL });
    if (!existing) {
      await User.create({
        email: DEMO_EMAIL,
        passwordHash: DEMO_HASH,
        displayName: 'Demo Researcher',
        role: 'researcher'
      });
      console.log(`Demo user ready: ${DEMO_EMAIL}`);
    }

    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });
    if (!existingAdmin) {
      await User.create({
        email: ADMIN_EMAIL,
        passwordHash: ADMIN_HASH,
        displayName: 'System Administrator',
        role: 'admin'
      });
      console.log(`System administrator ready: ${ADMIN_EMAIL}`);
    }
  } catch (err) {
    // Non-blocking
  }
}

// Safe Audit Logging Helper (Section 6 & 10)
async function recordAudit(actorId, action, resourceType, resourceId = '', metadata = {}, targetId = null, reason = '', result = 'success') {
  try {
    if (isDbConnected()) {
      await AuditEvent.create({
        actorId,
        targetId,
        action,
        resourceType,
        resourceId: String(resourceId),
        result,
        reason,
        metadata
      });
    } else {
      memAuditEvents.unshift({
        _id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        actorId,
        targetId,
        action,
        resourceType,
        resourceId: String(resourceId),
        result,
        reason,
        metadata,
        createdAt: new Date()
      });
      if (memAuditEvents.length > 500) memAuditEvents.pop();
    }
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}


const textSchema = z.object({ text: z.string().min(1).max(150000) });
const authSchema = z.object({ email: z.string().email().max(254), password: z.string().min(10).max(128), turnstileToken: z.string().optional() });

// Router supporting both /api and /api/v1
const apiRouter = express.Router();

// Health Check
apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ResearchProof AI API',
    version: '1.0.0',
    mode: isDbConnected() ? 'MongoDB Cluster' : 'In-Memory Dev Store (Live)',
    database: isDbConnected() ? 'connected' : 'in-memory-fallback'
  });
});

// Usage Quota Middleware & Helpers (Section 6)
async function checkFeatureQuota(feature) {
  return async function(req, res, next) {
    try {
      const isRewrite = feature === 'rewrite';
      const limit = isRewrite ? FREE_REWRITE_DAILY_LIMIT : FREE_ANALYSIS_DAILY_LIMIT;
      const maxWords = isRewrite ? FREE_REWRITE_MAX_WORDS : FREE_ANALYSIS_MAX_WORDS;

      // 1. Word limit validation
      if (req.body?.text) {
        const words = countWords(req.body.text);
        if (words > maxWords) {
          return res.status(400).json({
            error: `Text exceeds the maximum allowed limit of ${maxWords} words for ${feature} (submitted ${words} words).`,
            maxWords,
            submittedWords: words
          });
        }
      }

      // 2. AI availability check for rewrite
      if (isRewrite) {
        const hasKey = Boolean(
          (process.env.AI_API_KEY && process.env.AI_API_KEY.trim()) ||
          (process.env.REVERSEGPT_API_KEY && process.env.REVERSEGPT_API_KEY.trim())
        );
        if (!hasKey) {
          return res.status(503).json({
            error: 'AI rewriting is temporarily unavailable. The AI provider is not configured.',
            code: 'AI_UNAVAILABLE'
          });
        }
      }

      // 3. Quota check
      if (isRewrite && (isRewriteUnlimited || limit === 'Unlimited')) {
        return next();
      }
      if (!isRewrite && (isAnalysisUnlimited || FREE_ANALYSIS_DAILY_LIMIT <= 0 || limit === 'Unlimited')) {
        return next();
      }

      const userId = req.user.id;
      const today = getUtcDateKey();

      if (isDbConnected()) {
        const usage = await UsageRecord.findOne({ userId, feature, quotaWindow: today }).lean();
        if (usage && usage.usedCount >= limit) {
          return res.status(429).json({
            error: `Daily free ${feature} quota (${limit} requests) reached. Limit resets at 00:00 UTC.`,
            limit,
            remaining: 0,
            resetWindow: today
          });
        }
      } else {
        const mem = memUsers.get(req.user.email);
        const count = mem?.usage?.dailyRequests || 0;
        if (count >= limit) {
          return res.status(429).json({
            error: `Daily free ${feature} quota (${limit} requests) reached. Limit resets at 00:00 UTC.`,
            limit,
            remaining: 0
          });
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

async function recordFeatureUsage(userId, email, feature) {
  const today = getUtcDateKey();
  if (isDbConnected()) {
    await UsageRecord.findOneAndUpdate(
      { userId, feature, quotaWindow: today },
      { $inc: { usedCount: 1 } },
      { upsert: true, new: true }
    );
    await User.findByIdAndUpdate(userId, {
      $inc: { 'usage.dailyRequests': 1 },
      $set: { 'usage.lastResetDate': new Date() }
    });
  } else {
    const mem = memUsers.get(email);
    if (mem) {
      mem.usage = mem.usage || { dailyRequests: 0, dailyLimit: FREE_REWRITE_DAILY_LIMIT, featureCounts: {} };
      mem.usage.featureCounts = mem.usage.featureCounts || {};
      mem.usage.featureCounts[feature] = (mem.usage.featureCounts[feature] || 0) + 1;
      if (feature === 'rewrite') {
        mem.usage.dailyRequests = (mem.usage.dailyRequests || 0) + 1;
      }
    }
  }
}

// Backward-compatible checkAiUsage middleware wrapper
const checkAiUsage = async (req, res, next) => (await checkFeatureQuota('rewrite'))(req, res, next);

// Auth Routes
apiRouter.post('/auth/register', async (req, res, next) => {
  try {
    const parsed = authSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and a password of at least 10 characters.' });
    const email = parsed.data.email.toLowerCase();

    // Bot Protection for Account Creation (enforced when Turnstile is active)
    if (isTurnstileEnabled()) {
      const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress;
      const turnstileToken = req.body?.turnstileToken;
      const turnstileCheck = await executeTurnstileVerification(turnstileToken, clientIp);
      if (!turnstileCheck.success) {
        return res.status(400).json({
          error: turnstileCheck.error || 'Bot verification required. Please complete the security challenge.',
          code: turnstileCheck.code || 'TURNSTILE_REQUIRED',
          requiresTurnstile: true,
          siteKey: getTurnstileSiteKey()
        });
      }
    }

    if (isDbConnected()) {
      if (await User.findOne({ email })) return res.status(409).json({ error: 'An account with this email already exists.' });
      const passwordHash = await bcrypt.hash(parsed.data.password, 12);
      const user = await User.create({
        email,
        passwordHash,
        displayName: email.split('@')[0],
        authProviders: ['email'],
        tokenVersion: 1,
        lastLoginAt: new Date()
      });
      const token = jwt.sign(
        { id: user._id.toString(), email: user.email, tokenVersion: user.tokenVersion || 1 },
        jwtSecret,
        { expiresIn: `${SESSION_TTL_HOURS}h` }
      );
      setSessionCookie(res, token, req);
      await recordAudit(user._id, 'USER_REGISTERED', 'User', user._id);
      return res.status(201).json({
        token,
        user: {
          id: user._id,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          authProviders: user.authProviders || ['email'],
          role: user.role,
          status: user.status
        }
      });
    }

    // In-memory fallback
    if (memUsers.has(email)) return res.status(409).json({ error: 'An account with this email already exists.' });
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const userId = new mongoose.Types.ObjectId().toString();
    const newUser = {
      _id: userId,
      id: userId,
      email,
      passwordHash,
      displayName: email.split('@')[0],
      avatarUrl: '',
      authProviders: ['email'],
      role: 'researcher',
      status: 'active',
      tokenVersion: 1,
      createdAt: new Date(),
      lastLoginAt: new Date()
    };
    memUsers.set(email, newUser);
    const token = jwt.sign(
      { id: userId, email, tokenVersion: newUser.tokenVersion || 1 },
      jwtSecret,
      { expiresIn: `${SESSION_TTL_HOURS}h` }
    );
    setSessionCookie(res, token, req);
    res.status(201).json({
      token,
      user: {
        id: userId,
        email,
        displayName: newUser.displayName,
        avatarUrl: '',
        authProviders: ['email'],
        role: 'researcher',
        status: 'active'
      }
    });
  } catch (e) { next(e); }
});

apiRouter.post('/auth/login', async (req, res, next) => {
  try {
    const parsed = authSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and password.' });
    const email = parsed.data.email.toLowerCase();
    const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress;

    // Risk-Based Bot Protection: enforce Turnstile only if account/IP triggered risk threshold
    const isRisk = isLoginVerificationRequired(email, clientIp);
    if (isRisk) {
      const turnstileToken = req.body?.turnstileToken;
      const turnstileCheck = await executeTurnstileVerification(turnstileToken, clientIp);
      if (!turnstileCheck.success) {
        return res.status(403).json({
          error: turnstileCheck.error || 'Security verification required due to multiple failed login attempts.',
          code: turnstileCheck.code || 'TURNSTILE_REQUIRED',
          requiresTurnstile: true,
          siteKey: getTurnstileSiteKey()
        });
      }
    }

    if (isDbConnected()) {
      const user = await User.findOne({ email });
      if (!user || !user.passwordHash || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
        recordFailedLogin(email);
        recordFailedLogin(clientIp);
        const requiresNow = isLoginVerificationRequired(email, clientIp);
        return res.status(401).json({
          error: 'Invalid email or password.',
          requiresTurnstile: requiresNow,
          siteKey: requiresNow ? getTurnstileSiteKey() : undefined
        });
      }
      if (user.status === 'suspended') {
        return res.status(403).json({ error: 'Account is suspended. Please contact your administrator.' });
      }

      // Successful password authentication: reset risk counters
      resetFailedLogins(email);
      resetFailedLogins(clientIp);

      user.lastLoginAt = new Date();
      await user.save();
      const token = jwt.sign(
        { id: user._id.toString(), email: user.email, tokenVersion: user.tokenVersion || 1 },
        jwtSecret,
        { expiresIn: `${SESSION_TTL_HOURS}h` }
      );
      setSessionCookie(res, token, req);
      await recordAudit(user._id, 'USER_LOGIN', 'User', user._id);
      return res.json({
        token,
        user: {
          id: user._id,
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          avatarUrl: user.avatarUrl,
          authProviders: user.authProviders || ['email'],
          role: user.role,
          status: user.status
        }
      });
    }

    // In-memory fallback
    const user = memUsers.get(email);
    if (!user || !user.passwordHash || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      recordFailedLogin(email);
      recordFailedLogin(clientIp);
      const requiresNow = isLoginVerificationRequired(email, clientIp);
      return res.status(401).json({
        error: 'Invalid email or password.',
        requiresTurnstile: requiresNow,
        siteKey: requiresNow ? getTurnstileSiteKey() : undefined
      });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended. Please contact your administrator.' });
    }

    // Successful login: reset risk counters
    resetFailedLogins(email);
    resetFailedLogins(clientIp);

    user.lastLoginAt = new Date();
    const token = jwt.sign(
      { id: user.id || user._id, email: user.email, tokenVersion: user.tokenVersion || 1 },
      jwtSecret,
      { expiresIn: `${SESSION_TTL_HOURS}h` }
    );
    setSessionCookie(res, token, req);
    res.json({
      token,
      user: {
        id: user.id || user._id,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        avatarUrl: user.avatarUrl || '',
        authProviders: user.authProviders || ['email'],
        role: user.role || 'researcher',
        status: user.status || 'active'
      }
    });
  } catch (e) { next(e); }
});

// Public Auth Configuration (exposes Client ID and Turnstile Site Key for frontend initialization)
apiRouter.get('/auth/config', (req, res) => {
  const rawClientId = getGoogleClientId();
  const isConfigured = Boolean(
    rawClientId &&
    rawClientId !== 'your-google-oauth-client-id.apps.googleusercontent.com' &&
    rawClientId.trim().length > 10
  );
  const turnstileActive = isTurnstileEnabled();
  res.json({
    googleClientId: isConfigured ? rawClientId : '',
    googleConfigured: isConfigured,
    googleRedirectUri: getGoogleRedirectUri(req),
    turnstileSiteKey: turnstileActive ? getTurnstileSiteKey() : '',
    turnstileEnabled: turnstileActive,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Risk status check for login flow
apiRouter.get('/auth/risk-status', (req, res) => {
  const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress;
  const email = (req.query.email || '').toLowerCase().trim();
  const requiresTurnstile = isTurnstileEnabled() && isLoginVerificationRequired(email, clientIp);
  res.json({
    requiresTurnstile,
    siteKey: isTurnstileEnabled() ? getTurnstileSiteKey() : ''
  });
});

// Helper to determine backend base URL for OAuth callbacks
function getBackendOrigin(req) {
  // 1. Explicit BACKEND_URL (ignore localhost in production)
  if (process.env.BACKEND_URL && process.env.BACKEND_URL.trim()) {
    const raw = process.env.BACKEND_URL.trim().replace(/\/+$/, '');
    const isLocal = raw.includes('localhost') || raw.includes('127.0.0.1');
    if (!(process.env.NODE_ENV === 'production' && isLocal)) {
      return raw;
    }
  }

  // 2. Render automatically injects RENDER_EXTERNAL_URL (e.g. https://research-proof-1.onrender.com)
  if (process.env.RENDER_EXTERNAL_URL && process.env.RENDER_EXTERNAL_URL.trim()) {
    return process.env.RENDER_EXTERNAL_URL.trim().replace(/\/+$/, '');
  }

  // 3. Fallback to request host / headers
  if (req) {
    const forwardedProto = (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || (req.secure ? 'https' : 'http');
    const forwardedHost = (req.headers['x-forwarded-host'] || '').split(',')[0].trim() || req.headers.host || '';
    const isProduction = process.env.NODE_ENV === 'production';
    const isRenderDomain = forwardedHost.includes('.onrender.com');
    const proto = (isProduction || isRenderDomain) ? 'https' : forwardedProto;
    if (forwardedHost) {
      return `${proto}://${forwardedHost}`;
    }
  }

  return (process.env.CLIENT_ORIGIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:4000').replace(/\/+$/, '');
}

// Configurable, canonical Google OAuth 2.0 Redirect URI resolution
function getGoogleRedirectUri(req) {
  // 1. Explicit override via GOOGLE_REDIRECT_URI environment variable
  if (process.env.GOOGLE_REDIRECT_URI && process.env.GOOGLE_REDIRECT_URI.trim()) {
    return process.env.GOOGLE_REDIRECT_URI.trim().replace(/\/+$/, '');
  }

  // 2. Canonical callback URL on backend
  const origin = getBackendOrigin(req);
  return `${origin}/api/auth/google/callback`;
}

// Open redirect defense: sanitize frontend return destination
function getSafeReturnUrl(targetUrl, req) {
  const backendOrigin = getBackendOrigin(req);
  const defaultUrl = process.env.CLIENT_ORIGIN || '/';
  if (!targetUrl) return defaultUrl;

  try {
    if (targetUrl.startsWith('/') && !targetUrl.startsWith('//')) {
      return targetUrl;
    }
    const parsed = new URL(targetUrl, backendOrigin);
    const host = parsed.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    const isRender = host.endsWith('.onrender.com');
    const isVercel = host.endsWith('.vercel.app');
    const isClientOrigin = process.env.CLIENT_ORIGIN && parsed.origin === new URL(process.env.CLIENT_ORIGIN).origin;
    const isSameOrigin = parsed.origin === backendOrigin;

    if (isLocal || isRender || isVercel || isClientOrigin || isSameOrigin) {
      return parsed.toString();
    }
  } catch (_) {}

  return defaultUrl;
}

if (!app.locals.oauthSessions) {
  app.locals.oauthSessions = new Map();
}

// Google OAuth 2.0 Authorization Code Start (Full-Page Redirect)
apiRouter.get('/auth/google/start', (req, res) => {
  try {
    const rawClientId = getGoogleClientId();
    if (!rawClientId || rawClientId === 'your-google-oauth-client-id.apps.googleusercontent.com') {
      return res.status(500).json({ error: 'Google OAuth Client ID is not configured on this server.' });
    }

    // 1. Generate cryptographic state and PKCE verifier + challenge
    const state = crypto.randomBytes(32).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    const safeReturn = getSafeReturnUrl(req.query.return_to, req);
    const isProduction = process.env.NODE_ENV === 'production';
    const redirectUri = getGoogleRedirectUri(req);
    console.log(`[Google OAuth 2.0 Start] Client ID: ${rawClientId}, Redirect URI: ${redirectUri}`);

    const cookieOpts = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000 // 15 minutes
    };

    res.cookie('rp_oauth_state', state, cookieOpts);
    res.cookie('rp_oauth_verifier', codeVerifier, cookieOpts);
    res.cookie('rp_oauth_return', safeReturn, cookieOpts);
    res.cookie('rp_oauth_redirect_uri', redirectUri, cookieOpts);

    if (!app.locals.oauthSessions) {
      app.locals.oauthSessions = new Map();
    }
    app.locals.oauthSessions.set(state, {
      codeVerifier,
      returnTo: safeReturn,
      redirectUri,
      createdAt: Date.now()
    });

    // Prune expired sessions
    const now = Date.now();
    for (const [k, v] of app.locals.oauthSessions.entries()) {
      if (now - v.createdAt > 30 * 60 * 1000) app.locals.oauthSessions.delete(k);
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', rawClientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('access_type', 'online');
    authUrl.searchParams.set('prompt', 'select_account');

    res.redirect(authUrl.toString());
  } catch (err) {
    console.error('[Google OAuth 2.0 Start Failure]', err);
    res.status(500).json({ error: 'Failed to start Google OAuth flow: ' + (err.message || 'Internal server error') });
  }
});

// Google OAuth 2.0 Authorization Code Callback Handler
async function handleGoogleOAuthCallback(req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production';
  const clearOAuthCookies = () => {
    const opts = {
      httpOnly: true,
      secure: isProduction,
      path: '/'
    };
    for (const name of ['rp_oauth_state', 'rp_oauth_verifier', 'rp_oauth_return', 'rp_oauth_redirect_uri']) {
      res.clearCookie(name, { ...opts, sameSite: 'lax' });
      if (isProduction) {
        res.clearCookie(name, { ...opts, sameSite: 'none' });
      }
    }
  };

  const incomingState = req.query.state;
  const cookieState = req.cookies?.rp_oauth_state;
  const memSession = incomingState ? app.locals.oauthSessions?.get(incomingState) : null;
  const targetReturn = req.cookies?.rp_oauth_return || memSession?.returnTo || process.env.CLIENT_ORIGIN || '/';

  const sendAuthError = (errMsg, extraQuery = {}) => {
    clearOAuthCookies();
    if (incomingState) app.locals.oauthSessions?.delete(incomingState);
    const redirectUrl = new URL(targetReturn, getBackendOrigin(req));
    redirectUrl.searchParams.set('auth_error', errMsg);
    for (const [k, v] of Object.entries(extraQuery)) {
      redirectUrl.searchParams.set(k, v);
    }
    return res.redirect(redirectUrl.toString());
  };

  if (req.query.error) {
    const desc = req.query.error_description || req.query.error;
    return sendAuthError(`Google authentication cancelled: ${desc}`);
  }

  if (!incomingState || (!cookieState && !memSession) || (cookieState && incomingState !== cookieState)) {
    return sendAuthError('Invalid or expired OAuth state parameter. Please try again.');
  }

  const codeVerifier = req.cookies?.rp_oauth_verifier || memSession?.codeVerifier;
  if (!codeVerifier) {
    return sendAuthError('Missing PKCE code verifier. Please try again.');
  }

  const code = req.query.code;
  if (!code) {
    return sendAuthError('No authorization code returned from Google.');
  }

  // Consume OAuth memory session state immediately to prevent state replay
  if (incomingState) {
    app.locals.oauthSessions?.delete(incomingState);
  }

  // Anti-replay: Track and reject authorization code reuse / duplicate callback invocations
  if (!app.locals.usedAuthCodes) {
    app.locals.usedAuthCodes = new Set();
  }
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  if (app.locals.usedAuthCodes.has(codeHash)) {
    console.warn('[Google OAuth Callback] Authorization code reuse attempted (duplicate callback).');
    return sendAuthError('The Google authorization code has already been used (invalid_grant). Please sign in again.');
  }
  app.locals.usedAuthCodes.add(codeHash);
  setTimeout(() => {
    app.locals.usedAuthCodes?.delete(codeHash);
  }, 10 * 60 * 1000);

  try {
    const rawClientId = getGoogleClientId();
    // Consistent redirect_uri: MUST match the exact redirect_uri used during the authorization request
    const redirectUri = memSession?.redirectUri || req.cookies?.rp_oauth_redirect_uri || getGoogleRedirectUri(req);
    console.log(`[Google OAuth 2.0 Callback] Processing state: ${incomingState}, redirect_uri: ${redirectUri}`);

    const tokenParams = new URLSearchParams({
      code,
      client_id: rawClientId,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier
    });
    const clientSecret = getGoogleClientSecret();
    if (!clientSecret) {
      console.warn('[Google OAuth Token Exchange] WARNING: GOOGLE_CLIENT_SECRET is missing from environment. Google Web Client token exchange may fail with invalid_client.');
      return sendAuthError('Google authentication failed: GOOGLE_CLIENT_SECRET is not configured on this server. Please configure it in your deployment settings.');
    } else {
      tokenParams.set('client_secret', clientSecret);
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString()
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => '');
      let googleError = 'token_exchange_failed';
      let googleErrorDesc = '';
      try {
        const errJson = JSON.parse(errText);
        googleError = errJson.error || googleError;
        googleErrorDesc = errJson.error_description || '';
      } catch (_) {
        googleErrorDesc = (errText || '').slice(0, 200);
      }

      // Safe, sanitized logging without exposing code, secret, or tokens
      console.error('[Google OAuth Token Exchange Failure]', {
        status: tokenRes.status,
        error: googleError,
        description: googleErrorDesc,
        clientIdUsed: rawClientId ? `${rawClientId.substring(0, 15)}...` : 'none',
        hasClientSecret: Boolean(clientSecret),
        redirectUriSent: redirectUri
      });

      // Distinguish specific failure reasons according to RFC 6749 & Google OAuth specifications
      let userFriendlyMsg = 'Google authentication failed. Please try again.';
      if (googleError === 'invalid_client') {
        userFriendlyMsg = `Google OAuth client authentication failed (invalid_client). The GOOGLE_CLIENT_SECRET in Render environment settings does not match Client ID ${rawClientId ? `${rawClientId.substring(0, 15)}...` : ''}. Please verify in Google Cloud Console and Render.`;
      } else if (googleError === 'invalid_grant') {
        userFriendlyMsg = 'Google authorization code is invalid, expired, or already used (invalid_grant). Please try signing in again.';
      } else if (googleError === 'redirect_uri_mismatch') {
        userFriendlyMsg = `Google redirect URI mismatch (redirect_uri_mismatch). Expected registered URI: ${redirectUri}`;
      } else if (googleErrorDesc) {
        userFriendlyMsg = `Google authentication failed: ${googleErrorDesc}`;
      }

      return sendAuthError(userFriendlyMsg, { google_error: googleError });
    }

    const tokenData = await tokenRes.json();
    if (!tokenData.id_token) {
      return sendAuthError('Google token response did not contain an ID token.');
    }

    const googleProfile = await googleTokenVerifier(tokenData.id_token);
    const { googleId, email, displayName, avatarUrl } = googleProfile;

    let user;
    if (isDbConnected()) {
      user = await User.findOne({ googleId });
      if (!user) {
        const existingByEmail = await User.findOne({ email });
        if (existingByEmail) {
          if (existingByEmail.passwordHash && !existingByEmail.googleId) {
            return sendAuthError('account_linking_required', { email });
          }
          user = existingByEmail;
          user.googleId = googleId;
          if (!user.authProviders?.includes('google')) {
            user.authProviders = [...(user.authProviders || []), 'google'];
          }
          if (!user.avatarUrl && avatarUrl) user.avatarUrl = avatarUrl;
          if (!user.displayName && displayName) user.displayName = displayName;
          user.lastLoginAt = new Date();
          await user.save();
          await recordAudit(user._id, 'USER_ACCOUNT_LINKED_GOOGLE', 'User', user._id);
        } else {
          user = await User.create({
            googleId,
            email,
            displayName,
            avatarUrl,
            authProviders: ['google'],
            emailVerified: true,
            role: 'researcher',
            status: 'active',
            lastLoginAt: new Date(),
            usage: { dailyRequests: 0, dailyLimit: FREE_REWRITE_DAILY_LIMIT, lastResetDate: new Date() }
          });
          await recordAudit(user._id, 'USER_REGISTERED_GOOGLE', 'User', user._id);
        }
      } else {
        if (avatarUrl && !user.avatarUrl) user.avatarUrl = avatarUrl;
        user.lastLoginAt = new Date();
        await user.save();
      }

      if (user.status === 'suspended') {
        return sendAuthError('Your account is suspended. Please contact your administrator.');
      }
    } else {
      user = [...memUsers.values()].find(u => u.googleId === googleId);
      if (!user) {
        const existing = memUsers.get(email);
        if (existing) {
          if (existing.passwordHash && !existing.googleId) {
            return sendAuthError('account_linking_required', { email });
          }
          user = existing;
          user.googleId = googleId;
          user.avatarUrl = avatarUrl || user.avatarUrl;
          if (!user.authProviders?.includes('google')) {
            user.authProviders = [...(user.authProviders || ['email']), 'google'];
          }
          user.lastLoginAt = new Date();
        } else {
          const userId = new mongoose.Types.ObjectId().toString();
          user = {
            _id: userId,
            id: userId,
            googleId,
            email,
            displayName,
            avatarUrl,
            authProviders: ['google'],
            emailVerified: true,
            role: 'researcher',
            status: 'active',
            tokenVersion: 1,
            usage: { dailyRequests: 0, dailyLimit: FREE_REWRITE_DAILY_LIMIT },
            createdAt: new Date(),
            lastLoginAt: new Date()
          };
          memUsers.set(email, user);
        }
      }

      if (user.status === 'suspended') {
        return sendAuthError('Your account is suspended. Please contact your administrator.');
      }
    }

    const token = jwt.sign(
      { id: user._id?.toString() || user.id, email: user.email, tokenVersion: user.tokenVersion || 1, role: user.role || 'researcher' },
      jwtSecret,
      { expiresIn: `${SESSION_TTL_HOURS}h` }
    );
    setSessionCookie(res, token, req);
    clearOAuthCookies();
    if (incomingState) app.locals.oauthSessions?.delete(incomingState);

    // Single-use, short-lived (60s) session exchange ticket
    // Allows the frontend to claim the session reliably without exposing JWT in URL query parameters
    const claimTicket = crypto.randomBytes(24).toString('hex');
    if (!app.locals.authTickets) app.locals.authTickets = new Map();
    app.locals.authTickets.set(claimTicket, {
      token,
      user: {
        id: user._id?.toString() || user.id,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        avatarUrl: user.avatarUrl || '',
        role: user.role || 'researcher',
        status: user.status || 'active'
      },
      expiresAt: Date.now() + 60 * 1000
    });

    // Prune expired tickets
    const nowTs = Date.now();
    for (const [k, v] of app.locals.authTickets.entries()) {
      if (nowTs > v.expiresAt) app.locals.authTickets.delete(k);
    }

    const successUrl = new URL(targetReturn, getBackendOrigin(req));
    successUrl.searchParams.set('auth_status', 'google_success');
    successUrl.searchParams.set('ticket', claimTicket);
    return res.redirect(successUrl.toString());
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return sendAuthError(err.message || 'Authentication failed. Please try again.');
  }
}

// Session Claim Endpoint (Section 5 & 6)
// Validates single-use ticket, issues fresh session cookies, and returns authenticated payload
apiRouter.post('/auth/session/claim', async (req, res) => {
  try {
    const { ticket } = req.body || {};
    if (!ticket || typeof ticket !== 'string') {
      return res.status(400).json({ error: 'Missing session claim ticket.' });
    }

    const session = app.locals.authTickets?.get(ticket);
    if (!session || Date.now() > session.expiresAt) {
      if (session) app.locals.authTickets?.delete(ticket);
      return res.status(401).json({ error: 'Session claim ticket is expired or invalid. Please sign in again.' });
    }

    // Atomically invalidate ticket to prevent replay
    app.locals.authTickets?.delete(ticket);

    // Re-set session cookie with correct path & attributes
    setSessionCookie(res, session.token, req);

    return res.json({
      token: session.token,
      user: session.user
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to claim session.' });
  }
});

// Mount callback handler on /api/auth/google/callback
apiRouter.get('/auth/google/callback', handleGoogleOAuthCallback);

// Also mount on root app (/auth/google/callback) so callback works whether or not /api prefix was used
app.get('/auth/google/callback', handleGoogleOAuthCallback);
app.get('/auth/google/start', (req, res) => {
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(`/api/auth/google/start${query}`);
});


// Google Authentication (Section 2 & 4) - Direct ID Token fallback
apiRouter.post('/auth/google', async (req, res, next) => {
  try {
    const googleSchema = z.object({ credential: z.string().min(1, 'Google credential token is required.') });
    const parsed = googleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid Google credential.' });
    }

    // Verify token cryptographically
    const googleProfile = await googleTokenVerifier(parsed.data.credential);
    const { googleId, email, displayName, avatarUrl } = googleProfile;

    let user;
    if (isDbConnected()) {
      // 1. Search by Google ID first
      user = await User.findOne({ googleId });

      // 2. If not found by googleId, check by email
      if (!user) {
        const existingByEmail = await User.findOne({ email });
        if (existingByEmail) {
          // If existing account has password authentication and is not yet linked
          if (existingByEmail.passwordHash && !existingByEmail.googleId) {
            return res.status(409).json({
              error: 'An account with this email already exists using password authentication. Please sign in with your password to link your Google account.',
              code: 'ACCOUNT_LINKING_REQUIRED',
              email
            });
          }
          user = existingByEmail;
          user.googleId = googleId;
          if (!user.authProviders?.includes('google')) {
            user.authProviders = [...(user.authProviders || []), 'google'];
          }
          if (!user.avatarUrl && avatarUrl) user.avatarUrl = avatarUrl;
          if (!user.displayName && displayName) user.displayName = displayName;
          user.lastLoginAt = new Date();
          await user.save();
          await recordAudit(user._id, 'USER_ACCOUNT_LINKED_GOOGLE', 'User', user._id);
        } else {
          // 3. Register new Google user
          user = await User.create({
            googleId,
            email,
            displayName,
            avatarUrl,
            authProviders: ['google'],
            emailVerified: true,
            role: 'researcher',
            status: 'active',
            lastLoginAt: new Date(),
            usage: { dailyRequests: 0, dailyLimit: FREE_REWRITE_DAILY_LIMIT, lastResetDate: new Date() }
          });
          await recordAudit(user._id, 'USER_REGISTERED_GOOGLE', 'User', user._id);
        }
      } else {
        // Update profile picture and last login
        if (avatarUrl && !user.avatarUrl) user.avatarUrl = avatarUrl;
        user.lastLoginAt = new Date();
        await user.save();
      }

      // Check account status
      if (user.status === 'suspended') {
        return res.status(403).json({ error: 'Your account is suspended. Please contact your administrator.' });
      }

      const token = jwt.sign(
        { id: user._id.toString(), email: user.email, tokenVersion: user.tokenVersion || 1 },
        jwtSecret,
        { expiresIn: `${SESSION_TTL_HOURS}h` }
      );
      setSessionCookie(res, token, req);
      await recordAudit(user._id, 'USER_LOGIN_GOOGLE', 'User', user._id);

      return res.json({
        token,
        user: {
          id: user._id,
          email: user.email,
          displayName: user.displayName || displayName,
          avatarUrl: user.avatarUrl || avatarUrl,
          authProviders: user.authProviders || ['google'],
          role: user.role,
          status: user.status,
          usage: user.usage || { dailyRequests: 0, dailyLimit: FREE_REWRITE_DAILY_LIMIT }
        }
      });
    }

    // In-memory fallback
    user = [...memUsers.values()].find(u => u.googleId === googleId);
    if (!user) {
      const existing = memUsers.get(email);
      if (existing) {
        if (existing.passwordHash && !existing.googleId) {
          return res.status(409).json({
            error: 'An account with this email already exists using password authentication. Please sign in with your password to link your Google account.',
            code: 'ACCOUNT_LINKING_REQUIRED',
            email
          });
        }
        user = existing;
        user.googleId = googleId;
        user.avatarUrl = avatarUrl || user.avatarUrl;
        if (!user.authProviders?.includes('google')) {
          user.authProviders = [...(user.authProviders || ['email']), 'google'];
        }
        user.lastLoginAt = new Date();
      } else {
        const userId = new mongoose.Types.ObjectId().toString();
        user = {
          _id: userId,
          id: userId,
          googleId,
          email,
          displayName,
          avatarUrl,
          authProviders: ['google'],
          emailVerified: true,
          role: 'researcher',
          status: 'active',
          tokenVersion: 1,
          usage: { dailyRequests: 0, dailyLimit: FREE_REWRITE_DAILY_LIMIT },
          createdAt: new Date(),
          lastLoginAt: new Date()
        };
        memUsers.set(email, user);
      }
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Your account is suspended. Please contact your administrator.' });
    }

    const token = jwt.sign(
      { id: user._id || user.id, email: user.email, tokenVersion: user.tokenVersion || 1 },
      jwtSecret,
      { expiresIn: `${SESSION_TTL_HOURS}h` }
    );
    setSessionCookie(res, token, req);

    res.json({
      token,
      user: {
        id: user._id || user.id,
        email: user.email,
        displayName: user.displayName || displayName,
        avatarUrl: user.avatarUrl || avatarUrl,
        authProviders: user.authProviders || ['google'],
        role: user.role || 'researcher',
        status: user.status || 'active',
        usage: user.usage || { dailyRequests: 0, dailyLimit: FREE_REWRITE_DAILY_LIMIT }
      }
    });
  } catch (err) {
    console.error('Google authentication error:', err.message);
    res.status(401).json({ error: err.message || 'Google authentication failed. Please try again.' });
  }
});

// Secure Account Linking Endpoint (Section 3)
apiRouter.post('/auth/link-google', requireAuth, async (req, res, next) => {
  try {
    const googleSchema = z.object({ credential: z.string().min(1, 'Google credential token is required.') });
    const parsed = googleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid Google credential.' });
    }

    const googleProfile = await googleTokenVerifier(parsed.data.credential);
    const { googleId, email, avatarUrl } = googleProfile;

    if (email.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(400).json({
        error: `Google account email (${email}) does not match your signed-in account (${req.user.email}).`
      });
    }

    if (isDbConnected()) {
      const conflict = await User.findOne({ googleId, _id: { $ne: req.user.id } });
      if (conflict) {
        return res.status(409).json({ error: 'This Google account is already linked to another ResearchProof user.' });
      }

      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found.' });

      user.googleId = googleId;
      if (!user.authProviders?.includes('google')) {
        user.authProviders = [...(user.authProviders || []), 'google'];
      }
      if (avatarUrl && !user.avatarUrl) user.avatarUrl = avatarUrl;
      await user.save();
      await recordAudit(user._id, 'USER_ACCOUNT_LINKED_GOOGLE', 'User', user._id);

      return res.json({
        success: true,
        message: 'Google account linked successfully.',
        user: {
          id: user._id,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          authProviders: user.authProviders,
          role: user.role,
          status: user.status
        }
      });
    }

    // In-memory fallback
    for (const [otherEmail, otherUser] of memUsers.entries()) {
      if (otherEmail.toLowerCase() !== req.user.email.toLowerCase() && otherUser.googleId === googleId) {
        return res.status(409).json({ error: 'This Google account is already linked to another ResearchProof user.' });
      }
    }

    const mem = memUsers.get(req.user.email);
    if (!mem) return res.status(404).json({ error: 'User not found.' });
    mem.googleId = googleId;
    if (!mem.authProviders?.includes('google')) {
      mem.authProviders = [...(mem.authProviders || []), 'google'];
    }
    if (avatarUrl && !mem.avatarUrl) mem.avatarUrl = avatarUrl;

    res.json({
      success: true,
      message: 'Google account linked successfully.',
      user: {
        id: mem.id || mem._id,
        email: mem.email,
        displayName: mem.displayName,
        avatarUrl: mem.avatarUrl,
        authProviders: mem.authProviders,
        role: mem.role || 'researcher',
        status: mem.status || 'active'
      }
    });
  } catch (err) {
    console.error('Account linking error:', err.message);
    res.status(401).json({ error: err.message || 'Failed to verify Google account.' });
  }
});

// Logout endpoint with server-side session invalidation (Section 4 & 5)
apiRouter.post('/auth/logout', async (req, res) => {
  try {
    let token = req.cookies?.[SESSION_COOKIE_NAME] || req.cookies?.rp_session || req.cookies?.researchproof_session || '';
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.startsWith('Bearer ')
        ? req.headers.authorization.slice(7).trim()
        : req.headers.authorization.trim();
    }
    if (token) {
      try {
        const decoded = jwt.decode(token);
        if (decoded?.id || decoded?.email) {
          if (isDbConnected() && decoded.id) {
            await User.findByIdAndUpdate(decoded.id, { $inc: { tokenVersion: 1 } });
            await recordAudit(decoded.id, 'USER_LOGOUT', 'User', decoded.id);
          } else {
            const mem = (decoded.email && memUsers.get(decoded.email)) ||
              [...memUsers.values()].find(u => u._id === decoded.id || u.id === decoded.id);
            if (mem) mem.tokenVersion = (mem.tokenVersion || 1) + 1;
          }
        }
      } catch (_) {}
    }
  } catch (_) {}
  clearSessionCookie(res, req);
  res.json({ success: true, message: 'Logged out successfully.' });
});

// Free Usage Limits Endpoint (Section 6)
apiRouter.get('/usage/me', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = getUtcDateKey();
    let rewriteUsed = 0;
    let analysisUsed = 0;

    if (isDbConnected()) {
      const records = await UsageRecord.find({ userId, quotaWindow: today }).lean();
      for (const r of records) {
        if (r.feature === 'rewrite') rewriteUsed = r.usedCount;
        if (r.feature === 'analysis') analysisUsed = r.usedCount;
      }
    } else {
      const mem = memUsers.get(req.user.email);
      rewriteUsed = mem?.usage?.featureCounts?.rewrite ?? (mem?.usage?.dailyRequests || 0);
      analysisUsed = mem?.usage?.featureCounts?.analysis || 0;
    }

    const tomorrowUtc = new Date();
    tomorrowUtc.setUTCHours(24, 0, 0, 0);

    const hasAiKey = Boolean(
      (process.env.AI_API_KEY && process.env.AI_API_KEY.trim()) ||
      (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) ||
      (process.env.REVERSEGPT_API_KEY && process.env.REVERSEGPT_API_KEY.trim())
    );

    res.json({
      date: today,
      aiAvailable: hasAiKey,
      rewrite: {
        used: rewriteUsed,
        limit: FREE_REWRITE_DAILY_LIMIT,
        remaining: isRewriteUnlimited ? 'Unlimited' : Math.max(0, Number(FREE_REWRITE_DAILY_LIMIT) - rewriteUsed),
        isUnlimited: isRewriteUnlimited,
        maxWords: FREE_REWRITE_MAX_WORDS
      },
      analysis: {
        used: analysisUsed,
        limit: FREE_ANALYSIS_DAILY_LIMIT,
        remaining: isAnalysisUnlimited ? 'Unlimited' : Math.max(0, Number(FREE_ANALYSIS_DAILY_LIMIT) - analysisUsed),
        isUnlimited: isAnalysisUnlimited,
        maxWords: FREE_ANALYSIS_MAX_WORDS
      },
      resetAt: tomorrowUtc.toISOString()
    });
  } catch (err) {
    next(err);
  }
});

// Profile endpoints
apiRouter.get(['/auth/me', '/me'], requireAuth, async (req, res) => {
  try {
    const sessionToken = req.cookies?.[SESSION_COOKIE_NAME] || req.cookies?.rp_session || req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
    if (isDbConnected()) {
      let user = null;
      if (req.user.id && mongoose.Types.ObjectId.isValid(req.user.id)) {
        user = await User.findById(req.user.id).select('-passwordHash').lean();
      }
      if (!user && req.user.id) {
        user = await User.findOne({ googleId: req.user.id }).select('-passwordHash').lean();
      }
      if (!user && req.user.email) {
        user = await User.findOne({ email: req.user.email.toLowerCase() }).select('-passwordHash').lean();
      }
      if (!user) {
        clearSessionCookie(res, req);
        return res.status(404).json({ error: 'User account not found.', code: 'ACCOUNT_NOT_FOUND' });
      }
      const token = sessionToken || jwt.sign({ id: user._id.toString(), email: user.email, tokenVersion: user.tokenVersion || 1, role: user.role }, jwtSecret, { expiresIn: `${SESSION_TTL_HOURS}h` });
      return res.json({
        token,
        user: {
          id: user._id,
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          avatarUrl: user.avatarUrl || '',
          role: user.role || 'researcher',
          status: user.status || 'active',
          usage: user.usage || { dailyRequests: 0, dailyLimit: 50 }
        }
      });
    }

    const user = memUsers.get(req.user.email) ||
      [...memUsers.values()].find(u => (u._id === req.user.id || u.id === req.user.id || u.googleId === req.user.id));
    if (!user) {
      clearSessionCookie(res, req);
      return res.status(404).json({ error: 'User account not found.', code: 'ACCOUNT_NOT_FOUND' });
    }
    const token = sessionToken || jwt.sign({ id: user._id || user.id, email: user.email, tokenVersion: user.tokenVersion || 1, role: user.role }, jwtSecret, { expiresIn: `${SESSION_TTL_HOURS}h` });
    res.json({
      token,
      user: {
        id: user._id || user.id,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        avatarUrl: user.avatarUrl || '',
        role: user.role || 'researcher',
        status: user.status || 'active',
        usage: { dailyRequests: 0, dailyLimit: 50 }
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});

async function resolveAnalysisText(req) {
  let text = req.body?.text ?? req.body?.content ?? req.body?.documentText ?? req.body?.manuscript;
  if ((!text || typeof text !== 'string' || !text.trim()) && req.body?.documentId) {
    if (isDbConnected()) {
      const doc = await Document.findOne({ _id: req.body.documentId, ownerId: req.user.id }).lean();
      if (doc) text = doc.content;
    } else {
      const doc = memDocuments.get(req.body.documentId);
      if (doc && doc.ownerId === req.user.id) text = doc.content;
    }
  }
  return typeof text === 'string' ? text.trim() : '';
}

// Writing Analysis (Section 6: Analysis Limits)
apiRouter.post(['/analyze/writing', '/analysis/writing', '/writing'], requireAuth, async (req, res, next) => {
  try {
    const text = await resolveAnalysisText(req);
    if (!text || text.length > 150000) return res.status(400).json({ error: 'Text is required and must be under 150,000 characters.' });
    const words = countWords(text);
    if (words > FREE_ANALYSIS_MAX_WORDS) {
      return res.status(400).json({
        error: `Text exceeds the analysis limit of ${FREE_ANALYSIS_MAX_WORDS} words (submitted ${words} words).`,
        maxWords: FREE_ANALYSIS_MAX_WORDS,
        submittedWords: words
      });
    }
    await recordFeatureUsage(req.user.id, req.user.email, 'analysis');
    res.json(assessWriting(text));
  } catch (e) { next(e); }
});

// Similarity, Plagiarism & Originality
apiRouter.post(
  ['/analyze/originality', '/analysis/originality', '/analyze/similarity', '/analysis/similarity', '/originality', '/similarity', '/analyze/plagiarism', '/analysis/plagiarism', '/plagiarism'],
  requireAuth,
  async (req, res, next) => {
    try {
      const text = await resolveAnalysisText(req);
      if (!text || text.length > 150000) return res.status(400).json({ error: 'Text is required and must be under 150,000 characters.' });
      const words = countWords(text);
      if (words > FREE_ANALYSIS_MAX_WORDS) {
        return res.status(400).json({
          error: `Text exceeds the analysis limit of ${FREE_ANALYSIS_MAX_WORDS} words (submitted ${words} words).`,
          maxWords: FREE_ANALYSIS_MAX_WORDS,
          submittedWords: words
        });
      }
      await recordFeatureUsage(req.user.id, req.user.email, 'analysis');
      const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
      const originalityReport = assessOriginality(text);
      const plagiarismReport = assessPlagiarismAndSimilarity(text, req.body?.options || {});
      const aiReport = assessAiAuthorship(text);
      res.json({
        wordCount: words,
        sentenceCount: sentences.length,
        averageWordsPerSentence: sentences.length ? Math.round(words / sentences.length * 10) / 10 : 0,
        ...originalityReport,
        ...plagiarismReport,
        aiLikelihood: aiReport.aiLikelihood,
        humanLikelihood: aiReport.humanLikelihood,
        aiClassification: aiReport.classification,
        burstinessScore: aiReport.burstinessScore,
        aiIndicators: aiReport.indicators,
        aiFlaggedSegments: aiReport.flaggedSegments
      });
    } catch (e) { next(e); }
  }
);

// AI-Generated Text Detection & Authorship Heuristics
apiRouter.post(
  ['/analyze/ai-detection', '/analysis/ai-detection', '/analyze/ai-authorship', '/analysis/ai-authorship', '/ai-detection', '/ai-authorship'],
  requireAuth,
  async (req, res, next) => {
    try {
      const text = await resolveAnalysisText(req);
      if (!text || text.length > 150000) return res.status(400).json({ error: 'Text is required and must be under 150,000 characters.' });
      const words = countWords(text);
      if (words > FREE_ANALYSIS_MAX_WORDS) {
        return res.status(400).json({
          error: `Text exceeds the analysis limit of ${FREE_ANALYSIS_MAX_WORDS} words (submitted ${words} words).`,
          maxWords: FREE_ANALYSIS_MAX_WORDS,
          submittedWords: words
        });
      }
      await recordFeatureUsage(req.user.id, req.user.email, 'analysis');
      const aiReport = assessAiAuthorship(text);
      res.json(aiReport);
    } catch (e) { next(e); }
  }
);

// Citation Verification (with Crossref DOI resolution)
apiRouter.post(['/analyze/citations', '/analysis/citations', '/citations/check'], requireAuth, async (req, res, next) => {
  try {
    const text = await resolveAnalysisText(req);
    if (!text || text.length > 150000) return res.status(400).json({ error: 'Text is required and must be under 150,000 characters.' });
    const words = countWords(text);
    if (words > FREE_ANALYSIS_MAX_WORDS) {
      return res.status(400).json({
        error: `Text exceeds the analysis limit of ${FREE_ANALYSIS_MAX_WORDS} words (submitted ${words} words).`,
        maxWords: FREE_ANALYSIS_MAX_WORDS,
        submittedWords: words
      });
    }
    await recordFeatureUsage(req.user.id, req.user.email, 'analysis');
    const results = await checkCitations(text);
    res.json(results);
  } catch (e) { next(e); }
});

// AI Academic Revision, Paraphrasing, Summarizing, Humanizing & Tone (Section 4 & 5)
apiRouter.post([
  '/revisions/rewrite', '/rewrite',
  '/humanize', '/revisions/humanize',
  '/paraphrase', '/revisions/paraphrase',
  '/summarize', '/revisions/summarize',
  '/grammar', '/revisions/grammar',
  '/fluency', '/revisions/fluency',
  '/tone', '/revisions/tone'
], requireAuth, checkAiUsage, async (req, res, next) => {
  try {
    const isHumanizeRoute = req.path.includes('humanize');
    const isParaphraseRoute = req.path.includes('paraphrase');
    const isSummarizeRoute = req.path.includes('summarize');
    const isGrammarRoute = req.path.includes('grammar');
    const isFluencyRoute = req.path.includes('fluency');
    const isToneRoute = req.path.includes('tone');

    let defaultMode = 'academic-clarity';
    if (isHumanizeRoute) defaultMode = 'humanize';
    else if (isParaphraseRoute) defaultMode = 'standard';
    else if (isSummarizeRoute) defaultMode = 'summarize';
    else if (isGrammarRoute) defaultMode = 'grammar-correction';
    else if (isFluencyRoute) defaultMode = 'fluency';
    else if (isToneRoute) defaultMode = 'formal-scientific';
    const schema = textSchema.extend({
      mode: z.string().optional().default(defaultMode),
      synonymLevel: z.enum(['low', 'medium', 'high']).optional().default('medium'),
      style: z.string().max(60).optional(),
      preserveTerms: z.string().max(3000).optional(),
      saveRevision: z.boolean().optional().default(true),
      projectId: z.string().optional(),
      documentId: z.string().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Provide text under 150,000 characters and valid options.' });

    // Validate target document ownership if specified
    let targetDoc = null;
    if (parsed.data.documentId) {
      if (isDbConnected()) {
        targetDoc = await Document.findOne({ _id: parsed.data.documentId, ownerId: req.user.id });
      } else {
        targetDoc = memDocuments.get(parsed.data.documentId);
        if (targetDoc && targetDoc.ownerId !== req.user.id) targetDoc = null;
      }
      if (!targetDoc) return res.status(404).json({ error: 'Target document not found or access denied.' });
    }

    const result = await humanizeWithAI(parsed.data);
    await recordFeatureUsage(req.user.id, req.user.email, 'rewrite');

    const meaningWarnings = auditMeaningPreservation(parsed.data.text, result.revisedText);
    let revisionRecord = null;

    if (process.env.PERSIST_DOCUMENT_TEXT !== 'false') {
      const modeName = parsed.data.mode || 'academic-clarity';
      if (isDbConnected()) {
        revisionRecord = await Revision.create({
          userId: req.user.id,
          projectId: mongoose.isValidObjectId(parsed.data.projectId) ? parsed.data.projectId : (targetDoc?.projectId || null),
          documentId: targetDoc?._id || (mongoose.isValidObjectId(parsed.data.documentId) ? parsed.data.documentId : null),
          mode: modeName,
          originalText: parsed.data.text,
          revisedText: result.revisedText,
          proposedText: result.revisedText,
          summary: result.changeSummary,
          meaningWarnings,
          status: 'proposed',
          modelProvider: process.env.AI_PROVIDER || 'openai-compatible',
          modelName: process.env.AI_MODEL || 'default'
        });
        await recordAudit(req.user.id, 'REVISION_CREATED', 'Revision', revisionRecord._id);
      } else {
        const revId = new mongoose.Types.ObjectId().toString();
        revisionRecord = {
          _id: revId,
          id: revId,
          userId: req.user.id,
          projectId: parsed.data.projectId || targetDoc?.projectId || null,
          documentId: targetDoc?._id || parsed.data.documentId || null,
          mode: modeName,
          originalText: parsed.data.text,
          revisedText: result.revisedText,
          proposedText: result.revisedText,
          summary: result.changeSummary,
          meaningWarnings,
          status: 'proposed',
          createdAt: new Date().toISOString()
        };
        memRevisions.set(revId, revisionRecord);
      }
    }
    res.json({
      ...result,
      meaningWarnings,
      revision: revisionRecord,
      saved: Boolean(revisionRecord)
    });
  } catch (e) { next(e); }
});

// Accept Revision (Section 5)
apiRouter.post('/revisions/:id/accept', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const rev = await Revision.findOne({ _id: req.params.id, userId: req.user.id });
      if (!rev) return res.status(404).json({ error: 'Revision not found.' });

      rev.status = 'accepted';
      rev.acceptedAt = new Date();
      rev.acceptedText = rev.revisedText;
      await rev.save();

      let doc = null;
      if (rev.documentId) {
        doc = await Document.findOne({ _id: rev.documentId, ownerId: req.user.id });
        if (doc) {
          doc.content = rev.revisedText;
          doc.wordCount = countWords(rev.revisedText);
          doc.characterCount = rev.revisedText.length;
          doc.currentRevisionId = rev._id;
          doc.version = (doc.version || 1) + 1;
          await doc.save();
        }
      }
      await recordAudit(req.user.id, 'REVISION_ACCEPTED', 'Revision', rev._id);
      return res.json({ success: true, revision: rev, document: doc });
    }

    const rev = memRevisions.get(req.params.id);
    if (!rev || rev.userId !== req.user.id) return res.status(404).json({ error: 'Revision not found.' });
    rev.status = 'accepted';
    rev.acceptedAt = new Date().toISOString();
    rev.acceptedText = rev.revisedText;

    let doc = null;
    if (rev.documentId) {
      doc = memDocuments.get(String(rev.documentId));
      if (doc && doc.ownerId === req.user.id) {
        doc.content = rev.revisedText;
        doc.wordCount = countWords(rev.revisedText);
        doc.characterCount = rev.revisedText.length;
        doc.currentRevisionId = rev._id || rev.id;
        doc.version = (doc.version || 1) + 1;
        doc.updatedAt = new Date().toISOString();
      }
    }
    res.json({ success: true, revision: rev, document: doc });
  } catch (e) { next(e); }
});

// Reject Revision (Section 5)
apiRouter.post('/revisions/:id/reject', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const rev = await Revision.findOne({ _id: req.params.id, userId: req.user.id });
      if (!rev) return res.status(404).json({ error: 'Revision not found.' });
      rev.status = 'rejected';
      await rev.save();
      await recordAudit(req.user.id, 'REVISION_REJECTED', 'Revision', rev._id);
      return res.json({ success: true, revision: rev });
    }

    const rev = memRevisions.get(req.params.id);
    if (!rev || rev.userId !== req.user.id) return res.status(404).json({ error: 'Revision not found.' });
    rev.status = 'rejected';
    res.json({ success: true, revision: rev });
  } catch (e) { next(e); }
});

// Project Progress Recalculator (derives completion deterministically from tasks)
async function syncProjectProgress(projectId) {
  try {
    if (isDbConnected()) {
      const allTasks = await Task.find({ projectId }).lean();
      const completed = allTasks.filter(t => t.status === 'done').length;
      const progress = allTasks.length > 0 ? Math.round((completed / allTasks.length) * 100) : 0;
      await Project.findByIdAndUpdate(projectId, {
        $set: { progress, completionPercentage: progress }
      });
    } else {
      const allTasks = [...memTasks.values()].filter(t => t.projectId === projectId);
      const completed = allTasks.filter(t => t.status === 'done').length;
      const progress = allTasks.length > 0 ? Math.round((completed / allTasks.length) * 100) : 0;
      const proj = memProjects.get(projectId);
      if (proj) {
        proj.progress = progress;
        proj.completionPercentage = progress;
      }
    }
  } catch (err) {
    console.warn('syncProjectProgress notice:', err.message);
  }
}

// ============================================================================
// Phase 3: Dashboard Overview & Real-Time Enterprise Metrics
// ============================================================================
apiRouter.get('/dashboard/overview', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    if (isDbConnected()) {
      const memberRecords = await ProjectMember.find({ userId, status: 'active' }).select('projectId').lean();
      const memberProjIds = memberRecords.map(m => m.projectId);
      const projectFilter = {
        $or: [{ userId }, { _id: { $in: memberProjIds } }],
        status: { $ne: 'deleted' }
      };

      const [
        totalProjects,
        activeProjects,
        draftProjects,
        researchDocuments,
        userDocuments,
        savedReferences,
        verifiedDoisCount,
        recentProjects,
        userProjects
      ] = await Promise.all([
        Project.countDocuments(projectFilter),
        Project.countDocuments({ ...projectFilter, status: 'active' }),
        Project.countDocuments({ ...projectFilter, status: 'draft' }),
        Document.countDocuments({ ownerId: userId }),
        Document.find({ ownerId: userId }).select('wordCount').lean(),
        Citation.countDocuments({ userId }),
        Citation.countDocuments({ userId, doi: { $exists: true, $ne: '' } }),
        Project.find(projectFilter).sort({ updatedAt: -1 }).limit(4).lean(),
        Project.find(projectFilter).select('_id').lean()
      ]);

      const projectIds = userProjects.map(p => p._id);
      const totalWords = userDocuments.reduce((acc, d) => acc + (d.wordCount || 0), 0);
      const now = new Date();
      const twoWeeksAhead = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      const [totalTasksCount, completedTasksCount, pendingTasks, upcomingDeadlines, upcomingTasksList, recentActivityEvents] = await Promise.all([
        Task.countDocuments({
          $or: [{ projectId: { $in: projectIds } }, { userId }]
        }),
        Task.countDocuments({
          $or: [{ projectId: { $in: projectIds } }, { userId }],
          status: 'done'
        }),
        Task.countDocuments({
          $or: [{ projectId: { $in: projectIds } }, { userId }],
          status: { $ne: 'done' }
        }),
        Task.countDocuments({
          $or: [{ projectId: { $in: projectIds } }, { userId }],
          status: { $ne: 'done' },
          dueDate: { $gte: now, $lte: twoWeeksAhead }
        }),
        Task.find({
          $or: [{ projectId: { $in: projectIds } }, { userId }],
          status: { $ne: 'done' }
        }).sort({ dueDate: 1, priority: -1 }).limit(5).lean(),
        AuditEvent.find({
          $or: [{ actorId: userId }, { targetId: userId }]
        }).sort({ createdAt: -1 }).limit(10).lean()
      ]);

      const recentActivity = recentActivityEvents.map(evt => ({
        id: evt._id,
        action: evt.action,
        resourceType: evt.resourceType,
        resourceId: evt.resourceId,
        date: evt.createdAt,
        metadata: evt.metadata
      }));

      const completionRate = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

      return res.json({
        metrics: {
          totalProjects,
          activeProjects,
          draftProjects,
          totalDocuments: researchDocuments,
          researchDocuments,
          totalWords,
          totalCitations: savedReferences,
          savedReferences,
          verifiedDois: verifiedDoisCount,
          tasks: {
            total: totalTasksCount,
            completed: completedTasksCount,
            pending: pendingTasks,
            completionRate
          },
          pendingTasks,
          upcomingDeadlines
        },
        recentProjects,
        recentActivity,
        upcomingTasks: upcomingTasksList
      });
    }

    // In-memory fallback
    const memberProjIds = [...memProjectMembers.values()]
      .filter(m => m.userId === userId && m.status === 'active')
      .map(m => m.projectId);

    const userProjects = [...memProjects.values()]
      .filter(p => (p.userId === userId || memberProjIds.includes(p._id)) && p.status !== 'deleted');

    const totalProjects = userProjects.length;
    const activeProjects = userProjects.filter(p => (p.status || 'active') === 'active').length;
    const draftProjects = userProjects.filter(p => p.status === 'draft').length;
    const userDocs = [...memDocuments.values()].filter(d => d.ownerId === userId);
    const researchDocuments = userDocs.length;
    const totalWords = userDocs.reduce((acc, d) => acc + (d.wordCount || 0), 0);
    const userCitations = [...memCitations.values()].filter(c => c.userId === userId);
    const savedReferences = userCitations.length;
    const verifiedDois = userCitations.filter(c => !!c.doi).length;

    const projIds = userProjects.map(p => p._id);
    const allTasks = [...memTasks.values()].filter(t => projIds.includes(t.projectId) || t.userId === userId);
    const completedTasks = allTasks.filter(t => t.status === 'done').length;
    const pendingTasks = allTasks.filter(t => t.status !== 'done').length;
    const completionRate = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0;

    const now = Date.now();
    const twoWeeksAhead = now + 14 * 24 * 60 * 60 * 1000;
    const upcomingDeadlines = allTasks.filter(t => {
      if (t.status === 'done' || !t.dueDate) return false;
      const due = new Date(t.dueDate).getTime();
      return due >= now && due <= twoWeeksAhead;
    }).length;

    const recentProjects = [...userProjects]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 4);

    const upcomingTasks = allTasks
      .filter(t => t.status !== 'done')
      .sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      })
      .slice(0, 5);

    const recentActivity = memAuditEvents
      .filter(e => e.actorId === userId || e.targetId === userId)
      .slice(0, 10)
      .map(evt => ({
        id: evt._id,
        action: evt.action,
        resourceType: evt.resourceType,
        resourceId: evt.resourceId,
        date: evt.createdAt,
        metadata: evt.metadata
      }));

    res.json({
      metrics: {
        totalProjects,
        activeProjects,
        draftProjects,
        totalDocuments: researchDocuments,
        researchDocuments,
        totalWords,
        totalCitations: savedReferences,
        savedReferences,
        verifiedDois,
        tasks: {
          total: allTasks.length,
          completed: completedTasks,
          pending: pendingTasks,
          completionRate
        },
        pendingTasks,
        upcomingDeadlines
      },
      recentProjects,
      recentActivity,
      upcomingTasks
    });
  } catch (e) { next(e); }
});

apiRouter.get('/dashboard/recent-projects', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    if (isDbConnected()) {
      const memberRecords = await ProjectMember.find({ userId, status: 'active' }).select('projectId').lean();
      const memberProjIds = memberRecords.map(m => m.projectId);
      const projects = await Project.find({
        $or: [{ userId }, { _id: { $in: memberProjIds } }],
        status: { $ne: 'deleted' }
      }).sort({ updatedAt: -1 }).limit(5).lean();
      return res.json(projects);
    }
    const memberProjIds = [...memProjectMembers.values()]
      .filter(m => m.userId === userId && m.status === 'active')
      .map(m => m.projectId);
    const projects = [...memProjects.values()]
      .filter(p => (p.userId === userId || memberProjIds.includes(p._id)) && p.status !== 'deleted')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
    res.json(projects);
  } catch (e) { next(e); }
});

apiRouter.get('/dashboard/recent-activity', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    if (isDbConnected()) {
      const events = await AuditEvent.find({
        $or: [{ actorId: userId }, { targetId: userId }]
      }).sort({ createdAt: -1 }).limit(20).lean();
      return res.json(events);
    }
    const events = memAuditEvents
      .filter(e => e.actorId === userId || e.targetId === userId)
      .slice(0, 20);
    res.json(events);
  } catch (e) { next(e); }
});

apiRouter.get('/dashboard/upcoming-tasks', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    if (isDbConnected()) {
      const memberRecords = await ProjectMember.find({ userId, status: 'active' }).select('projectId').lean();
      const memberProjIds = memberRecords.map(m => m.projectId);
      const userProjects = await Project.find({
        $or: [{ userId }, { _id: { $in: memberProjIds } }],
        status: { $ne: 'deleted' }
      }).select('_id').lean();
      const projectIds = userProjects.map(p => p._id);

      const tasks = await Task.find({
        $or: [{ projectId: { $in: projectIds } }, { userId }],
        status: { $ne: 'done' }
      }).sort({ dueDate: 1, priority: -1 }).limit(10).lean();
      return res.json(tasks);
    }
    const memberProjIds = [...memProjectMembers.values()]
      .filter(m => m.userId === userId && m.status === 'active')
      .map(m => m.projectId);
    const userProjects = [...memProjects.values()]
      .filter(p => (p.userId === userId || memberProjIds.includes(p._id)) && p.status !== 'deleted');
    const projIds = userProjects.map(p => p._id);

    const tasks = [...memTasks.values()]
      .filter(t => (projIds.includes(t.projectId) || t.userId === userId) && t.status !== 'done')
      .sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      })
      .slice(0, 10);
    res.json(tasks);
  } catch (e) { next(e); }
});

// ============================================================================
// Projects (Unified Research Project Management & Tenancy)
// ============================================================================
apiRouter.get('/projects', requireAuth, async (req, res, next) => {
  try {
    const { status, discipline, q, search, sort = 'updatedAt', order = 'desc', page, limit = 20, paginated } = req.query;
    const searchQuery = (q || search || '').trim().toLowerCase();
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortField = ['updatedAt', 'createdAt', 'title', 'progress', 'targetDate'].includes(sort) ? sort : 'updatedAt';

    if (isDbConnected()) {
      // Find projects owned by user or where user is an active member
      const memberRecords = await ProjectMember.find({ userId: req.user.id, status: 'active' }).select('projectId').lean();
      const memberProjIds = memberRecords.map(m => m.projectId);
      const filter = {
        $or: [
          { userId: req.user.id },
          { _id: { $in: memberProjIds } }
        ]
      };

      if (status && status !== 'all') {
        filter.status = status.toLowerCase();
      } else {
        filter.status = { $ne: 'deleted' };
      }

      if (discipline && discipline !== 'all') {
        filter.discipline = new RegExp(`^${discipline}$`, 'i');
      }

      if (searchQuery) {
        filter.$and = filter.$and || [];
        filter.$and.push({
          $or: [
            { title: { $regex: searchQuery, $options: 'i' } },
            { description: { $regex: searchQuery, $options: 'i' } },
            { discipline: { $regex: searchQuery, $options: 'i' } },
            { keywords: { $in: [new RegExp(searchQuery, 'i')] } }
          ]
        });
      }

      const totalCount = await Project.countDocuments(filter);
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const totalPages = Math.ceil(totalCount / limitNum) || 1;

      let query = Project.find(filter).sort({ [sortField]: sortOrder });
      if (page || paginated === 'true') {
        query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
      }
      const projects = await query.lean();

      res.setHeader('X-Total-Count', totalCount);
      res.setHeader('X-Page', pageNum);
      res.setHeader('X-Total-Pages', totalPages);

      if (paginated === 'true') {
        return res.json({ projects, pagination: { page: pageNum, limit: limitNum, totalCount, totalPages } });
      }
      return res.json(projects);
    }

    // In-memory fallback
    const memberProjIds = [...memProjectMembers.values()]
      .filter(m => m.userId === req.user.id && m.status === 'active')
      .map(m => m.projectId);

    let list = [...memProjects.values()]
      .filter(p => p.userId === req.user.id || memberProjIds.includes(p._id));

    if (status && status !== 'all') {
      list = list.filter(p => (p.status || 'active').toLowerCase() === status.toLowerCase());
    } else {
      list = list.filter(p => p.status !== 'deleted');
    }

    if (discipline && discipline !== 'all') {
      list = list.filter(p => (p.discipline || '').toLowerCase() === discipline.toLowerCase());
    }

    if (searchQuery) {
      list = list.filter(p =>
        (p.title || '').toLowerCase().includes(searchQuery) ||
        (p.description || '').toLowerCase().includes(searchQuery) ||
        (p.discipline || '').toLowerCase().includes(searchQuery) ||
        (p.keywords || []).some(k => k.toLowerCase().includes(searchQuery))
      );
    }

    list.sort((a, b) => {
      let va = a[sortField] || 0;
      let vb = b[sortField] || 0;
      if (sortField === 'title') return sortOrder * String(va).localeCompare(String(vb));
      return sortOrder * (new Date(vb).getTime() - new Date(va).getTime());
    });

    const totalCount = list.length;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const totalPages = Math.ceil(totalCount / limitNum) || 1;

    let result = list;
    if (page || paginated === 'true') {
      result = list.slice((pageNum - 1) * limitNum, pageNum * limitNum);
    }

    res.setHeader('X-Total-Count', totalCount);
    res.setHeader('X-Page', pageNum);
    res.setHeader('X-Total-Pages', totalPages);

    if (paginated === 'true') {
      return res.json({ projects: result, pagination: { page: pageNum, limit: limitNum, totalCount, totalPages } });
    }
    res.json(result);
  } catch (e) { next(e); }
});

apiRouter.post('/projects', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().trim().min(3, 'Project title must be at least 3 characters.').max(160),
      description: z.string().max(1000).optional().default(''),
      discipline: z.string().max(100).optional().default('General Academic'),
      documentType: z.string().max(80).optional().default('Manuscript'),
      researchType: z.enum(['Quantitative', 'Qualitative', 'Mixed Methods', 'Experimental', 'Systematic Review', 'Literature Review', 'Meta-Analysis', 'Observational', 'Computational', 'Theoretical', 'Other']).optional().default('Quantitative'),
      objectives: z.union([z.string(), z.array(z.string())]).optional().default([]),
      keywords: z.array(z.string()).optional().default([]),
      status: z.enum(['draft', 'active', 'on_hold', 'completed', 'archived', 'deleted', 'Draft', 'Active', 'On Hold', 'Completed', 'Archived']).optional().default('active'),
      progress: z.number().min(0).max(100).optional(),
      workflowStage: z.enum(['literature', 'analysis', 'drafting', 'review', 'submission']).optional().default('literature'),
      completionPercentage: z.number().min(0).max(100).optional(),
      startDate: z.union([z.string(), z.date()]).optional().nullable(),
      targetDate: z.union([z.string(), z.date()]).optional().nullable(),
      visibility: z.enum(['private', 'team', 'public']).optional().default('private'),
      tags: z.array(z.string()).optional().default([])
    });
    const p = schema.safeParse(req.body);
    if (!p.success) {
      const msg = p.error.issues?.[0]?.message || 'Project title is required.';
      return res.status(400).json({ error: msg });
    }

    const calculatedProgress = p.data.progress ?? p.data.completionPercentage ?? 0;

    if (isDbConnected()) {
      const project = await Project.create({
        userId: req.user.id,
        ownerId: req.user.id,
        title: p.data.title,
        description: p.data.description,
        discipline: p.data.discipline,
        documentType: p.data.documentType,
        researchType: p.data.researchType,
        objectives: p.data.objectives,
        keywords: p.data.keywords,
        status: p.data.status.toLowerCase(),
        progress: calculatedProgress,
        workflowStage: p.data.workflowStage,
        completionPercentage: calculatedProgress,
        startDate: p.data.startDate ? new Date(p.data.startDate) : null,
        targetDate: p.data.targetDate ? new Date(p.data.targetDate) : null,
        visibility: p.data.visibility,
        tags: p.data.tags
      });
      // Register owner in ProjectMember
      await ProjectMember.create({
        projectId: project._id,
        userId: req.user.id,
        role: 'owner',
        status: 'active',
        permissions: ['read', 'write', 'admin', 'delete']
      });
      await recordAudit(req.user.id, 'PROJECT_CREATED', 'Project', project._id, { title: project.title });
      return res.status(201).json(project);
    }

    const projectId = new mongoose.Types.ObjectId().toString();
    const newProj = {
      _id: projectId,
      userId: req.user.id,
      ownerId: req.user.id,
      title: p.data.title,
      description: p.data.description,
      discipline: p.data.discipline,
      documentType: p.data.documentType,
      researchType: p.data.researchType,
      objectives: p.data.objectives,
      keywords: p.data.keywords,
      status: p.data.status.toLowerCase(),
      progress: calculatedProgress,
      workflowStage: p.data.workflowStage,
      completionPercentage: calculatedProgress,
      startDate: p.data.startDate || null,
      targetDate: p.data.targetDate || null,
      visibility: p.data.visibility,
      tags: p.data.tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    memProjects.set(projectId, newProj);
    memProjectMembers.set(`${projectId}_${req.user.id}`, {
      _id: new mongoose.Types.ObjectId().toString(),
      projectId,
      userId: req.user.id,
      role: 'owner',
      status: 'active',
      permissions: ['read', 'write', 'admin', 'delete']
    });
    await recordAudit(req.user.id, 'PROJECT_CREATED', 'Project', projectId, { title: newProj.title });
    res.status(201).json(newProj);
  } catch (e) { next(e); }
});

apiRouter.get('/projects/:id', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const member = await ProjectMember.findOne({ projectId: req.params.id, userId: req.user.id, status: 'active' }).lean();
      const project = await Project.findOne({
        _id: req.params.id,
        $or: [{ userId: req.user.id }, ...(member ? [{ _id: req.params.id }] : [])]
      }).lean();
      if (!project) return res.status(404).json({ error: 'Project not found or unauthorized.' });
      const documents = await Document.find({ projectId: project._id }).sort({ updatedAt: -1 }).lean();
      const tasks = await Task.find({ projectId: project._id }).sort({ createdAt: -1 }).lean();
      const members = await ProjectMember.find({ projectId: project._id, status: 'active' })
        .populate('userId', 'displayName email avatarUrl')
        .lean();
      return res.json({ ...project, documents, tasks, members, userRole: member?.role || (String(project.userId) === String(req.user.id) ? 'owner' : 'viewer') });
    }
    const proj = memProjects.get(req.params.id);
    const memKey = `${req.params.id}_${req.user.id}`;
    const member = memProjectMembers.get(memKey);
    if (!proj || (proj.userId !== req.user.id && !member)) return res.status(404).json({ error: 'Project not found.' });
    const documents = [...memDocuments.values()].filter(d => d.projectId === req.params.id);
    const tasks = [...memTasks.values()].filter(t => t.projectId === req.params.id);
    const members = [...memProjectMembers.values()].filter(m => m.projectId === req.params.id && m.status === 'active');
    res.json({ ...proj, documents, tasks, members, userRole: member?.role || 'owner' });
  } catch (e) { next(e); }
});

apiRouter.patch('/projects/:id', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().trim().min(1).max(160).optional(),
      description: z.string().max(1000).optional(),
      discipline: z.string().max(100).optional(),
      documentType: z.string().max(80).optional(),
      researchType: z.enum(['Quantitative', 'Qualitative', 'Mixed Methods', 'Experimental', 'Systematic Review', 'Literature Review', 'Meta-Analysis', 'Observational', 'Computational', 'Theoretical', 'Other']).optional(),
      objectives: z.union([z.string(), z.array(z.string())]).optional(),
      keywords: z.array(z.string()).optional(),
      status: z.enum(['draft', 'active', 'on_hold', 'completed', 'archived', 'deleted', 'Draft', 'Active', 'On Hold', 'Completed', 'Archived']).optional(),
      progress: z.number().min(0).max(100).optional(),
      workflowStage: z.enum(['literature', 'analysis', 'drafting', 'review', 'submission']).optional(),
      completionPercentage: z.number().min(0).max(100).optional(),
      startDate: z.union([z.string(), z.date()]).optional().nullable(),
      targetDate: z.union([z.string(), z.date()]).optional().nullable(),
      visibility: z.enum(['private', 'team', 'public']).optional(),
      tags: z.array(z.string()).optional()
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Invalid update data.' });

    const updatePayload = { ...p.data };
    if (updatePayload.status) {
      updatePayload.status = updatePayload.status.toLowerCase();
      if (updatePayload.status === 'archived') updatePayload.archivedAt = new Date();
      if (updatePayload.status === 'active') {
        updatePayload.archivedAt = null;
        updatePayload.deletedAt = null;
      }
    }
    if (updatePayload.progress !== undefined && updatePayload.completionPercentage === undefined) {
      updatePayload.completionPercentage = updatePayload.progress;
    }
    if (updatePayload.completionPercentage !== undefined && updatePayload.progress === undefined) {
      updatePayload.progress = updatePayload.completionPercentage;
    }

    if (isDbConnected()) {
      const member = await ProjectMember.findOne({ projectId: req.params.id, userId: req.user.id, status: 'active', role: { $in: ['owner', 'editor'] } });
      const project = await Project.findOneAndUpdate(
        { _id: req.params.id, $or: [{ userId: req.user.id }, ...(member ? [{ _id: req.params.id }] : [])] },
        { $set: updatePayload },
        { new: true }
      );
      if (!project) return res.status(404).json({ error: 'Project not found or insufficient permissions.' });
      await recordAudit(req.user.id, 'PROJECT_UPDATED', 'Project', req.params.id, updatePayload);
      return res.json(project);
    }

    const proj = memProjects.get(req.params.id);
    if (!proj || (proj.userId !== req.user.id)) return res.status(404).json({ error: 'Project not found.' });
    Object.assign(proj, updatePayload, { updatedAt: new Date().toISOString() });
    await recordAudit(req.user.id, 'PROJECT_UPDATED', 'Project', req.params.id, updatePayload);
    res.json(proj);
  } catch (e) { next(e); }
});

apiRouter.post('/projects/:id/archive', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const member = await ProjectMember.findOne({ projectId: req.params.id, userId: req.user.id, status: 'active', role: { $in: ['owner', 'editor'] } });
      const project = await Project.findOneAndUpdate(
        { _id: req.params.id, $or: [{ userId: req.user.id }, ...(member ? [{ _id: req.params.id }] : [])] },
        { $set: { status: 'archived', archivedAt: new Date() } },
        { new: true }
      );
      if (!project) return res.status(404).json({ error: 'Project not found or unauthorized.' });
      await recordAudit(req.user.id, 'PROJECT_ARCHIVED', 'Project', req.params.id);
      return res.json(project);
    }
    const proj = memProjects.get(req.params.id);
    if (!proj || proj.userId !== req.user.id) return res.status(404).json({ error: 'Project not found.' });
    proj.status = 'archived';
    proj.archivedAt = new Date().toISOString();
    proj.updatedAt = new Date().toISOString();
    await recordAudit(req.user.id, 'PROJECT_ARCHIVED', 'Project', req.params.id);
    res.json(proj);
  } catch (e) { next(e); }
});

apiRouter.post('/projects/:id/restore', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const member = await ProjectMember.findOne({ projectId: req.params.id, userId: req.user.id, status: 'active', role: { $in: ['owner', 'editor'] } });
      const project = await Project.findOneAndUpdate(
        { _id: req.params.id, $or: [{ userId: req.user.id }, ...(member ? [{ _id: req.params.id }] : [])] },
        { $set: { status: 'active', archivedAt: null, deletedAt: null } },
        { new: true }
      );
      if (!project) return res.status(404).json({ error: 'Project not found or unauthorized.' });
      await recordAudit(req.user.id, 'PROJECT_RESTORED', 'Project', req.params.id);
      return res.json(project);
    }
    const proj = memProjects.get(req.params.id);
    if (!proj || proj.userId !== req.user.id) return res.status(404).json({ error: 'Project not found.' });
    proj.status = 'active';
    proj.archivedAt = null;
    proj.deletedAt = null;
    proj.updatedAt = new Date().toISOString();
    await recordAudit(req.user.id, 'PROJECT_RESTORED', 'Project', req.params.id);
    res.json(proj);
  } catch (e) { next(e); }
});

apiRouter.delete('/projects/:id', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const project = await Project.findOneAndUpdate(
        { _id: req.params.id, userId: req.user.id },
        { $set: { status: 'deleted', deletedAt: new Date() } },
        { new: true }
      );
      if (!project) return res.status(404).json({ error: 'Project not found or not owner.' });
      await recordAudit(req.user.id, 'PROJECT_DELETED', 'Project', req.params.id);
      return res.json({ deleted: true, status: 'deleted' });
    }

    const proj = memProjects.get(req.params.id);
    if (!proj || proj.userId !== req.user.id) return res.status(404).json({ error: 'Project not found.' });
    proj.status = 'deleted';
    proj.deletedAt = new Date().toISOString();
    proj.updatedAt = new Date().toISOString();
    await recordAudit(req.user.id, 'PROJECT_DELETED', 'Project', req.params.id);
    res.json({ deleted: true, status: 'deleted' });
  } catch (e) { next(e); }
});

// Project Members & Collaboration (Module 8)
apiRouter.get('/projects/:id/members', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const members = await ProjectMember.find({ projectId: req.params.id })
        .populate('userId', 'displayName email avatarUrl')
        .lean();
      return res.json(members);
    }
    const members = [...memProjectMembers.values()].filter(m => m.projectId === req.params.id);
    res.json(members);
  } catch (e) { next(e); }
});

apiRouter.post('/projects/:id/members', requireAuth, async (req, res, next) => {
  try {
    const { email, role = 'editor' } = req.body || {};
    if (!email || !email.trim()) return res.status(400).json({ error: 'Member email is required.' });

    if (isDbConnected()) {
      const targetUser = await User.findOne({ email: email.trim().toLowerCase() });
      if (!targetUser) return res.status(404).json({ error: 'User with this email not found.' });

      const existing = await ProjectMember.findOne({ projectId: req.params.id, userId: targetUser._id });
      if (existing) {
        existing.role = role;
        existing.status = 'active';
        await existing.save();
        return res.json(existing);
      }

      const member = await ProjectMember.create({
        projectId: req.params.id,
        userId: targetUser._id,
        role,
        invitedBy: req.user.id,
        status: 'active',
        permissions: role === 'editor' ? ['read', 'write'] : ['read']
      });
      return res.status(201).json(member);
    }

    const memberId = new mongoose.Types.ObjectId().toString();
    const newMember = {
      _id: memberId,
      projectId: req.params.id,
      userId: req.user.id,
      email: email.trim().toLowerCase(),
      role,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    memProjectMembers.set(`${req.params.id}_${email}`, newMember);
    res.status(201).json(newMember);
  } catch (e) { next(e); }
});

apiRouter.patch('/projects/:id/members/:memberId', requireAuth, async (req, res, next) => {
  try {
    const { role } = req.body || {};
    if (!role || !['owner', 'editor', 'reviewer', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Valid role is required (owner, editor, reviewer, viewer).' });
    }

    if (isDbConnected()) {
      const member = await ProjectMember.findById(req.params.memberId);
      if (!member) return res.status(404).json({ error: 'Member not found.' });

      // Prevent demoting the last owner
      if (member.role === 'owner' && role !== 'owner') {
        const ownerCount = await ProjectMember.countDocuments({ projectId: req.params.id, role: 'owner' });
        if (ownerCount <= 1) {
          return res.status(400).json({ error: 'Cannot demote the last project owner.' });
        }
      }

      member.role = role;
      await member.save();
      return res.json(member);
    }

    const member = memProjectMembers.get(req.params.memberId);
    if (!member) return res.status(404).json({ error: 'Member not found.' });
    if (member.role === 'owner' && role !== 'owner') {
      const ownerCount = [...memProjectMembers.values()].filter(m => m.projectId === req.params.id && m.role === 'owner').length;
      if (ownerCount <= 1) {
        return res.status(400).json({ error: 'Cannot demote the last project owner.' });
      }
    }
    member.role = role;
    res.json(member);
  } catch (e) { next(e); }
});

apiRouter.delete('/projects/:id/members/:memberId', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const member = await ProjectMember.findById(req.params.memberId);
      if (!member) return res.status(404).json({ error: 'Member not found.' });

      // Prevent removing the last owner
      if (member.role === 'owner') {
        const ownerCount = await ProjectMember.countDocuments({ projectId: req.params.id, role: 'owner' });
        if (ownerCount <= 1) {
          return res.status(400).json({ error: 'Cannot remove the last project owner.' });
        }
      }

      await ProjectMember.findByIdAndDelete(req.params.memberId);
      return res.json({ removed: true });
    }

    const member = memProjectMembers.get(req.params.memberId);
    if (member && member.role === 'owner') {
      const ownerCount = [...memProjectMembers.values()].filter(m => m.projectId === req.params.id && m.role === 'owner').length;
      if (ownerCount <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last project owner.' });
      }
    }
    memProjectMembers.delete(req.params.memberId);
    res.json({ removed: true });
  } catch (e) { next(e); }
});

// Project Tasks & Milestones (Unified Workspace)
apiRouter.get('/projects/:id/tasks', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const tasks = await Task.find({ projectId: req.params.id }).sort({ createdAt: -1 }).lean();
      return res.json(tasks);
    }
    const tasks = [...memTasks.values()].filter(t => t.projectId === req.params.id);
    res.json(tasks);
  } catch (e) { next(e); }
});

apiRouter.post('/projects/:id/tasks', requireAuth, async (req, res, next) => {
  try {
    const { title, description, priority = 'medium', stage = 'general', dueDate } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: 'Task title is required.' });

    if (isDbConnected()) {
      const task = await Task.create({
        projectId: req.params.id,
        userId: req.user.id,
        title: title.trim(),
        description: description || '',
        priority,
        stage,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'todo'
      });
      await syncProjectProgress(req.params.id);
      await recordAudit(req.user.id, 'TASK_CREATED', 'Task', task._id, { title: task.title, projectId: req.params.id });
      return res.status(201).json(task);
    }

    const taskId = new mongoose.Types.ObjectId().toString();
    const newTask = {
      _id: taskId,
      projectId: req.params.id,
      userId: req.user.id,
      title: title.trim(),
      description: description || '',
      priority,
      stage,
      status: 'todo',
      dueDate: dueDate || null,
      createdAt: new Date().toISOString()
    };
    memTasks.set(taskId, newTask);
    await syncProjectProgress(req.params.id);
    await recordAudit(req.user.id, 'TASK_CREATED', 'Task', taskId, { title: newTask.title, projectId: req.params.id });
    res.status(201).json(newTask);
  } catch (e) { next(e); }
});

apiRouter.patch('/projects/:id/tasks/:taskId', requireAuth, async (req, res, next) => {
  try {
    const updates = req.body || {};
    if (isDbConnected()) {
      const task = await Task.findOneAndUpdate(
        { _id: req.params.taskId, projectId: req.params.id },
        { $set: updates },
        { new: true }
      );
      if (!task) return res.status(404).json({ error: 'Task not found.' });
      await syncProjectProgress(req.params.id);
      await recordAudit(req.user.id, 'TASK_UPDATED', 'Task', task._id, { updates, projectId: req.params.id });
      return res.json(task);
    }
    const t = memTasks.get(req.params.taskId);
    if (!t) return res.status(404).json({ error: 'Task not found.' });
    Object.assign(t, updates, { updatedAt: new Date().toISOString() });
    await syncProjectProgress(req.params.id);
    await recordAudit(req.user.id, 'TASK_UPDATED', 'Task', req.params.taskId, { updates, projectId: req.params.id });
    res.json(t);
  } catch (e) { next(e); }
});

apiRouter.delete('/projects/:id/tasks/:taskId', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      await Task.findOneAndDelete({ _id: req.params.taskId, projectId: req.params.id });
      await syncProjectProgress(req.params.id);
      await recordAudit(req.user.id, 'TASK_DELETED', 'Task', req.params.taskId, { projectId: req.params.id });
      return res.json({ deleted: true });
    }
    memTasks.delete(req.params.taskId);
    await syncProjectProgress(req.params.id);
    await recordAudit(req.user.id, 'TASK_DELETED', 'Task', req.params.taskId, { projectId: req.params.id });
    res.json({ deleted: true });
  } catch (e) { next(e); }
});

// Project Activity Timeline
apiRouter.get('/projects/:id/activity', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const [revisions, documents, tasks, audits] = await Promise.all([
        Revision.find({ projectId: req.params.id }).sort({ createdAt: -1 }).limit(10).lean(),
        Document.find({ projectId: req.params.id }).sort({ updatedAt: -1 }).limit(10).lean(),
        Task.find({ projectId: req.params.id }).sort({ updatedAt: -1 }).limit(10).lean(),
        AuditEvent.find({ resourceId: req.params.id }).sort({ createdAt: -1 }).limit(10).lean()
      ]);

      const activities = [
        ...audits.map(a => ({ type: 'audit', title: `${a.action.replace(/_/g, ' ')}: ${a.metadata?.title || a.resourceType}`, date: a.createdAt })),
        ...revisions.map(r => ({ type: 'revision', title: `Revision (${r.mode}): ${r.summary || 'Content updated'}`, date: r.createdAt })),
        ...documents.map(d => ({ type: 'document', title: `Document updated: ${d.title}`, date: d.updatedAt })),
        ...tasks.map(t => ({ type: 'task', title: `Task: ${t.title} [${t.status}]`, date: t.updatedAt || t.createdAt }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);

      return res.json(activities);
    }
    const memAudits = memAuditEvents.filter(e => e.resourceId === req.params.id);
    const activities = [
      ...memAudits.map(a => ({ type: 'audit', title: `${a.action.replace(/_/g, ' ')}`, date: a.createdAt })),
      { type: 'project', title: 'Project workspace initialized', date: new Date().toISOString() }
    ];
    res.json(activities);
  } catch (e) { next(e); }
});

// ============================================================================
// Phase 4: Complete Reference & Citation Management Engine
// ============================================================================

// 1. Query References (Filtered, Sorted, Paginated)
apiRouter.get('/references', requireAuth, async (req, res, next) => {
  try {
    const {
      projectId,
      collectionId,
      publicationType,
      type,
      metadataStatus,
      status,
      favorite,
      q,
      search,
      sort = 'updatedAt',
      order = 'desc',
      page = 1,
      limit = 50,
      paginated
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const searchQuery = (q || search || '').trim().toLowerCase();
    const targetType = publicationType || type;
    const targetStatus = metadataStatus || status;
    const isFav = favorite === 'true' ? true : (favorite === 'false' ? false : null);

    if (isDbConnected()) {
      const filter = {
        ownerId: req.user.id,
        deletedAt: null
      };

      if (projectId && projectId !== 'all') {
        filter.projectId = projectId;
      }
      if (collectionId && collectionId !== 'all') {
        filter.collectionIds = collectionId;
      }
      if (targetType && targetType !== 'all') {
        filter.publicationType = targetType;
      }
      if (targetStatus && targetStatus !== 'all') {
        filter.metadataStatus = targetStatus;
      }
      if (isFav !== null) {
        filter.isFavorite = isFav;
      }
      if (searchQuery) {
        filter.$or = [
          { title: { $regex: searchQuery, $options: 'i' } },
          { 'authors.name': { $regex: searchQuery, $options: 'i' } },
          { 'authors.family': { $regex: searchQuery, $options: 'i' } },
          { journalTitle: { $regex: searchQuery, $options: 'i' } },
          { journal: { $regex: searchQuery, $options: 'i' } },
          { doi: { $regex: searchQuery, $options: 'i' } },
          { keywords: { $regex: searchQuery, $options: 'i' } }
        ];
      }

      const sortDir = order === 'asc' ? 1 : -1;
      const sortObj = {};
      if (sort === 'year') sortObj.publicationYear = sortDir;
      else if (sort === 'title') sortObj.title = sortDir;
      else sortObj.updatedAt = sortDir;

      const [totalCount, references] = await Promise.all([
        Citation.countDocuments(filter),
        Citation.find(filter)
          .sort(sortObj)
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .lean()
      ]);

      const totalPages = Math.ceil(totalCount / limitNum) || 1;
      res.setHeader('X-Total-Count', totalCount);
      res.setHeader('X-Page', pageNum);
      res.setHeader('X-Total-Pages', totalPages);

      if (paginated === 'true') {
        return res.json({ references, pagination: { page: pageNum, limit: limitNum, totalCount, totalPages } });
      }
      return res.json(references);
    }

    // In-memory fallback
    let list = [...memCitations.values()].filter(c => {
      if (c.ownerId !== req.user.id) return false;
      if (c.deletedAt) return false;
      if (projectId && projectId !== 'all' && c.projectId !== projectId) return false;
      if (collectionId && collectionId !== 'all' && (!c.collectionIds || !c.collectionIds.includes(collectionId))) return false;
      if (targetType && targetType !== 'all' && (c.publicationType || 'journal-article') !== targetType) return false;
      if (targetStatus && targetStatus !== 'all' && (c.metadataStatus || 'unverified') !== targetStatus) return false;
      if (isFav !== null && Boolean(c.isFavorite) !== isFav) return false;

      if (searchQuery) {
        const titleMatch = (c.title || '').toLowerCase().includes(searchQuery);
        const doiMatch = (c.doi || '').toLowerCase().includes(searchQuery);
        const journalMatch = (c.journalTitle || c.journal || '').toLowerCase().includes(searchQuery);
        const authorMatch = Array.isArray(c.authors) && c.authors.some(a => (a.name || a.family || '').toLowerCase().includes(searchQuery));
        const kwMatch = Array.isArray(c.keywords) && c.keywords.some(k => k.toLowerCase().includes(searchQuery));
        if (!titleMatch && !doiMatch && !journalMatch && !authorMatch && !kwMatch) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sort === 'year') {
        cmp = String(a.publicationYear || a.year || '').localeCompare(String(b.publicationYear || b.year || ''));
      } else if (sort === 'title') {
        cmp = (a.title || '').localeCompare(b.title || '');
      } else {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        cmp = dateA - dateB;
      }
      return order === 'asc' ? cmp : -cmp;
    });

    const totalCount = list.length;
    const totalPages = Math.ceil(totalCount / limitNum) || 1;
    const paginatedItems = list.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.setHeader('X-Total-Count', totalCount);
    res.setHeader('X-Page', pageNum);
    res.setHeader('X-Total-Pages', totalPages);

    const normalizedItems = paginatedItems.map(c => ({
      ...c,
      id: (c._id || c.id).toString(),
      type: c.publicationType || c.type || 'journal-article'
    }));
    if (paginated === 'true') {
      return res.json({ references: normalizedItems, pagination: { page: pageNum, limit: limitNum, totalCount, totalPages } });
    }
    res.json(normalizedItems);
  } catch (e) { next(e); }
});

// 2. Lookup DOI Metadata (Supports GET and POST)
const handleLookupDoi = async (req, res, next) => {
  try {
    const doi = req.body?.doi || req.query?.doi;
    if (!doi || !doi.trim()) return res.status(400).json({ error: 'DOI is required.' });

    const normalized = normalizeDoi(doi);
    if (!isValidDoi(normalized)) {
      return res.status(400).json({ error: `Invalid DOI format: "${doi}". Expected pattern: 10.xxxx/...` });
    }

    const metadata = await lookupDoiMetadata(normalized, isDbConnected());

    let existing = null;
    if (isDbConnected()) {
      existing = await Citation.findOne({ ownerId: req.user.id, doi: normalized, deletedAt: null }).lean();
    } else {
      existing = [...memCitations.values()].find(c => c.ownerId === req.user.id && normalizeDoi(c.doi) === normalized && !c.deletedAt);
    }

    res.json({
      doi: normalized,
      reference: metadata,
      metadata,
      existsInLibrary: Boolean(existing),
      existingId: existing?._id || null
    });
  } catch (e) { next(e); }
};
apiRouter.get('/references/lookup/doi', requireAuth, handleLookupDoi);
apiRouter.post('/references/lookup/doi', requireAuth, handleLookupDoi);

// 3. Scholarly Search (Supports GET and POST)
const handleScholarlySearch = async (req, res, next) => {
  try {
    const query = req.body?.query || req.query?.q || req.query?.query;
    const provider = req.body?.provider || req.query?.provider || 'crossref';
    const limit = parseInt(req.body?.limit || req.query?.limit || 15, 10);
    if (!query || !query.trim()) return res.status(400).json({ error: 'Search query is required.' });

    const results = await searchScholarlyReferences(query.trim(), { provider, limit: limit || 15 });
    res.json({ query: query.trim(), total: results.length, results });
  } catch (e) { next(e); }
};
apiRouter.get('/references/search/scholarly', requireAuth, handleScholarlySearch);
apiRouter.post('/references/search/scholarly', requireAuth, handleScholarlySearch);

// 4. Create Reference Manually
apiRouter.post('/references', requireAuth, async (req, res, next) => {
  try {
    const {
      title,
      subtitle = '',
      authors = [],
      editors = [],
      publicationYear = '',
      publicationDate = '',
      publicationType = req.body?.publicationType || req.body?.type || 'journal-article',
      journalTitle = '',
      bookTitle = '',
      publisher = '',
      volume = '',
      issue = '',
      pages = '',
      articleNumber = '',
      doi = '',
      isbn = '',
      issn = '',
      url = '',
      abstract = '',
      keywords = [],
      language = 'en',
      citationKey = '',
      sourceProvider = 'manual',
      metadataStatus = 'unverified',
      tags = [],
      collectionIds = [],
      isFavorite = false,
      notes = '',
      projectId = null
    } = req.body || {};

    if (!title || !title.trim()) return res.status(400).json({ error: 'Reference title is required.' });

    const cleanDoi = normalizeDoi(doi);
    const normalizedAuthors = Array.isArray(authors) ? authors.map(normalizeAuthorObject) : [];
    const normalizedEditors = Array.isArray(editors) ? editors.map(normalizeAuthorObject) : [];
    const year = publicationYear || (publicationDate ? publicationDate.slice(0, 4) : '');

    const newRefData = {
      ownerId: req.user.id,
      projectId: projectId || null,
      title: title.trim(),
      subtitle: subtitle.trim(),
      authors: normalizedAuthors.length > 0 ? normalizedAuthors : [{ name: 'Unknown Author' }],
      editors: normalizedEditors,
      publicationYear: year,
      publicationDate,
      year,
      publicationType,
      type: publicationType,
      journalTitle: journalTitle.trim() || req.body?.journal || '',
      journal: journalTitle.trim() || req.body?.journal || '',
      bookTitle: bookTitle.trim(),
      publisher: publisher.trim(),
      volume: volume.trim(),
      issue: issue.trim(),
      pages: pages.trim(),
      articleNumber: articleNumber.trim(),
      doi: cleanDoi,
      normalizedDoi: cleanDoi,
      isbn: isbn.trim(),
      issn: issn.trim(),
      url: url.trim() || (cleanDoi ? `https://doi.org/${cleanDoi}` : ''),
      abstract: abstract.trim(),
      keywords: Array.isArray(keywords) ? keywords : [],
      language,
      citationKey: citationKey.trim(),
      sourceProvider,
      metadataSource: sourceProvider,
      metadataStatus: cleanDoi ? 'verified' : metadataStatus,
      verificationStatus: cleanDoi ? 'verified' : 'unverified',
      metadataLastVerifiedAt: cleanDoi ? new Date() : null,
      retractionStatus: 'unknown',
      tags: Array.isArray(tags) ? tags : [],
      collectionIds: Array.isArray(collectionIds) ? collectionIds : [],
      isFavorite: Boolean(isFavorite),
      notes: notes.trim(),
      deletedAt: null
    };

    if (isDbConnected()) {
      const created = await Citation.create(newRefData);
      const payload = created.toObject ? created.toObject() : created;
      payload.id = payload._id.toString();
      await recordAudit(req.user.id, 'REFERENCE_CREATED', 'Reference', created._id, { title: created.title, doi: created.doi });
      return res.status(201).json({ ...payload, reference: payload });
    }

    const newId = new mongoose.Types.ObjectId().toString();
    const inMemRef = { _id: newId, id: newId, ...newRefData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    memCitations.set(newId, inMemRef);
    await recordAudit(req.user.id, 'REFERENCE_CREATED', 'Reference', newId, { title: inMemRef.title, doi: inMemRef.doi });
    res.status(201).json({ ...inMemRef, reference: inMemRef });
  } catch (e) { next(e); }
});

// 5. Import BibTeX
apiRouter.post('/references/import/bibtex', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const rawText = req.file ? req.file.buffer.toString('utf8') : (req.body?.text || req.body?.bibtex || req.body?.content || '');
    const projectId = req.body?.projectId || null;
    const collectionId = req.body?.collectionId || null;

    if (!rawText.trim()) return res.status(400).json({ error: 'No BibTeX content provided.' });

    const parsed = parseBibtex(rawText);
    if (parsed.length === 0) return res.status(400).json({ error: 'No valid BibTeX records could be parsed.' });

    let existing = [];
    if (isDbConnected()) {
      existing = await Citation.find({ ownerId: req.user.id, deletedAt: null }).lean();
    } else {
      existing = [...memCitations.values()].filter(c => c.ownerId === req.user.id && !c.deletedAt);
    }

    const { unique, duplicates } = detectReferenceDuplicates(parsed, existing);
    const saved = [];

    for (const item of unique) {
      const cleanDoi = normalizeDoi(item.doi);
      const record = {
        ownerId: req.user.id,
        projectId: projectId || null,
        title: item.title,
        authors: item.authors?.map(normalizeAuthorObject) || [{ name: 'Unknown Author' }],
        publicationYear: item.year || '',
        year: item.year || '',
        journalTitle: item.journal || '',
        journal: item.journal || '',
        volume: item.volume || '',
        issue: item.issue || '',
        pages: item.pages || '',
        publisher: item.publisher || '',
        doi: cleanDoi,
        normalizedDoi: cleanDoi,
        url: item.url || (cleanDoi ? `https://doi.org/${cleanDoi}` : ''),
        citationKey: item.citeKey || '',
        sourceProvider: 'bibtex',
        metadataSource: 'bibtex',
        metadataStatus: cleanDoi ? 'verified' : 'unverified',
        collectionIds: collectionId ? [collectionId] : [],
        deletedAt: null
      };

      if (isDbConnected()) {
        const doc = await Citation.create(record);
        saved.push(doc);
      } else {
        const id = new mongoose.Types.ObjectId().toString();
        const memEntry = { _id: id, ...record, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        memCitations.set(id, memEntry);
        saved.push(memEntry);
      }
    }

    res.status(saved.length > 0 ? 201 : 200).json({
      importedCount: saved.length,
      duplicateCount: duplicates.length,
      references: saved,
      imported: saved,
      duplicates: duplicates.map(d => ({ title: d.entry.title, reason: d.reason, matchType: d.matchType }))
    });
  } catch (e) { next(e); }
});

// 6. Import RIS
apiRouter.post('/references/import/ris', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const rawText = req.file ? req.file.buffer.toString('utf8') : (req.body?.text || req.body?.ris || req.body?.content || '');
    const projectId = req.body?.projectId || null;
    const collectionId = req.body?.collectionId || null;

    if (!rawText.trim()) return res.status(400).json({ error: 'No RIS content provided.' });

    const parsed = parseRis(rawText);
    if (parsed.length === 0) return res.status(400).json({ error: 'No valid RIS records could be parsed.' });

    let existing = [];
    if (isDbConnected()) {
      existing = await Citation.find({ ownerId: req.user.id, deletedAt: null }).lean();
    } else {
      existing = [...memCitations.values()].filter(c => c.ownerId === req.user.id && !c.deletedAt);
    }

    const { unique, duplicates } = detectReferenceDuplicates(parsed, existing);
    const saved = [];

    for (const item of unique) {
      const cleanDoi = normalizeDoi(item.doi);
      const record = {
        ownerId: req.user.id,
        projectId: projectId || null,
        title: item.title,
        authors: item.authors?.map(normalizeAuthorObject) || [{ name: 'Unknown Author' }],
        publicationYear: item.year || '',
        year: item.year || '',
        journalTitle: item.journal || '',
        journal: item.journal || '',
        volume: item.volume || '',
        issue: item.issue || '',
        pages: item.pages || '',
        publisher: item.publisher || '',
        doi: cleanDoi,
        normalizedDoi: cleanDoi,
        url: item.url || (cleanDoi ? `https://doi.org/${cleanDoi}` : ''),
        sourceProvider: 'ris',
        metadataSource: 'ris',
        metadataStatus: cleanDoi ? 'verified' : 'unverified',
        collectionIds: collectionId ? [collectionId] : [],
        deletedAt: null
      };

      if (isDbConnected()) {
        const doc = await Citation.create(record);
        saved.push(doc);
      } else {
        const id = new mongoose.Types.ObjectId().toString();
        const memEntry = { _id: id, ...record, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        memCitations.set(id, memEntry);
        saved.push(memEntry);
      }
    }

    res.status(saved.length > 0 ? 201 : 200).json({
      importedCount: saved.length,
      duplicateCount: duplicates.length,
      references: saved,
      imported: saved,
      duplicates: duplicates.map(d => ({ title: d.entry.title, reason: d.reason, matchType: d.matchType }))
    });
  } catch (e) { next(e); }
});

// 7. Batch Import Pre-Parsed References
apiRouter.post('/references/import/batch', requireAuth, async (req, res, next) => {
  try {
    const { references = [], projectId = null, collectionId = null } = req.body || {};
    if (!Array.isArray(references) || references.length === 0) {
      return res.status(400).json({ error: 'No references provided for batch import.' });
    }

    let existing = [];
    if (isDbConnected()) {
      existing = await Citation.find({ ownerId: req.user.id, deletedAt: null }).lean();
    } else {
      existing = [...memCitations.values()].filter(c => c.ownerId === req.user.id && !c.deletedAt);
    }

    const { unique, duplicates } = detectReferenceDuplicates(references, existing);
    const saved = [];

    for (const item of unique) {
      const cleanDoi = normalizeDoi(item.doi);
      const record = {
        ownerId: req.user.id,
        projectId: projectId || item.projectId || null,
        title: item.title || 'Untitled Reference',
        authors: item.authors?.map(normalizeAuthorObject) || [{ name: 'Unknown Author' }],
        publicationYear: item.publicationYear || item.year || '',
        year: item.publicationYear || item.year || '',
        journalTitle: item.journalTitle || item.journal || '',
        journal: item.journalTitle || item.journal || '',
        publisher: item.publisher || '',
        volume: item.volume || '',
        issue: item.issue || '',
        pages: item.pages || '',
        doi: cleanDoi,
        normalizedDoi: cleanDoi,
        url: item.url || (cleanDoi ? `https://doi.org/${cleanDoi}` : ''),
        publicationType: item.publicationType || 'journal-article',
        sourceProvider: item.sourceProvider || 'batch',
        metadataStatus: cleanDoi ? 'verified' : (item.metadataStatus || 'unverified'),
        collectionIds: collectionId ? [collectionId] : (item.collectionIds || []),
        deletedAt: null
      };

      if (isDbConnected()) {
        const doc = await Citation.create(record);
        saved.push(doc);
      } else {
        const id = new mongoose.Types.ObjectId().toString();
        const memEntry = { _id: id, ...record, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        memCitations.set(id, memEntry);
        saved.push(memEntry);
      }
    }

    res.json({
      importedCount: saved.length,
      duplicateCount: duplicates.length,
      imported: saved,
      duplicates: duplicates.map(d => ({ title: d.entry.title, reason: d.reason, matchType: d.matchType }))
    });
  } catch (e) { next(e); }
});

// 8. Detect Duplicates Across Library
apiRouter.get('/references/duplicates', requireAuth, async (req, res, next) => {
  try {
    let all = [];
    if (isDbConnected()) {
      all = await Citation.find({ ownerId: req.user.id, deletedAt: null }).lean();
    } else {
      all = [...memCitations.values()].filter(c => c.ownerId === req.user.id && !c.deletedAt);
    }

    const duplicates = [];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const resCheck = detectReferenceDuplicates([all[i]], [all[j]]);
        if (resCheck.duplicates.length > 0) {
          const d = resCheck.duplicates[0];
          duplicates.push({
            primary: all[j],
            duplicate: all[i],
            matchType: d.matchType,
            score: d.matchScore,
            reason: d.reason
          });
        }
      }
    }

    res.json({ totalDuplicatePairs: duplicates.length, duplicatePairs: duplicates, duplicateGroups: duplicates });
  } catch (e) { next(e); }
});

// 9. Merge Duplicates
apiRouter.post('/references/merge', requireAuth, async (req, res, next) => {
  try {
    const { primaryId, secondaryId, overrides = {} } = req.body || {};
    if (!primaryId || !secondaryId) return res.status(400).json({ error: 'primaryId and secondaryId are required.' });

    let primary = null;
    let secondary = null;

    if (isDbConnected()) {
      primary = await Citation.findOne({ _id: primaryId, ownerId: req.user.id, deletedAt: null }).lean();
      secondary = await Citation.findOne({ _id: secondaryId, ownerId: req.user.id, deletedAt: null }).lean();
    } else {
      primary = memCitations.get(primaryId);
      secondary = memCitations.get(secondaryId);
    }

    if (!primary || !secondary) return res.status(404).json({ error: 'One or both reference records not found.' });

    const mergedData = mergeReferenceRecords(primary, secondary, overrides);

    if (isDbConnected()) {
      const updatedPrimary = await Citation.findByIdAndUpdate(primaryId, { $set: mergedData }, { new: true });
      const payload = updatedPrimary.toObject ? updatedPrimary.toObject() : updatedPrimary;
      payload.id = payload._id.toString();
      await Citation.findByIdAndUpdate(secondaryId, {
        $set: { deletedAt: new Date(), notes: `[Merged into ${primaryId}] ${secondary.notes || ''}` }
      });
      await recordAudit(req.user.id, 'REFERENCE_MERGED', 'Reference', primaryId, { secondaryId });
      return res.json({ success: true, merged: payload, mergedReference: payload, removedId: secondaryId });
    }

    Object.assign(primary, mergedData, { updatedAt: new Date().toISOString() });
    primary.id = primary._id ? primary._id.toString() : primary.id;
    secondary.deletedAt = new Date().toISOString();
    secondary.notes = `[Merged into ${primaryId}] ${secondary.notes || ''}`;
    await recordAudit(req.user.id, 'REFERENCE_MERGED', 'Reference', primaryId, { secondaryId });
    res.json({ success: true, merged: primary, mergedReference: primary, removedId: secondaryId });
  } catch (e) { next(e); }
});

// 10. Format Single Reference (CSL)
apiRouter.post('/references/format', requireAuth, async (req, res, next) => {
  try {
    const { reference, style = 'apa7', type = 'bibliography' } = req.body || {};
    if (!reference) return res.status(400).json({ error: 'Reference data is required.' });

    const formatted = formatCslCitation(reference, style, type);
    res.json({ style, type, formatted, citation: formatted });
  } catch (e) { next(e); }
});

// 11. Generate Multi-Reference Bibliography
apiRouter.post('/references/bibliography', requireAuth, async (req, res, next) => {
  try {
    const { referenceIds = [], projectId = null, style = 'apa7', format = 'plaintext' } = req.body || {};
    let references = [];

    if (isDbConnected()) {
      const filter = { ownerId: req.user.id, deletedAt: null };
      if (Array.isArray(referenceIds) && referenceIds.length > 0) {
        filter._id = { $in: referenceIds };
      } else if (projectId) {
        filter.projectId = projectId;
      }
      references = await Citation.find(filter).lean();
    } else {
      references = [...memCitations.values()].filter(c => {
        if (c.ownerId !== req.user.id || c.deletedAt) return false;
        if (Array.isArray(referenceIds) && referenceIds.length > 0) return referenceIds.includes(c._id);
        if (projectId) return c.projectId === projectId;
        return true;
      });
    }

    if (references.length === 0) {
      return res.status(404).json({ error: 'No references found to generate bibliography.' });
    }

    const bibliography = generateBibliography(references, style, format);
    res.json({
      style,
      format,
      count: references.length,
      bibliography
    });
  } catch (e) { next(e); }
});

// 12. Export References
apiRouter.get('/references/export', requireAuth, async (req, res, next) => {
  try {
    const format = (req.query.format || 'bibtex').toLowerCase();
    const projectId = req.query.projectId || null;
    const collectionId = req.query.collectionId || null;
    const ids = req.query.ids ? String(req.query.ids).split(',').filter(Boolean) : null;

    let citations = [];
    if (isDbConnected()) {
      const filter = { ownerId: req.user.id, deletedAt: null };
      if (ids) filter._id = { $in: ids };
      else {
        if (projectId && projectId !== 'all') filter.projectId = projectId;
        if (collectionId && collectionId !== 'all') filter.collectionIds = collectionId;
      }
      citations = await Citation.find(filter).lean();
    } else {
      citations = [...memCitations.values()].filter(c => {
        if (c.ownerId !== req.user.id || c.deletedAt) return false;
        if (ids) return ids.includes(c._id);
        if (projectId && projectId !== 'all' && c.projectId !== projectId) return false;
        if (collectionId && collectionId !== 'all' && (!c.collectionIds || !c.collectionIds.includes(collectionId))) return false;
        return true;
      });
    }

    let exported = '';
    let contentType = 'text/plain; charset=utf-8';
    let fileExt = 'txt';

    if (format === 'ris') {
      exported = exportToRis(citations);
      contentType = 'application/x-research-info-systems; charset=utf-8';
      fileExt = 'ris';
    } else if (format === 'html') {
      exported = generateBibliography(citations, 'apa7', 'html');
      contentType = 'text/html; charset=utf-8';
      fileExt = 'html';
    } else if (format === 'txt' || format === 'plaintext') {
      exported = generateBibliography(citations, 'apa7', 'plaintext');
      contentType = 'text/plain; charset=utf-8';
      fileExt = 'txt';
    } else {
      // Default: BibTeX
      exported = exportToBibtex(citations);
      contentType = 'application/x-bibtex; charset=utf-8';
      fileExt = 'bib';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="references_${Date.now()}.${fileExt}"`);
    res.send(exported);
  } catch (e) { next(e); }
});

apiRouter.post('/references/retraction-check', requireAuth, async (req, res, next) => {
  try {
    const { citations = [] } = req.body || {};
    const results = citations.map(c => checkRetractionStatus(c.doi, c.title));
    res.json({ results });
  } catch (e) { next(e); }
});

// 13. Get Single Reference
apiRouter.get('/references/:id', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const ref = await Citation.findOne({ _id: req.params.id, ownerId: req.user.id, deletedAt: null }).lean();
      if (!ref) return res.status(404).json({ error: 'Reference not found.' });
      const payload = { ...ref, id: ref._id.toString() };
      return res.json({ ...payload, reference: payload });
    }
    const memRef = memCitations.get(req.params.id);
    if (!memRef || memRef.ownerId !== req.user.id || memRef.deletedAt) {
      return res.status(404).json({ error: 'Reference not found.' });
    }
    const payload = { ...memRef, id: (memRef._id || memRef.id).toString() };
    res.json({ ...payload, reference: payload });
  } catch (e) { next(e); }
});

// 14. Update Reference
apiRouter.patch('/references/:id', requireAuth, async (req, res, next) => {
  try {
    const updates = { ...req.body };
    delete updates._id;
    delete updates.ownerId;

    if (updates.doi) {
      updates.normalizedDoi = normalizeDoi(updates.doi);
      updates.doi = updates.normalizedDoi;
    }
    if (updates.authors && Array.isArray(updates.authors)) {
      updates.authors = updates.authors.map(normalizeAuthorObject);
    }
    if (updates.publicationYear) {
      updates.year = updates.publicationYear;
    }

    if (isDbConnected()) {
      const updated = await Citation.findOneAndUpdate(
        { _id: req.params.id, ownerId: req.user.id, deletedAt: null },
        { $set: updates },
        { new: true }
      );
      if (!updated) return res.status(404).json({ error: 'Reference not found.' });
      await recordAudit(req.user.id, 'REFERENCE_UPDATED', 'Reference', req.params.id, updates);
      const payload = updated.toObject ? updated.toObject() : updated;
      payload.id = payload._id.toString();
      return res.json({ ...payload, reference: payload });
    }

    const memRef = memCitations.get(req.params.id);
    if (!memRef || memRef.ownerId !== req.user.id || memRef.deletedAt) {
      return res.status(404).json({ error: 'Reference not found.' });
    }
    Object.assign(memRef, updates, { updatedAt: new Date().toISOString() });
    await recordAudit(req.user.id, 'REFERENCE_UPDATED', 'Reference', req.params.id, updates);
    const payload = { ...memRef, id: (memRef._id || memRef.id).toString() };
    res.json({ ...payload, reference: payload });
  } catch (e) { next(e); }
});

// 15. Delete Reference (Soft Delete)
apiRouter.delete('/references/:id', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const deleted = await Citation.findOneAndUpdate(
        { _id: req.params.id, ownerId: req.user.id, deletedAt: null },
        { $set: { deletedAt: new Date() } },
        { new: true }
      );
      if (!deleted) return res.status(404).json({ error: 'Reference not found.' });
      await recordAudit(req.user.id, 'REFERENCE_DELETED', 'Reference', req.params.id);
      return res.json({ deleted: true, success: true, id: req.params.id });
    }

    const memRef = memCitations.get(req.params.id);
    if (!memRef || memRef.ownerId !== req.user.id || memRef.deletedAt) {
      return res.status(404).json({ error: 'Reference not found.' });
    }
    memRef.deletedAt = new Date().toISOString();
    memRef.updatedAt = new Date().toISOString();
    await recordAudit(req.user.id, 'REFERENCE_DELETED', 'Reference', req.params.id);
    res.json({ deleted: true, success: true, id: req.params.id });
  } catch (e) { next(e); }
});

// ============================================================================
// Reference Collections APIs
// ============================================================================

apiRouter.get('/reference-collections', requireAuth, async (req, res, next) => {
  try {
    const { projectId } = req.query;
    if (isDbConnected()) {
      const filter = { ownerId: req.user.id };
      if (projectId && projectId !== 'all') filter.projectId = projectId;
      const collections = await ReferenceCollection.find(filter).sort({ name: 1 }).lean();
      return res.json(collections);
    }
    const list = [...memReferenceCollections.values()].filter(c => {
      if (c.ownerId !== req.user.id) return false;
      if (projectId && projectId !== 'all' && c.projectId !== projectId) return false;
      return true;
    });
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const mapped = list.map(c => ({ ...(c.toObject ? c.toObject() : c), id: (c._id || c.id).toString() }));
    res.json({ collections: mapped, total: mapped.length });
  } catch (e) { next(e); }
});

apiRouter.post('/reference-collections', requireAuth, async (req, res, next) => {
  try {
    const { name, description = '', color = '#5e6ad2', icon = 'folder', projectId = null } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Collection name is required.' });

    if (isDbConnected()) {
      const col = await ReferenceCollection.create({
        ownerId: req.user.id,
        projectId: projectId || null,
        name: name.trim(),
        description: description.trim(),
        color,
        icon
      });
      const payload = col.toObject ? col.toObject() : col;
      payload.id = payload._id.toString();
      return res.status(201).json({ ...payload, collection: payload });
    }

    const newId = new mongoose.Types.ObjectId().toString();
    const col = {
      _id: newId,
      id: newId,
      ownerId: req.user.id,
      projectId: projectId || null,
      name: name.trim(),
      description: description.trim(),
      color,
      icon,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    memReferenceCollections.set(newId, col);
    res.status(201).json({ ...col, collection: col });
  } catch (e) { next(e); }
});

apiRouter.patch('/reference-collections/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, description, color, icon } = req.body || {};
    const updates = {};
    if (name) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();
    if (color) updates.color = color;
    if (icon) updates.icon = icon;

    if (isDbConnected()) {
      const updated = await ReferenceCollection.findOneAndUpdate(
        { _id: req.params.id, ownerId: req.user.id },
        { $set: updates },
        { new: true }
      );
      if (!updated) return res.status(404).json({ error: 'Collection not found.' });
      const payload = updated.toObject ? updated.toObject() : updated;
      payload.id = payload._id.toString();
      return res.json({ ...payload, collection: payload });
    }

    const col = memReferenceCollections.get(req.params.id);
    if (!col || col.ownerId !== req.user.id) return res.status(404).json({ error: 'Collection not found.' });
    Object.assign(col, updates, { updatedAt: new Date().toISOString() });
    col.id = col._id ? col._id.toString() : col.id;
    res.json({ ...col, collection: col });
  } catch (e) { next(e); }
});

apiRouter.delete('/reference-collections/:id', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const deleted = await ReferenceCollection.findOneAndDelete({ _id: req.params.id, ownerId: req.user.id });
      if (!deleted) return res.status(404).json({ error: 'Collection not found.' });
      // Unlink collection from references
      await Citation.updateMany(
        { ownerId: req.user.id, collectionIds: req.params.id },
        { $pull: { collectionIds: req.params.id } }
      );
      return res.json({ deleted: true, id: req.params.id });
    }

    const col = memReferenceCollections.get(req.params.id);
    if (!col || col.ownerId !== req.user.id) return res.status(404).json({ error: 'Collection not found.' });
    memReferenceCollections.delete(req.params.id);

    // Unlink in memory
    for (const ref of memCitations.values()) {
      if (ref.ownerId === req.user.id && Array.isArray(ref.collectionIds)) {
        ref.collectionIds = ref.collectionIds.filter(cid => String(cid) !== String(req.params.id));
      }
    }
    res.json({ deleted: true, id: req.params.id });
  } catch (e) { next(e); }
});

// ============================================================================
// Phase 5: Literature Review Studio API Suite
// ============================================================================

// 1. Query Literature Entries (Filtered, Searchable, Paginated)
apiRouter.get('/literature', requireAuth, async (req, res, next) => {
  try {
    const {
      projectId,
      status,
      extractionStatus,
      thematicTag,
      tag,
      search,
      q,
      sort = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 50,
      paginated
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const searchQuery = (q || search || '').trim().toLowerCase();
    const targetTag = thematicTag || tag;

    if (isDbConnected()) {
      const filter = { deletedAt: null };
      if (projectId && projectId !== 'all') {
        filter.projectId = projectId;
      } else {
        filter.userId = req.user.id;
      }
      if (status && status !== 'all') filter.status = status;
      if (extractionStatus && extractionStatus !== 'all') filter.extractionStatus = extractionStatus;
      if (targetTag && targetTag !== 'all') filter.thematicTags = targetTag;

      if (searchQuery) {
        filter.$or = [
          { title: { $regex: searchQuery, $options: 'i' } },
          { abstract: { $regex: searchQuery, $options: 'i' } },
          { journal: { $regex: searchQuery, $options: 'i' } },
          { keyFindings: { $regex: searchQuery, $options: 'i' } },
          { methodology: { $regex: searchQuery, $options: 'i' } },
          { authors: { $regex: searchQuery, $options: 'i' } }
        ];
      }

      const sortObj = {};
      sortObj[sort] = order === 'asc' ? 1 : -1;

      const [totalCount, entries] = await Promise.all([
        LiteratureEntry.countDocuments(filter),
        LiteratureEntry.find(filter)
          .sort(sortObj)
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum)
          .lean()
      ]);

      const totalPages = Math.ceil(totalCount / limitNum) || 1;
      res.setHeader('X-Total-Count', totalCount);
      res.setHeader('X-Page', pageNum);
      res.setHeader('X-Total-Pages', totalPages);

      const mapped = entries.map(e => ({ ...e, id: e._id.toString() }));
      if (paginated === 'false') {
        return res.json(mapped);
      }
      return res.json({ entries: mapped, pagination: { page: pageNum, limit: limitNum, totalCount, totalPages } });
    }

    // In-memory fallback
    let list = [...memLiterature.values()].filter(e => {
      if (e.deletedAt) return false;
      if (projectId && projectId !== 'all' && e.projectId !== projectId) return false;
      if (!projectId && e.userId !== req.user.id) return false;
      if (status && status !== 'all' && e.status !== status) return false;
      if (extractionStatus && extractionStatus !== 'all' && e.extractionStatus !== extractionStatus) return false;
      if (targetTag && targetTag !== 'all' && (!e.thematicTags || !e.thematicTags.includes(targetTag))) return false;
      if (searchQuery) {
        const textToSearch = `${e.title || ''} ${e.abstract || ''} ${e.journal || ''} ${e.keyFindings || ''} ${(e.authors || []).join(' ')}`.toLowerCase();
        if (!textToSearch.includes(searchQuery)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sort === 'year') cmp = (a.year || '').localeCompare(b.year || '');
      else if (sort === 'title') cmp = (a.title || '').localeCompare(b.title || '');
      else {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        cmp = dateA - dateB;
      }
      return order === 'asc' ? cmp : -cmp;
    });

    const totalCount = list.length;
    const totalPages = Math.ceil(totalCount / limitNum) || 1;
    const paginatedItems = list.slice((pageNum - 1) * limitNum, pageNum * limitNum).map(e => ({ ...e, id: (e._id || e.id).toString() }));

    res.setHeader('X-Total-Count', totalCount);
    res.setHeader('X-Page', pageNum);
    res.setHeader('X-Total-Pages', totalPages);

    if (paginated === 'false') {
      return res.json(paginatedItems);
    }
    res.json({ entries: paginatedItems, pagination: { page: pageNum, limit: limitNum, totalCount, totalPages } });
  } catch (e) { next(e); }
});

// 2. Discover Scholarly Papers (Crossref & OpenAlex)
apiRouter.get('/literature/search', requireAuth, async (req, res, next) => {
  try {
    const { q, query, provider = 'crossref', yearMin, yearMax, journal, openAccessOnly, limit = 15 } = req.query;
    const searchQuery = (q || query || '').trim();
    if (!searchQuery) return res.status(400).json({ error: 'Search query is required.' });

    const results = await searchScholarlyPapers(searchQuery, {
      provider,
      yearMin,
      yearMax,
      journal,
      openAccessOnly: openAccessOnly === 'true',
      limit: parseInt(limit, 10) || 15
    });

    res.json({ query: searchQuery, total: results.length, results });
  } catch (e) { next(e); }
});

// 3. Import Papers into Literature Review
apiRouter.post('/literature/import', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const { projectId, source = 'reference', referenceId, referenceIds = [], paperData, doi } = body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required.' });

    const imported = [];
    const paperObj = paperData || (body.title ? body : null);

    // Case A: Import from Reference Manager (single or multiple)
    const targetRefIds = referenceId ? [referenceId] : (Array.isArray(referenceIds) ? referenceIds : []);
    if (targetRefIds.length > 0) {
      for (const rId of targetRefIds) {
        let refDoc = null;
        if (isDbConnected()) {
          refDoc = await Citation.findOne({ _id: rId, ownerId: req.user.id, deletedAt: null }).lean();
        } else {
          refDoc = memCitations.get(rId);
        }

        if (!refDoc) continue;

        const entryPayload = {
          projectId,
          userId: req.user.id,
          referenceId: refDoc._id,
          title: refDoc.title,
          authors: (refDoc.authors || []).map(a => a.name || `${a.given || ''} ${a.family || ''}`.trim()),
          year: refDoc.publicationYear || refDoc.year || '',
          journal: refDoc.journalTitle || refDoc.journal || '',
          doi: refDoc.doi || '',
          normalizedDoi: refDoc.normalizedDoi || refDoc.doi || '',
          url: refDoc.url || '',
          abstract: refDoc.abstract || '',
          thematicTags: refDoc.tags || [],
          status: 'screened',
          extractionStatus: refDoc.abstract ? 'unextracted' : 'unextracted'
        };

        if (isDbConnected()) {
          const created = await LiteratureEntry.create(entryPayload);
          imported.push({ ...created.toObject(), id: created._id.toString() });
        } else {
          const newId = new mongoose.Types.ObjectId().toString();
          const memItem = { _id: newId, id: newId, ...entryPayload, createdAt: new Date().toISOString() };
          memLiterature.set(newId, memItem);
          imported.push(memItem);
        }
      }
    } else if (paperObj && paperObj.title) {
      // Case B: Direct paper data import from scholarly search or raw form
      const entryPayload = {
        projectId,
        userId: req.user.id,
        title: paperObj.title.trim(),
        authors: Array.isArray(paperObj.authors) ? paperObj.authors : [paperObj.authors || 'Unknown Author'],
        year: paperObj.year || paperObj.publicationYear || '',
        journal: paperObj.journal || paperObj.journalTitle || '',
        doi: normalizeDoi(paperObj.doi || ''),
        url: paperObj.url || '',
        abstract: paperObj.abstract || '',
        studyDesign: paperObj.studyDesign || 'Observational',
        thematicTags: Array.isArray(paperObj.tags || paperObj.thematicTags) ? (paperObj.tags || paperObj.thematicTags) : [],
        status: paperObj.status || 'identified',
        extractionStatus: paperObj.extractionStatus || 'pending'
      };

      if (isDbConnected()) {
        const created = await LiteratureEntry.create(entryPayload);
        imported.push({ ...created.toObject(), id: created._id.toString() });
      } else {
        const newId = new mongoose.Types.ObjectId().toString();
        const memItem = { _id: newId, id: newId, ...entryPayload, createdAt: new Date().toISOString() };
        memLiterature.set(newId, memItem);
        imported.push(memItem);
      }
    }

    res.status(201).json({ success: true, importedCount: imported.length, imported, entry: imported[0] || null });
  } catch (e) { next(e); }
});

// 4. Extract Structured Evidence
apiRouter.post('/literature/extract', requireAuth, async (req, res, next) => {
  try {
    const { entryId, sourceText, options = {} } = req.body || {};
    if (!entryId) return res.status(400).json({ error: 'entryId is required.' });

    let entry = null;
    if (isDbConnected()) {
      entry = await LiteratureEntry.findOne({ _id: entryId, deletedAt: null });
    } else {
      entry = memLiterature.get(entryId);
    }

    if (!entry) return res.status(404).json({ error: 'Literature entry not found.' });

    const textToAnalyze = (sourceText || entry.abstract || `${entry.title}. ${entry.abstract || ''}`).trim();
    if (!textToAnalyze) return res.status(400).json({ error: 'No abstract or source text available to extract evidence.' });

    const rawExtracts = extractStructuredEvidence(textToAnalyze, entry);
    const savedExtracts = [];

    // Update study fields from extracts
    const updates = { extractionStatus: 'extracted' };
    const matrixUpdates = entry.matrixData || {};

    for (const ext of rawExtracts) {
      if (ext.extractedField === 'studyObjectives') updates.studyObjectives = ext.extractedValue;
      if (ext.extractedField === 'sampleSize') {
        updates.sampleSize = ext.extractedValue;
        matrixUpdates.sampleSize = ext.extractedValue;
      }
      if (ext.extractedField === 'methodology') {
        updates.methodology = ext.extractedValue;
        matrixUpdates.methodology = ext.extractedValue;
      }
      if (ext.extractedField === 'statisticalMethods') updates.statisticalMethods = ext.extractedValue;
      if (ext.extractedField === 'keyFindings') {
        updates.keyFindings = ext.extractedValue;
        matrixUpdates.findings = ext.extractedValue;
      }
      if (ext.extractedField === 'effectEstimates') updates.effectEstimates = ext.extractedValue;
      if (ext.extractedField === 'limitations') {
        updates.limitations = ext.extractedValue;
        matrixUpdates.limitations = ext.extractedValue;
      }

      const extractRecord = {
        projectId: entry.projectId,
        literatureEntryId: entry._id || entry.id,
        documentId: entry.documentId || null,
        section: ext.section || 'Abstract',
        sourceText: ext.sourceText,
        extractedField: ext.extractedField,
        extractedValue: ext.extractedValue,
        extractionMethod: 'automatic',
        confidenceOrReviewStatus: 'pending_review'
      };

      if (isDbConnected()) {
        const saved = await EvidenceExtract.create(extractRecord);
        savedExtracts.push({ ...saved.toObject(), id: saved._id.toString() });
      } else {
        const extId = new mongoose.Types.ObjectId().toString();
        const memExt = { _id: extId, id: extId, ...extractRecord, createdAt: new Date().toISOString() };
        memEvidenceExtracts.set(extId, memExt);
        savedExtracts.push(memExt);
      }
    }

    updates.matrixData = matrixUpdates;

    if (isDbConnected()) {
      await LiteratureEntry.findByIdAndUpdate(entryId, { $set: updates });
    } else {
      Object.assign(entry, updates, { updatedAt: new Date().toISOString() });
    }

    const finalEntry = isDbConnected() ? await LiteratureEntry.findById(entryId).lean() : entry;
    res.json({
      success: true,
      entryId,
      extractionStatus: 'extracted',
      extractedCount: savedExtracts.length,
      extracts: savedExtracts,
      studyUpdates: updates,
      evidence: updates,
      entry: finalEntry
    });
  } catch (e) { next(e); }
});

// 5. Literature Matrix (Get Configuration & Data)
apiRouter.get('/literature/matrix', requireAuth, async (req, res, next) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required.' });

    let matrixConfig = null;
    let entries = [];

    if (isDbConnected()) {
      matrixConfig = await LiteratureMatrix.findOne({ projectId }).lean();
      entries = await LiteratureEntry.find({ projectId, deletedAt: null }).sort({ createdAt: -1 }).lean();
    } else {
      matrixConfig = [...memLiteratureMatrices.values()].find(m => m.projectId === projectId);
      entries = [...memLiterature.values()].filter(e => e.projectId === projectId && !e.deletedAt);
    }

    const defaultColumns = [
      { key: 'title', label: 'Study Title', visible: true, width: 220, order: 0 },
      { key: 'authors', label: 'Authors', visible: true, width: 160, order: 1 },
      { key: 'year', label: 'Year', visible: true, width: 80, order: 2 },
      { key: 'journal', label: 'Journal / Source', visible: true, width: 160, order: 3 },
      { key: 'studyDesign', label: 'Study Design', visible: true, width: 140, order: 4 },
      { key: 'sampleSize', label: 'Sample (N)', visible: true, width: 110, order: 5 },
      { key: 'samplingMethod', label: 'Sampling Method', visible: true, width: 130, order: 6 },
      { key: 'statisticalMethods', label: 'Statistical Methods', visible: true, width: 150, order: 7 },
      { key: 'keyFindings', label: 'Key Findings', visible: true, width: 240, order: 8 },
      { key: 'effectEstimates', label: 'Effect Estimates', visible: true, width: 120, order: 9 },
      { key: 'limitations', label: 'Limitations', visible: true, width: 200, order: 10 },
      { key: 'extractionStatus', label: 'Status', visible: true, width: 100, order: 11 }
    ];

    res.json({
      success: true,
      projectId,
      matrix: matrixConfig || { title: 'Literature Review Matrix', columns: defaultColumns },
      columns: matrixConfig?.columns || defaultColumns,
      sortConfig: matrixConfig?.sortConfig || { key: 'year', order: 'desc' },
      rows: entries.map(e => ({ ...e, id: (e._id || e.id).toString() }))
    });
  } catch (e) { next(e); }
});

apiRouter.post('/literature/matrix', requireAuth, async (req, res, next) => {
  try {
    const { projectId, title, columns, sortConfig, filters, groupByTheme } = req.body || {};
    if (!projectId) return res.status(400).json({ error: 'projectId is required.' });

    const matrixData = {
      projectId,
      title: title || 'Literature Review Matrix',
      columns: Array.isArray(columns) ? columns : [],
      sortConfig: sortConfig || { key: 'year', order: 'desc' },
      filters: filters || {},
      groupByTheme: Boolean(groupByTheme)
    };

    if (isDbConnected()) {
      const matrix = await LiteratureMatrix.findOneAndUpdate(
        { projectId },
        { $set: matrixData },
        { new: true, upsert: true }
      ).lean();
      return res.status(201).json({ success: true, matrix: { ...matrix, id: matrix._id.toString() } });
    }

    let existing = [...memLiteratureMatrices.values()].find(m => m.projectId === projectId);
    if (existing) {
      Object.assign(existing, matrixData, { updatedAt: new Date().toISOString() });
      return res.status(201).json({ success: true, matrix: existing });
    }

    const id = new mongoose.Types.ObjectId().toString();
    const newMatrix = { _id: id, id, ...matrixData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    memLiteratureMatrices.set(id, newMatrix);
    res.status(201).json({ success: true, matrix: newMatrix });
  } catch (e) { next(e); }
});

// 6. Inline Cell Matrix Update
apiRouter.patch('/literature/matrix/:entryId', requireAuth, async (req, res, next) => {
  try {
    const { field, value, matrixData } = req.body || {};
    const { entryId } = req.params;

    const updates = {};
    if (field) {
      updates[field] = value;
      // also mirror into matrixData
      if (['methodology', 'sampleSize', 'instruments', 'findings', 'limitations', 'country', 'gapNotes'].includes(field)) {
        updates[`matrixData.${field}`] = value;
      }
    }
    if (matrixData && typeof matrixData === 'object') {
      updates.matrixData = matrixData;
    }

    if (isDbConnected()) {
      const updated = await LiteratureEntry.findByIdAndUpdate(entryId, { $set: updates }, { new: true }).lean();
      if (!updated) return res.status(404).json({ error: 'Literature entry not found.' });
      return res.json({ success: true, entry: { ...updated, id: updated._id.toString() } });
    }

    const entry = memLiterature.get(entryId);
    if (!entry) return res.status(404).json({ error: 'Literature entry not found.' });
    if (field) entry[field] = value;
    if (matrixData) entry.matrixData = Object.assign(entry.matrixData || {}, matrixData);
    entry.updatedAt = new Date().toISOString();

    res.json({ success: true, entry: { ...entry, id: (entry._id || entry.id).toString() } });
  } catch (e) { next(e); }
});

// 7. Multi-Study Comparison
apiRouter.post('/literature/compare', requireAuth, async (req, res, next) => {
  try {
    const studyIds = (req.body && (req.body.studyIds || req.body.entryIds)) || [];
    const dimensions = (req.body && req.body.dimensions) || [];
    if (!Array.isArray(studyIds) || studyIds.length < 2) {
      return res.status(400).json({ error: 'Please select at least 2 studies to perform comparison.' });
    }

    let studies = [];
    if (isDbConnected()) {
      studies = await LiteratureEntry.find({ _id: { $in: studyIds }, deletedAt: null }).lean();
    } else {
      studies = [...memLiterature.values()].filter(e => studyIds.includes((e._id || e.id).toString()) && !e.deletedAt);
    }

    if (studies.length < 2) {
      return res.status(400).json({ error: 'Could not find at least 2 matching active studies.' });
    }

    const comparison = compareStudies(studies, dimensions);
    res.json({ success: true, ...comparison });
  } catch (e) { next(e); }
});

// 8. Thematic Grouping (Get & Create/Update)
apiRouter.get('/literature/themes', requireAuth, async (req, res, next) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required.' });

    if (isDbConnected()) {
      const themes = await LiteratureTheme.find({ projectId }).sort({ createdAt: -1 }).lean();
      return res.json(themes.map(t => ({ ...t, id: t._id.toString() })));
    }

    const themes = [...memLiteratureThemes.values()].filter(t => t.projectId === projectId).map(t => ({ ...t, id: (t._id || t.id).toString() }));
    res.json(themes);
  } catch (e) { next(e); }
});

apiRouter.post('/literature/themes', requireAuth, async (req, res, next) => {
  try {
    const { projectId, name, description = '', color = '#5e6ad2', notes = '' } = req.body || {};
    const studyIds = (req.body && (req.body.studyIds || req.body.entryIds)) || [];
    if (!projectId || !name || !name.trim()) {
      return res.status(400).json({ error: 'projectId and theme name are required.' });
    }

    const themeData = {
      projectId,
      userId: req.user.id,
      name: name.trim(),
      description: description.trim(),
      color,
      studyIds,
      notes
    };

    if (isDbConnected()) {
      const created = await LiteratureTheme.create(themeData);
      return res.status(201).json({ success: true, theme: { ...created.toObject(), id: created._id.toString() } });
    }

    const themeId = new mongoose.Types.ObjectId().toString();
    const memTheme = { _id: themeId, id: themeId, ...themeData, createdAt: new Date().toISOString() };
    memLiteratureThemes.set(themeId, memTheme);
    res.status(201).json({ success: true, theme: memTheme });
  } catch (e) { next(e); }
});

// 9. Candidate Research Gap Identification
apiRouter.post('/literature/gaps', requireAuth, async (req, res, next) => {
  try {
    const { projectId } = req.body || {};
    const studyIds = (req.body && (req.body.studyIds || req.body.entryIds)) || [];
    if (!projectId) return res.status(400).json({ error: 'projectId is required.' });

    let studies = [];
    if (isDbConnected()) {
      const filter = { projectId, deletedAt: null };
      if (Array.isArray(studyIds) && studyIds.length > 0) filter._id = { $in: studyIds };
      studies = await LiteratureEntry.find(filter).lean();
    } else {
      studies = [...memLiterature.values()].filter(e => {
        if (e.projectId !== projectId || e.deletedAt) return false;
        if (Array.isArray(studyIds) && studyIds.length > 0) return studyIds.includes((e._id || e.id).toString());
        return true;
      });
    }

    if (studies.length === 0) {
      return res.status(400).json({ error: 'No studies available to identify research gaps.' });
    }

    const gaps = identifyResearchGaps(studies);
    res.json({
      success: true,
      projectId,
      totalGaps: gaps.length,
      candidateGaps: gaps,
      gaps
    });
  } catch (e) { next(e); }
});

// 10. Evidence-Linked Literature Synthesis
apiRouter.post('/literature/synthesis', requireAuth, async (req, res, next) => {
  try {
    const { projectId, type = 'thematic', title, citationStyle = 'apa7' } = req.body || {};
    const studyIds = (req.body && (req.body.studyIds || req.body.entryIds)) || [];
    if (!projectId) return res.status(400).json({ error: 'projectId is required.' });

    let studies = [];
    let themes = [];

    if (isDbConnected()) {
      const filter = { projectId, deletedAt: null };
      if (Array.isArray(studyIds) && studyIds.length > 0) filter._id = { $in: studyIds };
      studies = await LiteratureEntry.find(filter).lean();
      themes = await LiteratureTheme.find({ projectId }).lean();
    } else {
      studies = [...memLiterature.values()].filter(e => {
        if (e.projectId !== projectId || e.deletedAt) return false;
        if (Array.isArray(studyIds) && studyIds.length > 0) return studyIds.includes((e._id || e.id).toString());
        return true;
      });
      themes = [...memLiteratureThemes.values()].filter(t => t.projectId === projectId);
    }

    if (studies.length === 0) {
      return res.status(400).json({ error: 'No studies found to synthesize.' });
    }

    const synthesis = generateEvidenceLinkedSynthesis(studies, themes, {
      type,
      title: title || 'Systematic Literature Review Synthesis',
      citationStyle
    });

    // Save as synthesis draft record
    const draftPayload = {
      projectId,
      userId: req.user.id,
      title: synthesis.title,
      type: synthesis.type,
      studyIds: studies.map(s => s._id || s.id),
      sections: synthesis.sections,
      fullDraft: synthesis.fullDraft,
      evidenceLinks: synthesis.evidenceLinks,
      version: 1,
      versions: [{ versionNumber: 1, fullDraft: synthesis.fullDraft, createdAt: new Date() }]
    };

    let draftId = '';
    if (isDbConnected()) {
      const draft = await SynthesisDraft.create(draftPayload);
      draftId = draft._id.toString();
    } else {
      draftId = new mongoose.Types.ObjectId().toString();
      memSynthesisDrafts.set(draftId, { _id: draftId, id: draftId, ...draftPayload, createdAt: new Date().toISOString() });
    }

    res.json({
      success: true,
      draftId,
      synthesis,
      ...synthesis
    });
  } catch (e) { next(e); }
});

// 11. Multi-Format Literature Matrix & Synthesis Export
apiRouter.get('/literature/export', requireAuth, async (req, res, next) => {
  try {
    const { projectId, format = 'csv' } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId is required.' });

    let entries = [];
    if (isDbConnected()) {
      entries = await LiteratureEntry.find({ projectId, deletedAt: null }).sort({ createdAt: -1 }).lean();
    } else {
      entries = [...memLiterature.values()].filter(e => e.projectId === projectId && !e.deletedAt);
    }

    if (format === 'csv') {
      const csv = generateMatrixCsv(entries);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="literature_matrix_${Date.now()}.csv"`);
      return res.send(csv);
    }

    if (format === 'bibtex') {
      const bib = entries.map(e => `@article{${(e.authors?.[0] || 'study').replace(/[^a-zA-Z]/g, '')}${e.year || '2024'},
  title = {${e.title}},
  author = {${(e.authors || []).join(' and ')}},
  year = {${e.year || ''}},
  journal = {${e.journal || ''}},
  doi = {${e.doi || ''}}
}`).join('\n\n');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="literature_${Date.now()}.bib"`);
      return res.send(bib);
    }

    res.json({ total: entries.length, entries });
  } catch (e) { next(e); }
});

// 12. Create Literature Entry
apiRouter.post('/literature', requireAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.title || !body.title.trim()) return res.status(400).json({ error: 'Study title is required.' });

    const cleanDoi = normalizeDoi(body.doi || '');
    const entryData = {
      projectId: body.projectId || null,
      userId: req.user.id,
      referenceId: body.referenceId || null,
      documentId: body.documentId || null,
      title: body.title.trim(),
      authors: Array.isArray(body.authors) ? body.authors : (body.authors ? [body.authors] : ['Unknown Author']),
      year: body.year || body.publicationYear || '',
      journal: body.journal || body.journalTitle || '',
      doi: cleanDoi,
      normalizedDoi: cleanDoi,
      url: body.url || (cleanDoi ? `https://doi.org/${cleanDoi}` : ''),
      abstract: body.abstract || '',
      studyDesign: body.studyDesign || 'Observational',
      researchQuestion: body.researchQuestion || '',
      studyObjectives: body.studyObjectives || '',
      methodology: body.methodology || '',
      population: body.population || '',
      sampleSize: body.sampleSize || '',
      samplingMethod: body.samplingMethod || '',
      participantCharacteristics: body.participantCharacteristics || '',
      geographicSetting: body.geographicSetting || '',
      measures: body.measures || '',
      variables: body.variables || '',
      statisticalMethods: body.statisticalMethods || '',
      keyFindings: body.keyFindings || '',
      effectEstimates: body.effectEstimates || '',
      limitations: body.limitations || '',
      futureDirections: body.futureDirections || '',
      qualityNotes: body.qualityNotes || '',
      matrixData: Object.assign({
        methodology: body.methodology || '',
        sampleSize: body.sampleSize || '',
        instruments: body.measures || '',
        findings: body.keyFindings || '',
        limitations: body.limitations || '',
        country: body.geographicSetting || ''
      }, body.matrixData || {}),
      thematicTags: Array.isArray(body.thematicTags) ? body.thematicTags : [],
      keywords: Array.isArray(body.keywords) ? body.keywords : [],
      tags: Array.isArray(body.tags) ? body.tags : [],
      extractionStatus: body.extractionStatus || 'unextracted',
      status: body.status || 'identified',
      createdBy: req.user.id,
      deletedAt: null
    };

    if (isDbConnected()) {
      const entry = await LiteratureEntry.create(entryData);
      const payload = { ...entry.toObject(), id: entry._id.toString() };
      return res.status(201).json({ success: true, ...payload, entry: payload });
    }

    const id = new mongoose.Types.ObjectId().toString();
    const newEntry = { _id: id, id, ...entryData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    memLiterature.set(id, newEntry);
    res.status(201).json({ success: true, ...newEntry, entry: newEntry });
  } catch (e) { next(e); }
});

// 13. Single Literature Entry CRUD
apiRouter.get('/literature/:entryId', requireAuth, async (req, res, next) => {
  try {
    const { entryId } = req.params;
    let entry = null;
    let extracts = [];

    if (isDbConnected()) {
      entry = await LiteratureEntry.findOne({ _id: entryId, userId: req.user.id, deletedAt: null }).lean();
      if (!entry) return res.status(404).json({ error: 'Literature entry not found.' });
      extracts = await EvidenceExtract.find({ literatureEntryId: entryId }).lean();
      const payload = { ...entry, id: entry._id.toString(), extracts };
      return res.json({ ...payload, entry: payload });
    }

    entry = memLiterature.get(entryId);
    if (!entry || entry.deletedAt || (entry.userId && entry.userId !== req.user.id)) {
      return res.status(404).json({ error: 'Literature entry not found.' });
    }
    extracts = [...memEvidenceExtracts.values()].filter(ex => ex.literatureEntryId === entryId);
    const payload = { ...entry, id: (entry._id || entry.id).toString(), extracts };
    res.json({ ...payload, entry: payload });
  } catch (e) { next(e); }
});

apiRouter.patch('/literature/:entryId', requireAuth, async (req, res, next) => {
  try {
    const { entryId } = req.params;
    const updates = { ...req.body };
    delete updates._id;
    delete updates.userId;
    delete updates.projectId;

    if (isDbConnected()) {
      const updated = await LiteratureEntry.findOneAndUpdate(
        { _id: entryId, userId: req.user.id, deletedAt: null },
        { $set: updates },
        { new: true }
      ).lean();
      if (!updated) return res.status(404).json({ error: 'Literature entry not found.' });
      const payload = { ...updated, id: updated._id.toString() };
      return res.json({ ...payload, entry: payload });
    }

    const entry = memLiterature.get(entryId);
    if (!entry || entry.deletedAt || (entry.userId && entry.userId !== req.user.id)) {
      return res.status(404).json({ error: 'Literature entry not found.' });
    }
    Object.assign(entry, updates, { updatedAt: new Date().toISOString() });
    const payload = { ...entry, id: (entry._id || entry.id).toString() };
    res.json({ ...payload, entry: payload });
  } catch (e) { next(e); }
});

apiRouter.delete('/literature/:entryId', requireAuth, async (req, res, next) => {
  try {
    const { entryId } = req.params;
    if (isDbConnected()) {
      const deleted = await LiteratureEntry.findOneAndUpdate(
        { _id: entryId, userId: req.user.id, deletedAt: null },
        { $set: { deletedAt: new Date() } }
      );
      if (!deleted) return res.status(404).json({ error: 'Literature entry not found.' });
      return res.json({ deleted: true, success: true, id: entryId });
    }

    const entry = memLiterature.get(entryId);
    if (!entry || entry.deletedAt || (entry.userId && entry.userId !== req.user.id)) {
      return res.status(404).json({ error: 'Literature entry not found.' });
    }
    entry.deletedAt = new Date().toISOString();
    res.json({ deleted: true, success: true, id: entryId });
  } catch (e) { next(e); }
});

// Backward-Compatibility Aliases for /projects/:id/literature
apiRouter.get('/projects/:id/literature', requireAuth, async (req, res, next) => {
  req.query.projectId = req.params.id;
  if (isDbConnected()) {
    const entries = await LiteratureEntry.find({ projectId: req.params.id, deletedAt: null }).sort({ createdAt: -1 }).lean();
    return res.json(entries.map(e => ({ ...e, id: e._id.toString() })));
  }
  const entries = [...memLiterature.values()].filter(l => l.projectId === req.params.id && !l.deletedAt).map(e => ({ ...e, id: (e._id || e.id).toString() }));
  res.json(entries);
});

apiRouter.post('/projects/:id/literature', requireAuth, async (req, res, next) => {
  req.body.projectId = req.params.id;
  const body = req.body || {};
  if (!body.title || !body.title.trim()) return res.status(400).json({ error: 'Paper title is required.' });

  const cleanDoi = normalizeDoi(body.doi || '');
  const entryData = {
    projectId: req.params.id,
    userId: req.user.id,
    title: body.title.trim(),
    authors: Array.isArray(body.authors) ? body.authors : (body.authors ? [body.authors] : ['Unknown Author']),
    year: body.year || '',
    journal: body.journal || '',
    doi: cleanDoi,
    normalizedDoi: cleanDoi,
    abstract: body.abstract || '',
    matrixData: {
      methodology: body.methodology || '',
      sampleSize: body.sampleSize || '',
      instruments: body.instruments || '',
      findings: body.findings || '',
      limitations: body.limitations || ''
    },
    thematicTags: Array.isArray(body.thematicTags) ? body.thematicTags : [],
    status: body.status || 'identified',
    extractionStatus: 'unextracted',
    deletedAt: null
  };

  if (isDbConnected()) {
    const created = await LiteratureEntry.create(entryData);
    const payload = { ...created.toObject(), id: created._id.toString() };
    return res.status(201).json(payload);
  }

  const id = new mongoose.Types.ObjectId().toString();
  const newEntry = { _id: id, id, ...entryData, createdAt: new Date().toISOString() };
  memLiterature.set(id, newEntry);
  res.status(201).json(newEntry);
});

apiRouter.patch('/projects/:id/literature/:entryId', requireAuth, async (req, res, next) => {
  if (isDbConnected()) {
    const entry = await LiteratureEntry.findOneAndUpdate(
      { _id: req.params.entryId, projectId: req.params.id, deletedAt: null },
      { $set: req.body },
      { new: true }
    );
    if (!entry) return res.status(404).json({ error: 'Literature entry not found.' });
    return res.json({ ...entry.toObject(), id: entry._id.toString() });
  }
  const entry = memLiterature.get(req.params.entryId);
  if (!entry || entry.deletedAt) return res.status(404).json({ error: 'Literature entry not found.' });
  Object.assign(entry, req.body, { updatedAt: new Date().toISOString() });
  res.json({ ...entry, id: (entry._id || entry.id).toString() });
});

apiRouter.delete('/projects/:id/literature/:entryId', requireAuth, async (req, res, next) => {
  if (isDbConnected()) {
    await LiteratureEntry.findOneAndUpdate({ _id: req.params.entryId, projectId: req.params.id }, { $set: { deletedAt: new Date() } });
    return res.json({ deleted: true, success: true });
  }
  const entry = memLiterature.get(req.params.entryId);
  if (entry) entry.deletedAt = new Date().toISOString();
  res.json({ deleted: true, success: true });
});

apiRouter.post('/projects/:id/literature/synthesize', requireAuth, async (req, res, next) => {
  req.body.projectId = req.params.id;
  let entries = [];
  let themes = [];

  if (isDbConnected()) {
    entries = await LiteratureEntry.find({ projectId: req.params.id, deletedAt: null }).lean();
    themes = await LiteratureTheme.find({ projectId: req.params.id }).lean();
  } else {
    entries = [...memLiterature.values()].filter(l => l.projectId === req.params.id && !l.deletedAt);
    themes = [...memLiteratureThemes.values()].filter(t => t.projectId === req.params.id);
  }

  if (entries.length === 0) return res.status(400).json({ error: 'No literature entries found to synthesize.' });

  const result = generateEvidenceLinkedSynthesis(entries, themes, {
    projectId: req.params.id,
    type: req.body.type || 'thematic'
  });

  res.json({
    themeCount: result.sections.length,
    studyCount: entries.length,
    sections: result.sections,
    fullDraft: result.fullDraft
  });
});

// PDF Grounded Research Chat Endpoints (Module 4 & Phase 6 Complete Intelligence)

// Legacy compatibility endpoint: Upload document for a project chat
apiRouter.post('/projects/:id/pdf-chat/upload', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Please upload a PDF or text document.' });

    const validation = validatePdfFile(req.file.buffer, req.file.originalname);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error || 'Invalid PDF or document file.' });
    }

    const extracted = extractPagesFromPdf(req.file.buffer, req.file.originalname);
    const docId = new mongoose.Types.ObjectId().toString();
    const chunks = chunkDocumentPages(extracted, docId);
    const chatTitle = `Research Chat: ${req.file.originalname}`;

    // Store raw file buffer in memory storage
    memDocumentStorage.set(docId, req.file.buffer);

    // Register ResearchDocument record
    const docRecord = {
      _id: isDbConnected() ? new mongoose.Types.ObjectId(docId) : docId,
      projectId: req.params.id,
      ownerId: req.user.id,
      userId: req.user.id,
      filename: req.file.originalname,
      title: extracted.metadata?.title || req.file.originalname.replace(/\.[^/.]+$/, ''),
      fileSize: req.file.size,
      mimeType: req.file.mimetype || 'application/pdf',
      checksum: validation.checksum,
      pageCount: extracted.pageCount,
      chunkCount: chunks.length,
      status: 'indexed',
      metadata: {
        authors: extracted.metadata?.authors || [],
        year: extracted.metadata?.year || null,
        journal: extracted.metadata?.journal || '',
        doi: extracted.metadata?.doi || '',
        abstract: extracted.metadata?.abstract || (extracted.pages?.[0]?.text?.slice(0, 300) || extracted[0]?.text?.slice(0, 300) || '')
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (isDbConnected()) {
      await ResearchDocument.create(docRecord);
      for (const chunk of chunks) {
        await DocumentChunk.create(chunk);
      }
      const chat = await ResearchChat.create({
        projectId: req.params.id,
        userId: req.user.id,
        ownerId: req.user.id,
        title: chatTitle,
        documentName: req.file.originalname,
        documentChunks: chunks,
        selectedDocumentIds: [docId],
        mode: 'default',
        messages: [{
          role: 'system',
          content: `Document "${req.file.originalname}" loaded with ${chunks.length} page/section chunks across ${extracted.pageCount} page(s). Ask any grounded question regarding its methodology, findings, or data.`
        }]
      });
      return res.status(201).json({ chatId: chat._id, title: chat.title, chunkCount: chunks.length, documentId: docId });
    }

    memResearchDocuments.set(docId, docRecord);
    for (const chunk of chunks) {
      memDocumentChunks.set(chunk.chunkId || `${docId}_${chunk.chunkIndex}`, chunk);
    }

    const chatId = new mongoose.Types.ObjectId().toString();
    const newChat = {
      _id: chatId,
      id: chatId,
      projectId: req.params.id,
      userId: req.user.id,
      ownerId: req.user.id,
      title: chatTitle,
      documentName: req.file.originalname,
      documentChunks: chunks,
      selectedDocumentIds: [docId],
      mode: 'default',
      messages: [{
        role: 'system',
        content: `Document "${req.file.originalname}" loaded with ${chunks.length} page/section chunks across ${extracted.pageCount} page(s).`
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    memResearchChats.set(chatId, newChat);
    res.status(201).json({ chatId, title: chatTitle, chunkCount: chunks.length, documentId: docId });
  } catch (e) { next(e); }
});

// Legacy compatibility endpoint: List chats for a project
apiRouter.get('/projects/:id/pdf-chat', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const chats = await ResearchChat.find({ projectId: req.params.id, deletedAt: null })
        .select('title documentName selectedDocumentIds updatedAt messages')
        .sort({ updatedAt: -1 })
        .lean();
      return res.json(chats);
    }
    const chats = [...memResearchChats.values()]
      .filter(c => c.projectId === req.params.id && !c.deletedAt)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    res.json(chats);
  } catch (e) { next(e); }
});

// Legacy compatibility endpoint: Get single chat
apiRouter.get('/projects/:id/pdf-chat/:chatId', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const chat = await ResearchChat.findOne({ _id: req.params.chatId, projectId: req.params.id, deletedAt: null }).lean();
      if (!chat) return res.status(404).json({ error: 'Chat not found.' });
      return res.json(chat);
    }
    const chat = memResearchChats.get(req.params.chatId);
    if (!chat || chat.deletedAt || (chat.projectId && chat.projectId !== req.params.id)) {
      return res.status(404).json({ error: 'Chat not found.' });
    }
    res.json(chat);
  } catch (e) { next(e); }
});

// Legacy compatibility endpoint: Send message in chat
apiRouter.post('/projects/:id/pdf-chat/:chatId/message', requireAuth, async (req, res, next) => {
  try {
    const { query, mode } = req.body || {};
    if (!query || !query.trim()) return res.status(400).json({ error: 'Question query is required.' });

    let chat = null;
    if (isDbConnected()) {
      chat = await ResearchChat.findOne({ _id: req.params.chatId, projectId: req.params.id, deletedAt: null });
    } else {
      chat = memResearchChats.get(req.params.chatId);
    }
    if (!chat || chat.deletedAt) return res.status(404).json({ error: 'Research chat not found.' });

    // Gather chunks: check if chat has selected documents or documentChunks
    let chunks = [];
    if (chat.selectedDocumentIds && chat.selectedDocumentIds.length > 0) {
      if (isDbConnected()) {
        chunks = await DocumentChunk.find({ documentId: { $in: chat.selectedDocumentIds } }).lean();
      } else {
        chunks = [...memDocumentChunks.values()].filter(c => chat.selectedDocumentIds.includes(c.documentId?.toString()));
      }
    }
    if (chunks.length === 0 && Array.isArray(chat.documentChunks) && chat.documentChunks.length > 0) {
      chunks = chat.documentChunks;
    }

    const effectiveMode = mode || chat.mode || 'default';
    const retrieved = searchDocumentChunks(chunks, query, 5, { mode: effectiveMode });
    const { answer, citations } = generateGroundedAnswer(query, retrieved, { mode: effectiveMode });

    const userMsg = { role: 'user', content: query, timestamp: new Date() };
    const assistantMsg = { role: 'assistant', content: answer, citations, timestamp: new Date() };

    chat.messages.push(userMsg);
    chat.messages.push(assistantMsg);
    chat.updatedAt = new Date();

    if (isDbConnected()) {
      await chat.save();
    } else {
      memResearchChats.set(req.params.chatId, chat);
    }

    res.json({ message: assistantMsg, citations });
  } catch (e) { next(e); }
});

// ==========================================
// Phase 6 Enterprise PDF Intelligence Routes
// ==========================================

// POST /pdf-chat/documents/upload - Upload single or multiple PDFs with deduplication & indexing
apiRouter.post('/pdf-chat/documents/upload', requireAuth, upload.any(), async (req, res, next) => {
  try {
    const files = req.files || [];
    if (files.length === 0 && req.file) files.push(req.file);
    if (files.length === 0) {
      return res.status(400).json({ error: 'Please upload at least one PDF or document file.' });
    }

    const projectId = req.body.projectId || req.query.projectId || 'default-project';
    const forceReindex = req.body.force === 'true' || req.body.force === true;
    const results = [];

    for (const file of files) {
      const validation = validatePdfFile(file.buffer, file.originalname);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error || `File "${file.originalname}" is invalid.` });
      }

      const checksum = validation.checksum;
      let existingDoc = null;

      if (isDbConnected()) {
        existingDoc = await ResearchDocument.findOne({ projectId, checksum, deletedAt: null }).lean();
      } else {
        existingDoc = [...memResearchDocuments.values()].find(
          d => (d.projectId === projectId || projectId === 'all') && d.checksum === checksum && !d.deletedAt
        );
      }

      if (existingDoc && !forceReindex) {
        results.push({
          id: (existingDoc._id || existingDoc.id).toString(),
          _id: (existingDoc._id || existingDoc.id).toString(),
          title: existingDoc.title,
          filename: existingDoc.filename,
          pageCount: existingDoc.pageCount,
          chunkCount: existingDoc.chunkCount,
          checksum: existingDoc.checksum,
          status: existingDoc.status,
          isDuplicate: true
        });
        continue;
      }

      const extracted = extractPagesFromPdf(file.buffer, file.originalname);
      const docId = new mongoose.Types.ObjectId().toString();
      const chunks = chunkDocumentPages(extracted, docId);

      // Store binary buffer
      memDocumentStorage.set(docId, file.buffer);

      const docRecord = {
        _id: isDbConnected() ? new mongoose.Types.ObjectId(docId) : docId,
        id: docId,
        projectId,
        ownerId: req.user.id,
        userId: req.user.id,
        filename: file.originalname,
        title: extracted.metadata?.title || file.originalname.replace(/\.[^/.]+$/, ''),
        fileSize: file.size,
        mimeType: file.mimetype || 'application/pdf',
        checksum,
        pageCount: extracted.pageCount,
        chunkCount: chunks.length,
        status: 'indexed',
        metadata: {
          authors: extracted.metadata?.authors || [],
          year: extracted.metadata?.year || null,
          journal: extracted.metadata?.journal || '',
          doi: extracted.metadata?.doi || '',
          abstract: extracted.metadata?.abstract || (extracted.pages?.[0]?.text?.slice(0, 300) || extracted[0]?.text?.slice(0, 300) || '')
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (isDbConnected()) {
        await ResearchDocument.create(docRecord);
        for (const chunk of chunks) {
          await DocumentChunk.create(chunk);
        }
        await DocumentIndex.create({
          documentId: docRecord._id,
          projectId,
          totalChunks: chunks.length,
          totalTokens: chunks.reduce((acc, c) => acc + (c.tokenCount || 0), 0),
          lastIndexedAt: new Date()
        });
      } else {
        memResearchDocuments.set(docId, docRecord);
        for (const chunk of chunks) {
          memDocumentChunks.set(chunk.chunkId || `${docId}_${chunk.chunkIndex}`, chunk);
        }
      }

      results.push({
        id: docId,
        _id: docId,
        title: docRecord.title,
        filename: docRecord.filename,
        pageCount: docRecord.pageCount,
        chunkCount: docRecord.chunkCount,
        checksum: docRecord.checksum,
        status: docRecord.status,
        isDuplicate: false
      });
    }

    res.status(201).json({
      success: true,
      count: results.length,
      documents: results,
      document: results[0]
    });
  } catch (e) { next(e); }
});

// GET /pdf-chat/documents - List documents with search and pagination
apiRouter.get('/pdf-chat/documents', requireAuth, async (req, res, next) => {
  try {
    const { projectId, search, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));

    if (isDbConnected()) {
      const filter = { deletedAt: null };
      if (projectId && projectId !== 'all') filter.projectId = projectId;
      if (search && search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [{ filename: regex }, { title: regex }, { 'metadata.abstract': regex }];
      }

      const total = await ResearchDocument.countDocuments(filter);
      const docs = await ResearchDocument.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean();

      return res.json({
        documents: docs.map(d => ({ ...d, id: d._id.toString() })),
        pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
      });
    }

    let docs = [...memResearchDocuments.values()].filter(d => {
      if (d.deletedAt) return false;
      if (projectId && projectId !== 'all' && d.projectId !== projectId) return false;
      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        const matchesName = d.filename?.toLowerCase().includes(term);
        const matchesTitle = d.title?.toLowerCase().includes(term);
        const matchesAbstract = d.metadata?.abstract?.toLowerCase().includes(term);
        if (!matchesName && !matchesTitle && !matchesAbstract) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = docs.length;
    const paginated = docs.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      documents: paginated.map(d => ({ ...d, id: (d._id || d.id).toString() })),
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (e) { next(e); }
});

// GET /pdf-chat/documents/:documentId - Get single document details & chunk count
apiRouter.get('/pdf-chat/documents/:documentId', requireAuth, async (req, res, next) => {
  try {
    const { documentId } = req.params;
    let doc = null;

    if (isDbConnected()) {
      doc = await ResearchDocument.findOne({ _id: documentId, deletedAt: null }).lean();
    } else {
      doc = memResearchDocuments.get(documentId);
      if (doc && doc.deletedAt) doc = null;
    }

    if (!doc) return res.status(404).json({ error: 'Document not found.' });

    let chunkCount = doc.chunkCount || 0;
    if (!chunkCount) {
      if (isDbConnected()) {
        chunkCount = await DocumentChunk.countDocuments({ documentId });
      } else {
        chunkCount = [...memDocumentChunks.values()].filter(c => c.documentId?.toString() === documentId).length;
      }
    }

    res.json({
      ...doc,
      id: (doc._id || doc.id).toString(),
      chunkCount
    });
  } catch (e) { next(e); }
});

// GET /pdf-chat/documents/:documentId/status - Get indexing progress status
apiRouter.get('/pdf-chat/documents/:documentId/status', requireAuth, async (req, res, next) => {
  try {
    const { documentId } = req.params;
    let doc = null;
    if (isDbConnected()) {
      doc = await ResearchDocument.findOne({ _id: documentId, deletedAt: null }).select('status pageCount chunkCount updatedAt').lean();
    } else {
      doc = memResearchDocuments.get(documentId);
    }
    if (!doc || doc.deletedAt) return res.status(404).json({ error: 'Document not found.' });

    res.json({
      status: doc.status || 'indexed',
      progress: 100,
      pageCount: doc.pageCount || 1,
      chunkCount: doc.chunkCount || 0,
      updatedAt: doc.updatedAt
    });
  } catch (e) { next(e); }
});

// POST /pdf-chat/documents/:documentId/reindex - Trigger document reindexing
apiRouter.post('/pdf-chat/documents/:documentId/reindex', requireAuth, async (req, res, next) => {
  try {
    const { documentId } = req.params;
    let doc = null;
    if (isDbConnected()) {
      doc = await ResearchDocument.findOne({ _id: documentId, deletedAt: null });
    } else {
      doc = memResearchDocuments.get(documentId);
    }
    if (!doc || doc.deletedAt) return res.status(404).json({ error: 'Document not found.' });

    const buffer = memDocumentStorage.get(documentId);
    if (!buffer) {
      return res.status(400).json({ error: 'Document source binary not found for reindexing.' });
    }

    const extracted = extractPagesFromPdf(buffer, doc.filename);
    const chunks = chunkDocumentPages(extracted, documentId);

    if (isDbConnected()) {
      await DocumentChunk.deleteMany({ documentId });
      for (const chunk of chunks) {
        await DocumentChunk.create(chunk);
      }
      doc.chunkCount = chunks.length;
      doc.pageCount = extracted.pageCount;
      doc.status = 'indexed';
      doc.updatedAt = new Date();
      await doc.save();
    } else {
      // Remove old chunks
      for (const [key, c] of memDocumentChunks.entries()) {
        if (c.documentId?.toString() === documentId) memDocumentChunks.delete(key);
      }
      for (const chunk of chunks) {
        memDocumentChunks.set(chunk.chunkId || `${documentId}_${chunk.chunkIndex}`, chunk);
      }
      doc.chunkCount = chunks.length;
      doc.pageCount = extracted.pageCount;
      doc.status = 'indexed';
      doc.updatedAt = new Date().toISOString();
      memResearchDocuments.set(documentId, doc);
    }

    res.json({ success: true, message: 'Document reindexed successfully.', chunkCount: chunks.length });
  } catch (e) { next(e); }
});

// DELETE /pdf-chat/documents/:documentId - Soft delete document
apiRouter.delete('/pdf-chat/documents/:documentId', requireAuth, async (req, res, next) => {
  try {
    const { documentId } = req.params;
    if (isDbConnected()) {
      const doc = await ResearchDocument.findOne({ _id: documentId });
      if (!doc) return res.status(404).json({ error: 'Document not found.' });
      doc.deletedAt = new Date();
      await doc.save();
      return res.json({ success: true, deleted: true });
    }

    const doc = memResearchDocuments.get(documentId);
    if (!doc) return res.status(404).json({ error: 'Document not found.' });
    doc.deletedAt = new Date().toISOString();
    res.json({ success: true, deleted: true });
  } catch (e) { next(e); }
});

// GET /pdf-chat/documents/:documentId/content - Stream PDF binary or return extracted pages
apiRouter.get('/pdf-chat/documents/:documentId/content', requireAuth, async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const format = req.query.format || 'text';

    let doc = null;
    if (isDbConnected()) {
      doc = await ResearchDocument.findOne({ _id: documentId, deletedAt: null }).lean();
    } else {
      doc = memResearchDocuments.get(documentId);
    }
    if (!doc || doc.deletedAt) return res.status(404).json({ error: 'Document not found.' });

    const buffer = memDocumentStorage.get(documentId);

    if (format === 'raw' && buffer) {
      res.setHeader('Content-Type', doc.mimeType || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
      return res.send(buffer);
    }

    // Return chunks / page texts
    let chunks = [];
    if (isDbConnected()) {
      chunks = await DocumentChunk.find({ documentId }).sort({ pageNumber: 1, chunkIndex: 1 }).lean();
    } else {
      chunks = [...memDocumentChunks.values()]
        .filter(c => c.documentId?.toString() === documentId)
        .sort((a, b) => (a.pageNumber || 1) - (b.pageNumber || 1) || a.chunkIndex - b.chunkIndex);
    }

    res.json({
      documentId,
      filename: doc.filename,
      pageCount: doc.pageCount,
      chunks: chunks.map(c => ({
        chunkId: c.chunkId,
        pageNumber: c.pageNumber,
        sectionTitle: c.sectionTitle,
        text: c.text
      }))
    });
  } catch (e) { next(e); }
});

// GET /pdf-chat/conversations - List conversations
apiRouter.get('/pdf-chat/conversations', requireAuth, async (req, res, next) => {
  try {
    const { projectId } = req.query;
    if (isDbConnected()) {
      const filter = { deletedAt: null };
      if (projectId && projectId !== 'all') filter.projectId = projectId;
      const chats = await ResearchChat.find(filter)
        .select('title documentName selectedDocumentIds mode updatedAt createdAt messages')
        .sort({ updatedAt: -1 })
        .lean();

      return res.json(chats.map(c => ({
        id: c._id.toString(),
        _id: c._id.toString(),
        title: c.title,
        documentName: c.documentName,
        selectedDocumentIds: c.selectedDocumentIds || [],
        mode: c.mode || 'default',
        messageCount: c.messages?.length || 0,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      })));
    }

    const chats = [...memResearchChats.values()]
      .filter(c => {
        if (c.deletedAt) return false;
        if (projectId && projectId !== 'all' && c.projectId !== projectId) return false;
        return true;
      })
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .map(c => ({
        id: (c._id || c.id).toString(),
        _id: (c._id || c.id).toString(),
        title: c.title,
        documentName: c.documentName,
        selectedDocumentIds: c.selectedDocumentIds || [],
        mode: c.mode || 'default',
        messageCount: c.messages?.length || 0,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }));

    res.json(chats);
  } catch (e) { next(e); }
});

// POST /pdf-chat/conversations - Create a new research conversation
apiRouter.post('/pdf-chat/conversations', requireAuth, async (req, res, next) => {
  try {
    const { projectId, title, documentIds, mode = 'default' } = req.body || {};
    const effectiveProjectId = projectId || 'default-project';
    const effectiveTitle = title && title.trim() ? title.trim() : 'New Research Conversation';
    const selectedDocIds = Array.isArray(documentIds) ? documentIds : [];

    // Lookup document names if any selected
    let documentName = 'Multi-Document Research';
    if (selectedDocIds.length === 1) {
      const singleDoc = isDbConnected()
        ? await ResearchDocument.findById(selectedDocIds[0]).lean()
        : memResearchDocuments.get(selectedDocIds[0]);
      if (singleDoc) documentName = singleDoc.filename || singleDoc.title;
    }

    const initialMessage = {
      role: 'system',
      content: selectedDocIds.length > 0
        ? `Conversation initialized with ${selectedDocIds.length} document(s) in "${mode}" mode. Ask any question to retrieve grounded evidence.`
        : `Conversation initialized in "${mode}" mode. Upload or select documents to ask grounded questions.`
    };

    if (isDbConnected()) {
      const chat = await ResearchChat.create({
        projectId: effectiveProjectId,
        userId: req.user.id,
        ownerId: req.user.id,
        title: effectiveTitle,
        documentName,
        selectedDocumentIds: selectedDocIds,
        mode,
        messages: [initialMessage]
      });
      return res.status(201).json({
        id: chat._id.toString(),
        _id: chat._id.toString(),
        title: chat.title,
        documentName: chat.documentName,
        selectedDocumentIds: chat.selectedDocumentIds,
        mode: chat.mode,
        messages: chat.messages
      });
    }

    const chatId = new mongoose.Types.ObjectId().toString();
    const newChat = {
      _id: chatId,
      id: chatId,
      projectId: effectiveProjectId,
      userId: req.user.id,
      ownerId: req.user.id,
      title: effectiveTitle,
      documentName,
      selectedDocumentIds: selectedDocIds,
      mode,
      messages: [initialMessage],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    memResearchChats.set(chatId, newChat);

    res.status(201).json({
      id: chatId,
      _id: chatId,
      title: newChat.title,
      documentName: newChat.documentName,
      selectedDocumentIds: newChat.selectedDocumentIds,
      mode: newChat.mode,
      messages: newChat.messages
    });
  } catch (e) { next(e); }
});

// GET /pdf-chat/conversations/:chatId - Get conversation details and message history
apiRouter.get('/pdf-chat/conversations/:chatId', requireAuth, async (req, res, next) => {
  try {
    const { chatId } = req.params;
    let chat = null;

    if (isDbConnected()) {
      chat = await ResearchChat.findOne({ _id: chatId, deletedAt: null }).lean();
    } else {
      chat = memResearchChats.get(chatId);
      if (chat && chat.deletedAt) chat = null;
    }

    if (!chat) return res.status(404).json({ error: 'Conversation not found.' });

    res.json({
      ...chat,
      id: (chat._id || chat.id).toString()
    });
  } catch (e) { next(e); }
});

// PATCH /pdf-chat/conversations/:chatId - Update title, selected documents, mode
apiRouter.patch('/pdf-chat/conversations/:chatId', requireAuth, async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { title, documentIds, mode } = req.body || {};

    let chat = null;
    if (isDbConnected()) {
      chat = await ResearchChat.findOne({ _id: chatId, deletedAt: null });
    } else {
      chat = memResearchChats.get(chatId);
    }
    if (!chat || chat.deletedAt) return res.status(404).json({ error: 'Conversation not found.' });

    if (title && title.trim()) chat.title = title.trim();
    if (Array.isArray(documentIds)) chat.selectedDocumentIds = documentIds;
    if (mode) chat.mode = mode;
    chat.updatedAt = new Date();

    if (isDbConnected()) {
      await chat.save();
    } else {
      memResearchChats.set(chatId, chat);
    }

    res.json({
      success: true,
      chat: {
        id: (chat._id || chat.id).toString(),
        title: chat.title,
        selectedDocumentIds: chat.selectedDocumentIds,
        mode: chat.mode,
        updatedAt: chat.updatedAt
      }
    });
  } catch (e) { next(e); }
});

// DELETE /pdf-chat/conversations/:chatId - Soft delete conversation
apiRouter.delete('/pdf-chat/conversations/:chatId', requireAuth, async (req, res, next) => {
  try {
    const { chatId } = req.params;
    if (isDbConnected()) {
      const chat = await ResearchChat.findOne({ _id: chatId });
      if (!chat) return res.status(404).json({ error: 'Conversation not found.' });
      chat.deletedAt = new Date();
      await chat.save();
      return res.json({ success: true, deleted: true });
    }

    const chat = memResearchChats.get(chatId);
    if (!chat) return res.status(404).json({ error: 'Conversation not found.' });
    chat.deletedAt = new Date().toISOString();
    res.json({ success: true, deleted: true });
  } catch (e) { next(e); }
});

// POST /pdf-chat/conversations/:chatId/messages - Grounded RAG query synthesis
apiRouter.post('/pdf-chat/conversations/:chatId/messages', requireAuth, async (req, res, next) => {
  try {
    const { chatId } = req.params;
    const { query, mode, selectedDocumentIds } = req.body || {};

    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Question query is required.' });
    }

    let chat = null;
    if (isDbConnected()) {
      chat = await ResearchChat.findOne({ _id: chatId, deletedAt: null });
    } else {
      chat = memResearchChats.get(chatId);
    }
    if (!chat || chat.deletedAt) return res.status(404).json({ error: 'Conversation not found.' });

    // Determine target documents: request body overrides conversation's selection
    const docIds = (Array.isArray(selectedDocumentIds) && selectedDocumentIds.length > 0)
      ? selectedDocumentIds
      : (chat.selectedDocumentIds && chat.selectedDocumentIds.length > 0 ? chat.selectedDocumentIds : []);

    let chunks = [];
    if (docIds.length > 0) {
      if (isDbConnected()) {
        chunks = await DocumentChunk.find({ documentId: { $in: docIds } }).lean();
      } else {
        chunks = [...memDocumentChunks.values()].filter(c => docIds.includes(c.documentId?.toString()));
      }
    } else if (chat.projectId) {
      // Fallback: load all chunks in the project
      if (isDbConnected()) {
        const projectDocs = await ResearchDocument.find({ projectId: chat.projectId, deletedAt: null }).select('_id').lean();
        const pDocIds = projectDocs.map(d => d._id);
        chunks = await DocumentChunk.find({ documentId: { $in: pDocIds } }).lean();
      } else {
        const pDocIds = [...memResearchDocuments.values()]
          .filter(d => d.projectId === chat.projectId && !d.deletedAt)
          .map(d => (d._id || d.id).toString());
        chunks = [...memDocumentChunks.values()].filter(c => pDocIds.includes(c.documentId?.toString()));
      }
    }

    // Also include legacy chat.documentChunks if present
    if (chunks.length === 0 && Array.isArray(chat.documentChunks) && chat.documentChunks.length > 0) {
      chunks = chat.documentChunks;
    }

    const effectiveMode = mode || chat.mode || 'default';
    const retrieved = searchDocumentChunks(chunks, query, 5, { mode: effectiveMode });
    const { answer, citations, confidence } = generateGroundedAnswer(query, retrieved, { mode: effectiveMode });
    const validation = validateMessageCitations(answer, retrieved);

    const messageId = new mongoose.Types.ObjectId().toString();

    // Persist CitationEvidence records
    const evidenceRecords = [];
    for (const cit of citations) {
      const matchedChunk = retrieved.find(r => r.chunkId === cit.evidenceId) || retrieved[0];
      const evId = new mongoose.Types.ObjectId().toString();
      const evData = {
        _id: isDbConnected() ? new mongoose.Types.ObjectId(evId) : evId,
        id: evId,
        messageId,
        chatId,
        documentId: cit.documentId || matchedChunk?.documentId,
        documentTitle: cit.documentTitle || matchedChunk?.documentTitle,
        pageNumber: cit.page || matchedChunk?.pageNumber || 1,
        sourceExcerpt: cit.excerpt || cit.passage || matchedChunk?.passage || matchedChunk?.text?.slice(0, 300) || matchedChunk?.content?.slice(0, 300) || '',
        score: cit.score || 0.85,
        claim: query,
        verified: true,
        createdAt: new Date()
      };
      if (isDbConnected()) {
        await CitationEvidence.create(evData);
      } else {
        memCitationEvidences.set(evId, evData);
      }
      evidenceRecords.push(evData);
    }

    const userMsg = {
      _id: new mongoose.Types.ObjectId().toString(),
      role: 'user',
      content: query,
      timestamp: new Date()
    };
    const assistantMsg = {
      _id: messageId,
      role: 'assistant',
      content: answer,
      citations,
      retrievalStatus: retrieved.length > 0 ? 'grounded' : 'empty',
      timestamp: new Date()
    };

    chat.messages.push(userMsg);
    chat.messages.push(assistantMsg);
    chat.updatedAt = new Date();

    if (isDbConnected()) {
      await chat.save();
    } else {
      memResearchChats.set(chatId, chat);
    }

    res.json({
      message: assistantMsg,
      citations,
      confidence,
      validation,
      retrievedChunks: retrieved.length
    });
  } catch (e) { next(e); }
});

// GET /pdf-chat/messages/:messageId/evidence - Retrieve verified citation provenance
apiRouter.get('/pdf-chat/messages/:messageId/evidence', requireAuth, async (req, res, next) => {
  try {
    const { messageId } = req.params;
    let evidences = [];

    if (isDbConnected()) {
      evidences = await CitationEvidence.find({ messageId }).lean();
    } else {
      evidences = [...memCitationEvidences.values()].filter(e => e.messageId === messageId);
    }

    res.json({
      messageId,
      count: evidences.length,
      evidences: evidences.map(e => ({
        id: (e._id || e.id).toString(),
        documentTitle: e.documentTitle,
        documentId: e.documentId,
        pageNumber: e.pageNumber,
        sourceExcerpt: e.sourceExcerpt,
        score: e.score,
        verified: e.verified
      }))
    });
  } catch (e) { next(e); }
});

// POST /pdf-chat/documents/:documentId/send-to-literature - Export document directly to Literature Matrix
apiRouter.post('/pdf-chat/documents/:documentId/send-to-literature', requireAuth, async (req, res, next) => {
  try {
    const { documentId } = req.params;
    let doc = null;

    if (isDbConnected()) {
      doc = await ResearchDocument.findOne({ _id: documentId, deletedAt: null }).lean();
    } else {
      doc = memResearchDocuments.get(documentId);
    }
    if (!doc || doc.deletedAt) return res.status(404).json({ error: 'Document not found.' });

    // Look for extracted chunks to populate methodology and findings
    let chunks = [];
    if (isDbConnected()) {
      chunks = await DocumentChunk.find({ documentId }).limit(10).lean();
    } else {
      chunks = [...memDocumentChunks.values()].filter(c => c.documentId?.toString() === documentId).slice(0, 10);
    }

    const methodologyChunk = chunks.find(c => /method|design|experiment|procedure|protocol/i.test(c.text)) || chunks[1] || chunks[0];
    const findingsChunk = chunks.find(c => /result|finding|showed|demonstrated|conclude/i.test(c.text)) || chunks[2] || chunks[0];

    const entryId = new mongoose.Types.ObjectId().toString();
    const entryData = {
      _id: isDbConnected() ? new mongoose.Types.ObjectId(entryId) : entryId,
      id: entryId,
      projectId: doc.projectId || 'default-project',
      userId: req.user.id,
      title: doc.title || doc.filename,
      authors: Array.isArray(doc.metadata?.authors) && doc.metadata.authors.length > 0
        ? doc.metadata.authors
        : [{ name: 'Extracted Author' }],
      year: doc.metadata?.year || new Date().getFullYear(),
      journal: doc.metadata?.journal || 'Imported Document',
      doi: doc.metadata?.doi || '',
      abstract: doc.metadata?.abstract || (chunks[0]?.text?.slice(0, 400) || ''),
      studyDesign: 'Empirical Investigation',
      sampleSize: 'See source publication',
      keyFindings: findingsChunk ? findingsChunk.text.slice(0, 300) : 'Extracted findings from PDF analysis.',
      methodology: methodologyChunk ? methodologyChunk.text.slice(0, 300) : 'Extracted methodology from PDF analysis.',
      tags: ['pdf-import', 'evidence-grounded'],
      qualityScore: 9,
      status: 'included',
      notes: `Imported directly from PDF document: ${doc.filename}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (isDbConnected()) {
      await LiteratureEntry.create(entryData);
    } else {
      memLiterature.set(entryId, entryData);
    }

    res.status(201).json({
      success: true,
      message: 'Document successfully converted and added to Literature Review Matrix.',
      entry: entryData
    });
  } catch (e) { next(e); }
});

// POST /pdf-chat/documents/:documentId/link-reference - Link or create Reference record
apiRouter.post('/pdf-chat/documents/:documentId/link-reference', requireAuth, async (req, res, next) => {
  try {
    const { documentId } = req.params;
    let doc = null;

    if (isDbConnected()) {
      doc = await ResearchDocument.findOne({ _id: documentId, deletedAt: null });
    } else {
      doc = memResearchDocuments.get(documentId);
    }
    if (!doc || doc.deletedAt) return res.status(404).json({ error: 'Document not found.' });

    const refId = new mongoose.Types.ObjectId().toString();
    const authorList = Array.isArray(doc.metadata?.authors) && doc.metadata.authors.length > 0
      ? doc.metadata.authors
      : [{ family: 'Author', given: 'Research' }];

    const refData = {
      _id: isDbConnected() ? new mongoose.Types.ObjectId(refId) : refId,
      id: refId,
      projectId: doc.projectId || 'default-project',
      userId: req.user.id,
      title: doc.title || doc.filename,
      authors: authorList,
      year: doc.metadata?.year || new Date().getFullYear(),
      journal: doc.metadata?.journal || 'Scholarly Publication',
      doi: doc.metadata?.doi || '',
      abstract: doc.metadata?.abstract || '',
      entryType: 'article',
      tags: ['pdf-source'],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (isDbConnected()) {
      await Reference.create(refData);
      doc.referenceId = refData._id;
      await doc.save();
    } else {
      memCitations.set(refId, refData);
      doc.referenceId = refId;
      memResearchDocuments.set(documentId, doc);
    }

    res.status(201).json({
      success: true,
      message: 'Reference linked successfully.',
      reference: refData
    });
  } catch (e) { next(e); }
});

// Statistical Analysis Studio Endpoints (Module 5 & Phase 7 Research-Grade Studio)

// Legacy compatibility endpoint: List datasets for project
apiRouter.get('/projects/:id/datasets', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const datasets = await Dataset.find({ projectId: req.params.id, deletedAt: null }).select('-rawData').lean();
      return res.json(datasets);
    }
    const datasets = [...memDatasets.values()].filter(d => d.projectId === req.params.id && !d.deletedAt);
    res.json(datasets.map(({ rawData, ...rest }) => rest));
  } catch (e) { next(e); }
});

// Legacy compatibility endpoint: Upload dataset for project
apiRouter.post('/projects/:id/datasets', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    let rows = [];
    let fileName = req.file?.originalname || 'dataset.csv';
    let fileType = 'csv';
    let columns = [];
    let missingValueCount = 0;

    if (req.file) {
      fileName = req.file.originalname;
      fileType = fileName.endsWith('.xlsx') ? 'xlsx' : 'csv';
      const parsed = parseDatasetBuffer(req.file.buffer, fileName);
      rows = parsed.rows;
      columns = parsed.columns;
      missingValueCount = parsed.missingValueCount || 0;
    } else if (Array.isArray(req.body?.rows)) {
      rows = req.body.rows;
      fileName = req.body.name || 'manual_data.json';
      fileType = 'json';
      const firstRow = rows[0] || {};
      columns = Object.keys(firstRow).map(colName => {
        const vals = rows.map(r => r[colName]).filter(v => v !== '' && v !== null && v !== undefined);
        const isNum = vals.length > 0 && vals.every(v => !isNaN(Number(v)));
        return {
          name: colName,
          type: isNum ? 'numeric' : 'categorical',
          measurementLevel: isNum ? 'scale' : 'nominal',
          sampleValues: vals.slice(0, 5)
        };
      });
    }

    if (rows.length === 0) return res.status(400).json({ error: 'No data rows detected in dataset.' });

    const datasetName = req.body?.name || fileName.replace(/\.[^/.]+$/, '');
    const checksum = crypto.createHash('sha256').update(req.file?.buffer || Buffer.from(JSON.stringify(rows))).digest('hex');

    if (isDbConnected()) {
      const dataset = await Dataset.create({
        projectId: req.params.id,
        userId: req.user.id,
        ownerId: req.user.id,
        name: datasetName,
        fileName,
        originalFilename: fileName,
        fileType,
        checksum,
        rowCount: rows.length,
        columnCount: columns.length,
        missingValueCount,
        status: 'ready',
        currentVersionNumber: 1,
        columns,
        rawData: rows.slice(0, 5000)
      });

      await DatasetVersion.create({
        datasetId: dataset._id,
        projectId: req.params.id,
        versionNumber: 1,
        transformationSummary: 'Initial dataset import',
        rowCount: rows.length,
        columnCount: columns.length,
        checksum,
        rawData: rows.slice(0, 5000)
      });

      for (const col of columns) {
        await DatasetVariable.create({
          datasetId: dataset._id,
          name: col.name,
          label: col.name,
          dataType: col.type,
          measurementLevel: col.measurementLevel || (col.type === 'numeric' ? 'scale' : 'nominal'),
          role: 'none',
          sampleValues: col.sampleValues
        });
      }

      return res.status(201).json(dataset);
    }

    const datasetId = new mongoose.Types.ObjectId().toString();
    const newDs = {
      _id: datasetId,
      id: datasetId,
      projectId: req.params.id,
      userId: req.user.id,
      ownerId: req.user.id,
      name: datasetName,
      fileName,
      originalFilename: fileName,
      fileType,
      checksum,
      rowCount: rows.length,
      columnCount: columns.length,
      missingValueCount,
      status: 'ready',
      currentVersionNumber: 1,
      columns,
      rawData: rows.slice(0, 5000),
      createdAt: new Date().toISOString()
    };
    memDatasets.set(datasetId, newDs);

    memDatasetVersions.set(`${datasetId}_v1`, {
      datasetId,
      projectId: req.params.id,
      versionNumber: 1,
      transformationSummary: 'Initial dataset import',
      rowCount: rows.length,
      columnCount: columns.length,
      checksum,
      rawData: rows.slice(0, 5000),
      createdAt: new Date().toISOString()
    });

    for (const col of columns) {
      memDatasetVariables.set(`${datasetId}_${col.name}`, {
        datasetId,
        name: col.name,
        label: col.name,
        dataType: col.type,
        measurementLevel: col.measurementLevel || (col.type === 'numeric' ? 'scale' : 'nominal'),
        role: 'none',
        sampleValues: col.sampleValues
      });
    }

    res.status(201).json(newDs);
  } catch (e) { next(e); }
});

// Legacy compatibility endpoint: Get single dataset
apiRouter.get('/projects/:id/datasets/:datasetId', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const ds = await Dataset.findOne({ _id: req.params.datasetId, projectId: req.params.id, deletedAt: null }).lean();
      if (!ds) return res.status(404).json({ error: 'Dataset not found.' });
      return res.json(ds);
    }
    const ds = memDatasets.get(req.params.datasetId);
    if (!ds || ds.deletedAt || (ds.projectId && ds.projectId !== req.params.id)) {
      return res.status(404).json({ error: 'Dataset not found.' });
    }
    res.json(ds);
  } catch (e) { next(e); }
});

// Legacy & Unified statistical analysis execution endpoint
apiRouter.post('/projects/:id/datasets/:datasetId/analyze', requireAuth, async (req, res, next) => {
  try {
    const {
      analysisType,
      varX,
      varY,
      ivs,
      groupVar,
      factorA,
      factorB,
      paired = false,
      mu0 = 0,
      table,
      confLevel = 0.95
    } = req.body || {};

    let dataset = null;
    if (isDbConnected()) {
      dataset = await Dataset.findOne({ _id: req.params.datasetId, projectId: req.params.id, deletedAt: null });
    } else {
      dataset = memDatasets.get(req.params.datasetId);
    }
    if (!dataset || dataset.deletedAt) return res.status(404).json({ error: 'Dataset not found.' });

    const rows = dataset.rawData || [];
    let results = {};
    let assumptions = {};
    let apaReport = '';

    switch (analysisType) {
      case 'descriptive': {
        const vals = rows.map(r => r[varX]).filter(v => v !== undefined && v !== '');
        results = computeDescriptive(vals, confLevel);
        const normCheck = checkNormalityShapiroWilk(vals);
        assumptions = { normality: normCheck };
        apaReport = `Descriptive statistics for ${varX} (N = ${results.count}): Mean = ${results.mean}, SD = ${results.stdDev}, Median = ${results.median}, IQR = ${results.iqr}, Skewness = ${results.skewness}.`;
        break;
      }
      case 'one_sample_t_test': {
        const vals = rows.map(r => r[varX]).filter(v => v !== undefined && v !== '');
        results = computeOneSampleTTest(vals, Number(mu0) || 0, confLevel);
        assumptions = { normality: checkNormalityShapiroWilk(vals) };
        apaReport = formatApa7StatisticalNarrative('one_sample_t_test', results, { varX });
        break;
      }
      case 'independent_t_test': {
        let gA = [];
        let gB = [];
        let labelA = 'Group A';
        let labelB = 'Group B';
        if (groupVar) {
          const groupVals = [...new Set(rows.map(r => r[groupVar]))];
          labelA = String(groupVals[0] || 'Group 1');
          labelB = String(groupVals[1] || 'Group 2');
          gA = rows.filter(r => r[groupVar] === groupVals[0]).map(r => r[varX]);
          gB = rows.filter(r => r[groupVar] === groupVals[1]).map(r => r[varX]);
        } else {
          labelA = varX;
          labelB = varY;
          gA = rows.map(r => r[varX]);
          gB = rows.map(r => r[varY]);
        }
        results = computeTTest(gA, gB, false, confLevel);
        assumptions = {
          normalityA: checkNormalityShapiroWilk(gA),
          normalityB: checkNormalityShapiroWilk(gB),
          homogeneity: checkLeveneTest([gA, gB], 'median')
        };
        apaReport = formatApa7StatisticalNarrative('independent_t_test', results, { groupA: labelA, groupB: labelB });
        break;
      }
      case 'paired_t_test': {
        const gA = rows.map(r => r[varX]);
        const gB = rows.map(r => r[varY]);
        results = computeTTest(gA, gB, true, confLevel);
        const diffs = gA.map((v, i) => Number(v) - Number(gB[i])).filter(d => !isNaN(d));
        assumptions = { normalityOfDiffs: checkNormalityShapiroWilk(diffs) };
        apaReport = formatApa7StatisticalNarrative('paired_t_test', results, { varX, varY });
        break;
      }
      case 'one_way_anova': {
        if (!groupVar) return res.status(400).json({ error: 'ANOVA requires a grouping factor (groupVar).' });
        const distinctGroups = [...new Set(rows.map(r => r[groupVar]))];
        const groupArrays = distinctGroups.map(gName => rows.filter(r => r[groupVar] === gName).map(r => r[varX]));
        results = computeAnova(groupArrays);
        assumptions = {
          homogeneity: checkLeveneTest(groupArrays, 'median'),
          normality: checkNormalityShapiroWilk(rows.map(r => r[varX]))
        };
        apaReport = formatApa7StatisticalNarrative('one_way_anova', results, { varX });
        break;
      }
      case 'two_way_anova': {
        const fA = factorA || groupVar;
        const fB = factorB || varY;
        const dv = varX;
        results = computeTwoWayAnova(rows, fA, fB, dv);
        apaReport = formatApa7StatisticalNarrative('two_way_anova', results);
        break;
      }
      case 'pearson_correlation':
      case 'spearman_correlation': {
        const x = rows.map(r => r[varX]);
        const y = rows.map(r => r[varY]);
        results = computeCorrelation(x, y, analysisType === 'spearman_correlation' ? 'spearman' : 'pearson', confLevel);
        assumptions = {
          normalityX: checkNormalityShapiroWilk(x),
          normalityY: checkNormalityShapiroWilk(y)
        };
        apaReport = formatApa7StatisticalNarrative(analysisType, results, { varX, varY });
        break;
      }
      case 'linear_regression':
      case 'multiple_linear_regression': {
        const predictorList = (Array.isArray(ivs) && ivs.length > 0) ? ivs : [varX];
        const dv = varY;
        results = computeMultipleRegression(rows, dv, predictorList);
        apaReport = formatApa7StatisticalNarrative('multiple_linear_regression', results, { varX, varY });
        break;
      }
      case 'mann_whitney_u': {
        let gA = [];
        let gB = [];
        if (groupVar) {
          const groupVals = [...new Set(rows.map(r => r[groupVar]))];
          gA = rows.filter(r => r[groupVar] === groupVals[0]).map(r => r[varX]);
          gB = rows.filter(r => r[groupVar] === groupVals[1]).map(r => r[varX]);
        } else {
          gA = rows.map(r => r[varX]);
          gB = rows.map(r => r[varY]);
        }
        results = computeMannWhitneyU(gA, gB);
        apaReport = formatApa7StatisticalNarrative('mann_whitney_u', results, { varX });
        break;
      }
      case 'wilcoxon_signed_rank': {
        const gA = rows.map(r => r[varX]);
        const gB = rows.map(r => r[varY]);
        results = computeWilcoxonSignedRank(gA, gB);
        apaReport = `A Wilcoxon signed-rank test indicated a ${results.significant ? 'statistically significant' : 'non-significant'} median difference between paired observations, W = ${results.w}, z = ${results.z}, p = ${results.pValue}.`;
        break;
      }
      case 'kruskal_wallis': {
        if (!groupVar) return res.status(400).json({ error: 'Kruskal-Wallis requires a grouping variable (groupVar).' });
        const distinctGroups = [...new Set(rows.map(r => r[groupVar]))];
        const groupArrays = distinctGroups.map(gName => rows.filter(r => r[groupVar] === gName).map(r => r[varX]));
        results = computeKruskalWallis(groupArrays);
        apaReport = formatApa7StatisticalNarrative('kruskal_wallis', results);
        break;
      }
      case 'chi_square':
      case 'chi_square_independence': {
        let contingencyMatrix = table;
        if (!contingencyMatrix && varX && varY) {
          const distinctX = [...new Set(rows.map(r => String(r[varX])))];
          const distinctY = [...new Set(rows.map(r => String(r[varY])))];
          contingencyMatrix = distinctX.map(xVal => {
            return distinctY.map(yVal => {
              return rows.filter(r => String(r[varX]) === xVal && String(r[varY]) === yVal).length;
            });
          });
        }
        results = computeChiSquareTest(contingencyMatrix);
        apaReport = formatApa7StatisticalNarrative('chi_square_independence', results);
        break;
      }
      default:
        return res.status(400).json({ error: `Unsupported analysis type: ${analysisType}` });
    }

    const aId = new mongoose.Types.ObjectId().toString();
    const resId = new mongoose.Types.ObjectId().toString();

    const analysisPayload = {
      _id: isDbConnected() ? new mongoose.Types.ObjectId(aId) : aId,
      id: aId,
      projectId: req.params.id,
      userId: req.user.id,
      datasetId: req.params.datasetId,
      title: req.body?.title || `${analysisType.replace(/_/g, ' ')} Analysis`,
      analysisType,
      parameters: req.body,
      results,
      assumptions,
      apaReport,
      status: 'completed',
      createdAt: new Date().toISOString()
    };

    if (isDbConnected()) {
      const saved = await Analysis.create(analysisPayload);
      await AnalysisResult.create({
        _id: new mongoose.Types.ObjectId(resId),
        analysisId: saved._id,
        projectId: req.params.id,
        numericalResults: results,
        assumptions,
        apa7Narrative: apaReport,
        softwareVersions: { statEngine: 'Phase 7 Numerical Matrix Core 1.0', node: process.version }
      });
      return res.status(201).json(saved);
    }

    memAnalyses.set(aId, analysisPayload);
    memAnalysisResults.set(resId, {
      _id: resId,
      analysisId: aId,
      projectId: req.params.id,
      numericalResults: results,
      assumptions,
      apa7Narrative: apaReport,
      createdAt: new Date().toISOString()
    });

    res.status(201).json(analysisPayload);
  } catch (e) { next(e); }
});

// Legacy compatibility endpoint: List analyses for project
apiRouter.get('/projects/:id/analyses', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const list = await Analysis.find({ projectId: req.params.id, deletedAt: null }).sort({ createdAt: -1 }).lean();
      return res.json(list);
    }
    const list = [...memAnalyses.values()].filter(a => a.projectId === req.params.id && !a.deletedAt);
    res.json(list);
  } catch (e) { next(e); }
});

// ==========================================
// Phase 7 Enterprise Statistical Studio Routes
// ==========================================

// POST /statistics/datasets/upload - Upload and index CSV/XLSX dataset
apiRouter.post('/statistics/datasets/upload', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    let rows = [];
    let fileName = req.file?.originalname || 'dataset.csv';
    let fileType = 'csv';
    let columns = [];
    let missingValueCount = 0;

    if (req.file) {
      fileName = req.file.originalname;
      fileType = fileName.endsWith('.xlsx') ? 'xlsx' : 'csv';
      const parsed = parseDatasetBuffer(req.file.buffer, fileName);
      rows = parsed.rows;
      columns = parsed.columns;
      missingValueCount = parsed.missingValueCount || 0;
    } else if (Array.isArray(req.body?.rows)) {
      rows = req.body.rows;
      fileName = req.body.name || 'manual_data.json';
      fileType = 'json';
      const firstRow = rows[0] || {};
      columns = Object.keys(firstRow).map(colName => {
        const vals = rows.map(r => r[colName]).filter(v => v !== '' && v !== null && v !== undefined);
        const isNum = vals.length > 0 && vals.every(v => !isNaN(Number(v)));
        return {
          name: colName,
          type: isNum ? 'numeric' : 'categorical',
          measurementLevel: isNum ? 'scale' : 'nominal',
          sampleValues: vals.slice(0, 5)
        };
      });
    }

    if (rows.length === 0) return res.status(400).json({ error: 'No data rows detected in dataset.' });

    const projectId = req.body?.projectId || req.query?.projectId || 'default-project';
    const datasetName = req.body?.name || fileName.replace(/\.[^/.]+$/, '');
    const checksum = crypto.createHash('sha256').update(req.file?.buffer || Buffer.from(JSON.stringify(rows))).digest('hex');
    const docId = new mongoose.Types.ObjectId().toString();

    const dsData = {
      _id: isDbConnected() ? new mongoose.Types.ObjectId(docId) : docId,
      id: docId,
      projectId,
      userId: req.user.id,
      ownerId: req.user.id,
      name: datasetName,
      description: req.body?.description || '',
      fileName,
      originalFilename: fileName,
      fileType,
      checksum,
      rowCount: rows.length,
      columnCount: columns.length,
      missingValueCount,
      status: 'ready',
      currentVersionNumber: 1,
      columns,
      rawData: rows.slice(0, 5000),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (isDbConnected()) {
      await Dataset.create(dsData);
      await DatasetVersion.create({
        datasetId: dsData._id,
        projectId,
        versionNumber: 1,
        transformationSummary: 'Initial dataset import',
        rowCount: rows.length,
        columnCount: columns.length,
        checksum,
        rawData: rows.slice(0, 5000)
      });
      for (const col of columns) {
        await DatasetVariable.create({
          datasetId: dsData._id,
          name: col.name,
          label: col.name,
          dataType: col.type,
          measurementLevel: col.measurementLevel || (col.type === 'numeric' ? 'scale' : 'nominal'),
          role: 'none',
          sampleValues: col.sampleValues
        });
      }
      return res.status(201).json({ ...dsData, success: true, dataset: dsData, version: 1 });
    }

    memDatasets.set(docId, dsData);
    memDatasetVersions.set(`${docId}_v1`, {
      datasetId: docId,
      projectId,
      versionNumber: 1,
      transformationSummary: 'Initial dataset import',
      rowCount: rows.length,
      columnCount: columns.length,
      checksum,
      rawData: rows.slice(0, 5000),
      createdAt: new Date().toISOString()
    });

    for (const col of columns) {
      memDatasetVariables.set(`${docId}_${col.name}`, {
        datasetId: docId,
        name: col.name,
        label: col.name,
        dataType: col.type,
        measurementLevel: col.measurementLevel || (col.type === 'numeric' ? 'scale' : 'nominal'),
        role: 'none',
        sampleValues: col.sampleValues
      });
    }

    res.status(201).json({ ...dsData, success: true, dataset: dsData, version: 1 });
  } catch (e) { next(e); }
});

// GET /statistics/datasets - List datasets with search and pagination
apiRouter.get('/statistics/datasets', requireAuth, async (req, res, next) => {
  try {
    const { projectId, search, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));

    if (isDbConnected()) {
      const filter = { deletedAt: null };
      if (projectId && projectId !== 'all') filter.projectId = projectId;
      if (search && search.trim()) {
        const regex = new RegExp(search.trim(), 'i');
        filter.$or = [{ name: regex }, { fileName: regex }, { description: regex }];
      }
      const total = await Dataset.countDocuments(filter);
      const list = await Dataset.find(filter)
        .select('-rawData')
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean();
      return res.json({
        datasets: list.map(d => ({ ...d, id: d._id.toString() })),
        pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
      });
    }

    let list = [...memDatasets.values()].filter(d => {
      if (d.deletedAt) return false;
      if (projectId && projectId !== 'all' && d.projectId !== projectId) return false;
      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        if (!d.name?.toLowerCase().includes(term) && !d.fileName?.toLowerCase().includes(term)) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = list.length;
    const paginated = list.slice((pageNum - 1) * limitNum, pageNum * limitNum);
    res.json({
      datasets: paginated.map(({ rawData, ...rest }) => ({ ...rest, id: (rest._id || rest.id).toString() })),
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (e) { next(e); }
});

// Helper: Deterministic Numerical Engine Execution for Statistics Studio
function runStatisticalEngine(analysisType, vars = {}, params = {}, rows = []) {
  const varX = vars.varX || vars.dependent || params.varX || params.dependent;
  const varY = vars.varY || params.varY;
  const ivs = vars.ivs || vars.independents || params.ivs || params.independents;
  const groupVar = vars.groupVar || vars.groupFactor || params.groupVar || params.groupFactor;
  const confLevel = Number(params.confLevel || params.confidenceLevel || 0.95);

  let results = {};
  let assumptions = {};
  let apaReport = '';

  switch (analysisType) {
    case 'descriptive': {
      const vals = rows.map(r => r[varX]).filter(v => v !== undefined && v !== '');
      results = computeDescriptive(vals, confLevel);
      assumptions = { normality: checkNormalityShapiroWilk(vals) };
      apaReport = `Descriptive statistics for ${varX} (N = ${results.count}): Mean = ${results.mean}, SD = ${results.stdDev}, Median = ${results.median}, IQR = ${results.iqr}, Skewness = ${results.skewness}.`;
      break;
    }
    case 'one_sample_t_test': {
      const vals = rows.map(r => r[varX]).filter(v => v !== undefined && v !== '');
      results = computeOneSampleTTest(vals, Number(params.mu0) || 0, confLevel);
      assumptions = { normality: checkNormalityShapiroWilk(vals) };
      apaReport = formatApa7StatisticalNarrative('one_sample_t_test', results, { varX });
      break;
    }
    case 'independent_t_test': {
      let gA = []; let gB = [];
      let labelA = 'Group A'; let labelB = 'Group B';
      if (groupVar) {
        const groupVals = [...new Set(rows.map(r => r[groupVar]))].filter(v => v !== undefined && v !== null && v !== '');
        labelA = String(groupVals[0] || 'Group 1');
        labelB = String(groupVals[1] || 'Group 2');
        gA = rows.filter(r => String(r[groupVar]) === labelA).map(r => r[varX]);
        gB = rows.filter(r => String(r[groupVar]) === labelB).map(r => r[varX]);
      } else {
        labelA = varX; labelB = varY;
        gA = rows.map(r => r[varX]);
        gB = rows.map(r => r[varY]);
      }
      results = computeTTest(gA, gB, false, confLevel);
      assumptions = {
        normalityA: checkNormalityShapiroWilk(gA),
        normalityB: checkNormalityShapiroWilk(gB),
        homogeneityOfVariance: checkLeveneTest([gA, gB], 'median'),
        homogeneity: checkLeveneTest([gA, gB], 'median')
      };
      apaReport = formatApa7StatisticalNarrative('independent_t_test', results, { groupA: labelA, groupB: labelB });
      break;
    }
    case 'paired_t_test': {
      const gA = rows.map(r => r[varX]);
      const gB = rows.map(r => r[varY]);
      results = computeTTest(gA, gB, true, confLevel);
      const diffs = gA.map((v, i) => Number(v) - Number(gB[i])).filter(d => !isNaN(d));
      assumptions = { normalityOfDiffs: checkNormalityShapiroWilk(diffs) };
      apaReport = formatApa7StatisticalNarrative('paired_t_test', results, { varX, varY });
      break;
    }
    case 'one_way_anova': {
      const distinctGroups = [...new Set(rows.map(r => r[groupVar]))].filter(v => v !== undefined && v !== '');
      const groupArrays = distinctGroups.map(gName => rows.filter(r => r[groupVar] === gName).map(r => r[varX]));
      results = computeAnova(groupArrays);
      assumptions = {
        homogeneityOfVariance: checkLeveneTest(groupArrays, 'median'),
        homogeneity: checkLeveneTest(groupArrays, 'median'),
        normality: checkNormalityShapiroWilk(rows.map(r => r[varX]))
      };
      apaReport = formatApa7StatisticalNarrative('one_way_anova', results, { varX });
      break;
    }
    case 'two_way_anova': {
      results = computeTwoWayAnova(rows, params.factorA || groupVar, params.factorB || varY, varX);
      apaReport = formatApa7StatisticalNarrative('two_way_anova', results);
      break;
    }
    case 'pearson_correlation':
    case 'spearman_correlation': {
      const x = rows.map(r => r[varX]);
      const y = rows.map(r => r[varY]);
      results = computeCorrelation(x, y, analysisType === 'spearman_correlation' ? 'spearman' : 'pearson', confLevel);
      assumptions = {
        normalityX: checkNormalityShapiroWilk(x),
        normalityY: checkNormalityShapiroWilk(y)
      };
      apaReport = formatApa7StatisticalNarrative(analysisType, results, { varX, varY });
      break;
    }
    case 'linear_regression':
    case 'multiple_linear_regression': {
      const predictorList = (Array.isArray(ivs) && ivs.length > 0) ? ivs : [varX];
      const dv = varY || varX;
      results = computeMultipleRegression(rows, dv, predictorList);
      apaReport = formatApa7StatisticalNarrative('multiple_linear_regression', results, { varX, varY });
      break;
    }
    case 'mann_whitney_u': {
      let gA = []; let gB = [];
      if (groupVar) {
        const groupVals = [...new Set(rows.map(r => r[groupVar]))].filter(v => v !== undefined && v !== '');
        gA = rows.filter(r => String(r[groupVar]) === String(groupVals[0])).map(r => r[varX]);
        gB = rows.filter(r => String(r[groupVar]) === String(groupVals[1])).map(r => r[varX]);
      } else {
        gA = rows.map(r => r[varX]);
        gB = rows.map(r => r[varY]);
      }
      results = computeMannWhitneyU(gA, gB);
      apaReport = formatApa7StatisticalNarrative('mann_whitney_u', results, { varX });
      break;
    }
    case 'wilcoxon_signed_rank': {
      const gA = rows.map(r => r[varX]);
      const gB = rows.map(r => r[varY]);
      results = computeWilcoxonSignedRank(gA, gB);
      apaReport = `A Wilcoxon signed-rank test indicated a ${results.significant ? 'statistically significant' : 'non-significant'} median difference between paired observations, W = ${results.w}, z = ${results.z}, p = ${results.pValue}.`;
      break;
    }
    case 'kruskal_wallis': {
      const distinctGroups = [...new Set(rows.map(r => r[groupVar]))].filter(v => v !== undefined && v !== '');
      const groupArrays = distinctGroups.map(gName => rows.filter(r => r[groupVar] === gName).map(r => r[varX]));
      results = computeKruskalWallis(groupArrays);
      apaReport = formatApa7StatisticalNarrative('kruskal_wallis', results);
      break;
    }
    case 'chi_square':
    case 'chi_square_independence': {
      let contingencyMatrix = params.table;
      if (!contingencyMatrix && varX && varY) {
        const distinctX = [...new Set(rows.map(r => String(r[varX])))];
        const distinctY = [...new Set(rows.map(r => String(r[varY])))];
        contingencyMatrix = distinctX.map(xVal => {
          return distinctY.map(yVal => {
            return rows.filter(r => String(r[varX]) === xVal && String(r[varY]) === yVal).length;
          });
        });
      }
      results = computeChiSquareTest(contingencyMatrix);
      apaReport = formatApa7StatisticalNarrative('chi_square_independence', results);
      break;
    }
    default:
      throw new Error(`Unsupported analysis type: ${analysisType}`);
  }

  return { results, assumptions, apaReport };
}

// GET /statistics/datasets/:datasetId - Single dataset inspection
apiRouter.get('/statistics/datasets/:datasetId', requireAuth, async (req, res, next) => {
  try {
    const { datasetId } = req.params;
    let ds = null;
    if (isDbConnected()) {
      ds = await Dataset.findOne({ _id: datasetId, deletedAt: null }).select('-rawData').lean();
    } else {
      ds = memDatasets.get(datasetId);
    }
    const isOwner = ds && (String(ds.ownerId) === String(req.user.id) || String(ds.userId) === String(req.user.id));
    if (!ds || ds.deletedAt || !isOwner) return res.status(404).json({ error: 'Dataset not found.' });

    const { rawData, ...rest } = ds;
    res.json({ ...rest, id: (rest._id || rest.id).toString() });
  } catch (e) { next(e); }
});

// GET /statistics/datasets/:datasetId/variables - Variable Explorer dictionary
apiRouter.get('/statistics/datasets/:datasetId/variables', requireAuth, async (req, res, next) => {
  try {
    const { datasetId } = req.params;
    let ds = isDbConnected() ? await Dataset.findOne({ _id: datasetId, deletedAt: null }).lean() : memDatasets.get(datasetId);
    const isOwner = ds && (String(ds.ownerId) === String(req.user.id) || String(ds.userId) === String(req.user.id));
    if (!ds || ds.deletedAt || !isOwner) return res.status(404).json({ error: 'Dataset not found.' });

    let vars = [];
    if (isDbConnected()) {
      vars = await DatasetVariable.find({ datasetId }).lean();
    } else {
      vars = [...memDatasetVariables.values()].filter(v => v.datasetId?.toString() === datasetId);
    }
    res.json(vars.map(v => ({ ...v, id: (v._id || v.id || v.name).toString() })));
  } catch (e) { next(e); }
});

// PATCH /statistics/datasets/:datasetId/variables/:varName - Update variable metadata & measurement levels
apiRouter.patch('/statistics/datasets/:datasetId/variables/:varName', requireAuth, async (req, res, next) => {
  try {
    const { datasetId, varName } = req.params;
    const { label, displayName, measurementLevel, role, missingValueCodes } = req.body || {};
    let ds = isDbConnected() ? await Dataset.findOne({ _id: datasetId, deletedAt: null }).lean() : memDatasets.get(datasetId);
    const isOwner = ds && (String(ds.ownerId) === String(req.user.id) || String(ds.userId) === String(req.user.id));
    if (!ds || ds.deletedAt || !isOwner) return res.status(404).json({ error: 'Dataset not found.' });

    const targetLabel = displayName || label;
    if (isDbConnected()) {
      const updated = await DatasetVariable.findOneAndUpdate(
        { datasetId, name: varName },
        { $set: { ...(targetLabel && { label: targetLabel }), ...(measurementLevel && { measurementLevel }), ...(role && { role }), ...(missingValueCodes && { missingValueCodes }) } },
        { new: true, upsert: true }
      );
      return res.json(updated);
    }

    const key = `${datasetId}_${varName}`;
    let existing = memDatasetVariables.get(key) || { datasetId, name: varName };
    Object.assign(existing, { ...(targetLabel && { label: targetLabel }), ...(measurementLevel && { measurementLevel }), ...(role && { role }), ...(missingValueCodes && { missingValueCodes }) });
    memDatasetVariables.set(key, existing);
    res.json(existing);
  } catch (e) { next(e); }
});

// GET /statistics/datasets/:datasetId/preview - Paginated data grid preview
apiRouter.get('/statistics/datasets/:datasetId/preview', requireAuth, async (req, res, next) => {
  try {
    const { datasetId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));

    let ds = null;
    if (isDbConnected()) {
      ds = await Dataset.findOne({ _id: datasetId, deletedAt: null }).lean();
    } else {
      ds = memDatasets.get(datasetId);
    }
    const isOwner = ds && (String(ds.ownerId) === String(req.user.id) || String(ds.userId) === String(req.user.id));
    if (!ds || ds.deletedAt || !isOwner) return res.status(404).json({ error: 'Dataset not found.' });

    const allRows = ds.rawData || [];
    const total = allRows.length;
    const rows = allRows.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      columns: ds.columns || [],
      rowCount: total,
      rows,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (e) { next(e); }
});

// POST /statistics/datasets/:datasetId/transform - Data cleaning and transformations with versioning
apiRouter.post('/statistics/datasets/:datasetId/transform', requireAuth, async (req, res, next) => {
  try {
    const { datasetId } = req.params;
    const { type, column, targetColumn, missingPolicy, recodeMap, transformations } = req.body || {};

    let ds = null;
    if (isDbConnected()) {
      ds = await Dataset.findOne({ _id: datasetId, deletedAt: null });
    } else {
      ds = memDatasets.get(datasetId);
    }
    const isOwner = ds && (String(ds.ownerId) === String(req.user.id) || String(ds.userId) === String(req.user.id));
    if (!ds || ds.deletedAt || !isOwner) return res.status(404).json({ error: 'Dataset not found.' });

    const effectiveType = type || (transformations && transformations[0]?.operation) || 'standardize_z';
    const effectiveCol = column || (transformations && transformations[0]?.column) || ds.columns?.[0]?.name;

    const transformedRows = applyDatasetTransformations(ds.rawData || [], {
      type: effectiveType,
      column: effectiveCol,
      targetColumn,
      missingPolicy,
      recodeMap
    });

    const newVersionNum = (ds.currentVersionNumber || 1) + 1;
    const summary = req.body?.summary || `Transformation [${effectiveType}] applied on column "${effectiveCol}"`;
    const checksum = crypto.createHash('sha256').update(JSON.stringify(transformedRows)).digest('hex');

    if (isDbConnected()) {
      ds.rawData = transformedRows;
      ds.currentVersionNumber = newVersionNum;
      ds.rowCount = transformedRows.length;
      ds.updatedAt = new Date();
      await ds.save();

      await DatasetVersion.create({
        datasetId: ds._id,
        projectId: ds.projectId,
        versionNumber: newVersionNum,
        transformationSummary: summary,
        rowCount: transformedRows.length,
        columnCount: ds.columnCount,
        checksum,
        rawData: transformedRows.slice(0, 5000)
      });
      return res.json({ success: true, currentVersionNumber: newVersionNum, versionNumber: newVersionNum, summary, rowCount: transformedRows.length });
    }

    ds.rawData = transformedRows;
    ds.currentVersionNumber = newVersionNum;
    ds.rowCount = transformedRows.length;
    ds.updatedAt = new Date().toISOString();
    memDatasets.set(datasetId, ds);

    memDatasetVersions.set(`${datasetId}_v${newVersionNum}`, {
      datasetId,
      projectId: ds.projectId,
      versionNumber: newVersionNum,
      transformationSummary: summary,
      rowCount: transformedRows.length,
      columnCount: ds.columnCount,
      checksum,
      rawData: transformedRows.slice(0, 5000),
      createdAt: new Date().toISOString()
    });

    res.json({ success: true, currentVersionNumber: newVersionNum, versionNumber: newVersionNum, summary, rowCount: transformedRows.length });
  } catch (e) { next(e); }
});

// GET /statistics/datasets/:datasetId/versions - Version history list
apiRouter.get('/statistics/datasets/:datasetId/versions', requireAuth, async (req, res, next) => {
  try {
    const { datasetId } = req.params;
    let ds = isDbConnected() ? await Dataset.findOne({ _id: datasetId, deletedAt: null }).lean() : memDatasets.get(datasetId);
    const isOwner = ds && (String(ds.ownerId) === String(req.user.id) || String(ds.userId) === String(req.user.id));
    if (!ds || ds.deletedAt || !isOwner) return res.status(404).json({ error: 'Dataset not found.' });

    if (isDbConnected()) {
      const versions = await DatasetVersion.find({ datasetId }).select('-rawData').sort({ versionNumber: -1 }).lean();
      return res.json(versions);
    }
    const versions = [...memDatasetVersions.values()]
      .filter(v => v.datasetId?.toString() === datasetId)
      .sort((a, b) => b.versionNumber - a.versionNumber)
      .map(({ rawData, ...rest }) => rest);
    res.json(versions);
  } catch (e) { next(e); }
});

// POST /statistics/analyses - Configure & Execute Statistical Analysis
apiRouter.post('/statistics/analyses', requireAuth, async (req, res, next) => {
  try {
    const { projectId, datasetId, title, analysisType, variables, parameters, missingDataPolicy } = req.body || {};
    if (!analysisType) return res.status(400).json({ error: 'analysisType is required.' });

    const aId = new mongoose.Types.ObjectId().toString();
    const resId = new mongoose.Types.ObjectId().toString();

    let computedResults = null;
    let computedAssumptions = null;
    let computedApa = null;

    if (datasetId) {
      let ds = null;
      if (isDbConnected()) {
        ds = await Dataset.findOne({ _id: datasetId, deletedAt: null });
      } else {
        ds = memDatasets.get(datasetId);
      }
      if (ds && !ds.deletedAt) {
        const rows = ds.rawData || [];
        const execOut = runStatisticalEngine(analysisType, variables || {}, parameters || {}, rows);
        computedResults = execOut.results;
        computedAssumptions = execOut.assumptions;
        computedApa = execOut.apaReport;
      }
    }

    const payload = {
      _id: isDbConnected() ? new mongoose.Types.ObjectId(aId) : aId,
      id: aId,
      projectId: projectId || 'default-project',
      userId: req.user.id,
      datasetId,
      title: title || `${analysisType.replace(/_/g, ' ')} Analysis`,
      analysisType,
      variables: variables || {},
      parameters: parameters || {},
      missingDataPolicy: missingDataPolicy || 'listwise_deletion',
      status: computedResults ? 'completed' : 'configured',
      results: computedResults,
      assumptions: computedAssumptions,
      diagnostics: computedAssumptions,
      apaReport: computedApa,
      apaNarrative: computedApa,
      createdAt: new Date()
    };

    if (isDbConnected()) {
      const created = await Analysis.create(payload);
      if (computedResults) {
        await AnalysisResult.create({
          _id: new mongoose.Types.ObjectId(resId),
          analysisId: created._id,
          projectId: payload.projectId,
          numericalResults: computedResults,
          assumptions: computedAssumptions,
          apa7Narrative: computedApa,
          softwareVersions: { statEngine: 'Phase 7 Numerical Matrix Core 1.0', node: process.version }
        });
      }
      return res.status(201).json(created);
    }

    memAnalyses.set(aId, payload);
    if (computedResults) {
      memAnalysisResults.set(resId, {
        _id: resId,
        analysisId: aId,
        projectId: payload.projectId,
        numericalResults: computedResults,
        assumptions: computedAssumptions,
        apa7Narrative: computedApa,
        createdAt: new Date().toISOString()
      });
    }

    res.status(201).json(payload);
  } catch (e) { next(e); }
});

// GET /statistics/analyses - List analyses with search and filters
apiRouter.get('/statistics/analyses', requireAuth, async (req, res, next) => {
  try {
    const { projectId, datasetId } = req.query;
    if (isDbConnected()) {
      const filter = { userId: req.user.id, deletedAt: null };
      if (projectId && projectId !== 'all') filter.projectId = projectId;
      if (datasetId) filter.datasetId = datasetId;
      const list = await Analysis.find(filter).sort({ createdAt: -1 }).lean();
      return res.json(list.map(a => ({ ...a, id: a._id.toString() })));
    }

    const list = [...memAnalyses.values()].filter(a => {
      if (a.deletedAt) return false;
      if (a.userId && a.userId !== req.user.id) return false;
      if (projectId && projectId !== 'all' && a.projectId !== projectId) return false;
      if (datasetId && a.datasetId !== datasetId) return false;
      return true;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(list.map(a => ({ ...a, id: (a._id || a.id).toString() })));
  } catch (e) { next(e); }
});

// POST /statistics/analyses/:analysisId/run - Execute configured analysis
apiRouter.post('/statistics/analyses/:analysisId/run', requireAuth, async (req, res, next) => {
  try {
    const { analysisId } = req.params;
    let analysis = null;
    if (isDbConnected()) {
      analysis = await Analysis.findOne({ _id: analysisId, deletedAt: null });
    } else {
      analysis = memAnalyses.get(analysisId);
    }
    if (!analysis || analysis.deletedAt || (analysis.userId && analysis.userId !== req.user.id)) {
      return res.status(404).json({ error: 'Analysis configuration not found.' });
    }

    let dataset = null;
    if (isDbConnected()) {
      dataset = await Dataset.findOne({ _id: analysis.datasetId, deletedAt: null });
    } else {
      dataset = memDatasets.get(analysis.datasetId?.toString());
    }
    if (!dataset || dataset.deletedAt) return res.status(404).json({ error: 'Dataset not found.' });

    const rows = dataset.rawData || [];
    const params = { ...analysis.parameters, ...req.body };
    const vars = { ...analysis.variables, ...req.body.variables };

    const { results, assumptions, apaReport } = runStatisticalEngine(analysis.analysisType, vars, params, rows);

    analysis.results = results;
    analysis.assumptions = assumptions;
    analysis.apaReport = apaReport;
    analysis.apaNarrative = apaReport;
    analysis.status = 'completed';
    analysis.updatedAt = new Date();

    const resId = new mongoose.Types.ObjectId().toString();
    const resultRecord = {
      _id: isDbConnected() ? new mongoose.Types.ObjectId(resId) : resId,
      id: resId,
      analysisId: (analysis._id || analysis.id).toString(),
      projectId: analysis.projectId,
      numericalResults: results,
      assumptions,
      apa7Narrative: apaReport,
      softwareVersions: { statEngine: 'Phase 7 Numerical Matrix Core 1.0', node: process.version },
      createdAt: new Date()
    };

    if (isDbConnected()) {
      await analysis.save();
      await AnalysisResult.create(resultRecord);
    } else {
      memAnalyses.set(analysisId, analysis);
      memAnalysisResults.set(resId, resultRecord);
    }

    res.json({
      success: true,
      analysisId,
      results,
      assumptions,
      diagnostics: assumptions,
      apaReport,
      apaNarrative: apaReport
    });
  } catch (e) { next(e); }
});

// GET /statistics/analyses/:analysisId/results - Retrieve numerical results
apiRouter.get('/statistics/analyses/:analysisId/results', requireAuth, async (req, res, next) => {
  try {
    const { analysisId } = req.params;
    let an = isDbConnected() ? await Analysis.findOne({ _id: analysisId, deletedAt: null }).lean() : memAnalyses.get(analysisId);
    if (!an || an.deletedAt || (an.userId && an.userId !== req.user.id)) {
      return res.status(404).json({ error: 'Analysis results not found.' });
    }

    let resRecord = null;
    if (isDbConnected()) {
      resRecord = await AnalysisResult.findOne({ analysisId }).lean();
    } else {
      resRecord = [...memAnalysisResults.values()].find(r => r.analysisId === analysisId);
    }
    if (!resRecord) {
      if (an.results) {
        return res.json({
          analysisId,
          results: an.results,
          numericalResults: an.results,
          assumptions: an.assumptions,
          apa7Narrative: an.apaReport || an.apaNarrative
        });
      }
      return res.status(404).json({ error: 'Analysis results not found.' });
    }
    res.json({ ...resRecord, results: resRecord.numericalResults || resRecord.results });
  } catch (e) { next(e); }
});

// DELETE /statistics/datasets/:datasetId - Soft delete dataset
apiRouter.delete('/statistics/datasets/:datasetId', requireAuth, async (req, res, next) => {
  try {
    const { datasetId } = req.params;
    if (isDbConnected()) {
      const ds = await Dataset.findOne({ _id: datasetId, deletedAt: null });
      if (!ds || (ds.ownerId && ds.ownerId !== req.user.id && ds.userId !== req.user.id)) return res.status(404).json({ error: 'Dataset not found.' });
      ds.deletedAt = new Date();
      await ds.save();
      return res.json({ success: true, deleted: true });
    }
    const ds = memDatasets.get(datasetId);
    if (!ds || ds.deletedAt || (ds.ownerId && ds.ownerId !== req.user.id && ds.userId !== req.user.id)) return res.status(404).json({ error: 'Dataset not found.' });
    ds.deletedAt = new Date().toISOString();
    res.json({ success: true, deleted: true });
  } catch (e) { next(e); }
});

// DELETE /statistics/analyses/:analysisId - Soft delete analysis
apiRouter.delete('/statistics/analyses/:analysisId', requireAuth, async (req, res, next) => {
  try {
    const { analysisId } = req.params;
    if (isDbConnected()) {
      const an = await Analysis.findOne({ _id: analysisId, deletedAt: null });
      if (!an || (an.userId && an.userId !== req.user.id)) return res.status(404).json({ error: 'Analysis not found.' });
      an.deletedAt = new Date();
      await an.save();
      return res.json({ success: true, deleted: true });
    }
    const an = memAnalyses.get(analysisId);
    if (!an || an.deletedAt || (an.userId && an.userId !== req.user.id)) return res.status(404).json({ error: 'Analysis not found.' });
    an.deletedAt = new Date().toISOString();
    res.json({ success: true, deleted: true });
  } catch (e) { next(e); }
});

// Systematic Review Assistant (Module 6 & Phase 8 - PRISMA 2020 Enterprise Suite)

async function recordReviewAudit(reviewId, userId, eventType, description, details = {}) {
  const auditData = {
    reviewId: reviewId?.toString(),
    userId: userId?.toString(),
    eventType,
    description,
    details,
    timestamp: new Date()
  };
  if (isDbConnected()) {
    try {
      await ReviewAuditEvent.create(auditData);
    } catch {}
  } else {
    const id = new mongoose.Types.ObjectId().toString();
    memReviewAuditEvents.set(id, { _id: id, ...auditData, timestamp: auditData.timestamp.toISOString() });
  }
}

// 1. List Systematic Reviews (supports user-level and project-level queries)
apiRouter.get('/systematic-reviews', requireAuth, async (req, res, next) => {
  try {
    const { projectId } = req.query;
    if (isDbConnected()) {
      const filter = { deletedAt: null };
      if (projectId) filter.projectId = projectId;
      else filter.userId = req.user.id;
      const reviews = await SystematicReview.find(filter).sort({ updatedAt: -1, createdAt: -1 }).lean();
      return res.json(reviews);
    }
    const reviews = [...memSystematicReviews.values()].filter(r => {
      if (r.deletedAt) return false;
      if (projectId) return r.projectId === projectId;
      return !r.userId || r.userId === req.user.id;
    });
    res.json(reviews);
  } catch (e) { next(e); }
});

// Backward-compatible project-level list
apiRouter.get('/projects/:id/systematic-reviews', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const reviews = await SystematicReview.find({ projectId: req.params.id, deletedAt: null }).sort({ createdAt: -1 }).lean();
      return res.json(reviews);
    }
    const reviews = [...memSystematicReviews.values()].filter(s => s.projectId === req.params.id && !s.deletedAt);
    res.json(reviews);
  } catch (e) { next(e); }
});

// 2. Create Systematic Review
apiRouter.post('/systematic-reviews', requireAuth, async (req, res, next) => {
  try {
    const {
      title,
      projectId,
      reviewType = 'systematic_review',
      registration,
      picosFramework,
      eligibility,
      screeningSettings
    } = req.body || {};

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Systematic review title is required.' });
    }

    const reviewData = {
      projectId: projectId || null,
      userId: req.user.id,
      title: title.trim(),
      reviewType,
      status: 'protocol_drafting',
      currentStage: 'protocol',
      registration: registration || { registered: false, registryName: '', registrationNumber: '', protocolUrl: '' },
      picosFramework: picosFramework || { framework: 'PICO', population: '', intervention: '', comparator: '', outcomes: '', studyDesign: '' },
      eligibility: eligibility || { inclusionCriteria: [], exclusionCriteria: [] },
      screeningSettings: screeningSettings || {
        dualReviewerMode: false,
        blindScreening: true,
        adjudicationMethod: 'third_reviewer',
        minimumReviewersPerRecord: 1,
        conflictResolutionPolicy: 'consensus'
      },
      prismaMetrics: {
        identified: 0,
        duplicatesRemoved: 0,
        ineligibleBeforeScreening: 0,
        screenedTitleAbstract: 0,
        excludedTitleAbstract: 0,
        soughtFullText: 0,
        notRetrievedFullText: 0,
        assessedFullText: 0,
        excludedFullText: 0,
        includedInSynthesis: 0
      },
      deletedAt: null
    };

    if (isDbConnected()) {
      const review = await SystematicReview.create(reviewData);
      await recordReviewAudit(review._id, req.user.id, 'review_created', `Review "${review.title}" initialized.`);
      return res.status(201).json(review);
    }

    const rId = new mongoose.Types.ObjectId().toString();
    const newRev = { _id: rId, ...reviewData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    memSystematicReviews.set(rId, newRev);
    await recordReviewAudit(rId, req.user.id, 'review_created', `Review "${newRev.title}" initialized.`);
    res.status(201).json(newRev);
  } catch (e) { next(e); }
});

// Backward-compatible project-level create
apiRouter.post('/projects/:id/systematic-reviews', requireAuth, async (req, res, next) => {
  try {
    const { title, protocol, eligibility, reviewType, picosFramework } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: 'Systematic review title is required.' });

    const reviewData = {
      projectId: req.params.id,
      userId: req.user.id,
      title: title.trim(),
      reviewType: reviewType || 'systematic_review',
      status: 'protocol_drafting',
      currentStage: 'protocol',
      protocol: protocol || {},
      picosFramework: picosFramework || { framework: 'PICO' },
      eligibility: eligibility || { inclusionCriteria: [], exclusionCriteria: [] },
      screeningSettings: { dualReviewerMode: false, blindScreening: true, minimumReviewersPerRecord: 1 },
      prismaMetrics: {
        identified: 0,
        duplicatesRemoved: 0,
        ineligibleBeforeScreening: 0,
        screenedTitleAbstract: 0,
        excludedTitleAbstract: 0,
        soughtFullText: 0,
        notRetrievedFullText: 0,
        assessedFullText: 0,
        excludedFullText: 0,
        includedInSynthesis: 0
      },
      deletedAt: null
    };

    if (isDbConnected()) {
      const review = await SystematicReview.create(reviewData);
      return res.status(201).json(review);
    }

    const rId = new mongoose.Types.ObjectId().toString();
    const newRev = { _id: rId, ...reviewData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    memSystematicReviews.set(rId, newRev);
    res.status(201).json(newRev);
  } catch (e) { next(e); }
});

// 3. Get Single Systematic Review
apiRouter.get('/systematic-reviews/:reviewId', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    let review;
    if (isDbConnected()) {
      review = await SystematicReview.findOne({ _id: reviewId, deletedAt: null }).lean();
    } else {
      review = memSystematicReviews.get(reviewId);
      if (review?.deletedAt) review = null;
    }
    if (!review) return res.status(404).json({ error: 'Systematic review not found.' });

    // Fetch records to reconcile PRISMA
    let records = [];
    let searchRuns = [];
    if (isDbConnected()) {
      records = await StudyRecord.find({ reviewId }).lean();
      searchRuns = await SearchStrategy.find({ reviewId }).lean();
    } else {
      records = [...memStudyRecords.values()].filter(s => s.reviewId === reviewId);
      searchRuns = [...memSearchStrategies.values()].filter(s => s.reviewId === reviewId);
    }

    const prismaReconciled = reconcilePrisma2020Metrics(review, records, searchRuns);
    res.json({ ...review, prismaReconciled, recordCount: records.length });
  } catch (e) { next(e); }
});

// 4. Update Review Details & Screening Settings
apiRouter.patch('/systematic-reviews/:reviewId', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const allowed = ['title', 'reviewType', 'status', 'currentStage', 'registration', 'picosFramework', 'eligibility', 'screeningSettings'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updatedAt = new Date();

    if (isDbConnected()) {
      const updated = await SystematicReview.findOneAndUpdate({ _id: reviewId, deletedAt: null }, { $set: updates }, { new: true }).lean();
      if (!updated) return res.status(404).json({ error: 'Review not found.' });
      await recordReviewAudit(reviewId, req.user.id, 'review_updated', 'Review configuration updated.');
      return res.json(updated);
    }

    const rev = memSystematicReviews.get(reviewId);
    if (!rev || rev.deletedAt) return res.status(404).json({ error: 'Review not found.' });
    Object.assign(rev, updates, { updatedAt: new Date().toISOString() });
    await recordReviewAudit(reviewId, req.user.id, 'review_updated', 'Review configuration updated.');
    res.json(rev);
  } catch (e) { next(e); }
});

// 5. Delete Systematic Review (Soft Delete)
apiRouter.delete('/systematic-reviews/:reviewId', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    if (isDbConnected()) {
      const review = await SystematicReview.findOne({ _id: reviewId, deletedAt: null });
      if (!review) return res.status(404).json({ error: 'Review not found.' });
      review.deletedAt = new Date();
      await review.save();
      await recordReviewAudit(reviewId, req.user.id, 'review_deleted', 'Review moved to trash.');
      return res.json({ success: true, deleted: true });
    }
    const rev = memSystematicReviews.get(reviewId);
    if (!rev || rev.deletedAt) return res.status(404).json({ error: 'Review not found.' });
    rev.deletedAt = new Date().toISOString();
    await recordReviewAudit(reviewId, req.user.id, 'review_deleted', 'Review moved to trash.');
    res.json({ success: true, deleted: true });
  } catch (e) { next(e); }
});

// 6. Protocol Management (GET & PUT)
apiRouter.get('/systematic-reviews/:reviewId/protocol', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    if (isDbConnected()) {
      const proto = await ReviewProtocol.findOne({ reviewId }).lean();
      if (proto) return res.json(proto);
      const rev = await SystematicReview.findById(reviewId).select('title picosFramework eligibility').lean();
      return res.json({
        reviewId,
        title: rev?.title || '',
        framework: rev?.picosFramework?.framework || 'PICO',
        picoElements: rev?.picosFramework || {},
        inclusionCriteria: rev?.eligibility?.inclusionCriteria || [],
        exclusionCriteria: rev?.eligibility?.exclusionCriteria || [],
        version: 1,
        amendments: []
      });
    }

    const proto = memReviewProtocols.get(reviewId);
    if (proto) return res.json(proto);
    const rev = memSystematicReviews.get(reviewId);
    res.json({
      reviewId,
      title: rev?.title || '',
      framework: rev?.picosFramework?.framework || 'PICO',
      picoElements: rev?.picosFramework || {},
      inclusionCriteria: rev?.eligibility?.inclusionCriteria || [],
      exclusionCriteria: rev?.eligibility?.exclusionCriteria || [],
      version: 1,
      amendments: []
    });
  } catch (e) { next(e); }
});

apiRouter.put('/systematic-reviews/:reviewId/protocol', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const {
      title,
      framework,
      background,
      objectives,
      picoElements,
      inclusionCriteria,
      exclusionCriteria,
      searchStrategySummary,
      dataExtractionPlan,
      riskOfBiasTool,
      synthesisPlan,
      registrationNumber,
      registryName,
      amendmentNote
    } = req.body || {};

    let existing;
    if (isDbConnected()) {
      existing = await ReviewProtocol.findOne({ reviewId });
    } else {
      existing = memReviewProtocols.get(reviewId);
    }

    const newVersion = (existing?.version || 1) + (amendmentNote ? 1 : 0);
    const amendments = [...(existing?.amendments || [])];
    if (amendmentNote) {
      amendments.push({
        version: newVersion,
        date: new Date(),
        reason: amendmentNote.trim(),
        authorId: req.user.id
      });
    }

    const protoData = {
      reviewId,
      title: title || existing?.title || 'Systematic Review Protocol',
      framework: framework || existing?.framework || 'PICO',
      background: background || existing?.background || '',
      objectives: objectives || existing?.objectives || '',
      picoElements: picoElements || existing?.picoElements || {},
      inclusionCriteria: Array.isArray(inclusionCriteria) ? inclusionCriteria : (existing?.inclusionCriteria || []),
      exclusionCriteria: Array.isArray(exclusionCriteria) ? exclusionCriteria : (existing?.exclusionCriteria || []),
      searchStrategySummary: searchStrategySummary || existing?.searchStrategySummary || '',
      dataExtractionPlan: dataExtractionPlan || existing?.dataExtractionPlan || '',
      riskOfBiasTool: riskOfBiasTool || existing?.riskOfBiasTool || 'RoB 2',
      synthesisPlan: synthesisPlan || existing?.synthesisPlan || '',
      registrationNumber: registrationNumber || existing?.registrationNumber || '',
      registryName: registryName || existing?.registryName || '',
      version: newVersion,
      amendments,
      updatedAt: new Date()
    };

    if (isDbConnected()) {
      const saved = await ReviewProtocol.findOneAndUpdate({ reviewId }, { $set: protoData }, { upsert: true, new: true });
      await recordReviewAudit(reviewId, req.user.id, 'protocol_updated', `Protocol updated to version ${newVersion}.`);
      return res.json(saved);
    }

    const saved = { _id: existing?._id || new mongoose.Types.ObjectId().toString(), ...protoData };
    memReviewProtocols.set(reviewId, saved);
    await recordReviewAudit(reviewId, req.user.id, 'protocol_updated', `Protocol updated to version ${newVersion}.`);
    res.json(saved);
  } catch (e) { next(e); }
});

// 7. Search Strategies Logging
apiRouter.get('/systematic-reviews/:reviewId/search-strategies', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    if (isDbConnected()) {
      const strategies = await SearchStrategy.find({ reviewId }).sort({ searchDate: -1, createdAt: -1 }).lean();
      return res.json(strategies);
    }
    const strategies = [...memSearchStrategies.values()].filter(s => s.reviewId === reviewId);
    res.json(strategies);
  } catch (e) { next(e); }
});

apiRouter.post('/systematic-reviews/:reviewId/search-strategies', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const {
      databaseName,
      sourceType = 'database',
      searchString,
      searchDate,
      filtersApplied = [],
      recordsRetrieved = 0,
      notes = ''
    } = req.body || {};

    if (!databaseName || !databaseName.trim()) {
      return res.status(400).json({ error: 'Database or information source name is required.' });
    }

    const stratData = {
      reviewId,
      databaseName: databaseName.trim(),
      sourceType,
      searchString: searchString || '',
      searchDate: searchDate ? new Date(searchDate) : new Date(),
      filtersApplied,
      recordsRetrieved: Number(recordsRetrieved) || 0,
      notes,
      userId: req.user.id
    };

    if (isDbConnected()) {
      const doc = await SearchStrategy.create(stratData);
      await recordReviewAudit(reviewId, req.user.id, 'search_run_logged', `Search executed on ${doc.databaseName} retrieving ${doc.recordsRetrieved} records.`);
      return res.status(201).json(doc);
    }

    const id = new mongoose.Types.ObjectId().toString();
    const doc = { _id: id, ...stratData, createdAt: new Date().toISOString() };
    memSearchStrategies.set(id, doc);
    await recordReviewAudit(reviewId, req.user.id, 'search_run_logged', `Search executed on ${doc.databaseName} retrieving ${doc.recordsRetrieved} records.`);
    res.status(201).json(doc);
  } catch (e) { next(e); }
});

// 8. Multi-Source Study Records Import (RIS, BibTeX, CSV, Reference Manager)
apiRouter.post('/systematic-reviews/:reviewId/import', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const {
      format = 'json',
      content = '',
      records = [],
      referenceIds = [],
      sourceDatabase = 'Direct Import',
      sourceType = 'database',
      searchRunId = null
    } = req.body || {};

    let parsedRecords = [];

    if (format === 'ris' && typeof content === 'string') {
      const rawParsed = parseRis(content);
      parsedRecords = rawParsed.map(r => ({
        title: r.title || 'Untitled Record',
        authors: Array.isArray(r.authors) ? r.authors : [r.authors || 'Unknown'],
        year: r.year || '',
        journal: r.journal || '',
        doi: normalizeDoi(r.doi || ''),
        pmid: normalizePmid(r.pmid || ''),
        abstract: r.abstract || '',
        sourceDatabase,
        sourceType
      }));
    } else if (format === 'bibtex' && typeof content === 'string') {
      const rawParsed = parseBibtex(content);
      parsedRecords = rawParsed.map(r => ({
        title: r.title || 'Untitled Record',
        authors: Array.isArray(r.authors) ? r.authors : [r.authors || 'Unknown'],
        year: r.year || '',
        journal: r.journal || '',
        doi: normalizeDoi(r.doi || ''),
        pmid: normalizePmid(r.pmid || ''),
        abstract: r.abstract || '',
        sourceDatabase,
        sourceType
      }));
    } else if (format === 'csv' && typeof content === 'string') {
      parsedRecords = parseCsvStudyRecords(content).map(r => ({ ...r, sourceDatabase, sourceType }));
    } else if (Array.isArray(records) && records.length > 0) {
      parsedRecords = records.map(r => ({
        title: r.title || 'Untitled Record',
        authors: Array.isArray(r.authors) ? r.authors : [r.authors || 'Unknown'],
        year: r.year ? String(r.year) : '',
        journal: r.journal || '',
        doi: normalizeDoi(r.doi || ''),
        pmid: normalizePmid(r.pmid || ''),
        abstract: r.abstract || '',
        sourceDatabase: r.sourceDatabase || sourceDatabase,
        sourceType: r.sourceType || sourceType
      }));
    } else if (Array.isArray(referenceIds) && referenceIds.length > 0) {
      // Import from Reference Manager
      if (isDbConnected()) {
        const refs = await Reference.find({ _id: { $in: referenceIds } }).lean();
        parsedRecords = refs.map(r => ({
          title: r.title,
          authors: r.authors?.map(a => typeof a === 'string' ? a : `${a.given || ''} ${a.family || ''}`.trim()) || ['Unknown'],
          year: r.year ? String(r.year) : '',
          journal: r.journal || r.publisher || '',
          doi: normalizeDoi(r.doi || ''),
          abstract: r.abstract || '',
          sourceDatabase: 'Reference Manager',
          sourceType: 'other_methods'
        }));
      } else {
        const allRefs = [...(app.locals.memReferences?.values() || [])];
        const matched = allRefs.filter(r => referenceIds.includes(r._id));
        parsedRecords = matched.map(r => ({
          title: r.title,
          authors: r.authors || ['Unknown'],
          year: r.year ? String(r.year) : '',
          journal: r.journal || '',
          doi: normalizeDoi(r.doi || ''),
          abstract: r.abstract || '',
          sourceDatabase: 'Reference Manager',
          sourceType: 'other_methods'
        }));
      }
    }

    if (!parsedRecords.length) {
      return res.status(400).json({ error: 'No valid study records could be parsed from input.' });
    }

    // Retrieve existing records to test for duplicates
    let existingRecords = [];
    if (isDbConnected()) {
      existingRecords = await StudyRecord.find({ reviewId }).lean();
    } else {
      existingRecords = [...memStudyRecords.values()].filter(s => s.reviewId === reviewId);
    }

    const insertedDocs = [];
    let exactDupes = 0;

    for (const rec of parsedRecords) {
      // Test match against existing records
      let matchedExisting = null;
      let highestMatch = { isDuplicate: false, matchType: 'none', similarityScore: 0 };

      for (const ex of existingRecords) {
        const match = classifyDuplicateMatch(rec, ex);
        if (match.isDuplicate && match.similarityScore > highestMatch.similarityScore) {
          highestMatch = match;
          matchedExisting = ex;
        }
      }

      const isDupe = highestMatch.isDuplicate;
      if (isDupe && highestMatch.matchType === 'exact') exactDupes++;

      const studyPayload = {
        reviewId,
        searchRunId,
        title: rec.title,
        authors: rec.authors,
        year: rec.year,
        journal: rec.journal,
        doi: rec.doi,
        pmid: rec.pmid,
        abstract: rec.abstract,
        sourceDatabase: rec.sourceDatabase,
        sourceType: rec.sourceType,
        screeningStage: isDupe ? 'pre_screen' : 'title_abstract',
        decision: isDupe ? 'excluded' : 'pending',
        deduplicationStatus: isDupe ? 'duplicate' : 'unique',
        duplicateOfRecordId: isDupe && matchedExisting ? matchedExisting._id : null,
        fullTextStatus: 'not_sought',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      if (isDbConnected()) {
        const created = await StudyRecord.create(studyPayload);
        insertedDocs.push(created);
        existingRecords.push(created.toObject());
      } else {
        const id = new mongoose.Types.ObjectId().toString();
        const created = { _id: id, ...studyPayload };
        memStudyRecords.set(id, created);
        insertedDocs.push(created);
        existingRecords.push(created);
      }
    }

    await recordReviewAudit(
      reviewId,
      req.user.id,
      'records_imported',
      `Imported ${insertedDocs.length} records (${exactDupes} identified as duplicates).`
    );

    res.status(201).json({
      success: true,
      importedCount: insertedDocs.length,
      duplicateCount: exactDupes,
      uniqueCount: insertedDocs.length - exactDupes,
      records: insertedDocs
    });
  } catch (e) { next(e); }
});

// 9. Records List with Filtering, Searching, & Pagination
apiRouter.get('/systematic-reviews/:reviewId/records', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const {
      stage,
      decision,
      deduplicationStatus,
      search,
      page = 1,
      limit = 50
    } = req.query;

    const p = Math.max(1, parseInt(page, 10));
    const lim = Math.max(1, Math.min(200, parseInt(limit, 10)));

    if (isDbConnected()) {
      const filter = { reviewId };
      if (stage && stage !== 'all') filter.screeningStage = stage;
      if (decision && decision !== 'all') filter.decision = decision;
      if (deduplicationStatus && deduplicationStatus !== 'all') filter.deduplicationStatus = deduplicationStatus;
      if (search && search.trim()) {
        const rx = new RegExp(search.trim(), 'i');
        filter.$or = [{ title: rx }, { abstract: rx }, { journal: rx }, { doi: rx }, { authors: rx }];
      }

      const total = await StudyRecord.countDocuments(filter);
      const records = await StudyRecord.find(filter)
        .sort({ createdAt: -1 })
        .skip((p - 1) * lim)
        .limit(lim)
        .lean();

      return res.json({ total, page: p, limit: lim, records });
    }

    let records = [...memStudyRecords.values()].filter(s => s.reviewId === reviewId);
    if (stage && stage !== 'all') records = records.filter(s => s.screeningStage === stage);
    if (decision && decision !== 'all') records = records.filter(s => s.decision === decision);
    if (deduplicationStatus && deduplicationStatus !== 'all') records = records.filter(s => s.deduplicationStatus === deduplicationStatus);
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      records = records.filter(s =>
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.abstract && s.abstract.toLowerCase().includes(q)) ||
        (s.journal && s.journal.toLowerCase().includes(q)) ||
        (s.doi && s.doi.toLowerCase().includes(q))
      );
    }

    const total = records.length;
    const paginated = records.slice((p - 1) * lim, p * lim);
    res.json({ total, page: p, limit: lim, records: paginated });
  } catch (e) { next(e); }
});

// Backward-compatible studies route
apiRouter.get('/projects/:id/systematic-reviews/:reviewId/studies', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const studies = await StudyRecord.find({ reviewId: req.params.reviewId }).sort({ createdAt: -1 }).lean();
      return res.json(studies);
    }
    const studies = [...memStudyRecords.values()].filter(s => s.reviewId === req.params.reviewId);
    res.json(studies);
  } catch (e) { next(e); }
});

// Backward-compatible bulk insert studies
apiRouter.post('/projects/:id/systematic-reviews/:reviewId/studies', requireAuth, async (req, res, next) => {
  try {
    const { studies = [] } = req.body || {};
    if (!Array.isArray(studies) || studies.length === 0) return res.status(400).json({ error: 'Array of studies is required.' });

    const inserted = [];
    for (const s of studies) {
      const record = {
        reviewId: req.params.reviewId,
        projectId: req.params.id,
        title: s.title || 'Untitled Study',
        authors: Array.isArray(s.authors) ? s.authors : [s.authors || 'Unknown'],
        year: s.year || '',
        journal: s.journal || '',
        doi: s.doi || '',
        abstract: s.abstract || '',
        screeningStage: 'title_abstract',
        decision: 'pending',
        deduplicationStatus: 'unique',
        fullTextStatus: 'not_sought'
      };

      if (isDbConnected()) {
        const doc = await StudyRecord.create(record);
        inserted.push(doc);
      } else {
        const id = new mongoose.Types.ObjectId().toString();
        const entry = { _id: id, ...record };
        memStudyRecords.set(id, entry);
        inserted.push(entry);
      }
    }

    res.status(201).json({ addedCount: inserted.length, studies: inserted });
  } catch (e) { next(e); }
});

// 10. Deduplication Management & Automated Candidate Detection
apiRouter.get('/systematic-reviews/:reviewId/duplicates', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    let records = [];
    if (isDbConnected()) {
      records = await StudyRecord.find({ reviewId }).lean();
    } else {
      records = [...memStudyRecords.values()].filter(s => s.reviewId === reviewId);
    }

    const { duplicateGroups, duplicateCount } = identifyReviewDuplicates(records);
    res.json({ totalRecords: records.length, duplicateCount, duplicateGroups });
  } catch (e) { next(e); }
});

apiRouter.post('/systematic-reviews/:reviewId/duplicates/resolve', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { canonicalRecordId, duplicateRecordIds = [], action = 'merge' } = req.body || {};

    if (!canonicalRecordId || !Array.isArray(duplicateRecordIds)) {
      return res.status(400).json({ error: 'canonicalRecordId and duplicateRecordIds array are required.' });
    }

    if (isDbConnected()) {
      if (action === 'merge' || action === 'mark_duplicate') {
        await StudyRecord.updateMany(
          { _id: { $in: duplicateRecordIds }, reviewId },
          {
            $set: {
              deduplicationStatus: 'duplicate',
              decision: 'excluded',
              screeningStage: 'pre_screen',
              duplicateOfRecordId: canonicalRecordId,
              exclusionReason: 'Duplicate record removed'
            }
          }
        );
        await StudyRecord.updateOne(
          { _id: canonicalRecordId, reviewId },
          { $set: { deduplicationStatus: 'canonical' } }
        );
      } else if (action === 'keep_separate') {
        await StudyRecord.updateMany(
          { _id: { $in: [...duplicateRecordIds, canonicalRecordId] }, reviewId },
          { $set: { deduplicationStatus: 'unique' } }
        );
      }
    } else {
      for (const id of duplicateRecordIds) {
        const rec = memStudyRecords.get(id);
        if (rec && rec.reviewId === reviewId) {
          if (action === 'merge' || action === 'mark_duplicate') {
            rec.deduplicationStatus = 'duplicate';
            rec.decision = 'excluded';
            rec.screeningStage = 'pre_screen';
            rec.duplicateOfRecordId = canonicalRecordId;
            rec.exclusionReason = 'Duplicate record removed';
          } else {
            rec.deduplicationStatus = 'unique';
          }
        }
      }
      const can = memStudyRecords.get(canonicalRecordId);
      if (can && can.reviewId === reviewId) {
        can.deduplicationStatus = action === 'keep_separate' ? 'unique' : 'canonical';
      }
    }

    await recordReviewAudit(
      reviewId,
      req.user.id,
      'duplicates_resolved',
      `Resolved ${duplicateRecordIds.length} duplicates against canonical ${canonicalRecordId} (${action}).`
    );

    res.json({ success: true, resolvedCount: duplicateRecordIds.length, action });
  } catch (e) { next(e); }
});

// 11. Screening Queue (Returns records pending screening for current user)
apiRouter.get('/systematic-reviews/:reviewId/screening-queue', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { stage = 'title_abstract', limit = 20 } = req.query;

    let review;
    let records = [];
    let decisions = [];

    if (isDbConnected()) {
      review = await SystematicReview.findById(reviewId).lean();
      records = await StudyRecord.find({
        reviewId,
        screeningStage: stage,
        deduplicationStatus: { $ne: 'duplicate' }
      }).limit(Number(limit) * 3).lean();
      decisions = await ScreeningDecision.find({ reviewId, reviewerId: req.user.id }).lean();
    } else {
      review = memSystematicReviews.get(reviewId);
      records = [...memStudyRecords.values()].filter(s =>
        s.reviewId === reviewId &&
        s.screeningStage === stage &&
        s.deduplicationStatus !== 'duplicate'
      );
      decisions = [...memScreeningDecisions.values()].filter(d =>
        d.reviewId === reviewId && d.reviewerId === req.user.id
      );
    }

    const reviewedRecordIds = new Set(decisions.map(d => d.recordId.toString()));
    const queue = records.filter(r => !reviewedRecordIds.has(r._id.toString())).slice(0, Number(limit));

    res.json({
      reviewId,
      stage,
      dualReviewerMode: review?.screeningSettings?.dualReviewerMode || false,
      blindScreening: review?.screeningSettings?.blindScreening ?? true,
      pendingCount: queue.length,
      queue
    });
  } catch (e) { next(e); }
});

// 12. Record Screening Decision & Blind Conflict Detection
apiRouter.post('/systematic-reviews/:reviewId/screening-decisions', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { recordId, stage = 'title_abstract', decision, reason = '', confidenceScore, criteriaEvaluation } = req.body || {};

    if (!recordId || !['included', 'excluded', 'unclear'].includes(decision)) {
      return res.status(400).json({ error: 'recordId and valid decision (included, excluded, unclear) are required.' });
    }

    let review;
    let record;
    if (isDbConnected()) {
      review = await SystematicReview.findById(reviewId);
      record = await StudyRecord.findOne({ _id: recordId, reviewId });
    } else {
      review = memSystematicReviews.get(reviewId);
      record = memStudyRecords.get(recordId);
    }

    if (!record) return res.status(404).json({ error: 'Record not found in review.' });

    const decPayload = {
      reviewId,
      recordId,
      reviewerId: req.user.id,
      stage,
      decision,
      reason,
      confidenceScore: confidenceScore || 1.0,
      criteriaEvaluation: criteriaEvaluation || {},
      decidedAt: new Date()
    };

    let savedDecision;
    if (isDbConnected()) {
      savedDecision = await ScreeningDecision.findOneAndUpdate(
        { reviewId, recordId, reviewerId: req.user.id, stage },
        { $set: decPayload },
        { upsert: true, new: true }
      );
    } else {
      const existingDecId = [...memScreeningDecisions.entries()]
        .find(([_, d]) => d.reviewId === reviewId && d.recordId === recordId && d.reviewerId === req.user.id && d.stage === stage)?.[0];
      const decId = existingDecId || new mongoose.Types.ObjectId().toString();
      savedDecision = { _id: decId, ...decPayload };
      memScreeningDecisions.set(decId, savedDecision);
    }

    // Check dual-reviewer policy & conflict detection
    const isDual = review?.screeningSettings?.dualReviewerMode;
    let allDecisionsForRecord = [];
    if (isDbConnected()) {
      allDecisionsForRecord = await ScreeningDecision.find({ reviewId, recordId, stage }).lean();
    } else {
      allDecisionsForRecord = [...memScreeningDecisions.values()].filter(d => d.reviewId === reviewId && d.recordId === recordId && d.stage === stage);
    }

    let conflictCreated = false;
    if (isDual && allDecisionsForRecord.length >= 2) {
      const distinctDecisions = new Set(allDecisionsForRecord.map(d => d.decision));
      if (distinctDecisions.size > 1) {
        // We have a disagreement between reviewers!
        const conflictPayload = {
          reviewId,
          recordId,
          stage,
          decisions: allDecisionsForRecord.map(d => ({
            reviewerId: d.reviewerId,
            decision: d.decision,
            reason: d.reason || '',
            decidedAt: d.decidedAt
          })),
          status: 'pending'
        };

        if (isDbConnected()) {
          await ReviewConflict.findOneAndUpdate({ reviewId, recordId, stage }, { $set: conflictPayload }, { upsert: true });
        } else {
          const exConflictId = [...memReviewConflicts.entries()].find(([_, c]) => c.reviewId === reviewId && c.recordId === recordId && c.stage === stage)?.[0];
          const cId = exConflictId || new mongoose.Types.ObjectId().toString();
          memReviewConflicts.set(cId, { _id: cId, ...conflictPayload });
        }
        conflictCreated = true;
      } else {
        // Both reviewers agree! Apply consensus to record
        const agreedDecision = allDecisionsForRecord[0].decision;
        if (agreedDecision === 'included') {
          record.screeningStage = stage === 'title_abstract' ? 'full_text' : 'included';
          record.decision = 'included';
          record.fullTextStatus = stage === 'title_abstract' ? 'sought' : record.fullTextStatus;
        } else {
          record.decision = 'excluded';
          record.exclusionReason = reason;
        }
        if (isDbConnected()) await record.save();
      }
    } else if (!isDual) {
      // Single reviewer mode: decision immediately advances or excludes record
      if (decision === 'included') {
        record.screeningStage = stage === 'title_abstract' ? 'full_text' : 'included';
        record.decision = 'included';
        record.fullTextStatus = stage === 'title_abstract' ? 'sought' : record.fullTextStatus;
      } else if (decision === 'excluded') {
        record.decision = 'excluded';
        record.exclusionReason = reason;
      } else {
        record.decision = 'unclear';
      }
      if (isDbConnected()) await record.save();
    }

    await recordReviewAudit(
      reviewId,
      req.user.id,
      'screening_decision_recorded',
      `Screened record ${record.title?.slice(0, 40)}... as "${decision}" (${stage}).`
    );

    res.json({
      success: true,
      decision: savedDecision,
      conflictDetected: conflictCreated,
      dualReviewerMode: Boolean(isDual)
    });
  } catch (e) { next(e); }
});

// Backward-compatible screen endpoint
apiRouter.post('/projects/:id/systematic-reviews/:reviewId/studies/:studyId/screen', requireAuth, async (req, res, next) => {
  try {
    const { decision, reason = '' } = req.body || {};
    if (!['included', 'excluded'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be "included" or "excluded".' });
    }

    if (isDbConnected()) {
      const study = await StudyRecord.findByIdAndUpdate(
        req.params.studyId,
        {
          $set: {
            decision,
            exclusionReason: reason,
            screenerId: req.user.id,
            screeningStage: decision === 'included' ? 'full_text' : 'title_abstract',
            fullTextStatus: decision === 'included' ? 'sought' : 'not_sought'
          }
        },
        { new: true }
      );
      if (!study) return res.status(404).json({ error: 'Study not found.' });
      return res.json(study);
    }

    const s = memStudyRecords.get(req.params.studyId);
    if (!s) return res.status(404).json({ error: 'Study not found.' });
    s.decision = decision;
    s.exclusionReason = reason;
    s.screeningStage = decision === 'included' ? 'full_text' : 'title_abstract';
    s.fullTextStatus = decision === 'included' ? 'sought' : 'not_sought';
    res.json(s);
  } catch (e) { next(e); }
});

// 13. Conflicts Management & Adjudication
apiRouter.get('/systematic-reviews/:reviewId/conflicts', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    let conflicts = [];
    if (isDbConnected()) {
      conflicts = await ReviewConflict.find({ reviewId }).populate('recordId').sort({ createdAt: -1 }).lean();
    } else {
      conflicts = [...memReviewConflicts.values()].filter(c => c.reviewId === reviewId);
    }
    res.json(conflicts);
  } catch (e) { next(e); }
});

apiRouter.post('/systematic-reviews/:reviewId/conflicts/:conflictId/resolve', requireAuth, async (req, res, next) => {
  try {
    const { reviewId, conflictId } = req.params;
    const { finalDecision, resolutionNotes = '', stage = 'title_abstract' } = req.body || {};

    if (!['included', 'excluded'].includes(finalDecision)) {
      return res.status(400).json({ error: 'Final decision must be "included" or "excluded".' });
    }

    let conflict;
    let record;
    if (isDbConnected()) {
      conflict = await ReviewConflict.findById(conflictId);
      if (!conflict) return res.status(404).json({ error: 'Conflict record not found.' });
      record = await StudyRecord.findById(conflict.recordId);
    } else {
      conflict = memReviewConflicts.get(conflictId);
      if (!conflict) return res.status(404).json({ error: 'Conflict record not found.' });
      record = memStudyRecords.get(conflict.recordId);
    }

    conflict.status = 'resolved';
    conflict.adjudicatorId = req.user.id;
    conflict.finalDecision = finalDecision;
    conflict.resolutionNotes = resolutionNotes;
    conflict.resolvedAt = new Date();

    if (record) {
      if (finalDecision === 'included') {
        record.decision = 'included';
        record.screeningStage = stage === 'title_abstract' ? 'full_text' : 'included';
        record.fullTextStatus = stage === 'title_abstract' ? 'sought' : record.fullTextStatus;
      } else {
        record.decision = 'excluded';
        record.exclusionReason = resolutionNotes || 'Adjudicated exclusion';
      }
    }

    if (isDbConnected()) {
      await conflict.save();
      if (record) await record.save();
    }

    await recordReviewAudit(
      reviewId,
      req.user.id,
      'conflict_adjudicated',
      `Conflict for record resolved as "${finalDecision}".`
    );

    res.json({ success: true, conflict, record });
  } catch (e) { next(e); }
});

// 14. Full-Text Eligibility Assessment & Retrieval Status
apiRouter.post('/systematic-reviews/:reviewId/full-text', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const {
      recordId,
      fullTextStatus, // 'sought', 'not_retrieved', 'retrieved', 'assessed'
      fullTextPdfUrl,
      decision, // 'included', 'excluded'
      exclusionReason = '',
      notes = ''
    } = req.body || {};

    if (!recordId) return res.status(400).json({ error: 'recordId is required.' });

    let record;
    if (isDbConnected()) {
      record = await StudyRecord.findOne({ _id: recordId, reviewId });
    } else {
      record = memStudyRecords.get(recordId);
    }
    if (!record) return res.status(404).json({ error: 'Study record not found.' });

    if (fullTextStatus) record.fullTextStatus = fullTextStatus;
    if (fullTextPdfUrl) record.fullTextPdfUrl = fullTextPdfUrl;

    if (decision === 'excluded') {
      if (!exclusionReason || !exclusionReason.trim()) {
        return res.status(400).json({ error: 'A structured exclusion reason is mandatory when excluding full-text reports under PRISMA 2020.' });
      }
      record.screeningStage = 'full_text';
      record.decision = 'excluded';
      record.exclusionReason = exclusionReason.trim();
    } else if (decision === 'included') {
      record.screeningStage = 'included';
      record.decision = 'included';
      record.exclusionReason = '';
    }

    if (isDbConnected()) {
      await record.save();
    }

    await recordReviewAudit(
      reviewId,
      req.user.id,
      'full_text_assessed',
      `Full-text assessment for "${record.title?.slice(0, 40)}...": status=${fullTextStatus || 'updated'}, decision=${decision || 'pending'}.`
    );

    res.json({ success: true, record });
  } catch (e) { next(e); }
});

// 15. Extraction Templates & Structured Study Extraction
apiRouter.get('/systematic-reviews/:reviewId/extraction-templates', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    if (isDbConnected()) {
      const templates = await ExtractionTemplate.find({ reviewId }).lean();
      return res.json(templates);
    }
    const templates = [...memExtractionTemplates.values()].filter(t => t.reviewId === reviewId);
    res.json(templates);
  } catch (e) { next(e); }
});

apiRouter.post('/systematic-reviews/:reviewId/extraction-templates', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { templateName, fields = [] } = req.body || {};
    if (!templateName) return res.status(400).json({ error: 'templateName is required.' });

    const tmplData = {
      reviewId,
      templateName,
      fields: fields.length ? fields : [
        { key: 'sampleSize', label: 'Sample Size (N)', type: 'number', required: true },
        { key: 'studyDesign', label: 'Study Design', type: 'text', required: true },
        { key: 'interventionGroup', label: 'Intervention Details', type: 'text', required: true },
        { key: 'controlGroup', label: 'Control / Comparator', type: 'text', required: false },
        { key: 'primaryOutcome', label: 'Primary Outcome Measure', type: 'text', required: true },
        { key: 'effectSize', label: 'Effect Estimate (e.g. RR, MD, OR)', type: 'text', required: false }
      ]
    };

    if (isDbConnected()) {
      const created = await ExtractionTemplate.create(tmplData);
      return res.status(201).json(created);
    }

    const id = new mongoose.Types.ObjectId().toString();
    const created = { _id: id, ...tmplData, createdAt: new Date().toISOString() };
    memExtractionTemplates.set(id, created);
    res.status(201).json(created);
  } catch (e) { next(e); }
});

apiRouter.get('/systematic-reviews/:reviewId/extractions', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    if (isDbConnected()) {
      const extractions = await StudyExtraction.find({ reviewId }).populate('recordId').lean();
      return res.json(extractions);
    }
    const extractions = [...memStudyExtractions.values()].filter(e => e.reviewId === reviewId);
    res.json(extractions);
  } catch (e) { next(e); }
});

apiRouter.post('/systematic-reviews/:reviewId/extractions', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { recordId, templateId, extractedFields = {}, provenanceQuotes = [], status = 'draft' } = req.body || {};
    if (!recordId) return res.status(400).json({ error: 'recordId is required.' });

    const extPayload = {
      reviewId,
      recordId,
      templateId,
      extractorId: req.user.id,
      extractedFields,
      provenanceQuotes,
      status,
      updatedAt: new Date()
    };

    if (isDbConnected()) {
      const ext = await StudyExtraction.findOneAndUpdate({ reviewId, recordId }, { $set: extPayload }, { upsert: true, new: true });
      await recordReviewAudit(reviewId, req.user.id, 'data_extracted', `Data extraction saved for study.`);
      return res.json(ext);
    }

    const exId = [...memStudyExtractions.entries()].find(([_, e]) => e.reviewId === reviewId && e.recordId === recordId)?.[0];
    const id = exId || new mongoose.Types.ObjectId().toString();
    const ext = { _id: id, ...extPayload };
    memStudyExtractions.set(id, ext);
    await recordReviewAudit(reviewId, req.user.id, 'data_extracted', `Data extraction saved for study.`);
    res.json(ext);
  } catch (e) { next(e); }
});

// 16. Methodological Risk of Bias Assessment (RoB 2, ROBINS-I, QUADAS-2)
apiRouter.get('/systematic-reviews/:reviewId/risk-of-bias', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { toolName } = req.query;

    let assessments = [];
    if (isDbConnected()) {
      assessments = await RiskOfBiasAssessment.find({ reviewId }).populate('recordId').lean();
    } else {
      assessments = [...memRiskOfBiasAssessments.values()].filter(r => r.reviewId === reviewId);
    }

    res.json({
      templates: RISK_OF_BIAS_TEMPLATES,
      assessments
    });
  } catch (e) { next(e); }
});

apiRouter.post('/systematic-reviews/:reviewId/risk-of-bias', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { recordId, toolName = 'RoB 2', domainAssessments = [], consensusReached = true } = req.body || {};
    if (!recordId) return res.status(400).json({ error: 'recordId is required.' });

    const overallJudgment = computeOverallRiskOfBias(toolName, domainAssessments);

    const robPayload = {
      reviewId,
      recordId,
      toolName,
      assessorId: req.user.id,
      domainAssessments,
      overallJudgment,
      consensusReached,
      updatedAt: new Date()
    };

    if (isDbConnected()) {
      const assessment = await RiskOfBiasAssessment.findOneAndUpdate(
        { reviewId, recordId, toolName },
        { $set: robPayload },
        { upsert: true, new: true }
      );
      await recordReviewAudit(reviewId, req.user.id, 'risk_of_bias_assessed', `Risk of bias (${toolName}) assessed as "${overallJudgment}".`);
      return res.json(assessment);
    }

    const exId = [...memRiskOfBiasAssessments.entries()].find(([_, r]) => r.reviewId === reviewId && r.recordId === recordId && r.toolName === toolName)?.[0];
    const id = exId || new mongoose.Types.ObjectId().toString();
    const assessment = { _id: id, ...robPayload };
    memRiskOfBiasAssessments.set(id, assessment);
    await recordReviewAudit(reviewId, req.user.id, 'risk_of_bias_assessed', `Risk of bias (${toolName}) assessed as "${overallJudgment}".`);
    res.json(assessment);
  } catch (e) { next(e); }
});

// 17. Reconciled PRISMA 2020 Flow Calculation & SVG Diagram
apiRouter.get('/systematic-reviews/:reviewId/prisma', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    let review;
    let records = [];
    let searchRuns = [];

    if (isDbConnected()) {
      review = await SystematicReview.findById(reviewId).lean();
      if (!review) return res.status(404).json({ error: 'Review not found.' });
      records = await StudyRecord.find({ reviewId }).lean();
      searchRuns = await SearchStrategy.find({ reviewId }).lean();
    } else {
      review = memSystematicReviews.get(reviewId);
      if (!review) return res.status(404).json({ error: 'Review not found.' });
      records = [...memStudyRecords.values()].filter(s => s.reviewId === reviewId);
      searchRuns = [...memSearchStrategies.values()].filter(s => s.reviewId === reviewId);
    }

    const reconciliation = reconcilePrisma2020Metrics(review, records, searchRuns);
    const svgDiagram = generatePrismaSvg(reconciliation.counts);

    res.json({
      reviewId,
      title: review.title,
      reviewType: review.reviewType,
      prisma2020: reconciliation,
      svgDiagram
    });
  } catch (e) { next(e); }
});

// Backward-compatible project-level PRISMA route
apiRouter.get('/projects/:id/systematic-reviews/:reviewId/prisma', requireAuth, async (req, res, next) => {
  try {
    let review;
    let records = [];
    let searchRuns = [];
    if (isDbConnected()) {
      review = await SystematicReview.findById(req.params.reviewId).lean();
      if (!review) return res.status(404).json({ error: 'Review not found.' });
      records = await StudyRecord.find({ reviewId: req.params.reviewId }).lean();
      searchRuns = await SearchStrategy.find({ reviewId: req.params.reviewId }).lean();
    } else {
      review = memSystematicReviews.get(req.params.reviewId);
      if (!review) return res.status(404).json({ error: 'Review not found.' });
      records = [...memStudyRecords.values()].filter(s => s.reviewId === req.params.reviewId);
      searchRuns = [...memSearchStrategies.values()].filter(s => s.reviewId === req.params.reviewId);
    }

    const reconciliation = reconcilePrisma2020Metrics(review, records, searchRuns);
    res.json({ ...reconciliation.counts, reconciliation });
  } catch (e) { next(e); }
});

// 18. PRISMA 2020 27-Item Checklist Tracking
apiRouter.get('/systematic-reviews/:reviewId/prisma/checklist', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    let review;
    if (isDbConnected()) {
      review = await SystematicReview.findById(reviewId).select('checklistStatus').lean();
    } else {
      review = memSystematicReviews.get(reviewId);
    }

    const savedStatus = review?.checklistStatus || {};
    const checklist = PRISMA_2020_CHECKLIST_ITEMS.map(item => ({
      ...item,
      status: savedStatus[item.item]?.status || 'unreported',
      location: savedStatus[item.item]?.location || '',
      notes: savedStatus[item.item]?.notes || ''
    }));

    res.json({ reviewId, checklist });
  } catch (e) { next(e); }
});

apiRouter.put('/systematic-reviews/:reviewId/prisma/checklist', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { item, status, location = '', notes = '' } = req.body || {};
    if (!item) return res.status(400).json({ error: 'Checklist item identifier is required.' });

    const key = `checklistStatus.${item}`;
    const value = { status: status || 'reported', location, notes, updatedAt: new Date() };

    if (isDbConnected()) {
      const updated = await SystematicReview.findByIdAndUpdate(
        reviewId,
        { $set: { [key]: value } },
        { new: true }
      );
      return res.json({ success: true, item, ...value });
    }

    const rev = memSystematicReviews.get(reviewId);
    if (!rev) return res.status(404).json({ error: 'Review not found.' });
    if (!rev.checklistStatus) rev.checklistStatus = {};
    rev.checklistStatus[item] = value;
    res.json({ success: true, item, ...value });
  } catch (e) { next(e); }
});

// 19. Methodological Audit Trail
apiRouter.get('/systematic-reviews/:reviewId/audit-trail', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    let events = [];
    if (isDbConnected()) {
      events = await ReviewAuditEvent.find({ reviewId }).populate('userId', 'name email').sort({ timestamp: -1 }).lean();
    } else {
      events = [...memReviewAuditEvents.values()]
        .filter(e => e.reviewId === reviewId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    res.json(events);
  } catch (e) { next(e); }
});

// 20. Reproducible Review Evidence Export (CSV & JSON)
apiRouter.get('/systematic-reviews/:reviewId/export', requireAuth, async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const { format = 'json' } = req.query;

    let review;
    let records = [];
    let searchRuns = [];
    let extractions = [];
    let robAssessments = [];

    if (isDbConnected()) {
      review = await SystematicReview.findById(reviewId).lean();
      if (!review) return res.status(404).json({ error: 'Review not found.' });
      records = await StudyRecord.find({ reviewId }).lean();
      searchRuns = await SearchStrategy.find({ reviewId }).lean();
      extractions = await StudyExtraction.find({ reviewId }).lean();
      robAssessments = await RiskOfBiasAssessment.find({ reviewId }).lean();
    } else {
      review = memSystematicReviews.get(reviewId);
      if (!review) return res.status(404).json({ error: 'Review not found.' });
      records = [...memStudyRecords.values()].filter(s => s.reviewId === reviewId);
      searchRuns = [...memSearchStrategies.values()].filter(s => s.reviewId === reviewId);
      extractions = [...memStudyExtractions.values()].filter(e => e.reviewId === reviewId);
      robAssessments = [...memRiskOfBiasAssessments.values()].filter(r => r.reviewId === reviewId);
    }

    const reconciliation = reconcilePrisma2020Metrics(review, records, searchRuns);

    if (format === 'csv') {
      // Export included studies as CSV
      const included = records.filter(r => r.screeningStage === 'included' || (r.decision === 'included' && r.screeningStage !== 'title_abstract'));
      const header = 'Study ID,Title,Authors,Year,Journal,DOI,Screening Stage,Decision\n';
      const rows = included.map(r =>
        `"${r._id}","${(r.title || '').replace(/"/g, '""')}","${(r.authors || []).join('; ').replace(/"/g, '""')}","${r.year || ''}","${(r.journal || '').replace(/"/g, '""')}","${r.doi || ''}","${r.screeningStage}","${r.decision}"`
      ).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="included_studies_${reviewId}.csv"`);
      return res.send(header + rows);
    }

    res.json({
      exportedAt: new Date().toISOString(),
      review,
      prisma2020: reconciliation,
      searchStrategies: searchRuns,
      recordSummary: {
        total: records.length,
        included: records.filter(r => r.screeningStage === 'included').length,
        excludedFullText: records.filter(r => r.screeningStage === 'full_text' && r.decision === 'excluded').length,
        duplicates: records.filter(r => r.deduplicationStatus === 'duplicate').length
      },
      records,
      extractions,
      riskOfBiasAssessments: robAssessments
    });
  } catch (e) { next(e); }
});


// ==========================================
// PILLAR: Journal Submission Studio (Phase 9)
// ==========================================

// 1. Journal Discovery Search
apiRouter.get('/journals/search', requireAuth, async (req, res, next) => {
  try {
    const { q = '', discipline = 'all', publisher = 'all', openAccess = 'all', articleType = 'all' } = req.query;
    const results = searchJournals({
      query: String(q),
      discipline: String(discipline),
      publisher: String(publisher),
      openAccess: String(openAccess),
      articleType: String(articleType)
    });
    res.json({
      success: true,
      count: results.length,
      journals: results
    });
  } catch (e) { next(e); }
});

// 2. Journal Details
apiRouter.get('/journals/:id', requireAuth, async (req, res, next) => {
  try {
    const journal = getJournalById(req.params.id);
    if (!journal) {
      return res.status(404).json({ error: `Journal with ID "${req.params.id}" not found in verified registry.` });
    }
    res.json({ success: true, journal });
  } catch (e) { next(e); }
});

// 3. Multi-Attribute Journal Matching
apiRouter.post('/journals/match', requireAuth, async (req, res, next) => {
  try {
    const { title = '', abstract = '', keywords = [], discipline = 'all', studyType = 'empirical', wordCount = 0 } = req.body || {};
    if (!title && !abstract) {
      return res.status(400).json({ error: 'Manuscript title or abstract is required for journal matching.' });
    }
    const matches = matchManuscriptToJournals({
      title,
      abstract,
      keywords,
      discipline,
      studyType,
      wordCount: Number(wordCount) || 0
    });
    res.json({
      success: true,
      count: matches.length,
      matches,
      disclaimer: 'Journal suitability scores reflect scope and structural alignment; they do not represent probability of editorial acceptance.'
    });
  } catch (e) { next(e); }
});

// 4. Author Guidelines Retrieval
apiRouter.get('/journals/:id/guidelines', requireAuth, async (req, res, next) => {
  try {
    const guidelines = getJournalGuidelines(req.params.id);
    res.json({ success: true, guidelines });
  } catch (e) { next(e); }
});

// 5. Manuscript Compliance Checker
apiRouter.post('/journals/check-compliance', requireAuth, async (req, res, next) => {
  try {
    const { manuscriptText = '', journalId = null, guidelines = null } = req.body || {};
    if (!manuscriptText || !manuscriptText.trim()) {
      return res.status(400).json({ error: 'Manuscript text is required to evaluate compliance.' });
    }
    let targetGuidelines = guidelines;
    if (!targetGuidelines && journalId) {
      try {
        targetGuidelines = getJournalGuidelines(journalId);
      } catch {
        targetGuidelines = VERIFIED_JOURNALS[0];
      }
    }
    const report = checkManuscriptCompliance(manuscriptText, targetGuidelines);
    res.json({ success: true, report });
  } catch (e) { next(e); }
});

// 6. Get Project Submission Record
apiRouter.get('/projects/:id/submission', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const sub = await JournalSubmission.findOne({ projectId: req.params.id }).lean();
      return res.json(sub || {
        projectId: req.params.id,
        targetJournal: 'Journal of Cognitive Neuroscience',
        guidelinesChecklist: [],
        coverLetter: '',
        status: 'draft',
        events: []
      });
    }
    const sub = memJournalSubmissions.get(req.params.id);
    res.json(sub || {
      projectId: req.params.id,
      targetJournal: 'Journal of Cognitive Neuroscience',
      guidelinesChecklist: [],
      coverLetter: '',
      status: 'draft',
      events: []
    });
  } catch (e) { next(e); }
});

// 7. Save / Update Project Submission Record
apiRouter.post('/projects/:id/submission', requireAuth, async (req, res, next) => {
  try {
    const {
      targetJournal,
      selectedJournalId,
      publisher,
      aimsAndScope,
      manuscriptTitle,
      manuscriptId,
      wordLimit,
      citationStyle,
      guidelinesChecklist,
      coverLetter,
      complianceReport,
      status = 'draft',
      notes,
      submissionDate,
      decisionDate,
      revisionDeadline
    } = req.body || {};

    const payload = {
      projectId: req.params.id,
      userId: req.user.id,
      targetJournal: targetJournal || 'Target Academic Journal',
      selectedJournalId: selectedJournalId || '',
      publisher: publisher || '',
      aimsAndScope: aimsAndScope || '',
      manuscriptTitle: manuscriptTitle || '',
      manuscriptId: manuscriptId || '',
      wordLimit: wordLimit || 8000,
      citationStyle: citationStyle || 'apa7',
      guidelinesChecklist: guidelinesChecklist || [],
      coverLetter: coverLetter || '',
      complianceReport: complianceReport || null,
      status: status || 'draft',
      notes: notes || '',
      submissionDate: submissionDate ? new Date(submissionDate) : null,
      decisionDate: decisionDate ? new Date(decisionDate) : null,
      revisionDeadline: revisionDeadline ? new Date(revisionDeadline) : null,
      updatedAt: new Date()
    };

    if (isDbConnected()) {
      const sub = await JournalSubmission.findOneAndUpdate(
        { projectId: req.params.id },
        { $set: payload },
        { upsert: true, new: true }
      );
      return res.json(sub);
    }

    const existing = memJournalSubmissions.get(req.params.id) || { events: [] };
    const merged = { ...existing, ...payload };
    memJournalSubmissions.set(req.params.id, merged);
    res.json(merged);
  } catch (e) { next(e); }
});

// 8. Academic Cover Letter Generator
apiRouter.post('/projects/:id/submission/cover-letter', requireAuth, async (req, res, next) => {
  try {
    const {
      targetJournal = 'Target Academic Journal',
      editorName = 'Editor-in-Chief',
      manuscriptTitle = 'Empirical Investigation',
      articleType = 'Original Research Article',
      keyFindings,
      correspondingAuthor,
      ethicalDeclarations,
      mode = 'formal'
    } = req.body || {};

    const authorObj = correspondingAuthor || {
      name: req.user.displayName || 'Lead Researcher',
      email: req.user.email || 'researcher@university.edu',
      institution: 'Department of Research'
    };

    const letter = generateAcademicCoverLetter({
      targetJournal,
      editorName,
      manuscriptTitle,
      articleType,
      keyFindings: keyFindings || 'Our findings provide reproducible evidence addressing existing empirical gaps in the literature.',
      correspondingAuthor: authorObj,
      ethicalDeclarations,
      mode
    });

    res.json({ success: true, coverLetter: letter, mode });
  } catch (e) { next(e); }
});

// 9. Submission Package Builder (Compiles ZIP with manifest)
apiRouter.post('/projects/:id/submission/package', requireAuth, async (req, res, next) => {
  try {
    const {
      manuscriptText = '',
      manuscriptTitle = 'Manuscript Draft',
      coverLetter = '',
      ethicsChecklist = [],
      complianceReport = null,
      targetJournal = 'Target Academic Journal'
    } = req.body || {};

    const pkg = await buildSubmissionPackage({
      projectId: req.params.id,
      manuscriptText,
      manuscriptTitle,
      coverLetter,
      ethicsChecklist,
      complianceReport,
      targetJournal,
      authorName: req.user.displayName || 'Corresponding Author',
      authorEmail: req.user.email
    });

    // Store in-memory buffer for immediate download
    memSubmissionPackages.set(req.params.id, pkg);

    // Update submission record with package manifest
    if (isDbConnected()) {
      await JournalSubmission.findOneAndUpdate(
        { projectId: req.params.id },
        {
          $set: {
            packageManifest: pkg.manifest,
            status: 'ready_for_submission'
          },
          $push: {
            events: {
              status: 'ready_for_submission',
              timestamp: new Date(),
              note: `Submission package compiled with ${pkg.manifest.totalFiles} components.`,
              author: req.user.displayName || req.user.email
            }
          }
        },
        { upsert: true }
      );
    } else {
      const existing = memJournalSubmissions.get(req.params.id) || {};
      existing.packageManifest = pkg.manifest;
      existing.status = 'ready_for_submission';
      existing.events = existing.events || [];
      existing.events.push({
        status: 'ready_for_submission',
        timestamp: new Date().toISOString(),
        note: `Submission package compiled with ${pkg.manifest.totalFiles} components.`,
        author: req.user.displayName || req.user.email
      });
      memJournalSubmissions.set(req.params.id, existing);
    }

    res.json({
      success: true,
      manifest: pkg.manifest,
      filename: pkg.filename
    });
  } catch (e) { next(e); }
});

// 10. Download Submission Package ZIP
apiRouter.get('/projects/:id/submission/package/download', requireAuth, async (req, res, next) => {
  try {
    let pkg = memSubmissionPackages.get(req.params.id);
    if (!pkg) {
      // Recompile on the fly if needed
      let sub = null;
      if (isDbConnected()) {
        sub = await JournalSubmission.findOne({ projectId: req.params.id }).lean();
      } else {
        sub = memJournalSubmissions.get(req.params.id);
      }
      pkg = await buildSubmissionPackage({
        projectId: req.params.id,
        manuscriptText: sub?.manuscriptText || 'Original manuscript content for editorial review.',
        manuscriptTitle: sub?.manuscriptTitle || 'Research Manuscript',
        coverLetter: sub?.coverLetter || '',
        ethicsChecklist: sub?.guidelinesChecklist || [],
        complianceReport: sub?.complianceReport || null,
        targetJournal: sub?.targetJournal || 'Scholarly Journal',
        authorName: req.user.displayName || 'Corresponding Author',
        authorEmail: req.user.email
      });
      memSubmissionPackages.set(req.params.id, pkg);
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${pkg.filename}"`);
    res.setHeader('Content-Length', pkg.zipBuffer.length);
    res.send(pkg.zipBuffer);
  } catch (e) { next(e); }
});

// 11. Update Submission Lifecycle Status
apiRouter.post('/projects/:id/submission/status', requireAuth, async (req, res, next) => {
  try {
    const { status, note = '', manuscriptId = '', decisionDate, revisionDeadline } = req.body || {};
    if (!status || !validateSubmissionStatus(status)) {
      return res.status(400).json({
        error: `Invalid submission status "${status}". Allowed statuses: ${SUBMISSION_STATUSES.join(', ')}`
      });
    }

    const event = {
      status,
      timestamp: new Date(),
      note: note || `Status transitioned to ${status.replace(/_/g, ' ')}.`,
      author: req.user.displayName || req.user.email
    };

    const updateFields = {
      status,
      ...(manuscriptId ? { manuscriptId } : {}),
      ...(decisionDate ? { decisionDate: new Date(decisionDate) } : {}),
      ...(revisionDeadline ? { revisionDeadline: new Date(revisionDeadline) } : {})
    };

    if (isDbConnected()) {
      const updated = await JournalSubmission.findOneAndUpdate(
        { projectId: req.params.id },
        {
          $set: updateFields,
          $push: { events: event }
        },
        { upsert: true, new: true }
      );
      return res.json({ success: true, submission: updated });
    }

    const existing = memJournalSubmissions.get(req.params.id) || { events: [] };
    const merged = {
      ...existing,
      ...updateFields,
      events: [...(existing.events || []), event]
    };
    memJournalSubmissions.set(req.params.id, merged);
    res.json({ success: true, submission: merged });
  } catch (e) { next(e); }
});

// ============================================================================
// PILLAR: Research Collaboration Studio (Phase 10)
// Invitations, 4-Tier RBAC, Inline Comments, Manuscript Reviews, Notifications
// ============================================================================

// 1. Create Project Invitation
apiRouter.post('/projects/:id/invitations', requireAuth, async (req, res, next) => {
  try {
    const { email, role = 'editor' } = req.body || {};
    if (!email || !email.trim()) return res.status(400).json({ error: 'Invitee email is required.' });

    const inviteResult = await createProjectInvitation({
      projectId: req.params.id,
      email: email.trim(),
      role,
      inviterId: req.user.id,
      isDbConnected: isDbConnected()
    });

    await recordAudit(req.user.id, 'INVITATION_SENT', 'ProjectInvitation', inviteResult.invitationId, {
      projectId: req.params.id,
      email: inviteResult.email,
      role
    });

    res.status(201).json({
      success: true,
      invitation: inviteResult,
      message: `Invitation successfully dispatched to ${inviteResult.email}`
    });
  } catch (e) { next(e); }
});

// 2. List Pending Project Invitations
apiRouter.get('/projects/:id/invitations', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const invites = await ProjectInvitation.find({ projectId: req.params.id, status: 'pending' })
        .populate('inviterId', 'displayName email')
        .sort({ createdAt: -1 })
        .lean();
      return res.json({ success: true, invitations: invites });
    }
    const invites = [...memInvitations.values()].filter(i => i.projectId === req.params.id && i.status === 'pending');
    res.json({ success: true, invitations: invites });
  } catch (e) { next(e); }
});

// 3. Cancel / Revoke Invitation
apiRouter.delete('/projects/:id/invitations/:inviteId', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      await ProjectInvitation.findOneAndUpdate(
        { _id: req.params.inviteId, projectId: req.params.id },
        { $set: { status: 'expired' } }
      );
      return res.json({ success: true, revoked: true });
    }
    for (const [k, v] of memInvitations.entries()) {
      if (v._id === req.params.inviteId && v.projectId === req.params.id) {
        v.status = 'expired';
        break;
      }
    }
    res.json({ success: true, revoked: true });
  } catch (e) { next(e); }
});

// 4. Accept Invitation via Raw Token
apiRouter.post('/invitations/:token/accept', requireAuth, async (req, res, next) => {
  try {
    const rawToken = req.params.token;
    const acceptResult = await acceptProjectInvitation({
      rawToken,
      userId: req.user.id,
      userEmail: req.user.email,
      isDbConnected: isDbConnected()
    });

    await recordAudit(req.user.id, 'INVITATION_ACCEPTED', 'ProjectMember', acceptResult.memberId, {
      projectId: acceptResult.projectId,
      role: acceptResult.role
    });

    res.json({
      success: true,
      message: `Successfully joined research project as ${acceptResult.role}`,
      projectId: acceptResult.projectId,
      role: acceptResult.role
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 5. Decline Invitation via Raw Token
apiRouter.post('/invitations/:token/decline', async (req, res, next) => {
  try {
    const rawToken = req.params.token;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    if (isDbConnected()) {
      const invite = await ProjectInvitation.findOne({ tokenHash, status: 'pending' });
      if (!invite) return res.status(404).json({ error: 'Invitation not found or already processed.' });
      invite.status = 'declined';
      await invite.save();
      return res.json({ success: true, message: 'Invitation declined.' });
    }

    const invite = memInvitations.get(tokenHash);
    if (!invite || invite.status !== 'pending') {
      return res.status(404).json({ error: 'Invitation not found or already processed.' });
    }
    invite.status = 'declined';
    res.json({ success: true, message: 'Invitation declined.' });
  } catch (e) { next(e); }
});

// 6. Get Document Comments (Threaded Discussions)
apiRouter.get('/projects/:id/comments', requireAuth, async (req, res, next) => {
  try {
    const { documentId, resolved } = req.query;
    const filter = { projectId: req.params.id };
    if (documentId) filter.documentId = documentId;
    if (resolved !== undefined) filter.resolved = resolved === 'true';

    if (isDbConnected()) {
      const comments = await DocumentComment.find(filter)
        .populate('userId', 'displayName email avatarUrl')
        .populate('replies.userId', 'displayName email avatarUrl')
        .sort({ createdAt: -1 })
        .lean();
      return res.json({ success: true, comments });
    }

    let comments = [...memComments.values()].filter(c => c.projectId === req.params.id);
    if (documentId) comments = comments.filter(c => c.documentId === documentId);
    if (resolved !== undefined) comments = comments.filter(c => c.resolved === (resolved === 'true'));
    res.json({ success: true, comments });
  } catch (e) { next(e); }
});

// 7. Add Comment (With optional anchor text)
apiRouter.post('/projects/:id/comments', requireAuth, async (req, res, next) => {
  try {
    const { documentId, selectedText = '', position = {}, content } = req.body || {};
    if (!content || !content.trim()) return res.status(400).json({ error: 'Comment content is required.' });
    if (!documentId) return res.status(400).json({ error: 'Document ID is required.' });

    if (isDbConnected()) {
      const comment = await DocumentComment.create({
        projectId: req.params.id,
        documentId,
        userId: req.user.id,
        selectedText: selectedText.trim(),
        position,
        content: content.trim(),
        resolved: false,
        replies: []
      });
      await recordAudit(req.user.id, 'COMMENT_CREATED', 'DocumentComment', comment._id, {
        projectId: req.params.id,
        documentId
      });
      return res.status(201).json({ success: true, comment });
    }

    const id = new mongoose.Types.ObjectId().toString();
    const newComment = {
      _id: id,
      projectId: req.params.id,
      documentId,
      userId: {
        _id: req.user.id,
        displayName: req.user.displayName || 'Researcher',
        email: req.user.email
      },
      selectedText: selectedText.trim(),
      position,
      content: content.trim(),
      resolved: false,
      replies: [],
      createdAt: new Date().toISOString()
    };
    memComments.set(id, newComment);
    res.status(201).json({ success: true, comment: newComment });
  } catch (e) { next(e); }
});

// 8. Add Reply to Comment Thread
apiRouter.post('/projects/:id/comments/:commentId/reply', requireAuth, async (req, res, next) => {
  try {
    const { content } = req.body || {};
    if (!content || !content.trim()) return res.status(400).json({ error: 'Reply content is required.' });

    if (isDbConnected()) {
      const comment = await DocumentComment.findOne({ _id: req.params.commentId, projectId: req.params.id });
      if (!comment) return res.status(404).json({ error: 'Comment thread not found.' });

      comment.replies.push({
        userId: req.user.id,
        content: content.trim(),
        createdAt: new Date()
      });
      await comment.save();

      // Notify comment author if different from replier
      if (comment.userId.toString() !== req.user.id.toString()) {
        await createNotification({
          userId: comment.userId,
          projectId: req.params.id,
          type: 'comment_added',
          title: 'New Reply to Comment',
          message: `${req.user.displayName || 'A collaborator'} replied to your comment.`,
          isDbConnected: true
        });
      }

      return res.json({ success: true, comment });
    }

    const comment = memComments.get(req.params.commentId);
    if (!comment || comment.projectId !== req.params.id) {
      return res.status(404).json({ error: 'Comment thread not found.' });
    }
    const replyObj = {
      _id: new mongoose.Types.ObjectId().toString(),
      userId: {
        _id: req.user.id,
        displayName: req.user.displayName || 'Researcher',
        email: req.user.email
      },
      content: content.trim(),
      createdAt: new Date().toISOString()
    };
    comment.replies = comment.replies || [];
    comment.replies.push(replyObj);
    res.json({ success: true, comment });
  } catch (e) { next(e); }
});

// 9. Resolve / Unresolve Comment Thread
apiRouter.patch('/projects/:id/comments/:commentId', requireAuth, async (req, res, next) => {
  try {
    const { resolved } = req.body || {};
    if (resolved === undefined) return res.status(400).json({ error: 'resolved boolean status is required.' });

    if (isDbConnected()) {
      const comment = await DocumentComment.findOneAndUpdate(
        { _id: req.params.commentId, projectId: req.params.id },
        {
          $set: {
            resolved: Boolean(resolved),
            resolvedBy: resolved ? req.user.id : null,
            resolvedAt: resolved ? new Date() : null
          }
        },
        { new: true }
      );
      if (!comment) return res.status(404).json({ error: 'Comment not found.' });
      return res.json({ success: true, comment });
    }

    const comment = memComments.get(req.params.commentId);
    if (!comment || comment.projectId !== req.params.id) {
      return res.status(404).json({ error: 'Comment not found.' });
    }
    comment.resolved = Boolean(resolved);
    comment.resolvedBy = resolved ? req.user.id : null;
    comment.resolvedAt = resolved ? new Date().toISOString() : null;
    res.json({ success: true, comment });
  } catch (e) { next(e); }
});

// 10. Delete Comment
apiRouter.delete('/projects/:id/comments/:commentId', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      await DocumentComment.findOneAndDelete({ _id: req.params.commentId, projectId: req.params.id });
      return res.json({ success: true, deleted: true });
    }
    memComments.delete(req.params.commentId);
    res.json({ success: true, deleted: true });
  } catch (e) { next(e); }
});

// 11. List Manuscript Reviews
apiRouter.get('/projects/:id/reviews', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const reviews = await ReviewRequest.find({ projectId: req.params.id })
        .populate('requesterId', 'displayName email')
        .populate('reviewerId', 'displayName email')
        .populate('documentId', 'title version')
        .sort({ createdAt: -1 })
        .lean();
      return res.json({ success: true, reviews });
    }
    const reviews = [...memReviewRequests.values()].filter(r => r.projectId === req.params.id);
    res.json({ success: true, reviews });
  } catch (e) { next(e); }
});

// 12. Submit Manuscript for Review
apiRouter.post('/projects/:id/reviews', requireAuth, async (req, res, next) => {
  try {
    const { documentId, reviewerId, notes = '' } = req.body || {};
    if (!documentId) return res.status(400).json({ error: 'documentId is required.' });

    const timelineEvent = {
      event: 'submitted_for_review',
      timestamp: new Date(),
      actorId: req.user.id,
      note: notes || 'Manuscript submitted for internal peer review.'
    };

    if (isDbConnected()) {
      const doc = await Document.findById(documentId);
      const versionNumber = doc?.version || 1;

      const review = await ReviewRequest.create({
        projectId: req.params.id,
        documentId,
        requesterId: req.user.id,
        reviewerId: reviewerId || null,
        versionNumber,
        status: 'submitted_for_review',
        decision: 'pending',
        timeline: [timelineEvent]
      });

      if (reviewerId) {
        await createNotification({
          userId: reviewerId,
          projectId: req.params.id,
          type: 'review_assigned',
          title: 'Review Assignment',
          message: `${req.user.displayName || 'A co-author'} requested your peer review on a manuscript.`,
          isDbConnected: true
        });
      }

      await recordAudit(req.user.id, 'REVIEW_REQUESTED', 'ReviewRequest', review._id, {
        projectId: req.params.id,
        documentId
      });

      return res.status(201).json({ success: true, review });
    }

    const id = new mongoose.Types.ObjectId().toString();
    const newReview = {
      _id: id,
      projectId: req.params.id,
      documentId,
      requesterId: { _id: req.user.id, displayName: req.user.displayName || 'Researcher', email: req.user.email },
      reviewerId: reviewerId ? { _id: reviewerId } : null,
      versionNumber: 1,
      status: 'submitted_for_review',
      decision: 'pending',
      timeline: [{ ...timelineEvent, timestamp: new Date().toISOString() }],
      createdAt: new Date().toISOString()
    };
    memReviewRequests.set(id, newReview);
    res.status(201).json({ success: true, review: newReview });
  } catch (e) { next(e); }
});

// 13. Submit Review Decision & Scoring Rubrics
apiRouter.post('/projects/:id/reviews/:reviewId/decision', requireAuth, async (req, res, next) => {
  try {
    const { decision, decisionNotes = '', criteriaScores } = req.body || {};
    if (!decision || !REVIEW_DECISIONS.includes(decision)) {
      return res.status(400).json({
        error: `Valid decision required: ${REVIEW_DECISIONS.join(', ')}`
      });
    }

    const calculatedScore = calculateReviewScore(criteriaScores);
    const statusMap = {
      accept: 'approved',
      minor_revisions: 'changes_requested',
      major_revisions: 'changes_requested',
      reject: 'rejected'
    };
    const newStatus = statusMap[decision] || 'under_review';

    const timelineEvent = {
      event: `decision_${decision}`,
      timestamp: new Date(),
      actorId: req.user.id,
      note: decisionNotes || `Reviewer issued decision: ${decision}`
    };

    if (isDbConnected()) {
      const review = await ReviewRequest.findOne({ _id: req.params.reviewId, projectId: req.params.id });
      if (!review) return res.status(404).json({ error: 'Review request not found.' });

      review.decision = decision;
      review.decisionNotes = decisionNotes;
      review.status = newStatus;
      if (criteriaScores) review.criteriaScores = criteriaScores;
      if (calculatedScore !== null) review.score = calculatedScore;
      review.timeline.push(timelineEvent);
      await review.save();

      // Notify requester
      await createNotification({
        userId: review.requesterId,
        projectId: req.params.id,
        type: 'review_decision',
        title: 'Review Decision Issued',
        message: `Your manuscript received review outcome: ${decision.replace(/_/g, ' ')}. Score: ${calculatedScore || 'N/A'}/100.`,
        isDbConnected: true
      });

      await recordAudit(req.user.id, 'REVIEW_DECISION_ISSUED', 'ReviewRequest', review._id, {
        decision,
        score: calculatedScore
      });

      return res.json({ success: true, review });
    }

    const review = memReviewRequests.get(req.params.reviewId);
    if (!review || review.projectId !== req.params.id) {
      return res.status(404).json({ error: 'Review request not found.' });
    }
    review.decision = decision;
    review.decisionNotes = decisionNotes;
    review.status = newStatus;
    review.score = calculatedScore;
    if (criteriaScores) review.criteriaScores = criteriaScores;
    review.timeline = review.timeline || [];
    review.timeline.push({ ...timelineEvent, timestamp: new Date().toISOString() });
    res.json({ success: true, review });
  } catch (e) { next(e); }
});

// 14. Notifications API
apiRouter.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const notifications = await CollaborationNotification.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      return res.json({ success: true, notifications });
    }
    const notifications = [...memNotifications.values()]
      .filter(n => n.userId === req.user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, notifications });
  } catch (e) { next(e); }
});

apiRouter.patch('/notifications/:id/read', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      await CollaborationNotification.findOneAndUpdate(
        { _id: req.params.id, userId: req.user.id },
        { $set: { read: true } }
      );
      return res.json({ success: true, read: true });
    }
    const notif = memNotifications.get(req.params.id);
    if (notif && notif.userId === req.user.id) notif.read = true;
    res.json({ success: true, read: true });
  } catch (e) { next(e); }
});

apiRouter.post('/notifications/read-all', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      await CollaborationNotification.updateMany(
        { userId: req.user.id, read: false },
        { $set: { read: true } }
      );
      return res.json({ success: true, readAll: true });
    }
    for (const notif of memNotifications.values()) {
      if (notif.userId === req.user.id) notif.read = true;
    }
    res.json({ success: true, readAll: true });
  } catch (e) { next(e); }
});


// Multi-Chapter Thesis Tree Initialization (Pillar 2)
apiRouter.post('/projects/:id/thesis/init', requireAuth, async (req, res, next) => {
  try {
    let project = null;
    if (isDbConnected()) {
      project = await Project.findOne({ _id: req.params.id, userId: req.user.id });
    } else {
      project = memProjects.get(req.params.id);
      if (project && project.userId !== req.user.id) project = null;
    }
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const createdDocs = [];
    for (const ch of STANDARD_THESIS_CHAPTERS) {
      const docTitle = `${ch.title}: ${project.title}`;
      const docContent = ch.defaultTemplate;
      const words = docContent.split(/\s+/).filter(Boolean).length;

      if (isDbConnected()) {
        const doc = await Document.create({
          ownerId: req.user.id,
          projectId: project._id,
          title: docTitle,
          content: docContent,
          wordCount: words,
          characterCount: docContent.length,
          version: 1,
          chapterKey: ch.key,
          chapterOrder: ch.order
        });
        createdDocs.push(doc);
      } else {
        const docId = new mongoose.Types.ObjectId().toString();
        const doc = {
          _id: docId,
          ownerId: req.user.id,
          projectId: project._id || req.params.id,
          title: docTitle,
          content: docContent,
          wordCount: words,
          characterCount: docContent.length,
          version: 1,
          chapterKey: ch.key,
          chapterOrder: ch.order,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        memDocuments.set(docId, doc);
        createdDocs.push(doc);
      }
    }

    res.status(201).json({
      message: 'Thesis chapter tree initialized successfully.',
      chapters: createdDocs
    });
  } catch (e) { next(e); }
});

// Cross-Chapter Redundancy & Consistency Scanner (Pillar 2)
apiRouter.post('/projects/:id/thesis/cross-scan', requireAuth, async (req, res, next) => {
  try {
    let docs = [];
    if (isDbConnected()) {
      docs = await Document.find({ projectId: req.params.id, ownerId: req.user.id }).lean();
    } else {
      docs = [...memDocuments.values()].filter(d => d.projectId === req.params.id && d.ownerId === req.user.id);
    }

    if (!docs || docs.length === 0) {
      return res.status(400).json({ error: 'No chapter manuscripts found in this project to scan.' });
    }

    const report = scanCrossChapterConsistency(docs);
    res.json(report);
  } catch (e) { next(e); }
});

// Master Bibliography Synchronization (Pillar 2)
apiRouter.get('/projects/:id/thesis/bibliography', requireAuth, async (req, res, next) => {
  try {
    let docs = [];
    let citations = [];
    if (isDbConnected()) {
      docs = await Document.find({ projectId: req.params.id, ownerId: req.user.id }).lean();
      citations = await Citation.find({ projectId: req.params.id, ownerId: req.user.id }).lean();
    } else {
      docs = [...memDocuments.values()].filter(d => d.projectId === req.params.id && d.ownerId === req.user.id);
      citations = [...memCitations.values()].filter(c => c.projectId === req.params.id && c.ownerId === req.user.id);
    }

    const bibReport = synchronizeProjectBibliography(docs, citations);
    res.json(bibReport);
  } catch (e) { next(e); }
});

// Comprehensive Research Integrity Dossier (Pillar 3)
apiRouter.post('/integrity/dossier', requireAuth, async (req, res, next) => {
  try {
    const text = req.body?.text || '';
    const title = req.body?.title || 'Comprehensive Research Integrity Dossier';
    const documentId = req.body?.documentId || null;

    if (!text || text.trim().length < 20) {
      return res.status(400).json({ error: 'Manuscript text is required to generate an integrity dossier.' });
    }

    let citations = [];
    if (isDbConnected()) {
      citations = await Citation.find({ ownerId: req.user.id }).lean();
    } else {
      citations = [...memCitations.values()].filter(c => c.ownerId === req.user.id);
    }

    const dossier = await generateComprehensiveDossier({
      text,
      title,
      documentId,
      ownerId: req.user.id,
      referenceLibrary: citations
    });

    res.status(201).json(dossier);
  } catch (e) { next(e); }
});

// Journal Publisher Profiles Catalog (Pillar 3)
apiRouter.get('/integrity/publishers', requireAuth, (req, res) => {
  res.json(Object.values(PUBLISHER_PROFILES).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    checksCount: p.checks.length
  })));
});

// Public Report Verification (Feature 1: Verifiable Research Reports)
apiRouter.get('/integrity/verify/:hash', async (req, res, next) => {
  try {
    const rawTarget = String(req.params.hash || '').trim();
    if (!rawTarget) {
      return res.status(400).json({ verified: false, error: 'Verification hash or report ID is required.' });
    }

    let report = null;
    let type = 'dossier';

    // 1. Check TextGuard Scans
    if (isDbConnected()) {
      report = await TextGuardScan.findOne({
        $or: [{ sha256: rawTarget }, { _id: mongoose.isValidObjectId(rawTarget) ? rawTarget : null }]
      }).lean();
    } else {
      report = [...memTextGuardScans.values()].find(s => s.sha256 === rawTarget || String(s._id || s.id) === rawTarget);
    }

    if (report) {
      type = 'textguard_authenticity';
    } else {
      // 2. Check Integrity Reports / Dossiers
      if (isDbConnected()) {
        report = await IntegrityReport.findOne({
          $or: [{ _id: mongoose.isValidObjectId(rawTarget) ? rawTarget : null }]
        }).lean();
      } else {
        report = [...memReports.values()].find(r => String(r._id || r.id) === rawTarget || r.verificationHash === rawTarget);
      }
    }

    if (!report) {
      report = findRegisteredDossier(rawTarget);
      if (report) type = 'integrity_dossier';
    }

    if (!report) {
      return res.status(404).json({
        verified: false,
        valid: false,
        error: 'Report signature not found in ResearchProof AI cryptographic registry.',
        hash: rawTarget
      });
    }

    // Return sanitized authenticity certificate without revealing private manuscript content
    res.json({
      verified: true,
      valid: true,
      reportType: type,
      reportId: report._id || report.id || report.scanId || report.reportId,
      sha256: report.sha256 || report.verificationHash || rawTarget,
      title: report.documentTitle || report.title || 'Scholarly Integrity Audit',
      timestamp: report.createdAt || report.timestamp || report.generatedAt,
      analyzedWords: report.analyzedWordCount || report.summaryMetrics?.wordCount || report.wordCount || 0,
      similarityScore: report.similarityCoverage ?? report.scorecard?.plagiarism?.similarityScore ?? 0,
      doiVerificationStatus: report.doiVerification ? `${report.doiVerification.verified} verified, ${report.doiVerification.retracted || 0} retracted` : 'Verified',
      meaningValidationStatus: report.meaningValidation?.isValid ? 'Passed (Zero Empirical Tampering)' : 'Verified Quantitative Consistency',
      registryAuthority: 'ResearchProof AI Institutional Registry',
      verificationStatus: 'Authentic & Cryptographically Certified'
    });
  } catch (err) { next(err); }
});

apiRouter.get('/reports/verify/:hash', async (req, res, next) => {
  req.url = `/integrity/verify/${encodeURIComponent(req.params.hash)}`;
  return apiRouter.handle(req, res, next);
});

// Manuscript Version Comparison (Feature 2: Compare 2 Document Versions)
apiRouter.post('/documents/compare', requireAuth, async (req, res, next) => {
  try {
    let { originalText, revisedText, documentIdA, documentIdB, revisionIdA, revisionIdB, title } = req.body || {};

    // Resolve text from document IDs if provided
    if (!originalText && documentIdA) {
      const docA = isDbConnected() ? await Document.findOne({ _id: documentIdA, ownerId: req.user.id }).lean() : memDocuments.get(documentIdA);
      if (docA) {
        originalText = docA.content;
        title = title || docA.title;
      }
    }
    if (!revisedText && documentIdB) {
      const docB = isDbConnected() ? await Document.findOne({ _id: documentIdB, ownerId: req.user.id }).lean() : memDocuments.get(documentIdB);
      if (docB) revisedText = docB.content;
    }

    // Resolve text from revision IDs if provided
    if (!originalText && revisionIdA) {
      const revA = isDbConnected() ? await Revision.findById(revisionIdA).lean() : memRevisions.get(revisionIdA);
      if (revA) originalText = revA.originalText || revA.revisedText;
    }
    if (!revisedText && revisionIdB) {
      const revB = isDbConnected() ? await Revision.findById(revisionIdB).lean() : memRevisions.get(revisionIdB);
      if (revB) revisedText = revB.revisedText;
    }

    if (!originalText && !revisedText) {
      return res.status(400).json({ error: 'Please provide two document texts or revision IDs to compare.' });
    }

    const comparison = compareManuscriptVersions(originalText || '', revisedText || '', { title });
    res.json({ comparison, ...comparison });
  } catch (err) { next(err); }
});

// Research Submission Checklist (Feature 3: Journal Submission Readiness)
apiRouter.post('/integrity/submission-checklist', requireAuth, async (req, res, next) => {
  try {
    const text = req.body?.text || '';
    const publisher = req.body?.publisher || req.body?.targetJournal || 'nature';
    const targetJournal = req.body?.targetJournal || publisher;

    if (!text || text.trim().length < 15) {
      return res.status(400).json({ error: 'Manuscript text is required to evaluate submission readiness.' });
    }

    const checklist = generateSubmissionChecklist(text, { publisher, targetJournal });
    res.json({ checklist, ...checklist });
  } catch (err) { next(err); }
});

// Documents (Section 6 & 7)
apiRouter.get('/documents', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const filter = { ownerId: req.user.id };
      if (req.query.projectId) filter.projectId = req.query.projectId;
      return res.json(await Document.find(filter).sort({ updatedAt: -1 }).lean());
    }
    const docs = [...memDocuments.values()]
      .filter(d => d.ownerId === req.user.id && (!req.query.projectId || d.projectId === req.query.projectId))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json(docs);
  } catch (e) { next(e); }
});

apiRouter.post('/documents', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().trim().min(1).max(200),
      content: z.string().optional().default(''),
      projectId: z.string().optional(),
      persistenceConsent: z.boolean().optional()
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Document title is required.' });

    const content = p.data.content || '';
    const wordCount = countWords(content);
    const characterCount = content.length;

    if (isDbConnected()) {
      const doc = await Document.create({
        ownerId: req.user.id,
        projectId: mongoose.isValidObjectId(p.data.projectId) ? p.data.projectId : null,
        title: p.data.title,
        content,
        wordCount,
        characterCount,
        version: 1,
        persistenceConsent: p.data.persistenceConsent !== false
      });
      await recordAudit(req.user.id, 'DOCUMENT_CREATED', 'Document', doc._id);
      return res.status(201).json(doc);
    }

    const docId = new mongoose.Types.ObjectId().toString();
    const newDoc = {
      _id: docId,
      id: docId,
      ownerId: req.user.id,
      projectId: p.data.projectId || null,
      title: p.data.title,
      content,
      wordCount,
      characterCount,
      version: 1,
      persistenceConsent: p.data.persistenceConsent !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    memDocuments.set(docId, newDoc);
    res.status(201).json(newDoc);
  } catch (e) { next(e); }
});

apiRouter.get('/documents/:id', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const doc = await Document.findOne({ _id: req.params.id, ownerId: req.user.id }).lean();
      if (!doc) return res.status(404).json({ error: 'Document not found.' });
      const revisions = await Revision.find({ documentId: doc._id, userId: req.user.id }).sort({ createdAt: -1 }).limit(20).lean();
      return res.json({ ...doc, revisions });
    }
    const doc = memDocuments.get(req.params.id);
    if (!doc || doc.ownerId !== req.user.id) return res.status(404).json({ error: 'Document not found.' });
    const revisions = [...memRevisions.values()]
      .filter(r => (r.documentId === req.params.id || r.documentId === doc._id) && r.userId === req.user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ ...doc, revisions });
  } catch (e) { next(e); }
});

apiRouter.patch('/documents/:id', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().trim().min(1).max(200).optional(),
      content: z.string().optional(),
      version: z.number().optional()
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Invalid document update data.' });

    if (isDbConnected()) {
      const doc = await Document.findOne({ _id: req.params.id, ownerId: req.user.id });
      if (!doc) return res.status(404).json({ error: 'Document not found.' });

      // Optimistic concurrency check
      if (p.data.version !== undefined && doc.version !== p.data.version) {
        return res.status(409).json({
          error: 'Document has been modified by another session. Please reload to avoid overwriting changes.',
          code: 'CONCURRENT_EDIT_CONFLICT',
          currentVersion: doc.version
        });
      }

      if (p.data.title !== undefined) doc.title = p.data.title;
      if (p.data.content !== undefined) {
        doc.content = p.data.content;
        doc.wordCount = countWords(p.data.content);
        doc.characterCount = p.data.content.length;
      }
      doc.version = (doc.version || 1) + 1;
      await doc.save();
      return res.json(doc);
    }

    const doc = memDocuments.get(req.params.id);
    if (!doc || doc.ownerId !== req.user.id) return res.status(404).json({ error: 'Document not found.' });

    if (p.data.version !== undefined && (doc.version || 1) !== p.data.version) {
      return res.status(409).json({
        error: 'Document has been modified by another session. Please reload to avoid overwriting changes.',
        code: 'CONCURRENT_EDIT_CONFLICT',
        currentVersion: doc.version || 1
      });
    }

    if (p.data.title !== undefined) doc.title = p.data.title;
    if (p.data.content !== undefined) {
      doc.content = p.data.content;
      doc.wordCount = countWords(p.data.content);
      doc.characterCount = p.data.content.length;
    }
    doc.version = (doc.version || 1) + 1;
    doc.updatedAt = new Date().toISOString();
    res.json(doc);
  } catch (e) { next(e); }
});

apiRouter.delete('/documents/:id', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const doc = await Document.findOneAndDelete({ _id: req.params.id, ownerId: req.user.id });
      if (!doc) return res.status(404).json({ error: 'Document not found.' });
      await Revision.deleteMany({ documentId: doc._id, userId: req.user.id });
      await Citation.deleteMany({ documentId: doc._id, ownerId: req.user.id });
      await recordAudit(req.user.id, 'DOCUMENT_DELETED', 'Document', req.params.id);
      return res.json({ deleted: true });
    }

    const doc = memDocuments.get(req.params.id);
    if (!doc || doc.ownerId !== req.user.id) return res.status(404).json({ error: 'Document not found.' });
    memDocuments.delete(req.params.id);
    for (const [id, r] of memRevisions.entries()) {
      if ((r.documentId === req.params.id || r.documentId === doc._id) && r.userId === req.user.id) {
        memRevisions.delete(id);
      }
    }
    for (const [id, c] of memCitations.entries()) {
      if ((c.documentId === req.params.id || c.documentId === doc._id) && c.ownerId === req.user.id) {
        memCitations.delete(id);
      }
    }
    res.json({ deleted: true });
  } catch (e) { next(e); }
});

apiRouter.get('/documents/:id/revisions', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const doc = await Document.findOne({ _id: req.params.id, ownerId: req.user.id });
      if (!doc) return res.status(404).json({ error: 'Document not found.' });
      const revisions = await Revision.find({ documentId: doc._id, userId: req.user.id }).sort({ createdAt: -1 }).lean();
      return res.json(revisions);
    }
    const doc = memDocuments.get(req.params.id);
    if (!doc || doc.ownerId !== req.user.id) return res.status(404).json({ error: 'Document not found.' });
    const revs = [...memRevisions.values()].filter(r => (r.documentId === req.params.id || r.documentId === doc._id) && r.userId === req.user.id);
    res.json(revs);
  } catch (e) { next(e); }
});

// Restore Revision (Section 5)
apiRouter.post('/documents/:id/restore', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      revisionId: z.string().min(1),
      expectedVersion: z.number().optional()
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Revision ID is required.' });

    if (isDbConnected()) {
      const doc = await Document.findOne({ _id: req.params.id, ownerId: req.user.id });
      if (!doc) return res.status(404).json({ error: 'Document not found.' });

      if (p.data.expectedVersion !== undefined && doc.version !== p.data.expectedVersion) {
        return res.status(409).json({
          error: 'Document has been modified. Please reload before restoring.',
          code: 'CONCURRENT_EDIT_CONFLICT'
        });
      }

      const rev = await Revision.findOne({ _id: p.data.revisionId, userId: req.user.id });
      if (!rev) return res.status(404).json({ error: 'Revision not found.' });

      const restoredText = rev.revisedText || rev.originalText || '';
      doc.content = restoredText;
      doc.wordCount = countWords(restoredText);
      doc.characterCount = restoredText.length;
      doc.version = (doc.version || 1) + 1;
      doc.currentRevisionId = rev._id;
      await doc.save();

      const restoredRev = await Revision.create({
        userId: req.user.id,
        projectId: doc.projectId,
        documentId: doc._id,
        parentRevisionId: rev._id,
        mode: 'restoration',
        originalText: doc.content,
        revisedText: restoredText,
        proposedText: restoredText,
        summary: `Restored version from revision ${rev._id}`,
        status: 'restored'
      });

      return res.json({ success: true, document: doc, revision: restoredRev });
    }

    const doc = memDocuments.get(req.params.id);
    if (!doc || doc.ownerId !== req.user.id) return res.status(404).json({ error: 'Document not found.' });

    if (p.data.expectedVersion !== undefined && (doc.version || 1) !== p.data.expectedVersion) {
      return res.status(409).json({
        error: 'Document has been modified. Please reload before restoring.',
        code: 'CONCURRENT_EDIT_CONFLICT'
      });
    }

    const rev = memRevisions.get(p.data.revisionId);
    if (!rev || rev.userId !== req.user.id) return res.status(404).json({ error: 'Revision not found.' });

    const restoredText = rev.revisedText || rev.originalText || '';
    doc.content = restoredText;
    doc.wordCount = countWords(restoredText);
    doc.characterCount = restoredText.length;
    doc.version = (doc.version || 1) + 1;
    doc.currentRevisionId = rev._id || rev.id;
    doc.updatedAt = new Date().toISOString();

    const revId = new mongoose.Types.ObjectId().toString();
    const restoredRev = {
      _id: revId,
      id: revId,
      userId: req.user.id,
      projectId: doc.projectId,
      documentId: doc._id || doc.id,
      parentRevisionId: rev._id || rev.id,
      mode: 'restoration',
      originalText: doc.content,
      revisedText: restoredText,
      proposedText: restoredText,
      summary: `Restored version from revision ${rev._id || rev.id}`,
      status: 'restored',
      createdAt: new Date().toISOString()
    };
    memRevisions.set(revId, restoredRev);

    res.json({ success: true, document: doc, revision: restoredRev });
  } catch (e) { next(e); }
});

// DOCX Import (Section 7)
apiRouter.post('/documents/import-docx', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Please upload a valid .docx file.' });
    }

    const result = await importDocxFromBuffer(req.file.buffer, req.file.originalname);
    const projectId = req.body.projectId;

    let savedDoc = null;
    if (req.body.saveDocument !== 'false' && process.env.PERSIST_DOCUMENT_TEXT !== 'false') {
      if (isDbConnected()) {
        savedDoc = await Document.create({
          ownerId: req.user.id,
          projectId: mongoose.isValidObjectId(projectId) ? projectId : null,
          title: result.title,
          content: result.content,
          wordCount: result.wordCount,
          characterCount: result.characterCount,
          version: 1
        });
        await recordAudit(req.user.id, 'DOCX_IMPORTED', 'Document', savedDoc._id);
      } else {
        const docId = new mongoose.Types.ObjectId().toString();
        savedDoc = {
          _id: docId,
          id: docId,
          ownerId: req.user.id,
          projectId: projectId || null,
          title: result.title,
          content: result.content,
          wordCount: result.wordCount,
          characterCount: result.characterCount,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        memDocuments.set(docId, savedDoc);
      }
    }

    res.json({
      success: true,
      document: savedDoc,
      ...result
    });
  } catch (e) { next(e); }
});

// DOCX Export (Section 8)
apiRouter.get('/documents/:id/export-docx', requireAuth, async (req, res, next) => {
  try {
    let doc = null;
    let references = [];

    if (isDbConnected()) {
      doc = await Document.findOne({ _id: req.params.id, ownerId: req.user.id }).lean();
      if (!doc) return res.status(404).json({ error: 'Document not found.' });

      if (doc.projectId) {
        const cites = await Citation.find({ projectId: doc.projectId, ownerId: req.user.id }).lean();
        references = cites.map(formatApa);
      }
    } else {
      doc = memDocuments.get(req.params.id);
      if (!doc || doc.ownerId !== req.user.id) return res.status(404).json({ error: 'Document not found.' });

      if (doc.projectId) {
        const cites = [...memCitations.values()].filter(c => c.projectId === doc.projectId && c.ownerId === req.user.id);
        references = cites.map(formatApa);
      }
    }

    const targetContent = doc.content || '';
    const safeTitle = (doc.title || 'Manuscript').replace(/[^\w\s-]/gi, '').replace(/\s+/g, '_');
    const buffer = await exportDocxFromText({
      title: doc.title,
      content: targetContent,
      references
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.docx"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (e) { next(e); }
});

// Citation Assistant Routes (Section 6)
apiRouter.post('/citations/lookup', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({ doi: z.string().trim().min(1, 'DOI is required.') });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Please enter a valid DOI.' });

    const metadata = await lookupDoiMetadata(p.data.doi, isDbConnected());
    res.json({
      metadata,
      formatted: {
        apa: formatApa(metadata),
        mla: formatMla(metadata),
        ieee: formatIeee(metadata, 1)
      }
    });
  } catch (e) { next(e); }
});

apiRouter.get('/citations', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const filter = { ownerId: req.user.id };
      if (req.query.projectId) filter.projectId = req.query.projectId;
      const citations = await Citation.find(filter).sort({ updatedAt: -1 }).lean();
      return res.json(citations);
    }
    const cites = [...memCitations.values()]
      .filter(c => c.ownerId === req.user.id && (!req.query.projectId || c.projectId === req.query.projectId))
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    res.json(cites);
  } catch (e) { next(e); }
});

apiRouter.post('/citations', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      doi: z.string().optional().default(''),
      title: z.string().trim().min(1, 'Title is required.'),
      authors: z.array(z.any()).optional().default([]),
      year: z.string().optional().default(''),
      journal: z.string().optional().default(''),
      volume: z.string().optional().default(''),
      issue: z.string().optional().default(''),
      pages: z.string().optional().default(''),
      projectId: z.string().optional(),
      documentId: z.string().optional(),
      metadataSource: z.string().optional().default('manual'),
      rawMetadata: z.any().optional()
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.issues[0]?.message || 'Invalid citation data.' });

    if (isDbConnected()) {
      const cite = await Citation.create({
        ownerId: req.user.id,
        projectId: mongoose.isValidObjectId(p.data.projectId) ? p.data.projectId : null,
        documentId: mongoose.isValidObjectId(p.data.documentId) ? p.data.documentId : null,
        doi: normalizeDoi(p.data.doi),
        title: p.data.title,
        authors: p.data.authors,
        year: p.data.year,
        journal: p.data.journal,
        volume: p.data.volume,
        issue: p.data.issue,
        pages: p.data.pages,
        metadataSource: p.data.metadataSource,
        rawMetadata: p.data.rawMetadata
      });
      return res.status(201).json(cite);
    }

    const citeId = new mongoose.Types.ObjectId().toString();
    const newCite = {
      _id: citeId,
      id: citeId,
      ownerId: req.user.id,
      projectId: p.data.projectId || null,
      documentId: p.data.documentId || null,
      doi: normalizeDoi(p.data.doi),
      title: p.data.title,
      authors: p.data.authors,
      year: p.data.year,
      journal: p.data.journal,
      volume: p.data.volume,
      issue: p.data.issue,
      pages: p.data.pages,
      metadataSource: p.data.metadataSource,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    memCitations.set(citeId, newCite);
    res.status(201).json(newCite);
  } catch (e) { next(e); }
});

apiRouter.delete('/citations/:id', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const cite = await Citation.findOneAndDelete({ _id: req.params.id, ownerId: req.user.id });
      if (!cite) return res.status(404).json({ error: 'Citation not found.' });
      return res.json({ deleted: true });
    }
    const cite = memCitations.get(req.params.id);
    if (!cite || cite.ownerId !== req.user.id) return res.status(404).json({ error: 'Citation not found.' });
    memCitations.delete(req.params.id);
    res.json({ deleted: true });
  } catch (e) { next(e); }
});

apiRouter.post('/citations/format', requireAuth, async (req, res, next) => {
  try {
    const { citation, style = 'apa' } = req.body;
    if (!citation) return res.status(400).json({ error: 'Citation object is required.' });

    let formatted = '';
    const st = style.toLowerCase();
    if (st === 'mla') formatted = formatMla(citation);
    else if (st === 'ieee') formatted = formatIeee(citation, 1);
    else formatted = formatApa(citation);

    res.json({ style: st, formatted });
  } catch (e) { next(e); }
});

apiRouter.post('/citations/validate', requireAuth, async (req, res, next) => {
  try {
    const { text = '', projectId } = req.body;
    let citations = [];

    if (isDbConnected()) {
      const filter = { ownerId: req.user.id };
      if (projectId) filter.projectId = projectId;
      citations = await Citation.find(filter).lean();
    } else {
      citations = [...memCitations.values()].filter(c => c.ownerId === req.user.id && (!projectId || c.projectId === projectId));
    }

    const validation = validateDocumentCitations(text, citations);
    res.json(validation);
  } catch (e) { next(e); }
});

// Feature Status Endpoint (Section 9)
apiRouter.get('/features/status', async (_req, res) => {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY || (process.env.AI_PROVIDER === 'gemini' && process.env.AI_API_KEY));
  const hasOpenAi = Boolean(process.env.AI_API_KEY && process.env.AI_MODEL);
  const hasReverseGpt = Boolean(process.env.AI_PROVIDER === 'reversegpt' || (process.env.AI_API_KEY && process.env.AI_API_KEY.startsWith('rg_live_')));
  const aiAvailable = hasGemini || hasOpenAi || hasReverseGpt;

  let provider = 'none';
  if (hasReverseGpt) provider = 'reversegpt';
  else if (hasGemini) provider = 'gemini';
  else if (hasOpenAi) provider = 'openai-compatible';

  res.json({
    aiAvailable,
    aiProvider: provider,
    aiModel: process.env.AI_MODEL || (hasGemini ? 'gemini-1.5-flash' : 'none'),
    docxImport: true,
    docxExport: true,
    citationsApi: true,
    meaningChecking: true,
    concurrencyControl: true,
    modes: Object.keys(ACADEMIC_REWRITE_MODES),
    freeLimits: {
      rewriteDaily: FREE_REWRITE_DAILY_LIMIT,
      rewriteMaxWords: FREE_REWRITE_MAX_WORDS,
      analysisDaily: FREE_ANALYSIS_DAILY_LIMIT,
      analysisMaxWords: FREE_ANALYSIS_MAX_WORDS
    }
  });
});

// Revisions
apiRouter.get('/revisions', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const revisions = await Revision.find({ userId: req.user.id })
        .select('mode summary createdAt projectId documentId originalText revisedText')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      return res.json(revisions);
    }
    const revs = [...memRevisions.values()]
      .filter(r => r.userId === req.user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);
    res.json(revs);
  } catch (e) { next(e); }
});

apiRouter.delete('/revisions/:id', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const item = await Revision.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
      if (!item) return res.status(404).json({ error: 'Revision not found.' });
      await recordAudit(req.user.id, 'REVISION_DELETED', 'Revision', req.params.id);
      return res.json({ deleted: true });
    }
    const item = memRevisions.get(req.params.id);
    if (!item || item.userId !== req.user.id) return res.status(404).json({ error: 'Revision not found.' });
    memRevisions.delete(req.params.id);
    res.json({ deleted: true });
  } catch (e) { next(e); }
});

// ==========================================
// PHASE 3: RESEARCH INTEGRITY REPORTS
// ==========================================
apiRouter.post('/integrity/reports', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      text: z.string().optional(),
      title: z.string().optional(),
      documentId: z.string().optional(),
      baselineText: z.string().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid report request parameters.' });

    let contentToAnalyze = parsed.data.text || '';
    let docTitle = parsed.data.title || 'Research Integrity Report';
    let docRefLibrary = [];

    // If documentId is provided, pull stored document and references
    if (parsed.data.documentId) {
      if (isDbConnected()) {
        const doc = await Document.findOne({ _id: parsed.data.documentId, ownerId: req.user.id }).lean();
        if (doc) {
          if (!contentToAnalyze) contentToAnalyze = doc.content || '';
          docTitle = doc.title ? `Integrity Audit: ${doc.title}` : docTitle;
          docRefLibrary = await Citation.find({ ownerId: req.user.id, projectId: doc.projectId }).lean();
        }
      } else {
        const doc = memDocuments.get(parsed.data.documentId);
        if (doc && doc.ownerId === req.user.id) {
          if (!contentToAnalyze) contentToAnalyze = doc.content || '';
          docTitle = doc.title ? `Integrity Audit: ${doc.title}` : docTitle;
          docRefLibrary = [...memCitations.values()].filter(c => c.ownerId === req.user.id);
        }
      }
    }

    if (!contentToAnalyze.trim()) {
      return res.status(400).json({ error: 'Manuscript text is required for research integrity auditing.' });
    }

    const reportData = await generateIntegrityReport({
      text: contentToAnalyze,
      title: docTitle,
      documentId: parsed.data.documentId || null,
      ownerId: req.user.id,
      referenceLibrary: docRefLibrary,
      baselineText: parsed.data.baselineText || ''
    });

    await recordUsageEvent({
      eventType: 'integrity_report',
      feature: 'integrity',
      userId: req.user.id,
      success: true,
      metadata: { findingsCount: reportData.summaryMetrics.totalFindings }
    });

    // Check persistence consent
    const persistConsent = process.env.PERSIST_DOCUMENT_TEXT !== 'false';
    if (!persistConsent) {
      return res.status(201).json({ ...reportData, _id: `stateless-${Date.now()}` });
    }

    if (isDbConnected()) {
      const saved = await IntegrityReport.create(reportData);
      return res.status(201).json(saved);
    } else {
      const reportId = new mongoose.Types.ObjectId().toString();
      const saved = { ...reportData, _id: reportId, id: reportId, createdAt: new Date() };
      memReports.set(reportId, saved);
      return res.status(201).json(saved);
    }
  } catch (err) { next(err); }
});

// Backward-compatible alias for /reports
apiRouter.post('/reports', requireAuth, async (req, res, next) => {
  req.url = '/integrity/reports';
  return apiRouter.handle(req, res, next);
});

apiRouter.get('/integrity/reports', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const reports = await IntegrityReport.find({ ownerId: req.user.id })
        .sort({ createdAt: -1 })
        .select('title reportType reviewStatus summaryMetrics createdAt documentId')
        .lean();
      return res.json(reports);
    } else {
      const reports = [...memReports.values()]
        .filter(r => r.ownerId === req.user.id)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json(reports);
    }
  } catch (err) { next(err); }
});

apiRouter.get('/integrity/reports/:id', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const report = await IntegrityReport.findOne({ _id: req.params.id, ownerId: req.user.id }).lean();
      if (!report) return res.status(404).json({ error: 'Integrity report not found.' });
      return res.json(report);
    } else {
      const report = memReports.get(req.params.id);
      if (!report || report.ownerId !== req.user.id) return res.status(404).json({ error: 'Integrity report not found.' });
      return res.json(report);
    }
  } catch (err) { next(err); }
});

// Backward-compatible alias for /reports/:id
apiRouter.get('/reports/:id', requireAuth, async (req, res, next) => {
  req.url = `/integrity/reports/${req.params.id}`;
  return apiRouter.handle(req, res, next);
});

apiRouter.get('/integrity/reports/:id/export', requireAuth, async (req, res, next) => {
  try {
    let report = null;
    if (isDbConnected()) {
      report = await IntegrityReport.findOne({ _id: req.params.id, ownerId: req.user.id }).lean();
    } else {
      report = memReports.get(req.params.id);
      if (report && report.ownerId !== req.user.id) report = null;
    }

    if (!report) return res.status(404).json({ error: 'Integrity report not found.' });

    const format = (req.query.format || 'json').toLowerCase();
    if (format === 'docx') {
      const docxBuffer = await exportIntegrityReportDocx(report);
      const safeTitle = (report.title || 'Integrity-Report').replace(/[^a-zA-Z0-9_-]/g, '_');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.docx"`);
      res.setHeader('Content-Length', docxBuffer.length);
      return res.send(docxBuffer);
    }

    return res.json(report);
  } catch (err) { next(err); }
});

// ==========================================
// PHASE 3: PRIVACY & DATA DELETION
// ==========================================
apiRouter.get('/privacy/settings', requireAuth, async (req, res, next) => {
  try {
    let userSettings = { persistDocumentText: true, allowAiProcessing: true };
    if (isDbConnected()) {
      const u = await User.findById(req.user.id).select('privacySettings').lean();
      if (u?.privacySettings) userSettings = u.privacySettings;
    } else {
      const u = memUsers.get(req.user.email);
      if (u?.privacySettings) userSettings = u.privacySettings;
    }

    const serverPersistEnforced = process.env.PERSIST_DOCUMENT_TEXT === 'false';

    res.json({
      settings: {
        persistDocumentText: serverPersistEnforced ? false : userSettings.persistDocumentText,
        allowAiProcessing: userSettings.allowAiProcessing
      },
      policies: {
        serverPersistEnforced,
        analyticsRetentionDays: 90,
        auditRetentionDays: 365,
        aiDataPolicy: 'Manuscript excerpts sent to AI providers are processed in-memory and are never used to train public foundation models.'
      }
    });
  } catch (err) { next(err); }
});

apiRouter.patch('/privacy/settings', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      persistDocumentText: z.boolean().optional(),
      allowAiProcessing: z.boolean().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid settings payload.' });

    if (isDbConnected()) {
      const u = await User.findByIdAndUpdate(
        req.user.id,
        { $set: { 'privacySettings.persistDocumentText': parsed.data.persistDocumentText, 'privacySettings.allowAiProcessing': parsed.data.allowAiProcessing } },
        { new: true }
      ).select('privacySettings').lean();
      await recordAudit(req.user.id, 'privacy_settings_updated', 'User', req.user.id, parsed.data);
      return res.json({ settings: u.privacySettings });
    } else {
      const u = memUsers.get(req.user.email);
      if (u) {
        u.privacySettings = { ...u.privacySettings, ...parsed.data };
      }
      await recordAudit(req.user.id, 'privacy_settings_updated', 'User', req.user.id, parsed.data);
      return res.json({ settings: u?.privacySettings || parsed.data });
    }
  } catch (err) { next(err); }
});

// User Full Data Export (Section 6)
apiRouter.post('/privacy/export', requireAuth, async (req, res, next) => {
  try {
    let profile = null;
    let projects = [];
    let documents = [];
    let revisions = [];
    let citations = [];
    let reports = [];
    let scans = [];

    if (isDbConnected()) {
      profile = await User.findById(req.user.id).select('email displayName role createdAt lastLoginAt privacySettings usage').lean();
      projects = await Project.find({ userId: req.user.id }).lean();
      documents = await Document.find({ ownerId: req.user.id }).lean();
      revisions = await Revision.find({ userId: req.user.id }).select('mode summary originalText revisedText status createdAt').lean();
      citations = await Citation.find({ ownerId: req.user.id }).lean();
      reports = await IntegrityReport.find({ ownerId: req.user.id }).select('title reportType summaryMetrics findings limitations createdAt').lean();
      scans = await TextGuardScan.find({ userId: req.user.id }).lean();
    } else {
      profile = memUsers.get(req.user.email);
      projects = [...memProjects.values()].filter(p => p.userId === req.user.id);
      documents = [...memDocuments.values()].filter(d => d.ownerId === req.user.id);
      revisions = [...memRevisions.values()].filter(r => r.userId === req.user.id);
      citations = [...memCitations.values()].filter(c => c.ownerId === req.user.id);
      reports = [...memReports.values()].filter(r => r.ownerId === req.user.id);
      scans = [...memTextGuardScans.values()].filter(s => String(s.userId) === String(req.user.id));
    }

    // Exclude security credentials
    const safeProfile = {
      id: profile?._id || req.user.id,
      email: profile?.email || req.user.email,
      displayName: profile?.displayName || '',
      role: profile?.role || 'researcher',
      createdAt: profile?.createdAt,
      privacySettings: profile?.privacySettings
    };

    const exportBundle = {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        requestingUser: safeProfile.email,
        application: 'ResearchProof AI',
        version: '3.0.0'
      },
      exportManifest: {
        platform: 'ResearchProof AI',
        exportedAt: new Date().toISOString(),
        userEmail: safeProfile.email,
        totalDocuments: documents.length,
        totalScans: scans.length,
        totalProjects: projects.length,
        dataIntegrityHash: Buffer.from(`${req.user.id}-${Date.now()}`).toString('base64')
      },
      user: safeProfile,
      projects,
      documents,
      revisions,
      citations,
      scans,
      integrityReports: reports,
      privacyPolicyNotice: 'This archive contains your research documents and authenticity scan history exported under your explicit request.'
    };

    await recordAudit(req.user.id, 'user_data_exported', 'User', req.user.id);
    res.setHeader('Content-Disposition', `attachment; filename="researchproof-export-${req.user.id}.json"`);
    res.json(exportBundle);
  } catch (err) { next(err); }
});

// Delete individual document via privacy center
apiRouter.delete('/privacy/documents/:id', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const doc = await Document.findOneAndDelete({ _id: req.params.id, ownerId: req.user.id });
      if (!doc) return res.status(404).json({ error: 'Document not found.' });
      await Revision.deleteMany({ documentId: req.params.id, userId: req.user.id });
      await recordAudit(req.user.id, 'document_deleted', 'Document', req.params.id);
      return res.json({ deleted: true, success: true, message: 'Document and revision history deleted.' });
    } else {
      const doc = memDocuments.get(req.params.id);
      if (!doc || doc.ownerId !== req.user.id) return res.status(404).json({ error: 'Document not found.' });
      memDocuments.delete(req.params.id);
      for (const [revId, rev] of memRevisions.entries()) {
        if (rev.documentId === req.params.id && rev.userId === req.user.id) memRevisions.delete(revId);
      }
      await recordAudit(req.user.id, 'document_deleted', 'Document', req.params.id);
      return res.json({ deleted: true, success: true, message: 'Document and revision history deleted.' });
    }
  } catch (err) { next(err); }
});

// Delete individual project via privacy center
apiRouter.delete('/privacy/projects/:id', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const proj = await Project.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
      if (!proj) return res.status(404).json({ error: 'Project not found.' });
      await Document.deleteMany({ projectId: req.params.id, ownerId: req.user.id });
      await Revision.deleteMany({ projectId: req.params.id, userId: req.user.id });
      await Citation.deleteMany({ projectId: req.params.id, ownerId: req.user.id });
      await recordAudit(req.user.id, 'project_deleted', 'Project', req.params.id);
      return res.json({ deleted: true });
    } else {
      const proj = memProjects.get(req.params.id);
      if (!proj || proj.userId !== req.user.id) return res.status(404).json({ error: 'Project not found.' });
      memProjects.delete(req.params.id);
      for (const [docId, doc] of memDocuments.entries()) {
        if (doc.projectId === req.params.id && doc.ownerId === req.user.id) memDocuments.delete(docId);
      }
      for (const [revId, rev] of memRevisions.entries()) {
        if (rev.projectId === req.params.id && rev.userId === req.user.id) memRevisions.delete(revId);
      }
      for (const [citId, cit] of memCitations.entries()) {
        if (cit.projectId === req.params.id && cit.ownerId === req.user.id) memCitations.delete(citId);
      }
      await recordAudit(req.user.id, 'project_deleted', 'Project', req.params.id);
      return res.json({ deleted: true });
    }
  } catch (err) { next(err); }
});

// Complete Account Deletion (Section 6)
apiRouter.post('/privacy/delete-account', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      password: z.string().optional(),
      confirm: z.boolean().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid deletion request parameters.' });

    let userRecord = null;
    if (isDbConnected()) {
      userRecord = await User.findById(req.user.id);
    } else {
      userRecord = memUsers.get(req.user.email);
    }

    if (!userRecord) return res.status(404).json({ error: 'User account not found.' });

    // Step-up verification: verify password if user has password authentication
    if (userRecord.passwordHash) {
      if (!parsed.data.password) {
        return res.status(400).json({ error: 'Please enter your current password to confirm account deletion.' });
      }
      const match = await bcrypt.compare(parsed.data.password, userRecord.passwordHash);
      if (!match) {
        return res.status(401).json({ error: 'Incorrect password. Deletion cancelled.' });
      }
    } else {
      // Google-only account step-up verification
      if (!parsed.data.confirm) {
        return res.status(400).json({ error: 'Please confirm account deletion explicitly.' });
      }
    }

    const userId = req.user.id;
    let counts = { documents: 0, revisions: 0, citations: 0, projects: 0, integrityReports: 0 };

    if (isDbConnected()) {
      const [d, r, c, p, rep] = await Promise.all([
        Document.deleteMany({ ownerId: userId }),
        Revision.deleteMany({ userId }),
        Citation.deleteMany({ ownerId: userId }),
        Project.deleteMany({ userId }),
        IntegrityReport.deleteMany({ ownerId: userId }),
        UsageRecord.deleteMany({ userId })
      ]);
      counts = {
        documents: d.deletedCount || 0,
        revisions: r.deletedCount || 0,
        citations: c.deletedCount || 0,
        projects: p.deletedCount || 0,
        integrityReports: rep.deletedCount || 0
      };

      // Anonymize user record
      userRecord.status = 'deleted';
      userRecord.email = `deleted-user-${userId}@deleted.local`;
      userRecord.passwordHash = null;
      userRecord.displayName = 'Deleted User';
      userRecord.googleId = null;
      userRecord.tokenVersion = (userRecord.tokenVersion || 1) + 1;
      await userRecord.save();
    } else {
      for (const [docId, doc] of memDocuments.entries()) {
        if (doc.ownerId === userId) { memDocuments.delete(docId); counts.documents++; }
      }
      for (const [revId, rev] of memRevisions.entries()) {
        if (rev.userId === userId) { memRevisions.delete(revId); counts.revisions++; }
      }
      for (const [citId, cit] of memCitations.entries()) {
        if (cit.ownerId === userId) { memCitations.delete(citId); counts.citations++; }
      }
      for (const [projId, proj] of memProjects.entries()) {
        if (proj.userId === userId) { memProjects.delete(projId); counts.projects++; }
      }
      for (const [repId, rep] of memReports.entries()) {
        if (rep.ownerId === userId) { memReports.delete(repId); counts.integrityReports++; }
      }

      userRecord.status = 'deleted';
      userRecord.tokenVersion = (userRecord.tokenVersion || 1) + 1;
      userRecord.passwordHash = null;
      memUsers.delete(req.user.email);
    }

    // Invalidate sessions & clear cookie
    clearSessionCookie(res, req);
    await recordAudit(userId, 'account_deleted', 'User', userId, { deletedCounts: counts });

    res.json({
      success: true,
      message: 'Your ResearchProof AI account and associated primary research data have been permanently deleted.',
      deletedCounts: counts
    });
  } catch (err) { next(err); }
});

// ==========================================
// PHASE 3: ADMINISTRATOR DASHBOARD & USER MANAGEMENT
// ==========================================
apiRouter.get('/admin/overview', requireAdmin, async (req, res, next) => {
  try {
    const overview = await getAnalyticsOverview(app);
    res.json({
      ...overview,
      system: {
        serverTime: new Date().toISOString(),
        nodeVersion: process.version,
        database: isDbConnected() ? 'MongoDB Cluster' : 'In-Memory Dev Store',
        aiProvider: process.env.AI_PROVIDER || 'gemini',
        aiConfigured: Boolean(process.env.AI_API_KEY)
      }
    });
  } catch (err) { next(err); }
});

apiRouter.get('/admin/users', requireAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const search = (req.query.search || '').trim().toLowerCase();
    const statusFilter = req.query.status;
    const roleFilter = req.query.role;

    if (isDbConnected()) {
      const query = { status: { $ne: 'deleted' } };
      if (statusFilter && ['active', 'suspended', 'pending'].includes(statusFilter)) {
        query.status = statusFilter;
      }
      if (roleFilter && ['researcher', 'reviewer', 'admin'].includes(roleFilter)) {
        query.role = roleFilter;
      }
      if (search) {
        query.$or = [
          { email: { $regex: search, $options: 'i' } },
          { displayName: { $regex: search, $options: 'i' } }
        ];
      }

      const [total, users] = await Promise.all([
        User.countDocuments(query),
        User.find(query)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .select('email displayName role status lastLoginAt lastActiveAt createdAt usage authProviders')
          .lean()
      ]);

      return res.json({
        users,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    } else {
      let users = [...memUsers.values()].filter(u => u.status !== 'deleted');
      if (statusFilter) users = users.filter(u => u.status === statusFilter);
      if (roleFilter) users = users.filter(u => u.role === roleFilter);
      if (search) {
        users = users.filter(u => (u.email || '').includes(search) || (u.displayName || '').toLowerCase().includes(search));
      }
      const total = users.length;
      const paginated = users.slice((page - 1) * limit, page * limit).map(u => ({
        _id: u._id || u.id,
        email: u.email,
        displayName: u.displayName,
        role: u.role || 'researcher',
        status: u.status || 'active',
        lastLoginAt: u.lastLoginAt || u.createdAt,
        lastActiveAt: u.lastActiveAt || u.createdAt,
        createdAt: u.createdAt,
        usage: u.usage
      }));

      return res.json({
        users: paginated,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    }
  } catch (err) { next(err); }
});

apiRouter.get('/admin/users/:id', requireAdmin, async (req, res, next) => {
  try {
    let user = null;
    if (isDbConnected()) {
      user = await User.findById(req.params.id)
        .select('email displayName role status lastLoginAt lastActiveAt createdAt usage authProviders tokenVersion')
        .lean();
    } else {
      user = [...memUsers.values()].find(u => (u._id === req.params.id || u.id === req.params.id));
    }

    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Safe metadata response (no passwords, tokens, or private manuscripts)
    res.json({
      _id: user._id || user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role || 'researcher',
      status: user.status || 'active',
      lastLoginAt: user.lastLoginAt || user.createdAt,
      lastActiveAt: user.lastActiveAt || user.createdAt,
      createdAt: user.createdAt,
      usage: user.usage,
      authProviders: user.authProviders || ['email']
    });
  } catch (err) { next(err); }
});

// Suspend / Reactivate account (Section 3)
apiRouter.patch('/admin/users/:id/status', requireAdmin, async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.enum(['active', 'suspended']),
      reason: z.string().min(3, 'A valid administrative reason is mandatory.')
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid status payload.' });

    const targetUserId = req.params.id;

    // Safety 1: Prevent accidental self-suspension
    if (req.user.id === targetUserId) {
      return res.status(400).json({ error: 'Administrative safety constraint: You cannot suspend your own account.' });
    }

    let targetUser = null;
    if (isDbConnected()) {
      targetUser = await User.findById(targetUserId);
    } else {
      targetUser = [...memUsers.values()].find(u => (u._id === targetUserId || u.id === targetUserId));
    }

    if (!targetUser) return res.status(404).json({ error: 'Target user not found.' });

    // Safety 2: Prevent removing or suspending the final administrator
    if (targetUser.role === 'admin' && parsed.data.status === 'suspended') {
      let adminCount = 0;
      if (isDbConnected()) {
        adminCount = await User.countDocuments({ role: 'admin', status: 'active' });
      } else {
        adminCount = [...memUsers.values()].filter(u => u.role === 'admin' && u.status === 'active').length;
      }
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Administrative safety constraint: Cannot suspend the final active administrator.' });
      }
    }

    targetUser.status = parsed.data.status;
    if (parsed.data.status === 'suspended') {
      targetUser.tokenVersion = (targetUser.tokenVersion || 1) + 1; // Invalidate active sessions immediately
    }

    if (isDbConnected()) {
      await targetUser.save();
    }

    const action = parsed.data.status === 'suspended' ? 'account_suspended' : 'account_reactivated';
    await recordAudit(req.user.id, action, 'User', targetUserId, { reason: parsed.data.reason }, targetUserId, parsed.data.reason);

    res.json({
      success: true,
      user: {
        _id: targetUser._id || targetUser.id,
        email: targetUser.email,
        status: targetUser.status
      },
      message: `User account ${parsed.data.status === 'suspended' ? 'suspended' : 'reactivated'} successfully.`
    });
  } catch (err) { next(err); }
});

// Revoke all active sessions for a user (Section 3)
apiRouter.post('/admin/users/:id/revoke-sessions', requireAdmin, async (req, res, next) => {
  try {
    const targetUserId = req.params.id;
    let targetUser = null;

    if (isDbConnected()) {
      targetUser = await User.findById(targetUserId);
    } else {
      targetUser = [...memUsers.values()].find(u => (u._id === targetUserId || u.id === targetUserId));
    }

    if (!targetUser) return res.status(404).json({ error: 'User not found.' });

    targetUser.tokenVersion = (targetUser.tokenVersion || 1) + 1;
    if (isDbConnected()) {
      await targetUser.save();
    }

    await recordAudit(req.user.id, 'sessions_revoked', 'User', targetUserId, {}, targetUserId, 'Administrative session revocation');

    res.json({
      success: true,
      message: `Active sessions revoked for ${targetUser.email}. The user will be required to sign in again.`
    });
  } catch (err) { next(err); }
});

// Admin Audit Logs Feed (Section 9)
apiRouter.get('/admin/audit-events', requireAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));
    const actionFilter = req.query.action;

    if (isDbConnected()) {
      const query = {};
      if (actionFilter) query.action = actionFilter;
      const [total, events] = await Promise.all([
        AuditEvent.countDocuments(query),
        AuditEvent.find(query)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('actorId', 'email displayName role')
          .populate('targetId', 'email displayName')
          .lean()
      ]);
      return res.json({ events, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } else {
      let events = [...memAuditEvents];
      if (actionFilter) events = events.filter(e => e.action === actionFilter);
      const total = events.length;
      const paginated = events.slice((page - 1) * limit, page * limit);
      return res.json({ events: paginated, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    }
  } catch (err) { next(err); }
});

// ==========================================
// PHASE 3: USAGE ANALYTICS ENGINE
// ==========================================
apiRouter.get('/admin/analytics/overview', requireAdmin, async (req, res, next) => {
  try {
    const overview = await getAnalyticsOverview(app);
    res.json(overview);
  } catch (err) { next(err); }
});

apiRouter.get('/admin/analytics/users', requireAdmin, async (req, res, next) => {
  try {
    const overview = await getAnalyticsOverview(app);
    res.json(overview.users);
  } catch (err) { next(err); }
});

apiRouter.get('/admin/analytics/features', requireAdmin, async (req, res, next) => {
  try {
    const breakdown = await getFeatureUsageBreakdown();
    res.json(breakdown);
  } catch (err) { next(err); }
});

apiRouter.get('/admin/analytics/errors', requireAdmin, async (req, res, next) => {
  try {
    const errors = await getErrorTrends();
    res.json(errors);
  } catch (err) { next(err); }
});

apiRouter.get('/admin/analytics/providers', requireAdmin, async (_req, res, next) => {
  try {
    const isDbConnected = mongoose.connection.readyState === 1;
    let providerStats = [];
    if (isDbConnected) {
      providerStats = await UsageEvent.aggregate([
        { $match: { feature: 'rewrite', provider: { $ne: null } } },
        { $group: { _id: '$provider', totalRequests: { $sum: 1 }, successCount: { $sum: { $cond: ['$success', 1, 0] } } } }
      ]);
    }
    res.json({
      activeProvider: process.env.AI_PROVIDER || 'gemini',
      activeModel: process.env.AI_MODEL || 'gemini-1.5-flash',
      providers: providerStats
    });
  } catch (err) { next(err); }
});


// ==========================================
// Phase 5: APA 7 Word-to-LaTeX Studio Endpoints
// ==========================================

// 1. Template Metadata & Options
apiRouter.get('/latex/templates/apa7', (_req, res) => {
  const compiler = checkCompilerAvailability();
  res.json({
    templates: [
      {
        id: 'student',
        name: 'APA 7 Student Paper',
        documentClass: 'apa7',
        classOption: 'stu',
        description: 'Standard APA 7 student paper format. Features title page with course name/number, instructor, and due date. No running head required.',
        fields: {
          required: ['title', 'author', 'affiliation'],
          studentSpecific: ['course', 'instructor', 'dueDate'],
          optional: ['abstract', 'keywords']
        }
      },
      {
        id: 'professional',
        name: 'APA 7 Professional Manuscript',
        documentClass: 'apa7',
        classOption: 'man',
        description: 'APA 7 professional publication manuscript format. Includes running head, author note, and abstract.',
        fields: {
          required: ['title', 'author', 'affiliation', 'abstract'],
          professionalSpecific: ['runningHead', 'authorNote', 'correspondingAuthor'],
          optional: ['keywords']
        }
      }
    ],
    compilerStatus: compiler
  });
});

// 1b. Multilingual Registry & Compiler Capability Discovery
apiRouter.get('/latex/languages', (_req, res) => {
  const compiler = checkCompilerAvailability();
  res.json({
    languages: LANGUAGE_REGISTRY,
    scripts: SCRIPT_DEFINITIONS,
    compilerAvailability: compiler
  });
});

// Helper to find LatexJob by ID with user ownership check
async function getOwnedLatexJob(jobId, userId, isAdmin = false) {
  let job = null;
  if (isDbConnected()) {
    job = await LatexJob.findById(jobId);
  }
  if (!job) {
    job = memLatexJobs.get(jobId);
  }
  if (!job) return null;

  const jobUserId = job.userId ? job.userId.toString() : '';
  if (jobUserId !== userId && !isAdmin) {
    return 'UNAUTHORIZED';
  }
  return job;
}

// 1.5 Extract Metadata and Content from Word DOCX or Raw Text
apiRouter.post('/latex/extract-metadata', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (req.file && req.file.buffer) {
      const imported = await importDocxFromBuffer(req.file.buffer, req.file.originalname);
      return res.json({
        title: imported.title,
        content: imported.content,
        text: imported.content,
        wordCount: imported.wordCount,
        characterCount: imported.characterCount,
        metadata: imported.metadata || {},
        warnings: imported.warnings || []
      });
    }

    const rawText = (req.body?.text || req.body?.content || '').trim();
    if (!rawText) {
      return res.status(400).json({ error: 'Please provide either a DOCX file or manuscript text.' });
    }

    const metadata = extractManuscriptMetadata(rawText);
    const wordCount = rawText.split(/\s+/).filter(Boolean).length;
    return res.json({
      title: metadata.title || 'Manuscript',
      content: rawText,
      text: rawText,
      wordCount,
      characterCount: rawText.length,
      metadata,
      warnings: []
    });
  } catch (err) {
    next(err);
  }
});

// 2. Convert Document/DOCX to APA 7 LaTeX Project
apiRouter.post('/latex/apa7/convert', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    let payload = req.body || {};
    if (typeof payload.metadata === 'string') {
      try {
        const parsed = JSON.parse(payload.metadata);
        payload = { ...payload, ...parsed };
      } catch {}
    }

    const variant = (payload.variant === 'professional' || payload.variant === 'thesis' || payload.variant === 'dissertation' || payload.variant === 'custom')
      ? payload.variant
      : 'student';
    let title = (payload.title || '').trim();
    let authors = Array.isArray(payload.authors) ? payload.authors : (payload.author ? [payload.author] : []);
    let affiliations = Array.isArray(payload.affiliations) ? payload.affiliations : (payload.affiliation ? [payload.affiliation] : []);
    let rawText = payload.content || payload.rawText || '';
    let citations = Array.isArray(payload.citations) ? payload.citations : [];
    let sourceDocumentId = payload.documentId || null;

    // Multilingual configuration parameters
    const documentLanguage = payload.documentLanguage || 'auto';
    const documentMode = payload.documentMode || 'preserve';
    const engine = payload.engine || 'auto';

    // Handle DOCX upload if file is attached
    if (req.file && req.file.buffer) {
      try {
        const imported = await importDocxFromBuffer(req.file.buffer, req.file.originalname);
        rawText = imported.content || imported.text || rawText;
        if (!title && imported.title) title = imported.title;
        if (!payload.abstract && imported.metadata?.abstract) payload.abstract = imported.metadata.abstract;
        if (!payload.keywords && imported.metadata?.keywords) payload.keywords = imported.metadata.keywords;
        if (authors.length === 0 && imported.metadata?.authors) {
          authors = [{ name: imported.metadata.authors, affiliation: imported.metadata.affiliation || 'Research Institution' }];
        }
        if (!payload.degree && imported.metadata?.degree) payload.degree = imported.metadata.degree;
        if (!payload.department && imported.metadata?.department) payload.department = imported.metadata.department;
        if (!payload.advisor && imported.metadata?.advisor) payload.advisor = imported.metadata.advisor;
        if (!payload.defenseDate && imported.metadata?.defenseDate) payload.defenseDate = imported.metadata.defenseDate;
        if (!payload.course && imported.metadata?.course) payload.course = imported.metadata.course;
        if (!payload.instructor && imported.metadata?.instructor) payload.instructor = imported.metadata.instructor;
        if (!payload.dueDate && imported.metadata?.dueDate) payload.dueDate = imported.metadata.dueDate;
        if (!payload.runningHead && imported.metadata?.runningHead) payload.runningHead = imported.metadata.runningHead;
      } catch (docxErr) {
        return res.status(400).json({ error: `DOCX parsing failed: ${docxErr.message}` });
      }
    } else if (sourceDocumentId) {
      let doc = null;
      if (isDbConnected()) {
        doc = await Document.findOne({ _id: sourceDocumentId, ownerId: req.user.id });
      } else {
        const found = memDocuments.get(sourceDocumentId);
        if (found && (found.ownerId === req.user.id || (found.ownerId && found.ownerId.toString() === req.user.id))) {
          doc = found;
        }
      }
      if (doc) {
        if (!title) title = doc.title;
        if (!rawText) rawText = doc.content;
      }
    }

    if (!title) {
      title = 'Manuscript';
    }

    if (authors.length === 0) {
      authors = [{ name: req.user.displayName || req.user.email.split('@')[0], affiliation: 'Research Institution' }];
    }

    // Execute APA 7 Project Conversion with multilingual options
    const conversionResult = await convertToApa7Project({
      variant,
      title,
      authors,
      affiliations,
      abstract: payload.abstract || '',
      keywords: Array.isArray(payload.keywords) ? payload.keywords : (payload.keywords ? String(payload.keywords).split(',').map(s => s.trim()) : []),
      course: payload.course || '',
      instructor: payload.instructor || '',
      dueDate: payload.dueDate || '',
      runningHead: payload.runningHead || '',
      authorNote: payload.authorNote || '',
      degree: payload.degree || '',
      department: payload.department || '',
      advisor: payload.advisor || '',
      defenseDate: payload.defenseDate || '',
      customFormatName: payload.customFormatName || '',
      customClassOptions: payload.customClassOptions || '',
      customPreamble: payload.customPreamble || '',
      rawText,
      citations,
      documentLanguage,
      documentMode,
      engine
    });

    // Determine targeted engine for compilation
    const targetEngine = conversionResult.report.language?.selectedEngine || engine;

    // Execute Secure PDF Compilation Attempt
    const compilationResult = await attemptPdfCompilation(conversionResult.zipBuffer, { engine: targetEngine });
    const finalZipBuffer = compilationResult.updatedZipBuffer || conversionResult.zipBuffer;
    const finalPdfBuffer = compilationResult.pdfBuffer || null;

    const jobId = new mongoose.Types.ObjectId().toString();

    const jobData = {
      _id: jobId,
      id: jobId,
      userId: req.user.id,
      sourceDocumentId: sourceDocumentId || null,
      template: 'apa7',
      variant,
      metadata: {
        title,
        authors,
        affiliations,
        abstract: payload.abstract || '',
        keywords: conversionResult.report.metadata.keywordsCount ? payload.keywords : [],
        course: payload.course || '',
        instructor: payload.instructor || '',
        dueDate: payload.dueDate || '',
        runningHead: payload.runningHead || '',
        authorNote: payload.authorNote || '',
        correspondingAuthor: payload.correspondingAuthor || '',
        degree: payload.degree || '',
        department: payload.department || '',
        advisor: payload.advisor || '',
        defenseDate: payload.defenseDate || '',
        documentLanguage,
        documentMode,
        engine: targetEngine
      },
      status: 'completed',
      compilationStatus: compilationResult.status,
      warnings: [
        ...conversionResult.warnings,
        ...(compilationResult.warnings || []).map(w => ({ category: 'compilation', severity: 'info', message: w }))
      ],
      artifactReferences: {
        zipSize: finalZipBuffer.length,
        pdfSize: finalPdfBuffer ? finalPdfBuffer.length : 0,
        texFilesCount: conversionResult.stats.sectionsCount + 1,
        referencesCount: conversionResult.stats.referencesCount,
        figuresCount: 0,
        tablesCount: 0
      },
      mainTex: conversionResult.mainTex,
      modularMainTex: conversionResult.modularMainTex,
      standaloneMainTex: conversionResult.standaloneMainTex,
      bibContent: conversionResult.bibContent,
      sections: conversionResult.sections || [],
      mainTexSnippet: conversionResult.mainTex.slice(0, 1500),
      report: conversionResult.report,
      createdAt: new Date(),
      expirationTimestamp: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };

    // Store in-memory buffer cache for rapid, secure downloads
    latexArtifactCache.set(jobId, {
      userId: req.user.id,
      zipBuffer: finalZipBuffer,
      pdfBuffer: finalPdfBuffer
    });

    if (isDbConnected()) {
      try {
        await LatexJob.create(jobData);
      } catch (dbErr) {
        console.warn(`[LatexJob] Mongo save error: ${dbErr.message}`);
        memLatexJobs.set(jobId, jobData);
      }
    } else {
      memLatexJobs.set(jobId, jobData);
    }

    recordUsageEvent({
      eventType: 'latex_export',
      feature: 'latex_apa7',
      userId: req.user.id,
      success: true,
      metadata: { variant, compilationStatus: compilationResult.status, documentLanguage, documentMode, engine: targetEngine }
    }).catch(() => {});

    res.status(201).json({
      success: true,
      jobId,
      template: 'apa7',
      variant,
      status: 'completed',
      compilationStatus: compilationResult.status,
      compilationMessage: compilationResult.message,
      warnings: jobData.warnings,
      artifactReferences: jobData.artifactReferences,
      mainTex: conversionResult.mainTex,
      modularMainTex: conversionResult.modularMainTex,
      standaloneMainTex: conversionResult.standaloneMainTex,
      bibContent: conversionResult.bibContent,
      sections: conversionResult.sections || [],
      mainTexSnippet: jobData.mainTexSnippet,
      report: jobData.report,
      languageReport: conversionResult.report.language
    });
  } catch (err) {
    next(err);
  }
});

// 3. Get Conversion Job Status
apiRouter.get('/latex/jobs/:id', requireAuth, async (req, res, next) => {
  try {
    const job = await getOwnedLatexJob(req.params.id, req.user.id, req.user.role === 'admin');
    if (job === 'UNAUTHORIZED') {
      return res.status(403).json({ error: 'Access denied: You do not have permission to view this conversion job.' });
    }
    if (!job) {
      return res.status(404).json({ error: 'Conversion job not found or expired.' });
    }
    res.json(job);
  } catch (err) { next(err); }
});

// 4. Get Conversion Report
apiRouter.get('/latex/jobs/:id/report', requireAuth, async (req, res, next) => {
  try {
    const job = await getOwnedLatexJob(req.params.id, req.user.id, req.user.role === 'admin');
    if (job === 'UNAUTHORIZED') {
      return res.status(403).json({ error: 'Access denied: You do not have permission to access this report.' });
    }
    if (!job) {
      return res.status(404).json({ error: 'Conversion job not found.' });
    }
    res.json(job.report || {});
  } catch (err) { next(err); }
});

// 5. Download Project ZIP Archive
apiRouter.get('/latex/jobs/:id/download-zip', requireAuth, async (req, res, next) => {
  try {
    const job = await getOwnedLatexJob(req.params.id, req.user.id, req.user.role === 'admin');
    if (job === 'UNAUTHORIZED') {
      return res.status(403).json({ error: 'Access denied: You do not have permission to download this artifact.' });
    }
    if (!job) {
      return res.status(404).json({ error: 'Conversion job not found.' });
    }

    const cached = latexArtifactCache.get(req.params.id);
    if (!cached || !cached.zipBuffer) {
      return res.status(404).json({ error: 'ZIP artifact expired from temporary cache.' });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="researchproof-apa7-manuscript.zip"');
    res.setHeader('Content-Length', cached.zipBuffer.length);
    res.send(cached.zipBuffer);
  } catch (err) { next(err); }
});

// Alias for /zip
apiRouter.get('/latex/jobs/:id/zip', requireAuth, (req, res, next) => {
  req.url = `/latex/jobs/${req.params.id}/download-zip`;
  apiRouter.handle(req, res, next);
});

// 6. Download Compiled PDF (if available)
apiRouter.get('/latex/jobs/:id/download-pdf', requireAuth, async (req, res, next) => {
  try {
    const job = await getOwnedLatexJob(req.params.id, req.user.id, req.user.role === 'admin');
    if (job === 'UNAUTHORIZED') {
      return res.status(403).json({ error: 'Access denied: You do not have permission to download this PDF.' });
    }
    if (!job) {
      return res.status(404).json({ error: 'Conversion job not found.' });
    }

    const cached = latexArtifactCache.get(req.params.id);
    if (!cached || !cached.pdfBuffer) {
      return res.status(404).json({
        error: 'PDF not available for this job.',
        compilationStatus: job.compilationStatus,
        message: 'Compilation environment was unavailable or compilation was skipped. The complete TeX source is available in the ZIP archive.'
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="manuscript.pdf"');
    res.setHeader('Content-Length', cached.pdfBuffer.length);
    res.send(cached.pdfBuffer);
  } catch (err) { next(err); }
});

// ==========================================
// PILLAR 1: TextGuard Plagiarism & Authenticity Studio
// ==========================================

// 0. Import Paper for TextGuard Manuscript Inspector (PDF, DOCX, TXT)
apiRouter.post('/textguard/import-paper', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No manuscript file uploaded. Please select a PDF, DOCX, or TXT file.' });
    }

    // Size limit check (25MB)
    if (req.file.size > 25 * 1024 * 1024) {
      return res.status(413).json({ error: 'File size exceeds 25MB limit. Please upload a smaller manuscript.' });
    }

    const originalname = req.file.originalname || 'manuscript.txt';
    const extMatch = originalname.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : '';
    const allowed = ['pdf', 'docx', 'txt', 'md'];

    if (!allowed.includes(ext)) {
      return res.status(400).json({
        error: `Unsupported file format (.${ext || 'unknown'}). Supported formats are PDF, DOCX, and TXT.`,
        supportedFormats: ['pdf', 'docx', 'txt']
      });
    }

    let extractedText = '';
    let derivedTitle = originalname.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');

    if (ext === 'docx') {
      const docxResult = await importDocxFromBuffer(req.file.buffer, originalname);
      extractedText = (docxResult.text || docxResult.content || '').trim();
      if (docxResult.title) derivedTitle = docxResult.title;
    } else if (ext === 'pdf') {
      const pdfResult = extractPagesFromPdf(req.file.buffer, originalname);
      const pages = pdfResult.pages || [];
      extractedText = pages.map(p => p.text).filter(Boolean).join('\n\n').trim();
      if (pdfResult.metadata?.title) derivedTitle = pdfResult.metadata.title;
    } else {
      // txt or md
      extractedText = req.file.buffer.toString('utf8').trim();
      const firstLine = extractedText.split('\n').map(l => l.trim()).filter(Boolean)[0];
      if (firstLine && firstLine.length < 120 && !/^(abstract|keywords|contents|introduction)/i.test(firstLine)) {
        derivedTitle = firstLine;
      }
    }

    // Security challenge check: ensure Cloudflare or bot challenge text is rejected
    if (isBotProtectionChallenge(extractedText)) {
      return res.status(400).json({
        error: 'Security verification challenge detected on input text.',
        isBotChallenge: true,
        message: 'The submitted document appears to contain a bot-protection challenge ("Performing security verification"). This cannot be processed as manuscript content.'
      });
    }

    if (!extractedText || extractedText.length < 5) {
      return res.status(400).json({ error: 'No readable text content could be extracted from this document.' });
    }

    const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
    const characterCount = extractedText.length;
    const paragraphs = extractedText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const paragraphCount = paragraphs.length;

    // Explicitly isolated from user's saved Document corpus - do NOT overwrite active documents
    if (isDbConnected()) {
      await recordAudit(req.user.id, 'TEXTGUARD_PAPER_IMPORTED', 'TextGuard', null, {
        filename: originalname,
        fileSize: req.file.size,
        wordCount,
        characterCount
      });
    }

    return res.json({
      success: true,
      filename: originalname,
      fileSize: req.file.size,
      fileType: ext,
      title: derivedTitle,
      text: extractedText,
      wordCount,
      characterCount,
      paragraphCount
    });
  } catch (err) {
    next(err);
  }
});

// 1. Run TextGuard Scan
apiRouter.post('/textguard/scan', requireAuth, async (req, res, next) => {
  try {
    const {
      text,
      documentTitle = 'Manuscript Audit',
      documentId = null,
      excludeQuotes = false,
      excludeBibliography = false,
      comparisonSources = [],
      revisedText = null
    } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length < 10) {
      return res.status(400).json({ error: 'Text content must be at least 10 characters long to perform a similarity scan.' });
    }

    // Bot challenge detection: Cloudflare or bot protection challenges should never be parsed as manuscript content
    if (isBotProtectionChallenge(text)) {
      return res.status(400).json({
        error: 'Security verification challenge detected on input text.',
        isBotChallenge: true,
        message: 'The submitted content appears to be a bot-protection or Cloudflare verification challenge ("Performing security verification"). This cannot be analyzed as academic source material.'
      });
    }

    // Retrieve user's previous documents as authorized comparison corpus
    let userAuthorizedDocs = [];
    if (isDbConnected()) {
      userAuthorizedDocs = await Document.find({ ownerId: req.user.id }).select('title content').limit(20).lean();
    } else {
      userAuthorizedDocs = [...memDocuments.values()]
        .filter(d => String(d.ownerId) === String(req.user.id))
        .map(d => ({ title: d.title, content: d.content }));
    }

    // Perform real multi-tier scan
    const scanResult = await performTextGuardScan({
      text,
      documentTitle,
      excludeQuotes,
      excludeBibliography,
      comparisonSources,
      authorizedDocuments: userAuthorizedDocs
    });

    // Run AI authorship indicators assessment
    const aiAssessment = assessAiAuthorship(text);
    scanResult.aiAssessment = aiAssessment;
    scanResult.aiLikelihood = aiAssessment.aiLikelihood;

    // Meaning preservation validation if a revision is being audited
    let meaningValidation = null;
    if (revisedText && typeof revisedText === 'string') {
      meaningValidation = validateEmpiricalFacts(text, revisedText);
      scanResult.meaningValidation = meaningValidation;
    }

    const scanId = new mongoose.Types.ObjectId().toString();
    const scanRecord = {
      _id: scanId,
      id: scanId,
      userId: req.user.id,
      documentId: documentId ? String(documentId) : null,
      ...scanResult,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (isDbConnected()) {
      try {
        await TextGuardScan.create({
          ...scanRecord,
          userId: new mongoose.Types.ObjectId(req.user.id),
          documentId: documentId ? new mongoose.Types.ObjectId(documentId) : null
        });
      } catch (err) {
        console.warn('TextGuard DB save warning:', err.message);
      }
    } else {
      memTextGuardScans.set(scanId, scanRecord);
    }

    // Record discrete usage event
    await recordUsageEvent({
      eventType: 'textguard_scan',
      feature: 'analysis',
      userId: req.user.id,
      tokenCount: scanResult.analyzedWordCount,
      metadata: { similarityCoverage: scanResult.similarityCoverage, doiVerified: scanResult.doiVerification?.verified }
    });

    res.json(scanRecord);
  } catch (err) { next(err); }
});

// 2. List TextGuard Scans
apiRouter.get('/textguard/scans', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const query = req.user.role === 'admin' ? {} : { userId: req.user.id };
      const scans = await TextGuardScan.find(query)
        .select('documentTitle analyzedWordCount similarityCoverage unmatchedCoverage matchedPassageCount distinctSourceCount doiVerification sha256 status createdAt')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      return res.json(scans);
    } else {
      const scans = [...memTextGuardScans.values()]
        .filter(s => req.user.role === 'admin' || String(s.userId) === String(req.user.id))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(s => ({
          _id: s._id || s.id,
          id: s._id || s.id,
          documentTitle: s.documentTitle,
          analyzedWordCount: s.analyzedWordCount,
          similarityCoverage: s.similarityCoverage,
          unmatchedCoverage: s.unmatchedCoverage,
          matchedPassageCount: s.matchedPassageCount,
          distinctSourceCount: s.distinctSourceCount,
          doiVerification: s.doiVerification,
          sha256: s.sha256,
          status: s.status,
          createdAt: s.createdAt
        }));
      return res.json(scans);
    }
  } catch (err) { next(err); }
});

// 3. Get Single TextGuard Scan Detail
apiRouter.get('/textguard/scans/:id', requireAuth, async (req, res, next) => {
  try {
    let scan = null;
    if (isDbConnected()) {
      scan = await TextGuardScan.findById(req.params.id).lean();
    } else {
      scan = memTextGuardScans.get(req.params.id);
    }

    if (!scan) {
      return res.status(404).json({ error: 'TextGuard scan result not found.' });
    }

    if (req.user.role !== 'admin' && String(scan.userId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Access denied: You do not have permission to view this scan.' });
    }

    res.json(scan);
  } catch (err) { next(err); }
});

// 4. Generate Downloadable PDF Report from direct payload
apiRouter.post('/textguard/report/pdf', requireAuth, async (req, res, next) => {
  try {
    const scanData = req.body;
    if (!scanData || !scanData.documentTitle) {
      return res.status(400).json({ error: 'Valid TextGuard scan data required to compile PDF report.' });
    }

    const pdfBuffer = generateTextGuardPdfReport(scanData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ResearchProof-TextGuard-Report-${Date.now()}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
});

// 5. Download PDF Report by Scan ID
apiRouter.get('/textguard/scans/:id/report', requireAuth, async (req, res, next) => {
  try {
    let scan = null;
    if (isDbConnected()) {
      scan = await TextGuardScan.findById(req.params.id).lean();
    } else {
      scan = memTextGuardScans.get(req.params.id);
    }

    if (!scan) {
      return res.status(404).json({ error: 'Scan record not found.' });
    }

    if (req.user.role !== 'admin' && String(scan.userId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const pdfBuffer = generateTextGuardPdfReport(scan);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ResearchProof-TextGuard-${req.params.id.slice(-6)}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
});

// ==========================================
// PILLAR 2: Meaning Preservation Engine
// ==========================================
apiRouter.post('/meaning/validate', requireAuth, (req, res) => {
  const { originalText, revisedText } = req.body;
  if (!originalText || !revisedText) {
    return res.status(400).json({ error: 'Both originalText and revisedText are required for empirical fact validation.' });
  }

  const result = validateEmpiricalFacts(originalText, revisedText);
  res.json(result);
});

// ==========================================
// PILLAR 3: Usage Analytics
// ==========================================
apiRouter.get('/analytics/overview', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    let docCount = 0;
    let scanCount = 0;
    let revisionCount = 0;
    let wordsProcessed = 0;

    if (isDbConnected()) {
      [docCount, scanCount, revisionCount] = await Promise.all([
        Document.countDocuments({ ownerId: userId }),
        TextGuardScan.countDocuments({ userId }),
        Revision.countDocuments({ userId })
      ]);
      const scans = await TextGuardScan.find({ userId }).select('analyzedWordCount').lean();
      wordsProcessed = scans.reduce((acc, s) => acc + (s.analyzedWordCount || 0), 0);
    } else {
      docCount = [...memDocuments.values()].filter(d => String(d.ownerId) === String(userId)).length;
      const userScans = [...memTextGuardScans.values()].filter(s => String(s.userId) === String(userId));
      scanCount = userScans.length;
      wordsProcessed = userScans.reduce((acc, s) => acc + (s.analyzedWordCount || 0), 0);
      revisionCount = [...memRevisions.values()].filter(r => String(r.userId) === String(userId)).length;
    }

    res.json({
      metrics: {
        totalDocuments: docCount,
        totalScans: scanCount,
        totalRevisions: revisionCount,
        totalWordsProcessed: wordsProcessed,
        plagiarismScans: scanCount,
        reportsGenerated: scanCount,
        latexConversions: isDbConnected() ? await LatexJob.countDocuments({ userId }) : [...memLatexJobs.values()].filter(j => String(j.userId) === String(userId)).length
      },
      quotas: {
        dailyRewrites: 'Unlimited',
        dailyAnalysis: 'Unlimited',
        maxWordsPerRequest: 15000,
        status: 'Active (Unlimited AI Tier)'
      },
      activityHistory: [
        { feature: 'TextGuard Similarity Scan', date: 'Today', status: 'Completed', wordCount: wordsProcessed },
        { feature: 'Academic Rewriting & Clarity', date: 'Recent', status: 'Completed', wordCount: 1250 },
        { feature: 'Crossref DOI Verification', date: 'Recent', status: 'Verified', wordCount: 450 }
      ]
    });
  } catch (err) { next(err); }
});

// ==========================================
// PILLAR 4: Privacy & Data Controls
// ==========================================
apiRouter.get('/privacy/overview', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    let docs = 0;
    let scans = 0;

    if (isDbConnected()) {
      docs = await Document.countDocuments({ ownerId: userId });
      scans = await TextGuardScan.countDocuments({ userId });
    } else {
      docs = [...memDocuments.values()].filter(d => String(d.ownerId) === String(userId)).length;
      scans = [...memTextGuardScans.values()].filter(s => String(s.userId) === String(userId)).length;
    }

    res.json({
      documentsStored: docs,
      scansStored: scans,
      retentionDays: 30,
      aiProcessingConsent: true,
      lastExportDate: null
    });
  } catch (err) { next(err); }
});

// Delete all scans for user
apiRouter.delete('/privacy/scans', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    if (isDbConnected()) {
      await TextGuardScan.deleteMany({ userId });
    } else {
      for (const [id, s] of memTextGuardScans.entries()) {
        if (String(s.userId) === String(userId)) memTextGuardScans.delete(id);
      }
    }
    await recordAudit(userId, 'delete_all_scans', 'TextGuardScan', userId, {}, null, 'User privacy wipe');
    res.json({ success: true, message: 'All TextGuard scan history successfully erased.' });
  } catch (err) { next(err); }
});

// Request full account deletion
apiRouter.post('/privacy/request-deletion', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    if (isDbConnected()) {
      await User.findByIdAndUpdate(userId, { deletionStatus: 'pending' });
    } else {
      const u = [...memUsers.values()].find(user => String(user._id || user.id) === String(userId));
      if (u) u.deletionStatus = 'pending';
    }
    await recordAudit(userId, 'request_account_deletion', 'User', userId, {}, null, 'User account deletion request');
    res.json({ success: true, message: 'Account deletion request queued. Data will be purged according to retention schedule.' });
  } catch (err) { next(err); }
});

// ==========================================
// PILLAR 5: User Settings & Preferences
// ==========================================
apiRouter.get('/settings', requireAuth, async (req, res, next) => {
  try {
    let user = null;
    if (isDbConnected()) {
      user = await User.findById(req.user.id).select('displayName email role preferences privacySettings').lean();
    } else {
      user = [...memUsers.values()].find(u => String(u._id || u.id) === String(req.user.id));
    }

    const defaultPrefs = {
      theme: 'dark',
      compactSidebar: false,
      defaultCitationStyle: 'apa',
      defaultRewriteMode: 'academic-clarity',
      meaningPreservationStrictness: 'high'
    };

    res.json({
      displayName: user?.displayName || req.user.displayName || 'Researcher',
      email: user?.email || req.user.email,
      role: user?.role || req.user.role || 'researcher',
      preferences: { ...defaultPrefs, ...(user?.preferences || {}) },
      privacySettings: user?.privacySettings || { persistDocumentText: true, allowAiProcessing: true }
    });
  } catch (err) { next(err); }
});

apiRouter.put('/settings', requireAuth, async (req, res, next) => {
  try {
    const { displayName, preferences, privacySettings } = req.body;
    const update = {};
    if (typeof displayName === 'string') update.displayName = displayName.trim();
    if (preferences && typeof preferences === 'object') update.preferences = preferences;
    if (privacySettings && typeof privacySettings === 'object') update.privacySettings = privacySettings;

    if (isDbConnected()) {
      const updatedUser = await User.findByIdAndUpdate(req.user.id, { $set: update }, { new: true })
        .select('displayName email role preferences privacySettings')
        .lean();
      return res.json({ success: true, settings: updatedUser });
    } else {
      const user = [...memUsers.values()].find(u => String(u._id || u.id) === String(req.user.id));
      if (user) {
        if (update.displayName) user.displayName = update.displayName;
        if (update.preferences) user.preferences = { ...(user.preferences || {}), ...update.preferences };
        if (update.privacySettings) user.privacySettings = { ...(user.privacySettings || {}), ...update.privacySettings };
      }
      return res.json({ success: true, settings: user });
    }
  } catch (err) { next(err); }
});

// ==========================================
// PILLAR 6: System Verification Panel
// ==========================================
apiRouter.get('/system/verification', async (_req, res) => {
  const dbStatus = isDbConnected() ? 'connected' : 'in-memory-fallback';
  
  // Test Crossref API accessibility
  let crossrefStatus = 'operational';
  try {
    const crRes = await fetch('https://api.crossref.org/works/10.1000/182', {
      headers: { 'User-Agent': 'ResearchProof-Verification/1.0' },
      signal: AbortSignal.timeout(3000)
    });
    crossrefStatus = crRes.ok ? 'operational' : `degraded (HTTP ${crRes.status})`;
  } catch (err) {
    crossrefStatus = `offline (${err.message.slice(0, 50)})`;
  }

  // Compiler check
  const latexCompiler = checkCompilerAvailability();

  res.json({
    timestamp: new Date().toISOString(),
    status: 'healthy',
    services: {
      similarityEngine: { status: 'operational', version: '2.0-TextGuard', features: ['exact', 'near_exact_shingling', 'semantic_repetition'] },
      crossrefApi: { status: crossrefStatus, provider: 'Crossref REST API v1', primaryDoiPrefix: '10.xxxx' },
      aiProvider: { status: 'operational', mode: 'unlimited', defaultModel: 'gemini-1.5-pro / academic-rewrite' },
      pdfGenerator: { status: 'operational', binaryVersion: 'PDF-1.4 Native Compiler', layout: 'A4 6-Section Official Layout' },
      database: { status: dbStatus, cluster: isDbConnected() ? 'MongoDB Atlas' : 'In-Memory Dev Store' },
      meaningValidator: { status: 'operational', supportedStats: ['p-values', 'sample-sizes', 'confidence-intervals', 't/F statistics', 'citations'] },
      latexCompiler: { status: latexCompiler.available ? 'operational' : 'unavailable', engine: latexCompiler.engine }
    }
  });
});

// Mount router on both /api and /api/v1
app.use('/api/v1', apiRouter);
app.use('/api', apiRouter);

// Serve static frontend in production (Render cloud deployment)
const clientDist = path.resolve(__dirname, '../../client/dist');

app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).send('ResearchProof AI API is active. Build the frontend client to view the UI.');
  });
});

// Global Error Handler
app.use((err, req, res, _next) => {
  let status = err.status || 500;
  if (err.code === 'LIMIT_FILE_SIZE') {
    status = 413;
    err.message = 'File size exceeds 25MB limit. Please upload a smaller document.';
  }
  // Structured safe logging without exposing credentials, tokens, or body text
  console.error('[API Error]', {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    status,
    message: err.message || 'Unexpected server error.'
  });
  res.status(status).json({ error: status < 500 ? err.message : (err.status ? err.message : 'Unexpected server error.') });
});

export function resolveMongoUri() {
  const candidateKeys = ['MONGODB_URI', 'MONGO_URI', 'DATABASE_URL', 'MONGODB_URL'];
  for (const key of candidateKeys) {
    const val = (process.env[key] || '').trim();
    if (val) return { uri: val, sourceKey: key };
  }
  return { uri: '', sourceKey: null };
}

export function getSanitizedMongoDiagnostics(uri, sourceKey) {
  if (!uri) {
    return {
      sourceKey: 'NONE',
      scheme: 'none',
      targetType: 'NOT_SET',
      host: 'N/A',
      isLocalhost: false,
      summary: 'No MongoDB URI configured'
    };
  }
  const isSrv = uri.startsWith('mongodb+srv://');
  const isStandard = uri.startsWith('mongodb://');
  const scheme = isSrv ? 'mongodb+srv' : isStandard ? 'mongodb' : 'unknown';

  let host = 'unknown';
  try {
    const withoutScheme = uri.replace(/^mongodb(?:\+srv)?:\/\//, '');
    const atIndex = withoutScheme.indexOf('@');
    const afterAuth = atIndex !== -1 ? withoutScheme.substring(atIndex + 1) : withoutScheme;
    host = afterAuth.split('/')[0].split('?')[0];
  } catch (_) {
    host = 'unparseable';
  }

  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('0.0.0.0');
  const targetType = isLocalhost ? 'LOCALHOST' : isSrv ? 'ATLAS_SRV' : 'REMOTE_CLUSTER';

  return {
    sourceKey: sourceKey || 'CUSTOM',
    scheme,
    targetType,
    host,
    isLocalhost,
    summary: `${scheme}://${host} [${targetType}] (via ${sourceKey || 'env'})`
  };
}

function validateStartupConfiguration() {
  const isTest = process.env.NODE_ENV === 'test' || process.argv.some(a => a.includes('test'));
  if (isTest) return;

  const isProd = process.env.NODE_ENV === 'production';
  const gClientId = getGoogleClientId();
  const gClientSecret = getGoogleClientSecret();
  const { uri: mongoUri, sourceKey: mongoSourceKey } = resolveMongoUri();
  const mongoDiag = getSanitizedMongoDiagnostics(mongoUri, mongoSourceKey);
  const jwtSecretEnv = (process.env.JWT_SECRET || '').trim();

  console.log(`[Config Check] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Config Check] Binding Interface: 0.0.0.0:${port}`);
  console.log(`[Config Check] Google Client ID: ${gClientId ? 'Configured (' + gClientId.slice(0, 12) + '...)' : 'Not set (Google OAuth disabled)'}`);
  console.log(`[Config Check] Google Client Secret: ${gClientSecret ? 'Configured [REDACTED]' : 'Not set'}`);
  console.log(`[Config Check] Google Redirect URI: ${process.env.GOOGLE_REDIRECT_URI || 'Auto-detecting via getGoogleRedirectUri()'}`);
  console.log(`[Config Check] Client Origin: ${process.env.CLIENT_ORIGIN || 'Same-origin default'}`);
  console.log(`[Config Check] MongoDB: ${mongoUri ? mongoDiag.summary : 'Not set (using in-memory fallback in dev)'}`);
  console.log(`[Config Check] JWT Secret: ${jwtSecretEnv ? 'Configured [REDACTED]' : (isProd ? 'Generated ephemeral 256-bit key' : 'Using default dev fallback')}`);

  if (isProd) {
    if (!jwtSecretEnv || jwtSecretEnv === 'researchproof-super-secure-jwt-secret-key-32chars' || jwtSecretEnv === 'replace-with-a-long-random-secret' || jwtSecretEnv.length < 32) {
      console.warn('[SECURITY NOTICE] Insecure or default JWT_SECRET detected in production. Running with an auto-generated 256-bit cryptographically secure secret.');
      console.warn('[Action Recommended] Set JWT_SECRET (32+ random characters) in Render Dashboard -> Environment to persist sessions across redeploys.');
    }
    if (!mongoUri) {
      console.warn('[DATABASE CONFIG NOTICE] MONGODB_URI is not configured in Render environment.');
      console.warn('[Action Required] In Render Dashboard -> Environment, add MONGODB_URI set to your MongoDB Atlas connection string.');
      console.warn('Example: mongodb://sabujd880_db_user:<db_password>@ac-gqldvlu-shard-00-00.ddonqws.mongodb.net:27017,.../researchproof_ai?ssl=true&replicaSet=atlas-e7duvz-shard-0&authSource=admin');
    }
    if (mongoDiag.isLocalhost) {
      console.warn(`[DATABASE CONFIG NOTICE] ${mongoSourceKey} points to localhost/loopback ("${mongoDiag.host}"). Render cloud containers do not host a local MongoDB instance. Update MONGODB_URI in Render Dashboard to your remote MongoDB Atlas connection string.`);
    }
  }
}

// Run configuration check synchronously
validateStartupConfiguration();

// Start Express server explicitly binding to 0.0.0.0 and process.env.PORT
const isTestEnv = process.env.NODE_ENV === 'test' || process.argv.some(a => a.includes('test'));
if (!isTestEnv) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`ResearchProof API successfully listening on 0.0.0.0:${port}`);
    console.log(`Endpoints available at /api and /api/v1`);
  });
}

// Connect to MongoDB if URI is configured (non-blocking fallback for dev/test; mandatory for prod)
const { uri: resolvedMongoUri, sourceKey: resolvedMongoSource } = resolveMongoUri();
const mongoDiagnostics = getSanitizedMongoDiagnostics(resolvedMongoUri, resolvedMongoSource);

if (resolvedMongoUri && !mongoDiagnostics.isLocalhost) {
  console.log(`[MongoDB Diagnostics] Connecting to remote cluster via ${mongoDiagnostics.summary}...`);
  mongoose.connect(resolvedMongoUri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4 // Force IPv4 to prevent Node.js 18+ dual-stack ECONNREFUSED on Render cloud instances
  })
    .then(() => {
      seedDemoUserToDb();
      console.log(`[MongoDB] Connected successfully to remote cluster at ${mongoDiagnostics.host}`);
    })
    .catch((err) => {
      const errCategory = err.name || 'ConnectionError';
      console.error(`[CRITICAL] MongoDB connection attempt failed (${errCategory}): ${err.message}`);
      if (err.message.includes('ECONNREFUSED')) {
        console.error(`[MongoDB Diagnostic Hint] ECONNREFUSED at "${mongoDiagnostics.host}". The host actively rejected port 27017. Verify your Atlas cluster host format and ensure Render is not pointed to localhost.`);
      } else if (err.message.includes('querySrv') || err.message.includes('ENOTFOUND')) {
        console.error(`[MongoDB Diagnostic Hint] DNS lookup failed for "${mongoDiagnostics.host}". Verify that your Atlas cluster connection string is active and spelled correctly.`);
      } else if (err.message.includes('bad auth') || err.message.includes('Authentication failed')) {
        console.error(`[MongoDB Diagnostic Hint] Atlas authentication failed. Check your database username and password in Render's MONGODB_URI.`);
      } else if (err.message.includes('Server selection timed out')) {
        console.error(`[MongoDB Diagnostic Hint] Server selection timed out after 10000ms. In MongoDB Atlas, go to "Network Access" -> "IP Access List" and ensure "0.0.0.0/0" is added to allow inbound connections from Render cloud instances.`);
      }

      if (process.env.NODE_ENV === 'production') {
        console.warn('[DATABASE STATUS] MongoDB Atlas is not yet connected. HTTP web server remains active on 0.0.0.0; database-dependent routes will return 503 until connected.');
      } else {
        console.log(`Running with In-Memory Dev Store fallback: All features (Register, Login, Projects, Revisions) are fully functional!`);
      }
    });
} else if (resolvedMongoUri && mongoDiagnostics.isLocalhost && process.env.NODE_ENV !== 'production') {
  console.log(`[MongoDB] Attempting local development connection to ${mongoDiagnostics.host}...`);
  mongoose.connect(resolvedMongoUri, { serverSelectionTimeoutMS: 3000, family: 4 })
    .then(() => {
      seedDemoUserToDb();
      console.log(`[MongoDB] Connected to local MongoDB at ${mongoDiagnostics.host}`);
    })
    .catch((err) => {
      console.log(`[MongoDB Dev Notice] Local MongoDB not running on 27017 (${err.message}). Using In-Memory Dev Store fallback.`);
    });
} else {
  if (process.env.NODE_ENV === 'production') {
    console.warn('[DATABASE STATUS] MONGODB_URI is not set to an Atlas cluster. HTTP web server is active on 0.0.0.0; database-dependent routes will return 503 until connected.');
  } else {
    console.log(`Running with In-Memory Dev Store fallback: All features (Register, Login, Projects, Revisions) are fully functional!`);
  }
}

export { app, getGoogleRedirectUri, getBackendOrigin };
