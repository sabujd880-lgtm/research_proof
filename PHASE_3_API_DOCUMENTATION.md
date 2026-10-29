# ResearchProof AI 1.0 — Phase 3 API Documentation
## Unified Research Projects & Real-Time Enterprise Dashboard APIs

**Status**: Verified & Production Ready  
**Base URLs**: `/api` and `/api/v1` (Dual prefix compatibility)  
**Security**: Bearer JWT Authorization / HTTP-Only Session Cookies  

---

## 1. Dashboard Overview & Real-Time Metrics

### `GET /api/v1/dashboard/overview`
Retrieves consolidated workspace telemetry, high-level metrics, recent projects, upcoming tasks, and the live audit activity stream for the authenticated researcher.

- **Authentication**: Required (`requireAuth`)
- **Headers**: `Authorization: Bearer <token>`
- **Response `200 OK`**:
```json
{
  "metrics": {
    "totalProjects": 12,
    "activeProjects": 9,
    "draftProjects": 3,
    "totalDocuments": 28,
    "researchDocuments": 28,
    "totalWords": 45200,
    "totalCitations": 142,
    "savedReferences": 142,
    "verifiedDois": 118,
    "tasks": {
      "total": 24,
      "completed": 18,
      "pending": 6,
      "completionRate": 75
    },
    "pendingTasks": 6,
    "upcomingDeadlines": 2
  },
  "recentProjects": [
    {
      "_id": "673f...",
      "title": "Neural Dynamics of Semantic Memory Recall",
      "discipline": "Medicine & Health",
      "researchType": "Experimental",
      "progress": 75,
      "status": "active",
      "updatedAt": "2026-10-29T11:20:00.000Z"
    }
  ],
  "recentActivity": [
    {
      "id": "6740...",
      "action": "TASK_UPDATED",
      "resourceType": "Task",
      "resourceId": "6741...",
      "date": "2026-10-29T11:15:00.000Z",
      "metadata": { "title": "Calibrate high-density EEG array" }
    }
  ],
  "upcomingTasks": [
    {
      "_id": "6742...",
      "projectId": "673f...",
      "title": "Submit IRB Protocol Revision",
      "priority": "high",
      "status": "todo",
      "dueDate": "2026-11-12T00:00:00.000Z"
    }
  ]
}
```

---

### `GET /api/v1/dashboard/recent-projects`
Retrieves the authenticated user's 4 most recently updated active projects.

- **Authentication**: Required
- **Response `200 OK`**: `Array<Project>`

---

### `GET /api/v1/dashboard/recent-activity`
Retrieves the 10 most recent chronological audit events and revision actions logged across the user's workspaces.

- **Authentication**: Required
- **Response `200 OK`**: `Array<ActivityEvent>`

---

### `GET /api/v1/dashboard/upcoming-tasks`
Retrieves pending tasks across all user projects, ordered chronologically by due date (`dueDate: 1`) and priority.

- **Authentication**: Required
- **Response `200 OK`**: `Array<Task>`

---

## 2. Research Projects Management

### `GET /api/v1/projects`
Queries and filters projects with optional server-side pagination and response headers.

- **Query Parameters**:
  - `status` (*string*, optional): `all`, `active`, `draft`, `completed`, `archived` (default: `active` unless specified)
  - `discipline` (*string*, optional): Filter by academic field (e.g. `Medicine & Health`, `Computer Science`)
  - `q` / `search` (*string*, optional): Case-insensitive search on title, description, and keywords
  - `sort` (*string*, optional): `updatedAt`, `title`, `progress`, `targetDate` (default: `updatedAt`)
  - `order` (*string*, optional): `desc` or `asc` (default: `desc`)
  - `page` (*integer*, optional): Page number (default: `1`)
  - `limit` (*integer*, optional): Items per page (default: `50`, max: `100`)
  - `paginated` (*boolean*, optional): When set to `'true'`, wraps response in `{ projects, pagination }` object. When omitted, returns raw array for backward compatibility.
- **Response Headers**:
  - `X-Total-Count`: Total number of matching records
  - `X-Page`: Current page number
  - `X-Total-Pages`: Total number of pages available

---

### `POST /api/v1/projects`
Creates a new research project, auto-assigns the creator as owner in `ProjectMember`, initializes deterministic progress to `0%`, and logs an audit event.

- **Validation Schema (Zod)**:
  - `title` (*string*, required): 3 to 160 characters
  - `discipline` (*string*, optional): Field of study (default: `'General Academic'`)
  - `researchType` (*enum*, optional): `'Quantitative'`, `'Qualitative'`, `'Mixed Methods'`, `'Experimental'`, `'Systematic Review'`, `'Literature Review'`, `'Meta-Analysis'`, `'Observational'`, `'Computational'`, `'Theoretical'`, `'Other'`
  - `description` (*string*, optional): Max 1000 characters
  - `objectives` (*array of strings* or *string*, optional): Project goals
  - `keywords` (*array of strings*, optional): Academic keywords
  - `startDate` (*date*, optional)
  - `targetDate` (*date*, optional)
  - `visibility` (*enum*, optional): `'private'`, `'team'`, `'public'` (default: `'private'`)
- **Status Codes**:
  - `201 Created`: Project initialized
  - `400 Bad Request`: Validation failure (e.g., title < 3 chars)

---

### `GET /api/v1/projects/:id`
Retrieves a single project workspace with its linked documents, tasks, and project members.

- **Authentication**: Required (user must be owner or active member)
- **Response `200 OK`**: Project record with embedded `documents`, `tasks`, `members`, and `userRole`.

---

### `PATCH /api/v1/projects/:id`
Updates project metadata.

- **Authentication**: Required (Owner or Editor)
- **Response `200 OK`**: Updated project object.

---

### `POST /api/v1/projects/:id/archive`
Transitions project to archived state, sets `archivedAt` timestamp, and logs audit record.

- **Response `200 OK`**: `{ "_id": "...", "status": "archived", "archivedAt": "..." }`

---

### `POST /api/v1/projects/:id/restore`
Restores an archived project back to active state and clears archive timestamps.

- **Response `200 OK`**: `{ "_id": "...", "status": "active", "archivedAt": null }`

---

### `DELETE /api/v1/projects/:id`
Performs non-destructive soft deletion (`status: 'deleted'`, `deletedAt: new Date()`).

- **Response `200 OK`**: `{ "deleted": true, "status": "deleted" }`

---

## 3. Project Tasks & Deterministic Progress

### `GET /api/v1/projects/:id/tasks`
Lists all tasks for the designated project.

---

### `POST /api/v1/projects/:id/tasks`
Creates a new milestone or task and deterministically recalculates project completion percentage via `syncProjectProgress(projectId)`.

- **Body**: `{ "title": "...", "priority": "high", "dueDate": "...", "stage": "methodology" }`
- **Response `201 Created`**: Created task object.

---

### `PATCH /api/v1/projects/:id/tasks/:taskId`
Updates task status (e.g. `todo` $\leftrightarrow$ `done`), title, or priority, automatically triggering deterministic progress recalculation:
$$\text{progress} = \text{round}\left(\frac{\text{completedTasks}}{\text{totalTasks}} \times 100\right)$$

---

### `DELETE /api/v1/projects/:id/tasks/:taskId`
Deletes a task and recalculates project progress.

---

### `GET /api/v1/projects/:id/activity`
Aggregates revisions, documents, tasks, and audit logs for the specific project into a unified chronological feed.
