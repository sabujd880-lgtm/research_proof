# RESEARCHPROOF AI 1.0 — PHASE 10 API SPECIFICATION
## RESEARCH COLLABORATION STUDIO ENDPOINTS REFERENCE

Base URL: `/api/v1` (or `/api`)

---

### 1. Invitations & Team Management

#### `POST /api/v1/projects/:id/invitations`
Dispatches a secure email invitation with a cryptographic token to join a research project.

- **Auth**: Required (`OWNER` only)
- **Request Body**:
  ```json
  {
    "email": "colleague@institution.edu",
    "role": "editor"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "invitation": {
      "invitationId": "6724a...",
      "email": "colleague@institution.edu",
      "role": "editor",
      "rawToken": "4b6e...",
      "expiresAt": "2026-11-07T05:30:00.000Z",
      "invitationUrl": "/invitations/4b6e.../accept"
    },
    "message": "Invitation successfully dispatched to colleague@institution.edu"
  }
  ```

#### `GET /api/v1/projects/:id/invitations`
Retrieves pending invitations for the project.

- **Auth**: Required
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "invitations": [ ... ]
  }
  ```

#### `DELETE /api/v1/projects/:id/invitations/:inviteId`
Revokes an unaccepted invitation.

- **Auth**: Required (`OWNER` only)
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "revoked": true
  }
  ```

#### `POST /api/v1/invitations/:token/accept`
Validates a raw invitation token, binds the user to the project, and activates member permissions.

- **Auth**: Required
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Successfully joined research project as editor",
    "projectId": "6720...",
    "role": "editor"
  }
  ```

#### `POST /api/v1/invitations/:token/decline`
Declines an invitation.

- **Auth**: None required (public action via token)
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Invitation declined."
  }
  ```

#### `PATCH /api/v1/projects/:id/members/:memberId`
Modifies a collaborator's role. Enforces safeguard preventing demotion of the last owner.

- **Auth**: Required (`OWNER` only)
- **Request Body**: `{ "role": "reviewer" }`
- **Response** (`200 OK`): `{ "_id": "...", "role": "reviewer" }`
- **Error Response** (`400 Bad Request`): `{ "error": "Cannot demote the last project owner." }`

#### `DELETE /api/v1/projects/:id/members/:memberId`
Removes a collaborator from the project. Enforces safeguard preventing removal of the last owner.

- **Auth**: Required (`OWNER` only)
- **Response** (`200 OK`): `{ "removed": true }`

---

### 2. Collaborative Tasks (Kanban & List)

#### `GET /api/v1/projects/:id/tasks`
Lists all project milestone tasks.

#### `POST /api/v1/projects/:id/tasks`
Creates a collaborative task.

- **Auth**: Required (`OWNER` or `EDITOR`)
- **Request Body**:
  ```json
  {
    "title": "Compute Bonferroni correction on fMRI clusters",
    "description": "Threshold p < 0.001",
    "priority": "urgent",
    "stage": "analysis"
  }
  ```

#### `PATCH /api/v1/projects/:id/tasks/:taskId`
Updates status (`todo`, `in_progress`, `review`, `done`), priority, or details.

#### `DELETE /api/v1/projects/:id/tasks/:taskId`
Deletes a task.

---

### 3. Threaded Document Comments

#### `GET /api/v1/projects/:id/comments`
Lists comments with optional filters (`documentId`, `resolved`).

#### `POST /api/v1/projects/:id/comments`
Posts an anchored or general comment on a manuscript.

- **Request Body**:
  ```json
  {
    "documentId": "6721...",
    "selectedText": "coordinated neural ensembles in prefrontal cortex",
    "content": "Verify if power spectral density was normalized."
  }
  ```

#### `POST /api/v1/projects/:id/comments/:commentId/reply`
Appends a threaded reply to an existing comment.

- **Request Body**: `{ "content": "Confirmed, wavelets normalized across trials." }`

#### `PATCH /api/v1/projects/:id/comments/:commentId`
Resolves or reopens a comment thread (`{ "resolved": true }`).

#### `DELETE /api/v1/projects/:id/comments/:commentId`
Deletes a comment thread.

---

### 4. Manuscript Peer Review

#### `GET /api/v1/projects/:id/reviews`
Lists all manuscript peer review submissions and decisions.

#### `POST /api/v1/projects/:id/reviews`
Submits a document version for peer review.

- **Request Body**:
  ```json
  {
    "documentId": "6721...",
    "reviewerId": "6710...",
    "notes": "Pre-submission review for Nature Neuroscience"
  }
  ```

#### `POST /api/v1/projects/:id/reviews/:reviewId/decision`
Issues formal review decision with 4-criteria rubric scores.

- **Request Body**:
  ```json
  {
    "decision": "accept",
    "decisionNotes": "Experimental rigor meets highest standards.",
    "criteriaScores": {
      "methodologicalRigor": 9,
      "academicClarity": 9,
      "citationEvidence": 8,
      "originality": 10
    }
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "review": {
      "decision": "accept",
      "status": "approved",
      "score": 90,
      "criteriaScores": { ... }
    }
  }
  ```

---

### 5. In-App Notifications

#### `GET /api/v1/notifications`
Fetches user notifications.

#### `PATCH /api/v1/notifications/:id/read`
Marks single notification as read.

#### `POST /api/v1/notifications/read-all`
Marks all notifications as read for current user.
