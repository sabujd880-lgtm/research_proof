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
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: function() { return this.userId; }, index: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, default: '', maxlength: 1000 },
  discipline: { type: String, default: 'General Academic', maxlength: 100 },
  documentType: { type: String, default: 'Manuscript', maxlength: 80 },
  researchType: { type: String, enum: ['Quantitative', 'Qualitative', 'Mixed Methods', 'Experimental', 'Systematic Review', 'Literature Review', 'Meta-Analysis', 'Observational', 'Computational', 'Theoretical', 'Other'], default: 'Quantitative' },
  objectives: { type: mongoose.Schema.Types.Mixed, default: [] },
  keywords: [{ type: String, trim: true }],
  status: { type: String, enum: ['draft', 'active', 'on_hold', 'completed', 'archived', 'deleted', 'Draft', 'Active', 'On Hold', 'Completed', 'Archived'], default: 'active', index: true },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  workflowStage: { type: String, enum: ['literature', 'analysis', 'drafting', 'review', 'submission'], default: 'literature', index: true },
  completionPercentage: { type: Number, default: 0, min: 0, max: 100 },
  startDate: { type: Date, default: null },
  targetDate: { type: Date, default: null },
  visibility: { type: String, enum: ['private', 'team', 'public'], default: 'private' },
  archivedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
  tags: [{ type: String, trim: true }]
}, { timestamps: true });
projectSchema.index({ userId: 1, updatedAt: -1 });
projectSchema.index({ userId: 1, status: 1 });
projectSchema.index({ discipline: 1 });

const projectMemberSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ['owner', 'editor', 'reviewer', 'viewer'], default: 'editor' },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status: { type: String, enum: ['active', 'invited', 'declined'], default: 'active', index: true },
  permissions: [{ type: String }]
}, { timestamps: true });
projectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });

const taskSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, default: '', maxlength: 2000 },
  status: { type: String, enum: ['todo', 'in_progress', 'review', 'done'], default: 'todo', index: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  stage: { type: String, enum: ['literature', 'analysis', 'drafting', 'review', 'submission', 'general'], default: 'general' },
  dueDate: { type: Date, default: null }
}, { timestamps: true });
taskSchema.index({ projectId: 1, status: 1 });

const documentVersionSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
  versionNumber: { type: Number, required: true },
  title: { type: String, required: true },
  content: { type: String, default: '' },
  wordCount: { type: Number, default: 0 },
  snapshotBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String, default: '' }
}, { timestamps: true });
documentVersionSchema.index({ documentId: 1, versionNumber: -1 });

// Literature Review Studio Models (Phase 5)
const literatureEntrySchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Citation', default: null, index: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
  title: { type: String, required: true, trim: true },
  authors: [{ type: String, trim: true }],
  year: { type: String, default: '' },
  journal: { type: String, default: '' },
  doi: { type: String, default: '', trim: true },
  normalizedDoi: { type: String, default: '', trim: true },
  url: { type: String, default: '' },
  abstract: { type: String, default: '' },

  // Structured Evidence Fields
  researchQuestion: { type: String, default: '' },
  studyObjectives: { type: String, default: '' },
  studyDesign: { type: String, default: 'Observational' },
  methodology: { type: String, default: '' },
  population: { type: String, default: '' },
  sampleSize: { type: String, default: '' },
  samplingMethod: { type: String, default: '' },
  participantCharacteristics: { type: String, default: '' },
  geographicSetting: { type: String, default: '' },
  measures: { type: String, default: '' },
  variables: { type: String, default: '' },
  interventionOrExposure: { type: String, default: '' },
  comparisonGroup: { type: String, default: '' },
  statisticalMethods: { type: String, default: '' },
  keyFindings: { type: String, default: '' },
  effectEstimates: { type: String, default: '' },
  limitations: { type: String, default: '' },
  futureDirections: { type: String, default: '' },
  qualityNotes: { type: String, default: '' },

  // Matrix data overrides / quick access
  matrixData: {
    country: { type: String, default: '' },
    methodology: { type: String, default: '' },
    sampleSize: { type: String, default: '' },
    instruments: { type: String, default: '' },
    findings: { type: String, default: '' },
    limitations: { type: String, default: '' },
    gapNotes: { type: String, default: '' }
  },

  thematicTags: [{ type: String, trim: true }],
  keywords: [{ type: String, trim: true }],
  tags: [{ type: String, trim: true }],

  extractionStatus: {
    type: String,
    enum: ['unextracted', 'extracting', 'extracted', 'reviewed', 'verified'],
    default: 'unextracted',
    index: true
  },
  status: {
    type: String,
    enum: ['identified', 'screened', 'included', 'excluded'],
    default: 'identified',
    index: true
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deletedAt: { type: Date, default: null, index: true }
}, { timestamps: true });
literatureEntrySchema.index({ projectId: 1, deletedAt: 1, createdAt: -1 });

const evidenceExtractSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  literatureEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'LiteratureEntry', required: true, index: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
  pageNumber: { type: Number, default: null },
  section: { type: String, default: 'Abstract' },
  sourceText: { type: String, required: true },
  extractedField: { type: String, required: true },
  extractedValue: { type: String, required: true },
  extractionMethod: { type: String, enum: ['automatic', 'manual'], default: 'automatic' },
  confidenceOrReviewStatus: { type: String, enum: ['pending_review', 'verified', 'rejected'], default: 'pending_review' },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verifiedAt: { type: Date, default: null }
}, { timestamps: true });
evidenceExtractSchema.index({ literatureEntryId: 1, extractedField: 1 });

const literatureMatrixSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, default: 'Default Literature Matrix' },
  description: { type: String, default: '' },
  columns: [{
    key: { type: String, required: true },
    label: { type: String, required: true },
    visible: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    width: { type: Number, default: 150 },
    type: { type: String, default: 'text' }
  }],
  sortConfig: {
    key: { type: String, default: 'year' },
    order: { type: String, enum: ['asc', 'desc'], default: 'desc' }
  },
  savedFilters: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

const literatureThemeSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  color: { type: String, default: '#5e6ad2' },
  studyIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LiteratureEntry' }],
  notes: { type: String, default: '' },
  summary: { type: String, default: '' }
}, { timestamps: true });

const studyComparisonSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, default: 'Comparative Study Matrix' },
  studyIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LiteratureEntry' }],
  dimensions: [{ type: String }],
  comparisonMatrix: { type: mongoose.Schema.Types.Mixed, default: {} },
  summary: { type: String, default: '' }
}, { timestamps: true });

const researchGapCandidateSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  category: {
    type: String,
    enum: [
      'population',
      'methodological',
      'measurement',
      'geographic',
      'theoretical',
      'inconsistent_findings',
      'understudied_variables',
      'longitudinal'
    ],
    default: 'methodological'
  },
  supportingStudyIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LiteratureEntry' }],
  contradictoryStudyIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LiteratureEntry' }],
  evidenceBasis: { type: String, default: '' },
  limitationsOfLiterature: { type: String, default: '' },
  suggestedResearchQuestions: [{ type: String, trim: true }],
  status: { type: String, enum: ['candidate', 'accepted', 'dismissed'], default: 'candidate' }
}, { timestamps: true });

const synthesisDraftSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, default: 'Literature Review Synthesis' },
  type: {
    type: String,
    enum: ['narrative', 'thematic', 'chronological', 'methodological', 'comparative'],
    default: 'thematic'
  },
  studyIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LiteratureEntry' }],
  themeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LiteratureTheme' }],
  sections: [{
    title: { type: String, required: true },
    theme: { type: String, default: '' },
    studyCount: { type: Number, default: 0 },
    synthesisText: { type: String, default: '' },
    citations: [{ type: String }]
  }],
  fullDraft: { type: String, default: '' },
  evidenceLinks: [{
    claimText: { type: String },
    evidenceExtractId: { type: mongoose.Schema.Types.ObjectId, ref: 'EvidenceExtract' },
    studyId: { type: mongoose.Schema.Types.ObjectId, ref: 'LiteratureEntry' }
  }],
  version: { type: Number, default: 1 },
  versions: [{
    versionNumber: { type: Number },
    fullDraft: { type: String },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Dataset and Analysis Models (Statistical Analysis Studio - Phase 7 Extended)
const datasetSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  fileName: { type: String, default: '' },
  originalFilename: { type: String, default: '' },
  fileType: { type: String, default: 'csv' },
  checksum: { type: String, default: '' },
  rowCount: { type: Number, default: 0 },
  columnCount: { type: Number, default: 0 },
  missingValueCount: { type: Number, default: 0 },
  status: { type: String, default: 'ready' },
  currentVersionNumber: { type: Number, default: 1 },
  columns: [{
    name: { type: String, required: true },
    type: { type: String, enum: ['numeric', 'categorical', 'date', 'text', 'boolean'], default: 'numeric' },
    measurementLevel: { type: String, enum: ['nominal', 'ordinal', 'scale'], default: 'scale' },
    sampleValues: [{ type: mongoose.Schema.Types.Mixed }]
  }],
  rawData: { type: mongoose.Schema.Types.Mixed, default: [] },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });
datasetSchema.index({ projectId: 1, createdAt: -1 });

const datasetVersionSchema = new mongoose.Schema({
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  versionNumber: { type: Number, required: true },
  transformationSummary: { type: String, default: 'Initial import' },
  rowCount: { type: Number, default: 0 },
  columnCount: { type: Number, default: 0 },
  checksum: { type: String, default: '' },
  rawData: { type: mongoose.Schema.Types.Mixed, default: [] }
}, { timestamps: true });

