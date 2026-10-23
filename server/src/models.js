import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  displayName: { type: String, default: '' },
  role: { type: String, enum: ['researcher', 'reviewer', 'admin'], default: 'researcher' },
  status: { type: String, enum: ['active', 'suspended', 'pending'], default: 'active' }
}, { timestamps: true });

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
  currentRevisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Revision', default: null },
  persistenceConsent: { type: Boolean, default: true }
}, { timestamps: true });
documentSchema.index({ ownerId: 1, updatedAt: -1 });

const revisionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null, index: true },
  revisionNumber: { type: Number, default: 1 },
  mode: { type: String, required: true },
  originalText: { type: String, default: '' },
  revisedText: { type: String, default: '' },
  summary: { type: String, default: '' },
  modelProvider: { type: String, default: 'openai-compatible' },
  modelName: { type: String, default: '' }
}, { timestamps: true });
revisionSchema.index({ userId: 1, createdAt: -1 });

const integrityReportSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', default: null },
  revisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Revision', default: null },
  reportType: { type: String, enum: ['writing', 'originality', 'citations', 'comprehensive'], required: true },
  findings: [{
    category: { type: String, required: true },
    severity: { type: String, enum: ['info', 'review', 'warning', 'critical'], default: 'review' },
    excerpt: { type: String, default: '' },
    explanation: { type: String, required: true },
    suggestedAction: { type: String, default: '' },
    sourceMetadata: { type: mongoose.Schema.Types.Mixed, default: null }
  }],
  limitations: { type: String, default: '' }
}, { timestamps: true });
integrityReportSchema.index({ ownerId: 1, createdAt: -1 });

const auditEventSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true },
  resourceType: { type: String, required: true },
  resourceId: { type: String, default: '' },
  requestId: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: { createdAt: true, updatedAt: false } });
auditEventSchema.index({ actorId: 1, createdAt: -1 });

export const User = mongoose.model('User', userSchema);
export const Project = mongoose.model('Project', projectSchema);
export const Document = mongoose.model('Document', documentSchema);
export const Revision = mongoose.model('Revision', revisionSchema);
export const IntegrityReport = mongoose.model('IntegrityReport', integrityReportSchema);
export const AuditEvent = mongoose.model('AuditEvent', auditEventSchema);
