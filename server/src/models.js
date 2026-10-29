import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, default: null }, // Optional for Google-only users
  googleId: { type: String, default: null },
  displayName: { type: String, default: '' },
  avatarUrl: { type: String, default: '' },
  authProviders: [{ type: String, enum: ['email', 'google'], default: 'email' }],
  emailVerified: { type: Boolean, default: true },
  role: { type: String, enum: ['researcher', 'reviewer', 'admin'], default: 'researcher' },
  status: { type: String, enum: ['active', 'suspended', 'pending', 'deleted'], default: 'active' },
  tokenVersion: { type: Number, default: 1 }, // Used for database-backed server-side session revocation
  lastLoginAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now },
  deletionStatus: { type: String, enum: ['none', 'pending', 'completed'], default: 'none' },
  privacySettings: {
    persistDocumentText: { type: Boolean, default: true },
    allowAiProcessing: { type: Boolean, default: true }
  },
  preferences: {
    theme: { type: String, default: 'dark' },
    compactSidebar: { type: Boolean, default: false },
    defaultCitationStyle: { type: String, default: 'apa' },
    defaultRewriteMode: { type: String, default: 'academic-clarity' },
    meaningPreservationStrictness: { type: String, default: 'high' }
  },
  usage: {
    dailyRequests: { type: Number, default: 0 },
    dailyLimit: { type: mongoose.Schema.Types.Mixed, default: 50 },
    lastResetDate: { type: Date, default: Date.now }
  }
}, { timestamps: true });

userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1, status: 1 });
userSchema.index({ lastActiveAt: -1 });

// Section 6: Free Usage Limit Collection
const usageRecordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  feature: { type: String, enum: ['rewrite', 'analysis'], required: true },
  quotaWindow: { type: String, required: true }, // UTC 'YYYY-MM-DD'
  usedCount: { type: Number, default: 0, min: 0 },
  reservedCount: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

usageRecordSchema.index({ userId: 1, feature: 1, quotaWindow: 1 }, { unique: true });

const projectSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, default: '', maxlength: 1000 },
  discipline: { type: String, default: 'General Academic', maxlength: 100 },
  documentType: { type: String, default: 'Manuscript', maxlength: 80 }
}, { timestamps: true });
projectSchema.index({ userId: 1, updatedAt: -1 });

const documentSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  content: { type: String, default: '' },
  version: { type: Number, default: 1 }, // Optimistic concurrency control
  wordCount: { type: Number, default: 0 },
  characterCount: { type: Number, default: 0 },
  currentRevisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Revision', default: null },
  persistenceConsent: { type: Boolean, default: true }
}, { timestamps: true });
documentSchema.index({ ownerId: 1, updatedAt: -1 });
documentSchema.index({ projectId: 1, updatedAt: -1 });

const revisionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null, index: true },
  parentRevisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Revision', default: null },
  revisionNumber: { type: Number, default: 1 },
  mode: { type: String, required: true },
  originalText: { type: String, default: '' },
  revisedText: { type: String, default: '' },
  proposedText: { type: String, default: '' },
  acceptedText: { type: String, default: '' },
  summary: { type: String, default: '' },
  meaningWarnings: [{
    category: { type: String, required: true },
    severity: { type: String, enum: ['critical', 'warning', 'info'], default: 'warning' },
    detail: { type: String, required: true },
    originalValue: { type: String, default: '' },
    revisedValue: { type: String, default: '' },
    excerpt: { type: String, default: '' }
  }],
  status: { type: String, enum: ['proposed', 'accepted', 'rejected', 'restored'], default: 'proposed' },
  acceptedAt: { type: Date, default: null },
  modelProvider: { type: String, default: 'openai-compatible' },
  modelName: { type: String, default: '' }
}, { timestamps: true });
revisionSchema.index({ userId: 1, createdAt: -1 });
revisionSchema.index({ documentId: 1, createdAt: -1 });

const citationSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null, index: true },
  doi: { type: String, default: '', trim: true },
  title: { type: String, required: true, trim: true },
  authors: [{
    given: { type: String, default: '' },
    family: { type: String, default: '' },
    name: { type: String, default: '' }
  }],
  year: { type: String, default: '' },
  journal: { type: String, default: '' },
  volume: { type: String, default: '' },
  issue: { type: String, default: '' },
  pages: { type: String, default: '' },
  publisher: { type: String, default: '' },
  metadataSource: { type: String, default: 'crossref' },
  verificationStatus: { type: String, enum: ['verified', 'unverified', 'manual'], default: 'verified' },
  rawMetadata: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });
