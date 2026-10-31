# RESEARCHPROOF AI 1.0 — PHASE 10 RBAC SPECIFICATION
## 4-TIER ACADEMIC ROLE-BASED ACCESS CONTROL (RBAC) MATRIX

### 1. Role Definitions & Hierarchy

```
       [OWNER] (Project Principal Investigator / Lead Author)
          |
       [EDITOR] (Co-Author, Statistical Analyst, Research Assistant)
          |
      [REVIEWER] (Peer Reviewer, Faculty Advisor, Editorial Auditor)
          |
       [VIEWER] (External Stakeholder, Department Observer)
```

1. **`OWNER` (Principal Investigator / Project Admin)**:
   - Holds unrestricted project administration, role assignment, project deletion, and final sign-off authority.
2. **`EDITOR` (Co-Author / Research Collaborator)**:
   - Co-authors manuscripts, manages datasets, updates tasks, participates in comment threads, and submits review requests.
3. **`REVIEWER` (Peer Reviewer / Academic Advisor)**:
   - Reviews manuscripts, evaluates methodology, assigns rubric scores (1-10), issues decisions (`accept`, `revisions`, `reject`), and anchors feedback. Cannot modify source documents directly.
4. **`VIEWER` (Read-Only Observer)**:
   - Has read-only visibility into manuscripts, dossiers, and activity feeds.

---

### 2. Comprehensive Permissions Matrix

| Capability / Action | System Permission Code | OWNER | EDITOR | REVIEWER | VIEWER |
|---|---|:---:|:---:|:---:|:---:|
| **Read Project Metadata & Timeline** | `project:read` | Yes | Yes | Yes | Yes |
| **Edit Project Settings (Title, Tags)** | `project:update` | Yes | No | No | No |
| **Archive or Delete Project** | `project:delete` | Yes | No | No | No |
| **Dispatch Collaborator Invitations** | `team:invite` | Yes | No | No | No |
| **Change Member Roles** | `team:assign_role` | Yes | No | No | No |
| **Remove Member (with Last Owner Protection)** | `team:remove_member` | Yes | No | No | No |
| **Read Documents & Manuscript Drafts** | `document:read` | Yes | Yes | Yes | Yes |
| **Create & Edit Manuscript Text** | `document:write` | Yes | Yes | No | No |
| **Delete Manuscript Document** | `document:delete` | Yes | Yes | No | No |
| **View Kanban Tasks** | `task:read` | Yes | Yes | Yes | Yes |
| **Create & Update Kanban Tasks** | `task:write` | Yes | Yes | No | No |
| **Delete Project Task** | `task:delete` | Yes | Yes | No | No |
| **View Comment Discussions** | `comment:read` | Yes | Yes | Yes | Yes |
| **Post Anchor Comment / Reply** | `comment:write` | Yes | Yes | Yes | No |
| **Resolve / Reopen Comment Thread** | `comment:resolve` | Yes | Yes | Yes | No |
| **Submit Manuscript for Peer Review** | `review:request` | Yes | Yes | No | No |
| **Issue Formal Review Decision & Scores** | `review:decide` | Yes | No | Yes | No |
| **Build & Download Submission Packages** | `submission:package` | Yes | Yes | No | No |
| **View Audit Event Stream** | `audit:read` | Yes | Yes | Yes | Yes |

---

### 3. Edge Cases & Security Rules
- **Rule 1: Last Owner Invariance**: A project must always have at least one active `OWNER`. If an owner attempts to demote their own role or remove themselves when no other owner exists, the system responds with `400 Bad Request`.
- **Rule 2: Read-Only Document Integrity for Reviewers**: Reviewers cannot directly edit the manuscript body. Feedback must be recorded through anchored `DocumentComment` records or formal `ReviewRequest` decision notes.
- **Rule 3: Invitation Token Expiry**: Invitation tokens are invalid after 7 days (`expiresAt`). Attempting to accept an expired token marks it as `expired` and denies project membership.
