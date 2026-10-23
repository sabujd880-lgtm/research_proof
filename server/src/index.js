import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { z } from 'zod';
import { User, Project, Document, Revision, IntegrityReport, AuditEvent } from './models.js';
import { requireAuth } from './middleware.js';
import { assessWriting, findRepeatedPhrases, checkCitations, humanizeWithAI } from './services.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET || 'researchproof-super-secure-jwt-secret-key-32chars';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24) {
  console.warn('WARNING: Set JWT_SECRET to a random secret of at least 24 characters in server/.env.');
}

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 250, standardHeaders: true, legacyHeaders: false }));

// Safe Audit Logging Helper (Section 6 & 10)
async function recordAudit(actorId, action, resourceType, resourceId = '', metadata = {}) {
  try {
    if (mongoose.connection.readyState === 1) {
      await AuditEvent.create({
        actorId,
        action,
        resourceType,
        resourceId: String(resourceId),
        metadata
      });
    }
  } catch (err) {
    // Non-blocking audit failure
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
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Auth Routes
apiRouter.post('/auth/register', async (req, res, next) => {
  try {
    const parsed = authSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and a password of at least 10 characters.' });
    const email = parsed.data.email.toLowerCase();
    if (await User.findOne({ email })) return res.status(409).json({ error: 'An account with this email already exists.' });
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await User.create({ email, passwordHash });
    const token = jwt.sign({ id: user._id.toString(), email: user.email }, jwtSecret, { expiresIn: '8h' });
    await recordAudit(user._id, 'USER_REGISTERED', 'User', user._id);
    res.status(201).json({ token, user: { id: user._id, email: user.email } });
  } catch (e) { next(e); }
});

apiRouter.post('/auth/login', async (req, res, next) => {
  try {
    const parsed = authSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and password.' });
    const user = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const token = jwt.sign({ id: user._id.toString(), email: user.email }, jwtSecret, { expiresIn: '8h' });
    await recordAudit(user._id, 'USER_LOGIN', 'User', user._id);
    res.json({ token, user: { id: user._id, email: user.email } });
  } catch (e) { next(e); }
});

apiRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email } });
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

// AI Revision / Humanizer
apiRouter.post(['/humanize', '/revisions/humanize'], requireAuth, async (req, res, next) => {
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
      saved = true;
      await recordAudit(req.user.id, 'REVISION_CREATED', 'Revision', rev._id);
    }
    res.json({ ...result, saved });
  } catch (e) { next(e); }
});

// Projects
apiRouter.get('/projects', requireAuth, async (req, res, next) => {
  try {
    res.json(await Project.find({ userId: req.user.id }).sort({ updatedAt: -1 }).lean());
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
    const project = await Project.create({
      userId: req.user.id,
      title: p.data.title,
      description: p.data.description || '',
      discipline: p.data.discipline || 'General Academic',
      documentType: p.data.documentType || 'Manuscript'
    });
    await recordAudit(req.user.id, 'PROJECT_CREATED', 'Project', project._id);
    res.status(201).json(project);
  } catch (e) { next(e); }
});

apiRouter.get('/projects/:id', requireAuth, async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    const documents = await Document.find({ projectId: project._id, ownerId: req.user.id }).sort({ updatedAt: -1 }).lean();
    res.json({ ...project, documents });
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
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: p.data },
      { new: true }
    );
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    res.json(project);
  } catch (e) { next(e); }
});

apiRouter.delete('/projects/:id', requireAuth, async (req, res, next) => {
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    await Revision.deleteMany({ projectId: project._id, userId: req.user.id });
    await Document.deleteMany({ projectId: project._id, ownerId: req.user.id });
    await recordAudit(req.user.id, 'PROJECT_DELETED', 'Project', req.params.id);
    res.json({ deleted: true });
  } catch (e) { next(e); }
});

// Documents (Section 6 & 7)
apiRouter.get('/documents', requireAuth, async (req, res, next) => {
  try {
    const filter = { ownerId: req.user.id };
    if (req.query.projectId) filter.projectId = req.query.projectId;
    res.json(await Document.find(filter).sort({ updatedAt: -1 }).lean());
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
    const doc = await Document.create({
      ownerId: req.user.id,
      projectId: mongoose.isValidObjectId(p.data.projectId) ? p.data.projectId : null,
      title: p.data.title,
      persistenceConsent: p.data.persistenceConsent !== false
    });
    await recordAudit(req.user.id, 'DOCUMENT_CREATED', 'Document', doc._id);
    res.status(201).json(doc);
  } catch (e) { next(e); }
});

apiRouter.get('/documents/:id/revisions', requireAuth, async (req, res, next) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, ownerId: req.user.id });
    if (!doc) return res.status(404).json({ error: 'Document not found.' });
    const revisions = await Revision.find({ documentId: doc._id, userId: req.user.id }).sort({ createdAt: -1 }).lean();
    res.json(revisions);
  } catch (e) { next(e); }
});

// Revisions
apiRouter.get('/revisions', requireAuth, async (req, res, next) => {
  try {
    const revisions = await Revision.find({ userId: req.user.id })
      .select('mode summary createdAt projectId documentId originalText revisedText')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(revisions);
  } catch (e) { next(e); }
});

apiRouter.delete('/revisions/:id', requireAuth, async (req, res, next) => {
  try {
    const item = await Revision.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!item) return res.status(404).json({ error: 'Revision not found.' });
    await recordAudit(req.user.id, 'REVISION_DELETED', 'Revision', req.params.id);
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
    const report = await IntegrityReport.create({
      ownerId: req.user.id,
      documentId: mongoose.isValidObjectId(parsed.data.documentId) ? parsed.data.documentId : null,
      reportType: parsed.data.reportType,
      findings: parsed.data.findings,
      limitations: parsed.data.limitations || ''
    });
    res.status(201).json(report);
  } catch (e) { next(e); }
});

apiRouter.get('/reports/:id', requireAuth, async (req, res, next) => {
  try {
    const report = await IntegrityReport.findOne({ _id: req.params.id, ownerId: req.user.id }).lean();
    if (!report) return res.status(404).json({ error: 'Report not found.' });
    res.json(report);
  } catch (e) { next(e); }
});

// Mount router on both /api and /api/v1
app.use('/api/v1', apiRouter);
app.use('/api', apiRouter);

// Global Error Handler
app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Unexpected server error.' });
});

// Start Express server and establish DB connection with timeout
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/researchproof_ai';

app.listen(port, () => {
  console.log(`ResearchProof API listening on http://localhost:${port}`);
  console.log(`Endpoints available at /api and /api/v1`);
});

mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log(`Connected to MongoDB successfully at ${mongoUri.split('@').pop()}`);
  })
  .catch((err) => {
    console.warn(`[Notice] MongoDB connection attempt failed: ${err.message}`);
    console.warn(`The server is active. To enable account storage, ensure MongoDB is running or configure MONGODB_URI in server/.env.`);
  });