citationSchema.index({ ownerId: 1, updatedAt: -1 });
citationSchema.index({ ownerId: 1, doi: 1 });

const doiCacheSchema = new mongoose.Schema({
  doi: { type: String, required: true, unique: true, lowercase: true, trim: true },
  metadata: { type: mongoose.Schema.Types.Mixed, required: true },
  cachedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 }
}, { timestamps: true });

const integrityReportSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null, index: true },
  revisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Revision', default: null },
  title: { type: String, default: 'Research Integrity Report', trim: true },
  reportType: { type: String, enum: ['writing', 'originality', 'citations', 'comprehensive'], default: 'comprehensive' },
  analysisVersion: { type: String, default: '3.0.0' },
  checksPerformed: [{ type: String }],
  checksSkipped: [{ type: String }],
  reviewStatus: { type: String, enum: ['completed', 'partial', 'failed'], default: 'completed' },
  summaryMetrics: {
    wordCount: { type: Number, default: 0 },
    highPriorityCount: { type: Number, default: 0 },
    reviewRecommendedCount: { type: Number, default: 0 },
    informationalCount: { type: Number, default: 0 },
    totalFindings: { type: Number, default: 0 }
  },
  findings: [{
    category: { type: String, required: true },
    severity: { type: String, enum: ['informational', 'review_recommended', 'high_priority_review', 'info', 'review', 'warning', 'critical'], default: 'review_recommended' },
    excerpt: { type: String, default: '' },
    explanation: { type: String, required: true },
    suggestedAction: { type: String, default: '' },
    evidenceLocation: { type: String, default: '' },
    sourceMetadata: { type: mongoose.Schema.Types.Mixed, default: null }
  }],
  limitations: { type: String, default: 'Integrity reports utilize transparent statistical and stylistic heuristics. They do not constitute definitive proof of scientific misconduct or AI authorship.' }
}, { timestamps: true });
integrityReportSchema.index({ ownerId: 1, createdAt: -1 });

const auditEventSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  action: { type: String, required: true, index: true },
  resourceType: { type: String, required: true },
  resourceId: { type: String, default: '' },
  result: { type: String, enum: ['success', 'failure'], default: 'success' },
  reason: { type: String, default: '' },
  requestId: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: { createdAt: true, updatedAt: false } });
auditEventSchema.index({ actorId: 1, createdAt: -1 });
auditEventSchema.index({ action: 1, createdAt: -1 });

// Phase 3: Analytics Events (Bounded Retention with TTL)
const usageEventSchema = new mongoose.Schema({
  eventType: { type: String, required: true, index: true },
  feature: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  durationMs: { type: Number, default: 0 },
  success: { type: Boolean, default: true, index: true },
  errorCategory: { type: String, default: null },
  provider: { type: String, default: null },
  tokenCount: { type: Number, default: 0 },
  requestId: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 } // 90 days TTL default
}, { timestamps: true });
usageEventSchema.index({ timestamp: -1 });
usageEventSchema.index({ feature: 1, timestamp: -1 });

// Phase 3: Fast Daily Aggregation Store
const dailyUsageAggregateSchema = new mongoose.Schema({
  date: { type: String, required: true, index: true }, // 'YYYY-MM-DD'
  feature: { type: String, required: true, index: true },
  requestCount: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  failureCount: { type: Number, default: 0 }
}, { timestamps: true });
dailyUsageAggregateSchema.index({ date: 1, feature: 1 }, { unique: true });

// Phase 3: Data Deletion Job Tracker
const dataDeletionJobSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending', index: true },
  requestedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
  failureCategory: { type: String, default: null },
  deletedCounts: {
    documents: { type: Number, default: 0 },
    revisions: { type: Number, default: 0 },
    citations: { type: Number, default: 0 },
    projects: { type: Number, default: 0 },
    integrityReports: { type: Number, default: 0 }
  }
}, { timestamps: true });

