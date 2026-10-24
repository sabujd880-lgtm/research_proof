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
import { OAuth2Client } from 'google-auth-library';
import { User, Project, Document, Revision, IntegrityReport, AuditEvent } from './models.js';
import { requireAuth } from './middleware.js';
import { assessWriting, findRepeatedPhrases, checkCitations, humanizeWithAI } from './services.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET || 'researchproof-super-secure-jwt-secret-key-32chars';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) {
  console.warn('WARNING: Set JWT_SECRET to a random secret of at least 24 characters in server/.env.');
}

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 250, standardHeaders: true, legacyHeaders: false }));

// Session Cookie Management (Section 5)
function setSessionCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('rp_session', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  });
}

function clearSessionCookie(res) {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('rp_session', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax'
  });
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
const isDbConnected = () => mongoose.connection.readyState === 1;

// Pre-seed default demo credentials
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
  createdAt: new Date()
});

async function seedDemoUserToDb() {
  try {
    const existing = await User.findOne({ email: DEMO_EMAIL });
    if (!existing) {
      await User.create({
        email: DEMO_EMAIL,
        passwordHash: DEMO_HASH,
        displayName: 'Demo Researcher'
      });
      console.log(`Demo user ready: ${DEMO_EMAIL}`);
    }
  } catch (err) {
    // Non-blocking
  }
}

