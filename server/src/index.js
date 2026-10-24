import 'dotenv/config'; // Environment loaded (Groq/OpenRouter ready)
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { OAuth2Client } from 'google-auth-library';
import { User, Project, Document, Revision, IntegrityReport, AuditEvent, UsageRecord, Citation, DoiCache, UsageEvent, DailyUsageAggregate, DataDeletionJob, LatexJob } from './models.js';
import { requireAuth, requireAdmin } from './middleware.js';
import { assessWriting, findRepeatedPhrases, checkCitations, humanizeWithAI, ACADEMIC_REWRITE_MODES } from './services.js';
import { auditMeaningPreservation } from './meaningChecker.js';
import { lookupDoiMetadata, formatApa, formatMla, formatIeee, formatInTextCitation, validateDocumentCitations, normalizeDoi } from './citationService.js';
import { importDocxFromBuffer, exportDocxFromText } from './docxService.js';
import { recordUsageEvent, getAnalyticsOverview, getFeatureUsageBreakdown, getErrorTrends } from './analyticsService.js';
import { generateIntegrityReport, exportIntegrityReportDocx } from './integrityService.js';
import { convertToApa7Project, escapeLatex, mapHeadingToApa7, generateBibtex, resolveInTextCitations } from './apa7Converter.js';
import { attemptPdfCompilation, checkCompilerAvailability } from './latexCompiler.js';



const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET || 'researchproof-super-secure-jwt-secret-key-32chars';
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'rp_session';
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 24);

// Section 6: Configurable Free Limits
const FREE_REWRITE_DAILY_LIMIT = Number(process.env.FREE_REWRITE_DAILY_LIMIT || 5);
const FREE_REWRITE_MAX_WORDS = Number(process.env.FREE_REWRITE_MAX_WORDS || 2000);
const FREE_ANALYSIS_DAILY_LIMIT = Number(process.env.FREE_ANALYSIS_DAILY_LIMIT || 10);
const FREE_ANALYSIS_MAX_WORDS = Number(process.env.FREE_ANALYSIS_MAX_WORDS || 5000);

function countWords(str = '') {
  return str.trim() ? str.trim().split(/\s+/).length : 0;
}

function getUtcDateKey() {
  return new Date().toISOString().split('T')[0];
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) {
  console.warn('WARNING: Set JWT_SECRET to a random secret of at least 24 characters in server/.env.');
}

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 250, standardHeaders: true, legacyHeaders: false }));

// Session Cookie Management (Section 4 & 5)
function setSessionCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOpts = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: SESSION_TTL_HOURS * 60 * 60 * 1000
  };
  res.cookie('rp_session', token, cookieOpts);
  if (SESSION_COOKIE_NAME !== 'rp_session') {
    res.cookie(SESSION_COOKIE_NAME, token, cookieOpts);
  }
}

function clearSessionCookie(res) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOpts = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax'
  };
  res.clearCookie('rp_session', cookieOpts);
  if (SESSION_COOKIE_NAME !== 'rp_session') {
    res.clearCookie(SESSION_COOKIE_NAME, cookieOpts);
  }
}