const datasetVariableSchema = new mongoose.Schema({
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
  name: { type: String, required: true },
  label: { type: String, default: '' },
  dataType: { type: String, enum: ['numeric', 'categorical', 'date', 'text', 'boolean'], default: 'numeric' },
  measurementLevel: { type: String, enum: ['nominal', 'ordinal', 'scale'], default: 'scale' },
  missingValueCodes: [{ type: String }],
  valueLabels: { type: mongoose.Schema.Types.Mixed, default: {} },
  role: { type: String, enum: ['independent', 'dependent', 'covariate', 'id', 'none'], default: 'none' },
  summaryStats: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

const analysisSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  datasetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true, index: true },
  datasetVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DatasetVersion' },
  title: { type: String, default: 'Statistical Analysis' },
  analysisType: {
    type: String,
    required: true
  },
  variables: { type: mongoose.Schema.Types.Mixed, default: {} },
  parameters: { type: mongoose.Schema.Types.Mixed, default: {} },
  missingDataPolicy: { type: String, default: 'listwise_deletion' },
  status: { type: String, default: 'completed' },
  results: { type: mongoose.Schema.Types.Mixed, default: {} },
  apaReport: { type: String, default: '' },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });
analysisSchema.index({ projectId: 1, datasetId: 1, createdAt: -1 });

const analysisResultSchema = new mongoose.Schema({
  analysisId: { type: mongoose.Schema.Types.ObjectId, ref: 'Analysis', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  numericalResults: { type: mongoose.Schema.Types.Mixed, default: {} },
  assumptions: { type: mongoose.Schema.Types.Mixed, default: {} },
  effectSizes: { type: mongoose.Schema.Types.Mixed, default: {} },
  confidenceIntervals: { type: mongoose.Schema.Types.Mixed, default: {} },
  diagnostics: { type: mongoose.Schema.Types.Mixed, default: {} },
  warnings: [{ type: String }],
  apa7Narrative: { type: String, default: '' },
  softwareVersions: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

const analysisJobSchema = new mongoose.Schema({
  analysisId: { type: mongoose.Schema.Types.ObjectId, ref: 'Analysis', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued' },
  progress: { type: Number, default: 0 },
  error: { type: String, default: null }
}, { timestamps: true });

// PDF Research Chat Model (Phase 6 Extended)
const researchChatSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  title: { type: String, default: 'PDF Research Conversation' },
  documentName: { type: String, default: '' },
  selectedDocumentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ResearchDocument' }],
  mode: { type: String, default: 'general' },
  documentChunks: [{
    pageNumber: { type: Number, required: true },
    content: { type: String, required: true },
    documentId: { type: String, default: '' },
    documentTitle: { type: String, default: '' }
  }],
  messages: [{
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    citations: [{
      documentId: { type: String, default: '' },
      documentTitle: { type: String, default: '' },
      page: { type: Number },
      passage: { type: String },
      score: { type: Number },
      evidenceId: { type: String, default: '' }
    }],
    retrievalStatus: { type: String, default: 'grounded' },
    modelMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now }
  }],
  deletedAt: { type: Date, default: null }
}, { timestamps: true });
researchChatSchema.index({ projectId: 1, updatedAt: -1 });

// Phase 6: PDF Research Document & RAG Models
const researchDocumentSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Citation', default: null },
  filename: { type: String, required: true },
  originalFilename: { type: String, required: true },
  mimeType: { type: String, default: 'application/pdf' },
  fileSize: { type: Number, default: 0 },
  storageKey: { type: String, required: true },
  storagePath: { type: String, default: '' },
  checksum: { type: String, default: '' },
  pageCount: { type: Number, default: 1 },
  extractionStatus: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending', index: true },
  indexingStatus: { type: String, enum: ['pending', 'indexing', 'indexed', 'failed'], default: 'pending', index: true },
  language: { type: String, default: 'en' },
  title: { type: String, default: 'Untitled Document' },
  authors: [{ type: String }],
  year: { type: String, default: '' },
  journal: { type: String, default: '' },
  doi: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  deletedAt: { type: Date, default: null, index: true }
}, { timestamps: true });
researchDocumentSchema.index({ projectId: 1, deletedAt: 1, createdAt: -1 });

const documentChunkSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ResearchDocument', required: true, index: true },
  documentVersionId: { type: String, default: null },
  pageNumber: { type: Number, required: true },
  chunkIndex: { type: Number, required: true },
  text: { type: String, required: true },
  textHash: { type: String, default: '' },
  tokenCount: { type: Number, default: 0 },
  sectionHeading: { type: String, default: '' },
  extractionMethod: { type: String, default: 'pdf_stream' },
  boundingBoxes: { type: mongoose.Schema.Types.Mixed, default: null },
  embedding: { type: [Number], default: [] },
  embeddingModel: { type: String, default: 'text-embedding-004' },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });
documentChunkSchema.index({ documentId: 1, pageNumber: 1, chunkIndex: 1 });
documentChunkSchema.index({ projectId: 1, documentId: 1 });

const documentIndexSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ResearchDocument', required: true, index: true },
  termFrequencies: { type: mongoose.Schema.Types.Mixed, default: {} },
  totalTokens: { type: Number, default: 0 },
  uniqueTerms: { type: Number, default: 0 },
  indexedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const citationEvidenceSchema = new mongoose.Schema({
  messageId: { type: String, default: '' },
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'ResearchChat', default: null, index: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ResearchDocument', required: true, index: true },
  documentVersionId: { type: String, default: null },
  chunkId: { type: mongoose.Schema.Types.ObjectId, ref: 'DocumentChunk', default: null },
  pageNumber: { type: Number, required: true },
  sourceText: { type: String, required: true },
  boundingBoxes: { type: mongoose.Schema.Types.Mixed, default: null },
  verificationStatus: { type: String, enum: ['verified', 'unverified', 'rejected'], default: 'verified' }
}, { timestamps: true });

const documentProcessingJobSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ResearchDocument', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['queued', 'processing', 'completed', 'failed', 'cancelled'], default: 'queued', index: true },
  progress: { type: Number, default: 0 },
  stage: { type: String, default: 'extraction' },
  errorMessage: { type: String, default: '' },
  retries: { type: Number, default: 0 },
  startedAt: { type: Date },
  completedAt: { type: Date }
}, { timestamps: true });

// Systematic Review & Screening Models (PRISMA 2020 & Phase 8 Assistant)
const systematicReviewSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  title: { type: String, required: true, trim: true },
  reviewType: {
    type: String,
    enum: ['systematic_review', 'scoping_review', 'rapid_review', 'meta_analysis_linked'],
    default: 'systematic_review',
    index: true
  },
  researchQuestion: { type: String, default: '' },
  objective: { type: String, default: '' },
  protocolId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReviewProtocol' },
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'archived'],
    default: 'active',
    index: true
  },
  currentStage: {
    type: String,
    enum: [
      'protocol',
      'search',
      'deduplication',
      'title_abstract_screening',
      'full_text_screening',
      'data_extraction',
      'risk_of_bias',
      'prisma_synthesis'
    ],
    default: 'protocol',
    index: true
  },
  registrationIdentifier: { type: String, default: '' }, // e.g. PROSPERO CRD42023...
  registrationURL: { type: String, default: '' },
  screeningSettings: {
    dualReview: { type: Boolean, default: false },
    blindReview: { type: Boolean, default: false },
    requireExclusionReason: { type: Boolean, default: true }
  },
  protocol: {
    population: { type: String, default: '' },
    intervention: { type: String, default: '' },
    comparison: { type: String, default: '' },
    outcomes: { type: String, default: '' },
    studyDesign: { type: String, default: '' }
  },
  eligibility: {
    inclusionCriteria: [{ type: String }],
    exclusionCriteria: [{ type: String }]
  },
  prismaMetrics: {
    identified: { type: Number, default: 0 },
    identifiedDatabases: { type: Number, default: 0 },
    identifiedRegisters: { type: Number, default: 0 },
    identifiedOther: { type: Number, default: 0 },
    duplicatesRemoved: { type: Number, default: 0 },
    ineligibleBeforeScreening: { type: Number, default: 0 },
    screenedTitleAbstract: { type: Number, default: 0 },
    excludedTitleAbstract: { type: Number, default: 0 },
    soughtFullText: { type: Number, default: 0 },
    notRetrievedFullText: { type: Number, default: 0 },
    assessedFullText: { type: Number, default: 0 },
    excludedFullText: { type: Number, default: 0 },
    includedInSynthesis: { type: Number, default: 0 },
    includedStudies: { type: Number, default: 0 },
    includedReports: { type: Number, default: 0 }
  },
  searchQueries: [{
    database: { type: String, default: 'PubMed' },
    queryString: { type: String, default: '' },
    dateRun: { type: Date, default: Date.now },
    recordsCount: { type: Number, default: 0 }
  }],
  deletedAt: { type: Date, default: null, index: true }
}, { timestamps: true });
systematicReviewSchema.index({ projectId: 1, createdAt: -1 });