// Safe Audit Logging Helper (Section 6 & 10)
async function recordAudit(actorId, action, resourceType, resourceId = '', metadata = {}) {
  try {
    if (isDbConnected()) {
      await AuditEvent.create({
        actorId,
        action,
        resourceType,
        resourceId: String(resourceId),
        metadata
      });
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

// Usage Quota Middleware (Section 9)
async function checkAiUsage(req, res, next) {
  try {
    const userId = req.user.id;
    const now = new Date();

    if (isDbConnected()) {
      const user = await User.findById(userId);
      if (!user) return res.status(401).json({ error: 'User not found.' });

      const lastReset = user.usage?.lastResetDate ? new Date(user.usage.lastResetDate) : new Date(0);
      const isNewDay = now.toDateString() !== lastReset.toDateString();

      if (isNewDay) {
        user.usage = { dailyRequests: 1, dailyLimit: user.usage?.dailyLimit || 50, lastResetDate: now };
        await user.save();
      } else {
        if ((user.usage?.dailyRequests || 0) >= (user.usage?.dailyLimit || 50)) {
          return res.status(429).json({
            error: 'Daily AI revision quota exceeded. Limit will reset at midnight.',
            dailyLimit: user.usage?.dailyLimit || 50
          });
        }
        await User.findByIdAndUpdate(userId, { $inc: { 'usage.dailyRequests': 1 } });
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

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
        lastLoginAt: new Date()
      });
      const token = jwt.sign({ id: user._id.toString(), email: user.email }, jwtSecret, { expiresIn: '8h' });
      setSessionCookie(res, token);
      await recordAudit(user._id, 'USER_REGISTERED', 'User', user._id);
      return res.status(201).json({
        token,
        user: { id: user._id, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl, role: user.role, status: user.status }
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
      createdAt: new Date(),
      lastLoginAt: new Date()
    };
    memUsers.set(email, newUser);
    const token = jwt.sign({ id: userId, email }, jwtSecret, { expiresIn: '8h' });
    setSessionCookie(res, token);
    res.status(201).json({
      token,
      user: { id: userId, email, displayName: newUser.displayName, avatarUrl: '', role: 'researcher', status: 'active' }
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
      const token = jwt.sign({ id: user._id.toString(), email: user.email }, jwtSecret, { expiresIn: '8h' });
      setSessionCookie(res, token);
      await recordAudit(user._id, 'USER_LOGIN', 'User', user._id);
      return res.json({
        token,
        user: { id: user._id, email: user.email, displayName: user.displayName || user.email.split('@')[0], avatarUrl: user.avatarUrl, role: user.role, status: user.status }
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
    const token = jwt.sign({ id: user.id || user._id, email: user.email }, jwtSecret, { expiresIn: '8h' });
    setSessionCookie(res, token);
    res.json({
      token,
      user: { id: user.id || user._id, email: user.email, displayName: user.displayName || user.email.split('@')[0], avatarUrl: user.avatarUrl || '', role: user.role || 'researcher', status: user.status || 'active' }
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

      // 2. If not found by googleId, check by email to link account
      if (!user) {
        user = await User.findOne({ email });
        if (user) {
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
            role: 'researcher',
            status: 'active',
            lastLoginAt: new Date()
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

      const token = jwt.sign({ id: user._id.toString(), email: user.email }, jwtSecret, { expiresIn: '8h' });
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
          usage: user.usage || { dailyRequests: 0, dailyLimit: 50 }
        }
      });
    }

    // In-memory fallback
    user = [...memUsers.values()].find(u => u.googleId === googleId);
    if (!user) {
      user = memUsers.get(email);
      if (user) {
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
          role: 'researcher',
          status: 'active',
          usage: { dailyRequests: 0, dailyLimit: 50 },
          createdAt: new Date(),
          lastLoginAt: new Date()
        };
        memUsers.set(email, user);
      }
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Your account is suspended. Please contact your administrator.' });
    }

    const token = jwt.sign({ id: user._id || user.id, email: user.email }, jwtSecret, { expiresIn: '8h' });
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
        usage: user.usage || { dailyRequests: 0, dailyLimit: 50 }
      }
    });
  } catch (err) {
    console.error('Google authentication error:', err.message);
    res.status(401).json({ error: err.message || 'Google authentication failed. Please try again.' });
  }
});

// Logout endpoint (Section 4 & 5)
apiRouter.post('/auth/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ success: true, message: 'Logged out successfully.' });
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

// Writing Analysis
apiRouter.post(['/analyze/writing', '/analysis/writing'], requireAuth, (req, res) => {
  const parsed = textSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Text is required and must be under 50,000 characters.' });
  res.json(assessWriting(parsed.data.text));
});

// Similarity / Originality
apiRouter.post(['/analyze/originality', '/analysis/similarity'], requireAuth, (req, res) => {
  const parsed = textSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Text is required and must be under 50,000 characters.' });
  res.json({
    repeatedPhrases: findRepeatedPhrases(parsed.data.text),
    scope: 'Within-document phrase repetition only',
    externalDatabaseChecked: false
  });
});

// Citation Verification (with Crossref DOI resolution)
apiRouter.post(['/analyze/citations', '/analysis/citations'], requireAuth, async (req, res, next) => {
  try {
    const parsed = textSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Text is required and must be under 50,000 characters.' });
    const results = await checkCitations(parsed.data.text);
    res.json(results);
  } catch (e) { next(e); }
});

// AI Revision / Humanizer (with usage quota enforcement - Section 9)
apiRouter.post(['/humanize', '/revisions/humanize'], requireAuth, checkAiUsage, async (req, res, next) => {
  try {
    const schema = textSchema.extend({
      style: z.string().max(60).optional(),
      preserveTerms: z.string().max(3000).optional(),
      saveRevision: z.boolean().optional(),
      projectId: z.string().optional(),
      documentId: z.string().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Provide text under 50,000 characters and valid options.' });
    
    const result = await humanizeWithAI(parsed.data);
    let saved = false;

    if (parsed.data.saveRevision && process.env.PERSIST_DOCUMENT_TEXT !== 'false') {
      saved = true;
      if (isDbConnected()) {
        const rev = await Revision.create({
          userId: req.user.id,
          projectId: mongoose.isValidObjectId(parsed.data.projectId) ? parsed.data.projectId : null,
          documentId: mongoose.isValidObjectId(parsed.data.documentId) ? parsed.data.documentId : null,
          mode: 'humanize',
          originalText: parsed.data.text,
          revisedText: result.revisedText,
          summary: result.changeSummary,
          modelProvider: 'openai-compatible',
          modelName: process.env.AI_MODEL || 'default'
        });
        await recordAudit(req.user.id, 'REVISION_CREATED', 'Revision', rev._id);
      } else {
        const revId = new mongoose.Types.ObjectId().toString();
        memRevisions.set(revId, {
          _id: revId,
          userId: req.user.id,
          projectId: parsed.data.projectId || null,
          mode: 'humanize',
          originalText: parsed.data.text,
          revisedText: result.revisedText,
          summary: result.changeSummary,
          createdAt: new Date().toISOString()
        });
      }
    }
    res.json({ ...result, saved });
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
      projectId: z.string().optional(),
      persistenceConsent: z.boolean().optional()
    });
    const p = schema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'Document title is required.' });

    if (isDbConnected()) {
      const doc = await Document.create({
        ownerId: req.user.id,
        projectId: mongoose.isValidObjectId(p.data.projectId) ? p.data.projectId : null,
        title: p.data.title,
        persistenceConsent: p.data.persistenceConsent !== false
      });
      await recordAudit(req.user.id, 'DOCUMENT_CREATED', 'Document', doc._id);
      return res.status(201).json(doc);
    }

    const docId = new mongoose.Types.ObjectId().toString();
    const newDoc = {
      _id: docId,
      ownerId: req.user.id,
      projectId: p.data.projectId || null,
      title: p.data.title,
      persistenceConsent: p.data.persistenceConsent !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    memDocuments.set(docId, newDoc);
    res.status(201).json(newDoc);
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
    const revs = [...memRevisions.values()].filter(r => r.documentId === req.params.id && r.userId === req.user.id);
    res.json(revs);
  } catch (e) { next(e); }
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

// Integrity Reports (Section 6 & 7)
apiRouter.post('/reports', requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      reportType: z.enum(['writing', 'originality', 'citations', 'comprehensive']),
      documentId: z.string().optional(),
      findings: z.array(z.object({
        category: z.string(),
        severity: z.enum(['info', 'review', 'warning', 'critical']).default('review'),
        excerpt: z.string().optional(),
        explanation: z.string(),
        suggestedAction: z.string().optional(),
        sourceMetadata: z.any().optional()
      })),
      limitations: z.string().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid report data.' });

    if (isDbConnected()) {
      const report = await IntegrityReport.create({
        ownerId: req.user.id,
        documentId: mongoose.isValidObjectId(parsed.data.documentId) ? parsed.data.documentId : null,
        reportType: parsed.data.reportType,
        findings: parsed.data.findings,
        limitations: parsed.data.limitations || ''
      });
      return res.status(201).json(report);
    }

    const reportId = new mongoose.Types.ObjectId().toString();
    const rep = {
      _id: reportId,
      ownerId: req.user.id,
      documentId: parsed.data.documentId || null,
      reportType: parsed.data.reportType,
      findings: parsed.data.findings,
      limitations: parsed.data.limitations || '',
      createdAt: new Date().toISOString()
    };
    res.status(201).json(rep);
  } catch (e) { next(e); }
});

apiRouter.get('/reports/:id', requireAuth, async (req, res, next) => {
  try {
    if (isDbConnected()) {
      const report = await IntegrityReport.findOne({ _id: req.params.id, ownerId: req.user.id }).lean();
      if (!report) return res.status(404).json({ error: 'Report not found.' });
      return res.json(report);
    }
    res.status(404).json({ error: 'Report not found.' });
  } catch (e) { next(e); }
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