// Google OAuth Verification (Section 2)
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyGoogleToken(idToken) {
  const expectedClientId = process.env.GOOGLE_CLIENT_ID;
  let payload = null;

  // 1. Primary: Verify cryptographically with official google-auth-library
  if (expectedClientId && expectedClientId !== 'your-google-oauth-client-id.apps.googleusercontent.com') {
    try {
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
const memDocuments = new Map();
const memRevisions = new Map();
const memCitations = new Map();
const memReports = new Map();
const memJobs = new Map();
const memAuditEvents = [];
const memLatexJobs = new Map();
const latexArtifactCache = new Map();
const isDbConnected = () => mongoose.connection.readyState === 1;
app.locals.memUsers = memUsers;
app.locals.memProjects = memProjects;
app.locals.memDocuments = memDocuments;
app.locals.memRevisions = memRevisions;
app.locals.memCitations = memCitations;
app.locals.memReports = memReports;
app.locals.memJobs = memJobs;
app.locals.memAuditEvents = memAuditEvents;
app.locals.memLatexJobs = memLatexJobs;
app.locals.latexArtifactCache = latexArtifactCache;


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


const textSchema = z.object({ text: z.string().min(1).max(50000) });
const authSchema = z.object({ email: z.string().email().max(254), password: z.string().min(10).max(128) });

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
      mem.usage = mem.usage || { dailyRequests: 0, dailyLimit: FREE_REWRITE_DAILY_LIMIT };
      mem.usage.dailyRequests = (mem.usage.dailyRequests || 0) + 1;
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
      setSessionCookie(res, token);
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
    setSessionCookie(res, token);
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

    if (isDbConnected()) {
      const user = await User.findOne({ email });
      if (!user || !user.passwordHash || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
      if (user.status === 'suspended') {
        return res.status(403).json({ error: 'Account is suspended. Please contact your administrator.' });
      }
      user.lastLoginAt = new Date();
      await user.save();
      const token = jwt.sign(
        { id: user._id.toString(), email: user.email, tokenVersion: user.tokenVersion || 1 },
        jwtSecret,
        { expiresIn: `${SESSION_TTL_HOURS}h` }
      );
      setSessionCookie(res, token);
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
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended. Please contact your administrator.' });
    }
    user.lastLoginAt = new Date();
    const token = jwt.sign(
      { id: user.id || user._id, email: user.email, tokenVersion: user.tokenVersion || 1 },
      jwtSecret,
      { expiresIn: `${SESSION_TTL_HOURS}h` }
    );
    setSessionCookie(res, token);
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

// Google Authentication (Section 2 & 4)
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
      setSessionCookie(res, token);
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
    setSessionCookie(res, token);

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
  clearSessionCookie(res);
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
      rewriteUsed = mem?.usage?.dailyRequests || 0;
    }

    const tomorrowUtc = new Date();
    tomorrowUtc.setUTCHours(24, 0, 0, 0);

    const hasAiKey = Boolean(
      (process.env.AI_API_KEY && process.env.AI_API_KEY.trim()) ||
      (process.env.REVERSEGPT_API_KEY && process.env.REVERSEGPT_API_KEY.trim())
    );

    res.json({
      date: today,
      aiAvailable: hasAiKey,
      rewrite: {
        used: rewriteUsed,
        limit: FREE_REWRITE_DAILY_LIMIT,
        remaining: Math.max(0, FREE_REWRITE_DAILY_LIMIT - rewriteUsed),
        maxWords: FREE_REWRITE_MAX_WORDS
      },
      analysis: {
        used: analysisUsed,
        limit: FREE_ANALYSIS_DAILY_LIMIT,
        remaining: Math.max(0, FREE_ANALYSIS_DAILY_LIMIT - analysisUsed),
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
    if (isDbConnected()) {
      const user = await User.findById(req.user.id).select('-passwordHash').lean();
      if (!user) return res.status(404).json({ error: 'User not found.' });
      return res.json({
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

    const user = [...memUsers.values()].find(u => (u._id === req.user.id || u.id === req.user.id));
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({
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

// Writing Analysis (Section 6: Analysis Limits)
apiRouter.post(['/analyze/writing', '/analysis/writing'], requireAuth, async (req, res, next) => {
  try {
    const parsed = textSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Text is required and must be under 50,000 characters.' });
    const words = countWords(parsed.data.text);
    if (words > FREE_ANALYSIS_MAX_WORDS) {
      return res.status(400).json({
        error: `Text exceeds the analysis limit of ${FREE_ANALYSIS_MAX_WORDS} words (submitted ${words} words).`,
        maxWords: FREE_ANALYSIS_MAX_WORDS
      });
    }
    await recordFeatureUsage(req.user.id, req.user.email, 'analysis');
    res.json(assessWriting(parsed.data.text));
  } catch (e) { next(e); }
});

// Similarity / Originality
apiRouter.post(['/analyze/originality', '/analysis/similarity'], requireAuth, async (req, res, next) => {
  try {
    const parsed = textSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Text is required and must be under 50,000 characters.' });
    const words = countWords(parsed.data.text);
    if (words > FREE_ANALYSIS_MAX_WORDS) {
      return res.status(400).json({
        error: `Text exceeds the analysis limit of ${FREE_ANALYSIS_MAX_WORDS} words (submitted ${words} words).`,
        maxWords: FREE_ANALYSIS_MAX_WORDS
      });
    }
    await recordFeatureUsage(req.user.id, req.user.email, 'analysis');
    res.json({
      repeatedPhrases: findRepeatedPhrases(parsed.data.text),
      scope: 'Within-document phrase repetition only',
      externalDatabaseChecked: false
    });
  } catch (e) { next(e); }
});

// Citation Verification (with Crossref DOI resolution)
apiRouter.post(['/analyze/citations', '/analysis/citations'], requireAuth, async (req, res, next) => {
  try {
    const parsed = textSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Text is required and must be under 50,000 characters.' });
    const words = countWords(parsed.data.text);
    if (words > FREE_ANALYSIS_MAX_WORDS) {
      return res.status(400).json({
        error: `Text exceeds the analysis limit of ${FREE_ANALYSIS_MAX_WORDS} words (submitted ${words} words).`,
        maxWords: FREE_ANALYSIS_MAX_WORDS
      });
    }
    await recordFeatureUsage(req.user.id, req.user.email, 'analysis');
    const results = await checkCitations(parsed.data.text);
    res.json(results);
  } catch (e) { next(e); }
});

// AI Academic Revision & Rewriting (Section 4 & 5)
apiRouter.post(['/revisions/rewrite', '/humanize', '/revisions/humanize'], requireAuth, checkAiUsage, async (req, res, next) => {
  try {
    const schema = textSchema.extend({
      mode: z.string().optional().default('academic-clarity'),
      style: z.string().max(60).optional(),
      preserveTerms: z.string().max(3000).optional(),
      saveRevision: z.boolean().optional().default(true),
      projectId: z.string().optional(),
      documentId: z.string().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Provide text under 50,000 characters and valid options.' });

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

// Projects
apiRouter.get('/projects', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      return res.json(await Project.find({ userId: req.user.id }).sort({ updatedAt: -1 }).lean());
    }
    const userProjects = [...memProjects.values()]
      .filter(p => p.userId === req.user.id)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json(userProjects);
  } catch (e) { next(e); }
});

apiRouter.post('/projects', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().trim().min(1).max(160),
      description: z.string().max(1000).optional(),
      discipline: z.string().max(100).optional(),
      documentType: z.string().max(80).optional()
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Project title is required.' });

    if (isDbConnected()) {
      const project = await Project.create({
        userId: req.user.id,
        title: p.data.title,
        description: p.data.description || '',
        discipline: p.data.discipline || 'General Academic',
        documentType: p.data.documentType || 'Manuscript'
      });
      await recordAudit(req.user.id, 'PROJECT_CREATED', 'Project', project._id);
      return res.status(201).json(project);
    }

    const projectId = new mongoose.Types.ObjectId().toString();
    const newProj = {
      _id: projectId,
      userId: req.user.id,
      title: p.data.title,
      description: p.data.description || '',
      discipline: p.data.discipline || 'General Academic',
      documentType: p.data.documentType || 'Manuscript',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    memProjects.set(projectId, newProj);
    res.status(201).json(newProj);
  } catch (e) { next(e); }
});

apiRouter.get('/projects/:id', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const project = await Project.findOne({ _id: req.params.id, userId: req.user.id }).lean();
      if (!project) return res.status(404).json({ error: 'Project not found.' });
      const documents = await Document.find({ projectId: project._id, ownerId: req.user.id }).sort({ updatedAt: -1 }).lean();
      return res.json({ ...project, documents });
    }
    const proj = memProjects.get(req.params.id);
    if (!proj || proj.userId !== req.user.id) return res.status(404).json({ error: 'Project not found.' });
    const documents = [...memDocuments.values()].filter(d => d.projectId === req.params.id && d.ownerId === req.user.id);
    res.json({ ...proj, documents });
  } catch (e) { next(e); }
});

apiRouter.patch('/projects/:id', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().trim().min(1).max(160).optional(),
      description: z.string().max(1000).optional(),
      discipline: z.string().max(100).optional(),
      documentType: z.string().max(80).optional()
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Invalid update data.' });

    if (isDbConnected()) {
      const project = await Project.findOneAndUpdate(
        { _id: req.params.id, userId: req.user.id },
        { $set: p.data },
        { new: true }
      );
      if (!project) return res.status(404).json({ error: 'Project not found.' });
      return res.json(project);
    }

    const proj = memProjects.get(req.params.id);
    if (!proj || proj.userId !== req.user.id) return res.status(404).json({ error: 'Project not found.' });
    Object.assign(proj, p.data, { updatedAt: new Date().toISOString() });
    res.json(proj);
  } catch (e) { next(e); }
});

apiRouter.delete('/projects/:id', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const project = await Project.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
      if (!project) return res.status(404).json({ error: 'Project not found.' });
      await Revision.deleteMany({ projectId: project._id, userId: req.user.id });
      await Document.deleteMany({ projectId: project._id, ownerId: req.user.id });
      await recordAudit(req.user.id, 'PROJECT_DELETED', 'Project', req.params.id);
      return res.json({ deleted: true });
    }

    const proj = memProjects.get(req.params.id);
    if (!proj || proj.userId !== req.user.id) return res.status(404).json({ error: 'Project not found.' });
    memProjects.delete(req.params.id);
    for (const [id, r] of memRevisions.entries()) {
      if (r.projectId === req.params.id && r.userId === req.user.id) memRevisions.delete(id);
    }
    for (const [id, d] of memDocuments.entries()) {
      if (d.projectId === req.params.id && d.ownerId === req.user.id) memDocuments.delete(id);
    }
    res.json({ deleted: true });
  } catch (e) { next(e); }
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

    if (isDbConnected()) {
      profile = await User.findById(req.user.id).select('email displayName role createdAt lastLoginAt privacySettings usage').lean();
      projects = await Project.find({ userId: req.user.id }).lean();
      documents = await Document.find({ ownerId: req.user.id }).lean();
      revisions = await Revision.find({ userId: req.user.id }).select('mode summary originalText revisedText status createdAt').lean();
      citations = await Citation.find({ ownerId: req.user.id }).lean();
      reports = await IntegrityReport.find({ ownerId: req.user.id }).select('title reportType summaryMetrics findings limitations createdAt').lean();
    } else {
      profile = memUsers.get(req.user.email);
      projects = [...memProjects.values()].filter(p => p.userId === req.user.id);
      documents = [...memDocuments.values()].filter(d => d.ownerId === req.user.id);
      revisions = [...memRevisions.values()].filter(r => r.userId === req.user.id);
      citations = [...memCitations.values()].filter(c => c.ownerId === req.user.id);
      reports = [...memReports.values()].filter(r => r.ownerId === req.user.id);
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
      user: safeProfile,
      projects,
      documents,
      revisions,
      citations,
      integrityReports: reports
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
      return res.json({ deleted: true });
    } else {
      const doc = memDocuments.get(req.params.id);
      if (!doc || doc.ownerId !== req.user.id) return res.status(404).json({ error: 'Document not found.' });
      memDocuments.delete(req.params.id);
      for (const [revId, rev] of memRevisions.entries()) {
        if (rev.documentId === req.params.id && rev.userId === req.user.id) memRevisions.delete(revId);
      }
      await recordAudit(req.user.id, 'document_deleted', 'Document', req.params.id);
      return res.json({ deleted: true });
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
    clearSessionCookie(res);
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

    const variant = payload.variant === 'professional' ? 'professional' : 'student';
    let title = (payload.title || '').trim();
    let authors = Array.isArray(payload.authors) ? payload.authors : (payload.author ? [payload.author] : []);
    let affiliations = Array.isArray(payload.affiliations) ? payload.affiliations : (payload.affiliation ? [payload.affiliation] : []);
    let rawText = payload.content || payload.rawText || '';
    let citations = Array.isArray(payload.citations) ? payload.citations : [];
    let sourceDocumentId = payload.documentId || null;

    // Handle DOCX upload if file is attached
    if (req.file && req.file.buffer) {
      try {
        const imported = await importDocxFromBuffer(req.file.buffer);
        rawText = imported.text || rawText;
        if (!title && imported.title) title = imported.title;
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

    // Execute APA 7 Project Conversion
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
      rawText,
      citations
    });

    // Execute Secure PDF Compilation Attempt
    const compilationResult = await attemptPdfCompilation(conversionResult.zipBuffer);
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
        correspondingAuthor: payload.correspondingAuthor || ''
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
      metadata: { variant, compilationStatus: compilationResult.status }
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
      mainTexSnippet: jobData.mainTexSnippet,
      report: jobData.report
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

// Mount router on both /api and /api/v1
app.use('/api/v1', apiRouter);
app.use('/api', apiRouter);

// Serve static frontend in production (Render cloud deployment)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '../../client/dist');

app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).send('ResearchProof AI API is active. Build the frontend client to view the UI.');
  });
});

// Global Error Handler
app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Unexpected server error.' });
});

// Start Express server
const isTestEnv = process.env.NODE_ENV === 'test' || process.argv.some(a => a.includes('test'));
if (!isTestEnv) {
  app.listen(port, () => {
    console.log(`ResearchProof API listening on http://localhost:${port}`);
    console.log(`Endpoints available at /api and /api/v1`);
  });
}

// Connect to MongoDB if URI is configured (non-blocking fallback)
const mongoUri = process.env.MONGODB_URI;
if (mongoUri && !mongoUri.includes('localhost:5173')) {
  mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 4000 })
    .then(() => {
      seedDemoUserToDb();
      console.log(`Connected to MongoDB successfully at ${mongoUri.split('@').pop()}`);
    })
    .catch((err) => {
      console.warn(`[Notice] MongoDB connection attempt failed: ${err.message}`);
      console.log(`Running with In-Memory Dev Store fallback: All features (Register, Login, Projects, Revisions) are fully functional!`);
    });
} else {
  console.log(`Running with In-Memory Dev Store fallback: All features (Register, Login, Projects, Revisions) are fully functional!`);
}

export { app };
