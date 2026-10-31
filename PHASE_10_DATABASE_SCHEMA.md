# RESEARCHPROOF AI 1.0 — PHASE 10 DATABASE SCHEMA
## RESEARCH COLLABORATION STUDIO DATA ARCHITECTURE

### 1. Overview
Phase 10 extends the ResearchProof AI 1.0 database architecture with four dedicated Mongoose collections supporting multi-user research teams, high-entropy cryptographic invitation tokens, threaded inline manuscript comments, and structured peer-review workflows.

---

### 2. Schema Specifications

#### 2.1 `ProjectInvitation` Collection (`projectInvitationSchema`)
Stores invitations sent to external research collaborators with cryptographically hashed tokens and a 7-day TTL.

```javascript
{
  projectId: { type: ObjectId, ref: 'Project', required: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  role: { type: String, enum: ['owner', 'editor', 'reviewer', 'viewer'], default: 'editor' },
  inviterId: { type: ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'expired'], default: 'pending', index: true },
  metadata: { type: Mixed, default: {} },
  createdAt: Date,
  updatedAt: Date
}
```
**Indices**:
- `{ tokenHash: 1 }` (unique)
- `{ projectId: 1, email: 1 }`
- `{ expiresAt: 1 }`

---

#### 2.2 `DocumentComment` Collection (`documentCommentSchema`)
Maintains anchored feedback threads on specific manuscript excerpts or general document sections.

```javascript
{
  projectId: { type: ObjectId, ref: 'Project', required: true, index: true },
  documentId: { type: ObjectId, ref: 'Document', required: true, index: true },
  userId: { type: ObjectId, ref: 'User', required: true, index: true },
  selectedText: { type: String, default: '', trim: true },
  position: { type: Mixed, default: {} },
  content: { type: String, required: true, trim: true, maxlength: 4000 },
  resolved: { type: Boolean, default: false, index: true },
  resolvedBy: { type: ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null },
  replies: [
    {
      userId: { type: ObjectId, ref: 'User', required: true },
      content: { type: String, required: true, trim: true, maxlength: 4000 },
      createdAt: { type: Date, default: Date.now }
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```
**Indices**:
- `{ documentId: 1, resolved: 1 }`
- `{ projectId: 1, createdAt: -1 }`

---

#### 2.3 `ReviewRequest` Collection (`reviewRequestSchema`)
Manages formal manuscript peer review submissions, reviewer assignments, rubric scoring, and decision timelines.

```javascript
{
  projectId: { type: ObjectId, ref: 'Project', required: true, index: true },
  documentId: { type: ObjectId, ref: 'Document', required: true, index: true },
  requesterId: { type: ObjectId, ref: 'User', required: true, index: true },
  reviewerId: { type: ObjectId, ref: 'User', default: null, index: true },
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
  timeline: [
    {
      event: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      actorId: { type: ObjectId, ref: 'User' },
      note: { type: String, default: '' }
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```
**Indices**:
- `{ projectId: 1, status: 1 }`
- `{ documentId: 1, versionNumber: -1 }`

---

#### 2.4 `CollaborationNotification` Collection (`collaborationNotificationSchema`)
Dispatches real-time user-targeted notifications for invitations, review assignments, and comment replies.

```javascript
{
  userId: { type: ObjectId, ref: 'User', required: true, index: true },
  projectId: { type: ObjectId, ref: 'Project', default: null, index: true },
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
  link: { type: String, default: '' },
  createdAt: Date,
  updatedAt: Date
}
```
**Indices**:
- `{ userId: 1, read: 1, createdAt: -1 }`

---

### 3. Data Integrity & Concurrency Safeguards
1. **Last Owner Invariance**: Prevents deleting or demoting a project member if they are the sole remaining `owner`.
2. **Optimistic Locking**: `Document.version` is checked during review submissions to guarantee that reviews evaluate consistent snapshots.
3. **Cryptographic Token Hashing**: Plaintext invitation tokens are never stored; only their SHA-256 digests are persisted.