const reviewProtocolSchema = new mongoose.Schema({
  reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'SystematicReview', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  versionNumber: { type: Number, default: 1 },
  framework: { type: String, enum: ['PICO', 'PICOS', 'PECO', 'SPIDER', 'Custom'], default: 'PICO' },
  population: { type: String, default: '' },
  intervention: { type: String, default: '' },
  comparator: { type: String, default: '' },
  outcomes: { type: String, default: '' },
  studyDesigns: [{ type: String }],
  eligibilityCriteria: {
    inclusion: [{ type: String }],
    exclusion: [{ type: String }]
  },
  informationSources: [{
    database: { type: String, default: 'PubMed' },
    notes: { type: String, default: '' }
  }],
  searchStrategyText: { type: String, default: '' },
  screeningProcedure: { type: String, default: 'Two reviewers independently screen titles and abstracts.' },
  dataExtractionPlan: { type: String, default: '' },
  riskOfBiasPlan: { type: String, default: 'RoB 2 for randomized trials; ROBINS-I for non-randomized studies.' },
  synthesisPlan: { type: String, default: '' },
  registrationDetails: { type: String, default: '' },
  amendments: [{
    version: { type: Number },
    rationale: { type: String },
    date: { type: Date, default: Date.now },
    author: { type: String, default: '' }
  }],
  approvedAt: { type: Date, default: null }
}, { timestamps: true });
reviewProtocolSchema.index({ reviewId: 1, versionNumber: -1 });

const searchStrategySchema = new mongoose.Schema({
  reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'SystematicReview', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  sourceName: { type: String, required: true }, // e.g. 'PubMed', 'Crossref', 'OpenAlex', 'Scopus'
  sourceType: { type: String, enum: ['database', 'register', 'other_methods'], default: 'database' },
  queryString: { type: String, required: true },
  searchDate: { type: Date, default: Date.now },
  limits: { type: String, default: '' },
  filters: [{ type: String }],
  searcher: { type: String, default: '' },
  recordsRetrieved: { type: Number, default: 0 },
  exportSource: { type: String, default: '' },
  notes: { type: String, default: '' }
}, { timestamps: true });
searchStrategySchema.index({ reviewId: 1, createdAt: -1 });

const studyRecordSchema = new mongoose.Schema({
  reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'SystematicReview', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  searchRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'SearchStrategy' },
  title: { type: String, required: true, trim: true },
  authors: [{ type: String }],
  year: { type: String, default: '' },
  journal: { type: String, default: '' },
  doi: { type: String, default: '', index: true },
  pmid: { type: String, default: '', index: true },
  url: { type: String, default: '' },
  abstract: { type: String, default: '' },
  sourceDatabases: [{ type: String }], // provenance tracking
  sourceType: { type: String, enum: ['database', 'register', 'other_methods'], default: 'database' },
  deduplicationStatus: {
    type: String,
    enum: ['unique', 'canonical', 'duplicate'],
    default: 'unique',
    index: true
  },
  duplicateGroupId: { type: mongoose.Schema.Types.ObjectId, ref: 'DuplicateGroup' },
  canonicalRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyRecord' },
  screeningStage: {
    type: String,
    enum: ['title_abstract', 'full_text', 'included', 'excluded'],
    default: 'title_abstract',
    index: true
  },
  decision: {
    type: String,
    enum: ['included', 'excluded', 'pending', 'unclear'],
    default: 'pending',
    index: true
  },
  exclusionReason: { type: String, default: '' },
  exclusionNotes: { type: String, default: '' },
  screenerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  fullTextStatus: {
    type: String,
    enum: ['not_sought', 'sought', 'retrieved', 'not_retrieved', 'assessed', 'excluded'],
    default: 'not_sought'
  },
  pdfDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ResearchDocument' },
  pdfUrl: { type: String, default: '' },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });
studyRecordSchema.index({ reviewId: 1, decision: 1 });
studyRecordSchema.index({ reviewId: 1, screeningStage: 1 });

const duplicateGroupSchema = new mongoose.Schema({
  reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'SystematicReview', required: true, index: true },
  canonicalRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyRecord' },
  recordIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StudyRecord' }],
  matchType: { type: String, enum: ['exact', 'probable', 'possible'], default: 'exact' },
  similarityScore: { type: Number, default: 1.0 },
  resolved: { type: Boolean, default: false },
  resolutionDecision: { type: String, enum: ['merged', 'separated', 'retained'], default: 'merged' },
  resolverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: { type: Date }
}, { timestamps: true });

const screeningDecisionSchema = new mongoose.Schema({
  reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'SystematicReview', required: true, index: true },
  recordId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyRecord', required: true, index: true },
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reviewerName: { type: String, default: '' },
  stage: { type: String, enum: ['title_abstract', 'full_text'], required: true },
  decision: { type: String, enum: ['include', 'exclude', 'unclear'], required: true },
  exclusionReason: { type: String, default: '' },
  exclusionNotes: { type: String, default: '' },
  criteriaEvaluated: [{ type: String }],
  blind: { type: Boolean, default: false }
}, { timestamps: true });
screeningDecisionSchema.index({ reviewId: 1, recordId: 1, reviewerId: 1, stage: 1 });

