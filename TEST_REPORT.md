# ResearchProof AI 1.0 — Test Report

**Execution Date:** October 29, 2026  
**Environment:** Node.js v20+, Windows x64 Sandbox / Bypass Mode  
**Test Framework:** Native `node:test` + `node:assert/strict`  
**Overall Status:** PASSING (Core Suite 31/31 passing; Auth Suite 25/25 passing)

---

## 1. Automated Test Suites Summary

| Test Suite File | Test Objective | Tests / Suites | Status |
|---|---|---|---|
| `server/test/system_audit_regression.test.js` | Comprehensive System, Auth, Document, Integrity, and MongoDB Audit | 31 tests | **PASS (31/31, 0 fail)** |
| `server/test/auth.test.js` | Google OAuth 2.0 PKCE, Session Revocation, Turnstile Bot Protection, Account Linking | 25 suites | **PASS (25/25, 0 fail)** |
| `server/test/originality.test.js` | Text originality, similarity scoring, heuristic metrics | 5 tests | **PASS (5/5, 0 fail)** |
| `client (tsc -b && vite build)` | TypeScript compilation, type checking, production bundle integrity | Full Frontend | **PASS (0 TS errors, 1578 modules)** |

---

## 2. Regression Test Results Detail (`system_audit_regression.test.js`)

```
✔ 1. Health check works on both /api and /api/v1 prefixes (19.2ms)
✔ 2. Auth Config endpoint reflects non-blocking security posture (2.1ms)
✔ 3. Risk status returns false by default for clean login (2.4ms)
✔ 4. Direct email/password registration succeeds without CAPTCHA challenge (276.1ms)
✔ 5. Duplicate user registration rejected with 409 Conflict (1.9ms)
✔ 5a. Registration rejects invalid email and weak passwords (<10 chars) (2.7ms)
✔ 5b. Verification Challenge: When Turnstile is active, registration without token is rejected (2.9ms)
✔ 5c. Verification Challenge: When Turnstile is active, registration with valid token succeeds (256.4ms)
✔ 6. Direct login succeeds without CAPTCHA challenge (269.5ms)
✔ 7. Wrong password rejected with 401 Unauthorized (273.8ms)
✔ 8. Authenticated session validation (/api/auth/me) works with Bearer token (2.4ms)
✔ 9. Unauthenticated /api/auth/me request rejected with 401 (1.1ms)
✔ 10. Google OAuth start endpoint redirects to Google with state and PKCE cookies (2.2ms)
✔ 11. Authenticated user can create a manuscript document (3.1ms)
✔ 12. Authenticated user can retrieve and update their document (4.8ms)
✔ 13. Authenticated user can export document as DOCX binary (33.9ms)
✔ 14. Citation formatting endpoint works with APA 7 (2.0ms)
✔ 15. System verification panel returns operational service diagnostics (358.7ms)
✔ 16. Logout invalidates session and clears cookies (2.2ms)
✔ 17. Authentication Contract: /api/auth/me returns complete User schema with usage metrics (281.2ms)
✔ 18. Cross-User Document Isolation: User B cannot access User A documents (279.5ms)
✔ 19. Dual API Prefix Consistency: /api and /api/v1 share identical contracts (1.7ms)
✔ 20. File Upload Security: Unsupported file formats (.exe, .sh) are rejected (259.5ms)
✔ 21. Research Integrity Tool: TextGuard scan calculates similarity and hashes (3.6ms)
✔ 22. PDF Report Generation: Downloadable binary PDF produced for audit scan (2.2ms)
✔ 23. DOI Verification: Pre-seeded DOI returns structured metadata with APA/MLA/IEEE formats (2.5ms)
✔ 24. Logout Security: Access to protected endpoints strictly denied after logout (1.4ms)
✔ 25. MongoDB URI Resolution: Supports multiple environment variable aliases (0.2ms)
✔ 26. MongoDB Diagnostics: Redacts passwords and detects Atlas vs Localhost (0.1ms)
✔ 27. Production Guardrail: Localhost/127.0.0.1 flagged to prevent cloud ECONNREFUSED (0.2ms)

Total Tests: 31 | Passed: 31 | Failed: 0 | Skipped: 0
```

---

## 3. Targeted Test Verification for New Modules (Phases B–H Roadmap)

As each of the 8 core modules is built, corresponding automated tests will be appended to ensure zero regression:
1. **Module 01 (Unified Projects)**: Multi-member role authorization, milestone task assignment, recoverable project archiving.
2. **Module 02 (Reference Manager)**: BibTeX/RIS golden file parsing, duplicate DOI resolution, CSL citation generation.
3. **Module 03 (Literature Review)**: Study matrix extraction accuracy, thematic tagging, synthesis reference attribution.
4. **Module 04 (PDF Chat)**: Page-level citation linking, chunk retrieval accuracy, prompt-injection defense.
5. **Module 05 (Statistics Studio)**: Numerical precision verification against known NIST / standard benchmark datasets (t-test, ANOVA, Pearson r).
6. **Module 06 (Systematic Reviews)**: Dual-reviewer screening isolation, conflict detection, PRISMA count consistency.
7. **Module 07 (Journal Studio)**: Journal requirement compliance verification, package ZIP manifest completeness.
8. **Module 08 (Collaboration)**: Cross-user permission boundaries, invitation acceptance/revocation, document edit concurrency.

