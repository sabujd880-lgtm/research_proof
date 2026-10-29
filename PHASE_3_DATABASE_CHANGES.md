# ResearchProof AI 1.0 — Phase 3 Database Changes & Schema Architecture

**Status**: Verified & Applied  
**Engine**: MongoDB Atlas & Mongoose ODM (with In-Memory Dev Store Mirroring)  

---

## 1. Mongoose Schema Enhancements (`server/src/models.js`)

### `Project` Schema
The `projectSchema` has been upgraded to support full enterprise research lifecycle tracking without altering existing fields or invalidating historical records.

```javascript
const projectSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: function() { return this.userId; },
    index: true
  },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, default: '', maxlength: 1000 },
  discipline: { type: String, default: 'General Academic', maxlength: 100 },
  documentType: { type: String, default: 'Manuscript', maxlength: 80 },
  researchType: {
    type: String,
    enum: [
      'Quantitative', 'Qualitative', 'Mixed Methods', 'Experimental',
      'Systematic Review', 'Literature Review', 'Meta-Analysis',
      'Observational', 'Computational', 'Theoretical', 'Other'
    ],
    default: 'Quantitative'
  },
  objectives: { type: mongoose.Schema.Types.Mixed, default: [] },
  keywords: [{ type: String, trim: true }],
  status: {
    type: String,
    enum: [
      'draft', 'active', 'on_hold', 'completed', 'archived', 'deleted',
      'Draft', 'Active', 'On Hold', 'Completed', 'Archived'
    ],
    default: 'active',
    index: true
  },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  workflowStage: {
    type: String,
    enum: ['literature', 'analysis', 'drafting', 'review', 'submission'],
    default: 'literature',
    index: true
  },
  completionPercentage: { type: Number, default: 0, min: 0, max: 100 },
  startDate: { type: Date, default: null },
  targetDate: { type: Date, default: null },
  visibility: { type: String, enum: ['private', 'team', 'public'], default: 'private' },
  archivedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
  tags: [{ type: String, trim: true }]
}, { timestamps: true });

// Compound and single-field performance indexes
projectSchema.index({ userId: 1, updatedAt: -1 });
projectSchema.index({ userId: 1, status: 1 });
projectSchema.index({ discipline: 1 });
```

---

## 2. In-Memory Store Mirroring (`server/src/index.js`)

To guarantee seamless offline development, continuous integration, and test suite execution without external database dependencies, all schema changes are identically mirrored in the In-Memory Dev Store:

- `memProjects`: Preserves `ownerId`, `researchType`, `objectives`, `keywords`, `progress`, `startDate`, `targetDate`, `archivedAt`, and `deletedAt`.
- `memProjectMembers`: Auto-creates owner membership on project creation.
- `memTasks`: Tracks tasks per project, updating deterministic progress across in-memory operations.
- `memAuditEvents`: Logs `PROJECT_CREATED`, `PROJECT_UPDATED`, `PROJECT_ARCHIVED`, `PROJECT_RESTORED`, and `PROJECT_DELETED`.

---

## 3. Data Integrity & Backward Compatibility Verification

1. **Non-Destructive Deletion**: Projects are soft-deleted via `status: 'deleted'` and `deletedAt: new Date()`. Documents, citations, and revisions associated with the project remain preserved for auditing.
2. **Deterministic Progress Sync**: Derived via `syncProjectProgress(projectId)`:
   $$\text{progress} = \begin{cases} 0 & \text{if } \text{totalTasks} = 0 \\ \text{round}\left(\frac{\text{completedTasks}}{\text{totalTasks}} \times 100\right) & \text{otherwise} \end{cases}$$
3. **Legacy Schema Tolerance**: Historical projects without `ownerId` automatically fall back to `userId` via Mongoose default getter functions.