const reviewConflictSchema = new mongoose.Schema({
  reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'SystematicReview', required: true, index: true },
  recordId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyRecord', required: true, index: true },
  stage: { type: String, enum: ['title_abstract', 'full_text'], required: true },
  reviewerDecisions: [{
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewerName: { type: String, default: '' },
    decision: { type: String },
    reason: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  status: { type: String, enum: ['pending', 'resolved'], default: 'pending', index: true },
  adjudicatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  adjudicatedDecision: { type: String, enum: ['include', 'exclude'] },
  adjudicatedReason: { type: String, default: '' },
  resolvedAt: { type: Date }
}, { timestamps: true });

const extractionTemplateSchema = new mongoose.Schema({
  reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'SystematicReview', required: true, index: true },
  name: { type: String, default: 'Standard Extraction Template' },
  fields: [{
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ['text', 'number', 'date', 'select', 'multi_select', 'boolean', 'evidence_link'], default: 'text' },
    options: [{ type: String }],
    required: { type: Boolean, default: false }
  }]
}, { timestamps: true });

const studyExtractionSchema = new mongoose.Schema({
  reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'SystematicReview', required: true, index: true },
  recordId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyRecord', required: true, index: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExtractionTemplate' },
  extractedData: { type: mongoose.Schema.Types.Mixed, default: {} },
  evidencePassages: [{
    field: { type: String },
    passage: { type: String },
    page: { type: Number, default: 1 }
  }],
  verified: { type: Boolean, default: false },
  verifierId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  version: { type: Number, default: 1 }
}, { timestamps: true });
studyExtractionSchema.index({ reviewId: 1, recordId: 1 });

const riskOfBiasAssessmentSchema = new mongoose.Schema({
  reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'SystematicReview', required: true, index: true },
  recordId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudyRecord', required: true, index: true },
  toolName: { type: String, enum: ['RoB 2', 'ROBINS-I', 'QUADAS-2', 'Custom'], default: 'RoB 2' },
  domains: [{
    domain: { type: String, required: true },
    judgment: { type: String, enum: ['low', 'some_concerns', 'high', 'critical', 'unclear'], default: 'low' },
    rationale: { type: String, default: '' },
    quotes: { type: String, default: '' }
  }],
  overallJudgment: { type: String, enum: ['low', 'some_concerns', 'high', 'critical', 'unclear'], default: 'low' },
  assessorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assessorName: { type: String, default: '' }
}, { timestamps: true });
riskOfBiasAssessmentSchema.index({ reviewId: 1, recordId: 1 });

const prismaFlowSnapshotSchema = new mongoose.Schema({
  reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'SystematicReview', required: true, index: true },
  variant: { type: String, enum: ['PRISMA_2020', 'PRISMA_ScR'], default: 'PRISMA_2020' },
  counts: { type: mongoose.Schema.Types.Mixed, required: true },
  isReconciled: { type: Boolean, default: true },
  reconciliationNotes: [{ type: String }],
  snapshotDate: { type: Date, default: Date.now }
}, { timestamps: true });

const reviewAuditEventSchema = new mongoose.Schema({
  reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'SystematicReview', required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  entityType: { type: String, default: 'SystematicReview' },
  entityId: { type: String, default: '' },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });
reviewAuditEventSchema.index({ reviewId: 1, createdAt: -1 });

// Journal Submission Model
const journalSubmissionSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetJournal: { type: String, required: true, trim: true },
  selectedJournalId: { type: String, default: '' },
  publisher: { type: String, default: '' },
  aimsAndScope: { type: String, default: '' },
  manuscriptTitle: { type: String, default: '' },
  manuscriptId: { type: String, default: '' },
  wordLimit: { type: Number, default: 8000 },
  citationStyle: { type: String, default: 'apa7' },
  guidelinesChecklist: [{
    item: { type: String, required: true },
    compliant: { type: Boolean, default: false },
    notes: { type: String, default: '' }
  }],
  coverLetter: { type: String, default: '' },
  submissionPackage: [{
    fileName: { type: String },
    fileType: { type: String },
    urlOrPath: { type: String }
  }],
  packageManifest: { type: mongoose.Schema.Types.Mixed, default: null },
  complianceReport: { type: mongoose.Schema.Types.Mixed, default: null },
  submissionDate: { type: Date, default: null },
  decisionDate: { type: Date, default: null },
  revisionDeadline: { type: Date, default: null },
  notes: { type: String, default: '' },
  events: [{
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    note: { type: String, default: '' },
    author: { type: String, default: '' }
  }],
  status: {
    type: String,
    enum: [
      'draft', 'drafting', 'ready_for_submission', 'submitted',
      'editorial_review', 'peer_review', 'under_review',
      'revision_requested', 'revised_submission', 'accepted',
      'rejected', 'withdrawn'
    ],
    default: 'draft',
    index: true
  }
}, { timestamps: true });
journalSubmissionSchema.index({ projectId: 1, createdAt: -1 });

// Phase 10: Research Collaboration Studio Schemas
const projectInvitationSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  role: { type: String, enum: ['owner', 'editor', 'reviewer', 'viewer'], default: 'editor' },
  inviterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'expired'], default: 'pending', index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });
projectInvitationSchema.index({ projectId: 1, email: 1 });

const documentCommentSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  selectedText: { type: String, default: '', trim: true },
  position: { type: mongoose.Schema.Types.Mixed, default: {} },
  content: { type: String, required: true, trim: true, maxlength: 4000 },
  resolved: { type: Boolean, default: false, index: true },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null },
  replies: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true, maxlength: 4000 },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });
documentCommentSchema.index({ documentId: 1, resolved: 1 });

const reviewRequestSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
  requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  versionNumber: { type: Number, default: 1 },
  status: {
    type: String,
    enum: ['draft', 'submitted_for_review', 'under_review', 'changes_requested', 'revised', 'approved', 'rejected'],
    default: 'submitted_for_review',
    index: true
  },
  decision: {
    type: String,
    enum: ['pending', 'accept', 'minor_revisions', 'major_revisions', 'reject'],
    default: 'pending'
  },
  decisionNotes: { type: String, default: '' },
  score: { type: Number, min: 0, max: 100, default: null },
  criteriaScores: {
    methodologicalRigor: { type: Number, min: 0, max: 10, default: null },
    academicClarity: { type: Number, min: 0, max: 10, default: null },
    citationEvidence: { type: Number, min: 0, max: 10, default: null },
    originality: { type: Number, min: 0, max: 10, default: null }
  },
  timeline: [{
    event: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, default: '' }
  }]
}, { timestamps: true });
reviewRequestSchema.index({ projectId: 1, status: 1 });

const collaborationNotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
  type: {
    type: String,
    enum: [
      'invitation_received', 'invitation_accepted', 'invitation_declined',
      'review_assigned', 'review_decision', 'review_submitted',
      'comment_added', 'comment_resolved',
      'task_assigned', 'task_status_changed'
    ],
    required: true,
    index: true
  },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  read: { type: Boolean, default: false, index: true },
  link: { type: String, default: '' }
}, { timestamps: true });
collaborationNotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

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

const authorSubSchema = new mongoose.Schema({
  given: { type: String, default: '' },
  family: { type: String, default: '' },
  name: { type: String, default: '' },
  givenName: { type: String, default: '' },
  familyName: { type: String, default: '' },
  literalName: { type: String, default: '' },
  orcid: { type: String, default: '', trim: true }
}, { _id: false });

const referenceCollectionSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, default: '', maxlength: 500 },
  color: { type: String, default: '#5e6ad2' },
  icon: { type: String, default: 'folder' }
}, { timestamps: true });
referenceCollectionSchema.index({ ownerId: 1, name: 1 });

const citationSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null, index: true },
  title: { type: String, required: true, trim: true },
  subtitle: { type: String, default: '', trim: true },
  authors: [authorSubSchema],
  editors: [authorSubSchema],
  publicationYear: { type: String, default: '' },
  publicationDate: { type: String, default: '' },
  year: { type: String, default: '' },
  publicationType: {
    type: String,
    enum: ['journal-article', 'book', 'book-chapter', 'proceedings-article', 'thesis', 'report', 'website', 'preprint', 'dataset', 'other'],
    default: 'journal-article'
  },
  journal: { type: String, default: '' },
  journalTitle: { type: String, default: '' },
  bookTitle: { type: String, default: '' },
  publisher: { type: String, default: '' },
  volume: { type: String, default: '' },
  issue: { type: String, default: '' },
  pages: { type: String, default: '' },
  articleNumber: { type: String, default: '' },
  doi: { type: String, default: '', trim: true },
  normalizedDoi: { type: String, default: '', trim: true, lowercase: true },
  isbn: { type: String, default: '', trim: true },
  issn: { type: String, default: '', trim: true },
  url: { type: String, default: '', trim: true },
  abstract: { type: String, default: '' },
  keywords: [{ type: String, trim: true }],
  language: { type: String, default: 'en' },
  citationKey: { type: String, default: '', trim: true },
  sourceProvider: { type: String, default: 'manual' },
  metadataSource: { type: String, default: 'manual' },
  metadataStatus: {
    type: String,
    enum: ['verified', 'partially_verified', 'unverified', 'lookup_failed'],
    default: 'unverified'
  },
  verificationStatus: { type: String, default: 'unverified' },
  metadataLastVerifiedAt: { type: Date, default: null },
  retractionStatus: {
    type: String,
    enum: ['clean', 'retracted', 'expression_of_concern', 'corrected', 'unknown'],
    default: 'unknown'
  },
  tags: [{ type: String, trim: true }],
  collectionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ReferenceCollection' }],
  isFavorite: { type: Boolean, default: false },
  notes: { type: String, default: '' },
  deletedAt: { type: Date, default: null },
  rawMetadata: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });

