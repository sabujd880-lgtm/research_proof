# ResearchProof AI 1.0 — Phase 3 Implementation Plan: Enterprise Dashboard & Unified Research Projects

**Plan Version**: 1.0.0  
**Status**: APPROVED & IN EXECUTION  
**Target Completion**: Phase 3 Master Release  
**Date**: October 29, 2026  
**Engineering Leads**: Principal Full-Stack Engineer, React/TypeScript Architect, Node.js/MongoDB Engineer, QA Lead  

---

## 1. Executive Summary & Phase 2 Baseline Verification

Before initiating Phase 3 development, Phase 2 was verified:
- **Git Status & Working Tree**: Repository at `https://github.com/sabujd880-lgtm/research_proof` (branch `main`).
- **Phase 2 Design System**: Linear-inspired semantic tokens (`--rp-bg`, `--rp-surface`, `--rp-border`, `--rp-text`, `--rp-accent`, etc.) verified in `client/src/styles.css`.
- **Typography & Font Stack**: `Inter` for UI and `JetBrains Mono` for monospace academic data verified.
- **Application Shell & Sidebar**: 248px expanded, 64px compact (`Ctrl+B`), and 260px mobile overlay drawer verified.
- **Top Header**: 56px header with breadcrumbs, project switcher, and `Ctrl+K` Command Palette verified.
- **Test Baseline**: 60/60 automated tests passing (35 system audit + 25 auth security).
- **Frontend Build**: `tsc -b && vite build` passing with zero compilation errors in ~3 seconds.

Phase 3 builds directly on this foundation to implement an Enterprise Research Dashboard, Unified Project Model & Management API, Project Creation Wizard, Project Detail Workspace, and Task/Activity engines with 100% authenticated MongoDB Atlas data binding.

---

## 2. Phased Architecture & Execution Order

```
[Phase 3.1: Unified Project & Task Data Models]
   │  - Extend Project schema (researchType, objectives, keywords, progress, dates, soft delete)
   │  - Task schema alignment (status, priority, dueDate, assignee)
   │  - In-memory dev store parity
   ▼
[Phase 3.2: Project & Dashboard API Suite]
   │  - GET /api/v1/dashboard/overview (aggregated user metrics, recent projects, activity, tasks)
   │  - GET /api/v1/dashboard/recent-projects, recent-activity, upcoming-tasks
   │  - GET /api/v1/projects (pagination, filtering, search, sorting)
   │  - POST /api/v1/projects (validation & audit event)
   │  - PATCH /api/v1/projects/:id & DELETE /api/v1/projects/:id (soft delete)
   │  - POST /api/v1/projects/:id/archive & /restore
   │  - Task API & deterministic progress auto-calculation
   ▼
[Phase 3.3: Production Research Dashboard UI]
   │  - Workspace Header (greeting, active project switcher, New Project CTA, Ctrl+K search)
   │  - 6 Key Metrics (Total Projects, Active Projects, Documents, References, Tasks, Deadlines)
   │  - Recent Projects cards with status pills, discipline badges, progress meters
   │  - Recent Activity timeline with audit event formatting
   │  - Quick Actions jump cards
   │  - Upcoming Tasks checklist with instant toggle
   ▼
[Phase 3.4: Project Creation Wizard & Projects Hub]
   │  - Professional New Project Wizard dialog (validation, objectives, research types)
   │  - List / Grid view switcher with persistence
   │  - Search, discipline filter, status filter, sort dropdown
   │  - Archive, Restore, Edit, and Delete actions
   ▼
[Phase 3.5: Unified Project Workspace & Sub-Navigation]
   │  - Context-preserving tab navigation across all 8 research modules
   │  - Project-scoped document management & upload
   │  - Milestone and task management
   ▼
[Phase 3.6: Automated Regression Testing & Deliverables]
   │  - Backend unit & integration tests for all new dashboard/project endpoints
   │  - Frontend production build verification
   │  - PHASE_3_API_DOCUMENTATION.md, PHASE_3_DATABASE_CHANGES.md,
   │    PHASE_3_TEST_REPORT.md, PHASE_3_SECURITY_REPORT.md, PHASE_3_RELEASE_GATE.md
   ▼
[Phase 3.7: Production Sign-Off & Git Push]
```

---

## 3. Detailed Technical Specifications

### 3.1 Unified Project Model Schema
- `_id`: ObjectId
- `userId` / `ownerId`: ObjectId ref User (indexed)
- `title`: String (required, trimmed, max 160)
- `description`: String (max 1000)
- `discipline`: String (default 'General Academic', max 100)
- `researchType`: String enum: `['Quantitative', 'Qualitative', 'Mixed Methods', 'Experimental', 'Systematic Review', 'Literature Review', 'Other']`
- `objectives`: String (max 2000)
- `keywords`: Array of Strings
- `status`: String enum: `['draft', 'active', 'on_hold', 'completed', 'archived', 'deleted']` (indexed)
- `progress`: Number (0-100, calculated deterministically from tasks)
- `workflowStage`: String enum: `['literature', 'analysis', 'drafting', 'review', 'submission']`
- `completionPercentage`: Number (0-100, synced with `progress`)
- `startDate`: Date
- `targetDate`: Date
- `visibility`: String enum: `['private', 'team', 'public']`
- `archivedAt`: Date (null if active)
- `deletedAt`: Date (null if active, for soft deletion)
- `timestamps`: `createdAt`, `updatedAt`

### 3.2 Task Model & Progress Engine
- Schema: `projectId`, `userId`, `assigneeId`, `title`, `description`, `status` (`todo`, `in_progress`, `review`, `done`), `priority` (`low`, `medium`, `high`, `urgent`), `stage`, `dueDate`.
- When a task is marked `done`, the server deterministically recalculates:
  $$\text{Progress} = \text{round}\left(\frac{N_{\text{done}}}{N_{\text{total}}} \times 100\right)$$
  and automatically updates `project.progress` and `project.completionPercentage`.

### 3.3 Dashboard API Response Contract (`/api/v1/dashboard/overview`)
```json
{
  "metrics": {
    "totalProjects": 3,
    "activeProjects": 2,
    "researchDocuments": 8,
    "savedReferences": 24,
    "pendingTasks": 5,
    "upcomingDeadlines": 2
  },
  "recentProjects": [...],
  "recentActivity": [...],
  "upcomingTasks": [...]
}
```

---

## 4. Security & Tenancy Rules
1. **Ownership & Tenancy**: Users can ONLY view, edit, or delete projects they own or where they are an active member. All queries enforce `{ $or: [{ userId: req.user.id }, { _id: { $in: memberProjIds } }] }`.
2. **Soft Deletion**: Projects are deleted with `status: 'deleted'` and `deletedAt: new Date()` to prevent accidental data loss.
3. **No Unauthenticated Leaks**: All dashboard and project endpoints require `requireAuth`.
4. **Audit Logging**: Every project creation, edit, archiving, restoring, and deletion is recorded in `AuditEvent`.