// Phase 5: APA 7 LaTeX Conversion Job Tracker
const latexJobSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sourceDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
  template: { type: String, enum: ['apa7'], default: 'apa7', required: true },
  variant: { type: String, enum: ['student', 'professional', 'thesis', 'dissertation', 'custom'], default: 'student', required: true },
  metadata: {
    title: { type: String, required: true, trim: true },
    authors: [{
      name: { type: String, default: '' },
      affiliation: { type: String, default: '' },
      orcid: { type: String, default: '' }
    }],
    affiliations: [{ type: String, default: '' }],
    abstract: { type: String, default: '' },
    keywords: [{ type: String, default: '' }],
    course: { type: String, default: '' },
    instructor: { type: String, default: '' },
    dueDate: { type: String, default: '' },
    runningHead: { type: String, default: '' },
    authorNote: { type: String, default: '' },
    correspondingAuthor: { type: String, default: '' }
  },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'completed', index: true },
  compilationStatus: { type: String, enum: ['compiled', 'unavailable', 'failed', 'skipped'], default: 'unavailable' },
  warnings: [{
    category: { type: String, required: true },
    severity: { type: String, enum: ['warning', 'info', 'error'], default: 'warning' },
    message: { type: String, required: true },
    detail: { type: String, default: '' }
  }],
  artifactReferences: {
    zipSize: { type: Number, default: 0 },
    pdfSize: { type: Number, default: 0 },
    texFilesCount: { type: Number, default: 0 },
    referencesCount: { type: Number, default: 0 },
    figuresCount: { type: Number, default: 0 },
    tablesCount: { type: Number, default: 0 }
  },
  mainTexSnippet: { type: String, default: '' },
  mainTex: { type: String, default: '' },
  standaloneMainTex: { type: String, default: '' },
  modularMainTex: { type: String, default: '' },
  bibContent: { type: String, default: '' },
  sections: { type: Array, default: [] },
  report: { type: mongoose.Schema.Types.Mixed, default: {} },
  expirationTimestamp: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
}, { timestamps: true });
latexJobSchema.index({ userId: 1, createdAt: -1 });

// Phase 6: TextGuard Plagiarism & Authenticity Scan Tracker
const textGuardScanSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
  documentTitle: { type: String, default: 'Untitled Document' },
  analyzedWordCount: { type: Number, default: 0 },
  similarityCoverage: { type: Number, default: 0 },
  unmatchedCoverage: { type: Number, default: 100 },
  matchedPassageCount: { type: Number, default: 0 },
  distinctSourceCount: { type: Number, default: 0 },
  doiVerification: {
    total: { type: Number, default: 0 },
    verified: { type: Number, default: 0 },
    partial: { type: Number, default: 0 },
    notFound: { type: Number, default: 0 },
    retracted: { type: Number, default: 0 },
    references: { type: Array, default: [] }
  },
  matches: { type: Array, default: [] },
  passages: { type: Array, default: [] },
  matchedSources: { type: Array, default: [] },
  sha256: { type: String, default: '' },
  status: { type: String, enum: ['completed', 'failed', 'bot_blocked'], default: 'completed', index: true },
  statusMessage: { type: String, default: '' },
  comparisonCorpus: { type: Array, default: [] },
  exclusions: {
    excludeQuotes: { type: Boolean, default: false },
    excludeBibliography: { type: Boolean, default: false }
  },
  meaningValidation: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });
textGuardScanSchema.index({ userId: 1, createdAt: -1 });

export const User = mongoose.model('User', userSchema);
export const Project = mongoose.model('Project', projectSchema);
export const Document = mongoose.model('Document', documentSchema);
export const Revision = mongoose.model('Revision', revisionSchema);
export const IntegrityReport = mongoose.model('IntegrityReport', integrityReportSchema);
export const AuditEvent = mongoose.model('AuditEvent', auditEventSchema);
export const UsageRecord = mongoose.model('UsageRecord', usageRecordSchema);
export const Citation = mongoose.model('Citation', citationSchema);
export const DoiCache = mongoose.model('DoiCache', doiCacheSchema);
export const UsageEvent = mongoose.model('UsageEvent', usageEventSchema);
export const DailyUsageAggregate = mongoose.model('DailyUsageAggregate', dailyUsageAggregateSchema);
export const DataDeletionJob = mongoose.model('DataDeletionJob', dataDeletionJobSchema);
export const LatexJob = mongoose.model('LatexJob', latexJobSchema);
export const TextGuardScan = mongoose.model('TextGuardScan', textGuardScanSchema);