citationSchema.index({ ownerId: 1, deletedAt: 1, updatedAt: -1 });
citationSchema.index({ projectId: 1, deletedAt: 1 });
citationSchema.index({ ownerId: 1, doi: 1 });
citationSchema.index({ ownerId: 1, isFavorite: 1 });
citationSchema.index({ collectionIds: 1 });

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
export const ProjectMember = mongoose.model('ProjectMember', projectMemberSchema);
export const Task = mongoose.model('Task', taskSchema);
export const Document = mongoose.model('Document', documentSchema);
export const DocumentVersion = mongoose.model('DocumentVersion', documentVersionSchema);
export const Revision = mongoose.model('Revision', revisionSchema);
export const IntegrityReport = mongoose.model('IntegrityReport', integrityReportSchema);
export const AuditEvent = mongoose.model('AuditEvent', auditEventSchema);
export const UsageRecord = mongoose.model('UsageRecord', usageRecordSchema);
export const Citation = mongoose.model('Citation', citationSchema);
export const Reference = Citation;
export const ReferenceCollection = mongoose.model('ReferenceCollection', referenceCollectionSchema);
export const DoiCache = mongoose.model('DoiCache', doiCacheSchema);
export const UsageEvent = mongoose.model('UsageEvent', usageEventSchema);
export const DailyUsageAggregate = mongoose.model('DailyUsageAggregate', dailyUsageAggregateSchema);
export const DataDeletionJob = mongoose.model('DataDeletionJob', dataDeletionJobSchema);
export const LatexJob = mongoose.model('LatexJob', latexJobSchema);
export const TextGuardScan = mongoose.model('TextGuardScan', textGuardScanSchema);
export const LiteratureEntry = mongoose.model('LiteratureEntry', literatureEntrySchema);
export const EvidenceExtract = mongoose.model('EvidenceExtract', evidenceExtractSchema);
export const LiteratureMatrix = mongoose.model('LiteratureMatrix', literatureMatrixSchema);
export const LiteratureTheme = mongoose.model('LiteratureTheme', literatureThemeSchema);
export const StudyComparison = mongoose.model('StudyComparison', studyComparisonSchema);
export const ResearchGapCandidate = mongoose.model('ResearchGapCandidate', researchGapCandidateSchema);
export const SynthesisDraft = mongoose.model('SynthesisDraft', synthesisDraftSchema);
export const Dataset = mongoose.model('Dataset', datasetSchema);
export const DatasetVersion = mongoose.model('DatasetVersion', datasetVersionSchema);
export const DatasetVariable = mongoose.model('DatasetVariable', datasetVariableSchema);
export const Analysis = mongoose.model('Analysis', analysisSchema);
export const AnalysisResult = mongoose.model('AnalysisResult', analysisResultSchema);
export const AnalysisJob = mongoose.model('AnalysisJob', analysisJobSchema);
export const ResearchChat = mongoose.model('ResearchChat', researchChatSchema);
export const ResearchDocument = mongoose.model('ResearchDocument', researchDocumentSchema);
export const DocumentChunk = mongoose.model('DocumentChunk', documentChunkSchema);
export const DocumentIndex = mongoose.model('DocumentIndex', documentIndexSchema);
export const CitationEvidence = mongoose.model('CitationEvidence', citationEvidenceSchema);
export const DocumentProcessingJob = mongoose.model('DocumentProcessingJob', documentProcessingJobSchema);
export const SystematicReview = mongoose.model('SystematicReview', systematicReviewSchema);
export const StudyRecord = mongoose.model('StudyRecord', studyRecordSchema);
export const ReviewRecord = StudyRecord; // Alias for Systematic Review Records
export const ReviewProtocol = mongoose.model('ReviewProtocol', reviewProtocolSchema);
export const SearchStrategy = mongoose.model('SearchStrategy', searchStrategySchema);
export const DuplicateGroup = mongoose.model('DuplicateGroup', duplicateGroupSchema);
export const ScreeningDecision = mongoose.model('ScreeningDecision', screeningDecisionSchema);
export const ReviewConflict = mongoose.model('ReviewConflict', reviewConflictSchema);
export const ExtractionTemplate = mongoose.model('ExtractionTemplate', extractionTemplateSchema);
export const StudyExtraction = mongoose.model('StudyExtraction', studyExtractionSchema);
export const RiskOfBiasAssessment = mongoose.model('RiskOfBiasAssessment', riskOfBiasAssessmentSchema);
export const PRISMAFlowSnapshot = mongoose.model('PRISMAFlowSnapshot', prismaFlowSnapshotSchema);
export const ReviewAuditEvent = mongoose.model('ReviewAuditEvent', reviewAuditEventSchema);
export const JournalSubmission = mongoose.model('JournalSubmission', journalSubmissionSchema);
export const ProjectInvitation = mongoose.model('ProjectInvitation', projectInvitationSchema);
export const DocumentComment = mongoose.model('DocumentComment', documentCommentSchema);
export const ReviewRequest = mongoose.model('ReviewRequest', reviewRequestSchema);
export const CollaborationNotification = mongoose.model('CollaborationNotification', collaborationNotificationSchema);




