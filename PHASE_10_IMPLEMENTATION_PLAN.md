# RESEARCHPROOF AI 1.0 — PHASE 10 IMPLEMENTATION PLAN
## RESEARCH COLLABORATION STUDIO ARCHITECTURE & ROADMAP

### 1. Executive Summary & Objective
Phase 10 implements the **Research Collaboration Studio** inside ResearchProof AI 1.0. It delivers a modern, Linear-inspired multi-user research workspace enabling co-authoring, manuscript peer review, project-scoped role-based access control (RBAC), secure email invitations, asynchronous feedback threads, and auditable task workflows without compromising cross-tenant privacy or existing data.

---

### 2. Core Pillars & Architecture

```
                                +--------------------------------------------+
                                |        Research Collaboration Studio       |
                                +--------------------------------------------+
                                                      |
    +-------------------+-------------------+---------+---------+-------------------+-------------------+
    |                   |                   |                   |                   |                   |
    v                   v                   v                   v                   v                   v
[Team & RBAC]   [Token Invitations]  [Task Board]     [Inline Comments]    [Review Workflow]   [Audit & Feeds]
(Owner/Editor/  (Cryptographic       (Kanban/List      (Threaded Anchor     (Draft -> Review -> (Timestamped
 Reviewer/View)  SHA-256 tokens)      Lifecycle)        Discussions)         Approval)           Event Stream)
```

1. **4-Tier Academic RBAC Engine**:
   - `OWNER`: Full project administration, role assignment, project deletion, invitation dispatch, final review approval.
   - `EDITOR`: Manuscript co-authoring, task creation/editing, comment discussions, submitting review requests.
   - `REVIEWER`: Peer-review execution, evaluation scoring, inline commenting, issuing revision recommendations.
   - `VIEWER`: Read-only access to documents, tasks, and project activity streams.

2. **Cryptographic Invitation Subsystem**:
   - High-entropy cryptographic invitation tokens (`crypto.randomBytes(32)`).
   - Database persistence stores SHA-256 hash of tokens with a 7-day TTL (`expiresAt`).
   - Secure acceptance/decline flow validating user identity and preventing token replay attacks.
   - Safeguard preventing removal or demotion of the last project `OWNER`.

3. **Collaborative Task Management**:
   - Kanban board and List views supporting statuses: `todo`, `in_progress`, `in_review`, `completed`.
   - Priorities (`low`, `medium`, `high`, `urgent`), assignees, due dates, and stage categorization (`literature`, `analysis`, `drafting`, `review`, `submission`, `general`).

4. **Threaded Document Comments & Discussions**:
   - Anchored comments referencing `documentId` and optional text selections.
   - Threaded replies, timestamped discussions, and resolution status toggling.

5. **Formal Manuscript Review Workflow**:
   - Milestone state machine:
     `draft` ➔ `submitted_for_review` ➔ `under_review` ➔ `changes_requested` / `approved` / `rejected`.
   - Formal decision capture with numerical rubrics (rigor, methodology, clarity, citations).

6. **In-App Notifications & Audit Feeds**:
   - Instant notification dispatch for invites, review assignments, comments, and task updates.
   - Unified audit logging tracking all collaborative actions.

---

### 3. Database Schema Extensions (Mongoose)

1. `ProjectInvitation`:
   - `projectId`, `email`, `role`, `inviterId`, `tokenHash`, `expiresAt`, `status`.
2. `DocumentComment`:
   - `projectId`, `documentId`, `userId`, `selectedText`, `content`, `resolved`, `resolvedBy`, `resolvedAt`, `replies`.
3. `ReviewRequest`:
   - `projectId`, `documentId`, `requesterId`, `reviewerId`, `status`, `decision`, `decisionNotes`, `score`, `criteriaScores`, `timeline`.
4. `CollaborationNotification`:
   - `userId`, `projectId`, `type`, `title`, `message`, `read`, `link`.

---

### 4. Implementation Steps & Validation Strategy
1. **Extend Schemas**: Update `server/src/models.js` with Phase 10 schemas and export models.
2. **Domain Service**: Create `server/src/collaborationService.js` implementing RBAC checks, token hashing, review state machines, and notification creation.
3. **API Endpoints**: Wire up comprehensive endpoints in `server/src/index.js` for invitations, members, tasks, reviews, comments, and notifications.
4. **Interactive UI**: Upgrade `client/src/modules/ResearchCollaboration.tsx` to an 8-tab enterprise studio.
5. **Automated Testing**: Author `server/test/phase10_collaboration_studio.test.js` covering RBAC enforcement, invitation cycles, tasks, reviews, and notifications.
6. **Reports & Release Gate**: Author database schema, API documentation, RBAC matrix, security, test, and release gate reports.
