# ResearchProof AI 1.0 — Phase 8 Implementation Plan
## Complete Systematic Review Assistant (PRISMA 2020 Compliant)

### 1. Executive Summary & Architectural Scope

The Systematic Review Assistant enables academic researchers to execute rigorous, reproducible evidence syntheses adhering to PRISMA 2020 standards (and PRISMA-ScR for scoping reviews).

The pipeline covers the complete methodological lifecycle:
```
Protocol Definition (PICO / Eligibility)
  └── Search Strategy Recording & Logging
        └── Multi-Source Record Import (RIS, BibTeX, CSV, DOIs)
              └── Automated & Assisted Deduplication
                    └── Stage 1: Title & Abstract Screening (Single or Blind Dual-Review)
                          └── Conflict Detection & Adjudication
                                └── Stage 2: Full-Text Eligibility Assessment & Retrieval Tracking
                                      └── Structured Data Extraction & AI Assistance
                                            └── Methodological Risk of Bias Assessment (RoB 2, ROBINS-I, QUADAS-2)
                                                  └── PRISMA 2020 Flow Diagram Generation & Reconciled Synthesis
```

---

### 2. Baseline Verification & Regression Safeguards

Before modifying any existing code:
1. Verify existing test suites (`system_audit_regression.test.js`, `phase3_projects_dashboard.test.js`, `phase4_reference_manager.test.js`, `phase5_literature_review.test.js`, `phase6_pdf_chat.test.js`, `phase7_statistical_studio.test.js`).
2. Maintain 100% backward compatibility for all legacy `/projects/:id/systematic-reviews/*` endpoints.
3. Enforce dual-prefix routing (`/api` and `/api/v1`).
4. Ensure in-memory fallback stores (`memSystematicReviews`, `memReviewProtocols`, `memReviewRecords`, `memReviewConflicts`, `memStudyExtractions`, `memRiskOfBias`, etc.) operate seamlessly when MongoDB is in test or dev mode.

---

### 3. Work Breakdown & Milestones

- **Milestone 1**: Author `PHASE_8_IMPLEMENTATION_PLAN.md` and verify baseline test suite.
- **Milestone 2**: Extend database schemas and in-memory structures in `server/src/models.js`.
- **Milestone 3**: Build `server/src/systematicReviewService.js` (deduplication algorithms, string normalization, Levenshtein distance, PRISMA count reconciliation, risk of bias calculators).
- **Milestone 4**: Implement REST endpoints in `server/src/index.js` for systematic reviews, protocols, search strategies, imports, records, deduplication, screening, conflicts, full-text, data extraction, risk of bias, and PRISMA.
- **Milestone 5**: Redesign `client/src/modules/SystematicReviews.tsx` with a Linear-inspired Minimal Enterprise workspace and interactive SVG PRISMA 2020 flow diagram.
- **Milestone 6**: Author and run comprehensive test suite `server/test/phase8_systematic_reviews.test.js`.
- **Milestone 7**: Execute full regression across all modules (Phases 1–8).
- **Milestone 8**: Generate all documentation deliverables (`PHASE_8_DATABASE_SCHEMA.md`, `PHASE_8_API_DOCUMENTATION.md`, `PHASE_8_SCREENING_WORKFLOW.md`, `PHASE_8_PRISMA_VALIDATION.md`, `PHASE_8_SECURITY_REPORT.md`, `PHASE_8_TEST_REPORT.md`, `PHASE_8_RELEASE_GATE.md`).
- **Milestone 9**: Commit and push to `origin/main`.

