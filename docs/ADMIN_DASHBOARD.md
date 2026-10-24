# ResearchProof AI — Administrator Dashboard & RBAC Architecture

## 1. Role-Based Access Control (RBAC)
ResearchProof AI implements strict server-side RBAC across all sensitive administrative APIs:
- `researcher`: Default role for all registered and Google-authenticated users. Restricted strictly to self-owned research assets.
- `reviewer`: Read-only peer-review privileges where implemented.
- `admin`: Authorized platform administrator with access to the `/api/admin/*` surface.

### Security Guarantees
1. **Server-Side Enforcement**: The `requireAdmin` middleware inspects the verified JWT and queries the database/in-memory store. Client-side route guards are purely cosmetic; direct API calls from non-admin accounts immediately receive `403 Forbidden`.
2. **No Self-Privileging**: User registration (`POST /api/auth/register`) and profile updates strictly ignore client-submitted `role` fields.
3. **Google Sign-In Isolation**: Google OAuth authentication never grants administrative privileges automatically.

---

## 2. Administrator Provisioning Procedure

Administrators must be provisioned via a secure, audited process rather than hardcoded in source code:

### CLI Provisioning Command
To promote an existing user or create a new administrator account, run from the `server` directory:
```bash
npm run seed:admin <email> <password> [displayName]
```
Example:
```bash
npm run seed:admin security-admin@researchproof.ai "HighEntropyPassword123!" "Security Officer"
```
The command:
1. Validates password complexity (minimum 10 characters).
2. Hashes the password using `bcryptjs` (10 rounds).
3. Connects to `MONGODB_URI` and creates or elevates the user record with `role: 'admin'`.
4. Creates an immutable `AuditEvent` recording the provisioning event.

---

## 3. Administrative Safety Constraints

To protect against administrative lockouts and operational accidents:
1. **Self-Suspension Rejection**: An administrator cannot suspend their own account (`req.user.id === targetUserId` returns `400 Bad Request`).
2. **Last Admin Protection**: The system prevents suspending or removing the final active administrator on the platform.
3. **Mandatory Audit Reasons**: Every account suspension or reactivation requires a descriptive reason string (`reason: z.string().min(3)`), which is persisted in the immutable `AuditEvent` log.
4. **Instant Session Revocation**: Suspending an account or invoking `POST /api/admin/users/:id/revoke-sessions` increments `user.tokenVersion`, rendering all existing JWT tokens and session cookies invalid immediately.
