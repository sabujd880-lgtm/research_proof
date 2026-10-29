# ResearchProof AI 1.0 — Phased UI/UX Migration Plan (UI-A)

**Document Version**: 1.0.0  
**Target Completion**: Phased Execution Across UI-B to UI-J  
**Engineering Leads**: Principal Frontend Architect, UI/UX Systems Specialist  

---

## 1. Migration Architecture & Strategy

To guarantee **zero downtime, zero functionality regression, and zero broken APIs**, the UI/UX redesign follows a strictly non-destructive, phased migration plan:

```
[Phase UI-A: Audit & System Spec]  (DONE)
              │
              ▼
[Phase UI-B: Centralized CSS Token Architecture & Primitives]
              │
              ▼
[Phase UI-C: Linear-Inspired App Shell (Sidebar & 56px Header)]
              │
              ▼
[Phase UI-D: Research Command Center Dashboard & Project Hub]
              │
              ▼
[Phase UI-E: Literature Review, Statistical Analysis & PDF Chat]
              │
              ▼
[Phase UI-F: Systematic Reviews, Journal Readiness & Collaboration]
              │
              ▼
[Phase UI-G: Writing Studio, Document Studio & TextGuard Scanner]
              │
              ▼
[Phase UI-H: Accessibility, Contrast & Interaction Polish]
              │
              ▼
[Phase UI-I: Multi-Resolution Responsive Verification]
              │
              ▼
[Phase UI-J: Comprehensive Release Reports, Tests & Production Gate]
```

---

## 2. Phase-by-Phase Roadmap

### Phase UI-B: Design Tokens & Reusable Component Foundation
- **Goals**:
  - Update `client/src/styles.css` with the complete set of Linear-inspired custom properties (`--rp-*`).
  - Import `Inter` and `JetBrains Mono` fonts and apply to root styles.
  - Standardize base styles for inputs, buttons, cards, badges, and typography.
  - Establish CSS utility classes for `MetricCard`, `DataTable`, `FilterBar`, `EmptyState`, and `FormField`.
- **Target Files**: `client/src/styles.css`, `client/index.html`.

### Phase UI-C: Linear App Shell, Collapsible Sidebar & Top Header
- **Goals**:
  - Redesign Sidebar to 248px expanded, 64px collapsed, and 260px mobile drawer.
  - Standardize 18px Lucide icons, uppercase micro-headers, and active status indicators.
  - Implement 56px Linear Top Header:
    - Subtle breadcrumb path (`Workspace / Overview`).
    - Project Switcher dropdown with progress badge.
    - Quick Search button (`Ctrl+K` trigger).
    - Session security indicator and theme switch (Sun/Moon).
  - Add native Command Palette (`Ctrl+K`) modal for rapid keyboard navigation across all 25+ views.
- **Target Files**: `client/src/App.tsx`, `client/src/styles.css`.

### Phase UI-D: Research Command Center Dashboard & Project Hub
- **Goals**:
  - Transform `Dashboard` into a research command center with 4 compact metric cards.
  - Add an integrated research workflow progress indicator (Literature Review -> Data Analysis -> Drafting -> Submission).
  - Modernize recent documents and revision history lists with compact 40px rows.
  - Modernize `My Research Projects` view: compact cards, clean form, stage badges.
- **Target Files**: `client/src/App.tsx`, `client/src/styles.css`.

### Phase UI-E: Literature Review, Statistical Analysis & PDF Chat
- **Goals**:
  - **Literature Review**: Compact search filter bar, dense comparison matrix table, synthesis preview card.
  - **Statistical Analysis**: Scientific parameter cards, variable type pills, APA 7 narrative container with copy/export actions.
  - **PDF Research Chat**: Elegant split-view layout with passage explorer and grounded Q&A thread.
- **Target Files**: `client/src/modules/LiteratureReview.tsx`, `client/src/modules/StatisticalAnalysis.tsx`, `client/src/modules/PdfResearchChat.tsx`.

### Phase UI-F: Systematic Reviews, Journal Readiness & Collaboration
- **Goals**:
  - **Systematic Reviews**: PRISMA 2020 4-stage pipeline cards, screening toggle buttons, inclusion/exclusion counters.
  - **Journal Submission**: Journal scope match cards, submission readiness meter, cover letter preview.
  - **Research Collaboration**: Team members role badges, Kanban board for research milestones, comment timeline.
- **Target Files**: `client/src/modules/SystematicReviews.tsx`, `client/src/modules/JournalSubmission.tsx`, `client/src/modules/ResearchCollaboration.tsx`.

### Phase UI-G: Writing Studio, Document Studio & TextGuard Scanner
- **Goals**:
  - Modernize 3-column Writing Studio: sleek document navigator left, distraction-free editor center, compact tool tabs right.
  - TextGuard Plagiarism & Similarity scanner: interactive highlight badges, match drawer, certificate generator.
  - Document Studio: Word (.docx) import/export and LaTeX styling controls.
  - Auth pages: Clean Minimal Enterprise login/registration cards with Turnstile widget and Google OAuth button.
- **Target Files**: `client/src/App.tsx`, `client/src/modules/DocumentStudio.tsx`.

### Phase UI-H: Accessibility, Contrast & Interaction Polish
- **Goals**:
  - Verify WCAG 2.2 AA contrast across all Light and Dark components.
  - Ensure high-contrast `:focus-visible` rings for keyboard navigation.
  - Respect `prefers-reduced-motion` media queries.
  - Ensure ARIA labels, `aria-expanded`, and roles are intact.

### Phase UI-I: Responsive Verification
- **Goals**:
  - Test layouts across 4 standard viewports: Desktop (1440px+), Laptop (1024px-1439px), Tablet (768px-1023px), and Mobile (<768px).
  - Validate mobile drawer behavior and touch targets (minimum 36px).

### Phase UI-J: Quality Verification & Release Documentation
- **Goals**:
  - Frontend TypeScript & Vite production build verification.
  - Node.js test suite verification (60/60 tests).
  - Generate release deliverables:
    - `COMPONENT_INVENTORY.md`
    - `ACCESSIBILITY_REPORT.md`
    - `RESPONSIVE_TEST_REPORT.md`
    - `UI_REGRESSION_TEST_REPORT.md`
    - `UI_RELEASE_REPORT.md`
  - Git commit & push.
